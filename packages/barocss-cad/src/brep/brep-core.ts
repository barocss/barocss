// One shared boundary representation (B-rep) for every modeling body family — step 1 of the
// brep-core plan: the data structure, one checker, and adapters from the existing result types.
//
//   Body → Shell → Face (surface, sense) → Loop (outer / inner) → Coedge (next, prev, twin, pcurve)
//        → Edge (3D curve, tolerance) → Vertex (point, tolerance)
//
// Records live in flat id-keyed arrays so a B-rep is plain JSON. Tolerances are per entity
// (CadNumericPolicy.linearToleranceMM of the body's scale by default), not one global constant.
import { evaluateCurve, evaluateSurface, curveDomain, surfaceDomain, validateCurve, validateSurface } from '../core/math.js';
import { CadNumericPolicy } from '../numeric-policy.js';
import type { Curve, FacetPatch, Point, Surface } from '../types.js';
import { cross, dist as distance, dot, sub } from '../core/vec3.js';
import { strictGeometry } from './brep-check-geometry.js';
import { facetPatchProblem, facetVectorArea } from '../mesh/facet-patch.js';
import { closestPointOnSurface, surfaceSeedGrid, type SurfaceSeedGrid } from '../nurbs/surfaces/surface-closest.js';

export interface BrepVertex { readonly id: string; readonly point: Point; readonly toleranceMM: number }
/** An edge runs along `curve` over its whole domain, from vertices[0] (domain start) to vertices[1] (domain end). */
export interface BrepEdge { readonly id: string; readonly curve: Curve; readonly vertices: readonly [string, string]; readonly toleranceMM: number; readonly name?: string }
/**
 * One use of an edge by a loop. `forward` traverses the edge from vertices[0] to vertices[1].
 * `pcurve` (optional) is the edge in the face's (u, v) parameter space, as a curve with z = 0 and the
 * edge curve's domain.
 */
export interface BrepCoedge {
  readonly id: string; readonly edge: string; readonly sense: 'forward' | 'reversed'; readonly loop: string;
  readonly next: string; readonly prev: string; readonly twin: string | null; readonly pcurve: Curve | null;
}
export interface BrepLoop { readonly id: string; readonly face: string; readonly kind: 'outer' | 'inner'; readonly coedges: readonly string[] }
/** `sense: 'forward'` means the outward normal is ∂S/∂u × ∂S/∂v. */
/** `name` (optional) is a persistent name: it follows the authored feature that made the face, not its id. */
export interface BrepFace { readonly id: string; readonly shell: string; readonly surface: Surface | FacetPatch; readonly sense: 'forward' | 'reversed'; readonly loops: readonly string[]; readonly name?: string }
export interface BrepShell { readonly id: string; readonly body: string; readonly faces: readonly string[]; readonly closed: boolean }
export interface BrepBody { readonly id: string; readonly kind: 'solid' | 'sheet'; readonly shells: readonly string[] }
export interface Brep {
  readonly format: 'barocss-brep'; readonly version: 0; readonly lengthUnit: 'mm';
  /** Which body family and native result this B-rep was converted from (provenance only). */
  readonly source: { readonly family: string; readonly id: string };
  readonly bodies: readonly BrepBody[]; readonly shells: readonly BrepShell[]; readonly faces: readonly BrepFace[];
  readonly loops: readonly BrepLoop[]; readonly coedges: readonly BrepCoedge[]; readonly edges: readonly BrepEdge[]; readonly vertices: readonly BrepVertex[];
}

export interface BrepBodyTopology { readonly body: string; readonly vertices: number; readonly edges: number; readonly faces: number; readonly loops: number; readonly shells: number; readonly genus: number }
export interface BrepCheckReport {
  readonly valid: boolean;
  /** First problems found (at most 32), as `kind: detail`. Empty when valid. */
  readonly issues: readonly string[];
  readonly counts: { readonly bodies: number; readonly shells: number; readonly faces: number; readonly loops: number; readonly coedges: number; readonly edges: number; readonly vertices: number };
  /** Euler–Poincaré per body: V − E + F − (L − F) = 2(S − G), solved for the genus G. */
  readonly topology: readonly BrepBodyTopology[];
  readonly maximumVertexGapMM: number; readonly maximumPcurveGapMM: number;
  /** With `strict`: the largest distance of an edge's sample from a surface of a face using it (else 0). */
  readonly maximumEdgeSurfaceGapMM: number;
}

