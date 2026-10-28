import type { Brep, BrepFace, BrepEdge, BrepCoedge } from '../brep/brep-core.js';
import type { Part } from '../part/part-model.js';
import { SectionRationalContext } from '../section-rational-internal.js';
import type { Surface } from '../types.js';
import type { CylindricalWrapAssemblyComponent } from './cylindrical-wrap-assembly.js';
import { buildCylindricalWrapBoundReference, type CylindricalWrapBoundReferenceOptions, type CylindricalWrapBoundReferenceResult } from './cylindrical-wrap-bound-reference.js';
import { certifyCylindricalWallCycle, wallCycleFailure, type WallCycleContext, type WallCycleSpan, type WallCycleProof } from './cylindrical-wrap-wall-cycle.js';

interface WallBoundary {
  readonly coedge: string; readonly edge: string; readonly vertices: readonly [string, string];
  readonly sense: 'forward' | 'reversed';
}
export interface SourceWallProof {
  readonly face: string; readonly faceSlot: number; readonly sense: 'forward' | 'reversed';
  readonly bottom: WallBoundary; readonly top: WallBoundary;
}
export interface CylindricalWrapWallReferenceResult {
  readonly reference: CylindricalWrapBoundReferenceResult;
  readonly sourceWalls: { readonly walls: readonly SourceWallProof[]; readonly cycle: WallCycleProof; readonly z: readonly [number, number] };
  readonly counts: { readonly exactOperations: number; readonly referenceOperations: number; readonly rationalOperations: number; readonly directOperations: number; readonly work: number; readonly localWork: number; readonly maximumBits: number; readonly localGcdSteps: number };
  readonly limits: CylindricalWrapBoundReferenceResult['limits'];
  readonly meaning: typeof MEANING; readonly solidQualified: false;
}
const MEANING = Object.freeze({
  source: 'actual-fresh-formal-source-with-complete-reference-cost' as const,
  originalWallCycleCertified: true as const,
  originalWallEmbeddingCertified: true as const,
  originalWallOutwardOrientationCertified: true as const,
  originalHorizontalBoundaryOwnershipCertified: true as const,
  coefficientRadialBoundCoversAllSourceWalls: true as const,
  capTrimEmbeddingCertified: false as const,
  sourceShellCertified: false as const,
  closedReferenceCertified: false as const,
  retainedFaceClosureCertified: false as const,
  physicalBrepCertified: false as const,
  representedVolumeCertified: false as const,
  radialErrorIncludedInMass: false as const,
  partMassProvider: false as const,
  productFeature: false as const,
});
function exactFailure(code: 'BUDGET' | 'REPRESENTABILITY', detail: string): never { return wallCycleFailure(code === 'BUDGET' ? code : 'SUPPORT', detail); }
class Context implements WallCycleContext {
  readonly q = new SectionRationalContext(exactFailure);
  directOperations = 0; structural = 0; integerBits = 0;
  constructor(readonly reference: CylindricalWrapBoundReferenceResult) {}
  localWork(): number { const c = this.q.counts(); return this.structural + this.directOperations + c.operations + c.gcdSteps + c.floatSearchSteps; }
  check(): void {
    const c = this.q.counts(), prior = this.reference.counts;
    if (prior.exactOperations + c.operations + this.directOperations > this.reference.limits.exactOperations || prior.work + this.localWork() > 1048576 || Math.max(prior.maximumBits, this.integerBits, c.maximumObservedBits) > 8192) wallCycleFailure('BUDGET', 'the complete reference and original-wall proof budget was exceeded');
  }
  integer(value: bigint): bigint {
    this.directOperations++;
    const bits = (value < 0n ? -value : value).toString(2).length;
    this.integerBits = Math.max(this.integerBits, bits); this.structural += Math.ceil(bits / 64);
    this.check(); return value;
  }
  direct(amount: number): void { this.directOperations += amount; this.check(); }
  structure(amount: number): void { this.structural += amount; this.check(); }
}
/** Exact comparisons retain signed zero, arrays, original entity ownership and order. */
function equalNumbers(a: readonly number[], b: readonly number[], ctx: Context): void {
  ctx.direct(1); ctx.structure(a.length + b.length);
  if (a.length !== b.length) wallCycleFailure('SUPPORT', 'actual coefficient arrays must have matching lengths');
  for (let i = 0; i < a.length; i++) { ctx.direct(1); if (!Object.is(a[i], b[i])) wallCycleFailure('SUPPORT', 'actual coefficient arrays must agree bit for bit'); }
}
function entity<T extends { readonly id: string }>(values: readonly T[], id: string, ctx: Context): T {
  let found: T | undefined;
  for (const value of values) {
    ctx.structure(2); ctx.direct(1);
    if (value.id === id) { if (found) wallCycleFailure('SUPPORT', 'entity ownership must be unique'); found = value; }
  }
  if (!found) wallCycleFailure('SUPPORT', 'an original boundary entity is missing');
  return found;
}
function wallSurface(face: BrepFace, z: readonly [number, number], ctx: Context): Surface {
  const s = face.surface; ctx.direct(5);
  if (s.kind !== 'surface' || s.degreeU !== 2 || s.degreeV !== 1 || s.controlPoints.length !== 5 || s.weights.length !== 5) wallCycleFailure('SUPPORT', 'both original walls must retain the quadratic five-row tensor structure');
  equalNumbers(s.knotsU, [0, 0, 0, 0.5, 0.5, 1, 1, 1], ctx); equalNumbers(s.knotsV, [0, 0, 1, 1], ctx);
  for (let i = 0; i < 5; i++) {
    const p = s.controlPoints[i], w = s.weights[i]; ctx.direct(2);
    if (p.length !== 2 || w.length !== 2) wallCycleFailure('SUPPORT', 'the complete original V columns are required');
    equalNumbers(p[0], [p[1][0], p[1][1], z[0]], ctx); equalNumbers([p[1][2]], [z[1]], ctx); equalNumbers(w, [w[0], w[0]], ctx);
  }
  return s;
}
function boundaryEdge(brep: Brep, coedge: BrepCoedge, surface: Surface, v: 0 | 1, ctx: Context): BrepEdge {
  const p = coedge.pcurve; ctx.direct(3);
  if (!p || p.degree !== 1 || p.controlPoints.length !== 2) wallCycleFailure('SUPPORT', 'each original horizontal pcurve must be a full-domain unit line');
  equalNumbers(p.knots, [0, 0, 1, 1], ctx); equalNumbers(p.weights, [1, 1], ctx);
  equalNumbers(p.controlPoints[0], [0, v, 0], ctx); equalNumbers(p.controlPoints[1], [1, v, 0], ctx);
  const edge = entity(brep.edges, coedge.edge, ctx), c = edge.curve; ctx.direct(3);
  if (c.degree !== 2 || c.controlPoints.length !== 5 || c.weights.length !== 5) wallCycleFailure('SUPPORT', 'each original horizontal edge must retain both quadratic spans');
  equalNumbers(c.knots, surface.knotsU, ctx);
  for (let i = 0; i < 5; i++) { equalNumbers(c.controlPoints[i], surface.controlPoints[i][v], ctx); equalNumbers([c.weights[i]], [surface.weights[i][v]], ctx); }
  for (let i = 0; i < 2; i++) equalNumbers(entity(brep.vertices, edge.vertices[i], ctx).point, c.controlPoints[i === 0 ? 0 : 4], ctx);
  return edge;
}
function boundaries(brep: Brep, face: BrepFace, surface: Surface, ctx: Context): readonly [WallBoundary, WallBoundary] {
  ctx.direct(1); if (face.loops.length !== 1) wallCycleFailure('SUPPORT', 'one original complete wall loop is required');
  const loop = entity(brep.loops, face.loops[0], ctx); ctx.direct(3);
  if (loop.face !== face.id || loop.kind !== 'outer' || loop.coedges.length !== 4) wallCycleFailure('SUPPORT', 'the original wall must own its four-use outer loop');
  const out: (WallBoundary | undefined)[] = [undefined, undefined];
  for (const id of loop.coedges) {
    const coedge = entity(brep.coedges, id, ctx); ctx.direct(1);
    if (coedge.loop !== loop.id) wallCycleFailure('SUPPORT', 'the original coedge must belong to the same loop');
    const edge = entity(brep.edges, coedge.edge, ctx); ctx.direct(1);
    if (edge.curve.degree !== 2) continue;
    const p = coedge.pcurve; ctx.direct(4);
    if (!p || p.controlPoints.length !== 2 || p.controlPoints[0][1] !== 0 && p.controlPoints[0][1] !== 1) wallCycleFailure('SUPPORT', 'horizontal boundary V must be exactly zero or one');
    const v = p.controlPoints[0][1] as 0 | 1;
    if (out[v]) wallCycleFailure('SUPPORT', 'each wall must have exactly one bottom and one top boundary');
    const original = boundaryEdge(brep, coedge, surface, v, ctx), expected = v === 0 ? face.sense : face.sense === 'forward' ? 'reversed' : 'forward';
    ctx.direct(1); if (coedge.sense !== expected) wallCycleFailure('SUPPORT', 'bottom and top uses must match the actual outward face sense');
    out[v] = { coedge: coedge.id, edge: original.id, vertices: [original.vertices[0], original.vertices[1]], sense: coedge.sense };
  }
  if (!out[0] || !out[1]) wallCycleFailure('SUPPORT', 'both complete wall boundaries are required');
  return [out[0], out[1]];
}
function freezeProof(value: unknown, ctx: Context): void {
  ctx.structure(4 + (typeof value === 'string' ? value.length : 0));
  if (value !== null && typeof value === 'object') { for (const child of Object.values(value)) freezeProof(child, ctx); Object.freeze(value); }
}
function originalWalls(reference: CylindricalWrapBoundReferenceResult, ctx: Context): CylindricalWrapWallReferenceResult['sourceWalls'] {
  // This source was freshly checked inside the same synchronous request. No third
  // producer call or copied receipt/authority flag is accepted from a caller.
  const source = reference.formal.source, brep = source.brep, z = source.z, walls: SourceWallProof[] = [], spans: WallCycleSpan[] = [];
  ctx.direct(3); if (brep.faces.length !== 4 || z.length !== 2 || !(z[1] > z[0])) wallCycleFailure('SUPPORT', 'the fresh source must retain four faces and positive exact axial height');
  for (let slot = 0; slot < brep.faces.length; slot++) {
    const face = brep.faces[slot]; ctx.direct(2); ctx.structure(4);
    if (face.surface.kind !== 'surface' || face.surface.degreeU !== 2) continue;
    const s = wallSurface(face, z, ctx), [bottom, top] = boundaries(brep, face, s, ctx);
    walls.push({ face: face.id, faceSlot: slot, sense: face.sense, bottom, top });
    for (const span of [0, 1] as const) {
      const start = span * 2; ctx.structure(10);
      spans.push({ face: face.id, span, sense: face.sense, controlPoints: [s.controlPoints[start][0], s.controlPoints[start + 1][0], s.controlPoints[start + 2][0]], weights: [s.weights[start][0], s.weights[start + 1][0], s.weights[start + 2][0]] });
    }
  }
  ctx.direct(1); if (walls.length !== 2) wallCycleFailure('SUPPORT', 'exactly two original extrusion walls are required');
  // Both canonical halves share the same two original vertices at each Z level.
  // The coefficient theorem derives their directed traversal independently.
  for (const level of ['bottom', 'top'] as const) for (let i = 0; i < 2; i++) {
    ctx.direct(1); if (walls[0][level].vertices[i] !== walls[1][level].vertices[i]) wallCycleFailure('SUPPORT', 'the half-wall joins must retain common original vertex ownership');
  }
  const cycle = certifyCylindricalWallCycle(spans, source.radius, ctx);
  const result = { walls, cycle, z: [z[0], z[1]] as const }; freezeProof(result, ctx); return result;
}
/** Original-wall theorem plus both fresh native/formal children, under the same accepted total cap. */
export function buildCylindricalWrapWallReference(part: Part, components: readonly CylindricalWrapAssemblyComponent[], options: CylindricalWrapBoundReferenceOptions): CylindricalWrapWallReferenceResult {
  const reference = buildCylindricalWrapBoundReference(part, components, options), ctx = new Context(reference);
  // Conservative reservation for fixed final records and their freezes. Child records
  // are already owned/frozen; only newly constructed proof data is traversed again.
  ctx.structure(128);
  const sourceWalls = originalWalls(reference, ctx); ctx.check(); const q = ctx.q.counts(), prior = reference.counts;
  const counts = Object.freeze({ exactOperations: prior.exactOperations + q.operations + ctx.directOperations, referenceOperations: prior.exactOperations, rationalOperations: q.operations, directOperations: ctx.directOperations,
    work: prior.work + ctx.localWork(), localWork: ctx.localWork(), maximumBits: Math.max(prior.maximumBits, ctx.integerBits, q.maximumObservedBits), localGcdSteps: q.gcdSteps });
  return Object.freeze({ reference, sourceWalls, counts, limits: reference.limits, meaning: MEANING, solidQualified: false as const });
}
