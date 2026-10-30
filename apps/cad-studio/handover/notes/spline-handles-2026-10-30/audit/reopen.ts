// Reopen behaviour: (a) an old-style node (base splineOutline, no spline field, straight span = 1 piece) round-trips
// unchanged; (b) a node whose stored spline does not match; (c) malformed spline fields; (d) feature editor fields.
import { splineOutline as baseOutline } from './base/spline';
import { splineMatches, splineEditError } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/spline';
import { profileOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/loops';
import { sketchShapes } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/reopen';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/settle';
import { editFields } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/app/editFields';
import { part, sketch } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/api';
import { evaluateDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/evaluate';
type P2 = [number, number];
const fit: P2[] = [[0, 0], [20, 0], [40, 0], [40, 20], [0, 20]];
const o = baseOutline(fit, true); console.log('(a) base points', o.points.length);
const old: any = settleShape({ kind: 'polygon', points: o.points, bulges: o.bulges, closed: true, fromSpline: true } as any, { kind: 'polygon', points: o.points, bulges: o.bulges, closed: false } as any).shape;
const p = profileOf([old]); if ('error' in p) throw 0;
const node: any = { ...p.node, id: 'n0' };
const back: any = sketchShapes(node).shape, p2 = profileOf([settleShape(back, back).shape as any]); if ('error' in p2) throw 0;
console.log('(a) old node reopen+finish: points same', JSON.stringify(p2.node.outline?.points ?? (p2.node as any).segments) === JSON.stringify(node.outline?.points ?? node.segments), 'sideTags same', JSON.stringify(p2.node.sideTags) === JSON.stringify(node.sideTags), 'spline field', (p2.node as any).outline?.spline ?? null, 'loop pieces', node.outline?.points.length);
// (b) mismatching stored spline (hand-written file / agent): different fit
const bad: any = { ...node, outline: { ...node.outline, spline: { fit: [[0, 0], [40, 0], [40, 20], [0, 20]], closed: true } } };
const b: any = sketchShapes(bad).shape;
console.log('(b) mismatch reopen: spline restored', !!b.spline, 'fromSpline', b.fromSpline ?? null, 'splineMatches', splineMatches(b));
const fb = profileOf([b]); console.log('(b) Finish w/o edit: stored spline', 'node' in fb ? (fb.node as any).outline?.spline ?? null : fb);
const s2: any = settleShape(b, b).shape; console.log('(b) after a settle: spline', s2.spline ?? null);
// eval of a doc carrying a mismatching spline
const base = part('r').extrude(sketch().polygon([[0, 0], [10, 0], [10, 10], [0, 10]]), { h: 10 }).doc;
console.log('(b) evaluate with mismatching spline ok', evaluateDoc({ ...base, nodes: [bad, base.nodes[1]] } as any, 1).ok);
// (c) malformed
const cases: [string, unknown][] = [['{}', {}], ['fit:null', { fit: null, closed: true }], ['fit string', { fit: 'x', closed: true }], ['fit pts short', { fit: [[0], [1, 2], [3, 4]], closed: true }], ['handles too long', { fit: [[0, 0], [40, 0], [40, 20], [0, 20]], closed: true, handles: [1, 2, 3, 4, 5, 6, 7] }], ['handles string', { fit: [[0, 0], [40, 0], [40, 20], [0, 20]], closed: true, handles: 'abc' }], ['closed missing', { fit: [[0, 0], [40, 0], [40, 20], [0, 20]] }]];
for (const [label, sp] of cases) {
  const nn: any = { ...node, outline: { ...node.outline, spline: sp } };
  let r = '';
  try { const sh: any = sketchShapes(nn).shape; r += `reopen ok (spline ${JSON.stringify(sh.spline)?.slice(0, 60)}, matches ${(() => { try { return splineMatches(sh); } catch (e) { return 'THROW ' + (e as Error).message; } })()})`; } catch (e) { r += 'reopen THROW ' + (e as Error).message; }
  try { evaluateDoc({ ...base, nodes: [nn, base.nodes[1]] } as any, 1).ok ? r += '; eval ok' : r += '; eval fail'; } catch (e) { r += '; eval THROW ' + (e as Error).message; }
  try { editFields([nn, base.nodes[1]] as any, 1); r += '; editFields ok'; } catch (e) { r += '; editFields THROW ' + (e as Error).message; }
  console.log('(c)', label, '->', r);
}
// (d) a spline outline that also carries a length dimension (added at its measured value) and a malformed spline: feature editor
const withLen: any = { ...node, outline: { ...node.outline, lengths: { 1: 20 }, spline: { fit: null, closed: true } } };
try { const f = editFields([withLen, base.nodes[1]] as any, 1); console.log('(d) editFields with lengths + malformed spline: fields', f.length); } catch (e) { console.log('(d) editFields THROW', (e as Error).message); }
