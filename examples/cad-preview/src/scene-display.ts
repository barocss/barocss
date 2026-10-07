import * as cad from '@barocss/cad';
import {validatePreviewPacket} from '@barocss/gpu';
import type {PreviewPacket,MeshEdgeOverlay} from '@barocss/gpu';
import {bodyEdges} from '../cad-edge-overlay.mjs';
import {evaluateNative,serializeNative} from './native-adapters';
import type {NativeEvaluation} from './native-adapters';
import {signedJson,type SceneDocument} from './scene-document';
export interface ObjectRange {objectId:string;vertexRange:[number,number];indexRange:[number,number]}
export interface SceneDisplay {packet:PreviewPacket|null;overlay:MeshEdgeOverlay|null;objects:ObjectRange[];faces:{objectId:string;nativeFaceId:string;indexRange:[number,number]}[];edges:{displayId:string;objectId:string;nativeEdgeId:string}[]}
type Cache=Map<string,{serialized:string;evaluation:NativeEvaluation}>;
export function nativeToPreview(p:number[],translate=[0,0,0]):[number,number,number]{return[p[0]+translate[0],p[2]+translate[2],-(p[1]+translate[1])];}
export function previewToNative(p:number[]):[number,number,number]{return[p[0],-p[2],p[1]];}
export function buildSceneDisplay(scene:SceneDocument,revision:number,cache:Cache):{display:SceneDisplay;cache:Cache}{
 const packet:PreviewPacket={version:0,surfaceId:'editor_scene_display',revision,lengthUnit:'mm',coordinateSystem:'right-handed-y-up',winding:'ccw',positions:[],normals:[],parameters:[],indices:[],bounds:{min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]}};
 const next:Cache=new Map(),objects:ObjectRange[]=[],faces:SceneDisplay['faces']=[],paths:MeshEdgeOverlay['paths']=[],edges:SceneDisplay['edges']=[];
 for(const object of scene.objects){const serialized=signedJson(object.intent.document),old=cache.get(object.id);const evaluation=old?.serialized===serialized?old.evaluation:evaluateNative(object.intent);next.set(object.id,{serialized,evaluation});if(!object.visible)continue;
  const vertexStart=packet.positions.length/3,indexStart=packet.indices.length,placement=object.placement.translateMM;let nativePaths:{id:string;points:number[][]}[]=[];
  function append(local:PreviewPacket,nativeFaceId:string){const start=packet.indices.length,offset=packet.positions.length/3;for(let i=0;i<local.positions.length;i+=3){packet.positions.push(...nativeToPreview(local.positions.slice(i,i+3),placement));packet.normals.push(...nativeToPreview(local.normals.slice(i,i+3)));}packet.parameters.push(...local.parameters);packet.indices.push(...local.indices.map(n=>n+offset));faces.push({objectId:object.id,nativeFaceId,indexRange:[start,packet.indices.length]});}
  if(evaluation.kind==='box'){
   const e=evaluation.result.evaluation;let samplePacket:PreviewPacket|null=null;
   for(const face of e.faces){const surface=e.model.objects.find(s=>s.kind==='surface'&&s.id===face.topology.face.surfaceId);if(!surface||surface.kind!=='surface')throw Error('Native Box face is missing');const p=cad.tessellateSurface(surface,{countU:2,countV:2,revision}).packet;samplePacket=p;append(p,face.topology.face.id);}
   nativePaths=bodyEdges(e,samplePacket!,cad).overlay.paths;
  }else{
   const p=cad.tessellateXYCirclePrismShell(evaluation.result.shell.bundle,{meshId:'local_'+object.id,revision,segmentsPerQuarter:6});const offset=packet.positions.length/3,start=packet.indices.length;append(p.packet,object.intent.document.feature.id);faces.pop();for(const f of p.faceRanges)faces.push({objectId:object.id,nativeFaceId:f.faceId,indexRange:[f.indexRange[0]+start,f.indexRange[1]+start]});nativePaths=p.edgePaths;
   if(packet.positions.length/3-offset!==p.packet.positions.length/3)throw Error('Native circle vertex range changed');
  }
  objects.push({objectId:object.id,vertexRange:[vertexStart,packet.positions.length/3],indexRange:[indexStart,packet.indices.length]});
  for(const [i,path]of nativePaths.entries()){const displayId='edge_'+object.id+'_'+i;paths.push({id:displayId,points:path.points.map(p=>nativeToPreview(p,placement))});edges.push({displayId,objectId:object.id,nativeEdgeId:path.id});}
 }
 if(!objects.length)return{display:{packet:null,overlay:null,objects,faces,edges},cache:next};
 for(let i=0;i<packet.positions.length;i++){const axis=i%3;packet.bounds.min[axis]=Math.min(packet.bounds.min[axis],packet.positions[i]);packet.bounds.max[axis]=Math.max(packet.bounds.max[axis],packet.positions[i]);}
 const owned=validatePreviewPacket(packet);if(paths.length>64||paths.reduce((n,p)=>n+p.points.length,0)>4096)throw Error('Scene native edges exceed display limits');
 return{display:{packet:owned,overlay:{version:0,packet:owned,paths,color:[.07,.11,.14]},objects,faces,edges},cache:next};
}
