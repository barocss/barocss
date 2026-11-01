import { splineHandleHit, draggedSpline } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/apps/cad-studio/src/viewport/splineHandles';
import { respline, splineEditError, splineShape, splineMatches, type SplineDef } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/spline';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/settle';
import { isSettled } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/rules';
type Poly = ReturnType<typeof splineShape>;
// A perspective-like projector: 4x4 multiply + divide (like camera.project of toWorld).
const M = [0.9, 0.1, 0.05, 0, -0.1, 0.95, 0.02, 0, 0.03, -0.02, 1, 0, 1, 2, -300, 1];
const P = (u: number, v: number) => { const x = u, y = v, z = 0; const cx = M[0] * x + M[4] * y + M[8] * z + M[12], cy = M[1] * x + M[5] * y + M[9] * z + M[13], cw = 1 + 0.001 * (M[2] * x + M[6] * y); return [400 + 4 * cx / cw, 300 - 4 * cy / cw] as const; };
const splineOf = (s: Poly) => s && s.kind === 'polygon' && isSettled(s) && s.spline && s.spline.fit.length >= 2 && splineMatches(s) ? s : null;
for (const n of [6, 40, 60]) {
  const fit = Array.from({ length: n }, (_, i) => [Math.round(100 * Math.cos(2 * Math.PI * i / n) * 100) / 100, Math.round(60 * Math.sin(2 * Math.PI * i / n) * 100) / 100] as [number, number]);
  const s = settleShape(splineShape({ fit, closed: true }), null).shape as Poly;
  if (!s.spline) { console.log('n', n, 'lost spline at close'); continue; }
  const time = (label: string, f: () => unknown, N: number) => { for (let i = 0; i < 200; i++) f(); const t = process.hrtime.bigint(); for (let i = 0; i < N; i++) f(); const us = Number(process.hrtime.bigint() - t) / 1e3 / N; console.log('n', String(n).padStart(2), label.padEnd(36), us.toFixed(2), 'us/call'); return us; };
  const N = 5000;
  const a = time('splineOf (isSettled+splineMatches)', () => splineOf(s), N);
  const b = time('splineHandleHit', () => splineHandleHit(s.spline!, P, 123, 45), N);
  time('hover total (splineOf + hit)', () => { const sp = splineOf(s); return sp ? splineHandleHit(sp.spline!, P, 123, 45) : null; }, N);
  time('drag move (dragged+editError+respline)', () => { const d = draggedSpline(s.spline!, { kind: 'fit', i: 1 }, [fit[1][0] + 3.3, fit[1][1] + 1.1]); return splineEditError(d) ?? respline(s, d); }, N);
  time('pointer-up settleShape(next, start)', () => settleShape(respline(s, draggedSpline(s.spline!, { kind: 'fit', i: 1 }, [fit[1][0] + 3.3, fit[1][1] + 1.1])), s), 50);
}
