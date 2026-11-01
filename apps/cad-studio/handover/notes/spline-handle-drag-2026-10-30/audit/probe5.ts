import { splineHandleHit, splineHandleGeometry } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/apps/cad-studio/src/viewport/splineHandles';
import { splineShape, type SplineDef } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/spline';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/settle';
import { pickSketch } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/select';
import { sampleSegment } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/profile';
type Poly = ReturnType<typeof splineShape>;
for (const scale of [4, 1.5]) {
  const P = (u: number, v: number) => [400 + scale * u, 300 - scale * v] as const;
  const base: SplineDef = { fit: [[0, 0], [40, 0], [40, 30], [0, 30]], closed: true };
  const s = settleShape(splineShape(base), null).shape as Poly;
  const fitPicks = s.spline!.fit.map(f => { const q = P(f[0], f[1]); return [JSON.stringify(pickSketch(s, P, q[0], q[1])), JSON.stringify(splineHandleHit(s.spline!, P, q[0], q[1]))]; });
  console.log('scale', scale, 'click at each fit point -> pickSketch | splineHandleHit:', fitPicks.map(x => x.join(' | ')).join(' ;; '));
  // Samples along the outline on screen: positions where a click picks an edge/point and the drag hit also fires.
  let on = 0, swallowed = 0; const n = s.points.length;
  for (let i = 0; i < n; i++) for (const p of sampleSegment(s.points[i] as [number, number], s.points[(i + 1) % n] as [number, number], s.bulges?.[i] ?? 0, 64)) {
    const q = P(p[0], p[1]); const pk = pickSketch(s, P, q[0], q[1]); if (!pk) continue; on++;
    if (splineHandleHit(s.spline!, P, q[0], q[1])) swallowed++;
  }
  console.log('scale', scale, 'outline click samples', on, 'now start a spline drag instead of picking:', swallowed, '(' + (100 * swallowed / on).toFixed(1) + '%)');
  // handle ends: what pickSketch gives there
  const g = splineHandleGeometry(s.spline!, P);
  console.log('scale', scale, 'pickSketch at handle ends:', g.map(k => JSON.stringify(pickSketch(s, P, k.fwd[0], k.fwd[1])) + '/' + JSON.stringify(pickSketch(s, P, k.back[0], k.back[1]))).join(' '));
}
