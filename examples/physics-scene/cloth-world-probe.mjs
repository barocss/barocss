import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyPhysicsModelPreset } from '../physics-model-data-2276/model-data.mjs';
import { authenticateClothOracle } from '../physics-world-p5-2276/oracle-reader.mjs';
import { clothMetrics } from '../physics-cloth-viewer/metrics.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const hash=a=>createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const p95=a=>[...a].sort((a,b)=>a-b)[Math.ceil(a.length*.95)-1];
function near(actual,expected){assert.equal(actual.length,expected.length);let maximum=0;for(let i=0;i<actual.length;i++){assert(Number.isFinite(actual[i]));maximum=Math.max(maximum,Math.abs(actual[i]-expected[i]));}assert(maximum<=1e-12);return maximum;}

/** Five actual root Worlds,1200 accepted steps. The shared trial runner accounts these calls. */
export function qualifyClothProfile(provider,oracle){
  const input=copyPhysicsModelPreset('cloth-pinned-sphere-visual-v1');
  const snapshots=[];let peakStructuralExtension=0,peakSampledPenetrationM=0,peakStep=0,finalPositionSha256;
  const run=(timed,reference)=>{
    const world=provider.createPhysicsWorld(input.model,input.options),times=[];
    try{
      const model=world.getModel();
      for(let step=0;step<=240;step++){
        const start=performance.now();const state=step===0?world.getState():world.step([]);
        if(timed&&step>0)times.push(performance.now()-start);
        const cloth=state.cloths[0];
        if(reference){
          const old=oracle.getFrame(step);const positionDifference=near(cloth.positionsM,old.positionsM),velocityDifference=near(cloth.velocitiesMps,old.velocitiesMps);
          const metrics=clothMetrics(state,model);assert(metrics.passed);
          assert(cloth.diagnostics.maxStructuralExtension<=.10);assert(cloth.diagnostics.maxVertexPenetrationM<=1e-6);assert.equal(cloth.diagnostics.maxPinDriftM,0);assert(Math.abs(cloth.diagnostics.totalMassKg-.2)<=1e-14);
          peakStructuralExtension=Math.max(peakStructuralExtension,cloth.diagnostics.maxStructuralExtension);
          if(metrics.sampledTrianglePenetrationM>peakSampledPenetrationM){peakSampledPenetrationM=metrics.sampledTrianglePenetrationM;peakStep=step;}
          if([0,60,240].includes(step))snapshots.push({step,positionDifference,velocityDifference,positionSha256:hash(cloth.positionsM),sampledPenetrationM:metrics.sampledTrianglePenetrationM,diagnostics:cloth.diagnostics});
        }
        if(step===240){const digest=hash(cloth.positionsM);if(reference)finalPositionSha256=digest;else assert.equal(digest,finalPositionSha256);}
      }
      if(reference){const accepted=world.getState();assert.throws(()=>world.step([]),e=>e instanceof provider.PhysicsError&&e.code==='WORLD_LIMIT');assert.deepEqual(world.getState(),accepted);}
      return times;
    }finally{world.dispose();}
  };
  run(false,true);run(false,false);
  const trials=[run(true,false),run(true,false),run(true,false)].map(times=>{const sorted=[...times].sort((a,b)=>a-b);const p95StepMs=p95(times);assert(p95StepMs<=1000/120);return{steps:240,medianStepMs:sorted[Math.ceil(sorted.length*.5)-1],p95StepMs,maxStepMs:sorted.at(-1)};});
  assert(peakSampledPenetrationM<=.002);
  return {result:'ok',scope:'common root fixed cloth; authenticated original research stream reused',numeric:{snapshots,peakStructuralExtension,peakSampledPenetrationM,peakStep,finalPositionSha256,maxStepRetention:true},benchmark:{warmupSteps:240,trials,includesCandidateCopiesDiagnosticsAndStateCopies:true,excludesReferenceAndTriangleSampling:true,gpuCompletionMeasured:false,repeatedFinalHash:finalPositionSha256},atomicFailureControls:'SEPARATE_P5B_RECEIPT_REQUIRED',legacyScalarControls:'ORIGINAL_IMMUTABLE_RECEIPT_NO_NEW_HELPER_CALL'};
}
if(typeof process !== 'undefined' && basename(process.argv[1] ?? '') === 'cloth-world-probe.mjs'){
  const receipt=JSON.parse(await readFile(resolve(root,'examples/physics-world-p5-2276/oracle-results.json'),'utf8'));
  const oracle=await authenticateClothOracle(resolve(root,receipt.receipt.path),receipt.receipt.sha256);
  const nativeEntry=pathToFileURL(resolve(root,'packages/barocss-physics/dist/index.js')).href;
  const provider=await import(nativeEntry);
  console.log(JSON.stringify(qualifyClothProfile(provider,oracle)));
}
