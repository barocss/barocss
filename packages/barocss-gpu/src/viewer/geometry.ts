// Geometry kept on the CPU (so it can be re-uploaded after a device loss and ray-cast for picking) and
// its vertex data as the viewer uploads it: positions, normals and linear RGBA8 colours.
import { boxOfPositions, type Box3 } from './bounds.js';
import type { LabelInput } from './glyphs.js';
import { invert, srgbToLinear, transformDirection, transformPoint, type Vec3 } from './math.js';

export interface GeometryInput {
  /** x, y, z per vertex. */
  positions: ArrayLike<number>;
  /** Per vertex; computed (smooth over shared vertices) when left out. */
  normals?: ArrayLike<number>;
  /** Texture coordinates, two per vertex (for Material.map). */
  uvs?: ArrayLike<number>;
  /** sRGB colours per vertex, 0–1: three (rgb) or four (rgba) numbers each. */
  colors?: ArrayLike<number>;
  /** Triangles (or segment pairs for lines, or one vertex a point); vertices in order when left out. */
  indices?: ArrayLike<number>;
  /** Triangles (default), line segments, points (G8: screen-space sprites, Material.pointSize) or text labels (G15). */
  topology?: 'triangles' | 'lines' | 'points' | 'labels';
  /** Labels (topology 'labels'): their text, anchors and looks (positions are then their anchors). */
  labels?: readonly LabelInput[];
  /** An id per triangle (a CAD face, say), reported by picking. */
  faces?: ArrayLike<number>;
  /** An id per line segment (a CAD edge, say), reported by line picking. */
  edges?: ArrayLike<number>;
}

export interface PreparedGeometry {
  topology: 'triangles' | 'lines' | 'points' | 'labels';
  /** A label geometry's labels (laid out against the viewer's glyph atlas when uploaded), else null. */
  labels: readonly LabelInput[] | null;
  /** uvs: null when the input had none (G13: they read as zero, from one buffer the viewer shares). */
  positions: Float32Array; normals: Float32Array; colors: Uint8Array; uvs: Float32Array | null;
  indices: Uint32Array | Uint16Array | null;
  faces: Uint32Array | null;
  edges: Uint32Array | null;
  vertexCount: number; elementCount: number;
  bounds: Box3 | null;
  /** A scalar field on it for a colour map (G6), or null. */
  scalars: ScalarField | null;
}

/**
 * A scalar field on a triangle geometry (G6): one value per vertex (interpolated) or per triangle (flat), NaN where there
 * is none. `draw` is what the GPU reads: the values per drawn vertex (a sentinel for none), and for a per-triangle field
 * the triangles' positions and normals laid out one vertex each (drawn without the index buffer, each triangle flat).
 */
export interface ScalarField {
  per: 'vertex' | 'triangle';
  values: Float32Array;
  draw: { values: Float32Array; positions: Float32Array | null; normals: Float32Array | null };
}
/** What the GPU reads for a missing value (WGSL makes no promise about NaN). */
export const SCALAR_MISSING = -3e38;

/** A scalar field for a triangle geometry: checked, and laid out for drawing. */
export function prepareScalars(g: PreparedGeometry, input: ArrayLike<number>, per: 'vertex' | 'triangle'): ScalarField {
  if (g.topology !== 'triangles') throw new RangeError('Only triangle geometry has a scalar field');
  const T = g.elementCount / 3, n = per === 'vertex' ? g.vertexCount : T;
  if (input.length !== n) throw new RangeError(`A per-${per} field needs ${n} values (it has ${input.length})`);
  const values = Float32Array.from(input), I = g.indices;
  if (per === 'vertex') {
    const draw = new Float32Array(n);
    for (let v = 0; v < n; v++) draw[v] = Number.isFinite(values[v]) ? values[v] : SCALAR_MISSING;
    return { per, values, draw: { values: draw, positions: null, normals: null } };
  }
  const dv = new Float32Array(3 * T), P = new Float32Array(9 * T), N = new Float32Array(9 * T), GP = g.positions, GN = g.normals;
  for (let t = 0; t < T; t++) {
    const x = Number.isFinite(values[t]) ? values[t] : SCALAR_MISSING;
    for (let k = 0; k < 3; k++) {
      const v = I ? I[3 * t + k] : 3 * t + k, o = 3 * (3 * t + k);
      dv[3 * t + k] = x;
      P[o] = GP[3 * v]; P[o + 1] = GP[3 * v + 1]; P[o + 2] = GP[3 * v + 2];
      N[o] = GN[3 * v]; N[o + 1] = GN[3 * v + 1]; N[o + 2] = GN[3 * v + 2];
    }
  }
  return { per, values, draw: { values: dv, positions: P, normals: N } };
}

