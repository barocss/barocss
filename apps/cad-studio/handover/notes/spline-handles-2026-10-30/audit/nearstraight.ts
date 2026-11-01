import { splineOutline, splineEditError, splineShape, splineAutoHandles, type SplineDef } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/spline';
import { arcOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/profile';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/settle';
import { profileOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/loops';
import { evaluateDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/evaluate';
import { part, sketch } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/api';
type P2 = [number, number];
function ev(def: SplineDef, label: string) {
  const shape = splineShape(def), r = settleShape(shape, { ...shape, closed: false }), s: any = r.shape;
  const radii = s.bulges.map((b: number, i: number) => b ? Math.round(arcOf(s.points[i], s.points[(i + 1) % s.points.length], b).radius) : 0);
  const pr = profileOf([s]);
  if ('error' in pr) { console.log(label, 'profile error', pr.error); return; }
  const base = part('ns').extrude(sketch().polygon([[0, 0], [10, 0], [10, 10], [0, 10]]), { h: 10 }).doc;
  const doc: any = { ...base, nodes: base.nodes.map((x: any, i: number) => i === 0 ? { ...pr.node, id: x.id } : x) };
  const e = evaluateDoc(doc, 1);
  console.log(label, 'editError=', splineEditError(def), 'settleErr=', r.error, 'spline kept=', !!s.spline, 'maxR=', Math.max(...radii), 'eval ok=', e.ok, e.ok ? '' : JSON.stringify((e as any).error.detail));
}
// 1) the fuzz case
ev({ fit: [[8.236,21.735],[-1.799,27.349],[-33.301,-0.895],[16.738,-14.108],[35.775,-0.558]], closed: true, handles: [null,-187,null,null,72] }, 'fuzz case');
ev({ fit: [[8.236,21.735],[-1.799,27.349],[-33.301,-0.895],[16.738,-14.108],[35.775,-0.558]], closed: true }, 'fuzz case auto');
// 2) a near-horizontal bottom span, user types 0 deg at both ends
const fit: P2[] = [[0, 0], [30, 0.01], [30, 20], [0, 20]];
console.log('auto handles', splineAutoHandles(fit, true).map(a => a.toFixed(3)));
ev({ fit, closed: true }, 'near-flat auto');
ev({ fit, closed: true, handles: [0, 0, null, null] }, 'near-flat handles 0,0');
ev({ fit, closed: true, handles: [0, null, null, null] }, 'near-flat handle 0 at p0');
