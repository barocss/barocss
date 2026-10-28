import { BrepError, checkBrep, type Brep, type BrepFace, type BrepLoop, type BrepCoedge, type BrepEdge, type BrepVertex } from '../brep/brep-core.js';
import { booleanAnalyticTraced } from '../brep/analytic-boolean.js';
import { brepMassProperties } from '../brep/solid-mass.js';
import { curveDomain, surfaceDomain } from '../core/math.js';
import { dot, len, scale, sub, unit } from '../core/vec3.js';
import { SectionRationalContext, type SectionRational } from '../section-rational-internal.js';
import { linearToleranceMM } from '../numeric-policy.js';
import { normalOn, ringFillet, sheetOf, type FilletReport } from './rolling-ball.js';
import type { Curve, Point, Surface } from '../types.js';

type RationalPoint = [SectionRational, SectionRational, SectionRational];
interface ExactPlane { readonly origin: RationalPoint; readonly normal: RationalPoint; readonly point: Point; readonly outward: Point }
interface Source { readonly operand: 0 | 1; readonly faceId: string }
interface Sources { readonly sources: readonly Source[]; readonly complete: boolean }
interface Receipt { readonly brep: Brep; readonly complete: boolean; readonly faceSources: ReadonlyMap<string, Sources> }
interface Records {
  readonly faces: Map<string, BrepFace>; readonly loops: Map<string, BrepLoop>;
  readonly coedges: Map<string, BrepCoedge>; readonly edges: Map<string, BrepEdge>; readonly vertices: Map<string, BrepVertex>;
  readonly uses: Map<string, BrepCoedge[]>;
}
interface Admission {
  readonly plane: BrepFace; readonly curved: BrepFace; readonly guide: Curve; readonly end: 0 | 1;
  readonly translation: Point; readonly first: Point; readonly last: Point;
  readonly tangent0: RationalPoint; readonly tangent1: RationalPoint; readonly axis: RationalPoint; readonly support: ExactPlane; readonly exact: SectionRationalContext;
}
interface Boundary { readonly from: string; readonly to: string; readonly label: number }
interface FaceLoops { readonly a: BrepLoop; readonly b: BrepLoop }
interface IdBijection { readonly forward: Map<string, string>; readonly reverse: Map<string, string> }

