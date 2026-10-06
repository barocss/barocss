import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {xyProfileEvidenceRoot} from './profile-evidence.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function runXYProfileExchange(){
  const output=xyProfileEvidenceRoot(),python=process.env.BAROCSS_CAD_PYTHON;assert.ok(python,'BAROCSS_CAD_PYTHON must name the installed independent reader');
  const manifest=JSON.parse(readFileSync(resolve(output,'manifest.json'),'utf8')),head=execFileSync('git',['rev-parse','HEAD'],{cwd:resolve(import.meta.dirname,'../../..'),encoding:'utf8'}).trim();assert.equal(manifest.head,head,'Run actual packed XY profile consumer on current HEAD first');
  const first=manifest.fixtures[0],original=readFileSync(resolve(output,first.files.iges),'utf8');assert.equal(hash(original),first.hashes.iges);
  const lines=original.trimEnd().split('\n');assert.ok(lines.every(line=>line.length===80));
  const d=lines.findIndex(line=>line[72]==='D'),bad=lines.slice();bad[d]=bad[d].slice(0,8)+' 9999999'+bad[d].slice(16);
  const changed=lines.slice(),pindices=lines.flatMap((line,i)=>line[72]==='P'?[i]:[]),body=pindices.map(i=>lines[i].slice(0,64)).join('');
  const tokens=[...body.matchAll(/[^,;]+/g)],pole=tokens[13];assert.equal(pole[0].trim(),'0.0');const offset=pole.index+pole[0].indexOf('0.0');
  const mutated=body.slice(0,offset)+'1.0'+body.slice(offset+3);assert.equal(mutated.length,body.length);
  pindices.forEach((index,i)=>{changed[index]=mutated.slice(i*64,(i+1)*64)+lines[index].slice(64);});
  const controls={};for(const [name,records]of [['bad-pointer',bad],['changed-pole',changed]]){assert.ok(records.every(line=>line.length===80));const bytes=records.join('\n')+'\n',file=name+'.iges';writeFileSync(resolve(output,file),bytes);controls[name]={file,sha256:hash(bytes),originalSHA256:first.hashes.iges,change:name==='bad-pointer'?'directory parameter pointer 1 -> 9999999':'first pole X 0.0 -> 1.0; record widths, pointers, flags retained'};}
  writeFileSync(resolve(output,'negative-files.json'),JSON.stringify(controls,null,2)+'\n');
  const run=mode=>spawnSync(python,[resolve(import.meta.dirname,'read-xy-profile-ocp.py'),output,...(mode?[mode]:[])],{encoding:'utf8',maxBuffer:8*1024*1024});
  const positive=run();writeFileSync(resolve(output,'reader.stdout.txt'),positive.stdout??'');writeFileSync(resolve(output,'reader.stderr.txt'),positive.stderr??'');assert.equal(positive.status,0,'Independent XY profile readback failed: '+positive.stderr);
  for(const name of Object.keys(controls)){const result=run('--'+name);writeFileSync(resolve(output,name+'.stdout.txt'),result.stdout??'');writeFileSync(resolve(output,name+'.stderr.txt'),result.stderr??'');assert.equal(result.status,1);assert.match(result.stderr,name==='bad-pointer'?/XY profile load comparison failed/:/XY profile geometry comparison failed/);controls[name].exitCode=result.status;controls[name].expectedStage=name==='bad-pointer'?'load-pointer':'geometry';controls[name].observed=JSON.parse(readFileSync(resolve(output,name+'-observed.json'),'utf8'));}
  const report=JSON.parse(readFileSync(resolve(output,'xy-profile-readback.json'),'utf8'));report.negativeControls=controls;const bytes=JSON.stringify(report,null,2)+'\n';writeFileSync(resolve(output,'report.json'),bytes);writeFileSync(resolve(output,'report.sha256'),hash(bytes)+'\n');
  console.log('Independent XY profile exchange passed: '+JSON.stringify({head,fixtures:report.fixtures.length,derivativeSamples:report.fixtures.reduce((sum,f)=>sum+f.sampleCount,0),positionSamples:report.fixtures.reduce((sum,f)=>sum+f.positionSampleCount,0),negativeControls:Object.keys(controls)}));
}
