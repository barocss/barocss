// K2 (D141): one bounding-volume hierarchy over a triangle mesh (positions, three indices a triangle), and its two
// queries: the nearest hit along a ray, and the nearest point of the surface to a point. It replaces three trees that
// grew apart — facet bodies' point classification (F0, R3.2), the mesh distance (R9) and the studio's print, mould and
// machining rays (AM4) — and the studio's uniform grid (A2.2) and brute-force rays. Built once: median splits (by
// quickselect) on the longest side of a node's box, leaves of at most `leafSize` triangles (4), flat typed arrays, an
// explicit stack. A query allocates nothing.

/** The hierarchy and its mesh. Per node: its box [x0, y0, z0, x1, y1, z1]; its first child (the second is next), or −1 for a leaf; a leaf's triangles order[start, start + count). */
export interface TriangleBvh {
  readonly positions: Float64Array; readonly indices: Uint32Array;
  readonly box: Float64Array; readonly left: Int32Array; readonly start: Int32Array; readonly count: Int32Array; readonly order: Uint32Array;
  readonly nodes: number;
  /** The largest coordinate's magnitude (at least 1): a scale for tolerances. */
  readonly size: number;
}
export interface TriangleBvhOptions { readonly leafSize?: number }

/** The hierarchy over a mesh's triangles. Typed arrays are taken as they are (a Float64Array and a Uint32Array are not copied). */
export function triangleBvh(positions: ArrayLike<number>, indices: ArrayLike<number>, options: TriangleBvhOptions = {}): TriangleBvh {
  const P = positions instanceof Float64Array ? positions : Float64Array.from(positions), I = indices instanceof Uint32Array ? indices : Uint32Array.from(indices);
  const leaf = Math.max(1, Math.floor(options.leafSize ?? 4)), nt = Math.floor(I.length / 3);
  const cx = new Float64Array(3 * nt), order = new Uint32Array(nt);
  let size = 1;
  for (let t = 0; t < nt; t++) {
    order[t] = t;
    for (let k = 0; k < 3; k++) {
      const a = P[3 * I[3 * t] + k], b = P[3 * I[3 * t + 1] + k], c = P[3 * I[3 * t + 2] + k];
      cx[3 * t + k] = (a + b + c) / 3;
      size = Math.max(size, Math.abs(a), Math.abs(b), Math.abs(c));
    }
  }
  // (A node splits only past `leaf` triangles, into halves: at most 2·nt − 1 nodes.)
  const cap = Math.max(1, 2 * nt), box = new Float64Array(6 * cap), left = new Int32Array(cap).fill(-1), start = new Int32Array(cap), count = new Int32Array(cap), todo = new Int32Array(3 * cap);
  let nodes = 1, top = 0;
  todo[top++] = 0; todo[top++] = 0; todo[top++] = nt;
  while (top) {
    const c = todo[--top], s = todo[--top], n = todo[--top];
    start[n] = s; count[n] = c;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = s; i < s + c; i++) for (let v = 0; v < 3; v++) {
      const p = 3 * I[3 * order[i] + v], x = P[p], y = P[p + 1], z = P[p + 2];
      if (x < x0) x0 = x; if (y < y0) y0 = y; if (z < z0) z0 = z; if (x > x1) x1 = x; if (y > y1) y1 = y; if (z > z1) z1 = z;
    }
    const b = 6 * n; box[b] = x0; box[b + 1] = y0; box[b + 2] = z0; box[b + 3] = x1; box[b + 4] = y1; box[b + 5] = z1;
    if (c <= leaf) continue;
    const ax = x1 - x0 >= y1 - y0 && x1 - x0 >= z1 - z0 ? 0 : y1 - y0 >= z1 - z0 ? 1 : 2, half = c >> 1;
    select(order, cx, ax, s, s + c - 1, s + half);
    const l = nodes++, r = nodes++;
    left[n] = l;
    todo[top++] = l; todo[top++] = s; todo[top++] = half;
    todo[top++] = r; todo[top++] = s + half; todo[top++] = c - half;
  }
  return { positions: P, indices: I, box, left, start, count, order, nodes, size };
}
/** order[lo..hi] partly sorted by centre on `axis` so that order[k] is in its sorted place (quickselect, Hoare). */
function select(order: Uint32Array, cx: Float64Array, axis: number, lo: number, hi: number, k: number): void {
  while (hi > lo) {
    const pivot = cx[3 * order[(lo + hi) >> 1] + axis];
    let i = lo, j = hi;
    while (i <= j) {
      while (cx[3 * order[i] + axis] < pivot) i++;
      while (cx[3 * order[j] + axis] > pivot) j--;
      if (i <= j) { const x = order[i]; order[i] = order[j]; order[j] = x; i++; j--; }
    }
    if (k <= j) hi = j; else if (k >= i) lo = i; else return;
  }
}