/**
 * A B-rep refusal: its code, and for a refusal a caller acts on, a typed `reason` (never the message's wording):
 * `NOT_PLANAR_WITHIN_FLOAT` — the polyhedral Boolean's face whose vertices are coplanar only to binary64 (FR3b, D126).
 */
export type BrepErrorReason = 'NOT_PLANAR_WITHIN_FLOAT';
export class BrepError extends Error {
  constructor(readonly code: 'INPUT' | 'TOPOLOGY' | 'GEOMETRY', detail: string, readonly report?: BrepCheckReport, readonly reason?: BrepErrorReason) { super(('B-rep: ' + detail).slice(0, 1024)); this.name = 'BrepError'; }
}

/**
 * A face's surface where only a parametric one will do: a facet face (F0) is refused with a typed GEOMETRY error
 * saying the operation does not take mesh faces yet (part-model maps "not supported yet" to CAPABILITY).
 */
export function nurbsOf(face: { readonly id: string; readonly surface: Surface | FacetPatch }, what = 'this operation'): Surface {
  if (face.surface.kind === 'facets') throw new BrepError('GEOMETRY', `${what}: faceted (mesh) faces are not supported yet (face ${face.id})`);
  return face.surface;
}
export const isFacetFace = (face: { readonly surface: Surface | FacetPatch }) => face.surface.kind === 'facets';
/** ∂S/∂u × ∂S/∂v at the middle of the surface domain (central differences). */
export function surfaceNormalAtCentre(surface: Surface): Point {
  const { u, v } = surfaceDomain(surface), um = (u[0] + u[1]) / 2, vm = (v[0] + v[1]) / 2, hu = (u[1] - u[0]) * 1e-4, hv = (v[1] - v[0]) * 1e-4;
  return cross(sub(evaluateSurface(surface, um + hu, vm), evaluateSurface(surface, um - hu, vm)), sub(evaluateSurface(surface, um, vm + hv), evaluateSurface(surface, um, vm - hv)));
}
/** Vector area (½∮ p × dp) of a loop of directed curve uses: straight and polyline uses by their corners, others sampled 16 times. */
export function loopVectorArea(uses: readonly { readonly curve: Curve; readonly sense: 'forward' | 'reversed' }[]): Point {
  const ring: Point[] = [];
  for (const u of uses) {
    // (A straight or polyline edge: its own corners, exactly; a curve sampled 16 times.)
    if (u.curve.degree === 1) { const p = u.curve.controlPoints, n = p.length; for (let k = 0; k + 1 < n; k++) ring.push(p[u.sense === 'forward' ? k : n - 1 - k] as Point); continue; }
    const [t0, t1] = curveDomain(u.curve);
    for (let k = 0; k < 16; k++) { const f = k / 16; ring.push(evaluateCurve(u.curve, u.sense === 'forward' ? t0 + (t1 - t0) * f : t1 - (t1 - t0) * f)); }
  }
  let area: Point = [0, 0, 0];
  for (let i = 0; i < ring.length; i++) { const c = cross(ring[i], ring[(i + 1) % ring.length]); area = [area[0] + c[0] / 2, area[1] + c[1] / 2, area[2] + c[2] / 2]; }
  return area;
}
/**
 * Whether a loop of directed curve uses on `surface` runs counter-clockwise in its (u, v) domain (`true`) or clockwise
 * (`false`); `undefined` where that cannot be told: a sample more than `reach` off the surface, a ring that does not
 * close in the domain (it winds round a closed direction), or one enclosing no area. A direction in which the surface
 * closes on itself is unwrapped along the ring. Each use is sampled as `loopVectorArea` samples it.
 */
