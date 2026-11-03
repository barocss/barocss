// Evidence bytes only. No physics imports and no numeric-value substitution.
import {createHash} from 'node:crypto';
export const LEXEME_LIMITS=Object.freeze({bytes:2**21,entries:32768,digits:8192,scratch:16*2**20,reserve:2**20});
export class LexemeStop extends Error{constructor(code){super(code);this.name='LexemeStop';this.code=code;}}
const need=(v,c)=>{if(!v)throw new LexemeStop(c);},hash=b=>createHash('sha256').update(b).digest('hex');
const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b;};
function magnitude(text){const h=BigInt(text).toString(16);return Buffer.from(h.length%2?'0'+h:h,'hex');}
function decimal(bytes){need(bytes.length>0&&bytes.length<=3403,'MAGNITUDE_BOUND');need(bytes.length===1||bytes[0]!==0,'MAGNITUDE_CANONICAL');return BigInt('0x'+bytes.toString('hex')).toString(10);}
// Only bounded ASCII is ever parsed. RAW includes original quotes and escapes.
export function packLexeme(raw){
 need(Buffer.isBuffer(raw)&&raw.length>=24&&raw.length<=LEXEME_LIMITS.bytes&&raw[0]===34&&raw.at(-1)===34,'LEXEME_BOUND');
 let ascii=true;for(const b of raw)if(b<32||b>=127||b===92){ascii=false;break;}
 if(ascii&&raw.length<=2*LEXEME_LIMITS.digits+4){
  const text=raw.subarray(1,-1).toString('ascii'),m=/^(-?)(0|[1-9][0-9]*)\/([1-9][0-9]*)$/.exec(text);
  if(m&&!(m[1]&&m[2]==='0')&&m[2].length<=8192&&m[3].length<=8192){
   const n=magnitude(m[2]),d=magnitude(m[3]),data=Buffer.alloc(5+n.length+d.length);data[0]=m[1]?1:0;data.writeUInt16BE(n.length,1);data.writeUInt16BE(d.length,3);n.copy(data,5);d.copy(data,5+n.length);if(data.length<raw.length)return {kind:1,rawBytes:raw.length,data};
  }
 }
 if(ascii){const text=raw.subarray(1,-1).toString('ascii');if(text.length%2===0&&/^[0-9a-f]+$/.test(text)){const data=Buffer.from(text,'hex');if(data.length<raw.length)return {kind:2,rawBytes:raw.length,data};}}
 return {kind:0,rawBytes:raw.length,data:raw};
}
export function unpackLexeme(kind,rawBytes,data){
 need(Number.isInteger(rawBytes)&&rawBytes>=24&&rawBytes<=LEXEME_LIMITS.bytes,'LEXEME_BOUND');let raw;
 if(kind===0){need(data.length===rawBytes,'RAW_LEXEME_LENGTH');raw=Buffer.from(data);}
 else if(kind===1){
  need(data.length>=7&&data[0]<=1,'FRACTION_HEADER');const n=data.readUInt16BE(1),d=data.readUInt16BE(3);need(n>0&&d>0&&n<=3403&&d<=3403&&5+n+d===data.length,'FRACTION_LENGTH');
  const numerator=decimal(data.subarray(5,5+n)),denominator=decimal(data.subarray(5+n));need(numerator.length<=8192&&denominator.length<=8192&&denominator!=='0'&&!(data[0]&&numerator==='0'),'FRACTION_CANONICAL');
  raw=Buffer.from('"'+(data[0]?'-':'')+numerator+'/'+denominator+'"');
 }else if(kind===2){need(data.length>0&&data.length*2+2===rawBytes,'HEX_LENGTH');raw=Buffer.from('"'+data.toString('hex')+'"');}
 else need(false,'LEXEME_KIND');
 need(raw.length===rawBytes&&raw[0]===34&&raw.at(-1)===34,'LEXEME_RECONSTRUCTION');
 if(kind!==0)need(data.length<raw.length,'LEXEME_CANONICAL');
 return raw;
}
function spans(bytes,ranges){
 const rows=[];for(const [begin,end]of ranges){need(begin>=0&&end<=bytes.length&&begin<=end,'JSON_RANGE');for(let at=begin;at<end;at++){
  if(bytes[at]!==34)continue;const first=at;let closed=false;
  for(at++;at<end;at++){if(bytes[at]===92){at++;continue;}if(bytes[at]===34){closed=true;break;}}
  if(!closed)break;if(at+1-first>=24)rows.push({begin:first,end:at+1});
 }}return rows;
}
export class LexemeDictionary{
 constructor(){this.epoch=0;this.index=0;this.values=[];this.lookup=new Map();this.bytes=0;}
 clear(epoch){this.epoch=epoch;this.values=[];this.lookup.clear();this.bytes=0;}
 find(raw){const key=hash(raw),found=this.lookup.get(key);if(found!==undefined){need(this.values[found].equals(raw),'LEXEME_HASH_COLLISION');return found;}return null;}
 encode(logical,ranges,pendingBytes=0){
  need(Buffer.isBuffer(logical),'LOGICAL_BUFFER');const hits=spans(logical,ranges);let reset=false;
  const plan=()=>{const fresh=[],local=new Map(),refs=[];let size=this.bytes;for(const span of hits){const raw=logical.subarray(span.begin,span.end),key=hash(raw);let id=this.find(raw);if(id===null){const previous=local.get(key);if(previous!==undefined){need(fresh[previous].raw.equals(raw),'LEXEME_HASH_COLLISION');id=this.values.length+previous;}else{if(size+raw.length>LEXEME_LIMITS.bytes||this.values.length+fresh.length>=LEXEME_LIMITS.entries)return null;local.set(key,fresh.length);id=this.values.length+fresh.length;fresh.push({raw,packed:null});size+=raw.length;}}refs.push({...span,id});}return {fresh,refs,size};};
  let planValue=plan();if(!planValue){this.clear(this.epoch+1);reset=true;planValue=plan();}
  if(!planValue)planValue={fresh:[],refs:[],size:this.bytes};
  need(pendingBytes+2*logical.length+this.bytes+LEXEME_LIMITS.reserve<=LEXEME_LIMITS.scratch,'LEXEME_SCRATCH');
  if(pendingBytes+2*logical.length+this.bytes+4*(planValue.size-this.bytes)+LEXEME_LIMITS.reserve>LEXEME_LIMITS.scratch)planValue={fresh:[],refs:[],size:this.bytes};
  const {fresh,refs}=planValue;let stored=2,at=0;
  for(const row of fresh){row.packed=packLexeme(row.raw);stored+=9+row.packed.data.length;}
  for(const row of refs){if(row.begin>at)stored+=5+row.begin-at;stored+=3;at=row.end;}if(at<logical.length)stored+=5+logical.length-at;
  const encoded=refs.length>0&&stored<logical.length,newBytes=encoded?planValue.size-this.bytes:0;
  need(pendingBytes+2*logical.length+this.bytes+4*newBytes+LEXEME_LIMITS.reserve<=LEXEME_LIMITS.scratch,'LEXEME_SCRATCH');
  let payload;
  if(!encoded)payload=logical;
  else{
   payload=Buffer.alloc(stored);payload.writeUInt16BE(fresh.length);let offset=2;
   for(const row of fresh){const v=row.packed;payload[offset++]=v.kind;payload.writeUInt32BE(v.rawBytes,offset);offset+=4;payload.writeUInt32BE(v.data.length,offset);offset+=4;v.data.copy(payload,offset);offset+=v.data.length;}
   at=0;for(const row of refs){if(row.begin>at){payload[offset++]=0;payload.writeUInt32BE(row.begin-at,offset);offset+=4;logical.copy(payload,offset,at,row.begin);offset+=row.begin-at;}payload[offset++]=1;payload.writeUInt16BE(row.id,offset);offset+=2;at=row.end;}
   if(at<logical.length){payload[offset++]=0;payload.writeUInt32BE(logical.length-at,offset);offset+=4;logical.copy(payload,offset,at);offset+=logical.length-at;}need(offset===stored,'PROGRAM_SIZE');
   for(const row of fresh){const bytes=Buffer.from(row.raw);this.lookup.set(hash(bytes),this.values.length);this.values.push(bytes);this.bytes+=bytes.length;}
  }
  return {index:this.index++,epoch:this.epoch,reset,mode:encoded?'lexemes':'literal',logicalBytes:logical.length,payload};
 }
 decode(h,payload){
  need(h.index===this.index&&Number.isInteger(h.epoch)&&typeof h.reset==='boolean'&&['literal','lexemes'].includes(h.mode),'EPOCH_INDEX');
  if(h.reset){need(h.epoch===this.epoch+1,'EPOCH_RESET');this.clear(h.epoch);}else need(h.epoch===this.epoch,'EPOCH_INDEX');
  need(Number.isInteger(h.logicalBytes)&&h.logicalBytes>=16&&payload.length<=h.logicalBytes,'LOGICAL_LENGTH');
  need(payload.length+2*h.logicalBytes+this.bytes+(h.mode==='lexemes'?3*LEXEME_LIMITS.bytes:0)+LEXEME_LIMITS.reserve<=LEXEME_LIMITS.scratch,'LEXEME_SCRATCH');
  let result;
  if(h.mode==='literal'){need(payload.length===h.logicalBytes,'LITERAL_LENGTH');result=Buffer.from(payload);}
  else{
   need(payload.length>=2,'DECLARATION_LENGTH');const count=payload.readUInt16BE(0);need(this.values.length+count<=LEXEME_LIMITS.entries,'DICTIONARY_ENTRIES');let at=2;
   for(let i=0;i<count;i++){need(at+9<=payload.length,'DECLARATION_LENGTH');const kind=payload[at++],rawBytes=payload.readUInt32BE(at);at+=4;const n=payload.readUInt32BE(at);at+=4;need(n<=rawBytes&&at+n<=payload.length&&this.bytes+rawBytes<=LEXEME_LIMITS.bytes,'DICTIONARY_BYTES');const raw=unpackLexeme(kind,rawBytes,payload.subarray(at,at+n));at+=n;need(this.find(raw)===null,'DUPLICATE_DECLARATION');this.lookup.set(hash(raw),this.values.length);this.values.push(raw);this.bytes+=raw.length;}
   result=Buffer.alloc(h.logicalBytes);let end=0;
   while(at<payload.length){const tag=payload[at++];let bytes;if(tag===0){need(at+4<=payload.length,'LITERAL_LENGTH');const n=payload.readUInt32BE(at);at+=4;need(n>0&&at+n<=payload.length,'LITERAL_LENGTH');bytes=payload.subarray(at,at+n);at+=n;}else{need(tag===1&&at+2<=payload.length,'REFERENCE_TAG');const id=payload.readUInt16BE(at);at+=2;need(id<this.values.length,'UNDECLARED_REFERENCE');bytes=this.values[id];}need(end+bytes.length<=result.length,'PROGRAM_LENGTH');bytes.copy(result,end);end+=bytes.length;}
   need(end===result.length,'PROGRAM_LENGTH');
  }
  this.index++;return result;
 }
}
