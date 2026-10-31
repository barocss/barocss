// Roadmap 11 ③a: the drawing standard (ISO / ASME presets). Absent, the sheet is byte for byte what it was (golden hashes
// made from the sources before the setting); each standard sets lettering, arrowheads, dimension text, projection symbol,
// datum line targets and the drawing check's GD&T advice from one preset record.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brepsFor } from '../src/engine/evaluate';
import { starterDoc, type StudioDoc } from '../src/engine/doc';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { projectViews } from '../src/drawing/project';
import { layoutSheet } from '../src/drawing/views';
import { snapPoints } from '../src/drawing/dimensions';
import { buildSheet, dimensionMarks, TITLE_ROOM, type Mark, type MarkGroup, type Sheet } from '../src/drawing/sheet';
import { textCorners } from '../src/drawing/text';
import { checkDrawingFrames, frameNotes, frameRules, type DrawingFrame } from '../src/drawing/controls';
import { drawingIssues, issueContext } from '../src/drawing/issues';
import { modelAnnotations } from '../src/drawing/annotations3d';
import { STANDARDS, PLAIN, formatNumber, presetOf } from '../src/drawing/standard';
import { placeDimensionLabels } from '../src/drawing/layout';
import { fmtMM } from '../src/drawing/dimensions';
import { drawingInputs, runDrawingTool } from '../src/chat/drawing';
import { sheetSvg } from '../src/io/svg';
import { sheetDxf, sheetDxfDocument } from '../src/io/dxf';
import { defaultDrawing, readDrawing, type DrawingDimension, type DrawingSettings, type DrawingViews } from '../src/drawing/types';
import type { DrawingDatumTarget } from '../src/drawing/datumTargets';

const viewsOf = (doc: StudioDoc): DrawingViews => {
  const b = brepsFor(doc); assert.ok('breps' in b, JSON.stringify(b));
  const r = projectViews(b.breps, b.prefixes); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return r.views;
};
/** The starter plate (64 x 32 x 8, a hole at 32, 16) with the hole's radius changed. */
const plate = (radius = 4): StudioDoc => { const d = starterDoc(); return { ...d, nodes: d.nodes.map(n => n.kind === 'hole' ? { ...n, radius } : n) }; };
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;

/** Dimensions of every kind the standards treat differently, on the plate with a Ø24 hole. */
function drawing(extra: Partial<DrawingSettings> = {}): { doc: StudioDoc; views: DrawingViews; settings: DrawingSettings } {
  const doc = plate(12), views = viewsOf(doc), hole = views.top.edges.find(e => e.kind === 'circle')!, f = snapPoints(views.front);
  const at = (u: number, w: number) => f.find(p => near(p.at[0], u) && near(p.at[1], w))!.ref;
  const circle = { edge: hole.name, near: [...hole.circle!.center] as [number, number, number] };
  const line = views.front.edges.find(e => e.kind === 'line' && e.ends)!, [p, q] = line.ends!;
  const dimensions: DrawingDimension[] = [
    { id: 'wide', view: 'front', kind: 'linear', a: at(0, 0), b: at(64, 0), orient: 'horizontal', place: [32, -12] },
    { id: 'high', view: 'front', kind: 'linear', a: at(0, 0), b: at(0, 8), orient: 'vertical', place: [-12, 4] },
    { id: 'slant', view: 'front', kind: 'linear', a: at(0, 0), b: at(64, 8), orient: 'aligned', place: [20, 20] },
    { id: 'short', view: 'front', kind: 'linear', a: at(0, 0), b: at(0, 8), orient: 'vertical', place: [80, 4], tol: { kind: 'deviation', upper: 0.1, lower: -0.05 } },
    { id: 'bore', view: 'top', kind: 'diameter', ...circle, place: [33, 17] },
    { id: 'far', view: 'top', kind: 'diameter', ...circle, place: [58, 40] },
    { id: 'round', view: 'top', kind: 'radius', ...circle, place: [28, 10] },
  ];
  const targets: DrawingDatumTarget[] = [
    { id: 'line-a', letter: 'A', number: 1, view: 'front', place: [-14, 14], kind: 'line', line: { from: [10, 4], to: [50, 4] } },
    { id: 'area-b', letter: 'B', number: 1, view: 'front', place: [-14, -12], kind: 'area', area: { shape: 'circle', at: [20, 4], d: 6 } },
  ];
  const settings: DrawingSettings = {
    ...defaultDrawing(), sheet: 'A3', dimensions, datumTargets: targets,
    datums: [{ id: 'da', letter: 'C', view: 'front', edge: { edge: line.name, near: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2] }, place: [32, -26] }],
    frames: [{ id: 'flat', dim: 'wide', characteristic: 'flatness', value: 0.1, datums: [] }],
    ...extra,
  };
  return { doc, views, settings };
}
const sheetOf = (settings: DrawingSettings, d = drawing(settings)) => {
  const layout = layoutSheet(d.views, settings);
  return { sheet: buildSheet(d.views, layout, settings, { title: 'Plate', date: '2026-10-31' }), layout, views: d.views };
};
const groupOf = (sheet: Sheet, id: string): MarkGroup => { const g = sheet.groups.find(x => x.id === id); assert.ok(g, id); return g; };
const textsOf = (marks: readonly Mark[]) => marks.filter((m): m is Extract<Mark, { kind: 'text' }> => m.kind === 'text');
const linesOf = (marks: readonly Mark[], role?: string) => marks.filter((m): m is Extract<Mark, { kind: 'line' }> => m.kind === 'line' && (!role || m.role === role));
const headsOf = (marks: readonly Mark[]) => marks.filter((m): m is Extract<Mark, { kind: 'fill' }> => m.kind === 'fill' && !!m.head);
const box = (m: Extract<Mark, { kind: 'text' }>) => { const q = textCorners(m.at, m.text, m.size, m.anchor, m.angle ?? 0, !!m.bold); return [Math.min(...q.map(p => p[0])), Math.min(...q.map(p => p[1])), Math.max(...q.map(p => p[0])), Math.max(...q.map(p => p[1]))]; };

