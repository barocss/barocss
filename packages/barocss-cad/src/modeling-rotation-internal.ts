import { buildConvexPlanarFace } from './own-convex-planar-face.js';
import type { ConvexPlanarFaceResult, ConvexPlanarFaceUse } from './own-convex-planar-face.js';
import { qualifyConvexPlanarSolid, validateConvexPlanarSolid } from './convex-planar-solid.js';
import type { ConvexPlanarSolidResult, ConvexPlanarSolidReport, ConvexPlanarSolidVertexReference } from './convex-planar-solid.js';
import { check, id, same, SolidSnapshotLedger, ConvexPlanarSolidError } from './convex-planar-solid-proof-internal.js';
import type { ConvexPlanarSolidDiagnosticCode, ExactPointData } from './convex-planar-solid-proof-internal.js';
import { SectionRationalContext } from './section-rational-internal.js';
import type { SectionFraction, SectionRational } from './section-rational-internal.js';

import type { Point, Curve, Surface } from './types.js';

/** Discrete right-handed rotations around the origin, in authored XYZ millimetres. */
export type CardinalRotationAxis = 'x' | 'y' | 'z';
export type CardinalRotationDegrees = 90 | 180 | 270;
export type CardinalRotationSpec = Readonly<{ axis: CardinalRotationAxis; degrees: CardinalRotationDegrees }>;

/**
 * Signed coordinate permutation: no trig, rounding, tolerance, or Float32.
 * The caller must separately qualify the parent, provenance and target solid.
 */
const refuse = (): never => { throw new RangeError('Finite XYZ and supported cardinal rotation required'); };

/** Own-data snapshot, bounded before arithmetic. Caller Proxy getters cannot influence geometry. */
function admit(point: Point, spec: CardinalRotationSpec): { point: Point; spec: CardinalRotationSpec } {
  try {
    if (!Array.isArray(point) || Object.getPrototypeOf(point) !== Array.prototype) refuse();
    const entries = Object.getOwnPropertyDescriptors(point) as unknown as Record<string, PropertyDescriptor | undefined>;
    if (Reflect.ownKeys(entries).length !== 4 || !Object.hasOwn(entries, 'length') || entries.length?.value !== 3) refuse();
    const values = [0, 1, 2].map(i => {
      const item = entries[String(i)];
      if (item === undefined) return refuse();
      const value: unknown = item.value;
      if (!Object.hasOwn(item, 'value') || !item.enumerable || typeof value !== 'number' ||
          !Number.isFinite(value) || Math.abs(value) > 10000) return refuse();
      return value;
    }) as Point;
    if (!spec || typeof spec !== 'object' || Array.isArray(spec) ||
        (Object.getPrototypeOf(spec) !== Object.prototype && Object.getPrototypeOf(spec) !== null)) refuse();
    const options = Object.getOwnPropertyDescriptors(spec);
    if (Reflect.ownKeys(options).length !== 2 || !['axis', 'degrees'].every(k =>
      Object.hasOwn(options, k) && 'value' in options[k] && options[k].enumerable)) refuse();
    const axis = options.axis.value, degrees = options.degrees.value;
    if ((axis !== 'x' && axis !== 'y' && axis !== 'z') ||
        (degrees !== 90 && degrees !== 180 && degrees !== 270)) refuse();
    return { point: values, spec: { axis: axis as CardinalRotationAxis, degrees: degrees as CardinalRotationDegrees } };
  } catch {
    return refuse();
  }
}

export function rotateCardinalPoint(point: Point, spec: CardinalRotationSpec): Point {
  const admitted = admit(point, spec);
  const [x, y, z] = admitted.point;
  const { axis, degrees } = admitted.spec;
  let rotated: Point;
  switch (axis) {
    case 'x':
      rotated = degrees === 90 ? [x, -z, y] :
        degrees === 180 ? [x, -y, -z] : [x, z, -y];
      break;
    case 'y':
      rotated = degrees === 90 ? [z, y, -x] :
        degrees === 180 ? [-x, y, -z] : [-z, y, x];
      break;
    case 'z':
      rotated = degrees === 90 ? [-y, x, z] :
        degrees === 180 ? [-x, -y, z] : [y, -x, z];
  }
  if (rotated.some(v => Math.abs(v) > 10000))
    throw new RangeError('Cardinal target coordinate exceeds +/-10000mm');
  return rotated;
}

