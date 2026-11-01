import { profileOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/loops';
import { sketchShapes } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/reopen';
import { joinOpen } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/trim';
import { startPicking } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/select';
import { xyPlane } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/plane';
import { rectanglePart, withNode, emptyDoc, type PlanarFaceOutlineInsetAssociation, type SketchNode, type StudioDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/doc';
import { featureId, withIds } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/ids';
import { resolveAssociativeSketch } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/part';
import { evaluatePart } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/evaluate';
import { bezierPoint } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/bezier';
const finish = (shape: any, done: any[], editNode: boolean) => {
  const shapes = joinOpen((editNode && shape ? [shape, ...done] : [...done, ...(shape ? [shape] : [])]).map((x: any) => x.kind === 'polygon' && !x.closed ? { ...x, pending: false } : x));
  const profile: any = profileOf(shapes); if ('error' in profile) return profile;
  const refs = shapes.filter((x: any) => x.construction || x.kind === 'bezier');
  return refs.length ? { ...profile.node, construction: refs } : profile.node;
};
const reopenFinish = (node: any) => { const { shape, done } = sketchShapes(JSON.parse(JSON.stringify(node))); const s: any = startPicking({ plane: xyPlane(), tool: 'select', shape, done, editNode: 0 } as any, 'select'); return finish(s.shape, s.done, true); };
const n1: any = finish({ kind: 'circle', c: [5, 3], r: 1 }, [{ kind: 'rectangle', a: [0, 0], b: [10, 6] }], false), n2: any = reopenFinish(n1);
console.log('rect + circle hole, no Bezier: Finish', JSON.stringify(n1.sideTags), '-> reopen+Finish', JSON.stringify(n2.sideTags));
