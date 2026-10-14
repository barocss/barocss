import { buildModelingTranslation } from './modeling-translation-internal.js';
import type { ModelingTranslationResult } from './modeling-translation-internal.js';
import { validateConvexPlanarSolid } from './convex-planar-solid.js';
import type { ConvexPlanarSolidResult, ConvexPlanarSolidReport } from './convex-planar-solid.js';
import { check, id, same, SolidSnapshotLedger, ConvexPlanarSolidError } from './convex-planar-solid-proof-internal.js';
import type { ConvexPlanarSolidDiagnosticCode } from './convex-planar-solid-proof-internal.js';
import { SectionRationalContext } from './section-rational-internal.js';
import type { Point } from './types.js';

type ChildReport = ModelingTranslationResult['report'];
type DirectCalls = { parentValidationCount: number; translationCount: number; retries: 0 };
type ExactWork = ReturnType<SectionRationalContext['counts']>;
type Count = 2 | 3 | 4;
type Copies<C extends Count, T> = C extends 2 ? [T] : C extends 3 ? [T, T] : [T, T, T];
type Preflight<C extends Count> = { copyCount: C extends 2 ? 1 : C extends 3 ? 2 : 3; faceCount: number; surfaceCoordinateCount: number; curveCoordinateCount: number };
type Progress = { parentValidation: ConvexPlanarSolidReport | null; directCalls: DirectCalls; completedChildReports: ChildReport[]; exactWork: ExactWork };
type StagedFace = { surfacePoints: Point[][]; curvePoints: Point[][] };

/** Independently qualified translations of the same original, never copied certificates. */
interface PatternResult<C extends Count> {
  request: { parent: ConvexPlanarSolidResult; stepMM: Point; prefix: string } & (C extends 3 ? object : { count: C });
  copies: Copies<C, ModelingTranslationResult>;
  report: {
    schema: 'barocss-modeling-linear-pattern'; version: 0; lengthUnit: 'mm'; count: C;
    parentValidation: ConvexPlanarSolidReport;
    childReports: Copies<C, ChildReport>;
    directCalls: DirectCalls;
    totalNativeCalls: { parentValidationCount: number; initialFaceConstructionCount: number; targetQualificationCount: number; retries: 0 };
    preflight: Preflight<C>;
    exactWork: ExactWork;
    preservation: { sameOriginalParent: true; independentSourceNamespaces: true; completeQualifiedCopies: true; originalPreserved: true } & (C extends 3 ? { bothCopiesPreflighted: true } : { allCopiesPreflighted: true });
    limits: { faces: 10; directedUses: 48; pairs: 24; vertices: 16; coordinateAbsMM: 10000; rationalOperations: 200000; integerBits: 8192;
      snapshotCumulativeBytes: 50331648; snapshotRetainedBytes: 33554432; snapshotResultBytes: 16777216 };
    numericPolicy: 'exact-rationals-of-stored-binary64-no-welding-no-tolerance-promotion';
    validationScope: 'whole-result-self-consistency-not-authenticity';
    persistentNamingCertified: false;
    dataCharge: 'unchanged-solid-snapshot-ledger-alias-occurrences-not-v8-heap';
  };
}

export type ModelingLinearPatternResult = PatternResult<2> | PatternResult<3> | PatternResult<4>;

