import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync,spawnSync } from 'node:child_process';
import { readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { orthogonalEvidenceRoot } from './orthogonal-evidence.mjs';

export function runOrthogonalExchange() {
  const output=orthogonalEvidenceRoot(),python=process.env.BAROCSS_CAD_PYTHON;assert.ok(python,'Installed independent interpreter is required');
  const manifest=JSON.parse(readFileSync(resolve(output,'manifest.json'),'utf8'));
  assert.equal(manifest.head,execFileSync('git',['rev-parse','HEAD'],{cwd:resolve(import.meta.dirname,'../../..'),encoding:'utf8'}).trim(),'Run current-head packed orthogonal consumer first');
  const run=mode=>spawnSync(python,[resolve(import.meta.dirname,'read-orthogonal-ocp.py'),output,...(mode?[mode]:[])],{encoding:'utf8',maxBuffer:8*1024*1024});
  const accepted=run();writeFileSync(resolve(output,'reader.stdout.txt'),accepted.stdout??'');writeFileSync(resolve(output,'reader.stderr.txt'),accepted.stderr??'');
  assert.equal(accepted.status,0,'Independent orthogonal consumer failed: '+(accepted.error?.message??'')+' '+accepted.stderr);
  const negatives={};for(const mode of ['--wrong-owner','--wrong-sense','--wrong-edge','--wrong-vertex','--missing-use','--duplicate-use','--minute-point']) {
    const result=run(mode);writeFileSync(resolve(output,mode.slice(2)+'.txt'),(result.stdout??'')+'\n'+(result.stderr??''));
    assert.equal(result.status,1,'Wrong orthogonal graph unexpectedly accepted: '+mode);
    assert.match(result.stderr,/Orthogonal adjacency graph (geometry|derivative) comparison failed/,'Negative must reach qualified graph association after actual face readback');negatives[mode.slice(2)]={status:result.status,reachedQualifiedAssociation:true};
  }
  const report=JSON.parse(readFileSync(resolve(output,'orthogonal-readback.json'),'utf8'));report.negativeControls=negatives;
  const bytes=JSON.stringify(report,null,2)+'\n';writeFileSync(resolve(output,'report.json'),bytes);writeFileSync(resolve(output,'report.sha256'),createHash('sha256').update(bytes).digest('hex')+'\n');
  console.log('Independent additive orthogonal product exchange passed: '+JSON.stringify({head:report.head,pairs:12,faces:24,sharedQueries:228,boundaryQueries:1824,negatives}));
}
