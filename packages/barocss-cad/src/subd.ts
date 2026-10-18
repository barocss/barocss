// SD1 (R5): a SubD cage (quads, sharp creases, boundaries and corners, OpenSubdiv's rules with "edge and corner"
// boundary interpolation) as a B-rep of exact bicubic B-spline faces, built straight from the cage's topology.
//
// Where every vertex is regular, the Catmull–Clark limit surface is exactly the uniform bicubic B-spline whose
// control net is the cage: each quad's 4 × 4 net is its own corners and its neighbours'. Across a boundary or an
// infinitely sharp crease the missing neighbours are mirrored phantoms, 2·P(edge) − P(inside): the limit along it is
// then the cubic B-spline of its vertices (the crease and boundary rule), and with both sides mirrored a corner is
// interpolated (the corner rule). Regular regions are packed into faces of up to 13 × 13 quads (16 × 16 poles, the
// surface limit), clamped by knot insertion; their edges are runs of cage edges between the corners of either face,
// each made once, so neighbouring faces share it exactly.
//
// Extraordinary vertices (valence ≠ 4), n-gons and darts (a crease ending inside the surface) are SD2's (R7,
// subd-sd2.ts): a Catmull–Clark step, then G1 caps at those vertices; the quads away from them stay exact here.
import { buildBrep, type Brep, type BrepFaceInput } from './brep-core.js';
import type { Curve, Point, Surface } from './types.js';
import { buildCaps, capKnots, polyMesh, refine, SubdError, type Cap, type PolyMesh } from './subd-sd2.js';

export { SubdError } from './subd-sd2.js';

export interface SubdCage {
  /** x, y, z per vertex (mm). */
  readonly positions: ArrayLike<number>;
  /** Each face its vertex numbers, counter-clockwise seen from outside (quads only in SD1). */
  readonly faces: readonly (readonly number[])[];
  /** Infinitely sharp edges, as pairs of vertex numbers. */
  readonly creases?: readonly (readonly [number, number])[];
}
export interface SubdOptions {
  readonly id?: string;
  /** SD2: at least this many Catmull–Clark steps where the cage is not regular (1 or 2): two make the caps a quarter the area, nearer the limit, at four times the faces. */
  readonly steps?: 1 | 2;
}

/** The most quads along a face's side: 13 spans are 16 poles, the surface's limit. */
const BLOCK = 13;
type P3 = [number, number, number];

/** The cage's topology: each face's neighbour across each side, which sides are sharp, and each vertex's checks. */
interface Topo { nv: number; F: number[][]; across: Int32Array; sharp: Uint8Array; P: Float64Array }

export function subdBrep(cage: SubdCage, options: SubdOptions = {}): Brep { return buildSubd(cage, options).brep; }

/** What the build did: Catmull–Clark steps taken, the caps (by refined face) and the refined cage, for the report. */
/**
 * What a SubD body is made of, for its notes (D79): Catmull–Clark steps, irregular vertices and caps, the caps'
 * largest distance from the limit surface (on the fit's samples), and that at crease, corner and boundary vertices
 * (where the caps' even angles cost the most); the body's size (its cage's bounding diagonal).
 */
