// Reversal of a non-symmetric B-spline edge (chain reversal and B orientation reversal), checked by my de Boor.
import { bandSurface } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad/src/features/band-surface';
import { cEval, sEval, cNear, dst, type C } from './geo';
const bs: C = { degree: 3, knots: [0, 0, 0, 0, 0.3, 0.55, 1, 1, 1, 1], controlPoints: [[0, 0, 0], [3, 4, 1], [6, -2, 0], [9, 3, 2], [12, 0, 1], [15, 1, 0]], weights: [1, 0.7, 1.4, 0.9, 1.2, 1] };
const line = (a: number[], b: number[]): C => ({ degree: 1, knots: [0, 0, 1, 1], controlPoints: [a, b], weights: [1, 1] });
const first = (c: C) => cEval(c, c.knots[0]), last = (c: C) => cEval(c, c.knots.at(-1)!);
function side(curves: C[], tag: string) {
  const vs: { id: string; point: number[] }[] = [];
  const vid = (p: number[]) => { const v = vs.find(x => dst(x.point, p) < 1e-9); if (v) return v.id; const id = `${tag}v${vs.length}`; vs.push({ id, point: p }); return id; };
  const edges = curves.map((c, i) => ({ id: `${tag}e${i}`, name: `${tag}.e${i}`, tolerance: 1e-7, vertices: [vid(first(c)), vid(last(c))], curve: { kind: 'curve', id: `${tag}c${i}`, ...c } }));
  return { brep: { faces: [], vertices: vs, edges } as never, names: edges.map(e => e.name), body: tag };
}
let worst = 0;
const check = (label: string, A: C[], B: C[]) => {
  const r = bandSurface({ id: 'bd', a: side(A, 'A'), b: side(B, 'B') });
  let on = 0;
  for (const f of r.brep.faces) for (let i = 0; i <= 40; i++) { const u = i / 40; on = Math.max(on, Math.min(...A.map(c => cNear(c, sEval(f.surface as never, u, 0)).d)), Math.min(...B.map(c => cNear(c, sEval(f.surface as never, u, 1)).d))); }
  console.log(label, 'off source', on.toExponential(2), 'reported dev', r.report.boundaryDeviation.toExponential(2)); worst = Math.max(worst, on);
};
// chain: line then the B-spline stored backward (chainOf reverses it)
check('chain reverses bspline', [line([-5, 0, 0], [15, 1, 0]), bs], [line([-5, 0, 10], [15, 0, 10])].concat([]));
// B-orientation reversal: B is the bspline lifted, stored against A's direction
const lifted: C = { ...bs, controlPoints: bs.controlPoints.map(p => [p[0], p[1], p[2] + 10]) };
check('B reversed bspline', [line([15, 0, 0], [0, 0, 0])], [lifted]);
if (worst > 1e-9) { console.log('FAIL boundary off source'); process.exit(1); }
