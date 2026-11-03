// Root-only optional data inspection. Fixed ALIGNED2 input; no codec implementation.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,openSync,readSync,closeSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..'),[out]=process.argv.slice(2),start=performance.now();
assert.equal(process.argv.length,3,'measure-raw-string-repeats.mjs FRESH_OUT');
const LIMIT=2**21,MIN=24,REF=5,PINS='ca36d56d3c679e952cbba0306e623f6a688b51c5767eaf0793883393afc0f16e';
const hash=b=>createHash('sha256').update(b).digest('hex');
function pin(path){const h=createHash('sha256'),chunk=Buffer.alloc(65536),fd=openSync(path,'r');try{let n;while((n=readSync(fd,chunk,0,chunk.length,null)))h.update(chunk.subarray(0,n));}finally{closeSync(fd);}return {bytes:statSync(path).size,sha256:h.digest('hex')};}
const pinsPath=join(home,'PINS.json');assert.equal(pin(pinsPath).sha256,PINS);const pins=JSON.parse(readFileSync(pinsPath));
const inputs=[...Object.entries(pins.rpc).map(([name,p])=>({name,...p,compressed:false})),{name:'record',...pins.record.json,compressed:true}];
const rows=[],dictionary=new Map();let inputBytes=0,dictionaryBytes=0,occurrences=0,repeatBytes=0,references=0;
for(const input of inputs){
 assert.deepEqual(pin(resolve(root,input.path)),{bytes:input.bytes,sha256:input.sha256});
 assert.ok(input.bytes<=LIMIT);const stored=readFileSync(resolve(root,input.path));
 const bytes=input.compressed?gunzipSync(stored,{maxOutputLength:LIMIT}):stored;
 assert.ok(bytes.length<=LIMIT);if(input.name==='record')assert.equal(bytes.length,483481);
 inputBytes+=bytes.length;assert.ok(inputBytes<=LIMIT,'fixed one-case input byte bound');
 // Scan original UTF8 bytes. Quotes escaped by a backslash are consumed with that escape.
 // Every string includes its original quotes/escapes; no JSON numbers are parsed or reformatted.
 let strings=0,eligible=0;
 for(let i=0;i<bytes.length;i++){
  assert.ok(performance.now()-start<170000,'data-only170s');if(bytes[i]!==34)continue;
  const begin=i++;let closed=false;
  for(;i<bytes.length;i++){if(bytes[i]===92){i++;assert.ok(i<bytes.length,'unterminated escape');continue;}if(bytes[i]===34){closed=true;break;}assert.ok(bytes[i]>=32,'unescaped control');}
  assert.ok(closed,'unterminated quoted lexeme');strings++;const end=i+1,size=end-begin;if(size<MIN)continue;
  assert.ok(++occurrences<=65536,'bounded lexeme occurrences');eligible++;
  const span=bytes.subarray(begin,end),sha256=hash(span),bucket=dictionary.get(sha256)??[];
  let entry=bucket.find(x=>x.bytes.equals(span));
  if(!entry){assert.ok(dictionaryBytes+size<=LIMIT,'one-case unique dictionary2MiB');entry={id:rows.length,bytes:Buffer.from(span),sha256,source:{input:input.name,begin,end},occurrences:[]};bucket.push(entry);dictionary.set(sha256,bucket);rows.push(entry);dictionaryBytes+=size;}
  else{repeatBytes+=size;references++;}
  entry.occurrences.push({input:input.name,begin,end});
 }
 input.decodedBytes=bytes.length;input.decodedSha256=hash(bytes);input.stringLexemes=strings;input.eligibleLexemes=eligible;
}
assert.equal(pin(pinsPath).sha256,PINS);
for(const input of inputs)assert.deepEqual(pin(resolve(root,input.path)),{bytes:input.bytes,sha256:input.sha256});
const result={status:'FIXED_ALIGNED2_RAW_QUOTED_LEXEME_COUNTS',pinsSHA256:PINS,minimumQuotedLexemeBytes:MIN,includesKeysAndValues:true,comparison:'EXACT_ORIGINAL_QUOTED_UTF8_BYTES_INCLUDING_ESCAPES_NO_NUMERIC_REFORMAT',inputBytes,inputs,eligibleOccurrences:occurrences,uniqueDictionaryEntries:rows.length,uniqueDictionaryBytes:dictionaryBytes,globalDictionaryLimitBytes:LIMIT,repeatedOccurrences:references,repeatedLexemeBytes:repeatBytes,hypotheticalReferenceBytes:REF,hypotheticalReplacementBytes:references*REF,hypotheticalRawSavingsExcludingFormatAndDictionaryOverhead:repeatBytes-references*REF,rows:rows.map(({bytes,...row})=>row),notAnImplementedCodec:true,compressionCalls:0,recordGzipDecodeCalls:1,physicsCalls:0,compressedFitForecast:'NOT_CLAIMED',completeHeapRSS:'NOT_QUALIFIED',API:false};
const output=Buffer.from(JSON.stringify(result,null,2)+'\n');assert.ok(output.length<=LIMIT,'bounded diagnostic report2MiB');mkdirSync(out,{recursive:false});writeFileSync(join(out,'measurement.json'),output,{flag:'wx'});
console.log(JSON.stringify({status:result.status,output:join(out,'measurement.json'),bytes:output.length}));
