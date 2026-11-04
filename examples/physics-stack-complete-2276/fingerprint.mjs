// Same qualified transcript as the prefix protocol, buffered before one hash call.
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {inspectPacket} from '../physics-stack-packet-2276/packet.mjs';
export function fingerprint(packet){
 const admission=inspectPacket(packet),bytes=Buffer.allocUnsafe(admission.boundBytes),seen=new Map();let offset=0;
 const tag=character=>{bytes[offset++]=character.charCodeAt(0);};
 const u32=value=>{bytes.writeUInt32BE(value,offset);offset+=4;};
 function text(value){u32(value.length);for(let i=0;i<value.length;i++){bytes.writeUInt16BE(value.charCodeAt(i),offset);offset+=2;}}
 function walk(value){
  if(value===null){tag('N');return;}
  if(typeof value==='boolean'){tag(value?'T':'F');return;}
  if(typeof value==='number'){tag('D');bytes.writeDoubleBE(value,offset);offset+=8;return;}
  if(typeof value==='string'){tag('S');text(value);return;}
  if(seen.has(value)){tag('R');u32(seen.get(value));return;}
  const id=seen.size;seen.set(value,id);tag(Array.isArray(value)?'A':'O');u32(id);
  const keys=Object.keys(value);u32(keys.length);if(Array.isArray(value))u32(value.length);
  for(const key of keys){tag('K');text(key);walk(value[key]);}tag('E');
 }
 walk(packet);assert.ok(offset<=admission.boundBytes,'canonical transcript capacity model');
 return {sha256:createHash('sha256').update(bytes.subarray(0,offset)).digest('hex'),...admission};
}
export function verifyFingerprint(packet,expected){const actual=fingerprint(packet);assert.deepEqual(actual,expected,'structured-clone fingerprint changed');return actual;}
