import {createPhysicsWorld} from '../../packages/barocss-physics/dist/index.js';
import {makeModel,dynamicPart} from '../physics-model-input/model.mjs';
import {mkdirSync,writeFileSync,readFileSync,cpSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const id=process.argv[2];if(!/^[a-z0-9-]+$/.test(id??''))throw Error('freshID required');
const out=resolve('examples/physics-sphere-pair-ccd-2276/evidence',id);mkdirSync(out,{recursive:false});
const radius=1e-4,y=.00020000001,model=makeModel({revision:'g2-sphere-pair-near-graze',gravityMps2:[0,0,0],parts:[dynamicPart('marked',{kind:'sphere',radiusM:radius},{positionM:[5,y,0],velocityMps:[-600,0,0]},1,{ccd:true}),dynamicPart('other',{kind:'sphere',radiusM:radius},{positionM:[-5,0,0],velocityMps:[600,0,0]},1,{ccd:false})]}),options={profile:'rigid-discrete-v1',fixedStepSeconds:1/60,broadPhase:'direct'};
const pins={};for(const path of ['ccd-pair.ts','world.ts','provider-manifest.generated.ts']){const f='packages/barocss-physics/src/'+path,b=readFileSync(f);pins[f]={bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};cpSync(f,resolve(out,path));}cpSync('packages/barocss-physics/dist',resolve(out,'provider-dist'),{recursive:true});
const w=createPhysicsWorld(model,options);let before,after;try{before=w.getState();after=w.step();}finally{w.dispose();}
const hit=after.ccdHits[0]??null;const result={status:hit?'PHYSICAL_NO_GO_SPHERE_PAIR_FALSE_GRAZE':'UNEXPECTED_BASELINE_MISS',counts:{worlds:1,acceptedSteps:1},model,options,pins,before,after,independentClosestTimeFraction:.5,independentClosestDistanceM:y,radiusSumM:2*radius,positiveGapM:y-2*radius,distanceGateM:1e-12,expectedClass:'MISS'};
writeFileSync(resolve(out,'result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:result.status,hit,positiveGapM:result.positiveGapM}));if(result.status!=='PHYSICAL_NO_GO_SPHERE_PAIR_FALSE_GRAZE')process.exitCode=1;