let stack = new Int32Array(256);
function grow(): void { const s = new Int32Array(stack.length * 2); s.set(stack); stack = s; }

/**
 * The nearest crossing of the ray o + t·d with the mesh beyond `minT` (default 1e-6, in d's lengths; Möller–Trumbore; a triangle whose determinant is
 * within `detTol` of zero — the ray in its plane — is passed), skipping triangle `skip`; Infinity when there is none.
 * Hits on a triangle's edges count. `d` need not be unit: t is in its lengths.
 */
export function rayHit(bvh: TriangleBvh, o: ArrayLike<number>, d: ArrayLike<number>, minT = 1e-6, skip = -1, detTol = 1e-14): number {
  const P = bvh.positions, I = bvh.indices, B = bvh.box, ox = o[0], oy = o[1], oz = o[2], dx = d[0], dy = d[1], dz = d[2];
  // (An axis d does not move along is tested by comparison, not by its slab: 0·∞ is NaN when the origin lies on a box's
  // face, and the box would be dropped.)
  const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz, fx = dx === 0, fy = dy === 0, fz = dz === 0;
  let best = Infinity, top = 0; stack[top++] = 0;
  while (top) {
    const n = stack[--top], b = 6 * n;
    // The slab test: a box entered before `best` and left after 0.
    let lo = -Infinity, hi = Infinity, t0: number, t1: number;
    if (fx) { if (ox < B[b] || ox > B[b + 3]) continue; } else { t0 = (B[b] - ox) * ix; t1 = (B[b + 3] - ox) * ix; lo = Math.min(t0, t1); hi = Math.max(t0, t1); }
    if (fy) { if (oy < B[b + 1] || oy > B[b + 4]) continue; } else { t0 = (B[b + 1] - oy) * iy; t1 = (B[b + 4] - oy) * iy; lo = Math.max(lo, Math.min(t0, t1)); hi = Math.min(hi, Math.max(t0, t1)); }
    if (fz) { if (oz < B[b + 2] || oz > B[b + 5]) continue; } else { t0 = (B[b + 2] - oz) * iz; t1 = (B[b + 5] - oz) * iz; lo = Math.max(lo, Math.min(t0, t1)); hi = Math.min(hi, Math.max(t0, t1)); }
    if (!(hi >= Math.max(lo, 0)) || lo > best) continue;
    const l = bvh.left[n];
    if (l >= 0) { if (top + 2 > stack.length) grow(); stack[top++] = l; stack[top++] = l + 1; continue; }
    for (let i = bvh.start[n], e = i + bvh.count[n]; i < e; i++) {
      const tri = bvh.order[i]; if (tri === skip) continue;
      const t3 = 3 * tri, a = 3 * I[t3], c = 3 * I[t3 + 1], f = 3 * I[t3 + 2];
      const e1x = P[c] - P[a], e1y = P[c + 1] - P[a + 1], e1z = P[c + 2] - P[a + 2], e2x = P[f] - P[a], e2y = P[f + 1] - P[a + 1], e2z = P[f + 2] - P[a + 2];
      const hx = dy * e2z - dz * e2y, hy = dz * e2x - dx * e2z, hz = dx * e2y - dy * e2x, det = e1x * hx + e1y * hy + e1z * hz;
      if (det > -detTol && det < detTol) continue;
      const sx = ox - P[a], sy = oy - P[a + 1], sz = oz - P[a + 2], u = (sx * hx + sy * hy + sz * hz) / det;
      if (u < 0 || u > 1) continue;
      const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x, v = (dx * qx + dy * qy + dz * qz) / det;
      if (v < 0 || u + v > 1) continue;
      const t = (e2x * qx + e2y * qy + e2z * qz) / det;
      if (t > minT && t < best) best = t;
    }
  }
  return best;
}

