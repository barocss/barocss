import {
  buildSourceLineWidthFace, extrudeConvexPlanarFace,
  validateConvexPlanarFaceExtrusion, compileCadModel,
  ConvexPlanarFaceExtrusionError,
} from '@barocss/cad';
import type { SourceLineWidthFaceRequest, ConvexPlanarFaceExtrusionOptions } from '@barocss/cad';
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

export const widthRequest: SourceLineWidthFaceRequest = {
  source: originalSource, sourceVersion: 0, curveId: 'original_line', widthMM: 5,
  options: {
    lowerCurveId: 'width_lower', upperCurveId: 'width_upper',
    surfaceId: 'width_surface', loopId: 'width_loop',
    boundaryCurveIds: ['width_b0', 'width_b1', 'width_b2', 'width_b3'],
    face: { faceId: 'width_face', evaluationId: 'width_evaluation',
      resultIdPrefix: 'width_result', orientation: 'forward' },
  },
};
export const extrusionOptions: ConvexPlanarFaceExtrusionOptions = {
  evaluationId: 'direct_prism_shell', resultIdPrefix: 'dpx',
  distanceMM: 10, direction: 'positive-z',
};

/** Complete public application composition; the input Face is not a wrapper cast. */
export function makeLineWidthShell(request: SourceLineWidthFaceRequest, options: ConvexPlanarFaceExtrusionOptions) {
  const width = buildSourceLineWidthFace(request);
  const extrusion = extrudeConvexPlanarFace(width.face, options);
  return { width, extrusion };
}

