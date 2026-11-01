import { profileOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/loops';
import { outlineFields } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/outlineFields';
import { commitDimension } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/rules';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/settle';
type P2 = [number, number];
const pts: P2[] = [[0,0],[60,0],[60,30],[0,30]];
let s: any = { kind: 'polygon', closed: true, points: pts, bulges: [0,0,0,0], circles: [{ c: [15, 15], r: 4 }] };
s = settleShape(s, { ...s, closed: false }).shape;
for (const [k, v] of [['len0', 60], ['len1', 30], ['cdx0_0', 15]] as const) { const r = commitDimension(s, k, v); if (!r.ok) throw new Error(k + ' ' + r.reason); s = r.shape; }
const tri: any = { kind: 'polygon', closed: true, points: [[40,5],[55,5],[50,20]], bulges: [0,0,0] };
const pr = profileOf([s, tri]); if ('error' in pr) throw new Error(pr.error);
const node: any = { ...pr.node, id: 'n0' };
console.log('A circle+hole before', JSON.stringify(node.sideTags), 'profile', node.profile);
const f: any = outlineFields([node], 0, '').find((f: any) => f.key === 'olen0');
const after: any = f.set([node], 64)[0];
console.log('A after', JSON.stringify(after.sideTags), 'id', after.id);
// B: a pre-R10a node (no sideTags): positional names must not change.
const old: any = { ...pr.node, id: 'n0' }; delete old.sideTags;
const g: any = outlineFields([old], 0, '').find((f: any) => f.key === 'olen0');
const afterB: any = g.set([old], 64)[0];
console.log('B pre-R10a after sideTags', JSON.stringify(afterB.sideTags));
