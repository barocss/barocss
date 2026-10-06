import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync,spawnSync } from 'node:child_process';
import { readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { boxShellEvidenceRoot } from './box-shell-evidence.mjs';

export function runBoxShellExchange() {
  const output=boxShellEvidenceRoot(),python=process.env.BAROCSS_CAD_PYTHON;assert.ok(python,'Installed independent interpreter is required');
  const manifest=JSON.parse(readFileSync(resolve(output,'manifest.json'),'utf8'));
  assert.equal(manifest.head,execFileSync('git',['rev-parse','HEAD'],{cwd:resolve(import.meta.dirname,'../../..'),encoding:'utf8'}).trim(),'Run current-head packed box-shell consumer first');
  const run=mode=>spawnSync(python,[resolve(import.meta.dirname,'read-box-shell-ocp.py'),output,...(mode?[mode]:[])],{encoding:'utf8',maxBuffer:8*1024*1024});
  const accepted=run();writeFileSync(resolve(output,'reader.stdout.txt'),accepted.stdout??'');writeFileSync(resolve(output,'reader.stderr.txt'),accepted.stderr??'');
  assert.equal(accepted.status,0,'Independent box-shell consumer failed: '+(accepted.error?.message??'')+' '+accepted.stderr);
  const negatives={};for(const mode of ['--missing-face','--duplicate-face','--inward-face','--reversed-edge-use','--missing-use','--duplicate-use','--wrong-owner','--wrong-vertex','--minute-point','--near-face','--partial-face','--zero-side','--corrupt-pole']) {
    const result=run(mode);writeFileSync(resolve(output,mode.slice(2)+'.txt'),(result.stdout??'')+'\n'+(result.stderr??''));
    assert.equal(result.status,1,'Wrong box shell unexpectedly accepted: '+mode);
    assert.match(result.stderr,/Axis box shell graph (geometry|derivative) comparison failed/,'Negative must reach independent global association or actual geometry');negatives[mode.slice(2)]={status:result.status,reachedAssociationOrGeometry:true};
  }
  const report=JSON.parse(readFileSync(resolve(output,'box-shell-readback.json'),'utf8'));report.negativeControls=negatives;
  const bytes=JSON.stringify(report,null,2)+'\n';writeFileSync(resolve(output,'report.json'),bytes);writeFileSync(resolve(output,'report.sha256'),createHash('sha256').update(bytes).digest('hex')+'\n');
  console.log('Independent original box-shell exchange passed: '+JSON.stringify({head:report.head,boxes:4,faces:24,commonQueries:912,boundaryQueries:1824,solidProductImplemented:false,negatives}));
}
