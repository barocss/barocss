// Geometry kept on the CPU (so it can be re-uploaded after a device loss and ray-cast for picking) and
// its vertex data as the viewer uploads it: positions, normals and linear RGBA8 colours.
import { boxOfPositions, type Box3 } from './bounds.js';
import { cross, srgbToLinear, sub, type Vec3 } from './math.js';

export interface GeometryInput {
  /** x, y, z per vertex. */
  positions: ArrayLike<number>;
  /** Per vertex; computed (smooth over shared vertices) when left out. */
  normals?: ArrayLike<number>;
  /** Texture coordinates, two per vertex (for Material.map). */
  uvs?: ArrayLike<number>;
  /** sRGB colours per vertex, 0–1: three (rgb) or four (rgba) numbers each. */
  colors?: ArrayLike<number>;
  /** Triangles (or segment pairs for lines); vertices in order when left out. */
  indices?: ArrayLike<number>;
  /** Triangles (default) or line segments. */
  topology?: 'triangles' | 'lines';
  /** An id per triangle (a CAD face, say), reported by picking. */
  faces?: ArrayLike<number>;
  /** An id per line segment (a CAD edge, say), reported by line picking. */
  edges?: ArrayLike<number>;
}

export interface PreparedGeometry {
  topology: 'triangles' | 'lines';
  positions: Float32Array; normals: Float32Array; colors: Uint8Array; uvs: Float32Array;
  indices: Uint32Array | Uint16Array | null;
  faces: Uint32Array | null;
  edges: Uint32Array | null;
  vertexCount: number; elementCount: number;
  bounds: Box3 | null;
}

export function prepareGeometry(input: GeometryInput): PreparedGeometry {
  const topology = input.topology ?? 'triangles', positions = Float32Array.from(input.positions);
  if (positions.length % 3) throw new RangeError('positions must hold three numbers per vertex');
  const vertexCount = positions.length / 3;
  for (let i = 0; i < positions.length; i++) if (!Number.isFinite(positions[i])) throw new RangeError(`positions[${i}] is not finite`);
  let indices: Uint32Array | Uint16Array | null = null;
  if (input.indices) {
    indices = vertexCount <= 0xffff ? Uint16Array.from(input.indices) : Uint32Array.from(input.indices);
    for (let i = 0; i < indices.length; i++) if (input.indices[i] >= vertexCount || input.indices[i] < 0 || !Number.isInteger(input.indices[i])) throw new RangeError(`indices[${i}] = ${input.indices[i]} is not a vertex`);
  }
  const elementCount = indices ? indices.length : vertexCount, per = topology === 'lines' ? 2 : 3;
  if (elementCount % per) throw new RangeError(`${topology} need a multiple of ${per} ${indices ? 'indices' : 'vertices'}`);
  let normals: Float32Array;
  if (input.normals) {
    normals = Float32Array.from(input.normals);
    if (normals.length !== positions.length) throw new RangeError('normals must match positions');
  } else normals = topology === 'lines' ? new Float32Array(positions.length) : vertexNormals(positions, indices);
  let faces: Uint32Array | null = null;
  if (input.faces) {
    if (topology !== 'triangles' || input.faces.length !== elementCount / 3) throw new RangeError('faces must hold one id per triangle');
    faces = Uint32Array.from(input.faces);
  }
  let edges: Uint32Array | null = null;
  if (input.edges) {
    if (topology !== 'lines' || input.edges.length !== elementCount / 2) throw new RangeError('edges must hold one id per segment');
    edges = Uint32Array.from(input.edges);
  }
  const uvs = input.uvs ? Float32Array.from(input.uvs) : new Float32Array(vertexCount * 2);
  if (uvs.length !== vertexCount * 2) throw new RangeError('uvs must hold two numbers per vertex');
  return { topology, positions, normals, colors: vertexColors(input.colors, vertexCount), uvs, indices, faces, edges, vertexCount, elementCount, bounds: boxOfPositions(positions) };
}

/** sRGB colours (three or four per vertex, 0–1) as linear RGBA8; white when left out. */
export function vertexColors(c: ArrayLike<number> | undefined, vertexCount: number): Uint8Array {
  const colors = new Uint8Array(vertexCount * 4).fill(255);
  if (!c) return colors;
  const k = c.length === vertexCount * 4 ? 4 : c.length === vertexCount * 3 ? 3 : 0;
  if (!k) throw new RangeError('colors must hold three or four numbers per vertex');
  for (let v = 0; v < vertexCount; v++) {
    for (let j = 0; j < 3; j++) colors[v * 4 + j] = Math.round(srgbToLinear(Math.min(1, Math.max(0, c[v * k + j]))) * 255);
    if (k === 4) colors[v * 4 + 3] = Math.round(Math.min(1, Math.max(0, c[v * k + 3])) * 255);
  }
  return colors;
}

