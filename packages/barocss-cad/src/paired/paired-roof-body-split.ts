import {buildPairedRoofDifferenceBody, validatePairedRoofDifferenceBody} from './paired-roof-difference-body.js';
import {validatePairedSurfaceMaterialBody} from './paired-surface-material-body.js';
import {SectionRationalContext} from '../section-rational-internal.js';
import {preflightPairedRoofBodySplitTrusted, provePairedRoofBodySplitTrusted, PairedRoofBodySplitProofError} from './paired-roof-body-split-proof-internal.js';
import type {PairedRoofDifferenceBodyResult, PairedRoofDifferenceBodyOptions, PairedRoofDifferenceBodyReport} from './paired-roof-difference-body.js';
import type {PairedSurfaceMaterialBodyResult, PairedSurfaceMaterialBodyReport} from './paired-surface-material-body.js';
import type {SectionFraction} from '../section-rational-internal.js';
import type {PairedRoofBodySplitProof} from './paired-roof-body-split-proof-internal.js';
import { same } from '../core/structural-equality.js';
import { KernelError } from '../core/barocss-error.js';

type F = SectionFraction;
type Size = {utf16:number; utf8:number};
type Code = 'INPUT'|'IDENTITY'|'PARENT'|'PROFILE'|'CONSTRUCTION'|'BINDING'|'PARTITION'|'ORIENTATION'|'BUDGET'|'REPRESENTABILITY'|'OWNED';
type DirectCounts = {wholeValidationCount:number;middleValidationCount:number;differenceBuildCount:number;delegationCount:number;curveD0AttemptCount:0;curveD1AttemptCount:0;surfaceD0AttemptCount:0;surfaceD1AttemptCount:0;sourceCompilationCount:0;rationalFloatConversionCount:0};
type Context = {phase:'input'|'parent'|'profile'|'lower'|'upper'|'proof'|'owned';outputIndex:0|1|null;directCounts:DirectCounts};
export interface PairedRoofBodySplitOptions {
  evaluationId:string; certificateId:string; maximumOutputBodies:2;
  lowerOptions:PairedRoofDifferenceBodyOptions; upperOptions:PairedRoofDifferenceBodyOptions;
}
export interface PairedRoofBodySplitRequest {
  whole:PairedRoofDifferenceBodyResult; middle:PairedSurfaceMaterialBodyResult; options:PairedRoofBodySplitOptions;
}
export interface PairedRoofBodySplitResult {
  request:PairedRoofBodySplitRequest;
  outputs:[PairedRoofDifferenceBodyResult,PairedRoofDifferenceBodyResult];
  proof:PairedRoofBodySplitProof; report:PairedRoofBodySplitReport;
}
export interface PairedRoofBodySplitReport {
  schema:'barocss-paired-roof-body-split';version:0;evaluationId:string;certificateId:string;parentBodyId:string;middleBodyId:string;
  outputBodyIds:[string,string];outputBodyCount:2;exactVolumeMM3:F;outputVolumesMM3:[F,F];conservationResidual:F;minimumGaps:[F,F];reservedIds:string[];
  directCounts:DirectCounts;
  inheritedCounts:{wholeValidation:PairedRoofDifferenceBodyReport;middleValidation:PairedSurfaceMaterialBodyReport;outputs:[PairedRoofDifferenceBodyReport,PairedRoofDifferenceBodyReport]};
  rationalCounts:ReturnType<SectionRationalContext['counts']>;
  quality:{closedOutputs:true;restrictedSolidOutputs:true;pointwiseMaterialCover:true;disjointInteriors:true;sharedNativeCut:true;oppositeCutOrientations:true;exactVolumeConservation:true;fullParentsRetained:true;independentCopiedData:true;genericSplit:false;generalBoolean:false;manufacturingToleranceCertified:false;globalBinary64EvaluationErrorCertified:false;publication:false};
  limits:ReturnType<typeof limits>;sizes:{request:Size;result:Size};ownValues:number;budgetFailure:'atomic-no-partial-split';
}
export const PairedRoofBodySplitDiagnosticCode = Object.freeze({INPUT:'INPUT',IDENTITY:'IDENTITY',PARENT:'PARENT',PROFILE:'PROFILE',CONSTRUCTION:'CONSTRUCTION',BINDING:'BINDING',PARTITION:'PARTITION',ORIENTATION:'ORIENTATION',BUDGET:'BUDGET',REPRESENTABILITY:'REPRESENTABILITY',OWNED:'OWNED'} as const);
export class PairedRoofBodySplitError extends KernelError {
  readonly code:Code;
  readonly context:Context;
  constructor(code:Code, detail:string, context:Context, cause?:unknown) {
    super(('Paired roof Body split: '+detail).slice(0,1024), cause === undefined ? undefined : {cause});
    this.name='PairedRoofBodySplitError';this.code=code;
    this.context={...context,directCounts:{...context.directCounts}};
  }
}
const CODE=PairedRoofBodySplitDiagnosticCode;
const REQUEST_LIMIT=8388608, RESULT_LIMIT=16777216;
function context():Context {
  return {phase:'input',outputIndex:null,directCounts:{wholeValidationCount:0,middleValidationCount:0,differenceBuildCount:0,delegationCount:0,curveD0AttemptCount:0,curveD1AttemptCount:0,surfaceD0AttemptCount:0,surfaceD1AttemptCount:0,sourceCompilationCount:0,rationalFloatConversionCount:0}};
}
function fail(state: Context, code: Code, detail: string, cause?: unknown): never {
  throw new PairedRoofBodySplitError(code, detail, state, cause);
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
  const copy = (value: unknown, depth: number, field = ''): unknown => {
    check(state, --remaining >= 0 && depth <= 64, budget, 'Own value or depth cap exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { check(state, Number.isFinite(value), code, 'Finite own numbers are required'); return value; }
    if (typeof value === 'string') { check(state, value.length <= 262144, budget, 'Own string cap exceeded'); if (field === 'source') check(state, new TextEncoder().encode(value).length <= 262144, budget, 'Own source UTF8 cap exceeded'); if (field === 'numerator' || field === 'denominator') check(state, value.length <= 5000, budget, 'Fraction integer character cap exceeded'); return value; }
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
    } else result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1, key)]));
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
  let utf16 = 0, utf8 = 0;
  const parts: string[] = [], encoder = new TextEncoder();
  const append = (text: string): void => {
    utf16 += text.length; utf8 += encoder.encode(text).length;
    check(state, utf16 <= limit && utf8 <= limit, CODE.BUDGET, 'Complete JSON exceeds its full UTF16 or UTF8 envelope');
    if (retain) parts.push(text);
  };
  const visit = (value: unknown): void => {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') append(JSON.stringify(value));
    else if (typeof value === 'number') { check(state, Number.isFinite(value), CODE.BUDGET, 'Finite JSON numbers are required'); append(Object.is(value, -0) ? '-0' : String(value)); }
    else if (Array.isArray(value)) { append('['); value.forEach((item, index) => { if (index) append(','); visit(item); }); append(']'); }
    else {
      check(state, value !== null && typeof value === 'object', CODE.BUDGET, 'Complete own JSON data is required');
      append('{'); Object.entries(value).forEach(([key, item], index) => { if (index) append(','); append(JSON.stringify(key)); append(':'); visit(item); }); append('}');
    }
  };
  visit(input); append('\n');
  return { text: retain ? parts.join('') : '', size: { utf16, utf8 } };
}
function delegated<T>(state: Context, code: Code, detail: string, action: () => T): T {
  try { return action(); } catch (cause) {
    if (cause instanceof PairedRoofBodySplitError) throw cause;
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
function limits() {
  return {outputBodies:2,requestBytes:8388608,resultBytes:16777216,ownValues:4194304,ownDepth:64,arrayElements:8192,recordFields:64,keyCharacters:128,stringCharacters:262144,sourceCharacters:262144,sourceUTF8Bytes:262144,fractionIntegerCharacters:5000,identityCharacters:48,prefixCharacters:8,rationalOperations:200000,gcdSteps:200000,rationalIntegerBits:8192,maximumRationalFloatConversions:0,maximumSettlePasses:8} as const;
}
function childOptions(state:Context,input:unknown):PairedRoofDifferenceBodyOptions {
  const data=record(state,input,['evaluationId','resultIdPrefix','maximumClosures','maximumFaces','maximumEdgePairs','maximumObservations']);
  id(state,data.evaluationId);id(state,data.resultIdPrefix,8);
  check(state,data.maximumClosures===3&&data.maximumFaces===6&&data.maximumEdgePairs===12&&data.maximumObservations===24,CODE.BUDGET,'Unchanged fixed 3/6/12/24 child caps required');
  return data as unknown as PairedRoofDifferenceBodyOptions;
}
/** Mirrors the unchanged provider's actual 127 reserved roles, without constructing geometry. */
function reserveRoles(state:Context,request:PairedRoofBodySplitRequest):string[] {
  const known=new Set<string>(),roles:string[]=[];
  const visit=(value:unknown,key=''):void=>{
    if(typeof value==='string'){if(key==='id'||/Ids?$/.test(key))known.add(value);}
    else if(Array.isArray(value))value.forEach(item=>visit(item,key));
    else if(value&&typeof value==='object')Object.entries(value).forEach(([name,item])=>visit(item,name));
  };
  visit(request.whole);visit(request.middle);
  const put=(value:string):void=>{id(state,value);check(state,!known.has(value),CODE.IDENTITY,'A fresh split/output identity collides with complete parents or another reserved role');known.add(value);roles.push(value);};
  put(request.options.evaluationId);put(request.options.certificateId);
  for(const options of [request.options.lowerOptions,request.options.upperOptions]) {
    const start=roles.length,p=options.resultIdPrefix;put(options.evaluationId);
    for(const [kind,n] of [['v',8],['e',12],['f',6],['l',6],['use',24]] as const)for(let j=0;j<n;j++)put(p+'_'+kind+j);
    for(const suffix of ['shell','body','material'])put(p+'_'+suffix);
    for(const suffix of ['source','f','l'])put(p+'_band_'+suffix);
    for(const [kind,n] of [['v',4],['e',4],['use',4],['w',2],['uv',2]] as const)for(let j=0;j<n;j++)put(p+'_band_'+kind+j);
    for(let i=0;i<3;i++){for(const suffix of ['s','source','f','l'])put(p+'_c'+i+'_'+suffix);for(const kind of ['v','e','b'])for(let j=0;j<4;j++)put(p+'_c'+i+'_'+kind+j);}
    check(state,roles.length-start===127,CODE.IDENTITY,'Each child requires exactly the original 127 roles');
  }
  check(state,roles.length===256,CODE.IDENTITY,'Exactly 256 fresh wrapper/output roles required');return roles;
}
/** Construct two new closed qualified Solids around a retained native intermediate A roof. */
export function splitPairedRoofDifferenceBody(input:PairedRoofBodySplitRequest):PairedRoofBodySplitResult {
  const state=context();
  const data=record(state,snapshot(state,input),['whole','middle','options']);
  const settings=record(state,data.options,['evaluationId','certificateId','maximumOutputBodies','lowerOptions','upperOptions']);
  id(state,settings.evaluationId);id(state,settings.certificateId);
  check(state,settings.maximumOutputBodies===2,CODE.BUDGET,'Exactly two output Bodies required');
  const lowerOptions=childOptions(state,settings.lowerOptions),upperOptions=childOptions(state,settings.upperOptions);
  const request:PairedRoofBodySplitRequest={whole:data.whole as PairedRoofDifferenceBodyResult,middle:data.middle as PairedSurfaceMaterialBodyResult,options:{evaluationId:settings.evaluationId,certificateId:settings.certificateId,maximumOutputBodies:2,lowerOptions,upperOptions}};
  const requestSize=json(state,request,REQUEST_LIMIT).size;
  const reservedIds=reserveRoles(state,request);
  const outputs:PairedRoofDifferenceBodyResult[]=[];
  let proof:PairedRoofBodySplitProof|null=null;
  let wholeValidation:PairedRoofDifferenceBodyReport|null=null,middleValidation:PairedSurfaceMaterialBodyReport|null=null;
  const prefix=():void=>{const retained={request,outputs,proof,reservedIds,wholeValidation,middleValidation};snapshot(state,retained);json(state,retained,RESULT_LIMIT);};
  const call=<T>(counter:'wholeValidationCount'|'middleValidationCount'|'differenceBuildCount',code:Code,detail:string,action:()=>T,retain:(value:T)=>void):T=>{
    prefix();state.directCounts[counter]++;state.directCounts.delegationCount++;
    const result=delegated(state,code,detail,action);retain(result);prefix();return result;
  };
  state.phase='parent';
  const wholeReport=call('wholeValidationCount',CODE.PARENT,'Complete whole difference Body refused',()=>validatePairedRoofDifferenceBody(request.whole),value=>{wholeValidation=value;});
  const middleReport=call('middleValidationCount',CODE.PARENT,'Complete native middle material Body refused',()=>validatePairedSurfaceMaterialBody(request.middle),value=>{middleValidation=value;});
  const q=new SectionRationalContext((kind,detail)=>fail(state,CODE[kind],detail));
  const helper=<T>(action:()=>T):T=>{
    try{return action();}catch(cause){if(cause instanceof PairedRoofBodySplitError)throw cause;if(cause instanceof PairedRoofBodySplitProofError)fail(state,cause.code,'Exact common-authority or composition proof refused',cause);fail(state,CODE.PARTITION,'Exact composition proof refused',cause);}
  };
  state.phase='profile';prefix();helper(()=>preflightPairedRoofBodySplitTrusted(request.whole,request.middle,q));prefix();
  state.phase='lower';state.outputIndex=0;
  call('differenceBuildCount',CODE.CONSTRUCTION,'Lower-to-middle genuine difference construction refused',()=>buildPairedRoofDifferenceBody(request.whole.request.lower,request.middle,lowerOptions),value=>{outputs.push(value);});
  state.phase='upper';state.outputIndex=1;
  call('differenceBuildCount',CODE.CONSTRUCTION,'Middle-to-upper genuine difference construction refused',()=>buildPairedRoofDifferenceBody(request.middle,request.whole.request.upper,upperOptions),value=>{outputs.push(value);});
  check(state,outputs.length===2,CODE.BINDING,'Both genuine outputs must exist atomically');
  const pair=outputs as [PairedRoofDifferenceBodyResult,PairedRoofDifferenceBodyResult];
  check(state,same(pair[0].report.reservedIds,reservedIds.slice(2,129))&&same(pair[1].report.reservedIds,reservedIds.slice(129)),CODE.IDENTITY,'Actual child reservations differ from preflight');
  state.phase='proof';state.outputIndex=null;prefix();
  proof=helper(()=>provePairedRoofBodySplitTrusted(request.whole,request.middle,pair,request.options.certificateId,reservedIds,q));prefix();
  check(state,q.counts().floatConversions===0,CODE.BINDING,'Composition uses no rational-to-float conversions');
  const report:PairedRoofBodySplitReport={schema:'barocss-paired-roof-body-split',version:0,evaluationId:request.options.evaluationId,certificateId:request.options.certificateId,parentBodyId:request.whole.body.id,middleBodyId:request.middle.body.id,outputBodyIds:[pair[0].body.id,pair[1].body.id],outputBodyCount:2,exactVolumeMM3:proof.volume.wholeMM3,outputVolumesMM3:proof.volume.outputsMM3,conservationResidual:proof.volume.residual,minimumGaps:[proof.regions.minimumLowerGap,proof.regions.minimumUpperGap],reservedIds,directCounts:{...state.directCounts},inheritedCounts:{wholeValidation:wholeReport,middleValidation:middleReport,outputs:[pair[0].report,pair[1].report]},rationalCounts:q.counts(),quality:{closedOutputs:true,restrictedSolidOutputs:true,pointwiseMaterialCover:true,disjointInteriors:true,sharedNativeCut:true,oppositeCutOrientations:true,exactVolumeConservation:true,fullParentsRetained:true,independentCopiedData:true,genericSplit:false,generalBoolean:false,manufacturingToleranceCertified:false,globalBinary64EvaluationErrorCertified:false,publication:false},limits:limits(),sizes:{request:requestSize,result:{utf16:0,utf8:0}},ownValues:0,budgetFailure:'atomic-no-partial-split'};
  const result:PairedRoofBodySplitResult={request,outputs:pair,proof,report};
  let settled=false;
  for(let pass=0;pass<8;pass++){
    const count=ownValues(state,result),size=json(state,result,RESULT_LIMIT).size;
    if(report.ownValues===count&&same(report.sizes.result,size)){settled=true;break;}
    report.ownValues=count;report.sizes.result=size;
  }
  check(state,settled&&report.ownValues===ownValues(state,result)&&same(report.sizes.result,json(state,result,RESULT_LIMIT).size),CODE.BUDGET,'Complete split own/JSON measurements must settle in eight passes');
  return snapshot(state,result) as PairedRoofBodySplitResult;
}
/** Reconstruct once; compare every retained source, graph, coefficient, counter and bound. */
export function validatePairedRoofBodySplit(input:unknown):PairedRoofBodySplitReport {
  const state=context();state.phase='owned';
  try {
    const result=record(state,snapshot(state,input,true),['request','outputs','proof','report'],CODE.OWNED) as unknown as PairedRoofBodySplitResult;
    json(state,result,RESULT_LIMIT);
    const expected=splitPairedRoofDifferenceBody(result.request);
    state.directCounts={...expected.report.directCounts};
    check(state,same(result,expected),CODE.OWNED,'Complete retained split request, outputs, proof or report changed');
    return snapshot(state,expected.report,true) as PairedRoofBodySplitReport;
  }catch(cause){
    if(cause instanceof PairedRoofBodySplitError&&cause.code===CODE.OWNED)throw cause;
    const failed=cause instanceof PairedRoofBodySplitError?cause.context:state;
    throw new PairedRoofBodySplitError(CODE.OWNED,'Complete split reconstruction or comparison refused',{...failed,phase:'owned'},cause);
  }
}
