// A gyroid lattice infill (AM7b, O57): inside a part hollowed by the kernel's exact shell, the sheet gyroid |G| ≤ k (as
// min(k − G, k + G)), cut to the cavity (φ_c = depth − t) and kept off the drains, meshed by marching tetrahedra into a
// separate facet body named `lattice` — the shell's B-rep unchanged (option B: a lattice mesh is far past the kernel's
// mesh Boolean). Its loose fragments dropped; each empty region it leaves (a sheet gyroid's two labyrinths) drained.
import { meshVolume } from '@barocss/cad';
import { withNode, type BodyRef, type ModelNode, type StudioDoc } from '../engine/doc';
import { evaluatePart, type BodyResult } from '../engine/evaluate';
import { positionsArray } from '../engine/blobs';
import type { Vec3 } from '../engine/mesh';
import { CORNER, TETS, cavityField, depthAt, depthBins, marchingTetrahedra, meshPieces, nodeAt, putNow, type DepthBins, type Grid } from './hollow';

export type LatticeCode = 'NOT_HOLLOW' | 'BAD_VALUES' | 'GRID_TOO_FINE' | 'NO_LATTICE' | 'UNDRAINED';
const MAX_DRAIN_ROUNDS = 64;
export class LatticeError extends Error { constructor(public code: LatticeCode, message: string) { super(`[${code}] ${message}`); this.name = 'LatticeError'; } }
export interface LatticeOptions { cell: number; k: number; h?: number }
export interface LatticeReport {
  cell: number; k: number; h: number; t: number; nodes: number;
  /** The lattice's volume (mm³), its pieces kept, and the fragments dropped (not touching the wall). */
  volume: number; pieces: number; dropped: { count: number; volume: number };
  /** Drains added for the empty regions the lattice leaves (beyond the hollowing's). */
  drains: { at: Vec3; depth: number }[];
  /** The tetrahedra a surface crosses whose active term changes inside them (O57's ε_mix count). */
  mixed: number; triangles: number;
  /** The wall vertices moved onto the wall's exact depth (snapToWall). */
  snapped: number;
  /** Drain columns carved through the lattice into another drain's column, with no hole of their own. */
  joined: number;
  /** The field kept off 0 near the nodes by τ (the kernel's weld): the surface moves by at most τ/g. */
  tau: number;
  step: string;
}

/** The gyroid at p, its phase at o and period L. */
export function gyroid(p: ArrayLike<number>, o: ArrayLike<number>, L: number): number {
  const w = 2 * Math.PI / L, X = w * (p[0] - o[0]), Y = w * (p[1] - o[1]), Z = w * (p[2] - o[2]);
  return Math.sin(X) * Math.cos(Y) + Math.sin(Y) * Math.cos(Z) + Math.sin(Z) * Math.cos(X);
}
/** |∇G| at p. */
export function gyroidGradient(p: readonly number[], o: readonly number[], L: number): number {
  const w = 2 * Math.PI / L, X = w * (p[0] - o[0]), Y = w * (p[1] - o[1]), Z = w * (p[2] - o[2]);
  const gx = Math.cos(X) * Math.cos(Y) - Math.sin(Z) * Math.sin(X), gy = -Math.sin(X) * Math.sin(Y) + Math.cos(Y) * Math.cos(Z), gz = -Math.sin(Y) * Math.sin(Z) + Math.cos(Z) * Math.cos(X);
  return w * Math.hypot(gx, gy, gz);
}
/** The fraction of a unit cell where |G| ≤ k, by `n` Halton points (bases 2, 3, 5). */
export function gyroidFraction(k: number, n = 1e6): number {
  let inside = 0;
  for (let i = 1; i <= n; i++) { const p = [halton(i, 2), halton(i, 3), halton(i, 5)]; if (Math.abs(gyroid(p, [0, 0, 0], 1)) <= k) inside++; }
  return inside / n;
}
function halton(i: number, b: number): number { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; }

