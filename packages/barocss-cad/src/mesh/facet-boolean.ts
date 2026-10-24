// F2 (R6): a Boolean of a mesh body (facet faces, F0) with an analytic body (planes, cylinders, spheres, cones,
// B-spline faces), the analytic faces kept exact.
//
// Only the mesh near the tool takes part. The mesh is cut (F1, exact planar caps) to the box round the tool, a
// little larger than it; that near part, a few thousand triangles at most for a hole or a boss, becomes planar
// faces and goes through the exact analytic Boolean with the tool. The far part is untouched. Then the two are
// one triangle soup again — the far mesh, the near result tessellated finely, the caps between them dropped — and
// it becomes a facet body once more: its faces grouped by where they came from (each mesh face keeps its name),
// and each face of the tool given its exact surface back. Its rim, where it meets the mesh, is a polyline whose
// corners lie on both; the rim edges carry the chords' distance from the exact surface as their tolerance.
//
// A body that already holds exact faces (an earlier F2) takes part the same way: those faces are tessellated into
// the soup with their surfaces noted, and given back at the end.
import { booleanAnalytic, type AnalyticBooleanOperation } from '../brep/analytic-boolean.js';
import { BrepError, checkBrep, isFacetFace, mergeBreps, type Brep, type BrepFace } from '../brep/brep-core.js';
import { tessellateBrep } from '../brep/brep-tessellate.js';
import { facetBrepsFromTriangles, weldVertices } from './facet-brep.js';
import { facetSoup, splitSoup } from './facet-split.js';
import { surfaceDomain, surfaceEvaluator } from '../core/math.js';
import { brepFromTriangles, MeshBrepError } from './mesh-brep.js';
import { selfIntersections } from './mesh-repair.js';
import type { FacetPatch, Point, Surface } from '../types.js';
import { KernelError } from '../core/barocss-error.js';

export interface FacetBooleanOptions {
  /** The result's id. */
  readonly id: string;
  /** How finely the tool's faces and rims are sampled (segments a quarter turn); default 32. */
  readonly segmentsPerQuarter?: number;
  /** At most this many mesh triangles near the tool (the exact Boolean's share); default 16 000. */
  readonly nearTriangles?: number;
}
export class FacetBooleanError extends KernelError {
  constructor(readonly code: 'CAPABILITY' | 'GEOMETRY', detail: string) { super(detail); this.name = 'FacetBooleanError'; }
}

/** Where a face came from: its name, and its exact surface (null for a mesh face). */
interface Source { readonly name: string; readonly surface: Surface | null }
/** Triangles (outward), each with its source's index. */
interface Soup { P: number[]; I: number[]; G: number[] }
const CAP = /^cap$/;

