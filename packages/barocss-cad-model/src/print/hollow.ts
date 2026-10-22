// Hollowing a part for printing (AM7a, O53): the body's signed depth sampled on a grid of spacing h (point–triangle
// distance through the kernel's triangle hierarchy; the sign by ray parity along +X per grid row — the kernel's voxel
// field, K6), the cavity φ = depth − t > 0 meshed by the kernel's marching tetrahedra (six a cell: no ambiguous case, a
// closed manifold) and subtracted from the body as a facet mesh
// (the kernel's own difference: the part's outside stays exact), with a drain from the part's bottom into each
// cavity component's floor. The kernel's mesh Boolean takes 16 000 triangles until F3: the cavity is simplified first
// (R9's decimate, within e). Loops over typed arrays; no closures per node or cell.
import { withNode, type BodyRef, type ModelNode, type StudioDoc } from '../engine/doc';
import { positionsArray, putKnownBlob, type BlobArray } from '../engine/blobs';
import { evaluatePart, type BodyResult } from '../engine/evaluate';
import type { DisplayMesh, Vec3 } from '../engine/mesh';
import { refOf } from '../app/bodyRef';
import { marchingTetrahedra, nearestDistance2, rayHit, triangleBvh, voxelDepth, voxelInsideFlags, voxelNode, type TriangleBvh, type VoxelField } from '@barocss/cad';
import { sha256Hex } from '../team/sha256';

export type HollowCode = 'CURVED_BODY' | 'ONE_BODY' | 'DIRECTION_NOT_AXIS' | 'NOTHING_TO_HOLLOW' | 'GRID_TOO_FINE' | 'BAD_VALUES' | 'DRAIN_NO_ROOM' | 'BOOLEAN_REFUSED';
export class HollowError extends Error { constructor(public code: HollowCode, message: string) { super(`[${code}] ${message}`); this.name = 'HollowError'; } }
/** `route`: 'auto' (the kernel's exact closed shell first, the voxel cavity when it refuses) or 'voxel' (the voxel cavity only). */
export interface HollowOptions { t: number; h?: number; drain?: number; route?: 'auto' | 'voxel' }
/** `route`: which made the cavity — the kernel's exact shell (R11), or the voxel cavity — and `why` the voxel route ran. `wall`: measured against t. */
export interface HollowReport { route: 'exact' | 'voxel'; why?: string; wall: Wall; t: number; h: number; drain: number; nodes: number; /** The voxel cavity's simplification bound (mm; 0 on the exact route). */ error: number; cavities: { nodes: number; lowest: Vec3 }[]; drains: { at: Vec3; depth: number }[] }

export const MAX_NODES = 4e6;
/** The grid's offset per axis, a different irrational fraction of h each: equal ones put every row with j = k on the plane
 * y = z, the diagonal of a square face's two triangles, where a ray hits their shared edge twice (the parity broken). */
const OFFSETS: readonly number[] = [1 / Math.PI, 1 / Math.E, Math.SQRT2 - 1];

// ——— the grid and the field (the kernel's voxel field, K6: inside flags by ray parity, depth by its triangle hierarchy)
export type Grid = VoxelField;
/** A display mesh's depth query (a point's distance to its nearest triangle, if within R): its kernel hierarchy and R. */
export interface DepthBins { readonly bvh: TriangleBvh; readonly R: number }
export function depthBins(m: DisplayMesh, R: number): DepthBins { return { bvh: triangleBvh(m.positions, m.indices), R }; }
/** A point's distance to the nearest triangle, if within R; R otherwise. */
export function depthAt(d: DepthBins, px: number, py: number, pz: number): number { return Math.sqrt(nearestDistance2(d.bvh, px, py, pz, d.R * d.R)); }
/** φ = depth − t at each node inside the body (depth capped at t + 2h: past it the node is deep in the cavity); −t outside. */
export function cavityField(m: DisplayMesh, t: number, h: number): Grid {
  const lo = m.bounds.min, hi = m.bounds.max;
  const o: Vec3 = [lo[0] - 2 * h + OFFSETS[0] * h, lo[1] - 2 * h + OFFSETS[1] * h, lo[2] - 2 * h + OFFSETS[2] * h];
  const n: [number, number, number] = [0, 1, 2].map(k => Math.ceil((hi[k] - o[k] + 2 * h) / h) + 1) as [number, number, number];
  if (n[0] * n[1] * n[2] > MAX_NODES) throw new HollowError('GRID_TOO_FINE', `${n.join(' × ')} nodes at h ${h} mm, over ${MAX_NODES}: take h ≥ ${(+(h * Math.cbrt(n[0] * n[1] * n[2] / MAX_NODES)).toFixed(3))} mm`);
  const inside = voxelInsideFlags(m.positions, m.indices, o, h, n), depth = voxelDepth(m.positions, m.indices, o, h, n, t + 2 * h, inside), phi = new Float64Array(n[0] * n[1] * n[2]).fill(-t);
  for (let id = 0; id < phi.length; id++) if (inside[id]) phi[id] = depth[id] - t;
  return { o, h, n, phi };
}

