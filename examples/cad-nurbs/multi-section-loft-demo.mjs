import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node multi-section-loft-demo.mjs --source <output-directory>'); assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]);
mkdirSync(output, {recursive: true});
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const esbuild = require('esbuild'), entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundled = await esbuild.build({absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node',
  format: 'esm', write: false, target: 'es2022', metafile: true});
assert.equal(bundled.outputFiles.length, 1);
const sourceInputs = Object.keys(bundled.metafile.inputs).map(path => resolve(repo, path));
const cadInputs = sourceInputs.filter(path => path.includes('/packages/barocss-cad/'));
for (const file of ['index.ts', 'multi-section-loft.ts', 'curve-interpolation.ts']) assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src', file)));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const {buildMultiSectionLoftSurface: build, validateMultiSectionLoftSurface: validate, MultiSectionLoftError, MultiSectionLoftDiagnosticCode,
  CurveInterpolationError, validateInterpolatingCurve, buildCompatibleRuledSurface, editCurveControlPolygon,
  evaluateCurve, evaluateCurveD1, evaluateSurface, evaluateSurfaceD1, curveDomain, surfaceDomain, compileCadModel, extractSurfaceIsoCurve} = api;
for (const operation of [build, validate, MultiSectionLoftError]) assert.equal(typeof operation, 'function');
assert.deepEqual(Object.keys(MultiSectionLoftDiagnosticCode).sort(),
  ['INPUT', 'IDENTITY', 'BASIS', 'BUDGET', 'NATIVE', 'REPRESENTABILITY', 'CONDITIONING', 'BINDING', 'OWNED'].sort());
