import { solveOutline } from '/Users/user/github/barocss/barocss/.claude/worktrees/agent-a2c21c62b8d80f041/packages/barocss-cad-model/src/sketch/profile.ts';
import { rectilinearConflict } from '/Users/user/github/barocss/barocss/.claude/worktrees/agent-a2c21c62b8d80f041/packages/barocss-cad-model/src/sketch/conflict.ts';
type P2 = [number, number];
for (const m of [11, 21, 31]) {
  // staircase-ish rectilinear polygon with m H edges and m V edges; H lengths all 1 (odd m: parity conflict)
  const xs = Array.from({ length: m }, (_, k) => k % 2 ? 2 : 1 + k * 0), ys = Array.from({ length: m }, (_, k) => k * 3);
  // make xs alternate so H edges have length 1: x_k = k%2
  for (let k = 0; k < m; k++) xs[k] = (k % 2) + (k === m - 1 ? 5 : 0);
  const pts: P2[] = []; for (let k = 0; k < m; k++) { pts.push([xs[k], ys[k]]); pts.push([xs[(k + 1) % m], ys[k]]); }
  const n = pts.length, h: number[] = [], v: number[] = []; for (let i = 0; i < n; i++) (i % 2 ? v : h).push(i);
  const lengths: Record<number, number> = {}; for (const i of h) lengths[i] = 1;
  const c = { hv: { h, v }, lengths };
  let t = performance.now(); const p = rectilinearConflict(pts, c, pts.map(() => 0)); const tp = performance.now() - t;
  t = performance.now(); const s = solveOutline(pts, c); const ts = performance.now() - t;
  console.log(`n=${n} abs=${m}: proof ${JSON.stringify(p)} ${tp.toFixed(0)} ms; solveOutline ok=${s.ok} ${s.ok ? '' : s.reason.slice(0, 60)} ${ts.toFixed(0)} ms`);
}
