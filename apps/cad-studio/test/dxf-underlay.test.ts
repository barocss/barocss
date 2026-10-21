import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readDxfSketch } from '@barocss/cad-model/sketch/dxfRead';
import { readUnderlay, splinePoint, UNDERLAY_TOLERANCE, type UnderlayCurve } from '@barocss/cad-model/sketch/dxfUnderlay';

// O68 (A6.4): a DXF drawing's reference underlay — SPLINE, ELLIPSE, INSERT/BLOCK, TEXT and MTEXT — against ezdxf 1.4.5's
// readings of the same files (scripts/dxf-underlay-oracle.py; the fixtures written by it from known numbers): counts by
// type with every block expanded, spline and ellipse points to 1e-9, nested, scaled and mirrored block transforms against
// the closed form, texts' positions and plain strings; every chord within the tolerance; and the underlay never a region.

const DIR = resolve(process.cwd(), '../../packages/barocss-cad/conformance/a6/underlay');
const fixture = (c: string) => readFileSync(join(DIR, c, 'drawing.dxf'), 'utf8');
const oracle = (c: string) => JSON.parse(readFileSync(join(DIR, c, 'oracle.ezdxf-1.4.5.json'), 'utf8'));
type P = [number, number];
const apply = (m: { a: number; b: number; c: number; d: number; e: number; f: number }, p: readonly number[]): P => [m.a * p[0] + m.b * p[1] + m.e, m.c * p[0] + m.d * p[1] + m.f];
function ellipseAt(c: Extract<UnderlayCurve, { type: 'ELLIPSE' }>, t: number): P {
  const [cx, cy] = c.center, [ax, ay] = c.major;
  return apply(c.map, [cx + ax * Math.cos(t) - c.ratio * ay * Math.sin(t), cy + ay * Math.cos(t) + c.ratio * ax * Math.sin(t)]);
}
const curveAt = (c: UnderlayCurve, t: number): P => c.type === 'ELLIPSE' ? ellipseAt(c, t) : apply(c.map, splinePoint(c.degree, c.knots, c.control, c.weights, t));
/** Every chord of a curve's polyline against the curve, densely (1000 points a chord): the largest gap. */
function chordGap(c: UnderlayCurve, line: P[]): number {
  let worst = 0;
  for (let k = 0; k + 1 < c.params.length; k++) {
    const a = line[k], b = line[k + 1], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    for (let j = 1; j < 1000; j++) {
      const p = curveAt(c, c.params[k] + (c.params[k + 1] - c.params[k]) * j / 1000), s = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
      worst = Math.max(worst, Math.hypot(p[0] - a[0] - s * dx, p[1] - a[1] - s * dy));
    }
  }
  return worst;
}

test('splines: as ezdxf reads them (degree, knots, control points, weights), their points at 64 parameters to 1e-9, every chord within 0.01 mm; the fit-points-only one listed, not drawn', () => {
  const u = readUnderlay(fixture('splines'), 1, { detail: true }), o = oracle('splines');
  assert.deepEqual(u.counts, { SPLINE: 3 }); assert.equal(u.left.SPLINE.count, 1); assert.match(u.left.SPLINE.why, /fit points only/);
  const theirs = o.entities.filter((e: { fitOnly?: boolean }) => !e.fitOnly);
  assert.equal(u.curves!.length, theirs.length);
  let worst = 0, gap = 0;
  u.curves!.forEach((c, k) => {
    const e = theirs[k]; assert.equal(c.type, 'SPLINE'); if (c.type !== 'SPLINE') return;
    assert.equal(c.degree, e.degree); assert.deepEqual(c.knots, e.knots); assert.deepEqual(c.control, e.control);
    if (e.weights.length && e.weights.some((w: number) => w !== 1)) assert.deepEqual(c.weights, e.weights); else assert.equal(c.weights, null);
    e.params.forEach((t: number, i: number) => { const p = curveAt(c, t); worst = Math.max(worst, Math.hypot(p[0] - e.points[i][0], p[1] - e.points[i][1])); });
    gap = Math.max(gap, chordGap(c, u.polylines[c.polyline]));
  });
  // (The rational quadratic is a quarter circle of radius 20 about (80, 0): every vertex on it.)
  const arc = u.curves![1]; assert.ok(u.polylines[arc.polyline].every(p => Math.abs(Math.hypot(p[0] - 80, p[1]) - 20) <= 1e-9));
  console.log(`O68 splines: points to ${worst.toExponential(2)} mm of ezdxf's, chords within ${gap.toExponential(3)} mm`);
  assert.ok(worst <= 1e-9, String(worst)); assert.ok(gap <= UNDERLAY_TOLERANCE + 1e-12, String(gap));
});

