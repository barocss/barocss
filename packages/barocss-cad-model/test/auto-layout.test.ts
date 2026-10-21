import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { brepsFor } from '../src/engine/evaluate';
import { rectanglePart, starterDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { projectViews } from '../src/drawing/project';
import { holeCallout } from '../src/drawing/callout';
import { snapPoints } from '../src/drawing/dimensions';
import { drawingIssues, issueContext, type SheetInputs } from '../src/drawing/issues';
import { MIN_HOLE_ON_PAPER_MM, autoLayout, chooseViews, rightAddsNothing } from '../src/drawing/layout';
import { layoutSheet } from '../src/drawing/views';
import { defaultDrawing, readDrawing, type DrawingSettings, type DrawingViews } from '../src/drawing/types';

// R14.3 (O4): views chosen and laid out for their dimensions. Conformance cases packages/barocss-cad/conformance/r14/
// layout-<name>/case.json: a studio document and drawing settings; the views shown, the sheet and scale chosen, whether
// it reads (smallest hole on paper), the issues left and the dimensions as they read. UPDATE_R14_FIXTURES=1 writes them.

const root = resolve(resolve(import.meta.dirname, '..'), '../../packages/barocss-cad/conformance/r14');
const hole = (node: number, center: [number, number], radius: number, extra: object = {}) => ({ kind: 'hole' as const, parent: { node, side: 'solid' as const }, center, radius, ...extra });
const viewsOf = (doc: StudioDoc): DrawingViews => { const b = brepsFor(doc); assert.ok('breps' in b); const r = projectViews(b.breps, b.prefixes); assert.ok(r.ok); return r.views; };
const inputsOf = (doc: StudioDoc, settings: DrawingSettings): SheetInputs => ({ views: viewsOf(doc), settings, callout: e => holeCallout(doc.nodes, e), meta: { title: 't', date: 'd' } });

const CASES: Record<string, { about: string; doc: () => StudioDoc; settings?: (v: DrawingViews) => DrawingSettings }> = {
  'layout-plate': { about: 'the starter plate: the right view shows nothing the others do and is left out; A4 at 1:1, clean', doc: starterDoc },
  'layout-cross-hole': { about: 'a block with a hole along X: the right view shows it round and stays; the hole located and called out there', doc: () => withNode(rectanglePart(60, 30, 30), hole(1, [15, 15], 4, { axis: 'x' })) },
  'layout-bolt-circle': { about: 'the bolt-circle plate: its pitch circle and centre (R14.5); A4, clean, its Ø6 holes 3 mm on paper at the scale chosen', doc: () => withNode(rectanglePart(80, 80, 10), hole(1, [60, 40], 3, { pattern: { count: 6, about: [40, 40] } })) },
  'layout-long-plate': { about: 'a 240 × 120 plate with a row of Ø8 holes: 1:5 on A4 would put them at 1.6 mm, so A3 at 1:2', doc: () => withNode(rectanglePart(240, 120, 10), hole(1, [20, 20], 4, { pattern: { count: 10, step: [20, 0] } })) },
  'layout-hand-in-right': {
    about: 'the starter plate with a dimension placed by hand in the right view: the right view stays, the dimension kept',
    doc: starterDoc,
    settings: v => { const s = snapPoints(v.right), at = (u: number, w: number) => s.find(p => Math.abs(p.at[0] - u) < 1e-6 && Math.abs(p.at[1] - w) < 1e-6)!.ref; return { ...defaultDrawing(), dimensions: [{ id: 'mine', view: 'right', kind: 'linear', a: at(0, 0), b: at(32, 0), orient: 'horizontal', place: [16, -12] }] }; },
  },
};

const read = (i: SheetInputs, settings: DrawingSettings) => issueContext({ ...i, settings }).sheet.dimensions.map(d => ({ view: d.dim.view, kind: d.dim.kind, text: d.ok ? d.text : `lost: ${d.reason}` })).sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : 1);

if (process.env.UPDATE_R14_FIXTURES) for (const [name, c] of Object.entries(CASES)) {
  const doc = c.doc(), v = viewsOf(doc), settings = c.settings?.(v) ?? defaultDrawing(), i = inputsOf(doc, settings), r = autoLayout(i), dir = resolve(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'case.json'), JSON.stringify({
    id: `r14-${name}`, step: 'R14.3', decisions: ['O4'], about: c.about,
    input: { document: { format: doc.format, schema: doc.schema, units: doc.units, parameters: doc.parameters, nodes: doc.nodes, nextId: doc.nextId, outputs: doc.outputs }, drawing: settings },
    expect: { views: r.report.views, dropped: r.report.dropped, sheet: r.report.sheet, scale: r.report.scale, readable: r.report.readable, left: r.report.left.map(x => x.code).sort(), dimensions: read(i, r.settings) },
    oracle: 'the part’s design values and the rules in decisions-outer.md O4, checked by hand; run by apps/cad-studio/test/auto-layout.test.ts',
  }, null, 1) + '\n');
}