function freeze(value: unknown): void {
  if (value !== null && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
}
class ModelingLinearPatternError extends Error {
  constructor(readonly code: ConvexPlanarSolidDiagnosticCode, readonly stage: string, readonly entity: string,
    detail: string, readonly report: Progress, cause: unknown) {
    super(('Modeling linear pattern: ' + detail).slice(0, 1024), { cause }); this.name = 'ModelingLinearPatternError';
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

/** Preserve the three-argument count3 request and its exact-work sequence. */
export function buildModelingLinearPattern(parent: ConvexPlanarSolidResult, stepMM: Point, prefix: string): PatternResult<3>;
export function buildModelingLinearPattern(parent: ConvexPlanarSolidResult, stepMM: Point, prefix: string, count: 2): PatternResult<2>;
export function buildModelingLinearPattern(parent: ConvexPlanarSolidResult, stepMM: Point, prefix: string, count: 4): PatternResult<4>;
export function buildModelingLinearPattern(parent: ConvexPlanarSolidResult, stepMM: Point, prefix: string, count: 2 | 4): PatternResult<2> | PatternResult<4>;
/** Stage every complete coefficient set and namespace before the first child. */
export function buildModelingLinearPattern(parentInput: ConvexPlanarSolidResult, stepInput: Point, prefixInput: string, countInput?: 2 | 4): ModelingLinearPatternResult {
  const authoredCount = arguments.length > 3;
  const ledger = new SolidSnapshotLedger();
  const rational = new SectionRationalContext((code, detail) => { throw new ConvexPlanarSolidError(code, detail); });
  const directCalls: DirectCalls = { parentValidationCount: 0, translationCount: 0, retries: 0 };
  const completedChildReports: ChildReport[] = [];
  let parentValidation: ConvexPlanarSolidReport | null = null, stage = 'snapshot', entity = 'request';
  const at = <T>(nextStage: string, nextEntity: string, action: () => T): T => { stage = nextStage; entity = nextEntity; return action(); };
  try {
    const request = ledger.copy(authoredCount
      ? { parent: parentInput, stepMM: stepInput, prefix: prefixInput, count: countInput }
      : { parent: parentInput, stepMM: stepInput, prefix: prefixInput }, true);
    if (authoredCount) at('admission', 'count', () => check(arguments.length === 4 && (countInput === 2 || countInput === 4),
      'INPUT', 'New counts require exactly four arguments with literal count2 or count4'));
    const count: Count = authoredCount ? countInput as 2 | 4 : 3, copyCount = count - 1;
    const { parent, stepMM, prefix } = request;
    at('admission', 'stepMM', () => check(Array.isArray(stepMM) && stepMM.length === 3
      && stepMM.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10000)
      && stepMM.filter(value => value > 0).length === 1, 'INPUT', 'One positive represented cardinal step and two zero coordinates required'));
    at('admission', 'prefix', () => id(prefix, 13));
    freeze(request); // Freeze our own admitted copy, never the caller's object.
    parentValidation = at('parent-validation', 'parent', () => {
      directCalls.parentValidationCount++; return validateConvexPlanarSolid(parent);
    });
    const originals = parent.request.assets;
    at('admission', 'parent-inventory', () => check(originals.length <= 10 && parent.graph.edges.length <= 24
      && parent.graph.vertices.length <= 16 && originals.reduce((sum, asset) => sum + asset.face.topology.loop.uses.length, 0) <= 48,
      'BUDGET', 'Qualified convex inventory exceeds10 Faces/48 uses/24 pairs/16 vertices'));
    const offsets: Point[] = [stepMM];
    if (count !== 2) offsets.push(at('stage-coefficients', 'twice-stepMM', () => stepMM.map(value => {
      if (value === 0) return value; // Preserve authored zero signs on unused axes.
      const doubled = value * 2;
      check(Number.isFinite(doubled) && doubled <= 10000
        && rational.compare(rational.mul(rational.from(value), rational.integer(2)), rational.from(doubled)) === 0,
      'REPRESENTABILITY', 'Twice-spacing must be exactly represented within10000mm'); return doubled;
    }) as Point));
    if (count === 4) offsets.push(at('stage-coefficients', 'thrice-stepMM', () => stepMM.map(value => {
      if (value === 0) return value;
      const tripled = value * 3;
      check(Number.isFinite(tripled) && tripled <= 10000
        && rational.compare(rational.mul(rational.from(value), rational.integer(3)), rational.from(tripled)) === 0,
      'REPRESENTABILITY', 'Thrice-spacing must be exactly represented within10000mm'); return tripled;
    }) as Point));
    const prefixes = offsets.map((_, instance) => prefix + '_i' + (instance + 1));
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
    const preflight = { copyCount, faceCount: originals.length * copyCount, surfaceCoordinateCount: 0, curveCoordinateCount: 0 };
    const staged: StagedFace[][] = offsets.map((offset, instance) => {
      const exactOffsets = offset.map(value => rational.from(value));
      const point = (source: Point, location: string, surface: boolean): Point => source.map((value, axis) =>
        at('stage-coefficients', prefixes[instance] + '/' + location + '/' + axis, () => {
          const expected = rational.add(rational.from(value), exactOffsets[axis]);
          const target = offset[axis] === 0 ? value : expected.n === 0n ? 0 : value + offset[axis];
          check(Number.isFinite(target) && Math.abs(target) <= 10000
            && rational.compare(expected, rational.from(target)) === 0, 'REPRESENTABILITY', 'Both-copy target coefficients must be exactly represented within+/-10000mm');
          check(offset[axis] !== 0 || Object.is(value, target), 'BINDING', 'Zero-offset coordinate bits changed');
          if (surface) preflight.surfaceCoordinateCount++; else preflight.curveCoordinateCount++;
          return target;
        })) as Point;
      return originals.map(({ sourceId, face }) => ({
        surfacePoints: face.plane.controlPoints.map((row, u) => row.map((pole, v) => point(pole, sourceId + '/' + face.plane.id + '/' + u + '/' + v, true))),
        curvePoints: face.loop.edges.map(curve => curve.controlPoints.map((pole, p) => point(pole, sourceId + '/' + curve.id + '/' + p, false))),
      }));
    });
    at('snapshot', 'both-copy-preflight', () => ledger.copy(staged, false, true));
    // These delegated boundary charges include aliases. Each unchanged child and
    // native validator also enforces its own ledger; this is not a V8 heap claim.
    const copies: ModelingTranslationResult[] = [];
    for (const [instance, offsetMM] of offsets.entries()) {
      at('snapshot', prefixes[instance] + '/request', () => ledger.copy({ parent, offsetMM, prefix: prefixes[instance] }, true, true));
      const child = at('copy-construction', prefixes[instance], () => {
        directCalls.translationCount++; return buildModelingTranslation(parent, offsetMM, prefixes[instance]);
      });
      completedChildReports.push(child.report);
      at('snapshot', prefixes[instance] + '/result', () => ledger.copy(child, true, true));
      at('copy-binding', prefixes[instance], () => {
        check(same(child.request.parent, parent) && same(child.request.offsetMM, offsetMM) && child.request.prefix === prefixes[instance],
          'OWNED', 'Both copies must retain the same complete original parent and their staged offset');
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
    const childReports = copies.map(child => child.report);
    const sum = (field: 'parentValidationCount' | 'initialFaceConstructionCount' | 'targetQualificationCount'): number =>
      childReports.reduce((total, report) => total + report.directCalls[field], 0);
    const result = { request, copies, report: {
      schema: 'barocss-modeling-linear-pattern', version: 0, lengthUnit: 'mm', count, parentValidation, childReports,
      directCalls: { ...directCalls }, totalNativeCalls: { parentValidationCount: directCalls.parentValidationCount + sum('parentValidationCount'),
        initialFaceConstructionCount: sum('initialFaceConstructionCount'), targetQualificationCount: sum('targetQualificationCount'), retries: 0 },
      preflight, exactWork: rational.counts(), preservation: count === 3 ? { sameOriginalParent: true, bothCopiesPreflighted: true,
        independentSourceNamespaces: true, completeQualifiedCopies: true, originalPreserved: true } : {
        sameOriginalParent: true, allCopiesPreflighted: true,
        independentSourceNamespaces: true, completeQualifiedCopies: true, originalPreserved: true },
      limits: { faces: 10, directedUses: 48, pairs: 24, vertices: 16, coordinateAbsMM: 10000, rationalOperations: 200000, integerBits: 8192,
        snapshotCumulativeBytes: 50331648, snapshotRetainedBytes: 33554432, snapshotResultBytes: 16777216 },
      numericPolicy: 'exact-rationals-of-stored-binary64-no-welding-no-tolerance-promotion', validationScope: 'whole-result-self-consistency-not-authenticity',
      persistentNamingCertified: false, dataCharge: 'unchanged-solid-snapshot-ledger-alias-occurrences-not-v8-heap',
    } } as ModelingLinearPatternResult;
    return at('snapshot', 'result', () => ledger.copy(result, true));
  } catch (cause) {
    throw new ModelingLinearPatternError(causeCode(cause), stage, entity, cause instanceof Error ? cause.message : 'Native pattern construction refused',
      { parentValidation, directCalls: { ...directCalls }, completedChildReports: [...completedChildReports], exactWork: rational.counts() }, cause);
  }
}
