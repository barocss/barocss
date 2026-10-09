import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node section-knot-alignment-demo.mjs --source <output-directory>'); assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]); mkdirSync(output, {recursive: true});
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json')), esbuild = require('esbuild');
const entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundle = await esbuild.build({absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true});
assert.equal(bundle.outputFiles.length, 1);
const sourceInputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path)), cadInputs = sourceInputs.filter(path => path.includes('/packages/barocss-cad/'));
for (const leaf of ['index.ts', 'section-knot-alignment.ts', 'curve-wide-refinement.ts', 'rational-ruled-surface.ts']) assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const {buildAlignedRationalRuledSurface: build, validateAlignedRationalRuledSurface: validate,
  SectionKnotAlignmentError, SectionKnotAlignmentDiagnosticCode, refineCurveWide, validateWideCurveRefinement, buildRationalRuledSurface,
  buildMultiSectionLoftSurface, MultiSectionLoftError, editCurveControlPolygon, evaluateCurve, evaluateCurveD1,
  evaluateSurface, evaluateSurfaceD1, curveDomain, surfaceDomain, compileCadModel} = api;
const runtimeNames = ['buildAlignedRationalRuledSurface', 'validateAlignedRationalRuledSurface', 'SectionKnotAlignmentError', 'SectionKnotAlignmentDiagnosticCode'];
const typeNames = ['SectionKnotAlignmentOptions', 'SectionKnotAlignmentSection', 'SectionKnotAlignmentReport', 'SectionKnotAlignmentResult'];
for (const name of runtimeNames) assert.equal(typeof api[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(Object.keys(SectionKnotAlignmentDiagnosticCode).sort(), ['INPUT', 'IDENTITY', 'BASIS', 'BUDGET', 'NATIVE', 'BINDING', 'OWNED'].sort());
const retainedFiles = new Map(), accepted = [], cases = [], failures = [];
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
function ownership(inputs, result) {
  const caller = new WeakSet(), seen = new WeakSet();
  const collect = value => { if (value && typeof value === 'object' && !caller.has(value)) { caller.add(value); for (const child of Object.values(value)) collect(child); }};
  inputs.forEach(collect);
  const visit = value => { if (value && typeof value === 'object') {
    assert.ok(!caller.has(value), 'Caller alias'); assert.ok(!seen.has(value), 'Repeated result occurrence'); seen.add(value); for (const child of Object.values(value)) visit(child);
  }}; visit(result);
}
const close = (actual, expected, label) => assert.ok(Math.hypot(...actual.map((value, i) => value - expected[i])) <= 1e-7, label);
function state(action) {
  try { return {status: 'evaluated', value: action()}; }
  catch (error) { return {status: 'native-refused', reason: error.message.slice(0, 1024)}; }
}
function ruledState(action) {
  try { return {kind: 'evaluated', result: action()}; }
  catch (error) { return {kind: 'refused', message: error.message.slice(0, 512)}; }
}
const curve = (id, degree, knots, controlPoints, weights) => ({kind: 'curve', id, degree, knots, controlPoints, weights});
const first = curve('section_a', 2, [-3, -3, -3, 1, 7, 7, 7], [[-2, 0, 0], [0, 2, 1], [3, -1, 2], [5, 0, 4]], [1, 2, .75, 1.5]);
const second = curve('section_b', 2, [-3, -3, -3, 3, 7, 7, 7], [[-1, 3, 1], [1, 4, 3], [4, 2, 4], [6, 3, 7]], [2, .75, 1.25, 1]);
const settings = (name, firstAlignedId, secondAlignedId, maximumInsertedKnots = 14, maximumRefinementOperations = 14) =>
  ({surfaceId: name + '_surface', firstAlignedId, secondAlignedId, resultIdPrefix: name.slice(0, 8), maximumInsertedKnots, maximumRefinementOperations});
function sampleParameters(knots, domain) {
  const breaks = [...new Set(knots)].filter(value => value >= domain[0] && value <= domain[1]), values = [...breaks];
  for (let i = 0; i + 1 < breaks.length; i++) {
    const midpoint = breaks[i] + (breaks[i + 1] - breaks[i]) / 2; if (midpoint > breaks[i] && midpoint < breaks[i + 1]) values.push(midpoint);
  }
  return values.sort((a, b) => a - b);
}
function check(name, a, b, options, expectedRequests, endpointOracle = false) {
  const before = structuredClone({a, b, options}), authored = jsonFile(name + '.authored-request', {first: a, second: b, options});
  const result = build(a, b, options); ownership([a, b, options], result); assert.deepEqual({a, b, options}, before);
  assert.deepEqual(Object.keys(result).sort(), ['originals', 'options', 'sections', 'ruled', 'originalSource', 'originalModel', 'report'].sort());
  assert.deepEqual(result.originals, [a, b]); assert.deepEqual(result.options, options); assert.deepEqual(result.originalModel.objects, [a, b]);
  assert.equal(result.originalModel.objects.length, 2); const originalFile = sourceFile(name + '.original-sections', result.originalSource, result.originalModel);
  const report = result.report, domain = curveDomain(a); assert.equal(report.schema, 'barocss-native-section-knot-alignment'); assert.equal(report.version, 0);
  assert.equal(report.lengthUnit, 'mm'); assert.equal(report.sourceFrame, 'authored-xyz-no-axis-conversion');
  assert.equal(report.parameterFrame, 'common-original-u-and-native-rational-v'); assert.equal(report.degree, a.degree);
  assert.deepEqual(report.requestPlan, expectedRequests); assert.deepEqual(report.commonDomain, domain); assert.deepEqual(report.originalDomains, [domain, curveDomain(b)]);
  assert.deepEqual(report.originalIds, [a.id, b.id]); assert.equal(report.surfaceId, options.surfaceId); assert.equal(report.originalModelId, result.originalModel.name);
  const inputSections = [a, b], aligned = result.sections.map(section => section.curve); let calls = 0, operations = 0, insertions = 0;
  for (const [i, section] of result.sections.entries()) {
    const original = inputSections[i], requests = expectedRequests[i], refinement = section.refinement;
    assert.deepEqual(Object.keys(section).sort(), ['index', 'originalId', 'curve', 'refinement'].sort()); assert.equal(section.index, i); assert.equal(section.originalId, original.id);
    assert.deepEqual(section.curve.knots, report.commonKnots); assert.equal(section.curve.controlPoints.length, report.targetPoleCount); assert.deepEqual(curveDomain(section.curve), domain);
    assert.equal(section.curve.id, i === 0 ? options.firstAlignedId : options.secondAlignedId);
    const work = report.sectionWork[i]; assert.equal(work.index, i); assert.equal(work.originalPoleCount, original.controlPoints.length); assert.equal(work.alignedPoleCount, section.curve.controlPoints.length);
    assert.equal(work.originalKnotCount, original.knots.length); assert.equal(work.alignedKnotCount, section.curve.knots.length);
    if (requests.length === 0) {
      assert.equal(refinement, null); assert.deepEqual(section.curve, original); assert.equal(report.sectionModes[i], 'untouched');
      assert.equal(work.refinementCallCount, 0); assert.equal(work.operationCount, 0); assert.equal(work.insertionCount, 0);
    } else {
      assert.ok(refinement); calls++; operations += refinement.provenance.operations.length; insertions += section.curve.controlPoints.length - original.controlPoints.length;
      assert.equal(report.sectionModes[i], 'refined'); assert.equal(work.refinementCallCount, 1); assert.equal(work.operationCount, refinement.provenance.operations.length);
      assert.equal(work.insertionCount, section.curve.controlPoints.length - original.controlPoints.length);
      assert.deepEqual(refinement.original, original); assert.deepEqual(refinement.curve, section.curve); assert.deepEqual(refinement.options.insertions, requests);
      assert.deepEqual(refinement, refineCurveWide(original, refinement.options)); assert.deepEqual(validateWideCurveRefinement(refinement), refinement.report);
      assert.deepEqual(refinement.provenance.parameterMap, {kind: 'identity', formula: 'u=t', d1Factor: 1});
      sourceFile(name + '.section_' + i + '.refinement-original', refinement.originalSource, refinement.originalModel);
      sourceFile(name + '.section_' + i + '.refined', refinement.source, refinement.model); assert.equal(refinement.model.objects.length, 1);
      for (const operation of refinement.provenance.operations) sourceFile(name + '.section_' + i + '.operation_' + operation.index, operation.source, operation.model);
      for (const copied of refinement.provenance.originalCopiedPoles) {
        assert.deepEqual(section.curve.controlPoints[copied.refinedPoleIndex], original.controlPoints[copied.originalPoleIndex]);
        assert.ok(Object.is(section.curve.weights[copied.refinedPoleIndex], original.weights[copied.originalPoleIndex]));
      }
      for (const copied of refinement.provenance.originalCopiedKnots) assert.ok(Object.is(section.curve.knots[copied.refinedKnotIndex], original.knots[copied.originalKnotIndex]));
      for (const guard of refinement.report.guards) {
        assert.deepEqual(guard.originalD1, state(() => evaluateCurveD1(original, guard.parameter)));
        assert.deepEqual(guard.refinedD1, state(() => evaluateCurveD1(section.curve, guard.parameter)));
      }
    }
  }
  assert.equal(report.refinementCallCount, calls); assert.equal(report.refinementOperationCount, operations); assert.equal(report.insertedKnotCount, insertions); assert.equal(report.ruledCallCount, 1);
  assert.deepEqual(report.inheritedObservations.refinementReports, result.sections.map(section => section.refinement?.report ?? null));
  assert.deepEqual(report.inheritedObservations.ruledReport, result.ruled.report);
  assert.deepEqual(report.sourceIds, {originalPair: result.originalModel.name,
    refinementOriginalContexts: result.sections.map(section => section.refinement?.originalModel.name ?? null),
    refinementFinalContexts: result.sections.map(section => section.refinement?.model.name ?? null),
    refinementStageContexts: result.sections.map(section => section.refinement?.provenance.operations.map(operation => operation.model.name) ?? []), ruledContext: result.ruled.model.name});
  assert.equal(report.quality.constructionOnly, true);
  for (const field of ['globalShapeErrorCertified', 'globalBinary64ErrorCertified', 'continuityCertified', 'solidCertified', 'manufacturingToleranceCertified', 'weightRepairSupported']) assert.equal(report.quality[field], false);
  assert.deepEqual(report.activeIds, aligned.map(section => section.id));
  for (const multiplicity of report.multiplicities) {
    const counts = inputSections.map(section => section.knots.filter(value => value === multiplicity.value).length);
    assert.equal(multiplicity.firstMultiplicity, counts[0]); assert.equal(multiplicity.secondMultiplicity, counts[1]);
    assert.equal(multiplicity.targetMultiplicity, Math.max(...counts)); assert.equal(multiplicity.firstDeficit, multiplicity.targetMultiplicity - counts[0]);
    assert.equal(multiplicity.secondDeficit, multiplicity.targetMultiplicity - counts[1]);
  }
  const ruled = result.ruled; assert.deepEqual(ruled, buildRationalRuledSurface(aligned[0], aligned[1], {surfaceId: options.surfaceId}));
  assert.deepEqual(ruled.first, aligned[0]); assert.deepEqual(ruled.second, aligned[1]); assert.deepEqual(ruled.model.objects, [...aligned, ruled.surface]); assert.equal(ruled.model.objects.length, 3);
  assert.equal(ruled.surface.degreeU, a.degree); assert.equal(ruled.surface.degreeV, 1); assert.deepEqual(ruled.surface.knotsU, report.commonKnots); assert.deepEqual(ruled.surface.knotsV, [0, 0, 1, 1]);
  assert.deepEqual(ruled.surface.weights, aligned[0].weights.map((weight, i) => [weight, aligned[1].weights[i]]));
  assert.deepEqual(surfaceDomain(ruled.surface), {u: domain, v: [0, 1]}); const ruledFile = sourceFile(name + '.actual-ruled', ruled.source, ruled.model);
  const independentObservations = [];
  for (const parameter of sampleParameters(report.commonKnots, domain)) {
    const observations = inputSections.map((original, i) => {
      const originalPoint = evaluateCurve(original, parameter), alignedPoint = evaluateCurve(aligned[i], parameter); close(alignedPoint, originalPoint, 'actual original/aligned D0');
      const originalD1 = state(() => evaluateCurveD1(original, parameter)), alignedD1 = state(() => evaluateCurveD1(aligned[i], parameter));
      if (originalD1.status === 'evaluated' && alignedD1.status === 'evaluated') {
        const difference = Math.hypot(...originalD1.value.derivative.map((value, axis) => value - alignedD1.value.derivative[axis]));
        assert.ok(difference <= 1e-7 * Math.max(1, Math.hypot(...originalD1.value.derivative)));
      }
      return {originalPoint, alignedPoint, originalD1, alignedD1};
    });
    close(evaluateSurface(ruled.surface, parameter, 0), observations[0].originalPoint, 'native first Surface boundary');
    close(evaluateSurface(ruled.surface, parameter, 1), observations[1].originalPoint, 'native second Surface boundary');
    independentObservations.push({parameter, sections: observations, surfaceD1: state(() => evaluateSurfaceD1(ruled.surface, parameter, .5))});
  }
  for (const observation of ruled.report.derivativeObservations) {
    assert.deepEqual(observation.first, ruledState(() => evaluateCurveD1(aligned[0], observation.u)));
    assert.deepEqual(observation.second, ruledState(() => evaluateCurveD1(aligned[1], observation.u)));
    assert.deepEqual(observation.surface, ruledState(() => evaluateSurfaceD1(ruled.surface, observation.u, observation.v)));
  }
  for (const observation of ruled.report.observations) if (observation.kind === 'evaluated') {
    close(observation.firstPointMM, evaluateCurve(a, observation.u), 'actual original first section in rational observation');
    close(observation.secondPointMM, evaluateCurve(b, observation.u), 'actual original second section in rational observation');
    close(observation.actualPointMM, evaluateSurface(ruled.surface, observation.u, observation.v), 'actual rational Surface D0');
    const fraction = observation.v * observation.secondDenominator / ((1 - observation.v) * observation.firstDenominator + observation.v * observation.secondDenominator);
    close(observation.actualPointMM, observation.firstPointMM.map((value, i) => (1 - fraction) * value + fraction * observation.secondPointMM[i]), 'actual denominator-weighted section point');
  }
  if (endpointOracle) {
    close(evaluateSurface(ruled.surface, -3, .5), [-4 / 3, 2, 2 / 3], 'independent rational first endpoint');
    close(evaluateSurface(ruled.surface, 7, .5), [5.4, 1.2, 5.2], 'independent rational last endpoint');
    assert.ok(Math.hypot(...evaluateSurface(ruled.surface, -3, .5).map((value, i) => value - [-1.5, 1.5, .5][i])) > .1, 'Independent weights change rational V meaning');
  }
  jsonFile(name + '.independent-native-observations', independentObservations); assert.deepEqual(validate(result), report);
  const saved = jsonFile(name + '.owned-alignment', result), cold = compileCadModel(readFileSync(originalFile, 'utf8'), {sourceVersion: 0});
  assert.equal(cold.ok, true); assert.deepEqual(cold.model.objects, [authored.reopened.first, authored.reopened.second]);
  assert.deepEqual(build(cold.model.objects[0], cold.model.objects[1], authored.reopened.options), saved.reopened); assert.deepEqual(validate(saved.reopened), report);
  accepted.push({a, b, options, before, result, resultBefore: structuredClone(result)});
  cases.push({name, targetPoles: report.targetPoleCount, refinementCalls: calls, operations, insertedKnots: insertions, ruledCalls: 1,
    originalFile, ruledFile, authoredFile: authored.file, resultFile: saved.file}); return result;
}
jsonFile('source-api.inputs', {entry, sourceInputs, cadInputs, sourceOnly: true, write: false, esbuildVersion: esbuild.version});
jsonFile('source-api.metafile', bundle.metafile);
const both = check('both', first, second, settings('both', 'both_a_aligned', 'both_b_aligned'),
  [[{parameter: 3, count: 1}], [{parameter: 1, count: 1}]], true);
const one = check('one', both.sections[0].curve, second, settings('one', both.sections[0].curve.id, 'one_b_aligned'),
  [[], [{parameter: 1, count: 1}]], true);
check('noop', both.sections[0].curve, both.sections[1].curve, settings('noop', both.sections[0].curve.id, both.sections[1].curve.id, 0, 0), [[], []], true);
const edited = editCurveControlPolygon(second, {poleEdits: [{index: 1, zMM: 7, weight: 1.5}]}), editedBefore = structuredClone(edited);
sourceFile('edit.actual-curve', edited.source, edited.model); jsonFile('edit.actual-owned-edit', edited);
const editResult = check('edited', first, edited.curve, settings('edited', 'edited_a_aligned', 'edited_b_aligned'),
  [[{parameter: 3, count: 1}], [{parameter: 1, count: 1}]], true);
assert.deepEqual(edited, editedBefore); assert.ok(Math.hypot(...evaluateSurface(editResult.ruled.surface, 2, 1).map((value, i) => value - evaluateSurface(both.ruled.surface, 2, 1)[i])) > .1);
const guardFirst = curve('guard_a', 2, [-3, -3, -3, 1, 1, 7, 7, 7],
  [[-2, 0, 0], [0, 2, 1], [2, 0, 2], [4, -1, 3], [5, 0, 4]], [1, 2, .75, 1.25, 1.5]);
const guarded = check('guard', guardFirst, second, settings('guard', 'guard_a_aligned', 'guard_b_aligned'),
  [[{parameter: 3, count: 1}], [{parameter: 1, count: 2}]], true);
assert.equal(state(() => evaluateCurveD1(second, 1)).status, 'evaluated'); assert.equal(state(() => evaluateCurveD1(guarded.sections[1].curve, 1)).status, 'native-refused');
assert.equal(state(() => evaluateSurfaceD1(guarded.ruled.surface, 1, .5)).status, 'native-refused');
const innerA = Array.from({length: 13}, (_, i) => -2.5 + .5 * i), innerB = [...innerA.slice(0, -1), 4];
function wideSection(id, inner, offset) {
  const count = inner.length + 2; return curve(id, 1, [-3, -3, ...inner, 7, 7],
    Array.from({length: count}, (_, i) => [i / 4 + offset, 3 * offset, i / 8 + offset]), Array.from({length: count}, (_, i) => 1 + offset + i / 32));
}
const maximum = check('max16', wideSection('max_first', innerA, 0), wideSection('max_second', innerB, 1), settings('max16', 'max_a_aligned', 'max_b_aligned'),
  [[{parameter: 4, count: 1}], [{parameter: 3.5, count: 1}]]);
assert.equal(maximum.ruled.surface.controlPoints.length, 16); assert.equal(maximum.ruled.report.controlPointCounts.total, 32);
function intact() {
  for (const row of accepted) { assert.deepEqual({a: row.a, b: row.b, options: row.options}, row.before); assert.deepEqual(row.result, row.resultBefore); }
  assert.deepEqual(edited, editedBefore); for (const [file, bytes] of retainedFiles) assert.deepEqual(readFileSync(file), bytes, file);
}
function reject(name, action, code, causeRequired = false) {
  assert.throws(action, error => {
    assert.ok(error instanceof SectionKnotAlignmentError); assert.equal(error.name, 'SectionKnotAlignmentError'); assert.equal(error.code, code); assert.ok(error.message.length <= 1024);
    if (causeRequired) assert.ok(error.cause instanceof Error);
    failures.push({name, code: error.code, message: error.message, causeName: error.cause?.name ?? null, causeCode: error.cause?.code ?? null}); intact(); return true;
  });
}
const inner16A = Array.from({length: 14}, (_, i) => -2.5 + .5 * i), inner16B = [...inner16A.slice(0, -1), 4.5];
reject('union17_capacity', () => build(wideSection('capacity_a', inner16A, 0), wideSection('capacity_b', inner16B, 1), settings('capacity', 'capacity_a_new', 'capacity_b_new')), 'BUDGET');
reject('complete_insertion_budget', () => build(first, second, settings('badins', 'badins_a', 'badins_b', 1, 14)), 'BUDGET');
reject('complete_operation_budget', () => build(first, second, settings('badops', 'badops_a', 'badops_b', 14, 1)), 'BUDGET');
reject('domain_mismatch', () => build(first, {...second, knots: [-2, -2, -2, 3, 7, 7, 7]}, settings('domain', 'domain_a', 'domain_b')), 'BASIS');
const overMultiplicity = curve('over_multiplicity', 2, [-3, -3, -3, 1, 1, 1, 7, 7, 7],
  [[-2, 0, 0], [0, 2, 1], [1, 0, 1], [2, 0, 2], [4, -1, 3], [5, 0, 4]], [1, 2, 1, .75, 1.25, 1.5]);
reject('actual_native_multiplicity_refusal', () => build(overMultiplicity, second, settings('multi', 'multi_a', 'multi_b')), 'NATIVE', true);
reject('degree_mismatch', () => build(first, curve('line_section', 1, [-3, -3, 7, 7], [[0, 3, 1], [4, 3, 6]], [1, 2]), settings('degree', 'degree_a', 'degree_b')), 'BASIS');
const signA = curve('sign_a', 2, [-3, -3, -3, -0, 7, 7, 7], first.controlPoints, first.weights), signB = {...second, id: 'sign_b', knots: [-3, -3, -3, 0, 7, 7, 7]};
reject('interior_knot_sign_ambiguity', () => build(signA, signB, settings('sign', 'sign_a_new', 'sign_b_new')), 'BASIS');
const mixedZero = curve('mixed_zero_a', 2, [-3, -3, -3, -0, 0, 7, 7, 7], guardFirst.controlPoints, guardFirst.weights);
reject('within_curve_knot_sign_ambiguity', () => build(mixedZero, second, settings('mixed', 'mixed_a', 'mixed_b')), 'BASIS');
reject('original_id_collision', () => build(first, {...second, id: first.id}, settings('ids', 'ids_a', 'ids_b')), 'IDENTITY');
reject('untouched_rename', () => build(both.sections[0].curve, second, settings('rename', 'fake_renamed', 'rename_b')), 'IDENTITY');
reject('surface_id_collision', () => build(first, second, {...settings('surf', 'surf_a', 'surf_b'), surfaceId: first.id}), 'IDENTITY');
reject('refinement_stage_collision', () => build(first, second, settings('stage', 'stage_b_step_0', 'stage_output_b')), 'IDENTITY');
let getterCalls = 0;
const getter = {...settings('getter', 'getter_a', 'getter_b')}; Object.defineProperty(getter, 'maximumInsertedKnots', {enumerable: true, get() { getterCalls++; return 14; }});
reject('options_getter', () => build(first, second, getter), 'INPUT');
const nestedGetter = structuredClone(second); Object.defineProperty(nestedGetter.weights, '0', {enumerable: true, get() { getterCalls++; return 2; }});
reject('section_getter', () => build(first, nestedGetter, settings('data', 'data_a', 'data_b')), 'INPUT'); assert.equal(getterCalls, 0);
const tinyFirst = curve('tiny_first', 1, [0, 0, Number.MIN_VALUE, 1, 1], [[0, 1, 0], [0, 2, 0], [1, 2, 0]], [1, 1, 1]);
const tinySecond = curve('tiny_second', 1, [0, 0, 1, 1], [[0, 0, 0], [1, 1, 1]], [1, 1]);
reject('actual_refinement_provider_failure', () => build(tinyFirst, tinySecond, settings('tiny', tinyFirst.id, 'tiny_second_new')), 'NATIVE', true);
assert.equal(failures.at(-1).causeCode, 'REPRESENTABILITY');
let loftError;
try { buildMultiSectionLoftSurface(both.sections.map(section => section.curve), [-2, 3],
  {surfaceId: 'unchanged_weight_guard', degreeV: 1, maximumBasisEvaluations: 3600, maximumEliminationSteps: 1680, maximumObservations: 465}); } catch (error) { loftError = error; }
assert.ok(loftError instanceof MultiSectionLoftError); assert.equal(loftError.code, 'BASIS'); intact();
jsonFile('unchanged-952-weight-guard', {actualAPI: 'buildMultiSectionLoftSurface', code: loftError.code, message: loftError.message, weightsUnchanged: both.sections.map(section => section.curve.weights)});
for (const [name, alter] of [
  ['curve', result => { result.sections[0].curve.controlPoints[0][0] += .1; }], ['refinement', result => { result.sections[0].refinement.source += ' '; }],
  ['surface', result => { result.ruled.surface.weights[0][0] += .1; }], ['source', result => { result.originalSource += ' '; }],
  ['count', result => { result.report.refinementCallCount++; }], ['plan', result => { result.report.requestPlan[0][0].count++; }],
]) { const changed = structuredClone(both); alter(changed); reject('owned_' + name, () => validate(changed), 'OWNED'); }
let replacement = both; const previous = replacement;
reject('atomic_previous_result', () => { replacement = build(tinyFirst, tinySecond, settings('tiny', tinyFirst.id, 'tiny_second_new')); }, 'NATIVE', true);
assert.strictEqual(replacement, previous); jsonFile('atomic-retention', {previousResultUnchanged: replacement === previous, getterCalls});
const packageRoot = resolve(repo, 'packages/barocss-cad'), manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.publishConfig?.exports?.['.'] ?? manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath)); const publicAPI = await import(pathToFileURL(runtimePath).href);
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.SectionKnotAlignmentDiagnosticCode, SectionKnotAlignmentDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./section-knot-alignment.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/section-knot-alignment.d.ts'), declaration = readFileSync(leafDeclarationPath, 'utf8');
for (const name of [...runtimeNames, ...typeNames]) assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(declaration), name);
for (const row of cases) {
  const authored = JSON.parse(readFileSync(row.authoredFile, 'utf8')), saved = JSON.parse(readFileSync(row.resultFile, 'utf8'));
  const cold = publicAPI.compileCadModel(readFileSync(row.originalFile, 'utf8'), {sourceVersion: 0}); assert.equal(cold.ok, true); assert.deepEqual(cold.model.objects, [authored.first, authored.second]);
  assert.deepEqual(publicAPI.buildAlignedRationalRuledSurface(cold.model.objects[0], cold.model.objects[1], authored.options), saved);
  assert.deepEqual(publicAPI.validateAlignedRationalRuledSurface(saved), saved.report);
}
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 8, caseCount: cases.length,
  exportSelection: manifest.publishConfig?.exports?.['.'] ? 'publishConfig.exports root' : 'exports root',
  declarationCheck: 'actual built declarations and API consumption; no separate TypeScript invocation'};
jsonFile('compiled-consumer', compiledConsumer); intact();
const summary = {sourceMode: true, cadSourceInputCount: cadInputs.length, cases, failures, compiledConsumer, caseCount: cases.length, refusalCount: failures.length,
  getterCalls, unchanged952WeightGuard: true, toleranceMM: 1e-7,
  scope: 'Actual native same-degree/common-domain knot alignment and independently weighted rational ruled construction; actual formal D1 refusals retained, no weight repair, global shape, G1/G2 or Solid certificate.'};
jsonFile('summary', summary); intact(); console.log(JSON.stringify(summary));
