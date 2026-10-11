import {
  evaluateSourceLineWidthExtrusionGraph, updateSourceLineWidthExtrusionGraph,
  serializeSourceLineWidthExtrusionGraph, parseSourceLineWidthExtrusionGraph,
  SourceLineWidthExtrusionGraphError,
} from '@barocss/cad';
import type {
  SourceLineWidthExtrusionGraphV0, SourceLineWidthExtrusionGraphOptions,
  SourceLineWidthExtrusionGraphResult, SourceLineWidthExtrusionGraphUpdateResult,
} from '@barocss/cad';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export const originalSource = [
  '/* 설계: retain the complete original Model and unselected geometry. */',
  '@model width_surface { version: 0; length-unit: mm;',
  '  @curve #untouched_curve { type: nurbs; degree: 2;',
  '    knots: [-2.000,-2,-2,3,3,3]; control-points: [[-0,2,1],[3,4,2],[6,2,1]]; weights: [1,2,1]; }',
  '  @curve #original_line { type: nurbs; degree: 1;',
  '    knots: [0,0,1,1]; control-points: [[0,-0,0],[100,0,0]]; weights: [1,1]; }',
  '  @surface #untouched_surface { type: nurbs; degree-u: 1; degree-v: 1;',
  '    knots-u: [0.000,0,1,1.00]; knots-v: [-1,-1,2,2];',
  '    control-points: [[[2,3,-0],[2,5,1]],[[4,3,2],[4,5,4]]]; weights: [[1,2],[3,4]]; }',
  '}',
].join('\r\n') + '\r\n';

export const document: SourceLineWidthExtrusionGraphV0 = {
  format: 'barocss-source-line-width-extrusion-graph', version: 0,
  id: 'LineWidthGraph', revision: 0, lengthUnit: 'mm',
  sourceFrame: 'authored-xyz-no-axis-conversion',
  asset: { sourceId: 'LineSource', sourceVersion: 0, source: originalSource, curveId: 'original_line' },
  parameters: [
    { id: 'Width', kind: 'length', unit: 'mm', valueMM: 5 },
    { id: 'Height', kind: 'length', unit: 'mm', valueMM: 10 },
  ],
  nodes: [
    { id: 'WidthFeature', kind: 'source-line-width-face', sourceId: 'LineSource', widthParameterId: 'Width',
      options: { lowerCurveId: 'width_lower', upperCurveId: 'width_upper', surfaceId: 'width_surface',
        loopId: 'width_loop', boundaryCurveIds: ['width_b0','width_b1','width_b2','width_b3'],
        face: { faceId: 'width_face', evaluationId: 'width_evaluation', resultIdPrefix: 'width_result', orientation: 'forward' } } },
    { id: 'ExtrusionFeature', kind: 'convex-planar-face-extrusion', faceNodeId: 'WidthFeature',
      heightParameterId: 'Height', suppressed: false,
      options: { evaluationId: 'direct_prism_shell', resultIdPrefix: 'dpx', direction: 'positive-z' } },
  ],
};
export const options: SourceLineWidthExtrusionGraphOptions = {
  maximumFeatureNodes: 2, maximumWidthEvaluations: 1,
  maximumExtrusionEvaluations: 1, maximumProducerEvaluations: 2,
};

/** Complete application construction through the ordinary public root. */
export function makeLineWidthGraph(input: SourceLineWidthExtrusionGraphV0, limits: SourceLineWidthExtrusionGraphOptions) {
  return evaluateSourceLineWidthExtrusionGraph(input, limits);
}

