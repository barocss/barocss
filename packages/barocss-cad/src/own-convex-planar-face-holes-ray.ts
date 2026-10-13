import { evaluateSurfaceD1 } from './derivatives.js';
import type { SurfaceD1Result } from './derivatives.js';
import { validateConvexPlanarFaceWithHoles, classifyConvexPlanarFaceWithHolesUV } from './own-convex-planar-face-holes.js';
import type { ConvexPlanarFaceWithHolesResult, ConvexPlanarFaceWithHolesUVClassification, ConvexPlanarHoleBoundaryClassification } from './own-convex-planar-face-holes.js';
import { buildAffinePlaneAxes, mapAffinePlanePointToUV } from './own-affine-plane-loop-internal.js';
import type { CurveAffinePlaneAxes } from './own-curve-plane-intersection.js';
import { copyCadData } from './data-copy.js';
import type { Point } from './types.js';

export interface ConvexPlanarFaceWithHolesRayQuery {originMM:Point;direction:Point;maxDistanceMM:number}
export interface ConvexPlanarFaceWithHolesRayPolicy {
  parallelCosine:1e-12;originDistanceMM:1e-7;maximumRaySurfaceDifferenceMM:1e-7;directionNormTolerance:1e-9;
  scope:'local-display-observation-not-construction-tolerance';range:'inclusive-authored-ray-parameter-zero-to-max-distance';
}
export interface ConvexPlanarFaceWithHolesRaySupport {
  basisUV:[number,number];surfaceD1:SurfaceD1Result;planeAxes:CurveAffinePlaneAxes;unorientedNormal:Point;
  originSignedDistanceMM:number;directionPlaneCosine:number;denominator:number;tMM:number|null;
}
export interface ConvexPlanarFaceWithHolesRayCandidate {
  tMM:number;traveledLengthMM:number;rayPointMM:Point;uv:[number,number];classification:ConvexPlanarFaceWithHolesUVClassification;
  surfaceD1:SurfaceD1Result|null;raySurfaceDifferenceMM:number|null;
}
export interface ConvexPlanarFaceWithHolesRayBoundary extends ConvexPlanarHoleBoundaryClassification {
  faceId:string;surfaceId:string;nativeVertexIds:[string,string];
}
export interface ConvexPlanarFaceWithHolesRayHit {
  faceId:string;surfaceId:string;evaluationId:string;outerLoopId:string;holeIds:string[];
  tMM:number;traveledLengthMM:number;uv:[number,number];pointMM:Point;orientedNormal:Point;surfaceD1:SurfaceD1Result;
  raySurfaceDifferenceMM:number;boundaries:ConvexPlanarFaceWithHolesRayBoundary[];
}
export type ConvexPlanarFaceWithHolesRayStatus='miss'|'unique-hit'|'ambiguous-coplanar';
export type ConvexPlanarFaceWithHolesRayReason='parallel-noncoplanar'|'behind'|'beyond-distance'|'outside-domain'|'outside-outer-loop'|'inside-hole'|'conservative-coplanar-unresolved'|null;
export interface ConvexPlanarFaceWithHolesRayReport {
  family:'own-native-convex-planar-face-with-holes-ray';faceId:string;surfaceId:string;evaluationId:string;
  status:ConvexPlanarFaceWithHolesRayStatus;reason:ConvexPlanarFaceWithHolesRayReason;
  supportObserved:true;candidateInForwardRange:boolean;materialHit:boolean;boundaryContributorCount:number;
  geometricValidity:'not-certified';topologyCertified:false;solid:false;
  classificationAuthority:'actual-original-650-native-uv-face-with-holes';distanceSemantics:'ray-parameter-and-authored-norm-times-parameter-reported-separately';
  limits:{queryValues:4096;queryDepth:8;queryArrayElements:64;queryRecordFields:16;snapshotValues:131072;snapshotDepth:24;arrayElements:512;recordFields:48;sourceStringCharacters:262144;originAbsMM:10000;maximumDistanceMM:50000};
}
export interface ConvexPlanarFaceWithHolesRayResult {
  face:ConvexPlanarFaceWithHolesResult;query:ConvexPlanarFaceWithHolesRayQuery;directionNorm:number;policy:ConvexPlanarFaceWithHolesRayPolicy;
  support:ConvexPlanarFaceWithHolesRaySupport;candidate:ConvexPlanarFaceWithHolesRayCandidate|null;hit:ConvexPlanarFaceWithHolesRayHit|null;
  status:ConvexPlanarFaceWithHolesRayStatus;reason:ConvexPlanarFaceWithHolesRayReason;report:ConvexPlanarFaceWithHolesRayReport;
}
const LABEL='Own convex planar Face with holes ray',TOL=1e-7;
function check(c:boolean,detail:string):asserts c {if(!c)throw new Error((LABEL+': '+detail).slice(0,1024));}
function finite(n:number):number {check(Number.isFinite(n),'finite native homogeneous/Gram arithmetic required');return n;}
function snapshot(input:unknown,results=false):unknown {
  let budget=results?131072:4096;const copy=(v:unknown,depth:number):unknown=>{check(--budget>=0&&depth<=(results?24:8),'own-data values/depth bound');if(v===null&&results)return null;if(typeof v==='number'){check(Number.isFinite(v),'finite own numbers');return v;}if(typeof v==='string'){check(v.length<=(results?262144:128),'bounded own string');return v;}if(typeof v==='boolean'&&results)return v;check(v!==null&&typeof v==='object','plain own data');const array=Array.isArray(v),proto=Object.getPrototypeOf(v),keys=Reflect.ownKeys(v),descriptors=Object.getOwnPropertyDescriptors(v);check(array?proto===Array.prototype:proto===Object.prototype||proto===null,'foreign own-data prototype');check(keys.length<=(array?(results?513:65):(results?48:16))&&keys.every(k=>typeof k==='string'&&k.length<=128&&'value'in descriptors[k]&&(array&&k==='length'||descriptors[k].enumerable===true)),'getter/symbol/hidden/excess own data');if(array){const n=descriptors.length.value as number;check(Number.isInteger(n)&&n>=0&&n<=(results?512:64)&&keys.length===n+1,'dense bounded own array');return Array.from({length:n},(_,i)=>{check(Object.hasOwn(descriptors,String(i)),'sparse own array');return copy(descriptors[String(i)].value,depth+1);});}return Object.fromEntries((keys as string[]).map(k=>[k,copy(descriptors[k].value,depth+1)]));};return copy(input,0);
}
function record(v:unknown,keys:string[]):Record<string,unknown>{check(v!==null&&typeof v==='object'&&!Array.isArray(v),'own record');const r=v as Record<string,unknown>;check(Object.keys(r).length===keys.length&&keys.every(k=>Object.hasOwn(r,k)),'exact fields required: '+keys.join(','));return r;}
function same(a:unknown,b:unknown):boolean {if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((x,i)=>same(x,b[i]));if(a&&b&&typeof a==='object'&&typeof b==='object'){const x=a as Record<string,unknown>,y=b as Record<string,unknown>;return Object.keys(x).length===Object.keys(y).length&&Object.keys(x).every(k=>Object.hasOwn(y,k)&&same(x[k],y[k]));}return Object.is(a,b);}
function delta(a:Point,b:Point):Point{return a.map((x,i)=>finite(x-b[i])) as Point;}
function dot(a:Point,b:Point):number{return finite(a.reduce((s,x,i)=>{const product=finite(x*b[i]);check(x===0||b[i]===0||product!==0,'nonzero native dot-product term underflowed to zero');return finite(s+product);},0));}

