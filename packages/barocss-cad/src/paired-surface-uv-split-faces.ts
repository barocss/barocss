import { validateExactPairedVLinearSurfaceIntersection } from './exact-paired-vlinear-surface-intersection.js';
import { extractSurfaceIsoCurve } from './surface-isocurve.js';
import { extractSourceCurveInterval } from './source-curve-interval-extraction.js';
import { adopt as adoptSourceModel } from './own-plane-cylinder-intersection-internal.js';
import { validateCurve, evaluateCurve, evaluateSurface } from './math.js';
import { evaluateCurveD1, evaluateSurfaceD1 } from './derivatives.js';
import { SectionRationalContext } from './section-rational-internal.js';
import { provePairedSurfaceUVSplitFacesTrusted, PairedSurfaceUVSplitFacesProofError } from './paired-surface-uv-split-faces-proof-internal.js';
import type { PairedSurfaceUVSplitFacesProof, PairedSurfaceUVSplitVertex, PairedSurfaceUVSplitEdge,
  PairedSurfaceUVSplitLoop, PairedSurfaceUVSplitFace, PairedSurfaceUVSplitWorld } from './paired-surface-uv-split-faces-proof-internal.js';

import type { Curve, Model, Point } from './types.js';
import type { CurveD1Result, SurfaceD1Result } from './derivatives.js';
import type { ExactPairedVLinearSurfaceIntersectionResult } from './exact-paired-vlinear-surface-intersection.js';
import type { SurfaceIsoCurveResult } from './surface-isocurve.js';
import type { SourceCurveIntervalExtractionResult } from './source-curve-interval-extraction.js';
import type { SectionFraction } from './section-rational-internal.js';
import { same } from './structural-equality.js';
type F = SectionFraction;
type Role = 'bottom'|'rightLow'|'rightHigh'|'top'|'leftLow'|'leftHigh'|'sharedCut';
type VertexRole = 'bottomLeft'|'bottomRight'|'topRight'|'topLeft'|'cutLeft'|'cutRight';
type Sense = 'forward'|'reverse';
type Size = {utf16:number;utf8:number};
export interface PairedSurfaceUVSplitFacesOptions { // EXACT6
  evaluationId:string;resultIdPrefix:string;orientation:Sense;
  maximumIsoCurves:2;maximumIntervals:2;maximumObservations:35;
}
export interface PairedSurfaceUVSplitFacesRequest { // EXACT2
  section:ExactPairedVLinearSurfaceIntersectionResult;
  options:PairedSurfaceUVSplitFacesOptions;
}
type SupportRef = {sourceId:string;surfaceId:string;
  sourceField:'request.section.request.assets[0].source';
  modelField:'request.section.originalModels[0]';modelName:string;objectIndex:number};
type Vertex = PairedSurfaceUVSplitVertex;
type Edge = PairedSurfaceUVSplitEdge;
type Loop = PairedSurfaceUVSplitLoop;
type Face = PairedSurfaceUVSplitFace;
type World = PairedSurfaceUVSplitWorld;
type Proof = PairedSurfaceUVSplitFacesProof;
type D1<T> = {status:'evaluated';value:T}|
  {status:'native-refused';reason:string;nativeErrorName:string};
type Observation = {edgeId:string;edgeIndex:number;index:number;parameter:number;
  world:{d0:Point;d1:D1<CurveD1Result>};
  pcurve:{d0:Point;d1:D1<CurveD1Result>};
  surface:{d0:Point;d1:D1<SurfaceD1Result>};chain:Point|null;
  residuals:{pointGapMM:number;worldD0D1PointGapMM:number|null;
    uvD0D1PointGap:number|null;surfaceD0D1PointGapMM:number|null;
    relativeChainGap:number|null}};
