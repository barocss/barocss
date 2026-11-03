// Corruption fixture adapter only: keep damaged logical S227 bytes, valid outer envelope.
import {crc32} from 'node:zlib';
import {createHash} from 'node:crypto';
import {logicalFrames} from './physical.mjs';
export async function unwrapped(bytes){async function* chunks(){yield bytes;}const parts=[];for await(const b of logicalFrames(chunks()))parts.push(b);return Buffer.concat(parts);}
export function literalEnvelope(logical,index=0){
 const h=Buffer.from(JSON.stringify({version:1,index,epoch:0,reset:false,mode:'literal',logicalBytes:logical.length,storedBytes:logical.length,logicalCrc32:crc32(logical),logicalSha256:createHash('sha256').update(logical).digest('hex')}));const prefix=Buffer.alloc(16);prefix.write('L227');prefix.writeUInt32BE(h.length,4);prefix.writeUInt32BE(logical.length,8);prefix.writeUInt32BE(crc32(logical,crc32(h)),12);return Buffer.concat([prefix,h,logical]);
}
export function wrapped(bytes){let at=0,index=0;const parts=[];while(at<bytes.length){const n=16+bytes.readUInt32BE(at+4)+bytes.readUInt32BE(at+8);if(at+n>bytes.length){parts.push(literalEnvelope(bytes.subarray(at),index));break;}parts.push(literalEnvelope(bytes.subarray(at,at+n),index++));at+=n;}return Buffer.concat(parts);}
