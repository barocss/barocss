// Side-id stability: a closed spline sketch + extrude + fillet on a side's top edge (by side id). Change handles / a fit
// point through respline (+ settle as the panel does), re-store via profileOf, evaluate: does the fillet still resolve?
const W = '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src';
import { part, sketch } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/api';
import { evaluateDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/evaluate';
import { profileOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/loops';
import { sketchShapes } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/reopen';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/settle';
import { respline, splineShape, splineAutoHandles, splineEditError } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/spline';
type P2 = [number, number];
const formula = (k: number): P2[] => Array.from({ length: k }, (_, i) => { const t = 2 * Math.PI * i / k; return [Math.round((40 * Math.cos(t) + 7 * Math.cos(3 * t)) * 1e6) / 1e6, Math.round(25 * Math.sin(t) * 1e6) / 1e6]; });
const fit = formula(6), first = splineShape({ fit, closed: true }), closedS: any = settleShape(first, { ...first, closed: false }).shape;
const p0 = profileOf([closedS]); if ('error' in p0) throw new Error(p0.error);
const node0: any = { ...p0.node, id: 'n0' };
console.log('sideTags', JSON.stringify(node0.sideTags), 'outline spline stored', !!node0.outline?.spline);
const tmpl = part('t').extrude(sketch().polygon([[0, 0], [10, 0], [10, 10], [0, 10]]), { h: 10 }).fillet(b => b.edges().along('z').where(e => e.a[0] === 10 && e.a[1] === 10), { radius: 1 }).doc;
console.log('template fillet node', JSON.stringify(tmpl.nodes[2]));
const side = node0.sideTags.outer[3];
const mk = (sk: any, edges: string[]) => ({ ...tmpl, nodes: [sk, tmpl.nodes[1], { ...tmpl.nodes[2], edges }] });
const refs = [`n1.side[${side}]|n1.top`, `n1.top|n1.side[${side}]`];
let ref: string | null = null;
for (const r of refs) { const e = evaluateDoc(mk(node0, [r]) as any, 1); console.log('base eval', r, e.ok, e.ok ? '' : JSON.stringify((e as any).error)); if (e.ok && !ref) ref = r; }
if (!ref) process.exit(0);
const vol = (d: any) => part('x', d).mass({ density: 1 }).volume;
const noFillet = { ...tmpl, nodes: [node0, tmpl.nodes[1]] };
console.log('volume no fillet', vol(noFillet).toFixed(4), 'with fillet', vol(mk(node0, [ref])).toFixed(4));
const auto = splineAutoHandles(fit, true);
const edits: [string, any][] = [
  ['handle@1 +20', { fit, closed: true, handles: fit.map((_, i) => i === 1 ? auto[1] + 20 : null) }],
  ['handle@2 -25', { fit, closed: true, handles: fit.map((_, i) => i === 2 ? auto[2] - 25 : null) }],
  ['fit 2 moved', { fit: fit.map((p, i) => i === 2 ? [p[0] + 3, p[1] + 2] as P2 : p), closed: true }],
  ['handles straight', { fit, closed: true, handles: fit.map((_, i) => i === 1 || i === 2 ? Math.atan2(fit[2][1] - fit[1][1], fit[2][0] - fit[1][0]) * 180 / Math.PI : null) }],
];
for (const [label, def] of edits) {
  const back: any = sketchShapes(node0).shape;
  const err = splineEditError(def); if (err) { console.log(label, 'refused', err); continue; }
  const next = respline(back, def), r = settleShape(next, back), s: any = r.shape;
  const pr = profileOf([s]); if ('error' in pr) { console.log(label, 'profile err', pr.error); continue; }
  const node: any = { ...pr.node, id: 'n0' };
  const e = evaluateDoc(mk(node, [ref]) as any, 1);
  console.log(label, 'settleErr', r.error, 'spline kept', !!s.spline, 'sideTags same', JSON.stringify(node.sideTags) === JSON.stringify(node0.sideTags), 'eval', e.ok, e.ok ? `vol diff vs no-fillet ${(vol({ ...tmpl, nodes: [node, tmpl.nodes[1]] }) - vol(mk(node, [ref]))).toFixed(4)}` : JSON.stringify((e as any).error));
}
