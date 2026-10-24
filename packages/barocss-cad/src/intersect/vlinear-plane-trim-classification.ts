import { validateVLinearSurfacePlaneTrimCandidates } from './vlinear-plane-trim.js';
import type { VLinearSurfacePlaneTrimResult } from './vlinear-plane-trim.js';
import { SectionRationalContext } from '../section-rational-internal.js';
import type { SectionRational, SectionFraction } from '../section-rational-internal.js';
import { same } from '../core/structural-equality.js';
import { KernelError } from '../core/barocss-error.js';

export const VLinearSurfacePlaneTrimUVDiagnosticCode = Object.freeze({ INPUT: 'INPUT', IDENTITY: 'IDENTITY', BUDGET: 'BUDGET', TRIM: 'TRIM', BINDING: 'BINDING', OWNED: 'OWNED' } as const);
export type VLinearSurfacePlaneTrimUVDiagnosticCode = typeof VLinearSurfacePlaneTrimUVDiagnosticCode[keyof typeof VLinearSurfacePlaneTrimUVDiagnosticCode];
export class VLinearSurfacePlaneTrimUVError extends KernelError {
  readonly code: VLinearSurfacePlaneTrimUVDiagnosticCode;
  constructor(code: VLinearSurfacePlaneTrimUVDiagnosticCode, detail: string, cause?: unknown) {
    super(('V-linear trim UV classification: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause }); this.name = 'VLinearSurfacePlaneTrimUVError'; this.code = code;
  }
}
export interface VLinearSurfacePlaneTrimUVQuery { queryId: string; u: number; v: number }
export interface VLinearSurfacePlaneTrimUVOptions { evaluationId: string; maxQueries: number; maxSubdivisions: number }
type Relation = 'below' | 'above' | 'on' | 'uncertain' | 'not-applicable';
type Material = 'inside' | 'outside' | 'boundary' | 'uncertain';
type ChartBoundary = 'u-min' | 'u-max' | 'v-min' | 'v-max';
type Classification = { queryId: string; chart: 'outside' | 'interior' | 'boundary'; chartBoundaries: ChartBoundary[]; cutRelation: Relation;
  faces: [{ sourceId: string; surfaceId: string; faceId: string; classification: Material }, { sourceId: string; surfaceId: string; faceId: string; classification: Material }] };
type Bracket = [SectionFraction, SectionFraction];
type Step = { index: number; bracketBefore: Bracket; midpoint: SectionFraction; midHomogeneous: SectionFraction[]; uNumerator: SectionFraction; vNumerator: SectionFraction; uSign: number; vSign: number; selection: 'lower' | 'upper' | 'exact-root'; bracketAfter: Bracket };
type Witness = { kind: 'endpoint' | 'midpoint' | 'constant-v'; normalizedParameter: SectionFraction | null; homogeneous: SectionFraction[] | null; uNumerator: SectionFraction | null; vNumerator: SectionFraction | null };
type QueryProof = { queryId: string; method: 'outside-chart' | 'natural-v-boundary' | 'u-endpoint' | 'positive-weight-hull' | 'exact-root' | 'zero-v-polynomial' | 'iteration-cap'; bracket: Bracket | null;
  homogeneous: SectionFraction[][]; uNumerators: SectionFraction[]; vNumerators: SectionFraction[]; uSigns: number[]; vSigns: number[]; steps: Step[]; witness: Witness | null };
type Proof = { curveId: string; queries: QueryProof[] };
export interface VLinearSurfacePlaneTrimUVReport {
  schema: 'barocss-vlinear-surface-plane-trim-uv-classification'; version: 0; evaluationId: string; sourceId: string; surfaceId: string; sharedCutEdgeId: string; cutPcurveId: string;
  lengthUnit: 'dimensionless'; parameterFrame: 'original-support-u-v'; authority: 'unchanged-stored-positive-weight-monotone-u-graph';
  queryCount: number; totalSubdivisions: number; chartCounts: { outside: number; interior: number; boundary: number }; relationCounts: { below: number; above: number; on: number; uncertain: number; 'not-applicable': number };
  faceCounts: { faceId: string; inside: number; outside: number; boundary: number; uncertain: number }[];
  directCounts: { trimValidationCount: 1; curvePointEvaluationCount: 0; curveDerivativeEvaluationCount: 0; surfacePointEvaluationCount: 0; surfaceDerivativeEvaluationCount: 0; sourceCompilationCount: 0 };
  rationalCounts: ReturnType<SectionRationalContext['counts']>;
  numericPolicy: { input: 'exact-represented-original-dimensionless-uv'; subdivision: 'exact-homogeneous-de-casteljau-halves-with-strict-unique-u-root-bracket'; material: 'restricted-positive-weight-v-numerator-signs'; boundary: 'exact-endpoint-or-root-equality-or-zero-v-polynomial'; iterationLimit: 'successful-uncertain-no-guess'; arithmeticLimit: 'atomic-budget-error-no-partial-result'; toleranceUsed: false; nativeD0EqualityAuthority: false };
  quality: { uvMaterialClassificationOnly: true; parentModelGapProofUnchanged: true; worldProjectionPerformed: false; idealPlaneSideCertified: false; geometricValidity: 'not-certified'; topologyCertified: false; solid: false; insideOutsideCertified: false; embeddedManifoldCertified: false; manufacturingToleranceCertified: false; globalBinary64EvaluationErrorCertified: false; ownership: 'independent-copied-cpu-data-gc' };
  limits: { maximumQueries: 4; maximumSubdivisionsPerQuery: 16; maximumTotalSubdivisions: 64; queryCoordinateAbs: 10000; rationalOperations: 200000; gcdSteps: 200000; rationalIntegerBits: 8192; fractionIntegerCharacters: 5000; ownValues: 1048576; ownDepth: 64; arrayElements: 8192; recordFields: 64; stringCharacters: 262144 };
  workScope: 'direct-root-trim-validation-and-new-exact-arithmetic-parent-internal-work-excluded';
}
export interface VLinearSurfacePlaneTrimUVResult { trim: VLinearSurfacePlaneTrimResult; queries: VLinearSurfacePlaneTrimUVQuery[]; options: VLinearSurfacePlaneTrimUVOptions; classifications: Classification[]; proof: Proof; report: VLinearSurfacePlaneTrimUVReport }

const CODE = VLinearSurfacePlaneTrimUVDiagnosticCode;
function check(condition: boolean, code: VLinearSurfacePlaneTrimUVDiagnosticCode, detail: string): asserts condition { if (!condition) throw new VLinearSurfacePlaneTrimUVError(code, detail); }
function record(input: unknown, fields: string[], code: VLinearSurfacePlaneTrimUVDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), code, 'An own record is required'); const data = input as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'Exact own fields are required'); return data;
}
function id(input: unknown): string { check(typeof input === 'string' && input.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(input), CODE.IDENTITY, 'ASCII ID1..48 is required'); return input; }
function snapshot(input: unknown, owned = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT; let remaining = 1048576; const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 64, owned ? CODE.OWNED : CODE.BUDGET, 'Own value/depth budget exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'Finite represented own numbers are required'); return value; }
    if (typeof value === 'string') { check(value.length <= 262144, owned ? CODE.OWNED : CODE.BUDGET, 'Own string budget exceeded'); return value; }
    check(typeof value === 'object' && !ancestors.has(value), code, 'Acyclic own data is required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'Plain own-data prototypes are required');
    check(keys.length <= (array ? 8193 : 64) && keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'Bounded fields without getters/symbols/hidden data are required');
    ancestors.add(value); let result: unknown;
    if (array) { const length = descriptors.length.value as number; check(Number.isInteger(length) && length >= 0 && length <= 8192 && keys.length === length + 1, code, 'Dense bounded arrays are required');
      result = Array.from({ length }, (_, index) => { check(Object.hasOwn(descriptors, String(index)), code, 'Sparse/extra array fields are refused'); return copy(descriptors[String(index)].value, depth + 1); });
    } else result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    ancestors.delete(value); return result;
  };
  try { return copy(input, 0); } catch (cause) { if (cause instanceof VLinearSurfacePlaneTrimUVError) throw cause; throw new VLinearSurfacePlaneTrimUVError(code, 'Own snapshot failed', cause); }
}
/** Collect complete copied source/model/topology/child identity contexts, including split helper receipts. */
function contexts(input: unknown): Set<string> {
  const result = new Set<string>(); const visit = (value: unknown, key = ''): void => {
    if (typeof value === 'string') { if (key === 'id' || key === 'name' || /Ids?$/.test(key) || key === 'resultIdPrefix') result.add(value); return; }
    if (Array.isArray(value)) { value.forEach(item => visit(item, key)); return; }
    if (value && typeof value === 'object') for (const [field, item] of Object.entries(value)) visit(item, field);
  }; visit(input); return result;
}

