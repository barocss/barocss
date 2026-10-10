import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { bundle, here, root, verifyFreeze } from './bundle.mjs';
import { runReferenceControls } from './reference-controls.mjs';
const out=resolve(process.argv[2]??resolve(here,'evidence/native'));
await mkdir(out,{recursive:true});
class NumericalNoGo extends Error { constructor(caseName, reply) { super(caseName+': '+JSON.stringify(reply.violations)); this.caseName=caseName; this.reply=reply; } }
const reports=[], graphs=[];let pending=null, stderr='',oracle;
const save=async(name,value)=>writeFile(resolve(out,name),JSON.stringify(value,null,2)+'\n');
try {
  await verifyFreeze();
  const emitted=[];
  for(const path of execFileSync('rg',['--files','packages/barocss-physics/dist','packages/barocss-cad/dist'],{cwd:root,encoding:'utf8'}).trim().split('\n').sort())emitted.push({path,sha256:createHash('sha256').update(await readFile(resolve(root,path))).digest('hex')});
  await save('emitted-freeze.json',{node:process.version,emitted,preTrial:true});
  oracle=spawn('python3',[resolve(here,'reference.py')],{stdio:['pipe','pipe','pipe']});
  oracle.stderr.on('data',d=>stderr+=d);oracle.on('error',e=>pending?.reject(e));oracle.on('exit',code=>pending?.reject(new Error('Oracle exit '+code+': '+stderr)));
  createInterface({input:oracle.stdout}).on('line',line=>{const p=pending;pending=null;if(!p)throw new Error('Unsolicited oracle result');try{p.resolve(JSON.parse(line));}catch(e){p.reject(e);}});
  const ask=input=>new Promise((resolve,reject)=>{assert.equal(pending,null);pending={resolve,reject};oracle.stdin.write(JSON.stringify(input)+'\n');});
  const oracleControls=await runReferenceControls(ask);await save('oracle-controls.json',oracleControls);
  for(const graph of ['source','source-repeat','compiled-dependencies']) {
    const built=await bundle(graph,out);graphs.push(built.audit);
    const output=execFileSync(process.execPath,[built.path],{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024});
    await writeFile(resolve(out,graph+'-stdout.json'),output);
    const report=JSON.parse(output),raw=Buffer.from(report.rawHex,'hex');
    await writeFile(resolve(out,graph+'.f64.bin'),raw);report.rawSha256=createHash('sha256').update(raw).digest('hex');report.oracle=[];
    for(const row of report.flow.candidates) {
      const reply=await ask({...row.input,evaluateCandidate:true,hit:row.hit,result:row.result});
      report.oracle.push({name:row.name,reply});await save(graph+'-report.json',report);
      if (!reply.ok || !reply.resolved) throw new NumericalNoGo(row.name,reply);
    }
    reports.push(report);await save(graph+'-report.json',report);
    console.log(JSON.stringify({graph,privateCases:report.flow.candidates.length,errorCopyReceipts:report.flow.receipts.length,rawSha256:report.rawSha256,audit:built.audit}));
  }
  for(const report of reports.slice(1)) { assert.equal(report.rawHex,reports[0].rawHex);assert.deepEqual(report.flow,reports[0].flow);assert.deepEqual(report.oracle,reports[0].oracle); }
  await save('summary.json',{verdict:'GO',privateSelectedFaceGO:true,sourceRepeatCompiledParity:true,fullWorldCCDGO:false,rigidAngularResponseMeasured:false,contactFrictionMeasured:false,physicsWorldCreated:false,physicsWorldStepped:false,node:process.version,measuredHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),graphs,rawSha256:reports[0].rawSha256,oracleControls:oracleControls.length,firstFailure:null,stderr});
} catch(error) {
  await save('summary.json',{verdict:error instanceof NumericalNoGo?'NUMERICAL_NO_GO':'EXECUTION_FAILURE',privateSelectedFaceGO:false,failureClass:error instanceof NumericalNoGo?'independent-numerical-gate':'harness-or-control',numericalReply:error instanceof NumericalNoGo?error.reply:null,firstFailure:{name:error.name,message:error.message,stack:error.stack},graphs,completedGraphs:reports.length,fullWorldCCDGO:false,node:process.version,stderr});
  throw error;
} finally {oracle?.stdin.end();}
