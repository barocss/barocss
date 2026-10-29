import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { brepsFor } from '../src/engine/evaluate';
import { emptyDoc, rectanglePart, withNode, type StudioDoc } from '../src/engine/doc';
import { projectViews } from '../src/drawing/project';
import { layoutSheet } from '../src/drawing/views';
import { buildSheet } from '../src/drawing/sheet';
import { autoDimensions } from '../src/drawing/auto';
import { holeCallout, holeCalloutOwner } from '../src/drawing/callout';
import { defaultDrawing, readDrawing, type DrawingSettings, type DrawingViews } from '../src/drawing/types';
import { snapPoints } from '../src/drawing/dimensions';

// R14.1 (O2): Auto-dimension. Each conformance case (packages/barocss-cad/conformance/r14/<case>/case.json) is a studio
// document and its drawing settings; the dimensions Auto-dimension gives it, as they read on the sheet, must be the
// expected ones (the parts are built from round design values, so every expected value is the design's, checked by
// hand). UPDATE_R14_FIXTURES=1 writes the cases from the parts below.

const root = resolve(resolve(import.meta.dirname, '..'), '../../packages/barocss-cad/conformance/r14');
const hole = (node: number, center: [number, number], radius: number, extra: object = {}) => ({ kind: 'hole' as const, parent: { node, side: 'solid' as const }, center, radius, ...extra });
const PARTS: Record<string, { about: string; doc: () => StudioDoc; drawing?: Partial<DrawingSettings>; step?: string }> = {
  'starter-plate': { about: 'the starter plate: overall sizes in the front and top views, the hole located from the left and front edges, its callout', doc: () => withNode(rectanglePart(64, 32, 8), hole(1, [32, 16], 4)) },
  'hole-row': { about: 'a row of four clearance holes at one pitch (the first located, then 3× 20) and a tapped blind hole above the first', doc: () => withNode(withNode(rectanglePart(100, 40, 10), hole(1, [20, 12], 3.3, { pattern: { count: 4, step: [20, 0] } })), hole(2, [20, 30], 2.5, { thread: 'M6×1', depth: 12 })) },
  'counterbore': { about: 'a counterbored hole: one callout for both circles, located once', doc: () => withNode(withNode(rectanglePart(50, 50, 12), hole(1, [25, 25], 3.3)), hole(2, [25, 25], 5.5, { depth: 6.5 })) },
  'l-plate': { about: 'an L-shaped plate: its steps across and along in the top view, from the left and front edges', doc: () => withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'polygon', points: [[0, 0], [60, 0], [60, 20], [30, 20], [30, 40], [0, 40]] }), { kind: 'extrude', sketch: 0, height: 15 }) },
  'bolt-circle': { about: 'six holes evenly on a Ø40 circle (R14.5): their pitch circle Ø40 PCD · 6× EQ SP and its centre located, not each hole; one callout', doc: () => withNode(rectanglePart(80, 80, 10), hole(1, [60, 40], 3, { pattern: { count: 6, about: [40, 40] } })) },
  'pcd-flange': { about: 'a flange: four holes evenly round a Ø20 bore (R14.5) — their pitch circle Ø60 PCD · 4× EQ SP, located by the bore’s own position', step: 'R14.5', doc: () => withNode(withNode(rectanglePart(100, 100, 10), hole(1, [50, 50], 10)), hole(2, [80, 50], 3, { pattern: { count: 4, about: [50, 50] } })) },
  'pcd-three': { about: 'three holes at 120° on a Ø40 circle (R14.5), one on the vertical centre line: the pitch circle and its centre, nothing left out', step: 'R14.5', doc: () => withNode(rectanglePart(80, 80, 10), hole(1, [40, 60], 3, { pattern: { count: 4 - 1, about: [40, 40] } })) },
  'pcd-square-grid': { about: 'four holes at a square’s corners (R14.5): a grid, located by their positions, not a pitch circle', step: 'R14.5', doc: () => withNode(withNode(withNode(withNode(rectanglePart(60, 60, 8), hole(1, [15, 15], 3)), hole(2, [45, 15], 3)), hole(3, [45, 45], 3)), hole(4, [15, 45], 3)) },
  'pcd-turned': { about: 'six holes on a Ø40 circle turned 15° (R14.5): the pitch circle and its centre; its angular position listed as not placed (no hole on a centre line)', step: 'R14.5', doc: () => withNode(rectanglePart(80, 80, 10), hole(1, [40 + 20 * Math.cos(Math.PI / 12), 40 + 20 * Math.sin(Math.PI / 12)], 3, { pattern: { count: 6, about: [40, 40] } })) },
  'bolt-circle-a3': { about: 'the bolt-circle plate on A3: the same dimensions', doc: () => withNode(rectanglePart(80, 80, 10), hole(1, [60, 40], 3, { pattern: { count: 6, about: [40, 40] } })), drawing: { sheet: 'A3', scale: 1 } },
};

function viewsOf(doc: StudioDoc): DrawingViews {
  const b = brepsFor(doc); assert.ok('breps' in b, JSON.stringify(b));
  const r = projectViews(b.breps, b.prefixes); assert.ok(r.ok); return r.views;
}
function run(doc: StudioDoc, drawing: Partial<DrawingSettings> = {}) {
  const v = viewsOf(doc), settings: DrawingSettings = { ...defaultDrawing(), ...drawing }, layout = layoutSheet(v, settings), callout = (e: string) => holeCallout(doc.nodes, e);
  const r = autoDimensions(v, layout, settings, callout, [], [], e => holeCalloutOwner(doc.nodes, e)), next = { ...settings, dimensions: r.dimensions };
  const sheet = buildSheet(v, layout, next, { title: 't', date: 'd', callout });
  return { v, layout, settings: next, report: r.report, sheet, read: sheet.dimensions.map(d => ({ view: d.dim.view, kind: d.dim.kind, ...(d.dim.kind === 'linear' ? { orient: d.dim.orient } : {}), text: d.ok ? d.text : `lost: ${d.reason}` })).sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : 1) };
}

