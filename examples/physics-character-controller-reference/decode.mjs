import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {evaluate} from './metrics.mjs';
import {buildConfig} from '../physics-character-reference/fixture.mjs';
import {closestSegmentBox,referencePointBox} from '../physics-capsule-sweep-reference/reference.mjs';
const manifestPath=resolve(process.argv[2]),folder=dirname(manifestPath),m=JSON.parse(readFileSync(manifestPath,'utf8')),report=JSON.parse(readFileSync(resolve(folder,'report.json'),'utf8'));
assert.equal(m.format,'character-movement-reference-raw-v1');assert.equal(m.endianness,'little');assert.deepEqual(m.files.map(f=>f.file).sort(),['inputs.f64.bin','outputs.f64.bin']);
const names=['REST','FLAT','STEP10','SLOPE15','HEADROOM','TOO_HIGH15','WALL_SLIDE','SPAWN_OVERLAP'];assert.deepEqual(report.first.map(c=>c.name),names);assert.deepEqual(report.second.map(c=>c.name),names);assert.equal(report.exactRawRepeat,true);
function collect(value,out=[]){if(typeof value==='number')out.push(value);else if(Array.isArray(value))for(const v of value)collect(v,out);else if(value&&typeof value==='object')for(const k of Object.keys(value).sort())collect(value[k],out);return out;}
const expectedInputs=collect(report.first.map(c=>({scene:c.scene,positionM:c.positionM,requestMps:c.requestMps}))),expectedOutputs=collect(report.first.map(c=>({states:c.states,error:c.error,retained:c.retained,rejected:c.rejected})));
let total=0;for(const f of m.files){const bytes=readFileSync(resolve(folder,f.file)),expected=f.file.startsWith('inputs')?expectedInputs:expectedOutputs,zeros=f.file.startsWith('inputs')?m.negativeZeroInputOffsets:m.negativeZeroOutputOffsets;assert.equal(bytes.length,f.bytes);assert.equal(f.elements,expected.length);assert.equal(bytes.length,expected.length*8);assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256);const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),zeroSet=new Set(zeros);assert.equal(zeroSet.size,zeros.length);for(let i=0;i<expected.length;i++){const value=view.getFloat64(i*8,true);assert.ok(Number.isFinite(value));if(zeroSet.has(i)){assert.ok(Object.is(value,-0)&&expected[i]===0);}else assert.ok(Object.is(value,expected[i]));}total+=bytes.length;}
assert.equal(total,m.totalRawBytes);
let states=0,hitWitnesses=0;
for(let index=0;index<names.length;index++){
 const c=report.first[index],other=report.second[index];assert.equal(c.scene.boxes.length,[1,1,2,1,3,2,2,1][index]);assert.deepEqual(c,other);assert.equal(c.scene.version,1);assert.equal(c.scene.profile,'upright-capsule-box-v1');assert.equal(c.scene.revision,'movementRef1');
 const source=buildConfig(index<4?names[index]:names[index]==='SPAWN_OVERLAP'?'REST':names[index]==='WALL_SLIDE'?'FLAT':'STEP10');
 const original=source.geometry.fixtures.map(f=>({id:f.id,centerM:f.positionM,halfExtentsM:f.halfExtentsM,orientationXYZW:f.orientation}));
 if(index<4)assert.deepEqual(c.scene.boxes,original);const position=source.config.bodies[0].positionM;if(index===7){position[1]=.495;}assert.deepEqual(c.positionM,position);
 if(index===4){assert.deepEqual(c.scene.boxes.slice(0,2),original);assert.deepEqual(c.scene.boxes[2],{id:'headroom',centerM:[0,1.105,0],halfExtentsM:[3,.05,1],orientationXYZW:[0,0,0,1]});}
 if(index===5){assert.deepEqual(c.scene.boxes[0],original[0]);assert.deepEqual(c.scene.boxes[1],{...original[1],id:'step15',centerM:[.5,.075,0],halfExtentsM:[.25,.075,.75]});}
 if(index===6){assert.deepEqual(c.scene.boxes[0],original[0]);assert.deepEqual(c.scene.boxes[1],{id:'wall',centerM:[.5,.6,0],halfExtentsM:[.05,1,1],orientationXYZW:[0,0,0,1]});assert.deepEqual(c.requestMps,[Math.sqrt(.75),0,.5]);}
 if(index===7){assert.deepEqual(c.scene.boxes,original);assert.equal(c.states.length,0);assert.equal(c.error.code,'INITIAL_OVERLAP');assert.ok(c.scene.boxes.some(b=>closestSegmentBox(c.positionM,b).distanceM<.15-1e-12));continue;}
 assert.equal(c.states.length,241);states+=c.states.length;const computed=evaluate({name:c.name,scene:c.scene,positionM:c.positionM,requestMps:c.requestMps,expectedError:null},c.states);assert.deepEqual(computed,c.metrics);assert.equal(c.passed,computed.passed&&!c.error);
 for(const state of c.states)for(const q of state.lastQueries){if(!q.hit)continue;const hit=q.hit,box=c.scene.boxes.find(b=>b.id===hit.bodyId);assert.ok(box&&box.id!==q.input.excludeId);assert.ok(hit.toiFraction>=0&&hit.toiFraction<=1);const center=q.input.centerM.map((v,i)=>v+hit.toiFraction*q.input.displacementM[i]),ref=closestSegmentBox(center,box),gap=Math.abs(ref.distanceM-.15);assert.ok(gap<=1e-6);assert.ok(Math.abs(Math.hypot(...hit.normalFixtureToCapsule)-1)<=1e-10);assert.ok(Math.abs(Math.hypot(...hit.segmentPointM.map((v,i)=>v-hit.pointM[i]))-.15)<=1e-6);assert.ok(referencePointBox(hit.pointM,box).distanceM<=1e-6);hitWitnesses++;}
}
assert.equal(states,1687);assert.equal(report.controls.passed,true);assert.equal(report.controls.getterCount,0);const all=report.first.every(c=>c.passed);assert.equal(report.numericalPassed,all);if(!all)assert.equal(report.timing,null);
console.log(JSON.stringify({cases:8,acceptedSceneStates:states,totalRawBytes:total,hitWitnesses,exactOriginalInputs:true,originalBitsHashes:true,allStatesMetricsIndependentlyReplayed:true,decisionPreserved:all?'numeric-pass':'NO-GO',firstFailures:report.first.filter(c=>!c.passed).map(c=>({name:c.name,failure:c.metrics.firstFailure})),importsNoCandidate:true}));
