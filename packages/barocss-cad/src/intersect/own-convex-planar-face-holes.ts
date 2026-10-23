import { CadNumericPolicy } from '../numeric-policy.js';
import { evaluateCurveD1, evaluateSurfaceD1 } from '../core/derivatives.js';
import { curveDomain, validateCurve } from '../core/math.js';
import { buildAffinePlaneAxes, mapAffinePlanePointToUV, admitConvexNativeLineLoop, directedUVDeterminant } from './own-affine-plane-loop-internal.js';
import type { ConvexPlanarFaceLoop, ConvexPlanarFaceOptions, ConvexPlanarFaceVertex, ConvexPlanarFaceEdge, ConvexPlanarFaceUse, ConvexPlanarFacePcurve, ConvexPlanarFaceBinding, ConvexPlanarFaceBoundaryClassification } from '../own-convex-planar-face.js';
import { compileCadModel } from '../model-compiler.js';
import { curveDecimal } from '../nurbs/curves/curve-source.js';
import { copyCadData } from '../data-copy.js';
import type { Curve, Surface, Model, Point } from '../types.js';
import type { SurfaceD1Result } from '../core/derivatives.js';

export type ConvexPlanarFaceWithHolesLoop=ConvexPlanarFaceLoop;
export type ConvexPlanarFaceWithHolesOptions=ConvexPlanarFaceOptions;
export type ConvexPlanarLoopRole='outer'|'inner';
export interface ConvexPlanarHoleVertex extends ConvexPlanarFaceVertex {loopId:string;loopRole:ConvexPlanarLoopRole}
export interface ConvexPlanarHoleEdge extends ConvexPlanarFaceEdge {loopId:string;loopRole:ConvexPlanarLoopRole}
export interface ConvexPlanarHoleUse extends ConvexPlanarFaceUse {loopId:string;loopRole:ConvexPlanarLoopRole}
export interface ConvexPlanarHolePcurve extends ConvexPlanarFacePcurve {loopId:string;loopRole:ConvexPlanarLoopRole}
export interface ConvexPlanarHoleBinding extends ConvexPlanarFaceBinding {loopId:string;loopRole:ConvexPlanarLoopRole}
export interface ConvexPlanarFaceHoleTopology {
  version:0;face:{id:string;surfaceId:string;outerLoopId:string;innerLoopIds:string[];orientation:'forward'|'reverse'};
  vertices:ConvexPlanarHoleVertex[];edges:ConvexPlanarHoleEdge[];
  loops:{id:string;role:ConvexPlanarLoopRole;authoredOrientation:'ccw'|'cw';useOrientation:'ccw'|'cw';uses:ConvexPlanarHoleUse[]}[];
}
export interface ConvexHoleContainmentEvidence {holeId:string;vertexIndex:number;outerEdgeIndex:number;value:number;unsafeThreshold:number}
export interface ConvexHolesSeparationEvidence {
  holeAId:string;holeBId:string;axisLoopId:string;axisEdgeIndex:number;anchorUV:Point;edgeDirectionUV:Point;
  projectionsA:number[];projectionsB:number[];rangeA:[number,number];rangeB:[number,number];gap:number;unsafeThreshold:number;
  order:'a-before-b'|'b-before-a';
}
export interface ConvexPlanarFaceWithHolesReport {
  family:'own-affine-convex-native-line-planar-face-with-holes';faceId:string;evaluationId:string;surfaceId:string;outerLoopId:string;holeIds:string[];
  faceSense:'forward'|'reverse';authoredCurveIds:string[];incidenceValid:true;geometricValidity:'not-certified';topologyCertified:false;solid:false;
  loopCount:number;edgeCount:number;bindingCount:number;containmentEvidence:ConvexHoleContainmentEvidence[];separationEvidence:ConvexHolesSeparationEvidence[];
  convexityEvidence:{loopId:string;evidence:{edgeIndex:number;vertexIndex:number;determinant:number;unsafeThreshold:number}[]}[];
  numericPolicy:{pointBindingComparisonMM:1e-7;relativeD1Comparison:1e-7;boundaryClassification:'exact-zero-or-64-epsilon-uncertainty-refusal';
    holeSeparation:'all-vertex-native-edge-normal-separating-axis';uvBindingUnits:'dimensionless-not-mm-source'};
  limits:{maximumHoles:2;maximumEdgesPerLoop:8;maximumTotalLines:15;maximumSourceObjects:16;snapshotValues:65536;snapshotDepth:20;arrayElements:512;recordFields:48;resultIdPrefixCharacters:20};
}
export interface ConvexPlanarFaceWithHolesResult {
  plane:Surface;outerLoop:ConvexPlanarFaceWithHolesLoop;holeLoops:ConvexPlanarFaceWithHolesLoop[];options:ConvexPlanarFaceWithHolesOptions;
  source:string;sourceVersion:0;model:Model;topology:ConvexPlanarFaceHoleTopology;pcurves:ConvexPlanarHolePcurve[];bindings:ConvexPlanarHoleBinding[];report:ConvexPlanarFaceWithHolesReport;
}
export interface ConvexPlanarHoleBoundaryClassification extends ConvexPlanarFaceBoundaryClassification {loopId:string;loopRole:ConvexPlanarLoopRole}
export interface ConvexPlanarFaceWithHolesUVClassification {
  classification:'inside'|'inside-hole'|'boundary'|'outside'|'outside-domain';material:boolean;holeId:string|null;
  uv:[number,number];pointMM:Point|null;faceNormal:Point|null;
  loopHalfspaces:{loopId:string;loopRole:ConvexPlanarLoopRole;values:number[]}[];boundaries:ConvexPlanarHoleBoundaryClassification[];
}
const LABEL='Own convex planar Face with holes',TOL=CadNumericPolicy.linearToleranceMM;
function check(c:boolean,detail:string):asserts c {if(!c)throw new Error((LABEL+': '+detail).slice(0,1024));}
function finite(n:number):number {check(Number.isFinite(n),'finite native homogeneous/Gram arithmetic required');return n;}
function snapshot(input:unknown,results=false):unknown {
  let budget=results?65536:4096;const copy=(v:unknown,depth:number):unknown=>{check(--budget>=0&&depth<=(results?20:8),'own-data values/depth bound');if(v===null&&results)return null;if(typeof v==='number'){check(Number.isFinite(v),'finite own numbers');return v;}if(typeof v==='string'){check(v.length<=(results?262144:128),'bounded own string');return v;}if(typeof v==='boolean'&&results)return v;check(v!==null&&typeof v==='object','plain own data');const array=Array.isArray(v),proto=Object.getPrototypeOf(v),keys=Reflect.ownKeys(v),descriptors=Object.getOwnPropertyDescriptors(v);check(array?proto===Array.prototype:proto===Object.prototype||proto===null,'foreign own-data prototype');check(keys.length<=(array?(results?513:65):(results?48:16))&&keys.every(k=>typeof k==='string'&&k.length<=128&&'value'in descriptors[k]&&(array&&k==='length'||descriptors[k].enumerable===true)),'getter/symbol/hidden/excess own data');if(array){const n=descriptors.length.value as number;check(Number.isInteger(n)&&n>=0&&n<=(results?512:64)&&keys.length===n+1,'dense bounded own array');return Array.from({length:n},(_,i)=>{check(Object.hasOwn(descriptors,String(i)),'sparse own array');return copy(descriptors[String(i)].value,depth+1);});}return Object.fromEntries((keys as string[]).map(k=>[k,copy(descriptors[k].value,depth+1)]));};return copy(input,0);
}
function record(v:unknown,keys:string[]):Record<string,unknown>{check(v!==null&&typeof v==='object'&&!Array.isArray(v),'own record');const r=v as Record<string,unknown>;check(Object.keys(r).length===keys.length&&keys.every(k=>Object.hasOwn(r,k)),'exact fields required: '+keys.join(','));return r;}
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

