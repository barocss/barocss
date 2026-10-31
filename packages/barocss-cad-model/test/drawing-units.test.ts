// Roadmap 11 ③b: inch display and dual dimensions. The model stays in mm; the sheet prints its lengths in the drawing's
// unit (ASME Y14.5 §1.6.2: no leading zero, zeros kept to the precision, a tolerance with the dimension's decimals) and on a
// dual drawing the other unit after it in square brackets (Y14.2). Absent, the sheet is the one made before units
// (drawing-units-golden.test.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import { brepsFor } from '../src/engine/evaluate';
import { emptyDoc, starterDoc, type StudioDoc } from '../src/engine/doc';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { commands, type Ctx } from '../src/app/commands';
import { projectViews } from '../src/drawing/project';
import { layoutSheet } from '../src/drawing/views';
import { snapPoints } from '../src/drawing/dimensions';
import { buildSheet, dimensionLine, toleranceText, type Mark, type MarkGroup, type Sheet } from '../src/drawing/sheet';
import { holeCallout } from '../src/drawing/callout';
import { fitCallout, withFit } from '../src/drawing/fits';
import { datumTargetSizeText } from '../src/drawing/datumTargets';
import { modelAnnotations } from '../src/drawing/annotations3d';
import { formatLength, lengthFormats, presetFor, unitsLabel } from '../src/drawing/standard';
import { drawingInputs, runDrawingTool } from '../src/chat/drawing';
import { sheetSvg } from '../src/io/svg';
import { sheetDxfDocument } from '../src/io/dxf';
import { defaultDrawing, readDrawing, type DrawingDimension, type DrawingSettings, type DrawingViews } from '../src/drawing/types';
import type { DrawingDatumTarget } from '../src/drawing/datumTargets';

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;
const plate = (): StudioDoc => { const d = starterDoc(); return { ...d, nodes: d.nodes.map(n => n.kind === 'hole' ? { ...n, radius: 12 } : n) }; };
const viewsOf = (doc: StudioDoc): DrawingViews => { const b = brepsFor(doc); assert.ok('breps' in b); const r = projectViews(b.breps, b.prefixes); assert.ok(r.ok); return r.views; };

/** Dimensions of every kind on the plate with a Ø24 hole (64 × 32 × 8). */
function drawing(extra: Partial<DrawingSettings> = {}) {
  const doc = plate(), views = viewsOf(doc), hole = views.top.edges.find(e => e.kind === 'circle')!, f = snapPoints(views.front);
  const at = (u: number, w: number) => f.find(p => near(p.at[0], u) && near(p.at[1], w))!.ref;
  const circle = { edge: hole.name, near: [...hole.circle!.center] as [number, number, number] };
  const dimensions: DrawingDimension[] = [
    { id: 'wide', view: 'front', kind: 'linear', a: at(0, 0), b: at(64, 0), orient: 'horizontal', place: [32, -12], tol: { kind: 'symmetric', value: 0.05 } },
    { id: 'high', view: 'front', kind: 'linear', a: at(0, 0), b: at(0, 8), orient: 'vertical', place: [-12, 4], tol: { kind: 'deviation', upper: 0.1, lower: -0.05 } },
    { id: 'slant', view: 'front', kind: 'linear', a: at(0, 0), b: at(64, 8), orient: 'aligned', place: [20, 20], tol: { kind: 'fit', code: 'h7' } },
    { id: 'plain', view: 'front', kind: 'linear', a: at(0, 0), b: at(64, 8), orient: 'aligned', place: [10, 30] },
    { id: 'bore', view: 'top', kind: 'diameter', ...circle, place: [33, 17] },
    { id: 'round', view: 'top', kind: 'radius', ...circle, place: [28, 10], tol: { kind: 'symmetric', value: 0.125 } },
  ];
  const targets: DrawingDatumTarget[] = [
    { id: 'area-b', letter: 'B', number: 1, view: 'front', place: [-14, -12], kind: 'area', area: { shape: 'circle', at: [20, 4], d: 6.35 } },
    { id: 'area-c', letter: 'C', number: 1, view: 'front', place: [70, -12], kind: 'area', area: { shape: 'rect', at: [50, 4], w: 12.7, h: 3.175 } },
  ];
  const settings: DrawingSettings = { ...defaultDrawing(), sheet: 'A3', dimensions, datumTargets: targets,
    frames: [{ id: 'flat', dim: 'wide', characteristic: 'flatness', value: 0.1, datums: [] }, { id: 'pos', dim: 'bore', characteristic: 'position', value: 0.25, datums: [], projected: 12.7, unequal: undefined }, { id: 'prof', dim: 'plain', characteristic: 'profile-surface', value: 0.5, datums: [], unequal: 0.125 }], ...extra };
  return { doc, views, settings };
}
const sheetOf = (extra: Partial<DrawingSettings> = {}) => {
  const d = drawing(extra), layout = layoutSheet(d.views, d.settings);
  const meta = { title: 'Plate', date: '2026-10-31', callout: (edge: string, diameter?: number, f?: Parameters<typeof holeCallout>[3]) => holeCallout(d.doc.nodes, edge, d.doc.parameters, f) };
  return { ...d, layout, sheet: buildSheet(d.views, layout, d.settings, meta) };
};
const groupOf = (sheet: Sheet, id: string): MarkGroup => { const g = sheet.groups.find(x => x.id === id); assert.ok(g, id); return g; };
const texts = (g: MarkGroup) => g.marks.filter((m): m is Extract<Mark, { kind: 'text' }> => m.kind === 'text').map(m => m.text);

