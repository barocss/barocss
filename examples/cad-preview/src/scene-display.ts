import * as cad from '@barocss/cad';
import {validatePreviewPacket,prepareKernelFacePreview,resolveKernelFaceReference} from '@barocss/gpu';
import type {PreviewPacket,MeshEdgeOverlay,KernelFacePreview,KernelFaceReference,KernelFaceContext} from '@barocss/gpu';
import {bodyEdges} from '../cad-edge-overlay.mjs';
import {evaluateNative,nativePayload} from './native-adapters';
import type {NativeEvaluation} from './native-adapters';
import {signedJson,type SceneDocument} from './scene-document';
import {transformPoint,transformNormal} from './scene-transform';
export interface ObjectRange {objectId:string;vertexRange:[number,number];indexRange:[number,number]}
export interface FaceRange {objectId:string;nativeFaceId:string;indexRange:[number,number];reference?:KernelFaceReference}
export interface SceneDisplay {packet:PreviewPacket|null;overlay:MeshEdgeOverlay|null;objects:ObjectRange[];faces:FaceRange[];edges:{displayId:string;objectId:string;nativeEdgeId:string}[];plateContexts:Record<string,KernelFaceContext>}
export interface SceneCacheEntry {serialized:string;evaluation:NativeEvaluation;geometryRevision:number;placementSignature?:string;prepared?:KernelFacePreview;nativeMesh?:cad.OwnNativeFaceMesh;nativePaths?:{id:string;points:number[][]}[]}
export type SceneCache=Map<string,SceneCacheEntry>;
const preparedByDisplay=new WeakMap<SceneDisplay,Map<string,KernelFacePreview>>();
/** Resolve only against the branded original results owned by this exact displayed scene. */
export function resolveSceneFace(display:SceneDisplay,reference:KernelFaceReference):FaceRange|null {
 const prepared=preparedByDisplay.get(display);if(!prepared)return null;
 for(const [objectId,result]of prepared){let binding;try{binding=resolveKernelFaceReference(result,reference);}catch{return null;}if(binding)return display.faces.find(face=>face.objectId===objectId&&face.reference?.faceToken===binding.reference.faceToken&&face.nativeFaceId===binding.reference.nativeFaceId)??null;}
 return null;
}
export function nativeToPreview(p:number[],translate=[0,0,0]):[number,number,number]{return[p[0]+translate[0],p[2]+translate[2],-(p[1]+translate[1])];}
export function previewToNative(p:number[]):[number,number,number]{return[p[0],-p[2],p[1]];}
export function buildSceneDisplay(scene:SceneDocument,revision:number,cache:SceneCache):{display:SceneDisplay;cache:SceneCache}{
 const packet:PreviewPacket={version:0,surfaceId:'editor_scene_display',revision,lengthUnit:'mm',coordinateSystem:'right-handed-y-up',winding:'ccw',positions:[],normals:[],parameters:[],indices:[],bounds:{min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]}};
 const next:SceneCache=new Map(),preparedForDisplay=new Map<string,KernelFacePreview>(),plateContexts:Record<string,KernelFaceContext>={},objects:ObjectRange[]=[],faces:SceneDisplay['faces']=[],paths:MeshEdgeOverlay['paths']=[],edges:SceneDisplay['edges']=[];
 for(const object of scene.objects){const serialized=object.intent.kind+':'+signedJson(nativePayload(object.intent)),old=cache.get(object.id),unchanged=old?.serialized===serialized;const evaluation=unchanged?old.evaluation:evaluateNative(object.intent),geometryRevision=unchanged?old.geometryRevision:(old?.geometryRevision??0)+1,placementSignature=signedJson(object.placement);const entry:SceneCacheEntry={serialized,evaluation,geometryRevision,placementSignature,...(unchanged?{nativeMesh:old.nativeMesh,nativePaths:old.nativePaths,prepared:old.placementSignature===placementSignature?old.prepared:undefined}:{})};next.set(object.id,entry);if(!object.visible)continue;
  const vertexStart=packet.positions.length/3,indexStart=packet.indices.length,placement=object.placement;let nativePaths:{id:string;points:number[][]}[]=[];
  function append(local:PreviewPacket,nativeFaceId:string){const start=packet.indices.length,offset=packet.positions.length/3;for(let i=0;i<local.positions.length;i+=3){packet.positions.push(...nativeToPreview(transformPoint(local.positions.slice(i,i+3),placement)));packet.normals.push(...nativeToPreview(transformNormal(local.normals.slice(i,i+3),placement)));}packet.parameters.push(...local.parameters);packet.indices.push(...local.indices.map(n=>n+offset));faces.push({objectId:object.id,nativeFaceId,indexRange:[start,packet.indices.length]});}
  if(evaluation.kind==='box'){
   const e=evaluation.result.evaluation;let samplePacket:PreviewPacket|null=null;
   for(const face of e.faces){const surface=e.model.objects.find(s=>s.kind==='surface'&&s.id===face.topology.face.surfaceId);if(!surface||surface.kind!=='surface')throw Error('Native Box face is missing');const p=cad.tessellateSurface(surface,{countU:2,countV:2,revision}).packet;samplePacket=p;append(p,face.topology.face.id);}
   nativePaths=bodyEdges(e,samplePacket!,cad).overlay.paths;
  }else if(evaluation.kind==='circle-prism'){
   const p=cad.tessellateXYCirclePrismShell(evaluation.result.shell.bundle,{meshId:'local_'+object.id,revision,segmentsPerQuarter:6});const offset=packet.positions.length/3,start=packet.indices.length;append(p.packet,p.faceRanges[0].faceId);faces.pop();for(const f of p.faceRanges)faces.push({objectId:object.id,nativeFaceId:f.faceId,indexRange:[f.indexRange[0]+start,f.indexRange[1]+start]});nativePaths=p.edgePaths;
   if(packet.positions.length/3-offset!==p.packet.positions.length/3)throw Error('Native circle vertex range changed');
  }else{
   const bundle=evaluation.result.bundle,context:KernelFaceContext={documentId:object.id,bodyId:bundle.request.bodyId,documentRevision:'geometry_'+geometryRevision,kernelResultRevision:'geometry_'+geometryRevision,topologyRevision:'geometry_'+geometryRevision,taskToken:'display_'+revision};
   if(!entry.nativeMesh)entry.nativeMesh=cad.tessellateOwnPlateCircularHole(bundle,{context,segmentsPerQuarter:4}).mesh;
   if(!entry.prepared)entry.prepared=prepareKernelFacePreview({...entry.nativeMesh,context},{displayId:object.id,packetRevision:revision});
   const prepared=entry.prepared,local=prepared.packet,offset=packet.positions.length/3,start=packet.indices.length;
   // The bridge already applies proper R. Recover local native XYZ, apply the
   // authored instance transform, then convert once into final preview XYZ.
   for(let i=0;i<local.positions.length;i+=3){packet.positions.push(...nativeToPreview(transformPoint(previewToNative(local.positions.slice(i,i+3)),placement)));packet.normals.push(...nativeToPreview(transformNormal(previewToNative(local.normals.slice(i,i+3)),placement)));}
   packet.parameters.push(...local.parameters);packet.indices.push(...local.indices.map(n=>n+offset));
   for(const binding of prepared.faces)faces.push({objectId:object.id,nativeFaceId:binding.reference.nativeFaceId,indexRange:[start+binding.indexRange[0],start+binding.indexRange[1]],reference:binding.reference});
   preparedForDisplay.set(object.id,prepared);plateContexts[object.id]=prepared.context;
   if(!entry.nativePaths)entry.nativePaths=bundle.topology.edges.map(edge=>{const [a,b]=edge.sourceParameterRange,segments=edge.curve.degree===1?1:16;return{id:edge.id,points:Array.from({length:segments+1},(_,i)=>cad.evaluateCurve(edge.curve,a+(b-a)*i/segments))};});
   nativePaths=entry.nativePaths;
  }
  objects.push({objectId:object.id,vertexRange:[vertexStart,packet.positions.length/3],indexRange:[indexStart,packet.indices.length]});
  for(const [i,path]of nativePaths.entries()){const displayId='edge_'+object.id+'_'+i;paths.push({id:displayId,points:path.points.map(p=>nativeToPreview(transformPoint(p,placement)))});edges.push({displayId,objectId:object.id,nativeEdgeId:path.id});}
 }
 if(!objects.length){const display:SceneDisplay={packet:null,overlay:null,objects,faces,edges,plateContexts};preparedByDisplay.set(display,preparedForDisplay);return{display,cache:next};}
 for(let i=0;i<packet.positions.length;i++){const axis=i%3;packet.bounds.min[axis]=Math.min(packet.bounds.min[axis],packet.positions[i]);packet.bounds.max[axis]=Math.max(packet.bounds.max[axis],packet.positions[i]);}
 const owned=validatePreviewPacket(packet);if(paths.length>64||paths.reduce((n,p)=>n+p.points.length,0)>4096)throw Error('Scene native edges exceed display limits');
 const display:SceneDisplay={packet:owned,overlay:{version:0,packet:owned,paths,color:[.07,.11,.14]},objects,faces,edges,plateContexts};preparedByDisplay.set(display,preparedForDisplay);return{display,cache:next};
}
