import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync,spawnSync } from 'node:child_process';
import { readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { adjacencyEvidenceRoot } from './adjacency-evidence.mjs';

export function runAdjacencyExchange() {
  const output=adjacencyEvidenceRoot(),python=process.env.BAROCSS_CAD_PYTHON;assert.ok(python,'Installed independent interpreter is required');
  const manifest=JSON.parse(readFileSync(resolve(output,'manifest.json'),'utf8'));
  assert.equal(manifest.head,execFileSync('git',['rev-parse','HEAD'],{cwd:resolve(import.meta.dirname,'../../..'),encoding:'utf8'}).trim(),'Run packed adjacency consumer on current HEAD first');
  const run=mode=>spawnSync(python,[resolve(import.meta.dirname,'read-adjacency-ocp.py'),output,...(mode?[mode]:[])],{encoding:'utf8',maxBuffer:8*1024*1024});
  const accepted=run();writeFileSync(resolve(output,'reader.stdout.txt'),accepted.stdout??'');writeFileSync(resolve(output,'reader.stderr.txt'),accepted.stderr??'');
  assert.equal(accepted.status,0,'Independent adjacency consumer failed: '+(accepted.error?.message??'')+' '+accepted.stderr);
  const negatives={};for(const mode of ['--wrong-owner','--wrong-sense','--wrong-global-point','--wrong-curve']) {
    const result=run(mode);writeFileSync(resolve(output,mode.slice(2)+'.txt'),(result.stdout??'')+'\n'+(result.stderr??''));
    assert.equal(result.status,1,'Wrong global adjacency unexpectedly accepted: '+mode);
    assert.match(result.stderr,/Adjacency graph (geometry|derivative) comparison failed/,'Negative must reach independent qualified graph association');negatives[mode.slice(2)]={status:result.status,reachedQualifiedAssociation:true};
  }
  const report=JSON.parse(readFileSync(resolve(output,'adjacency-readback.json'),'utf8'));report.negativeControls=negatives;
  const bytes=JSON.stringify(report,null,2)+'\n';writeFileSync(resolve(output,'report.json'),bytes);writeFileSync(resolve(output,'report.sha256'),createHash('sha256').update(bytes).digest('hex')+'\n');
  console.log('Independent adjacency association passed; separate unsewn face exports: '+JSON.stringify({head:report.head,pairs:manifest.fixtures.length,negatives}));
}
