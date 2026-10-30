// Q2: actual forward error of interpolateSurfacePlain's poles (vs the exact rational solution of the same float-assembled
// collocation systems) against the diff's estimate (ku + kv + ku*kv)*gamma16*max|coord|.
import { geometryOf, importSource, emptyDirect } from '/Users/user/github/barocss/barocss/.claude/worktrees/compassionate-turing-e88276/packages/barocss-cad-model/src/engine/direct';
import { evaluateSurface, surfaceDomain, interpolateSurfacePlain, chordParameters, plainBasis, plainFindSpan, averagedKnots, type Surface } from '@barocss/cad';
import { readFileSync } from 'node:fs';
type Q = [bigint, bigint];
const gcd = (a: bigint, b: bigint) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
const nq = (n: bigint, d: bigint): Q => { if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d) || 1n; return [n / g, d / g]; };
const qa = (a: Q, b: Q) => nq(a[0] * b[1] + b[0] * a[1], a[1] * b[1]), qs = (a: Q, b: Q) => nq(a[0] * b[1] - b[0] * a[1], a[1] * b[1]), qm = (a: Q, b: Q) => nq(a[0] * b[0], a[1] * b[1]), qd = (a: Q, b: Q) => nq(a[0] * b[1], a[1] * b[0]);
function ex(x: number): Q { if (x === 0) return [0n, 1n]; const v = new DataView(new ArrayBuffer(8)); v.setFloat64(0, x); const bits = v.getBigUint64(0), sg = bits >> 63n ? -1n : 1n, e = Number((bits >> 52n) & 0x7ffn), f = bits & ((1n << 52n) - 1n), m = e === 0 ? f : f | (1n << 52n), p = (e === 0 ? 1 : e) - 1075; return p >= 0 ? [sg * m * (1n << BigInt(p)), 1n] : nq(sg * m, 1n << BigInt(-p)); }
const toN = (a: Q) => { const s = 1n << 64n; return Number((a[0] * s) / a[1]) / 2 ** 64; };
function collocation(params: number[], p: number, U: number[]) { const m = params.length, n = m - 1; return params.map(u => { const row = Array(m).fill(0), s = plainFindSpan(n, p, u, U), N = plainBasis(s, u, p, U); for (let k = 0; k <= p; k++) row[s - p + k] = N[k]; return row; }); }
function solveExact(A: number[][], B: Q[][]): Q[][] { const n = A.length, w = B[0].length, M = A.map((r, i) => [...r.map(ex), ...B[i]]);
  for (let c = 0; c < n; c++) { let piv = c; while (M[piv][c][0] === 0n) piv++; [M[c], M[piv]] = [M[piv], M[c]]; for (let r = 0; r < n; r++) { if (r === c || M[r][c][0] === 0n) continue; const f = qd(M[r][c], M[c][c]); for (let k = c; k < n + w; k++) M[r][k] = qs(M[r][k], qm(f, M[c][k])); } }
  return M.map((r, i) => r.slice(n).map(x => qd(x, M[i][i]))); }
function inverseRowSum(params: number[], p: number, knots: number[]) { const m = params.length, n = m - 1, W: number[][] = [];
  for (let i = 0; i < m; i++) { const row = Array(2 * m).fill(0), s = plainFindSpan(n, p, params[i], knots), N = plainBasis(s, params[i], p, knots); for (let k = 0; k <= p; k++) row[s - p + k] = N[k]; row[m + i] = 1; W.push(row); }
  for (let c = 0; c < m; c++) { let piv = c; for (let r = c + 1; r < m; r++) if (Math.abs(W[r][c]) > Math.abs(W[piv][c])) piv = r; if (!(Math.abs(W[piv][c]) > 0)) return Infinity; [W[c], W[piv]] = [W[piv], W[c]]; for (let r = 0; r < m; r++) { if (r === c) continue; const f = W[r][c] / W[c][c]; if (f) for (let k = c; k < 2 * m; k++) W[r][k] -= f * W[c][k]; } }
  let worst = 0; for (let i = 0; i < m; i++) { let s = 0; for (let k = m; k < 2 * m; k++) s += Math.abs(W[i][k] / W[i][i]); if (!(s <= worst)) worst = s; } return worst; }
