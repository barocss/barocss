// A closed triangle mesh (an STL or OBJ file's) as a planar B-rep solid: its corners welded, triangles
// that lie flat against each other merged into one face (a box comes in as six faces, not twelve
// triangles), each face bounded by the mesh edges round it (outer loop and holes). The mesh must close:
// every edge between exactly two triangles, running opposite ways in them; it is turned outward when it
// faces in. Nothing is repaired or smoothed — a curved surface stays as its facets.
import { assertValidBrep, buildBrep, lineCurve, type Brep, type BrepFaceInput } from '../brep/brep-core.js';
import type { Point, Surface } from '../types.js';
import { binary64Dyadic } from '../core/dyadic.js';
import { add, cross, dot, sub } from '../core/vec3.js';
import { isFrom, kernelRefusal, type KernelError } from '../core/barocss-error.js';

/** This module's refusal (R7.3a batch 2: the MeshBrepError class folded, D279): a BarocssError, `details.source` 'mesh-brep'. */
export const meshBrepError = (message: string) => kernelRefusal('mesh-brep', 'MESH_BREP', message) as KernelError & { readonly code: 'MESH_BREP' };
/** Whether something thrown is this module's refusal. */
export const isMeshBrepError = (e: unknown): e is KernelError & { readonly code: 'MESH_BREP' } => isFrom<'MESH_BREP'>(e, 'mesh-brep');

export interface MeshBrepOptions {
  /** The body's id (a letter, then letters, digits, _ or -; also the faces' names' prefix). */
  readonly id?: string;
  /** Corners closer than this (mm) are one vertex; default 1e-6 of the mesh's size. */
  readonly weldMM?: number;
  /** At most this many triangles (default 200 000). */
  readonly maximumTriangles?: number;
  /** Per input triangle, a group: coplanar triangles join into one face only within a group (brepFromTriangles). */
  readonly groups?: ArrayLike<number>;
  /** Group g's faces' name, in place of `<id>.facet<k>`: the first face so, any further one `#k` (brepFromTriangles). */
  readonly groupName?: (group: number) => string;
}

