// Geometry kept on the CPU (so it can be re-uploaded after a device loss and ray-cast for picking) and
// its vertex data as the viewer uploads it: positions, normals and linear RGBA8 colours.
import { boxOfPositions, type Box3 } from './bounds.js';
import { dot, invert, srgbToLinear, transformDirection, transformPoint, type Vec3 } from './math.js';

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
  // (A run of vertices of one colour, a face's, is converted once: the same bytes, without three powers a vertex.)
  let r = NaN, g = NaN, b = NaN, R = 0, G = 0, B = 0;
  for (let v = 0; v < vertexCount; v++) {
    const x = c[v * k], y = c[v * k + 1], z = c[v * k + 2];
    if (x !== r || y !== g || z !== b) { r = x; g = y; b = z; R = linearByte(x); G = linearByte(y); B = linearByte(z); }
    colors[v * 4] = R; colors[v * 4 + 1] = G; colors[v * 4 + 2] = B;
    if (k === 4) colors[v * 4 + 3] = Math.round(Math.min(1, Math.max(0, c[v * k + 3])) * 255);
  }
  return colors;
}
const linearByte = (x: number) => Math.round(srgbToLinear(Math.min(1, Math.max(0, x))) * 255);

/**
 * One colour (sRGB, three or four numbers; alpha 1 when three) on vertices `first` … `first + count − 1` of
 * prepared colours (four bytes a vertex), as `vertexColors` writes it: a face's highlight changed in place.
 */
export function fillVertexColors(colors: Uint8Array, first: number, count: number, color: ArrayLike<number>): void {
  if (color.length !== 3 && color.length !== 4) throw new RangeError('a colour is three or four numbers');
  if (!(Number.isInteger(first) && Number.isInteger(count) && first >= 0 && count >= 0 && 4 * (first + count) <= colors.length)) throw new RangeError('the range is not within the vertices');
  const R = linearByte(color[0]), G = linearByte(color[1]), B = linearByte(color[2]), A = color.length === 4 ? Math.round(Math.min(1, Math.max(0, color[3])) * 255) : 255;
  for (let v = first, end = first + count; v < end; v++) { colors[v * 4] = R; colors[v * 4 + 1] = G; colors[v * 4 + 2] = B; colors[v * 4 + 3] = A; }
}

