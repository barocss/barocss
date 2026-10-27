import {GPUError} from '../core/gpu-error.js';
import {freezeGpuData} from './gpu-data.js';

/** Derived display data in scene units, separate from native CAD and Physics metre data. */
export interface ClothLayerV0 {
  version:0;
  kind:'simulation-cloth';
  layerId:string;
  contextId:string;
  sceneRevision:string;
  stepIndex:number;
  coordinateSystem:'right-handed-y-up-scene-units';
  positions:number[];
  indices:number[];
}
export interface PreparedClothLayer {
  layer:ClothLayerV0;
  positions:Float32Array;
  normals:Float32Array;
  indices:Uint16Array;
}
function check(value:unknown,message:string):asserts value {
  if(!value)throw new GPUError('Cloth layer: '+message);
}
function numbers(input:unknown,length:number,path:string):number[] {
  check(Array.isArray(input)&&Object.getPrototypeOf(input)===Array.prototype,path+' must be a plain dense array');
  const size=Object.getOwnPropertyDescriptor(input,'length');
  check(size&&'value'in size&&size.value===length&&Reflect.ownKeys(input).length===length+1,path+' has an invalid fixed length or extra fields');
  const descriptors=Object.getOwnPropertyDescriptors(input),values:number[]=[];
  for(let i=0;i<length;i++){
    const field=descriptors[String(i)];
    check(field&&'value'in field&&field.enumerable&&typeof field.value==='number'&&Number.isFinite(field.value),path+' requires own finite numeric data');
    values.push(field.value);
  }
  return values;
}
function topology(indices:number[]):void {
  let offset=0;
  for(let z=0;z<16;z++)for(let x=0;x<16;x++){
    const a=z*17+x;
    for(const expected of [a,a+17,a+1,a+1,a+17,a+18])
      check(Number.isInteger(indices[offset])&&Object.is(indices[offset++],expected),'indices must match the canonical ordered 17 by 17 topology');
  }
}
/** Validate each actual triangle. Accumulate area-weighted normals only for the lowered data. */
function triangles(positions:ArrayLike<number>,indices:number[],normals:Float64Array|null):void {
  for(let i=0;i<indices.length;i+=3){
    const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
    const ux=positions[b]-positions[a],uy=positions[b+1]-positions[a+1],uz=positions[b+2]-positions[a+2];
    const vx=positions[c]-positions[a],vy=positions[c+1]-positions[a+1],vz=positions[c+2]-positions[a+2];
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    check(Number.isFinite(nx)&&Number.isFinite(ny)&&Number.isFinite(nz)&&Math.hypot(nx,ny,nz)>0,
      normals?'Float32 triangle is degenerate or nonfinite':'original triangle is degenerate or nonfinite');
    if(normals)for(const vertex of [a,b,c]){normals[vertex]+=nx;normals[vertex+1]+=ny;normals[vertex+2]+=nz;}
  }
}
/** Copy and admit fixed cloth data before any GL allocation. No unit or pose conversion. */
export function prepareClothLayer(input:unknown,previous:ClothLayerV0|null,newGeneration=false):PreparedClothLayer|null {
  if(input===null)return null;
  check(input!==null&&typeof input==='object'&&Object.getPrototypeOf(input)===Object.prototype,'plain own DTO required');
  const fields=['version','kind','layerId','contextId','sceneRevision','stepIndex','coordinateSystem','positions','indices'];
  const keys=Reflect.ownKeys(input),descriptors=Object.getOwnPropertyDescriptors(input);
  check(keys.length===fields.length&&keys.every(key=>typeof key==='string'&&fields.includes(key)&&'value'in descriptors[key]&&descriptors[key].enumerable),'exact own fields required');
  const version=descriptors.version.value,kind=descriptors.kind.value,layerId=descriptors.layerId.value;
  const contextId=descriptors.contextId.value,sceneRevision=descriptors.sceneRevision.value,stepIndex=descriptors.stepIndex.value;
  const coordinateSystem=descriptors.coordinateSystem.value;
  check(version===0&&kind==='simulation-cloth'&&coordinateSystem==='right-handed-y-up-scene-units','unsupported version, kind or coordinate system');
  for(const value of [layerId,contextId,sceneRevision])
    check(typeof value==='string'&&/^[A-Za-z_][A-Za-z0-9_.:-]{0,127}$/.test(value),'ASCII layer/context/revision1..128 required');
  check(typeof stepIndex==='number'&&Number.isInteger(stepIndex)&&stepIndex>=0&&stepIndex<=240,'stepIndex0..240 required');
  const positions=numbers(descriptors.positions.value,867,'positions');
  check(positions.every(value=>Math.abs(value)<=1000),'positions must be within ±1000 scene units');
  const indices=numbers(descriptors.indices.value,1536,'indices');topology(indices);
  if(previous){
    const sameIdentity=layerId===previous.layerId&&contextId===previous.contextId&&sceneRevision===previous.sceneRevision;
    check(sameIdentity||newGeneration,'clear cloth or replace the full frame before changing identity');
    if(sameIdentity){
      check(stepIndex>=previous.stepIndex,'regressing step requires an explicit identity reset');
      if(stepIndex===previous.stepIndex)
        check(positions.length===previous.positions.length&&indices.length===previous.indices.length&&
          positions.every((value,i)=>Object.is(value,previous.positions[i]))&&indices.every((value,i)=>Object.is(value,previous.indices[i])),
          'equal step must retain original positions and topology');
    }
  }
  triangles(positions,indices,null);
  const lowered=Float32Array.from(positions);
  check(lowered.every(value=>Number.isFinite(value)&&Math.abs(value)<=1000),'Float32 positions exceed bounds');
  const weighted=new Float64Array(867);triangles(lowered,indices,weighted);
  const normals=new Float32Array(867);
  for(let i=0;i<weighted.length;i+=3){
    const length=Math.hypot(weighted[i],weighted[i+1],weighted[i+2]);
    check(Number.isFinite(length)&&length>0,'area-weighted vertex normal is zero, cancelling or nonfinite');
    normals[i]=weighted[i]/length;normals[i+1]=weighted[i+1]/length;normals[i+2]=weighted[i+2]/length;
    check(Number.isFinite(normals[i])&&Number.isFinite(normals[i+1])&&Number.isFinite(normals[i+2])&&Math.hypot(normals[i],normals[i+1],normals[i+2])>0,
      'Float32 vertex normal is zero or nonfinite');
  }
  const layer:ClothLayerV0=freezeGpuData({version:0,kind:'simulation-cloth',layerId,contextId,sceneRevision,stepIndex,coordinateSystem,positions,indices});
  return{layer,positions:lowered,normals,indices:Uint16Array.from(indices)};
}
