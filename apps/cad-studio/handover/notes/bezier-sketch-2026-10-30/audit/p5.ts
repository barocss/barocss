import { bezierCurve } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/bezier';
import { curvesSource } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/curveSource';
import { tiltPlane, offsetPlane, standardPlane } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/plane';
import { emptyDirect, importSource } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/direct';
import { copyLoftGuide } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/app/loftGuides';
import { loadDirect } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/directModule';
await loadDirect();
for (const plane of [tiltPlane({ origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] }, 30), offsetPlane(tiltPlane(standardPlane('xz'), 17), 12.3)]) {
  const c = bezierCurve(plane, [[0, 0], [1, 3], [3, 3], [4, 0]]), d = importSource(emptyDirect(), curvesSource('sketch', [c]), 'S'), g: any = copyLoftGuide({ direct: d }, d.objects[0].id);
  const diff = Math.max(...g.guide.controlPoints.flatMap((p: number[], i: number) => p.map((v, k) => Math.abs(v - c.points[i][k]))));
  console.log('tilted plane: guide kind', g.guide.kind, 'controlPoints deepEqual bezierCurve.points?', JSON.stringify(g.guide.controlPoints) === JSON.stringify(c.points), 'max diff', diff);
}
