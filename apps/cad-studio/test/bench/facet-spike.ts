// F0 spike (measurement only): a mesh body kept as typed arrays and grouped into facet regions by normal
// angle, instead of a planar B-rep face per triangle. For each fixture and angle: the regions and the edges
// between them, the memory the arrays take, and what display, picking, point classification and mass cost
// on them. Nothing here is product code; it sizes R3 (facet faces). Run: pnpm bench:mesh --facets [fixture ...]
import { encodeBinaryStl, readStl } from '@barocss/cad';
import { meshInMM } from '@barocss/cad-model/engine/meshImport';
import { fixtures, random } from './mesh-fixtures';

const ms = (t0: number) => +(performance.now() - t0).toFixed(1);
const MB = (bytes: number) => +(bytes / 2 ** 20).toFixed(1);

/** Triangle adjacency across each edge (the triangle on the other side, or -1), from the welded indices. */
function neighbours(I: Uint32Array, vertices: number): Int32Array {
  const n = I.length / 3, across = new Int32Array(3 * n).fill(-1), open = new Map<number, number>();
  for (let t = 0; t < n; t++) for (let k = 0; k < 3; k++) {
    const a = I[3 * t + k], b = I[3 * t + (k + 1) % 3], back = open.get(b * vertices + a);
    if (back !== undefined) { across[3 * t + k] = back; across[back] = 3 * t + k; open.delete(b * vertices + a); }
    else open.set(a * vertices + b, 3 * t + k);
  }
  return across;
}

/** Unit normals and areas per triangle. */
function triangleNormals(P: Float64Array, I: Uint32Array): { N: Float64Array; A: Float64Array } {
  const n = I.length / 3, N = new Float64Array(3 * n), A = new Float64Array(n);
  for (let t = 0; t < n; t++) {
    const a = 3 * I[3 * t], b = 3 * I[3 * t + 1], c = 3 * I[3 * t + 2];
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx, l = Math.hypot(x, y, z);
    A[t] = l / 2; if (l > 0) { N[3 * t] = x / l; N[3 * t + 1] = y / l; N[3 * t + 2] = z / l; }
  }
  return { N, A };
}

/**
 * Regions grown from seeds (breadth first). 'seed': a neighbour joins while its normal is within `angle` of the
 * seed's (near-flat patches). 'crease': it joins across any edge whose dihedral angle is under `angle` (regions
 * end at sharp edges only), up to `cap` triangles a region.
 */
function regions(N: Float64Array, across: Int32Array, angle: number, mode: 'seed' | 'crease', cap: number): { region: Uint32Array; count: number } {
  const n = N.length / 3, region = new Uint32Array(n).fill(0xffffffff), cos = Math.cos(angle * Math.PI / 180), queue = new Int32Array(n);
  let count = 0;
  for (let s = 0; s < n; s++) {
    if (region[s] !== 0xffffffff) continue;
    const r = count++, sx = N[3 * s], sy = N[3 * s + 1], sz = N[3 * s + 2];
    let head = 0, tail = 0, size = 1; queue[tail++] = s; region[s] = r;
    while (head < tail) {
      const t = queue[head++];
      for (let k = 0; k < 3 && size < cap; k++) {
        const o = across[3 * t + k]; if (o < 0) continue;
        const u = (o / 3) | 0;
        if (region[u] !== 0xffffffff) continue;
        const d = mode === 'seed' ? N[3 * u] * sx + N[3 * u + 1] * sy + N[3 * u + 2] * sz : N[3 * u] * N[3 * t] + N[3 * u + 1] * N[3 * t + 1] + N[3 * u + 2] * N[3 * t + 2];
        if (d < cos) continue;
        region[u] = r; queue[tail++] = u; size++;
      }
    }
  }
  return { region, count };
}

/** Mesh edges between two regions, and the B-rep edges they chain into (polylines between junction vertices). */
function regionEdges(I: Uint32Array, across: Int32Array, region: Uint32Array, vertices: number): { segments: number; edges: number } {
  const n = I.length / 3, degree = new Uint8Array(vertices);
  let segments = 0;
  for (let t = 0; t < n; t++) for (let k = 0; k < 3; k++) {
    const o = across[3 * t + k]; if (o < 0 || region[(o / 3) | 0] === region[t] || o < 3 * t + k) continue;
    segments++; const a = I[3 * t + k], b = I[3 * t + (k + 1) % 3];
    if (degree[a] < 255) degree[a]++; if (degree[b] < 255) degree[b]++;
  }
  // A polyline edge ends at a vertex where boundary segments meet other than two at a time (a junction).
  let ends = 0; for (let v = 0; v < vertices; v++) if (degree[v] && degree[v] !== 2) ends++;
  return { segments, edges: Math.max(ends / 2, 0) };
}

