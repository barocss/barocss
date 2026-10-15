// One shared boundary representation (B-rep) for every modeling body family — step 1 of the
// brep-core plan: the data structure, one checker, and adapters from the existing result types.
//
//   Body → Shell → Face (surface, sense) → Loop (outer / inner) → Coedge (next, prev, twin, pcurve)
//        → Edge (3D curve, tolerance) → Vertex (point, tolerance)
//
// Records live in flat id-keyed arrays so a B-rep is plain JSON. Tolerances are per entity
// (CadNumericPolicy.linearToleranceMM of the body's scale by default), not one global constant.
import { evaluateCurve, evaluateSurface, curveDomain, surfaceDomain, validateCurve, validateSurface } from './math.js';
import { CadNumericPolicy } from './numeric-policy.js';
import type { Curve, Point, Surface } from './types.js';

export interface BrepVertex { readonly id: string; readonly point: Point; readonly toleranceMM: number }
/** An edge runs along `curve` over its whole domain, from vertices[0] (domain start) to vertices[1] (domain end). */
export interface BrepEdge { readonly id: string; readonly curve: Curve; readonly vertices: readonly [string, string]; readonly toleranceMM: number }
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
export interface BrepFace { readonly id: string; readonly shell: string; readonly surface: Surface; readonly sense: 'forward' | 'reversed'; readonly loops: readonly string[] }
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
}

export class BrepError extends Error {
  constructor(readonly code: 'INPUT' | 'TOPOLOGY' | 'GEOMETRY', detail: string, readonly report?: BrepCheckReport) { super(('B-rep: ' + detail).slice(0, 1024)); this.name = 'BrepError'; }
}

const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Point, b: Point): Point => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** ∂S/∂u × ∂S/∂v at the middle of the surface domain (central differences). */
export function surfaceNormalAtCentre(surface: Surface): Point {
  const { u, v } = surfaceDomain(surface), um = (u[0] + u[1]) / 2, vm = (v[0] + v[1]) / 2, hu = (u[1] - u[0]) * 1e-4, hv = (v[1] - v[0]) * 1e-4;
  return cross(sub(evaluateSurface(surface, um + hu, vm), evaluateSurface(surface, um - hu, vm)), sub(evaluateSurface(surface, um, vm + hv), evaluateSurface(surface, um, vm - hv)));
}
/** Vector area (½∮ p × dp) of a loop of directed curve uses, sampled 16 times per use. */
export function loopVectorArea(uses: readonly { readonly curve: Curve; readonly sense: 'forward' | 'reversed' }[]): Point {
  const ring: Point[] = [];
  for (const u of uses) {
    const [t0, t1] = curveDomain(u.curve);
    for (let k = 0; k < 16; k++) { const f = k / 16; ring.push(evaluateCurve(u.curve, u.sense === 'forward' ? t0 + (t1 - t0) * f : t1 - (t1 - t0) * f)); }
  }
  let area: Point = [0, 0, 0];
  for (let i = 0; i < ring.length; i++) { const c = cross(ring[i], ring[(i + 1) % ring.length]); area = [area[0] + c[0] / 2, area[1] + c[1] / 2, area[2] + c[2] / 2]; }
  return area;
}
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
 */
