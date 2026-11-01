import { part, sketch } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/api';
import { editFields } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/app/editFields';
import { evaluateDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/evaluate';
import { profileOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/loops';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/settle';
import { commitDimension } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/rules';
type P2 = [number, number];
const pts: P2[] = [[0,0],[60,0],[60,20],[20,20],[20,40],[0,40]];
const corner = (b: any) => b.edges().along('z').where((e: any) => e.a[0] === 60 && e.a[1] === 20);
const was = part('L').extrude(sketch().polygon(pts), { h: 10 }).fillet(corner, { radius: 3 });
const doc: any = was.doc;
console.log('nodes', doc.nodes.map((n: any) => n.kind + ':' + (n.id ?? '-')).join(' '), 'fillet edges', JSON.stringify(doc.nodes[2].edges));
// Give the sketch its constrained outline, as Finish sketch stores a dimensioned outline.
let L: any = { kind: 'polygon', closed: true, points: pts, bulges: pts.map(() => 0), ids: doc.nodes[0].sideTags.outer };
L = settleShape(L, { ...L, closed: false }).shape;
for (const [k, v] of [['len0', 60], ['len1', 20]] as const) { const r = commitDimension(L, k, v); if (!r.ok) throw new Error(r.reason); L = r.shape; }
const hole: any = { kind: 'polygon', closed: true, points: [[5,5],[15,5],[15,10],[5,10]], bulges: [0,0,0,0] };
const pr = profileOf([L, hole]); if ('error' in pr) throw new Error(pr.error);
doc.nodes[0] = { ...pr.node, id: doc.nodes[0].id };
console.log('sketch node', JSON.stringify({ id: doc.nodes[0].id, profile: doc.nodes[0].profile, tags: doc.nodes[0].sideTags }));
const ev0: any = await evaluateDoc(doc); console.log('eval before ok', ev0?.ok ?? Object.keys(ev0 ?? {}).join(','), ev0?.error ?? '');
const fields = editFields(doc.nodes, 1);
console.log('fields', fields.map((f: any) => f.key).join(','));
const f: any = fields.find((f: any) => f.key.endsWith('olen0'));
const nodes = f.set(doc.nodes, 70);
console.log('edited sketch', JSON.stringify({ id: nodes[0].id, profile: nodes[0].profile, tags: nodes[0].sideTags }));
const names = (d: any) => { try { return part('x', d).select().edges().along('z').names(); } catch (e: any) { return 'ERR ' + e.message; } };
const ev1: any = await evaluateDoc({ ...doc, nodes }); console.log('eval after ok', ev1?.ok, typeof ev1?.error === 'string' ? ev1.error : JSON.stringify(ev1?.error ?? '').slice(0, 300));

console.log('fillet node after', JSON.stringify(nodes[2]).slice(0,300));
console.log('vol before', part('a', doc).mass({density:1}).volume);
try { console.log('vol after', part('b', { ...doc, nodes }).mass({density:1}).volume); } catch (e: any) { console.log('after facade ERR', e.code, e.message); }