// ---- absent = what it always was -------------------------------------------------------------------------------------

const hash = (s: string) => createHash('sha256').update(s).digest('hex');
/** The fixtures hashed: the SVG and the DXF text of each sheet. */
function plainOutputs(): Record<string, string> {
  const out: Record<string, string> = {};
  const variants: Record<string, Partial<DrawingSettings>> = {
    third: {}, first: { projection: 'first' }, 'no-hidden': { hidden: false, tolerancing: 'geometric' },
    extended: { titleBlock: { template: 'extended', drawnBy: 'AB' } as DrawingSettings['titleBlock'] },
  };
  for (const [name, extra] of Object.entries(variants)) {
    const { sheet, layout } = sheetOf({ ...drawing().settings, ...extra }, drawing(extra));
    out[`${name}.svg`] = hash(sheetSvg(sheet, 'Plate')); out[`${name}.dxf`] = hash(sheetDxf(sheet, layout).text);
  }
  const starter = starterDoc(), views = viewsOf(starter), layout = layoutSheet(views, defaultDrawing());
  out['starter.svg'] = hash(sheetSvg(buildSheet(views, layout, defaultDrawing(), { title: 'Starter', date: '2026-10-31' }), 'Starter'));
  return out;
}
const GOLDEN = join(import.meta.dirname, 'fixtures/drawing-standard-plain.json');

test('no standard: the sheets are byte for byte the ones made before the setting (SVG and DXF of seven kinds of dimension, datum, targets, frame)', () => {
  const now = plainOutputs();
  if (process.env.UPDATE_STANDARD_GOLDEN) writeFileSync(GOLDEN, JSON.stringify(now, null, 2) + '\n');
  assert.deepEqual(now, JSON.parse(readFileSync(GOLDEN, 'utf8')), 'made by the sources before drawing.standard existed (UPDATE_STANDARD_GOLDEN=1 only from such sources)');
  assert.deepEqual(STANDARDS.iso.number, PLAIN.number); assert.deepEqual(STANDARDS.asme.number, PLAIN.number);
});

// ---- lettering, arrowheads -------------------------------------------------------------------------------------------

