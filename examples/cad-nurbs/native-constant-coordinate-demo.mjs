import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {basename, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
const args = process.argv.slice(2); assert.equal(args.length, 2, 'Usage: node native-constant-coordinate-demo.mjs --output <output-directory>'); assert.equal(args[0], '--output');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]); mkdirSync(output, {recursive: true});
const evidence = '/Users/user/.barocss-ai/v3/evidence-native-constant-coordinate-cad2', parentHead = '662e8486154667fe98bb796839bb8bb331c990ea';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex'), immutableBytes = new Map(), files = new Map(), retained = [];
function pinned(path, expectedHash) { const bytes = readFileSync(path); assert.equal(sha256(bytes), expectedHash, path); immutableBytes.set(path, bytes); return bytes; }
const sourcePins = JSON.parse(readFileSync(resolve(evidence, 'source-pins.json'), 'utf8'));
for (const pin of sourcePins) pinned(pin.path, pin.sha256);
const runtimeClosure = JSON.parse(readFileSync(resolve(evidence, 'parent-runtime-closure.json'), 'utf8')); assert.equal(runtimeClosure.head, parentHead); assert.equal(runtimeClosure.files.length, 342);
for (const row of runtimeClosure.files) pinned(resolve(evidence, 'parent-emitted', basename(row.path)), row.sha256);
const parentRuntimePath = resolve(evidence, 'parent-emitted/index.js'), oldAPI = await import(pathToFileURL(parentRuntimePath).href);
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json')), esbuild = require('esbuild'), entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundle = await esbuild.build({absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true}); assert.equal(bundle.outputFiles.length, 1);
const sourceInputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path)), cadInputs = sourceInputs.filter(path => path.includes('/packages/barocss-cad/'));
for (const leaf of ['index.ts', 'math.ts', 'derivatives.ts', 'second-derivatives.ts', 'multispan-vlinear-plane-section.ts', 'multispan-vlinear-plane-trim.ts']) assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/'))); assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const sourceAPI = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const runtimeNames = ['evaluateCurve', 'evaluateSurface', 'evaluateCurveD1', 'evaluateSurfaceD1', 'sampleCurve', 'sampleSurface', 'evaluateCurveD2', 'evaluateSurfaceD2', 'compileCadModel', 'buildMultiSpanVLinearSurfacePlaneSection', 'validateMultiSpanVLinearSurfacePlaneSection', 'buildMultiSpanVLinearSurfacePlaneTrimCandidates', 'validateMultiSpanVLinearSurfacePlaneTrimCandidates'];
for (const name of runtimeNames) { assert.equal(typeof oldAPI[name], 'function', name); assert.equal(typeof sourceAPI[name], 'function', name); }
function nativeJSON(value) { if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); } if (value === null || ['string', 'boolean'].includes(typeof value)) return JSON.stringify(value); if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']'; return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}'; }
function jsonFile(name, value) { const file = resolve(output, name + '.json'); const text = nativeJSON(value) + '\n'; assert.ok(text.length <= 1048576 && Buffer.byteLength(text, 'utf8') <= 1048576, name + ' file size'); writeFileSync(file, text); files.set(file, readFileSync(file)); const reopened = JSON.parse(readFileSync(file, 'utf8')); assert.deepEqual(reopened, value); return {file, reopened}; }
function sourceFile(name, source, model) { const file = resolve(output, name + '.source0.css'); assert.ok(source.length <= 1048576 && Buffer.byteLength(source, 'utf8') <= 1048576, name + ' source size'); writeFileSync(file, source); files.set(file, readFileSync(file)); const cold = sourceAPI.compileCadModel(readFileSync(file, 'utf8'), {sourceVersion: 0}); assert.equal(cold.ok, true, JSON.stringify(cold.diagnostics)); assert.deepEqual(cold.model, model); return file; }
function ownership(inputs, result) { const caller = new WeakSet(), seen = new WeakSet(); const collect = value => { if (value && typeof value === 'object' && !caller.has(value)) { caller.add(value); Object.values(value).forEach(collect); }}; inputs.forEach(collect); const visit = value => { if (value && typeof value === 'object') { assert.ok(!caller.has(value), 'Caller alias'); assert.ok(!seen.has(value), 'Repeated result occurrence'); seen.add(value); Object.values(value).forEach(visit); }}; visit(result); }
function decimal(value) { if (Object.is(value, -0)) return '-0'; const text = String(value); if (!text.includes('e')) return text; const [mantissa, exponentText] = text.split('e'), negative = mantissa.startsWith('-'), raw = negative ? mantissa.slice(1) : mantissa, [whole, fraction = ''] = raw.split('.'), digits = whole + fraction, place = whole.length + Number(exponentText), expanded = place <= 0 ? '0.' + '0'.repeat(-place) + digits : place >= digits.length ? digits + '0'.repeat(place - digits.length) : digits.slice(0, place) + '.' + digits.slice(place); return (negative ? '-' : '') + expanded; }
function modelSource(model) { const list = values => '[' + values.map(decimal).join(',') + ']', poles = points => '[' + points.map(list).join(',') + ']'; const object = item => item.kind === 'curve' ? '@curve #' + item.id + ' {type:nurbs;degree:' + item.degree + ';knots:' + list(item.knots) + ';control-points:' + poles(item.controlPoints) + ';weights:' + list(item.weights) + ';}' : '@surface #' + item.id + ' {type:nurbs;degree-u:' + item.degreeU + ';degree-v:' + item.degreeV + ';knots-u:' + list(item.knotsU) + ';knots-v:' + list(item.knotsV) + ';control-points:[' + item.controlPoints.map(poles).join(',') + '];weights:[' + item.weights.map(list).join(',') + '];}'; return '@model ' + model.name + ' {version:0;length-unit:mm;' + model.objects.map(object).join('') + '}\n'; }

