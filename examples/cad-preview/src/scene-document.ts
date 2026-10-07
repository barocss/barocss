import {validateMeshCamera} from '@barocss/gpu';
import type {MeshCamera} from '@barocss/gpu';
import {admitNative,serializeNative} from './native-adapters';
import type {NativeIntent} from './native-adapters';
import {identityPlacement,validatePlacement,type Placement} from './scene-transform';
export {identityPlacement,type Placement} from './scene-transform';
export interface SceneObject {id:string;name:string;visible:boolean;placement:Placement;intent:NativeIntent}
export interface SceneDocument {format:'barocss-editor-scene';version:1;lengthUnit:'mm';coordinateSystem:'right-handed-z-up';objects:SceneObject[];view:{camera:MeshCamera;edgesVisible:boolean}}
export const INITIAL_CAMERA:MeshCamera={eye:[3.8,3,4.8],target:[.65,.35,-.35],up:[0,1,0],fovYDegrees:42,near:.01,far:100};
export function emptyScene():SceneDocument{return{format:'barocss-editor-scene',version:1,lengthUnit:'mm',coordinateSystem:'right-handed-z-up',objects:[],view:{camera:structuredClone(INITIAL_CAMERA),edgesVisible:true}};}
export function signedJson(value:unknown):string {
 if(typeof value==='number'){if(!Number.isFinite(value))throw Error('Finite JSON numbers required');return Object.is(value,-0)?'-0':String(value);}
 if(typeof value==='string'||typeof value==='boolean'||value===null)return JSON.stringify(value);
 if(Array.isArray(value))return'['+value.map(signedJson).join(',')+']';
 if(value&&typeof value==='object')return'{'+Object.entries(value).map(([k,v])=>JSON.stringify(k)+':'+signedJson(v)).join(',')+'}';
 throw Error('Unsupported scene data');
}
function own(input:unknown,fields:string[]):Record<string,unknown>{
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.getPrototypeOf(input)!==Object.prototype)throw Error('Plain scene record required');
 const keys=Reflect.ownKeys(input),d=Object.getOwnPropertyDescriptors(input);
 if(keys.length!==fields.length||!fields.every(k=>Object.hasOwn(d,k))||keys.some(k=>typeof k!=='string'||!fields.includes(k)||!('value'in d[k])||!d[k].enumerable))throw Error('Missing or unsupported scene fields');return Object.fromEntries(fields.map(k=>[k,d[k].value]));
}
function budget(value:unknown){let remaining=8192;const active=new Set<object>();function visit(v:unknown,depth:number){if(--remaining<0||depth>16)throw Error('Scene exceeds own-data budget');if(typeof v==='number'){if(!Number.isFinite(v))throw Error('Finite scene numbers required');return;}if(typeof v==='string'){if(v.length>262144)throw Error('Scene string too long');return;}if(typeof v==='boolean')return;if(!v||typeof v!=='object')throw Error('Unsupported scene data');if(active.has(v))throw Error('Cyclic scene unsupported');const array=Array.isArray(v);if(Object.getPrototypeOf(v)!==(array?Array.prototype:Object.prototype))throw Error('Foreign scene data');const keys=Reflect.ownKeys(v),d=Object.getOwnPropertyDescriptors(v) as Record<string,PropertyDescriptor>;if(keys.length>(array?1025:32)||keys.some(k=>typeof k!=='string'||!('value'in d[k])||!(array&&k==='length'||d[k].enumerable)))throw Error('Non-own or over-budget scene data');active.add(v);if(array){const length=d.length.value as number;if(length>1024||keys.length!==length+1)throw Error('Dense bounded scene array required');for(let i=0;i<length;i++){if(!Object.hasOwn(d,String(i)))throw Error('Sparse scene array');visit(d[String(i)].value,depth+1);}}else for(const k of keys as string[])visit(d[k].value,depth+1);active.delete(v);}visit(value,0);}
function readScene(input:unknown,nativeAlreadyValidated:boolean):SceneDocument{
 budget(input);const s=own(input,['format','version','lengthUnit','coordinateSystem','objects','view']);
 if(s.format!=='barocss-editor-scene'||(s.version!==0&&s.version!==1)||s.lengthUnit!=='mm'||s.coordinateSystem!=='right-handed-z-up')throw Error('Only native editor scene v0 or v1/mm/Z-up files are supported');
 if(!Array.isArray(s.objects)||s.objects.length>4)throw Error('At most four native objects in this checkpoint');const ids=new Set<string>();
 const objects=s.objects.map(item=>{const o=own(item,['id','name','visible','placement','intent']);if(typeof o.id!=='string'||!/^[A-Za-z_][A-Za-z0-9_-]{0,47}$/.test(o.id)||ids.has(o.id))throw Error('Unique native scene object ID required');ids.add(o.id);if(typeof o.name!=='string'||o.name.length>128||typeof o.visible!=='boolean')throw Error('Invalid object name/visibility');const p=s.version===0?own(o.placement,['translateMM']):o.placement;const placement=validatePlacement(s.version===0?{...identityPlacement(),translateMM:(p as Record<string,unknown>).translateMM}:p);const header=own(o.intent,(o.intent as {kind?:unknown})?.kind==='surface'?['kind','sourceVersion','source']:(o.intent as {kind?:unknown})?.kind==='plate-hole'?['kind','request']:['kind','document']);if(header.kind!=='box'&&header.kind!=='circle-prism'&&header.kind!=='plate-hole'&&header.kind!=='surface')throw Error('Unsupported native object kind');if(header.kind==='surface'&&(header.sourceVersion!==0||typeof header.source!=='string'||new TextEncoder().encode(header.source).length>262144))throw Error('Bounded literal sourceVersion0 required');const payload=header.kind==='surface'?{sourceVersion:header.sourceVersion,source:header.source}:header.kind==='plate-hole'?header.request:header.document;const intent:NativeIntent=nativeAlreadyValidated?structuredClone(header) as NativeIntent:admitNative(header.kind,payload);return{id:o.id,name:o.name,visible:o.visible,placement,intent};});
 const view=own(s.view,['camera','edgesVisible']);if(typeof view.edgesVisible!=='boolean')throw Error('Explicit edges view required');return{format:'barocss-editor-scene',version:1,lengthUnit:'mm',coordinateSystem:'right-handed-z-up',objects,view:{camera:validateMeshCamera(view.camera),edgesVisible:view.edgesVisible}};
}
export function admitScene(input:unknown):SceneDocument{return readScene(input,false);}
/** The fast path is only for controller-owned candidates already validated by buildSceneDisplay. */
export function serializeScene(scene:SceneDocument,nativeAlreadyValidated=false):string {
 const owned=readScene(scene,nativeAlreadyValidated);const native=owned.objects.map(o=>'{"id":'+signedJson(o.id)+',"name":'+signedJson(o.name)+',"visible":'+signedJson(o.visible)+',"placement":'+signedJson(o.placement)+',"intent":{"kind":'+signedJson(o.intent.kind)+(o.intent.kind==='surface'?',"sourceVersion":0,"source":'+signedJson(serializeNative(o.intent)):(o.intent.kind==='plate-hole'?',"request":':',"document":')+serializeNative(o.intent).trim())+'}}');
 const text='{"format":"barocss-editor-scene","version":1,"lengthUnit":"mm","coordinateSystem":"right-handed-z-up","objects":['+native.join(',')+'],"view":'+signedJson(owned.view)+'}\n';if(new TextEncoder().encode(text).length>524288)throw Error('Scene exceeds512KiB');return text;
}
export function parseScene(text:string):SceneDocument{if(new TextEncoder().encode(text).length>524288)throw Error('Scene exceeds512KiB');return admitScene(JSON.parse(text));}