/** Query exact stored UV material; unresolved iteration brackets are successful uncertain results. */
export function classifyVLinearSurfacePlaneTrimUV(trimInput: VLinearSurfacePlaneTrimResult, queriesInput: VLinearSurfacePlaneTrimUVQuery[], optionsInput: VLinearSurfacePlaneTrimUVOptions): VLinearSurfacePlaneTrimUVResult {
  const input = record(snapshot({ trim: trimInput, queries: queriesInput, options: optionsInput }), ['trim', 'queries', 'options']), settings = record(input.options, ['evaluationId', 'maxQueries', 'maxSubdivisions']);
  const options: VLinearSurfacePlaneTrimUVOptions = { evaluationId: id(settings.evaluationId), maxQueries: settings.maxQueries as number, maxSubdivisions: settings.maxSubdivisions as number };
  check(typeof settings.maxQueries === 'number' && Number.isInteger(settings.maxQueries) && settings.maxQueries >= 1 && settings.maxQueries <= 4 && typeof settings.maxSubdivisions === 'number' && Number.isInteger(settings.maxSubdivisions) && settings.maxSubdivisions >= 0 && settings.maxSubdivisions <= 16, CODE.BUDGET, 'Integer query1..4/subdivision0..16 limits are required');
  check(Array.isArray(input.queries) && input.queries.length >= 1, CODE.INPUT, 'At least one original UV query is required');
  check(input.queries.length <= options.maxQueries && input.queries.length <= 4, CODE.BUDGET, 'All queries must fit the declared hard maximum before parent validation');
  const reserved = contexts(input.trim); check(!reserved.has(options.evaluationId), CODE.IDENTITY, 'Evaluation ID must differ from every authored/generated trim/source/model context'); reserved.add(options.evaluationId);
  const queries = input.queries.map(value => { const data = record(value, ['queryId', 'u', 'v']), queryId = id(data.queryId);
    check(!reserved.has(queryId), CODE.IDENTITY, 'Query IDs must be unique against all original/generated contexts and each other'); reserved.add(queryId);
    check(typeof data.u === 'number' && typeof data.v === 'number' && Number.isFinite(data.u) && Number.isFinite(data.v) && Math.abs(data.u) <= 10000 && Math.abs(data.v) <= 10000, CODE.INPUT, 'Finite original dimensionless UV coordinates within10000 are required');
    return { queryId, u: data.u, v: data.v };
  });
  const trim = input.trim as VLinearSurfacePlaneTrimResult;
  try { validateVLinearSurfacePlaneTrimCandidates(trim); } catch (cause) { throw new VLinearSurfacePlaneTrimUVError(CODE.TRIM, 'Actual whole1083 owned trim validation refused', cause); }
  const edge = trim.edges.find(value => value.role === 'sharedCut'); check(edge !== undefined && trim.faces.length === 2, CODE.BINDING, 'Actual shared cut and two original qualified candidates are required');
  const curve = edge.pcurve.curve, domains = trim.section.report.surfaceDomains, q = new SectionRationalContext((kind, detail) => { throw new VLinearSurfacePlaneTrimUVError(kind === 'BUDGET' ? CODE.BUDGET : CODE.BINDING, detail); }), zero = q.integer(0), one = q.integer(1), half = q.rat(1n, 2n);
  const text = (values: SectionRational[]) => values.map(value => q.text(value)), bracketText = (bracket: [SectionRational, SectionRational]): Bracket => [q.text(bracket[0]), q.text(bracket[1])];
  const initial = curve.controlPoints.map((point, index) => { const w = q.from(curve.weights[index]); return [q.mul(q.from(point[0]), w), q.mul(q.from(point[1]), w), w]; });
  const split = (poles: SectionRational[][]) => {
    let level = poles; const lower = [level[0]], upper = [level.at(-1)!];
    while (level.length > 1) { level = level.slice(0, -1).map((pole, index) => pole.map((value, axis) => q.mul(half, q.add(value, level[index + 1][axis])))); lower.push(level[0]); upper.push(level.at(-1)!); }
    return { lower, upper: upper.reverse(), midpoint: level[0] };
  };
  const proofQueries: QueryProof[] = [], classifications: Classification[] = [];
  for (const query of queries) {
    const u = q.from(query.u), v = q.from(query.v), u0 = q.from(domains.u[0]), u1 = q.from(domains.u[1]), v0 = q.from(domains.v[0]), v1 = q.from(domains.v[1]);
    const boundaries: ChartBoundary[] = []; if (q.compare(u, u0) === 0) boundaries.push('u-min'); if (q.compare(u, u1) === 0) boundaries.push('u-max'); if (q.compare(v, v0) === 0) boundaries.push('v-min'); if (q.compare(v, v1) === 0) boundaries.push('v-max');
    const outside = q.compare(u, u0) < 0 || q.compare(u, u1) > 0 || q.compare(v, v0) < 0 || q.compare(v, v1) > 0, chart: Classification['chart'] = outside ? 'outside' : boundaries.length ? 'boundary' : 'interior';
    let poles = initial, bracket: [SectionRational, SectionRational] = [zero, one], relation: Relation = 'uncertain', method: QueryProof['method'] = 'iteration-cap', witness: Witness | null = null;
    const steps: Step[] = [], numerator = (point: SectionRational[], axis: number, coordinate: SectionRational) => q.sub(point[axis], q.mul(coordinate, point[2]));
    const signs = (values: SectionRational[]) => values.map(value => q.compare(value, zero));
    if (outside) { relation = 'not-applicable'; method = 'outside-chart'; poles = []; }
    else if (q.compare(v, v0) === 0 || q.compare(v, v1) === 0) { relation = q.compare(v, v0) === 0 ? 'below' : 'above'; method = 'natural-v-boundary'; }
    else if (q.compare(u, u0) === 0 || q.compare(u, u1) === 0) {
      const atStart = q.compare(u, u0) === 0, point = atStart ? initial[0] : initial.at(-1)!, parameter = atStart ? zero : one, un = numerator(point, 0, u), vn = numerator(point, 1, v);
      check(q.compare(un, zero) === 0, CODE.BINDING, 'Actual stored endpoint U must equal the original chart endpoint'); const sign = q.compare(vn, zero); relation = sign > 0 ? 'below' : sign < 0 ? 'above' : 'on'; method = 'u-endpoint'; bracket = [parameter, parameter]; poles = [point];
      witness = { kind: 'endpoint', normalizedParameter: q.text(parameter), homogeneous: text(point), uNumerator: q.text(un), vNumerator: q.text(vn) };
    } else {
      for (let step = 0; ; step++) {
        check(poles.every(point => q.compare(point[2], zero) > 0), CODE.BINDING, 'Selected restricted homogeneous hull must retain positive weights');
        const un = poles.map(point => numerator(point, 0, u)), vn = poles.map(point => numerator(point, 1, v)), us = signs(un), vs = signs(vn);
        check(us[0] < 0 && us.at(-1)! > 0, CODE.BINDING, 'The unique original query-U root must remain strictly inside the exact bracket');
        if (vs.every(sign => sign === 0)) { relation = 'on'; method = 'zero-v-polynomial'; witness = { kind: 'constant-v', normalizedParameter: null, homogeneous: null, uNumerator: null, vNumerator: q.text(zero) }; break; }
        if (vs.every(sign => sign > 0) || vs.every(sign => sign < 0)) { relation = vs[0] > 0 ? 'below' : 'above'; method = 'positive-weight-hull'; break; }
        if (step === options.maxSubdivisions) { relation = 'uncertain'; method = 'iteration-cap'; break; }
        const subdivision = split(poles), midpoint = q.mul(half, q.add(bracket[0], bracket[1])), midU = numerator(subdivision.midpoint, 0, u), midV = numerator(subdivision.midpoint, 1, v), uSign = q.compare(midU, zero), vSign = q.compare(midV, zero), before = bracket;
        const selection: Step['selection'] = uSign > 0 ? 'lower' : uSign < 0 ? 'upper' : 'exact-root';
        bracket = uSign > 0 ? [before[0], midpoint] : uSign < 0 ? [midpoint, before[1]] : [midpoint, midpoint];
        steps.push({ index: step, bracketBefore: bracketText(before), midpoint: q.text(midpoint), midHomogeneous: text(subdivision.midpoint), uNumerator: q.text(midU), vNumerator: q.text(midV), uSign, vSign, selection, bracketAfter: bracketText(bracket) });
        if (uSign === 0) { relation = vSign > 0 ? 'below' : vSign < 0 ? 'above' : 'on'; method = 'exact-root'; poles = [subdivision.midpoint]; witness = { kind: 'midpoint', normalizedParameter: q.text(midpoint), homogeneous: text(subdivision.midpoint), uNumerator: q.text(midU), vNumerator: q.text(midV) }; break; }
        poles = uSign > 0 ? subdivision.lower : subdivision.upper;
      }
    }
    const uNumerators = poles.map(point => numerator(point, 0, u)), vNumerators = poles.map(point => numerator(point, 1, v));
    proofQueries.push({ queryId: query.queryId, method, bracket: outside ? null : bracketText(bracket), homogeneous: poles.map(text), uNumerators: text(uNumerators), vNumerators: text(vNumerators), uSigns: signs(uNumerators), vSigns: signs(vNumerators), steps, witness });
    const material = (below: boolean): Material => relation === 'not-applicable' ? 'outside' : relation === 'uncertain' ? 'uncertain' : relation === 'on' ? 'boundary' : (relation === 'below') === below ? chart === 'boundary' ? 'boundary' : 'inside' : 'outside';
    classifications.push({ queryId: query.queryId, chart, chartBoundaries: outside ? [] : boundaries, cutRelation: relation, faces: trim.faces.map((face, index) => ({ sourceId: face.sourceId, surfaceId: face.surfaceId, faceId: face.id, classification: material(index === 0) })) as Classification['faces'] });
  }
  const chartCounts = { outside: 0, interior: 0, boundary: 0 }, relationCounts: VLinearSurfacePlaneTrimUVReport['relationCounts'] = { below: 0, above: 0, on: 0, uncertain: 0, 'not-applicable': 0 }, faceCounts = trim.faces.map(face => ({ faceId: face.id, inside: 0, outside: 0, boundary: 0, uncertain: 0 }));
  for (const classification of classifications) { chartCounts[classification.chart]++; relationCounts[classification.cutRelation]++; classification.faces.forEach((face, index) => faceCounts[index][face.classification]++); }
  const totalSubdivisions = proofQueries.reduce((count, proof) => count + proof.steps.length, 0); check(totalSubdivisions <= 64, CODE.BINDING, 'Actual complete subdivision accounting exceeded the fixed limit');
  const proof: Proof = { curveId: curve.id, queries: proofQueries };
  const report: VLinearSurfacePlaneTrimUVReport = {
    schema: 'barocss-vlinear-surface-plane-trim-uv-classification', version: 0, evaluationId: options.evaluationId, sourceId: trim.section.surfaceAsset.sourceId, surfaceId: trim.section.surfaceAsset.surface.id, sharedCutEdgeId: edge.id, cutPcurveId: curve.id,
    lengthUnit: 'dimensionless', parameterFrame: 'original-support-u-v', authority: 'unchanged-stored-positive-weight-monotone-u-graph', queryCount: queries.length, totalSubdivisions, chartCounts, relationCounts, faceCounts,
    directCounts: { trimValidationCount: 1, curvePointEvaluationCount: 0, curveDerivativeEvaluationCount: 0, surfacePointEvaluationCount: 0, surfaceDerivativeEvaluationCount: 0, sourceCompilationCount: 0 }, rationalCounts: q.counts(),
    numericPolicy: { input: 'exact-represented-original-dimensionless-uv', subdivision: 'exact-homogeneous-de-casteljau-halves-with-strict-unique-u-root-bracket', material: 'restricted-positive-weight-v-numerator-signs', boundary: 'exact-endpoint-or-root-equality-or-zero-v-polynomial', iterationLimit: 'successful-uncertain-no-guess', arithmeticLimit: 'atomic-budget-error-no-partial-result', toleranceUsed: false, nativeD0EqualityAuthority: false },
    quality: { uvMaterialClassificationOnly: true, parentModelGapProofUnchanged: true, worldProjectionPerformed: false, idealPlaneSideCertified: false, geometricValidity: 'not-certified', topologyCertified: false, solid: false, insideOutsideCertified: false, embeddedManifoldCertified: false, manufacturingToleranceCertified: false, globalBinary64EvaluationErrorCertified: false, ownership: 'independent-copied-cpu-data-gc' },
    limits: { maximumQueries: 4, maximumSubdivisionsPerQuery: 16, maximumTotalSubdivisions: 64, queryCoordinateAbs: 10000, rationalOperations: 200000, gcdSteps: 200000, rationalIntegerBits: 8192, fractionIntegerCharacters: 5000, ownValues: 1048576, ownDepth: 64, arrayElements: 8192, recordFields: 64, stringCharacters: 262144 }, workScope: 'direct-root-trim-validation-and-new-exact-arithmetic-parent-internal-work-excluded',
  };
  return snapshot({ trim, queries, options, classifications, proof, report }, true) as VLinearSurfacePlaneTrimUVResult;
}
/** Rebuild full parent ownership and every exact query certificate before whole-result comparison. */
export function validateVLinearSurfacePlaneTrimUVClassification(input: VLinearSurfacePlaneTrimUVResult): VLinearSurfacePlaneTrimUVReport {
  const owned = record(snapshot(input, true), ['trim', 'queries', 'options', 'classifications', 'proof', 'report'], CODE.OWNED) as unknown as VLinearSurfacePlaneTrimUVResult;
  let expected: VLinearSurfacePlaneTrimUVResult;
  try { expected = classifyVLinearSurfacePlaneTrimUV(owned.trim, owned.queries, owned.options); } catch (cause) { throw new VLinearSurfacePlaneTrimUVError(CODE.OWNED, 'Whole owned UV classification reconstruction failed', cause); }
  check(same(owned, expected), CODE.OWNED, 'Owned trim/queries/source identities/classifications/exact brackets/hulls/steps/counters changed'); return snapshot(expected.report, true) as VLinearSurfacePlaneTrimUVReport;
}
