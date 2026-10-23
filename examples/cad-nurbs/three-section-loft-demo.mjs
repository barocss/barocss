import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.filter(arg => arg === '--source').length, 1,
  'Usage: node three-section-loft-demo.mjs --source [output-directory]');
const destinations = args.filter(arg => arg !== '--source');
assert.ok(destinations.length <= 1);
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const output = resolve(destinations[0] ?? '/tmp/barocss-three-section-loft-prototype');
mkdirSync(output, {recursive: true});

// Current source only; the manifest-declared compiled consumer is separate below.
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
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' +
  Buffer.from(built.outputFiles[0].text).toString('base64'));
const {
  buildThreeSectionLoftSurface: build, validateThreeSectionLoftSurface: validate,
  ThreeSectionLoftError, ThreeSectionLoftDiagnosticCode,
  evaluateCurve, evaluateCurveD1, evaluateSurface, evaluateSurfaceD1, curveDomain, surfaceDomain,
  compileCadModel, editCurveControlPolygon, extractSurfaceIsoCurve, tessellateSurface, validatePreviewPacket,
} = api;
for (const operation of [build, validate, ThreeSectionLoftError]) assert.equal(typeof operation, 'function');
assert.deepEqual(Object.keys(ThreeSectionLoftDiagnosticCode).sort(),
  ['INPUT', 'IDENTITY', 'BASIS', 'REPRESENTABILITY', 'BUDGET', 'NATIVE', 'BINDING', 'OWNED'].sort());

const summaries = [], failures = [];
const write = (name, value) => writeFileSync(resolve(output, name), JSON.stringify(value, null, 2) + '\n');
const curve = (id, degree, knots, controlPoints, weights) =>
  ({kind: 'curve', id, degree, knots, controlPoints, weights});
const difference = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
const close = (a, b, tolerance = 1e-7) => assert.ok(difference(a, b) <= tolerance);

// Keep authored knot/pole -0 in the whole result and all four native objects.
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
  const reopened = JSON.parse(readFileSync(file, 'utf8'));
  assert.deepEqual(reopened, value);
  return {file, reopened};
}

function sourceFile(name, source, model) {
  const file = resolve(output, name + '.source0.css');
  writeFileSync(file, source);
  const compiled = compileCadModel(readFileSync(file, 'utf8'), {sourceVersion: 0});
  assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
  assert.deepEqual(compiled.model, model);
  return file;
}

function state(action) {
  try { return {status: 'evaluated', value: action()}; }
  catch (error) { return {status: 'native-refused', reason: error.message.slice(0, 1024)}; }
}

function sectionParameters(section) {
  const domain = curveDomain(section), breaks = [];
  for (const knot of section.knots) if (knot >= domain[0] && knot <= domain[1] && !breaks.some(value => value === knot)) breaks.push(knot);
  const parameters = [...breaks];
  for (let index = 0; index < breaks.length - 1; index++) {
    const mid = breaks[index] + (breaks[index + 1] - breaks[index]) / 2;
    if (mid > breaks[index] && mid < breaks[index + 1]) parameters.push(mid);
  }
  return parameters.sort((a, b) => a - b);
}

function checkOwnership(sections, options, result) {
  const callerObjects = new WeakSet();
  const collect = value => {
    if (value && typeof value === 'object' && !callerObjects.has(value)) {
      callerObjects.add(value);
      for (const child of Object.values(value)) collect(child);
    }
  };
  collect(sections);
  collect(options);
  const resultObjects = new WeakSet();
  const visit = value => {
    if (value && typeof value === 'object') {
      assert.ok(!callerObjects.has(value), 'Result aliases a caller object');
      assert.ok(!resultObjects.has(value), 'Repeated nested object occurrence in result');
      resultObjects.add(value);
      for (const child of Object.values(value)) visit(child);
    }
  };
  visit(result);
}