test('inch values: mm / 25.4, no leading zero, zeros kept to the precision (3 by default)', () => {
  const inch = presetFor({ units: 'inch' }), at = (mm: number, p = inch) => formatLength(mm, p);
  assert.deepEqual([25.4, 12.7, 0.127, 100, 0, 50.8, 0.0127, 1000].map(v => at(v)), ['1.000', '.500', '.005', '3.937', '.000', '2.000', '.001', '39.370']);
  assert.equal(at(-12.7), '-.500'); assert.equal(at(-0.0001), '.000', 'no negative zero');
  assert.equal(at(25.4, presetFor({ units: 'inch', precision: { inch: 4 } })), '1.0000'); assert.equal(at(12.7, presetFor({ units: 'inch', precision: { inch: 2 } })), '.50');
  assert.equal(at(25.4, presetFor({ units: 'inch', precision: { inch: 0 } })), '1'); assert.equal(at(12.7, presetFor({ units: 'inch', precision: { inch: 6 } })), '.500000');
  for (const standard of ['iso', 'asme'] as const) assert.equal(at(12.7, presetFor({ standard, units: 'inch' })), '.500', `${standard}: the same inch rule`);
});
test('mm values: as before without a precision (trimmed, 0.01), exactly the decimals with one', () => {
  const mm = presetFor({ units: 'mm' }), plain = presetFor({});
  for (const v of [12.5, 12, 0.5, 6.35, 24.126]) assert.equal(formatLength(v, mm), formatLength(v, plain));
  assert.equal(formatLength(12.5, plain), '12.5'); assert.equal(formatLength(12, plain), '12'); assert.equal(formatLength(6.35, plain), '6.35'); assert.equal(formatLength(24.126, plain), '24.13');
  const one = presetFor({ precision: { mm: 1 } }); assert.deepEqual([12.5, 12, 0.5, 24.126].map(v => formatLength(v, one)), ['12.5', '12.0', '0.5', '24.1']);
  assert.equal(formatLength(12.5, presetFor({ precision: { mm: 0 } })), '13'); assert.equal(formatLength(25.4, presetFor({ units: 'inch', precision: { mm: 1 } })), '1.000', 'an mm precision does not touch inch');
});
test('dual: the other unit follows in square brackets, rounded by its own precision', () => {
  const p = presetFor({ units: 'inch', dual: true, precision: { mm: 1 } }), f = lengthFormats(p);
  assert.equal(`${f.primary(63.5)} [${f.secondary!(63.5)}]`, '2.500 [63.5]');
  assert.equal(lengthFormats(presetFor({ units: 'mm', dual: true })).secondary!(63.5), '2.500');
  assert.equal(lengthFormats(presetFor({ units: 'inch' })).secondary, null); assert.equal(lengthFormats(presetFor({})).secondary, null);
  assert.deepEqual([presetFor({}), presetFor({ units: 'inch' }), presetFor({ dual: true }), presetFor({ units: 'inch', dual: true })].map(unitsLabel), ['mm', 'inch', 'mm [inch]', 'inch [mm]']);
});

test('an inch sheet: dimensions, tolerances with the dimension\'s decimals, hole callout, targets, frames; angles and fit designations stay', () => {
  const { sheet } = sheetOf({ units: 'inch' });
  assert.deepEqual(texts(groupOf(sheet, 'wide')), ['2.5197 ±.0019'], '64 mm; ±0.05 mm: three decimals each');
  assert.deepEqual(texts(groupOf(sheet, 'high')), ['.315', '+.003', '-.002'], '8 mm with stacked deviations +0.1 / -0.05: the nominal rounds to .315, so the limits move inward from .31496 + .0039 / - .0020');
  assert.deepEqual(texts(groupOf(sheet, 'slant')), ['2.539 h7'], 'the fit designation is as written');
  assert.deepEqual(texts(groupOf(sheet, 'plain')), ['2.539']);
  assert.deepEqual(texts(groupOf(sheet, 'bore')), ['Ø.945 THRU'], 'a hole callout: Ø24 THRU in inch');
  assert.deepEqual(texts(groupOf(sheet, 'round')), ['R.472 +.005/-.004']);
  const frame = (id: string) => texts(groupOf(sheet, id));
  assert.ok(frame('flat').includes('.0039'), frame('flat').join()); assert.ok(frame('pos').some(t => t === 'Ø.009') && frame('pos').includes('.500'), frame('pos').join());
  assert.ok(frame('prof').includes('.019') && frame('prof').includes('.005'), frame('prof').join());
  const targets = (id: string) => texts(groupOf(sheet, id));
  assert.ok(targets('area-b').includes('Ø.250'), targets('area-b').join()); assert.ok(targets('area-c').includes('.500×.125'), targets('area-c').join());
  const resolved = sheet.dimensions.find(d => d.dim.id === 'wide')!; assert.ok(resolved.ok && near(resolved.value, 64), 'the model value stays in mm');
});
test('a dual sheet: primary [secondary], the tolerance in both, stacked deviations printed on the line; frames and targets keep one unit', () => {
  const { sheet } = sheetOf({ units: 'inch', dual: true });
  assert.deepEqual(texts(groupOf(sheet, 'wide')), ['2.5197 ±.0019 [64 ±0.05]']);
  assert.deepEqual(texts(groupOf(sheet, 'high')), ['.315 +.003/-.002 [8 +0.1/-0.05]']);
  assert.deepEqual(texts(groupOf(sheet, 'slant')), ['2.539 h7 [64.5 h7]']);
  assert.deepEqual(texts(groupOf(sheet, 'bore')), ['Ø.945 THRU [Ø24 THRU]']);
  assert.deepEqual(texts(groupOf(sheet, 'round')), ['R.472 +.005/-.004 [R12 ±0.125]']);
  assert.ok(texts(groupOf(sheet, 'flat')).includes('.0039'), 'a frame prints the primary unit only');
  const mmFirst = sheetOf({ dual: true }).sheet;
  assert.deepEqual(texts(groupOf(mmFirst, 'wide')), ['64 ±0.05 [2.5197 ±.0019]']); assert.deepEqual(texts(groupOf(mmFirst, 'high')), ['8 +0.1/-0.05 [.315 +.003/-.002]']);
  const r = sheet.dimensions.find(d => d.dim.id === 'wide')!; assert.ok(r.ok && r.alt === '64' && r.text === '2.5197'); assert.equal(dimensionLine(r, presetFor({ units: 'inch', dual: true })), '2.5197 ±.0019 [64 ±0.05]');
});
test('precision on the sheet: inch decimals follow into the tolerance; mm precision with dual', () => {
  const { sheet } = sheetOf({ units: 'inch', precision: { inch: 4 } });
  assert.deepEqual(texts(groupOf(sheet, 'wide')), ['2.5197 ±.0019']); assert.deepEqual(texts(groupOf(sheet, 'high')), ['.3150', '+.0038', '-.0020']);
  assert.deepEqual(texts(groupOf(sheetOf({ units: 'inch', dual: true, precision: { inch: 2, mm: 1 } }).sheet, 'wide')), ['2.5197 ±.0019 [64.00 ±0.05]']);
});
test('angles never convert', () => {
  const d = drawing(), views = d.views;
  const lines = views.front.edges.filter(e => e.kind === 'line' && e.ends && (e.ends[0][0] !== e.ends[1][0]) !== (e.ends[0][2] !== e.ends[1][2]));
  assert.ok(lines.length >= 2);
  const angle: DrawingDimension = { id: 'ang', view: 'front', kind: 'angle', a: { edge: lines[0].name, near: [...lines[0].ends![0]] as [number, number, number] }, b: { edge: lines[1].name, near: [...lines[1].ends![0]] as [number, number, number] }, place: [5, 5], tol: { kind: 'symmetric', value: 0.5 } };
  const { sheet } = sheetOf({ units: 'inch', dual: true, dimensions: [angle] }), r = sheet.dimensions[0];
  assert.ok(r.ok, JSON.stringify(r)); {
    assert.match(r.text, /°$/); assert.equal(r.alt, undefined); assert.ok(texts(groupOf(sheet, 'ang')).every(t => !t.includes('[')), texts(groupOf(sheet, 'ang')).join()); assert.ok(texts(groupOf(sheet, 'ang')).join().includes('±0.5°')); }
});

