import test from 'node:test';
import assert from 'node:assert/strict';
import { brepsFor } from '../src/engine/evaluate';
import { emptyDoc, starterDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { projectViews } from '../src/drawing/project';
import { layoutSheet, scaleLabel, toSheet } from '../src/drawing/views';
import { angleBetween, orientFor, resolveDimension, snapPoints } from '../src/drawing/dimensions';
import { buildSheet, type Mark } from '../src/drawing/sheet';
import { centreMarks } from '../src/drawing/centres';
import { sectionOf } from '../src/drawing/section';
import { hatch, noteMarks, TITLE_ROOM, toleranceText, valueMarks } from '../src/drawing/sheet';
import { fitText, textWidth } from '../src/drawing/text';
import type { PartInstance } from '../src/engine/doc';
import { arcPath, sheetSvg } from '../src/drawing/svg';
import { sheetPdf } from '../src/drawing/pdf';
import { defaultDrawing, readDrawing, type DrawingDimension, type DrawingSettings, type DrawingViews } from '../src/drawing/types';
import { SAMPLE_SIZES, withSampleRows } from './person-file';

const viewsOf = (doc: StudioDoc): DrawingViews => {
  const b = brepsFor(doc); assert.ok('breps' in b, JSON.stringify(b));
  const r = projectViews(b.breps, b.prefixes); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return r.views;
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
  const side = v.front.edges.filter(e => e.circle);
  assert.ok(side.length > 0 && side.every(e => e.pieces.length === 0), 'the hole rims lie on the outline in the front view (kept, not drawn)');
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
  assert.doesNotMatch(plain, /stroke-dasharray="3 1.5"/);
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

test('centre marks: a cross on the hole seen round, a centreline along it seen from the side, none on a fillet corner', () => {
  const v = viewsOf(plate()), layout = layoutSheet(v, defaultDrawing());
  const lines = (id: keyof DrawingViews) => centreMarks(layout.views[id], v[id]).filter((m): m is Extract<Mark, { kind: 'line' }> => m.kind === 'line');
  const top = lines('top'), c = toSheet(layout.views.top, [32, 16]);
  assert.equal(top.length, 2);
  assert.ok(top.every(m => m.pen === 'center'));
  const h = top.find(m => m.a[1] === m.b[1])!, w = top.find(m => m.a[0] === m.b[0])!;
  assert.ok(near(h.a[1], c[1]) && near(Math.abs(h.b[0] - h.a[0]), 2 * (4 + 2.5)), 'across the circle and 2.5 mm past it (1:1)');
  assert.ok(near(w.a[0], c[0]));
  const front = lines('front'), x = toSheet(layout.views.front, [32, 0])[0];
  assert.equal(front.length, 1); assert.ok(near(front[0].a[0], x) && near(front[0].b[0], x));
  assert.ok(near(Math.abs(front[0].b[1] - front[0].a[1]), 8 + 5), 'the plate thickness and 2.5 mm past each face');
  assert.equal(lines('right').length, 1);
  // A filleted box: its quarter arcs are no whole circle.
  const box = starterDoc(); const filleted: StudioDoc = { ...box, nodes: [...box.nodes.slice(0, 2), { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: ['n1.side0|n1.top'], radius: 3 }] };
  const fv = viewsOf(filleted), fl = layoutSheet(fv, defaultDrawing());
  assert.equal(centreMarks(fl.views.right, fv.right).length, 0);
  // Off by setting.
  assert.match(sheetSvg(sheetOf(defaultDrawing()), 'x'), /stroke-dasharray="8 1.5 1.5 1.5"/);
  assert.doesNotMatch(sheetSvg(sheetOf({ ...defaultDrawing(), centers: false }), 'x'), /stroke-dasharray="8 1.5 1.5 1.5"/);
});

test('placed instances are drawn too, their edges named under the instance id', () => {
  const part = plate(), inst: PartInstance = { id: 'inst1', name: 'copy', doc: plate(), position: [80, 0, 0], rotation: [0, 0, 0] };
  const v = viewsOf({ ...part, instances: [inst] });
  assert.ok(near(v.front.max[0], 144), 'the copy beside the part');
  assert.ok(v.top.edges.some(e => e.name.startsWith('inst1/')), v.top.edges.map(e => e.name).join(' ')); assert.ok(v.top.edges.some(e => !e.name.includes('/')));
  const hole = v.top.edges.find(e => e.name.startsWith('inst1/') && e.circle)!;
  const d: DrawingDimension = { id: 'd1', view: 'top', kind: 'diameter', edge: hole.name, near: [...hole.circle!.center] as [number, number, number], place: [130, 40] };
  const r = resolveDimension(v, d); assert.ok(r.ok && r.kind === 'diameter', JSON.stringify(r)); assert.equal(r.text, 'Ø8'); assert.ok(near(r.center[0], 112), String(r.center));
  assert.equal(viewsOf({ ...part, instances: [{ ...inst, hidden: true }] }).front.max[0], 64, 'a hidden instance is left out');
});

test('an angle between two lines reads the sector it is placed in', () => {
  const x: [[number, number], [number, number]] = [[0, 0], [10, 0]], diag: [[number, number], [number, number]] = [[0, 0], [10, 10]];
  const deg = (p: [number, number]) => Math.round(angleBetween(x, diag, p)!.degrees * 1e6) / 1e6;
  assert.equal(deg([10, 4]), 45); assert.equal(deg([-2, 6]), 135); assert.equal(deg([-5, -1]), 45); assert.equal(deg([3, -6]), 135);
  assert.deepEqual(angleBetween(x, diag, [10, 4])!.vertex, [0, 0]);
  assert.equal(angleBetween(x, [[0, 5], [10, 5]], [1, 1]), null, 'parallel lines have none');
});

test('an angle dimension on a triangular prism reads its corner from the model and draws an arc', () => {
  const tri = withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'polygon', points: [[0, 0], [40, 0], [0, 30]] }), { kind: 'extrude', sketch: 0, height: 5 });
  const v = viewsOf(tri);
  const lines = v.top.edges.filter(e => e.kind === 'line' && e.ends && Math.abs(e.ends[0][2] - 5) < 1e-9 && Math.abs(e.ends[1][2] - 5) < 1e-9);
  const base = lines.find(e => e.ends!.every(p => Math.abs(p[1]) < 1e-9))!, slope = lines.find(e => e.ends!.some(p => Math.abs(p[0] - 40) < 1e-9) && e.ends!.some(p => Math.abs(p[1] - 30) < 1e-9))!;
  assert.ok(base && slope);
  const mid = (e: typeof base) => [0, 1, 2].map(k => (e.ends![0][k] + e.ends![1][k]) / 2) as [number, number, number];
  const d: DrawingDimension = { id: 'a1', view: 'top', kind: 'angle', a: { edge: base.name, near: mid(base) }, b: { edge: slope.name, near: mid(slope) }, place: [30, 3] };
  const r = resolveDimension(v, d);
  assert.ok(r.ok && r.kind === 'angle', JSON.stringify(r));
  assert.equal(r.text, '36.87°'); assert.ok(near(r.vertex[0], 40) && near(r.vertex[1], 0));
  const settings: DrawingSettings = { ...defaultDrawing(), dimensions: [d] };
  const svg = sheetSvg(buildSheet(v, layoutSheet(v, settings), settings, { title: 't', date: 'd' }), 't');
  assert.match(svg, />36.87°<\/text>/);
  assert.match(svg.slice(svg.indexOf('data-dim="a1"')), /^[^]*?A\d/, 'an arc in the dimension');
  // On the other side of the corner it reads the supplement.
  const other = resolveDimension(v, { ...d, place: [50, 3] });
  assert.ok(other.ok && other.text === '143.13°');
});

