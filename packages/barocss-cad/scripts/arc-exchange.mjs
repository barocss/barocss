import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {xyArcEvidenceRoot} from './arc-evidence.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function runXYArcExchange(){
  const output=xyArcEvidenceRoot(),python=process.env.BAROCSS_CAD_PYTHON;assert.ok(python,'BAROCSS_CAD_PYTHON must name the installed independent reader');
  const manifest=JSON.parse(readFileSync(resolve(output,'manifest.json'),'utf8')),head=execFileSync('git',['rev-parse','HEAD'],{cwd:resolve(import.meta.dirname,'../../..'),encoding:'utf8'}).trim();assert.equal(manifest.head,head,'Run actual packed XY arc consumer on current HEAD first');
  const first=manifest.fixtures[0],original=readFileSync(resolve(output,first.files.iges),'utf8');assert.equal(hash(original),first.hashes.iges);
  const lines=original.trimEnd().split('\n');assert.ok(lines.every(line=>line.length===80));const d=lines.findIndex(line=>line[72]==='D');
  const pindices=lines.flatMap((line,i)=>line[72]==='P'?[i]:[]),body=pindices.map(i=>lines[i].slice(0,64)).join('');
  const tokens=[...body.matchAll(/[^,;]+/g)];
  function altered(replacements){let value=body;for(const [index,expected,replacement]of replacements.slice().sort((a,b)=>b[0]-a[0])){const token=tokens[index];assert.equal(token[0].trim(),expected);assert.equal(expected.length,replacement.length);const at=token.index+token[0].indexOf(expected);value=value.slice(0,at)+replacement+value.slice(at+expected.length);}assert.equal(value.length,body.length);const records=lines.slice();pindices.forEach((index,i)=>{records[index]=value.slice(i*64,(i+1)*64)+lines[index].slice(64);});return records;}
  const bad=lines.slice();bad[d]=bad[d].slice(0,8)+' 9999999'+bad[d].slice(16);
  // IGES126: seven header values, six knots, three weights, then nine XYZ
  // coefficients. These original-byte replacements preserve every fixed width.
  const variants={'bad-pointer':bad,'changed-pole':altered([[16,'10.0','11.0']]),'changed-radius':altered([[16,'10.0','12.0'],[19,'10.0','12.0'],[20,'10.0','12.0'],[23,'10.0','12.0']]),'changed-weight':altered([[14,'0.7071067811865476','0.8071067811865476']])};
  const controls={};for(const [name,records]of Object.entries(variants)){assert.ok(records.every(line=>line.length===80));const bytes=records.join('\n')+'\n',file=name+'.iges';writeFileSync(resolve(output,file),bytes);controls[name]={file,sha256:hash(bytes),originalSHA256:first.hashes.iges,change:name==='bad-pointer'?'directory parameter pointer 1 -> 9999999':name==='changed-radius'?'all radius10 coefficients -> radius12':name==='changed-pole'?'first X pole10 ->11':'middle rational weight .707... -> .807...'};}
  writeFileSync(resolve(output,'negative-files.json'),JSON.stringify(controls,null,2)+'\n');
  const run=mode=>spawnSync(python,[resolve(import.meta.dirname,'read-xy-arc-ocp.py'),output,...(mode?[mode]:[])],{encoding:'utf8',maxBuffer:8*1024*1024});
  const positive=run();writeFileSync(resolve(output,'reader.stdout.txt'),positive.stdout??'');writeFileSync(resolve(output,'reader.stderr.txt'),positive.stderr??'');assert.equal(positive.status,0,'Independent XY arc readback failed: '+positive.stderr);
  for(const name of Object.keys(controls)){const result=run('--'+name);writeFileSync(resolve(output,name+'.stdout.txt'),result.stdout??'');writeFileSync(resolve(output,name+'.stderr.txt'),result.stderr??'');assert.equal(result.status,1);assert.match(result.stderr,name==='bad-pointer'?/XY arc load comparison failed/:/XY arc (geometry|derivative) comparison failed/);controls[name].exitCode=result.status;controls[name].expectedStage=name==='bad-pointer'?'load-pointer':'geometry-or-derivative';controls[name].observed=JSON.parse(readFileSync(resolve(output,name+'-observed.json'),'utf8'));}
  const report=JSON.parse(readFileSync(resolve(output,'xy-arc-readback.json'),'utf8'));report.negativeControls=controls;const bytes=JSON.stringify(report,null,2)+'\n';writeFileSync(resolve(output,'report.json'),bytes);writeFileSync(resolve(output,'report.sha256'),hash(bytes)+'\n');
  console.log('Independent XY arc exchange passed: '+JSON.stringify({head,fixtures:report.fixtures.length,derivativeSamples:report.fixtures.reduce((sum,f)=>sum+f.sampleCount,0),positionSamples:report.fixtures.reduce((sum,f)=>sum+f.positionSampleCount,0),negativeControls:Object.keys(controls)}));
}
