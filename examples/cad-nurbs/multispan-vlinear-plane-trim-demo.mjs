import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
const args = process.argv.slice(2); assert.equal(args.length, 2, 'Usage: node multispan-vlinear-plane-trim-demo.mjs --source <output-directory>'); assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]); mkdirSync(output, {recursive: true});
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json')), esbuild = require('esbuild'), entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundle = await esbuild.build({absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true}); assert.equal(bundle.outputFiles.length, 1);
const sourceInputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path)), cadInputs = sourceInputs.filter(path => path.includes('/packages/barocss-cad/'));
for (const leaf of ['index.ts', 'multispan-vlinear-plane-trim.ts', 'multispan-vlinear-plane-section.ts', 'curve-interval-extraction.ts', 'source-surface-control-net.ts']) assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/'))); assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const {buildMultiSpanVLinearSurfacePlaneTrimCandidates: build, validateMultiSpanVLinearSurfacePlaneTrimCandidates: validate, MultiSpanVLinearSurfacePlaneTrimError: TrimError, MultiSpanVLinearSurfacePlaneTrimDiagnosticCode,
  buildMultiSpanVLinearSurfacePlaneSection: buildSection, MultiSpanVLinearSurfacePlaneSectionError: SectionError, reverseSurfaceAxis, editSourceSurfaceControlNet,
  extractSurfaceBoundary, extractCurveInterval, validateExtractedCurveInterval, CurveIntervalExtractionError, reverseCurve, CurveReversalError, compileCadModel, evaluateCurve, evaluateCurveD1, evaluateSurface, evaluateSurfaceD1} = api;
