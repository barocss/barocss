// Fixed byte-population measurement. No compressor or physical calculation.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {resolve,join} from 'node:path';
const [output]=process.argv.slice(2);assert.equal(process.argv.length,3);
const root=process.cwd(),home=join(root,'examples/physics-stack-evidence-refs-2276');
const input=JSON.parse(readFileSync(join(home,'evidence/raw-strings-01/measurement.json')));
const hash=b=>createHash('sha256').update(b).digest('hex'),sources=new Map();let total=0;
for(const item of input.inputs){
 const stored=readFileSync(resolve(root,item.path));assert.equal(hash(stored),item.sha256);
 const bytes=item.compressed?gunzipSync(stored,{maxOutputLength:2**21}):stored;
 assert.equal(hash(bytes),item.decodedSha256);total+=bytes.length;assert.ok(total<=2**21);sources.set(item.name,bytes);
}
const values=input.rows.map(row=>{
 const value=sources.get(row.source.input).subarray(row.source.begin,row.source.end);
 assert.equal(hash(value),row.sha256);return {value,id:row.id,occurrences:row.occurrences};
});
const prefix=(a,b)=>{let n=0;while(n<Math.min(a.length,b.length)&&a[n]===b[n])n++;return n;};
const sorted=[...values].sort((a,b)=>Buffer.compare(a.value,b.value));
let before=Buffer.alloc(0),globalBytes=0;const globalRows=[];
for(const item of sorted){const common=prefix(before,item.value);globalBytes+=8+item.value.length-common;globalRows.push({id:item.id,sharedPrefixBytes:common,suffixBytes:item.value.length-common});before=item.value;}
const seen=new Set(),frames=[];let incrementalBytes=0;
for(const item of input.inputs){
 const fresh=values.filter(row=>!seen.has(row.id)&&row.occurrences.some(x=>x.input===item.name)).sort((a,b)=>Buffer.compare(a.value,b.value));
 let previous=Buffer.alloc(0),bytes=0;
 for(const row of fresh){const common=prefix(previous,row.value);bytes+=8+row.value.length-common;previous=row.value;seen.add(row.id);}
 incrementalBytes+=bytes;frames.push({input:item.name,newEntries:fresh.length,frontDictionaryBytes:bytes});
}
assert.equal(seen.size,input.uniqueDictionaryEntries);
const covered=input.uniqueDictionaryBytes+input.repeatedLexemeBytes;
const result={status:'PASS_FIXED_FRONT_DICTIONARY_BYTE_MEASUREMENT',sourceInputBytes:total,
 quotedBytesCovered:covered,uniqueEntries:values.length,uniqueRawDictionaryBytes:input.uniqueDictionaryBytes,
 globallySortedFrontDictionaryBytes:globalBytes,incrementalPerFrameSortedDictionaryBytes:incrementalBytes,
 referenceBytesAtFivePerOccurrence:5*input.eligibleOccurrences,
 hypotheticalRawBytesWithIncrementalDictionary:total-covered+incrementalBytes+5*input.eligibleOccurrences,
 ordering:'CAPTURED_DIAGNOSTIC_INPUT_ORDER_NOT_LIVE_ARRIVAL_ORDER',frames,globalRows,
 overheadExcludesFrameProgramAndBoundsMetadata:true,compressionCalls:0,physicsCalls:0,
 implementedCodec:false,compressedFitForecast:'NOT_CLAIMED',API:false};
const bytes=Buffer.from(JSON.stringify(result,null,2)+'\n');assert.ok(bytes.length<=2**21);
mkdirSync(output);writeFileSync(join(output,'measurement.json'),bytes,{flag:'wx'});
console.log(JSON.stringify({...result,globalRows:undefined,frames:undefined}));