const accepted = [], summaries = [], failures = [], retainedFiles = new Map();
const difference = (a, b) => Math.hypot(...a.map((value, axis) => value - b[axis]));
const closePoint = (a, b) => assert.ok(difference(a, b) <= 1e-7);
const relative = (a, b) => difference(a, b) / Math.max(1, Math.hypot(...a), Math.hypot(...b));
const curve = (id, degree, knots, controlPoints, weights) => ({kind: 'curve', id, degree, knots, controlPoints, weights});
function nativeJSON(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || ['string', 'boolean'].includes(typeof value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}';
}
function ownedFile(name, value) {
  const file = resolve(output, name + '.json'); writeFileSync(file, nativeJSON(value) + '\n'); retainedFiles.set(file, readFileSync(file));
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
function state(action) {
  try { return {status: 'evaluated', value: action()}; }
  catch (error) { return {status: 'native-refused', reason: error.message.slice(0, 1024), nativeErrorName: error.name}; }
}
function uSamples(section) {
  const domain = curveDomain(section), breaks = [];
  for (const knot of section.knots) if (knot >= domain[0] && knot <= domain[1] && !breaks.some(value => value === knot)) breaks.push(knot);
  const values = [...breaks], gaps = [];
  for (let index = 0; index < breaks.length - 1; index++) {
    const midpoint = breaks[index] + (breaks[index + 1] - breaks[index]) / 2;
    if (midpoint > breaks[index] && midpoint < breaks[index + 1]) values.push(midpoint);
    else gaps.push({domain: [breaks[index], breaks[index + 1]], attemptedParameter: midpoint});
  }
  return {values: values.sort((a, b) => a - b), gaps};
}
function spanProbes(knots, domain) {
  const breaks = [];
  for (const knot of knots) if (knot >= domain[0] && knot <= domain[1] && !breaks.some(value => value === knot)) breaks.push(knot);
  return breaks.slice(0, -1).map((value, index) => value + (breaks[index + 1] - value) / 2);
}
const quarterKnots = [-3, -3, -3, 7, 7, 7], quarterWeights = [1, Math.SQRT1_2, 1];
const radius = v => 2 + v / 8 + v * v / 64, center = v => [v / 4, v * v / 16, 1 + v / 2 + v * v / 32];
function quarterSection(id, v) {
  const [x, y, z] = center(v), r = radius(v);
  return curve(id, 2, [...quarterKnots], [[x + r, y, z], [x + r, y + r, z], [x, y + r, z]], [...quarterWeights]);
}
function unitQuarter(u) {
  const t = (u + 3) / 10, a = 1 - t, w = Math.SQRT1_2;
  const denominator = a * a + 2 * w * t * a + t * t, x = a * a + 2 * w * t * a, y = 2 * w * t * a + t * t;
  const dd = -2 * a + 2 * w * (1 - 2 * t) + 2 * t;
  const dx = -2 * a + 2 * w * (1 - 2 * t), dy = 2 * w * (1 - 2 * t) + 2 * t;
  return {point: [x / denominator, y / denominator], derivative: [(dx * denominator - x * dd) / (denominator * denominator) / 10,
    (dy * denominator - y * dd) / (denominator * denominator) / 10]};
}
function quarterPoint(u, v) {
  const q = unitQuarter(u).point, c = center(v), r = radius(v); return [c[0] + r * q[0], c[1] + r * q[1], c[2]];
}
function quarterD1(u, v) {
  const q = unitQuarter(u), r = radius(v), dr = 1 / 8 + v / 32;
  return {du: [r * q.derivative[0], r * q.derivative[1], 0], dv: [1 / 4 + dr * q.point[0], v / 8 + dr * q.point[1], .5 + v / 16]};
}
const linearParameters = [2, 5], linearSections = linearParameters.map((v, index) => quarterSection('linear_section_' + index, v));
const quarterParameters = [-2, -1, 0, 2, 4], quarterSections = quarterParameters.map((v, index) => quarterSection('quarter_section_' + index, v));
quarterSections[2].controlPoints[0][1] = -0;
const cubicBase = curve('cubic_base_witness', 3, [-2, -2, -2, -2, 6, 6, 6, 6], [[0, 0, 0], [1, 2, 1], [3, -1, 2], [4, 1, 0]], [1, 2, 2, 1]);
const cubicShift = v => [v / 4, v * v / 32, v / 2 + v ** 3 / 128];
const cubicParameters = [-3, -1, 2, 5], cubicSections = cubicParameters.map((v, index) => ({...structuredClone(cubicBase), id: 'cubic_section_' + index,
  controlPoints: cubicBase.controlPoints.map(point => point.map((value, axis) => value + cubicShift(v)[axis]))}));
const cubicPoint = (u, v) => evaluateCurve(cubicBase, u).map((value, axis) => value + cubicShift(v)[axis]);
const cubicD1 = (u, v) => ({du: evaluateCurveD1(cubicBase, u).derivative, dv: [.25, v / 16, .5 + 3 * v * v / 128]});
const maximumParameters = Array.from({length: 15}, (_, index) => index - 7);
const maximumKnots = [-0, -0, ...Array.from({length: 14}, (_, index) => index + 1), 15, 15];
const maximumWeights = Array.from({length: 16}, (_, index) => 1 + index / 64);
const maximumSections = maximumParameters.map((v, index) => curve('maximum_section_' + index, 1, [...maximumKnots],
  Array.from({length: 16}, (_, i) => [i / 2, i % 2 / 4, v / 4 + i / 32]), [...maximumWeights]));
const constantParameters = [-0, 1, 3, 5], constantSections = constantParameters.map((_, index) =>
  curve('coincident_section_' + index, 2, [...quarterKnots], [[2, -0, 0], [2, 2, 0], [0, 2, 0]], [...quarterWeights]));
ownedFile('source-api.metafile', bundled.metafile);
ownedFile('source-api.inputs', {entry, mode: 'in-memory-esbuild', write: false, sourceInputs, cadInputs, esbuildVersion: esbuild.version});

function check(name, sections, parametersV, degreeV, surfaceId, pointWitness = null, derivativeWitness = null) {
  const before = structuredClone({sections, parametersV}), first = sections[0], n = sections.length, m = first.controlPoints.length;
  const sampled = uSamples(first), planned = {basisEvaluations: m * n * n, eliminationSteps: m * n * (n - 1) / 2,
    observations: sampled.values.length * n, rowCurveConstructions: m, nestedCurvePointEvaluations: m * n, representativeVD1Evaluations: n};
  const options = {surfaceId, degreeV, maximumBasisEvaluations: planned.basisEvaluations, maximumEliminationSteps: planned.eliminationSteps,
    maximumObservations: planned.observations};
  const authored = ownedFile(name + '.authored-sections', {sections, parametersV, options});
  const result = build(sections, parametersV, options); ownership([sections, parametersV, options], result);
  assert.deepEqual({sections, parametersV}, before);
  assert.deepEqual(Object.keys(result).sort(), ['sections', 'parametersV', 'options', 'surface', 'source', 'sourceVersion', 'model', 'provenance', 'report'].sort());
  assert.deepEqual(result.sections, sections); assert.deepEqual(result.parametersV, parametersV); assert.deepEqual(result.options, options);
  const surface = result.surface, domains = {u: curveDomain(first), v: [parametersV[0], parametersV[n - 1]]};
  assert.equal(surface.id, surfaceId); assert.equal(surface.degreeU, first.degree); assert.equal(surface.degreeV, degreeV);
  assert.deepEqual(surface.knotsU, first.knots); assert.deepEqual(surfaceDomain(surface), domains);
  assert.equal(surface.controlPoints.length, m); assert.ok(surface.controlPoints.every(row => row.length === n));
  assert.deepEqual(surface.weights, first.weights.map(weight => Array(n).fill(weight)));
  for (let i = 0; i < m; i++) {
    assert.deepEqual(surface.controlPoints[i][0], sections[0].controlPoints[i]);
    assert.deepEqual(surface.controlPoints[i][n - 1], sections[n - 1].controlPoints[i]);
  }
  const provenance = result.provenance, report = result.report;
  assert.equal(provenance.kind, 'compatible-rational-u-polynomial-v-section-interpolation');
  assert.deepEqual(provenance.sectionIds, sections.map(section => section.id)); assert.equal(provenance.surfaceId, surfaceId);
  assert.deepEqual(provenance.originalUKnots, first.knots); assert.deepEqual(provenance.originalUWeights, first.weights);
  assert.deepEqual(provenance.parametersV, parametersV); assert.equal(provenance.endpointBitsPreserved, true);
  assert.equal(provenance.rowCurves.length, m);
  const rowIds = provenance.rowCurves.map(row => row.curveId);
  assert.equal(new Set([...sections.map(section => section.id), surface.id, ...rowIds]).size, n + 1 + m);
  for (const [i, row] of provenance.rowCurves.entries()) {
    assert.equal(row.poleIndex, i); assert.equal(row.curveId, row.evaluation.curve.id);
    const child = row.evaluation;
    assert.deepEqual(child.points, parametersV.map((parameter, j) => ({parameter, pointMM: sections[j].controlPoints[i]})));
    assert.deepEqual(child.options, {curveId: row.curveId, degree: degreeV, maximumBasisEvaluations: n * n, maximumEliminationSteps: n * (n - 1) / 2});
    assert.deepEqual(child.curve.knots, surface.knotsV); assert.deepEqual(child.curve.weights, Array(n).fill(1));
    assert.deepEqual(child.curve.controlPoints, surface.controlPoints[i]); assert.deepEqual(validateInterpolatingCurve(child), child.report);
    if (i === 0) sourceFile(name + '.representative-row', child.source, child.model);
  }
  assert.equal(provenance.poleMappings.length, m * n); assert.equal(provenance.weightMappings.length, m * n);
  for (const [index, mapping] of provenance.poleMappings.entries()) {
    const i = Math.floor(index / n), j = index % n, endpoint = j === 0 || j === n - 1;
    assert.deepEqual(mapping.surfacePole, [i, j]); assert.equal(mapping.rowCurveId, rowIds[i]); assert.equal(mapping.rowCurvePoleIndex, j);
    assert.equal(mapping.origin, endpoint ? 'original-endpoint-bit-copy' : 'row-interpolation-solved');
    assert.equal(mapping.originalSectionIndex, endpoint ? j : null); assert.equal(mapping.originalPoleIndex, endpoint ? i : null);
    assert.deepEqual(mapping.pointMM, surface.controlPoints[i][j]);
    assert.deepEqual(provenance.weightMappings[index], {surfacePole: [i, j], origin: 'common-u-weight-bit-copy',
      originalSectionIndex: 0, originalPoleIndex: i, weight: first.weights[i]});
  }
  assert.deepEqual(provenance.uKnotMappings, first.knots.map((value, index) => ({originalKnotIndex: index, surfaceKnotIndex: index,
    originalValue: value, surfaceValue: value})));
  assert.deepEqual(provenance.vKnotMappings, surface.knotsV.map((value, index) => ({rowCurveKnotIndex: index, surfaceKnotIndex: index,
    rowCurveValue: value, surfaceValue: value})));
  assert.equal(report.schema, 'barocss-native-multi-section-loft'); assert.equal(report.version, 0);
  assert.equal(report.surfaceId, surfaceId); assert.deepEqual(report.sectionIds, provenance.sectionIds);
  assert.equal(report.lengthUnit, 'mm'); assert.equal(report.sourceFrame, 'authored-xyz-no-axis-conversion');
  assert.equal(report.degreeU, first.degree); assert.equal(report.degreeV, degreeV); assert.equal(report.sectionCount, n);
  assert.deepEqual(report.controlPointGrid, [m, n]); assert.deepEqual(report.domains, domains); assert.deepEqual(report.parametersV, parametersV);
  assert.deepEqual(report.axisRoles, {u: 'original-common-section-parameter', v: 'original-section-interpolation-parameter'});
  assert.deepEqual(report.uSamples, sampled.values); assert.deepEqual(report.unrepresentedMidpointIntervals, sampled.gaps); assert.deepEqual(report.plannedCounts, planned);
  assert.equal(report.rowCurveConstructionCount, m);
  assert.equal(report.basisEvaluationCount, provenance.rowCurves.reduce((sum, row) => sum + row.evaluation.report.basisEvaluationCount, 0));
  assert.equal(report.eliminationStepCount, provenance.rowCurves.reduce((sum, row) => sum + row.evaluation.report.eliminationStepCount, 0));
  assert.equal(report.nestedCurvePointEvaluationCount, provenance.rowCurves.reduce((sum, row) => sum + row.evaluation.report.pointEvaluationCount, 0));
  assert.equal(report.basisEvaluationCount, planned.basisEvaluations); assert.equal(report.eliminationStepCount, planned.eliminationSteps);
  assert.equal(report.nestedCurvePointEvaluationCount, planned.nestedCurvePointEvaluations);
  assert.equal(report.representativeVD1AttemptCount, n); assert.equal(report.representativeVStates.length, n);
  const representative = provenance.rowCurves[0].evaluation.curve;
  for (const [j, entry] of report.representativeVStates.entries()) {
    assert.equal(entry.sectionIndex, j); assert.ok(Object.is(entry.parameter, parametersV[j])); assert.equal(entry.curveId, representative.id);
    assert.deepEqual(entry.state, state(() => evaluateCurveD1(representative, parametersV[j])));
  }
  for (const field of ['observationCount', 'originalCurveD0EvaluationCount', 'surfaceD0EvaluationCount', 'originalCurveD1AttemptCount', 'surfaceD1AttemptCount'])
    assert.equal(report[field], planned.observations);
  assert.equal(report.observations.length, planned.observations);
  const evidence = [], pairs = new Set();
  let comparisonCount = 0, refusalCount = 0, originalRefusalCount = 0, surfaceRefusalCount = 0, maximumDifference = 0, maximumRelative = 0;
  for (const observation of report.observations) {
    const j = observation.sectionIndex, u = observation.u; assert.ok(j >= 0 && j < n); assert.ok(sampled.values.some(value => Object.is(value, u)));
    assert.ok(Object.is(observation.v, parametersV[j])); assert.equal(observation.representativeVStateIndex, j);
    const key = sampled.values.findIndex(value => Object.is(value, u)) + ':' + j; assert.ok(!pairs.has(key)); pairs.add(key);
    const original = evaluateCurve(sections[j], u), actual = evaluateSurface(surface, u, parametersV[j]);
    assert.deepEqual(observation.originalPointMM, original); assert.deepEqual(observation.actualPointMM, actual);
    const residual = difference(original, actual); assert.equal(observation.differenceMM, residual); assert.ok(residual <= 1e-7);
    maximumDifference = Math.max(maximumDifference, residual);
    const originalD1 = state(() => evaluateCurveD1(sections[j], u)), surfaceD1 = state(() => evaluateSurfaceD1(surface, u, parametersV[j]));
    assert.deepEqual(observation.originalD1, originalD1); assert.deepEqual(observation.surfaceD1, surfaceD1);
    const vRefused = report.representativeVStates[j].state.status === 'native-refused';
    assert.equal(surfaceD1.status === 'native-refused', originalD1.status === 'native-refused' || vRefused);
    if (originalD1.status === 'native-refused') originalRefusalCount++;
    if (surfaceD1.status === 'native-refused') surfaceRefusalCount++;
    if (surfaceD1.status === 'evaluated') {
      comparisonCount++; const residualDu = relative(surfaceD1.value.du, originalD1.value.derivative);
      assert.equal(observation.relativeDuDifference, residualDu); assert.ok(residualDu <= 1e-7); maximumRelative = Math.max(maximumRelative, residualDu);
    } else { refusalCount++; assert.equal(observation.relativeDuDifference, null); }
    evidence.push({u, v: parametersV[j], sectionIndex: j, originalPointMM: original, actualPointMM: actual, originalD1, surfaceD1});
  }
  assert.equal(pairs.size, planned.observations); assert.equal(report.derivativeComparisonCount, comparisonCount); assert.equal(report.derivativeRefusalCount, refusalCount);
  assert.deepEqual(report.derivativeSourceRefusalCounts, {originalU: originalRefusalCount,
    representativeV: report.representativeVStates.filter(entry => entry.state.status === 'native-refused').length, surface: surfaceRefusalCount});
  assert.equal(report.maximumPointDifferenceMM, maximumDifference); assert.equal(report.maximumRelativeDuDifference, comparisonCount ? maximumRelative : null);
  const guards = sampled.values.filter(value => value > domains.u[0] && value < domains.u[1] && first.knots.filter(knot => knot === value).length >= first.degree);
  assert.deepEqual(report.guardedParameters, {u: guards, v: []});
  const analytic = [];
  if (pointWitness) for (const u of spanProbes(surface.knotsU, domains.u)) for (const v of spanProbes(surface.knotsV, domains.v)) {
    const actual = evaluateSurface(surface, u, v), expected = pointWitness(u, v); closePoint(actual, expected);
    const nativeD1 = evaluateSurfaceD1(surface, u, v), expectedD1 = derivativeWitness(u, v);
    assert.ok(relative(nativeD1.du, expectedD1.du) <= 1e-7); assert.ok(relative(nativeD1.dv, expectedD1.dv) <= 1e-7);
    analytic.push({u, v, actualPointMM: actual, expectedPointMM: expected, actualD1: nativeD1, expectedD1});
  }
  assert.equal(report.sourceModelObjectCount, n + 1); assert.equal(result.sourceVersion, 0); assert.deepEqual(result.model.objects, [...sections, surface]);
  assert.equal(report.geometricValidity, 'not-certified'); assert.equal(report.topologyCertified, false); assert.equal(report.solid, false);
  assert.equal(report.quality.regularityCertified, false); assert.equal(report.quality.localObservationsOnly, true);
  assert.equal(report.quality.representativeVMeaning, 'actual-first-row-guard-state-not-surface-dv-comparison');
  const source = sourceFile(name, result.source, result.model); assert.deepEqual(source.model.objects.slice(0, n), sections);
  assert.deepEqual(validate(result), report);
  const owned = ownedFile(name + '.owned-loft', result); assert.deepEqual(validate(owned.reopened), report);
  assert.deepEqual(build(authored.reopened.sections, authored.reopened.parametersV, authored.reopened.options), result);
  ownedFile(name + '.independent-native-observations', evidence); ownedFile(name + '.analytic-probes', analytic);
  accepted.push({result, before: structuredClone(result), sections, parametersV, inputBefore: before, options});
  summaries.push({name, surfaceId, sectionCount: n, controlPointGrid: [m, n], domains, plannedCounts: planned,
    derivativeComparisonCount: comparisonCount, derivativeRefusalCount: refusalCount, sourceModelObjectCount: report.sourceModelObjectCount,
    maximumPointDifferenceMM: maximumDifference, maximumRelativeDuDifference: report.maximumRelativeDuDifference, analyticProbeCount: analytic.length,
    sourceFile: source.file, authoredFile: authored.file, resultFile: owned.file});
  return result;
}

const linear = check('two_sections_nonunit_v', linearSections, linearParameters, 1, 'linear_loft_surface');
const ruled = buildCompatibleRuledSurface(linearSections[0], linearSections[1], {surfaceId: 'declared_ruled_witness'});
const ruledBefore = structuredClone(ruled), remapEvidence = [];
for (const u of [-3, -.5, 2, 5.5, 7]) for (const v of [2, 2.75, 3.5, 4.25, 5]) {
  const ruledV = (v - 2) / 3, a = evaluateSurface(linear.surface, u, v), b = evaluateSurface(ruled.surface, u, ruledV); closePoint(a, b);
  const da = evaluateSurfaceD1(linear.surface, u, v), db = evaluateSurfaceD1(ruled.surface, u, ruledV);
  assert.ok(relative(da.du, db.du) <= 1e-7); assert.ok(relative(da.dv, db.dv.map(value => value / 3)) <= 1e-7);
  remapEvidence.push({u, originalV: v, declaredRuledV: ruledV, newPointMM: a, ruledPointMM: b, newD1: da, ruledD1: db});
}
sourceFile('declared_ruled_witness', ruled.source, ruled.model); ownedFile('declared_ruled_witness.owned', ruled);
ownedFile('declared_ruled_v-remap-evidence', remapEvidence);
const quarter = check('five_rational_quarter_sections', quarterSections, quarterParameters, 2, 'quarter_loft_surface', quarterPoint, quarterD1);
const cubic = check('compatible_cubic_sections', cubicSections, cubicParameters, 3, 'cubic_loft_surface', cubicPoint, cubicD1);
const quarterBefore = structuredClone(quarter), originalSectionBefore = structuredClone(quarterSections[2]);
const editedSection = editCurveControlPolygon(quarterSections[2], {poleEdits: [{index: 1, zMM: quarterSections[2].controlPoints[1][2] + .5}]});
assert.deepEqual(quarterSections[2], originalSectionBefore); assert.deepEqual(editedSection.curve.knots, quarterSections[2].knots);
assert.deepEqual(editedSection.curve.weights, quarterSections[2].weights);
assert.equal(editedSection.curve.id, quarterSections[2].id);
for (let i = 0; i < 3; i++) for (let axis = 0; axis < 3; axis++) if (i !== 1 || axis !== 2)
  assert.ok(Object.is(editedSection.curve.controlPoints[i][axis], quarterSections[2].controlPoints[i][axis]));
const editedSections = [...quarterSections]; editedSections[2] = editedSection.curve;
sourceFile('middle_section_pole_edit.original-section', editedSection.source, editedSection.model); ownedFile('middle_section_pole_edit.edit-result', editedSection);
const changed = check('middle_section_pole_edit', editedSections, quarterParameters, 2, quarter.surface.id);
assert.ok(difference(evaluateSurface(changed.surface, 2, 0), evaluateSurface(quarter.surface, 2, 0)) > .1); assert.deepEqual(quarter, quarterBefore);
const maximum = check('maximum_15_sections_16_poles', maximumSections, maximumParameters, 3, 'maximum_loft_surface');
assert.equal(maximum.report.basisEvaluationCount, 3600); assert.equal(maximum.report.eliminationStepCount, 1680);
assert.equal(maximum.report.observationCount, 465); assert.equal(maximum.model.objects.length, 16);
assert.equal(maximum.report.derivativeRefusalCount, 210); assert.equal(maximum.report.derivativeComparisonCount, 255);
assert.ok(Object.is(surfaceDomain(maximum.surface).u[0], -0));
const constant = check('coincident_sections', constantSections, constantParameters, 3, 'coincident_loft_surface');
assert.ok(Object.is(surfaceDomain(constant.surface).v[0], -0));
for (const u of [-3, 2, 7]) for (const v of [0, 2.5, 5]) {
  closePoint(evaluateSurface(constant.surface, u, v), evaluateCurve(constantSections[0], u));
  assert.ok(Math.hypot(...evaluateSurfaceD1(constant.surface, u, v).dv) <= 1e-7);
}
const iso = extractSurfaceIsoCurve(quarter.surface, {fixedAxis: 'v', parameter: 0, curveId: 'selected_section_iso'});
assert.deepEqual(iso.original, quarter.surface); assert.deepEqual(iso.curve.knots, quarterSections[2].knots);
for (const u of [-3, -1.75, 2, 4.5, 7]) {
  closePoint(evaluateCurve(iso.curve, u), evaluateCurve(quarterSections[2], u));
  assert.ok(relative(evaluateCurveD1(iso.curve, u).derivative, evaluateCurveD1(quarterSections[2], u).derivative) <= 1e-7);
}
sourceFile('selected_original_section_isocurve', iso.source, iso.model); ownedFile('selected_original_section_isocurve.owned', iso);

function intact() {
  for (const item of accepted) {
    assert.deepEqual(item.result, item.before); assert.deepEqual({sections: item.sections, parametersV: item.parametersV}, item.inputBefore);
  }
  assert.deepEqual(quarter, quarterBefore); assert.deepEqual(quarterSections[2], originalSectionBefore); assert.deepEqual(ruled, ruledBefore);
  for (const [file, bytes] of retainedFiles) assert.deepEqual(readFileSync(file), bytes, file);
}
function reject(name, action, code, poleIndex = null) {
  assert.throws(action, error => {
    assert.ok(error instanceof MultiSectionLoftError); assert.equal(error.name, 'MultiSectionLoftError'); assert.equal(error.code, code);
    assert.ok(Object.values(MultiSectionLoftDiagnosticCode).includes(error.code)); assert.ok(error.message.startsWith('Multi-section loft Surface: '));
    assert.equal(error.poleIndex, poleIndex);
    if (poleIndex !== null) { assert.ok(error.cause instanceof CurveInterpolationError); assert.equal(error.cause.code, code); }
    failures.push({name, code: error.code, poleIndex: error.poleIndex, message: error.message,
      actualCausePreserved: Object.hasOwn(error, 'cause'), childCauseName: error.cause?.name ?? null});
    intact(); return true;
  });
}
const refusalOptions = {surfaceId: 'refusal_surface', degreeV: 2, maximumBasisEvaluations: 3600,
  maximumEliminationSteps: 1680, maximumObservations: 465};
const differentDegree = structuredClone(quarterSections); differentDegree[1] = {...structuredClone(cubicSections[0]), id: quarterSections[1].id};
reject('incompatible_u_degree', () => build(differentDegree, quarterParameters, refusalOptions), 'BASIS');
const differentCount = structuredClone(quarterSections);
differentCount[1] = curve(quarterSections[1].id, 2, [-3, -3, -3, 2, 7, 7, 7], [[2, 0, 0], [2, 1, 0], [1, 2, 0], [0, 2, 0]], [1, Math.SQRT1_2, 1, 1]);
reject('incompatible_u_pole_count', () => build(differentCount, quarterParameters, refusalOptions), 'BASIS');
const differentKnots = structuredClone(quarterSections); differentKnots[1].knots = [-4, -4, -4, 7, 7, 7];
reject('incompatible_u_knots', () => build(differentKnots, quarterParameters, refusalOptions), 'BASIS');
const differentSigns = structuredClone(maximumSections); differentSigns[1].knots[0] = 0; differentSigns[1].knots[1] = 0;
reject('incompatible_u_knot_sign', () => build(differentSigns, maximumParameters, {...refusalOptions, degreeV: 3}), 'BASIS');
const differentWeights = structuredClone(quarterSections); differentWeights[1].weights[1] = 1;
reject('incompatible_u_weights', () => build(differentWeights, quarterParameters, refusalOptions), 'BASIS');
const invalidWeight = structuredClone(quarterSections); invalidWeight[1].weights[1] = -0;
reject('invalid_native_weight', () => build(invalidWeight, quarterParameters, refusalOptions), 'INPUT');
const duplicateIds = structuredClone(quarterSections); duplicateIds[1].id = duplicateIds[0].id;
reject('duplicate_original_identity', () => build(duplicateIds, quarterParameters, refusalOptions), 'IDENTITY');
reject('surface_identity_collision', () => build(quarterSections, quarterParameters, {...refusalOptions, surfaceId: quarterSections[0].id}), 'IDENTITY');
const duplicateV = [...quarterParameters]; duplicateV[2] = duplicateV[1];
reject('unordered_section_parameters', () => build(quarterSections, duplicateV, refusalOptions), 'INPUT');
reject('parameter_count', () => build(quarterSections, quarterParameters.slice(0, -1), refusalOptions), 'INPUT');
reject('unsupported_v_degree', () => build(quarterSections, quarterParameters, {...refusalOptions, degreeV: 4}), 'INPUT');
const sixteenSections = [...maximumSections, {...structuredClone(maximumSections[14]), id: 'maximum_section_15'}];
reject('sixteen_sections_exceed_native_model_profile', () => build(sixteenSections, Array.from({length: 16}, (_, i) => i - 7), {...refusalOptions, degreeV: 3}), 'INPUT');
reject('basis_budget', () => build(quarterSections, quarterParameters, {...refusalOptions, maximumBasisEvaluations: 74}), 'BUDGET');
reject('elimination_budget', () => build(quarterSections, quarterParameters, {...refusalOptions, maximumEliminationSteps: 29}), 'BUDGET');
reject('observation_budget', () => build(quarterSections, quarterParameters, {...refusalOptions, maximumObservations: 14}), 'BUDGET');
let getterCalls = 0;
const getter = {...refusalOptions};
Object.defineProperty(getter, 'degreeV', {enumerable: true, get() { getterCalls++; return 2; }});
reject('input_getter', () => build(quarterSections, quarterParameters, getter), 'INPUT'); assert.equal(getterCalls, 0);
const ownedGetter = structuredClone(quarter);
Object.defineProperty(ownedGetter.provenance, 'rowCurves', {enumerable: true, get() { getterCalls++; return quarter.provenance.rowCurves; }});
reject('owned_getter', () => validate(ownedGetter), 'OWNED'); assert.equal(getterCalls, 0);
const uncertainParameters = [0, 1e-8, 2e-8, 1], uncertainSections = uncertainParameters.map((v, i) => quarterSection('uncertain_section_' + i, v));
reject('actual_row_conditioning', () => build(uncertainSections, uncertainParameters, {...refusalOptions, degreeV: 3}), 'CONDITIONING', 0);
const oscillatingParameters = [0, 1, 2, 3, 4], oscillatingSections = oscillatingParameters.map((v, i) => {
  const section = quarterSection('oscillating_section_' + i, v); section.controlPoints[0][0] = i % 2 ? -10000 : 10000; return section;
});
reject('actual_row_generated_pole_bound', () => build(oscillatingSections, oscillatingParameters, refusalOptions), 'REPRESENTABILITY', 0);
for (const [name, alter] of [
  ['source', result => result.source += ' '],
  ['original_section', result => result.sections[2].controlPoints[1][2] += .1],
  ['pole_mapping', result => result.provenance.poleMappings[1].rowCurvePoleIndex++],
  ['weights', result => result.surface.weights[1][1] += .1],
  ['child_solver', result => result.provenance.rowCurves[0].evaluation.report.solver.pivots[1].threshold += 1],
  ['endpoint', result => result.surface.controlPoints[0][0][0] += .1],
  ['native_d1', result => result.report.observations[0].surfaceD1.value.du[0] += .1],
  ['counter', result => result.report.representativeVD1AttemptCount++],
  ['schema', result => result.report.schema = 'unrelated-loft'],
]) {
  const altered = structuredClone(quarter); alter(altered); reject('owned_' + name + '_tamper', () => validate(altered), 'OWNED');
}
assert.deepEqual(validate(quarter), quarter.report); intact();

const packageRoot = resolve(repo, 'packages/barocss-cad'), manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const runtimeNames = ['buildMultiSectionLoftSurface', 'validateMultiSectionLoftSurface', 'MultiSectionLoftError', 'MultiSectionLoftDiagnosticCode'];
const typeNames = ['MultiSectionLoftOptions', 'MultiSectionLoftProvenance', 'MultiSectionLoftObservation', 'MultiSectionLoftReport', 'MultiSectionLoftResult'];
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.MultiSectionLoftDiagnosticCode, MultiSectionLoftDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./multi-section-loft.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/multi-section-loft.d.ts'), leafDeclaration = readFileSync(leafDeclarationPath, 'utf8');
for (const name of [...runtimeNames, ...typeNames]) assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(leafDeclaration), name);
const cold = JSON.parse(readFileSync(summaries.find(row => row.name === 'five_rational_quarter_sections').authoredFile, 'utf8'));
const compiled = publicAPI.buildMultiSectionLoftSurface(cold.sections, cold.parametersV, cold.options);
assert.deepEqual(compiled, quarter); assert.deepEqual(publicAPI.validateMultiSectionLoftSurface(compiled), quarter.report);
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 9,
  declarationCheck: 'actual declaration export text; no separate TypeScript invocation'};
ownedFile('compiled-consumer', compiledConsumer);
const summary = {sourceMode: true, cadSourceInputCount: cadInputs.length, summaries, failures, compiledConsumer,
  caseCount: summaries.length, refusalCount: failures.length, ruledRemap: 'ruledV=(originalV-2)/3;newDv=ruledDv/3',
  isoSourceFile: resolve(output, 'selected_original_section_isocurve.source0.css'),
  scope: 'Compatible original rational U sections interpolated by actual polynomial V row Curves; native local section point/du guards and analytic probes.',
  regularityCertified: false, globalShapeErrorCertified: false, sewingCertified: false, solidCertified: false};
ownedFile('summary', summary); intact();
console.log(JSON.stringify(summary));
