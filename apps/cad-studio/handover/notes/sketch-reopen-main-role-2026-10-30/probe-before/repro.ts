// D358 baseline: a sketch whose main profile is a circle (or slot) with a rectangle region beside it.
// Reopen (sketchShapes -> startPicking 'select', as Studio's editSketch does) and Finish with no change
// (main shape first, as Studio's finishSketch does for a reopened sketch). Run: node run.mjs repro.ts
import { sketchShapes } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/reopen';
import { profileOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/loops';
import { joinOpen } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/trim';
import { startPicking } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/select';
import { xyPlane } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/plane';
import { editFields } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/app/editFields';
const J = (x: unknown) => JSON.stringify(x);
function refinish(node: any) {
  const { shape, done } = sketchShapes(node, {});
  const s: any = startPicking({ plane: xyPlane(), tool: 'select', shape, done, editNode: 0 } as never, 'select');
  const p: any = profileOf(joinOpen([s.shape, ...s.done].filter(Boolean)));
  return { picked: s.shape?.kind, node: 'error' in p ? p : p.node };
}
const rect = [{ kind: 'line', start: [20, -5] }, { kind: 'line', start: [40, -5] }, { kind: 'line', start: [40, 5] }, { kind: 'line', start: [20, 5] }];
const cases: [string, any][] = [
  ['circle main + rectangle region', { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 5, regions: [rect] }],
];
for (const [label, st] of cases) {
  const once = refinish(st), twice = once.node.kind ? refinish(once.node) : null;
  console.log(label);
  console.log('  stored     ', J({ profile: st.profile, regions: st.regions?.length }));
  console.log('  picked     ', once.picked);
  console.log('  finish 1   ', J({ profile: once.node.profile, center: once.node.center, radius: once.node.radius, regions: once.node.regions?.map((l: any[]) => l.map(g => g.kind)) }));
  console.log('  finish 2   ', J({ profile: twice?.node.profile, regions: twice?.node.regions?.map((l: any[]) => l.map(g => g.kind)) }));
  const keys = (n: any) => editFields([n, { kind: 'extrude', sketch: 0, height: 10 }] as never, 1).map((f: any) => f.key);
  console.log('  fields before', J(keys(st)));
  console.log('  fields after ', J(keys(once.node)));
}
