import { checkBrep, type Brep, type BrepFace, type BrepVertex, type BrepEdge, type BrepCoedge, type BrepLoop } from '../brep/brep-core.js';
import { booleanPolygons, exactOrient2, exactPoint2FromXY, isPlanarArrangementError, type ExactPoint2, type PolygonWithHoles } from '../brep/planar-arrangement.js';
import { booleanCurveRegions, curveTolerance, type CurveRegion2, type CurveSegment2, type XY } from '../brep/curved-arrangement.js';
import { prismaticMassProperties } from '../brep/solid-mass.js';
import { CadNumericPolicy, linearToleranceMM } from '../numeric-policy.js';
import { binary64Dyadic } from '../core/dyadic.js';
import { SectionRationalContext, type SectionRational } from '../section-rational-internal.js';
import { buildProfileLoop, ExtrudedProfileLimits, type ProfileSegmentInput } from './extruded-profile-solid.js';
import { brepFromPrismatic, prismaticFromProfile, prismaticVolume, type PrismaticCapSource, type PrismaticSolid } from './prismatic-solid.js';
import type { Point } from '../types.js';
import type { CadPartErrorCode } from '../part/part-model.js';

/** Internal native geometry only. Font parsing and source text remain in cad-model. */
export interface ReliefSketch {
  readonly outer: readonly ProfileSegmentInput[];
  readonly holes?: readonly (readonly ProfileSegmentInput[])[];
  readonly regions?: readonly (readonly ProfileSegmentInput[])[];
  readonly frame?: { readonly m: readonly number[]; readonly o: Point };
}
type Fail = (code: CadPartErrorCode, detail: string) => never;
type Line = Extract<CurveSegment2, { kind: 'line' }>;
type R = SectionRational;
type RV = readonly [R, R, R];
type IV = readonly [bigint, bigint, bigint];
interface IntegerFrame { denominator: bigint; points: WeakMap<readonly number[], IV> }
interface BoundaryLine { a: XY; b: XY }
interface Interval { lo: number; hi: number }
interface Component { polygon: PolygonWithHoles; outer: ProfileSegmentInput[]; holes: ProfileSegmentInput[][]; area: R }
interface Audit { volume: R; reported: number; error: R }
interface BrepIndex { vertices: Map<string, BrepVertex>; edges: Map<string, BrepEdge>; coedges: Map<string, BrepCoedge>; loops: Map<string, BrepLoop> }
const MAX_COMPONENTS = 64, MAX_LOOP = 1024, MAX_EDGES = 4096, MAX_WORK = 1048576, MAX_EXACT_WORK = 2000000;
const ROUND = 64 * Number.EPSILON;
const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];

class Context {
  edges = 0; work = 0; exactWork = 0;
  readonly breps = new WeakMap<Brep, BrepIndex>();
  readonly points = new WeakMap<XY, ExactPoint2>();
  readonly q: SectionRationalContext;
  readonly exactFailure = (kind: 'BUDGET' | 'REPRESENTABILITY', detail: string): never => this.fail(kind === 'BUDGET' ? 'INPUT' : 'GEOMETRY', `profile relief: ${detail}`);
  constructor(readonly fail: Fail) { this.q = new SectionRationalContext(this.exactFailure); }
  charge(work: number): void {
    if (!Number.isSafeInteger(work) || work < 0 || (this.work += work) > MAX_WORK) this.fail('INPUT', 'profile relief exceeds its boundary/Boolean work budget');
  }
  count(n: number): void { if ((this.edges += n) > MAX_EDGES) this.fail('INPUT', 'profile relief exceeds 4096 total source, cap and profile edges'); }
  finish(q: SectionRationalContext): void {
    this.exactWork += q.counts().operations;
    if (this.exactWork > MAX_EXACT_WORK) this.fail('INPUT', 'profile relief exceeds its aggregate exact-arithmetic budget');
  }
}
function lines(polygon: PolygonWithHoles): XY[][] { return [polygon.outer as XY[], ...polygon.holes as XY[][]]; }
function edgeCount(polygon: PolygonWithHoles): number { let count = polygon.outer.length; for (const hole of polygon.holes) count += hole.length; return count; }
function copied(point: readonly number[], ctx: Context): XY {
  if (point.length !== 2 || !Number.isFinite(point[0]) || !Number.isFinite(point[1]) || Math.abs(point[0]) > CadNumericPolicy.coordinateAbs || Math.abs(point[1]) > CadNumericPolicy.coordinateAbs) ctx.fail('INPUT', 'profile relief needs finite XY coordinates within the CAD range');
  return [point[0], point[1]];
}
function area(q: SectionRationalContext, polygon: PolygonWithHoles, ctx: Context): R {
  // Binary64 points have power-of-two homogeneous denominators. Sum at one scale,
  // then reduce once, preserving the exact signed area without repeated rational GCDs.
  let denominator = 1n, sum = 0n;
  for (const ring of lines(polygon)) for (const point of ring) {
    ctx.charge(1);
    const p = exactPoint(point, ctx); if (p.w > denominator) denominator = p.w;
  }
  for (const ring of lines(polygon)) for (let i = 0; i < ring.length; i++) {
    ctx.charge(1);
    const a = exactPoint(ring[i], ctx), b = exactPoint(ring[(i + 1) % ring.length], ctx);
    const scaleA = denominator / a.w, scaleB = denominator / b.w;
    sum += (a.x * b.y - b.x * a.y) * scaleA * scaleB;
  }
  return q.rat(sum, 2n * denominator * denominator);
}