test('tangent edges show as thin lines when asked for, and the setting reads back', () => {
  const box = starterDoc(); const filleted: StudioDoc = { ...box, nodes: [...box.nodes.slice(0, 2), { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: ['n1.side0|n1.top'], radius: 3 }] };
  const b = brepsFor(filleted); assert.ok('breps' in b);
  const off = projectViews(b.breps, b.prefixes), on = projectViews(b.breps, b.prefixes, { tangentEdges: true });
  assert.ok(off.ok && on.ok);
  assert.equal(off.views.top.edges.filter(e => e.tangent).length, 0);
  const t = on.views.top.edges.filter(e => e.tangent && e.pieces.length);
  assert.ok(t.length >= 1);
  const settings: DrawingSettings = { ...defaultDrawing(), tangent: true };
  const sheet = buildSheet(on.views, layoutSheet(on.views, settings), settings, { title: 't', date: 'd' });
  const top = sheet.groups.find(g => g.role === 'view' && g.view === 'top')!;
  assert.ok(top.marks.some(m => m.kind === 'line' && m.pen === 'thin'), 'a thin line in the top view');
  assert.equal(readDrawing({ tangent: true }).tangent, true); assert.equal(readDrawing({ tangent: 'yes' }).tangent, undefined);
});

test('section A–A: the plate cut through its hole, the cut faces hatched, the cutting plane in the top view', () => {
  const doc = plate(), r = sectionOf(doc, 16);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  // Cut through the hole: two cut faces either side of it, 28 mm wide and 8 mm high each.
  assert.equal(r.rings.length, 2);
  const spans = r.rings.map(ring => [Math.min(...ring.map(p => p[0])), Math.max(...ring.map(p => p[0])), Math.min(...ring.map(p => p[1])), Math.max(...ring.map(p => p[1]))].map(x => Math.round(x * 1e6) / 1e6)).sort((a, b) => a[0] - b[0]);
  assert.deepEqual(spans, [[0, 28, 0, 8], [36, 64, 0, 8]]);
  assert.deepEqual([r.projection.min, r.projection.max], [[0, 0], [64, 8]]);
  const v = viewsOf(doc), settings: DrawingSettings = { ...defaultDrawing(), section: { y: 16 } };
  const layout = layoutSheet(v, settings, r.projection);
  const sec = layout.sections?.[0];
  assert.ok(sec && sec.box[1] > layout.views.front.box[3], 'under the front view');
  assert.ok(near(toSheet(sec, [10, 0])[0], toSheet(layout.views.front, [10, 0])[0]), 'in projection with it');
  const sheet = buildSheet(v, layout, settings, { title: 't', date: 'd' }, [{ id: 'A', view: 'front', at: 16, projection: r.projection, rings: r.rings }]), svg = sheetSvg(sheet, 't');
  assert.ok(svg.includes('>SECTION A–A</text>')); assert.equal((svg.match(/>A<\/text>/g) ?? []).length, 2, 'A at both ends of the cutting plane');
  const g = sheet.groups.find(x => x.role === 'section' && !x.view)!;
  const h = g.marks.find((m): m is Extract<Mark, { kind: 'hatch' }> => m.kind === 'hatch');
  assert.ok(h && hatch(h.rings, h.spacing).length > 10, 'hatched (one mark, drawn as its lines; a DXF HATCH, R11b)');
  assert.ok(g.marks.every(m => !('pen' in m) || m.pen !== 'hidden'), 'a section shows no hidden lines');
  // Behind the whole part: nothing to show; in front of it: the whole part.
  const none = sectionOf(doc, 40); assert.ok(!none.ok && /Nothing/.test(none.error));
  const all = sectionOf(doc, -5); assert.ok(all.ok && all.rings.length === 0);
  assert.deepEqual(readDrawing({ section: { y: 3 } }).section, { y: 3 }); assert.equal(readDrawing({ section: { y: 'x' } }).section, undefined);
});

