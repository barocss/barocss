// Explicit sketch constraints and point-to-point dimensions as the kernel's numerical solver terms.
// Edges and points are an outline's segment and point indices (see profile.ts); horizontal and vertical
// edges are kept in the outline's own `hv` lists, so they are not rules.
import type { solveXYNumericalSketch } from '@barocss/cad';

type P2 = [number, number];
type Doc = Parameters<typeof solveXYNumericalSketch>[0];
export type KernelConstraint = Doc['constraints'][number];
export type KernelSegment = Doc['segments'][number];
export type KernelPoint = Doc['points'][number];

export type SketchRule =
  /** Two straight edges at 0° / 180° (parallel) or ±90° (perpendicular), whichever is nearest the drawing. */
  | { kind: 'parallel' | 'perpendicular'; a: number; b: number }
  /** Two straight edges of the same length. */
  | { kind: 'equal'; a: number; b: number }
  /** A point held where it is. */
  | { kind: 'fix'; point: number; at: P2 }
  /** A point on the centre of an arc (segment `arc`). */
  | { kind: 'coincident'; point: number; arc: number }
  /** A driving distance between two points: straight, or along the sketch's X (`dx`) or Y (`dy`) axis. */
  | { kind: 'distance' | 'dx' | 'dy'; a: number; b: number; value: number }
  /** A driving angle in degrees between two straight edges (at their shared point when they meet). */
  | { kind: 'angle'; a: number; b: number; value: number }
  /** A driving distance (straight, along X, along Y) from point `a` to the centre of the outline's circle `circle`. */
  | { kind: 'cdist' | 'cdx' | 'cdy'; a: number; circle: number; value: number }
  /** A driving distance from a horizontal (axis 1: measured along Y) or vertical (axis 0: along X) straight edge to a circle's centre. */
  | { kind: 'cedge'; edge: number; circle: number; axis: 0 | 1; value: number }
  /** A driving distance (straight, along X, along Y) between the centres of two of the outline's circles. */
  | { kind: 'ccdist' | 'ccdx' | 'ccdy'; a: number; b: number; value: number }
  /** Two of the outline's circles about one centre (their radii free). */
  | { kind: 'cconc'; a: number; b: number };

const angle = (v: P2) => Math.atan2(v[1], v[0]);
const wrap = (a: number) => { const w = Math.atan2(Math.sin(a), Math.cos(a)); return w === -Math.PI ? Math.PI : w; };
const nearest = (current: number, options: number[]) => options.reduce((best, o) => Math.abs(wrap(current - o)) < Math.abs(wrap(current - best)) ? o : best);

/** The angle a parallel / perpendicular rule holds between edges a and b, chosen nearest the current drawing. */
export function ruleAngle(kind: 'parallel' | 'perpendicular', points: readonly P2[], a: number, b: number): number {
  const n = points.length, dir = (i: number): P2 => [points[(i + 1) % n][0] - points[i][0], points[(i + 1) % n][1] - points[i][1]];
  return nearest(wrap(angle(dir(b)) - angle(dir(a))), kind === 'parallel' ? [0, Math.PI] : [Math.PI / 2, -Math.PI / 2]);
}

/**
 * The angle between straight edges a and b as a user reads it: when they share a point, between the edges
 * going out from it; otherwise between their drawn directions. `degrees` is in [0, 180], `sign` the turn
 * from a to b, and `flip` how many half turns (−1, 0, 1) the drawn directions add to it.
 */
export function edgeAngle(points: readonly P2[], a: number, b: number): { degrees: number; sign: number; flip: number } {
  const n = points.length, dir = (i: number): P2 => [points[(i + 1) % n][0] - points[i][0], points[(i + 1) % n][1] - points[i][1]];
  // From the shared point, an edge that ends there runs backwards.
  const fa = (a + 1) % n === b ? 1 : 0, fb = !fa && (b + 1) % n === a ? 1 : 0;
  const u = dir(a), w = dir(b), su: P2 = fa ? [-u[0], -u[1]] : u, sw: P2 = fb ? [-w[0], -w[1]] : w;
  const t = wrap(angle(sw) - angle(su));
  return { degrees: Math.abs(t) * 180 / Math.PI, sign: t < 0 ? -1 : 1, flip: fb - fa };
}

/**
 * Solver segments and constraints for the rules. Point i is `p<i>`, straight edge i `s<i>`, arc i's centre
 * `c<i>`; a distance adds its own segment between its points. An axis distance adds two helper points
 * beside its points (each tied to its point across the axis, the first at a set offset) and the measured
 * segment between them, so it never collapses when the points line up. Rules that no longer fit the
 * outline (an edge that became an arc, a point that is gone) are skipped.
 */