export function loopWindsInDomain(surface: Surface, uses: readonly { readonly curve: Curve; readonly sense: 'forward' | 'reversed' }[], reach: number): boolean | undefined {
  const { u: U, v: V } = surfaceDomain(surface), W = U[1] - U[0], H = V[1] - V[0];
  const closedU = closesAlong(surface, U, V, 0, reach), closedV = closesAlong(surface, U, V, 1, reach);
  let area = 0, u0 = 0, v0 = 0, pu = 0, pv = 0, n = 0, uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
  let grid: SurfaceSeedGrid | undefined;
  for (const use of uses) {
    const c = use.curve, [t0, t1] = curveDomain(c), corners = c.degree === 1, m = corners ? c.controlPoints.length - 1 : 16;
    for (let k = 0; k < m; k++) {
      const x = corners ? c.controlPoints[use.sense === 'forward' ? k : m - k] : evaluateCurve(c, use.sense === 'forward' ? t0 + (t1 - t0) * k / m : t1 - (t1 - t0) * k / m);
      // (Each sample from the one before; past a seam, or at the first, from the seed grid, made once.)
      let q = n > 0 ? closestPointOnSurface(surface, x, { seed: [pu - (closedU ? W * Math.floor((pu - U[0]) / W) : 0), pv - (closedV ? H * Math.floor((pv - V[0]) / H) : 0)] }) : undefined;
      if (!q || !(q.distance <= reach)) q = closestPointOnSurface(surface, x, { grid: grid ??= surfaceSeedGrid(surface, 24) });
      if (!(q.distance <= reach)) return undefined;
      let u = q.u, v = q.v;
      if (n > 0) {
        if (closedU) u += W * Math.round((pu - u) / W);
        if (closedV) v += H * Math.round((pv - v) / H);
        area += pu * v - u * pv;
      } else { u0 = u; v0 = v; }
      pu = u; pv = v; n++;
      if (u < uMin) uMin = u; if (u > uMax) uMax = u; if (v < vMin) vMin = v; if (v > vMax) vMax = v;
    }
  }
  if (n < 3) return undefined;
  // (Closed: the ring's last point back to its first without a turn's jump.)
  if ((closedU && Math.abs(Math.round((pu - u0) / W)) > 0) || (closedV && Math.abs(Math.round((pv - v0) / H)) > 0)) return undefined;
  area += pu * v0 - u0 * pv;
  if (!(Math.abs(area) > 1e-6 * (uMax - uMin) * (vMax - vMin))) return undefined;
  return area > 0;
}
/**
 * Whether `surface` turns by more than a half turn along u or v (its normal at a domain end more than 90° from the
 * middle's, along the domain's middle line), with no domain side collapsed to a point (no pole: a ball's and a cone's
 * sense stay with the vector area). Only there can a face's normals lie more than 90° from the middle's: a face over most
 * of a turn — a cylinder's 354°, its gap anywhere in the domain — is judged by its outer loop's vector area neither way,
 * and its winding in the domain does (D257, D263).
 */
export function wrapsWithoutPoles(surface: Surface, reach: number): boolean {
  const { u: U, v: V } = surfaceDomain(surface), um = (U[0] + U[1]) / 2, vm = (V[0] + V[1]) / 2, c = normalAt(surface, U, V, um, vm);
  if (!(dot(c, normalAt(surface, U, V, U[0], vm)) < 0 || dot(c, normalAt(surface, U, V, U[1], vm)) < 0 || dot(c, normalAt(surface, U, V, um, V[0])) < 0 || dot(c, normalAt(surface, U, V, um, V[1])) < 0)) return false;
  for (let side = 0; side < 4; side++) {
    const along = side < 2 ? 0 : 1, at = side === 0 ? V[0] : side === 1 ? V[1] : side === 2 ? U[0] : U[1];
    const a = along === 0 ? evaluateSurface(surface, U[0], at) : evaluateSurface(surface, at, V[0]), b = along === 0 ? evaluateSurface(surface, um, at) : evaluateSurface(surface, at, vm);
    const e = along === 0 ? evaluateSurface(surface, U[1], at) : evaluateSurface(surface, at, V[1]);
    if (distance(a, b) <= reach && distance(a, e) <= reach) return false;
  }
  return true;
}
/** ∂S/∂u × ∂S/∂v at (u, v) by differences taken inside the domain (unnormalized). */
function normalAt(surface: Surface, U: readonly [number, number], V: readonly [number, number], u: number, v: number): Point {
  const hu = (U[1] - U[0]) * 1e-4, hv = (V[1] - V[0]) * 1e-4, u0 = Math.max(U[0], u - hu), u1 = Math.min(U[1], u + hu), v0 = Math.max(V[0], v - hv), v1 = Math.min(V[1], v + hv);
  return cross(sub(evaluateSurface(surface, u1, v), evaluateSurface(surface, u0, v)), sub(evaluateSurface(surface, u, v1), evaluateSurface(surface, u, v0)));
}
/** Whether `surface` closes on itself along u (`along` 0) or v (1): its two opposite domain edges meet at three points. */
function closesAlong(surface: Surface, U: readonly [number, number], V: readonly [number, number], along: 0 | 1, reach: number): boolean {
  for (let k = 0; k <= 2; k++) {
    const t = along === 0 ? V[0] + (V[1] - V[0]) * k / 2 : U[0] + (U[1] - U[0]) * k / 2;
    const a = along === 0 ? evaluateSurface(surface, U[0], t) : evaluateSurface(surface, t, V[0]), b = along === 0 ? evaluateSurface(surface, U[1], t) : evaluateSurface(surface, t, V[1]);
    if (distance(a, b) > reach) return false;
  }
  return true;
}
/** A bilinear patch with straight rows: a plane's (it cannot close on itself). */
const planarSurface = (s: Surface) => s.degreeU === 1 && s.degreeV === 1 && s.controlPoints.length === 2 && s.controlPoints[0].length === 2;
const index = <T extends { id: string }>(items: readonly T[], kind: string, issues: string[]) => {
  const map = new Map<string, T>();
  for (const item of items) { if (map.has(item.id)) issues.push(`${kind}: duplicate id ${item.id}`); map.set(item.id, item); }
  return map;
};
/** Coedge start / end vertex ids. */
export function coedgeVertices(brep: Brep, coedge: BrepCoedge, edges = new Map(brep.edges.map(e => [e.id, e]))): [string, string] {
  const edge = edges.get(coedge.edge)!; return coedge.sense === 'forward' ? [edge.vertices[0], edge.vertices[1]] : [edge.vertices[1], edge.vertices[0]];
}

