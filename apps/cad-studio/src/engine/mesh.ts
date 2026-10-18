// Turns a kernel B-rep into one display mesh: tessellateBrep (watertight, one sampling per edge).
// Display faces are B-rep faces, with coplanar neighbours and the pieces of one named face (`x#1`,
// `x#2`: a cylinder wall in halves) shown as one face; display edges are the real B-rep edges minus
// seams and smooth (tangent) joints, with connected pieces between the same two faces joined. Faces and
// edges carry their persistent B-rep names, which features use to refer to them.
import { faceGeometry, revolutionOf, tessellateBrep, type Brep } from '@barocss/cad';
export { sub, cross, dot, len, unit as norm } from './vec3';
import { sub, cross, dot, len, unit as norm } from './vec3';

export type Vec3 = [number, number, number];

/** `radius`: a cylinder's or a sphere's. */
export interface DisplayFace { index: number; id: string; name: string; kind: 'plane' | 'curved'; normal: Vec3; centroid: Vec3; areaMM2: number; radius?: number }
export interface DisplayEdge { index: number; faces: [number, number]; a: Vec3; b: Vec3; straight: boolean; axis: 'x' | 'y' | 'z' | null; names: string[] }
export interface DisplayMesh {
  positions: Float32Array; normals: Float32Array; faceOfVertex: Float32Array; indices: Uint32Array;
  faces: DisplayFace[]; edgeLines: Float32Array; edgeOfSegment: Float32Array; edges: DisplayEdge[];
  bounds: { min: Vec3; max: Vec3 };
}

interface Builder { p: number[]; n: number[]; f: number[]; i: number[]; faces: DisplayFace[] }

const newBuilder = (): Builder => ({ p: [], n: [], f: [], i: [], faces: [] });

function addFace(b: Builder, id: string, name: string, kind: DisplayFace['kind'], positions: ArrayLike<number>, normals: ArrayLike<number> | null, indices: ArrayLike<number>) {
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
  b.faces.push({ index: faceIndex, id, name, kind, normal: norm(normal), centroid: area > 0 ? centroid.map(x => x / area) as Vec3 : vec(positions, 0), areaMM2: area });
}

