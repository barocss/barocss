import test from 'node:test';
import assert from 'node:assert/strict';
import { splineOutline } from '../src/sketch/spline';
import { arcOf } from '../src/sketch/profile';

type P2 = [number, number];
/** The outline's tangent leaving and arriving at each point (arcs by their bulge, lines by their direction). */
function tangents(o: { points: P2[]; bulges: number[] }, closed: boolean) {
  const n = o.points.length, segs = closed ? n : n - 1, out: { leave: number; arrive: number }[] = [];
  for (let i = 0; i < segs; i++) {
    const a = o.points[i], b = o.points[(i + 1) % n], chord = Math.atan2(b[1] - a[1], b[0] - a[0]), half = 2 * Math.atan(o.bulges[i]);
    out.push({ leave: chord - half, arrive: chord + half });
  }
  return out;
}
const sameAngle = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 1e-6;

test('a spline through points is tangent arcs: through every point, smooth at every joint, round a closed loop too', () => {
  const pts: P2[] = [[0, 0], [10, 8], [20, 0], [30, 6]];
  const o = splineOutline(pts, false);
  for (const p of pts) assert.ok(o.points.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-9), `through ${p}`);
  const t = tangents(o, false);
  for (let i = 1; i < t.length; i++) assert.ok(sameAngle(t[i - 1].arrive, t[i].leave), `smooth at joint ${i}`);
  // Each piece is a real arc (or a line) with a finite radius.
  o.bulges.forEach((b, i) => { if (b && i + 1 < o.points.length) assert.ok(Number.isFinite(arcOf(o.points[i], o.points[i + 1], b).radius)); });
  const sq: P2[] = [[0, 0], [10, 0], [10, 10], [0, 10]], c = splineOutline(sq, true), tc = tangents(c, true);
  for (let i = 0; i < tc.length; i++) assert.ok(sameAngle(tc[i].arrive, tc[(i + 1) % tc.length].leave), `closed, smooth at ${i}`);
  // Three points in a row: straight halves, no arcs (two pieces per span since D352).
  assert.deepEqual(splineOutline([[0, 0], [5, 0], [10, 0]], false).bulges, [0, 0, 0, 0, 0]);
});
