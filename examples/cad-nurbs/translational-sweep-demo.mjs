import assert from 'node:assert/strict';
import {mkdirSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.deepEqual(args.filter(arg => arg === '--source'), ['--source']);
assert.equal(args.length, 2, 'Usage: node translational-sweep-demo.mjs --source <output-directory>');
assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]);
mkdirSync(output, {recursive: true});
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const esbuild = require('esbuild');
const entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundled = await esbuild.build({absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node',
  format: 'esm', write: false, target: 'es2022', metafile: true});
assert.equal(bundled.outputFiles.length, 1);
const sourceInputs = Object.keys(bundled.metafile.inputs).map(path => resolve(repo, path));
const cadInputs = sourceInputs.filter(path => path.includes('/packages/barocss-cad/'));
assert.ok(cadInputs.includes(entry));
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/translational-sweep-surface.ts')));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const {buildTranslationalSweepSurface: build, validateTranslationalSweepSurface: validate,
  TranslationalSweepError, TranslationalSweepDiagnosticCode, evaluateCurve, evaluateCurveD1, evaluateSurface, evaluateSurfaceD1,
  curveDomain, surfaceDomain, compileCadModel, editCurveControlPolygon, extractSurfaceIsoCurve} = api;
for (const operation of [build, validate, TranslationalSweepError]) assert.equal(typeof operation, 'function');
assert.deepEqual(Object.keys(TranslationalSweepDiagnosticCode).sort(),
  ['INPUT', 'IDENTITY', 'BUDGET', 'NATIVE', 'REPRESENTABILITY', 'BINDING', 'OWNED'].sort());
const retainedFiles = new Map(), accepted = [], summaries = [], failures = [];
const curve = (id, degree, knots, controlPoints, weights) => ({kind: 'curve', id, degree, knots, controlPoints, weights});
const difference = (a, b) => Math.hypot(...a.map((value, axis) => value - b[axis]));
const closePoint = (a, b) => assert.ok(difference(a, b) <= 1e-7);
const relative = (a, b) => difference(a, b) / Math.max(1, Math.hypot(...a), Math.hypot(...b));
function nativeJSON(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || ['string', 'boolean'].includes(typeof value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}';
}
function ownedFile(name, value) {
  const file = resolve(output, name + '.json'); writeFileSync(file, nativeJSON(value) + '\n');
  retainedFiles.set(file, readFileSync(file));
  const reopened = JSON.parse(readFileSync(file, 'utf8')); assert.deepEqual(reopened, value); return {file, reopened};
}
function sourceFile(name, source, model) {
  const file = resolve(output, name + '.source0.css'); writeFileSync(file, source); retainedFiles.set(file, readFileSync(file));
  const cold = compileCadModel(readFileSync(file, 'utf8'), {sourceVersion: 0});
  assert.equal(cold.ok, true, JSON.stringify(cold.diagnostics)); assert.deepEqual(cold.model, model); return {file, model: cold.model};
}
function ownership(inputs, result) {
  const caller = new WeakSet(), seen = new WeakSet();
  const collect = value => { if (value && typeof value === 'object' && !caller.has(value)) {
    caller.add(value); for (const child of Object.values(value)) collect(child);
  }};
  inputs.forEach(collect);
  const visit = value => { if (value && typeof value === 'object') {
    assert.ok(!caller.has(value), 'Caller alias'); assert.ok(!seen.has(value), 'Repeated output occurrence');
    seen.add(value); for (const child of Object.values(value)) visit(child);
  }};
  visit(result);
}
function nativeState(action) {
  try { return {status: 'evaluated', value: action()}; }
  catch (error) { return {status: 'native-refused', reason: error.message.slice(0, 1024), nativeErrorName: error.name}; }
}
function originalSamples(input) {
  const domain = curveDomain(input), boundaries = [];
  for (const knot of input.knots) if (knot >= domain[0] && knot <= domain[1] && !boundaries.some(value => value === knot)) boundaries.push(knot);
  const parameters = [...boundaries], gaps = [];
  for (let index = 0; index < boundaries.length - 1; index++) {
    const lower = boundaries[index], upper = boundaries[index + 1], midpoint = lower + (upper - lower) / 2;
    if (midpoint > lower && midpoint < upper) parameters.push(midpoint);
    else gaps.push({domain: [lower, upper], attemptedParameter: midpoint});
  }
  return {parameters: parameters.sort((a, b) => a - b), gaps};
}

