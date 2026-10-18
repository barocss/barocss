// F1 (R4): a facet body (a mesh as facet faces, F0) split by a plane, and its section — on its own triangles, no
// explode to the planar per-triangle B-rep and no triangle limit. Each vertex's side is decided once (a vertex
// within the tie distance of the plane is on it: moved onto it, counted above; a triangle wholly on it goes to the
// side it faces away from), each crossed edge cut once (both
// triangles at it share the point), and each side closed by an exact planar cap: that side's open edges on the
// plane chained into loops and triangulated from those very points, holes by containment. Faces keep their names;
// a face cut in two is a face on each side; the cap is `<at>.cut.top` below and `<at>.cut.bottom` above (as the
// analytic split names it).
import { BrepError, isFacetFace, mergeBreps, type Brep } from './brep-core.js';
import { triangulatePolygonWithHoles } from './brep-tessellate.js';
import { facetBrepsFromTriangles, weldVertices } from './facet-brep.js';
import { MeshBrepError } from './mesh-brep.js';
import type { FacetPatch, Point } from './types.js';

type XY = [number, number];
export interface FacetSplitOptions {
  /** The plane n·p = offset (n need not be unit); below is n·p < offset. */
  readonly normal: Point | readonly number[];
  readonly offset: number;
  /** The new bodies' id and the cap faces' name stem (`<at>.cut.top`, `<at>.cut.bottom`). */
  readonly at: string;
}
export interface FacetSplitResult {
  /** Each side as a facet B-rep (all its pieces), null when nothing of the body is on that side. */
  readonly below: Brep | null;
  readonly above: Brep | null;
  /** The section: the cap's loops on the plane (closed, counter-clockwise about +n for material, clockwise for holes). */
  readonly loops: readonly (readonly Point[])[];
}

/** The body's triangles in one soup, welded once: positions, triangles wound outward, each one's face. */
interface Soup { P: Float64Array; I: Uint32Array; G: Int32Array; names: string[]; size: number; open: boolean }

export function splitFacetBrep(brep: Brep, options: FacetSplitOptions): FacetSplitResult {
  if (!brep.faces.length || !brep.faces.every(isFacetFace)) throw new BrepError('INPUT', 'facet split: the body must be all mesh faces');
  const nn = Math.hypot(options.normal[0], options.normal[1], options.normal[2]);
  if (!(nn > 0) || !Number.isFinite(options.offset)) throw new BrepError('INPUT', 'facet split: the plane needs a normal and a finite offset');
  const s = soup(brep), cap = s.names.length;
  // The weld the side meshes are built with (the tie distance is twice it: see splitSoup).
  const weld = Math.max(1e-9, s.size * 1e-6);
  const r = splitSoup(s, options.normal, options.offset, { weld, cap: s.open ? 'none' : 'both', capGroup: cap });
  const out: (Brep | null)[] = [];
  for (let k = 0; k < 2; k++) out.push(r.tris[k].length ? sideBrep(r.P, r.tris[k], r.groups[k], s, `${options.at}${k ? '_above' : '_below'}`, (g: number) => g === cap ? `${options.at}.cut.${k ? 'bottom' : 'top'}` : s.names[g], weld) : null);
  return { below: out[0], above: out[1], loops: r.loops };
}

/** Triangles (outward) over positions, each with a group. */
export interface TriangleSoup { readonly P: ArrayLike<number>; readonly I: ArrayLike<number>; readonly G: ArrayLike<number> }
export interface SoupSplit {
  /** The positions: the soup's (those within the tie moved onto the plane), then the cut points. */
  readonly P: Float64Array;
  /** Below and above: their triangles (vertex numbers, three each) and groups, the caps asked for included. */
  readonly tris: [number[], number[]]; readonly groups: [number[], number[]];
  /** The section's loops (the below side's cap's), when it was capped. */
  readonly loops: Point[][];
}
/**
 * A welded triangle soup split by the plane n·p = d (F1's core, D50): each vertex's side once (within twice the
 * weld it is on the plane, moved onto it, counted above; a triangle wholly on it to the side it faces away from),
 * each crossed edge cut once, each side asked for closed by its exact planar cap (in group `capGroup`).
 */
