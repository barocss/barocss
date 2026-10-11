import {
  insertSourceCurveKnot, validateSourceCurveKnotInsertion, evaluateCurve, curveDomain,
  SourceCurveKnotInsertionError,
} from '@barocss/cad';
import type { SourceCurveKnotInsertionRequest } from '@barocss/cad';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export const originalSource = [
  '/* 설계 π: retain the complete mixed Model and original spelling. */',
  '@model quarter_refinement { version: 0; length-unit: mm;',
  '  @curve #keep_line { type: nurbs; degree: 1;',
  '    knots: [-1.000,-1,1,1.00]; control-points: [[-0,-4,0],[10,-4,0]]; weights: [1,1]; }',
  '  /* Insert inside the original quarter Curve domain, not normalized UV. */',
  '  @curve #quarter { type: nurbs; degree: 2;',
  '    knots: [2.000,2,2,7,7.0,7];',
  '    control-points: [[20.0,+0,0],[20,20.00,0],[0,20,0]];',
  '    weights: [1.0,0.7071067811865476,1]; }',
  '  @surface #keep_plane { type: nurbs; degree-u: 1; degree-v: 1;',
  '    knots-u: [0.000,0,1,1.00]; knots-v: [-1,-1,2,2];',
  '    control-points: [[[2,3,-0],[2,5,1]],[[4,3,2],[4,5,4]]]; weights: [[1,2],[3,4]]; }',
  '  /* Keep Ω, CRLF and both unrelated objects. */',
  '}',
].join('\r\n') + '\r\n';
export const request: SourceCurveKnotInsertionRequest = {
  source:originalSource,sourceVersion:0,curveId:'quarter',knot:4.5,maximumObservations:128,
};
/** Ordinary public source-backed refinement and complete result validation. */
export function refineQuarterCurve(input: SourceCurveKnotInsertionRequest) {
  const result = insertSourceCurveKnot(input);
  const validatedReport = validateSourceCurveKnotInsertion(result);
  return {result,validatedReport};
}

