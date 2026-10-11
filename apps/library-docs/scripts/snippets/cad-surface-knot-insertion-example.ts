import {
  insertSourceSurfaceKnot, validateSourceSurfaceKnotInsertion, evaluateSurface, surfaceDomain,
  SourceSurfaceKnotInsertionError,
} from '@barocss/cad';
import type { SourceSurfaceKnotInsertionRequest } from '@barocss/cad';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export const originalSource = [
  '/* 설계 π: preserve the complete mixed source and original domains. */',
  '@model sheet_refinement { version: 0; length-unit: mm;',
  '  @curve #keep_line { type: nurbs; degree: 1;',
  '    knots: [-1.000,-1,1,1.00]; control-points: [[-0,-4,0],[10,-4,0]]; weights: [1,1]; }',
  '  @surface #quarter_sheet { type: nurbs; degree-u: 2; degree-v: 1;',
  '    knots-u: [2.000,2,2,7,7.0,7]; knots-v: [-1,-1,3,3];',
  '    control-points: [[[20,0,0],[20,0,30]],[[20,20,0],[20,20,30]],[[0,20,0],[0,20,30]]];',
  '    weights: [[1,1],[0.7071067811865476,0.7071067811865476],[1,1]]; }',
  '  @surface #keep_plane { type: nurbs; degree-u: 1; degree-v: 1;',
  '    knots-u: [0.000,0,1,1.00]; knots-v: [-1,-1,2,2];',
  '    control-points: [[[2,3,-0],[2,5,1]],[[4,3,2],[4,5,4]]]; weights: [[1,2],[3,4]]; }',
  '  /* Keep Ω, CRLF and every nonselected field. */',
  '}',
].join('\r\n') + '\r\n';
export const request: SourceSurfaceKnotInsertionRequest = {
  source:originalSource,sourceVersion:0,surfaceId:'quarter_sheet',axis:'u',knot:4.5,maximumObservations:1024,
};
/** Ordinary public complete-source Surface refinement and whole validation. */
export function refineQuarterSheet(input: SourceSurfaceKnotInsertionRequest) {
  const result = insertSourceSurfaceKnot(input);
  const validatedReport = validateSourceSurfaceKnotInsertion(result);
  return {result,validatedReport};
}

