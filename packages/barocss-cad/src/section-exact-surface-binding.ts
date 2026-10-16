import { evaluateCurve, evaluateSurface, validateCurve } from './math.js';
import { evaluateCurveD1, evaluateSurfaceD1 } from './derivatives.js';
import type { CurveD1Result, SurfaceD1Result } from './derivatives.js';
import { validateMultiSpanVLinearSurfacePlaneSection } from './multispan-vlinear-plane-section.js';
import type { MultiSpanVLinearSurfacePlaneSectionResult } from './multispan-vlinear-plane-section.js';
import { SectionRationalContext } from './section-rational-internal.js';
import type { SectionFraction, SectionRational } from './section-rational-internal.js';
import type { Curve, Point } from './types.js';
import { same } from './structural-equality.js';

export const SectionExactSurfaceBindingDiagnosticCode = Object.freeze({ INPUT:'INPUT', IDENTITY:'IDENTITY', BUDGET:'BUDGET', SECTION:'SECTION', SUPPORT:'SUPPORT', REPRESENTABILITY:'REPRESENTABILITY', BINDING:'BINDING', NATIVE:'NATIVE', OWNED:'OWNED' } as const);
export type SectionExactSurfaceBindingDiagnosticCode = typeof SectionExactSurfaceBindingDiagnosticCode[keyof typeof SectionExactSurfaceBindingDiagnosticCode];
export class SectionExactSurfaceBindingError extends Error {
 readonly code:SectionExactSurfaceBindingDiagnosticCode;
 constructor(code:SectionExactSurfaceBindingDiagnosticCode,detail:string,cause?:unknown) { super(('Exact section Surface binding: '+detail).slice(0,1024),cause===undefined?undefined:{cause});this.name='SectionExactSurfaceBindingError';this.code=code; }
}
export interface SectionExactSurfaceBindingOptions { evaluationId:string; pcurveId:string; maximumObservations:17 }
type Bound={exact:SectionFraction;upper:number};
type D1<T>={status:'evaluated';value:T}|{status:'native-refused';reason:string;nativeErrorName:string};
export interface SectionExactSurfaceBindingSpanProof {
 index:number;domain:[number,number];originalPoleIndices:number[];worldPoleIndices:number[];pcurvePoleIndices:number[];
 uniformSurfaceWeight:SectionFraction;constantDenominator:SectionFraction;degree:number;
 uCoefficients:SectionFraction[];vCoefficients:SectionFraction[];betaCoefficients:SectionFraction[];
 originalCartesian:SectionFraction[][][];storedWorldCartesian:SectionFraction[][];composedCartesian:SectionFraction[][];elevatedWorldCartesian:SectionFraction[][];residuals:SectionFraction[][];
}
type Certificate={schema:'barocss-exact-vlinear-section-surface-binding';version:0;surfaceSourceId:string;surfaceId:string;worldCurveId:string;pcurveId:string;evaluationId:string;surfaceDomains:MultiSpanVLinearSurfacePlaneSectionResult['report']['surfaceDomains'];spanCount:number;authority:'exact-stored-coefficients-and-original-source';exactWorldSurfaceAgreement:true;wholeCoefficientModelGap:Bound;inheritedWorldSurfaceBound:Bound};
type Observation={index:number;parameter:number;world:{d0:Point;d1:D1<CurveD1Result>};pcurve:{d0:Point;d1:D1<CurveD1Result>};surface:{d0:Point;d1:D1<SurfaceD1Result>};surfaceChain:Point|null;residuals:{worldToSurfaceMM:number;d0ToD1Point:(number|null)[];surfaceChainRelative:number|null}};
export interface SectionExactSurfaceBindingReport {
 schema:'barocss-section-exact-surface-binding';version:0;evaluationId:string;surfaceSourceId:string;surfaceId:string;worldCurveId:string;pcurveId:string;
 lengthUnit:'mm';uvLengthUnit:'dimensionless';sourceFrame:'authored-xyz-no-axis-conversion';parameterFrame:'original-native-u-v-domains';
 spanCount:number;pcurveDegree:2;pcurvePoleCount:number;wholeCoefficientModelGap:Bound;inheritedWorldSurfaceBound:Bound;maximumObservedPointGapMM:number;maximumObservedRelativeChainGap:number;
 derivativeCounts:Record<'world'|'pcurve'|'surface',{evaluated:number;refused:number}>;rationalCounts:ReturnType<SectionRationalContext['counts']>;
 directCounts:{sectionValidationCount:1;uvNativeValidationCount:1;sourceCompilationCount:0;observationCount:number;curvePointEvaluationCount:number;curveDerivativeEvaluationCount:number;surfacePointEvaluationCount:number;surfaceDerivativeEvaluationCount:number};
 numericPolicy:{generatedCoefficients:'exact-binary64-no-rounded-admission';positionAdmission:'all-stored-world-surface-coefficient-residuals-zero';observationAuthority:'local-native-values-separate-from-whole-model-proof';pointComparisonMM:1e-7;relativeChainComparison:1e-7};
 quality:{exactWorldSurfaceAgreement:true;originalBitsPreserved:true;surfaceEmbeddingCertified:false;trimFaceCertified:false;bodyCertified:false;manifoldCertified:false;solid:false;outwardSolidOrientationCertified:false;booleanCertified:false;globalBinary64EvaluationErrorCertified:false;manufacturingToleranceCertified:false;parentProofsUnchanged:true;ownership:'independent-copied-cpu-data-gc'};
 limits:{maximumSpans:4;maximumUDegree:2;pcurveDegree:2;maximumPcurvePoles:9;maximumComposedDegree:4;maximumObservations:17;rationalOperations:200000;gcdSteps:200000;rationalIntegerBits:8192;fractionIntegerCharacters:5000;ownValues:1048576;ownDepth:64;arrayElements:8192;recordFields:64;sourceStringCharacters:262144};
 workScope:'direct-root-calls-and-arithmetic-parent-internal-work-retained-and-excluded';budgetFailure:'atomic-no-partial-binding';
}
export interface SectionExactSurfaceBindingResult {section:MultiSpanVLinearSurfacePlaneSectionResult;options:SectionExactSurfaceBindingOptions;pcurve:{coordinateSystem:'native-surface-uv';lengthUnit:'dimensionless';curve:Curve};proof:{spans:SectionExactSurfaceBindingSpanProof[];certificate:Certificate};observations:Observation[];report:SectionExactSurfaceBindingReport}
const CODE=SectionExactSurfaceBindingDiagnosticCode;
function check(condition:boolean,code:SectionExactSurfaceBindingDiagnosticCode,detail:string):asserts condition {if(!condition)throw new SectionExactSurfaceBindingError(code,detail)}
function native<T>(action:()=>T,detail:string,code:SectionExactSurfaceBindingDiagnosticCode=CODE.NATIVE):T {try{return action()}catch(cause){throw new SectionExactSurfaceBindingError(code,detail,cause)}}
function record(input: unknown, fields: string[], code: SectionExactSurfaceBindingDiagnosticCode = CODE.INPUT): Record<string, unknown> {
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
  try { return copy(input, 0); } catch (cause) { if (cause instanceof SectionExactSurfaceBindingError) throw cause; throw new SectionExactSurfaceBindingError(code, 'Own snapshot failed', cause); }
}
/** Collect complete copied source/model/topology/child identity contexts, including split helper receipts. */
function contexts(input: unknown): Set<string> {
  const result = new Set<string>(); const visit = (value: unknown, key = ''): void => {
    if (typeof value === 'string') { if (key === 'id' || key === 'name' || /Ids?$/.test(key) || key === 'resultIdPrefix') result.add(value); return; }
    if (Array.isArray(value)) { value.forEach(item => visit(item, key)); return; }
    if (value && typeof value === 'object') for (const [field, item] of Object.entries(value)) visit(item, field);
  }; visit(input); return result;
}


