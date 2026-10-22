import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePart, type BodyResult } from '../src/engine/evaluate';
import { emptyDoc, withNode, type FrameSectionRow, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { editSections, sectionUses } from '../src/frames/sections';
import { WireReceiver, WireSender } from '../src/engine/wireDoc';
import { contentKey, evaluationKey } from '../src/engine/evalMemo';

// FRc (O117): the user's section library against closed forms — a frame on a row evaluates to the bodies the same section
// inline gives (volume, centroid and box exactly); a row edited moves every frame on it (two straight frames of a sharp
// RHS w × h × t: A = wh − (w − 2t)(h − 2t), each member A · 300, before and after); rows need a source or an estimate
// flag (none is built in, D122) and are refused by name; a row in use is not removed; a section naming no row refused
// before the kernel, and a document naming a deleted or renamed row refused at evaluation, typed, never a fallback.

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const bodiesOf = async (doc: StudioDoc): Promise<BodyResult[]> => { const r = await evaluate(doc); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return r.bodies; };
const RHS = (w: number, h: number, t: number) => ({ kind: 'rect-tube' as const, width: w, height: h, wall: t, outerRadius: 0 });
const A = (w: number, h: number, t: number) => w * h - (w - 2 * t) * (h - 2 * t);
const ROW: FrameSectionRow = { id: 'R40', name: 'RHS 40', section: RHS(40, 40, 3), source: 'a test value' };
const lib = (doc: StudioDoc, rows: FrameSectionRow[] = [ROW]): StudioDoc => ({ ...doc, frames: { version: 1, sections: rows } });
const L = (section: unknown) => withNode(emptyDoc(), { kind: 'frame', points: [[0, 0, 0], [300, 0, 0], [300, 200, 0]], segments: [[0, 1], [1, 2]], section, corners: { default: 'mitre' } } as never);
const straight = (doc: StudioDoc, y: number) => withNode(doc, { kind: 'frame', points: [[0, y, 0], [300, y, 0]], segments: [[0, 1]], section: { kind: 'library', id: 'R40' } } as never);
const close = (a: number, b: number, what: string) => assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);

test('FRc a frame on a library row is the frame with that section inline: the mitred L\'s two members — the same volumes, centroids and boxes exactly; its panel names the row and its source (an estimate row warned)', async () => {
  const inline = await bodiesOf(L(ROW.section)), named = await bodiesOf(lib(L({ kind: 'library', id: 'R40' })));
  assert.equal(named.length, 2);
  // (Its panel names the row and its source; an estimate row is said as one.)
  assert.ok(named[0].notes!.some(n => n.text === 'From your section library: RHS 40 (a test value)'), JSON.stringify(named[0].notes));
  const est = await bodiesOf(lib(L({ kind: 'library', id: 'E' }), [{ id: 'E', section: ROW.section, estimate: true }]));
  assert.ok(est[0].notes!.some(n => n.warning && /From your section library: E — its sizes are estimates/.test(n.text)), JSON.stringify(est[0].notes));
  named.forEach((b, k) => {
    assert.equal(b.volumeMM3, inline[k].volumeMM3, `member ${k} volume`);
    assert.deepEqual(b.centroid, inline[k].centroid); assert.deepEqual(b.mesh.bounds, inline[k].mesh.bounds);
  });
});

test('FRc a row edited moves every frame on it: two frames on R40 (40 × 40 × 3) — each A · 300 = 133 200 mm³; R40 made 50 × 30 × 4 through set_frame_sections — each 2 · 4 · (50 + 30 − 8) · 300 = 172 800', async () => {
  let state: ChatState = { doc: straight(straight(lib(emptyDoc()), 0), 500), bodies: [] };
  state = { ...state, bodies: await bodiesOf(state.doc) };
  assert.equal(state.bodies.length, 2);
  for (const b of state.bodies) close(b.volumeMM3!, A(40, 40, 3) * 300, 'before');
  const r = await dispatchTool(state, 'set_frame_sections', { rows: [{ id: 'R40', section: RHS(50, 30, 4), source: 'a test value' }] }, evaluate);
  assert.ok(!r.isError, r.content);
  const out = JSON.parse(r.content);
  assert.deepEqual([out.added, out.replaced, out.removed], [[], ['R40'], []]);
  for (const b of r.state.bodies) close(b.volumeMM3!, A(50, 30, 4) * 300, 'after');
  assert.equal(A(50, 30, 4) * 300, 172800);
  // (Both frames name it: removing it is refused, naming them.)
  const busy = await dispatchTool(r.state, 'set_frame_sections', { remove: ['R40'] }, evaluate);
  assert.ok(busy.isError); assert.match(JSON.parse(busy.content).error, /^\[FRAME_SECTION_IN_USE\] "R40" is used by feature 0 \(.*\), feature 1 \(.*\): give those another section first/);
  assert.deepEqual([...sectionUses(r.state.doc).keys()], ['R40']); assert.equal(sectionUses(r.state.doc).get('R40')!.length, 2);
});

