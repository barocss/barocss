// Offset face owns a native cap snapshot. Display data identifies the pick only; it never authors a profile.
import { CadNumericPolicy, CadPartLimits, brepFromPrismatic, checkBrep, prismaticFromProfile, prismaticMassProperties, transformBrep, type Brep, type BrepFace, type Curve, type Surface } from '@barocss/cad';
import { fillFeaturePatternSpec } from '@barocss/cad/api';
import { leafBodies, type SketchNode, type StudioDoc } from '../engine/doc';
import { evaluateDoc, massOfRef, partBreps, type BodyResult } from '../engine/evaluate';
import { bodyKeyFor, withIds } from '../engine/ids';
import { refusal } from '../engine/refusal';
import { canonical, modelContent } from '../util/revision';
import { refOf } from './bodyRef';
import type { Ctx } from './commands';

type XYZ = [number, number, number];
type XY = [number, number];
type Axis = 0 | 1 | 2;
export interface NativeOffsetFaceProfile {
  readonly sketch: SketchNode;
  readonly kind: 'polygon' | 'circle';
  readonly axis: Axis;
  readonly sign: 1 | -1;
  readonly coordinate: number;
  readonly opposite: number;
  readonly thickness: number;
}
const unsupported = (message: string): never => { throw refusal('VALUE', `Offset face: ${message}`); };
const missing = (message: string): never => { throw refusal('BAD_REFERENCE', `Offset face: ${message}`); };
const abs = (n: bigint): bigint => n < 0n ? -n : n;
const bits = new DataView(new ArrayBuffer(8));
/** A finite binary64 length as an integer in fixed units of 2^-1074; no rounded subtraction. */
function exact(value: number): bigint {
  if (typeof value !== 'number' || !Number.isFinite(value)) return unsupported('a nonfinite value cannot enter the native proof.');
  bits.setFloat64(0, value, false);
  const b = bits.getBigUint64(0, false), exponent = Number((b >> 52n) & 2047n), fraction = b & ((1n << 52n) - 1n);
  const magnitude = exponent === 0 ? fraction : ((1n << 52n) | fraction) << BigInt(exponent - 1);
  return b >> 63n ? -magnitude : magnitude;
}
const finite = (n: number): boolean => Number.isFinite(n) && Math.abs(n) <= CadNumericPolicy.coordinateAbs;
const samePoint = (a: readonly number[], b: readonly number[]): boolean => a.length === 3 && b.length === 3 && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const pointKey = (p: readonly number[]): string => `${p[0]},${p[1]},${p[2]}`;
function crossSign(a: XYZ, b: XYZ, c: XYZ, axis: Axis): bigint {
  const j = ((axis + 1) % 3) as Axis, k = ((axis + 2) % 3) as Axis;
  return (exact(b[j]) - exact(a[j])) * (exact(c[k]) - exact(a[k])) - (exact(b[k]) - exact(a[k])) * (exact(c[j]) - exact(a[j]));
}
function affine(surface: Surface): boolean {
  if (surface.degreeU !== 1 || surface.degreeV !== 1 || surface.controlPoints.length !== 2 || surface.controlPoints[0].length !== 2 || surface.controlPoints[1].length !== 2) return false;
  const w = surface.weights[0][0];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    if (!(w > 0) || !Number.isFinite(w) || surface.weights[i][j] !== w) return false;
    const p = surface.controlPoints[i][j];
    for (const value of p) if (!finite(value)) return false;
  }
  for (let k = 0; k < 3; k++) if (exact(surface.controlPoints[0][0][k]) + exact(surface.controlPoints[1][1][k]) !== exact(surface.controlPoints[0][1][k]) + exact(surface.controlPoints[1][0][k])) return false;
  return true;
}
function capAxis(face: BrepFace): Axis {
  if (face.surface.kind !== 'surface' || !affine(face.surface)) return unsupported('pick a native cardinal planar cap with an affine support.');
  const p = face.surface.controlPoints;
  for (const axis of [0, 1, 2] as const) {
    const coordinate = p[0][0][axis];
    if (p[0][1][axis] === coordinate && p[1][0][axis] === coordinate && p[1][1][axis] === coordinate && crossSign(p[0][0] as XYZ, p[1][0] as XYZ, p[0][1] as XYZ, axis) !== 0n) return axis;
  }
  return unsupported('only native cardinal prism or cylinder caps are supported.');
}
function frame(axis: Axis, sign: 1 | -1, coordinate: number): { origin: XYZ; normal: XYZ; xAxis: XYZ } {
  const origin: XYZ = [0, 0, 0], normal: XYZ = [0, 0, 0], xAxis: XYZ = [0, 0, 0];
  origin[axis] = coordinate; normal[axis] = sign; xAxis[((axis + 1) % 3) as Axis] = 1;
  return { origin, normal, xAxis };
}
const zero = (n: number): number => n === 0 ? 0 : n;
function local(p: readonly number[], axis: Axis, sign: 1 | -1): XY { return [zero(p[(axis + 1) % 3]), zero(sign * p[(axis + 2) % 3])]; }
function world(p: readonly number[], axis: Axis): XYZ { return [p[(axis + 1) % 3], p[(axis + 2) % 3], p[axis]]; }
function loopById(brep: Brep, id: string): Brep['loops'][number] | undefined { for (const value of brep.loops) if (value.id === id) return value; }
function coedgeById(brep: Brep, id: string): Brep['coedges'][number] | undefined { for (const value of brep.coedges) if (value.id === id) return value; }
function edgeById(brep: Brep, id: string): Brep['edges'][number] | undefined { for (const value of brep.edges) if (value.id === id) return value; }
function vertexById(brep: Brep, id: string): Brep['vertices'][number] | undefined { for (const value of brep.vertices) if (value.id === id) return value; }
function constantLevel(points: readonly XYZ[], axis: Axis): boolean { for (const point of points) if (point[axis] !== points[0][axis]) return false; return points.length > 0; }
function ring(brep: Brep, face: BrepFace): XYZ[] {
  if (face.loops.length !== 1) return unsupported('holes and multiple face loops are not supported.');
  const loop = loopById(brep, face.loops[0]);
  if (!loop || loop.kind !== 'outer') return unsupported('a native outer boundary is required.');
  if (loop.coedges.length > 16) return unsupported('the bounded native cap profile has at most 16 edges per face.');
  const out: XYZ[] = [];
  for (const id of loop.coedges) {
    const coedge = coedgeById(brep, id), edge = coedge && edgeById(brep, coedge.edge);
    const vertex = edge && coedge && vertexById(brep, edge.vertices[coedge.sense === 'forward' ? 0 : 1]);
    if (!vertex) return unsupported('the native cap boundary is incomplete.');
    out.push([...vertex.point] as XYZ);
  }
  return out;
}
function line(curve: Curve, a: readonly number[], b: readonly number[]): boolean {
  return curve.degree === 1 && curve.controlPoints.length === 2 && curve.weights.length === 2 && curve.weights[0] > 0 && curve.weights[0] === curve.weights[1]
    && samePoint(curve.controlPoints[0], a) && samePoint(curve.controlPoints[1], b);
}
function topology(brep: Brep): void {
  if (brep.bodies.length !== 1 || brep.bodies[0].kind !== 'solid' || brep.bodies[0].shells.length !== 1 || brep.shells.length !== 1 || !brep.shells[0].closed || brep.shells[0].faces.length !== brep.faces.length) return unsupported('one native closed solid with one shell is required.');
  const report = checkBrep(brep, { strict: true });
  if (!report.valid) return unsupported(`the current native body is invalid: ${report.issues.join('; ')}`);
  for (const vertex of brep.vertices) for (const value of vertex.point) if (!finite(value)) return unsupported('native coordinates exceed the current modeling range.');
  for (const face of brep.faces) if (face.surface.kind !== 'surface') return unsupported('faceted faces are not supported.');
}
function polygon(brep: Brep, selected: BrepFace, axis: Axis, sign: 1 | -1, coordinate: number, opposite: number): XY[] {
  const points = ring(brep, selected), n = points.length;
  if (n < 3 || n > 16 || brep.vertices.length !== 2 * n || brep.edges.length !== 3 * n || brep.faces.length !== n + 2 || brep.loops.length !== n + 2) return unsupported('a simple native right prism with 3 to 16 cap corners is required; partitioned faces are unsupported.');
  const projected: XY[] = []; for (const point of points) projected.push(local(point, axis, sign));
  try { fillFeaturePatternSpec({ region: { points: projected }, anchor: [0, 0], spacing: 1, count: 1, spacing2: 1, count2: 1 }); } catch { return unsupported('the native cap must have a simple straight boundary.'); }
  let direction = 0n;
  for (let i = 0; i < n; i++) {
    const turn = crossSign(points[i], points[(i + 1) % n], points[(i + 2) % n], axis);
    if (turn === 0n || direction !== 0n && (turn > 0n) !== (direction > 0n)) return unsupported('the native cap must be strictly convex.');
    direction = turn;
  }
  const capKeys = new Set<string>();
  for (const p of points) { const q = [...p]; q[axis] = opposite; capKeys.add(pointKey(p)); capKeys.add(pointKey(q)); }
  if (capKeys.size !== 2 * n) return unsupported('the native cap has repeated corners.');
  for (const vertex of brep.vertices) if (!capKeys.has(pointKey(vertex.point))) return unsupported('the other cap is not a congruent native right-prism cap.');
  for (const edge of brep.edges) {
    const a = vertexById(brep, edge.vertices[0])!.point, b = vertexById(brep, edge.vertices[1])!.point;
    if (!line(edge.curve, a, b)) return unsupported('the right prism must have native straight edges.');
    if (a[axis] !== b[axis] && (a[(axis + 1) % 3] !== b[(axis + 1) % 3] || a[(axis + 2) % 3] !== b[(axis + 2) % 3])) return unsupported('drafted or slanted neighbouring faces are not supported.');
  }
  let caps = 0;
  for (const face of brep.faces) {
    const boundary = ring(brep, face), isCap = constantLevel(boundary, axis);
    if (face.surface.kind !== 'surface' || !affine(face.surface)) return unsupported('every prism support must be a native affine plane.');
    if (isCap) {
      caps++;
      if (boundary.length !== n || boundary[0][axis] !== coordinate && boundary[0][axis] !== opposite || capAxis(face) !== axis) return unsupported('the native prism cap pairing is invalid.');
      for (const row of face.surface.controlPoints) for (const p of row) if (p[axis] !== boundary[0][axis]) return unsupported('a native cap support leaves its cap plane.');
    } else {
      if (boundary.length !== 4) return unsupported('a right-prism side must have four native corners.');
      const corners = new Set(boundary.map(pointKey));
      if (corners.size !== 4) return unsupported('the native side repeats a corner.');
      const poles = new Set<string>();
      for (const row of face.surface.controlPoints) for (const p of row) { if (!corners.has(pointKey(p))) return unsupported('a side support is not the native ruled rectangle.'); poles.add(pointKey(p)); }
      if (poles.size !== 4) return unsupported('a native side support cannot repeat or collapse its corners.');
    }
  }
  if (caps !== 2) return unsupported('exactly two native prism caps are required.');
  return projected;
}

