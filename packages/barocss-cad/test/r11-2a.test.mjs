import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, checkBrep, evaluateSurfaceCurvature, nurbsOf } from '../dist/index.js';
import { evaluateSurfaceD1 } from '../dist/core/derivatives.js';
import { derivativesForTest } from '../dist/blend/offset-cavity.js';
import { evaluateSurfaceD2 } from '../dist/core/second-derivatives.js';

// R11.2a (D110): a closed body whose faces all meet smoothly (a SubD body) shelled as its cavity — every face offset by
// the wall and fitted (cubic, the face's knots each once more, refined; cells where the 16-pole cap or the target needs
// them), on the body's own topology, no Boolean. The oracle is Steiner's formula with A, M = ∫H dA and ∫K dA from the
// body's own curvature: the hollow encloses V − At + Mt² − (2πχ/3)t³. The fit is within 1e-6 of the body's size; the
// volume within the area times that.
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const out = features => evaluateCadPart(D(features)).outputs.at(-1);
const refused = (features, code, pattern) => assert.throws(() => out(features), e => e.code === code && pattern.test(e.message), String(pattern));
const CUBE = { positions: [0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0, 0, 0, 10, 10, 0, 10, 10, 10, 10, 0, 10, 10], faces: [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]] };
function torusCage(n, m, R = 20, r = 6) {
  const positions = [], faces = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const a = 2 * Math.PI * i / n, c = 2 * Math.PI * j / m; positions.push((R + r * Math.cos(c)) * Math.cos(a), (R + r * Math.cos(c)) * Math.sin(a), r * Math.sin(c)); }
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const i1 = (i + 1) % n, j1 = (j + 1) % m; faces.push([i * m + j, i1 * m + j, i1 * m + j1, i * m + j1]); }
  return { positions, faces };
}
/** A box cage on an n × n grid of 10 mm, its inner (n − 1)² vertices pushed in `dip` from top and bottom: a membrane in a rim. */
function wheel(n, dip) {
  const m = n + 1, positions = [], faces = [], inner = (i, j) => i >= 1 && i <= n - 1 && j >= 1 && j <= n - 1, T = (i, j) => i * m + j, B = (i, j) => m * m + i * m + j;
  for (const top of [true, false]) for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) positions.push(i * 10, j * 10, top ? (inner(i, j) ? 10 - dip : 10) : (inner(i, j) ? dip : 0));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { faces.push([T(i, j), T(i + 1, j), T(i + 1, j + 1), T(i, j + 1)]); faces.push([B(i, j), B(i, j + 1), B(i + 1, j + 1), B(i + 1, j)]); }
  for (let i = 0; i < n; i++) { faces.push([B(i, 0), B(i + 1, 0), T(i + 1, 0), T(i, 0)]); faces.push([B(i + 1, n), B(i, n), T(i, n), T(i + 1, n)]); faces.push([B(0, i + 1), B(0, i), T(0, i), T(0, i + 1)]); faces.push([B(n, i), B(n, i + 1), T(n, i + 1), T(n, i)]); }
  return { positions, faces };
}
const GL8 = [[-0.9602898564975363, 0.1012285362903763], [-0.7966664774136267, 0.2223810344533745], [-0.5255324099163290, 0.3137066458778873], [-0.1834346424956498, 0.3626837833783620], [0.1834346424956498, 0.3626837833783620], [0.5255324099163290, 0.3137066458778873], [0.7966664774136267, 0.2223810344533745], [0.9602898564975363, 0.1012285362903763]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** A, ∫H dA (H > 0 where convex, outward normals) and ∫K dA, by 8 × 8 Gauss–Legendre on each knot span (the kernel's own curvature). */
function steiner(b) {
  let A = 0, M = 0, K = 0;
  for (const f of b.faces) {
    const S = nurbsOf(f), sg = f.sense === 'forward' ? 1 : -1, ku = [...new Set(S.knotsU)], kv = [...new Set(S.knotsV)];
    for (let a = 0; a + 1 < ku.length; a++) for (let c = 0; c + 1 < kv.length; c++) for (const [x, wx] of GL8) for (const [y, wy] of GL8) {
      const hu = ku[a + 1] - ku[a], hv = kv[c + 1] - kv[c], u = ku[a] + hu * (x + 1) / 2, v = kv[c] + hv * (y + 1) / 2, r = evaluateSurfaceCurvature(S, u, v), d = evaluateSurfaceD1(S, u, v);
      const J = Math.hypot(...cross(d.du, d.dv)) * hu * hv / 4 * wx * wy;
      A += J; M += -sg * r.meanCurvaturePerMM * J; K += r.gaussianCurvaturePerMM2 * J;
    }
  }
  return { A, M, K };
}
/** The body's size: the largest coordinate of its control points (the fit's target is 1e-6 of it). */
const sizeOf = b => Math.max(1, ...b.faces.flatMap(f => nurbsOf(f).controlPoints.flat().flat().map(Math.abs)));

test('R11.2a the route\'s own derivatives (the faces checked once) are the kernel\'s, to rounding', () => {
  const xz = { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] };
  let worst = 0;
  for (const feats of [[{ id: 's', kind: 'subd', cage: CUBE }], [{ id: 's', kind: 'subd', cage: torusCage(8, 6) }], [{ id: 'q', kind: 'sketch', profile: 'circle', center: [12, 0], radius: 3, plane: xz }, { id: 's', kind: 'revolve', sketch: 'q', axis: { origin: [0, 0], direction: 'y' } }]]) {
    for (const f of out(feats).brep.faces.slice(0, 6)) {
      const S = nurbsOf(f), sg = f.sense === 'forward' ? 1 : -1, U = S.knotsU, V = S.knotsV;
      for (const [x, y] of [[0.13, 0.37], [0.61, 0.29], [0.9, 0.77]]) {
        const u = U[0] + (U.at(-1) - U[0]) * x, v = V[0] + (V.at(-1) - V[0]) * y, a = evaluateSurfaceD2(S, u, v), m = derivativesForTest(f, u, v), r = evaluateSurfaceCurvature(S, u, v);
        const k = Math.max(-sg * r.principalCurvaturesPerMM[0], -sg * r.principalCurvaturesPerMM[1]);
        for (const [p, q] of [['point', 'P'], ['du', 'Su'], ['dv', 'Sv'], ['duu', 'Suu'], ['duv', 'Suv'], ['dvv', 'Svv']]) worst = Math.max(worst, Math.hypot(...a[p].map((z, i) => z - m[q][i])) / (1 + Math.hypot(...a[p])));
        worst = Math.max(worst, Math.abs(k - m.convex) / (1 + Math.abs(k)));
      }
    }
  }
  assert.ok(worst < 1e-12, `${worst}`);
});

test('R11.2a SubD bodies shelled closed: their cavity Steiner\'s, within the area times the fit\'s target (refused on HEAD: freeform faces)', () => {
  for (const [name, cage, ts] of [['cube', CUBE, [0.5, 1.47]], ['torus 8 × 6', torusCage(8, 6), [2]], ['torus 16 × 8 (faces of 13 spans: cells past the pole cap)', torusCage(16, 8), [1]], ['membrane in a rim', wheel(6, 4.5), [0.5]]]) {
    const body = out([{ id: 's', kind: 'subd', cage }]), b = body.brep, V = body.massProperties(1).volumeMM3, { A, M, K } = steiner(b), target = 1e-6 * sizeOf(b);
    for (const t of ts) {
      const o = out([{ id: 's', kind: 'subd', cage }, { id: 'sh', kind: 'shell', target: 's', thickness: t }]), report = checkBrep(o.brep, { strict: true });
      assert.equal(report.valid, true, `${name} t ${t}: ${report.issues}`);
      assert.equal(o.brep.shells.length, 2, `${name} t ${t}: one cavity`);
      const m = o.massProperties(1), exact = A * t - M * t * t + K / 3 * t ** 3;
      assert.equal(m.method, 'quadrature', `${name} t ${t}`);
      assert.ok(Math.abs(m.volumeMM3 - exact) <= A * target, `${name} t ${t}: ${m.volumeMM3} vs ${exact} (${(m.volumeMM3 - exact) / exact})`);
    }
  }
});

test('R11.2a refused by name: a wall past the tightest curvature (the cube\'s caps 1.480 mm, on their boundary), a membrane thinner than twice the wall', () => {
  const shell = (cage, t, open) => [{ id: 's', kind: 'subd', cage }, { id: 'sh', kind: 'shell', target: 's', thickness: t, ...(open ? { open } : {}) }];
  // (Interior samples alone found 1.509 at S0, D105; the tightest lies on a cap's side beside its extraordinary corner.)
  refused(shell(CUBE, 1.49), 'CAPABILITY', /\[OFFSET_FOLDS\] face s\.cap\d_\d curves more tightly than the wall .*its radius there 1\.4801\d mm, the wall 1\.49 mm/);
  refused(shell(wheel(6, 4.5), 0.6), 'CAPABILITY', /\[WALL_TOO_THIN\] the wall of 0\.6 mm inside face s\.patch\d+_\d+ comes 0\.[0-5]\d* mm from face s\.patch\d+_\d+: the body is thinner than twice the wall/);
  // (An opened face was refused here until R11.2b, D111: r11-2b.test.mjs.)
});
