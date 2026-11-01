// D352: a spline keeps its fit points and handle directions: two pieces per span whatever the handles are, a definition that
// round-trips through the document, and every other edit turns it into an ordinary outline.
import test from 'node:test';
import assert from 'node:assert/strict';
import { part, sketch } from '../src/api';
import { evaluateDoc } from '../src/engine/evaluate';
import type { SketchNode, StudioDoc } from '../src/engine/doc';
import { arcOf } from '../src/sketch/profile';
import { outlineOf, profileOf } from '../src/sketch/loops';
import { sketchShapes } from '../src/sketch/reopen';
import { commitDimension, type Polygon } from '../src/sketch/rules';
import { settleShape } from '../src/sketch/settle';
import { respline, splineAutoHandles, splineEditError, splineMatches, splineOutline, splineShape, type SplineDef } from '../src/sketch/spline';

type P2 = [number, number];
const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
const formula = (k: number): P2[] => Array.from({ length: k }, (_, i) => { const t = 2 * Math.PI * i / k; return [r6(40 * Math.cos(t) + 7 * Math.cos(3 * t)), r6(25 * Math.sin(t))]; });
/** Unit tangent at segment i's start (end = false) or end (end = true), in the direction of travel. */
function tangent(s: Polygon, i: number, end: boolean): P2 {
  const n = s.points.length, a = s.points[i], b = s.points[(i + 1) % n], bulge = s.bulges?.[i] ?? 0;
  if (!bulge) { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; }
  const arc = arcOf(a, b, bulge), p = end ? b : a, sign = Math.sign(arc.sweep);
  return [-sign * (p[1] - arc.center[1]) / arc.radius, sign * (p[0] - arc.center[0]) / arc.radius];
}
const turn = (a: P2, b: P2) => Math.abs(Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]));
/** The largest turn between the tangent arriving at a point and the one leaving it. */
function maxTurn(s: Polygon): number {
  const n = s.points.length, from = s.closed ? 0 : 1, to = s.closed ? n : n - 1;
  let worst = 0;
  for (let j = from; j < to; j++) worst = Math.max(worst, turn(tangent(s, (j - 1 + n) % n, true), tangent(s, j, false)));
  return worst;
}
const settle = (s: Polygon) => { const r = settleShape(s, { ...s, closed: false }); assert.equal(r.error, null); return r.shape as Polygon; };
const rad = (h: number) => h * Math.PI / 180;

test('two pieces per span: automatic, handled, straight and failing spans; fit points bitwise at even indices', () => {
  const fit = formula(8);
  const auto = splineShape({ fit, closed: true });
  assert.equal(auto.points.length, 16);
  fit.forEach((p, i) => assert.deepEqual(auto.points[2 * i], p));
  const open = splineShape({ fit: fit.slice(0, 5), closed: false });
  assert.equal(open.points.length, 9);
  fit.slice(0, 5).forEach((p, i) => assert.deepEqual(open.points[2 * i], p));
  const handled = splineShape({ fit, closed: true, handles: [30, null, 100, null, -150, null, null, 5] });
  assert.equal(handled.points.length, 16);
  fit.forEach((p, i) => assert.deepEqual(handled.points[2 * i], p));
  // Straight: halves meeting at the midpoint.
  const straight = splineOutline([[0, 0], [10, 0], [20, 0]], false);
  assert.deepEqual(straight.points, [[0, 0], [5, 0], [10, 0], [15, 0], [20, 0]]);
  assert.deepEqual(straight.bulges, [0, 0, 0, 0, 0]);
  // No biarc (both tangents point back along the chord): halves again.
  const failing = splineOutline([[0, 0], [10, 0]], false, [180, 180]);
  assert.deepEqual(failing.points, [[0, 0], [5, 0], [10, 0]]);
  assert.deepEqual(failing.bulges, [0, 0, 0]);
  assert.match(splineEditError({ fit: [[0, 0], [10, 0]], closed: false, handles: [180, 180] }) ?? '', /no arc pair/);
});