/** The mesh (x, y, z per vertex; three vertex indices per triangle, or every three vertices one) as a B-rep. */
export function brepFromTriangles(positions: ArrayLike<number>, indices: ArrayLike<number> | null, options: MeshBrepOptions = {}): Brep {
  const id = (options.id ?? 'mesh').replace(/[^A-Za-z0-9_-]/g, '_').replace(/^(?=[^A-Za-z_])/, '_'), n = positions.length / 3, count = indices ? indices.length / 3 : n / 3;
  if (!Number.isInteger(n) || !Number.isInteger(count)) throw meshBrepError('the mesh needs three numbers per vertex and three vertices per triangle');
  if (count > (options.maximumTriangles ?? 200_000)) throw meshBrepError(`the mesh has ${count} triangles, more than the ${options.maximumTriangles ?? 200_000} read`);
  let size = 0;
  for (let i = 0; i < positions.length; i++) { if (!Number.isFinite(positions[i])) throw meshBrepError('the mesh has a coordinate that is not a finite number'); size = Math.max(size, Math.abs(positions[i])); }
  // Weld: corners on one grid cell of the weld size are one vertex.
  const weld = options.weldMM ?? Math.max(1e-9, size * 1e-6), cell = new Map<string, number>(), points: Point[] = [], remap = new Int32Array(n);
  for (let v = 0; v < n; v++) {
    const x = positions[3 * v], y = positions[3 * v + 1], z = positions[3 * v + 2], key = `${Math.round(x / weld)},${Math.round(y / weld)},${Math.round(z / weld)}`;
    let k = cell.get(key); if (k === undefined) { k = points.length; points.push([x, y, z]); cell.set(key, k); }
    remap[v] = k;
  }
  // Triangles, without the degenerate ones (a repeated corner or no area).
  const tris: [number, number, number][] = [], normals: Point[] = [], group: number[] = [];
  for (let t = 0; t < count; t++) {
    const a = remap[indices ? indices[3 * t] : 3 * t], b = remap[indices ? indices[3 * t + 1] : 3 * t + 1], c = remap[indices ? indices[3 * t + 2] : 3 * t + 2];
    if (a === b || b === c || a === c) continue;
    const nrm = cross(sub(points[b], points[a]), sub(points[c], points[a])), l = Math.hypot(...nrm);
    if (!(l > weld * weld)) continue;
    tris.push([a, b, c]); normals.push([nrm[0] / l, nrm[1] / l, nrm[2] / l]); group.push(options.groups ? options.groups[t] ?? -1 : -1);
  }
  if (tris.length < 4) throw meshBrepError('the mesh has fewer than four triangles with area: it encloses nothing');
  // Closed and consistently wound: each directed edge once, its reverse once.
  const directed = new Map<string, number>(), ek = (a: number, b: number) => `${a}>${b}`;
  tris.forEach(([a, b, c], t) => { for (const [p, q] of [[a, b], [b, c], [c, a]]) { const k = ek(p, q); if (directed.has(k)) throw meshBrepError('the mesh is not consistently wound (two triangles run one edge the same way) or an edge has more than two triangles'); directed.set(k, t); } });
  let open = 0; for (const k of directed.keys()) { const [p, q] = k.split('>'); if (!directed.has(`${q}>${p}`)) open++; }
  if (open) throw meshBrepError(`the mesh is not closed: ${open} edge${open === 1 ? '' : 's'} with a triangle on one side only`);
  // Outward: a positive enclosed volume (else every triangle is turned over).
  let vol = 0; for (const [a, b, c] of tris) vol += dot(points[a], cross(points[b], points[c]));
  const flip = vol < 0;
  if (flip) for (let t = 0; t < tris.length; t++) { const [a, b, c] = tris[t]; tris[t] = [a, c, b]; normals[t] = [-normals[t][0], -normals[t][1], -normals[t][2]]; }
  if (flip) { directed.clear(); tris.forEach(([a, b, c], t) => { for (const [p, q] of [[a, b], [b, c], [c, a]]) directed.set(ek(p, q), t); }); }
  // Faces: triangles joined across an edge when they lie in one plane (normals within 1e-9, the far corner on the plane).
  const face = new Int32Array(tris.length).fill(-1), groups: number[][] = [], flat = 1e-9, onPlane = weld * 4;
  for (let s = 0; s < tris.length; s++) {
    if (face[s] >= 0) continue;
    const g = groups.length, members = [s], nrm = normals[s], d0 = dot(nrm, points[tris[s][0]]);
    face[s] = g;
    for (let i = 0; i < members.length; i++) {
      const [a, b, c] = tris[members[i]];
      for (const [p, q] of [[a, b], [b, c], [c, a]]) {
        const t = directed.get(ek(q, p))!;
        if (face[t] >= 0 || group[t] !== group[s] || 1 - dot(normals[t], nrm) > flat || !tris[t].every(v => Math.abs(dot(nrm, points[v]) - d0) <= onPlane)) continue;
        // (Merged only when exactly in the seed's plane: an exact Boolean checks a face's corners exactly.)
        if (!tris[t].every(v => coplanar(points[tris[s][0]], points[tris[s][1]], points[tris[s][2]], points[v]))) continue;
        face[t] = g; members.push(t);
      }
    }
    groups.push(members);
  }
  // Edges: one per pair of vertices between two different faces; each face's boundary chained into loops.
  const edgeId = new Map<string, string>(), edges: { id: string; curve: ReturnType<typeof lineCurve>; vertices: readonly [string, string] }[] = [];
  const vid = (v: number) => `v${v}`, used = new Set<number>(), named = new Map<string, number>();
  const nameOf = (g: number) => {
    if (!options.groupName || group[groups[g][0]] < 0) return `${id}.facet${g}`;
    const base = options.groupName(group[groups[g][0]]), k = named.get(base) ?? 0; named.set(base, k + 1);
    return k ? `${base}#${k + 1}` : base;
  };
  const faces: BrepFaceInput[] = groups.map((members, g) => {
    const out = new Map<number, number[]>();
    for (const t of members) { const [a, b, c] = tris[t]; for (const [p, q] of [[a, b], [b, c], [c, a]]) if (face[directed.get(ek(q, p))!] !== g) { const list = out.get(p); if (list) list.push(q); else out.set(p, [q]); } }
    const loops: number[][] = [];
    for (const start of out.keys()) {
      while (out.get(start)?.length) {
        const loop = [start]; let at = out.get(start)!.pop()!;
        for (let guard = 0; at !== start && guard <= tris.length * 3; guard++) { loop.push(at); const next = out.get(at); if (!next?.length) throw meshBrepError('a face boundary does not close'); at = next.pop()!; }
        loops.push(loop);
      }
    }
    // The outer loop: the one enclosing the most area (anticlockwise about the face's normal); the rest are holes.
    const nrm = normals[members[0]], area = (l: number[]) => dot(nrm, l.reduce((s, v, k) => add(s, cross(points[v], points[l[(k + 1) % l.length]])), [0, 0, 0] as Point)) / 2;
    loops.sort((x, y) => area(y) - area(x));
    const use = (p: number, q: number) => {
      used.add(p); used.add(q);
      const lo = Math.min(p, q), hi = Math.max(p, q), key = `${lo}-${hi}`;
      let e = edgeId.get(key);
      if (!e) { e = `${id}_e${edges.length}`; edgeId.set(key, e); edges.push({ id: e, curve: lineCurve(e, points[lo], points[hi]), vertices: [vid(lo), vid(hi)] }); }
      return { edge: e, sense: (p === lo ? 'forward' : 'reversed') as 'forward' | 'reversed' };
    };
    return { id: `${id}_f${g}`, name: nameOf(g), surface: planeSurface(`${id}_p${g}`, nrm, loops.flat().map(v => points[v])), sense: 'forward',
      loops: loops.map((l, k) => ({ kind: k === 0 ? 'outer' as const : 'inner' as const, uses: l.map((v, i) => use(v, l[(i + 1) % l.length])) })) };
  });
  const brep = buildBrep({ source: { family: 'mesh', id }, vertices: [...used].sort((a, b) => a - b).map(v => ({ id: vid(v), point: points[v] })), edges,
    bodies: [{ id, kind: 'solid', shells: [{ id: `${id}_shell`, faces, closed: true }] }] });
  assertValidBrep(brep);
  return brep;
}

