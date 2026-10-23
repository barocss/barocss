import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
const args = process.argv.slice(2); assert.equal(args.length, 2, 'Usage: node source-surface-control-net-demo.mjs --source <output-directory>'); assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]); mkdirSync(output, {recursive: true});
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json')), esbuild = require('esbuild'), entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundle = await esbuild.build({absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true}); assert.equal(bundle.outputFiles.length, 1);
const sourceInputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path)), cadInputs = sourceInputs.filter(path => path.includes('/packages/barocss-cad/'));
for (const leaf of ['index.ts', 'source-surface-control-net.ts', 'surface-control-net.ts', 'source-ast.ts', 'model-compiler.ts']) assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/'))); assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const {editSourceSurfaceControlNet: editSource, validateSourceSurfaceControlNetEdit: validate, SourceSurfaceControlNetError: EditError, SourceSurfaceControlNetDiagnosticCode,
  editSurfaceControlNet, compileCadModel, evaluateSurface, evaluateSurfaceD1} = api;
const runtimeNames = ['editSourceSurfaceControlNet', 'validateSourceSurfaceControlNetEdit', 'SourceSurfaceControlNetError', 'SourceSurfaceControlNetDiagnosticCode'];
const typeNames = ['SourceSurfaceControlNetRequest', 'SourceSurfaceControlNetPatch', 'SourceSurfaceControlNetReport', 'SourceSurfaceControlNetResult'];
for (const name of runtimeNames) assert.equal(typeof api[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(Object.keys(SourceSurfaceControlNetDiagnosticCode).sort(), ['INPUT', 'VERSION', 'IDENTITY', 'SOURCE', 'TARGET', 'BINDING', 'BUDGET', 'NATIVE', 'OWNED'].sort());
const files = new Map(), accepted = [], cases = [], failures = [];
function nativeJSON(value) { if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); } if (value === null || ['string', 'boolean'].includes(typeof value)) return JSON.stringify(value); if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']'; return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}'; }
function jsonFile(name, value) { const file = resolve(output, name + '.json'); writeFileSync(file, nativeJSON(value) + '\n'); files.set(file, readFileSync(file)); const reopened = JSON.parse(readFileSync(file, 'utf8')); assert.deepEqual(reopened, value); return {file, reopened}; }
function sourceFile(name, source, model) { const file = resolve(output, name + '.source0.css'); writeFileSync(file, source); files.set(file, readFileSync(file)); const cold = compileCadModel(readFileSync(file, 'utf8'), {sourceVersion: 0}); assert.equal(cold.ok, true, JSON.stringify(cold.diagnostics)); assert.deepEqual(cold.model, model); return file; }
function ownership(inputs, result) { const caller = new WeakSet(), seen = new WeakSet(); const collect = value => { if (value && typeof value === 'object' && !caller.has(value)) { caller.add(value); Object.values(value).forEach(collect); }}; inputs.forEach(collect); const visit = value => { if (value && typeof value === 'object') { assert.ok(!caller.has(value), 'Caller alias'); assert.ok(!seen.has(value), 'Repeated result occurrence'); seen.add(value); Object.values(value).forEach(visit); }}; visit(result); }
const mixedSource = `/* Source0 notes: 곡면 🧭. Keep every UTF-16 span and comment. */
@model complete_original_model {
 version:0; length-unit:mm;
 /* This earlier Curve contains a similar literal. It is not the selected Surface. */
 @curve #context_curve { type:nurbs; degree:1; knots:[-0,-0,1,1]; control-points:[[+0.00,-0,0],[2,0,1]]; weights:[1,1]; }
 @surface #weighted_patch {
  type:nurbs; degree-u:2; degree-v:2;
  knots-u:[-3,-3,-3,7,7,7]; knots-v:[-2,-2,-2,6,6,6];
  control-points:[[[+0.00,-0,0],[0,5,1],[0,10,2]],[[5,0,1],[5,5,3],[5,10,4]],[[10,0,2],[10,5,4],[10,10,6]]];
  weights:[[1.000,2,1],[.5,1.5,2],[1,1,1]];
 }
 /* Unselected native Surface and degree-five Curve remain in this complete file. */
 @surface #context_plane { type:nurbs; degree-u:1; degree-v:1; knots-u:[-0,-0,1,1]; knots-v:[0,0,1,1]; control-points:[[[0,20,-0],[0,22,0]],[[2,20,0],[2,22,0]]]; weights:[[1,1],[1,1]]; }
 @curve #degree_five_sibling { type:nurbs; degree:5; knots:[0,0,0,0,0,0,1,1,1,1,1,1]; control-points:[[0,30,0],[1,30,1],[2,30,0],[3,30,-1],[4,30,0],[5,30,0]]; weights:[1,1,1,1,1,1]; }
}
/* Trailing file notes: 보존. */
`;
const request = (source, edits, surfaceId = 'weighted_patch') => ({source, sourceVersion: 0, surfaceId, edits: {poleEdits: edits}});
const primaryRequest = request(mixedSource, [{uIndex: 1, vIndex: 1, xMM: 6, yMM: 4, zMM: 8, weight: 2.25}, {uIndex: 0, vIndex: 0, xMM: -0}, {uIndex: 2, vIndex: 1, zMM: 9, weight: .75}]);
const close = (actual, expected, label) => assert.ok(Math.hypot(...actual.map((value, axis) => value - expected[axis])) <= 1e-7, label);
function choose(n, i) { if (i < 0 || i > n) return 0; let value = 1; for (let k = 1; k <= i; k++) value = value * (n - k + 1) / k; return value; }
const bernstein = (n, i, t) => i < 0 || i > n ? 0 : choose(n, i) * t ** i * (1 - t) ** (n - i);
function independentBezier(surface, u, v) {
  const p = surface.degreeU, q = surface.degreeV, spanU = surface.knotsU[p + 1] - surface.knotsU[p], spanV = surface.knotsV[q + 1] - surface.knotsV[q], tu = (u - surface.knotsU[p]) / spanU, tv = (v - surface.knotsV[q]) / spanV;
  const numerator = [0, 0, 0], nu = [0, 0, 0], nv = [0, 0, 0]; let denominator = 0, wu = 0, wv = 0;
  for (let i = 0; i <= p; i++) for (let j = 0; j <= q; j++) { const weight = surface.weights[i][j], basis = bernstein(p, i, tu) * bernstein(q, j, tv) * weight;
    const du = p * (bernstein(p - 1, i - 1, tu) - bernstein(p - 1, i, tu)) / spanU * bernstein(q, j, tv) * weight;
    const dv = bernstein(p, i, tu) * q * (bernstein(q - 1, j - 1, tv) - bernstein(q - 1, j, tv)) / spanV * weight;
    denominator += basis; wu += du; wv += dv; for (let axis = 0; axis < 3; axis++) { numerator[axis] += basis * surface.controlPoints[i][j][axis]; nu[axis] += du * surface.controlPoints[i][j][axis]; nv[axis] += dv * surface.controlPoints[i][j][axis]; }
  }
  return {point: numerator.map(value => value / denominator), du: nu.map((value, axis) => (value * denominator - numerator[axis] * wu) / denominator ** 2), dv: nv.map((value, axis) => (value * denominator - numerator[axis] * wv) / denominator ** 2)};
}
function selectedNode(compiled, id, u, v, field) { const declaration = compiled.ast.declarations.find(item => item.kind === 'surface' && item.id === id); assert.ok(declaration); const value = declaration.fields.find(item => item.name === (field === 'weight' ? 'weights' : 'control-points')).value; const pole = value.items[u].items[v]; const node = field === 'weight' ? pole : pole.items[{xMM: 0, yMM: 1, zMM: 2}[field]]; assert.equal(node.kind, 'number'); return node; }
function check(name, input) {
  const before = structuredClone(input), original = compileCadModel(input.source, {sourceVersion: 0}); assert.equal(original.ok, true, JSON.stringify(original.diagnostics));
  const objectIndex = original.model.objects.findIndex(item => item.id === input.surfaceId), selected = original.model.objects[objectIndex]; assert.equal(selected.kind, 'surface');
  const authored = jsonFile(name + '.authored-request', input), originalFile = sourceFile(name + '.complete-original', input.source, original.model), result = editSource(input); ownership([input], result); assert.deepEqual(input, before);
  assert.deepEqual(Object.keys(result).sort(), ['request', 'originalModel', 'model', 'source', 'edit', 'patches', 'report'].sort()); assert.deepEqual(result.request, input); assert.deepEqual(result.originalModel, original.model);
  const actualChild = editSurfaceControlNet(selected, input.edits); assert.deepEqual(result.edit, actualChild); assert.deepEqual(result.edit.original, selected);
  const expectedModel = structuredClone(original.model); expectedModel.objects[objectIndex] = actualChild.surface; assert.deepEqual(result.model, expectedModel);
  for (let i = 0; i < original.model.objects.length; i++) if (i !== objectIndex) assert.deepEqual(result.model.objects[i], original.model.objects[i]);
  const fields = result.edit.provenance.flatMap(pole => pole.changedFields.map(field => ({uIndex: pole.uIndex, vIndex: pole.vIndex, field}))); assert.equal(result.patches.length, fields.length);
  let cursor = 0, rebuilt = '', untouchedUTF16 = 0;
  for (const [index, patch] of result.patches.entries()) {
    assert.deepEqual(Object.keys(patch).sort(), ['uIndex', 'vIndex', 'field', 'startUTF16', 'endUTF16', 'originalText', 'replacementText'].sort());
    assert.ok(fields.some(field => field.uIndex === patch.uIndex && field.vIndex === patch.vIndex && field.field === patch.field));
    const node = selectedNode(original, input.surfaceId, patch.uIndex, patch.vIndex, patch.field); assert.equal(patch.startUTF16, node.range.start); assert.equal(patch.endUTF16, node.range.end);
    assert.ok(patch.startUTF16 >= cursor && patch.endUTF16 > patch.startUTF16); if (index) assert.ok(patch.startUTF16 > result.patches[index - 1].startUTF16);
    assert.equal(patch.originalText, input.source.slice(patch.startUTF16, patch.endUTF16)); assert.ok(Object.is(Number(patch.originalText), node.value));
    const changed = patch.field === 'weight' ? actualChild.surface.weights[patch.uIndex][patch.vIndex] : actualChild.surface.controlPoints[patch.uIndex][patch.vIndex][{xMM: 0, yMM: 1, zMM: 2}[patch.field]];
    assert.ok(Object.is(Number(patch.replacementText), changed)); assert.ok(!/[eE]/.test(patch.replacementText)); if (Object.is(changed, -0)) assert.equal(patch.replacementText, '-0');
    const untouched = input.source.slice(cursor, patch.startUTF16); rebuilt += untouched + patch.replacementText; untouchedUTF16 += untouched.length; cursor = patch.endUTF16;
  }
  rebuilt += input.source.slice(cursor); untouchedUTF16 += input.source.length - cursor; assert.equal(rebuilt, result.source);
  let descending = input.source; for (const patch of [...result.patches].reverse()) descending = descending.slice(0, patch.startUTF16) + patch.replacementText + descending.slice(patch.endUTF16); assert.equal(descending, result.source);
  const report = result.report; assert.equal(report.schema, 'barocss-source-surface-control-net-edit'); assert.equal(report.version, 0); assert.equal(report.sourceVersion, 0); assert.equal(report.modelVersion, 0); assert.equal(report.lengthUnit, 'mm'); assert.equal(report.modelName, original.model.name); assert.equal(report.surfaceId, input.surfaceId);
  assert.equal(report.selectedObjectIndex, objectIndex); assert.equal(report.objectCount, original.model.objects.length); assert.equal(report.requestedPoleCount, input.edits.poleEdits.length); assert.equal(report.requestedFieldCount, result.edit.provenance.reduce((sum, pole) => sum + pole.requestedFields.length, 0));
  assert.equal(report.changedPoleCount, actualChild.report.changedPoleCount); assert.equal(report.changedFieldCount, fields.length); assert.equal(report.patchCount, fields.length); assert.equal(report.noOp, fields.length === 0);
  assert.equal(report.originalSourceUTF16, input.source.length); assert.equal(report.candidateSourceUTF16, result.source.length); assert.equal(report.originalSourceUTF8, Buffer.byteLength(input.source, 'utf8')); assert.equal(report.candidateSourceUTF8, Buffer.byteLength(result.source, 'utf8'));
  assert.deepEqual(report.directCounts, {originalCompileCount: 1, candidateCompileCount: 1, nativeEditCount: 1}); assert.deepEqual(report.preservation, {untouchedSourceSpans: true, modelHeaderBits: true, objectOrderAndIds: true, unselectedObjectBits: true, selectedSurfaceEqualsActualChild: true});
  assert.equal(report.quality.geometricValidity, 'not-certified'); for (const field of ['topologyCertified', 'solid', 'globalBinary64ErrorCertified', 'manufacturingToleranceCertified', 'editorDisplayCertified']) assert.equal(report.quality[field], false);
  const nativeObservations = [];
  for (const observation of result.edit.report.observations) { assert.deepEqual(observation.beforePointMM, evaluateSurface(selected, observation.u, observation.v)); assert.deepEqual(observation.afterPointMM, evaluateSurface(actualChild.surface, observation.u, observation.v)); }
  for (const u of [selected.knotsU[selected.degreeU], (selected.knotsU[selected.degreeU] + selected.knotsU[selected.controlPoints.length]) / 2, selected.knotsU[selected.controlPoints.length]]) for (const v of [selected.knotsV[selected.degreeV], (selected.knotsV[selected.degreeV] + selected.knotsV[selected.controlPoints[0].length]) / 2, selected.knotsV[selected.controlPoints[0].length]]) {
    const native = [selected, actualChild.surface].map(surface => { const d0 = evaluateSurface(surface, u, v), d1 = evaluateSurfaceD1(surface, u, v), independent = independentBezier(surface, u, v); close(d0, independent.point); close(d1.point, independent.point); close(d1.du, independent.du); close(d1.dv, independent.dv); return {d0, d1, independent}; }); nativeObservations.push({u, v, before: native[0], after: native[1]});
  }
  jsonFile(name + '.independent-native-observations', nativeObservations); sourceFile(name + '.actual-child-selected-only', result.edit.source, result.edit.model);
  const candidateFile = sourceFile(name + '.complete-candidate', result.source, result.model), candidate = compileCadModel(readFileSync(candidateFile, 'utf8'), {sourceVersion: 0}); assert.equal(candidate.ok, true); assert.deepEqual(candidate.model, expectedModel);
  assert.deepEqual(validate(result), report); const owned = jsonFile(name + '.owned-edit', result); assert.deepEqual(editSource(authored.reopened), owned.reopened); assert.deepEqual(validate(owned.reopened), report);
  accepted.push({input, before, result, beforeResult: structuredClone(result)}); cases.push({name, originalFile, candidateFile, requestFile: authored.file, resultFile: owned.file, objectCount: original.model.objects.length, patchCount: fields.length, untouchedUTF16}); return result;
}
jsonFile('source-api.inputs', {entry, sourceInputs, cadInputs, sourceOnly: true, write: false, esbuildVersion: esbuild.version}); jsonFile('source-api.metafile', bundle.metafile);
const primary = check('mixed_weighted', primaryRequest); assert.equal(primary.patches.length, 7); assert.equal(primary.model.name, 'complete_original_model'); assert.equal(primary.model.objects[3].degree, 5);
assert.ok(primary.source.includes('곡면 🧭')); assert.ok(Object.is(primary.model.objects[0].controlPoints[0][0], 0)); assert.ok(Object.is(primary.model.objects[1].controlPoints[0][0][0], -0));
const noOp = check('no_op_original_spelling', request(mixedSource, [{uIndex: 0, vIndex: 0, xMM: 0, weight: 1}])); assert.equal(noOp.source, mixedSource); assert.deepEqual(noOp.patches, []); assert.ok(noOp.source.includes('+0.00')); assert.ok(noOp.source.includes('1.000'));
const signedZero = check('signed_zero_only', request(mixedSource, [{uIndex: 0, vIndex: 0, xMM: -0}])); assert.equal(signedZero.patches.length, 1); assert.equal(signedZero.patches[0].originalText, '+0.00'); assert.equal(signedZero.patches[0].replacementText, '-0');
const candidateColdSource = readFileSync(cases[0].candidateFile, 'utf8'); const reedit = check('cold_candidate_reedit', request(candidateColdSource, [{uIndex: 1, vIndex: 1, zMM: 10}])); assert.deepEqual(reedit.originalModel, primary.model); assert.equal(reedit.patches.length, 1);
const maximumSurface = {kind: 'surface', id: 'maximum_patch', degreeU: 3, degreeV: 3, knotsU: [0, 0, 0, 0, 1, 1, 1, 1], knotsV: [0, 0, 0, 0, 1, 1, 1, 1], controlPoints: Array.from({length: 4}, (_, u) => Array.from({length: 4}, (_, v) => [u, v, u + v])), weights: Array.from({length: 4}, () => [1, 1, 1, 1])};
function surfaceSource(surface, modelName = 'profile_fixture') { const list = values => '[' + values.map(value => Object.is(value, -0) ? '-0' : String(value)).join(',') + ']'; return '@model ' + modelName + ' {version:0;length-unit:mm;@surface #' + surface.id + ' {type:nurbs;degree-u:' + surface.degreeU + ';degree-v:' + surface.degreeV + ';knots-u:' + list(surface.knotsU) + ';knots-v:' + list(surface.knotsV) + ';control-points:[' + surface.controlPoints.map(row => '[' + row.map(list).join(',') + ']').join(',') + '];weights:[' + surface.weights.map(list).join(',') + '];}}\n'; }
const maximumEdits = Array.from({length: 16}, (_, i) => ({uIndex: Math.floor(i / 4), vIndex: i % 4, xMM: Math.floor(i / 4) + .25, yMM: i % 4 + .5, zMM: Math.floor(i / 4) + i % 4 + .75, weight: 1.5}));
const maximum = check('maximum_64_scalar_patches', request(surfaceSource(maximumSurface, 'maximum_mixed_name'), maximumEdits, maximumSurface.id)); assert.equal(maximum.patches.length, 64);
function intact() { for (const row of accepted) { assert.deepEqual(row.input, row.before); assert.deepEqual(row.result, row.beforeResult); } for (const [file, bytes] of files) assert.deepEqual(readFileSync(file), bytes, file); }
function reject(name, action, code, causeType = null) {
  assert.throws(action, error => { assert.ok(error instanceof EditError); assert.equal(error.code, code); assert.ok(error.message.length <= 1024);
    if (causeType === 'compiler') { assert.equal(error.cause.ok, false); assert.ok(Array.isArray(error.cause.diagnostics)); } if (causeType === 'native') assert.ok(error.cause instanceof Error);
    failures.push({name, code: error.code, message: error.message, causeMessage: error.cause?.message ?? null, compilerDiagnostics: error.cause?.ok === false ? error.cause.diagnostics : null}); intact(); return true; });
}
const compiledMixed = compileCadModel(mixedSource, {sourceVersion: 0}); assert.equal(compiledMixed.ok, true);
const selectedDeclaration = compiledMixed.ast.declarations.find(item => item.kind === 'surface' && item.id === 'weighted_patch'); assert.ok(selectedDeclaration);
const weightField = selectedDeclaration.fields.find(field => field.name === 'weights'), scalarNode = selectedNode(compiledMixed, 'weighted_patch', 0, 0, 'xMM');
const selectedBitSource = mixedSource.slice(0, scalarNode.range.start) + '-0' + mixedSource.slice(scalarNode.range.end), bitCompiled = compileCadModel(selectedBitSource, {sourceVersion: 0}); assert.equal(bitCompiled.ok, true);
const bitExpected = structuredClone(compiledMixed.model); bitExpected.objects[1].controlPoints[0][0][0] = -0; assert.deepEqual(bitCompiled.model, bitExpected);
assert.ok(Object.is(bitCompiled.model.objects[1].controlPoints[0][0][0], -0)); for (const index of [0, 2, 3]) assert.deepEqual(bitCompiled.model.objects[index], compiledMixed.model.objects[index]);
sourceFile('actual-selected-original-source-bit-edit', selectedBitSource, bitCompiled.model); jsonFile('selected-original-bit-binding', {surfaceId: 'weighted_patch', coordinate: [0, 0, 0], utf16Range: scalarNode.range, originalText: mixedSource.slice(scalarNode.range.start, scalarNode.range.end), replacementText: '-0', siblingsUnchanged: true});
const missingWeights = mixedSource.slice(0, weightField.range.start) + mixedSource.slice(weightField.range.end);
const duplicateWeights = mixedSource.slice(0, weightField.range.end) + mixedSource.slice(weightField.range.start, weightField.range.end) + mixedSource.slice(weightField.range.end);
const expressionSource0 = mixedSource.slice(0, scalarNode.range.start) + 'calc(1 + 2)' + mixedSource.slice(scalarNode.range.end);
reject('missing_selected_surface', () => editSource(request(mixedSource, [{uIndex: 0, vIndex: 0, zMM: 1}], 'missing_surface')), 'TARGET');
reject('wrong_selected_curve', () => editSource(request(mixedSource, [{uIndex: 0, vIndex: 0, zMM: 1}], 'degree_five_sibling')), 'TARGET');
reject('source2_expression_version', () => editSource({...request('@model expressions {version:2;length-unit:mm;}', [{uIndex: 0, vIndex: 0, zMM: 1}]), sourceVersion: 2}), 'VERSION');
reject('malformed_source', () => editSource(request('@model incomplete {version:0;', [{uIndex: 0, vIndex: 0, zMM: 1}])), 'SOURCE', 'compiler');
reject('actual_missing_weight_binding', () => editSource(request(missingWeights, [{uIndex: 0, vIndex: 0, zMM: 1}])), 'SOURCE', 'compiler');
reject('actual_duplicate_weight_binding', () => editSource(request(duplicateWeights, [{uIndex: 0, vIndex: 0, zMM: 1}])), 'SOURCE', 'compiler');
reject('source0_expression', () => editSource(request(expressionSource0, [{uIndex: 0, vIndex: 0, zMM: 1}])), 'SOURCE', 'compiler');
const degree4 = {kind: 'surface', id: 'degree4_selected', degreeU: 4, degreeV: 4, knotsU: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1], knotsV: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1], controlPoints: Array.from({length: 5}, (_, u) => Array.from({length: 5}, (_, v) => [u, v, u + v])), weights: Array.from({length: 5}, () => [1, 1, 1, 1, 1])};
const degree4Source = surfaceSource(degree4, 'degree4_original'); sourceFile('actual-native-degree4-original', degree4Source, {name: 'degree4_original', version: 0, lengthUnit: 'mm', objects: [degree4]});
reject('actual_child_selected_degree4', () => editSource(request(degree4Source, [{uIndex: 0, vIndex: 0, zMM: 1}], degree4.id)), 'NATIVE', 'native');
const large = structuredClone(compiledMixed.model.objects[1]); large.controlPoints[0][0][0] = 10001;
const largeSource = surfaceSource(large, 'large_selected_original'); sourceFile('actual-native-large-original', largeSource, {name: 'large_selected_original', version: 0, lengthUnit: 'mm', objects: [large]});
reject('actual_child_original_coordinate_profile', () => editSource(request(largeSource, [{uIndex: 0, vIndex: 0, zMM: 1}])), 'NATIVE', 'native');
reject('actual_child_changed_coordinate_profile', () => editSource(request(mixedSource, [{uIndex: 0, vIndex: 0, xMM: 10001}])), 'NATIVE', 'native');
reject('actual_child_zero_weight', () => editSource(request(mixedSource, [{uIndex: 1, vIndex: 1, weight: 0}])), 'NATIVE', 'native');
reject('actual_child_duplicate_pole_edits', () => editSource(request(mixedSource, [{uIndex: 1, vIndex: 1, zMM: 7}, {uIndex: 1, vIndex: 1, zMM: 8}])), 'NATIVE', 'native');
reject('actual_child_edit_count', () => editSource(request(surfaceSource(maximumSurface), [...maximumEdits, maximumEdits[0]], maximumSurface.id)), 'NATIVE', 'native');
const grownOriginal = mixedSource + '/*' + 'x'.repeat(262120 - Buffer.byteLength(mixedSource, 'utf8') - 4) + '*/'; assert.equal(Buffer.byteLength(grownOriginal, 'utf8'), 262120);
const growthRequest = request(grownOriginal, [{uIndex: 0, vIndex: 0, xMM: Number.MIN_VALUE}]); jsonFile('authored-source-growth-refusal', growthRequest);
reject('candidate_source_growth_budget', () => editSource(growthRequest), 'BUDGET');
reject('original_utf8_budget', () => editSource(request('/*' + '🧭'.repeat(65536) + '*/', [{uIndex: 0, vIndex: 0, xMM: 1}])), 'BUDGET');
reject('selected_id', () => editSource({...primaryRequest, surfaceId: 'bad.id'}), 'IDENTITY');
let getterCalls = 0; const getter = {...primaryRequest}; Object.defineProperty(getter, 'source', {enumerable: true, get() { getterCalls++; return mixedSource; }});
reject('source_getter', () => editSource(getter), 'INPUT'); const nestedGetter = request(mixedSource, [{uIndex: 0, vIndex: 0, xMM: 1}]); Object.defineProperty(nestedGetter.edits.poleEdits[0], 'xMM', {enumerable: true, get() { getterCalls++; return 1; }});
reject('edit_getter', () => editSource(nestedGetter), 'INPUT'); assert.equal(getterCalls, 0);
for (const [name, alter] of [
  ['range', value => { value.patches[0].startUTF16++; }], ['source', value => { value.source += ' '; }], ['original_source', value => { value.request.source = missingWeights; }], ['original_source_bits', value => { value.request.source = selectedBitSource; }],
  ['child', value => { value.edit.surface.controlPoints[1][1][2] += 1; }], ['sibling', value => { value.model.objects[3].controlPoints[1][2] += 1; }],
  ['counter', value => { value.report.directCounts.candidateCompileCount++; }], ['lexeme', value => { value.patches[0].originalText = '0'; }],
]) { const changed = structuredClone(primary); alter(changed); reject('owned_' + name, () => validate(changed), 'OWNED'); }
let replacement = primary; const previous = replacement; reject('atomic_prior_source_edit', () => { replacement = editSource(request(mixedSource, [{uIndex: 1, vIndex: 1, weight: 0}])); }, 'NATIVE', 'native'); assert.strictEqual(replacement, previous); jsonFile('atomic-retention', {priorResultUnchanged: replacement === previous, getterCalls});
const packageRoot = resolve(repo, 'packages/barocss-cad'), manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')), declared = manifest.publishConfig?.exports?.['.'] ?? manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types); assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath)); const publicAPI = await import(pathToFileURL(runtimePath).href);
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function'); assert.deepEqual(publicAPI.SourceSurfaceControlNetDiagnosticCode, SourceSurfaceControlNetDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./source-surface-control-net.js')); const leafDeclarationPath = resolve(packageRoot, 'dist/nurbs/source-wide/source-surface-control-net.d.ts'), declaration = readFileSync(leafDeclarationPath, 'utf8');
for (const name of [...runtimeNames, ...typeNames]) assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(declaration), name);
for (const row of cases) { const authored = JSON.parse(readFileSync(row.requestFile, 'utf8')), stored = JSON.parse(readFileSync(row.resultFile, 'utf8')), cold = publicAPI.compileCadModel(readFileSync(row.candidateFile, 'utf8'), {sourceVersion: 0}); assert.equal(cold.ok, true); assert.deepEqual(cold.model, stored.model); assert.deepEqual(publicAPI.editSourceSurfaceControlNet(authored), stored); assert.deepEqual(publicAPI.validateSourceSurfaceControlNetEdit(stored), stored.report); }
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 8, exportSelection: manifest.publishConfig?.exports?.['.'] ? 'publishConfig.exports root' : 'exports root'}; jsonFile('compiled-consumer', compiledConsumer);
const summary = {sourceMode: true, cases, failures, compiledConsumer, caseCount: cases.length, refusalCount: failures.length, getterCalls, maximumPatchCount: maximum.patches.length,
  scope: 'Literal scalar editing of one selected Surface in the whole original Source0. Actual native child and all sibling bits are retained. No global evaluator error, manufacturing, topology, Solid or editor display certificate.'};
jsonFile('summary', summary); intact(); console.log(JSON.stringify(summary));
