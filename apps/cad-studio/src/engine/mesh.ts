// Turns a kernel B-rep into one display mesh: tessellateBrep (watertight, one sampling per edge).
// Display faces are B-rep faces, with coplanar neighbours and the pieces of one named face (`x#1`,
// `x#2`: a cylinder wall in halves) shown as one face; display edges are the real B-rep edges minus
// seams and smooth (tangent) joints, with connected pieces between the same two faces joined. Faces and
// edges carry their persistent B-rep names, which features use to refer to them.
import { faceGeometry, revolutionOf, surfaceDomain, surfaceEvaluator, tessellateBrep, type Brep, type BrepFace, type BrepMesh } from '@barocss/cad';
export { sub, cross, dot, len, unit as norm } from './vec3';
import { sub, cross, dot, len, unit as norm } from './vec3';

export type Vec3 = [number, number, number];

/** `radius`: a cylinder's or a sphere's. */
export interface DisplayFace { index: number; id: string; name: string; kind: 'plane' | 'curved'; normal: Vec3; centroid: Vec3; areaMM2: number; radius?: number; /** A mesh region (its triangles are the surface: no chord error, A6.3). */ facet?: true;
  /** The face's exact surface where the kernel knows it (A6.3: datums and measures to rounding, not to the Float32 mesh): a plane (a point, the normal out of the face) or a cylinder (a point on the axis, its direction, the radius). */
  exact?: { kind: 'plane'; o: Vec3; n: Vec3 } | { kind: 'cylinder'; c: Vec3; a: Vec3; r: number };
  /** A curved face of constant curvature along its circles — a cylinder, sphere, cone or torus (A6.3: the edge-sag bound holds, O55). */
  analytic?: true;
  /** A freeform curved face (a NURBS or SubD patch, its curvature varying inside a triangle; O59): its B-rep faces, measured on request. */
  freeform?: string[];
  /** A freeform face's chord depth (mm), measured against its exact surface at sampled points by measureChords (O59). */
  chordMM?: number }
