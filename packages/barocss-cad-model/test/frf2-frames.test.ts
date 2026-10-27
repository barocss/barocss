import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, withNode, type PartInstance, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { revisionOf } from '../src/team/team';
import { drawingInputs } from '../src/chat/drawing';
import { drawingIssues, issueContext } from '../src/drawing/issues';
import { readDrawing } from '../src/drawing/types';

// FRf2 (O125): the base part's frame following a placed part's sketch, against closed forms — a 300 × 200 plate placed
// at z = 100, a mitred RHS 40 × 40 × 3 frame on its sketch: members A · 300, A · 200 on z = 100, the part's revision
// pinned; the sketch widened to 400 in the part, the frame follows (A · 400), said changed in the summary, the member's
// notes and the drawing's issues until relinked; the part moved, the frame moves, nothing stale (the revision is the
// part's content); what would break it refused, typed, naming the frame: deleting the part, the sketch made a circle
// or a triangle, a frame inside a placed part following a sibling (FRAME_PART_SCOPE), a part or feature not there.

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const A = 1600 - 34 * 34, RHS = { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 };
const SKETCH = (w: number) => ({ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [w, 200] });
const plate = (w: number): StudioDoc => withNode(withNode(emptyDoc(), SKETCH(w) as never), { kind: 'extrude', sketch: 0, height: 10 } as never);
const part = (id: string, z: number): PartInstance => ({ id, name: id, doc: plate(300), position: [0, 0, z], rotation: [0, 0, 0] });
const frame = (follows: object) => ({ kind: 'frame', follows, section: RHS, corners: { default: 'mitre' } });
async function ok(s: ChatState, tool: string, args: Record<string, unknown>) { const r = await dispatchTool(s, tool, args, evaluate); assert.ok(!r.isError, `${tool}: ${r.content}`); return r; }
async function refused(s: ChatState, tool: string, args: Record<string, unknown>, re: RegExp) { const r = await dispatchTool(s, tool, args, evaluate); assert.ok(r.isError, `${tool} should be refused`); assert.match(JSON.parse(r.content).error, re); }
const start = async () => ok({ doc: { ...emptyDoc(), instances: [part('p1', 100), part('p2', 400)] }, bodies: [] }, 'add_features', { features: [frame({ part: 'p1', sketch: 'n0' })] });
const lengths = (s: ChatState) => s.bodies.map(b => b.volume! / A).sort((a, b) => a - b);
const near = (a: number[], b: number[]) => assert.ok(a.length === b.length && a.every((v, k) => Math.abs(v - b[k]) <= 1e-6 * b[k]), `${a} vs ${b}`);

test('FRf2 a base frame on a placed part\'s sketch: members A · 300 and A · 200 on z = 100, the part\'s revision pinned; its notes name the part; the part moved to z = 150 — the frame moves, nothing stale', async () => {
  let s = (await start()).state;
  near(lengths(s), [200, 200, 300, 300]);
  for (const b of s.bodies) assert.ok(Math.abs((b.mesh.bounds.min[2] + b.mesh.bounds.max[2]) / 2 - 100) <= 1e-9);
  const f = s.doc.nodes[0] as { follows: { revision?: string } };
  assert.equal(f.follows.revision, revisionOf(s.doc.instances![0].doc));
  assert.ok(s.bodies[0].notes!.some(n => !n.warning && /^Follows p1's sketch n0 \(revision [0-9a-f]{16}\)$/.test(n.text)), JSON.stringify(s.bodies[0].notes));
  s = (await ok(s, 'place_part', { part: 'p1', position: [0, 0, 150] })).state;
  const e = await evaluate(s.doc); assert.ok(e.ok);
  for (const b of e.bodies) assert.ok(Math.abs((b.mesh.bounds.min[2] + b.mesh.bounds.max[2]) / 2 - 150) <= 1e-9, 'moved with the part');
  assert.equal(JSON.parse((await ok({ doc: s.doc, bodies: e.bodies }, 'get_part_summary', {})).content).followed_changed, undefined);
});

test('FRf2 the part\'s sketch widened to 400 through the part: the frame follows (A · 400); said changed — the summary, the member\'s notes, the drawing\'s issues — until relinked, which clears it', async () => {
  let s = (await start()).state;
  s = (await ok(s, 'edit_feature', { part: 'p1', index: 0, feature: SKETCH(400) })).state;
  const e = await evaluate(s.doc); assert.ok(e.ok); s = { doc: s.doc, bodies: e.bodies };
  near(lengths(s), [200, 200, 400, 400]);
  const summary = JSON.parse((await ok(s, 'get_part_summary', {})).content);
  assert.equal(summary.followed_changed.length, 1); assert.match(summary.followed_changed[0].message, /follows p1's sketch n0, which changed since it was linked \(revision [0-9a-f]+ → [0-9a-f]+\): .*relink/);
  assert.ok(s.bodies[0].notes!.some(n => n.warning && /^Follows p1's sketch n0, which changed since it was linked/.test(n.text)));
  const sheet = (d: StudioDoc) => { const i = drawingInputs(d, readDrawing(d.drawing)); assert.ok(typeof i !== 'string', String(i)); return drawingIssues(issueContext({ ...i, meta: { ...i.meta, date: '2026-10-22' } })); };
  assert.ok(sheet(s.doc).some(x => x.code === 'FOLLOWED_CHANGED' && x.severity === 'warning'));
  const now = revisionOf(s.doc.instances![0].doc);
  s = (await ok(s, 'edit_feature', { index: 0, feature: frame({ part: 'p1', sketch: 'n0', revision: now }) })).state;
  assert.equal(JSON.parse((await ok(s, 'get_part_summary', {})).content).followed_changed, undefined, 'relinked');
  assert.ok(!sheet(s.doc).some(x => x.code === 'FOLLOWED_CHANGED'));
});

test('FRf2 refused, typed, naming the frame: deleting the part; its sketch made a circle, or a triangle (edges 4 → 3); a frame inside p2 following p1 (FRAME_PART_SCOPE); a part or a feature not there', async () => {
  const s = (await start()).state;
  await refused(s, 'delete_part', { part: 'p1' }, /^\[FRAME_PART_IN_USE\] p1 holds the sketch n0 that feature 0 \(Frame .*\) follows/);
  await refused(s, 'edit_feature', { part: 'p1', index: 0, feature: { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 50 } }, /^\[FRAME_PART_IN_USE\] feature 0 .* follows p1's sketch n0: the edit would leave it not a straight-edged sketch/);
  await refused(s, 'edit_feature', { part: 'p1', index: 0, feature: { kind: 'sketch', profile: 'polygon', points: [[0, 0], [300, 0], [0, 200]] } }, /^\[FRAME_PART_IN_USE\] .*its edges 4 → 3/);
  await refused(s, 'add_features', { part: 'p2', features: [frame({ part: 'p1', sketch: 'n0' })] }, /\[FRAME_PART_SCOPE\] a placed part's frame follows only its own part's features/);
  await refused(s, 'add_features', { features: [frame({ part: 'p9', sketch: 'n0' })] }, /\[FRAME_PART_UNKNOWN\] .*part p9, which the assembly does not hold \(parts: p1, p2\)/);
  await refused(s, 'add_features', { features: [frame({ part: 'p1', sketch: 'n7' })] }, /\[FRAME_PART_FEATURE_GONE\] part p1 has no feature n7/);
  // (Deleting p2, which no frame follows, is fine.)
  await ok(s, 'delete_part', { part: 'p2' });
});
