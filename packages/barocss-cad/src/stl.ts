// Binary STL (little-endian): an 80-byte header, the triangle count, then per triangle its unit normal
// (from the winding; zero area gives a zero normal), three corners and a zero attribute word.

/** Binary STL of triangles `indices` (three per triangle) into `positions` (x, y, z per vertex, mm). */
export function encodeBinaryStl(positions: ArrayLike<number>, indices: ArrayLike<number>, header = ''): Uint8Array {
  const n = Math.floor(indices.length / 3), out = new Uint8Array(84 + 50 * n), view = new DataView(out.buffer), p = positions;
  // (Header characters as 7-bit ASCII, at most 80.)
  for (let i = 0; i < Math.min(80, header.length); i++) out[i] = header.charCodeAt(i) & 0x7f;
  view.setUint32(80, n, true);
  for (let t = 0; t < n; t++) {
    const a = indices[t * 3] * 3, b = indices[t * 3 + 1] * 3, c = indices[t * 3 + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    let o = 84 + 50 * t;
    for (const x of [nx, ny, nz]) { view.setFloat32(o, x, true); o += 4; }
    for (const q of [a, b, c]) for (let k = 0; k < 3; k++) { view.setFloat32(o, p[q + k], true); o += 4; }
  }
  return out;
}