/** `a` holds facet faces (and maybe exact ones from an earlier F2); `b` none. */
export function facetBoolean(a: Brep, b: Brep, op: AnalyticBooleanOperation, options: FacetBooleanOptions): Brep {
  if (!a.faces.some(isFacetFace) || b.faces.some(isFacetFace)) throw new BrepError('INPUT', 'facet Boolean: the first body must hold mesh faces, the second none');
  if (a.bodies.some(x => x.kind === 'sheet')) throw new FacetBooleanError('GEOMETRY', 'Booleans need a closed solid: this mesh is open (a sheet)');
  const q = options.segmentsPerQuarter ?? 32, id = options.id, sources: Source[] = [];
  // The mesh as one welded soup, each triangle grouped by its source face (an exact face tessellated, its surface noted).
  const mesh = soupOf(a, sources, q);
  // (A mesh that crosses itself has no inside to cut, D46: refused, saying where; worked out once a body.)
  const crossing = crossingsOf(a, mesh);
  if (crossing.count) throw new FacetBooleanError('GEOMETRY', `Booleans need a mesh that does not cross itself: this one does in ${crossing.count} place${crossing.count > 1 ? 's' : ''} (near ${crossing.at.map(x => +x.toFixed(2)).join(', ')}); repair does not fix that yet`);
  let size = 0; for (let i = 0; i < mesh.P.length; i++) size = Math.max(size, Math.abs(mesh.P[i]));
  const weld = Math.max(1e-9, size * 1e-6);
  // The box round the tool, a little larger: the mesh outside it never meets the tool. Clipped to it plane by plane
  // (F1's split on the soup), the part kept capped each time, the parts cut away left as triangles (no body built).
  const tool = tessellateBrep(b, { segmentsPerQuarter: 4 }).positionsMM, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < tool.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], tool[i + k]); hi[k] = Math.max(hi[k], tool[i + k]); }
  // (A tenth of the tool's smallest extent: the caps clear of it by far more than any tolerance, the near part small.)
  const pad = 0.1 * Math.min(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) + 1e-3;
  const box = boundsOf(mesh.P);
  let inside: Soup | null = mesh;
  const outside: Soup[] = [], planes: [number, number][] = [];
  for (let k = 0; k < 3 && inside; k++) for (const end of [0, 1]) {
    if (!inside) break;
    const c = end ? hi[k] + pad : lo[k] - pad, n: Point = [0, 0, 0]; n[k] = 1;
    if (!(c > box[k] && c < box[k + 3])) continue;
    planes.push([k, c]);
    const r = splitSoup({ P: inside.P, I: inside.I, G: inside.G }, n, c, { weld, cap: end ? 'below' : 'above', capGroup: CAP_GROUP });
    const keep = end ? 0 : 1;
    outside.push(compact(r.P, r.tris[1 - keep], r.groups[1 - keep]));
    inside = r.tris[keep].length ? compact(r.P, r.tris[keep], r.groups[keep]) : null;
  }
  // The tool's faces named by source token.
  const bTok: Brep = { ...b, faces: b.faces.map((f, i) => { sources.push({ name: f.name ?? `face${i}`, surface: f.surface as Surface }); return { ...f, name: `t${sources.length - 1}` }; }) };
  if (!inside) {
    // Nothing of the mesh near the tool: they do not meet.
    if (op === 'difference') return a;
    if (op === 'intersection') return mergeBreps([], { family: 'mesh', id });
    return mergeBreps([a, b], { family: 'mesh', id });
  }
  let near = 0; for (let t = 0; t < inside.G.length; t++) if (inside.G[t] !== CAP_GROUP) near++;
  if (near > (options.nearTriangles ?? 16_000)) throw new FacetBooleanError('CAPABILITY', `the tool meets ${near} triangles of the mesh near it, more than the ${options.nearTriangles ?? 16_000} the exact Boolean takes there (a smaller tool, or a coarser mesh)`);
  const planar = planarOf(inside, id);
  let result: Brep;
  try { result = booleanAnalytic(planar, bTok, op, { id }); }
  catch (cause) { if (cause instanceof BrepError) throw new FacetBooleanError(/not supported/.test(cause.message) ? 'CAPABILITY' : 'GEOMETRY', cause.message.replace(/^B-rep: (analytic Boolean: )?/, '')); throw cause; }
  // One soup again: the near result tessellated (caps dropped) and, unless intersecting, the far mesh.
  const soup: Soup = { P: [], I: [], G: [] };
  addTessellated(soup, result, q);
  if (op !== 'intersection') for (const piece of outside) addSoup(soup, piece);
  if (!soup.I.length) return mergeBreps([], { family: 'mesh', id });
  mendTJunctions(soup, planes);
  let pieces: Brep[];
  try { pieces = facetBrepsFromTriangles(soup.P, soup.I, { id, groups: soup.G, groupName: g => `t${g}`, maximumTriangles: Infinity, maximumRegions: Infinity, creaseDegrees: 180, weldMM: soupWeld(soup) }); }
  catch (cause) { if (cause instanceof MeshBrepError) { throw new FacetBooleanError('GEOMETRY', `the result does not close (${cause.message})`); } throw cause; }
  return restore(pieces.length === 1 ? pieces[0] : mergeBreps(pieces, { family: 'mesh', id }), sources);
}