function unsupported(detail: string): never { throw new BrepError('GEOMETRY', `CAPABILITY: [FACE_FILLET_FACES] ${detail}`); }
function unclear(detail: string): never { throw new BrepError('GEOMETRY', `CAPABILITY: [FACE_FILLET_NOT_CLEAR] ${detail}`); }
function exactFailure(kind: string, detail: string): never { return unsupported(`polynomial corner ${kind}: ${detail}`); }
function rationalPoint(q: SectionRationalContext, p: Point): RationalPoint { return [q.from(p[0]), q.from(p[1]), q.from(p[2])]; }
function rationalSub(q: SectionRationalContext, a: RationalPoint, b: RationalPoint): RationalPoint { return [q.sub(a[0], b[0]), q.sub(a[1], b[1]), q.sub(a[2], b[2])]; }
function rationalDot(q: SectionRationalContext, a: RationalPoint, b: RationalPoint): SectionRational { return q.add(q.add(q.mul(a[0], b[0]), q.mul(a[1], b[1])), q.mul(a[2], b[2])); }
function rationalCross(q: SectionRationalContext, a: RationalPoint, b: RationalPoint): RationalPoint { return [q.sub(q.mul(a[1], b[2]), q.mul(a[2], b[1])), q.sub(q.mul(a[2], b[0]), q.mul(a[0], b[2])), q.sub(q.mul(a[0], b[1]), q.mul(a[1], b[0]))]; }
function rationalZero(p: RationalPoint): boolean { return p[0].n === 0n && p[1].n === 0n && p[2].n === 0n; }
function rationalSame(q: SectionRationalContext, a: RationalPoint, b: RationalPoint): boolean { return q.compare(a[0], b[0]) === 0 && q.compare(a[1], b[1]) === 0 && q.compare(a[2], b[2]) === 0; }
function clampedSpan(knots: readonly number[], degree: number, count: number): boolean {
  if (degree < 1 || degree > 5 || count !== degree + 1 || knots.length !== count + degree + 1 || !(knots[count] > knots[degree])) return false;
  for (let i = 0; i <= degree; i++) if (knots[i] !== knots[degree] || knots[count + i] !== knots[count]) return false;
  return true;
}
/** Certify the parameter-normal orientation of a polynomial translational chart, including high-order planes. */
function planeOrientation(s: Surface, normal: RationalPoint, q: SectionRationalContext): boolean {
  const rows = s.controlPoints.length, columns = s.controlPoints[0].length, weight = s.weights[0][0];
  for (const row of s.weights) for (const value of row) if (value !== weight) return false;
  if (s.degreeU === 1 && rows === 2 && clampedSpan(s.knotsV, s.degreeV, columns)) {
    const u = rationalSub(q, rationalPoint(q, s.controlPoints[1][0]), rationalPoint(q, s.controlPoints[0][0]));
    for (let j = 0; j < columns; j++) if (!rationalSame(q, rationalSub(q, rationalPoint(q, s.controlPoints[1][j]), rationalPoint(q, s.controlPoints[0][j])), u)) return false;
    for (let j = 1; j < columns; j++) {
      const v = rationalSub(q, rationalPoint(q, s.controlPoints[0][j]), rationalPoint(q, s.controlPoints[0][j - 1]));
      if (rationalDot(q, rationalCross(q, u, v), normal).n <= 0n) return false;
    }
    return true;
  }
  if (s.degreeV === 1 && columns === 2 && clampedSpan(s.knotsU, s.degreeU, rows)) {
    const v = rationalSub(q, rationalPoint(q, s.controlPoints[0][1]), rationalPoint(q, s.controlPoints[0][0]));
    for (let i = 0; i < rows; i++) if (!rationalSame(q, rationalSub(q, rationalPoint(q, s.controlPoints[i][1]), rationalPoint(q, s.controlPoints[i][0])), v)) return false;
    for (let i = 1; i < rows; i++) {
      const u = rationalSub(q, rationalPoint(q, s.controlPoints[i][0]), rationalPoint(q, s.controlPoints[i - 1][0]));
      if (rationalDot(q, rationalCross(q, u, v), normal).n <= 0n) return false;
    }
    return true;
  }
  return false;
}
function outwardNormal(q: SectionRationalContext, normal: RationalPoint): Point {
  const reach = q.max(q.max(q.abs(normal[0]), q.abs(normal[1])), q.abs(normal[2]));
  return unit([q.nearest(q.div(normal[0], reach)), q.nearest(q.div(normal[1], reach)), q.nearest(q.div(normal[2], reach))]);
}
function exactPlane(face: BrepFace, q: SectionRationalContext): ExactPlane | null {
  if (face.surface.kind !== 'surface') return null;
  const s = face.surface, origin = rationalPoint(q, s.controlPoints[0][0]);
  const u = rationalSub(q, rationalPoint(q, s.controlPoints[1][0]), origin), v = rationalSub(q, rationalPoint(q, s.controlPoints[0][1]), origin);
  let normal = rationalCross(q, u, v);
  if (rationalZero(normal)) return null;
  for (const row of s.controlPoints) for (const point of row) if (rationalDot(q, normal, rationalSub(q, rationalPoint(q, point), origin)).n !== 0n) return null;
  if (!planeOrientation(s, normal, q)) return null;
  if (face.sense === 'reversed') normal = [q.neg(normal[0]), q.neg(normal[1]), q.neg(normal[2])];
  return { origin, normal, point: s.controlPoints[0][0], outward: outwardNormal(q, normal) };
}
function liesOn(q: SectionRationalContext, plane: ExactPlane, point: Point): boolean { return rationalDot(q, plane.normal, rationalSub(q, rationalPoint(q, point), plane.origin)).n === 0n; }
function confinedAtEnd(q: SectionRationalContext, plane: ExactPlane, poles: readonly Point[], tangent: RationalPoint, last: boolean): boolean {
  const end = rationalPoint(q, poles[last ? poles.length - 1 : 0]), turn = rationalDot(q, plane.normal, tangent).n;
  if (turn === 0n) return false;
  for (let i = last ? 0 : 1; i < (last ? poles.length - 1 : poles.length); i++) {
    const side = rationalDot(q, plane.normal, rationalSub(q, rationalPoint(q, poles[i]), end)).n;
    if (side === 0n || (side > 0n) !== (last ? turn < 0n : turn > 0n)) return false;
  }
  return true;
}