/** The drains as columns: from the part's floor (along `up`) to `top`, about (a, b), radius r. */
export interface Column { a: number; b: number; top: number; r: number }
const ACTIVE_BAND_UP = 0, ACTIVE_BAND_DOWN = 1, ACTIVE_WALL = 2, ACTIVE_DRAIN = 3;
/**
 * ψ = min(k − G, k + G, φ_c, ρ_d) at each node of the cavity's grid, and which term is the least there. G is phased at
 * `o`; φ_c is the cavity's field (O53, capped deep inside); ρ_d the distance to a drain column's axis less its radius.
 */
export function latticeField(cav: Grid, o: Vec3, L: number, k: number, columns: readonly Column[], up: number): { psi: Float64Array; active: Uint8Array } {
  const N = cav.phi.length, psi = new Float64Array(N), active = new Uint8Array(N), [a, b] = [0, 1, 2].filter(x => x !== up);
  for (let id = 0; id < N; id++) {
    const p = nodeAt(cav, id), G = gyroid(p, o, L);
    let v = k - G, act = ACTIVE_BAND_UP;
    if (k + G < v) { v = k + G; act = ACTIVE_BAND_DOWN; }
    if (cav.phi[id] < v) { v = cav.phi[id]; act = ACTIVE_WALL; }
    for (const c of columns) { if (p[up] > c.top + cav.h) continue; const d = Math.hypot(p[a] - c.a, p[b] - c.b) - c.r; if (d < v) { v = d; act = ACTIVE_DRAIN; } }
    psi[id] = v; active[id] = act;
  }
  return { psi, active };
}
/**
 * The kernel welds a facet mesh's vertices within its size × 10⁻⁶ (facet-brep.ts) and drops triangles under that weld
 * squared: a field nearly 0 at a node puts every edge's vertex next to it, welded into one, the mesh broken. A node
 * within τ of 0 is set to −τ, τ = 10 × the weld × the field's steepest slope (2√3·ω for the gyroid's terms; 1 for φ_c
 * and ρ_d), so every vertex lies at least ten welds from a node. The surface moves by at most τ/g (into ε_MT).
 */
