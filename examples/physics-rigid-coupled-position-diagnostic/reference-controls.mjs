import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Importing this module runs no world, solver, detector or reference control.
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
export const coverageGates = freeze({ scalarM:1e-12, rawNormalizedM:1e-12, decimalPrecisionM:'1e-25',
  detectorRawM:1e-12, originalRowM:1e-12, uniquePhysicalAxis:false });
export const coverageErrors = freeze({
  request:'coverage reference requires before, after, translations and explicit row',
  geometry:'coverage reference support geometry changed',identity:'coverage reference pair IDs or kinds changed',
  translation:'coverage reference translation must be a finite 3-vector',
  row:'coverage reference row must name the ordered pair',
  normal:'coverage reference row normal must be finite and unit',
  depth:'coverage reference row depth must be finite and within zero to ten metres',
  number:'reference number must be a finite Float64; bool is invalid',
});
const box = (id,positionM,orientation=[0,0,0,1]) => ({id,kind:'dynamic',
  shape:{kind:'box',halfExtentsM:[.25,.25,.25]},positionM,orientation,
  velocityMps:[0,0,0],angularVelocityRadps:[0,0,0]});
const pair = (a,b) => ({a,b});
const literal = (before,after,aM=[0,0,0],bM=[0,0,0],row=null) => ({before,after,translations:{aM,bM},row});
const noMotion = b => literal(pair(box('a',[0,0,0]),b),pair(box('a',[0,0,0]),structuredClone(b)));
const overlap = noMotion(box('b',[0,.49,0]));
const changed = edit => {const input=structuredClone(overlap);edit(input);return input;};
export const coverageLiteralControls = freeze([
  {name:'unchanged-overlap',input:structuredClone(overlap),expected:{beforeClass:'overlap',afterClass:'overlap',beforeDepthM:.01,afterDepthM:.01}},
  {name:'unchanged-separated',input:noMotion(box('b',[0,.51,0])),expected:{beforeClass:'separated',afterClass:'separated',beforeMarginM:-.01,afterMarginM:-.01}},
  {name:'unchanged-touching',input:noMotion(box('b',[0,.5,0])),expected:{beforeClass:'touching',afterClass:'touching',beforeMarginM:0,afterMarginM:0}},
  {name:'separated-gap-consumed',input:literal(pair(box('a',[0,0,0]),box('b',[0,.51,0])),
    pair(box('a',[0,0,0]),box('b',[0,.49,0])),[0,0,0],[0,-.02,0]),
    expected:{beforeClass:'separated',afterClass:'overlap',beforeMarginM:-.01,afterDepthM:.01}},
  {name:'included-row-clears',input:literal(pair(box('a',[0,0,0]),box('b',[0,.49,0])),
    pair(box('a',[0,0,0]),box('b',[0,.51,0])),[0,0,0],[0,.02,0],{aId:'a',bId:'b',normal:[0,1,0],depthM:.01}),
    expected:{beforeClass:'overlap',afterClass:'separated',rowResidualM:.01}},
  {name:'same-translation-creates-omitted-pair-overlap',input:literal(pair(box('b',[0,.49,0]),box('c',[0,1,0])),
    pair(box('b',[0,.51,0]),box('c',[0,1,0])),[0,.02,0],[0,0,0]),
    expected:{beforeClass:'separated',afterClass:'overlap',beforeMarginM:-.01,afterDepthM:.01}},
  {name:'centre-projection-crosses-zero',input:literal(pair(box('a',[0,0,0]),box('b',[.4,0,0])),
    pair(box('a',[0,0,0]),box('b',[-.4,0,0])),[0,0,0],[-.8,0,0]),
    expected:{beforeDepthM:.1,afterDepthM:.1,signChanged:true}},
  {name:'multiple-ties-and-normal-ambiguity',input:noMotion(box('b',[0,0,0])),
    expected:{beforeDepthM:.5,afterDepthM:.5,multipleTies:true,normalAmbiguous:true}},
  {name:'tiny-nonzero-cross-axis-retained',input:noMotion(box('b',[0,.49,0],[0,5e-14,0,1])),
    expected:{beforeDepthM:.01,afterDepthM:.01,nearParallel:true}},
  {name:'altered-orientation',input:changed(x=>x.after.b.orientation=[0,.1,0,.99498743710662]),error:coverageErrors.geometry},
  {name:'altered-shape',input:changed(x=>x.after.b.shape.halfExtentsM[0]=.26),error:coverageErrors.geometry},
  {name:'altered-ID',input:changed(x=>x.after.b.id='changed'),error:coverageErrors.identity},
  {name:'null-raw-position',input:changed(x=>x.before.a.positionM[0]=null),error:coverageErrors.number},
  {name:'boolean-raw-position',input:changed(x=>x.before.a.positionM[0]=false),error:coverageErrors.number},
  {name:'nonfinite-raw-position-codec',input:changed(x=>x.before.a.positionM[0]=Infinity),error:coverageErrors.number},
  {name:'null-translation',input:changed(x=>x.translations.aM[0]=null),error:coverageErrors.translation},
  {name:'short-translation',input:changed(x=>x.translations.aM.pop()),error:coverageErrors.translation},
  {name:'wrong-row-endpoints',input:changed(x=>x.row={aId:'b',bId:'a',normal:[0,1,0],depthM:.01}),error:coverageErrors.row},
  {name:'nonunit-row-normal',input:changed(x=>x.row={aId:'a',bId:'b',normal:[0,2,0],depthM:.01}),error:coverageErrors.normal},
  {name:'null-row-depth',input:changed(x=>x.row={aId:'a',bId:'b',normal:[0,1,0],depthM:null}),error:coverageErrors.depth},
  {name:'missing-row-is-not-null',input:changed(x=>delete x.row),error:coverageErrors.request},
]);

