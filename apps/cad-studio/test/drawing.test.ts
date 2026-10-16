import test from 'node:test';
import assert from 'node:assert/strict';
import { brepsFor } from '../src/engine/evaluate';
import { starterDoc, type StudioDoc } from '../src/engine/doc';
import { projectViews } from '../src/drawing/project';
import { layoutSheet, scaleLabel, toSheet } from '../src/drawing/views';
import { orientFor, resolveDimension, snapPoints } from '../src/drawing/dimensions';
import { buildSheet } from '../src/drawing/sheet';
import { arcPath, sheetSvg } from '../src/drawing/svg';
import { sheetPdf } from '../src/drawing/pdf';
import { defaultDrawing, readDrawing, type DrawingDimension, type DrawingSettings, type DrawingViews } from '../src/drawing/types';

const viewsOf = (doc: StudioDoc): DrawingViews => {
  const b = brepsFor(doc); assert.ok('breps' in b, JSON.stringify(b));
  const r = projectViews(b.breps); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return r.views;
};
/** The starter plate (64 × 32 × 8, a Ø8 hole at 32, 16) with the hole's radius changed. */
const plate = (radius = 4): StudioDoc => { const d = starterDoc(); return { ...d, nodes: d.nodes.map(n => n.kind === 'hole' ? { ...n, radius } : n) }; };
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;

test('the standard views of the plate: outline visible, the hole hidden in the front and right views, round from the top', () => {
  const v = viewsOf(plate());
  const hidden = (id: keyof DrawingViews) => v[id].edges.flatMap(e => e.pieces.filter(p => !p.visible));
  assert.equal(hidden('front').length, 2); assert.equal(hidden('right').length, 2); assert.equal(hidden('top').length, 0);
  assert.deepEqual([v.front.min, v.front.max], [[0, 0], [64, 8]]);
  assert.deepEqual([v.top.min, v.top.max], [[0, 0], [64, 32]]);
  assert.deepEqual([v.right.min, v.right.max], [[0, 0], [32, 8]]);
  assert.ok(v.top.edges.some(e => e.kind === 'circle' && near(e.circle!.radius, 4)));
  // The isometric view sees the back edges as hidden (not drawn there, but projected).
  assert.ok(hidden('iso').length > 0);
});

test('third angle puts the top view above the front and the right view to its right, in projection; first angle mirrors it', () => {
  const v = viewsOf(plate());
  const third = layoutSheet(v, defaultDrawing());
  assert.equal(third.scale, 1); assert.equal(scaleLabel(third.scale), '1:1'); assert.ok(third.fits);
  const { front, top, right, iso } = third.views;
  assert.ok(top.box[3] < front.box[1], 'top above front');
  assert.ok(right.box[0] > front.box[2], 'right beside front, to its right');
  assert.ok(iso.box[0] > top.box[2] && iso.box[3] < front.box[1], 'iso at the upper right');
  // In projection: model X maps to the same sheet x in front and top; model Z to the same sheet y in front and right.
  assert.ok(near(toSheet(front, [10, 0])[0], toSheet(top, [10, 0])[0]));
  assert.ok(near(toSheet(front, [0, 5])[1], toSheet(right, [0, 5])[1]));
  // Every view inside the frame and clear of the title block.
  for (const p of Object.values(third.views)) {
    assert.ok(p.box[0] >= third.frame[0] && p.box[2] <= third.frame[2] && p.box[1] >= third.frame[1] && p.box[3] <= third.title[1], p.id);
  }
  const first = layoutSheet(v, { ...defaultDrawing(), projection: 'first' });
  assert.ok(first.views.top.box[1] > first.views.front.box[3], 'top below front');
  assert.ok(first.views.right.box[2] < first.views.front.box[0], 'right view to the left');
  assert.ok(near(toSheet(first.views.front, [10, 0])[0], toSheet(first.views.top, [10, 0])[0]));
  // A fixed scale is kept (and reported when it does not fit); auto picks the largest standard scale that fits.
  assert.equal(layoutSheet(v, { ...defaultDrawing(), scale: 2 }).scale, 2);
  assert.equal(layoutSheet(v, { ...defaultDrawing(), scale: 10 }).fits, false);
  assert.equal(layoutSheet(v, { ...defaultDrawing(), sheet: 'A3' }).scale, 2);
});