const quarter = curve('quarter_profile', 2, [-3, -3, -3, 7, 7, 7], [[2, -0, 0], [2, 2, 0], [0, 2, 0]], [1, Math.SQRT1_2, 1]);
const bentRail = curve('bent_rail', 2, [2, 2, 2, 5, 5, 5], [[5, 1, -2], [6, 3, 1], [8, 2, 4]], [2, 3, 1]);
const cubic = curve('cubic_profile', 3, [-4, -4, -4, -4, 6, 6, 6, 6], [[1, 2, -0], [2, 3, 1], [3, 1, 2], [4, 2, 0]], [1, 2, 3, 1]);
const linearRail = curve('linear_rail', 1, [3, 3, 9, 9], [[-2, 3, 1], [1, 5, 2]], [2, 1]);
const c0Profile = curve('c0_profile', 1, [-0, -0, 1, 3, 3], [[-0, 0, 0], [2, 1, 0], [3, 0, 0]], [1, 2, 1]);
const c0Rail = curve('c0_rail', 1, [2, 2, 4, 7, 7], [[4, 1, 2], [5, 1, 3], [4, 3, 5]], [2, 1, 3]);
const maximumProfile = curve('maximum_profile', 1, [-0, -0, ...Array.from({length: 14}, (_, index) => index + 1), 15, 15],
  Array.from({length: 16}, (_, index) => [index / 2, index % 2 / 4, -0]), Array.from({length: 16}, (_, index) => 1 + index / 32));
const maximumRail = curve('maximum_rail', 1, [2, 2, ...Array.from({length: 14}, (_, index) => index + 3), 17, 17],
  Array.from({length: 16}, (_, index) => [5 + index / 4, 2, -1 + index / 2]), Array.from({length: 16}, (_, index) => 1 + index / 64));
const zeroRail = curve('zero_rail', 1, [2, 2, 5, 5], [[3, 4, 5], [3, 4, 5]], [2, 1]);

ownedFile('source-api.metafile', bundled.metafile);
ownedFile('source-api.inputs', {entry, mode: 'in-memory-esbuild', write: false, cadInputs, sourceInputs, esbuildVersion: esbuild.version});