/** The squared distance from a point to a box (0 inside). */
function box2(B: Float64Array, b: number, x: number, y: number, z: number): number {
  const dx = Math.max(B[b] - x, 0, x - B[b + 3]), dy = Math.max(B[b + 1] - y, 0, y - B[b + 4]), dz = Math.max(B[b + 2] - z, 0, z - B[b + 5]);
  return dx * dx + dy * dy + dz * dz;
}
/** The squared distance from a point to the mesh's surface, when less than `bound2` (else `bound2`): branch and bound, the nearer child first. */
export function nearestDistance2(bvh: TriangleBvh, x: number, y: number, z: number, bound2 = Infinity): number {
  const B = bvh.box, P = bvh.positions, I = bvh.indices;
  let best = bound2, top = 0; stack[top++] = 0;
  while (top) {
    const n = stack[--top];
    if (box2(B, 6 * n, x, y, z) >= best) continue;
    const l = bvh.left[n];
    if (l < 0) {
      for (let i = bvh.start[n], e = i + bvh.count[n]; i < e; i++) { const d = pointTriangleDistance2(P, I, bvh.order[i], x, y, z); if (d < best) best = d; }
      continue;
    }
    // (The nearer child searched first: pushed last.)
    const r = l + 1, dl = box2(B, 6 * l, x, y, z), dr = box2(B, 6 * r, x, y, z);
    if (top + 2 > stack.length) grow();
    if (dl < dr) { if (dr < best) stack[top++] = r; if (dl < best) stack[top++] = l; }
    else { if (dl < best) stack[top++] = l; if (dr < best) stack[top++] = r; }
  }
  return best;
}

/** The squared distance from a point to triangle k of a mesh (the closest point by its Voronoi regions, Ericson 5.1.5). */
export function pointTriangleDistance2(P: ArrayLike<number>, I: ArrayLike<number>, k: number, px: number, py: number, pz: number): number {
  const a = 3 * I[3 * k], b = 3 * I[3 * k + 1], c = 3 * I[3 * k + 2];
  const ax = P[a], ay = P[a + 1], az = P[a + 2];
  const abx = P[b] - ax, aby = P[b + 1] - ay, abz = P[b + 2] - az, acx = P[c] - ax, acy = P[c + 1] - ay, acz = P[c + 2] - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  let qx: number, qy: number, qz: number;
  if (d1 <= 0 && d2 <= 0) { qx = ax; qy = ay; qz = az; }
  else {
    const bpx = px - P[b], bpy = py - P[b + 1], bpz = pz - P[b + 2], d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
    const cpx = px - P[c], cpy = py - P[c + 1], cpz = pz - P[c + 2], d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
    const vc = d1 * d4 - d3 * d2, vb = d5 * d2 - d1 * d6, va = d3 * d6 - d5 * d4;
    if (d3 >= 0 && d4 <= d3) { qx = P[b]; qy = P[b + 1]; qz = P[b + 2]; }
    else if (d6 >= 0 && d5 <= d6) { qx = P[c]; qy = P[c + 1]; qz = P[c + 2]; }
    else if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); qx = ax + v * abx; qy = ay + v * aby; qz = az + v * abz; }
    else if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); qx = ax + w * acx; qy = ay + w * acy; qz = az + w * acz; }
    else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); qx = P[b] + w * (P[c] - P[b]); qy = P[b + 1] + w * (P[c + 1] - P[b + 1]); qz = P[b + 2] + w * (P[c + 2] - P[b + 2]); }
    else { const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; qx = ax + abx * v + acx * w; qy = ay + aby * v + acy * w; qz = az + abz * v + acz * w; }
  }
  const dx = px - qx, dy = py - qy, dz = pz - qz;
  return dx * dx + dy * dy + dz * dz;
}
