import { withIds } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/entityIds';
import { evaluateDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/evaluate';
import type { SketchShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/types';
import { bandOver, type P } from './geo';
const C = (c: P, r: number): SketchShape => ({ kind: 'circle', c, r, construction: true });
const p = (r: number, t: number): P => [r * Math.cos(t), r * Math.sin(t)];
const doc = (deg: number, edges: string[]) => {
  const a = deg * Math.PI / 180, all = withIds([C([0, 0], 10), C(p(100, a), 1), C(p(100, a + Math.PI), 1)]), band = bandOver(all, [0, 1, 2]);
  return { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [{ kind: 'sketch', profile: 'band', band, construction: all, id: 'n0' }, { kind: 'extrude', sketch: 0, height: 10, id: 'n1' }, ...(edges.length ? [{ kind: 'fillet', parent: { node: 1, side: 'solid' }, edges, radius: 2, id: 'n2' }] : [])], outputs: { b1: { node: edges.length ? 2 : 1, side: 'solid' } }, nextId: 3 } as never;
};
const r0 = await evaluateDoc(doc(75, []), 1) as any;
const e0 = r0.bodies[0].mesh.edges.find((e: any) => e.names.some((n: string) => n === 'n1.side[b1_e1_0]|n1.top'));
console.log('edge keys', Object.keys(e0));
const mid = (e: any) => { const pts = e.points ?? e.positions ?? e.polyline; return JSON.stringify(pts?.slice?.(0, 6)); };
for (const deg of [75, 105]) {
  const r = await evaluateDoc(doc(deg, []), 1) as any, e = r.bodies[0].mesh.edges.find((x: any) => x.names.includes('n1.side[b1_e1_0]|n1.top'));
  console.log(deg, 'side[b1_e1_0]|top at', mid(e));
  const f = await evaluateDoc(doc(deg, ['n1.side[b1_e1_0]|n1.top']), 1) as any;
  console.log(deg, 'fillet', f.ok ? 'ok' : JSON.stringify(f.error).slice(0, 200), f.ok ? JSON.stringify(f.doc?.nodes?.[2]?.rematched ?? null) : '');
}
// topology change: e1 wins twice -> once
const docT = (y3: number, edges: string[]) => {
  const all = withIds([C([0, 0], 10), C([100, 0], 1), C([-100, y3], 1)]), band = bandOver(all, [0, 1, 2]);
  return { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [{ kind: 'sketch', profile: 'band', band, construction: all, id: 'n0' }, { kind: 'extrude', sketch: 0, height: 10, id: 'n1' }, ...(edges.length ? [{ kind: 'fillet', parent: { node: 1, side: 'solid' }, edges, radius: 2, id: 'n2' }] : [])], outputs: { b1: { node: edges.length ? 2 : 1, side: 'solid' } }, nextId: 3 } as never;
};
for (const y3 of [0, 40]) { const r = await evaluateDoc(docT(y3, []), 1) as any; console.log('y3', y3, r.ok ? r.bodies[0].mesh.edges.flatMap((e: any) => e.names).filter((n: string) => /b1_e1/.test(n) && /top/.test(n)).join(' ') : r.error); }
for (const nm of ['n1.side[b1_e1_0]|n1.top', 'n1.side[b1_e1_1]|n1.top']) { const f = await evaluateDoc(docT(40, [nm]), 1) as any; console.log('y3=40 fillet on', nm, '->', f.ok ? 'ok (rematched? ' + JSON.stringify(f) .match(/rematch[^}]*/)?.[0] + ')' : JSON.stringify(f.error).slice(0, 250)); }