function check(name, profile, rail) {
  const before = structuredClone({profile, rail}), uSamples = originalSamples(profile), vSamples = originalSamples(rail);
  const options = {surfaceId: name + '_surface', maximumObservations: uSamples.parameters.length * vSamples.parameters.length};
  const result = build(profile, rail, options); ownership([profile, rail, options], result);
  assert.deepEqual({profile, rail}, before);
  assert.deepEqual(Object.keys(result).sort(), ['profile', 'rail', 'options', 'surface', 'source', 'sourceVersion', 'model', 'provenance', 'report'].sort());
  assert.deepEqual(result.profile, profile); assert.deepEqual(result.rail, rail); assert.deepEqual(result.options, options);
  const surface = result.surface, domains = {u: curveDomain(profile), v: curveDomain(rail)};
  assert.equal(surface.id, options.surfaceId); assert.equal(surface.degreeU, profile.degree); assert.equal(surface.degreeV, rail.degree);
  assert.deepEqual(surface.knotsU, profile.knots); assert.deepEqual(surface.knotsV, rail.knots);
  assert.deepEqual(surfaceDomain(surface), domains);
  assert.equal(surface.controlPoints.length, profile.controlPoints.length);
  assert.ok(surface.controlPoints.every(row => row.length === rail.controlPoints.length));
  const anchor = evaluateCurve(rail, domains.v[0]);
  for (let i = 0; i < profile.controlPoints.length; i++) for (let j = 0; j < rail.controlPoints.length; j++) {
    const translated = profile.controlPoints[i].map((value, axis) => {
      const delta = rail.controlPoints[j][axis] - anchor[axis]; return delta === 0 ? value : value + delta;
    });
    assert.deepEqual(surface.controlPoints[i][j], translated);
    assert.ok(Object.is(surface.weights[i][j], profile.weights[i] * rail.weights[j]));
  }
  const evidence = [];
  let comparisons = 0, refusals = 0, maximumPointDifferenceMM = 0, maximumRelativeDuDifference = 0, maximumRelativeDvDifference = 0;
  for (const u of uSamples.parameters) for (const v of vSamples.parameters) {
    const profilePointMM = evaluateCurve(profile, u), railPointMM = evaluateCurve(rail, v), surfacePointMM = evaluateSurface(surface, u, v);
    const expectedPointMM = profilePointMM.map((value, axis) => {
      const delta = railPointMM[axis] - anchor[axis]; return delta === 0 ? value : value + delta;
    });
    const pointDifferenceMM = difference(expectedPointMM, surfacePointMM); assert.ok(pointDifferenceMM <= 1e-7);
    maximumPointDifferenceMM = Math.max(maximumPointDifferenceMM, pointDifferenceMM);
    const profileD1 = nativeState(() => evaluateCurveD1(profile, u)), railD1 = nativeState(() => evaluateCurveD1(rail, v));
    const surfaceD1 = nativeState(() => evaluateSurfaceD1(surface, u, v));
    assert.equal(surfaceD1.status === 'native-refused', profileD1.status === 'native-refused' || railD1.status === 'native-refused');
    let relativeDuDifference = null, relativeDvDifference = null;
    if (surfaceD1.status === 'evaluated') {
      comparisons++;
      relativeDuDifference = relative(surfaceD1.value.du, profileD1.value.derivative);
      relativeDvDifference = relative(surfaceD1.value.dv, railD1.value.derivative);
      assert.ok(relativeDuDifference <= 1e-7); assert.ok(relativeDvDifference <= 1e-7);
      maximumRelativeDuDifference = Math.max(maximumRelativeDuDifference, relativeDuDifference);
      maximumRelativeDvDifference = Math.max(maximumRelativeDvDifference, relativeDvDifference);
    } else refusals++;
    evidence.push({u, v, profilePointMM, railPointMM, expectedPointMM, surfacePointMM, pointDifferenceMM,
      profileD1, railD1, surfaceD1, relativeDuDifference, relativeDvDifference});
  }
  assert.equal(evidence.length, options.maximumObservations);
  const provenance = result.provenance, report = result.report;
  assert.equal(provenance.kind, 'independent-rational-profile-rail-translational-tensor');
  assert.equal(provenance.formula, 'Qij=Pi+(Rj-nativeAnchor);Wij=profileWeight_i*railWeight_j');
  assert.equal(provenance.profileId, profile.id); assert.equal(provenance.railId, rail.id); assert.equal(provenance.surfaceId, surface.id);
  assert.deepEqual(provenance.profileDomain, domains.u); assert.deepEqual(provenance.railDomain, domains.v);
  assert.ok(Object.is(provenance.anchorParameter, domains.v[0])); assert.deepEqual(provenance.anchorMM, anchor);
  assert.deepEqual(provenance.poleGrid, [profile.controlPoints.length, rail.controlPoints.length]);
  assert.equal(provenance.poles.length, profile.controlPoints.length * rail.controlPoints.length);
  for (const [index, pole] of provenance.poles.entries()) {
    const i = Math.floor(index / rail.controlPoints.length), j = index % rail.controlPoints.length;
    assert.deepEqual(pole.surfacePole, [i, j]); assert.equal(pole.profilePoleIndex, i); assert.equal(pole.railPoleIndex, j);
    assert.deepEqual(pole.profilePointMM, profile.controlPoints[i]); assert.deepEqual(pole.railPointMM, rail.controlPoints[j]);
    assert.deepEqual(pole.anchorMM, anchor);
    assert.deepEqual(pole.translationMM, rail.controlPoints[j].map((value, axis) => value - anchor[axis]));
    assert.ok(Object.is(pole.profileWeight, profile.weights[i])); assert.ok(Object.is(pole.railWeight, rail.weights[j]));
    assert.deepEqual(pole.pointMM, surface.controlPoints[i][j]); assert.ok(Object.is(pole.weight, surface.weights[i][j]));
  }
  assert.deepEqual(provenance.uKnotMappings, profile.knots.map((value, index) =>
    ({profileKnotIndex: index, surfaceKnotIndex: index, originalValue: value, surfaceValue: value})));
  assert.deepEqual(provenance.vKnotMappings, rail.knots.map((value, index) =>
    ({railKnotIndex: index, surfaceKnotIndex: index, originalValue: value, surfaceValue: value})));
  assert.equal(report.kind, 'translational-sweep-surface');
  assert.deepEqual(report.dto, {schema: 'barocss-native-translational-sweep-surface', version: 0, lengthUnit: 'mm',
    frame: 'authored-xyz-no-axis-conversion', representation: 'native-independent-profile-rail-tensor-surface-not-moving-frame-or-solid'});
  assert.equal(report.surfaceId, surface.id); assert.equal(report.profileId, profile.id); assert.equal(report.railId, rail.id);
  assert.equal(report.degreeU, profile.degree); assert.equal(report.degreeV, rail.degree);
  assert.deepEqual(report.controlPointGrid, provenance.poleGrid); assert.deepEqual(report.domains, domains);
  assert.deepEqual(report.axisRoles, {u: 'original-profile-parameter', v: 'original-rail-parameter'});
  assert.ok(Object.is(report.anchorParameter, domains.v[0])); assert.deepEqual(report.anchorMM, anchor);
  assert.deepEqual(report.profileSamples, uSamples.parameters); assert.deepEqual(report.railSamples, vSamples.parameters);
  assert.deepEqual(report.unrepresentedMidpointIntervals, {profile: uSamples.gaps, rail: vSamples.gaps});
  const guardParameters = input => originalSamples(input).parameters.filter(parameter => {
    const domain = curveDomain(input), multiplicity = input.knots.filter(knot => knot === parameter).length;
    return parameter > domain[0] && parameter < domain[1] && multiplicity > input.degree - 1;
  });
  assert.deepEqual(report.guardedParameters, {u: guardParameters(profile), v: guardParameters(rail)});
  assert.equal(report.observationCount, evidence.length); assert.equal(report.observations.length, evidence.length);
  assert.equal(report.anchorD0EvaluationCount, 1); assert.equal(report.curveD0EvaluationCount, 2 * evidence.length);
  assert.equal(report.surfaceD0EvaluationCount, evidence.length);
  for (const field of ['profileD1AttemptCount', 'railD1AttemptCount', 'surfaceD1AttemptCount']) assert.equal(report[field], evidence.length);
  assert.equal(report.derivativeComparisonCount, comparisons); assert.equal(report.derivativeRefusalCount, refusals);
  assert.deepEqual(report.derivativeSourceRefusalCounts, {
    profile: evidence.filter(row => row.profileD1.status === 'native-refused').length,
    rail: evidence.filter(row => row.railD1.status === 'native-refused').length,
    surface: evidence.filter(row => row.surfaceD1.status === 'native-refused').length,
  });
  for (const [index, observation] of report.observations.entries()) {
    const own = evidence[index];
    assert.ok(Object.is(observation.u, own.u)); assert.ok(Object.is(observation.v, own.v));
    for (const field of ['profilePointMM', 'railPointMM', 'expectedPointMM', 'profileD1', 'railD1', 'surfaceD1'])
      assert.deepEqual(observation[field], own[field]);
    assert.deepEqual(observation.actualPointMM, own.surfacePointMM); assert.equal(observation.differenceMM, own.pointDifferenceMM);
    assert.equal(observation.relativeDuDifference, own.relativeDuDifference); assert.equal(observation.relativeDvDifference, own.relativeDvDifference);
  }
  assert.equal(report.maximumPointDifferenceMM, maximumPointDifferenceMM);
  assert.equal(report.maximumRelativeDuDifference, comparisons ? maximumRelativeDuDifference : null);
  assert.equal(report.maximumRelativeDvDifference, comparisons ? maximumRelativeDvDifference : null);
  assert.equal(report.geometricValidity, 'not-certified'); assert.equal(report.topologyCertified, false); assert.equal(report.solid, false);
  assert.equal(report.quality.regularityCertified, false); assert.equal(report.quality.movingFrameCertified, false);
  assert.equal(report.quality.localObservationsOnly, true); assert.equal(report.quality.independentRationalBasesPreserved, true);
  assert.equal(report.quality.productWeights, 'actual-input-weight-products-no-normalization');
  assert.equal(report.quality.zeroShiftPolicy, 'exact-zero-rail-delta-copies-original-profile-coordinate');
  assert.equal(report.limits.maximumObservations, 961);
  assert.equal(result.sourceVersion, 0); assert.equal(result.model.objects.length, 3);
  assert.deepEqual(result.model.objects, [profile, rail, surface]);
  const source = sourceFile(name, result.source, result.model);
  assert.deepEqual(build(source.model.objects[0], source.model.objects[1], options), result);
  assert.deepEqual(validate(result), result.report);
  const owned = ownedFile(name + '.owned-sweep', result); assert.deepEqual(validate(owned.reopened), result.report);
  const observations = ownedFile(name + '.independent-observations', evidence);
  accepted.push({result, before: structuredClone(result), profile, rail, inputBefore: before, options});
  summaries.push({name, profileId: profile.id, railId: rail.id, surfaceId: surface.id, degrees: [surface.degreeU, surface.degreeV],
    domains, poleGrid: [profile.controlPoints.length, rail.controlPoints.length], anchorPointMM: anchor,
    observationCount: evidence.length, derivativeComparisonCount: comparisons, derivativeRefusalCount: refusals,
    maximumPointDifferenceMM, maximumRelativeDuDifference, maximumRelativeDvDifference,
    sourceFile: source.file, resultFile: owned.file, independentObservationFile: observations.file});
  return result;
}

