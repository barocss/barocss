/** Internal child: one original research trial. Parent must freeze and explicitly authorize. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { openSync, writeSync, fsyncSync, closeSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const HERE=dirname(fileURLToPath(import.meta.url)),ROOT=resolve(HERE,'../..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const json=x=>JSON.stringify(x,null,2)+'\n';
const names=['world.mjs','topology.mjs','constraints.mjs','fixture.mjs'];
function instrument(name,source){
  let result=source;
  const insert=(pattern,count)=>{assert.equal([...result.matchAll(new RegExp(pattern,'gm'))].length,1,name+':'+count);result=result.replace(new RegExp(pattern,'m'),m=>m+`\nglobalThis.__p5bOracle.hit('${count}');\n`);};
  if(name==='world.mjs') {insert('^export function createClothTrial\\([^\\{]*\\{','researchConstructors');insert('^\\s*function advance\\(\\)\\s*\\{','privateAdvances');}
  if(name==='topology.mjs')insert('^export function createSheet\\([^\\{]*\\{','researchCreateSheetCalls');
  if(name==='constraints.mjs'){insert('^export function projectDistance\\([^\\{]*\\{','originalResearchProjectDistanceCalls');insert('^export function projectSphere\\([^\\{]*\\{','originalResearchProjectSphereCalls');}
  return result;
}
async function authenticate(path,expected){
  const b=await readFile(path);assert.equal(sha(b),expected,'oracle execution freeze');const freeze=JSON.parse(b);assert(freeze.files);
  for(const [name,pin]of Object.entries(freeze.files)){const bytes=await readFile(resolve(ROOT,name));assert.equal(bytes.length,pin.bytes,name);assert.equal(sha(bytes),pin.sha256,name);}
  for(const name of names)assert(freeze.files[`examples/physics-cloth-spike/${name}`],'missing original research source pin');
  for(const name of ['oracle-generation.mjs','oracle-run.mjs','oracle-reader.mjs','ORACLE-RECIPE.json'])assert(freeze.files[`examples/physics-world-p5-2276/${name}`],'missing oracle harness pin');
  return freeze;
}
async function main(){
  const [out,freezePath,freezeSha,token]=process.argv.slice(2);assert.equal(token,'--authorized-oracle-child');assert(/^v22\./.test(process.version));
  const counts={researchFactoryAttempts:0,researchConstructors:0,researchFactoryReturns:0,researchCreateSheetCalls:0,researchStepCalls:0,researchStepReturns:0,privateAdvances:0,originalResearchProjectDistanceCalls:0,originalResearchProjectSphereCalls:0,frames:0,rawBytes:0,PhysicsWorldFactoryCalls:0,currentKernelCalls:0};
  const progress=()=>writeFileSync(resolve(out,'progress.json'),json({counts,durability:'actual counters at frame/call boundary; inner-loop leaf counts are durable lower bounds if killed'}));
  globalThis.__p5bOracle={hit(name){counts[name]++;}};
  let trial=null,fd=null,firstFailure=null;const frames=[],provider={};const streamHash=createHash('sha256');
  try{
    const freeze=await authenticate(resolve(freezePath),freezeSha);await mkdir(resolve(out,'provider'),{recursive:false});
    for(const name of names){const originalPath=`examples/physics-cloth-spike/${name}`;const original=await readFile(resolve(ROOT,originalPath),'utf8');
      assert(!/\b(?:import\s*\(|require\s*\()/.test(original),'computed provider import refused');
      for(const m of original.matchAll(/\bimport\s+[^;]+?from\s+['"]([^'"]+)['"]/g))assert(names.some(n=>m[1]==='./'+n),'unexpected research dependency '+m[1]);
      const effective=instrument(name,original);provider[originalPath]={originalSha256:sha(original),effectiveSha256:sha(effective),counterOnlyOverlay:effective!==original};
      await writeFile(resolve(out,'provider',name),effective,{flag:'wx'});
    }
    await writeFile(resolve(out,'provider-graph.json'),json(provider),{flag:'wx'});
    // All four original sources and the owned harness authenticate before any original import.
    await authenticate(resolve(freezePath),freezeSha);
    const {createClothTrial}=await import(pathToFileURL(resolve(out,'provider/world.mjs')).href);
    const {CLOTH_FIXTURE}=await import(pathToFileURL(resolve(out,'provider/fixture.mjs')).href);
    counts.researchFactoryAttempts++;progress();trial=createClothTrial(CLOTH_FIXTURE,'xpbd',2,8);counts.researchFactoryReturns++;progress();
    assert.equal(trial.sheet.positions.length,867);assert.equal(trial.velocities.length,867);assert.equal(trial.sheet.triangles.length,1536);assert.equal(trial.sheet.constraints.length,1566);
    fd=openSync(resolve(out,'oracle-f64le.bin'),'wx');const frame=Buffer.alloc(13872);
    function capture(step){assert.equal(trial.getStep(),step);const arrays=[trial.sheet.positions,trial.velocities];let offset=0;
      for(const array of arrays){assert.equal(array.length,867);for(const value of array){assert(Number.isFinite(value));frame.writeDoubleLE(value,offset);offset+=8;}}
      assert.equal(offset,13872);let written=0;while(written<frame.length)written+=writeSync(fd,frame,written,frame.length-written);
      streamHash.update(frame);frames.push({step,offset:counts.rawBytes,bytes:frame.length,sha256:sha(frame),positionsSha256:sha(frame.subarray(0,6936)),velocitiesSha256:sha(frame.subarray(6936))});
      counts.frames++;counts.rawBytes+=frame.length;progress();
    }
    capture(0);
    for(let step=1;step<=240;step++){counts.researchStepCalls++;progress();trial.step();counts.researchStepReturns++;capture(step);}
    fsyncSync(fd);closeSync(fd);fd=null;
    const triangles=Buffer.alloc(3072);for(let i=0;i<1536;i++)triangles.writeUInt16LE(trial.sheet.triangles[i],i*2);
    await writeFile(resolve(out,'oracle-triangles-u16le.bin'),triangles,{flag:'wx'});
    const index=json({format:'p5b-original-cloth-research-raw-v1',source:'original independent research fixture xpbd8x2',frames,valuesPerArray:867,byteOrder:'LE',arrays:['positionsM','velocitiesMps']});
    await writeFile(resolve(out,'oracle-index.json'),index,{flag:'wx'});
    assert.equal(counts.researchConstructors,1);assert.equal(counts.researchCreateSheetCalls,1);assert.equal(counts.researchStepCalls,240);assert.equal(counts.researchStepReturns,240);assert.equal(counts.privateAdvances,1920);assert.equal(counts.originalResearchProjectDistanceCalls,6013440);assert.equal(counts.originalResearchProjectSphereCalls,3840);assert.equal(counts.frames,241);assert.equal(counts.rawBytes,3343152);
    assert(counts.rawBytes+triangles.length+Buffer.byteLength(index)<=4194304,'oracle data4MiB cap');
    const raw=await readFile(resolve(out,'oracle-f64le.bin'));assert.equal(sha(raw),streamHash.copy().digest('hex'));assert.equal(raw.length,3343152);
    await authenticate(resolve(freezePath),freezeSha);
    const artifacts={};for(const name of ['oracle-f64le.bin','oracle-triangles-u16le.bin','oracle-index.json','provider-graph.json']){const b=await readFile(resolve(out,name));artifacts[name]={bytes:b.length,sha256:sha(b)};}
    await writeFile(resolve(out,'summary.json'),json({status:'PASS_ORIGINAL_CLOTH_RESEARCH_ORACLE',counts,artifacts,provider,freezeSha256:freezeSha,graph:'independent original research only',comparisonToleranceAbsolute:1e-12,reuse:'same authenticated241frames reused both current source/native; no second generation',notClaimed:['currentPhysicsWorld','currentP5baccuracy','browser','cost']}),{flag:'wx'});
  }catch(error){firstFailure={name:error?.name,message:error?.message,stack:error?.stack};}
  finally{if(fd!==null)try{closeSync(fd);}catch{}trial=null;delete globalThis.__p5bOracle;progress();}
  if(firstFailure){await writeFile(resolve(out,'summary.json'),json({status:'FAIL',counts,firstFailure}),{flag:'wx'});process.exitCode=1;}
}
await main();
