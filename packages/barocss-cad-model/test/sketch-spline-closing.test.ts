import test from 'node:test';
import assert from 'node:assert/strict';
import { splineOutline } from '../src/sketch/spline';
import { arcOf } from '../src/sketch/profile';
import { settleShape } from '../src/sketch/settle';
import { profileOf } from '../src/sketch/loops';
import type { SketchShape } from '../src/sketch/types';

type P2 = [number, number];
type Poly = Extract<SketchShape, { kind: 'polygon' }>;
const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
const formula = (k: number): P2[] => Array.from({ length: k }, (_, i) => { const t = 2 * Math.PI * i / k; return [r6(40 * Math.cos(t) + 7 * Math.cos(3 * t)), r6(25 * Math.sin(t))]; });
/** The shape as the Viewport emits it. */
const splineShape = (fit: P2[], closed: boolean): Poly => { const o = splineOutline(fit, closed); return { kind: 'polygon', points: o.points, bulges: o.bulges, closed, fromSpline: true }; };
/** Unit tangent at segment i's start (end = false) or end (end = true), in the direction of travel. */
function tangent(s: Poly, i: number, end: boolean): P2 {
  const n = s.points.length, a = s.points[i], b = s.points[(i + 1) % n], bulge = s.bulges?.[i] ?? 0;
  if (!bulge) { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; }
  const arc = arcOf(a, b, bulge), p = end ? b : a, sign = Math.sign(arc.sweep);
  return [-sign * (p[1] - arc.center[1]) / arc.radius, sign * (p[0] - arc.center[0]) / arc.radius];
}
/** The largest turn between the tangent arriving at a point and the one leaving it. */
function maxTurn(s: Poly): number {
  const n = s.points.length, from = s.closed ? 0 : 1, to = s.closed ? n : n - 1;
  let worst = 0;
  for (let j = from; j < to; j++) {
    const a = tangent(s, (j - 1 + n) % n, true), b = tangent(s, j, false);
    worst = Math.max(worst, Math.abs(Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1])));
  }
  return worst;
}
const settle = (s: Poly) => { const r = settleShape(s, { ...s, closed: false }); assert.equal(r.error, null); return r.shape as Poly; };

const cases: [number, boolean][] = [...[3, 4, 5, 8, 12, 16, 17, 20].map((k): [number, boolean] => [k, true]), [5, false]];
for (const [k, closed] of cases) {
  // (An open spline is not settled, and past 64 solver points/segments the solver refuses, so for those cases the
  // point and relation checks hold trivially; the smoothness check is the one that bites.)
  test(`${closed ? 'closed' : 'open'} spline through ${k} points: points kept, joints smooth, no arc relations`, () => {
    const fit = formula(k), out = settle(splineShape(fit, closed));
    for (const p of fit) assert.ok(out.points.some(q => q[0] === p[0] && q[1] === p[1]), `fit point ${p} kept bitwise`);
    assert.ok(maxTurn(out) <= 1e-9, `turn ${maxTurn(out)}`);
    assert.equal(out.equalRadii?.length ?? 0, 0);
    assert.equal(out.concentric?.length ?? 0, 0);
    if (closed && k < 17) for (let j = 0; j < out.points.length; j++) assert.ok(out.tangents?.includes(j), `tangent at point ${j}`);
    if (closed) assert.ok('node' in profileOf([out]), 'profileOf succeeds');
  });
}

test('a hand-drawn outline with two nearly equal arcs still gets its inferred equal-radius pair', () => {
  const s: Poly = { kind: 'polygon', points: [[0, 0], [20, 0], [20, 10], [0, 10]], bulges: [0.5, 0, 0.51, 0], closed: true };
  const out = settle(s);
  assert.ok(out.equalRadii?.some(p => p[0] === 0 && p[1] === 2), JSON.stringify(out.equalRadii));
});

// D351 audit F1: at metre scale the unrounded joints still turn ~1e-8 rad measured from arcOf's centre, so the tangent
// solve takes steps and the clicked points move — by solver-scale amounts only (base moved them by up to 3.84 mm here).
test('a 2.5 m spline: clicked points stay within 1e-5 mm, joints within 1e-9 rad, no arc relations', () => {
  const fit: P2[] = [[2145, 174], [1188, 1091], [1053, 2103], [-544, 1763], [-1490, 1812], [-1187, 676], [-2566, -833], [-2026, -1387], [-486, -1404], [129, -1451], [1013, -946], [2504, -603]];
  const out = settle(splineShape(fit, true));
  const moved = Math.max(...fit.map(p => Math.min(...out.points.map(q => Math.hypot(q[0] - p[0], q[1] - p[1])))));
  assert.ok(moved <= 1e-5, `moved ${moved}`);
  assert.ok(maxTurn(out) <= 1e-9, `turn ${maxTurn(out)}`);
  assert.equal(out.equalRadii?.length ?? 0, 0); assert.equal(out.concentric?.length ?? 0, 0);
});