export function ruleTerms(rules: readonly SketchRule[], points: readonly P2[], bulges: readonly number[], circles: readonly P2[] = []): { points: KernelPoint[]; segments: KernelSegment[]; constraints: KernelConstraint[] } {
  const n = points.length, line = (i: number) => i >= 0 && i < n && !bulges[i], arc = (i: number) => i >= 0 && i < n && !!bulges[i], point = (i: number) => i >= 0 && i < n;
  const helpers: KernelPoint[] = [], segments: KernelSegment[] = [], constraints: KernelConstraint[] = [];
  /** A circle centre as a solver point `k<j>` (added once). */
  const centre = (j: number) => { if (!helpers.some(h => h.id === 'k' + j)) helpers.push({ id: 'k' + j, position: [circles[j][0], circles[j][1]] }); return 'k' + j; };
  /** A straight (m null) or axis (m 0: X, 1: Y) distance between solver points ia and ib at a and b. */
  const distance = (k: number, ia: string, a: P2, ib: string, b: P2, m: 0 | 1 | null, value: number) => {
    const id = 'u' + k;
    if (m === null) {
      segments.push({ id: 'd' + k, startPointId: ia, endPointId: ib });
      constraints.push({ id, kind: 'length', segmentId: 'd' + k, lengthMM: value }); return;
    }
    // Measured along axis m; the helpers sit 10 mm past both points across it (axis o).
    const o = 1 - m, across = Math.max(a[o], b[o]) + 10, along = Math.abs(b[m] - a[m]) >= 0.01 ? b[m] : a[m] + value;
    const at = (u: number, v: number): P2 => m === 0 ? [u, v] : [v, u];
    helpers.push({ id: 'ha' + k, position: at(a[m], across) }, { id: 'hb' + k, position: at(along, across) });
    const tie = m === 0 ? 'vertical' : 'horizontal', run = m === 0 ? 'horizontal' : 'vertical';
    segments.push({ id: 'xa' + k, startPointId: ia, endPointId: 'ha' + k }, { id: 'xb' + k, startPointId: ib, endPointId: 'hb' + k },
      { id: 'xm' + k, startPointId: 'ha' + k, endPointId: 'hb' + k });
    constraints.push({ id: id + 'a', kind: tie, segmentId: 'xa' + k }, { id: id + 'o', kind: 'length', segmentId: 'xa' + k, lengthMM: across - a[o] },
      { id: id + 'b', kind: tie, segmentId: 'xb' + k }, { id: id + 'r', kind: run, segmentId: 'xm' + k }, { id, kind: 'length', segmentId: 'xm' + k, lengthMM: value });
  };
  // Every attached circle's centre is solved (an unplaced one shows as its two free degrees of freedom).
  circles.forEach((_, j) => centre(j));
  rules.forEach((r, k) => {
    const id = 'u' + k;
    if ((r.kind === 'parallel' || r.kind === 'perpendicular') && line(r.a) && line(r.b))
      constraints.push({ id, kind: 'signed-angle', segmentA: 's' + r.a, segmentB: 's' + r.b, angleRad: ruleAngle(r.kind, points, r.a, r.b) });
    else if (r.kind === 'equal' && line(r.a) && line(r.b)) constraints.push({ id, kind: 'equal-length', segmentA: 's' + r.a, segmentB: 's' + r.b });
    else if (r.kind === 'fix' && point(r.point)) constraints.push({ id, kind: 'fixed', pointId: 'p' + r.point, target: [r.at[0], r.at[1]] });
    else if (r.kind === 'coincident' && point(r.point) && arc(r.arc)) constraints.push({ id, kind: 'coincident', pointA: 'p' + r.point, pointB: 'c' + r.arc });
    else if ((r.kind === 'distance' || r.kind === 'dx' || r.kind === 'dy') && point(r.a) && point(r.b) && r.a !== r.b)
      distance(k, 'p' + r.a, points[r.a], 'p' + r.b, points[r.b], r.kind === 'distance' ? null : r.kind === 'dx' ? 0 : 1, r.value);
    else if ((r.kind === 'cdist' || r.kind === 'cdx' || r.kind === 'cdy') && point(r.a) && r.circle >= 0 && r.circle < circles.length)
      distance(k, 'p' + r.a, points[r.a], centre(r.circle), circles[r.circle], r.kind === 'cdist' ? null : r.kind === 'cdx' ? 0 : 1, r.value);
    else if (r.kind === 'cedge' && line(r.edge) && r.circle >= 0 && r.circle < circles.length)
      distance(k, 'p' + r.edge, points[r.edge], centre(r.circle), circles[r.circle], r.axis, r.value);
    else if ((r.kind === 'ccdist' || r.kind === 'ccdx' || r.kind === 'ccdy') && r.a !== r.b && r.a >= 0 && r.b >= 0 && r.a < circles.length && r.b < circles.length)
      distance(k, centre(r.a), circles[r.a], centre(r.b), circles[r.b], r.kind === 'ccdist' ? null : r.kind === 'ccdx' ? 0 : 1, r.value);
    else if (r.kind === 'cconc' && r.a !== r.b && r.a >= 0 && r.b >= 0 && r.a < circles.length && r.b < circles.length)
      constraints.push({ id, kind: 'coincident', pointA: centre(r.a), pointB: centre(r.b) });
    else if (r.kind === 'angle' && line(r.a) && line(r.b)) {
      const e = edgeAngle(points, r.a, r.b);
      constraints.push({ id, kind: 'signed-angle', segmentA: 's' + r.a, segmentB: 's' + r.b, angleRad: wrap(e.sign * r.value * Math.PI / 180 + e.flip * Math.PI) });
    }
  });
  return { points: helpers, segments, constraints };
}
