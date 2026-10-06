import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {parameterEvidenceRoot} from './parameter-evidence.mjs';
export function runParameterExchange(){
  const output=parameterEvidenceRoot(),python=process.env.BAROCSS_CAD_PYTHON;assert.ok(python,'BAROCSS_CAD_PYTHON must name the installed independent consumer');
  const manifest=JSON.parse(readFileSync(resolve(output,'manifest.json'),'utf8')),head=execFileSync('git',['rev-parse','HEAD'],{cwd:resolve(import.meta.dirname,'../../..'),encoding:'utf8'}).trim();assert.equal(manifest.head,head,'Run actual packed parameter consumer on current HEAD first');
  const run=mode=>spawnSync(python,[resolve(import.meta.dirname,'read-parameters-ocp.py'),output,...(mode?[mode]:[])],{encoding:'utf8',maxBuffer:8*1024*1024});
  const accepted=run();writeFileSync(resolve(output,'reader.stdout.txt'),accepted.stdout??'');writeFileSync(resolve(output,'reader.stderr.txt'),accepted.stderr??'');assert.equal(accepted.status,0,'Independent parameter exchange failed: '+accepted.stderr);
  const negatives={};for(const mode of ['--wrong-scale','--swap-partials','--changed-source-parameter']){const result=run(mode);writeFileSync(resolve(output,mode.slice(2)+'.txt'),(result.stdout??'')+'\n'+(result.stderr??''));assert.equal(result.status,1);assert.match(result.stderr,/Parameter derivative comparison failed/);negatives[mode.slice(2)]={status:result.status,reachedActualDerivativeComparison:true};}
  const report=JSON.parse(readFileSync(resolve(output,'parameter-readback.json'),'utf8'));report.negativeControls=negatives;const bytes=JSON.stringify(report,null,2)+'\n';writeFileSync(resolve(output,'report.json'),bytes);writeFileSync(resolve(output,'report.sha256'),createHash('sha256').update(bytes).digest('hex')+'\n');
  console.log('Independent parameter source2 exchange passed: '+JSON.stringify({head,fixtures:4,samples:612,negativeControls:negatives}));
}
