import { BarocssError } from '../core/barocss-error.js';
import {compileGpu} from './gpu-compiler.js';
import type {GpuExecution} from './gpu-compiler.js';
import {prepareCamera,validateMeshCamera} from './camera.js';
import type {MeshCamera} from './camera.js';
import {prepareMesh,validatePreviewPacket} from './mesh-packet.js';
import type {PreviewPacket} from './mesh-packet.js';
import {freezeGpuData,ownRecord} from './gpu-data.js';
import type {RGB,Vec3} from '../scene/scene.js';

export type MixedDepthDiagnosticCode='INPUT'|'VERSION'|'BUDGET'|'SOURCE'|'PROFILE'|'CAMERA'|'NATIVE'|'GPU'|'DISPOSED'|'CONTEXT';
export class MixedDepthError extends BarocssError {
  constructor(public readonly code:MixedDepthDiagnosticCode,message:string,cause?:unknown){
    super(code, message,cause===undefined?undefined:{cause});this.name='MixedDepthError';
  }
}
export interface MixedDepthSurfaceV0 {ref:{modelId:string;geometryId:string};packet:PreviewPacket;color:RGB}
/** Original CAD source remains host authority; this packet is only its approximate display. */
export interface MixedDepthFrameV0 {
  format:'barocss-gpu-mixed-depth-frame';version:0;profile:'sdf-sphere-native-surface-v0';sourceVersion:1;
  source:string;surface:MixedDepthSurfaceV0;camera:MeshCamera;mmToSceneUnit:number;translate:Vec3;
}
export interface PreparedMixedDepthFrame {frame:MixedDepthFrameV0;execution:Extract<GpuExecution,{kind:'sdf'}>;mesh:ReturnType<typeof prepareMesh>}
function check(condition:unknown,code:MixedDepthDiagnosticCode,message:string):asserts condition {
  if(!condition)throw new MixedDepthError(code,message);
}
/** Bounded descriptor reads precede every authored value/accessor; active cycles never recurse. */
function snapshot(input:unknown):unknown {
  const active=new Set<object>();let values=0;
  const visit=(value:unknown,depth:number):unknown=>{
    check(++values<=16384&&depth<=16,'BUDGET','Mixed frame reflection budget exceeded');
    if(value===null||typeof value==='boolean')return value;
    if(typeof value==='number'){check(Number.isFinite(value),'INPUT','Mixed frame requires finite numbers');return value;}
    if(typeof value==='string'){check(value.length<=65536,'BUDGET','Mixed frame string budget exceeded');return value;}
    check(value!==null&&typeof value==='object','INPUT','Mixed frame requires plain data');
    check(!active.has(value),'INPUT','Mixed frame contains cyclic data');active.add(value);
    try{
      const array=Array.isArray(value);
      check(Object.getPrototypeOf(value)===(array?Array.prototype:Object.prototype),'INPUT','Mixed frame requires plain objects and arrays');
      if(array){
        const length=Object.getOwnPropertyDescriptor(value,'length')!.value as number;
        check(length<=1536,'BUDGET','Mixed frame array budget exceeded');
        const keys=Reflect.ownKeys(value);check(keys.length===length+1,'INPUT','Mixed frame arrays must be dense own data');
        check(keys.every(k=>k==='length'||typeof k==='string'&&/^(0|[1-9]\d*)$/.test(k)&&Number(k)<length),'INPUT','Mixed frame array has extra fields');
        const result=[];
        for(let i=0;i<length;i++){
          const d=Object.getOwnPropertyDescriptor(value,String(i));
          check(d&&'value'in d&&d.enumerable,'INPUT','Mixed frame array contains an accessor or missing field');
          result.push(visit(d.value,depth+1));
        }
        return result;
      }
      const keys=Reflect.ownKeys(value);check(keys.length<=16,'BUDGET','Mixed frame record budget exceeded');
      const result:Record<string,unknown>={};
      for(const key of keys){
        check(typeof key==='string'&&key.length<=128,'INPUT','Mixed frame requires bounded string data keys');
        const d=Object.getOwnPropertyDescriptor(value,key);
        check(d&&'value'in d&&d.enumerable,'INPUT','Mixed frame record contains an accessor or hidden field');
        Object.defineProperty(result,key,{value:visit(d.value,depth+1),enumerable:true,writable:true,configurable:true});
      }
      return result;
    }finally{active.delete(value);}
  };
  return visit(input,0);
}
function record(value:unknown,keys:readonly string[]):Record<string,unknown>{
  try{return ownRecord(value,keys);}catch(cause){throw new MixedDepthError('INPUT','Mixed frame has missing or unsupported fields',cause);}
}
function identifier(value:unknown):asserts value is string {
  check(typeof value==='string'&&/^[A-Za-z_][A-Za-z0-9_.:-]{0,127}$/.test(value),'INPUT','Mixed native reference requires an ASCII identifier of 1..128 characters');
}

