import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { approximateCurvePlain, averagedKnots, buildInterpolatingCurve, buildInterpolatingSurface, chordParameters, evaluateCurve, evaluateSurface, interpolateCurvePlain, interpolateSurfacePlain, removeCurveKnotPlain } from '../dist/index.js';
import { cases } from './k7b-fit-cases.mjs';

// K7b (D147), from K7's equivalence check (D146): the kernel's plain fitting (fit-plain.ts) against two oracles —
// the kernel's certified interpolation where both apply (the same knots and poles to rounding), and for the rest
// (more than 16 points, past 10 000 mm, least squares, knot removal, lowered degrees, refusals) the outputs of the
// studio's engine/fit.ts it replaced, frozen before the move (fixtures/k7b-fit-plain.json): equal bit for bit.

const curveOf = f => ({ kind: 'curve', id: 'c', degree: f.degree, knots: f.knots, controlPoints: f.points, weights: f.weights });
const kernelCurve = (pts, t, degree) => buildInterpolatingCurve(pts.map((p, i) => ({ parameter: t[i], pointMM: [...p] })), { curveId: 'k', degree, maximumBasisEvaluations: 256, maximumEliminationSteps: 120 });
const gap = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
function curveGap(a, b) { let w = 0; for (let k = 0; k <= 2000; k++) w = Math.max(w, gap(evaluateCurve(a, k / 2000), evaluateCurve(b, k / 2000))); return w; }
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const codeOf = f => { try { f(); return 'ok'; } catch (e) { return e.code ?? e.message.slice(0, 60); } };
const err = f => { try { return f(); } catch (e) { return { error: e.message }; } };

test('K7b plain against certified: curves on the same chord parameters (31 sets × degrees 1–3) and the fill\'s 16 × 16 surface, equal to rounding', t => {
  const r = rng(41), sets = [Array.from({ length: 9 }, (_, k) => [k * 2, Math.sin(k) * 3, k * k * 0.1])];
  for (let k = 0; k < 30; k++) { const n = 2 + Math.floor(r() * 15); let x = 0; sets.push(Array.from({ length: n }, () => { x += 0.5 + r() * 5; return [x, r() * 20 - 10, r() * 20 - 10]; })); }
  let worstKnot = 0, worstPole = 0, worstCurve = 0;
  for (const pts of sets) for (const degree of [1, 2, 3]) {
    if (pts.length < degree + 1) continue;
    const tt = chordParameters(pts), plain = interpolateCurvePlain(pts, degree), cert = kernelCurve(pts, tt, degree).curve;
    // (The knots: the same averages summed differently — the certified one as origin + Σ offsets / p: the last bit.)
    worstKnot = Math.max(worstKnot, ...plain.knots.map((x, i) => Math.abs(x - cert.knots[i])));
    worstPole = Math.max(worstPole, ...plain.points.map((p, i) => gap(p, cert.controlPoints[i])));
    worstCurve = Math.max(worstCurve, curveGap(curveOf(plain), cert));
  }
  assert.ok(worstKnot <= 1e-14 && worstPole <= 1e-12 && worstCurve <= 1e-12, `${worstKnot} ${worstPole} ${worstCurve}`);
  const grid = cases().surfaces[0].grid, plainS = interpolateSurfacePlain(grid);
  const avg = lists => lists[0].map((_, k) => lists.reduce((s, l) => s + l[k], 0) / lists.length);
  const ub = avg(Array.from({ length: 16 }, (_, j) => chordParameters(grid.map(row => row[j])))), vb = avg(grid.map(row => chordParameters(row)));
  assert.deepEqual(plainS.knotsU, averagedKnots(ub, 3));
  const certS = buildInterpolatingSurface(ub, vb, grid, { surfaceId: 'k', degreeU: 3, degreeV: 3, maximumBasisEvaluations: 8192, maximumEliminationSteps: 3840, maximumSurfaceEvaluations: 256 }).surface;
  const S = { kind: 'surface', id: 's', degreeU: 3, degreeV: 3, knotsU: plainS.knotsU, knotsV: plainS.knotsV, controlPoints: plainS.points, weights: plainS.weights };
  let w = 0; for (let a = 0; a <= 40; a++) for (let b = 0; b <= 40; b++) w = Math.max(w, gap(evaluateSurface(S, a / 40, b / 40), evaluateSurface(certS, a / 40, b / 40)));
  assert.ok(w <= 1e-12, `surface ${w}`);
  t.diagnostic(`curves: knots ${worstKnot.toExponential(1)}, poles ${worstPole.toExponential(1)} mm, curves ${worstCurve.toExponential(1)} mm; the 16 × 16 surface ${w.toExponential(1)} mm`);
});

