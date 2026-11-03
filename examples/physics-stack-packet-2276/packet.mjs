// Test-only detached transport. No physics, worker scheduling or public API.
import {serialize,deserialize} from 'node:v8';
import {types} from 'node:util';
export const PACKET_LIMITS=Object.freeze({wireBytes:2*1024*1024,depth:32,containers:8192,edges:32768});
export class PacketFailure extends Error {
 constructor(code,message,stage='admission'){super(message);this.name='PacketFailure';this.code=code;this.stage=stage;}
}
const fail=(code,message,stage)=>{throw new PacketFailure(code,message,stage);};
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
// Generous fixed Node22.19 wire charges; not an allocator/heap/RSS estimate.
export function inspectPacket(value,maxWireBytes=PACKET_LIMITS.wireBytes){
 if(!Number.isSafeInteger(maxWireBytes)||maxWireBytes<64||maxWireBytes>PACKET_LIMITS.wireBytes)fail('INVALID_LIMIT','wire limit must be integer64..2097152');
 if(!value||typeof value!=='object'||types.isProxy(value)||Array.isArray(value))fail('SHAPE','packet root must be a plain record');
 let boundBytes=0,containers=0,edges=0,numericLeaves=0,maxDepth=0;
 const seen=new Map(),active=new Set();
 function charge(bytes){if(bytes>maxWireBytes-boundBytes)fail('CAPACITY','conservative encoding capacity exceeded');boundBytes+=bytes;}
 function walk(item,depth){
  if(depth>PACKET_LIMITS.depth)fail('DEPTH','packet depth exceeded');maxDepth=Math.max(maxDepth,depth);
  if(typeof item==='number'){if(!Number.isFinite(item))fail('NONFINITE','finite binary64 required');numericLeaves++;charge(16);return;}
  if(item===null||typeof item==='boolean'){charge(16);return;}
  if(typeof item==='string'){charge(32+4*item.length);return;}
  if(typeof item!=='object')fail('SHAPE','unsupported primitive');
  if(types.isProxy(item))fail('SHAPE','proxies are not packet data');
  const array=Array.isArray(item),prototype=Object.getPrototypeOf(item);
  if(prototype!==(array?Array.prototype:Object.prototype))fail('SHAPE','only ordinary records and arrays admitted');
  if(active.has(item))fail('CYCLE','cyclic packet graph');
  if(seen.has(item)){charge(16);return;}
  if(++containers>PACKET_LIMITS.containers)fail('CAPACITY','container count exceeded');
  if(array&&item.length>PACKET_LIMITS.edges)fail('CAPACITY','array length exceeded');
  charge(64);seen.set(item,true);active.add(item);
  const keys=Reflect.ownKeys(item);
  if(array&&keys.length!==item.length+1)fail('SHAPE','dense arrays without extra properties required');
  for(const key of keys){
   if(array&&key==='length')continue;
   if(typeof key!=='string')fail('SHAPE','symbol keys are not packet data');
   if(++edges>PACKET_LIMITS.edges)fail('CAPACITY','edge count exceeded');
   const descriptor=Object.getOwnPropertyDescriptor(item,key);
   if(!descriptor||!own(descriptor,'value')||!descriptor.enumerable)fail('SHAPE','enumerable data properties required');
   if(array&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=item.length))fail('SHAPE','dense array index required');
   charge(32+4*key.length);walk(descriptor.value,depth+1);
  }
  if(array)for(let i=0;i<item.length;i++)if(!own(item,String(i)))fail('SHAPE','sparse arrays are not packet data');
  active.delete(item);
 }
 walk(value,0);return Object.freeze({boundBytes,maxWireBytes,containers,edges,numericLeaves,maxDepth});
}
function compareGraph(source,copy,expectedLeaves){
 const forward=new Map(),reverse=new Map(),bits=new DataView(new ArrayBuffer(16));let numericLeaves=0;
 function compare(a,b){
  if(typeof a==='number'){
   if(typeof b!=='number'||!Number.isFinite(b))fail('WORDS','numeric shape changed','verification');
   bits.setFloat64(0,a,false);bits.setFloat64(8,b,false);numericLeaves++;
   if(bits.getBigUint64(0,false)!==bits.getBigUint64(8,false))fail('WORDS','binary64 word changed','verification');return;
  }
  if(a===null||typeof a!=='object'){if(a!==b)fail('VALUE','primitive changed','verification');return;}
  if(!b||typeof b!=='object'||a===b)fail('OWNERSHIP','container was not detached','verification');
  if(forward.has(a)){if(forward.get(a)!==b)fail('ALIAS','source alias was split','verification');return;}
  if(reverse.has(b))fail('ALIAS','distinct source containers were merged','verification');
  forward.set(a,b);reverse.set(b,a);
  const left=Object.keys(a),right=Object.keys(b);
  if(Array.isArray(a)!==Array.isArray(b)||left.length!==right.length||left.some((key,i)=>key!==right[i]))fail('SHAPE','property order or shape changed','verification');
  for(const key of left)compare(a[key],b[key]);
 }
 compare(source,copy);if(numericLeaves!==expectedLeaves)fail('WORDS','numeric leaf census changed','verification');return numericLeaves;
}
export function detachPacket(value,maxWireBytes=PACKET_LIMITS.wireBytes){
 const admission=inspectPacket(value,maxWireBytes);
 if(process.versions.node!=='22.19.0')fail('RUNTIME','wire model requires Node22.19.0','encoding');
 const wire=serialize(value);
 if(wire.length>admission.boundBytes||wire.length>maxWireBytes)fail('CAPACITY_MODEL','actual encoding exceeded admitted envelope','encoding');
 const packet=deserialize(wire);inspectPacket(packet,maxWireBytes);
 const numericLeavesVerified=compareGraph(value,packet,admission.numericLeaves);
 return {packet,wire,admission,numericLeavesVerified,completeOwnedDataQualified:false};
}