/**
 * Checks topology (references, loop cycles, twins, manifold edges and vertex links, Euler–Poincaré)
 * and geometry (edge ends on their vertices, pcurves on their surfaces) within entity tolerances.
 * `strict` adds the L0 geometric checks (brep-check-geometry.ts): edges on their faces' surfaces, loops
 * not crossing in a face's parameters, no sliver faces, tolerances under a cap of the model's size.
 */
export function checkBrep(brep: Brep, options: { readonly pcurveSamples?: number; readonly strict?: boolean } = {}): BrepCheckReport {
  const issues: string[] = [], add = (kind: string, detail: string) => { if (issues.length < 32) issues.push(`${kind}: ${detail}`); };
  const bodies = index(brep.bodies, 'body', issues), shells = index(brep.shells, 'shell', issues), faces = index(brep.faces, 'face', issues);
  const loops = index(brep.loops, 'loop', issues), coedges = index(brep.coedges, 'coedge', issues), edges = index(brep.edges, 'edge', issues), vertices = index(brep.vertices, 'vertex', issues);
  const need = <T>(map: Map<string, T>, id: string | null, what: string): T | undefined => { const v = id === null ? undefined : map.get(id); if (!v) add('reference', `${what} → missing ${id}`); return v; };
  let maximumVertexGapMM = 0, maximumPcurveGapMM = 0;

  // Persistent names, where present, are unique among faces and among edges.
  for (const list of [brep.faces, brep.edges] as const) {
    const seen = new Set<string>();
    for (const x of list) if (x.name !== undefined) { if (seen.has(x.name)) add('naming', `name ${x.name} is used twice`); seen.add(x.name); }
  }
  for (const b of brep.bodies) for (const s of b.shells) { const shell = need(shells, s, `body ${b.id}`); if (shell && shell.body !== b.id) add('reference', `shell ${s} does not point back to body ${b.id}`); }
  for (const s of brep.shells) {
    need(bodies, s.body, `shell ${s.id}`);
    for (const f of s.faces) { const face = need(faces, f, `shell ${s.id}`); if (face && face.shell !== s.id) add('reference', `face ${f} does not point back to shell ${s.id}`); }
  }
  for (const f of brep.faces) {
    need(shells, f.shell, `face ${f.id}`);
    if (f.surface.kind === 'facets') { const why = facetPatchProblem(f.surface); if (why) add('geometry', `face ${f.id} facets: ${why}`); }
    else try { validateSurface(f.surface); } catch (e) { add('geometry', `face ${f.id} surface: ${(e as Error).message}`); }
    if (f.loops.filter(l => loops.get(l)?.kind === 'outer').length !== 1) add('topology', `face ${f.id} needs exactly one outer loop`);
    for (const l of f.loops) { const loop = need(loops, l, `face ${f.id}`); if (loop && loop.face !== f.id) add('reference', `loop ${l} does not point back to face ${f.id}`); }
  }
  for (const e of brep.edges) {
    try { validateCurve(e.curve); } catch (err) { add('geometry', `edge ${e.id} curve: ${(err as Error).message}`); continue; }
    const [v0, v1] = e.vertices.map(v => need(vertices, v, `edge ${e.id}`)), [t0, t1] = curveDomain(e.curve);
    for (const [v, t] of [[v0, t0], [v1, t1]] as const) {
      if (!v) continue;
      const gap = distance(evaluateCurve(e.curve, t), v.point); maximumVertexGapMM = Math.max(maximumVertexGapMM, gap);
      if (gap > Math.max(v.toleranceMM, e.toleranceMM)) add('geometry', `edge ${e.id} end is ${gap} mm from vertex ${v.id}`);
    }
  }

  // Loops: coedges form one next/prev cycle in listed order, and consecutive coedges share a vertex.
  for (const l of brep.loops) {
    need(faces, l.face, `loop ${l.id}`);
    if (l.coedges.length === 0) { add('topology', `loop ${l.id} is empty`); continue; }
    l.coedges.forEach((c, i) => {
      const ce = need(coedges, c, `loop ${l.id}`), following = l.coedges[(i + 1) % l.coedges.length];
      if (!ce || !edges.has(ce.edge)) return;
      if (ce.loop !== l.id) add('reference', `coedge ${c} does not point back to loop ${l.id}`);
      if (ce.next !== following || coedges.get(following)?.prev !== c) add('topology', `loop ${l.id}: next/prev of ${c} disagree with the loop order`);
      const nextCoedge = coedges.get(following);
      if (nextCoedge && edges.has(nextCoedge.edge) && coedgeVertices(brep, ce, edges)[1] !== coedgeVertices(brep, nextCoedge, edges)[0]) add('topology', `loop ${l.id}: ${c} does not end where ${following} starts`);
    });
  }

  // Twins and manifold edges: in a closed shell every edge has exactly two coedges, mutual twins, opposite senses.
  const usesOfEdge = new Map<string, BrepCoedge[]>();
  for (const c of brep.coedges) {
    if (!need(edges, c.edge, `coedge ${c.id}`)) continue;
    need(loops, c.loop, `coedge ${c.id}`);
    usesOfEdge.set(c.edge, [...(usesOfEdge.get(c.edge) ?? []), c]);
    if (c.twin !== null) {
      const t = need(coedges, c.twin, `coedge ${c.id} twin`);
      if (t && (t.twin !== c.id || t.edge !== c.edge || t.sense === c.sense)) add('topology', `coedge ${c.id} and its twin ${c.twin} are not opposite uses of one edge`);
    }
  }
  const shellOfCoedge = (c: BrepCoedge) => faces.get(loops.get(c.loop)?.face ?? '')?.shell;
  for (const e of brep.edges) {
    const uses = usesOfEdge.get(e.id) ?? [], closed = uses.length > 0 && shells.get(shellOfCoedge(uses[0]) ?? '')?.closed;
    if (closed && uses.length !== 2) add('topology', `edge ${e.id} has ${uses.length} uses in a closed shell (needs 2)`);
    if (uses.length === 0) add('topology', `edge ${e.id} is unused`);
  }

  // Vertex links: around every vertex of a closed shell, twin(prev(c)) walks one single cycle.
  const endingAt = new Map<string, BrepCoedge[]>();
  for (const c of brep.coedges) if (edges.has(c.edge)) { const end = coedgeVertices(brep, c, edges)[1]; endingAt.set(end, [...(endingAt.get(end) ?? []), c]); }
  for (const [v, list] of endingAt) {
    if (!shells.get(shellOfCoedge(list[0]) ?? '')?.closed) continue;
    const seen = new Set<string>(); let c: BrepCoedge | undefined = list[0];
    while (c && !seen.has(c.id) && seen.size <= list.length) { seen.add(c.id); const out = coedges.get(c.next); c = out?.twin ? coedges.get(out.twin) : undefined; }
    if (seen.size !== list.length) add('topology', `vertex ${v} is not manifold (${seen.size} of ${list.length} incoming coedges in one cycle)`);
  }

  // Pcurves: S(pcurve(t)) lies on the edge curve at the same parameter.
  const samples = Math.max(2, options.pcurveSamples ?? 5);
  for (const c of brep.coedges) {
    if (!c.pcurve) continue;
    const edge = edges.get(c.edge), face = faces.get(loops.get(c.loop)?.face ?? '');
    if (!edge || !face || face.surface.kind === 'facets') continue;
    const [t0, t1] = curveDomain(edge.curve), [p0, p1] = curveDomain(c.pcurve);
    if (p0 !== t0 || p1 !== t1) { add('geometry', `coedge ${c.id} pcurve domain differs from its edge`); continue; }
    const S = face.surface, { u, v } = surfaceDomain(S);
    for (let k = 0; k < samples; k++) {
      const t = t0 + (t1 - t0) * k / (samples - 1), uv = evaluateCurve(c.pcurve, t);
      if (uv[0] < u[0] - 1e-9 || uv[0] > u[1] + 1e-9 || uv[1] < v[0] - 1e-9 || uv[1] > v[1] + 1e-9) { add('geometry', `coedge ${c.id} pcurve leaves the surface domain`); break; }
      const gap = distance(evaluateSurface(S, Math.min(u[1], Math.max(u[0], uv[0])), Math.min(v[1], Math.max(v[0], uv[1]))), evaluateCurve(edge.curve, t));
      maximumPcurveGapMM = Math.max(maximumPcurveGapMM, gap);
      if (gap > edge.toleranceMM) { add('geometry', `coedge ${c.id} pcurve is ${gap} mm off its edge`); break; }
    }
  }

  // Connectivity: the faces of a shell form one component through twin coedges.
  for (const sh of brep.shells) {
    const parent = new Map(sh.faces.map(f => [f, f])), find = (f: string): string => { let r = f; while (parent.get(r) !== r) r = parent.get(r)!; return r; };
    for (const f of sh.faces) for (const l of faces.get(f)?.loops ?? []) for (const c of loops.get(l)?.coedges ?? []) {
      const twin = coedges.get(coedges.get(c)?.twin ?? ''), other = twin ? loops.get(twin.loop)?.face : undefined;
      if (other && parent.has(other)) parent.set(find(other), find(f));
    }
    const components = new Set(sh.faces.map(find)).size;
    if (components > 1) add('topology', `shell ${sh.id} is not connected (${components} components)`);
  }

  // Face sense: the outer loop runs counter-clockwise about the outward normal. Faces whose loop
  // encloses no net vector area (a full-turn wall between two rings) cannot be judged this way.
  for (const f of brep.faces) {
    // A facet face: its boundary's vector area (all loops, exactly along the polylines) is the triangles' vector area.
    if (f.surface.kind === 'facets') {
      const A = facetVectorArea(f.surface), B: Point = [0, 0, 0];
      for (const l of f.loops) for (const c of loops.get(l)?.coedges ?? []) {
        const ce = coedges.get(c), e = ce && edges.get(ce.edge); if (!ce || !e) continue;
        const p = ce.sense === 'forward' ? e.curve.controlPoints : [...e.curve.controlPoints].reverse();
        for (let i = 0; i + 1 < p.length; i++) { const x = cross(p[i], p[i + 1]); B[0] += x[0] / 2; B[1] += x[1] / 2; B[2] += x[2] / 2; }
      }
      const s = f.sense === 'forward' ? 1 : -1, b = f.surface.bounds, size = Math.max(1, ...Array.from(b, Math.abs));
      if (Math.hypot(B[0] - s * A[0], B[1] - s * A[1], B[2] - s * A[2]) > 1e-9 * size * size * Math.max(1, f.surface.indices.length / 3) ** 0.5) add('orientation', `face ${f.id}: its boundary does not run round its facets`);
      continue;
    }
    const outer = loops.get(f.loops.find(l => loops.get(l)?.kind === 'outer') ?? '');
    if (!outer) continue;
    const uses = outer.coedges.map(c => coedges.get(c)).filter((c): c is BrepCoedge => !!c && edges.has(c.edge)).map(c => ({ curve: edges.get(c.edge)!.curve, sense: c.sense }));
    if (uses.length !== outer.coedges.length) continue;
    const area = loopVectorArea(uses), size = Math.hypot(...area), normal = surfaceNormalAtCentre(f.surface as Surface);
    let extent = 0; for (const u of uses) for (const p of u.curve.controlPoints) extent = Math.max(extent, ...p.map(Math.abs));
    if (size <= 1e-6 * Math.max(1, extent) ** 2 || Math.hypot(...normal) === 0) continue;
    // (The normal at the domain's middle judges a face whose normals all lie within 90° of it. A face wrapping most of a
    // closed surface — a cylinder's 354°, its gap beside the domain's middle — has its vector area against that normal
    // even when right (K15, D257), and with it when turned over (D263). Where they disagree, and on any surface turning
    // more than a half turn without a pole, the loop's winding in the face's own domain decides, when it can be told; else
    // the vector area does.)
    const disagree = dot(area, normal) * (f.sense === 'forward' ? 1 : -1) < 0;
    let reach = 0;
    if (disagree || !planarSurface(f.surface as Surface)) { for (const c of outer.coedges) reach = Math.max(reach, edges.get(coedges.get(c)!.edge)!.toleranceMM); reach = Math.max(100 * reach, 1e-6 * Math.max(1, extent)); }
    const winds = disagree || (!planarSurface(f.surface as Surface) && wrapsWithoutPoles(f.surface as Surface, reach)) ? loopWindsInDomain(f.surface as Surface, uses, reach) : undefined;
    if (winds === undefined ? disagree : winds !== (f.sense === 'forward')) add('orientation', `face ${f.id} sense disagrees with its outer loop`);
  }

  // Euler–Poincaré per body.
  const topology: BrepBodyTopology[] = brep.bodies.map(b => {
    const bodyShells = b.shells.map(s => shells.get(s)).filter((s): s is BrepShell => !!s), bodyFaces = bodyShells.flatMap(s => s.faces.map(f => faces.get(f)).filter((f): f is BrepFace => !!f));
    const bodyLoops = bodyFaces.flatMap(f => f.loops), bodyCoedges = bodyLoops.flatMap(l => loops.get(l)?.coedges ?? []).map(c => coedges.get(c)).filter((c): c is BrepCoedge => !!c);
    const bodyEdges = new Set(bodyCoedges.map(c => c.edge)), bodyVertices = new Set([...bodyEdges].flatMap(e => edges.get(e)?.vertices ?? []));
    const V = bodyVertices.size, E = bodyEdges.size, F = bodyFaces.length, L = bodyLoops.length, S = bodyShells.length;
    const genus = S - (V - E + F - (L - F)) / 2;
    if (b.kind === 'solid' && bodyShells.every(s => s.closed) && !(Number.isInteger(genus) && genus >= 0)) add('topology', `body ${b.id} fails Euler–Poincaré (V ${V}, E ${E}, F ${F}, L ${L}, S ${S})`);
    return { body: b.id, vertices: V, edges: E, faces: F, loops: L, shells: S, genus };
  });

  let maximumEdgeSurfaceGapMM = 0;
  if (options.strict) {
    let size = 1; for (const v of brep.vertices) for (const x of v.point) size = Math.max(size, Math.abs(x));
    maximumEdgeSurfaceGapMM = strictGeometry(brep, { loops, coedges, edges }, size, add).maximumEdgeSurfaceGapMM;
  }

  return {
    valid: issues.length === 0, issues,
    counts: { bodies: brep.bodies.length, shells: brep.shells.length, faces: brep.faces.length, loops: brep.loops.length, coedges: brep.coedges.length, edges: brep.edges.length, vertices: brep.vertices.length },
    topology, maximumVertexGapMM, maximumPcurveGapMM, maximumEdgeSurfaceGapMM,
  };
}

