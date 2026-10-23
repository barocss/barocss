import {validatePairedSurfaceMaterialBody} from './paired-surface-material-body.js';
import {buildCompatibleRuledSurface} from '../nurbs/surfaces/compatible-ruled-surface.js';
import {buildParametricFace} from '../face.js';
import {adopt as adoptSourceModel} from '../intersect/own-plane-cylinder-intersection-internal.js';
import {validateCurve,evaluateCurve} from '../math.js';
import {SectionRationalContext} from '../section-rational-internal.js';
import {constructPairedRoofDifferenceGeometryTrusted,PairedRoofDifferenceConstructionError} from './paired-roof-difference-body-construction-internal.js';
import {provePairedRoofDifferenceBodyTrusted,PairedRoofDifferenceProofError} from './paired-roof-difference-body-proof-internal.js';
import type {Point,Curve,Surface,Model} from '../types.js';
import type {FaceIds,FaceBundle} from '../face.js';
import type {CompatibleRuledSurfaceResult} from '../nurbs/surfaces/compatible-ruled-surface.js';
import type {PairedSurfaceMaterialBodyResult} from './paired-surface-material-body.js';
import type {SectionFraction,SectionRational} from '../section-rational-internal.js';
import { same } from '../structural-equality.js';

type F=SectionFraction; type Sense='forward'|'reverse'; type Size={utf16:number;utf8:number};
type Operand=PairedSurfaceMaterialBodyResult;
export interface PairedRoofDifferenceBodyOptions {
 evaluationId:string; resultIdPrefix:string; maximumClosures:3; maximumFaces:6;
 maximumEdgePairs:12; maximumObservations:24;
}
export interface PairedRoofDifferenceBodyRequest {lower:Operand;upper:Operand;options:PairedRoofDifferenceBodyOptions}
type Code='INPUT'|'IDENTITY'|'PARENT'|'PROFILE'|'SOURCE'|'NATIVE'|'CLOSURE'|'TOPOLOGY'|'MATERIAL'|'ORIENTATION'|'DOMAIN'|'REPRESENTABILITY'|'BINDING'|'BUDGET'|'FILE'|'OWNED';
type Context={phase:'input'|'parent'|'profile'|'band'|'closure'|'adoption'|'topology'|'material'|'observation'|'file'|'owned';assetIndex:0|1|null;closureIndex:number|null;edgeIndex:number|null;observationIndex:number|null;directCounts:DirectCounts};
type ClosureRole='yMin'|'xMin'|'xMax'; type FaceRole='roof'|'floor'|'band'|ClosureRole;
type EdgeRole='lowerCut'|'upperCut'|'lowerYMin'|'upperYMin'|'lowerXMin'|'upperXMin'|'lowerXMax'|'upperXMax'|'yMinXMin'|'yMinXMax'|'bandXMin'|'bandXMax';
type SourceRef={sourceId:string;sourceField:string;modelField:string;modelName:string;objectIndex:number;objectId:string};
type SourceModel={sourceId:string;source:string;sourceVersion:0;model:Model};
type BandVertex={id:string;role:'lowerLeft'|'lowerRight'|'upperRight'|'upperLeft';world:Point;uv:Point};
type BandEdge={id:string;role:'lowerCut'|'right'|'upperCut'|'left';curve:Curve;vertexIds:[string,string];pcurve:{coordinateSystem:'original-native-uv';lengthUnit:'dimensionless';curve:Curve};curveRef:SourceRef;origin:{kind:'borrowed-paired-cut'|'fixed-original-ub-line';operand:'lower'|'upper'|null;sourceField:string|null}};
type BandUse={id:string;edgeId:string;vertexIds:[string,string];sense:Sense;interval:[number,number];pcurveId:string};
type BandLoop={id:string;uses:[BandUse,BandUse,BandUse,BandUse]};
type BandFace={id:string;sourceId:string;surfaceId:string;outerLoopId:string;orientation:'reverse';region:'between-two-cuts'};
type Band={world:SourceModel;support:Surface;supportRef:SourceRef;vertices:[BandVertex,BandVertex,BandVertex,BandVertex];edges:[BandEdge,BandEdge,BandEdge,BandEdge];loop:BandLoop;face:BandFace};
type Closure={role:ClosureRole;ruled:CompatibleRuledSurfaceResult;faceIds:FaceIds;face:FaceBundle;world:SourceModel};
type Closures=[Closure,Closure,Closure]; type Geometry={band:Band;closures:Closures};
export interface PairedRoofDifferenceBodyResult {
 request:PairedRoofDifferenceBodyRequest;geometry:Geometry;vertices:Vertex[];edges:Edge[];faces:Face[];
 shell:Shell;body:Body;proof:Proof;observations:Observation[];report:PairedRoofDifferenceBodyReport;
}
type LocalFaceRef={kind:'lower'|'upper'|'band'|'closure';closureIndex:number|null;faceId:string;loopId:string;supportRef:SourceRef;sourceField:string;modelField:string};
type LocalVertexRef={face:LocalFaceRef;vertexId:string;world:Point};
type LocalUseRef={face:LocalFaceRef;edgeId:string;useId:string|null;curveId:string;localVertexIds:[string,string];localCurve:Curve;pcurve:{kind:'native-curve';curve:Curve}|{kind:'native-line';domain:[number,number];uv0:[number,number];uv1:[number,number]};sense:Sense;interval:[number,number];curveRef:SourceRef};
type ParameterMap={canonicalDomain:[number,number];localDomain:[number,number];offset:F;scale:F;localEndpointParameters:[number,number];endpointResiduals:[F,F];wholeCurveResiduals:F[][];proofDegree:4};
type GlobalUse={id:string;faceId:string;loopId:string;edgeId:string;vertexIds:[string,string];sense:Sense;origin:LocalUseRef;parameterMap:ParameterMap;importReversal:boolean};
type Vertex={id:string;world:Point;members:LocalVertexRef[]};
type Edge={id:string;role:EdgeRole;curve:Curve;curveRef:SourceRef;vertexIds:[string,string];parameterRange:[number,number];uses:[GlobalUse,GlobalUse]};
type Loop={id:string;faceId:string;uses:[GlobalUse,GlobalUse,GlobalUse,GlobalUse]};
type Face={id:string;role:FaceRole;support:Surface;supportRef:SourceRef;origin:LocalFaceRef;orientation:Sense;outerLoopId:string;loop:Loop;importReversal:boolean};
type Shell={id:string;faceIds:[string,string,string,string,string,string];closed:true;oriented:true};
type Body={id:string;shellIds:[string];materialCertificateId:string;closed:true;solid:true;restrictedSolidCertified:true};
type Graph={vertices:Vertex[];edges:Edge[];faces:Face[];shell:Shell;body:Body};
type FaceImage={faceId:string;role:FaceRole;supportRef:SourceRef;originalSupport:Surface;nativeDomains:{u:[number,number];v:[number,number]};cubeRestriction:'t=1'|'t=0'|'s=1'|'s=0'|'u=uMin'|'u=uMax';chartVariables:['u','s']|['u','t']|['s','t'];nativeUVPower:F[][][];actualCartesian:F[][][];expectedCartesian:F[][][];residuals:F[][][];proofDegrees:{first:4;second:1};wholeImageEqual:true;outward:{axis:'x'|'y'|'z';sign:-1|1;principalCoefficients:F[];minimumAbsolute:F};storedLocalUsesUnchanged:true;importReversal:boolean};
type EdgePair={edgeId:string;role:EdgeRole;canonicalCurveRef:SourceRef;occurrences:[{useId:string;origin:LocalUseRef;parameterMap:ParameterMap;importReversal:boolean},{useId:string;origin:LocalUseRef;parameterMap:ParameterMap;importReversal:boolean}];oppositeEffectiveUses:true;exactWholeWorldImage:true};
type Germ={edgeId:string;endpointIndex:0|1};
type VertexLink={vertexId:string;germs:[Germ,Germ,Germ];cornerArcs:{faceId:string;incomingUseId:string;outgoingUseId:string;from:Germ;to:Germ}[];cycle:Germ[];connected:true;degreeTwo:true};
type MaterialProof={certificateId:string;bodyId:string;shellId:string;faceIds:string[];sourceRefs:SourceRef[];
 profile:{lowerAXIdentity:true;lowerAYIdentity:true;upperAXIdentity:true;upperAYIdentity:true;bXShiftIdentity:true;bZIdentity:true;originalUBOffset:F;originalUBScale:F;unitPositiveAxes:true;constantPositiveWeights:true;commonOriginalB:true;commonFootprint:true;bYPower:F[];lowerAZPower:F[][];upperAZPower:F[][];sourceResiduals:F[][][]};
 cubeMap:{domain:{u:[number,number];s:[0,1];t:[0,1]};lowY:F;floorPower:F[][];gapPower:F[][];heightYBernstein:F[];gapBernstein:F[][];heightProofUDegree:4;heightProofSDegree:1;minimumHeightY:F;minimumGap:F;jacobianBernstein:F[][];jacobianDegrees:{u:8;s:1};minimumJacobian:F;inverse:'u=X;s=(Y-lowY)/heightY(u);t=(Z-floor(u,s))/gap(u,s)';globallyInjective:true};
 faceImages:[FaceImage,FaceImage,FaceImage,FaceImage,FaceImage,FaceImage];
 volume:{exactVolumeMM3:F;integrandBernstein:F[];degree:8;integrationResidual:F;unit:'mm3'};
 conservation:{lowerVolumeMM3:F;upperVolumeMM3:F;differenceVolumeMM3:F;residual:F;exact:true};
 operation:'regularized-upper-minus-lower';sourceDefinedOccupiedRegion:true;wholeBoundaryImage:true;outwardMaterial:true;embeddedClosedBoundary:true;restrictedSolidCertified:true;parentFlagsUnchanged:true};