/** Two native quadratic Bezier spans, full knots and orientation retained. For every span,
 * H_a W_b - H_b W_a has degree4. Its Bernstein coefficients bound the numerator in L1;
 * both positive weight polynomials are bounded below by their smallest coefficients.
 * This quotient bound also handles mirrored circle halves whose stored weights differ by rounding.
 * All integers use fixed2^-1074 units. Multiplication by12 clears the degree4 binomial denominators. */
function curveBound(a: Curve, b: Curve, axis: Axis): bigint | null {
  if (a.degree !== 2 || b.degree !== 2 || a.controlPoints.length !== b.controlPoints.length || a.controlPoints.length !== 3 && a.controlPoints.length !== 5 || a.weights.length !== a.controlPoints.length || b.weights.length !== b.controlPoints.length) return null;
  const spans = (a.controlPoints.length - 1) / 2, knots = spans === 1 ? [0, 0, 0, 1, 1, 1] : [0, 0, 0, .5, .5, 1, 1, 1];
  for (const curve of [a, b]) {
    if (!sameArray(curve.knots, knots)) return null;
    for (const weight of curve.weights) if (!(weight > 0) || !Number.isFinite(weight)) return null;
    for (const p of curve.controlPoints) for (const value of p) if (!finite(value)) return null;
  }
  const binomial2 = [1n, 2n, 1n], binomial4 = [1n, 4n, 6n, 4n, 1n];
  let best: bigint | null = null;
  for (const reverse of [false, true]) {
    let maximum = 0n;
    for (let span = 0; span < spans; span++) {
      const pa: bigint[][] = [], pb: bigint[][] = [], wa: bigint[] = [], wb: bigint[] = [];
      for (let i = 0; i < 3; i++) {
        const index = span * 2 + i, other = reverse ? a.controlPoints.length - 1 - index : index;
        const p = world(a.controlPoints[index], axis), q = b.controlPoints[other];
        pa.push([exact(p[0]), exact(p[1]), exact(p[2])]); pb.push([exact(q[0]), exact(q[1]), exact(q[2])]);
        wa.push(exact(a.weights[index])); wb.push(exact(b.weights[other]));
      }
      let minA = wa[0], minB = wb[0];
      for (let i = 1; i < 3; i++) { if (wa[i] < minA) minA = wa[i]; if (wb[i] < minB) minB = wb[i]; }
      const denominator = 12n * minA * minB;
      for (let coefficient = 0; coefficient <= 4; coefficient++) {
        let bound = 0n;
        for (let coordinate = 0; coordinate < 3; coordinate++) {
          let residual = 0n;
          for (let i = 0; i < 3; i++) { const j = coefficient - i; if (j >= 0 && j < 3) residual += binomial2[i] * binomial2[j] * wa[i] * wb[j] * (pa[i][coordinate] - pb[j][coordinate]); }
          bound += abs(residual * (12n / binomial4[coefficient]));
        }
        const ceiling = (bound + denominator - 1n) / denominator;
        if (ceiling > maximum) maximum = ceiling;
      }
    }
    if (best === null || maximum < best) best = maximum;
  }
  return best;
}
function quarter(curve: Curve, index: number): Curve {
  if (curve.controlPoints.length !== 5 || curve.weights.length !== 5 || !sameArray(curve.knots, [0, 0, 0, .5, .5, 1, 1, 1])) return unsupported('native circular arcs need two complete quadratic Bezier spans.');
  return { ...curve, knots: [0, 0, 0, 1, 1, 1], controlPoints: curve.controlPoints.slice(2 * index, 2 * index + 3), weights: curve.weights.slice(2 * index, 2 * index + 3) };
}
function referenceCurve(curve: Curve, sign: 1 | -1, level: number): Curve {
  const points: XYZ[] = [];
  for (const p of curve.controlPoints) points.push([p[0], sign * p[1], level]);
  return { ...curve, controlPoints: points };
}
function atLevel(curve: Curve, axis: Axis, level: number): boolean {
  for (const p of curve.controlPoints) if (p[axis] !== level) return false;
  return true;
}
function circle(brep: Brep, selected: BrepFace, axis: Axis, sign: 1 | -1, coordinate: number, opposite: number): { center: XY; radius: number; bound: bigint } {
  if (brep.vertices.length !== 4 || brep.edges.length !== 6 || brep.faces.length !== 4 || brep.loops.length !== 4) return unsupported('only one unpartitioned native circular cylinder is supported.');
  const cap = selected.surface as Surface;
  const p = cap.controlPoints, j = (axis + 1) % 3, k = (axis + 2) % 3;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const row of p) for (const q of row) { x0 = Math.min(x0, q[j]); x1 = Math.max(x1, q[j]); y0 = Math.min(y0, q[k]); y1 = Math.max(y1, q[k]); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, radius = (x1 - x0) / 2;
  if (!(radius > 0) || radius !== (y1 - y0) / 2 || !finite(cx) || !finite(cy)) return unsupported('the native circular cap needs one finite circular bound.');
  const reference = brepFromPrismatic(prismaticFromProfile({ outer: [{ kind: 'arc', start: [cx + radius, zero(sign * cy)], center: [cx, zero(sign * cy)], direction: 'ccw' }], from: 0, height: 1, tag: 'offset_reference' }));
  let maximumBound = 0n;
  // Native half-arc seams can shift by a quarter turn under a cardinal frame. Match ALL four
  // exact knot-span leaves bijectively, including the opposite cap and the emitted signed frame.
  for (const level of [coordinate, opposite]) {
    const actual = [], expected = [];
    for (const edge of brep.edges) if (edge.curve.degree === 2 && atLevel(edge.curve, axis, level)) { actual.push(quarter(edge.curve, 0)); actual.push(quarter(edge.curve, 1)); }
    for (const edge of reference.edges) if (edge.curve.degree === 2 && atLevel(edge.curve, 2, 0)) { const mirrored = referenceCurve(edge.curve, sign, level); expected.push(quarter(mirrored, 0)); expected.push(quarter(mirrored, 1)); }
    if (actual.length !== 4 || expected.length !== 4) return unsupported('both native caps must cover all four canonical circular Bezier spans.');
    const used = new Set<number>();
    for (const curve of actual) {
      let found = -1, admitted = 0n;
      for (let i = 0; i < expected.length; i++) if (!used.has(i)) { const bound = curveBound(curve, expected[i], axis); if (bound !== null && bound <= exact(CadNumericPolicy.linearTolerance)) { found = i; admitted = bound; break; } }
      if (found < 0) return unsupported('the complete native circular quotient does not match the emitted circle within the existing linear policy.');
      used.add(found); if (admitted > maximumBound) maximumBound = admitted;
    }
  }
  let straight = 0;
  for (const edge of brep.edges) if (edge.curve.degree !== 2) {
    const a = vertexById(brep, edge.vertices[0])!.point, b = vertexById(brep, edge.vertices[1])!.point;
    if (!line(edge.curve, a, b) || a[j] !== b[j] || a[k] !== b[k] || a[axis] === b[axis]) return unsupported('native cylinder seams must be straight axial edges.');
    straight++;
  }
  if (straight !== 2) return unsupported('the native cylinder needs two axial seams.');
  let caps = 0, sides = 0;
  for (const face of brep.faces) {
    const boundary = ring(brep, face), s = face.surface as Surface;
    if (affine(s) && constantLevel(boundary, axis)) {
      caps++;
      if (boundary.length !== 2 || capAxis(face) !== axis) return unsupported('the native circular cap incidence is unsupported.');
      for (const row of s.controlPoints) for (const p of row) if (p[axis] !== boundary[0][axis]) return unsupported('a circular cap support leaves its native cap plane.');
      const orientation = crossSign(s.controlPoints[0][0] as XYZ, s.controlPoints[1][0] as XYZ, s.controlPoints[0][1] as XYZ, axis), outward = boundary[0][axis] === coordinate ? sign : -sign;
      if ((orientation > 0n ? 1 : -1) * (face.sense === 'forward' ? 1 : -1) !== outward) return unsupported('a circular cap has an inconsistent native outward sense.');
      continue;
    }
    sides++;
    if (boundary.length !== 4 || s.degreeU !== 2 || s.degreeV !== 1 || s.controlPoints.length !== 5 || s.controlPoints[0].length !== 2) return unsupported('the native cylinder sides must be paired ruled circular patches.');
    const base: Curve = { kind: 'curve', id: 'offset_side', degree: s.degreeU, knots: [...s.knotsU], controlPoints: [], weights: [] };
    for (let i = 0; i < s.controlPoints.length; i++) {
      const a = s.controlPoints[i][0], b = s.controlPoints[i][1];
      if (s.controlPoints[i].length !== 2 || a[axis] !== s.controlPoints[0][0][axis] || b[axis] !== s.controlPoints[0][1][axis] || a[axis] !== coordinate && a[axis] !== opposite || b[axis] !== coordinate && b[axis] !== opposite || a[axis] === b[axis] || a[j] !== b[j] || a[k] !== b[k] || !(s.weights[i][0] > 0) || s.weights[i][0] !== s.weights[i][1]) return unsupported('drafted or unequal-weight cylinder rulings are unsupported.');
      base.controlPoints.push([...a]); base.weights.push(s.weights[i][0]);
    }
    let matched = false;
    for (const edge of brep.edges) if (edge.curve.degree === 2) {
      const points: XYZ[] = []; for (const p of edge.curve.controlPoints) points.push(world(p, axis));
      const bound = curveBound(base, { ...edge.curve, controlPoints: points }, axis);
      if (bound === 0n) { matched = true; break; }
    }
    if (!matched) return unsupported('the cylinder support is not bound to its complete native cap curve.');
  }
  if (caps !== 2 || sides !== 2) return unsupported('the native cylinder must have exactly two caps and two ruled sides.');
  return { center: [cx, cy], radius, bound: maximumBound };
}