const evidencePath = 'evidence/cad-line-width-extrusion-graph-consumer.json';
const previousReceipt = await readFile(evidencePath, 'utf8').then(JSON.parse).catch(error => {
  if (error.code === 'ENOENT') return null;
  throw error;
});
const failures = previousReceipt?.failedCandidates ?? [];
const phaseCounts = (value: SourceLineWidthExtrusionGraphUpdateResult) => ({
  changed: value.transaction.report.directCounts,
  priorColdValidation: value.transaction.report.validationCounts,
});
function assertCounts(value: SourceLineWidthExtrusionGraphUpdateResult, changed: [number,number,number], prior: [number,number,number]) {
  const actual = value.transaction.report.directCounts;
  assert.deepEqual([actual.widthBuildCallCount, actual.extrusionBuildCallCount, actual.producerEvaluationCount], changed);
  const validation = value.transaction.report.validationCounts;
  assert.equal(validation.previousGraphRebuildCount, 1);
  assert.deepEqual([validation.directCounts.widthBuildCallCount, validation.directCounts.extrusionBuildCallCount,
    validation.directCounts.producerEvaluationCount], prior);
  assert.equal(value.transaction.report.atomic, true);
}
function preserved(value: SourceLineWidthExtrusionGraphResult, initial: SourceLineWidthExtrusionGraphResult) {
  assert.equal(value.document.asset.source, originalSource);
  assert.deepEqual(value.width.originalModel, initial.width.originalModel);
  assert.deepEqual(value.width.originalCurve, initial.width.originalCurve);
  assert.equal(value.width.originalModel.objects.length, 3);
  assert.deepEqual(value.width.originalModel.objects[0], initial.width.originalModel.objects[0]);
  assert.deepEqual(value.width.originalModel.objects[2], initial.width.originalModel.objects[2]);
  assert.equal(value.report.quality.solid, false);
  assert.equal(value.report.quality.embeddedManifoldCertified, false);
  assert.equal(value.report.quality.volumeCertified, false);
}
function summary(value: SourceLineWidthExtrusionGraphResult) {
  return {
    revision: value.document.revision, widthMM: value.report.widthMM, heightMM: value.report.heightMM,
    extrusionStatus: value.report.extrusionStatus, faceId: value.report.faceId, shellId: value.report.shellId,
    areaDiagnosticMM2: value.width.report.diagnostics.representedAreaMM2,
    volumeDiagnosticMM3: value.extrusion?.report.diagnostics.volumeMM3 ?? null,
    boundsMM: value.extrusion?.report.boundsMM ?? null,
    quality: value.report.quality, receiptCounts: value.report.receiptCounts,
    retainedProviderCounts: value.report.retainedProviderCounts,
  };
}
function panel(id: string, label: string, value: SourceLineWidthExtrusionGraphResult,
  transaction?: SourceLineWidthExtrusionGraphUpdateResult['transaction']['report']) {
  const surfaceRows = value.extrusion ? value.extrusion.shell.assets.map((asset, index) => {
    const surface = asset.face.geometry.objects.find(object => object.kind === 'surface');
    assert.ok(surface);
    assert.equal(asset.face.topology.face.surfaceId, surface.id);
    return { sourceId: asset.sourceId, faceId: asset.face.topology.face.id,
      role: index === 0 ? 'bottom' : index === 1 ? 'top' : 'wall-' + (index - 2),
      surface, source: asset.source,
      sourceQualification: { context:'shell-asset', sourceField:'extrusion.shell.assets[' + index + '].source',
        modelName:asset.face.geometry.name, surfaceId:surface.id } };
  }) : [{ sourceId:null, faceId:value.width.face.topology.face.id, role:'width-face',
    surface:value.width.face.plane, source:value.width.face.source,
    sourceQualification:{context:'width-face',sourceField:'width.face.source',
      modelName:value.width.face.model.name,surfaceId:value.width.face.plane.id} }];
  surfaceRows.forEach(row => {
    const surface = row.surface;
    assert.equal(surface.kind, 'surface'); assert.equal(surface.degreeU, 1); assert.equal(surface.degreeV, 1);
    assert.deepEqual(surface.knotsU, [0,0,1,1]); assert.deepEqual(surface.knotsV, [0,0,1,1]);
    assert.equal(surface.controlPoints.length, 2); surface.controlPoints.forEach(points => assert.equal(points.length, 2));
    assert.deepEqual(surface.weights, [[1,1],[1,1]]);
  });
  const extrusion = value.extrusion;
  const counts = extrusion ? {
    faceAssets:surfaceRows.length, vertexClasses:extrusion.shell.graph.vertices.length, edges:extrusion.shell.graph.edges.length,
    faces:extrusion.shell.graph.faces.length, vertexLinks:extrusion.shell.graph.vertexLinks.length,
    pairedEdges:extrusion.shell.pairResults.length, cornerArcs:extrusion.report.childReceiptCounts.cornerArcCount,
  } : {faceAssets:1,vertexClasses:null,edges:null,faces:1,vertexLinks:null,pairedEdges:0,cornerArcs:null};
  if (extrusion) assert.deepEqual(counts,{faceAssets:6,vertexClasses:8,edges:12,faces:6,vertexLinks:8,pairedEdges:12,cornerArcs:24});
  assert.equal(surfaceRows.length, extrusion ? 6 : 1);
  return {id,label,...summary(value),suppressed:extrusion === null,surfaces:structuredClone(surfaceRows),counts,
    newWork:transaction?.directCounts ?? null,priorValidation:transaction?.validationCounts.directCounts ?? null,
    priorGraphRebuildCount:transaction?.validationCounts.previousGraphRebuildCount ?? null};
}