const evidencePath = 'evidence/cad-curve-knot-insertion-consumer.json';
const previousText = await readFile(evidencePath,'utf8').catch(error=>{
  if(error.code==='ENOENT') return null;
  throw error;
});
const previous = previousText === null ? null : JSON.parse(previousText);
const failedCandidates = previous?.failedCandidates ?? [];
// Maintainer evidence only. This is not a public CAD file codec.
function nativeJSON(value: unknown): string {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value)); return Object.is(value,-0) ? '-0' : JSON.stringify(value);
  }
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return '['+value.map(nativeJSON).join(',')+']';
  assert.ok(value && typeof value === 'object');
  return '{'+Object.entries(value).filter(([,child])=>child !== undefined)
    .map(([key,child])=>JSON.stringify(key)+':'+nativeJSON(child)).join(',')+'}';
}
const executions = previous?.executions ?? (previous === null ? [] : [{
  execution:1,status:previous.status,runtimeNumericalChecks:previous.status === 'passed' ? 'passed' : 'failed',
  serialization:previous.result ? 'JSON.stringify normalized numeric negative zero' : 'No accepted result artifact',
  savedOriginalSiblingNegativeZero:previous.result ? [
    Object.is(previous.result.originalModel.objects[0].controlPoints[0][0],-0),
    Object.is(previous.result.originalModel.objects[2].controlPoints[0][0][2],-0),
  ] : null,
  receiptSHA256:createHash('sha256').update(previousText).digest('hex'),
  originalReceiptText:previousText,
}]);
try {
  const requestBefore = structuredClone(request);
  const {result,validatedReport} = refineQuarterCurve(request);
  assert.deepEqual(request,requestBefore);assert.deepEqual(validatedReport,result.report);
  assert.notStrictEqual(validatedReport,result.report);assert.notStrictEqual(result.request,request);
  assert.deepEqual(result.originalModel.objects.map(o=>o.id),['keep_line','quarter','keep_plane']);
  assert.deepEqual(result.model.objects.map(o=>o.id),['keep_line','quarter','keep_plane']);
  assert.equal(result.originalModel.name,'quarter_refinement');assert.equal(result.model.version,0);
  assert.equal(result.model.lengthUnit,'mm');assert.equal(result.report.selectedObjectIndex,1);
  assert.deepEqual(result.originalCurve,{kind:'curve',id:'quarter',degree:2,knots:[2,2,2,7,7,7],
    controlPoints:[[20,0,0],[20,20,0],[0,20,0]],weights:[1,0.7071067811865476,1]});
  assert.equal(result.curve.degree,2);assert.equal(result.curve.id,result.originalCurve.id);
  assert.deepEqual(result.curve.knots,[2,2,2,4.5,7,7,7]);
  assert.equal(result.originalCurve.controlPoints.length,3);assert.equal(result.curve.controlPoints.length,4);
  assert.deepEqual(curveDomain(result.originalCurve),[2,7]);assert.deepEqual(curveDomain(result.curve),[2,7]);
  assert.deepEqual(result.provenance.parameterMap,{kind:'identity',formula:'u=t',d1Factor:1});
  const completeExpectedModel=structuredClone(result.originalModel);
  completeExpectedModel.objects[1]=structuredClone(result.curve);
  assert.deepEqual(result.model,completeExpectedModel);
  assert.deepEqual(result.model.objects[0],result.originalModel.objects[0]);
  assert.deepEqual(result.model.objects[2],result.originalModel.objects[2]);
  assert.ok(Object.is(result.model.objects[0].controlPoints[0][0],-0));
  assert.ok(Object.is(result.model.objects[2].controlPoints[0][0][2],-0));
  assert.notStrictEqual(result.originalCurve,result.originalModel.objects[1]);
  assert.notStrictEqual(result.curve,result.model.objects[1]);
  assert.notStrictEqual(result.originalModel.objects[0],result.model.objects[0]);
  const patches=result.provenance.patches;
  assert.equal(patches.length,3);assert.deepEqual(patches.map(p=>p.field),['knots','control-points','weights']);
  let rebuiltSource=originalSource;
  for(const patch of [...patches].reverse()) {
    assert.equal(originalSource.slice(patch.startUTF16,patch.endUTF16),patch.originalText);
    rebuiltSource=rebuiltSource.slice(0,patch.startUTF16)+patch.replacementText+rebuiltSource.slice(patch.endUTF16);
  }
  assert.equal(rebuiltSource,result.source);
  let originalOffset=0,candidateOffset=0;
  for(const patch of patches) {
    const untouched=originalSource.slice(originalOffset,patch.startUTF16);
    assert.equal(result.source.slice(candidateOffset,candidateOffset+untouched.length),untouched);
    candidateOffset+=untouched.length+patch.replacementText.length;originalOffset=patch.endUTF16;
  }
  assert.equal(result.source.slice(candidateOffset),originalSource.slice(originalOffset));
  assert.equal(result.report.patchCount,3);assert.equal(result.report.priorMultiplicity,0);
  assert.equal(result.report.refinedMultiplicity,1);
  assert.ok(result.report.maximumPointDifferenceMM<=result.report.limits.maximumPointDifferenceMM);
  assert.ok(result.report.maximumRelativeDerivativeDifference<=result.report.limits.maximumRelativeDerivativeDifference);
  assert.equal(result.report.quality.globalShapeErrorCertified,false);assert.equal(result.report.quality.solid,false);
  assert.equal(result.report.directCounts.observationCount,result.report.observations.length);
  assert.equal(result.report.directCounts.curveD0Count,2*result.report.observations.length);
  assert.equal(result.report.directCounts.curveD1AttemptCount,2*result.report.observations.length);
  const stableResult=structuredClone(result);
  request.knot=5;assert.equal(result.request.knot,4.5);request.knot=4.5;
  const originalDomain=result.report.domain;
  let applicationD0Calls=0;
  const samples=Array.from({length:65},(_,index)=>{
    const parameter=originalDomain[0]+(originalDomain[1]-originalDomain[0])*index/64;
    const originalPointMM=evaluateCurve(result.originalCurve,parameter);applicationD0Calls++;
    const refinedPointMM=evaluateCurve(result.curve,parameter);applicationD0Calls++;
    return{parameter,originalPointMM,refinedPointMM};
  });
  assert.equal(applicationD0Calls,130);assert.equal(samples[32].parameter,4.5);
  const maximumGridPointDifferenceMM=Math.max(...samples.map(sample=>Math.hypot(...sample.originalPointMM.map((n,i)=>n-sample.refinedPointMM[i]))));
  assert.ok(maximumGridPointDifferenceMM<=1e-7);
  let accepted=result;const acceptedReference=result;
  let endpointError;
  try{accepted=insertSourceCurveKnot({...request,knot:2});}catch(error){endpointError=error;}
  assert.ok(endpointError instanceof SourceCurveKnotInsertionError);assert.equal(endpointError.code,'REQUEST');
  assert.strictEqual(accepted,acceptedReference);assert.deepEqual(accepted,stableResult);
  const tampered=structuredClone(result);tampered.report.patchCount=2;
  let ownedError;
  try{validateSourceCurveKnotInsertion(tampered);}catch(error){ownedError=error;}
  assert.ok(ownedError instanceof SourceCurveKnotInsertionError);assert.equal(ownedError.code,'OWNED');
  assert.strictEqual(accepted,acceptedReference);assert.deepEqual(accepted,stableResult);
  const receipt={status:'passed',nodeVersion:process.version,originalSource,refinedSource:result.source,
    originalSourceSHA256:createHash('sha256').update(originalSource).digest('hex'),
    refinedSourceSHA256:createHash('sha256').update(result.source).digest('hex'),
    request,result,validatedReport,
    validationScope:{validCompleteValidatorCalls:1,tamperedCompleteValidatorCalls:1,
      publicValidatorReconstructsFullInsertion:true,returnedReportCountsArePerProviderConstruction:true},
    applicationCalls:{insertSourceCurveKnot:2,validateSourceCurveKnotInsertion:2,curveDomain:2,evaluateCurveD0:applicationD0Calls,evaluateCurveD1:0},
    visualization:{domain:originalDomain,knot:4.5,originalCurve:result.originalCurve,refinedCurve:result.curve,samples,
      maximumGridPointDifferenceMM,knotSample:samples[32],unit:'mm',applicationD0Calls,globalShapeCertificate:false},
    refusals:[{candidate:'endpoint knot2',name:endpointError.name,code:endpointError.code,message:endpointError.message},
      {candidate:'complete report patchCount tamper',name:ownedError.name,code:ownedError.code,message:ownedError.message}],
    failedCandidates,executions:[...executions,{execution:executions.length+1,status:'passed',
      runtimeNumericalChecks:'passed',serialization:'finite numeric literal negative zero retained',
      reason:'Bounded evidence precision repair; no native numerical candidate or cap change'}],
    numericEvidencePolicy:'Maintainer-only finite JSON numbers preserve literal -0; no tagged values or public file codec',
    callerInputUnchanged:true,independentPublicCopies:true,untouchedSourceSpansVerified:true,
    wholeModelsAndUnselectedObjectsPreserved:true,acceptedReferenceAndValueRetained:true,actualGL:false,
    scope:'One public source-backed insertion and complete validation with bounded endpoint/complete-owned refusals; separate65-station/130-D0 application illustration. Provider directCounts exclude inherited work and do not describe the full consumer or its validation replays.',
  };
  assert.deepEqual(JSON.parse(nativeJSON(result)),result);
  await writeFile(evidencePath,nativeJSON(receipt)+'\n');
  console.log(JSON.stringify({status:receipt.status,sourceSizes:result.report.sourceSizes,poles:result.report.poleCounts,
    knots:result.report.knotCounts,domain:result.report.domain,providerCounts:result.report.directCounts,
    maximumPointDifferenceMM:result.report.maximumPointDifferenceMM,
    maximumRelativeDerivativeDifference:result.report.maximumRelativeDerivativeDifference,
    applicationD0Calls,maximumGridPointDifferenceMM,refusals:receipt.refusals.map(e=>e.code)}));
}catch(error){
  await writeFile(evidencePath,nativeJSON({status:'failed',nodeVersion:process.version,originalSource,request,
    executions,failedCandidates:[...failedCandidates,{name:error.name,code:error.code,message:error.message,stack:error.stack}]})+'\n');
  throw error;
}
