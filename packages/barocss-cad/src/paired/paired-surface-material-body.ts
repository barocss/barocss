import { validatePairedSurfaceUVSplitFaces } from './paired-surface-uv-split-faces.js';
import { validatePairedSurfaceBUVSplitFaces } from './paired-surface-b-uv-split-faces.js';
import { buildCompatibleRuledSurface } from '../nurbs/surfaces/compatible-ruled-surface.js';
import { buildParametricFace } from '../face.js';
import { adopt as adoptSourceModel } from '../intersect/own-plane-cylinder-intersection-internal.js';
import { validateCurve, evaluateCurve } from '../math.js';
import { SectionRationalContext } from '../section-rational-internal.js';
import { provePairedSurfaceMaterialBodyTrusted, PairedSurfaceMaterialBodyProofError } from './paired-surface-material-body-proof-internal.js';
import type {Point,Curve,Surface,Model} from '../types.js';
import type {FaceBundle,FaceIds} from '../face.js';
import type {CompatibleRuledSurfaceResult} from '../nurbs/surfaces/compatible-ruled-surface.js';
import type {PairedSurfaceUVSplitFacesResult} from './paired-surface-uv-split-faces.js';
import type {PairedSurfaceBUVSplitFacesResult} from './paired-surface-b-uv-split-faces.js';
import type {SectionFraction,SectionRational} from '../section-rational-internal.js';
import { same } from '../structural-equality.js';
type F=SectionFraction;
type Sense='forward'|'reverse';
type Size={utf16:number;utf8:number};
type ClosureRole='yMin'|'zMin'|'xMin'|'xMax';
type FaceRole='roof'|'side'|ClosureRole;
type EdgeRole='cut'|'roofYMin'|'roofXMin'|'roofXMax'|'sideZMin'|'sideXMin'|'sideXMax'|
  'lowYLowZ'|'lowYXMin'|'lowYXMax'|'lowZXMin'|'lowZXMax';
export interface PairedSurfaceMaterialBodyOptions {
  evaluationId:string;resultIdPrefix:string;maximumClosures:4;maximumFaces:6;
  maximumEdgePairs:12;maximumObservations:24;
}
export interface PairedSurfaceMaterialBodyRequest {
  a:PairedSurfaceUVSplitFacesResult;b:PairedSurfaceBUVSplitFacesResult;options:PairedSurfaceMaterialBodyOptions;
}
type SourceRef={sourceId:string;sourceField:string;modelField:string;modelName:string;objectIndex:number;objectId:string};
type SourceModel={sourceId:string;source:string;sourceVersion:0;model:Model};
type Closure={role:ClosureRole;lowCurve:Curve;ruled:CompatibleRuledSurfaceResult;
  faceIds:FaceIds;face:FaceBundle;world:SourceModel};
type Closures=[Closure,Closure,Closure,Closure];
type LocalFaceRef={kind:'a'|'b'|'closure';closureIndex:number|null;faceId:string;loopId:string;
  supportRef:SourceRef;sourceField:string;modelField:string};
type LocalVertexRef={face:LocalFaceRef;vertexId:string;world:Point};
type LocalUseRef={face:LocalFaceRef;edgeId:string;useId:string|null;curveId:string;
  localVertexIds:[string,string];localCurve:Curve;
  pcurve:{kind:'native-curve';curve:Curve}|{kind:'native-line';domain:[number,number];uv0:[number,number];uv1:[number,number]};
  sense:Sense;interval:[number,number];curveRef:SourceRef};
type ParameterMap={canonicalDomain:[number,number];localDomain:[number,number];offset:F;scale:F;
  localEndpointParameters:[number,number];endpointResiduals:[F,F];wholeCurveResiduals:F[][];proofDegree:4};
type GlobalUse={id:string;faceId:string;loopId:string;edgeId:string;vertexIds:[string,string];sense:Sense;
  origin:LocalUseRef;parameterMap:ParameterMap};
type Vertex={id:string;world:Point;members:LocalVertexRef[]};
type Edge={id:string;role:EdgeRole;curve:Curve;curveRef:SourceRef;vertexIds:[string,string];
  parameterRange:[number,number];uses:[GlobalUse,GlobalUse]};
type Loop={id:string;faceId:string;uses:[GlobalUse,GlobalUse,GlobalUse,GlobalUse]};
type Face={id:string;role:FaceRole;support:Surface;supportRef:SourceRef;origin:LocalFaceRef;
  orientation:Sense;outerLoopId:string;loop:Loop};
type Shell={id:string;faceIds:[string,string,string,string,string,string];closed:true;oriented:true};
type Body={id:string;shellIds:[string];materialCertificateId:string;closed:true;solid:true;restrictedSolidCertified:true};
type Graph={vertices:Vertex[];edges:Edge[];faces:Face[];shell:Shell;body:Body};
type FaceImage={faceId:string;role:FaceRole;supportRef:SourceRef;
  originalSupport:Surface;nativeDomains:{u:[number,number];v:[number,number]};
  cubeRestriction:'t=1'|'s=1'|'s=0'|'t=0'|'u=uMin'|'u=uMax';
  chartVariables:['u','s']|['u','t']|['s','t'];
  nativeUVPower:F[][][];actualCartesian:F[][][];expectedCartesian:F[][][];
  residuals:F[][][];proofDegrees:{first:4;second:1};wholeImageEqual:true;
  outward:{axis:'x'|'y'|'z';sign:-1|1;principalCoefficients:F[];minimumAbsolute:F};
  storedLocalUsesUnchanged:true};
type EdgePair={edgeId:string;role:EdgeRole;canonicalCurveRef:SourceRef;
  occurrences:[{useId:string;origin:LocalUseRef;parameterMap:ParameterMap},{useId:string;origin:LocalUseRef;parameterMap:ParameterMap}];
  oppositeEffectiveUses:true;exactWholeWorldImage:true};
type Germ={edgeId:string;endpointIndex:0|1};
type VertexLink={vertexId:string;germs:[Germ,Germ,Germ];
  cornerArcs:{faceId:string;incomingUseId:string;outgoingUseId:string;from:Germ;to:Germ}[];
  cycle:Germ[];connected:true;degreeTwo:true};