function check(name, sections) {
  const before = structuredClone(sections), options = {surfaceId: name + '_surface'};
  const result = build(...sections, options);
  checkOwnership(sections, options, result);
  assert.deepEqual(sections, before);
  assert.deepEqual(Object.keys(result).sort(), ['sections', 'options', 'surface', 'source', 'sourceVersion', 'model', 'provenance', 'report'].sort());
  assert.deepEqual(result.sections, sections);
  assert.deepEqual(result.options, options);
  assert.equal(result.surface.id, options.surfaceId);
  assert.equal(result.surface.degreeU, sections[0].degree);
  assert.equal(result.surface.degreeV, 2);
  assert.deepEqual(result.surface.knotsU, sections[0].knots);
  assert.deepEqual(result.surface.knotsV, [0, 0, 0, 1, 1, 1]);
  assert.deepEqual(surfaceDomain(result.surface), {u: curveDomain(sections[0]), v: [0, 1]});
  assert.equal(result.surface.controlPoints.length, sections[0].controlPoints.length);
  assert.ok(result.surface.controlPoints.every(row => row.length === 3));
  for (let index = 0; index < sections[0].controlPoints.length; index++) {
    assert.deepEqual(result.surface.controlPoints[index][0], sections[0].controlPoints[index]);
    assert.deepEqual(result.surface.controlPoints[index][2], sections[2].controlPoints[index]);
    assert.ok(Object.is(result.surface.weights[index][0], sections[0].weights[index]));
    assert.ok(Object.is(result.surface.weights[index][2], sections[2].weights[index]));
    const generatedWeight = 2 * sections[1].weights[index] - .5 * (sections[0].weights[index] + sections[2].weights[index]);
    assert.equal(result.surface.weights[index][1], generatedWeight);
    assert.ok(generatedWeight >= 1e-6 && generatedWeight <= 1e6);
  }
  const parameters = sectionParameters(sections[0]), report = result.report;
  const provenance = result.provenance;
  assert.equal(provenance.kind, 'three-section-homogeneous-loft');
  assert.equal(provenance.surfaceId, options.surfaceId);
  assert.deepEqual(provenance.sectionIds, sections.map(section => section.id));
  assert.deepEqual(provenance.sectionParameters, [0, .5, 1]);
  assert.equal(provenance.middleFormula, 'H1=2*Hmiddle-0.5*(Hfirst+Hlast)');
  assert.equal(provenance.rows.length, sections[0].controlPoints.length);
  for (const [index, row] of provenance.rows.entries()) {
    const homogeneous = sections.map(section =>
      [...section.controlPoints[index].map(value => section.weights[index] * value), section.weights[index]]);
    assert.equal(row.poleIndex, index);
    assert.deepEqual(row.sectionPoleIndices, [index, index, index]);
    assert.deepEqual([row.Hfirst, row.Hmiddle, row.Hlast], homogeneous);
    assert.deepEqual(row.doubledMiddle, homogeneous[1].map(value => 2 * value));
    assert.deepEqual(row.averagedEndpoints, homogeneous[0].map((value, axis) => .5 * (value + homogeneous[2][axis])));
    assert.deepEqual(row.generatedHmiddle, row.doubledMiddle.map((value, axis) => value - row.averagedEndpoints[axis]));
    assert.equal(row.weightContributingMagnitude, Math.abs(row.doubledMiddle[3]) + Math.abs(row.averagedEndpoints[3]));
    assert.equal(row.weightCancellationMargin, 64 * Number.EPSILON * row.weightContributingMagnitude);
    assert.ok(row.generatedHmiddle[3] > row.weightCancellationMargin);
    assert.deepEqual(result.surface.controlPoints[index][1], row.generatedHmiddle.slice(0, 3).map(value => value / row.generatedHmiddle[3]));
    assert.equal(result.surface.weights[index][1], row.generatedHmiddle[3]);
    for (const vIndex of [0, 1, 2]) {
      const expectedMapping = {surfacePole: [index, vIndex],
        origin: vIndex === 1 ? 'generated-homogeneous' : 'section-bit-copy',
        sectionIndex: vIndex === 1 ? null : vIndex, sectionPoleIndex: vIndex === 1 ? null : index,
        sourceSectionIndices: vIndex === 1 ? [0, 1, 2] : [vIndex]};
      assert.deepEqual(row.poleMappings[vIndex], {...expectedMapping, pointMM: result.surface.controlPoints[index][vIndex]});
      assert.deepEqual(row.weightMappings[vIndex], {...expectedMapping, weight: result.surface.weights[index][vIndex]});
    }
  }
  assert.deepEqual(provenance.uKnotMappings, sections[0].knots.map((value, index) =>
    ({sectionKnotIndex: index, surfaceKnotIndex: index, sectionValues: sections.map(section => section.knots[index]),
      surfaceValue: result.surface.knotsU[index], origin: 'common-basis-bit-copy'})));
  assert.equal(report.kind, 'three-section-loft-surface');
  assert.deepEqual(report.dto, {schema: 'barocss-native-three-section-loft', version: 0, lengthUnit: 'mm',
    frame: 'authored-xyz-no-axis-conversion', representation: 'native-three-section-surface-not-brep-or-solid'});
  assert.equal(report.surfaceId, options.surfaceId);
  assert.deepEqual(report.sectionIds, sections.map(section => section.id));
  assert.equal(report.degreeU, sections[0].degree);
  assert.equal(report.degreeV, 2);
  assert.deepEqual(report.controlPointGrid, [sections[0].controlPoints.length, 3]);
  assert.deepEqual(report.domains, {u: curveDomain(sections[0]), v: [0, 1]});
  assert.deepEqual(report.sectionParameters, [0, .5, 1]);
  assert.equal(report.geometricValidity, 'not-certified');
  assert.equal(report.topologyCertified, false);
  assert.equal(report.solid, false);
  assert.equal(report.observationCount, report.observations.length);
  assert.equal(report.derivativeObservationCount, report.derivativeObservations.length);
  assert.equal(report.observations.length, parameters.length * 3);
  assert.equal(report.derivativeObservations.length, parameters.length * 3);
  assert.ok(report.observations.length <= 96 && report.derivativeObservations.length <= 96);
  for (const observation of report.observations) {
    assert.ok(parameters.some(parameter => Object.is(parameter, observation.u)));
    assert.equal(observation.v, [0, .5, 1][observation.sectionIndex]);
    const expected = evaluateCurve(sections[observation.sectionIndex], observation.u);
    const actual = evaluateSurface(result.surface, observation.u, observation.v);
    assert.deepEqual(observation.expectedPointMM, expected);
    assert.deepEqual(observation.actualPointMM, actual);
    assert.equal(observation.differenceMM, difference(expected, actual));
    close(expected, actual);
  }
  for (const observation of report.derivativeObservations) {
    const section = sections[observation.sectionIndex];
    assert.equal(observation.v, [0, .5, 1][observation.sectionIndex]);
    assert.deepEqual(observation.original, state(() => evaluateCurveD1(section, observation.u)));
    assert.deepEqual(observation.surface, state(() => evaluateSurfaceD1(result.surface, observation.u, observation.v)));
    if (observation.original.status === 'evaluated' && observation.surface.status === 'evaluated') {
      const expected = observation.original.value.derivative, actual = observation.surface.value.du;
      assert.equal(observation.relativeDuDifference, difference(expected, actual) / Math.max(1, Math.hypot(...expected)));
      close(expected, actual, 1e-7 * Math.max(1, Math.hypot(...expected)));
    } else assert.equal(observation.relativeDuDifference, null);
  }
  const compared = report.derivativeObservations.filter(observation => observation.relativeDuDifference !== null);
  assert.equal(report.derivativeComparisonCount, compared.length);
  assert.equal(report.derivativeRefusalCount, report.derivativeObservations.length - compared.length);
  assert.equal(report.asymmetricDerivativeRefusalCount, report.derivativeObservations.filter(observation =>
    observation.original.status !== observation.surface.status).length);
  assert.equal(report.maximumPointDifferenceMM, Math.max(...report.observations.map(observation => observation.differenceMM)));
  assert.equal(report.maximumRelativeDuDifference,
    compared.length ? Math.max(...compared.map(observation => observation.relativeDuDifference)) : null);
  const [lo, hi] = curveDomain(sections[0]), guarded = [...new Set(sections[0].knots)].filter(parameter =>
    parameter > lo && parameter < hi && sections[0].knots.filter(knot => knot === parameter).length >= sections[0].degree);
  assert.deepEqual(report.guardedParameters, guarded);
  assert.deepEqual(report.unrepresentedMidpointIntervals, []);
  assert.equal(report.originalSpanCount, [...new Set(sections[0].knots)].length - 1);
  assert.equal(report.authority, 'original-three-section-homogeneous-coefficients');
  assert.deepEqual(report.quality, {pointComparisonMM: 1e-7, relativeDuComparison: 1e-7, localObservationsOnly: true,
    endpointControlAndWeightBitsPreserved: true, commonUKnotDomainBitsPreserved: true,
    middleInterpolation: 'actual-homogeneous-section-interpolation-at-v-half',
    betweenSections: 'homogeneous-weight-dependent-not-naive-cartesian-interpolation', sectionWeightScalingInvarianceCertified: false,
    generatedWeightPolicy: 'positive-native-weight-above64-epsilon-absolute-contributing-terms',
    nativeD1Refusals: 'actual-original-and-surface-states-no-inferred-equality', globalShapeErrorCertified: false,
    globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false, g1g2Certified: false,
    sourceText: 'regenerated-from-supplied-native-geometry-not-original-file-formatting',
    ownership: 'copied-cpu-data-gc-no-renderer-resources'});
  assert.equal(report.budgetFailure, 'atomic-refusal-no-partial-result');
  assert.deepEqual(report.limits, {maximumSectionDegree: 3, maximumSectionPoles: 16, maximumSurfacePoles: 48,
    maximumPointObservations: 96, maximumDerivativeObservations: 96, authoredIdCharacters: 48,
    coordinateAbsMM: 10000, weightRange: [1e-6, 1e6], inputValues: 32768, inputDepth: 8,
    inputArrayElements: 128, inputRecordFields: 16, inputStringCharacters: 128, snapshotValues: 524288,
    snapshotDepth: 32, arrayElements: 4096, recordFields: 64, sourceStringCharacters: 262144});
  assert.equal(result.sourceVersion, 0);
  assert.deepEqual(result.model.objects, [...sections, result.surface]);
  const sourceFileName = sourceFile(name, result.source, result.model);
  assert.deepEqual(validate(result), report);
  const stored = ownedFile(name + '.owned-result', result);
  assert.deepEqual(validate(stored.reopened), report);
  assert.deepEqual(build(...stored.reopened.sections, stored.reopened.options), result);
  assert.deepEqual(sections, before);
  summaries.push({name, surfaceId: result.surface.id, originalSectionIds: sections.map(section => section.id),
    surfaceGrid: [result.surface.controlPoints.length, 3], points: report.observationCount,
    derivatives: report.derivativeObservationCount, derivativeRefusals: report.derivativeRefusalCount,
    maximumPointDifferenceMM: report.maximumPointDifferenceMM, maximumRelativeDuDifference: report.maximumRelativeDuDifference,
    sourceFile: sourceFileName, resultFile: stored.file});
  return result;
}

