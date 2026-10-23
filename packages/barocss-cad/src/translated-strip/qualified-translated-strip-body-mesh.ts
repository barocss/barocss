import { validateQualifiedTranslatedStripBody } from './qualified-translated-strip-body.js';
import type { QualifiedTranslatedStripBodyResult } from './qualified-translated-strip-body.js';
import { buildQualifiedStripMeshFaceSamplesTrusted } from './qualified-translated-strip-body-mesh-domain-internal.js';
import { curveDomain, evaluateCurve, evaluateSurface } from '../math.js';
import { evaluateSurfaceD1 } from '../derivatives.js';
import type { Point, Surface } from '../types.js';

export const QualifiedTranslatedStripBodyMeshDiagnosticCode = Object.freeze({ INPUT:'INPUT', BUDGET:'BUDGET', BODY:'BODY', SOURCE:'SOURCE', TOPOLOGY:'TOPOLOGY', UV:'UV', NATIVE:'NATIVE', ORIENTATION:'ORIENTATION', REPRESENTABILITY:'REPRESENTABILITY', FILE:'FILE', OWNED:'OWNED' } as const);
export type QualifiedTranslatedStripBodyMeshDiagnosticCode = typeof QualifiedTranslatedStripBodyMeshDiagnosticCode[keyof typeof QualifiedTranslatedStripBodyMeshDiagnosticCode];
export class QualifiedTranslatedStripBodyMeshError extends Error {
  readonly code:QualifiedTranslatedStripBodyMeshDiagnosticCode;
  constructor(code:QualifiedTranslatedStripBodyMeshDiagnosticCode,detail:string,cause?:unknown) {super(('Qualified translated-strip Body mesh: '+detail).slice(0,1024),cause===undefined?undefined:{cause});this.name='QualifiedTranslatedStripBodyMeshError';this.code=code;}
}
export interface QualifiedTranslatedStripBodyMeshOptions {evaluationId:string;meshId:string;subdivisionsPerOriginalUSpan:4;subdivisionsT:4;subdivisionsW:4;maximumVertices:290;maximumTriangles:576;maximumNativeSamples:1104}
type Face=QualifiedTranslatedStripBodyResult['faces'][number];
type Edge=QualifiedTranslatedStripBodyResult['edges'][number];
type FaceRole=Face['role'];
type Ref=Face['supportRef'];
type UV=[number,number];
type Key=[number,number,number];
type Vertex={index:number;key:Key;point:Point;kind:'stored-corner'|'native-edge'|'native-face';globalVertexId:string|null;globalEdgeId:string|null;faceId:string|null;sourceRef:Ref|null;edgeSampleIndex:number|null;faceSampleIndex:number|null};
type Triangle={index:number;faceId:string;role:FaceRole;cell:[number,number];withinCell:0|1;vertexIndices:[number,number,number];faceSampleIndices:[number,number,number]};
type EdgeSample={index:number;parameter:number;vertexIndex:number;point:Point;endpointVertexId:string|null;storedCorner:Point|null;endpointGapMM:number|null};
type UseSample={index:number;parameter:number;vertexIndex:number;uv:UV;curvePoint:Point};
type UseSamples={useId:string;faceId:string;loopId:string;sense:Edge['uses'][number]['sense'];interval:[number,number];pcurveId:string;origin:Edge['uses'][number]['origin'];samples:UseSample[]};
type EdgePath={edgeId:string;role:Edge['role'];curveId:string;curveRef:Ref;vertexIds:[string,string];parameterRange:[number,number];logicalDirection:'increasing'|'decreasing';samples:EdgeSample[];uses:UseSamples[]};
type D1State={status:'evaluated';point:Point;du:Point;dv:Point;orientedNormal:Point;pointGapMM:number}|{status:'refused-c0';name:string;reason:string;point:null;du:null;dv:null;orientedNormal:null;pointGapMM:null};
type FaceSample={index:number;faceId:string;role:FaceRole;supportRef:Ref;grid:[number,number];vertexIndex:number;nominalUV:UV;uv:UV;boundaryUseSamples:{edgeId:string;useId:string;sampleIndex:number}[];chosenUseId:string|null;alternateUVGap:number|null;point:Point;anchorPoint:Point;anchorGapMM:number;d1:D1State};
type RenderChunk={faceId:string;role:FaceRole;orientation:Face['orientation'];normalSource:'approximate-triangle-geometry';positionEncoding:'float32-number';normalEncoding:'float32-number';uvEncoding:'binary64-number';indexEncoding:'uint32-number';positionsMM:number[];normals:number[];parametersUV:number[];indices:number[];authorityIndices:number[];faceSampleIndices:number[];triangleIndices:number[];quantizationGapsMM:number[]};
type SourceCatalog={sourceId:string;sourceModelId:string;objectId:string;kind:'Curve'|'Surface';globalEdgeIds:string[];faceIds:string[]};
type BoundaryPath={edgeId:string;useId:string;pcurveId:string;sense:Edge['uses'][number]['sense'];interval:[number,number];vertexIndices:number[]};
type FaceRange={faceId:string;role:FaceRole;orientation:Face['orientation'];supportRef:Ref;origin:Face['origin'];materialImageRole:FaceRole;chart:'u-t'|'u-w'|'t-w';gridSize:[number,number];sampleRange:[number,number];triangleRange:[number,number];vertexIndices:number[];storedUseIds:string[];boundaryPaths:BoundaryPath[]};
type TriangleUse={triangleIndex:number;side:0|1|2;from:number;to:number};
type EdgeIncidence={vertexIndices:[number,number];uses:[TriangleUse,TriangleUse];kind:'face-grid'|'face-diagonal'|'cad-edge';globalEdgeId:string|null};
type VertexLink={vertexIndex:number;cycle:number[];triangleIndices:number[];globalVertexId:string|null;globalEdgeId:string|null};
type Proof={sourceCatalog:SourceCatalog[];faceRanges:FaceRange[];edgeIncidence:EdgeIncidence[];vertexLinks:VertexLink[];connectedTriangles:true;connectedVertices:true;eulerCharacteristic:2;parentMaterialCertificateId:string;parentFlagsUnchanged:true};
export interface QualifiedTranslatedStripBodyMeshPacket {schema:'barocss-qualified-translated-strip-body-mesh';version:0;meshId:string;bodyId:string;shellId:string;materialCertificateId:string;lengthUnit:'mm';sourceFrame:'authored-xyz-no-axis-conversion';positionEncoding:'binary64-number';indexEncoding:'uint32-number';positionsMM:number[];indices:number[];vertices:Vertex[];triangles:Triangle[];bounds:{min:Point;max:Point}}
type DirectCounts={bodyValidationCount:1;worldCurveD0Count:number;usePCurveD0Count:number;surfaceD0Count:number;surfaceD1AttemptCount:number;surfaceD1EvaluatedCount:number;surfaceD1RefusedCount:number;nativeAttemptCount:number;curveD1Count:0;surfaceD2Count:0;sourceCompilationCount:0;sourceWriterCount:0;newBodyConstructionCount:0;rationalFloatConversionCount:0;rootSolverCount:0;refinementCount:0};
type Quality={trimmedSixFaceSamples:true;sourceQualified:true;closedIndexedManifold:true;parentFlagsUnchanged:true;approximateTriangles:true;facetNormalsApproximate:true;float32DisplayValidated:true;storedCornerAuthority:true;welding:false;snapping:false;meshGeometricEmbedding:false;globalApproximationError:false;newSolidCertification:false;manufacturing:false;rendererAcceptance:false;loaderAcceptance:false;publication:false;ownership:'independent-copied-cpu-data-gc'};
type Limits={maximumOriginalSpans:4;subdivisionsPerOriginalUSpan:4;subdivisionsT:4;subdivisionsW:4;maximumUStations:17;maximumVertices:290;maximumTriangles:576;maximumMeshEdges:864;maximumFaceSamples:390;maximumUseSamples:216;maximumNativeAttempts:1104;maximumRenderVertices:1728;maximumFileUTF16:4194304;maximumFileUTF8:4194304;parentBodyMaximumFileUTF16:2097152;parentBodyMaximumFileUTF8:2097152;ownValues:4194304;ownDepth:64;arrayElements:8192;recordFields:64;keyCharacters:128;stringCharacters:262144;identifierCharacters:48;maximumObservedGapMM:1e-7;normalUnitResidual:1e-5};
export interface QualifiedTranslatedStripBodyMeshReport {schema:'barocss-qualified-translated-strip-body-mesh-report';version:0;evaluationId:string;meshId:string;bodyId:string;shellId:string;materialCertificateId:string;spanCount:number;uStationCount:number;vertexCount:number;triangleCount:number;meshEdgeCount:number;faceCount:6;cadEdgeCount:12;cornerCount:8;edgeInteriorCount:number;faceInteriorCount:number;faceSampleCount:number;useSampleCount:number;renderVertexCount:number;nativeNormalEvaluatedCount:number;nativeNormalRefusedCount:number;maximumObservedEndpointGapMM:number;maximumObservedAnchorGapMM:number;maximumObservedD1PointGapMM:number;maximumObservedAlternateUVGap:number;maximumObservedFloat32QuantizationGapMM:number;fileSizes:{request:{utf16:number;utf8:number};result:{utf16:number;utf8:number}};directCounts:DirectCounts;quality:Quality;limits:Limits;workScope:'new-root-native-attempts-parent-validation-work-retained-and-excluded';budgetFailure:'atomic-no-partial-mesh'}
export interface QualifiedTranslatedStripBodyMeshResult {body:QualifiedTranslatedStripBodyResult;options:QualifiedTranslatedStripBodyMeshOptions;packet:QualifiedTranslatedStripBodyMeshPacket;edgePaths:EdgePath[];faceSamples:FaceSample[];renderChunks:RenderChunk[];proof:Proof;report:QualifiedTranslatedStripBodyMeshReport}