for (const name of existsSync(root) ? readdirSync(root).filter(n => n.startsWith('layout-') && existsSync(resolve(root, n, 'case.json'))) : []) {
  const c = JSON.parse(readFileSync(resolve(root, name, 'case.json'), 'utf8'));
  test(`conformance ${c.id}: ${c.about}`, () => {
    const i = inputsOf(c.input.document as StudioDoc, c.input.drawing as DrawingSettings), r = autoLayout(i);
    assert.deepEqual({ views: r.report.views, dropped: r.report.dropped, sheet: r.report.sheet, scale: r.report.scale, readable: r.report.readable, left: r.report.left.map(x => x.code).sort() },
      { views: c.expect.views, dropped: c.expect.dropped, sheet: c.expect.sheet, scale: c.expect.scale, readable: c.expect.readable, left: c.expect.left });
    assert.deepEqual(read(i, r.settings), c.expect.dimensions);
    // What it chose reads back from a saved file and gives the same clean sheet.
    const again = readDrawing(JSON.parse(JSON.stringify(r.settings)));
    assert.deepEqual(again, r.settings);
    assert.deepEqual(drawingIssues(issueContext({ ...i, settings: again })).filter(x => x.severity === 'error'), []);
  });
}

test('the layout cases cover the parts (UPDATE_R14_FIXTURES=1 writes them)', () => {
  for (const name of Object.keys(CASES)) assert.ok(existsSync(resolve(root, name, 'case.json')), name);
});

test('room widens the gaps only where it is more than they give; without it the layout is as before', () => {
  const v = viewsOf(starterDoc()), plain = layoutSheet(v, defaultDrawing());
  assert.deepEqual(layoutSheet(v, { ...defaultDrawing(), room: {} }), plain, 'empty room: the same layout');
  assert.deepEqual(layoutSheet(v, { ...defaultDrawing(), room: { top: { left: 5 } } }), plain, 'room the margins already give');
  const wide = layoutSheet(v, { ...defaultDrawing(), room: { front: { right: 30 }, right: { left: 10 } } });
  const gap = (l: typeof plain) => l.views.right.box[0] - l.views.front.box[2];
  assert.ok(gap(wide) >= 30 + 10 + 3 - 1e-9 && gap(plain) < gap(wide), `${gap(plain)} → ${gap(wide)}`);
  // A view not shown takes no room and is drawn nowhere.
  const two = layoutSheet(v, { ...defaultDrawing(), views: ['front', 'top'] });
  assert.ok(two.views.right.hidden && two.views.iso.hidden && !two.views.front.hidden);
  const sheet = issueContext({ ...inputsOf(starterDoc(), defaultDrawing()), settings: { ...defaultDrawing(), views: ['front', 'top'] } }).sheet;
  assert.ok(!sheet.groups.some(g => g.view === 'right' || g.view === 'iso'));
});

test('the right view adds nothing on a plate, something with a hole along X; a dimension in a hidden view is listed', () => {
  assert.equal(rightAddsNothing(viewsOf(starterDoc())), true);
  assert.equal(rightAddsNothing(viewsOf(withNode(rectanglePart(60, 30, 30), hole(1, [15, 15], 4, { axis: 'x' })))), false);
  // A step seen only from the side: an L in the XZ plane extruded along Y shows its step in the front view and the right view's edges are the top's and front's.
  const v = viewsOf(starterDoc());
  assert.deepEqual(chooseViews(v, { ...defaultDrawing(), views: ['front', 'top', 'iso'] }), { views: ['front', 'top', 'iso'], dropped: [] });
  const i = inputsOf(withNode(rectanglePart(60, 30, 30), hole(1, [15, 15], 4, { axis: 'x' })), { ...defaultDrawing(), views: ['front', 'top', 'iso'] });
  const list = drawingIssues(issueContext(i));
  assert.ok(list.some(x => x.code === 'VIEW_NEEDED' && x.fix?.kind === 'show-view'), JSON.stringify(list.map(x => x.code)));
  assert.ok(MIN_HOLE_ON_PAPER_MM > 0);
});