test('title block: the UNITS cell says mm, inch, mm [inch] or inch [mm]', () => {
  const units = (extra: Partial<DrawingSettings>) => { const g = sheetOf(extra).sheet.groups.find(x => x.role === 'title')!, i = texts(g).indexOf('UNITS'); return texts(g)[i + 1]; };
  assert.equal(units({}), 'mm'); assert.equal(units({ units: 'inch' }), 'inch'); assert.equal(units({ dual: true }), 'mm [inch]'); assert.equal(units({ units: 'inch', dual: true }), 'inch [mm]');
});

test('fit callouts: the class stays, the deviations convert (inch has the dimension\'s decimals)', () => {
  const tube = commands.find(c => c.id === 'tube')!, cyl = commands.find(c => c.id === 'cylinder')!, blank: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
  const a = tube.build!(blank, { ...tube.defaults!(blank), r: 10, ri: 6, h: 24, x: 0, y: 0, z: 0 }), d = cyl.build!({ ...blank, doc: a }, { ...cyl.defaults!(blank), r: 6, h: 24, x: 0, y: 0, z: -5 });
  const doc: StudioDoc = { ...d, fits: { version: 1, tables: [{ id: 's', rows: [{ class: 'H7', over: 10, upTo: 18, upper: 0.018, lower: 0, estimate: true }, { class: 'g6', over: 10, upTo: 18, upper: -0.006, lower: -0.017, estimate: true }] }], faces: [{ face: 'n1.hole0.side0', class: 'H7' }, { face: 'n3.side0', class: 'g6' }], pairs: [{ hole: 'n1.hole0.side0', shaft: 'n3.side0' }] } };
  const inch = lengthFormats(presetFor({ units: 'inch', precision: { inch: 4 } })).primary;
  assert.deepEqual(fitCallout(doc, 'n1.hole0.side0|n1.top', 12, inch), { text: 'H7/g6 (+.0007/+.0001, -.0002/-.0006) (est.)', digits: 4 }, 'both pairs at common decimals, the size at them too, the limits inside the zone');
  assert.equal(withFit(doc, () => null)('n1.hole0.side0|n1.top', 12, inch), 'Ø.4724 H7/g6 (+.0007/+.0001, -.0002/-.0006) (est.)');
  assert.equal(withFit(doc, () => null)('n1.hole0.side0|n1.top', 12), 'Ø12 H7/g6 (+0.018/0, -0.006/-0.017) (est.)', 'no format: mm as before');
});
test('hole callouts: count, depth, counterbore and countersink lengths convert; a thread designation stays', () => {
  const { doc, views } = drawing(), edge = views.top.edges.find(e => e.kind === 'circle')!.name, inch = lengthFormats(presetFor({ units: 'inch' })).primary;
  assert.equal(holeCallout(doc.nodes, edge, doc.parameters), 'Ø24 THRU'); assert.equal(holeCallout(doc.nodes, edge, doc.parameters, inch), 'Ø.945 THRU');
  const deep: StudioDoc = { ...doc, nodes: doc.nodes.map(n => n.kind === 'hole' ? { ...n, depth: 5, csk: 30, pattern: { count: 3 } as never } : n) };
  assert.equal(holeCallout(deep.nodes, edge, deep.parameters, inch), '3× Ø.945 × .197 DEEP  CSK Ø1.181 × 90°');
});