/**
 * The cavity's components: flood fill of the nodes with φ > 0 (6-connected), each with its drain node — of its lowest
 * nodes along `up` (its floor), the one nearest the floor's centroid, so a drain opens in the middle of it.
 */
export function cavityComponents(g: Grid, up: number): { nodes: number; lowest: number }[] {
  const N = g.phi.length, label = new Int32Array(N).fill(-1), out: { nodes: number; lowest: number }[] = [], stack: number[] = [], members: number[] = [];
  const step = [1, g.n[0], g.n[0] * g.n[1]], [a, b] = [0, 1, 2].filter(x => x !== up);
  for (let s = 0; s < N; s++) {
    if (g.phi[s] <= 0 || label[s] >= 0) continue;
    const c = out.length; members.length = 0; let low = Infinity;
    label[s] = c; stack.push(s);
    while (stack.length) {
      const v = stack.pop()!; members.push(v);
      const at = voxelNode(g, v); if (at[up] < low) low = at[up];
      const i = v % g.n[0], r = (v - i) / g.n[0], j = r % g.n[1], k = (r - j) / g.n[1], ijk = [i, j, k];
      for (let ax = 0; ax < 3; ax++) for (let d = -1; d <= 1; d += 2) { const q = ijk[ax] + d; if (q < 0 || q >= g.n[ax]) continue; const w = v + d * step[ax]; if (g.phi[w] > 0 && label[w] < 0) { label[w] = c; stack.push(w); } }
    }
    let sa = 0, sb = 0, nf = 0;
    for (const v of members) { const at = voxelNode(g, v); if (at[up] <= low + 1e-9) { sa += at[a]; sb += at[b]; nf++; } }
    const ca = sa / nf, cb = sb / nf; let best = members[0], bestD = Infinity;
    for (const v of members) { const at = voxelNode(g, v); if (at[up] > low + 1e-9) continue; const dd = (at[a] - ca) ** 2 + (at[b] - cb) ** 2; if (dd < bestD) { bestD = dd; best = v; } }
    out.push({ nodes: members.length, lowest: best });
  }
  return out;
}

/** A mesh split into its connected pieces (by shared vertices), each with its own vertex numbering. */
export function meshPieces(m: { positions: number[]; indices: number[] }): { positions: number[]; indices: number[] }[] {
  const nv = m.positions.length / 3, parent = new Int32Array(nv);
  for (let v = 0; v < nv; v++) parent[v] = v;
  for (let t = 0; t < m.indices.length; t += 3) { const a = root(parent, m.indices[t]); union(parent, a, m.indices[t + 1]); union(parent, a, m.indices[t + 2]); }
  const byRoot = new Map<number, { positions: number[]; indices: number[]; map: Map<number, number> }>();
  for (let t = 0; t < m.indices.length; t += 3) {
    const r = root(parent, m.indices[t]); let p = byRoot.get(r); if (!p) { p = { positions: [], indices: [], map: new Map() }; byRoot.set(r, p); }
    for (let j = 0; j < 3; j++) { const v = m.indices[t + j]; let w = p.map.get(v); if (w === undefined) { w = p.positions.length / 3; p.map.set(v, w); p.positions.push(m.positions[v * 3], m.positions[v * 3 + 1], m.positions[v * 3 + 2]); } p.indices.push(w); }
  }
  return [...byRoot.values()].map(p => ({ positions: p.positions, indices: p.indices }));
}
function root(p: Int32Array, v: number): number { while (p[v] !== v) { p[v] = p[p[v]]; v = p[v]; } return v; }
function union(p: Int32Array, a: number, b: number): void { const ra = root(p, a), rb = root(p, b); if (ra !== rb) p[rb] = ra; }