/** Throws a BrepError carrying the report when the B-rep is not valid. */
export function assertValidBrep(brep: Brep): BrepCheckReport {
  const report = checkBrep(brep);
  if (!report.valid) throw new BrepError(report.issues[0].startsWith('geometry') ? 'GEOMETRY' : 'TOPOLOGY', report.issues[0], report);
  return report;
}

// ---- Builder ---------------------------------------------------------------------------------
// Adapters describe faces as loops of directed edge uses; the builder assigns ids, links next/prev,
// pairs twins by edge and fills tolerances.

export interface BrepLoopInput { readonly kind: 'outer' | 'inner'; readonly uses: readonly { readonly edge: string; readonly sense: 'forward' | 'reversed'; readonly pcurve?: Curve | null }[] }
export interface BrepFaceInput { readonly id: string; readonly surface: Surface | FacetPatch; readonly sense: 'forward' | 'reversed'; readonly loops: readonly BrepLoopInput[]; readonly name?: string }
export interface BrepShellInput { readonly id: string; readonly faces: readonly BrepFaceInput[]; readonly closed: boolean }
export interface BrepBuildInput {
  readonly source: Brep['source'];
  /** (`toleranceMM` on a vertex or an edge: its own, for one that is tolerant — a fitted offset's, D110; else the B-rep's.) */
  readonly vertices: readonly { readonly id: string; readonly point: Point; readonly toleranceMM?: number }[];
  readonly edges: readonly { readonly id: string; readonly curve: Curve; readonly vertices: readonly [string, string]; readonly name?: string; readonly toleranceMM?: number }[];
  readonly bodies: readonly { readonly id: string; readonly kind: 'solid' | 'sheet'; readonly shells: readonly BrepShellInput[] }[];
  /** Entity tolerance; defaults to CadNumericPolicy.linearToleranceMM at the geometry's scale. */
  readonly toleranceMM?: number;
}