const ordinary = check('rational_quarter_bent_rail', quarter, bentRail);
const railBefore = structuredClone(bentRail), originalBefore = structuredClone(ordinary);
const edited = editCurveControlPolygon(bentRail, {poleEdits: [{index: 1, zMM: 2, weight: 2.5}]});
assert.deepEqual(bentRail, railBefore); assert.equal(edited.curve.id, bentRail.id);
assert.deepEqual(edited.curve.knots, bentRail.knots); assert.equal(edited.curve.controlPoints[1][2], 2); assert.equal(edited.curve.weights[1], 2.5);
for (let index = 0; index < bentRail.controlPoints.length; index++) for (let axis = 0; axis < 3; axis++) {
  if (index !== 1 || axis !== 2) assert.ok(Object.is(edited.curve.controlPoints[index][axis], bentRail.controlPoints[index][axis]));
}
sourceFile('numeric_rail_edit.original_curve', edited.source, edited.model);
ownedFile('numeric_rail_edit.edit-result', edited);
const changed = check('numeric_rail_edit', quarter, edited.curve);
assert.ok(difference(evaluateSurface(ordinary.surface, 2, 3.5), evaluateSurface(changed.surface, 2, 3.5)) > .01);
assert.deepEqual(ordinary, originalBefore);
const cubicResult = check('cubic_profile_linear_rail', cubic, linearRail);
const guarded = check('c0_profile_and_rail', c0Profile, c0Rail);
assert.ok(Object.is(curveDomain(guarded.profile)[0], -0));
assert.equal(nativeState(() => evaluateCurveD1(c0Profile, 1)).status, 'native-refused');
assert.equal(nativeState(() => evaluateCurveD1(c0Rail, 4)).status, 'native-refused');
assert.equal(nativeState(() => evaluateSurfaceD1(guarded.surface, 1, 3)).status, 'native-refused');
assert.equal(nativeState(() => evaluateSurfaceD1(guarded.surface, .5, 4)).status, 'native-refused');
const maximum = check('maximum_16_by_16', maximumProfile, maximumRail);
assert.equal(maximum.surface.controlPoints.flat().length, 256);
assert.equal(summaries.find(row => row.name === 'maximum_16_by_16').observationCount, 961);
const degenerate = check('zero_translation_rail', quarter, zeroRail);
for (const u of originalSamples(quarter).parameters) for (const v of originalSamples(zeroRail).parameters) {
  closePoint(evaluateSurface(degenerate.surface, u, v), evaluateCurve(quarter, u));
  assert.ok(Math.hypot(...evaluateSurfaceD1(degenerate.surface, u, v).dv) <= 1e-7);
}

