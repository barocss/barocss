import { writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { authenticateOriginalBank, iterateOriginalRows, authenticateOriginalAliases } from '../../bank-auth.mjs';
const target = new URL('./summary.json', import.meta.url);
const started = Date.now();
const summary = {kind:'P3_DATA_ONLY_BANK_AUTHENTICATION',runId:'bank-auth-04',status:'IN_PROGRESS',runtime:process.version,execPath:process.execPath,
  modelsRun:0,referencesRun:0,projectionsRun:0,rows:0,samples:[],firstFailure:null};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const f64 = value => {const bytes=Buffer.alloc(8);bytes.writeDoubleLE(value);return bytes.toString('hex');};
try {
  const bank = await authenticateOriginalBank();
  for await (const row of iterateOriginalRows(bank)) {
    summary.rows++;
    if ([1,76,77,197,1200].includes(row.stepIndex)) {
      const request=row.request, state=request.output.state;
      summary.samples.push({stepIndex:row.stepIndex,timeSeconds:state.timeSeconds,
        nativeKeys:Object.keys(row.nativeRecord),requestKeys:Object.keys(request),stateKeys:Object.keys(state),
        attemptKeys:Object.keys(request.attempt),frameKeys:Object.keys(request.attempt.frames),
        diagnosticsKeys:Object.keys(request.output.diagnostics),replyKeys:Object.keys(row.reply),
        locators:row.locators,rawPhases:Object.fromEntries(Object.entries(request.rawFrames).map(([name,hex])=>[name,{bytes:hex.length/2,sha256:hash(Buffer.from(hex,'hex'))}])),
        negativeZeroPaths:request.negativeZeroPaths,
        joints:state.joints.map(j=>({id:j.id,angleRad:j.angleRad,angleF64LE:f64(j.angleRad)}))});
    }
  }
  await authenticateOriginalAliases(bank);
  if(bank.provenance.fullDecodedAuthentication!=='PASS'||summary.rows!==1200)throw Error('full bank not authenticated');
  summary.status='PASS';summary.provenance=bank.provenance;
  summary.streams=Object.fromEntries(Object.entries(bank.entries).map(([name,entry])=>[name,{archiveBytes:entry.archiveBytes,archiveSha256:entry.archiveSha256,
    decodedBytes:entry.decompressedBytes,decodedSha256:entry.decompressedSha256,archiveAuthentication:'PASS',decodedAuthentication:'PASS'}]));
} catch(error) {summary.status='FAIL';summary.firstFailure={name:error.name,code:error.code??null,message:error.message,stack:error.stack};process.exitCode=1;}
summary.elapsedMs=Date.now()-started;
await writeFile(target,JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
const size=(await stat(target)).size;
console.log(JSON.stringify({status:summary.status,rows:summary.rows,elapsedMs:summary.elapsedMs,summaryBytes:size,firstFailure:summary.firstFailure}));
if(size>32*1024*1024)throw Error('fixed storage bound exceeded');