/** A BVH over the triangles (median split on the longest centre extent), flat in typed arrays. */
interface Bvh { box: Float64Array; left: Int32Array; start: Int32Array; count: Int32Array; order: Uint32Array; nodes: number }
function buildBvh(P: Float64Array, I: Uint32Array): Bvh {
  const n = I.length / 3, order = new Uint32Array(n), c = new Float64Array(3 * n), tb = new Float64Array(6 * n);
  for (let t = 0; t < n; t++) {
    order[t] = t;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let k = 0; k < 3; k++) { const v = 3 * I[3 * t + k], x = P[v], y = P[v + 1], z = P[v + 2]; if (x < x0) x0 = x; if (y < y0) y0 = y; if (z < z0) z0 = z; if (x > x1) x1 = x; if (y > y1) y1 = y; if (z > z1) z1 = z; }
    tb[6 * t] = x0; tb[6 * t + 1] = y0; tb[6 * t + 2] = z0; tb[6 * t + 3] = x1; tb[6 * t + 4] = y1; tb[6 * t + 5] = z1;
    c[3 * t] = (x0 + x1) / 2; c[3 * t + 1] = (y0 + y1) / 2; c[3 * t + 2] = (z0 + z1) / 2;
  }
  const cap = 2 * n + 1, box = new Float64Array(6 * cap), left = new Int32Array(cap), start = new Int32Array(cap), count = new Int32Array(cap);
  const todo = new Int32Array(2 * 64 * 2), b = new Float64Array(6), cb = new Float64Array(6);
  let nodes = 1, top = 0; todo[top++] = 0; start[0] = 0; count[0] = n;
  while (top) {
    const id = todo[--top], lo = start[id], hi = lo + count[id];
    b.set([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]); cb.set(b);
    for (let i = lo; i < hi; i++) { const t = order[i]; for (let k = 0; k < 3; k++) { if (tb[6 * t + k] < b[k]) b[k] = tb[6 * t + k]; if (tb[6 * t + k + 3] > b[k + 3]) b[k + 3] = tb[6 * t + k + 3]; if (c[3 * t + k] < cb[k]) cb[k] = c[3 * t + k]; if (c[3 * t + k] > cb[k + 3]) cb[k + 3] = c[3 * t + k]; } }
    box.set(b, 6 * id); left[id] = -1;
    if (hi - lo <= 4) continue;
    let ax = 0; for (let k = 1; k < 3; k++) if (cb[k + 3] - cb[k] > cb[ax + 3] - cb[ax]) ax = k;
    const mid = (cb[ax] + cb[ax + 3]) / 2;
    let i = lo, j = hi - 1;
    while (i <= j) { if (c[3 * order[i] + ax] < mid) i++; else { const x = order[i]; order[i] = order[j]; order[j] = x; j--; } }
    if (i === lo || i === hi) i = (lo + hi) >> 1;
    const l = nodes++, r = nodes++;
    left[id] = l; start[l] = lo; count[l] = i - lo; start[r] = i; count[r] = hi - i; count[id] = 0;
    todo[top++] = l; todo[top++] = r;
  }
  return { box, left, start, count, order, nodes };
}
const stack = new Int32Array(256);
/** The nearest triangle a ray hits (Möller–Trumbore, both sides), or -1; its distance in `hitT[0]`. */
const hitT = new Float64Array(1);
function ray(bvh: Bvh, P: Float64Array, I: Uint32Array, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): number {
  const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
  let best = Infinity, tri = -1, top = 0; stack[top++] = 0;
  while (top) {
    const id = stack[--top], B = 6 * id;
    let t0 = (bvh.box[B] - ox) * ix, t1 = (bvh.box[B + 3] - ox) * ix; if (t0 > t1) { const x = t0; t0 = t1; t1 = x; }
    let u0 = (bvh.box[B + 1] - oy) * iy, u1 = (bvh.box[B + 4] - oy) * iy; if (u0 > u1) { const x = u0; u0 = u1; u1 = x; }
    let w0 = (bvh.box[B + 2] - oz) * iz, w1 = (bvh.box[B + 5] - oz) * iz; if (w0 > w1) { const x = w0; w0 = w1; w1 = x; }
    const near = Math.max(t0, u0, w0, 0), far = Math.min(t1, u1, w1);
    if (near > far || near > best) continue;
    if (bvh.left[id] >= 0) { stack[top++] = bvh.left[id]; stack[top++] = bvh.left[id] + 1; continue; }
    for (let i = bvh.start[id], e = i + bvh.count[id]; i < e; i++) {
      const t = bvh.order[i], a = 3 * I[3 * t], b = 3 * I[3 * t + 1], c = 3 * I[3 * t + 2];
      const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2], e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
      const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, det = e1x * px + e1y * py + e1z * pz;
      if (Math.abs(det) < 1e-18) continue;
      const inv = 1 / det, sx = ox - P[a], sy = oy - P[a + 1], sz = oz - P[a + 2], u = (sx * px + sy * py + sz * pz) * inv;
      if (u < 0 || u > 1) continue;
      const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x, v = (dx * qx + dy * qy + dz * qz) * inv;
      if (v < 0 || u + v > 1) continue;
      const d = (e2x * qx + e2y * qy + e2z * qz) * inv;
      if (d > 0 && d < best) { best = d; tri = t; }
    }
  }
  hitT[0] = best;
  return tri;
}