test('lettering height: 3.5 mm under ISO and with no standard, 3 mm under ASME, on dimensions, datum, frame and targets', () => {
  const heights = (standard?: 'iso' | 'asme') => {
    const { sheet } = sheetOf({ ...drawing().settings, ...(standard ? { standard } : {}) });
    const sizes = (id: string) => [...new Set(textsOf(groupOf(sheet, id).marks).map(m => m.size).filter(s => s > 2.6))];
    return { dim: sizes('wide'), tol: sizes('far'), datum: sizes('da'), target: sizes('line-a'), frame: sizes('flat') };
  };
  const want = (h: number) => ({ dim: [h], tol: [h], datum: [h], target: [h], frame: [h] });
  assert.deepEqual(heights(), want(3.5)); assert.deepEqual(heights('iso'), want(3.5)); assert.deepEqual(heights('asme'), want(3));
  const svg = sheetSvg(sheetOf({ ...drawing().settings, standard: 'asme' }).sheet, 'Plate');
  assert.match(svg, /font-size="3"[^>]*>64<\/text>/);
});

test('arrowheads: ISO filled 15 degrees (3 long, 0.8 across); ASME filled 3:1 (3 long, 1 across); the polygon is the head', () => {
  const heads = (standard: 'iso' | 'asme') => headsOf(groupOf(sheetOf({ ...drawing().settings, standard }).sheet, 'wide').marks);
  for (const [standard, across] of [['iso', 0.8], ['asme', 1]] as const) {
    const hs = heads(standard); assert.equal(hs.length, 2);
    for (const h of hs) {
      assert.equal(h.head!.length, 3); assert.ok(near(h.head!.width, across)); assert.equal(h.head!.style, 'filled');
      const [tip, a, b] = h.points; assert.deepEqual(tip, h.head!.tip);
      const base = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      assert.ok(near(Math.hypot(tip[0] - base[0], tip[1] - base[1]), 3), 'the base is 3 mm behind the tip');
      assert.ok(near(Math.hypot(a[0] - b[0], a[1] - b[1]), across), 'the base is as wide as the head says');
    }
  }
  const iso = heads('iso')[0].head!, asme = heads('asme')[0].head!;
  assert.ok(Math.abs(2 * Math.atan(iso.width / 2 / iso.length) * 180 / Math.PI - 15) < 0.3, 'about 15 degrees');
  assert.ok(near(asme.length / asme.width, 3), 'length to width 3:1');
});

// ---- dimension text --------------------------------------------------------------------------------------------------

test('ISO text is aligned with the dimension line, above it; ASME text is horizontal in a break of the line', () => {
  for (const id of ['wide', 'high', 'slant']) {
    const iso = sheetOf({ ...drawing().settings, standard: 'iso' }).sheet, asme = sheetOf({ ...drawing().settings, standard: 'asme' }).sheet;
    const isoText = textsOf(groupOf(iso, id).marks)[0], asmeText = textsOf(groupOf(asme, id).marks)[0];
    assert.equal(asmeText.angle, undefined, `${id}: ASME text reads horizontally`);
    assert.equal(isoText.angle !== undefined, id !== 'wide', `${id}: ISO text turns with the line`);
    // ISO: one unbroken dimension line, the text above it. ASME: two pieces with the text between them.
    const isoLines = linesOf(groupOf(iso, id).marks, 'dimension'), asmeLines = linesOf(groupOf(asme, id).marks, 'dimension');
    assert.equal(isoLines.length, 1, `${id}: ISO line unbroken`); assert.equal(asmeLines.length, 2, `${id}: ASME line in two pieces`);
    const [x0, y0, x1, y1] = box(asmeText), crosses = (l: { a: [number, number]; b: [number, number] }) => {
      for (let t = 0; t <= 1; t += 0.01) { const x = l.a[0] + (l.b[0] - l.a[0]) * t, y = l.a[1] + (l.b[1] - l.a[1]) * t; if (x > x0 && x < x1 && y > y0 && y < y1) return true; }
      return false;
    };
    assert.ok(asmeLines.every(l => !crosses(l)), `${id}: no line runs through the ASME text`);
    // The break is centred on the text and about the text's width plus a millimetre either side.
    const gap = Math.hypot(asmeLines[1].a[0] - asmeLines[0].b[0], asmeLines[1].a[1] - asmeLines[0].b[1]);
    assert.ok(gap > 2 && gap < 30, `${id}: break ${gap}`);
  }
  // A horizontal line: the ISO text's box is above the line, the ASME text's box straddles it.
  const iso = sheetOf({ ...drawing().settings, standard: 'iso' }).sheet, asme = sheetOf({ ...drawing().settings, standard: 'asme' }).sheet;
  const y = linesOf(groupOf(iso, 'wide').marks, 'dimension')[0].a[1];
  assert.ok(box(textsOf(groupOf(iso, 'wide').marks)[0])[3] < y);
  const ab = box(textsOf(groupOf(asme, 'wide').marks)[0]); assert.ok(ab[1] < y && ab[3] > y);
});