/** The wall as measured (R11.3's way): from each outer face's triangle centroids inward along the face's normal to the next surface. */
export interface Wall { samples: number; min: number; max: number; median: number }
export function wallOf(m: DisplayMesh, target: number): Wall {
  // (The outer surface: the faces a ray from outside meets; inward from a centroid, the first other surface is the wall's inside.
  // Rays leaving through a drain, or crossing much more than the target, are not a wall. Rays through the kernel's
  // triangle hierarchy, K2; at most about 400 triangles sampled, evenly through the mesh.)
  const out: number[] = [], P = m.positions, I = m.indices, stride = 3 * Math.max(1, Math.ceil(I.length / 3 / 400)), bvh = triangleBvh(P, I);
  for (let t = 0; t < I.length; t += stride) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3, ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const L = Math.hypot(nx, ny, nz); if (L < 1e-12) continue; nx /= L; ny /= L; nz /= L;
    const ox = (P[a] + P[b] + P[c]) / 3, oy = (P[a + 1] + P[b + 1] + P[c + 1]) / 3, oz = (P[a + 2] + P[b + 2] + P[c + 2]) / 3;
    if (!onOuter(bvh, ox, oy, oz)) continue;
    RO[0] = ox; RO[1] = oy; RO[2] = oz; RD[0] = -nx; RD[1] = -ny; RD[2] = -nz;
    const d = rayHit(bvh, RO, RD, 1e-7, t / 3);
    if (d > 1e-6 && d < 3 * target) out.push(d);
  }
  out.sort((x, y) => x - y);
  return { samples: out.length, min: out[0] ?? NaN, max: out[out.length - 1] ?? NaN, median: out[out.length >> 1] ?? NaN };
}
const RO = new Float64Array(3), RD = new Float64Array(3);
/** Whether a point on the mesh is on its outer surface: a ray along one of the six axes from it meets nothing else. */
function onOuter(bvh: TriangleBvh, x: number, y: number, z: number): boolean {
  for (const [dx, dy, dz] of OUT_DIRS) { RO[0] = x + dx * 1e-6; RO[1] = y + dy * 1e-6; RO[2] = z + dz * 1e-6; RD[0] = dx; RD[1] = dy; RD[2] = dz; if (rayHit(bvh, RO, RD, 1e-7) === Infinity) return true; }
  return false;
}
const OUT_DIRS: readonly [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const refusalOf = (e: unknown) => { const x = e as { detail?: string; title?: string } | string; return typeof x === 'string' ? x : x?.detail ?? x?.title ?? JSON.stringify(x); };

/** A blob put by its SHA-256 at once (the command's build is synchronous): the hash the store's own would give. */
export function putNow(a: BlobArray): string { const h = sha256Hex(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)); putKnownBlob(h, a); return h; }

