// #2229 repro: a clear motion (link b's far corners graze a post by a known gap g > 0) whose sample budget runs out.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const T = '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model';
import { evaluatePart, placeBody, type BodyResult } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/evaluate';
import { rectanglePart, type StudioDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/doc';
import { rotationMatrix } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/placement';
import { solveDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/assembly/edit';
import { treeOfDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/chat/robot';
import { convexHull } from '@barocss/cad';
import { sweepLinks, sweepPath } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/robot/sweep';
import { sweepTimed } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/robot/ccd';

const CASES = join(T, '../barocss-cad/conformance/rm');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function robot(doc: StudioDoc) {
  const r = await evaluate(doc); if (!r.ok) throw new Error('eval');
  const tree = await treeOfDoc(doc, r.bodies, evaluate), solved = solveDoc(doc).doc, world = new Map<string, BodyResult[]>([['base', r.bodies]]);
  for (const i of solved.instances ?? []) {
    const e = await evaluate(i.doc); if (!e.ok) throw new Error('eval ' + i.id);
    world.set(i.id, e.bodies.map(b => placeBody({ ...b, mesh: { ...b.mesh, positions: b.mesh.positions.slice(), normals: b.mesh.normals.slice(), edgeLines: b.mesh.edgeLines.slice() } }, rotationMatrix(i.rotation), i.position)));
  }
  return { tree, links: sweepLinks(tree, p => world.get(p), p => convexHull(p).positions) };
}
const base = (): StudioDoc => JSON.parse(readFileSync(join(CASES, 'chain-2r', 'case.json'), 'utf8')).input.document;
const withPost = (pos: [number, number, number], w: number, d: number): StudioDoc => { const x = base(); return { ...x, instances: [...x.instances!, { id: 'post', name: 'post', doc: rectanglePart(w, d, 30), position: pos, rotation: [0, 0, 0], grounded: true }] }; };
const LIMITS = { default: { v: 1, a: 2, j: 20 } };
const brief = (r: any) => JSON.stringify({ clear: r.clear, contact: r.contact ? { s: r.contact.s, links: r.contact.links } : undefined, toi: r.toi, links: r.links, min: r.minClearance, samples: r.samples });

// Joint a's axis: world (20,20), +z. R = the farthest point of link b from it at home (independent of sweep code: raw positions).
const JX = 20, JY = 20;
{
  const probe = await robot(withPost([200, 200, 0], 10, 10));
  const j = probe.tree.joints.find(k => k.key === 'base~a')!; console.log('joint base~a', j.type, j.origin, j.axis, 'keys', probe.tree.joints.map(k => k.key));
  const b = probe.links.find(l => l.link === 'b')!, a = probe.links.find(l => l.link === 'a')!;
  let R = 0, Ra = 0; for (let i = 0; i < b.positions.length; i += 3) R = Math.max(R, Math.hypot(b.positions[i] - JX, b.positions[i + 1] - JY));
  for (let i = 0; i < a.positions.length; i += 3) Ra = Math.max(Ra, Math.hypot(a.positions[i] - JX, a.positions[i + 1] - JY));
  let zb = [Infinity, -Infinity]; for (let i = 2; i < b.positions.length; i += 3) { zb[0] = Math.min(zb[0], b.positions[i]); zb[1] = Math.max(zb[1], b.positions[i]); }
  console.log(`link b max radius about joint a R=${R} (hypot(90,10)=${Math.hypot(90, 10)}), link a ${Ra}, b z ${zb}`);
  (globalThis as any).R = R;
}
const R: number = (globalThis as any).R;

{
  const { tree, links } = await robot(withPost([JX + R - 3, JY - 30, 0], 10, 60));
  const st = sweepTimed(tree, links, { waypoints: [{ 'base~a': -0.4 }, { 'base~a': 0.4 }], profile: 'trapezoid', limits: LIMITS });
  const sp = sweepPath(tree, links, { 'base~a': -0.4 }, { 'base~a': 0.4 });
  console.log('COLLISION', brief(st), brief(sp), 'toi', st.toi);
}