/** Area-weighted normals of the triangles around each vertex. */
export function vertexNormals(positions: Float32Array, indices: ArrayLike<number> | null): Float32Array {
  const n = new Float32Array(positions.length), count = indices ? indices.length : positions.length / 3;
  const at = (i: number): Vec3 => [positions[3 * i], positions[3 * i + 1], positions[3 * i + 2]];
  for (let t = 0; t + 2 < count; t += 3) {
    const a = indices ? indices[t] : t, b = indices ? indices[t + 1] : t + 1, c = indices ? indices[t + 2] : t + 2;
    const f = cross(sub(at(b), at(a)), sub(at(c), at(a)));
    for (const v of [a, b, c]) { n[3 * v] += f[0]; n[3 * v + 1] += f[1]; n[3 * v + 2] += f[2]; }
  }
  for (let v = 0; v < n.length; v += 3) {
    const l = Math.hypot(n[v], n[v + 1], n[v + 2]);
    if (l > 0) { n[v] /= l; n[v + 1] /= l; n[v + 2] /= l; } else n[v + 2] = 1;
  }
  return n;
}

/** Where a ray enters the box at `box[at…at + 5]` (min, max; its parameter, 0 when it starts inside), or Infinity when it misses it. */
function slab(box: ArrayLike<number>, at: number, ox: number, oy: number, oz: number, ix: number, iy: number, iz: number): number {
  let t0 = 0, t1 = Infinity;
  for (let k = 0; k < 3; k++) {
    const o = k === 0 ? ox : k === 1 ? oy : oz, inv = k === 0 ? ix : k === 1 ? iy : iz, mn = box[at + k], mx = box[at + 3 + k];
    // (A tolerance as the triangle test's, so a hit on a box face is not lost.)
    const lo = mn - 1e-7 * (1 + Math.abs(mn)), hi = mx + 1e-7 * (1 + Math.abs(mx));
    let a = (lo - o) * inv, b = (hi - o) * inv;
    if (Number.isNaN(a) || Number.isNaN(b)) { if (o < lo || o > hi) return Infinity; continue; }
    if (a > b) { const x = a; a = b; b = x; }
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
    if (t0 > t1) return Infinity;
  }
  return t0;
}

/** A bounding volume hierarchy over a geometry's triangles: boxes (min, max per node), children or a run of triangles. */
interface Bvh { box: Float64Array; left: Int32Array; right: Int32Array; start: Int32Array; count: Int32Array; order: Uint32Array }
const BVH_LEAF = 8, BVH_FROM = 1024;
const bvhs = new WeakMap<PreparedGeometry, Bvh>();
function bvhOf(g: PreparedGeometry): Bvh {
  const have = bvhs.get(g); if (have) return have;
  const P = g.positions, I = g.indices, n = g.elementCount / 3, order = new Uint32Array(n), c = new Float64Array(n * 3), tb = new Float64Array(n * 6);
  for (let t = 0; t < n; t++) {
    order[t] = t;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let k = 0; k < 3; k++) {
      const v = I ? I[3 * t + k] : 3 * t + k, x = P[3 * v], y = P[3 * v + 1], z = P[3 * v + 2];
      if (x < x0) x0 = x; if (y < y0) y0 = y; if (z < z0) z0 = z; if (x > x1) x1 = x; if (y > y1) y1 = y; if (z > z1) z1 = z;
    }
    tb.set([x0, y0, z0, x1, y1, z1], 6 * t); c[3 * t] = (x0 + x1) / 2; c[3 * t + 1] = (y0 + y1) / 2; c[3 * t + 2] = (z0 + z1) / 2;
  }
  const box: number[] = [], left: number[] = [], right: number[] = [], start: number[] = [], count: number[] = [];
  const build = (lo: number, hi: number): number => {
    const id = left.length; left.push(-1); right.push(-1); start.push(lo); count.push(hi - lo);
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], cb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = lo; i < hi; i++) { const t = order[i]; for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], tb[6 * t + k]); b[k + 3] = Math.max(b[k + 3], tb[6 * t + k + 3]); cb[k] = Math.min(cb[k], c[3 * t + k]); cb[k + 3] = Math.max(cb[k + 3], c[3 * t + k]); } }
    box.push(...b);
    if (hi - lo <= BVH_LEAF) return id;
    // Split at the middle of the longest extent of the centres (falling back to halves when they coincide).
    const ax = [0, 1, 2].reduce((m, k) => cb[k + 3] - cb[k] > cb[m + 3] - cb[m] ? k : m, 0), mid = (cb[ax] + cb[ax + 3]) / 2;
    let i = lo, j = hi - 1;
    while (i <= j) { if (c[3 * order[i] + ax] < mid) i++; else { const x = order[i]; order[i] = order[j]; order[j] = x; j--; } }
    if (i === lo || i === hi) i = (lo + hi) >> 1;
    const l = build(lo, i), r = build(i, hi);
    left[id] = l; right[id] = r; count[id] = 0;
    return id;
  };
  build(0, n);
  const out: Bvh = { box: Float64Array.from(box), left: Int32Array.from(left), right: Int32Array.from(right), start: Int32Array.from(start), count: Int32Array.from(count), order };
  bvhs.set(g, out);
  return out;
}

