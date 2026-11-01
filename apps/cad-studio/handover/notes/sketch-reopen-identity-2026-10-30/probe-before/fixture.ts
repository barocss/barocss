// Generates the D349 Studio fixture: a 60x40x10 box and a 20x15 rectangle sketch drawn on its top face (on the box body).
import { writeFileSync } from 'node:fs';
import { part } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/api';
import { profileOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/loops';
import { withNode } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/doc';
import { evaluateDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/evaluate';
const seed: any = part('d349').box({ w: 60, d: 40, h: 10 }).doc;
console.log('seed nodes', JSON.stringify(seed.nodes.map((n: any) => [n.kind, n.id])), 'outputs', JSON.stringify(seed.outputs));
const pr = profileOf([{ kind: 'polygon', closed: true, points: [[10, 10], [30, 10], [30, 25], [10, 25]], hv: { h: [0, 2], v: [1, 3] } } as any]);
if ('error' in pr) throw new Error(pr.error);
const body = Object.values(seed.outputs as Record<string, any>)[0];
const doc: any = withNode(seed, { ...pr.node, plane: { origin: [0, 0, 10], normal: [0, 0, 1], xAxis: [1, 0, 0] }, on: { node: body.node, side: body.side } } as any);
const ev: any = await evaluateDoc(doc); if (!ev.ok) throw new Error(JSON.stringify(ev.error));
console.log('nodes', JSON.stringify(doc.nodes.map((n: any) => [n.kind, n.id, n.profile, n.on])), 'nextId', doc.nextId, 'bodies', ev.bodies.length);
writeFileSync('/private/tmp/claude-501/-Users-user-github-barocss-barocss--claude-worktrees-heuristic-gould-b94e20/de70f387-aaec-4213-a427-f7006e5caab3/scratchpad/probe/d349.bcad', JSON.stringify(doc, null, 2) + '\n');
console.log(JSON.stringify(doc.nodes[doc.nodes.length - 1]));
