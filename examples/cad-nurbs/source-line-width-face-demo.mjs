import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node source-line-width-face-demo.mjs --source <output-directory>');
assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]);
mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const esbuild = require('esbuild');
const indexSource = resolve(repo, 'packages/barocss-cad/src/index.ts');
const authoredParserSource = resolve(repo, 'packages/barocss-cad/src/cad-document.ts');
// The existing strict own parser is an internal module export. This bridge is
// only part of the source demo bundle; it adds nothing to the public barrel.
const bridge = 'export * from ' + JSON.stringify(indexSource) + ';\n'
  + 'export { parseCadDocumentOwnJson as demoParseAuthoredOwnJson } from ' + JSON.stringify(authoredParserSource) + ';\n';
const bundle = await esbuild.build({ absWorkingDir: repo, stdin: { contents: bridge, resolveDir: repo, sourcefile: 'line-width-face-demo-source-bridge.mjs', loader: 'js' }, bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
assert.equal(bundle.outputFiles.length, 1);
const inputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path));
for (const leaf of ['nurbs/source-wide/source-line-width-face.ts', 'nurbs/surfaces/compatible-ruled-surface.ts', 'own-convex-planar-face.ts', 'core/boundary.ts']) assert.ok(inputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
assert.ok(!inputs.some(path => path.includes('/packages/barocss-cad/dist/')));
assert.ok(inputs.filter(path => path.includes('/packages/barocss-cad/')).every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const { buildSourceLineWidthFace: build, validateSourceLineWidthFace: validate, SourceLineWidthFaceError: WidthError, SourceLineWidthFaceDiagnosticCode: codes, compileCadModel, demoParseAuthoredOwnJson: parseAuthoredOwnJson } = api;
assert.equal(typeof parseAuthoredOwnJson, 'function'); assert.ok(inputs.includes(authoredParserSource));
const runtimeNames = ['buildSourceLineWidthFace', 'validateSourceLineWidthFace', 'SourceLineWidthFaceError', 'SourceLineWidthFaceDiagnosticCode'];
const typeNames = ['SourceLineWidthFaceRequest', 'SourceLineWidthFaceOptions', 'SourceLineWidthFaceReport', 'SourceLineWidthFaceResult'];
for (const name of runtimeNames) assert.equal(typeof api[name], name.endsWith('Code') ? 'object' : 'function');
for (const name of ['INPUT', 'VERSION', 'IDENTITY', 'SOURCE', 'TARGET', 'PROFILE', 'WIDTH', 'REPRESENTABILITY', 'BUDGET', 'RULED', 'BOUNDARY', 'FACE', 'BINDING', 'OWNED', 'FILE']) assert.equal(codes[name], name);
const files = new Map(), retained = [], cases = [], failures = [], ownedControls = [];
const additionalWork = { sourceBuildCalls: 0, ownedRebuildCalls: 0, authoredParserCalls: 0, coldCompilerCalls: 0, publicBuildCalls: 0, publicOwnedCalls: 0, directSamplerCalls: 0, rationalOperations: 0 };
function nativeJSON(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || ['string', 'boolean'].includes(typeof value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}';
}
const size = text => ({ utf16: text.length, utf8: Buffer.byteLength(text) });
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : nativeJSON(value)).digest('hex');
function saveText(name, text) { const path = resolve(output, name); writeFileSync(path, text); files.set(path, readFileSync(path)); assert.equal(readFileSync(path, 'utf8'), text); return path; }
function saveJSON(name, value, maximum = 2097152) {
  const text = nativeJSON(value) + '\n'; assert.ok(text.length <= maximum && Buffer.byteLength(text) <= maximum, name);
  const path = saveText(name + '.json', text); assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), value); return path;
}
function cold(source, expected, name) {
  assert.ok(source.length <= 262144 && Buffer.byteLength(source) <= 262144); const path = saveText(name + '.source0.css', source);
  additionalWork.coldCompilerCalls++; const compiled = compileCadModel(readFileSync(path, 'utf8'), { sourceVersion: 0 });
  assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics)); if (expected) assert.deepEqual(compiled.model, expected);
  saveJSON(name + '-cold-model', compiled.model); return compiled;
}
function retention() { for (const [path, bytes] of files) assert.deepEqual(readFileSync(path), bytes, path); for (const [value, snapshot] of retained) assert.equal(nativeJSON(value), snapshot); }
function independentlyOwned(request, result) {
  const caller = new WeakSet(), seen = new WeakSet();
  function collect(value) { if (value && typeof value === 'object' && !caller.has(value)) { caller.add(value); Object.values(value).forEach(collect); } }
  function visit(value) { if (value && typeof value === 'object') { assert.ok(!caller.has(value), 'Caller alias'); assert.ok(!seen.has(value), 'Repeated returned occurrence'); seen.add(value); Object.values(value).forEach(visit); } }
  collect(request); visit(result);
}
function reject(name, action, expected) {
  let failure; try { action(); } catch (error) { failure = error; }
  assert.ok(failure instanceof WidthError, name + ': actual family error');
  if (expected) assert.ok((Array.isArray(expected) ? expected : [expected]).includes(failure.code), name + ': ' + failure.code);
  failures.push({ name, code: failure.code, message: failure.message, causeName: failure.cause?.name ?? null, causeCode: failure.cause?.code ?? null, causeMessage: failure.cause?.message ?? null });
  retention(); return failure;
}
const original = { kind: 'curve', id: 'original_line', degree: 1, knots: [0, 0, 1, 1], controlPoints: [[0, -0, 0], [100, 0, 0]], weights: [1, 1] };
function originalSource(curve = original, siblingId = 'untouched_curve') {
  const curveText = '@curve #' + curve.id + ' { type:nurbs; degree:' + nativeJSON(curve.degree) + '; knots:' + nativeJSON(curve.knots) + '; control-points:' + nativeJSON(curve.controlPoints) + '; weights:' + nativeJSON(curve.weights) + '; }';
  return '/* 설계: complete original source; width is independent intent. */\r\n@model width_surface {\r\n version:0; length-unit:mm;\r\n'
    + '@curve #' + siblingId + ' { type:nurbs; degree:2; knots:[-2.000,-2,-2,3,3.0,3]; control-points:[[-0,2,1],[3,4,2],[6,2,1]]; weights:[1,2,1]; }\r\n'
    + curveText + '\r\n/* Keep this unrelated nonplanar weighted Surface. */\r\n'
    + '@surface #untouched_surface { type:nurbs; degree-u:1; degree-v:1; knots-u:[0.000,0,1,1.00]; knots-v:[-1,-1,2,2]; control-points:[[[2,3,-0],[2,5,1]],[[4,3,2],[4,5,4]]]; weights:[[1,2],[3,4]]; }\r\n}\r\n';
}
const source = originalSource();
const originalCold = cold(source, null, 'original'); assert.deepEqual(originalCold.model.objects[1], original);
assert.ok(source.includes('\r\n') && source.includes('설계') && source.includes('-2.000'));
const options = { lowerCurveId: 'width_lower', upperCurveId: 'width_upper', surfaceId: 'width_surface', loopId: 'width_loop', boundaryCurveIds: ['width_b0', 'width_b1', 'width_b2', 'width_b3'], face: { faceId: 'width_face', evaluationId: 'width_evaluation', resultIdPrefix: 'width_result', orientation: 'forward' } };
const requestFor = (widthMM, settings = options, text = source, curveId = original.id) => ({ source: text, sourceVersion: 0, curveId, widthMM, options: structuredClone(settings) });
const boundaries = ['v-min', 'u-max', 'v-max', 'u-min'];
function generatedIds(settings) {
  return [settings.lowerCurveId, settings.upperCurveId, settings.surfaceId, settings.loopId, settings.face.faceId, settings.face.evaluationId, ...settings.boundaryCurveIds, ...Array.from({ length: 4 }, (_, i) => ['v', 'e', 'use', 'uv'].map(role => settings.face.resultIdPrefix + '_' + role + '_' + i)).flat()];
}
function rectangleOracle(result) {
  assert.deepEqual(Object.keys(result).sort(), ['request', 'originalModel', 'originalCurve', 'ruled', 'face', 'bindings', 'report'].sort());
  const { request, originalCurve: curve, ruled, face, bindings, report } = result, settings = request.options;
  assert.deepEqual(result.originalModel, originalCold.model); assert.deepEqual(curve, result.originalModel.objects[1]); assert.deepEqual(curve, original);
  assert.equal(request.source, source); assert.ok(Object.is(curve.controlPoints[0][1], -0));
  const half = request.widthMM / 2, lowerY = -half, upperY = half;
  const lower = { ...structuredClone(curve), id: settings.lowerCurveId, controlPoints: curve.controlPoints.map(point => [point[0], lowerY, point[2]]) };
  const upper = { ...structuredClone(curve), id: settings.upperCurveId, controlPoints: curve.controlPoints.map(point => [point[0], upperY, point[2]]) };
  assert.deepEqual(ruled.first, lower); assert.deepEqual(ruled.second, upper);
  const support = { kind: 'surface', id: settings.surfaceId, degreeU: 1, degreeV: 1, knotsU: [...curve.knots], knotsV: [0, 0, 1, 1], controlPoints: lower.controlPoints.map((point, i) => [point, upper.controlPoints[i]]), weights: [[1, 1], [1, 1]] };
  assert.deepEqual(ruled.surface, support); assert.deepEqual(ruled.model, { name: settings.surfaceId, version: 0, lengthUnit: 'mm', objects: [lower, upper, support] });
  assert.equal(result.originalModel.name, ruled.model.name, 'Equal actual Model names remain qualified by distinct retained source fields');
  const corners = [[0, lowerY, 0], [100, lowerY, 0], [100, upperY, 0], [0, upperY, 0]];
  const edgeCurves = corners.map((point, i) => ({ kind: 'curve', id: settings.boundaryCurveIds[i], degree: 1, knots: [0, 0, 1, 1], controlPoints: [point, corners[(i + 1) % 4]], weights: [1, 1] }));
  assert.deepEqual(face.plane, support); assert.deepEqual(face.loop, { id: settings.loopId, edges: edgeCurves });
  assert.deepEqual(face.model, { name: settings.face.evaluationId, version: 0, lengthUnit: 'mm', objects: [support, ...edgeCurves] });
  assert.deepEqual(face.topology.vertices.map(vertex => vertex.point), corners);
  const orientation = settings.face.orientation, direction = orientation === 'forward' ? 1 : -1;
  const canonicalIndices = orientation === 'forward' ? [0, 1, 2, 3] : [3, 2, 1, 0];
  assert.deepEqual(face.topology.loop.uses.map(use => use.curveId), canonicalIndices.map(index => settings.boundaryCurveIds[index]));
  assert.equal(face.topology.face.orientation, orientation); assert.equal(face.report.authoredOrientation, 'ccw'); assert.equal(face.report.outerUseOrientation, orientation === 'forward' ? 'ccw' : 'cw');
  face.topology.loop.uses.forEach((use, index) => { assert.equal(use.sense, orientation); assert.deepEqual(use.interval, orientation === 'forward' ? [0, 1] : [1, 0]); assert.equal(use.vertexIds[1], face.topology.loop.uses[(index + 1) % 4].vertexIds[0]); });
  assert.equal(face.bindings.length, 12);
  for (const binding of face.bindings) {
    const index = settings.boundaryCurveIds.indexOf(binding.curveId), start = corners[index], end = corners[(index + 1) % 4];
    assert.ok(index >= 0); const derivative = end.map((value, axis) => value - start[axis]);
    const expectedPoint = start.map((value, axis) => value + (end[axis] - value) * binding.parameter);
    assert.deepEqual(binding.lineD1.point, expectedPoint); assert.deepEqual(binding.lineD1.derivative, derivative);
    assert.deepEqual(binding.surfaceD1.du, [100, 0, 0]); assert.deepEqual(binding.surfaceD1.dv, [0, request.widthMM, 0]);
    assert.equal(binding.pointDifferenceMM, 0); assert.equal(binding.tangentDifferenceMM, 0);
    binding.orientedLineTangentMM.forEach((value, axis) => assert.equal(value, derivative[axis] * direction));
    assert.ok(binding.orientedFaceNormal[0] === 0 && binding.orientedFaceNormal[1] === 0); assert.equal(binding.orientedFaceNormal[2], direction);
  }
  assert.deepEqual(bindings.sources, {
    original: { context: 'original', sourceField: 'request.source', modelField: 'originalModel', sourceVersion: 0, modelName: result.originalModel.name },
    ruled: { context: 'ruled', sourceField: 'ruled.source', modelField: 'ruled.model', sourceVersion: 0, modelName: ruled.model.name },
    face: { context: 'face', sourceField: 'face.source', modelField: 'face.model', sourceVersion: 0, modelName: face.model.name }
  });
  assert.deepEqual(bindings.original, { context: 'original', modelName: result.originalModel.name, objectIndex: 1, curveId: curve.id });
  assert.deepEqual(bindings.sections, { lower: { context: 'ruled', modelName: ruled.model.name, objectIndex: 0, curveId: lower.id }, upper: { context: 'ruled', modelName: ruled.model.name, objectIndex: 1, curveId: upper.id } });
  assert.deepEqual(bindings.support, { ruled: { context: 'ruled', modelName: ruled.model.name, objectIndex: 2, surfaceId: support.id }, face: { context: 'face', modelName: face.model.name, objectIndex: 0, surfaceId: support.id }, completeBitsEqual: true });
  for (let index = 0; index < 4; index++) {
    const curveId = settings.boundaryCurveIds[index], edge = face.topology.edges.find(edge => edge.curveId === curveId), pcurve = face.pcurves.find(pcurve => pcurve.curveId === curveId);
    const traversalIndex = face.topology.loop.uses.findIndex(use => use.curveId === curveId), use = face.topology.loop.uses[traversalIndex];
    assert.deepEqual(bindings.boundaries[index], { index, boundary: boundaries[index], curve: { context: 'face', modelName: face.model.name, objectIndex: index + 1, curveId }, edgeId: edge.id, pcurveId: pcurve.id, useId: use.id, traversalIndex, sense: use.sense, interval: use.interval });
  }
  assert.deepEqual(bindings.face, { faceId: face.topology.face.id, loopId: face.topology.loop.id, orientation, useIdsInTraversalOrder: face.topology.loop.uses.map(use => use.id) });
  const ids = generatedIds(settings); assert.equal(ids.length, 26); assert.equal(new Set(ids).size, 26);
  assert.deepEqual([...report.generatedRoleIds].sort(), [...ids].sort()); assert.ok(ids.every(id => !result.originalModel.objects.some(object => object.id === id)));
  assert.equal(report.selectedObjectIndex, 1); assert.equal(report.originalObjectCount, 3); assert.equal(report.originalModelName, result.originalModel.name);
  assert.deepEqual(report.widthIntent, { placement: 'centered-y', centerYMM: 0, centerZMM: 0, requestedWidthMM: request.widthMM, halfWidthMM: half, lowerYMM: lowerY, upperYMM: upperY, representedWidthMM: upperY - lowerY, representedWidthEqualsRequest: true });
  assert.deepEqual(report.originalBasis, { degree: 1, poleCount: 2, knots: [0, 0, 1, 1], weights: [1, 1], domain: [0, 1] });
  assert.deepEqual(report.diagnostics, { representedLengthMM: 100, representedAreaMM2: 100 * request.widthMM, authority: 'axis-product-diagnostics-not-solid-or-global-error-certificate' });
  assert.deepEqual(report.directCounts, { originalSourceCompileCount: 1, ruledBuildCallCount: 1, boundaryExtractionCallCount: 4, convexFaceBuildCallCount: 1, producerDelegationCount: 7, curveD0Count: 0, curveD1AttemptCount: 0, surfaceD0Count: 0, surfaceD1AttemptCount: 0, rationalOperationCount: 0, sourceWriterCallCount: 0, parentValidationCallCount: 0 });
  assert.deepEqual(report.childReceiptCounts, { ruledObservationCount: 9, faceBindingCount: 12, boundaryCurveCount: 4, facePcurveCount: 4, ruledModelObjectCount: 3, faceModelObjectCount: 5 });
  assert.deepEqual(report.sourceSizes, { original: size(request.source), ruled: size(ruled.source), face: size(face.source) });
  assert.deepEqual(report.fileSizes.request, size(nativeJSON(request) + '\n')); assert.deepEqual(report.fileSizes.result, size(nativeJSON(result) + '\n'));
  for (const key of ['nativeFaceConstructed', 'incidenceValid', 'ownedRebuild']) assert.equal(report.quality[key], true);
  for (const [key, value] of Object.entries(report.quality)) if (typeof value === 'boolean' && !['nativeFaceConstructed', 'incidenceValid', 'ownedRebuild'].includes(key)) assert.equal(value, false, key);
  assert.equal(face.report.topologyCertified, false); assert.equal(face.report.solid, false); assert.equal(ruled.report.solid, false);
  for (const key of ['completeOriginalSource', 'completeOriginalModel', 'originalSelectedCurveBits', 'originalUnselectedObjectBits', 'completeRuledReceipt', 'completeConvexFaceReceipt', 'selectedXZBasisWeightCopies', 'supportBitsAcrossDerivedContexts', 'naturalBoundaryDirections']) assert.equal(report.preservation[key], true);
}
function construct(name, request) {
  const before = nativeJSON(request); additionalWork.sourceBuildCalls++; const result = build(request); assert.equal(nativeJSON(request), before); independentlyOwned(request, result);
  rectangleOracle(result); saveJSON(name + '-request', request, 1048576); saveJSON(name + '-result', result);
  cold(request.source, result.originalModel, name + '-original'); cold(result.ruled.source, result.ruled.model, name + '-ruled-model3'); cold(result.face.source, result.face.model, name + '-face-model5');
  additionalWork.ownedRebuildCalls++; assert.deepEqual(validate(result), result.report);
  const authoredPath = saveText(name + '.authored.json', nativeJSON(request) + '\n'); additionalWork.authoredParserCalls++;
  const reopened = parseAuthoredOwnJson(readFileSync(authoredPath, 'utf8')); assert.deepEqual(reopened, request);
  additionalWork.sourceBuildCalls++; const rebuilt = build(reopened); assert.deepEqual(rebuilt, result); saveJSON(name + '-reopened-result', rebuilt);
  retained.push([request, before], [result, nativeJSON(result)]);
  cases.push({ name, widthMM: request.widthMM, orientation: request.options.face.orientation, diagnosticAreaMM2: result.report.diagnostics.representedAreaMM2, sourceSizes: result.report.sourceSizes, fileSizes: result.report.fileSizes, directCounts: result.report.directCounts, childReceiptCounts: result.report.childReceiptCounts, resultHash: hash(result) });
  return result;
}
const mainRequest = requestFor(5), main = construct('main-width5-forward', mainRequest);
const widthRequest = { ...structuredClone(mainRequest), widthMM: 8 }; assert.deepEqual({ ...widthRequest, widthMM: 5 }, mainRequest);
const width8 = construct('width8-forward-only-width-edit', widthRequest);
assert.deepEqual(width8.originalModel, main.originalModel); assert.deepEqual(width8.request.options, main.request.options); assert.equal(width8.request.source, main.request.source);
const reverseRequest = structuredClone(widthRequest); reverseRequest.options.face.orientation = 'reverse';
const reverse = construct('width8-reverse-separate', reverseRequest);
assert.deepEqual(reverse.face.loop.edges, width8.face.loop.edges); assert.deepEqual(reverse.face.model, width8.face.model); assert.equal(reverse.face.source, width8.face.source);
assert.notDeepEqual(reverse.face.topology.loop.uses, width8.face.topology.loop.uses);

