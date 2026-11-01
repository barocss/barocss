// D419 test-only producer/inspector. All generated fixtures and evidence go to the supplied /tmp folder.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

export const offsetInspectorSource = `
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {partBreps,evaluatePart} from '@barocss/cad-model/engine/evaluate';
import {brepMassProperties,checkBrep} from '@barocss/cad';
import {brepBounds} from '../../packages/barocss-cad/src/brep/brep-bounds';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8'));
const kind=JSON.parse(process.argv[3]);
const evaluated=evaluatePart(doc,1);assert.ok(evaluated.ok,evaluated.ok?'':evaluated.error.detail);
const native=partBreps(doc);assert.equal(native.length,1);
const brep=native[0].brep,check=checkBrep(brep,{strict:true});assert.equal(check.valid,true);
const mass=brepMassProperties(brep,1),b=brepBounds(brep),bounds=[...b.min,...b.max];
const expectedVolume=kind==='plane'?24:1440*Math.PI;
const expectedBounds=kind==='plane'?[0,0,0,4,3,2]:[-12,-12,0,12,12,10];
const volumeError=Math.abs(mass.volume-expectedVolume);
assert.ok(volumeError<=1e-5&&volumeError/Math.abs(expectedVolume)<=1e-9,JSON.stringify({volume:mass.volume,expectedVolume,volumeError}));
assert.ok(bounds.every((value,i)=>Math.abs(value-expectedBounds[i])<=1e-6),JSON.stringify(bounds));
assert.equal(brep.faces.length,kind==='plane'?6:4);
const selected=brep.faces.filter(face=>kind==='plane'?/(^|\\.)top$/.test(face.name??''):/wall#/.test(face.name??''));
assert.equal(selected.length,kind==='plane'?1:2,JSON.stringify(brep.faces.map(face=>face.name)));
assert.ok(selected.every(face=>face.surface.kind==='surface'));
console.log(JSON.stringify({kind,volume:mass.volume,volumeError,relativeVolumeError:volumeError/Math.abs(expectedVolume),bounds,check,
 counts:{bodies:brep.bodies.length,shells:brep.shells.length,faces:brep.faces.length,edges:brep.edges.length,vertices:brep.vertices.length},
 surfaceNames:selected.map(face=>face.name),surfaces:selected.map(face=>face.surface)}));
`;

const producerSource = `
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {planeOffsetStep,cylinderOffsetStep,unsupportedOffsetStep} from '../../packages/barocss-cad/test/step-offset-fixtures.mjs';
import {emptyDoc,withNode} from '@barocss/cad-model/engine/doc';
import {partBreps,evaluatePart} from '@barocss/cad-model/engine/evaluate';
import {stepLengthUnit} from '@barocss/cad-model/engine/stepUnits';
import {brepMassProperties,checkBrep} from '@barocss/cad';
import {brepBounds} from '../../packages/barocss-cad/src/brep/brep-bounds';
const out=process.argv[2];mkdirSync(out,{recursive:true});
const definitions=[{name:'plane-mm',kind:'plane',selfIntersect:'F',step:planeOffsetStep()},
 ...['T','F','U'].map(selfIntersect=>({name:'cylinder-mm-'+selfIntersect,kind:'cylinder',selfIntersect,step:cylinderOffsetStep({selfIntersect})})),
 {name:'cylinder-cm',kind:'cylinder',selfIntersect:'F',step:cylinderOffsetStep({baseRadius:1,distance:.2,height:1,unit:'cm'})}];
const cases=[];
for(const input of definitions){
 const unit=stepLengthUnit(input.step);let doc=withNode(emptyDoc(),{kind:'import',name:input.name,step:input.step});
 if(unit.to!==1)doc=withNode(doc,{kind:'scale',parent:{node:0,side:'solid'},factor:unit.to,pivot:[0,0,0]});
 const result=evaluatePart(doc,1);assert.ok(result.ok,result.ok?'':result.error.detail);assert.equal(result.bodies.length,1);
 const native=partBreps(doc);assert.equal(native.length,1);const brep=native[0].brep;
 const check=checkBrep(brep,{strict:true});assert.equal(check.valid,true);
 const mass=brepMassProperties(brep,1),b=brepBounds(brep);
 const selected=brep.faces.filter(face=>input.kind==='plane'?/(^|\\.)top$/.test(face.name??''):/wall#/.test(face.name??''));
 assert.equal(selected.length,input.kind==='plane'?1:2,JSON.stringify(brep.faces.map(face=>face.name)));
 writeFileSync(join(out,input.name+'.step'),input.step);writeFileSync(join(out,input.name+'.bcad'),JSON.stringify(doc,null,2));
 cases.push({...input,unit,volume:mass.volume,bounds:[...b.min,...b.max],surfaces:selected.map(face=>face.surface),surfaceNames:selected.map(face=>face.name),check});
}
const unsupported=unsupportedOffsetStep();writeFileSync(join(out,'unsupported.step'),unsupported);
const refused=evaluatePart(withNode(emptyDoc(),{kind:'import',name:'unsupported',step:unsupported}),2);
assert.equal(refused.ok,false);assert.match(refused.error.detail,/OFFSET_SURFACE basis SPHERICAL_SURFACE is not supported yet/);
assert.doesNotMatch(refused.error.detail,/unexpected kernel failure/i);
writeFileSync(join(out,'oracle-input.json'),JSON.stringify({cases},null,2));
writeFileSync(join(out,'unsupported-result.json'),JSON.stringify(refused,null,2));
const mismatch=cylinderOffsetStep({baseRadius:10,distance:3,boundaryRadius:12});writeFileSync(join(out,'mismatch.step'),mismatch);
const badBinding=evaluatePart(withNode(emptyDoc(),{kind:'import',name:'mismatch',step:mismatch}),3);
assert.equal(badBinding.ok,false);assert.match(badBinding.error.detail,/OFFSET_SURFACE edge.*is separated from its surface/);assert.doesNotMatch(badBinding.error.detail,/unexpected kernel failure/i);
writeFileSync(join(out,'mismatch-result.json'),JSON.stringify(badBinding,null,2));

console.log(JSON.stringify({status:'PASS',cases:cases.map(({name,unit,volume,bounds,surfaceNames})=>({name,unit,volume,bounds,surfaceNames})),unsupportedRefusal:refused.error.detail,bindingRefusal:badBinding.error.detail}));
`;

async function main() {
  assert.ok(process.argv[2], 'Output folder is required');
  const output = resolve(process.argv[2]);
  assert.ok(output.startsWith('/tmp/') || output.startsWith('/private/tmp/'), 'Evidence must be outside the worktree');
  await mkdir(output, { recursive: true });
  const built = await build({ stdin: { contents: producerSource, resolveDir: resolve(import.meta.dirname, '..'), sourcefile: 'step-offset-producer.ts', loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true });
  await writeFile(join(output, 'producer.ts'), producerSource);
  await writeFile(join(output, 'producer.mjs'), built.outputFiles[0].contents);
  await writeFile(join(output, 'producer-inputs.json'), JSON.stringify(built.metafile, null, 2));
  const run = spawnSync(process.execPath, [join(output, 'producer.mjs'), output], { encoding: 'utf8', maxBuffer: 24 * 1024 * 1024 });
  await writeFile(join(output, 'producer.stdout.json'), run.stdout ?? '');
  await writeFile(join(output, 'producer.stderr.txt'), run.stderr ?? '');
  assert.equal(run.status, 0, run.stderr);
  process.stdout.write(run.stdout);
}
if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) await main();
