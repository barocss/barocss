import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node convex-planar-face-extrusion-demo.mjs --source <output-directory>'); assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]); mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json')), esbuild = require('esbuild');
const entry = resolve(repo, 'packages/barocss-cad/src/index.ts'), parserModule = resolve(repo, 'packages/barocss-cad/src/cad-document.ts');
const bridge = 'export * from ' + JSON.stringify(entry) + ';\nexport {parseCadDocumentOwnJson as demoParseAuthoredRecipe} from ' + JSON.stringify(parserModule) + ';\n';
const bundle = await esbuild.build({ absWorkingDir: repo, stdin: { contents: bridge, resolveDir: repo, sourcefile: 'convex-face-extrusion-demo-bridge.mjs', loader: 'js' }, bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
assert.equal(bundle.outputFiles.length, 1);
const inputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path));
for (const leaf of ['convex-planar-face-extrusion.ts', 'source-line-width-face.ts', 'closed-exact-patch-shell.ts', 'exact-boundary-face-adjacency.ts', 'own-plane-cylinder-intersection-internal.ts']) assert.ok(inputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
assert.ok(!inputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const { extrudeConvexPlanarFace: extrude, validateConvexPlanarFaceExtrusion: validate, ConvexPlanarFaceExtrusionError: ExtrusionError, ConvexPlanarFaceExtrusionDiagnosticCode: codes, buildSourceLineWidthFace, buildConvexPlanarFace, compileCadModel, demoParseAuthoredRecipe: parseRecipe } = api;
const runtimeNames = ['extrudeConvexPlanarFace', 'validateConvexPlanarFaceExtrusion', 'ConvexPlanarFaceExtrusionError', 'ConvexPlanarFaceExtrusionDiagnosticCode'];
const typeNames = ['ConvexPlanarFaceExtrusionRequest', 'ConvexPlanarFaceExtrusionOptions', 'ConvexPlanarFaceExtrusionReport', 'ConvexPlanarFaceExtrusionResult'];
for (const name of runtimeNames) assert.equal(typeof api[name], name.endsWith('Code') ? 'object' : 'function');
for (const name of ['INPUT', 'IDENTITY', 'PROFILE', 'DISTANCE', 'REPRESENTABILITY', 'PARENT', 'RULED', 'FACE', 'SOURCE', 'SHELL', 'BINDING', 'BUDGET', 'FILE', 'OWNED']) assert.equal(codes[name], name);
assert.equal(typeof parseRecipe, 'function'); assert.ok(inputs.includes(parserModule));
const files = new Map(), retained = [], cases = [], failures = [], ownedControls = [];
const additionalWork = { upstreamWidthBuilds: 0, directBuilds: 0, ownedRebuilds: 0, coldCompiles: 0, authoredParserCalls: 0, authoredParentRebuilds: 0, publicBuilds: 0, publicOwned: 0, directSamplerCalls: 0, rationalOperations: 0 };
function nativeJSON(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || ['string', 'boolean'].includes(typeof value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}';
}
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : nativeJSON(value)).digest('hex');
const size = text => ({ utf16: text.length, utf8: Buffer.byteLength(text) });
function saveText(name, text) { const path = resolve(output, name); writeFileSync(path, text); files.set(path, readFileSync(path)); assert.equal(readFileSync(path, 'utf8'), text); return path; }
function saveJSON(name, value, limit = 4194304) { const text = nativeJSON(value) + '\n'; assert.ok(text.length <= limit && Buffer.byteLength(text) <= limit, name); const path = saveText(name + '.json', text); assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), value); return path; }
function cold(source, model, name) { const path = saveText(name + '.source0.css', source); assert.ok(source.length <= 262144 && Buffer.byteLength(source) <= 262144); additionalWork.coldCompiles++; const compiled = compileCadModel(readFileSync(path, 'utf8'), { sourceVersion: 0 }); assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics)); assert.deepEqual(compiled.model, model); saveJSON(name + '-cold-model', compiled.model); }
function retention() { for (const [path, bytes] of files) assert.deepEqual(readFileSync(path), bytes, path); for (const [value, snapshot] of retained) assert.equal(nativeJSON(value), snapshot); }
function ownership(input, result) {
  const caller = new WeakSet(), seen = new WeakSet();
  function collect(value) { if (value && typeof value === 'object' && !caller.has(value)) { caller.add(value); Object.values(value).forEach(collect); } }
  function visit(value) { if (value && typeof value === 'object') { assert.ok(!caller.has(value)); assert.ok(!seen.has(value)); seen.add(value); Object.values(value).forEach(visit); } }
  collect(input); visit(result);
}
function reject(name, action, expected) {
  let failure; try { action(); } catch (error) { failure = error; }
  assert.ok(failure instanceof ExtrusionError, name + ': actual family error');
  if (expected) assert.ok((Array.isArray(expected) ? expected : [expected]).includes(failure.code), name + ': ' + failure.code);
  failures.push({ name, code: failure.code, message: failure.message, causeName: failure.cause?.name ?? null, causeCode: failure.cause?.code ?? null, causeMessage: failure.cause?.message ?? null }); retention(); return failure;
}
const upstreamSource = '/* 설계: original width source is separate provenance. */\r\n@model width_surface { version:0; length-unit:mm;\r\n'
  + '@curve #untouched_curve { type:nurbs; degree:2; knots:[-2.000,-2,-2,3,3,3]; control-points:[[-0,2,1],[3,4,2],[6,2,1]]; weights:[1,2,1]; }\r\n'
  + '@curve #original_line { type:nurbs; degree:1; knots:[0,0,1,1]; control-points:[[0,-0,0],[100,0,0]]; weights:[1,1]; }\r\n'
  + '@surface #untouched_surface { type:nurbs; degree-u:1; degree-v:1; knots-u:[0.000,0,1,1.00]; knots-v:[-1,-1,2,2]; control-points:[[[2,3,-0],[2,5,1]],[[4,3,2],[4,5,4]]]; weights:[[1,2],[3,4]]; }\r\n}\r\n';
