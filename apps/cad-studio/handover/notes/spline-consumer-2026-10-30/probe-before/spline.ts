import { splineOutline } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/spline';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/settle';
import { arcOf, type P2 } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/profile';
import { profileOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/loops';
const sub = (a: P2, b: P2): P2 => [a[0] - b[0], a[1] - b[1]];
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
// Tangent turn at joint j of an outline: 0 when smooth.
function kink(pts: P2[], bul: number[], j: number) {
  const n = pts.length, a = (j - 1 + n) % n;
  const dirIn = bul[a] ? (() => { const c = arcOf(pts[a], pts[j], bul[a]).center, r = sub(pts[j], c); return bul[a] > 0 ? [-r[1], r[0]] : [r[1], -r[0]]; })() : sub(pts[j], pts[a]);
  const dirOut = bul[j] ? (() => { const c = arcOf(pts[j], pts[(j + 1) % n], bul[j]).center, r = sub(pts[j], c); return bul[j] > 0 ? [-r[1], r[0]] : [r[1], -r[0]]; })() : sub(pts[(j + 1) % n], pts[j]);
  return Math.abs(wrap(Math.atan2(dirOut[1], dirOut[0]) - Math.atan2(dirIn[1], dirIn[0])));
}
for (const k of [3, 4, 5, 8, 12, 16, 17, 20]) {
  const fit: P2[] = Array.from({ length: k }, (_, i) => { const t = 2 * Math.PI * i / k; return [Math.round(40 * Math.cos(t) + 7 * Math.cos(3 * t)), Math.round(25 * Math.sin(t))] as P2; });
  const o = splineOutline(fit, true);
  const drawn: any = { kind: 'polygon', closed: true, points: o.points, bulges: o.bulges };
  const rawKink = Math.max(...o.points.map((_, j) => kink(o.points, o.bulges, j)));
  const r = settleShape(drawn, { ...drawn, closed: false }); const s: any = r.shape;
  const maxKink = Math.max(...s.points.map((_: any, j: number) => kink(s.points, s.bulges, j)));
  // fit points: are they still outline points (same coordinates)?
  const fitMove = Math.max(...fit.map(f => Math.min(...s.points.map((p: P2) => Math.hypot(p[0] - f[0], p[1] - f[1])))));
  const pr = profileOf([s]);
  console.log('eqR', s.equalRadii?.length ?? 0, 'conc', s.concentric?.length ?? 0, 'worstFit', JSON.stringify(fit.map(f => Math.min(...s.points.map((p: P2) => Math.hypot(p[0] - f[0], p[1] - f[1])))).map(x => +x.toExponential(1))));
  console.log('k', k, 'outlinePts', o.points.length, 'err', r.error, 'tangents', s.tangents?.length ?? 0, 'rawKinkDeg', (rawKink * 180 / Math.PI).toExponential(2), 'settledKinkRad', maxKink.toExponential(2), 'fitMove', fitMove.toExponential(2), 'profile', 'error' in pr ? pr.error : pr.node.profile);
}
