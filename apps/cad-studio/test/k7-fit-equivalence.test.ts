import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInterpolatingCurve, buildInterpolatingSurface, evaluateCurve, evaluateSurface, type Curve, type Surface } from '@barocss/cad';
import { averagedKnots, chordParameters, interpolateCurve, interpolateSurface } from '@barocss/cad-model/engine/fit';

// K7 (D146): is the studio's curve and surface fitting (engine/fit.ts) the kernel's certified interpolation
// (buildInterpolatingCurve, buildInterpolatingSurface)? Compared on the same points, parameters and degree: the knots,
// the poles, the curves sampled densely (the largest distance at equal parameters), the through-points; and where they
// differ in kind (counts past the kernel's 16, coordinates past its 10 000 mm, repeated points, closed and degenerate
// inputs). No product code changed: this is the equivalence check D146 records before any move.

type P3 = [number, number, number];
const curveOf = (f: ReturnType<typeof interpolateCurve>): Curve => ({ kind: 'curve', id: 'c', degree: f.degree, knots: f.knots, controlPoints: f.points, weights: f.weights });
const kernelCurve = (pts: readonly P3[], t: readonly number[], degree: number) => buildInterpolatingCurve(pts.map((p, i) => ({ parameter: t[i], pointMM: [...p] as P3 })), { curveId: 'k', degree, maximumBasisEvaluations: 256, maximumEliminationSteps: 120 });
const gap = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** The largest distance between two curves at equal parameters (2001 samples of [0, 1]). */
function curveGap(a: Curve, b: Curve): number { let w = 0; for (let k = 0; k <= 2000; k++) w = Math.max(w, gap(evaluateCurve(a, k / 2000), evaluateCurve(b, k / 2000))); return w; }
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const codeOf = (f: () => unknown) => { try { f(); return 'ok'; } catch (e) { return (e as { code?: string }).code ?? (e as Error).message.slice(0, 60); } };
export const K7: Record<string, unknown> = {};

test('K7 curves: on the same chord parameters and degree, the kernel\'s interpolation is the studio\'s — the same knots and poles within rounding, the curves within 1e-9', () => {
  const r = rng(41), rows: string[] = [];
  const cases: [string, P3[]][] = [['fit.test 9-point', Array.from({ length: 9 }, (_, k) => [k * 2, Math.sin(k) * 3, k * k * 0.1] as P3)]];
  for (let k = 0; k < 30; k++) { const n = 2 + Math.floor(r() * 15); let x = 0; cases.push([`random ${n}`, Array.from({ length: n }, () => { x += 0.5 + r() * 5; return [x, r() * 20 - 10, r() * 20 - 10] as P3; })]); }
  let worstPole = 0, worstCurve = 0, worstThrough = 0, worstKnot = 0;
  for (const [name, pts] of cases) for (const degree of [1, 2, 3]) {
    if (pts.length < degree + 1) continue;
    const t = chordParameters(pts), studio = interpolateCurve(pts, degree), kernel = kernelCurve(pts, t, degree);
    // (The knots: the same averages, summed differently — the kernel from the first parameter, origin + Σ offsets / p: the last bit.)
    assert.equal(kernel.curve.knots.length, studio.knots.length); const knot = Math.max(...studio.knots.map((x, i) => Math.abs(x - kernel.curve.knots[i]))); worstKnot = Math.max(worstKnot, knot);
    assert.ok(knot <= 1e-14, `${name} p${degree}: knots ${knot} apart`);
    const pole = Math.max(...studio.points.map((p, i) => gap(p, kernel.curve.controlPoints[i]))), c = curveGap(curveOf(studio), kernel.curve);
    const through = Math.max(...pts.map((p, i) => Math.max(gap(evaluateCurve(curveOf(studio), t[i]), p), gap(evaluateCurve(kernel.curve, t[i]), p))));
    worstPole = Math.max(worstPole, pole); worstCurve = Math.max(worstCurve, c); worstThrough = Math.max(worstThrough, through);
    assert.ok(c <= 1e-9, `${name} p${degree}: curves ${c} apart`);
  }
  rows.push(`curves: ${cases.length} point sets × degrees 1–3 — knots within ${worstKnot.toExponential(2)}, poles within ${worstPole.toExponential(2)} mm, curves within ${worstCurve.toExponential(2)} mm, through-points within ${worstThrough.toExponential(2)} mm`);
  K7.curves = rows; console.log(rows.join('\n'));
});

