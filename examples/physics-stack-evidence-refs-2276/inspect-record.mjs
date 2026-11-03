// Fixed captured-data byte census only. No engine, reference or new codec import.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,statSync,openSync,readSync,closeSync} from 'node:fs';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..'),[out,pinsSHA]=process.argv.slice(2),start=performance.now();
assert.equal(process.argv.length,4,'inspect-record.mjs FRESH_OUT REVIEWED_PINS_SHA');
const M=2**20,LIMIT=2*M,SCRATCH=16*M,descriptorBytes=64,literalHeaderBytes=8,programHeaderBytes=16;
const hash=b=>createHash('sha256').update(b).digest('hex');
function pin(path){const h=createHash('sha256'),buffer=Buffer.alloc(65536),fd=openSync(path,'r');try{let n;while((n=readSync(fd,buffer,0,buffer.length,null)))h.update(buffer.subarray(0,n));}finally{closeSync(fd);}return {bytes:statSync(path).size,sha256:h.digest('hex')};}
const pinsPath=join(home,'PINS.json');assert.equal(pin(pinsPath).sha256,pinsSHA);const pins=JSON.parse(readFileSync(pinsPath));
function authenticate(){assert.equal(pin(pinsPath).sha256,pinsSHA);for(const [path,p]of Object.entries(pins.files))assert.deepEqual(pin(resolve(root,path)),p,path);}
authenticate();mkdirSync(out,{recursive:false});
const fixed=[
 ['contactGeometry','contacts','reply',''],['positionCheck','world','reply',''],['ledgerCheck','step-ledger','reply',''],['quality','quality','reply',''],
 ['prepared.diagnostics.positionAttempt.problem','world','request','problem'],['prepared.diagnostics.positionAttempt.rowSources','world','request','rowSelections'],
 ['prepared.diagnostics.positionAttempt.result','world','request','result'],['prepared.diagnostics.positionAttempt.preBodies','world','request','preBodies'],['prepared.diagnostics.positionAttempt.hypotheticalBodies','world','request','hypBodies'],
 ['prepared.diagnostics.beforeBodies','step-ledger','request','ledger.beforeBodies'],['prepared.diagnostics.freeBodies','step-ledger','request','ledger.freeBodies'],['prepared.diagnostics.velocityBodies','step-ledger','request','ledger.velocityBodies'],
 ['prepared.candidateBodies','step-ledger','request','ledger.finalBodies'],['prepared.diagnostics.pointLedger','step-ledger','request','ledger.points'],['before.bodies','step-ledger','request','ledger.beforeBodies'],['after','quality','request','request.state']
];
const wanted=new Set(fixed.map(x=>x[0])),spans=new Map();let numericLeaves=0;
function walk(value,path='',at=0,depth=0,count=false,visits={n:0}){
 assert.ok(depth<=64&&++visits.n<=262144);if(count&&typeof value==='number')numericLeaves++;const begin=at;
 if(value===null||typeof value!=='object'){assert.ok(value===null||['string','boolean','number'].includes(typeof value));if(typeof value==='number')assert.ok(Number.isFinite(value));at+=Buffer.byteLength(JSON.stringify(value));}
 else{const keys=Object.keys(value),array=Array.isArray(value);at++;for(let i=0;i<keys.length;i++){if(i)at++;const key=keys[i];if(!array)at+=Buffer.byteLength(JSON.stringify(key))+1;at=walk(value[key],path?path+'.'+key:key,at,depth+1,count,visits);}at++;}
 if(count&&wanted.has(path))spans.set(path,{begin,end:at});assert.ok(at<=LIMIT,'2MiB canonical JSON bound');assert.ok(performance.now()-start<170000,'data-only170s deadline');return at;
}
const maxRawWireBytes=Math.max(...Object.values(pins.rpc).map(p=>p.bytes)),rawDictionaryBytes=Object.values(pins.rpc).reduce((n,p)=>n+p.bytes,0);assert.ok(rawDictionaryBytes<=LIMIT,'captured raw dictionary2MiB admission before reads');
const recordBytes=gunzipSync(readFileSync(resolve(root,pins.record.json.path)),{maxOutputLength:LIMIT}),bodyRaw=gunzipSync(readFileSync(resolve(root,pins.record.raw.path)),{maxOutputLength:LIMIT});assert.equal(recordBytes.length,483481);assert.equal(bodyRaw.length,3744);
// Conservative analysis-buffer bound, before constructing canonical projection buffers.
const analysisBufferBound=rawDictionaryBytes+7*recordBytes.length+LIMIT+bodyRaw.length+M;assert.ok(analysisBufferBound<=SCRATCH);
const record=JSON.parse(recordBytes),recordNative=Buffer.from(JSON.stringify(record)+'\n');assert.deepEqual(recordNative,recordBytes,'original whole record NativeJSON bytes');assert.equal(walk(record,'',0,0,true)+1,recordBytes.length);assert.equal(numericLeaves,8842);
const raw=new Map(),views=new Map();for(const [key,p]of Object.entries(pins.rpc)){const b=readFileSync(resolve(root,p.path));assert.equal(b.length,p.bytes);raw.set(key,b);views.set(key,JSON.parse(b));}
const get=(v,path)=>path?path.split('.').reduce((x,k)=>{assert.ok(x&&Object.hasOwn(x,k),path);return x[k];},v):v;
const unique=new Map(),rows=[];let uniqueProjectionBytes=0,maxProjectionBytes=0;
for(const [target,op,kind,sourcePath]of fixed){
 const span=spans.get(target);assert.ok(span,target);const key=op+':'+kind,value=get(views.get(key),sourcePath),size=walk(value);assert.ok(size+1<=LIMIT);assert.ok(size<=recordBytes.length,'fixed projection must fit captured record');
 const projection=Buffer.from(JSON.stringify(value));assert.equal(projection.length,size);const actual=recordBytes.subarray(span.begin,span.end);assert.deepEqual(projection,actual,target+' exact original target span');
 const sha=hash(projection),prior=unique.get(sha);if(prior)assert.deepEqual(prior,projection,'no digest-only deduplication');else{assert.ok(uniqueProjectionBytes+size<=LIMIT,'selected unique projection2MiB bound');unique.set(sha,projection);uniqueProjectionBytes+=size;}
 maxProjectionBytes=Math.max(maxProjectionBytes,size);const rawOffset=raw.get(key).indexOf(projection);
 rows.push({target,source:{op,kind,path:sourcePath||'$'},begin:span.begin,end:span.end,bytes:size,canonicalSha256:sha,canonicalProjectionMatchesTarget:true,firstExactRawOccurrenceOffset:rawOffset,rawByteSpanAvailable:rawOffset>=0,canonicalProjectionIsNotRawWire:rawOffset<0});
}
function covered(selected){const sorted=[...selected].sort((a,b)=>a.begin-b.begin||b.end-a.end);let end=-1,total=0;for(const row of sorted){if(row.end<=end)continue;total+=row.end-Math.max(row.begin,end);end=row.end;}return total;}
const selected=[...rows].sort((a,b)=>a.begin-b.begin||b.end-a.end),disjoint=[];let last=-1;for(const row of selected){if(row.end<=last)continue;assert.ok(row.begin>=last,'fixed targets must be disjoint');disjoint.push(row);last=row.end;}
const duplicatedBytes=covered(rows),rawExactTargetBytes=covered(rows.filter(r=>r.rawByteSpanAvailable)),references=disjoint.length,overhead=descriptorBytes*references+literalHeaderBytes*(references+1)+programHeaderBytes,referenceJSONBytes=recordBytes.length-duplicatedBytes+overhead;
assert.equal(record.pointOperandF64leHex.length,3072);assert.match(record.pointOperandF64leHex,/^[0-9a-f]+$/);
const J=recordBytes.length,W=numericLeaves*8,R=bodyRaw.length+(record.pointOperandF64leHex.length/2),Q=8*M,base=Q+4*J+2*W+2*R+16+M,projectionStaging=3*maxProjectionBytes;
function alternative(oneStepBytes){const threeCapturedCopies=3*oneStepBytes;return {oneCapturedStepBytes:oneStepBytes,threeIdenticalCapturedStepsBytes:threeCapturedCopies,globalDictionaryLimitBytes:LIMIT,capturedThreeCopyDictionaryFits:threeCapturedCopies<=LIMIT,combinedScratchBytes:base+threeCapturedCopies+projectionStaging+3*maxRawWireBytes,combinedScratchLimitBytes:SCRATCH,capturedCombinedScratchFits:base+threeCapturedCopies+projectionStaging+3*maxRawWireBytes<=SCRATCH,notAUniversalTrajectoryBound:true};}
authenticate();
const result={status:'FIXED_ALIGNED2_BYTE_MEASUREMENT_COMPLETE',case:'ALIGNED:2',recordJSONBytes:J,numericLeaves,wordSidecarBytes:W,bodyRawBytes:bodyRaw.length,pointRawBytes:R-bodyRaw.length,rpcRawBytes:rawDictionaryBytes,rows,disjointTargetUnionBytes:duplicatedBytes,exactRawSpanTargetUnionBytes:rawExactTargetBytes,canonicalProjectionOnlyTargetBytes:duplicatedBytes-rawExactTargetBytes,uniqueCanonicalProjectionBytes:uniqueProjectionBytes,uniqueProjectionBuffers:unique.size,projectionDedupPolicy:'IDENTICAL_COMPLETE_BUFFERS_ONLY_NO_SUBSTRING_PACKING',maxProjectionBytes,maxRawWireBytes,descriptorModel:{bytesPerReference:descriptorBytes,bytesPerLiteralRun:literalHeaderBytes,programHeaderBytes,references,overheadBytes:overhead,notAnImplementedFormat:true},hypotheticalReferenceJSONBytes:referenceJSONBytes,hypotheticalJSONByteReduction:J-referenceJSONBytes,rawAllEightAlternative:alternative(rawDictionaryBytes),selectedCanonicalProjectionAlternative:alternative(uniqueProjectionBytes),scratchModel:{pendingAllowanceBytes:Q,existingRecordScratchBytes:base,additionalProjectionStagingBytes:projectionStaging,additionalRawWireStagingBytes:3*maxRawWireBytes,analysisExplicitBufferBoundBytes:analysisBufferBound,JSObjectGCNativeHeap:'NOT_QUALIFIED'},rawRPCAlwaysPersistedFirst:true,canonicalProjectionIsNotRawWire:true,recordWordsAndRawStayLiteral:true,compressed80MiBScreen:'NOT_DETERMINED_BY_BYTE_COUNTS',newCompressionCalls:0,inputGzipDecompressions:2,physicsCalls:0,API:false,full1200:false,strictGlobal64MiBCertification:'NOT_QUALIFIED',elapsedMsBeforeFinalWrite:performance.now()-start};
const output=Buffer.from(JSON.stringify(result,null,2)+'\n');assert.ok(output.length<=128*1024);writeFileSync(join(out,'measurement.json'),output,{flag:'wx'});console.log(JSON.stringify({status:result.status,output:join(out,'measurement.json'),bytes:output.length}));
