import { profileOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/loops';
import { sketchShapes } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/reopen';
import { joinOpen } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/trim';
import { startPicking } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/select';
import { xyPlane } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/plane';
import { withNode, emptyDoc, type StudioDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/doc';
import { evaluatePart } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/evaluate';
const finish = (shape: any, done: any[], editNode: boolean) => {
  const shapes = joinOpen((editNode && shape ? [shape, ...done] : [...done, ...(shape ? [shape] : [])]).map((x: any) => x.kind === 'polygon' && !x.closed ? { ...x, pending: false } : x));
  const profile: any = profileOf(shapes); if ('error' in profile) return profile;
  const refs = shapes.filter((x: any) => x.construction || x.kind === 'bezier');
  return refs.length ? { ...profile.node, construction: refs } : profile.node;
};
const reopenFinish = (node: any) => { const { shape, done } = sketchShapes(JSON.parse(JSON.stringify(node))); const s: any = startPicking({ plane: xyPlane(), tool: 'select', shape, done, editNode: 0 } as any, 'select'); return finish(s.shape, s.done, true); };
const rect = { kind: 'rectangle', a: [0, 0], b: [10, 6] };
const names = (node: any) => { let d: StudioDoc = withNode(emptyDoc(), node); d = withNode(d, { kind: 'extrude', sketch: d.nodes.length - 1, height: 5 } as any); const r: any = evaluatePart(d, 1); const m = r.bodies?.[0]?.mesh; return r.ok ? [...new Set((m?.faces ?? []).map((f: any) => f.name))].join(' ') : 'ERR ' + JSON.stringify(r.error).slice(0, 100); };
for (const [label, first] of [['bezier first', { kind: 'bezier', poles: [[0, 20], [10, 40], [20, 20]] }], ['construction line first (pre-D354 analogue)', { kind: 'polygon', points: [[0, 30], [5, 30]], closed: false, construction: true }]] as any) {
  const n1 = finish(rect, [first], false), n2 = reopenFinish(n1);
  console.log(label, '\n  Finish sideTags', JSON.stringify(n1.sideTags), 'faces:', names(n1), '\n  reopen+Finish sideTags', JSON.stringify(n2.sideTags), 'faces:', names(n2));
}