const runtimeNames = ['buildMultiSpanVLinearSurfacePlaneTrimCandidates', 'validateMultiSpanVLinearSurfacePlaneTrimCandidates', 'MultiSpanVLinearSurfacePlaneTrimError', 'MultiSpanVLinearSurfacePlaneTrimDiagnosticCode'];
const typeNames = ['MultiSpanVLinearSurfacePlaneTrimOptions', 'MultiSpanVLinearSurfacePlaneTrimReport', 'MultiSpanVLinearSurfacePlaneTrimResult', 'MultiSpanVLinearSurfacePlaneTrimEdge'];
for (const name of runtimeNames) assert.equal(typeof api[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(Object.keys(MultiSpanVLinearSurfacePlaneTrimDiagnosticCode).sort(), ['INPUT', 'IDENTITY', 'BUDGET', 'SECTION', 'UV', 'INTERVAL', 'REPRESENTABILITY', 'BINDING', 'NATIVE', 'OWNED'].sort());
const files = new Map(), retained = [], accepted = [], cases = [], failures = [];
function nativeJSON(value) { if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); } if (value === null || ['string', 'boolean'].includes(typeof value)) return JSON.stringify(value); if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']'; return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}'; }
function jsonFile(name, value) { const file = resolve(output, name + '.json'); const text = nativeJSON(value) + '\n'; assert.ok(text.length <= 1048576 && Buffer.byteLength(text, 'utf8') <= 1048576, name + ' file size'); writeFileSync(file, text); files.set(file, readFileSync(file)); const reopened = JSON.parse(readFileSync(file, 'utf8')); assert.deepEqual(reopened, value); return {file, reopened}; }
function sourceFile(name, source, model) { const file = resolve(output, name + '.source0.css'); assert.ok(source.length <= 1048576 && Buffer.byteLength(source, 'utf8') <= 1048576, name + ' source size'); writeFileSync(file, source); files.set(file, readFileSync(file)); const cold = compileCadModel(readFileSync(file, 'utf8'), {sourceVersion: 0}); assert.equal(cold.ok, true, JSON.stringify(cold.diagnostics)); assert.deepEqual(cold.model, model); return file; }
function ownership(inputs, result) { const caller = new WeakSet(), seen = new WeakSet(); const collect = value => { if (value && typeof value === 'object' && !caller.has(value)) { caller.add(value); Object.values(value).forEach(collect); }}; inputs.forEach(collect); const visit = value => { if (value && typeof value === 'object') { assert.ok(!caller.has(value), 'Caller alias'); assert.ok(!seen.has(value), 'Repeated result occurrence'); seen.add(value); Object.values(value).forEach(visit); }}; visit(result); }
function decimal(value) { if (Object.is(value, -0)) return '-0'; const text = String(value); if (!text.includes('e')) return text; const [mantissa, exponentText] = text.split('e'), negative = mantissa.startsWith('-'), raw = negative ? mantissa.slice(1) : mantissa, [whole, fraction = ''] = raw.split('.'), digits = whole + fraction, place = whole.length + Number(exponentText), expanded = place <= 0 ? '0.' + '0'.repeat(-place) + digits : place >= digits.length ? digits + '0'.repeat(place - digits.length) : digits.slice(0, place) + '.' + digits.slice(place); return (negative ? '-' : '') + expanded; }
function modelSource(model) { const list = values => '[' + values.map(decimal).join(',') + ']', poles = points => '[' + points.map(list).join(',') + ']'; const object = item => item.kind === 'curve' ? '@curve #' + item.id + ' {type:nurbs;degree:' + item.degree + ';knots:' + list(item.knots) + ';control-points:' + poles(item.controlPoints) + ';weights:' + list(item.weights) + ';}' : '@surface #' + item.id + ' {type:nurbs;degree-u:' + item.degreeU + ';degree-v:' + item.degreeV + ';knots-u:' + list(item.knotsU) + ';knots-v:' + list(item.knotsV) + ';control-points:[' + item.controlPoints.map(poles).join(',') + '];weights:[' + item.weights.map(list).join(',') + '];}'; return '@model ' + model.name + ' {version:0;length-unit:mm;' + model.objects.map(object).join('') + '}\n'; }
function asset(sourceId, model, surface, name = sourceId) { const source = modelSource(model); sourceFile(name + '.original-whole', source, model); const result = {sourceId, source, surface}; retained.push({value: result, before: structuredClone(result)}); return result; }
const sectionOptions = name => ({evaluationId: name + '_section', curveId: name + '_cut', surfacePcurveId: name + '_cut_surface_uv', planePcurveId: name + '_cut_plane_uv', maximumObservations: 17});
const settings = name => ({evaluationId: name + '_trim', resultIdPrefix: name, maximumBoundaries: 4, maximumIntervals: 4, maximumObservations: 63});
function section(name, surface, support) {
  const options = sectionOptions(name), request = jsonFile(name + '.authored-section-request', {surfaceAsset: surface, planeAsset: support, options}), value = buildSection(surface, support, options);
  assert.deepEqual(value.surfaceAsset, surface); assert.deepEqual(value.planeAsset, support);
  sourceFile(name + '.actual-cut', value.world.source, value.world.model); jsonFile(name + '.actual-section', value);
  assert.deepEqual(buildSection(request.reopened.surfaceAsset, request.reopened.planeAsset, request.reopened.options), value);
  retained.push({value, before: structuredClone(value)}); return value;
}
function warpedSurface(id, breaks = [0, 1, 2, 3, 4], vDomain = [0, 1]) {
  const rows = [[[0, 0, 0], [0, 1, 8]]];
  for (let a = 0; a < breaks.length - 1; a++) rows.push([[10 * a + 5, 2 * a * a + 2 * a, 0], [10 * a + 5, 1 + 3 * a * a + 3 * a, 8]], [[10 * (a + 1), 2 * (a + 1) ** 2, 0], [10 * (a + 1), 1 + 3 * (a + 1) ** 2, 8]]);
  return {kind: 'surface', id, degreeU: 2, degreeV: 1, knotsU: [...Array(3).fill(breaks[0]), ...breaks.slice(1, -1).flatMap(value => [value, value]), ...Array(3).fill(breaks.at(-1))], knotsV: [vDomain[0], vDomain[0], vDomain[1], vDomain[1]], controlPoints: rows, weights: rows.map(() => [1, 1])};
}
const inclinedPlane = (id, u = [0, 1], v = [0, 1]) => ({kind: 'surface', id, degreeU: 1, degreeV: 1, knotsU: [u[0], u[0], u[1], u[1]], knotsV: [v[0], v[0], v[1], v[1]], controlPoints: [[[0, 0, 2], [0, 64, 2]], [[40, 0, 4.5], [40, 64, 4.5]]], weights: [[1, 1], [1, 1]]});
const siblingCurve = id => ({kind: 'curve', id, degree: 1, knots: [-0, -0, 1, 1], controlPoints: [[-0, 0, 0], [1, 1, 0]], weights: [1, 1]});
const originalSurface = warpedSurface('warped_support'), originalPlane = inclinedPlane('inclined_support');
const originalAsset = asset('warped_source', {name: 'warped_model', version: 0, lengthUnit: 'mm', objects: [siblingCurve('unselected_line'), originalSurface]}, originalSurface);
const planeAsset = asset('plane_source', {name: 'plane_model', version: 0, lengthUnit: 'mm', objects: [siblingCurve('plane_unused'), originalPlane]}, originalPlane);
const originalSection = section('warped_four', originalAsset, planeAsset);
const gcd = (a, b) => { a = a < 0n ? -a : a; while (b) [a, b] = [b, a % b]; return a; }, fraction = (n, d = 1n) => { assert.ok(d > 0n); const g = gcd(n, d); return [n / g, d / g]; };
const add = (a, b) => fraction(a[0] * b[1] + b[0] * a[1], a[1] * b[1]), sub = (a, b) => add(a, [-b[0], b[1]]), mul = (a, b) => fraction(a[0] * b[0], a[1] * b[1]), divide = (a, b) => { assert.notEqual(b[0], 0n); return b[0] > 0n ? fraction(a[0] * b[1], a[1] * b[0]) : fraction(-a[0] * b[1], -a[1] * b[0]); }, abs = a => [a[0] < 0n ? -a[0] : a[0], a[1]];
const compare = (a, b) => a[0] * b[1] < b[0] * a[1] ? -1 : a[0] * b[1] > b[0] * a[1] ? 1 : 0, published = value => { assert.deepEqual(Object.keys(value).sort(), ['numerator', 'denominator'].sort()); const result = fraction(BigInt(value.numerator), BigInt(value.denominator)); assert.equal(result[0].toString(), value.numerator); assert.equal(result[1].toString(), value.denominator); return result; };
function represented(value) { if (value === 0) return [0n, 1n]; const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value, false); const raw = view.getBigUint64(0, false), negative = raw >> 63n, exponent = Number((raw >> 52n) & 2047n), mantissa = (raw & ((1n << 52n) - 1n)) + (exponent ? 1n << 52n : 0n), power = exponent ? exponent - 1075 : -1074; return fraction((negative ? -mantissa : mantissa) * (power >= 0 ? 1n << BigInt(power) : 1n), power < 0 ? 1n << BigInt(-power) : 1n); }
function auditProof(value) { assert.notEqual(typeof value, 'bigint'); if (!value || typeof value !== 'object') return; if (Object.hasOwn(value, 'numerator') && Object.hasOwn(value, 'denominator')) published(value); if (Object.hasOwn(value, 'exact') && Object.hasOwn(value, 'upper')) { const exact = published(value.exact); assert.ok(exact[0] >= 0n); assert.ok(Number.isFinite(value.upper)); assert.ok(compare(represented(value.upper), exact) >= 0); if (exact[0] === 0n) assert.ok(Object.is(value.upper, 0)); else { const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value.upper, false); view.setBigUint64(0, view.getBigUint64(0, false) - 1n, false); assert.ok(compare(represented(view.getFloat64(0, false)), exact) < 0); }} Object.values(value).forEach(auditProof); }
const close = (actual, expected, label) => assert.ok(Math.hypot(...actual.map((value, axis) => value - expected[axis])) <= 1e-7, label);
const boundaries = ['v-min', 'u-max', 'v-max', 'u-min'];
const asDTO = value => ({numerator: value[0].toString(), denominator: value[1].toString()}), maximum = values => values.reduce((a, b) => compare(a, b) >= 0 ? a : b, [0n, 1n]), minimum = values => values.reduce((a, b) => compare(a, b) <= 0 ? a : b);
function homogeneous(curve) { return curve.controlPoints.map((point, i) => [...point.map(value => mul(represented(value), represented(curve.weights[i]))), represented(curve.weights[i])]); }
function restrictionOracle(result, index) {
  const interval = result.intervals[index], original = interval.original, restricted = interval.curve; assert.equal(original.degree, 1); assert.equal(restricted.degree, 1); assert.equal(restricted.controlPoints.length, 2);
  const domain = [original.knots[1], original.knots[original.controlPoints.length]].map(represented), nativeInterval = interval.provenance.effectiveInterval.map(represented), originalH = homogeneous(original), storedH = homogeneous(restricted);
  const idealH = nativeInterval.map(parameter => { const fraction = divide(sub(parameter, domain[0]), sub(domain[1], domain[0])); return originalH[0].map((value, axis) => add(mul(value, sub([1n, 1n], fraction)), mul(originalH[1][axis], fraction))); });
  const coefficients = [0, 1, 2].map(axis => [0, 1, 2].map(k => { let sum = [0n, 1n]; for (let i = 0; i <= 1; i++) { const j = k - i; if (j < 0 || j > 1) continue; sum = add(sum, mul(sub(mul(idealH[i][axis], storedH[j][3]), mul(storedH[i][axis], idealH[j][3])), k === 1 ? [1n, 2n] : [1n, 1n])); } return sum; }));
  const denominator = mul(minimum(idealH.map(pole => pole[3])), minimum(storedH.map(pole => pole[3]))), axisBounds = coefficients.map(values => divide(maximum(values.map(abs)), denominator)), restrictionGap = axisBounds.reduce(add, [0n, 1n]);
  const edge = result.edges[[1, 2, 4, 5][index]], nominalEndpoints = edge.vertexIds.map(id => result.vertices.find(vertex => vertex.id === id).uv), vDomain = result.section.report.surfaceDomains.v.map(represented), left = index >= 2;
  const mappedV = nativeInterval.map(parameter => { const offset = mul(divide(sub(parameter, domain[0]), sub(domain[1], domain[0])), sub(vDomain[1], vDomain[0])); return left ? sub(vDomain[1], offset) : add(vDomain[0], offset); });
  const mapErrors = mappedV.map((value, endpoint) => abs(sub(value, represented(nominalEndpoints[endpoint][1])))), mapGap = maximum(mapErrors), total = add(restrictionGap, mul(maximum(result.section.proof.spans.map(span => published(span.lipschitz.surfaceV.exact))), mapGap));
  assert.ok(compare(total, represented(1e-7)) <= 0);
  return {index, idealHomogeneous: idealH.map(pole => pole.map(asDTO)), storedHomogeneous: storedH.map(pole => pole.map(asDTO)), crossProductDifferenceCoefficients: coefficients.map(values => values.map(asDTO)), minimumIdealWeight: asDTO(minimum(idealH.map(pole => pole[3]))), minimumStoredWeight: asDTO(minimum(storedH.map(pole => pole[3]))), denominatorLowerBound: asDTO(denominator), axisBounds: axisBounds.map(asDTO), restrictionGap: asDTO(restrictionGap), mappedV: mappedV.map(asDTO), mapErrors: mapErrors.map(asDTO), nominalMapError: asDTO(mapGap), totalWorldToSurface: asDTO(total)};
}
function binomial(n, i) { if (i < 0 || i > n) return 0; let value = 1; for (let k = 1; k <= i; k++) value = value * (n - k + 1) / k; return value; }
function product(a, b) { const p = a.length - 1, q = b.length - 1; return Array.from({length: p + q + 1}, (_, k) => { let sum = [0n, 1n]; for (let i = 0; i <= p; i++) { const j = k - i; if (j < 0 || j > q) continue; sum = add(sum, mul(mul(a[i], b[j]), fraction(BigInt(binomial(p, i) * binomial(q, j)), BigInt(binomial(p + q, k))))); } return sum; }); }
function monotonicOracle(curve) { const h = homogeneous(curve), n = h.map(pole => pole[0]), w = h.map(pole => pole[3]), derivative = values => values.slice(1).map((value, i) => mul(sub(value, values[i]), [BigInt(values.length - 1), 1n])); const nw = product(derivative(n), w), wn = product(n, derivative(w)), coefficients = nw.map((value, i) => sub(value, wn[i])); for (const coefficient of coefficients) assert.ok(coefficient[0] > 0n); return coefficients.map(asDTO); }
function nearestAudit(exact, rounded) { const delta = abs(sub(exact, represented(rounded))), view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, rounded, false); const bits = view.getBigUint64(0, false); for (const direction of [-1, 1]) { let neighbor; if (rounded === 0) neighbor = direction * Number.MIN_VALUE; else { view.setBigUint64(0, bits + BigInt(rounded > 0 ? direction : -direction), false); neighbor = view.getFloat64(0, false); } const distance = abs(sub(exact, represented(neighbor))); assert.ok(compare(delta, distance) <= 0); if (compare(delta, distance) === 0) assert.equal(bits & 1n, 0n, 'Nearest tie must choose even significand'); } }
jsonFile('source-api.inputs', {entry, sourceInputs, cadInputs, sourceOnly: true, write: false, esbuildVersion: esbuild.version}); jsonFile('source-api.metafile', bundle.metafile);
function check(name, input, options) {
  const before = structuredClone({input, options}), request = jsonFile(name + '.authored-trim-request', {section: input, options}), result = build(input, options); ownership([input, options], result); assert.deepEqual({input, options}, before);
  assert.deepEqual(Object.keys(result).sort(), ['section', 'options', 'boundaries', 'intervals', 'world', 'vertices', 'edges', 'loops', 'faces', 'proof', 'observations', 'report'].sort()); assert.deepEqual(result.section, input); assert.deepEqual(result.options, options);
  assert.equal(result.boundaries.length, 4); assert.equal(result.intervals.length, 4); assert.equal(result.vertices.length, 6); assert.equal(result.edges.length, 7); assert.equal(result.loops.length, 2); assert.equal(result.faces.length, 2); const spanCount = input.report.spanCount, observationCount = 3 * (4 * spanCount + 1) + 12; assert.equal(result.observations.length, observationCount);
  const surface = input.surfaceAsset.surface, sourceId = input.surfaceAsset.sourceId;
  for (const [i, boundary] of result.boundaries.entries()) assert.deepEqual(boundary, extractSurfaceBoundary(surface, {boundary: boundaries[i], id: boundary.id}));
  for (const [i, interval] of result.intervals.entries()) {
    assert.deepEqual(interval.original, result.boundaries[i < 2 ? 1 : 3]); assert.deepEqual(interval, extractCurveInterval(interval.original, interval.options)); assert.deepEqual(validateExtractedCurveInterval(interval), interval.report);
    assert.equal(interval.report.quality.localObservationsOnly, true); assert.equal(interval.report.quality.globalShapeErrorCertified, false);
    sourceFile(name + '.interval_' + i + '.actual-original', interval.originalSource, interval.originalModel); sourceFile(name + '.interval_' + i + '.actual-restricted', interval.source, interval.model); jsonFile(name + '.interval_' + i + '.full-native', interval);
  }
  assert.deepEqual(Object.keys(result.world).sort(), ['source', 'sourceVersion', 'model'].sort()); assert.equal(result.world.sourceVersion, 0); assert.equal(result.world.model.objects.length, 8);
  assert.deepEqual(result.world.model.objects, [surface, ...result.edges.map(edge => edge.curve)]); assert.equal(new Set(result.world.model.objects.map(object => object.id)).size, 8); const worldFile = sourceFile(name + '.actual-world-model8', result.world.source, result.world.model);
  for (const [i, asset] of [input.surfaceAsset, input.planeAsset].entries()) { const compiled = compileCadModel(asset.source, {sourceVersion: 0}); assert.equal(compiled.ok, true); assert.deepEqual(compiled.model, input.originalModels[i]); sourceFile(name + '.original-source_' + i, asset.source, input.originalModels[i]); }
  const uDomain = input.report.surfaceDomains.u, vDomain = input.report.surfaceDomains.v, cutUV = input.pcurves.surface.curve, firstUV = cutUV.controlPoints[0], lastUV = cutUV.controlPoints.at(-1);
  const vertexRoles = ['bottomLeft', 'bottomRight', 'topRight', 'topLeft', 'cutLeft', 'cutRight'], expectedUV = [[uDomain[0], vDomain[0], 0], [uDomain[1], vDomain[0], 0], [uDomain[1], vDomain[1], 0], [uDomain[0], vDomain[1], 0], firstUV, lastUV];
  for (const [i, vertex] of result.vertices.entries()) { assert.equal(vertex.role, vertexRoles[i]); assert.equal(vertex.sourceId, sourceId); assert.equal(vertex.surfaceId, surface.id); assert.deepEqual(vertex.uv, expectedUV[i]); }
  const edgeRoles = ['bottom', 'rightLow', 'rightHigh', 'top', 'leftLow', 'leftHigh', 'sharedCut'], endpointIndices = [[0, 1], [1, 5], [5, 2], [2, 3], [4, 0], [3, 4], [4, 5]];
  const curves = [result.boundaries[0], result.intervals[0].curve, result.intervals[1].curve, result.boundaries[2], result.intervals[2].curve, result.intervals[3].curve, input.world.curve];
  for (const [i, edge] of result.edges.entries()) {
    assert.equal(edge.role, edgeRoles[i]); assert.deepEqual(edge.curve, curves[i]); assert.deepEqual(edge.vertexIds, endpointIndices[i].map(index => result.vertices[index].id));
    assert.deepEqual(Object.keys(edge.pcurve).sort(), ['coordinateSystem', 'lengthUnit', 'curve'].sort()); assert.equal(edge.pcurve.coordinateSystem, 'native-surface-uv'); assert.equal(edge.pcurve.lengthUnit, 'dimensionless');
    jsonFile(name + '.' + edge.role + '.dimensionless-uv', edge.pcurve);
    for (let endpoint = 0; endpoint < 2; endpoint++) assert.deepEqual(edge.pcurve.curve.controlPoints[endpoint === 0 ? 0 : edge.pcurve.curve.controlPoints.length - 1], result.vertices[endpointIndices[i][endpoint]].uv);
  }
  const shared = result.edges[6]; assert.deepEqual(shared.curve, input.world.curve); assert.deepEqual(shared.pcurve, input.pcurves.surface); assert.equal(shared.curve.degree, 2 * surface.degreeU);
  const report = result.report; assert.equal(report.schema, 'barocss-multispan-vlinear-surface-plane-trim-candidates'); assert.equal(report.version, 0); assert.equal(report.spanCount, spanCount); assert.equal(report.limits.maximumObservations, 63); assert.equal(report.evaluationId, options.evaluationId); assert.equal(report.sourceId, sourceId); assert.equal(report.surfaceId, surface.id); assert.equal(report.lengthUnit, 'mm'); assert.equal(report.uvLengthUnit, 'dimensionless');
  assert.deepEqual([report.vertexCount, report.edgeCount, report.loopCount, report.faceCount, report.worldObjectCount], [6, 7, 2, 2, 8]); assert.equal(report.sharedCutEdgeId, shared.id);
  for (const field of ['storedUVSimpleGraphCertified', 'orientedUVCyclesCertified', 'logicalIncidenceClosed', 'wholeEdgeModelGapCertified']) assert.equal(report[field], true);
  assert.deepEqual(report.directCounts, {sectionValidationCount: 1, boundaryExtractionCount: 4, intervalExtractionCount: 4, worldSourceCompilationCount: 1, uvCurveValidationCount: 6, observationCount, curvePointEvaluationCount: 2 * observationCount, curveDerivativeEvaluationCount: 2 * observationCount, surfacePointEvaluationCount: observationCount, surfaceDerivativeEvaluationCount: observationCount});
  assert.equal(report.quality.geometricValidity, 'not-certified'); assert.equal(report.quality.parentProofsUnchanged, true); for (const field of ['topologyCertified', 'solid', 'insideOutsideCertified', 'embeddedManifoldCertified', 'globalBinary64EvaluationErrorCertified', 'manufacturingToleranceCertified', 'supportRegularityCertified', 'globalD1ErrorCertified', 'weldingPerformed']) assert.equal(report.quality[field], false);
  const loopPlan = [[[0, 'forward'], [1, 'forward'], [6, 'reverse'], [4, 'forward']], [[6, 'forward'], [2, 'forward'], [3, 'forward'], [5, 'forward']]];
  for (const [loopIndex, loop] of result.loops.entries()) {
    assert.equal(loop.uses.length, 4); let twiceArea = 0;
    for (const [useIndex, use] of loop.uses.entries()) {
      const [edgeIndex, sense] = loopPlan[loopIndex][useIndex], edge = result.edges[edgeIndex], expectedVertices = sense === 'forward' ? edge.vertexIds : [...edge.vertexIds].reverse();
      assert.equal(use.edgeId, edge.id); assert.equal(use.sense, sense); assert.deepEqual(use.vertexIds, expectedVertices); assert.equal(use.pcurveId, edge.pcurve.curve.id);
      assert.equal(use.vertexIds[1], loop.uses[(useIndex + 1) % 4].vertexIds[0]); const a = result.vertices.find(vertex => vertex.id === use.vertexIds[0]).uv, b = result.vertices.find(vertex => vertex.id === use.vertexIds[1]).uv; twiceArea += a[0] * b[1] - b[0] * a[1];
      const domain = [edge.curve.knots[edge.curve.degree], edge.curve.knots[edge.curve.controlPoints.length]]; assert.deepEqual(use.interval, sense === 'forward' ? domain : [...domain].reverse());
    }
    assert.ok(twiceArea > 0, 'Both UV witness cycles have positive orientation');
    const face = result.faces[loopIndex]; assert.equal(face.outerLoopId, loop.id); assert.equal(face.sourceId, sourceId); assert.equal(face.surfaceId, surface.id); assert.equal(face.orientation, 'forward'); assert.equal(face.region, loopIndex === 0 ? 'below-stored-uv-graph' : 'above-stored-uv-graph');
  }
  const cutUses = result.loops.flatMap(loop => loop.uses).filter(use => use.edgeId === shared.id); assert.equal(cutUses.length, 2); assert.deepEqual(cutUses.map(use => use.sense), ['reverse', 'forward']); assert.deepEqual(cutUses[0].vertexIds, [...cutUses[1].vertexIds].reverse()); assert.equal(cutUses[0].pcurveId, cutUses[1].pcurveId);
  const independentObservations = [], derivativeCounts = Object.fromEntries(['world', 'pcurve', 'support'].map(key => [key, {evaluated: 0, refused: 0}]));
  for (const [edgeIndex, edge] of result.edges.entries()) {
    const a = edge.curve.knots[edge.curve.degree], b = edge.curve.knots[edge.curve.controlPoints.length], long = [0, 3, 6].includes(edgeIndex);
    const breaks = long ? [...new Set(edge.curve.knots.slice(edge.curve.degree, edge.curve.controlPoints.length + 1))] : [a, b];
    const rows = result.observations.filter(row => row.edgeIndex === edgeIndex), expectedCount = long ? 4 * spanCount + 1 : 3;
    assert.equal(rows.length, expectedCount);
    let position = 0;
    for (let interval = 0; interval < breaks.length - 1; interval++) {
      const divisions = long ? 4 : 2, left = breaks[interval], right = breaks[interval + 1];
      for (let slot = interval === 0 ? 0 : 1; slot <= divisions; slot++) {
        const observation = rows[position], parameter = observation.parameter;
        assert.equal(observation.edgeId, edge.id); assert.equal(observation.index, position++);
        if (slot === 0 || slot === divisions) assert.ok(Object.is(parameter, slot === 0 ? left : right));
        else { assert.ok(parameter > left && parameter < right); nearestAudit(add(represented(left), mul(sub(represented(right), represented(left)), fraction(BigInt(slot), BigInt(divisions)))), parameter); }
        const world = {d0: evaluateCurve(edge.curve, parameter), d1: replayD1(() => evaluateCurveD1(edge.curve, parameter))};
        const pcurve = {d0: evaluateCurve(edge.pcurve.curve, parameter), d1: replayD1(() => evaluateCurveD1(edge.pcurve.curve, parameter))};
        const support = {d0: evaluateSurface(surface, pcurve.d0[0], pcurve.d0[1]), d1: replayD1(() => evaluateSurfaceD1(surface, pcurve.d0[0], pcurve.d0[1]))};
        close(world.d0, support.d0); assert.deepEqual(observation.world, world); assert.deepEqual(observation.pcurve, pcurve); assert.deepEqual(observation.support, support);
        for (const [key, provider] of Object.entries({world, pcurve, support})) { derivativeCounts[key][provider.d1.status === 'evaluated' ? 'evaluated' : 'refused']++; if (provider.d1.status === 'evaluated') close(provider.d0, provider.d1.value.point); else assert.equal(observation.residuals[{world: 'worldD0D1PointGapMM', pcurve: 'uvD0D1PointGap', support: 'supportD0D1PointGapMM'}[key]], null); }
        let chain = null;
        if (pcurve.d1.status === 'evaluated' && support.d1.status === 'evaluated') chain = support.d1.value.du.map((value, axis) => value * pcurve.d1.value.derivative[0] + support.d1.value.dv[axis] * pcurve.d1.value.derivative[1]);
        assert.deepEqual(observation.chain, chain);
        if (chain && world.d1.status === 'evaluated') assert.ok(Math.hypot(...chain.map((value, axis) => value - world.d1.value.derivative[axis])) / Math.max(1, Math.hypot(...world.d1.value.derivative)) <= 1e-7);
        else assert.equal(observation.residuals.relativeChainGap, null);
        independentObservations.push({edgeId: edge.id, index: observation.index, parameter, world, pcurve, support, chain});
      }
    }
  }
  assert.deepEqual(report.derivativeCounts, derivativeCounts);
  auditProof(result.proof); const restrictionOracles = result.intervals.map((_, i) => restrictionOracle(result, i));
  for (const [i, oracle] of restrictionOracles.entries()) { const actual = result.proof.restrictions[i]; assert.equal(actual.intervalIndex, i); assert.equal(actual.boundaryIndex, i < 2 ? 1 : 3); assert.deepEqual(actual.idealHomogeneous, oracle.idealHomogeneous); assert.deepEqual(actual.storedHomogeneous, oracle.storedHomogeneous); assert.deepEqual(actual.crossDifference, [0, 1, 2].map(k => oracle.crossProductDifferenceCoefficients.map(axis => axis[k]))); assert.deepEqual(actual.minimumIdealWeight, oracle.minimumIdealWeight); assert.deepEqual(actual.minimumStoredWeight, oracle.minimumStoredWeight); assert.deepEqual(actual.restrictionGap.exact, oracle.restrictionGap); assert.deepEqual(actual.uvEndpointErrors, oracle.mapErrors); assert.deepEqual(actual.uvMappingError.exact, oracle.nominalMapError); assert.deepEqual(actual.surfaceMappingGap.exact, asDTO(sub(published(oracle.totalWorldToSurface), published(oracle.restrictionGap)))); assert.deepEqual(actual.modelGap.exact, oracle.totalWorldToSurface); }
  const monotonicityOracles = input.proof.spans.map((span, index) => {
    const poleIndices = span.surfacePcurvePoleIndices, curve = {...cutUV, controlPoints: poleIndices.map(i => cutUV.controlPoints[i]), weights: poleIndices.map(i => cutUV.weights[i])};
    const normalized = monotonicOracle(curve), coefficients = normalized.map(value => asDTO(divide(published(value), sub(represented(span.domain[1]), represented(span.domain[0])))));
    const actual = result.proof.uvMonotonicity.spans[index]; assert.equal(actual.index, index); assert.deepEqual(actual.domain, span.domain); assert.deepEqual(actual.poleIndices, poleIndices); assert.equal(actual.degree, 2 * cutUV.degree - 1); assert.deepEqual(actual.coefficients, coefficients); assert.deepEqual(actual.minimumCoefficient, asDTO(minimum(coefficients.map(published))));
    assert.ok(Object.is(curve.controlPoints[0][0], span.domain[0])); assert.ok(Object.is(curve.controlPoints.at(-1)[0], span.domain[1]));
    for (const point of curve.controlPoints) assert.ok(point[1] > vDomain[0] && point[1] < vDomain[1] && point[2] === 0);
    return {index, domain: span.domain, poleIndices, normalized, coefficients};
  });
  assert.equal(result.proof.uvMonotonicity.spans.length, spanCount); assert.equal(result.proof.uvMonotonicity.nativeParameterDerivative, true);
  for (const field of ['allStrictPositive', 'endpointUExact', 'allVPolesStrictInterior']) assert.equal(result.proof.uvMonotonicity[field], true);
  assert.equal(result.proof.naturalBoundaryKnots.length, 4);
  for (const [boundaryIndex, proof] of result.proof.naturalBoundaryKnots.entries()) {
    const uAxis = boundaryIndex === 0 || boundaryIndex === 2, reversed = boundaryIndex >= 2, originalKnots = uAxis ? surface.knotsU : surface.knotsV, d = (uAxis ? uDomain : vDomain).map(represented);
    const expectedKnots = (reversed ? [...originalKnots].reverse() : originalKnots).map(k => reversed ? asDTO(sub(add(d[0], d[1]), represented(k))) : asDTO(represented(k)));
    assert.equal(proof.boundaryIndex, boundaryIndex); assert.equal(proof.sourceAxis, uAxis ? 'u' : 'v'); assert.equal(proof.reversed, reversed); assert.deepEqual(proof.originalKnots, originalKnots); assert.deepEqual(proof.actualKnots, result.boundaries[boundaryIndex].knots); assert.deepEqual(proof.expectedKnots, expectedKnots);
    proof.actualKnots.forEach((k, i) => assert.deepEqual(asDTO(represented(k)), expectedKnots[i]));
  }
  for (const key of ['left', 'right']) { const cut = result.proof.cuts[key], left = key === 'left', boundary = result.boundaries[left ? 3 : 1], bd = [boundary.knots[boundary.degree], boundary.knots[boundary.controlPoints.length]].map(represented), vd = vDomain.map(represented), nominal = represented(left ? firstUV[1] : lastUV[1]), parameterExact = add(bd[0], mul(sub(bd[1], bd[0]), divide(left ? sub(vd[1], nominal) : sub(nominal, vd[0]), sub(vd[1], vd[0])))); assert.deepEqual(cut.requestedParameter, asDTO(parameterExact)); assert.ok(Object.is(cut.requestedV, left ? firstUV[1] : lastUV[1])); nearestAudit(parameterExact, cut.roundedParameter); const fraction = divide(sub(represented(cut.roundedParameter), bd[0]), sub(bd[1], bd[0])), mapped = left ? sub(vd[1], mul(sub(vd[1], vd[0]), fraction)) : add(vd[0], mul(sub(vd[1], vd[0]), fraction)); assert.deepEqual(cut.mappedV, asDTO(mapped)); assert.deepEqual(cut.vError.exact, asDTO(abs(sub(mapped, nominal)))); }
  assert.deepEqual(report.edgeModelGaps, result.proof.edgeBounds); for (const [i, edge] of result.proof.edgeBounds.entries()) { assert.equal(edge.edgeId, result.edges[i].id); assert.equal(edge.role, result.edges[i].role); const expected = i === 6 ? input.proof.bounds.worldToSurface.exact : i === 0 || i === 3 ? asDTO([0n, 1n]) : restrictionOracles[[1, 2, 4, 5].indexOf(i)].totalWorldToSurface; assert.deepEqual(edge.bound.exact, expected); assert.ok(compare(published(edge.bound.exact), represented(1e-7)) <= 0); } assert.ok(Object.is(report.maximumWholeEdgeModelGapMM, Math.max(...result.proof.edgeBounds.map(edge => edge.bound.upper))));
  jsonFile(name + '.independent-restriction-model-gap-oracles', restrictionOracles); jsonFile(name + '.independent-stored-u-monotonicity', monotonicityOracles);
  jsonFile(name + '.independent-native-observations', independentObservations); assert.deepEqual(validate(result), result.report); const saved = jsonFile(name + '.owned-trim', result);
  assert.deepEqual(build(request.reopened.section, request.reopened.options), saved.reopened); assert.deepEqual(validate(saved.reopened), result.report);
  accepted.push({input, options, before, result, beforeResult: structuredClone(result)}); cases.push({name, requestFile: request.file, resultFile: saved.file, worldFile, worldObjectCount: 8, edgeCount: 7, loopCount: 2, spanCount, observationCount, derivativeCounts}); return result;
}
function replayD1(action) { try { return {status: 'evaluated', value: action()}; } catch (error) { assert.ok(error instanceof Error); assert.match(error.message, /exact C0 interior knot/); return {status: 'native-refused', reason: error.message, nativeErrorName: error.name}; } }
function polynomialWitness(name, result, breaks, zShift = 0) {
  const vd = result.section.report.surfaceDomains.v;
  const witnesses = result.observations.filter(row => row.edgeIndex === 6).map(row => {
    const i = Math.min(Math.max(0, breaks.findIndex(value => value > row.parameter) - 1), breaks.length - 2);
    const index = row.parameter === breaks.at(-1) ? breaks.length - 2 : i, geometryU = index + (row.parameter - breaks[index]) / (breaks[index + 1] - breaks[index]);
    const v = .25 + 5 * geometryU / 64 + zShift / 8, expectedWorld = [10 * geometryU, 2 * geometryU ** 2 + v * (1 + geometryU ** 2), 8 * v], expectedUV = [row.parameter, vd[0] + (vd[1] - vd[0]) * v, 0];
    close(row.world.d0, expectedWorld, 'Independent warped polynomial world witness'); close(row.pcurve.d0, expectedUV, 'Independent original-domain UV witness'); return {parameter: row.parameter, geometryU, expectedWorld, expectedUV};
  }); jsonFile(name + '.independent-polynomial-witnesses', witnesses);
}
const polynomialInput = structuredClone(originalSection), aliasedOriginalSurface = polynomialInput.originalModels[0].objects.find(object => object.kind === 'surface' && object.id === originalSurface.id);
aliasedOriginalSurface.controlPoints = polynomialInput.surfaceAsset.surface.controlPoints; aliasedOriginalSurface.weights = polynomialInput.surfaceAsset.surface.weights;
const polynomial = check('warped_four', polynomialInput, settings('warped')); polynomialWitness('warped_four', polynomial, [0, 1, 2, 3, 4]);
jsonFile('caller-alias-ownership', {callerControlPointsAliased: true, callerWeightsAliased: true, resultOccurrencesIndependent: true});
assert.ok(polynomial.report.derivativeCounts.world.refused > 0); assert.ok(polynomial.report.derivativeCounts.pcurve.refused > 0); assert.ok(polynomial.report.derivativeCounts.support.refused > 0);
const reversedPlane = reverseSurfaceAxis(originalPlane, {axis: 'u', surfaceId: 'reversed_support', resultIdPrefix: 'revplane'});
jsonFile('actual-original-plane-reversal', reversedPlane); sourceFile('actual-original-plane-reversal', reversedPlane.source, reversedPlane.model);
const reversedSection = section('reversed_plane', originalAsset, asset('reversed_source', reversedPlane.model, reversedPlane.surface));
const reversed = check('reversed_plane', reversedSection, settings('reversed')); assert.equal(reversed.section.report.polarity, -originalSection.report.polarity); polynomialWitness('reversed_plane', reversed, [0, 1, 2, 3, 4]);
const nonuniformBreaks = [-3, -1, 2, 5, 9], shiftedSurface = warpedSurface('shifted_support', nonuniformBreaks, [-2, 2]), shiftedPlane = inclinedPlane('shifted_plane', [-5, 5], [2, 6]);
const shiftedSection = section('nonuniform_u', asset('shifted_source', {name: 'shifted_model', version: 0, lengthUnit: 'mm', objects: [siblingCurve('shifted_unused'), shiftedSurface]}, shiftedSurface), asset('shifted_plane_source', {name: 'shifted_plane_model', version: 0, lengthUnit: 'mm', objects: [shiftedPlane]}, shiftedPlane));
const shifted = check('nonuniform_u', shiftedSection, settings('shifted')); polynomialWitness('nonuniform_u', shifted, nonuniformBreaks);
function linearSurface(id, breaks) { return {kind: 'surface', id, degreeU: 1, degreeV: 1, knotsU: [breaks[0], ...breaks, breaks.at(-1)], knotsV: [0, 0, 1, 1], controlPoints: breaks.map((_, i) => [[2 * i, 0, 1 + i], [2 * i, 4, 2 + i]]), weights: breaks.map(() => [1, 1])}; }
const linearPlane = width => ({kind: 'surface', id: 'linear_plane', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[[0, 2, 0], [0, 2, 8]], [[width, 2, 0], [width, 2, 8]]], weights: [[1, 1], [1, 1]]});
const linearSupport = linearSurface('linear_support', [0, 1, 2, 3, 4]), linearChart = linearPlane(8);
const linearSection = section('linear_four', asset('linear_source', {name: 'linear_model', version: 0, lengthUnit: 'mm', objects: [linearSupport]}, linearSupport), asset('linear_plane_source', {name: 'linear_plane_model', version: 0, lengthUnit: 'mm', objects: [linearChart]}, linearChart));
const linear = check('linear_four', linearSection, settings('linear'));
for (const row of linear.observations.filter(row => row.edgeIndex === 6)) { close(row.world.d0, [2 * row.parameter, 2, 1.5 + row.parameter]); close(row.pcurve.d0, [row.parameter, .5, 0]); }
const singleSupport = warpedSurface('single_support', [0, 1]), singleSection = section('single_compat', asset('single_source', {name: 'single_model', version: 0, lengthUnit: 'mm', objects: [singleSupport]}, singleSupport), planeAsset);
const single = check('single_compat', singleSection, settings('single')); polynomialWitness('single_compat', single, [0, 1]);
const oldSection = api.buildVLinearSurfacePlaneSection(singleSection.surfaceAsset, singleSection.planeAsset, {...singleSection.options, maximumObservations: 5});
const oldTrim = api.buildVLinearSurfacePlaneTrimCandidates(oldSection, {...settings('single'), maximumObservations: 21});
for (const key of ['boundaries', 'intervals', 'world', 'vertices', 'edges', 'loops', 'faces']) assert.deepEqual(single[key], oldTrim[key]);
jsonFile('actual-old-single-span-geometry-compatible', {geometryKeys: ['boundaries', 'intervals', 'world', 'vertices', 'edges', 'loops', 'faces'], oldSection, oldTrim});
const sourceEditRequest = {source: planeAsset.source, sourceVersion: 0, surfaceId: originalPlane.id, edits: {poleEdits: originalPlane.controlPoints.flatMap((row, uIndex) => row.map((point, vIndex) => ({uIndex, vIndex, zMM: point[2] + .125})))}};
jsonFile('authored-source-edit-request', sourceEditRequest); const sourceEdit = editSourceSurfaceControlNet(sourceEditRequest); jsonFile('actual-whole-plane-source-edit', sourceEdit); sourceFile('actual-whole-plane-source-edit', sourceEdit.source, sourceEdit.model);
const editedPlaneAsset = {sourceId: planeAsset.sourceId, source: sourceEdit.source, surface: sourceEdit.edit.surface}; retained.push({value: editedPlaneAsset, before: structuredClone(editedPlaneAsset)});
const editedSection = section('edited', originalAsset, editedPlaneAsset), edited = check('edited_source_rebuild', editedSection, settings('edited'));
assert.notDeepEqual(edited.edges[6].curve.controlPoints, polynomial.edges[6].curve.controlPoints); polynomialWitness('edited_source_rebuild', edited, [0, 1, 2, 3, 4], .125);
assert.deepEqual(sourceEdit.model.objects.find(object => object.id === 'plane_unused'), originalSection.originalModels[1].objects.find(object => object.id === 'plane_unused'));
function intact() { for (const row of retained) assert.deepEqual(row.value, row.before); for (const row of accepted) { assert.deepEqual({input: row.input, options: row.options}, row.before); assert.deepEqual(row.result, row.beforeResult); } for (const [file, bytes] of files) assert.deepEqual(readFileSync(file), bytes, file); }
function reject(name, action, code, causeClass = null, causeCode = null) {
  assert.throws(action, error => { assert.ok(error instanceof TrimError); assert.equal(error.code, code); assert.ok(error.message.length <= 1024); if (causeClass) assert.ok(error.cause instanceof causeClass); if (causeCode) assert.equal(error.cause.code, causeCode);
    failures.push({name, code: error.code, message: error.message, causeCode: error.cause?.code ?? null, causeMessage: error.cause?.message ?? null, nestedCauseCode: error.cause?.cause?.code ?? null}); intact(); return true; });
}
// Preserve the first failed V[-2,6] family as an actual unchanged native-domain refusal.
const v6GuardSurface = warpedSurface('shifted_support', nonuniformBreaks, [-2, 6]);
const v6GuardAsset = asset('shifted_source', {name: 'shifted_model', version: 0, lengthUnit: 'mm', objects: [siblingCurve('shifted_unused'), v6GuardSurface]}, v6GuardSurface, 'nonuniform_v6_guard_surface');
const v6GuardSection = section('nonuniform_v6_guard', v6GuardAsset, shiftedSection.planeAsset);
const v6GuardTop = extractSurfaceBoundary(v6GuardSurface, {boundary: 'v-max', id: 'v6_guard_top'}), v6GuardDomains = v6GuardSection.report.surfaceDomains;
const v6GuardTopDomain = [v6GuardTop.knots[v6GuardTop.degree], v6GuardTop.knots[v6GuardTop.controlPoints.length]];
// Reconstruct the builder's nominal degree1 UV sidecar from the actual natural edge domain and ORIGINAL chart vertices.
const v6GuardTopUV = {kind: 'curve', id: 'v6_guard_top_uv', degree: 1, knots: [v6GuardTopDomain[0], v6GuardTopDomain[0], v6GuardTopDomain[1], v6GuardTopDomain[1]], controlPoints: [[v6GuardDomains.u[1], v6GuardDomains.v[1], 0], [v6GuardDomains.u[0], v6GuardDomains.v[1], 0]], weights: [1, 1]};
const v6GuardParameter = -1, v6GuardUV = evaluateCurve(v6GuardTopUV, v6GuardParameter);
assert.ok(v6GuardUV[1] > v6GuardDomains.v[1]); let v6NativeCause;
assert.throws(() => evaluateSurface(v6GuardSurface, v6GuardUV[0], v6GuardUV[1]), error => { assert.ok(error instanceof Error); assert.match(error.message, /Parameter is outside the knot domain/); v6NativeCause = {name: error.name, message: error.message}; return true; });
jsonFile('nonuniform_v6_guard.actual-uv-domain-refusal', {firstFailureHead: '8da2d687786aefdaa93e9a11342a6f817269e832', edge: 'top', parameter: v6GuardParameter, nominalUVSidecar: v6GuardTopUV, actualUV: v6GuardUV, originalDomains: v6GuardDomains, nativeCause: v6NativeCause, clampingPerformed: false, parentEvaluatorUnchanged: true});
reject('nonuniform_v6_guard', () => build(v6GuardSection, settings('v6guard')), 'NATIVE', Error);
assert.match(failures.at(-1).causeMessage, /Parameter is outside the knot domain/);
for (const [field, value] of [['maximumBoundaries', 3], ['maximumIntervals', 3], ['maximumObservations', 62], ['maximumObservations', 64]]) reject('complete_fixed_budget_' + field + '_' + value, () => build(originalSection, {...settings('budget'), [field]: value}), 'BUDGET');
reject('existing_model_identity', () => build(originalSection, {...settings('identity'), evaluationId: originalSection.world.model.name}), 'IDENTITY');
reject('section_cut_identity', () => build(originalSection, {...settings('identity'), evaluationId: originalSection.world.curve.id}), 'IDENTITY');
reject('invalid_prefix', () => build(originalSection, {...settings('identity'), resultIdPrefix: 'bad.prefix'}), 'IDENTITY');
reject('missing_option', () => build(originalSection, {evaluationId: 'missing', resultIdPrefix: 'missing', maximumBoundaries: 4, maximumIntervals: 4}), 'INPUT');
reject('actual_parent_owned_malformed', () => build({}, settings('malformed')), 'SECTION', SectionError, 'OWNED');
const sourceCompiled = compileCadModel(originalSection.surfaceAsset.source, {sourceVersion: 0}); assert.equal(sourceCompiled.ok, true);
const selectedDeclaration = sourceCompiled.ast.declarations.find(item => item.kind === 'surface' && item.id === originalSection.surfaceAsset.surface.id), selectedPole = selectedDeclaration.fields.find(field => field.name === 'control-points').value.items[0].items[0].items[0]; assert.equal(selectedPole.kind, 'number'); assert.ok(Object.is(selectedPole.value, 0));
const sourceBits = originalSection.surfaceAsset.source.slice(0, selectedPole.range.start) + '-0' + originalSection.surfaceAsset.source.slice(selectedPole.range.end), bitsCompiled = compileCadModel(sourceBits, {sourceVersion: 0}); assert.equal(bitsCompiled.ok, true);
const expectedBits = structuredClone(sourceCompiled.model); expectedBits.objects.find(object => object.kind === 'surface' && object.id === originalSection.surfaceAsset.surface.id).controlPoints[0][0][0] = -0; assert.deepEqual(bitsCompiled.model, expectedBits);
sourceFile('actual-selected-support-bit-change', sourceBits, bitsCompiled.model); jsonFile('selected-support-bit-binding', {surfaceId: originalSection.surfaceAsset.surface.id, range: selectedPole.range, selectedCoordinate: [0, 0, 0], originalText: originalSection.surfaceAsset.source.slice(selectedPole.range.start, selectedPole.range.end), replacementText: '-0'});
for (const [name, alter] of [['coefficient_proof', section => { section.proof.bounds.worldToSurface.upper += 1; }], ['native_observation', section => { section.observations[0] = section.observations[1]; }], ['selected_source_bits', section => { section.surfaceAsset.source = sourceBits; }]]) { const changed = structuredClone(originalSection); alter(changed); reject('actual_parent_owned_' + name, () => build(changed, settings('badsection')), 'SECTION', SectionError, 'OWNED'); }
let getterCalls = 0; const getterOptions = settings('getter'); Object.defineProperty(getterOptions, 'maximumIntervals', {enumerable: true, get() { getterCalls++; return 4; }}); reject('options_getter', () => build(originalSection, getterOptions), 'INPUT');
const nestedGetter = structuredClone(originalSection); Object.defineProperty(nestedGetter.pcurves.surface.curve, 'weights', {enumerable: true, get() { getterCalls++; return []; }}); reject('section_getter', () => build(nestedGetter, settings('nested')), 'INPUT'); assert.equal(getterCalls, 0);
const sparse = settings('sparse'); sparse.maximumBoundaries = Number.NaN; reject('nonfinite_input', () => build(originalSection, sparse), 'INPUT');
const cyclic = structuredClone(originalSection); cyclic.section = cyclic; reject('cyclic_input', () => build(cyclic, settings('cyclic')), 'INPUT');

