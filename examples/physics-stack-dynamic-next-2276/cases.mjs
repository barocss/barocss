// Literal inputs only; no candidate output or expected pose is passed to World.
import {makeModel,dynamicPart,staticPart} from '../physics-model-input/model.mjs';
export const budget=Object.freeze({worlds:48,acceptedSteps:1024,evidenceBytes:16*1024*1024,wireBytes:2*1024*1024,plannedWorlds:11,plannedAcceptedSteps:1018,innerMs:170000,outerMs:180000});
export const gates=Object.freeze({freeVelocity:1e-11,SI:1e-10,tangentNs:1e-12,continuousPositionErrorM:.083,convergenceRatio:[1.99,2.01]});
const cube=(id,y,vy=0,e=0)=>dynamicPart(id,{kind:'box',halfExtentsM:[.5,.5,.5]},{positionM:[0,y,0],velocityMps:[0,vy,0]},2,{restitution:e,friction:{static:0,dynamic:0}});
export function makeCase(caseId){
 let parts,gravityMps2,dt,steps;if(caseId==='gravity-fall'){parts=[cube('moving',.75),staticPart('floor',{kind:'box',halfExtentsM:[2,.5,2]},{positionM:[0,-.5,0]},{restitution:0,friction:{static:0,dynamic:0}})];gravityMps2=[0,-9.81,0];dt=1/120;steps=256;}
 else if(caseId==='delayed-pair'){parts=[cube('lower',-.5,0,.25),cube('upper',.625,-2,.8)];gravityMps2=[0,0,0];dt=1/120;steps=256;}
 else{const hz=Number(caseId.slice('ballistic-'.length));if(![60,120,240].includes(hz)||caseId!=='ballistic-'+hz)throw Error('Unknown fixed case');parts=[cube('free',10)];gravityMps2=[0,-9.81,0];dt=1/hz;steps=hz;}
 return{caseId,model:makeModel({revision:'dynamic-next-'+caseId,gravityMps2,parts}),options:{profile:'rigid-persistent-box-v1',fixedStepSeconds:dt,broadPhase:'direct'},steps};
}
export const caseIds=Object.freeze(['gravity-fall','delayed-pair','ballistic-60','ballistic-120','ballistic-240']);
export function numericWordsHex(value){const words=[];let nodes=0;function visit(x,depth){if(++nodes>262144||depth>64)throw Error('bounded actual numeric transport');if(typeof x==='number'){if(!Number.isFinite(x))throw Error('nonfinite actual numeric leaf');if(words.length>=65536)throw Error('512KiB numeric-word payload bound');const b=Buffer.alloc(8);b.writeDoubleLE(x);words.push(b.toString('hex'));}else if(Array.isArray(x)){for(const v of x)visit(v,depth+1);}else if(x&&typeof x==='object'){for(const key of Object.keys(x))visit(x[key],depth+1);}}visit(value,0);return words.join('');}
export function pack(data){return{format:'dynamic-next-case-v1',data,numericWordsF64leHex:numericWordsHex(data)};}
