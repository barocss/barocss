// Fixed data-only replay. No fixture, engine, reference, Worker or child import.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,statSync,openSync,readSync,closeSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {StreamArchive,retainedBudget,verifyArchive} from './archive.mjs';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..'),[out,pinsSHA,remainingText,groupText]=process.argv.slice(2),started=performance.now(),deadline=Date.now()+Number(remainingText);
const hash=path=>{const h=createHash('sha256'),b=Buffer.alloc(65536),fd=openSync(path,'r');try{let n;while((n=readSync(fd,b,0,b.length,null)))h.update(b.subarray(0,n));}finally{closeSync(fd);}return h.digest('hex');};
assert.equal(hash(join(home,'PINS.json')),pinsSHA);const pins=JSON.parse(readFileSync(join(home,'PINS.json'))),fixed=pins.fixedArchive;
const input=resolve(root,fixed.path);assert.equal(statSync(input).size,206516742);assert.equal(hash(input),fixed.sha256);
const budget=retainedBudget({cap:81*2**20,used:256*1024,reserve:768*1024}),writer=new StreamArchive(out,budget);
let source=null,encoded=null,recovered=null,error=null,closed=false;
const timer=setTimeout(()=>{writeFileSync(join(out,'deadline.json'),JSON.stringify({status:'REPLAY_STOPPED',reason:'FIXED_REPLAY45S',reachedDiagnosticsUnavailableOnExternalTermination:true})+'\n',{flag:'wx'});process.exit(1);},Math.max(1,Math.floor(deadline-Date.now())));
function operands(){return {body:createHash('sha256'),rpc:createHash('sha256'),bodyBytes:0,rpcEntries:0};}
function consume(summary,entry){
 if(entry.header.channel==='record'){summary.body.update(entry.bodyRaw);summary.bodyBytes+=entry.bodyRaw.length;}
 if(entry.header.channel==='rpc'){summary.rpc.update(JSON.stringify(entry.header)+'\n');summary.rpc.update(entry.payload);summary.rpcEntries++;}
}
const before=operands(),after=operands();
try{
 source=await verifyArchive(input,e=>consume(before,e),fixed.sha256,async(parts,header)=>{assert.ok(Date.now()<deadline,'fixed replay45');if(header.channel!=='end')await writer.replayFrame(parts,header);},true);
 assert.equal(source.status,'ARCHIVE_VERIFIED');assert.equal(source.entries,10034);encoded=await writer.close();closed=true;
 assert.equal(encoded.entries,10034);assert.ok(encoded.compressedBytes<=80*2**20,'fixed80MiB compressed screen');assert.equal(encoded.uncompressedFrameSha256,source.uncompressedFrameSha256);assert.equal(encoded.uncompressedFrameBytes,source.uncompressedFrameBytes);
 recovered=await verifyArchive(join(out,'events.br'),e=>consume(after,e),encoded.compressedSha256);
 assert.equal(recovered.status,'ARCHIVE_VERIFIED');for(const key of ['entries','uncompressedFrameSha256','uncompressedFrameBytes','records','numericLeaves','rawBytes','decodedRecordSha256','binary64BeWordSha256','rawSha256'])assert.equal(recovered[key],source[key],key+' exact source/recovered transcript');
 assert.equal(after.bodyBytes,before.bodyBytes);assert.equal(after.rpcEntries,before.rpcEntries);assert.equal(after.body.digest('hex'),before.body.digest('hex'),'body-only exact digest');assert.equal(after.rpc.digest('hex'),before.rpc.digest('hex'),'all RPC bytes and semantic headers');assert.ok(Date.now()<deadline,'replay+recovery45');
}catch(e){const first=writer.failure??e;error={name:first.name,code:first.code??null,message:String(first.message).slice(0,1024)};}
finally{if(!closed)try{await writer.close();closed=true;}catch(e){error??={name:e.name,code:e.code??null,message:String(e.message).slice(0,1024)};closed=writer.closed&&writer.encoder.destroyed&&writer.sink.destroyed;}clearTimeout(timer);}
const cpu=process.cpuUsage(),result={protocol:'stack-brotli-stateful-replay-v1',pid:process.pid,ppid:process.ppid,expectedPgid:Number(groupText),status:error?'REPLAY_STOPPED':'DATA_REPLAY_RECOVERY_CONFIRMED',error,allOwnedStreamsClosed:closed,children:[],source,encoded,recovered,wallMsBeforeFinalReceipt:performance.now()-started,nodeSelfObservedCpuUs:{user:cpu.user,system:cpu.system},nodeSelfCpuIsNotAfterWaitAuthority:true,budget:{cap:budget.cap,used:budget.used,reserve:budget.reserve},codec:{quality:2,lgwin:20,chunkSize:65536},physicsCalls:0,API:false,full1200:false,strictGlobal64MiBCertification:'NOT_QUALIFIED',RSS:'NOT_QUALIFIED'};
const line=JSON.stringify(result)+'\n';assert.ok(Buffer.byteLength(line)<=16384);writeFileSync(join(out,'result.json'),line,{flag:'wx'});process.stdout.write(line);process.exitCode=error?1:0;
