import type { Brep } from '@barocss/cad';
import { bodyMesh, type CylinderDisplayTier, type DisplayMesh } from './mesh';
import { nativeCircleOf } from './nativeCircle';

const cache = new WeakMap<DisplayMesh, DisplayMesh>();
const packetLimit = 192 * 1024;

export function bandRailDisplayMesh(base: DisplayMesh, brep: Brep, revision: number): DisplayMesh {
  const cached = cache.get(base);
  if (cached) return cached;
  cache.set(base, base);
  if (brep.source.family !== 'band-surface' || brep.bodies.length !== 1 || brep.bodies[0].kind !== 'sheet'
    || brep.shells.length !== 1 || brep.shells[0].closed || brep.faces.length !== 2 || base.faces.length !== 2 || base.edges.length) return base;
  const rails = brep.edges.flatMap(edge => {
    const name = edge.name;
    if (!name || !/\.[ab]\|[^|]+\.band[01]$/.test(name)) return [];
    const circle = nativeCircleOf(edge.curve);
    return circle && Math.abs(circle.normal[2]) >= 1 - 1e-10 ? [{ id: edge.id, name, radius: circle.radius }] : [];
  });
  if (rails.length !== 4 || new Set(rails.map(rail => rail.name)).size !== 4) return base;
  const tiers: CylinderDisplayTier[] = [];
  let owners: { name: string; face: number }[] | undefined, bytes = 0;
  for (const quality of [8, 16, 32]) {
    const lines: number[] = [], edgeOf: number[] = [], faces = new Map<string, number>();
    let chordErrorMM = 0;
    const next = bodyMesh(brep, revision, quality, (id, face, points) => {
      const index = rails.findIndex(rail => rail.id === id);
      if (index < 0) return;
      faces.set(id, face);
      const r = rails[index].radius;
      for (let k = 1; k < points.length; k++) {
        const a = points[k - 1], b = points[k];
        const c2 = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
        const error = c2 / (4 * (r + Math.sqrt(r * r - c2 / 4)));
        chordErrorMM = Math.max(chordErrorMM, error);
        lines.push(...a, ...b); edgeOf.push(index, index);
      }
    });
    if (faces.size !== 4 || next.edges.length || next.faces.length !== base.faces.length || !Number.isFinite(chordErrorMM)
      || base.faces.some((face, i) => next.faces[i].id !== face.id || next.faces[i].name !== face.name)) break;
    const tierOwners = rails.map(rail => ({ name: rail.name, face: faces.get(rail.id)! }));
    if (owners && owners.some((rail, i) => rail.face !== tierOwners[i].face)) break;
    const { positions, normals, faceOfVertex, indices } = next;
    const edgeLines = new Float64Array(lines), edgeOfSegment = new Float32Array(edgeOf);
    bytes += positions.byteLength + normals.byteLength + faceOfVertex.byteLength + indices.byteLength + edgeLines.byteLength + edgeOfSegment.byteLength;
    if (bytes > packetLimit) break;
    owners = tierOwners;
    tiers.push({ positions, normals, faceOfVertex, indices, edgeLines, edgeOfSegment, chordErrorMM });
  }
  if (!owners || !tiers.length) return base;
  const result = { ...base, bandDetail: { rails: owners, tiers } };
  cache.set(base, result);
  return result;
}
