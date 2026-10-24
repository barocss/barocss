import { buildConvexPlanarFace } from './own-convex-planar-face.js';
import type { ConvexPlanarFaceResult, ConvexPlanarFaceUse } from './own-convex-planar-face.js';
import { qualifyConvexPlanarSolid, validateConvexPlanarSolid } from './convex-planar-solid.js';
import type { ConvexPlanarSolidResult, ConvexPlanarSolidReport, ConvexPlanarSolidVertexReference } from './convex-planar-solid.js';
import { check, id, same, SolidSnapshotLedger, ConvexPlanarSolidError } from './convex-planar-solid-proof-internal.js';
import type { ConvexPlanarSolidDiagnosticCode, ExactPointData } from './convex-planar-solid-proof-internal.js';
import { SectionRationalContext } from './section-rational-internal.js';
import type { SectionFraction, SectionRational } from './section-rational-internal.js';

import type { Point, Curve, Surface } from './types.js';
import { KernelError } from './core/barocss-error.js';

/** Positive uniform scaling about the world origin, in authored XYZ millimetres. */
export type UniformScaleFactor = 0.5 | 2;
export type UniformScaleSpec = Readonly<{ factor: UniformScaleFactor }>;
type ScaleFailure = (code: 'INPUT' | 'BUDGET' | 'REPRESENTABILITY', detail: string) => never;
const pureFailure: ScaleFailure = (_code, detail) => { throw new RangeError('Exact uniform scale: ' + detail); };

