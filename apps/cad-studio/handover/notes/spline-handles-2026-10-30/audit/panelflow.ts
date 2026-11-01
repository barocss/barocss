// The Studio panel flow: closed spline closed+settled (prev open), then each SPLINE-section edit goes
// respline -> App.updateShape -> settleShape(next, prev). Does the edited shape keep its definition?
import { splineShape, respline, splineEditError, splineMatches, splineAutoHandles, splineOutline, type SplineDef } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/spline';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/settle';
type P2 = [number, number];
let seed = Number(process.argv[2] ?? 11);
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const formula = (k: number): P2[] => Array.from({ length: k }, (_, i) => { const t = 2 * Math.PI * i / k; return [Math.round((40 * Math.cos(t) + 7 * Math.cos(3 * t)) * 1e6) / 1e6, Math.round(25 * Math.sin(t) * 1e6) / 1e6]; });
const st: Record<string, number> = {}; const inc = (k: string) => st[k] = (st[k] ?? 0) + 1; let shown = 0;
function bdiff(a: any, b: { points: P2[]; bulges: number[] }) { let p = 0, q = 0; a.points.forEach((x: P2, i: number) => { p = Math.max(p, Math.hypot(x[0] - b.points[i][0], x[1] - b.points[i][1])); q = Math.max(q, Math.abs(a.bulges[i] - b.bulges[i])); }); return [p, q]; }
for (let it = 0; it < Number(process.argv[3] ?? 300); it++) {
  const k = 4 + Math.floor(rnd() * 10), fit = formula(k), first = splineShape({ fit, closed: true });
  const s0: any = settleShape(first, { ...first, closed: false }).shape;
  if (!s0.spline) { inc('closing dropped'); continue; }
  const auto = splineAutoHandles(fit, true), kind = rnd();
  let def: SplineDef;
  if (kind < 0.5) { const i = Math.floor(rnd() * k); def = { fit, closed: true, handles: fit.map((_, j) => j === i ? Math.round(auto[i] + rnd() * 40 - 20) : null) }; }
  else { const i = Math.floor(rnd() * k); def = { fit: fit.map((p, j) => j === i ? [p[0] + Math.round(rnd() * 6 - 3), p[1] + Math.round(rnd() * 6 - 3)] as P2 : p), closed: true }; }
  const label = kind < 0.5 ? 'handle' : 'fit';
  if (splineEditError(def)) { inc(label + ' refused'); continue; }
  const next = respline(s0, def), r = settleShape(next, s0), s: any = r.shape;
  if (r.error) { inc(label + ' settle error'); console.log('settle error', label, k, JSON.stringify(def), r.error, 'kept?', !!(r.shape as any)?.spline, 'same as prev?', JSON.stringify((r.shape as any).points) === JSON.stringify(s0.points)); continue; }
  if (s.spline) inc(label + ' kept'); else { inc(label + ' DROPPED'); if (shown++ < 3) { const [p, q] = bdiff(s, splineOutline(def.fit, true, def.handles) as any); console.log('dropped', label, 'k', k, JSON.stringify(def.handles ?? null), 'point move', p.toExponential(2), 'bulge diff', q.toExponential(2)); } }
}
console.log(JSON.stringify(st));
