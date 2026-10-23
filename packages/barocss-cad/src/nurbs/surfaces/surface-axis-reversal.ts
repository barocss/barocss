import { CadNumericPolicy } from '../../numeric-policy.js';
import { validateSurface, surfaceDomain, evaluateSurface } from '../../math.js';
import { evaluateSurfaceD1 } from '../../derivatives.js';
import type { SurfaceD1Result } from '../../derivatives.js';
import { reverseCurve, CurveReversalError } from '../curves/curve-reversal.js';
import type { ReversedCurveResult } from '../curves/curve-reversal.js';
import { compileCadModel } from '../../model-compiler.js';
import { curveDecimal } from '../curves/curve-source.js';
import { copyCadData } from '../../data-copy.js';
import type { Curve, Surface, Model, Point } from '../../types.js';
import { same } from '../../structural-equality.js';

export const SurfaceAxisReversalDiagnosticCode = Object.freeze({
  INPUT:'INPUT', AXIS:'AXIS', IDENTITY:'IDENTITY', DOMAIN:'DOMAIN',
  REPRESENTABILITY:'REPRESENTABILITY', NATIVE:'NATIVE', BINDING:'BINDING', OWNED:'OWNED',
} as const);
export type SurfaceAxisReversalDiagnosticCode = typeof SurfaceAxisReversalDiagnosticCode[keyof typeof SurfaceAxisReversalDiagnosticCode];
export class SurfaceAxisReversalError extends Error {
  readonly code: SurfaceAxisReversalDiagnosticCode;
  constructor(code: SurfaceAxisReversalDiagnosticCode, detail: string, cause?: unknown) {
    super(('Surface axis reversal: '+detail).slice(0,1024),cause===undefined?undefined:{cause});
    this.name='SurfaceAxisReversalError'; this.code=code;
  }
}
export interface SurfaceAxisReversalDomain { u:[number,number]; v:[number,number] }
export interface SurfaceAxisReversalOptions { surfaceId:string; axis:'u'|'v'; resultIdPrefix:string }
export type SurfaceAxisReversalD1State = {status:'evaluated';value:SurfaceD1Result}|{status:'native-refused';reason:string};
export interface SurfaceAxisReversalStrip { fixedPoleIndex:number; result:ReversedCurveResult }
export interface SurfaceAxisReversalCoefficientMapping {
  originalUIndex:number; originalVIndex:number; reversedUIndex:number; reversedVIndex:number;
  pointOrigin:'original-bit-copy'; weightOrigin:'original-bit-copy';
}
export interface SurfaceAxisReversalProvenance {
  originalSurfaceId:string; outputSurfaceId:string; axis:'u'|'v'; domain:SurfaceAxisReversalDomain;
  parameterMaps:{
    u:{orientation:1|-1;d1Factor:1|-1;formula:'u=s'|'u=a+(b-s)';domain:[number,number]};
    v:{orientation:1|-1;d1Factor:1|-1;formula:'v=t'|'v=a+(b-t)';domain:[number,number]};
  };
  strips:SurfaceAxisReversalStrip[]; coefficients:SurfaceAxisReversalCoefficientMapping[];
}
export interface SurfaceAxisReversalObservation {
  u:number; v:number; originalU:number; originalV:number;
  originalPointMM:Point; reversedPointMM:Point; pointDifferenceMM:number;
  originalD1:SurfaceAxisReversalD1State; reversedD1:SurfaceAxisReversalD1State;
  expectedDuMM:Point|null; expectedDvMM:Point|null;
  duDifferenceMM:number|null; dvDifferenceMM:number|null;
}
export interface SurfaceAxisReversalGuardObservation {
  axis:'u'|'v'; originalAuthoredU:number; originalAuthoredV:number;
  mappedOriginalU:number; mappedOriginalV:number; reversedU:number; reversedV:number;
  originalAtAuthoredKnot:SurfaceAxisReversalD1State;
  originalAtMappedParameters:SurfaceAxisReversalD1State; reversedAtReflectedParameters:SurfaceAxisReversalD1State;
}
export interface ReversedSurfaceAxisReport {
  family:'own-native-surface-parameter-axis-reversal';
  dto:{schema:'barocss-native-surface-axis-reversal';version:0;lengthUnit:'mm';frame:'authored-xyz-no-axis-conversion';representation:'native-surface-not-face-topology'};
  originalSurfaceId:string; surfaceId:string; axis:'u'|'v'; domain:SurfaceAxisReversalDomain;
  grid:{u:number;v:number;total:number}; stripCount:number;
  observations:SurfaceAxisReversalObservation[]; guards:SurfaceAxisReversalGuardObservation[];
  maximumPointDifferenceMM:number; maximumRelativeDuDifference:number; maximumRelativeDvDifference:number;
  geometricValidity:'not-certified';topologyCertified:false;solid:false;
  quality:{pointComparisonMM:1e-7;relativeD1Comparison:1e-7;localObservationsOnly:true;globalShapeErrorCertified:false;
    manufacturingToleranceCertified:false;coefficientAndWeightBitsPreserved:true;nonselectedKnotBitsPreserved:true;
    generatedInteriorKnotBitsCertified:false;doubleReversalBitsCertified:false;
    derivativeSemantics:'authored-mapped-reflected-combined-d1-states-distinct-no-g1-g2-claim'};
  limits:{maximumDegree:3;maximumAxisPoles:16;maximumTotalPoles:256;maximumStrips:16;maximumObservations:128;maximumGuardRecords:256;
    inputValues:32768;inputDepth:8;inputArrayElements:64;inputRecordFields:16;snapshotValues:262144;snapshotDepth:32;
    arrayElements:4096;recordFields:64;sourceStringCharacters:262144;authoredIdCharacters:48;resultIdPrefixCharacters:20};
}
export interface ReversedSurfaceAxisResult {
  original:Surface;options:SurfaceAxisReversalOptions;surface:Surface;source:string;sourceVersion:0;model:Model;
  originalSource:string;originalModel:Model;provenance:SurfaceAxisReversalProvenance;report:ReversedSurfaceAxisReport;
}