test('hatching stays inside a ring and out of its hole', () => {
  const sq = (a: number, b: number): [number, number][] => [[a, a], [b, a], [b, b], [a, b]];
  const lines = hatch([sq(0, 10), sq(4, 6)], 1).filter((m): m is Extract<Mark, { kind: 'line' }> => m.kind === 'line');
  assert.ok(lines.length > 10);
  for (const m of lines) for (const t of [0.25, 0.5, 0.75]) {
    const p = [m.a[0] + (m.b[0] - m.a[0]) * t, m.a[1] + (m.b[1] - m.a[1]) * t];
    assert.ok(p[0] >= -1e-9 && p[0] <= 10 + 1e-9 && p[1] >= -1e-9 && p[1] <= 10 + 1e-9, 'inside');
    assert.ok(!(p[0] > 4 + 1e-9 && p[0] < 6 - 1e-9 && p[1] > 4 + 1e-9 && p[1] < 6 - 1e-9), 'not in the hole');
    assert.ok(Math.abs(Math.abs((m.b[1] - m.a[1]) / (m.b[0] - m.a[0])) - 1) < 1e-9, 'at 45°');
  }
});

test('an empty part has nothing to draw, and that is not an error', () => {
  const r = projectViews([]);
  assert.ok(!r.ok && r.empty === true && /no body/.test(r.error));
});