test('FRc rows refused by name: no source and no estimate flag, a sketch section, a section missing a dimension, a field of its own, two rows of one id, removing a row there is not; an estimate row kept as one; an unused row removed', () => {
  const d = emptyDoc();
  for (const [rows, re] of [
    [[{ id: 'a', section: RHS(40, 40, 3) }], /row 0: a: say where the sizes come from .* none is built in/],
    [[{ id: 'a', section: { kind: 'sketch', sketch: 0 }, source: 's' }], /row 0: a: section is one by its dimensions/],
    [[{ id: 'a', section: { kind: 'rect-tube', width: 40, height: 40, wall: 3 }, source: 's' }], /row 0: a: a rect-tube section needs "outerRadius"/],
    [[{ id: 'a', section: RHS(40, 40, 3), source: 's', colour: 'red' }], /row 0: a: no field "colour"/],
    [[{ id: 'a', section: RHS(40, 40, 3), source: 's' }, { id: 'a', section: RHS(30, 30, 2), source: 's' }], /two rows with one id/],
  ] as const) { const r = editSections(d, rows as unknown as unknown[]); assert.ok('error' in r, JSON.stringify(rows)); assert.match(r.error, re); }
  const gone = editSections(d, [], ['x']); assert.ok('error' in gone && /^\[FRAME_SECTION_UNKNOWN\] no row "x"/.test(gone.error));
  const est = editSections(d, [{ id: 'E', section: RHS(25, 25, 2), estimate: true }]);
  assert.ok(!('error' in est)); assert.deepEqual(est.doc.frames!.sections, [{ id: 'E', section: RHS(25, 25, 2), estimate: true }]);
  const rm = editSections(est.doc, [], ['E']); assert.ok(!('error' in rm)); assert.deepEqual([rm.removed, rm.doc.frames!.sections], [['E'], []]);
});

test('FRc a section naming no row: add_features refuses it before the kernel (FRAME_SECTION_UNKNOWN, the rows listed); a document naming a deleted or renamed row refused at evaluation, typed (FRAME_SECTION_UNKNOWN), not a fallback', async () => {
  const s: ChatState = { doc: lib(emptyDoc()), bodies: [] };
  const r = await dispatchTool(s, 'add_features', { features: [{ kind: 'frame', points: [[0, 0, 0], [300, 0, 0]], segments: [[0, 1]], section: { kind: 'library', id: 'R99' } }] }, evaluate);
  assert.ok(r.isError); assert.match(JSON.parse(r.content).error, /\[FRAME_SECTION_UNKNOWN\] no row "R99" in the section library \(rows: R40\)/);
  const ok = await dispatchTool(s, 'add_features', { features: [{ kind: 'frame', points: [[0, 0, 0], [300, 0, 0]], segments: [[0, 1]], section: { kind: 'library', id: 'R40' } }] }, evaluate);
  assert.ok(!ok.isError, ok.content); close(ok.state.bodies[0].volumeMM3!, A(40, 40, 3) * 300, 'on the row');
  // (A row deleted or renamed under a frame — the document written by hand: refused, typed, before the kernel; no fallback.)
  for (const doc of [straight(emptyDoc(), 0), lib(straight(emptyDoc(), 0), [{ ...ROW, id: 'R40b' }])]) {
    const r2 = await evaluate(doc);
    assert.ok(!r2.ok); assert.equal(r2.error.title, 'A frame names a section that is not in the library');
    assert.match(r2.error.detail, /^\[FRAME_SECTION_UNKNOWN\] a frame's section names the library row "R40", which the document's section library does not hold \(rows: (none|R40b)\)$/);
  }
});

test('FRc the palette: with a library, the member command offers "From your library" and its rows — the member takes the row by id; without one, the kinds alone', async () => {
  const s: ChatState = { doc: lib(emptyDoc()), bodies: [] };
  const r = await dispatchTool(s, 'run_command', { command: 'frame-member', values: { section: 'library', row: 'R40', x0: 0, y0: 0, z0: 0, x1: 500, y1: 0, z1: 0 } }, evaluate);
  assert.ok(!r.isError, r.content);
  assert.deepEqual((r.state.doc.nodes.at(-1) as { section: unknown }).section, { kind: 'library', id: 'R40' });
  close(r.state.bodies[0].volumeMM3!, A(40, 40, 3) * 500, 'the member');
  const bare = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'run_command', { command: 'frame-member', values: { section: 'library', row: 'R40', x0: 0, y0: 0, z0: 0, x1: 500, y1: 0, z1: 0 } }, evaluate);
  assert.ok(bare.isError, 'no library: no such section kind');
});

test('FRc the engine worker gets the section library: a frame on a row, sent over the wire, evaluates to the same bodies (the studio evaluates off the main thread); the stock list stays behind; the caches\' keys follow an edited row', async () => {
  const doc: StudioDoc = { ...lib(L({ kind: 'library', id: 'R40' })), frames: { version: 1, sections: [ROW], stock: [{ id: 'S6', lengthMM: 6000, source: 'a test value' }], kerfMM: 2 } };
  const there = new WireReceiver().unpack(new WireSender().pack(doc));
  assert.deepEqual(there.frames, { version: 1, sections: [ROW] });
  const a = await bodiesOf(doc), b = await bodiesOf(there);
  assert.deepEqual(b.map(x => x.volumeMM3), a.map(x => x.volumeMM3));
  // (The caches' keys follow an edited row: evaluation, face tables and rendered views are not served stale.)
  const edited: StudioDoc = { ...doc, frames: { ...doc.frames!, sections: [{ ...ROW, section: RHS(50, 30, 4) }] } };
  assert.notEqual(evaluationKey(edited), evaluationKey(doc)); assert.notEqual(contentKey(edited), contentKey(doc));
  assert.equal(contentKey(L(ROW.section)), contentKey({ ...L(ROW.section), frames: { version: 1, stock: [] } }), 'no library: the key as before');
});
