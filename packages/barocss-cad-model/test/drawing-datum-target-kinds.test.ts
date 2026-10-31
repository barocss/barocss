import test from 'node:test';
import assert from 'node:assert/strict';
import { checkDatumTargetOptions, datumTargetSizeText, readDatumTargets, datumTargetsProperty, type DrawingDatumTarget } from '../src/drawing/datumTargets';
import { validate, type JsonSchema } from '../src/chat/contract';
import { runDrawingTool, drawingInputs, DRAWING_TOOLS } from '../src/chat/drawing';
import { starterDoc, type StudioDoc } from '../src/engine/doc';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { defaultDrawing, readDrawing } from '../src/drawing/types';
import { drawingIssues, issueContext } from '../src/drawing/issues';
import { modelAnnotations } from '../src/drawing/annotations3d';
import { hatch, PENS, type Mark } from '../src/drawing/sheet';
import { sheetDxfDocument } from '../src/io/dxf';
import { sheetSvg } from '../src/io/svg';
import { reorient } from '../src/drawing/reorient';
import { brepsFor } from '../src/engine/evaluate';
import { projectViews } from '../src/drawing/project';
import { toSheet } from '../src/drawing/views';

const line: DrawingDatumTarget = { id: 't-line', letter: 'A', number: 1, view: 'front', place: [-14, 14], kind: 'line', line: { from: [10, 4], to: [50, 4] } };
const circle: DrawingDatumTarget = { id: 't-circle', letter: 'B', number: 1, view: 'front', place: [-14, -12], kind: 'area', area: { shape: 'circle', at: [20, 4], d: 6 } };
const rect: DrawingDatumTarget = { id: 't-rect', letter: 'B', number: 2, view: 'front', place: [76, -12], kind: 'area', area: { shape: 'rect', at: [48, 4], w: 8, h: 4 } };
const docOf = (rows: DrawingDatumTarget[]): StudioDoc => ({ ...starterDoc(), drawing: { ...defaultDrawing(), datumTargets: rows } });
const contextOf = (doc: StudioDoc) => { const input = drawingInputs(doc); if (typeof input === 'string') assert.fail(input); return { input, ctx: issueContext(input) }; };
const groupOf = (doc: StudioDoc, id: string) => { const { ctx } = contextOf(doc), g = ctx.sheet.groups.find(x => x.datumTarget && x.id === id); assert.ok(g, `${id} is on the sheet`); return { g, ctx }; };
const texts = (marks: readonly Mark[]) => marks.flatMap(m => m.kind === 'text' ? [m.text] : []);

test('datum target kinds: the stored shape is canonical and a point target keeps its old shape', () => {
  const point = { id: 'p', letter: 'C', number: 3, view: 'top' as const, place: [1, 2] as [number, number], point: { edge: 'e', at: 'end' as const, near: [0, 0, 0] as [number, number, number], endpoint: 'min' as const } };
  assert.deepEqual(Object.keys(readDatumTargets([point])[0]), ['id', 'letter', 'number', 'view', 'place', 'point']);
  assert.deepEqual(Object.keys(readDatumTargets([{ ...point, moveable: true }])[0]), ['id', 'letter', 'number', 'view', 'place', 'point', 'moveable']);
  assert.deepEqual(Object.keys(readDatumTargets([line])[0]), ['id', 'letter', 'number', 'view', 'place', 'kind', 'line']);
  assert.deepEqual(readDatumTargets([circle, rect, line]), [circle, rect, line]);
  assert.deepEqual(Object.keys((readDatumTargets([{ ...rect, area: { h: 4, w: 8, at: [48, 4], shape: 'rect' } }])[0] as { area: object }).area), ['shape', 'at', 'w', 'h'], 'w before h on read');
  assert.deepEqual(Object.keys((readDatumTargets([circle])[0] as { area: object }).area), ['shape', 'at', 'd']);
  assert.deepEqual(readDatumTargets([{ ...circle, area: { at: [20, 4], d: 6, shape: 'circle' } }])[0], circle, 'key order is read back in the canonical order');
  assert.deepEqual(readDatumTargets([{ ...point, kind: 'point' }])[0], point, 'kind point is not stored');
  assert.deepEqual(validate(datumTargetsProperty as JsonSchema, [line, circle, rect]), []);
  assert.equal(datumTargetSizeText(circle), 'Ø6');
  assert.equal(datumTargetSizeText(rect), '8×4');
  assert.equal(datumTargetSizeText(line), null);
});