function finite(value:number):number {check(Number.isFinite(value),CODE.BINDING,'Finite native comparison arithmetic required');return value}
function gap(a:Point,b:Point):number{return finite(Math.hypot(...a.map((v,i)=>finite(v-b[i]))))}
/** Build a real degree2 UV Curve and certify its exact original-Surface position binding. */
export function buildSectionExactSurfaceBinding(sectionInput:MultiSpanVLinearSurfacePlaneSectionResult,optionsInput:SectionExactSurfaceBindingOptions):SectionExactSurfaceBindingResult {
 const data=record(snapshot({section:sectionInput,options:optionsInput}),['section','options']),settings=record(data.options,['evaluationId','pcurveId','maximumObservations']);
 const options:SectionExactSurfaceBindingOptions={evaluationId:id(settings.evaluationId),pcurveId:id(settings.pcurveId),maximumObservations:settings.maximumObservations as 17};
 check(options.maximumObservations===17,CODE.BUDGET,'The complete fixed observation budget17 is required before parent work');
 const section=data.section as MultiSpanVLinearSurfacePlaneSectionResult;
 native(()=>validateMultiSpanVLinearSurfacePlaneSection(section),'Actual complete parent section validation refused',CODE.SECTION);
 const reserved=contexts(section);check(options.evaluationId!==options.pcurveId&&[options.evaluationId,options.pcurveId].every(value=>!reserved.has(value)),CODE.IDENTITY,'New IDs must differ from all complete original/section/child identities');
 const surface=section.surfaceAsset.surface,p=surface.degreeU,n=section.report.spanCount,world=section.world.curve,C=surface.weights[0][0];
 check(p>=1&&p<=2&&surface.degreeV===1&&n>=1&&n<=4&&C>0&&surface.weights.every(row=>row.every(w=>Object.is(w,C))),CODE.SUPPORT,'Global identical positive original Surface weight bits and admitted degree/span profile are required');
 const q=new SectionRationalContext((kind,detail)=>{throw new SectionExactSurfaceBindingError(CODE[kind],detail)}),zero=q.integer(0),two=q.integer(2),read=(v:SectionFraction)=>q.rat(BigInt(v.numerator),BigInt(v.denominator)),text=(v:SectionRational[])=>v.map(x=>q.text(x)),eq=(a:SectionRational,b:SectionRational)=>a.n===b.n&&a.d===b.d;
 const vDomain=section.report.surfaceDomains.v,v0=q.from(vDomain[0]),v1=q.from(vDomain[1]),dv=q.sub(v1,v0);
 const choose=(d:number,i:number)=>{let value=1;for(let j=1;j<=i;j++)value=value*(d-j+1)/j;return value};
 const product=(a:SectionRational[],b:SectionRational[])=>{const m=a.length-1,k=b.length-1;check(m+k<=4,CODE.BINDING,'Exact Bernstein product must fit degree4');return Array.from({length:m+k+1},(_,j)=>q.sum(a.flatMap((v,i)=>{const z=j-i;return z<0||z>k?[]:[q.mul(q.div(q.integer(choose(m,i)*choose(k,z)),q.integer(choose(m+k,j))),q.mul(v,b[z]))]})))};
 const elevate=(input:SectionRational[],degree:number)=>{let result=input.slice();check(result.length-1<=degree&&degree<=4,CODE.BINDING,'Exact elevation must fit degree4');while(result.length-1<degree){const d=result.length;result=Array.from({length:d+1},(_,i)=>i===0?result[0]:i===d?result[d-1]:q.add(q.mul(q.div(q.integer(i),q.integer(d)),result[i-1]),q.mul(q.div(q.integer(d-i),q.integer(d)),result[i])))}return result};
 const controlPoints:Point[]=[],spans:SectionExactSurfaceBindingSpanProof[]=[];
 for(const span of section.proof.spans){
  const D=read(span.columns[0].denominator);
  check(q.compare(D,zero)>0&&span.columns.length===p+1&&span.columns.every(column=>eq(read(column.denominator),D)&&eq(q.sub(read(column.f1),read(column.f0)),D)),CODE.SUPPORT,'Each actual span requires an exact strictly positive constant section denominator');
  const localV=elevate(span.columns.map(column=>q.add(v0,q.mul(dv,q.div(q.neg(read(column.f0)),D)))),2);
  const a=q.from(span.domain[0]),b=q.from(span.domain[1]),u=[a,q.div(q.add(a,b),two),b];
  const localPoints:Point[]=localV.map((value,i)=>{check(q.compare(value,v0)>0&&q.compare(value,v1)<0,CODE.BINDING,'Every generated V control must be strictly inside the original chart');return [i===0?span.domain[0]:i===2?span.domain[1]:q.exactFloat(u[i]),q.exactFloat(value),0]});
  check(localPoints[1][0]>span.domain[0]&&localPoints[1][0]<span.domain[1],CODE.REPRESENTABILITY,'A distinct exactly represented U midpoint is required');
  if(span.index>0)check(same(controlPoints.at(-1),localPoints[0]),CODE.REPRESENTABILITY,'Adjacent exact generated UV endpoint bits must match');
  controlPoints.push(...localPoints.slice(span.index===0?0:1));
  const pcurvePoleIndices=[2*span.index,2*span.index+1,2*span.index+2];
  const storedUV=pcurvePoleIndices.map(i=>controlPoints[i]),storedU=storedUV.map(point=>q.from(point[0])),storedV=storedUV.map(point=>q.from(point[1]));
  check(storedU.every((value,i)=>eq(value,u[i])),CODE.BINDING,'Actual stored U coefficients must equal the exact original linear parameter map');
  const beta=storedV.map(value=>q.div(q.sub(value,v0),dv)),original=span.originalPoleIndices.map(i=>surface.controlPoints[i].map(point=>point.map(v=>q.from(v))));
  check(original.length===p+1&&world.degree<=p+2&&span.worldPoleIndices.length===world.degree+1,CODE.BINDING,'Actual original and unchanged stored World span degrees/receipts must agree');
  const worldWeights=span.worldPoleIndices.map(i=>q.from(world.weights[i]));
  check(worldWeights.every(w=>q.compare(w,zero)>0&&eq(w,worldWeights[0])),CODE.SUPPORT,'Unchanged stored World weights must be exact positive constants within each span');
  const storedWorld=span.worldPoleIndices.map(i=>world.controlPoints[i].map(v=>q.from(v))),degree=p+2;
  const composedByAxis=[0,1,2].map(axis=>{const first=original.map(row=>row[0][axis]),delta=original.map(row=>q.sub(row[1][axis],row[0][axis])),base=elevate(first,degree),term=product(delta,beta);return base.map((value,i)=>q.add(value,term[i]))});
  const worldByAxis=[0,1,2].map(axis=>elevate(storedWorld.map(row=>row[axis]),degree));
  const composed=Array.from({length:degree+1},(_,i)=>composedByAxis.map(axis=>axis[i])),elevatedWorld=Array.from({length:degree+1},(_,i)=>worldByAxis.map(axis=>axis[i])),residuals=elevatedWorld.map((row,i)=>row.map((value,axis)=>q.sub(value,composed[i][axis])));
  check(residuals.every(row=>row.every(value=>value.n===0n)),CODE.REPRESENTABILITY,'Every independently composed original-Surface coefficient must equal the unchanged STORED World coefficient exactly');
  spans.push({index:span.index,domain:span.domain,originalPoleIndices:span.originalPoleIndices,worldPoleIndices:span.worldPoleIndices,pcurvePoleIndices,uniformSurfaceWeight:q.text(q.from(C)),constantDenominator:q.text(D),degree,uCoefficients:text(storedU),vCoefficients:text(storedV),betaCoefficients:text(beta),originalCartesian:original.map(row=>row.map(text)),storedWorldCartesian:storedWorld.map(text),composedCartesian:composed.map(text),elevatedWorldCartesian:elevatedWorld.map(text),residuals:residuals.map(text)});
 }
 const knots=[...Array(3).fill(spans[0].domain[0]),...spans.slice(1).flatMap(span=>[span.domain[0],span.domain[0]]),...Array(3).fill(spans.at(-1)!.domain[1])],curve:Curve={kind:'curve',id:options.pcurveId,degree:2,knots,controlPoints,weights:controlPoints.map(()=>1)};
 native(()=>validateCurve(curve),'Actual new degree2 dimensionless UV Curve validation refused');
 const pcurve={coordinateSystem:'native-surface-uv' as const,lengthUnit:'dimensionless' as const,curve},wholeCoefficientModelGap=q.bound(zero),inheritedWorldSurfaceBound=section.proof.bounds.worldToSurface;
 const certificate:Certificate={schema:'barocss-exact-vlinear-section-surface-binding',version:0,surfaceSourceId:section.surfaceAsset.sourceId,surfaceId:surface.id,worldCurveId:world.id,pcurveId:curve.id,evaluationId:options.evaluationId,surfaceDomains:section.report.surfaceDomains,spanCount:n,authority:'exact-stored-coefficients-and-original-source',exactWorldSurfaceAgreement:true,wholeCoefficientModelGap,inheritedWorldSurfaceBound};
 const derivativeCounts:SectionExactSurfaceBindingReport['derivativeCounts']={world:{evaluated:0,refused:0},pcurve:{evaluated:0,refused:0},surface:{evaluated:0,refused:0}};
 const d1=<T>(key:keyof typeof derivativeCounts,action:()=>T):D1<T>=>{try{const value=action();derivativeCounts[key].evaluated++;return {status:'evaluated',value}}catch(cause){if(!(cause instanceof Error)||!/exact C0 interior knot/.test(cause.message))throw new SectionExactSurfaceBindingError(CODE.NATIVE,'Actual native D1 refused for '+key,cause);derivativeCounts[key].refused++;return {status:'native-refused',reason:cause.message,nativeErrorName:cause.name}}};
 const observations:Observation[]=section.observations.map(({parameter},index)=>{
  const w={d0:native(()=>evaluateCurve(world,parameter),'Unchanged World D0 refused'),d1:d1('world',()=>evaluateCurveD1(world,parameter))},uv={d0:native(()=>evaluateCurve(curve,parameter),'New SurfaceUV D0 refused'),d1:d1('pcurve',()=>evaluateCurveD1(curve,parameter))},s={d0:native(()=>evaluateSurface(surface,uv.d0[0],uv.d0[1]),'Original Surface D0 refused'),d1:d1('surface',()=>evaluateSurfaceD1(surface,uv.d0[0],uv.d0[1]))};
  let surfaceChain:Point|null=null;if(s.d1.status==='evaluated'&&uv.d1.status==='evaluated'){const ds=s.d1.value,dt=uv.d1.value;surfaceChain=ds.du.map((v,k)=>finite(finite(v*dt.derivative[0])+finite(ds.dv[k]*dt.derivative[1]))) as Point}
  const pointGap=<T extends {point:Point}>(point:Point,state:D1<T>)=>state.status==='evaluated'?gap(point,state.value.point):null,residuals={worldToSurfaceMM:gap(w.d0,s.d0),d0ToD1Point:[pointGap(w.d0,w.d1),pointGap(uv.d0,uv.d1),pointGap(s.d0,s.d1)],surfaceChainRelative:w.d1.status==='evaluated'&&surfaceChain?finite(gap(w.d1.value.derivative,surfaceChain)/Math.max(1,finite(Math.hypot(...w.d1.value.derivative)))):null};
  check([residuals.worldToSurfaceMM,...residuals.d0ToD1Point,residuals.surfaceChainRelative].every(value=>value===null||value<=1e-7),CODE.BINDING,'Actual available native point and chain comparisons exceed limits');return {index,parameter,world:w,pcurve:uv,surface:s,surfaceChain,residuals};
 });
 check(observations.length===4*n+1&&observations.length<=options.maximumObservations,CODE.BINDING,'Complete original-span quartile observations must fit17');
 const report:SectionExactSurfaceBindingReport={schema:'barocss-section-exact-surface-binding',version:0,evaluationId:options.evaluationId,surfaceSourceId:section.surfaceAsset.sourceId,surfaceId:surface.id,worldCurveId:world.id,pcurveId:curve.id,lengthUnit:'mm',uvLengthUnit:'dimensionless',sourceFrame:'authored-xyz-no-axis-conversion',parameterFrame:'original-native-u-v-domains',spanCount:n,pcurveDegree:2,pcurvePoleCount:controlPoints.length,wholeCoefficientModelGap,inheritedWorldSurfaceBound,maximumObservedPointGapMM:Math.max(...observations.map(o=>o.residuals.worldToSurfaceMM)),maximumObservedRelativeChainGap:Math.max(...observations.map(o=>o.residuals.surfaceChainRelative??0)),derivativeCounts,rationalCounts:q.counts(),directCounts:{sectionValidationCount:1,uvNativeValidationCount:1,sourceCompilationCount:0,observationCount:observations.length,curvePointEvaluationCount:2*observations.length,curveDerivativeEvaluationCount:2*observations.length,surfacePointEvaluationCount:observations.length,surfaceDerivativeEvaluationCount:observations.length},numericPolicy:{generatedCoefficients:'exact-binary64-no-rounded-admission',positionAdmission:'all-stored-world-surface-coefficient-residuals-zero',observationAuthority:'local-native-values-separate-from-whole-model-proof',pointComparisonMM:1e-7,relativeChainComparison:1e-7},quality:{exactWorldSurfaceAgreement:true,originalBitsPreserved:true,surfaceEmbeddingCertified:false,trimFaceCertified:false,bodyCertified:false,manifoldCertified:false,solid:false,outwardSolidOrientationCertified:false,booleanCertified:false,globalBinary64EvaluationErrorCertified:false,manufacturingToleranceCertified:false,parentProofsUnchanged:true,ownership:'independent-copied-cpu-data-gc'},limits:{maximumSpans:4,maximumUDegree:2,pcurveDegree:2,maximumPcurvePoles:9,maximumComposedDegree:4,maximumObservations:17,rationalOperations:200000,gcdSteps:200000,rationalIntegerBits:8192,fractionIntegerCharacters:5000,ownValues:1048576,ownDepth:64,arrayElements:8192,recordFields:64,sourceStringCharacters:262144},workScope:'direct-root-calls-and-arithmetic-parent-internal-work-retained-and-excluded',budgetFailure:'atomic-no-partial-binding'};
 return snapshot({section,options,pcurve,proof:{spans,certificate},observations,report},true) as SectionExactSurfaceBindingResult;
}
/** Rebuild the complete parent, real new UV, exact coefficient certificate and all native observations. */
export function validateSectionExactSurfaceBinding(input:SectionExactSurfaceBindingResult):SectionExactSurfaceBindingReport {
 const owned=record(snapshot(input,true),['section','options','pcurve','proof','observations','report'],CODE.OWNED) as unknown as SectionExactSurfaceBindingResult;
 let expected:SectionExactSurfaceBindingResult;try{expected=buildSectionExactSurfaceBinding(owned.section,owned.options)}catch(cause){throw new SectionExactSurfaceBindingError(CODE.OWNED,'Whole exact Surface binding reconstruction refused',cause)}
 check(same(owned,expected),CODE.OWNED,'Owned original source/World/newUV/coefficient proof/native observations/counters changed');return snapshot(expected.report,true) as SectionExactSurfaceBindingReport;
}