test('tolerance text takes a format; DXF dimension text and the 3D annotations follow the sheet', () => {
  const inch = presetFor({ units: 'inch' });
  assert.equal(toleranceText({ kind: 'symmetric', value: 0.05 }), '±0.05'); assert.equal(toleranceText({ kind: 'symmetric', value: 0.05 }, '', inch), '±.0019');
  assert.equal(toleranceText({ kind: 'deviation', upper: 0.1, lower: 0 }, '', inch), '+.0039/0');
  const { sheet, layout, views, settings } = sheetOf({ units: 'inch', dual: true });
  const dxf = sheetDxfDocument(sheet, layout), dims = dxf.entities.filter((e): e is Extract<typeof e, { type: 'dimension' }> => e.type === 'dimension');
  assert.ok(dims.some(e => e.text === '2.5197 ±.0019 [64 ±0.05]'), dims.map(e => e.text).join(' | '));
  assert.ok(dims.every(e => !/^\d+(\.\d+)?$/.test(e.text) || e.text.includes('.')), 'no bare mm text');
  const items = modelAnnotations({ views, layout, settings, sheet }).items;
  const wide = items.find(a => a.dimension && a.id.includes('wide')) ?? items.find(a => a.dimension?.text === '2.5197');
  assert.ok(wide?.dimension, JSON.stringify(items.map(a => a.dimension?.text))); assert.equal(wide.dimension.text, '2.5197'); assert.equal(wide.dimension.alt, '64'); assert.equal(wide.dimension.value, 64); assert.equal(wide.dimension.unit, 'mm');
  const flat = items.find(a => a.frame?.characteristic === 'flatness'); assert.ok(flat?.frame); assert.ok(flat.frame.cells.some(c => c.text === '.0039'), JSON.stringify(flat.frame.cells)); assert.equal(flat.frame.value, 0.1);
  const mm = modelAnnotations({ views, layout, settings: { ...settings, units: undefined, dual: undefined }, sheet: sheetOf({}).sheet }).items.find(a => a.frame?.characteristic === 'flatness');
  assert.ok(mm?.frame?.cells.some(c => c.text === '0.1'));
  const target = settings.datumTargets![0]; assert.equal(datumTargetSizeText(target), 'Ø6.35'); assert.equal(datumTargetSizeText(target, presetFor({ units: 'inch' })), 'Ø.250');
});

test('units save and open as the same JSON, in canonical order; wrong values are dropped', async () => {
  const authored = readDrawing({ ...drawing().settings, standard: 'asme', units: 'inch', dual: true, precision: { inch: 4, mm: 1 } });
  assert.equal(authored.units, 'inch'); assert.equal(authored.dual, true); assert.deepEqual(authored.precision, { mm: 1, inch: 4 });
  assert.equal(JSON.stringify(readDrawing(JSON.parse(JSON.stringify(authored)))), JSON.stringify(authored));
  const keys = Object.keys(authored); assert.deepEqual(keys.slice(keys.indexOf('standard'), keys.indexOf('standard') + 4), ['standard', 'units', 'dual', 'precision']);
  // (Written in another order, it reads back in the canonical one.)
  assert.equal(JSON.stringify(readDrawing({ precision: { inch: 4, mm: 1 }, dual: true, units: 'inch', standard: 'asme', dimensions: [] })), JSON.stringify(readDrawing({ standard: 'asme', units: 'inch', dual: true, precision: { mm: 1, inch: 4 }, dimensions: [] })));
  const opened = await readStudioFile(encodeStudioFile({ ...starterDoc(), drawing: authored })); assert.ok('doc' in opened);
  assert.equal(JSON.stringify(readDrawing(opened.doc.drawing)), JSON.stringify(authored));
  const bad = readDrawing({ units: 'feet', dual: 'yes', precision: { mm: 7, inch: 1.5 } }); assert.deepEqual([bad.units, bad.dual, bad.precision], [undefined, undefined, undefined]);
  assert.deepEqual(readDrawing({ precision: { mm: 2, inch: -1 } }).precision, { mm: 2 }); assert.equal('units' in readDrawing({ units: 'mm' }), false, 'mm is the absent default');
  assert.equal('dual' in readDrawing({ dual: false }), false);
});
test('drawing.set takes units, dual and precision; refuses what is not a unit, a switch or 0 to 6 decimals; {} and mm reset', () => {
  const doc = starterDoc(), ok = (args: Record<string, unknown>, from = doc) => { const r = runDrawingTool(from, 'set_drawing', args); assert.ok(!('error' in r), 'error' in r ? r.error : ''); return r.doc; };
  const set = ok({ units: 'inch', dual: true, precision: { inch: 4 } }), s = readDrawing(set.drawing);
  assert.deepEqual([s.units, s.dual, s.precision], ['inch', true, { inch: 4 }]);
  const reset = readDrawing(ok({ units: 'mm', dual: false, precision: {} }, set).drawing); assert.deepEqual([reset.units, reset.dual, reset.precision], [undefined, undefined, undefined]);
  const refused = (args: Record<string, unknown>) => { const r = runDrawingTool(doc, 'set_drawing', args); assert.ok('error' in r, JSON.stringify(args)); return r.error; };
  assert.match(refused({ units: 'feet' }), /units must be one of mm, inch/); assert.match(refused({ dual: 'yes' }), /dual must be true or false/);
  for (const precision of [{ inch: 7 }, { mm: -1 }, { mm: 1.5 }, { cm: 1 }, [], 'two']) assert.match(refused({ precision }), /precision is decimals from 0 to 6 for mm and inch/);
  const input = drawingInputs(doc, readDrawing({ ...defaultDrawing(), units: 'inch' })); assert.ok(typeof input !== 'string');
});
test('a sheet in inch is an SVG too: the text is in the file', () => {
  const { sheet } = sheetOf({ units: 'inch', dual: true });
  assert.match(sheetSvg(sheet, 'Plate'), />2\.5197 ±\.0019 \[64 ±0\.05\]</);
});
test('a source table\'s mm columns print in inch (header and cells); mass, counts, notes and a table the person typed stay', () => {
  const content = { title: 'T', columns: [{ key: 'n', label: 'ITEM' }, { key: 'len', label: 'LENGTH', unit: 'mm', digits: 1 }, { key: 'm', label: 'MASS', unit: 'kg', digits: 2 }], rows: [['a', 12.7, 0.5], ['b', 25.4, 1.25]] as (string | number)[][], notes: ['T 3.175 mm'] };
  const d = drawing({ tables: [{ id: 'src', from: 'bends', at: [20, 100] }, { id: 'own', title: 'OWN', columns: content.columns, rows: content.rows, at: [120, 100] }] });
  const build = (units?: 'inch') => { const settings = { ...d.settings, ...(units ? { units } : {}) }, layout = layoutSheet(d.views, settings); return buildSheet(d.views, layout, settings, { title: 'P', date: '2026-10-31', tableContent: () => content }); };
  const all = (sheet: Sheet) => sheet.groups.filter(g => g.role === 'table').map(g => texts(g));
  const mm = all(build()), inch = all(build('inch'));
  assert.ok(mm[0].includes('LENGTH [mm]') && mm[0].includes('12.7'));
  assert.ok(inch[0].includes('LENGTH [inch]') && inch[0].includes('.500') && inch[0].includes('1.000') && inch[0].includes('0.50') && inch[0].includes('MASS [kg]') && inch[0].includes('T 3.175 mm'), inch[0].join());
  assert.deepEqual(inch[1], mm[1], 'the typed table is unchanged');
});