// The original two-span section is genuine; only exact natural-boundary reflection admission fails.
const roundingBreaks = [.1, 1.1, 4.1], roundingSupport = linearSurface('rounding_support', roundingBreaks), roundingChart = linearPlane(4);
const roundingSection = section('rounding', asset('rounding_source', {name: 'rounding_model', version: 0, lengthUnit: 'mm', objects: [roundingSupport]}, roundingSupport), asset('rounding_plane_source', {name: 'rounding_plane_model', version: 0, lengthUnit: 'mm', objects: [roundingChart]}, roundingChart));
const actualReflectedBoundary = extractSurfaceBoundary(roundingSupport, {boundary: 'v-max', id: 'rounding_top'});
const reflectionMismatches = actualReflectedBoundary.knots.map((actual, i) => { const exact = sub(add(represented(roundingBreaks[0]), represented(roundingBreaks.at(-1))), represented([...roundingSupport.knotsU].reverse()[i])); return {index: i, actual, exact: asDTO(exact), mismatch: compare(represented(actual), exact) !== 0}; }).filter(row => row.mismatch);
assert.ok(reflectionMismatches.length > 0, 'Genuine binary64 knot-reflection rounding'); jsonFile('actual-reflection-rounding', {roundingBreaks, actualReflectedBoundary, reflectionMismatches});
reject('actual_original_top_knot_reflection_rounding', () => build(roundingSection, settings('rounding')), 'REPRESENTABILITY');
const sparseSection = structuredClone(originalSection); delete sparseSection.pcurves.surface.curve.controlPoints[0]; reject('sparse_section_control_points', () => build(sparseSection, settings('sparse')), 'INPUT');
const hidden = structuredClone(originalSection); Object.defineProperty(hidden, 'extra', {value: 0, enumerable: false}); reject('hidden_section_field', () => build(hidden, settings('hidden')), 'INPUT');
const inheritedLimitRefusals = [];
for (const [name, action, ErrorClass] of [
  ['actual_degree4_cut_interval', () => extractCurveInterval(originalSection.world.curve, {curveId: 'limited_cut_interval', interval: [0, 1], resultIdPrefix: 'limited_cut'}), CurveIntervalExtractionError],
  ['actual_degree4_cut_reverse', () => reverseCurve(originalSection.world.curve, {curveId: 'limited_cut_reverse'}), CurveReversalError],
]) assert.throws(action, error => { assert.ok(error instanceof ErrorClass); assert.equal(error.code, 'INPUT'); inheritedLimitRefusals.push({name, code: error.code, message: error.message, invokedByTrimBuilder: false}); intact(); return true; });
jsonFile('actual-inherited-degree4-cut-limits', inheritedLimitRefusals);
for (const [name, alter] of [
  ['section_child', value => { value.section.proof.bounds.worldToSurface.upper += 1; }], ['interval_child', value => { value.intervals[0].report.quality.globalShapeErrorCertified = true; }],
  ['world_source', value => { value.world.source += ' '; }], ['nominal_vertex', value => { value.vertices[4].uv[1] += .01; }], ['shared_cut', value => { value.edges[6].curve.controlPoints[2][2] += .1; }],
  ['opposite_use', value => { value.loops[0].uses[2].sense = 'forward'; }], ['loop_endpoint', value => { value.loops[0].uses[1].vertexIds.reverse(); }], ['uv_units', value => { value.edges[1].pcurve.lengthUnit = 'mm'; }],
  ['proof_fraction', value => { value.proof.restrictions[0].idealHomogeneous[0][0].numerator = '1'; }], ['proof_bound', value => { value.proof.edgeBounds[0].bound.upper += 1; }],
  ['affine_inverse', value => { value.proof.cuts.left.roundedParameter = .5; }], ['monotonicity', value => { value.proof.uvMonotonicity.allStrictPositive = false; }],
  ['natural_boundary_reflection_fraction', value => { value.proof.naturalBoundaryKnots[2].expectedKnots[0].numerator = '1'; }], ['span_monotonicity', value => { value.proof.uvMonotonicity.spans[1].coefficients[0].numerator = '0'; }], ['span_pole_index', value => { value.proof.uvMonotonicity.spans[1].poleIndices[0] = 0; }], ['native_observation', value => { value.observations[0] = value.observations[1]; }], ['counter', value => { value.report.directCounts.intervalExtractionCount++; }],
]) { const changed = structuredClone(polynomial); alter(changed); reject('owned_' + name, () => validate(changed), 'OWNED'); }
let replacement = polynomial; const previous = replacement; reject('atomic_prior_trim', () => { replacement = build(roundingSection, settings('atomic')); }, 'REPRESENTABILITY'); assert.strictEqual(replacement, previous); jsonFile('atomic-retention', {priorResultUnchanged: replacement === previous, getterCalls});
const packageRoot = resolve(repo, 'packages/barocss-cad'), manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')), declared = manifest.publishConfig?.exports?.['.'] ?? manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types); assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath)); const publicAPI = await import(pathToFileURL(runtimePath).href);
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function'); assert.deepEqual(publicAPI.MultiSpanVLinearSurfacePlaneTrimDiagnosticCode, MultiSpanVLinearSurfacePlaneTrimDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./multispan-vlinear-plane-trim.js')); const leafDeclarationPath = resolve(packageRoot, 'dist/intersect/multispan-vlinear-plane-trim.d.ts'), declaration = readFileSync(leafDeclarationPath, 'utf8');
for (const name of [...runtimeNames, ...typeNames]) assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(declaration), name);
for (const row of cases) { const request = JSON.parse(readFileSync(row.requestFile, 'utf8')), stored = JSON.parse(readFileSync(row.resultFile, 'utf8')), cold = publicAPI.compileCadModel(readFileSync(row.worldFile, 'utf8'), {sourceVersion: 0}); assert.equal(cold.ok, true); assert.deepEqual(cold.model, stored.world.model); assert.deepEqual(publicAPI.buildMultiSpanVLinearSurfacePlaneTrimCandidates(request.section, request.options), stored); assert.deepEqual(publicAPI.validateMultiSpanVLinearSurfacePlaneTrimCandidates(stored), stored.report); }
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 8, exportSelection: manifest.publishConfig?.exports?.['.'] ? 'publishConfig.exports root' : 'exports root'}; jsonFile('compiled-consumer', compiledConsumer);
const summary = {sourceMode: true, cases, failures, inheritedLimitRefusals, compiledConsumer, caseCount: cases.length, refusalCount: failures.length, getterCalls,
  scope: 'Two original multi-span candidate regions relative to the stored UV graph, simple oriented UV cycles and coefficient-model position gaps. No ideal-plane side, support regularity, world embedding, manifold, inside/outside, holed trimming, Solid Boolean or rendering certificate.'};
jsonFile('summary', summary); intact(); console.log(JSON.stringify(summary));