/** Volume, centroid and inertia about the origin of a closed oriented mesh, by the divergence theorem (exact for the facets). */
function massOf(P: Float64Array, I: Uint32Array): { volume: number; centroid: number[]; inertia: number[] } {
  let V = 0, cx = 0, cy = 0, cz = 0, xx = 0, yy = 0, zz = 0, xy = 0, yz = 0, zx = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = 3 * I[t], b = 3 * I[t + 1], c = 3 * I[t + 2];
    const x0 = P[a], y0 = P[a + 1], z0 = P[a + 2], x1 = P[b], y1 = P[b + 1], z1 = P[b + 2], x2 = P[c], y2 = P[c + 1], z2 = P[c + 2];
    const d = x0 * (y1 * z2 - y2 * z1) - y0 * (x1 * z2 - x2 * z1) + z0 * (x1 * y2 - x2 * y1), v = d / 6;
    V += v; cx += v * (x0 + x1 + x2) / 4; cy += v * (y0 + y1 + y2) / 4; cz += v * (z0 + z1 + z2) / 4;
    // Second moments of the tetrahedron (origin, a, b, c): d/60 · (Σ x_i² + (Σ x_i)²) and likewise for products.
    const sx = x0 + x1 + x2, sy = y0 + y1 + y2, sz = z0 + z1 + z2;
    xx += d / 120 * (x0 * x0 + x1 * x1 + x2 * x2 + sx * sx); yy += d / 120 * (y0 * y0 + y1 * y1 + y2 * y2 + sy * sy); zz += d / 120 * (z0 * z0 + z1 * z1 + z2 * z2 + sz * sz);
    xy += d / 120 * (x0 * y0 + x1 * y1 + x2 * y2 + sx * sy); yz += d / 120 * (y0 * z0 + y1 * z1 + y2 * z2 + sy * sz); zx += d / 120 * (z0 * x0 + z1 * x1 + z2 * x2 + sz * sx);
  }
  return { volume: V, centroid: [cx / V, cy / V, cz / V], inertia: [yy + zz, zz + xx, xx + yy, -xy, -yz, -zx] };
}

/** The display buffers a facet body hands the viewer: each region's triangles with smooth normals inside it (split at region edges). */
function display(P: Float64Array, I: Uint32Array, region: Uint32Array, N: Float64Array, A: Float64Array, vertices: number): { positions: Float32Array; normals: Float32Array; indices: Uint32Array; faceOfVertex: Float32Array } {
  // A vertex is copied once per region it touches (key: vertex × region, found through a per-vertex list).
  const n = I.length / 3, first = new Int32Array(vertices).fill(-1), nextOf = new Int32Array(3 * n), regionOf = new Uint32Array(3 * n), vertexOf = new Uint32Array(3 * n);
  const indices = new Uint32Array(3 * n), acc = new Float64Array(9 * n);
  let out = 0;
  for (let t = 0; t < n; t++) for (let k = 0; k < 3; k++) {
    const v = I[3 * t + k], r = region[t];
    let s = first[v]; while (s >= 0 && regionOf[s] !== r) s = nextOf[s];
    if (s < 0) { s = out++; regionOf[s] = r; vertexOf[s] = v; nextOf[s] = first[v]; first[v] = s; }
    indices[3 * t + k] = s; acc[3 * s] += N[3 * t] * A[t]; acc[3 * s + 1] += N[3 * t + 1] * A[t]; acc[3 * s + 2] += N[3 * t + 2] * A[t];
  }
  const positions = new Float32Array(3 * out), normals = new Float32Array(3 * out), faceOfVertex = new Float32Array(out);
  for (let s = 0; s < out; s++) {
    const v = 3 * vertexOf[s], l = Math.hypot(acc[3 * s], acc[3 * s + 1], acc[3 * s + 2]) || 1;
    positions[3 * s] = P[v]; positions[3 * s + 1] = P[v + 1]; positions[3 * s + 2] = P[v + 2];
    normals[3 * s] = acc[3 * s] / l; normals[3 * s + 1] = acc[3 * s + 1] / l; normals[3 * s + 2] = acc[3 * s + 2] / l; faceOfVertex[s] = regionOf[s];
  }
  return { positions, normals, indices, faceOfVertex };
}