write('source-api.metafile.json', built.metafile);
write('source-api.inputs.json', {entry, mode: 'in-memory-esbuild', write: false,
  cadInputs, allInputs: sourceInputs, esbuildVersion: esbuild.version});
const knots = [-0, -0, -0, 2, 2, 2];
const first = curve('first_equal', 2, knots, [[-0, -0, -0], [2, 0, 1], [4, 0, 0]], [1, 1, 1]);
const middle = curve('middle_equal', 2, knots, [[-0, 2, -0], [2, 4, 3], [4, 2, 0]], [1, 1, 1]);
const last = curve('last_equal', 2, knots, [[-0, 4, -0], [2, 4, 1], [4, 4, 0]], [1, 1, 1]);
const equal = check('equal_curved_middle', [first, middle, last]);
const equalBefore = structuredClone(equal), sectionBefore = [structuredClone(first), structuredClone(middle), structuredClone(last)];
const acceptedSourceFile = resolve(output, 'equal_curved_middle.source0.css'), acceptedBytes = readFileSync(acceptedSourceFile);
const uMiddle = 1, firstPoint = evaluateCurve(first, uMiddle), middlePoint = evaluateCurve(middle, uMiddle), lastPoint = evaluateCurve(last, uMiddle);
const endpointBlend = firstPoint.map((value, axis) => (value + lastPoint[axis]) / 2);
close(evaluateSurface(equal.surface, uMiddle, .5), middlePoint);
assert.ok(difference(middlePoint, endpointBlend) > .5);
write('independent-middle-observation.json', {u: uMiddle, v: .5, actualMiddlePointMM: middlePoint,
  endpointBlendMM: endpointBlend, differenceFromEndpointBlendMM: difference(middlePoint, endpointBlend)});

