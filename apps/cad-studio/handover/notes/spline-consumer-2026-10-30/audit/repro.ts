// Minimal reproductions found by snap.ts (seed 777).
import { splineOutline } from 'cadsrc/sketch/spline';
import { arcOf } from 'cadsrc/sketch/profile';
import { settleShape } from 'cadsrc/sketch/settle';
import { profileOf } from 'cadsrc/sketch/loops';
import { evaluateDoc } from 'cadsrc/engine/evaluate';
import { emptyDoc, withNode } from 'cadsrc/engine/doc';
type P2 = [number, number];
function tangent(pts: P2[], bul: number[], i: number, end: boolean): P2 {
  const n = pts.length, a = pts[i], b = pts[(i + 1) % n], bulge = bul[i] ?? 0;
  if (!bulge) { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; }
  const arc = arcOf(a, b, bulge), p = end ? b : a, sign = Math.sign(arc.sweep);
  return [-sign * (p[1] - arc.center[1]) / arc.radius, sign * (p[0] - arc.center[0]) / arc.radius];
}
const turns = (pts: P2[], bul: number[]) => pts.map((_, j) => { const n = pts.length, a = tangent(pts, bul, (j - 1 + n) % n, true), b = tangent(pts, bul, j, false); return Math.abs(Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1])); });
const run = (name: string, fit: P2[]) => {
  const o = splineOutline(fit, true), s: any = { kind: 'polygon', points: o.points, bulges: o.bulges, closed: true, fromSpline: true };
  const r = settleShape(s, { ...s, closed: false }), out: any = r.shape;
  const t0 = turns(o.points, o.bulges), t1 = turns(out.points, out.bulges);
  const fitNotBitwise = fit.filter(f => !out.points.some((q: P2) => q[0] === f[0] && q[1] === f[1]));
  let maxFitMove = 0; for (const f of fit) maxFitMove = Math.max(maxFitMove, Math.min(...out.points.map((q: P2) => Math.hypot(q[0] - f[0], q[1] - f[1]))));
  const pr = profileOf([out]); let ev = 'n/a';
  if ('node' in pr) { let d = withNode(emptyDoc(), pr.node as any); d = withNode(d, { kind: 'extrude', sketch: 0, height: 5 } as any); const e: any = evaluateDoc(d, 1); ev = e.ok ? 'ok' : e.error?.detail ?? e.error?.title; }
  console.log(name, JSON.stringify({ error: r.error, rawMaxTurn: Math.max(...t0), rawKinkAt: t0.findIndex(t => t === Math.max(...t0)), settledMaxTurn: Math.max(...t1), tangents: out.tangents?.length ?? 0, eq: out.equalRadii?.length ?? 0, co: out.concentric?.length ?? 0, fitNotBitwise: fitNotBitwise.length, of: fit.length, maxFitMove, evaluate: ev, straightSpans: o.bulges.filter((b, i) => !b).length }));
};
run('A (16 grid points, ~200 mm)', [[190, 5], [149, 90], [158, 175], [37, 163], [-30, 162], [-58, 138], [-153, 122], [-249, 92], [-227, -53], [-144, -67], [-86, -135], [-27, -135], [3, -258], [104, -225], [198, -155], [146, -57]]);
run('B (13 grid points, ~3 mm, hairpin)', [[3, 0], [2, 2], [2, 3], [0, 3], [-2, 3], [-3, 2], [-3, 0], [-3, -2], [-2, -2], [-1, -3], [0, -3], [3, -3], [2, 0]]);
run('B-min (4 grid points hairpin)', [[3, 0], [0, 3], [3, -3], [2, 0]]);
run('C (fuzz star-small-grid error)', [[2, 1], [1, 2], [-1, 1], [-2, 2], [-1, -1], [-1, -2], [1, -2], [1, -1]]);
run('D (12 grid points, ~2.5 m)', [[2145, 174], [1188, 1091], [1053, 2103], [-544, 1763], [-1490, 1812], [-1187, 676], [-2566, -833], [-2026, -1387], [-486, -1404], [129, -1451], [1013, -946], [2504, -603]]);
