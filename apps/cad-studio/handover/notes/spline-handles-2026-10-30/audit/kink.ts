import { splineOutline } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/spline';
import { splineOutline as baseOutline } from './base/spline';
import { arcOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/profile';
type P2 = [number, number];
function tangent(pts: P2[], bulges: number[], i: number, end: boolean): P2 {
  const n = pts.length, a = pts[i], b = pts[(i + 1) % n], bulge = bulges[i] ?? 0;
  if (!bulge) { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; }
  const arc = arcOf(a, b, bulge), p = end ? b : a, sign = Math.sign(arc.sweep);
  return [-sign * (p[1] - arc.center[1]) / arc.radius, sign * (p[0] - arc.center[0]) / arc.radius];
}
const turn = (a: P2, b: P2) => Math.abs(Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]));
function report(label: string, o: { points: P2[]; bulges: number[] }, closed: boolean) {
  const n = o.points.length, rows: string[] = [];
  for (let j = closed ? 0 : 1; j < (closed ? n : n - 1); j++) { const t = turn(tangent(o.points, o.bulges, (j - 1 + n) % n, true), tangent(o.points, o.bulges, j, false)); if (t > 1e-9) rows.push(`joint ${j} turn ${t.toExponential(2)} bulges ${o.bulges[(j - 1 + n) % n].toExponential(2)} ${o.bulges[j].toExponential(2)}`); }
  console.log(label, 'n=', n, rows.length ? rows.join(' | ') : 'smooth');
}
const cases: [P2[], boolean, (number | null)[]][] = [
  [[[1.84,-12.129],[16.907,-1.802],[38.782,-14.257],[48.604,-3.626],[62.902,-4.194],[83.387,8.557],[93.548,5.497],[106.3,-0.607]], false, [null,null,-3.293446529720027,22.646172554921613,19.30317902224714,null,null,null]],
  [[[9.177,-5.915],[19.693,14.662],[31.522,10.011],[47.266,-4.267],[64.455,-12.609]], false, [null,null,null,null,-43]],
];
for (const [fit, closed, h] of cases) { report('handles', splineOutline(fit, closed, h), closed); report('auto   ', splineOutline(fit, closed), closed); report('base   ', baseOutline(fit, closed), closed); }