/** A mesh body as one welded soup (P, I, G), each triangle grouped by its source (sources gets one per face). */
function soupOf(a: Brep, sources: Source[], q: number): Soup {
  const base = sources.length;
  a.faces.forEach((f, i) => sources.push({ name: f.name ?? `face${i}`, surface: isFacetFace(f) ? null : f.surface as Surface }));
  if (a.faces.every(isFacetFace)) { const s = facetSoup(a); return { P: Array.from(s.P), I: Array.from(s.I), G: Array.from(s.G, g => base + g) }; }
  const out: Soup = { P: [], I: [], G: [] }, mesh = tessellateBrep(a, { segmentsPerQuarter: q }), index = new Map(a.faces.map((f, i) => [f.id, i]));
  for (const mf of mesh.faces) appendMeshFace(out, mesh.positionsMM, mesh.indices, mf, base + index.get(mf.faceId)!);
  let size = 0; for (const x of out.P) size = Math.max(size, Math.abs(x));
  const { P, remap } = weldVertices(out.P, out.P.length / 3, Math.max(1e-12, size * 1e-12));
  return { P: Array.from(P), I: out.I.map(v => remap[v]), G: out.G };
}
const CAP_GROUP = -1;
const crossings = new WeakMap<Brep, { count: number; at: Point }>();
function crossingsOf(a: Brep, mesh: Soup): { count: number; at: Point } {
  let c = crossings.get(a);
  if (!c) { const r = selfIntersections(Float64Array.from(mesh.P), Uint32Array.from(mesh.I)); c = { count: r.count, at: (r.at[0] ?? [0, 0, 0]) as Point }; crossings.set(a, c); }
  return c;
}
/** x, y, z minima then maxima. */
function boundsOf(P: ArrayLike<number>): number[] {
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { const x = P[i + k]; if (x < b[k]) b[k] = x; if (x > b[k + 3]) b[k + 3] = x; }
  return b;
}
/** The triangles' own vertices only, renumbered. */
function compact(P: ArrayLike<number>, T: number[], G: number[]): Soup {
  const used = new Int32Array(P.length / 3).fill(-1), Q: number[] = [], I: number[] = new Array(T.length);
  for (let i = 0; i < T.length; i++) { const v = T[i]; if (used[v] < 0) { used[v] = Q.length / 3; Q.push(P[3 * v], P[3 * v + 1], P[3 * v + 2]); } I[i] = used[v]; }
  return { P: Q, I, G: G.slice() };
}

/** The near mesh (capped) as planar faces (coplanar triangles of one source joined), named for their source or `cap`. */
function planarOf(inside: Soup, id: string): Brep {
  // (The caps' group made non-negative: a negative group is no group to the planar builder.)
  const capAt = 2 ** 30, G = inside.G.map(g => g === CAP_GROUP ? capAt : g);
  try { return brepFromTriangles(inside.P, inside.I, { id: `${id}_near`, groups: G, groupName: g => g === capAt ? 'cap' : `t${g}`, maximumTriangles: Infinity }); }
  catch (cause) { if (cause instanceof MeshBrepError) throw new FacetBooleanError('GEOMETRY', `the mesh near the tool: ${cause.message}`); throw cause; }
}