export function checkBrep(brep: Brep, options: { readonly pcurveSamples?: number } = {}): BrepCheckReport {
  const issues: string[] = [], add = (kind: string, detail: string) => { if (issues.length < 32) issues.push(`${kind}: ${detail}`); };
  const bodies = index(brep.bodies, 'body', issues), shells = index(brep.shells, 'shell', issues), faces = index(brep.faces, 'face', issues);
  const loops = index(brep.loops, 'loop', issues), coedges = index(brep.coedges, 'coedge', issues), edges = index(brep.edges, 'edge', issues), vertices = index(brep.vertices, 'vertex', issues);
  const need = <T>(map: Map<string, T>, id: string | null, what: string): T | undefined => { const v = id === null ? undefined : map.get(id); if (!v) add('reference', `${what} → missing ${id}`); return v; };
  let maximumVertexGapMM = 0, maximumPcurveGapMM = 0;

  for (const b of brep.bodies) for (const s of b.shells) { const shell = need(shells, s, `body ${b.id}`); if (shell && shell.body !== b.id) add('reference', `shell ${s} does not point back to body ${b.id}`); }
  for (const s of brep.shells) {
    need(bodies, s.body, `shell ${s.id}`);
    for (const f of s.faces) { const face = need(faces, f, `shell ${s.id}`); if (face && face.shell !== s.id) add('reference', `face ${f} does not point back to shell ${s.id}`); }
  }
  for (const f of brep.faces) {
    need(shells, f.shell, `face ${f.id}`);
    try { validateSurface(f.surface); } catch (e) { add('geometry', `face ${f.id} surface: ${(e as Error).message}`); }
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
    if (!edge || !face) continue;
    const [t0, t1] = curveDomain(edge.curve), [p0, p1] = curveDomain(c.pcurve);
    if (p0 !== t0 || p1 !== t1) { add('geometry', `coedge ${c.id} pcurve domain differs from its edge`); continue; }
    const { u, v } = surfaceDomain(face.surface);
    for (let k = 0; k < samples; k++) {
      const t = t0 + (t1 - t0) * k / (samples - 1), uv = evaluateCurve(c.pcurve, t);
      if (uv[0] < u[0] - 1e-9 || uv[0] > u[1] + 1e-9 || uv[1] < v[0] - 1e-9 || uv[1] > v[1] + 1e-9) { add('geometry', `coedge ${c.id} pcurve leaves the surface domain`); break; }
      const gap = distance(evaluateSurface(face.surface, Math.min(u[1], Math.max(u[0], uv[0])), Math.min(v[1], Math.max(v[0], uv[1]))), evaluateCurve(edge.curve, t));
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
    const outer = loops.get(f.loops.find(l => loops.get(l)?.kind === 'outer') ?? '');
    if (!outer) continue;
    const uses = outer.coedges.map(c => coedges.get(c)).filter((c): c is BrepCoedge => !!c && edges.has(c.edge)).map(c => ({ curve: edges.get(c.edge)!.curve, sense: c.sense }));
    if (uses.length !== outer.coedges.length) continue;
    const area = loopVectorArea(uses), size = Math.hypot(...area), normal = surfaceNormalAtCentre(f.surface);
    let extent = 0; for (const u of uses) for (const p of u.curve.controlPoints) extent = Math.max(extent, ...p.map(Math.abs));
    if (size <= 1e-6 * Math.max(1, extent) ** 2 || Math.hypot(...normal) === 0) continue;
    if (dot(area, normal) * (f.sense === 'forward' ? 1 : -1) < 0) add('orientation', `face ${f.id} sense disagrees with its outer loop`);
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

  return {
    valid: issues.length === 0, issues,
    counts: { bodies: brep.bodies.length, shells: brep.shells.length, faces: brep.faces.length, loops: brep.loops.length, coedges: brep.coedges.length, edges: brep.edges.length, vertices: brep.vertices.length },
    topology, maximumVertexGapMM, maximumPcurveGapMM,
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
export interface BrepFaceInput { readonly id: string; readonly surface: Surface; readonly sense: 'forward' | 'reversed'; readonly loops: readonly BrepLoopInput[] }
export interface BrepShellInput { readonly id: string; readonly faces: readonly BrepFaceInput[]; readonly closed: boolean }
export interface BrepBuildInput {
  readonly source: Brep['source'];
  readonly vertices: readonly { readonly id: string; readonly point: Point }[];
  readonly edges: readonly { readonly id: string; readonly curve: Curve; readonly vertices: readonly [string, string] }[];
  readonly bodies: readonly { readonly id: string; readonly kind: 'solid' | 'sheet'; readonly shells: readonly BrepShellInput[] }[];
  /** Entity tolerance; defaults to CadNumericPolicy.linearToleranceMM at the geometry's scale. */
  readonly toleranceMM?: number;
}

export function buildBrep(input: BrepBuildInput): Brep {
  let scale = 0;
  for (const v of input.vertices) for (const x of v.point) scale = Math.max(scale, Math.abs(x));
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
        faces.push({ id: faceId, shell: shellId, surface: f.surface, sense: f.sense, loops: loopIds });
      }
      shells.push({ id: shellId, body: b.id, faces: faceIds, closed: s.closed });
    }
    bodies.push({ id: b.id, kind: b.kind, shells: shellIds });
  }
  // Twins: the two uses of each edge (only when there are exactly two).
  const byEdge = new Map<string, typeof mutable>();
  for (const c of mutable) byEdge.set(c.edge, [...(byEdge.get(c.edge) ?? []), c]);
  for (const uses of byEdge.values()) if (uses.length === 2 && uses[0].sense !== uses[1].sense) { uses[0].twin = uses[1].id; uses[1].twin = uses[0].id; }
  coedges.push(...mutable);
  return {
    format: 'barocss-brep', version: 0, lengthUnit: 'mm', source: input.source, bodies, shells, faces, loops, coedges,
    edges: input.edges.map(e => ({ id: e.id, curve: e.curve, vertices: [e.vertices[0], e.vertices[1]] as const, toleranceMM: tol })),
    vertices: input.vertices.map(v => ({ id: v.id, point: [v.point[0], v.point[1], v.point[2]] as Point, toleranceMM: tol })),
  };
}

/** A straight edge curve between two points, domain [0, 1]. */
export const lineCurve = (id: string, a: Point, b: Point): Curve => ({ kind: 'curve', id, degree: 1, knots: [0, 0, 1, 1], controlPoints: [[...a] as Point, [...b] as Point], weights: [1, 1] });