const widthOptions = { lowerCurveId: 'width_lower', upperCurveId: 'width_upper', surfaceId: 'width_surface', loopId: 'width_loop', boundaryCurveIds: ['width_b0', 'width_b1', 'width_b2', 'width_b3'], face: { faceId: 'width_face', evaluationId: 'width_evaluation', resultIdPrefix: 'width_result', orientation: 'forward' } };
const widthRequest = { source: upstreamSource, sourceVersion: 0, curveId: 'original_line', widthMM: 5, options: widthOptions };
additionalWork.upstreamWidthBuilds++; const upstream = buildSourceLineWidthFace(widthRequest), parent = upstream.face;
saveJSON('upstream-width-request', widthRequest); saveJSON('upstream-width-result', upstream); cold(upstreamSource, upstream.originalModel, 'upstream-original'); cold(parent.source, parent.model, 'direct-original-convex');
retained.push([upstream, nativeJSON(upstream)], [parent, nativeJSON(parent)]);
const options = { evaluationId: 'direct_prism_shell', resultIdPrefix: 'dpx', distanceMM: 10, direction: 'positive-z' };
const boundaryOrder = ['v-min', 'u-max', 'v-max', 'u-min'];
function oracle(result) {
  assert.deepEqual(Object.keys(result).sort(), ['request', 'translation', 'walls', 'shell', 'bindings', 'report'].sort());
  const { request, translation, walls, shell, bindings, report } = result, d = request.options.distanceMM;
  assert.deepEqual(request.face, parent); assert.equal(request.options.direction, 'positive-z');
  assert.deepEqual(translation.normal, [0, 0, 1]); assert.deepEqual(translation.vector, [0, 0, d]); assert.equal(translation.distanceMM, d);
  const translated = point => [point[0], point[1], point[2] + d];
  const maps = [];
  for (let u = 0; u < 2; u++) for (let v = 0; v < 2; v++) { const point = parent.plane.controlPoints[u][v], top = translated(point); maps.push({ origin: { kind: 'support-pole', uIndex: u, vIndex: v }, originalPointMM: point, translatedPointMM: top, actualOffsetMM: top.map((value, axis) => value - point[axis]) }); }
  for (let i = 0; i < 4; i++) for (let p = 0; p < 2; p++) { const point = parent.loop.edges[i].controlPoints[p], top = translated(point); maps.push({ origin: { kind: 'boundary-pole', boundaryIndex: i, poleIndex: p }, originalPointMM: point, translatedPointMM: top, actualOffsetMM: top.map((value, axis) => value - point[axis]) }); }
  assert.deepEqual(translation.coefficientMappings, maps); assert.equal(maps.length, 12);
  assert.equal(walls.length, 4); assert.equal(shell.assets.length, 6); assert.equal(shell.pairs.length, 12); assert.equal(shell.pairResults.length, 12);
  const bottom = shell.assets[0].face.geometry.objects[0], top = shell.assets[1].face.geometry.objects[0];
  assert.deepEqual(bottom.controlPoints, Array.from({ length: 2 }, (_, u) => Array.from({ length: 2 }, (_, v) => parent.plane.controlPoints[v][u])));
  assert.deepEqual(bottom.weights, [[1, 1], [1, 1]]); assert.deepEqual(bottom.knotsU, parent.plane.knotsV); assert.deepEqual(bottom.knotsV, parent.plane.knotsU);
  assert.deepEqual(top.controlPoints, parent.plane.controlPoints.map(row => row.map(translated))); assert.deepEqual(top.knotsU, parent.plane.knotsU); assert.deepEqual(top.knotsV, parent.plane.knotsV); assert.deepEqual(top.weights, parent.plane.weights);
  const expectedNormals = [[0, 0, -1], [0, 0, 1], [0, -1, 0], [1, 0, 0], [0, 1, 0], [-1, 0, 0]];
  for (let i = 0; i < 6; i++) {
    const asset = shell.assets[i], plane = asset.face.geometry.objects[0], cp = plane.controlPoints;
    assert.equal(asset.face.geometry.name, 'parametric_face'); assert.equal(asset.face.geometry.objects.length, 5); assert.equal(asset.face.topology.face.orientation, 'forward');
    const a = cp[1][0].map((value, axis) => value - cp[0][0][axis]), b = cp[0][1].map((value, axis) => value - cp[0][0][axis]);
    const cross = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], length = Math.hypot(...cross);
    cross.forEach((value, axis) => assert.equal(value === 0 ? 0 : value / length, expectedNormals[i][axis]));
    if (i >= 2) { const wall = walls[i - 2]; assert.deepEqual(wall.first, parent.loop.edges[i - 2]); assert.deepEqual(wall.second.controlPoints, wall.first.controlPoints.map(translated)); assert.deepEqual(wall.second.knots, wall.first.knots); assert.deepEqual(wall.second.weights, wall.first.weights); assert.deepEqual(wall.surface, plane); assert.deepEqual(wall.model.objects, [wall.first, wall.second, wall.surface]); }
  }
  assert.equal(new Set(shell.assets.map(asset => asset.sourceId)).size, 6);
  const selector = (assetIndex, boundary) => ({ sourceId: shell.assets[assetIndex].sourceId, boundary });
  const pairs = [];
  for (let i = 0; i < 4; i++) pairs.push({ first: selector(0, boundaryOrder[3 - i]), second: selector(i + 2, 'v-min') });
  for (let i = 0; i < 4; i++) pairs.push({ first: selector(1, boundaryOrder[i]), second: selector(i + 2, 'v-max') });
  for (let i = 0; i < 4; i++) pairs.push({ first: selector(i + 2, 'u-max'), second: selector(2 + (i + 1) % 4, 'u-min') });
  assert.deepEqual(shell.pairs, pairs); assert.deepEqual(bindings.pairs, pairs);
  assert.equal(shell.options.shellId, request.options.evaluationId); assert.equal(shell.options.resultIdPrefix, request.options.resultIdPrefix);
  assert.equal(shell.options.maximumPairEvaluations, 12); assert.equal(shell.options.maximumObservationPairs, 36);
  assert.deepEqual(bindings.parent, { sourceField: 'request.face.source', modelField: 'request.face.model', modelName: parent.model.name, faceId: parent.topology.face.id, surfaceId: parent.plane.id, loopId: parent.topology.loop.id, orientation: 'forward', boundaryCurveIds: parent.loop.edges.map(edge => edge.id) });
  assert.deepEqual(bindings.assets, shell.assets.map((asset, i) => ({ assetIndex: i, role: i === 0 ? 'bottom' : i === 1 ? 'top' : 'wall', wallIndex: i < 2 ? null : i - 2, sourceId: asset.sourceId, modelName: asset.face.geometry.name, faceId: asset.face.topology.face.id, surfaceId: asset.face.geometry.objects[0].id, loopId: asset.face.topology.loop.id })));
  assert.deepEqual(bindings.bottomChart, { assetIndex: 0, kind: 'transpose-u-v', uRole: 'original-support-v', vRole: 'original-support-u', originalPoleForOutput: Array.from({ length: 2 }, (_, u) => Array.from({ length: 2 }, (_, v) => ({ uIndex: u, vIndex: v, originalUIndex: v, originalVIndex: u }))).flat() });
  assert.deepEqual(bindings.topChart, { assetIndex: 1, kind: 'identity-plus-z', uRole: 'original-support-u', vRole: 'original-support-v' });
  for (let i = 0; i < 4; i++) assert.deepEqual(bindings.walls[i], { wallIndex: i, assetIndex: i + 2, boundaryIndex: i, original: { sourceField: 'request.face.source', contextIndex: null, modelName: parent.model.name, objectIndex: i + 1, curveId: parent.loop.edges[i].id }, bottom: { sourceField: 'walls.source', contextIndex: i, modelName: walls[i].model.name, objectIndex: 0, curveId: walls[i].first.id }, top: { sourceField: 'walls.source', contextIndex: i, modelName: walls[i].model.name, objectIndex: 1, curveId: walls[i].second.id }, surfaceId: walls[i].surface.id, uRole: 'original-boundary-parameter', vRole: 'extrusion-interpolation' });
  assert.equal(bindings.assetAuthority, 'complete-six-source-assets-retained-in-shell.assets'); assert.equal(bindings.directionConvention, 'forward-parent-plus-z-outward-native-quad-charts');
  const graph = shell.graph, corners = [[0, -2.5, 0], [100, -2.5, 0], [100, 2.5, 0], [0, 2.5, 0]], expectedPoints = [...corners, ...corners.map(translated)];
  assert.equal(graph.vertices.length, 8); assert.equal(graph.edges.length, 12); assert.equal(graph.faces.length, 6); assert.equal(graph.vertexLinks.length, 8);
  assert.deepEqual(graph.vertices.map(vertex => nativeJSON(vertex.representative.pointMM)).sort(), expectedPoints.map(nativeJSON).sort());
  for (const vertex of graph.vertices) { assert.equal(vertex.members.length, 3); assert.equal(new Set(vertex.members.map(member => member.sourceId)).size, 3); vertex.members.forEach(member => assert.deepEqual(member.pointMM, vertex.representative.pointMM)); }
  for (const edge of graph.edges) { assert.deepEqual(edge.uses.map(use => use.effectiveSense), ['forward', 'reverse']); assert.notEqual(edge.uses[0].sourceId, edge.uses[1].sourceId); }
  for (const link of graph.vertexLinks) { assert.equal(link.incidentEdgeIds.length, 3); assert.equal(link.cornerArcs.length, 3); assert.equal(new Set(link.orientedCycleEdgeIds).size, 3); link.degrees.forEach(degree => { assert.equal(degree.degree, 2); assert.equal(degree.incoming, 1); assert.equal(degree.outgoing, 1); }); }
  const sums = { sourceCompilationCount: 0, faceValidationCount: 0, boundaryExtractionCount: 0, curveReversalCount: 0, observationPairCount: 0, curvePointEvaluationCount: 0, curveDerivativeEvaluationCount: 0 };
  for (const [i, child] of shell.pairResults.entries()) {
    assert.equal(child.report.quality.closed, false); assert.equal(child.report.quality.solid, false); assert.equal(child.report.pairCount, 1); assert.equal(child.report.freeBoundaryCount, 6);
    assert.deepEqual(child.report.pairs, [pairs[i]]); assert.equal(child.assets.length, 2); assert.equal(child.sharedEdges.length, 1);
    for (const key of Object.keys(sums)) sums[key] += child.report[key];
    const edge = child.sharedEdges[0]; assert.equal(edge.observations.length, 3); assert.equal(edge.uses[1].parameterMap.kind, 'reversed');
    for (const observation of edge.observations) { assert.equal(observation.pointDifferenceMM, 0); assert.equal(observation.derivativeDifferenceMM, 0); assert.equal(observation.relativeDerivativeDifference, 0); }
  }
  assert.deepEqual(sums, { sourceCompilationCount: 24, faceValidationCount: 24, boundaryExtractionCount: 24, curveReversalCount: 12, observationPairCount: 36, curvePointEvaluationCount: 72, curveDerivativeEvaluationCount: 72 });
  assert.deepEqual(shell.report.childDirectCounts, sums); assert.deepEqual(report.shellChildDirectCounts, sums);
  assert.deepEqual(report.directCounts, { parentValidationCallCount: 1, ruledBuildCallCount: 4, parametricFaceBuildCallCount: 6, sourceAdoptionCallCount: 6, closedShellBuildCallCount: 1, constructionDelegationCount: 17, totalDelegationCount: 18, curveD0Count: 0, curveD1AttemptCount: 0, surfaceD0Count: 0, surfaceD1AttemptCount: 0, rationalOperationCount: 0, booleanCallCount: 0, affineTransformCallCount: 0, extrudeCurveCallCount: 0 });
  assert.deepEqual(report.childReceiptCounts, { wallReceiptCount: 4, assetCount: 6, pairCount: 12, pairProofCount: 12, acceptedVertexClassCount: 8, acceptedEdgeCount: 12, acceptedFaceCount: 6, vertexLinkCount: 8, cornerArcCount: 24, globalFreeBoundaryCount: 0, reservedOriginalInventorySlots: 24 });
  assert.deepEqual(report.boundsMM, { min: [0, -2.5, 0], max: [100, 2.5, d] });
  assert.deepEqual(report.diagnostics, { spanXMM: 100, spanYMM: 5, spanZMM: d, volumeMM3: 500 * d, authority: 'axis-range-product-diagnostic-not-volume-certificate' });
  assert.deepEqual(report.sourceSizes, { parent: size(parent.source), assets: shell.assets.map((asset, assetIndex) => ({ assetIndex, sourceId: asset.sourceId, size: size(asset.source) })), walls: walls.map(wall => size(wall.source)) });
  assert.deepEqual(report.fileSizes.request, size(nativeJSON(request) + '\n')); assert.deepEqual(report.fileSizes.result, size(nativeJSON(result) + '\n'));
  for (const key of ['closed', 'orientedClosedIncidence', 'abstractIncidenceManifold', 'ownedRebuild']) assert.equal(report.quality[key], true);
  for (const [key, value] of Object.entries(report.quality)) if (typeof value === 'boolean' && !['closed', 'orientedClosedIncidence', 'abstractIncidenceManifold', 'ownedRebuild'].includes(key)) assert.equal(value, false, key);
  assert.equal(shell.report.solid, false); assert.equal(shell.report.embeddedManifoldCertified, false); assert.equal(shell.report.globalFreeBoundaryCount, 0); assert.equal(shell.report.eulerCharacteristic, 2);
  for (const value of Object.values(report.preservation)) assert.equal(value, true);
}
function construct(name, settings) {
  const snapshot = nativeJSON({ face: parent, options: settings }); additionalWork.directBuilds++; const result = extrude(parent, settings);
  assert.equal(nativeJSON({ face: parent, options: settings }), snapshot); ownership({ face: parent, options: settings }, result); oracle(result);
  saveJSON(name + '-request', result.request, 2097152); saveJSON(name + '-result', result);
  result.walls.forEach((wall, i) => { saveJSON(name + '-wall' + i + '-receipt', wall); cold(wall.source, wall.model, name + '-wall' + i + '-model3'); });
  result.shell.assets.forEach((asset, i) => { saveJSON(name + '-asset' + i, asset); cold(asset.source, asset.face.geometry, name + '-asset' + i + '-model5'); });
  additionalWork.ownedRebuilds++; assert.deepEqual(validate(result), result.report);
  // Persist actual constructor inputs, not the derived Convex report (which has
  // more fields than the unchanged strict parser's16-field record profile).
  const recipe = { face: { plane: parent.plane, loop: parent.loop, options: parent.options }, extrusionOptions: settings };
  const path = saveText(name + '.authored.json', nativeJSON(recipe) + '\n'); additionalWork.authoredParserCalls++; const reopened = parseRecipe(readFileSync(path, 'utf8')); assert.deepEqual(reopened, recipe);
  additionalWork.authoredParentRebuilds++; const rebuiltParent = buildConvexPlanarFace(reopened.face.plane, reopened.face.loop, reopened.face.options); assert.deepEqual(rebuiltParent, parent);
  additionalWork.directBuilds++; const rebuilt = extrude(rebuiltParent, reopened.extrusionOptions); assert.deepEqual(rebuilt, result); saveJSON(name + '-authored-rebuild', rebuilt);
  retained.push([result, nativeJSON(result)], [settings, nativeJSON(settings)]);
  cases.push({ name, distanceMM: settings.distanceMM, fileSizes: result.report.fileSizes, directCounts: result.report.directCounts, childReceiptCounts: result.report.childReceiptCounts, resultHash: hash(result), diagnosticVolumeMM3: result.report.diagnostics.volumeMM3 }); return result;
}
const main = construct('main-distance10', options), changedOptions = { ...options, distanceMM: 12 };
assert.deepEqual({ ...changedOptions, distanceMM: 10 }, options); const changed = construct('distance12-only-distance-edit', changedOptions);
assert.deepEqual(changed.request.face, main.request.face); assert.deepEqual(changed.shell.pairs, main.shell.pairs); assert.notDeepEqual(changed.translation, main.translation);

