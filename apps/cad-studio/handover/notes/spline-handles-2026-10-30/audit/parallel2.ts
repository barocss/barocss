// Panel flow: closed spline settled, then respline with near-parallel handles, settled as App.updateShape does.
import { splineShape, respline, splineEditError, splineMatches } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/spline';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/settle';
type P2 = [number, number];
const fit: P2[] = [[0, 0], [20, 10], [20, 30], [-10, 20]];
const first = splineShape({ fit, closed: true }), s0: any = settleShape(first, { ...first, closed: false }).shape;
console.log('closed, settled: spline kept', !!s0.spline, 'tangents', JSON.stringify(s0.tangents));
for (const h2 of [10, 5, 2, 1, 0.5, 0.1, 0.05, 0.01, 0.001, 0.0001]) {
  const def = { fit, closed: true, handles: [0, h2, null, null] };
  const next = respline(s0, def), r = settleShape(next, s0), s: any = r.shape;
  const moved = Math.max(...s.points.map((p: P2, i: number) => Math.hypot(p[0] - next.points[i][0], p[1] - next.points[i][1])));
  console.log(`handles [0, ${h2}] editError=${splineEditError(def)} settle error=${r.error} spline kept=${!!s.spline} max point move=${moved.toExponential(2)}`);
}