const meanLists = (l: number[][]) => l[0].map((_, k) => { let s = 0; for (const x of l) s += x[k]; return s / l.length; });
function gridOf(src: string, edge: string, D: number) {
  const d = importSource(emptyDirect(), src, 'P'), s = geometryOf(d, d.objects[0]) as Surface, dom = surfaceDomain(s);
  const n = 11, across = 15, extra = 4, alongU = edge.startsWith('u'), atMax = edge.endsWith('max');
  const [a0, a1] = alongU ? dom.u : dom.v, [b0, b1] = alongU ? dom.v : dom.u, S = (a: number, b: number) => alongU ? evaluateSurface(s, a, b) : evaluateSurface(s, b, a);
  const rows: number[][][] = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; rows.push(Array.from({ length: across + 1 }, (_, j) => S(a, b0 + (b1 - b0) * j / across))); }
  const eA = atMax ? a1 : a0, h = (a1 - a0) * 1e-3, tangent = (b: number) => { const p = S(eA, b), q = S(atMax ? eA - h : eA + h, b), t = [0, 1, 2].map(k => p[k] - q[k]), l = Math.hypot(...t) || 1; return t.map(x => x / l); };
  const edgeRow = atMax ? rows[n] : rows[0], tans = Array.from({ length: across + 1 }, (_, j) => tangent(b0 + (b1 - b0) * j / across));
  const more = Array.from({ length: extra }, (_, k) => edgeRow.map((p, j) => p.map((x, c) => x + tans[j][c] * D * (k + 1) / extra)));
  const all = atMax ? [...rows, ...more] : [...more.reverse(), ...rows];
  return alongU ? all : all[0].map((_, j) => all.map(r => r[j]));
}
const d347 = (o: number) => `@model d { version:0; length-unit:mm; @surface #p { type:nurbs; degree-u:1; degree-v:1; knots-u:[2,2,5,5]; knots-v:[-1,-1,3,3];
 control-points:[[[${7 + o},${-11 + o},${13 + o}],[${7 + o},${-11 + o},${21 + o}]],[[${16 + o},${1 + o},${13 + o}],[${16 + o},${1 + o},${21 + o}]]]; weights:[[1,1],[1,1]]; } }`;
const cases: [string, string, string, number][] = [];
for (const o of [0, 1e5]) for (const D of [0.003, 0.01, 2.5, 700, 1000, 3000]) cases.push([`d347+${o}`, d347(o), 'u-max', D]);
const fails = JSON.parse(readFileSync('/private/tmp/claude-501/-Users-user-github-barocss-barocss--claude-worktrees-compassionate-turing-e88276/0fddd342-b409-4074-aa06-d8dff804f568/scratchpad/audit/para-fails.json', 'utf8'));
for (const f of fails.slice(0, 4)) cases.push([`para${f.trial}`, f.src, f.edge, f.D]);
for (const [label, src, edge, D] of cases) {
  const grid = gridOf(src, edge, D), fit = interpolateSurfacePlain(grid as any);
  const ub = meanLists(Array.from({ length: grid[0].length }, (_, j) => chordParameters(grid.map(r => r[j])))), vb = meanLists(grid.map(r => chordParameters(r)));
  const U = averagedKnots(ub, 3), V = averagedKnots(vb, 3);
  const same = U.every((x, k) => Object.is(x, fit.knotsU[k])) && V.every((x, k) => Object.is(x, fit.knotsV[k]));
  // exact two-phase: R_j = Bu^-1 Q_j (columns), P_i = Bv^-1 R_i (rows)
  const Bu = collocation(ub, 3, U), Bv = collocation(vb, 3, V), nu = grid.length, nv = grid[0].length;
  const R = Array.from({ length: nv }, (_, j) => solveExact(Bu, grid.map(r => r[j].map(ex))));
  const P = Array.from({ length: nu }, (_, i) => solveExact(Bv, R.map(col => col[i])));
  let fe = 0; for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) for (let k = 0; k < 3; k++) fe = Math.max(fe, Math.abs(toN(qs(ex(fit.points[i][j][k]), P[i][j][k]))));
  const ku = inverseRowSum(ub, 3, U), kv = inverseRowSum(vb, 3, V), g = 16 * Number.EPSILON / (1 - 16 * Number.EPSILON);
  let M = 0; for (const G of [grid, fit.points]) for (const r of G) for (const p of r) for (const x of p) M = Math.max(M, Math.abs(x));
  const est = (ku + kv + ku * kv) * g * M;
  console.log(`${label} ${edge} D=${D} paramsBitIdentical=${same} ku=${ku.toFixed(2)} kv=${kv.toFixed(2)} M=${M.toExponential(2)} actualPoleFwdErr=${fe.toExponential(2)} estimate=${est.toExponential(2)} ratio=${(est / fe).toExponential(1)}`);
}
