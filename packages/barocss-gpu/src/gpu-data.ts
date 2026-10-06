import type {AnyScene,SceneObject1,SceneObject,Vec3} from './scene-types.js';
import {freezeScene} from './scene-front.js';
/** Reflective data checks happen before reading any authored field/accessor. */
export function ownRecord(value:unknown,allowed:readonly string[],required:readonly string[]=allowed,path='input'):Record<string,unknown>{
 if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw new Error(`${path} must be a plain data record`);
 const keys=Reflect.ownKeys(value);if(keys.length>allowed.length||keys.some(k=>typeof k!=='string'||!allowed.includes(k)))throw new Error(`${path} has missing or unsupported data fields`);
 const descriptors=Object.getOwnPropertyDescriptors(value);
 if(keys.some(k=>typeof k!=='string'||!allowed.includes(k)||!('value'in descriptors[k])||!descriptors[k].enumerable)||required.some(k=>!Object.hasOwn(descriptors,k)))throw new Error(`${path} has missing or unsupported data fields`);
 return Object.fromEntries(Object.entries(descriptors).map(([k,d])=>[k,d.value]));
}
function array(value:unknown,maximum:number,path:string):unknown[]{
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)throw new Error(`${path} must be a plain array`);
 const length=Object.getOwnPropertyDescriptor(value,'length')!.value as number;
 if(length>maximum)throw new Error(`${path} exceeds ${maximum}`);
 const keys=Reflect.ownKeys(value);if(keys.length!==length+1)throw new Error(`${path} is sparse or has non-data array fields`);
 const descriptors=Object.getOwnPropertyDescriptors(value) as Record<string,PropertyDescriptor>;
 for(const k of Reflect.ownKeys(descriptors)){if(k==='length')continue;if(typeof k!=='string'||!/^(0|[1-9]\d*)$/.test(k)||Number(k)>=length||!('value'in descriptors[k])||!descriptors[k].enumerable)throw new Error(`${path} has non-data array fields`);}
 return Array.from({length},(_,i)=>{if(!Object.hasOwn(descriptors,i))throw new Error(`${path} is sparse`);return descriptors[i].value;});
}
function triple(value:unknown,positive:boolean,color:boolean,path:string):Vec3{const items=array(value,3,path);if(items.length!==3||items.some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>(color?1:1000)||(color&&(n as number)<0)||(positive&&((n as number)<=0||Math.fround(n as number)<=0))))throw new Error(`Invalid scene ${path}`);return items as Vec3;}
export function resolveStructuredScene(input:unknown):AnyScene{
 const s=ownRecord(input,['version','name','background','objects'],['version','background','objects'],'scene');
 if((s.version!==0&&s.version!==1)||('name'in s&&typeof s.name!=='string'))throw new Error('Invalid scene');
 const seen=new Set<string>(),objects=array(s.objects,32,'objects').map((item,index)=>{const tag=ownRecord(item,['id','type','color','translate','radius','size','rotateDegrees','height'],['type']);const cylinder=s.version===1&&tag.type==='cylinder';const o=ownRecord(item,['id','type','color','translate','radius','size',...(s.version===1?['rotateDegrees']:[]),...(cylinder?['height']:[])],undefined,`objects[${index}]`);
  if(typeof o.id!=='string'||seen.has(o.id)||(o.type!=='sphere'&&o.type!=='box'&&!cylinder))throw new Error('Invalid scene object');seen.add(o.id);
  const color=triple(o.color,false,true,'color'),translate=triple(o.translate,false,false,'translate'),size=triple(o.size,true,false,'size');if(typeof o.radius!=='number'||!Number.isFinite(o.radius)||o.radius<=0||o.radius>1000||Math.fround(o.radius)<=0)throw new Error('Invalid sphere radius');
  const common={id:o.id,color,translate,radius:o.radius,size};
  if(s.version===1){const rotation=triple(o.rotateDegrees,false,false,'rotateDegrees');if(rotation.some(n=>Math.abs(n)>360))throw new Error('Rotation must be within -360 to 360');const rotateDegrees=rotation.map(n=>n||0) as Vec3;
   if(cylinder){if(typeof o.height!=='number'||!Number.isFinite(o.height)||o.height<=0||o.height>1000||Math.fround(o.height/2)<=0)throw new Error('Invalid cylinder height');return{...common,type:'cylinder',height:o.height,rotateDegrees} as SceneObject1;}
   return{...common,type:o.type,rotateDegrees} as SceneObject1;
  }return{...common,type:o.type} as SceneObject;
 });const name=typeof s.name==='string'?s.name:'',background=triple(s.background,false,true,'background');return s.version===1?freezeScene({version:1,name,background,objects:objects as SceneObject1[]}):freezeScene({version:0,name,background,objects:objects as SceneObject[]});
}
/** Used only for compiler-owned data; authored records must pass their guards first. */
export function copyGpuData<T>(value:T):T{if(Array.isArray(value))return value.map(v=>copyGpuData(v))as T;if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,copyGpuData(v)]))as T;return value;}
export function freezeGpuData<T>(value:T):T{if(value&&typeof value==='object'){for(const child of Object.values(value))freezeGpuData(child);Object.freeze(value);}return value;}