export interface SubdSummary { readonly steps: number; readonly irregularVertices: number; readonly caps: number; readonly maxDeviationMM: number; readonly creaseDeviationMM: number; readonly sizeMM: number }
export function subdSummary(build: SubdBuild): SubdSummary {
  let max = 0, crease = 0;
  for (const c of build.caps.values()) { max = Math.max(max, c.deviationMM); if (c.kind !== 'smooth') crease = Math.max(crease, c.deviationMM); }
  const P = build.quads.positions, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], P[i + a]); hi[a] = Math.max(hi[a], P[i + a]); }
  const vertices = new Set([...build.caps.values()].map(c => c.vertex));
  return { steps: build.steps, irregularVertices: vertices.size, caps: build.caps.size, maxDeviationMM: max, creaseDeviationMM: crease, sizeMM: Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) };
}
/** A face's side along an edge: its block (the B-rep face of the same index), side, first cell and cells. */
export interface EdgeRun { readonly face: number; readonly side: number; readonly q0: number; readonly count: number; readonly K: number; readonly L: number }
export interface SubdBuild {
  readonly brep: Brep; readonly steps: number; readonly caps: ReadonlyMap<number, Cap>; readonly mesh: PolyMesh | null; readonly labels: readonly string[] | null;
  readonly sharpEdges: ReadonlySet<string>; readonly runs: ReadonlyMap<string, EdgeRun[]>;
  /** The quad cage the faces were built from (refined, turned outward). */
  readonly quads: SubdCage;
  /** Each B-rep face's quads: the cage face, its frame and its place in the face's grid. */
  readonly cells: readonly { readonly face: number; readonly r: number; readonly i: number; readonly j: number }[][];
}
export function buildSubd(cage: SubdCage, options: SubdOptions = {}): SubdBuild {
  const id = (options.id ?? 'subd').replace(/[^A-Za-z0-9_-]/g, '_').replace(/^(?=[^A-Za-z_])/, '_');
  const first = polyMesh(cage);
  if (first.F.every(f => f.length === 4) && first.fans.every(f => !f || f.regular)) {
    // SD1: regular everywhere, the cage is the B-spline net.
    let t = topology(cage), quads = cage;
    // (A closed cage wound inward is turned outward: each face's corners the other way round.)
    if (!t.across.some(x => x < 0) && cageVolume(t) < 0) { quads = { ...cage, faces: cage.faces.map(f => [...f].reverse()) }; t = topology(quads); }
    const blocks = packBlocks(t, new Map()), sharpEdges = new Set<string>(), runs = new Map<string, EdgeRun[]>();
    return { brep: assemble(id, t, blocks, null, sharpEdges, runs), steps: 0, caps: new Map(), mesh: null, labels: null, sharpEdges, runs, cells: cellsOf(blocks), quads };
  }
  // SD2: one Catmull–Clark step; a second when a quad would hold two irregular corners.
  let r = refine(first), steps = 1, mesh = polyMesh(r.cage);
  if (twoIrregular(mesh) || options.steps === 2) { r = refine(mesh, r.labels); steps = 2; mesh = polyMesh(r.cage); }
  let quads: SubdCage = r.cage;
  let t = topology(quads, false);
  if (!t.across.some(x => x < 0) && cageVolume(t) < 0) { quads = { ...quads, faces: quads.faces.map(f => [...f].reverse()) }; t = topology(quads, false); mesh = polyMesh(quads); }
  let lo = Infinity, hi = -Infinity; for (let i = 0; i < t.P.length; i++) { lo = Math.min(lo, t.P[i]); hi = Math.max(hi, t.P[i]); }
  const caps = buildCaps(mesh, hi - lo), blocks = packBlocks(t, caps), sharpEdges = new Set<string>(), runs = new Map<string, EdgeRun[]>();
  return { brep: assemble(id, t, blocks, r.labels, sharpEdges, runs), steps, caps, mesh, labels: r.labels, sharpEdges, runs, cells: cellsOf(blocks), quads };
}
const cellsOf = (blocks: Block[]) => blocks.map(b => b.grid.flatMap((row, j) => row.map((p, i) => ({ face: p.face, r: p.r, i, j }))));
/** Whether some quad has two irregular corners. */
function twoIrregular(m: PolyMesh): boolean { return m.F.some(f => f.filter(v => !m.fans[v]!.regular).length > 1); }

