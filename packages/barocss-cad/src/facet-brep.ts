// Facet faces (F0, R3): a closed triangle mesh as a B-rep whose faces are regions of the mesh, kept as typed
// arrays — not a face per triangle (brepFromTriangles), and not a surface. The mesh is welded (numeric keys,
// no strings), checked closed and consistently wound, turned outward, and grown into regions across edges
// whose dihedral angle is small (creases end a region). A noisy mesh, which would break into thousands of
// regions, is grouped on smoothed normals, and what is still too many is merged into neighbours. Region
// boundaries become polyline edges (degree-1 curves through the mesh's own vertices, so both faces and the
// edge share those points exactly); a closed boundary without a junction gets one vertex. Every shell has at
// least two regions, so every face has a boundary. Faces are named `<id>.region<k>`, k in the order of each
// region's first triangle in the file: the same file gives the same names.
import { assertValidBrep, buildBrep, type Brep, type BrepFaceInput } from './brep-core.js';
import { MeshBrepError, type MeshBrepOptions } from './mesh-brep.js';
import type { Curve, FacetPatch, Point } from './types.js';
import { boundsOf, triangleArea2 } from './facet-patch.js';

export interface FacetBrepOptions extends MeshBrepOptions {
  /** Neighbouring triangles whose normals turn by less than this (degrees) are one region; default 30. */
  readonly creaseDegrees?: number;
  /** At most this many regions (a noisy scan is smoothed, then merged, to stay under it); default 1000. */
  readonly maximumRegions?: number;
}

const UNSET = 0xffffffff;
/** The most points a polyline edge takes (the curve check's limit on control points). */
const POLYLINE = 64;

/** The mesh (x, y, z per vertex; three vertex indices per triangle, or every three vertices one) as a B-rep of facet faces; refused when it is in more than one piece. */
export function facetBrepFromTriangles(positions: ArrayLike<number>, indices: ArrayLike<number> | null, options: FacetBrepOptions = {}): Brep {
  const m = welded(positions, indices, options), pieces = componentsOf(m.across, m.I.length / 3);
  if (pieces.count > 1) throw new MeshBrepError(`the mesh is more than one piece (${pieces.count} pieces): open each piece as its own body`);
  return pieceBrep(m.id, m.P, m.I, options);
}
/**
 * Each closed, connected piece of the mesh as a B-rep of its own (a kit, a figure with separate eyes, a scan
 * with floaters), in order of each piece's first triangle in the file. One piece: named as by
 * facetBrepFromTriangles; more: its body `<id>_part<j>` and faces `<id>.part<j>.region<k>`. Each piece turned
 * outward on its own (a cavity's shell comes in as a solid of its own: repair, R3.4, tells them apart).
 */
export function facetBrepsFromTriangles(positions: ArrayLike<number>, indices: ArrayLike<number> | null, options: FacetBrepOptions = {}): Brep[] {
  const m = welded(positions, indices, options), nt = m.I.length / 3, pieces = componentsOf(m.across, nt);
  if (pieces.count === 1) return [pieceBrep(m.id, m.P, m.I, options)];
  const lists: number[][] = Array.from({ length: pieces.count }, () => []);
  for (let t = 0; t < nt; t++) lists[pieces.of[t]].push(m.I[3 * t], m.I[3 * t + 1], m.I[3 * t + 2]);
  return lists.map((list, j) => {
    if (list.length < 12) throw new MeshBrepError(`piece ${j} of the mesh has fewer than four triangles: it encloses nothing`);
    return pieceBrep(`${m.id}_part${j}`, m.P, Uint32Array.from(list), options, `${m.id}.part${j}`);
  });
}
/** How many closed pieces the mesh is in, and each one's triangle count and enclosed volume (|V|), in file order. */
export function facetPieces(positions: ArrayLike<number>, indices: ArrayLike<number> | null, options: FacetBrepOptions = {}): { triangles: number; volumeMM3: number }[] {
  const m = welded(positions, indices, options), nt = m.I.length / 3, pieces = componentsOf(m.across, nt);
  const out = Array.from({ length: pieces.count }, () => ({ triangles: 0, volumeMM3: 0 }));
  for (let t = 0; t < nt; t++) { const o = out[pieces.of[t]]; o.triangles++; o.volumeMM3 += det3(m.P, m.I[3 * t], m.I[3 * t + 1], m.I[3 * t + 2]) / 6; }
  for (const o of out) o.volumeMM3 = Math.abs(o.volumeMM3);
  return out;
}