const rational = check('independent_weights', [
  {...structuredClone(first), id: 'rational_first', weights: [1, 1.25, 1]},
  {...structuredClone(middle), id: 'rational_middle', weights: [1.5, 1.75, 1.25]},
  {...structuredClone(last), id: 'rational_last', weights: [1.25, 1, 1.5]},
]);
assert.deepEqual(rational.surface.weights.map(row => row[1]), [1.875, 2.375, 1.25]);

const maxKnots = [-0, -0, ...Array.from({length: 14}, (_, index) => index + 1), 15, 15];
const maximumSections = [0, 1, 2].map(sectionIndex => curve('maximum_' + sectionIndex, 1, maxKnots,
  Array.from({length: 16}, (_, index) => [index === 0 ? -0 : index * .25,
    sectionIndex * 2 + (sectionIndex === 1 ? (index % 3) * .25 : 0), index * .125 + sectionIndex]), Array(16).fill(1)));
const maximum = check('maximum16_c0', maximumSections);
assert.equal(maximum.surface.controlPoints.length * maximum.surface.controlPoints[0].length, 48);
assert.equal(maximum.report.observationCount, 93);
for (const observation of maximum.report.derivativeObservations) {
  if (observation.u > 0 && observation.u < 15 && Number.isInteger(observation.u)) {
    assert.equal(observation.original.status, 'native-refused');
    assert.equal(observation.surface.status, 'native-refused');
    assert.equal(observation.relativeDuDifference, null);
  }
}