/** Stage an independent rotated Curve coefficient set; never mutates the source. */
export function rotateCardinalCurve(source: Curve, spec: CardinalRotationSpec): Curve {
  const controlPoints = source.controlPoints.map(point => rotateCardinalPoint(point, spec));
  return { ...source, knots: [...source.knots], weights: [...source.weights], controlPoints };
}

/** Stage an independent rotated Surface coefficient grid; qualification happens downstream. */
export function rotateCardinalSurface(source: Surface, spec: CardinalRotationSpec): Surface {
  const controlPoints = source.controlPoints.map(row => row.map(point => rotateCardinalPoint(point, spec)));
  return { ...source, knotsU: [...source.knotsU], knotsV: [...source.knotsV],
    weights: source.weights.map(row => [...row]), controlPoints };
}

type Mapping<T> = { original: T; rotated: T };
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
interface RotationResult<Pivoted extends boolean> {
  request: { parent: ConvexPlanarSolidResult; spec: CardinalRotationSpec; prefix: string } & (Pivoted extends true ? { pivotMM: Readonly<Point> } : object);
  solid: ConvexPlanarSolidResult;
  lineage: Lineage;
  report: {
    schema: 'barocss-modeling-rotation'; version: 0; lengthUnit: 'mm'; solid: true;
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
      completeParent: true; canonicalSignedPermutation: true;
      basisAndWeightBits: true; directedDomainBits: true; exactParameterMaps: true;
      bijectiveLineage: true; exactRotatedNormals: true; exactRotatedSupportsAndVertices: true;
      exactVolumeUnchanged: true; independentSourceNamespaces: true;
    } & (Pivoted extends true ? { exactPivotAffineCoefficients: true; zeroOffsetSignedCoefficientBits: true;
      nonzeroCancellationPositiveZero: true; derivedVerticesExactRational: true; exactAffineSupportOffsets: true }
      : { signedCoefficientBits: true; supportOffsetsUnchanged: true });
    numericPolicy: 'exact-rationals-of-stored-binary64-no-welding-no-tolerance-promotion';
    validationScope: 'whole-result-self-consistency-not-authenticity';
    persistentNamingCertified: false;
    limits: { faces: 10; directedUses: 48; pairs: 24; vertices: 16; coordinateAbsMM: 10000; rationalOperations: 200000; integerBits: 8192 };
    dataCharge: 'unchanged-solid-snapshot-ledger-alias-occurrences-not-v8-heap';
  };
}

export type ModelingRotationResult = RotationResult<false> | RotationResult<true>;