function sameArray(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
/** Consistency with a fresh current-doc display is a stale-pick check, not geometry authority or a revision certificate. */
function consistent(a: BodyResult, b: BodyResult): boolean {
  if (a.key !== b.key || a.mesh.faces.length !== b.mesh.faces.length || JSON.stringify(a.ref) !== JSON.stringify(b.ref)) return false;
  if (!sameArray(a.mesh.positions, b.mesh.positions) || !sameArray(a.mesh.indices, b.mesh.indices)) return false;
  for (let i = 0; i < a.mesh.faces.length; i++) {
    const x = a.mesh.faces[i], y = b.mesh.faces[i];
    if (x.id !== y.id || x.name !== y.name || x.kind !== y.kind || x.area !== y.area || !sameArray(x.normal, y.normal) || !sameArray(x.centroid, y.centroid) || JSON.stringify(x.exact) !== JSON.stringify(y.exact)) return false;
  }
  return true;
}
interface ResultWitness { candidate: WeakRef<StudioDoc>; content: string; refusal?: { message: string; details?: Record<string, unknown> } }
interface TargetWitness { next?: number; refusal?: { message: string; details?: Record<string, unknown> }; result?: ResultWitness }
interface Cached { content: string; profiles: Map<string, { body: BodyResult; profile: NativeOffsetFaceProfile; bound: bigint; target: TargetWitness }> }
const proofs = new WeakMap<NativeOffsetFaceProfile, { bound: bigint; snapshot: string; target: TargetWitness; source: string }>();
function freezeOwned(value: unknown): void {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freezeOwned(child); Object.freeze(value); }
}
function owned(profile: NativeOffsetFaceProfile, bound: bigint, target: TargetWitness, source: string): NativeOffsetFaceProfile {
  const copy = structuredClone(profile); freezeOwned(copy); proofs.set(copy, { bound, snapshot: canonical(copy), target, source }); return copy;
}
const cache = new WeakMap<StudioDoc, Cached>();
/** Current native semantic identity is resolved before qualification; every returned snapshot is owned. */
export function resolveNativeOffsetFace(ctx: Ctx): NativeOffsetFaceProfile {
  const selection = ctx.selection;
  if (selection.faces.length !== 1 || selection.edges.length || selection.bodies.length || selection.sketches?.length || selection.vertices?.length || ctx.direct?.length) return missing('pick exactly one current cap face.');
  const picked = selection.faces[0];
  if (!Number.isSafeInteger(picked.body) || !Number.isSafeInteger(picked.face) || picked.body < 0 || picked.face < 0) return missing('the picked face index is invalid.');
  const body = ctx.bodies[picked.body], display = body?.mesh.faces[picked.face];
  if (!body || !display || display.kind !== 'plane' || display.facet || !display.name || display.name.includes('+')) return missing('pick one unambiguous native planar cap.');
  let sameKeys = 0; for (const candidate of ctx.bodies) if (candidate.key === body.key) sameKeys++;
  if (sameKeys !== 1) return missing('the selected body identity is ambiguous.');
  const ref = refOf(body);
  if (!Number.isSafeInteger(ref.node) || ref.node < 0 || ref.node >= ctx.doc.nodes.length || bodyKeyFor(ctx.doc.nodes, ref.node, ref.side) !== body.key) return missing('the selected body reference is not current.');
  const content = canonical(modelContent(ctx.doc));
  let saved = cache.get(ctx.doc);
  if (!saved || saved.content !== content) { saved = { content, profiles: new Map() }; cache.set(ctx.doc, saved); }
  const key = `${body.key}\u0000${display.id}\u0000${display.name}\u0000${body.mesh.quality ?? 8}`, have = saved.profiles.get(key);
  if (have) {
    if (!consistent(body, have.body)) return missing('the picked display no longer agrees with the current document.');
    return owned(have.profile, have.bound, have.target, content);
  }
  const evaluated = evaluateDoc(ctx.doc, 0, body.mesh.quality ?? 8);
  if (!evaluated.ok) return missing('the current document cannot resolve the selected native body.');
  let current: BodyResult | undefined; for (const candidate of evaluated.bodies) if (candidate.key === body.key) { current = candidate; break; }
  if (!current || !consistent(body, current)) return missing('the picked display no longer agrees with the current document.');
  const bodies = partBreps(ctx.doc), matches: ReturnType<typeof partBreps> = [];
  for (const candidate of bodies) if (candidate.key === body.key) matches.push(candidate);
  if (matches.length !== 1) return missing('the selected native body is missing or ambiguous.');
  const brep = matches[0].brep, faces: BrepFace[] = [];
  for (const face of brep.faces) if (face.id === display.id && face.name === display.name) faces.push(face);
  if (faces.length !== 1) return missing('the selected native face is missing, merged, or ambiguous.');
  const selected = faces[0], axis = capAxis(selected), coordinate = (selected.surface as Surface).controlPoints[0][0][axis];
  let lo = Infinity, hi = -Infinity;
  for (const vertex of brep.vertices) { lo = Math.min(lo, vertex.point[axis]); hi = Math.max(hi, vertex.point[axis]); }
  if (!(hi > lo) || coordinate !== lo && coordinate !== hi) return unsupported('the selected plane is not an extreme native prism cap.');
  const sign = coordinate === hi ? 1 : -1, opposite = sign === 1 ? lo : hi;
  const surface = selected.surface as Surface, orientation = crossSign(surface.controlPoints[0][0] as XYZ, surface.controlPoints[1][0] as XYZ, surface.controlPoints[0][1] as XYZ, axis);
  if ((orientation > 0n ? 1 : -1) * (selected.sense === 'forward' ? 1 : -1) !== sign) return unsupported('the native cap sense does not point out of the solid.');
  // Bound the admitted topology before the native checker or circular reference producer does work.
  const selectedRing = ring(brep, selected), isCircle = selectedRing.length === 2;
  if (isCircle ? brep.vertices.length !== 4 || brep.edges.length !== 6 || brep.faces.length !== 4 : selectedRing.length < 3 || selectedRing.length > 16 || brep.vertices.length !== 2 * selectedRing.length || brep.edges.length !== 3 * selectedRing.length || brep.faces.length !== selectedRing.length + 2) return unsupported('the current native topology is outside the unpartitioned cap profile.');
  topology(brep);
  let sketch: SketchNode, footprint = 0n;
  if (isCircle) {
    const circleData = circle(brep, selected, axis, sign, coordinate, opposite); footprint = circleData.bound;
    sketch = { kind: 'sketch', profile: 'loop', segments: [{ kind: 'arc', start: [circleData.center[0] + circleData.radius, zero(sign * circleData.center[1])], center: [circleData.center[0], zero(sign * circleData.center[1])], direction: 'ccw' }], plane: frame(axis, sign, coordinate), on: { ...ref } };
  } else {
    const points = polygon(brep, selected, axis, sign, coordinate, opposite);
    const segments: Extract<SketchNode, { profile: 'loop' }>['segments'] = [];
    for (const start of points) segments.push({ kind: 'line', start: [...start] as XY });
    sketch = { kind: 'sketch', profile: 'loop', segments, plane: frame(axis, sign, coordinate), on: { ...ref } };
  }
  const profile: NativeOffsetFaceProfile = { sketch, kind: isCircle ? 'circle' : 'polygon', axis, sign, coordinate, opposite, thickness: Math.abs(coordinate - opposite) };
  const target: TargetWitness = {};
  saved.profiles.set(key, { body: structuredClone(current), profile, bound: footprint, target });
  return owned(profile, footprint, target, content);
}

