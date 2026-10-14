// Turns each kernel body family into one display mesh: triangles with a face index per vertex,
// face records for selection, and feature edges (polylines between faces) for line rendering.
import {
  tessellateConvexPlanarSolid, tessellateOwnPlateCircularHole, tessellateXYCirclePrismShell,
} from '@barocss/cad';

export type Vec3 = [number, number, number];

export interface DisplayFace { index: number; id: string; kind: 'plane' | 'curved'; normal: Vec3; centroid: Vec3; areaMM2: number }
export interface DisplayEdge { index: number; faces: [number, number]; a: Vec3; b: Vec3; straight: boolean; axis: 'x' | 'y' | 'z' | null }
export interface DisplayMesh {
  positions: Float32Array; normals: Float32Array; faceOfVertex: Float32Array; indices: Uint32Array;
  faces: DisplayFace[]; edgeLines: Float32Array; edgeOfSegment: Float32Array; edges: DisplayEdge[];
  bounds: { min: Vec3; max: Vec3 };
}

interface Builder { p: number[]; n: number[]; f: number[]; i: number[]; faces: DisplayFace[] }

const newBuilder = (): Builder => ({ p: [], n: [], f: [], i: [], faces: [] });

function addFace(b: Builder, id: string, kind: DisplayFace['kind'], positions: ArrayLike<number>, normals: ArrayLike<number> | null, indices: ArrayLike<number>) {
  const faceIndex = b.faces.length, base = b.p.length / 3, count = positions.length / 3;
  for (let v = 0; v < count; v++) { b.p.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]); b.f.push(faceIndex); }
  let area = 0; const centroid: Vec3 = [0, 0, 0]; const normal: Vec3 = [0, 0, 0];
  const faceNormals = new Array(count * 3).fill(0);
  for (let t = 0; t < indices.length; t += 3) {
    const [ia, ib, ic] = [indices[t], indices[t + 1], indices[t + 2]];
    const a = vec(positions, ia), bb = vec(positions, ib), c = vec(positions, ic);
    const cr = cross(sub(bb, a), sub(c, a)); const ar = len(cr) / 2;
    area += ar; for (let k = 0; k < 3; k++) { centroid[k] += (a[k] + bb[k] + c[k]) / 3 * ar; normal[k] += cr[k]; }
    for (const ix of [ia, ib, ic]) for (let k = 0; k < 3; k++) faceNormals[ix * 3 + k] += cr[k];
    b.i.push(base + ia, base + ib, base + ic);
  }
  for (let v = 0; v < count; v++) {
    const src = normals ?? faceNormals; const nv = norm([src[v * 3], src[v * 3 + 1], src[v * 3 + 2]]);
    b.n.push(nv[0], nv[1], nv[2]);
  }
  b.faces.push({ index: faceIndex, id, kind, normal: norm(normal), centroid: area > 0 ? centroid.map(x => x / area) as Vec3 : vec(positions, 0), areaMM2: area });
}

function finish(b: Builder): DisplayMesh {
  const positions = new Float32Array(b.p), normals = new Float32Array(b.n), faceOfVertex = new Float32Array(b.f), indices = new Uint32Array(b.i);
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < positions.length; v += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], positions[v + k]); max[k] = Math.max(max[k], positions[v + k]); }
  const { edges, lines, segmentEdge } = featureEdges(positions, faceOfVertex, indices, b.faces);
  return { positions, normals, faceOfVertex, indices, faces: b.faces, edgeLines: lines, edgeOfSegment: segmentEdge, edges, bounds: { min, max } };
}

