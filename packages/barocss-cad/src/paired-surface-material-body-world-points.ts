import { validatePairedSurfaceMaterialBody } from './paired-surface-material-body.js';
import { SectionRationalContext } from './section-rational-internal.js';
import { classifyPairedSurfaceMaterialBodyWorldQueriesTrusted } from './paired-surface-material-body-world-points-internal.js';
import type {Point} from './types.js';
import type {PairedSurfaceMaterialBodyResult} from './paired-surface-material-body.js';
import type {SectionFraction} from './section-rational-internal.js';
import { same } from './structural-equality.js';
type F=SectionFraction;
type Size={utf16:number;utf8:number};
type Status='inside'|'outside'|'boundary';
type FaceRole='roof'|'side'|'yMin'|'zMin'|'xMin'|'xMax';
type Sign=-1|0|1;
type Stage='x'|'y'|'z';
type BodySourceRef=PairedSurfaceMaterialBodyResult['faces'][number]['supportRef'];
export interface PairedSurfaceMaterialBodyWorldPointQuery {queryId:string;pointMM:Point}
export interface PairedSurfaceMaterialBodyWorldPointOptions {evaluationId:string;maximumQueries:16}
type Request={body:PairedSurfaceMaterialBodyResult;queries:PairedSurfaceMaterialBodyWorldPointQuery[];
  options:PairedSurfaceMaterialBodyWorldPointOptions};
type ParentRef={parentField:'request.body';reference:BodySourceRef};
type BoundaryFace={parentField:'request.body';role:FaceRole;faceId:string;supportRef:BodySourceRef};
type Classification={queryId:string;status:Status;bodyId:string;materialCertificateId:string;boundaryFaces:BoundaryFace[]};
type Constraint={role:FaceRole;difference:F;sign:Sign};
type QueryProof={queryId:string;pointExact:[F,F,F];decision:'outside-x'|'outside-y'|'outside-z'|'inside'|'boundary';
  x:[Constraint,Constraint];originalUB:F|null;yRoof:F|null;y:[Constraint,Constraint]|null;
  zRoof:F|null;z:[Constraint,Constraint]|null;classification:Classification};
type SourceDefinition={bodyId:string;shellId:string;materialCertificateId:string;
  originalUAInterval:[number,number];originalUBOffset:F;originalUBScale:F;lowY:F;lowZ:F;
  bYOriginalUBPower:F[];aZOriginalUAVAPower:F[][];sourceRefs:ParentRef[];
  faceRefs:[BoundaryFace,BoundaryFace,BoundaryFace,BoundaryFace,BoundaryFace,BoundaryFace];
  unitAxisSourceAuthority:true;wholeMaterialParentUnchanged:true};
type Proof={schema:'barocss-paired-surface-material-body-world-points-proof';version:0;
  source:SourceDefinition;queries:QueryProof[];
  authority:'exact-source-defined-unit-axis-paired-surface-occupied-region'};
type DirectCounts={bodyValidationCount:number;queryCount:number;yRoofEvaluationCount:number;
  zRoofEvaluationCount:number;signComparisonCount:number;curveD0Count:0;curveD1Count:0;
  surfaceD0Count:0;surfaceD1Count:0;sourceCompilationCount:0;rootSolveCount:0;rationalFloatConversionCount:0};