test('ASME text with no room between the arrows sits beside the line, clear of it; inside a circle it breaks the line too', () => {
  const asme = sheetOf({ ...drawing().settings, standard: 'asme' }).sheet;
  // The 8 mm height on the 1:1 sheet cannot take the "8" between two 3 mm arrows with its break... check it never overlaps its line.
  for (const id of ['high', 'short']) {
    const g = groupOf(asme, id), ls = linesOf(g.marks, 'dimension'), t = textsOf(g.marks)[0], [x0, y0, x1, y1] = box(t);
    for (const l of ls) for (let k = 0; k <= 1; k += 0.01) { const x = l.a[0] + (l.b[0] - l.a[0]) * k, y = l.a[1] + (l.b[1] - l.a[1]) * k; assert.ok(!(x > x0 && x < x1 && y > y0 && y < y1), `${id}: line through its text`); }
    assert.equal(t.angle, undefined);
  }
  const bore = groupOf(asme, 'bore'), parts = linesOf(bore.marks, 'dimension');
  assert.equal(parts.length, 2, 'the diameter inside the hole: its line is broken for the text');
  assert.equal(textsOf(bore.marks)[0].angle, undefined);
  const round = groupOf(asme, 'round');
  assert.equal(textsOf(round.marks)[0].angle, undefined);
  // The same drawing with ISO: one line each.
  const iso = sheetOf({ ...drawing().settings, standard: 'iso' }).sheet;
  assert.equal(linesOf(groupOf(iso, 'bore').marks, 'dimension').length, 1);
});

test('dimension text with a tolerance stays one block in the ASME break', () => {
  const asme = sheetOf({ ...drawing().settings, standard: 'asme' }).sheet;
  const t = textsOf(groupOf(asme, 'short').marks); assert.ok(t.length >= 3, 'value and two deviations'); assert.ok(t.every(m => m.angle === undefined));
});

// ---- numbers ---------------------------------------------------------------------------------------------------------

test('zeros: metric keeps the leading zero and drops trailing ones under both standards, through the preset', () => {
  for (const s of [undefined, 'iso', 'asme'] as const) assert.deepEqual([0.5, 12, 1.25, 0.1, 3.5].map(v => formatNumber(v, presetOf(s).number)), ['0.5', '12', '1.25', '0.1', '3.5']);
  assert.deepEqual([0.5, 12, 1.25].map(v => fmtMM(v)), ['0.5', '12', '1.25']);
  // The rule the inch standards will set (11 3b): no leading zero, trailing zeros kept to the precision.
  assert.equal(formatNumber(0.5, { leadingZero: false, trailingZeros: 'keep' }), '.50');
  assert.equal(formatNumber(12, { leadingZero: true, trailingZeros: 'keep' }), '12.00');
  assert.equal(formatNumber(-0.25, { leadingZero: false, trailingZeros: 'trim' }), '-.25');
});

// ---- projection symbol -----------------------------------------------------------------------------------------------

