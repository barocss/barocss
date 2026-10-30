// What does settleShape change on a spline that closes? (joint movement, snapping, bulges)
import { splineOutline } from 'cadsrc/sketch/spline';
import { settleShape } from 'cadsrc/sketch/settle';
type P2 = [number, number];
const fits: P2[][] = [
  [[0, 0], [30, 5], [40, 30], [10, 40], [-10, 20]],
  [[0, 0], [10, 0], [10, 10], [0, 10]],
  Array.from({ length: 12 }, (_, i) => { const t = 2 * Math.PI * i / 12; return [Math.round(40 * Math.cos(t) + 7 * Math.cos(3 * t)), Math.round(25 * Math.sin(t))] as P2; }),
  [[0.123456789, 0.987654321], [30.111111111, 5.333333333], [40.7, 30.2], [10.05, 40.01], [-10.3, 20.9]],
  [[9000, 9000], [9600, 9100], [9800, 9700], [9100, 9900], [8900, 9500]],
];
const onGrid = (v: number) => Math.round(v * 1e6) / 1e6 === v;
for (const fit of fits) {
  const o = splineOutline(fit, true); const s: any = { kind: 'polygon', points: o.points, bulges: o.bulges, closed: true, fromSpline: true };
  const r: any = settleShape(s, { ...s, closed: false }).shape;
  let maxMove = 0, jointsOnGridBefore = 0, jointsOnGridAfter = 0, joints = 0, maxBul = 0;
  o.points.forEach((p, i) => {
    const q = r.points[i]; maxMove = Math.max(maxMove, Math.hypot(p[0] - q[0], p[1] - q[1]));
    const isFit = fit.some(f => f[0] === p[0] && f[1] === p[1]);
    if (!isFit) { joints++; if (onGrid(p[0]) && onGrid(p[1])) jointsOnGridBefore++; if (onGrid(q[0]) && onGrid(q[1])) jointsOnGridAfter++; }
    maxBul = Math.max(maxBul, Math.abs(o.bulges[i] - r.bulges[i]));
  });
  console.log(JSON.stringify({ fit0: fit[0], n: o.points.length, tangents: r.tangents?.length, maxPointMove: maxMove, maxBulgeDelta: maxBul, joints, jointsOnGridBefore, jointsOnGridAfter }));
}