for (const [name, value] of [['zero', 0], ['negative', -1], ['below-profile', 1e-7], ['over-profile', 10001]]) reject('width-' + name, () => build(requestFor(value)), 'WIDTH');
reject('width-nonfinite', () => build(requestFor(Infinity)), ['INPUT', 'WIDTH']);
reject('source-version', () => build({ ...mainRequest, sourceVersion: 1 }), 'VERSION');
reject('unknown-target', () => build({ ...mainRequest, curveId: 'missing_curve' }), 'TARGET');
reject('surface-target', () => build({ ...mainRequest, curveId: 'untouched_surface' }), 'TARGET');
reject('invalid-source', () => build({ ...mainRequest, source: source.replace('degree:1;', 'degree:;') }), 'SOURCE');
const wrongProfiles = [
  ['nonunit-weights', { ...structuredClone(original), weights: [1, 2] }],
  ['negative-zero-basis', { ...structuredClone(original), knots: [-0, 0, 1, 1] }],
  ['nonaxis-line', { ...structuredClone(original), controlPoints: [[0, 0, 0], [100, 1, 0]] }],
  ['negative-direction', { ...structuredClone(original), controlPoints: [[100, 0, 0], [0, 0, 0]] }],
  ['higher-degree', { ...structuredClone(original), degree: 2, knots: [0, 0, 0, 1, 1, 1], controlPoints: [[0, 0, 0], [50, 0, 0], [100, 0, 0]], weights: [1, 1, 1] }]
];
for (const [name, curve] of wrongProfiles) { const text = originalSource(curve); cold(text, null, 'native-valid-' + name); reject('profile-' + name, () => build(requestFor(5, options, text)), 'PROFILE'); }
const duplicate = structuredClone(options); duplicate.upperCurveId = duplicate.lowerCurveId; reject('duplicate-role', () => build(requestFor(5, duplicate)), 'IDENTITY');
const collision = structuredClone(options); collision.surfaceId = 'untouched_curve'; reject('unused-sibling-identity', () => build(requestFor(5, collision)), 'IDENTITY');
const generatedCollisionSource = originalSource(original, options.face.resultIdPrefix + '_v_0'); cold(generatedCollisionSource, null, 'native-valid-generated-role-collision');
reject('generated-role-sibling-collision', () => build(requestFor(5, options, generatedCollisionSource)), 'IDENTITY');
const affineCurve = { ...structuredClone(original), controlPoints: [[-10000, 0, 0], [.000001, 0, 0]] }, affineSource = originalSource(affineCurve);
cold(affineSource, null, 'genuine-affine-corner-rounding-original');
const affineFailure = reject('actual-affine-corner-parent', () => build(requestFor(5, options, affineSource)), ['FACE', 'RULED', 'BOUNDARY']);
assert.ok(affineFailure.cause instanceof Error); saveJSON('affine-corner-refusal-request', requestFor(5, options, affineSource), 1048576);