/** The mesh welded, its degenerate triangles dropped, checked closed and consistently wound (every piece). */
function welded(positions: ArrayLike<number>, indices: ArrayLike<number> | null, options: FacetBrepOptions): { id: string; P: Float64Array; I: Uint32Array; across: Int32Array } {
  const id = (options.id ?? 'mesh').replace(/[^A-Za-z0-9_-]/g, '_').replace(/^(?=[^A-Za-z_])/, '_');
  const n = positions.length / 3, count = indices ? indices.length / 3 : n / 3, limit = options.maximumTriangles ?? 200_000;
  if (!Number.isInteger(n) || !Number.isInteger(count)) throw new MeshBrepError('the mesh needs three numbers per vertex and three vertices per triangle');
  if (count > limit) throw new MeshBrepError(`the mesh has ${count} triangles, more than the ${limit} read`);
  let size = 0;
  for (let i = 0; i < positions.length; i++) { const x = positions[i]; if (!Number.isFinite(x)) throw new MeshBrepError('the mesh has a coordinate that is not a finite number'); if (Math.abs(x) > size) size = Math.abs(x); }
  const weld = options.weldMM ?? Math.max(1e-9, size * 1e-6);
  const { P, remap } = weldVertices(positions, n, weld);
  const nv = P.length / 3;
  // Triangles without the degenerate ones (a repeated corner, or no area at the weld size).
  const T: number[] = [];
  for (let t = 0; t < count; t++) {
    const a = remap[indices ? indices[3 * t] : 3 * t], b = remap[indices ? indices[3 * t + 1] : 3 * t + 1], c = remap[indices ? indices[3 * t + 2] : 3 * t + 2];
    if (a === b || b === c || a === c) continue;
    if (!(triangleArea2(P, a, b, c) > weld * weld)) continue;
    T.push(a, b, c);
  }
  const I = Uint32Array.from(T);
  if (I.length / 3 < 4) throw new MeshBrepError('the mesh has fewer than four triangles with area: it encloses nothing');
  return { id, P, I, across: adjacency(I, nv) };
}
/** One piece as a B-rep: turned outward, grown into regions, assembled (faces named `<prefix>.region<k>`). */
function pieceBrep(id: string, P: Float64Array, I: Uint32Array, options: FacetBrepOptions, prefix = id): Brep {
  const nt = I.length / 3, nv = P.length / 3;
  let vol = 0;
  for (let t = 0; t < nt; t++) vol += det3(P, I[3 * t], I[3 * t + 1], I[3 * t + 2]);
  if (vol < 0) for (let t = 0; t < nt; t++) { const b = I[3 * t + 1]; I[3 * t + 1] = I[3 * t + 2]; I[3 * t + 2] = b; }
  const across = adjacency(I, nv);
  const region = regions(P, I, across, Math.cos((options.creaseDegrees ?? 30) * Math.PI / 180), options.maximumRegions ?? 1000);
  return assemble(id, P, I, across, region, prefix);
}

/** Corners on one grid cell of the weld size are one vertex: a hash of the integer cell, checked, no strings. */
function weldVertices(positions: ArrayLike<number>, n: number, weld: number): { P: Float64Array; remap: Uint32Array } {
  let cap = 16; while (cap < 2 * n) cap *= 2;
  const table = new Int32Array(cap).fill(-1), cells = new Float64Array(3 * n), out = new Float64Array(3 * n), remap = new Uint32Array(n);
  let m = 0;
  for (let v = 0; v < n; v++) {
    const x = positions[3 * v], y = positions[3 * v + 1], z = positions[3 * v + 2];
    const cx = Math.round(x / weld), cy = Math.round(y / weld), cz = Math.round(z / weld);
    let h = (Math.imul(cx | 0, 73856093) ^ Math.imul(cy | 0, 19349663) ^ Math.imul(cz | 0, 83492791) ^ Math.imul((cx / 4294967296) | 0, 2654435761)) & (cap - 1);
    for (;;) {
      const k = table[h];
      if (k < 0) { table[h] = m; cells[3 * m] = cx; cells[3 * m + 1] = cy; cells[3 * m + 2] = cz; out[3 * m] = x; out[3 * m + 1] = y; out[3 * m + 2] = z; remap[v] = m++; break; }
      if (cells[3 * k] === cx && cells[3 * k + 1] === cy && cells[3 * k + 2] === cz) { remap[v] = k; break; }
      h = (h + 1) & (cap - 1);
    }
  }
  return { P: out.slice(0, 3 * m), remap };
}

