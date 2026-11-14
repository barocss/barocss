import { faceGeometry } from '../brep/analytic-boolean.js';
import { checkBrep, type Brep } from '../brep/brep-core.js';

/** The exclusive thickness limit for opening one face of a validated cardinal box. */
export function boxShellWallLimit(brep: Brep, open: string): number | undefined {
  const { bodies, shells, faces, loops, coedges, edges, vertices } = brep;
  if (bodies.length !== 1 || bodies[0].kind !== 'solid' || bodies[0].shells.length !== 1
    || shells.length !== 1 || !shells[0].closed || faces.length !== 6 || loops.length !== 6
    || coedges.length !== 24 || edges.length !== 12 || vertices.length !== 8) return undefined;

  const axes = [0, 1, 2] as const;
  const ranges = axes.map(axis => [...new Set(vertices.map(vertex => vertex.point[axis]))].sort((a, b) => a - b));
  if (ranges.some(range => range.length !== 2) || new Set(vertices.map(vertex => vertex.point.join(','))).size !== 8)
    return undefined;
  const pointOf = new Map(vertices.map(vertex => [vertex.id, vertex.point]));
  const edgeOf = new Map(edges.map(edge => [edge.id, edge]));
  const coedgeOf = new Map(coedges.map(coedge => [coedge.id, coedge]));
  const loopOf = new Map(loops.map(loop => [loop.id, loop]));

  const directions = new Set<string>();
  let openAxis: number | undefined;
  for (const face of faces) {
    if (face.surface.kind !== 'surface') return undefined;
    let plane: ReturnType<typeof faceGeometry>;
    try { plane = faceGeometry(face); } catch { return undefined; }
    if (plane.kind !== 'plane') return undefined;
    const axis = axes.find(axis => Math.abs(plane.n[axis]) === 1 && axes.every(i => i === axis || plane.n[i] === 0));
    if (axis === undefined || face.loops.length !== 1) return undefined;
    const side = plane.n[axis] > 0 ? 1 : 0;
    const direction = `${axis}:${side}`;
    if (directions.has(direction) || plane.o[axis] !== ranges[axis][side]
      || !face.surface.controlPoints.every(row => row.every(point => point[axis] === plane.o[axis]))) return undefined;
    directions.add(direction);

    const loop = loopOf.get(face.loops[0]);
    if (loop?.kind !== 'outer' || loop.coedges.length !== 4) return undefined;
    const corners = new Set<string>();
    for (const coedgeId of loop.coedges) {
      const coedge = coedgeOf.get(coedgeId);
      const edge = coedge && edgeOf.get(coedge.edge);
      if (!edge || edge.curve.degree !== 1 || edge.curve.controlPoints.length !== 2) return undefined;
      const [first, last] = edge.vertices.map(id => pointOf.get(id));
      if (!first || !last || first[axis] !== ranges[axis][side] || last[axis] !== ranges[axis][side]
        || axes.filter(i => first[i] !== last[i]).length !== 1
        || !edge.curve.controlPoints[0].every((value, i) => value === first[i])
        || !edge.curve.controlPoints[1].every((value, i) => value === last[i])) return undefined;
      corners.add(edge.vertices[0]);
      corners.add(edge.vertices[1]);
    }
    if (corners.size !== 4) return undefined;
    if (face.name === open) openAxis = axis;
  }
  if (openAxis === undefined || !checkBrep(brep).valid) return undefined;
  return Math.min(...ranges.map(([low, high], axis) => (high - low) / (axis === openAxis ? 1 : 2)));
}