test('ellipses: full, partial and tilted — their points at ezdxf\'s parameters to 1e-9, every chord within 0.01 mm', () => {
  const u = readUnderlay(fixture('ellipses'), 1, { detail: true }), o = oracle('ellipses');
  assert.deepEqual(u.counts, { ELLIPSE: 3 });
  let worst = 0, gap = 0;
  u.curves!.forEach((c, k) => {
    const e = o.entities[k]; assert.equal(c.type, 'ELLIPSE'); if (c.type !== 'ELLIPSE') return;
    assert.deepEqual([c.center, c.major, c.ratio], [e.center, e.major, e.ratio]);
    e.params.forEach((t: number, i: number) => { const p = curveAt(c, t); worst = Math.max(worst, Math.hypot(p[0] - e.points[i][0], p[1] - e.points[i][1])); });
    gap = Math.max(gap, chordGap(c, u.polylines[c.polyline]));
    // (The polyline's ends at the ellipse's parameter ends.)
    const line = u.polylines[c.polyline], a = curveAt(c, c.start), b = curveAt(c, c.end > c.start ? c.end : c.end + 2 * Math.PI);
    assert.ok(Math.hypot(line[0][0] - a[0], line[0][1] - a[1]) <= 1e-12 && Math.hypot(line.at(-1)![0] - b[0], line.at(-1)![1] - b[1]) <= 1e-9);
  });
  console.log(`O68 ellipses: points to ${worst.toExponential(2)} mm of ezdxf's, chords within ${gap.toExponential(3)} mm`);
  assert.ok(worst <= 1e-9, String(worst)); assert.ok(gap <= UNDERLAY_TOLERANCE + 1e-12, String(gap));
});

test('blocks: nested three deep, scaled (2, −1), rotated, mirrored by the OCS, a 3 × 2 MINSERT — the counts ezdxf expands to, and every circle vertex on its composed transform\'s image, to 1e-9', () => {
  const u = readUnderlay(fixture('blocks'), 1), o = oracle('blocks');
  assert.deepEqual(u.counts, o.inBlocks, 'a circle under the non-uniform scale counted an ELLIPSE, as ezdxf makes it');
  // (The closed form, from the fixture's numbers: T(insertion)·R(rotation)·S(sx, sy)·T(−base); block C's base (1, 2).)
  type M = [number, number, number, number, number, number];
  const mul = (p: M, q: M): M => [p[0] * q[0] + p[1] * q[2], p[0] * q[1] + p[1] * q[3], p[2] * q[0] + p[3] * q[2], p[2] * q[1] + p[3] * q[3], p[0] * q[4] + p[1] * q[5] + p[4], p[2] * q[4] + p[3] * q[5] + p[5]];
  const T = (x: number, y: number): M => [1, 0, 0, 1, x, y], R = (d: number): M => { const t = d * Math.PI / 180; return [Math.cos(t), -Math.sin(t), Math.sin(t), Math.cos(t), 0, 0]; }, S = (x: number, y: number): M => [x, 0, 0, y, 0, 0];
  const C = T(-1, -2), chain = [mul(mul(T(100, 50), R(15)), mul(mul(T(0, 10), R(-45)), mul(S(1.5, 1.5), mul(mul(T(20, 0), R(30)), mul(S(2, -1), C))))), mul(S(-1, 1), mul(T(10, 10), C))];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) chain.push(mul(mul(T(200, 0), R(10)), mul(T(c * 25, r * 15), C)));
  const inv = (m: M): M => { const det = m[0] * m[3] - m[1] * m[2]; const a = m[3] / det, b = -m[1] / det, cc = -m[2] / det, d = m[0] / det; return [a, b, cc, d, -(a * m[4] + b * m[5]), -(cc * m[4] + d * m[5])]; };
  let worst = 0;
  chain.forEach((m, k) => {
    // (Each insert: its circle (r 10 about (5, 0)) then its line ((0, 0) to (15, 5)), in walking order.)
    const circle = u.polylines[2 * k], line = u.polylines[2 * k + 1], back = inv(m);
    for (const v of circle) { const q = [back[0] * v[0] + back[1] * v[1] + back[4], back[2] * v[0] + back[3] * v[1] + back[5]]; worst = Math.max(worst, Math.abs(Math.hypot(q[0] - 5, q[1]) - 10)); }
    const a = [m[4], m[5]], b = [m[0] * 15 + m[1] * 5 + m[4], m[2] * 15 + m[3] * 5 + m[5]];
    worst = Math.max(worst, Math.hypot(line[0][0] - a[0], line[0][1] - a[1]), Math.hypot(line[1][0] - b[0], line[1][1] - b[1]));
  });
  // (And ezdxf's own expansion against the same closed form: its lines' ends; its circles' centres, the OCS −Z one mirrored.)
  const lines = o.blockEntities.filter((e: { type: string }) => e.type === 'LINE'), circles = o.blockEntities.filter((e: { type: string }) => e.type === 'CIRCLE' || e.type === 'ELLIPSE');
  chain.forEach((m, k) => {
    const l = lines[k], a = [m[4], m[5]];
    worst = Math.max(worst, Math.hypot(l.a[0] - a[0], l.a[1] - a[1]));
    const e = circles[k], c = [m[0] * 5 + m[4], m[2] * 5 + m[5]], at = e.extrusion && e.extrusion[2] < 0 ? [-e.center[0], e.center[1]] : e.center;
    worst = Math.max(worst, Math.hypot(at[0] - c[0], at[1] - c[1]));
  });
  console.log(`O68 blocks: ${u.polylines.length} polylines, ${JSON.stringify(u.counts)}; against the closed form to ${worst.toExponential(2)}`);
  assert.ok(worst <= 1e-9, String(worst));
});