export interface PairedSurfaceMaterialBodyWorldPointResult {
  request:Request;classifications:Classification[];proof:Proof;report:PairedSurfaceMaterialBodyWorldPointReport;
}
export interface PairedSurfaceMaterialBodyWorldPointReport {
  schema:'barocss-paired-surface-material-body-world-points';version:0;evaluationId:string;
  parentEvaluationId:string;bodyId:string;shellId:string;materialCertificateId:string;queryCount:number;
  classificationCounts:{inside:number;outside:number;boundary:number};
  decisionCounts:{'outside-x':number;'outside-y':number;'outside-z':number;inside:number;boundary:number};
  boundaryRoleCounts:{roof:number;side:number;yMin:number;zMin:number;xMin:number;xMax:number};
  lengthUnit:'mm';sourceFrame:'authored-xyz-no-axis-conversion';parameterFrame:'exact-world-xyz-and-original-ua-va-ub-polynomials';
  authority:'exact-source-defined-unit-axis-paired-surface-occupied-region';directCounts:DirectCounts;
  inheritedCounts:{body:PairedSurfaceMaterialBodyResult['report']['directCounts']};
  rationalCounts:ReturnType<SectionRationalContext['counts']>;
  numericPolicy:{input:'exact-represented-original-world-xyz';coordinates:'unit-axis-source-identities';
    evaluation:'exact-rational-source-polynomial-horner';decisionOrder:'x-bounds-y-roof-and-bounds-z-roof-and-bounds';
    boundary:'all-exact-zero-region-constraints-after-outside-priority';toleranceUsed:false;
    nativeD0EqualityAuthority:false;rootFindingUsed:false;pointProjectionPerformed:false;
    normalizedCubeInputUsed:false;sourceIdentityRenaming:false;snapPerformed:false;rootFloatConversion:false};
  quality:{exactWorldRegionMembershipCertified:true;sourceDefinedOccupiedRegionAuthority:true;
    actualParentBodyRetained:true;parentTopologyAndMaterialUnchanged:true;originalBitsPreserved:true;
    newGeometryProduced:false;newBodyProduced:false;genericBoolean:false;arbitraryBodyMembershipCertified:false;
    rendererPickingCertified:false;globalBinary64EvaluationErrorCertified:false;
    manufacturingToleranceCertified:false;publication:false;ownership:'independent-copied-cpu-data-gc'};
  fileSizes:{request:Size;result:Size};ownValues:number;
  limits:{maximumParents:1;maximumQueries:16;queryCoordinateAbs:10000;maximumYDegree:2;
    maximumZUDegree:2;maximumZVDegree:1;maximumBoundaryFaces:6;requestBytes:8388608;resultBytes:16777216;
    ownValues:4194304;ownDepth:64;arrayElements:8192;recordFields:64;keyCharacters:128;stringCharacters:262144;
    identityCharacters:48;rationalOperations:200000;gcdSteps:200000;rationalIntegerBits:8192;
    fractionIntegerCharacters:5000;maximumRationalFloatConversions:0;maximumSettlePasses:8};
  workScope:'one-complete-body-validation-and-new-exact-world-predicates-with-inherited-work-separated';
  budgetFailure:'atomic-no-partial-world-classification';
}

