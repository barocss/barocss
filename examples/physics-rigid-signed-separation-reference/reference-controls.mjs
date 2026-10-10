import assert from 'node:assert/strict';

// Authored data only. Import does not call a query, solver, world or observer.
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const referenceGates=freeze({postDepthM:1e-12,geometryM:1e-12,precisionM:'1e-25',translationM:1e-12,objectiveKgM2:1e-12,actualCertificate:1e-12,uniquePhysicalFeature:false,uniqueActiveSet:false});
export const referenceErrors=freeze({request:'signed reference request is invalid',raw:'signed reference raw13 data is invalid',query:'signed reference requires admitted raw boxes',selection:'signed reference selection data is invalid',row:'signed reference selected row data is invalid',result:'signed reference linear result data is invalid',number:'reference number must be a finite Float64; bool is invalid',shape:'reference shape must be a box',ids:'reference bodies must have distinct ids'});
const box=(id,positionM,orientation=[0,0,0,1])=>({id,kind:'dynamic',inverseMass:1,shape:{kind:'box',halfExtentsM:[.25,.25,.25]},positionM,orientation,velocityMps:[0,0,0],angularVelocityRadps:[0,0,0]});
const query=(center=[.6,0,0])=>({op:'query',a:box('a',[0,0,0]),b:box('b',center)});
const changed=(edit)=>{const value=query();edit(value);return value;};
const linear=(bodies,rows)=>({op:'linear',problem:{bodies,rows}});
const bodies=[{id:'a',inverseMass:1},{id:'b',inverseMass:1}];
const row=boundM=>({aId:'a',bId:'b',normal:[1,0,0],boundM});
export const literalReferenceControls=freeze([
 {name:'query-separated-negative-bound',input:query(),expected:{boundM:-.1,candidateIndex:0}},
 {name:'query-touch-zero-bound',input:query([.5,0,0]),expected:{boundM:0,candidateIndex:0}},
 {name:'query-overlap-positive-bound',input:query([.4,0,0]),expected:{boundM:.1,candidateIndex:0}},
 {name:'query-zero-distance-positive-normal-ties',input:query([0,0,0]),expected:{boundM:.5,candidateIndex:0,multipleTies:true}},
 {name:'query-sign-equivalent-quaternion',input:changed(x=>x.b.orientation=[0,0,0,-1]),expected:{boundM:-.1,candidateIndex:0}},
 {name:'query-original-parallel-cross-skip',input:query(),expected:{skipped:[6,10,14]}},
 {name:'query-small-nonzero-cross-cutoff',input:changed(x=>x.b.orientation=[0,5e-14,0,1]),expected:{nearParallelSkipped:true}},
 {name:'query-added-negative-row',input:{...query(),rowKind:'added',row:{aId:'a',bId:'b',normal:[1,0,0],boundM:-.1}},expected:{rowAgreement:true}},
 {name:'query-original-clamped-touch-row',input:{...query([.5,0,0]),rowKind:'original',row:{aId:'a',bId:'b',normal:[1,0,0],boundM:0}},expected:{rowAgreement:true}},
 {name:'query-stale-axis-row-is-quality-failure',input:{...query(),rowKind:'added',row:{aId:'a',bId:'b',normal:[0,1,0],boundM:-.1}},expected:{rowAgreement:false,qualityFailure:true}},
 {name:'query-non-box',input:changed(x=>x.b.shape={kind:'sphere',radiusM:.1}),error:referenceErrors.shape},
 {name:'query-null-position',input:changed(x=>x.b.positionM[0]=null),error:referenceErrors.number},
 {name:'query-boolean-position',input:changed(x=>x.b.positionM[0]=false),error:referenceErrors.number},
 {name:'query-nonfinite-codec',input:changed(x=>x.b.positionM[0]=Infinity),error:referenceErrors.number},
 {name:'query-short-raw13',input:{...query(),rawHex:'00'},error:referenceErrors.raw},
 {name:'query-null-selection',input:{...query(),selection:null},error:referenceErrors.selection},
 {name:'query-null-row-bound',input:{...query(),rowKind:'added',row:{aId:'a',bId:'b',normal:[1,0,0],boundM:null}},error:referenceErrors.row},
 {name:'query-wrong-row-endpoints',input:{...query(),rowKind:'added',row:{aId:'b',bId:'a',normal:[1,0,0],boundM:-.1}},error:referenceErrors.row},
 {name:'signed-gap-alone-inactive',input:linear(structuredClone(bodies),[row(-1)]),expected:{status:'SOLVED',objective:0,translations:[[0,0,0],[0,0,0]],mask:0}},
 {name:'signed-gap-activates-under-positive-row',input:linear([...structuredClone(bodies),{id:'c',inverseMass:1}],[row(1),{aId:'b',bId:'c',normal:[1,0,0],boundM:-.1}]),expected:{status:'SOLVED',gapActive:true}},
 {name:'signed-compatible-redundant-negative',input:linear(structuredClone(bodies),[row(-1),row(-1)]),expected:{status:'SOLVED',objective:0,singularMask:true}},
 {name:'signed-compatible-redundant-positive',input:linear(structuredClone(bodies),[row(1),row(1)]),expected:{status:'SOLVED',objective:.25,singularMask:true}},
 {name:'signed-static-gap-feasible',input:linear([{id:'a',inverseMass:0},{id:'b',inverseMass:0}],[row(-1)]),expected:{status:'SOLVED',objective:0}},
 {name:'signed-static-positive-infeasible',input:linear([{id:'a',inverseMass:0},{id:'b',inverseMass:0}],[row(1)]),expected:{status:'INFEASIBLE'}},
 {name:'signed-opposed-positive-infeasible',input:linear(structuredClone(bodies),[row(1),{...row(1),normal:[-1,0,0]}]),expected:{status:'INFEASIBLE'}},
 {name:'signed-zero-bound',input:linear(structuredClone(bodies),[row(0)]),expected:{status:'SOLVED',objective:0}},
 {name:'signed-negative-zero-bound',input:linear(structuredClone(bodies),[row(-0)]),expected:{status:'SOLVED',objective:0}},
 {name:'signed-negative-ten-bound',input:linear(structuredClone(bodies),[row(-10)]),expected:{status:'SOLVED',objective:0}},
 {name:'signed-positive-ten-bound',input:linear(structuredClone(bodies),[row(10)]),expected:{status:'SOLVED',objective:25}},
 {name:'signed-null-bound',input:linear(structuredClone(bodies),[row(null)]),code:'INVALID_INPUT',message:'signed position reference bound must be finite and between minus ten and ten metres'},
 {name:'signed-boolean-mass',input:linear([{id:'a',inverseMass:false}],[]),code:'INVALID_INPUT',message:'signed position reference inverse mass is invalid'},
 {name:'signed-extra-problem-field',input:{op:'linear',problem:{bodies:structuredClone(bodies),rows:[],extra:0}},code:'INVALID_INPUT',message:'signed position reference input is invalid'},
]);
function finite(value,label){assert.ok(typeof value==='number'&&Number.isFinite(value),label);return value;}
function near(value,expected,label){assert.ok(Math.abs(finite(value,label)-expected)<=1e-12,label);}
export async function runReferenceControls(ask){
 const receipts=[];
 for(const item of literalReferenceControls){
  const input=structuredClone(item.input),saved=structuredClone(input),reply=await ask(input);assert.deepEqual(input,saved,item.name);
  if(item.error){assert.equal(reply.ok,false,item.name);assert.equal(reply.resolved,false,item.name);assert.equal(reply.executionFailure,true,item.name);assert.equal(reply.code,'REFERENCE_INPUT');assert.equal(reply.message,item.error);}
  else if(item.code){assert.equal(reply.ok,false,item.name);assert.equal(reply.executionFailure,true,item.name);assert.equal(reply.code,item.code);assert.equal(reply.message,item.message);}
  else if(input.op==='linear'){
   assert.equal(reply.resolved,true,item.name);assert.equal(reply.executionFailure,false,item.name);assert.equal(reply.status,item.expected.status,item.name);
   if(reply.status==='SOLVED'){
    assert.equal(reply.ok,true,item.name);if('objective'in item.expected)near(reply.objectiveKgM2,item.expected.objective,item.name);
    if(item.expected.translations)reply.translations.forEach((t,i)=>t.u.forEach((v,j)=>near(v,item.expected.translations[i][j],item.name)));
    if('mask'in item.expected)assert.equal(reply.activeMask,item.expected.mask,item.name);if(item.expected.gapActive)assert.ok(reply.lambdaKgM[1]>0,item.name);
    for(const value of Object.values(reply.certificateExact))assert.equal(value,'0/1',item.name);assert.equal(reply.stationarityResidualExactKgM,'0/1',item.name);
   }
   if(item.expected.singularMask)assert.ok(reply.singularMasks.length>0,item.name);
  }else{
   assert.equal(reply.resolved,true,item.name);assert.equal(reply.executionFailure,false,item.name);assert.equal(reply.ok,!item.expected.qualityFailure,item.name);
   assert.ok(finite(reply.metrics.precisionMaxDifferenceM,item.name)<=1e-25);
   const result=reply.reference.selection;
   if('boundM'in item.expected)near(result.boundM,item.expected.boundM,item.name);if('candidateIndex'in item.expected)assert.equal(result.candidateIndex,item.expected.candidateIndex,item.name);
   if(item.expected.multipleTies)assert.ok(result.ambiguity.withinDiagnosticTieToleranceCandidateIndices.length>1,item.name);
   if(item.expected.skipped)assert.deepEqual(result.ambiguity.skippedCandidateIndices,item.expected.skipped,item.name);
   if(item.expected.nearParallelSkipped)assert.ok(result.candidates.some(c=>c.rawAxisLength>0&&c.rawAxisLength<1e-12&&c.skippedByOriginalCutoff),item.name);
   if('rowAgreement'in item.expected)assert.equal(reply.metrics.rowAgreement,item.expected.rowAgreement,item.name);
  }
  receipts.push({name:item.name,reply,syntheticReferenceControl:true});
 }
 const input=query(),first=await ask(input),pristine=structuredClone(first);first.reference.selection.normal[0]=99;first.reference.raw.candidates[0].marginM=99;
 assert.deepEqual(await ask(query()),pristine,'detached query reply copies');
 return {receipts,copyIsolation:true,worldCreated:false,worldStepped:false,archivedPhysicalCases:0};
}
export const controls=runReferenceControls;