test('with handles the curve leaves each fit point along its handle and every joint is tangent', () => {
  // (Handles turned 25° off the automatic direction at some points.)
  const fit = formula(8), auto = splineAutoHandles(fit, true), handles = auto.map((a, i) => [0, 2, 4, 7].includes(i) ? a + (i % 2 ? -25 : 25) : null);
  const def: SplineDef = { fit, closed: true, handles };
  assert.equal(splineEditError(def), null);
  const s = splineShape(def);
  handles.forEach((h, i) => {
    if (h === null) return;
    const t = tangent(s, 2 * i, false);
    assert.ok(turn(t, [Math.cos(rad(h)), Math.sin(rad(h))]) < 1e-12, `handle ${i}: ${turn(t, [Math.cos(rad(h)), Math.sin(rad(h))])}`);
    assert.ok(turn(tangent(s, (2 * i - 1 + 16) % 16, true), t) <= 1e-9);
  });
  assert.ok(maxTurn(s) <= 1e-9, `turn ${maxTurn(s)}`);
});

test('respline keeps ids, circles, tangents and the outline point count when a handle or a fit point changes', () => {
  const def: SplineDef = { fit: formula(6), closed: true };
  const ids = Array.from({ length: 12 }, (_, i) => `e${i + 1}`);
  const s: Polygon = { ...splineShape(def), ids, circles: [{ c: [0, 0], r: 3 }], circleIds: ['c1'], tangents: [0, 2, 4], lengths: { 1: 5 }, radii: { 0: 4 }, equalRadii: [[0, 2]], concentric: [[0, 4]], hv: { h: [1], v: [] }, rules: [{ kind: 'fix', point: 0 } as never] };
  const a = respline(s, { ...def, handles: [20, null, null, null, null, null] });
  assert.equal(a.points.length, 12);
  assert.deepEqual(a.ids, ids); assert.deepEqual(a.circleIds, ['c1']); assert.deepEqual(a.tangents, [0, 2, 4]); assert.equal(a.circles?.length, 1);
  for (const k of ['lengths', 'radii', 'equalRadii', 'concentric', 'rules', 'hv'] as const) assert.equal(a[k], undefined, k);
  assert.equal(a.fromSpline, true);
  assert.notDeepEqual(a.points, s.points);
  assert.ok(splineMatches(a));
  const b = respline(a, { ...a.spline!, fit: a.spline!.fit.map((p, i) => i === 3 ? [p[0] + 2, p[1] - 1] as P2 : p) });
  assert.equal(b.points.length, 12); assert.deepEqual(b.ids, ids);
  assert.deepEqual(b.points[6], [def.fit[3][0] + 2, def.fit[3][1] - 1]);
});

test('closed spline: settle as closing does, profileOf stores the definition, reopening restores it', () => {
  const def: SplineDef = { fit: formula(6), closed: true, handles: [null, 40, null, null, null, null] };
  const settled = settle(splineShape(def));
  assert.ok(settled.spline && splineMatches(settled));
  const r = profileOf([settled]);
  assert.ok('node' in r, JSON.stringify(r));
  const node = r.node as SketchNode;
  assert.deepEqual(node.outline?.spline, def);
  assert.notEqual(node.outline?.spline, def);
  const back = sketchShapes(node).shape as Polygon;
  assert.equal(back.kind, 'polygon');
  assert.deepEqual(back.spline, def);
  assert.ok(splineMatches(back));
  assert.equal(back.ids?.length, back.points.length);
});

for (const k of [17, 20, 33]) test(`a ${k}-point spline (no stored constraints) still stores its outline and spline`, () => {
  const def: SplineDef = { fit: formula(k), closed: true };
  const s = settle(splineShape(def));
  assert.ok(!s.tangents?.length || k < 17, 'no tangents are stored past the solver limit');
  assert.ok(s.spline && splineMatches(s));
  const o = outlineOf(s);
  assert.ok(o, 'outline stored');
  assert.deepEqual(o.spline, def);
});