/** A Boolean's result tessellated into the soup, each face under its source (t<k>, a piece's #n left off); caps left out. */
function addTessellated(soup: Soup, brep: Brep, q: number): void {
  const mesh = tessellateBrep(brep, { segmentsPerQuarter: q }), names = new Map(brep.faces.map(f => [f.id, f.name ?? '']));
  for (const mf of mesh.faces) {
    const name = names.get(mf.faceId)!.replace(/#\d+$/, '');
    if (CAP.test(name)) continue;
    const m = /^t(\d+)$/.exec(name); if (!m) throw new FacetBooleanError('GEOMETRY', `a face of the result has no source (${name})`);
    appendMeshFace(soup, mesh.positionsMM, mesh.indices, mf, Number(m[1]));
  }
}
function appendMeshFace(soup: Soup, P: Float64Array, I: Uint32Array, mf: { vertexOffset: number; vertexCount: number; indexOffset: number; indexCount: number }, g: number): void {
  const base = soup.P.length / 3;
  for (let v = 0; v < mf.vertexCount; v++) soup.P.push(P[3 * (mf.vertexOffset + v)], P[3 * (mf.vertexOffset + v) + 1], P[3 * (mf.vertexOffset + v) + 2]);
  for (let t = mf.indexOffset; t < mf.indexOffset + mf.indexCount; t += 3) { soup.I.push(base + I[t] - mf.vertexOffset, base + I[t + 1] - mf.vertexOffset, base + I[t + 2] - mf.vertexOffset); soup.G.push(g); }
}
/** A cut-away part's triangles into the soup, caps (of earlier planes) left out. */
function addSoup(soup: Soup, part: Soup): void {
  const base = soup.P.length / 3;
  for (const x of part.P) soup.P.push(x);
  for (let t = 0; t < part.G.length; t++) if (part.G[t] !== CAP_GROUP) { soup.I.push(base + part.I[3 * t], base + part.I[3 * t + 1], base + part.I[3 * t + 2]); soup.G.push(part.G[t]); }
}
/**
 * The soup welded, and each triangle with a vertex of the other side lying inside one of its open edges split there
 * (the cuts run one after another, so a piece cut away early lacks the corners later cuts add along its cut line:
 * they lie exactly on it). A triangle split on one edge is fanned from its far corner; on more, from its centre.
 */
/**
 * The final weld: the soup is welded already (mendTJunctions), so a hair — a thin triangle of the rim's tessellation
 * is a triangle, not one of no area to drop (dropping it would open the mesh).
 */
function soupWeld(soup: Soup): number { let size = 0; for (const x of soup.P) size = Math.max(size, Math.abs(x)); return Math.max(1e-12, size * 1e-12); }
function mendTJunctions(soup: Soup, planes: readonly [number, number][]): void {
  let size = 0; for (const x of soup.P) size = Math.max(size, Math.abs(x));
  const weld = Math.max(1e-9, size * 1e-6), n = soup.P.length / 3, { P, remap } = weldVertices(soup.P, n, weld), nv = P.length / 3;
  const I = soup.I.map(v => remap[v]), directed = new Map<number, number>();
  // (Only edges on a cut plane can be open: elsewhere the mesh is as it was. Each vertex's planes as bits.)
  const on = new Uint8Array(nv);
  for (let v = 0; v < nv; v++) for (let q = 0; q < planes.length; q++) if (Math.abs(P[3 * v + planes[q][0]] - planes[q][1]) <= 4 * weld) on[v] |= 1 << q;
  for (let t = 0; t < I.length; t += 3) for (let k = 0; k < 3; k++) { const a = I[t + k], b = I[t + (k + 1) % 3]; if (on[a] & on[b]) directed.set(a * nv + b, t / 3); }
  const open: [number, number, number][] = [];
  for (const [key, t] of directed) { const a = Math.floor(key / nv), b = key % nv; if (!directed.has(b * nv + a)) open.push([a, b, t]); }
  soup.P = Array.from(P); soup.I = I;
  if (!open.length) return;
  const ends = [...new Set(open.flatMap(([a, b]) => [a, b]))], splits = new Map<number, Map<number, number[]>>();
  for (const [a, b, t] of open) {
    const ax = P[3 * a], ay = P[3 * a + 1], az = P[3 * a + 2], dx = P[3 * b] - ax, dy = P[3 * b + 1] - ay, dz = P[3 * b + 2] - az, L2 = dx * dx + dy * dy + dz * dz;
    const on: [number, number][] = [];
    for (const p of ends) {
      if (p === a || p === b) continue;
      const px = P[3 * p] - ax, py = P[3 * p + 1] - ay, pz = P[3 * p + 2] - az, s = (px * dx + py * dy + pz * dz) / L2;
      if (!(s > 0 && s < 1)) continue;
      const ex = px - s * dx, ey = py - s * dy, ez = pz - s * dz;
      if (ex * ex + ey * ey + ez * ez <= 16 * weld * weld) on.push([s, p]);
    }
    if (!on.length) continue;
    on.sort((x, y) => x[0] - y[0]);
    let m = splits.get(t); if (!m) splits.set(t, m = new Map());
    m.set(a, on.map(x => x[1]));
  }
  const keepI: number[] = [], keepG: number[] = [];
  for (let t = 0; t < I.length / 3; t++) {
    const m = splits.get(t), tri = [I[3 * t], I[3 * t + 1], I[3 * t + 2]], g = soup.G[t];
    if (!m) { keepI.push(...tri); keepG.push(g); continue; }
    const ring: number[] = [];
    for (let k = 0; k < 3; k++) { ring.push(tri[k]); ring.push(...(m.get(tri[k]) ?? [])); }
    const split = [0, 1, 2].filter(k => m.has(tri[k]));
    if (split.length === 1) {
      // Fan from the corner opposite the split edge.
      const far = tri[(split[0] + 2) % 3], start = ring.indexOf(far);
      const seq = [...ring.slice(start), ...ring.slice(0, start)];
      for (let i = 1; i + 1 < seq.length; i++) { keepI.push(far, seq[i], seq[i + 1]); keepG.push(g); }
    } else {
      const c = soup.P.length / 3;
      soup.P.push((P[3 * tri[0]] + P[3 * tri[1]] + P[3 * tri[2]]) / 3, (P[3 * tri[0] + 1] + P[3 * tri[1] + 1] + P[3 * tri[2] + 1]) / 3, (P[3 * tri[0] + 2] + P[3 * tri[1] + 2] + P[3 * tri[2] + 2]) / 3);
      for (let i = 0; i < ring.length; i++) { keepI.push(c, ring[i], ring[(i + 1) % ring.length]); keepG.push(g); }
    }
  }
  soup.I = keepI; soup.G = keepG;
}

/**
 * The soup's facet body with its sources given back: each face named for its source (a second region of one
 * source `#2`, …), each tool face (and each exact face of the input) its exact surface, turned to face out; the
 * edges on such a face take the distance of their chords from it as their tolerance.
 */
function restore(brep: Brep, sources: Source[]): Brep {
  const count = new Map<string, number>(), exact = new Map<string, Surface>(), faces: BrepFace[] = [];
  for (const f of brep.faces) {
    const src = sources[Number(/^t(\d+)/.exec(f.name ?? '')![1])], k = count.get(src.name) ?? 0; count.set(src.name, k + 1);
    const name = k ? `${src.name}#${k + 1}` : src.name;
    if (!src.surface) { faces.push({ ...f, name }); continue; }
    const F = f.surface as FacetPatch, sense = facing(src.surface, F, f.sense);
    faces.push({ ...f, name, surface: src.surface, sense });
    exact.set(f.id, src.surface);
  }
  // Rim tolerances: each edge on an exact face, its chords' sagitta. (Its corners lie on the exact rim, which lies on
  // the surface: a chord is no farther from the surface than from the rim, L²κ/8 for a chord of length L where the
  // rim bends by κ, taken from three corners in a row. No projection: beside a pole a parameter search can stall.)
  const coedges = new Map(brep.coedges.map(c => [c.id, c])), loops = new Map(brep.loops.map(l => [l.id, l])), edgeById = new Map(brep.edges.map(e => [e.id, e])), tol = new Map<string, number>();
  for (const f of faces) {
    const S = exact.get(f.id); if (!S) continue;
    for (const lid of f.loops) for (const cid of loops.get(lid)!.coedges) {
      const e = edgeById.get(coedges.get(cid)!.edge)!, pts = e.curve.controlPoints;
      let worst = tol.get(e.id) ?? 0;
      // (A single chord has no three corners: its midpoint measured, no farther than half the chord — its ends are on it.)
      if (pts.length >= 3) worst = Math.max(worst, sagitta(pts));
      else { const [a, b] = pts, half = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 2; worst = Math.max(worst, Math.min(half, nearest(S, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]).distance)); }
      tol.set(e.id, worst);
    }
  }
  const edges = brep.edges.map(e => { const t = tol.get(e.id); return t !== undefined && 2 * t > e.toleranceMM ? { ...e, toleranceMM: 2 * t } : e; });
  const out: Brep = { ...brep, faces, edges };
  const report = checkBrep(out);
  if (!report.valid) throw new FacetBooleanError('GEOMETRY', `the result is not valid: ${report.issues[0]}`);
  return out;
}

