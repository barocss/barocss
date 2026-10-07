import {validatePreviewPacket} from './mesh-packet.js';
import type {PreviewPacket} from './mesh-packet.js';
import {ownRecord,freezeGpuData} from './gpu-data.js';

/** Result-scoped identity from the own CAD engine; no cross-rebuild naming inference. */
export interface KernelFaceContext {
  documentId:string;bodyId:string;documentRevision:string;kernelResultRevision:string;topologyRevision:string;taskToken:string;
}
export type KernelNormalSource='own-tessellation'|'native-surface-evaluation'|'mesh-computed';
export interface KernelFaceReference extends KernelFaceContext {faceToken:string;nativeFaceId:string}
export interface KernelFaceBinding {
  reference:KernelFaceReference;faceOrientation:'forward'|'reversed';normalSource:KernelNormalSource;
  vertexRange:[number,number];indexRange:[number,number];
}
export interface KernelFacePreview {packet:PreviewPacket;context:KernelFaceContext;faces:KernelFaceBinding[]}
export interface KernelFacePreviewOptions {displayId:string;packetRevision:number}
const CONTEXT=['documentId','bodyId','documentRevision','kernelResultRevision','topologyRevision','taskToken'] as const;
const preparedResults=new WeakSet<object>();
function requireValue(condition:unknown,message:string):asserts condition {
  if(!condition)throw new RangeError('Native face preview: '+message);
}
/** Copy bounded own data before accessing fields; reject accessors, cycles and non-JSON shapes. */
function snapshot(input:unknown):unknown {
  let remaining=131072;const active=new Set<object>();
  function copy(value:unknown,depth:number):unknown {
    requireValue(--remaining>=0&&depth<=12,'own-data value/depth budget exceeded');
    if(typeof value==='number'){requireValue(Number.isFinite(value),'finite numbers required');return value;}
    if(typeof value==='string'){requireValue(value.length<=512,'string budget exceeded');return value;}
    requireValue(value!==null&&typeof value==='object','numeric/string/record data required');
    requireValue(!active.has(value),'cyclic data unsupported');
    const array=Array.isArray(value),prototype=Object.getPrototypeOf(value);
    requireValue(array?prototype===Array.prototype:prototype===Object.prototype||prototype===null,'foreign prototype unsupported');
    const keys=Reflect.ownKeys(value);
    requireValue(keys.length<=(array?23815:16),'own field budget exceeded');
    const descriptors=Object.getOwnPropertyDescriptors(value) as Record<string,PropertyDescriptor>;
    requireValue(keys.every(key=>typeof key==='string'&&key.length<=512&&'value'in descriptors[key]&&(array&&key==='length'||descriptors[key].enumerable)),'getters, symbols and hidden fields unsupported');
    active.add(value);
    try {
      if(array){
        const length=descriptors.length.value as number;
        requireValue(Number.isInteger(length)&&length>=0&&length<=23814&&keys.length===length+1,'bounded dense array required');
        const result:unknown[]=[];
        for(let i=0;i<length;i++){requireValue(Object.hasOwn(descriptors,String(i)),'sparse or extra array fields unsupported');result.push(copy(descriptors[String(i)].value,depth+1));}
        return result;
      }
      return Object.fromEntries((keys as string[]).map(key=>[key,copy(descriptors[key].value,depth+1)]));
    }finally{active.delete(value);}
  }
  return copy(input,0);
}
function ascii(value:unknown,maximum:number,label:string):string {
  requireValue(typeof value==='string'&&value.length>=1&&value.length<=maximum&&/^[\x21-\x7e]+$/.test(value),label+' requires a bounded opaque ASCII token');return value;
}
function context(input:unknown):KernelFaceContext {
  const record=ownRecord(input,CONTEXT,CONTEXT,'native context');
  return Object.fromEntries(CONTEXT.map(key=>[key,ascii(record[key],48,key)])) as unknown as KernelFaceContext;
}
function numeric(input:unknown,label:string):number[]{
  requireValue(Array.isArray(input)&&input.every(n=>typeof n==='number'&&Number.isFinite(n)),label+' requires actual finite numeric arrays');return input;
}
/** Native sense/location is already applied. R is a proper rotation; winding is unchanged. */
export function prepareKernelFacePreview(dtoInput:unknown,optionsInput:KernelFacePreviewOptions):KernelFacePreview {
  const dto=ownRecord(snapshot(dtoInput),['format','version','lengthUnit','nativeFrame','context','chunks']);
  requireValue(dto.format==='barocss-native-face-mesh'&&dto.version===0&&dto.lengthUnit==='mm'&&dto.nativeFrame==='part-xyz','own CAD face-mesh v0/mm/part-xyz required');
  const settings=ownRecord(snapshot(optionsInput),['displayId','packetRevision']);
  requireValue(typeof settings.displayId==='string'&&/^[A-Za-z_][A-Za-z0-9_-]{0,47}$/.test(settings.displayId),'derived displayId requires an ASCII identifier1..48');
  requireValue(typeof settings.packetRevision==='number'&&Number.isInteger(settings.packetRevision)&&settings.packetRevision>=0&&settings.packetRevision<=2147483647,'packet revision outside0..2147483647');
  const ownedContext=context(dto.context);
  requireValue(Array.isArray(dto.chunks)&&dto.chunks.length>=1&&dto.chunks.length<=64,'one to64 actual face chunks required');
  const positions:number[]=[],normals:number[]=[],parameters:number[]=[],indices:number[]=[],faces:KernelFaceBinding[]=[];
  const seen=new Set<string>();
  for(const item of dto.chunks){
    const chunk=ownRecord(item,['faceToken','nativeFaceId','faceOrientation','normalSource','positionsMM','normals','parametersUV','indices']);
    const faceToken=ascii(chunk.faceToken,48,'faceToken'),nativeFaceId=ascii(chunk.nativeFaceId,128,'nativeFaceId');
    requireValue(!seen.has(faceToken),'duplicate result-scoped face token');seen.add(faceToken);
    requireValue(chunk.faceOrientation==='forward'||chunk.faceOrientation==='reversed','actual face sense required');
    requireValue(chunk.normalSource==='own-tessellation'||chunk.normalSource==='native-surface-evaluation'||chunk.normalSource==='mesh-computed','actual normal source required');
    const p=numeric(chunk.positionsMM,'native positions'),n=numeric(chunk.normals,'native normals'),uv=numeric(chunk.parametersUV,'native UV'),tri=numeric(chunk.indices,'local triangles');
    const count=p.length/3,offset=positions.length/3,indexStart=indices.length;
    requireValue(Number.isInteger(count)&&count>=3&&offset+count<=4096,'native vertex budget exceeded');
    requireValue(n.length===p.length&&uv.length===count*2,'matching normals and genuine per-vertex UV required');
    requireValue(tri.length>=3&&tri.length%3===0&&indices.length+tri.length<=7938*3,'native triangle budget exceeded');
    requireValue(p.every(value=>Math.abs(value)<=1e6),'native positions outside±1e6mm');
    requireValue(tri.every(value=>Number.isInteger(value)&&value>=0&&value<count),'local triangle index outside face');
    for(let i=0;i<p.length;i+=3){
      requireValue(Math.abs(Math.hypot(n[i],n[i+1],n[i+2])-1)<=1e-5,'actual normals must be unit length');
      positions.push(p[i],p[i+2],-p[i+1]);normals.push(n[i],n[i+2],-n[i+1]);
    }
    parameters.push(...uv);indices.push(...tri.map(value=>value+offset));
    faces.push({reference:{...ownedContext,faceToken,nativeFaceId},faceOrientation:chunk.faceOrientation,normalSource:chunk.normalSource,
      vertexRange:[offset,offset+count],indexRange:[indexStart,indices.length]});
  }
  const min:[number,number,number]=[Infinity,Infinity,Infinity],max:[number,number,number]=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<positions.length;i++) {const axis=i%3;min[axis]=Math.min(min[axis],positions[i]);max[axis]=Math.max(max[axis],positions[i]);}
  const packet=validatePreviewPacket({version:0,surfaceId:settings.displayId,revision:settings.packetRevision,lengthUnit:'mm',coordinateSystem:'right-handed-y-up',winding:'ccw',positions,normals,parameters,indices,bounds:{min,max}});
  const result=freezeGpuData({packet,context:ownedContext,faces});preparedResults.add(result);return result;
}
/** Resolve a serialized face ref only into the exact prepared result that owns it. */
export function resolveKernelFaceReference(prepared:KernelFacePreview,referenceInput:unknown):KernelFaceBinding|null {
  requireValue(preparedResults.has(prepared),'use an owned prepareKernelFacePreview result');
  const record=ownRecord(snapshot(referenceInput),[...CONTEXT,'faceToken','nativeFaceId']);
  const refContext=context(Object.fromEntries(CONTEXT.map(key=>[key,record[key]])));
  const faceToken=ascii(record.faceToken,48,'faceToken'),nativeFaceId=ascii(record.nativeFaceId,128,'nativeFaceId');
  if(CONTEXT.some(key=>prepared.context[key]!==refContext[key]))return null;
  return prepared.faces.find(face=>face.reference.faceToken===faceToken&&face.reference.nativeFaceId===nativeFaceId)??null;
}
