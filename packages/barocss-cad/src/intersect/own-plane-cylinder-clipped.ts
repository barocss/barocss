import { CadNumericPolicy } from '../numeric-policy.js';
import { createHomogeneousBernsteinEquation, solveHomogeneousBernsteinEquation } from './own-homogeneous-bernstein-roots.js';
import type { HomogeneousBernsteinRoot } from './own-homogeneous-bernstein-roots.js';
import { constructPlaneCylinderCandidate, constructPlaneCylinderBindings, same, adopt } from './own-plane-cylinder-intersection-internal.js';
import type { OwnPlaneCylinderCandidate } from './own-plane-cylinder-intersection-internal.js';
import type { XYCirclePrismShellBundle } from '../xy-circle-prism-shell.js';
import type { XYCirclePrismPlaneIntersectionOptions, XYCirclePrismPlaneBindings, PlaneCylinderHomogeneousSpan, PlaneCylinderIntersectionObservation, PlaneCylinderCurveD1State, PlaneCylinderSurfaceD1State } from './own-plane-cylinder-intersection.js';
import { splitCurveAtParameter } from '../nurbs/curves/curve-parameter-split.js';
import { evaluateCurve, evaluateSurface, curveDomain, surfaceDomain } from '../core/math.js';
import { evaluateCurveD1, evaluateSurfaceD1 } from '../core/derivatives.js';
import { copyCadData } from '../data-copy.js';
import type { Curve, Surface, Model, Point } from '../types.js';

