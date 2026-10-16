// Geometry kept on the CPU (so it can be re-uploaded after a device loss and ray-cast for picking) and
// its vertex data as the viewer uploads it: positions, normals and linear RGBA8 colours.
import { boxOfPositions, type Box3 } from './bounds.js';
import { cross, dot, srgbToLinear, sub, type Vec3 } from './math.js';

export interface GeometryInput {
  /** x, y, z per vertex. */
  positions: ArrayLike<number>;
  /** Per vertex; computed (smooth over shared vertices) when left out. */
  normals?: ArrayLike<number>;
  /** sRGB colours per vertex, 0–1: three (rgb) or four (rgba) numbers each. */
  colors?: ArrayLike<number>;
  /** Triangles (or segment pairs for lines); vertices in order when left out. */
  indices?: ArrayLike<number>;
  /** Triangles (default) or line segments. */
  topology?: 'triangles' | 'lines';
}

export interface PreparedGeometry {
  topology: 'triangles' | 'lines';
  positions: Float32Array; normals: Float32Array; colors: Uint8Array;
  indices: Uint32Array | Uint16Array | null;
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
  const colors = new Uint8Array(vertexCount * 4).fill(255);
  if (input.colors) {
    const c = input.colors, k = c.length === vertexCount * 4 ? 4 : c.length === vertexCount * 3 ? 3 : 0;
    if (!k) throw new RangeError('colors must hold three or four numbers per vertex');
    for (let v = 0; v < vertexCount; v++) {
      for (let j = 0; j < 3; j++) colors[v * 4 + j] = Math.round(srgbToLinear(Math.min(1, Math.max(0, c[v * k + j]))) * 255);
      if (k === 4) colors[v * 4 + 3] = Math.round(Math.min(1, Math.max(0, c[v * k + 3])) * 255);
    }
  }
  return { topology, positions, normals, colors, indices, vertexCount, elementCount, bounds: boxOfPositions(positions) };
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

/** The nearest triangle a ray (in the geometry's own space) hits: its index and distance along the ray. */
export function rayTriangles(g: PreparedGeometry, origin: Vec3, direction: Vec3): { triangle: number; t: number } | null {
  if (g.topology !== 'triangles') return null;
  const P = g.positions, I = g.indices, at = (i: number): Vec3 => [P[3 * i], P[3 * i + 1], P[3 * i + 2]];
  let best: { triangle: number; t: number } | null = null;
  for (let t = 0; t < g.elementCount; t += 3) {
    const a = at(I ? I[t] : t), b = at(I ? I[t + 1] : t + 1), c = at(I ? I[t + 2] : t + 2);
    // Möller–Trumbore, both faces.
    const e1 = sub(b, a), e2 = sub(c, a), p = cross(direction, e2), det = dot(e1, p);
    if (Math.abs(det) < 1e-20) continue;
    const inv = 1 / det, s = sub(origin, a), u = dot(s, p) * inv;
    if (u < -1e-7 || u > 1 + 1e-7) continue;
    const q = cross(s, e1), v = dot(direction, q) * inv;
    if (v < -1e-7 || u + v > 1 + 1e-7) continue;
    const d = dot(e2, q) * inv;
    if (d > 0 && (!best || d < best.t)) best = { triangle: t / 3, t: d };
  }
  return best;
}