type MaterialProof={certificateId:string;bodyId:string;shellId:string;faceIds:string[];
  sourceRefs:SourceRef[];profile:{aXIdentity:true;aYIdentity:true;bXShiftIdentity:true;bZIdentity:true;
    originalUBOffset:F;originalUBScale:F;unitPositiveAxes:true;constantPositiveWeights:true;
    bYPower:F[];aZPower:F[][];sourceResiduals:F[][][]};
  cubeMap:{domain:{u:[number,number];s:[0,1];t:[0,1]};lowY:F;lowZ:F;
    heightYBernstein:F[];heightZBernstein:F[][];heightProofUDegree:4;heightProofSDegree:1;
    minimumHeightY:F;minimumHeightZ:F;jacobianBernstein:F[][];
    jacobianDegrees:{u:8;s:1};minimumJacobian:F;
    inverse:'u=X;s=(Y-lowY)/heightY(u);t=(Z-lowZ)/heightZ(u,s)';globallyInjective:true};
  faceImages:[FaceImage,FaceImage,FaceImage,FaceImage,FaceImage,FaceImage];
  volume:{exactVolumeMM3:F;integrandBernstein:F[];degree:8;integrationResidual:F;unit:'mm3'};
  sourceDefinedOccupiedRegion:true;wholeBoundaryImage:true;outwardMaterial:true;
  embeddedClosedBoundary:true;restrictedSolidCertified:true;parentFlagsUnchanged:true};
type Proof={schema:'barocss-paired-surface-material-body-proof';version:0;
  correspondence:EdgePair[];vertexClasses:{vertexId:string;members:LocalVertexRef[]}[];
  vertexLinks:VertexLink[];faceAdjacency:{faceId:string;adjacentFaceIds:string[]}[];
  sourceInventory:SourceRef[];eulerCharacteristic:2;connectedFaceGraph:true;material:MaterialProof};
type Observation={index:number;edgeId:string;endpointIndex:0|1;parameter:number;vertexId:string;
  canonicalPoint:Point;vertexWorld:Point;canonicalVertexGapMM:number;
  local:[{useId:string;parameter:number;point:Point;canonicalGapMM:number;vertexGapMM:number},
    {useId:string;parameter:number;point:Point;canonicalGapMM:number;vertexGapMM:number}]};
type DirectCounts={parentValidationCount:number;newCurveValidationCount:number;
  ruledSurfaceBuildCount:number;parametricFaceBuildCount:number;faceModelAdoptionCount:number;
  constructorDelegationCount:number;observationCount:number;curveD0AttemptCount:number;
  curveD1AttemptCount:0;surfaceD0AttemptCount:0;surfaceD1AttemptCount:0;
  sourceCompilationCount:0;rationalFloatConversionCount:0};
export interface PairedSurfaceMaterialBodyResult {
  request:PairedSurfaceMaterialBodyRequest;closures:Closures;vertices:Vertex[];edges:Edge[];faces:Face[];
  shell:Shell;body:Body;proof:Proof;observations:Observation[];report:PairedSurfaceMaterialBodyReport;
}
export interface PairedSurfaceMaterialBodyReport {
  schema:'barocss-paired-surface-material-body';version:0;evaluationId:string;
  parentEvaluationIds:[string,string];pairedEvaluationId:string;bodyId:string;shellId:string;
  materialCertificateId:string;faceIds:string[];vertexCount:8;edgeCount:12;faceCount:6;loopCount:6;
  useCount:24;edgePairCount:12;vertexLinkCount:8;cornerArcCount:24;freeBoundaryCount:0;
  eulerCharacteristic:2;connectedFaceGraph:true;originalTrimmedModelCount:2;
  closureRuledModelCount:4;closureFaceModelCount:4;flattenedMasterModelProduced:false;
  directionConvention:'selected-parent-stored-use-order-already-includes-face-orientation';
  sourceFrame:'authored-xyz-no-axis-conversion';uvLengthUnit:'dimensionless';lengthUnit:'mm';volumeUnit:'mm3';
  exactVolumeMM3:F;minimumHeightY:F;minimumHeightZ:F;minimumJacobian:F;
  maximumObservedEndpointGapMM:number;reservedIds:string[];
  directCounts:DirectCounts;
  inheritedCounts:{a:PairedSurfaceUVSplitFacesResult['report']['directCounts'];
    b:PairedSurfaceBUVSplitFacesResult['report']['directCounts'];
    ruled:[CompatibleRuledSurfaceResult['report'],CompatibleRuledSurfaceResult['report'],
      CompatibleRuledSurfaceResult['report'],CompatibleRuledSurfaceResult['report']]};
  rationalCounts:ReturnType<SectionRationalContext['counts']>;
  quality:{sharedBodyTopology:true;manifold:true;restrictedSolid:true;sourceDefinedOccupiedRegion:true;
    exactOccupiedVolume:true;outwardMaterial:true;wholeBodyEmbedding:true;fullParentsAndClosuresRetained:true;
    parentFlagsUnchanged:true;genericBoolean:false;generalCurvedSolidProperties:false;
    globalC1:false;globalBinary64EvaluationErrorCertified:false;manufacturingToleranceCertified:false;
    weldingPerformed:false;publication:false;ownership:'independent-copied-cpu-data-gc'};
  fileSizes:{request:Size;result:Size};ownValues:number;
  limits:{maximumClosures:4;maximumFaces:6;maximumEdgePairs:12;maximumObservations:24;
    maximumNativeD0Attempts:72;maximumVertices:8;maximumEdges:12;maximumUses:24;
    maximumOriginalUDegree:2;vDegree:1;maximumProofDegree:8;maximumRuledDegree:2;
    sourceCharacters:262144;sourceUTF8Bytes:262144;maximumObjectsPerModel:16;
    requestBytes:8388608;resultBytes:16777216;ownValues:4194304;ownDepth:64;arrayElements:8192;
    recordFields:64;keyCharacters:128;stringCharacters:262144;prefixCharacters:8;identityCharacters:48;
    rationalOperations:200000;gcdSteps:200000;rationalIntegerBits:8192;fractionIntegerCharacters:5000;
    maximumRationalFloatConversions:0;maximumSettlePasses:8};
  workScope:'two-full-parent-validations-four-real-closure-factories-and-exact-material-proof-with-inherited-work-separated';
  budgetFailure:'atomic-no-partial-material-body';
}

export const PairedSurfaceMaterialBodyDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', IDENTITY: 'IDENTITY', PARENT: 'PARENT', PROFILE: 'PROFILE', SOURCE: 'SOURCE',
  NATIVE: 'NATIVE', CLOSURE: 'CLOSURE', TOPOLOGY: 'TOPOLOGY', MATERIAL: 'MATERIAL',
  ORIENTATION: 'ORIENTATION', DOMAIN: 'DOMAIN', REPRESENTABILITY: 'REPRESENTABILITY',
  BINDING: 'BINDING', BUDGET: 'BUDGET', FILE: 'FILE', OWNED: 'OWNED',
} as const);
type Code = typeof PairedSurfaceMaterialBodyDiagnosticCode[keyof typeof PairedSurfaceMaterialBodyDiagnosticCode];
type Context = {
  phase: 'input' | 'parent' | 'profile' | 'closure' | 'adoption' | 'topology' | 'material' | 'observation' | 'file' | 'owned';
  assetIndex: 0 | 1 | null; closureIndex: number | null; edgeIndex: number | null; observationIndex: number | null;
  directCounts: { [K in keyof DirectCounts]: number };
};
export class PairedSurfaceMaterialBodyError extends Error {
  readonly code: Code;
  readonly context: Context;
  constructor(code: Code, detail: string, context: Context, cause?: unknown) {
    super(('Paired Surface material Body: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'PairedSurfaceMaterialBodyError'; this.code = code;
    this.context = { ...context, directCounts: { ...context.directCounts } };
  }
}
const CODE = PairedSurfaceMaterialBodyDiagnosticCode;
const REQUEST_LIMIT = 8388608, RESULT_LIMIT = 16777216;
function context(): Context {
  return { phase: 'input', assetIndex: null, closureIndex: null, edgeIndex: null, observationIndex: null,
    directCounts: { parentValidationCount: 0, newCurveValidationCount: 0, ruledSurfaceBuildCount: 0,
      parametricFaceBuildCount: 0, faceModelAdoptionCount: 0, constructorDelegationCount: 0,
      observationCount: 0, curveD0AttemptCount: 0, curveD1AttemptCount: 0,
      surfaceD0AttemptCount: 0, surfaceD1AttemptCount: 0, sourceCompilationCount: 0, rationalFloatConversionCount: 0 } };
}
function fail(state: Context, code: Code, detail: string, cause?: unknown): never {
  throw new PairedSurfaceMaterialBodyError(code, detail, state, cause);
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
  const previous = { ...state };
  state.phase = 'file'; state.assetIndex = null; state.closureIndex = null; state.edgeIndex = null; state.observationIndex = null;
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
  Object.assign(state, previous); state.phase = previousPhase;
  return { text: retain ? parts.join('') : '', size: { utf16, utf8 } };
}
function delegated<T>(state: Context, code: Code, detail: string, action: () => T): T {
  try { return action(); } catch (cause) {
    if (cause instanceof PairedSurfaceMaterialBodyError) throw cause;
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
function nativeDomain(curve: Curve): [number, number] {
  return [curve.knots[curve.degree], curve.knots[curve.controlPoints.length]];
}
function pointCopy(point: Point): Point { return point.slice() as Point; }
function finite(state: Context, value: number, detail: string): number {
  check(state, Number.isFinite(value), CODE.REPRESENTABILITY, detail); return value;
}
function distance(state: Context, a: Point, b: Point): number {
  return finite(state, Math.hypot(...a.map((value, axis) =>
    finite(state, value - b[axis], 'Native point difference overflow'))), 'Native point norm overflow');
}
function reserveRoles(state: Context, request: PairedSurfaceMaterialBodyRequest): string[] {
  const existing = new Set<string>(), roles: string[] = [];
  const visit = (value: unknown, key = ''): void => {
    if (typeof value === 'string') {
      if (key === 'id' || /Ids?$/.test(key)) existing.add(value);
    } else if (Array.isArray(value)) value.forEach(item => visit(item, key));
    else if (value !== null && typeof value === 'object')
      Object.entries(value).forEach(([field, item]) => visit(item, field));
  };
  visit(request.a); visit(request.b);
  const reserve = (value: string): void => {
    id(state, value); check(state, !existing.has(value), CODE.IDENTITY, 'Fresh Body role collides with retained identity data');
    existing.add(value); roles.push(value);
  };
  const p = request.options.resultIdPrefix;
  reserve(request.options.evaluationId);
  for (let i = 0; i < 4; i++) {
    for (const suffix of ['_low', '_s', '_source', '_f', '_l']) reserve(p + '_c' + i + suffix);
    for (const kind of ['v', 'e', 'b']) for (let j = 0; j < 4; j++) reserve(p + '_c' + i + '_' + kind + j);
  }
  for (const [kind, count] of [['v', 8], ['e', 12], ['f', 6], ['l', 6], ['use', 24]] as const)
    for (let i = 0; i < count; i++) reserve(p + '_' + kind + i);
  for (const suffix of ['_shell', '_body', '_material']) reserve(p + suffix);
  check(state, roles.length === 128, CODE.IDENTITY, 'Exact128 fresh Body role inventory required');
  return roles;
}
function limits(): PairedSurfaceMaterialBodyReport['limits'] {
  return { maximumClosures: 4, maximumFaces: 6, maximumEdgePairs: 12, maximumObservations: 24,
    maximumNativeD0Attempts: 72, maximumVertices: 8, maximumEdges: 12, maximumUses: 24,
    maximumOriginalUDegree: 2, vDegree: 1, maximumProofDegree: 8, maximumRuledDegree: 2,
    sourceCharacters: 262144, sourceUTF8Bytes: 262144, maximumObjectsPerModel: 16,
    requestBytes: REQUEST_LIMIT, resultBytes: RESULT_LIMIT, ownValues: 4194304, ownDepth: 64,
    arrayElements: 8192, recordFields: 64, keyCharacters: 128, stringCharacters: 262144,
    prefixCharacters: 8, identityCharacters: 48, rationalOperations: 200000, gcdSteps: 200000,
    rationalIntegerBits: 8192, fractionIntegerCharacters: 5000,
    maximumRationalFloatConversions: 0, maximumSettlePasses: 8 };
}

/** Actual mixed trimmed/natural six-Face Body in the exact unit-axis source profile. */
export function buildPairedSurfaceMaterialBody(
  inputA: PairedSurfaceUVSplitFacesResult, inputB: PairedSurfaceBUVSplitFacesResult,
  inputOptions: PairedSurfaceMaterialBodyOptions,
): PairedSurfaceMaterialBodyResult {
  const state = context();
  const data = record(state, snapshot(state, { a: inputA, b: inputB, options: inputOptions }), ['a', 'b', 'options']);
  const settings = record(state, data.options, ['evaluationId', 'resultIdPrefix', 'maximumClosures',
    'maximumFaces', 'maximumEdgePairs', 'maximumObservations']);
  id(state, settings.evaluationId); id(state, settings.resultIdPrefix, 8);
  check(state, settings.maximumClosures === 4 && settings.maximumFaces === 6 &&
    settings.maximumEdgePairs === 12 && settings.maximumObservations === 24,
  CODE.BUDGET, 'Complete fixed closure/Face/pair/observation budgets4/6/12/24 required');
  const options = settings as unknown as PairedSurfaceMaterialBodyOptions;
  const a = data.a as PairedSurfaceUVSplitFacesResult, b = data.b as PairedSurfaceBUVSplitFacesResult;
  const request: PairedSurfaceMaterialBodyRequest = { a, b, options };
  const requestSize = json(state, request, REQUEST_LIMIT).size;
  const closureData: Closure[] = [], vertices: Vertex[] = [], edges: Edge[] = [], faces: Face[] = [];
  const observations: Observation[] = [];
  let partial: unknown = null, proof: Proof | null = null, graph: Graph | null = null;
  let reservedIds: string[] = [];
  const prefix = (): void => {
    const previous = { ...state }; state.phase = 'file';
    state.assetIndex = null; state.closureIndex = null; state.edgeIndex = null; state.observationIndex = null;
    const retained = { request, closures: closureData, vertices, edges, faces, graph, proof, observations, partial, reservedIds };
    snapshot(state, retained); json(state, retained, RESULT_LIMIT); Object.assign(state, previous);
  };
  prefix();
  const delegate = <T>(counter: keyof DirectCounts, code: Code, detail: string, action: () => T): T => {
    prefix(); state.directCounts[counter]++; state.directCounts.constructorDelegationCount++;
    const value = delegated(state, code, detail, action); return value;
  };
  state.phase = 'parent'; state.assetIndex = 0;
  delegate('parentValidationCount', CODE.PARENT, 'Full original-A Face validation refused', () => validatePairedSurfaceUVSplitFaces(a));
  prefix(); state.assetIndex = 1;
  delegate('parentValidationCount', CODE.PARENT, 'Full original-B Face validation refused', () => validatePairedSurfaceBUVSplitFaces(b));
  prefix(); state.phase = 'profile'; state.assetIndex = null;
  check(state, same(a.request.section, b.request.section), CODE.BINDING, 'Both full Face parents must retain the same complete1499 section');
  check(state, a.faces[0].orientation === 'forward' && b.faces[0].orientation === 'reverse' &&
    a.faces[0].region === 'below-cut' && b.faces[0].region === 'below-cut',
  CODE.ORIENTATION, 'Actual original-A lower FORWARD and original-B lower REVERSE Faces required');
  const section = a.request.section;
  const q = new SectionRationalContext((kind, detail) => fail(state, CODE[kind], detail));
  const zero = q.integer(0), one = q.integer(1);
  const read = (value: F): SectionRational => q.rat(BigInt(value.numerator), BigInt(value.denominator));
  const equal = (left: SectionRational, right: SectionRational): boolean => q.compare(left, right) === 0;
  const offset = read(section.proof.originalUB.offset), scale = read(section.proof.originalUB.scale);
  const pa = section.proof.profiles[0], pb = section.proof.profiles[1];
  const polynomial = (values: F[], expected: SectionRational[]): boolean =>
    values.every((value, i) => equal(read(value), expected[i] ?? zero)) &&
    expected.every((value, i) => equal(value, values[i] === undefined ? zero : read(values[i])));
  check(state, equal(scale, one) && polynomial(pa.xU, [zero, one]) &&
    polynomial(pa.yU, [zero]) && polynomial(pa.yV, [zero, one]) &&
    polynomial(pb.xU, [q.neg(offset), one]) &&
    pb.zUV.every((row, i) => row.every((value, j) => equal(read(value), i === 0 && j === 1 ? one : zero))),
  CODE.PROFILE, 'Exact A.X=UA/A.Y=VA and B.X=UB-offset/B.Z=VB unit positive axes with UBscale1 required');
  check(state, section.request.assets.every(asset => asset.surface.degreeU <= 2 && asset.surface.degreeV === 1 &&
    asset.surface.weights.every(row => row.every(value => Object.is(value, asset.surface.weights[0][0]))) &&
    asset.surface.weights[0][0] > 0), CODE.PROFILE, 'Actual whole positive uniform original weights and degree<=2 by1 required');
  reservedIds = reserveRoles(state, request); const p = options.resultIdPrefix;
  const lowY = section.report.selections[0].nativeDomains.v[0], lowZ = section.report.selections[1].nativeDomains.v[0];
  const sourceCurves = [a.edges[0].curve, b.edges[0].curve, a.edges[4].curve, a.edges[1].curve];
  const lowCurves = sourceCurves.map((curve, i): Curve => ({ kind: 'curve', id: p + '_c' + i + '_low',
    degree: curve.degree, knots: curve.knots.slice(), weights: curve.weights.slice(),
    controlPoints: curve.controlPoints.map(point => [point[0], i < 2 ? lowY : point[1], lowZ] as Point) }));
  partial = { lowCurves }; prefix();
  const closureRoles: ClosureRole[] = ['yMin', 'zMin', 'xMin', 'xMax'];
  for (let i = 0; i < 4; i++) {
    state.phase = 'closure'; state.closureIndex = i;
    delegate('newCurveValidationCount', CODE.NATIVE, 'Actual new source-bound low Curve admission refused', () => validateCurve(lowCurves[i]));
    prefix();
    const first = i === 0 || i === 3 ? lowCurves[i] : sourceCurves[i];
    const second = i === 0 || i === 3 ? sourceCurves[i] : lowCurves[i];
    const ruled = delegate('ruledSurfaceBuildCount', CODE.CLOSURE, 'Actual compatible Ruled closure construction refused',
      () => buildCompatibleRuledSurface(first, second, { surfaceId: p + '_c' + i + '_s' }));
    partial = { lowCurves, index: i, ruled }; prefix();
    const ids = (kind: string): [string, string, string, string] => [0, 1, 2, 3].map(j => p + '_c' + i + '_' + kind + j) as [string, string, string, string];
    const faceIds: FaceIds = { faceId: p + '_c' + i + '_f', loopId: p + '_c' + i + '_l',
      vertexIds: ids('v'), edgeIds: ids('e'), curveIds: ids('b') };
    const face = delegate('parametricFaceBuildCount', CODE.CLOSURE, 'Actual natural closure Face construction refused',
      () => buildParametricFace(ruled.surface, faceIds));
    partial = { lowCurves, index: i, ruled, face }; prefix(); state.phase = 'adoption';
    const adopted = delegate('faceModelAdoptionCount', CODE.SOURCE, 'Actual complete closure FaceModel5 source adoption refused',
      () => adoptSourceModel(face.geometry));
    check(state, same(adopted.model, face.geometry) && adopted.model.objects.length === 5,
      CODE.BINDING, 'Actual adopted closure source must preserve the full FaceModel5');
    check(state, adopted.source.length <= 262144 && new TextEncoder().encode(adopted.source).length <= 262144,
      CODE.BUDGET, 'Actual complete closure Source exceeds inherited262144 envelope');
    closureData.push({ role: closureRoles[i], lowCurve: lowCurves[i], ruled, faceIds, face,
      world: { sourceId: p + '_c' + i + '_source', source: adopted.source, sourceVersion: 0, model: adopted.model } });
    partial = { lowCurves }; prefix();
  }
  partial = null; state.closureIndex = null; state.phase = 'topology';
  const closures: Closures = [closureData[0], closureData[1], closureData[2], closureData[3]];
  const faceRoles: FaceRole[] = ['roof', 'side', 'yMin', 'zMin', 'xMin', 'xMax'];
  const edgeRoles: EdgeRole[] = ['cut', 'roofYMin', 'roofXMin', 'roofXMax', 'sideZMin', 'sideXMin', 'sideXMax',
    'lowYLowZ', 'lowYXMin', 'lowYXMax', 'lowZXMin', 'lowZXMax'];
  // Each row binds the actual local natural edge index to a fixed material edge role.
  const naturalRoles: number[][] = [[7, 9, 1, 8], [4, 11, 7, 10], [2, 5, 10, 8], [11, 6, 3, 9]];
  const parentRoles = new Map<number, number>([[6, 0], [0, 1], [4, 2], [1, 3]]);
  const parentBRoles = new Map<number, number>([[6, 0], [0, 4], [4, 5], [1, 6]]);
  const cornerRows: number[][] = [[2, 3, 7, 6], [4, 5, 7, 6], [0, 1, 3, 2], [4, 5, 1, 0], [2, 6, 4, 0], [1, 5, 7, 3]];
  const faceRefs: LocalFaceRef[] = [];
  const localVertexMaps: Map<string, number>[] = [];
  const localUses: { roleIndex: number; origin: LocalUseRef; nativeVertexIndices: [number, number];
    directedVertexIndices: [number, number] }[][] = [];
  const sourceRef = (faceIndex: number, objectIndex: number, objectId: string): SourceRef => {
    if (faceIndex < 2) {
      const parent = faceIndex === 0 ? a : b, name = faceIndex === 0 ? 'a' : 'b';
      return { sourceId: section.request.assets[faceIndex].sourceId,
        sourceField: 'request.' + name + '.world.source', modelField: 'request.' + name + '.world.model',
        modelName: parent.world.model.name, objectIndex, objectId };
    }
    const index = faceIndex - 2, world = closures[index].world;
    return { sourceId: world.sourceId, sourceField: 'closures[' + index + '].world.source',
      modelField: 'closures[' + index + '].world.model', modelName: world.model.name, objectIndex, objectId };
  };
  for (let fi = 0; fi < 6; fi++) {
    const parent = fi < 2 ? fi === 0 ? a : b : null;
    const closure = fi < 2 ? null : closures[fi - 2];
    const model = parent ? parent.world.model : closure!.world.model;
    const support = model.objects[0];
    check(state, support.kind === 'surface', CODE.BINDING, 'Actual Face source object0 must be its complete Surface');
    const localFaceId = parent ? parent.faces[0].id : closure!.face.topology.face.id;
    const localLoopId = parent ? parent.faces[0].outerLoopId : closure!.face.topology.loop.id;
    const ref: LocalFaceRef = { kind: fi === 0 ? 'a' : fi === 1 ? 'b' : 'closure',
      closureIndex: fi < 2 ? null : fi - 2, faceId: localFaceId, loopId: localLoopId,
      supportRef: sourceRef(fi, 0, support.id), sourceField: sourceRef(fi, 0, support.id).sourceField,
      modelField: sourceRef(fi, 0, support.id).modelField };
    faceRefs.push(ref);
    const selectedVertices = parent ? [parent.vertices[0], parent.vertices[1], parent.vertices[5], parent.vertices[4]].map(value =>
      ({ id: value.id, point: value.world })) : closure!.face.topology.vertices;
    const vertexMap = new Map<string, number>(); localVertexMaps.push(vertexMap);
    for (let j = 0; j < 4; j++) {
      const value = selectedVertices[j], globalIndex = cornerRows[fi][j];
      vertexMap.set(value.id, globalIndex);
      if (!vertices[globalIndex]) vertices[globalIndex] = { id: p + '_v' + globalIndex, world: pointCopy(value.point), members: [] };
      vertices[globalIndex].members.push({ face: ref, vertexId: value.id, world: pointCopy(value.point) });
    }
    const occurrences: typeof localUses[number] = [];
    if (parent) {
      const loop = parent.loops.find(value => value.id === localLoopId);
      check(state, loop !== undefined, CODE.TOPOLOGY, 'Selected actual trimmed Face loop must resolve');
      for (const use of loop.uses) {
        const localEdgeIndex = parent.edges.findIndex(edge => edge.id === use.edgeId);
        check(state, localEdgeIndex >= 0, CODE.TOPOLOGY, 'Actual parent Use must resolve its local edge');
        const localEdge = parent.edges[localEdgeIndex], roleIndex = (fi === 0 ? parentRoles : parentBRoles).get(localEdgeIndex);
        check(state, roleIndex !== undefined, CODE.TOPOLOGY, 'Selected lower Face must use the intended four source boundaries');
        const directed = use.vertexIds.map(id => vertexMap.get(id));
        const native = localEdge.vertexIds.map(id => vertexMap.get(id));
        check(state, directed.every(value => value !== undefined) && native.every(value => value !== undefined),
          CODE.TOPOLOGY, 'All selected parent Use/Curve endpoints must resolve to explicit material corners');
        occurrences.push({ roleIndex, nativeVertexIndices: native as [number, number],
          directedVertexIndices: directed as [number, number], origin: { face: ref,
            edgeId: localEdge.id, useId: use.id, curveId: localEdge.curve.id,
            localVertexIds: [use.vertexIds[0], use.vertexIds[1]], localCurve: localEdge.curve,
            pcurve: { kind: 'native-curve', curve: localEdge.pcurve.curve }, sense: use.sense,
            interval: [use.interval[0], use.interval[1]],
            curveRef: sourceRef(fi, localEdge.sourceRef.objectIndex, localEdge.curve.id) } });
      }
    } else {
      for (let j = 0; j < 4; j++) {
        const topology = closure!.face.topology, localEdge = topology.edges[j], use = topology.loop.uses[j];
        const curve = model.objects[j + 1];
        check(state, curve.kind === 'curve' && curve.id === localEdge.curveId && use.edgeId === localEdge.id,
          CODE.BINDING, 'Actual natural FaceModel5 Curve/edge/Use source members must resolve');
        const native = localEdge.vertexIds.map(id => vertexMap.get(id));
        check(state, native.every(value => value !== undefined), CODE.TOPOLOGY, 'Natural local corners must resolve');
        occurrences.push({ roleIndex: naturalRoles[fi - 2][j], nativeVertexIndices: native as [number, number],
          directedVertexIndices: native as [number, number], origin: { face: ref,
            edgeId: localEdge.id, useId: null, curveId: curve.id,
            localVertexIds: [localEdge.vertexIds[0], localEdge.vertexIds[1]], localCurve: curve,
            pcurve: { kind: 'native-line', domain: [...use.pcurve.domain] as [number, number],
              uv0: [...use.pcurve.uv0] as [number, number], uv1: [...use.pcurve.uv1] as [number, number] },
            sense: 'forward', interval: nativeDomain(curve), curveRef: sourceRef(fi, j + 1, curve.id) } });
      }
    }
    check(state, occurrences.length === 4, CODE.TOPOLOGY, 'Each actual selected Face must retain four stored Uses');
    localUses.push(occurrences);
  }
  check(state, vertices.length === 8 && vertices.every(value => value !== undefined && value.members.length === 3),
    CODE.TOPOLOGY, 'Eight actual three-member material vertex classes required');
  const choose = [[1], [1, 1], [1, 2, 1], [1, 3, 3, 1], [1, 4, 6, 4, 1]];
  const elevate = (curve: Curve, reverse: boolean): SectionRational[][] => {
    const degree = curve.degree;
    check(state, degree >= 1 && degree <= 4 && curve.controlPoints.length === degree + 1 &&
      curve.weights.every(value => Object.is(value, curve.weights[0])) && curve.weights[0] > 0,
    CODE.BINDING, 'Actual single Bezier constant-weight Curve required for whole parameter correspondence');
    const points = reverse ? curve.controlPoints.slice().reverse() : curve.controlPoints;
    return Array.from({ length: 5 }, (_, i) => [0, 1, 2].map(axis => q.sum(points.map((point, j) => {
      const extra = i - j;
      return extra < 0 || extra > 4 - degree ? zero : q.mul(q.from(point[axis]),
        q.div(q.integer(choose[degree][j] * choose[4 - degree][extra]), q.integer(choose[4][i])));
    }))));
  };
  const pending = edgeRoles.map((role, roleIndex) => {
    const occurrence = localUses.flat().find(value => value.roleIndex === roleIndex);
    check(state, occurrence !== undefined, CODE.TOPOLOGY, 'Every canonical material edge must have actual source incidence');
    return { id: p + '_e' + roleIndex, role, curve: occurrence.origin.localCurve,
      curveRef: occurrence.origin.curveRef, vertexIds: occurrence.nativeVertexIndices.map(index => vertices[index].id) as [string, string],
      parameterRange: nativeDomain(occurrence.origin.localCurve), nativeVertexIndices: occurrence.nativeVertexIndices,
      uses: [] as GlobalUse[] };
  });
  for (let fi = 0; fi < 6; fi++) {
    const uses: GlobalUse[] = [];
    for (const [j, occurrence] of localUses[fi].entries()) {
      const edge = pending[occurrence.roleIndex], canonicalDomain = edge.parameterRange;
      const aligned = occurrence.nativeVertexIndices[0] === edge.nativeVertexIndices[0] &&
        occurrence.nativeVertexIndices[1] === edge.nativeVertexIndices[1];
      const reversed = occurrence.nativeVertexIndices[0] === edge.nativeVertexIndices[1] &&
        occurrence.nativeVertexIndices[1] === edge.nativeVertexIndices[0];
      check(state, aligned || reversed, CODE.TOPOLOGY, 'Actual local/canonical endpoints must form the intended same edge class');
      const localDomain = nativeDomain(occurrence.origin.localCurve);
      const localEndpointParameters: [number, number] = aligned ? [...localDomain] : [localDomain[1], localDomain[0]];
      const mapScale = q.div(q.sub(q.from(localEndpointParameters[1]), q.from(localEndpointParameters[0])),
        q.sub(q.from(canonicalDomain[1]), q.from(canonicalDomain[0])));
      const mapOffset = q.sub(q.from(localEndpointParameters[0]), q.mul(mapScale, q.from(canonicalDomain[0])));
      const endpointResiduals = canonicalDomain.map((value, i) => q.text(q.sub(
        q.add(mapOffset, q.mul(mapScale, q.from(value))), q.from(localEndpointParameters[i])))) as [F, F];
      const localCoefficients = elevate(occurrence.origin.localCurve, reversed), canonicalCoefficients = elevate(edge.curve, false);
      const residuals = localCoefficients.map((row, i) => row.map((value, axis) => q.sub(value, canonicalCoefficients[i][axis])));
      check(state, residuals.every(row => row.every(value => value.n === 0n)), CODE.BINDING,
        'Whole actual local/canonical Curve images differ under their exact native affine map');
      const map: ParameterMap = { canonicalDomain: [...canonicalDomain], localDomain: [...localDomain],
        offset: q.text(mapOffset), scale: q.text(mapScale), localEndpointParameters,
        endpointResiduals, wholeCurveResiduals: residuals.map(row => row.map(value => q.text(value))), proofDegree: 4 };
      const vertexIds = occurrence.directedVertexIndices.map(index => vertices[index].id) as [string, string];
      const forward = vertexIds[0] === edge.vertexIds[0] && vertexIds[1] === edge.vertexIds[1];
      check(state, forward || vertexIds[0] === edge.vertexIds[1] && vertexIds[1] === edge.vertexIds[0],
        CODE.TOPOLOGY, 'Actual directed Use must follow its canonical endpoint class once');
      const use: GlobalUse = { id: p + '_use' + (4 * fi + j), faceId: p + '_f' + fi,
        loopId: p + '_l' + fi, edgeId: edge.id, vertexIds, sense: forward ? 'forward' : 'reverse',
        origin: occurrence.origin, parameterMap: map };
      uses.push(use); edge.uses.push(use);
    }
    const model = fi < 2 ? fi === 0 ? a.world.model : b.world.model : closures[fi - 2].world.model;
    const support = model.objects[0];
    check(state, support.kind === 'surface', CODE.BINDING, 'Actual source support must remain a Surface');
    faces.push({ id: p + '_f' + fi, role: faceRoles[fi], support, supportRef: faceRefs[fi].supportRef,
      origin: faceRefs[fi], orientation: fi === 1 ? 'reverse' : 'forward', outerLoopId: p + '_l' + fi,
      loop: { id: p + '_l' + fi, faceId: p + '_f' + fi, uses: uses as Loop['uses'] } });
  }
  for (const edge of pending) {
    check(state, edge.uses.length === 2 && edge.uses[0].sense !== edge.uses[1].sense,
      CODE.TOPOLOGY, 'Every material edge needs exactly two opposite actual effective Uses');
    edges.push({ id: edge.id, role: edge.role, curve: edge.curve, curveRef: edge.curveRef,
      vertexIds: edge.vertexIds, parameterRange: edge.parameterRange, uses: [edge.uses[0], edge.uses[1]] });
  }
  const shell: Shell = { id: p + '_shell', faceIds: faces.map(face => face.id) as Shell['faceIds'], closed: true, oriented: true };
  const body: Body = { id: p + '_body', shellIds: [shell.id], materialCertificateId: p + '_material',
    closed: true, solid: true, restrictedSolidCertified: true };
  graph = { vertices, edges, faces, shell, body }; prefix(); state.phase = 'material';
  try { proof = provePairedSurfaceMaterialBodyTrusted(request, closures, graph, q); }
  catch (cause) {
    if (cause instanceof PairedSurfaceMaterialBodyError) throw cause;
    if (cause instanceof PairedSurfaceMaterialBodyProofError) {
      state.edgeIndex = cause.edgeIndex; fail(state, cause.code, 'Whole exact paired material proof refused', cause);
    }
    fail(state, CODE.MATERIAL, 'Whole exact paired material proof refused', cause);
  }
  check(state, proof.material.restrictedSolidCertified && proof.material.wholeBoundaryImage &&
    proof.material.embeddedClosedBoundary && proof.material.outwardMaterial &&
    proof.material.sourceDefinedOccupiedRegion && proof.vertexLinks.length === 8 &&
    proof.correspondence.length === 12 && proof.eulerCharacteristic === 2 && q.counts().floatConversions === 0,
  CODE.MATERIAL, 'Complete actual closed topology and occupied material proof required before acceptance');
  prefix();
  const evaluate = (curve: Curve, parameter: number): Point => {
    state.directCounts.curveD0AttemptCount++;
    const point = delegated(state, CODE.NATIVE, 'Actual material endpoint CurveD0 refused', () => evaluateCurve(curve, parameter));
    check(state, point.every(Number.isFinite), CODE.NATIVE, 'Finite actual native endpoint point required');
    return point;
  };
  for (const [edgeIndex, edge] of edges.entries()) {
    state.phase = 'observation'; state.edgeIndex = edgeIndex;
    for (const endpointIndex of [0, 1] as const) {
      const index = 2 * edgeIndex + endpointIndex; state.observationIndex = index;
      prefix(); state.directCounts.observationCount++;
      const parameter = edge.parameterRange[endpointIndex], vertexId = edge.vertexIds[endpointIndex];
      const vertex = vertices.find(value => value.id === vertexId);
      check(state, vertex !== undefined, CODE.TOPOLOGY, 'Actual canonical endpoint vertex must resolve');
      const canonicalPoint = evaluate(edge.curve, parameter), vertexWorld = pointCopy(vertex.world);
      const canonicalVertexGapMM = distance(state, canonicalPoint, vertexWorld);
      const local = edge.uses.map(use => {
        const map = use.parameterMap, localParameter = map.localEndpointParameters[endpointIndex];
        check(state, equal(q.from(localParameter), q.add(read(map.offset), q.mul(read(map.scale), q.from(parameter)))),
          CODE.BINDING, 'Copied actual local native endpoint must equal the exact affine parameter map');
        const point = evaluate(use.origin.localCurve, localParameter);
        return { useId: use.id, parameter: localParameter, point,
          canonicalGapMM: distance(state, point, canonicalPoint), vertexGapMM: distance(state, point, vertexWorld) };
      }) as Observation['local'];
      check(state, canonicalVertexGapMM <= 1e-7 && local.every(value => value.canonicalGapMM <= 1e-7 && value.vertexGapMM <= 1e-7),
        CODE.BINDING, 'Actual native endpoint diagnostics exceed1e-7 mm');
      observations.push({ index, edgeId: edge.id, endpointIndex, parameter, vertexId,
        canonicalPoint, vertexWorld, canonicalVertexGapMM, local });
      prefix();
    }
  }
  state.phase = 'file'; state.edgeIndex = null; state.observationIndex = null;
  const counts = state.directCounts;
  check(state, counts.parentValidationCount === 2 && counts.newCurveValidationCount === 4 &&
    counts.ruledSurfaceBuildCount === 4 && counts.parametricFaceBuildCount === 4 &&
    counts.faceModelAdoptionCount === 4 && counts.constructorDelegationCount === 18 &&
    counts.observationCount === 24 && counts.curveD0AttemptCount === 72 && counts.curveD1AttemptCount === 0 &&
    counts.surfaceD0AttemptCount === 0 && counts.surfaceD1AttemptCount === 0 &&
    counts.sourceCompilationCount === 0 && counts.rationalFloatConversionCount === 0 && q.counts().floatConversions === 0,
  CODE.BINDING, 'Actual successful constructor/native schedule or zero root conversion authority disagrees');
  const actualProof = proof;
  const report: PairedSurfaceMaterialBodyReport = {
    schema: 'barocss-paired-surface-material-body', version: 0, evaluationId: options.evaluationId,
    parentEvaluationIds: [a.report.evaluationId, b.report.evaluationId], pairedEvaluationId: section.report.evaluationId,
    bodyId: body.id, shellId: shell.id, materialCertificateId: body.materialCertificateId,
    faceIds: faces.map(face => face.id), vertexCount: 8, edgeCount: 12, faceCount: 6, loopCount: 6,
    useCount: 24, edgePairCount: 12, vertexLinkCount: 8, cornerArcCount: 24, freeBoundaryCount: 0,
    eulerCharacteristic: 2, connectedFaceGraph: true, originalTrimmedModelCount: 2,
    closureRuledModelCount: 4, closureFaceModelCount: 4, flattenedMasterModelProduced: false,
    directionConvention: 'selected-parent-stored-use-order-already-includes-face-orientation',
    sourceFrame: 'authored-xyz-no-axis-conversion', uvLengthUnit: 'dimensionless', lengthUnit: 'mm', volumeUnit: 'mm3',
    exactVolumeMM3: actualProof.material.volume.exactVolumeMM3,
    minimumHeightY: actualProof.material.cubeMap.minimumHeightY,
    minimumHeightZ: actualProof.material.cubeMap.minimumHeightZ,
    minimumJacobian: actualProof.material.cubeMap.minimumJacobian,
    maximumObservedEndpointGapMM: Math.max(...observations.flatMap(value => [value.canonicalVertexGapMM,
      ...value.local.flatMap(local => [local.canonicalGapMM, local.vertexGapMM])])), reservedIds,
    directCounts: { ...counts } as DirectCounts,
    inheritedCounts: { a: a.report.directCounts, b: b.report.directCounts,
      ruled: [closures[0].ruled.report, closures[1].ruled.report, closures[2].ruled.report, closures[3].ruled.report] },
    rationalCounts: q.counts(),
    quality: { sharedBodyTopology: true, manifold: true, restrictedSolid: true, sourceDefinedOccupiedRegion: true,
      exactOccupiedVolume: true, outwardMaterial: true, wholeBodyEmbedding: true,
      fullParentsAndClosuresRetained: true, parentFlagsUnchanged: true, genericBoolean: false,
      generalCurvedSolidProperties: false, globalC1: false, globalBinary64EvaluationErrorCertified: false,
      manufacturingToleranceCertified: false, weldingPerformed: false, publication: false,
      ownership: 'independent-copied-cpu-data-gc' },
    fileSizes: { request: requestSize, result: { utf16: 0, utf8: 0 } }, ownValues: 0, limits: limits(),
    workScope: 'two-full-parent-validations-four-real-closure-factories-and-exact-material-proof-with-inherited-work-separated',
    budgetFailure: 'atomic-no-partial-material-body',
  };
  const result: PairedSurfaceMaterialBodyResult = { request, closures, vertices, edges, faces, shell, body,
    proof: actualProof, observations, report };
  let settled = false;
  for (let pass = 0; pass < 8; pass++) {
    const count = ownValues(state, result), measured = json(state, result, RESULT_LIMIT).size;
    if (report.ownValues === count && same(report.fileSizes.result, measured)) { settled = true; break; }
    report.ownValues = count; report.fileSizes.result = measured;
  }
  check(state, settled && report.ownValues === ownValues(state, result) &&
    same(report.fileSizes.result, json(state, result, RESULT_LIMIT).size), CODE.FILE,
  'Whole material Body own/file measurements did not settle in8 passes');
  return snapshot(state, result) as PairedSurfaceMaterialBodyResult;
}

/** Reconstruct once from the complete original Faces and actual closure options. */
export function validatePairedSurfaceMaterialBody(input: PairedSurfaceMaterialBodyResult): PairedSurfaceMaterialBodyReport {
  const state = context(); state.phase = 'owned';
  try {
    const result = record(state, snapshot(state, input, true), ['request', 'closures', 'vertices', 'edges', 'faces',
      'shell', 'body', 'proof', 'observations', 'report'], CODE.OWNED) as unknown as PairedSurfaceMaterialBodyResult;
    json(state, result, RESULT_LIMIT);
    const expected = buildPairedSurfaceMaterialBody(result.request.a, result.request.b, result.request.options);
    state.directCounts = { ...expected.report.directCounts };
    check(state, same(result, expected), CODE.OWNED, 'Whole source/closures/native maps/topology/material/observations/work/file fields changed');
    return snapshot(state, expected.report, true) as PairedSurfaceMaterialBodyReport;
  } catch (cause) {
    if (cause instanceof PairedSurfaceMaterialBodyError && cause.code === CODE.OWNED) throw cause;
    const failed = cause instanceof PairedSurfaceMaterialBodyError ? cause.context : state;
    throw new PairedSurfaceMaterialBodyError(CODE.OWNED, 'Whole paired material Body reconstruction refused',
      { ...failed, phase: 'owned' }, cause);
  }
}