// Preserve represented -0 in this application-owned JSON container. This is
// not a CAD file codec or an additional public package parser.
function nativeJSON(value: unknown): string {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value);
  }
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']';
  assert.ok(value && typeof value === 'object');
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}';
}
function negativeZeros(value: unknown): number {
  if (typeof value === 'number') return Object.is(value, -0) ? 1 : 0;
  if (!value || typeof value !== 'object') return 0;
  return Object.values(value).reduce<number>((sum, child) => sum + negativeZeros(child), 0);
}
const evidencePath = 'evidence/cad-line-width-extrusion-consumer.json';
try {
  const beforeRequest = structuredClone(widthRequest), beforeOptions = structuredClone(extrusionOptions);
  const main = makeLineWidthShell(widthRequest, extrusionOptions);
  assert.deepEqual(widthRequest, beforeRequest); assert.deepEqual(extrusionOptions, beforeOptions);
  const original = compileCadModel(originalSource, { sourceVersion: 0 });
  assert.equal(original.ok, true);
  if (!original.ok) throw new Error(JSON.stringify(original.diagnostics));
  assert.deepEqual(main.width.originalModel, original.model);
  assert.deepEqual(main.width.originalCurve, original.model.objects[1]);
  assert.equal(main.width.request.source, originalSource);
  assert.equal(main.width.originalModel.objects.length, 3);
  assert.equal(main.width.report.widthIntent.lowerYMM, -2.5); assert.equal(main.width.report.widthIntent.upperYMM, 2.5);
  assert.equal(main.width.report.diagnostics.representedAreaMM2, 500);
  const widthBefore = structuredClone(main.width), firstBefore = structuredClone(main.extrusion);
  const changedOptions = { ...extrusionOptions, distanceMM: 12 };
  const changed = extrudeConvexPlanarFace(main.width.face, changedOptions);
  assert.deepEqual(main.width, widthBefore); assert.deepEqual(main.extrusion, firstBefore);
  assert.deepEqual(changed.request.face, main.width.face);
  assert.notStrictEqual(changed.request.face, main.width.face);
  const summarize = (value: typeof changed) => {
    assert.deepEqual(value.translation.vector, [0, 0, value.request.options.distanceMM]);
    assert.equal(value.translation.coefficientMappings.length, 12);
    assert.equal(value.walls.length, 4); assert.equal(value.shell.assets.length, 6); assert.equal(value.shell.pairs.length, 12);
    assert.equal(value.shell.graph.vertices.length, 8); assert.equal(value.shell.graph.edges.length, 12);
    assert.equal(value.shell.graph.faces.length, 6); assert.equal(value.shell.graph.vertexLinks.length, 8);
    assert.equal(value.report.childReceiptCounts.cornerArcCount, 24);
    assert.equal(value.shell.report.globalFreeBoundaryCount, 0);
    assert.equal(value.report.quality.abstractIncidenceManifold, true); assert.equal(value.report.quality.solid, false);
    assert.equal(value.report.quality.volumeCertified, false); assert.equal(value.report.quality.embeddedManifoldCertified, false);
    return { options: value.request.options, boundsMM: value.report.boundsMM,
      axisProductDiagnosticMM3: value.report.diagnostics.volumeMM3,
      shell: value.shell.report, directCounts: value.report.directCounts, fileSizes: value.report.fileSizes };
  };
  const at10 = summarize(main.extrusion), at12 = summarize(changed);
  assert.deepEqual(at10.boundsMM, { min: [0, -2.5, 0], max: [100, 2.5, 10] });
  assert.deepEqual(at12.boundsMM, { min: [0, -2.5, 0], max: [100, 2.5, 12] });
  assert.equal(at10.axisProductDiagnosticMM3, 5000); assert.equal(at12.axisProductDiagnosticMM3, 6000);
  const coldSources = changed.shell.assets.map((asset, index) => {
    const cold = compileCadModel(asset.source, { sourceVersion: 0 });
    assert.equal(cold.ok, true);
    if (!cold.ok) throw new Error(JSON.stringify(cold.diagnostics));
    assert.deepEqual(cold.model, asset.face.geometry);
    return { index, sourceId: asset.sourceId, modelName: cold.model.name,
      objectIds: cold.model.objects.map(object => object.id), sourceBytes: new TextEncoder().encode(asset.source).length };
  });
  let retained = changed;
  const retainedBefore = structuredClone(changed);
  let refused: unknown;
  try { retained = extrudeConvexPlanarFace(main.width.face, { ...changedOptions, distanceMM: 0 }); }
  catch (error) { refused = error; }
  assert.ok(refused instanceof ConvexPlanarFaceExtrusionError);
  assert.equal(refused.code, 'DISTANCE'); assert.strictEqual(retained, changed); assert.deepEqual(changed, retainedBefore);
  const context = {
    format: 'barocss-docs-line-width-extrusion-context', version: 0,
    sourceProfile: 'fd0def8e1a2c55ecfa66daf5116347c37185ba4b',
    widthResult: main.width, extrusionRequest: changed.request, extrusionResult: changed,
    heightComparison: { at10, at12 },
  };
  const text = nativeJSON(context) + '\n';
  const downloadPath = 'docs/public/examples/cad-line-width-shell.json';
  await writeFile(downloadPath, text);
  const reopened = JSON.parse(await readFile(downloadPath, 'utf8'));
  assert.deepEqual(reopened, context); assert.equal(negativeZeros(reopened), negativeZeros(context));
  // Exactly one final complete owned validator invocation on the saved/reopened result.
  const validated = validateConvexPlanarFaceExtrusion(reopened.extrusionResult);
  assert.deepEqual(validated, changed.report);
  assert.deepEqual(main.width, widthBefore); assert.deepEqual(main.extrusion, firstBefore);
  const receipt = {
    status: 'passed', nodeVersion: process.version, originalSource,
    originalSourceSHA256: createHash('sha256').update(originalSource).digest('hex'),
    widthRequest, extrusionOptions, changedOptions, widthReport: main.width.report,
    at10, at12, coldSources, finalOwnedValidation: validated,
    refusal: { name: refused.name, code: refused.code, message: refused.message },
    download: { path: '/examples/cad-line-width-shell.json', format: context.format,
      bytes: new TextEncoder().encode(text).length, sha256: createHash('sha256').update(text).digest('hex'),
      negativeZeroCount: negativeZeros(context) },
    originalSourceAndUnselectedModelRetained: true, fullWidthAndParentRetained: true,
    acceptedReferenceAndValueRetained: true, callerInputsUnchanged: true,
    actualGL: false, scope: 'One public Line-width-Face/direct-Face-extrusion composition, height10→12, six source cold compiles, zero-distance refusal and one final reopened owned validation. No Solid, certified volume, geometric embedding, renderer or publication claim.',
  };
  await writeFile(evidencePath, JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({ status: receipt.status, height10: at10.boundsMM, height12: at12.boundsMM,
    diagnosticVolume10: 5000, diagnosticVolume12: 6000, assets: coldSources.length, downloadBytes: receipt.download.bytes,
    negativeZeros: receipt.download.negativeZeroCount, refusal: refused.code, finalOwnedValidation: 'passed' }));
} catch (error) {
  await writeFile(evidencePath, JSON.stringify({ status: 'failed', nodeVersion: process.version,
    firstFailure: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    actualGL: false }, null, 2) + '\n');
  throw error;
}
