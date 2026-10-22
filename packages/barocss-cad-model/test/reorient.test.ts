import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { brepsFor, evaluatePart } from '../src/engine/evaluate';
import { rectanglePart, starterDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { projectViews } from '../src/drawing/project';
import { holeCallout } from '../src/drawing/callout';
import { resolveDimension } from '../src/drawing/dimensions';
import { issueContext, drawingIssues } from '../src/drawing/issues';
import { autoLayout, frontByInformation } from '../src/drawing/layout';
import { reorient } from '../src/drawing/reorient';
import { sectionOf } from '../src/drawing/section';
import { VIEWS, layoutSheet, viewsFor, type Orientation } from '../src/drawing/views';
import { defaultDrawing, readDrawing, type DrawingSettings, type DrawingViews } from '../src/drawing/types';
import { dispatchTool, type ChatState } from '../src/chat/tools';

// R14.3b (O7): the front view's side. A versioned setting (none: −Y, every drawing saved before); turning re-maps every
// annotation to the view showing its axes or is refused, typed. Conformance packages/barocss-cad/conformance/r14/
// orient-<name>/case.json: a document, its drawing, the side to turn to; the outcome and the dimensions as they read.

const root = resolve(resolve(import.meta.dirname, '..'), '../../packages/barocss-cad/conformance/r14');
const hole = (node: number, center: [number, number], radius: number, extra: object = {}) => ({ kind: 'hole' as const, parent: { node, side: 'solid' as const }, center, radius, ...extra });
const crossBlock = () => withNode(rectanglePart(60, 30, 30), hole(1, [15, 15], 4, { axis: 'x' }));
function viewsOf(doc: StudioDoc, o: Orientation = 'y-'): DrawingViews { const b = brepsFor(doc); assert.ok('breps' in b); const r = projectViews(b.breps, b.prefixes, { orientation: o }); assert.ok(r.ok); return r.views; }
const inputs = (doc: StudioDoc, settings: DrawingSettings, o: Orientation = 'y-') => ({ views: viewsOf(doc, o), settings, callout: (e: string) => holeCallout(doc.nodes, e), meta: { title: 't', date: 'd' } });
const auto = (doc: StudioDoc) => autoLayout(inputs(doc, defaultDrawing())).settings;
const read = (views: DrawingViews, s: DrawingSettings) => s.dimensions.map(d => { const r = resolveDimension(views, d); return `${d.view} ${r.ok ? r.text : 'lost'}`; }).sort();

test('an old drawing reopens unchanged: no side is the front from −Y, its views exactly the ones drawings always had', () => {
  assert.deepEqual(viewsFor('y-'), { front: { toward: [0, -1, 0], up: [0, 0, 1], label: 'FRONT' }, top: { toward: [0, 0, 1], up: [0, 1, 0], label: 'TOP' }, right: { toward: [1, 0, 0], up: [0, 0, 1], label: 'RIGHT' }, iso: { toward: [1, -1, 1], up: [0, 0, 1], label: 'ISOMETRIC' } });
  assert.deepEqual(VIEWS, viewsFor('y-'));
  // A drawing saved before R14.3b (no orientation): read back the same, laid out and drawn the same as with the old views.
  const doc = starterDoc(), saved = JSON.parse(JSON.stringify(auto(doc)));
  delete saved.orientation;
  const back = readDrawing(saved);
  assert.equal(back.orientation, undefined); assert.deepEqual(back, readDrawing(JSON.parse(JSON.stringify(back))));
  const b = brepsFor(doc); assert.ok('breps' in b);
  const plain = projectViews(b.breps, b.prefixes); assert.ok(plain.ok);
  assert.deepEqual(layoutSheet(plain.views, back), layoutSheet(viewsOf(doc), back));
  assert.deepEqual(issueContext({ ...inputs(doc, back), views: plain.views }).sheet, issueContext(inputs(doc, back)).sheet);
  // A bad side is dropped on reading.
  assert.equal(readDrawing({ orientation: 'z+' }).orientation, undefined); assert.equal(readDrawing({ orientation: 'x+' }).orientation, 'x+');
});

test('the views of each side: the top looks down Z keeping the front’s horizontal, the right is the front turned to its right', () => {
  for (const o of ['y-', 'x+', 'y+', 'x-'] as const) {
    const v = viewsOf(starterDoc(), o);
    assert.deepEqual(v.top.toward, [0, 0, 1]);
    for (let k = 0; k < 3; k++) { assert.ok(Math.abs(v.front.right[k] - v.top.right[k]) < 1e-12, `${o}: front and top share u`); assert.ok(Math.abs(v.top.up[k] - v.right.right[k]) < 1e-12, `${o}: top v is right u`); }
    assert.ok(Math.abs(v.front.toward[0] * v.right.toward[0] + v.front.toward[1] * v.right.toward[1]) < 1e-12, 'right square to front');
  }
});

test('turning re-maps every annotation and keeps every value; a section along the depth turns with it, across it is refused', () => {
  const doc = starterDoc(), s = auto(doc), from = viewsOf(doc), to = viewsOf(doc, 'x+');
  const r = reorient(from, to, s, 'x+');
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepEqual(r.moved, [{ from: 'front', to: 'right' }, { from: 'right', to: 'front' }]);
  assert.equal(r.settings.orientation, 'x+');
  assert.deepEqual(read(to, r.settings).map(x => x.split(' ').slice(1).join(' ')).sort(), read(from, s).map(x => x.split(' ').slice(1).join(' ')).sort());
  assert.deepEqual(drawingIssues(issueContext({ ...inputs(doc, r.settings, 'x+') })).filter(x => x.severity === 'error'), []);
  // Back again: the drawing as it was (places to rounding).
  const back = reorient(to, from, r.settings, 'y-'); assert.ok(back.ok);
  assert.equal(back.settings.orientation, undefined);
  back.settings.dimensions.forEach((d, k) => { assert.equal(d.view, s.dimensions[k].view); d.place.forEach((x, j) => assert.ok(Math.abs(x - s.dimensions[k].place[j]) < 1e-9)); });
  // Section A–A at Y = 16: from +Y it is the same plane (its position along the new depth −16); from +X it would cut across.
  const sec = { ...s, section: { y: 16 } };
  const along = reorient(from, viewsOf(doc, 'y+'), sec, 'y+'); assert.ok(along.ok); assert.deepEqual(along.settings.section, { y: -16 });
  const across = reorient(from, to, sec, 'x+'); assert.ok(!across.ok && across.code === 'SECTION_ACROSS', JSON.stringify(across));
});

test('a dimension that would not read the same refuses the turn, typed, listing it', () => {
  const doc = starterDoc(), s = auto(doc);
  // Views of another part (the hole gone): its diameter and positions no longer resolve there.
  const other = viewsOf(rectanglePart(64, 32, 8), 'x+'), r = reorient(viewsOf(doc), other, s, 'x+');
  assert.ok(!r.ok && r.code === 'ORIENTATION_REMAP_FAILED', JSON.stringify(r));
  assert.ok(r.failed.length >= 3 && r.failed.some(f => /Ø8/.test(f.was) && /lost/.test(f.now)));
});

test('section A–A for every side: square to its depth, the far side kept', () => {
  const doc = crossBlock();
  // From +X the depth is −X: at y = −30 the plane X = 30, the part beyond it (X < 30) kept, its cut face 30 × 30 less the hole.
  const r = sectionOf(doc, -30, 'x+');
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.rings.length, 2, 'the face and the hole through it');
  const area = (ring: [number, number][]) => Math.abs(ring.reduce((a, p, i) => { const q = ring[(i + 1) % ring.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
  const areas = r.rings.map(area).sort((a, b) => b - a);
  assert.ok(Math.abs(areas[0] - 900) < 1e-6 && Math.abs(areas[1] - Math.PI * 16) < 0.5, JSON.stringify(areas));
  assert.deepEqual([r.projection.min, r.projection.max].map(p => p.map(x => Math.round(x * 1e6) / 1e6)), [[0, 0], [30, 30]]);
  const none = sectionOf(doc, 10, 'x+'); assert.ok(!none.ok && /Nothing of the part lies behind X = -10/.test(none.error), JSON.stringify(none));
});

test('Auto takes the side that tells more when nothing placed by hand ties it: the block’s hole along X seen round', async () => {
  const doc = crossBlock(), v = viewsOf(doc);
  const pick = frontByInformation(v, defaultDrawing());
  assert.ok(pick && pick.orientation === 'x+', JSON.stringify(pick));
  assert.equal(frontByInformation(viewsOf(starterDoc()), defaultDrawing()), null, 'a plate: the front as it is');
  assert.equal(frontByInformation(v, { ...defaultDrawing(), orientation: 'y+' }), null, 'a side set stays');
  const s = auto(doc), hand = { ...s, dimensions: s.dimensions.map((d, k) => k ? d : { ...d, auto: undefined } as typeof d) };
  assert.equal(frontByInformation(v, hand), null, 'a dimension by hand stays');
  // Through the agent's tool: laid out with the front from +X, the hole round in the front view, no issue.
  const r = await evaluatePart(doc, 1); assert.ok(r.ok);
  const state: ChatState = { doc, bodies: r.bodies };
  const out = await dispatchTool(state, 'auto_dimension', {}, async d => evaluatePart(d, 1)), o = JSON.parse(out.content);
  assert.match(o.front, /^x\+: /); assert.deepEqual(o.issues, []);
  const d = readDrawing(out.state.doc.drawing);
  assert.equal(d.orientation, 'x+'); assert.ok(d.dimensions.some(x => x.kind === 'diameter' && x.view === 'front'));
  // set_drawing turns it back (re-mapped), and refuses a bad side.
  const back = await dispatchTool(out.state, 'set_drawing', { front: 'y-' }, async x => evaluatePart(x, 1));
  assert.equal(readDrawing(back.state.doc.drawing).orientation, undefined);
  assert.ok(readDrawing(back.state.doc.drawing).dimensions.some(x => x.kind === 'diameter' && x.view === 'right'));
  assert.ok((await dispatchTool(out.state, 'set_drawing', { front: 'z+' }, async x => evaluatePart(x, 1))).isError);
});

/** The conformance cases: each a document, its drawing (Auto's), and the side to turn to. */
const CASES: Record<string, { about: string; doc: () => StudioDoc; to: Orientation; section?: number }> = {
  'orient-plate-x-plus': { about: 'the auto-dimensioned starter plate turned to a front from +X: the front and right views’ annotations swap, every value kept', doc: starterDoc, to: 'x+' },
  'orient-cross-hole-y-plus': { about: 'the block with a hole along X turned to a front from +Y (seen from behind): the same views mirrored, every value kept', doc: crossBlock, to: 'y+' },
  'orient-section-across': { about: 'the plate with section A–A turned to a front from +X: the section would cut across, refused (SECTION_ACROSS), nothing changed', doc: starterDoc, to: 'x+', section: 16 },
};
if (process.env.UPDATE_R14_FIXTURES) for (const [name, c] of Object.entries(CASES)) {
  const doc = c.doc(), s0 = auto(doc), settings = c.section !== undefined ? { ...s0, section: { y: c.section } } : s0, dir = resolve(root, name);
  const r = reorient(viewsOf(doc), viewsOf(doc, c.to), settings, c.to);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'case.json'), JSON.stringify({
    id: `r14-${name}`, step: 'R14.3b', decisions: ['O7'], about: c.about,
    input: { document: { format: doc.format, schema: doc.schema, units: doc.units, parameters: doc.parameters, nodes: doc.nodes, nextId: doc.nextId, outputs: doc.outputs }, drawing: settings, to: c.to },
    expect: r.ok ? { ok: true, moved: r.moved, dimensions: read(viewsOf(doc, c.to), r.settings) } : { ok: false, code: r.code },
    oracle: 'the same edges read from the views showing their axes: every value the one before, checked by hand; run by apps/cad-studio/test/reorient.test.ts',
  }, null, 1) + '\n');
}
for (const name of existsSync(root) ? readdirSync(root).filter(n => n.startsWith('orient-') && existsSync(resolve(root, n, 'case.json'))) : []) {
  const c = JSON.parse(readFileSync(resolve(root, name, 'case.json'), 'utf8'));
  test(`conformance ${c.id}: ${c.about}`, () => {
    const doc = c.input.document as StudioDoc, r = reorient(viewsOf(doc), viewsOf(doc, c.input.to), c.input.drawing, c.input.to);
    assert.deepEqual(r.ok ? { ok: true, moved: r.moved, dimensions: read(viewsOf(doc, c.input.to), r.settings) } : { ok: false, code: r.code }, c.expect);
  });
}
test('the orientation cases cover the drawings (UPDATE_R14_FIXTURES=1 writes them)', () => { for (const n of Object.keys(CASES)) assert.ok(existsSync(resolve(root, n, 'case.json')), n); });