/** A field's value at a point (the geometry's own space) on triangle t: its triangle's, or its vertices' by barycentric weights; NaN where none. */
export function scalarAt(g: PreparedGeometry, t: number, p: ArrayLike<number>): number {
  const f = g.scalars;
  if (!f) return NaN;
  if (f.per === 'triangle') return f.values[t];
  const I = g.indices, P = g.positions, ia = I ? I[3 * t] : 3 * t, ib = I ? I[3 * t + 1] : 3 * t + 1, ic = I ? I[3 * t + 2] : 3 * t + 2;
  const ax = P[3 * ia], ay = P[3 * ia + 1], az = P[3 * ia + 2];
  const v0x = P[3 * ib] - ax, v0y = P[3 * ib + 1] - ay, v0z = P[3 * ib + 2] - az, v1x = P[3 * ic] - ax, v1y = P[3 * ic + 1] - ay, v1z = P[3 * ic + 2] - az;
  const v2x = p[0] - ax, v2y = p[1] - ay, v2z = p[2] - az;
  const d00 = v0x * v0x + v0y * v0y + v0z * v0z, d01 = v0x * v1x + v0y * v1y + v0z * v1z, d11 = v1x * v1x + v1y * v1y + v1z * v1z;
  const d20 = v2x * v0x + v2y * v0y + v2z * v0z, d21 = v2x * v1x + v2y * v1y + v2z * v1z, den = d00 * d11 - d01 * d01;
  if (!(Math.abs(den) > 0)) return f.values[ia];
  const b = (d11 * d20 - d01 * d21) / den, c = (d00 * d21 - d01 * d20) / den, a = 1 - b - c;
  return a * f.values[ia] + b * f.values[ib] + c * f.values[ic];
}

export function prepareGeometry(input: GeometryInput): PreparedGeometry {
  const topology = input.topology ?? 'triangles';
  if (topology === 'labels') return prepareLabels(input);
  const positions = Float32Array.from(input.positions);
  if (positions.length % 3) throw new RangeError('positions must hold three numbers per vertex');
  const vertexCount = positions.length / 3;
  for (let i = 0; i < positions.length; i++) if (!Number.isFinite(positions[i])) throw new RangeError(`positions[${i}] is not finite`);
  let indices: Uint32Array | Uint16Array | null = null;
  if (input.indices) {
    indices = vertexCount <= 0xffff ? Uint16Array.from(input.indices) : Uint32Array.from(input.indices);
    for (let i = 0; i < indices.length; i++) if (input.indices[i] >= vertexCount || input.indices[i] < 0 || !Number.isInteger(input.indices[i])) throw new RangeError(`indices[${i}] = ${input.indices[i]} is not a vertex`);
  }
  const elementCount = indices ? indices.length : vertexCount, per = topology === 'lines' ? 2 : topology === 'points' ? 1 : 3;
  if (elementCount % per) throw new RangeError(`${topology} need a multiple of ${per} ${indices ? 'indices' : 'vertices'}`);
  let normals: Float32Array;
  if (input.normals) {
    normals = Float32Array.from(input.normals);
    if (normals.length !== positions.length) throw new RangeError('normals must match positions');
  } else normals = topology !== 'triangles' ? new Float32Array(positions.length) : vertexNormals(positions, indices);
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
  const uvs = input.uvs ? Float32Array.from(input.uvs) : null;
  if (uvs && uvs.length !== vertexCount * 2) throw new RangeError('uvs must hold two numbers per vertex');
  return { topology, positions, normals, colors: vertexColors(input.colors, vertexCount), uvs, indices, faces, edges, vertexCount, elementCount, bounds: boxOfPositions(positions), scalars: null, labels: null };
}
/** Labels (G15): their anchors as the positions — for the bounds, the frustum and the scene tree — one element each. */
function prepareLabels(input: GeometryInput): PreparedGeometry {
  const labels = input.labels ?? [], positions = new Float32Array(labels.length * 3);
  labels.forEach((l, i) => { for (let k = 0; k < 3; k++) { const v = Number(l.at[k]); if (!Number.isFinite(v)) throw new RangeError(`labels[${i}].at is not finite`); positions[3 * i + k] = v; } });
  return { topology: 'labels', positions, normals: new Float32Array(positions.length), colors: vertexColors(undefined, labels.length), uvs: null, indices: null, faces: null, edges: null, vertexCount: labels.length, elementCount: labels.length, bounds: boxOfPositions(positions), scalars: null, labels: labels.map(l => ({ ...l })) };
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
  // (Three vertices an element for triangles, two for segments, one for points.)
  const k3 = g.topology === 'lines' ? 2 : g.topology === 'points' ? 1 : 3;
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
  const out = buildBvh(tb, c, order, n);
  bvhs.set(g, out);
  return out;
}
/** A hierarchy over n boxes (tb: min, max each; c: their centres; order: 0…n−1, reordered): median splits of the longest centre extent. */
function buildBvh(tb: Float64Array, c: Float64Array, order: Uint32Array, n: number): Bvh {
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
  if (n) build(0, n);
  return { box: Float64Array.from(box), left: Int32Array.from(left), right: Int32Array.from(right), start: Int32Array.from(start), count: Int32Array.from(count), order };
}