export const PairedSurfaceMaterialBodyWorldPointDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', IDENTITY: 'IDENTITY', PARENT: 'PARENT', BINDING: 'BINDING',
  DOMAIN: 'DOMAIN', BUDGET: 'BUDGET', FILE: 'FILE', OWNED: 'OWNED',
} as const);
type Code = typeof PairedSurfaceMaterialBodyWorldPointDiagnosticCode[keyof typeof PairedSurfaceMaterialBodyWorldPointDiagnosticCode];
type Context = {
  phase: 'input' | 'parent' | 'binding' | 'query' | 'file' | 'owned';
  queryIndex: number | null; stage: Stage | null;
  directCounts: { [K in keyof DirectCounts]: number };
};
export class PairedSurfaceMaterialBodyWorldPointError extends Error {
  readonly code: Code;
  readonly context: Context;
  constructor(code: Code, detail: string, context: Context, cause?: unknown) {
    super(('Paired material Body World points: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'PairedSurfaceMaterialBodyWorldPointError'; this.code = code;
    this.context = { ...context, directCounts: { ...context.directCounts } };
  }
}
const CODE = PairedSurfaceMaterialBodyWorldPointDiagnosticCode;
const REQUEST_LIMIT = 8388608, RESULT_LIMIT = 16777216;
function context(): Context {
  return { phase: 'input', queryIndex: null, stage: null, directCounts: {
    bodyValidationCount: 0, queryCount: 0, yRoofEvaluationCount: 0, zRoofEvaluationCount: 0,
    signComparisonCount: 0, curveD0Count: 0, curveD1Count: 0, surfaceD0Count: 0,
    surfaceD1Count: 0, sourceCompilationCount: 0, rootSolveCount: 0, rationalFloatConversionCount: 0,
  } };
}
function fail(state: Context, code: Code, detail: string, cause?: unknown): never {
  throw new PairedSurfaceMaterialBodyWorldPointError(code, detail, state, cause);
}
function check(state: Context, condition: boolean, code: Code, detail: string): asserts condition {
  if (!condition) fail(state, code, detail);
}
function record(state: Context, value: unknown, fields: string[], code: Code = CODE.INPUT): Record<string, unknown> {
  check(state, value !== null && typeof value === 'object' && !Array.isArray(value), code, 'An own record is required');
  const data = value as Record<string, unknown>;
  check(state, Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)),
    code, 'Exact own fields are required');
  return data;
}
function snapshot(state: Context, input: unknown, owned = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT, budget = owned ? CODE.OWNED : CODE.BUDGET;
  let remaining = 4194304;
  const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(state, --remaining >= 0 && depth <= 64, budget, 'Own value or depth cap exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { check(state, Number.isFinite(value), code, 'Finite own numbers are required'); return value; }
    if (typeof value === 'string') { check(state, value.length <= 262144, budget, 'Own source string cap exceeded'); return value; }
    check(state, typeof value === 'object' && !ancestors.has(value), code, 'Acyclic own data is required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    check(state, array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null,
      code, 'Plain own-data prototypes are required');
    const keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    check(state, keys.length <= (array ? 8193 : 64), budget, 'Own field cap exceeded');
    check(state, keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key] &&
      (array && key === 'length' || descriptors[key].enumerable)), code, 'Getters, symbols and hidden fields are refused');
    ancestors.add(value);
    let result: unknown;
    if (array) {
      const length = descriptors.length.value as number;
      check(state, Number.isInteger(length) && length >= 0 && length <= 8192, budget, 'Own array element cap exceeded');
      check(state, keys.length === length + 1, code, 'Dense arrays without extra fields are required');
      result = Array.from({ length }, (_, index) => {
        check(state, Object.hasOwn(descriptors, String(index)), code, 'Sparse arrays are refused');
        return copy(descriptors[String(index)].value, depth + 1);
      });
    } else result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    ancestors.delete(value);
    return result;
  };
  return copy(input, 0);
}
function id(state: Context, value: unknown, maximum = 48): asserts value is string {
  check(state, typeof value === 'string' && value.length <= maximum && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value),
    CODE.IDENTITY, 'A bounded supported ASCII identity is required');
}
function json(state: Context, input: unknown, limit: number, retain = false): { text: string; size: Size } {
  const previousPhase = state.phase;
  const previousQuery = state.queryIndex, previousStage = state.stage;
  state.phase = 'file'; state.queryIndex = null; state.stage = null;
  let utf16 = 0, utf8 = 0;
  const parts: string[] = [], encoder = new TextEncoder();
  const append = (text: string): void => {
    utf16 += text.length; utf8 += encoder.encode(text).length;
    check(state, utf16 <= limit && utf8 <= limit, CODE.FILE, 'Complete JSON exceeds its full UTF16 or UTF8 envelope');
    if (retain) parts.push(text);
  };
  const visit = (value: unknown): void => {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') append(JSON.stringify(value));
    else if (typeof value === 'number') { check(state, Number.isFinite(value), CODE.FILE, 'Finite JSON numbers are required'); append(Object.is(value, -0) ? '-0' : String(value)); }
    else if (Array.isArray(value)) { append('['); value.forEach((item, index) => { if (index) append(','); visit(item); }); append(']'); }
    else {
      check(state, value !== null && typeof value === 'object', CODE.FILE, 'Complete own JSON data is required');
      append('{'); Object.entries(value).forEach(([key, item], index) => { if (index) append(','); append(JSON.stringify(key)); append(':'); visit(item); }); append('}');
    }
  };
  visit(input); append('\n');
  state.phase = previousPhase; state.queryIndex = previousQuery; state.stage = previousStage;
  return { text: retain ? parts.join('') : '', size: { utf16, utf8 } };
}
function delegated<T>(state: Context, code: Code, detail: string, action: () => T): T {
  try { return action(); } catch (cause) {
    if (cause instanceof PairedSurfaceMaterialBodyWorldPointError) throw cause;
    fail(state, code, detail, cause);
  }
}
function ownValues(state: Context, input: unknown): number {
  let count = 0;
  const visit = (value: unknown, depth: number): void => {
    check(state, ++count <= 4194304 && depth <= 64, CODE.BUDGET, 'Complete retained own-value/depth budget exceeded');
    if (value !== null && typeof value === 'object') Object.values(value).forEach(item => visit(item, depth + 1));
  };
  visit(input, 0); return count;
}
function limits(): PairedSurfaceMaterialBodyWorldPointReport['limits'] {
  return { maximumParents: 1, maximumQueries: 16, queryCoordinateAbs: 10000,
    maximumYDegree: 2, maximumZUDegree: 2, maximumZVDegree: 1, maximumBoundaryFaces: 6,
    requestBytes: REQUEST_LIMIT, resultBytes: RESULT_LIMIT, ownValues: 4194304, ownDepth: 64,
    arrayElements: 8192, recordFields: 64, keyCharacters: 128, stringCharacters: 262144,
    identityCharacters: 48, rationalOperations: 200000, gcdSteps: 200000,
    rationalIntegerBits: 8192, fractionIntegerCharacters: 5000,
    maximumRationalFloatConversions: 0, maximumSettlePasses: 8 };
}

