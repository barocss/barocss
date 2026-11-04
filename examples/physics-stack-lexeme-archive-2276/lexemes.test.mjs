import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {LexemeDictionary,packLexeme,unpackLexeme,LEXEME_LIMITS} from './lexemes.mjs';
import {StreamArchive,retainedBudget,verifyArchive} from './archive.mjs';
import {StreamArchive as OriginalArchive,retainedBudget as originalBudget} from '../physics-stack-stream-native-crc-2276/archive.mjs';
import {verifySourceArchive} from './source-reader.mjs';
assert.ok(process.env.LEXEME_TEST_OUT,'Set LEXEME_TEST_OUT to a fresh directory');const home=resolve(process.env.LEXEME_TEST_OUT);mkdirSync(home);let serial=0;
const fresh=()=>{const path=join(home,String(++serial));mkdirSync(path);return path;};
const pack=text=>packLexeme(Buffer.from(text)),round=text=>{const bytes=Buffer.from(text),p=pack(text);assert.deepEqual(unpackLexeme(p.kind,p.rawBytes,p.data),bytes);return p;};
function encode(text,state=new LexemeDictionary()){const bytes=Buffer.from(text);return state.encode(bytes,[[0,bytes.length]],0);}
const decode=(encoded,state=new LexemeDictionary())=>state.decode(encoded,encoded.payload);
test('24 literal canonical fractions retain signs and unreduced numerator/denominator',()=>{
 const n='1208925819614629174706176';for(const sign of ['', '-'])for(const d of ['3','6']){const p=round('"'+sign+n+'/'+d+'"');assert.equal(p.kind,1);assert.equal(p.data[0],sign?1:0);assert.equal(p.data.subarray(5,16).toString('hex'),'0100000000000000000000');assert.equal(p.data[16],Number(d));}
 assert.equal(round('"0/1208925819614629174706176"').kind,1);
});
test('25 noncanonical fraction spellings and over8192 digit part stay exact RAW',()=>{
 for(const text of ['"-0/1208925819614629174706176"','"01208925819614629174706176/3"','"+1208925819614629174706176/3"','"1208925819614629174706176/0"','"1208925819614629174706176/-3"','"'+ '1'.repeat(8193)+'/3"'])assert.equal(round(text).kind,0);
});
test('26 lowercase even hex preserves leading zeros; Unicode/escapes/highbit remain RAW',()=>{
 const text='"000000000000000000000000000000000001"',p=round(text);assert.equal(p.kind,2);assert.equal(p.data.toString('hex'),text.slice(1,-1));
 for(const value of ['"ABCDEFABCDEFABCDEFABCDEFABCDEF"','"'+'a'.repeat(25)+'"','"한글😀'.repeat(12)+'"','"\\u0031'.repeat(12)+'"'])assert.equal(round(value).kind,0);
 const high=Buffer.concat([Buffer.from('"'),Buffer.alloc(30,255),Buffer.from('"')]),raw=packLexeme(high);assert.equal(raw.kind,0);assert.deepEqual(unpackLexeme(0,raw.rawBytes,raw.data),high);
});
test('27 stable dense declared references retain exact bytes across frames',()=>{
 const text='["1208925819614629174706176/6","1208925819614629174706176/6"]',enc=new LexemeDictionary(),dec=new LexemeDictionary(),first=encode(text,enc);
 assert.equal(first.mode,'lexemes');assert.equal(enc.values.length,1);assert.equal(decode(first,dec).toString(),text);
 const next=encode(text,enc);assert.equal(next.index,1);assert.equal(next.epoch,0);assert.equal(next.payload.readUInt16BE(0),0);assert.equal(decode(next,dec).toString(),text);
});
test('28 exact2MiB dictionary byte cap and32768entry cap reset before next frame',()=>{
 const enc=new LexemeDictionary(),dec=new LexemeDictionary(),bytes=Buffer.from('"'+'0'.repeat(2**21-2)+'"'),first=enc.encode(bytes,[[0,bytes.length]]);
 assert.equal(enc.bytes,2**21);assert.deepEqual(decode(first,dec),bytes);const text='["1208925819614629174706176/3","1208925819614629174706176/3"]',next=encode(text,enc);assert.equal(next.reset,true);assert.equal(next.epoch,1);assert.equal(decode(next,dec).toString(),text);assert.throws(()=>packLexeme(Buffer.alloc(2**21+1)),{code:'LEXEME_BOUND'});
 const a=new LexemeDictionary(),b=new LexemeDictionary();for(let half=0;half<2;half++){const items=Array.from({length:16384},(_,i)=>'"k'+String(i+half*16384).padStart(21,'0')+'"'),bank='['+items.concat(items,items).join(',')+']',full=encode(bank,a);assert.equal(a.values.length,(half+1)*16384);assert.equal(decode(full,b).toString(),bank);}const reset=encode(text,a);assert.equal(reset.reset,true);assert.equal(a.values.length,1);assert.equal(decode(reset,b).toString(),text);assert.equal(LEXEME_LIMITS.entries,32768);
});
test('29 wrong index/epoch, undeclared or forward reference always refuse',()=>{
 const base={index:0,epoch:0,reset:false,mode:'lexemes',logicalBytes:24},ref=Buffer.from([0,0,1,0,0]);assert.throws(()=>new LexemeDictionary().decode(base,ref),{code:'UNDECLARED_REFERENCE'});
 for(const h of [{...base,index:1},{...base,epoch:1},{...base,reset:true,epoch:2}])assert.throws(()=>new LexemeDictionary().decode(h,ref));
 const excessive=Buffer.from([0x80,0x01]);assert.throws(()=>new LexemeDictionary().decode(base,excessive),{code:'DICTIONARY_ENTRIES'});
});
test('30 malformed typed lengths/kinds and noncanonical binary magnitudes refuse',()=>{
 const p=pack('"1208925819614629174706176/6"');assert.throws(()=>unpackLexeme(7,p.rawBytes,p.data),{code:'LEXEME_KIND'});assert.throws(()=>unpackLexeme(1,p.rawBytes+1,p.data));
 const damaged=Buffer.from(p.data);damaged.writeUInt16BE(65535,1);assert.throws(()=>unpackLexeme(1,p.rawBytes,damaged));const zero=Buffer.from(p.data);zero[5]=0;assert.throws(()=>unpackLexeme(1,p.rawBytes,zero),{code:'MAGNITUDE_CANONICAL'});
 assert.throws(()=>unpackLexeme(2,24,Buffer.alloc(2)),{code:'HEX_LENGTH'});
});
test('31 actual queued lexical input and aliased negative-zero records own their bytes',async()=>{
 const path=fresh(),w=new StreamArchive(path,retainedBudget()),payload=Buffer.from('["1208925819614629174706176/6","1208925819614629174706176/6"]'),expected=Buffer.from(payload),shared={v:-0};
 const a=w.appendRpc('TEST',1,'control','request',payload),b=w.appendRecord('TEST',1,{a:shared,b:shared});payload.fill(0);shared.v=7;await Promise.all([a,b]);await w.close();const entries=[];assert.equal((await verifyArchive(join(path,'events.gz'),e=>entries.push(e))).status,'ARCHIVE_VERIFIED');assert.deepEqual(entries[0].payload,expected);assert.ok(Object.is(entries[1].record.a.v,-0));assert.ok(Object.is(entries[1].record.b.v,-0));
});
test('32 outer physical lengths/CRC and trailing bytes fail before promotion',async()=>{
 const source=fresh(),w=new StreamArchive(source,retainedBudget());await w.appendRpc('TEST',1,'control','request',Buffer.from('"1208925819614629174706176/6"'));await w.close();const original=gunzipSync(readFileSync(join(source,'events.gz')));
 for(const modify of [b=>b.writeUInt32BE(2049,4),b=>b.writeUInt32BE(0xffffffff,8),b=>{b[12]^=1;}]){const b=Buffer.from(original);modify(b);const path=fresh();writeFileSync(join(path,'events.gz'),gzipSync(b));assert.equal((await verifyArchive(join(path,'events.gz'))).status,'ARCHIVE_INCOMPLETE');}
 const path=fresh();writeFileSync(join(path,'events.gz'),gzipSync(Buffer.concat([original,Buffer.from('x')])));assert.equal((await verifyArchive(join(path,'events.gz'))).status,'ARCHIVE_INCOMPLETE');
});
test('33 literal/encoded logical full-frame transcript and all sidecars exactly equal source',async()=>{
 const left=fresh(),right=fresh(),old=new OriginalArchive(left,originalBudget());await old.appendRpc('TEST',1,'control','request',Buffer.from(' {"x": -0, "fraction":"1208925819614629174706176/6"}\n'));
 const body=Buffer.from('0000000000000080','hex'),point=Buffer.from('0100000000000000','hex');await old.appendRecord('TEST',1,{fraction:'1208925819614629174706176/6',v:[-0,Number.MIN_VALUE,Number.MAX_VALUE]},body,point);await old.close();const next=new StreamArchive(right,retainedBudget());
 const source=await verifySourceArchive(join(left,'events.gz'),()=>{},null,async(parts,h)=>{if(h.channel!=='end')await next.replayFrame(parts,h);});await next.close();const recovered=await verifyArchive(join(right,'events.gz'));
 for(const key of ['entries','records','numericLeaves','rawBytes','decodedRecordSha256','binary64BeWordSha256','rawSha256','uncompressedFrameSha256','uncompressedFrameBytes'])assert.equal(recovered[key],source[key],key);
});
