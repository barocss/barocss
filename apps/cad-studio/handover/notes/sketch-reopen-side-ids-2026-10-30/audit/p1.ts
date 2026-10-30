import { finish, reopenFinish, compare } from './lib';
const corners: [string, [number, number], [number, number]][] = [['LL', [0, 0], [10, 6]], ['LR', [10, 0], [0, 6]], ['UR', [10, 6], [0, 0]], ['UL', [0, 6], [10, 0]]];
const circle = { kind: 'circle', c: [5, 3], r: 1 }, bez = { kind: 'bezier', poles: [[0, 20], [10, 40], [20, 20]] }, cons = { kind: 'polygon', points: [[0, 30], [5, 30]], closed: false, construction: true };
const consRect = { kind: 'rectangle', a: [20, 20], b: [30, 26], construction: true };
const innerRect = { kind: 'rectangle', a: [2, 2], b: [4, 4] };
for (const [c, a, b] of corners) {
  const R = { kind: 'rectangle', a, b };
  const variants: [string, any, any[]][] = [
    ['alone', R, []], ['+circle hole after', circle, [R]], ['circle first, rect last', R, [circle]],
    ['bezier before', R, [bez]], ['bezier after', bez, [R]], ['bezier between rect & hole', circle, [R, bez]],
    ['construction before', R, [cons]], ['construction after', cons, [R]],
    ['rect hole after', innerRect, [R]], ['construction rect after', consRect, [R]], ['construction rect before', R, [consRect]],
    ['second rect region', { kind: 'rectangle', a: [20, 0], b: [30, 6] }, [R]],
  ];
  for (const [v, shape, done] of variants) {
    const n1 = finish(shape, done, false); let n = n1; for (let i = 0; i < 3; i++) n = reopenFinish(n);
    compare(`${c} ${v} (x3)`, n1, n);
  }
}