export function awayFromZero(psi: Float64Array, tau: number): number { let moved = 0; for (let i = 0; i < psi.length; i++) if (Math.abs(psi[i]) < tau) { psi[i] = -tau; moved++; } return moved; }
export const weldTau = (size: number, L: number) => 10 * Math.max(1e-9, size * 1e-6) * Math.max(1, 2 * Math.sqrt(3) * 2 * Math.PI / L);
/** The tetrahedra a surface ψ = 0 crosses whose corners' least terms differ (O57's ε_mix count). */
export function mixedTetrahedra(g: Grid, psi: Float64Array, active: Uint8Array): number {
  let n = 0; const ids = new Int32Array(4);
  for (let k = 0; k + 1 < g.n[2]; k++) for (let j = 0; j + 1 < g.n[1]; j++) for (let i = 0; i + 1 < g.n[0]; i++) for (const tet of TETS) {
    let pos = 0;
    for (let q = 0; q < 4; q++) { const c = CORNER[tet[q]]; ids[q] = ((k + c[2]) * g.n[1] + (j + c[1])) * g.n[0] + (i + c[0]); if (psi[ids[q]] > 0) pos++; }
    if (pos === 0 || pos === 4) continue;
    if (active[ids[0]] !== active[ids[1]] || active[ids[0]] !== active[ids[2]] || active[ids[0]] !== active[ids[3]]) n++;
  }
  return n;
}
/** The empty cavity nodes (inside the cavity, outside the lattice) in 6-connected components; each with its floor's middle node and whether a drain column reaches it. */
export function emptyRegions(g: Grid, psi: Float64Array, active: Uint8Array, up: number, columns: readonly Column[] = [], r = 0): { nodes: number; lowest: number; drained: boolean; hole: boolean }[] {
  const N = psi.length, label = new Int32Array(N).fill(-1), out: { nodes: number; lowest: number; drained: boolean; hole: boolean }[] = [], stack: number[] = [], members: number[] = [];
  const step = [1, g.n[0], g.n[0] * g.n[1]], [a, b] = [0, 1, 2].filter(x => x !== up);
  const empty = (id: number) => g.phi[id] > 0 && psi[id] <= 0;
  for (let s = 0; s < N; s++) {
    if (!empty(s) || label[s] >= 0) continue;
    const c = out.length; members.length = 0; let low = Infinity, drained = false;
    label[s] = c; stack.push(s);
    while (stack.length) {
      const v = stack.pop()!; members.push(v); if (active[v] === ACTIVE_DRAIN) drained = true;
      const at = nodeAt(g, v); if (at[up] < low) low = at[up];
      const i = v % g.n[0], r = (v - i) / g.n[0], j = r % g.n[1], kk = (r - j) / g.n[1], ijk = [i, j, kk];
      for (let ax = 0; ax < 3; ax++) for (let d = -1; d <= 1; d += 2) { const q = ijk[ax] + d; if (q < 0 || q >= g.n[ax]) continue; const w = v + d * step[ax]; if (empty(w) && label[w] < 0) { label[w] = c; stack.push(w); } }
    }
    let sa = 0, sb = 0, nf = 0;
    for (const v of members) { const at = nodeAt(g, v); if (at[up] <= low + 1e-9) { sa += at[a]; sb += at[b]; nf++; } }
    // (Its drain: of its floor's nodes, the one nearest the floor's centroid whose column is clear of every other by 2r + h,
    // with a hole of its own; failing that, its lowest node whose column overlaps another's by h — joined to that drain, no
    // hole (two holes too near meet along an edge in the B-rep, or one inside another cuts nothing); failing both, the
    // floor's nearest the centroid, with a hole.)
    let best = -1, bestD = Infinity, join = -1, joinZ = Infinity;
    for (const v of members) {
      const at = nodeAt(g, v); let gap = Infinity; for (const c of columns) gap = Math.min(gap, Math.hypot(at[a] - c.a, at[b] - c.b));
      if (gap <= 2 * r - g.h) { if (at[up] < joinZ) { joinZ = at[up]; join = v; } continue; }
      if (at[up] > low + 1e-9 || gap < 2 * r + g.h) continue;
      const dd = (at[a] - sa / nf) ** 2 + (at[b] - sb / nf) ** 2; if (dd < bestD) { bestD = dd; best = v; }
    }
    let floorBest = members[0], floorD = Infinity;
    if (best < 0 && join < 0) for (const v of members) { const at = nodeAt(g, v); if (at[up] > low + 1e-9) continue; const dd = (at[a] - sa / nf) ** 2 + (at[b] - sb / nf) ** 2; if (dd < floorD) { floorD = dd; floorBest = v; } }
    out.push({ nodes: members.length, lowest: best >= 0 ? best : join >= 0 ? join : floorBest, drained, hole: best >= 0 || join < 0 });
  }
  return out;
}
/** φ_c at a point by trilinear interpolation of the grid (exact along the grid's edges, where the mesh's vertices lie). */
function phiAt(g: Grid, p: readonly number[]): number {
  const f = [0, 1, 2].map(q => Math.max(0, Math.min(g.n[q] - 1.000001, (p[q] - g.o[q]) / g.h))), i = f.map(Math.floor), u = f.map((x, q) => x - i[q]);
  let v = 0;
  for (let c = 0; c < 8; c++) { const dx = c & 1, dy = (c >> 1) & 1, dz = (c >> 2) & 1, w = (dx ? u[0] : 1 - u[0]) * (dy ? u[1] : 1 - u[1]) * (dz ? u[2] : 1 - u[2]); v += w * g.phi[((i[2] + dz) * g.n[1] + (i[1] + dy)) * g.n[0] + (i[0] + dx)]; }
  return v;
}