/**
 * A scene-level tree (G9): a hierarchy over world boxes — a mesh's, or each instance's — for the viewer's picks. Built from
 * `boxes` (min, max a leaf), each widened by a millionth of its diagonal past the slab test's own tolerance, so a ray or a
 * screen point the per-mesh tests would find is never ruled out here. Leaves keep their index: the caller's order.
 */
export interface SceneTree { readonly n: number; readonly bvh: Bvh; /** The leaves' widened boxes, six numbers each. */ readonly boxes: Float64Array }
export function sceneTree(boxes: Float64Array, n: number): SceneTree {
  const tb = new Float64Array(6 * n), c = new Float64Array(3 * n), order = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    order[i] = i;
    const o = 6 * i, w = 1e-6 * (Math.hypot(boxes[o + 3] - boxes[o], boxes[o + 4] - boxes[o + 1], boxes[o + 5] - boxes[o + 2]) + 1);
    for (let k = 0; k < 3; k++) { tb[o + k] = boxes[o + k] - w; tb[o + 3 + k] = boxes[o + 3 + k] + w; c[3 * i + k] = (boxes[o + k] + boxes[o + 3 + k]) / 2; }
  }
  return { n, bvh: buildBvh(tb, c, order, n), boxes: tb };
}
const treeStack: number[] = [];
/**
 * The leaves a world ray (origin, direction: the parameter the per-mesh tests return) enters before `tmax`: their indices
 * into `leaves` and where it enters each into `ts`, in no particular order; their count.
 */
export function sceneRay(tree: SceneTree, origin: Vec3, direction: Vec3, tmax: number, leaves: number[], ts: number[]): number {
  leaves.length = 0; ts.length = 0;
  if (!tree.n) return 0;
  const h = tree.bvh, [ox, oy, oz] = origin, ix = 1 / direction[0], iy = 1 / direction[1], iz = 1 / direction[2], stack = treeStack;
  stack.length = 0; stack.push(0);
  while (stack.length) {
    const node = stack.pop()!, t = slab(h.box, 6 * node, ox, oy, oz, ix, iy, iz);
    if (t === Infinity || t > tmax) continue;
    if (h.left[node] < 0) {
      for (let i = h.start[node], e = i + h.count[node]; i < e; i++) { const leaf = h.order[i], tl = slab(tree.boxes, 6 * leaf, ox, oy, oz, ix, iy, iz); if (tl !== Infinity && tl <= tmax) { leaves.push(leaf); ts.push(tl); } }
      continue;
    }
    stack.push(h.left[node], h.right[node]);
  }
  return leaves.length;
}
/**
 * The leaves whose box lands on screen within `reach` pixels (CSS) of (x, y), M the view-projection (or every leaf a corner
 * of which is not in front of the eye): their indices into `leaves`, in no particular order; their count.
 */