/**
 * The triangle across each edge (as the half-edge index 3t + k there), from directed edges keyed a·nv + b.
 * Refused unless every edge has exactly two triangles running it opposite ways.
 */
function adjacency(I: Uint32Array, nv: number): Int32Array {
  const nt = I.length / 3, across = new Int32Array(3 * nt).fill(-1), seen = new Map<number, number>();
  for (let h = 0; h < 3 * nt; h++) {
    const t = (h / 3) | 0, a = I[h], b = I[3 * t + (h % 3 + 1) % 3], key = a * nv + b;
    if (seen.has(key)) throw new MeshBrepError('the mesh is not consistently wound (two triangles run one edge the same way) or an edge has more than two triangles');
    seen.set(key, h);
  }
  let open = 0;
  for (let h = 0; h < 3 * nt; h++) {
    const t = (h / 3) | 0, a = I[h], b = I[3 * t + (h % 3 + 1) % 3], back = seen.get(b * nv + a);
    if (back === undefined) open++; else across[h] = back;
  }
  if (open) throw new MeshBrepError(`the mesh is not closed: ${open} edge${open === 1 ? '' : 's'} with a triangle on one side only`);
  return across;
}

/** The edge-connected pieces: each triangle's piece, numbered by first triangle, and how many. */
function componentsOf(across: Int32Array, nt: number): { of: Uint32Array; count: number } {
  const of = new Uint32Array(nt).fill(UNSET), queue = new Int32Array(nt);
  let count = 0;
  for (let s = 0; s < nt; s++) {
    if (of[s] !== UNSET) continue;
    let head = 0, tail = 0; queue[tail++] = s; of[s] = count;
    while (head < tail) { const t = queue[head++]; for (let k = 0; k < 3; k++) { const u = (across[3 * t + k] / 3) | 0; if (of[u] === UNSET) { of[u] = count; queue[tail++] = u; } } }
    count++;
  }
  return { of, count };
}

/**
 * Regions: grown breadth first from the first unassigned triangle across edges whose two normals are within
 * `cos` of each other. Too many (a noisy mesh): the normals are smoothed over neighbours (1, 2, 4, 8 rounds)
 * and grown again; still too many, the smallest regions are merged into the neighbour they share the most
 * edges with. A region that is the whole mesh is split in two (breadth first to half its triangles), so
 * every face has a boundary. Numbered by first triangle.
 */