/** The least of the non-wall terms' crossings along an edge, linear in each (the band's two and each drain's). */
const PI3 = new Float64Array(3), PO3 = new Float64Array(3);
function otherTerm(p: Float64Array, o: Vec3, L: number, k: number, columns: readonly Column[], up: number, j: number): number {
  if (j === 0) return k - gyroid(p, o, L);
  if (j === 1) return k + gyroid(p, o, L);
  const c = columns[j - 2], a = up === 0 ? 1 : 0, b = up === 2 ? 1 : 2;
  return p[up] > c.top ? Infinity : Math.hypot(p[a] - c.a, p[b] - c.b) - c.r;
}
/**
 * The lattice's wall vertices on the wall itself. Marching tetrahedra places a vertex at the zero of the interpolated
 * min, so where the band is the least term at the inside node and the wall at the outside one, the vertex misses the
 * wall — and a piece of lattice can float a little off it (0.008 mm at L 15, h 2.5). Each vertex whose edge's first
 * crossing from its inside node is the wall's (each term's crossing linear but the wall's, the exact depth's root by
 * bisection) moves to that root; its distance from a node kept ≥ τ (the weld). The others stay. Returns how many moved.
 */
export function snapToWall(mesh: { positions: number[]; edges: Float64Array }, g: Grid, psi: Float64Array, d: DepthBins, t: number, tau: number, o: Vec3, L: number, k: number, columns: readonly Column[], up: number): number {
  const N = g.phi.length, P = mesh.positions; let moved = 0;
  for (let v = 0; v < mesh.edges.length; v++) {
    const key = mesh.edges[v], e0 = Math.floor(key / N), e1 = key - e0 * N, [i, x] = psi[e0] > 0 ? [e0, e1] : [e1, e0];
    // (The outside node within the wall (its depth computed, ≤ t): the depth is decreasing through t along the edge.)
    if (!(g.phi[x] <= 0 && g.phi[x] > -t)) continue;
    const pi = nodeAt(g, i), px = nodeAt(g, x);
    for (let q = 0; q < 3; q++) { PI3[q] = pi[q]; PO3[q] = px[q]; }
    let lo = 0, hi = 1;
    for (let it = 0; it < 52; it++) { const m = (lo + hi) / 2; if (depthAt(d, pi[0] + m * (px[0] - pi[0]), pi[1] + m * (px[1] - pi[1]), pi[2] + m * (px[2] - pi[2])) - t > 0) lo = m; else hi = m; }
    const sc = (lo + hi) / 2;
    let first = Infinity;
    for (let j = 0; j < 2 + columns.length; j++) { const a = otherTerm(PI3, o, L, k, columns, up, j), b = otherTerm(PO3, o, L, k, columns, up, j); if (a > 0 && b < 0) first = Math.min(first, a / (a - b)); }
    if (sc > first) continue;
    const len = Math.hypot(px[0] - pi[0], px[1] - pi[1], px[2] - pi[2]), s = Math.min(1 - tau / len, Math.max(tau / len, sc));
    P[v * 3] = pi[0] + s * (px[0] - pi[0]); P[v * 3 + 1] = pi[1] + s * (px[1] - pi[1]); P[v * 3 + 2] = pi[2] + s * (px[2] - pi[2]); moved++;
  }
  return moved;
}

/** The hollowing a part has, from its features: the shell (its thickness and the body it hollows), the drains after it. */
function hollowOf(doc: StudioDoc): { shell: number; t: number; original: BodyRef; holes: { center: [number, number]; radius: number; depth: number }[] } | null {
  const s = doc.nodes.findIndex(n => n.kind === 'shell' && Array.isArray((n as { open?: unknown[] }).open) && (n as { open: unknown[] }).open.length === 0);
  if (s < 0) return null;
  const sh = doc.nodes[s] as unknown as { parent: BodyRef; thickness: number }, holes: { center: [number, number]; radius: number; depth: number }[] = [];
  for (let i = s + 1; i < doc.nodes.length; i++) { const n = doc.nodes[i] as unknown as { kind: string; center: [number, number]; radius: number; depth: number }; if (n.kind === 'hole') holes.push({ center: n.center, radius: n.radius, depth: n.depth }); }
  return { shell: s, t: Number(sh.thickness), original: sh.parent, holes };
}