function topology(cage: SubdCage, check = true): Topo {
  const P = Float64Array.from(cage.positions), nv = P.length / 3;
  if (!Number.isInteger(nv) || nv < 4) throw new SubdError('INPUT', 'the cage needs x, y, z for at least four vertices');
  for (let i = 0; i < P.length; i++) if (!Number.isFinite(P[i])) throw new SubdError('INPUT', 'a cage position is not a finite number');
  const F = cage.faces.map(f => [...f]);
  if (!F.length) throw new SubdError('INPUT', 'the cage has no faces');
  F.forEach((f, k) => {
    if (f.length !== 4) throw new SubdError('CAPABILITY', `face ${k} has ${f.length} sides (SD1 takes quads; SD2 the rest)`);
    for (const v of f) if (!Number.isInteger(v) || v < 0 || v >= nv) throw new SubdError('INPUT', `face ${k} names vertex ${v}, not one of the ${nv}`);
    if (new Set(f).size !== 4) throw new SubdError('INPUT', `face ${k} repeats a vertex`);
  });
  // Half-edges: face k side s runs F[k][s] → F[k][s+1]; its twin runs the other way in the neighbour.
  const half = new Map<number, number>();
  F.forEach((f, k) => f.forEach((a, s) => {
    const b = f[(s + 1) % 4], key = a * nv + b;
    if (half.has(key)) throw new SubdError('INPUT', `edge ${a}–${b} is used twice the same way: the faces are not wound one way, or more than two faces meet there`);
    half.set(key, 4 * k + s);
  }));
  const across = new Int32Array(4 * F.length).fill(-1);
  F.forEach((f, k) => f.forEach((a, s) => { const twin = half.get(f[(s + 1) % 4] * nv + a); if (twin !== undefined) { if (twin >> 2 === k) throw new SubdError('INPUT', `face ${k} meets itself`); across[4 * k + s] = twin; } }));
  const creases = new Set<number>();
  for (const c of cage.creases ?? []) {
    const [a, b] = c;
    if (!half.has(a * nv + b) && !half.has(b * nv + a)) throw new SubdError('INPUT', `crease ${a}–${b} is not an edge of the cage`);
    creases.add(Math.min(a, b) * nv + Math.max(a, b));
  }
  const sharp = new Uint8Array(4 * F.length);
  F.forEach((f, k) => f.forEach((a, s) => { const b = f[(s + 1) % 4]; if (across[4 * k + s] < 0 || creases.has(Math.min(a, b) * nv + Math.max(a, b))) sharp[4 * k + s] = 1; }));
  const t: Topo = { nv, F, across, sharp, P };
  if (check) checkVertices(t);
  return t;
}

/**
 * Every vertex regular: inside, four edges and no sharp one (smooth), or exactly two sharp ones opposite (a crease
 * line), or every edge sharp (a corner: each face's corner its own); on a boundary, three edges (two of them the
 * boundary) or two (a corner), or every edge sharp.
 */
function checkVertices(t: Topo): void {
  const edges = new Map<number, Set<number>>(), sharpAt = new Map<number, Set<number>>(), boundary = new Map<number, number>(), facesAt = new Map<number, number>();
  const add = (m: Map<number, Set<number>>, v: number, e: number) => { const s = m.get(v); if (s) s.add(e); else m.set(v, new Set([e])); };
  t.F.forEach((f, k) => f.forEach((a, s) => {
    const b = f[(s + 1) % 4], e = Math.min(a, b) * t.nv + Math.max(a, b);
    add(edges, a, e); add(edges, b, e);
    if (t.sharp[4 * k + s]) { add(sharpAt, a, e); add(sharpAt, b, e); }
    if (t.across[4 * k + s] < 0) { boundary.set(a, (boundary.get(a) ?? 0) + 1); boundary.set(b, (boundary.get(b) ?? 0) + 1); }
    facesAt.set(a, (facesAt.get(a) ?? 0) + 1);
  }));
  for (const [v, es] of edges) {
    const valence = es.size, sh = sharpAt.get(v)?.size ?? 0, open = (boundary.get(v) ?? 0) > 0, faces = facesAt.get(v) ?? 0;
    if (sh === valence && valence >= 2 && (open || valence >= 3)) continue; // a corner: every face's corner its own
    if (open) {
      if (sh === 2 && (valence === 3 || valence === 2) && faces === valence - 1) continue;
      throw new SubdError('CAPABILITY', `boundary vertex ${v} has ${valence} edges${sh > 2 ? `, ${sh} of them sharp` : ''}: not regular (SD2's)`);
    }
    if (valence !== 4) throw new SubdError('CAPABILITY', `vertex ${v} has ${valence} edges (extraordinary: SD2's)`);
    if (sh === 0) continue;
    if (sh === 1) throw new SubdError('CAPABILITY', `vertex ${v} ends a crease inside the surface (a dart: SD2's)`);
    if (sh === 2 && opposite(t, v)) continue;
    throw new SubdError('CAPABILITY', `vertex ${v} has ${sh} sharp edges that do not run straight through it: only a crease line through it, or every edge sharp (a corner), is regular yet`);
  }
}
/** Whether the two sharp edges at a valence-4 vertex are opposite (a face between them on each side). */
function opposite(t: Topo, v: number): boolean {
  // Each face at v with a sharp side at v: a crease line straight through has every face at v holding exactly one.
  let faces = 0, one = 0;
  t.F.forEach((f, k) => {
    const s = f.indexOf(v); if (s < 0) return;
    faces++;
    const n = t.sharp[4 * k + s] + t.sharp[4 * k + (s + 3) % 4];
    if (n === 1) one++;
  });
  return faces === 4 && one === 4;
}

