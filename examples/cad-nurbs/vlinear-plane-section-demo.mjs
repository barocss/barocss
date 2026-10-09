import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2); assert.equal(args.length, 2, 'Usage: node vlinear-plane-section-demo.mjs --source <output-directory>'); assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]); mkdirSync(output, {recursive: true});
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json')), esbuild = require('esbuild'), entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundle = await esbuild.build({absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true});
assert.equal(bundle.outputFiles.length, 1);
const sourceInputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path)), cadInputs = sourceInputs.filter(path => path.includes('/packages/barocss-cad/'));
for (const leaf of ['index.ts', 'vlinear-plane-section.ts', 'section-rational-internal.ts', 'rational-ruled-surface.ts']) assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/'))); assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const {buildVLinearSurfacePlaneSection: build, validateVLinearSurfacePlaneSection: validate, VLinearSurfacePlaneSectionError: SectionError, VLinearSurfacePlaneSectionDiagnosticCode,
  buildRationalRuledSurface, editCurveControlPolygon, reverseSurfaceAxis, compileCadModel, evaluateCurve, evaluateCurveD1, evaluateSurface, evaluateSurfaceD1} = api;
const runtimeNames = ['buildVLinearSurfacePlaneSection', 'validateVLinearSurfacePlaneSection', 'VLinearSurfacePlaneSectionError', 'VLinearSurfacePlaneSectionDiagnosticCode'];
const typeNames = ['VLinearSurfacePlaneSectionAsset', 'VLinearSurfacePlaneSectionOptions', 'VLinearSurfacePlaneSectionReport', 'VLinearSurfacePlaneSectionResult'];
for (const name of runtimeNames) assert.equal(typeof api[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(Object.keys(VLinearSurfacePlaneSectionDiagnosticCode).sort(), ['INPUT', 'IDENTITY', 'BUDGET', 'SOURCE', 'SUPPORT', 'CROSSING', 'CHART', 'REPRESENTABILITY', 'BINDING', 'NATIVE', 'OWNED'].sort());
const files = new Map(), retained = [], accepted = [], cases = [], failures = [], actualStatuses = [];
function nativeJSON(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || ['string', 'boolean'].includes(typeof value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}';
}
function jsonFile(name, value) { const file = resolve(output, name + '.json'); writeFileSync(file, nativeJSON(value) + '\n'); files.set(file, readFileSync(file)); const reopened = JSON.parse(readFileSync(file, 'utf8')); assert.deepEqual(reopened, value); return {file, reopened}; }
function sourceFile(name, source, model) { const file = resolve(output, name + '.source0.css'); writeFileSync(file, source); files.set(file, readFileSync(file)); const cold = compileCadModel(readFileSync(file, 'utf8'), {sourceVersion: 0}); assert.equal(cold.ok, true, JSON.stringify(cold.diagnostics)); assert.deepEqual(cold.model, model); return file; }
function decimal(value) {
  if (Object.is(value, -0)) return '-0'; const text = String(value); if (!/[eE]/.test(text)) return text;
  const [mantissa, exponentText] = text.split('e'), negative = mantissa.startsWith('-'), raw = negative ? mantissa.slice(1) : mantissa, [whole, fraction = ''] = raw.split('.');
  const digits = whole + fraction, place = whole.length + Number(exponentText), expanded = place <= 0 ? '0.' + '0'.repeat(-place) + digits : place >= digits.length ? digits + '0'.repeat(place - digits.length) : digits.slice(0, place) + '.' + digits.slice(place);
  return (negative ? '-' : '') + expanded;
}
function modelSource(model) {
  const list = values => '[' + values.map(decimal).join(',') + ']', poles = values => '[' + values.map(list).join(',') + ']';
  const object = item => item.kind === 'curve' ? '@curve #' + item.id + ' {type:nurbs;degree:' + item.degree + ';knots:' + list(item.knots) + ';control-points:' + poles(item.controlPoints) + ';weights:' + list(item.weights) + ';}' :
    '@surface #' + item.id + ' {type:nurbs;degree-u:' + item.degreeU + ';degree-v:' + item.degreeV + ';knots-u:' + list(item.knotsU) + ';knots-v:' + list(item.knotsV) + ';control-points:[' + item.controlPoints.map(poles).join(',') + '];weights:[' + item.weights.map(list).join(',') + '];}';
  return '@model ' + model.name + ' {version:0;length-unit:mm;' + model.objects.map(object).join('') + '}\n';
}
function asset(sourceId, model, surface, name = sourceId) { const source = modelSource(model); sourceFile(name + '.original', source, model); const value = {sourceId, source, surface}; retained.push({value, before: structuredClone(value)}); return value; }
function ownership(inputs, result) {
  const caller = new WeakSet(), seen = new WeakSet(); const collect = value => { if (value && typeof value === 'object' && !caller.has(value)) { caller.add(value); Object.values(value).forEach(collect); }}; inputs.forEach(collect);
  const visit = value => { if (value && typeof value === 'object') { assert.ok(!caller.has(value), 'Caller alias'); assert.ok(!seen.has(value), 'Repeated result occurrence'); seen.add(value); Object.values(value).forEach(visit); }}; visit(result);
}
const close = (actual, expected, label) => assert.ok(Math.hypot(...actual.map((value, i) => value - expected[i])) <= 1e-7, label);
const curve = (id, points, weights = [1, 1, 1], domain = [0, 1]) => ({kind: 'curve', id, degree: 2, knots: [domain[0], domain[0], domain[0], domain[1], domain[1], domain[1]], controlPoints: points, weights});
const plane = (id = 'section_plane') => ({kind: 'surface', id, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[[0, 2, 0], [0, 2, 20]], [[10, 4, 0], [10, 4, 20]]], weights: [[1, 1], [1, 1]]});
const options = name => ({evaluationId: name + '_evaluation', curveId: name + '_world', surfacePcurveId: name + '_surface_uv', planePcurveId: name + '_plane_uv', maximumObservations: 5});
const first = curve('section_first', [[0, 0, 10], [5, 0, 10], [10, 0, 10]]), second = curve('section_second', [[0, 10, 10], [5, 10, 10], [10, 10, 14]]);
const ruled = buildRationalRuledSurface(first, second, {surfaceId: 'ruled_patch'}); jsonFile('actual-630-ruled', ruled); sourceFile('actual-630-ruled', ruled.source, ruled.model);
const surfaceAsset = asset('ruled_source', ruled.model, ruled.surface), planeSurface = plane(), planeAsset = asset('plane_source', {name: 'plane_original', version: 0, lengthUnit: 'mm', objects: [planeSurface]}, planeSurface);

// Independent rational checks use exact integer arithmetic only to read published proof fractions and represented float values.
const gcd = (a, b) => { a = a < 0n ? -a : a; while (b) [a, b] = [b, a % b]; return a; };
const fraction = (n, d = 1n) => { assert.ok(d > 0n); const g = gcd(n, d); return [n / g, d / g]; };
function represented(value) { if (value === 0) return [0n, 1n]; const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value, false); const raw = view.getBigUint64(0, false), negative = raw >> 63n, exponent = Number((raw >> 52n) & 2047n), mantissa = (raw & ((1n << 52n) - 1n)) + (exponent ? 1n << 52n : 0n), power = exponent ? exponent - 1075 : -1074; return fraction((negative ? -mantissa : mantissa) * (power >= 0 ? 1n << BigInt(power) : 1n), power < 0 ? 1n << BigInt(-power) : 1n); }
const add = (a, b) => fraction(a[0] * b[1] + b[0] * a[1], a[1] * b[1]), multiply = (a, b) => fraction(a[0] * b[0], a[1] * b[1]);
const compare = (a, b) => a[0] * b[1] < b[0] * a[1] ? -1 : a[0] * b[1] > b[0] * a[1] ? 1 : 0;
const absolute = a => [a[0] < 0n ? -a[0] : a[0], a[1]], subtract = (a, b) => add(a, [-b[0], b[1]]), maximum = values => values.reduce((a, b) => compare(a, b) >= 0 ? a : b, [0n, 1n]);
const exportedFraction = a => ({numerator: a[0].toString(), denominator: a[1].toString()});
function published(value) { assert.deepEqual(Object.keys(value).sort(), ['numerator', 'denominator'].sort()); assert.match(value.numerator, /^-?(0|[1-9][0-9]*)$/); assert.match(value.denominator, /^[1-9][0-9]*$/); const result = fraction(BigInt(value.numerator), BigInt(value.denominator)); assert.equal(result[0].toString(), value.numerator); assert.equal(result[1].toString(), value.denominator); return result; }
function auditProof(value) {
  assert.notEqual(typeof value, 'bigint'); if (!value || typeof value !== 'object') return;
  if (Object.hasOwn(value, 'numerator') && Object.hasOwn(value, 'denominator')) published(value);
  if (Object.hasOwn(value, 'exact') && Object.hasOwn(value, 'upper')) {
    const exact = published(value.exact); assert.ok(exact[0] >= 0n); assert.ok(Number.isFinite(value.upper)); assert.ok(compare(represented(value.upper), exact) >= 0, 'Upward bound must not round below exact gap');
    if (exact[0] === 0n) assert.ok(Object.is(value.upper, 0)); else { assert.ok(value.upper > 0); const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value.upper, false); view.setBigUint64(0, view.getBigUint64(0, false) - 1n, false); assert.ok(compare(represented(view.getFloat64(0, false)), exact) < 0, 'Bound must be the least upward binary64 value'); }
  }
  Object.values(value).forEach(auditProof);
}
function check(name, input, support, settings, oracle = null) {
  const before = structuredClone({input, support, settings}), request = jsonFile(name + '.authored-request', {surfaceAsset: input, planeAsset: support, options: settings});
  const result = build(input, support, settings); ownership([input, support, settings], result); assert.deepEqual({input, support, settings}, before);
  assert.deepEqual(Object.keys(result).sort(), ['surfaceAsset', 'planeAsset', 'options', 'originalModels', 'world', 'pcurves', 'proof', 'observations', 'report'].sort());
  assert.deepEqual(result.surfaceAsset, input); assert.deepEqual(result.planeAsset, support); assert.deepEqual(result.options, settings);
  for (const [i, original] of [input, support].entries()) { const cold = compileCadModel(original.source, {sourceVersion: 0}); assert.equal(cold.ok, true); assert.deepEqual(result.originalModels[i], cold.model); assert.deepEqual(cold.model.objects.find(item => item.id === original.surface.id), original.surface); }
  assert.deepEqual(Object.keys(result.world).sort(), ['curve', 'source', 'sourceVersion', 'model'].sort()); assert.equal(result.world.sourceVersion, 0); assert.equal(result.world.curve.id, settings.curveId);
  sourceFile(name + '.actual-world', result.world.source, result.world.model); assert.deepEqual(result.world.model.objects, [result.world.curve]);
  for (const [kind, coordinateSystem, id] of [['surface', 'native-surface-uv', settings.surfacePcurveId], ['plane', 'native-plane-uv', settings.planePcurveId]]) {
    const sidecar = result.pcurves[kind]; assert.deepEqual(Object.keys(sidecar).sort(), ['coordinateSystem', 'lengthUnit', 'curve'].sort()); assert.equal(sidecar.coordinateSystem, coordinateSystem); assert.equal(sidecar.lengthUnit, 'dimensionless'); assert.equal(sidecar.curve.id, id);
    jsonFile(name + '.' + kind + '-uv.dimensionless-sidecar', sidecar);
  }
  assert.equal(result.world.curve.degree, 2 * input.surface.degreeU); assert.equal(result.pcurves.surface.curve.degree, input.surface.degreeU + 1); assert.equal(result.pcurves.plane.curve.degree, 2 * input.surface.degreeU);
  auditProof(result.proof); assert.equal(result.observations.length, 5);
  const report = result.report; assert.equal(report.schema, 'barocss-vlinear-surface-plane-section'); assert.equal(report.version, 0); assert.equal(report.evaluationId, settings.evaluationId);
  assert.equal(report.surfaceSourceId, input.sourceId); assert.equal(report.planeSourceId, support.sourceId); assert.equal(report.surfaceId, input.surface.id); assert.equal(report.planeId, support.surface.id); assert.equal(report.curveId, settings.curveId);
  assert.equal(report.lengthUnit, 'mm'); assert.equal(report.pcurveLengthUnit, 'dimensionless'); assert.equal(report.sourceFrame, 'authored-xyz-no-axis-conversion'); assert.equal(report.parameterFrame, 'original-native-u-v-domains');
  assert.deepEqual(report.wholeModelGapBounds, result.proof.bounds); assert.equal(report.inputUDegree, input.surface.degreeU); assert.equal(report.worldDegree, result.world.curve.degree); assert.equal(report.surfacePcurveDegree, result.pcurves.surface.curve.degree); assert.equal(report.planePcurveDegree, result.pcurves.plane.curve.degree);
  assert.deepEqual(report.directCounts, {sourceCompilationCount: 2, worldAdoptionCount: 1, planeHelperCount: 1, uvNativeValidationCount: 2, observationCount: 5, curvePointEvaluationCount: 15, curveDerivativeEvaluationCount: 15, surfacePointEvaluationCount: 10, surfaceDerivativeEvaluationCount: 10});
  for (const [field, limit] of [['operations', 200000], ['gcdSteps', 200000], ['maximumObservedBits', 8192]]) assert.ok(Number.isInteger(report.rationalCounts[field]) && report.rationalCounts[field] > 0 && report.rationalCounts[field] <= limit);
  assert.ok(report.rationalCounts.floatConversions > 0); assert.ok(report.rationalCounts.floatSearchSteps <= 64 * report.rationalCounts.floatConversions);
  assert.equal(report.quality.globalCoefficientModelGapCertified, true); assert.equal(report.quality.originalBitsPreserved, true); assert.equal(report.quality.geometricValidity, 'not-certified');
  for (const field of ['topologyCertified', 'solid', 'globalBinary64EvaluationErrorCertified', 'regularityCertified', 'embeddedManifoldCertified', 'manufacturingToleranceCertified']) assert.equal(report.quality[field], false);
  for (const field of ['worldCartesian', 'worldToSurface', 'worldToPlane']) assert.ok(compare(published(result.proof.bounds[field].exact), represented(1e-7)) <= 0);
  const domain = [input.surface.knotsU[input.surface.degreeU], input.surface.knotsU[input.surface.controlPoints.length]], independent = [];
  for (let slot = 0; slot < 5; slot++) {
    const parameter = domain[0] + (domain[1] - domain[0]) * slot / 4, worldD0 = evaluateCurve(result.world.curve, parameter), worldD1 = evaluateCurveD1(result.world.curve, parameter);
    const surfaceUV = evaluateCurve(result.pcurves.surface.curve, parameter), surfaceUVD1 = evaluateCurveD1(result.pcurves.surface.curve, parameter), planeUV = evaluateCurve(result.pcurves.plane.curve, parameter), planeUVD1 = evaluateCurveD1(result.pcurves.plane.curve, parameter);
    const surfaceD0 = evaluateSurface(input.surface, surfaceUV[0], surfaceUV[1]), surfaceD1 = evaluateSurfaceD1(input.surface, surfaceUV[0], surfaceUV[1]), planeD0 = evaluateSurface(support.surface, planeUV[0], planeUV[1]), planeD1 = evaluateSurfaceD1(support.surface, planeUV[0], planeUV[1]);
    close(worldD0, surfaceD0, 'Independent native Surface binding'); close(worldD0, planeD0, 'Independent finite Plane binding'); close(worldD0, worldD1.point); close(surfaceD0, surfaceD1.point); close(planeD0, planeD1.point);
    const chain = (native, uv) => native.du.map((value, axis) => value * uv.derivative[0] + native.dv[axis] * uv.derivative[1]), surfaceChain = chain(surfaceD1, surfaceUVD1), planeChain = chain(planeD1, planeUVD1);
    for (const derivative of [surfaceChain, planeChain]) assert.ok(Math.hypot(...derivative.map((value, axis) => value - worldD1.derivative[axis])) / Math.max(1, Math.hypot(...worldD1.derivative)) <= 1e-7);
    const observation = result.observations[slot]; assert.equal(observation.index, slot); assert.ok(Object.is(observation.parameter, parameter));
    assert.deepEqual(observation.world, {d0: worldD0, d1: worldD1}); assert.deepEqual(observation.surfacePcurve, {d0: surfaceUV, d1: surfaceUVD1}); assert.deepEqual(observation.planePcurve, {d0: planeUV, d1: planeUVD1});
    assert.deepEqual(observation.surface, {d0: surfaceD0, d1: surfaceD1}); assert.deepEqual(observation.plane, {d0: planeD0, d1: planeD1}); assert.deepEqual(observation.surfaceChain, surfaceChain); assert.deepEqual(observation.planeChain, planeChain);
    if (oracle) { close(worldD0, oracle.point(slot / 4)); close(worldD1.derivative, oracle.derivative(slot / 4, domain[1] - domain[0])); }
    independent.push({parameter, worldD0, worldD1, surfaceUV, surfaceUVD1, planeUV, planeUVD1, surfaceD0, surfaceD1, planeD0, planeD1});
  }
  jsonFile(name + '.independent-native-oracles', independent); assert.deepEqual(validate(result), result.report); const saved = jsonFile(name + '.owned-section', result);
  assert.deepEqual(build(request.reopened.surfaceAsset, request.reopened.planeAsset, request.reopened.options), saved.reopened); assert.deepEqual(validate(saved.reopened), result.report);
  accepted.push({input, support, settings, before, result, beforeResult: structuredClone(result)}); cases.push({name, requestFile: request.file, resultFile: saved.file, degrees: [result.world.curve.degree, result.pcurves.surface.curve.degree, result.pcurves.plane.curve.degree]}); return result;
}
jsonFile('source-api.inputs', {entry, sourceInputs, cadInputs, sourceOnly: true, write: false, esbuildVersion: esbuild.version}); jsonFile('source-api.metafile', bundle.metafile);
const oracle = factor => ({point: u => [10 * u, 2 + 2 * u, 10 + factor * (u * u + u * u * u)], derivative: (u, span) => [10 / span, 2 / span, factor * (2 * u + 3 * u * u) / span]});
const primary = check('polynomial', surfaceAsset, planeAsset, options('poly'), oracle(.8));
assert.equal(primary.report.polarity, -1); assert.deepEqual(primary.report.surfaceDomains, {u: [0, 1], v: [0, 1]}); assert.deepEqual(primary.report.planeDomains, {u: [0, 1], v: [0, 1]});
const expectedWorldPoles = [[0, 2, 10], [2.5, 2.5, 10], [5, 3, 152 / 15], [7.5, 3.5, 53 / 5], [10, 4, 58 / 5]];
assert.deepEqual(primary.world.curve.controlPoints, expectedWorldPoles); assert.deepEqual(primary.world.curve.weights, [24000, 24000, 24000, 24000, 24000]);
jsonFile('independent-Bernstein-oracle', {idealWorldPoles: expectedWorldPoles, pointFormula: '[10u,2+2u,10+(4/5)u^2+(4/5)u^3]', degrees: [4, 3, 4]});
const idealZ = [[10n, 1n], [10n, 1n], [152n, 15n], [53n, 5n], [58n, 5n]], expectedSurfaceUV = Array.from({length: 4}, (_, k) => [k / 3, (3 + k) / 15, 0]);
for (const [k, z] of idealZ.entries()) {
  const homogeneous = [[BigInt(60000 * k), 1n], [BigInt(48000 + 12000 * k), 1n], multiply(z, [24000n, 1n]), [24000n, 1n]];
  assert.deepEqual(primary.proof.world.poles[k].homogeneous.map(published), homogeneous); assert.deepEqual(primary.proof.world.coefficients[k].scaledHomogeneous.map(published), homogeneous);
  assert.deepEqual(primary.proof.world.coefficients[k].unscaledHomogeneous.map(published), homogeneous.map(value => multiply(value, [1n, 12n])));
  assert.deepEqual(primary.proof.world.poles[k].idealCartesian[2], exportedFraction(z));
}
const expectedPlaneUV = idealZ.map((value, k) => [k / 4, Number(value[0]) / Number(value[1] * 20n), 0]);
assert.deepEqual(primary.pcurves.surface.curve.controlPoints, expectedSurfaceUV); assert.deepEqual(primary.pcurves.surface.curve.weights, [6000, 6000, 6000, 6000]);
assert.deepEqual(primary.pcurves.plane.curve.controlPoints, expectedPlaneUV); assert.deepEqual(primary.pcurves.plane.curve.weights, primary.world.curve.weights);
const worldGap = maximum(idealZ.map((value, k) => absolute(subtract(represented(primary.world.curve.controlPoints[k][2]), value))));
const surfaceUError = maximum(expectedSurfaceUV.map((value, k) => absolute(subtract(represented(value[0]), fraction(BigInt(k), 3n)))));
const surfaceVError = maximum(expectedSurfaceUV.map((value, k) => absolute(subtract(represented(value[1]), fraction(BigInt(3 + k), 15n)))));
const planeUError = [0n, 1n], planeVError = maximum(expectedPlaneUV.map((value, k) => absolute(subtract(represented(value[1]), multiply(idealZ[k], [1n, 20n])))));
const expectedGaps = {world: worldGap, surface: add(worldGap, add(multiply([18n, 1n], surfaceUError), multiply([14n, 1n], surfaceVError))), plane: add(worldGap, multiply([20n, 1n], planeVError))};
const independentGapOracle = {world: exportedFraction(expectedGaps.world), surface: exportedFraction(expectedGaps.surface), plane: exportedFraction(expectedGaps.plane),
  surfaceCoordinateErrors: [exportedFraction(surfaceUError), exportedFraction(surfaceVError)], planeCoordinateErrors: [exportedFraction(planeUError), exportedFraction(planeVError)], nativeParameterLipschitzL1: {surface: [18, 14], plane: [12, 20]}};