/** The sense that turns surface S's normal to the facet patch's outward side: the vote of its five largest triangles. */
function facing(S: Surface, F: FacetPatch, sense: 'forward' | 'reversed'): 'forward' | 'reversed' {
  const P = F.positions, I = F.indices, s = sense === 'forward' ? 1 : -1, big: { area: number; at: Point; out: Point }[] = [];
  for (let t = 0; t < I.length; t += 3) {
    const a = 3 * I[t], b = 3 * I[t + 1], c = 3 * I[t + 2];
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const n: Point = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx], area = Math.hypot(n[0], n[1], n[2]);
    if (big.length < 5 || area > big[4].area) {
      big.push({ area, out: [s * n[0], s * n[1], s * n[2]], at: [(P[a] + P[b] + P[c]) / 3, (P[a + 1] + P[b + 1] + P[c + 1]) / 3, (P[a + 2] + P[b + 2] + P[c + 2]) / 3] });
      big.sort((x, y) => y.area - x.area); if (big.length > 5) big.pop();
    }
  }
  let vote = 0;
  for (const t of big) { const n = nearest(S, t.at).normal; vote += Math.sign(n[0] * t.out[0] + n[1] * t.out[1] + n[2] * t.out[2]); }
  return vote >= 0 ? 'forward' : 'reversed';
}
/** The largest sagitta of a polyline's chords, from the curvature through each three corners in a row. */
function sagitta(pts: readonly (readonly number[])[]): number {
  let worst = 0;
  for (let i = 1; i + 1 < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const ab = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), bc = Math.hypot(c[0] - b[0], c[1] - b[1], c[2] - b[2]), ca = Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const area2 = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    if (!(ab * bc * ca > 0)) continue;
    const k = 2 * area2 / (ab * bc * ca), L = Math.max(ab, bc);
    worst = Math.max(worst, L * L * k / 8);
  }
  return worst;
}
/**
 * Surface S's point nearest p: the nearest of a grid, then Gauss–Newton with central differences (a sphere's or a
 * cone's patches have C0 knots, where derivatives are not defined); with the normal there.
 */
