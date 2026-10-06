import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { faceEvidenceRoot } from './face-evidence.mjs';

export function runFaceExchange() {
  const output=faceEvidenceRoot(),python=process.env.BAROCSS_CAD_PYTHON;assert.ok(python,'Installed independent interpreter is required');
  const manifest=JSON.parse(readFileSync(resolve(output,'manifest.json'),'utf8'));
  assert.equal(manifest.head,execFileSync('git',['rev-parse','HEAD'],{cwd:resolve(import.meta.dirname,'../../..'),encoding:'utf8'}).trim(),'Run current-head packed face consumer first');
  const run=mode=>spawnSync(python,[resolve(import.meta.dirname,'read-face-ocp.py'),output,...(mode?[mode]:[])],{encoding:'utf8',maxBuffer:8*1024*1024});
  const accepted=run();writeFileSync(resolve(output,'reader.stdout.txt'),accepted.stdout??'');writeFileSync(resolve(output,'reader.stderr.txt'),accepted.stderr??'');
  assert.equal(accepted.status,0,'Independent face consumer failed: '+(accepted.error?.message??'')+' '+accepted.stderr);
  const fixture=manifest.fixtures[0],surface=fixture.bundle.geometry.objects[0];
  const records=readFileSync(resolve(output,fixture.files.iges),'utf8').trimEnd().split('\n');
  const indices=records.map((line,i)=>line[72]==='P'&&Number(line.slice(64,72))===fixture.surfaceExport.directoryPointer?i:-1).filter(i=>i>=0);
  const tokens=indices.map(i=>records[i].slice(0,64)).join('').split(',');
  const poleIndex=10+surface.knotsU.length+surface.knotsV.length+surface.weights.flat().length;
  assert.equal(Number(tokens[poleIndex]),1,'Expected first flat surface X pole');assert.ok(tokens[poleIndex].includes('1.0'));
  tokens[poleIndex]=tokens[poleIndex].replace('1.0','2.0');const changed=tokens.join(',');
  indices.forEach((i,j)=>records[i]=changed.slice(j*64,(j+1)*64)+records[i].slice(64));writeFileSync(resolve(output,'corrupted.iges'),records.join('\n')+'\n');
  const negatives={};
  for(const mode of ['--wrong-graph','--reverse-pcurve','--missing-vertex','--corrupt-pole']) {
    const result=run(mode);writeFileSync(resolve(output,mode.slice(2)+'.txt'),(result.stdout??'')+'\n'+(result.stderr??''));
    assert.equal(result.status,1,'Wrong face graph unexpectedly accepted: '+mode);
    assert.match(result.stderr,/Face graph (geometry|derivative) comparison failed/,'Negative must reach graph/geometry association');negatives[mode.slice(2)]={status:result.status,reachedGraphGeometry:true};
  }
  const report=JSON.parse(readFileSync(resolve(output,'face-readback.json'),'utf8'));report.negativeControls=negatives;
  const bytes=JSON.stringify(report,null,2)+'\n';writeFileSync(resolve(output,'report.json'),bytes);writeFileSync(resolve(output,'report.sha256'),createHash('sha256').update(bytes).digest('hex')+'\n');
  console.log('Independent representative face checks passed; graph remains not-certified: '+JSON.stringify({head:report.head,fixtures:manifest.fixtures.length,negatives}));
}
