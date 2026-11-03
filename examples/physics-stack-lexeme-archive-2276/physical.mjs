import {createHash} from 'node:crypto';
import {crc32} from 'node:zlib';
import {LexemeDictionary,LexemeStop,LEXEME_LIMITS} from './lexemes.mjs';
const MAX=16+2048+3*2**21+16,HEADER=2048,sha=b=>createHash('sha256').update(b).digest('hex');
const need=(v,c)=>{if(!v)throw new LexemeStop(c);};
export function physicalFrame(parts,header,state,pendingBytes){
 const length=parts.reduce((n,b)=>n+b.length,0);need(length<=MAX&&pendingBytes+2*length+state.bytes+LEXEME_LIMITS.reserve<=LEXEME_LIMITS.scratch,'LEXEME_SCRATCH');
 const logical=Buffer.concat(parts),ranges=[[16,16+parts[1].length]],start=16+parts[1].length;
 if(header.channel==='rpc')ranges.push([start,logical.length]);
 if(header.channel==='record'){need(parts[2].length>=16,'RECORD_LENGTH');const jsonLength=parts[2].readUInt32BE(0);need(jsonLength<=2**21&&16+jsonLength<=parts[2].length,'RECORD_LENGTH');ranges.push([start+16,start+16+jsonLength]);}
 const encoded=state.encode(logical,ranges,pendingBytes),h={version:1,index:encoded.index,epoch:encoded.epoch,reset:encoded.reset,mode:encoded.mode,logicalBytes:length,storedBytes:encoded.payload.length,logicalCrc32:crc32(logical),logicalSha256:sha(logical)};
 const bytes=Buffer.from(JSON.stringify(h));need(bytes.length+parts[1].length+32<=HEADER,'PHYSICAL_HEADER');const prefix=Buffer.alloc(16);prefix.write('L227');prefix.writeUInt32BE(bytes.length,4);prefix.writeUInt32BE(encoded.payload.length,8);prefix.writeUInt32BE(crc32(encoded.payload,crc32(bytes)),12);return [prefix,bytes,encoded.payload];
}
export async function* logicalFrames(chunks){
 const state=new LexemeDictionary();let stage='prefix',prefix=Buffer.alloc(16),head=null,payload=null,at=0,h=null,expected=null;
 for await(const chunk of chunks){let offset=0;while(offset<chunk.length){const target=stage==='prefix'?prefix:stage==='head'?head:payload,n=Math.min(target.length-at,chunk.length-offset);chunk.copy(target,at,offset,offset+n);at+=n;offset+=n;if(at!==target.length)continue;at=0;
  if(stage==='prefix'){need(state.index<=40000,'ENTRY_BOUND');need(prefix.subarray(0,4).toString()==='L227','PHYSICAL_MAGIC');expected={h:prefix.readUInt32BE(4),p:prefix.readUInt32BE(8),crc:prefix.readUInt32BE(12)};need(expected.h>0&&expected.h<=HEADER&&expected.p>0&&expected.p<=MAX,'PHYSICAL_LENGTH');head=Buffer.alloc(expected.h);stage='head';}
  else if(stage==='head'){
   h=JSON.parse(head.toString('utf8'));need(h&&Object.keys(h).length===9&&['version','index','epoch','reset','mode','logicalBytes','storedBytes','logicalCrc32','logicalSha256'].every(k=>Object.hasOwn(h,k)),'PHYSICAL_HEADER');need(h.version===1&&h.storedBytes===expected.p&&Number.isInteger(h.logicalBytes)&&h.logicalBytes>=16&&h.logicalBytes<=MAX&&h.storedBytes<=h.logicalBytes&&Number.isInteger(h.logicalCrc32)&&h.logicalCrc32>=0&&h.logicalCrc32<=0xffffffff&&/^[a-f0-9]{64}$/.test(h.logicalSha256),'PHYSICAL_HEADER');
   need(h.index===state.index&&Number.isInteger(h.epoch)&&h.epoch>=0,'EPOCH_INDEX');need(expected.p+2*h.logicalBytes+state.bytes+(h.mode==='lexemes'?3*LEXEME_LIMITS.bytes:0)+LEXEME_LIMITS.reserve<=LEXEME_LIMITS.scratch,'LEXEME_SCRATCH');payload=Buffer.alloc(expected.p);stage='payload';
  }else{need(crc32(payload,crc32(head))===expected.crc,'PHYSICAL_CRC');const logical=state.decode(h,payload);need(crc32(logical)===h.logicalCrc32,'LOGICAL_CRC');need(sha(logical)===h.logicalSha256,'LOGICAL_SHA');need(logical.subarray(0,4).toString()==='S227'&&16+logical.readUInt32BE(4)+logical.readUInt32BE(8)===logical.length,'LOGICAL_FRAME_BINDING');const originalHeader=JSON.parse(logical.subarray(16,16+logical.readUInt32BE(4)));need(originalHeader.index===h.index,'LOGICAL_FRAME_BINDING');yield logical;head=payload=h=expected=null;stage='prefix';}
 }}need(stage==='prefix'&&at===0,'PHYSICAL_TRUNCATED');
}
export {LexemeDictionary};
