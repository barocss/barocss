// Scope probes: (a) open spline continued and closed by the Line tool (Viewport line 1232-1237 builds a fresh
// polygon without fromSpline); (b) roundCorner / splitAt drop the flag; (c) non-spline outline still infers.
import { splineOutline } from 'cadsrc/sketch/spline';
import { settleShape } from 'cadsrc/sketch/settle';
import { roundCorner } from 'cadsrc/sketch/corner';
import { splitAt } from 'cadsrc/sketch/trim';
type P2 = [number, number];
const fit: P2[] = Array.from({ length: 12 }, (_, i) => { const t = 2 * Math.PI * i / 12; return [Math.round(40 * Math.cos(t) + 7 * Math.cos(3 * t)), Math.round(25 * Math.sin(t))] as P2; });
// (a) the open spline through all but the last fit point, then a Line click at the last fit point, then a click on point 0 closes.
const open = splineOutline(fit.slice(0, 11), false); // ends at fit[10]
const pts = [...open.points, fit[11]], bulges = [...open.bulges.slice(0, -1), 0, 0];
const closedByLine: any = { kind: 'polygon', points: pts, closed: true, bulges, pending: false };
const prevOpen: any = { kind: 'polygon', points: pts, closed: false, bulges, pending: false };
const r = settleShape(closedByLine, prevOpen); const s: any = r.shape;
let moved = 0; for (const p of fit) { const d = Math.min(...s.points.map((q: P2) => Math.hypot(q[0] - p[0], q[1] - p[1]))); moved = Math.max(moved, d); }
console.log('(a) spline continued by Line and closed:', JSON.stringify({ error: r.error, equalRadii: s.equalRadii?.length ?? 0, concentric: s.concentric?.length ?? 0, tangents: s.tangents?.length ?? 0, maxFitPointMove: moved }));
// (b) flag dropped on roundCorner / splitAt (point insert)
const cl = splineOutline([[0, 0], [40, 0], [40, 30], [0, 30]] as P2[], true);
const sp: any = settleShape({ kind: 'polygon', points: cl.points, bulges: cl.bulges, closed: true, fromSpline: true } as any, null).shape;
const rc: any = roundCorner(sp, 0, 1);
console.log('(b) roundCorner:', 'error' in rc ? rc.error : JSON.stringify({ fromSpline: rc.shape.fromSpline ?? null }));
const sa: any = splitAt([sp], [cl.points[0][0] + 0, cl.points[0][1]], 1);
const mid = (() => { const a = sp.points[0], b = sp.points[1]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as P2; })();
const sb: any = splitAt([sp], mid, 5);
console.log('(b) splitAt:', JSON.stringify('error' in sb ? sb : { fromSpline: sb.shapes[0].fromSpline ?? null, n: sb.shapes[0].points.length, was: sp.points.length }), 'inputHasFlag', sp.fromSpline ?? null);
// (c) a hand-drawn outline with near-equal arcs still infers
const hand: any = { kind: 'polygon', points: [[0, 0], [20, 0], [20, 10], [0, 10]], bulges: [0.5, 0, 0.51, 0], closed: true };
const h: any = settleShape(hand, { ...hand, closed: false }).shape;
console.log('(c) hand outline:', JSON.stringify({ equalRadii: h.equalRadii, concentric: h.concentric }));
// (d) the same hand outline with fromSpline set: no arc relations
const hs: any = settleShape({ ...hand, fromSpline: true }, { ...hand, closed: false }).shape;
console.log('(d) hand outline flagged:', JSON.stringify({ equalRadii: hs.equalRadii ?? [], concentric: hs.concentric ?? [] }));
// (e) a later edit of a settled spline with prev settled never re-infers (move fit point 1 by 1 mm)
const s12: any = settleShape({ kind: 'polygon', ...(() => { const o = splineOutline(fit, true); return { points: o.points, bulges: o.bulges }; })(), closed: true } as any, null).shape;
const moved1 = { ...s12, points: s12.points.map((p: P2, i: number) => i === 2 ? [p[0] + 1, p[1]] : p) };
const e: any = settleShape(moved1, s12);
console.log('(e) edit after close, flag absent, prev settled:', JSON.stringify({ error: e.error, eq: e.shape?.equalRadii?.length ?? 0, eqBefore: s12.equalRadii?.length ?? 0 }));