class ModelingRotationError extends Error {
  constructor(readonly code: ConvexPlanarSolidDiagnosticCode, readonly stage: string, readonly entity: string,
    detail: string, readonly report: Progress, cause: unknown) {
    super(('Modeling rotation: ' + detail).slice(0, 1024), { cause }); this.name = 'ModelingRotationError';
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

/** Fixed proper signed permutations; determinant +1 preserves directed cycles. */
function cardinalSignedMap(spec: CardinalRotationSpec): readonly (readonly [0 | 1 | 2, 1 | -1])[] {
  switch (spec.axis) {
    case 'x': return spec.degrees === 90 ? [[0, 1], [2, -1], [1, 1]] :
      spec.degrees === 180 ? [[0, 1], [1, -1], [2, -1]] : [[0, 1], [2, 1], [1, -1]];
    case 'y': return spec.degrees === 90 ? [[2, 1], [1, 1], [0, -1]] :
      spec.degrees === 180 ? [[0, -1], [1, 1], [2, -1]] : [[2, -1], [1, 1], [0, 1]];
    case 'z': return spec.degrees === 90 ? [[1, -1], [0, 1], [2, 1]] :
      spec.degrees === 180 ? [[0, -1], [1, -1], [2, 1]] : [[1, 1], [0, -1], [2, 1]];
  }
}

/** Omitted pivot retains the complete original three-argument path. */
export function buildModelingRotation(parent: ConvexPlanarSolidResult, spec: CardinalRotationSpec, prefix: string): RotationResult<false>;
export function buildModelingRotation(parent: ConvexPlanarSolidResult, spec: CardinalRotationSpec, prefix: string, pivotMM: Readonly<Point>): RotationResult<true>;
/** Reconstruct and qualify one complete origin or exact pivot-affine copy. */
export function buildModelingRotation(parentInput: ConvexPlanarSolidResult, canonicalSpecInput: CardinalRotationSpec, prefixInput: string, pivotInput?: Readonly<Point>): ModelingRotationResult {
  const hasPivot = arguments.length > 3;
  const ledger = new SolidSnapshotLedger();
  const rational = new SectionRationalContext((code, detail) => { throw new ConvexPlanarSolidError(code, detail); });
  const directCalls: DirectCalls = { parentValidationCount: 0, initialFaceConstructionCount: 0, targetQualificationCount: 0, retries: 0 };
  let parentValidation: ConvexPlanarSolidReport | null = null, stage = 'snapshot', entity = 'request';
  const at = <T>(nextStage: string, nextEntity: string, action: () => T): T => { stage = nextStage; entity = nextEntity; return action(); };
  try {
    // Complete, bounded own-data admission happens before reading the retained parent.
    const request = ledger.copy(hasPivot
      ? { parent: parentInput, spec: canonicalSpecInput, prefix: prefixInput, pivotMM: pivotInput }
      : { parent: parentInput, spec: canonicalSpecInput, prefix: prefixInput }, true);
    const { parent, spec, prefix } = request;
    at('admission', 'spec', () => check(spec !== null && typeof spec === 'object' && !Array.isArray(spec)
      && Object.keys(spec).length === 2 && Object.hasOwn(spec, 'axis') && Object.hasOwn(spec, 'degrees')
      && (spec.axis === 'x' || spec.axis === 'y' || spec.axis === 'z')
      && (spec.degrees === 90 || spec.degrees === 180 || spec.degrees === 270), 'INPUT', 'Canonical world-origin cardinal axis/degrees required'));
    const pivotMM = 'pivotMM' in request ? request.pivotMM : undefined;
    if (hasPivot) at('admission', 'pivotMM', () => check(arguments.length === 4 && Array.isArray(pivotMM) && pivotMM.length === 3
      && pivotMM.every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 10000),
    'INPUT', 'Exactly four arguments and three finite represented pivot coordinates within +/-10000mm required'));
    const signedMap = cardinalSignedMap(spec);
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
      id(value, maximum); check(!originalIds.has(value) && !generatedIds.has(value), 'IDENTITY', 'Every rotated namespace must be distinct from the complete parent and other target identities');
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

    // Offsets remain rational: neither p-R(p) nor an intermediate subtraction
    // must be binary64 or within the final coefficient coordinate bounds.
    const pivotOffsets = hasPivot ? at('stage-coefficients', 'pivotMM', () => signedMap.map(([axis, sign], targetAxis) => {
      const source = rational.from(pivotMM![axis]);
      return rational.sub(rational.from(pivotMM![targetAxis]), sign === 1 ? source : rational.neg(source));
    })) : null;
    const coordinates = hasPivot ? [new Map<number, number>(), new Map<number, number>(), new Map<number, number>()] : null;
    // A signed permutation is already exactly represented. Positive components
    // copy the selected coefficient; negative components use unary negation,
    // including +0/-0. Do not cache numeric keys, which merge the two zero signs.
    const rotatedPoint = (point: Point, location: string): Point => signedMap.map(([axis, sign], targetAxis) =>
      at('stage-coefficients', location + '/' + targetAxis, () => {
        let value = sign === 1 ? point[axis] : -point[axis];
        if (pivotOffsets !== null && pivotOffsets[targetAxis].n !== 0n) {
          const cached = coordinates![targetAxis].get(value);
          if (cached !== undefined) value = cached;
          else {
            const source = value;
            value = rational.exactFloat(rational.add(rational.from(source), pivotOffsets[targetAxis]));
            coordinates![targetAxis].set(source, value); // Nonzero exact cancellation is +0.
          }
        } // Zero affine offset bit-copies the selected signed coefficient.
        check(Number.isFinite(value) && Math.abs(value) <= 10000, 'REPRESENTABILITY', 'Exact target coordinate exceeds +/-10000mm');
        return value;
      })) as Point;
    const staged = originals.map(({ sourceId, face }, i) => {
      const name = names[i];
      const plane: Surface = { ...face.plane, id: name.surfaceId,
        knotsU: [...face.plane.knotsU], knotsV: [...face.plane.knotsV], weights: face.plane.weights.map(row => [...row]),
        controlPoints: face.plane.controlPoints.map((row, u) => row.map((point, v) => rotatedPoint(point, key(sourceId, face.plane.id) + '/' + u + '/' + v))) };
      const edges: Curve[] = face.loop.edges.map((curve, j) => ({ ...curve, id: name.curveIds[j], knots: [...curve.knots], weights: [...curve.weights],
        controlPoints: curve.controlPoints.map((point, p) => rotatedPoint(point, key(sourceId, curve.id) + '/' + p)) }));
      return { sourceId: name.sourceId, plane, loop: { id: name.loopId, edges }, options: name.options };
    });
    // This boundary is intentional: all Surface/Line coefficients for ALL Faces
    // have passed signed permutation and coordinate bounds before the first native Face.
    const assets = staged.map(plan => ({ sourceId: plan.sourceId, face: at('face-construction', plan.sourceId, () => {
      directCalls.initialFaceConstructionCount++; return buildConvexPlanarFace(plan.plane, plan.loop, plan.options);
    }) }));
    const lineage: Lineage = { faces: [], curves: [], pcurves: [], uses: [], localEdges: [], localVertices: [], edges: [], vertices: [] };
    const useMap = new Map<string, { sourceId: string; useId: string }>();
    const vertexMap = new Map<string, ConvexPlanarSolidVertexReference>();
    const fraction = (value: SectionFraction): SectionRational => rational.rat(BigInt(value.numerator), BigInt(value.denominator));
    const equalFraction = (a: SectionFraction, b: SectionFraction): boolean => rational.compare(fraction(a), fraction(b)) === 0;
    const checkPoint = (a: Point, b: Point): void => {
      for (const [targetAxis, [sourceAxis, sign]] of signedMap.entries()) {
        const source = rational.from(a[sourceAxis]), expected = sign === 1 ? source : rational.neg(source);
        const transformed = pivotOffsets === null ? expected : rational.add(expected, pivotOffsets[targetAxis]);
        check(rational.compare(transformed, rational.from(b[targetAxis])) === 0, 'BINDING', 'Actual target point differs from exact rotated parent');
        if (pivotOffsets === null) check(Object.is(sign === 1 ? a[sourceAxis] : -a[sourceAxis], b[targetAxis]), 'BINDING', 'Target coordinate differs from signed parent coefficient bits');
      }
    };
    for (const [i, original] of originals.entries()) at('face-lineage', original.sourceId, () => {
      const rotated = assets[i], a = original.face, b = rotated.face, plan = staged[i];
      check(same(b.plane, plan.plane) && same(b.loop, plan.loop) && same(b.options, plan.options), 'OWNED', 'Native Face did not adopt the complete staged Surface/Line data');
      check(a.sourceVersion === b.sourceVersion && b.sourceVersion === 0 && a.options.orientation === b.options.orientation, 'BINDING', 'Actual Source0 and original orientation required');
      check(a.topology.vertices.length === b.topology.vertices.length && a.topology.edges.length === b.topology.edges.length
        && a.topology.loop.uses.length === b.topology.loop.uses.length && a.pcurves.length === b.pcurves.length, 'COVERAGE', 'Complete local inventory must correspond bijectively');
      lineage.faces.push({ original: faceReference(original.sourceId, a), rotated: faceReference(rotated.sourceId, b) });
      const from = { sourceId: original.sourceId, faceId: a.options.faceId }, to = { sourceId: rotated.sourceId, faceId: b.options.faceId };
      for (const [j, curve] of a.loop.edges.entries()) {
        const next = b.loop.edges[j];
        check(curve.degree === next.degree && same(curve.knots, next.knots) && same(curve.weights, next.weights), 'BINDING', 'Line basis/domain/weight bits changed');
        lineage.curves.push({ original: { ...from, curveId: curve.id }, rotated: { ...to, curveId: next.id } });
      }
      check(a.plane.degreeU === b.plane.degreeU && a.plane.degreeV === b.plane.degreeV && same(a.plane.knotsU, b.plane.knotsU)
        && same(a.plane.knotsV, b.plane.knotsV) && same(a.plane.weights, b.plane.weights), 'BINDING', 'Surface basis/domain/weight bits changed');
      for (const [j, vertex] of a.topology.vertices.entries()) {
        const next = b.topology.vertices[j], originalRef = { ...from, vertexId: vertex.id }, rotatedRef = { ...to, vertexId: next.id };
        checkPoint(vertex.point, next.point); vertexMap.set(memberKey(originalRef), rotatedRef);
        lineage.localVertices.push({ original: originalRef, rotated: rotatedRef });
      }
      const curveMap = new Map(a.loop.edges.map((c, j) => [c.id, b.loop.edges[j].id]));
      const edgeMap = new Map(a.topology.edges.map((e, j) => [e.id, b.topology.edges[j].id]));
      const localVertex = (vertexId: string): string => {
        const ref = vertexMap.get(memberKey({ ...from, vertexId })); check(ref !== undefined, 'COVERAGE', 'Local vertex lineage is missing'); return ref.vertexId;
      };
      for (const [j, edge] of a.topology.edges.entries()) {
        const next = b.topology.edges[j];
        check(curveMap.get(edge.curveId) === next.curveId && same(edge.vertexIds.map(localVertex), next.vertexIds), 'INCIDENCE', 'Local edge membership changed');
        lineage.localEdges.push({ original: { ...from, edgeId: edge.id }, rotated: { ...to, edgeId: next.id } });
      }
      const pcurveMap = new Map<string, string>();
      for (const pc of a.pcurves) {
        const matches = b.pcurves.filter(next => next.curveId === curveMap.get(pc.curveId));
        check(matches.length === 1, 'COVERAGE', 'One actual generated pcurve per original Line required');
        const next = matches[0];
        check(edgeMap.get(pc.edgeId) === next.edgeId && same(pc.domain, next.domain)
          && pc.curve.degree === next.curve.degree && same(pc.curve.knots, next.curve.knots) && same(pc.curve.weights, next.curve.weights), 'BINDING', 'Generated pcurve domain/basis/weight bits changed');
        pcurveMap.set(pc.id, next.id);
        lineage.pcurves.push({ original: { ...from, pcurveId: pc.id }, rotated: { ...to, pcurveId: next.id } });
      }
      for (const [j, use] of a.topology.loop.uses.entries()) {
        const next: ConvexPlanarFaceUse = b.topology.loop.uses[j];
        check(curveMap.get(use.curveId) === next.curveId && edgeMap.get(use.edgeId) === next.edgeId && pcurveMap.get(use.pcurveId) === next.pcurveId
          && use.sense === next.sense && same(use.interval, next.interval) && same(use.vertexIds.map(localVertex), next.vertexIds), 'BINDING', 'Actual directed use order, domain, sense or incidence changed');
        const ref = { sourceId: rotated.sourceId, useId: next.id };
        check(!useMap.has(key(original.sourceId, use.id)), 'COVERAGE', 'Repeated original directed use');
        useMap.set(key(original.sourceId, use.id), ref);
        lineage.uses.push({ original: { ...from, useId: use.id }, rotated: { ...to, useId: next.id } });
      }
    });
    const edgePairs = at('pair-remapping', 'parent.request.edgePairs', () => parent.request.edgePairs.map(pair => {
      const a = useMap.get(key(pair.a.sourceId, pair.a.useId)), b = useMap.get(key(pair.b.sourceId, pair.b.useId));
      check(a !== undefined && b !== undefined, 'COVERAGE', 'Every original qualified pair requires two actual rotated uses'); return { a, b };
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
        lineage.vertices.push({ original: { vertexId: vertex.id }, rotated: { vertexId: next.id } });
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
        lineage.edges.push({ original: { edgeId: edge.id }, rotated: { edgeId: next.id } });
      }
      const mappedFace = (sourceId: string, faceId: string): FaceReference => {
        const found = lineage.faces.find(f => f.original.sourceId === sourceId && f.original.faceId === faceId);
        check(found !== undefined, 'COVERAGE', 'Source-qualified Face mapping required'); return found.rotated;
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
      const checkExactPoint = (a: ExactPointData, b: ExactPointData, position = true): void => {
        check(signedMap.every(([sourceAxis, sign], targetAxis) => {
          const source = fraction(a[sourceAxis]);
          const rotated = sign === 1 ? source : rational.neg(source);
          const expected = pivotOffsets !== null && position ? rational.add(rotated, pivotOffsets[targetAxis]) : rotated;
          return rational.compare(expected, fraction(b[targetAxis])) === 0;
        }), 'BINDING', 'Certified exact vector differs from rotated parent');
      };
      for (const support of parent.supports) {
        const ref = mappedFace(support.sourceId, support.faceId), matches = solid.supports.filter(s => s.sourceId === ref.sourceId && s.faceId === ref.faceId);
        check(matches.length === 1 && matches[0].surfaceId === ref.surfaceId, 'COVERAGE', 'Exactly one corresponding target support required');
        const next = matches[0];
        checkExactPoint(support.originMM, next.originMM);
        checkExactPoint(support.outwardNormal, next.outwardNormal, false);
        if (pivotOffsets !== null) {
          const displacement = rational.sum(signedMap.map(([axis, sign], targetAxis) => {
            const original = fraction(support.outwardNormal[axis]);
            return rational.mul(sign === 1 ? original : rational.neg(original), pivotOffsets[targetAxis]);
          }));
          check(rational.compare(rational.add(fraction(support.offset), displacement), fraction(next.offset)) === 0,
            'BINDING', 'Exact pivot-affine support equation changed');
        } else check(equalFraction(support.offset, next.offset), 'BINDING', 'Exact rotated support offset changed');
      }
      checkExactPoint(parent.certificate.strictInteriorMM, solid.certificate.strictInteriorMM);
      check(equalFraction(parent.certificate.volumeMM3, solid.certificate.volumeMM3), 'BINDING', 'Certified rational volume changed');
      // Each mapping's identity inventory must be injective on both sides. Coverage
      // above establishes surjectivity against the complete actual inventories.
      for (const mappings of Object.values(lineage)) {
        check(new Set(mappings.map(m => JSON.stringify(m.original))).size === mappings.length
          && new Set(mappings.map(m => JSON.stringify(m.rotated))).size === mappings.length, 'COVERAGE', 'Lineage must be bijective, never a nearest-point naming claim');
      }
    });
    const bindingCount = assets.reduce((sum, a) => sum + a.face.bindings.length, 0);
    const result = { request, solid, lineage, report: {
      schema: 'barocss-modeling-rotation', version: 0, lengthUnit: 'mm', solid: true, parentValidation, targetQualification: solid.report,
      directCalls: { ...directCalls },
      initialFaceConstruction: { faceCount: assets.length, sourceCompilationCount: assets.length, bindingObservationCount: bindingCount,
        curveD1Count: bindingCount, pcurveD1Count: bindingCount, surfaceD1Count: bindingCount, totalD1Count: bindingCount * 3,
        scope: 'direct-calls-and-known-parent-loop-work-not-hidden-provider-internals' },
      exactWork: rational.counts(),
      preservation: !hasPivot ? { completeParent: true, canonicalSignedPermutation: true, signedCoefficientBits: true, basisAndWeightBits: true,
        directedDomainBits: true, exactParameterMaps: true, bijectiveLineage: true, exactRotatedNormals: true,
        exactRotatedSupportsAndVertices: true, supportOffsetsUnchanged: true, exactVolumeUnchanged: true, independentSourceNamespaces: true } : {
        completeParent: true, canonicalSignedPermutation: true, exactPivotAffineCoefficients: true, zeroOffsetSignedCoefficientBits: true,
        nonzeroCancellationPositiveZero: true, derivedVerticesExactRational: true, basisAndWeightBits: true, directedDomainBits: true,
        exactParameterMaps: true, bijectiveLineage: true, exactRotatedNormals: true, exactRotatedSupportsAndVertices: true,
        exactAffineSupportOffsets: true, exactVolumeUnchanged: true, independentSourceNamespaces: true },
      numericPolicy: 'exact-rationals-of-stored-binary64-no-welding-no-tolerance-promotion', validationScope: 'whole-result-self-consistency-not-authenticity',
      persistentNamingCertified: false,
      limits: { faces: 10, directedUses: 48, pairs: 24, vertices: 16, coordinateAbsMM: 10000, rationalOperations: 200000, integerBits: 8192 },
      dataCharge: 'unchanged-solid-snapshot-ledger-alias-occurrences-not-v8-heap',
    } } as ModelingRotationResult;
    return at('snapshot', 'result', () => ledger.copy(result, true));
  } catch (cause) {
    const code = cause instanceof ConvexPlanarSolidError ? cause.code : 'NATIVE';
    const detail = stage === 'stage-coefficients' && code === 'REPRESENTABILITY'
      ? 'Exact target coordinate is not representable within the bounded binary64 policy: ' + (cause instanceof Error ? cause.message : '')
      : cause instanceof Error ? cause.message : 'Native construction refused';
    throw new ModelingRotationError(code, stage, entity, detail, { parentValidation, directCalls: { ...directCalls }, exactWork: rational.counts() }, cause);
  }
}