// The valid source remains below the existing raw-string cap. JSON must encode
// each comment NUL as six characters, so the retained request exceeds1MiB.
// Prove actual lexer admission in this same flow before attributing FILE.
const escapedCommentSource = source + '/*' + '\0'.repeat(200000) + '*/\r\n';
assert.ok(escapedCommentSource.length <= 262144 && Buffer.byteLength(escapedCommentSource) <= 262144);
additionalWork.coldCompilerCalls++;
const escapedCommentCold = compileCadModel(escapedCommentSource, { sourceVersion: 0 });
assert.equal(escapedCommentCold.ok, true, JSON.stringify(escapedCommentCold.diagnostics));
assert.deepEqual(escapedCommentCold.model, main.originalModel);
const escapedRequest = requestFor(5, options, escapedCommentSource), escapedRequestSizes = size(nativeJSON(escapedRequest) + '\n');
assert.ok(escapedRequestSizes.utf16 > 1048576 && escapedRequestSizes.utf8 > 1048576);
reject('genuine-escaped-request-cap', () => build(escapedRequest), 'FILE');
const oversizedSource = source.padEnd(262145, ' ');
assert.equal(oversizedSource.length, 262145);
reject('source-string-cap', () => build(requestFor(5, options, oversizedSource)), 'BUDGET');
const capControls = { request: { tested: true, validRawSourceSizes: size(escapedCommentSource), sourceHash: hash(escapedCommentSource), actualCompilerAccepted: escapedCommentCold.ok, escapedRequestSizes, expectedCode: 'FILE' }, sourceString: { tested: true, sizes: size(oversizedSource), expectedCode: 'BUDGET' }, resultEnvelope: { testedOverflow: false, maximumUTF16: 2097152, maximumUTF8: 2097152, reason: 'No fabricated overflow of a valid complete result' } };
saveJSON('cap-refusal-metadata', capControls);