/** Exact represented World(mm) membership in the unchanged source-defined material Body. */
export function classifyPairedSurfaceMaterialBodyWorldPoints(
  inputBody: PairedSurfaceMaterialBodyResult,
  inputQueries: PairedSurfaceMaterialBodyWorldPointQuery[],
  inputOptions: PairedSurfaceMaterialBodyWorldPointOptions,
): PairedSurfaceMaterialBodyWorldPointResult {
  const state = context();
  const data = record(state, snapshot(state, {
    body: inputBody, queries: inputQueries, options: inputOptions,
  }), ['body', 'queries', 'options']);
  const settings = record(state, data.options, ['evaluationId', 'maximumQueries']);
  id(state, settings.evaluationId);
  check(state, settings.maximumQueries === 16, CODE.BUDGET, 'Complete fixed maximumQueries16 required');
  check(state, Array.isArray(data.queries), CODE.INPUT, 'An own query array is required');
  check(state, data.queries.length <= 16, CODE.BUDGET, 'At most16 World points are supported');
  const queryIds = new Set<string>();
  const queries: PairedSurfaceMaterialBodyWorldPointQuery[] = data.queries.map((value, index) => {
    state.queryIndex = index; state.stage = null;
    const query = record(state, value, ['queryId', 'pointMM']);
    id(state, query.queryId);
    check(state, !queryIds.has(query.queryId), CODE.IDENTITY, 'Query identities must be distinct within the batch');
    queryIds.add(query.queryId);
    check(state, Array.isArray(query.pointMM) && query.pointMM.length === 3 && query.pointMM.every(coordinate =>
      typeof coordinate === 'number' && Number.isFinite(coordinate) && Math.abs(coordinate) <= 10000),
    CODE.INPUT, 'A finite original World XYZ Point with coordinate absolute bound10000 is required');
    return { queryId: query.queryId, pointMM: query.pointMM.slice() as Point };
  });
  const body = data.body as PairedSurfaceMaterialBodyResult;
  const options: PairedSurfaceMaterialBodyWorldPointOptions = { evaluationId: settings.evaluationId, maximumQueries: 16 };
  const request: Request = { body, queries, options };
  state.queryIndex = null;
  const requestSize = json(state, request, REQUEST_LIMIT).size;
  const classifications: Classification[] = [], queryProofs: QueryProof[] = [];
  let source: SourceDefinition | null = null;
  const prefix = (): void => {
    const previousPhase = state.phase, previousIndex = state.queryIndex, previousStage = state.stage;
    state.phase = 'file'; state.queryIndex = null; state.stage = null;
    const retained = { request, classifications, source, queryProofs };
    snapshot(state, retained); json(state, retained, RESULT_LIMIT);
    state.phase = previousPhase; state.queryIndex = previousIndex; state.stage = previousStage;
  };
  prefix(); state.phase = 'parent'; state.directCounts.bodyValidationCount++;
  delegated(state, CODE.PARENT, 'Complete paired material Body validation refused', () => validatePairedSurfaceMaterialBody(body));
  prefix(); state.phase = 'binding';
  const material = body.proof.material, profile = material.profile;
  const roles: FaceRole[] = ['roof', 'side', 'yMin', 'zMin', 'xMin', 'xMax'];
  check(state, body.body.solid && body.body.restrictedSolidCertified && material.restrictedSolidCertified &&
    material.sourceDefinedOccupiedRegion && material.wholeBoundaryImage && material.embeddedClosedBoundary &&
    material.outwardMaterial && material.parentFlagsUnchanged && profile.aXIdentity && profile.aYIdentity &&
    profile.bXShiftIdentity && profile.bZIdentity && profile.unitPositiveAxes && profile.constantPositiveWeights &&
    body.body.id === material.bodyId && body.shell.id === material.shellId &&
    body.body.materialCertificateId === material.certificateId &&
    body.report.bodyId === body.body.id && body.report.materialCertificateId === material.certificateId,
  CODE.BINDING, 'Actual full source-defined unit-axis occupied material Body authority required');
  check(state, body.faces.length === 6 && material.faceImages.length === 6 &&
    same(material.faceIds, body.faces.map(face => face.id)) && body.faces.every((face, index) => {
      const image = material.faceImages[index];
      return face.role === roles[index] && image.role === face.role && image.faceId === face.id &&
        same(image.supportRef, face.supportRef) && same(image.originalSupport, face.support) && image.wholeImageEqual;
    }), CODE.BINDING, 'Actual six Body Faces must resolve to their complete material images and qualified sources');
  const counts: DirectCounts = {
    bodyValidationCount: state.directCounts.bodyValidationCount, queryCount: 0,
    yRoofEvaluationCount: 0, zRoofEvaluationCount: 0, signComparisonCount: 0,
    curveD0Count: 0, curveD1Count: 0, surfaceD0Count: 0, surfaceD1Count: 0,
    sourceCompilationCount: 0, rootSolveCount: 0, rationalFloatConversionCount: 0,
  };
  state.directCounts = counts;
  const q = new SectionRationalContext((kind, detail) => fail(state, kind === 'BUDGET' ? CODE.BUDGET : CODE.DOMAIN, detail));
  prefix();
  let derived: ReturnType<typeof classifyPairedSurfaceMaterialBodyWorldQueriesTrusted>;
  try {
    derived = classifyPairedSurfaceMaterialBodyWorldQueriesTrusted(body, queries, q, counts, {
      beginQuery(queryIndex) {
        state.phase = 'query'; state.queryIndex = queryIndex; state.stage = 'x'; prefix();
      },
      beginStage(stage) { state.stage = stage; prefix(); },
      retainQuery(classification, proof) {
        classifications.push(classification); queryProofs.push(proof); prefix();
      },
      fail(code, detail, cause) { fail(state, CODE[code], detail, cause); },
    });
  } catch (cause) {
    if (cause instanceof PairedSurfaceMaterialBodyWorldPointError) throw cause;
    fail(state, CODE.BINDING, 'Exact staged source-defined World predicate construction refused', cause);
  }
  source = derived.source;
  check(state, same(derived.classifications, classifications) && same(derived.queries, queryProofs) &&
    classifications.length === queries.length && queryProofs.length === queries.length,
  CODE.BINDING, 'Each actual completed World query must retain its complete staged predicate and classification');
  check(state, counts.bodyValidationCount === 1 && counts.queryCount === queries.length &&
    counts.zRoofEvaluationCount <= counts.yRoofEvaluationCount && counts.yRoofEvaluationCount <= counts.queryCount &&
    counts.curveD0Count === 0 && counts.curveD1Count === 0 && counts.surfaceD0Count === 0 && counts.surfaceD1Count === 0 &&
    counts.sourceCompilationCount === 0 && counts.rootSolveCount === 0 && counts.rationalFloatConversionCount === 0 &&
    q.counts().floatConversions === 0, CODE.BINDING, 'Actual successful staged/root work and zero native/conversion schedule required');
  check(state, source.bodyId === body.body.id && source.shellId === body.shell.id &&
    source.materialCertificateId === material.certificateId && source.faceRefs.length === 6 &&
    source.faceRefs.every((reference, index) => reference.parentField === 'request.body' &&
      reference.role === roles[index] && reference.faceId === body.faces[index].id &&
      same(reference.supportRef, body.faces[index].supportRef)) &&
    same(source.sourceRefs, material.sourceRefs.map(reference => ({ parentField: 'request.body', reference }))),
  CODE.BINDING, 'World predicate source references must anchor the unchanged actual Body contexts');
  prefix(); state.phase = 'file'; state.queryIndex = null; state.stage = null;
  const proof: Proof = { schema: 'barocss-paired-surface-material-body-world-points-proof', version: 0,
    source, queries: queryProofs, authority: 'exact-source-defined-unit-axis-paired-surface-occupied-region' };
  const classificationCounts: PairedSurfaceMaterialBodyWorldPointReport['classificationCounts'] = { inside: 0, outside: 0, boundary: 0 };
  const decisionCounts: PairedSurfaceMaterialBodyWorldPointReport['decisionCounts'] = {
    'outside-x': 0, 'outside-y': 0, 'outside-z': 0, inside: 0, boundary: 0,
  };
  const boundaryRoleCounts: PairedSurfaceMaterialBodyWorldPointReport['boundaryRoleCounts'] = {
    roof: 0, side: 0, yMin: 0, zMin: 0, xMin: 0, xMax: 0,
  };
  for (const [index, classification] of classifications.entries()) {
    classificationCounts[classification.status]++; decisionCounts[queryProofs[index].decision]++;
    check(state, classification.bodyId === body.body.id && classification.materialCertificateId === material.certificateId &&
      (classification.status === 'boundary' ? classification.boundaryFaces.length > 0 : classification.boundaryFaces.length === 0),
    CODE.BINDING, 'Only actual in-region boundary decisions may expose anchored Face references');
    for (const boundary of classification.boundaryFaces) {
      const reference = source.faceRefs.find(value => value.role === boundary.role);
      check(state, reference !== undefined && same(reference, boundary), CODE.BINDING,
        'Every actual boundary role must resolve to its unchanged parent Face source reference');
      boundaryRoleCounts[boundary.role]++;
    }
  }
  const report: PairedSurfaceMaterialBodyWorldPointReport = {
    schema: 'barocss-paired-surface-material-body-world-points', version: 0, evaluationId: options.evaluationId,
    parentEvaluationId: body.report.evaluationId, bodyId: body.body.id, shellId: body.shell.id,
    materialCertificateId: material.certificateId, queryCount: queries.length,
    classificationCounts, decisionCounts, boundaryRoleCounts, lengthUnit: 'mm', sourceFrame: 'authored-xyz-no-axis-conversion',
    parameterFrame: 'exact-world-xyz-and-original-ua-va-ub-polynomials',
    authority: 'exact-source-defined-unit-axis-paired-surface-occupied-region', directCounts: { ...counts },
    inheritedCounts: { body: body.report.directCounts }, rationalCounts: q.counts(),
    numericPolicy: { input: 'exact-represented-original-world-xyz', coordinates: 'unit-axis-source-identities',
      evaluation: 'exact-rational-source-polynomial-horner', decisionOrder: 'x-bounds-y-roof-and-bounds-z-roof-and-bounds',
      boundary: 'all-exact-zero-region-constraints-after-outside-priority', toleranceUsed: false,
      nativeD0EqualityAuthority: false, rootFindingUsed: false, pointProjectionPerformed: false,
      normalizedCubeInputUsed: false, sourceIdentityRenaming: false, snapPerformed: false, rootFloatConversion: false },
    quality: { exactWorldRegionMembershipCertified: true, sourceDefinedOccupiedRegionAuthority: true,
      actualParentBodyRetained: true, parentTopologyAndMaterialUnchanged: true, originalBitsPreserved: true,
      newGeometryProduced: false, newBodyProduced: false, genericBoolean: false, arbitraryBodyMembershipCertified: false,
      rendererPickingCertified: false, globalBinary64EvaluationErrorCertified: false,
      manufacturingToleranceCertified: false, publication: false, ownership: 'independent-copied-cpu-data-gc' },
    fileSizes: { request: requestSize, result: { utf16: 0, utf8: 0 } }, ownValues: 0, limits: limits(),
    workScope: 'one-complete-body-validation-and-new-exact-world-predicates-with-inherited-work-separated',
    budgetFailure: 'atomic-no-partial-world-classification',
  };
  const result: PairedSurfaceMaterialBodyWorldPointResult = { request, classifications, proof, report };
  let settled = false;
  for (let pass = 0; pass < 8; pass++) {
    const count = ownValues(state, result), measured = json(state, result, RESULT_LIMIT).size;
    if (report.ownValues === count && same(report.fileSizes.result, measured)) { settled = true; break; }
    report.ownValues = count; report.fileSizes.result = measured;
  }
  check(state, settled && report.ownValues === ownValues(state, result) &&
    same(report.fileSizes.result, json(state, result, RESULT_LIMIT).size), CODE.FILE,
  'Whole World classification own/file measurements did not settle in8 passes');
  return snapshot(state, result) as PairedSurfaceMaterialBodyWorldPointResult;
}