for (const exact of Object.values(expectedGaps)) assert.ok(compare(exact, represented(1e-7)) <= 0); jsonFile('independent-global-model-gap-oracle', independentGapOracle);
for (const [field, exact] of [['worldCartesian', worldGap], ['surfaceU', surfaceUError], ['surfaceV', surfaceVError], ['planeU', planeUError], ['planeV', planeVError], ['worldToSurface', expectedGaps.surface], ['worldToPlane', expectedGaps.plane]]) assert.deepEqual(published(primary.proof.bounds[field].exact), exact);
for (const [field, value] of [['surfaceU', 18], ['surfaceV', 14], ['planeU', 12], ['planeV', 20]]) { assert.deepEqual(published(primary.proof.lipschitz[field].exact), [BigInt(value), 1n]); assert.ok(Object.is(primary.proof.lipschitz[field].upper, value)); }
const rational = buildRationalRuledSurface({...first, weights: [.5, .5, .5]}, second, {surfaceId: 'rational_patch'}); jsonFile('actual-rational-630', rational); sourceFile('actual-rational-630', rational.source, rational.model);
check('rational_dyadic', asset('rational_source', rational.model, rational.surface), planeAsset, options('rational'), oracle(.8));
const nonunitModel = structuredClone(ruled.model), nonunitSurface = nonunitModel.objects.find(item => item.kind === 'surface');
for (const item of nonunitModel.objects) { if (item.kind === 'curve') item.knots = [-3, -3, -3, 7, 7, 7]; else { item.knotsU = [-3, -3, -3, 7, 7, 7]; item.knotsV = [-2, -2, 6, 6]; }}
const nonunitPlane = plane('ruled_patch'); nonunitPlane.knotsU = [-5, -5, 5, 5]; nonunitPlane.knotsV = [2, 2, 6, 6];
check('nonunit_qualified_duplicate_id', asset('nonunit_source', nonunitModel, nonunitSurface), asset('nonunit_plane_source', {name: 'nonunit_plane', version: 0, lengthUnit: 'mm', objects: [nonunitPlane]}, nonunitPlane), options('nonunit'), oracle(.8));
const edit = editCurveControlPolygon(second, {poleEdits: [{index: 2, zMM: 18}]}); jsonFile('actual-section-edit', edit); sourceFile('actual-section-edit', edit.source, edit.model);
const editedRuled = buildRationalRuledSurface(first, edit.curve, {surfaceId: 'edited_patch'}); jsonFile('actual-edited-630', editedRuled); sourceFile('actual-edited-630', editedRuled.source, editedRuled.model);
const edited = check('edited', asset('edited_source', editedRuled.model, editedRuled.surface), planeAsset, options('edited'), oracle(1.6)); assert.notDeepEqual(edited.world.curve.controlPoints, primary.world.curve.controlPoints);
const reversed = reverseSurfaceAxis(planeSurface, {axis: 'u', surfaceId: 'reversed_plane', resultIdPrefix: 'plrev'}); jsonFile('actual-plane-reversal', reversed); sourceFile('actual-plane-reversal', reversed.source, reversed.model);
const oppositePolarity = check('opposite_plane_polarity', surfaceAsset, asset('reversed_plane_source', reversed.model, reversed.surface), options('polarity'), oracle(.8)); assert.equal(oppositePolarity.report.polarity, 1);
function intact() { for (const row of retained) assert.deepEqual(row.value, row.before); for (const row of accepted) { assert.deepEqual({input: row.input, support: row.support, settings: row.settings}, row.before); assert.deepEqual(row.result, row.beforeResult); } for (const [file, bytes] of files) assert.deepEqual(readFileSync(file), bytes, file); }
function reject(name, action, code, causeRequired = false) {
  assert.throws(action, error => { assert.ok(error instanceof SectionError); assert.equal(error.code, code); assert.ok(error.message.length <= 1024); if (causeRequired) assert.ok(error.cause);
    if (name === 'actual_source_compiler_failure') { assert.equal(error.cause.ok, false); assert.ok(Array.isArray(error.cause.diagnostics)); } if (name === 'actual_plane_helper_condition_failure') assert.ok(error.cause instanceof Error);
    failures.push({name, code: error.code, message: error.message, causeCode: error.cause?.code ?? null, causeMessage: error.cause?.message ?? null, compilerFailed: error.cause?.ok === false}); intact(); return true; });
}
function derivedAsset(name, original, mutate) { const model = structuredClone(compileCadModel(original.source, {sourceVersion: 0}).model), selected = model.objects.find(item => item.id === original.surface.id); mutate(selected); return asset(name + '_source', model, selected, name); }
const partial = derivedAsset('partial', surfaceAsset, value => { value.controlPoints[2][0][1] = 8; });
const tangent = derivedAsset('tangent', surfaceAsset, value => { value.controlPoints[0][0][1] = 2; });
const coincident = derivedAsset('coincident', surfaceAsset, value => { value.controlPoints = value.controlPoints.map((row, i) => row.map(point => [point[0], 2 + i, point[2]])); });
const outsidePlane = derivedAsset('outside_plane', planeAsset, value => { value.controlPoints[0][1][2] = 5; value.controlPoints[1][1][2] = 5; });
const nonAffine = derivedAsset('nonaffine', planeAsset, value => { value.controlPoints[1][1][2] = 19; });
const unequalPlane = derivedAsset('unequal_plane', planeAsset, value => { value.weights[1][1] = 2; });
const unsafePlane = derivedAsset('unsafe_plane', planeAsset, value => { value.controlPoints = [[[0, 2, 0], [10, 4, 1e-8]], [[10, 4, 0], [20, 6, 1e-8]]]; });
const v2 = derivedAsset('v2', surfaceAsset, value => { value.degreeV = 2; value.knotsV = [0, 0, 0, 1, 1, 1]; value.controlPoints = value.controlPoints.map(row => [row[0], row[0].map((number, i) => (number + row[1][i]) / 2), row[1]]); value.weights = value.weights.map(() => [1, 1, 1]); });
reject('partial_v_crossing', () => build(partial, planeAsset, options('partial')), 'CROSSING');
reject('tangent_column', () => build(tangent, planeAsset, options('tangent')), 'CROSSING');
reject('coincident_columns', () => build(coincident, planeAsset, options('coincident')), 'CROSSING');
reject('finite_plane_hull_outside', () => build(surfaceAsset, outsidePlane, options('outside')), 'CHART');
reject('nonaffine_plane', () => build(surfaceAsset, nonAffine, options('nonaffine')), 'SUPPORT');
reject('unequal_plane_weights', () => build(surfaceAsset, unequalPlane, options('unequal')), 'SUPPORT');
reject('actual_plane_helper_condition_failure', () => build(surfaceAsset, unsafePlane, options('unsafe')), 'NATIVE', true);
reject('v2_scope', () => build(v2, planeAsset, options('v2')), 'SUPPORT');
const nonexactRuled = buildRationalRuledSurface({...first, weights: [.1, .1, .1]}, {...second, weights: [.3, .3, .3]}, {surfaceId: 'nonexact_patch'});
sourceFile('actual-nonexact-630', nonexactRuled.source, nonexactRuled.model); jsonFile('actual-nonexact-630', nonexactRuled);
const nonexactAsset = asset('nonexact_source', nonexactRuled.model, nonexactRuled.surface);
reject('nonexact_derived_weights', () => build(nonexactAsset, planeAsset, options('nonexact')), 'REPRESENTABILITY');
reject('observation_budget', () => build(surfaceAsset, planeAsset, {...options('budget'), maximumObservations: 4}), 'BUDGET');
reject('original_id_collision', () => build(surfaceAsset, planeAsset, {...options('identity'), curveId: first.id}), 'IDENTITY');
reject('missing_field', () => build({sourceId: surfaceAsset.sourceId, surface: surfaceAsset.surface}, planeAsset, options('missing')), 'INPUT');
const bitOriginal = compileCadModel(surfaceAsset.source, {sourceVersion: 0}); assert.equal(bitOriginal.ok, true);
const selectedDeclaration = bitOriginal.ast.declarations.find(item => item.kind === 'surface' && item.id === surfaceAsset.surface.id); assert.ok(selectedDeclaration);
const selectedControlPoints = selectedDeclaration.fields.find(field => field.name === 'control-points').value;
const selectedCoordinate = selectedControlPoints.items[0].items[0].items[0]; assert.equal(selectedCoordinate.kind, 'number'); assert.ok(Object.is(selectedCoordinate.value, 0));
const {start: bitStart, end: bitEnd} = selectedCoordinate.range; assert.equal(surfaceAsset.source.slice(bitStart, bitEnd), '0');
const bitSource = surfaceAsset.source.slice(0, bitStart) + '-0' + surfaceAsset.source.slice(bitEnd); assert.notEqual(bitSource, surfaceAsset.source);
const bitCompiled = compileCadModel(bitSource, {sourceVersion: 0}); assert.equal(bitCompiled.ok, true);
const bitExpected = structuredClone(bitOriginal.model), bitExpectedSurface = bitExpected.objects.find(item => item.kind === 'surface' && item.id === surfaceAsset.surface.id); bitExpectedSurface.controlPoints[0][0][0] = -0;
assert.deepEqual(bitCompiled.model, bitExpected); assert.ok(Object.is(bitCompiled.model.objects.find(item => item.id === surfaceAsset.surface.id).controlPoints[0][0][0], -0));
for (const parent of bitOriginal.model.objects.filter(item => item.kind === 'curve')) assert.deepEqual(bitCompiled.model.objects.find(item => item.id === parent.id), parent);
sourceFile('actual-selected-surface-bit-edit', bitSource, bitCompiled.model); jsonFile('selected-surface-bit-edit-binding', {surfaceId: surfaceAsset.surface.id, coordinate: [0, 0, 0], utf16Range: selectedCoordinate.range, originalLiteral: '0', replacementLiteral: '-0', curveParentsUnchanged: true});
reject('selected_source_bits_mismatch', () => build({...surfaceAsset, source: bitSource}, planeAsset, options('bits')), 'SOURCE');
reject('actual_source_compiler_failure', () => build({...surfaceAsset, source: '@model broken { version:0;'}, planeAsset, options('source')), 'SOURCE', true);
let getterCalls = 0; const getterOptions = options('getter'); Object.defineProperty(getterOptions, 'maximumObservations', {enumerable: true, get() { getterCalls++; return 5; }});
reject('options_getter', () => build(surfaceAsset, planeAsset, getterOptions), 'INPUT');
const nested = structuredClone(surfaceAsset); Object.defineProperty(nested.surface, 'weights', {enumerable: true, get() { getterCalls++; return []; }});
reject('surface_getter', () => build(nested, planeAsset, options('nested')), 'INPUT'); assert.equal(getterCalls, 0);

