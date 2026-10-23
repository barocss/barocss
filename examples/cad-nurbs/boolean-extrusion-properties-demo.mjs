import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 4,
  'Usage: node boolean-extrusion-properties-demo.mjs --source <output-directory> --extrusion-directory <saved-extrusion-directory>');
assert.equal(args[0], '--source');
assert.equal(args[2], '--extrusion-directory');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const output = resolve(args[1]);
const extrusionDirectory = resolve(args[3]);
mkdirSync(output, {recursive: true});

// Exact current source graph; compiled JS is a separate consumer at the end.
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const esbuild = require('esbuild');
const entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const built = await esbuild.build({
  absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node',
  format: 'esm', write: false, target: 'es2022', metafile: true,
});
assert.equal(built.outputFiles.length, 1);
const sourceInputs = Object.keys(built.metafile.inputs).map(path => resolve(repo, path));
const cadInputs = sourceInputs.filter(path => path.includes('/packages/barocss-cad/'));
assert.ok(cadInputs.includes(entry));
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/planar-solids/coplanar-face-boolean-extrusion-properties.ts')));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' +
  Buffer.from(built.outputFiles[0].text).toString('base64'));
const {
  measureCoplanarFaceBooleanExtrusion: measure, validateCoplanarFaceBooleanExtrusionProperties: validate,
  CoplanarFaceBooleanExtrusionPropertiesError, CoplanarFaceBooleanExtrusionPropertiesDiagnosticCode,
  validateCoplanarFaceBooleanExtrusion: validateExtrusion, buildConvexPlanarFace: buildFace,
  booleanCoplanarFaces: boolean, extrudeCoplanarFaceBoolean: extrude,
  evaluateSurfaceD1, compileCadModel,
} = api;
for (const operation of [measure, validate, validateExtrusion, buildFace, boolean, extrude]) assert.equal(typeof operation, 'function');
assert.deepEqual(Object.keys(CoplanarFaceBooleanExtrusionPropertiesDiagnosticCode).sort(),
  ['INPUT', 'BUDGET', 'NATIVE', 'REPRESENTABILITY', 'OWNED'].sort());
const options = {maximumBoundarySegments: 64, maximumSurfaceEvaluations: 8};

const summaries = [], failures = [], retainedFiles = new Map();
const difference = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));

// Preserve authored geometry and placement signs through every JSON round trip.
function nativeJSON(value) {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value));
    return Object.is(value, -0) ? '-0' : JSON.stringify(value);
  }
  if (value === null || ['string', 'boolean'].includes(typeof value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) =>
    JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}';
}

function ownedFile(name, value) {
  const file = resolve(output, name + '.json');
  writeFileSync(file, nativeJSON(value) + '\n');
  retainedFiles.set(file, readFileSync(file));
  const reopened = JSON.parse(readFileSync(file, 'utf8'));
  assert.deepEqual(reopened, value);
  return {file, reopened};
}

function sourceFile(name, source, expectedModel) {
  const file = resolve(output, name + '.source0.css');
  writeFileSync(file, source);
  retainedFiles.set(file, readFileSync(file));
  const compiled = compileCadModel(readFileSync(file, 'utf8'), {sourceVersion: 0});
  assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
  if (expectedModel) assert.deepEqual(compiled.model, expectedModel);
  return {file, source: readFileSync(file, 'utf8'), model: compiled.model};
}