export function sceneNear(tree: SceneTree, M: ArrayLike<number>, x: number, y: number, cw: number, ch: number, reach: number, leaves: number[]): number {
  leaves.length = 0;
  if (!tree.n) return 0;
  const h = tree.bvh, stack = treeStack;
  stack.length = 0; stack.push(0);
  while (stack.length) {
    const node = stack.pop()!;
    if (rectDistance(h.box, 6 * node, M, x, y, cw, ch) > reach + 1e-6 * (1 + reach)) continue;
    if (h.left[node] < 0) {
      for (let i = h.start[node], e = i + h.count[node]; i < e; i++) { const leaf = h.order[i]; if (rectDistance(tree.boxes, 6 * leaf, M, x, y, cw, ch) <= reach + 1e-6 * (1 + reach)) leaves.push(leaf); }
      continue;
    }
    stack.push(h.left[node], h.right[node]);
  }
  return leaves.length;
}

/**
 * The nearest triangle a ray (in the geometry's own space) hits: its index, distance along the ray, and whether the ray
 * meets its back (its winding clockwise as seen along the ray). With planes (nx, ny, nz, d each, 4 numbers a plane, in the
 * same space) only hits where n·p ≥ d for every one count: the clip planes' kept region (G19); `tMin`: only hits past it; with `backs` false, only fronts (a single-sided mesh cut open, drawn
 * without its inside). A ray missing the geometry's box is rejected at once; a large geometry
 * is searched through a bounding volume hierarchy built the first time it is picked.
 */
export function rayTriangles(g: PreparedGeometry, origin: Vec3, direction: Vec3, plane: ArrayLike<number> | null = null, backs = true, tMin = 0): { triangle: number; t: number; back: boolean } | null {
  if (g.topology !== 'triangles' || !g.bounds) return null;
  const [ox, oy, oz] = origin, [dx, dy, dz] = direction, ix = 1 / dx, iy = 1 / dy, iz = 1 / dz, B = rayBox;
  B[0] = g.bounds.min[0]; B[1] = g.bounds.min[1]; B[2] = g.bounds.min[2]; B[3] = g.bounds.max[0]; B[4] = g.bounds.max[1]; B[5] = g.bounds.max[2];
  if (slab(B, 0, ox, oy, oz, ix, iy, iz) === Infinity) return null;
  ray.P = g.positions; ray.I = g.indices; ray.ox = ox; ray.oy = oy; ray.oz = oz; ray.dx = dx; ray.dy = dy; ray.dz = dz; ray.bestT = Infinity; ray.bestTri = -1; ray.bestBack = false; ray.backs = backs; ray.tMin = tMin;
  ray.planes = plane && plane.length >= 4 ? plane : null;
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
const ray = { P: EMPTY as Float32Array<ArrayBufferLike>, I: null as Uint32Array | Uint16Array | null, ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: 0, bestT: Infinity, bestTri: -1, bestBack: false, backs: true, tMin: 0, planes: null as ArrayLike<number> | null };
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
  if (!(d > ray.tMin && d < ray.bestT)) return;
  // (A hit a clip plane cuts away is not one.)
  if (ray.planes && !keptBy(ray.planes, ray.ox + dx * d, ray.oy + dy * d, ray.oz + dz * d)) return;
  // (det > 0: counter-clockwise seen along the ray, its front.)
  ray.bestT = d; ray.bestTri = t; ray.bestBack = det < 0;
}

/**
 * A clip plane's hatch axes (G19.3; as hatchAcross in shaders.ts): the normal turned so its largest component is
 * positive (a plane and its flip hatch alike), u the next world axis after that component's (x → y → z → x) into the
 * plane, v = n × u. A hatch at angle θ runs along cos θ·u + sin θ·v.
 */
export function capHatchAxes(normal: readonly number[]): { u: [number, number, number]; v: [number, number, number] } {
  const m = normal.map(Math.abs), k = m[0] >= m[1] && m[0] >= m[2] ? 0 : m[1] >= m[2] ? 1 : 2;
  const l = Math.hypot(normal[0], normal[1], normal[2]) || 1, sg = normal[k] < 0 ? -1 / l : 1 / l;
  const n = [normal[0] * sg, normal[1] * sg, normal[2] * sg], j = (k + 1) % 3, d = n[j];
  const a = [-n[0] * d, -n[1] * d, -n[2] * d]; a[j] += 1;
  const al = Math.hypot(a[0], a[1], a[2]);
  const u: [number, number, number] = [a[0] / al, a[1] / al, a[2] / al];
  return { u, v: [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]] };
}