// These are public full-geometry cases. Record a genuine admission refusal if an existing native gate cannot evaluate the tiny strip.
function floatCase(name, endpoints, expectedMiddle) {
  const strip = {kind: 'surface', id: name + '_strip', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: endpoints.map(x => [[x, 0, 0], [x, 1, 0]]), weights: [[1, 1], [1, 1]]};
  const support = {kind: 'surface', id: name + '_plane', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[[-1, .5, -1], [-1, .5, 1]], [[2, .5, -1], [2, .5, 1]]], weights: [[1, 1], [1, 1]]};
  const a = asset(name + '_source', {name: name + '_model', version: 0, lengthUnit: 'mm', objects: [strip]}, strip), b = asset(name + '_support', {name: name + '_plane_model', version: 0, lengthUnit: 'mm', objects: [support]}, support);
  let result; try { result = build(a, b, options(name)); } catch (error) { assert.ok(error instanceof SectionError); actualStatuses.push({name, status: 'actual-admission-refused', code: error.code, message: error.message, causeCode: error.cause?.code ?? null, causeMessage: error.cause?.message ?? null}); intact(); return; }
  const verified = check(name, a, b, options(name)); assert.deepEqual(result, verified); assert.ok(Object.is(result.world.curve.controlPoints[1][0], expectedMiddle));
  const idealMiddle = multiply(add(represented(endpoints[0]), represented(endpoints[1])), [1n, 2n]);
  const stored = represented(expectedMiddle), error = fraction(idealMiddle[0] * stored[1] - stored[0] * idealMiddle[1], idealMiddle[1] * stored[1]); assert.ok(error[0] > 0n);
  assert.deepEqual(published(result.proof.bounds.worldCartesian.exact), error); if (expectedMiddle === 0) assert.ok(Object.is(result.proof.bounds.worldCartesian.upper, Number.MIN_VALUE));
  jsonFile(name + '.independent-exact-midpoint', {ideal: {numerator: idealMiddle[0].toString(), denominator: idealMiddle[1].toString()}, storedMiddleX: expectedMiddle, exactPositiveGap: {numerator: error[0].toString(), denominator: error[1].toString()}});
  actualStatuses.push({name, status: 'evaluated', middleX: expectedMiddle, proof: result.proof.bounds});
}
floatCase('nearest_even_tie', [1, 1 + Number.EPSILON], 1); floatCase('subnormal_bound', [0, Number.MIN_VALUE], 0);

