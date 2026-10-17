import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCurve, evaluateSurface, curveDomain, surfaceDomain, type Curve, type Surface } from '@barocss/cad';
import { approximateCurve, chordParameters, interpolateCurve, interpolateSurface } from '../src/engine/fit';
import { directOps, emptyDirect, geometryOf, importSource } from '../src/engine/direct';

const asCurve = (f: ReturnType<typeof interpolateCurve>): Curve => ({ kind: 'curve', id: 'c', degree: f.degree, knots: f.knots, controlPoints: f.points, weights: f.weights });
const near = (a: readonly number[], b: readonly number[], tol = 1e-9) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) <= tol;

test('global interpolation passes through every point at its chord-length parameter; least squares keeps the ends', () => {
  const pts: [number, number, number][] = Array.from({ length: 9 }, (_, k) => [k * 2, Math.sin(k) * 3, k * k * 0.1]);
  const f = interpolateCurve(pts), t = chordParameters(pts), c = asCurve(f);
  pts.forEach((p, k) => assert.ok(near(evaluateCurve(c, t[k]), p, 1e-9), `point ${k}`));
  const a = approximateCurve(pts, 5);
  assert.equal(a.points.length, 5); assert.ok(near(a.points[0], pts[0]) && near(a.points[4], pts[8]));
  // A straight row of points fitted with fewer poles is still the line.
  const line: [number, number, number][] = Array.from({ length: 12 }, (_, k) => [k, 2 * k, 0]), l = asCurve(approximateCurve(line, 4));
  for (const u of [0.1, 0.5, 0.9]) { const p = evaluateCurve(l, u); assert.ok(Math.abs(p[1] - 2 * p[0]) < 1e-9); }
});

test('fill: four sides of a square fill it flat; a surface extended past an edge runs on straight', () => {
  const src = `@model sq { version: 0; length-unit: mm;
  @curve #a { type: nurbs; degree: 1; knots: [0,0,1,1]; control-points: [[0,0,0],[10,0,0]]; weights: [1,1]; }
  @curve #b { type: nurbs; degree: 1; knots: [0,0,1,1]; control-points: [[10,10,0],[10,0,0]]; weights: [1,1]; }
  @curve #c { type: nurbs; degree: 1; knots: [0,0,1,1]; control-points: [[10,10,0],[0,10,0]]; weights: [1,1]; }
  @curve #d { type: nurbs; degree: 1; knots: [0,0,1,1]; control-points: [[0,10,0],[0,0,0]]; weights: [1,1]; }
  @surface #panel { type: nurbs; degree-u: 1; degree-v: 1; knots-u: [0,0,1,1]; knots-v: [0,0,1,1]; control-points: [[[0,0,0],[0,10,0]],[[20,0,0],[20,10,0]]]; weights: [[1,1],[1,1]]; } }`;
  let d = importSource(emptyDirect(), src, 'sq');
  const [a, b, c, e, panel] = d.objects.map(o => o.id);
  // In any order, either way round.
  d = directOps.fill(d, [c, a, e, b]);
  const filled = geometryOf(d, d.objects.at(-1)!) as Surface, dom = surfaceDomain(filled);
  for (const [u, v] of [[0.5, 0.5], [0.2, 0.9], [0, 0], [1, 1]]) {
    const p = evaluateSurface(filled, dom.u[0] + (dom.u[1] - dom.u[0]) * u, dom.v[0] + (dom.v[1] - dom.v[0]) * v);
    assert.ok(Math.abs(p[2]) < 1e-9 && p[0] > -1e-9 && p[0] < 10 + 1e-9 && p[1] > -1e-9 && p[1] < 10 + 1e-9, JSON.stringify(p));
  }
  assert.throws(() => directOps.fill(d, [a, b, c, panel]), /Pick a curve|meet end to end/);
  d = directOps.extendSurface(d, panel, 'u-max', 5);
  const ext = geometryOf(d, d.objects.at(-1)!) as Surface, ed = surfaceDomain(ext);
  const far = evaluateSurface(ext, ed.u[1], ed.v[0]); assert.ok(near(far, [25, 0, 0], 1e-6), JSON.stringify(far));
  assert.equal(d.objects.find(o => o.id === panel)!.hidden, true, 'the original is hidden');
  void curveDomain;
});
