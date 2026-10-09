import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync,writeFileSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { observe,timingTrials,packOutputs,packInputs } from './campaign.mjs';
import { runControls } from './controls.mjs';
import { runControls as runReuseControls } from '../physics-capsule-reuse-reference/reuse-controls.mjs';
import { measureConstruction } from './construction.mjs';
import { encodeF64 } from '../physics-capsule-sweep-reference/binary.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const output=resolve(process.argv[2]??'/tmp/physics-distinct-first');
const metadata={gitHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceTreeDirty:!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),nodeVersion:process.version};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
let first=[],second=[],controls=null,reuseControls=null,timing=null,construction=null,unexpectedFailure=null;
try {
 controls=runControls();reuseControls=runReuseControls();first=observe();second=observe();
 if(first.length===9&&first.every(o=>o.passed&&o.snapshotRetained)&&controls.passed&&reuseControls.passed) timing=timingTrials();
 construction=measureConstruction();
} catch(error){unexpectedFailure=String(error.stack??error);}
const inputs=encodeF64(packInputs(first)),outputs=encodeF64(packOutputs(first)),repeatOutputs=encodeF64(packOutputs(second));
const exactRepeat=first.length===9&&hash(outputs)===hash(repeatOutputs)&&JSON.stringify(first)===JSON.stringify(second);
const numericalPassed=first.length===9&&first.every(o=>o.passed&&o.snapshotRetained)&&!unexpectedFailure;
const candidateGO=numericalPassed&&exactRepeat&&controls?.passed&&reuseControls?.passed&&timing?.passed;
mkdirSync(output,{recursive:true});
const files=[];
for(const [file,bytes]of[['inputs.f64.bin',inputs],['outputs.f64.bin',outputs]]){writeFileSync(resolve(output,file),bytes);files.push({file,type:'Float64Array',elements:bytes.length/8,bytes:bytes.length,sha256:hash(bytes)});}
const report={...metadata,first,second,controls,reuseControls,timing,construction,unexpectedFailure,exactRepeat,numericalPassed,candidateGO,
 decision:candidateGO?'Named distinct Node profiles pass; actual browser gate still required':'NO-GO for frozen distinct profiles; conditional browser not admitted',
 publicApi:false,actualViewer:false,browserExecuted:false,queryDoesNotMoveBody:true};
writeFileSync(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
writeFileSync(resolve(output,'manifest.json'),JSON.stringify({...metadata,format:'capsule-sweep-raw-v1',endianness:'little',files,totalRawBytes:inputs.length+outputs.length},null,2)+'\n');
console.log(JSON.stringify({...metadata,output,candidateGO,numericalPassed,exactRepeat,controlsPassed:controls?.passed,reuseControlsPassed:reuseControls?.passed,unexpectedFailure,
 first:first.map(o=>({name:o.name,passed:o.passed,error:o.error,referenceError:o.referenceError,checks:o.checks,errors:o.errors,hit:o.hit})),
 timing:timing?{passed:timing.passed,trials:timing.trials.map(t=>t.map(({samplesMs,...item})=>item)),medianAndSpread:timing.medianAndSpread}:null,rawBytes:inputs.length+outputs.length}));
if(unexpectedFailure)process.exitCode=1;