// Maintainer evidence only; not a public CAD document codec.
function nativeJSON(value: unknown): string {
  if(typeof value==='number') {assert.ok(Number.isFinite(value));return Object.is(value,-0)?'-0':JSON.stringify(value);}
  if(value===null||typeof value==='boolean'||typeof value==='string') return JSON.stringify(value);
  if(Array.isArray(value)) return '['+value.map(nativeJSON).join(',')+']';
  assert.ok(value&&typeof value==='object');
  return '{'+Object.entries(value).filter(([,child])=>child!==undefined)
    .map(([key,child])=>JSON.stringify(key)+':'+nativeJSON(child)).join(',')+'}';
}
const evidencePath='evidence/cad-surface-knot-insertion-consumer.json';
const previous=await readFile(evidencePath,'utf8').then(JSON.parse).catch(error=>{
  if(error.code==='ENOENT') return null;
  throw error;
});
const failedCandidates=previous?.failedCandidates??[];
try {
  const requestBefore=structuredClone(request);
  const {result,validatedReport}=refineQuarterSheet(request);
  assert.deepEqual(request,requestBefore);assert.deepEqual(validatedReport,result.report);
  assert.notStrictEqual(validatedReport,result.report);assert.notStrictEqual(result.request,request);
  const domains={u:[2,7],v:[-1,3]};
  assert.deepEqual(surfaceDomain(result.originalSurface),domains);assert.deepEqual(surfaceDomain(result.surface),domains);
  assert.equal(result.originalSurface.id,'quarter_sheet');assert.equal(result.surface.id,'quarter_sheet');
  assert.equal(result.surface.degreeU,2);assert.equal(result.surface.degreeV,1);
  assert.deepEqual(result.report.grids,{original:{u:3,v:2,total:6},refined:{u:4,v:2,total:8}});
  assert.deepEqual(result.report.knotCounts,{original:{u:6,v:4},refined:{u:7,v:4}});
  assert.deepEqual(result.surface.knotsU,[2,2,2,4.5,7,7,7]);
  assert.deepEqual(result.surface.knotsV,result.originalSurface.knotsV);
  assert.deepEqual(result.provenance.parameterMap,{kind:'identity',formula:'u=s;v=t',uD1Factor:1,vD1Factor:1});
  assert.equal(result.provenance.axis,'u');assert.equal(result.provenance.strips.length,2);
  assert.equal(result.report.selectedObjectIndex,1);
  assert.deepEqual(result.originalModel.objects.map(object=>object.id),['keep_line','quarter_sheet','keep_plane']);
  assert.deepEqual(result.model.objects.map(object=>object.id),['keep_line','quarter_sheet','keep_plane']);
  const expectedModel=structuredClone(result.originalModel);expectedModel.objects[1]=structuredClone(result.surface);
  assert.deepEqual(result.model,expectedModel);assert.equal(result.model.version,0);assert.equal(result.model.lengthUnit,'mm');
  assert.deepEqual(result.model.objects[0],result.originalModel.objects[0]);assert.deepEqual(result.model.objects[2],result.originalModel.objects[2]);
  assert.ok(Object.is(result.model.objects[0].controlPoints[0][0],-0));
  assert.ok(Object.is(result.model.objects[2].controlPoints[0][0][2],-0));
  assert.notStrictEqual(result.originalSurface,result.originalModel.objects[1]);
  assert.notStrictEqual(result.surface,result.model.objects[1]);
  const patches=result.provenance.patches;
  assert.equal(patches.length,3);assert.deepEqual(patches.map(patch=>patch.field),['knots-u','control-points','weights']);
  let patched=originalSource;
  for(const patch of [...patches].reverse()) {
    assert.equal(originalSource.slice(patch.startUTF16,patch.endUTF16),patch.originalText);
    patched=patched.slice(0,patch.startUTF16)+patch.replacementText+patched.slice(patch.endUTF16);
  }
  assert.equal(patched,result.source);
  let before=0,after=0;
  for(const patch of patches) {
    const untouched=originalSource.slice(before,patch.startUTF16);
    assert.equal(result.source.slice(after,after+untouched.length),untouched);
    after+=untouched.length+patch.replacementText.length;before=patch.endUTF16;
  }
  assert.equal(result.source.slice(after),originalSource.slice(before));
  assert.equal(result.report.priorMultiplicity,0);assert.equal(result.report.refinedMultiplicity,1);
  assert.equal(result.report.quality.globalShapeErrorCertified,false);assert.equal(result.report.quality.solid,false);
  const counts=result.report.directCounts;
  assert.equal(counts.coefficientInsertionCallCount,2);
  assert.equal(counts.observationCount,result.report.observations.length);
  assert.equal(counts.surfaceD0Count,2*result.report.observations.length);
  assert.equal(counts.surfaceD1AttemptCount,2*result.report.observations.length);
  assert.ok(result.report.maximumPointDifferenceMM<=result.report.limits.maximumPointDifferenceMM);
  assert.ok(result.report.maximumRelativeDuDifference<=result.report.limits.maximumRelativeDerivativeDifference);
  assert.ok(result.report.maximumRelativeDvDifference<=result.report.limits.maximumRelativeDerivativeDifference);
  const stableResult=structuredClone(result);
  request.knot=5;assert.equal(result.request.knot,4.5);request.knot=4.5;
  let applicationD0Calls=0;
  const samples=Array.from({length:17},(_,uIndex)=>Array.from({length:9},(_,vIndex)=>{
    const u=2+5*uIndex/16,v=-1+4*vIndex/8;
    const originalPointMM=evaluateSurface(result.originalSurface,u,v);applicationD0Calls++;
    const refinedPointMM=evaluateSurface(result.surface,u,v);applicationD0Calls++;
    return{u,v,originalPointMM,refinedPointMM};
  })).flat();
  assert.equal(samples.length,153);assert.equal(applicationD0Calls,306);
  const maximumGridPointDifferenceMM=Math.max(...samples.map(sample=>Math.hypot(...sample.originalPointMM.map((value,index)=>value-sample.refinedPointMM[index]))));
  assert.ok(maximumGridPointDifferenceMM<=1e-7);
  const centerSample=samples[8*9+4];assert.equal(centerSample.u,4.5);assert.equal(centerSample.v,1);
  let accepted=result;const acceptedReference=result;
  let endpointError;try{accepted=insertSourceSurfaceKnot({...request,knot:2});}catch(error){endpointError=error;}
  assert.ok(endpointError instanceof SourceSurfaceKnotInsertionError);assert.equal(endpointError.code,'REQUEST');
  assert.strictEqual(accepted,acceptedReference);assert.deepEqual(accepted,stableResult);
  const tampered=structuredClone(result);tampered.report.patchCount=2;
  let ownedError;try{validateSourceSurfaceKnotInsertion(tampered);}catch(error){ownedError=error;}
  assert.ok(ownedError instanceof SourceSurfaceKnotInsertionError);assert.equal(ownedError.code,'OWNED');
  assert.strictEqual(accepted,acceptedReference);assert.deepEqual(accepted,stableResult);
  assert.deepEqual(JSON.parse(nativeJSON(result)),result);
  const receipt={status:'passed',nodeVersion:process.version,originalSource,refinedSource:result.source,
    originalSourceSHA256:createHash('sha256').update(originalSource).digest('hex'),refinedSourceSHA256:createHash('sha256').update(result.source).digest('hex'),
    request,result,validatedReport,failedCandidates,
    validationScope:{validCompleteValidatorCalls:1,tamperedCompleteValidatorCalls:1,publicValidatorColdReconstructs:true,
      returnedDirectCountsArePerProviderConstruction:true,inheritedKernelCompilerWorkExcluded:true},
    applicationCalls:{insertSourceSurfaceKnot:2,validateSourceSurfaceKnotInsertion:2,surfaceDomain:2,evaluateSurfaceD0:306,evaluateSurfaceD1:0},
    visualization:{originalSurface:result.originalSurface,refinedSurface:result.surface,samples,domains,axis:'u',knot:4.5,
      grid:{countU:17,countV:9,ordering:'u-major-v-minor'},unit:'mm',applicationD0Calls,maximumGridPointDifferenceMM,
      centerSample,knotStations:samples.filter(sample=>sample.u===4.5),globalShapeCertificate:false},
    refusals:[{candidate:'endpoint U2',name:endpointError.name,code:endpointError.code,message:endpointError.message},
      {candidate:'complete report patchCount tamper',name:ownedError.name,code:ownedError.code,message:ownedError.message}],
    numericEvidencePolicy:'Maintainer finite JSON retains numeric literal -0 from first write; not a new public CAD codec',
    wholeModelsAndUnselectedObjectsPreserved:true,untouchedSourceSpansVerified:true,nonselectedKnotsPreserved:true,
    callerInputUnchanged:true,independentPublicCopies:true,acceptedReferenceAndValueRetained:true,actualGL:false,
    executions:[{execution:1,status:'passed',scope:'One selected Surface CPU flow; no provider campaign'}],
    scope:'One public complete-source U knot insertion/whole validation and bounded endpoint/owned refusals. Separate17x9 paired grid/306 application D0 calls for illustration; no global shape proof, mesh, renderer, project codec or old Curve consumer replay.',
  };
  await writeFile(evidencePath,nativeJSON(receipt)+'\n');
  console.log(JSON.stringify({status:receipt.status,sourceSizes:result.report.sourceSizes,grids:result.report.grids,
    knotCounts:result.report.knotCounts,domains:result.report.domain,stations:result.report.stations,providerCounts:counts,
    maximumPointDifferenceMM:result.report.maximumPointDifferenceMM,
    maximumRelativeDuDifference:result.report.maximumRelativeDuDifference,maximumRelativeDvDifference:result.report.maximumRelativeDvDifference,
    applicationD0Calls,maximumGridPointDifferenceMM,centerSample,refusals:receipt.refusals.map(error=>error.code)}));
}catch(error){
  await writeFile(evidencePath,nativeJSON({status:'failed',nodeVersion:process.version,originalSource,request,
    failedCandidates:[...failedCandidates,{name:error.name,code:error.code,message:error.message,stack:error.stack}]})+'\n');
  throw error;
}