const mutations = [
  ['original-source', result => { result.request.source += '\r\n'; }],
  ['original-model-sibling', result => { result.originalModel.objects[0].controlPoints[1][0] += .25; }],
  ['original-selected', result => { result.originalCurve.controlPoints[1][0] += 1; }],
  ['width-intent', result => { result.request.widthMM = 6; }],
  ['ruled-source', result => { result.ruled.source += '\n'; }],
  ['face-source', result => { result.face.source += '\n'; }],
  ['support', result => { result.face.plane.controlPoints[1][1][1] += .25; }],
  ['world-boundary', result => { result.face.loop.edges[0].controlPoints[0][0] += .25; }],
  ['uv-pcurve', result => { result.face.pcurves[0].curve.controlPoints[0][0] += .25; }],
  ['orientation', result => { result.face.topology.face.orientation = 'reverse'; }],
  ['use', result => { result.face.topology.loop.uses[0].sense = 'reverse'; }],
  ['source-binding', result => { result.bindings.sources.face.modelName += '_changed'; }],
  ['boundary-binding', result => { result.bindings.boundaries[0].traversalIndex = 1; }],
  ['count', result => { result.report.directCounts.producerDelegationCount = 6; }],
  ['file-size', result => { result.report.fileSizes.result.utf8++; }],
  ['solid-flag', result => { result.report.quality.solid = true; }]
];
for (const [name, mutate] of mutations) {
  const changed = structuredClone(main), before = nativeJSON(changed); mutate(changed); assert.notEqual(nativeJSON(changed), before);
  reject('owned-' + name, () => { additionalWork.ownedRebuildCalls++; return validate(changed); }, 'OWNED'); ownedControls.push(name);
}
let getterCalls = 0;
const accessor = structuredClone(mainRequest); Object.defineProperty(accessor, 'widthMM', { enumerable: true, get() { getterCalls++; return 5; } }); reject('getter-request', () => build(accessor), 'INPUT'); assert.equal(getterCalls, 0);
const hidden = structuredClone(mainRequest); Object.defineProperty(hidden.options, 'hidden', { value: 1 }); reject('hidden-input', () => build(hidden), 'INPUT');
const symbol = structuredClone(mainRequest); symbol[Symbol('hidden')] = 1; reject('symbol-input', () => build(symbol), 'INPUT');
const foreign = Object.assign(Object.create({ inherited: 1 }), mainRequest); reject('foreign-input', () => build(foreign), 'INPUT');
const cycle = structuredClone(main); cycle.request.options.cycle = cycle; reject('owned-cycle', () => validate(cycle), 'OWNED');
const sparse = structuredClone(main); delete sparse.face.pcurves[0]; reject('owned-sparse', () => validate(sparse), 'OWNED');

