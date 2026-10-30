import { splineOutline } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/spline';
import { arcOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/profile';
type P2 = [number, number];
function outline(rx: number, ry: number, N: number) {
  const fit: P2[] = [], h: number[] = [];
  for (let k = 0; k < N; k++) { const t = 2 * Math.PI * k / N; fit.push([rx * Math.cos(t), ry * Math.sin(t)]); h.push(Math.atan2(ry * Math.cos(t), -rx * Math.sin(t)) * 180 / Math.PI); }
  return splineOutline(fit, true, h);
}
function dist(rx: number, ry: number, q: P2): number {
  let t = Math.atan2(q[1] / ry, q[0] / rx);
  for (let i = 0; i < 8; i++) {
    const x = rx * Math.cos(t), y = ry * Math.sin(t), dx = -rx * Math.sin(t), dy = ry * Math.cos(t), ddx = -x, ddy = -y;
    const f = (x - q[0]) * dx + (y - q[1]) * dy, fp = dx * dx + dy * dy + (x - q[0]) * ddx + (y - q[1]) * ddy;
    if (Math.abs(fp) < 1e-300) break; t -= f / fp;
  }
  return Math.hypot(rx * Math.cos(t) - q[0], ry * Math.sin(t) - q[1]);
}
function dev(rx: number, ry: number, N: number) {
  const o = outline(rx, ry, N), n = o.points.length; let m = 0, minR = Infinity;
  for (let i = 0; i < n; i++) {
    const a = o.points[i], b = o.points[(i + 1) % n], bu = o.bulges[i];
    if (!bu) { for (let s = 0; s <= 64; s++) m = Math.max(m, dist(rx, ry, [a[0] + (b[0] - a[0]) * s / 64, a[1] + (b[1] - a[1]) * s / 64])); continue; }
    const arc = arcOf(a, b, bu); minR = Math.min(minR, arc.radius);
    for (let s = 0; s <= 64; s++) { const t = arc.start + arc.sweep * s / 64; m = Math.max(m, dist(rx, ry, [arc.center[0] + arc.radius * Math.cos(t), arc.center[1] + arc.radius * Math.sin(t)])); }
  }
  return { m: m / rx, minR };
}
const ratios = [0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
console.log('N  ' + ratios.map(r => String(r).padStart(9)).join(''));
for (const N of [16, 24, 32, 48, 56, 64, 72, 80, 96]) { let w = 0; const row = ratios.map(r => { const d = dev(100, 100 * r, N).m; w = Math.max(w, d); return d.toExponential(1).padStart(9); }); console.log(String(N).padEnd(3) + row.join('') + '  max ' + w.toExponential(2)); }
