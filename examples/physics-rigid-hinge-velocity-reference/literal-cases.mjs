import {literalCandidateControls as adopted,orbitalLossCandidateControl} from '../physics-rigid-coupled-hinge-reference/reference-controls.mjs';
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const row=(name,input,stopKind='none',activeStop=false)=>({name,input,expectedBranch:{stopKind,activeStop}});
export const firstPhysicalCase=freeze(row(orbitalLossCandidateControl.name,structuredClone(orbitalLossCandidateControl.input)));
const original=adopted.map(c=>row(c.name,structuredClone(c.input),c.name==='slight-upper-excess'?'upper':c.name==='slight-lower-excess'?'lower':'none'));
function spin(name,source,a,b,stopKind,activeStop){const input=structuredClone(adopted.find(c=>c.name===source).input);input.state.bodies[0].angularVelocityRadps=[0,0,a];input.state.bodies[1].angularVelocityRadps=[0,0,b];return row(name,input,stopKind,activeStop);}
const transverse=structuredClone(adopted[0].input);transverse.state.bodies[0].angularVelocityRadps=[1,0,0];transverse.state.bodies[1].angularVelocityRadps=[0,1,0];
export const literalCases=freeze([...original,
 spin('upper-outward','slight-upper-excess',-1,1,'upper',true),
 spin('upper-inward','slight-upper-excess',1,-1,'upper',false),
 spin('lower-outward','slight-lower-excess',1,-1,'lower',true),
 spin('lower-inward','slight-lower-excess',-1,1,'lower',false),
 spin('interior-positive-rate','resting-coincident-anchors',-1,1,'none',false),
 spin('interior-negative-rate','resting-coincident-anchors',1,-1,'none',false),
 row('transverse-rate',transverse),
]);
export const algebraBasis=()=>({a:Array.from({length:11},(_,i)=>Array.from({length:12},(_,j)=>i===j?1:0)),b:Array(11).fill(0),h:Array(12).fill(1),y0:Array(12).fill(0),stopKind:'none',stopRow:[]});
export const algebraCases=freeze([
 {name:'basis-identity',edit:'identity',expected:{activeStop:false,identity:true,solveAttempts:0}},
 {name:'basis-corrected',edit:'corrected',expected:{activeStop:false,identity:false,solveAttempts:1}},
 {name:'upper-active',edit:'upper-positive',expected:{activeStop:true,identity:false,solveAttempts:2}},
 {name:'upper-inactive',edit:'upper-negative',expected:{activeStop:false,identity:true,solveAttempts:0}},
 {name:'upper-zero',edit:'upper-zero',expected:{activeStop:false,identity:true,solveAttempts:0}},
 {name:'lower-active',edit:'lower-negative',expected:{activeStop:true,identity:false,solveAttempts:2}},
 {name:'lower-inactive',edit:'lower-positive',expected:{activeStop:false,identity:true,solveAttempts:0}},
]);
export function algebraProblem(edit){const p=algebraBasis();if(edit==='corrected')p.b[0]=1;if(edit.startsWith('upper')||edit.startsWith('lower')){p.stopKind=edit.startsWith('upper')?'upper':'lower';p.stopRow=Array.from({length:12},(_,i)=>i===11?(p.stopKind==='upper'?1:-1):0);p.y0[11]=edit.endsWith('positive')?1:edit.endsWith('negative')?-1:0;}return p;}