/** Whether a point is on every plane's kept side (planes packed: nx, ny, nz, d each). */
export function keptBy(planes: ArrayLike<number>, x: number, y: number, z: number): boolean {
  for (let i = 0; i + 3 < planes.length; i += 4) if (planes[i] * x + planes[i + 1] * y + planes[i + 2] * z < planes[i + 3]) return false;
  return true;
}
/** World planes with their offsets, as clip planes are given: one (normal, offset), or `planes` (G19). */
export type ClipPlanes = { normal: readonly number[]; offset: number; planes?: readonly { normal: readonly number[]; offset: number }[] };
const planesOf = (c: ClipPlanes) => c.planes ?? [c];
/**
 * World planes (dot(n, p) ≥ offset) in the space a transform maps from: (Aᵀ n)·x ≥ offset − n·t for p = A x + t — 4
 * numbers a plane (every one of `planes`, else the one).
 */
export function localPlane(M: ArrayLike<number>, c: ClipPlanes): Float64Array {
  const list = planesOf(c), out = new Float64Array(4 * list.length);
  for (let i = 0; i < list.length; i++) {
    const n = list[i].normal;
    for (let j = 0; j < 3; j++) out[4 * i + j] = M[j * 4] * n[0] + M[j * 4 + 1] * n[1] + M[j * 4 + 2] * n[2];
    out[4 * i + 3] = list[i].offset - (n[0] * M[12] + n[1] * M[13] + n[2] * M[14]);
  }
  return out;
}
/**
 * Where a world ray comes into the planes' kept region (G19: the intersection of their kept sides, convex): the
 * parameter of its last crossing into a plane's kept side, and that plane's index — the latest over the planes it
 * moves into; −1 when it moves into none — and where it leaves it (the first crossing out; the region along the ray is
 * empty when that is not after the entry).
 */
export function regionEntry(c: ClipPlanes, origin: readonly number[], direction: readonly number[]): { t: number; plane: number; exit: number } {
  const list = planesOf(c);
  let t = -Infinity, plane = -1, exit = Infinity;
  for (let i = 0; i < list.length; i++) {
    const p = list[i], den = dot3(p.normal, direction), f = dot3(p.normal, origin) - p.offset;
    if (Math.abs(den) < 1e-20) { if (f < 0) exit = -Infinity; continue; }
    const tp = -f / den;
    if (den > 0) { if (tp > t) { t = tp; plane = i; } } else if (tp < exit) exit = tp;
  }
  return { t: plane < 0 ? -1 : t, plane, exit };
}
const dot3 = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** A hit of a world ray: its parameter, the triangle (null on the cap), whether it is on a cap, and that cap's plane (G19). */
export interface ClippedHit { t: number; triangle: number | null; cap: boolean; plane?: number }
/**
 * A world ray against a geometry drawn through transform M, with the clip plane (world, unit normal; null: none): the
 * nearest hit on its kept side, or — `cap` set — its cap where the ray comes in through the cut to a back face, as the
 * viewer's cap pass draws it. `backs` false skips back faces (a single-sided mesh cut open shows no inside). Its
 * parameter is the world ray's (the ray is carried into the geometry's space unnormalised).
 */
export function clippedRay(g: PreparedGeometry, M: ArrayLike<number>, origin: Vec3, direction: Vec3, clip: ClipPlanes | null, cap: boolean, backs: boolean): ClippedHit | null {
  return clippedRayFull(g, M, origin, direction, clip, cap, backs).hit;
}
/**
 * clippedRay with what the viewer's probe reads (G19): `hit`, the mesh's own answer (its cap where the ray comes into the
 * kept region and the mesh's first surface after that, unclipped, is a back face — else its nearest kept hit); `kept`,
 * that nearest kept hit; `beyond`, the mesh's first surface after the entry (a capped mesh), for the choice among meshes:
 * the cap is the mesh's whose `beyond` is the first of all and a back face.
 */
