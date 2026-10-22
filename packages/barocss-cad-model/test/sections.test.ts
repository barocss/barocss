import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { commands, type Ctx } from '../src/app/commands';
import { drawingInputs } from '../src/chat/drawing';
import { drawingIssues, issueContext } from '../src/drawing/issues';
import { nextSectionId, readDrawing, sectionsOf, withSections, type DrawingSection, type DrawingSettings } from '../src/drawing/types';
import { sectionMiddle } from '../src/drawing/sheet';
import { sheetSvg } from '../src/drawing/svg';
import { sheetPdf } from '../src/drawing/pdf';
import { sheetDxf } from '../src/drawing/dxf';
import { reorient } from '../src/drawing/reorient';
import { projectViews } from '../src/drawing/project';
import { brepsFor } from '../src/engine/evaluate';
import { fromSheet } from '../src/drawing/views';

// O148 X1: sections as a list on any principal plane — B–B square to the top view's depth through a stepped shaft, its
// cut ring the step's circle, hatched; laid out beside the top view (third angle; first angle the other side), with A–A
// under the front view as always; its cutting plane drawn edge-on in the front view with its letters; clean on A3; in
// the SVG, PDF and DXF. The old `section` reads as A on the front; one A on the front is written back so.
const blank: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
const cmd = (id: string) => commands.find(c => c.id === id)!;
/** A shaft along Z: Ø20 × 30 then Ø30 × 40. */
function shaft(): StudioDoc {
  const doc = cmd('shaft').build!(blank, cmd('shaft').defaults!(blank));
  return { ...doc, nodes: doc.nodes.map((n, i) => i === 0 ? { ...(n as Extract<ModelNode, { kind: 'shaft' }>), steps: [{ diameter: 20, length: 30 }, { diameter: 30, length: 40 }], holes: [] } as ModelNode : n) };
}
const inputsOf = (doc: StudioDoc, extra: Partial<DrawingSettings>) => {
  const i = drawingInputs(doc, { ...readDrawing(doc.drawing), sheet: 'A3', ...extra });
  assert.ok(typeof i !== 'string', String(i));
  const meta = { ...i.meta, date: '2026-10-22' };
  return { i: { ...i, meta }, ctx: issueContext({ ...i, meta }) };
};
const viewsOf = (doc: StudioDoc, orientation?: DrawingSettings['orientation']) => { const b = brepsFor(doc); assert.ok(!('error' in b)); const r = projectViews(b.breps, b.prefixes, orientation ? { orientation } : {}); assert.ok(r.ok); return r.views; };
const area = (ring: readonly (readonly number[])[]) => Math.abs(ring.reduce((s, p, k) => { const q = ring[(k + 1) % ring.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;

test('B–B square to the top view through the shaft: its ring the Ø30 step\'s circle, hatched; beside the top view (A–A under the front); its plane edge-on in the front view with its letters; clean on A3; in every format', () => {
  const doc = shaft(), views = viewsOf(doc);
  // (The shaft's extent up Z from the front view: B–B through the Ø30 step's middle, 20 above its start.)
  const z0 = views.front.min[1], zB = z0 + 30 + 20, atB = -zB, atA = sectionMiddle(views, 'front')!;
  assert.equal(sectionMiddle(views, 'top'), -Math.round((views.front.min[1] + views.front.max[1]) / 2 * 100) / 100 + 0);
  const list: DrawingSection[] = [{ id: 'A', view: 'front', at: atA }, { id: 'B', view: 'top', at: atB }];
  const { i, ctx } = inputsOf(doc, { sections: list });
  const B = i.sections!.find(x => x.id === 'B')!;
  assert.equal(B.rings.length, 1);
  // (Each vertex on the Ø30 circle, exactly; the ring's area between its inscribed polygon's and πr².)
  const xs = B.rings[0].map(p => p[0]), ys = B.rings[0].map(p => p[1]), c = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  for (const p of B.rings[0]) assert.ok(Math.abs(Math.hypot(p[0] - c[0], p[1] - c[1]) - 15) < 1e-6, `vertex ${p} off the circle`);
  // (n: the ring's distinct vertices — the tessellation's edges share their ends.)
  const n = B.rings[0].filter((p, k, r) => !r.slice(0, k).some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-9)).length, a = area(B.rings[0]);
  assert.ok(a <= Math.PI * 225 && a >= n / 2 * 225 * Math.sin(2 * Math.PI / n) - 1e-6, `area ${a}`);
  // (Laid out: A–A under the front view, B–B left of the top view in its row; each clear of the others and the views.)
  const L = ctx.layout, pA = L.sections!.find(x => x.section === 'A')!, pB = L.sections!.find(x => x.section === 'B')!;
  assert.deepEqual(L.sections!.map(x => [x.section, x.of]), [['A', 'front'], ['B', 'top']]);
  assert.ok(pA.box[1] > L.views.front.box[3], 'A–A under the front view');
  assert.ok(pB.box[2] < L.views.top.box[0] && Math.abs(pB.origin[1] - L.views.top.origin[1]) < 1e-9, 'B–B left of the top view, in its row');
  assert.ok(L.fits, 'fits on A3');
  // (Its cutting plane: a chain line across the front view at Z = zB, its letter B at each end.)
  const g = ctx.sheet.groups.find(x => x.role === 'section' && x.id === 'B' && x.view === 'front')!, body = ctx.sheet.groups.find(x => x.role === 'section' && x.id === 'B' && !x.view)!;
  const line = g.marks.find(m => m.kind === 'line' && m.pen === 'center') as { a: [number, number]; b: [number, number] };
  const fv = L.views.front;
  assert.ok(Math.abs(fromSheet(fv, line.a)[1] - zB) < 1e-9 && Math.abs(fromSheet(fv, line.b)[1] - zB) < 1e-9, 'at Z = zB in the front view');
  assert.ok(line.a[0] < fv.box[0] && line.b[0] > fv.box[2], 'across the front view');
  assert.deepEqual(g.marks.filter(m => m.kind === 'text').map(m => (m as { text: string }).text), ['B', 'B']);
  assert.ok(body.marks.some(m => m.kind === 'hatch'));
  assert.deepEqual(drawingIssues(ctx).filter(x => /OVERLAP|OVER_LINES|OFF_SHEET|DONT_FIT/.test(x.code)).map(x => `${x.code}: ${x.message}`), []);
  const svg = sheetSvg(ctx.sheet, 'shaft'), pdf = new TextDecoder('latin1').decode(sheetPdf(ctx.sheet, 'shaft')), dxf = sheetDxf(ctx.sheet, ctx.layout).text;
  for (const t of ['SECTION A–A', 'SECTION B–B']) assert.ok(svg.includes(`>${t}</text>`), `SVG ${t}`);
  assert.ok(pdf.includes('(B) Tj'), 'PDF'); assert.ok(dxf.includes('\nB\n') && dxf.includes('HATCH'), 'DXF');
  // (First angle: the top view is at the lower right, B–B to its right.)
  const first = inputsOf(doc, { sections: list, projection: 'first' }).ctx.layout, qB = first.sections!.find(x => x.section === 'B')!;
  assert.ok(qB.box[0] > first.views.top.box[2], 'first angle: right of the top view');
});

test('the section list in files: the old section reads as A on the front; one A on the front is written back as section; letters in order; turning the front keeps a top section and refuses a right one across it (as A–A on the front always was)', () => {
  assert.deepEqual(sectionsOf(readDrawing({ section: { y: 3 } })), [{ id: 'A', view: 'front', at: 3 }]);
  const two = withSections(readDrawing({}), [{ id: 'A', view: 'front', at: 3 }, { id: 'B', view: 'top', at: -10 }]);
  assert.deepEqual([two.section, two.sections], [undefined, [{ id: 'A', view: 'front', at: 3 }, { id: 'B', view: 'top', at: -10 }]]);
  assert.deepEqual(readDrawing(JSON.parse(JSON.stringify(two))).sections, two.sections);
  const one = withSections(two, [{ id: 'A', view: 'front', at: 4 }]);
  assert.deepEqual([one.section, one.sections], [{ y: 4 }, undefined]);
  assert.equal(readDrawing({ sections: [{ id: 'a', view: 'front', at: 1 }, { id: 'B', view: 'iso', at: 1 }, { id: 'C', view: 'top', at: NaN }] }).sections, undefined, 'none valid, none');
  assert.equal(nextSectionId(two.sections!), 'C');
  const doc = shaft(), from = viewsOf(doc), to = viewsOf(doc, 'x+');
  const kept = reorient(from, to, { ...withSections(readDrawing({}), [{ id: 'B', view: 'top', at: -10 }]), dimensions: [] }, 'x+');
  assert.ok(kept.ok, !kept.ok ? kept.message : '');
  assert.deepEqual(sectionsOf(kept.settings).find(x => x.id === 'B'), { id: 'B', view: 'top', at: -10 });
  const across = reorient(from, to, { ...withSections(readDrawing({}), [{ id: 'C', view: 'right', at: 5 }]), dimensions: [] }, 'x+');
  assert.ok(!across.ok && across.code === 'SECTION_ACROSS' && /^Section C–C is cut across the present right view/.test(across.message));
});