for (const [name, alter] of [
  ['world_pole', result => { result.world.curve.controlPoints[2][2] += .01; }],
  ['uv_units', result => { result.pcurves.surface.lengthUnit = 'mm'; }],
  ['native_observation', result => { result.observations[0] = result.observations[1]; }],
  ['source_bits', result => { result.surfaceAsset.source = bitSource; }],
  ['counter', result => { result.report.directCounts.observationCount++; }],
]) { const changed = structuredClone(primary); alter(changed); reject('owned_' + name, () => validate(changed), 'OWNED'); }
function firstFraction(value) { if (!value || typeof value !== 'object') return null; if (Object.hasOwn(value, 'numerator')) return value; for (const child of Object.values(value)) { const found = firstFraction(child); if (found) return found; } return null; }
const corruptedProof = structuredClone(primary); const proofFraction = firstFraction(corruptedProof.proof); assert.ok(proofFraction); proofFraction.numerator = (BigInt(proofFraction.numerator) + 1n).toString(); reject('owned_exact_fraction', () => validate(corruptedProof), 'OWNED');
const corruptedBound = structuredClone(primary); function firstBound(value) { if (!value || typeof value !== 'object') return null; if (Object.hasOwn(value, 'upper') && Object.hasOwn(value, 'exact')) return value; for (const child of Object.values(value)) { const found = firstBound(child); if (found) return found; } return null; }
const bound = firstBound(corruptedBound.proof); assert.ok(bound); bound.upper += 1; reject('owned_upward_bound', () => validate(corruptedBound), 'OWNED');
let replacement = primary; const previous = replacement; reject('atomic_previous_section', () => { replacement = build(surfaceAsset, outsidePlane, options('atomic')); }, 'CHART'); assert.strictEqual(replacement, previous); jsonFile('atomic-retention', {priorResultUnchanged: replacement === previous, getterCalls});