test('K7 surfaces: the studio\'s fill and extend grids (16 × 16) against the kernel\'s tensor interpolation on the same averaged parameters', () => {
  // The fill's Coons grid of four edges (a saddle-ish boundary), as directOps.fill builds it: 16 × 16 samples.
  const n = 15, C0 = (u: number): P3 => [20 * u, 0, 3 * Math.sin(Math.PI * u)], C2 = (u: number): P3 => [20 * u, 15, -2 * Math.sin(Math.PI * u)], D0 = (v: number): P3 => [0, 15 * v, 0], D1 = (v: number): P3 => [20, 15 * v, 0];
  const P00 = C0(0), P10 = C0(1), P01 = C2(0), P11 = C2(1);
  const grid = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => { const u = i / n, v = j / n, a = C0(u), b = C2(u), c = D0(v), e = D1(v); return [0, 1, 2].map(k => (1 - v) * a[k] + v * b[k] + (1 - u) * c[k] + u * e[k] - ((1 - u) * (1 - v) * P00[k] + u * (1 - v) * P10[k] + (1 - u) * v * P01[k] + u * v * P11[k])) as P3; }));
  const studio = interpolateSurface(grid);
  // The studio's parameters: chord lengths averaged over the rows and the columns (its own rule, re-derived here).
  const avg = (lists: number[][]) => lists[0].map((_, k) => lists.reduce((s, l) => s + l[k], 0) / lists.length);
  const ub = avg(Array.from({ length: n + 1 }, (_, j) => chordParameters(grid.map(row => row[j])))), vb = avg(grid.map(row => chordParameters(row)));
  assert.deepEqual(studio.knotsU, averagedKnots(ub, 3));
  let kernel: Surface | null = null, why = '';
  try { kernel = buildInterpolatingSurface(ub, vb, grid, { surfaceId: 'k', degreeU: 3, degreeV: 3, maximumBasisEvaluations: 8192, maximumEliminationSteps: 3840, maximumSurfaceEvaluations: 256 }).surface; } catch (e) { why = `${(e as { code?: string }).code}: ${(e as Error).message.slice(0, 160)}`; }
  const S: Surface = { kind: 'surface', id: 's', degreeU: studio.degreeU, degreeV: studio.degreeV, knotsU: studio.knotsU, knotsV: studio.knotsV, controlPoints: studio.points, weights: studio.weights };
  let w = 0;
  if (kernel) for (let a = 0; a <= 40; a++) for (let b = 0; b <= 40; b++) w = Math.max(w, gap(evaluateSurface(S, a / 40, b / 40), evaluateSurface(kernel, a / 40, b / 40)));
  const row = kernel ? `fill grid 16 × 16: the kernel's surface within ${w.toExponential(2)} mm of the studio's (1681 samples)` : `fill grid 16 × 16: the kernel refused — ${why}`;
  // (The cost of each, the same grid.)
  let t0 = performance.now(); for (let i = 0; i < 5; i++) interpolateSurface(grid); const ts = (performance.now() - t0) / 5;
  t0 = performance.now(); for (let i = 0; i < 5; i++) { try { buildInterpolatingSurface(ub, vb, grid, { surfaceId: 'k', degreeU: 3, degreeV: 3, maximumBasisEvaluations: 8192, maximumEliminationSteps: 3840, maximumSurfaceEvaluations: 256 }); } catch { /* reported above */ } } const tk = (performance.now() - t0) / 5;
  const cost = `fill grid 16 × 16: the studio ${ts.toFixed(1)} ms, the kernel's certified build ${tk.toFixed(1)} ms`;
  K7.surfaces = [row, cost]; console.log(row); console.log(cost);
  if (kernel) assert.ok(w <= 1e-9, row);
});

