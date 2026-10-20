import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, type SketchNode, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { confirmDimension, draftWarning, readDrafts, unconfirmed } from '../src/chat/drafts';
import { readDxfSketch } from '../src/sketch/dxfRead';
import { sketchDxf } from '../src/sketch/dxf';
import { traceImage } from '../src/chat/trace';
import { answerBatch } from '../src/chat/questions';

// A6.4 (O28): images and drawings give drafts only. Our DXF reader against our own writer's files (both versions) and a
// hand-written one in inches, by the closed forms of the profile's area; its typed refusals; a dimension confirmed at
// another value re-driving the features (volumes by closed form); unconfirmed dimensions as check_spec unknowns, the
// export warning, and a question about one (ask_user) answered as the user's.

const CASES = resolve(process.cwd(), '../../packages/barocss-cad/conformance/a6/drawings');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const call = (s: ChatState, tool: string, args: object) => dispatchTool(s, tool, args, evaluate);
const ok = async (s: ChatState, tool: string, args: object) => { const r = await call(s, tool, args); assert.ok(!r.isError, `${tool}: ${r.content}`); return r; };
const code = (content: string) => (/^\[([A-Z_]+)\]/.exec(JSON.parse(content).error ?? '') ?? [])[1];
const near = (a: number, b: number, rel = 1e-6) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(b));
const volume = (s: ChatState) => s.bodies.reduce((v, b) => v + (b.volumeMM3 ?? 0), 0);
/** A drawing's sketch extruded 5 mm: the draft's profile as a solid. */
async function extruded(s: ChatState) { return (await ok(s, 'add_features', { features: [{ kind: 'extrude', sketch: s.doc.nodes.length - 1, height: 5 }] })).state; }

/** A 60 × 40 plate with two Ø8 holes, as a sketch (the outer loop, two circular holes as two arcs each). */
const PLATE: SketchNode = {
  kind: 'sketch', profile: 'loop', segments: [{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [60, 0] }, { kind: 'line', start: [60, 40] }, { kind: 'line', start: [0, 40] }],
  holes: [15, 45].map(x => [{ kind: 'arc' as const, start: [x + 4, 20] as [number, number], center: [x, 20] as [number, number], direction: 'ccw' as const }, { kind: 'arc' as const, start: [x - 4, 20] as [number, number], center: [x, 20] as [number, number], direction: 'ccw' as const }]),
};
const PLATE_AREA = 60 * 40 - 2 * Math.PI * 16;

test('our DXF writer\'s files (AC1015 and AC1009) read back to the same profile: area by the closed form, holes, units', async () => {
  for (const version of ['AC1015', 'AC1009'] as const) {
    const file = join(CASES, `plate-ours-${version.toLowerCase()}.dxf`), w = sketchDxf(PLATE, {}, version);
    if (process.env.UPDATE_A6_FIXTURES || !existsSync(file)) writeFileSync(file, w.text);
    const text = readFileSync(file, 'utf8'), d = readDxfSketch(text);
    assert.equal(d.regions.length, 1, version); assert.equal(d.holes.length, 2, version);
    assert.ok(d.holes.every(h => h.circle && near(h.circle.radius, 4, 1e-9)), JSON.stringify(d.holes.map(h => h.circle)));
    const s = await extruded((await ok({ doc: emptyDoc(), bodies: [] }, 'import_drawing', { dxf: text, name: `plate ${version}` })).state);
    assert.ok(near(volume(s), PLATE_AREA * 5), `${version}: ${volume(s)} vs ${PLATE_AREA * 5}`);
    const dims = readDrafts(s.doc.drafts).drafts[0].dims.map(x => [x.name, x.value]);
    assert.deepEqual(dims, [['width', 60], ['height', 40], ['d1', 8], ['d2', 8]], version);
  }
});