/** One complete source-backed classification rebuild; return an independent Report. */
export function validatePairedSurfaceMaterialBodyWorldPointClassification(
  input: PairedSurfaceMaterialBodyWorldPointResult,
): PairedSurfaceMaterialBodyWorldPointReport {
  const state = context(); state.phase = 'owned';
  try {
    const result = record(state, snapshot(state, input, true), ['request', 'classifications', 'proof', 'report'],
      CODE.OWNED) as unknown as PairedSurfaceMaterialBodyWorldPointResult;
    json(state, result, RESULT_LIMIT);
    const expected = classifyPairedSurfaceMaterialBodyWorldPoints(result.request.body, result.request.queries, result.request.options);
    state.directCounts = { ...expected.report.directCounts };
    check(state, same(result, expected), CODE.OWNED, 'Whole Body/source/queries/stages/decisions/references/work/file fields changed');
    return snapshot(state, expected.report, true) as PairedSurfaceMaterialBodyWorldPointReport;
  } catch (cause) {
    if (cause instanceof PairedSurfaceMaterialBodyWorldPointError && cause.code === CODE.OWNED) throw cause;
    const failed = cause instanceof PairedSurfaceMaterialBodyWorldPointError ? cause.context : state;
    throw new PairedSurfaceMaterialBodyWorldPointError(CODE.OWNED, 'Whole World classification reconstruction refused',
      { ...failed, phase: 'owned' }, cause);
  }
}
