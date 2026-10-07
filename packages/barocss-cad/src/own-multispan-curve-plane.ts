import { validateCurve, curveDomain, evaluateCurve, evaluateSurface } from './math.js';
import { evaluateCurveD1 } from './derivatives.js';
import { splitCurveAtParameter } from './curve-parameter-split.js';
import type { CurveParameterSplitResult } from './curve-parameter-split.js';
import { intersectBezierCurveWithAffinePlaneSurface } from './own-curve-plane-intersection.js';
import type { BezierCurveAffinePlaneIntersectionResult, BezierCurvePlanePointEvent, CurveAffinePlaneAxes, CurvePlaneD1State } from './own-curve-plane-intersection.js';
import { compileCadModel } from './model-compiler.js';
import { curveDecimal } from './curve-source.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Surface, Model, Point } from './types.js';

export interface CurveAffinePlaneIntersectionOptions { evaluationId:string; derivedSpanIds:string[]; pointEventIds:string[] }
export interface CurveAffinePlaneSpan {
  spanId:string; spanIndex:number; domain:[number,number]; curve:Curve;
  intersection:BezierCurveAffinePlaneIntersectionResult; source:string; sourceVersion:0; model:Model;
}
export interface CurvePlaneSpanContribution {
  spanId:string; spanIndex:number; event:BezierCurvePlanePointEvent; childPointMM:Point; originalPointMM:Point;
  pointDifferenceMM:number; childCurveD1:CurvePlaneD1State; originalCurveD1:CurvePlaneD1State;
  derivativeComparison:{status:'compared';maximumAbsoluteDifference:number}|{status:'unavailable';reason:string};
}
export interface CurvePlaneSideObservation {
  spanId:string; spanIndex:number; side:'lower'|'upper'; parameter:number; pointMM:Point; childPointMM:Point; pointDifferenceMM:number; signedDistanceMM:number;
  originalCurveD1:CurvePlaneD1State; childCurveD1:CurvePlaneD1State;
}
export interface CurvePlanePointEvent {
  eventId:string; parameter:number; kind:'knot-event'|'span-root'|'endpoint'; pointMM:Point; planeUV:Point;
  planePointMM:Point|null; classification:'finite-domain-admitted'|'outside-domain'; finiteDomainAdmitted:boolean;
  residualMM:number; originalCurveD1:CurvePlaneD1State; contributions:CurvePlaneSpanContribution[];
  sideObservations:CurvePlaneSideObservation[];
}
export interface CurveAffinePlaneIntersectionReport {
  family:'own-multispan-curve-affine-plane-surface'; kind:CurveAffinePlaneIntersectionResult['kind']; evaluationId:string;
  curveId:string; planeId:string; curveDomain:[number,number]; curveDegree:1|2; planeAxes:CurveAffinePlaneAxes;
  spanCount:number; contributionCount:number; supportEventCount:number; finiteEventCount:number; outsideEventCount:number;
  coincidentSpans:{spanId:string;domain:[number,number];finiteContainment:'control-hull-contained'|'finite-containment-not-proven'}[];
  supportDisjointSpanIds:string[]; originalGuardedParameters:number[];
  authority:'original-complete-curve-coefficients'; geometricValidity:'not-certified'; topologyCertified:false; solid:false;
  numericPolicy:{parameterWidthTarget:1e-12;maximumRootSteps:64;pointBindingComparisonMM:1e-7;exactParameterDedupOnly:true;
    sideSampling:'represented-midpoint-between-event-and-nearest-span-root-or-boundary';uvBoundaryPolicy:'original-estimate-and-bracket-domain-agreement-no-clamp'};
  limits:{maximumOriginalPoles:12;maximumSpans:8;maximumTemporaryPoles:16;maximumContributions:32;maximumEvents:16;
    snapshotValues:131072;snapshotDepth:24;resultRecordFields:32;authoredIdCharacters:48};
}
export interface CurveAffinePlaneIntersectionResult {
  kind:'isolated'|'support-disjoint'|'finite-disjoint'|'coincident-spans'|'mixed'; curve:Curve;plane:Surface;
  options:CurveAffinePlaneIntersectionOptions;source:string;sourceVersion:0;model:Model;
  extraction:{parameter:number;result:CurveParameterSplitResult}[];spans:CurveAffinePlaneSpan[];events:CurvePlanePointEvent[];
  report:CurveAffinePlaneIntersectionReport;
}
const LABEL='Own multi-span Curve-plane intersection',TOL=1e-7;
function check(c:boolean,detail:string):asserts c {if(!c)throw new Error((LABEL+': '+detail).slice(0,1024));}
function finite(n:number):number {check(Number.isFinite(n),'finite native homogeneous/Gram arithmetic required');return n;}
function snapshot(input:unknown,results=false):unknown {
  let budget=results?131072:4096;const copy=(v:unknown,depth:number):unknown=>{check(--budget>=0&&depth<=(results?24:8),'own-data values/depth bound');if(v===null&&results)return null;if(typeof v==='number'){check(Number.isFinite(v),'finite own numbers');return v;}if(typeof v==='string'){check(v.length<=(results?262144:128),'bounded own string');return v;}if(typeof v==='boolean'&&results)return v;check(v!==null&&typeof v==='object','plain own data');const array=Array.isArray(v),proto=Object.getPrototypeOf(v),keys=Reflect.ownKeys(v),descriptors=Object.getOwnPropertyDescriptors(v);check(array?proto===Array.prototype:proto===Object.prototype||proto===null,'foreign own-data prototype');check(keys.length<=(array?(results?1025:65):(results?32:16))&&keys.every(k=>typeof k==='string'&&k.length<=128&&'value'in descriptors[k]&&(array&&k==='length'||descriptors[k].enumerable===true)),'getter/symbol/hidden/excess own data');if(array){const n=descriptors.length.value as number;check(Number.isInteger(n)&&n>=0&&n<=(results?1024:64)&&keys.length===n+1,'dense bounded own array');return Array.from({length:n},(_,i)=>{check(Object.hasOwn(descriptors,String(i)),'sparse own array');return copy(descriptors[String(i)].value,depth+1);});}return Object.fromEntries((keys as string[]).map(k=>[k,copy(descriptors[k].value,depth+1)]));};return copy(input,0);
}
function record(v:unknown,keys:string[]):Record<string,unknown>{check(v!==null&&typeof v==='object'&&!Array.isArray(v),'own record');const r=v as Record<string,unknown>;check(Object.keys(r).length===keys.length&&keys.every(k=>Object.hasOwn(r,k)),'exact fields required: '+keys.join(','));return r;}
function id(v:unknown):string {check(typeof v==='string'&&v.length<=48&&/^[A-Za-z_][A-Za-z0-9_-]*$/.test(v),'ASCII ID1..48 required');return v;}
function same(a:unknown,b:unknown):boolean {if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((x,i)=>same(x,b[i]));if(a&&b&&typeof a==='object'&&typeof b==='object'){const x=a as Record<string,unknown>,y=b as Record<string,unknown>;return Object.keys(x).length===Object.keys(y).length&&Object.keys(x).every(k=>Object.hasOwn(y,k)&&same(x[k],y[k]));}return Object.is(a,b);}
function delta(a:Point,b:Point):Point{return a.map((x,i)=>finite(x-b[i])) as Point;}
function dot(a:Point,b:Point):number{return finite(a.reduce((s,x,i)=>{const product=finite(x*b[i]);check(x===0||b[i]===0||product!==0,'nonzero native dot-product term underflowed to zero');return finite(s+product);},0));}
function mapParameter(d:[number,number],t:number):number {if(t===0)return d[0];if(t===1)return d[1];return finite(d[0]+(d[1]-d[0])*t);}
function inRectangle(uv:Point,axes:CurveAffinePlaneAxes):boolean{return uv[2]===0&&uv[0]>=axes.domains.u[0]&&uv[0]<=axes.domains.u[1]&&uv[1]>=axes.domains.v[0]&&uv[1]<=axes.domains.v[1];}
function uvOf(point:Point,axes:CurveAffinePlaneAxes):Point {
  const d=delta(point,axes.originMM),du=dot(d,axes.uDirectionMM),dv=dot(d,axes.vDirectionMM),g=axes.gram;
  const u=finite(finite(du*g.vv-dv*g.uv)/g.determinant),v=finite(finite(dv*g.uu-du*g.uv)/g.determinant);
  return[mapParameter(axes.domains.u,u),mapParameter(axes.domains.v,v),0];
}
function d1(curve:Curve,t:number):CurvePlaneD1State {try{return{status:'evaluated',value:evaluateCurveD1(curve,t)};}catch(e){return{status:'native-refused',reason:(e instanceof Error?e.message:'original native D1 refused').slice(0,1024)};}}
function adopt(curve:Curve,plane:Surface,evaluationId:string):{source:string;model:Model} {
  const dec=(n:number)=>curveDecimal(n,LABEL),list=(a:number[])=>'['+a.map(dec).join(',')+']',poles=(a:Point[])=>'['+a.map(list).join(',')+']';
  const source='@model '+evaluationId+' { version:0; length-unit:mm; @curve #'+curve.id+' { type:nurbs; degree:'+dec(curve.degree)+'; knots:'+list(curve.knots)+'; control-points:'+poles(curve.controlPoints)+'; weights:'+list(curve.weights)+'; } @surface #'+plane.id+' { type:nurbs; degree-u:1; degree-v:1; knots-u:'+list(plane.knotsU)+'; knots-v:'+list(plane.knotsV)+'; control-points:['+plane.controlPoints.map(poles).join(',')+']; weights:['+plane.weights.map(list).join(',')+']; } }\n';
  check(source.length<=262144,'actual geometry source bound');const compiled=compileCadModel(source,{sourceVersion:0});check(compiled.ok,'actual original Curve/Plane source0 compilation required');const expected:Model={name:evaluationId,version:0,lengthUnit:'mm',objects:[curve,plane]};check(same(compiled.model,expected),'actual full source0 Model original geometry/order/ID/domain/coefficient/sign adoption');return{source,model:compiled.model};
}