function recordsOf(body: Brep): Records {
  const faces = new Map<string, BrepFace>(), loops = new Map<string, BrepLoop>(), coedges = new Map<string, BrepCoedge>(), edges = new Map<string, BrepEdge>(), vertices = new Map<string, BrepVertex>(), uses = new Map<string, BrepCoedge[]>();
  for (const face of body.faces) faces.set(face.id, face);
  for (const loop of body.loops) loops.set(loop.id, loop);
  for (const coedge of body.coedges) {
    coedges.set(coedge.id, coedge);
    let list = uses.get(coedge.edge); if (!list) { list = []; uses.set(coedge.edge, list); } list.push(coedge);
  }
  for (const edge of body.edges) edges.set(edge.id, edge);
  for (const vertex of body.vertices) vertices.set(vertex.id, vertex);
  return { faces, loops, coedges, edges, vertices, uses };
}
function namedFaces(body: Brep, name: string): BrepFace[] {
  const found: BrepFace[] = [];
  for (const face of body.faces) if (face.name === name || face.name?.split('#')[0] === name) found.push(face);
  return found;
}
function closedSolid(body: Brep): boolean {
  if (body.bodies.length !== 1 || body.bodies[0].kind !== 'solid') return false;
  const own = body.bodies[0], ids = new Set<string>();
  for (const id of own.shells) ids.add(id);
  if (!ids.size || ids.size !== own.shells.length || ids.size !== body.shells.length) return false;
  for (const shell of body.shells) if (!ids.has(shell.id) || shell.body !== own.id || !shell.closed) return false;
  return true;
}
function admit(body: Brep, names: readonly [string, string]): Admission | null {
  const a = namedFaces(body, names[0]), b = namedFaces(body, names[1]);
  if (a.length !== 1 || b.length !== 1) return null;
  const q = new SectionRationalContext(exactFailure), supportA = exactPlane(a[0], q), supportB = exactPlane(b[0], q);
  if ((supportA === null) === (supportB === null)) return null;
  let plane = a[0], curved = b[0];
  if (!supportA) { plane = b[0]; curved = a[0]; }
  const support = supportA ?? supportB!;
  if (curved.surface.kind !== 'surface') return null;
  const s = curved.surface, p = s.degreeV, count = s.controlPoints[0].length;
  if (s.degreeU !== 1 || s.controlPoints.length !== 2 || p < 2 || p > 5 || count !== p + 1) return null;
  for (let i = 0; i <= p; i++) if (s.knotsV[i] !== s.knotsV[p] || s.knotsV[count + i] !== s.knotsV[count]) return null;
  const weight = s.weights[0][0];
  for (const row of s.weights) for (const value of row) if (value !== weight) return null;
  const translation = sub(s.controlPoints[1][0], s.controlPoints[0][0]);
  const exactTranslation = rationalSub(q, rationalPoint(q, s.controlPoints[1][0]), rationalPoint(q, s.controlPoints[0][0]));
  if (rationalZero(exactTranslation) || !rationalSame(q, rationalPoint(q, translation), exactTranslation) || !rationalZero(rationalCross(q, support.normal, exactTranslation))) return null;
  let on0 = true, on1 = true;
  for (let i = 0; i < count; i++) {
    const row0 = s.controlPoints[0][i], row1 = s.controlPoints[1][i];
    if (!rationalSame(q, rationalSub(q, rationalPoint(q, row1), rationalPoint(q, row0)), exactTranslation)) return null;
    if (!liesOn(q, support, row0)) on0 = false;
    if (!liesOn(q, support, row1)) on1 = false;
  }
  if (on0 === on1) return null;
  const end: 0 | 1 = on0 ? 0 : 1, points: Point[] = [];
  // With D parallel to the plane normal and projection coefficient exactly 0 or 1 at every pole,
  // Q_i=P_i+((d-n·P_i)/(n·D))D is the stored endpoint row itself. Copy it without another rounding.
  for (const point of s.controlPoints[end]) points.push([point[0], point[1], point[2]]);
  const first = points[0], last = points[count - 1];
  const axis = rationalSub(q, rationalPoint(q, last), rationalPoint(q, first));
  if (rationalZero(axis)) return null;
  for (let i = 1; i < count; i++) if (rationalDot(q, rationalSub(q, rationalPoint(q, points[i]), rationalPoint(q, points[i - 1])), axis).n <= 0n) return null;
  const knots: number[] = [], weights: number[] = [];
  for (const value of s.knotsV) knots.push(value);
  for (let i = 0; i < count; i++) weights.push(1);
  return { plane, curved, guide: { kind: 'curve', id: 'polynomial_corner_guide', degree: p, knots, controlPoints: points, weights }, end, translation, first, last,
    tangent0: rationalSub(q, rationalPoint(q, points[1]), rationalPoint(q, first)), tangent1: rationalSub(q, rationalPoint(q, last), rationalPoint(q, points[count - 2])), axis, support, exact: q };
}
function capsOf(body: Brep, a: Admission): [BrepFace, BrepFace] {
  const ends: BrepFace[][] = [[], []];
  for (const face of body.faces) {
    if (face.id === a.plane.id || face.id === a.curved.id) continue;
    const plane = exactPlane(face, a.exact);
    if (!plane) continue;
    const direction = rationalDot(a.exact, plane.normal, a.axis).n;
    if (liesOn(a.exact, plane, a.first) && rationalZero(rationalCross(a.exact, plane.normal, a.tangent0)) && direction < 0n) ends[0].push(face);
    if (liesOn(a.exact, plane, a.last) && rationalZero(rationalCross(a.exact, plane.normal, a.tangent1)) && direction > 0n) ends[1].push(face);
  }
  if (ends[0].length !== 1 || ends[1].length !== 1 || ends[0][0].id === ends[1][0].id) return unsupported('polynomial corner needs exactly two distinct planar end caps normal to its end tangents');
  for (const face of ends[0]) if (face.loops.length !== 1) unsupported('a polynomial corner end cap with holes is not supported');
  for (const face of ends[1]) if (face.loops.length !== 1) unsupported('a polynomial corner end cap with holes is not supported');
  // Bernstein half-space bounds keep the guide strictly between the caps: each cap is met only at its own end.
  if (!confinedAtEnd(a.exact, exactPlane(ends[0][0], a.exact)!, a.guide.controlPoints, a.tangent0, false) || !confinedAtEnd(a.exact, exactPlane(ends[1][0], a.exact)!, a.guide.controlPoints, a.tangent1, true)) unsupported('the polynomial corner guide leaves or re-enters an end cap');
  return [ends[0][0], ends[1][0]];
}
function faceOfUse(records: Records, use: BrepCoedge): string { return records.loops.get(use.loop)!.face; }
function bridgeFaces(body: Brep, records: Records, a: Admission, caps: readonly BrepFace[]): Set<string> {
  const bridge = new Set<string>();
  for (const face of body.faces) {
    if (face.id === a.plane.id || face.id === a.curved.id || face.id === caps[0].id || face.id === caps[1].id) continue;
    let touchesA = false, touchesB = false;
    for (const lid of face.loops) for (const cid of records.loops.get(lid)!.coedges) {
      const coedge = records.coedges.get(cid)!;
      for (const other of records.uses.get(coedge.edge)!) {
        const id = faceOfUse(records, other);
        if (id === a.plane.id) touchesA = true;
        if (id === a.curved.id) touchesB = true;
      }
    }
    if (touchesA && touchesB) bridge.add(face.id);
  }
  return bridge;
}
function labelMap(a: Admission, caps: readonly BrepFace[]): Map<string, number> {
  const labels = new Map<string, number>(); labels.set(a.plane.id, 0); labels.set(a.curved.id, 1); labels.set(caps[0].id, 2); labels.set(caps[1].id, 3); return labels;
}
/** A connected disk whose one boundary has exactly one chain against each of A/B/cap0/cap1. */
function requireStrip(records: Records, members: ReadonlySet<string>, labels: ReadonlyMap<string, number>): void {
  if (!members.size) return unsupported('the polynomial corner has no complete bridge strip');
  const counts = new Map<string, number>(), vertices = new Set<string>(), adjacent = new Map<string, Set<string>>();
  for (const id of members) {
    const face = records.faces.get(id)!; adjacent.set(id, new Set());
    if (face.loops.length !== 1 || records.loops.get(face.loops[0])!.kind !== 'outer') unsupported('the polynomial corner bridge has a hole');
    for (const cid of records.loops.get(face.loops[0])!.coedges) {
      const coedge = records.coedges.get(cid)!, edge = records.edges.get(coedge.edge)!;
      counts.set(edge.id, (counts.get(edge.id) ?? 0) + 1); vertices.add(edge.vertices[0]); vertices.add(edge.vertices[1]);
    }
  }
  const boundary: Boundary[] = [];
  for (const [id, count] of counts) {
    const uses = records.uses.get(id)!, edge = records.edges.get(id)!;
    if (uses.length !== 2 || faceOfUse(records, uses[0]) === faceOfUse(records, uses[1])) unsupported('the polynomial corner bridge has a seam or a non-manifold edge');
    const a = faceOfUse(records, uses[0]), b = faceOfUse(records, uses[1]);
    if (count === 2 && members.has(a) && members.has(b)) { adjacent.get(a)!.add(b); adjacent.get(b)!.add(a); continue; }
    if (count !== 1) unsupported('the polynomial corner bridge has a branching edge');
    const own = members.has(a) ? uses[0] : uses[1], other = members.has(a) ? b : a, label = labels.get(other);
    if (label === undefined) unsupported('the polynomial corner bridge meets a face outside its two sides and end caps');
    boundary.push({ from: own.sense === 'forward' ? edge.vertices[0] : edge.vertices[1], to: own.sense === 'forward' ? edge.vertices[1] : edge.vertices[0], label });
  }
  if (vertices.size - counts.size + members.size !== 1) unsupported('the polynomial corner bridge is not a disk');
  const first = members.values().next().value as string, stack = [first], visited = new Set<string>();
  while (stack.length) { const at = stack.pop()!; if (visited.has(at)) continue; visited.add(at); for (const next of adjacent.get(at)!) stack.push(next); }
  if (visited.size !== members.size) unsupported('the polynomial corner bridge is disconnected');
  const from = new Map<string, Boundary>(), incoming = new Set<string>();
  for (const edge of boundary) {
    if (from.has(edge.from) || incoming.has(edge.to)) unsupported('the polynomial corner bridge boundary branches');
    from.set(edge.from, edge); incoming.add(edge.to);
  }
  if (!boundary.length || from.size !== incoming.size) unsupported('the polynomial corner bridge has no boundary loop');
  const cycle: number[] = [], used = new Set<string>(); let vertex = boundary[0].from;
  for (;;) {
    if (used.has(vertex)) break;
    used.add(vertex); const edge = from.get(vertex);
    if (!edge) return unsupported('the polynomial corner bridge boundary is open');
    cycle.push(edge.label); vertex = edge.to;
  }
  if (vertex !== boundary[0].from || used.size !== boundary.length) unsupported('the polynomial corner bridge has more than one boundary loop');
  const runs = [0, 0, 0, 0];
  // Four unique runs must alternate side/cap: only rotations or reversals of A-cap0-B-cap1 are admitted.
  for (let i = 0; i < cycle.length; i++) {
    const own = cycle[i], prior = cycle[(i + cycle.length - 1) % cycle.length];
    if (own === prior) continue;
    runs[own]++;
    if ((own < 2) === (prior < 2)) unsupported('the polynomial corner bridge sides and end caps do not alternate');
  }
  for (const count of runs) if (count !== 1) unsupported('the polynomial corner bridge does not have four continuous side/end chains');
}