test('K7b plain against the studio\'s old outputs: interpolation past 16 points and 10 000 mm, lowered degrees, least squares, knot removal, the surface tensor, a refusal — bit for bit', () => {
  const c = cases(), want = JSON.parse(readFileSync(new URL('./fixtures/k7b-fit-plain.json', import.meta.url), 'utf8'));
  const got = JSON.parse(JSON.stringify({
    curves: c.curves.map(x => err(() => interpolateCurvePlain(x.points, x.degree))),
    approx: c.approx.map(a => err(() => approximateCurvePlain(c.curves[a.from].points, a.count))),
    removals: c.removals.map(x => err(() => removeCurveKnotPlain(x.c, x.u, x.tol))),
    surfaces: c.surfaces.map(s => err(() => interpolateSurfacePlain(s.grid, s.p, s.q))),
    repeated: err(() => interpolateCurvePlain([[0, 0, 0], [1, 1, 0], [1, 1, 0], [3, 0, 0], [4, 2, 0]])),
  }));
  // (JSON keeps the shortest round-tripping decimal of each double: equal text is equal bits.)
  assert.deepEqual(got, want);
  assert.equal(got.curves[2].degree, 1, 'two points at degree 3: lowered to 1');
  assert.deepEqual(got.removals.map(x => x === null ? null : x.points.length), [5, 6, null, null], 'two knots out again, two kept');
  assert.match(got.repeated.error, /cannot be fitted/);
});

test('K7b where the two paths differ in kind: the plain one takes what the certified one refuses; neither does end tangents or periodic curves', () => {
  const many = Array.from({ length: 64 }, (_, k) => [k, Math.sin(k / 5) * 10, 0]), big = Array.from({ length: 6 }, (_, k) => [k * 5000, 0, 0]);
  assert.equal(codeOf(() => interpolateCurvePlain(many)), 'ok'); assert.equal(codeOf(() => kernelCurve(many, chordParameters(many), 3)), 'INPUT');
  assert.equal(codeOf(() => interpolateCurvePlain(big)), 'ok'); assert.equal(codeOf(() => kernelCurve(big, chordParameters(big), 3)), 'INPUT');
  assert.equal(interpolateCurvePlain([[0, 0, 0], [3, 4, 0]], 3).degree, 1); assert.equal(codeOf(() => kernelCurve([[0, 0, 0], [3, 4, 0]], [0, 1], 3)), 'INPUT');
  const closed = [[0, 0, 0], [5, 0, 0], [5, 5, 0], [0, 5, 0], [0, 0, 0]];
  assert.ok(curveGap(curveOf(interpolateCurvePlain(closed)), kernelCurve(closed, chordParameters(closed), 3).curve) <= 1e-12, 'a closed loop: both clamped, the same');
  assert.throws(() => approximateCurvePlain(many, 70), /a fit needs 4 to 64 poles/, 'more poles than points: refused');
});

test('K7b cost: the plain fit against the certified build, 16 points cubic and the 16 × 16 surface', t => {
  const pts = Array.from({ length: 16 }, (_, k) => [k * 2, Math.sin(k) * 3, Math.cos(k * 0.7)]), tt = chordParameters(pts);
  for (let i = 0; i < 20; i++) { interpolateCurvePlain(pts); kernelCurve(pts, tt, 3); }
  let t0 = performance.now(); for (let i = 0; i < 200; i++) interpolateCurvePlain(pts); const plain = (performance.now() - t0) / 200;
  t0 = performance.now(); for (let i = 0; i < 200; i++) kernelCurve(pts, tt, 3); const cert = (performance.now() - t0) / 200;
  const grid = cases().surfaces[0].grid; t0 = performance.now(); for (let i = 0; i < 5; i++) interpolateSurfacePlain(grid); const ps = (performance.now() - t0) / 5;
  t.diagnostic(`16-point cubic: plain ${(plain * 1000).toFixed(0)} µs, certified ${(cert * 1000).toFixed(0)} µs; the 16 × 16 surface plain ${ps.toFixed(1)} ms`);
});
