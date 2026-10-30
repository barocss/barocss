import type { Brep, BrepCoedge, BrepFace } from '../brep/brep-core.js';
import type { Curve, Point, Surface } from '../types.js';
import type { SectionFraction, SectionRational } from '../section-rational-internal.js';
import type { CylindricalWrapWallReferenceResult } from './cylindrical-wrap-source-walls.js';
import { certifyCylindricalCapCycle, type WallCycleSpan } from './cylindrical-wrap-wall-cycle.js';
import { ReferenceProofContext, closedReferenceFailure as fail, referenceSameNumbers as same, referenceEntity as entity } from './cylindrical-wrap-reference-context.js';

function opposite(sense: 'forward' | 'reversed'): 'forward' | 'reversed' { return sense === 'forward' ? 'reversed' : 'forward'; }
function unitLine(curve: Curve | null, first: Point, last: Point, ctx: ReferenceProofContext): void {
  ctx.direct(3); if (!curve || curve.degree !== 1 || curve.controlPoints.length !== 2) fail('SUPPORT', 'a complete unit-domain boundary line is required');
  same(curve.knots, [0, 0, 1, 1], ctx); same(curve.weights, [1, 1], ctx); same(curve.controlPoints[0], first, ctx); same(curve.controlPoints[1], last, ctx);
}
/** Pure affine-net theorem. Source identity and fresh boundary residuals are proved by the caller. */
export function certifyAffineReferenceCap(face: BrepFace, z: number, top: boolean, ctx: ReferenceProofContext) {
  const s = face.surface; ctx.direct(8);
  if (!Number.isFinite(z) || s.kind !== 'surface' || s.degreeU !== 1 || s.degreeV !== 1 || s.controlPoints.length !== 2 || s.weights.length !== 2 || face.sense !== 'forward' || face.loops.length !== 1) fail('SUPPORT', 'the original outward affine cap is required');
  same(s.knotsU, [0, 0, 1, 1], ctx); same(s.knotsV, [0, 0, 1, 1], ctx);
  for (let i = 0; i < 2; i++) {
    ctx.direct(1); if (s.controlPoints[i].length !== 2) fail('SUPPORT', 'a full two-column cap is required'); same(s.weights[i], [1, 1], ctx);
  }
  // The producer's complete actual rectangle need not be centered exactly at zero or have equal spans.
  const first = s.controlPoints[0][0], last = s.controlPoints[1][1];
  const lower: [number, number] = [first[0], first[1]], upper: [number, number] = [last[0], last[1]];
  ctx.structure(12); ctx.direct(6);
  if (!Number.isFinite(lower[0]) || !Number.isFinite(lower[1]) || !Number.isFinite(upper[0]) || !Number.isFinite(upper[1]) || !(lower[0] < upper[0]) || !(lower[1] < upper[1])) fail('SUPPORT', 'the actual affine cap must have finite positive X and Y spans');
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    ctx.direct(2); same(s.controlPoints[i][j], [(top ? i : j) === 0 ? lower[0] : upper[0], (top ? j : i) === 0 ? lower[1] : upper[1], z], ctx);
  }
  const q = ctx.q, two = q.integer(2), center: SectionRational[] = [], halfSpan: SectionRational[] = [];
  for (let axis = 0; axis < 2; axis++) {
    const low = ctx.from(lower[axis]), high = ctx.from(upper[axis]);
    center.push(q.div(q.add(low, high), two)); halfSpan.push(q.div(q.sub(high, low), two)); ctx.check();
  }
  const centerL1 = q.add(q.abs(center[0]), q.abs(center[1])); ctx.check();
  return { lower, upper, center: [ctx.text(center[0]), ctx.text(center[1])] as const,
    halfSpan: [ctx.text(halfSpan[0]), ctx.text(halfSpan[1])] as const, centerToSourceCenterL1: ctx.text(centerL1),
    normalizedCoordinates: 'exact-(2u-1,2v-1)' as const, worldCoordinates: 'center-plus-positive-diagonal-half-spans' as const };
}
function capUse(brep: Brep, wallUse: string, ctx: ReferenceProofContext): { use: BrepCoedge; face: BrepFace } {
  const wall = entity(brep.coedges, wallUse, ctx); if (!wall.twin) fail('SUPPORT', 'a cap must own the opposite original horizontal use');
  const use = entity(brep.coedges, wall.twin, ctx), loop = entity(brep.loops, use.loop, ctx), face = entity(brep.faces, loop.face, ctx);
  ctx.direct(6);
  if (use.twin !== wall.id || use.edge !== wall.edge || use.sense !== opposite(wall.sense) || loop.kind !== 'outer' || loop.coedges.length !== 2 || !loop.coedges.includes(use.id)) fail('SUPPORT', 'the original cap and wall incidence must remain opposite and complete');
  return { use, face };
}
function capCurve(use: BrepCoedge, brep: Brep, ctx: ReferenceProofContext): Curve {
  const p = use.pcurve, edge = entity(brep.edges, use.edge, ctx); ctx.direct(3);
  if (!p || p.degree !== 2 || p.controlPoints.length !== 5) fail('SUPPORT', 'each cap boundary must retain both actual quadratic spans');
  same(p.knots, edge.curve.knots, ctx); same(p.weights, edge.curve.weights, ctx);
  for (const point of p.controlPoints) {
    ctx.direct(5); if (point[0] < 0 || point[0] > 1 || point[1] < 0 || point[1] > 1 || !Object.is(point[2], 0)) fail('SUPPORT', 'the entire cap control hull must remain in its original unit domain');
  }
  return p;
}
function capModelError(parent: CylindricalWrapWallReferenceResult, coedge: BrepCoedge, face: BrepFace, ctx: ReferenceProofContext): SectionRational {
  let value: SectionFraction | undefined;
  for (const proof of parent.reference.native.nativeBinding.coedges) {
    ctx.structure(2); ctx.direct(1); if (proof.coedge !== coedge.id) continue;
    ctx.direct(3); if (proof.kind !== 'cap' || proof.edge !== coedge.edge || proof.face !== face.id) fail('SUPPORT', 'the cap must bind to its actual fresh native residual proof');
    value = proof.modelError;
  }
  if (!value) fail('SUPPORT', 'a fresh complete cap model residual is required'); return ctx.read(value);
}
function originalSeams(parent: CylindricalWrapWallReferenceResult, ctx: ReferenceProofContext): readonly string[] {
  const source = parent.reference.formal.source, b = source.brep, seamIds: string[] = [];
  for (const edge of b.edges) {
    ctx.direct(1); if (edge.curve.degree !== 1) continue;
    const curve = edge.curve; ctx.direct(1); if (curve.controlPoints.length !== 2) fail('SUPPORT', 'original seams must be complete linear extrusions');
    unitLine(curve, [curve.controlPoints[0][0], curve.controlPoints[0][1], source.z[0]], [curve.controlPoints[0][0], curve.controlPoints[0][1], source.z[1]], ctx);
    const uses: BrepCoedge[] = [];
    for (const coedge of b.coedges) { ctx.direct(1); if (coedge.edge === edge.id) uses.push(coedge); }
    ctx.direct(4); if (uses.length !== 2 || uses[0].sense === uses[1].sense || uses[0].twin !== uses[1].id || uses[1].twin !== uses[0].id) fail('SUPPORT', 'each original seam requires two opposite wall uses');
    const owners: string[] = [];
    for (const use of uses) {
      const loop = entity(b.loops, use.loop, ctx), wall = entity(b.faces, loop.face, ctx), s = wall.surface;
      ctx.direct(2); if (s.kind !== 'surface' || s.degreeU !== 2) fail('SUPPORT', 'a seam must join the two original walls');
      let row = -1;
      for (const at of [0, 4]) {
        ctx.direct(2); if (Object.is(s.controlPoints[at][0][0], curve.controlPoints[0][0]) && Object.is(s.controlPoints[at][0][1], curve.controlPoints[0][1])) row = at;
      }
      if (row < 0) fail('SUPPORT', 'the seam must be an original complete endpoint row');
      same(s.controlPoints[row][0], curve.controlPoints[0], ctx); same(s.controlPoints[row][1], curve.controlPoints[1], ctx);
      const u = row === 0 ? 0 : 1; unitLine(use.pcurve, [u, 0, 0], [u, 1, 0], ctx);
      ctx.direct(1); if (use.sense !== (u === 1 ? wall.sense : opposite(wall.sense))) fail('SUPPORT', 'the seam sense must agree with the outward wall orientation');
      owners.push(wall.id);
    }
    ctx.direct(1); if (owners[0] === owners[1]) fail('SUPPORT', 'both distinct walls must own each seam');
    for (let i = 0; i < 2; i++) same(entity(b.vertices, edge.vertices[i], ctx).point, curve.controlPoints[i], ctx);
    seamIds.push(edge.id);
  }
  ctx.direct(1); if (seamIds.length !== 2) fail('SUPPORT', 'both original exact extrusion seams are required'); return seamIds;
}
export function certifyOriginalReferenceCaps(parent: CylindricalWrapWallReferenceResult, ctx: ReferenceProofContext) {
  const source = parent.reference.formal.source, b = source.brep, spans: WallCycleSpan[] = [], capIds: (string | undefined)[] = [undefined, undefined], uses: { bottom: string; top: string; edge: string }[] = [];
  let boundaryError = ctx.q.rat(0n);
  const frames: (ReturnType<typeof certifyAffineReferenceCap> | undefined)[] = [undefined, undefined];
  for (const wall of parent.sourceWalls.walls) {
    const low = capUse(b, wall.bottom.coedge, ctx), high = capUse(b, wall.top.coedge, ctx);
    for (const [index, item] of [[0, low], [1, high]] as const) {
      ctx.direct(1); if (capIds[index] !== undefined && capIds[index] !== item.face.id) fail('SUPPORT', 'each axial endpoint must have one complete original cap');
      if (capIds[index] === undefined) frames[index] = certifyAffineReferenceCap(item.face, source.z[index], index === 1, ctx);
      capIds[index] = item.face.id; boundaryError = ctx.q.max(boundaryError, capModelError(parent, item.use, item.face, ctx)); ctx.check();
    }
    const lower = capCurve(low.use, b, ctx), upper = capCurve(high.use, b, ctx);
    same(lower.weights, upper.weights, ctx); same(lower.knots, upper.knots, ctx);
    // The exact affine images coincide in XY. Only their heights and outward uses differ.
    for (let i = 0; i < 5; i++) same(lower.controlPoints[i], [upper.controlPoints[i][1], upper.controlPoints[i][0], upper.controlPoints[i][2]], ctx);
    for (const span of [0, 1] as const) {
      const at = span * 2; ctx.structure(12);
      spans.push({ face: high.face.id, span, sense: high.use.sense, controlPoints: [upper.controlPoints[at], upper.controlPoints[at + 1], upper.controlPoints[at + 2]], weights: [upper.weights[at], upper.weights[at + 1], upper.weights[at + 2]] });
    }
    uses.push({ bottom: low.use.id, top: high.use.id, edge: high.use.edge });
  }
  ctx.direct(1); if (capIds[0] === capIds[1]) fail('SUPPORT', 'top and bottom caps must be distinct');
  const lower = frames[0]!, upper = frames[1]!;
  same(lower.lower, upper.lower, ctx); same(lower.upper, upper.upper, ctx);
  const normalizedCycle = certifyCylindricalCapCycle(spans, ctx);
  // The positive diagonal affine map carries the normalized radial disk to a disk about E.
  // At radial fraction s its correspondence error is (1-s)E+s*(capBoundary-sourceBoundary).
  // Convexity of the L1 norm bounds the WHOLE disk by max(|E|1, boundaryResidual).
  const modelError = ctx.q.max(ctx.read(upper.centerToSourceCenterL1), boundaryError); ctx.check();
  const seams = originalSeams(parent, ctx);
  return { caps: capIds as [string, string], uses, seams, normalizedCycle, affine: upper, boundaryToSourceL1: ctx.text(boundaryError), boundaryAndInteriorToSourceL1: ctx.text(modelError),
    correspondence: 'matched-boundary-parameter-and-affine-center-disk-extension' as const,
    exactReferenceSourceClosed: true as const, literalStoredShellClosed: false as const };
}
function useOnFace(b: Brep, edge: string, face: string, ctx: ReferenceProofContext): BrepCoedge {
  const owner = entity(b.faces, face, ctx); let found: BrepCoedge | undefined;
  for (const loopId of owner.loops) {
    const loop = entity(b.loops, loopId, ctx);
    for (const id of loop.coedges) {
      const use = entity(b.coedges, id, ctx); ctx.direct(1);
      if (use.edge === edge) { if (found) fail('SUPPORT', 'one reference boundary use per owning face is required'); found = use; }
    }
  }
  if (!found) fail('SUPPORT', 'a required reference boundary use is missing'); return found;
}
function outerSurface(s: Surface, original: Surface, ctx: ReferenceProofContext): void {
  ctx.direct(4); if (s.degreeU !== 2 || s.degreeV !== 1 || s.controlPoints.length !== 3 || s.weights.length !== 3) fail('SUPPORT', 'the complete original factor-two quarter is required');
  same(s.knotsU, original.knotsU, ctx); same(s.knotsV, original.knotsV, ctx);
  for (let i = 0; i < 3; i++) {
    same(s.weights[i], original.weights[i], ctx); ctx.direct(1); if (s.controlPoints[i].length !== 2) fail('SUPPORT', 'both outer V columns are required');
    for (let j = 0; j < 2; j++) { const p = original.controlPoints[i][j]; ctx.direct(2); same(s.controlPoints[i][j], [2 * p[0], 2 * p[1], p[2]], ctx); }
  }
}
function topology(b: Brep, ctx: ReferenceProofContext): void {
  const edges = new Map<string, number>(), coedges = new Map<string, BrepCoedge>();
  for (const edge of b.edges) { ctx.structure(3); if (edges.has(edge.id)) fail('SUPPORT', 'edge identifiers must be unique'); edges.set(edge.id, 0); }
  for (const use of b.coedges) { ctx.structure(3); if (coedges.has(use.id)) fail('SUPPORT', 'coedge identifiers must be unique'); coedges.set(use.id, use); }
  for (const use of b.coedges) {
    const twin = use.twin && coedges.get(use.twin), next = coedges.get(use.next), prev = coedges.get(use.prev); ctx.direct(9);
    if (!twin || twin.twin !== use.id || twin.edge !== use.edge || twin.sense === use.sense || !next || next.prev !== use.id || !prev || prev.next !== use.id || !edges.has(use.edge)) fail('SUPPORT', 'all reference boundary incidences must close with reciprocal opposite uses');
    edges.set(use.edge, edges.get(use.edge)! + 1); ctx.structure(3);
  }
  for (const count of edges.values()) { ctx.direct(1); if (count !== 2) fail('SUPPORT', 'each reference edge must have exactly two uses'); }
}
export function certifyWrappedReferenceClosure(parent: CylindricalWrapWallReferenceResult, caps: ReturnType<typeof certifyOriginalReferenceCaps>, ctx: ReferenceProofContext) {
  const ref = parent.reference, source = ref.formal.source, assembly = ref.native.assembly, b = assembly.brep, rectangle = ref.rectangle, pieces = assembly.proof.pieces;
  ctx.direct(5); if (b.faces.length !== 9 || b.edges.length !== 18 || b.coedges.length !== 36 || pieces.length !== 4 || source.face.sense !== 'forward') fail('SUPPORT', 'the fixed complete one-pad reference profile is required');
  topology(b, ctx);
  const sourceFaces = new Set<string>(), sideFaces = new Set<string>(), assigned = new Set<string>(), faceErrors: { face: string; kind: string; exactModelL1: SectionFraction; nativeToReferenceL1: SectionFraction }[] = [];
  for (const face of source.brep.faces) sourceFaces.add(face.id);
  for (const piece of pieces) sideFaces.add(piece.sideFace);
  let outer: BrepFace | undefined;
  for (const face of b.faces) { ctx.structure(3); if (!sourceFaces.has(face.id) && !sideFaces.has(face.id)) { if (outer) fail('SUPPORT', 'one outer reference face is required'); outer = face; } }
  if (!outer || outer.surface.kind !== 'surface') fail('SUPPORT', 'the actual outer quarter is missing');
  outerSurface(outer.surface, source.quarter, ctx); ctx.direct(2); if (outer.sense !== 'forward' || outer.loops.length !== 1) fail('SUPPORT', 'the outer quarter must retain one positive boundary');
  const target = entity(b.faces, source.face.id, ctx); ctx.direct(1); if (target.loops.length !== 2) fail('SUPPORT', 'the retained source face must have its original loop and one rectangular hole');
  const sides: { face: string; boundary: string; baseToReferenceL1: SectionFraction }[] = [], modelErrors = new Map<string, SectionRational>();
  for (const face of source.brep.faces) modelErrors.set(face.id, caps.caps.includes(face.id) ? ctx.read(caps.boundaryAndInteriorToSourceL1) : ctx.q.rat(0n));
  modelErrors.set(outer.id, ctx.q.rat(0n));
  for (const piece of pieces) {
    const a = piece.start, c = piece.end, u = rectangle.u, v = rectangle.v; let boundary: string;
    ctx.direct(16);
    if (a[1] === v[0] && c[1] === v[0] && a[0] === u[0] && c[0] === u[1]) boundary = 'bottom';
    else if (a[0] === u[1] && c[0] === u[1] && a[1] === v[0] && c[1] === v[1]) boundary = 'right';
    else if (a[1] === v[1] && c[1] === v[1] && a[0] === u[1] && c[0] === u[0]) boundary = 'top';
    else if (a[0] === u[0] && c[0] === u[0] && a[1] === v[1] && c[1] === v[0]) boundary = 'left';
    else fail('SUPPORT', 'the actual four sides must traverse the same original UV rectangle positively');
    if (assigned.has(boundary)) fail('SUPPORT', 'each rectangle side must occur once'); assigned.add(boundary);
    const base = useOnFace(b, piece.baseEdge, source.face.id, ctx), outside = useOnFace(b, piece.outerEdge, outer.id, ctx), side = entity(b.faces, piece.sideFace, ctx);
    unitLine(base.pcurve, [a[0], a[1], 0], [c[0], c[1], 0], ctx); unitLine(outside.pcurve, [a[0], a[1], 0], [c[0], c[1], 0], ctx);
    ctx.direct(4); if (base.sense !== 'reversed' || outside.sense !== 'forward' || side.sense !== 'forward' || side.loops.length !== 1) fail('SUPPORT', 'hole, outer and side uses must retain the proved reference orientation');
    const hole = entity(b.loops, base.loop, ctx); ctx.direct(1); if (hole.kind !== 'inner') fail('SUPPORT', 'the actual source rectangle must be the retained inner boundary');
    const baseOnSide = useOnFace(b, piece.baseEdge, side.id, ctx), outerOnSide = useOnFace(b, piece.outerEdge, side.id, ctx);
    ctx.direct(4); if (baseOnSide.sense !== 'forward' || outerOnSide.sense !== 'reversed' || base.twin !== baseOnSide.id || outside.twin !== outerOnSide.id) fail('SUPPORT', 'the same reference base and outer edges must join the actual sides');
    const error = ctx.read(piece.binding.baseError), model = ctx.q.mul(error, ctx.q.integer(2)); ctx.check(); modelErrors.set(side.id, model);
    sides.push({ face: side.id, boundary, baseToReferenceL1: ctx.text(error) });
  }
  const native = ctx.read(ref.native.nativeBinding.evaluator.l1.exact), tolerance = ctx.from(assembly.proof.tolerance); let maximum = ctx.q.rat(0n);
  for (const face of b.faces) {
    const model = modelErrors.get(face.id); if (!model) fail('SUPPORT', 'every actual face must have one closed-reference association');
    const bound = ctx.q.add(model, native); if (ctx.q.compare(bound, tolerance) > 0) fail('REPRESENTABILITY', 'a native face exceeds the unchanged reference-association tolerance');
    maximum = ctx.q.max(maximum, bound); ctx.check();
    faceErrors.push({ face: face.id, kind: sourceFaces.has(face.id) ? caps.caps.includes(face.id) ? 'cap-disk' : 'retained-wall' : sideFaces.has(face.id) ? 'radial-side' : 'outer-wall', exactModelL1: ctx.text(model), nativeToReferenceL1: ctx.text(bound) });
  }
  return { authority: 'original-wall-radial-graph-prism-union-scale2-uv-rectangle' as const, sourceSurface: source.face.surface.id, rectangle,
    caps, sides, faces: faceErrors, maximumNativeToReferenceL1: ctx.text(maximum), tolerance: assembly.proof.tolerance,
    topology: { vertices: 12, edges: 18, faces: 9, coedges: 36, genus: 0 } as const,
    nativeFaceDomain: 'admitted-exact-face-trim-domain' as const,
    closedReferenceCertified: true as const, referenceFacesMeetOnlyOnPrescribedBoundaries: true as const, nativeFaceAssociationCertified: true as const,
    literalStoredBrepClosureCertified: false as const, partMassProvider: false as const, productFeature: false as const };
}