test('title block fields stay in their cells: a long title shrinks, then ends in an ellipsis', () => {
  const textsOf = (title: string, settings = defaultDrawing()) => {
    const v = viewsOf(plate()), layout = layoutSheet(v, settings);
    const svg = sheetSvg(buildSheet(v, layout, settings, { title, date: '2026-10-16' }), 't');
    const block = svg.slice(svg.indexOf('<g class="title">'), svg.indexOf('</g>', svg.indexOf('<g class="title">')));
    const texts = [...block.matchAll(/<text[^>]* x="([\d.]+)" y="([\d.]+)" font-size="([\d.]+)"([^>]*)>([^<]*)<\/text>/g)]
      .map(m => ({ x: Number(m[1]), size: Number(m[3]), end: m[4].includes('text-anchor="end"'), bold: m[4].includes('bold'), text: m[5].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') }));
    return { texts, layout };
  };
  const long = 'Bracket-01 assembly with long descriptive name rev C';
  const { texts, layout } = textsOf(long), [x0, , x1] = layout.title;
  for (const t of texts) {
    const w = textWidth(t.text, t.size, t.bold), from = t.end ? t.x - w : t.x, to = t.end ? t.x : t.x + w;
    assert.ok(from >= x0 && to <= x1, `${t.text} (${from.toFixed(1)}–${to.toFixed(1)}) inside ${x0}–${x1}`);
  }
  const title = texts.find(t => t.bold && t.text.startsWith('Bracket'))!;
  assert.ok(title.x + textWidth(title.text, title.size, true) <= x0 + 2 + TITLE_ROOM, 'short of the projection symbol');
  assert.ok(title.size >= 3 && title.text.endsWith('…') && long.startsWith(title.text.slice(0, -1)));
  // A short title keeps its size; one a little long only shrinks.
  assert.equal(textsOf('Bracket-01').texts.find(t => t.text === 'Bracket-01')!.size, 5);
  const mid = fitText('Bracket-01 housing rev C', 5, true, TITLE_ROOM, 3);
  assert.ok(mid.size < 5 && mid.size >= 3 && mid.text === 'Bracket-01 housing rev C');
  const cut = fitText('W'.repeat(40), 3.5, true, 26, 2.2);
  assert.ok(cut.size === 2.2 && cut.text.endsWith('…') && textWidth(cut.text, cut.size, true) <= 26, 'a cell value cut to fit');
});

test('tolerances: ± and fits follow the value, deviations stack after it; they print in SVG and PDF', () => {
  assert.equal(toleranceText({ kind: 'symmetric', value: 0.1 }), '±0.1');
  assert.equal(toleranceText({ kind: 'deviation', upper: 0.1, lower: -0.05 }), '+0.1/-0.05');
  assert.equal(toleranceText({ kind: 'deviation', upper: 0, lower: -0.2 }, '°'), '0/-0.2°');
  assert.equal(toleranceText({ kind: 'fit', code: 'H7' }), 'H7');
  const sym = valueMarks([100, 50], 0, 'middle', '64', { kind: 'symmetric', value: 0.1 });
  assert.equal(sym.length, 1); assert.ok(sym[0].kind === 'text' && sym[0].text === '64 ±0.1');
  const dev = valueMarks([100, 50], 0, 'middle', '64', { kind: 'deviation', upper: 0.1, lower: -0.05 }).filter((m): m is Extract<Mark, { kind: 'text' }> => m.kind === 'text');
  assert.deepEqual(dev.map(m => m.text), ['64', '+0.1', '-0.05']);
  assert.ok(dev[1].at[1] < dev[0].at[1] && dev[2].at[1] > dev[1].at[1], 'the upper deviation raised above the lower');
  assert.ok(dev[1].size < dev[0].size && near(dev[1].at[0], dev[2].at[0]) && dev[1].at[0] > dev[0].at[0] + textWidth('64', dev[0].size, false));
  const middle = (dev[0].at[0] + dev[1].at[0] + textWidth('-0.05', dev[2].size, false)) / 2;
  assert.ok(Math.abs(middle - 100) < 0.01, 'the whole label centred');
  // Rotated (a vertical dimension): the stack turns with it.
  const up = valueMarks([0, 0], 90, 'start', '8', { kind: 'deviation', upper: 0.2, lower: 0 }).filter((m): m is Extract<Mark, { kind: 'text' }> => m.kind === 'text');
  assert.ok(up.every(m => m.angle === 90) && up[1].at[1] < up[0].at[1] && up[1].at[0] < up[2].at[0]);
  const v = viewsOf(plate()), base = withDims();
  const settings: DrawingSettings = { ...base, dimensions: base.dimensions.map(d => d.id === 'd1' ? { ...d, tol: { kind: 'symmetric', value: 0.1 } } : { ...d, tol: { kind: 'fit', code: 'H7' } }) };
  const sheet = buildSheet(v, layoutSheet(v, settings), settings, { title: 't', date: 'd' });
  const svg = sheetSvg(sheet, 't');
  assert.match(svg, />64 ±0.1<\/text>/); assert.match(svg, />Ø8 H7<\/text>/);
  const pdf = Array.from(sheetPdf(sheet, 't'), b => String.fromCharCode(b)).join('');
  assert.match(pdf, /\(64 \\2610\.1\) Tj/, '± in WinAnsi');
  const back = readDrawing(JSON.parse(JSON.stringify(settings)));
  assert.deepEqual(back.dimensions.map(d => d.tol), [{ kind: 'symmetric', value: 0.1 }, { kind: 'fit', code: 'H7' }]);
  assert.equal(readDrawing({ dimensions: [{ ...settings.dimensions[0], tol: { kind: 'symmetric', value: -1 } }] }).dimensions[0].tol, undefined);
});

test('notes: lines of text on the sheet, a leader that follows its view, kept in the file', () => {
  const v = viewsOf(plate()), settings: DrawingSettings = { ...defaultDrawing(), notes: [
    { id: 'n1', text: 'ALL EDGES BROKEN 0.5\nMATERIAL AL 6061', at: [20, 160] },
    { id: 'n2', text: 'THROUGH', at: [140, 60], leader: { view: 'top', at: [36, 16] } },
  ] };
  const layout = layoutSheet(v, settings), sheet = buildSheet(v, layout, settings, { title: 't', date: 'd' }), svg = sheetSvg(sheet, 't');
  assert.ok(svg.includes('>ALL EDGES BROKEN 0.5</text>') && svg.includes('>MATERIAL AL 6061</text>'));
  assert.equal((svg.match(/data-dim="n[12]"/g) ?? []).length, 2, 'selectable like dimensions');
  const lead = noteMarks(layout, settings.notes![1]), tip = toSheet(layout.views.top, [36, 16]);
  const arrowHead = lead.find((m): m is Extract<Mark, { kind: 'fill' }> => m.kind === 'fill')!;
  assert.ok(near(arrowHead.points[0][0], tip[0]) && near(arrowHead.points[0][1], tip[1]), 'the arrow on the view point');
  const texts = noteMarks(layout, settings.notes![0]).filter((m): m is Extract<Mark, { kind: 'text' }> => m.kind === 'text');
  assert.equal(texts.length, 2); assert.ok(texts[1].at[1] > texts[0].at[1]);
  assert.deepEqual(readDrawing(JSON.parse(JSON.stringify(settings))).notes, settings.notes);
  assert.equal(readDrawing({ notes: [{ id: 'x', text: 3, at: [0, 0] }] }).notes, undefined);
});

test('drawing revision: the next one after A, Z, 01 and none; the REV cell shows it', async () => {
  const { nextRevision, modelPrint } = await import('../src/drawing/types');
  assert.deepEqual(['A', 'Z', 'AZ', '01', '9', undefined].map(r => nextRevision(r)), ['B', 'AA', 'BA', '02', '10', 'A']);
  assert.notEqual(modelPrint([{ kind: 'box' }]), modelPrint([{ kind: 'box', w: 2 }]));
});

test('cosmetic threads on the drawing (ISO 6410): a tapped hole’s crest hidden along it and a ¾ circle seen end on; a bolt’s root thin', async () => {
  const { threadsOf } = await import('../src/app/threads');
  const { threadMarks, minorDiameter } = await import('../src/drawing/threads');
  const { commands } = await import('../src/app/commands');
  // The starter plate's hole made a tapped M10 (its tap drill Ø8.5).
  const d0 = starterDoc(), tapped = { ...d0, nodes: d0.nodes.map(n => n.kind === 'hole' ? { ...n, radius: 4.25, thread: 'M10×1.5' } : n) };
  const v = viewsOf(tapped), settings = { ...defaultDrawing(), hidden: true }, layout = layoutSheet(v, settings), t = threadsOf(tapped.nodes, SAMPLE_SIZES);
  const top = threadMarks(layout.views.top, v.top, t, true), front = threadMarks(layout.views.front, v.front, t, true);
  assert.equal(top.length, 1); const arc = top[0] as Extract<Mark, { kind: 'arc' }>;
  assert.ok(arc.kind === 'arc' && near(arc.t1 - arc.t0, 1.5 * Math.PI) && near(arc.u[0], 5 * layout.views.top.scale), 'a ¾ circle at the major Ø10');
  assert.equal(front.length, 2); assert.ok(front.every(m => m.kind === 'line' && m.pen === 'hidden'));
  const [a, b] = front as Extract<Mark, { kind: 'line' }>[];
  assert.ok(near(Math.abs(a.a[0] - b.a[0]), 10 * layout.views.front.scale, 1e-6), 'the crest lines Ø10 apart');
  assert.ok(near(Math.abs(a.a[1] - a.b[1]), 8 * layout.views.front.scale, 1e-6), 'through the plate');
  assert.equal(threadMarks(layout.views.front, v.front, t, false).length, 0, 'hidden lines off: none');
  assert.ok(buildSheet(v, layout, settings, { title: 't', date: 'd', threads: t }).groups.find(g => g.view === 'top')!.marks.some(m => m.kind === 'arc' && m.t1 - m.t0 > 4));
  // A bolt on its own: its root (minor diameter) thin and visible from the side.
  const f = commands.find(c => c.id === 'fastener')!, ctx = { doc: withSampleRows(emptyDoc()), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
  const bolt = f.build!(ctx, { ...f.defaults!(ctx), kind: 'hex-bolt', size: 'M8', length: '30', x: 0, y: 0, z: 0 });
  const bv = viewsOf(bolt), bl = layoutSheet(bv, defaultDrawing()), side = threadMarks(bl.views.front, bv.front, threadsOf(bolt.nodes, SAMPLE_SIZES), false) as Extract<Mark, { kind: 'line' }>[];
  assert.equal(side.length, 2); assert.ok(side.every(m => m.pen === 'thin'));
  assert.ok(near(Math.abs(side[0].a[0] - side[1].a[0]), minorDiameter(8, 1.25) * bl.views.front.scale, 1e-6), 'Ø6.466 apart');
});

test('section A–A of a mesh body past the explode limit: cut on its own triangles (F1, D50), its cut faces two rings to hatch', () => {
  // A torus round Z (R 20, r 5) of 30,000 triangles, cut by Y = 0: a disc each side of the hole.
  const n = 150, m = 100, P: number[] = [], I: number[] = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const u = 2 * Math.PI * (i + 0.5) / n, v = 2 * Math.PI * j / m; P.push((20 + 5 * Math.cos(v)) * Math.cos(u), (20 + 5 * Math.cos(v)) * Math.sin(u), 5 * Math.sin(v)); }
  const at = (i: number, j: number) => (i % n) * m + (j % m);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) I.push(at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j), at(i + 1, j + 1), at(i, j + 1));
  const doc = withNode(emptyDoc(), { kind: 'mesh', name: 'ring', unit: 'mm', positions: P, indices: I, representation: 'facets' });
  const r = sectionOf(doc, 0);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  assert.equal(r.rings.length, 2);
  const xs = r.rings.map(ring => [Math.min(...ring.map(p => p[0])), Math.max(...ring.map(p => p[0]))]).sort((a, b) => a[0] - b[0]);
  assert.ok(Math.abs(xs[0][0] + 25) < 0.05 && Math.abs(xs[0][1] + 15) < 0.05 && Math.abs(xs[1][0] - 15) < 0.05 && Math.abs(xs[1][1] - 25) < 0.05, JSON.stringify(xs));
});
