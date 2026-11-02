/** DATA-only staged transforms; no numerical module is imported or evaluated. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {makeRepairOverlay} from '../physics-rigid-rotation-g1-2276/repair-overlay.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
const once=(source,anchor,value)=>{assert.equal(source.split(anchor).length,2,'unique M overlay anchor '+anchor);return source.replace(anchor,value);};
export const EXPECTED_G1A_MICRO=Object.freeze({dispatch:1,prepare:1,null:0,eligible:0,zero:0,nonzero:0,validate:1,inheritedAdvanceOrientation:0,sharedSin:0,sharedCos:0,bodySin:0,bodyCos:0,F01Site:1,F02Site:1,F03Site:1,faultThrows:0,guardReplacements:0,attachments:1,releases:1,cacheReads:1});
export const EXPECTED_TRI_MICRO=Object.freeze({coefficientPow:3,prepare:1,triaxial:1,zero:0,principal:0,general:1,initialMomentum:1,midpoint:27,newtonCondition:108,linearSolve:108,pivot:324,newtonUpdate:108,midpointResidual:27,stageComplete:27,generalReturn:1,linearResidualFailure:0});
const recording={
 G1B_LINEAR_RESIDUAL_FAILURE:['linearResidualFailure','{linearResidualMaximum:residualMaximum,linearResidualBound:residualBound}'],
 G1B_INITIAL_MOMENTUM:['initialMomentum','{moments,diagonal,localOmega,p,momentumNorm}'],
 G1B_NEWTON_CONDITION:['newtonCondition','{update,middle,residual,perturbation}'],
 G1B_LINEAR_PIVOT:['pivot','{column,selectedPivot,pivotMagnitude}'],
 G1B_NEWTON_UPDATE:['newtonUpdate','{update,guess,linearResidualMaximum,linearResidualBound}'],
 G1B_MIDPOINT_RESIDUAL:['midpointResidual','{residualMaximum,residualBound,finalPerturbation}'],
 G1B_STAGE_COMPLETE:['stageComplete','{stage,weight,signedStep,p,orientation}']
};
const counting={G1B_COEFFICIENT_POW:'coefficientPow',G1B_PREPARE_ENTRY:'prepare',G1B_TRIAXIAL_ENTRY:'triaxial',G1B_ZERO_RETURN:'zero',G1B_PRINCIPAL_RETURN:'principal',G1B_GENERAL_ENTRY:'general',G1B_MIDPOINT_ENTRY:'midpoint',G1B_LINEAR_SOLVE_ENTRY:'linearSolve',G1B_GENERAL_RETURN:'generalReturn'};
function extraControl(){return `\n// M-only observation DATA. No callback or alternate numerical implementation.
type MicroName = ${Object.keys(EXPECTED_TRI_MICRO).map(JSON.stringify).join(' | ')};
const microCounts:Record<MicroName,number> = ${JSON.stringify(Object.fromEntries(Object.keys(EXPECTED_TRI_MICRO).map(name=>[name,0])))};
let observations:Array<{kind:MicroName;value:unknown}>=[];
function observationCopy(value:unknown):unknown {
  let nodes=0;
  let copy:((item:unknown,depth:number)=>unknown)|null=null;
  try {copy=(item:unknown,depth:number):unknown=>{
    if(++nodes>128||depth>8)throw new Error('M observation schema bound');
    if(item===null||typeof item==='number'||typeof item==='boolean'||typeof item==='string')return item;
    if(Array.isArray(item))return item.map(value=>copy!(value,depth+1));
    if(item&&Object.getPrototypeOf(item)===Object.prototype)return Object.fromEntries(Object.entries(item).map(([key,value])=>[key,copy!(value,depth+1)]));
    throw new Error('M observation ordinary data only');
  }
  return copy(value,0);}finally{copy=null;}
}
export const g1bControl={
 count(name:MicroName):void {microCounts[name]++;},
 record(kind:MicroName,value:unknown):void {microCounts[kind]++;if(observations.length>=640)throw new Error('M observation population cap');observations.push({kind,value:observationCopy(value)});},
 take():Array<{kind:MicroName;value:unknown}> {const result=observations;observations=[];return result;},
 stats():Record<MicroName,number> {return {...microCounts};},
 assertEmpty():void {if(observations.length)throw new Error('M observations not released');}
};\n`;}
export function makeMicroOverlay({world,math,axisymmetric,triaxial}){
 const base=makeRepairOverlay({world,math,candidate:axisymmetric});
 let stagedWorld=once(base.world,'const preparedRotation = prepareAxisymmetricFreeRotation(body, dt);','const preparedRotation = prepareAxisymmetricFreeRotation(body, dt) ?? prepareTriaxialFreeRotation(body, dt);');
 stagedWorld=once(stagedWorld,'          if (preparedRotation === null) {',`          if (preparedRotation === null) {
            const moments = body.inertiaDiagonalKgM2;
            if (body.shape.kind === 'box' && (!moments || moments[0] !== moments[1] || moments[1] !== moments[2])) {
              error('NUMERIC_LIMIT', 'nonisotropic box has no qualified free-flow result');
            }`);
 stagedWorld="import { prepareTriaxialFreeRotation } from './rigid-triaxial-free-rotation.js';\n"+stagedWorld;
 const originalTriaxial=triaxial;
 for(const[anchor,name]of Object.entries(counting)){
  const lines=triaxial.split('\n').filter(line=>line.includes('// '+anchor+':'));assert.equal(lines.length,1,anchor);
  const indent=lines[0].match(/^\s*/)[0];triaxial=once(triaxial,lines[0],lines[0]+`\n${indent}g1bControl.count('${name}');`);
 }
 for(const[anchor,[name,value]]of Object.entries(recording)){
  const lines=triaxial.split('\n').filter(line=>line.includes('// '+anchor+':'));assert.equal(lines.length,1,anchor);
  const indent=lines[0].match(/^\s*/)[0];triaxial=once(triaxial,lines[0],lines[0]+`\n${indent}g1bControl.record('${name}', ${value});`);
 }
 triaxial="import { g1bControl } from './g1-test-control.js';\n"+triaxial;
 const control=base.control+extraControl();
 const sourceEntry=base.sourceEntry+"export { g1bControl } from './package/src/g1-test-control.js';\nexport { triaxialFreeRotationCoefficients } from './package/src/rigid-triaxial-free-rotation.js';\n";
 return{world:stagedWorld,math:base.math,axisymmetric:base.candidate,triaxial,control,sourceEntry,proof:{axisymmetricFactory:base.proof,triaxialOriginalSha256:sha(originalTriaxial),effectiveSha256:{world:sha(stagedWorld),math:sha(base.math),axisymmetric:sha(base.candidate),triaxial:sha(triaxial),control:sha(control)},dispatch:'axisymmetric ?? triaxial; nonisotropic null refuses before untouched exact isotropic statement',arithmetic:'No numerical expression modified. Only private imports/counts/detached snapshots at frozen anchors; no new helper math.',phase:'M_ONLY',faultControlsExecuted:0}};
}