test('the title block draws the projection symbol to the standard\'s proportions, third and first angle', () => {
  for (const [standard, h] of [['iso', 3.5], ['asme', 3]] as const) for (const projection of ['third', 'first'] as const) {
    const { sheet } = sheetOf({ ...drawing().settings, standard, projection });
    const title = sheet.groups.find(g => g.role === 'title')!.marks;
    const arcs = title.filter((m): m is Extract<Mark, { kind: 'arc' }> => m.kind === 'arc');
    assert.deepEqual(arcs.map(a => a.u[0]).sort((a, b) => a - b), [h / 2, h], `${standard}: end view circles h/2 and h`);
    const [big] = arcs.filter(a => a.u[0] === h), [small] = arcs.filter(a => a.u[0] === h / 2); assert.deepEqual(big.center, small.center);
    // The cone: four thin lines, 2h long, ends h and 2h across.
    const gap = h + 1, coneX = big.center[0] + (projection === 'third' ? -2 * gap : 2 * gap), cy = big.center[1];
    const cone = title.filter((m): m is Extract<Mark, { kind: 'line' }> => m.kind === 'line' && m.pen === 'thin' && [m.a, m.b].every(p => Math.abs(p[0] - coneX) <= h + 1e-9 && Math.abs(p[1] - cy) <= h + 1e-9));
    assert.equal(cone.length, 4, `${standard} ${projection}: the cone's four lines`);
    const xs = cone.flatMap(l => [l.a[0], l.b[0]]), vertical = cone.filter(l => l.a[0] === l.b[0]).map(l => Math.abs(l.a[1] - l.b[1])).sort((a, b) => a - b);
    assert.ok(near(Math.max(...xs) - Math.min(...xs), 2 * h), 'the cone is 2h long'); assert.deepEqual(vertical.map(v => Math.round(v * 1e6) / 1e6), [h, 2 * h], 'its ends h and 2h across');
    const big_end = cone.find(l => l.a[0] === l.b[0] && near(Math.abs(l.a[1] - l.b[1]), 2 * h))!;
    assert.ok(big_end.a[0] > coneX, 'the large end is on the right in both: it points to where the end view of the third-angle symbol is, and the first-angle one is that symbol swapped');
    const axis = title.find((m): m is Extract<Mark, { kind: 'line' }> => m.kind === 'line' && m.pen === 'center');
    assert.ok(axis && axis.a[1] === big.center[1] && axis.b[1] === big.center[1], 'a chain centre line through both views');
    assert.ok(title.some(m => m.kind === 'text' && m.text === (projection === 'third' ? 'THIRD ANGLE' : 'FIRST ANGLE')), 'the words stay');
  }
  // No standard: the sheet's own symbol, with no centre line.
  const plain = sheetOf({ ...drawing().settings }).sheet.groups.find(g => g.role === 'title')!.marks;
  assert.ok(!plain.some(m => m.kind === 'line' && m.pen === 'center'));
});

// ---- datum line target -----------------------------------------------------------------------------------------------

test('a datum line target: ISO two crosses joined by a thin continuous line; ASME (and none) the phantom line, no crosses', () => {
  const marksOf = (standard?: 'iso' | 'asme') => groupOf(sheetOf({ ...drawing().settings, ...(standard ? { standard } : {}) }).sheet, 'line-a').marks;
  const isoMarks = marksOf('iso');
  const crosses = (ms: Mark[]) => linesOf(ms).filter(m => m.pen === 'thin' && m.role === 'leader' && Math.abs(Math.abs(m.b[0] - m.a[0]) - Math.abs(m.b[1] - m.a[1])) < 1e-9 && Math.abs(m.b[0] - m.a[0]) > 0);
  assert.equal(crosses(isoMarks).length, 4, 'two crosses of two strokes');
  assert.equal(isoMarks.filter(m => m.kind === 'line' && m.pen === 'phantom').length, 0);
  const joining = linesOf(isoMarks).filter(m => m.pen === 'thin' && m.role === 'leader' && m.a[1] === m.b[1]);
  assert.equal(joining.length, 1, 'one thin continuous line between the crosses');
  const ends = crosses(isoMarks).map(m => (m.a[0] + m.b[0]) / 2).sort((a, b) => a - b);
  assert.ok(near(ends[0], Math.min(joining[0].a[0], joining[0].b[0])) && near(ends[3], Math.max(joining[0].a[0], joining[0].b[0])));
  for (const s of ['asme', undefined] as const) {
    const m = marksOf(s);
    assert.equal(m.filter(x => x.kind === 'line' && x.pen === 'phantom').length, 1); assert.equal(crosses(m).length, 0);
  }
});

// ---- GD&T advice -----------------------------------------------------------------------------------------------------