/** Check the complete prospective remaining prism with the native producer and its existing strict
 * validity policy. This is not a tool check: its actual end levels are opposite and the stored next cap.
 * No new minimum thickness or sliver tolerance is introduced. */
function validateRemainingTarget(profile: NativeOffsetFaceProfile, next: number, witness: TargetWitness): void {
  if (witness.next === next) { if (witness.refusal) throw refusal('FACE_DISTANCE', witness.refusal.message, structuredClone(witness.refusal.details)); return; }
  if (profile.sketch.profile !== 'loop') throw refusal('FACE_DISTANCE', 'The owned native cap has no loop profile.');
  const outer: Parameters<typeof prismaticFromProfile>[0]['outer'][number][] = [];
  for (const segment of profile.sketch.segments) {
    const start: XY = [Number(segment.start[0]), profile.sign * Number(segment.start[1])];
    if (segment.kind === 'line') outer.push({ kind: 'line', start });
    else outer.push({ kind: 'arc', start, center: [Number(segment.center[0]), profile.sign * Number(segment.center[1])], direction: profile.sign === 1 ? segment.direction : segment.direction === 'ccw' ? 'cw' : 'ccw' });
  }
  const lo = Math.min(profile.opposite, next), hi = Math.max(profile.opposite, next);
  try {
    // The existing producer owns the bounded section. Bind its PUBLIC explicit slab endpoint
    // input directly; reconstructing hi as lo+(hi-lo) can change even an ordinary cap by one ulp.
    // No native boundary pole is edited and the SAME exact interval reaches B-rep and mass.
    const unit = prismaticFromProfile({ outer, from: 0, height: 1, tag: 'offset_target' });
    if (unit.slabs.length !== 1 || unit.slabs[0].z0 !== 0 || unit.slabs[0].z1 !== 1 || unit.slabs[0].regions.length !== 1 || unit.slabs[0].regions[0].holes.length || unit.caps?.length !== 2) throw refusal('FACE_DISTANCE', 'The native section producer did not retain one bounded material region.');
    const caps: NonNullable<typeof unit.caps>[number][] = []; let bottom = false, top = false;
    for (const cap of unit.caps) {
      if (cap.z !== 0 && cap.z !== 1) throw refusal('FACE_DISTANCE', 'The native section producer has an unexpected cap source.');
      if (cap.z === 0) bottom = true; else top = true;
      caps.push({ ...cap, z: cap.z === 0 ? lo : hi });
    }
    if (!bottom || !top) throw refusal('FACE_DISTANCE', 'The native section producer must retain both cap sources.');
    const solid = { ...unit, slabs: [{ ...unit.slabs[0], z0: lo, z1: hi }], caps };
    const matrix: [number, number, number, number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    matrix[((profile.axis + 1) % 3) * 3] = 1; matrix[((profile.axis + 2) % 3) * 3 + 1] = 1; matrix[profile.axis * 3 + 2] = 1;
    const target = transformBrep(brepFromPrismatic(solid), { matrix });
    if (target.bodies.length !== 1 || target.bodies[0].kind !== 'solid' || target.shells.length !== 1 || !target.shells[0].closed) throw refusal('FACE_DISTANCE', 'The offset must leave one native closed solid.');
    let lower = false, upper = false;
    for (const vertex of target.vertices) {
      if (vertex.point[profile.axis] === lo) lower = true;
      else if (vertex.point[profile.axis] === hi) upper = true;
      else throw refusal('FACE_DISTANCE', 'The prospective native target does not bind to the stored cap levels.');
    }
    if (!lower || !upper) throw refusal('FACE_DISTANCE', 'The prospective native target collapsed a stored cap level.');
    for (const edge of target.edges) {
      const a = vertexById(target, edge.vertices[0])!.point, b = vertexById(target, edge.vertices[1])!.point;
      for (const p of edge.curve.controlPoints) if (p[profile.axis] !== lo && p[profile.axis] !== hi) throw refusal('FACE_DISTANCE', 'A prospective native edge leaves the stored target cap levels.');
      if (a[profile.axis] === b[profile.axis] && !atLevel(edge.curve, profile.axis, a[profile.axis])) throw refusal('FACE_DISTANCE', 'A complete prospective cap curve leaves its native plane.');
    }
    for (const face of target.faces) {
      if (face.surface.kind !== 'surface') throw refusal('FACE_DISTANCE', 'The prospective native target must retain parametric supports.');
      const boundary = ring(target, face), cap = constantLevel(boundary, profile.axis);
      for (const row of face.surface.controlPoints) for (const p of row) if (p[profile.axis] !== lo && p[profile.axis] !== hi || cap && p[profile.axis] !== boundary[0][profile.axis]) throw refusal('FACE_DISTANCE', 'A prospective native support leaves its target cap binding.');
    }
    const report = checkBrep(target, { strict: true });
    if (!report.valid) throw refusal('FACE_DISTANCE', 'The offset leaves a target that fails native strict validity.', { issues: [...report.issues] });
    // A positive target interval alone does not certify the existing closed-form integrals.
    // Their normal centroid must lie in that SAME interval and bind its exact midpoint under
    // the unchanged linear policy; this adds no minimum thickness or new integration method.
    const mass = prismaticMassProperties(solid, 1), center = mass.centroid[2];
    if (!(mass.volume > 0) || !Number.isFinite(mass.volume) || !Number.isFinite(center) || center < lo || center > hi
      || abs(2n * exact(center) - exact(lo) - exact(hi)) > 2n * exact(CadNumericPolicy.linearTolerance)) throw refusal('FACE_DISTANCE', 'The remaining target mass centroid cannot bind its native cap interval.');
    witness.next = next; delete witness.refusal;
  } catch (cause) {
    const error = cause && typeof cause === 'object' && 'code' in cause && cause.code === 'FACE_DISTANCE' ? cause : refusal('FACE_DISTANCE', 'The native producer cannot validate the remaining target.', { cause: cause instanceof Error ? cause.message : String(cause) });
    const typed = error as ReturnType<typeof refusal>;
    witness.next = next; witness.refusal = { message: typed.message.replace(/^\[FACE_DISTANCE\] /, ''), details: structuredClone(typed.details) };
    throw error;
  }
}

/** One represented cap addition, checked against its exact binary64 sum under the existing linear policy. */
export function validateNativeOffsetDistance(profile: NativeOffsetFaceProfile, distance: number): void {
  if (typeof distance !== 'number' || !Number.isFinite(distance) || Math.abs(distance) > CadPartLimits.length || distance === 0) throw refusal('FACE_DISTANCE', 'Give the face a distance to move: a finite nonzero value within the modeling range.');
  const proof = proofs.get(profile);
  if (!proof || canonical(profile) !== proof.snapshot) throw refusal('FACE_DISTANCE', 'Resolve an unchanged owned native cap before checking its distance.');
  const { coordinate, opposite, sign } = profile, next = coordinate + sign * distance;
  if (!finite(next) || next === coordinate) throw refusal('FACE_DISTANCE', 'The offset must produce a finite, distinct native cap coordinate.');
  const intended = exact(coordinate) + BigInt(sign) * exact(distance), other = exact(opposite);
  if (BigInt(sign) * (intended - other) <= 0n || BigInt(sign) * (exact(next) - other) <= 0n) throw refusal('FACE_DISTANCE', 'The offset must leave positive prism thickness before the opposite cap.');
  if (abs(exact(next) - intended) + proof.bound > exact(CadNumericPolicy.linearTolerance)) throw refusal('FACE_DISTANCE', 'The rounded cap coordinate exceeds the existing linear policy.');
  validateRemainingTarget(profile, next, proof.target);
}


const resultFailure = (message: string): never => { throw refusal('FACE_DISTANCE', `Offset result: ${message}`); };
function withoutId(value: object): object { const copy = { ...value } as Record<string, unknown>; delete copy.id; return copy; }
/** Validate the ACTUAL shared Offset composition before it can be returned to any caller.
 * The prospective target remains an admission witness; it does not certify a Boolean result. */
export function validateNativeOffsetResult(ctx: Ctx, candidate: StudioDoc, profile: NativeOffsetFaceProfile, distance: number): void {
  validateNativeOffsetDistance(profile, distance);
  const proof = proofs.get(profile)!;
  if (canonical(modelContent(ctx.doc)) !== proof.source) return resultFailure('the source document no longer matches the owned cap.');
  const base = ctx.doc.nodes.length, last = candidate.nodes.length - 1, parent = profile.sketch.on;
  if (!parent || candidate.nodes.length !== base + 3 || canonical(candidate.nodes.slice(0, base)) !== canonical(withIds(ctx.doc).nodes)) return resultFailure('the candidate must retain the source prefix and the three shared composition nodes.');
  const sourceContent = modelContent(ctx.doc), candidateContent = modelContent(candidate);
  candidateContent.nodes = sourceContent.nodes; candidateContent.outputs = sourceContent.outputs;
  const expectedOutputs: StudioDoc['outputs'] = {};
  for (const ref of leafBodies(candidate.nodes)) expectedOutputs[bodyKeyFor(candidate.nodes, ref.node, ref.side)] = ref;
  if (canonical(candidateContent) !== canonical(sourceContent) || canonical(candidate.outputs) !== canonical(expectedOutputs)) return resultFailure('the candidate changed source inputs or omitted its current target output.');
  const sketch = candidate.nodes[base], tool = candidate.nodes[base + 1], operation = candidate.nodes[last];
  if (canonical(withoutId(sketch)) !== canonical(profile.sketch)) return resultFailure('the authored footprint is not the owned native cap snapshot.');
  const height = Math.abs(distance), expectedTool = distance < 0 ? { kind: 'extrude', sketch: base, height, from: -height } : { kind: 'extrude', sketch: base, height };
  const toolRef = { node: base + 1, side: 'solid' }, expectedOperation = distance > 0 ? { kind: 'union', left: parent, right: toolRef } : { kind: 'difference', parent, tool: toolRef };
  if (canonical(withoutId(tool)) !== canonical(expectedTool) || canonical(withoutId(operation)) !== canonical(expectedOperation)) return resultFailure('the last Boolean must consume the selected source and the requested cap tool.');
  const sourceKey = bodyKeyFor(ctx.doc.nodes, parent.node, parent.side), targetKey = bodyKeyFor(candidate.nodes, last), sourceMatches = [];
  for (const body of ctx.bodies) if (body.key === sourceKey) sourceMatches.push(body);
  if (sourceMatches.length !== 1) return resultFailure('the selected source body is missing or ambiguous.');
  const content = canonical(modelContent(candidate)), have = proof.target.result;
  if (have?.candidate.deref() === candidate && have.content === content) { if (have.refusal) throw refusal('FACE_DISTANCE', have.refusal.message, structuredClone(have.refusal.details)); return; }
  const witness: ResultWitness = { candidate: new WeakRef(candidate), content }; proof.target.result = witness;
  try {
    const evaluated = evaluateDoc(candidate, 0, sourceMatches[0].mesh.quality ?? 8);
    if (!evaluated.ok) return resultFailure('the actual candidate cannot be evaluated.');
    let model: BodyResult | undefined, count = 0;
    for (const body of evaluated.bodies) if (body.key === targetKey) { model = body; count++; }
    const outputs = partBreps(candidate); let native: Brep | undefined, nativeCount = 0;
    for (const output of outputs) if (output.key === targetKey) { native = output.brep; nativeCount++; }
    if (count !== 1 || !model || nativeCount !== 1 || !native || model.ref?.node !== last || model.ref.side !== 'solid') return resultFailure('the requested last-node target is empty, missing, or ambiguous; another body cannot replace it.');
    if (native.bodies.length !== 1 || native.bodies[0].kind !== 'solid' || native.bodies[0].shells.length !== 1 || native.shells.length !== 1 || !native.shells[0].closed) return resultFailure('the actual target must be one native closed solid.');
    const report = checkBrep(native, { strict: true });
    if (!report.valid) throw refusal('FACE_DISTANCE', 'Offset result: the actual target fails native strict validity.', { issues: [...report.issues] });
    const { axis, sign, coordinate, opposite } = profile, next = coordinate + sign * distance, lo = Math.min(next, opposite), hi = Math.max(next, opposite);
    let normalMin = Infinity, normalMax = -Infinity;
    const actualMin: XY = [Infinity, Infinity], actualMax: XY = [-Infinity, -Infinity];
    for (const vertex of native.vertices) {
      const value = vertex.point[axis]; if (!Number.isFinite(value) || value < lo || value > hi) return resultFailure('a native target vertex leaves the intended stored interval.');
      normalMin = Math.min(normalMin, value); normalMax = Math.max(normalMax, value);
    }
    if (!(normalMax > normalMin)) return resultFailure('the actual target vertices collapsed their positive normal interval.');
    for (const edge of native.edges) {
      for (const weight of edge.curve.weights) if (!(weight > 0) || !Number.isFinite(weight)) return resultFailure('the actual target boundary needs finite positive native weights.');
      for (const point of edge.curve.controlPoints) {
        if (!finite(point[axis]) || point[axis] < lo || point[axis] > hi) return resultFailure('a complete native boundary curve leaves the intended stored interval.');
        for (let k = 0; k < 2; k++) { const value = point[(axis + 1 + k) % 3]; if (!finite(value)) return resultFailure('a native target boundary coordinate is invalid.'); actualMin[k] = Math.min(actualMin[k], value); actualMax[k] = Math.max(actualMax[k], value); }
      }
    }
    let lowerCap = false, upperCap = false, nativeCapBound = 0n;
    for (const face of native.faces) {
      const surface = face.surface;
      if (surface.kind !== 'surface') return resultFailure('the actual target must retain native parametric supports.');
      // A trimmed side may retain an unused extended support. Its material is bounded by
      // native loops above, not by that support's full pole range. Only actual cap planes bind here.
      if (!affine(surface)) continue;
      const plane = surface.controlPoints[0][0][axis]; let constant = true;
      for (const row of surface.controlPoints) for (const point of row) if (point[axis] !== plane) constant = false;
      if (!constant) continue;
      if (!finite(plane) || plane < lo || plane > hi) return resultFailure('an actual cap support leaves the intended stored interval.');
      const orientation = crossSign(surface.controlPoints[0][0] as XYZ, surface.controlPoints[1][0] as XYZ, surface.controlPoints[0][1] as XYZ, axis);
      if (orientation === 0n) return resultFailure('an actual cap support is degenerate.');
      const outward = (orientation > 0n ? 1 : -1) * (face.sense === 'forward' ? 1 : -1), level = outward > 0 ? hi : lo;
      if (plane !== level) return resultFailure('both actual cap support planes must retain their intended stored levels.');
      let bound = abs(exact(plane) - exact(level));
      for (const id of face.loops) {
        const loop = loopById(native, id); if (!loop) return resultFailure('an actual cap boundary is missing.');
        for (const cid of loop.coedges) {
          const coedge = coedgeById(native, cid), edge = coedge && edgeById(native, coedge.edge); if (!edge) return resultFailure('an actual cap edge is missing.');
          for (const point of edge.curve.controlPoints) { const error = abs(exact(point[axis]) - exact(level)); if (error > bound) bound = error; }
        }
      }
      if (bound > nativeCapBound) nativeCapBound = bound;
      if (outward > 0) upperCap = true; else lowerCap = true;
    }
    if (!lowerCap || !upperCap) return resultFailure('the actual composition must retain both complete native cap supports.');
    // This is a bounded axis-extent check, not a generic material or curved-mass certificate.
    const expectedMin: XY = [Infinity, Infinity], expectedMax: XY = [-Infinity, -Infinity];
    if (profile.sketch.profile !== 'loop') return resultFailure('the owned footprint has no loop.');
    if (profile.kind === 'circle') {
      const segment = profile.sketch.segments[0]; if (segment.kind !== 'arc') return resultFailure('the owned circle arc is missing.');
      const center: XY = [Number(segment.center[0]), sign * Number(segment.center[1])], radius = Math.abs(Number(segment.start[0]) - center[0]);
      for (let k = 0; k < 2; k++) { expectedMin[k] = center[k] - radius; expectedMax[k] = center[k] + radius; }
    } else for (const segment of profile.sketch.segments) {
      const point: XY = [Number(segment.start[0]), sign * Number(segment.start[1])];
      for (let k = 0; k < 2; k++) { expectedMin[k] = Math.min(expectedMin[k], point[k]); expectedMax[k] = Math.max(expectedMax[k], point[k]); }
    }
    let extentBound = 0n;
    for (let k = 0; k < 2; k++) { const a = abs(exact(actualMin[k]) - exact(expectedMin[k])), b = abs(exact(actualMax[k]) - exact(expectedMax[k])); extentBound += a > b ? a : b; }
    const capBound = abs(exact(next) - exact(coordinate) - BigInt(sign) * exact(distance));
    if (extentBound + nativeCapBound + proof.bound + capBound > exact(CadNumericPolicy.linearTolerance)) return resultFailure('the actual native footprint extents exceed the existing joint binding policy.');
    const mass = model.massRef === undefined ? model : massOfRef(model.massRef, model.massPlace ?? []);
    if (!mass || !(mass.volume !== null && mass.volume > 0) || !Number.isFinite(mass.volume) || !mass.centroid) return resultFailure('the actual Model mass provider has no finite positive target mass.');
    for (const value of mass.centroid) if (!Number.isFinite(value)) return resultFailure('the actual Model mass centroid is nonfinite.');
    const center = mass.centroid[axis];
    if (center < lo || center > hi || abs(2n * exact(center) - exact(lo) - exact(hi)) > 2n * exact(CadNumericPolicy.linearTolerance)) return resultFailure('the actual Model mass centroid does not bind the stored target interval.');
  } catch (cause) {
    const error = cause && typeof cause === 'object' && 'code' in cause && cause.code === 'FACE_DISTANCE' ? cause : refusal('FACE_DISTANCE', 'Offset result: actual native target validation failed.', { cause: cause instanceof Error ? cause.message : String(cause) });
    const typed = error as ReturnType<typeof refusal>; witness.refusal = { message: typed.message.replace(/^\[FACE_DISTANCE\] /, ''), details: structuredClone(typed.details) }; throw error;
  }
}
