import { CadNumericPolicy } from './numeric-policy.js';
import { evaluateCurveD1, evaluateSurfaceD1 } from './core/derivatives.js';
import type { CurveD1Result, SurfaceD1Result } from './core/derivatives.js';
import { curveDomain, validateCurve } from './core/math.js';
import { buildAffinePlaneAxes, mapAffinePlanePointToUV, admitConvexNativeLineLoop, directedUVDeterminant } from './intersect/own-affine-plane-loop-internal.js';
import { ExactAffinePlane } from './exact-proof/exact-affine-plane-internal.js';
import { compileCadModel } from './model-compiler.js';
import { curveDecimal } from './nurbs/curves/curve-source.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Surface, Model, Point } from './types.js';
import { EXACT_FIELDS_REQUIRED, OWN_RECORD, hasExactOwnFields, isOwnRecord } from './core/own-data.js';

export interface ConvexPlanarFaceLoop {id:string;edges:Curve[]}
export interface ConvexPlanarFaceOptions {faceId:string;evaluationId:string;resultIdPrefix:string;orientation:'forward'|'reverse'}
export interface ConvexPlanarFaceVertex {id:string;point:Point}
export interface ConvexPlanarFaceEdge {id:string;curveId:string;vertexIds:[string,string]}
export interface ConvexPlanarFaceUse {id:string;edgeId:string;curveId:string;vertexIds:[string,string];sense:'forward'|'reverse';interval:[number,number];pcurveId:string}
export interface ConvexPlanarFaceTopology {
  version:0;face:{id:string;surfaceId:string;outerLoopId:string;orientation:'forward'|'reverse'};
  vertices:ConvexPlanarFaceVertex[];edges:ConvexPlanarFaceEdge[];loop:{id:string;uses:ConvexPlanarFaceUse[]};
}
export interface ConvexPlanarFacePcurve {id:string;edgeId:string;curveId:string;coordinateSystem:'uv';domain:[number,number];curve:Curve}
export interface ConvexPlanarFaceBinding {
  useId:string;edgeId:string;curveId:string;pcurveId:string;parameter:number;traversalSense:'forward'|'reverse';
  lineD1:CurveD1Result;pcurveD1:CurveD1Result;surfaceD1:SurfaceD1Result;pointDifferenceMM:number;
  orientedLineTangentMM:Point;orientedSurfaceChainTangentMM:Point;tangentDifferenceMM:number;orientedFaceNormal:Point;
}
export interface ConvexPlanarFaceReport {
  family:'own-affine-convex-native-line-planar-face';faceId:string;evaluationId:string;surfaceId:string;outerLoopId:string;
  authoredOrientation:'ccw'|'cw';outerUseOrientation:'ccw'|'cw';faceSense:'forward'|'reverse';authoredCurveIds:string[];
  incidenceValid:true;geometricValidity:'not-certified';topologyCertified:false;solid:false;edgeCount:number;bindingCount:number;
  convexityEvidence:{edgeIndex:number;vertexIndex:number;determinant:number;unsafeThreshold:number}[];
  numericPolicy:{pointBindingComparisonMM:1e-7;relativeD1Comparison:1e-7;boundaryClassification:'exact-zero-or-64-epsilon-uncertainty-refusal';uvBindingUnits:'dimensionless-not-mm-source'};
  limits:{maximumEdges:8;snapshotValues:32768;snapshotDepth:16;arrayElements:256;recordFields:32;resultIdPrefixCharacters:20};
}
export interface ConvexPlanarFaceResult {
  plane:Surface;loop:ConvexPlanarFaceLoop;options:ConvexPlanarFaceOptions;source:string;sourceVersion:0;model:Model;
  topology:ConvexPlanarFaceTopology;pcurves:ConvexPlanarFacePcurve[];bindings:ConvexPlanarFaceBinding[];report:ConvexPlanarFaceReport;
}
export interface ConvexPlanarFaceBoundaryClassification {
  edgeId:string;curveId:string;useId:string;pcurveId:string;lineParameter:number;traversalSense:'forward'|'reverse';
  lineD1:CurveD1Result;pointDifferenceMM:number;orientedLineTangentMM:Point;
}
export interface ConvexPlanarFaceUVClassification {
  classification:'inside'|'boundary'|'outside'|'outside-domain';uv:[number,number];pointMM:Point|null;faceNormal:Point|null;
  halfspaces:number[];boundaries:ConvexPlanarFaceBoundaryClassification[];
}
const LABEL='Own convex planar Face',TOL=CadNumericPolicy.linearTolerance;
function check(c:boolean,detail:string):asserts c {if(!c)throw new Error((LABEL+': '+detail).slice(0,1024));}
function finite(n:number):number {check(Number.isFinite(n),'finite native homogeneous/Gram arithmetic required');return n;}
function snapshot(input:unknown,results=false):unknown {
  let budget=results?32768:4096;const copy=(v:unknown,depth:number):unknown=>{check(--budget>=0&&depth<=(results?16:8),'own-data values/depth bound');if(v===null&&results)return null;if(typeof v==='number'){check(Number.isFinite(v),'finite own numbers');return v;}if(typeof v==='string'){check(v.length<=(results?262144:128),'bounded own string');return v;}if(typeof v==='boolean'&&results)return v;check(v!==null&&typeof v==='object','plain own data');const array=Array.isArray(v),proto=Object.getPrototypeOf(v),keys=Reflect.ownKeys(v),descriptors=Object.getOwnPropertyDescriptors(v);check(array?proto===Array.prototype:proto===Object.prototype||proto===null,'foreign own-data prototype');check(keys.length<=(array?(results?257:65):(results?32:16))&&keys.every(k=>typeof k==='string'&&k.length<=128&&'value'in descriptors[k]&&(array&&k==='length'||descriptors[k].enumerable===true)),'getter/symbol/hidden/excess own data');if(array){const n=descriptors.length.value as number;check(Number.isInteger(n)&&n>=0&&n<=(results?256:64)&&keys.length===n+1,'dense bounded own array');return Array.from({length:n},(_,i)=>{check(Object.hasOwn(descriptors,String(i)),'sparse own array');return copy(descriptors[String(i)].value,depth+1);});}return Object.fromEntries((keys as string[]).map(k=>[k,copy(descriptors[k].value,depth+1)]));};return copy(input,0);
}
function record(v: unknown, keys: string[]): Record<string, unknown> { check(isOwnRecord(v), OWN_RECORD); check(hasExactOwnFields(v, keys), EXACT_FIELDS_REQUIRED + keys.join(',')); return v; }
function id(v:unknown):string {check(typeof v==='string'&&v.length<=48&&/^[A-Za-z_][A-Za-z0-9_-]*$/.test(v),'ASCII ID1..48 required');return v;}
function same(a:unknown,b:unknown):boolean {if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((x,i)=>same(x,b[i]));if(a&&b&&typeof a==='object'&&typeof b==='object'){const x=a as Record<string,unknown>,y=b as Record<string,unknown>;return Object.keys(x).length===Object.keys(y).length&&Object.keys(x).every(k=>Object.hasOwn(y,k)&&same(x[k],y[k]));}return Object.is(a,b);}
function delta(a:Point,b:Point):Point{return a.map((x,i)=>finite(x-b[i])) as Point;}