const POINT_TOLERANCE = CadNumericPolicy.linearToleranceMM;
const D1_TOLERANCE = CadNumericPolicy.relativeComparison;
const CODE = SurfaceAxisReversalDiagnosticCode;
function requireValue(condition: boolean, code: SurfaceAxisReversalDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new SurfaceAxisReversalError(code, detail);
}
function finite(value: number, code: SurfaceAxisReversalDiagnosticCode, detail: string): number {
  requireValue(Number.isFinite(value), code, detail);
  return value;
}
function snapshot(input: unknown, result = false, code: SurfaceAxisReversalDiagnosticCode = CODE.INPUT): unknown {
  let remaining = result ? 262144 : 32768;
  const copy = (value: unknown, depth: number): unknown => {
    requireValue(--remaining >= 0 && depth <= (result ? 32 : 8), code, 'own-value/depth budget exceeded');
    if (value === null && result) return null;
    if (typeof value === 'number') {
      requireValue(Number.isFinite(value), code, 'finite own numbers required');
      return value;
    }
    if (typeof value === 'string') {
      requireValue(value.length <= (result ? 262144 : 128), code, 'own string budget exceeded');
      return value;
    }
    if (typeof value === 'boolean' && result) return value;
    requireValue(value !== null && typeof value === 'object', code, 'plain own data required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    requireValue(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null,
      code, 'foreign own-data prototype refused');
    const keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    requireValue(keys.length <= (array ? (result ? 4097 : 65) : (result ? 64 : 16)), code, 'own field budget exceeded');
    requireValue(keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key]
      && (array && key === 'length' || descriptors[key].enumerable === true)), code,
    'getters, symbols and hidden fields refused');
    if (array) {
      const length = descriptors.length.value as number;
      requireValue(Number.isInteger(length) && length >= 0 && length <= (result ? 4096 : 64)
        && keys.length === length + 1, code, 'dense bounded own array required');
      return Array.from({ length }, (_, index) => {
        requireValue(Object.hasOwn(descriptors, String(index)), code, 'sparse or foreign array field refused');
        return copy(descriptors[String(index)].value, depth + 1);
      });
    }
    return Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
  };
  return copy(input, 0);
}
function record(value: unknown, fields: string[]): Record<string, unknown> {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value), CODE.INPUT, 'own record required');
  const data = value as Record<string, unknown>;
  requireValue(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)),
    CODE.INPUT, 'exact fields required: ' + fields.join(','));
  return data;
}
function id(value: unknown): string {
  requireValue(typeof value === 'string' && value.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value),
    CODE.IDENTITY, 'ASCII ID1..48 required');
  return value;
}
function native<T>(operation: () => T, detail: string, code: SurfaceAxisReversalDiagnosticCode = CODE.NATIVE): T {
  try { return operation(); } catch (cause) {
    if (cause instanceof SurfaceAxisReversalError) throw cause;
    throw new SurfaceAxisReversalError(code, detail + ': '
      + (cause instanceof Error ? cause.message : 'native operation refused'), cause);
  }
}