function reverseIf(ring: XY[], positive: boolean, ctx: Context): XY[] {
  const signed = area(ctx.q, { outer: ring, holes: [] }, ctx);
  if (signed.n === 0n) ctx.fail('GEOMETRY', 'profile relief boundary encloses no area');
  return (signed.n > 0n) === positive ? ring : [...ring].reverse();
}
function fromRegion(region: CurveRegion2, ctx: Context): PolygonWithHoles {
  const rings: XY[][] = [];
  for (const loop of [region.outer, ...region.holes]) {
    if (loop.length < 3 || loop.length > MAX_LOOP) ctx.fail('INPUT', 'profile relief source/cap boundary exceeds native loop admission');
    const ring: XY[] = [];
    for (let i = 0; i < loop.length; i++) {
      const s = loop[i], next = loop[(i + 1) % loop.length];
      if (s.kind !== 'line' || next.kind !== 'line') ctx.fail('CAPABILITY', 'profile relief requires line-only upright geometry');
      const line = s as Line, following = next as Line;
      if (line.b[0] !== following.a[0] || line.b[1] !== following.a[1]) ctx.fail('GEOMETRY', 'profile relief source boundary is not exactly closed');
      ring.push(copied(line.a, ctx));
    }
    ctx.count(ring.length); rings.push(reverseIf(ring, rings.length === 0, ctx));
  }
  return { outer: rings[0], holes: rings.slice(1) };
}
function arrangementInput(polygons: readonly PolygonWithHoles[], ctx: Context): void {
  // The reused arrangement normalizes ring direction with a floating shoelace sum.
  for (const polygon of polygons) for (const ring of lines(polygon)) {
    let signed = 0;
    for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; signed += a[0] * b[1] - b[0] * a[1]; }
    const exact = area(ctx.q, { outer: ring, holes: [] }, ctx);
    if (!Number.isFinite(signed) || signed === 0 || (signed > 0) !== (exact.n > 0n)) ctx.fail('GEOMETRY', 'profile relief cannot preserve arrangement winding at the stored coordinate scale');
  }
}
function exactBoolean(a: readonly PolygonWithHoles[], b: readonly PolygonWithHoles[], operation: 'difference' | 'intersection', ctx: Context): PolygonWithHoles[] {
  arrangementInput(a, ctx); arrangementInput(b, ctx);
  let n = 0; for (const p of a) n += edgeCount(p); for (const p of b) n += edgeCount(p);
  ctx.charge(n * n);
  try { return booleanPolygons(a, b, operation); }
  catch (error) { if (isPlanarArrangementError(error)) ctx.fail('GEOMETRY', error.message); throw error; }
}
function xyVector(q: SectionRationalContext, a: XY, b: XY): readonly [R, R] { return [q.sub(q.from(b[0]), q.from(a[0])), q.sub(q.from(b[1]), q.from(a[1]))]; }
function dot2(q: SectionRationalContext, a: readonly [R, R], b: readonly [R, R]): R { return q.add(q.mul(a[0], b[0]), q.mul(a[1], b[1])); }
function exactPoint(point: XY, ctx: Context): ExactPoint2 {
  let value = ctx.points.get(point);
  if (!value) { value = exactPoint2FromXY(point); ctx.points.set(point, value); }
  return value;
}
function orient(ctx: Context, a: XY, b: XY, c: XY): number {
  // Reuse the arrangement's exact homogeneous predicate under the boundary-work budget.
  // Finite admitted binary64 coordinates bound each cached integer and its fixed-size determinant.
  ctx.charge(1);
  return exactOrient2(exactPoint(a, ctx), exactPoint(b, ctx), exactPoint(c, ctx));
}

