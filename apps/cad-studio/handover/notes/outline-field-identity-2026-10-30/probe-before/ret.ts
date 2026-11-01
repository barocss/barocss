import { solveOutline, arcOf, inferTangents, type P2 } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/profile';
// Residuals of the RETURNED outline (points + bulges -> arcOf centres) against each authored constraint.
const sub = (a: P2, b: P2): P2 => [a[0] - b[0], a[1] - b[1]];
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
function measure(pts: P2[], bul: number[], c: any) {
  const n = pts.length, ctr = (i: number) => arcOf(pts[i], pts[(i + 1) % n], bul[i]);
  let lin = 0, ang = 0; const worst: string[] = [];
  for (const [i, L] of Object.entries(c.lengths ?? {})) { const a = pts[+i], b = pts[(+i + 1) % n]; const e = Math.abs(Math.hypot(b[0]-a[0], b[1]-a[1]) - (L as number)); if (e > lin) { lin = e; } if (e > 1e-7) worst.push(`len${i} ${e.toExponential(2)}`); }
  for (const [i, R] of Object.entries(c.radii ?? {})) { const e = Math.abs(ctr(+i).radius - (R as number)); lin = Math.max(lin, e); if (e > 1e-7) worst.push(`rad${i} ${e.toExponential(2)}`); }
  for (const i of c.hv?.h ?? []) { const e = Math.abs(pts[(i + 1) % n][1] - pts[i][1]); lin = Math.max(lin, e); if (e > 1e-7) worst.push(`h${i} ${e.toExponential(2)}`); }
  for (const i of c.hv?.v ?? []) { const e = Math.abs(pts[(i + 1) % n][0] - pts[i][0]); lin = Math.max(lin, e); if (e > 1e-7) worst.push(`v${i} ${e.toExponential(2)}`); }
  for (const j of c.tangents ?? []) {
    const a = (j - 1 + n) % n, b = j;
    const into = bul[a] ? sub(pts[j], ctr(a).center) : sub(pts[j], pts[a]);
    const out = bul[b] ? sub(pts[j], ctr(b).center) : sub(pts[(j + 1) % n], pts[j]);
    const cur = wrap(Math.atan2(out[1], out[0]) - Math.atan2(into[1], into[0]));
    const opts = bul[a] && bul[b] ? [0, Math.PI] : [Math.PI / 2, -Math.PI / 2];
    const e = Math.min(...opts.map(o => Math.abs(wrap(cur - o)))); ang = Math.max(ang, e); if (e > 1e-9) worst.push(`t${j} ${e.toExponential(2)}rad`);
  }
  // Arc ends on one circle with the solver's own centre is implicit; also report each arc's equal-radius gap to its sibling arcs if requested.
  for (const [p, q] of c.equalRadii ?? []) { const e = Math.abs(ctr(p).radius - ctr(q).radius); lin = Math.max(lin, e); if (e > 1e-7) worst.push(`eq${p}_${q} ${e.toExponential(2)}`); }
  return { lin, ang, worst };
}
function rounded(W: number, H: number, r: number, jitter: number, seed: number) {
  let s = seed; const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return (s / 2147483648 - 0.5) * 2 * jitter; };
  const b = Math.tan(Math.PI / 8);
  const P: P2[] = [[r, 0], [W - r, 0], [W, r], [W, H - r], [W - r, H], [r, H], [0, H - r], [0, r]].map(([x, y]) => [x + rnd(), y + rnd()] as P2);
  P[0] = [r, 0];
  return { P, B: [0, b, 0, b, 0, b, 0, b] };
}
const cases: [string, number, number, number, number][] = [
  ['grid 60x40 r5', 60, 40, 5, 0], ['grid 60x40 r0.5', 60, 40, 0.5, 0], ['offgrid 60.0000004x40 r5', 60.0000004, 40, 5, 0],
  ['offgrid 60x40 r2.3333333', 60, 40, 2.3333333, 0], ['offgrid 61.7x33.3 r0.3', 61.7, 33.3, 0.3, 0], ['jitter 60x40 r5', 60, 40, 5, 0.3],
  ['jitter 100x7 r1.25', 100, 7, 1.25, 0.2], ['offgrid 1234.5678x987.6543 r12.345678', 1234.5678, 987.6543, 12.345678, 0],
];
let fails = 0;
for (const [name, W, H, r, jit] of cases) for (const seed of [1, 2, 3]) {
  const { P, B } = rounded(W, H, r, jit, seed);
  const tangents = [1, 2, 3, 4, 5, 6, 7, 0];
  const c = { lengths: { 0: W - 2 * r, 2: H - 2 * r }, radii: { 1: r, 3: r, 5: r, 7: r }, tangents, hv: { h: [0, 4], v: [2, 6] } };
  const res = solveOutline(P, c, B);
  if (!res.ok) { console.log(name, seed, 'REFUSED', res.reason); continue; }
  const m = measure(res.points, res.bulges, c);
  const bad = m.lin > 1e-7 || m.ang > 1e-9; if (bad) fails++;
  console.log(name, seed, bad ? 'EXCEEDS' : 'ok', 'lin', m.lin.toExponential(2), 'ang', m.ang.toExponential(2), 'dof', res.dof, 'rank', res.rank, 'rows', res.rows, m.worst.slice(0, 4).join(' '));
}
console.log('cases exceeding original limits:', fails);
