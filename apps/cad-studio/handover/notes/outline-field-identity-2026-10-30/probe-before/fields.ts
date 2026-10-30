import { profileOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/loops';
import { outlineFields } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/outlineFields';
import { sketchShapes } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/reopen';
import { checkEdit, commitDimension } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/rules';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/settle';
type P2 = [number, number];
// An L-shaped outline (concave -> loop profile), dimensioned, with a polygon hole and a construction line.
let L: any = { kind: 'polygon', closed: true, points: [[0,0],[60,0],[60,20],[20,20],[20,40],[0,40]] as P2[], bulges: [0,0,0,0,0,0] };
L = settleShape(L, { ...L, closed: false }).shape;
for (const [k, v] of [['len0', 60], ['len1', 20], ['len2', 40], ['len3', 20]] as const) { const r = commitDimension(L, k, v); if (!r.ok) throw new Error(k + r.reason); L = r.shape; }
const hole: any = { kind: 'polygon', closed: true, points: [[5,5],[15,5],[15,10],[5,10]] as P2[], bulges: [0,0,0,0] };
const cons: any = { kind: 'polygon', closed: false, points: [[0,0],[60,40]] as P2[], construction: true };
const pr = profileOf([L, hole]); if ('error' in pr) throw new Error(pr.error);
const node: any = { ...pr.node, id: 'n1', construction: [cons], plane: { origin: [0,0,5], normal: [0,0,1], xAxis: [1,0,0] }, on: { node: 0, body: 0 } };
console.log('before keys', Object.keys(node).sort().join(','));
console.log('before sideTags', JSON.stringify(node.sideTags));
const fields = outlineFields([node], 0, '');
console.log('fields', fields.map(f => f.key + ':' + f.label + '=' + (f as any).get([node])).join(' | '));
const f = fields.find(f => f.key === 'olen0')! as any;
const after = f.set([node], 70)[0] as any;
console.log('after keys', Object.keys(after).sort().join(','));
console.log('after id', after.id, 'construction', JSON.stringify(after.construction), 'on', JSON.stringify(after.on));
console.log('after sideTags', JSON.stringify(after.sideTags));
console.log('after len0 get', f.get([after]), 'outline lengths', JSON.stringify(after.outline?.lengths));
const re = sketchShapes(after); console.log('reopen done', re.done.length, re.done.map((d: any) => d.kind + (d.construction ? '(c)' : '')).join(','));
