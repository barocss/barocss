import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
assert.deepEqual(args.slice(0, 1), ['--source']);
assert.equal(args.length, 2, 'Usage: node source-line-width-extrusion-graph-demo.mjs --source <output-directory>');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]);
mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const esbuild = require('esbuild'), entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundle = await esbuild.build({ absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
assert.equal(bundle.outputFiles.length, 1);
const inputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path));
for (const leaf of ['source-line-width-extrusion-graph.ts', 'source-line-width-face.ts', 'convex-planar-face-extrusion.ts', 'closed-exact-patch-shell.ts', 'cad-document.ts']) assert.ok(inputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
assert.ok(!inputs.some(path => path.includes('/packages/barocss-cad/dist/')));
assert.ok(inputs.filter(path => path.includes('/packages/barocss-cad/')).every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const {
  evaluateSourceLineWidthExtrusionGraph: evaluate, updateSourceLineWidthExtrusionGraph: update,
  validateSourceLineWidthExtrusionGraph: validate, validateSourceLineWidthExtrusionGraphUpdate: validateUpdate,
  serializeSourceLineWidthExtrusionGraph: serialize, parseSourceLineWidthExtrusionGraph: parse,
  SourceLineWidthExtrusionGraphError: GraphError, SourceLineWidthExtrusionGraphDiagnosticCode: codes, compileCadModel
} = api;
const runtimeNames = ['evaluateSourceLineWidthExtrusionGraph', 'updateSourceLineWidthExtrusionGraph', 'validateSourceLineWidthExtrusionGraph', 'validateSourceLineWidthExtrusionGraphUpdate', 'serializeSourceLineWidthExtrusionGraph', 'parseSourceLineWidthExtrusionGraph', 'SourceLineWidthExtrusionGraphError', 'SourceLineWidthExtrusionGraphDiagnosticCode'];
const typeNames = ['SourceLineWidthExtrusionGraphV0', 'SourceLineWidthExtrusionGraphOptions', 'SourceLineWidthExtrusionGraphEdits', 'SourceLineWidthExtrusionGraphReport', 'SourceLineWidthExtrusionGraphResult', 'SourceLineWidthExtrusionGraphTransactionReport', 'SourceLineWidthExtrusionGraphTransaction', 'SourceLineWidthExtrusionGraphUpdateResult'];
for (const name of runtimeNames) assert.equal(typeof api[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(Object.keys(codes).sort(), ['INPUT', 'VERSION', 'IDENTITY', 'REFERENCE', 'REVISION', 'PARAMETER', 'PROFILE', 'BUDGET', 'SOURCE', 'WIDTH', 'EXTRUSION', 'BINDING', 'OWNED', 'CODEC', 'FILE'].sort());
for (const [key, value] of Object.entries(codes)) assert.equal(key, value);

const files = new Map(), retained = [], states = [], transactions = [], failures = [], ownedControls = [];
const additionalWork = { freshEvaluations: 0, currentColdOracles: 0, updateCalls: 0, currentOwnedCalls: 0, updateOwnedCalls: 0, sourceColdCompiles: 0, serializeCalls: 0, parseCalls: 0, publicEvaluateCalls: 0, publicOwnedCalls: 0, publicUpdateCalls: 0, publicUpdateOwnedCalls: 0, publicSerializeCalls: 0, publicParseCalls: 0, directSamplerCalls: 0, rationalOperations: 0 };
const clone = value => structuredClone(value);
function nativeJSON(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || ['string', 'boolean'].includes(typeof value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}';
}
const size = text => ({ utf16: text.length, utf8: Buffer.byteLength(text) });
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : nativeJSON(value)).digest('hex');
function saveText(name, text) { const path = resolve(output, name); writeFileSync(path, text); files.set(path, readFileSync(path)); assert.equal(readFileSync(path, 'utf8'), text); return path; }
function saveJSON(name, value, limit = 8388608) {
  const text = nativeJSON(value) + '\n'; assert.ok(text.length <= limit && Buffer.byteLength(text) <= limit, name);
  const path = saveText(name + '.json', text); assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), value); return path;
}
function retain(value) { retained.push([value, nativeJSON(value)]); }
function retention() { for (const [path, bytes] of files) assert.deepEqual(readFileSync(path), bytes, path); for (const [value, snapshot] of retained) assert.equal(nativeJSON(value), snapshot); }
function ownership(input, result) {
  const caller = new WeakSet(), seen = new WeakSet();
  function collect(value) { if (value && typeof value === 'object' && !caller.has(value)) { caller.add(value); Object.values(value).forEach(collect); } }
  function visit(value) { if (value && typeof value === 'object') { assert.ok(!caller.has(value), 'Caller alias'); assert.ok(!seen.has(value), 'Repeated returned occurrence'); seen.add(value); Object.values(value).forEach(visit); } }
  collect(input); visit(result);
}
function cold(source, model, name) {
  assert.ok(source.length <= 262144 && Buffer.byteLength(source) <= 262144); const path = saveText(name + '.source0.css', source);
  additionalWork.sourceColdCompiles++; const actual = compileCadModel(readFileSync(path, 'utf8'), { sourceVersion: 0 });
  assert.equal(actual.ok, true, JSON.stringify(actual.diagnostics)); assert.deepEqual(actual.model, model);
  saveJSON(name + '-cold-model', actual.model); return actual.model;
}
function reject(name, action, expected) {
  let failure; try { action(); } catch (error) { failure = error; }
  assert.ok(failure instanceof GraphError, name + ': actual graph error');
  if (expected) assert.ok((Array.isArray(expected) ? expected : [expected]).includes(failure.code), name + ': ' + failure.code);
  assert.equal(failure.name, 'SourceLineWidthExtrusionGraphError'); assert.ok(failure.message.length <= 1024);
  failures.push({ name, code: failure.code, message: failure.message, context: failure.context, causeName: failure.cause?.name ?? null, causeCode: failure.cause?.code ?? null, causeMessage: failure.cause?.message ?? null });
  retention(); return failure;
}
const source = '/* 설계 π: original literals stay unchanged; keep CRLF. */\r\n@model width_surface { version:0; length-unit:mm;\r\n'
  + '@curve #untouched_curve {type:nurbs;degree:2;knots:[-2.000,-2,-2,3,3.0,3];control-points:[[-0,2,1],[3,4,2],[6,2,1]];weights:[1,2,1];}\r\n'
  + '@curve #original_line {type:nurbs;degree:+1.000;knots:[0,0,1.000,1];control-points:[[0,-0,0],[+100.000,0,0]];weights:[1.000,1];}\r\n'
  + '@surface #untouched_surface {type:nurbs;degree-u:1;degree-v:1;knots-u:[0.000,0,1,1.00];knots-v:[-1,-1,2,2];control-points:[[[2,3,-0],[2,5,1]],[[4,3,2],[4,5,4]]];weights:[[1,2],[3,4]];}\r\n}\r\n';
const originalCurve = { kind: 'curve', id: 'original_line', degree: 1, knots: [0, 0, 1, 1], controlPoints: [[0, -0, 0], [100, 0, 0]], weights: [1, 1] };
const widthOptions = { lowerCurveId: 'width_lower', upperCurveId: 'width_upper', surfaceId: 'width_surface', loopId: 'width_loop', boundaryCurveIds: ['width_b0', 'width_b1', 'width_b2', 'width_b3'], face: { faceId: 'width_face', evaluationId: 'width_evaluation', resultIdPrefix: 'width_result', orientation: 'forward' } };
const graphOptions = { maximumFeatureNodes: 2, maximumWidthEvaluations: 1, maximumExtrusionEvaluations: 1, maximumProducerEvaluations: 2 };
const document = {
  format: 'barocss-source-line-width-extrusion-graph', version: 0, id: 'width_height_graph', revision: 0,
  lengthUnit: 'mm', sourceFrame: 'authored-xyz-no-axis-conversion',
  asset: { sourceId: 'original_source', sourceVersion: 0, source, curveId: 'original_line' },
  parameters: [{ id: 'width', kind: 'length', unit: 'mm', valueMM: 5 }, { id: 'height', kind: 'length', unit: 'mm', valueMM: 10 }],
  nodes: [{ id: 'width_node', kind: 'source-line-width-face', sourceId: 'original_source', widthParameterId: 'width', options: widthOptions },
    { id: 'extrusion_node', kind: 'convex-planar-face-extrusion', faceNodeId: 'width_node', heightParameterId: 'height', suppressed: false, options: { evaluationId: 'graph_shell', resultIdPrefix: 'gx', direction: 'positive-z' } }]
};
const boundaryOrder = ['v-min', 'u-max', 'v-max', 'u-min'];
function operationCounts(width, extrusion) {
  return { widthBuildCallCount: width, extrusionBuildCallCount: extrusion, producerEvaluationCount: width + extrusion, rootSourceCompilationCount: 0, rootCurveD0Count: 0, rootCurveD1AttemptCount: 0, rootSurfaceD0Count: 0, rootSurfaceD1AttemptCount: 0, rootRationalOperationCount: 0, oldGraphCallCount: 0 };
}
function providers(result) { return { width: result.width.report.directCounts, extrusion: result.extrusion?.report.directCounts ?? null, shellChildren: result.extrusion?.report.shellChildDirectCounts ?? null }; }
function rectangleOracle(result) {
  const w = result.document.parameters[0].valueMM, width = result.width, face = width.face, settings = result.document.nodes[0].options;
  assert.deepEqual(width.request, { source, sourceVersion: 0, curveId: originalCurve.id, widthMM: w, options: settings });
  assert.deepEqual(width.originalCurve, originalCurve); assert.equal(width.originalModel.objects.length, 3); assert.deepEqual(width.originalModel.objects[1], originalCurve);
  const corners = [[0, -w / 2, 0], [100, -w / 2, 0], [100, w / 2, 0], [0, w / 2, 0]];
  assert.deepEqual(face.topology.vertices.map(v => v.point), corners); assert.equal(face.topology.face.orientation, 'forward');
  assert.deepEqual(face.plane.controlPoints, [[corners[0], corners[3]], [corners[1], corners[2]]]);
  assert.deepEqual(face.plane.weights, [[1, 1], [1, 1]]); assert.deepEqual(face.plane.knotsU, originalCurve.knots); assert.deepEqual(face.plane.knotsV, [0, 0, 1, 1]);
  assert.deepEqual(width.ruled.surface, face.plane); assert.equal(width.ruled.model.objects.length, 3); assert.equal(face.model.objects.length, 5);
  assert.equal(width.originalModel.name, width.ruled.model.name, 'Model names may alias across qualified source contexts');
  face.loop.edges.forEach((curve, i) => { assert.equal(curve.id, settings.boundaryCurveIds[i]); assert.deepEqual(curve.controlPoints, [corners[i], corners[(i + 1) % 4]]); assert.deepEqual(curve.knots, [0, 0, 1, 1]); assert.deepEqual(curve.weights, [1, 1]); });
  face.topology.loop.uses.forEach((use, i) => { assert.equal(use.curveId, settings.boundaryCurveIds[i]); assert.equal(use.sense, 'forward'); assert.deepEqual(use.interval, [0, 1]); assert.equal(use.vertexIds[1], face.topology.loop.uses[(i + 1) % 4].vertexIds[0]); });
  for (const witness of face.bindings) { assert.equal(witness.pointDifferenceMM, 0); assert.equal(witness.tangentDifferenceMM, 0); assert.deepEqual(witness.surfaceD1.du, [100, 0, 0]); assert.deepEqual(witness.surfaceD1.dv, [0, w, 0]); }
  const freshIds = [settings.lowerCurveId, settings.upperCurveId, settings.surfaceId, settings.loopId, settings.face.faceId, settings.face.evaluationId, ...settings.boundaryCurveIds, ...Array.from({ length: 4 }, (_, i) => ['v', 'e', 'use', 'uv'].map(role => settings.face.resultIdPrefix + '_' + role + '_' + i)).flat()];
  assert.equal(new Set(freshIds).size, 26); assert.deepEqual([...width.report.generatedRoleIds].sort(), [...freshIds].sort());
  assert.ok(freshIds.every(id => !width.originalModel.objects.some(object => object.id === id)));
  assert.equal(width.report.diagnostics.representedAreaMM2, 100 * w); assert.equal(width.report.directCounts.producerDelegationCount, 7);
  assert.deepEqual(width.report.fileSizes.request, size(nativeJSON(width.request) + '\n')); assert.deepEqual(width.report.fileSizes.result, size(nativeJSON(width) + '\n'));
  return corners;
}
function extrusionOracle(result, corners) {
  const e = result.extrusion, h = result.document.parameters[1].valueMM, w = result.document.parameters[0].valueMM, parent = result.width.face;
  assert.deepEqual(e.request.face, parent); assert.deepEqual(e.request.options, { ...result.document.nodes[1].options, distanceMM: h });
  assert.deepEqual(e.translation.vector, [0, 0, h]); assert.deepEqual(e.translation.normal, [0, 0, 1]); assert.equal(e.translation.distanceMM, h);
  assert.equal(e.translation.coefficientMappings.length, 12);
  for (const mapping of e.translation.coefficientMappings) { assert.deepEqual(mapping.translatedPointMM, [mapping.originalPointMM[0], mapping.originalPointMM[1], mapping.originalPointMM[2] + h]); assert.deepEqual(mapping.actualOffsetMM, [0, 0, h]); }
  const shell = e.shell, expectedNormals = [[0, 0, -1], [0, 0, 1], [0, -1, 0], [1, 0, 0], [0, 1, 0], [-1, 0, 0]];
  assert.equal(shell.assets.length, 6); assert.equal(shell.pairs.length, 12); assert.equal(shell.pairResults.length, 12); assert.equal(e.walls.length, 4);
  shell.assets.forEach((asset, i) => {
    assert.equal(asset.face.geometry.name, 'parametric_face'); assert.equal(asset.face.geometry.objects.length, 5); assert.equal(asset.face.topology.face.orientation, 'forward');
    const cp = asset.face.geometry.objects[0].controlPoints, a = cp[1][0].map((x, axis) => x - cp[0][0][axis]), b = cp[0][1].map((x, axis) => x - cp[0][0][axis]);
    const cross = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm = Math.hypot(...cross);
    assert.ok(Number.isFinite(norm) && norm > 0); assert.deepEqual(cross.map(x => x === 0 ? 0 : x / norm), expectedNormals[i]);
    if (i === 0) assert.deepEqual(cp, [[corners[0], corners[1]], [corners[3], corners[2]]]);
    if (i === 1) assert.deepEqual(cp, parent.plane.controlPoints.map(row => row.map(p => [p[0], p[1], p[2] + h])));
    if (i >= 2) { const wall = e.walls[i - 2]; assert.deepEqual(wall.first, parent.loop.edges[i - 2]); assert.deepEqual(wall.second.controlPoints, wall.first.controlPoints.map(p => [p[0], p[1], p[2] + h])); assert.deepEqual(wall.surface, asset.face.geometry.objects[0]); assert.deepEqual(wall.model.objects, [wall.first, wall.second, wall.surface]); }
  });
  const selector = (i, boundary) => ({ sourceId: shell.assets[i].sourceId, boundary }), pairs = [];
  for (let i = 0; i < 4; i++) pairs.push({ first: selector(0, boundaryOrder[3 - i]), second: selector(i + 2, 'v-min') });
  for (let i = 0; i < 4; i++) pairs.push({ first: selector(1, boundaryOrder[i]), second: selector(i + 2, 'v-max') });
  for (let i = 0; i < 4; i++) pairs.push({ first: selector(i + 2, 'u-max'), second: selector(2 + (i + 1) % 4, 'u-min') });
  assert.deepEqual(shell.pairs, pairs); assert.deepEqual(e.bindings.pairs, pairs); assert.equal(new Set(shell.assets.map(a => a.sourceId)).size, 6);
  const sums = { sourceCompilationCount: 0, faceValidationCount: 0, boundaryExtractionCount: 0, curveReversalCount: 0, observationPairCount: 0, curvePointEvaluationCount: 0, curveDerivativeEvaluationCount: 0 };
  shell.pairResults.forEach((child, i) => {
    assert.deepEqual(child.report.pairs, [pairs[i]]); assert.equal(child.report.freeBoundaryCount, 6); assert.equal(child.sharedEdges.length, 1);
    const edge = child.sharedEdges[0]; assert.equal(edge.observations.length, 3); assert.equal(edge.uses[1].parameterMap.kind, 'reversed');
    for (const o of edge.observations) {
      assert.equal(o.pointDifferenceMM, 0); assert.equal(o.derivativeDifferenceMM, 0); assert.equal(o.relativeDerivativeDifference, 0); assert.deepEqual(o.first.curveD0, o.second.curveD0);
      for (const [side, parameter] of [[o.first, o.canonicalParameter], [o.second, o.secondParameter]]) {
        const asset = child.assets.find(a => a.sourceId === side.reference.sourceId), curve = asset.face.geometry.objects.find(object => object.id === side.reference.curveId);
        assert.ok(curve && curve.kind === 'curve'); assert.equal(curve.degree, 1); assert.deepEqual(curve.knots, [0, 0, 1, 1]); assert.deepEqual(curve.weights, [1, 1]);
        const derivative = curve.controlPoints[1].map((x, axis) => x - curve.controlPoints[0][axis]);
        const point = curve.controlPoints[0].map((x, axis) => x + derivative[axis] * parameter);
        assert.deepEqual(side.curveD0, point); assert.deepEqual(side.curveD1.point, point); assert.deepEqual(side.curveD1.derivative, derivative);
      }
    }
    for (const key of Object.keys(sums)) sums[key] += child.report[key];
  });
  assert.deepEqual(sums, { sourceCompilationCount: 24, faceValidationCount: 24, boundaryExtractionCount: 24, curveReversalCount: 12, observationPairCount: 36, curvePointEvaluationCount: 72, curveDerivativeEvaluationCount: 72 });
  assert.deepEqual(shell.report.childDirectCounts, sums); assert.deepEqual(e.report.shellChildDirectCounts, sums);
  assert.equal(shell.graph.vertices.length, 8); assert.equal(shell.graph.edges.length, 12); assert.equal(shell.graph.faces.length, 6); assert.equal(shell.graph.vertexLinks.length, 8);
  const allCorners = [...corners, ...corners.map(p => [p[0], p[1], h])].map(nativeJSON).sort();
  assert.deepEqual(shell.graph.vertices.map(v => nativeJSON(v.representative.pointMM)).sort(), allCorners);
  shell.graph.vertexLinks.forEach(link => { assert.equal(link.cornerArcs.length, 3); assert.equal(link.orientedCycleEdgeIds.length, 3); assert.equal(new Set(link.orientedCycleEdgeIds).size, 3); for (const degree of link.degrees) { assert.equal(degree.degree, 2); assert.equal(degree.incoming, 1); assert.equal(degree.outgoing, 1); } });
  for (const key of ['closed', 'orientedClosedIncidence', 'abstractIncidenceManifold']) assert.equal(shell.report[key], true);
  assert.equal(shell.report.globalFreeBoundaryCount, 0); assert.equal(shell.report.eulerCharacteristic, 2); assert.equal(shell.report.solid, false); assert.equal(shell.report.embeddedManifoldCertified, false);
  assert.equal(e.report.directCounts.totalDelegationCount, 18); assert.equal(e.report.directCounts.affineTransformCallCount, 0);
  assert.deepEqual(e.report.boundsMM, { min: [0, -w / 2, 0], max: [100, w / 2, h] }); assert.equal(e.report.diagnostics.volumeMM3, 100 * w * h);
  assert.deepEqual(e.report.fileSizes.request, size(nativeJSON(e.request) + '\n')); assert.deepEqual(e.report.fileSizes.result, size(nativeJSON(e) + '\n'));
}
function currentOracle(result) {
  assert.deepEqual(Object.keys(result).sort(), ['document', 'options', 'width', 'extrusion', 'bindings', 'report'].sort());
  const d = result.document, b = result.bindings, r = result.report, active = !d.nodes[1].suppressed;
  assert.deepEqual(d.asset, document.asset); assert.deepEqual(result.options, graphOptions);
  assert.deepEqual(d.parameters.map(p => p.id), ['width', 'height']); assert.deepEqual(d.nodes.map(n => n.id), ['width_node', 'extrusion_node']);
  assert.equal(b.graphId, d.id); assert.equal(b.revision, d.revision); assert.equal(r.revision, d.revision);
  assert.deepEqual(b.parameters, d.parameters.map((p, i) => ({ index: i, parameterId: p.id, kind: 'length', unit: 'mm', valueMM: p.valueMM, nodeId: d.nodes[i].id, role: i === 0 ? 'width' : 'height' })));
  const dependencies = [{ nodeId: 'width_node', dependencyNodeIds: [], sourceIds: ['original_source'], parameterIds: ['width'] }, { nodeId: 'extrusion_node', dependencyNodeIds: ['width_node'], sourceIds: [], parameterIds: ['height'] }];
  assert.deepEqual(b.dependencies, dependencies); assert.deepEqual(r.dependencies, dependencies);
  assert.deepEqual(b.width, { nodeId: d.nodes[0].id, sourceId: d.asset.sourceId, widthParameterId: d.parameters[0].id, curveId: d.asset.curveId, modelName: result.width.originalModel.name, selectedObjectIndex: 1, faceId: result.width.face.topology.face.id, provider: result.width.bindings });
  assert.equal(b.extrusion.status, active ? 'active' : 'suppressed'); assert.equal(b.extrusion.inputFaceId, result.width.face.topology.face.id); assert.deepEqual(b.extrusion.provider, result.extrusion?.bindings ?? null);
  assert.equal(b.extrusion.nodeId, d.nodes[1].id); assert.equal(b.extrusion.inputNodeId, d.nodes[0].id); assert.equal(b.extrusion.heightParameterId, d.parameters[1].id); assert.equal(b.extrusion.evaluationId, d.nodes[1].options.evaluationId);
  const contexts = [['original', result.width.originalModel, 'document.asset.source', 'width.originalModel', 'original_source'], ['ruled', result.width.ruled.model, 'width.ruled.source', 'width.ruled.model', null], ['face', result.width.face.model, 'width.face.source', 'width.face.model', null]];
  for (const [context, model, sourceField, modelField, authoredSourceId] of contexts) assert.deepEqual(b.sources[context], { context, authoredSourceId, sourceField, modelField, modelName: model.name, sourceVersion: 0 });
  const corners = rectangleOracle(result); if (active) extrusionOracle(result, corners); else assert.equal(result.extrusion, null);
  assert.deepEqual(r.receiptCounts, { widthReceiptCount: 1, extrusionReceiptCount: active ? 1 : 0, featureReceiptCount: active ? 2 : 1 }); assert.deepEqual(r.retainedProviderCounts, providers(result));
  assert.equal(r.widthMM, d.parameters[0].valueMM); assert.equal(r.heightMM, d.parameters[1].valueMM); assert.equal(r.extrusionStatus, active ? 'active' : 'suppressed');
  assert.equal(r.shellId, active ? d.nodes[1].options.evaluationId : null); assert.equal(b.extrusion.shellId, r.shellId);
  assert.equal(r.sourceId, d.asset.sourceId); assert.equal(r.originalCurveId, d.asset.curveId); assert.equal(r.originalModelName, result.width.originalModel.name); assert.equal(r.selectedObjectIndex, 1); assert.equal(r.faceId, result.width.face.topology.face.id);
  assert.deepEqual(r.nodeOrder, d.nodes.map(n => n.id)); assert.deepEqual(r.parameterOrder, d.parameters.map(p => p.id));
  assert.deepEqual(r.sourceSizes, { original: size(source), ruled: size(result.width.ruled.source), face: size(result.width.face.source) });
  assert.deepEqual(r.fileSizes.request, size(nativeJSON({ document: d, options: result.options }) + '\n')); assert.deepEqual(r.fileSizes.result, size(nativeJSON(result) + '\n')); assert.deepEqual(r.fileSizes.authored, size(nativeJSON(d) + '\n'));
  assert.equal(r.quality.closedAbstractShellProduced, active); for (const key of ['solid', 'embeddedManifoldCertified', 'volumeCertified', 'source2Expressions', 'sourcePoleSubstitution', 'editorDisplayCertified', 'publication']) assert.equal(r.quality[key], false);
  assert.equal(r.workScope, 'retained-receipts-not-selective-constructor-call-counts'); assert.equal(r.limits.maximumResultUTF8, 8388608); assert.equal(r.limits.maximumUpdateUTF8, 16777216); assert.equal(r.limits.ownValues, 2097152); assert.equal(r.limits.updateOwnValues, 4194304);
  assert.ok(Object.is(result.width.originalCurve.controlPoints[0][1], -0));
}
function saveCurrent(name, result) {
  currentOracle(result); const path = saveJSON(name + '-current', result); saveJSON(name + '-document', result.document, 2097152);
  cold(source, result.width.originalModel, name + '-original'); cold(result.width.ruled.source, result.width.ruled.model, name + '-ruled-model3'); cold(result.width.face.source, result.width.face.model, name + '-face-model5');
  if (result.extrusion) { result.extrusion.walls.forEach((wall, i) => cold(wall.source, wall.model, name + '-wall' + i + '-model3')); result.extrusion.shell.assets.forEach((asset, i) => cold(asset.source, asset.face.geometry, name + '-asset' + i + '-model5')); }
  additionalWork.currentOwnedCalls++; assert.deepEqual(validate(result), result.report); retain(result);
  states.push({ name, path, revision: result.document.revision, widthMM: result.report.widthMM, heightMM: result.report.heightMM, status: result.report.extrusionStatus, resultHash: hash(result), fileSizes: result.report.fileSizes, retainedProviderCounts: result.report.retainedProviderCounts }); return result;
}
function transactionOracle(previous, edits, wrapper, expected) {
  assert.deepEqual(Object.keys(wrapper).sort(), ['result', 'transaction'].sort()); assert.deepEqual(Object.keys(wrapper.transaction).sort(), ['request', 'report'].sort());
  const next = wrapper.result, tx = wrapper.transaction.report, oldDoc = previous.document, doc = next.document;
  assert.deepEqual(wrapper.transaction.request, { previousDocument: oldDoc, options: previous.options, edits });
  assert.equal(doc.revision, oldDoc.revision + 1); assert.deepEqual(doc.asset, oldDoc.asset); assert.deepEqual(doc.nodes[0], oldDoc.nodes[0]); assert.deepEqual(doc.nodes[1].options, oldDoc.nodes[1].options);
  const wc = !Object.is(doc.parameters[0].valueMM, oldDoc.parameters[0].valueMM), hc = !Object.is(doc.parameters[1].valueMM, oldDoc.parameters[1].valueMM), sc = doc.nodes[1].suppressed !== oldDoc.nodes[1].suppressed, resumed = oldDoc.nodes[1].suppressed && !doc.nodes[1].suppressed;
  assert.equal(tx.widthChanged, wc); assert.equal(tx.heightChanged, hc); assert.equal(tx.suppressionChanged, sc); assert.equal(tx.resumed, resumed); assert.equal(tx.noOp, !wc && !hc && !sc);
  assert.deepEqual(tx.changedParameterIds, doc.parameters.filter((p, i) => !Object.is(p.valueMM, oldDoc.parameters[i].valueMM)).map(p => p.id));
  assert.equal(tx.widthAction, expected[0] ? 'rebuilt' : 'retained'); assert.equal(tx.extrusionAction, doc.nodes[1].suppressed ? 'suppressed' : expected[1] ? 'rebuilt' : 'retained');
  assert.equal(tx.sourceEffectChanged, nativeJSON(next.width.face) !== nativeJSON(previous.width.face)); assert.equal(tx.extrusionRequestChanged, nativeJSON(next.extrusion?.request ?? null) !== nativeJSON(previous.extrusion?.request ?? null));
  assert.deepEqual(tx.directCounts, operationCounts(...expected));
  assert.deepEqual(tx.validationCounts, { previousGraphRebuildCount: 1, directCounts: operationCounts(1, previous.extrusion ? 1 : 0), providers: providers(previous) });
  assert.deepEqual(tx.changedProviderCounts, { width: expected[0] ? next.width.report.directCounts : null, extrusion: expected[1] ? next.extrusion.report.directCounts : null, shellChildren: expected[1] ? next.extrusion.report.shellChildDirectCounts : null });
  if (!expected[0]) assert.deepEqual(next.width, previous.width); if (!expected[1] && next.extrusion) assert.deepEqual(next.extrusion, previous.extrusion);
  assert.equal(tx.previousRevision, oldDoc.revision); assert.equal(tx.revision, doc.revision); assert.equal(tx.atomic, true); assert.equal(tx.unchangedNativeReceiptsCopied, true);
  assert.deepEqual(tx.fileSizes.update, size(nativeJSON(wrapper) + '\n'));
}
function selective(name, previous, parameterEdits, extrusionSuppressed, expected) {
  const edits = { expectedRevision: previous.document.revision, revision: previous.document.revision + 1, parameterEdits, extrusionSuppressed };
  const before = nativeJSON({ previous, edits }); additionalWork.updateCalls++; const wrapper = update(previous, edits);
  assert.equal(nativeJSON({ previous, edits }), before); ownership({ previous, edits }, wrapper); transactionOracle(previous, edits, wrapper, expected);
  additionalWork.currentColdOracles++; assert.deepEqual(evaluate(wrapper.result.document, graphOptions), wrapper.result, 'Every updated current state equals fresh authored construction');
  additionalWork.updateOwnedCalls++; assert.deepEqual(validateUpdate(wrapper), wrapper.transaction.report);
  saveJSON(name + '-update', wrapper, 16777216); saveCurrent(name, wrapper.result); retain(edits); retain(wrapper);
  transactions.push({ name, revision: wrapper.result.document.revision, validation: wrapper.transaction.report.validationCounts, selective: wrapper.transaction.report.directCounts, changedProviders: wrapper.transaction.report.changedProviderCounts, additionalColdOracle: 1 }); return wrapper;
}
function authoredOrderOracle(text, expectedDocument) {
  assert.equal(text.split('\n').length, 2, 'Canonical authored file has exactly one final newline');
  assert.ok(text.endsWith('\n'));
  // JSON.parse is only a key-order oracle here. The product public parser below
  // performs the actual strict admission and full native reconstruction.
  const decoded = JSON.parse(text);
  assert.deepEqual(decoded, expectedDocument);
  assert.deepEqual(Object.keys(decoded), ['format', 'version', 'id', 'revision', 'lengthUnit', 'sourceFrame', 'asset', 'parameters', 'nodes']);
  function checkNested(value) {
    if (Array.isArray(value)) value.forEach(checkNested);
    else if (value && typeof value === 'object') {
      assert.deepEqual(Object.keys(value), Object.keys(value).sort(), 'Nested authored record keys are alphabetic');
      Object.values(value).forEach(checkNested);
    }
  }
  Object.values(decoded).forEach(checkNested);
}
saveJSON('source-api-metafile', bundle.metafile); saveJSON('source-api-inputs', { entry, inputs, esbuildVersion: esbuild.version, publicOnlyNoDemoBridge: true });
additionalWork.freshEvaluations++; const baseline = evaluate(document, graphOptions); ownership({ document, graphOptions }, baseline); saveCurrent('revision0-width5-height10', baseline); retain(document); retain(graphOptions);
const r1 = selective('revision1-width8', baseline, [{ parameterId: 'width', valueMM: 8 }], null, [1, 1]);
const r2 = selective('revision2-height12', r1.result, [{ parameterId: 'height', valueMM: 12 }], null, [0, 1]);
assert.deepEqual(r2.result.width, r1.result.width); assert.equal(r2.transaction.report.validationCounts.directCounts.widthBuildCallCount + r2.transaction.report.directCounts.widthBuildCallCount, 1);
const r3 = selective('revision3-suppress', r2.result, [], true, [0, 0]); assert.equal(r3.result.extrusion, null);
const r4 = selective('revision4-resume', r3.result, [], false, [0, 1]);
additionalWork.serializeCalls++; const authored = serialize(r4.result.document, graphOptions); authoredOrderOracle(authored, r4.result.document);
const authoredPath = saveText('revision4-authored.graph.json', authored); additionalWork.parseCalls++; let fresh = parse(readFileSync(authoredPath, 'utf8'), graphOptions);
assert.deepEqual(fresh, r4.result); assert.equal(fresh.document.asset.source, source); saveJSON('revision4-fresh-public-open', fresh);
additionalWork.serializeCalls++; assert.equal(serialize(fresh.document, graphOptions), authored, 'Public writer is idempotent after strict public reopen');
const r5 = selective('revision5-width6-on-fresh-open', fresh, [{ parameterId: 'width', valueMM: 6 }], null, [1, 1]); fresh = null;
additionalWork.serializeCalls++; const secondAuthored = serialize(r5.result.document, graphOptions), secondPath = saveText('revision5-authored.graph.json', secondAuthored);
authoredOrderOracle(secondAuthored, r5.result.document);
additionalWork.parseCalls++; const secondOpen = parse(readFileSync(secondPath, 'utf8'), graphOptions); assert.deepEqual(secondOpen, r5.result);
const r6 = selective('revision6-semantic-noop', secondOpen, [{ parameterId: 'width', valueMM: 6 }, { parameterId: 'height', valueMM: 12 }], false, [0, 0]); assert.equal(r6.transaction.report.noOp, true);
saveJSON('public-authored-save-open-proof', { authoredPath, authoredHash: hash(authored), secondPath, secondHash: hash(secondAuthored), fullColdEquality: true, fixedRootOrderAndSortedNestedKeys: true, publicWriterIdempotence: true, originalSourceBytesPreserved: true, source0NotSource2Expressions: true, noDerivedCacheInAuthoredFile: !authored.includes('pairResults'), privateDemoBridge: false });

function badDocument(name, mutate, expected) { const bad = clone(document); mutate(bad); reject(name, () => evaluate(bad, graphOptions), expected); }
for (const [name, mutate, expected] of [
  ['version', d => { d.version = 1; }, 'VERSION'], ['negative-zero-version', d => { d.version = -0; }, 'VERSION'],
  ['source-version', d => { d.asset.sourceVersion = 2; }, 'VERSION'], ['parameter-order', d => { d.parameters.reverse(); }, ['REFERENCE', 'PARAMETER']],
  ['node-order', d => { d.nodes.reverse(); }, ['REFERENCE', 'INPUT']], ['parameter-unit', d => { d.parameters[0].unit = 'cm'; }, 'PARAMETER'],
  ['parameter-kind', d => { d.parameters[0].kind = 'scalar'; }, 'PARAMETER'], ['width-zero', d => { d.parameters[0].valueMM = 0; }, 'PARAMETER'],
  ['height-over-profile', d => { d.parameters[1].valueMM = 10001; }, 'PARAMETER'], ['width-reference', d => { d.nodes[0].widthParameterId = 'height'; }, 'REFERENCE'],
  ['source-reference', d => { d.nodes[0].sourceId = 'absent'; }, 'REFERENCE'], ['self-reference', d => { d.nodes[1].faceNodeId = 'extrusion_node'; }, 'REFERENCE'],
  ['logical-id-collision', d => { d.id = d.asset.sourceId; }, 'IDENTITY'], ['reverse-profile', d => { d.nodes[0].options.face.orientation = 'reverse'; }, 'PROFILE'],
  ['direction-profile', d => { d.nodes[1].options.direction = 'negative-z'; }, 'PROFILE'], ['real-sibling-role-collision', d => { d.asset.source = source.replace('#untouched_curve', '#gx_s_b'); }, 'IDENTITY'],
  ['original-source-invalid', d => { d.asset.source += '@broken'; }, ['SOURCE', 'WIDTH']], ['source-string-cap', d => { d.asset.source = ' '.repeat(262145); }, ['BUDGET', 'INPUT']],
  ['revision-cap', d => { d.revision = 1000000001; }, 'REVISION']
]) badDocument(name, mutate, expected);
const suppressedRoleDoc = clone(document);
suppressedRoleDoc.asset.source = source.replace('#untouched_curve', '#gx_s_b');
suppressedRoleDoc.nodes[1].suppressed = true;
const suppressedRoleFailure = reject('planned-role-collision-while-suppressed', () => evaluate(suppressedRoleDoc, graphOptions), 'IDENTITY');
assert.equal(suppressedRoleFailure.context.directCounts.extrusionBuildCallCount, 0);
reject('producer-budget', () => evaluate(document, { ...graphOptions, maximumProducerEvaluations: 1 }), 'BUDGET');
reject('width-budget', () => evaluate(document, { ...graphOptions, maximumWidthEvaluations: 0 }), 'BUDGET');
const affineRefusalDoc = clone(document);
affineRefusalDoc.asset.source = source.replace('[[0,-0,0],[+100.000,0,0]]', '[[-10000,-0,0],[0.000001,0,0]]');
assert.notEqual(affineRefusalDoc.asset.source, source);
additionalWork.sourceColdCompiles++; const affineOriginal = compileCadModel(affineRefusalDoc.asset.source, { sourceVersion: 0 });
assert.equal(affineOriginal.ok, true, JSON.stringify(affineOriginal.diagnostics));
saveText('affine-parent-refusal-original.source0.css', affineRefusalDoc.asset.source);
saveJSON('affine-parent-refusal-original-model', affineOriginal.model);
const affineFailure = reject('actual-affine-parent-refusal', () => evaluate(affineRefusalDoc, graphOptions), 'WIDTH');
assert.equal(affineFailure.cause?.code, 'FACE', 'Preserve the actual qualified legacy Face refusal');
const final = r6.result, nextEdits = { expectedRevision: 6, revision: 7, parameterEdits: [], extrusionSuppressed: null };
for (const [name, patch, expected] of [['stale-revision', { expectedRevision: 5 }, 'REVISION'], ['skipped-revision', { revision: 8 }, 'REVISION'], ['repeated-parameter', { parameterEdits: [{ parameterId: 'width', valueMM: 7 }, { parameterId: 'width', valueMM: 8 }] }, ['IDENTITY', 'PARAMETER']], ['unknown-edit-ref', { parameterEdits: [{ parameterId: 'absent', valueMM: 7 }] }, 'REFERENCE'], ['bad-height-edit', { parameterEdits: [{ parameterId: 'height', valueMM: -1 }] }, 'PARAMETER']]) reject(name, () => update(final, { ...nextEdits, ...patch }), expected);
reject('unsupported-source-replacement', () => update(final, { ...nextEdits, source: source + ' ' }), 'INPUT');
let getterCalls = 0; const getterDoc = clone(document); Object.defineProperty(getterDoc, 'revision', { enumerable: true, get() { getterCalls++; return 0; } });
reject('getter-zero', () => evaluate(getterDoc, graphOptions), 'INPUT'); assert.equal(getterCalls, 0);
const cycle = clone(document); cycle.asset.source = cycle; reject('cycle', () => evaluate(cycle, graphOptions), 'INPUT');
const sparse = clone(document); delete sparse.parameters[0]; reject('sparse', () => evaluate(sparse, graphOptions), 'INPUT');
const hidden = clone(document); Object.defineProperty(hidden, 'hidden', { value: true, enumerable: false }); reject('hidden', () => evaluate(hidden, graphOptions), 'INPUT');
const symbol = clone(document); symbol[Symbol('foreign')] = true; reject('symbol', () => evaluate(symbol, graphOptions), 'INPUT');
const foreign = clone(document); Object.setPrototypeOf(foreign.asset, Date.prototype); reject('foreign-prototype', () => evaluate(foreign, graphOptions), 'INPUT');
for (const [name, text, expected] of [
  ['decoded-duplicate-key', authored.replace('"revision":4', '"revision":4,"\\u0072evision":4'), 'CODEC'],
  ['unsupported-codec-version', authored.replace('"version":0', '"version":1'), 'VERSION'],
  ['truncated-codec', authored.slice(0, -4), 'CODEC'], ['derived-cache-codec', nativeJSON({ ...r4.result.document, cache: true }) + '\n', 'INPUT'],
  ['raw-invalid-unicode', '{"format":"' + String.fromCharCode(0xd800) + '"}', 'CODEC'], ['raw-authored-cap', ' '.repeat(2097153), 'FILE']
]) {
  if (name === 'raw-invalid-unicode') saveJSON('refused-' + name + '-utf16', { codeUnits: Array.from({ length: text.length }, (_, i) => text.charCodeAt(i)), invalidRawStringRetainedAsCodeUnits: true });
  else saveText('refused-' + name + '.txt', name === 'raw-authored-cap' ? 'Rejected raw file contains2097153 ASCII spaces; compact record only.\n' : text);
  reject(name, () => parse(text, graphOptions), expected);
}
for (const [name, mutate] of [
  ['document-parameter', r => { r.document.parameters[0].valueMM += 1; }], ['source', r => { r.document.asset.source += ' '; }],
  ['width-original', r => { r.width.originalCurve.weights[0] += 1; }], ['width-face', r => { r.width.face.plane.controlPoints[0][0][1] -= 1; }],
  ['width-source', r => { r.width.face.source += ' '; }], ['extrusion-request', r => { r.extrusion.request.options.distanceMM += 1; }],
  ['extrusion-map', r => { r.extrusion.translation.coefficientMappings[0].translatedPointMM[2] += 1; }],
  ['shell-source', r => { r.extrusion.shell.assets[0].source += ' '; }], ['shell-vertex-link', r => { r.extrusion.shell.graph.vertexLinks[0].degrees[0].incoming++; }],
  ['binding-revision', r => { r.bindings.revision++; }], ['retained-count', r => { r.report.retainedProviderCounts.width.producerDelegationCount++; }],
  ['result-size', r => { r.report.fileSizes.result.utf8++; }], ['solid-claim', r => { r.report.quality.solid = true; }]
]) { const bad = clone(final), before = nativeJSON(bad); mutate(bad); assert.notEqual(nativeJSON(bad), before, name); additionalWork.currentOwnedCalls++; reject('owned-current-' + name, () => validate(bad), 'OWNED'); ownedControls.push({ kind: 'current', name, nonNoop: true }); }
for (const [name, mutate] of [
  ['previous-document', r => { r.transaction.request.previousDocument.parameters[1].valueMM += 1; }],
  ['edit-value', r => { r.transaction.request.edits.parameterEdits[0].valueMM += 1; }],
  ['selective-count', r => { r.transaction.report.directCounts.widthBuildCallCount++; }], ['validation-count', r => { r.transaction.report.validationCounts.previousGraphRebuildCount++; }],
  ['result-binding', r => { r.result.bindings.revision++; }], ['transaction-size', r => { r.transaction.report.fileSizes.update.utf8++; }]
]) { const bad = clone(r5), before = nativeJSON(bad); mutate(bad); assert.notEqual(nativeJSON(bad), before, name); additionalWork.updateOwnedCalls++; reject('owned-update-' + name, () => validateUpdate(bad), 'OWNED'); ownedControls.push({ kind: 'update', name, nonNoop: true }); }
let accepted = final;
reject('atomic-stale-update', () => { accepted = update(final, { ...nextEdits, expectedRevision: 5 }).result; }, 'REVISION'); assert.strictEqual(accepted, final); retention();
saveJSON('atomic-and-cap-scope', { previousStatesSourcesFilesPreserved: true, getterCalls, sourceStringCapAttempted: true, authoredRawCapReached: true, validCurrent8MiBOverflowTested: false, validUpdate16MiBOverflowTested: false, noForcedOverflowFixture: true, falseSolidEmbeddingMaterialFlagsPreserved: true });

const packageRoot = resolve(repo, 'packages/barocss-cad'), manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const exports = manifest.publishConfig?.exports?.['.'] ?? manifest.exports['.'];
const runtimePath = resolve(packageRoot, exports.import), declarationPath = resolve(packageRoot, exports.types), leafDeclarationPath = resolve(packageRoot, 'dist/nurbs/source-wide/source-line-width-extrusion-graph.d.ts');
const publicAPI = await import(pathToFileURL(runtimePath).href);
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.SourceLineWidthExtrusionGraphDiagnosticCode, codes);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./source-line-width-extrusion-graph.js'));
for (const name of [...runtimeNames, ...typeNames]) assert.ok(readFileSync(leafDeclarationPath, 'utf8').includes(name), name);
const savedMain = JSON.parse(readFileSync(states[0].path, 'utf8'));
additionalWork.publicEvaluateCalls++; assert.deepEqual(publicAPI.evaluateSourceLineWidthExtrusionGraph(savedMain.document, savedMain.options), savedMain);
additionalWork.publicOwnedCalls++; assert.deepEqual(publicAPI.validateSourceLineWidthExtrusionGraph(savedMain), savedMain.report);
additionalWork.publicUpdateCalls++; assert.deepEqual(publicAPI.updateSourceLineWidthExtrusionGraph(r1.result, r2.transaction.request.edits), r2);
additionalWork.publicUpdateOwnedCalls++; assert.deepEqual(publicAPI.validateSourceLineWidthExtrusionGraphUpdate(r2), r2.transaction.report);
additionalWork.publicSerializeCalls++; assert.equal(publicAPI.serializeSourceLineWidthExtrusionGraph(r4.result.document, graphOptions), authored);
additionalWork.publicParseCalls++; assert.deepEqual(publicAPI.parseSourceLineWidthExtrusionGraph(authored, graphOptions), r4.result);
const emittedArtifacts = ['index.js', 'index.d.ts', 'source-line-width-extrusion-graph.js', 'source-line-width-extrusion-graph.d.ts'].map(name => { const path = resolve(packageRoot, 'dist', name), bytes = readFileSync(path); return { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }; });
saveJSON('compiled-public-consumer', { runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 16, mainEvaluateOwnedReplay: 1, actualHeightUpdateAndCodecReplay: true, emittedArtifacts });
retention();
const summary = { schema: 'barocss-source-line-width-extrusion-graph-demo', version: 0, nativeParent: '3505af21fa1e563e1aec848b4452432baf4cf0f2', sourceOnlyMetafile: true, publicNames: 16, states, transactions, failures, ownedControls, additionalWork, getterCalls, sourceHash: hash(source), authoredHashes: [hash(authored), hash(secondAuthored)], geometryScope: 'native-forward-width-face-and-closed-abstract-shell', solid: false, embedding: false, volumeCertified: false, source2FormulaLowering: false, directNativeSamplers: 0, rationalCampaign: false, lifecycle: 'rev0w5h10/rev1w8/rev2h12/rev3suppress/rev4resume-save-fresh-parse/rev5w6/rev6semantic-noop', extraValidationAndColdWorkIsSeparate: true };
saveJSON('summary', summary); console.log(nativeJSON(summary));
