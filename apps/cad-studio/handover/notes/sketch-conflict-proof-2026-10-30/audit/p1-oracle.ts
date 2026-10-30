// Independent oracle for rectilinearConflict's exact arithmetic + search: rebuild the same relaxed system with an
// independent double→rational conversion and Floyd–Warshall per full sign assignment (exhaustive), compare verdicts.
import { rectilinearConflict } from '/Users/user/github/barocss/barocss/.claude/worktrees/agent-a2c21c62b8d80f041/packages/barocss-cad-model/src/sketch/conflict.ts';
type P2 = [number, number];
let seed = Number(process.argv[2] ?? 1);
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
// Rational p/q (q power of two) via repeated doubling (exact in binary64 until integral).
function rat(v: number): [bigint, bigint] { let q = 1n; let x = v; let guard = 0; while (!Number.isInteger(x)) { x *= 2; q *= 2n; if (++guard > 1100) throw new Error('rat'); } return [BigInt(x), q]; }
const S = rat(4 * 1e-7);
// Work over a common denominator D = 2^1100 (all values are dyadic with exponent ≥ -1074 − small).
const D = 1n << 1200n;
const toD = (v: number) => { const [p, q] = rat(v); return p * (D / q); };
const SD = S[0] * (D / S[1]);
function fw(n: number, cons: [number, number, bigint, bigint][]): boolean {
  const INF = null as unknown as bigint; const d: (bigint | null)[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 0n : null));
  const put = (a: number, b: number, w: bigint) => { const c = d[a][b]; if (c === null || w < c) d[a][b] = w; };
  for (const [f, t, lo, hi] of cons) { put(f, t, hi); put(t, f, -lo); }
  for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) { const ik = d[i][k]; if (ik === null) continue; for (let j = 0; j < n; j++) { const kj = d[k][j]; if (kj === null) continue; const s = ik + kj; const c = d[i][j]; if (c === null || s < c) d[i][j] = s; } }
  void INF; for (let i = 0; i < n; i++) if ((d[i][i] as bigint) < 0n) return false; return true;
}
function oracle(points: P2[], hv: { h: number[]; v: number[] }, lengths: Record<number, number>, rules: any[]): boolean /* proven */ {
  const n = points.length, G = n;
  const ax: { fixed: [number, number, bigint, bigint][]; abs: [number, number, bigint, bigint][] }[] = [{ fixed: [], abs: [] }, { fixed: [], abs: [] }];
  const eq = (f: number, t: number, c: number): [number, number, bigint, bigint] => { const v = toD(c); return [f, t, v - SD, v + SD]; };
  const ab = (f: number, t: number, c: number): [number, number, bigint, bigint] => { const v = toD(c); const lo = v - SD; return [f, t, lo < 0n ? 0n : lo, v + SD]; };
  for (let k = 0; k < 2; k++) ax[k].fixed.push(eq(G, 0, points[0][k]));
  for (const i of hv.h) ax[1].fixed.push(eq(i, (i + 1) % n, 0));
  for (const i of hv.v) ax[0].fixed.push(eq(i, (i + 1) % n, 0));
  for (const [k, v] of Object.entries(lengths)) ax[hv.h.includes(+k) ? 0 : 1].abs.push(ab(+k, (+k + 1) % n, v));
  for (const r of rules) { if (r.kind === 'fix') for (let k = 0; k < 2; k++) ax[k].fixed.push(eq(G, r.point, r.at[k])); else ax[r.kind === 'dx' ? 0 : 1].abs.push(ab(r.a, r.b, r.value)); }
  for (const a of ax) {
    let any = false;
    for (let mask = 0; mask < (1 << a.abs.length) && !any; mask++) {
      const cons = [...a.fixed, ...a.abs.map(([f, t, lo, hi], i): [number, number, bigint, bigint] => (mask >> i) & 1 ? [f, t, -hi, -lo] : [f, t, lo, hi])];
      if (fw(n + 1, cons)) any = true;
    }
    if (!any) return true;
  }
  return false;
}
// Random small rectilinear outlines with random dims; values near-consistent / perturbed at many scales.
const counts: Record<string, number> = {}; let mism = 0; const ex: string[] = [];
const N = Number(process.argv[3] ?? 3000);
for (let t = 0; t < N; t++) {
  const m = 2 + Math.floor(rnd() * 3), xs = Array.from({ length: m }, () => Math.round(rnd() * 2000) / 16 * (rnd() < .5 ? 1 : 1 + 1e-9)), ys = Array.from({ length: m }, () => Math.round(rnd() * 2000) / 16);
  const pts: P2[] = []; for (let k = 0; k < m; k++) { pts.push([xs[k], ys[k]]); pts.push([xs[(k + 1) % m], ys[k]]); }
  const n = pts.length, h: number[] = [], v: number[] = [];
  for (let i = 0; i < n; i++) (i % 2 ? v : h).push(i);
  const lengths: Record<number, number> = {}, rules: any[] = [];
  const scale = [0, 1e-9, 1e-7, 3e-7, 5e-7, 8e-7, 1e-6, 1.6e-6, 1e-3, 1, 7][Math.floor(rnd() * 11)];
  const pert = () => (rnd() * 2 - 1) * scale;
  for (let i = 0; i < n; i++) if (rnd() < .5) { const a = pts[i], b = pts[(i + 1) % n]; lengths[i] = Math.abs(i % 2 ? b[1] - a[1] : b[0] - a[0]) + pert(); }
  const nr = Math.floor(rnd() * 4);
  for (let r = 0; r < nr; r++) {
    const a = Math.floor(rnd() * n), b = Math.floor(rnd() * n); const kind = rnd() < .3 ? 'fix' : rnd() < .5 ? 'dx' : 'dy';
    if (kind === 'fix') rules.push({ kind, point: a, at: [pts[a][0] + pert(), pts[a][1] + pert()] });
    else if (a !== b) { const k = kind === 'dx' ? 0 : 1; rules.push({ kind, a, b, value: Math.abs(pts[b][k] - pts[a][k]) + pert() }); }
  }
  // drop zero/negative lengths so values stay meaningful (the model handles them anyway)
  const absCount = Object.keys(lengths).length + rules.filter(r => r.kind !== 'fix').length; if (absCount > 12) continue;
  const got = rectilinearConflict(pts, { hv: { h, v }, lengths, rules }, pts.map(() => 0));
  const want = oracle(pts, { h, v }, lengths, rules);
  const key = `${scale}:${got.proven ? 'proven' : got.why}`; counts[key] = (counts[key] ?? 0) + 1;
  if (got.proven !== want && !(got as any).why?.startsWith('budget')) { mism++; if (ex.length < 3) ex.push(JSON.stringify({ pts, h, v, lengths, rules, got, want })); }
}
console.log('cases', N, 'mismatches', mism); console.log(JSON.stringify(counts)); ex.forEach(e => console.log(e));