/** The voxel work planHollow has done (cavity fields built): what a test reads to know a refusal came before any. */
export const hollowWork = { fields: 0 };
/** A curved body refused for a mesh cavity, with why the voxel route was taken. */
function curvedRefusal(body: BodyResult, why: string): void {
  const curved = body.mesh.faces.filter(f => f.kind === 'curved' && !f.facet).length;
  if (curved) throw new HollowError('CURVED_BODY', `the part has ${curved} curved face${curved > 1 ? 's' : ''} and ${why}: a mesh cavity in a curved body needs the kernel's mixed facet–analytic Booleans (F3)`);
}
/** The hollowing's features appended: the cavity mesh, its difference from the body, a drain into each cavity. */
export function planHollow(doc: StudioDoc, bodies: readonly BodyResult[], o: HollowOptions): { doc: StudioDoc; report: HollowReport } {
  if (bodies.length !== 1) throw new HollowError('ONE_BODY', `hollowing takes a part of one body; this one has ${bodies.length}`);
  const t = o.t, h = o.h ?? t / 4, drain = o.drain ?? 4;
  if (!(t > 0 && h > 0 && h <= t / 2 + 1e-12 && drain > 0)) throw new HollowError('BAD_VALUES', `a wall t > 0, a voxel 0 < h ≤ t/2 and a drain Ø > 0 (t ${t}, h ${h}, drain ${drain})`);
  const d = doc.print?.direction ?? [0, 0, 1], up = d.findIndex(x => Math.abs(x) > 1e-9);
  if (up < 0 || d.some((x, i) => i !== up && Math.abs(x) > 1e-9)) throw new HollowError('DIRECTION_NOT_AXIS', `the print direction (${d.join(', ')}) is not along X, Y or Z`);
  const body = bodies[0];
  // (The voxel route asked for on a curved body: refused before any voxel work — the field is not built.)
  if (o.route === 'voxel') curvedRefusal(body, 'the voxel route was asked for');
  hollowWork.fields++;
  const g = cavityField(body.mesh, t, h), comps = cavityComponents(g, up);
  if (!comps.length) throw new HollowError('NOTHING_TO_HOLLOW', `no point of the part is deeper than the wall (${t} mm): it is thinner than ${2 * t} mm everywhere`);
  // (The drains: from the part's bottom (min along up) to each cavity's lowest node, its column inside the bottom.)
  const [a, b] = [0, 1, 2].filter(x => x !== up), floor = body.mesh.bounds.min[up], drains: HollowReport['drains'] = [];
  for (const c of comps) {
    const p = voxelNode(g, c.lowest), inFoot = [a, b].every(x => p[x] - drain / 2 >= body.mesh.bounds.min[x] - 1e-9 && p[x] + drain / 2 <= body.mesh.bounds.max[x] + 1e-9);
    if (!inFoot) throw new HollowError('DRAIN_NO_ROOM', `a drain of Ø${drain} at (${p.map(v => +v.toFixed(2)).join(', ')}) does not fit inside the part's bottom`);
    drains.push({ at: [p[0], p[1], p[2]], depth: p[up] - floor });
  }
  // (The route: the kernel's exact closed shell (R11: shellPart, its general shell and offsets, nothing opened) first — the
  // outside and the inside both exact, curved faces too; the voxel cavity only when it refuses, said why. A curved body
  // the shell refuses waits for the kernel's mixed facet–analytic Booleans (F3): refused with the shell's reason.)
  let out: StudioDoc = doc, error = 0, ref: BodyRef = refOf(body), route: 'exact' | 'voxel' = 'voxel', why: string | undefined;
  if ((o.route ?? 'auto') === 'auto') {
    const shelled = withNode(doc, { kind: 'shell', parent: refOf(body), thickness: t, open: [] } as ModelNode), r = evaluatePart(shelled, 0);
    if (r.ok && r.bodies.length === 1 && (r.bodies[0].innerShells ?? 0) >= 1) { out = shelled; ref = { node: shelled.nodes.length - 1, side: 'solid' }; route = 'exact'; }
    else why = `the kernel's exact shell refused it: ${r.ok ? `it gave ${r.bodies.length} bod${r.bodies.length === 1 ? 'y' : 'ies'} with ${r.bodies[0]?.innerShells ?? 0} cavities` : refusalOf(r.error)}`;
  } else why = 'the voxel route was asked for';
  if (route === 'voxel') {
    curvedRefusal(body, why!);
  // (The kernel's mesh Boolean takes up to 16 000 triangles until F3: each cavity piece simplified first (R9's decimate),
  // within e = h/50 of itself; a result the Boolean refuses as touching, at h/20 then h/10 — e goes into the bounds. A
  // mesh is one closed piece: one mesh node a cavity, each taken from the part in turn.)
  for (const piece of meshPieces(marchingTetrahedra(g))) {
    const P = positionsArray(piece.positions), I = Uint32Array.from(piece.indices), withMesh = withNode(out, { kind: 'mesh', name: 'cavity', unit: 'mm', representation: 'facets', blob: { positions: putNow(P), indices: putNow(I) } } as ModelNode);
    let done: StudioDoc | null = null, why = '';
    for (const e of [h / 50, h / 20, h / 10]) {
      let d = withNode(withMesh, { kind: 'decimate', parent: { node: withMesh.nodes.length - 1, side: 'solid' }, maxError: e } as ModelNode);
      d = withNode(d, { kind: 'difference', parent: ref, tool: { node: d.nodes.length - 1, side: 'solid' } } as ModelNode);
      const r = evaluatePart(d, 0);
      if (r.ok) { done = d; error = Math.max(error, e); break; }
      why = JSON.stringify(r.error).slice(0, 300);
    }
    if (!done) throw new HollowError('BOOLEAN_REFUSED', `a cavity (${piece.indices.length / 3} triangles) could not be taken from the part even simplified to h/10: ${why}; a coarser h makes a smaller cavity mesh`);
    out = done; ref = { node: out.nodes.length - 1, side: 'solid' };
  }
  }
  // (The wall measured on the hollowed part before its drains: a drain's own wall is not the shell's.)
  const hollowed = evaluatePart(out, 0), wall = hollowed.ok ? wallOf(hollowed.bodies[0].mesh, t) : { samples: 0, min: NaN, max: NaN, median: NaN };
  const axis = (['x', 'y', 'z'] as const)[up];
  for (const dr of drains) { out = withNode(out, { kind: 'hole', parent: ref, center: [dr.at[a], dr.at[b]], radius: drain / 2, axis, side: 'min', depth: dr.depth } as ModelNode); ref = { node: out.nodes.length - 1, side: 'solid' }; }
  return { doc: out, report: { route, ...(why ? { why } : {}), wall, t, h, drain, nodes: g.phi.length, error, cavities: comps.map(c => ({ nodes: c.nodes, lowest: voxelNode(g, c.lowest) })), drains } };
}

