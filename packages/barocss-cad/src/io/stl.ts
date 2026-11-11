// Binary STL (little-endian): an 80-byte header, the triangle count, then per triangle its unit normal
// (from the winding; zero area gives a zero normal), three corners and a zero attribute word.

import { BarocssError } from '../core/barocss-error.js';
import { binary64Dyadic } from '../core/dyadic.js';

type StlRefusal = 'STL_FLOAT32_COLLAPSE' | 'STL_FLOAT32_RANGE';
const refusedStl = (code: StlRefusal, detail: string) => new BarocssError(code, detail, 'export');

function cross(p: ArrayLike<number>): [number, number, number] {
  const ux = p[3] - p[0], uy = p[4] - p[1], uz = p[5] - p[2];
  const vx = p[6] - p[0], vy = p[7] - p[1], vz = p[8] - p[2];
  return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
}

/** For finite binary32 coordinates the difference products neither overflow nor underflow binary64. */
function hasClearEncodedArea(p: Float32Array): boolean {
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3, k = (i + 2) % 3;
    const left = (p[3 + j] - p[j]) * (p[6 + k] - p[k]);
    const right = (p[3 + k] - p[k]) * (p[6 + j] - p[j]);
    // Conservative bound for two differences per product, the products and their subtraction.
    if (Math.abs(left - right) > 16 * Number.EPSILON * (Math.abs(left) + Math.abs(right))) return true;
  }
  return false;
}

function collinear(p: ArrayLike<number>): boolean {
  const terms = Array.from(p, binary64Dyadic);
  const exponent = Math.max(...terms.map(value => value.k));
  const q = terms.map(value => value.m << BigInt(exponent - value.k));
  const ux = q[3] - q[0], uy = q[4] - q[1], uz = q[5] - q[2];
  const vx = q[6] - q[0], vy = q[7] - q[1], vz = q[8] - q[2];
  return uy * vz === uz * vy && uz * vx === ux * vz && ux * vy === uy * vx;
}

/** Binary STL of triangles `indices` (three per triangle) into `positions` (x, y, z per vertex, mm). */
export function encodeBinaryStl(positions: ArrayLike<number>, indices: ArrayLike<number>, header = '', options: { readonly normalsFromEncodedVertices?: boolean } = {}): Uint8Array {
  const n = Math.floor(indices.length / 3), out = new Uint8Array(84 + 50 * n), view = new DataView(out.buffer), p = positions;
  const original = new Float64Array(9), encoded = new Float32Array(9);
  // (Header characters as 7-bit ASCII, at most 80.)
  for (let i = 0; i < Math.min(80, header.length); i++) out[i] = header.charCodeAt(i) & 0x7f;
  view.setUint32(80, n, true);
  for (let t = 0; t < n; t++) {
    let rounded = false;
    for (let v = 0; v < 3; v++) {
      const start = indices[t * 3 + v] * 3;
      for (let k = 0; k < 3; k++) {
        const i = v * 3 + k;
        const value = p[start + k];
        original[i] = value;
        encoded[i] = value;
        if (!Number.isFinite(encoded[i])) throw refusedStl('STL_FLOAT32_RANGE', `STL triangle ${t + 1} has a coordinate that cannot be written as a finite Float32.`);
        rounded ||= original[i] !== encoded[i];
      }
    }
    if (rounded && !hasClearEncodedArea(encoded) && collinear(encoded) && !collinear(original)) {
      throw refusedStl('STL_FLOAT32_COLLAPSE', `STL triangle ${t + 1} collapses when its vertices are written as Float32.`);
    }
    let [nx, ny, nz] = cross(options.normalsFromEncodedVertices ? encoded : original);
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    let o = 84 + 50 * t;
    for (const x of [nx, ny, nz]) { view.setFloat32(o, x, true); o += 4; }
    for (const x of encoded) { view.setFloat32(o, x, true); o += 4; }
  }
  return out;
}