export function splitSoup(soup: TriangleSoup, normal: Point | readonly number[], offset: number, options: { readonly weld: number; readonly cap: 'both' | 'below' | 'above' | 'none'; readonly capGroup: number }): SoupSplit {
  const nn = Math.hypot(normal[0], normal[1], normal[2]), n: Point = [normal[0] / nn, normal[1] / nn, normal[2] / nn], d = offset / nn;
  // (The tie is twice the weld the sides are built with, so that a cut point is never within the weld of a vertex
  // off the plane: it lies on the plane; that vertex is farther than the tie from it.)
  const S = Float64Array.from(soup.P), tie = 2 * options.weld, nv0 = S.length / 3;
  const side = new Int8Array(nv0), dist = new Float64Array(nv0);
  for (let v = 0; v < nv0; v++) {
    let h = n[0] * S[3 * v] + n[1] * S[3 * v + 1] + n[2] * S[3 * v + 2] - d;
    if (Math.abs(h) <= tie) { S[3 * v] -= h * n[0]; S[3 * v + 1] -= h * n[1]; S[3 * v + 2] -= h * n[2]; h = 0; }
    dist[v] = h; side[v] = h < 0 ? 0 : 1;
  }
  // Positions: the soup's, then one cut point per crossed edge (by its unordered vertex pair).
  const extra: number[] = [], cuts = new Map<number, number>(), onPlane: number[] = [];
  // (A plane square to an axis: a cut point's coordinate along it is the plane's exactly, so the points on the plane
  // are exactly coplanar — its cap triangles then join into one planar face, PERF3 B10 — not a few ulps off it.)
  const axis = n[0] === 1 || n[0] === -1 ? 0 : n[1] === 1 || n[1] === -1 ? 1 : n[2] === 1 || n[2] === -1 ? 2 : -1, at = axis < 0 ? 0 : d * (n as readonly number[])[axis];
  for (let v = 0; v < nv0; v++) if (dist[v] === 0) onPlane.push(v);
  const cutOf = (a: number, b: number): number => {
    if (dist[a] === 0) return a; if (dist[b] === 0) return b;
    const lo = a < b ? a : b, hi = a < b ? b : a, key = lo * nv0 + hi, known = cuts.get(key);
    if (known !== undefined) return known;
    const t = dist[lo] / (dist[lo] - dist[hi]), id = nv0 + extra.length / 3;
    for (let k = 0; k < 3; k++) extra.push(k === axis ? at : S[3 * lo + k] + t * (S[3 * hi + k] - S[3 * lo + k]));
    cuts.set(key, id); return id;
  };
  const tris: [number[], number[]] = [[], []], groups: [number[], number[]] = [[], []];
  const poly: [number[], number[]] = [[], []], I = soup.I, G = soup.G;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2], g = G[t / 3];
    // A triangle in the plane: on the side it faces away from (a step's face at the cut stays with its material).
    if (dist[a] === 0 && dist[b] === 0 && dist[c] === 0) { const k = facing(S, a, b, c, n) > 0 ? 0 : 1; tris[k].push(a, b, c); groups[k].push(g); continue; }
    if (side[a] === side[b] && side[b] === side[c]) { tris[side[a]].push(a, b, c); groups[side[a]].push(g); continue; }
    poly[0].length = 0; poly[1].length = 0;
    clipEdge(a, b, side, poly, cutOf); clipEdge(b, c, side, poly, cutOf); clipEdge(c, a, side, poly, cutOf);
    for (let k = 0; k < 2; k++) fan(poly[k], tris[k], groups[k], g);
  }
  const P = new Float64Array(S.length + extra.length); P.set(S); P.set(extra, S.length);
  const plane = new Uint8Array(P.length / 3);
  for (const v of onPlane) plane[v] = 1;
  for (let v = nv0; v < plane.length; v++) plane[v] = 1;
  const loops: Point[][] = [];
  for (let k = 0; k < 2; k++) {
    if (!tris[k].length || !(options.cap === 'both' || options.cap === (k ? 'above' : 'below'))) continue;
    const found = capOf(P, tris[k], plane, n, k === 0);
    for (const tri of found.triangles) { tris[k].push(...tri); groups[k].push(options.capGroup); }
    if (k === 0) loops.push(...found.loops);
  }
  return { P, tris, groups, loops };
}

/** The soup of a facet body: its faces' triangles (outward), welded, each grouped by its face; and the faces' names. */
export function facetSoup(brep: Brep): TriangleSoup & { names: string[] } {
  const s = soup(brep);
  return { P: s.P, I: s.I, G: s.G, names: s.names };
}