/** Area-weighted normals of the triangles around each vertex. */
export function vertexNormals(positions: Float32Array, indices: ArrayLike<number> | null): Float32Array {
  const n = new Float32Array(positions.length), count = indices ? indices.length : positions.length / 3, P = positions;
  // (The cross product of b − a and c − a written out, as cross(sub(…), sub(…)) works it: no arrays a triangle; PERF3 C17.)
  for (let t = 0; t + 2 < count; t += 3) {
    const a = indices ? indices[t] : t, b = indices ? indices[t + 1] : t + 1, c = indices ? indices[t + 2] : t + 2;
    const ux = P[3 * b] - P[3 * a], uy = P[3 * b + 1] - P[3 * a + 1], uz = P[3 * b + 2] - P[3 * a + 2], vx = P[3 * c] - P[3 * a], vy = P[3 * c + 1] - P[3 * a + 1], vz = P[3 * c + 2] - P[3 * a + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    n[3 * a] += fx; n[3 * a + 1] += fy; n[3 * a + 2] += fz;
    n[3 * b] += fx; n[3 * b + 1] += fy; n[3 * b + 2] += fz;
    n[3 * c] += fx; n[3 * c + 1] += fy; n[3 * c + 2] += fz;
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

/** A bounding volume hierarchy over a geometry's triangles or segments: boxes (min, max per node), children or a run of elements. */
interface Bvh { box: Float64Array; left: Int32Array; right: Int32Array; start: Int32Array; count: Int32Array; order: Uint32Array }
const BVH_LEAF = 8, BVH_FROM = 1024, SEGMENT_BVH_FROM = 256;
const bvhs = new WeakMap<PreparedGeometry, Bvh>();
function bvhOf(g: PreparedGeometry): Bvh {
  const have = bvhs.get(g); if (have) return have;
  // (Three vertices an element for triangles, two for segments.)
  const k3 = g.topology === 'lines' ? 2 : 3;
  const P = g.positions, I = g.indices, n = g.elementCount / k3, order = new Uint32Array(n), c = new Float64Array(n * 3), tb = new Float64Array(n * 6);
  for (let t = 0; t < n; t++) {
    order[t] = t;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let k = 0; k < k3; k++) {
      const v = I ? I[k3 * t + k] : k3 * t + k, x = P[3 * v], y = P[3 * v + 1], z = P[3 * v + 2];
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
 * The nearest triangle a ray (in the geometry's own space) hits: its index, distance along the ray, and whether the ray
 * meets its back (its winding clockwise as seen along the ray). With a plane (nx, ny, nz, d, in the same space) only hits
 * where n·p ≥ d count: the clip plane's kept side; with `backs` false, only fronts (a single-sided mesh cut open, drawn
 * without its inside). A ray missing the geometry's box is rejected at once; a large geometry
 * is searched through a bounding volume hierarchy built the first time it is picked.
 */
export function rayTriangles(g: PreparedGeometry, origin: Vec3, direction: Vec3, plane: ArrayLike<number> | null = null, backs = true): { triangle: number; t: number; back: boolean } | null {
  if (g.topology !== 'triangles' || !g.bounds) return null;
  const [ox, oy, oz] = origin, [dx, dy, dz] = direction, ix = 1 / dx, iy = 1 / dy, iz = 1 / dz, B = rayBox;
  B[0] = g.bounds.min[0]; B[1] = g.bounds.min[1]; B[2] = g.bounds.min[2]; B[3] = g.bounds.max[0]; B[4] = g.bounds.max[1]; B[5] = g.bounds.max[2];
  if (slab(B, 0, ox, oy, oz, ix, iy, iz) === Infinity) return null;
  ray.P = g.positions; ray.I = g.indices; ray.ox = ox; ray.oy = oy; ray.oz = oz; ray.dx = dx; ray.dy = dy; ray.dz = dz; ray.bestT = Infinity; ray.bestTri = -1; ray.bestBack = false; ray.backs = backs;
  ray.clip = !!plane; if (plane) { ray.nx = plane[0]; ray.ny = plane[1]; ray.nz = plane[2]; ray.nd = plane[3]; }
  const n = g.elementCount / 3;
  if (n < BVH_FROM) for (let t = 0; t < n; t++) rayTriangle(t);
  else {
    const h = bvhOf(g), stack = [0];
    while (stack.length) {
      const node = stack.pop()!;
      if (slab(h.box, 6 * node, ox, oy, oz, ix, iy, iz) >= ray.bestT) continue;
      if (h.left[node] < 0) { for (let i = h.start[node], e = i + h.count[node]; i < e; i++) rayTriangle(h.order[i]); continue; }
      stack.push(h.left[node], h.right[node]);
    }
  }
  const out = ray.bestTri < 0 ? null : { triangle: ray.bestTri, t: ray.bestT, back: ray.bestBack };
  ray.P = EMPTY; ray.I = null;
  return out;
}
// (The ray being tested and the nearest hit so far, at module level: one function for every triangle, no closure per
// pick; PERF3 C17.)
const EMPTY = new Float32Array(0), rayBox = new Float64Array(6);
const ray = { P: EMPTY as Float32Array<ArrayBufferLike>, I: null as Uint32Array | Uint16Array | null, ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: 0, bestT: Infinity, bestTri: -1, bestBack: false, backs: true, clip: false, nx: 0, ny: 0, nz: 0, nd: 0 };
/** Möller–Trumbore, both faces, with no allocation: triangle t against the ray, kept when nearer. */
function rayTriangle(t: number): void {
  const P = ray.P, I = ray.I, dx = ray.dx, dy = ray.dy, dz = ray.dz;
  const a = I ? I[3 * t] : 3 * t, b = I ? I[3 * t + 1] : 3 * t + 1, c = I ? I[3 * t + 2] : 3 * t + 2;
  const ax = P[3 * a], ay = P[3 * a + 1], az = P[3 * a + 2];
  const e1x = P[3 * b] - ax, e1y = P[3 * b + 1] - ay, e1z = P[3 * b + 2] - az, e2x = P[3 * c] - ax, e2y = P[3 * c + 1] - ay, e2z = P[3 * c + 2] - az;
  const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-20 || (!ray.backs && det < 0)) return;
  const inv = 1 / det, sx = ray.ox - ax, sy = ray.oy - ay, sz = ray.oz - az, u = (sx * px + sy * py + sz * pz) * inv;
  if (u < -1e-7 || u > 1 + 1e-7) return;
  const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x, v = (dx * qx + dy * qy + dz * qz) * inv;
  if (v < -1e-7 || u + v > 1 + 1e-7) return;
  const d = (e2x * qx + e2y * qy + e2z * qz) * inv;
  if (!(d > 0 && d < ray.bestT)) return;
  // (A hit the clip plane cuts away is not one.)
  if (ray.clip && ray.nx * (ray.ox + dx * d) + ray.ny * (ray.oy + dy * d) + ray.nz * (ray.oz + dz * d) < ray.nd) return;
  // (det > 0: counter-clockwise seen along the ray, its front.)
  ray.bestT = d; ray.bestTri = t; ray.bestBack = det < 0;
}

/** A world plane (dot(n, p) ≥ offset) in the space a transform maps from: (Aᵀ n)·x ≥ offset − n·t for p = A x + t. */
export function localPlane(M: ArrayLike<number>, c: { normal: readonly number[]; offset: number }): Float64Array {
  const n = c.normal, out = new Float64Array(4);
  for (let j = 0; j < 3; j++) out[j] = M[j * 4] * n[0] + M[j * 4 + 1] * n[1] + M[j * 4 + 2] * n[2];
  out[3] = c.offset - (n[0] * M[12] + n[1] * M[13] + n[2] * M[14]);
  return out;
}

/** A hit of a world ray: its parameter, the triangle (null on the cap), and whether it is on the clip plane's cap. */
export interface ClippedHit { t: number; triangle: number | null; cap: boolean }
/**
 * A world ray against a geometry drawn through transform M, with the clip plane (world, unit normal; null: none): the
 * nearest hit on its kept side, or — `cap` set — its cap where the ray comes in through the cut to a back face, as the
 * viewer's cap pass draws it. `backs` false skips back faces (a single-sided mesh cut open shows no inside). Its
 * parameter is the world ray's (the ray is carried into the geometry's space unnormalised).
 */
export function clippedRay(g: PreparedGeometry, M: ArrayLike<number>, origin: Vec3, direction: Vec3, clip: { normal: Vec3; offset: number } | null, cap: boolean, backs: boolean): ClippedHit | null {
  const inv = invert(M as Float64Array);
  const hit = rayTriangles(g, transformPoint(inv, origin), transformDirection(inv, direction), clip ? localPlane(M, clip) : null, backs);
  if (!hit) return null;
  if (clip && cap && hit.back) {
    const den = dot(clip.normal, direction), tp = den > 0 ? (clip.offset - dot(clip.normal, origin)) / den : -1;
    if (tp > 0 && tp < hit.t) return { t: tp, triangle: null, cap: true };
  }
  return { t: hit.t, triangle: hit.triangle, cap: false };
}

/** The segment of a line geometry drawn nearest a point of the canvas: its index, distance (CSS pixels) and parameter along it in 3D. */
export interface SegmentHit { segment: number; distance: number; s: number }
const clipA = new Float64Array(3), clipB = new Float64Array(3);
const near = { segment: -1, distance: Infinity, s: 0 };
const segClip = { on: false, nx: 0, ny: 0, nz: 0, d: 0 };

/**
 * The segment of a line geometry nearest (x, y) on a canvas of cw × ch CSS pixels, through `M` (view-projection
 * times the mesh's transform), within `radius` and nearer than `earlier` (another mesh's best): ties go to the
 * lowest segment, as a walk over every segment in order would give. Segments are clipped to the space in front
 * of the eye. A large geometry is searched through a hierarchy of segment boxes, a node passed over when its
 * corners all land in front of the eye and their screen rectangle is farther than the best so far.
 */
export function nearestSegment(g: PreparedGeometry, M: ArrayLike<number>, x: number, y: number, cw: number, ch: number, radius: number, earlier = Infinity, plane: ArrayLike<number> | null = null): SegmentHit | null {
  if (g.topology !== 'lines') return null;
  near.segment = -1; near.distance = Infinity; near.s = 0;
  // (With a plane — nx, ny, nz, d in the geometry's space — only each segment's part where n·p ≥ d.)
  segClip.on = !!plane; if (plane) { segClip.nx = plane[0]; segClip.ny = plane[1]; segClip.nz = plane[2]; segClip.d = plane[3]; }
  const n = g.elementCount / 2;
  if (n < SEGMENT_BVH_FROM) for (let sgm = 0; sgm < n; sgm++) testSegment(g, M, sgm, x, y, cw, ch, radius, earlier);
  else {
    const h = bvhOf(g), stack = [0];
    while (stack.length) {
      const node = stack.pop()!, limit = Math.min(radius, earlier, near.distance);
      // (A little slack: a segment's projection is inside its box's, up to rounding.)
      if (rectDistance(h.box, 6 * node, M, x, y, cw, ch) > limit + 1e-6 * (1 + limit)) continue;
      if (h.left[node] < 0) { for (let i = h.start[node], e = i + h.count[node]; i < e; i++) testSegment(g, M, h.order[i], x, y, cw, ch, radius, earlier); continue; }
      stack.push(h.left[node], h.right[node]);
    }
  }
  return near.segment < 0 ? null : { segment: near.segment, distance: near.distance, s: near.s };
}
/** Pixels from (x, y) to the screen rectangle of a box's eight corners, or 0 when a corner is not in front of the eye. */
function rectDistance(box: Float64Array, o: number, M: ArrayLike<number>, x: number, y: number, cw: number, ch: number): number {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let c = 0; c < 8; c++) {
    const px = box[o + (c & 1 ? 3 : 0)], py = box[o + (c & 2 ? 4 : 1)], pz = box[o + (c & 4 ? 5 : 2)];
    const w = M[3] * px + M[7] * py + M[11] * pz + M[15]; if (w < 1e-6) return 0;
    const sx = ((M[0] * px + M[4] * py + M[8] * pz + M[12]) / w * 0.5 + 0.5) * cw, sy = (0.5 - (M[1] * px + M[5] * py + M[9] * pz + M[13]) / w * 0.5) * ch;
    if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
  }
  const dx = x < x0 ? x0 - x : x > x1 ? x - x1 : 0, dy = y < y0 ? y0 - y : y > y1 ? y - y1 : 0;
  return Math.hypot(dx, dy);
}
/** Clip coordinates (x, y, w) of vertex i through M. */
function clipOf(out: Float64Array, M: ArrayLike<number>, P: Float32Array, i: number): void {
  const px = P[3 * i], py = P[3 * i + 1], pz = P[3 * i + 2];
  out[0] = M[0] * px + M[4] * py + M[8] * pz + M[12]; out[1] = M[1] * px + M[5] * py + M[9] * pz + M[13]; out[2] = M[3] * px + M[7] * py + M[11] * pz + M[15];
}
/** One segment against the best so far (`near`): the same arithmetic, in the same order, as the viewer's walk had. */
function testSegment(g: PreparedGeometry, M: ArrayLike<number>, sgm: number, x: number, y: number, cw: number, ch: number, radius: number, earlier: number): void {
  const P = g.positions, I = g.indices, ia = I ? I[2 * sgm] : 2 * sgm, ib = I ? I[2 * sgm + 1] : 2 * sgm + 1, a = clipA, b = clipB, eps = 1e-6;
  clipOf(a, M, P, ia); clipOf(b, M, P, ib);
  let s0 = 0, s1 = 1;
  // The clip plane's kept part (clip coordinates are linear along the segment, so are cut at the same parameter).
  if (segClip.on) {
    const fa = segClip.nx * P[3 * ia] + segClip.ny * P[3 * ia + 1] + segClip.nz * P[3 * ia + 2] - segClip.d, fb = segClip.nx * P[3 * ib] + segClip.ny * P[3 * ib + 1] + segClip.nz * P[3 * ib + 2] - segClip.d;
    if (fa < 0 && fb < 0) return;
    if (fa < 0) { const k = fa / (fa - fb); for (let j = 0; j < 3; j++) a[j] = a[j] + (b[j] - a[j]) * k; s0 = k; }
    else if (fb < 0) { const k = fb / (fb - fa); for (let j = 0; j < 3; j++) b[j] = b[j] + (a[j] - b[j]) * k; s1 = 1 - k; }
  }
  if (a[2] < eps && b[2] < eps) return;
  // Clip to the space in front of the eye, keeping the 3D parameters of the kept ends.
  if (a[2] < eps) { const k = (eps - a[2]) / (b[2] - a[2]); for (let j = 0; j < 3; j++) a[j] = a[j] + (b[j] - a[j]) * k; s0 = s0 + (s1 - s0) * k; }
  if (b[2] < eps) { const k = (eps - b[2]) / (a[2] - b[2]); for (let j = 0; j < 3; j++) b[j] = b[j] + (a[j] - b[j]) * k; s1 = s1 - (s1 - s0) * k; }
  const ax = (a[0] / a[2] * 0.5 + 0.5) * cw, ay = (0.5 - a[1] / a[2] * 0.5) * ch;
  const dx = (b[0] / b[2] * 0.5 + 0.5) * cw - ax, dy = (0.5 - b[1] / b[2] * 0.5) * ch - ay, l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
  const dist = Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
  if (dist > radius || dist >= earlier) return;
  if (near.segment >= 0 && (dist > near.distance || (dist === near.distance && sgm > near.segment))) return;
  // Screen parameter → segment parameter (perspective-correct).
  const u = (t * a[2]) / ((1 - t) * b[2] + t * a[2] || 1);
  near.segment = sgm; near.distance = dist; near.s = s0 + (s1 - s0) * u;
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