test('dimensions read the model in mm and follow the part when it changes', () => {
  const v = viewsOf(plate());
  const snaps = snapPoints(v.front);
  const corner = (u: number, w: number) => { const s = snaps.find(p => near(p.at[0], u) && near(p.at[1], w)); assert.ok(s, `snap at ${u}, ${w}`); return s!.ref; };
  const width: DrawingDimension = { id: 'd1', view: 'front', kind: 'linear', a: corner(0, 0), b: corner(64, 8), orient: 'horizontal', place: [32, -10] };
  const height: DrawingDimension = { ...width, id: 'd2', orient: 'vertical', place: [74, 4] };
  const diagonal: DrawingDimension = { ...width, id: 'd3', orient: 'aligned', place: [20, 20] };
  const top = snapPoints(v.top), centre = top.find(s => s.ref.at === 'center');
  assert.ok(centre && near(centre.at[0], 32) && near(centre.at[1], 16), 'the hole centre snaps');
  const hole = v.top.edges.find(e => e.kind === 'circle')!;
  const dia: DrawingDimension = { id: 'd4', view: 'top', kind: 'diameter', edge: hole.name, near: [...hole.circle!.center] as [number, number, number], place: [50, 40] };
  const rad: DrawingDimension = { ...dia, id: 'd5', kind: 'radius' };
  const toCentre: DrawingDimension = { id: 'd6', view: 'top', kind: 'linear', a: top.find(s => near(s.at[0], 0) && near(s.at[1], 0))!.ref, b: centre!.ref, orient: 'horizontal', place: [16, -8] };
  const texts = (views: DrawingViews) => [width, height, diagonal, dia, rad, toCentre].map(d => { const r = resolveDimension(views, d); return r.ok ? r.text : r.reason; });
  assert.deepEqual(texts(v), ['64', '8', String(Math.round(Math.hypot(64, 8) * 100) / 100), 'Ø8', 'R4', '32']);
  // A bigger hole: the same dimensions (persistent edge names) read the new size.
  assert.deepEqual(texts(viewsOf(plate(6.25))), ['64', '8', String(Math.round(Math.hypot(64, 8) * 100) / 100), 'Ø12.5', 'R6.25', '32']);
  // A circle that does not show round, or an edge no longer there, does not resolve.
  const side = v.front.edges.find(e => e.circle);
  assert.equal(side, undefined, 'the hole rims lie on the outline in the front view');
  const gone = resolveDimension(v, { ...dia, edge: 'n9.nothing' });
  assert.ok(!gone.ok && /no longer/.test(gone.reason));
});

test('a linear dimension orients by where it is placed', () => {
  assert.equal(orientFor([0, 0], [10, 5], [5, 12]), 'horizontal');
  assert.equal(orientFor([0, 0], [10, 5], [14, 2]), 'vertical');
  assert.equal(orientFor([0, 0], [10, 5], [14, 9]), 'aligned');
  assert.equal(orientFor([0, 0], [10, 0], [14, 9]), 'horizontal');
  assert.equal(orientFor([0, 0], [0, 10], [5, 30]), 'vertical');
});

const sheetOf = (settings: DrawingSettings, doc = plate()) => {
  const v = viewsOf(doc), layout = layoutSheet(v, settings);
  return buildSheet(v, layout, settings, { title: 'Bracket <01>', date: '2026-10-16' });
};
const withDims = (): DrawingSettings => {
  const v = viewsOf(plate()), hole = v.top.edges.find(e => e.kind === 'circle')!, f = snapPoints(v.front);
  const at = (u: number, w: number) => f.find(p => near(p.at[0], u) && near(p.at[1], w))!.ref;
  return { ...defaultDrawing(), dimensions: [
    { id: 'd1', view: 'front', kind: 'linear', a: at(0, 0), b: at(64, 0), orient: 'horizontal', place: [32, -12] },
    { id: 'd2', view: 'top', kind: 'diameter', edge: hole.name, near: [...hole.circle!.center] as [number, number, number], place: [48, 40] },
  ] };
};