const CODE=QualifiedTranslatedStripBodyMeshDiagnosticCode;
function fail(code:QualifiedTranslatedStripBodyMeshDiagnosticCode,detail:string,cause?:unknown):never {throw new QualifiedTranslatedStripBodyMeshError(code,detail,cause)}
function check(condition:boolean,code:QualifiedTranslatedStripBodyMeshDiagnosticCode,detail:string):asserts condition {if(!condition)fail(code,detail)}
function finite(value:number):number {check(Number.isFinite(value),CODE.REPRESENTABILITY,'Native mesh arithmetic must be finite');return value}
function point(value:Point):Point {check(Array.isArray(value)&&value.length===3&&value.every(Number.isFinite),CODE.REPRESENTABILITY,'An actual finite native XYZ triple is required');return [value[0],value[1],value[2]]}
function gap(a:Point,b:Point):number {return finite(Math.hypot(finite(a[0]-b[0]),finite(a[1]-b[1]),finite(a[2]-b[2])))}
function same(a:unknown,b:unknown):boolean {if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,i)=>same(value,b[i]));if(a&&b&&typeof a==='object'&&typeof b==='object'){const x=a as Record<string,unknown>,y=b as Record<string,unknown>;return Object.keys(x).length===Object.keys(y).length&&Object.keys(x).every(key=>Object.hasOwn(y,key)&&same(x[key],y[key]))}return Object.is(a,b)}
function record(input:unknown,fields:string[],code:QualifiedTranslatedStripBodyMeshDiagnosticCode=CODE.INPUT):Record<string,unknown> {check(input!==null&&typeof input==='object'&&!Array.isArray(input),code,'Exact own record required');const value=input as Record<string,unknown>;check(Object.keys(value).length===fields.length&&fields.every(field=>Object.hasOwn(value,field)),code,'Exact frozen own fields required');return value}
function id(input:unknown):string {check(typeof input==='string'&&input.length<=48&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(input),CODE.INPUT,'New ASCII identifier1..48 required');return input}
function snapshot(input:unknown,owned=false):unknown {
  const code=owned?CODE.OWNED:CODE.INPUT;let remaining=4194304;const ancestors=new Set<object>();
  const copy=(value:unknown,depth:number):unknown=>{
    check(--remaining>=0&&depth<=64,owned?CODE.OWNED:CODE.BUDGET,'Complete mesh own value/depth budget exceeded');
    if(value===null||typeof value==='boolean')return value;
    if(typeof value==='number'){check(Number.isFinite(value),code,'Finite represented own numbers required');return value}
    if(typeof value==='string'){check(value.length<=262144,owned?CODE.OWNED:CODE.BUDGET,'Own string budget exceeded');return value}
    check(typeof value==='object'&&!ancestors.has(value),code,'Acyclic own data required');
    const array=Array.isArray(value),prototype=Object.getPrototypeOf(value),keys=Reflect.ownKeys(value),descriptors=Object.getOwnPropertyDescriptors(value);
    check(array?prototype===Array.prototype:prototype===Object.prototype||prototype===null,code,'Plain own-data prototypes required');
    check(keys.length<=(array?8193:64)&&keys.every(key=>typeof key==='string'&&key.length<=128&&'value'in descriptors[key]&&(array&&key==='length'||descriptors[key].enumerable===true)),code,'Bounded data fields without getters/symbols/hidden values required');
    ancestors.add(value);let result:unknown;
    if(array){const length=descriptors.length.value as number;check(Number.isInteger(length)&&length>=0&&length<=8192&&keys.length===length+1,code,'Dense bounded arrays required');result=Array.from({length},(_,i)=>{check(Object.hasOwn(descriptors,String(i)),code,'Sparse or extra array fields refused');return copy(descriptors[String(i)].value,depth+1)})}
    else result=Object.fromEntries((keys as string[]).map(key=>[key,copy(descriptors[key].value,depth+1)]));
    ancestors.delete(value);return result;
  };
  try{return copy(input,0)}catch(cause){if(cause instanceof QualifiedTranslatedStripBodyMeshError)throw cause;fail(code,'Own mesh snapshot refused',cause)}
}
/** Count the complete canonical own JSON, preserving -0 and its final newline. */
function fileSize(input:unknown):{utf16:number;utf8:number} {
  let utf16=0,utf8=0;const encoder=new TextEncoder();
  const append=(text:string):void=>{utf16+=text.length;utf8+=encoder.encode(text).length;check(utf16<=4194304&&utf8<=4194304,CODE.FILE,'Complete mesh JSON exceeds4194304 UTF16/UTF8 units')};
  const visit=(value:unknown):void=>{if(value===null||typeof value==='boolean'||typeof value==='string'){append(JSON.stringify(value));return}if(typeof value==='number'){check(Number.isFinite(value),CODE.INPUT,'Finite own JSON number required');append(Object.is(value,-0)?'-0':JSON.stringify(value));return}if(Array.isArray(value)){append('[');value.forEach((item,i)=>{if(i)append(',');visit(item)});append(']');return}check(value!==null&&typeof value==='object',CODE.INPUT,'Canonical own JSON data required');append('{');Object.entries(value).forEach(([key,item],i)=>{if(i)append(',');append(JSON.stringify(key));append(':');visit(item)});append('}')};
  visit(input);append('\n');return {utf16,utf8};
}
const roles:FaceRole[]=['lower','upper','cap','base','uMin','uMax'];
const edgeRoles:Edge['role'][]=['lowerBottom','upperBottom','lowerCut','upperCut','lowerLeft','lowerRight','upperLeft','upperRight','capLeft','capRight','baseLeft','baseRight'];
const edgeEndpoints:[number,number][]=[[0,1],[4,5],[3,2],[7,6],[3,0],[1,2],[7,4],[5,6],[7,3],[2,6],[0,4],[1,5]];
function keyString(key:Key):string {return key.join(':')}
function pairString(a:number,b:number):string {return a<b?a+':'+b:b+':'+a}
function normalizedCross(a:Point,b:Point,c:Point):{cross:Point;normal:Point} {
  const u=a.map((v,k)=>finite(b[k]-v)) as Point,v=a.map((x,k)=>finite(c[k]-x)) as Point;
  const cross:Point=[finite(finite(u[1]*v[2])-finite(u[2]*v[1])),finite(finite(u[2]*v[0])-finite(u[0]*v[2])),finite(finite(u[0]*v[1])-finite(u[1]*v[0]))],length=finite(Math.hypot(...cross));
  check(length>0,CODE.REPRESENTABILITY,'Actual sampled triangle collapsed or its cross product underflowed');return {cross,normal:cross.map(x=>finite(x/length)) as Point};
}
function dot(a:Point,b:Point):number {return finite(finite(finite(a[0]*b[0])+finite(a[1]*b[1]))+finite(a[2]*b[2]))}
function connected(adjacency:number[][],detail:string):void {check(adjacency.length>0,CODE.TOPOLOGY,detail);const reached=new Set<number>([0]),queue=[0];for(let i=0;i<queue.length;i++)for(const neighbor of adjacency[queue[i]])if(!reached.has(neighbor)){reached.add(neighbor);queue.push(neighbor)}check(reached.size===adjacency.length,CODE.TOPOLOGY,detail)}