/** Internal preparation compiles source once and reuses existing native packet/F32 admission. */
export function resolveMixedDepthFrame(input:unknown):PreparedMixedDepthFrame {
  const data=record(snapshot(input),['format','version','profile','sourceVersion','source','surface','camera','mmToSceneUnit','translate']);
  check(data.format==='barocss-gpu-mixed-depth-frame'&&data.version===0&&data.sourceVersion===1,'VERSION','Mixed frame requires format/version0/sourceVersion1');
  check(data.profile==='sdf-sphere-native-surface-v0','PROFILE','Unsupported mixed depth profile');
  check(typeof data.source==='string','INPUT','Mixed scene source must be text');
  check(data.source.length<=65536&&new TextEncoder().encode(data.source).length<=65536,'BUDGET','Mixed scene source exceeds 64 KiB');
  const compiled=compileGpu({kind:'scene',source:data.source,sourceVersion:1});
  if(!compiled.ok)throw new MixedDepthError('SOURCE',compiled.diagnostics[0].message,freezeGpuData(compiled.diagnostics));
  check(compiled.execution.kind==='sdf','PROFILE','Mixed scene requires SDF execution');
  const execution=compiled.execution;
  check(execution.scene.objects.length===1&&execution.scene.objects[0].type==='sphere','PROFILE','Mixed profile requires exactly one Sphere');
  const surfaceData=record(data.surface,['ref','packet','color']),ref=record(surfaceData.ref,['modelId','geometryId']);
  identifier(ref.modelId);identifier(ref.geometryId);
  let packet:PreviewPacket;
  try{packet=validatePreviewPacket(surfaceData.packet);}catch(cause){throw new MixedDepthError('NATIVE','Mixed Surface packet refused',cause);}
  check(packet.positions.length/3<=289&&packet.indices.length/3<=512,'BUDGET','Mixed Surface exceeds 289 vertices or 512 triangles');
  check(ref.geometryId===packet.surfaceId,'NATIVE','Mixed geometry reference must match packet surfaceId');
  let camera:MeshCamera;
  try{camera=validateMeshCamera(data.camera);}catch(cause){throw new MixedDepthError('CAMERA','Mixed camera refused',cause);}
  const sphere=execution.scene.objects[0],{view}=prepareCamera(camera,1);
  const b=[view[2],view[6],view[10]],centre=sphere.translate,radius=sphere.radius;
  const distance=Math.hypot(...centre.map((n,i)=>n-camera.eye[i]));
  const depth=-(b[0]*centre[0]+b[1]*centre[1]+b[2]*centre[2]+view[14]);
  const extent=radius*Math.hypot(...b),epsilon=.001;
  check(distance>radius+epsilon,'CAMERA','Mixed profile refuses a camera inside or on the Sphere');
  check(depth-extent>camera.near+epsilon&&depth+extent<camera.far-epsilon,'CAMERA','Mixed Sphere must be strictly inside common near/far planes');
  check(distance+radius<100-epsilon,'CAMERA','Mixed Sphere must be strictly inside travel100');
  let mesh:ReturnType<typeof prepareMesh>;
  try{mesh=prepareMesh(packet,{mmToSceneUnit:data.mmToSceneUnit as number,translate:data.translate as Vec3,color:surfaceData.color as RGB,background:execution.scene.background,camera});}
  catch(cause){throw new MixedDepthError('NATIVE','Mixed Surface conversion or color refused',cause);}
  const frame:MixedDepthFrameV0=freezeGpuData({format:'barocss-gpu-mixed-depth-frame',version:0,profile:'sdf-sphere-native-surface-v0',sourceVersion:1,
    source:data.source,surface:{ref:{modelId:ref.modelId,geometryId:ref.geometryId},packet:mesh.packet,color:mesh.options.color},
    camera,mmToSceneUnit:mesh.options.mmToSceneUnit,translate:mesh.options.translate});
  return{frame,execution,mesh};
}
/** Copies and freezes the authored mixed request; it never reconstructs native CAD source. */
export function prepareMixedDepthFrame(input:unknown):MixedDepthFrameV0{return resolveMixedDepthFrame(input).frame;}
