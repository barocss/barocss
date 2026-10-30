import { ellipseShape, ellipseMatches } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/ellipse';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/settle';
import { profileOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/loops';
import { sketchShapes, reopenedOrder } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/reopen';
const e0 = settleShape(ellipseShape({ center: [0, 0], rx: 30, ry: 12, angle: 20 }), null).shape as any;
const e = { ...e0, ids: e0.points.map((_: any, i: number) => 'e' + (i + 10)) };
for (const [label, list] of [['ellipse first', [e, { kind: 'circle', c: [100, 0], r: 3, ids: ['c1'] }]], ['circle first', [{ kind: 'circle', c: [100, 0], r: 3, ids: ['c1'] }, e]], ['ellipse + inner circle', [e, { kind: 'circle', c: [0, 0], r: 3, ids: ['c1'] }]]] as const) {
  const p: any = profileOf(list as any); if (!('node' in p)) { console.log(label, p.error); continue; }
  console.log(label, 'node.profile', p.node.profile, 'outline.ellipse', !!p.node.outline?.ellipse, 'keys', Object.keys(p.node).join(','));
  const b = sketchShapes(JSON.parse(JSON.stringify({ ...p.node, id: 'n0' })));
  console.log('  reopen shape', b.shape?.kind, (b.shape as any)?.points?.length, 'ellipse', !!(b.shape as any)?.ellipse, 'done', b.done.map((s: any) => s.kind + ':' + !!s.ellipse).join(' '));
  const ord = reopenedOrder(b.shape, b.done, p.node.mainIds); const p2: any = profileOf(ord as any);
  console.log('  refinish sideTags same', JSON.stringify(p2.node.sideTags) === JSON.stringify(p.node.sideTags), 'ellipse', !!p2.node.outline?.ellipse, 'node same', JSON.stringify(p2.node) === JSON.stringify(p.node));
}
{
  const p: any = profileOf([{ kind: 'circle', c: [100, 0], r: 3, ids: ['c1'] }, e] as any);
  const b = sketchShapes(JSON.parse(JSON.stringify({ ...p.node, id: 'n0' })));
  const p2: any = profileOf(reopenedOrder(b.shape, b.done, p.node.mainIds) as any);
  let maxd = 0, cnt = 0; const walk = (a: any, c: any, path: string) => { if (typeof a === 'number') { const d = Math.abs(a - c); if (d > 0) { cnt++; maxd = Math.max(maxd, d); } return; } if (a && typeof a === 'object') for (const k of Object.keys(a)) walk(a[k], c?.[k], path + '.' + k); };
  walk(p.node, p2.node, ''); console.log('circle-first numeric diffs', cnt, 'max', maxd);
  // same with a plain 6-arc polygon (no ellipse) as region, to see if pre-existing
  const poly = { kind: 'polygon', closed: true, points: [[0, 0], [10, 0], [10, 10], [0, 10]], bulges: [0.3, 0, 0.2, 0], ids: ['p1', 'p2', 'p3', 'p4'] };
  const q: any = profileOf([{ kind: 'circle', c: [100, 0], r: 3, ids: ['c1'] }, poly] as any); const bq = sketchShapes(JSON.parse(JSON.stringify({ ...q.node, id: 'n0' })));
  const q2: any = profileOf(reopenedOrder(bq.shape, bq.done, q.node.mainIds) as any); console.log('baseline arc-polygon region node same', JSON.stringify(q2.node) === JSON.stringify(q.node));
}
