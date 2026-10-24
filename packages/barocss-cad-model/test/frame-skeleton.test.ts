import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';

// FRf (O121): shared skeletons against closed forms — two frames on one skeleton (a 600 × 400 rectangle; sharp RHS
// 40 × 40 × 3 and 20 × 20 × 2, mitred: each member A · L) follow it as it is edited to 800 × 400; a frame follows a
// sketch's rectangle as the sketch is edited; what would break them is refused, typed, naming the frames: deleting the
// skeleton, taking away a segment, or a point its segments use; a curved sketch; a document naming no skeleton.

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const A = (w: number, t: number) => w * w - (w - 2 * t) ** 2;
const RHS = (w: number, t: number) => ({ kind: 'rect-tube', width: w, height: w, wall: t, outerRadius: 0 });
const SKELETON = { kind: 'skeleton', name: 'top', points: [[0, 0, 0], [600, 0, 0], [600, 400, 0], [0, 400, 0]], segments: [[0, 1], [1, 2], [2, 3], [3, 0]] };
const onIt = (section: object) => ({ kind: 'frame', follows: { skeleton: 0 }, section, corners: { default: 'mitre' } });
async function run(s: ChatState, tool: string, args: Record<string, unknown>) { const r = await dispatchTool(s, tool, args, evaluate); return r; }
async function ok(s: ChatState, tool: string, args: Record<string, unknown>) { const r = await run(s, tool, args); assert.ok(!r.isError, `${tool}: ${r.content}`); return r.state; }
const volumes = (s: ChatState, node: number) => s.bodies.filter(b => b.ref?.node === node).map(b => b.volume!).sort((a, b) => a - b);
const close = (a: readonly number[], b: readonly number[]) => assert.ok(a.length === b.length && a.every((x, k) => Math.abs(x - b[k]) <= 1e-9 * Math.max(1, b[k])), `${a} vs ${b}`);

test('FRf two frames on one skeleton: 4 members each, A · L (L 600, 400); the skeleton edited to 800 × 400 — both follow; its points kept as a copy in each frame', async () => {
  let s = await ok({ doc: emptyDoc(), bodies: [] }, 'add_features', { features: [SKELETON, onIt(RHS(40, 3)), onIt(RHS(20, 2))] });
  assert.equal(s.bodies.length, 8);
  close(volumes(s, 1), [400, 400, 600, 600].map(L => A(40, 3) * L)); close(volumes(s, 2), [400, 400, 600, 600].map(L => A(20, 2) * L));
  assert.deepEqual((s.doc.nodes[1] as { points: unknown }).points, SKELETON.points, 'the copy');
  s = await ok(s, 'edit_feature', { index: 0, values: { 'p1.x': 800, 'p2.x': 800 } });
  close(volumes(s, 1), [400, 400, 800, 800].map(L => A(40, 3) * L)); close(volumes(s, 2), [400, 400, 800, 800].map(L => A(20, 2) * L));
});

test('FRf what would break the frames is refused, typed, naming them: deleting the skeleton; a segment taken away; a point its segments use taken away — moving points and adding some is fine', async () => {
  const s = await ok({ doc: emptyDoc(), bodies: [] }, 'add_features', { features: [SKELETON, onIt(RHS(40, 3)), onIt(RHS(20, 2))] });
  const refused = async (tool: string, args: Record<string, unknown>, re: RegExp) => { const r = await run(s, tool, args); assert.ok(r.isError, tool); assert.match(JSON.parse(r.content).error, re); };
  await refused('delete_feature', { index: 0 }, /^\[FRAME_SKELETON_IN_USE\] feature 0 \(a skeleton\) is followed by feature 1 \(Frame .*\), feature 2 \(Frame .*\)/);
  await refused('edit_feature', { index: 0, feature: { ...SKELETON, segments: SKELETON.segments.slice(0, 3) } }, /^\[FRAME_SKELETON_IN_USE\] skeleton 0's segments 4 → 3: feature 1 .*, feature 2 .* have a member on each/);
  await refused('edit_feature', { index: 0, feature: { ...SKELETON, points: SKELETON.points.slice(0, 3), segments: [[0, 1], [1, 2], [2, 0], [2, 0]] } }, /^\[FRAME_SKELETON_IN_USE\] skeleton 0's point 4 taken away: feature 1 .*, feature 2 .* use it/);
  const grown = await run(s, 'edit_feature', { index: 0, feature: { ...SKELETON, points: [...SKELETON.points, [300, 200, 0]], segments: [...SKELETON.segments, [0, 4]] } });
  assert.ok(!grown.isError, grown.content); assert.equal(grown.state.bodies.length, 10, 'a member more on each');
});

test('FRf a frame following a sketch: a 300 × 200 rectangle on the plane z = 100 — 4 members A · L at z = 100; the sketch edited to 500 × 200, the frame follows; a circle is refused (curved)', async () => {
  const sketch = { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [300, 200], plane: { origin: [0, 0, 100], normal: [0, 0, 1], xAxis: [1, 0, 0] } };
  let s = await ok({ doc: emptyDoc(), bodies: [] }, 'add_features', { features: [sketch, { kind: 'frame', follows: { sketch: 0 }, section: RHS(40, 3), corners: { default: 'mitre' } }] });
  close(volumes(s, 1), [200, 200, 300, 300].map(L => A(40, 3) * L));
  for (const b of s.bodies) assert.ok(Math.abs((b.mesh.bounds.min[2] + b.mesh.bounds.max[2]) / 2 - 100) <= 1e-9, 'on the sketch\'s plane');
  s = await ok(s, 'edit_feature', { index: 0, feature: { ...sketch, max: [500, 200] } });
  close(volumes(s, 1), [200, 200, 500, 500].map(L => A(40, 3) * L));
  const circle = { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 50 };
  const r = await run({ doc: emptyDoc(), bodies: [] }, 'add_features', { features: [circle, { kind: 'frame', follows: { sketch: 0 }, section: RHS(40, 3) }] });
  assert.ok(r.isError); assert.match(JSON.parse(r.content).error, /\[FRAME_SKETCH_CURVED\] sketch 0 \(circle\) has curved edges/);
});

test('FRf refused before the kernel, typed: a frame following a feature that is no skeleton (add_features); a document written so (evaluation)', async () => {
  const box = { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] };
  const r = await run({ doc: emptyDoc(), bodies: [] }, 'add_features', { features: [box, onIt(RHS(40, 3))] });
  assert.ok(r.isError); assert.match(JSON.parse(r.content).error, /\[FRAME_SKELETON_UNKNOWN\] feature 0 is a sketch, not a skeleton/);
  const written = withNode(withNode(emptyDoc(), box as never), { ...onIt(RHS(40, 3)), points: [[0, 0, 0], [1, 0, 0]], segments: [[0, 1]] } as never);
  const e = await evaluate(written);
  assert.ok(!e.ok); assert.match(e.error.detail, /^\[FRAME_SKELETON_UNKNOWN\] the frame follows feature 0, which is a sketch, not a skeleton/);
});
