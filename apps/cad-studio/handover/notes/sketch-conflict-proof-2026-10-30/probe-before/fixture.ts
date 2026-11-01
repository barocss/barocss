// Generates the D350 Studio fixture: a 60x30 rectangle outline (H/V, edge 1 length 60) extruded 10, and a standalone
// triangle outline (edges 1 and 2 length 10) beside it for the non-rectilinear comparison.
import { writeFileSync } from 'node:fs';
import { profileOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/loops';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/settle';
import { commitDimension } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/rules';
import { evaluateDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/evaluate';
const closed = (pts: [number, number][]) => { const s: any = { kind: 'polygon', closed: true, points: pts, bulges: pts.map(() => 0) }; return settleShape(s, { ...s, closed: false }).shape as any; };
let rect = closed([[0, 0], [60, 0], [60, 30], [0, 30]]); let r: any = commitDimension(rect, 'len0', 60); if (!r.ok) throw new Error(r.reason); rect = r.shape;
let tri = closed([[100, 0], [110, 0], [105, 8]]);
for (const [k, v] of [['len0', 10], ['len1', 10]] as const) { r = commitDimension(tri, k, v); if (!r.ok) throw new Error(r.reason); tri = r.shape; }
const pr = profileOf([rect]), pt = profileOf([tri]); if ('error' in pr || 'error' in pt) throw new Error('profile');
const doc: any = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [{ ...pr.node, id: 'n0' }, { kind: 'extrude', sketch: 0, height: 10, id: 'n1' }, { ...pt.node, id: 'n2' }], outputs: { b1: { node: 1, side: 'solid' } }, nextId: 3 };
const ev: any = await evaluateDoc(doc); if (!ev.ok) throw new Error(JSON.stringify(ev.error));
console.log('bodies', ev.bodies.length, JSON.stringify(doc.nodes.map((n: any) => [n.kind, n.id, n.profile, n.outline?.lengths, n.outline?.hv])));
writeFileSync('/private/tmp/claude-501/-Users-user-github-barocss-barocss--claude-worktrees-heuristic-gould-b94e20/de70f387-aaec-4213-a427-f7006e5caab3/scratchpad/probe/d350.bcad', JSON.stringify(doc, null, 2) + '\n');