/**
 * The nearest triangle a ray (in the geometry's own space) hits: its index and distance along the ray.
 * A ray missing the geometry's box is rejected at once; a large geometry is searched through a
 * bounding volume hierarchy built the first time it is picked.
 */
export function rayTriangles(g: PreparedGeometry, origin: Vec3, direction: Vec3): { triangle: number; t: number } | null {
  if (g.topology !== 'triangles' || !g.bounds) return null;
  const [ox, oy, oz] = origin, [dx, dy, dz] = direction, ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
  if (slab([...g.bounds.min, ...g.bounds.max], 0, ox, oy, oz, ix, iy, iz) === Infinity) return null;
  const P = g.positions, I = g.indices;
  let bestT = Infinity, bestTri = -1;
  // Möller–Trumbore, both faces, with no allocation.
  const test = (t: number) => {
    const a = I ? I[3 * t] : 3 * t, b = I ? I[3 * t + 1] : 3 * t + 1, c = I ? I[3 * t + 2] : 3 * t + 2;
    const ax = P[3 * a], ay = P[3 * a + 1], az = P[3 * a + 2];
    const e1x = P[3 * b] - ax, e1y = P[3 * b + 1] - ay, e1z = P[3 * b + 2] - az, e2x = P[3 * c] - ax, e2y = P[3 * c + 1] - ay, e2z = P[3 * c + 2] - az;
    const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-20) return;
    const inv = 1 / det, sx = ox - ax, sy = oy - ay, sz = oz - az, u = (sx * px + sy * py + sz * pz) * inv;
    if (u < -1e-7 || u > 1 + 1e-7) return;
    const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x, v = (dx * qx + dy * qy + dz * qz) * inv;
    if (v < -1e-7 || u + v > 1 + 1e-7) return;
    const d = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if (d > 0 && d < bestT) { bestT = d; bestTri = t; }
  };
  const n = g.elementCount / 3;
  if (n < BVH_FROM) for (let t = 0; t < n; t++) test(t);
  else {
    const h = bvhOf(g), stack = [0];
    while (stack.length) {
      const node = stack.pop()!;
      if (slab(h.box, 6 * node, ox, oy, oz, ix, iy, iz) >= bestT) continue;
      if (h.left[node] < 0) { for (let i = h.start[node], e = i + h.count[node]; i < e; i++) test(h.order[i]); continue; }
      stack.push(h.left[node], h.right[node]);
    }
  }
  return bestTri < 0 ? null : { triangle: bestTri, t: bestT };
}

/** Segments as the line shader reads them, one instance each: a, b (3 floats each), colours of a and b (RGBA8). */
export function segmentInstances(g: PreparedGeometry): ArrayBuffer {
  const n = g.elementCount / 2, out = new ArrayBuffer(n * 32), f = new Float32Array(out), u = new Uint32Array(out);
  const P = g.positions, I = g.indices, C = new Uint32Array(g.colors.buffer, g.colors.byteOffset, g.vertexCount);
  for (let s = 0; s < n; s++) {
    const a = I ? I[2 * s] : 2 * s, b = I ? I[2 * s + 1] : 2 * s + 1;
    f.set([P[3 * a], P[3 * a + 1], P[3 * a + 2], P[3 * b], P[3 * b + 1], P[3 * b + 2]], s * 8);
    u[s * 8 + 6] = C[a]; u[s * 8 + 7] = C[b];
  }
  return out;
}