type BandEdgeProof={edgeId:string;curveRef:SourceRef;nativeDomain:[number,number];worldCartesian:F[][];uvCartesian:F[][];composedSurfaceCartesian:F[][];residuals:F[][];proofDegree:4;wholeImageEqual:true};
type BandProof={supportRef:SourceRef;originalUAInterval:[number,number];originalUBMap:{offset:F;scale:F};lowerWorldCurveRef:SourceRef;upperWorldCurveRef:SourceRef;lowerPcurve:Curve;upperPcurve:Curve;edges:[BandEdgeProof,BandEdgeProof,BandEdgeProof,BandEdgeProof];gapBernstein:F[];minimumGap:F;xzDeterminant:F;closedDiskCertified:true;originalBUnchanged:true;borrowedCutsUnchanged:true};
type Proof={schema:'barocss-paired-roof-difference-body-proof';version:0;band:BandProof;correspondence:EdgePair[];vertexClasses:{vertexId:string;members:LocalVertexRef[]}[];vertexLinks:VertexLink[];faceAdjacency:{faceId:string;adjacentFaceIds:string[]}[];sourceInventory:SourceRef[];eulerCharacteristic:2;connectedFaceGraph:true;material:MaterialProof};
type Observation={index:number;edgeId:string;endpointIndex:0|1;parameter:number;vertexId:string;canonicalPoint:Point;vertexWorld:Point;canonicalVertexGapMM:number;local:[{useId:string;parameter:number;point:Point;canonicalGapMM:number;vertexGapMM:number},{useId:string;parameter:number;point:Point;canonicalGapMM:number;vertexGapMM:number}]};
type DirectCounts={parentValidationCount:number;bandWorldCurveValidationCount:number;bandUVCurveValidationCount:number;bandModelAdoptionCount:number;ruledSurfaceBuildCount:number;parametricFaceBuildCount:number;faceModelAdoptionCount:number;constructorDelegationCount:number;observationCount:number;curveD0AttemptCount:number;curveD1AttemptCount:0;surfaceD0AttemptCount:0;surfaceD1AttemptCount:0;sourceCompilationCount:0;rationalFloatConversionCount:0};
export interface PairedRoofDifferenceBodyReport {
 schema:'barocss-paired-roof-difference-body';version:0;evaluationId:string;parentEvaluationIds:[string,string];bodyId:string;shellId:string;materialCertificateId:string;faceIds:string[];
 operation:'regularized-upper-minus-lower';vertexCount:8;edgeCount:12;faceCount:6;loopCount:6;useCount:24;edgePairCount:12;vertexLinkCount:8;cornerArcCount:24;freeBoundaryCount:0;eulerCharacteristic:2;connectedFaceGraph:true;
 originalOperandCount:2;originalTrimmedModelCount:4;bandWorldModelCount:1;bandWorldObjectCount:5;closureRuledModelCount:3;closureFaceModelCount:3;flattenedMasterModelProduced:false;
 directionConvention:'raw-local-traversal-with-one-floor-import-reversal';sourceFrame:'authored-xyz-no-axis-conversion';uvLengthUnit:'dimensionless';lengthUnit:'mm';volumeUnit:'mm3';
 exactVolumeMM3:F;minimumHeightY:F;minimumGap:F;minimumJacobian:F;conservationResidual:F;maximumObservedEndpointGapMM:number;reservedIds:string[];
 directCounts:DirectCounts;inheritedCounts:{lower:Operand['report'];upper:Operand['report'];ruled:[CompatibleRuledSurfaceResult['report'],CompatibleRuledSurfaceResult['report'],CompatibleRuledSurfaceResult['report']]};rationalCounts:ReturnType<SectionRationalContext['counts']>;
 quality:{sharedBodyTopology:true;manifold:true;restrictedSolid:true;sourceDefinedOccupiedRegion:true;exactOccupiedVolume:true;exactOperandVolumeConservation:true;outwardMaterial:true;wholeBodyEmbedding:true;fullOperandsAndGeometryRetained:true;parentFlagsUnchanged:true;genericBoolean:false;generalCurvedSolidProperties:false;globalC1:false;globalBinary64EvaluationErrorCertified:false;manufacturingToleranceCertified:false;weldingPerformed:false;publication:false;ownership:'independent-copied-cpu-data-gc'};
 fileSizes:{request:Size;result:Size};ownValues:number;limits:Limits;
 workScope:'two-full-operands-one-real-b-band-three-real-closures-and-whole-variable-floor-proof';budgetFailure:'atomic-no-partial-difference-body';
}
type Limits={maximumClosures:3;maximumFaces:6;maximumEdgePairs:12;maximumObservations:24;maximumNativeD0Attempts:72;maximumVertices:8;maximumEdges:12;maximumUses:24;maximumOriginalUDegree:2;vDegree:1;maximumProofDegree:8;maximumRuledDegree:2;sourceCharacters:262144;sourceUTF8Bytes:262144;maximumObjectsPerModel:16;requestBytes:8388608;resultBytes:16777216;ownValues:4194304;ownDepth:64;arrayElements:8192;recordFields:64;keyCharacters:128;stringCharacters:262144;prefixCharacters:8;identityCharacters:48;rationalOperations:200000;gcdSteps:200000;rationalIntegerBits:8192;fractionIntegerCharacters:5000;maximumRationalFloatConversions:0;maximumSettlePasses:8};
export const PairedRoofDifferenceBodyDiagnosticCode=Object.freeze({INPUT:'INPUT',IDENTITY:'IDENTITY',PARENT:'PARENT',PROFILE:'PROFILE',SOURCE:'SOURCE',NATIVE:'NATIVE',CLOSURE:'CLOSURE',TOPOLOGY:'TOPOLOGY',MATERIAL:'MATERIAL',ORIENTATION:'ORIENTATION',DOMAIN:'DOMAIN',REPRESENTABILITY:'REPRESENTABILITY',BINDING:'BINDING',BUDGET:'BUDGET',FILE:'FILE',OWNED:'OWNED'} as const);
export class PairedRoofDifferenceBodyError extends Error {
  readonly code: Code;
  readonly context: Context;
  constructor(code: Code, detail: string, context: Context, cause?: unknown) {
    super(('Paired roof difference Body: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'PairedRoofDifferenceBodyError'; this.code = code;
    this.context = { ...context, directCounts: { ...context.directCounts } };
  }
}
const CODE = PairedRoofDifferenceBodyDiagnosticCode;
const REQUEST_LIMIT = 8388608, RESULT_LIMIT = 16777216;
function context(): Context {
  return { phase: 'input', assetIndex: null, closureIndex: null, edgeIndex: null, observationIndex: null,
    directCounts: { parentValidationCount: 0, bandWorldCurveValidationCount: 0, bandUVCurveValidationCount: 0, bandModelAdoptionCount: 0, ruledSurfaceBuildCount: 0,
      parametricFaceBuildCount: 0, faceModelAdoptionCount: 0, constructorDelegationCount: 0,
      observationCount: 0, curveD0AttemptCount: 0, curveD1AttemptCount: 0,
      surfaceD0AttemptCount: 0, surfaceD1AttemptCount: 0, sourceCompilationCount: 0, rationalFloatConversionCount: 0 } };
}
function fail(state: Context, code: Code, detail: string, cause?: unknown): never {
  throw new PairedRoofDifferenceBodyError(code, detail, state, cause);
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
    if (cause instanceof PairedRoofDifferenceBodyError) throw cause;
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
function reserveRoles(state: Context, request: PairedRoofDifferenceBodyRequest): string[] {
 const known=new Set<string>(), roles:string[]=[];
 const visit=(value:unknown,key=''):void=>{if(typeof value==='string'){if(key==='id'||/Ids?$/.test(key))known.add(value);}else if(Array.isArray(value))value.forEach(x=>visit(x,key));else if(value&&typeof value==='object')Object.entries(value).forEach(([k,v])=>visit(v,k));};
 visit(request.lower);visit(request.upper);
 const put=(value:string):void=>{id(state,value);check(state,!known.has(value),CODE.IDENTITY,'Fresh difference identity collides with full operands');known.add(value);roles.push(value);};
 const p=request.options.resultIdPrefix;put(request.options.evaluationId);
 for(const [kind,n]of[['v',8],['e',12],['f',6],['l',6],['use',24]]as const)for(let j=0;j<n;j++)put(p+'_'+kind+j);
 for(const suffix of['shell','body','material'])put(p+'_'+suffix);
 for(const suffix of['source','f','l'])put(p+'_band_'+suffix);
 for(const [kind,n]of[['v',4],['e',4],['use',4],['w',2],['uv',2]]as const)for(let j=0;j<n;j++)put(p+'_band_'+kind+j);
 for(let i=0;i<3;i++){for(const suffix of['s','source','f','l'])put(p+'_c'+i+'_'+suffix);for(const kind of['v','e','b'])for(let j=0;j<4;j++)put(p+'_c'+i+'_'+kind+j);}
 check(state,roles.length===127,CODE.IDENTITY,'Exact127 fresh identities required');return roles;
}
function limits(): PairedRoofDifferenceBodyReport['limits'] {
  return { maximumClosures: 3, maximumFaces: 6, maximumEdgePairs: 12, maximumObservations: 24,
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

/** Construct the strictly positive occupied layer upper minus lower. */
export function buildPairedRoofDifferenceBody(inputLower: Operand,inputUpper: Operand,inputOptions: PairedRoofDifferenceBodyOptions): PairedRoofDifferenceBodyResult {
 const state=context();
 const data=record(state,snapshot(state,{lower:inputLower,upper:inputUpper,options:inputOptions}),['lower','upper','options']);
 const settings=record(state,data.options,['evaluationId','resultIdPrefix','maximumClosures','maximumFaces','maximumEdgePairs','maximumObservations']);
 id(state,settings.evaluationId);id(state,settings.resultIdPrefix,8);
 check(state,settings.maximumClosures===3&&settings.maximumFaces===6&&settings.maximumEdgePairs===12&&settings.maximumObservations===24,CODE.BUDGET,'Fixed3/6/12/24 construction budgets required');
 const request:PairedRoofDifferenceBodyRequest={lower:data.lower as Operand,upper:data.upper as Operand,options:settings as unknown as PairedRoofDifferenceBodyOptions};
 const {lower,upper,options}=request,p=options.resultIdPrefix;
 const requestSize=json(state,request,REQUEST_LIMIT).size;
 let geometry:Geometry|null=null,graph:Graph|null=null,proof:Proof|null=null,partial:unknown=null;
 const vertices:Vertex[]=[],edges:Edge[]=[],faces:Face[]=[],observations:Observation[]=[];
 let reservedIds:string[]=[];
 const prefix=():void=>{const previous={...state};state.phase='file';state.assetIndex=null;state.closureIndex=null;state.edgeIndex=null;state.observationIndex=null;const retained={request,geometry,graph,proof,partial,vertices,edges,faces,observations,reservedIds};snapshot(state,retained);json(state,retained,RESULT_LIMIT);Object.assign(state,previous);};
 const call=<T>(counter:keyof DirectCounts,code:Code,message:string,action:()=>T):T=>{prefix();state.directCounts[counter]++;state.directCounts.constructorDelegationCount++;const result=delegated(state,code,message,action);prefix();return result;};
 prefix();state.phase='parent';state.assetIndex=0;call('parentValidationCount',CODE.PARENT,'Full lower material Body refused',()=>validatePairedSurfaceMaterialBody(lower));state.assetIndex=1;call('parentValidationCount',CODE.PARENT,'Full upper material Body refused',()=>validatePairedSurfaceMaterialBody(upper));state.assetIndex=null;state.phase='profile';
 reservedIds=reserveRoles(state,request);
 const q=new SectionRationalContext((kind,detail)=>fail(state,CODE[kind],detail));
 const zero=q.integer(0),read=(f:F):SectionRational=>q.rat(BigInt(f.numerator),BigInt(f.denominator));
 const equal=(a:SectionRational,b:SectionRational):boolean=>q.compare(a,b)===0;
 try {
  geometry=constructPairedRoofDifferenceGeometryTrusted(request,q,{
   validateCurve(curve,kind,edgeIndex){state.phase='band';state.edgeIndex=edgeIndex;call(kind==='band-world'?'bandWorldCurveValidationCount':'bandUVCurveValidationCount',CODE.NATIVE,'Actual band connector Curve admission refused',()=>validateCurve(curve));},
   buildRuled(first,second,opts,closureIndex){state.phase='closure';state.edgeIndex=null;state.closureIndex=closureIndex;return call('ruledSurfaceBuildCount',CODE.CLOSURE,'Actual Ruled difference closure refused',()=>buildCompatibleRuledSurface(first,second,opts));},
   buildFace(surface,ids,closureIndex){state.phase='closure';state.closureIndex=closureIndex;return call('parametricFaceBuildCount',CODE.CLOSURE,'Actual natural difference Face refused',()=>buildParametricFace(surface,ids));},
   adopt(model,sourceId,kind,closureIndex){state.phase='adoption';state.edgeIndex=null;state.closureIndex=closureIndex;const adopted=call(kind==='band'?'bandModelAdoptionCount':'faceModelAdoptionCount',CODE.SOURCE,'Actual complete difference Source adoption refused',()=>adoptSourceModel(model));check(state,same(adopted.model,model)&&model.objects.length===5,CODE.BINDING,'Complete adopted Model5 must preserve every native object');check(state,adopted.source.length<=262144&&new TextEncoder().encode(adopted.source).length<=262144,CODE.BUDGET,'Inherited perSource bound exceeded');return {sourceId,source:adopted.source,sourceVersion:0,model:adopted.model};},
   prefix(value){partial=value;prefix();}
  });
 }catch(cause){if(cause instanceof PairedRoofDifferenceBodyError)throw cause;if(cause instanceof PairedRoofDifferenceConstructionError){state.edgeIndex=cause.edgeIndex;fail(state,cause.code,'Actual strict difference geometry refused',cause);}fail(state,CODE.CLOSURE,'Actual strict difference geometry refused',cause);}
 partial=null;state.phase='topology';state.closureIndex=null;state.edgeIndex=null;prefix();
 const actualGeometry=geometry;
 const faceRoles:FaceRole[]=['roof','floor','band','yMin','xMin','xMax'];
 const edgeRoles:EdgeRole[]=['lowerCut','upperCut','lowerYMin','upperYMin','lowerXMin','upperXMin','lowerXMax','upperXMax','yMinXMin','yMinXMax','bandXMin','bandXMax'];
 const rolePairs:[number,number][]=[[2,3],[6,7],[0,1],[4,5],[0,2],[4,6],[1,3],[5,7],[0,4],[1,5],[2,6],[3,7]];
 const roleVertexNames=['bottomLeft','bottomRight','cutLeft','cutRight'];
 for(const [operandIndex,operand]of[lower,upper].entries())for(const [j,role]of roleVertexNames.entries()){
  const original=operand.request.a.vertices.find(v=>v.role===role);check(state,original!==undefined,CODE.BINDING,'Every original lower/upper corner must resolve');vertices.push({id:p+'_v'+(4*operandIndex+j),world:pointCopy(original.world),members:[]});
 }
 const pointEqual=(a:Point,b:Point):boolean=>a.every((value,i)=>equal(q.from(value),q.from(b[i])));
 const vertexIndex=(point:Point):number=>{const matches=vertices.flatMap((v,i)=>pointEqual(v.world,point)?[i]:[]);check(state,matches.length===1,CODE.TOPOLOGY,'Each actual local corner must resolve one distinct global class');return matches[0];};
 type Local={roleIndex:number;origin:LocalUseRef;nativePair:[number,number];directedPair:[number,number];reversal:boolean};
 const localByFace:Local[][]=[];const faceOrigins:LocalFaceRef[]=[];const supports:Surface[]=[];
 const addFace=(fi:number,origin:LocalFaceRef,support:Surface,localVertices:{id:string;world:Point}[],uses:LocalUseRef[]):void=>{
  faceOrigins.push(origin);supports.push(support);const indices=new Map<string,number>();
  for(const member of localVertices){const index=vertexIndex(member.world);check(state,!indices.has(member.id),CODE.TOPOLOGY,'Local vertex identity repeated within Face');indices.set(member.id,index);vertices[index].members.push({face:origin,vertexId:member.id,world:pointCopy(member.world)});}
  const imported=fi===1?uses.slice().reverse():uses;
  const locals=imported.map((use):Local=>{const curve=use.localCurve;const nativePair:[number,number]=[vertexIndex(curve.controlPoints[0]),vertexIndex(curve.controlPoints[curve.controlPoints.length-1])];const roleIndex=rolePairs.findIndex(pair=>pair[0]===nativePair[0]&&pair[1]===nativePair[1]||pair[1]===nativePair[0]&&pair[0]===nativePair[1]);check(state,roleIndex>=0,CODE.TOPOLOGY,'Local boundary is not an intended cube edge');const rawPair=use.localVertexIds.map(id=>indices.get(id)) as [number|undefined,number|undefined];check(state,rawPair[0]!==undefined&&rawPair[1]!==undefined,CODE.BINDING,'Raw local Use endpoints must resolve');const directedPair:[number,number]=fi===1?[rawPair[1],rawPair[0]]:[rawPair[0],rawPair[1]];return {roleIndex,origin:use,nativePair,directedPair,reversal:fi===1};});
  check(state,locals.length===4,CODE.TOPOLOGY,'Each Face imports exactly four raw Uses');localByFace.push(locals);
 };
 for(const [fi,name]of(['upper','lower']as const).entries()){
  const operand=request[name],parent=operand.request.a,face=parent.faces[0],loop=parent.loops[0];
  const src='request.'+name+'.request.a.world',sourceId=parent.request.section.request.assets[0].sourceId;
  const ref=(objectIndex:number,objectId:string):SourceRef=>({sourceId,sourceField:src+'.source',modelField:src+'.model',modelName:parent.world.model.name,objectIndex,objectId});
  const support=parent.world.model.objects[0];check(state,support.kind==='surface',CODE.SOURCE,'Actual inherited roof/floor support required');
  const origin:LocalFaceRef={kind:name,closureIndex:null,faceId:face.id,loopId:loop.id,supportRef:ref(0,support.id),sourceField:src+'.source',modelField:src+'.model'};
  const localUses=loop.uses.map((use):LocalUseRef=>{const edge=parent.edges.find(e=>e.id===use.edgeId);check(state,edge!==undefined,CODE.BINDING,'Original roof/floor raw Use edge must resolve');return {face:origin,edgeId:edge.id,useId:use.id,curveId:edge.curve.id,localVertexIds:[...use.vertexIds],localCurve:edge.curve,pcurve:{kind:'native-curve',curve:edge.pcurve.curve},sense:use.sense,interval:[...use.interval],curveRef:ref(edge.sourceRef.objectIndex,edge.curve.id)};});
  addFace(fi,origin,support,parent.vertices.filter(v=>loop.uses.some(use=>use.vertexIds.includes(v.id))).map(v=>({id:v.id,world:v.world})),localUses);
 }
 const band=actualGeometry.band;
 const bandOrigin:LocalFaceRef={kind:'band',closureIndex:null,faceId:band.face.id,loopId:band.loop.id,supportRef:band.supportRef,sourceField:'geometry.band.world.source',modelField:'geometry.band.world.model'};
 addFace(2,bandOrigin,band.support,band.vertices.map(v=>({id:v.id,world:v.world})),band.loop.uses.map((use):LocalUseRef=>{const edge=band.edges.find(e=>e.id===use.edgeId);check(state,edge!==undefined,CODE.BINDING,'Actual B band Use must resolve');return {face:bandOrigin,edgeId:edge.id,useId:use.id,curveId:edge.curve.id,localVertexIds:[...use.vertexIds],localCurve:edge.curve,pcurve:{kind:'native-curve',curve:edge.pcurve.curve},sense:use.sense,interval:[...use.interval],curveRef:edge.curveRef};}));
 for(const [i,closure]of actualGeometry.closures.entries()){
  const src='geometry.closures['+i+'].world',model=closure.world.model;
  const ref=(objectIndex:number,objectId:string):SourceRef=>({sourceId:closure.world.sourceId,sourceField:src+'.source',modelField:src+'.model',modelName:model.name,objectIndex,objectId});
  const support=model.objects[0];check(state,support.kind==='surface',CODE.SOURCE,'Actual natural closure support required');
  const originalFace=closure.face.topology.face,loop=closure.face.topology.loop;
  const origin:LocalFaceRef={kind:'closure',closureIndex:i,faceId:originalFace.id,loopId:loop.id,supportRef:ref(0,support.id),sourceField:src+'.source',modelField:src+'.model'};
  const localUses=loop.uses.map((use):LocalUseRef=>{const edge=closure.face.topology.edges.find(e=>e.id===use.edgeId);check(state,edge!==undefined,CODE.BINDING,'Actual natural raw edge required');const objectIndex=model.objects.findIndex(o=>o.id===edge.curveId),curve=model.objects[objectIndex];check(state,curve?.kind==='curve',CODE.SOURCE,'Actual natural Curve Model member required');return {face:origin,edgeId:edge.id,useId:null,curveId:curve.id,localVertexIds:[...edge.vertexIds],localCurve:curve,pcurve:{kind:'native-line',domain:[...use.pcurve.domain],uv0:[...use.pcurve.uv0],uv1:[...use.pcurve.uv1]},sense:use.sense,interval:nativeDomain(curve),curveRef:ref(objectIndex,curve.id)};});
  addFace(i+3,origin,support,closure.face.topology.vertices.map(v=>({id:v.id,world:v.point})),localUses);
 }
 check(state,vertices.every(v=>v.members.length===3),CODE.TOPOLOGY,'Eight three-member global vertex classes required');
 const choose=[[1],[1,1],[1,2,1],[1,3,3,1],[1,4,6,4,1]];
 const curveGridCache=new Map<Curve,SectionRational[][]>();
 const curveGrid=(curve:Curve):SectionRational[][]=>{
  const existing=curveGridCache.get(curve);if(existing)return existing;
  check(state,curve.degree>=1&&curve.degree<=4&&curve.controlPoints.length===curve.degree+1&&curve.weights.every(w=>Object.is(w,curve.weights[0]))&&curve.weights[0]>0,CODE.BINDING,'Actual uniform-weight Bezier required');
  const degree=curve.degree;
  const grid=Array.from({length:5},(_,i)=>[0,1,2].map(axis=>q.sum(curve.controlPoints.map((point,j)=>{
   const k=i-j;if(k<0||k>4-degree)return zero;
   const factor=q.div(q.integer(choose[degree][j]*choose[4-degree][k]),q.integer(choose[4][i]));
   return q.mul(q.from(point[axis]),factor);
  }))));
  curveGridCache.set(curve,grid);return grid;
 };
 const pending=edgeRoles.map((role,ri)=>{const first=localByFace.flat().find(use=>use.roleIndex===ri);check(state,first!==undefined,CODE.TOPOLOGY,'Each intended edge requires real source incidence');return {id:p+'_e'+ri,role,curve:first.origin.localCurve,curveRef:first.origin.curveRef,vertexIds:first.nativePair.map(i=>vertices[i].id)as[string,string],parameterRange:nativeDomain(first.origin.localCurve),nativePair:first.nativePair,uses:[]as GlobalUse[]};});
 for(const [fi,locals]of localByFace.entries()){
  const globalUses=locals.map((local,j):GlobalUse=>{const edge=pending[local.roleIndex],aligned=local.nativePair[0]===edge.nativePair[0]&&local.nativePair[1]===edge.nativePair[1],reversed=local.nativePair[0]===edge.nativePair[1]&&local.nativePair[1]===edge.nativePair[0];check(state,aligned||reversed,CODE.TOPOLOGY,'Actual endpoint pair must match canonical edge');const localDomain=nativeDomain(local.origin.localCurve),localEndpoints:[number,number]=aligned?[...localDomain]:[localDomain[1],localDomain[0]];const scale=q.div(q.sub(q.from(localEndpoints[1]),q.from(localEndpoints[0])),q.sub(q.from(edge.parameterRange[1]),q.from(edge.parameterRange[0]))),offset=q.sub(q.from(localEndpoints[0]),q.mul(scale,q.from(edge.parameterRange[0])));const canonicalGrid=curveGrid(edge.curve),localGrid=reversed?curveGrid(local.origin.localCurve).slice().reverse():curveGrid(local.origin.localCurve);const residuals=canonicalGrid.map((row,i)=>row.map((value,axis)=>q.sub(localGrid[i][axis],value)));check(state,residuals.every(row=>row.every(v=>v.n===0n)),CODE.BINDING,'Whole actual local Curve differs from canonical image');const parameterMap:ParameterMap={canonicalDomain:[...edge.parameterRange],localDomain:[...localDomain],offset:q.text(offset),scale:q.text(scale),localEndpointParameters:localEndpoints,endpointResiduals:edge.parameterRange.map((t,i)=>q.text(q.sub(q.add(offset,q.mul(scale,q.from(t))),q.from(localEndpoints[i]))))as[F,F],wholeCurveResiduals:residuals.map(row=>row.map(v=>q.text(v))),proofDegree:4};const vertexIds=local.directedPair.map(i=>vertices[i].id)as[string,string],forward=vertexIds[0]===edge.vertexIds[0]&&vertexIds[1]===edge.vertexIds[1];check(state,forward||vertexIds[0]===edge.vertexIds[1]&&vertexIds[1]===edge.vertexIds[0],CODE.TOPOLOGY,'Effective Use traversal must match canonical endpoints');const use:GlobalUse={id:p+'_use'+(4*fi+j),faceId:p+'_f'+fi,loopId:p+'_l'+fi,edgeId:edge.id,vertexIds,sense:forward?'forward':'reverse',origin:local.origin,parameterMap,importReversal:local.reversal};edge.uses.push(use);return use;})as[GlobalUse,GlobalUse,GlobalUse,GlobalUse];
  const loop:Loop={id:p+'_l'+fi,faceId:p+'_f'+fi,uses:globalUses};check(state,globalUses.every((use,j)=>use.vertexIds[1]===globalUses[(j+1)%4].vertexIds[0]),CODE.TOPOLOGY,'Effective four-Use Face loop must close');faces.push({id:p+'_f'+fi,role:faceRoles[fi],support:supports[fi],supportRef:faceOrigins[fi].supportRef,origin:faceOrigins[fi],orientation:fi===1||fi===2?'reverse':'forward',outerLoopId:loop.id,loop,importReversal:fi===1});prefix();
 }
 for(const edge of pending){check(state,edge.uses.length===2&&edge.uses[0].sense!==edge.uses[1].sense,CODE.TOPOLOGY,'Each closed boundary edge requires two opposite Uses');edges.push({id:edge.id,role:edge.role,curve:edge.curve,curveRef:edge.curveRef,vertexIds:edge.vertexIds,parameterRange:edge.parameterRange,uses:edge.uses as[GlobalUse,GlobalUse]});}
 const shell:Shell={id:p+'_shell',faceIds:faces.map(f=>f.id)as Shell['faceIds'],closed:true,oriented:true};const body:Body={id:p+'_body',shellIds:[shell.id],materialCertificateId:p+'_material',closed:true,solid:true,restrictedSolidCertified:true};graph={vertices,edges,faces,shell,body};state.phase='material';prefix();
 try{proof=provePairedRoofDifferenceBodyTrusted(request,actualGeometry,graph,q);}catch(cause){if(cause instanceof PairedRoofDifferenceBodyError)throw cause;if(cause instanceof PairedRoofDifferenceProofError){state.edgeIndex=cause.edgeIndex;fail(state,cause.code,'Whole actual difference material proof refused',cause);}fail(state,CODE.MATERIAL,'Whole actual difference material proof refused',cause);}
 check(state,proof.material.restrictedSolidCertified&&proof.material.wholeBoundaryImage&&proof.material.conservation.residual.numerator==='0'&&proof.vertexLinks.length===8&&proof.correspondence.length===12&&q.counts().floatConversions===0,CODE.MATERIAL,'Complete closed variable-floor material and conservation proof required');prefix();
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
  check(state, counts.parentValidationCount === 2 && counts.bandWorldCurveValidationCount === 2 && counts.bandUVCurveValidationCount === 2 && counts.bandModelAdoptionCount === 1 &&
    counts.ruledSurfaceBuildCount === 3 && counts.parametricFaceBuildCount === 3 &&
    counts.faceModelAdoptionCount === 3 && counts.constructorDelegationCount === 16 &&
    counts.observationCount === 24 && counts.curveD0AttemptCount === 72 && counts.curveD1AttemptCount === 0 &&
    counts.surfaceD0AttemptCount === 0 && counts.surfaceD1AttemptCount === 0 &&
    counts.sourceCompilationCount === 0 && counts.rationalFloatConversionCount === 0 && q.counts().floatConversions === 0,
  CODE.BINDING, 'Actual successful constructor/native schedule or zero root conversion authority disagrees');
 const actualProof=proof;
 const report:PairedRoofDifferenceBodyReport={schema:'barocss-paired-roof-difference-body',version:0,evaluationId:options.evaluationId,parentEvaluationIds:[lower.report.evaluationId,upper.report.evaluationId],bodyId:body.id,shellId:shell.id,materialCertificateId:body.materialCertificateId,faceIds:faces.map(f=>f.id),operation:'regularized-upper-minus-lower',vertexCount:8,edgeCount:12,faceCount:6,loopCount:6,useCount:24,edgePairCount:12,vertexLinkCount:8,cornerArcCount:24,freeBoundaryCount:0,eulerCharacteristic:2,connectedFaceGraph:true,originalOperandCount:2,originalTrimmedModelCount:4,bandWorldModelCount:1,bandWorldObjectCount:5,closureRuledModelCount:3,closureFaceModelCount:3,flattenedMasterModelProduced:false,directionConvention:'raw-local-traversal-with-one-floor-import-reversal',sourceFrame:'authored-xyz-no-axis-conversion',uvLengthUnit:'dimensionless',lengthUnit:'mm',volumeUnit:'mm3',exactVolumeMM3:actualProof.material.volume.exactVolumeMM3,minimumHeightY:actualProof.material.cubeMap.minimumHeightY,minimumGap:actualProof.material.cubeMap.minimumGap,minimumJacobian:actualProof.material.cubeMap.minimumJacobian,conservationResidual:actualProof.material.conservation.residual,maximumObservedEndpointGapMM:Math.max(...observations.flatMap(value=>[value.canonicalVertexGapMM,...value.local.flatMap(local=>[local.canonicalGapMM,local.vertexGapMM])])),reservedIds,directCounts:{...counts},inheritedCounts:{lower:lower.report,upper:upper.report,ruled:[actualGeometry.closures[0].ruled.report,actualGeometry.closures[1].ruled.report,actualGeometry.closures[2].ruled.report]},rationalCounts:q.counts(),quality:{sharedBodyTopology:true,manifold:true,restrictedSolid:true,sourceDefinedOccupiedRegion:true,exactOccupiedVolume:true,exactOperandVolumeConservation:true,outwardMaterial:true,wholeBodyEmbedding:true,fullOperandsAndGeometryRetained:true,parentFlagsUnchanged:true,genericBoolean:false,generalCurvedSolidProperties:false,globalC1:false,globalBinary64EvaluationErrorCertified:false,manufacturingToleranceCertified:false,weldingPerformed:false,publication:false,ownership:'independent-copied-cpu-data-gc'},fileSizes:{request:requestSize,result:{utf16:0,utf8:0}},ownValues:0,limits:limits(),workScope:'two-full-operands-one-real-b-band-three-real-closures-and-whole-variable-floor-proof',budgetFailure:'atomic-no-partial-difference-body'};
 const result:PairedRoofDifferenceBodyResult={request,geometry:actualGeometry,vertices,edges,faces,shell,body,proof:actualProof,observations,report};
 let settled=false;for(let pass=0;pass<8;pass++){const count=ownValues(state,result),measured=json(state,result,RESULT_LIMIT).size;if(report.ownValues===count&&same(report.fileSizes.result,measured)){settled=true;break;}report.ownValues=count;report.fileSizes.result=measured;}
 check(state,settled&&report.ownValues===ownValues(state,result)&&same(report.fileSizes.result,json(state,result,RESULT_LIMIT).size),CODE.FILE,'Complete difference own/file measurements must settle in8passes');return snapshot(state,result) as PairedRoofDifferenceBodyResult;
}
/** Rebuild once from both complete operands and preserve actual refusal context. */
export function validatePairedRoofDifferenceBody(input:unknown):PairedRoofDifferenceBodyReport {
 const state=context();state.phase='owned';try{const result=record(state,snapshot(state,input,true),['request','geometry','vertices','edges','faces','shell','body','proof','observations','report'],CODE.OWNED)as unknown as PairedRoofDifferenceBodyResult;json(state,result,RESULT_LIMIT);const expected=buildPairedRoofDifferenceBody(result.request.lower,result.request.upper,result.request.options);state.directCounts={...expected.report.directCounts};check(state,same(result,expected),CODE.OWNED,'Complete difference operands/geometry/source/UV/topology/material/observation/work/file fields changed');return snapshot(state,expected.report,true)as PairedRoofDifferenceBodyReport;}catch(cause){if(cause instanceof PairedRoofDifferenceBodyError&&cause.code===CODE.OWNED)throw cause;const failed=cause instanceof PairedRoofDifferenceBodyError?cause.context:state;throw new PairedRoofDifferenceBodyError(CODE.OWNED,'Complete difference reconstruction refused',{...failed,phase:'owned'},cause);}
}