const editedMiddle = editCurveControlPolygon(middle, {poleEdits: [{index: 1, zMM: 3.25}]});
const editBefore = structuredClone(editedMiddle);
const edited = check('edited_middle', [first, editedMiddle.curve, last]);
assert.equal(edited.sections[1].id, middle.id);
assert.notDeepEqual(evaluateSurface(edited.surface, 1, .5), evaluateSurface(equal.surface, 1, .5));
assert.deepEqual(equal, equalBefore);
assert.deepEqual([first, middle, last], sectionBefore);
assert.deepEqual(editedMiddle, editBefore);
assert.deepEqual(readFileSync(acceptedSourceFile), acceptedBytes);

// One ordinary downstream packet and three native U-varying isocurves.
const preview = tessellateSurface(equal.surface, {countU: 5, countV: 3, revision: 0});
validatePreviewPacket(preview.packet);
for (let index = 0; index < preview.packet.parameters.length / 2; index++) {
  const [u, v] = preview.packet.parameters.slice(index * 2, index * 2 + 2);
  close(preview.packet.positions.slice(index * 3, index * 3 + 3), evaluateSurface(equal.surface, u, v));
}
const previewFile = ownedFile('ordinary-preview', preview);
validatePreviewPacket(previewFile.reopened.packet);
const isoSummary = [];
for (const [sectionIndex, v] of [0, .5, 1].entries()) {
  const iso = extractSurfaceIsoCurve(equal.surface, {fixedAxis: 'v', parameter: v, curveId: 'ordinary_iso_' + sectionIndex});
  const section = equal.sections[sectionIndex];
  assert.deepEqual(curveDomain(iso.curve), curveDomain(section));
  if (sectionIndex !== 1) {
    assert.deepEqual(iso.curve.controlPoints, section.controlPoints);
    assert.deepEqual(iso.curve.weights, section.weights);
    assert.deepEqual(iso.curve.knots, section.knots);
  }
  const observations = sectionParameters(section).map(u => {
    const originalPointMM = evaluateCurve(section, u), isoPointMM = evaluateCurve(iso.curve, u), surfacePointMM = evaluateSurface(equal.surface, u, v);
    close(originalPointMM, isoPointMM);
    close(originalPointMM, surfacePointMM);
    const originalD1 = state(() => evaluateCurveD1(section, u)), isoD1 = state(() => evaluateCurveD1(iso.curve, u));
    const surfaceD1 = state(() => evaluateSurfaceD1(equal.surface, u, v));
    if (originalD1.status === 'evaluated' && isoD1.status === 'evaluated' && surfaceD1.status === 'evaluated') {
      const expected = originalD1.value.derivative, tolerance = 1e-7 * Math.max(1, Math.hypot(...expected));
      close(expected, isoD1.value.derivative, tolerance);
      close(expected, surfaceD1.value.du, tolerance);
    }
    return {u, v, originalPointMM, isoPointMM, surfacePointMM, originalD1, isoD1, surfaceD1};
  });
  const isoFile = sourceFile('ordinary_iso_' + sectionIndex, iso.source, iso.model);
  ownedFile('ordinary_iso_' + sectionIndex, {iso, observations});
  isoSummary.push({v, sectionId: section.id, curveId: iso.curve.id, sourceFile: isoFile, observations: observations.length});
}