// ---- round 2: tolerances never print wider or as zero ---------------------------------------------------------------
import { deviationPair, frameValue } from '../src/drawing/standard';
import { withShownText } from '../src/drawing/sheet';
import { drawingIssues, issueContext } from '../src/drawing/issues';
import { textCorners } from '../src/drawing/text';

test('a tolerance is converted by its limits and rounded inward: never zero, never less than 80% of the zone, the dimension gains zeros', () => {
  const inch = presetFor({ units: 'inch' });
  assert.equal(texts(groupOf(sheetOf({ units: 'inch', dimensions: [{ ...drawing().settings.dimensions[0], tol: { kind: 'symmetric', value: 0.005 } }] }).sheet, 'wide'))[0], '2.51969 +.00019/-.00020', '±0.005 mm: five places, not ±.000; the nominal rounds up, so the zone is unequal');
  assert.equal(texts(groupOf(sheetOf({ units: 'inch', dimensions: [{ ...drawing().settings.dimensions[0], tol: { kind: 'symmetric', value: 0.01 } }] }).sheet, 'wide'))[0], '2.5197 +.0003/-.0004', '±0.01 mm: four places keep 89% of the zone; the nominal rounds up, so the zone is unequal');
  assert.deepEqual(texts(groupOf(sheetOf({ units: 'inch', dimensions: [{ ...drawing().settings.dimensions[1], tol: { kind: 'deviation', upper: 0.009, lower: -0.004 } }] }).sheet, 'high')), ['.31496', '+.00035', '-.00015']);
  for (const [precision, want] of [[0, '64.00 ±0.05'], [1, '64.00 ±0.05'], [2, '64.00 ±0.05'], [3, '64.000 ±0.050']] as const) assert.equal(texts(groupOf(sheetOf({ precision: { mm: precision } }).sheet, 'wide'))[0], want, `mm precision ${precision}`);
  assert.deepEqual(deviationPair(0.009, -0.004, inch, 'inch'), { upper: '+.00035', lower: '-.00015', equal: false, digits: 5, nominal: '.00000', tight: false });
  assert.equal(deviationPair(0.05, -0.05, presetFor({ precision: { mm: 0 } }), 'mm').upper, '+0.05');
  const plain = sheetOf({ dimensions: [{ ...drawing().settings.dimensions[0], tol: { kind: 'symmetric', value: 0.005 } }, { ...drawing().settings.dimensions[5], tol: { kind: 'symmetric', value: 0.125 } }] }).sheet;
  assert.equal(texts(groupOf(plain, 'wide'))[0], '64 ±0.005', 'plain mm: a tolerance prints as entered'); assert.equal(texts(groupOf(plain, 'round'))[0], 'R12 ±0.125');
});
/** The probe of the audit: random nominals and tolerances through the real sheet text; every printed limit must lie inside the true zone. */
test('printed limits never lie outside the true zone (20,000 random dimensions per setting; nominal, deviations, unequal results)', () => {
  const num = (x: string) => Number(x.replace(/^([+-]?)\./, '$10.'));
  const parse = (line: string) => {
    const m = /^(\S+) (?:±(\S+)|(\S+)\/(\S+))$/.exec(line.split(' [')[0])!, n = num(m[1]);
    return m[2] ? { hi: n + num(m[2]), lo: n - num(m[2]) } : { hi: n + (m[3] === '0' ? 0 : num(m[3])), lo: n + (m[4] === '0' ? 0 : num(m[4])) };
  };
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const picks = [0.005, 0.01, 0.02, 0.025, 0.05, 0.1, 0.2, 0.013, 0.009, 0.0254, 0.127];
  const settings: [Partial<DrawingSettings>, number][] = [[{ units: 'inch' }, 25.4], [{ units: 'inch', precision: { inch: 4 } }, 25.4], [{ precision: { mm: 0 } }, 1], [{ precision: { mm: 1 } }, 1], [{ precision: { mm: 2 } }, 1], [{}, 1]];
  let unequal = 0, total = 0;
  for (const [set, scale] of settings) {
    const p = presetFor(set);
    for (let i = 0; i < 20000; i++) {
      const value = Math.round(rnd() * 200000) / 1000 + 0.5, pick = () => picks[Math.floor(rnd() * picks.length)];
      const tol = rnd() < 0.5 ? { kind: 'symmetric' as const, value: pick() } : { kind: 'deviation' as const, upper: pick(), lower: -pick() };
      const r = { ok: true, kind: 'linear', dim: { id: 'd', kind: 'linear', view: 'front', tol }, a: [0, 0], b: [1, 0], value, text: '' } as never;
      const shown = withShownText(r, undefined, p) as Extract<ReturnType<typeof withShownText>, { ok: true }>, line = dimensionLine(shown, p), { hi, lo } = parse(line);
      const up = tol.kind === 'symmetric' ? tol.value : tol.upper, low = tol.kind === 'symmetric' ? -tol.value : tol.lower;
      assert.ok(hi <= (value + up) / scale + 1e-9 && lo >= (value + low) / scale - 1e-9, `${JSON.stringify(set)} ${value} ${JSON.stringify(tol)} -> ${line}`);
      total++; if (tol.kind === 'symmetric' && !line.includes('±')) unequal++;
    }
  }
  assert.equal(total, 120000); assert.ok(unequal > 0, 'a symmetric tolerance can print unequal');
  // the audit's examples
  const line = (value: number, tol: DrawingDimension['tol'], set: Partial<DrawingSettings>) => { const p = presetFor(set); return dimensionLine(withShownText({ ok: true, kind: 'linear', dim: { id: 'd', kind: 'linear', view: 'front', tol }, a: [0, 0], b: [1, 0], value, text: '' } as never, undefined, p) as never, p); };
  const within = (text: string, scale: number, lo: number, hi: number) => { const { hi: h, lo: l } = parse(text); assert.ok(l >= lo / scale - 1e-9 && h <= hi / scale + 1e-9, text); };
  within(line(45.56, { kind: 'symmetric', value: 0.0254 }, { units: 'inch' }), 25.4, 45.5346, 45.5854);
  within(line(95.516, { kind: 'symmetric', value: 0.1 }, { precision: { mm: 0 } }), 1, 95.416, 95.616);
  assert.equal(line(10.004, { kind: 'symmetric', value: 0.005 }, {}), '10.004 ±0.005', 'plain mm: the nominal has the tolerance\'s decimals');
  assert.equal(line(64, { kind: 'symmetric', value: 0.05 }, {}), '64 ±0.05', 'plain mm as before');
  assert.equal(line(10.0004, { kind: 'symmetric', value: 0.005 }, {}), '10 +0.005/-0.004');
});
test('an uneven tolerance with one tiny side never prints that side as zero', () => {
  const inch = presetFor({ units: 'inch' }), d = deviationPair(0.1, -0.0005, inch, 'inch', 20);
  assert.notEqual(d.lower, '0'); assert.doesNotMatch(d.lower, /^[+-]?\.0*$/, d.lower); assert.doesNotMatch(d.upper, /^[+-]?\.0*$/);
  for (const [u, l] of [[0.1, -0.0005], [0.0005, -0.1], [0.2, 0.0004], [-0.0004, -0.2]] as const) { const x = deviationPair(u, l, inch, 'inch', 33.3); if (!x.tight) for (const [s, truth] of [[x.upper, u], [x.lower, l]] as const) if ((truth as number) !== 0) assert.ok(!/^[+-]?\.0*$/.test(s) && s !== '0', `${u}/${l} -> ${x.upper}/${x.lower}`); }
});
test('a tolerance too fine even for the most decimals prints inward and is a drawing issue naming the dimension', () => {
  const fine: DrawingDimension = { ...drawing().settings.dimensions[0], tol: { kind: 'symmetric', value: 0.00001 } };
  assert.equal(deviationPair(0.00001, -0.00001, presetFor({ units: 'inch' }), 'inch').tight, true);
  const { views, layout, settings, sheet } = sheetOf({ units: 'inch', dimensions: [fine] }), input = drawingInputs(plate(), settings); assert.ok(typeof input !== 'string');
  const issues = drawingIssues(issueContext({ ...input, views, settings, sheet, layout } as never)).filter(i => i.code === 'UNIT_PRECISION');
  assert.equal(issues.length, 1); assert.match(issues[0].message, /^Dimension wide: its tolerance is too fine to print in inches even at 5 decimals/);
  assert.deepEqual(drawingIssues(issueContext({ ...input, views, settings: { ...settings, units: undefined }, sheet: sheetOf({ dimensions: [fine] }).sheet, layout } as never)).filter(i => i.code === 'UNIT_PRECISION'), [], 'mm as entered: no issue');
});
test('frame values are not dimensions: mm as entered whatever the precision; inch rounded down with 3 to 5 places', () => {
  const frames = (extra: Partial<DrawingSettings>, value: number) => texts(groupOf(sheetOf({ ...extra, frames: [{ id: 'flat', dim: 'wide', characteristic: 'flatness', value, datums: [] }] }).sheet, 'flat'));
  assert.ok(frames({ precision: { mm: 1 } }, 0.05).includes('0.05')); assert.ok(frames({ precision: { mm: 1 } }, 0.01).includes('0.01')); assert.ok(frames({}, 0.0125).includes('0.0125'));
  assert.ok(frames({ units: 'inch' }, 0.01).includes('.00039'), frames({ units: 'inch' }, 0.01).join()); assert.ok(frames({ units: 'inch', precision: { inch: 2 } }, 0.1).includes('.0039'), 'the drawing precision does not apply');
  assert.deepEqual(frameValue(0.00001, presetFor({ units: 'inch' })), { text: '.00039'.slice(0, 0) + '.00000', tight: true });
  for (const v of [0.003, 0.01, 0.025, 0.05, 0.1, 0.5, 1.2]) { const f = frameValue(v, presetFor({ units: 'inch' })), n = Number(f.text.replace(/^\./, '0.')); assert.ok(n <= v / 25.4 + 1e-12 && n >= 0.8 * v / 25.4 - 1e-12, `${v} -> ${f.text}`); }
});

