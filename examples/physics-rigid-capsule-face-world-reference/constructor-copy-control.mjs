import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const out=resolve(process.argv[2]),freeze=JSON.parse(await readFile(resolve(out,'constructor-copy-freeze.json')));
const sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(process.version,freeze.node);
assert.equal(sha(await readFile(new URL(import.meta.url))),freeze.controlSha256);
const rows=[];
for(const row of freeze.bundles){
 const path=resolve(out,row.name);assert.equal(sha(await readFile(path)),row.sha256);
 const api=await import(pathToFileURL(path)),config=structuredClone(api.worldCases[0].config);
 const world=api.createCapsuleFaceCandidateWorld(config),before=api.captureWorld(world);
 assert.equal(before.state.stepIndex,0);assert.equal(before.diagnostic,null);
 config.fixedStepSeconds=1/30;config.gravityMps2[0]=900;
 config.bodies[0].id='changed';config.bodies[0].positionM[0]=123;
 config.bodies[0].velocityMps[0]=-456;config.bodies[0].shape.radiusM=.5;
 config.bodies[0].shape.halfLengthM=.7;config.bodies[0].massKg=42;
 config.bodies[0].friction.static=2;config.bodies[0].friction.dynamic=1;
 config.bodies[1].positionM[0]=456;config.bodies[1].shape.halfExtentsM[0]=.5;
 config.bodies.push(structuredClone(config.bodies[0]));
 const after=api.captureWorld(world);assert.deepEqual(after,before);
 assert.equal(after.state.stepIndex,0);assert.equal(after.diagnostic,null);
 world.dispose();world.dispose();rows.push({graph:row.graph,copied:true,acceptedSteps:0,before,after});
}
assert.equal(rows.length,3);
const {graph,...first}=rows[0];for(const row of rows.slice(1)){const{graph,...next}=row;assert.deepEqual(next,first);}
await writeFile(resolve(out,'constructor-copy-report.json'),JSON.stringify({candidateChanged:false,worldStepped:false,acceptedSteps:0,sourceRepeatCompiledParity:true,rows},null,2)+'\n');
console.log(JSON.stringify({constructorCopy:true,graphs:3,acceptedSteps:0,physicalCampaignRepeated:false}));
