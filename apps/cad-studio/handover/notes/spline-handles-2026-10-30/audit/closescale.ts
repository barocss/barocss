// Closing a star-shaped spline (as Viewport does: settle against the open shape) at scales 1..5000 mm and offsets:
// does the definition survive the closing solve? (A drop here silently removes the SPLINE section.)
import { splineShape, splineMatches, splineOutline } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/spline';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/settle';
type P2 = [number, number];
let seed = Number(process.argv[2] ?? 5);
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const st: Record<string, number> = {}; const inc = (k: string) => st[k] = (st[k] ?? 0) + 1; let shown = 0;
for (let it = 0; it < Number(process.argv[3] ?? 400); it++) {
  const scale = [1, 10, 100, 1000, 4000][it % 5], off = rnd() < 0.3 ? Math.round(rnd() * 4000) : 0, n = 3 + Math.floor(rnd() * 14);
  const angs = Array.from({ length: n }, () => rnd() * 2 * Math.PI).sort((a, b) => a - b);
  const fit: P2[] = angs.map(a => { const r = scale * (0.4 + 0.6 * rnd()); return [Math.round((off + r * Math.cos(a)) * 1000) / 1000, Math.round(r * Math.sin(a) * 1000) / 1000] as P2; });
  const first = splineShape({ fit, closed: true }), r = settleShape(first, { ...first, closed: false }), s: any = r.shape;
  const key = `s${scale}${off ? '+off' : ''}`;
  if (r.error) { inc(key + ' closeError'); continue; }
  if (s.spline) inc(key + ' kept'); else {
    inc(key + ' DROPPED');
    const o = splineOutline(fit, true); let p = 0, q = 0; s.points.forEach((x: P2, i: number) => { p = Math.max(p, Math.hypot(x[0] - o.points[i][0], x[1] - o.points[i][1])); q = Math.max(q, Math.abs(s.bulges[i] - o.bulges[i])); });
    if (shown++ < 4) console.log('dropped', key, 'n', n, 'max move', p.toExponential(2), 'max bulge diff', q.toExponential(2), 'size', Math.max(100, ...fit.map(f => Math.max(Math.abs(f[0]), Math.abs(f[1])))));
  }
}
console.log(JSON.stringify(st));