export interface PairedSurfaceUVSplitFacesResult { // EXACT11
  request:PairedSurfaceUVSplitFacesRequest;
  isoCurves:[SurfaceIsoCurveResult,SurfaceIsoCurveResult];
  intervals:[SourceCurveIntervalExtractionResult,SourceCurveIntervalExtractionResult];
  world:World;vertices:Vertex[];edges:Edge[];loops:[Loop,Loop];faces:[Face,Face];
  proof:Proof;observations:Observation[];report:PairedSurfaceUVSplitFacesReport;
}
export interface PairedSurfaceUVSplitFacesReport {
  schema:'barocss-paired-surface-uv-split-faces';version:0;evaluationId:string;
  parentEvaluationId:string;support:SupportRef;orientation:Sense;
  window:{u:[number,number];v:[number,number]};lengthUnit:'mm';uvLengthUnit:'dimensionless';
  parameterFrame:'original-a-u-window-and-native-edge-parameters';
  vertexCount:6;edgeCount:7;faceCount:2;loopCount:2;useCount:8;worldObjectCount:8;
  sharedCutEdgeId:string;sharedWorldCurveId:string;sharedPcurveId:string;
  worldModelName:string;reservedIds:string[];
  minimumLowerGap:F;minimumUpperGap:F;xyDeterminant:F;
  wholeEdgeModelGapMM:0;maximumObservedPointGapMM:number;maximumObservedRelativeChainGap:number;
  derivativeCounts:Record<'world'|'pcurve'|'surface',{evaluated:number;refused:number}>;
  directCounts:{parentValidationCount:1;isoCurveExtractionCount:2;sourceIntervalExtractionCount:2;
    sideWorldValidationCount:4;newUVValidationCount:6;worldModelAdoptionCount:1;
    observationCount:35;curveD0Count:70;curveD1AttemptCount:70;
    surfaceD0Count:35;surfaceD1AttemptCount:35;rationalFloatConversionCount:0};
  inheritedCounts:{parent:ExactPairedVLinearSurfaceIntersectionResult['report']['directCounts'];
    iso:[SurfaceIsoCurveResult['report'],SurfaceIsoCurveResult['report']];
    intervals:[SourceCurveIntervalExtractionResult['report']['directCounts'],
      SourceCurveIntervalExtractionResult['report']['directCounts']]};
  rationalCounts:ReturnType<SectionRationalContext['counts']>;
  quality:{individualFaceEmbedded:true;closedUVDisks:true;complementaryWindowRegions:true;
    exactWorldSurfaceAgreement:true;sharedCutUnchanged:true;oppositeSharedUses:true;
    fullOriginalSourcesAndBothUVRetained:true;parentFlagsUnchanged:true;
    wholeOriginalOutsideWindowSplit:false;bSplitProduced:false;sewnManifold:false;
    wholeBodyTopologyCertified:false;solid:false;occupiedVolumeCertified:false;
    worldSurfaceAreaComputed:false;genericBoolean:false;globalBinary64EvaluationErrorCertified:false;
    manufacturingToleranceCertified:false;publication:false;ownership:'independent-copied-cpu-data-gc'};
  fileSizes:{request:Size;result:Size};ownValues:number;
  limits:{maximumIsoCurves:2;maximumIntervals:2;maximumSideLines:4;
    maximumVertices:6;maximumEdges:7;maximumFaces:2;maximumUses:8;maximumWorldObjects:8;
    maximumUDegree:2;vDegree:1;maximumCutDegree:4;maximumProofDegree:4;
    maximumObservations:35;maximumNativeObservationAttempts:210;
    sourceCharacters:262144;sourceUTF8Bytes:262144;maximumOriginalModelObjects:16;
    requestBytes:4194304;resultBytes:16777216;ownValues:4194304;ownDepth:64;
    arrayElements:8192;recordFields:64;keyCharacters:128;stringCharacters:262144;
    prefixCharacters:12;identityCharacters:48;rationalOperations:200000;
    gcdSteps:200000;rationalIntegerBits:8192;fractionIntegerCharacters:5000;
    maximumRationalFloatConversions:0;maximumSettlePasses:8};
  workScope:'direct-parent-iso-interval-adoption-and-edge-observations-with-inherited-work-separated';
  budgetFailure:'atomic-no-partial-complementary-faces';
}

export const PairedSurfaceUVSplitFacesDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', IDENTITY: 'IDENTITY', PARENT: 'PARENT', SUPPORT: 'SUPPORT', DOMAIN: 'DOMAIN',
  ISO: 'ISO', INTERVAL: 'INTERVAL', REGION: 'REGION', REPRESENTABILITY: 'REPRESENTABILITY',
  BINDING: 'BINDING', NATIVE: 'NATIVE', BUDGET: 'BUDGET', FILE: 'FILE', OWNED: 'OWNED',
} as const);
type DiagnosticCode = typeof PairedSurfaceUVSplitFacesDiagnosticCode[keyof typeof PairedSurfaceUVSplitFacesDiagnosticCode];
type DirectAttempts = { [K in keyof PairedSurfaceUVSplitFacesReport['directCounts']]: number };
type ErrorContext = {
  phase: 'input' | 'parent' | 'iso' | 'interval' | 'side' | 'uv' | 'adoption' |
    'proof' | 'observation' | 'file' | 'owned';
  edgeIndex: number | null; observationIndex: number | null; directCounts: DirectAttempts;
};
export class PairedSurfaceUVSplitFacesError extends Error {
  readonly code: DiagnosticCode;
  readonly context: ErrorContext;
  constructor(code: DiagnosticCode, detail: string, state: ErrorContext, cause?: unknown) {
    super(('Paired Surface UV split Faces: ' + detail).slice(0, 1024),
      cause === undefined ? undefined : { cause });
    this.name = 'PairedSurfaceUVSplitFacesError';
    this.code = code;
    this.context = { ...state, directCounts: { ...state.directCounts } };
  }
}
const CODE = PairedSurfaceUVSplitFacesDiagnosticCode;
const REQUEST_LIMIT = 4194304, RESULT_LIMIT = 16777216;
function context(): ErrorContext {
  return { phase: 'input', edgeIndex: null, observationIndex: null, directCounts: {
    parentValidationCount: 0, isoCurveExtractionCount: 0, sourceIntervalExtractionCount: 0,
    sideWorldValidationCount: 0, newUVValidationCount: 0, worldModelAdoptionCount: 0,
    observationCount: 0, curveD0Count: 0, curveD1AttemptCount: 0,
    surfaceD0Count: 0, surfaceD1AttemptCount: 0, rationalFloatConversionCount: 0,
  } };
}

