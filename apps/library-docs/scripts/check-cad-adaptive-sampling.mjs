// Maintainer-only selected public sampling flow; no browser drawing.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleCadAdaptiveSampling } from './build-cad-adaptive-sampling.mjs';

const app=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const preset=JSON.parse(await readFile(resolve(app,'scripts/snippets/cad-adaptive-sampling.json'),'utf8'));
const evidence=resolve(app,'evidence/cad-adaptive-sampling-consumer.json');
const previous=await readFile(evidence,'utf8').then(JSON.parse).catch(error=>{
  if(error.code==='ENOENT')return null;
  throw error;
});
const failures=previous?.failedCandidates??[];
function nativeJSON(value){
  if(typeof value==='number'){assert.ok(Number.isFinite(value));return Object.is(value,-0)?'-0':JSON.stringify(value);}
  if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(nativeJSON).join(',')+']';
  assert.ok(value&&typeof value==='object');
  return '{'+Object.entries(value).filter(([,child])=>child!==undefined).map(([key,child])=>JSON.stringify(key)+':'+nativeJSON(child)).join(',')+'}';
}
const consumerText=`
import assert from 'node:assert/strict';
import { sampleSourceCurveAdaptive, validateSourceCurveAdaptive, SourceCurveAdaptiveSamplingError } from '@barocss/cad';
const request=${JSON.stringify(JSON.parse(preset.source))},beforeRequest=structuredClone(request);
const fine=sampleSourceCurveAdaptive(request);
assert.deepEqual(request,beforeRequest);assert.equal(fine.curve.degree,5);assert.deepEqual(fine.domain,[-3,5]);
assert.equal(fine.report.originalSpanCount,3);assert.deepEqual(fine.originalModel.objects.map(object=>object.id),['weighted_quintic','keep_line','keep_plane']);
assert.equal(fine.originalModel.version,0);assert.equal(fine.originalModel.lengthUnit,'mm');
const coarseRequest=structuredClone(request);coarseRequest.options.chordToleranceMM=.2;
const beforeCoarseRequest=structuredClone(coarseRequest),coarse=sampleSourceCurveAdaptive(coarseRequest);
assert.deepEqual(coarseRequest,beforeCoarseRequest);assert.deepEqual(coarse.originalModel,fine.originalModel);assert.deepEqual(coarse.curve,fine.curve);
assert.notStrictEqual(coarse.originalModel,fine.originalModel);assert.notStrictEqual(coarse.curve,fine.curve);
assert.equal(coarse.request.source,fine.request.source);assert.ok(coarse.report.segmentCount<=fine.report.segmentCount);
const validatedReport=validateSourceCurveAdaptive(coarse);assert.deepEqual(validatedReport,coarse.report);assert.notStrictEqual(validatedReport,coarse.report);
function checkResult(result){
 assert.deepEqual(result.curve,result.originalModel.objects[0]);assert.notStrictEqual(result.curve,result.originalModel.objects[0]);
 assert.ok(Object.is(result.originalModel.objects[1].controlPoints[0][0],-0));assert.ok(Object.is(result.originalModel.objects[2].controlPoints[0][0][2],-0));
 assert.equal(result.samples.length,result.report.pointCount);assert.equal(result.report.pointCount,result.report.segmentCount+1);
 assert.equal(result.samples[0].parameter,-3);assert.equal(result.samples.at(-1).parameter,5);
 assert.ok(result.samples.slice(1).every((sample,index)=>sample.parameter>result.samples[index].parameter));
 const leaves=result.spans.flatMap(span=>span.leaves);assert.equal(leaves.length,result.report.segmentCount);
 leaves.forEach(leaf=>assert.ok(leaf.controlPolygonBoundMM+leaf.arithmeticUncertaintyMM<=result.request.options.chordToleranceMM));
 assert.equal(result.report.quality.geometryAuthority,'original-native-evaluateCurve');assert.equal(result.report.quality.globalErrorCertified,false);
 assert.equal(result.report.quality.topologyCertified,false);assert.equal(result.report.quality.solid,false);
 const counts=result.report.directCounts,L=result.report.segmentCount,S=result.report.originalSpanCount;
 assert.equal(counts.acceptedLeafCount,L);assert.equal(counts.outputPointCount,L+1);assert.equal(counts.curveD0AttemptCount,11*L-2*S+1);
 assert.equal(counts.curveD1AttemptCount,6*L);assert.equal(counts.curveD1EvaluatedCount+counts.curveD1NativeRefusedCount,counts.curveD1AttemptCount);
 return{toleranceMM:result.request.options.chordToleranceMM,segmentCount:L,pointCount:L+1,maximumDepthUsed:result.report.maximumDepthUsed,
  maximumControlPolygonBoundMM:result.report.maximumControlPolygonBoundMM,maximumArithmeticUncertaintyMM:result.report.maximumArithmeticUncertaintyMM,
  maximumObservedOutputChordDistanceMM:result.report.maximumObservedOutputChordDistanceMM,directCounts:counts,delegatedReceipts:result.report.delegatedReceipts,
  originalGuardedParameters:result.report.originalGuardedParameters,quality:result.report.quality};
}
const summaryFine=checkResult(fine),summaryCoarse=checkResult(coarse);
const held=structuredClone(coarse);assert.notStrictEqual(fine.request,request);
request.source='changed caller source';request.options.chordToleranceMM=.9;
assert.deepEqual(fine.request,beforeRequest);assert.deepEqual(coarse,held);
request.source=beforeRequest.source;request.options.chordToleranceMM=beforeRequest.options.chordToleranceMM;
let accepted=coarse;const reference=accepted,refusals=[];
for(const [name,options,code] of [
 ['zero chord tolerance',{...coarseRequest.options,chordToleranceMM:0},'INPUT'],
 ['leaf budget below three original spans',{...coarseRequest.options,maxSegments:2},'BUDGET'],
]){
 let error;try{accepted=sampleSourceCurveAdaptive({...coarseRequest,options});}catch(value){error=value;}
 assert.ok(error instanceof SourceCurveAdaptiveSamplingError);assert.equal(error.code,code);assert.strictEqual(accepted,reference);assert.deepEqual(accepted,held);
 refusals.push({name,options,code:error.code,message:error.message});
}
const ownedCopy=structuredClone(coarse);ownedCopy.samples[0].pointMM[0]+=1;
let ownedError;try{validateSourceCurveAdaptive(ownedCopy);}catch(error){ownedError=error;}
assert.ok(ownedError instanceof SourceCurveAdaptiveSamplingError);assert.equal(ownedError.code,'OWNED');
assert.strictEqual(accepted,reference);assert.deepEqual(coarse,held);
refusals.push({name:'complete sampled point tamper',code:ownedError.code,message:ownedError.message});
export const receipt={request,coarseRequest,fine,coarse,validatedReport,summaryFine,summaryCoarse,refusals,
 wholeValidator:{validCalls:1,tamperedCalls:1,coldReconstruction:true,directCountsArePerSamplingConstruction:true},
 applicationCalls:{sampleSourceCurveAdaptive:4,validateSourceCurveAdaptive:2,evaluateCurveD0:0,evaluateCurveD1:0},
 originalSourceAndCompleteModelPreserved:true,independentMutablePublicCopies:true,callerInputsUnchanged:true,acceptedReferenceAndValuesRetained:true,
 interpretation:'Tolerance edits replace derived display samples only; original native Curve, source and all three Model objects stay unchanged. Counts describe sampling constructors separately from delegated work and the whole validator.',
 actualGL:false,actualBrowser:false,packageCanvas2D:false,
 visualization:{projection:'x+0.4z,y+0.6z',curve:coarse.curve,domain:coarse.domain,
  fineSamples:fine.samples,coarseSamples:coarse.samples,geometryAuthority:'actual original native evaluateCurve',globalErrorCertificate:false}};
`;
let provenance;
try{
  const bundled=await bundleCadAdaptiveSampling(app,'node',consumerText,'cad-adaptive-sampling');
  provenance=bundled.provenance;assert.equal(provenance.sourcePin,preset.sourceProfile);assert.equal(provenance.verifiedBlobs,204);assert.equal(provenance.ownDistInputs,0);
  const {receipt}=await import('data:text/javascript;base64,'+Buffer.from(bundled.result.outputFiles[0].text).toString('base64'));
  const output={status:'passed',nodeVersion:process.version,provenance,failedCandidates:failures,...receipt,
    numericEvidencePolicy:'Maintainer finite JSON preserves literal numeric negative zero from first write; not a public CAD codec'};
  assert.deepEqual(JSON.parse(nativeJSON(output)),output);
  await writeFile(evidence,nativeJSON(output)+'\n');
  const physical=JSON.parse(await readFile(evidence,'utf8'));assert.deepEqual(physical,output);
  console.log(JSON.stringify({status:output.status,provenance,fine:receipt.summaryFine,coarse:receipt.summaryCoarse,refusals:receipt.refusals.map(error=>error.code)}));
}catch(error){
  await writeFile(evidence,nativeJSON({status:'failed',nodeVersion:process.version,source:preset.source,provenance,
    failedCandidates:[...failures,{source:preset.source,name:error.name,code:error.code,message:error.message,stack:error.stack}]})+'\n');
  throw error;
}
