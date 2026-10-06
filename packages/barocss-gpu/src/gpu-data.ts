import type {Scene,SceneObject,Vec3} from './scene-types.js';
import {freezeScene} from './scene-front.js';
/** Reflective data checks happen before reading any authored field/accessor. */
export function ownRecord(value:unknown,allowed:readonly string[],required:readonly string[]=allowed,path='input'):Record<string,unknown>{
 if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw new Error(`${path} must be a plain data record`);
 const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);
 if(keys.some(k=>typeof k!=='string'||!allowed.includes(k)||!('value'in descriptors[k])||!descriptors[k].enumerable)||required.some(k=>!Object.hasOwn(descriptors,k)))throw new Error(`${path} has missing or unsupported data fields`);
 return Object.fromEntries(Object.entries(descriptors).map(([k,d])=>[k,d.value]));
}
function array(value:unknown,maximum:number,path:string):unknown[]{
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)throw new Error(`${path} must be a plain array`);
 const descriptors=Object.getOwnPropertyDescriptors(value) as Record<string,PropertyDescriptor>,length=descriptors.length.value as number;
 if(length>maximum)throw new Error(`${path} exceeds ${maximum}`);
 for(const k of Reflect.ownKeys(descriptors)){if(k==='length')continue;if(typeof k!=='string'||!/^(0|[1-9]\d*)$/.test(k)||Number(k)>=length||!('value'in descriptors[k])||!descriptors[k].enumerable)throw new Error(`${path} has non-data array fields`);}
 return Array.from({length},(_,i)=>{if(!Object.hasOwn(descriptors,i))throw new Error(`${path} is sparse`);return descriptors[i].value;});
}
function triple(value:unknown,positive:boolean,color:boolean,path:string):Vec3{const items=array(value,3,path);if(items.length!==3||items.some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>(color?1:1000)||(color&&(n as number)<0)||(positive&&((n as number)<=0||Math.fround(n as number)<=0))))throw new Error(`Invalid scene ${path}`);return items as Vec3;}
export function resolveStructuredScene(input:unknown):Scene{
 const s=ownRecord(input,['version','name','background','objects'],['version','background','objects'],'scene');
 if(s.version!==0||('name'in s&&typeof s.name!=='string'))throw new Error('Invalid scene');
 const seen=new Set<string>(),objects=array(s.objects,32,'objects').map((item,index)=>{const o=ownRecord(item,['id','type','color','translate','radius','size'],undefined,`objects[${index}]`);
  if(typeof o.id!=='string'||seen.has(o.id)||(o.type!=='sphere'&&o.type!=='box'))throw new Error('Invalid scene object');seen.add(o.id);
  const color=triple(o.color,false,true,'color'),translate=triple(o.translate,false,false,'translate'),size=triple(o.size,true,false,'size');if(typeof o.radius!=='number'||!Number.isFinite(o.radius)||o.radius<=0||o.radius>1000||Math.fround(o.radius)<=0)throw new Error('Invalid sphere radius');
  return{id:o.id,type:o.type,color,translate,radius:o.radius,size} as SceneObject;
 });return freezeScene({version:0,name:typeof s.name==='string'?s.name:'',background:triple(s.background,false,true,'background'),objects});
}
/** Used only for compiler-owned data; authored records must pass their guards first. */
export function copyGpuData<T>(value:T):T{if(Array.isArray(value))return value.map(v=>copyGpuData(v))as T;if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,copyGpuData(v)]))as T;return value;}
export function freezeGpuData<T>(value:T):T{if(value&&typeof value==='object'){for(const child of Object.values(value))freezeGpuData(child);Object.freeze(value);}return value;}