/** Pure helper snapshot. Descriptor values retain binary64/-0 and run no getters. */
function pureSnapshot<T>(input: T): T {
  let values = 4096;
  const active = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    if (--values < 0 || depth > 12) return pureFailure('BUDGET', 'Own-data value/depth ceiling exceeded');
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return pureFailure('INPUT', 'Finite own number required');
      return value;
    }
    if (typeof value === 'string') {
      if (value.length > 128) return pureFailure('BUDGET', 'Bounded own string required');
      return value;
    }
    if (!value || typeof value !== 'object' || active.has(value)) return pureFailure('INPUT', 'Acyclic plain own data required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), descriptors = Object.getOwnPropertyDescriptors(value);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return pureFailure('INPUT', 'Plain own prototype required');
    const keys = Reflect.ownKeys(descriptors);
    if (keys.length > (array ? 257 : 16) || !keys.every(key => typeof key === 'string' && key.length <= 128
      && Object.hasOwn(descriptors[key], 'value') && (array && key === 'length' || descriptors[key].enumerable))) return pureFailure('INPUT', 'Getter/symbol/hidden/excess property refused');
    active.add(value);
    let result: unknown;
    if (array) {
      const size = descriptors.length.value as number;
      if (!Number.isInteger(size) || size < 0 || size > 256 || keys.length !== size + 1) return pureFailure('INPUT', 'Dense bounded array required');
      result = Array.from({ length: size }, (_, i) => {
        if (!Object.hasOwn(descriptors, String(i))) return pureFailure('INPUT', 'Sparse array refused');
        return copy(descriptors[String(i)].value, depth + 1);
      });
    } else result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    active.delete(value); return result;
  };
  try { return copy(input, 0) as T; }
  catch (cause) {
    if (cause instanceof RangeError) throw cause;
    throw new RangeError('Exact uniform scale: Own-data reflection refused', { cause });
  }
}
function pureSpec(spec: UniformScaleSpec): void {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec) || Object.keys(spec).length !== 1
    || !Object.hasOwn(spec, 'factor') || spec.factor !== 0.5 && spec.factor !== 2) pureFailure('INPUT', 'Exact factor 0.5 or 2 record required');
}
function scaledCoordinate(value: number, factor: UniformScaleFactor, exactFactor: SectionRational, rational: SectionRationalContext, fail: ScaleFailure): number {
  if (!Number.isFinite(value) || Math.abs(value) > 10000) return fail('REPRESENTABILITY', 'Source coordinate exceeds finite +/-10000mm');
  const target = value * factor;
  if (!Number.isFinite(target) || Math.abs(target) > 10000) return fail('REPRESENTABILITY', 'Exact target coordinate exceeds finite +/-10000mm');
  if (rational.compare(rational.mul(rational.from(value), exactFactor), rational.from(target)) !== 0) return fail('REPRESENTABILITY', 'Scaled coordinate is not exactly represented in binary64');
  if (value === 0 && !Object.is(value, target)) return fail('REPRESENTABILITY', 'Positive scaling changed original zero sign');
  return target;
}
function purePoint(point: Point, spec: UniformScaleSpec, rational: SectionRationalContext, factor: SectionRational): Point {
  if (!Array.isArray(point) || point.length !== 3 || !point.every(value => typeof value === 'number')) return pureFailure('INPUT', 'Three represented XYZ coordinates required');
  return point.map(value => scaledCoordinate(value, spec.factor, factor, rational, pureFailure)) as Point;
}
export function scalePointExactly(point: Point, spec: UniformScaleSpec): Point {
  const data = pureSnapshot({ point, spec }); pureSpec(data.spec);
  const rational = new SectionRationalContext(pureFailure), factor = rational.from(data.spec.factor);
  return purePoint(data.point, data.spec, rational, factor);
}
/** Pure coefficient staging only; this helper does not establish Curve geometry authority. */
export function scaleCurveExactly(source: Curve, spec: UniformScaleSpec): Curve {
  const data = pureSnapshot({ source, spec }); pureSpec(data.spec);
  const curve = data.source;
  if (!curve || Array.isArray(curve) || curve.kind !== 'curve' || Object.keys(curve).length !== 6
    || !['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights'].every(key => Object.hasOwn(curve, key))
    || !Array.isArray(curve.knots) || !Array.isArray(curve.weights) || !Array.isArray(curve.controlPoints)) return pureFailure('INPUT', 'Complete own Curve coefficient record required');
  const rational = new SectionRationalContext(pureFailure), factor = rational.from(data.spec.factor);
  return { ...curve, controlPoints: curve.controlPoints.map(point => purePoint(point, data.spec, rational, factor)) };
}
/** Preserve Surface axes, pole order, basis and weights; qualify the Solid downstream. */
export function scaleSurfaceExactly(source: Surface, spec: UniformScaleSpec): Surface {
  const data = pureSnapshot({ source, spec }); pureSpec(data.spec);
  const surface = data.source;
  if (!surface || Array.isArray(surface) || surface.kind !== 'surface' || Object.keys(surface).length !== 8
    || !['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights'].every(key => Object.hasOwn(surface, key))
    || !Array.isArray(surface.knotsU) || !Array.isArray(surface.knotsV) || !Array.isArray(surface.weights)
    || !Array.isArray(surface.controlPoints) || !surface.controlPoints.every(Array.isArray)) return pureFailure('INPUT', 'Complete own Surface coefficient record required');
  const rational = new SectionRationalContext(pureFailure), factor = rational.from(data.spec.factor);
  return { ...surface, controlPoints: surface.controlPoints.map(row => row.map(point => purePoint(point, data.spec, rational, factor))) };
}

type Mapping<T> = { original: T; scaled: T };
type FaceReference = { sourceId: string; faceId: string; surfaceId: string; loopId: string; evaluationId: string };
type LocalReference = { sourceId: string; faceId: string };
type DirectCalls = { parentValidationCount: number; initialFaceConstructionCount: number; targetQualificationCount: number; retries: 0 };
type ExactWork = ReturnType<SectionRationalContext['counts']>;
type Progress = { parentValidation: ConvexPlanarSolidReport | null; directCalls: DirectCalls; exactWork: ExactWork };
type Lineage = {
  faces: Mapping<FaceReference>[];
  curves: Mapping<LocalReference & { curveId: string }>[];
  pcurves: Mapping<LocalReference & { pcurveId: string }>[];
  uses: Mapping<LocalReference & { useId: string }>[];
  localEdges: Mapping<LocalReference & { edgeId: string }>[];
  localVertices: Mapping<ConvexPlanarSolidVertexReference>[];
  edges: Mapping<{ edgeId: string }>[];
  vertices: Mapping<{ vertexId: string }>[];
};