function inRing(point: XY, ring: readonly XY[], ctx: Context): boolean {
  let winding = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length]; ctx.charge(1);
    if (a[1] <= point[1] && b[1] > point[1] && orient(ctx, a, b, point) > 0) winding++;
    else if (b[1] <= point[1] && a[1] > point[1] && orient(ctx, a, b, point) < 0) winding--;
  }
  return winding !== 0;
}
function inPolygon(point: XY, polygon: PolygonWithHoles, ctx: Context): boolean {
  if (!inRing(point, polygon.outer, ctx)) return false;
  for (const hole of polygon.holes) if (inRing(point, hole, ctx)) return false;
  return true;
}
function inside(part: PolygonWithHoles, domain: readonly PolygonWithHoles[], ctx: Context): boolean {
  // Boundary separation is required before this check. One connected ink region cannot cross a domain ring.
  let enclosed = false;
  for (const polygon of domain) {
    if (inPolygon(part.outer[0], polygon, ctx)) enclosed = true;
    for (const hole of polygon.holes) if (inPolygon(hole[0], part, ctx)) return false;
  }
  return enclosed;
}
function pointDistanceSquared(q: SectionRationalContext, p: XY, a: XY, b: XY): R {
  const v = xyVector(q, a, b), w = xyVector(q, a, p), vv = dot2(q, v, v), projection = dot2(q, w, v);
  if (vv.n === 0n || projection.n <= 0n) return dot2(q, w, w);
  if (q.compare(projection, vv) >= 0) { const end = xyVector(q, b, p); return dot2(q, end, end); }
  return q.sub(dot2(q, w, w), q.div(q.mul(projection, projection), vv));
}
function separated(a: XY, b: XY, c: XY, d: XY, margin: number, ctx: Context): boolean {
  ctx.charge(1);
  const scale = Math.max(1, Math.abs(a[0]), Math.abs(a[1]), Math.abs(b[0]), Math.abs(b[1]), Math.abs(c[0]), Math.abs(c[1]), Math.abs(d[0]), Math.abs(d[1]));
  const pad = margin + ROUND * scale;
  if (Math.min(a[0], b[0]) - Math.max(c[0], d[0]) > pad || Math.min(c[0], d[0]) - Math.max(a[0], b[0]) > pad
    || Math.min(a[1], b[1]) - Math.max(c[1], d[1]) > pad || Math.min(c[1], d[1]) - Math.max(a[1], b[1]) > pad) return true;
  const q = ctx.q, crossing = orient(ctx, a, b, c) * orient(ctx, a, b, d) <= 0 && orient(ctx, c, d, a) * orient(ctx, c, d, b) <= 0;
  const disjointBox = Math.max(a[0], b[0]) < Math.min(c[0], d[0]) || Math.max(c[0], d[0]) < Math.min(a[0], b[0])
    || Math.max(a[1], b[1]) < Math.min(c[1], d[1]) || Math.max(c[1], d[1]) < Math.min(a[1], b[1]);
  if (crossing && !disjointBox) return false;
  const threshold = q.mul(q.from(margin), q.from(margin));
  return q.compare(pointDistanceSquared(q, a, c, d), threshold) > 0 && q.compare(pointDistanceSquared(q, b, c, d), threshold) > 0
    && q.compare(pointDistanceSquared(q, c, a, b), threshold) > 0 && q.compare(pointDistanceSquared(q, d, a, b), threshold) > 0;
}
function boundariesApart(a: PolygonWithHoles, b: PolygonWithHoles, margin: number, ctx: Context): boolean {
  for (const x of lines(a)) for (const y of lines(b)) for (let i = 0; i < x.length; i++) for (let j = 0; j < y.length; j++)
    if (!separated(x[i], x[(i + 1) % x.length], y[j], y[(j + 1) % y.length], margin, ctx)) return false;
  return true;
}
function simple(ring: XY[], tolerance: number, ctx: Context): void {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], c = ring[(i + 2) % ring.length];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < ExtrudedProfileLimits.minimumLengthMM) ctx.fail('GEOMETRY', 'profile relief has a short native edge');
    if (orient(ctx, a, b, c) === 0) {
      const ab = xyVector(ctx.q, b, a), cb = xyVector(ctx.q, b, c);
      if (dot2(ctx.q, ab, cb).n >= 0n) ctx.fail('GEOMETRY', 'profile relief has a retracing adjacent boundary');
    }
    for (let j = i + 2; j < ring.length; j++) {
      if (i === 0 && j === ring.length - 1) continue;
      if (!separated(a, b, ring[j], ring[(j + 1) % ring.length], tolerance, ctx)) ctx.fail('GEOMETRY', 'profile relief has a crossing, touching or unresolved profile boundary');
    }
  }
}
function profileLoop(input: readonly ProfileSegmentInput[], offset: readonly number[], positive: boolean, tolerance: number, ctx: Context): { ring: XY[]; segments: ProfileSegmentInput[] } {
  if (!Array.isArray(input) || input.length > MAX_LOOP) ctx.fail('INPUT', 'profile relief needs 3..1024 line edges per loop');
  ctx.count(input.length);
  const shifted: ProfileSegmentInput[] = [];
  for (const segment of input) {
    if (segment.kind !== 'line') ctx.fail('CAPABILITY', 'profile relief takes line-only XY sketches');
    const start = copied([(segment.start[0] as number) + offset[0], (segment.start[1] as number) + offset[1]], ctx);
    shifted.push({ kind: 'line', start });
  }
  if (shifted.length < 3) ctx.fail('INPUT', 'profile relief needs 3..1024 line edges per loop');
  const built = buildProfileLoop(shifted, { maximumSegments: MAX_LOOP }), points: XY[] = [];
  for (const segment of built.segments) points.push([segment.start[0], segment.start[1]]);
  const ring = reverseIf(points, positive, ctx), segments: ProfileSegmentInput[] = [];
  simple(ring, tolerance, ctx);
  for (const start of ring) segments.push({ kind: 'line', start });
  return { ring, segments };
}
function component(sketch: ReliefSketch, tolerance: number, ctx: Context): Component {
  if (sketch.regions?.length) ctx.fail('CAPABILITY', 'profile relief requires one outer loop per component sketch');
  const offset: readonly number[] = sketch.frame?.o ?? [0, 0, 0];
  if (sketch.frame) {
    if (offset[2] !== 0 || sketch.frame.m.length !== 9) ctx.fail('CAPABILITY', 'profile relief sketch frames must be XY translations at Z zero');
    for (let i = 0; i < 9; i++) if (sketch.frame.m[i] !== IDENTITY[i]) ctx.fail('CAPABILITY', 'profile relief sketch frames must be XY translations at Z zero');
  }
  if (sketch.holes && (!Array.isArray(sketch.holes) || sketch.holes.length > MAX_COMPONENTS)) ctx.fail('INPUT', 'profile relief exceeds the native hole-loop budget');
  const outer = profileLoop(sketch.outer, offset, true, tolerance, ctx), holes: XY[][] = [], holeSegments: ProfileSegmentInput[][] = [];
  for (const input of sketch.holes ?? []) {
    const hole = profileLoop(input, offset, false, tolerance, ctx), polygon = { outer: hole.ring, holes: [] };
    if (exactBoolean([polygon], [{ outer: outer.ring, holes: [] }], 'difference', ctx).length || !boundariesApart(polygon, { outer: outer.ring, holes: [] }, tolerance, ctx) || !inRing(polygon.outer[0], outer.ring, ctx)) ctx.fail('GEOMETRY', 'profile relief holes must be strictly inside their outer boundary');
    for (const prior of holes) if (exactBoolean([polygon], [{ outer: prior, holes: [] }], 'intersection', ctx).length || !boundariesApart(polygon, { outer: prior, holes: [] }, tolerance, ctx) || inRing(polygon.outer[0], prior, ctx) || inRing(prior[0], polygon.outer, ctx)) ctx.fail('GEOMETRY', 'profile relief holes must not overlap, nest or touch');
    holes.push(hole.ring); holeSegments.push(hole.segments);
  }
  const polygon = { outer: outer.ring, holes }, value = area(ctx.q, polygon, ctx);
  if (value.n <= 0n) ctx.fail('GEOMETRY', 'profile relief needs positive material area in every component');
  return { polygon, outer: outer.segments, holes: holeSegments, area: value };
}
function vector(q: SectionRationalContext, p: readonly number[]): RV { return [q.from(p[0]), q.from(p[1]), q.from(p[2])]; }
function subtract(q: SectionRationalContext, a: RV, b: RV): RV { return [q.sub(a[0], b[0]), q.sub(a[1], b[1]), q.sub(a[2], b[2])]; }
function cross(q: SectionRationalContext, a: RV, b: RV): RV { return [q.sub(q.mul(a[1], b[2]), q.mul(a[2], b[1])), q.sub(q.mul(a[2], b[0]), q.mul(a[0], b[2])), q.sub(q.mul(a[0], b[1]), q.mul(a[1], b[0]))]; }
function zero(a: RV): boolean { return a[0].n === 0n && a[1].n === 0n && a[2].n === 0n; }
function affineSurface(face: BrepFace, ctx: Context): Exclude<BrepFace['surface'], { kind: 'facets' }> {
  const surface = face.surface;
  if (surface.kind !== 'surface' || surface.degreeU !== 1 || surface.degreeV !== 1 || surface.controlPoints.length !== 2 || surface.controlPoints[0].length !== 2 || surface.controlPoints[1].length !== 2) ctx.fail('CAPABILITY', 'profile relief requires represented affine planar boundary faces');
  const s = surface as Exclude<BrepFace['surface'], { kind: 'facets' }>;
  if (s.weights) {
    const weight = s.weights[0]?.[0];
    for (const row of s.weights) for (const item of row) if (!(Number.isFinite(item) && item > 0 && item === weight)) ctx.fail('CAPABILITY', 'profile relief requires constant planar support weights');
  }
  return s;
}
function facePlane(face: BrepFace, q: SectionRationalContext, ctx: Context): { origin: RV; normal: RV } {
  const s = affineSurface(face, ctx), a = vector(q, s.controlPoints[0][0]), u = subtract(q, vector(q, s.controlPoints[1][0]), a), v = subtract(q, vector(q, s.controlPoints[0][1]), a);
  const normal = cross(q, u, v), corner = vector(q, s.controlPoints[1][1]);
  if (zero(normal)) ctx.fail('GEOMETRY', 'profile relief boundary support has zero rank');
  for (let i = 0; i < 3; i++) if (q.compare(corner[i], q.add(q.add(a[i], u[i]), v[i])) !== 0) ctx.fail('CAPABILITY', 'profile relief cannot prove an exact affine boundary support');
  return { origin: a, normal };
}
function indexOf(brep: Brep, ctx: Context): BrepIndex {
  let indexed = ctx.breps.get(brep);
  if (!indexed) {
    indexed = { vertices: new Map(), edges: new Map(), coedges: new Map(), loops: new Map() };
    for (const value of brep.vertices) indexed.vertices.set(value.id, value);
    for (const value of brep.edges) indexed.edges.set(value.id, value);
    for (const value of brep.coedges) indexed.coedges.set(value.id, value);
    for (const value of brep.loops) indexed.loops.set(value.id, value);
    ctx.breps.set(brep, indexed);
  }
  return indexed;
}
function loopPoints(brep: Brep, id: string, ctx: Context): Point[] {
  const indexed = indexOf(brep, ctx), loop = indexed.loops.get(id);
  if (!loop || loop.coedges.length < 3 || loop.coedges.length > MAX_LOOP) ctx.fail('GEOMETRY', 'profile relief cannot read a bounded native face loop');
  const points: Point[] = [];
  for (const cid of loop!.coedges) {
    const coedge = indexed.coedges.get(cid), edge = coedge && indexed.edges.get(coedge.edge);
    if (!coedge || !edge || edge.curve.degree !== 1 || edge.curve.controlPoints.length !== 2 || edge.curve.knots.length !== 4 || edge.curve.knots[0] !== edge.curve.knots[1] || edge.curve.knots[2] !== edge.curve.knots[3] || !(edge.curve.knots[1] < edge.curve.knots[2])) ctx.fail('CAPABILITY', 'profile relief needs clamped straight native boundary edges');
    const a = indexed.vertices.get(edge!.vertices[0]), b = indexed.vertices.get(edge!.vertices[1]);
    if (!a || !b) ctx.fail('GEOMETRY', 'profile relief boundary vertex is missing');
    for (let k = 0; k < 3; k++) if (edge!.curve.controlPoints[0][k] !== a!.point[k] || edge!.curve.controlPoints[1][k] !== b!.point[k]) ctx.fail('CAPABILITY', 'profile relief cannot prove unchanged straight-edge representatives');
    points.push(coedge!.sense === 'forward' ? a!.point : b!.point);
  }
  return points;
}
function closed(brep: Brep, ctx: Context): void {
  if (brep.bodies.length !== 1 || brep.bodies[0].kind !== 'solid' || !brep.shells.length) ctx.fail('REFERENCE', 'profile relief requires one physical closed solid');
  for (const shell of brep.shells) if (!shell.closed) ctx.fail('REFERENCE', 'profile relief requires closed shells');
  const checked = checkBrep(brep, { strict: true });
  if (!checked.valid) ctx.fail('GEOMETRY', `profile relief strict boundary check failed: ${checked.issues.join('; ')}`);
}
function cap(brep: Brep, name: string, z: number, ctx: Context): PolygonWithHoles {
  const faces: BrepFace[] = []; for (const face of brep.faces) if (face.name === name) faces.push(face);
  if (faces.length !== 1) ctx.fail('REFERENCE', 'profile relief needs one exact, unambiguous selected cap name');
  const face = faces[0], plane = facePlane(face, ctx.q, ctx), normal = plane.normal;
  if (normal[0].n !== 0n || normal[1].n !== 0n || (normal[2].n > 0n ? 1 : -1) * (face.sense === 'forward' ? 1 : -1) !== 1 || ctx.q.compare(plane.origin[2], ctx.q.from(z)) !== 0) ctx.fail('CAPABILITY', 'profile relief selects only a +Z cap at the current slab top');
  let outer: XY[] | undefined; const holes: XY[][] = [];
  for (const lid of face.loops) {
    const loop = indexOf(brep, ctx).loops.get(lid), points = loopPoints(brep, lid, ctx), ring: XY[] = [];
    for (const point of points) {
      if (point[2] !== z) ctx.fail('CAPABILITY', 'profile relief cap loop is not exactly at the current top');
      ring.push(copied([point[0], point[1]], ctx));
    }
    ctx.count(ring.length);
    if (loop!.kind === 'outer') { if (outer) ctx.fail('CAPABILITY', 'profile relief cap has more than one outer loop'); outer = reverseIf(ring, true, ctx); }
    else holes.push(reverseIf(ring, false, ctx));
  }
  if (!outer) ctx.fail('GEOMETRY', 'profile relief cap has no outer loop');
  return { outer: outer!, holes };
}
function volume(q: SectionRationalContext, solid: PrismaticSolid, ctx: Context): R {
  let value = q.integer(0), count = 0;
  for (const slab of solid.slabs) {
    const height = q.sub(q.from(slab.z1), q.from(slab.z0));
    for (const region of slab.regions) {
      const rings: XY[][] = [];
      for (const loop of [region.outer, ...region.holes]) {
        const ring: XY[] = [];
        for (const edge of loop) { if (edge.kind !== 'line') ctx.fail('CAPABILITY', 'profile relief result left its line-only scope'); ring.push((edge as Line).a); }
        count += ring.length; if (count > 3 * MAX_EDGES) ctx.fail('INPUT', 'profile relief result exceeds its mass-boundary budget');
        rings.push(ring);
      }
      value = q.add(value, q.mul(area(q, { outer: rings[0], holes: rings.slice(1) }, ctx), height));
    }
  }
  return value;
}
function denominator3(point: readonly number[], denominator: bigint, ctx: Context): bigint {
  ctx.charge(1);
  for (let k = 0; k < 3; k++) { const d = 1n << BigInt(binary64Dyadic(point[k]).k); if (d > denominator) denominator = d; }
  return denominator;
}
function integerPoint(frame: IntegerFrame, point: readonly number[], ctx: Context): IV {
  let found = frame.points.get(point);
  if (!found) {
    ctx.charge(1);
    const a = binary64Dyadic(point[0]), b = binary64Dyadic(point[1]), c = binary64Dyadic(point[2]);
    found = [a.m * (frame.denominator >> BigInt(a.k)), b.m * (frame.denominator >> BigInt(b.k)), c.m * (frame.denominator >> BigInt(c.k))];
    frame.points.set(point, found);
  }
  return found;
}
function integerSub(a: IV, b: IV): IV { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function integerCross(a: IV, b: IV): IV { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function integerDot(a: IV, b: IV): bigint { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function boundaryVolume(q: SectionRationalContext, brep: Brep, ctx: Context): R {
  let denominator = 1n;
  for (const vertex of brep.vertices) denominator = denominator3(vertex.point, denominator, ctx);
  for (const face of brep.faces) for (const row of affineSurface(face, ctx).controlPoints) for (const point of row) denominator = denominator3(point, denominator, ctx);
  const frame: IntegerFrame = { denominator, points: new WeakMap() };
  let sum = 0n;
  // Finite binary64 inputs bound fixed-degree integer determinants; existing work/bit guards stay in force.
  for (const face of brep.faces) {
    ctx.charge(1);
    const s = affineSurface(face, ctx), a = integerPoint(frame, s.controlPoints[0][0], ctx), u = integerSub(integerPoint(frame, s.controlPoints[1][0], ctx), a), v = integerSub(integerPoint(frame, s.controlPoints[0][1], ctx), a);
    const normal = integerCross(u, v), corner = integerPoint(frame, s.controlPoints[1][1], ctx);
    if (normal[0] === 0n && normal[1] === 0n && normal[2] === 0n) ctx.fail('GEOMETRY', 'profile relief boundary support has zero rank');
    for (let k = 0; k < 3; k++) if (corner[k] !== a[k] + u[k] + v[k]) ctx.fail('CAPABILITY', 'profile relief cannot prove an exact affine boundary support');
    for (const lid of face.loops) {
      const points = loopPoints(brep, lid, ctx), first = integerPoint(frame, points[0], ctx);
      for (const point of points) { ctx.charge(1); if (integerDot(normal, integerSub(integerPoint(frame, point, ctx), a)) !== 0n) ctx.fail('CAPABILITY', 'profile relief cannot prove boundary vertices on their affine support'); }
      for (let i = 1; i + 1 < points.length; i++) { ctx.charge(1); sum += integerDot(first, integerCross(integerPoint(frame, points[i], ctx), integerPoint(frame, points[i + 1], ctx))); }
    }
  }
  return q.rat(sum, 6n * denominator * denominator * denominator);
}
function audit(solid: PrismaticSolid, brep: Brep, ctx: Context): Audit {
  const q = new SectionRationalContext(ctx.exactFailure), value = volume(q, solid, ctx), boundary = boundaryVolume(q, brep, ctx);
  if (value.n <= 0n || q.compare(boundary, value) !== 0) ctx.fail('CAPABILITY', 'profile relief cannot prove agreement of the stored slab and straight B-rep volumes');
  const reported = prismaticMassProperties(solid, 1).volume, simple = prismaticVolume(solid);
  if (!(Number.isFinite(reported) && reported > 0 && Number.isFinite(simple) && simple > 0)) ctx.fail('GEOMETRY', 'profile relief volume must be finite and positive');
  const error = q.max(q.abs(q.sub(q.from(reported), value)), q.abs(q.sub(q.from(simple), value)));
  ctx.finish(q); return { volume: value, reported, error };
}
function pocketRegions(material: readonly CurveRegion2[], ink: readonly CurveRegion2[], ctx: Context): CurveRegion2[] {
  const a: (readonly CurveSegment2[])[] = [], b: (readonly CurveSegment2[])[] = [];
  let edges = 0;
  for (const region of material) { a.push(region.outer); edges += region.outer.length; for (const hole of region.holes) { a.push(hole); edges += hole.length; } }
  for (const region of ink) { b.push(region.outer); edges += region.outer.length; for (const hole of region.holes) { b.push(hole); edges += hole.length; } }
  ctx.charge(edges * edges);
  return booleanCurveRegions(a, b, 'difference', curveTolerance([...a, ...b]));
}

function boundaryLines(polygons: readonly PolygonWithHoles[], reversed = false): BoundaryLine[] {
  const result: BoundaryLine[] = [];
  for (const polygon of polygons) for (const ring of lines(polygon)) for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length]; result.push(reversed ? { a: b, b: a } : { a, b });
  }
  return result;
}
function compareIntervals(a: Interval, b: Interval): number { return a.lo < b.lo ? -1 : a.lo > b.lo ? 1 : a.hi < b.hi ? -1 : a.hi > b.hi ? 1 : 0; }
function covered(line: BoundaryLine, others: readonly BoundaryLine[], ctx: Context): boolean {
  const axis = line.a[0] !== line.b[0] ? 0 : 1, start = line.a[axis], end = line.b[axis], lo = Math.min(start, end), hi = Math.max(start, end), intervals: Interval[] = [];
  if (lo === hi) return false;
  for (const other of others) {
    ctx.charge(1);
    if (Math.max(line.a[0], line.b[0]) < Math.min(other.a[0], other.b[0]) || Math.max(other.a[0], other.b[0]) < Math.min(line.a[0], line.b[0])
      || Math.max(line.a[1], line.b[1]) < Math.min(other.a[1], other.b[1]) || Math.max(other.a[1], other.b[1]) < Math.min(line.a[1], line.b[1])) continue;
    if (orient(ctx, line.a, line.b, other.a) !== 0 || orient(ctx, line.a, line.b, other.b) !== 0 || (end > start) !== (other.b[axis] > other.a[axis])) continue;
    const left = Math.max(lo, Math.min(other.a[axis], other.b[axis])), right = Math.min(hi, Math.max(other.a[axis], other.b[axis]));
    if (left < right) intervals.push({ lo: left, hi: right });
  }
  intervals.sort(compareIntervals);
  let next = lo;
  for (const interval of intervals) { if (interval.lo !== next) return false; next = interval.hi; }
  return next === hi;
}
function sameLineMultiset(a: readonly BoundaryLine[], b: readonly BoundaryLine[], ctx: Context): boolean {
  if (a.length !== b.length) return false;
  const counts = new Map<string, number>();
  for (const line of a) {
    ctx.charge(1);
    if (line.a[0] === line.b[0] && line.a[1] === line.b[1]) return false;
    const key = `${line.a[0]},${line.a[1]};${line.b[0]},${line.b[1]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const line of b) {
    ctx.charge(1);
    if (line.a[0] === line.b[0] && line.a[1] === line.b[1]) return false;
    const key = `${line.a[0]},${line.a[1]};${line.b[0]},${line.b[1]}`, count = counts.get(key);
    if (!count) return false;
    if (count === 1) counts.delete(key); else counts.set(key, count - 1);
  }
  return counts.size === 0;
}
function sameBoundary(a: readonly BoundaryLine[], b: readonly BoundaryLine[], ctx: Context): boolean {
  if (!a.length || !b.length) return false;
  // Exact directed endpoints, with multiplicity, prove the usual unchanged-boundary case in linear work.
  if (sameLineMultiset(a, b, ctx)) return true;
  for (const line of a) if (!covered(line, b, ctx)) return false;
  for (const line of b) if (!covered(line, a, ctx)) return false;
  return true;
}
function sectionBoundary(regions: readonly CurveRegion2[], ctx: Context): BoundaryLine[] {
  let count = 0;
  const result: BoundaryLine[] = [];
  for (const region of regions) for (const loop of [region.outer, ...region.holes]) {
    if (loop.length < 3 || loop.length > MAX_LOOP) ctx.fail('INPUT', 'profile relief frontier exceeds native loop admission');
    for (let i = 0; i < loop.length; i++) {
      if (++count > 3 * MAX_EDGES) ctx.fail('INPUT', 'profile relief frontier exceeds its result-boundary budget');
      const edge = loop[i], next = loop[(i + 1) % loop.length];
      if (edge.kind !== 'line' || next.kind !== 'line') ctx.fail('CAPABILITY', 'profile relief frontier left its line-only scope');
      const line = edge as Line, following = next as Line;
      if (line.b[0] !== following.a[0] || line.b[1] !== following.a[1]) ctx.fail('GEOMETRY', 'profile relief frontier is not exactly closed');
      result.push({ a: copied(line.a, ctx), b: copied(line.b, ctx) });
    }
  }
  return result;
}
/** Bounded support on one selected cap. `requested` is additional clearance above native policy, default zero. */
export function profileRelief(source: PrismaticSolid, sourceBrep: Brep, face: string, sketches: readonly ReliefSketch[], depth: number, mode: 'emboss' | 'engrave', requested: number | undefined, id: string, fail: Fail): PrismaticSolid {
  const ctx = new Context(fail), q = ctx.q;
  if (source.slabs.length !== 1) fail('CAPABILITY', 'profile relief requires one line-only upright slab');
  if (mode !== 'emboss' && mode !== 'engrave') fail('INPUT', 'profile relief mode must be emboss or engrave');
  if (!Array.isArray(sketches) || !sketches.length || sketches.length > MAX_COMPONENTS) fail('INPUT', 'profile relief needs 1..64 component sketch references');
  if (typeof face !== 'string' || !face || face.includes('+')) fail('INPUT', 'profile relief needs one exact cap face name');
  if (requested !== undefined && (typeof requested !== 'number' || !Number.isFinite(requested) || requested < 0 || requested > CadNumericPolicy.coordinateAbs)) fail('INPUT', 'profile relief clearance must be a finite nonnegative native length');
  const slab = source.slabs[0], material: PolygonWithHoles[] = [];
  for (const region of slab.regions) material.push(fromRegion(region, ctx));
  let scale = Math.max(1, Math.abs(slab.z0), Math.abs(slab.z1));
  for (const polygon of material) for (const ring of lines(polygon)) for (const point of ring) scale = Math.max(scale, Math.abs(point[0]), Math.abs(point[1]));
  const tolerance = linearToleranceMM(scale), thickness = slab.z1 - slab.z0;
  // Clearance is additional to the native policy; upward rounding never weakens the exact requested sum.
  const clearance = q.upward(q.add(q.from(tolerance), q.from(requested ?? 0)));
  if (!(Number.isFinite(depth) && depth > 0 && (mode === 'emboss' || depth < thickness))) fail('PARAMETER', 'profile relief depth must be positive and a pocket must stay below the slab thickness');
  // Raised material needs a positive seat; only a pocket consumes the authored depth below the top.
  const bottom = slab.z1 - (mode === 'emboss' ? Math.min(depth, thickness / 2) : depth), top = mode === 'emboss' ? slab.z1 + depth : slab.z1;
  if (!Number.isFinite(bottom) || !Number.isFinite(top) || Math.abs(bottom) > CadNumericPolicy.coordinateAbs || Math.abs(top) > CadNumericPolicy.coordinateAbs) fail('PARAMETER', 'profile relief tool levels exceed the CAD range');
  if (q.compare(q.sub(q.from(slab.z1), q.from(bottom)), q.from(tolerance)) <= 0 || (mode === 'emboss' && q.compare(q.sub(q.from(top), q.from(slab.z1)), q.from(tolerance)) <= 0) || (mode === 'engrave' && q.compare(q.sub(q.from(bottom), q.from(slab.z0)), q.from(tolerance)) <= 0)) fail('GEOMETRY', 'profile relief needs represented depth and pocket bottom web above the existing linear tolerance');
  closed(sourceBrep, ctx);
  const selected = cap(sourceBrep, face, slab.z1, ctx), components: Component[] = [];
  let totalArea = q.integer(0);
  for (const sketch of sketches) {
    const part = component(sketch, tolerance, ctx);
    for (const domain of [material, [selected]]) {
      if (exactBoolean([part.polygon], domain, 'difference', ctx).length) fail('GEOMETRY', 'profile relief component leaves the selected cap or target material');
      for (const polygon of domain) if (!boundariesApart(part.polygon, polygon, clearance, ctx)) fail('GEOMETRY', 'profile relief component does not meet the requested cap/material clearance');
      if (!inside(part.polygon, domain, ctx)) fail('GEOMETRY', 'profile relief exact containment leaves the selected cap or target material');
    }
    for (const prior of components) if (exactBoolean([part.polygon], [prior.polygon], 'intersection', ctx).length || !boundariesApart(part.polygon, prior.polygon, 2 * clearance, ctx) || inPolygon(part.polygon.outer[0], prior.polygon, ctx) || inPolygon(prior.polygon.outer[0], part.polygon, ctx)) fail('GEOMETRY', 'profile relief component overlap or contact is outside the initial scope');
    totalArea = q.add(totalArea, part.area); components.push(part);
  }
  const before = audit(source, sourceBrep, ctx), effective = mode === 'emboss' ? q.sub(q.from(top), q.from(slab.z1)) : q.sub(q.from(slab.z1), q.from(bottom));
  const polygons: PolygonWithHoles[] = []; for (const part of components) polygons.push(part.polygon);
  const regions: CurveRegion2[] = [], caps: PrismaticCapSource[] = [];
  for (let i = 0; i < components.length; i++) {
    const part = components[i], tool = prismaticFromProfile({ outer: part.outer, holes: part.holes, from: bottom, height: top - bottom, tag: `${id}.component${i}` });
    if (tool.slabs.length !== 1 || tool.slabs[0].z0 !== bottom || tool.slabs[0].z1 !== top || tool.slabs[0].regions.length !== 1) fail('GEOMETRY', 'profile relief cannot represent one component at the requested tool levels');
    const actual = sectionBoundary(tool.slabs[0].regions, ctx);
    if (!sameBoundary(boundaryLines([part.polygon]), actual, ctx)) fail('GEOMETRY', 'profile relief component construction changed an oriented boundary');
    // Containment and disjointness already prove complete source seating for this exact carried component.
    const overlap = q.mul(part.area, q.sub(q.from(slab.z1), q.from(bottom))), change = q.mul(part.area, effective);
    if (overlap.n <= 0n || change.n <= 0n) fail('GEOMETRY', 'profile relief requires complete positive overlap and material change for every component');
    for (const region of tool.slabs[0].regions) regions.push(region);
    for (const sourceCap of tool.caps ?? []) caps.push(sourceCap);
  }
  let result: PrismaticSolid;
  if (mode === 'emboss') {
    // Each admitted region is carried directly above the unchanged source; no growing union can lose a stroke.
    result = { kind: 'prismatic-solid', slabs: [slab, { z0: slab.z1, z1: top, regions }], caps: [...(source.caps ?? []), ...caps] };
  } else {
    const cut = pocketRegions(slab.regions, regions, ctx);
    result = { kind: 'prismatic-solid', slabs: [{ z0: slab.z0, z1: bottom, regions: slab.regions }, { z0: bottom, z1: slab.z1, regions: cut }], caps: [...(source.caps ?? []), ...caps] };
    if (result.slabs.length !== 2 || result.slabs[0].z0 !== slab.z0 || result.slabs[0].z1 !== bottom || result.slabs[1].z0 !== bottom || result.slabs[1].z1 !== slab.z1) fail('GEOMETRY', 'profile relief pocket changed the proved slab frontier');
    const original = boundaryLines(material), expected = [...original, ...boundaryLines(polygons, true)];
    // With strictly interior disjoint ink, boundary(M\I) is boundary(M) plus reversed boundary(I).
    if (!sameBoundary(expected, sectionBoundary(result.slabs[1].regions, ctx), ctx)) fail('GEOMETRY', 'profile relief pocket frontier lost or changed material, a component or a counter');
  }
  const brep = brepFromPrismatic(result, { id });
  closed(brep, ctx);
  const after = audit(result, brep, ctx);
  const geometricChange = mode === 'emboss' ? q.sub(after.volume, before.volume) : q.sub(before.volume, after.volume), intended = q.mul(totalArea, q.from(depth));
  const delta = mode === 'emboss' ? after.reported - before.reported : before.reported - after.reported;
  const reportedDifference = mode === 'emboss' ? q.sub(q.from(after.reported), q.from(before.reported)) : q.sub(q.from(before.reported), q.from(after.reported));
  const levelError = q.abs(q.sub(geometricChange, intended)), subtractionError = q.abs(q.sub(q.from(delta), reportedDifference));
  const bound = q.add(q.add(before.error, after.error), q.add(levelError, subtractionError)), allowed = q.mul(totalArea, q.from(tolerance));
  if (!(Number.isFinite(delta) && delta > 0) || q.compare(bound, allowed) > 0 || q.compare(bound, intended) >= 0 || q.compare(geometricChange, q.mul(totalArea, effective)) !== 0) fail('GEOMETRY', 'profile relief mass error cannot be bounded by ink area times the existing linear policy');
  ctx.finish(q);
  return result;
}
