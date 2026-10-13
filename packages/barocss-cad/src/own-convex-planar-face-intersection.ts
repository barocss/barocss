import { evaluateCurveD1, evaluateSurfaceD1 } from './derivatives.js';
import type { CurveD1Result, SurfaceD1Result } from './derivatives.js';
import { curveDomain, validateCurve } from './math.js';
import { validateConvexPlanarFace } from './own-convex-planar-face.js';
import type { ConvexPlanarFaceResult } from './own-convex-planar-face.js';
import { buildAffinePlaneAxes, mapAffinePlanePointToUV, directedUVDeterminant } from './own-affine-plane-loop-internal.js';
import type { CurveAffinePlaneAxes } from './own-curve-plane-intersection.js';
import { compileCadModel } from './model-compiler.js';
import { curveDecimal } from './curve-source.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Model, Point } from './types.js';

export interface ConvexPlanarFaceIntersectionOptions {evaluationId:string;resultIdPrefix:string}
export interface ConvexFaceSupportUVMap {anchor:Point;direction:Point}
export interface ConvexFaceIntersectionConstraint {
  faceRole:'a'|'b';edgeIndex:number;edgeId:string;alpha:number;beta:number;
  alphaUncertainty:number;betaUncertainty:number;bound:'lower'|'upper'|'parallel-inside'|'coincident-boundary'|'parallel-outside';
  root:number|null;rootUncertaintyRadius:number;
}
export interface ConvexFaceIntersectionContributor {
  faceRole:'a'|'b';faceId:string;loopId:string;edgeId:string;curveId:string;useId:string;pcurveId:string;sense:'forward'|'reverse';
  rootParameter:number;constraint:ConvexFaceIntersectionConstraint;lineParameter:number;lineD1:CurveD1Result;
  pointDifferenceMM:number;rootPointMM:Point;rootUV:Point;rootBindingDifferenceMM:number;orientedLineTangentMM:Point;orientedFaceNormal:Point;
}
export interface ConvexFaceIntersectionEndpoint {
  id:string;parameter:number;pointMM:Point;uvA:Point;uvB:Point;
  approximation:{rootParameter:number;parameterOffset:number;uncertaintyRadius:number;policy:'represented-inward-64-epsilon-bound'};
  halfspacesA:number[];halfspacesB:number[];contributors:ConvexFaceIntersectionContributor[];
}
export interface ConvexFaceIntersectionBinding {
  parameter:number;lineD1:CurveD1Result;uvAD1:CurveD1Result;uvBD1:CurveD1Result;surfaceAD1:SurfaceD1Result;surfaceBD1:SurfaceD1Result;
  pointDifferenceA_MM:number;pointDifferenceB_MM:number;chainDifferenceA_MM:number;chainDifferenceB_MM:number;
  orientedNormalA:Point;orientedNormalB:Point;
}
export interface ConvexFaceIntersectionSegment {
  curve:Curve;uvA:Curve;uvB:Curve;coordinateSystem:'dual-native-uv';domain:[number,number];source:string;sourceVersion:0;model:Model;
  bindings:ConvexFaceIntersectionBinding[];
}
export interface ConvexFaceIntersectionPoint {
  id:string;parameter:number;pointMM:Point;uvA:Point;uvB:Point;surfaceAD1:SurfaceD1Result;surfaceBD1:SurfaceD1Result;
}
export interface ConvexPlanarFaceIntersectionReport {
  family:'own-transverse-convex-affine-plane-face-intersection';kind:ConvexPlanarFaceIntersectionResult['kind'];evaluationId:string;
  faceAId:string;faceBId:string;endpointContributorCount:number;geometricValidity:'not-certified';topologyCertified:false;solid:false;
  numericPolicy:{direction:'normalized-cross-of-unoriented-original-plane-normals-caller-a-to-b';uncertaintyFactor:64;
    pointBindingComparisonMM:1e-7;relativeD1Comparison:1e-7;uvBindingUnits:'dimensionless-not-mm-source';endpointMetadata:'not-sewn-topological-vertices'};
  limits:{maximumFaces:2;maximumEdgesPerFace:8;maximumSegments:1;maximumPoints:1;maximumEndpointContributors:16;snapshotValues:131072;snapshotDepth:24;recordFields:48};
}
export interface ConvexPlanarFaceIntersectionResult {
  kind:'segment'|'point'|'disjoint';faceA:ConvexPlanarFaceResult;faceB:ConvexPlanarFaceResult;options:ConvexPlanarFaceIntersectionOptions;
  supportLine:{anchorMM:Point;direction:Point;normalA:Point;normalB:Point;denominator:number;unsafeThreshold:number;uvA:ConvexFaceSupportUVMap;uvB:ConvexFaceSupportUVMap};
  interval:{lower:number|null;upper:number|null;accepted:[number,number]|null;uncertaintyRadius:number;policy:'linear-convex-halfspaces-original-charts'};
  constraints:ConvexFaceIntersectionConstraint[];segment:ConvexFaceIntersectionSegment|null;point:ConvexFaceIntersectionPoint|null;
  endpoints:ConvexFaceIntersectionEndpoint[];report:ConvexPlanarFaceIntersectionReport;
}
const LABEL='Own convex planar Face intersection',TOL=1e-7,EPS=64*Number.EPSILON;
function check(c:boolean,detail:string):asserts c {if(!c)throw new Error((LABEL+': '+detail).slice(0,1024));}
function finite(n:number):number {check(Number.isFinite(n),'finite native homogeneous/Gram arithmetic required');return n;}
function snapshot(input:unknown,results=false):unknown {
  let budget=results?131072:65536;const copy=(v:unknown,depth:number):unknown=>{check(--budget>=0&&depth<=(results?24:20),'own-data values/depth bound');if(v===null&&results)return null;if(typeof v==='number'){check(Number.isFinite(v),'finite own numbers');return v;}if(typeof v==='string'){check(v.length<=(results?262144:128),'bounded own string');return v;}if(typeof v==='boolean'&&results)return v;check(v!==null&&typeof v==='object','plain own data');const array=Array.isArray(v),proto=Object.getPrototypeOf(v),keys=Reflect.ownKeys(v),descriptors=Object.getOwnPropertyDescriptors(v);check(array?proto===Array.prototype:proto===Object.prototype||proto===null,'foreign own-data prototype');check(keys.length<=(array?(results?1025:513):(48))&&keys.every(k=>typeof k==='string'&&k.length<=128&&'value'in descriptors[k]&&(array&&k==='length'||descriptors[k].enumerable===true)),'getter/symbol/hidden/excess own data');if(array){const n=descriptors.length.value as number;check(Number.isInteger(n)&&n>=0&&n<=(results?1024:512)&&keys.length===n+1,'dense bounded own array');return Array.from({length:n},(_,i)=>{check(Object.hasOwn(descriptors,String(i)),'sparse own array');return copy(descriptors[String(i)].value,depth+1);});}return Object.fromEntries((keys as string[]).map(k=>[k,copy(descriptors[k].value,depth+1)]));};return copy(input,0);
}
function record(v:unknown,keys:string[]):Record<string,unknown>{check(v!==null&&typeof v==='object'&&!Array.isArray(v),'own record');const r=v as Record<string,unknown>;check(Object.keys(r).length===keys.length&&keys.every(k=>Object.hasOwn(r,k)),'exact fields required: '+keys.join(','));return r;}
function id(v:unknown):string {check(typeof v==='string'&&v.length<=48&&/^[A-Za-z_][A-Za-z0-9_-]*$/.test(v),'ASCII ID1..48 required');return v;}
function same(a:unknown,b:unknown):boolean {if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((x,i)=>same(x,b[i]));if(a&&b&&typeof a==='object'&&typeof b==='object'){const x=a as Record<string,unknown>,y=b as Record<string,unknown>;return Object.keys(x).length===Object.keys(y).length&&Object.keys(x).every(k=>Object.hasOwn(y,k)&&same(x[k],y[k]));}return Object.is(a,b);}
function delta(a:Point,b:Point):Point{return a.map((x,i)=>finite(x-b[i])) as Point;}