function d1(surface: Surface, u: number, v: number): SurfaceAxisReversalD1State {
  try { return { status: 'evaluated', value: evaluateSurfaceD1(surface, u, v) }; } catch (cause) {
    return { status: 'native-refused', reason: (cause instanceof Error ? cause.message : 'native combined D1 refused').slice(0, 1024) };
  }
}
function point(surface: Surface, u: number, v: number): Point {
  const result = native(() => evaluateSurface(surface, u, v), 'native Surface point evaluation');
  requireValue(result.every(Number.isFinite), CODE.NATIVE, 'native Surface point must be finite');
  return result;
}
function distance(a: Point, b: Point): number {
  return finite(Math.hypot(...a.map((value, index) => finite(value - b[index], CODE.BINDING,
    'native binding subtraction overflow'))), CODE.BINDING, 'native binding norm overflow');
}
function grid(surface: Surface): { u: number; v: number; total: number } {
  const u = surface.controlPoints.length, v = surface.controlPoints[0].length;
  return { u, v, total: u * v };
}
function sourceSurface(surface: Surface, name: string): { surface: Surface; source: string; model: Model } {
  const decimal = (value: number) => native(() => curveDecimal(value, 'Surface axis reversal'), 'native source decimal');
  const list = (values: number[]) => '[' + values.map(decimal).join(',') + ']';
  const poles = (points: Point[]) => '[' + points.map(list).join(',') + ']';
  const source = '@model ' + name + ' { version:0; length-unit:mm; @surface #' + surface.id
    + ' { type:nurbs; degree-u:' + decimal(surface.degreeU) + '; degree-v:' + decimal(surface.degreeV)
    + '; knots-u:' + list(surface.knotsU) + '; knots-v:' + list(surface.knotsV)
    + '; control-points:[' + surface.controlPoints.map(poles).join(',') + ']; weights:['
    + surface.weights.map(list).join(',') + ']; } }\n';
  requireValue(source.length <= 262144, CODE.NATIVE, 'native source byte budget exceeded');
  const compiled = native(() => compileCadModel(source, { sourceVersion: 0 }), 'native source0 compilation');
  if (!compiled.ok) throw new SurfaceAxisReversalError(CODE.NATIVE, 'actual Surface source0 must compile', compiled);
  requireValue(same(compiled.model, { name, version: 0, lengthUnit: 'mm', objects: [surface] }), CODE.NATIVE,
    'actual native source must adopt complete grid/ID/domain/sign bits');
  return { surface: compiled.model.objects[0] as Surface, source, model: compiled.model };
}
function otherParameters(knots:number[], domain:[number,number]):number[] {
  const breaks=[domain[0]];
  for(const knot of knots) if(knot>domain[0]&&knot<domain[1]&&!breaks.some(value=>value===knot)) breaks.push(knot);
  breaks.push(domain[1]);
  const values:number[]=[];
  for(let index=0;index<breaks.length;index++) {
    values.push(breaks[index]);
    if(index+1===breaks.length) continue;
    const width=finite(breaks[index+1]-breaks[index],CODE.REPRESENTABILITY,'nonselected native span overflow');
    const midpoint=finite(breaks[index]+width/2,CODE.REPRESENTABILITY,'nonselected native midpoint overflow');
    requireValue(width>0&&midpoint>breaks[index]&&midpoint<breaks[index+1],CODE.REPRESENTABILITY,'nonselected midpoint not represented');
    values.push(midpoint);
  }
  return values;
}
/** Axis orientation comes from actual native Curve reversal; no second scalar reflection evaluator. */
export function reverseSurfaceAxis(surfaceInput:Surface,inputOptions:SurfaceAxisReversalOptions):ReversedSurfaceAxisResult {
  const original=record(snapshot(surfaceInput),['kind','id','degreeU','degreeV','knotsU','knotsV','controlPoints','weights']) as unknown as Surface;
  const data=record(snapshot(inputOptions),['surfaceId','axis','resultIdPrefix']);
  id(original.id); const surfaceId=id(data.surfaceId);
  requireValue(data.axis==='u'||data.axis==='v',CODE.AXIS,'selected axis must be u or v');
  const axis=data.axis,other=axis==='u'?'v':'u';
  requireValue(original.kind==='surface'&&Number.isInteger(original.degreeU)&&Number.isInteger(original.degreeV)
    &&original.degreeU>=1&&original.degreeU<=3&&original.degreeV>=1&&original.degreeV<=3,CODE.INPUT,'native U/V degrees1..3 Surface required');
  requireValue(Array.isArray(original.controlPoints)&&original.controlPoints.length>=2&&original.controlPoints.length<=16
    &&original.controlPoints.every(row=>Array.isArray(row)&&row.length>=2&&row.length<=16&&row.every(pole=>Array.isArray(pole)
      &&pole.length===3&&pole.every(value=>typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=10000))),CODE.INPUT,
  'axes2..16 and authored XYZ within10000mm required');
  native(()=>validateSurface(original),'original positive open-clamped Surface admission',CODE.INPUT);
  const dimensions=grid(original),domain=surfaceDomain(original);
  requireValue(dimensions.total<=256,CODE.INPUT,'original total pole count exceeds256');
  for(const selected of ['u','v'] as const) requireValue(Number.isFinite(domain[selected][1]-domain[selected][0])
    &&domain[selected][0]<domain[selected][1],CODE.DOMAIN,'finite positive U/V domain spans required');
  requireValue(typeof data.resultIdPrefix==='string'&&data.resultIdPrefix.length<=20
    &&/^[A-Za-z_][A-Za-z0-9_-]*$/.test(data.resultIdPrefix),CODE.IDENTITY,'ASCII result prefix1..20 required');
  const options:SurfaceAxisReversalOptions={surfaceId,axis,resultIdPrefix:data.resultIdPrefix};
  const roles=Array.from({length:16},(_,index)=>[id(options.resultIdPrefix+'_s'+index+'_src'),id(options.resultIdPrefix+'_s'+index+'_rev')]);
  requireValue(new Set([original.id,surfaceId,...roles.flat()]).size===34,CODE.IDENTITY,'original/output/32 coefficient-strip roles must differ');
  const selectedKnots=axis==='u'?original.knotsU:original.knotsV;
  const selectedDegree=axis==='u'?original.degreeU:original.degreeV;
  const otherKnots=other==='u'?original.knotsU:original.knotsV;
  const fixedParameters=otherParameters(otherKnots,domain[other]);
  const strips:SurfaceAxisReversalStrip[]=[];
  const makeStrip=(fixed:number):SurfaceAxisReversalStrip=>{
    const strip:Curve={kind:'curve',id:roles[fixed][0],degree:selectedDegree,knots:copyCadData(selectedKnots),
      controlPoints:Array.from({length:dimensions[axis]},(_,varying)=>copyCadData(axis==='u'
        ?original.controlPoints[varying][fixed]:original.controlPoints[fixed][varying])),
      weights:Array.from({length:dimensions[axis]},(_,varying)=>axis==='u'?original.weights[varying][fixed]:original.weights[fixed][varying])};
    try {return {fixedPoleIndex:fixed,result:reverseCurve(strip,{curveId:roles[fixed][1]})};}
    catch(cause) {
      const code=cause instanceof CurveReversalError&&cause.code==='REPRESENTABILITY'?CODE.REPRESENTABILITY:CODE.NATIVE;
      throw new SurfaceAxisReversalError(code,'actual native coefficient-strip reversal refused',cause);
    }
  };
  const first=makeStrip(0); strips.push(first);
  const pairs=first.result.report.observations.map(value=>({reversed:value.reversedParameter,original:value.originalParameter}));
  requireValue(pairs.length>=2&&pairs.length*fixedParameters.length<=128,CODE.REPRESENTABILITY,'native parent/nonselected cartesian observation grid exceeds128');
  for(let fixed=1;fixed<dimensions[other];fixed++) {
    const strip=makeStrip(fixed);
    requireValue(same(strip.result.curve.knots,first.result.curve.knots),CODE.NATIVE,'actual reversed selected knot bits must agree across every strip');
    strips.push(strip);
  }
  const surface:Surface={kind:'surface',id:surfaceId,degreeU:original.degreeU,degreeV:original.degreeV,
    knotsU:copyCadData(axis==='u'?first.result.curve.knots:original.knotsU),
    knotsV:copyCadData(axis==='v'?first.result.curve.knots:original.knotsV),
    controlPoints:Array.from({length:dimensions.u},(_,u)=>Array.from({length:dimensions.v},(_,v)=>copyCadData(axis==='u'
      ?strips[v].result.curve.controlPoints[u]:strips[u].result.curve.controlPoints[v]))),
    weights:Array.from({length:dimensions.u},(_,u)=>Array.from({length:dimensions.v},(_,v)=>axis==='u'
      ?strips[v].result.curve.weights[u]:strips[u].result.curve.weights[v]))};
  native(()=>validateSurface(surface),'assembled actual reversed Surface admission');
  requireValue(same(surfaceDomain(surface),domain),CODE.NATIVE,'original U/V domain endpoint bits must remain');
  requireValue(same(other==='u'?surface.knotsU:surface.knotsV,otherKnots),CODE.NATIVE,'nonselected knot bits must remain');
  const coefficients:SurfaceAxisReversalCoefficientMapping[]=[];
  for(let u=0;u<dimensions.u;u++) for(let v=0;v<dimensions.v;v++) {
    const originalUIndex=axis==='u'?dimensions.u-1-u:u,originalVIndex=axis==='v'?dimensions.v-1-v:v;
    requireValue(same(surface.controlPoints[u][v],original.controlPoints[originalUIndex][originalVIndex])
      &&Object.is(surface.weights[u][v],original.weights[originalUIndex][originalVIndex]),CODE.NATIVE,'reversed Surface coefficient/weight bits must be direct original copies');
    coefficients.push({originalUIndex,originalVIndex,reversedUIndex:u,reversedVIndex:v,pointOrigin:'original-bit-copy',weightOrigin:'original-bit-copy'});
  }
  const coordinates=(selected:number,fixed:number):{u:number;v:number}=>axis==='u'?{u:selected,v:fixed}:{u:fixed,v:selected};
  const observations:SurfaceAxisReversalObservation[]=[];
  for(const pair of pairs) for(const fixed of fixedParameters) {
    const output=coordinates(pair.reversed,fixed),mapped=coordinates(pair.original,fixed);
    const originalPointMM=point(original,mapped.u,mapped.v),reversedPointMM=point(surface,output.u,output.v);
    const pointDifferenceMM=distance(originalPointMM,reversedPointMM);
    requireValue(pointDifferenceMM<=POINT_TOLERANCE,CODE.BINDING,'mapped original/reversed Surface point exceeds local policy');
    const originalD1=d1(original,mapped.u,mapped.v),reversedD1=d1(surface,output.u,output.v);
    let expectedDuMM:Point|null=null,expectedDvMM:Point|null=null,duDifferenceMM:number|null=null,dvDifferenceMM:number|null=null;
    if(originalD1.status==='evaluated') {
      expectedDuMM=originalD1.value.du.map(value=>axis==='u'?-value:value) as Point;
      expectedDvMM=originalD1.value.dv.map(value=>axis==='v'?-value:value) as Point;
      if(reversedD1.status==='evaluated') {
        duDifferenceMM=distance(expectedDuMM,reversedD1.value.du); dvDifferenceMM=distance(expectedDvMM,reversedD1.value.dv);
        const scaleU=finite(Math.hypot(...originalD1.value.du),CODE.BINDING,'native du magnitude overflow');
        const scaleV=finite(Math.hypot(...originalD1.value.dv),CODE.BINDING,'native dv magnitude overflow');
        requireValue(duDifferenceMM<=D1_TOLERANCE*Math.max(1,scaleU)&&dvDifferenceMM<=D1_TOLERANCE*Math.max(1,scaleV),CODE.BINDING,'mapped Surface partial sign exceeds local policy');
      }
    }
    observations.push({u:output.u,v:output.v,originalU:mapped.u,originalV:mapped.v,originalPointMM,reversedPointMM,pointDifferenceMM,
      originalD1,reversedD1,expectedDuMM,expectedDvMM,duDifferenceMM,dvDifferenceMM});
  }
  const guards:SurfaceAxisReversalGuardObservation[]=[];
  const addGuard=(guardAxis:'u'|'v',authored:{u:number;v:number},mapped:{u:number;v:number},output:{u:number;v:number}):void=>{
    requireValue(guards.length<256,CODE.REPRESENTABILITY,'native authored/mapped/output guard record budget exceeded');
    guards.push({axis:guardAxis,originalAuthoredU:authored.u,originalAuthoredV:authored.v,mappedOriginalU:mapped.u,mappedOriginalV:mapped.v,
      reversedU:output.u,reversedV:output.v,originalAtAuthoredKnot:d1(original,authored.u,authored.v),
      originalAtMappedParameters:d1(original,mapped.u,mapped.v),reversedAtReflectedParameters:d1(surface,output.u,output.v)});
  };
  for(const guard of first.result.report.guards) {
    const pair=pairs.find(value=>value.reversed===guard.reversedParameter);
    requireValue(pair!==undefined,CODE.NATIVE,'native Curve authored/reflected guard must have an actual mapped observation');
    for(const fixed of fixedParameters) addGuard(axis,coordinates(guard.originalParameter,fixed),coordinates(pair.original,fixed),coordinates(pair.reversed,fixed));
  }
  const otherDegree=other==='u'?original.degreeU:original.degreeV;
  for(const fixed of fixedParameters) if(fixed>domain[other][0]&&fixed<domain[other][1]
    &&otherKnots.filter(knot=>knot===fixed).length>=otherDegree) {
    for(const pair of pairs) addGuard(other,coordinates(pair.original,fixed),coordinates(pair.original,fixed),coordinates(pair.reversed,fixed));
  }
  const originalFile=sourceSurface(original,'surface_reverse_original'),file=sourceSurface(surface,surfaceId);
  const relative=(axisName:'u'|'v',observation:SurfaceAxisReversalObservation):number=>{
    const difference=axisName==='u'?observation.duDifferenceMM:observation.dvDifferenceMM;
    if(difference===null||observation.originalD1.status!=='evaluated') return 0;
    return difference/Math.max(1,Math.hypot(...(axisName==='u'?observation.originalD1.value.du:observation.originalD1.value.dv)));
  };
  const provenance:SurfaceAxisReversalProvenance={originalSurfaceId:original.id,outputSurfaceId:surfaceId,axis,domain,
    parameterMaps:{u:{orientation:axis==='u'?-1:1,d1Factor:axis==='u'?-1:1,formula:axis==='u'?'u=a+(b-s)':'u=s',domain:domain.u},
      v:{orientation:axis==='v'?-1:1,d1Factor:axis==='v'?-1:1,formula:axis==='v'?'v=a+(b-t)':'v=t',domain:domain.v}},strips,coefficients};
  const result:ReversedSurfaceAxisResult=copyCadData({original:originalFile.surface,options,surface:file.surface,source:file.source,sourceVersion:0,
    model:file.model,originalSource:originalFile.source,originalModel:originalFile.model,provenance,report:{
      family:'own-native-surface-parameter-axis-reversal',dto:{schema:'barocss-native-surface-axis-reversal',version:0,lengthUnit:'mm',frame:'authored-xyz-no-axis-conversion',representation:'native-surface-not-face-topology'},
      originalSurfaceId:original.id,surfaceId,axis,domain,grid:dimensions,stripCount:strips.length,observations,guards,
      maximumPointDifferenceMM:Math.max(...observations.map(value=>value.pointDifferenceMM)),
      maximumRelativeDuDifference:Math.max(0,...observations.map(value=>relative('u',value))),maximumRelativeDvDifference:Math.max(0,...observations.map(value=>relative('v',value))),
      geometricValidity:'not-certified',topologyCertified:false,solid:false,
      quality:{pointComparisonMM:POINT_TOLERANCE,relativeD1Comparison:D1_TOLERANCE,localObservationsOnly:true,globalShapeErrorCertified:false,manufacturingToleranceCertified:false,
        coefficientAndWeightBitsPreserved:true,nonselectedKnotBitsPreserved:true,generatedInteriorKnotBitsCertified:false,doubleReversalBitsCertified:false,
        derivativeSemantics:'authored-mapped-reflected-combined-d1-states-distinct-no-g1-g2-claim'},
      limits:{maximumDegree:3,maximumAxisPoles:16,maximumTotalPoles:256,maximumStrips:16,maximumObservations:128,maximumGuardRecords:256,
        inputValues:32768,inputDepth:8,inputArrayElements:64,inputRecordFields:16,snapshotValues:262144,snapshotDepth:32,arrayElements:4096,recordFields:64,
        sourceStringCharacters:262144,authoredIdCharacters:48,resultIdPrefixCharacters:20}}});
  return snapshot(result,true,CODE.OWNED) as ReversedSurfaceAxisResult;
}
/** Rebuild every actual native strip and mapped Surface observation; cached diagnostics are never authority. */
export function validateReversedSurfaceAxis(input:ReversedSurfaceAxisResult):ReversedSurfaceAxisReport {
  const owned=snapshot(input,true,CODE.OWNED) as ReversedSurfaceAxisResult;
  requireValue(owned!==null&&typeof owned==='object'&&!Array.isArray(owned),CODE.OWNED,'owned reversed Surface required');
  let expected:ReversedSurfaceAxisResult;
  try {expected=reverseSurfaceAxis(owned.original,owned.options);}
  catch(cause){throw new SurfaceAxisReversalError(CODE.OWNED,'owned original/options rebuild refused',cause);}
  requireValue(same(owned,expected),CODE.OWNED,'owned original/source/strips/coefficient bits/parameter maps/Surface D1/guard report mismatch');
  return copyCadData(expected.report);
}
