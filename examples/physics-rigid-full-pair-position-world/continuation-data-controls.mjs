/** DATA-ONLY storage controls. No World/kernel/query/reference modules imported. */
import assert from 'node:assert/strict';
import {mkdtemp,readFile,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createContinuationRecorder} from './continuation-archive.mjs';
const out=await mkdtemp(join(tmpdir(),'physics-1399-storage-data-')),budget={bytes:0};
const records=[{id:'data-0',nested:{value:1,marker:'α'}},{id:'data-1',nested:{value:2}}],raw=[Buffer.from([0,1,2,255]),Buffer.from([9,8,7])];
const source=await createContinuationRecorder(out,'source-DATA',budget,{mode:'source'});
for(let i=0;i<2;i++)await source.write(records[i],[raw[i]]);const original=await source.finish();const afterSource=budget.bytes;
const parity=await createContinuationRecorder(out,'compiled-DATA',budget,{mode:'parity',canonicalName:'source-DATA',canonicalEvidence:original});
for(let i=0;i<2;i++)await parity.write(records[i],[raw[i]]);const mirrored=await parity.finish();
for(const key of ['records','rawBytes','rawSha256','decodedRecordSha256'])assert.equal(mirrored[key],original[key]);
assert.ok((await readFile(out+'/source-DATA.jsonl.gz')).equals(await readFile(out+'/compiled-DATA.jsonl.gz')));assert.equal((await stat(out+'/source-DATA.jsonl.gz')).ino,(await stat(out+'/compiled-DATA.jsonl.gz')).ino);
const prefix=await createContinuationRecorder(out,'source-PREFIX',budget,{mode:'source',originalPrefix:{jsonPath:out+'/source-DATA.jsonl.gz',rawPath:out+'/source-DATA.f64le.gz',records:2}});
for(let i=0;i<2;i++)await prefix.write(records[i],[raw[i]]);await prefix.write({id:'data-2'},[Buffer.from([5])]);const extended=await prefix.finish();assert.equal(extended.records,3);
for(const kind of ['record','raw','missing','extra']){
 const writer=await createContinuationRecorder(out,'bad-'+kind,budget,{mode:'parity',canonicalName:'source-DATA',canonicalEvidence:original});
 let refused=false;try{
  if(kind==='record')await writer.write({id:'wrong'},[raw[0]]);
  else if(kind==='raw')await writer.write(records[0],[Buffer.from([0,1,3,255])]);
  else{await writer.write(records[0],[raw[0]]);if(kind==='missing')await writer.finish();else{await writer.write(records[1],[raw[1]]);await writer.write({id:'extra'},[]);}}
 }catch{refused=true;}assert.equal(refused,true,kind);
}
for(const kind of ['crlf','no-lf']){
 const bytes=gunzipSync(await readFile(out+'/source-DATA.jsonl.gz'));
 const altered=kind==='crlf'?Buffer.from(bytes.toString().replaceAll('\n','\r\n')):bytes.subarray(0,bytes.length-1);
 await writeFile(out+'/'+kind+'.jsonl.gz',gzipSync(altered));await writeFile(out+'/'+kind+'.f64le.gz',await readFile(out+'/source-DATA.f64le.gz'));
 const writer=await createContinuationRecorder(out,'bad-'+kind,budget,{mode:'parity',canonicalName:kind,canonicalEvidence:original});let refused=false;
 try{for(let i=0;i<2;i++)await writer.write(records[i],[raw[i]]);await writer.finish();}catch{refused=true;}assert.equal(refused,true,kind);
}
const wrongMetrics=await createContinuationRecorder(out,'bad-metrics',budget,{mode:'parity',canonicalName:'source-DATA',canonicalEvidence:{...original,rawBytes:original.rawBytes+1}});
for(let i=0;i<2;i++)await wrongMetrics.write(records[i],[raw[i]]);await assert.rejects(()=>wrongMetrics.finish());await assert.rejects(()=>stat(out+'/bad-metrics.jsonl.gz'));
await assert.rejects(()=>createContinuationRecorder(out,'source-DATA',budget,{mode:'source'}));
console.log(JSON.stringify({dataOnly:true,modelCalls:0,sourceRecords:original.records,parityRecords:mirrored.records,extendedPrefixRecords:extended.records,refusals:8,afterSourceStoredBytes:afterSource,storedBytes:budget.bytes,parity:mirrored,output:out}));