function derivativeComparison(original:CurvePlaneD1State,child:CurvePlaneD1State):CurvePlaneSpanContribution['derivativeComparison'] {
  if(original.status!=='evaluated'||child.status!=='evaluated')return{status:'unavailable',reason:'actual original or child native D1 refused'};
  const difference=Math.max(...original.value.derivative.map((value,i)=>Math.abs(value-child.value.derivative[i])));
  return Number.isFinite(difference)?{status:'compared',maximumAbsoluteDifference:difference}:{status:'unavailable',reason:'original/child native D1 difference arithmetic is not finite'};
}
/** Actual knot splits and actual Bezier intersections; the whole original Curve remains authority. */
export function intersectCurveWithAffinePlaneSurface(curveInput:Curve,planeInput:Surface,inputOptions:CurveAffinePlaneIntersectionOptions):CurveAffinePlaneIntersectionResult {
  // Snapshot all caller data before any native validator or derived operation.
  const curveData=snapshot(curveInput),planeData=snapshot(planeInput),optionData=snapshot(inputOptions);
  const c=record(curveData,['kind','id','degree','knots','controlPoints','weights']) as unknown as Curve;
  const p=record(planeData,['kind','id','degreeU','degreeV','knotsU','knotsV','controlPoints','weights']) as unknown as Surface;
  check(c.kind==='curve'&&(c.degree===1||c.degree===2),'original degree1/2 Curve required');id(c.id);id(p.id);
  validateCurve(c);check(c.controlPoints.length<=12,'original poles exceed12');
  const domain=curveDomain(c),breaks:number[]=[domain[0]];
  for(const knot of c.knots)if(knot>domain[0]&&knot<domain[1]&&!breaks.some(value=>value===knot))breaks.push(knot);
  breaks.push(domain[1]);check(breaks.length>=2&&breaks.length<=9,'1..8 nonzero original spans required');
  for(let i=1;i<breaks.length;i++)check(Number.isFinite(breaks[i]-breaks[i-1])&&breaks[i]>breaks[i-1],'positive represented original span required');
  const o=record(optionData,['evaluationId','derivedSpanIds','pointEventIds']);
  check(Array.isArray(o.derivedSpanIds)&&o.derivedSpanIds.length===breaks.length-1,'one explicit derived-span ID per original span required');
  check(Array.isArray(o.pointEventIds)&&o.pointEventIds.length>=1&&o.pointEventIds.length<=16,'1..16 explicit point-event IDs required');
  const options:CurveAffinePlaneIntersectionOptions={evaluationId:id(o.evaluationId),derivedSpanIds:o.derivedSpanIds.map(id),pointEventIds:o.pointEventIds.map(id)};
  const authored=[c.id,p.id,options.evaluationId,...options.derivedSpanIds,...options.pointEventIds],reserved=new Set(authored);
  check(reserved.size===authored.length,'original/evaluation/span/event identities must be distinct');
  let serial=0;
  const temporary=():string=>{let candidate:string;do{check(++serial<=256,'bounded temporary identity allocation exceeded');candidate='__multispan_tmp_'+serial;}while(reserved.has(candidate));reserved.add(candidate);return candidate;};
  const extraction:CurveAffinePlaneIntersectionResult['extraction']=[],children:Curve[]=[];
  let rest=copyCadData(c);
  for(let i=1;i<breaks.length-1;i++){
    const result=splitCurveAtParameter(rest,{parameter:breaks[i],lowerCurveId:temporary(),upperCurveId:temporary()});
    check(result.refined.controlPoints.length<=16,'inherited temporary pole bound exceeded');
    extraction.push({parameter:breaks[i],result});children.push(result.lower);rest=result.upper;
  }
  children.push(rest);
  const spans:CurveAffinePlaneSpan[]=children.map((child,index)=>{
    const curve=copyCadData(child);curve.id=options.derivedSpanIds[index];
    const intersection=intersectBezierCurveWithAffinePlaneSurface(curve,p,{evaluationId:temporary(),pointEventIds:[temporary(),temporary()]});
    check(same(curveDomain(curve),[breaks[index],breaks[index+1]]),'derived span must retain represented original domain bits');
    return{spanId:curve.id,spanIndex:index,domain:curveDomain(curve),curve:intersection.curve,intersection,source:intersection.source,sourceVersion:0,model:intersection.model};
  });
  const axes=spans[0].intersection.report.planeAxes;
  check(spans.every(span=>same(span.intersection.report.planeAxes,axes)),'all spans must bind the same original Plane axes');
  const groups:{parameter:number;contributions:CurvePlaneSpanContribution[]}[]=[];
  let contributionCount=0;
  for(const span of spans)for(const event of span.intersection.events){
    check(++contributionCount<=32,'native event contribution capacity exceeded');
    const boundary=breaks.find(value=>value===event.parameter),parameter=boundary===undefined?event.parameter:boundary;
    const originalPointMM=evaluateCurve(c,parameter),pointDifferenceMM=finite(Math.hypot(...delta(originalPointMM,event.pointMM)));
    check(pointDifferenceMM<=TOL,'original/extracted Curve event point difference exceeds local policy');
    const originalCurveD1=d1(c,parameter),contribution:CurvePlaneSpanContribution={spanId:span.spanId,spanIndex:span.spanIndex,event,childPointMM:event.pointMM,originalPointMM,pointDifferenceMM,childCurveD1:event.curveD1,originalCurveD1,derivativeComparison:derivativeComparison(originalCurveD1,event.curveD1)};
    let group=groups.find(item=>item.parameter===parameter);
    if(!group){group={parameter,contributions:[]};groups.push(group);}group.contributions.push(contribution);
  }
  groups.sort((a,b)=>a.parameter<b.parameter?-1:a.parameter>b.parameter?1:0);
  check(groups.length<=16&&groups.length<=options.pointEventIds.length,'consolidated explicit event capacity exceeded');
  const events:CurvePlanePointEvent[]=groups.map((group,index)=>{
    const parameter=group.parameter,pointMM=evaluateCurve(c,parameter),planeUV=uvOf(pointMM,axes),residualMM=Math.abs(dot(axes.unitNormal,delta(pointMM,axes.originMM)));
    check(residualMM<=TOL,'actual original complete Curve support residual exceeds local policy');
    // Apply the inherited UV bracket policy to actual whole-Curve values as well.
    const sampleParameters:number[]=[parameter];
    for(const contribution of group.contributions)for(const t of contribution.event.bracket)if(!sampleParameters.some(value=>value===t))sampleParameters.push(t);
    const samples=sampleParameters.map(t=>uvOf(evaluateCurve(c,t),axes)),inside=samples.every(uv=>inRectangle(uv,axes));
    const outside=samples.every(uv=>uv[0]<axes.domains.u[0])||samples.every(uv=>uv[0]>axes.domains.u[1])||samples.every(uv=>uv[1]<axes.domains.v[0])||samples.every(uv=>uv[1]>axes.domains.v[1]);
    check(inside||outside,'original finite UV classification unresolved across contribution brackets');
    const planePointMM=inside?evaluateSurface(p,planeUV[0],planeUV[1]):null;
    if(planePointMM!==null)check(finite(Math.hypot(...delta(pointMM,planePointMM)))<=TOL,'actual original Curve/Plane UV binding exceeds local policy');
    const sideObservations:CurvePlaneSideObservation[]=[];
    // At a shared knot use actual samples inside each neighboring native span.
    // Other roots bound each sample interval; no epsilon or extrapolation is used.
    for(const span of spans){
      if(parameter<span.domain[0]||parameter>span.domain[1])continue;
      for(const side of ['lower','upper'] as const){
        if(side==='lower'&&parameter===span.domain[0]||side==='upper'&&parameter===span.domain[1])continue;
        const neighbors=span.intersection.events.map(event=>event.parameter);
        const boundary=side==='lower'?Math.max(span.domain[0],...neighbors.filter(t=>t<parameter)):Math.min(span.domain[1],...neighbors.filter(t=>t>parameter));
        const low=Math.min(parameter,boundary),high=Math.max(parameter,boundary),t=finite(low+finite(high-low)/2);
        check(t>low&&t<high,'one-sided native interval has no represented midpoint');
        const point=evaluateCurve(c,t),childPoint=evaluateCurve(span.curve,t);
        check(finite(Math.hypot(...delta(point,childPoint)))<=TOL,'original/extracted one-sided point difference exceeds local policy');
        sideObservations.push({spanId:span.spanId,spanIndex:span.spanIndex,side,parameter:t,pointMM:point,childPointMM:childPoint,pointDifferenceMM:finite(Math.hypot(...delta(point,childPoint))),signedDistanceMM:dot(axes.unitNormal,delta(point,axes.originMM)),originalCurveD1:d1(c,t),childCurveD1:d1(span.curve,t)});
      }
    }
    const internal=breaks.slice(1,-1).some(value=>value===parameter);
    return{eventId:options.pointEventIds[index],parameter,kind:internal?'knot-event':parameter===domain[0]||parameter===domain[1]?'endpoint':'span-root',pointMM,planeUV,planePointMM,classification:inside?'finite-domain-admitted':'outside-domain',finiteDomainAdmitted:inside,residualMM,originalCurveD1:d1(c,parameter),contributions:group.contributions,sideObservations};
  });
  const coincidentSpans:CurveAffinePlaneIntersectionReport['coincidentSpans']=spans.filter(span=>span.intersection.report.coincident.support).map(span=>({spanId:span.spanId,domain:span.domain,finiteContainment:span.intersection.report.coincident.finiteContainment==='control-hull-contained'?'control-hull-contained':'finite-containment-not-proven'}));
  const finiteCount=events.filter(event=>event.finiteDomainAdmitted).length;
  const kind:CurveAffinePlaneIntersectionResult['kind']=coincidentSpans.length?coincidentSpans.length===spans.length?'coincident-spans':'mixed':events.length===0?'support-disjoint':finiteCount?'isolated':'finite-disjoint';
  const file=adopt(c,p,options.evaluationId),originalGuardedParameters=breaks.slice(1,-1).filter(value=>c.knots.filter(knot=>knot===value).length>=c.degree);
  return copyCadData({kind,curve:file.model.objects[0] as Curve,plane:file.model.objects[1] as Surface,options,...file,sourceVersion:0,extraction,spans,events,report:{family:'own-multispan-curve-affine-plane-surface',kind,evaluationId:options.evaluationId,curveId:c.id,planeId:p.id,curveDomain:domain,curveDegree:c.degree,planeAxes:axes,spanCount:spans.length,contributionCount,supportEventCount:events.length,finiteEventCount:finiteCount,outsideEventCount:events.length-finiteCount,coincidentSpans,supportDisjointSpanIds:spans.filter(span=>span.intersection.kind==='support-disjoint').map(span=>span.spanId),originalGuardedParameters,authority:'original-complete-curve-coefficients',geometricValidity:'not-certified',topologyCertified:false,solid:false,numericPolicy:{parameterWidthTarget:1e-12,maximumRootSteps:64,pointBindingComparisonMM:TOL,exactParameterDedupOnly:true,sideSampling:'represented-midpoint-between-event-and-nearest-span-root-or-boundary',uvBoundaryPolicy:'original-estimate-and-bracket-domain-agreement-no-clamp'},limits:{maximumOriginalPoles:12,maximumSpans:8,maximumTemporaryPoles:16,maximumContributions:32,maximumEvents:16,snapshotValues:131072,snapshotDepth:24,resultRecordFields:32,authoredIdCharacters:48}}});
}
/** Rebuild from owned original coefficients/options, including all extraction and contribution data. */
export function validateCurveAffinePlaneIntersection(input:CurveAffinePlaneIntersectionResult):CurveAffinePlaneIntersectionReport {
  const owned=snapshot(input,true) as CurveAffinePlaneIntersectionResult;
  check(owned!==null&&typeof owned==='object'&&!Array.isArray(owned),'owned multiple-span Curve-plane result required');
  const expected=intersectCurveWithAffinePlaneSurface(owned.curve,owned.plane,owned.options);
  check(same(owned,expected),'owned original geometry/extraction/contributions/UV/source/report mismatch');
  return copyCadData(expected.report);
}