export function clippedRayFull(g: PreparedGeometry, M: ArrayLike<number>, origin: Vec3, direction: Vec3, clip: ClipPlanes | null, cap: boolean, backs: boolean): { hit: ClippedHit | null; kept: ClippedHit | null; beyond: { t: number; back: boolean } | null; entry: number; plane: number } {
  const inv = invert(M as Float64Array), lo = transformPoint(inv, origin), ld = transformDirection(inv, direction);
  const h = rayTriangles(g, lo, ld, clip ? localPlane(M, clip) : null, backs);
  const kept: ClippedHit | null = h ? { t: h.t, triangle: h.triangle, cap: false } : null;
  // (The cap, G19: where the ray comes into the kept region — not empty along it — when the mesh's first surface after
  // that entry, unclipped, is a back face: the entry is inside the solid.)
  if (clip && cap) {
    const e = regionEntry(clip, origin, direction);
    if (e.plane >= 0 && e.t > 0 && e.t < e.exit) {
      const first = rayTriangles(g, lo, ld, null, true, e.t), beyond = first ? { t: first.t, back: first.back } : null;
      const hit = beyond?.back ? { t: e.t, triangle: null, cap: true, plane: e.plane } : kept;
      return { hit, kept, beyond, entry: e.t, plane: e.plane };
    }
  }
  return { hit: kept, kept, beyond: null, entry: -1, plane: -1 };
}

/** The segment of a line geometry drawn nearest a point of the canvas: its index, distance (CSS pixels) and parameter along it in 3D. */
export interface SegmentHit { segment: number; distance: number; s: number }
const clipA = new Float64Array(3), clipB = new Float64Array(3);
const near = { segment: -1, distance: Infinity, s: 0 };
const segClip = { planes: null as ArrayLike<number> | null, skip: null as ReadonlySet<number> | null };

/**
 * The segment of a line geometry nearest (x, y) on a canvas of cw × ch CSS pixels, through `M` (view-projection
 * times the mesh's transform), within `radius` and nearer than `earlier` (another mesh's best): ties go to the
 * lowest segment, as a walk over every segment in order would give. Segments are clipped to the space in front
 * of the eye. A large geometry is searched through a hierarchy of segment boxes, a node passed over when its
 * corners all land in front of the eye and their screen rectangle is farther than the best so far.
 */