function multiply(a:number,b:number):number {const value=finite(a*b);check(a===0||b===0||value!==0,'nonzero native support product underflowed to zero');return value;}
function safeDot(a:Point,b:Point):number {const terms=a.map((value,i)=>multiply(value,b[i])),value=finite(terms.reduce((sum,term)=>finite(sum+term),0)),scale=finite(terms.reduce((sum,term)=>finite(sum+Math.abs(term)),0));check(value===0||Math.abs(value)>EPS*scale,'native support dot cancellation is unresolved');return value;}
function cross(a:Point,b:Point):Point{return[finite(multiply(a[1],b[2])-multiply(a[2],b[1])),finite(multiply(a[2],b[0])-multiply(a[0],b[2])),finite(multiply(a[0],b[1])-multiply(a[1],b[0]))];}
function add(a:number,b:number):number {if(b===0)return a;const value=finite(a+b);check(value===0||Math.abs(value)>EPS*finite(Math.abs(a)+Math.abs(b)),'native support coordinate cancellation is unresolved');return value;}
function normal(surface:SurfaceD1Result,sense:'forward'|'reverse'):Point {const value=cross(surface.du,surface.dv),length=finite(Math.hypot(...value));check(length>0,'actual native Surface D1 normal not represented');return value.map(v=>finite(v/length)*(sense==='forward'?1:-1)) as Point;}
function uvDirection(direction:Point,axes:CurveAffinePlaneAxes):Point {
  const du=safeDot(direction,axes.uDirectionMM),dv=safeDot(direction,axes.vDirectionMM),g=axes.gram,uNumerator=finite(multiply(du,g.vv)-multiply(dv,g.uv)),vNumerator=finite(multiply(dv,g.uu)-multiply(du,g.uv));
  const u=finite(uNumerator/g.determinant),v=finite(vNumerator/g.determinant);check(uNumerator===0||u!==0,'nonzero support U direction underflowed');check(vNumerator===0||v!==0,'nonzero support V direction underflowed');const result:Point=[multiply(u,finite(axes.domains.u[1]-axes.domains.u[0])),multiply(v,finite(axes.domains.v[1]-axes.domains.v[0])),0];check(result[0]!==0||result[1]!==0,'native support direction not represented in original Plane chart');return result;
}
function lineSource(curve:Curve,name:string):{source:string;model:Model} {
  const dec=(n:number)=>curveDecimal(n,LABEL),list=(a:number[])=>'['+a.map(dec).join(',')+']',source='@model '+name+' { version:0; length-unit:mm; @curve #'+curve.id+' { type:nurbs; degree:1; knots:'+list(curve.knots)+'; control-points:['+curve.controlPoints.map(list).join(',')+']; weights:'+list(curve.weights)+'; } }\n';const compiled=compileCadModel(source,{sourceVersion:0});check(compiled.ok,'actual derived XYZ Line source0 compilation required');check(same(compiled.model,{name,version:0,lengthUnit:'mm',objects:[curve]}),'complete derived XYZ Line source coefficient/ID/domain/sign adoption');return{source,model:compiled.model};
}
/** Transverse original affine supports, clipped against both actual convex native faces. */
export function intersectConvexPlanarFaces(faceAInput:ConvexPlanarFaceResult,faceBInput:ConvexPlanarFaceResult,inputOptions:ConvexPlanarFaceIntersectionOptions):ConvexPlanarFaceIntersectionResult {
  const a=snapshot(faceAInput,true) as ConvexPlanarFaceResult,b=snapshot(faceBInput,true) as ConvexPlanarFaceResult,optionData=snapshot(inputOptions);validateConvexPlanarFace(a);validateConvexPlanarFace(b);
  const o=record(optionData,['evaluationId','resultIdPrefix']);check(typeof o.resultIdPrefix==='string'&&o.resultIdPrefix.length<=20&&/^[A-Za-z_][A-Za-z0-9_-]*$/.test(o.resultIdPrefix),'ASCII result prefix1..20 required');const options:ConvexPlanarFaceIntersectionOptions={evaluationId:id(o.evaluationId),resultIdPrefix:o.resultIdPrefix};
  check(a.options.faceId!==b.options.faceId,'two distinct original face contexts required');const roles=['_line','_uv_a','_uv_b','_point','_end_0','_end_1'].map(role=>id(options.resultIdPrefix+role)),inputIds=new Set<string>();
  const collect=(value:unknown):void=>{if(Array.isArray(value)){value.forEach(collect);return;}if(value!==null&&typeof value==='object')for(const[key,item]of Object.entries(value)){if(typeof item==='string'&&(key==='id'||key.endsWith('Id')||key==='name'))inputIds.add(item);else collect(item);}};collect(a);collect(b);check(new Set([options.evaluationId,...roles]).size===7&&[options.evaluationId,...roles].every(value=>!inputIds.has(value)),'generated evaluation/Line/UV/point/endpoint IDs collide with original face context');
  const axesA=buildAffinePlaneAxes(a.plane,LABEL),axesB=buildAffinePlaneAxes(b.plane,LABEL),normalA=axesA.unitNormal,normalB=axesB.unitNormal,rawDirection=cross(normalA,normalB),denominator=safeDot(rawDirection,rawDirection),unsafeThreshold=multiply(EPS,multiply(safeDot(normalA,normalA),safeDot(normalB,normalB)));check(denominator>unsafeThreshold,'parallel/coincident/near-parallel supports are unsupported');
  const directionLength=finite(Math.hypot(...rawDirection)),direction=rawDirection.map(value=>finite(value/directionLength)) as Point,relative=delta(axesB.originMM,axesA.originMM),offset=safeDot(normalB,relative),transverse=cross(rawDirection,normalA),factor=finite(offset/denominator);check(offset===0||factor!==0,'nonzero native support-anchor factor underflowed');const anchorMM=axesA.originMM.map((value,i)=>add(value,multiply(transverse[i],factor))) as Point;
  check(Math.abs(safeDot(normalA,delta(anchorMM,axesA.originMM)))<=TOL&&Math.abs(safeDot(normalB,delta(anchorMM,axesB.originMM)))<=TOL,'actual support anchor does not bind both original Plane supports');
  const supportLine={anchorMM,direction,normalA,normalB,denominator,unsafeThreshold,uvA:{anchor:mapAffinePlanePointToUV(anchorMM,axesA,LABEL),direction:uvDirection(direction,axesA)},uvB:{anchor:mapAffinePlanePointToUV(anchorMM,axesB,LABEL),direction:uvDirection(direction,axesB)}};
  const faces=[a,b],axes=[axesA,axesB],uvMaps=[supportLine.uvA,supportLine.uvB],constraints:ConvexFaceIntersectionConstraint[]=[];
  let lower:number|null=null,upper:number|null=null,lowerRadius=0,upperRadius=0,parallelOutside=false;
  for(const [faceIndex,face]of faces.entries()){
    const vertices=face.pcurves.map(pcurve=>pcurve.curve.controlPoints[0]),sign=face.report.authoredOrientation==='ccw'?1:-1,map=uvMaps[faceIndex];
    for(let edgeIndex=0;edgeIndex<vertices.length;edgeIndex++){
      const edgeDirection=delta(vertices[(edgeIndex+1)%vertices.length],vertices[edgeIndex]),alphaMeasure=directedUVDeterminant(edgeDirection,map.direction,LABEL),betaMeasure=directedUVDeterminant(edgeDirection,delta(map.anchor,vertices[edgeIndex]),LABEL),alpha=finite(sign*alphaMeasure.value),beta=finite(sign*betaMeasure.value);check(alpha===0||Math.abs(alpha)>alphaMeasure.threshold,'native halfspace direction denominator is uncertain');check(beta===0||Math.abs(beta)>betaMeasure.threshold,'native halfspace support-anchor cancellation is uncertain');
      let bound:ConvexFaceIntersectionConstraint['bound'],root:number|null=null,rootUncertaintyRadius=0;
      if(alpha===0){bound=beta<0?'parallel-outside':beta===0?'coincident-boundary':'parallel-inside';if(beta<0)parallelOutside=true;}
      else {root=finite(-beta/alpha);check(beta===0||root!==0,'nonzero halfspace root underflowed to zero');rootUncertaintyRadius=finite(EPS*finite(Math.abs(root)+1)+finite(betaMeasure.threshold+multiply(Math.abs(root),alphaMeasure.threshold))/Math.abs(alpha));check(rootUncertaintyRadius>0,'halfspace bound uncertainty not represented');bound=alpha>0?'lower':'upper';if(bound==='lower'){if(lower===null||root>lower){lower=root;lowerRadius=rootUncertaintyRadius;}else if(root===lower)lowerRadius=Math.max(lowerRadius,rootUncertaintyRadius);}else{if(upper===null||root<upper){upper=root;upperRadius=rootUncertaintyRadius;}else if(root===upper)upperRadius=Math.max(upperRadius,rootUncertaintyRadius);}}
      constraints.push({faceRole:faceIndex===0?'a':'b',edgeIndex,edgeId:face.topology.edges[edgeIndex].id,alpha,beta,alphaUncertainty:alphaMeasure.threshold,betaUncertainty:betaMeasure.threshold,bound,root,rootUncertaintyRadius});
    }
  }
  const pointAt=(parameter:number):Point=>anchorMM.map((value,i)=>add(value,multiply(direction[i],parameter))) as Point;
  const stateAt=(parameter:number):{pointMM:Point;uvA:Point;uvB:Point;surfaceAD1:SurfaceD1Result;surfaceBD1:SurfaceD1Result;halfspacesA:number[];halfspacesB:number[]}=>{
    const pointMM=pointAt(parameter),uvs=axes.map(chart=>mapAffinePlanePointToUV(pointMM,chart,LABEL)),halfspaces=faces.map((face,index)=>{const vertices=face.pcurves.map(pcurve=>pcurve.curve.controlPoints[0]),sign=face.report.authoredOrientation==='ccw'?1:-1;return vertices.map((vertex,i)=>finite(sign*directedUVDeterminant(delta(vertices[(i+1)%vertices.length],vertex),delta(uvs[index],vertex),LABEL).value));});
    for(let i=0;i<2;i++)check(uvs[i][0]>=axes[i].domains.u[0]&&uvs[i][0]<=axes[i].domains.u[1]&&uvs[i][1]>=axes[i].domains.v[0]&&uvs[i][1]<=axes[i].domains.v[1]&&halfspaces[i].every(value=>value>=0),'actual support sample outside an original native chart/convex face');
    const surfaceAD1=evaluateSurfaceD1(a.plane,uvs[0][0],uvs[0][1]),surfaceBD1=evaluateSurfaceD1(b.plane,uvs[1][0],uvs[1][1]);check(finite(Math.hypot(...delta(pointMM,surfaceAD1.point)))<=TOL&&finite(Math.hypot(...delta(pointMM,surfaceBD1.point)))<=TOL,'actual common support point/dual original Surface binding exceeds local policy');return{pointMM,uvA:uvs[0],uvB:uvs[1],surfaceAD1,surfaceBD1,halfspacesA:halfspaces[0],halfspacesB:halfspaces[1]};
  };
  let contributorCount=0;
  const endpoint=(parameter:number,rootParameter:number,radius:number,index:number):ConvexFaceIntersectionEndpoint=>{
    const state=stateAt(parameter),contributors:ConvexFaceIntersectionContributor[]=[];
    for(const constraint of constraints){
      if(constraint.root!==rootParameter&&constraint.bound!=='coincident-boundary')continue;check(++contributorCount<=16,'endpoint contributor capacity exceeded');const faceIndex=constraint.faceRole==='a'?0:1,face=faces[faceIndex],line=face.loop.edges[constraint.edgeIndex],pcurve=face.pcurves[constraint.edgeIndex],use=face.topology.loop.uses.find(use=>use.curveId===line.id);check(use!==undefined,'original boundary edge/use association required');const rootPointMM=pointAt(rootParameter),rootUV=mapAffinePlanePointToUV(rootPointMM,axes[faceIndex],LABEL),uv=rootUV,start=pcurve.curve.controlPoints[0],uvDirection=delta(pcurve.curve.controlPoints[1],start),axis=Math.abs(uvDirection[0])>=Math.abs(uvDirection[1])?0:1,difference=finite(uv[axis]-start[axis]);check(uvDirection[axis]!==0,'boundary dominant axis not represented');const fraction=finite(difference/uvDirection[axis]);check(difference===0||fraction!==0,'nonzero endpoint edge coordinate underflowed');check(fraction>=0&&fraction<=1,'approximate endpoint boundary coordinate outside original finite native Line');const domain=curveDomain(line),lineParameter=fraction===0?domain[0]:fraction===1?domain[1]:add(domain[0],multiply(finite(domain[1]-domain[0]),fraction));check(fraction===0||fraction===1||lineParameter>domain[0]&&lineParameter<domain[1],'endpoint native Line parameter rounded to an endpoint');const lineD1=evaluateCurveD1(line,lineParameter),pointDifferenceMM=finite(Math.hypot(...delta(state.pointMM,lineD1.point))),rootBindingDifferenceMM=finite(Math.hypot(...delta(rootPointMM,lineD1.point)));check(rootBindingDifferenceMM<=TOL,'actual scalar-bound root/original boundary Line residual exceeds local policy');check(pointDifferenceMM<=TOL,'approximate endpoint/original boundary Line binding exceeds local policy');contributors.push({faceRole:constraint.faceRole,faceId:face.options.faceId,loopId:face.loop.id,edgeId:use.edgeId,curveId:line.id,useId:use.id,pcurveId:pcurve.id,sense:use.sense,rootParameter,constraint,lineParameter,lineD1,pointDifferenceMM,rootPointMM,rootUV,rootBindingDifferenceMM,orientedLineTangentMM:lineD1.derivative.map(value=>finite(value*(use.sense==='forward'?1:-1))) as Point,orientedFaceNormal:normal(faceIndex===0?state.surfaceAD1:state.surfaceBD1,face.options.orientation)});
    }
    return{id:roles[4+index],parameter,pointMM:state.pointMM,uvA:state.uvA,uvB:state.uvB,approximation:{rootParameter,parameterOffset:finite(parameter-rootParameter),uncertaintyRadius:radius,policy:'represented-inward-64-epsilon-bound'},halfspacesA:state.halfspacesA,halfspacesB:state.halfspacesB,contributors};
  };
  let kind:ConvexPlanarFaceIntersectionResult['kind']='disjoint',segment:ConvexFaceIntersectionSegment|null=null,point:ConvexFaceIntersectionPoint|null=null,accepted:[number,number]|null=null;const endpoints:ConvexFaceIntersectionEndpoint[]=[];
  const intervalUncertainty=lower!==null&&upper!==null?finite(EPS*finite(Math.abs(lower)+Math.abs(upper)+1)+lowerRadius+upperRadius):0;
  if(!parallelOutside){
    check(lower!==null&&upper!==null,'finite convex faces did not produce both support bounds');
    for(const constraint of constraints)if(constraint.root!==null){const selected=constraint.bound==='lower'?lower:upper,radius=constraint.bound==='lower'?lowerRadius:upperRadius;check(constraint.root===selected||Math.abs(finite(constraint.root-selected))>finite(radius+constraint.rootUncertaintyRadius),'different nearly coincident endpoint/corner scalar bounds are unresolved; no close merge');}
    if(lower>upper)check(finite(lower-upper)>intervalUncertainty,'near-zero disjoint bound ordering is uncertain');
    else if(lower===upper){
      const state=stateAt(lower);for(const [faceIndex,face]of faces.entries()){const vertices=face.pcurves.map(pcurve=>pcurve.curve.controlPoints[0]),uv=faceIndex===0?state.uvA:state.uvB,sign=face.report.authoredOrientation==='ccw'?1:-1;for(let i=0;i<vertices.length;i++){const measure=directedUVDeterminant(delta(vertices[(i+1)%vertices.length],vertices[i]),delta(uv,vertices[i]),LABEL),value=finite(sign*measure.value);check(value===0||value>measure.threshold,'isolated point face constraint is not exactly admitted or safely interior');}}
      for(const constraint of constraints)if(constraint.root===lower)check(finite(multiply(constraint.alpha,lower)+constraint.beta)===0,'isolated point bound tie lacks an exact represented constraint zero');kind='point';accepted=[lower,upper];point={id:roles[3],parameter:lower,pointMM:state.pointMM,uvA:state.uvA,uvB:state.uvB,surfaceAD1:state.surfaceAD1,surfaceBD1:state.surfaceBD1};endpoints.push(endpoint(lower,lower,0,0));
    }else{
      check(finite(upper-lower)>intervalUncertainty,'near-zero positive intersection interval is uncertain');const lo=add(lower,lowerRadius),hi=add(upper,-upperRadius),mid=add(lo,finite(hi-lo)/2);check(lo>lower&&hi<upper&&lo<mid&&mid<hi,'represented inward finite interval is unresolved');const start=stateAt(lo),end=stateAt(hi);accepted=[lo,hi];const curve:Curve={kind:'curve',id:roles[0],degree:1,knots:[lo,lo,hi,hi],controlPoints:[start.pointMM,end.pointMM],weights:[1,1]},uvA:Curve={kind:'curve',id:roles[1],degree:1,knots:copyCadData(curve.knots),controlPoints:[start.uvA,end.uvA],weights:[1,1]},uvB:Curve={kind:'curve',id:roles[2],degree:1,knots:copyCadData(curve.knots),controlPoints:[start.uvB,end.uvB],weights:[1,1]};validateCurve(curve);validateCurve(uvA);validateCurve(uvB);check(curve.controlPoints[0].some((value,i)=>value!==curve.controlPoints[1][i]),'finite intersection XYZ Line is not represented');
      const bindings:ConvexFaceIntersectionBinding[]=[lo,mid,hi].map(parameter=>{const lineD1=evaluateCurveD1(curve,parameter),uvAD1=evaluateCurveD1(uvA,parameter),uvBD1=evaluateCurveD1(uvB,parameter);stateAt(parameter);check(uvAD1.point[0]>=axesA.domains.u[0]&&uvAD1.point[0]<=axesA.domains.u[1]&&uvAD1.point[1]>=axesA.domains.v[0]&&uvAD1.point[1]<=axesA.domains.v[1]&&uvBD1.point[0]>=axesB.domains.u[0]&&uvBD1.point[0]<=axesB.domains.u[1]&&uvBD1.point[1]>=axesB.domains.v[0]&&uvBD1.point[1]<=axesB.domains.v[1],'actual derived dual pcurve outside an original chart');const surfaceAD1=evaluateSurfaceD1(a.plane,uvAD1.point[0],uvAD1.point[1]),surfaceBD1=evaluateSurfaceD1(b.plane,uvBD1.point[0],uvBD1.point[1]),chain=(s:SurfaceD1Result,u:CurveD1Result):Point=>s.du.map((value,i)=>finite(multiply(value,u.derivative[0])+multiply(s.dv[i],u.derivative[1]))) as Point,pointDifferenceA_MM=finite(Math.hypot(...delta(lineD1.point,surfaceAD1.point))),pointDifferenceB_MM=finite(Math.hypot(...delta(lineD1.point,surfaceBD1.point))),chainDifferenceA_MM=finite(Math.hypot(...delta(lineD1.derivative,chain(surfaceAD1,uvAD1)))),chainDifferenceB_MM=finite(Math.hypot(...delta(lineD1.derivative,chain(surfaceBD1,uvBD1)))),scale=finite(Math.hypot(...lineD1.derivative));check(pointDifferenceA_MM<=TOL&&pointDifferenceB_MM<=TOL&&chainDifferenceA_MM<=TOL*Math.max(1,scale)&&chainDifferenceB_MM<=TOL*Math.max(1,scale),'actual derived Line/dual UV/Surface point+D1 binding exceeds local policy');return{parameter,lineD1,uvAD1,uvBD1,surfaceAD1,surfaceBD1,pointDifferenceA_MM,pointDifferenceB_MM,chainDifferenceA_MM,chainDifferenceB_MM,orientedNormalA:normal(surfaceAD1,a.options.orientation),orientedNormalB:normal(surfaceBD1,b.options.orientation)};});
      const file=lineSource(curve,options.evaluationId);segment={curve:file.model.objects[0] as Curve,uvA,uvB,coordinateSystem:'dual-native-uv',domain:accepted,...file,sourceVersion:0,bindings};kind='segment';endpoints.push(endpoint(lo,lower,lowerRadius,0),endpoint(hi,upper,upperRadius,1));
    }
  }
  const result:ConvexPlanarFaceIntersectionResult=copyCadData({kind,faceA:a,faceB:b,options,supportLine,interval:{lower,upper,accepted,uncertaintyRadius:intervalUncertainty,policy:'linear-convex-halfspaces-original-charts'},constraints,segment,point,endpoints,report:{family:'own-transverse-convex-affine-plane-face-intersection',kind,evaluationId:options.evaluationId,faceAId:a.options.faceId,faceBId:b.options.faceId,endpointContributorCount:contributorCount,geometricValidity:'not-certified',topologyCertified:false,solid:false,numericPolicy:{direction:'normalized-cross-of-unoriented-original-plane-normals-caller-a-to-b',uncertaintyFactor:64,pointBindingComparisonMM:TOL,relativeD1Comparison:TOL,uvBindingUnits:'dimensionless-not-mm-source',endpointMetadata:'not-sewn-topological-vertices'},limits:{maximumFaces:2,maximumEdgesPerFace:8,maximumSegments:1,maximumPoints:1,maximumEndpointContributors:16,snapshotValues:131072,snapshotDepth:24,recordFields:48}}});return snapshot(result,true) as ConvexPlanarFaceIntersectionResult;
}
/** Rebuild both original native faces and all support/dual-UV/interval/contributor data. */
export function validateConvexPlanarFaceIntersection(input:ConvexPlanarFaceIntersectionResult):ConvexPlanarFaceIntersectionReport {
  const owned=snapshot(input,true) as ConvexPlanarFaceIntersectionResult;check(owned!==null&&typeof owned==='object'&&!Array.isArray(owned),'owned convex face intersection result required');const expected=intersectConvexPlanarFaces(owned.faceA,owned.faceB,owned.options);check(same(owned,expected),'owned original faces/support/direction/interval/dual-UV/boundary-parameter/source/context mismatch');return copyCadData(expected.report);
}
