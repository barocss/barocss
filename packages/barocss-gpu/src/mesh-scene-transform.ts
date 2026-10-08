import {requireMeshExecution} from './gpu-compiler.js';
import {resolveMeshIntent,validateMeshGeometry} from './mesh-packet.js';
import type {Vec3} from './scene.js';

/** Display pose in the original packet's declared Y-up XYZ millimetres. */
export interface MeshSceneTransform {
  translationMm:Vec3;
  rotationXYZW:[number,number,number,number];
  scale:Vec3;
}
/** Extrema of the actual Float32 display positions, in scene units. */
export interface MeshSceneBounds {min:Vec3;max:Vec3}
export type SceneMesh=ReturnType<typeof requireMeshExecution>&{
  transform?:MeshSceneTransform;
  displayBounds:MeshSceneBounds;
};

function requireValue(condition:unknown,message:string):asserts condition {
  if(!condition)throw new RangeError(message);
}
function vector(input:unknown,count:number,label:string):number[] {
  requireValue(Array.isArray(input)&&Object.getPrototypeOf(input)===Array.prototype,label+' must be a plain array');
  requireValue(Object.getOwnPropertyDescriptor(input,'length')!.value===count,label+' has incorrect length');
  requireValue(Reflect.ownKeys(input).length===count+1,label+' must be dense without extra fields');
  return Array.from({length:count},(_,i)=>{
    const d=Object.getOwnPropertyDescriptor(input,String(i));
    requireValue(d&&'value'in d&&d.enumerable&&typeof d.value==='number'&&Number.isFinite(d.value),label+' must contain finite own numeric data');
    return d.value as number;
  });
}
export function prepareSceneTransform(input:unknown):MeshSceneTransform {
  const keys=['translationMm','rotationXYZW','scale'];
  requireValue(input!==null&&typeof input==='object'&&Object.getPrototypeOf(input)===Object.prototype,'Mesh scene transform must be plain data');
  const actual=Reflect.ownKeys(input);
  requireValue(actual.length===keys.length&&actual.every(k=>typeof k==='string'&&keys.includes(k)),'Mesh scene transform has missing or unsupported fields');
  const data:Record<string,unknown>={};
  for(const key of keys){const d=Object.getOwnPropertyDescriptor(input,key);requireValue(d&&'value'in d&&d.enumerable,'Mesh scene transform fields must be own data');data[key]=d.value;}
  const translationMm=vector(data.translationMm,3,'translationMm') as Vec3;
  const scale=vector(data.scale,3,'scale') as Vec3;
  const rotationXYZW=vector(data.rotationXYZW,4,'rotationXYZW') as MeshSceneTransform['rotationXYZW'];
  requireValue(translationMm.every(n=>Math.abs(n)<=10000),'Display translation exceeds ±10000 mm');
  requireValue(scale.every(n=>n>=.001&&n<=100),'Display scale must be in [0.001,100]');
  requireValue(rotationXYZW.every(n=>Math.abs(n)<=1)&&Math.abs(Math.hypot(...rotationXYZW)-1)<=1e-9,'Display rotation must be a unit XYZW quaternion within 1e-9');
  for(const owned of [translationMm,scale,rotationXYZW])Object.freeze(owned);
  return Object.freeze({translationMm,rotationXYZW,scale});
}
export function displayBounds(positions:ArrayLike<number>):MeshSceneBounds {
  const min:Vec3=[Infinity,Infinity,Infinity],max:Vec3=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<positions.length;i++){const axis=i%3;min[axis]=Math.min(min[axis],positions[i]);max[axis]=Math.max(max[axis],positions[i]);}
  return{min,max};
}
export function sceneRotation(pose:MeshSceneTransform):(a:number,b:number,c:number)=>Vec3 {
  const qLength=Math.hypot(...pose.rotationXYZW),[x,y,z,w]=pose.rotationXYZW.map(n=>n/qLength);
  const rotation=[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w),2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w),2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)];
  return(a,b,c)=>[rotation[0]*a+rotation[1]*b+rotation[2]*c,rotation[3]*a+rotation[4]*b+rotation[5]*c,rotation[6]*a+rotation[7]*b+rotation[8]*c];
}
export function prepareSceneMesh(packetInput:unknown,optionsInput:unknown,transformInput:unknown,hasTransform:boolean):SceneMesh {
  // Keep the complete old compiler/lowering path for omitted transforms.
  if(!hasTransform){const mesh=requireMeshExecution(packetInput,optionsInput);return{...mesh,displayBounds:displayBounds(mesh.positions)};}
  const pose=prepareSceneTransform(transformInput),{packet,options}=resolveMeshIntent(packetInput,optionsInput),rotate=sceneRotation(pose);
  const positions64:number[]=[],normals64:number[]=[];
  for(let i=0;i<packet.positions.length;i+=3){
    const point=rotate(packet.positions[i]*pose.scale[0],packet.positions[i+1]*pose.scale[1],packet.positions[i+2]*pose.scale[2]);
    const normal=rotate(packet.normals[i]/pose.scale[0],packet.normals[i+1]/pose.scale[1],packet.normals[i+2]/pose.scale[2]),length=Math.hypot(...normal);
    requireValue(Number.isFinite(length)&&length>0,'Transformed normal is unsafe');
    for(let axis=0;axis<3;axis++){
      const converted=(pose.translationMm[axis]+point[axis])*options.mmToSceneUnit+options.translate[axis];
      requireValue(Number.isFinite(converted)&&Math.abs(converted)<=1000,'Transformed GPU positions must be finite and within 1000 scene units');
      positions64.push(converted);normals64.push(normal[axis]/length);
    }
  }
  validateMeshGeometry(positions64,normals64,packet.indices,'Transformed display');
  const positions=Float32Array.from(positions64),normals=Float32Array.from(normals64),indices=Uint16Array.from(packet.indices);
  validateMeshGeometry(positions,normals,indices,'Transformed Float32 GPU');
  return{packet,options,positions,normals,indices,transform:pose,displayBounds:displayBounds(positions)};
}