saveJSON('source-api.metafile', bundle.metafile); saveText('source-api.mjs', bundle.outputFiles[0].text);
const publicPath = resolve(repo, 'packages/barocss-cad/dist/index.js'), publicAPI = await import(pathToFileURL(publicPath).href);
const declarationPath = resolve(repo, 'packages/barocss-cad/dist/index.d.ts'), declarations = readFileSync(declarationPath, 'utf8');
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
for (const name of [...runtimeNames, ...typeNames]) assert.match(declarations, new RegExp('\\b' + name + '\\b'));
assert.deepEqual(publicAPI.SourceLineWidthFaceDiagnosticCode, codes);
additionalWork.publicBuildCalls++; const publicMain = publicAPI.buildSourceLineWidthFace(mainRequest); assert.deepEqual(publicMain, main);
additionalWork.publicOwnedCalls++; assert.deepEqual(publicAPI.validateSourceLineWidthFace(publicMain), main.report); saveJSON('current-public-main', publicMain);
retention();
const summary = { schema: 'source-line-width-face-demo', version: 0, nativeParent: '7ec31c6c53d8489e9aa1bcac7f776af0b0bfaf95', cases, runtimeNames, typeNames, authoredSourceHash: hash(source), originalSourcePreserved: true, pureWidthEdit: true, separateReverse: true, equalModelNamesSourceQualified: true, model3AndModel5SourcesSeparate: true, faceTopologyRestoredByAuthoredRequestRebuild: true, noFractionCampaign: true, additionalWork, workScope: 'demo-and-replay-calls-separate-from-wrapper-seven-delegations-and-retained-child-work', ownedControls, getterCalls, failures, capControls, actualAffineFailure: { code: affineFailure.code, cause: affineFailure.cause.message }, publicArtifacts: { runtimePath: publicPath, declarationPath, runtimeSHA256: hash(readFileSync(publicPath, 'utf8')), declarationSHA256: hash(declarations) }, sourceInputs: inputs.length, outputFilesBeforeSummary: files.size, quality: { solid: false, geometricEmbeddingCertified: false, rendererAccepted: false, arbitraryCurveOffset: false } };
saveJSON('summary', summary); console.log(nativeJSON(summary));
