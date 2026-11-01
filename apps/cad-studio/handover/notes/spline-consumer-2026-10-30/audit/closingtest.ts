import test from 'node:test';
import assert from 'node:assert/strict';
import { splineOutline } from 'cadsrc/sketch/spline';
import { arcOf } from 'cadsrc/sketch/profile';
import { settleShape } from 'cadsrc/sketch/settle';
import { profileOf } from 'cadsrc/sketch/loops';
import type { SketchShape } from 'cadsrc/sketch/types';

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
  test(`${closed ? 'closed' : 'open'} spline through ${k} points keeps its points, joints smooth, no arc relations`, () => {
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
