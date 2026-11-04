// Literal authored inputs/transport only. No World, expected output or solver import.
import {makeModel,dynamicPart,staticPart} from '../physics-model-input/model.mjs';
export const caseId='chain3-120';
export const budget=Object.freeze({maxWorldsPerGraph:1,maxStepsPerGraph:256,checkpointSteps:32,
 maxReferenceRequestsPerGraph:2,evidenceBytesPerGraph:16*1024*1024,wireBytes:2*1024*1024,
 numericWordBytes:512*1024,maxDepth:32,maxNodes:262144,innerMs:170000,outerMs:180000});
export const gates=Object.freeze({SI:1e-10,freeVelocityMps:1e-11,tangentNs:1e-12,geometryM:1e-12});
export function makeCase(){
 const cube=(id,y)=>dynamicPart(id,{kind:'box',halfExtentsM:[.5,.5,.5]},
  {positionM:[0,y,0],orientationXYZW:[0,0,0,1],velocityMps:[0,0,0],angularVelocityRadps:[0,0,0]},
  2,{restitution:0,friction:{static:0,dynamic:0}});
 const floor=staticPart('floor',{kind:'box',halfExtentsM:[2,.5,2]},
  {positionM:[0,-.5,0],orientationXYZW:[0,0,0,1]},
  {restitution:0,friction:{static:0,dynamic:0}});
 return {caseId,model:makeModel({revision:'three-cubes-floor-chain-v1',gravityMps2:[0,-9.81,0],
  parts:[cube('lower',.5),cube('middle',1.5),cube('upper',2.75),floor]}),
  options:{profile:'rigid-persistent-box-v1',fixedStepSeconds:1/120,broadPhase:'direct'}};
}
export function numericWordsHex(value){
 const list=[];let nodes=0;
 function visit(item,depth){
  if(++nodes>budget.maxNodes||depth>budget.maxDepth)throw Error('bounded numeric tree');
  if(typeof item==='number'){
   if(!Number.isFinite(item)||list.length>=65536)throw Error('finite512KiB numeric words');
   const word=Buffer.alloc(8);word.writeDoubleLE(item);list.push(word);return;
  }
  if(Array.isArray(item)){for(const child of item)visit(child,depth+1);return;}
  if(item&&typeof item==='object')for(const key of Object.keys(item))visit(item[key],depth+1);
 }
 visit(value,0);return Buffer.concat(list).toString('hex');
}
export function packet(data){return {format:'three-cubes-floor-case-v1',data,numericWordsF64leHex:numericWordsHex(data)};}
