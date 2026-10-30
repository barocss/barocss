import { draggedSpline, splineHandleGeometry, splineHandleHit } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/apps/cad-studio/src/viewport/splineHandles';
import { respline, splineEditError, splineShape, splineMatches, type SplineDef } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/spline';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/settle';
import { isSettled } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/rules';
const log = (...a: unknown[]) => console.log(...a);
// 1. angle normalisation / rounding
const d0: SplineDef = { fit: [[0, 0], [20, 10], [40, 0]], closed: false, handles: [0, 90, null] };
for (const [p, sign, fine] of [[[-10, -0.07], 1, false], [[-10, 0.07], 1, false], [[-10, -0.0087], 1, true], [[10, 0.07], -1, false], [[10, -0.07], -1, false], [[10, -0.0087], -1, true], [[-10, 1e-15], 1, false]] as const) {
  const h = draggedSpline(d0, { kind: 'handle', i: 0, sign: sign as 1 | -1 }, p as [number, number], { fine }).handles![0];
  log('angle', JSON.stringify(p), 'sign', sign, 'fine', fine, '->', h, Object.is(h, -0) ? '(-0)' : '');
}
// fine rounding float artefacts
let bad = 0; for (let k = 0; k < 3600; k++) { const a = (k / 10 - 180 + 0.03) * Math.PI / 180; const h = draggedSpline(d0, { kind: 'handle', i: 0, sign: 1 }, [10 * Math.cos(a), 10 * Math.sin(a)], { fine: true }).handles![0] as number; if (Math.abs(h * 10 - Math.round(h * 10)) > 1e-9 || h <= -180 || h > 180) bad++; }
log('fine angles not on a 0.1 grid or out of (-180,180]:', bad, '/ 3600');
// 2. hit under rotated / flipped / zoomed projectors
const rot = (deg: number, s: number, flip: boolean) => { const c = Math.cos(deg * Math.PI / 180), si = Math.sin(deg * Math.PI / 180); return (u: number, v: number) => { const y = flip ? -v : v; return [400 + s * (c * u - si * y), 300 + s * (si * u + c * y)] as const; }; };
for (const [deg, s, flip] of [[0, 1, false], [37, 3, true], [180, 0.05, false], [90, 50, true]] as const) {
  const P = rot(deg, s, flip), g = splineHandleGeometry(d0, P);
  const len = g.map(k => Math.hypot(k.fwd[0] - k.c[0], k.fwd[1] - k.c[1]).toFixed(6));
  const hitF = g.map((k, i) => JSON.stringify(splineHandleHit(d0, P, k.fwd[0] + 3, k.fwd[1] - 3)));
  const hitC = g.map((k) => JSON.stringify(splineHandleHit(d0, P, k.c[0], k.c[1])));
  log('proj', deg, s, flip, 'len', len.join(','), '| fwd+3,-3 hits', hitF.join(' '), '| centre hits', hitC.join(' '));
}
// degenerate projector: plane seen edge-on (u maps to x, v collapses)
const edge = (u: number, v: number) => [400 + u, 300 + 0 * v] as const;
const dv: SplineDef = { fit: [[0, 0], [0, 10], [0, 20]], closed: false, handles: [90, 90, 90] };
log('edge-on geometry', JSON.stringify(splineHandleGeometry(dv, edge)[1]), 'hit at fit 1 centre ->', JSON.stringify(splineHandleHit(dv, edge, 400, 300)));
// NaN projector (behind the camera)
const nanP = (u: number, v: number) => [NaN, NaN] as const;
log('NaN projector hit', JSON.stringify(splineHandleHit(d0, nanP, 0, 0)));
// 3. fit snapping
log('fit step 0', JSON.stringify(draggedSpline(d0, { kind: 'fit', i: 1 }, [21.23456, 9.87654], { step: 0 }).fit[1]));
log('fit step 0.5', JSON.stringify(draggedSpline(d0, { kind: 'fit', i: 1 }, [21.3, 9.7], { step: 0.5 }).fit[1]));
log('fit step 0.5 fine', JSON.stringify(draggedSpline(d0, { kind: 'fit', i: 1 }, [21.3333, 9.7777], { step: 0.5, fine: true }).fit[1]));
log('fit step 0.3', JSON.stringify(draggedSpline(d0, { kind: 'fit', i: 1 }, [21.4, 9.7], { step: 0.3 }).fit[1]));