test('K7 where they differ in kind: past 16 points, past 10 000 mm, repeated points, parameters the kernel must be given; neither does tangent ends, periodic curves or least squares', () => {
  const rows: string[] = [];
  const many = Array.from({ length: 64 }, (_, k) => [k, Math.sin(k / 5) * 10, 0] as P3);
  rows.push(`64 points (refit's samples): studio ${codeOf(() => interpolateCurve(many))}, kernel ${codeOf(() => kernelCurve(many, chordParameters(many), 3))}`);
  const big = Array.from({ length: 6 }, (_, k) => [k * 5000, 0, 0] as P3);
  rows.push(`coordinates to 25 000 mm: studio ${codeOf(() => interpolateCurve(big))}, kernel ${codeOf(() => kernelCurve(big, chordParameters(big), 3))}`);
  const rep: P3[] = [[0, 0, 0], [1, 1, 0], [1, 1, 0], [3, 0, 0], [4, 2, 0]];
  rows.push(`a repeated point: studio ${codeOf(() => interpolateCurve(rep))}, kernel ${codeOf(() => kernelCurve(rep, chordParameters(rep), 3))}`);
  const closed: P3[] = [[0, 0, 0], [5, 0, 0], [5, 5, 0], [0, 5, 0], [0, 0, 0]];
  const sc = interpolateCurve(closed), kc = kernelCurve(closed, chordParameters(closed), 3).curve;
  rows.push(`a closed loop (first point = last): both clamped, open in parameter, the ends meeting in position only (studio and kernel ${curveGap(curveOf(sc), kc).toExponential(1)} mm apart); neither periodic`);
  const two: P3[] = [[0, 0, 0], [3, 4, 0]];
  rows.push(`two points: studio degree ${interpolateCurve(two, 3).degree} (lowered to n), kernel at degree 3 ${codeOf(() => kernelCurve(two, [0, 1], 3))}, at degree 1 ${codeOf(() => kernelCurve(two, [0, 1], 1))}`);
  rows.push('end tangents: neither (studio: none; kernel: tangentConstraintsSolved false); least squares (approximateCurve) and knot removal (removeCurveKnot): the studio only — the kernel has neither');
  K7.kinds = rows; console.log(rows.join('\n'));
  assert.notEqual(codeOf(() => kernelCurve(many, chordParameters(many), 3)), 'ok', 'the kernel stops at 16');
  assert.equal(codeOf(() => interpolateCurve(many)), 'ok');
});

test('K7 cost: the kernel\'s certified build (its report, source and model) against the studio\'s plain solve, 16 points cubic', () => {
  const pts = Array.from({ length: 16 }, (_, k) => [k * 2, Math.sin(k) * 3, Math.cos(k * 0.7)] as P3), t = chordParameters(pts);
  for (let i = 0; i < 20; i++) { interpolateCurve(pts); kernelCurve(pts, t, 3); }
  let t0 = performance.now(); for (let i = 0; i < 200; i++) interpolateCurve(pts); const studio = (performance.now() - t0) / 200;
  t0 = performance.now(); for (let i = 0; i < 200; i++) kernelCurve(pts, t, 3); const kernel = (performance.now() - t0) / 200;
  const row = `16-point cubic: the studio's solve ${(studio * 1000).toFixed(0)} µs, the kernel's certified build ${(kernel * 1000).toFixed(0)} µs (${(kernel / studio).toFixed(0)}×)`;
  K7.cost = row; console.log(row);
});
