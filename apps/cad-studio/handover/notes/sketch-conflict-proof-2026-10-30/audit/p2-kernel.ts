// Kernel property: kernel accepts (from any tried seed) ⇒ rectilinearConflict never proven; proven ⇒ kernel fails
// from every tried seed. Also: margin of kernel-accepted solutions against each relaxed model equation (dev / S).
import { solveOutline, type OutlineConstraints } from '/Users/user/github/barocss/barocss/.claude/worktrees/agent-a2c21c62b8d80f041/packages/barocss-cad-model/src/sketch/profile.ts';
import { rectilinearConflict } from '/Users/user/github/barocss/barocss/.claude/worktrees/agent-a2c21c62b8d80f041/packages/barocss-cad-model/src/sketch/conflict.ts';
type P2 = [number, number];
let seed = Number(process.argv[2] ?? 7);
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const N = Number(process.argv[3] ?? 600), S = 4e-7;
const tally: Record<string, number> = {}; let falseProof = 0, provenKernelOk = 0, maxRatio = 0, conflictFlagMismatch = 0; const ex: string[] = [];
const bump = (k: string) => tally[k] = (tally[k] ?? 0) + 1;
for (let t = 0; t < N; t++) {
  const m = 2 + Math.floor(rnd() * 4);
  // distinct sorted-ish coords to keep edges ≥ 1 mm
  const xs = Array.from({ length: m }, (_, k) => k * 20 + Math.round(rnd() * 150) / 10 + 1), ys = Array.from({ length: m }, (_, k) => ((k * 7) % m) * 20 + Math.round(rnd() * 150) / 10 + 1);
  const pts: P2[] = []; for (let k = 0; k < m; k++) { pts.push([xs[k], ys[k]]); pts.push([xs[(k + 1) % m], ys[k]]); }
  const n = pts.length, h: number[] = [], v: number[] = [];
  for (let i = 0; i < n; i++) (i % 2 ? v : h).push(i);
  const scale = [0, 9e-8, 3e-7, 6e-7, 1e-6, 2e-6, 1e-4, 0.5, 5][Math.floor(rnd() * 9)];
  const pert = () => (rnd() * 2 - 1) * scale;
  const lengths: Record<number, number> = {}, rules: NonNullable<OutlineConstraints['rules']> = [];
  for (let i = 0; i < n; i++) if (rnd() < .45) { const a = pts[i], b = pts[(i + 1) % n]; lengths[i] = Math.abs(i % 2 ? b[1] - a[1] : b[0] - a[0]); }
  const nr = Math.floor(rnd() * 4);
  for (let r = 0; r < nr; r++) {
    const a = 1 + Math.floor(rnd() * (n - 1)), b = Math.floor(rnd() * n); const kind = rnd() < .3 ? 'fix' : rnd() < .5 ? 'dx' : 'dy';
    if (kind === 'fix') rules.push({ kind, point: a, at: [pts[a][0], pts[a][1]] });
    else if (a !== b) { const k = kind === 'dx' ? 0 : 1, val = Math.abs(pts[b][k] - pts[a][k]); if (val >= 0.5) rules.push({ kind, a, b, value: val }); }
  }
  // perturb exactly one dimension (or a fix target)
  const keys = Object.keys(lengths); const which = Math.floor(rnd() * (keys.length + rules.length));
  if (which < keys.length) lengths[+keys[which]] += pert(); else if (rules.length) { const r = rules[which - keys.length] as any; if (r.kind === 'fix') r.at = [r.at[0] + pert(), r.at[1] + pert()]; else r.value += pert(); }
  const c: OutlineConstraints = { hv: { h, v }, lengths, rules };
  const proof = rectilinearConflict(pts, c, pts.map(() => 0));
  // kernel from the drawing and from 3 jittered seeds (p0 kept: it is the anchor target)
  const seeds: P2[][] = [pts]; for (let j = 0; j < 3; j++) seeds.push(pts.map((p, i) => i === 0 ? p : [p[0] + (rnd() - .5) * 4, p[1] + (rnd() - .5) * 4] as P2));
  let kernelOk = false, code = ''; let flagged = false;
  for (const sd of seeds) {
    // jittered seeds keep the drawing's anchor and explicit hv; only the start differs
    const r = solveOutline(sd, c);
    if (r.ok) {
      kernelOk = true;
      // margins of the accepted solution against the model's relaxed equations
      const P = r.points, dev: number[] = [];
      for (let k = 0; k < 2; k++) dev.push(Math.abs(P[0][k] - pts[0][k]));
      for (const i of h) dev.push(Math.abs(P[(i + 1) % n][1] - P[i][1]));
      for (const i of v) dev.push(Math.abs(P[(i + 1) % n][0] - P[i][0]));
      for (const [i, L] of Object.entries(lengths)) { const a = P[+i], b = P[(+i + 1) % n]; dev.push(Math.abs(Math.abs(+i % 2 ? b[1] - a[1] : b[0] - a[0]) - L)); }
      for (const q of rules as any[]) { if (q.kind === 'fix') { dev.push(Math.abs(P[q.point][0] - q.at[0]), Math.abs(P[q.point][1] - q.at[1])); } else { const k = q.kind === 'dx' ? 0 : 1; dev.push(Math.abs(Math.abs(P[q.b][k] - P[q.a][k]) - q.value)); } }
      maxRatio = Math.max(maxRatio, ...dev.map(d => d / S));
      break;
    } else { code = r.reason; if ((r as any).conflict) flagged = true; }
  }
  // solveOutline from the drawing must flag conflict exactly when (kernel fails from drawing ∧ proof)
  const fromDrawing = solveOutline(pts, c);
  if (!fromDrawing.ok && (fromDrawing as any).conflict !== (proof.proven ? true : undefined) && /did not meet/.test(fromDrawing.reason) === proof.proven) conflictFlagMismatch++;
  const key = `${scale}|${proof.proven ? 'proven' : proof.why}|kernel:${kernelOk ? 'ok' : 'fail'}`; bump(key);
  if (proof.proven && kernelOk) { falseProof++; if (ex.length < 3) ex.push(JSON.stringify({ pts, c })); }
  void code; void flagged; void provenKernelOk;
}
console.log('cases', N, 'falseProofs', falseProof, 'conflictFlagMismatch', conflictFlagMismatch, 'max kernel-accepted dev/S', maxRatio.toFixed(4));
for (const k of Object.keys(tally).sort()) console.log(k, tally[k]);
ex.forEach(e => console.log(e));