test('ASME warns about concentricity and symmetry (position or profile instead); ISO and no standard stay quiet; authoring is not refused', () => {
  const frames: DrawingFrame[] = [
    { id: 'conc', dim: 'bore', characteristic: 'concentricity', value: 0.1, datums: ['C'], diameter: true },
    { id: 'sym', view: 'front', place: [10, -30], characteristic: 'symmetry', value: 0.1, datums: ['C'], diameter: false },
    { id: 'pos', dim: 'far', characteristic: 'position', value: 0.1, datums: ['C'] },
  ];
  const issues = (standard?: 'iso' | 'asme') => {
    const d = drawing({ frames, ...(standard ? { standard } : {}) }), input = drawingInputs(starterDoc());
    assert.ok(typeof input !== 'string');
    return drawingIssues(issueContext({ ...input, views: d.views, settings: d.settings })).filter(i => i.code === 'FRAME_RULE');
  };
  const asme = issues('asme');
  assert.deepEqual(asme.map(i => i.frames![0]).sort(), ['conc', 'sym']); assert.ok(asme.every(i => i.severity === 'warning'));
  assert.match(asme[0].message + asme[1].message, /position or profile/);
  assert.deepEqual(issues('iso'), []); assert.deepEqual(issues(), []);
  assert.deepEqual(frameNotes(frames[2], 'asme'), []);
  // Not a refusal: the frames pass the authoring rules, whatever the standard.
  for (const f of frames) assert.deepEqual(frameRules(f), []);
  assert.deepEqual(checkDrawingFrames({ frames }), []);
  const doc = { ...starterDoc(), drawing: { ...defaultDrawing(), standard: 'asme' as const } };
  const set = runDrawingTool(doc, 'set_drawing', { frames: [{ id: 'k', view: 'front', place: [5, 5], characteristic: 'concentricity', value: 0.1, datums: ['A'], diameter: true }] });
  assert.ok(!('error' in set), 'agent authoring is accepted');
});

// ---- Save / Open, tools ----------------------------------------------------------------------------------------------

test('the standard saves and opens as the same JSON; a wrong value is dropped; drawing.set takes it and none clears it', async () => {
  for (const standard of ['iso', 'asme'] as const) {
    const authored = readDrawing({ ...drawing().settings, standard });
    assert.equal(authored.standard, standard);
    assert.equal(JSON.stringify(readDrawing(JSON.parse(JSON.stringify(authored)))), JSON.stringify(authored), 'authored equals reopened, key order included');
    const keys = Object.keys(authored); assert.equal(keys.indexOf('standard'), keys.indexOf('projection') + 1, 'canonical order: standard right after projection');
    const opened = await readStudioFile(encodeStudioFile({ ...starterDoc(), drawing: authored })); assert.ok('doc' in opened);
    assert.equal(JSON.stringify(readDrawing(opened.doc.drawing)), JSON.stringify(authored));
  }
  assert.equal('standard' in readDrawing({ ...defaultDrawing(), standard: 'din' }), false);
  assert.equal('standard' in readDrawing(defaultDrawing()), false);
  const doc = starterDoc();
  const set = runDrawingTool(doc, 'set_drawing', { standard: 'asme' }); assert.ok(!('error' in set));
  assert.equal(readDrawing(set.doc.drawing).standard, 'asme');
  const none = runDrawingTool(set.doc, 'set_drawing', { standard: 'none' }); assert.ok(!('error' in none));
  assert.equal('standard' in readDrawing(none.doc.drawing), false);
  const bad = runDrawingTool(doc, 'set_drawing', { standard: 'din' }); assert.ok('error' in bad); assert.match(bad.error, /standard must be one of iso, asme, none/);
});

// ---- DXF and the 3D annotations --------------------------------------------------------------------------------------