const packageRoot = resolve(repo, 'packages/barocss-cad'), manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.publishConfig?.exports?.['.'] ?? manifest.exports['.'], runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath)); const publicAPI = await import(pathToFileURL(runtimePath).href);
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function'); assert.deepEqual(publicAPI.VLinearSurfacePlaneSectionDiagnosticCode, VLinearSurfacePlaneSectionDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./vlinear-plane-section.js')); const leafDeclarationPath = resolve(packageRoot, 'dist/vlinear-plane-section.d.ts'), declaration = readFileSync(leafDeclarationPath, 'utf8');
for (const name of [...runtimeNames, ...typeNames]) assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(declaration), name);
for (const row of cases) { const request = JSON.parse(readFileSync(row.requestFile, 'utf8')), stored = JSON.parse(readFileSync(row.resultFile, 'utf8')); assert.deepEqual(publicAPI.buildVLinearSurfacePlaneSection(request.surfaceAsset, request.planeAsset, request.options), stored); assert.deepEqual(publicAPI.validateVLinearSurfacePlaneSection(stored), stored.report); }
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 8, exportSelection: manifest.publishConfig?.exports?.['.'] ? 'publishConfig.exports root' : 'exports root'};
jsonFile('compiled-consumer', compiledConsumer); const summary = {sourceMode: true, cases, failures, actualStatuses, compiledConsumer, caseCount: cases.length, refusalCount: failures.length, getterCalls,
  scope: 'Whole coefficient-defined model-gap proof and separate native local observations. No global binary64 evaluator error, regularity, embedding, trimming, Boolean, topology, adaptive rendering or Solid certificate.'};
jsonFile('summary', summary); intact(); console.log(JSON.stringify(summary));