function nearest(S: Surface, p: Point): { distance: number; normal: Point } {
  const { u: U, v: V } = surfaceDomain(S), at = surfaceEvaluator(S), N = 32;
  // (Seeds: the four nearest of a grid — beside a pole or a fold one seed can settle on the wrong side.)
  const seeds: [number, number, number][] = [];
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const a = U[0] + (U[1] - U[0]) * i / N, b = V[0] + (V[1] - V[0]) * j / N, q = at(a, b), d = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
    if (seeds.length < 4 || d < seeds[3][0]) { seeds.push([d, a, b]); seeds.sort((x, y) => x[0] - y[0]); if (seeds.length > 4) seeds.pop(); }
  }
  let best = { distance: Infinity, normal: [0, 0, 1] as Point };
  for (const [, a, b] of seeds) { const r = refine(at, U, V, p, a, b); if (r.distance < best.distance) best = r; }
  return best;
}
/** Gauss–Newton from (u, v) to the surface point nearest p, with central differences; its distance and normal. */
function refine(at: (u: number, v: number) => Point, U: readonly number[], V: readonly number[], p: Point, u: number, v: number): { distance: number; normal: Point } {
  const hu = 1e-7 * (U[1] - U[0]), hv = 1e-7 * (V[1] - V[0]);
  let du: Point = [0, 0, 0], dv: Point = [0, 0, 0];
  for (let it = 0; it < 40; it++) {
    const q = at(u, v), r = [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
    du = diff(at, U, V, u, v, hu, 0); dv = diff(at, U, V, u, v, 0, hv);
    const a = du[0] * du[0] + du[1] * du[1] + du[2] * du[2], b = du[0] * dv[0] + du[1] * dv[1] + du[2] * dv[2], c = dv[0] * dv[0] + dv[1] * dv[1] + dv[2] * dv[2];
    // (Levenberg–Marquardt: damped, so a near-singular step beside a pole still moves the other way.)
    const ru = r[0] * du[0] + r[1] * du[1] + r[2] * du[2], rv = r[0] * dv[0] + r[1] * dv[1] + r[2] * dv[2], damp = 1e-9 * (a + c) + 1e-300;
    const A = a + damp, C = c + damp, det = A * C - b * b;
    if (!(Math.abs(det) > 1e-300)) break;
    const su = (C * ru - b * rv) / det, sv = (A * rv - b * ru) / det;
    u = Math.min(U[1], Math.max(U[0], u + su)); v = Math.min(V[1], Math.max(V[0], v + sv));
    if (Math.abs(su) < 1e-13 * (U[1] - U[0]) && Math.abs(sv) < 1e-13 * (V[1] - V[0])) break;
  }
  const q = at(u, v);
  return { distance: Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]), normal: [du[1] * dv[2] - du[2] * dv[1], du[2] * dv[0] - du[0] * dv[2], du[0] * dv[1] - du[1] * dv[0]] };
}
/** A central difference of `at` (one-sided at the domain's ends). */
function diff(at: (u: number, v: number) => Point, U: readonly number[], V: readonly number[], u: number, v: number, hu: number, hv: number): Point {
  const u0 = Math.max(U[0], u - hu), u1 = Math.min(U[1], u + hu), v0 = Math.max(V[0], v - hv), v1 = Math.min(V[1], v + hv);
  const a = at(u0, v0), b = at(u1, v1), w = hu ? u1 - u0 : v1 - v0;
  return [(b[0] - a[0]) / w, (b[1] - a[1]) / w, (b[2] - a[2]) / w];
}