if (process.env.UPDATE_R14_FIXTURES) for (const [name, p] of Object.entries(PARTS)) {
  const doc = p.doc(), r = run(doc, p.drawing), dir = resolve(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'case.json'), JSON.stringify({
    id: `r14-${name}`, step: p.step ?? 'R14.1', decisions: p.step === 'R14.5' ? ['O2', 'O6'] : ['O2'], about: p.about,
    input: { document: { format: doc.format, schema: doc.schema, units: doc.units, parameters: doc.parameters, nodes: doc.nodes, nextId: doc.nextId, outputs: doc.outputs }, drawing: p.drawing ?? {} },
    expect: { dimensions: r.read, added: r.report.added, skipped: r.report.skipped.map(s => s.what), crowded: r.report.crowded.map(c => `${c.view} ${c.side}`) },
    oracle: 'the part’s design values (round numbers), checked by hand against the definitions in decisions-outer.md O2; run by apps/cad-studio/test/auto-dimension.test.ts',
  }, null, 1) + '\n');
}

for (const name of existsSync(root) ? readdirSync(root).filter(n => existsSync(resolve(root, n, 'case.json'))) : []) {
  const c = JSON.parse(readFileSync(resolve(root, name, 'case.json'), 'utf8'));
  // (R14.2's issue cases have their own runner, test/drawing-issues.test.ts.)
  if (c.step !== 'R14.1' && c.step !== 'R14.5') continue;
  test(`conformance ${c.id}: ${c.about}`, () => {
    assert.equal(c.id, `r14-${name}`);
    const r = run(c.input.document as StudioDoc, c.input.drawing);
    assert.deepEqual(r.read, c.expect.dimensions);
    assert.deepEqual(r.report.added, c.expect.added);
    assert.deepEqual(r.report.skipped.map(s => s.what), c.expect.skipped);
    assert.deepEqual(r.report.crowded.map(x => `${x.view} ${x.side}`), c.expect.crowded);
    assert.ok(r.sheet.dimensions.every(d => d.ok), 'every dimension resolves');
  });
}

test('the cases cover the parts (UPDATE_R14_FIXTURES=1 writes them)', () => {
  for (const name of Object.keys(PARTS)) assert.ok(existsSync(resolve(root, name, 'case.json')), name);
});

test('auto dimensions measure the design values and follow the part; hand-placed ones are kept, its own replaced', () => {
  const doc = PARTS['hole-row'].doc(), first = run(doc);
  assert.ok(first.settings.dimensions.every(d => d.auto));
  // Every linear one measures between the points it names (a value of the design: whole millimetres here).
  for (const d of first.sheet.dimensions) if (d.ok && d.kind === 'linear') assert.ok(Math.abs(d.value - Math.round(d.value)) < 1e-9, `${d.text}: ${d.value}`);
  // A wider plate: the same dimensions read the new width (persistent references).
  const wider = { ...doc, nodes: doc.nodes.map(n => n.kind === 'sketch' && n.profile === 'rectangle' ? { ...n, max: [120, 40] as [number, number] } : n) };
  const v = viewsOf(wider), layout = layoutSheet(v, first.settings), sheet = buildSheet(v, layout, first.settings, { title: 't', date: 'd', callout: e => holeCallout(wider.nodes, e) });
  assert.ok(sheet.dimensions.some(d => d.ok && d.text === '120') && !sheet.dimensions.some(d => d.ok && d.text === '100'));
  // A hand-placed width: kept, and the auto one that would repeat it not added; running again replaces only its own.
  const f = snapPoints(first.v.front), at = (u: number, w: number) => f.find(p => Math.abs(p.at[0] - u) < 1e-6 && Math.abs(p.at[1] - w) < 1e-6)!.ref;
  const mine = { id: 'mine', view: 'front' as const, kind: 'linear' as const, a: at(0, 0), b: at(100, 0), orient: 'horizontal' as const, place: [50, -30] as [number, number] };
  const withMine: DrawingSettings = { ...first.settings, dimensions: [...first.settings.dimensions, mine] };
  const again = autoDimensions(first.v, first.layout, withMine, e => holeCallout(doc.nodes, e), [], [], e => holeCalloutOwner(doc.nodes, e));
  assert.equal(again.report.kept, 1); assert.equal(again.dimensions.filter(d => d.id === 'mine').length, 1);
  assert.equal(again.dimensions.length, first.settings.dimensions.length, 'one fewer auto: the overall width is yours');
  assert.equal(again.report.added.overall, first.report.added.overall - 1);
  // Saved and read back: count and auto kept; a bad count dropped.
  const back = readDrawing(JSON.parse(JSON.stringify(again.dimensions.length ? { dimensions: again.dimensions } : {})));
  assert.deepEqual(back.dimensions, again.dimensions);
  assert.equal(readDrawing({ dimensions: [{ ...mine, count: 1.5 }] }).dimensions[0].count, undefined);
});

test('a pattern copy’s hole reads its callout (copies are named n<k>_p<j>)', () => {
  const doc = PARTS['hole-row'].doc();
  assert.equal(holeCallout(doc.nodes, 'n1.top|n2_p3.side0#1'), '4× Ø6.6 THRU');
  assert.equal(holeCallout(doc.nodes, 'n1.top|n2.side0#1'), '4× Ø6.6 THRU');
});
