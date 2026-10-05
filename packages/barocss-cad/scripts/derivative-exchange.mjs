import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { derivativeEvidenceRoot } from './derivative-evidence.mjs';

export function runDerivativeExchange() {
  const output=derivativeEvidenceRoot(), python=process.env.BAROCSS_CAD_PYTHON;
  assert.ok(python,'BAROCSS_CAD_PYTHON must name the installed interpreter');
  const manifest=JSON.parse(readFileSync(resolve(output,'manifest.json'),'utf8'));
  const head=execFileSync('git',['rev-parse','HEAD'],{cwd:resolve(import.meta.dirname,'../../..'),encoding:'utf8'}).trim();
  assert.equal(manifest.head,head,'Run packed derivative consumer on current HEAD first');
  const run=mode=>spawnSync(python,[resolve(import.meta.dirname,'read-derivatives-ocp.py'),output,...(mode?[mode]:[])],{encoding:'utf8',maxBuffer:8*1024*1024});
  const accepted=run();
  writeFileSync(resolve(output,'reader.stdout.txt'),accepted.stdout ?? '');writeFileSync(resolve(output,'reader.stderr.txt'),accepted.stderr ?? '');
  assert.equal(accepted.status,0,'Independent derivative consumer failed: '+(accepted.error?.message ?? '')+' '+accepted.stderr);
  const negatives={};
  for(const mode of ['--wrong-scale','--swap-partials','--negate-curve']) {
    const result=run(mode);writeFileSync(resolve(output,mode.slice(2)+'.txt'),(result.stdout ?? '')+'\n'+(result.stderr ?? ''));
    assert.equal(result.status,1,'Wrong derivatives unexpectedly accepted: '+mode);
    assert.match(result.stderr,/Derivative comparison failed/,'Negative control must reach derivative vector comparison');
    negatives[mode.slice(2)]={status:result.status,reachedDerivativeComparison:true};
  }
  const report=JSON.parse(readFileSync(resolve(output,'derivatives-readback.json'),'utf8'));
  report.negativeControls=negatives;
  const bytes=JSON.stringify(report,null,2)+'\n';
  writeFileSync(resolve(output,'report.json'),bytes);writeFileSync(resolve(output,'report.sha256'),createHash('sha256').update(bytes).digest('hex')+'\n');
  console.log('Independent derivative exchange passed: '+JSON.stringify({head:report.head,fixtures:report.fixtures.map(f=>({name:f.name,samples:f.sampleCount,maxDerivativeScaledDeviation:f.maxDerivativeScaledDeviation,maxPointDeviationMM:f.maxPointDeviationMM})),negativeControls:negatives}));
}