export function buildBrep(input: BrepBuildInput): Brep {
  let scale = 0;
  for (const v of input.vertices) for (const x of v.point) scale = Math.max(scale, Math.abs(x));
  // (A facet body has few vertices: its patches' extent counts too.)
  for (const b of input.bodies) for (const s of b.shells) for (const f of s.faces) if (f.surface.kind === 'facets') for (const x of f.surface.bounds) scale = Math.max(scale, Math.abs(x));
  const tol = input.toleranceMM ?? Math.max(CadNumericPolicy.linearToleranceMM, CadNumericPolicy.relativeLinearTolerance * scale);
  const bodies: BrepBody[] = [], shells: BrepShell[] = [], faces: BrepFace[] = [], loops: BrepLoop[] = [], coedges: BrepCoedge[] = [];
  const mutable: { -readonly [K in keyof BrepCoedge]: BrepCoedge[K] }[] = [];
  for (const b of input.bodies) {
    const shellIds: string[] = [];
    for (const s of b.shells) {
      const shellId = `${b.id}/${s.id}`; shellIds.push(shellId); const faceIds: string[] = [];
      for (const f of s.faces) {
        const faceId = `${shellId}/${f.id}`; faceIds.push(faceId); const loopIds: string[] = [];
        f.loops.forEach((l, li) => {
          const loopId = `${faceId}/l${li}`; loopIds.push(loopId);
          const ids = l.uses.map((_, ci) => `${loopId}/c${ci}`);
          l.uses.forEach((u, ci) => mutable.push({ id: ids[ci], edge: u.edge, sense: u.sense, loop: loopId, next: ids[(ci + 1) % ids.length], prev: ids[(ci - 1 + ids.length) % ids.length], twin: null, pcurve: u.pcurve ?? null }));
          loops.push({ id: loopId, face: faceId, kind: l.kind, coedges: ids });
        });
        faces.push({ id: faceId, shell: shellId, surface: f.surface, sense: f.sense, loops: loopIds, ...(f.name === undefined ? {} : { name: f.name }) });
      }
      shells.push({ id: shellId, body: b.id, faces: faceIds, closed: s.closed });
    }
    bodies.push({ id: b.id, kind: b.kind, shells: shellIds });
  }
  // Twins: the two uses of each edge (only when there are exactly two).
  const byEdge = new Map<string, typeof mutable>();
  for (const c of mutable) { const list = byEdge.get(c.edge); if (list) list.push(c); else byEdge.set(c.edge, [c]); }
  for (const uses of byEdge.values()) if (uses.length === 2 && uses[0].sense !== uses[1].sense) { uses[0].twin = uses[1].id; uses[1].twin = uses[0].id; }
  // (One at a time: a spread of a large solid's coedges overflows a worker's call stack.)
  for (const c of mutable) coedges.push(c);
  return {
    format: 'barocss-brep', version: 0, lengthUnit: 'mm', source: input.source, bodies, shells, faces, loops, coedges,
    edges: input.edges.map(e => ({ id: e.id, curve: e.curve, vertices: [e.vertices[0], e.vertices[1]] as const, toleranceMM: Math.max(tol, e.toleranceMM ?? 0), ...(e.name === undefined ? {} : { name: e.name }) })),
    vertices: input.vertices.map(v => ({ id: v.id, point: [v.point[0], v.point[1], v.point[2]] as Point, toleranceMM: Math.max(tol, v.toleranceMM ?? 0) })),
  };
}

/** A straight edge curve between two points, domain [0, 1]. */
export const lineCurve = (id: string, a: Point, b: Point): Curve => ({ kind: 'curve', id, degree: 1, knots: [0, 0, 1, 1], controlPoints: [[...a] as Point, [...b] as Point], weights: [1, 1] });

/** Several B-reps (with disjoint ids) as one B-rep holding all of their bodies. */
export function mergeBreps(breps: readonly Brep[], source: Brep['source']): Brep {
  return { format: 'barocss-brep', version: 0, lengthUnit: 'mm', source,
    bodies: breps.flatMap(b => b.bodies), shells: breps.flatMap(b => b.shells), faces: breps.flatMap(b => b.faces), loops: breps.flatMap(b => b.loops),
    coedges: breps.flatMap(b => b.coedges), edges: breps.flatMap(b => b.edges), vertices: breps.flatMap(b => b.vertices) };
}