jsonFile('source-api.inputs', {entry, sourceInputs, cadInputs, sourceOnly: true, write: false, esbuildVersion: esbuild.version}); jsonFile('source-api.metafile', bundle.metafile);
jsonFile('immutable-source-runtime-pins', {parentHead, parentRuntimePath, sourcePins, emittedFileCount: runtimeClosure.files.length, allHashesChecked: true});
function samePointAxes(actual, previous, axes) { for (const axis of axes) assert.ok(Object.is(actual[axis], previous[axis]), 'Unchanged axis' + axis); }
function exactConstant(actual, expected) { assert.ok(Object.is(actual, expected), 'Original constant coordinate bits'); }
function positiveZero(actual) { assert.ok(Object.is(actual, 0), 'Generated exact derivative must be positive zero'); }
function adjacent(value) { const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value, false); view.setBigUint64(0, view.getBigUint64(0, false) + 1n, false); return view.getFloat64(0, false); }
const curveFixture = (id, constant) => ({kind: 'curve', id, degree: 1, knots: [-3, -3, 9, 9], controlPoints: [[0, constant, 1], [10, constant, 3]], weights: [1, 3]});
const surfaceFixture = (id, constant) => ({kind: 'surface', id, degreeU: 1, degreeV: 1, knotsU: [-3, -3, 9, 9], knotsV: [-2, -2, 6, 6], controlPoints: [[[0, constant, 0], [1, constant, 2]], [[10, constant, 3], [11, constant, 6]]], weights: [[1, 3], [2, .5]]});
const constants = [{name: 'positive_six', value: 6}, {name: 'negative_six', value: -6}, {name: 'positive_zero', value: 0}, {name: 'negative_zero', value: -0}, {name: 'positive_subnormal', value: Number.MIN_VALUE}, {name: 'negative_subnormal', value: -Number.MIN_VALUE}];
const authoredFixtures = constants.map(({name, value}) => {
  const curve = curveFixture('curve_' + name, value), surface = surfaceFixture('surface_' + name, value), model = {name: 'model_' + name, version: 0, lengthUnit: 'mm', objects: [curve, surface]}, source = modelSource(model);
  const file = sourceFile('authored.' + name, source, model), saved = jsonFile('authored.' + name, {constant: value, curve, surface, source, model}); retained.push({value: model, before: structuredClone(model)});
  return {name, value, curve, surface, source, model, sourceFile: file, requestFile: saved.file};
});
function constantComparisons(label, api) {
  const records = [];
  for (const fixture of authoredFixtures) {
    const {name, value, curve, surface} = fixture, before = structuredClone({curve, surface}), curveRows = [], surfaceRows = [];
    const cold = api.compileCadModel(readFileSync(fixture.sourceFile, 'utf8'), {sourceVersion: 0}); assert.equal(cold.ok, true); assert.deepEqual(cold.model, fixture.model);
    for (const parameter of [-3, -1, .25, 5, 9]) {
      const oldD0 = oldAPI.evaluateCurve(curve, parameter), oldD1 = oldAPI.evaluateCurveD1(curve, parameter), d0 = api.evaluateCurve(curve, parameter), d1 = api.evaluateCurveD1(curve, parameter);
      exactConstant(d0[1], value); exactConstant(d1.point[1], value); positiveZero(d1.derivative[1]);
      samePointAxes(d0, oldD0, [0, 2]); samePointAxes(d1.point, oldD1.point, [0, 2]); samePointAxes(d1.derivative, oldD1.derivative, [0, 2]);
      curveRows.push({parameter, oldD0, oldD1, d0, d1});
    }
    for (const [u, v] of [[-3, -2], [-1, 0], [.25, 1], [5, 3], [9, 6]]) {
      const oldD0 = oldAPI.evaluateSurface(surface, u, v), oldD1 = oldAPI.evaluateSurfaceD1(surface, u, v), d0 = api.evaluateSurface(surface, u, v), d1 = api.evaluateSurfaceD1(surface, u, v);
      exactConstant(d0[1], value); exactConstant(d1.point[1], value); positiveZero(d1.du[1]); positiveZero(d1.dv[1]);
      samePointAxes(d0, oldD0, [0, 2]); samePointAxes(d1.point, oldD1.point, [0, 2]); samePointAxes(d1.du, oldD1.du, [0, 2]); samePointAxes(d1.dv, oldD1.dv, [0, 2]);
      surfaceRows.push({u, v, oldD0, oldD1, d0, d1});
    }
    const curveSamples = api.sampleCurve(curve, 7), oldCurveSamples = oldAPI.sampleCurve(curve, 7), surfaceSamples = api.sampleSurface(surface, 4, 4), oldSurfaceSamples = oldAPI.sampleSurface(surface, 4, 4);
    for (const [index, row] of curveSamples.entries()) { exactConstant(row.point[1], value); assert.ok(Object.is(row.parameter, oldCurveSamples[index].parameter)); samePointAxes(row.point, oldCurveSamples[index].point, [0, 2]); assert.deepEqual(row.point, api.evaluateCurve(curve, row.parameter)); }
    for (const [i, row] of surfaceSamples.entries()) for (const [j, sample] of row.entries()) { exactConstant(sample.point[1], value); assert.ok(Object.is(sample.u, oldSurfaceSamples[i][j].u) && Object.is(sample.v, oldSurfaceSamples[i][j].v)); samePointAxes(sample.point, oldSurfaceSamples[i][j].point, [0, 2]); assert.deepEqual(sample.point, api.evaluateSurface(surface, sample.u, sample.v)); }
    assert.deepEqual({curve, surface}, before); records.push({name, constant: value, curveRows, surfaceRows, curveSamples, surfaceSamples});
  }
  jsonFile(label + '.constant-coordinate-comparisons', records); return records;
}
const exclusions = [];
function exclusion(name, curve, surface, curveParameters = [-3, -1, .25, 5, 9], surfaceParameters = [[-3, -2], [-1, 0], [.25, 1], [5, 3], [9, 6]]) { const model = {name: 'excluded_' + name.replaceAll('-', '_'), version: 0, lengthUnit: 'mm', objects: [curve, surface]}, source = modelSource(model), sourcePath = sourceFile('authored.excluded.' + name, source, model); jsonFile('authored.excluded.' + name, {curve, surface, source, model}); exclusions.push({name, curve, surface, curveParameters, surfaceParameters, model, sourcePath}); }
const nearbyCurve = curveFixture('nearby_curve', 6), nearbySurface = surfaceFixture('nearby_surface', 6); nearbyCurve.controlPoints[1][1] = adjacent(6); nearbySurface.controlPoints[1][1][1] = adjacent(6); exclusion('nearby-coordinate-no-tolerance', nearbyCurve, nearbySurface);
const mixedCurve = curveFixture('mixed_zero_curve', -0), mixedSurface = surfaceFixture('mixed_zero_surface', -0); mixedCurve.controlPoints[1][1] = 0; mixedSurface.controlPoints[1][1][1] = 0; exclusion('mixed-signed-zero-no-folding', mixedCurve, mixedSurface);
const localCurve = {kind: 'curve', id: 'local_only_curve', degree: 1, knots: [0, 0, 1, 2, 2], controlPoints: [[0, 6, 1], [1, 6, 3], [2, 7, 5]], weights: [1, 3, 2]};
const localSurface = {kind: 'surface', id: 'local_only_surface', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 2, 2], knotsV: [-2, -2, 6, 6], controlPoints: [[[0, 6, 0], [1, 6, 2]], [[10, 6, 3], [11, 6, 6]], [[20, 7, 6], [21, 7, 10]]], weights: [[1, 3], [2, .5], [4, 2]]};
exclusion('local-active-span-is-not-global', localCurve, localSurface, [0, .25, .75, 1.25, 2], [[0, -2], [.25, 0], [.75, 1], [1.25, 3], [2, 6]]);
function excludedComparisons(label, api) {
  const records = exclusions.map(({name, curve, surface, curveParameters, surfaceParameters, model, sourcePath}) => {
    const cold = api.compileCadModel(readFileSync(sourcePath, 'utf8'), {sourceVersion: 0}); assert.equal(cold.ok, true); assert.deepEqual(cold.model, model);
    const before = structuredClone({curve, surface}), curves = curveParameters.map(parameter => { const oldD0 = oldAPI.evaluateCurve(curve, parameter), oldD1 = oldAPI.evaluateCurveD1(curve, parameter), d0 = api.evaluateCurve(curve, parameter), d1 = api.evaluateCurveD1(curve, parameter); assert.deepEqual(d0, oldD0); assert.deepEqual(d1, oldD1); return {parameter, oldD0, oldD1, d0, d1}; });
    const surfaces = surfaceParameters.map(([u, v]) => { const oldD0 = oldAPI.evaluateSurface(surface, u, v), oldD1 = oldAPI.evaluateSurfaceD1(surface, u, v), d0 = api.evaluateSurface(surface, u, v), d1 = api.evaluateSurfaceD1(surface, u, v); assert.deepEqual(d0, oldD0); assert.deepEqual(d1, oldD1); return {u, v, oldD0, oldD1, d0, d1}; }); assert.deepEqual({curve, surface}, before); return {name, curves, surfaces};
  }); jsonFile(label + '.excluded-axis-bit-comparisons', records); return records;
}
function errorData(error) { return {name: error.name, code: error.code ?? null, message: error.message, causeName: error.cause?.name ?? null, causeCode: error.cause?.code ?? null, causeMessage: error.cause?.message ?? null}; }
function refused(action) { let observed; assert.throws(action, error => { assert.ok(error instanceof Error); observed = errorData(error); return true; }); return observed; }
const archivedRequest = JSON.parse(readFileSync(sourcePins[0].path, 'utf8')), archivedWitness = JSON.parse(readFileSync(sourcePins[1].path, 'utf8')), archivedDiagnostic = JSON.parse(readFileSync(sourcePins[2].path, 'utf8')), oldOwned = JSON.parse(readFileSync(sourcePins[3].path, 'utf8'));
assert.deepEqual(archivedRequest.surfaceAsset.surface.knotsU, [-3, -3, -3, -1, -1, 2, 2, 5, 5, 9, 9, 9]); assert.deepEqual(archivedRequest.surfaceAsset.surface.knotsV, [-2, -2, 6, 6]);
assert.deepEqual(archivedWitness.actualUV, [7, 6.000000000000001, 0]); assert.equal(archivedWitness.parameter, -1);
const c0Curve = {...localCurve, id: 'global_constant_c0_curve', controlPoints: localCurve.controlPoints.map(point => [point[0], 6, point[2]])}, c0Surface = {...localSurface, id: 'global_constant_c0_surface', controlPoints: localSurface.controlPoints.map(row => row.map(point => [point[0], 6, point[2]]))};
const underflowCurve = {kind: 'curve', id: 'underflow_denominator_curve', degree: 1, knots: [-1e308, -1e308, 0, 1e-300, 1e-300], controlPoints: [[6, 6, 6], [6, 6, 6], [6, 6, 6]], weights: [1, 1, 1]};
const underflowSurface = {kind: 'surface', id: 'underflow_denominator_surface', degreeU: 1, degreeV: 1, knotsU: underflowCurve.knots, knotsV: [0, 0, 1, 1], controlPoints: Array.from({length: 3}, () => [[6, 6, 6], [6, 6, 6]]), weights: Array.from({length: 3}, () => [1, 1])};
const finiteGuardCurve = {kind: 'curve', id: 'finite_guard_curve', degree: 1, knots: [0, 0, 1e-300, 1e-300], controlPoints: [[1e6, 1e6, 1e6], [1e6, 1e6, 1e6]], weights: [1e6, 1]};
const guards = [
  {name: 'curve-c0-d1', method: 'evaluateCurveD1', arguments: [c0Curve, 1]}, {name: 'surface-c0-d1', method: 'evaluateSurfaceD1', arguments: [c0Surface, 1, 0]},
  {name: 'curve-invalid-weight-d0', method: 'evaluateCurve', arguments: [{...curveFixture('bad_weight_curve', 6), weights: [1, 0]}, -1]}, {name: 'curve-invalid-weight-d1', method: 'evaluateCurveD1', arguments: [{...curveFixture('bad_weight_curve_d1', 6), weights: [1, 0]}, -1]},
  {name: 'surface-invalid-weight-d0', method: 'evaluateSurface', arguments: [{...surfaceFixture('bad_weight_surface', 6), weights: [[1, 0], [1, 1]]}, -1, 0]}, {name: 'surface-invalid-weight-d1', method: 'evaluateSurfaceD1', arguments: [{...surfaceFixture('bad_weight_surface_d1', 6), weights: [[1, 0], [1, 1]]}, -1, 0]},
  {name: 'curve-outside-domain-d0', method: 'evaluateCurve', arguments: [curveFixture('outside_curve', 6), 10]}, {name: 'curve-outside-domain-d1', method: 'evaluateCurveD1', arguments: [curveFixture('outside_curve_d1', 6), 10]},
  {name: 'surface-direct-caller-v-outside-d0', method: 'evaluateSurface', arguments: [archivedRequest.surfaceAsset.surface, 7, 6.000000000000001]}, {name: 'surface-direct-caller-v-outside-d1', method: 'evaluateSurfaceD1', arguments: [archivedRequest.surfaceAsset.surface, 7, 6.000000000000001]},
  {name: 'curve-nan-parameter', method: 'evaluateCurve', arguments: [curveFixture('nan_curve', 6), Number.NaN]},
  {name: 'curve-degenerate-domain', method: 'evaluateCurve', arguments: [{...curveFixture('degenerate_curve', 6), knots: [0, 0, 0, 0]}, 0]},
  {name: 'curve-denominator-underflow', method: 'evaluateCurve', arguments: [underflowCurve, 5e-301]}, {name: 'surface-denominator-underflow', method: 'evaluateSurface', arguments: [underflowSurface, 5e-301, .5]},
  {name: 'curve-d1-distance-underflow', method: 'evaluateCurveD1', arguments: [underflowCurve, 5e-301]}, {name: 'curve-d1-finite-arithmetic-before-override', method: 'evaluateCurveD1', arguments: [finiteGuardCurve, 5e-301]},
];
function guardComparisons(label, api) {
  const records = guards.map(row => { const previous = refused(() => oldAPI[row.method](...row.arguments)), current = refused(() => api[row.method](...row.arguments)); assert.deepEqual(current, previous); return {name: row.name, method: row.method, previous, current}; });
  assert.match(records.find(row => row.name === 'curve-denominator-underflow').current.message, /denominator must be positive and finite/);
  assert.match(records.find(row => row.name === 'curve-d1-finite-arithmetic-before-override').current.message, /Derivative arithmetic exceeded the finite range/);
  jsonFile(label + '.unchanged-native-refusals', records); return records;
}
function originalFailedUVComparisons(label, api) {
  const uvCurve = archivedWitness.nominalUVSidecar, before = structuredClone(uvCurve), rows = archivedDiagnostic.results.map(row => {
    const previous = oldAPI.evaluateCurve(uvCurve, row.parameter), previousD1 = oldAPI.evaluateCurveD1(uvCurve, row.parameter), current = api.evaluateCurve(uvCurve, row.parameter), currentD1 = api.evaluateCurveD1(uvCurve, row.parameter);
    assert.deepEqual(previous, row.uv); exactConstant(current[1], 6); exactConstant(current[2], 0); exactConstant(currentD1.point[1], 6); exactConstant(currentD1.point[2], 0); positiveZero(currentD1.derivative[1]); positiveZero(currentD1.derivative[2]);
    samePointAxes(current, previous, [0]); samePointAxes(currentD1.point, previousD1.point, [0]); samePointAxes(currentD1.derivative, previousD1.derivative, [0]);
    const supportPoint = api.evaluateSurface(archivedRequest.surfaceAsset.surface, current[0], current[1]); return {parameter: row.parameter, previous, previousD1, current, currentD1, supportPoint};
  }); assert.deepEqual(uvCurve, before); assert.deepEqual(rows.find(row => row.parameter === -1).previous, [7, 6.000000000000001, 0]); assert.deepEqual(rows.find(row => row.parameter === -1).current, [7, 6, 0]);
  jsonFile(label + '.original-v6-coordinates', {originalDomains: archivedWitness.originalDomains, unchangedNominalUVSidecar: uvCurve, rows, sourceOrKnotEditsPerformed: false, domainExpansionPerformed: false}); return rows;
}
function rebuild(label, api, sectionRequest, trimOptions) {
  const before = structuredClone({sectionRequest, trimOptions}), request = jsonFile(label + '.original-source-request', {sectionRequest, trimOptions});
  const section = api.buildMultiSpanVLinearSurfacePlaneSection(sectionRequest.surfaceAsset, sectionRequest.planeAsset, sectionRequest.options), trim = api.buildMultiSpanVLinearSurfacePlaneTrimCandidates(section, trimOptions);
  ownership([sectionRequest, trimOptions, section], trim); assert.deepEqual(section.surfaceAsset, sectionRequest.surfaceAsset); assert.deepEqual(section.planeAsset, sectionRequest.planeAsset); assert.deepEqual(trim.section, section);
  assert.deepEqual(api.validateMultiSpanVLinearSurfacePlaneSection(section), section.report); assert.deepEqual(api.validateMultiSpanVLinearSurfacePlaneTrimCandidates(trim), trim.report);
  for (const [i, original] of [sectionRequest.surfaceAsset, sectionRequest.planeAsset].entries()) { const saved = sourceFile(label + '.original-' + i, original.source, section.originalModels[i]), cold = api.compileCadModel(readFileSync(saved, 'utf8'), {sourceVersion: 0}); assert.equal(cold.ok, true); assert.deepEqual(cold.model, section.originalModels[i]); assert.deepEqual(cold.model.objects.find(item => item.id === original.surface.id), original.surface); }
  sourceFile(label + '.actual-section-world', section.world.source, section.world.model); const worldFile = sourceFile(label + '.actual-trim-world', trim.world.source, trim.world.model);
  jsonFile(label + '.section', section); const saved = jsonFile(label + '.owned-trim', trim); for (const edge of trim.edges) jsonFile(label + '.' + edge.role + '.dimensionless-uv', edge.pcurve);
  const coldWorld = api.compileCadModel(readFileSync(worldFile, 'utf8'), {sourceVersion: 0}); assert.equal(coldWorld.ok, true); assert.deepEqual(coldWorld.model, trim.world.model);
  const freshSection = api.buildMultiSpanVLinearSurfacePlaneSection(request.reopened.sectionRequest.surfaceAsset, request.reopened.sectionRequest.planeAsset, request.reopened.sectionRequest.options), freshTrim = api.buildMultiSpanVLinearSurfacePlaneTrimCandidates(freshSection, request.reopened.trimOptions);
  assert.deepEqual(freshTrim, saved.reopened); assert.deepEqual(api.validateMultiSpanVLinearSurfacePlaneTrimCandidates(saved.reopened), trim.report); assert.deepEqual({sectionRequest, trimOptions}, before); retained.push({value: trim, before: structuredClone(trim)}); return {requestFile: request.file, worldFile, trimFile: saved.file, trim};
}
function secondDerivativeDisclosure(label, api) {
  const fixture = authoredFixtures[0], before = structuredClone(fixture.model);
  const observe = action => { try { return {status: 'evaluated', value: action()}; } catch (error) { assert.ok(error instanceof Error); return {status: 'native-refused', error: errorData(error)}; } };
  const curve = observe(() => api.evaluateCurveD2(fixture.curve, -1)), oldCurve = observe(() => oldAPI.evaluateCurveD2(fixture.curve, -1)), surface = observe(() => api.evaluateSurfaceD2(fixture.surface, -1, 0)), oldSurface = observe(() => oldAPI.evaluateSurfaceD2(fixture.surface, -1, 0));
  if (curve.status === 'evaluated') { const first = api.evaluateCurveD1(fixture.curve, -1); assert.deepEqual(curve.value.point, first.point); assert.deepEqual(curve.value.derivative, first.derivative); }
  if (surface.status === 'evaluated') { const first = api.evaluateSurfaceD1(fixture.surface, -1, 0); assert.deepEqual(surface.value.point, first.point); assert.deepEqual(surface.value.du, first.du); assert.deepEqual(surface.value.dv, first.dv); }
  assert.deepEqual(fixture.model, before); const result = {oldCurve, curve, oldSurface, surface, secondDerivativeAlgorithmEdited: false, inheritedD1OutputEffectsOnly: true, exactSecondDerivativeGuarantee: false, unchangedSecondDerivativeNumericsClaimed: false}; jsonFile(label + '.d2-inherited-effects-disclosure', result); return result;
}
const sourceConstants = constantComparisons('source', sourceAPI), sourceExclusions = excludedComparisons('source', sourceAPI), sourceGuards = guardComparisons('source', sourceAPI), sourceUV = originalFailedUVComparisons('source', sourceAPI), sourceD2 = secondDerivativeDisclosure('source', sourceAPI);
const originalTrimOptions = {evaluationId: 'shifted_trim', resultIdPrefix: 'shifted', maximumBoundaries: 4, maximumIntervals: 4, maximumObservations: 63};
const sourceRebuild = rebuild('source.original-v6', sourceAPI, archivedRequest, originalTrimOptions); assert.deepEqual(sourceRebuild.trim.section.report.surfaceDomains, {u: [-3, 9], v: [-2, 6]});
const oldOwnedBefore = structuredClone(oldOwned); let oldOwnedReplay;
try { const report = sourceAPI.validateMultiSpanVLinearSurfacePlaneTrimCandidates(oldOwned); assert.deepEqual(report, oldOwned.report); oldOwnedReplay = {status: 'accepted', archivedFile: sourcePins[3].path, report}; }
catch (error) { assert.ok(error instanceof sourceAPI.MultiSpanVLinearSurfacePlaneTrimError); assert.equal(error.code, 'OWNED'); oldOwnedReplay = {status: 'native-refused', archivedFile: sourcePins[3].path, error: errorData(error), regenerationRequiredForThisSnapshot: true}; }
assert.deepEqual(oldOwned, oldOwnedBefore); jsonFile('old-owned-trim-replay.actual-outcome', oldOwnedReplay);
let regeneratedOld = null;
if (oldOwnedReplay.status === 'native-refused') {
  const request = {surfaceAsset: oldOwned.section.surfaceAsset, planeAsset: oldOwned.section.planeAsset, options: oldOwned.section.options}; regeneratedOld = rebuild('source.old-owned-regenerated', sourceAPI, request, oldOwned.options);
  assert.deepEqual(regeneratedOld.trim.section.originalModels, oldOwned.section.originalModels); assert.deepEqual(regeneratedOld.trim.section.proof, oldOwned.section.proof);
  jsonFile('old-owned-trim-regeneration.receipt', {archivedFile: sourcePins[3].path, newRequestFile: regeneratedOld.requestFile, newTrimFile: regeneratedOld.trimFile, originalSourcesBitsPreserved: true, originalExactCoefficientProofPreserved: true, archivedObservationFileRewritten: false});
}
const packageRoot = resolve(repo, 'packages/barocss-cad'), manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')), declared = manifest.publishConfig?.exports?.['.'] ?? manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types); assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath)); const publicAPI = await import(pathToFileURL(runtimePath).href);
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], 'function', name);
const indexDeclarations = readFileSync(declarationPath, 'utf8'); for (const name of ['math', 'derivatives', 'second-derivatives']) assert.ok(indexDeclarations.includes('./' + name + '.js'));
for (const [file, names] of [['math.d.ts', ['evaluateCurve', 'evaluateSurface', 'sampleCurve', 'sampleSurface']], ['derivatives.d.ts', ['evaluateCurveD1', 'evaluateSurfaceD1']], ['second-derivatives.d.ts', ['evaluateCurveD2', 'evaluateSurfaceD2']]]) { const text = readFileSync(resolve(packageRoot, 'dist', file), 'utf8'); for (const name of names) assert.ok(text.includes('function ' + name + '('), name); }
assert.deepEqual(constantComparisons('public', publicAPI), sourceConstants); assert.deepEqual(excludedComparisons('public', publicAPI), sourceExclusions); assert.deepEqual(guardComparisons('public', publicAPI), sourceGuards); assert.deepEqual(originalFailedUVComparisons('public', publicAPI), sourceUV); assert.deepEqual(secondDerivativeDisclosure('public', publicAPI), sourceD2);
const publicRebuild = rebuild('public.original-v6', publicAPI, archivedRequest, originalTrimOptions); assert.deepEqual(publicRebuild.trim, sourceRebuild.trim);
if (regeneratedOld) { const request = {surfaceAsset: oldOwned.section.surfaceAsset, planeAsset: oldOwned.section.planeAsset, options: oldOwned.section.options}; const publicRegenerated = rebuild('public.old-owned-regenerated', publicAPI, request, oldOwned.options); assert.deepEqual(publicRegenerated.trim, regeneratedOld.trim); }
for (const [path, bytes] of immutableBytes) assert.deepEqual(readFileSync(path), bytes, 'Historical artifact changed: ' + path);
for (const [path, bytes] of files) assert.deepEqual(readFileSync(path), bytes, 'Accepted new artifact changed: ' + path); for (const row of retained) assert.deepEqual(row.value, row.before);
const summary = {parentHead, parentRuntimePath, runtimePath, declarationPath, runtimeNames, sourceMode: true, constantFamilyCount: constants.length, excludedFamilyCount: exclusions.length, nativeGuardCountPerRuntime: guards.length, originalFailedParameterCount: archivedDiagnostic.results.length, originalDomain: sourceRebuild.trim.section.report.surfaceDomains, sourceRebuild: {requestFile: sourceRebuild.requestFile, trimFile: sourceRebuild.trimFile, worldFile: sourceRebuild.worldFile}, oldOwnedReplay, regeneratedOld: regeneratedOld ? {requestFile: regeneratedOld.requestFile, trimFile: regeneratedOld.trimFile} : null, originalSourceHashesPreserved: true, oldEmittedClosurePreserved: true, namedConsumerScope: {checkedHistoricalSnapshot: 'One pinned #1212 nonuniform trim only', loader1213OriginalSectionOwnedFiles: {count: 14, acceptance: 'unrun'}, plannedLoader1222ActualConsumerOperations: 'unrun', archivedConsumerFilesStrippedNormalizedOrRegenerated: false, sourceRebuildDoesNotEstablishTheirAcceptance: true}, scope: 'D0/D1 global original Object.is constant coordinates only after unchanged native admission, accumulation, projection and legacy quotient arithmetic. All tested nonconstant/mixed-zero/local-only axes remain bit-identical to the pinned parent. D2 implementation is unchanged; dependent values may change. No D2/global accuracy, regularity, manufacturing, Boolean, consumer or publication certificate.'};
jsonFile('summary', summary); console.log(JSON.stringify(summary));
