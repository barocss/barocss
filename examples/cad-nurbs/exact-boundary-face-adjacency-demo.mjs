import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node exact-boundary-face-adjacency-demo.mjs --source <output-directory>'); assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]); mkdirSync(output, {recursive: true});
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json')), esbuild = require('esbuild');
const entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundle = await esbuild.build({absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true});
assert.equal(bundle.outputFiles.length, 1);
const sourceInputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path)), cadInputs = sourceInputs.filter(path => path.includes('/packages/barocss-cad/'));
for (const leaf of ['index.ts', 'exact-boundary-face-adjacency.ts', 'face.ts', 'boundary.ts', 'curve-reversal.ts']) assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const {buildExactBoundaryFaceAdjacency: build, validateExactBoundaryFaceAdjacency: validate, ExactBoundaryFaceAdjacencyError,
  ExactBoundaryFaceAdjacencyDiagnosticCode, buildParametricFace, validateFaceBundle, splitSurfaceAtParameter, reverseSurfaceAxis,
  reverseCurve, validateReversedCurveResult, editSurfaceControlNet, extractSurfaceBoundary, evaluateCurve, evaluateCurveD1,
  evaluateSurface, evaluateSurfaceD1, curveDomain, compileCadModel} = api;
const runtimeNames = ['buildExactBoundaryFaceAdjacency', 'validateExactBoundaryFaceAdjacency', 'ExactBoundaryFaceAdjacencyError', 'ExactBoundaryFaceAdjacencyDiagnosticCode'];
const typeNames = ['ExactBoundaryFaceAdjacencyAsset', 'ExactBoundaryFaceAdjacencyPair', 'ExactBoundaryFaceAdjacencyOptions', 'ExactBoundaryFaceAdjacencyEdge', 'ExactBoundaryFaceAdjacencyReport', 'ExactBoundaryFaceAdjacencyResult'];
for (const name of runtimeNames) assert.equal(typeof api[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(Object.keys(ExactBoundaryFaceAdjacencyDiagnosticCode).sort(), ['INPUT', 'BUDGET', 'IDENTITY', 'BASIS', 'ORIENTATION', 'BINDING', 'NATIVE', 'OWNED'].sort());
const retainedFiles = new Map(), assetsBefore = [], accepted = [], cases = [], failures = [];
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
  const cold = compileCadModel(readFileSync(file, 'utf8'), {sourceVersion: 0}); assert.equal(cold.ok, true, JSON.stringify(cold.diagnostics)); assert.deepEqual(cold.model, model);
  assert.ok(model.objects.length <= 16); return file;
}
function modelSource(model) {
  const decimal = value => Object.is(value, -0) ? '-0' : String(value), list = values => '[' + values.map(decimal).join(',') + ']';
  const poles = points => '[' + points.map(list).join(',') + ']';
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
  if (typeof expected === 'number') { assert.ok(Object.is(actual, expected), 'Native coefficient/source/reference bits changed'); return; }
  assert.deepEqual(actual, expected); if (expected && typeof expected === 'object') for (const key of Object.keys(expected)) bits(actual[key], expected[key]);
}
const close = (actual, expected, derivative = false) => assert.ok(Math.hypot(...actual.map((value, i) => value - expected[i])) <= 1e-7 * (derivative ? Math.max(1, Math.hypot(...expected)) : 1));
const boundaries = ['v-min', 'u-max', 'v-max', 'u-min'];
const localIds = {faceId: 'face_local', loopId: 'loop_local', vertexIds: ['v0', 'v1', 'v2', 'v3'], edgeIds: ['e0', 'e1', 'e2', 'e3'], curveIds: ['c0', 'c1', 'c2', 'c3']};
function asset(sourceId, surface) {
  const face = buildParametricFace(surface, localIds); assert.deepEqual(validateFaceBundle(face), {incidenceValid: true, geometricValidity: 'not-certified', solid: false});
  assert.equal(face.geometry.objects.length, 5); const source = modelSource(face.geometry);
  sourceFile(sourceId + '.actual-face', source, face.geometry); const result = {sourceId, source, face};
  assetsBefore.push({asset: result, before: structuredClone(result)}); jsonFile(sourceId + '.actual-face-owned', result); return result;
}
function selected(assets, selector) {
  const owner = assets.find(asset => asset.sourceId === selector.sourceId); assert.ok(owner);
  const index = boundaries.indexOf(selector.boundary); assert.ok(index >= 0);
  const edge = owner.face.topology.edges[index], use = owner.face.topology.loop.uses[index], curve = owner.face.geometry.objects.find(object => object.id === edge.curveId);
  assert.ok(curve); return {owner, index, edge, use, curve};
}
function checkReference(reference, assets) {
  const value = selected(assets, reference); assert.equal(reference.faceId, value.owner.face.topology.face.id); assert.equal(reference.surfaceId, value.owner.face.topology.face.surfaceId);
  assert.equal(reference.loopId, value.owner.face.topology.loop.id); assert.equal(reference.useIndex, value.index);
  assert.equal(reference.edgeId, value.edge.id); assert.equal(reference.curveId, value.curve.id); assert.deepEqual(reference.vertexIds, value.edge.vertexIds);
  assert.deepEqual(reference.pcurve, value.use.pcurve); assert.equal(reference.originalSense, 'forward');
  assert.ok(!Object.hasOwn(reference, 'useId')); assert.ok(!Object.hasOwn(reference, 'pcurveId')); return value;
}
function nativeUV(reference, parameter) {
  const {domain: [a, b], uv0, uv1} = reference.pcurve;
  if (Object.is(parameter, a)) return [...uv0]; if (Object.is(parameter, b)) return [...uv1];
  const fraction = (parameter - a) / (b - a); return uv0.map((value, i) => (1 - fraction) * value + fraction * uv1[i]);
}
function reversalParameter(reversal, parameter) {
  const map = reversal.provenance.decreasingParameterMap, [a, b] = reversal.provenance.domain;
  if (Object.is(parameter, map.endpointAssignments.reversedStart.reversed)) return map.endpointAssignments.reversedStart.original;
  if (Object.is(parameter, map.endpointAssignments.reversedEnd.reversed)) return map.endpointAssignments.reversedEnd.original;
  return a + (b - parameter);
}
const surface = {kind: 'surface', id: 'curved_patch', degreeU: 2, degreeV: 2, knotsU: [-3, -3, -3, 7, 7, 7], knotsV: [2, 2, 2, 5, 5, 5],
  controlPoints: Array.from({length: 3}, (_, i) => Array.from({length: 3}, (_, j) => [i, j, i * j + j * j])), weights: Array.from({length: 3}, () => [1, 2, 1])};
sourceFile('original-curved-patch', modelSource({name: 'curved_original', version: 0, lengthUnit: 'mm', objects: [surface]}),
  {name: 'curved_original', version: 0, lengthUnit: 'mm', objects: [surface]});
const split = splitSurfaceAtParameter(surface, {axis: 'u', parameter: 2, lowerSurfaceId: 'lower_patch', upperSurfaceId: 'upper_patch'});
jsonFile('actual-u-split', split); sourceFile('actual-u-split', split.source, split.model); assert.equal(split.model.objects.length, 2);
assert.deepEqual(split.provenance.shared.coefficients.map(row => row.pointMM), [[1, 0, 0], [1, 1, 2], [1, 2, 6]]);
assert.deepEqual(split.provenance.shared.coefficients.map(row => row.weight), [1, 2, 1]);
const lower = asset('lower', split.lower), upper = asset('upper', split.upper);
const shifted = editSurfaceControlNet(split.upper, {poleEdits: split.upper.controlPoints.flatMap((row, uIndex) => row.map((point, vIndex) => ({uIndex, vIndex, xMM: point[0] + 10})))});
sourceFile('actual-disjoint-surface-edit', shifted.source, shifted.model); jsonFile('actual-disjoint-surface-edit', shifted); const away = asset('away', shifted.surface);
const lowerV = splitSurfaceAtParameter(split.lower, {axis: 'v', parameter: 3.5, lowerSurfaceId: 'grid_ll', upperSurfaceId: 'grid_ul'});
const upperV = splitSurfaceAtParameter(split.upper, {axis: 'v', parameter: 3.5, lowerSurfaceId: 'grid_lr', upperSurfaceId: 'grid_ur'});
for (const [name, value] of [['lower', lowerV], ['upper', upperV]]) { sourceFile('actual-v-split-' + name, value.source, value.model); jsonFile('actual-v-split-' + name, value); }
const gridAssets = [asset('ll', lowerV.lower), asset('lr', upperV.lower), asset('ul', lowerV.upper), asset('ur', upperV.upper)];
const pair = (firstSource, firstBoundary, secondSource, secondBoundary) => ({first: {sourceId: firstSource, boundary: firstBoundary}, second: {sourceId: secondSource, boundary: secondBoundary}});
const optionsFor = (name, maximumCurveReversals = 8, maximumObservationPairs = 24) => ({evaluationId: name + '_evaluation', resultIdPrefix: name.slice(0, 8), maximumCurveReversals, maximumObservationPairs});
const primaryPair = pair('lower', 'u-max', 'upper', 'u-min');
function check(name, inputs, pairs, expectedClasses, expectedFree, options = optionsFor(name)) {
  const before = structuredClone({inputs, pairs, options}), authored = jsonFile(name + '.authored-request', {assets: inputs, pairs, options});
  const result = build(inputs, pairs, options); ownership([inputs, pairs, options], result); assert.deepEqual({inputs, pairs, options}, before);
  assert.deepEqual(Object.keys(result).sort(), ['assets', 'options', 'sharedEdges', 'vertexClasses', 'freeBoundaries', 'report'].sort());
  bits(result.assets, inputs); assert.deepEqual(result.options, options); assert.equal(result.sharedEdges.length, pairs.length);
  assert.equal(result.vertexClasses.length, expectedClasses); assert.equal(result.freeBoundaries.length, expectedFree);
  const report = result.report; assert.equal(report.schema, 'barocss-exact-boundary-face-adjacency'); assert.equal(report.version, 0); assert.deepEqual(report.pairs, pairs);
  assert.equal(report.lengthUnit, 'mm'); assert.equal(report.sourceFrame, 'authored-xyz-no-axis-conversion');
  assert.equal(report.parameterFrame, 'unchanged-native-face-pcurves-and-actual-reversal-map'); assert.equal(report.quality.localIncidenceOnly, true);
  for (const field of ['closed', 'solid', 'weldingPerformed', 'manifoldCertified', 'supportRegularityCertified', 'continuityCertified', 'globalBinary64ErrorCertified']) assert.equal(report.quality[field], false);
  assert.equal(report.assetCount, inputs.length); assert.equal(report.pairCount, pairs.length); assert.equal(report.sharedEdgeCount, pairs.length);
  assert.equal(report.freeBoundaryCount, expectedFree); assert.equal(report.vertexClassCount, expectedClasses);
  assert.equal(report.curveReversalCount, pairs.length); assert.equal(report.observationPairCount, 3 * pairs.length);
  assert.equal(report.sourceCompilationCount, inputs.length); assert.equal(report.faceValidationCount, inputs.length);
  assert.equal(report.boundaryExtractionCount, 2 * pairs.length); assert.equal(report.curvePointEvaluationCount, 6 * pairs.length); assert.equal(report.curveDerivativeEvaluationCount, 6 * pairs.length);
  assert.deepEqual(report.qualifications, inputs.map(asset => ({sourceId: asset.sourceId, modelName: asset.face.geometry.name,
    faceId: asset.face.topology.face.id, surfaceId: asset.face.topology.face.surfaceId, loopId: asset.face.topology.loop.id,
    edgeIds: asset.face.topology.edges.map(edge => edge.id), curveIds: asset.face.topology.edges.map(edge => edge.curveId), vertexIds: asset.face.topology.vertices.map(vertex => vertex.id)})));
  const selectedKeys = new Set();
  for (const [i, edge] of result.sharedEdges.entries()) {
    const first = selected(inputs, pairs[i].first), second = selected(inputs, pairs[i].second), reversal = edge.reversal;
    assert.deepEqual(edge.canonical, {sourceId: first.owner.sourceId, faceId: first.owner.face.topology.face.id, edgeId: first.edge.id, curveId: first.curve.id});
    const references = edge.uses.map(use => checkReference(use, inputs)); assert.equal(references.length, 2);
    assert.equal(edge.uses[0].effectiveSense, 'forward'); assert.equal(edge.uses[1].effectiveSense, 'reverse');
    for (const selector of [pairs[i].first, pairs[i].second]) { const key = selector.sourceId + '/' + selector.boundary; assert.ok(!selectedKeys.has(key)); selectedKeys.add(key); }
    bits(first.curve, extractSurfaceBoundary(first.owner.face.geometry.objects[0], {boundary: pairs[i].first.boundary, id: first.curve.id}));
    bits(second.curve, extractSurfaceBoundary(second.owner.face.geometry.objects[0], {boundary: pairs[i].second.boundary, id: second.curve.id}));
    assert.deepEqual(reversal.original, second.curve); assert.deepEqual(reversal, reverseCurve(second.curve, reversal.options)); assert.deepEqual(validateReversedCurveResult(reversal), reversal.report);
    bits({...reversal.curve, id: first.curve.id}, first.curve); assert.deepEqual(curveDomain(reversal.curve), curveDomain(first.curve));
    assert.deepEqual(edge.uses[0].parameterMap, {kind: 'identity', domain: curveDomain(first.curve), formula: 'u=t', orientation: 1, d1Factor: 1});
    assert.deepEqual(edge.uses[1].parameterMap, {kind: 'reversed', domain: reversal.provenance.domain, native: reversal.provenance.decreasingParameterMap});
    sourceFile(name + '.edge_' + i + '.actual-reversal-original', reversal.originalSource, reversal.originalModel);
    sourceFile(name + '.edge_' + i + '.actual-reversal', reversal.source, reversal.model); assert.equal(reversal.model.objects.length, 1);
    assert.equal(edge.endpointClassIds.length, 2); assert.equal(edge.observations.length, 3);
    const domain = curveDomain(first.curve), parameters = [domain[0], domain[0] + (domain[1] - domain[0]) / 2, domain[1]];
    for (const [index, observation] of edge.observations.entries()) {
      assert.equal(observation.index, index); assert.equal(observation.canonicalParameter, parameters[index]);
      assert.equal(observation.secondParameter, reversalParameter(reversal, observation.canonicalParameter));
      for (const [side, original, parameter] of [['first', first, observation.canonicalParameter], ['second', second, observation.secondParameter]]) {
        const item = observation[side]; checkReference(item.reference, inputs);
        bits(item.curveD0, evaluateCurve(original.curve, parameter)); bits(item.curveD1, evaluateCurveD1(original.curve, parameter));
        bits(item.nativeUV, nativeUV(item.reference, parameter)); close(item.curveD0, evaluateSurface(original.owner.face.geometry.objects[0], ...item.nativeUV));
        const surfaceD1 = evaluateSurfaceD1(original.owner.face.geometry.objects[0], ...item.nativeUV), tangent = original.index % 2 === 0 ? surfaceD1.du : surfaceD1.dv;
        close(item.curveD1.derivative, tangent.map(value => value * (original.index >= 2 ? -1 : 1)), true);
      }
      bits(observation.expectedSecondDerivativeMM, observation.first.curveD1.derivative.map(value => -value));
      close(observation.first.curveD0, observation.second.curveD0); close(observation.second.curveD1.derivative, observation.expectedSecondDerivativeMM, true);
      assert.ok(observation.pointDifferenceMM <= 1e-7 && observation.relativeDerivativeDifference <= 1e-7);
      if (index === 1) { assert.equal(observation.endpointVertices, null); assert.equal(observation.endpointPointDifferenceMM, null); }
      else {
        assert.equal(observation.endpointVertices.length, 2); assert.ok(observation.endpointPointDifferenceMM.every(value => value <= 1e-7));
        for (const [j, original] of [first, second].entries()) {
          const endpoint = j === 0 ? (index === 0 ? 0 : 1) : (index === 0 ? 1 : 0), vertex = original.owner.face.topology.vertices.find(row => row.id === original.edge.vertexIds[endpoint]);
          bits(observation.endpointVertices[j], {sourceId: original.owner.sourceId, faceId: original.owner.face.topology.face.id, vertexId: vertex.id, pointMM: vertex.point});
        }
      }
    }
    for (let endpoint = 0; endpoint < 2; endpoint++) {
      const vertexClass = result.vertexClasses.find(row => row.id === edge.endpointClassIds[endpoint]); assert.ok(vertexClass);
      const firstVertex = first.owner.face.topology.vertices.find(row => row.id === first.edge.vertexIds[endpoint]);
      const secondVertex = second.owner.face.topology.vertices.find(row => row.id === second.edge.vertexIds[1 - endpoint]);
      bits(firstVertex.point, secondVertex.point);
      for (const [owner, vertex] of [[first.owner, firstVertex], [second.owner, secondVertex]]) {
        const member = vertexClass.members.find(row => row.sourceId === owner.sourceId && row.vertexId === vertex.id); assert.ok(member); bits(member.pointMM, vertex.point);
      }
    }
  }
  for (const reference of result.freeBoundaries) { checkReference(reference, inputs); assert.ok(!selectedKeys.has(reference.sourceId + '/' + reference.boundary)); }
  const allMembers = result.vertexClasses.flatMap(row => row.members); assert.equal(allMembers.length, 4 * inputs.length);
  const memberKeys = allMembers.map(member => member.sourceId + '/' + member.vertexId); assert.equal(new Set(memberKeys).size, memberKeys.length);
  const order = inputs.flatMap(asset => asset.face.topology.vertices.map(vertex => asset.sourceId + '/' + vertex.id));
  for (const vertexClass of result.vertexClasses) {
    assert.ok(vertexClass.members.length > 0); assert.equal(new Set(vertexClass.members.map(member => member.sourceId)).size, vertexClass.members.length);
    const expectedRepresentative = [...vertexClass.members].sort((a, b) => order.indexOf(a.sourceId + '/' + a.vertexId) - order.indexOf(b.sourceId + '/' + b.vertexId))[0];
    bits(vertexClass.representative, expectedRepresentative);
    for (const member of vertexClass.members) {
      const owner = inputs.find(row => row.sourceId === member.sourceId), vertex = owner.face.topology.vertices.find(row => row.id === member.vertexId);
      assert.equal(member.faceId, owner.face.topology.face.id); bits(member.pointMM, vertex.point); bits(member.pointMM, vertexClass.representative.pointMM);
    }
  }
  assert.deepEqual(validate(result), report); const saved = jsonFile(name + '.owned-adjacency', result);
  for (const original of authored.reopened.assets) { const cold = compileCadModel(original.source, {sourceVersion: 0}); assert.equal(cold.ok, true); bits(cold.model, original.face.geometry); }
  assert.deepEqual(build(authored.reopened.assets, authored.reopened.pairs, authored.reopened.options), saved.reopened); assert.deepEqual(validate(saved.reopened), report);
  accepted.push({inputs, pairs, options, before, result, resultBefore: structuredClone(result)});
  cases.push({name, assetCount: inputs.length, pairCount: pairs.length, vertexClassCount: expectedClasses, freeBoundaryCount: expectedFree,
    reversals: report.curveReversalCount, observationPairs: report.observationPairCount, authoredFile: authored.file, resultFile: saved.file}); return result;
}
jsonFile('source-api.inputs', {entry, sourceInputs, cadInputs, sourceOnly: true, write: false, esbuildVersion: esbuild.version}); jsonFile('source-api.metafile', bundle.metafile);
const primary = check('curved', [lower, upper], [primaryPair], 6, 6);
const lowerCurve = selected([lower, upper], primaryPair.first).curve, upperCurve = selected([lower, upper], primaryPair.second).curve;
const independent = [2, 3.5, 5].map(parameter => {
  const otherParameter = 2 + (5 - parameter), firstD1 = evaluateCurveD1(lowerCurve, parameter), secondD1 = evaluateCurveD1(upperCurve, otherParameter);
  close(evaluateCurve(lowerCurve, parameter), evaluateCurve(upperCurve, otherParameter)); close(firstD1.derivative, secondD1.derivative.map(value => -value), true);
  close(firstD1.point, evaluateSurface(surface, 2, parameter)); close(firstD1.derivative, evaluateSurfaceD1(surface, 2, parameter).dv, true);
  return {parameter, otherParameter, firstD1, secondD1};
});
close(independent[1].firstD1.point, [1, 1, 7 / 3]); assert.ok(Math.hypot(...independent[1].firstD1.point.map((value, i) => value - [1, 1, 3][i])) > .5);
jsonFile('independent-curved-boundary', independent);
check('disjoint', [lower, away], [], 8, 8, optionsFor('disjoint', 0, 0));
const gridPairs = [pair('ll', 'u-max', 'lr', 'u-min'), pair('ul', 'u-max', 'ur', 'u-min'), pair('ll', 'v-max', 'ul', 'v-min'), pair('lr', 'v-max', 'ur', 'v-min')];
const grid = check('grid', gridAssets, gridPairs, 9, 8); assert.equal(grid.vertexClasses.filter(row => row.members.length === 4).length, 1);

const moved = editSurfaceControlNet(split.upper, {poleEdits: [{uIndex: 0, vIndex: 1, zMM: 2.125}]});
sourceFile('actual-middlepole-edit', moved.source, moved.model); jsonFile('actual-middlepole-edit', moved); const middleAsset = asset('middle', moved.surface);
const scaled = editSurfaceControlNet(split.upper, {poleEdits: split.upper.weights.flatMap((row, uIndex) => row.map((weight, vIndex) => ({uIndex, vIndex, weight: 2 * weight})))});
sourceFile('actual-scaled-weight-edit', scaled.source, scaled.model); jsonFile('actual-scaled-weight-edit', scaled); const scaledAsset = asset('scaled', scaled.surface);
const reverse = reverseSurfaceAxis(split.upper, {surfaceId: 'upper_v_reversed', axis: 'v', resultIdPrefix: 'upper_v'});
sourceFile('actual-v-reversal', reverse.source, reverse.model); jsonFile('actual-v-reversal', reverse); const reversedAsset = asset('reversed', reverse.surface);
const partial = asset('partial', upperV.lower), third = asset('third', split.upper);
function intact() {
  for (const row of assetsBefore) assert.deepEqual(row.asset, row.before);
  for (const row of accepted) { assert.deepEqual({inputs: row.inputs, pairs: row.pairs, options: row.options}, row.before); assert.deepEqual(row.result, row.resultBefore); }
  for (const [file, bytes] of retainedFiles) assert.deepEqual(readFileSync(file), bytes, file);
}
function reject(name, action, code, causeRequired = false) {
  assert.throws(action, error => {
    assert.ok(error instanceof ExactBoundaryFaceAdjacencyError); assert.equal(error.name, 'ExactBoundaryFaceAdjacencyError'); assert.equal(error.code, code); assert.ok(error.message.length <= 1024);
    if (causeRequired) assert.ok(error.cause instanceof Error || error.cause?.ok === false && Array.isArray(error.cause.diagnostics));
    failures.push({name, code: error.code, message: error.message, causeName: error.cause?.name ?? null, causeMessage: error.cause?.message ?? null,
      actualCompileDiagnostics: error.cause?.ok === false ? error.cause.diagnostics.map(diagnostic => ({code: diagnostic.code ?? null, message: diagnostic.message ?? null})) : null}); intact(); return true;
  });
}
const refusalOptions = optionsFor('refusal');
reject('middle_pole_whole_curve_mismatch', () => build([lower, middleAsset], [pair('lower', 'u-max', 'middle', 'u-min')], refusalOptions), 'BASIS');
for (const parameter of [2, 3.5, 5]) close(evaluateSurface(scaled.surface, 2, parameter), evaluateSurface(split.upper, 2, parameter));
reject('global_weight_scale_exact_mismatch', () => build([lower, scaledAsset], [pair('lower', 'u-max', 'scaled', 'u-min')], refusalOptions), 'BASIS');
reject('partial_original_domain', () => build([lower, partial], [pair('lower', 'u-max', 'partial', 'u-min')], refusalOptions), 'BASIS');
reject('same_direction_original_traversal', () => build([lower, reversedAsset], [pair('lower', 'u-max', 'reversed', 'u-min')], refusalOptions), 'ORIENTATION');
reject('duplicate_pair', () => build([lower, upper], [primaryPair, primaryPair], refusalOptions), 'IDENTITY');
reject('third_use', () => build([lower, upper, third], [primaryPair, pair('lower', 'u-max', 'third', 'u-min')], refusalOptions), 'IDENTITY');
reject('unknown_qualified_source', () => build([lower, upper], [pair('lower', 'u-max', 'missing', 'u-min')], refusalOptions), 'IDENTITY');
reject('reversal_budget', () => build([lower, upper], [primaryPair], {...refusalOptions, maximumCurveReversals: 0}), 'BUDGET');
reject('whole_observation_budget', () => build([lower, upper], [primaryPair], {...refusalOptions, maximumObservationPairs: 2}), 'BUDGET');
reject('source_native_mismatch', () => build([lower, {...upper, source: upper.source.replace('degree-u:2', 'degree-u:1')}], [primaryPair], refusalOptions), 'NATIVE', true);
reject('source_bits_mismatch', () => build([lower, {...upper, source: upper.source.replace('[1,0,0]', '[1,-0,0]')}], [primaryPair], refusalOptions), 'BINDING');
reject('malformed_selector', () => build([lower, upper], [{first: {...primaryPair.first, edgeId: 'invented'}, second: primaryPair.second}], refusalOptions), 'INPUT');
let getterCalls = 0;
const getter = {...refusalOptions}; Object.defineProperty(getter, 'maximumCurveReversals', {enumerable: true, get() { getterCalls++; return 8; }});
reject('options_getter', () => build([lower, upper], [primaryPair], getter), 'INPUT');
const faceGetter = structuredClone(upper); Object.defineProperty(faceGetter.face.topology.loop, 'uses', {enumerable: true, get() { getterCalls++; return []; }});
reject('face_getter', () => build([lower, faceGetter], [primaryPair], refusalOptions), 'INPUT'); assert.equal(getterCalls, 0);
for (const [name, alter] of [
  ['graph', result => { result.sharedEdges[0].uses[1].effectiveSense = 'forward'; }], ['reversal', result => { result.sharedEdges[0].reversal.source += ' '; }],
  ['class', result => { result.vertexClasses[0].members[0].sourceId = 'upper'; }], ['counter', result => { result.report.curveReversalCount++; }],
  ['parameter', result => { result.sharedEdges[0].observations.pop(); }], ['source', result => {
    const originalSource = result.assets[0].source;
    result.assets[0].source = originalSource.replace('[1,0,0]', '[1,-0,0]');
    assert.notEqual(result.assets[0].source, originalSource, 'Negative fixture must change actual Source0 coordinate bits');
  }],
]) { const changed = structuredClone(primary); alter(changed); reject('owned_' + name, () => validate(changed), 'OWNED'); }
let replacement = primary; const previous = replacement;
reject('atomic_previous_graph', () => { replacement = build([lower, middleAsset], [pair('lower', 'u-max', 'middle', 'u-min')], refusalOptions); }, 'BASIS');
assert.strictEqual(replacement, previous); jsonFile('atomic-retention', {previousGraphUnchanged: replacement === previous, getterCalls});
const packageRoot = resolve(repo, 'packages/barocss-cad'), manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.publishConfig?.exports?.['.'] ?? manifest.exports['.'], runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath)); const publicAPI = await import(pathToFileURL(runtimePath).href);
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function'); assert.deepEqual(publicAPI.ExactBoundaryFaceAdjacencyDiagnosticCode, ExactBoundaryFaceAdjacencyDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./exact-boundary-face-adjacency.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/exact-proof/exact-boundary-face-adjacency.d.ts'), declaration = readFileSync(leafDeclarationPath, 'utf8');
for (const name of [...runtimeNames, ...typeNames]) assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(declaration), name);
for (const row of cases) {
  const authored = JSON.parse(readFileSync(row.authoredFile, 'utf8')), saved = JSON.parse(readFileSync(row.resultFile, 'utf8'));
  for (const original of authored.assets) { const cold = publicAPI.compileCadModel(original.source, {sourceVersion: 0}); assert.equal(cold.ok, true); bits(cold.model, original.face.geometry); }
  assert.deepEqual(publicAPI.buildExactBoundaryFaceAdjacency(authored.assets, authored.pairs, authored.options), saved); assert.deepEqual(publicAPI.validateExactBoundaryFaceAdjacency(saved), saved.report);
}
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 10, caseCount: cases.length,
  exportSelection: manifest.publishConfig?.exports?.['.'] ? 'publishConfig.exports root' : 'exports root', declarationCheck: 'actual built declarations and API consumption; no separate TypeScript invocation'};
jsonFile('compiled-consumer', compiledConsumer); intact();
const summary = {sourceMode: true, cadSourceInputCount: cadInputs.length, cases, failures, compiledConsumer, caseCount: cases.length, refusalCount: failures.length, getterCalls,
  independentCurvedMidpointMM: [1, 1, 7 / 3], originalParameterMap: 'other=2+(5-t)', duplicateLocalIdsSourceQualified: true,
  sourceOwnership: 'each actual Face Model5 and each actual reversal Model1 remain separate from split Model2',
  scope: 'Exact opposite whole-boundary local incidence on an open patch collection; additive endpoint classes, no welding, sewn Shell/Solid, G1/G2 or global quality certificate.'};
jsonFile('summary', summary); intact(); console.log(JSON.stringify(summary));