/** Whether a part is hollowed by Hollow for printing (an exact closed shell): what the lattice fills. */
export const isHollowed = (doc: StudioDoc): boolean => hollowOf(doc) !== null;

/** The lattice planned: the drains it needs (B-rep holes) and its mesh body appended; the field's numbers for the report. */
export function planLattice(doc: StudioDoc, bodies: readonly BodyResult[], o: LatticeOptions): { doc: StudioDoc; report: LatticeReport; mesh: { positions: number[]; indices: number[] }; grid: Grid; psi: Float64Array } {
  const hol = hollowOf(doc);
  if (!hol || bodies.length !== 1) throw new LatticeError('NOT_HOLLOW', 'the lattice fills a part hollowed by Hollow for printing (its exact shell): hollow the part first');
  const L = o.cell, k = o.k, h = o.h ?? L / 12;
  if (!(L > 0 && k > 0 && k < 1.5 && h > 0 && h <= L / 4)) throw new LatticeError('BAD_VALUES', `a cell L > 0, a band 0 < k < 1.5 and a voxel 0 < h ≤ L/4 (L ${L}, k ${k}, h ${h})`);
  // (A drain's column must hold the grid's nodes to drain anything: the voxel at most its radius.)
  const rd = hol.holes[0]?.radius ?? 2;
  if (h > rd) throw new LatticeError('BAD_VALUES', `a voxel h at most the drain's radius ${rd} mm, so a drain's column holds the grid's nodes (h ${h})`);
  const d = doc.print?.direction ?? [0, 0, 1], up = d.findIndex(x => Math.abs(x) > 1e-9), [a, b] = [0, 1, 2].filter(x => x !== up);
  // (The original body, before the shell: its depth field gives the cavity, φ_c = depth − t.)
  const before = evaluatePart({ ...doc, nodes: doc.nodes.slice(0, hol.shell) }, 0);
  if (!before.ok) throw new LatticeError('NOT_HOLLOW', 'the part before its shell could not be evaluated');
  const orig = before.bodies.find(x => x.ref?.node === hol.original.node) ?? before.bodies[0];
  let cav: Grid;
  try { cav = cavityField(orig.mesh, hol.t, h); } catch (e) { throw new LatticeError('GRID_TOO_FINE', e instanceof Error ? e.message.replace(/^\[\w+\] /, '') : String(e)); }
  const floor = orig.mesh.bounds.min[up], origin: Vec3 = [orig.mesh.bounds.min[0] + hol.t, orig.mesh.bounds.min[1] + hol.t, orig.mesh.bounds.min[2] + hol.t];
  // (The hollowing's drains as columns, then one more for each empty region left undrained, until none is.)
  const columns: Column[] = hol.holes.map(x => ({ a: x.center[0], b: x.center[1], top: floor + x.depth, r: x.radius }));
  const added: LatticeReport['drains'] = [], r0 = rd; let joined = 0;
  let field = latticeField(cav, origin, L, k, columns, up);
  // (One drain a round, into the largest undrained region: its column, carved up through the lattice, drains every region
  // it passes, so the next flood fill has fewer. A region over a column's axis extends that column up to it, no new hole.)
  for (let round = 0; round < MAX_DRAIN_ROUNDS; round++) {
    const undrained = emptyRegions(cav, field.psi, field.active, up, columns, r0).filter(x => !x.drained);
    if (!undrained.length) break;
    let u = undrained[0]; for (const x of undrained) if (x.nodes > u.nodes) u = x;
    const p = nodeAt(cav, u.lowest);
    columns.push({ a: p[a], b: p[b], top: p[up], r: r0 });
    if (u.hole) added.push({ at: p, depth: p[up] - floor }); else joined++;
    field = latticeField(cav, origin, L, k, columns, up);
    if (round === MAX_DRAIN_ROUNDS - 1 && emptyRegions(cav, field.psi, field.active, up).some(x => !x.drained)) throw new LatticeError('UNDRAINED', `the lattice leaves empty regions undrained after ${MAX_DRAIN_ROUNDS} drains: take a larger cell or a finer voxel`);
  }
  const size = Math.max(...[0, 1, 2].flatMap(q => [Math.abs(orig.mesh.bounds.min[q]), Math.abs(orig.mesh.bounds.max[q])])), tau = weldTau(size, L);
  awayFromZero(field.psi, tau);
  const grid: Grid = { ...cav, phi: field.psi }, mesh = marchingTetrahedra(grid), depth = depthBins(orig.mesh, hol.t + 2 * h);
  const snapped = snapToWall(mesh, cav, field.psi, depth, hol.t, tau, origin, L, k, columns, up);
  // (Pieces: those touching the cavity's wall are kept, a loose fragment dropped. Touching is a vertex at the wall's exact
  // depth t, to 2τ — the snapped ones; the grid's φ_c only picks the candidates.)
  const kept: { positions: number[]; indices: number[] }[] = []; let dropped = 0, droppedVolume = 0;
  for (const piece of meshPieces(mesh)) {
    let touches = false;
    for (let v = 0; v < piece.positions.length && !touches; v += 3) if (phiAt(cav, [piece.positions[v], piece.positions[v + 1], piece.positions[v + 2]]) <= h && Math.abs(depthAt(depth, piece.positions[v], piece.positions[v + 1], piece.positions[v + 2]) - hol.t) <= 2 * tau) touches = true;
    if (touches) kept.push(piece); else { dropped++; droppedVolume += meshVolume(piece.positions, piece.indices); }
  }
  if (!kept.length) throw new LatticeError('NO_LATTICE', `no lattice is left in the cavity at L ${L}, k ${k}`);
  const all = { positions: [] as number[], indices: [] as number[] };
  // (Copied element by element: a spread of hundreds of thousands of numbers overflows the call stack.)
  for (const p of kept) { const base = all.positions.length / 3; for (let i = 0; i < p.positions.length; i++) all.positions.push(p.positions[i]); for (let i = 0; i < p.indices.length; i++) all.indices.push(base + p.indices[i]); }
  // (The features: the new drains through the shell's B-rep, then the lattice body beside it.)
  let out = doc, ref: BodyRef = { node: doc.nodes.length - 1, side: 'solid' };
  const axis = (['x', 'y', 'z'] as const)[up];
  for (const dr of added) { out = withNode(out, { kind: 'hole', parent: ref, center: [dr.at[a], dr.at[b]], radius: r0, axis, side: 'min', depth: dr.depth } as ModelNode); ref = { node: out.nodes.length - 1, side: 'solid' }; }
  out = withNode(out, { kind: 'mesh', name: 'lattice', role: 'infill', unit: 'mm', representation: 'facets', ...(kept.length > 1 ? { pieces: kept.length } : {}), blob: { positions: putNow(positionsArray(all.positions)), indices: putNow(Uint32Array.from(all.indices)) } } as ModelNode);
  const report: LatticeReport = { cell: L, k, h, t: hol.t, nodes: cav.phi.length, snapped, joined, volume: meshVolume(all.positions, all.indices), pieces: kept.length, dropped: { count: dropped, volume: droppedVolume }, drains: added, mixed: mixedTetrahedra(cav, field.psi, field.active), triangles: all.indices.length / 3, tau,
    step: 'STEP leaves the lattice out (its infill role, O60): the exact part only; 3MF and the mass carry it' };
  return { doc: out, report, mesh: all, grid, psi: field.psi };
}