/** Private evidence for the primary model's one bounded, terminal owned copy. */
export interface ModelingScaleResult {
  request: { parent: ConvexPlanarSolidResult; spec: UniformScaleSpec; prefix: string };
  solid: ConvexPlanarSolidResult;
  lineage: Lineage;
  report: {
    schema: 'barocss-modeling-scale'; version: 0; lengthUnit: 'mm'; solid: true;
    determinant: 0.125 | 8;
    parentValidation: ConvexPlanarSolidReport;
    targetQualification: ConvexPlanarSolidReport;
    directCalls: DirectCalls;
    initialFaceConstruction: {
      faceCount: number; sourceCompilationCount: number; bindingObservationCount: number;
      curveD1Count: number; pcurveD1Count: number; surfaceD1Count: number; totalD1Count: number;
      scope: 'direct-calls-and-known-parent-loop-work-not-hidden-provider-internals';
    };
    exactWork: ExactWork;
    preservation: {
      completeParent: true; positiveUniformScale: true; exactScaledCoefficientValues: true; signedZeroPreserved: true;
      basisAndWeightBits: true; directedDomainBits: true; orientationAndTraversalPreserved: true; exactParameterMaps: true;
      bijectiveLineage: true; exactScaledNormals: true; exactScaledSupportsAndVertices: true; supportOffsetsScaledCubically: true;
      exactVolumeScaledCubically: true; independentSourceNamespaces: true;
    };
    numericPolicy: 'exact-rationals-of-stored-binary64-no-welding-no-tolerance-promotion';
    validationScope: 'whole-result-self-consistency-not-authenticity';
    persistentNamingCertified: false;
    limits: { faces: 10; directedUses: 48; pairs: 24; vertices: 16; coordinateAbsMM: 10000; rationalOperations: 200000; integerBits: 8192 };
    dataCharge: 'unchanged-solid-snapshot-ledger-alias-occurrences-not-v8-heap';
  };
}