export function nearestSegment(g: PreparedGeometry, M: ArrayLike<number>, x: number, y: number, cw: number, ch: number, radius: number, earlier = Infinity, plane: ArrayLike<number> | null = null, skip: ReadonlySet<number> | null = null): SegmentHit | null {
  if (g.topology !== 'lines') return null;
  near.segment = -1; near.distance = Infinity; near.s = 0;
  // (Segments to leave out: those a line pick found hidden.)
  segClip.skip = skip && skip.size ? skip : null;
  // (With planes — nx, ny, nz, d each in the geometry's space — only each segment's part where n·p ≥ d for every one.)
  segClip.planes = plane && plane.length >= 4 ? plane : null;
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
  if (segClip.skip && segClip.skip.has(sgm)) return;
  const P = g.positions, I = g.indices, ia = I ? I[2 * sgm] : 2 * sgm, ib = I ? I[2 * sgm + 1] : 2 * sgm + 1, a = clipA, b = clipB, eps = 1e-6;
  clipOf(a, M, P, ia); clipOf(b, M, P, ib);
  let s0 = 0, s1 = 1;
  // The clip planes' kept part (clip coordinates are linear along the segment, so are cut at the same parameter): the
  // intersection of each plane's kept interval of it (G19).
  const pl = segClip.planes;
  if (pl) {
    let lo = 0, hi = 1;
    for (let i = 0; i + 3 < pl.length; i += 4) {
      const fa = pl[i] * P[3 * ia] + pl[i + 1] * P[3 * ia + 1] + pl[i + 2] * P[3 * ia + 2] - pl[i + 3], fb = pl[i] * P[3 * ib] + pl[i + 1] * P[3 * ib + 1] + pl[i + 2] * P[3 * ib + 2] - pl[i + 3];
      if (fa < 0 && fb < 0) return;
      if (fa < 0) lo = Math.max(lo, fa / (fa - fb)); else if (fb < 0) hi = Math.min(hi, fa / (fa - fb));
    }
    if (lo >= hi) return;
    if (lo > 0 || hi < 1) {
      const ax = a[0], ay = a[1], aw = a[2], ex = b[0] - ax, ey = b[1] - ay, ew = b[2] - aw;
      a[0] = ax + ex * lo; a[1] = ay + ey * lo; a[2] = aw + ew * lo; b[0] = ax + ex * hi; b[1] = ay + ey * hi; b[2] = aw + ew * hi;
      s0 = lo; s1 = hi;
    }
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

/** Points as the point shader reads them, one instance each (G8): the position (3 floats) and the colour (RGBA8). */
export function pointInstances(g: PreparedGeometry): ArrayBuffer {
  const n = g.elementCount, out = new ArrayBuffer(n * 16), f = new Float32Array(out), u = new Uint32Array(out);
  const P = g.positions, I = g.indices, C = new Uint32Array(g.colors.buffer, g.colors.byteOffset, g.vertexCount);
  for (let s = 0; s < n; s++) { const a = I ? I[s] : s; f[4 * s] = P[3 * a]; f[4 * s + 1] = P[3 * a + 1]; f[4 * s + 2] = P[3 * a + 2]; u[4 * s + 3] = C[a]; }
  return out;
}

/**
 * The point drawn nearest a canvas position (G8): with M the mesh's view-projection, among the points whose centre is within
 * `reach` pixels (CSS) and nearer than `best`, the nearest (ties to the lowest index), skipping those in `skip` and those
 * the plane (in the mesh's space) cuts away; its index and distance in pixels, or null.
 */
export function nearestPoint(g: PreparedGeometry, M: ArrayLike<number>, x: number, y: number, cw: number, ch: number, reach: number, best: number, plane: ArrayLike<number> | null, skip: ReadonlySet<number> | null, accelerate = true): { index: number; distance: number } | null {
  const L = Math.min(best, reach);
  nearPt.index = -1; nearPt.d2 = Infinity; nearPt.limit2 = L * L; nearPt.r2 = reach * reach; nearPt.skip = skip && skip.size ? skip : null;
  nearPt.plane = plane; nearPt.x = x; nearPt.y = y; nearPt.cw = cw; nearPt.ch = ch;
  if (!accelerate || g.elementCount < POINT_BVH_FROM) for (let s = 0; s < g.elementCount; s++) testPoint(g, M, s);
  else {
    // (A node passed over when its screen rectangle is farther than the best so far; ties go to the lowest index either way.)
    const h = bvhOf(g), stack = pointStack;
    stack.length = 0; stack.push(0);
    while (stack.length) {
      const node = stack.pop()!, limit = Math.min(L, Number.isFinite(nearPt.d2) ? Math.sqrt(nearPt.d2) : Infinity);
      if (rectDistance(h.box, 6 * node, M, x, y, cw, ch) > limit + 1e-6 * (1 + limit)) continue;
      if (h.left[node] < 0) { for (let i = h.start[node], e = i + h.count[node]; i < e; i++) testPoint(g, M, h.order[i]); continue; }
      stack.push(h.left[node], h.right[node]);
    }
  }
  return nearPt.index < 0 ? null : { index: nearPt.index, distance: Math.sqrt(nearPt.d2) };
}
const POINT_BVH_FROM = 256, pointStack: number[] = [];
const nearPt = { index: -1, d2: Infinity, limit2: Infinity, r2: 0, skip: null as ReadonlySet<number> | null, plane: null as ArrayLike<number> | null, x: 0, y: 0, cw: 0, ch: 0 };
/** One point against the best so far (`nearPt`): within the reach, nearer than another mesh's best, then the nearest, ties to the lowest index. */
function testPoint(g: PreparedGeometry, M: ArrayLike<number>, s: number): void {
  const q = nearPt;
  if (q.skip && q.skip.has(s)) return;
  const P = g.positions, I = g.indices, a = I ? I[s] : s, px = P[3 * a], py = P[3 * a + 1], pz = P[3 * a + 2], pl = q.plane;
  if (pl && !keptBy(pl, px, py, pz)) return;
  const w = M[3] * px + M[7] * py + M[11] * pz + M[15];
  if (w < 1e-6) return;
  const dx = ((M[0] * px + M[4] * py + M[8] * pz + M[12]) / w * 0.5 + 0.5) * q.cw - q.x, dy = (0.5 - (M[1] * px + M[5] * py + M[9] * pz + M[13]) / w * 0.5) * q.ch - q.y, d2 = dx * dx + dy * dy;
  if (d2 > q.r2 || d2 >= q.limit2) return;
  if (q.index >= 0 && (d2 > q.d2 || (d2 === q.d2 && s > q.index))) return;
  q.index = s; q.d2 = d2;
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