test('weld sizes and weld list: converted with their header; an element size line keeps mm; a section column says so', () => {
  const joint = { weld: { kind: 'fillet', size: 6.35, sizeBasis: 'set', allRound: true } } as never;
  const mm = symbolMarksOf(joint), inch = symbolMarksOf(joint, lengthFormats(presetFor({ units: 'inch' })).primary);
  assert.ok(mm.includes('6.35') && inch.includes('.250'), `${mm} / ${inch}`);
  const content = { title: 'WELD LIST', columns: [{ key: 'size', label: 'SIZE', unit: 'mm', align: 'end' as const }, { key: 'section', label: 'SECTION' }, { key: 'e', label: 'SIZE', unit: 'mm' }], rows: [['6.35*', '40 × 40 × 3', 'plate 3 thick'], ['12.7', 'x', 'Ø8 × 20']] as (string | number)[][] };
  const d = drawing({ tables: [{ id: 'w', from: 'weld-list', at: [20, 100] }] }), settings = { ...d.settings, units: 'inch' as const }, layout = layoutSheet(d.views, settings);
  const t = buildSheet(d.views, layout, settings, { title: 'P', date: 'x', tableContent: () => content }).groups.find(g => g.role === 'table')!, all = texts(t);
  assert.ok(all.includes('SIZE [inch]') && all.includes('.250*') && all.includes('.500') && all.includes('SIZE [mm]') && all.includes('Ø8 × 20') && all.includes('Section sizes are in mm'), all.join(' | '));
});
import { symbolMarks } from '../src/drawing/welds';
const symbolMarksOf = (joint: never, f?: Parameters<typeof symbolMarks>[5]) => symbolMarks([0, 0], [10, 0], 'right', joint, 'W1', f).filter((m): m is Extract<Mark, { kind: 'text' }> => m.kind === 'text').map(m => m.text).join(' ');