/** One actual native affine face with owned outer and opposite inner loop incidence. */
export function buildConvexPlanarFaceWithHoles(planeInput:Surface,outerInput:ConvexPlanarFaceWithHolesLoop,holesInput:ConvexPlanarFaceWithHolesLoop[],inputOptions:ConvexPlanarFaceWithHolesOptions):ConvexPlanarFaceWithHolesResult {
  const planeData=snapshot(planeInput),outerData=snapshot(outerInput),holesData=snapshot(holesInput),optionData=snapshot(inputOptions);
  const p=record(planeData,['kind','id','degreeU','degreeV','knotsU','knotsV','controlPoints','weights']) as unknown as Surface,o=record(optionData,['faceId','evaluationId','resultIdPrefix','orientation']);id(p.id);
  check(Array.isArray(holesData)&&holesData.length>=1&&holesData.length<=2,'one or two authored native hole loops required');
  const admitLoopData=(value:unknown):ConvexPlanarFaceWithHolesLoop=>{const data=record(value,['id','edges']);check(Array.isArray(data.edges)&&data.edges.length>=3&&data.edges.length<=8,'3..8 authored native Lines per loop required');return{id:id(data.id),edges:data.edges.map(edge=>{const curve=record(edge,['kind','id','degree','knots','controlPoints','weights']) as unknown as Curve;id(curve.id);return curve;})};};
  const loops=[admitLoopData(outerData),...holesData.map(admitLoopData)],allEdges=loops.flatMap(loop=>loop.edges);check(allEdges.length<=15,'at most15 original native Lines; existing source0 Model16 limit unchanged');
  check(typeof o.resultIdPrefix==='string'&&o.resultIdPrefix.length<=20&&/^[A-Za-z_][A-Za-z0-9_-]*$/.test(o.resultIdPrefix),'ASCII result prefix1..20 required');check(o.orientation==='forward'||o.orientation==='reverse','explicit forward/reverse face sense required');
  const options:ConvexPlanarFaceWithHolesOptions={faceId:id(o.faceId),evaluationId:id(o.evaluationId),resultIdPrefix:o.resultIdPrefix,orientation:o.orientation},role=(loopIndex:number,name:string,index:number):string=>id(options.resultIdPrefix+'_l'+loopIndex+'_'+name+'_'+index),originals=[p.id,options.faceId,options.evaluationId,...loops.map(loop=>loop.id),...allEdges.map(edge=>edge.id)],generated=loops.flatMap((loop,n)=>loop.edges.flatMap((_,i)=>[role(n,'v',i),role(n,'e',i),role(n,'use',i),role(n,'uv',i)]));check(new Set([...originals,...generated]).size===originals.length+generated.length,'all original/context/generated loop identities must be distinct before native staging');
  const axes=buildAffinePlaneAxes(p,LABEL),admissions=loops.map(loop=>admitConvexNativeLineLoop(loop.edges,axes,LABEL,p)),containmentEvidence:ConvexHoleContainmentEvidence[]=[],outerVertices=admissions[0].verticesUV,outerSign=admissions[0].orientation==='ccw'?1:-1;
  for(let n=1;n<loops.length;n++)for(const [vertexIndex,vertex]of admissions[n].verticesUV.entries())for(let outerEdgeIndex=0;outerEdgeIndex<outerVertices.length;outerEdgeIndex++){
    const measure=directedUVDeterminant(delta(outerVertices[(outerEdgeIndex+1)%outerVertices.length],outerVertices[outerEdgeIndex]),delta(vertex,outerVertices[outerEdgeIndex]),LABEL),value=finite(outerSign*measure.value);check(value>measure.threshold,'every hole vertex must be safely strictly inside every outer native halfspace; touching/outside/crossing holes refused');containmentEvidence.push({holeId:loops[n].id,vertexIndex,outerEdgeIndex,value,unsafeThreshold:measure.threshold});
  }
  const separationEvidence:ConvexHolesSeparationEvidence[]=[];
  if(loops.length===3){
    const verticesA=admissions[1].verticesUV,verticesB=admissions[2].verticesUV;let separated=false;
    for(const axisLoopIndex of [1,2]){
      if(separated)break;const axisVertices=admissions[axisLoopIndex].verticesUV;
      for(let axisEdgeIndex=0;axisEdgeIndex<axisVertices.length;axisEdgeIndex++){
        const anchorUV=axisVertices[axisEdgeIndex],edgeDirectionUV=delta(axisVertices[(axisEdgeIndex+1)%axisVertices.length],anchorUV),measureA=verticesA.map(vertex=>directedUVDeterminant(edgeDirectionUV,delta(vertex,anchorUV),LABEL)),measureB=verticesB.map(vertex=>directedUVDeterminant(edgeDirectionUV,delta(vertex,anchorUV),LABEL)),projectionsA=measureA.map(value=>value.value),projectionsB=measureB.map(value=>value.value),rangeA:[number,number]=[Math.min(...projectionsA),Math.max(...projectionsA)],rangeB:[number,number]=[Math.min(...projectionsB),Math.max(...projectionsB)];
        const forwardGap=finite(rangeB[0]-rangeA[1]),reverseGap=finite(rangeA[0]-rangeB[1]),order:ConvexHolesSeparationEvidence['order']=forwardGap>=reverseGap?'a-before-b':'b-before-a',gap=Math.max(forwardGap,reverseGap),extremalScale=order==='a-before-b'?finite(Math.abs(rangeB[0])+Math.abs(rangeA[1])+1):finite(Math.abs(rangeA[0])+Math.abs(rangeB[1])+1),unsafeThreshold=finite(64*Number.EPSILON*extremalScale+Math.max(...measureA.map(value=>value.threshold))+Math.max(...measureB.map(value=>value.threshold)));
        if(gap>unsafeThreshold){separationEvidence.push({holeAId:loops[1].id,holeBId:loops[2].id,axisLoopId:loops[axisLoopIndex].id,axisEdgeIndex,anchorUV,edgeDirectionUV,projectionsA,projectionsB,rangeA,rangeB,gap,unsafeThreshold,order});separated=true;break;}
      }
    }
    check(separated,'two holes require a safely strict all-vertex separating axis; overlapping/touching/nested/uncertain holes refused');
  }
  const vertices:ConvexPlanarHoleVertex[]=[],edges:ConvexPlanarHoleEdge[]=[],topologicalLoops:ConvexPlanarFaceHoleTopology['loops']=[],pcurves:ConvexPlanarHolePcurve[]=[],bindings:ConvexPlanarHoleBinding[]=[];
  for(const [n,loop]of loops.entries()){
    const loopRole:ConvexPlanarLoopRole=n===0?'outer':'inner',outerTarget=options.orientation==='forward'?'ccw':'cw',target=n===0?outerTarget:outerTarget==='ccw'?'cw':'ccw',forward=admissions[n].orientation===target;
    const loopVertices:ConvexPlanarHoleVertex[]=loop.edges.map((edge,i)=>({id:role(n,'v',i),point:copyCadData(edge.controlPoints[0]),loopId:loop.id,loopRole})),loopEdges:ConvexPlanarHoleEdge[]=loop.edges.map((edge,i)=>({id:role(n,'e',i),curveId:edge.id,vertexIds:[loopVertices[i].id,loopVertices[(i+1)%loopVertices.length].id],loopId:loop.id,loopRole}));vertices.push(...loopVertices);edges.push(...loopEdges);
    const loopPcurves:ConvexPlanarHolePcurve[]=loop.edges.map((edge,i)=>{const curve:Curve={kind:'curve',id:role(n,'uv',i),degree:1,knots:copyCadData(edge.knots),weights:copyCadData(edge.weights),controlPoints:edge.controlPoints.map(point=>mapAffinePlanePointToUV(point,axes,LABEL))};validateCurve(curve);return{id:curve.id,edgeId:loopEdges[i].id,curveId:edge.id,coordinateSystem:'uv',domain:curveDomain(edge),curve,loopId:loop.id,loopRole};});pcurves.push(...loopPcurves);
    const ordered=Array.from({length:loop.edges.length},(_,i)=>forward?i:loop.edges.length-1-i),uses:ConvexPlanarHoleUse[]=ordered.map(i=>{const edge=loopEdges[i],domain=loopPcurves[i].domain;return{id:role(n,'use',i),edgeId:edge.id,curveId:edge.curveId,vertexIds:forward?[edge.vertexIds[0],edge.vertexIds[1]]:[edge.vertexIds[1],edge.vertexIds[0]],sense:forward?'forward':'reverse',interval:forward?[domain[0],domain[1]]:[domain[1],domain[0]],pcurveId:loopPcurves[i].id,loopId:loop.id,loopRole};});
    for(let i=0;i<uses.length;i++)check(uses[i].vertexIds[1]===uses[(i+1)%uses.length].vertexIds[0],'actual directed loop cyclic incidence required');topologicalLoops.push({id:loop.id,role:loopRole,authoredOrientation:admissions[n].orientation,useOrientation:target,uses});
    for(const use of uses){
      const index=loop.edges.findIndex(edge=>edge.id===use.curveId),line=loop.edges[index],pcurve=loopPcurves[index],domain=pcurve.domain,width=finite(domain[1]-domain[0]),mid=finite(domain[0]+width/2);check(width>0&&mid>domain[0]&&mid<domain[1],'native Line midpoint not represented');
      for(const parameter of [use.interval[0],mid,use.interval[1]]){
        const lineD1=evaluateCurveD1(line,parameter),pcurveD1=evaluateCurveD1(pcurve.curve,parameter),uv=pcurveD1.point;check(uv[2]===0&&uv[0]>=axes.domains.u[0]&&uv[0]<=axes.domains.u[1]&&uv[1]>=axes.domains.v[0]&&uv[1]<=axes.domains.v[1],'actual native pcurve outside original Surface chart');const surfaceD1=evaluateSurfaceD1(p,uv[0],uv[1]),pointDifferenceMM=finite(Math.hypot(...delta(lineD1.point,surfaceD1.point)));check(pointDifferenceMM<=TOL,'actual native Line/Surface UV point binding exceeds local policy');const direction=use.sense==='forward'?1:-1,orientedLineTangentMM=lineD1.derivative.map(value=>finite(value*direction)) as Point,orientedSurfaceChainTangentMM=surfaceD1.du.map((value,i)=>finite(finite(multiply(value,pcurveD1.derivative[0])+multiply(surfaceD1.dv[i],pcurveD1.derivative[1]))*direction)) as Point,tangentDifferenceMM=finite(Math.hypot(...delta(orientedLineTangentMM,orientedSurfaceChainTangentMM))),scale=finite(Math.hypot(...orientedLineTangentMM));check(tangentDifferenceMM<=TOL*Math.max(1,scale),'actual original Line/Surface D1 chain binding exceeds local policy');const orientedFaceNormal=normal(surfaceD1,options.orientation);check(finite(Math.hypot(...delta(orientedFaceNormal,axes.unitNormal.map(value=>value*(options.orientation==='forward'?1:-1)) as Point)))<=TOL,'actual native Surface D1 face-normal/sense binding');bindings.push({useId:use.id,edgeId:use.edgeId,curveId:line.id,pcurveId:pcurve.id,parameter,traversalSense:use.sense,lineD1,pcurveD1,surfaceD1,pointDifferenceMM,orientedLineTangentMM,orientedSurfaceChainTangentMM,tangentDifferenceMM,orientedFaceNormal,loopId:loop.id,loopRole});
      }
      const endpoints=bindings.slice(-3);for(const [sample,vertexId]of [[endpoints[0],use.vertexIds[0]],[endpoints[2],use.vertexIds[1]]] as const){const vertex=loopVertices.find(value=>value.id===vertexId);check(vertex!==undefined&&finite(Math.hypot(...delta(sample.lineD1.point,vertex.point)))<=TOL,'actual directed use/native vertex point incidence');}
    }
  }
  const topology:ConvexPlanarFaceHoleTopology={version:0,face:{id:options.faceId,surfaceId:p.id,outerLoopId:loops[0].id,innerLoopIds:loops.slice(1).map(loop=>loop.id),orientation:options.orientation},vertices,edges,loops:topologicalLoops},file=adopt(p,allEdges,options.evaluationId),ownedLoops=loops.map((loop,n)=>({id:loop.id,edges:file.model.objects.slice(1+loops.slice(0,n).reduce((sum,value)=>sum+value.edges.length,0),1+loops.slice(0,n+1).reduce((sum,value)=>sum+value.edges.length,0)) as Curve[]}));
  const result:ConvexPlanarFaceWithHolesResult=copyCadData({plane:file.model.objects[0] as Surface,outerLoop:ownedLoops[0],holeLoops:ownedLoops.slice(1),options,...file,sourceVersion:0,topology,pcurves,bindings,report:{family:'own-affine-convex-native-line-planar-face-with-holes',faceId:options.faceId,evaluationId:options.evaluationId,surfaceId:p.id,outerLoopId:loops[0].id,holeIds:loops.slice(1).map(loop=>loop.id),faceSense:options.orientation,authoredCurveIds:allEdges.map(edge=>edge.id),incidenceValid:true,geometricValidity:'not-certified',topologyCertified:false,solid:false,loopCount:loops.length,edgeCount:allEdges.length,bindingCount:bindings.length,containmentEvidence,separationEvidence,convexityEvidence:loops.map((loop,n)=>({loopId:loop.id,evidence:admissions[n].convexityEvidence})),numericPolicy:{pointBindingComparisonMM:TOL,relativeD1Comparison:TOL,boundaryClassification:'exact-zero-or-64-epsilon-uncertainty-refusal',holeSeparation:'all-vertex-native-edge-normal-separating-axis',uvBindingUnits:'dimensionless-not-mm-source'},limits:{maximumHoles:2,maximumEdgesPerLoop:8,maximumTotalLines:15,maximumSourceObjects:16,snapshotValues:65536,snapshotDepth:20,arrayElements:512,recordFields:48,resultIdPrefixCharacters:20}}});return snapshot(result,true) as ConvexPlanarFaceWithHolesResult;
}
function rebuild(input:ConvexPlanarFaceWithHolesResult):ConvexPlanarFaceWithHolesResult {
  const owned=snapshot(input,true) as ConvexPlanarFaceWithHolesResult;check(owned!==null&&typeof owned==='object'&&!Array.isArray(owned),'owned convex planar face with holes required');const expected=buildConvexPlanarFaceWithHoles(owned.plane,owned.outerLoop,owned.holeLoops,owned.options);check(same(owned,expected),'owned source/inner-role/order/pcurve/interval/sense/vertex/loop identity/report mismatch');return expected;
}
/** Incidence and local native bindings only, without a geometric/topological certificate. */
export function validateConvexPlanarFaceWithHoles(input:ConvexPlanarFaceWithHolesResult):ConvexPlanarFaceWithHolesReport {return copyCadData(rebuild(input).report);}
/** Material/hole classification in actual native UV, with no out-of-chart Surface evaluation. */
export function classifyConvexPlanarFaceWithHolesUV(input:ConvexPlanarFaceWithHolesResult,uvInput:[number,number]):ConvexPlanarFaceWithHolesUVClassification {
  const query=snapshot(uvInput),face=rebuild(input);check(Array.isArray(query)&&query.length===2&&query.every(value=>typeof value==='number'&&Number.isFinite(value)),'finite native UV pair required');const uv=query as [number,number],axes=buildAffinePlaneAxes(face.plane,LABEL),insideDomain=uv[0]>=axes.domains.u[0]&&uv[0]<=axes.domains.u[1]&&uv[1]>=axes.domains.v[0]&&uv[1]<=axes.domains.v[1];
  if(!insideDomain)return{classification:'outside-domain',material:false,holeId:null,uv,pointMM:null,faceNormal:null,loopHalfspaces:[],boundaries:[]};
  const loops=[face.outerLoop,...face.holeLoops],loopHalfspaces:ConvexPlanarFaceWithHolesUVClassification['loopHalfspaces']=[],memberships:{inside:boolean;boundaryIndices:number[]}[]=[];
  for(const [n,loop]of loops.entries()){
    const pcurves=face.pcurves.filter(pcurve=>pcurve.loopId===loop.id),vertices=pcurves.map(pcurve=>pcurve.curve.controlPoints[0]),topologyLoop=face.topology.loops.find(value=>value.id===loop.id);check(topologyLoop!==undefined,'actual original loop/topology association required');const sign=topologyLoop.authoredOrientation==='ccw'?1:-1,values:number[]=[],boundaryIndices:number[]=[];
    for(let i=0;i<vertices.length;i++){const measure=directedUVDeterminant(delta(vertices[(i+1)%vertices.length],vertices[i]),delta([uv[0],uv[1],0],vertices[i]),LABEL),value=finite(sign*measure.value);check(value===0||Math.abs(value)>measure.threshold,'native UV query is an unresolved near-boundary determinant');values.push(value);if(value===0)boundaryIndices.push(i);}
    const inside=values.every(value=>value>=0);memberships.push({inside,boundaryIndices:inside?boundaryIndices:[]});loopHalfspaces.push({loopId:loop.id,loopRole:n===0?'outer':'inner',values});
  }
  const surfaceD1=evaluateSurfaceD1(face.plane,uv[0],uv[1]),pointMM=surfaceD1.point,faceNormal=normal(surfaceD1,face.options.orientation);let classification:ConvexPlanarFaceWithHolesUVClassification['classification']='inside',holeId:string|null=null,boundaryLoopIndex:number|null=null;
  if(!memberships[0].inside)classification='outside';else if(memberships[0].boundaryIndices.length){classification='boundary';boundaryLoopIndex=0;}else for(let n=1;n<memberships.length;n++)if(memberships[n].inside){check(holeId===null,'separated authored hole classification cannot overlap');holeId=loops[n].id;if(memberships[n].boundaryIndices.length){classification='boundary';boundaryLoopIndex=n;}else classification='inside-hole';}
  const boundaries:ConvexPlanarHoleBoundaryClassification[]=[];
  if(boundaryLoopIndex!==null){
    const loop=loops[boundaryLoopIndex],pcurves=face.pcurves.filter(pcurve=>pcurve.loopId===loop.id),topologyLoop=face.topology.loops.find(value=>value.id===loop.id);check(topologyLoop!==undefined,'original loop/use association required');
    for(const index of memberships[boundaryLoopIndex].boundaryIndices){const line=loop.edges[index],pcurve=pcurves[index],start=pcurve.curve.controlPoints[0],direction=delta(pcurve.curve.controlPoints[1],start),axis=Math.abs(direction[0])>=Math.abs(direction[1])?0:1,difference=finite(uv[axis]-start[axis]);check(direction[axis]!==0,'native boundary dominant UV axis not represented');const fraction=finite(difference/direction[axis]);check(difference===0||fraction!==0,'nonzero boundary Line coordinate underflowed');check(fraction>=0&&fraction<=1,'boundary point outside original finite Line interval');const domain=curveDomain(line),lineParameter=fraction===0?domain[0]:fraction===1?domain[1]:finite(domain[0]+finite(domain[1]-domain[0])*fraction);check(fraction===0||fraction===1||lineParameter>domain[0]&&lineParameter<domain[1],'boundary native Line parameter rounded to endpoint');const use=topologyLoop.uses.find(value=>value.curveId===line.id);check(use!==undefined,'actual boundary Line/use association required');const lineD1=evaluateCurveD1(line,lineParameter),pointDifferenceMM=finite(Math.hypot(...delta(pointMM,lineD1.point)));check(pointDifferenceMM<=TOL,'actual boundary Surface/Line query binding exceeds local policy');boundaries.push({edgeId:use.edgeId,curveId:line.id,useId:use.id,pcurveId:pcurve.id,lineParameter,traversalSense:use.sense,lineD1,pointDifferenceMM,orientedLineTangentMM:lineD1.derivative.map(value=>finite(value*(use.sense==='forward'?1:-1))) as Point,loopId:loop.id,loopRole:boundaryLoopIndex===0?'outer':'inner'});}
  }
  return copyCadData({classification,material:classification==='inside'||classification==='boundary',holeId,uv,pointMM,faceNormal,loopHalfspaces,boundaries});
}
