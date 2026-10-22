import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { drawingInputs } from '../src/chat/drawing';
import { autoLayout } from '../src/drawing/layout';
import { acceptAll } from '../src/drawing/tolerance';
import { issueContext } from '../src/drawing/issues';
import { placementOf, type Mark, type MarkGroup } from '../src/drawing/sheet';
import { readDrawing, type DrawingSettings, type XY } from '../src/drawing/types';
import { toSheet, type ViewPlacement } from '../src/drawing/views';
import { MODEL_ANNOTATIONS_VERSION, frameGlyph, modelAnnotations, weldGlyph, type ModelAnnotation } from '../src/drawing/annotations3d';

// G24's data side: the drawing's annotations on the model equal the sheet's. For a geometrically toleranced plate (datums
// A, B, C, a position frame, a fit) and the welded table's weld symbols, every 3D point of an item — its lines' ends, its
// arcs' centres, its heads' tips, its texts' baselines — mapped back through its view's plane and placement is the sheet
// mark's point (1e-9); it lies in its plane; text and height (× the scale) are the sheet's; lines keep their roles,
// heads their sizes; ids are the sheet items'. The glyph builders in plane coordinates give the sheet's own marks back.
const root = resolve(import.meta.dirname, '..');
const geometric = () => {
  const c = JSON.parse(readFileSync(resolve(root, '../../packages/barocss-cad/conformance/r14/tol-plate-geometric/case.json'), 'utf8')) as { input: { document: StudioDoc; drawing: unknown } };
  const doc = { ...emptyDoc(), ...c.input.document } as StudioDoc, i = drawingInputs(doc, { ...readDrawing(c.input.drawing), sheet: 'A3' });
  assert.ok(typeof i !== 'string', String(i));
  const meta = { ...i.meta, date: '2026-10-22' }, auto = autoLayout({ ...i, meta }).settings, tol = acceptAll({ ...i, meta, settings: auto }).settings;
  // (A fit on the hole's diameter, as a person sets it.)
  const settings: DrawingSettings = { ...tol, dimensions: tol.dimensions.map(d => d.kind === 'diameter' ? { ...d, tol: { kind: 'fit', code: 'H7' } } : d) };
  return { i: { ...i, meta }, settings };
};
const project = (a: ModelAnnotation, p: readonly number[]): XY => [p[0] * a.plane.right[0] + p[1] * a.plane.right[1] + p[2] * a.plane.right[2], p[0] * a.plane.up[0] + p[1] * a.plane.up[1] + p[2] * a.plane.up[2]];
const near = (a: readonly number[], b: readonly number[], tol = 1e-9) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tol;
/** Every sheet point of a group's marks, in mark order, and the item's 3D points back on the sheet in the same order. */
function sameAsSheet(a: ModelAnnotation, g: MarkGroup, v: ViewPlacement) {
  const S = (p: readonly number[]) => toSheet(v, project(a, p)), inPlane = (p: readonly number[]) => Math.abs(p[0] * a.plane.normal[0] + p[1] * a.plane.normal[1] + p[2] * a.plane.normal[2] - a.plane.depth) < 1e-9;
  let li = 0, ai = 0, hi = 0, ti = 0;
  for (const m of g.marks) {
    if (m.kind === 'line') { const l = a.lines[li++]; assert.ok(near(S(l.a), m.a) && near(S(l.b), m.b) && inPlane(l.a) && inPlane(l.b), `${a.id} line`); if (m.role) assert.equal(l.role, m.role); }
    else if (m.kind === 'polyline') for (let k = 1; k < m.points.length; k++) { const l = a.lines[li++]; assert.ok(near(S(l.a), m.points[k - 1]) && near(S(l.b), m.points[k]), `${a.id} polyline`); }
    else if (m.kind === 'arc') { const c = a.arcs[ai++]; assert.ok(near(S(c.center), m.center) && inPlane(c.center), `${a.id} arc`); assert.ok(Math.abs(Math.hypot(...c.u) * v.scale - Math.hypot(...m.u)) < 1e-9); }
    else if (m.kind === 'fill' && m.head) { const h = a.arrows[hi++]; assert.ok(near(S(h.tip), m.head.tip) && Math.abs(h.length * v.scale - m.head.length) < 1e-9 && Math.abs(h.width * v.scale - m.head.width) < 1e-9 && h.style === m.head.style, `${a.id} head`); }
    else if (m.kind === 'text') { const t = a.texts[ti++]; assert.ok(near(S(t.at), m.at) && t.text === m.text && Math.abs(t.height * v.scale - m.size) < 1e-9 && t.align === m.anchor && inPlane(t.at), `${a.id} text ${m.text}`); }
  }
  assert.deepEqual([li, ai, hi, ti], [a.lines.length, a.arcs.length, a.arrows.length, a.texts.length], `${a.id}: every mark, none more`);
}