function multiply(a:number,b:number):number {const value=finite(a*b);check(a===0||b===0||value!==0,'nonzero native tangent product underflowed to zero');return value;}
function cross(a:Point,b:Point):Point{return[finite(multiply(a[1],b[2])-multiply(a[2],b[1])),finite(multiply(a[2],b[0])-multiply(a[0],b[2])),finite(multiply(a[0],b[1])-multiply(a[1],b[0]))];}
function normal(surface:SurfaceD1Result,sense:'forward'|'reverse'):Point {const value=cross(surface.du,surface.dv),length=finite(Math.hypot(...value));check(length>0,'actual native Surface D1 normal not represented');return value.map(v=>finite(v/length)*(sense==='forward'?1:-1)) as Point;}

/** Original native Plane/material query; no display mesh or coefficient repair. */
export function queryConvexPlanarFaceWithHolesRay(faceInput:ConvexPlanarFaceWithHolesResult,queryInput:ConvexPlanarFaceWithHolesRayQuery):ConvexPlanarFaceWithHolesRayResult {
  const face=snapshot(faceInput,true) as ConvexPlanarFaceWithHolesResult,queryData=snapshot(queryInput),q=record(queryData,['originMM','direction','maxDistanceMM']);
  const vector=(value:unknown):Point=>{check(Array.isArray(value)&&value.length===3&&value.every(component=>typeof component==='number'&&Number.isFinite(component)),'dense finite XYZ query vector required');return value as Point;};
  const originMM=vector(q.originMM),direction=vector(q.direction);check(originMM.every(value=>Math.abs(value)<=10000),'ray origin must lie within authored±10000mm bound');check(typeof q.maxDistanceMM==='number'&&Number.isFinite(q.maxDistanceMM)&&q.maxDistanceMM>0&&q.maxDistanceMM<=50000,'positive maxDistanceMM≤50000 required');const query:ConvexPlanarFaceWithHolesRayQuery={originMM,direction,maxDistanceMM:q.maxDistanceMM},directionNorm=finite(Math.hypot(...direction));check(Math.abs(directionNorm-1)<=1e-9,'authored direction norm must be1±1e-9; normalization is not permitted');
  validateConvexPlanarFaceWithHoles(face);const planeAxes=buildAffinePlaneAxes(face.plane,LABEL),basisUV:[number,number]=[planeAxes.domains.u[0],planeAxes.domains.v[0]],surfaceD1=evaluateSurfaceD1(face.plane,basisUV[0],basisUV[1]),unorientedNormal=normal(surfaceD1,'forward');check(finite(Math.hypot(...delta(unorientedNormal,planeAxes.unitNormal)))<=TOL,'actual native SurfaceD1 support normal does not bind the original Gram basis');const originSignedDistanceMM=dot(unorientedNormal,delta(originMM,surfaceD1.point)),denominator=dot(unorientedNormal,direction),directionPlaneCosine=finite(denominator/directionNorm),policy:ConvexPlanarFaceWithHolesRayPolicy={parallelCosine:1e-12,originDistanceMM:TOL,maximumRaySurfaceDifferenceMM:TOL,directionNormTolerance:1e-9,scope:'local-display-observation-not-construction-tolerance',range:'inclusive-authored-ray-parameter-zero-to-max-distance'};
  let status:ConvexPlanarFaceWithHolesRayStatus='miss',reason:ConvexPlanarFaceWithHolesRayReason=null,tMM:number|null=null,candidate:ConvexPlanarFaceWithHolesRayCandidate|null=null,hit:ConvexPlanarFaceWithHolesRayHit|null=null;
  if(Math.abs(directionPlaneCosine)<=policy.parallelCosine){if(Math.abs(originSignedDistanceMM)<=policy.originDistanceMM){status='ambiguous-coplanar';reason='conservative-coplanar-unresolved';}else reason='parallel-noncoplanar';}
  else{
    tMM=finite(-originSignedDistanceMM/denominator);check(originSignedDistanceMM===0||tMM!==0,'nonzero supporting-plane parameter underflowed to zero');
    if(tMM<0)reason='behind';else if(tMM>query.maxDistanceMM)reason='beyond-distance';else{
      const rayParameter=tMM,rayPointMM=originMM.map((value,i)=>finite(value+multiply(rayParameter,direction[i]))) as Point,uvw=mapAffinePlanePointToUV(rayPointMM,planeAxes,LABEL),uv:[number,number]=[uvw[0],uvw[1]],classification=classifyConvexPlanarFaceWithHolesUV(face,uv),candidateSurface=classification.classification==='outside-domain'?null:evaluateSurfaceD1(face.plane,uv[0],uv[1]),raySurfaceDifferenceMM=candidateSurface===null?null:finite(Math.hypot(...delta(rayPointMM,candidateSurface.point)));
      check(raySurfaceDifferenceMM===null||raySurfaceDifferenceMM<=policy.maximumRaySurfaceDifferenceMM,'actual ray/original native Surface observation exceeds local display policy');candidate={tMM,traveledLengthMM:multiply(tMM,directionNorm),rayPointMM,uv,classification,surfaceD1:candidateSurface,raySurfaceDifferenceMM};
      if(classification.classification==='outside-domain'){check(classification.pointMM===null&&classification.faceNormal===null&&candidateSurface===null,'original out-of-chart no-Surface-evaluation semantics required');reason='outside-domain';}
      else if(classification.classification==='outside')reason='outside-outer-loop';else if(classification.classification==='inside-hole'){check(classification.holeId!==null&&face.holeLoops.some(loop=>loop.id===classification.holeId),'strict hole miss must retain actual authored hole identity');reason='inside-hole';}
      else{
        check(classification.material&&classification.pointMM!==null&&classification.faceNormal!==null&&candidateSurface!==null&&raySurfaceDifferenceMM!==null,'unique native material candidate must bind actual Surface and original face normal');
        check(finite(Math.hypot(...delta(candidateSurface.point,classification.pointMM)))<=TOL,'actual original classifier/SurfaceD1 point observation mismatch');
        const boundaries:ConvexPlanarFaceWithHolesRayBoundary[]=classification.boundaries.map(boundary=>{const loop=face.topology.loops.find(loop=>loop.id===boundary.loopId),use=loop?.uses.find(use=>use.id===boundary.useId),edge=face.topology.edges.find(edge=>edge.id===boundary.edgeId),pcurve=face.pcurves.find(pcurve=>pcurve.id===boundary.pcurveId);check(loop!==undefined&&use!==undefined&&edge!==undefined&&pcurve!==undefined&&loop.role===boundary.loopRole&&use.curveId===boundary.curveId&&edge.curveId===boundary.curveId&&pcurve.curveId===boundary.curveId&&use.edgeId===edge.id&&use.pcurveId===pcurve.id&&use.sense===boundary.traversalSense,'qualified original650 boundary/loop/use/Curve/pcurve association required');return{...boundary,faceId:face.options.faceId,surfaceId:face.plane.id,nativeVertexIds:copyCadData(use.vertexIds)};});
        status='unique-hit';reason=null;hit={faceId:face.options.faceId,surfaceId:face.plane.id,evaluationId:face.options.evaluationId,outerLoopId:face.outerLoop.id,holeIds:face.holeLoops.map(loop=>loop.id),tMM,traveledLengthMM:candidate.traveledLengthMM,uv,pointMM:candidateSurface.point,orientedNormal:classification.faceNormal,surfaceD1:candidateSurface,raySurfaceDifferenceMM,boundaries};
      }
    }
  }
  const support:ConvexPlanarFaceWithHolesRaySupport={basisUV,surfaceD1,planeAxes,unorientedNormal,originSignedDistanceMM,directionPlaneCosine,denominator,tMM},result:ConvexPlanarFaceWithHolesRayResult=copyCadData({face,query,directionNorm,policy,support,candidate,hit,status,reason,report:{family:'own-native-convex-planar-face-with-holes-ray',faceId:face.options.faceId,surfaceId:face.plane.id,evaluationId:face.options.evaluationId,status,reason,supportObserved:true,candidateInForwardRange:candidate!==null,materialHit:hit!==null,boundaryContributorCount:hit?.boundaries.length??0,geometricValidity:'not-certified',topologyCertified:false,solid:false,classificationAuthority:'actual-original-650-native-uv-face-with-holes',distanceSemantics:'ray-parameter-and-authored-norm-times-parameter-reported-separately',limits:{queryValues:4096,queryDepth:8,queryArrayElements:64,queryRecordFields:16,snapshotValues:131072,snapshotDepth:24,arrayElements:512,recordFields:48,sourceStringCharacters:262144,originAbsMM:10000,maximumDistanceMM:50000}}});return snapshot(result,true) as ConvexPlanarFaceWithHolesRayResult;
}
/** Rebuild the actual original face and exact authored ray; derived hit data is never authority. */
export function validateConvexPlanarFaceWithHolesRay(input:ConvexPlanarFaceWithHolesRayResult):ConvexPlanarFaceWithHolesRayReport {
  const owned=snapshot(input,true) as ConvexPlanarFaceWithHolesRayResult;check(owned!==null&&typeof owned==='object'&&!Array.isArray(owned),'owned native hole-face ray result required');const expected=queryConvexPlanarFaceWithHolesRay(owned.face,owned.query);check(same(owned,expected),'owned original face/query/status/norm/parameter/UV/normal/native boundary/source mismatch');return copyCadData(expected.report);
}
