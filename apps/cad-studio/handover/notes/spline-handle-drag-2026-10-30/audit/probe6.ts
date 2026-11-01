import { draggedSpline, splineHandleGeometry } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/apps/cad-studio/src/viewport/splineHandles';
import { respline, splineEditError, splineShape, splineAutoHandles, type SplineDef } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/spline';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/settle';
import { SketchHistory } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/history';
type Poly = ReturnType<typeof splineShape>;
const scale = 4, P = (u: number, v: number) => [400 + scale * u, 300 - scale * v] as const, unP = (x: number, y: number) => [(x - 400) / scale, -(y - 300) / scale] as [number, number];
const s = settleShape(splineShape({ fit: [[0, 0], [40, 0], [40, 30], [0, 30]], closed: true }), null).shape as Poly;
console.log('start keys', Object.keys(s).join(','), 'hv', JSON.stringify(s.hv));
// 1 px jitter on fit point 1 (pointer down at its centre, one move 1 px right): what Viewport would do.
const c = P(40, 0), def = draggedSpline(s.spline!, { kind: 'fit', i: 1 }, unP(c[0] + 1, c[1]));
console.log('fit jitter def equal to start def:', JSON.stringify(def) === JSON.stringify(s.spline), 'editError', splineEditError(def));
const next = respline(s, def); // d.splineLast -> emitted on pointer-up
const r = settleShape(next, s), h = new SketchHistory(); h.push(s, r.shape!);
console.log('emitted shape JSON-equal to start:', JSON.stringify(r.shape) === JSON.stringify(s), '| history canUndo after no-op drag:', h.canUndo);
const sj = JSON.stringify(s), rj = JSON.stringify(r.shape); const ks = Object.keys(s).filter(k => JSON.stringify((s as any)[k]) !== JSON.stringify((r.shape as any)[k])); console.log('differing keys', ks.join(','));
// 1 px jitter at an automatic handle end
const g = splineHandleGeometry(s.spline!, P)[1];
const auto = splineAutoHandles(s.spline!.fit, true)[1];
const dh = draggedSpline(s.spline!, { kind: 'handle', i: 1, sign: 1 }, unP(g.fwd[0], g.fwd[1] + 1));
console.log('auto handle at fit 1', auto.toFixed(3), '-> after 1 px jitter on its end', dh.handles![1], '| outline point 2 moves by', (() => { const o = respline(s, dh); return Math.hypot(o.points[3][0] - s.points[3][0], o.points[3][1] - s.points[3][1]).toFixed(4); })(), 'mm (joint 3)');