function finite(value,label){assert.ok(typeof value==='number'&&Number.isFinite(value),`${label}: finite number required`);return value;}
function close(value,expected,label){assert.ok(Math.abs(finite(value,label)-expected)<=1e-12,label);}
export async function runReferenceControls(ask){
  const oldCases=JSON.parse(await readFile(new URL('../physics-rigid-feature-penetration-diagnostic/reference-controls.json',import.meta.url),'utf8'));
  const originalPairReceipts=[];
  for(const item of oldCases){
    const reply=await ask({op:'pair',a:structuredClone(item.a),b:structuredClone(item.b)});
    if(item.invalid){assert.equal(reply.ok,false,item.id);assert.equal(reply.code,item.expectedErrorCode);assert.equal(reply.message,item.expectedErrorMessage);}
    else{assert.equal(reply.ok,true,item.id);assert.ok(finite(reply.precisionMaxDifferenceM,item.id)<=1e-25);
      if('expectedDepthM'in item)close(reply.raw.depthM,item.expectedDepthM,item.id);
      if('expectedMarginM'in item)close(reply.raw.marginM,item.expectedMarginM,item.id);
      if(item.expectedSeparated)assert.equal(reply.raw.separated,true,item.id);
      if(item.expectedTouching)assert.equal(reply.raw.touching,true,item.id);
      if(item.expectedNearParallel)assert.ok(reply.raw.nearParallelAxisCount>0,item.id);
      if(item.expectedNormalizationDifference)assert.ok(reply.rawNormalizedDepthDifferenceM>1e-12,item.id);
      else assert.ok(finite(reply.rawNormalizedDepthDifferenceM,item.id)<=1e-12);
    }
    originalPairReceipts.push({id:item.id,reply,legacyAnalyticControlOnly:true});
  }
  const transitionReceipts=[];
  for(const item of coverageLiteralControls){
    const input=structuredClone(item.input),saved=structuredClone(input),reply=await ask(input);assert.deepEqual(input,saved,item.name);
    if(item.error){assert.equal(reply.ok,false,item.name);assert.equal(reply.code,'REFERENCE_INPUT');assert.equal(reply.message,item.error);}
    else{assert.equal(reply.ok,true,item.name);assert.equal(reply.resolved,true,item.name);
      assert.ok(finite(reply.metrics.precisionMaxDifferenceM,item.name)<=1e-25);
      close(reply.metrics.axisFormulaMaxErrorM,0,item.name);close(reply.metrics.maxRecordedFinalErrorM,0,item.name);
      for(const mode of ['raw','normalized']){const reference=reply.reference[mode],expected=item.expected;
        if(expected.beforeClass)assert.equal(reference.beforeClass,expected.beforeClass,item.name);
        if(expected.afterClass)assert.equal(reference.afterClass,expected.afterClass,item.name);
        for(const [key,where]of [['beforeDepthM',['before','depthM']],['afterDepthM',['after','depthM']],['beforeMarginM',['before','marginM']],['afterMarginM',['after','marginM']]])if(key in expected)close(reference[where[0]][where[1]],expected[key],item.name);
        if(expected.signChanged)assert.ok(reference.axes.some(a=>a.centerProjectionSignChanged),item.name);
        if(expected.multipleTies)assert.ok(reference.before.tiedAxisLabels.length>1,item.name);
        if(expected.normalAmbiguous)assert.equal(reference.before.normalOrientationAmbiguous,true,item.name);
        if(expected.nearParallel)assert.ok(reference.axes.some(a=>a.nearParallel&&!a.exactZero),item.name);
      }
      if('rowResidualM'in item.expected)close(reply.metrics.rowResidualM,item.expected.rowResidualM,item.name);
      else assert.equal(reply.metrics.rowResidualM,null,item.name);
    }
    transitionReceipts.push({name:item.name,reply});
  }
  const legacy=oldCases.find(item=>item.expectedNormalizationDifference),input=noMotion(structuredClone(legacy.b));input.before.a=structuredClone(legacy.a);input.after.a=structuredClone(legacy.a);
  const strict=await ask(input);assert.equal(strict.resolved,true);assert.equal(strict.ok,false);assert.ok(strict.metrics.maxRawNormalizedDepthDifferenceM>1e-12);
  transitionReceipts.push({name:'legacy-normalization-exception-does-not-enter-actual-coverage',reply:strict});
  const original=await ask(structuredClone(overlap)),copy=structuredClone(original);original.reference.raw.axes[0].axis[0]=99;original.reference.raw.before.candidates[0].marginM=99;
  assert.deepEqual(await ask(structuredClone(overlap)),copy,'reply copies are independent');
  transitionReceipts.push({name:'detached-reply-repeat',ok:true});
  return {originalPairReceipts,transitionReceipts,worldCreated:false,worldStepped:false,jsSolvePositionCalled:false};
}
export const controls=runReferenceControls;