test('a hand-written DXF in inches (LINE, ARC, CIRCLE, with text and a dimension left out): to mm, area by the closed form', async () => {
  const text = readFileSync(join(CASES, 'by-hand-inches.dxf'), 'utf8'), d = readDxfSketch(text);
  assert.equal(d.unit.toMM, 25.4); assert.ok(d.unit.declared);
  assert.deepEqual(d.ignored, { TEXT: 1, DIMENSION: 1 });
  const r = await ok({ doc: emptyDoc(), bodies: [] }, 'import_drawing', { dxf: text, name: 'bracket' }), c = JSON.parse(r.content);
  assert.deepEqual(c.left_out, { TEXT: 1, DIMENSION: 1 });
  const s = await extruded(r.state), area = (3 * 2 + Math.PI / 2 - Math.PI * 0.25 ** 2) * 25.4 ** 2;
  assert.ok(near(volume(s), area * 5), `${volume(s)} vs ${area * 5}`);
  const dims = Object.fromEntries(readDrafts(s.doc.drafts).drafts[0].dims.map(x => [x.name, x.value]));
  assert.ok(near(dims.width, 4 * 25.4, 1e-9) && near(dims.height, 2 * 25.4, 1e-9) && near(dims.d1, 0.5 * 25.4, 1e-9), JSON.stringify(dims));
});

test('drawings refused, typed: a spline, a gap, a loop in a hole, nothing to read, a malformed file, a line off the XY plane', async () => {
  for (const [file, want] of [['refuse-spline.dxf', 'DXF_UNSUPPORTED'], ['refuse-open.dxf', 'DXF_OPEN'], ['refuse-nested.dxf', 'DXF_NESTED'], ['refuse-empty.dxf', 'DXF_EMPTY'], ['refuse-malformed.dxf', 'DXF_MALFORMED'], ['refuse-3d.dxf', 'DXF_UNSUPPORTED']] as const) {
    const s: ChatState = { doc: emptyDoc(), bodies: [] }, r = await call(s, 'import_drawing', { dxf: readFileSync(join(CASES, file), 'utf8') });
    assert.equal(code(r.content), want, `${file}: ${r.content}`); assert.equal(r.state, s);
  }
  assert.match((await call({ doc: emptyDoc(), bodies: [] }, 'import_drawing', { dxf: readFileSync(join(CASES, 'refuse-open.dxf'), 'utf8') })).content, /not closed at \(0\.00000, 10\.0000\) mm/);
});

test('a dimension confirmed at another value re-drives the features: the drawing scaled (its holes with it, unconfirmed again), one hole alone', async () => {
  let s = (await ok({ doc: emptyDoc(), bodies: [] }, 'import_drawing', { dxf: sketchDxf(PLATE, {}).text, name: 'plate' })).state;
  s = await extruded(s);
  assert.deepEqual(unconfirmed(s.doc).map(u => u.key), ['F1.width', 'F1.height', 'F1.d1', 'F1.d2']);
  // (Confirmed as it is: nothing moves.)
  s = (await ok(s, 'run_command', { command: 'box', values: { w: 1, d: 1, h: 1, x: 200, y: 0, z: 0 } })).state;
  const v0 = volume(s);
  let doc = confirmDimension(s.doc, 'F1.height', undefined, 't1');
  assert.equal(JSON.stringify(doc.nodes), JSON.stringify(s.doc.nodes));
  // (The width at 120: the plate scaled ×2 about its corner — area ×4 — the height 80, the holes 16, unconfirmed again.)
  doc = confirmDimension(doc, 'F1.width', 120, 't2');
  let e = await evaluate(doc); assert.ok(e.ok);
  assert.ok(near(e.bodies.reduce((v, b) => v + (b.volumeMM3 ?? 0), 0), PLATE_AREA * 4 * 5 + 1), String(e.bodies.reduce((v, b) => v + (b.volumeMM3 ?? 0), 0)));
  const dims = readDrafts(doc.drafts).drafts[0].dims;
  assert.deepEqual(dims.map(x => [x.name, x.value, !!x.confirmed]), [['width', 120, true], ['height', 80, false], ['d1', 16, false], ['d2', 16, false]]);
  // (One hole at 10: only that loop, about its centre, now at (30, 40).)
  doc = confirmDimension(doc, 'F1.d1', 10, 't3'); e = await evaluate(doc); assert.ok(e.ok);
  const area = 120 * 80 - Math.PI * 25 - Math.PI * 64;
  assert.ok(near(e.bodies.reduce((v, b) => v + (b.volumeMM3 ?? 0), 0), area * 5 + 1), String(e.bodies.reduce((v, b) => v + (b.volumeMM3 ?? 0), 0)));
  assert.throws(() => confirmDimension(doc, 'F1.d1', -1, 'x'), /BAD_VALUE/); assert.throws(() => confirmDimension(doc, 'F9.width', 1, 'x'), /NO_DRAFT/);
  void v0;
});