const all = fixtures(), names = process.argv.slice(2).length ? process.argv.slice(2) : ['organic-20k', 'organic-200k', 'scan-200k', 'organic-1000k'];
for (const name of names) {
  const f = all.get(name)!(), welded = meshInMM({ positions: readStl(encodeBinaryStl(f.positions, f.indices, name)), indices: null }, 'mm');
  if (global.gc) global.gc();
  const heap0 = process.memoryUsage().heapUsed + process.memoryUsage().arrayBuffers;
  let t = performance.now();
  const P = Float64Array.from(welded.positions), I = Uint32Array.from(welded.indices), vertices = P.length / 3, n = I.length / 3;
  const across = neighbours(I, vertices), { N, A } = triangleNormals(P, I);
  const setup = { ms: ms(t), open: across.reduce((s, x) => s + (x < 0 ? 1 : 0), 0) };
  t = performance.now(); const bvh = buildBvh(P, I); const bvhMS = ms(t);
  // Picking: 1000 rays from outside towards the body; classification: 1000 points, inside when the nearest hit faces away.
  const rnd = random(11); t = performance.now(); let hits = 0;
  for (let k = 0; k < 1000; k++) { const a = rnd() * 2 * Math.PI; if (ray(bvh, P, I, 120 * Math.cos(a), 120 * Math.sin(a), 30 * (rnd() - 0.5), -Math.cos(a), -Math.sin(a), 0) >= 0) hits++; }
  const pickMS = ms(t); t = performance.now(); let inside = 0;
  for (let k = 0; k < 1000; k++) {
    const x = 120 * (rnd() - 0.5), y = 120 * (rnd() - 0.5), z = 40 * (rnd() - 0.5), dx = rnd() - 0.5, dy = rnd() - 0.5, dz = rnd() - 0.5, l = Math.hypot(dx, dy, dz);
    const tri = ray(bvh, P, I, x, y, z, dx / l, dy / l, dz / l);
    if (tri >= 0 && N[3 * tri] * dx + N[3 * tri + 1] * dy + N[3 * tri + 2] * dz > 0) inside++;
  }
  const classifyMS = ms(t);
  t = performance.now(); const mass = massOf(P, I); const massMS = ms(t);
  for (const [mode, angle, cap] of [['seed', 20, Infinity], ['seed', 45, Infinity], ['crease', 30, Infinity], ['crease', 30, 16384], ['crease', 60, 16384]] as const) {
    t = performance.now(); const { region, count } = regions(N, across, angle, mode, cap); const regionMS = ms(t);
    t = performance.now(); const e = regionEdges(I, across, region, vertices); const edgeMS = ms(t);
    t = performance.now(); const d = display(P, I, region, N, A, vertices); const displayMS = ms(t);
    const kept = P.byteLength + I.byteLength + region.byteLength + N.byteLength + across.byteLength + bvh.box.byteLength + bvh.left.byteLength + bvh.start.byteLength + bvh.count.byteLength + bvh.order.byteLength;
    console.log(JSON.stringify({ fixture: name, triangles: n, mode, angle, cap: cap === Infinity ? null : cap, regions: count, regionEdges: e.edges, edgeSegments: e.segments, regionMS, edgeMS, displayMS, displayVertices: d.positions.length / 3, keptMB: MB(kept), displayMB: MB(d.positions.byteLength + d.normals.byteLength + d.indices.byteLength + d.faceOfVertex.byteLength) }));
  }
  const heap = process.memoryUsage().heapUsed + process.memoryUsage().arrayBuffers - heap0;
  console.log(JSON.stringify({ fixture: name, triangles: n, setupMS: setup.ms, openEdges: setup.open, bvhMS, bvhNodes: bvh.nodes, pick1000MS: pickMS, hits, classify1000MS: classifyMS, inside, massMS, volume: +mass.volume.toFixed(1), heapGrowthMB: MB(heap), maxRSSMB: Math.round(process.resourceUsage().maxRSS / 1024) }));
}