test('consistency: other edits turn the spline into an ordinary outline', () => {
  for (const k of [8, 20]) {
    const s = settle(splineShape({ fit: formula(k), closed: true }));
    assert.ok(s.spline);
    // Panel point edit.
    const moved = settleShape({ ...s, points: s.points.map((p, i) => i === 0 ? [p[0] + 1, p[1]] as P2 : p) }, s);
    const m = moved.shape as Polygon;
    assert.ok(!m.spline || splineMatches(m), `point edit k=${k}`);
    if (moved.error === null) { assert.equal(m.spline, undefined); assert.equal(outlineOf(m)?.spline, undefined); }
    // Locking an arc radius (the panel's lock).
    const i = s.bulges!.findIndex(b => b !== 0), locked = settleShape({ ...s, radii: { [i]: Math.round(arcOf(s.points[i], s.points[(i + 1) % s.points.length], s.bulges![i]).radius) + 3 } }, s);
    const l = locked.shape as Polygon;
    assert.ok(!l.spline || splineMatches(l), `lock k=${k}`);
    if (locked.error === null) { assert.equal(l.spline, undefined); assert.equal(outlineOf(l)?.spline, undefined); }
    // A driving dimension through commitDimension then settle (as the app does).
    const c = commitDimension(s, `rad${i}`, arcOf(s.points[i], s.points[(i + 1) % s.points.length], s.bulges![i]).radius + 2);
    if (c.ok) { const d = settleShape(c.shape, s).shape as Polygon; assert.equal(d.spline, undefined, `dimension k=${k}`); assert.equal(outlineOf(d)?.spline, undefined); }
  }
  // The k = 20 spline has nothing else constraining it: its edits settle without error and always drop the spline.
  const s20 = settle(splineShape({ fit: formula(20), closed: true }));
  const e = settleShape({ ...s20, points: s20.points.map((p, i) => i === 0 ? [p[0] + 1, p[1]] as P2 : p) }, s20);
  assert.equal(e.error, null); assert.equal((e.shape as Polygon).spline, undefined);
  // An unmatched spline is never stored.
  assert.equal(outlineOf({ ...s20, points: s20.points.map((p, i) => i === 0 ? [p[0] + 1, p[1]] as P2 : p) })?.spline, undefined);
});

const REFUSED = /no arc pair the model can build/;
test('refusal comes from the generated outline: reversed handles, unbuildable arcs (far centre, tiny line), coincident points; ordinary edits pass', () => {
  const def: SplineDef = { fit: [[0, 0], [10, 5], [20, 0]], closed: false };
  assert.equal(splineEditError(def), null);
  assert.match(splineEditError({ ...def, handles: [null, 180, null] }) ?? '', REFUSED);
  assert.equal(splineEditError({ fit: [[0, 0], [0, 0], [5, 5]], closed: false }) !== null, true);
  assert.equal(splineEditError({ ...def, handles: [10, null, -20] }), null);
  // Near-straight span with both ends level: the biarc exists but one arc's centre is beyond ±10000 mm: refused, not accepted-then-kernel-fail.
  assert.match(splineEditError({ fit: [[0, 0], [30, 0.01], [30, 20], [0, 20]], closed: true, handles: [0, 0, null, null] }) ?? '', REFUSED);
  assert.equal(splineEditError({ fit: [[0, 0], [30, 0.01], [30, 20], [0, 20]], closed: true, handles: [0, null, null, null] }), null);
  // The audit's fuzz case (arc centre at 35 m) and a fit-point edit that makes one: refused.
  assert.match(splineEditError({ fit: [[8.236, 21.735], [-1.799, 27.349], [-33.301, -0.895], [16.738, -14.108], [35.775, -0.558]], closed: true, handles: [null, -187, null, null, 72] }) ?? '', REFUSED);
  assert.match(splineEditError({ fit: [[47, 0], [5.697561, 21.776413], [-30.197561, 14.694631], [-30.197561, -14.694631], [6.697561, -23.776413]], closed: true }) ?? '', REFUSED);
  // Too few points / not numbers.
  assert.notEqual(splineEditError({ fit: [[0, 0], [1, 1]], closed: true }), null);
  assert.notEqual(splineEditError({ fit: [[0, 0], [NaN, 1]], closed: false }), null);
});

test('typing: the prefixes of a wanted handle (1, 17, 170, -, -1) are accepted, and a handle equal to its placeholder is', () => {
  const fit: P2[] = [[40, 0], [20, 3], [0, 0]];
  for (const h of [1, 17, 170, -1, -17, -170, 175, 19, 190]) assert.equal(splineEditError({ fit, closed: false, handles: [null, h, null] }), null, String(h));
  const star: P2[] = [[23.975, 25.288], [-14.246, 29.821], [12.826, -30.181], [21.378, -16.186]], auto = splineAutoHandles(star, true);
  star.forEach((_, i) => assert.equal(splineEditError({ fit: star, closed: true, handles: star.map((__, j) => j === i ? Math.round(auto[i] * 10) / 10 : null) }), null, `placeholder ${i}`));
});