// ---- round 2: a dual text that does not fit between the arrows sits beside the line ----------------------------------
const segCross = (a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[]) => {
  const o = (p: readonly number[], q: readonly number[], r: readonly number[]) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
};
const inside = (poly: readonly (readonly number[])[], p: readonly number[]) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if ((poly[i][1] > p[1]) !== (poly[j][1] > p[1]) && p[0] < (poly[j][0] - poly[i][0]) * (p[1] - poly[i][1]) / (poly[j][1] - poly[i][1]) + poly[i][0]) c = !c; return c; };
const hits = (box: readonly (readonly number[])[], seg: readonly (readonly number[])[]) => seg.some(p => inside(box, p)) || [0, 1, 2, 3].some(i => segCross(box[i], box[(i + 1) % 4], seg[0], seg[seg.length - 1]));
test('a short dimension with dual on: no text box meets its own dimension line or arrowheads, under plain, ISO and ASME', () => {
  for (const standard of [undefined, 'iso', 'asme'] as const) for (const units of ['inch', 'mm'] as const) for (const scale of [1, 2, 5]) {
    const d = drawing(), tolerances = [undefined, { kind: 'symmetric', value: 0.05 }, { kind: 'deviation', upper: 0.1, lower: -0.05 }] as const;
    for (const tol of tolerances) {
      const short: DrawingDimension = { ...d.settings.dimensions[1], tol: tol as never }, settings = { ...d.settings, scale, units, dual: true, dimensions: [short], frames: [], datumTargets: [], ...(standard ? { standard } : {}) };
      const layout = layoutSheet(d.views, settings), sheet = buildSheet(d.views, layout, settings, { title: 'P', date: 'x' }), g = groupOf(sheet, 'high');
      const boxes = g.marks.filter((m): m is Extract<Mark, { kind: 'text' }> => m.kind === 'text').map(m => textCorners(m.at, m.text, m.size, m.anchor, m.angle ?? 0, !!m.bold));
      const lines = g.marks.filter((m): m is Extract<Mark, { kind: 'line' }> => m.kind === 'line' && m.role === 'dimension').map(m => [m.a, m.b]);
      const heads = g.marks.filter((m): m is Extract<Mark, { kind: 'fill' }> => m.kind === 'fill' && !!m.head).map(m => [...m.points, m.points[0]]);
      for (const box of boxes) { for (const l of lines) assert.ok(!hits(box, l), `${standard}/${units}/1:${scale}/${tol?.kind}: text meets the dimension line`); for (const h of heads) { for (let i = 0; i < 3; i++) assert.ok(!hits(box, [h[i], h[i + 1]]), `${standard}/${units}/1:${scale}/${tol?.kind}: text meets an arrowhead`); assert.ok(!h.some(p => inside(box, p)), 'arrow tip inside the text'); } }
    }
  }
});

