// Does settle (solver + D284 1e-6 snap) ever move a spline's points or worsen its joint turn? k<=16 so the solver runs.
import { splineOutline } from 'cadsrc/sketch/spline';
import { arcOf } from 'cadsrc/sketch/profile';
import { settleShape } from 'cadsrc/sketch/settle';
type P2 = [number, number];
let seed = Number(process.env.SEED ?? 777);
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
function tangent(pts: P2[], bul: number[], i: number, end: boolean): P2 {
  const n = pts.length, a = pts[i], b = pts[(i + 1) % n], bulge = bul[i] ?? 0;
  if (!bulge) { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; }
  const arc = arcOf(a, b, bulge), p = end ? b : a, sign = Math.sign(arc.sweep);
  return [-sign * (p[1] - arc.center[1]) / arc.radius, sign * (p[0] - arc.center[0]) / arc.radius];
}
const turn = (pts: P2[], bul: number[]) => { let w = 0; const n = pts.length; for (let j = 0; j < n; j++) { const a = tangent(pts, bul, (j - 1 + n) % n, true), b = tangent(pts, bul, j, false); w = Math.max(w, Math.abs(Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]))); } return w; };
const N = Number(process.env.N ?? 300);
let solved = 0, moved = 0, maxMove = 0, worse = 0, maxWorse = 0, maxRaw = 0, maxSet = 0, snappedJoints = 0, errors = 0;
const worst: unknown[] = [];
for (let it = 0; it < N; it++) {
  const k = 3 + Math.floor(rnd() * 14), R = [3, 20, 200, 2000][Math.floor(rnd() * 4)], onGrid = rnd() < 0.5;
  const fit: P2[] = [];
  for (let i = 0; i < k; i++) { const t = 2 * Math.PI * (i + rnd() * 0.6) / k, r = R * (0.65 + 0.7 * rnd()); let p: P2 = [r * Math.cos(t), r * Math.sin(t)]; if (onGrid) p = [Math.round(p[0]), Math.round(p[1])]; if (!fit.length || p[0] !== fit[fit.length - 1][0] || p[1] !== fit[fit.length - 1][1]) fit.push(p); }
  if (fit.length < 3) continue;
  const o = splineOutline(fit, true), s: any = { kind: 'polygon', points: o.points, bulges: o.bulges, closed: true, fromSpline: true };
  const r = settleShape(s, { ...s, closed: false }), out: any = r.shape;
  if (r.error) errors++;
  if (out.tangents?.length) solved++;
  let mv = 0; o.points.forEach((p, i) => { mv = Math.max(mv, Math.hypot(p[0] - out.points[i][0], p[1] - out.points[i][1])); });
  if (mv > 0) { moved++; maxMove = Math.max(maxMove, mv); const fitMoved = fit.filter(f => !out.points.some((q: P2) => q[0] === f[0] && q[1] === f[1])); console.log('MOVED', JSON.stringify({ fit, mv, fitMoved, tangents: out.tangents?.length, nPts: o.points.length })); }
  o.points.forEach((p, i) => { const q = out.points[i]; if ((p[0] !== q[0] || p[1] !== q[1]) && Math.round(q[0] * 1e6) / 1e6 === q[0] && Math.round(q[1] * 1e6) / 1e6 === q[1]) snappedJoints++; });
  const t0 = turn(o.points, o.bulges), t1 = turn(out.points, out.bulges);
  maxRaw = Math.max(maxRaw, t0); if (t0 > 1e-9) console.log('RAWKINK', JSON.stringify({ fit, t0, bulges: o.bulges, pts: o.points })); maxSet = Math.max(maxSet, t1);
  if (t1 > t0 * 1.5 + 1e-12) { worse++; maxWorse = Math.max(maxWorse, t1); if (worst.length < 2) worst.push({ fit, t0, t1, mv }); }
}
console.log(JSON.stringify({ N, errors, solvedWithTangents: solved, pointsMovedBySettle: moved, maxMove, snappedJoints, turnWorsened: worse, maxWorse, maxRawTurn: maxRaw, maxSettledTurn: maxSet, worst }));
