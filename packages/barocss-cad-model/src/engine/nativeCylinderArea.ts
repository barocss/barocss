import { CadNumericPolicy, type Brep, type BrepFace, type Curve } from '@barocss/cad';
import { nativeCircleOf } from './nativeCircle';
import { nativeStraightEdgeMatches } from './nativeStraightEdge';
import { cross, dot, sub, type Vec3 } from './vec3';

const axes = [0, 1, 2] as const;
const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((value, i) => value === b[i]);
const inRange = (p: Vec3) => p.length === 3 && p.every(v => Number.isFinite(v) && Math.abs(v) <= CadNumericPolicy.coordinateAbs);
const key = ([u, v]: Vec3) => u + 2 * v;
const corners: readonly Vec3[] = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]];
const byId = <T extends { readonly id: string }>(items: readonly T[]) => new Map(items.map(item => [item.id, item]));

/** Recognize the whole rectangular trim of a native cardinal-axis prismatic cylinder. */
export function nativeCylinderAreaReader(brep: Brep): (face: BrepFace) => number | undefined {
  if (brep.source.family !== 'prismatic-solid') return () => undefined;
  const topologyOf = () => ({
    loops: byId(brep.loops), coedges: byId(brep.coedges), edges: byId(brep.edges), vertices: byId(brep.vertices),
  });
  let topology: ReturnType<typeof topologyOf> | undefined;
  return face => {
    const surface = face.surface;
    if (surface.kind !== 'surface' || face.loops.length !== 1 || surface.degreeU !== 2 || surface.degreeV !== 1
      || !same(surface.knotsV, [0, 0, 1, 1])) return;
    const { controlPoints: poles, weights, knotsU: knots } = surface;
    if (poles.length < 3 || poles.length > 9 || weights.length !== poles.length
      || !poles.every(row => row.length === 2 && row.every(inRange))
      || !weights.every(row => row.length === 2 && row[0] === row[1])
      || knots[2] !== 0 || knots[knots.length - 3] !== 1) return;

    // Equal weights and equal translation in every row make S(u,v) = C(u) + v·d.
    const [bottom, top] = poles[0], axis = axes.find(i => bottom[i] !== top[i]);
    if (axis === undefined || axes.some(i => i !== axis && bottom[i] !== top[i])
      || poles.some(([a, b]) => a[axis] !== bottom[axis] || b[axis] !== top[axis]
        || axes.some(i => i !== axis && a[i] !== b[i]))) return;
    const height = Math.abs(top[axis] - bottom[axis]);
    if (height <= CadNumericPolicy.linearTolerance) return;

    const { loops, coedges, edges, vertices } = (topology ??= topologyOf()), loop = loops.get(face.loops[0]);
    if (!loop || loop.kind !== 'outer' || loop.face !== face.id || loop.coedges.length !== 4) return;
    const used = new Set<number>();
    let first: number | undefined, last: number | undefined;
    for (const id of loop.coedges) {
      const use = coedges.get(id), edge = use && edges.get(use.edge), pcurve = use?.pcurve;
      if (!use || !edge || use.loop !== loop.id || !pcurve || pcurve.controlPoints.length !== 2
        || !same(pcurve.knots, [0, 0, 1, 1])) return;
      const [a, b] = pcurve.controlPoints, aKey = key(a), bKey = key(b);
      if (!corners[aKey] || !corners[bKey] || !same(a, corners[aKey]) || !same(b, corners[bKey])
        || !nativeStraightEdgeMatches(pcurve, a, b) || (a[0] !== b[0] && a[1] !== b[1])) return;

      // Pcurves follow their edge's parameter direction. The coedge sense orders the loop.
      const start = use.sense === 'forward' ? aKey : bKey, end = use.sense === 'forward' ? bKey : aKey;
      if (used.has(start) || (last !== undefined && last !== start)) return;
      used.add(start);
      first ??= start;
      last = end;

      const row = (u: number) => u ? poles.length - 1 : 0;
      const p = poles[row(a[0])][a[1]], q = poles[row(b[0])][b[1]];
      const va = vertices.get(edge.vertices[0]), vb = vertices.get(edge.vertices[1]);
      if (!va || !vb || !same(p, va.point) || !same(q, vb.point)) return;
      const curve = edge.curve;
      if (a[0] === b[0]) {
        if (!same(curve.knots, [0, 0, 1, 1]) || !nativeStraightEdgeMatches(curve, p, q)) return;
      } else {
        const at = (i: number) => a[0] === 0 ? i : poles.length - 1 - i;
        if (curve.degree !== 2 || curve.controlPoints.length !== poles.length || curve.weights.length !== poles.length
          || !(a[0] === 0 ? same(curve.knots, knots) : same(curve.knots, knots.map((_, i) => 1 - knots[knots.length - 1 - i])))
          || !curve.controlPoints.every((point, i) => same(point, poles[at(i)][a[1]]) && curve.weights[i] === weights[at(i)][a[1]])) return;
      }
    }
    if (first !== last) return;

    const rim: Curve = { kind: 'curve', id: surface.id, degree: 2, knots,
      controlPoints: poles.map(row => row[0]), weights: weights.map(row => row[0]) };
    const circle = nativeCircleOf(rim);
    if (!circle || circle.radius > CadNumericPolicy.coordinateAbs) return;
    // Sum the signed rational spans, never infer the sweep from only the two endpoints.
    let sweep = 0, direction = 0;
    for (let i = 0; i + 2 < poles.length; i += 2) {
      const a = sub(poles[i][0], circle.centre), b = sub(poles[i + 2][0], circle.centre);
      const sign = Math.sign(cross(a, b)[axis]), weight = weights[i + 1][0] / weights[i][0];
      const angle = 2 * Math.acos(weight);
      if (!sign || (direction && sign !== direction) || !(angle > 0 && angle <= Math.PI / 2 + 1e-12)
        || !(Math.abs(angle - Math.atan2(Math.abs(cross(a, b)[axis]), dot(a, b))) <= 1e-9)) return;
      direction = sign;
      sweep += angle;
    }
    const area = circle.radius * height * sweep;
    if (sweep <= 2 * Math.PI + 1e-12 && area > 0 && Number.isFinite(area)) return area;
  };
}