/** Enclosed voids of a body by flood fill: its empty nodes on a grid of spacing hc not reached from outside (6-connected). */
export function enclosedVoids(m: DisplayMesh, hc: number): { voids: number; components: number } {
  const lo = m.bounds.min, hi = m.bounds.max, o: Vec3 = [lo[0] - 2 * hc + OFFSETS[0] * hc, lo[1] - 2 * hc + OFFSETS[1] * hc, lo[2] - 2 * hc + OFFSETS[2] * hc];
  const n = [0, 1, 2].map(k => Math.ceil((hi[k] - o[k] + 2 * hc) / hc) + 1);
  const solid = voxelInsideFlags(m.positions, m.indices, o, hc, n), N = n[0] * n[1] * n[2], reach = new Uint8Array(N), stack: number[] = [0], step = [1, n[0], n[0] * n[1]];
  reach[0] = 1;
  while (stack.length) {
    const v = stack.pop()!, i = v % n[0], r = (v - i) / n[0], j = r % n[1], k = (r - j) / n[1], ijk = [i, j, k];
    for (let a = 0; a < 3; a++) for (const d of [-1, 1]) { const q = ijk[a] + d; if (q < 0 || q >= n[a]) continue; const w = v + d * step[a]; if (!solid[w] && !reach[w]) { reach[w] = 1; stack.push(w); } }
  }
  let voids = 0; const seen = new Uint8Array(N); let components = 0;
  for (let s = 0; s < N; s++) {
    if (solid[s] || reach[s] || seen[s]) continue;
    components++; seen[s] = 1; stack.push(s);
    while (stack.length) { const v = stack.pop()!; voids++; const i = v % n[0], r = (v - i) / n[0], j = r % n[1], k = (r - j) / n[1], ijk = [i, j, k]; for (let a = 0; a < 3; a++) for (const d of [-1, 1]) { const q = ijk[a] + d; if (q < 0 || q >= n[a]) continue; const w = v + d * step[a]; if (!solid[w] && !reach[w] && !seen[w]) { seen[w] = 1; stack.push(w); } } }
  }
  return { voids, components };
}