test('G24: the geometrically toleranced plate — every dimension, datum and frame lifted onto the model equals the sheet (points 1e-9, in its plane; text, height, roles, heads); ids the sheet\'s; the frame\'s cells and box; the fit\'s text', () => {
  const { i, settings } = geometric(), ctx = issueContext({ ...i, settings });
  const out = modelAnnotations({ views: i.views, layout: ctx.layout, settings, sheet: ctx.sheet });
  assert.equal(out.version, MODEL_ANNOTATIONS_VERSION);
  const kinds = out.items.map(a => a.kind);
  assert.ok(kinds.includes('dimension') && kinds.filter(k => k === 'datum').length === 3 && kinds.includes('frame'), JSON.stringify(kinds));
  for (const a of out.items) {
    const g = ctx.sheet.groups.find(x => x.id === a.id && x.role === (a.kind === 'frame' ? 'control' : a.kind))!;
    assert.ok(g, `${a.id}: a sheet item of its id`);
    sameAsSheet(a, g, placementOf(ctx.layout, ctx.sheet, a.from)!);
    assert.ok(a.targets.length && a.targets.every(t => t.edge), `${a.id}: its targets by name`);
  }
  // (Roles: a linear dimension's extension and dimension lines; a frame's lines; heads filled, a datum's triangle too.)
  const lin = out.items.find(a => a.dimension?.measure === 'linear')!;
  assert.ok(lin.lines.some(l => l.role === 'extension') && lin.lines.some(l => l.role === 'dimension') && lin.arrows.every(h => h.style === 'filled'));
  const fr = out.items.find(a => a.kind === 'frame')!, f = settings.frames!.find(x => x.id === fr.id)!;
  assert.deepEqual(fr.frame!.cells.map(c => c.text), ['⌖', `Ø${f.value}`, ...f.datums]);
  assert.ok(fr.lines.every(l => l.role === 'frame'));
  const [u0, v0, u1, v1] = fr.frame!.box; assert.ok(u1 > u0 && v1 > v0);
  const dia = out.items.find(a => a.dimension?.measure === 'diameter')!;
  assert.ok(dia.dimension!.tol?.kind === 'fit' && dia.text.join(' ').includes('H7'), dia.text.join(' | '));
  // (The frame's glyph in plane coordinates: the sheet's frame marks back, through the builder the GPU lane calls.)
  const dimText = out.items.find(a => a.id === f.dim)!.texts[0], v = placementOf(ctx.layout, ctx.sheet, fr.from)!;
  const under = { at: project(fr, dimText.at), text: dimText.text, height: dimText.height, align: dimText.align };
  // (Plane coordinates are the view's: the glyph built there is placed as the sheet places that view.)
  const glyph = frameGlyph(f, under, v.scale);
  const sheetFrame = ctx.sheet.groups.find(x => x.role === 'control' && x.id === f.id)!.marks;
  assert.equal(glyph.length, sheetFrame.length);
  glyph.forEach((m, k) => { const s = sheetFrame[k] as Mark; if (m.kind === 'line' && s.kind === 'line') assert.ok(near(toSheet(v, m.a), s.a) && near(toSheet(v, m.b), s.b)); if (m.kind === 'text' && s.kind === 'text') assert.ok(near(toSheet(v, m.at), s.at) && m.text === s.text); });
});

test('G24: the welded table\'s weld symbols on the model equal the sheet\'s; each targets its seam edge by name; its data; the weld glyph in plane coordinates gives the sheet\'s symbol back', async () => {
  const { calls } = JSON.parse(readFileSync(join(root, 'test/fixtures/frame-welded-table.calls.json'), 'utf8')) as { calls: { tool: string; args: Record<string, unknown> }[] };
  let state: ChatState = { doc: emptyDoc(), bodies: [] };
  for (const c of calls.slice(0, 1)) { const r = await dispatchTool(state, c.tool, c.args, async d => evaluatePart(d, 1)); assert.ok(!r.isError, r.content); state = r.state; }
  const i = drawingInputs(state.doc, { ...readDrawing(state.doc.drawing), sheet: 'A3', weldSymbols: true }); assert.ok(typeof i !== 'string');
  const meta = { ...i.meta, date: '2026-10-22' }, ctx = issueContext({ ...i, meta });
  const out = modelAnnotations({ views: i.views, layout: ctx.layout, settings: i.settings, sheet: ctx.sheet, ...(meta.welds ? { welds: meta.welds } : {}) });
  const welds = out.items.filter(a => a.kind === 'weld');
  assert.equal(welds.length, ctx.sheet.welds!.placed.length);
  for (const a of welds) {
    const g = ctx.sheet.groups.find(x => x.role === 'weld' && x.id === a.id)!, v = placementOf(ctx.layout, ctx.sheet, a.from)!, p = ctx.sheet.welds!.placed.find(x => x.label === a.id)!;
    sameAsSheet(a, g, v);
    assert.equal(a.targets[0].edge, p.edge);
    assert.ok(a.weld && a.weld.joint === p.joint && a.lines.some(l => l.role === 'weld') && a.lines.some(l => l.role === 'leader'));
    // (The glyph: its tip and knee in plane coordinates, the side it leaves by — the sheet's own marks.)
    const lead = g.marks[0] as Extract<Mark, { kind: 'line' }>, ref = g.marks[2] as Extract<Mark, { kind: 'line' }>, P = (q: XY): XY => [(q[0] - v.origin[0]) / v.scale, (v.origin[1] - q[1]) / v.scale];
    const j = meta.welds!.find(x => x.id === p.joint)!, side = ref.b[0] < ref.a[0] ? 'left' : 'right';
    const glyph = weldGlyph(P(p.tip), P(lead.a), side, j, a.id, v.scale);
    assert.equal(glyph.length, g.marks.length);
    g.marks.forEach((m, k) => { const gl = glyph[k]; if (m.kind === 'line' && gl.kind === 'line') assert.ok(near(toSheet(v, gl.a), m.a) && near(toSheet(v, gl.b), m.b), `${a.id} glyph line ${k}`); if (m.kind === 'text' && gl.kind === 'text') assert.ok(near(toSheet(v, gl.at), m.at) && gl.text === m.text); });
  }
  assert.ok(out.left.every(x => x.why), 'what is left out is said');
});