test('datum target kinds: refusals say what is wrong, in plain words', () => {
  const refused = (row: unknown) => { const r = checkDatumTargetOptions({ datumTargets: [row] }); assert.equal(r[0]?.code, 'DRAWING_OPTIONS'); return r[0].message; };
  assert.match(refused({ ...line, letter: 'I' }), /A to Z without I, O and Q/);
  assert.match(refused({ ...line, letter: 'O' }), /without I, O and Q/);
  assert.match(refused({ ...line, number: 0 }), /1 to 99/);
  assert.match(refused({ ...line, number: 100 }), /1 to 99/);
  assert.match(refused({ ...line, line: { from: [3, 3], to: [3, 3] } }), /two distinct points/);
  assert.match(refused({ ...line, line: { from: [3, 3] } }), /line \{from\[2\], to\[2\]\}/);
  assert.match(refused({ ...circle, area: { shape: 'circle', at: [0, 0], d: 0 } }), /diameter d above zero/);
  assert.match(refused({ ...circle, area: { shape: 'circle', at: [0, 0], d: -2 } }), /above zero/);
  assert.match(refused({ ...rect, area: { shape: 'rect', at: [0, 0], w: 4, h: 0 } }), /width w and a height h above zero/);
  assert.match(refused({ ...rect, area: { shape: 'rect', at: [0, 0], w: 4 } }), /width w and a height h/);
  assert.match(refused({ ...circle, area: { shape: 'circle', at: [0, 0], d: 4, w: 2 } }), /no w or h/);
  assert.match(refused({ ...circle, area: { shape: 'oval', at: [0, 0], d: 4 } }), /circle or rect/);
  assert.match(refused({ ...line, kind: 'plane' }), /point, line or area/);
  assert.match(refused({ ...line, moveable: true }), /Only a point datum target can be moveable/);
  assert.match(refused({ ...circle, moveable: true }), /Only a point datum target can be moveable/);
  assert.match(refused({ ...line, area: circle.area }), /no area geometry/);
  assert.match(refused({ ...line, line: undefined, kind: 'line' }), /line \{from/);
  const twice = checkDatumTargetOptions({ datumTargets: [line, { ...circle, letter: 'A', number: 1 }] });
  assert.match(twice[0].message, /A1 is used twice/);
  assert.match(checkDatumTargetOptions({ datumTargets: [line, { ...circle, id: 't-line' }] })[0].message, /id t-line is used twice/);
  assert.deepEqual(checkDatumTargetOptions({ datumTargets: [line, circle, rect, { ...circle, id: 'other', number: 2, letter: 'A' }] }), []);
  // The same number under another letter is a different target.
  assert.deepEqual(checkDatumTargetOptions({ datumTargets: [line, { ...circle, letter: 'B' }] }), []);
});

test('datum target kinds: a target line is a phantom line in the direct view, its symbol is a split circle', () => {
  const { g, ctx } = groupOf(docOf([line]), line.id), v = ctx.layout.views.front;
  const A = toSheet(v, [10, 4]), B = toSheet(v, [50, 4]);
  const phantom = g.marks.filter(m => m.kind === 'line' && m.pen === 'phantom');
  assert.equal(phantom.length, 1);
  assert.deepEqual([phantom[0].kind === 'line' && phantom[0].a, phantom[0].kind === 'line' && phantom[0].b], [A, B]);
  assert.deepEqual(PENS.phantom.dash, [10, 1.5, 1.5, 1.5, 1.5, 1.5], 'a two-dot chain: long, two short, with gaps');
  const crosses = g.marks.filter(m => m.kind === 'line' && m.pen === 'thin' && m.role === 'leader' && Math.abs(Math.abs(m.b[0] - m.a[0]) - Math.abs(m.b[1] - m.a[1])) < 1e-9);
  assert.equal(crosses.length, 0, 'ASME: a target line is the phantom line itself, no X marks (the X is a point target’s)');
  assert.equal(g.marks.filter(m => m.kind === 'line' && m.pen === 'phantom').length, 1);
  // The structure: the phantom line, the leader, the split circle, its split line and the label.
  assert.deepEqual(g.marks.map(m => m.kind === 'line' ? `line:${m.pen}:${m.role}` : m.kind), ['line:phantom:leader', 'line:thin:leader', 'arc', 'line:thin:frame', 'text']);
  const circles = g.marks.filter(m => m.kind === 'arc' && m.t1 - m.t0 === 2 * Math.PI && m.pen === 'thin');
  assert.equal(circles.length, 1);
  const split = g.marks.find(m => m.kind === 'line' && m.role === 'frame');
  assert.ok(split && split.kind === 'line' && split.a[1] === split.b[1], 'a horizontal split line');
  assert.deepEqual(texts(g.marks), ['A1'], 'the lower half holds the letter and number, the upper half is empty for a line');
  assert.ok(!g.marks.some(m => m.kind === 'hatch'));
  // The leader runs from the circle to the middle of the line.
  const leader = g.marks.find(m => m.kind === 'line' && m.pen === 'thin' && m.role === 'leader' && m.b[0] === (A[0] + B[0]) / 2);
  assert.ok(leader, 'the leader ends on the target line');
  assert.ok(!drawingIssues(ctx).some(i => i.code.startsWith('DATUM_TARGET_')));
});

test('datum target kinds: an area is a hatched phantom outline, the size sits in the symbol’s upper half, the leader ends in a dot', () => {
  for (const [row, size] of [[circle, 'Ø6'], [rect, '8×4']] as const) {
    const { g, ctx } = groupOf(docOf([row]), row.id), v = ctx.layout.views.front;
    assert.deepEqual(texts(g.marks), [`${row.letter}${row.number}`, size], 'the label first, then the size');
    const split = g.marks.find(m => m.kind === 'line' && m.role === 'frame');
    assert.ok(split && split.kind === 'line');
    const [label, upper] = g.marks.filter((m): m is Extract<Mark, { kind: 'text' }> => m.kind === 'text');
    assert.ok(label.at[1] > split.a[1] && upper.at[1] < split.a[1], 'the label under the split line, the size over it');
    const h = g.marks.find((m): m is Extract<Mark, { kind: 'hatch' }> => m.kind === 'hatch');
    assert.ok(h && h.angle === 45 && h.spacing === 1 && h.pen === 'thin', 'hatch 1 mm apart');
    const dot = g.marks.find(m => m.kind === 'fill' && m.head?.style === 'dot');
    assert.ok(dot && dot.kind === 'fill' && !g.marks.some(m => m.kind === 'fill' && m.head && m.head.style !== 'dot'), 'a dot, never an arrowhead');
    const centre = toSheet(v, row.kind === 'area' ? row.area.at : [0, 0]);
    assert.deepEqual(dot.kind === 'fill' && dot.head?.tip, centre);
    // The hatch lines stay inside the area.
    const lines = hatch(h.rings, h.spacing, h.angle);
    assert.ok(lines.length >= 3);
    const gap = Math.abs(((lines[1].a[1] - lines[0].a[1]) - (lines[1].a[0] - lines[0].a[0])) / Math.SQRT2);
    assert.ok(Math.abs(gap - 1) < 1e-9, 'adjacent hatch lines are 1 mm apart across');
    const [x0, x1, y0, y1] = row.kind === 'area' && row.area.shape === 'circle'
      ? [centre[0] - row.area.d / 2 * v.scale, centre[0] + row.area.d / 2 * v.scale, centre[1] - row.area.d / 2 * v.scale, centre[1] + row.area.d / 2 * v.scale]
      : [centre[0] - 4 * v.scale, centre[0] + 4 * v.scale, centre[1] - 2 * v.scale, centre[1] + 2 * v.scale];
    for (const l of lines) for (const p of [l.a, l.b]) assert.ok(p[0] >= x0 - 1e-6 && p[0] <= x1 + 1e-6 && p[1] >= y0 - 1e-6 && p[1] <= y1 + 1e-6, 'inside the outline box');
    for (const l of lines) assert.ok(Math.abs(Math.abs(l.b[0] - l.a[0]) - Math.abs(l.b[1] - l.a[1])) < 1e-6, 'at 45°');
    const outline = g.marks.find(m => (m.kind === 'arc' || m.kind === 'polyline') && m.pen === 'phantom');
    assert.ok(outline, 'a phantom outline');
    if (row.kind === 'area' && row.area.shape === 'circle') assert.ok(outline.kind === 'arc' && outline.u[0] === row.area.d / 2 * v.scale, 'the circle is d across at the view scale');
    else assert.ok(outline.kind === 'polyline' && outline.points.length === 5 && Math.abs(Math.abs(outline.points[1][0] - outline.points[0][0]) - 8 * v.scale) < 1e-9);
    assert.ok(!drawingIssues(ctx).some(i => i.code.startsWith('DATUM_TARGET_')));
  }
});

test('datum target kinds: the moveable symbol is the circle drawn out to a point by two tangent lines, facing away from the leader', async () => {
  const doc = starterDoc(), { input } = contextOf(doc);
  const edge = input.views.front.edges.find(e => e.kind === 'line' && e.circle === null && e.ends?.some(p => p.every(v => v === 0)) && e.ends.some(p => p[0] === 64 && p[1] === 0 && p[2] === 0))!;
  const base = { id: 'p1', letter: 'A', number: 2, view: 'front' as const, place: [-12, 16] as [number, number], point: { edge: edge.name, at: 'end' as const, endpoint: 'min' as const, near: [1, 0, 0] as [number, number, number] } };
  const rows = [base, { ...base, id: 'p2', number: 3, moveable: true as const }, { ...base, id: 'p3', number: 4, moveable: true as const, place: [30, -30] as [number, number] }, { ...base, id: 'p4', number: 5, moveable: true as const, place: [-30, 2] as [number, number] }];
  const applied = runDrawingTool(doc, 'set_drawing', { datumTargets: rows });
  if ('error' in applied) assert.fail(applied.error);
  const result = (await import('../src/engine/evaluate')).evaluatePart(applied.doc, 1);
  assert.ok(result.ok);
  const { captureSignatures } = await import('../src/engine/references');
  const signed = captureSignatures(applied.doc, result.bodies);
  const plain = groupOf(signed, 'p1').g;
  assert.equal(plain.marks.filter(m => m.kind === 'polyline').length, 0, 'no separate triangle anywhere');
  assert.equal(plain.marks.filter(m => m.kind === 'arc' && m.t1 - m.t0 === 2 * Math.PI).length, 1, 'a plain point target has the whole circle');
  for (const id of ['p2', 'p3', 'p4']) {
    const g = groupOf(signed, id).g;
    assert.equal(g.marks.filter(m => m.kind === 'polyline').length, 0);
    const arc = g.marks.find((m): m is Extract<Mark, { kind: 'arc' }> => m.kind === 'arc');
    assert.ok(arc && arc.t1 - arc.t0 < 2 * Math.PI, 'the circle is open where the point leaves it');
    const C = arc.center, r = arc.u[0];
    const frame = g.marks.filter((m): m is Extract<Mark, { kind: 'line' }> => m.kind === 'line' && m.role === 'frame' && m.a[1] !== m.b[1] || m.kind === 'line' && m.role === 'frame' && Math.abs(m.a[1] - C[1]) > 1e-9);
    const tangents = frame.filter(m => Math.abs(m.a[1] - m.b[1]) > 1e-9 || Math.abs(m.a[1] - C[1]) > 1e-9);
    assert.equal(tangents.length, 2, 'two tangent lines (the split line is the third frame line)');
    assert.ok(tangents[0].b[0] === tangents[1].b[0] && tangents[0].b[1] === tangents[1].b[1], 'they meet at the point');
    const apex = tangents[0].b;
    for (const t of tangents) {
      const dx = t.b[0] - t.a[0], dy = t.b[1] - t.a[1], dist = Math.abs(dx * (C[1] - t.a[1]) - dy * (C[0] - t.a[0])) / Math.hypot(dx, dy);
      assert.ok(Math.abs(dist - r) < 1e-3, `tangent to the circle (${dist} against ${r})`);
      assert.ok(Math.abs(Math.hypot(t.a[0] - C[0], t.a[1] - C[1]) - r) < 1e-3, 'touching it at its other end');
    }
    assert.ok(Math.abs(Math.hypot(apex[0] - C[0], apex[1] - C[1]) - 2 * r) < 1e-3, 'the point is 2r from the centre: a 60° point');
    const leader = g.marks.find((m): m is Extract<Mark, { kind: 'line' }> => m.kind === 'line' && m.role === 'leader' && m.pen === 'thin' && Math.abs(Math.hypot(m.a[0] - C[0], m.a[1] - C[1]) - r) < 1e-6);
    assert.ok(leader, 'the leader leaves the circle');
    const out = [leader.b[0] - C[0], leader.b[1] - C[1]], tip = [apex[0] - C[0], apex[1] - C[1]];
    assert.ok(out[0] * tip[0] + out[1] * tip[1] < 0, 'the point faces away from the leader, so the leader never crosses it');
    // The leader's straight run touches neither tangent line (it stays on its own side of the circle).
    for (const t of tangents) assert.ok(!(Math.abs(leader.a[0] - t.b[0]) < 1e-9 && Math.abs(leader.a[1] - t.b[1]) < 1e-9));
  }
  assert.equal(groupOf(signed, 'p2').g.marks.length, plain.marks.length + 2, 'the open arc and the two tangents replace the whole circle');
});

test('datum target kinds: DXF and 3D agree with the sheet; Save and Open keep the rows', async () => {
  const rows = [line, circle, rect];
  const doc = docOf(rows), { input, ctx } = contextOf(doc);
  const dxf = sheetDxfDocument(ctx.sheet, ctx.layout);
  const layers = (type: string, layer: string) => dxf.entities.filter(e => e.type === type && 'layer' in e && e.layer === layer).length;
  assert.ok(dxf.layers!.some(l => l.name === 'PHANTOM' && l.linetype === 'BC_PHANTOM') && dxf.linetypes!.some(l => l.name === 'BC_PHANTOM'));
  assert.equal(layers('line', 'PHANTOM'), 1, 'the target line');
  assert.equal(layers('circle', 'PHANTOM'), 1, 'the circular area');
  assert.equal(layers('lwpolyline', 'PHANTOM'), 1, 'the rectangular area');
  assert.equal(dxf.entities.filter(e => e.type === 'hatch' && e.layer === 'HATCH').length, 2, 'one hatch per area');
  const svg = sheetSvg(ctx.sheet, 'Targets');
  assert.match(svg, /stroke-dasharray="10 1.5 1.5 1.5 1.5 1.5"/);
  assert.match(svg, />Ø6<\/text>/); assert.match(svg, />8×4<\/text>/);
  const pmi = modelAnnotations({ ...input, layout: ctx.layout, sheet: ctx.sheet });
  for (const row of rows) {
    const g = ctx.sheet.groups.find(x => x.datumTarget && x.id === row.id)!, item = pmi.items.find(a => a.id === row.id);
    assert.ok(item, `${row.id} is on the model`);
    assert.deepEqual(item.text, texts(g.marks), 'the 3D texts equal the sheet’s');
    assert.equal(item.datum?.targetKind, row.kind);
    assert.equal(item.datum?.letter, row.letter);
    assert.equal(item.datum?.targetNumber, row.number);
    assert.equal(item.targets.length, 1);
    assert.equal(item.targets[0].edge, undefined);
  }
  assert.deepEqual(pmi.items.find(a => a.id === circle.id)?.datum?.targetArea, circle.kind === 'area' && circle.area);
  assert.deepEqual(pmi.items.find(a => a.id === rect.id)?.datum?.targetArea, rect.kind === 'area' && rect.area);
  assert.ok(pmi.items.find(a => a.id === circle.id)!.lines.length > 4, 'the hatch lines are lifted');
  assert.equal(pmi.items.find(a => a.id === circle.id)!.arcs.length, 2, 'the phantom circle and the symbol');
  assert.equal(pmi.items.find(a => a.id === line.id)?.datum?.moveable, undefined);
  assert.equal(pmi.left.filter(l => rows.some(r => r.id === l.id)).length, 0);
  // The front-most depth is the plane the annotation lies in: the starter part is 64 × 32 × 8, its front face at y = 0.
  assert.equal(pmi.items.find(a => a.id === line.id)!.plane.depth, Math.max(...input.views.front.edges.flatMap(e => (e.ends ?? []).map(p => p[0] * input.views.front.toward[0] + p[1] * input.views.front.toward[1] + p[2] * input.views.front.toward[2]))));
  // Save, Open and the reader: the authored rows equal their reopened form as JSON.
  const authored = readDrawing(doc.drawing);
  const reopened = await readStudioFile(encodeStudioFile({ ...doc, drawing: authored }));
  assert.ok('doc' in reopened);
  assert.equal(JSON.stringify(reopened.doc.drawing?.datumTargets), JSON.stringify(authored.datumTargets));
  assert.equal(JSON.stringify(readDrawing(reopened.doc.drawing)), JSON.stringify(authored));
  assert.deepEqual(reopened.doc.drawing?.datumTargets, rows);
});

test('datum target kinds: drawing.set takes the new kinds and refuses a bad row without changing the drawing', () => {
  const doc = starterDoc(), before = JSON.stringify(doc);
  const ok = runDrawingTool(doc, 'set_drawing', { datumTargets: [line, circle, rect] });
  if ('error' in ok) assert.fail(ok.error);
  assert.deepEqual(ok.doc.drawing?.datumTargets, [line, circle, rect]);
  const bad = runDrawingTool(doc, 'set_drawing', { datumTargets: [line, { ...circle, area: { shape: 'circle', at: [0, 0], d: 0 } }] });
  assert.ok('error' in bad && bad.error.includes('DRAWING_OPTIONS') && bad.error.includes('datumTargets[1]'));
  assert.equal(JSON.stringify(doc), before);
});

test('datum target kinds: a datum letter held by line or area targets counts for DATUM_UNDEFINED', () => {
  const frame = { id: 'f1', view: 'front' as const, place: [0, -20] as [number, number], characteristic: 'position' as const, value: 0.1, datums: ['A', 'B', 'C'] };
  const base = docOf([line, circle]), doc: StudioDoc = { ...base, drawing: { ...base.drawing!, frames: [frame] } };
  const undefinedFor = (d: StudioDoc) => drawingIssues(contextOf(d).ctx).filter(i => i.code === 'DATUM_UNDEFINED').map(i => i.message);
  const messages = undefinedFor(doc);
  assert.equal(messages.length, 1);
  assert.match(messages[0], /refers to datum C, which/, 'A (a line) and B (an area) are known; only C is missing');
  const withC = { ...doc, drawing: { ...doc.drawing!, datumTargets: [...doc.drawing!.datumTargets!, { ...rect, id: 't-c', letter: 'C', number: 1 }] } };
  assert.deepEqual(undefinedFor(withC), []);
});

test('datum target kinds: reorienting carries a line’s ends and an area’s centre and size with its view', () => {
  const doc = starterDoc(), views = (o?: 'x+') => { const b = brepsFor(doc); assert.ok('breps' in b); const r = projectViews(b.breps, b.prefixes, o ? { orientation: o } : {}); assert.ok(r.ok); return r.views; };
  const was = views(), now = views('x+');
  const settings = { ...defaultDrawing(), datumTargets: [line, circle, { ...rect, view: 'top' as const }] };
  const r = reorient(was, now, settings, 'x+');
  assert.ok(r.ok, JSON.stringify(r));
  if (!r.ok) return;
  const [l, c, t] = r.settings.datumTargets! as [typeof line & { kind: 'line' }, typeof circle & { kind: 'area' }, typeof rect & { kind: 'area' }];
  assert.equal(l.kind, 'line'); assert.equal(c.kind, 'area'); assert.equal(t.kind, 'area');
  const into = (target: DrawingDatumTarget, p: [number, number], from: 'front' | 'top') => {
    const q = [0, 1, 2].map(k => p[0] * was[from].right[k] + p[1] * was[from].up[k]), v = target.view as 'front' | 'top' | 'right';
    return [q.reduce((a, x, k) => a + x * now[v].right[k], 0), q.reduce((a, x, k) => a + x * now[v].up[k], 0)];
  };
  const near = (a: number[], b: number[]) => a.every((x, k) => Math.abs(x - b[k]) < 1e-9);
  assert.ok(near(l.line.from, into(l, [10, 4], 'front')) && near(l.line.to, into(l, [50, 4], 'front')), 'the line’s ends turn as the symbol’s place does');
  assert.ok(near(c.area.at, into(c, [20, 4], 'front')) && c.area.shape === 'circle' && c.area.d === 6);
  assert.ok(near(t.area.at, into(t, [48, 4], 'top')));
  const swaps = Math.abs(was.top.right.reduce((a, x, k) => a + x * now[t.view as 'top'].right[k], 0)) < 0.5;
  assert.ok(t.area.shape === 'rect' && (swaps ? t.area.w === 4 && t.area.h === 8 : t.area.w === 8 && t.area.h === 4), 'a rectangle’s width and height follow the axes');
});

test('datum target kinds: a line or area that no longer lies on the part is warned about, by target', () => {
  const doc = docOf([line, circle, rect]);
  assert.deepEqual(drawingIssues(contextOf(doc).ctx).filter(i => i.code === 'DATUM_TARGET_OUTSIDE'), [], 'all three lie on the 64 × 8 front view');
  const reach = { ...circle, area: { shape: 'circle' as const, at: [38, 4] as [number, number], d: 6 } } as DrawingDatumTarget;
  const rows = [line, reach, rect, { ...rect, id: 't-in', number: 3, area: { shape: 'rect', at: [20, 4], w: 8, h: 4 } } as DrawingDatumTarget];
  const narrow = (d: StudioDoc): StudioDoc => ({ ...d, nodes: d.nodes.map((node, index): StudioDoc['nodes'][number] => index === 0 && node.kind === 'sketch' && node.profile === 'rectangle' ? { ...node, max: [40, 32] } : node) });
  const { input, ctx } = contextOf(narrow(docOf(rows)));
  assert.equal(input.views.front.max[0], 40, 'the part is now 40 wide in the front view');
  const outside = drawingIssues(ctx).filter(i => i.code === 'DATUM_TARGET_OUTSIDE');
  assert.deepEqual(outside.map(i => i.datumTargets![0]).sort(), ['t-circle', 't-line', 't-rect'], 'the one fully inside (t-in) is not named');
  assert.ok(outside.every(i => i.severity === 'warning' && i.view === 'front'));
  assert.match(outside.find(i => i.datumTargets![0] === 't-line')!.message, /Datum target A1: its line lies partly outside the part in the front view/);
  assert.match(outside.find(i => i.datumTargets![0] === 't-circle')!.message, /Datum target B1: its area lies partly outside/, 'an area reaching past the edge by part of its size');
  assert.match(outside.find(i => i.datumTargets![0] === 't-rect')!.message, /Datum target B2: its area lies partly outside/);
});

test('datum target kinds: the JSON schema is per kind and as strict as the checker', () => {
  const ok = (row: unknown) => validate(datumTargetsProperty as JsonSchema, [row]);
  const target = { id: 'x', letter: 'A', number: 1, view: 'front', place: [0, 0] };
  assert.deepEqual(ok(line), []); assert.deepEqual(ok(circle), []); assert.deepEqual(ok(rect), []);
  assert.notDeepEqual(ok({ ...circle, area: { shape: 'circle', at: [0, 0] } }), [], 'a circle needs d');
  assert.notDeepEqual(ok({ ...rect, area: { shape: 'rect', at: [0, 0], w: 4 } }), [], 'a rectangle needs w and h');
  assert.notDeepEqual(ok({ ...circle, area: { shape: 'circle', at: [0, 0], d: 100001 } }), [], 'd is at most 100000');
  assert.deepEqual(ok({ ...circle, area: { shape: 'circle', at: [0, 0], d: 100000 } }), []);
  assert.notDeepEqual(ok({ ...circle, area: { shape: 'circle', at: [0, 0], d: 0 } }), [], 'd is above zero');
  assert.notDeepEqual(ok({ ...target, kind: 'line' }), [], 'kind line needs line');
  assert.notDeepEqual(ok({ ...target, kind: 'area' }), [], 'kind area needs area');
  assert.notDeepEqual(ok(target), [], 'a point target needs point');
  assert.notDeepEqual(ok({ ...line, number: 100 }), [], 'number is at most 99');
  assert.notDeepEqual(ok({ ...line, kind: 'area' }), [], 'a line row is not an area row');
  for (const row of [line, circle, rect, { ...circle, area: { shape: 'circle', at: [0, 0], d: 100001 } }, { ...line, number: 100 }])
    assert.equal(ok(row).length === 0, checkDatumTargetOptions({ datumTargets: [row] }).length === 0, 'schema and checker agree');
});

test('datum target kinds: a sheet at another scale draws the area at that scale; DXF declares PHANTOM only when used', () => {
  const base = docOf([circle, rect]), half: StudioDoc = { ...base, drawing: { ...base.drawing!, scale: 0.5 } };
  const { ctx } = contextOf(half), v = ctx.layout.views.front;
  assert.equal(v.scale, 0.5);
  const c = groupOf(half, circle.id).g.marks.find((m): m is Extract<Mark, { kind: 'arc' }> => m.kind === 'arc' && m.pen === 'phantom')!;
  assert.equal(c.u[0], 1.5, 'Ø6 at 1:2 is 3 mm across on the paper');
  const r = groupOf(half, rect.id).g.marks.find((m): m is Extract<Mark, { kind: 'polyline' }> => m.kind === 'polyline' && m.pen === 'phantom')!;
  assert.ok(Math.abs(Math.abs(r.points[1][0] - r.points[0][0]) - 4) < 1e-9 && Math.abs(Math.abs(r.points[2][1] - r.points[1][1]) - 2) < 1e-9, '8 × 4 at 1:2 is 4 × 2 mm');
  const plain = contextOf(starterDoc()).ctx, dxf = sheetDxfDocument(plain.sheet, plain.layout);
  assert.ok(!dxf.layers!.some(l => l.name === 'PHANTOM') && !dxf.linetypes!.some(l => l.name === 'BC_PHANTOM'), 'a sheet with no phantom line declares neither');
});

test('datum target kinds: a line or area in the top view lies in the plane at the part’s front-most depth', () => {
  const top = { ...line, id: 't-top', view: 'top' as const, line: { from: [10, 10] as [number, number], to: [50, 10] as [number, number] } };
  const doc = docOf([top]), { input, ctx } = contextOf(doc);
  const pmi = modelAnnotations({ ...input, layout: ctx.layout, sheet: ctx.sheet }), item = pmi.items.find(a => a.id === 't-top')!;
  assert.ok(item);
  assert.deepEqual(input.views.top.toward, [0, 0, 1]);
  assert.equal(item.plane.depth, 8, 'the 8 mm tall part’s top face');
  assert.equal(item.targets[0].at[2], 8);
  assert.ok(item.lines.every(l => l.a[2] === 8 && l.b[2] === 8), 'every line of the annotation lies in that plane');
});

test('datum target kinds: reference capture, verification and refresh pass line and area rows through untouched', async () => {
  const { captureSignatures, verifyReferences, referencesOf } = await import('../src/engine/references');
  const { evaluatePart } = await import('../src/engine/evaluate');
  const doc = docOf([line, circle, rect]), evaluated = evaluatePart(doc, 1);
  assert.ok(evaluated.ok);
  const noEvaluate = async () => { throw new Error('not needed'); }, noTables = () => null;
  assert.equal(referencesOf(doc).refs.filter(r => r.datumTarget).length, 0, 'no reference is made for a row with no edge');
  const captured = captureSignatures(doc, evaluated.bodies);
  assert.deepEqual(captured.drawing?.datumTargets, [line, circle, rect]);
  const checked = await verifyReferences(captured, evaluated.bodies, noEvaluate as never, noTables as never);
  assert.deepEqual(checked.problems, []); assert.deepEqual(checked.changes, []);
  assert.deepEqual(checked.doc.drawing?.datumTargets, [line, circle, rect]);
  const copy = referencesOf(doc).doc.drawing?.datumTargets;
  assert.deepEqual(copy, [line, circle, rect]);
  assert.notEqual(copy![0], doc.drawing!.datumTargets![0], 'the working copy is a copy');
});

test('validate: const, not and oneOf agree with the tools’ own schemas (no false "matches 2")', () => {
  const schema = DRAWING_TOOLS.find(t => t.name === 'set_drawing')!.input_schema as JsonSchema;
  assert.deepEqual(validate(schema, { scope: { kind: 'assembly' } }), []);
  assert.deepEqual(validate(schema, { scope: { kind: 'part' } }), []);
  assert.deepEqual(validate(schema, { scope: { kind: 'part', part: 'inst' } }), []);
  assert.notDeepEqual(validate(schema, { scope: { kind: 'bogus' } }), []);
  assert.notDeepEqual(validate(schema, { scope: { kind: 'assembly', part: 'x' } }), [], 'an assembly has no part');
  assert.deepEqual(validate({ const: 3 }, 3), []); assert.notDeepEqual(validate({ const: 3 }, 4), []);
  assert.deepEqual(validate({ properties: { a: { not: { enum: [1] } } } }, { a: 2 }), []);
  assert.notDeepEqual(validate({ properties: { a: { not: { enum: [1] } } } }, { a: 1 }), []);
  // A form using a keyword the validator ignores (pattern) never gives a false count: the oneOf is left to the checker.
  assert.deepEqual(validate({ oneOf: [{ pattern: '^a' }, { pattern: '^b' }] }, 'a'), []);
});

test('datum target kinds: a sideways moveable point keeps the split line inside the outline; DXF arc angles stay in 0 to 360', async () => {
  const doc = starterDoc(), { input } = contextOf(doc);
  const edge = input.views.front.edges.find(e => e.kind === 'line' && e.circle === null && e.ends?.some(p => p.every(v => v === 0)) && e.ends.some(p => p[0] === 64 && p[1] === 0 && p[2] === 0))!;
  const base = { id: 'q1', letter: 'A', number: 1, view: 'front' as const, place: [-40, 4] as [number, number], moveable: true as const, point: { edge: edge.name, at: 'end' as const, endpoint: 'min' as const, near: [1, 0, 0] as [number, number, number] } };
  const applied = runDrawingTool(doc, 'set_drawing', { datumTargets: [base, { ...base, id: 'q2', number: 2, place: [120, 4] }] });
  if ('error' in applied) assert.fail(applied.error);
  const result = (await import('../src/engine/evaluate')).evaluatePart(applied.doc, 1);
  assert.ok(result.ok);
  const signed = (await import('../src/engine/references')).captureSignatures(applied.doc, result.bodies);
  for (const id of ['q1', 'q2']) {
    const { g, ctx } = groupOf(signed, id);
    const arc = g.marks.find((m): m is Extract<Mark, { kind: 'arc' }> => m.kind === 'arc')!, C = arc.center, r = arc.u[0];
    const tangents = g.marks.filter((m): m is Extract<Mark, { kind: 'line' }> => m.kind === 'line' && m.role === 'frame' && Math.abs(m.a[1] - m.b[1]) > 1e-9);
    const split = g.marks.find((m): m is Extract<Mark, { kind: 'line' }> => m.kind === 'line' && m.role === 'frame' && Math.abs(m.a[1] - m.b[1]) < 1e-9)!;
    // Each end of the split line is on the circle, or on a tangent line (never in the open mouth of the outline).
    for (const x of [split.a[0], split.b[0]]) {
      const onCircle = Math.abs(Math.abs(x - C[0]) - r) < 1e-6;
      const onTangent = tangents.some(t => Math.abs(t.a[0] + (C[1] - t.a[1]) / (t.b[1] - t.a[1]) * (t.b[0] - t.a[0]) - x) < 1e-6);
      assert.ok(onCircle || onTangent, `${id}: split line end ${x} is on the outline`);
    }
    assert.ok(split.b[0] - split.a[0] > 2 * r + 1e-6, 'it runs on past the circle to the tangent lines at the open end');
    const dxf = sheetDxfDocument({ ...ctx.sheet, groups: ctx.sheet.groups.filter(x => x.datumTarget && x.id === id) }, ctx.layout);
    assert.ok(dxf.entities.some(e => e.type === 'arc'), 'the open circle is an ARC');
    for (const e of dxf.entities) if (e.type === 'arc') assert.ok(e.start >= 0 && e.start <= 360 && e.end >= 0 && e.end <= 360, `arc ${e.start}..${e.end}`);
  }
});