function multiply(a:number,b:number):number {const value=finite(a*b);check(a===0||b===0||value!==0,'nonzero native tangent product underflowed to zero');return value;}
function cross(a:Point,b:Point):Point{return[finite(multiply(a[1],b[2])-multiply(a[2],b[1])),finite(multiply(a[2],b[0])-multiply(a[0],b[2])),finite(multiply(a[0],b[1])-multiply(a[1],b[0]))];}
function normal(surface:SurfaceD1Result,sense:'forward'|'reverse'):Point {const value=cross(surface.du,surface.dv),length=finite(Math.hypot(...value));check(length>0,'actual native Surface D1 normal not represented');return value.map(v=>finite(v/length)*(sense==='forward'?1:-1)) as Point;}
function adopt(plane:Surface,edges:Curve[],name:string):{source:string;model:Model} {
  const dec=(n:number)=>curveDecimal(n,LABEL),list=(a:number[])=>'['+a.map(dec).join(',')+']',poles=(a:Point[])=>'['+a.map(list).join(',')+']';
  const source='@model '+name+' { version:0; length-unit:mm; @surface #'+plane.id+' { type:nurbs; degree-u:1; degree-v:1; knots-u:'+list(plane.knotsU)+'; knots-v:'+list(plane.knotsV)+'; control-points:['+plane.controlPoints.map(poles).join(',')+']; weights:['+plane.weights.map(list).join(',')+']; } '+edges.map(c=>'@curve #'+c.id+' { type:nurbs; degree:1; knots:'+list(c.knots)+'; control-points:'+poles(c.controlPoints)+'; weights:'+list(c.weights)+'; } ').join('')+'}\n';
  check(source.length<=262144,'native source bound');const compiled=compileCadModel(source,{sourceVersion:0});check(compiled.ok,'actual original Plane/Line source0 compilation required');check(same(compiled.model,{name,version:0,lengthUnit:'mm',objects:[plane,...edges]}),'full original Plane/Line source geometry/order/ID/domain/sign adoption');return{source,model:compiled.model};
}
/** Variable3..8 native Line trim incidence, independent of the existing four-boundary FaceBundle. */
export function buildConvexPlanarFace(planeInput:Surface,loopInput:ConvexPlanarFaceLoop,inputOptions:ConvexPlanarFaceOptions):ConvexPlanarFaceResult {
  const planeData=snapshot(planeInput),loopData=snapshot(loopInput),optionData=snapshot(inputOptions);
  const p=record(planeData,['kind','id','degreeU','degreeV','knotsU','knotsV','controlPoints','weights']) as unknown as Surface,l=record(loopData,['id','edges']),o=record(optionData,['faceId','evaluationId','resultIdPrefix','orientation']);
  id(p.id);const loopId=id(l.id);check(Array.isArray(l.edges)&&l.edges.length>=3&&l.edges.length<=8,'3..8 original native Lines required');
  const edges=l.edges.map(edge=>record(edge,['kind','id','degree','knots','controlPoints','weights']) as unknown as Curve);edges.forEach(edge=>id(edge.id));
  check(typeof o.resultIdPrefix==='string'&&o.resultIdPrefix.length<=20&&/^[A-Za-z_][A-Za-z0-9_-]*$/.test(o.resultIdPrefix),'ASCII result prefix1..20 required');check(o.orientation==='forward'||o.orientation==='reverse','explicit forward/reverse face sense required');
  const options:ConvexPlanarFaceOptions={faceId:id(o.faceId),evaluationId:id(o.evaluationId),resultIdPrefix:o.resultIdPrefix,orientation:o.orientation},prefix=options.resultIdPrefix,role=(name:string,index:number):string=>id(prefix+'_'+name+'_'+index);
  const originals=[p.id,loopId,options.faceId,options.evaluationId,...edges.map(edge=>edge.id)],generated=edges.flatMap((_,i)=>[role('v',i),role('e',i),role('use',i),role('uv',i)]);check(new Set([...originals,...generated]).size===originals.length+generated.length,'original/context/generated face identities must be distinct before native staging');
  const axes=buildAffinePlaneAxes(p,LABEL),admission=admitConvexNativeLineLoop(edges,axes,LABEL,p),target=options.orientation==='forward'?'ccw':'cw',forward=admission.orientation===target;
  const vertices:ConvexPlanarFaceVertex[]=edges.map((edge,i)=>({id:role('v',i),point:copyCadData(edge.controlPoints[0])})),topologicalEdges:ConvexPlanarFaceEdge[]=edges.map((edge,i)=>({id:role('e',i),curveId:edge.id,vertexIds:[vertices[i].id,vertices[(i+1)%vertices.length].id]}));
  // Pcurve poles: exact rational UV rounded once (so a representable UV, e.g. x = 7 on a 22 mm chart, is
  // exact and the stored-solid lift proof holds); the float Gram mapping stays the fallback.
  let exactUV:ExactAffinePlane|null=null;try{exactUV=new ExactAffinePlane(p,LABEL);}catch{exactUV=null;}
  const toUV=(point:Point):Point=>{if(exactUV){try{return exactUV.pointToNearestUV(point);}catch{exactUV=null;}}return mapAffinePlanePointToUV(point,axes,LABEL);};
  const pcurves:ConvexPlanarFacePcurve[]=edges.map((edge,i)=>{
    const curve:Curve={kind:'curve',id:role('uv',i),degree:1,knots:copyCadData(edge.knots),weights:copyCadData(edge.weights),controlPoints:edge.controlPoints.map(toUV)};validateCurve(curve);return{id:curve.id,edgeId:topologicalEdges[i].id,curveId:edge.id,coordinateSystem:'uv',domain:curveDomain(edge),curve};
  });
  const ordered=Array.from({length:edges.length},(_,i)=>forward?i:edges.length-1-i),uses:ConvexPlanarFaceUse[]=ordered.map(index=>{
    const edge=topologicalEdges[index],domain=pcurves[index].domain;return{id:role('use',index),edgeId:edge.id,curveId:edge.curveId,vertexIds:forward?[edge.vertexIds[0],edge.vertexIds[1]]:[edge.vertexIds[1],edge.vertexIds[0]],sense:forward?'forward':'reverse',interval:forward?[domain[0],domain[1]]:[domain[1],domain[0]],pcurveId:pcurves[index].id};
  });
  for(let i=0;i<uses.length;i++)check(uses[i].vertexIds[1]===uses[(i+1)%uses.length].vertexIds[0],'actual canonical cyclic use incidence required');
  const topology:ConvexPlanarFaceTopology={version:0,face:{id:options.faceId,surfaceId:p.id,outerLoopId:loopId,orientation:options.orientation},vertices,edges:topologicalEdges,loop:{id:loopId,uses}},bindings:ConvexPlanarFaceBinding[]=[];
  for(const use of uses){
    const index=edges.findIndex(edge=>edge.id===use.curveId),line=edges[index],pcurve=pcurves[index],domain=pcurve.domain,width=finite(domain[1]-domain[0]),mid=finite(domain[0]+width/2);check(width>0&&mid>domain[0]&&mid<domain[1],'native Line midpoint not represented');
    for(const parameter of [use.interval[0],mid,use.interval[1]]){
      const lineD1=evaluateCurveD1(line,parameter),pcurveD1=evaluateCurveD1(pcurve.curve,parameter),uv=pcurveD1.point;check(uv[2]===0&&uv[0]>=axes.domains.u[0]&&uv[0]<=axes.domains.u[1]&&uv[1]>=axes.domains.v[0]&&uv[1]<=axes.domains.v[1],'actual native UV pcurve outside original Surface domain');const surfaceD1=evaluateSurfaceD1(p,uv[0],uv[1]),pointDifferenceMM=finite(Math.hypot(...delta(lineD1.point,surfaceD1.point)));check(pointDifferenceMM<=TOL,'actual native Line/Surface UV point binding exceeds local policy');
      const direction=use.sense==='forward'?1:-1,orientedLineTangentMM=lineD1.derivative.map(value=>finite(value*direction)) as Point,orientedSurfaceChainTangentMM=surfaceD1.du.map((value,i)=>finite(finite(multiply(value,pcurveD1.derivative[0])+multiply(surfaceD1.dv[i],pcurveD1.derivative[1]))*direction)) as Point,tangentDifferenceMM=finite(Math.hypot(...delta(orientedLineTangentMM,orientedSurfaceChainTangentMM))),scale=finite(Math.hypot(...orientedLineTangentMM));check(tangentDifferenceMM<=TOL*Math.max(1,scale),'actual native Line/Surface D1 chain binding exceeds local policy');
      const orientedFaceNormal=normal(surfaceD1,options.orientation);check(finite(Math.hypot(...delta(orientedFaceNormal,axes.unitNormal.map(value=>value*(options.orientation==='forward'?1:-1)) as Point)))<=TOL,'actual original Surface D1 normal/face sense binding');
      bindings.push({useId:use.id,edgeId:use.edgeId,curveId:line.id,pcurveId:pcurve.id,parameter,traversalSense:use.sense,lineD1,pcurveD1,surfaceD1,pointDifferenceMM,orientedLineTangentMM,orientedSurfaceChainTangentMM,tangentDifferenceMM,orientedFaceNormal});
    }
    const endpoints=bindings.slice(-3);for(const [sample,vertexId]of [[endpoints[0],use.vertexIds[0]],[endpoints[2],use.vertexIds[1]]] as const){const vertex=vertices.find(v=>v.id===vertexId);check(vertex!==undefined&&finite(Math.hypot(...delta(sample.lineD1.point,vertex.point)))<=TOL,'actual directed use/native vertex point incidence');}
  }
  const file=adopt(p,edges,options.evaluationId),result:ConvexPlanarFaceResult=copyCadData({plane:file.model.objects[0] as Surface,loop:{id:loopId,edges:file.model.objects.slice(1) as Curve[]},options,...file,sourceVersion:0,topology,pcurves,bindings,report:{family:'own-affine-convex-native-line-planar-face',faceId:options.faceId,evaluationId:options.evaluationId,surfaceId:p.id,outerLoopId:loopId,authoredOrientation:admission.orientation,outerUseOrientation:target,faceSense:options.orientation,authoredCurveIds:edges.map(edge=>edge.id),incidenceValid:true,geometricValidity:'not-certified',topologyCertified:false,solid:false,edgeCount:edges.length,bindingCount:bindings.length,convexityEvidence:admission.convexityEvidence,numericPolicy:{pointBindingComparisonMM:TOL,relativeD1Comparison:TOL,boundaryClassification:'exact-zero-or-64-epsilon-uncertainty-refusal',uvBindingUnits:'dimensionless-not-mm-source'},limits:{maximumEdges:8,snapshotValues:32768,snapshotDepth:16,arrayElements:256,recordFields:32,resultIdPrefixCharacters:20}}});
  return snapshot(result,true) as ConvexPlanarFaceResult;
}
function rebuild(input:ConvexPlanarFaceResult):ConvexPlanarFaceResult {
  const owned=snapshot(input,true) as ConvexPlanarFaceResult;check(owned!==null&&typeof owned==='object'&&!Array.isArray(owned),'owned native convex planar face required');const expected=buildConvexPlanarFace(owned.plane,owned.loop,owned.options);check(same(owned,expected),'owned source/loop/pcurve/interval/sense/vertex/context/report mismatch');return expected;
}
/** Incidence/binding observations only; not geometry or topology certification. */
export function validateConvexPlanarFace(input:ConvexPlanarFaceResult):ConvexPlanarFaceReport {return copyCadData(rebuild(input).report);}
/** Exact represented native UV halfspaces. Near-zero nonzero determinants refuse, never snap. */
export function classifyConvexPlanarFaceUV(input:ConvexPlanarFaceResult,uvInput:[number,number]):ConvexPlanarFaceUVClassification {
  const query=snapshot(uvInput),face=rebuild(input);check(Array.isArray(query)&&query.length===2&&query.every(value=>typeof value==='number'&&Number.isFinite(value)),'finite native UV pair required');const uv=query as [number,number],axes=buildAffinePlaneAxes(face.plane,LABEL),insideDomain=uv[0]>=axes.domains.u[0]&&uv[0]<=axes.domains.u[1]&&uv[1]>=axes.domains.v[0]&&uv[1]<=axes.domains.v[1];
  if(!insideDomain)return{classification:'outside-domain',uv,pointMM:null,faceNormal:null,halfspaces:[],boundaries:[]};
  const vertices=face.pcurves.map(pcurve=>pcurve.curve.controlPoints[0]),sign=face.report.authoredOrientation==='ccw'?1:-1,halfspaces:number[]=[],boundaryIndices:number[]=[];
  for(let i=0;i<vertices.length;i++){
    const observation=directedUVDeterminant(delta(vertices[(i+1)%vertices.length],vertices[i]),delta([uv[0],uv[1],0],vertices[i]),LABEL),value=finite(sign*observation.value);
    check(value===0||Math.abs(value)>observation.threshold,'native UV query is an unresolved near-boundary determinant');halfspaces.push(value);if(value===0)boundaryIndices.push(i);
  }
  const surfaceD1=evaluateSurfaceD1(face.plane,uv[0],uv[1]),pointMM=surfaceD1.point,faceNormal=normal(surfaceD1,face.options.orientation),outside=halfspaces.some(value=>value<0),classification:ConvexPlanarFaceUVClassification['classification']=outside?'outside':boundaryIndices.length?'boundary':'inside',boundaries:ConvexPlanarFaceBoundaryClassification[]=[];
  if(classification==='boundary')for(const index of boundaryIndices){
    const line=face.loop.edges[index],pcurve=face.pcurves[index],start=pcurve.curve.controlPoints[0],direction=delta(pcurve.curve.controlPoints[1],start),axis=Math.abs(direction[0])>=Math.abs(direction[1])?0:1,difference=finite(uv[axis]-start[axis]);check(direction[axis]!==0,'native boundary dominant UV axis not represented');const fraction=finite(difference/direction[axis]);check(difference===0||fraction!==0,'nonzero boundary Line coordinate underflowed to zero');check(fraction>=0&&fraction<=1,'actual boundary point outside finite native Line interval');const domain=curveDomain(line),lineParameter=fraction===0?domain[0]:fraction===1?domain[1]:finite(domain[0]+finite(domain[1]-domain[0])*fraction);check(fraction===0||fraction===1||lineParameter>domain[0]&&lineParameter<domain[1],'boundary native Line parameter rounded to an endpoint');
    const use=face.topology.loop.uses.find(use=>use.curveId===line.id);check(use!==undefined,'actual native edge/use association required');const lineD1=evaluateCurveD1(line,lineParameter),pointDifferenceMM=finite(Math.hypot(...delta(pointMM,lineD1.point)));check(pointDifferenceMM<=TOL,'actual boundary query Surface/Line binding exceeds local policy');boundaries.push({edgeId:use.edgeId,curveId:line.id,useId:use.id,pcurveId:pcurve.id,lineParameter,traversalSense:use.sense,lineD1,pointDifferenceMM,orientedLineTangentMM:lineD1.derivative.map(value=>finite(value*(use.sense==='forward'?1:-1))) as Point});
  }
  return copyCadData({classification,uv,pointMM,faceNormal,halfspaces,boundaries});
}