function soup(brep: Brep): Soup {
  let nv = 0, nt = 0, size = 0;
  for (const f of brep.faces) { const F = f.surface as FacetPatch; nv += F.positions.length / 3; nt += F.indices.length / 3; }
  const P = new Float64Array(3 * nv), I = new Uint32Array(3 * nt), G = new Int32Array(nt), names: string[] = [];
  let pv = 0, pt = 0;
  brep.faces.forEach((f, g) => {
    const F = f.surface as FacetPatch, fw = f.sense === 'forward';
    P.set(F.positions, 3 * pv);
    for (let t = 0; t < F.indices.length; t += 3, pt++) {
      I[3 * pt] = pv + F.indices[t]; I[3 * pt + 1] = pv + F.indices[fw ? t + 1 : t + 2]; I[3 * pt + 2] = pv + F.indices[fw ? t + 2 : t + 1]; G[pt] = g;
    }
    pv += F.positions.length / 3; names.push(f.name ?? `face${g}`);
  });
  for (let i = 0; i < P.length; i++) { const x = Math.abs(P[i]); if (x > size) size = x; }
  // (Faces meet at shared corners: one vertex each, so that a cut edge is cut once for both its triangles.)
  const welded = weldVertices(P, nv, Math.max(1e-12, size * 1e-12));
  for (let i = 0; i < I.length; i++) I[i] = welded.remap[I[i]];
  return { P: welded.P, I, G, names, size, open: brep.bodies.some(b => b.kind === 'sheet') };
}

/** (b − a) × (c − a) · n: how triangle a, b, c faces along n. */
function facing(P: Float64Array, a: number, b: number, c: number, n: Point): number {
  const ux = P[3 * b] - P[3 * a], uy = P[3 * b + 1] - P[3 * a + 1], uz = P[3 * b + 2] - P[3 * a + 2], vx = P[3 * c] - P[3 * a], vy = P[3 * c + 1] - P[3 * a + 1], vz = P[3 * c + 2] - P[3 * a + 2];
  return (uy * vz - uz * vy) * n[0] + (uz * vx - ux * vz) * n[1] + (ux * vy - uy * vx) * n[2];
}
/** Triangle edge a → b into the two sides' polygons: a to its side, then the crossing (if any) to both. */
function clipEdge(a: number, b: number, side: Int8Array, poly: [number[], number[]], cutOf: (a: number, b: number) => number): void {
  push(poly[side[a]], a);
  if (side[a] !== side[b]) { const x = cutOf(a, b); push(poly[0], x); push(poly[1], x); }
}
const push = (p: number[], v: number) => { if (p[p.length - 1] !== v) p.push(v); };
/** A clipped triangle's piece (convex, 3 or 4 corners) as triangles, its repeated corners dropped. */
function fan(p: number[], out: number[], groups: number[], g: number): void {
  if (p.length > 1 && p[0] === p[p.length - 1]) p.pop();
  for (let k = 1; k + 1 < p.length; k++) { out.push(p[0], p[k], p[k + 1]); groups.push(g); }
}

/**
 * The cap closing one side: its open edges (directed as the side's triangles run, unpaired) with both ends on the
 * plane, reversed, chained into loops (at a corner where loops touch, the leftmost turn: material on the left), and
 * each material loop triangulated with the holes it holds. Below, the cap faces +n; above, −n.
 */