const baseName = (name: string | undefined) => (name ?? '').replace(/#\d+$/, '');
/** Whether two edge ends are one point (to 1e-6 of the size). */
const near = (p: Vec3, q: Vec3) => len(sub(p, q)) < 1e-6 * Math.max(1, len(p));
const pushSegment = (lines: number[], p: Vec3, q: Vec3) => { lines.push(p[0], p[1], p[2], q[0], q[1], q[2]); };

export function bodyMesh(brep: Brep, _revision: number, quality = 8): DisplayMesh {
  const mesh = tessellateBrep(brep, { segmentsPerQuarter: quality });
  const nameOf = new Map(brep.faces.map(f => [f.id, f.name ?? f.id]));
  const P = mesh.positionsMM, N = mesh.normals;
  const meshFace = new Map(mesh.faces.map(f => [f.faceId, f]));
  const loopFace = new Map(brep.loops.map(l => [l.id, l.face]));
  const facesOfEdge = new Map<string, string[]>();
  for (const c of brep.coedges) { const l = facesOfEdge.get(c.edge), f = loopFace.get(c.loop)!; if (l) l.push(f); else facesOfEdge.set(c.edge, [f]); }
  // Plane of a planar face (unit normal, offset) for merging coplanar neighbours.
  const planeOf = (id: string): [Vec3, number] | null => {
    const f = meshFace.get(id)!; if (f.kind !== 'planar') return null;
    const v = f.vertexOffset * 3, n: Vec3 = [N[v], N[v + 1], N[v + 2]]; return [n, n[0] * P[v] + n[1] * P[v + 1] + n[2] * P[v + 2]];
  };
  const coplanar = (a: string, b: string) => {
    const pa = planeOf(a), pb = planeOf(b); if (!pa || !pb) return false;
    return dot(pa[0], pb[0]) > 1 - 1e-9 && Math.abs(pa[1] - pb[1]) < 1e-6 * Math.max(1, Math.abs(pa[1]));
  };
  const parent = new Map(brep.faces.map(f => [f.id, f.id])), find = (f: string): string => { while (parent.get(f) !== f) f = parent.get(f)!; return f; };
  const sameNamed = (a: string, b: string) => baseName(nameOf.get(a)) !== '' && baseName(nameOf.get(a)) === baseName(nameOf.get(b));
  for (const [, fs] of facesOfEdge) if (fs.length === 2 && fs[0] !== fs[1] && (coplanar(fs[0], fs[1]) || sameNamed(fs[0], fs[1]))) parent.set(find(fs[0]), find(fs[1]));
  const groups = new Map<string, string[]>();
  for (const f of brep.faces) { const r = find(f.id), l = groups.get(r); if (l) l.push(f.id); else groups.set(r, [f.id]); }
  const faceById = new Map(brep.faces.map(f => [f.id, f]));

  const b = newBuilder(), displayOf = new Map<string, number>();
  for (const [root, members] of groups) {
    const pos: number[] = [], nor: number[] = [], idx: number[] = [];
    for (const id of members) {
      const f = meshFace.get(id)!, base = pos.length / 3;
      for (let k = f.vertexOffset * 3; k < (f.vertexOffset + f.vertexCount) * 3; k++) { pos.push(P[k]); nor.push(N[k]); }
      for (let k = f.indexOffset; k < f.indexOffset + f.indexCount; k++) idx.push(mesh.indices[k] - f.vertexOffset + base);
      displayOf.set(id, b.faces.length);
    }
    const names = [...new Set(members.map(m => baseName(nameOf.get(m))))];
    // (A mesh region that is flat shows as a plane: sketches and mates take it; a curved one as curved, no radius.)
    const rootKind = meshFace.get(root)!.kind, flatRegion = rootKind === 'facet' && faceGeometry(faceById.get(root)!).kind === 'plane';
    addFace(b, root, names.length === 1 ? names[0] : members.map(m => nameOf.get(m)!).join('+'), rootKind === 'planar' || flatRegion ? 'plane' : 'curved', pos, nor, idx);
    if (rootKind !== 'planar' && rootKind !== 'facet') {
      // A round face's radius: a cylinder's, or a sphere's (a profile arc centred on its axis).
      const face = faceById.get(root)!;
      let radius: number | undefined;
      try { const g = faceGeometry(face); if (g.kind === 'cylinder') radius = g.r; } catch { /* a general surface */ }
      if (radius === undefined && face.surface.kind === 'surface') { const r = revolutionOf(face.surface, 100); if (r?.profile.kind === 'arc' && Math.abs(r.profile.c[0]) < 1e-9 * (1 + r.profile.r)) radius = r.profile.r; }
      if (radius !== undefined) b.faces[b.faces.length - 1].radius = radius;
    }
  }

  // Vertex normal of a B-rep face at a position, to hide smooth (tangent) joints.
  const normalAt = (faceId: string, p: Vec3): Vec3 | null => {
    const f = meshFace.get(faceId)!;
    // (A mesh region's edges are its creases, drawn: no search through its vertices.)
    if (f.kind === 'facet') return null;
    for (let v = f.vertexOffset; v < f.vertexOffset + f.vertexCount; v++) if (P[v * 3] === p[0] && P[v * 3 + 1] === p[1] && P[v * 3 + 2] === p[2]) return [N[v * 3], N[v * 3 + 1], N[v * 3 + 2]];
    return null;
  };
  // (The display edges by the pair of faces they run between, in the order made: a piece's mate is looked for among its
  // pair's alone — the first that fits, as a walk over all of them finds it; PERF3 C17.)
  const edges: DisplayEdge[] = [], lines: number[] = [], segmentEdge: number[] = [], byPair = new Map<number, DisplayEdge[]>(), F = brep.faces.length + 1;
  const curves = new Map(brep.edges.map(e => [e.id, e.curve])), edgeName = new Map(brep.edges.map(e => [e.id, e.name ?? e.id]));
  for (const e of mesh.edges) {
    const fs = facesOfEdge.get(e.edgeId) ?? [], pts: Vec3[] = [];
    for (let k = 0; k < e.pointsMM.length; k += 3) pts.push([e.pointsMM[k], e.pointsMM[k + 1], e.pointsMM[k + 2]]);
    if (fs.length !== 2 || find(fs[0]) === find(fs[1])) continue; // a seam, or between merged coplanar faces
    const mid = pts[Math.floor(pts.length / 2)], na = normalAt(fs[0], mid), nb = normalAt(fs[1], mid);
    if (na && nb && dot(na, nb) > Math.cos(Math.PI / 9)) continue; // tangent joint
    const curve = curves.get(e.edgeId)!, straight = curve.degree === 1 && curve.controlPoints.length === 2;
    const a = pts[0], z = pts[pts.length - 1], dir = norm(sub(z, a)), fa = displayOf.get(fs[0])!, fb = displayOf.get(fs[1])!;
    // Pieces between the same two faces show as one edge: collinear straight pieces (grid vertices split
    // them), and curved pieces joined end to end (a circle in halves).
    const key = fa < fb ? fa * F + fb : fb * F + fa, same = byPair.get(key);
    let mate: DisplayEdge | undefined;
    if (same) for (const d of same) if (straight ? d.straight && len(cross(norm(sub(d.b, d.a)), dir)) < 1e-9 && len(cross(sub(a, d.a), dir)) < 1e-6 : !d.straight && (near(d.a, a) || near(d.a, z) || near(d.b, a) || near(d.b, z))) { mate = d; break; }
    if (mate) {
      if (straight) {
        const ext = [mate.a, mate.b, a, z], d0 = norm(sub(mate.b, mate.a)), t = ext.map(p => dot(sub(p, mate.a), d0));
        mate.a = ext[t.indexOf(Math.min(...t))]; mate.b = ext[t.indexOf(Math.max(...t))];
      } else {
        // Keep the chain's two free ends (a closed chain has none left; its ends then coincide).
        const ends = [mate.a, mate.b, a, z].filter((p, k, all) => all.filter(q => near(p, q)).length === 1);
        if (ends.length === 2) [mate.a, mate.b] = ends; else mate.b = mate.a;
      }
      mate.names.push(edgeName.get(e.edgeId)!);
      for (let k = 0; k + 1 < pts.length; k++) { pushSegment(lines, pts[k], pts[k + 1]); segmentEdge.push(mate.index, mate.index); }
      continue;
    }
    const axis = straight ? (['x', 'y', 'z'] as const).find((_, k) => Math.abs(Math.abs(dir[k]) - 1) < 1e-9) ?? null : null;
    const index = edges.length;
    const made: DisplayEdge = { index, faces: [fa, fb], a, b: z, straight, axis, names: [edgeName.get(e.edgeId)!] };
    edges.push(made); if (same) same.push(made); else byPair.set(key, [made]);
    for (let k = 0; k + 1 < pts.length; k++) { pushSegment(lines, pts[k], pts[k + 1]); segmentEdge.push(index, index); }
  }
  const positions = new Float32Array(b.p), normals = new Float32Array(b.n), faceOfVertex = new Float32Array(b.f), indices = new Uint32Array(b.i);
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < positions.length; v += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], positions[v + k]); max[k] = Math.max(max[k], positions[v + k]); }
  return { positions, normals, faceOfVertex, indices, faces: b.faces, edgeLines: new Float32Array(lines), edgeOfSegment: new Float32Array(segmentEdge), edges, bounds: { min, max } };
}

