import type {CoplanarFaceBooleanExtrusionMeshResult} from '@barocss/cad';
import {prepareBooleanShellBuffers} from './boolean-shell-buffers.js';
import type {PreparedBooleanShellBuffers} from './boolean-shell-buffers.js';
import {validateMeshOptions} from '../mesh/mesh-packet.js';
import type {MeshOptions} from '../mesh/mesh-packet.js';
import type {MeshCamera} from '../mesh/camera.js';
import type {NativeBufferBounds} from '../mesh/native-mesh-buffers.js';
import {ownRecord,freezeGpuData} from '../mesh/gpu-data.js';

/** Caller-selected graph output qualification, not GPU-verified CAD graph association. */
export interface BooleanShellLeafRef {
  graphId:string; graphRevision:number; featureId:string; outputSlotId:string;
}
export interface BooleanShellSceneEntry {
  ref:BooleanShellLeafRef; native:CoplanarFaceBooleanExtrusionMeshResult;
  color:[number,number,number]; edges:{color:[number,number,number]}|null;
}
export interface BooleanShellSceneInputV0 {
  schema:'barocss-gpu-boolean-shell-scene'; version:0; entries:BooleanShellSceneEntry[];
}
export type BooleanShellSceneOptions=Omit<MeshOptions,'color'|'camera'>&{camera:MeshCamera};
export interface PreparedBooleanShellSceneEntry {
  ref:BooleanShellLeafRef; color:[number,number,number];
  edges:BooleanShellSceneEntry['edges']; buffers:PreparedBooleanShellBuffers;
}
/** Internal CPU staging data; typed arrays never escape through renderer getters. */
export interface PreparedBooleanShellScene {
  scene:BooleanShellSceneInputV0; options:BooleanShellSceneOptions;
  entries:PreparedBooleanShellSceneEntry[]; bounds:NativeBufferBounds;
}
function dense(input:unknown,maximum:number,path:string):unknown[] {
  if(!Array.isArray(input)||Object.getPrototypeOf(input)!==Array.prototype)throw new RangeError(path+' requires a plain array');
  const descriptors=Object.getOwnPropertyDescriptors(input) as Record<string,PropertyDescriptor>,length=descriptors.length.value;
  if(!Number.isInteger(length)||length<0||length>maximum||Reflect.ownKeys(input).length!==length+1)
    throw new RangeError(path+' exceeds bounds or has sparse/extra data');
  return Array.from({length},(_,i)=>{
    const value=descriptors[String(i)];
    if(!value||!('value'in value)||!value.enumerable)throw new RangeError(path+' requires dense own data');
    return value.value;
  });
}
function rgb(input:unknown,path:string):[number,number,number] {
  const color=dense(input,3,path);
  if(color.length!==3||color.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>1))
    throw new RangeError(path+' requires three finite RGB values in [0,1]');
  return color as [number,number,number];
}
function reference(input:unknown):BooleanShellLeafRef {
  const value=ownRecord(input,['graphId','graphRevision','featureId','outputSlotId']);
  for(const key of ['graphId','featureId','outputSlotId']){
    if(typeof value[key]!=='string'||! /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(value[key] as string))
      throw new RangeError('Shell scene '+key+' requires an ASCII identifier1..64');
  }
  if(!Number.isSafeInteger(value.graphRevision)||(value.graphRevision as number)<0)
    throw new RangeError('Shell scene graphRevision requires a nonnegative safe integer');
  return value as unknown as BooleanShellLeafRef;
}
function options(input:unknown):BooleanShellSceneOptions {
  const data=ownRecord(input,['mmToSceneUnit','translate','background','camera','lighting'],['mmToSceneUnit','translate','background','camera']);
  // Reuse current MeshOptions admission. This color carrier is not scene appearance.
  const mesh=validateMeshOptions({...data,color:[1,1,1]});
  return freezeGpuData({mmToSceneUnit:mesh.mmToSceneUnit,translate:mesh.translate,background:mesh.background,
    camera:mesh.camera!,...(mesh.lighting?{lighting:mesh.lighting}:{})});
}
function bounds(entries:PreparedBooleanShellSceneEntry[]):NativeBufferBounds {
  const occupied=entries.flatMap(entry=>entry.buffers.bounds?[entry.buffers.bounds]:[]);
  if(!occupied.length)return null;
  return freezeGpuData({min:[0,1,2].map(axis=>Math.min(...occupied.map(b=>b.min[axis]))) as [number,number,number],
    max:[0,1,2].map(axis=>Math.max(...occupied.map(b=>b.max[axis]))) as [number,number,number]});
}
export function prepareBooleanShellScene(input:unknown,optionsInput:unknown):PreparedBooleanShellScene {
  const settings=options(optionsInput),data=ownRecord(input,['schema','version','entries']);
  if(data.schema!=='barocss-gpu-boolean-shell-scene'||data.version!==0)throw new RangeError('Unsupported Shell scene schema/version');
  const seen=new Set<string>();
  const admitted=dense(data.entries,4,'Shell scene entries').map(inputEntry=>{
    const entry=ownRecord(inputEntry,['ref','native','color','edges']),ref=reference(entry.ref);
    const key=JSON.stringify([ref.graphId,ref.graphRevision,ref.featureId,ref.outputSlotId]);
    if(seen.has(key))throw new RangeError('Duplicate qualified Shell scene leaf');seen.add(key);
    const color=rgb(entry.color,'Shell scene color');
    const edges=entry.edges===null?null:{color:rgb(ownRecord(entry.edges,['color']).color,'Shell scene edge color')};
    return{ref,native:entry.native,color,edges};
  });
  const entries=admitted.map(entry=>({ref:entry.ref,color:entry.color,edges:entry.edges,
    buffers:prepareBooleanShellBuffers(entry.native,{mmToSceneUnit:settings.mmToSceneUnit,translate:settings.translate})}));
  const scene=freezeGpuData({schema:'barocss-gpu-boolean-shell-scene' as const,version:0 as const,
    entries:entries.map(entry=>({ref:entry.ref,native:entry.buffers.native,color:entry.color,edges:entry.edges}))});
  return{scene,options:settings,entries,bounds:bounds(entries)};
}
export function reprepareBooleanShellScene(previous:PreparedBooleanShellScene,optionsInput:unknown):PreparedBooleanShellScene {
  const settings=options(optionsInput),before=previous.options;
  if(Object.is(settings.mmToSceneUnit,before.mmToSceneUnit)&&settings.translate.every((n,i)=>Object.is(n,before.translate[i])))
    return{...previous,options:settings};
  return prepareBooleanShellScene(previous.scene,settings);
}