test('the SVG sheet: true size in mm, exact arcs, dashed hidden lines, the title block and the dimensions', () => {
  const svg = sheetSvg(sheetOf(withDims()), 'Bracket');
  assert.match(svg, /<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="297mm" height="210mm" viewBox="0 0 297 210">/);
  assert.match(svg, /stroke-dasharray="3 1.5"/, 'hidden lines dashed');
  assert.match(svg, /A4 4 /, 'the hole as an exact arc of radius 4 at 1:1');
  assert.match(svg, />Ø8<\/text>/); assert.match(svg, />64<\/text>/);
  assert.match(svg, />Bracket &lt;01&gt;<\/text>/, 'the title, escaped');
  for (const t of ['1:1', 'mm', '2026-10-16', 'A4', 'THIRD ANGLE', 'FRONT', 'TOP', 'RIGHT', 'ISOMETRIC']) assert.ok(svg.includes(`>${t}</text>`), t);
  assert.equal((svg.match(/data-dim="/g) ?? []).length, 2);
  // Hidden lines off: no dashes in the views.
  const plain = sheetSvg(sheetOf({ ...withDims(), hidden: false }), 'Bracket');
  assert.doesNotMatch(plain, /stroke-dasharray/);
  // A3 is the larger sheet.
  assert.match(sheetSvg(sheetOf({ ...defaultDrawing(), sheet: 'A3' }), 'x'), /width="420mm" height="297mm"/);
});

test('an SVG arc of a projected circle: principal axes from conjugate semi-diameters', () => {
  // A circle of radius 2 seen as an ellipse with semi-axes 3 (along x) and 1 (along y), given skewed.
  const d = arcPath([0, 0], [3, 0], [0, 1], 0, Math.PI / 2);
  assert.equal(d, 'M3 0A3 1 0 0 1 0 1');
  // The same ellipse from rotated conjugate diameters (t shifted by 45°) has the same axes.
  const c = Math.SQRT1_2, e = arcPath([0, 0], [3 * c, c], [-3 * c, c], 0, 2 * Math.PI);
  assert.match(e, /A3 1 0 0 1 /); assert.equal((e.match(/A/g) ?? []).length, 2, 'a whole turn as two halves');
});

test('the PDF sheet: one vector page at true size, Helvetica text with Ø, a valid cross-reference table', () => {
  const bytes = sheetPdf(sheetOf(withDims()), 'Bracket'), text = Array.from(bytes, b => String.fromCharCode(b)).join('');
  assert.ok(text.startsWith('%PDF-1.4\n'));
  assert.match(text, /\/MediaBox \[0 0 841\.8898 595\.2756\]/, 'A4 landscape in points');
  assert.match(text, /\(\\3308\) Tj/, 'Ø8 in WinAnsi');
  assert.match(text, /\[3 1\.5\] 0 d/, 'dashed hidden lines');
  assert.match(text, / c S\n/, 'arcs as Béziers');
  const xref = Number(/startxref\n(\d+)/.exec(text)![1]);
  assert.ok(text.slice(xref).startsWith('xref\n0 8\n'));
  const offsets = text.slice(xref).split('\n').slice(3, 10).map(l => Number(l.slice(0, 10)));
  offsets.forEach((o, i) => assert.ok(text.slice(o).startsWith(`${i + 1} 0 obj`), `object ${i + 1} at ${o}`));
  const length = Number(/\/Length (\d+) >>\nstream\n/.exec(text)![1]), start = text.indexOf('stream\n') + 7;
  assert.equal(text.slice(start + length, start + length + 9), 'endstream');
});

test('drawing settings read back from a file keep what is valid', () => {
  assert.deepEqual(readDrawing(undefined), defaultDrawing());
  const r = readDrawing({ sheet: 'A3', scale: 0.5, projection: 'first', hidden: false, title: 'Plate', dimensions: [{ id: 'd1', view: 'front', kind: 'linear' }, { id: 7 }, { id: 'd2', view: 'side' }] });
  assert.deepEqual({ ...r, dimensions: r.dimensions.map(d => d.id) }, { sheet: 'A3', scale: 0.5, projection: 'first', hidden: false, title: 'Plate', dimensions: ['d1'] });
  assert.equal(readDrawing({ sheet: 'B0', scale: -1 }).sheet, 'A4');
  assert.equal(readDrawing({ scale: -1 }).scale, undefined);
});
