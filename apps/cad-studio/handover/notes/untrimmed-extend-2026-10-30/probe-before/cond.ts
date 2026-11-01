import { chordParameters, averagedKnots, plainBasis, plainFindSpan, evaluateSurface, interpolateSurfacePlain } from '@barocss/cad';
const A=[7,-11,13],U=[3,4,0],V=[0,0,2];
const S = (u: number, v: number) => [0,1,2].map(k => A[k] + (u-2)*U[k] + (v+1)*V[k]) as [number,number,number];
const avg = (ls: number[][]) => ls[0].map((_, k) => ls.reduce((s, l) => s + l[k], 0) / ls.length);
function invNorm(t: number[], p: number) {
  const n = t.length - 1, K = averagedKnots(t, p);
  const M = t.map(u => { const row = Array(n + 1).fill(0), s = plainFindSpan(n, p, u, K), N = plainBasis(s, u, p, K); for (let k = 0; k <= p; k++) row[s - p + k] = N[k]; return row; });
  // Inverse by Gauss-Jordan
  const W = M.map((r, i) => [...r, ...r.map((_, j) => (i === j ? 1 : 0))]), m = n + 1;
  for (let c = 0; c < m; c++) { let pv = c; for (let r = c + 1; r < m; r++) if (Math.abs(W[r][c]) > Math.abs(W[pv][c])) pv = r; [W[c], W[pv]] = [W[pv], W[c]];
    for (let r = 0; r < m; r++) { if (r === c) continue; const f = W[r][c] / W[c][c]; if (f) for (let k = c; k < 2 * m; k++) W[r][k] -= f * W[c][k]; } }
  return Math.max(...W.map((r, i) => r.slice(m).reduce((s, x) => s + Math.abs(x / W[i][i]), 0)));
}
for (const r of [2.5, 0.5, 1e-2, 1e-3, 3e-4, 1e-4, 1e-5, 1e-6, 100, 1000, 1e4, 1e5]) {
  const rows: [number,number,number][][] = [];
  for (let i = 0; i <= 11; i++) rows.push(Array.from({ length: 16 }, (_, j) => S(2 + 3 * i / 11, -1 + 4 * j / 15)));
  const t = [0.6, 0.8, 0]; const edge = rows[11];
  for (let k = 1; k <= 4; k++) rows.push(edge.map(p => p.map((x, c) => x + t[c] * r * k / 4) as [number,number,number]));
  const ub = avg(Array.from({ length: 16 }, (_, j) => chordParameters(rows.map(rw => rw[j])))), vb = avg(rows.map(rw => chordParameters(rw)));
  const ku = invNorm(ub, 3), kv = invNorm(vb, 3), scale = Math.max(...rows.flat().flat().map(Math.abs));
  const f = interpolateSurfacePlain(rows), g: any = { kind: 'surface', id: 's', degreeU: 3, degreeV: 3, knotsU: f.knotsU, knotsV: f.knotsV, controlPoints: f.points, weights: f.weights };
  const T = (s: number, tt: number) => [0,1,2].map(k => A[k] + s*(3 + r/5)*U[k] + 4*tt*V[k]);
  let worst = 0; for (let i = 0; i <= 800; i++) for (let j = 0; j <= 20; j++) { const p = evaluateSurface(g, i/800, j/20), e = T(i/800, j/20); worst = Math.max(worst, Math.hypot(p[0]-e[0],p[1]-e[1],p[2]-e[2])); }
  console.log(r, 'invU', ku.toExponential(2), 'invV', kv.toExponential(2), 'est', (ku * kv * 16 * Number.EPSILON * scale).toExponential(2), 'rawDense', worst.toExponential(2));
}
