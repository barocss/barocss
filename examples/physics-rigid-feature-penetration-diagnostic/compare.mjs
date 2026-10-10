import assert from 'node:assert/strict';
export const DEPTH_TOLERANCE_M=1e-12;
export function compareObservation(observation,reference,{requireNormalizedDepthAgreement=true}={}){
 assert.ok(reference.ok===true||reference.code==='REFERENCE_PRECISION',JSON.stringify(reference));
 const precisionAgrees=reference.ok===true&&reference.precisionMaxDifferenceM<=1e-25;
 const normalizedDepthAgrees=!requireNormalizedDepthAgreement||reference.rawNormalizedDepthDifferenceM<=1e-12;
 const {hit,selection}=observation;
 let selectorBitsAgree=(hit===null)===(selection===null);
 if(hit&&selection){for(const field of ['normal','pointM'])selectorBitsAgree=selectorBitsAgree&&selection.hit[field].length===hit[field].length&&hit[field].every((v,i)=>Object.is(v,selection.hit[field][i]));selectorBitsAgree=selectorBitsAgree&&Object.is(selection.hit.penetration,hit.penetration);}
 const deltaM=Math.abs((hit?.penetration??0)-reference.raw.depthM);
 const independentClass=reference.raw.marginM<0?'separated':reference.raw.marginM===0?'touching':'overlap';
 const originalThresholdClass=reference.raw.marginM < -1e-12?'null':'hit';
 const separationAgrees=(hit===null?'null':'hit')===originalThresholdClass;
 return {selectorBitsAgree,deltaM,separationAgrees,depthAgrees:deltaM<=DEPTH_TOLERANCE_M,precisionAgrees,normalizedDepthAgrees,independentClass,originalThresholdClass,originalSeparationToleranceM:1e-12};
}