function reject(name, action, expectedCode) {
  assert.throws(action, error => {
    assert.ok(error instanceof ThreeSectionLoftError);
    assert.equal(error.name, 'ThreeSectionLoftError');
    assert.ok(error.message.startsWith('Three-section loft Surface: '));
    assert.ok(Object.values(ThreeSectionLoftDiagnosticCode).includes(error.code));
    if (expectedCode) assert.equal(error.code, expectedCode);
    failures.push({name, code: error.code, message: error.message, actualCausePreserved: Object.hasOwn(error, 'cause')});
    assert.deepEqual(equal, equalBefore);
    assert.deepEqual([first, middle, last], sectionBefore);
    assert.deepEqual(editedMiddle, editBefore);
    assert.deepEqual(readFileSync(acceptedSourceFile), acceptedBytes);
    return true;
  });
}

reject('negative_generated_weight', () => build(first, {...structuredClone(middle), weights: [.25, .25, .25]}, last,
  {surfaceId: 'bad_negative_weight'}));
reject('near_cancel_generated_weight', () => build({...structuredClone(first), weights: Array(3).fill(1e6)},
  {...structuredClone(middle), weights: Array(3).fill(500000.00000000006)},
  {...structuredClone(last), weights: Array(3).fill(1e6)}, {surfaceId: 'bad_near_cancel'}));
const boundSections = [first, middle, last].map((section, index) => ({...structuredClone(section),
  controlPoints: section.controlPoints.map(point => [index === 1 ? 10000 : -10000, point[1], point[2]])}));