function regions(P: Float64Array, I: Uint32Array, across: Int32Array, cos: number, maximum: number): Uint32Array {
  const nt = I.length / 3, N = new Float64Array(3 * nt);
  for (let t = 0; t < nt; t++) {
    const a = 3 * I[3 * t], b = 3 * I[3 * t + 1], c = 3 * I[3 * t + 2];
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx, l = Math.hypot(x, y, z) || 1;
    N[3 * t] = x / l; N[3 * t + 1] = y / l; N[3 * t + 2] = z / l;
  }
  let region = grow(N, across, cos), rounds = 0;
  for (const next of [1, 2, 4, 8]) {
    if (countOf(region) <= maximum) break;
    for (; rounds < next; rounds++) smooth(N, across);
    region = grow(N, across, cos);
  }
  if (countOf(region) > maximum) region = merge(region, across, maximum);
  if (countOf(region) === 1) region = halve(across, nt);
  return region;
}
function grow(N: Float64Array, across: Int32Array, cos: number): Uint32Array {
  const nt = N.length / 3, region = new Uint32Array(nt).fill(UNSET), queue = new Int32Array(nt);
  let r = 0;
  for (let s = 0; s < nt; s++) {
    if (region[s] !== UNSET) continue;
    let head = 0, tail = 0; queue[tail++] = s; region[s] = r;
    while (head < tail) {
      const t = queue[head++];
      for (let k = 0; k < 3; k++) {
        const u = (across[3 * t + k] / 3) | 0;
        if (region[u] !== UNSET || N[3 * u] * N[3 * t] + N[3 * u + 1] * N[3 * t + 1] + N[3 * u + 2] * N[3 * t + 2] < cos) continue;
        region[u] = r; queue[tail++] = u;
      }
    }
    r++;
  }
  return region;
}
/** One round of averaging each triangle's normal with its three neighbours'. */
function smooth(N: Float64Array, across: Int32Array): void {
  const nt = N.length / 3, M = new Float64Array(N.length);
  for (let t = 0; t < nt; t++) {
    let x = N[3 * t], y = N[3 * t + 1], z = N[3 * t + 2];
    for (let k = 0; k < 3; k++) { const u = 3 * ((across[3 * t + k] / 3) | 0); x += N[u]; y += N[u + 1]; z += N[u + 2]; }
    const l = Math.hypot(x, y, z) || 1; M[3 * t] = x / l; M[3 * t + 1] = y / l; M[3 * t + 2] = z / l;
  }
  N.set(M);
}
function countOf(region: Uint32Array): number { let m = 0; for (let i = 0; i < region.length; i++) if (region[i] + 1 > m) m = region[i] + 1; return m; }
/** The smallest regions merged, one at a time, into the neighbour they share the most edges with. */
function merge(region: Uint32Array, across: Int32Array, maximum: number): Uint32Array {
  const nt = region.length, k = countOf(region), parent = new Uint32Array(k), size = new Float64Array(k);
  for (let r = 0; r < k; r++) parent[r] = r;
  const find = (r: number) => { while (parent[r] !== r) { parent[r] = parent[parent[r]]; r = parent[r]; } return r; };
  for (let t = 0; t < nt; t++) size[region[t]]++;
  const order = Array.from({ length: k }, (_, r) => r).sort((a, b) => size[a] - size[b] || a - b);
  // Shared edge counts per region pair (each region's neighbours).
  const shared: Map<number, number>[] = Array.from({ length: k }, () => new Map());
  for (let h = 0; h < 3 * nt; h++) { const a = region[(h / 3) | 0], b = region[(across[h] / 3) | 0]; if (a !== b) shared[a].set(b, (shared[a].get(b) ?? 0) + 1); }
  let left = k;
  for (const r of order) {
    if (left <= maximum) break;
    if (find(r) !== r) continue;
    let best = -1, most = 0;
    for (const [o, c] of shared[r]) { const q = find(o); if (q !== r && c > most) { most = c; best = q; } }
    if (best < 0) continue;
    parent[r] = best; size[best] += size[r]; left--;
    for (const [o, c] of shared[r]) { const q = find(o); if (q !== best) shared[best].set(q, (shared[best].get(q) ?? 0) + c); }
  }
  const out = new Uint32Array(nt);
  for (let t = 0; t < nt; t++) out[t] = find(region[t]);
  return out;
}
/** The whole mesh in two: breadth first from the first triangle to half of them, the rest the other region. */
function halve(across: Int32Array, nt: number): Uint32Array {
  const region = new Uint32Array(nt).fill(1), queue = new Int32Array(nt), half = Math.max(1, nt >> 1);
  let head = 0, tail = 0; queue[tail++] = 0; region[0] = 0;
  while (head < tail && tail < half) {
    const t = queue[head++];
    for (let k = 0; k < 3 && tail < half; k++) { const u = (across[3 * t + k] / 3) | 0; if (region[u] === 1) { region[u] = 0; queue[tail++] = u; } }
  }
  return region;
}
/** Faces (each edge-connected piece of a region, numbered by first triangle), polyline edges and vertices; built and checked. */
function assemble(id: string, P: Float64Array, I: Uint32Array, across: Int32Array, region: Uint32Array, prefix = id): Brep {
  const nt = I.length / 3, nv = P.length / 3, piece = new Uint32Array(nt).fill(UNSET), queue = new Int32Array(nt);
  let faces = 0;
  for (let s = 0; s < nt; s++) {
    if (piece[s] !== UNSET) continue;
    let head = 0, tail = 0; queue[tail++] = s; piece[s] = faces;
    while (head < tail) { const t = queue[head++]; for (let k = 0; k < 3; k++) { const u = (across[3 * t + k] / 3) | 0; if (piece[u] === UNSET && region[u] === region[t]) { piece[u] = faces; queue[tail++] = u; } } }
    faces++;
  }
  const w: Walk = { I, across, piece, nt };
  // Corners: where the boundary half-edges starting at a vertex are not exactly two of one face pair.
  const corner = new Uint8Array(nv), degree = new Uint16Array(nv), pairAt = new Float64Array(nv).fill(-1);
  for (let h = 0; h < 3 * nt; h++) {
    if (!boundary(w, h)) continue;
    const v = I[h], a = piece[(h / 3) | 0], b = piece[(across[h] / 3) | 0], p = a < b ? a * faces + b : b * faces + a;
    if (degree[v] < 65535) degree[v]++;
    if (pairAt[v] < 0) pairAt[v] = p; else if (pairAt[v] !== p) corner[v] = 1;
  }
  for (let v = 0; v < nv; v++) if (degree[v] && degree[v] !== 2) corner[v] = 1;
  // Edges: chains of boundary half-edges from corner to corner, traced on one face (forward there,
  // reversed on the face across); a closed boundary without a corner gets one at its lowest vertex.
  const edgeOf = new Int32Array(3 * nt).fill(-1), edgeFace: number[] = [], edges: { id: string; curve: Curve; vertices: readonly [string, string] }[] = [], vertexIds = new Map<number, string>();
  const vid = (v: number) => { let s = vertexIds.get(v); if (s === undefined) { s = `${id}_v${v}`; vertexIds.set(v, s); } return s; };
  const trace = (start: number) => {
    // (At most POLYLINE points an edge — the curve check's limit: a longer boundary gets a vertex there and
    // goes on as the next edge.)
    for (let from = start; from >= 0;) {
      const pts = [I[from]]; let h = from; from = -1;
      for (let guard = 0; ; guard++) {
        if (guard > 3 * nt) throw new MeshBrepError('a region boundary does not close');
        edgeOf[h] = edges.length; edgeOf[across[h]] = edges.length;
        const end = I[nextHalf(h)]; pts.push(end);
        if (corner[end]) break;
        const g = nextBoundary(w, h);
        if (pts.length === POLYLINE) { corner[end] = 1; from = g; break; }
        h = g;
      }
      const name = `${id}_e${edges.length}`;
      edgeFace.push(piece[(start / 3) | 0]);
      edges.push({ id: name, curve: polyline(name, P, pts), vertices: [vid(pts[0]), vid(pts[pts.length - 1])] });
    }
  };
  for (let h = 0; h < 3 * nt; h++) if (boundary(w, h) && edgeOf[h] < 0 && corner[I[h]]) trace(h);
  for (let h = 0; h < 3 * nt; h++) {
    if (!boundary(w, h) || edgeOf[h] >= 0) continue;
    let low = h, g = nextBoundary(w, h);
    for (let guard = 0; g !== h; guard++) { if (guard > 3 * nt) throw new MeshBrepError('a region boundary does not close'); if (I[g] < I[low]) low = g; g = nextBoundary(w, g); }
    corner[I[low]] = 1; trace(low);
  }
  // Loops: each face's boundary cycles from a corner, one use per edge passed.
  const tris: number[][] = Array.from({ length: faces }, () => []);
  for (let t = 0; t < nt; t++) tris[piece[t]].push(t);
  const used = new Uint8Array(3 * nt), inputs: BrepFaceInput[] = [];
  for (let f = 0; f < faces; f++) {
    const loops: { uses: { edge: string; sense: 'forward' | 'reversed' }[]; length: number }[] = [];
    for (const t of tris[f]) for (let k = 0; k < 3; k++) {
      const h0 = 3 * t + k;
      if (!boundary(w, h0) || used[h0] || !corner[I[h0]]) continue;
      const uses: { edge: string; sense: 'forward' | 'reversed' }[] = [];
      let h = h0, length = 0;
      for (let guard = 0; ; guard++) {
        if (guard > 3 * nt) throw new MeshBrepError('a region boundary does not close');
        const e = edgeOf[h];
        uses.push({ edge: edges[e].id, sense: edgeFace[e] === f ? 'forward' : 'reversed' });
        do { used[h] = 1; length++; h = nextBoundary(w, h); } while (!corner[I[h]]);
        if (h === h0) break;
      }
      loops.push({ uses, length });
    }
    if (!loops.length) throw new MeshBrepError(`region ${f} has no boundary`);
    // (The longest boundary is the outer loop: on a facet face, which is "outer" is a convention only.)
    loops.sort((a, b) => b.length - a.length);
    inputs.push({ id: `${id}_f${f}`, name: `${prefix}.region${f}`, surface: patchOf(`${id}_p${f}`, P, I, tris[f]), sense: 'forward',
      loops: loops.map((l, k) => ({ kind: k === 0 ? 'outer' as const : 'inner' as const, uses: l.uses })) });
  }
  const brep = buildBrep({ source: { family: 'mesh', id }, vertices: [...vertexIds].sort((a, b) => a[0] - b[0]).map(([v, s]) => ({ id: s, point: [P[3 * v], P[3 * v + 1], P[3 * v + 2]] as Point })), edges,
    bodies: [{ id, kind: 'solid', shells: [{ id: `${id}_shell`, faces: inputs, closed: true }] }] });
  assertValidBrep(brep);
  return brep;
}

