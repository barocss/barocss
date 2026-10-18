// R9 (D85): how far one triangle mesh is from another, measured — each sample of the first (its vertices and its
// triangles' centres) to the nearest point of the second's surface, through a bounding-volume hierarchy of its
// triangles (median splits along the longest axis, leaves of up to 4; a branch-and-bound search, nearer child first).
// One way only: a mesh's distance to another and back are both asked for a Hausdorff distance.

export interface MeshDistance { readonly maxMM: number; readonly sumSq: number; readonly samples: number; readonly at: readonly [number, number, number] | null }

interface Tree { lo: Float64Array; hi: Float64Array; left: Int32Array; start: Int32Array; count: Int32Array; order: Int32Array; nodes: number }
const LEAF = 4;

/** From mesh A's vertices and triangle centres to mesh B's surface: the largest distance (and where), the squares' sum. */
export function meshDistance(pa: ArrayLike<number>, ia: ArrayLike<number>, pb: ArrayLike<number>, ib: ArrayLike<number>): MeshDistance {
  const P = pb instanceof Float64Array ? pb : Float64Array.from(pb), I = ib instanceof Uint32Array ? ib : Uint32Array.from(ib);
  if (!(I.length >= 3)) return { maxMM: Infinity, sumSq: Infinity, samples: 0, at: null };
  const tree = buildTree(P, I), stack = new Int32Array(128);
  let max = 0, sum = 0, n = 0, ax = 0, ay = 0, az = 0, found = false;
  const nv = pa.length / 3, nt = ia.length / 3;
  for (let k = 0; k < nv + nt; k++) {
    let x: number, y: number, z: number;
    if (k < nv) { x = pa[3 * k]; y = pa[3 * k + 1]; z = pa[3 * k + 2]; }
    else { const t = k - nv, a = 3 * ia[3 * t], b = 3 * ia[3 * t + 1], c = 3 * ia[3 * t + 2]; x = (pa[a] + pa[b] + pa[c]) / 3; y = (pa[a + 1] + pa[b + 1] + pa[c + 1]) / 3; z = (pa[a + 2] + pa[b + 2] + pa[c + 2]) / 3; }
    const d2 = nearest2(tree, P, I, x, y, z, stack);
    sum += d2; n++;
    if (d2 > max || !found) { max = d2; ax = x; ay = y; az = z; found = true; }
  }
  return { maxMM: Math.sqrt(max), sumSq: sum, samples: n, at: found ? [ax, ay, az] : null };
}

function buildTree(P: Float64Array, I: Uint32Array): Tree {
  // (A node splits only past LEAF triangles, into halves of two or more: at most nt nodes.)
  const nt = I.length / 3, cap = Math.max(1, nt);
  const t: Tree = { lo: new Float64Array(3 * cap), hi: new Float64Array(3 * cap), left: new Int32Array(cap).fill(-1), start: new Int32Array(cap), count: new Int32Array(cap), order: new Int32Array(nt), nodes: 1 };
  const cx = new Float64Array(3 * nt);
  for (let k = 0; k < nt; k++) {
    t.order[k] = k;
    for (let a = 0; a < 3; a++) cx[3 * k + a] = (P[3 * I[3 * k] + a] + P[3 * I[3 * k + 1] + a] + P[3 * I[3 * k + 2] + a]) / 3;
  }
  // (An explicit stack of [node, start, count]: no recursion on a million triangles.)
  const todo: number[] = [0, 0, nt];
  while (todo.length) {
    const count = todo.pop()!, start = todo.pop()!, node = todo.pop()!;
    t.start[node] = start; t.count[node] = count;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let k = start; k < start + count; k++) for (let j = 0; j < 3; j++) {
      const p = 3 * I[3 * t.order[k] + j];
      if (P[p] < x0) x0 = P[p]; if (P[p] > x1) x1 = P[p]; if (P[p + 1] < y0) y0 = P[p + 1]; if (P[p + 1] > y1) y1 = P[p + 1]; if (P[p + 2] < z0) z0 = P[p + 2]; if (P[p + 2] > z1) z1 = P[p + 2];
    }
    t.lo[3 * node] = x0; t.lo[3 * node + 1] = y0; t.lo[3 * node + 2] = z0; t.hi[3 * node] = x1; t.hi[3 * node + 1] = y1; t.hi[3 * node + 2] = z1;
    if (count <= LEAF) continue;
    const axis = x1 - x0 >= y1 - y0 && x1 - x0 >= z1 - z0 ? 0 : y1 - y0 >= z1 - z0 ? 1 : 2, half = count >> 1;
    select(t.order, cx, axis, start, start + count - 1, start + half);
    const l = t.nodes++, r = t.nodes++;
    t.left[node] = l;
    todo.push(l, start, half, r, start + half, count - half);
  }
  return t;
}
/** order[lo..hi] partly sorted by centroid on `axis` so that order[k] is in its sorted place (quickselect). */
function select(order: Int32Array, cx: Float64Array, axis: number, lo: number, hi: number, k: number): void {
  while (hi > lo) {
    const pivot = cx[3 * order[(lo + hi) >> 1] + axis];
    let i = lo, j = hi;
    while (i <= j) {
      while (cx[3 * order[i] + axis] < pivot) i++;
      while (cx[3 * order[j] + axis] > pivot) j--;
      if (i <= j) { const s = order[i]; order[i] = order[j]; order[j] = s; i++; j--; }
    }
    if (k <= j) hi = j; else if (k >= i) lo = i; else return;
  }
}
/** The squared distance from a box to a point (0 inside). */
function box2(t: Tree, n: number, x: number, y: number, z: number): number {
  const dx = Math.max(t.lo[3 * n] - x, 0, x - t.hi[3 * n]), dy = Math.max(t.lo[3 * n + 1] - y, 0, y - t.hi[3 * n + 1]), dz = Math.max(t.lo[3 * n + 2] - z, 0, z - t.hi[3 * n + 2]);
  return dx * dx + dy * dy + dz * dz;
}
function nearest2(t: Tree, P: Float64Array, I: Uint32Array, x: number, y: number, z: number, stack: Int32Array): number {
  let best = Infinity, sp = 0;
  stack[sp++] = 0;
  while (sp) {
    const n = stack[--sp];
    if (box2(t, n, x, y, z) >= best) continue;
    const l = t.left[n];
    if (l < 0) {
      for (let k = t.start[n]; k < t.start[n] + t.count[n]; k++) { const d = triangle2(P, I, t.order[k], x, y, z); if (d < best) best = d; }
      continue;
    }
    // (The nearer child searched first: pushed last.)
    const r = l + 1, dl = box2(t, l, x, y, z), dr = box2(t, r, x, y, z);
    if (sp + 2 > stack.length) throw new RangeError('meshDistance: the hierarchy is deeper than its stack');
    if (dl < dr) { if (dr < best) stack[sp++] = r; if (dl < best) stack[sp++] = l; }
    else { if (dl < best) stack[sp++] = l; if (dr < best) stack[sp++] = r; }
  }
  return best;
}
/** The squared distance from a point to triangle k (the closest point by its Voronoi regions, Ericson 5.1.5). */
function triangle2(P: Float64Array, I: Uint32Array, k: number, px: number, py: number, pz: number): number {
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
