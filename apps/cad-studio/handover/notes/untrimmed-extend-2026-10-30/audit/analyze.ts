// Decompose a failing accepted case: grid error (vs exact affine), unrounded fit dense error, stored dense error,
// the op's own residual + estimate (helpers copied verbatim from the diff).
import { geometryOf, importSource, emptyDirect, directOps } from '/Users/user/github/barocss/barocss/.claude/worktrees/compassionate-turing-e88276/packages/barocss-cad-model/src/engine/direct';
import { evaluateSurface, surfaceDomain, interpolateSurfacePlain, chordParameters, plainBasis, plainFindSpan, type Surface } from '@barocss/cad';
import { readFileSync } from 'node:fs';
const fails = JSON.parse(readFileSync('/private/tmp/claude-501/-Users-user-github-barocss-barocss--claude-worktrees-compassionate-turing-e88276/0fddd342-b409-4074-aa06-d8dff804f568/scratchpad/audit/para-fails.json', 'utf8'));
function meanLists(lists: number[][]) { const out: number[] = []; for (let k = 0; k < lists[0].length; k++) { let s = 0; for (const l of lists) s += l[k]; out.push(s / lists.length); } return out; }
function inverseRowSum(params: number[], p: number, knots: number[]) {
  const m = params.length, n = m - 1, W: number[][] = [];
  for (let i = 0; i < m; i++) { const row = Array(2 * m).fill(0), s = plainFindSpan(n, p, params[i], knots), N = plainBasis(s, params[i], p, knots); for (let k = 0; k <= p; k++) row[s - p + k] = N[k]; row[m + i] = 1; W.push(row); }
  for (let c = 0; c < m; c++) { let piv = c; for (let r = c + 1; r < m; r++) if (Math.abs(W[r][c]) > Math.abs(W[piv][c])) piv = r; if (!(Math.abs(W[piv][c]) > 0)) return Infinity; [W[c], W[piv]] = [W[piv], W[c]]; for (let r = 0; r < m; r++) { if (r === c) continue; const f = W[r][c] / W[c][c]; if (f) for (let k = c; k < 2 * m; k++) W[r][k] -= f * W[c][k]; } }
  let worst = 0; for (let i = 0; i < m; i++) { let s = 0; for (let k = m; k < 2 * m; k++) s += Math.abs(W[i][k] / W[i][i]); if (!(s <= worst)) worst = s; } return worst;
}
function evalPlain(f: any, u: number, v: number, lu = 1, lv = 1) {
  const nu = f.points.length - 1, nv = f.points[0].length - 1, U = f.knotsU.map((k: number) => k * lu), V = f.knotsV.map((k: number) => k * lv);
  const su = plainFindSpan(nu, f.degreeU, u, U), sv = plainFindSpan(nv, f.degreeV, v, V), Nu = plainBasis(su, u, f.degreeU, U), Nv = plainBasis(sv, v, f.degreeV, V);
  const out = [0, 0, 0]; for (let a = 0; a <= f.degreeU; a++) for (let b = 0; b <= f.degreeV; b++) { const P = f.points[su - f.degreeU + a][sv - f.degreeV + b]; for (let k = 0; k < 3; k++) out[k] += Nu[a] * Nv[b] * P[k]; } return out;
}
const gap = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const pick = process.argv[2] ? fails.filter((x: any) => `${x.trial}:${x.edge}` === process.argv[2]) : fails;
for (const { trial, edge, D, src } of pick) {
  const d = importSource(emptyDirect(), src, 'P'), s = geometryOf(d, d.objects[0]) as Surface, dom = surfaceDomain(s);
  const n = 11, across = 15, extra = 4, alongU = edge.startsWith('u'), atMax = edge.endsWith('max');
  const [a0, a1] = alongU ? dom.u : dom.v, [b0, b1] = alongU ? dom.v : dom.u;
  const S = (a: number, b: number) => alongU ? evaluateSurface(s, a, b) : evaluateSurface(s, b, a);
  const rows: number[][][] = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; rows.push(Array.from({ length: across + 1 }, (_, j) => S(a, b0 + (b1 - b0) * j / across))); }
  const eA = atMax ? a1 : a0, h = (a1 - a0) * 1e-3, tangent = (b: number) => { const p = S(eA, b), q = S(atMax ? eA - h : eA + h, b), t = [0, 1, 2].map(k => p[k] - q[k]), l = Math.hypot(...t) || 1; return t.map(x => x / l); };
  const edgeRow = atMax ? rows[n] : rows[0], tans = Array.from({ length: across + 1 }, (_, j) => tangent(b0 + (b1 - b0) * j / across));
  const more = Array.from({ length: extra }, (_, k) => edgeRow.map((p, j) => p.map((x, c) => x + tans[j][c] * D * (k + 1) / extra)));
  const all = atMax ? [...rows, ...more] : [...more.reverse(), ...rows];
  const grid: any = alongU ? all : all[0].map((_, j) => all.map(r => r[j]));
  const ub = meanLists(Array.from({ length: grid[0].length }, (_, j) => chordParameters(grid.map((r: any) => r[j])))), vb = meanLists(grid.map((r: any) => chordParameters(r)));
  const fit = interpolateSurfacePlain(grid);
  const ku = inverseRowSum(ub, fit.degreeU, fit.knotsU), kv = inverseRowSum(vb, fit.degreeV, fit.knotsV), gamma = 16 * Number.EPSILON / (1 - 16 * Number.EPSILON);
  let M = 0; for (const g of [grid, fit.points]) for (const r of g) for (const p of r) for (const x of p) M = Math.max(M, Math.abs(x));
  const estimate = (ku + kv + ku * kv) * gamma * M;
  // exact affine map for the grid (exact extension of the parallelogram)
  const o = evaluateSurface(s, dom.u[0], dom.v[0]), eu = evaluateSurface(s, dom.u[1], dom.v[0]).map((x, k) => x - o[k]), ev = evaluateSurface(s, dom.u[0], dom.v[1]).map((x, k) => x - o[k]);
  const out = directOps.extendSurface(d, d.objects[0].id, edge, D), st = geometryOf(out, out.objects.at(-1)!) as Surface, sd = surfaceDomain(st);
  const lu = (sd.u[1]) / 1, lv = sd.v[1];
  // stored vs unrounded fit, and both vs the grid at nodes
  let nodeFit = 0, nodeStored = 0, denseFS = 0, denseFitVsBilinearOfGrid = 0;
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) { nodeFit = Math.max(nodeFit, gap(evalPlain(fit, ub[i], vb[j]), grid[i][j])); nodeStored = Math.max(nodeStored, gap(evaluateSurface(st, Math.min(ub[i] * lu, sd.u[1]), Math.min(vb[j] * lv, sd.v[1])), grid[i][j])); }
  for (let i = 0; i <= 150; i++) for (let j = 0; j <= 150; j++) { const u = i / 150, v = j / 150; denseFS = Math.max(denseFS, gap(evalPlain(fit, u, v), evaluateSurface(st, Math.min(u * lu, sd.u[1]), Math.min(v * lv, sd.v[1])))); }
  console.log(`trial ${trial} ${edge} D=${D.toPrecision(3)} ku=${ku.toFixed(2)} kv=${kv.toFixed(2)} M=${M.toExponential(2)} estimate=${estimate.toExponential(2)} nodeResidual(unrounded fit)=${nodeFit.toExponential(2)} nodeResidual(stored)=${nodeStored.toExponential(2)} dense|stored-unroundedFit|=${denseFS.toExponential(2)}`);
}