/**
 * F1 for a body that mixes mesh and exact faces (an earlier F2): split through the soup like a mesh — its exact faces
 * tessellated, their surfaces given back after, each side's cap a planar mesh face `<at>.cut.top` / `.bottom`.
 */
export function splitMixedBrep(a: Brep, normal: Point, offset: number, at: string, segmentsPerQuarter = 32): { below: Brep | null; above: Brep | null } {
  const sources: Source[] = [], mesh = soupOf(a, sources, segmentsPerQuarter);
  let size = 0; for (const x of mesh.P) size = Math.max(size, Math.abs(x));
  const capTop = sources.push({ name: `${at}.cut.top`, surface: null }) - 1, capBottom = sources.push({ name: `${at}.cut.bottom`, surface: null }) - 1;
  const r = splitSoup({ P: mesh.P, I: mesh.I, G: mesh.G }, normal, offset, { weld: Math.max(1e-9, size * 1e-6), cap: 'both', capGroup: CAP_GROUP });
  const sides: (Brep | null)[] = [];
  for (let k = 0; k < 2; k++) {
    if (!r.tris[k].length) { sides.push(null); continue; }
    const part = compact(r.P, r.tris[k], r.groups[k].map(g => g === CAP_GROUP ? (k ? capBottom : capTop) : g));
    const pieces = facetBrepsFromTriangles(part.P, part.I, { id: `${at}${k ? '_above' : '_below'}`, groups: part.G, groupName: g => `t${g}`, maximumTriangles: Infinity, maximumRegions: Infinity, creaseDegrees: 180, weldMM: soupWeld(part) });
    sides.push(restore(pieces.length === 1 ? pieces[0] : mergeBreps(pieces, { family: 'mesh', id: at }), sources));
  }
  return { below: sides[0], above: sides[1] };
}

/**
 * A mixed body (mesh faces and exact ones, an earlier F2) as mesh faces only, each face its name: the exact faces
 * sampled at `segmentsPerQuarter` (STEP writes a mesh body tessellated or as planar faces; the exact faces' surfaces
 * have no tessellated form beside them).
 */
export function facetedCopy(a: Brep, segmentsPerQuarter = 32): Brep {
  const sources: Source[] = [], mesh = soupOf(a, sources, segmentsPerQuarter), id = a.bodies[0]?.id ?? a.source.id;
  const pieces = facetBrepsFromTriangles(mesh.P, mesh.I, { id, groups: mesh.G, groupName: g => `t${g}`, maximumTriangles: Infinity, maximumRegions: Infinity, creaseDegrees: 180, weldMM: soupWeld(mesh) });
  const out = pieces.length === 1 ? pieces[0] : mergeBreps(pieces, { family: 'mesh', id });
  return restore(out, sources.map(x => ({ name: x.name, surface: null })));
}