test('panel flow: respline then settleShape against the settled spline keeps the spline, ids and tangents', () => {
  const fit: P2[] = [[0, 0], [20, 10], [20, 30], [-10, 20]], def: SplineDef = { fit, closed: true };
  const s0 = settle(splineShape(def));
  assert.ok(s0.spline);
  const next = { ...def, handles: [30, null, null, null] as (number | null)[] };
  assert.equal(splineEditError(next), null);
  const r = settleShape(respline(s0, next), s0), s1 = r.shape as Polygon;
  assert.equal(r.error, null);
  assert.deepEqual(s1.spline, next); assert.ok(splineMatches(s1));
  assert.equal(s1.points.length, s0.points.length); assert.deepEqual(s1.ids, s0.ids); assert.deepEqual(s1.tangents, s0.tangents);
  assert.ok(turn(tangent(s1, 0, false), [Math.cos(rad(30)), Math.sin(rad(30))]) < 1e-9);
  // A fit-point edit goes through the same path.
  const moved = { ...next, fit: fit.map((p, i) => i === 2 ? [p[0] + 3, p[1]] as P2 : p) };
  assert.equal(splineEditError(moved), null);
  const r2 = settleShape(respline(s1, moved), s1);
  assert.equal(r2.error, null); assert.deepEqual((r2.shape as Polygon).spline, moved);
});

test('near-parallel handles are honoured to 1e-9 rad and the spline survives the settle', () => {
  for (const d of [1, 1e-1, 1e-2, 1e-3, 1e-4, 1e-5, 5e-6]) {
    const def: SplineDef = { fit: [[0, 0], [20, 10]], closed: false, handles: [0, d] }, s = splineShape(def);
    assert.equal(splineEditError(def), null);
    assert.ok(turn(tangent(s, 0, false), [1, 0]) < 1e-9, `leave ${d}`);
    assert.ok(turn(tangent(s, 1, true), [Math.cos(rad(d)), Math.sin(rad(d))]) < 1e-9, `arrive ${d}`);
    assert.ok(turn(tangent(s, 0, true), tangent(s, 1, false)) < 1e-9, `joint ${d}`);
  }
  const fit: P2[] = [[0, 0], [20, 10], [20, 30], [-10, 20]], s0 = settle(splineShape({ fit, closed: true }));
  for (const h of [1, 0.1, 0.01, 0.001, 0.0001]) {
    const def: SplineDef = { fit, closed: true, handles: [0, h, null, null] }, r = settleShape(respline(s0, def), s0);
    assert.equal(r.error, null); assert.ok((r.shape as Polygon).spline, `h=${h}`);
  }
});

test('a dimension or explicit relation drops the spline at the commit; tangents and hv do not', () => {
  const s = settle(splineShape({ fit: formula(8), closed: true })), i = s.bulges!.findIndex(b => b !== 0), n = s.points.length;
  const radius = arcOf(s.points[i], s.points[(i + 1) % n], s.bulges![i]).radius;
  // Dimensioning at the measured value (no change of geometry) still makes it an ordinary outline, at once.
  const locked = settleShape({ ...s, radii: { [i]: radius } }, s).shape as Polygon;
  assert.equal(locked.spline, undefined); assert.equal(outlineOf(locked)?.spline, undefined);
  const lengths = settleShape({ ...s, lengths: { 0: Math.hypot(s.points[1][0] - s.points[0][0], s.points[1][1] - s.points[0][1]) } }, s).shape as Polygon;
  assert.equal(lengths.spline, undefined);
  const rules = settleShape({ ...s, rules: [{ kind: 'distance', a: 0, b: 4, value: Math.hypot(s.points[4][0] - s.points[0][0], s.points[4][1] - s.points[0][1]) }] }, s);
  assert.equal(rules.error, null);
  assert.equal((rules.shape as Polygon).spline, undefined);
  const kept = settleShape({ ...s, tangents: s.tangents ?? [], hv: { h: [], v: [] } }, s).shape as Polygon;
  assert.ok(kept.spline && splineMatches(kept));
});

test('a malformed stored spline is ignored on reopen (no throw); a well-formed one is restored', () => {
  const def: SplineDef = { fit: formula(6), closed: true, handles: [null, 40, null, null, null, null] };
  const r = profileOf([settle(splineShape(def))]);
  assert.ok('node' in r);
  const node = { ...r.node, id: 'n0' } as unknown as SketchNode, fit = def.fit;
  const bad: unknown[] = [{}, { fit: null, closed: true }, { fit: 'x', closed: true }, { fit: [[0], [1, 2], [3, 4]], closed: true }, { fit: [[0, 0]], closed: true },
    { fit, closed: 1 }, { fit }, { fit, closed: true, handles: [1, 2] }, { fit, closed: true, handles: 'x' }, { fit, closed: true, handles: fit.map(() => NaN) }, { fit: [[0, 0], [1, NaN]], closed: false }];
  for (const sp of bad) {
    const shape = sketchShapes({ ...node, outline: { ...node.outline!, spline: sp } } as SketchNode).shape as Polygon;
    assert.equal(shape.kind, 'polygon'); assert.equal(shape.spline, undefined, JSON.stringify(sp)); assert.equal(shape.fromSpline, undefined);
  }
  assert.deepEqual((sketchShapes(node).shape as Polygon).spline, def);
});