export interface DisplayEdge { index: number; faces: [number, number]; a: Vec3; b: Vec3; straight: boolean; axis: 'x' | 'y' | 'z' | null; names: string[] }
export interface DisplayMesh {
  positions: Float32Array; normals: Float32Array; faceOfVertex: Float32Array; indices: Uint32Array;
  faces: DisplayFace[]; edgeLines: Float32Array; edgeOfSegment: Float32Array; edges: DisplayEdge[];
  bounds: { min: Vec3; max: Vec3 };
  /** The tessellation's segments per quarter turn (bodyMesh's quality): measureChords re-tessellates at it. */
  quality?: number;
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
    if (rootKind === 'facet') b.faces[b.faces.length - 1].facet = true;
    else if (rootKind === 'planar') {
      // (The exact plane, A6.3, from the face's own control points — cheap, no surface recognition: a point, and the
      // normal of the widest triangle of them, turned out of the face as the display normal is.)
      const sf = faceById.get(root)!.surface, df = b.faces[b.faces.length - 1];
      if (sf.kind === 'surface') { const pl = planeOfPoints(sf.controlPoints); if (pl) { const sg = pl.n[0] * df.normal[0] + pl.n[1] * df.normal[1] + pl.n[2] * df.normal[2] < 0 ? -1 : 1; df.exact = { kind: 'plane', o: pl.o, n: [pl.n[0] * sg, pl.n[1] * sg, pl.n[2] * sg] }; } }
    }
    if (rootKind !== 'planar' && rootKind !== 'facet') {
      // A round face's radius: a cylinder's, or a sphere's (a profile arc centred on its axis).
      const face = faceById.get(root)!;
      let radius: number | undefined;
      try { const g = faceGeometry(face); if (g.kind === 'cylinder') { radius = g.r; b.faces[b.faces.length - 1].exact = { kind: 'cylinder', c: [g.c[0], g.c[1], g.c[2]], a: [g.a[0], g.a[1], g.a[2]], r: g.r }; } } catch { /* a general surface */ }
      if (radius === undefined && face.surface.kind === 'surface') { const r = revolutionOf(face.surface, 100); if (r?.profile.kind === 'arc' && Math.abs(r.profile.c[0]) < 1e-9 * (1 + r.profile.r)) radius = r.profile.r; }
      if (radius !== undefined) b.faces[b.faces.length - 1].radius = radius;
      // (O59: the edge-sag bound is exact only at constant curvature along circles; a freeform face is measured instead.)
      const df = b.faces[b.faces.length - 1];
      // (Measured only on request, measureChords: twenty times the tessellation's own time.)
      if (members.every(id => analyticFace(faceById.get(id)!))) df.analytic = true; else df.freeform = [...members];
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
      } else if (!near(a, z)) {
        // Keep the chain's two free ends (a closed chain has none left; its ends then coincide). (A piece shorter than
        // `near` — a general fillet's end meeting a face tangentially, D90 — joins as a point: the ends stay.)
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
  return { positions, normals, faceOfVertex, indices, faces: b.faces, edgeLines: new Float32Array(lines), edgeOfSegment: new Float32Array(segmentEdge), edges, bounds: { min, max }, quality };
}

/** Whether a mesh has a freeform face not yet measured (chordOf takes it as unbounded until measureChords runs). */
export const unmeasured = (m: DisplayMesh): boolean => m.faces.some(f => f.freeform !== undefined && f.chordMM === undefined);
/**
 * Each freeform face's chord depth measured against its exact surface (O59), from the B-rep the mesh was made of: the
 * B-rep tessellated again at the mesh's quality (the same triangles), then sampledChord on each of its faces. The mesh's
 * faces get `chordMM`; a rigid placement of the mesh keeps it (depth is invariant).
 */
export function measureChords(m: DisplayMesh, brep: Brep): void {
  if (!unmeasured(m)) return;
  const mesh = tessellateBrep(brep, { segmentsPerQuarter: m.quality ?? 8 }), meshFace = new Map(mesh.faces.map(f => [f.faceId, f])), faceById = new Map(brep.faces.map(f => [f.id, f]));
  for (const f of m.faces) {
    if (!f.freeform || f.chordMM !== undefined) continue;
    let c = 0;
    for (const id of f.freeform) { const bf = faceById.get(id), mf = meshFace.get(id); c = bf && mf ? Math.max(c, sampledChord(bf, mf, mesh)) : Infinity; if (c === Infinity) break; }
    f.chordMM = c;
  }
}

/** A face of constant curvature along its circles: a cylinder, or a surface of revolution of a line or an arc (cone, sphere, torus). */
function analyticFace(face: BrepFace): boolean {
  try { const g = faceGeometry(face); if (g.kind === 'cylinder' || g.kind === 'plane') return true; } catch { /* a general surface */ }
  if (face.surface.kind !== 'surface') return false;
  const r = revolutionOf(face.surface, 100); return r !== null && (r.profile.kind === 'arc' || r.profile.kind === 'line');
}
/** The barycentric sample points of a triangle on an order-8 grid, its corners left out (42 points: λ₁, λ₂, λ₃, and 1 for
 * those on the order-4 grid — the 12 where the nearest point is also found by Gauss–Newton). */
const SAMPLES: readonly (readonly [number, number, number, number])[] = (() => { const o: [number, number, number, number][] = []; for (let i = 0; i <= 8; i++) for (let j = 0; i + j <= 8; j++) { const k = 8 - i - j; if (i === 8 || j === 8 || k === 8) continue; o.push([i / 8, j / 8, k / 8, i % 2 === 0 && j % 2 === 0 ? 1 : 0]); } return o; })();
/** The sampled depth's safety factor (O59): sampling may miss a peak between points; the worst shortfall measured was 2 %. */
export const CHORD_SAFETY = 1.25;
const UV = new Float64Array(2);
/**
 * A freeform face's chord depth (O59): its vertices' (u, v) on the exact surface by Gauss–Newton, then at 42 points of each
 * triangle the distance both ways — the triangle's point to the surface (its nearest, by Gauss–Newton from the
 * interpolated (u, v), at the 12 of them on the order-4 grid), and the surface's point there to the triangle's one-ring.
 * The max over them, times CHORD_SAFETY: sampled, not a bound, so chordOf takes it with the quadratic model's. Infinity
 * when a vertex cannot be put on the surface (to 10⁻⁷ of its size), or the face is not a parametric one.
 */
function sampledChord(face: BrepFace, mf: { vertexOffset: number; vertexCount: number; indexOffset: number; indexCount: number; kind: string }, mesh: BrepMesh): number {
  if (face.surface.kind !== 'surface' || mf.kind === 'facet') return Infinity;
  const S = surfaceEvaluator(face.surface), dom = surfaceDomain(face.surface), P = mesh.positionsMM, n = mf.vertexCount, uv = new Float64Array(n * 2);
  let size = 0; for (let v = mf.vertexOffset; v < mf.vertexOffset + n; v++) size = Math.max(size, Math.abs(P[v * 3]), Math.abs(P[v * 3 + 1]), Math.abs(P[v * 3 + 2]));
  const tol = 1e-7 * (1 + size);
  let su = (dom.u[0] + dom.u[1]) / 2, sv = (dom.v[0] + dom.v[1]) / 2;
  for (let i = 0; i < n; i++) {
    const at = (mf.vertexOffset + i) * 3;
    let res = invertOn(S, dom, P[at], P[at + 1], P[at + 2], su, sv);
    if (res > tol) { nearestOnGrid(S, dom, P[at], P[at + 1], P[at + 2]); res = invertOn(S, dom, P[at], P[at + 1], P[at + 2], UV[0], UV[1]); }
    if (res > tol) return Infinity;
    uv[i * 2] = UV[0]; uv[i * 2 + 1] = UV[1]; su = UV[0]; sv = UV[1];
  }
  // (Each vertex's triangles, for a surface point's nearest among a triangle's one-ring: the interpolated (u, v) of an
  // uneven parametrization — a SubD cap's — lands over a neighbour.)
  const start = new Int32Array(n + 1), I = mesh.indices, o = mf.vertexOffset;
  for (let t = mf.indexOffset; t < mf.indexOffset + mf.indexCount; t++) start[I[t] - o + 1]++;
  for (let i = 0; i < n; i++) start[i + 1] += start[i];
  const fill = start.slice(0, n), ring = new Int32Array(mf.indexCount);
  for (let t = mf.indexOffset; t < mf.indexOffset + mf.indexCount; t++) ring[fill[I[t] - o]++] = t - (t - mf.indexOffset) % 3;
  let worst = 0;
  for (let t = mf.indexOffset; t < mf.indexOffset + mf.indexCount; t += 3) {
    const a = mesh.indices[t] - mf.vertexOffset, b = mesh.indices[t + 1] - mf.vertexOffset, c = mesh.indices[t + 2] - mf.vertexOffset;
    const pa = (mf.vertexOffset + a) * 3, pb = (mf.vertexOffset + b) * 3, pc = (mf.vertexOffset + c) * 3;
    for (const [l1, l2, l3, coarse] of SAMPLES) {
      // (Both ways: the triangle's point to the surface, its nearest by Gauss–Newton from the interpolated (u, v); the
      // surface's point there to the triangle.)
      const u = l1 * uv[a * 2] + l2 * uv[b * 2] + l3 * uv[c * 2], v = l1 * uv[a * 2 + 1] + l2 * uv[b * 2 + 1] + l3 * uv[c * 2 + 1], q = S(u, v);
      const x = l1 * P[pa] + l2 * P[pb] + l3 * P[pc], y = l1 * P[pa + 1] + l2 * P[pb + 1] + l3 * P[pc + 1], z = l1 * P[pa + 2] + l2 * P[pb + 2] + l3 * P[pc + 2];
      const d = Math.max(coarse ? invertOn(S, dom, x, y, z, u, v, 8) : 0, ringDistance(q[0], q[1], q[2], P, I, start, ring, o, a, b, c));
      if (d > worst) worst = d;
    }
  }
  return worst * CHORD_SAFETY;
}
/** A point's distance to the nearest triangle around the corners a, b, c (local vertices; `start`/`ring`: each vertex's triangles). */
function ringDistance(x: number, y: number, z: number, P: ArrayLike<number>, I: ArrayLike<number>, start: Int32Array, ring: Int32Array, o: number, a: number, b: number, c: number): number {
  let best = Infinity;
  for (let j = 0; j < 3; j++) { const v = j === 0 ? a : j === 1 ? b : c; for (let k = start[v]; k < start[v + 1]; k++) { const t = ring[k], d = pointTriangle(x, y, z, P, I[t] * 3, I[t + 1] * 3, I[t + 2] * 3); if (d < best) best = d; } }
  return best;
}
/** A point's distance to the triangle a, b, c of P (offsets): the nearest of its face, edges and corners (Ericson's regions). */
function pointTriangle(px: number, py: number, pz: number, P: ArrayLike<number>, a: number, b: number, c: number): number {
  const abx = P[b] - P[a], aby = P[b + 1] - P[a + 1], abz = P[b + 2] - P[a + 2], acx = P[c] - P[a], acy = P[c + 1] - P[a + 1], acz = P[c + 2] - P[a + 2];
  const apx = px - P[a], apy = py - P[a + 1], apz = pz - P[a + 2];
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  let qx: number, qy: number, qz: number;
  const bpx = px - P[b], bpy = py - P[b + 1], bpz = pz - P[b + 2], d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
  const cpx = px - P[c], cpy = py - P[c + 1], cpz = pz - P[c + 2], d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
  const vc = d1 * d4 - d3 * d2, vb = d5 * d2 - d1 * d6, va = d3 * d6 - d5 * d4;
  if (d1 <= 0 && d2 <= 0) { qx = P[a]; qy = P[a + 1]; qz = P[a + 2]; }
  else if (d3 >= 0 && d4 <= d3) { qx = P[b]; qy = P[b + 1]; qz = P[b + 2]; }
  else if (d6 >= 0 && d5 <= d6) { qx = P[c]; qy = P[c + 1]; qz = P[c + 2]; }
  else if (vc <= 0 && d1 >= 0 && d3 <= 0) { const t = d1 / (d1 - d3); qx = P[a] + t * abx; qy = P[a + 1] + t * aby; qz = P[a + 2] + t * abz; }
  else if (vb <= 0 && d2 >= 0 && d6 <= 0) { const t = d2 / (d2 - d6); qx = P[a] + t * acx; qy = P[a + 1] + t * acy; qz = P[a + 2] + t * acz; }
  else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const t = (d4 - d3) / ((d4 - d3) + (d5 - d6)); qx = P[b] + t * (P[c] - P[b]); qy = P[b + 1] + t * (P[c + 1] - P[b + 1]); qz = P[b + 2] + t * (P[c + 2] - P[b + 2]); }
  else { const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; qx = P[a] + abx * v + acx * w; qy = P[a + 1] + aby * v + acy * w; qz = P[a + 2] + abz * v + acz * w; }
  return Math.hypot(px - qx, py - qy, pz - qz);
}
/** A point's (u, v) on a surface by Gauss–Newton from (u, v), central differences, clamped to the domain: into UV; the residual. */
function invertOn(S: (u: number, v: number) => readonly number[], dom: { u: [number, number]; v: [number, number] }, x: number, y: number, z: number, u: number, v: number, iterations = 40): number {
  const hu = 1e-6 * (dom.u[1] - dom.u[0]), hv = 1e-6 * (dom.v[1] - dom.v[0]);
  let res = Infinity;
  for (let it = 0; it < iterations; it++) {
    const p = S(u, v), rx = p[0] - x, ry = p[1] - y, rz = p[2] - z; res = Math.hypot(rx, ry, rz);
    const u0 = Math.max(dom.u[0], u - hu), u1 = Math.min(dom.u[1], u + hu), v0 = Math.max(dom.v[0], v - hv), v1 = Math.min(dom.v[1], v + hv);
    const a = S(u1, v), b = S(u0, v), c = S(u, v1), d = S(u, v0);
    const sx = (a[0] - b[0]) / (u1 - u0), sy = (a[1] - b[1]) / (u1 - u0), sz = (a[2] - b[2]) / (u1 - u0), tx = (c[0] - d[0]) / (v1 - v0), ty = (c[1] - d[1]) / (v1 - v0), tz = (c[2] - d[2]) / (v1 - v0);
    const g11 = sx * sx + sy * sy + sz * sz, g12 = sx * tx + sy * ty + sz * tz, g22 = tx * tx + ty * ty + tz * tz, r1 = -(rx * sx + ry * sy + rz * sz), r2 = -(rx * tx + ry * ty + rz * tz);
    const reg = 1e-12 * (g11 + g22), det = (g11 + reg) * (g22 + reg) - g12 * g12;
    if (!(det > 0)) break;
    const du = (r1 * (g22 + reg) - g12 * r2) / det, dv = ((g11 + reg) * r2 - g12 * r1) / det;
    const nu = Math.max(dom.u[0], Math.min(dom.u[1], u + du)), nv = Math.max(dom.v[0], Math.min(dom.v[1], v + dv));
    if (Math.abs(nu - u) <= 1e-15 * (1 + Math.abs(u)) && Math.abs(nv - v) <= 1e-15 * (1 + Math.abs(v))) { u = nu; v = nv; break; }
    u = nu; v = nv;
  }
  const p = S(u, v); UV[0] = u; UV[1] = v;
  return Math.min(res, Math.hypot(p[0] - x, p[1] - y, p[2] - z));
}
/** The nearest of a 24 × 24 grid of the surface's domain to a point: into UV (a start for invertOn). */
function nearestOnGrid(S: (u: number, v: number) => readonly number[], dom: { u: [number, number]; v: [number, number] }, x: number, y: number, z: number): void {
  let best = Infinity;
  for (let i = 0; i <= 24; i++) for (let j = 0; j <= 24; j++) {
    const u = dom.u[0] + (dom.u[1] - dom.u[0]) * i / 24, v = dom.v[0] + (dom.v[1] - dom.v[0]) * j / 24, p = S(u, v), d = (p[0] - x) ** 2 + (p[1] - y) ** 2 + (p[2] - z) ** 2;
    if (d < best) { best = d; UV[0] = u; UV[1] = v; }
  }
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

/** A plane through a planar face's control points (A6.3): the first point, and the unit normal of the widest triangle
 * it makes with two others (the farthest point, then the one farthest from that line); null if they are collinear. */
function planeOfPoints(grid: readonly (readonly (readonly number[])[])[]): { o: Vec3; n: Vec3 } | null {
  const o = grid[0]?.[0]; if (!o) return null;
  let a: readonly number[] | null = null, best = 0;
  for (const row of grid) for (const p of row) { const d = (p[0] - o[0]) ** 2 + (p[1] - o[1]) ** 2 + (p[2] - o[2]) ** 2; if (d > best) { best = d; a = p; } }
  if (!a) return null;
  const u0 = a[0] - o[0], u1 = a[1] - o[1], u2 = a[2] - o[2];
  let n0 = 0, n1 = 0, n2 = 0, area = 0;
  for (const row of grid) for (const p of row) { const v0 = p[0] - o[0], v1 = p[1] - o[1], v2 = p[2] - o[2], c0 = u1 * v2 - u2 * v1, c1 = u2 * v0 - u0 * v2, c2 = u0 * v1 - u1 * v0, k = c0 * c0 + c1 * c1 + c2 * c2; if (k > area) { area = k; n0 = c0; n1 = c1; n2 = c2; } }
  const l = Math.sqrt(area); if (!(l > 0)) return null;
  return { o: [o[0], o[1], o[2]], n: [n0 / l, n1 / l, n2 / l] };
}