function checkOwnership(inputs, result) {
  const caller = new WeakSet();
  const collect = value => {
    if (value && typeof value === 'object' && !caller.has(value)) {
      caller.add(value);
      for (const child of Object.values(value)) collect(child);
    }
  };
  for (const input of inputs) collect(input);
  const seen = new WeakSet();
  const visit = value => {
    if (value && typeof value === 'object') {
      assert.ok(!caller.has(value), 'Properties result aliases caller data');
      assert.ok(!seen.has(value), 'Repeated nested output object occurrence');
      seen.add(value);
      for (const child of Object.values(value)) visit(child);
    }
  };
  visit(result);
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const world = ([u, v]) => [u + .5 * v - 7.5, v - 11, u + .5 * v - 7.5];
const shifted = (point, vector) => point.map((value, axis) => value + vector[axis]);
const normal = [-1 / Math.SQRT2, 0, 1 / Math.SQRT2];
const accepted = [], nativeInputs = [], inputProvenance = [], meshEvidence = [];
function closeNumber(actual, expected, scale = 1) { assert.ok(Math.abs(actual - expected) <= 1e-7 * Math.max(1, scale), `${actual} differs from ${expected}`); }
function check(name, extrusion, expectedAreaUV, expectedUV) {
  const before = structuredClone(extrusion), inputOptions = extrusion.region.components.length ? options : {maximumBoundarySegments: 0, maximumSurfaceEvaluations: 0};
  const result = measure(extrusion, inputOptions); checkOwnership([extrusion, inputOptions], result);
  assert.deepEqual(Object.keys(result).sort(), ['extrusion', 'options', 'components', 'report'].sort());
  assert.deepEqual(result.extrusion, extrusion); assert.deepEqual(result.options, inputOptions);
  assert.equal(result.components.length, extrusion.region.components.length);
  const expectedArea = expectedAreaUV * Math.SQRT2, expectedVolume = expectedArea * extrusion.options.distanceMM;
  closeNumber(result.report.areaMM2, expectedArea, expectedArea); closeNumber(result.report.volumeMM3, expectedVolume, expectedVolume);
  const componentExpectations = [...expectedUV].sort((a, b) => a.centroidUV[0] - b.centroidUV[0]);
  const components = [...result.components].sort((a, b) => a.centroidUV[0] - b.centroidUV[0]);
  for (const [index, component] of components.entries()) {
    const expected = componentExpectations[index]; assert.ok(expected);
    const native = extrusion.region.components.find(native => native.id === component.componentId);
    const shell = extrusion.shells.find(shell => shell.id === component.shellId);
    assert.ok(native && shell && shell.componentId === native.id);
    assert.equal(component.supportId, extrusion.region.support.id);
    assert.equal(component.outerLoopId, native.outerLoopId); assert.deepEqual(component.holeLoopIds, native.holeLoopIds);
    closeNumber(component.areaUV, expected.areaUV, expected.areaUV);
    assert.ok(difference(component.centroidUV, expected.centroidUV) <= 1e-7);
    const d1 = evaluateSurfaceD1(extrusion.region.support, ...component.centroidUV);
    assert.deepEqual(component.supportD1, d1); assert.deepEqual(component.capCentroidMM, d1.point);
    const jacobian = Math.hypot(...cross(d1.du, d1.dv)); closeNumber(jacobian, Math.SQRT2);
    assert.equal(component.areaMM2, component.areaUV * jacobian);
    assert.equal(component.volumeMM3, component.areaMM2 * extrusion.options.distanceMM);
    assert.deepEqual(component.centroidMM, shifted(component.capCentroidMM, extrusion.translationMM.map(value => value / 2)));
    const analyticCenter = shifted(world(expected.centroidUV), normal.map(value => value * extrusion.options.distanceMM / 2));
    assert.ok(difference(component.centroidMM, analyticCenter) <= 1e-7);
    assert.ok(component.areaDifferenceUV <= component.areaComparisonToleranceUV);
    assert.ok(component.signedDoubleAreaUV > component.areaCancellationThresholdUV);
    assert.equal(component.loopMoments.length, 1 + native.holeLoopIds.length);
    const outer = component.loopMoments.find(loop => loop.role === 'outer'); assert.ok(outer && outer.signedDoubleAreaUV > 0);
    assert.ok(component.loopMoments.filter(loop => loop.role === 'hole').every(loop => loop.signedDoubleAreaUV < 0));
  }
  const report = result.report;
  assert.equal(report.schema, 'barocss-native-coplanar-face-boolean-extrusion-properties'); assert.equal(report.version, 0);
  assert.equal(report.evaluationId, extrusion.options.evaluationId); assert.equal(report.distanceMM, extrusion.options.distanceMM);
  assert.equal(report.lengthUnit, 'mm'); assert.equal(report.areaUnit, 'mm2'); assert.equal(report.volumeUnit, 'mm3');
  assert.equal(report.sourceFrame, 'authored-xyz-no-axis-conversion'); assert.equal(report.empty, expectedAreaUV === 0);
  assert.equal(report.componentCount, result.components.length); assert.equal(report.shellCount, extrusion.shells.length);
  assert.equal(report.holeCount, extrusion.region.loops.filter(loop => loop.role === 'hole').length);
  assert.equal(report.boundarySegmentCount, extrusion.region.fragments.length);
  assert.equal(report.surfaceD1EvaluationCount, result.components.length);
  assert.equal(report.quality.centroidIsInteriorWitness, false); assert.equal(report.quality.massCertified, false); assert.equal(report.quality.inertiaCertified, false);
  assert.equal(report.topologyCertified, false); assert.equal(report.solid, false);
  if (!expectedAreaUV) {
    assert.equal(report.areaMM2, 0); assert.equal(report.volumeMM3, 0); assert.equal(report.centroidMM, null);
    assert.deepEqual(result.components, []); assert.equal(report.surfaceD1EvaluationCount, 0);
  } else {
    const centerUV = [0, 1].map(axis => expectedUV.reduce((sum, component) => sum + component.areaUV * component.centroidUV[axis], 0) / expectedAreaUV);
    const expectedCenter = shifted(world(centerUV), normal.map(value => value * extrusion.options.distanceMM / 2));
    assert.ok(difference(report.centroidMM, expectedCenter) <= 1e-7);
    const weighted = [0, 1, 2].map(axis => result.components.reduce((sum, component) => sum + component.volumeMM3 * component.centroidMM[axis], 0) / report.volumeMM3);
    assert.ok(difference(report.centroidMM, weighted) <= 1e-7);
  }
  assert.deepEqual(report.inheritedBindingResiduals, {maximumPointDifferenceMM: extrusion.report.maximumPointDifferenceMM,
    maximumEndpointDifferenceMM: extrusion.report.maximumEndpointDifferenceMM});
  assert.deepEqual(validate(result), report);
  const stored = ownedFile(name + '.owned-properties', result); assert.deepEqual(validate(stored.reopened), report);
  assert.deepEqual(extrusion, before); accepted.push({result, before: structuredClone(result), file: stored.file});
  summaries.push({name, distanceMM: extrusion.options.distanceMM, componentCount: components.length, boundarySegments: report.boundarySegmentCount,
    expectedAreaUV, areaMM2: report.areaMM2, volumeMM3: report.volumeMM3, centroidMM: report.centroidMM,
    newSurfaceD1Calls: report.surfaceD1EvaluationCount, resultFile: stored.file});
  return result;
}
function compareExistingMesh(name, properties) {
  const file = resolve('/Users/user/.barocss-ai/v3/evidence-896-cad/demo-output', name + '.owned-extrusion-mesh.json');
  if (!existsSync(file)) { meshEvidence.push({name, available: false}); return; }
  const bytes = readFileSync(file); retainedFiles.set(file, bytes);
  const saved = JSON.parse(bytes.toString('utf8'));
  assert.deepEqual(saved.extrusion, properties.extrusion);
  let area = 0, firstMoment = [0, 0, 0];
  for (const range of saved.faceRanges.filter(range => range.kind === 'bottom-cap')) for (const triangle of range.triangles) {
    const p = triangle.vertexIndices.map(index => saved.mesh.positionsMM.slice(3 * index, 3 * index + 3));
    const ab = p[1].map((value, axis) => value - p[0][axis]), ac = p[2].map((value, axis) => value - p[0][axis]);
    const triangleArea = Math.hypot(...cross(ab, ac)) / 2;
    const center = [0, 1, 2].map(axis => (p[0][axis] + p[1][axis] + p[2][axis]) / 3);
    area += triangleArea; firstMoment = firstMoment.map((value, axis) => value + triangleArea * center[axis]);
  }
  closeNumber(area, properties.report.areaMM2, area);
  const capCentroid = area ? firstMoment.map(value => value / area) : null;
  if (area) assert.ok(difference(shifted(capCentroid, properties.extrusion.translationMM.map(value => value / 2)), properties.report.centroidMM) <= 1e-7);
  else assert.equal(properties.report.centroidMM, null);
  meshEvidence.push({name, file, available: true, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
    areaMM2: area, bottomCapCentroidMM: capCentroid, authority: 'independent-saved-bottom-cap-triangles-not-measurement-input'});
}
ownedFile('source-api.metafile', built.metafile);
ownedFile('source-api.inputs', {entry, mode: 'in-memory-esbuild', write: false, cadInputs, allInputs: sourceInputs, esbuildVersion: esbuild.version});
const definitions = [
  ['cross_union', 24, [{areaUV: 24, centroidUV: [31 / 12, 41 / 6]}]],
  ['containment_hole', 32, [{areaUV: 32, centroidUV: [2, 7]}]],
  ['strip_two_components', 18, [{areaUV: 9, centroidUV: [.75, 7]}, {areaUV: 9, centroidUV: [3.25, 7]}]],
  ['octagons_two_chunks', 7, [{areaUV: 3.5, centroidUV: [-.5, 5]}, {areaUV: 3.5, centroidUV: [3.5, 5]}]],
  ['reverse_containment_empty', 0, []],
  ['cross_union_distance_edit', 24, [{areaUV: 24, centroidUV: [31 / 12, 41 / 6]}]],
];
const metadataFile = resolve(extrusionDirectory, 'summary.json'), metadataBytes = readFileSync(metadataFile);
retainedFiles.set(metadataFile, metadataBytes);
const metadata = JSON.parse(metadataBytes.toString('utf8'));
inputProvenance.push({name: 'extrusion_summary_metadata', file: metadataFile, bytes: metadataBytes.length,
  sha256: createHash('sha256').update(metadataBytes).digest('hex')});
const outputs = new Map();
for (const [name, area, centers] of definitions) {
  const file = resolve(extrusionDirectory, name + '.owned-extrusion.json'), bytes = readFileSync(file);
  retainedFiles.set(file, bytes); inputProvenance.push({name, file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')});
  const extrusion = JSON.parse(bytes.toString('utf8')); assert.deepEqual(validateExtrusion(extrusion), extrusion.report);
  const declaredCases = metadata.summaries.filter(row => row.name === name); assert.equal(declaredCases.length, 1);
  const declaredCase = declaredCases[0];
  assert.equal(resolve(declaredCase.resultFile), file);
  assert.equal(declaredCase.distanceMM, extrusion.options.distanceMM);
  assert.equal(declaredCase.shellCount, extrusion.shells.length);
  assert.equal(declaredCase.sourceChunkCount, extrusion.sources.length);
  assert.deepEqual(declaredCase.sourceFiles.map(path => resolve(path)), extrusion.sources.map((_, index) =>
    resolve(extrusionDirectory, name + '.world_chunk_' + index + '.source0.css')));
  nativeInputs.push({extrusion, before: structuredClone(extrusion)});
  for (const [index, source] of extrusion.sources.entries()) {
    const originalFile = resolve(extrusionDirectory, name + '.world_chunk_' + index + '.source0.css'), originalBytes = readFileSync(originalFile);
    assert.equal(originalBytes.toString('utf8'), source.source); retainedFiles.set(originalFile, originalBytes);
    inputProvenance.push({name: name + '.source_' + index, file: originalFile, bytes: originalBytes.length, sha256: createHash('sha256').update(originalBytes).digest('hex')});
    sourceFile(name + '.world_chunk_' + index, source.source, source.model);
  }
  const result = check(name, extrusion, area, centers); outputs.set(name, result); compareExistingMesh(name, result);
}
ownedFile('authentic-inputs', inputProvenance); ownedFile('independent-saved-cap-mesh-evidence', meshEvidence);
const union = outputs.get('cross_union'), edited = outputs.get('cross_union_distance_edit');
closeNumber(edited.report.volumeMM3 / union.report.volumeMM3, 1.5);
assert.ok(difference(deltaPoint(edited.report.centroidMM, union.report.centroidMM), union.extrusion.normal.map(value => value / 2)) <= 1e-7);
function deltaPoint(a, b) { return a.map((value, axis) => value - b[axis]); }

const concentric = outputs.get('containment_hole').extrusion;
const inputB = concentric.region.faceB, inputBOriginal = structuredClone(inputB);
const d1 = evaluateSurfaceD1(inputB.plane, 2, 7);
const holeShift = d1.du.map((value, axis) => value * .5 + d1.dv[axis] * .5);
assert.ok(difference(holeShift, [.75, .5, .75]) <= 1e-7);
const shiftedLoop = structuredClone(inputB.loop);
for (const edge of shiftedLoop.edges) edge.controlPoints = edge.controlPoints.map(point => shifted(point, holeShift));
const shiftedFace = buildFace(inputB.plane, shiftedLoop, inputB.options); assert.deepEqual(inputB, inputBOriginal);
sourceFile('offcenter_hole.original_b', shiftedFace.source, shiftedFace.model);
const offcenterRegion = boolean(concentric.region.faceA, shiftedFace, {operation: 'difference', evaluationId: 'properties_hole_boolean',
  resultIdPrefix: 'hole_prop', maximumPairTests: 64, maximumFragments: 64});
for (const [index, source] of offcenterRegion.sources.entries()) sourceFile('offcenter_hole.region_chunk_' + index, source.source, source.model);
const offcenterExtrusion = extrude(offcenterRegion, {evaluationId: 'properties_hole_extrusion', resultIdPrefix: 'hp_ext', distanceMM: 2,
  maximumVertices: 128, maximumFaces: 80, maximumSourceChunks: 17, maximumBindingSamples: 1152});
assert.equal(offcenterExtrusion.region.report.holeCount, 1);
for (const [index, source] of offcenterExtrusion.sources.entries()) sourceFile('offcenter_hole.world_chunk_' + index, source.source, source.model);
const offcenterOwned = ownedFile('offcenter_hole.owned-extrusion', offcenterExtrusion);
assert.deepEqual(validateExtrusion(offcenterOwned.reopened), offcenterExtrusion.report);
nativeInputs.push({extrusion: offcenterExtrusion, before: structuredClone(offcenterExtrusion)});
const offcenter = check('offcenter_hole_properties', offcenterExtrusion, 32, [{areaUV: 32, centroidUV: [1.9375, 6.9375]}]);
assert.ok(difference(offcenter.components[0].centroidUV, [2, 7]) > .01);

function intact() {
  for (const input of nativeInputs) assert.deepEqual(input.extrusion, input.before);
  for (const item of accepted) assert.deepEqual(item.result, item.before);
  for (const [file, bytes] of retainedFiles) assert.deepEqual(readFileSync(file), bytes, file);
  assert.deepEqual(inputB, inputBOriginal);
}
function reject(name, action, code) {
  assert.throws(action, error => {
    assert.ok(error instanceof CoplanarFaceBooleanExtrusionPropertiesError);
    assert.equal(error.name, 'CoplanarFaceBooleanExtrusionPropertiesError');
    assert.equal(error.code, code);
    assert.ok(Object.values(CoplanarFaceBooleanExtrusionPropertiesDiagnosticCode).includes(error.code));
    assert.ok(error.message.startsWith('Coplanar Face Boolean Extrusion Properties: '));
    failures.push({name, code: error.code, message: error.message, actualCausePreserved: Object.hasOwn(error, 'cause')});
    intact(); return true;
  });
}
reject('boundary_budget', () => measure(union.extrusion, {...options, maximumBoundarySegments: 0}), 'BUDGET');
reject('component_sample_budget', () => measure(outputs.get('strip_two_components').extrusion,
  {...options, maximumSurfaceEvaluations: 1}), 'BUDGET');
reject('out_of_range_budget', () => measure(union.extrusion, {...options, maximumSurfaceEvaluations: 9}), 'BUDGET');
let getterCalls = 0;
const getter = {...options};
Object.defineProperty(getter, 'maximumBoundarySegments', {enumerable: true, get() { getterCalls++; return 64; }});
reject('input_getter', () => measure(union.extrusion, getter), 'INPUT'); assert.equal(getterCalls, 0);
const ownedGetter = structuredClone(union);
Object.defineProperty(ownedGetter, 'components', {enumerable: true, get() { getterCalls++; return union.components; }});
reject('owned_getter', () => validate(ownedGetter), 'OWNED'); assert.equal(getterCalls, 0);
const alteredSource = structuredClone(union.extrusion); alteredSource.sources[0].source += ' ';
reject('altered_native_parent_source', () => measure(alteredSource, options), 'INPUT');
const alteredCoefficient = structuredClone(union.extrusion);
alteredCoefficient.faces[0].surface.controlPoints[0][0][0] += .25;
reject('altered_native_parent_coefficient', () => measure(alteredCoefficient, options), 'INPUT');
for (const [name, alter] of [
  ['source', result => result.extrusion.sources[0].source += ' '],
  ['coefficient', result => result.extrusion.faces[0].surface.controlPoints[0][0][0] += .25],
  ['centroid', result => result.report.centroidMM[0] += .1],
  ['trim_centroid', result => result.components[0].centroidUV[0] += .1],
  ['volume', result => result.report.volumeMM3 += 1],
  ['identity', result => result.report.evaluationId = 'unrelated_evaluation'],
  ['support_derivative', result => result.components[0].supportD1.du[0] += .1],
  ['first_moment', result => result.components[0].shiftedFirstMomentNumeratorsUV[0] += .1],
  ['work', result => result.report.surfaceD1EvaluationCount++],
  ['frame', result => result.report.sourceFrame = 'y-up'],
]) {
  const changed = structuredClone(union); alter(changed);
  reject('owned_' + name + '_tamper', () => validate(changed), 'OWNED');
}
assert.deepEqual(validate(union), union.report); intact();

const packageRoot = resolve(repo, 'packages/barocss-cad');
const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const runtimeNames = ['measureCoplanarFaceBooleanExtrusion', 'validateCoplanarFaceBooleanExtrusionProperties',
  'CoplanarFaceBooleanExtrusionPropertiesError', 'CoplanarFaceBooleanExtrusionPropertiesDiagnosticCode'];
const typeNames = ['CoplanarFaceBooleanExtrusionPropertiesOptions', 'CoplanarFaceBooleanExtrusionPropertiesComponent',
  'CoplanarFaceBooleanExtrusionPropertiesReport', 'CoplanarFaceBooleanExtrusionPropertiesResult'];
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.CoplanarFaceBooleanExtrusionPropertiesDiagnosticCode, CoplanarFaceBooleanExtrusionPropertiesDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./planar-solids/coplanar-face-boolean-extrusion-properties.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/planar-solids/coplanar-face-boolean-extrusion-properties.d.ts');
const declaration = readFileSync(leafDeclarationPath, 'utf8');
for (const name of [...runtimeNames, ...typeNames]) assert.ok(
  new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(declaration), name);
const cold = JSON.parse(readFileSync(resolve(extrusionDirectory, 'cross_union.owned-extrusion.json'), 'utf8'));
const compiled = publicAPI.measureCoplanarFaceBooleanExtrusion(cold, union.options);
assert.deepEqual(compiled, union);
assert.deepEqual(publicAPI.validateCoplanarFaceBooleanExtrusionProperties(compiled), union.report);
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 8,
  declarationCheck: 'actual declaration export text; no separate TypeScript invocation'};
ownedFile('compiled-consumer', compiledConsumer);
const summary = {sourceMode: true, cadSourceInputCount: cadInputs.length, inputProvenance, meshEvidence, summaries, failures,
  compiledConsumer, caseCount: summaries.length, refusalCount: failures.length,
  scope: 'Native canonical trim sweep construction area, volume and homogeneous geometric centroid; local analytic and saved bottom-cap triangle comparisons.',
  geometricValidity: 'not-certified', densityCertified: false, massCertified: false, inertiaCertified: false, solidCertified: false};
ownedFile('summary', summary); intact();
console.log(JSON.stringify(summary));
