import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node extrusion-principal-inertia-demo.mjs --source <output-directory>'); assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]); mkdirSync(output, {recursive: true});
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json')), esbuild = require('esbuild');
const entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundle = await esbuild.build({absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true});
assert.equal(bundle.outputFiles.length, 1);
const sourceInputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path)), cadInputs = sourceInputs.filter(path => path.includes('/packages/barocss-cad/'));
for (const leaf of ['index.ts', 'extrusion-principal-inertia.ts', 'coplanar-face-boolean-extrusion-mass.ts']) assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const {analyzeExtrusionConstructionPrincipalInertia: analyze, validateExtrusionConstructionPrincipalInertia: validate,
  ExtrusionPrincipalInertiaError, ExtrusionPrincipalInertiaDiagnosticCode, estimateCoplanarFaceBooleanExtrusionMass: estimateMass,
  buildConvexPlanarFace: buildFace, booleanCoplanarFaces: boolean, extrudeCoplanarFaceBoolean: extrude, compileCadModel} = api;
const runtimeNames = ['analyzeExtrusionConstructionPrincipalInertia', 'validateExtrusionConstructionPrincipalInertia', 'ExtrusionPrincipalInertiaError', 'ExtrusionPrincipalInertiaDiagnosticCode'];
const typeNames = ['ExtrusionPrincipalInertiaOptions', 'ExtrusionPrincipalInertiaAxis', 'ExtrusionPrincipalInertiaReport', 'ExtrusionPrincipalInertiaResult'];
for (const name of runtimeNames) assert.equal(typeof api[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(Object.keys(ExtrusionPrincipalInertiaDiagnosticCode).sort(), ['INPUT', 'BUDGET', 'NATIVE', 'REPRESENTABILITY', 'OWNED'].sort());
const retainedFiles = new Map(), loadedFiles = new Map(), inputProvenance = [], accepted = [], inputs = [], cases = [], failures = [];
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
function readAuthentic(file) {
  assert.ok(!loadedFiles.has(file), 'Authentic input loaded twice'); const bytes = readFileSync(file); loadedFiles.set(file, bytes); retainedFiles.set(file, bytes);
  inputProvenance.push({file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')}); return bytes;
}
function ownership(callerInputs, result) {
  const caller = new WeakSet(), seen = new WeakSet();
  const collect = value => { if (value && typeof value === 'object' && !caller.has(value)) { caller.add(value); for (const child of Object.values(value)) collect(child); }};
  callerInputs.forEach(collect);
  const visit = value => { if (value && typeof value === 'object') {
    assert.ok(!caller.has(value), 'Caller alias'); assert.ok(!seen.has(value), 'Repeated result matrix, row, axis or trace occurrence'); seen.add(value);
    for (const child of Object.values(value)) visit(child);
  }}; visit(result);
}
function bits(actual, expected) {
  if (typeof expected === 'number') { assert.ok(Object.is(actual, expected), 'Actual mass/centroid/tensor bits changed'); return; }
  assert.deepEqual(actual, expected); if (expected && typeof expected === 'object') for (const key of Object.keys(expected)) bits(actual[key], expected[key]);
}
function momentClose(actual, expected, label) {
  const tolerance = 1e-8 * Math.max(Math.abs(expected), 1e-15), error = Math.abs(actual - expected);
  assert.ok(Number.isFinite(actual) && error <= tolerance, label + ': ' + error + ' > ' + tolerance + ' kg*m2');
}
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const identity = () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const transpose = a => [0, 1, 2].map(i => [0, 1, 2].map(j => a[j][i]));
const multiply = (a, b) => a.map(row => transpose(b).map(column => dot(row, column)));
const distance = (a, b) => Math.hypot(...a.flat().map((value, i) => value - b.flat()[i]));
const offDiagonal = a => Math.hypot(a[0][1], a[0][2], a[1][2]);
const axisLineClose = (a, b, label) => assert.ok(Math.abs(Math.abs(dot(a, b)) - 1) <= 1e-8, label);
const defaults = {maximumRotations: 64, scaledResidualTolerance: 1e-12, degeneracyToleranceRelative: 1e-10};
const savedDirectory = '/Users/user/.barocss-ai/v3/evidence-extrusion-mass-cad/demo-output';
const sourceCache = new Map();
function savedMass(name, sourceStem) {
  const file = resolve(savedDirectory, name + '.owned-mass.json'), mass = JSON.parse(readAuthentic(file).toString('utf8'));
  const sourceFiles = mass.properties.extrusion.sources.map((chunk, index) => {
    const original = resolve(savedDirectory, sourceStem + '_' + index + '.source0.css');
    let bytes = sourceCache.get(original); if (!bytes) { bytes = readAuthentic(original); sourceCache.set(original, bytes); }
    assert.equal(bytes.toString('utf8'), chunk.source); return sourceFile(name + '.original_world_' + index, chunk.source, chunk.model);
  });
  inputs.push({mass, before: structuredClone(mass)}); return {mass, sourceFiles, originalFile: file};
}
const box1000 = savedMass('box_rho1000', 'box.fresh_world_chunk');
const box2000 = savedMass('box_rho2000', 'box.fresh_world_chunk');
const rotated = savedMass('rotated_translated_box', 'rotbox.fresh_world_chunk');
const tilted = savedMass('tilted_offcenter_hole', 'offcenter.authentic_world_chunk');
const separated = savedMass('separated_parallel_axis', 'separated.authentic_world_chunk');
const empty = savedMass('empty_material', 'empty.authentic_world_chunk');
function freshSymmetricBox(name, height) {
  const plane = id => ({kind: 'surface', id, degreeU: 1, degreeV: 1, knotsU: [0, 0, 16, 16], knotsV: [0, 0, 16, 16],
    controlPoints: [[[0, 0, 0], [0, 16, 0]], [[16, 0, 0], [16, 16, 0]]], weights: [[1, 1], [1, 1]]});
  const face = (suffix, corners) => {
    const loop = {id: name + '_' + suffix + '_loop', edges: corners.map(([x, y], i) => ({kind: 'curve', id: name + '_' + suffix + '_line_' + i,
      degree: 1, knots: [-1, -1, 1, 1], controlPoints: [[x, y, 0], [...corners[(i + 1) % corners.length], 0]], weights: [1, 1]}))};
    const result = buildFace(plane(name + '_' + suffix + '_plane'), loop,
      {faceId: name + '_' + suffix + '_face', evaluationId: name + '_' + suffix + '_eval', resultIdPrefix: name + '_' + suffix + '_own', orientation: 'forward'});
    sourceFile(name + '.' + suffix + '.original-face', result.source, result.model); return result;
  };
  const a = face('a', [[0, 0], [10, 0], [10, 10], [0, 10]]), b = face('b', [[12, 2], [14, 2], [14, 4], [12, 4]]);
  const region = boolean(a, b, {operation: 'difference', evaluationId: name + '_boolean', resultIdPrefix: name + '_bool', maximumPairTests: 64, maximumFragments: 64});
  const extrusion = extrude(region, {evaluationId: name + '_extrusion', resultIdPrefix: name + '_ext', distanceMM: height,
    maximumVertices: 128, maximumFaces: 80, maximumSourceChunks: 17, maximumBindingSamples: 1152});
  const mass = estimateMass(extrusion, {densityKgPerM3: 1000, maximumBoundarySegments: 64, maximumSurfaceEvaluations: 8, maximumSurfacePointEvaluations: 64});
  const sourceFiles = extrusion.sources.map((chunk, index) => sourceFile(name + '.fresh_world_' + index, chunk.source, chunk.model));
  jsonFile(name + '.actual-native-mass', mass); inputs.push({mass, before: structuredClone(mass)}); return {mass, sourceFiles};
}
const cube = freshSymmetricBox('cube', 10), axisymmetric = freshSymmetricBox('axisym', 20);
jsonFile('source-api.inputs', {entry, sourceInputs, cadInputs, sourceOnly: true, write: false, esbuildVersion: esbuild.version});
jsonFile('source-api.metafile', bundle.metafile);
function check(name, input, expectedMoments = null, expectedAxisLines = null, expectedClusterIndices = [], options = defaults) {
  const mass = input.mass, before = structuredClone({mass, options}), authored = jsonFile(name + '.authored-request', {mass, options, sourceFiles: input.sourceFiles});
  const result = analyze(mass, options); ownership([mass, options], result); assert.deepEqual({mass, options}, before);
  assert.deepEqual(Object.keys(result).sort(), ['mass', 'options', 'principal', 'report'].sort()); bits(result.mass, mass); assert.deepEqual(result.options, options);
  const report = result.report; assert.equal(report.schema, 'barocss-native-extrusion-principal-inertia'); assert.equal(report.version, 0);
  assert.deepEqual(report.units, {moment: 'kg*m2', centroid: 'mm', direction: 'world-xyz-unit-vector'});
  assert.equal(report.sourceFrame, mass.report.sourceFrame); assert.equal(report.densityKgPerM3, mass.report.densityKgPerM3);
  bits(report.massKG, mass.report.massKG); bits(report.centroidMM, mass.report.centroidMM); assert.deepEqual(report.options, options);
  assert.equal(report.signPolicy, 'first-two-largest-absolute-component-positive-xyz-ties-third-right-handed');
  assert.equal(report.numericPolicy.axisZeroSign, 'positive-zero-only-for-exact-zero-components');
  assert.equal(report.numericPolicy.roundingFactor, 512); assert.equal(report.quality.constructionEstimateOnly, true);
  for (const field of ['densityCertified', 'materialCertified', 'solidCertified', 'globalAccuracyCertified', 'physicalConsumerCertified', 'symmetryCertified']) assert.equal(report.quality[field], false);
  assert.equal(report.parentMassValidationCount, 1); assert.equal(report.empty, mass.report.empty); assert.equal(report.rotationCount, report.rotationTrace.length);
  assert.ok(report.rotationCount <= options.maximumRotations); assert.equal(report.convergence.converged, true);
  assert.equal(report.convergence.toleranceScaled, options.scaledResidualTolerance);
  if (mass.report.empty) {
    assert.equal(result.principal, null); assert.equal(report.axesXYZ, null); assert.equal(report.sortedMomentsKgM2, null); assert.equal(report.residuals, null);
    assert.equal(report.normalizedMatrix, null); assert.equal(report.rotationCount, 0); assert.equal(report.axesUnique, null);
    assert.equal(report.matrixScaleKgM2, 0); assert.equal(report.convergence.offDiagonalNormScaled, 0);
    assert.deepEqual(report.observedDegenerateClusters, []); assert.equal(mass.report.centroidMM, null); assert.equal(mass.report.inertiaCentroidKgM2, null);
  } else {
    assert.deepEqual(Object.keys(result.principal).sort(), ['momentsKgM2', 'axesXYZ'].sort());
    const {momentsKgM2: moments, axesXYZ: axes} = result.principal, original = mass.report.inertiaCentroidKgM2;
    assert.equal(moments.length, 3); assert.equal(axes.length, 3); assert.ok(moments.every(value => Number.isFinite(value) && value > 0));
    assert.ok(moments[0] <= moments[1] && moments[1] <= moments[2]); assert.deepEqual(report.sortedMomentsKgM2, moments); assert.deepEqual(report.axesXYZ, axes);
    const scale = Math.max(...original.flat().map(Math.abs)), normalized = original.map(row => row.map(value => value / scale));
    assert.equal(report.matrixScaleKgM2, scale); assert.deepEqual(report.normalizedMatrix, normalized);
    const columns = axes.map(axis => axis.directionXYZ), V = transpose(columns), D = moments.map((value, i) => moments.map((_, j) => i === j ? value / scale : 0));
    const unitGuard = report.residuals.unitGuard, scaledGuard = report.residuals.scaledGuard;
    for (const [i, axis] of axes.entries()) {
      assert.deepEqual(Object.keys(axis).sort(), ['index', 'directionXYZ', 'momentKgM2'].sort()); assert.equal(axis.index, i); assert.equal(axis.momentKgM2, moments[i]);
      assert.ok(axis.directionXYZ.every(Number.isFinite)); assert.ok(Math.abs(Math.hypot(...axis.directionXYZ) - 1) <= unitGuard);
      for (const value of axis.directionXYZ) if (value === 0) assert.ok(Object.is(value, 0), 'Canonical exact zero sign');
      if (i < 2) {
        let dominant = 0; for (let j = 1; j < 3; j++) if (Math.abs(axis.directionXYZ[j]) > Math.abs(axis.directionXYZ[dominant])) dominant = j;
        assert.ok(axis.directionXYZ[dominant] > 0, 'First two canonical signs');
      }
      if (expectedMoments) momentClose(moments[i], expectedMoments[i], 'independent principal moment');
      if (expectedAxisLines?.[i]) axisLineClose(axis.directionXYZ, expectedAxisLines[i], 'independent authored world axis line');
    }
    const determinant = dot(columns[0], cross(columns[1], columns[2])); assert.ok(determinant > 0 && Math.abs(determinant - 1) <= unitGuard);
    assert.ok(distance(multiply(transpose(V), V), identity()) <= unitGuard);
    assert.ok(distance(multiply(transpose(V), multiply(normalized, V)), D) <= scaledGuard);
    assert.ok(distance(multiply(normalized, V), multiply(V, D)) <= scaledGuard);
    assert.ok(distance(multiply(V, multiply(D, transpose(V))), normalized) <= scaledGuard);
    assert.ok(report.convergence.offDiagonalNormScaled <= options.scaledResidualTolerance);
    for (const field of ['similarityScaled', 'eigensystemScaled', 'reconstructionScaled']) assert.ok(report.residuals[field] <= scaledGuard);
    for (const field of ['orthogonality', 'maximumUnitNorm']) assert.ok(report.residuals[field] <= unitGuard);
    assert.ok(Math.abs(report.residuals.determinant - 1) <= unitGuard);
    const clusters = report.observedDegenerateClusters; assert.deepEqual(clusters.map(cluster => cluster.indices), expectedClusterIndices);
    assert.equal(report.axesUnique, clusters.length === 0);
    for (const cluster of clusters) {
      assert.deepEqual(cluster.momentsKgM2, cluster.indices.map(index => moments[index])); assert.ok(cluster.indices.length >= 2);
      assert.equal(cluster.thresholdKgM2, options.degeneracyToleranceRelative * scale); assert.ok(cluster.maximumAdjacentGapKgM2 <= cluster.thresholdKgM2);
    }
    let previous = normalized, eigenvectors = identity();
    const pairs = [[0, 1], [0, 2], [1, 2]];
    for (const [i, rotation] of report.rotationTrace.entries()) {
      assert.equal(rotation.index, i); assert.deepEqual(rotation.matrixBeforeScaled, previous);
      const pivot = pairs.reduce((best, pair) => Math.abs(previous[pair[0]][pair[1]]) > Math.abs(previous[best[0]][best[1]]) ? pair : best, pairs[0]);
      assert.deepEqual(rotation.pivot, pivot); const [p, q] = pivot;
      assert.equal(rotation.pivotValueScaled, previous[p][q]); assert.deepEqual(rotation.diagonalBeforeScaled, [previous[p][p], previous[q][q]]);
      assert.equal(rotation.thetaRadians, .5 * Math.atan2(2 * previous[p][q], previous[q][q] - previous[p][p]));
      assert.equal(rotation.sine, Math.sin(rotation.thetaRadians)); assert.equal(rotation.cosine, Math.cos(rotation.thetaRadians));
      const R = identity(); R[p][p] = rotation.cosine; R[q][q] = rotation.cosine; R[p][q] = rotation.sine; R[q][p] = -rotation.sine;
      const raw = multiply(transpose(R), multiply(previous, R));
      assert.ok(Math.abs(raw[p][q] - rotation.rawAnnihilationResidualScaled) <= rotation.annihilationGuardScaled);
      assert.ok(Math.abs(rotation.rawAnnihilationResidualScaled) <= rotation.annihilationGuardScaled);
      assert.equal(rotation.matrixAfterScaled[p][q], 0); assert.equal(rotation.matrixAfterScaled[q][p], 0);
      assert.ok(Math.abs(rotation.sine ** 2 + rotation.cosine ** 2 - 1) <= 512 * Number.EPSILON);
      assert.ok(distance(raw, rotation.matrixAfterScaled) <= rotation.similarityGuardScaled);
      assert.ok(rotation.similarityResidualScaled <= rotation.similarityGuardScaled);
      assert.equal(rotation.remainingOffDiagonalNormScaled, offDiagonal(rotation.matrixAfterScaled));
      eigenvectors = multiply(eigenvectors, R); assert.ok(distance(eigenvectors, rotation.eigenvectorsAfter) <= unitGuard);
      assert.ok(distance(multiply(transpose(rotation.eigenvectorsAfter), multiply(normalized, rotation.eigenvectorsAfter)), rotation.matrixAfterScaled) <= rotation.similarityGuardScaled);
      previous = rotation.matrixAfterScaled;
    }
    assert.ok(offDiagonal(previous) <= options.scaledResidualTolerance);
    assert.ok(report.rotationCount > 0 || offDiagonal(normalized) <= options.scaledResidualTolerance);
  }
  assert.deepEqual(validate(result), report); const saved = jsonFile(name + '.owned-principal', result);
  for (const [i, source] of authored.reopened.mass.properties.extrusion.sources.entries()) {
    const cold = compileCadModel(readFileSync(authored.reopened.sourceFiles[i], 'utf8'), {sourceVersion: 0}); assert.equal(cold.ok, true); assert.deepEqual(cold.model, source.model);
  }
  assert.deepEqual(analyze(authored.reopened.mass, authored.reopened.options), saved.reopened); assert.deepEqual(validate(saved.reopened), report);
  accepted.push({mass, options, before, result, resultBefore: structuredClone(result)});
  cases.push({name, principalMomentsKgM2: result.principal?.momentsKgM2 ?? null, rotationCount: report.rotationCount, axesUnique: report.axesUnique,
    observedDegenerateClusters: report.observedDegenerateClusters, authoredFile: authored.file, resultFile: saved.file}); return result;
}
const boxValues = [2.5e-7, 5e-7, 6.5e-7], boxLines = [[0, 0, 1], [0, 1, 0], [1, 0, 0]];
const boxResult = check('box_diagonal_budget0', box1000, boxValues, boxLines, [], {...defaults, maximumRotations: 0});
const densityResult = check('box_density_doubled', box2000, boxValues.map(value => 2 * value), boxLines);
for (let i = 0; i < 3; i++) { momentClose(densityResult.principal.momentsKgM2[i], 2 * boxResult.principal.momentsKgM2[i], 'density doubles principal values');
  axisLineClose(densityResult.principal.axesXYZ[i].directionXYZ, boxResult.principal.axesXYZ[i].directionXYZ, 'density preserves axis lines'); }
check('rotated_world_axis_lines', rotated, boxValues, [[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
const tiltedResult = check('tilted_offcenter_matrix', tilted);
check('separate_components_matrix', separated);
check('cube_triple_cluster', cube, Array(3).fill(1e-3 * 1e-4 / 6), null, [[0, 1, 2]], {...defaults, maximumRotations: 0});
check('axisymmetric_pair_cluster', axisymmetric, [2e-3 * 2e-4 / 12, 2e-3 * 5e-4 / 12, 2e-3 * 5e-4 / 12], [[0, 0, 1], null, null], [[1, 2]]);
check('empty_no_axes_or_rotations', empty, null, null, [], {...defaults, maximumRotations: 0});
jsonFile('authentic-inputs', inputProvenance);
function intact() {
  for (const input of inputs) assert.deepEqual(input.mass, input.before);
  for (const row of accepted) { assert.deepEqual({mass: row.mass, options: row.options}, row.before); assert.deepEqual(row.result, row.resultBefore); }
  for (const [file, bytes] of retainedFiles) assert.deepEqual(readFileSync(file), bytes, file);
}
function reject(name, action, code, causeRequired = false) {
  assert.throws(action, error => {
    assert.ok(error instanceof ExtrusionPrincipalInertiaError); assert.equal(error.name, 'ExtrusionPrincipalInertiaError'); assert.equal(error.code, code); assert.ok(error.message.length <= 1024);
    if (causeRequired) { assert.ok(error.cause instanceof api.CoplanarFaceBooleanExtrusionMassError); assert.equal(error.cause.code, 'OWNED'); }
    failures.push({name, code: error.code, message: error.message, causeName: error.cause?.name ?? null, causeCode: error.cause?.code ?? null}); intact(); return true;
  });
}
reject('offdiagonal_rotation_budget0', () => analyze(tilted.mass, {...defaults, maximumRotations: 0}), 'BUDGET');
reject('rotation_budget_range', () => analyze(box1000.mass, {...defaults, maximumRotations: 65}), 'BUDGET');
reject('rotation_budget_fraction', () => analyze(box1000.mass, {...defaults, maximumRotations: .5}), 'BUDGET');
for (const [field, value] of [['scaledResidualTolerance', 255 * Number.EPSILON], ['scaledResidualTolerance', 1e-7],
  ['degeneracyToleranceRelative', 255 * Number.EPSILON], ['degeneracyToleranceRelative', 1e-5]]) {
  reject(field + '_' + value, () => analyze(box1000.mass, {...defaults, [field]: value}), 'INPUT');
}
reject('nonfinite_tolerance', () => analyze(box1000.mass, {...defaults, scaledResidualTolerance: NaN}), 'INPUT');
reject('malformed_options', () => analyze(box1000.mass, {...defaults, axisMode: 'fabricated'}), 'INPUT');
let getterCalls = 0;
const getter = {...defaults}; Object.defineProperty(getter, 'maximumRotations', {enumerable: true, get() { getterCalls++; return 64; }});
reject('options_getter', () => analyze(box1000.mass, getter), 'INPUT');
const massGetter = structuredClone(box1000.mass); Object.defineProperty(massGetter.report, 'inertiaCentroidKgM2', {enumerable: true, get() { getterCalls++; return []; }});
reject('mass_getter', () => analyze(massGetter, defaults), 'INPUT'); assert.equal(getterCalls, 0);
const alteredSource = structuredClone(box1000.mass); alteredSource.properties.extrusion.sources[0].source += ' ';
reject('actual_mass_source_cause', () => analyze(alteredSource, defaults), 'NATIVE', true);
const alteredTensor = structuredClone(box1000.mass); alteredTensor.report.inertiaCentroidKgM2[0][0] += 1e-8;
reject('actual_mass_tensor_cause', () => analyze(alteredTensor, defaults), 'NATIVE', true);
for (const [name, original, alter] of [
  ['moment', boxResult, result => { result.principal.momentsKgM2[0] += 1e-8; }], ['axis', boxResult, result => { result.principal.axesXYZ[0].directionXYZ[0] += .1; }],
  ['trace', tiltedResult, result => { result.report.rotationTrace[0].thetaRadians += .1; }], ['cluster', boxResult, result => { result.report.observedDegenerateClusters.push({indices: [0, 1], momentsKgM2: [1, 1], maximumAdjacentGapKgM2: 0, thresholdKgM2: 1}); }],
  ['work', boxResult, result => { result.report.rotationCount++; }], ['mass', boxResult, result => { result.mass.report.massKG += .01; }],
]) { const changed = structuredClone(original); alter(changed); reject('owned_' + name, () => validate(changed), 'OWNED'); }
const ownedGetter = structuredClone(boxResult); Object.defineProperty(ownedGetter, 'principal', {enumerable: true, get() { getterCalls++; return null; }});
reject('owned_getter', () => validate(ownedGetter), 'OWNED'); assert.equal(getterCalls, 0);
let replacement = boxResult; const previous = replacement;
reject('atomic_previous_result', () => { replacement = analyze(tilted.mass, {...defaults, maximumRotations: 0}); }, 'BUDGET');
assert.strictEqual(replacement, previous); jsonFile('atomic-retention', {previousResultUnchanged: replacement === previous, getterCalls});
const packageRoot = resolve(repo, 'packages/barocss-cad'), manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')), declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath)); const publicAPI = await import(pathToFileURL(runtimePath).href);
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.ExtrusionPrincipalInertiaDiagnosticCode, ExtrusionPrincipalInertiaDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./extrusion-principal-inertia.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/features/extrusion-principal-inertia.d.ts'), declaration = readFileSync(leafDeclarationPath, 'utf8');
for (const name of [...runtimeNames, ...typeNames]) assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(declaration), name);
for (const row of cases) {
  const authored = JSON.parse(readFileSync(row.authoredFile, 'utf8')), saved = JSON.parse(readFileSync(row.resultFile, 'utf8'));
  for (const [index, source] of authored.mass.properties.extrusion.sources.entries()) {
    const cold = publicAPI.compileCadModel(readFileSync(authored.sourceFiles[index], 'utf8'), {sourceVersion: 0}); assert.equal(cold.ok, true); assert.deepEqual(cold.model, source.model);
  }
  assert.deepEqual(publicAPI.analyzeExtrusionConstructionPrincipalInertia(authored.mass, authored.options), saved);
  assert.deepEqual(publicAPI.validateExtrusionConstructionPrincipalInertia(saved), saved.report);
}
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 8, caseCount: cases.length,
  declarationCheck: 'actual built declarations and API consumption; no separate TypeScript invocation'};
jsonFile('compiled-consumer', compiledConsumer); intact();
const summary = {sourceMode: true, cadSourceInputCount: cadInputs.length, inputProvenance, cases, failures, compiledConsumer,
  caseCount: cases.length, refusalCount: failures.length, getterCalls, principalMomentTolerance: '1e-8*max(abs(expected),1e-15kg*m2)',
  independentControls: ['sorted box moments and authored axis lines', 'proper90Y rotated axis lines', 'density scaling and invariant axis lines',
    'actual normalized-matrix residual and reconstruction', 'independent dense similarity products for every real rotation', 'cube and axisymmetric repeated moments'],
  scope: 'Principal analysis of actual uniform-density canonical construction inertia; no stable persistent axes, certified Solid/material or physics integration.'};
jsonFile('summary', summary); intact(); console.log(JSON.stringify(summary));
