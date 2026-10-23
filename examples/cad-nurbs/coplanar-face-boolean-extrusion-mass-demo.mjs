import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node coplanar-face-boolean-extrusion-mass-demo.mjs --source <output-directory>'); assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]); mkdirSync(output, {recursive: true});
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const esbuild = require('esbuild'), entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundle = await esbuild.build({absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true});
assert.equal(bundle.outputFiles.length, 1);
const sourceInputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path)), cadInputs = sourceInputs.filter(path => path.includes('/packages/barocss-cad/'));
for (const leaf of ['index.ts', 'planar-solids/coplanar-face-boolean-extrusion-mass.ts', 'planar-solids/coplanar-face-boolean-extrusion-properties.ts', 'planar-solids/coplanar-face-boolean-extrusion.ts']) {
  assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
}
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const {estimateCoplanarFaceBooleanExtrusionMass: estimate, validateCoplanarFaceBooleanExtrusionMass: validate,
  CoplanarFaceBooleanExtrusionMassError, CoplanarFaceBooleanExtrusionMassDiagnosticCode,
  buildConvexPlanarFace: buildFace, booleanCoplanarFaces: boolean, extrudeCoplanarFaceBoolean: extrude,
  evaluateSurface, evaluateSurfaceD1, compileCadModel} = api;