try {
  const beforeDocument = structuredClone(document), beforeOptions = structuredClone(options);
  const initial = makeLineWidthGraph(document, options);
  assert.deepEqual(document, beforeDocument); assert.deepEqual(options, beforeOptions);
  assert.deepEqual(initial.extrusion!.report.boundsMM,{min:[0,-2.5,0],max:[100,2.5,10]});
  assert.equal(initial.extrusion!.report.diagnostics.volumeMM3,5000);
  const initialBefore = structuredClone(initial);
  const height12 = updateSourceLineWidthExtrusionGraph(initial, {
    expectedRevision:0,revision:1,parameterEdits:[{parameterId:'Height',valueMM:12}],extrusionSuppressed:null,
  });
  assertCounts(height12,[0,1,1],[1,1,2]);
  assert.equal(height12.transaction.report.widthAction,'retained');
  assert.notStrictEqual(height12.result.width,initial.width); assert.deepEqual(height12.result.width,initial.width);
  assert.deepEqual(initial,initialBefore);
  const width8 = updateSourceLineWidthExtrusionGraph(height12.result, {
    expectedRevision:1,revision:2,parameterEdits:[{parameterId:'Width',valueMM:8}],extrusionSuppressed:null,
  });
  assertCounts(width8,[1,1,2],[1,1,2]);
  assert.equal(width8.transaction.report.sourceEffectChanged,true);
  assert.deepEqual(width8.result.extrusion!.report.boundsMM,{min:[0,-4,0],max:[100,4,12]});
  assert.equal(width8.result.extrusion!.report.diagnostics.volumeMM3,9600);
  const suppressed = updateSourceLineWidthExtrusionGraph(width8.result, {
    expectedRevision:2,revision:3,parameterEdits:[],extrusionSuppressed:true,
  });
  assertCounts(suppressed,[0,0,0],[1,1,2]);
  assert.equal(suppressed.result.extrusion,null); assert.equal(suppressed.result.report.shellId,null);
  assert.deepEqual(suppressed.result.width,width8.result.width);
  const resumed = updateSourceLineWidthExtrusionGraph(suppressed.result, {
    expectedRevision:3,revision:4,parameterEdits:[],extrusionSuppressed:false,
  });
  assertCounts(resumed,[0,1,1],[1,0,1]); assert.equal(resumed.transaction.report.resumed,true);
  assert.deepEqual(resumed.result.width,suppressed.result.width);
  assert.deepEqual(resumed.result.extrusion,width8.result.extrusion);
  const text = serializeSourceLineWidthExtrusionGraph(resumed.result.document, options);
  const downloadPath = 'docs/public/examples/cad-line-width-extrusion-graph.authored.json';
  await writeFile(downloadPath,text);
  const diskText = await readFile(downloadPath,'utf8'); assert.equal(diskText,text);
  assert.ok(text.endsWith('\n')); assert.ok(!text.endsWith('\n\n'));
  const authoredContainer=JSON.parse(text);
  assert.deepEqual(Object.keys(authoredContainer),['format','version','id','revision','lengthUnit','sourceFrame','asset','parameters','nodes']);
  assert.equal(Object.hasOwn(authoredContainer,'options'),false); assert.equal(Object.hasOwn(authoredContainer,'width'),false);
  const reopened = parseSourceLineWidthExtrusionGraph(diskText,options);
  assert.deepEqual(reopened,resumed.result); assert.notStrictEqual(reopened,resumed.result);
  assert.equal(reopened.document.asset.source,originalSource);
  const reedited = updateSourceLineWidthExtrusionGraph(reopened, {
    expectedRevision:4,revision:5,parameterEdits:[{parameterId:'Height',valueMM:14}],extrusionSuppressed:null,
  });
  assertCounts(reedited,[0,1,1],[1,1,2]);
  assert.deepEqual(reedited.result.extrusion!.report.boundsMM,{min:[0,-4,0],max:[100,4,14]});
  assert.equal(reedited.result.extrusion!.report.diagnostics.volumeMM3,11200);
  [initial,height12.result,width8.result,suppressed.result,resumed.result,reopened,reedited.result].forEach(value=>preserved(value,initial));
  let accepted=reedited.result;const acceptedBefore=structuredClone(accepted),acceptedReference=accepted;
  const refusals=[];
  for(const edits of [
    {expectedRevision:4,revision:6,parameterEdits:[],extrusionSuppressed:null},
    {expectedRevision:5,revision:6,parameterEdits:[{parameterId:'Width',valueMM:0}],extrusionSuppressed:null},
  ]) {
    let refusal;
    try {accepted=updateSourceLineWidthExtrusionGraph(accepted,edits).result;} catch(error){refusal=error;}
    assert.ok(refusal instanceof SourceLineWidthExtrusionGraphError);
    assert.equal(refusal.code,refusals.length ? 'PARAMETER' : 'REVISION');
    assert.strictEqual(accepted,acceptedReference);assert.deepEqual(accepted,acceptedBefore);
    refusals.push({edits,name:refusal.name,code:refusal.code,message:refusal.message,context:refusal.context});
  }
  const receipt={status:'passed',nodeVersion:process.version,originalSource,
    originalSourceSHA256:createHash('sha256').update(originalSource).digest('hex'),document,options,
    initial:summary(initial),height12:summary(height12.result),width8:summary(width8.result),
    suppressed:summary(suppressed.result),resumed:summary(resumed.result),reopened:summary(reopened),reedited:summary(reedited.result),
    transactions:[height12,width8,suppressed,resumed,reedited].map(value=>({request:value.transaction.request,report:value.transaction.report,...phaseCounts(value)})),
    visualization:{unit:'mm',sourceFrame:'authored-xyz-no-axis-conversion',geometryAuthority:'complete-returned-native-surface-coefficients',panels:[
      panel('initial','Width 5 mm · Height 10 mm',initial),panel('updated','Width 8 mm · Height 12 mm',width8.result,width8.transaction.report),
      panel('suppressed','Width Face · extrusion suppressed',suppressed.result,suppressed.transaction.report),panel('reopened-edit','Fresh Open · Height 14 mm',reedited.result,reedited.transaction.report),
    ]},
    authoredDocument:authoredContainer,authoredText:text,
    download:{path:'/examples/cad-line-width-extrusion-graph.authored.json',bytes:new TextEncoder().encode(text).length,
      sha256:createHash('sha256').update(text).digest('hex'),onlyAuthoredDocument:true,sourceCRLFAndNegativeZeroTextRetained:true},
    refusals,failedCandidates:failures,priorColdValidationWorkSeparated:true,copiedRetainedNativeValues:true,
    originalModelAndUnselectedObjectsRetained:true,acceptedReferenceAndValueRetained:true,callerInputsUnchanged:true,
    actualGL:false,scope:'One current public authored graph lifecycle with selected edits/suppression/resume/document-only Save/fresh Parse/re-edit, genuine stale revision and zero parameter refusals, and full returned Surface coefficients for illustration. No renderer, native provider campaign, Solid, certified embedding or volume.',
  };
  await writeFile(evidencePath,JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify({status:receipt.status,revisions:[0,1,2,3,4,5],download:receipt.download,
    changedCounts:receipt.transactions.map(t=>[t.changed.widthBuildCallCount,t.changed.extrusionBuildCallCount,t.changed.producerEvaluationCount]),
    priorColdValidationCounts:receipt.transactions.map(t=>[t.priorColdValidation.directCounts.widthBuildCallCount,t.priorColdValidation.directCounts.extrusionBuildCallCount,t.priorColdValidation.directCounts.producerEvaluationCount]),
    panels:receipt.visualization.panels.map(p=>({id:p.id,surfaces:p.surfaces.length,counts:p.counts})),refusals:refusals.map(e=>e.code)}));
} catch(error) {
  await writeFile(evidencePath,JSON.stringify({status:'failed',nodeVersion:process.version,originalSource,document,options,
    failedCandidates:[...failures,{name:error.name,code:error.code,message:error.message,stack:error.stack,context:error.context}]},null,2)+'\n');
  throw error;
}
