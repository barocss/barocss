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
  | { kind: 'distance' | 'dx' | 'dy'; a: number; b: number; value: number };

const angle = (v: P2) => Math.atan2(v[1], v[0]);
const wrap = (a: number) => { const w = Math.atan2(Math.sin(a), Math.cos(a)); return w === -Math.PI ? Math.PI : w; };
const nearest = (current: number, options: number[]) => options.reduce((best, o) => Math.abs(wrap(current - o)) < Math.abs(wrap(current - best)) ? o : best);

/** The angle a parallel / perpendicular rule holds between edges a and b, chosen nearest the current drawing. */
export function ruleAngle(kind: 'parallel' | 'perpendicular', points: readonly P2[], a: number, b: number): number {
  const n = points.length, dir = (i: number): P2 => [points[(i + 1) % n][0] - points[i][0], points[(i + 1) % n][1] - points[i][1]];
  return nearest(wrap(angle(dir(b)) - angle(dir(a))), kind === 'parallel' ? [0, Math.PI] : [Math.PI / 2, -Math.PI / 2]);
}

/**
 * Solver segments and constraints for the rules. Point i is `p<i>`, straight edge i `s<i>`, arc i's centre
 * `c<i>`; a distance adds its own segment between its points. An axis distance adds two helper points
 * beside its points (each tied to its point across the axis, the first at a set offset) and the measured
 * segment between them, so it never collapses when the points line up. Rules that no longer fit the
 * outline (an edge that became an arc, a point that is gone) are skipped.
 */
export function ruleTerms(rules: readonly SketchRule[], points: readonly P2[], bulges: readonly number[]): { points: KernelPoint[]; segments: KernelSegment[]; constraints: KernelConstraint[] } {
  const n = points.length, line = (i: number) => i >= 0 && i < n && !bulges[i], arc = (i: number) => i >= 0 && i < n && !!bulges[i], point = (i: number) => i >= 0 && i < n;
  const helpers: KernelPoint[] = [], segments: KernelSegment[] = [], constraints: KernelConstraint[] = [];
  rules.forEach((r, k) => {
    const id = 'u' + k;
    if ((r.kind === 'parallel' || r.kind === 'perpendicular') && line(r.a) && line(r.b))
      constraints.push({ id, kind: 'signed-angle', segmentA: 's' + r.a, segmentB: 's' + r.b, angleRad: ruleAngle(r.kind, points, r.a, r.b) });
    else if (r.kind === 'equal' && line(r.a) && line(r.b)) constraints.push({ id, kind: 'equal-length', segmentA: 's' + r.a, segmentB: 's' + r.b });
    else if (r.kind === 'fix' && point(r.point)) constraints.push({ id, kind: 'fixed', pointId: 'p' + r.point, target: [r.at[0], r.at[1]] });
    else if (r.kind === 'coincident' && point(r.point) && arc(r.arc)) constraints.push({ id, kind: 'coincident', pointA: 'p' + r.point, pointB: 'c' + r.arc });
    else if (r.kind === 'distance' && point(r.a) && point(r.b) && r.a !== r.b) {
      segments.push({ id: 'd' + k, startPointId: 'p' + r.a, endPointId: 'p' + r.b });
      constraints.push({ id, kind: 'length', segmentId: 'd' + k, lengthMM: r.value });
    } else if ((r.kind === 'dx' || r.kind === 'dy') && point(r.a) && point(r.b) && r.a !== r.b) {
      // Measured along axis m; the helpers sit 10 mm past both points across it (axis o).
      const m = r.kind === 'dx' ? 0 : 1, o = 1 - m, a = points[r.a], b = points[r.b];
      const across = Math.max(a[o], b[o]) + 10, along = Math.abs(b[m] - a[m]) >= 0.01 ? b[m] : a[m] + r.value;
      const at = (u: number, v: number): P2 => m === 0 ? [u, v] : [v, u];
      helpers.push({ id: 'ha' + k, position: at(a[m], across) }, { id: 'hb' + k, position: at(along, across) });
      const tie = m === 0 ? 'vertical' : 'horizontal', run = m === 0 ? 'horizontal' : 'vertical';
      segments.push({ id: 'xa' + k, startPointId: 'p' + r.a, endPointId: 'ha' + k }, { id: 'xb' + k, startPointId: 'p' + r.b, endPointId: 'hb' + k },
        { id: 'xm' + k, startPointId: 'ha' + k, endPointId: 'hb' + k });
      constraints.push({ id: id + 'a', kind: tie, segmentId: 'xa' + k }, { id: id + 'o', kind: 'length', segmentId: 'xa' + k, lengthMM: across - a[o] },
        { id: id + 'b', kind: tie, segmentId: 'xb' + k }, { id: id + 'r', kind: run, segmentId: 'xm' + k }, { id, kind: 'length', segmentId: 'xm' + k, lengthMM: r.value });
    }
  });
  return { points: helpers, segments, constraints };
}
