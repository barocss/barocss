import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync,writeFileSync,readFileSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { observe,timingTrials,packOutputs,packInputs } from './campaign.mjs';
import { runControls } from './reuse-controls.mjs';
import { measureConstruction } from './construction.mjs';
import { encodeF64 } from '../physics-capsule-sweep-reference/binary.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),output=resolve(process.argv[2]??'/tmp/physics-reuse-first');
const metadata={gitHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceTreeDirty:!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),nodeVersion:process.version};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
let first=[],second=[],controls=null,timing=null,unexpectedFailure=null;
try{controls=runControls();first=observe();second=observe();if(first.filter(o=>!o.expectedError).every(o=>!o.error))timing=timingTrials();}
catch(error){unexpectedFailure=String(error.stack??error);}
const inputs=encodeF64(packInputs(first)),outputs=encodeF64(packOutputs(first)),repeatOutputs=encodeF64(packOutputs(second));
const exactRepeat=first.length===22 && first.length===second.length && hash(outputs)===hash(repeatOutputs) && JSON.stringify(first)===JSON.stringify(second);
const numericalPassed=first.length===22 && first.every(o=>o.passed && o.snapshotRetained)&&!unexpectedFailure;
const baselineFolder=resolve(root,'examples/physics-capsule-sweep-reference/evidence');
const baseline=JSON.parse(readFileSync(resolve(baselineFolder,'report.json'),'utf8'));
const exactBaselineInputs=hash(inputs)===hash(readFileSync(resolve(baselineFolder,'inputs.f64.bin')));
const exactBaselineOutputs=hash(outputs)===hash(readFileSync(resolve(baselineFolder,'outputs.f64.bin')))&&JSON.stringify(first)===JSON.stringify(baseline.first);
const construction=measureConstruction();
const candidateGO=numericalPassed&&exactRepeat&&exactBaselineInputs&&exactBaselineOutputs&&controls?.passed&&timing?.passed;
mkdirSync(output,{recursive:true});
const files=[];for(const [file,bytes]of[['inputs.f64.bin',inputs],['outputs.f64.bin',outputs]]){writeFileSync(resolve(output,file),bytes);files.push({file,type:'Float64Array',elements:bytes.length/8,bytes:bytes.length,sha256:hash(bytes)});}
const report={...metadata,first,second,controls,timing,construction,unexpectedFailure,exactRepeat,exactBaselineInputs,exactBaselineOutputs,numericalPassed,candidateGO,
 decision:candidateGO?'Bounded Node query reference candidate; actual Chromium numeric/cost gate still required':'NO-GO for the frozen query reference; no public implementation admitted',
 publicApi:false,actualViewer:false,browserExecuted:false,queryDoesNotMoveBody:true};
writeFileSync(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
writeFileSync(resolve(output,'manifest.json'),JSON.stringify({...metadata,format:'capsule-sweep-raw-v1',endianness:'little',files,totalRawBytes:inputs.length+outputs.length},null,2)+'\n');
console.log(JSON.stringify({...metadata,output,candidateGO,numericalPassed,exactRepeat,exactBaselineInputs,exactBaselineOutputs,unexpectedFailure,
 first:first.map(o=>({name:o.name,passed:o.passed,error:o.error,referenceError:o.referenceError,checks:o.checks,errors:o.errors,hit:o.hit})),timing,rawBytes:inputs.length+outputs.length}));
if(unexpectedFailure)process.exitCode=1;