test('closing keeps the definition across scales (the match tolerance holds at close)', () => {
  let seed = 5;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  let kept = 0;
  for (let it = 0; it < 100; it++) {
    const scale = [1, 10, 100, 1000, 4000][it % 5], off = rnd() < 0.3 ? Math.round(rnd() * 4000) : 0, n = 3 + Math.floor(rnd() * 14);
    const angs = Array.from({ length: n }, () => rnd() * 2 * Math.PI).sort((a, b) => a - b);
    const fit: P2[] = angs.map(a => { const r = scale * (0.4 + 0.6 * rnd()); return [Math.round((off + r * Math.cos(a)) * 1000) / 1000, Math.round(r * Math.sin(a) * 1000) / 1000] as P2; });
    const first = splineShape({ fit, closed: true }), r = settleShape(first, { ...first, closed: false });
    if (r.error) continue;
    assert.ok((r.shape as Polygon).spline, `iteration ${it} scale ${scale}`);
    kept++;
  }
  assert.ok(kept > 50, `only ${kept} closed`);
});

test('downstream: a closed spline extrudes; a handle change keeps the side names', () => {
  const def: SplineDef = { fit: formula(6), closed: true };
  // Non-default ids (e5…e16): respline must carry them, or the side names would change.
  const named = { ...settle(splineShape(def)), ids: Array.from({ length: 12 }, (_, i) => `e${i + 5}`) };
  const first = profileOf([named]);
  assert.ok('node' in first);
  assert.deepEqual(first.node.sideTags?.outer, named.ids);
  const node = { ...first.node, id: 'n0' } as unknown as SketchNode;
  const base = part('d352').extrude(sketch().polygon([[0, 0], [10, 0], [10, 10], [0, 10]]), { h: 10 }).doc;
  const start: StudioDoc = { ...base, nodes: base.nodes.map((n, i) => i === 0 ? node : n) };
  const r = evaluateDoc(start, 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  assert.ok(part('x', start).mass({ density: 1 }).volume > 0);
  const shape = sketchShapes(node).shape as Polygon;
  const next = respline(shape, { ...def, handles: [null, null, splineAutoHandles(def.fit, true)[2] + 20, null, null, null] });
  assert.equal(splineEditError(next.spline!), null);
  assert.deepEqual(next.ids, named.ids);
  const second = profileOf([next]);
  assert.ok('node' in second);
  assert.deepEqual(second.node.sideTags, node.sideTags);
  assert.deepEqual(second.node.sideTags?.outer, named.ids);
  const after: StudioDoc = { ...base, nodes: base.nodes.map((n, i) => i === 0 ? { ...second.node, id: 'n0' } as unknown as SketchNode : n) };
  const r2 = evaluateDoc(after, 1);
  assert.ok(r2.ok, JSON.stringify(!r2.ok && r2.error));
  assert.ok(Math.abs(part('x', after).mass({ density: 1 }).volume - part('x', start).mass({ density: 1 }).volume) > 1e-6, 'the handle changed the shape');
});

test('a 2.5 m spline keeps its definition through the closing solve', () => {
  const fit: P2[] = [[2145, 174], [1188, 1091], [1053, 2103], [-544, 1763], [-1490, 1812], [-1187, 676], [-2566, -833], [-2026, -1387], [-486, -1404], [129, -1451], [1013, -946], [2504, -603]];
  const s = settle(splineShape({ fit, closed: true }));
  assert.ok(s.spline, 'the solver-scale point moves stay within the match tolerance');
});

// D352 actual run01: the Spline tool's first click shows a one-point spline; its SPLINE section asked for automatic
// handles and crashed the app (splineTangents of one point).
test('automatic handles of a one-point spline are defined (the first click of the Spline tool)', () => {
  assert.deepEqual(splineAutoHandles([[3, 4]], false), [0]);
  assert.deepEqual(splineAutoHandles([[3, 4], [3, 4]], false), [0, 0]);
});