class ModelingScaleError extends KernelError {
  constructor(readonly code: ConvexPlanarSolidDiagnosticCode, readonly stage: string, readonly entity: string,
    detail: string, readonly report: Progress, cause: unknown) {
    super(('Modeling scale: ' + detail).slice(0, 1024), { cause }); this.name = 'ModelingScaleError';
    const freeze = (value: unknown): void => {
      if (value !== null && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    };
    // Completed work is retained, with no partial target geometry and without
    // changing or replacing the original provider error in cause.
    freeze(report);
  }
}

const key = (sourceId: string, localId: string): string => sourceId + '/' + localId;
const memberKey = (member: ConvexPlanarSolidVertexReference): string => key(member.sourceId, member.faceId) + '/' + member.vertexId;
const faceReference = (sourceId: string, face: ConvexPlanarFaceResult): FaceReference => ({ sourceId, faceId: face.options.faceId,
  surfaceId: face.plane.id, loopId: face.loop.id, evaluationId: face.options.evaluationId });

/** Reconstruct and qualify one terminal copy about the world origin. */
export function buildModelingScale(parentInput: ConvexPlanarSolidResult, specInput: UniformScaleSpec, prefixInput: string): ModelingScaleResult {
  const ledger = new SolidSnapshotLedger();
  const rational = new SectionRationalContext((code, detail) => { throw new ConvexPlanarSolidError(code, detail); });
  const directCalls: DirectCalls = { parentValidationCount: 0, initialFaceConstructionCount: 0, targetQualificationCount: 0, retries: 0 };
  let parentValidation: ConvexPlanarSolidReport | null = null, stage = 'snapshot', entity = 'request';
  const at = <T>(nextStage: string, nextEntity: string, action: () => T): T => { stage = nextStage; entity = nextEntity; return action(); };
  try {
    // Complete, bounded own-data admission happens before reading the retained parent.
    const request = ledger.copy({ parent: parentInput, spec: specInput, prefix: prefixInput }, true);
    const { parent, spec, prefix } = request;
    at('admission', 'spec', () => check(spec !== null && typeof spec === 'object' && !Array.isArray(spec)
      && Object.keys(spec).length === 1 && Object.hasOwn(spec, 'factor')
      && (spec.factor === 0.5 || spec.factor === 2), 'INPUT', 'Uniform world-origin factor 0.5 or 2 required'));
    at('admission', 'prefix', () => id(prefix, 16));
    parentValidation = at('parent-validation', 'parent', () => { directCalls.parentValidationCount++; return validateConvexPlanarSolid(parent); });
    const originals = parent.request.assets;
    at('admission', 'parent-inventory', () => check(originals.length <= 10 && parent.graph.edges.length <= 24 && parent.graph.vertices.length <= 16
      && originals.reduce((sum, a) => sum + a.face.topology.loop.uses.length, 0) <= 48, 'BUDGET', 'Qualified convex inventory exceeds10 Faces/48 uses/24 pairs/16 vertices'));

    // Include the complete original namespaces, not just the parent's solid ID.
    const originalIds = new Set<string>([parent.request.options.solidId, parent.request.options.resultIdPrefix]);
    for (const { sourceId, face } of originals) {
      [sourceId, face.plane.id, face.loop.id, face.options.faceId, face.options.evaluationId, face.options.resultIdPrefix,
        ...face.loop.edges.map(c => c.id), ...face.pcurves.map(c => c.id), ...face.topology.vertices.map(v => v.id),
        ...face.topology.edges.map(e => e.id), ...face.topology.loop.uses.map(u => u.id)].forEach(value => originalIds.add(value));
    }
    [...parent.graph.vertices, ...parent.graph.edges].forEach(item => originalIds.add(item.id));
    const generatedIds = new Set<string>();
    const fresh = (value: string, maximum = 48): string => at('identity', value, () => {
      id(value, maximum); check(!originalIds.has(value) && !generatedIds.has(value), 'IDENTITY', 'Every scaled namespace must be distinct from the complete parent and other target identities');
      generatedIds.add(value); return value;
    });
    const solidOptions = { solidId: fresh(prefix + '_solid'), resultIdPrefix: fresh(prefix + '_s', 20) };
    for (const [i] of parent.graph.edges.entries()) fresh(solidOptions.resultIdPrefix + '_e_' + i);
    for (const [i] of parent.graph.vertices.entries()) fresh(solidOptions.resultIdPrefix + '_v_' + i);
    const names = originals.map(({ face }, i) => {
      const facePrefix = fresh(prefix + '_f' + i, 20);
      const result = { sourceId: fresh(facePrefix + '_src'), surfaceId: fresh(facePrefix + '_surface'), loopId: fresh(facePrefix + '_loop'),
        options: { faceId: fresh(facePrefix + '_face'), evaluationId: fresh(facePrefix + '_model'), resultIdPrefix: facePrefix, orientation: face.options.orientation },
        curveIds: face.loop.edges.map((_, j) => fresh(facePrefix + '_curve_' + j)) };
      for (const [j] of face.loop.edges.entries()) for (const role of ['v', 'e', 'use', 'uv']) fresh(facePrefix + '_' + role + '_' + j);
      return result;
    });

    const factor = at('stage-coefficients', 'spec.factor', () => rational.from(spec.factor));
    const factorSquared = rational.mul(factor, factor), factorCubed = rational.mul(factorSquared, factor);
    // Prove every actual stored binary64 product before any target Face call.
    // A number-key memo would merge +0/-0; every occurrence is checked instead.
    const scaledPoint = (point: Point, location: string): Point => point.map((value, axis) =>
      at('stage-coefficients', location + '/' + axis, () => scaledCoordinate(value, spec.factor, factor, rational,
        (code, detail) => { throw new ConvexPlanarSolidError(code, detail); }))) as Point;
    const staged = originals.map(({ sourceId, face }, i) => {
      const name = names[i];
      const plane: Surface = { ...face.plane, id: name.surfaceId,
        knotsU: [...face.plane.knotsU], knotsV: [...face.plane.knotsV], weights: face.plane.weights.map(row => [...row]),
        controlPoints: face.plane.controlPoints.map((row, u) => row.map((point, v) => scaledPoint(point, key(sourceId, face.plane.id) + '/' + u + '/' + v))) };
      const edges: Curve[] = face.loop.edges.map((curve, j) => ({ ...curve, id: name.curveIds[j], knots: [...curve.knots], weights: [...curve.weights],
        controlPoints: curve.controlPoints.map((point, p) => scaledPoint(point, key(sourceId, curve.id) + '/' + p)) }));
      return { sourceId: name.sourceId, plane, loop: { id: name.loopId, edges }, options: name.options };
    });
    // This boundary is intentional: all Surface/Line coefficients for ALL Faces
    // have passed exact multiplication and coordinate bounds before the first native Face.
    const assets = staged.map(plan => ({ sourceId: plan.sourceId, face: at('face-construction', plan.sourceId, () => {
      directCalls.initialFaceConstructionCount++; return buildConvexPlanarFace(plan.plane, plan.loop, plan.options);
    }) }));
    const lineage: Lineage = { faces: [], curves: [], pcurves: [], uses: [], localEdges: [], localVertices: [], edges: [], vertices: [] };
    const useMap = new Map<string, { sourceId: string; useId: string }>();
    const vertexMap = new Map<string, ConvexPlanarSolidVertexReference>();
    const fraction = (value: SectionFraction): SectionRational => rational.rat(BigInt(value.numerator), BigInt(value.denominator));
    const equalFraction = (a: SectionFraction, b: SectionFraction): boolean => rational.compare(fraction(a), fraction(b)) === 0;
    const checkPoint = (a: Point, b: Point): void => {
      for (let axis = 0; axis < 3; axis++) {
        check(rational.compare(rational.mul(rational.from(a[axis]), factor), rational.from(b[axis])) === 0,
          'BINDING', 'Actual target point differs from exact scaled parent');
      }
    };
    for (const [i, original] of originals.entries()) at('face-lineage', original.sourceId, () => {
      const scaled = assets[i], a = original.face, b = scaled.face, plan = staged[i];
      check(same(b.plane, plan.plane) && same(b.loop, plan.loop) && same(b.options, plan.options), 'OWNED', 'Native Face did not adopt the complete staged Surface/Line data');
      check(a.sourceVersion === b.sourceVersion && b.sourceVersion === 0 && a.options.orientation === b.options.orientation, 'BINDING', 'Actual Source0 and original orientation required');
      check(a.topology.vertices.length === b.topology.vertices.length && a.topology.edges.length === b.topology.edges.length
        && a.topology.loop.uses.length === b.topology.loop.uses.length && a.pcurves.length === b.pcurves.length, 'COVERAGE', 'Complete local inventory must correspond bijectively');
      lineage.faces.push({ original: faceReference(original.sourceId, a), scaled: faceReference(scaled.sourceId, b) });
      const from = { sourceId: original.sourceId, faceId: a.options.faceId }, to = { sourceId: scaled.sourceId, faceId: b.options.faceId };
      for (const [j, curve] of a.loop.edges.entries()) {
        const next = b.loop.edges[j];
        check(curve.degree === next.degree && same(curve.knots, next.knots) && same(curve.weights, next.weights), 'BINDING', 'Line basis/domain/weight bits changed');
        lineage.curves.push({ original: { ...from, curveId: curve.id }, scaled: { ...to, curveId: next.id } });
      }
      check(a.plane.degreeU === b.plane.degreeU && a.plane.degreeV === b.plane.degreeV && same(a.plane.knotsU, b.plane.knotsU)
        && same(a.plane.knotsV, b.plane.knotsV) && same(a.plane.weights, b.plane.weights), 'BINDING', 'Surface basis/domain/weight bits changed');
      for (const [j, vertex] of a.topology.vertices.entries()) {
        const next = b.topology.vertices[j], originalRef = { ...from, vertexId: vertex.id }, scaledRef = { ...to, vertexId: next.id };
        checkPoint(vertex.point, next.point); vertexMap.set(memberKey(originalRef), scaledRef);
        lineage.localVertices.push({ original: originalRef, scaled: scaledRef });
      }
      const curveMap = new Map(a.loop.edges.map((c, j) => [c.id, b.loop.edges[j].id]));
      const edgeMap = new Map(a.topology.edges.map((e, j) => [e.id, b.topology.edges[j].id]));
      const localVertex = (vertexId: string): string => {
        const ref = vertexMap.get(memberKey({ ...from, vertexId })); check(ref !== undefined, 'COVERAGE', 'Local vertex lineage is missing'); return ref.vertexId;
      };
      for (const [j, edge] of a.topology.edges.entries()) {
        const next = b.topology.edges[j];
        check(curveMap.get(edge.curveId) === next.curveId && same(edge.vertexIds.map(localVertex), next.vertexIds), 'INCIDENCE', 'Local edge membership changed');
        lineage.localEdges.push({ original: { ...from, edgeId: edge.id }, scaled: { ...to, edgeId: next.id } });
      }
      const pcurveMap = new Map<string, string>();
      for (const pc of a.pcurves) {
        const matches = b.pcurves.filter(next => next.curveId === curveMap.get(pc.curveId));
        check(matches.length === 1, 'COVERAGE', 'One actual generated pcurve per original Line required');
        const next = matches[0];
        check(edgeMap.get(pc.edgeId) === next.edgeId && same(pc.domain, next.domain)
          && pc.curve.degree === next.curve.degree && same(pc.curve.knots, next.curve.knots) && same(pc.curve.weights, next.curve.weights), 'BINDING', 'Generated pcurve domain/basis/weight bits changed');
        pcurveMap.set(pc.id, next.id);
        lineage.pcurves.push({ original: { ...from, pcurveId: pc.id }, scaled: { ...to, pcurveId: next.id } });
      }
      for (const [j, use] of a.topology.loop.uses.entries()) {
        const next: ConvexPlanarFaceUse = b.topology.loop.uses[j];
        check(curveMap.get(use.curveId) === next.curveId && edgeMap.get(use.edgeId) === next.edgeId && pcurveMap.get(use.pcurveId) === next.pcurveId
          && use.sense === next.sense && same(use.interval, next.interval) && same(use.vertexIds.map(localVertex), next.vertexIds), 'BINDING', 'Actual directed use order, domain, sense or incidence changed');
        const ref = { sourceId: scaled.sourceId, useId: next.id };
        check(!useMap.has(key(original.sourceId, use.id)), 'COVERAGE', 'Repeated original directed use');
        useMap.set(key(original.sourceId, use.id), ref);
        lineage.uses.push({ original: { ...from, useId: use.id }, scaled: { ...to, useId: next.id } });
      }
    });
    const edgePairs = at('pair-remapping', 'parent.request.edgePairs', () => parent.request.edgePairs.map(pair => {
      const a = useMap.get(key(pair.a.sourceId, pair.a.useId)), b = useMap.get(key(pair.b.sourceId, pair.b.useId));
      check(a !== undefined && b !== undefined, 'COVERAGE', 'Every original qualified pair requires two actual scaled uses'); return { a, b };
    }));
    const solid = at('target-qualification', solidOptions.solidId, () => {
      directCalls.targetQualificationCount++; return qualifyConvexPlanarSolid(assets, edgePairs, solidOptions);
    });

    at('solid-lineage', solidOptions.solidId, () => {
      check(same(solid.request.assets, assets) && same(solid.request.edgePairs, edgePairs), 'OWNED', 'Qualifier must retain complete actual Faces and remapped pairs');
      check(parent.graph.faces.length === solid.graph.faces.length && parent.graph.edges.length === solid.graph.edges.length
        && parent.graph.vertices.length === solid.graph.vertices.length && parent.supports.length === solid.supports.length, 'COVERAGE', 'Complete global inventory must correspond bijectively');
      const globalVertexMap = new Map<string, string>(), usedVertices = new Set<string>();
      for (const vertex of parent.graph.vertices) {
        const expected = vertex.members.map(member => {
          const next = vertexMap.get(memberKey(member)); check(next !== undefined, 'COVERAGE', 'Global vertex member has no actual local mapping'); return memberKey(next);
        }).sort();
        const matches = solid.graph.vertices.filter(next => same(next.members.map(memberKey).sort(), expected));
        check(matches.length === 1 && !usedVertices.has(matches[0].id), 'COVERAGE', 'Exact global vertex member sets must be bijective');
        const next = matches[0]; checkPoint(vertex.pointMM, next.pointMM); usedVertices.add(next.id); globalVertexMap.set(vertex.id, next.id);
        lineage.vertices.push({ original: { vertexId: vertex.id }, scaled: { vertexId: next.id } });
      }
      const globalEdgeMap = new Map<string, string>(), usedEdges = new Set<string>();
      for (const edge of parent.graph.edges) {
        const expected = edge.uses.map(ref => useMap.get(key(ref.sourceId, ref.use.id)));
        const matches = solid.graph.edges.filter(next => next.uses.length === expected.length
          && next.uses.every((ref, j) => ref.sourceId === expected[j]?.sourceId && ref.use.id === expected[j]?.useId));
        check(matches.length === 1 && !usedEdges.has(matches[0].id), 'COVERAGE', 'Exact directed edge pair membership must be bijective');
        const next = matches[0];
        check(edge.pairIndex === next.pairIndex && same(edge.vertexIds.map(v => globalVertexMap.get(v)), next.vertexIds), 'INCIDENCE', 'Paired edge order or directed vertex correspondence changed');
        check(equalFraction(edge.parameterMapAtoB.scale, next.parameterMapAtoB.scale)
          && equalFraction(edge.parameterMapAtoB.offset, next.parameterMapAtoB.offset), 'BINDING', 'Exact directed parameter map changed');
        usedEdges.add(next.id); globalEdgeMap.set(edge.id, next.id);
        lineage.edges.push({ original: { edgeId: edge.id }, scaled: { edgeId: next.id } });
      }
      const mappedFace = (sourceId: string, faceId: string): FaceReference => {
        const found = lineage.faces.find(f => f.original.sourceId === sourceId && f.original.faceId === faceId);
        check(found !== undefined, 'COVERAGE', 'Source-qualified Face mapping required'); return found.scaled;
      };
      for (const face of parent.graph.faces) {
        const ref = mappedFace(face.sourceId, face.faceId), matches = solid.graph.faces.filter(next => next.sourceId === ref.sourceId && next.faceId === ref.faceId);
        check(matches.length === 1, 'COVERAGE', 'One target graph Face per original required');
        const next = matches[0];
        check(next.surfaceId === ref.surfaceId && next.loopId === ref.loopId && same(face.vertexIds.map(v => globalVertexMap.get(v)), next.vertexIds)
          && same(face.edgeIds.map(e => globalEdgeMap.get(e)), next.edgeIds), 'INCIDENCE', 'Face loop membership/order changed');
      }
      for (const link of parent.graph.vertexLinks) {
        const next = solid.graph.vertexLinks.find(v => v.vertexId === globalVertexMap.get(link.vertexId));
        check(next !== undefined && same(link.cycleEdgeIds.map(e => globalEdgeMap.get(e)), next.cycleEdgeIds), 'INCIDENCE', 'Exact vertex link cycle changed');
        const arcs = link.arcs.map(arc => { const ref = mappedFace(arc.sourceId, arc.faceId); return { sourceId: ref.sourceId, faceId: ref.faceId,
          fromEdgeId: globalEdgeMap.get(arc.fromEdgeId), toEdgeId: globalEdgeMap.get(arc.toEdgeId) }; });
        check(same(arcs, next.arcs), 'INCIDENCE', 'Vertex link Face/edge membership changed');
      }
      const checkExactPoint = (a: ExactPointData, b: ExactPointData, multiplier = factor): void => {
        check(a.every((value, axis) => rational.compare(rational.mul(fraction(value), multiplier), fraction(b[axis])) === 0),
          'BINDING', 'Certified exact vector differs from scaled parent');
      };
      const checkScaledFraction = (a: SectionFraction, b: SectionFraction, multiplier: SectionRational): void => {
        check(rational.compare(rational.mul(fraction(a), multiplier), fraction(b)) === 0,
          'BINDING', 'Certified exact scalar differs from scaled parent');
      };
      for (const support of parent.supports) {
        const ref = mappedFace(support.sourceId, support.faceId), matches = solid.supports.filter(s => s.sourceId === ref.sourceId && s.faceId === ref.faceId);
        check(matches.length === 1 && matches[0].surfaceId === ref.surfaceId, 'COVERAGE', 'Exactly one corresponding target support required');
        const next = matches[0];
        checkExactPoint(support.originMM, next.originMM);
        checkExactPoint(support.outwardNormal, next.outwardNormal, factorSquared);
        checkScaledFraction(support.offset, next.offset, factorCubed);
      }
      checkExactPoint(parent.certificate.strictInteriorMM, solid.certificate.strictInteriorMM);
      checkScaledFraction(parent.certificate.volumeMM3, solid.certificate.volumeMM3, factorCubed);
      // Each mapping's identity inventory must be injective on both sides. Coverage
      // above establishes surjectivity against the complete actual inventories.
      for (const mappings of Object.values(lineage)) {
        check(new Set(mappings.map(m => JSON.stringify(m.original))).size === mappings.length
          && new Set(mappings.map(m => JSON.stringify(m.scaled))).size === mappings.length, 'COVERAGE', 'Lineage must be bijective, never a nearest-point naming claim');
      }
    });
    const bindingCount = assets.reduce((sum, a) => sum + a.face.bindings.length, 0);
    const result: ModelingScaleResult = { request, solid, lineage, report: {
      schema: 'barocss-modeling-scale', version: 0, lengthUnit: 'mm', solid: true, determinant: spec.factor === 0.5 ? 0.125 : 8, parentValidation, targetQualification: solid.report,
      directCalls: { ...directCalls },
      initialFaceConstruction: { faceCount: assets.length, sourceCompilationCount: assets.length, bindingObservationCount: bindingCount,
        curveD1Count: bindingCount, pcurveD1Count: bindingCount, surfaceD1Count: bindingCount, totalD1Count: bindingCount * 3,
        scope: 'direct-calls-and-known-parent-loop-work-not-hidden-provider-internals' },
      exactWork: rational.counts(),
      preservation: { completeParent: true, positiveUniformScale: true, exactScaledCoefficientValues: true, signedZeroPreserved: true, basisAndWeightBits: true,
        directedDomainBits: true, orientationAndTraversalPreserved: true, exactParameterMaps: true, bijectiveLineage: true, exactScaledNormals: true,
        exactScaledSupportsAndVertices: true, supportOffsetsScaledCubically: true, exactVolumeScaledCubically: true, independentSourceNamespaces: true },
      numericPolicy: 'exact-rationals-of-stored-binary64-no-welding-no-tolerance-promotion', validationScope: 'whole-result-self-consistency-not-authenticity',
      persistentNamingCertified: false,
      limits: { faces: 10, directedUses: 48, pairs: 24, vertices: 16, coordinateAbsMM: 10000, rationalOperations: 200000, integerBits: 8192 },
      dataCharge: 'unchanged-solid-snapshot-ledger-alias-occurrences-not-v8-heap',
    } };
    return at('snapshot', 'result', () => ledger.copy(result, true));
  } catch (cause) {
    const code = cause instanceof ConvexPlanarSolidError ? cause.code : 'NATIVE';
    const detail = stage === 'stage-coefficients' && code === 'REPRESENTABILITY'
      ? 'Exact target coordinate is not representable within the bounded binary64 policy: ' + (cause instanceof Error ? cause.message : '')
      : cause instanceof Error ? cause.message : 'Native construction refused';
    throw new ModelingScaleError(code, stage, entity, detail, { parentValidation, directCalls: { ...directCalls }, exactWork: rational.counts() }, cause);
  }
}