interface Walk { readonly I: Uint32Array; readonly across: Int32Array; readonly piece: Uint32Array; readonly nt: number }
const nextHalf = (h: number) => h - h % 3 + (h % 3 + 1) % 3;
/** Whether the triangle across half-edge h is in another face. */
const boundary = (w: Walk, h: number) => w.piece[(h / 3) | 0] !== w.piece[(w.across[h] / 3) | 0];
/** The boundary half-edge of the same face leaving where h ends: round that vertex inside the face, across interior edges. */
function nextBoundary(w: Walk, h: number): number {
  let g = nextHalf(h);
  for (let guard = 0; !boundary(w, g); guard++) { if (guard > 3 * w.nt) throw new MeshBrepError('a region boundary does not close'); g = nextHalf(w.across[g]); }
  return g;
}

/** A degree-1 curve through the mesh vertices `pts` (knots at each, parameter = vertex number along it). */
function polyline(id: string, P: Float64Array, pts: readonly number[]): Curve {
  const m = pts.length - 1, knots = [0];
  for (let k = 0; k <= m; k++) knots.push(k);
  knots.push(m);
  return { kind: 'curve', id, degree: 1, knots, controlPoints: pts.map(v => [P[3 * v], P[3 * v + 1], P[3 * v + 2]] as Point), weights: pts.map(() => 1) };
}

/** A face's triangles as a patch of its own: its vertices, re-indexed in order of first use. */
function patchOf(id: string, P: Float64Array, I: Uint32Array, tris: readonly number[]): FacetPatch {
  const local = new Map<number, number>(), indices = new Uint32Array(3 * tris.length), pos: number[] = [];
  for (let i = 0; i < tris.length; i++) for (let k = 0; k < 3; k++) {
    const v = I[3 * tris[i] + k];
    let j = local.get(v);
    if (j === undefined) { j = local.size; local.set(v, j); pos.push(P[3 * v], P[3 * v + 1], P[3 * v + 2]); }
    indices[3 * i + k] = j;
  }
  const positions = Float64Array.from(pos);
  return { kind: 'facets', id, positions, indices, bounds: boundsOf(positions) };
}
/** a · (b × c) for vertex numbers into P (six times the signed volume of the tetrahedron from the origin). */
function det3(P: Float64Array, a: number, b: number, c: number): number {
  const ax = P[3 * a], ay = P[3 * a + 1], az = P[3 * a + 2], bx = P[3 * b], by = P[3 * b + 1], bz = P[3 * b + 2], cx = P[3 * c], cy = P[3 * c + 1], cz = P[3 * c + 2];
  return ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
}
