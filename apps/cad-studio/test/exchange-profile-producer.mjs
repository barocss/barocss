// D404 bounded fixtures and SELF_READ receipts. Raw output belongs outside the worktree.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const app = resolve(import.meta.dirname, '..'), output = resolve(process.argv[2] ?? '');
assert.ok(process.argv[2], 'an output directory is required'); await mkdir(output, { recursive: true });
const source = `import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {emptyDoc,rectanglePart,withNode,type StudioDoc} from '../../packages/barocss-cad-model/src/engine/doc';
import {evaluateDoc,exportStudioStep} from '../../packages/barocss-cad-model/src/engine/evaluate';
import {flattenAssembly} from '../../packages/barocss-cad-model/src/engine/flatten';
import {referenceOpenFixtures} from './test/reference-open-fixture';
const out=process.argv[2], at='2026-11-01T00:00:00';
const save=(name:string,value:unknown)=>writeFileSync(join(out,name),JSON.stringify(value,null,2));
const def:StudioDoc={...rectanglePart(10,20,5),bodies:{b1:{name:'Shared prism',color:'#d9534f'}}};
const instance=(id:string,position:[number,number,number],rotation:[number,number,number])=>({id,name:'Occurrence '+id,doc:def,part:{id:'shared-prism',rev:'A'},position,rotation});
const sub:StudioDoc={...emptyDoc(),instances:[instance('a',[0,0,0],[0,0,0]),instance('b',[40,0,0],[0,0,90])]};
const assembly:StudioDoc={...emptyDoc(),instances:[instance('loose',[100,0,0],[0,0,90]),{id:'sub',name:'Named subassembly',doc:sub,position:[0,50,0],rotation:[0,0,90]}]};
const box=rectanglePart(80,50,10);
// Analytic expectations are explicit constants, not values taken from the exporter or importer.
const expectations={box:{solidCount:1,productCount:1,volume:40000,bounds:{min:[0,0,0],max:[80,50,10]},solidBounds:[{min:[0,0,0],max:[80,50,10]}]},assembly:{solidCount:3,productCount:1,volume:3000,bounds:{min:[-20,0,0],max:[100,90,5]},solidBounds:[{min:[80,0,0],max:[100,10,5]},{min:[-20,50,0],max:[0,60,5]},{min:[-10,70,0],max:[0,90,5]}]}};
const bounds=(bodies:any[])=>({min:[0,1,2].map(k=>Math.min(...bodies.map(b=>b.mesh.bounds.min[k]))),max:[0,1,2].map(k=>Math.max(...bodies.map(b=>b.mesh.bounds.max[k])))});
const close=(a:number[],b:number[])=>a.every((x,i)=>Math.abs(x-b[i])<1e-7);
const summaries:any={status:'PASS',selfReadOnly:true,fixtures:{},bandProbes:{}};
for(const [name,doc] of Object.entries({box,assembly})){
 const expected=expectations[name as keyof typeof expectations];save(name+'.bcad',doc);save(name+'-expected.json',expected);
 const native=evaluateDoc(name==='assembly'?flattenAssembly(doc):doc,1);assert.ok(native.ok,JSON.stringify(native));
 const step=exportStudioStep(doc,{name:'D404 '+name,timestamp:at});writeFileSync(join(out,name+'.step'),step.text);
 const imported=withNode(emptyDoc(),{kind:'import',name,step:step.text,solids:expected.solidCount});const read=evaluateDoc(imported,2);assert.ok(read.ok,JSON.stringify(read));
 assert.equal(read.bodies.length,expected.solidCount);const volume=read.bodies.reduce((sum,b)=>sum+(b.volume??0),0),box=bounds(read.bodies);
 assert.ok(Math.abs(volume-expected.volume)<1e-5);assert.ok(close(box.min,expected.bounds.min)&&close(box.max,expected.bounds.max));
 const ownBounds=read.bodies.map(b=>({min:[...b.mesh.bounds.min],max:[...b.mesh.bounds.max]}));
 assert.ok(expected.solidBounds.every(w=>ownBounds.some(b=>close(b.min,w.min)&&close(b.max,w.max))));
 summaries.fixtures[name]={status:'SELF_READ_PASS',bytes:Buffer.byteLength(step.text),nativeBodyCount:native.bodies.length,importedBodyCount:read.bodies.length,importedVolume:volume,importedBounds:box,solidBounds:ownBounds,omitted:step.omitted??[],source:step.source};
}
const band=referenceOpenFixtures().valid;const bandRead=evaluateDoc(band,3);assert.ok(bandRead.ok);
for(const [name,doc] of Object.entries({baseMixedBand:band,placedBand:{...emptyDoc(),instances:[{id:'band',name:'Band definition',doc:band,position:[0,0,0],rotation:[0,0,0]}]},mixedPlacedBand:{...box,instances:[{id:'band',name:'Band definition',doc:band,position:[100,0,0],rotation:[0,0,0]}]}})){
 try{const step=exportStudioStep(doc as StudioDoc,{name,timestamp:at});writeFileSync(join(out,name+'.step'),step.text);summaries.bandProbes[name]={success:true,definitionBodyKinds:bandRead.bodies.map(b=>b.band?'band':'solid'),manifoldSolids:(step.text.match(/=MANIFOLD_SOLID_BREP\\(/g)??[]).length,omitted:step.omitted??[],bytes:Buffer.byteLength(step.text)};}
 catch(e:any){summaries.bandProbes[name]={success:false,definitionBodyKinds:bandRead.bodies.map(b=>b.band?'band':'solid'),code:e.code??e.kind??null,error:String(e.message??e)};}
}
save('measurement.json',summaries);console.log(JSON.stringify(summaries));`;
const built = await build({ stdin: { contents: source, resolveDir: app, sourcefile: 'exchange-profile-producer.ts', loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true });
await writeFile(join(output, 'producer.ts'), source); await writeFile(join(output, 'producer.mjs'), built.outputFiles[0].contents);
await writeFile(join(output, 'producer-inputs.json'), JSON.stringify(built.metafile, null, 2));
const run = spawnSync(process.execPath, [join(output, 'producer.mjs'), output], { encoding: 'utf8', maxBuffer: 2 ** 22 });
await writeFile(join(output, 'producer.stdout.json'), run.stdout); await writeFile(join(output, 'producer.stderr.txt'), run.stderr);
assert.equal(run.status, 0, run.stderr); process.stdout.write(run.stdout);