/** Approximate the actual six trimmed Faces while retaining complete qualified Body authority. */
export function tessellateQualifiedTranslatedStripBody(bodyInput:QualifiedTranslatedStripBodyResult,optionsInput:QualifiedTranslatedStripBodyMeshOptions):QualifiedTranslatedStripBodyMeshResult {
  const data=record(snapshot({body:bodyInput,options:optionsInput}),['body','options']),settings=record(data.options,['evaluationId','meshId','subdivisionsPerOriginalUSpan','subdivisionsT','subdivisionsW','maximumVertices','maximumTriangles','maximumNativeSamples']);
  check(settings.subdivisionsPerOriginalUSpan===4&&settings.subdivisionsT===4&&settings.subdivisionsW===4&&settings.maximumVertices===290&&settings.maximumTriangles===576&&settings.maximumNativeSamples===1104,CODE.BUDGET,'Frozen4/4/4/290/576/1104 profile required before parent/native work');
  const options:QualifiedTranslatedStripBodyMeshOptions={evaluationId:id(settings.evaluationId),meshId:id(settings.meshId),subdivisionsPerOriginalUSpan:4,subdivisionsT:4,subdivisionsW:4,maximumVertices:290,maximumTriangles:576,maximumNativeSamples:1104};
  check(options.evaluationId!==options.meshId,CODE.INPUT,'New evaluation and mesh identifiers must be distinct');const body=data.body as QualifiedTranslatedStripBodyResult,requestSize=fileSize({body,options});
  try{validateQualifiedTranslatedStripBody(body)}catch(cause){fail(CODE.BODY,'Complete qualified Body owned validation refused',cause)}
  check(body.vertices.length===8&&body.edges.length===12&&body.faces.length===6&&body.faces.every((face,i)=>face.role===roles[i]),CODE.TOPOLOGY,'Actual canonical8/12/6 parent graph required');
  const n=body.volume.spans.length,q=4*n+1,uStations=body.volume.lowerWall.binding.observations.map(slot=>slot.parameter);
  check(n>=1&&n<=4&&uStations.length===q&&uStations.every((u,i)=>Number.isFinite(u)&&(i===0||u>uStations[i-1])),CODE.BUDGET,'Distinct actual original-span quartile stations must fit1..4/17');
  check(same(uStations,body.volume.upperWall.binding.observations.map(slot=>slot.parameter)),CODE.UV,'Both actual walls must retain the same native U station schedule');
  for(const [i,span] of body.volume.spans.entries())check(Object.is(uStations[4*i],span.domain[0])&&Object.is(uStations[4*i+4],span.domain[1])&&uStations.slice(4*i+1,4*i+4).every(u=>u>span.domain[0]&&u<span.domain[1]),CODE.UV,'Every original-span schedule must retain its actual endpoints and three internal quartiles');

  const sourceCatalog:SourceCatalog[]=[],catalogKeys=new Set<string>();
  check(body.models.length===2&&body.models[0].model.objects.length===16&&body.models[1].model.objects.length===2&&body.models[0].model.name!==body.models[1].model.name,CODE.SOURCE,'Actual full Models16+2 must remain separately qualified');
  for(const asset of body.models)for(const object of asset.model.objects){
    const ref={sourceModelId:asset.model.name,objectId:object.id},key=ref.sourceModelId+':'+ref.objectId,edges=body.edges.filter(edge=>same(edge.curveRef,ref)),faces=body.faces.filter(face=>same(face.supportRef,ref));
    check(!catalogKeys.has(key)&&((object.kind==='curve'&&edges.length===1&&faces.length===0&&same(object,edges[0].curve))||(object.kind==='surface'&&faces.length===1&&edges.length===0&&same(object,faces[0].nativeSurface))),CODE.SOURCE,'Every actual source-qualified object must resolve exactlyone complete Curve or support');catalogKeys.add(key);
    const receipt=body.proof.geometryCatalog.find(item=>item.sourceId===asset.sourceId&&item.sourceModelId===asset.model.name&&item.objectId===object.id);
    check(receipt!==undefined&&receipt.kind===object.kind,CODE.SOURCE,'Actual parent geometry catalog must preserve sourceId separately from Model.name');
    sourceCatalog.push({sourceId:asset.sourceId,sourceModelId:asset.model.name,objectId:object.id,kind:object.kind==='curve'?'Curve':'Surface',globalEdgeIds:edges.map(edge=>edge.id),faceIds:faces.map(face=>face.id)});
  }
  check(sourceCatalog.length===18,CODE.SOURCE,'All18 actual objects must be catalogued without widening Model caps');
  for(const face of body.faces){const image=body.proof.material.sixFaceImages.find(item=>item.faceId===face.id&&item.role===face.role);check(image!==undefined&&same(image.supportRef,face.supportRef)&&same(image.actualSurface,face.nativeSurface)&&image.orientation===face.orientation,CODE.SOURCE,'Every actual trimmed Face must bind its unchanged whole parent material image')}

  const counts:DirectCounts={bodyValidationCount:1,worldCurveD0Count:0,usePCurveD0Count:0,surfaceD0Count:0,surfaceD1AttemptCount:0,surfaceD1EvaluatedCount:0,surfaceD1RefusedCount:0,nativeAttemptCount:0,curveD1Count:0,surfaceD2Count:0,sourceCompilationCount:0,sourceWriterCount:0,newBodyConstructionCount:0,rationalFloatConversionCount:0,rootSolverCount:0,refinementCount:0};
  const attempt=(kind:'worldCurveD0Count'|'usePCurveD0Count'|'surfaceD0Count'|'surfaceD1AttemptCount'):void=>{check(counts.nativeAttemptCount<1104,CODE.BUDGET,'Direct native attempt cap exceeded');counts[kind]++;counts.nativeAttemptCount++};
  const native=<T>(kind:'worldCurveD0Count'|'usePCurveD0Count'|'surfaceD0Count',action:()=>T):T=>{attempt(kind);try{return action()}catch(cause){if(cause instanceof QualifiedTranslatedStripBodyMeshError)throw cause;fail(CODE.NATIVE,'Actual '+kind+' evaluation refused',cause)}};
  const cornerKeys:Key[]=[[0,0,0],[q-1,0,0],[q-1,4,0],[0,4,0],[0,0,4],[q-1,0,4],[q-1,4,4],[0,4,4]],vertices:Vertex[]=body.vertices.map((vertex,index):Vertex=>({index,key:[...cornerKeys[index]],point:point(vertex.world),kind:'stored-corner',globalVertexId:vertex.id,globalEdgeId:null,faceId:null,sourceRef:null,edgeSampleIndex:null,faceSampleIndex:null})),keyMap=new Map(vertices.map(vertex=>[keyString(vertex.key),vertex.index])),globalVertexMap=new Map(body.vertices.map((vertex,i)=>[vertex.id,i]));
  check(globalVertexMap.size===8,CODE.TOPOLOGY,'Eight actual global corner IDs required');
  const addVertex=(key:Key,value:Omit<Vertex,'index'|'key'>):number=>{check(!keyMap.has(keyString(key))&&vertices.length<290,CODE.TOPOLOGY,'Each shared cube key must have one bounded authority position');const index=vertices.length;vertices.push({index,key:[...key],...value,point:point(value.point)});keyMap.set(keyString(key),index);return index};
  const edgePaths:EdgePath[]=body.edges.map((edge,edgeIndex):EdgePath=>{
    const [from,to]=edgeEndpoints[edgeIndex];check(edge.role===edgeRoles[edgeIndex]&&edge.vertexIds[0]===body.vertices[from].id&&edge.vertexIds[1]===body.vertices[to].id&&same(edge.parameterRange,curveDomain(edge.curve)),CODE.TOPOLOGY,'Actual global Edge endpoint order must match canonical cube roles and native domain');
    const long=edgeIndex<4,start=cornerKeys[from],end=cornerKeys[to],axis=start.findIndex((v,k)=>v!==end[k]);check(axis>=0&&start.every((v,k)=>k===axis||v===end[k]),CODE.TOPOLOGY,'Every actual CAD Edge varies exactlyone logical axis');
    const slotCount=long?q:5,parameters=long?uStations:Array.from({length:5},(_,j)=>j===0?edge.parameterRange[0]:j===4?edge.parameterRange[1]:finite(edge.parameterRange[0]+finite((edge.parameterRange[1]-edge.parameterRange[0])*(j/4))));
    check(Object.is(parameters[0],edge.parameterRange[0])&&Object.is(parameters[slotCount-1],edge.parameterRange[1])&&parameters.every((v,j)=>j===0||v>parameters[j-1]),CODE.UV,'Actual canonical Edge sample schedule must retain distinct native parameters and endpoints');
    const samples:EdgeSample[]=parameters.map((parameter,index):EdgeSample=>{
      const xyz=point(native('worldCurveD0Count',()=>evaluateCurve(edge.curve,parameter))),key:[number,number,number]=[...start];key[axis]=start[axis]+(end[axis]>start[axis]?index:-index);check(key.every(Number.isInteger),CODE.TOPOLOGY,'Logical Edge associations must remain integer keys');
      const endpoint=index===0?from:index===slotCount-1?to:null;let vertexIndex:number,storedCorner:Point|null=null,endpointGapMM:number|null=null;
      if(endpoint!==null){vertexIndex=endpoint;storedCorner=point(body.vertices[endpoint].world);endpointGapMM=gap(xyz,storedCorner);check(endpointGapMM<=1e-7,CODE.UV,'Actual Curve endpoint-to-stored Vertex gap exceeds1e-7mm');check(keyMap.get(keyString(key))===vertexIndex,CODE.TOPOLOGY,'Canonical Edge endpoints must alias actual stored corner identity')}
      else vertexIndex=addVertex(key,{point:xyz,kind:'native-edge',globalVertexId:null,globalEdgeId:edge.id,faceId:null,sourceRef:{...edge.curveRef},edgeSampleIndex:index,faceSampleIndex:null});
      return {index,parameter,vertexIndex,point:xyz,endpointVertexId:endpoint===null?null:body.vertices[endpoint].id,storedCorner,endpointGapMM};
    });
    const uses:UseSamples[]=edge.uses.map((use):UseSamples=>{check(use.edgeId===edge.id&&use.origin.curveId===edge.curve.id&&use.origin.pcurveId===use.pcurve.curve.id&&same(curveDomain(use.pcurve.curve),edge.parameterRange),CODE.UV,'Actual Use pcurve must retain shared original Edge parameter domain');return {useId:use.id,faceId:use.faceId,loopId:use.loopId,sense:use.sense,interval:[...use.interval],pcurveId:use.pcurve.curve.id,origin:use.origin,samples:samples.map((sample):UseSample=>{const value=point(native('usePCurveD0Count',()=>evaluateCurve(use.pcurve.curve,sample.parameter)));check(value[2]===0,CODE.UV,'Actual native pcurve D0 must remain in its two-coordinate chart');return {index:sample.index,parameter:sample.parameter,vertexIndex:sample.vertexIndex,uv:[value[0],value[1]],curvePoint:value}})}});
    return {edgeId:edge.id,role:edge.role,curveId:edge.curve.id,curveRef:{...edge.curveRef},vertexIds:[...edge.vertexIds],parameterRange:[...edge.parameterRange],logicalDirection:end[axis]>start[axis]?'increasing':'decreasing',samples,uses};
  });
  check(vertices.length===4*q+24&&counts.worldCurveD0Count===4*q+40&&counts.usePCurveD0Count===8*q+80,CODE.TOPOLOGY,'All actual canonical Edge anchors and inclusive native cache calls must match the fixed profile');
  const {faceSamples,faceGrids}=buildQualifiedStripMeshFaceSamplesTrusted(body,uStations,edgePaths,{
    fail,isRootError:(cause:unknown)=>cause instanceof QualifiedTranslatedStripBodyMeshError,
    surfaceD0:(surface:Surface,uv:UV)=>point(native('surfaceD0Count',()=>evaluateSurface(surface,uv[0],uv[1]))),
    surfaceD1:(surface:Surface,uv:UV)=>{attempt('surfaceD1AttemptCount');return evaluateSurfaceD1(surface,uv[0],uv[1])},
    existingVertex:(key:Key)=>{const index=keyMap.get(keyString(key));return index===undefined?null:{vertexIndex:index,anchorPoint:point(vertices[index].point)}},
    resolveVertex:(key:Key,faceId:string,xyz:Point,faceSampleIndex:number)=>{let index=keyMap.get(keyString(key));if(index===undefined){const face=body.faces.find(item=>item.id===faceId);check(face!==undefined,CODE.TOPOLOGY,'Every new interior must bind an actual Face');const boundaryCount=key.filter((v,k)=>v===0||v===(k===0?q-1:4)).length;check(boundaryCount===1,CODE.TOPOLOGY,'Only actual Face interiors may receive a new Surface position');index=addVertex(key,{point:xyz,kind:'native-face',globalVertexId:null,globalEdgeId:null,faceId,sourceRef:{...face.supportRef},edgeSampleIndex:null,faceSampleIndex})}return {vertexIndex:index,anchorPoint:point(vertices[index].point)}}
  });
  check(faceSamples.length===20*q+50&&faceGrids.length===6&&vertices.length===16*q+18,CODE.TOPOLOGY,'All actual unique Face occurrences and shared cube-boundary vertices required');
  for(const sample of faceSamples){check(sample.index>=0&&faceSamples[sample.index]===sample&&sample.vertexIndex>=0&&sample.vertexIndex<vertices.length&&same(sample.anchorPoint,vertices[sample.vertexIndex].point)&&sample.anchorGapMM<=1e-7,CODE.UV,'Every actual Face sample must bind one shared authority position and its measured gap');if(sample.d1.status==='evaluated')counts.surfaceD1EvaluatedCount++;else counts.surfaceD1RefusedCount++}
  check(counts.surfaceD0Count===20*q+50&&counts.surfaceD1AttemptCount===20*q+50&&counts.surfaceD1EvaluatedCount+counts.surfaceD1RefusedCount===counts.surfaceD1AttemptCount&&counts.nativeAttemptCount===52*q+220,CODE.BUDGET,'Actual new native calls and retained D1 states must match the frozen schedule');

  const triangles:Triangle[]=[],faceRanges:FaceRange[]=[];
  for(const [faceIndex,face] of body.faces.entries()){
    const grid=faceGrids[faceIndex],firstCount=faceIndex<4?q:5;
    check(grid.faceId===face.id&&grid.role===face.role&&grid.orientation===face.orientation&&same(grid.gridSize,[firstCount,5])&&grid.vertexIndices.length===firstCount*5&&grid.sampleIndices.length===firstCount*5,CODE.TOPOLOGY,'Actual Face grids must retain their exact role/chart/order/rank');
    for(let i=0;i<firstCount;i++)for(let j=0;j<5;j++){const slot=5*i+j,sample=faceSamples[grid.sampleIndices[slot]];check(sample!==undefined&&sample.faceId===face.id&&same(sample.grid,[i,j])&&sample.vertexIndex===grid.vertexIndices[slot],CODE.TOPOLOGY,'Every row-major Face grid slot must resolve its actual native sample and shared index')}
    const triangleStart=triangles.length;
    for(let i=0;i<firstCount-1;i++)for(let j=0;j<4;j++)for(const withinCell of [0,1] as const){
      const slots=withinCell===0?[5*i+j,5*(i+1)+j,5*(i+1)+j+1]:[5*i+j,5*(i+1)+j+1,5*i+j+1];if(face.orientation==='reverse')[slots[1],slots[2]]=[slots[2],slots[1]];
      const vertexIndices=slots.map(slot=>grid.vertexIndices[slot]) as [number,number,number],faceSampleIndices=slots.map(slot=>grid.sampleIndices[slot]) as [number,number,number];
      check(new Set(vertexIndices).size===3&&vertexIndices.every(index=>Number.isInteger(index)&&index>=0&&index<vertices.length),CODE.TOPOLOGY,'Triangle authority indices must be distinct valid uint32 values');
      triangles.push({index:triangles.length,faceId:face.id,role:face.role,cell:[i,j],withinCell,vertexIndices,faceSampleIndices});
    }
    const boundaryPaths:BoundaryPath[]=face.loop.uses.map((use):BoundaryPath=>{
      const path=edgePaths.find(item=>item.edgeId===use.edgeId),cache=path?.uses.find(item=>item.useId===use.id);check(path!==undefined&&cache!==undefined&&cache.faceId===face.id&&cache.pcurveId===use.pcurve.curve.id,CODE.UV,'Each stored Face Use must resolve its actual canonical Edge/pcurve cache');
      const sequence=path.samples.map(sample=>sample.vertexIndex);if(use.sense==='reverse')sequence.reverse();
      check(vertices[sequence[0]].globalVertexId===use.vertexIds[0]&&vertices[sequence[sequence.length-1]].globalVertexId===use.vertexIds[1]&&sequence.every(index=>grid.vertexIndices.includes(index)),CODE.ORIENTATION,'Actual canonical boundary path must follow already-oriented stored Use endpoints');
      return {edgeId:use.edgeId,useId:use.id,pcurveId:use.pcurve.curve.id,sense:use.sense,interval:[...use.interval],vertexIndices:sequence};
    });
    check(boundaryPaths.every((path,i)=>path.vertexIndices[path.vertexIndices.length-1]===boundaryPaths[(i+1)%4].vertexIndices[0]),CODE.TOPOLOGY,'Every actual four-Use boundary path must close in stored order');
    const image=body.proof.material.sixFaceImages.find(item=>item.faceId===face.id&&item.role===face.role);check(image!==undefined,CODE.SOURCE,'An unchanged material Face-image role is required');
    faceRanges.push({faceId:face.id,role:face.role,orientation:face.orientation,supportRef:{...face.supportRef},origin:face.origin,materialImageRole:image.role,chart:faceIndex<2?'u-t':faceIndex<4?'u-w':'t-w',gridSize:[firstCount,5],sampleRange:[grid.sampleIndices[0],grid.sampleIndices[grid.sampleIndices.length-1]+1],triangleRange:[triangleStart,triangles.length],vertexIndices:[...grid.vertexIndices],storedUseIds:face.loop.uses.map(use=>use.id),boundaryPaths});
  }
  check(triangles.length===32*q+32,CODE.TOPOLOGY,'Actual emitted cell triangles must match the bounded profile');
  const cadSegments=new Map<string,string>();
  for(const path of edgePaths)for(let i=0;i<path.samples.length-1;i++){const pair=pairString(path.samples[i].vertexIndex,path.samples[i+1].vertexIndex);check(!cadSegments.has(pair),CODE.TOPOLOGY,'One logical shared segment cannot belong to two global CAD Edges');cadSegments.set(pair,path.edgeId)}
  const incidenceMap=new Map<string,TriangleUse[]>(),triangleIdentity=new Set<string>();
  for(const triangle of triangles){const identity=[...triangle.vertexIndices].sort((a,b)=>a-b).join(':');check(!triangleIdentity.has(identity),CODE.TOPOLOGY,'Duplicate indexed triangles refused');triangleIdentity.add(identity);for(const side of [0,1,2] as const){const from=triangle.vertexIndices[side],to=triangle.vertexIndices[(side+1)%3],key=pairString(from,to),uses=incidenceMap.get(key)??[];uses.push({triangleIndex:triangle.index,side,from,to});check(uses.length<=2,CODE.TOPOLOGY,'A mesh edge cannot have a third triangle Use');incidenceMap.set(key,uses)}}
  const triangleAdjacency=triangles.map(()=>[] as number[]),vertexAdjacency=vertices.map(()=>[] as number[]),boundaryDirections=new Set<string>();
  for(const range of faceRanges)for(const path of range.boundaryPaths)for(let i=0;i<path.vertexIndices.length-1;i++){const direction=range.faceId+':'+path.vertexIndices[i]+':'+path.vertexIndices[i+1];check(!boundaryDirections.has(direction),CODE.TOPOLOGY,'Actual stored Face boundary segment directions must be unique');boundaryDirections.add(direction)}
  const edgeIncidence:EdgeIncidence[]=[...incidenceMap.values()].sort((a,b)=>Math.min(a[0].from,a[0].to)-Math.min(b[0].from,b[0].to)||Math.max(a[0].from,a[0].to)-Math.max(b[0].from,b[0].to)).map((uses):EdgeIncidence=>{
    check(uses.length===2&&uses[0].from===uses[1].to&&uses[0].to===uses[1].from,CODE.ORIENTATION,'Each indexed mesh edge requires exactlytwo opposite directed triangle Uses');
    const a=triangles[uses[0].triangleIndex],b=triangles[uses[1].triangleIndex],from=Math.min(uses[0].from,uses[0].to),to=Math.max(uses[0].from,uses[0].to),globalEdgeId=cadSegments.get(pairString(from,to))??null;
    if(globalEdgeId!==null){const parent=body.edges.find(edge=>edge.id===globalEdgeId);check(parent!==undefined&&a.faceId!==b.faceId&&parent.uses.every(use=>use.faceId===a.faceId||use.faceId===b.faceId)&&uses.every(use=>boundaryDirections.has(triangles[use.triangleIndex].faceId+':'+use.from+':'+use.to)),CODE.ORIENTATION,'Every actual CAD boundary segment must agree with both already-oriented stored Face Uses')}
    else check(a.faceId===b.faceId,CODE.TOPOLOGY,'An unqualified grid or diagonal edge cannot cross a CAD Face seam');
    triangleAdjacency[a.index].push(b.index);triangleAdjacency[b.index].push(a.index);vertexAdjacency[from].push(to);vertexAdjacency[to].push(from);
    return {vertexIndices:[from,to],uses:uses as [TriangleUse,TriangleUse],kind:globalEdgeId!==null?'cad-edge':same(a.cell,b.cell)?'face-diagonal':'face-grid',globalEdgeId};
  });
  check(edgeIncidence.length===48*q+48&&vertices.length-edgeIncidence.length+triangles.length===2&&[...cadSegments.keys()].every(key=>incidenceMap.has(key)),CODE.TOPOLOGY,'Complete actual indexed edge incidence and Euler2 required');
  connected(triangleAdjacency,'All emitted triangles must form one connected graph');connected(vertexAdjacency,'All authority positions must form one connected graph with no orphan');
  const vertexLinks:VertexLink[]=vertices.map((vertex):VertexLink=>{
    const arcs=new Map<number,{to:number;triangleIndex:number}>(),incoming=new Map<number,number>(),incidentFaces=new Set<string>();
    for(const triangle of triangles){const at=triangle.vertexIndices.indexOf(vertex.index);if(at<0)continue;const from=triangle.vertexIndices[(at+1)%3],to=triangle.vertexIndices[(at+2)%3];check(!arcs.has(from),CODE.TOPOLOGY,'A mesh vertex link node cannot have two outgoing arcs');arcs.set(from,{to,triangleIndex:triangle.index});incoming.set(to,(incoming.get(to)??0)+1);incidentFaces.add(triangle.faceId)}
    check(arcs.size>=3&&incoming.size===arcs.size&&[...arcs.keys()].every(node=>incoming.get(node)===1),CODE.TOPOLOGY,'Every actual mesh vertex link needs one incoming/outgoing arc per node');
    const start=Math.min(...arcs.keys()),cycle:number[]=[],triangleIndices:number[]=[],seen=new Set<number>();let current=start;
    while(!seen.has(current)){seen.add(current);cycle.push(current);const arc=arcs.get(current);check(arc!==undefined,CODE.TOPOLOGY,'A vertex link arc must resolve');triangleIndices.push(arc.triangleIndex);current=arc.to}
    check(current===start&&cycle.length===arcs.size,CODE.TOPOLOGY,'Every mesh vertex link must be one connected oriented cycle');
    if(vertex.kind==='stored-corner'){const parent=body.proof.vertexLinks.find(link=>link.vertexId===vertex.globalVertexId);check(parent!==undefined&&parent.cornerArcs.length===3&&same([...incidentFaces].sort(),parent.cornerArcs.map(arc=>arc.faceId).sort()),CODE.TOPOLOGY,'Stored CAD corners must retain the parent three-Face link roles')}
    else if(vertex.kind==='native-edge'){const parent=body.edges.find(edge=>edge.id===vertex.globalEdgeId);check(parent!==undefined&&incidentFaces.size===2&&same([...incidentFaces].sort(),parent.uses.map(use=>use.faceId).sort()),CODE.TOPOLOGY,'CAD Edge interior stars must retain their actual two Face Uses')}
    else check(incidentFaces.size===1&&incidentFaces.has(vertex.faceId!),CODE.TOPOLOGY,'Face interior stars must stay in their actual native Face');
    return {vertexIndex:vertex.index,cycle,triangleIndices,globalVertexId:vertex.globalVertexId,globalEdgeId:vertex.globalEdgeId};
  });

  const renderChunks:RenderChunk[]=body.faces.map((face):RenderChunk=>{
    const chunk:RenderChunk={faceId:face.id,role:face.role,orientation:face.orientation,normalSource:'approximate-triangle-geometry',positionEncoding:'float32-number',normalEncoding:'float32-number',uvEncoding:'binary64-number',indexEncoding:'uint32-number',positionsMM:[],normals:[],parametersUV:[],indices:[],authorityIndices:[],faceSampleIndices:[],triangleIndices:[],quantizationGapsMM:[]};
    for(const triangle of triangles.filter(item=>item.faceId===face.id)){
      const xyz=triangle.vertexIndices.map(index=>vertices[index].point),geometry=normalizedCross(xyz[0],xyz[1],xyz[2]);
      const principal=face.role==='lower'?-geometry.normal[1]:face.role==='upper'?geometry.normal[1]:face.role==='base'?-geometry.normal[2]:face.role==='uMin'?-geometry.normal[0]:face.role==='uMax'?geometry.normal[0]:null;
      if(principal!==null)check(principal>0,CODE.ORIENTATION,'Actual triangle winding must face the parent outward material side');
      else {const evaluated=triangle.faceSampleIndices.map(index=>faceSamples[index].d1).find(state=>state.status==='evaluated');check(evaluated!==undefined&&evaluated.status==='evaluated'&&dot(geometry.normal,evaluated.orientedNormal)>0,CODE.ORIENTATION,'Actual cap triangle normal must face its unchanged native Plane normal')}
      const normal=geometry.normal.map(value=>finite(Math.fround(value))) as Point,quantized=xyz.map(value=>value.map(coordinate=>finite(Math.fround(coordinate))) as Point);
      check(normal.every(value=>Object.is(value,Math.fround(value)))&&Math.abs(finite(Math.hypot(...normal))-1)<=1e-5,CODE.REPRESENTABILITY,'Float32 approximate facet normal must remain finite and unit within1e-5');
      const quantizedGeometry=normalizedCross(quantized[0],quantized[1],quantized[2]);check(dot(geometry.cross,normal)>0&&dot(quantizedGeometry.cross,normal)>0,CODE.ORIENTATION,'Binary64 and quantized Float32 triangle winding must agree with the actual facet normal');
      const first=chunk.authorityIndices.length;
      for(let k=0;k<3;k++){const sample=faceSamples[triangle.faceSampleIndices[k]];check(sample.faceId===face.id&&sample.vertexIndex===triangle.vertexIndices[k],CODE.TOPOLOGY,'Every display corner must retain its actual Face UV and authority index');chunk.positionsMM.push(...quantized[k]);chunk.normals.push(...normal);chunk.parametersUV.push(...sample.uv);chunk.authorityIndices.push(triangle.vertexIndices[k]);chunk.faceSampleIndices.push(sample.index);chunk.quantizationGapsMM.push(gap(xyz[k],quantized[k]));chunk.indices.push(first+k)}
      chunk.triangleIndices.push(triangle.index);
    }
    const count=chunk.authorityIndices.length;check(count>0&&chunk.positionsMM.length===3*count&&chunk.normals.length===3*count&&chunk.parametersUV.length===2*count&&chunk.indices.length===count&&chunk.faceSampleIndices.length===count&&chunk.quantizationGapsMM.length===count&&chunk.triangleIndices.length===count/3&&chunk.positionsMM.every(value=>Object.is(value,Math.fround(value))),CODE.REPRESENTABILITY,'Actual Float32 display arrays must match their declared flat ranks and encodings');return chunk;
  });
  const positionsMM=vertices.flatMap(vertex=>vertex.point),indices=triangles.flatMap(triangle=>triangle.vertexIndices),bounds={min:[0,1,2].map(axis=>Math.min(...vertices.map(vertex=>vertex.point[axis]))) as Point,max:[0,1,2].map(axis=>Math.max(...vertices.map(vertex=>vertex.point[axis]))) as Point};
  const packet:QualifiedTranslatedStripBodyMeshPacket={schema:'barocss-qualified-translated-strip-body-mesh',version:0,meshId:options.meshId,bodyId:body.body.id,shellId:body.shell.id,materialCertificateId:body.body.materialCertificateId,lengthUnit:'mm',sourceFrame:'authored-xyz-no-axis-conversion',positionEncoding:'binary64-number',indexEncoding:'uint32-number',positionsMM,indices,vertices,triangles,bounds};
  const proof:Proof={sourceCatalog,faceRanges,edgeIncidence,vertexLinks,connectedTriangles:true,connectedVertices:true,eulerCharacteristic:2,parentMaterialCertificateId:body.body.materialCertificateId,parentFlagsUnchanged:true};
  const report:QualifiedTranslatedStripBodyMeshReport={schema:'barocss-qualified-translated-strip-body-mesh-report',version:0,evaluationId:options.evaluationId,meshId:options.meshId,bodyId:body.body.id,shellId:body.shell.id,materialCertificateId:body.body.materialCertificateId,spanCount:n,uStationCount:q,vertexCount:vertices.length,triangleCount:triangles.length,meshEdgeCount:edgeIncidence.length,faceCount:6,cadEdgeCount:12,cornerCount:8,edgeInteriorCount:4*q+16,faceInteriorCount:12*q-6,faceSampleCount:faceSamples.length,useSampleCount:edgePaths.reduce((sum,path)=>sum+path.uses.reduce((count,use)=>count+use.samples.length,0),0),renderVertexCount:renderChunks.reduce((count,chunk)=>count+chunk.authorityIndices.length,0),nativeNormalEvaluatedCount:counts.surfaceD1EvaluatedCount,nativeNormalRefusedCount:counts.surfaceD1RefusedCount,maximumObservedEndpointGapMM:Math.max(0,...edgePaths.flatMap(path=>path.samples.map(sample=>sample.endpointGapMM??0))),maximumObservedAnchorGapMM:Math.max(0,...faceSamples.map(sample=>sample.anchorGapMM)),maximumObservedD1PointGapMM:Math.max(0,...faceSamples.map(sample=>sample.d1.pointGapMM??0)),maximumObservedAlternateUVGap:Math.max(0,...faceSamples.map(sample=>sample.alternateUVGap??0)),maximumObservedFloat32QuantizationGapMM:Math.max(0,...renderChunks.flatMap(chunk=>chunk.quantizationGapsMM)),fileSizes:{request:requestSize,result:{utf16:0,utf8:0}},directCounts:counts,quality:{trimmedSixFaceSamples:true,sourceQualified:true,closedIndexedManifold:true,parentFlagsUnchanged:true,approximateTriangles:true,facetNormalsApproximate:true,float32DisplayValidated:true,storedCornerAuthority:true,welding:false,snapping:false,meshGeometricEmbedding:false,globalApproximationError:false,newSolidCertification:false,manufacturing:false,rendererAcceptance:false,loaderAcceptance:false,publication:false,ownership:'independent-copied-cpu-data-gc'},limits:{maximumOriginalSpans:4,subdivisionsPerOriginalUSpan:4,subdivisionsT:4,subdivisionsW:4,maximumUStations:17,maximumVertices:290,maximumTriangles:576,maximumMeshEdges:864,maximumFaceSamples:390,maximumUseSamples:216,maximumNativeAttempts:1104,maximumRenderVertices:1728,maximumFileUTF16:4194304,maximumFileUTF8:4194304,parentBodyMaximumFileUTF16:2097152,parentBodyMaximumFileUTF8:2097152,ownValues:4194304,ownDepth:64,arrayElements:8192,recordFields:64,keyCharacters:128,stringCharacters:262144,identifierCharacters:48,maximumObservedGapMM:1e-7,normalUnitResidual:1e-5},workScope:'new-root-native-attempts-parent-validation-work-retained-and-excluded',budgetFailure:'atomic-no-partial-mesh'};
  check(report.renderVertexCount===3*triangles.length&&report.renderVertexCount<=1728&&report.useSampleCount===8*q+80,CODE.BUDGET,'All display corners and actual Use samples must fit the complete frozen profile');
  const result:QualifiedTranslatedStripBodyMeshResult={body,options,packet,edgePaths,faceSamples,renderChunks,proof,report};let stable=false;
  for(let step=0;step<8;step++){const measured=fileSize(result);if(same(measured,report.fileSizes.result)){stable=true;break}report.fileSizes.result=measured}
  check(stable,CODE.FILE,'Complete mesh result byte metadata must reach an exact fixed point');return snapshot(result,true) as QualifiedTranslatedStripBodyMeshResult;
}

/** Rebuild the complete Body, native cache, six charts, discrete proof and actual display projection. */
export function validateQualifiedTranslatedStripBodyMesh(input:QualifiedTranslatedStripBodyMeshResult):QualifiedTranslatedStripBodyMeshReport {
  const owned=record(snapshot(input,true),['body','options','packet','edgePaths','faceSamples','renderChunks','proof','report'],CODE.OWNED) as unknown as QualifiedTranslatedStripBodyMeshResult;let expected:QualifiedTranslatedStripBodyMeshResult;
  try{expected=tessellateQualifiedTranslatedStripBody(owned.body,owned.options)}catch(cause){fail(CODE.OWNED,'Whole Body mesh reconstruction refused',cause)}
  check(same(owned,expected),CODE.OWNED,'Owned complete Body/source/native cache/UV/normal/indices/links/display/counters/caps/claims/bytes changed');return snapshot(expected.report,true) as QualifiedTranslatedStripBodyMeshReport;
}