test('an image draft: its width and thickness re-drive the relief (volume by closed form); unknowns in check_spec; the export warning; a question about a dimension answered as the user\'s', async () => {
  // (A 20 × 20 px black square on white: the silhouette a square.)
  const W = 40, H = 40, px = new Uint8ClampedArray(W * H * 4).fill(255);
  for (let y = 10; y < 30; y++) for (let x = 10; x < 30; x++) px.set([0, 0, 0, 255], (y * W + x) * 4);
  let s: ChatState = { doc: emptyDoc(), bodies: [], images: [traceImage(px, W, H)] };
  s = (await ok(s, 'extrude_image_layer', { layer: 'silhouette', width_mm: 20, height: 3 })).state;
  // (The traced outline is the square as simplified: its area A, whatever it is; the closed forms are the ratios.)
  const A = volume(s) / 3; assert.ok(A > 0.9 * 400 && A <= 400 + 1e-6, String(A));
  assert.deepEqual(unconfirmed(s.doc).map(u => u.key), ['F1.width', 'F1.thickness']);
  assert.match(draftWarning(s.doc)!, /2 dimensions from an image or drawing are not confirmed \(F1\.width, F1\.thickness\)/);
  s = (await ok(s, 'set_requirements', { requirements: [{ id: 'R1', source: 'x', hard: false, basis: 'assumed', check: { op: '>=', query: { fn: 'volume' }, value: 1 } }] })).state;
  const rep = JSON.parse((await ok(s, 'check_spec', {})).content);
  assert.deepEqual(rep.unknowns.map((u: { req_id: string }) => u.req_id), ['draft:F1.width', 'draft:F1.thickness']);
  // (A question about the width — a draft dimension — is allowed; about the brief's purpose without a brief, too.)
  assert.equal(code((await call(s, 'ask_user', { questions: [{ id: 'q1', text: 'How wide?', kind: 'text', blocks: { dimension: 'F1.width' } }] })).content), 'BAD_QUESTION');
  s = (await ok(s, 'ask_user', { questions: [{ id: 'q1', text: 'How wide should it be?', kind: 'number', unit: 'mm', blocks: { dimension: 'F1.width' } }] })).state;
  const a = answerBatch(s.doc, { q1: 40 }, 'now'); assert.ok(!('error' in a), JSON.stringify(a));
  let e = await evaluate(a.doc); assert.ok(e.ok);
  assert.ok(near(e.bodies.reduce((v, b) => v + (b.volumeMM3 ?? 0), 0), A * 4 * 3), String(e.bodies.reduce((v, b) => v + (b.volumeMM3 ?? 0), 0)));
  // (The thickness at 6: the extrusion's height.)
  const t = confirmDimension(a.doc, 'F1.thickness', 6, 'later'); e = await evaluate(t); assert.ok(e.ok);
  assert.ok(near(e.bodies.reduce((v, b) => v + (b.volumeMM3 ?? 0), 0), A * 4 * 6));
  assert.equal(draftWarning(t), null);
  // (A confirmed dimension blocks nothing.)
  assert.equal(code((await call({ ...s, doc: { ...t, questions: undefined } }, 'ask_user', { questions: [{ id: 'q2', text: 'Width?', kind: 'number', blocks: { dimension: 'F1.width' } }] })).content), 'NOT_BLOCKING');
  // (get_drafts reports them; a deleted feature takes its draft with it.)
  const g = JSON.parse((await ok({ ...s, doc: t }, 'get_drafts', {})).content);
  assert.ok(g.drafts[0].dims.every((d: { confirmed: boolean }) => d.confirmed) && g.unconfirmed.length === 0, JSON.stringify(g));
});
