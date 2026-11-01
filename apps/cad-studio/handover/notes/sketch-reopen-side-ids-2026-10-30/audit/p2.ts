import { finish, reopenFinish, reopen, compare, same } from './lib';
import { commitDimension } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/rules';
import { splineShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/spline';
const circle = { kind: 'circle', c: [5, 3], r: 1 }, big = { kind: 'circle', c: [5, 3], r: 8 };
const rect = (a: number[], b: number[], extra = {}) => ({ kind: 'rectangle', a, b, ...extra });
const poly = (points: number[][], extra = {}) => ({ kind: 'polygon', points, closed: true, bulges: points.map(() => 0), ...extra });
const slot = { kind: 'slot', a: [0, 0], b: [10, 0], r: 3 };
const cases: [string, any, any[]][] = [
  ['circle alone', circle, []],
  ['big circle + circle hole', circle, [big]],
  ['big circle + rect hole', rect([3, 1], [7, 5]), [big]],
  ['big circle + rect hole drawn UR', rect([7, 5], [3, 1]), [big]],
  ['circle main + construction rect after', rect([20, 20], [30, 26], { construction: true }), [circle]],
  ['circle main + construction rect UR after', rect([30, 26], [20, 20], { construction: true }), [circle]],
  ['circle main + construction rect around it', rect([0, 0], [10, 6], { construction: true }), [circle]],
  ['circle main + rect region', rect([20, 0], [30, 6]), [circle]],
  ['circle main + polygon region', poly([[20, 0], [30, 0], [25, 6]]), [circle]],
  ['slot alone', slot, []],
  ['slot + circle hole', { kind: 'circle', c: [5, 0], r: 1 }, [slot]],
  ['slot main + rect region', rect([20, 0], [30, 6]), [slot]],
  ['polygon + polygon hole', poly([[2, 2], [4, 2], [4, 4], [2, 4]]), [poly([[0, 0], [10, 0], [10, 8], [0, 8]])]],
  ['concave polygon (loop)', poly([[0, 0], [10, 0], [10, 8], [5, 4], [0, 8]]), []],
  ['polygon with attached circle', poly([[0, 0], [10, 0], [10, 8], [0, 8]], { circles: [{ c: [5, 4], r: 1 }], hv: { h: [0, 2], v: [1, 3] } }), []],
  ['polygon with attached circle + rect region', rect([20, 0], [30, 6]), [poly([[0, 0], [10, 0], [10, 8], [0, 8]], { circles: [{ c: [5, 4], r: 1 }], hv: { h: [0, 2], v: [1, 3] } })]],
  ['spline closed', splineShape({ fit: [[0, 0], [10, 0], [10, 8], [0, 8]], closed: true }), []],
  ['spline closed + rect hole', rect([4, 3], [6, 5]), [splineShape({ fit: [[0, 0], [10, 0], [10, 8], [0, 8]], closed: true })]],
  ['rect + bezier + construction rect + circle hole', circle, [rect([10, 6], [0, 0]), { kind: 'bezier', poles: [[0, 20], [10, 40], [20, 20]] }, rect([20, 20], [30, 26], { construction: true })]],
  ['two rects: second region drawn first', rect([0, 0], [10, 6]), [rect([30, 6], [20, 0])]],
];
for (const [label, shape, done] of cases) {
  const n1 = finish(shape, done, false); let n = n1; for (let i = 0; i < 2; i++) n = reopenFinish(n);
  compare(label, n1, n);
}
// Width edit on reopen: the outline's side 0 (bottom) length to 14; tags must still mean the same sides (by direction from centre).
const dirs = (node: any) => { const { loopOf } = require0; return null; };
for (const [lab, a, b] of [['LL', [0, 0], [10, 6]], ['UR', [10, 6], [0, 0]], ['LR', [10, 0], [0, 6]]] as const) {
  const n1 = finish({ kind: 'circle', c: [5, 3], r: 1 }, [rect(a as any, b as any)], false), { s } = reopen(n1);
  for (const key of ['len0', 'len1']) {
    const r: any = commitDimension(s.shape, key, 14);
    if (!r.ok) { console.log('dim', lab, key, 'refused', r.reason); continue; }
    const n2 = finish(r.shape, s.done, true);
    const side = (node: any, t: string) => { const i = node.sideTags.outer.indexOf(t); const P = [[node.min[0], node.min[1]], [node.max[0], node.min[1]], [node.max[0], node.max[1]], [node.min[0], node.max[1]]]; const p = P[i], q = P[(i + 1) % 4]; return p[1] === q[1] ? (p[1] === node.min[1] ? 'bottom' : 'top') : (p[0] === node.min[0] ? 'left' : 'right'); };
    console.log('dim', lab, key, '-> profile', n2.profile, n2.min, n2.max, 'tags', JSON.stringify(n2.sideTags), 'sides keep their tags', n1.sideTags.outer.every((t: string) => side(n1, t) === side(n2, t)));
  }
}
const require0 = {};