for (const [name, value] of [['zero', 0], ['negative', -1], ['below-profile', 1e-7], ['above-profile', 10001]]) reject('distance-' + name, () => extrude(parent, { ...options, distanceMM: value }), 'DISTANCE');
reject('nonfinite-distance', () => extrude(parent, { ...options, distanceMM: Infinity }), ['INPUT', 'DISTANCE']);
const reverse = buildConvexPlanarFace(parent.plane, parent.loop, { ...parent.options, orientation: 'reverse' }); saveJSON('genuine-reverse-convex-parent', reverse); reject('reverse-profile', () => extrude(reverse, options), 'PROFILE');
reject('unsupported-direction', () => extrude(parent, { ...options, direction: 'negative-z' }), ['INPUT', 'PROFILE']);
reject('parent-role-collision', () => extrude(parent, { ...options, evaluationId: parent.topology.face.id }), 'IDENTITY');
reject('prefix-cap', () => extrude(parent, { ...options, resultIdPrefix: 'abcdef' }), ['IDENTITY', 'BUDGET']);
const parentTamper = structuredClone(parent); parentTamper.source += '\n'; reject('actual-parent-source-refusal', () => extrude(parentTamper, options), 'PARENT');
const sourceCap = structuredClone(parent); sourceCap.source = parent.source.padEnd(262145, ' '); reject('source-string-cap', () => extrude(sourceCap, options), ['BUDGET', 'INPUT']);
const capControls = { sourceString: { tested: true, actualLength: sourceCap.source.length }, prefix: { tested: true, actualLength: 6, maximumLength: 5 }, distance: { tested: true, beyondMaximum: 10001, maximumDistanceMM: 10000 }, requestValidOverflowTested: false, resultValidOverflowTested: false, reason: 'No fabricated valid parent or result overflow under this bounded profile' }; saveJSON('cap-control-metadata', capControls);
const mutations = [
  ['parent', result => { result.request.face.model.objects[0].controlPoints[1][1][0] += .25; }],
  ['translation-map', result => { result.translation.coefficientMappings[0].translatedPointMM[2] += .25; }],
  ['normal', result => { result.translation.normal[2] = -1; }],
  ['wall-source', result => { result.walls[0].source += '\n'; }],
  ['cap-transpose', result => { result.shell.assets[0].face.geometry.objects[0].controlPoints[1][0][0] += .25; }],
  ['asset-source', result => { result.shell.assets[0].source += '\n'; }],
  ['local-pcurve', result => { result.shell.assets[1].face.topology.loop.uses[0].pcurve.uv0[0] += .25; }],
  ['pair', result => { result.shell.pairs[0].first.boundary = 'v-min'; }],
  ['child-observation', result => { result.shell.pairResults[0].sharedEdges[0].observations[0].pointDifferenceMM = .25; }],
  ['vertex-member', result => { result.shell.graph.vertices[0].members[0].pointMM[2] += .25; }],
  ['global-use', result => { result.shell.graph.edges[0].uses[0].effectiveSense = 'reverse'; }],
  ['vertex-link', result => { result.shell.graph.vertexLinks[0].degrees[0].incoming = 2; }],
  ['source-binding', result => { result.bindings.assets[0].modelName = 'changed'; }],
  ['counts', result => { result.report.directCounts.totalDelegationCount = 17; }],
  ['file-size', result => { result.report.fileSizes.result.utf8++; }],
  ['solid', result => { result.report.quality.solid = true; }]
];
for (const [name, mutate] of mutations) { const value = structuredClone(main), before = nativeJSON(value); mutate(value); assert.notEqual(nativeJSON(value), before); reject('owned-' + name, () => { additionalWork.ownedRebuilds++; return validate(value); }, 'OWNED'); ownedControls.push(name); }
let getterCalls = 0;
const accessor = structuredClone(options); Object.defineProperty(accessor, 'distanceMM', { enumerable: true, get() { getterCalls++; return 10; } }); reject('getter-options', () => extrude(parent, accessor), 'INPUT'); assert.equal(getterCalls, 0);
const hidden = structuredClone(options); Object.defineProperty(hidden, 'hidden', { value: 1 }); reject('hidden-options', () => extrude(parent, hidden), 'INPUT');
const symbolic = structuredClone(options); symbolic[Symbol('extra')] = 1; reject('symbol-options', () => extrude(parent, symbolic), 'INPUT');
const foreign = Object.assign(Object.create({ inherited: 1 }), options); reject('foreign-options', () => extrude(parent, foreign), 'INPUT');
const cycle = structuredClone(main); cycle.request.options.cycle = cycle; reject('owned-cycle', () => validate(cycle), 'OWNED');
const sparse = structuredClone(main); delete sparse.shell.assets[0]; reject('owned-sparse', () => validate(sparse), 'OWNED');
saveJSON('source-api.metafile', bundle.metafile); saveText('source-api.mjs', bundle.outputFiles[0].text);
const publicPath = resolve(repo, 'packages/barocss-cad/dist/index.js'), publicAPI = await import(pathToFileURL(publicPath).href);
const declarations = readFileSync(resolve(repo, 'packages/barocss-cad/dist/index.d.ts'), 'utf8');
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
for (const name of [...runtimeNames, ...typeNames]) assert.match(declarations, new RegExp('\\b' + name + '\\b'));
assert.deepEqual(publicAPI.ConvexPlanarFaceExtrusionDiagnosticCode, codes); additionalWork.publicBuilds++;
const publicMain = publicAPI.extrudeConvexPlanarFace(parent, options); assert.deepEqual(publicMain, main); additionalWork.publicOwned++; assert.deepEqual(publicAPI.validateConvexPlanarFaceExtrusion(publicMain), main.report); saveJSON('current-public-main', publicMain);
retention();
const summary = { schema: 'convex-planar-face-extrusion-demo', version: 0, nativeParent: '6817bbaefc5eb9861206cce0c47f0ce07abbd948', cases, runtimeNames, typeNames, upstreamWidthProvenanceSeparate: true, pureDistanceEdit: true, completeSixModel5SourcesAndTwelvePairProofs: true, authoredFaceRecipeRestoresFullParentAndShell: true, unchangedPrivateStrictParser: true, noBooleanProvenance: true, noFractionCampaign: true, additionalWork, ownedControls, getterCalls, failures, capControls, sourceInputs: inputs.length, outputFilesBeforeSummary: files.size, actualClosure: main.shell.report, quality: { solid: false, embedding: false, volumeCertified: false, rendererAccepted: false } };
saveJSON('summary', summary); console.log(nativeJSON(summary));