/** Edges where two different faces meet at a crease, or open boundaries; merged into straight runs. */
function featureEdges(positions: Float32Array, faceOfVertex: Float32Array, indices: Uint32Array, faces: DisplayFace[]) {
  const key = (v: number) => `${Math.round(positions[v * 3] * 1e4)},${Math.round(positions[v * 3 + 1] * 1e4)},${Math.round(positions[v * 3 + 2] * 1e4)}`;
  const weld = new Map<string, number>(); const welded: number[] = [];
  for (let v = 0; v < positions.length / 3; v++) { const k = key(v); if (!weld.has(k)) weld.set(k, v); welded.push(weld.get(k)!); }
  const map = new Map<string, { a: number; b: number; faces: number[]; normals: Vec3[] }>();
  for (let t = 0; t < indices.length; t += 3) {
    const tri = [indices[t], indices[t + 1], indices[t + 2]];
    const n = norm(cross(sub(vec(positions, tri[1]), vec(positions, tri[0])), sub(vec(positions, tri[2]), vec(positions, tri[0]))));
    const face = faceOfVertex[tri[0]];
    for (let e = 0; e < 3; e++) {
      const a = welded[tri[e]], b = welded[tri[(e + 1) % 3]]; const k = a < b ? `${a}_${b}` : `${b}_${a}`;
      const rec = map.get(k) ?? { a: Math.min(a, b), b: Math.max(a, b), faces: [], normals: [] };
      rec.faces.push(face); rec.normals.push(n); map.set(k, rec);
    }
  }
  const groups = new Map<string, Vec3[][]>();
  const push = (fa: number, fb: number, seg: Vec3[]) => {
    const gk = fa < fb ? `${fa}_${fb}` : `${fb}_${fa}`;
    const list = groups.get(gk) ?? []; list.push(seg); groups.set(gk, list);
  };
  // Open boundary segments: kernel previews can leave T-junctions (one face splits an edge the
  // neighbour keeps whole), so pair them with a collinear, overlapping boundary of another face.
  const open: { face: number; seg: Vec3[] }[] = [];
  for (const rec of map.values()) {
    const seg = [vec(positions, rec.a), vec(positions, rec.b)];
    if (rec.faces.length === 1) { open.push({ face: rec.faces[0], seg }); continue; }
    if (rec.faces.length !== 2 || rec.faces[0] === rec.faces[1]) continue;
    if (dot(rec.normals[0], rec.normals[1]) < Math.cos(Math.PI / 9)) push(rec.faces[0], rec.faces[1], seg);
  }
  const overlaps = (s: Vec3[], t: Vec3[]) => {
    const d = norm(sub(s[1], s[0])), l = len(sub(s[1], s[0]));
    if (Math.abs(Math.abs(dot(norm(sub(t[1], t[0])), d)) - 1) > 1e-6) return false;
    if (len(cross(sub(t[0], s[0]), d)) > 1e-4 || len(cross(sub(t[1], s[0]), d)) > 1e-4) return false;
    const a = dot(sub(t[0], s[0]), d), b = dot(sub(t[1], s[0]), d);
    return Math.max(a, b) > 1e-6 && Math.min(a, b) < l - 1e-6;
  };
  for (const item of open) {
    const mate = open.find(other => other.face !== item.face && overlaps(item.seg, other.seg));
    push(item.face, mate ? mate.face : item.face, item.seg);
  }
  const edges: DisplayEdge[] = []; const lines: number[] = []; const segmentEdge: number[] = [];
  for (const [gk, segments] of groups) {
    const [fa, fb] = gk.split('_').map(Number) as [number, number];
    const index = edges.length;
    const dir = norm(sub(segments[0][1], segments[0][0]));
    const straight = segments.every(([a, b]) => Math.abs(Math.abs(dot(norm(sub(b, a)), dir)) - 1) < 1e-6
      && len(cross(sub(a, segments[0][0]), dir)) < 1e-4);
    let a = segments[0][0], b = segments[0][1];
    if (straight) {
      let lo = Infinity, hi = -Infinity;
      for (const s of segments) for (const p of s) { const d = dot(sub(p, segments[0][0]), dir); if (d < lo) { lo = d; a = p; } if (d > hi) { hi = d; b = p; } }
    }
    const axis = straight ? (['x', 'y', 'z'] as const).find((_, k) => Math.abs(Math.abs(dir[k]) - 1) < 1e-6) ?? null : null;
    edges.push({ index, faces: [fa, fb], a, b, straight, axis });
    for (const [p, q] of segments) { lines.push(...p, ...q); segmentEdge.push(index, index); }
  }
  void faces;
  return { edges, lines: new Float32Array(lines), segmentEdge: new Float32Array(segmentEdge) };
}

