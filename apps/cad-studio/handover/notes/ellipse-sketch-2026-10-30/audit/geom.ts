// Independent geometry probe: own arc math, own ellipse distance (Eberly bisection), own NURBS (Cox-de Boor basis).
import { ellipseOutline, ellipseError, ELLIPSE_POINTS } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/ellipse';
import { ellipseCurve } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/curveSource';
import { xyPlane } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/plane';
type P2 = [number, number];
type D = { center: P2; rx: number; ry: number; angle: number };
// Own arc from bulge (DXF: bulge = tan(sweep/4), positive anticlockwise).
function arc(a: P2, b: P2, bu: number) {
  const sweep = 4 * Math.atan(bu), cx = b[0] - a[0], cy = b[1] - a[1], L = Math.hypot(cx, cy);
  const r = L / (2 * Math.sin(Math.abs(sweep) / 2));
  // centre: from midpoint along left normal by r*cos(sweep/2) signed
  const h = (L / 2) / Math.tan(sweep / 2), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const c: P2 = [mx - cy / L * h, my + cx / L * h];
  return { c, r, s0: Math.atan2(a[1] - c[1], a[0] - c[0]), sweep };
}
// Distance from a point to ellipse x²/e0²+y²/e1²=1 (Eberly robust bisection).
function distEllipse(e0: number, e1: number, x: number, y: number): number {
  let swap = false; if (e1 > e0) { [e0, e1] = [e1, e0]; [x, y] = [y, x]; swap = true; }
  const y0 = Math.abs(x), y1 = Math.abs(y);
  const z0 = y0 / e0, z1 = y1 / e1, g = z0 * z0 + z1 * z1 - 1;
  if (y1 === 0 && y0 === 0) return e1;
  const r0 = (e0 / e1) ** 2;
  let lo = z1 - 1, hi = g < 0 ? 0 : Math.hypot(r0 * z0, z1) - 1, s = 0;
  if (y0 === 0) return Math.abs(y1 - e1); if (y1 === 0) { if (y0 >= e0 - e1 * e1 / e0) return Math.abs(y0 - e0); }
  for (let i = 0; i < 200; i++) { s = (lo + hi) / 2; const n0 = r0 * z0 / (s + r0), n1 = z1 / (s + 1), gg = n0 * n0 + n1 * n1 - 1; if (gg > 0) lo = s; else hi = s; }
  const x0 = r0 * y0 / (s + r0), x1 = y1 / (s + 1);
  return Math.hypot(x0 - y0, x1 - y1);
}
const local = (d: D, p: P2): P2 => { const a = -d.angle * Math.PI / 180, x = p[0] - d.center[0], y = p[1] - d.center[1]; return [Math.cos(a) * x - Math.sin(a) * y, Math.sin(a) * x + Math.cos(a) * y]; };
function check(d: D) {
  const o = ellipseOutline(d), n = o.points.length; let dev = 0, kink = 0, area = 0, fitOn = 0;
  const ring: P2[] = [];
  for (let i = 0; i < n; i++) {
    const a = o.points[i], b = o.points[(i + 1) % n], bu = o.bulges[i];
    if (i % 2 === 0) { const q = local(d, a); fitOn = Math.max(fitOn, Math.abs((q[0] / d.rx) ** 2 + (q[1] / d.ry) ** 2 - 1)); }
    area += (a[0] * b[1] - b[0] * a[1]) / 2;
    if (!bu) { for (let k = 0; k < 64; k++) { const p: P2 = [a[0] + (b[0] - a[0]) * k / 64, a[1] + (b[1] - a[1]) * k / 64]; const q = local(d, p); dev = Math.max(dev, distEllipse(d.rx, d.ry, q[0], q[1])); if (k % 16 === 0) ring.push(p); } continue; }
    const A = arc(a, b, bu); area += A.r * A.r / 2 * (A.sweep - Math.sin(A.sweep));
    const endErr = Math.hypot(A.c[0] + A.r * Math.cos(A.s0 + A.sweep) - b[0], A.c[1] + A.r * Math.sin(A.s0 + A.sweep) - b[1]);
    if (endErr > 1e-9 * Math.max(1, d.rx, d.ry)) throw new Error('arc end ' + endErr);
    for (let k = 0; k < 64; k++) { const t = A.s0 + A.sweep * k / 64, p: P2 = [A.c[0] + A.r * Math.cos(t), A.c[1] + A.r * Math.sin(t)], q = local(d, p); dev = Math.max(dev, distEllipse(d.rx, d.ry, q[0], q[1])); if (k % 16 === 0) ring.push(p); }
  }
  // tangent continuity: outgoing direction of segment i at its end vs segment i+1 at start
  const dir = (i: number, end: boolean): number => { const a = o.points[i], b = o.points[(i + 1) % n], bu = o.bulges[i]; const ch = Math.atan2(b[1] - a[1], b[0] - a[0]), half = 2 * Math.atan(bu); return end ? ch + half : ch - half; };
  for (let i = 0; i < n; i++) { let x = dir((i + 1) % n, false) - dir(i, true); x = Math.atan2(Math.sin(x), Math.cos(x)); kink = Math.max(kink, Math.abs(x)); }
  // simplicity: sampled ring has no crossing (bbox grid, check against non-adjacent)
  let cross = 0; const m = ring.length;
  const seg = (i: number): [P2, P2] => [ring[i], ring[(i + 1) % m]];
  const X = (p: P2, q: P2, r: P2, s: P2) => { const o1 = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]), o2 = (q[0] - p[0]) * (s[1] - p[1]) - (q[1] - p[1]) * (s[0] - p[0]), o3 = (s[0] - r[0]) * (p[1] - r[1]) - (s[1] - r[1]) * (p[0] - r[0]), o4 = (s[0] - r[0]) * (q[1] - r[1]) - (s[1] - r[1]) * (q[0] - r[0]); return o1 * o2 < 0 && o3 * o4 < 0; };
  for (let i = 0; i < m; i += 1) for (let j = i + 2; j < m; j += 1) { if (i === 0 && j === m - 1) continue; const [p, q] = seg(i), [r, s] = seg(j); if (Math.max(p[0], q[0]) < Math.min(r[0], s[0]) || Math.max(r[0], s[0]) < Math.min(p[0], q[0])) continue; if (X(p, q, r, s)) cross++; }
  return { n, rel: dev / Math.max(d.rx, d.ry), kink, areaRel: area / (Math.PI * d.rx * d.ry) - 1, fitOn, cross };
}
// NURBS: Cox-de Boor basis
function basis(i: number, p: number, U: number[], t: number): number {
  if (p === 0) { const last = U[U.length - 1]; return (U[i] <= t && t < U[i + 1]) || (t === last && U[i] < t && U[i + 1] === last) ? 1 : 0; }
  let v = 0; const a = U[i + p] - U[i], b = U[i + p + 1] - U[i + 1];
  if (a > 0) v += (t - U[i]) / a * basis(i, p - 1, U, t); if (b > 0) v += (U[i + p + 1] - t) / b * basis(i + 1, p - 1, U, t); return v;
}
function nurbs(c: any, t: number): number[] { let w = 0; const s = [0, 0, 0]; for (let i = 0; i < c.points.length; i++) { const B = basis(i, c.degree, c.knots, t) * c.weights[i]; w += B; for (let k = 0; k < 3; k++) s[k] += B * c.points[i][k]; } return s.map(v => v / w); }
function checkCurve(d: D) {
  const c = ellipseCurve(xyPlane(), d), U = c.knots, t0 = U[0], t1 = U[U.length - 1]; let worst = 0, area = 0, prev: number[] | null = null, first: number[] | null = null, maxStep = 0;
  for (let k = 0; k <= 4000; k++) { const t = t0 + (t1 - t0) * k / 4000, q = nurbs(c, t), l = local(d, [q[0], q[1]]); worst = Math.max(worst, Math.abs((l[0] / d.rx) ** 2 + (l[1] / d.ry) ** 2 - 1)); if (prev) { area += (prev[0] * q[1] - q[0] * prev[1]) / 2; maxStep = Math.max(maxStep, Math.hypot(q[0] - prev[0], q[1] - prev[1])); } else first = q; prev = q; }
  const closeGap = Math.hypot(prev![0] - first![0], prev![1] - first![1]);
  return { degree: c.degree, poles: c.points.length, knots: JSON.stringify(c.knots), implicit: worst, areaRel: area / (Math.PI * d.rx * d.ry) - 1, closeGap, maxStep };
}
const out: string[] = []; let worstRel = 0, worstArg = '';
for (const L of [0.06, 1, 13, 100, 2500]) for (const ratio of [0.2, 0.2000001, 0.21, 0.3, 0.45, 0.6, 0.8, 0.95, 1]) for (const angle of [0, 7.5, 30, 45, 90, 123, -60, 400]) for (const flip of [0, 1]) for (const C of [[0, 0], [-4000, 3500]] as P2[]) {
  const d: D = { center: C, rx: flip ? L * ratio : L, ry: flip ? L : L * ratio, angle };
  if (ellipseError(d)) continue;
  const r = check(d);
  if (r.rel > worstRel) { worstRel = r.rel; worstArg = JSON.stringify(d); }
  if (r.n !== 2 * ELLIPSE_POINTS || r.rel > 1e-5 || r.kink > 1e-9 || Math.abs(r.areaRel) > 1e-5 || r.fitOn > 1e-9 || r.cross) out.push('FAIL ' + JSON.stringify(d) + ' ' + JSON.stringify(r));
}
console.log('worst deviation/long axis', worstRel, worstArg);
console.log('outline failures', out.length); out.slice(0, 10).forEach(l => console.log(l));
const sample = [{ center: [0, 0], rx: 50, ry: 10, angle: 0 }, { center: [0, 0], rx: 50, ry: 10, angle: 33 }, { center: [-4000, 3500], rx: 1000, ry: 900, angle: -60 }, { center: [0, 0], rx: 0.3, ry: 1.2, angle: 400 }] as D[];
for (const d of sample) console.log('outline', JSON.stringify(d), JSON.stringify(check(d)));
for (const d of sample) console.log('curve', JSON.stringify(d), JSON.stringify(checkCurve(d)));
// orientation of outline (signed area sign) vs curve