function capOf(P: Float64Array, T: number[], plane: Uint8Array, n: Point, below: boolean): { triangles: number[][]; loops: Point[][] } {
  const count = new Map<string, number>();
  for (let t = 0; t < T.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = T[t + k], b = T[t + (k + 1) % 3];
    if (!plane[a] || !plane[b]) continue;
    const rev = `${b},${a}`, r = count.get(rev);
    if (r) { if (r === 1) count.delete(rev); else count.set(rev, r - 1); } else count.set(`${a},${b}`, (count.get(`${a},${b}`) ?? 0) + 1);
  }
  if (!count.size) return { triangles: [], loops: [] };
  // The cap's frame: x, y with x × y the cap's normal.
  const cn: Point = below ? n : [-n[0], -n[1], -n[2]], h: Point = Math.abs(cn[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const x = unitOf(crossOf(cn, h)), y = crossOf(cn, x);
  const to2 = (v: number): XY => [P[3 * v] * x[0] + P[3 * v + 1] * x[1] + P[3 * v + 2] * x[2], P[3 * v] * y[0] + P[3 * v + 1] * y[1] + P[3 * v + 2] * y[2]];
  // Cap edges: each open edge reversed (the cap runs against the side at their shared edge).
  const next = new Map<number, number[]>();
  for (const [key, c] of count) {
    const [a, b] = key.split(',').map(Number);
    for (let i = 0; i < c; i++) { const list = next.get(b); if (list) list.push(a); else next.set(b, [a]); }
  }
  const loops: number[][] = [];
  for (const [start, list] of next) {
    while (list.length) {
      const loop = [start]; let prev = start, at = list.pop()!;
      for (let guard = 0; at !== start; guard++) {
        if (guard > count.size + 1) throw new BrepError('GEOMETRY', 'facet split: the cut does not close (the mesh is open or crosses itself at the plane)');
        loop.push(at);
        const outs = next.get(at);
        if (!outs || !outs.length) throw new BrepError('GEOMETRY', 'facet split: the cut does not close (the mesh is open or crosses itself at the plane)');
        const k = outs.length === 1 ? 0 : leftmost(to2(prev), to2(at), outs.map(to2));
        prev = at; at = outs.splice(k, 1)[0];
      }
      if (loop.length >= 3) loops.push(loop);
    }
  }
  // Material loops (counter-clockwise in the cap's frame) and holes (clockwise), each hole in the smallest
  // material loop that holds it; a loop the wrong way for its depth means the cut crosses itself.
  const flat = loops.map(l => l.map(to2)), area = flat.map(signedArea), box = flat.map(boxOf);
  const parent = flat.map((ring, i) => {
    let best = -1;
    for (let j = 0; j < flat.length; j++) {
      if (j === i || Math.abs(area[j]) <= Math.abs(area[i]) || !inBox(box[j], box[i])) continue;
      if (!inside(flat[j], probeOf(ring, flat[j]))) continue;
      if (best < 0 || Math.abs(area[j]) < Math.abs(area[best])) best = j;
    }
    return best;
  });
  const depth = parent.map((_, i) => { let k = 0; for (let p = parent[i]; p >= 0; p = parent[p]) k++; return k; });
  const triangles: number[][] = [];
  for (let i = 0; i < loops.length; i++) {
    if ((depth[i] % 2 === 0) !== (area[i] > 0)) throw new BrepError('GEOMETRY', 'facet split: the cut crosses itself (a mesh that crosses itself, or touches the plane along a fold)');
    if (depth[i] % 2) continue;
    const holes = loops.map((_, j) => j).filter(j => parent[j] === i);
    const ids = [...loops[i], ...holes.flatMap(j => loops[j])];
    for (const [a, b, c] of triangulatePolygonWithHoles(flat[i], holes.map(j => flat[j]))) triangles.push([ids[a], ids[b], ids[c]]);
  }
  return { triangles, loops: loops.map(l => l.map(v => [P[3 * v], P[3 * v + 1], P[3 * v + 2]] as Point)) };
}

/** Of the edges leaving b (arrived at from a), the one turning most to the left. */
function leftmost(a: XY, b: XY, outs: XY[]): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  let best = 0, bestAngle = -Infinity;
  outs.forEach((c, k) => { const ex = c[0] - b[0], ey = c[1] - b[1], angle = Math.atan2(dx * ey - dy * ex, dx * ex + dy * ey); if (angle > bestAngle) { bestAngle = angle; best = k; } });
  return best;
}
function signedArea(r: XY[]): number { let s = 0; for (let k = 0; k < r.length; k++) { const a = r[k], b = r[(k + 1) % r.length]; s += a[0] * b[1] - a[1] * b[0]; } return s / 2; }
function boxOf(r: XY[]): [number, number, number, number] { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of r) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; } return [x0, y0, x1, y1]; }
const inBox = (o: number[], i: number[]) => i[0] >= o[0] && i[1] >= o[1] && i[2] <= o[2] && i[3] <= o[3];
/** A point of ring r not on ring o (r may touch o at a corner): a corner of r that o does not share, else an edge's midpoint. */
function probeOf(r: XY[], o: XY[]): XY {
  const at = new Set(o.map(p => `${p[0]},${p[1]}`));
  for (const p of r) if (!at.has(`${p[0]},${p[1]}`)) return p;
  return [(r[0][0] + r[1][0]) / 2, (r[0][1] + r[1][1]) / 2];
}
function inside(r: XY[], p: XY): boolean {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > p[1]) !== (r[j][1] > p[1]) && p[0] < (r[j][0] - r[i][0]) * (p[1] - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c = !c;
  return c;
}
const crossOf = (a: Point, b: Point): Point => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unitOf = (a: Point): Point => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };

/** One side's triangles as a facet B-rep: its pieces (each closed by its cap, or a sheet when the body was one), names kept. */
function sideBrep(P: Float64Array, T: number[], G: number[], s: Soup, id: string, groupName: (g: number) => string, weld: number): Brep {
  // Only the side's own vertices.
  const used = new Int32Array(P.length / 3).fill(-1), Q: number[] = [];
  const I = new Uint32Array(T.length);
  for (let i = 0; i < T.length; i++) { const v = T[i]; if (used[v] < 0) { used[v] = Q.length / 3; Q.push(P[3 * v], P[3 * v + 1], P[3 * v + 2]); } I[i] = used[v]; }
  try {
    const pieces = facetBrepsFromTriangles(Q, I, { id, groups: G, groupName, maximumTriangles: Infinity, weldMM: weld, open: s.open });
    return pieces.length === 1 ? pieces[0] : mergeBreps(pieces, { family: 'mesh', id });
  } catch (cause) {
    if (cause instanceof MeshBrepError) throw new BrepError('GEOMETRY', `facet split: a side does not close (${cause.message})`);
    throw cause;
  }
}