/** A face placed in a frame: its corners c0..c3 are F[face][(r + k) % 4], u along c0 → c1, v along c0 → c3. */
interface Placed { face: number; r: number }
const corner = (t: Topo, p: Placed, k: number) => t.F[p.face][(p.r + k) % 4];
/** The neighbour across side `side` of a placed face (0: −v, c0c1; 1: +u, c1c2; 2: +v, c2c3; 3: −u, c3c0), placed in the same frame; null across a sharp side. */
function step(t: Topo, p: Placed, side: number): Placed | null {
  const s = (p.r + side) % 4;
  if (t.sharp[4 * p.face + s]) return null;
  const twin = t.across[4 * p.face + s], g = twin >> 2, gs = twin & 3;
  // The twin side runs the other way: across −v the neighbour's +v side, across +u its −u side, and so on.
  return { face: g, r: (gs - (side + 2) % 4 + 4) % 4 };
}

/**
 * Regular regions in blocks of up to 13 × 13 quads: rows grown along u, then along v, never wrapping onto themselves,
 * and no quad turned more than a right angle from the seed's (a face stays a graph over its plane: its outer loop
 * then tells its side, as the validator reads it).
 */
interface Block { grid: Placed[][]; seed: number; cap?: Cap }
function packBlocks(t: Topo, caps: ReadonlyMap<number, Cap>): Block[] {
  const taken = new Int32Array(t.F.length).fill(-1), blocks: Block[] = [];
  // (A cap is a block of its own quad, in its frame from the irregular corner; no regular block grows into one.)
  for (const f of caps.keys()) taken[f] = -2;
  for (let seed = 0; seed < t.F.length; seed++) {
    const cap = caps.get(seed);
    if (cap) { taken[seed] = blocks.length; blocks.push({ grid: [[{ face: seed, r: cap.r }]], seed, cap }); continue; }
    if (taken[seed] >= 0) continue;
    const mine = new Set<number>([seed]), row: Placed[] = [{ face: seed, r: 0 }], n0 = quadNormal(t, seed);
    for (let next = step(t, row[0], 1); next && row.length < BLOCK && taken[next.face] === -1 && !mine.has(next.face) && !touchesRow(t, next, mine, 1) && dot3(quadNormal(t, next.face), n0) > 0; next = step(t, next, 1)) { row.push(next); mine.add(next.face); }
    const grid: Placed[][] = [row];
    while (grid.length < BLOCK) {
      const up: Placed[] = [];
      for (const p of grid[grid.length - 1]) { const q = step(t, p, 2); if (!q || taken[q.face] !== -1 || mine.has(q.face) || up.some(x => x.face === q.face) || !(dot3(quadNormal(t, q.face), n0) > 0)) break; up.push(q); }
      if (up.length !== row.length || !rowConsistent(t, up) || touchesRow(t, up[0], mine, 2, up)) break;
      grid.push(up); for (const p of up) mine.add(p.face);
    }
    // (Every neighbour inside the block where the grid says, else the seed alone: never a block wrapped onto itself.)
    if (!gridHolds(t, grid)) { grid.length = 1; grid[0].length = 1; }
    const b = blocks.length;
    for (const r of grid) for (const p of r) taken[p.face] = b;
    blocks.push({ grid, seed });
  }
  return blocks;
}
/** A quad's normal (its diagonals crossed; not unit). */
function quadNormal(t: Topo, face: number): P3 {
  const [a, b, c, d] = t.F[face], P = t.P;
  const ux = P[3 * c] - P[3 * a], uy = P[3 * c + 1] - P[3 * a + 1], uz = P[3 * c + 2] - P[3 * a + 2], vx = P[3 * d] - P[3 * b], vy = P[3 * d + 1] - P[3 * b + 1], vz = P[3 * d + 2] - P[3 * b + 2];
  return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
}
const dot3 = (a: P3, b: P3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** Whether each quad's neighbours that are in the grid sit next to it there, turned the same way. */
function gridHolds(t: Topo, grid: Placed[][]): boolean {
  const where = new Map<number, [number, number, number]>();
  grid.forEach((row, j) => row.forEach((p, i) => where.set(p.face, [i, j, p.r])));
  for (const [face, [i, j, r]] of where) for (let side = 0; side < 4; side++) {
    const twin = t.across[4 * face + (r + side) % 4]; if (twin < 0) continue;
    const g = where.get(twin >> 2); if (!g) continue;
    const want = [[i, j - 1], [i + 1, j], [i, j + 1], [i - 1, j]][side], q = step(t, { face, r }, side);
    if (!q || g[0] !== want[0] || g[1] !== want[1] || g[2] !== q.r) return false;
  }
  return true;
}
/** Six times the cage's signed volume (its quads split into triangles, a fan from the origin). */
function cageVolume(t: Topo): number {
  let v = 0;
  const det = (a: number, b: number, c: number) => t.P[3 * a] * (t.P[3 * b + 1] * t.P[3 * c + 2] - t.P[3 * b + 2] * t.P[3 * c + 1]) - t.P[3 * a + 1] * (t.P[3 * b] * t.P[3 * c + 2] - t.P[3 * b + 2] * t.P[3 * c]) + t.P[3 * a + 2] * (t.P[3 * b] * t.P[3 * c + 1] - t.P[3 * b + 1] * t.P[3 * c]);
  for (const f of t.F) v += det(f[0], f[1], f[2]) + det(f[0], f[2], f[3]);
  return v;
}
/** Whether a candidate's far side borders the block being grown (which would wrap it onto itself). */
function touchesRow(t: Topo, p: Placed, mine: Set<number>, side: number, row?: Placed[]): boolean {
  for (const q of row ?? [p]) { const far = step(t, q, side); if (far && mine.has(far.face)) return true; }
  return false;
}
/** A new row's faces side by side in u as the frame says. */
function rowConsistent(t: Topo, row: Placed[]): boolean {
  for (let i = 0; i + 1 < row.length; i++) { const n = step(t, row[i], 1); if (!n || n.face !== row[i + 1].face || n.r !== row[i + 1].r) return false; }
  return true;
}

/** A placed face's 4 × 4 control net, phantoms mirrored across its sharp sides: net[a][b], a along u, b along v. */
function netOf(t: Topo, p: Placed): P3[][] {
  const pt = (v: number): P3 => [t.P[3 * v], t.P[3 * v + 1], t.P[3 * v + 2]];
  const N: (P3 | null)[][] = [[null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]];
  N[1][1] = pt(corner(t, p, 0)); N[2][1] = pt(corner(t, p, 1)); N[2][2] = pt(corner(t, p, 2)); N[1][2] = pt(corner(t, p, 3));
  const below = step(t, p, 0), right = step(t, p, 1), above = step(t, p, 2), left = step(t, p, 3);
  if (below) { N[1][0] = pt(corner(t, below, 0)); N[2][0] = pt(corner(t, below, 1)); }
  if (right) { N[3][1] = pt(corner(t, right, 1)); N[3][2] = pt(corner(t, right, 2)); }
  if (above) { N[1][3] = pt(corner(t, above, 3)); N[2][3] = pt(corner(t, above, 2)); }
  if (left) { N[0][1] = pt(corner(t, left, 0)); N[0][2] = pt(corner(t, left, 3)); }
  // Diagonals, through a smooth regular corner.
  if (below && left) { const d = step(t, below, 3); if (d) N[0][0] = pt(corner(t, d, 0)); }
  if (below && right) { const d = step(t, below, 1); if (d) N[3][0] = pt(corner(t, d, 1)); }
  if (above && right) { const d = step(t, above, 1); if (d) N[3][3] = pt(corner(t, d, 2)); }
  if (above && left) { const d = step(t, above, 3); if (d) N[0][3] = pt(corner(t, d, 3)); }
  const mirror = (x: P3, y: P3): P3 => [2 * x[0] - y[0], 2 * x[1] - y[1], 2 * x[2] - y[2]];
  for (const a of [1, 2]) { if (!below) N[a][0] = mirror(N[a][1]!, N[a][2]!); if (!above) N[a][3] = mirror(N[a][2]!, N[a][1]!); }
  for (const b of [1, 2]) { if (!left) N[0][b] = mirror(N[1][b]!, N[2][b]!); if (!right) N[3][b] = mirror(N[2][b]!, N[1][b]!); }
  // Corners left: mirrored along whichever side is sharp (both sharp: the corner rule).
  for (const [a, b, a1, a2, b1, b2] of [[0, 0, 1, 2, 1, 2], [3, 0, 2, 1, 1, 2], [3, 3, 2, 1, 2, 1], [0, 3, 1, 2, 2, 1]]) {
    if (N[a][b]) continue;
    const sideU = a === 0 ? left : right;
    N[a][b] = sideU ? mirror(N[a][b1]!, N[a][b2]!) : mirror(N[a1][b]!, N[a2][b]!);
  }
  return N as P3[][];
}

/** Boehm knot insertion of `u` (already there m times) into a degree-3 B-spline: new points and knots. */
function insert(points: P3[], knots: number[], u: number): { points: P3[]; knots: number[] } {
  let k = knots.length - 1; while (k > 0 && knots[k] > u) k--;
  let m = 0; for (let i = k; i >= 0 && knots[i] === u; i--) m++;
  const out: P3[] = [];
  for (let i = 0; i <= points.length; i++) {
    if (i <= k - 3) out.push(points[i]);
    else if (i > k - m) out.push(points[i - 1]);
    else { const d = knots[i + 3] - knots[i], a = d > 0 ? (u - knots[i]) / d : 0, p = points[i - 1], q = points[i]; out.push([(1 - a) * p[0] + a * q[0], (1 - a) * p[1] + a * q[1], (1 - a) * p[2] + a * q[2]]); }
  }
  return { points: out, knots: [...knots.slice(0, k + 1), u, ...knots.slice(k + 1)] };
}
/** A uniform cubic B-spline of n + 3 poles (n spans) as the same curve clamped on [0, n]: n + 3 poles. */
function clamp(poles: P3[]): P3[] {
  const n = poles.length - 3;
  let c = { points: poles, knots: poles.map((_, i) => i).concat([poles.length, poles.length + 1, poles.length + 2, poles.length + 3]) };
  c = insert(c.points, c.knots, 3); c = insert(c.points, c.knots, 3); c = insert(c.points, c.knots, n + 3); c = insert(c.points, c.knots, n + 3);
  return c.points.slice(2, c.points.length - 2);
}
const clampedKnots = (n: number) => [0, 0, 0, 0, ...Array.from({ length: n - 1 }, (_, i) => i + 1), n, n, n, n];

/** A block's control net, (K + 3) × (L + 3), from its quads' nets. */
function blockNet(t: Topo, b: Block): P3[][] {
  const K = b.grid[0].length, L = b.grid.length, net: P3[][] = Array.from({ length: K + 3 }, () => new Array<P3>(L + 3));
  for (let j = 0; j < L; j++) for (let i = 0; i < K; i++) { const N = netOf(t, b.grid[j][i]); for (let a = 0; a < 4; a++) for (let c = 0; c < 4; c++) net[i + a][j + c] = N[a][c]; }
  return net;
}

function assemble(id: string, t: Topo, blocks: Block[], labels: readonly string[] | null, sharpEdges: Set<string>, edgeRuns: Map<string, EdgeRun[]>): Brep {
  // Which block (and where in it) each face is.
  const blockOf = new Int32Array(t.F.length), at = new Int32Array(2 * t.F.length);
  blocks.forEach((b, k) => b.grid.forEach((row, j) => row.forEach((p, i) => { blockOf[p.face] = k; at[2 * p.face] = i; at[2 * p.face + 1] = j; })));
  const nets = blocks.map(b => b.cap ? null : blockNet(t, b));
  const vertexIds = new Map<number, string>(), vertices: { id: string; point: Point }[] = [];
  const edges: { id: string; curve: Curve; vertices: [string, string]; name?: string }[] = [], edgeOf = new Map<number, { id: string; from: number }>();
  const faces: BrepFaceInput[] = [];
  const vertexAt = (cv: number, p: P3) => { let v = vertexIds.get(cv); if (!v) { v = `${id}_v${cv}`; vertexIds.set(cv, v); vertices.push({ id: v, point: [p[0], p[1], p[2]] }); } return v; };
  blocks.forEach((b, k) => {
    const net = nets[k], K = b.grid[0].length, L = b.grid.length;
    let surface: Surface;
    if (b.cap) surface = { kind: 'surface', id: `${id}_s${k}`, degreeU: 3, degreeV: 3, knotsU: capKnots(b.cap.tau), knotsV: capKnots(b.cap.tau), controlPoints: b.cap.poles.map(r => r.map(p => [p[0], p[1], p[2]] as Point)), weights: b.cap.poles.map(r => r.map(() => 1)) };
    else {
      // The face: the net clamped along u (each v column), then along v (each u row).
      const cols: P3[][] = []; for (let c = 0; c < L + 3; c++) cols.push(clamp(net!.map(row => row[c])));
      const control: Point[][] = []; for (let a = 0; a < K + 3; a++) control.push(clamp(cols.map(col => col[a])).map(p => [p[0], p[1], p[2]] as Point));
      surface = { kind: 'surface', id: `${id}_s${k}`, degreeU: 3, degreeV: 3, knotsU: clampedKnots(K), knotsV: clampedKnots(L), controlPoints: control, weights: control.map(r => r.map(() => 1)) };
    }
    // Its boundary, counter-clockwise in (u, v): each side in runs that end at a corner of this block or the one across.
    const uses: { edge: string; sense: 'forward' | 'reversed' }[] = [];
    for (let side = 0; side < 4; side++) {
      const n = side % 2 === 0 ? K : L, cells: Placed[] = [];
      for (let q = 0; q < n; q++) cells.push(side === 0 ? b.grid[0][q] : side === 1 ? b.grid[q][K - 1] : side === 2 ? b.grid[L - 1][K - 1 - q] : b.grid[L - 1 - q][0]);
      // The cage edge each cell's side is (its cage vertices in the loop's direction) and who is across.
      const runs: { from: number; to: number; cells: number[] }[] = [];
      const keyAcross = (p: Placed) => { const s = (p.r + side) % 4, twin = t.across[4 * p.face + s]; return twin < 0 ? -1 : blockOf[twin >> 2]; };
      for (let q = 0; q < n; q++) {
        const p = cells[q], s = (p.r + side) % 4, a = t.F[p.face][s], c = t.F[p.face][(s + 1) % 4], across = keyAcross(p);
        const last = runs[runs.length - 1], breakHere = !last || across !== keyAcross(cells[q - 1]) || (across >= 0 && isBlockCorner(t, blocks, blockOf, at, p, side));
        if (breakHere) runs.push({ from: a, to: c, cells: [q] }); else { last.to = c; last.cells.push(q); }
      }
      for (const run of runs) {
        const key = edgeKey(t, cells[run.cells[0]], side, run.cells.length);
        let e = edgeOf.get(key);
        if (!e) {
          const curve = b.cap ? capCurve(b.cap, side, `${id}_e${edges.length}`) : runCurve(net!, K, L, side, run.cells[0], run.cells.length, `${id}_e${edges.length}`);
          { const p = cells[run.cells[0]]; if (t.sharp[4 * p.face + (p.r + side) % 4]) sharpEdges.add(curve.id); }
          const p0 = curve.controlPoints[0], p1 = curve.controlPoints[curve.controlPoints.length - 1];
          e = { id: curve.id, from: run.from };
          edges.push({ id: curve.id, curve, vertices: [vertexAt(run.from, p0 as P3), vertexAt(run.to, p1 as P3)] });
          edgeOf.set(key, e);
        }
        uses.push({ edge: e.id, sense: e.from === run.from ? 'forward' : 'reversed' });
        const list = edgeRuns.get(e.id) ?? []; list.push({ face: k, side, q0: run.cells[0], count: run.cells.length, K, L }); edgeRuns.set(e.id, list);
      }
    }
    faces.push({ id: `${id}_f${k}`, name: `${id}.${b.cap ? 'cap' : 'patch'}${labels ? labels[b.seed] : b.seed}`, surface, sense: 'forward', loops: [{ kind: 'outer', uses }] });
  });
  const open = t.across.some(x => x < 0);
  // A closed body outward: the cage wound inward is turned (its faces reversed).
  const brep = buildBrep({ source: { family: 'subd', id }, vertices, edges, bodies: [{ id, kind: open ? 'sheet' : 'solid', shells: [{ id: `${id}_shell`, faces, closed: !open }] }] });
  return brep;
}
/** A cap's side as its boundary curve, running the loop's way (knots 0 0 0 0 τ τ 1 1 1 1, or 1 − τ run back). */
function capCurve(cap: Cap, side: number, id: string): Curve {
  const P = cap.poles, line: Point[] = [];
  for (let a = 0; a < 6; a++) line.push(side === 0 ? P[a][0] : side === 1 ? P[5][a] : side === 2 ? P[5 - a][5] : P[0][5 - a]);
  // (Running back along u or v, the knot sits at 1 − τ.)
  const knots = side < 2 ? capKnots(cap.tau) : capKnots(1 - cap.tau);
  return { kind: 'curve', id, degree: 3, knots, controlPoints: line.map(p => [p[0], p[1], p[2]] as Point), weights: line.map(() => 1) };
}
/** Whether a face's side ends at a corner of the block across (its neighbour along the side is in another block). */
function isBlockCorner(t: Topo, blocks: Block[], blockOf: Int32Array, at: Int32Array, p: Placed, side: number): boolean {
  // The previous cell along this side in the face across: its block must be the same and adjacent in its grid.
  const s = (p.r + side) % 4, twin = t.across[4 * p.face + s];
  if (twin < 0) return false;
  const g = twin >> 2, b = blocks[blockOf[g]], i = at[2 * g], j = at[2 * g + 1], K = b.grid[0].length, L = b.grid.length;
  // The face across has this edge on one of its block's sides; along that side, the run continues while the
  // previous cell (in this side's order: the next one in the face across's order) is in its block.
  const gp = b.grid[j][i], gs = twin & 3, local = (gs - gp.r + 4) % 4;
  // In the face across's own direction this side runs the other way: our previous cell is its next.
  const ni = local === 0 ? i + 1 : local === 2 ? i - 1 : i, nj = local === 1 ? j + 1 : local === 3 ? j - 1 : j;
  return !(ni >= 0 && ni < K && nj >= 0 && nj < L);
}
/** One key per run of cage edges, the same from both faces: its smallest undirected cage edge and its length. */
function edgeKey(t: Topo, p: Placed, side: number, length: number): number {
  let best = Infinity, q: Placed | null = p;
  for (let n = 0; n < length && q; n++) {
    const s = (q.r + side) % 4, a = t.F[q.face][s], c = t.F[q.face][(s + 1) % 4];
    best = Math.min(best, Math.min(a, c) * t.nv + Math.max(a, c));
    // (The next cell along the side, in the side's loop direction.)
    q = n + 1 < length ? stepAlong(t, q, side) : null;
  }
  return best * 128 + length;
}
const stepAlong = (t: Topo, p: Placed, side: number): Placed | null => side === 0 ? step(t, p, 1) : side === 1 ? step(t, p, 2) : side === 2 ? step(t, p, 3) : step(t, p, 0);
/**
 * The limit curve along a run of `count` quads on a side of a block, starting at quad `q0` in the loop's direction,
 * as a clamped cubic B-spline running that way: the net's line at the side averaged across it, (1, 4, 1)/6.
 */
function runCurve(net: P3[][], K: number, L: number, side: number, q0: number, count: number, id: string): Curve {
  const line: P3[] = [];
  const avg = (x: P3, y: P3, z: P3): P3 => [(x[0] + 4 * y[0] + z[0]) / 6, (x[1] + 4 * y[1] + z[1]) / 6, (x[2] + 4 * y[2] + z[2]) / 6];
  if (side === 0) for (let a = 0; a < K + 3; a++) line.push(avg(net[a][0], net[a][1], net[a][2]));
  else if (side === 1) for (let c = 0; c < L + 3; c++) line.push(avg(net[K + 2][c], net[K + 1][c], net[K][c]));
  else if (side === 2) for (let a = K + 2; a >= 0; a--) line.push(avg(net[a][L + 2], net[a][L + 1], net[a][L]));
  else for (let c = L + 2; c >= 0; c--) line.push(avg(net[0][c], net[1][c], net[2][c]));
  const poles = clamp(line.slice(q0, q0 + count + 3));
  return { kind: 'curve', id, degree: 3, knots: clampedKnots(count), controlPoints: poles.map(p => [p[0], p[1], p[2]] as Point), weights: poles.map(() => 1) };
}