const vec = (a: ArrayLike<number>, i: number): Vec3 => [a[i * 3], a[i * 3 + 1], a[i * 3 + 2]];

/**
 * A display mesh straight from triangles (one face, named `name`; no edges): a SubD cage's preview while it is dragged,
 * or the cage itself in Box mode (R8.2, D81). `normals` null: each triangle's own (flat).
 */
export function triangleMesh(positions: ArrayLike<number>, indices: ArrayLike<number>, normals: ArrayLike<number> | null, name: string): DisplayMesh {
  const b = newBuilder();
  if (normals) addFace(b, name, name, 'curved', positions, normals, indices);
  else {
    // (Flat: every triangle its own corners, so each keeps its normal.)
    const p: number[] = [], idx: number[] = [];
    for (let t = 0; t < indices.length; t++) { const v = indices[t]; p.push(positions[3 * v], positions[3 * v + 1], positions[3 * v + 2]); idx.push(t); }
    const n: number[] = [];
    for (let t = 0; t < idx.length; t += 3) { const a = vec(p, t), c = vec(p, t + 1), d = vec(p, t + 2), m = norm(cross(sub(c, a), sub(d, a))); n.push(...m, ...m, ...m); }
    addFace(b, name, name, 'plane', p, n, idx);
  }
  const P = new Float32Array(b.p), min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < P.length; v += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], P[v + k]); max[k] = Math.max(max[k], P[v + k]); }
  return { positions: P, normals: new Float32Array(b.n), faceOfVertex: new Float32Array(b.f), indices: new Uint32Array(b.i), faces: b.faces, edgeLines: new Float32Array(0), edgeOfSegment: new Float32Array(0), edges: [], bounds: { min, max } };
}