test('texts: insertion (the alignment point when aligned), height, rotation and MTEXT\'s plain string as ezdxf reads them', () => {
  const u = readUnderlay(fixture('texts'), 1), o = oracle('texts');
  assert.deepEqual(u.counts, { TEXT: 2, MTEXT: 1 });
  o.entities.forEach((e: { type: string; insert: P; align: P | null; halign?: number; valign?: number; height: number; rotation: number; text: string }, k: number) => {
    const t = u.texts[k], at = e.type === 'TEXT' && (e.halign || e.valign) && e.align ? e.align : e.insert;
    assert.ok(Math.hypot(t.at[0] - at[0], t.at[1] - at[1]) <= 1e-12, `${e.text}: ${t.at} vs ${at}`);
    assert.ok(Math.abs(t.height - e.height) <= 1e-12 && Math.abs(t.angle - e.rotation) <= 1e-9, JSON.stringify([t, e]));
    assert.equal(t.text, e.text);
  });
});

test('the plate: its regions and holes exactly as without the underlay — deep-equal to the same file with the underlay\'s entities deleted; the underlay its spline, text and block', () => {
  const text = fixture('plate'), s = readDxfSketch(text), o = oracle('plate');
  // (The same file, its SPLINE, TEXT and INSERT entities taken out of the ENTITIES section.)
  const lines = text.split(/\r?\n/), out: string[] = [];
  let inEntities = false, skip = false;
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = lines[i].trim(), v = lines[i + 1].trim();
    if (code === '2' && v === 'ENTITIES') inEntities = true;
    if (inEntities && code === '0') { skip = ['SPLINE', 'TEXT', 'INSERT'].includes(v); if (v === 'ENDSEC') inEntities = false; }
    if (!skip) out.push(lines[i], lines[i + 1]);
  }
  const bare = readDxfSketch(out.join('\n') + '\n');
  assert.deepEqual([s.regions, s.holes], [bare.regions, bare.holes], 'the underlay never a region or a hole');
  assert.equal(s.regions.length, 1); assert.equal(s.holes.length, 1);
  assert.deepEqual(s.underlay.counts, { CIRCLE: 1, LINE: 1, SPLINE: 1, TEXT: 1 });
  assert.deepEqual(o.inBlocks, { CIRCLE: 1, LINE: 1 }); assert.equal(o.top.SPLINE, 1); assert.equal(o.top.TEXT, 1);
  assert.deepEqual(bare.underlay.counts, {});
});

test('import_drawing: the plate\'s underlay beside its draft (counts in the result, on the document, scaled with a confirmed width); a splines-only file an underlay alone; text alone still nothing to read', async () => {
  const { dispatchTool } = await import('@barocss/cad-model/chat/tools'), { evaluatePart } = await import('@barocss/cad-model/engine/evaluate'), { emptyDoc } = await import('@barocss/cad-model/engine/doc'), { confirmDimension } = await import('@barocss/cad-model/chat/drafts');
  const evaluate = async (d: Parameters<typeof evaluatePart>[0]) => evaluatePart(d, 1), empty = { doc: emptyDoc(), bodies: [] };
  const r = await dispatchTool(empty, 'import_drawing', { dxf: fixture('plate'), name: 'plate' }, evaluate), c = JSON.parse(r.content);
  assert.ok(!r.isError, r.content); assert.deepEqual(c.underlay, { CIRCLE: 1, LINE: 1, SPLINE: 1, TEXT: 1 }); assert.equal(c.draft, 'F1');
  const u = r.state.doc.underlays!; assert.equal(u.length, 1); assert.equal(u[0].draft, 'F1'); assert.equal(u[0].texts[0].text, 'PLATE 3MM');
  // (The width confirmed at twice the drawing's: the sketch scaled about its corner, and its underlay with it.)
  const doubled = confirmDimension(r.state.doc, 'F1.width', 200, 't'), before = u[0].polylines[0][0], after = doubled.underlays![0].polylines[0][0];
  assert.deepEqual(after, [before[0] * 2, before[1] * 2]); assert.equal(doubled.underlays![0].texts[0].height, 6);
  const s = await dispatchTool(empty, 'import_drawing', { dxf: fixture('splines'), name: 'curves' }, evaluate), sc = JSON.parse(s.content);
  assert.ok(!s.isError, s.content); assert.equal(sc.draft, null); assert.deepEqual(sc.underlay, { SPLINE: 3 }); assert.deepEqual(sc.left_out, { SPLINE: 1 });
  assert.equal(s.state.doc.nodes.length, 0, 'no sketch: nothing becomes geometry'); assert.equal(s.state.doc.underlays!.length, 1);
  const t = await dispatchTool(empty, 'import_drawing', { dxf: fixture('texts'), name: 'notes' }, evaluate);
  assert.ok(t.isError); assert.match(t.content, /DXF_EMPTY/);
});