export interface FinitePlaneCylinderEquation {
  quarter: number; bernstein: number[]; power: number[]; degree: 'quadratic'|'linear'|'constant'|'zero'; discriminant: number|null; uncertainty: number;
  exclusionPolicy?: 'strict-Bernstein-sign-control-hull-exclusion';
}
export interface FinitePlaneCylinderBoundaryEvent {
  eventId: string; parameter: number; boundary: 'bottom'|'top'; levelMM: number; kind: 'crossing'|'touch'; quarters: number[];
  bracket: [number,number]; iterations: number; residualMM: number; pointMM: Point; planeUV: Point; wallUV: Point;
  nativeDomainAdmitted: boolean; seamRepresentation: 'start'|'end'|null; equations: FinitePlaneCylinderEquation[];
}
export interface FinitePlaneCylinderEndpointApproximation {
  side: 'lower'|'upper'; eventId: string; rootParameter: number; rootBracket: [number,number]; usedParameter: number;
  parameterOffset: number; boundaryResidualMM: number; semantics: 'inward-represented-bracket-endpoint-not-exact-cap-topology';
}
export interface FinitePlaneCylinderPiece {
  pieceId: string; domain: [number,number]; curve: Curve; bindings: XYCirclePrismPlaneBindings;
  source: string; sourceVersion: 0; model: Model;
  endpointApproximations: [FinitePlaneCylinderEndpointApproximation|null,FinitePlaneCylinderEndpointApproximation|null];
  observations: PlaneCylinderIntersectionObservation[];
}
export interface FinitePlaneCylinderOriginalDerivativeGuard {
  parameter: number; section: PlaneCylinderCurveD1State; planePcurve: PlaneCylinderCurveD1State;
  wallPcurve: PlaneCylinderCurveD1State; wallSurface: PlaneCylinderSurfaceD1State;
}
export interface FiniteXYCirclePrismPlaneIntersectionReport {
  family: 'own-finite-axial-plane-circle-cylinder'; kind: FiniteXYCirclePrismPlaneIntersectionResult['kind']; evaluationId: string;
  originalDomain: [number,number]; axialWallDomainMM: [number,number]; pieceCount: number; eventCount: number;
  equations: FinitePlaneCylinderEquation[]; coincidentBoundary: 'bottom'|'top'|null;
  intervalClassifications: { domain: [number,number]; sampleParameter: number; observedZMM: number; inside: boolean }[];
  isolatedEventIds: string[]; originalGuardedParameters: [1,2,3]; originalDerivativeGuards: FinitePlaneCylinderOriginalDerivativeGuard[];
  numericPolicy: { method: 'homogeneous-Bernstein-quadratic-stable-power-roots-with-brackets'; maximumRefinementSteps: 64; parameterWidthTarget: 1e-12; discriminantPolicy: '32-epsilon-scaled-ambiguity-refuses'; rootExclusionPolicy: 'strict-Bernstein-sign-control-hull-exclusion'; residualComparisonMM: 1e-7; exactParameterDedupOnly: true };
  periodic: false; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  limits: { maximumPieces: 24; maximumEvents: 24; pieceModelObjects: 3; temporaryCurvePoles: 16 };
}
export interface FiniteXYCirclePrismPlaneIntersectionResult {
  kind: 'curve-segments'|'disjoint'|'isolated-touch'|'coincident-boundary'; shell: XYCirclePrismShellBundle; options: XYCirclePrismPlaneIntersectionOptions;
  plane: Surface; wallSurface: Surface;
  derivedSupport: { section: Curve; bindings: XYCirclePrismPlaneBindings; homogeneousSpans: PlaneCylinderHomogeneousSpan[];
    axialControlHullMM: [number,number]; planeSupportMM: OwnPlaneCylinderCandidate['planeSupportMM']; semantics: 'derived-infinite-support-not-finite-intersection' };
  supportSource: { source: string; sourceVersion: 0; model: Model; semantics: 'geometry-only-plane-and-wall-not-contact-curve' };
  events: FinitePlaneCylinderBoundaryEvent[]; pieces: FinitePlaneCylinderPiece[]; report: FiniteXYCirclePrismPlaneIntersectionReport;
}
const TOL=CadNumericPolicy.linearTolerance,WIDTH=1e-12;
function check(c:boolean,message:string):asserts c { if(!c)throw new Error(('Own finite plane-cylinder clipping: '+message).slice(0,1024)); }
function finite(x:number):number { check(Number.isFinite(x),'finite native root/coefficient arithmetic required');return x; }
function midpoint(a:number,b:number):number { return a+(b-a)/2; }
function residual(a:Point,b:Point):number { return finite(Math.hypot(...a.map((x,i)=>x-b[i]))); }
function attempt<T>(action:()=>T):{status:'evaluated';value:T}|{status:'native-refused';reason:string} { try{return{status:'evaluated',value:action()};}catch(e){return{status:'native-refused',reason:(e instanceof Error?e.message:'native evaluator refused').slice(0,1024)};} }
function resultSnapshot(input:unknown):unknown {
  let budget=131072;const copy=(v:unknown,depth:number):unknown=>{check(--budget>=0&&depth<=24,'clipped own result budget exceeded');if(v===null)return null;if(typeof v==='number'){check(Number.isFinite(v),'finite result numbers required');return v;}if(typeof v==='string'){check(v.length<=262144,'bounded result string');return v;}if(typeof v==='boolean')return v;check(v!==null&&typeof v==='object','plain clipped result required');const array=Array.isArray(v),proto=Object.getPrototypeOf(v),keys=Reflect.ownKeys(v),descriptors=Object.getOwnPropertyDescriptors(v);check(array?proto===Array.prototype:proto===Object.prototype||proto===null,'foreign clipped result');check(keys.length<=(array?1025:32)&&keys.every(k=>typeof k==='string'&&k.length<=128&&'value'in descriptors[k]&&(array&&k==='length'||descriptors[k].enumerable===true)),'getter/symbol/hidden/excess clipped result');if(array){const n=descriptors.length.value as number;check(Number.isInteger(n)&&n>=0&&n<=1024&&keys.length===n+1,'dense bounded result array');return Array.from({length:n},(_,i)=>{check(Object.hasOwn(descriptors,String(i)),'sparse result');return copy(descriptors[String(i)].value,depth+1);});}return Object.fromEntries((keys as string[]).map(k=>[k,copy(descriptors[k].value,depth+1)]));};return copy(input,0);
}
function allocator(candidate:OwnPlaneCylinderCandidate): (role:string)=>string {
  const reserved=new Set<string>();const visit=(v:unknown,key='')=>{if(typeof v==='string'&&(key==='id'||key==='name'||key.endsWith('Id')))reserved.add(v);else if(Array.isArray(v))v.forEach(x=>visit(x));else if(v&&typeof v==='object')Object.entries(v).forEach(([k,x])=>visit(x,k));};visit(candidate);let serial=0;
  return role=>{for(let i=0;i<1024;i++){const id='__finite_'+role+'_'+serial++;check(id.length<=48,'bounded derived ID');if(!reserved.has(id)){reserved.add(id);return id;}}throw new Error('Own finite plane-cylinder clipping: fresh derived ID budget exhausted');};
}
function equation(quarter:number,values:number[]):FinitePlaneCylinderEquation {
  return {quarter,...createHomogeneousBernsteinEquation(values,'Own finite plane-cylinder clipping')};
}
function roots(e:FinitePlaneCylinderEquation):HomogeneousBernsteinRoot[] {
  return solveHomogeneousBernsteinEquation(e,{parameterWidthTarget:WIDTH,label:'Own finite plane-cylinder clipping'});
}
function inDomain(surface:Surface,uv:Point):boolean {const d=surfaceDomain(surface);return uv[2]===0&&uv[0]>=d.u[0]&&uv[0]<=d.u[1]&&uv[1]>=d.v[0]&&uv[1]<=d.v[1];}
function admitted(candidate:OwnPlaneCylinderCandidate,bindings:XYCirclePrismPlaneBindings,t:number):boolean {try{const point=evaluateCurve(candidate.section,t),p=evaluateCurve(bindings.plane.curve,t),w=evaluateCurve(bindings.wall.curve,t);if(point[2]<0||point[2]>candidate.shell.construction.heightMM||!inDomain(candidate.plane,p)||!inDomain(candidate.wallSurface,w))return false;return residual(point,evaluateSurface(candidate.plane,p[0],p[1]))<=TOL&&residual(point,evaluateSurface(candidate.wallSurface,w[0],w[1]))<=TOL&&Math.abs(w[0]-t)<=1e-12;}catch{return false;}}
function quarters(curve:Curve,fresh:(role:string)=>string):Curve[] {const result:Curve[]=[];let rest=copyCadData(curve);for(const t of [1,2,3]){const split=splitCurveAtParameter(rest,{parameter:t,lowerCurveId:fresh('tmp'),upperCurveId:fresh('tmp')});result.push(split.lower);rest=split.upper;}result.push(rest);return result;}
function restrict(curve:Curve,a:number,b:number,id:string,fresh:(role:string)=>string):Curve {let current=copyCadData(curve);const d=curveDomain(current);check(a>=d[0]&&b<=d[1]&&a<b,'piece restriction inside original quarter');if(a>d[0])current=splitCurveAtParameter(current,{parameter:a,lowerCurveId:fresh('tmp'),upperCurveId:fresh('tmp')}).upper;if(b<curveDomain(current)[1])current=splitCurveAtParameter(current,{parameter:b,lowerCurveId:fresh('tmp'),upperCurveId:fresh('tmp')}).lower;return{...copyCadData(current),id};}
function observePiece(curve:Curve,plane:Surface,wall:Surface,bindings:XYCirclePrismPlaneBindings):PlaneCylinderIntersectionObservation[] {
  const [a,b]=curveDomain(curve),parameters=[a,a+(b-a)/4,midpoint(a,b),a+3*(b-a)/4,b];check(parameters.every((t,i)=>i===0||t>parameters[i-1]),'piece observation parameters not representable');
  return parameters.map(t=>{const point=evaluateCurve(curve,t),puv=evaluateCurve(bindings.plane.curve,t),wuv=evaluateCurve(bindings.wall.curve,t);check(inDomain(plane,puv)&&inDomain(wall,wuv),'actual piece dual UV outside native Surface domains');const pp=evaluateSurface(plane,puv[0],puv[1]),wp=evaluateSurface(wall,wuv[0],wuv[1]),pr=residual(point,pp),wr=residual(point,wp),ur=Math.abs(wuv[0]-t);check(pr<=TOL&&wr<=TOL&&ur<=1e-12,'actual piece dual-surface binding observation failed');
    const d1:PlaneCylinderIntersectionObservation['d1']={section:attempt(()=>evaluateCurveD1(curve,t)),planePcurve:attempt(()=>evaluateCurveD1(bindings.plane.curve,t)),wallPcurve:attempt(()=>evaluateCurveD1(bindings.wall.curve,t)),planeSurface:attempt(()=>evaluateSurfaceD1(plane,puv[0],puv[1])),wallSurface:attempt(()=>evaluateSurfaceD1(wall,wuv[0],wuv[1]))};
    if(d1.section.status==='evaluated'&&d1.planePcurve.status==='evaluated'&&d1.planeSurface.status==='evaluated'){const s=d1.planeSurface.value,v=d1.planePcurve.value;d1.mappedPlaneTangent=s.du.map((x,i)=>x*v.derivative[0]+s.dv[i]*v.derivative[1]) as Point;d1.planeTangentResidual=residual(d1.section.value.derivative,d1.mappedPlaneTangent);check(d1.planeTangentResidual<=TOL,'piece native plane tangent chain failed');}
    if(d1.section.status==='evaluated'&&d1.wallPcurve.status==='evaluated'&&d1.wallSurface.status==='evaluated'){const s=d1.wallSurface.value,v=d1.wallPcurve.value;d1.mappedWallTangent=s.du.map((x,i)=>x*v.derivative[0]+s.dv[i]*v.derivative[1]) as Point;d1.wallTangentResidual=residual(d1.section.value.derivative,d1.mappedWallTangent);check(d1.wallTangentResidual<=TOL,'piece native wall tangent chain failed');}
    return{parameter:t,pointMM:point,planeUV:puv,wallUV:wuv,planePointMM:pp,wallPointMM:wp,planeResidualMM:pr,wallResidualMM:wr,wallParameterResidual:ur,d1};});
}
/** Bounded own homogeneous clipping; derived support is never a full-wall proof. */
export function intersectFiniteXYCirclePrismWallWithPlane(shell:XYCirclePrismShellBundle,options:XYCirclePrismPlaneIntersectionOptions):FiniteXYCirclePrismPlaneIntersectionResult {
  const c=constructPlaneCylinderCandidate(shell,options),dual=constructPlaneCylinderBindings(c),fresh=allocator(c),height=c.shell.construction.heightMM,equations:FinitePlaneCylinderEquation[]=[],events:FinitePlaneCylinderBoundaryEvent[]=[];let coincident:'bottom'|'top'|null=null;
  for(const [boundary,level]of [['bottom',0],['top',height]] as const){let zero=0;for(let q=0;q<4;q++){const values=c.section.controlPoints.slice(q*2,q*2+3).map((point,i)=>finite((point[2]-level)*c.section.weights[q*2+i])),e=equation(q,values);equations.push(e);if(e.degree==='zero'){zero++;continue;}for(const root of roots(e)){const t=q+root.t,bracket:[number,number]=[q+root.bracket[0],q+root.bracket[1]],point=evaluateCurve(c.section,t),puv=evaluateCurve(dual.bindings.plane.curve,t),wuv=evaluateCurve(dual.bindings.wall.curve,t),error=Math.abs(point[2]-level);check(error<=TOL,'root residual exceeds local native point policy');const existing=events.find(x=>x.parameter===t&&x.boundary===boundary);if(existing){check(same(existing.bracket,bracket)&&existing.kind===(root.touch?'touch':'crossing'),'identical native event representations disagree');existing.quarters.push(q);existing.equations.push(e);}else events.push({eventId:fresh('event'),parameter:t,boundary,levelMM:level,kind:root.touch?'touch':'crossing',quarters:[q],bracket,iterations:root.iterations,residualMM:error,pointMM:point,planeUV:puv,wallUV:wuv,nativeDomainAdmitted:admitted(c,dual.bindings,t),seamRepresentation:t===0?'start':t===4?'end':null,equations:[e]});}}
    check(zero===0||zero===4,'partial represented coincident quarter is unresolved');if(zero===4){check(coincident===null,'two coincident axial levels cannot coincide on positive wall height');coincident=boundary;}}
  events.sort((a,b)=>a.parameter-b.parameter||a.levelMM-b.levelMM);check(events.length<=24,'event budget exceeded');for(let i=1;i<events.length;i++){const a=events[i-1],b=events[i];check(a.parameter<b.parameter,'distinct axial events have unresolved identical parameter');check(a.bracket[1]<b.bracket[0]||a.bracket[1]===b.bracket[0]&&a.parameter===a.bracket[0]&&b.parameter===b.bracket[0],'distinct event brackets overlap; no close-event merging');}
  const sections=quarters(c.section,fresh),planes=quarters(dual.bindings.plane.curve,fresh),walls=quarters(dual.bindings.wall.curve,fresh),pieces:FinitePlaneCylinderPiece[]=[],intervalClassifications:FiniteXYCirclePrismPlaneIntersectionReport['intervalClassifications']=[],usedEvents=new Set<string>();
  for(let q=0;q<4;q++){const boundaries=[q,...events.filter(e=>e.parameter>q&&e.parameter<q+1).map(e=>e.parameter),q+1];for(let i=0;i+1<boundaries.length;i++){const a=boundaries[i],b=boundaries[i+1],mid=midpoint(a,b);check(mid>a&&mid<b,'interval classification midpoint not representable');const z=evaluateCurve(c.section,mid)[2],inside=z>=0&&z<=height;intervalClassifications.push({domain:[a,b],sampleParameter:mid,observedZMM:z,inside});if(!inside)continue;
      const endpoint=(t:number,side:'lower'|'upper'):{parameter:number;approximation:FinitePlaneCylinderEndpointApproximation|null}=>{const e=events.find(e=>e.parameter===t);if(!e)return{parameter:t,approximation:null};usedEvents.add(e.eventId);const value=e.bracket[0]===e.bracket[1]?t:side==='lower'?e.bracket[1]:e.bracket[0];check(value>=e.bracket[0]&&value<=e.bracket[1]&&admitted(c,dual.bindings,value),'inward root-bracket endpoint is not strictly native-domain admitted');if(value===t)return{parameter:value,approximation:null};const error=Math.abs(evaluateCurve(c.section,value)[2]-e.levelMM);check(error<=TOL,'inward endpoint boundary residual exceeds observation limit');return{parameter:value,approximation:{side,eventId:e.eventId,rootParameter:e.parameter,rootBracket:e.bracket,usedParameter:value,parameterOffset:value-e.parameter,boundaryResidualMM:error,semantics:'inward-represented-bracket-endpoint-not-exact-cap-topology'}};};
      const lower=endpoint(a,'lower'),upper=endpoint(b,'upper');check(lower.parameter<upper.parameter,'inward retained interval collapsed');check(admitted(c,dual.bindings,midpoint(lower.parameter,upper.parameter)),'retained native interval classification unresolved');const pieceId=fresh('xyz'),curve=restrict(sections[q],lower.parameter,upper.parameter,pieceId,fresh),pc=restrict(planes[q],lower.parameter,upper.parameter,fresh('puv'),fresh),wc=restrict(walls[q],lower.parameter,upper.parameter,fresh('wuv'),fresh),domain=curveDomain(curve);check(same(domain,curveDomain(pc))&&same(domain,curveDomain(wc)),'actual XYZ/dualUV restrictions must share original domain bits');const bindings:XYCirclePrismPlaneBindings={coordinateSystem:'uv',domain,evaluationId:c.options.evaluationId,plane:{surfaceId:c.plane.id,curve:pc},wall:{surfaceId:c.wallSurface.id,curve:wc}},file=adopt({name:c.options.planeId,version:0,lengthUnit:'mm',objects:[curve,c.plane,c.wallSurface]}),adopted=file.model.objects[0] as Curve,observations=observePiece(adopted,c.plane,c.wallSurface,bindings);pieces.push({pieceId,domain,curve:adopted,bindings,...file,sourceVersion:0,endpointApproximations:[lower.approximation,upper.approximation],observations});check(pieces.length<=24,'piece budget exceeded');}}
  const isolated=events.filter(e=>!usedEvents.has(e.eventId)&&e.nativeDomainAdmitted).map(e=>e.eventId),kind=coincident!==null?'coincident-boundary':pieces.length?'curve-segments':isolated.length?'isolated-touch':'disjoint',support=adopt({name:c.options.planeId,version:0,lengthUnit:'mm',objects:[c.plane,c.wallSurface]});
  const originalDerivativeGuards:FinitePlaneCylinderOriginalDerivativeGuard[]=[1,2,3].map(parameter=>({parameter,section:attempt(()=>evaluateCurveD1(c.section,parameter)),planePcurve:attempt(()=>evaluateCurveD1(dual.bindings.plane.curve,parameter)),wallPcurve:attempt(()=>evaluateCurveD1(dual.bindings.wall.curve,parameter)),wallSurface:attempt(()=>{const uv=evaluateCurve(dual.bindings.wall.curve,parameter);return evaluateSurfaceD1(c.wallSurface,uv[0],uv[1]);})}));
  return copyCadData({kind,shell:c.shell,options:c.options,plane:c.plane,wallSurface:c.wallSurface,derivedSupport:{section:c.section,bindings:dual.bindings,homogeneousSpans:dual.homogeneousSpans,axialControlHullMM:c.axialControlHullMM,planeSupportMM:c.planeSupportMM,semantics:'derived-infinite-support-not-finite-intersection'},supportSource:{...support,sourceVersion:0,semantics:'geometry-only-plane-and-wall-not-contact-curve'},events,pieces,report:{family:'own-finite-axial-plane-circle-cylinder',kind,evaluationId:c.options.evaluationId,originalDomain:[0,4],axialWallDomainMM:[0,height],pieceCount:pieces.length,eventCount:events.length,equations,coincidentBoundary:coincident,intervalClassifications,isolatedEventIds:isolated,originalGuardedParameters:[1,2,3],originalDerivativeGuards,numericPolicy:{method:'homogeneous-Bernstein-quadratic-stable-power-roots-with-brackets',maximumRefinementSteps:64,parameterWidthTarget:WIDTH,discriminantPolicy:'32-epsilon-scaled-ambiguity-refuses',rootExclusionPolicy:'strict-Bernstein-sign-control-hull-exclusion',residualComparisonMM:TOL,exactParameterDedupOnly:true},periodic:false,geometricValidity:'not-certified',topologyCertified:false,solid:false,limits:{maximumPieces:24,maximumEvents:24,pieceModelObjects:3,temporaryCurvePoles:16}}});
}
/** Nullable result metadata is admitted separately; old637 snapshot semantics stay strict. */
export function validateFiniteXYCirclePrismPlaneIntersection(input:FiniteXYCirclePrismPlaneIntersectionResult):FiniteXYCirclePrismPlaneIntersectionReport {
  const owned=resultSnapshot(input) as FiniteXYCirclePrismPlaneIntersectionResult;check(owned!==null&&typeof owned==='object'&&!Array.isArray(owned),'owned finite intersection result required');const expected=intersectFiniteXYCirclePrismWallWithPlane(owned.shell,owned.options);check(same(owned,expected),'owned interval/XYZ/dualUV/root/context/source/report mismatch');return copyCadData(expected.report);
}