function fail(state: ErrorContext, code: DiagnosticCode, detail: string, cause?: unknown): never {
  throw new PairedSurfaceUVSplitFacesError(code, detail, state, cause);
}
function check(state: ErrorContext, value: boolean, code: DiagnosticCode, detail: string): asserts value {
  if (!value) fail(state, code, detail);
}
function record(state: ErrorContext, value: unknown, fields: string[], code: DiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(state, value !== null && typeof value === 'object' && !Array.isArray(value), code, 'An own record is required');
  const data = value as Record<string, unknown>;
  check(state, Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)),
    code, 'Exact own fields are required');
  return data;
}
function snapshot(state: ErrorContext, input: unknown, owned = false): unknown {
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
function id(state: ErrorContext, value: unknown, maximum = 48): asserts value is string {
  check(state, typeof value === 'string' && value.length <= maximum && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value),
    CODE.IDENTITY, 'A bounded supported ASCII identity is required');
}
function size(state: ErrorContext, value: string, limit = 262144): Size {
  const measured = { utf16: value.length, utf8: new TextEncoder().encode(value).length };
  check(state, measured.utf16 <= limit && measured.utf8 <= limit, CODE.BUDGET, 'Complete source exceeds its UTF16 or UTF8 cap');
  return measured;
}
function json(state: ErrorContext, input: unknown, limit: number, retain = false): { text: string; size: Size } {
  const previousPhase = state.phase;
  const previousEdge = state.edgeIndex;
  state.phase = 'file'; state.edgeIndex = null;
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
  state.phase = previousPhase; state.edgeIndex = previousEdge;
  return { text: retain ? parts.join('') : '', size: { utf16, utf8 } };
}
function delegated<T>(state: ErrorContext, code: DiagnosticCode, detail: string, action: () => T): T {
  try { return action(); } catch (cause) {
    if (cause instanceof PairedSurfaceUVSplitFacesError) throw cause;
    fail(state, code, detail, cause);
  }
}
function finite(state: ErrorContext, value: number, detail: string,
  code: DiagnosticCode = CODE.REPRESENTABILITY): number {
  check(state, Number.isFinite(value), code, detail); return value;
}
function ownValues(state: ErrorContext, input: unknown): number {
  let count = 0;
  const visit = (value: unknown, depth: number): void => {
    check(state, ++count <= 4194304 && depth <= 64, CODE.BUDGET, 'Complete retained own-value/depth budget exceeded');
    if (value !== null && typeof value === 'object') Object.values(value).forEach(item => visit(item, depth + 1));
  };
  visit(input, 0); return count;
}
function nativeDomain(curve: Curve): [number, number] {
  return [curve.knots[curve.degree], curve.knots[curve.controlPoints.length]];
}
function line(curveId: string, points: [Point, Point], domain: [number, number] = [0, 1]): Curve {
  return { kind: 'curve', id: curveId, degree: 1,
    knots: [domain[0], domain[0], domain[1], domain[1]],
    controlPoints: points.map(point => point.slice() as Point), weights: [1, 1] };
}
function stations(state: ErrorContext, domain: [number, number]): [number, number, number, number, number] {
  const width = finite(state, domain[1] - domain[0], 'Native edge span overflow');
  check(state, width > 0, CODE.DOMAIN, 'Positive native edge span required');
  const inner = [.25, .5, .75].map(factor => finite(state,
    domain[0] + finite(state, width * factor, 'Edge station multiplication overflow'), 'Edge station addition overflow'));
  const values: [number, number, number, number, number] = [domain[0], inner[0], inner[1], inner[2], domain[1]];
  check(state, values.every((value, index) => index === 0 || value > values[index - 1]), CODE.REPRESENTABILITY,
    'Five strictly ordered represented edge stations required');
  return values;
}
function contexts(input: unknown): Set<string> {
  const ids = new Set<string>();
  const visit = (value: unknown, key = ''): void => {
    if (typeof value === 'string') {
      if (key === 'id' || /Ids?$/.test(key)) ids.add(value);
    } else if (Array.isArray(value)) value.forEach(item => visit(item, key));
    else if (value !== null && typeof value === 'object') {
      for (const [field, item] of Object.entries(value)) visit(item, field);
    }
  };
  visit(input); return ids;
}
function reserveRoles(state: ErrorContext, section: ExactPairedVLinearSurfaceIntersectionResult,
  options: PairedSurfaceUVSplitFacesOptions): string[] {
  const existing = contexts(section), roles: string[] = [];
  const reserve = (value: string): void => {
    id(state, value);
    check(state, !existing.has(value), CODE.IDENTITY, 'Fresh actual role collides with original/parent data');
    existing.add(value); roles.push(value);
  };
  reserve(options.evaluationId);
  const p = options.resultIdPrefix;
  for (const suffix of ['_bottom', '_top', '_right_low', '_right_high', '_left_low', '_left_high']) reserve(p + suffix);
  for (let i = 0; i < 6; i++) reserve(p + '_uv' + i);
  for (let i = 0; i < 6; i++) reserve(p + '_v' + i);
  for (let i = 0; i < 7; i++) reserve(p + '_e' + i);
  for (let i = 0; i < 2; i++) reserve(p + '_l' + i);
  for (let i = 0; i < 2; i++) reserve(p + '_f' + i);
  for (let i = 0; i < 8; i++) reserve(p + '_use' + i);
  check(state, roles.length === 38, CODE.IDENTITY, 'Exact38 fresh role inventory required');
  return roles;
}
function distance(state: ErrorContext, a: Point, b: Point): number {
  return finite(state, Math.hypot(...a.map((value, axis) =>
    finite(state, value - b[axis], 'Point/vector difference overflow', CODE.BINDING))),
  'Point/vector norm overflow', CODE.BINDING);
}
function limits(): PairedSurfaceUVSplitFacesReport['limits'] {
  return { maximumIsoCurves: 2, maximumIntervals: 2, maximumSideLines: 4,
    maximumVertices: 6, maximumEdges: 7, maximumFaces: 2, maximumUses: 8, maximumWorldObjects: 8,
    maximumUDegree: 2, vDegree: 1, maximumCutDegree: 4, maximumProofDegree: 4,
    maximumObservations: 35, maximumNativeObservationAttempts: 210,
    sourceCharacters: 262144, sourceUTF8Bytes: 262144, maximumOriginalModelObjects: 16,
    requestBytes: 4194304, resultBytes: 16777216, ownValues: 4194304, ownDepth: 64,
    arrayElements: 8192, recordFields: 64, keyCharacters: 128, stringCharacters: 262144,
    prefixCharacters: 12, identityCharacters: 48, rationalOperations: 200000,
    gcdSteps: 200000, rationalIntegerBits: 8192, fractionIntegerCharacters: 5000,
    maximumRationalFloatConversions: 0, maximumSettlePasses: 8 };
}
/** Two complementary embedded strips in the unchanged original-A selected UV window. */
export function buildPairedSurfaceUVSplitFaces(input: PairedSurfaceUVSplitFacesRequest): PairedSurfaceUVSplitFacesResult {
  const state = context();
  const data = record(state, snapshot(state, input), ['section', 'options']);
  const o = record(state, data.options, ['evaluationId', 'resultIdPrefix', 'orientation',
    'maximumIsoCurves', 'maximumIntervals', 'maximumObservations']);
  id(state, o.evaluationId); id(state, o.resultIdPrefix, 12);
  check(state, o.orientation === 'forward' || o.orientation === 'reverse', CODE.INPUT,
    'Common forward/reverse Face orientation required');
  check(state, o.maximumIsoCurves === 2 && o.maximumIntervals === 2 && o.maximumObservations === 35,
    CODE.BUDGET, 'Complete fixed child/observation budgets2/2/35 required');
  const options = o as unknown as PairedSurfaceUVSplitFacesOptions;
  const section = data.section as ExactPairedVLinearSurfaceIntersectionResult;
  const request: PairedSurfaceUVSplitFacesRequest = { section, options };
  const requestSize = json(state, request, REQUEST_LIMIT).size;
  state.phase = 'parent'; state.directCounts.parentValidationCount++;
  delegated(state, CODE.PARENT, 'Complete original paired section validation refused',
    () => validateExactPairedVLinearSurfaceIntersection(section));
  const surface = section.request.assets[0].surface, nativeDomains = section.report.selections[0].nativeDomains;
  const interval = section.request.uAInterval;
  check(state, interval[0] < interval[1] && interval[0] >= nativeDomains.u[0] && interval[1] <= nativeDomains.u[1] &&
    (interval[0] > nativeDomains.u[0] || interval[1] < nativeDomains.u[1]), CODE.DOMAIN,
  'Selected UA window must be a proper nonempty subset for the existing interval provider');
  const reservedIds = reserveRoles(state, section, options), p = options.resultIdPrefix;
  const q = new SectionRationalContext((kind, detail) => fail(state, CODE[kind], detail));
  const zero = q.integer(0), vmin = q.from(nativeDomains.v[0]), vmax = q.from(nativeDomains.v[1]);
  state.phase = 'proof';
  check(state, section.pcurves.a.curve.controlPoints.every(point =>
    q.compare(q.sub(q.from(point[1]), vmin), zero) > 0 && q.compare(q.sub(vmax, q.from(point[1])), zero) > 0),
  CODE.REGION, 'Whole degree4 cut hull must be strictly inside original-A V chart');
  const isoData: SurfaceIsoCurveResult[] = [], intervalData: SourceCurveIntervalExtractionResult[] = [];
  let world: World | null = null, proof: Proof | null = null;
  const vertices: Vertex[] = [], edges: Edge[] = [], loopData: Loop[] = [], faceData: Face[] = [], observations: Observation[] = [];
  const prefix = (): void => {
    const previousPhase = state.phase, previousEdge = state.edgeIndex;
    state.phase = 'file'; state.edgeIndex = null;
    const retained = { request, isoCurves: isoData, intervals: intervalData, world, vertices, edges,
      loops: loopData, faces: faceData, proof, observations, reservedIds };
    snapshot(state, retained); json(state, retained, RESULT_LIMIT);
    state.phase = previousPhase; state.edgeIndex = previousEdge;
  };
  prefix();
  for (const [index, parameter] of nativeDomains.v.entries()) {
    state.phase = 'iso'; prefix(); state.directCounts.isoCurveExtractionCount++;
    const iso = delegated(state, CODE.ISO, 'Actual natural V-boundary isoCurve extraction refused',
      () => extractSurfaceIsoCurve(surface, { fixedAxis: 'v', parameter,
        curveId: p + (index === 0 ? '_bottom' : '_top') }));
    check(state, same(iso.original, surface), CODE.BINDING, 'IsoCurve must retain exact original-A support');
    isoData.push(iso); prefix();
  }
  for (const iso of isoData) {
    state.phase = 'interval'; prefix(); state.directCounts.sourceIntervalExtractionCount++;
    const extracted = delegated(state, CODE.INTERVAL, 'Actual complete source Curve interval extraction refused',
      () => extractSourceCurveInterval({ source: iso.source, sourceVersion: 0, curveId: iso.curve.id,
        interval: [interval[0], interval[1]], maximumObservations: 256 }));
    check(state, same(extracted.originalCurve, iso.curve) && same(extracted.originalModel, iso.model) &&
      extracted.curve.id === iso.curve.id && same(extracted.provenance.plan.effectiveInterval, interval) &&
      same(nativeDomain(extracted.curve), interval), CODE.BINDING,
    'Actual interval receipt must preserve original iso Source/Model and unchanged requested endpoint bits');
    intervalData.push(extracted); prefix();
  }
  const isoCurves: [SurfaceIsoCurveResult, SurfaceIsoCurveResult] = [isoData[0], isoData[1]];
  const intervals: [SourceCurveIntervalExtractionResult, SourceCurveIntervalExtractionResult] = [intervalData[0], intervalData[1]];
  const cut = section.world.curve, cutUV = section.pcurves.a.curve;
  check(state, same(nativeDomain(cut), interval) && same(nativeDomain(cutUV), interval), CODE.BINDING,
    'Borrowed cut World/UV domains must retain selected UA endpoint bits');
  const bottom = intervals[0].curve, top = intervals[1].curve;
  const pointCopy = (point: Point): Point => point.slice() as Point;
  const cutLeft = pointCopy(cut.controlPoints[0]), cutRight = pointCopy(cut.controlPoints[cut.controlPoints.length - 1]);
  const uvLeft = pointCopy(cutUV.controlPoints[0]), uvRight = pointCopy(cutUV.controlPoints[cutUV.controlPoints.length - 1]);
  const uv: Point[] = [[uvLeft[0], nativeDomains.v[0], 0], [uvRight[0], nativeDomains.v[0], 0],
    [uvRight[0], nativeDomains.v[1], 0], [uvLeft[0], nativeDomains.v[1], 0], uvLeft, uvRight];
  const points: Point[] = [pointCopy(bottom.controlPoints[0]), pointCopy(bottom.controlPoints[bottom.controlPoints.length - 1]),
    pointCopy(top.controlPoints[top.controlPoints.length - 1]), pointCopy(top.controlPoints[0]), cutLeft, cutRight];
  const vertexRoles: VertexRole[] = ['bottomLeft', 'bottomRight', 'topRight', 'topLeft', 'cutLeft', 'cutRight'];
  for (let i = 0; i < 6; i++) vertices.push({ id: p + '_v' + i, role: vertexRoles[i],
    sourceId: section.request.assets[0].sourceId, surfaceId: surface.id, world: points[i], uv: uv[i] });
  const pairs: [number, number][] = [[0, 1], [1, 5], [5, 2], [3, 2], [0, 4], [4, 3], [4, 5]];
  const roles: Role[] = ['bottom', 'rightLow', 'rightHigh', 'top', 'leftLow', 'leftHigh', 'sharedCut'];
  const sideIndices = [1, 2, 4, 5];
  const curves: Curve[] = [bottom, line(p + '_right_low', [points[1], points[5]]),
    line(p + '_right_high', [points[5], points[2]]), top,
    line(p + '_left_low', [points[0], points[4]]), line(p + '_left_high', [points[4], points[3]]), cut];
  for (const index of sideIndices) {
    state.phase = 'side'; state.edgeIndex = index; prefix(); state.directCounts.sideWorldValidationCount++;
    delegated(state, CODE.NATIVE, 'Actual copied-endpoint World side Line admission refused', () => validateCurve(curves[index]));
  }
  const uvIds = [p + '_uv0', p + '_uv1', p + '_uv2', p + '_uv3', p + '_uv4', p + '_uv5', cutUV.id];
  const uvCurves = pairs.map((pair, index) => index === 6 ? cutUV :
    line(uvIds[index], [uv[pair[0]], uv[pair[1]]], nativeDomain(curves[index])));
  for (let i = 0; i < 6; i++) {
    state.phase = 'uv'; state.edgeIndex = i; prefix(); state.directCounts.newUVValidationCount++;
    delegated(state, CODE.NATIVE, 'Actual copied-coordinate UV Line admission refused', () => validateCurve(uvCurves[i]));
  }
  state.phase = 'adoption'; state.edgeIndex = null; prefix(); state.directCounts.worldModelAdoptionCount++;
  const model: Model = { name: options.evaluationId, version: 0, lengthUnit: 'mm', objects: [surface, ...curves] };
  const adopted = delegated(state, CODE.NATIVE, 'Actual complete World Model8 source adoption refused',
    () => adoptSourceModel(model));
  check(state, same(adopted.model, model) && adopted.model.objects.length === 8, CODE.BINDING,
    'Complete actual World Model8 must preserve original support and all seven Curves');
  size(state, adopted.source);
  world = { source: adopted.source, sourceVersion: 0, model: adopted.model };
  for (let i = 0; i < 7; i++) {
    const adoptedCurve = world.model.objects[i + 1];
    check(state, adoptedCurve.kind === 'curve' && same(adoptedCurve, curves[i]), CODE.BINDING,
      'Actual adopted Curve source member differs from canonical World data');
    edges.push({ id: p + '_e' + i, role: roles[i], curve: adoptedCurve,
      vertexIds: [vertices[pairs[i][0]].id, vertices[pairs[i][1]].id],
      pcurve: { coordinateSystem: 'original-native-uv', lengthUnit: 'dimensionless', curve: uvCurves[i] },
      origin: { kind: i === 0 || i === 3 ? 'restricted-isocurve' : i === 6 ? 'paired-section' : 'exact-fixed-u-line',
        index: i === 0 ? 0 : i === 3 ? 1 : i === 6 ? null : sideIndices.indexOf(i) },
      sourceRef: { sourceField: 'world.source', modelField: 'world.model', modelName: world.model.name,
        objectIndex: i + 1, curveId: adoptedCurve.id } });
  }
  const makeUse = (edgeIndex: number, sense: Sense, useIndex: number): Loop['uses'][number] => {
    const edge = edges[edgeIndex], domain = nativeDomain(edge.curve);
    return { id: p + '_use' + useIndex, edgeId: edge.id,
      vertexIds: sense === 'forward' ? [edge.vertexIds[0], edge.vertexIds[1]] : [edge.vertexIds[1], edge.vertexIds[0]],
      sense, interval: sense === 'forward' ? domain : [domain[1], domain[0]], pcurveId: edge.pcurve.curve.id };
  };
  const lower: Loop['uses'] = [makeUse(0, 'forward', 0), makeUse(1, 'forward', 1),
    makeUse(6, 'reverse', 2), makeUse(4, 'reverse', 3)];
  const upper: Loop['uses'] = [makeUse(6, 'forward', 4), makeUse(2, 'forward', 5),
    makeUse(3, 'reverse', 6), makeUse(5, 'reverse', 7)];
  const orient = (uses: Loop['uses']): Loop['uses'] => options.orientation === 'forward' ? uses :
    uses.slice().reverse().map(use => ({ ...use, sense: use.sense === 'forward' ? 'reverse' : 'forward',
      interval: [use.interval[1], use.interval[0]], vertexIds: [use.vertexIds[1], use.vertexIds[0]] })) as Loop['uses'];
  loopData.push({ id: p + '_l0', uses: orient(lower) }, { id: p + '_l1', uses: orient(upper) });
  faceData.push({ id: p + '_f0', sourceId: section.request.assets[0].sourceId, surfaceId: surface.id,
    outerLoopId: loopData[0].id, orientation: options.orientation, region: 'below-cut' },
  { id: p + '_f1', sourceId: section.request.assets[0].sourceId, surfaceId: surface.id,
    outerLoopId: loopData[1].id, orientation: options.orientation, region: 'above-cut' });
  const loops: [Loop, Loop] = [loopData[0], loopData[1]], faces: [Face, Face] = [faceData[0], faceData[1]];
  prefix(); state.phase = 'proof';
  try { proof = provePairedSurfaceUVSplitFacesTrusted(section, isoCurves, intervals, world, vertices, edges, loops, faces, q); }
  catch (cause) {
    if (cause instanceof PairedSurfaceUVSplitFacesError) throw cause;
    if (cause instanceof PairedSurfaceUVSplitFacesProofError) {
      state.edgeIndex = cause.edgeIndex; fail(state, cause.code, 'Whole actual paired UV split Face proof refused', cause);
    }
    fail(state, CODE.BINDING, 'Whole actual paired UV split Face proof refused', cause);
  }
  check(state, proof.wholeModelGapZero && proof.faceCertificates.length === 2 &&
    proof.uvRegions.closedCoverOfWindow && proof.uvRegions.disjointInteriors,
  CODE.BINDING, 'Complete source-bound complementary disk proof required');
  check(state, q.counts().floatConversions === 0, CODE.BINDING, 'Root rational Float conversions must remain zero');
  prefix();
  const derivativeCounts: PairedSurfaceUVSplitFacesReport['derivativeCounts'] = {
    world: { evaluated: 0, refused: 0 }, pcurve: { evaluated: 0, refused: 0 }, surface: { evaluated: 0, refused: 0 },
  };
  const d1State = <T>(kind: 'world' | 'pcurve' | 'surface', action: () => T): D1<T> => {
    try {
      const value = action(); derivativeCounts[kind].evaluated++; return { status: 'evaluated', value };
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'First derivative is not defined at an exact C0 interior knot') {
        derivativeCounts[kind].refused++;
        return { status: 'native-refused', reason: cause.message, nativeErrorName: cause.name };
      }
      if (cause instanceof PairedSurfaceUVSplitFacesError) throw cause;
      fail(state, CODE.NATIVE, 'Actual native first-derivative provider refused', cause);
    }
  };
  const point = (curve: Curve, parameter: number): Point => {
    state.directCounts.curveD0Count++;
    const value = delegated(state, CODE.NATIVE, 'Actual World/UV Curve D0 refused', () => evaluateCurve(curve, parameter));
    check(state, value.every(Number.isFinite), CODE.NATIVE, 'Finite native Curve point required'); return value;
  };
  const curveD1 = (curve: Curve, parameter: number, kind: 'world' | 'pcurve'): D1<CurveD1Result> => {
    state.directCounts.curveD1AttemptCount++;
    return d1State(kind, () => {
      const value = evaluateCurveD1(curve, parameter);
      check(state, value.point.every(Number.isFinite) && value.derivative.every(Number.isFinite),
        CODE.NATIVE, 'Finite actual native Curve D1 required'); return value;
    });
  };
  for (const [edgeIndex, edge] of edges.entries()) {
    state.phase = 'observation'; state.edgeIndex = edgeIndex; state.observationIndex = null;
    const parameters = stations(state, nativeDomain(edge.curve));
    for (const [index, parameter] of parameters.entries()) {
      state.observationIndex = index; prefix(); state.directCounts.observationCount++;
      const wd0 = point(edge.curve, parameter), pd0 = point(edge.pcurve.curve, parameter);
      check(state, Object.is(pd0[2], 0), CODE.BINDING, 'Actual UV point must retain zero third coordinate');
      const wd1 = curveD1(edge.curve, parameter, 'world'), pd1 = curveD1(edge.pcurve.curve, parameter, 'pcurve');
      state.directCounts.surfaceD0Count++;
      const sd0 = delegated(state, CODE.NATIVE, 'Actual original-A Surface D0 refused',
        () => evaluateSurface(surface, pd0[0], pd0[1]));
      check(state, sd0.every(Number.isFinite), CODE.NATIVE, 'Finite actual original Surface point required');
      state.directCounts.surfaceD1AttemptCount++;
      const sd1 = d1State('surface', () => {
        const value = evaluateSurfaceD1(surface, pd0[0], pd0[1]);
        check(state, value.point.every(Number.isFinite) && value.du.every(Number.isFinite) && value.dv.every(Number.isFinite),
          CODE.NATIVE, 'Finite whole original Surface D1 required'); return value;
      });
      let chain: Point | null = null, relativeChainGap: number | null = null;
      if (wd1.status === 'evaluated' && pd1.status === 'evaluated' && sd1.status === 'evaluated') {
        chain = sd1.value.du.map((value, axis) => finite(state,
          finite(state, value * pd1.value.derivative[0], 'Surface-U chain product overflow', CODE.BINDING) +
          finite(state, sd1.value.dv[axis] * pd1.value.derivative[1], 'Surface-V chain product overflow', CODE.BINDING),
        'Surface chain sum overflow', CODE.BINDING)) as Point;
        const difference = distance(state, wd1.value.derivative, chain);
        const worldNorm = finite(state, Math.hypot(...wd1.value.derivative), 'World derivative norm overflow', CODE.BINDING);
        const chainNorm = finite(state, Math.hypot(...chain), 'Surface chain norm overflow', CODE.BINDING);
        const scale = finite(state, Math.max(1, worldNorm, chainNorm), 'Relative chain scale overflow', CODE.BINDING);
        relativeChainGap = finite(state, difference / scale, 'Relative chain difference overflow', CODE.BINDING);
        check(state, relativeChainGap <= 1e-7, CODE.BINDING, 'Native relative chain residual exceeds1e-7');
      }
      const pointGapMM = distance(state, wd0, sd0);
      const worldD0D1PointGapMM = wd1.status === 'evaluated' ? distance(state, wd0, wd1.value.point) : null;
      const uvD0D1PointGap = pd1.status === 'evaluated' ? distance(state, pd0, pd1.value.point) : null;
      const surfaceD0D1PointGapMM = sd1.status === 'evaluated' ? distance(state, sd0, sd1.value.point) : null;
      check(state, [pointGapMM, worldD0D1PointGapMM, uvD0D1PointGap, surfaceD0D1PointGapMM].every(value =>
        value === null || value <= 1e-7), CODE.BINDING, 'Native point/D0-D1 residual exceeds1e-7 in its own coordinate units');
      observations.push({ edgeId: edge.id, edgeIndex, index, parameter, world: { d0: wd0, d1: wd1 },
        pcurve: { d0: pd0, d1: pd1 }, surface: { d0: sd0, d1: sd1 }, chain,
        residuals: { pointGapMM, worldD0D1PointGapMM, uvD0D1PointGap, surfaceD0D1PointGapMM, relativeChainGap } });
      prefix();
    }
  }
  state.phase = 'file'; state.edgeIndex = null; state.observationIndex = null;
  const counts = state.directCounts;
  check(state, counts.parentValidationCount === 1 && counts.isoCurveExtractionCount === 2 &&
    counts.sourceIntervalExtractionCount === 2 && counts.sideWorldValidationCount === 4 && counts.newUVValidationCount === 6 &&
    counts.worldModelAdoptionCount === 1 && counts.observationCount === 35 && counts.curveD0Count === 70 &&
    counts.curveD1AttemptCount === 70 && counts.surfaceD0Count === 35 && counts.surfaceD1AttemptCount === 35 &&
    q.counts().floatConversions === 0, CODE.BINDING, 'Actual successful direct/provider observation schedule disagrees');
  const actualWorld = world, actualProof = proof;
  const report: PairedSurfaceUVSplitFacesReport = {
    schema: 'barocss-paired-surface-uv-split-faces', version: 0, evaluationId: options.evaluationId,
    parentEvaluationId: section.report.evaluationId, support: actualProof.support, orientation: options.orientation,
    window: actualProof.window, lengthUnit: 'mm', uvLengthUnit: 'dimensionless',
    parameterFrame: 'original-a-u-window-and-native-edge-parameters', vertexCount: 6, edgeCount: 7,
    faceCount: 2, loopCount: 2, useCount: 8, worldObjectCount: 8,
    sharedCutEdgeId: edges[6].id, sharedWorldCurveId: cut.id, sharedPcurveId: cutUV.id,
    worldModelName: actualWorld.model.name, reservedIds,
    minimumLowerGap: actualProof.cut.minimumLowerGap, minimumUpperGap: actualProof.cut.minimumUpperGap,
    xyDeterminant: actualProof.projection.xyDeterminant, wholeEdgeModelGapMM: 0,
    maximumObservedPointGapMM: Math.max(...observations.flatMap(observation => [observation.residuals.pointGapMM,
      observation.residuals.worldD0D1PointGapMM ?? 0, observation.residuals.surfaceD0D1PointGapMM ?? 0])),
    maximumObservedRelativeChainGap: Math.max(0, ...observations.map(observation => observation.residuals.relativeChainGap ?? 0)),
    derivativeCounts, directCounts: { ...counts } as PairedSurfaceUVSplitFacesReport['directCounts'],
    inheritedCounts: { parent: section.report.directCounts, iso: [isoCurves[0].report, isoCurves[1].report],
      intervals: [intervals[0].report.directCounts, intervals[1].report.directCounts] }, rationalCounts: q.counts(),
    quality: { individualFaceEmbedded: true, closedUVDisks: true, complementaryWindowRegions: true,
      exactWorldSurfaceAgreement: true, sharedCutUnchanged: true, oppositeSharedUses: true,
      fullOriginalSourcesAndBothUVRetained: true, parentFlagsUnchanged: true,
      wholeOriginalOutsideWindowSplit: false, bSplitProduced: false, sewnManifold: false,
      wholeBodyTopologyCertified: false, solid: false, occupiedVolumeCertified: false,
      worldSurfaceAreaComputed: false, genericBoolean: false, globalBinary64EvaluationErrorCertified: false,
      manufacturingToleranceCertified: false, publication: false, ownership: 'independent-copied-cpu-data-gc' },
    fileSizes: { request: requestSize, result: { utf16: 0, utf8: 0 } }, ownValues: 0, limits: limits(),
    workScope: 'direct-parent-iso-interval-adoption-and-edge-observations-with-inherited-work-separated',
    budgetFailure: 'atomic-no-partial-complementary-faces',
  };
  const result: PairedSurfaceUVSplitFacesResult = { request, isoCurves, intervals, world: actualWorld,
    vertices, edges, loops, faces, proof: actualProof, observations, report };
  let settled = false;
  for (let pass = 0; pass < 8; pass++) {
    const count = ownValues(state, result), measured = json(state, result, RESULT_LIMIT).size;
    if (report.ownValues === count && same(report.fileSizes.result, measured)) { settled = true; break; }
    report.ownValues = count; report.fileSizes.result = measured;
  }
  check(state, settled && report.ownValues === ownValues(state, result) &&
    same(report.fileSizes.result, json(state, result, RESULT_LIMIT).size), CODE.FILE,
  'Whole complementary Face own/file measurements did not settle in8 passes');
  return snapshot(state, result) as PairedSurfaceUVSplitFacesResult;
}
/** Reconstruct once from the full paired parent and return an independent complete Report. */
export function validatePairedSurfaceUVSplitFaces(input: unknown): PairedSurfaceUVSplitFacesReport {
  const state = context(); state.phase = 'owned';
  try {
    const result = record(state, snapshot(state, input, true), ['request', 'isoCurves', 'intervals', 'world', 'vertices',
      'edges', 'loops', 'faces', 'proof', 'observations', 'report'], CODE.OWNED) as unknown as PairedSurfaceUVSplitFacesResult;
    json(state, result, RESULT_LIMIT);
    const expected = buildPairedSurfaceUVSplitFaces(result.request);
    state.directCounts = { ...expected.report.directCounts };
    check(state, same(result, expected), CODE.OWNED, 'Whole paired parent/children/Source/graph/proof/observations/counts changed');
    return snapshot(state, expected.report, true) as PairedSurfaceUVSplitFacesReport;
  } catch (cause) {
    if (cause instanceof PairedSurfaceUVSplitFacesError && cause.code === CODE.OWNED) throw cause;
    const failed = cause instanceof PairedSurfaceUVSplitFacesError ? cause.context : state;
    throw new PairedSurfaceUVSplitFacesError(CODE.OWNED, 'Whole complementary Face reconstruction refused',
      { ...failed, phase: 'owned' }, cause);
  }
}