test('fits: the size prints at the decimals of its deviations and every printed limit is inside the true zone (five sizes, inch and plain mm)', () => {
  const tube = commands.find(c => c.id === 'tube')!, cyl = commands.find(c => c.id === 'cylinder')!, blank: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
  const a = tube.build!(blank, { ...tube.defaults!(blank), r: 10, ri: 6, h: 24, x: 0, y: 0, z: 0 }), d = cyl.build!({ ...blank, doc: a }, { ...cyl.defaults!(blank), r: 6, h: 24, x: 0, y: 0, z: -5 });
  const doc: StudioDoc = { ...d, fits: { version: 1, tables: [{ id: 's', rows: [{ class: 'H7', over: 10, upTo: 18, upper: 0.018, lower: 0 }, { class: 'g6', over: 10, upTo: 18, upper: -0.006, lower: -0.017 }] }], faces: [{ face: 'n1.hole0.side0', class: 'H7' }, { face: 'n3.side0', class: 'g6' }], pairs: [{ hole: 'n1.hole0.side0', shaft: 'n3.side0' }] } };
  const num = (x: string) => x === '0' ? 0 : Number(x.replace(/^([+-]?)\./, '$10.'));
  for (const [set, scale] of [[{ units: 'inch' }, 25.4], [{ units: 'inch', precision: { inch: 4 } }, 25.4], [{}, 1], [{ precision: { mm: 1 } }, 1]] as const) for (const size of [10.4, 12, 14.37, 16.0004, 17.999]) {
    const f = lengthFormats(presetFor(set)).primary, text = withFit(doc, () => null)('n1.hole0.side0|n1.top', size, f)!;
    const m = /^Ø(\S+) H7\/g6 \((\S+)\/(\S+), (\S+)\/(\S+)\)$/.exec(text); assert.ok(m, text);
    const n = num(m[1]), decimals = (x: string) => (x.split('.')[1] ?? '').length;
    if ('units' in set || 'precision' in set) for (const x of m.slice(2)) if (x !== '0') assert.equal(decimals(x), decimals(m[1]) || decimals(x), `${text}: equal decimals`);
    assert.ok(n + num(m[2]) <= (size + 0.018) / scale + 1e-9 && n + num(m[3]) >= size / scale - 1e-9, `${set.units ?? 'mm'} ${size}: hole ${text}`);
    assert.ok(n + num(m[4]) <= (size - 0.006) / scale + 1e-9 && n + num(m[5]) >= (size - 0.017) / scale - 1e-9, `${set.units ?? 'mm'} ${size}: shaft ${text}`);
  }
  assert.equal(withFit(doc, () => null)('n1.hole0.side0|n1.top', 12, lengthFormats(presetFor({})).primary), 'Ø12 H7/g6 (+0.018/0, -0.006/-0.017)', 'plain mm: as before');
});
test('frames in inch: a projected height rounds up, an unequal amount to nearest within 5%, a width down', () => {
  const inch = presetFor({ units: 'inch' }), v = (mm: number, mode?: 'down' | 'up' | 'nearest') => frameValue(mm, inch, mode);
  for (const mm of [0.003, 0.01, 0.025, 0.05, 0.1, 0.125, 0.5, 3.3, 12.7]) {
    const t = mm / 25.4, n = (x: { text: string }) => Number(x.text.replace(/^\./, '0.'));
    assert.ok(n(v(mm, 'up')) >= t - 1e-12 && n(v(mm, 'up')) <= t / 0.8 + 1e-12, `up ${mm} -> ${v(mm, 'up').text}`);
    assert.ok(n(v(mm, 'down')) <= t + 1e-12 && n(v(mm, 'down')) >= 0.8 * t - 1e-12, `down ${mm}`);
    assert.ok(Math.abs(n(v(mm, 'nearest')) - t) <= 0.05 * t + 1e-12, `nearest ${mm} -> ${v(mm, 'nearest').text}`);
  }
  assert.equal(v(0.1, 'down').text, '.0039'); assert.equal(v(0.1, 'up').text, '.004'); assert.equal(v(0.125, 'nearest').text, '.005');
  assert.equal(v(0.00001, 'nearest').tight, true); assert.equal(v(0.00001, 'up').tight, true);
  const { sheet } = sheetOf({ units: 'inch', frames: [{ id: 'pos', dim: 'bore', characteristic: 'position', value: 0.25, datums: [], projected: 0.1 }, { id: 'prof', dim: 'plain', characteristic: 'profile-surface', value: 0.5, datums: [], unequal: 0.125 }] });
  assert.ok(texts(groupOf(sheet, 'pos')).includes('.004'), texts(groupOf(sheet, 'pos')).join()); assert.ok(texts(groupOf(sheet, 'prof')).includes('.005'));
});
test('weld symbols on the sheet are in the drawing\'s unit and keep the estimate mark; the weld list size cells too', () => {
  const d = drawing(), face = d.views.front.edges.find(e => e.ends && e.pieces.some(x => x.visible))!.name.split('|')[0];
  const joint = { id: 'b.start', kind: 'butt', body: 'b', end: 'start', meets: [], face, seamLength: 10, innerLoop: null, weld: { kind: 'fillet', size: 6.35, sizeBasis: 'estimate', allRound: false } } as never;
  const build = (extra: Partial<DrawingSettings>) => { const settings = { ...d.settings, weldSymbols: true, ...extra }, layout = layoutSheet(d.views, settings); return buildSheet(d.views, layout, settings, { title: 'P', date: 'x', welds: [joint] }); };
  const weld = (sheet: Sheet) => sheet.groups.find(g => g.role === 'weld'); 
  assert.ok(weld(build({})), 'the symbol is drawn'); assert.ok(texts(weld(build({}))!).includes('6.35*'), texts(weld(build({}))!).join());
  assert.ok(texts(weld(build({ units: 'inch' }))!).includes('.250*'), texts(weld(build({ units: 'inch' }))!).join());
  assert.ok(texts(weld(build({ units: 'mm', precision: { mm: 0 } }))!).includes('6*'));
});
