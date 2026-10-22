import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, checkBrep, evaluateSurfaceCurvature, nurbsOf } from '../dist/index.js';
import { evaluateSurfaceD1 } from '../dist/derivatives.js';
import { evaluateSurface } from '../dist/math.js';

// R11.2b (D111): a smooth closed freeform body (a SubD body) shelled with faces opened. The wall is the union of the kept
// faces' normal bands, so the shell is the kept faces, their offset (R11.2a's cells, turned inside out) and, along each
// edge between a kept face and an opened one, the band from the edge to its offset (ruled along the kept face's normal),
// cut where the offset's cells meet the edge. No Boolean. The oracle is each kept face's band in closed form:
// ∫∫ (t − Ht² + Kt³/3) dA (H > 0 convex), from the body's own curvature; within the area times the fit's target.
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
/** The kept faces' area and normal bands Σ ∫∫ (t − Ht² + Kt³/3) dA, by 8 × 8 Gauss–Legendre on halves of each knot span. */
function bands(b, t, kept) {
  let A = 0, V = 0;
  for (const f of b.faces) {
    if (!kept(f)) continue;
    const S = nurbsOf(f), sg = f.sense === 'forward' ? 1 : -1, ku = [...new Set(S.knotsU)], kv = [...new Set(S.knotsV)];
    for (let a = 0; a + 1 < ku.length; a++) for (let c = 0; c + 1 < kv.length; c++) for (let su = 0; su < 2; su++) for (let sv = 0; sv < 2; sv++) for (const [x, wx] of GL8) for (const [y, wy] of GL8) {
      const hu = (ku[a + 1] - ku[a]) / 2, hv = (kv[c + 1] - kv[c]) / 2, u = ku[a] + hu * (su + (x + 1) / 2), v = kv[c] + hv * (sv + (y + 1) / 2), r = evaluateSurfaceCurvature(S, u, v), d = evaluateSurfaceD1(S, u, v);
      const J = Math.hypot(...cross(d.du, d.dv)) * hu * hv / 4 * wx * wy;
      A += J; V += (t + sg * r.meanCurvaturePerMM * t * t + r.gaussianCurvaturePerMM2 * t ** 3 / 3) * J;
    }
  }
  return { A, V };
}
const sizeOf = b => Math.max(1, ...b.faces.flatMap(f => nurbsOf(f).controlPoints.flat().flat().map(Math.abs)));
const mid = f => { const S = nurbsOf(f); return evaluateSurface(S, (S.knotsU[0] + S.knotsU.at(-1)) / 2, (S.knotsV[0] + S.knotsV.at(-1)) / 2); };
const shell = (cage, t, open) => [{ id: 's', kind: 'subd', cage }, { id: 'sh', kind: 'shell', target: 's', thickness: t, ...(open ? { open } : {}) }];

test('R11.2b SubD bodies shelled open: the kept faces\' normal bands, within the area times the fit\'s target (refused on HEAD: R11.2b)', () => {
  const W = wheel(6, 4.5), wb = out([{ id: 's', kind: 'subd', cage: W }]).brep, membraneTop = wb.faces.filter(f => mid(f)[2] > 5).map(f => f.name);
  for (const [name, cage, t, pick] of [
    ['cube, its top (4 caps)', CUBE, 0.5, n => /^s\.cap1_/.test(n)],
    ['cube, one cap (its edges cut by the cells)', CUBE, 1, n => n === 's.cap1_0'],
    ['cube, top and bottom (a tube)', CUBE, 0.5, n => /^s\.cap[01]_/.test(n)],
    ['torus 8 × 6, one patch', torusCage(8, 6), 1, n => n === 's.patch0'],
    // (Closed, 0.6 is refused: the membrane is thinner than twice the wall. Opened at the top it is one wall's thickness.)
    ['membrane in a rim, its top', W, 0.6, n => membraneTop.includes(n)],
  ]) {
    const b = out([{ id: 's', kind: 'subd', cage }]).brep, open = b.faces.map(f => f.name).filter(pick), o = out(shell(cage, t, open)), report = checkBrep(o.brep, { strict: true });
    assert.equal(report.valid, true, `${name}: ${report.issues}`);
    assert.equal(o.brep.shells.length, 1, `${name}: one shell`);
    const m = o.massProperties(1), { A, V } = bands(b, t, f => !open.includes(f.name));
    assert.equal(m.method, 'quadrature', name);
    assert.ok(Math.abs(m.volumeMM3 - V) <= A * 1e-6 * sizeOf(b), `${name}: ${m.volumeMM3} vs ${V} (${(m.volumeMM3 - V) / V})`);
    // The kept faces keep their names; the offset's cells and the wall's ends are named after them.
    const names = o.brep.faces.map(f => f.name);
    for (const f of b.faces) assert.equal(names.includes(f.name), !open.includes(f.name), `${name}: ${f.name}`);
    assert.ok(names.some(n => /^sh\.rim\./.test(n)) && names.some(n => /^sh\.in\./.test(n)), name);
  }
});

test('R11.2b refused by name: an opening touching itself at a vertex, every face opened, a wall running out through an opened face; a kept face still folds', () => {
  refused(shell(CUBE, 0.5, ['s.cap1_0', 's.cap1_2']), 'CAPABILITY', /\[OPENING_AT_A_VERTEX\] the opened faces meet the kept ones 2 times round the vertex at \(5, 5, 9\.19\d+\)/);
  const all = out([{ id: 's', kind: 'subd', cage: CUBE }]).brep.faces.map(f => f.name);
  refused(shell(CUBE, 0.5, all), 'CAPABILITY', /every face is opened/);
  const W = wheel(6, 4.5), top = out([{ id: 's', kind: 'subd', cage: W }]).brep.faces.filter(f => mid(f)[2] > 5).map(f => f.name);
  refused(shell(W, 1.1, top), 'CAPABILITY', /\[WALL_TOO_THIN\] the wall of 1\.1 mm inside face s\.patch\d+_\d+ runs out through the opened face s\.patch\d+_\d+, 0\.05\d* mm past it/);
  refused(shell(CUBE, 1.49, ['s.cap1_0']), 'CAPABILITY', /\[OFFSET_FOLDS\] face s\.cap\d_\d curves more tightly than the wall/);
});
