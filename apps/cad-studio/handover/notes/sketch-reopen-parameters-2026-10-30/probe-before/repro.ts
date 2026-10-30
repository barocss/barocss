// D356 reproduction: a rectangle sketch whose Width is bound to a parameter, reopened and finished unchanged.
import { editFields } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/app/editFields';
import { sketchShapes } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/reopen';
import { startPicking } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/select';
import { profileOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/loops';
import { joinOpen } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/trim';
import { xyPlane } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/plane';
import { evaluateDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/evaluate';
const doc: any = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: { W: 60 }, nodes: [
  { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40], id: 'n0', sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] } },
  { kind: 'extrude', sketch: 0, height: 10, id: 'n1' }], outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2 };
const fields: any[] = editFields(doc.nodes, 1, doc.parameters);
const w = fields.find(f => f.key === 'w'); console.log('fields', fields.map(f => f.key).join(','), 'width bindable', !!w?.bind);
const bound = w.bind(doc.nodes, 'W'); console.log('bound sketch node', JSON.stringify(bound?.[0]));
const docB = { ...doc, nodes: bound };
const ev0: any = await evaluateDoc(docB); console.log('bound eval ok', ev0.ok, ev0.ok ? ev0.bodies[0]?.mesh ? 'body' : '' : JSON.stringify(ev0.error).slice(0, 200));
// Reopen and Finish without a change, as useSketchActions does (editNode branch: shape first).
const { shape, done } = sketchShapes(JSON.parse(JSON.stringify(bound[0])));
console.log('reopened shape', JSON.stringify(shape));
const s: any = startPicking({ plane: xyPlane(), tool: 'select', shape, done, editNode: 0 } as any, 'select');
const pr: any = profileOf(joinOpen([s.shape, ...s.done]));
console.log('refinished node', JSON.stringify('error' in pr ? pr : pr.node));
const ev1: any = await evaluateDoc({ ...docB, nodes: [{ ...pr.node, id: 'n0' }, docB.nodes[1]] }); console.log('refinished eval ok', ev1.ok, ev1.ok ? '' : JSON.stringify(ev1.error).slice(0, 300));