const context = (bodyId: string, revision: number) => ({ documentId: 'cad_studio', bodyId, documentRevision: String(revision),
  kernelResultRevision: String(revision), topologyRevision: String(revision), taskToken: 'studio_' + revision });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function bodyMesh(body: any, revision: number, quality = 8): DisplayMesh {
  const b = newBuilder();
  if (body.family === 'convex-planar') {
    const { mesh } = tessellateConvexPlanarSolid(body.native, { maximumFanTriangles: 40 });
    for (const face of mesh.faces) {
      const v0 = face.vertexOffset, vc = face.vertexCount;
      const pos = mesh.positionsMM.slice(v0 * 3, (v0 + vc) * 3), nor = mesh.normals.slice(v0 * 3, (v0 + vc) * 3);
      const idx = mesh.indices.slice(face.indexOffset, face.indexOffset + face.indexCount).map((i: number) => i - v0);
      addFace(b, face.faceId, 'plane', pos, nor, idx);
    }
  } else if (body.family === 'stored-rational-plate-hole') {
    const preview = tessellateOwnPlateCircularHole(body.native.bundle, { context: context(body.native.bundle.request.bodyId, revision), segmentsPerQuarter: quality });
    for (const chunk of preview.mesh.chunks) {
      const curved = /hole|wall/i.test(chunk.nativeFaceId);
      addFace(b, chunk.nativeFaceId, curved ? 'curved' : 'plane', chunk.positionsMM, chunk.normals, chunk.indices);
    }
  } else if (body.family === 'stored-rational-circle-prism') {
    const shell = tessellateXYCirclePrismShell(body.native.parent.bundle, { meshId: 'studio_circle', revision, segmentsPerQuarter: quality });
    const { positions, normals, indices } = shell.packet;
    for (const range of shell.faceRanges) {
      const [v0, v1] = range.vertexRange, [i0, i1] = range.indexRange;
      const idx = indices.slice(i0, i1).map((i: number) => i - v0);
      addFace(b, range.faceId, range.role === 'wall' ? 'curved' : 'plane',
        positions.slice(v0 * 3, v1 * 3), normals.slice(v0 * 3, v1 * 3), idx);
    }
  } else if (body.family === 'orthogonal-cell') {
    const native = body.native;
    const points = new Map<string, Vec3>(native.vertices.map((v: { id: string; pointMM: Vec3 }) => [v.id, v.pointMM]));
    for (const panel of native.panels) {
      if (!panel.bodyId) continue;
      const corners: Vec3[] = panel.vertexIds.map((id: string) => points.get(id)!);
      const normal: Vec3 = [0, 0, 0]; normal[panel.axis] = panel.sign;
      let quad = corners;
      const n = cross(sub(quad[1], quad[0]), sub(quad[2], quad[0]));
      if (dot(n, normal) < 0) quad = [quad[0], quad[3], quad[2], quad[1]];
      addFace(b, panel.id, 'plane', quad.flat(), [...normal, ...normal, ...normal, ...normal], [0, 1, 2, 0, 2, 3]);
    }
  } else {
    throw new Error('Unsupported body family ' + body.family);
  }
  return finish(b);
}

const vec = (a: ArrayLike<number>, i: number): Vec3 => [a[i * 3], a[i * 3 + 1], a[i * 3 + 2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: Vec3): Vec3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
