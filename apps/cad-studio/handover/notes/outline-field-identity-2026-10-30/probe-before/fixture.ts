// Generates the D348 Studio fixture: an L plate (dimensioned constrained outline + rectangular hole + one construction
// line), extruded 10 and filleted r3 on the named convex corner n1.side[e2]|n1.side[e3] at (60,20).
import { writeFileSync } from 'node:fs';
import { part, sketch } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/api';
import { profileOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/loops';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/settle';
import { commitDimension } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/rules';
import { evaluateDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/evaluate';
type P2 = [number, number];
const pts: P2[] = [[0,0],[60,0],[60,20],[20,20],[20,40],[0,40]];
const corner = (b: any) => b.edges().along('z').where((e: any) => e.a[0] === 60 && e.a[1] === 20);
const doc: any = part('d348').extrude(sketch().polygon(pts), { h: 10 }).fillet(corner, { radius: 3 }).doc;
let L: any = { kind: 'polygon', closed: true, points: pts, bulges: pts.map(() => 0), ids: doc.nodes[0].sideTags.outer };
L = settleShape(L, { ...L, closed: false }).shape;
for (const [k, v] of [['len0', 60], ['len1', 20]] as const) { const r = commitDimension(L, k, v); if (!r.ok) throw new Error(r.reason); L = r.shape; }
const hole: any = { kind: 'polygon', closed: true, points: [[5,5],[15,5],[15,10],[5,10]], bulges: [0,0,0,0] };
const pr = profileOf([L, hole]); if ('error' in pr) throw new Error(pr.error);
const construction = [{ kind: 'polygon', closed: false, points: [[0, 0], [60, 40]], bulges: [0, 0], construction: true, ids: ['e11'] }];
doc.nodes[0] = { ...pr.node, construction, id: doc.nodes[0].id };
const ev: any = await evaluateDoc(doc); if (!ev.ok) throw new Error(JSON.stringify(ev.error));
console.log(JSON.stringify(Object.keys(doc)), doc.nextId, JSON.stringify(doc.nodes.map((n: any) => n.id)));
writeFileSync('/private/tmp/claude-501/-Users-user-github-barocss-barocss--claude-worktrees-heuristic-gould-b94e20/de70f387-aaec-4213-a427-f7006e5caab3/scratchpad/probe/d348.bcad', JSON.stringify(doc, null, 2) + '\n');
console.log(JSON.stringify(doc.nodes[0].sideTags), JSON.stringify(doc.nodes[0].outline));
