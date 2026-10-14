import { buildModelingRotation } from './modeling-rotation-internal.js';
import type { ModelingRotationResult, CardinalRotationSpec } from './modeling-rotation-internal.js';
import { validateConvexPlanarSolid } from './convex-planar-solid.js';
import type { ConvexPlanarSolidResult, ConvexPlanarSolidReport } from './convex-planar-solid.js';
import { check, id, same, SolidSnapshotLedger, ConvexPlanarSolidError } from './convex-planar-solid-proof-internal.js';
import type { ConvexPlanarSolidDiagnosticCode } from './convex-planar-solid-proof-internal.js';
import { SectionRationalContext } from './section-rational-internal.js';
import type { Point } from './types.js';

export type CircularPatternSpec = Readonly<{ axis: 'x' | 'y' | 'z'; angleDegrees: 90 | -90 }>;

type ChildReport = ModelingRotationResult['report'];
type DirectCalls = { parentValidationCount: number; rotationCount: number; retries: 0 };
type ExactWork = ReturnType<SectionRationalContext['counts']>;
type Preflight = { copyCount: 2; faceCount: number; surfaceCoordinateCount: number; curveCoordinateCount: number };
type Progress = { parentValidation: ConvexPlanarSolidReport | null; directCalls: DirectCalls; completedChildReports: ChildReport[]; exactWork: ExactWork };
type StagedFace = { surfacePoints: Point[][]; curvePoints: Point[][] };

/** Two independently qualified cardinal rotations of the same original, never a copied certificate. */
export interface ModelingCircularPatternResult {
  request: { parent: ConvexPlanarSolidResult; spec: CircularPatternSpec; prefix: string };
  copies: [ModelingRotationResult, ModelingRotationResult];
  report: {
    schema: 'barocss-modeling-circular-pattern'; version: 0; lengthUnit: 'mm'; count: 3;
    parentValidation: ConvexPlanarSolidReport;
    childSpecs: [CardinalRotationSpec, CardinalRotationSpec];
    childReports: [ChildReport, ChildReport];
    directCalls: DirectCalls;
    totalNativeCalls: { parentValidationCount: number; initialFaceConstructionCount: number; targetQualificationCount: number; retries: 0 };
    preflight: Preflight;
    exactWork: ExactWork;
    preservation: { sameOriginalParent: true; bothCopiesPreflighted: true; independentSourceNamespaces: true; completeQualifiedCopies: true; originalPreserved: true };
    limits: { faces: 10; directedUses: 48; pairs: 24; vertices: 16; coordinateAbsMM: 10000; rationalOperations: 200000; integerBits: 8192;
      snapshotCumulativeBytes: 50331648; snapshotRetainedBytes: 33554432; snapshotResultBytes: 16777216 };
    numericPolicy: 'exact-rationals-of-stored-binary64-no-welding-no-tolerance-promotion';
    validationScope: 'whole-result-self-consistency-not-authenticity';
    persistentNamingCertified: false;
    dataCharge: 'unchanged-solid-snapshot-ledger-alias-occurrences-not-v8-heap';
  };
}