reject('generated_xyz_bound', () => build(...boundSections, {surfaceId: 'bad_generated_xyz'}));
reject('basis_knot_sign', () => build(first, {...structuredClone(middle), knots: [0, 0, 0, 2, 2, 2]}, last,
  {surfaceId: 'bad_basis'}), 'BASIS');
reject('duplicate_authored_id', () => build(first, {...structuredClone(middle), id: first.id}, last,
  {surfaceId: 'bad_ids'}), 'IDENTITY');
reject('surface_id_collision', () => build(first, middle, last, {surfaceId: middle.id}), 'IDENTITY');
let getterCalls = 0;
const getter = structuredClone(middle);
Object.defineProperty(getter, 'weights', {
  enumerable: true, get() { getterCalls++; return middle.weights; },
});
reject('getter', () => build(first, getter, last, {surfaceId: 'bad_getter'}), 'INPUT');
assert.equal(getterCalls, 0);
for (const [name, alter] of [
  ['source', result => result.source += ' '],
  ['coefficient', result => result.surface.controlPoints[1][1][2] += .1],
  ['provenance', result => result.provenance.forged = true],
  ['report', result => result.report.observationCount++],
]) {
  const changed = structuredClone(equal);
  alter(changed);
  reject('owned_' + name + '_tamper', () => validate(changed), 'OWNED');
}
assert.deepEqual(validate(equal), equal.report);

// Current manifest-declared JS and declarations are outside the source-only graph.
const packageRoot = resolve(repo, 'packages/barocss-cad');
const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath));
assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const runtimeExports = ['buildThreeSectionLoftSurface', 'validateThreeSectionLoftSurface', 'ThreeSectionLoftError', 'ThreeSectionLoftDiagnosticCode'];
for (const name of runtimeExports) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.ThreeSectionLoftDiagnosticCode, ThreeSectionLoftDiagnosticCode);
const declarationExports = [...runtimeExports, 'ThreeSectionLoftOptions', 'ThreeSectionLoftObservation', 'ThreeSectionLoftD1Observation',
  'ThreeSectionLoftProvenance', 'ThreeSectionLoftReport', 'ThreeSectionLoftResult'];
const leafDeclarationPath = resolve(packageRoot, 'dist/features/three-section-loft.d.ts');
const leafDeclaration = readFileSync(leafDeclarationPath, 'utf8');
assert.ok(readFileSync(declarationPath, 'utf8').includes('./features/three-section-loft.js'));
for (const name of declarationExports) {
  assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(leafDeclaration), name);
}
assert.ok(leafDeclaration.includes('export type ThreeSectionLoftDiagnosticCode'));
const compiled = publicAPI.buildThreeSectionLoftSurface(first, middle, last, equal.options);
assert.deepEqual(compiled, equal);
assert.deepEqual(publicAPI.validateThreeSectionLoftSurface(compiled), equal.report);
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeExports, declarationExports,
  modelObjects: compiled.model.objects.length, surfacePoles: compiled.surface.controlPoints.length * 3,
  declarationCheck: 'actual exported declaration text; no separate TypeScript invocation'};
write('compiled-consumer.json', compiledConsumer);
write('summary.json', {sourceMode: true, cadSourceInputCount: cadInputs.length, summaries, failures,
  previewFile: previewFile.file, isoSummary, compiledConsumer,
  scope: 'Exactly three native sections interpolate at V0,.5,1 through a generated homogeneous quadratic middle row. Original sections and endpoint bits stay authoritative; local native point/Du and C0 states, one small packet and isocurves are prototype evidence. No arbitrary loft, sweep, seam matching, global error, G1/G2, topology, solid, manufacturing or renderer adoption.'});
console.log(JSON.stringify({sourceMode: true, cadSourceInputCount: cadInputs.length,
  summaries, failures, previewFile: previewFile.file, isoSummary, compiledConsumer}));