test('the DXF follows the preset: text heights and arrow sizes in the dimension blocks and the title block', () => {
  for (const [standard, h, across] of [['iso', 3.5, 0.8], ['asme', 3, 1]] as const) {
    const { sheet, layout } = sheetOf({ ...drawing().settings, standard });
    const doc = sheetDxfDocument(sheet, layout), dims = doc.entities.filter((e): e is Extract<typeof e, { type: 'dimension' }> => e.type === 'dimension');
    assert.ok(dims.length >= 6);
    const heights = new Set(dims.flatMap(d => d.block.flatMap(e => e.type === 'text' && e.height > 2.6 ? [e.height] : [])));
    assert.deepEqual([...heights], [h], `${standard}: dimension text height`);
    const solids = dims.flatMap(d => d.block.flatMap(e => e.type === 'solid' ? [e] : []));
    assert.ok(solids.length >= 6);
    for (const s of solids.slice(0, 4)) { const [tip, a, b] = s.points; assert.ok(near(Math.hypot(a[0] - b[0], a[1] - b[1]), across, 1e-9), `${standard}: arrow base across`); assert.ok(tip); }
    const textHeights = new Set(doc.entities.flatMap(e => e.type === 'text' && e.height > 2.6 ? [e.height] : []));
    assert.ok([...textHeights].every(x => x === h), 'datum and frame text too');
  }
});

test('3D annotations: text heights and arrowheads follow the preset (model mm at the view\'s scale)', () => {
  for (const [standard, h, across] of [['iso', 3.5, 0.8], ['asme', 3, 1]] as const) {
    const d = drawing({ standard }), input = drawingInputs(starterDoc()); assert.ok(typeof input !== 'string');
    const ctx = issueContext({ ...input, views: d.views, settings: d.settings });
    const out = modelAnnotations({ views: d.views, layout: ctx.layout, settings: d.settings, sheet: ctx.sheet });
    const wide = out.items.find(i => i.id === 'wide')!, scale = ctx.layout.views.front.scale;
    assert.ok(near(wide.texts[0].height * scale, h), `${standard}: text ${wide.texts[0].height}`);
    assert.ok(wide.arrows.every(a => near(a.width * scale, across) && near(a.length * scale, 3)), `${standard}: arrowheads`);
    const flat = out.items.find(i => i.id === 'flat')!; assert.ok(flat.texts.every(t => near(t.height * scale, h)));
  }
});

// ---- the audit's survivors -------------------------------------------------------------------------------------------

test('ASME text with no room for a break sits beside an unbroken line; with the arrows outside it does too', () => {
  const clear = (sheet: Sheet, id: string, side: 'left' | 'above') => {
    const g = groupOf(sheet, id), ls = linesOf(g.marks, 'dimension'), t = textsOf(g.marks)[0], b = box(t);
    assert.equal(ls.length, 1, `${id}: one unbroken line`); assert.equal(t.angle, undefined, `${id}: horizontal`);
    const l = ls[0];
    if (side === 'left') assert.ok(b[2] < Math.min(l.a[0], l.b[0]), `${id}: the text's box is left of the vertical line`);
    else assert.ok(b[3] < Math.min(l.a[1], l.b[1]), `${id}: the text's box is above the line`);
  };
  // 'high' is 8 mm on a 1:1 sheet: between its arrows there is 2 mm, the "8" wants 3.5 and a millimetre either side.
  clear(sheetOf({ ...drawing().settings, standard: 'asme', scale: 1 }).sheet, 'high', 'left');
  // At 1:5 it is 1.6 mm: the arrows go outside, pointing in.
  const small = sheetOf({ ...drawing().settings, standard: 'asme', scale: 0.2 }).sheet;
  clear(small, 'high', 'left');
  assert.equal(headsOf(groupOf(small, 'high').marks).length, 2);
  // And with ISO the same text keeps its place beside the line, turned with it.
  const iso = textsOf(groupOf(sheetOf({ ...drawing().settings, standard: 'iso', scale: 0.2 }).sheet, 'high').marks)[0];
  assert.equal(iso.angle, 90);
});