const iso = extractSurfaceIsoCurve(ordinary.surface, {fixedAxis: 'v', parameter: 3.5, curveId: 'sweep_iso'});
assert.deepEqual(iso.original, ordinary.surface); assert.equal(iso.curve.degree, quarter.degree);
assert.deepEqual(iso.curve.knots, quarter.knots); assert.deepEqual(curveDomain(iso.curve), curveDomain(quarter));
const isoOffset = evaluateCurve(bentRail, 3.5).map((value, axis) => value - evaluateCurve(bentRail, 2)[axis]);
for (const u of originalSamples(quarter).parameters) {
  closePoint(evaluateCurve(iso.curve, u), evaluateSurface(ordinary.surface, u, 3.5));
  closePoint(evaluateCurve(iso.curve, u), evaluateCurve(quarter, u).map((value, axis) => value + isoOffset[axis]));
  assert.ok(relative(evaluateCurveD1(iso.curve, u).derivative, evaluateCurveD1(quarter, u).derivative) <= 1e-7);
}
sourceFile('ordinary_selected_v_isocurve', iso.source, iso.model);
ownedFile('ordinary_selected_v_isocurve.owned', iso);

function intact() {
  for (const item of accepted) {
    assert.deepEqual(item.result, item.before); assert.deepEqual({profile: item.profile, rail: item.rail}, item.inputBefore);
  }
  assert.deepEqual(bentRail, railBefore); assert.deepEqual(ordinary, originalBefore);
  for (const [file, bytes] of retainedFiles) assert.deepEqual(readFileSync(file), bytes, file);
}
function reject(name, action, code) {
  assert.throws(action, error => {
    assert.ok(error instanceof TranslationalSweepError); assert.equal(error.name, 'TranslationalSweepError'); assert.equal(error.code, code);
    assert.ok(Object.values(TranslationalSweepDiagnosticCode).includes(error.code));
    assert.ok(error.message.startsWith('Translational sweep Surface: '));
    failures.push({name, code: error.code, message: error.message, actualCausePreserved: Object.hasOwn(error, 'cause')});
    intact(); return true;
  });
}
const refusalOptions = {surfaceId: 'refusal_surface', maximumObservations: 961};
reject('duplicate_curve_identity', () => build(quarter, {...bentRail, id: quarter.id}, refusalOptions), 'IDENTITY');
reject('surface_identity_collision', () => build(quarter, bentRail, {...refusalOptions, surfaceId: quarter.id}), 'IDENTITY');
reject('incomplete_pair_budget', () => build(quarter, bentRail, {...refusalOptions, maximumObservations: 8}), 'BUDGET');
reject('out_of_range_budget', () => build(quarter, bentRail, {...refusalOptions, maximumObservations: 962}), 'BUDGET');
let getterCalls = 0;
const getter = {...refusalOptions};
Object.defineProperty(getter, 'maximumObservations', {enumerable: true, get() { getterCalls++; return 961; }});
reject('input_getter', () => build(quarter, bentRail, getter), 'INPUT'); assert.equal(getterCalls, 0);
const ownedGetter = structuredClone(ordinary);
Object.defineProperty(ownedGetter, 'provenance', {enumerable: true, get() { getterCalls++; return ordinary.provenance; }});
reject('owned_getter', () => validate(ownedGetter), 'OWNED'); assert.equal(getterCalls, 0);
const wrongDegree = structuredClone(quarter); wrongDegree.degree = 4;
reject('unsupported_degree', () => build(wrongDegree, bentRail, refusalOptions), 'INPUT');
const unclamped = structuredClone(quarter); unclamped.knots[0] = -4;
reject('nonclamped_native_input', () => build(unclamped, bentRail, refusalOptions), 'INPUT');
const negativeWeight = structuredClone(quarter); negativeWeight.weights[1] = -1;
reject('negative_weight', () => build(negativeWeight, bentRail, refusalOptions), 'INPUT');
const nonfinite = structuredClone(bentRail); nonfinite.controlPoints[1][0] = Infinity;
reject('nonfinite_input', () => build(quarter, nonfinite, refusalOptions), 'INPUT');
const unitProfile = curve('unit_profile', 1, [0, 0, 1, 1], [[0, 0, 0], [0, 1, 0]], [1, 1]);
const unitRail = curve('unit_rail', 1, [2, 2, 5, 5], [[0, 0, 0], [1, 0, 0]], [1, 1]);
reject('derived_weight_above_bound', () => build({...unitProfile, weights: [1e6, 1e6]}, {...unitRail, weights: [2, 2]}, refusalOptions), 'REPRESENTABILITY');
reject('derived_weight_below_bound', () => build({...unitProfile, weights: [1e-6, 1e-6]}, {...unitRail, weights: [1e-6, 1e-6]}, refusalOptions), 'REPRESENTABILITY');
const boundaryProfile = {...unitProfile, controlPoints: [[9999, 0, 0], [10000, 1, 0]]};
reject('derived_coordinate_bound', () => build(boundaryProfile, {...unitRail, controlPoints: [[0, 0, 0], [2, 0, 0]]}, refusalOptions), 'REPRESENTABILITY');
const lostShiftProfile = {...unitProfile, controlPoints: [[9999, 0, 0], [9999, 1, 0]]};
reject('lost_nonzero_coordinate_shift', () => build(lostShiftProfile, {...unitRail, controlPoints: [[0, 0, 0], [1e-14, 0, 0]]}, refusalOptions), 'REPRESENTABILITY');
for (const [name, alter] of [
  ['source', result => result.source += ' '],
  ['coefficient', result => result.surface.controlPoints[0][1][0] += .25],
  ['rail', result => result.rail.controlPoints[1][2] += .25],
  ['anchor', result => result.provenance.anchorMM[0] += .1],
  ['provenance', result => result.provenance.poles[0].profilePoleIndex++],
  ['domain', result => result.report.domains.u[0] -= .5],
  ['native_derivative', result => result.report.observations[0].surfaceD1.value.du[0] += .1],
  ['counter', result => result.report.surfaceD1AttemptCount++],
]) {
  const altered = structuredClone(ordinary); alter(altered); reject('owned_' + name + '_tamper', () => validate(altered), 'OWNED');
}
assert.deepEqual(validate(ordinary), ordinary.report); intact();

