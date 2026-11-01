// Near-parallel handles at both ends of one span: biarc's d formula cancels; measure the kink at the fit point.
import { splineOutline, splineEditError } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/spline';
import { arcOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/profile';
type P2 = [number, number];
function tangent(pts: P2[], bulges: number[], i: number, end: boolean): P2 {
  const n = pts.length, a = pts[i], b = pts[(i + 1) % n], bulge = bulges[i] ?? 0;
  if (!bulge) { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; }
  const arc = arcOf(a, b, bulge), p = end ? b : a, sign = Math.sign(arc.sweep);
  return [-sign * (p[1] - arc.center[1]) / arc.radius, sign * (p[0] - arc.center[0]) / arc.radius];
}
const turn = (a: P2, b: P2) => Math.abs(Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]));
const fit: P2[] = [[0, 0], [20, 10]];
for (const d of [1, 1e-1, 1e-2, 1e-3, 1e-4, 1e-5, 5e-6]) {
  const h = [0, d];
  const o = splineOutline(fit, false, h), t2 = tangent(o.points, o.bulges, 1, true), want: P2 = [Math.cos(d * Math.PI / 180), Math.sin(d * Math.PI / 180)];
  const tj = turn(tangent(o.points, o.bulges, 0, true), tangent(o.points, o.bulges, 1, false));
  console.log(`handles [0, ${d}] err=${splineEditError({ fit, closed: false, handles: h })} arrival-vs-handle ${turn(t2, want).toExponential(2)} joint ${tj.toExponential(2)} bulges ${o.bulges.map(b => b.toExponential(3)).join(',')}`);
}
