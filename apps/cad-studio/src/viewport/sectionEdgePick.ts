import { cutAfter } from '@barocss/cad-model/engine/ids';
import type { DisplayEdge, DisplayMesh, Vec3 } from '@barocss/cad-model/engine/mesh';
import { planeAxis, type SectionPlane } from './sectionView';

function edgeIdentity(mesh: DisplayMesh, edge: DisplayEdge): string | null {
  if (!edge.nativeLine || edge.names.length !== 1) return null;
  const adjacent = edge.faces.map(index => mesh.faces[index]?.name);
  if (!adjacent[0] || !adjacent[1] || adjacent[0] === adjacent[1]) return null;
  return JSON.stringify([edge.names[0], adjacent.sort()]);
}

const samePoint = (a: Vec3, b: Vec3) => a.every((value, axis) => value === b[axis]);

/** A single axis Section can reuse a straight source edge only if both native endpoints survive. */
export function retainedSectionEdges(source: DisplayMesh, shown: DisplayMesh, plane: SectionPlane, from: number) {
  const axis = planeAxis(plane), retained = new Map<number, number>();
  if (!axis) return retained;
  const { k, at, keep } = axis;
  const inside = (point: Vec3) => keep === 'positive' ? point[k] > at : point[k] < at;
  const originals = new Map<string, DisplayEdge | null>();
  for (const edge of source.edges) {
    const key = edgeIdentity(source, edge);
    if (key !== null) originals.set(key, originals.has(key) ? null : edge);
  }
  for (const edge of shown.edges) {
    if (!inside(edge.a) || !inside(edge.b) || edge.faces.some(index => cutAfter(shown.faces[index]?.name ?? '', from))) continue;
    const key = edgeIdentity(shown, edge), original = key !== null ? originals.get(key) : null;
    if (!original) continue;
    const same = (samePoint(edge.a, original.a) && samePoint(edge.b, original.b))
      || (samePoint(edge.a, original.b) && samePoint(edge.b, original.a));
    if (same) retained.set(edge.index, original.index);
  }
  return retained;
}