/** Whether four points lie exactly in one plane (the determinant worked out exactly from their binary values). */
function coplanar(a: Point, b: Point, c: Point, d: Point): boolean {
  const q = [a, b, c, d].map(p => p.map(binary64Dyadic)), k = Math.max(...q.flat().map(x => x.k));
  const [A, B, C, D] = q.map(p => p.map(x => x.m << BigInt(k - x.k)));
  const u = [0, 1, 2].map(i => B[i] - A[i]), v = [0, 1, 2].map(i => C[i] - A[i]), w = [0, 1, 2].map(i => D[i] - A[i]);
  return u[0] * (v[1] * w[2] - v[2] * w[1]) - u[1] * (v[0] * w[2] - v[2] * w[0]) + u[2] * (v[0] * w[1] - v[1] * w[0]) === 0n;
}

/** A planar patch round the points whose ∂S/∂u × ∂S/∂v points along the unit `normal`. */
function planeSurface(id: string, normal: Point, pts: Point[]): Surface {
  const seed: Point = Math.abs(normal[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], c = cross(normal, seed), l = Math.hypot(...c);
  const e1: Point = [c[0] / l, c[1] / l, c[2] / l], e2 = cross(normal, e1), o = pts[0];
  // (A face of a closed mesh is flat to the weld size: its corners are put on the plane through the first.)
  const uv = pts.map(p => { const d = sub(p, o); return [dot(d, e1), dot(d, e2)]; });
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const [u, v] of uv) { if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v; }
  const at = (u: number, v: number): Point => [o[0] + e1[0] * u + e2[0] * v, o[1] + e1[1] * u + e2[1] * v, o[2] + e1[2] * u + e2[2] * v];
  return { kind: 'surface', id, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[at(u0, v0), at(u0, v1)], [at(u1, v0), at(u1, v1)]], weights: [[1, 1], [1, 1]] };
}

/** An STL file's triangles (binary or ASCII) as positions, three vertices per triangle, in the file's units. */
export function readStl(bytes: Uint8Array): Float64Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // Binary: an 80-byte header, the count, 50 bytes a triangle — when the size says so (ASCII files can start with "solid" too).
  if (bytes.length >= 84) {
    const count = view.getUint32(80, true);
    if (84 + count * 50 === bytes.length) {
      const out = new Float64Array(count * 9);
      for (let t = 0; t < count; t++) for (let k = 0; k < 9; k++) out[t * 9 + k] = view.getFloat32(84 + t * 50 + 12 + k * 4, true);
      return out;
    }
  }
  const text = new TextDecoder().decode(bytes);
  if (!/^\s*solid\b/i.test(text)) throw meshBrepError('this is neither a binary STL (its size does not match its triangle count) nor an ASCII one (it does not start with "solid")');
  const values: number[] = [];
  for (const m of text.matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/gi)) values.push(Number(m[1]), Number(m[2]), Number(m[3]));
  if (values.length % 9 || values.some(v => !Number.isFinite(v))) throw meshBrepError('the ASCII STL has a facet without three numeric vertices');
  return Float64Array.from(values);
}

/** An OBJ file's faces (polygons fanned into triangles; texture and normal indices ignored) in the file's units. */
export function readObj(text: string): { positions: number[]; indices: number[] } {
  const positions: number[] = [], indices: number[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('v ')) {
      const [x, y, z] = line.slice(2).trim().split(/\s+/).map(Number);
      if (![x, y, z].every(Number.isFinite)) throw meshBrepError(`the OBJ has a vertex that is not three numbers: ${line}`);
      positions.push(x, y, z);
    } else if (line.startsWith('f ')) {
      const n = positions.length / 3;
      const vs = line.slice(2).trim().split(/\s+/).map(w => { const i = Number(w.split('/')[0]); return i < 0 ? n + i : i - 1; });
      if (vs.length < 3 || vs.some(i => !Number.isInteger(i) || i < 0 || i >= n)) throw meshBrepError(`the OBJ has a face naming a vertex it does not have: ${line}`);
      for (let k = 1; k + 1 < vs.length; k++) indices.push(vs[0], vs[k], vs[k + 1]);
    }
  }
  if (!indices.length) throw meshBrepError('the OBJ has no faces');
  return { positions, indices };
}