function freeze(value: unknown): void {
  if (value !== null && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
}
class ModelingCircularPatternError extends Error {
  constructor(readonly code: ConvexPlanarSolidDiagnosticCode, readonly stage: string, readonly entity: string,
    detail: string, readonly report: Progress, cause: unknown) {
    super(('Modeling circular pattern: ' + detail).slice(0, 1024), { cause }); this.name = 'ModelingCircularPatternError';
    // Preserve completed child reports and the untouched original child cause.
    // Failed construction never returns a partially accepted pattern.
    freeze(report);
  }
}

/** Complete logical namespaces; repeated references to one identity do not allocate new identities. */
function namespaces(solid: ConvexPlanarSolidResult): string[] {
  return [solid.request.options.solidId, solid.request.options.resultIdPrefix,
    ...solid.graph.edges.map(edge => edge.id), ...solid.graph.vertices.map(vertex => vertex.id),
    ...solid.request.assets.flatMap(({ sourceId, face }) => [sourceId, face.plane.id, face.loop.id,
      face.options.faceId, face.options.evaluationId, face.options.resultIdPrefix,
      ...face.loop.edges.map(curve => curve.id), ...face.pcurves.map(curve => curve.id),
      ...face.topology.vertices.map(vertex => vertex.id), ...face.topology.edges.map(edge => edge.id),
      ...face.topology.loop.uses.map(use => use.id)])];
}
function causeCode(cause: unknown): ConvexPlanarSolidDiagnosticCode {
  if (cause instanceof ConvexPlanarSolidError) return cause.code;
  if (cause !== null && typeof cause === 'object') {
    const descriptor = Object.getOwnPropertyDescriptor(cause, 'code'), value: unknown = descriptor?.value;
    if (typeof value === 'string' && ['INPUT', 'IDENTITY', 'BUDGET', 'NATIVE', 'OWNED', 'COVERAGE', 'BINDING', 'INCIDENCE', 'CONVEXITY', 'DEGENERATE', 'REPRESENTABILITY'].includes(value)) return value as ConvexPlanarSolidDiagnosticCode;
  }
  return 'NATIVE';
}

/** Proper signed permutations preserve directed cycles; no trigonometry or rounding. */
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

/** Preflight both complete coefficient sets before either unchanged child constructor. */
export function buildModelingCircularPattern(parentInput: ConvexPlanarSolidResult, specInput: CircularPatternSpec, prefixInput: string): ModelingCircularPatternResult {
  const ledger = new SolidSnapshotLedger();
  const rational = new SectionRationalContext((code, detail) => { throw new ConvexPlanarSolidError(code, detail); });
  const directCalls: DirectCalls = { parentValidationCount: 0, rotationCount: 0, retries: 0 };
  const completedChildReports: ChildReport[] = [];
  let parentValidation: ConvexPlanarSolidReport | null = null, stage = 'snapshot', entity = 'request';
  const at = <T>(nextStage: string, nextEntity: string, action: () => T): T => { stage = nextStage; entity = nextEntity; return action(); };
  try {
    const request = ledger.copy({ parent: parentInput, spec: specInput, prefix: prefixInput }, true);
    const { parent, spec, prefix } = request;
    at('admission', 'spec', () => check(spec !== null && typeof spec === 'object' && !Array.isArray(spec)
      && Object.keys(spec).length === 2 && Object.hasOwn(spec, 'axis') && Object.hasOwn(spec, 'angleDegrees')
      && (spec.axis === 'x' || spec.axis === 'y' || spec.axis === 'z') && (spec.angleDegrees === 90 || spec.angleDegrees === -90),
    'INPUT', 'Exactly one principal axis and a represented +90 or -90 degree step required'));
    at('admission', 'prefix', () => id(prefix, 13));
    freeze(request); // Freeze our own admitted copy, never the caller's object.
    parentValidation = at('parent-validation', 'parent', () => {
      directCalls.parentValidationCount++; return validateConvexPlanarSolid(parent);
    });
    const originals = parent.request.assets;
    at('admission', 'parent-inventory', () => check(originals.length <= 10 && parent.graph.edges.length <= 24
      && parent.graph.vertices.length <= 16 && originals.reduce((sum, asset) => sum + asset.face.topology.loop.uses.length, 0) <= 48,
      'BUDGET', 'Qualified convex inventory exceeds10 Faces/48 uses/24 pairs/16 vertices'));
    const childSpecs: [CardinalRotationSpec, CardinalRotationSpec] = [
      { axis: spec.axis, degrees: spec.angleDegrees === 90 ? 90 : 270 }, { axis: spec.axis, degrees: 180 },
    ];
    const prefixes: [string, string] = [prefix + '_i1', prefix + '_i2'];
    const parentIds = new Set(namespaces(parent)), allocated = new Set<string>();
    const fresh = (value: string, maximum = 48): string => at('identity', value, () => {
      id(value, maximum); check(!parentIds.has(value) && !allocated.has(value), 'IDENTITY', 'Every pattern namespace must be distinct from the complete parent and both targets');
      allocated.add(value); return value;
    });
    fresh(prefix, 13);
    // Freeze the unchanged child's complete deterministic ID plan before geometry.
    const plannedNamespaces = prefixes.map(childPrefix => {
      const planned: string[] = [], reserve = (value: string, maximum = 48) => { planned.push(fresh(value, maximum)); return value; };
      reserve(childPrefix, 16); reserve(childPrefix + '_solid'); const solidPrefix = reserve(childPrefix + '_s', 20);
      for (const [i] of parent.graph.edges.entries()) reserve(solidPrefix + '_e_' + i);
      for (const [i] of parent.graph.vertices.entries()) reserve(solidPrefix + '_v_' + i);
      for (const [i, { face }] of originals.entries()) {
        const facePrefix = reserve(childPrefix + '_f' + i, 20);
        for (const role of ['src', 'surface', 'loop', 'face', 'model']) reserve(facePrefix + '_' + role);
        for (const [j] of face.loop.edges.entries()) reserve(facePrefix + '_curve_' + j);
        for (const [j] of face.loop.edges.entries()) for (const role of ['v', 'e', 'use', 'uv']) reserve(facePrefix + '_' + role + '_' + j);
      }
      return planned;
    });
    const preflight: Preflight = { copyCount: 2, faceCount: originals.length * 2, surfaceCoordinateCount: 0, curveCoordinateCount: 0 };
    const staged: [StagedFace[], StagedFace[]] = childSpecs.map((childSpec, instance) => {
      const signedMap = cardinalSignedMap(childSpec);
      // Positive entries retain the selected binary64 coefficient. Unary minus
      // maps the sign bit, including +0/-0. Numeric-key caches would merge zeros.
      const point = (source: Point, location: string, surface: boolean): Point => signedMap.map(([axis, sign], targetAxis) =>
        at('stage-coefficients', prefixes[instance] + '/' + location + '/' + targetAxis, () => {
          const target = sign === 1 ? source[axis] : -source[axis];
          check(Number.isFinite(target) && Math.abs(target) <= 10000, 'REPRESENTABILITY',
            'Both-copy signed coefficients must be finite within +/-10000mm');
          if (surface) preflight.surfaceCoordinateCount++; else preflight.curveCoordinateCount++;
          return target;
        })) as Point;
      return originals.map(({ sourceId, face }) => ({
        surfacePoints: face.plane.controlPoints.map((row, u) => row.map((pole, v) => point(pole, sourceId + '/' + face.plane.id + '/' + u + '/' + v, true))),
        curvePoints: face.loop.edges.map(curve => curve.controlPoints.map((pole, p) => point(pole, sourceId + '/' + curve.id + '/' + p, false))),
      }));
    }) as [StagedFace[], StagedFace[]];
    at('snapshot', 'both-copy-preflight', () => ledger.copy(staged, false, true));
    // These delegated boundary charges include aliases. Each unchanged child and
    // native validator also enforces its own ledger; this is not a V8 heap claim.
    const copies: ModelingRotationResult[] = [];
    for (const [instance, childSpec] of childSpecs.entries()) {
      at('snapshot', prefixes[instance] + '/request', () => ledger.copy({ parent, spec: childSpec, prefix: prefixes[instance] }, true, true));
      const child = at('copy-construction', prefixes[instance], () => {
        directCalls.rotationCount++; return buildModelingRotation(parent, childSpec, prefixes[instance]);
      });
      completedChildReports.push(child.report);
      at('snapshot', prefixes[instance] + '/result', () => ledger.copy(child, true, true));
      at('copy-binding', prefixes[instance], () => {
        check(same(child.request.parent, parent) && same(child.request.spec, childSpec) && child.request.prefix === prefixes[instance],
          'OWNED', 'Both copies must retain the same complete original parent and their canonical signed rotation');
        check(child.solid.request.assets.length === originals.length, 'COVERAGE', 'Every original Face requires one qualified target Face');
        for (const [i, asset] of child.solid.request.assets.entries()) {
          check(same(asset.face.plane.controlPoints, staged[instance][i].surfacePoints)
            && same(asset.face.loop.edges.map(curve => curve.controlPoints), staged[instance][i].curvePoints),
          'BINDING', 'Actual child Surface/Line coefficients differ from complete both-copy preflight');
        }
        const actual = [child.request.prefix, ...namespaces(child.solid)];
        check(new Set(actual).size === actual.length && same([...actual].sort(), [...plannedNamespaces[instance]].sort()),
          'IDENTITY', 'Complete actual child namespaces must match the independent reserved plan');
        check(child.solid.certificate.solid === true && child.report.parentValidation.solid === true && child.report.targetQualification.solid === true,
          'OWNED', 'Both actual complete child native Solid qualifications required');
        check(same(child.report.parentValidation, parentValidation), 'OWNED', 'Child must validate the complete same original parent');
      });
      copies.push(child);
    }
    const children: [ModelingRotationResult, ModelingRotationResult] = [copies[0], copies[1]];
    const childReports: [ChildReport, ChildReport] = [children[0].report, children[1].report];
    const sum = (field: 'parentValidationCount' | 'initialFaceConstructionCount' | 'targetQualificationCount'): number =>
      childReports.reduce((total, report) => total + report.directCalls[field], 0);
    const result: ModelingCircularPatternResult = { request, copies: children, report: {
      schema: 'barocss-modeling-circular-pattern', version: 0, lengthUnit: 'mm', count: 3, parentValidation, childSpecs, childReports,
      directCalls: { ...directCalls }, totalNativeCalls: { parentValidationCount: directCalls.parentValidationCount + sum('parentValidationCount'),
        initialFaceConstructionCount: sum('initialFaceConstructionCount'), targetQualificationCount: sum('targetQualificationCount'), retries: 0 },
      preflight, exactWork: rational.counts(), preservation: { sameOriginalParent: true, bothCopiesPreflighted: true,
        independentSourceNamespaces: true, completeQualifiedCopies: true, originalPreserved: true },
      limits: { faces: 10, directedUses: 48, pairs: 24, vertices: 16, coordinateAbsMM: 10000, rationalOperations: 200000, integerBits: 8192,
        snapshotCumulativeBytes: 50331648, snapshotRetainedBytes: 33554432, snapshotResultBytes: 16777216 },
      numericPolicy: 'exact-rationals-of-stored-binary64-no-welding-no-tolerance-promotion', validationScope: 'whole-result-self-consistency-not-authenticity',
      persistentNamingCertified: false, dataCharge: 'unchanged-solid-snapshot-ledger-alias-occurrences-not-v8-heap',
    } };
    return at('snapshot', 'result', () => ledger.copy(result, true));
  } catch (cause) {
    throw new ModelingCircularPatternError(causeCode(cause), stage, entity, cause instanceof Error ? cause.message : 'Native pattern construction refused',
      { parentValidation, directCalls: { ...directCalls }, completedChildReports: [...completedChildReports], exactWork: rational.counts() }, cause);
  }
}
