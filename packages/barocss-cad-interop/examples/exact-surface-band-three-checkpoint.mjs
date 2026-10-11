import {validateExactSurfaceBandTrim,ExactSurfaceBandTrimError} from '@barocss/cad';
import {assertSame,negativeZeroPaths,requireOriginalWorldSourceBinding} from './exact-surface-band-three-fixture.mjs';

const need=(value,message)=>{if(!value)throw new Error(message);};
function refs(value,set=new Set()){if(value&&typeof value==='object'&&!set.has(value)){set.add(value);for(const child of Object.values(value))refs(child,set);}return set;}
function separate(a,b){const ar=refs(a),br=refs(b);for(const item of ar)need(!br.has(item),'Independent whole native/report copies share mutable data');}
function matching(native,counts,events,label,positive){counts.matchingAttempts=(counts.matchingAttempts??0)+1;try{const report=validateExactSurfaceBandTrim(native);counts.matchingAccepted=(counts.matchingAccepted??0)+1;events.push({event:'whole-validation-returned',label,positive});return report;}catch(value){counts.matchingRefused=(counts.matchingRefused??0)+1;events.push({event:'whole-validation-threw',label,positive,name:value?.name??null,code:value?.code??null});throw value;}}
function checkOracle(native,oracle){if(oracle===null)return;assertSame(oracle.projection,native.proof.projection,'Original projection oracle');assertSame(oracle.band,native.proof.band,'Original band oracle');assertSame(oracle.connectors,native.proof.connectors,'Original connector oracle');assertSame(oracle.faceEmbedding,native.proof.faceEmbedding,'Original embedding oracle');
 const cuts=native.proof.cutBindings.map(binding=>binding.spans.map(span=>({index:span.index,domain:span.domain,originalPoleIndices:span.originalPoleIndices,pcurvePoleIndices:span.pcurvePoleIndices,worldPoleIndices:span.worldPoleIndices,comparisonDegree:span.degree,betaCoefficients:span.betaCoefficients,composed:span.composedCartesian,storedElevated:span.elevatedWorldCartesian,residuals:span.residuals})));assertSame(oracle.cuts,cuts,'Corresponding original cut oracle fields');
}
export function qualifyOriginalAsset(asset,counts,events){
 const source=requireOriginalWorldSourceBinding(asset),inputBefore=structuredClone(asset.native),native=structuredClone(asset.native),copyB=structuredClone(asset.native);separate(native,asset.native);separate(copyB,native);
 const actualReport=matching(native,counts,events,asset.key,true),validationReport=structuredClone(actualReport);assertSame(native,inputBefore,'Matching did not mutate supplied native');assertSame(asset.native,inputBefore,'Caller original retained');assertSame(validationReport,inputBefore.report,'Independent actual report');separate(native,actualReport);separate(actualReport,validationReport);separate(native,validationReport);checkOracle(native,asset.oracle);
 const previous=copyB.world.source;copyB.world.source=previous+' ';assertSame(native,inputBefore,'Caller B mutation isolation');assertSame(validationReport,inputBefore.report,'Caller B report isolation');copyB.world.source=previous;assertSame(copyB,inputBefore,'Caller B restored');
 const readout={native,validationReport,source,originalText:asset.originalText,oracle:structuredClone(asset.oracle),signPaths:negativeZeroPaths(native)};
 return{key:asset.key,asset,native,validationReport,source,readout,signPaths:readout.signPaths,copyWitness:{independent:true,callerBIsolated:true,callerBRestored:true}};
}
export async function runNativeControls(asset,{counts,events,before,after,raw}){
 const source=asset.native.world.source,controls=[
  {name:'native-world-source',mutate(value){value.world.source=source+' ';}},
  {name:'native-loop-sense',mutate(value){need(value.loop.uses[0].sense==='forward','Original MAIN sense differs');value.loop.uses[0].sense='reverse';}},
  {name:'native-false-solid',mutate(value){need(value.report.quality.solid===false,'Original solid flag differs');value.report.quality.solid=true;}},
  {name:'native-world-getter',getter:true,mutate(value){Object.defineProperty(value.world,'source',{enumerable:true,configurable:true,get(){counts.getterCalls++;return source;}});}},
 ];
 const receipts=[];for(const control of controls){const baseline=await before(control.name),value=structuredClone(asset.native),descriptor=Object.getOwnPropertyDescriptor(value.world,'source');control.mutate(value);let threw=false,error;
  try{matching(value,counts,events,control.name,false);}catch(cause){threw=true;error=cause;}finally{if(control.getter)Object.defineProperty(value.world,'source',descriptor);}
  const receipt={name:control.name,threw,error,getterCalls:counts.getterCalls,acceptedRetained:false};receipts.push(receipt);await raw(receipt);
  need(threw&&error instanceof ExactSurfaceBandTrimError&&error.code==='OWNED','Actual native refusal differs');need(error.message===('Exact original Surface band trim: '+(control.getter?'Bounded fields without getters/symbols/hidden data are required':'Owned original bindings/World/UV/incidence/orientation/band/projection/source/native observations/counters changed')),'Actual native refusal message differs');need(!Object.hasOwn(error,'cause'),'Measured native mismatch cause presence differs');need(counts.getterCalls===0,'Native getter executed');await after(receipt,baseline);receipt.acceptedRetained=true;
 }
 return receipts;
}
