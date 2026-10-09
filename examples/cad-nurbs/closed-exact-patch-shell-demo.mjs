import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node closed-exact-patch-shell-demo.mjs --source <output-directory>'); assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]); mkdirSync(output, {recursive: true});
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json')), esbuild = require('esbuild');
const entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundle = await esbuild.build({absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true});
assert.equal(bundle.outputFiles.length, 1);
const sourceInputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path)), cadInputs = sourceInputs.filter(path => path.includes('/packages/barocss-cad/'));
for (const leaf of ['index.ts', 'closed-exact-patch-shell.ts', 'exact-boundary-face-adjacency.ts', 'face.ts', 'curve-reversal.ts']) assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const {buildClosedExactPatchShell: build, validateClosedExactPatchShell: validate, ClosedExactPatchShellError, ClosedExactPatchShellDiagnosticCode,
  buildExactBoundaryFaceAdjacency, ExactBoundaryFaceAdjacencyError, buildParametricFace, validateFaceBundle,
  editSurfaceControlNet, reverseSurfaceAxis, evaluateCurve, evaluateCurveD1, evaluateSurface, extractSurfaceBoundary, buildAxisBoxShell, compileCadModel} = api;
const runtimeNames = ['buildClosedExactPatchShell', 'validateClosedExactPatchShell', 'ClosedExactPatchShellError', 'ClosedExactPatchShellDiagnosticCode'];
const typeNames = ['ClosedExactPatchShellOptions', 'ClosedExactPatchShellGraph', 'ClosedExactPatchShellReport', 'ClosedExactPatchShellResult'];
for (const name of runtimeNames) assert.equal(typeof api[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(Object.keys(ClosedExactPatchShellDiagnosticCode).sort(), ['INPUT', 'IDENTITY', 'BUDGET', 'COVERAGE', 'CONNECTED', 'BINDING', 'NATIVE', 'INCIDENCE', 'OWNED'].sort());
const retainedFiles = new Map(), nativeInputs = [], assetsBefore = [], accepted = [], cases = [], failures = [];
function nativeJSON(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || ['string', 'boolean'].includes(typeof value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}';
}
function jsonFile(name, value) {
  const file = resolve(output, name + '.json'); writeFileSync(file, nativeJSON(value) + '\n'); retainedFiles.set(file, readFileSync(file));
  const reopened = JSON.parse(readFileSync(file, 'utf8')); assert.deepEqual(reopened, value); return {file, reopened};
}
function sourceFile(name, source, model) {
  const file = resolve(output, name + '.source0.css'); writeFileSync(file, source); retainedFiles.set(file, readFileSync(file));
  const cold = compileCadModel(readFileSync(file, 'utf8'), {sourceVersion: 0}); assert.equal(cold.ok, true, JSON.stringify(cold.diagnostics)); assert.deepEqual(cold.model, model); return file;
}
function modelSource(model) {
  const decimal = value => Object.is(value, -0) ? '-0' : String(value), list = values => '[' + values.map(decimal).join(',') + ']', poles = points => '[' + points.map(list).join(',') + ']';
  const object = geometry => geometry.kind === 'curve' ? '@curve #' + geometry.id + ' { type:nurbs; degree:' + geometry.degree + '; knots:' + list(geometry.knots) +
    '; control-points:' + poles(geometry.controlPoints) + '; weights:' + list(geometry.weights) + '; }' :
    '@surface #' + geometry.id + ' { type:nurbs; degree-u:' + geometry.degreeU + '; degree-v:' + geometry.degreeV + '; knots-u:' + list(geometry.knotsU) +
    '; knots-v:' + list(geometry.knotsV) + '; control-points:[' + geometry.controlPoints.map(poles).join(',') + ']; weights:[' + geometry.weights.map(list).join(',') + ']; }';
  return '@model ' + model.name + ' { version:0; length-unit:mm; ' + model.objects.map(object).join(' ') + ' }\n';
}
function ownership(inputs, result) {
  const caller = new WeakSet(), seen = new WeakSet();
  const collect = value => { if (value && typeof value === 'object' && !caller.has(value)) { caller.add(value); for (const child of Object.values(value)) collect(child); }};
  inputs.forEach(collect);
  const visit = value => { if (value && typeof value === 'object') {
    assert.ok(!caller.has(value), 'Caller alias'); assert.ok(!seen.has(value), 'Repeated result occurrence'); seen.add(value); for (const child of Object.values(value)) visit(child);
  }}; visit(result);
}
function bits(actual, expected) {
  if (typeof expected === 'number') { assert.ok(Object.is(actual, expected), 'Native source/reference/point bits changed'); return; }
  assert.deepEqual(actual, expected); if (expected && typeof expected === 'object') for (const key of Object.keys(expected)) bits(actual[key], expected[key]);
}
const close = (actual, expected) => assert.ok(Math.hypot(...actual.map((value, i) => value - expected[i])) <= 1e-7);
const localIds = {faceId: 'face_local', loopId: 'loop_local', vertexIds: ['v0', 'v1', 'v2', 'v3'], edgeIds: ['e0', 'e1', 'e2', 'e3'], curveIds: ['c0', 'c1', 'c2', 'c3']};
const boundaries = ['v-min', 'u-max', 'v-max', 'u-min'];
function asset(sourceId, surface, fileName = sourceId) {
  const face = buildParametricFace(surface, localIds); assert.deepEqual(validateFaceBundle(face), {incidenceValid: true, geometricValidity: 'not-certified', solid: false});
  assert.equal(face.geometry.objects.length, 5); const source = modelSource(face.geometry), file = sourceFile(fileName + '.actual-face', source, face.geometry);
  const result = {sourceId, source, face}; assetsBefore.push({asset: result, before: structuredClone(result), file}); return result;
}
const tensor = (i, j, k) => [5 * i, 5 * j, 5 * k + 4 * (i === 2 ? 1 : 0) * (j / 2)];
const patch = (id, point) => ({kind: 'surface', id, degreeU: 2, degreeV: 2, knotsU: [0, 0, 0, 1, 1, 1], knotsV: [0, 0, 0, 1, 1, 1],
  controlPoints: Array.from({length: 3}, (_, u) => Array.from({length: 3}, (_, v) => point(u, v))), weights: Array.from({length: 3}, () => [1, 1, 1])});
const surfaces = [patch('patch_A', (u, v) => tensor(0, v, u)), patch('patch_B', (u, v) => tensor(2, u, v)),
  patch('patch_C', (u, v) => tensor(u, 0, v)), patch('patch_D', (u, v) => tensor(v, 2, u)),
  patch('patch_E', (u, v) => tensor(v, u, 0)), patch('patch_F', (u, v) => tensor(u, v, 2))];
nativeInputs.push({value: surfaces, before: structuredClone(surfaces)});
const assets = surfaces.map((surface, i) => asset('ABCDEF'[i], surface, 'cube.' + 'ABCDEF'[i]));
const pair = (firstSource, firstBoundary, secondSource, secondBoundary) => ({first: {sourceId: firstSource, boundary: firstBoundary}, second: {sourceId: secondSource, boundary: secondBoundary}});
const pairs = [pair('A', 'v-min', 'C', 'u-min'), pair('A', 'v-max', 'D', 'v-min'), pair('A', 'u-min', 'E', 'v-min'), pair('A', 'u-max', 'F', 'u-min'),
  pair('B', 'u-min', 'C', 'u-max'), pair('B', 'u-max', 'D', 'v-max'), pair('B', 'v-min', 'E', 'v-max'), pair('B', 'v-max', 'F', 'u-max'),
  pair('C', 'v-min', 'E', 'u-min'), pair('C', 'v-max', 'F', 'v-min'), pair('D', 'u-min', 'E', 'u-max'), pair('D', 'u-max', 'F', 'v-max')];
const settings = (name, prefix) => ({shellId: name, resultIdPrefix: prefix, maximumPairEvaluations: 12, maximumObservationPairs: 36});
const shellOptions = settings('warped_shell', 'shell');
function check(name, inputs, pairs, options, expectedVertices, expectedLinkSize) {
  const before = structuredClone({inputs, pairs, options}), request = jsonFile(name + '.authored-request', {assets: inputs, pairs, options});
  const result = build(inputs, pairs, options); ownership([inputs, pairs, options], result); bits({inputs, pairs, options}, before);
  assert.deepEqual(Object.keys(result).sort(), ['assets', 'pairs', 'options', 'pairResults', 'graph', 'report'].sort()); bits(result.assets, inputs); bits(result.pairs, pairs); bits(result.options, options);
  assert.deepEqual(Object.keys(result.graph).sort(), ['vertices', 'edges', 'faces', 'vertexLinks'].sort());
  const graph = result.graph, report = result.report; assert.equal(graph.faces.length, inputs.length); assert.equal(graph.edges.length, pairs.length); assert.equal(graph.vertices.length, expectedVertices); assert.equal(graph.vertexLinks.length, expectedVertices);
  assert.equal(report.schema, 'barocss-closed-exact-patch-shell'); assert.equal(report.version, 0); assert.equal(report.shellId, options.shellId);
  assert.equal(report.lengthUnit, 'mm'); assert.equal(report.sourceFrame, 'authored-xyz-no-axis-conversion');
  assert.equal(report.faceCount, inputs.length); assert.equal(report.edgeCount, pairs.length); assert.equal(report.vertexClassCount, expectedVertices); assert.equal(report.vertexLinkCount, expectedVertices);
  assert.equal(report.cornerArcCount, 4 * inputs.length); assert.equal(report.globalFreeBoundaryCount, 0); assert.equal(report.connectedFaceGraph, true); assert.equal(report.orientedClosedIncidence, true);
  assert.equal(report.abstractIncidenceManifold, true); assert.equal(report.closed, true); assert.equal(report.solid, false); assert.equal(report.geometricValidity, 'not-certified'); assert.equal(report.embeddedManifoldCertified, false);
  assert.equal(report.selfIntersectionCertified, false); assert.equal(report.insideOutsideCertified, false);
  assert.equal(report.quality.childClosedFalseScopePreserved, true); assert.equal(report.quality.childLocalFreeBoundariesPreserved, true);
  assert.equal(report.quality.weldingPerformed, false); assert.equal(report.quality.sourceModelsMerged, false);
  assert.equal(report.eulerCharacteristic, expectedVertices - pairs.length + inputs.length); assert.equal(report.childPairEvaluationCount, pairs.length);
  const counts = {sourceCompilationCount: 0, faceValidationCount: 0, boundaryExtractionCount: 0, curveReversalCount: 0, observationPairCount: 0, curvePointEvaluationCount: 0, curveDerivativeEvaluationCount: 0};
  assert.equal(result.pairResults.length, pairs.length);
  for (const [i, child] of result.pairResults.entries()) {
    const current = pairs[i], childAssets = [inputs.find(asset => asset.sourceId === current.first.sourceId), inputs.find(asset => asset.sourceId === current.second.sourceId)];
    const prefix = options.resultIdPrefix + '_' + i;
    bits(child, buildExactBoundaryFaceAdjacency(childAssets, [current], {evaluationId: prefix, resultIdPrefix: prefix, maximumCurveReversals: 1, maximumObservationPairs: 3}));
    assert.equal(child.report.quality.closed, false); assert.equal(child.report.freeBoundaryCount, 6); assert.equal(child.freeBoundaries.length, 6); assert.equal(child.sharedEdges.length, 1);
    for (const key of Object.keys(counts)) counts[key] += child.report[key];
    const edge = graph.edges[i], original = child.sharedEdges[0]; assert.equal(edge.pairIndex, i); assert.equal(edge.childEdgeId, original.id); bits(edge.uses, original.uses);
    assert.equal(edge.uses[0].effectiveSense, 'forward'); assert.equal(edge.uses[1].effectiveSense, 'reverse'); assert.notEqual(edge.vertexClassIds[0], edge.vertexClassIds[1]);
    for (let endpoint = 0; endpoint < 2; endpoint++) {
      const childClass = child.vertexClasses.find(row => row.id === original.endpointClassIds[endpoint]), global = graph.vertices.find(row => row.id === edge.vertexClassIds[endpoint]);
      assert.equal(childClass.members.length, 2); assert.ok(global);
      for (const member of childClass.members) { const actual = global.members.find(row => row.sourceId === member.sourceId && row.vertexId === member.vertexId); assert.ok(actual); bits(actual, member); }
    }
    sourceFile(name + '.pair_' + i + '.actual-reversal', original.reversal.source, original.reversal.model);
  }
  assert.deepEqual(report.childDirectCounts, counts);
  assert.deepEqual(counts, {sourceCompilationCount: 2 * pairs.length, faceValidationCount: 2 * pairs.length, boundaryExtractionCount: 2 * pairs.length,
    curveReversalCount: pairs.length, observationPairCount: 3 * pairs.length, curvePointEvaluationCount: 6 * pairs.length, curveDerivativeEvaluationCount: 6 * pairs.length});
  const inventory = inputs.flatMap(asset => asset.face.topology.vertices.map(vertex => ({sourceId: asset.sourceId, faceId: asset.face.topology.face.id, vertexId: vertex.id, pointMM: vertex.point})));
  const key = member => member.sourceId + '/' + member.vertexId, inventoryKeys = inventory.map(key), reachedVertices = new Set(), reachedBoundaries = new Set();
  for (const vertex of graph.vertices) {
    assert.ok(vertex.members.length >= 2); assert.equal(new Set(vertex.members.map(member => member.sourceId)).size, vertex.members.length);
    const ordered = [...vertex.members].sort((a, b) => inventoryKeys.indexOf(key(a)) - inventoryKeys.indexOf(key(b))); bits(vertex.members, ordered); bits(vertex.representative, ordered[0]);
    for (const member of vertex.members) { const original = inventory.find(item => key(item) === key(member)); assert.ok(original); bits(member, original); bits(member.pointMM, vertex.representative.pointMM); assert.ok(!reachedVertices.has(key(member))); reachedVertices.add(key(member)); }
  }
  assert.equal(reachedVertices.size, 4 * inputs.length);
  for (const [i, face] of graph.faces.entries()) {
    const original = inputs[i]; assert.equal(face.sourceId, original.sourceId); assert.equal(face.faceId, original.face.topology.face.id); assert.equal(face.loopId, original.face.topology.loop.id);
    assert.equal(face.vertexClassIds.length, 4); assert.equal(face.edgeIds.length, 4);
    for (let corner = 0; corner < 4; corner++) {
      const vertex = graph.vertices.find(row => row.id === face.vertexClassIds[corner]); assert.ok(vertex.members.some(member => member.sourceId === original.sourceId && member.vertexId === original.face.topology.vertices[corner].id));
      const edge = graph.edges.find(row => row.id === face.edgeIds[corner]); assert.ok(edge.uses.some(use => use.sourceId === original.sourceId && use.boundary === boundaries[corner]));
      const value = original.sourceId + '/' + boundaries[corner]; assert.ok(!reachedBoundaries.has(value)); reachedBoundaries.add(value);
    }
  }
  assert.equal(reachedBoundaries.size, 4 * inputs.length);
  const reachedCorners = new Set();
  for (const link of graph.vertexLinks) {
    const vertex = graph.vertices.find(row => row.id === link.vertexClassId); assert.ok(vertex); assert.equal(link.incidentEdgeIds.length, expectedLinkSize); assert.equal(link.cornerArcs.length, expectedLinkSize);
    assert.equal(link.orientedCycleEdgeIds.length, expectedLinkSize); assert.equal(link.orientedCycleArcIndices.length, expectedLinkSize);
    assert.equal(new Set(link.orientedCycleEdgeIds).size, expectedLinkSize); assert.equal(new Set(link.orientedCycleArcIndices).size, expectedLinkSize);
    const expectedIncident = graph.edges.filter(edge => edge.vertexClassIds.includes(vertex.id)).map(edge => edge.id); assert.deepEqual(link.incidentEdgeIds, expectedIncident);
    assert.equal(link.orientedCycleEdgeIds[0], expectedIncident[0]);
    for (const degree of link.degrees) { assert.equal(degree.degree, 2); assert.equal(degree.incoming, 1); assert.equal(degree.outgoing, 1); }
    for (const [i, edgeId] of link.orientedCycleEdgeIds.entries()) {
      const arc = link.cornerArcs[link.orientedCycleArcIndices[i]], next = link.orientedCycleEdgeIds[(i + 1) % expectedLinkSize];
      assert.equal(arc.previousEdgeId, edgeId); assert.equal(arc.nextEdgeId, next); assert.notEqual(edgeId, next);
    }
    for (const arc of link.cornerArcs) {
      const face = graph.faces.find(row => row.sourceId === arc.sourceId), original = inputs.find(asset => asset.sourceId === arc.sourceId);
      assert.equal(arc.faceId, original.face.topology.face.id); assert.equal(arc.vertexId, original.face.topology.vertices[arc.cornerIndex].id);
      assert.equal(face.vertexClassIds[arc.cornerIndex], vertex.id); assert.equal(arc.previousEdgeId, face.edgeIds[(arc.cornerIndex + 3) % 4]); assert.equal(arc.nextEdgeId, face.edgeIds[arc.cornerIndex]);
      const value = arc.sourceId + '/' + arc.cornerIndex; assert.ok(!reachedCorners.has(value)); reachedCorners.add(value);
    }
  }
  assert.equal(reachedCorners.size, 4 * inputs.length); assert.deepEqual(validate(result), report); const saved = jsonFile(name + '.owned-shell', result);
  for (const original of request.reopened.assets) { const cold = compileCadModel(original.source, {sourceVersion: 0}); assert.equal(cold.ok, true); bits(cold.model, original.face.geometry); }
  assert.deepEqual(build(request.reopened.assets, request.reopened.pairs, request.reopened.options), saved.reopened); assert.deepEqual(validate(saved.reopened), report);
  accepted.push({inputs, pairs, options, before, result, beforeResult: structuredClone(result)});
  cases.push({name, faceCount: inputs.length, edgeCount: pairs.length, vertexClassCount: expectedVertices, linkSize: expectedLinkSize,
    childDirectCounts: counts, requestFile: request.file, resultFile: saved.file}); return result;
}
jsonFile('source-api.inputs', {entry, sourceInputs, cadInputs, sourceOnly: true, write: false, esbuildVersion: esbuild.version}); jsonFile('source-api.metafile', bundle.metafile);
const shell = check('warped', assets, pairs, shellOptions, 8, 3);
assert.equal(shell.report.eulerCharacteristic, 2);
const curvedEdge = extractSurfaceBoundary(surfaces[4], {boundary: 'u-max', id: 'independent_curved_edge'});
close(evaluateCurve(curvedEdge, .5), [5, 10, 1]); assert.ok(Math.hypot(...evaluateCurve(curvedEdge, .5).map((value, i) => value - [5, 10, 2][i])) > .5);
close(evaluateCurveD1(curvedEdge, .5).derivative, [10, 0, 4]); jsonFile('independent-curved-boundary', {curve: curvedEdge, pointMM: evaluateCurve(curvedEdge, .5), derivative: evaluateCurveD1(curvedEdge, .5)});
close(evaluateSurface(surfaces[5], .5, .5), [5, 5, 10.5]);
const edit = editSurfaceControlNet(surfaces[5], {poleEdits: [{uIndex: 1, vIndex: 1, zMM: 12}]}); jsonFile('actual-interior-pole-edit', edit); sourceFile('actual-interior-pole-edit', edit.source, edit.model);
const editedAssets = [...assets.slice(0, 5), asset('F', edit.surface, 'edited.F')];
close(evaluateSurface(edit.surface, .5, .5), [5, 5, 11]);
for (const boundary of boundaries) bits(extractSurfaceBoundary(edit.surface, {boundary, id: 'boundary'}), extractSurfaceBoundary(surfaces[5], {boundary, id: 'boundary'}));
const interiorEdit = check('interior_edit', editedAssets, pairs, shellOptions, 8, 3); bits(interiorEdit.graph, shell.graph);
const flat = patch('flat_patch', (u, v) => [5 * u, 5 * v, 0]), opposite = reverseSurfaceAxis(flat, {axis: 'u', surfaceId: 'flat_opposite', resultIdPrefix: 'flat_rev'});
jsonFile('actual-pillow-axis-reversal', opposite); sourceFile('actual-pillow-axis-reversal', opposite.source, opposite.model);
const pillowAssets = [asset('P', flat, 'pillow.P'), asset('Q', opposite.surface, 'pillow.Q')];
const pillowPairs = (a, b) => [pair(a, 'v-min', b, 'v-min'), pair(a, 'u-max', b, 'u-min'), pair(a, 'v-max', b, 'v-max'), pair(a, 'u-min', b, 'u-max')];
const pillow = check('abstract_pillow', pillowAssets, pillowPairs('P', 'Q'), settings('abstract_pillow_shell', 'pilo'), 4, 2);
assert.equal(pillow.report.solid, false); assert.equal(pillow.report.embeddedManifoldCertified, false);
let restrictedError;
try { buildAxisBoxShell([0, 0, 0], [10, 10, 10], assets.map(asset => asset.face), {shellId: 'restricted_box', faceIds: Array.from({length: 6}, (_, i) => 'restricted_f' + i),
  vertexIds: Array.from({length: 8}, (_, i) => 'restricted_v' + i), edgeIds: Array.from({length: 12}, (_, i) => 'restricted_e' + i)}); } catch (error) { restrictedError = error; }
assert.ok(restrictedError instanceof Error); jsonFile('actual-restricted-box-refusal', {actualAPI: 'buildAxisBoxShell', message: restrictedError.message});
const disconnectedAssets = [...pillowAssets, asset('R', flat, 'disconnected.R'), asset('S', opposite.surface, 'disconnected.S')];
const flipped = reverseSurfaceAxis(surfaces[0], {axis: 'u', surfaceId: 'patch_A_flipped', resultIdPrefix: 'flip_A'});
sourceFile('actual-orientation-flip', flipped.source, flipped.model); jsonFile('actual-orientation-flip', flipped); const flippedAsset = asset('A', flipped.surface, 'flipped.A');
const gapEdit = editSurfaceControlNet(surfaces[0], {poleEdits: [{uIndex: 0, vIndex: 0, xMM: .125}]}), middleEdit = editSurfaceControlNet(surfaces[0], {poleEdits: [{uIndex: 1, vIndex: 0, zMM: 5.125}]});
for (const [name, value] of [['gap', gapEdit], ['middle', middleEdit]]) { sourceFile('actual-' + name + '-edit', value.source, value.model); jsonFile('actual-' + name + '-edit', value); }
const gapAsset = asset('A', gapEdit.surface, 'gap.A'), middleAsset = asset('A', middleEdit.surface, 'middle.A');
function intact() {
  for (const row of nativeInputs) bits(row.value, row.before); for (const row of assetsBefore) bits(row.asset, row.before);
  for (const row of accepted) { bits({inputs: row.inputs, pairs: row.pairs, options: row.options}, row.before); bits(row.result, row.beforeResult); }
  for (const [file, bytes] of retainedFiles) assert.deepEqual(readFileSync(file), bytes, file);
}
function reject(name, action, code, childCode = null) {
  assert.throws(action, error => { assert.ok(error instanceof ClosedExactPatchShellError); assert.equal(error.code, code); assert.ok(error.message.length <= 1024);
    if (childCode) { assert.ok(error.cause instanceof ExactBoundaryFaceAdjacencyError); assert.equal(error.cause.code, childCode); }
    failures.push({name, code: error.code, message: error.message, childCode: error.cause?.code ?? null, childMessage: error.cause?.message ?? null}); intact(); return true;
  });
}
reject('disconnected_pillows_preflight', () => build(disconnectedAssets, [...pillowPairs('P', 'Q'), ...pillowPairs('R', 'S')], settings('disconnected_shell', 'disco')), 'CONNECTED');
reject('missing_pair_coverage', () => build(assets, pairs.slice(0, -1), shellOptions), 'COVERAGE');
reject('duplicate_boundary_pair', () => build(assets, [...pairs.slice(0, -1), pairs[0]], shellOptions), 'COVERAGE');
reject('foreign_source_selector', () => build(assets, [{...pairs[0], first: {...pairs[0].first, sourceId: 'foreign'}}, ...pairs.slice(1)], shellOptions), 'COVERAGE');
reject('third_boundary_use', () => build(assets, [{...pairs[0], second: pairs[1].second}, ...pairs.slice(1)], shellOptions), 'COVERAGE');
reject('pair_budget', () => build(assets, pairs, {...shellOptions, maximumPairEvaluations: 11}), 'BUDGET');
reject('observation_budget', () => build(assets, pairs, {...shellOptions, maximumObservationPairs: 35}), 'BUDGET');
reject('graph_identity_collision', () => build(assets, pairs, {...shellOptions, shellId: 'c0'}), 'IDENTITY');
reject('healthy_face_orientation_flip', () => build([flippedAsset, ...assets.slice(1)], pairs, shellOptions), 'NATIVE', 'ORIENTATION');
reject('actual_boundary_endpoint_gap', () => build([gapAsset, ...assets.slice(1)], pairs, shellOptions), 'NATIVE', 'BINDING');
reject('actual_boundary_middlepole_mismatch', () => build([middleAsset, ...assets.slice(1)], pairs, shellOptions), 'NATIVE', 'BASIS');
const bitSource = assets[0].source.replace('[0,0,0]', '[-0,0,0]'); assert.notEqual(bitSource, assets[0].source);
reject('source_whole_bits_mismatch', () => build([{...assets[0], source: bitSource}, ...assets.slice(1)], pairs, shellOptions), 'NATIVE', 'BINDING');
let getterCalls = 0;
const getter = {...shellOptions}; Object.defineProperty(getter, 'maximumPairEvaluations', {enumerable: true, get() { getterCalls++; return 12; }});
reject('options_getter', () => build(assets, pairs, getter), 'INPUT');
const nestedGetter = structuredClone(assets); Object.defineProperty(nestedGetter[0].face.topology, 'vertices', {enumerable: true, get() { getterCalls++; return []; }});
reject('native_face_getter', () => build(nestedGetter, pairs, shellOptions), 'INPUT'); assert.equal(getterCalls, 0);
for (const [name, alter] of [
  ['link', result => { result.graph.vertexLinks[0].cornerArcs[0].nextEdgeId = result.graph.vertexLinks[0].cornerArcs[0].previousEdgeId; }],
  ['graph', result => { result.graph.edges[0].vertexClassIds.reverse(); }], ['child', result => { result.pairResults[0].report.quality.closed = true; }],
  ['counter', result => { result.report.childPairEvaluationCount++; }], ['source', result => { result.assets[0].source = result.assets[0].source.replace('[0,0,0]', '[-0,0,0]'); }],
]) { const changed = structuredClone(shell); alter(changed); reject('owned_' + name, () => validate(changed), 'OWNED'); }
let replacement = shell; const previous = replacement;
reject('atomic_prior_shell', () => { replacement = build([middleAsset, ...assets.slice(1)], pairs, shellOptions); }, 'NATIVE', 'BASIS');
assert.strictEqual(replacement, previous); jsonFile('atomic-retention', {priorShellUnchanged: replacement === previous, getterCalls});
const packageRoot = resolve(repo, 'packages/barocss-cad'), manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.publishConfig?.exports?.['.'] ?? manifest.exports['.'], runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath)); const publicAPI = await import(pathToFileURL(runtimePath).href);
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function'); assert.deepEqual(publicAPI.ClosedExactPatchShellDiagnosticCode, ClosedExactPatchShellDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./closed-exact-patch-shell.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/closed-exact-patch-shell.d.ts'), declaration = readFileSync(leafDeclarationPath, 'utf8');
for (const name of [...runtimeNames, ...typeNames]) assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(declaration), name);
for (const row of cases) {
  const request = JSON.parse(readFileSync(row.requestFile, 'utf8')), stored = JSON.parse(readFileSync(row.resultFile, 'utf8'));
  for (const original of request.assets) { const cold = publicAPI.compileCadModel(original.source, {sourceVersion: 0}); assert.equal(cold.ok, true); bits(cold.model, original.face.geometry); }
  assert.deepEqual(publicAPI.buildClosedExactPatchShell(request.assets, request.pairs, request.options), stored); assert.deepEqual(publicAPI.validateClosedExactPatchShell(stored), stored.report);
}
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 8,
  exportSelection: manifest.publishConfig?.exports?.['.'] ? 'publishConfig.exports root' : 'exports root'};
jsonFile('compiled-consumer', compiledConsumer); intact();
const summary = {sourceMode: true, cadSourceInputCount: cadInputs.length, cases, failures, compiledConsumer, caseCount: cases.length, refusalCount: failures.length, getterCalls,
  independentCurvedEdgeMidpointMM: [5, 10, 1], independentInteriorEdit: {beforeMM: [5, 5, 10.5], afterMM: [5, 5, 11], graphUnchanged: true},
  actualRestrictedBoxRefusal: restrictedError.message,
  scope: 'Closed connected oriented quad-patch abstract incidence with degree-two vertex links. All actual pair children stay open. No embedded manifold, occupied volume, inside/outside, Solid, sewing, G1/G2 or Boolean certificate.'};
jsonFile('summary', summary); intact(); console.log(JSON.stringify(summary));
