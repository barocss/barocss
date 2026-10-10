import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { app, bundleExample } from './example-runtime.mjs';

const preset = JSON.parse(await readFile(resolve(app, 'scripts/snippets/presets/physics.json'), 'utf8'))['physics-step'];
const directory = resolve(app, 'docs/.vitepress/cache');
await mkdir(directory, { recursive: true });
const entry = resolve(directory, 'host-physics-check.mjs');
await writeFile(entry, `
import { createPhysicsWorld, PhysicsError } from '@barocss/physics';
const config=JSON.parse(${JSON.stringify(preset.source)}),dt=1/120;
const world=createPhysicsWorld(config);
function near(n,target){if(Math.abs(n-target)>1e-9)throw Error('Unexpected state '+n+' versus '+target);}
const results={};
try{
 const first=world.step(dt);near(first.bodies[0].positionM[1],1.99931875);near(first.bodies[0].velocityMps[1],-.08175);
 results.first={stepIndex:first.stepIndex,timeSeconds:first.timeSeconds,body:first.bodies[0]};
 for(let i=1;i<20;i++)world.step(dt);
 const state=world.getState();near(state.bodies[0].positionM[1],1.8569375);near(state.bodies[0].velocityMps[1],-1.635);
 if(state.stepIndex!==20)throw Error('Expected step20');
 results.twentieth={stepIndex:state.stepIndex,timeSeconds:state.timeSeconds,body:state.bodies[0]};
 const accepted=JSON.stringify(state);let refused;
 try{world.step(1/60);}catch(error){if(!(error instanceof PhysicsError))throw error;refused=error.code;}
 if(refused!=='INVALID_STEP'||JSON.stringify(world.getState())!==accepted)throw Error('Invalid step changed accepted state');
 results.invalidStep={code:refused,stateRetained:true};
 console.log(JSON.stringify({results,drawing:'not executed by CPU consumer'},null,2));
}finally{world.dispose();}
`);
const { result, provenance } = await bundleExample(entry, 'node');
await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
console.log(JSON.stringify(provenance));
