// A dimension added at its measured value (what the Dimension tool proposes): does the spline stay, and does a later
// handle edit silently delete that dimension?
import { splineShape, respline, splineAutoHandles, splineMatches } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/spline';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/settle';
import { commitDimension, dimensionValue } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/rules';
import { outlineOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/loops';
import { arcOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/profile';
type P2 = [number, number];
const formula = (k: number): P2[] => Array.from({ length: k }, (_, i) => { const t = 2 * Math.PI * i / k; return [Math.round((40 * Math.cos(t) + 7 * Math.cos(3 * t)) * 1e6) / 1e6, Math.round(25 * Math.sin(t) * 1e6) / 1e6]; });
const fit = formula(6), first = splineShape({ fit, closed: true }), s: any = settleShape(first, { ...first, closed: false }).shape;
for (const key of ['rad0', 'len0', 'dist0_4']) {
  let v = dimensionValue(s, key); if (v == null) { console.log(key, 'no value'); continue; }
  const c = commitDimension(s, key, v);
  if (!c.ok) { console.log(key, 'commit refused', JSON.stringify(c)); continue; }
  const d: any = settleShape(c.shape, s).shape;
  const o = outlineOf(d);
  console.log(key, '=', v.toFixed(4), '-> spline kept', !!d.spline, '| stored outline has spline', !!o?.spline, 'radii', JSON.stringify(o?.radii ?? null), 'lengths', JSON.stringify(o?.lengths ?? null), 'rules', (o?.rules ?? []).length);
  if (d.spline) {
    const e: any = settleShape(respline(d, { fit, closed: true, handles: fit.map((_, i) => i === 1 ? splineAutoHandles(fit, true)[1] + 15 : null) }), d).shape;
    console.log('   after a handle edit: radii', JSON.stringify(e.radii ?? null), 'lengths', JSON.stringify(e.lengths ?? null), 'rules', (e.rules ?? []).length, 'spline', !!e.spline);
  }
}