const packageRoot = resolve(repo, 'packages/barocss-cad'), manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declaration = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declaration.import), declarationPath = resolve(packageRoot, declaration.types);
assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const runtimeNames = ['buildTranslationalSweepSurface', 'validateTranslationalSweepSurface', 'TranslationalSweepError', 'TranslationalSweepDiagnosticCode'];
const typeNames = ['TranslationalSweepOptions', 'TranslationalSweepProvenance', 'TranslationalSweepObservation', 'TranslationalSweepReport', 'TranslationalSweepResult'];
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.TranslationalSweepDiagnosticCode, TranslationalSweepDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./translational-sweep-surface.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/translational-sweep-surface.d.ts'), leafDeclaration = readFileSync(leafDeclarationPath, 'utf8');
for (const name of [...runtimeNames, ...typeNames]) assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(leafDeclaration), name);
const cold = JSON.parse(readFileSync(summaries[0].resultFile, 'utf8'));
const compiled = publicAPI.buildTranslationalSweepSurface(cold.profile, cold.rail, cold.options);
assert.deepEqual(compiled, ordinary); assert.deepEqual(publicAPI.validateTranslationalSweepSurface(compiled), ordinary.report);
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 9,
  declarationCheck: 'actual declaration export text; no separate TypeScript invocation'};
ownedFile('compiled-consumer', compiledConsumer);
const summary = {sourceMode: true, cadSourceInputCount: cadInputs.length, summaries, failures, compiledConsumer,
  caseCount: summaries.length, refusalCount: failures.length, isoCurveFile: resolve(output, 'ordinary_selected_v_isocurve.source0.css'),
  scope: 'Independent rational tensor-product translation with original Curve parameter units and actual native point/D1 guards.',
  geometricValidity: 'not-certified', regularityCertified: false, movingFrameCertified: false, solidCertified: false};
ownedFile('summary', summary); intact();
console.log(JSON.stringify(summary));