const runtimeNames = ['estimateCoplanarFaceBooleanExtrusionMass', 'validateCoplanarFaceBooleanExtrusionMass', 'CoplanarFaceBooleanExtrusionMassError', 'CoplanarFaceBooleanExtrusionMassDiagnosticCode'];
const typeNames = ['CoplanarFaceBooleanExtrusionMassOptions', 'CoplanarFaceBooleanExtrusionMassComponent', 'CoplanarFaceBooleanExtrusionMassReport', 'CoplanarFaceBooleanExtrusionMassResult'];
for (const name of runtimeNames) assert.equal(typeof api[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(Object.keys(CoplanarFaceBooleanExtrusionMassDiagnosticCode).sort(), ['INPUT', 'BUDGET', 'NATIVE', 'REPRESENTABILITY', 'OWNED'].sort());
const retainedFiles = new Map(), loadedFiles = new Map(), inputProvenance = [], accepted = [], nativeInputs = [], cases = [], failures = [];
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
  const cold = compileCadModel(readFileSync(file, 'utf8'), {sourceVersion: 0});
  assert.equal(cold.ok, true, JSON.stringify(cold.diagnostics)); assert.deepEqual(cold.model, model); assert.ok(model.objects.length <= 16); return file;
}
function readAuthentic(file) {
  assert.ok(!loadedFiles.has(file), 'Authentic fixture must be loaded once: ' + file);
  const bytes = readFileSync(file); loadedFiles.set(file, bytes); retainedFiles.set(file, bytes);
  inputProvenance.push({file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')}); return bytes;
}
function ownership(inputs, result) {
  const caller = new WeakSet(), seen = new WeakSet();
  const collect = value => { if (value && typeof value === 'object' && !caller.has(value)) {
    caller.add(value); for (const child of Object.values(value)) collect(child);
  }};
  inputs.forEach(collect);
  const visit = value => { if (value && typeof value === 'object') {
    assert.ok(!caller.has(value), 'Caller alias'); assert.ok(!seen.has(value), 'Repeated result occurrence or matrix row');
    seen.add(value); for (const child of Object.values(value)) visit(child);
  }};
  visit(result);
}
function bits(actual, expected) {
  if (typeof expected === 'number') { assert.ok(Object.is(actual, expected), 'Actual931 centroid bits changed'); return; }
  assert.deepEqual(actual, expected); if (expected && typeof expected === 'object') for (const key of Object.keys(expected)) bits(actual[key], expected[key]);
}
function closeMM(actual, expected, label) { assert.ok(Math.hypot(...actual.map((value, i) => value - expected[i])) <= 1e-7, label); }
function closeSI(actual, expected, unit, label) {
  assert.ok(Number.isFinite(actual)); const floor = unit === 'kg' ? 1e-12 : 1e-15;
  const tolerance = 1e-8 * Math.max(Math.abs(expected), floor), error = Math.abs(actual - expected);
  assert.ok(error <= tolerance, label + ': ' + error + ' > ' + tolerance + ' ' + unit); return {error, tolerance, unit};
}
function tensorSI(actual, expected, label) {
  assert.equal(actual.length, 3); const errors = [];
  for (let i = 0; i < 3; i++) { assert.equal(actual[i].length, 3);
    for (let j = 0; j < 3; j++) { assert.ok(Object.is(actual[i][j], actual[j][i]), 'Independent symmetric tensor rows');
      errors.push(closeSI(actual[i][j], expected[i][j], 'kg*m2', label + '[' + i + ',' + j + ']')); }
  }
  return errors;
}
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const outer = (a, b = a) => a.map(x => b.map(y => x * y));
const matrix = action => [0, 1, 2].map(i => [0, 1, 2].map(j => action(i, j)));
const diagonal = values => matrix((i, j) => i === j ? values[i] : 0);
const add = (a, b) => matrix((i, j) => a[i][j] + b[i][j]);
const scale = (a, factor) => matrix((i, j) => a[i][j] * factor);
function covarianceInertia(covarianceMM2, massKG) {
  const trace = covarianceMM2[0][0] + covarianceMM2[1][1] + covarianceMM2[2][2];
  return matrix((i, j) => massKG * 1e-6 * ((i === j ? trace : 0) - covarianceMM2[i][j]));
}
function uvCovarianceWorld(covarianceUV, a, b, normal, heightMM) {
  // Independent normalized UV covariance transport; production integrates centered physical edge moments.
  return matrix((i, j) => a[i] * a[j] * covarianceUV[0][0] + (a[i] * b[j] + b[i] * a[j]) * covarianceUV[0][1]
    + b[i] * b[j] * covarianceUV[1][1] + heightMM * heightMM / 12 * normal[i] * normal[j]);
}
const options = densityKgPerM3 => ({densityKgPerM3, maximumBoundarySegments: 64, maximumSurfaceEvaluations: 8, maximumSurfacePointEvaluations: 64});
const worldTilted = ([u, v]) => [u + .5 * v - 7.5, v - 11, u + .5 * v - 7.5];
const tiltedU = [1, 0, 1], tiltedV = [.5, 1, .5], tiltedNormal = [-1 / Math.SQRT2, 0, 1 / Math.SQRT2];
const translatedCenter = uv => worldTilted(uv).map((value, i) => value + tiltedNormal[i]);
const evidence888 = '/Users/user/.barocss-ai/v3/evidence-888-cad/demo-output';
const evidence931 = '/Users/user/.barocss-ai/v3/evidence-931-cad/integration/demo-output';
function authentic(name, directory, extrusionName, propertiesName) {
  const extrusionFile = resolve(directory, extrusionName + '.owned-extrusion.json');
  const extrusion = JSON.parse(readAuthentic(extrusionFile).toString('utf8'));
  const savedProperties = JSON.parse(readAuthentic(resolve(evidence931, propertiesName + '.owned-properties.json')).toString('utf8'));
  assert.deepEqual(savedProperties.extrusion, extrusion);
  const sourceFiles = extrusion.sources.map((chunk, i) => {
    const original = resolve(directory, extrusionName + '.world_chunk_' + i + '.source0.css'), bytes = readAuthentic(original);
    assert.equal(bytes.toString('utf8'), chunk.source); return sourceFile(name + '.authentic_world_chunk_' + i, chunk.source, chunk.model);
  });
  nativeInputs.push({extrusion, before: structuredClone(extrusion), originalFile: extrusionFile}); return {extrusion, savedProperties, sourceFiles};
}
const offcenter = authentic('offcenter', evidence931, 'offcenter_hole', 'offcenter_hole_properties');
const separated = authentic('separated', evidence888, 'strip_two_components', 'strip_two_components');
const empty = authentic('empty', evidence888, 'reverse_containment_empty', 'reverse_containment_empty');
function freshBox(name, transform) {
  const plane = id => ({kind: 'surface', id, degreeU: 1, degreeV: 1, knotsU: [0, 0, 16, 16], knotsV: [0, 0, 32, 32],
    controlPoints: [[transform([0, 0, 0]), transform([0, 32, 0])], [transform([16, 0, 0]), transform([16, 32, 0])]], weights: [[1, 1], [1, 1]]});
  const face = (suffix, corners) => {
    const points = corners.map(([x, y]) => transform([x, y, 0])), loop = {id: name + '_' + suffix + '_loop', edges: points.map((point, i) =>
      ({kind: 'curve', id: name + '_' + suffix + '_line_' + i, degree: 1, knots: [-1, -1, 1, 1], controlPoints: [[...point], [...points[(i + 1) % points.length]]], weights: [1, 1]}))};
    const result = buildFace(plane(name + '_' + suffix + '_plane'), loop,
      {faceId: name + '_' + suffix + '_face', evaluationId: name + '_' + suffix + '_eval', resultIdPrefix: name + '_' + suffix + '_own', orientation: 'forward'});
    sourceFile(name + '.' + suffix + '.original-face', result.source, result.model); return result;
  };
  const a = face('a', [[0, 0], [10, 0], [10, 20], [0, 20]]), b = face('b', [[12, 2], [14, 2], [14, 4], [12, 4]]);
  const region = boolean(a, b, {operation: 'difference', evaluationId: name + '_boolean', resultIdPrefix: name + '_bool', maximumPairTests: 64, maximumFragments: 64});
  assert.equal(region.components.length, 1); assert.equal(region.loops.length, 1);
  const extrusion = extrude(region, {evaluationId: name + '_extrusion', resultIdPrefix: name + '_ext', distanceMM: 30,
    maximumVertices: 128, maximumFaces: 80, maximumSourceChunks: 17, maximumBindingSamples: 1152});
  const sourceFiles = extrusion.sources.map((chunk, i) => sourceFile(name + '.fresh_world_chunk_' + i, chunk.source, chunk.model));
  nativeInputs.push({extrusion, before: structuredClone(extrusion)}); return {extrusion, sourceFiles, savedProperties: null};
}
const box = freshBox('box', point => [...point]);
const rotatedBox = freshBox('rotbox', ([x, y, z]) => [z + 100, y - 50, 20 - x]);
jsonFile('source-api.inputs', {entry, sourceInputs, cadInputs, sourceOnly: true, write: false, esbuildVersion: esbuild.version});
jsonFile('source-api.metafile', bundle.metafile);
function check(name, input, density, oracle, customOptions = options(density)) {
  const extrusion = input.extrusion, before = structuredClone({extrusion, customOptions});
  const authored = jsonFile(name + '.authored-request', {extrusion, options: customOptions, sourceFiles: input.sourceFiles});
  const result = estimate(extrusion, customOptions); ownership([extrusion, customOptions], result); assert.deepEqual({extrusion, customOptions}, before);
  assert.deepEqual(Object.keys(result).sort(), ['properties', 'options', 'components', 'boundaryObservations', 'report'].sort());
  assert.deepEqual(result.options, customOptions); assert.deepEqual(result.properties.extrusion, extrusion);
  if (input.savedProperties) assert.deepEqual(result.properties, input.savedProperties);
  const properties = result.properties, report = result.report;
  assert.equal(report.schema, 'barocss-native-coplanar-face-boolean-extrusion-mass'); assert.equal(report.version, 0);
  assert.equal(report.densityKgPerM3, density); assert.equal(report.parentPropertiesCallCount, 1);
  assert.equal(report.parentSurfaceD1EvaluationCount, properties.report.surfaceD1EvaluationCount);
  assert.equal(report.boundarySegmentCount, properties.report.boundarySegmentCount); assert.equal(report.componentCount, properties.components.length);
  assert.equal(report.sourceFrame, 'authored-xyz-no-axis-conversion'); assert.equal(report.empty, oracle.components.length === 0);
  assert.equal(report.volumeMM3, properties.report.volumeMM3); assert.equal(report.shellCount, properties.report.shellCount); assert.equal(report.holeCount, properties.report.holeCount);
  assert.deepEqual(report.inheritedBindingResiduals, properties.report.inheritedBindingResiduals);
  assert.equal(report.quality.constructionEstimateOnly, true);
  for (const flag of ['densityCertified', 'materialCertified', 'solidCertified', 'manifoldCertified', 'inertiaCertified', 'massCertified',
    'manufacturingToleranceCertified', 'globalShapeErrorCertified', 'globalBinary64ErrorCertified']) assert.equal(report.quality[flag], false);
  assert.deepEqual(report.units, {density: 'kg/m3', mass: 'kg', centroid: 'mm', inertia: 'kg*m2', planarSecondMoment: 'mm4', volumeSecondMoment: 'mm5'});
  assert.deepEqual(report.unitConversions, {cubicMillimetresPerCubicMetre: 1e9, squareMetresPerSquareMillimetre: 1e-6, densityKgPerMM3: density / 1e9});
  bits(report.centroidMM, properties.report.centroidMM);
  const massError = closeSI(report.massKG, oracle.massKG, 'kg', name + '.mass');
  assert.ok(Math.abs(report.massKG - report.expectedMassKG) <= report.massComparisonToleranceKG);
  if (oracle.centroidMM === null) { assert.equal(report.centroidMM, null); assert.equal(report.inertiaCentroidKgM2, null); }
  else { closeMM(report.centroidMM, oracle.centroidMM, 'analytic aggregate centroid'); tensorSI(report.inertiaCentroidKgM2, oracle.inertiaCentroidKgM2, name + '.aggregate'); }
  const vertexById = new Map(extrusion.region.vertices.map(vertex => [vertex.id, vertex]));
  const selectedIds = new Set(extrusion.region.components.flatMap(component => [component.outerLoopId, ...component.holeLoopIds].flatMap(id =>
    extrusion.region.loops.find(loop => loop.id === id).vertexIds)));
  assert.equal(result.boundaryObservations.length, selectedIds.size); assert.equal(report.surfacePointEvaluationCount, selectedIds.size);
  assert.equal(new Set(result.boundaryObservations.map(row => row.vertexId)).size, selectedIds.size);
  for (const observation of result.boundaryObservations) {
    const vertex = vertexById.get(observation.vertexId); assert.ok(vertex && selectedIds.has(vertex.id)); assert.deepEqual(observation.uv, vertex.uv);
    assert.deepEqual(observation.pointMM, evaluateSurface(extrusion.region.support, vertex.uv[0], vertex.uv[1]));
    assert.deepEqual(observation.canonicalPointMM, vertex.pointMM); closeMM(observation.pointMM, observation.canonicalPointMM, 'canonical Surface D0 binding');
    assert.ok(observation.pointDifferenceMM <= 1e-7);
    const loops = extrusion.region.loops.filter(loop => loop.vertexIds.includes(vertex.id) && extrusion.region.components.some(component =>
      [component.outerLoopId, ...component.holeLoopIds].includes(loop.id)));
    assert.deepEqual(observation.loopIds, loops.map(loop => loop.id)); assert.ok(loops.every(loop => loop.componentId === observation.componentId));
  }
  assert.equal(result.components.length, oracle.components.length);
  const sorted = [...result.components].sort((a, b) => a.centroidUV[0] - b.centroidUV[0]);
  for (const [i, component] of sorted.entries()) {
    const old = properties.components.find(row => row.componentId === component.componentId), expected = oracle.components[i]; assert.ok(old);
    for (const key of ['componentId', 'shellId', 'outerLoopId', 'holeLoopIds', 'supportId', 'areaMM2', 'volumeMM3', 'centroidUV', 'capCentroidMM']) assert.deepEqual(component[key], old[key]);
    bits(component.centroidMM, old.centroidMM); closeMM(component.centroidMM, expected.centroidMM, 'analytic component centroid');
    closeSI(component.massKG, expected.massKG, 'kg', name + '.component mass'); tensorSI(component.inertiaCentroidKgM2, expected.inertiaCentroidKgM2, name + '.component tensor');
    const basis = component.physicalBasis; closeMM(basis.unitX, old.supportD1.du.map(value => value / Math.hypot(...old.supportD1.du)), 'actual native D1 unitX');
    const n = cross(old.supportD1.du, old.supportD1.dv), length = Math.hypot(...n); closeMM(basis.unitNormal, n.map(value => value / length), 'actual native D1 normal');
    closeMM(basis.unitY, cross(basis.unitNormal, basis.unitX), 'physical unitY');
    for (const v of Object.values(basis)) assert.ok(Math.abs(Math.hypot(...v) - 1) <= 1e-7);
    for (const pair of [[basis.unitX, basis.unitY], [basis.unitX, basis.unitNormal], [basis.unitY, basis.unitNormal]]) assert.ok(Math.abs(dot(...pair)) <= 1e-7);
    closeMM(extrusion.translationMM, basis.unitNormal.map(value => value * extrusion.options.distanceMM), 'actual positive normal translation');
    assert.deepEqual(old.supportD1, evaluateSurfaceD1(extrusion.region.support, old.centroidUV[0], old.centroidUV[1]));
    assert.equal(component.loopMoments.length, 1 + old.holeLoopIds.length);
    for (const row of component.loopMoments) {
      const loop = extrusion.region.loops.find(loop => loop.id === row.loopId); assert.ok(loop && [old.outerLoopId, ...old.holeLoopIds].includes(row.loopId));
      assert.equal(row.role, loop.role); assert.equal(row.orientation, loop.orientation); assert.deepEqual(row.vertexIds, loop.vertexIds);
      assert.ok(row.role === 'outer' ? row.signedDoubleAreaMM2 > row.areaThresholdMM2 : row.signedDoubleAreaMM2 < -row.areaThresholdMM2);
      assert.equal(row.coordinatesMM.length, loop.vertexIds.length);
    }
    const evidence = component.covarianceEvidence, secondMoment = component.planarSecondMomentMM4;
    assert.ok(secondMoment.xx > evidence.diagonalThresholdsMM4[0] && secondMoment.yy > evidence.diagonalThresholdsMM4[1]);
    assert.ok(evidence.determinantMM8 > evidence.determinantThresholdMM8);
    assert.ok(component.areaEvidence.areaDifferenceMM2 <= component.areaEvidence.areaComparisonToleranceMM2);
    assert.ok(component.areaEvidence.areaMM2 > component.areaEvidence.cancellationThresholdMM2);
    const bindings = component.pointBindings; assert.equal(new Set(bindings.map(binding => binding.vertexId)).size, bindings.length);
    for (const binding of bindings) {
      const observation = result.boundaryObservations.find(row => row.vertexId === binding.vertexId); assert.ok(observation);
      assert.deepEqual(binding.observedPointMM, observation.pointMM);
      const du = observation.uv[0] - component.centroidUV[0], dv = observation.uv[1] - component.centroidUV[1];
      closeMM(binding.deltaMM, old.supportD1.du.map((value, axis) => value * du + old.supportD1.dv[axis] * dv), 'native D1 centered physical delta');
      closeMM(binding.calculatedPointMM, component.capCentroidMM.map((value, axis) => value + binding.deltaMM[axis]), 'calculated centroid plus delta');
      closeMM(binding.calculatedPointMM, observation.pointMM, 'actual boundary D0 versus calculated centered delta'); assert.ok(binding.pointDifferenceMM <= 1e-7);
      assert.deepEqual(binding.coordinatesMM, [dot(binding.deltaMM, basis.unitX), dot(binding.deltaMM, basis.unitY)]);
    }
    for (const tensor of [component.worldAreaSecondMomentMM4, component.volumeSecondMomentMM5]) {
      assert.equal(tensor.length, 3); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        assert.ok(Number.isFinite(tensor[r][c])); assert.ok(Object.is(tensor[r][c], tensor[c][r]));
      }
    }
  }
  assert.deepEqual(validate(result), report); const saved = jsonFile(name + '.owned-mass', result);
  for (const [i, source] of authored.reopened.extrusion.sources.entries()) {
    const cold = compileCadModel(readFileSync(authored.reopened.sourceFiles[i], 'utf8'), {sourceVersion: 0}); assert.equal(cold.ok, true); assert.deepEqual(cold.model, source.model);
  }
  assert.deepEqual(estimate(authored.reopened.extrusion, authored.reopened.options), saved.reopened); assert.deepEqual(validate(saved.reopened), report);
  accepted.push({extrusion, customOptions, before, result, resultBefore: structuredClone(result)});
  cases.push({name, densityKgPerM3: density, componentCount: report.componentCount, massKG: report.massKG, massError,
    centroidMM: report.centroidMM, inertiaCentroidKgM2: report.inertiaCentroidKgM2, newSurfacePointCalls: report.surfacePointEvaluationCount,
    parentSurfaceD1Calls: report.parentSurfaceD1EvaluationCount, authoredFile: authored.file, resultFile: saved.file}); return result;
}
function boxOracle(density, rotated = false) {
  const massKG = 6000 * density / 1e9, tensor = diagonal((rotated ? [2.5e-7, 5e-7, 6.5e-7] : [6.5e-7, 5e-7, 2.5e-7]).map(value => value * density / 1000));
  const centroidMM = rotated ? [115, -40, 15] : [5, 10, 15];
  return {massKG, centroidMM, inertiaCentroidKgM2: tensor, components: [{massKG, centroidMM: [...centroidMM], inertiaCentroidKgM2: tensor.map(row => [...row])}]};
}
const box1000 = check('box_rho1000', box, 1000, boxOracle(1000));
const box2000 = check('box_rho2000', box, 2000, boxOracle(2000));
bits(box1000.report.centroidMM, box2000.report.centroidMM); closeSI(box2000.report.massKG, 2 * box1000.report.massKG, 'kg', 'density scales mass');
tensorSI(box2000.report.inertiaCentroidKgM2, scale(box1000.report.inertiaCentroidKgM2, 2), 'density scales tensor');
check('rotated_translated_box', rotatedBox, 1000, boxOracle(1000, true));
const offcenterMass = 64 * Math.SQRT2 * 1000 / 1e9, offcenterCenter = translatedCenter([31 / 16, 111 / 16]);
const offcenterCovariance = uvCovarianceWorld([[2533 / 768, -9 / 256], [-9 / 256, 2533 / 768]], tiltedU, tiltedV, tiltedNormal, 2);
const offcenterTensor = covarianceInertia(offcenterCovariance, offcenterMass);
check('tilted_offcenter_hole', offcenter, 1000, {massKG: offcenterMass, centroidMM: offcenterCenter, inertiaCentroidKgM2: offcenterTensor,
  components: [{massKG: offcenterMass, centroidMM: [...offcenterCenter], inertiaCentroidKgM2: offcenterTensor.map(row => [...row])}]});
const componentMass = 18 * Math.SQRT2 * 1000 / 1e9, separatedMass = 2 * componentMass, separatedCenter = translatedCenter([2, 7]);
const componentCovariance = uvCovarianceWorld([[3 / 16, 0], [0, 3]], tiltedU, tiltedV, tiltedNormal, 2);
const componentTensor = covarianceInertia(componentCovariance, componentMass), separatedCovariance = uvCovarianceWorld([[7 / 4, 0], [0, 3]], tiltedU, tiltedV, tiltedNormal, 2);
const separatedTensor = covarianceInertia(separatedCovariance, separatedMass);
const separatedResult = check('separated_parallel_axis', separated, 1000, {massKG: separatedMass, centroidMM: separatedCenter, inertiaCentroidKgM2: separatedTensor,
  components: [.75, 3.25].map(u => ({massKG: componentMass, centroidMM: translatedCenter([u, 7]), inertiaCentroidKgM2: componentTensor.map(row => [...row])}))});
const shiftCovariance = outer([1.25, 0, 1.25]), parallelAxis = covarianceInertia(shiftCovariance, componentMass);
tensorSI(separatedResult.report.inertiaCentroidKgM2, scale(add(componentTensor, parallelAxis), 2), 'independent separate-component parallel-axis theorem');
check('empty_material', empty, 1000, {massKG: 0, centroidMM: null, inertiaCentroidKgM2: null, components: []},
  {densityKgPerM3: 1000, maximumBoundarySegments: 0, maximumSurfaceEvaluations: 0, maximumSurfacePointEvaluations: 0});
jsonFile('authentic-inputs', inputProvenance);

function intact() {
  for (const input of nativeInputs) assert.deepEqual(input.extrusion, input.before);
  for (const row of accepted) { assert.deepEqual({extrusion: row.extrusion, customOptions: row.customOptions}, row.before); assert.deepEqual(row.result, row.resultBefore); }
  for (const [file, bytes] of retainedFiles) assert.deepEqual(readFileSync(file), bytes, file);
}
function reject(name, action, code, causeRequired = false) {
  assert.throws(action, error => {
    assert.ok(error instanceof CoplanarFaceBooleanExtrusionMassError); assert.equal(error.name, 'CoplanarFaceBooleanExtrusionMassError'); assert.equal(error.code, code); assert.ok(error.message.length <= 1024);
    if (causeRequired) assert.ok(error.cause instanceof Error);
    failures.push({name, code: error.code, message: error.message, causeName: error.cause?.name ?? null, causeCode: error.cause?.code ?? null, causeMessage: error.cause?.message ?? null}); intact(); return true;
  });
}
for (const [name, density] of [['zero', 0], ['negative', -1], ['nonfinite', Infinity], ['nan', NaN], ['excess', 1000001]]) {
  reject('density_' + name, () => estimate(box.extrusion, options(density)), 'INPUT');
}
reject('empty_still_requires_density', () => estimate(empty.extrusion, {...options(0), maximumBoundarySegments: 0, maximumSurfaceEvaluations: 0, maximumSurfacePointEvaluations: 0}), 'INPUT');
reject('density_represented_underflow', () => estimate(box.extrusion, options(Number.MIN_VALUE)), 'REPRESENTABILITY');
reject('boundary_budget', () => estimate(box.extrusion, {...options(1000), maximumBoundarySegments: 3}), 'NATIVE', true);
assert.equal(failures.at(-1).causeCode, 'BUDGET');
reject('support_d1_budget', () => estimate(separated.extrusion, {...options(1000), maximumSurfaceEvaluations: 1}), 'NATIVE', true);
assert.equal(failures.at(-1).causeCode, 'BUDGET');
reject('canonical_surface_point_budget', () => estimate(offcenter.extrusion, {...options(1000), maximumSurfacePointEvaluations: 7}), 'BUDGET');
reject('point_budget_range', () => estimate(box.extrusion, {...options(1000), maximumSurfacePointEvaluations: 65}), 'BUDGET');
let getterCalls = 0;
const getter = {...options(1000)}; Object.defineProperty(getter, 'densityKgPerM3', {enumerable: true, get() { getterCalls++; return 1000; }});
reject('options_getter', () => estimate(box.extrusion, getter), 'INPUT');
const nestedGetter = structuredClone(box.extrusion); Object.defineProperty(nestedGetter.region, 'components', {enumerable: true, get() { getterCalls++; return []; }});
reject('parent_getter', () => estimate(nestedGetter, options(1000)), 'INPUT'); assert.equal(getterCalls, 0);
const cycle = {...options(1000)}; cycle.densityKgPerM3 = cycle;
reject('cyclic_options', () => estimate(box.extrusion, cycle), 'INPUT');
reject('malformed_options', () => estimate(box.extrusion, {...options(1000), material: 'invented'}), 'INPUT');
const tamperedParent = structuredClone(box.extrusion); tamperedParent.sources[0].source += ' ';
reject('actual_parent_source_refusal', () => estimate(tamperedParent, options(1000)), 'NATIVE', true);
assert.equal(failures.at(-1).causeCode, 'INPUT');
for (const [name, alter] of [
  ['mass', result => { result.report.massKG += .001; }], ['centroid', result => { result.report.centroidMM[0] += .1; }],
  ['tensor', result => { result.components[0].inertiaCentroidKgM2[0][1] += 1e-8; }], ['loop', result => { result.components[0].loopMoments[0].loopId = 'wrong_loop'; }],
  ['work', result => { result.report.surfacePointEvaluationCount++; }], ['units', result => { result.report.units.inertia = 'kg*mm2'; }],
  ['source', result => { result.properties.extrusion.sources[0].source += ' '; }], ['boundary', result => { result.boundaryObservations[0].pointMM[0] += .1; }],
]) { const changed = structuredClone(box1000); alter(changed); reject('owned_' + name, () => validate(changed), 'OWNED'); }
const ownedGetter = structuredClone(box1000); Object.defineProperty(ownedGetter, 'components', {enumerable: true, get() { getterCalls++; return []; }});
reject('owned_getter', () => validate(ownedGetter), 'OWNED'); assert.equal(getterCalls, 0);
let replacement = box1000; const previous = replacement;
reject('atomic_previous_result', () => { replacement = estimate(box.extrusion, options(Number.MIN_VALUE)); }, 'REPRESENTABILITY');
assert.strictEqual(replacement, previous); jsonFile('atomic-retention', {previousResultUnchanged: replacement === previous, getterCalls});

const packageRoot = resolve(repo, 'packages/barocss-cad'), manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')), declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath)); const publicAPI = await import(pathToFileURL(runtimePath).href);
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.CoplanarFaceBooleanExtrusionMassDiagnosticCode, CoplanarFaceBooleanExtrusionMassDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./planar-solids/coplanar-face-boolean-extrusion-mass.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/planar-solids/coplanar-face-boolean-extrusion-mass.d.ts'), leafDeclaration = readFileSync(leafDeclarationPath, 'utf8');
for (const name of [...runtimeNames, ...typeNames]) assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(leafDeclaration), name);
for (const row of cases) {
  const authored = JSON.parse(readFileSync(row.authoredFile, 'utf8')), saved = JSON.parse(readFileSync(row.resultFile, 'utf8'));
  for (const [i, source] of authored.extrusion.sources.entries()) {
    const cold = publicAPI.compileCadModel(readFileSync(authored.sourceFiles[i], 'utf8'), {sourceVersion: 0}); assert.equal(cold.ok, true); assert.deepEqual(cold.model, source.model);
  }
  assert.deepEqual(publicAPI.estimateCoplanarFaceBooleanExtrusionMass(authored.extrusion, authored.options), saved);
  assert.deepEqual(publicAPI.validateCoplanarFaceBooleanExtrusionMass(saved), saved.report);
}
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 8, caseCount: cases.length,
  declarationCheck: 'actual built declarations and API consumption; no separate TypeScript invocation'};
jsonFile('compiled-consumer', compiledConsumer); intact();
const summary = {sourceMode: true, cadSourceInputCount: cadInputs.length, inputProvenance, cases, failures, compiledConsumer,
  caseCount: cases.length, refusalCount: failures.length, getterCalls, tolerance: {mass: '1e-8*max(abs(expected),1e-12kg)',
    inertia: '1e-8*max(abs(expected),1e-15kg*m2)', centroidAndBindingMM: 1e-7},
  independentReferences: ['10x20x30 box', 'density linearity', 'proper90Y rotation and authored translation', 'UV covariance of outer minus offcenter hole', 'separated-component covariance and full parallel-axis tensor'],
  scope: 'Uniform declared density construction estimate using actual canonical trim and positive normal sweep; no certified Solid/material or application physics acceptance.'};
jsonFile('summary', summary); intact(); console.log(JSON.stringify(summary));