test('every lettering on the sheet takes the standard\'s height: notes, section and detail letters, frame and datum letters', () => {
  const doc = starterDoc();
  const heights = (standard?: 'iso' | 'asme') => {
    const settings: DrawingSettings = { ...defaultDrawing(), sheet: 'A3', ...(standard ? { standard } : {}), notes: [{ id: 'n', text: 'DEBURR', at: [20, 20], leader: { view: 'front', at: [10, 4] } }],
      sections: [{ id: 'A', view: 'front', at: 0 }], details: [{ id: 'B', view: 'front', center: [32, 4], radius: 6 }],
      datums: [], frames: [{ id: 'f', view: 'front', place: [10, -20], characteristic: 'flatness', value: 0.1, datums: [] }, { id: 'g', view: 'front', place: [30, -20], characteristic: 'position', value: 0.1, datums: ['A', 'B'] }] };
    const input = drawingInputs(doc, settings); assert.ok(typeof input !== 'string', String(input));
    const sheet = issueContext(input).sheet, found = new Map<string, number>();
    for (const g of sheet.groups) if (g.role !== 'frame' && g.role !== 'title' && g.role !== 'label') for (const m of textsOf(g.marks)) found.set(m.text, m.size);
    return found;
  };
  for (const [standard, h] of [[undefined, 3.5], ['iso', 3.5], ['asme', 3]] as const) {
    const found = heights(standard);
    for (const text of ['DEBURR', 'A', 'B']) assert.equal(found.get(text), h, `${standard}: ${text}`);
    assert.ok([...found.entries()].filter(([, size]) => size > 2.6).every(([, size]) => size === h), `${standard}: ${[...found]}`);
  }
});

test('the standard does not leak: a sheet built after an ASME one is the plain sheet again', () => {
  const plain = () => hash(sheetSvg(sheetOf(drawing().settings).sheet, 'Plate'));
  const before = plain(); sheetOf({ ...drawing().settings, standard: 'asme' }); sheetOf({ ...drawing().settings, standard: 'iso' });
  assert.equal(plain(), before);
  const d = drawing(), view = sheetOf(d.settings, d).layout.views.front, r = (() => { const b = sheetOf(d.settings, d).sheet.dimensions.find(x => x.ok && x.dim.id === 'wide'); assert.ok(b && b.ok); return b; })();
  const text = (std?: 'asme') => textsOf(dimensionMarks(view, r as never, presetOf(std)))[0].size;
  assert.equal(text(), 3.5); assert.equal(text('asme'), 3); assert.equal(text(), 3.5);
});

test('drawing issues and label placement run under the settings\' standard', () => {
  const d = drawing({ standard: 'asme', dimensions: drawing().settings.dimensions.map(x => ({ ...x, auto: true as const })) }), input = drawingInputs(starterDoc()); assert.ok(typeof input !== 'string');
  const ctx = issueContext({ ...input, views: d.views, settings: d.settings });
  assert.ok(ctx.sheet.groups.some(g => textsOf(g.marks).some(t => t.size === 3)), 'the context\'s sheet is drawn at ASME height');
  const placed = placeDimensionLabels(ctx);
  assert.equal(placed.settings.standard, 'asme');
  assert.deepEqual(drawingIssues(ctx).map(i => i.code).sort(), drawingIssues({ ...ctx, settings: { ...ctx.settings } }).map(i => i.code).sort());
});

test('the ISO projection symbol and its centre line stay clear of the title\'s room', () => {
  for (const standard of ['iso', 'asme'] as const) {
    const { sheet, layout } = sheetOf({ ...drawing().settings, standard });
    const marks = sheet.groups.find(g => g.role === 'title')!.marks, limit = layout.title[0] + 2 + TITLE_ROOM;
    const symbol = marks.filter(m => (m.kind === 'line' && (m.pen === 'center' || m.pen === 'thin') && m.a[1] > layout.title[1] && Math.abs(m.a[1] - (marks.find((x): x is Extract<Mark, { kind: 'arc' }> => x.kind === 'arc')!.center[1])) <= 4) || m.kind === 'arc');
    const xs = symbol.flatMap(m => m.kind === 'line' ? [m.a[0], m.b[0]] : m.kind === 'arc' ? [m.center[0] - m.u[0], m.center[0] + m.u[0]] : []);
    assert.ok(Math.min(...xs) >= limit, `${standard}: the symbol starts at ${Math.min(...xs)}, the title's room ends at ${limit}`);
    const words = marks.find(m => m.kind === 'text' && /ANGLE/.test(m.text)) as Extract<Mark, { kind: 'text' }>;
    assert.ok(Math.max(...xs) <= words.at[0], `${standard}: clear of the words`);
  }
});
