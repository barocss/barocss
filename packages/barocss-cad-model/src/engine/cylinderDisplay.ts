import type { Brep } from '@barocss/cad';
import { bodyMesh, type CylinderDisplayTier, type DisplayMesh } from './mesh';

const byMesh = new WeakMap<DisplayMesh, DisplayMesh>();
const MAX_PACKET_BYTES = 192 * 1024;

function chordError(mesh: DisplayMesh): number {
  let max = 0;
  for (let i = 0; i < mesh.edgeLines.length; i += 6) {
    const edge = mesh.edges[mesh.edgeOfSegment[i / 3]], r = edge?.nativeCircle?.radius;
    if (!r) return Infinity;
    const xyz = mesh.edgeLines, c2 = (xyz[i] - xyz[i + 3]) ** 2 + (xyz[i + 1] - xyz[i + 4]) ** 2 + (xyz[i + 2] - xyz[i + 5]) ** 2;
    if (!(c2 > 0 && c2 < 4 * r * r)) return Infinity;
    max = Math.max(max, c2 / (4 * (r + Math.sqrt(r * r - c2 / 4))));
  }
  return max;
}

function sameOwners(base: DisplayMesh, next: DisplayMesh): boolean {
  return next.faces.length === base.faces.length && next.edges.length === base.edges.length
    && base.faces.every((face, index) => {
      const other = next.faces[index];
      return other.index === face.index && other.id === face.id && other.name === face.name && other.kind === face.kind
        && JSON.stringify(other.nativeFaces?.map(member => member.name)) === JSON.stringify(face.nativeFaces?.map(member => member.name));
    })
    && base.edges.every((edge, index) => {
      const other = next.edges[index];
      return edge.index === other.index && edge.faces[0] === other.faces[0] && edge.faces[1] === other.faces[1]
        && edge.names.length === other.names.length && edge.names.every((name, k) => name === other.names[k]);
    });
}

/** Exact-source display refinement for a single upright, uncut cylinder. */
export function cylinderDisplayMesh(base: DisplayMesh, brep: Brep, revision: number): DisplayMesh {
  const cached = byMesh.get(base);
  if (cached) return cached;
  byMesh.set(base, base);
  if (brep.source.family !== 'prismatic-solid' || brep.bodies.length !== 1 || brep.bodies[0].kind !== 'solid'
    || brep.shells.length !== 1 || !brep.shells[0].closed || brep.faces.length !== 4 || brep.edges.length !== 6
    || base.faces.length !== 3 || base.faces.filter(face => face.kind === 'plane').length !== 2
    || base.edges.length !== 2 || base.edges.some(edge => !edge.nativeCircle || Math.abs(edge.nativeCircle.normal[2]) < 1 - 1e-10)) return base;
  const firstError = chordError(base);
  if (!Number.isFinite(firstError) || !(firstError > 0)) return base;
  const cylinderDetail: CylinderDisplayTier[] = [];
  let lastError = firstError, bytes = 0;
  for (const quality of [16, 32]) {
    const next = bodyMesh(brep, revision, quality);
    if (!sameOwners(base, next)) break;
    const chordErrorMM = chordError(next);
    if (!(chordErrorMM < lastError)) break;
    const { positions, normals, faceOfVertex, indices, edgeLines, edgeOfSegment } = next;
    bytes += positions.byteLength + normals.byteLength + faceOfVertex.byteLength + indices.byteLength + edgeLines.byteLength + edgeOfSegment.byteLength;
    if (bytes > MAX_PACKET_BYTES) break;
    cylinderDetail.push({ positions, normals, faceOfVertex, indices, edgeLines, edgeOfSegment, chordErrorMM });
    lastError = chordErrorMM;
  }
  if (!cylinderDetail.length) return base;
  const detailed = { ...base, cylinderDetail: { baseChordErrorMM: firstError, tiers: cylinderDetail } };
  byMesh.set(base, detailed);
  return detailed;
}
