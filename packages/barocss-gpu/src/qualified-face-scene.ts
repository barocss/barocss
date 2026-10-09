import {compileCadModel,validateFaceBundle,tessellateSurface} from '@barocss/cad';
import type {FaceBundle,Surface} from '@barocss/cad';
import {validateMeshCamera} from './camera.js';
import type {MeshCamera} from './camera.js';
import {prepareMesh} from './mesh-packet.js';
import {freezeGpuData,ownRecord} from './gpu-data.js';
import type {RGB,Vec3} from './scene.js';

export type QualifiedFaceSceneDiagnosticCode='INPUT'|'VERSION'|'BUDGET'|'SOURCE'|'SOURCE_BINDING'|'NATIVE'|'GPU'|'DISPOSED'|'CONTEXT';
export class QualifiedFaceSceneError extends Error {
  constructor(public readonly code:QualifiedFaceSceneDiagnosticCode,message:string,cause?:unknown){super(message,cause===undefined?undefined:{cause});this.name='QualifiedFaceSceneError';}
}
export interface QualifiedFaceAssetV0 {sourceId:string;source:string;face:FaceBundle;color:RGB}
/** Independent original source/Face assets; this does not create global Shell or Solid topology. */
export interface QualifiedFaceSceneV0 {
  format:'barocss-gpu-qualified-face-scene';version:0;profile:'source-qualified-forward-face-v0';sourceVersion:0;
  basis:'authored-xyz-matches-rhyup';assets:QualifiedFaceAssetV0[];countU:number;countV:number;camera:MeshCamera;
  mmToSceneUnit:number;translate:Vec3;background:RGB;
}
function check(condition:unknown,code:QualifiedFaceSceneDiagnosticCode,message:string):asserts condition {
  if(!condition)throw new QualifiedFaceSceneError(code,message);
}
function snapshot(input:unknown):unknown {
  let values=0;const active=new Set<object>();
  const visit=(value:unknown,depth:number):unknown=>{
    check(++values<=65536&&depth<=24,'BUDGET','Qualified Face scene reflection budget exceeded');
    if(value===null||typeof value==='boolean')return value;
    if(typeof value==='number'){check(Number.isFinite(value),'INPUT','Qualified Face data require finite numbers');return value;}
    if(typeof value==='string'){check(value.length<=65536,'BUDGET','Qualified Face string budget exceeded');return value;}
    check(value!==null&&typeof value==='object','INPUT','Qualified Face scene requires plain data');
    check(!active.has(value),'INPUT','Qualified Face data contain a cycle');active.add(value);
    try{
      const array=Array.isArray(value);check(Object.getPrototypeOf(value)===(array?Array.prototype:Object.prototype),'INPUT','Qualified Face scene requires plain objects and arrays');
      if(array){
        const length=Object.getOwnPropertyDescriptor(value,'length')!.value as number;
        check(length<=1536,'BUDGET','Qualified Face array budget exceeded');
        const keys=Reflect.ownKeys(value);check(keys.length===length+1&&keys.every(k=>k==='length'||typeof k==='string'&&/^(0|[1-9]\d*)$/.test(k)&&Number(k)<length),'INPUT','Qualified Face arrays must be dense own data');
        const result=[];
        for(let i=0;i<length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));check(d&&'value'in d&&d.enumerable,'INPUT','Qualified Face array contains an accessor or missing field');result.push(visit(d.value,depth+1));}
        return result;
      }
      const keys=Reflect.ownKeys(value);check(keys.length<=16,'BUDGET','Qualified Face record budget exceeded');
      const result:Record<string,unknown>={};
      for(const key of keys){check(typeof key==='string'&&key.length<=128,'INPUT','Qualified Face keys must be bounded strings');const d=Object.getOwnPropertyDescriptor(value,key);check(d&&'value'in d&&d.enumerable,'INPUT','Qualified Face record contains an accessor or hidden field');Object.defineProperty(result,key,{value:visit(d.value,depth+1),enumerable:true,writable:true,configurable:true});}
      return result;
    }finally{active.delete(value);}
  };
  return visit(input,0);
}
function record(input:unknown,keys:readonly string[]):Record<string,unknown>{try{return ownRecord(input,keys);}catch(cause){throw new QualifiedFaceSceneError('INPUT','Qualified Face record has missing or unsupported fields',cause);}}
/** Both operands are bounded owned/kernel data; preserve -0 and ignore key ordering. */
function same(a:unknown,b:unknown):boolean {
  if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return Object.is(a,b);
  if(Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&same((a as Record<string,unknown>)[k],(b as Record<string,unknown>)[k]));
}
export function resolveQualifiedFaceScene(input:unknown):{scene:QualifiedFaceSceneV0;meshes:Array<ReturnType<typeof prepareMesh>>} {
  const data=record(snapshot(input),['format','version','profile','sourceVersion','basis','assets','countU','countV','camera','mmToSceneUnit','translate','background']);
  check(data.format==='barocss-gpu-qualified-face-scene'&&data.version===0&&data.sourceVersion===0&&data.profile==='source-qualified-forward-face-v0'&&data.basis==='authored-xyz-matches-rhyup','VERSION','Qualified Face scene requires explicit version0/source0/forward profile and authored XYZ basis');
  check(Array.isArray(data.assets)&&data.assets.length>=2&&data.assets.length<=6,'BUDGET','Qualified Face scene requires2..6 independent assets');
  check(Number.isInteger(data.countU)&&Number.isInteger(data.countV)&&(data.countU as number)>=2&&(data.countU as number)<=17&&(data.countV as number)>=2&&(data.countV as number)<=17,'BUDGET','Qualified Face grid counts must be2..17');
  let camera:MeshCamera;
  try{camera=validateMeshCamera(data.camera);}catch(cause){throw new QualifiedFaceSceneError('INPUT','Qualified Face camera refused',cause);}
  const ids=new Set<string>(),meshes:Array<ReturnType<typeof prepareMesh>>=[];let sourceBytes=0;
  const assets:QualifiedFaceAssetV0[]=data.assets.map(inputAsset=>{
    const asset=record(inputAsset,['sourceId','source','face','color']);
    check(typeof asset.sourceId==='string'&&/^[A-Za-z_][A-Za-z0-9_-]{0,47}$/.test(asset.sourceId)&&!ids.has(asset.sourceId),'INPUT','Qualified Face sourceId must be a unique ASCII namespace1..48');ids.add(asset.sourceId);
    check(typeof asset.source==='string','INPUT','Qualified Face original source must be text');
    const bytes=new TextEncoder().encode(asset.source).length;sourceBytes+=bytes;
    check(bytes<=65536&&sourceBytes<=393216,'BUDGET','Qualified Face source bytes exceed limits');
    const compiled=compileCadModel(asset.source,{sourceVersion:0});
    if(!compiled.ok)throw new QualifiedFaceSceneError('SOURCE',compiled.diagnostics[0].message,freezeGpuData(compiled.diagnostics));
    const faceData=record(asset.face,['geometry','topology']);
    check(same(compiled.model,faceData.geometry),'SOURCE_BINDING','Qualified Face complete geometry must bit-match its original source');
    const face=asset.face as FaceBundle;
    try{validateFaceBundle(face);}catch(cause){throw new QualifiedFaceSceneError('NATIVE','Qualified native forward Face refused',cause);}
    check(compiled.model.version===0&&compiled.model.lengthUnit==='mm'&&compiled.model.objects.length===5&&compiled.model.objects.filter(o=>'degreeU'in o).length===1&&compiled.model.objects.filter(o=>'degree'in o).length===4,'NATIVE','Qualified Face source requires Model0/mm with one Surface and four Curves');
    const surface=compiled.model.objects.find((o):o is Surface=>o.id===face.topology.face.surfaceId&&'degreeU'in o);
    check(surface,'NATIVE','Qualified Face must refer to the original source Surface');
    let mesh:ReturnType<typeof prepareMesh>;
    try{const tess=tessellateSurface(surface,{countU:data.countU as number,countV:data.countV as number,revision:0});mesh=prepareMesh(tess.packet,{camera,mmToSceneUnit:data.mmToSceneUnit as number,translate:data.translate as Vec3,background:data.background as RGB,color:asset.color as RGB});}
    catch(cause){throw new QualifiedFaceSceneError('NATIVE','Qualified Face tessellation or display conversion refused',cause);}
    meshes.push(mesh);return{sourceId:asset.sourceId,source:asset.source,face,color:mesh.options.color};
  });
  const options=meshes[0].options;
  const scene:QualifiedFaceSceneV0=freezeGpuData({format:'barocss-gpu-qualified-face-scene',version:0,profile:'source-qualified-forward-face-v0',sourceVersion:0,basis:'authored-xyz-matches-rhyup',assets,
    countU:data.countU as number,countV:data.countV as number,camera,mmToSceneUnit:options.mmToSceneUnit,translate:options.translate,background:options.background});
  return{scene,meshes};
}
export function prepareQualifiedFaceScene(input:unknown):QualifiedFaceSceneV0{return resolveQualifiedFaceScene(input).scene;}