function sameNumbers(a: readonly number[], b: readonly number[]): boolean { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
function sameSurface(a: Surface, b: Surface): boolean {
  if (a.degreeU !== b.degreeU || a.degreeV !== b.degreeV || !sameNumbers(a.knotsU, b.knotsU) || !sameNumbers(a.knotsV, b.knotsV) || a.controlPoints.length !== b.controlPoints.length) return false;
  for (let i = 0; i < a.controlPoints.length; i++) {
    if (a.controlPoints[i].length !== b.controlPoints[i].length || !sameNumbers(a.weights[i], b.weights[i])) return false;
    for (let j = 0; j < a.controlPoints[i].length; j++) if (!sameNumbers(a.controlPoints[i][j], b.controlPoints[i][j])) return false;
  }
  return true;
}
function sameCurve(a: Curve, forwardA: boolean, b: Curve, forwardB: boolean, q: SectionRationalContext): boolean {
  if (a.degree !== b.degree || a.controlPoints.length !== b.controlPoints.length || a.knots.length !== b.knots.length) return false;
  if (forwardA === forwardB) {
    if (!sameNumbers(a.knots, b.knots)) return false;
  } else {
    const direct = forwardA ? a : b, reverse = forwardA ? b : a, domain = curveDomain(reverse);
    const sum = q.add(q.from(domain[0]), q.from(domain[1]));
    for (let i = 0; i < direct.knots.length; i++) {
      const reflected = q.sub(sum, q.from(reverse.knots[reverse.knots.length - 1 - i]));
      if (q.compare(q.from(direct.knots[i]), reflected) !== 0) return false;
    }
  }
  for (let i = 0; i < a.controlPoints.length; i++) {
    const ia = forwardA ? i : a.controlPoints.length - 1 - i, ib = forwardB ? i : b.controlPoints.length - 1 - i;
    if (a.weights[ia] !== b.weights[ib] || !sameNumbers(a.controlPoints[ia], b.controlPoints[ib])) return false;
  }
  return true;
}
function sameUseCurves(a: BrepCoedge, ia: Records, b: BrepCoedge, ib: Records, q: SectionRationalContext): boolean {
  const ea = ia.edges.get(a.edge)!, eb = ib.edges.get(b.edge)!, fa = a.sense === 'forward', fb = b.sense === 'forward';
  if (!sameCurve(ea.curve, fa, eb.curve, fb, q)) return false;
  if (!a.pcurve || !b.pcurve) return a.pcurve === b.pcurve;
  return sameCurve(a.pcurve, fa, b.pcurve, fb, q);
}
function sameUse(a: BrepCoedge, ia: Records, b: BrepCoedge, ib: Records, q: SectionRationalContext): boolean {
  if (!sameUseCurves(a, ia, b, ib, q)) return false;
  const ea = ia.edges.get(a.edge)!, eb = ib.edges.get(b.edge)!, fa = a.sense === 'forward', fb = b.sense === 'forward';
  return sameNumbers(ia.vertices.get(ea.vertices[fa ? 0 : 1])!.point, ib.vertices.get(eb.vertices[fb ? 0 : 1])!.point) && sameNumbers(ia.vertices.get(ea.vertices[fa ? 1 : 0])!.point, ib.vertices.get(eb.vertices[fb ? 1 : 0])!.point);
}
function matchingFaceLoops(a: BrepFace, ia: Records, b: BrepFace, ib: Records): FaceLoops | null {
  if (a.surface.kind !== 'surface' || b.surface.kind !== 'surface' || a.sense !== b.sense || a.name !== b.name || !sameSurface(a.surface, b.surface) || a.loops.length !== 1 || b.loops.length !== 1) return null;
  const la = ia.loops.get(a.loops[0])!, lb = ib.loops.get(b.loops[0])!;
  if (la.kind !== lb.kind || la.coedges.length !== lb.coedges.length) return null;
  const unique = new Set<string>();
  for (const cid of la.coedges) { const id = ia.coedges.get(cid)!.edge; if (unique.has(id)) return null; unique.add(id); }
  unique.clear();
  for (const cid of lb.coedges) { const id = ib.coedges.get(cid)!.edge; if (unique.has(id)) return null; unique.add(id); }
  return { a: la, b: lb };
}
function sameFace(a: BrepFace, ia: Records, b: BrepFace, ib: Records, q: SectionRationalContext): boolean {
  const loops = matchingFaceLoops(a, ia, b, ib);
  if (!loops) return false;
  for (let offset = 0; offset < loops.b.coedges.length; offset++) {
    let matches = true;
    for (let i = 0; i < loops.a.coedges.length; i++) if (!sameUse(ia.coedges.get(loops.a.coedges[i])!, ia, ib.coedges.get(loops.b.coedges[(i + offset) % loops.b.coedges.length])!, ib, q)) { matches = false; break; }
    if (matches) return true;
  }
  return false;
}
function originalId(set: Sources): string | null { return set.sources.length === 1 && set.sources[0].operand === 0 ? set.sources[0].faceId : null; }
function bindIds(before: string, after: string, ids: IdBijection): void {
  const forward = ids.forward.get(before), reverse = ids.reverse.get(after);
  if ((forward !== undefined && forward !== after) || (reverse !== undefined && reverse !== before)) return unclear('the protected boundary has a non-unique edge or vertex correspondence');
  ids.forward.set(before, after); ids.reverse.set(after, before);
}
function matchBoundary(loops: FaceLoops, before: Records, after: Records, q: SectionRationalContext, edges: IdBijection, vertices: IdBijection): void {
  let matched = -1;
  for (let offset = 0; offset < loops.b.coedges.length; offset++) {
    let same = true;
    for (let i = 0; i < loops.a.coedges.length; i++) if (!sameUseCurves(before.coedges.get(loops.a.coedges[i])!, before, after.coedges.get(loops.b.coedges[(i + offset) % loops.b.coedges.length])!, after, q)) { same = false; break; }
    if (!same) continue;
    if (matched !== -1) return unclear('the protected boundary has more than one exact cyclic correspondence');
    matched = offset;
  }
  if (matched === -1) return unclear('a protected oriented boundary curve or pcurve changed');
  for (let i = 0; i < loops.a.coedges.length; i++) {
    const a = before.coedges.get(loops.a.coedges[i])!, b = after.coedges.get(loops.b.coedges[(i + matched) % loops.b.coedges.length])!;
    const ea = before.edges.get(a.edge)!, eb = after.edges.get(b.edge)!, forwardA = a.sense === 'forward', forwardB = b.sense === 'forward';
    bindIds(ea.id, eb.id, edges);
    bindIds(ea.vertices[forwardA ? 0 : 1], eb.vertices[forwardB ? 0 : 1], vertices);
    bindIds(ea.vertices[forwardA ? 1 : 0], eb.vertices[forwardB ? 1 : 0], vertices);
  }
}
/** Preserve representative points only after exact surface/curve/trim matching and unique incidence correspondence. */
function preserveProtectedVertices(body: Brep, before: Records, result: Receipt, bridge: ReadonlySet<string>, supports: ReadonlyMap<string, number>, size: number, q: SectionRationalContext): Brep {
  if (!result.complete || result.faceSources.size !== result.brep.faces.length) return unclear('protected vertices require complete Boolean face provenance');
  const after = recordsOf(result.brep), kept = new Map<string, BrepFace[]>();
  for (const face of result.brep.faces) {
    const set = result.faceSources.get(face.id);
    if (!set?.complete || !set.sources.length) return unclear('protected vertices require complete face source sets');
    const original = originalId(set);
    if (original === null) continue;
    let list = kept.get(original); if (!list) { list = []; kept.set(original, list); } list.push(face);
  }
  const vertices: IdBijection = { forward: new Map(), reverse: new Map() }, edges: IdBijection = { forward: new Map(), reverse: new Map() };
  for (const face of body.faces) {
    if (supports.has(face.id) || bridge.has(face.id)) continue;
    const copies = kept.get(face.id);
    if (!copies || copies.length !== 1) return unclear('an unrelated face has no unique singleton source');
    const loops = matchingFaceLoops(face, before, copies[0], after);
    if (!loops) return unclear('a protected surface, orientation, name or trim structure changed');
    matchBoundary(loops, before, after, q, edges, vertices);
  }
  for (const [original, current] of vertices.forward) {
    const a = before.vertices.get(original)!, b = after.vertices.get(current)!;
    const allowance = Math.min(a.tolerance, b.tolerance, linearToleranceMM(size));
    if (!Number.isFinite(allowance) || allowance < 0) return unclear('a protected vertex has no existing tolerance bound');
    const delta = rationalSub(q, rationalPoint(q, a.point), rationalPoint(q, b.point)), bound = q.from(allowance);
    if (q.compare(rationalDot(q, delta, delta), q.mul(bound, bound)) > 0) return unclear('a protected vertex representative moved beyond its existing tolerance');
  }
  const restored: BrepVertex[] = [];
  for (const vertex of result.brep.vertices) {
    const original = vertices.reverse.get(vertex.id);
    if (original === undefined) { restored.push(vertex); continue; }
    const point = before.vertices.get(original)!.point;
    // Keep result ids/tolerances and copy only source representative coordinates. Neither operand nor raw result mutates.
    restored.push({ id: vertex.id, point: [point[0], point[1], point[2]], tolerance: vertex.tolerance });
  }
  return { ...result.brep, vertices: restored };
}
function verifyReplacement(body: Brep, before: Records, result: Receipt, bridge: ReadonlySet<string>, supports: ReadonlyMap<string, number>, roundSources: ReadonlySet<string>, q: SectionRationalContext): void {
  if (!result.complete || result.faceSources.size !== result.brep.faces.length) return unclear('the polynomial corner Boolean has incomplete face provenance');
  const after = recordsOf(result.brep), round = new Set<string>(), labels = new Map<string, number>(), kept = new Map<string, BrepFace[]>();
  for (const face of result.brep.faces) {
    const set = result.faceSources.get(face.id);
    if (!set?.complete || !set.sources.length) return unclear('the polynomial corner Boolean has an incomplete face source set');
    for (const source of set.sources) if (source.operand === 0 && bridge.has(source.faceId)) return unclear('the old polynomial corner bridge was not completely replaced');
    const original = originalId(set);
    if (original !== null) {
      let list = kept.get(original); if (!list) { list = []; kept.set(original, list); } list.push(face);
      const label = supports.get(original);
      if (label !== undefined) { if (face.loops.length !== 1) unclear('a polynomial corner side or end cap gained a hole'); labels.set(face.id, label); }
      continue;
    }
    for (const source of set.sources) if (source.operand !== 1 || !roundSources.has(source.faceId)) return unclear('the polynomial corner changed faces outside its new round');
    round.add(face.id);
  }
  for (const face of body.faces) {
    if (supports.has(face.id) || bridge.has(face.id)) continue;
    const copies = kept.get(face.id);
    if (!copies || copies.length !== 1 || !sameFace(face, before, copies[0], after, q)) return unclear('an unrelated face or its oriented trim changed during polynomial corner replacement');
  }
  requireStrip(after, round, labels);
}

/** INTERNAL: a larger convex round replacing one complete disk strip between a plane and a polynomial extrusion. */
export function polynomialFaceFillet(body: Brep, names: readonly [string, string], radius: number, id: string): { readonly brep: Brep; readonly report: FilletReport } | null {
  if (!closedSolid(body)) return unsupported('the polynomial corner needs one closed solid body');
  const admission = admit(body, names);
  if (!admission) return null;
  if (!Number.isFinite(radius) || !(radius > 0)) throw new BrepError('INPUT', 'PARAMETER: [FACE_FILLET_RADIUS] a polynomial corner radius must be finite and positive');
  if (!checkBrep(body, { strict: true }).valid) return unsupported('the polynomial corner needs one valid body');
  if (admission.plane.loops.length !== 1 || admission.curved.loops.length !== 1) return unsupported('polynomial corner sides with holes are not supported');
  const before = recordsOf(body), caps = capsOf(body, admission), supports = labelMap(admission, caps), bridge = bridgeFaces(body, before, admission, caps);
  requireStrip(before, bridge, supports);
  const surface = admission.curved.surface as Surface, domain = surfaceDomain(surface), sheet = sheetOf(surface, admission.curved.sense);
  const wA = scale(normalOn(sheet, domain.u[admission.end], domain.v[0]), -1), wB = scale(unit(admission.translation), admission.end === 0 ? 1 : -1);
  if (dot(admission.support.outward, wB) >= -1e-9 || Math.abs(dot(wA, wB)) > 1e-9) return unsupported('only a convex square polynomial corner is supported');
  let size = Math.max(1, radius);
  for (const vertex of body.vertices) size = Math.max(size, len(vertex.point));
  const g0 = exactPlane(caps[0], admission.exact)!, g1 = exactPlane(caps[1], admission.exact)!;
  const tool = ringFillet(body, { loop: [{ curve: admission.guide, reversed: false }], names: [names[0] + '|' + names[1]], sideA: [admission.plane], sideB: [admission.curved], start: { wA, wB }, convex: true, r: radius, id, scaleMM: size, tolMM: 2.5 * linearToleranceMM(size), closed: false, noCliffs: true, past: [{ o: g0.point, n: g0.outward }, { o: g1.point, n: g1.outward }], clipped: [false, false] });
  // One face starts on each side; growSides only appends and the returned list is not deduplicated.
  if (tool.sides.length !== 2) return unclear('the polynomial corner ball added another contact face');
  for (const side of tool.sides) if (side !== admission.plane.name && side !== admission.curved.name) return unclear('the polynomial corner ball left one of the two selected faces');
  const roundSources = new Set<string>();
  for (const face of tool.brep.faces) if (face.name === `${id}.face`) roundSources.add(face.id);
  const result = booleanAnalyticTraced(body, tool.brep, 'difference', { id, contactFaces: tool.contactFaces, contactWith: tool.sides });
  if (!closedSolid(result.brep)) return unclear('the polynomial corner replacement is not one closed solid body');
  if (!checkBrep(result.brep, { strict: true }).valid) return unclear('the raw polynomial corner Boolean is not strictly valid');
  const restored = preserveProtectedVertices(body, before, result, bridge, supports, size, admission.exact);
  verifyReplacement(body, before, { brep: restored, faceSources: result.faceSources, complete: result.complete }, bridge, supports, roundSources, admission.exact);
  const report = checkBrep(restored, { strict: true });
  if (!report.valid) return unclear('the polynomial corner replacement is not one valid body');
  const volume = brepMassProperties(body, 1).volume, removed = volume - brepMassProperties(restored, 1).volume;
  if (!(removed > 1e-9 * Math.max(1, Math.abs(volume)))) return unclear('the polynomial corner replacement did not remove positive volume');
  return { brep: restored, report: tool.report };
}
