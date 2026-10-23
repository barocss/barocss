import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.filter(arg => arg === '--source').length, 1,
  'Usage: node cad-curve-arc-length-demo.mjs --source [output-directory]');
const destinations = args.filter(arg => arg !== '--source');
assert.ok(destinations.length <= 1);
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const output = resolve(destinations[0] ?? '/tmp/barocss-cad-curve-arc-length-prototype');
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
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/nurbs/curves/cad-curve-arc-length.ts')));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' +
  Buffer.from(built.outputFiles[0].text).toString('base64'));
const {
  queryCadDocumentCurveArcLength: query, validateCadDocumentCurveArcLength: validate,
  CadCurveArcLengthError, CadCurveArcLengthDiagnosticCode,
  compileCadModel, createCadDocument, serializeCadDocument, parseCadDocument, validateCadDocumentResult,
  createCadGeometryReference, resolveCadGeometryReference, evaluateCurve, evaluateCurveD1, curveDomain,
  buildXYArc, reverseCurve,
} = api;
for (const operation of [query, validate, CadCurveArcLengthError]) assert.equal(typeof operation, 'function');
assert.deepEqual(Object.keys(CadCurveArcLengthDiagnosticCode).sort(),
  ['INPUT', 'REFERENCE', 'STALE', 'INTERVAL', 'REPRESENTABILITY', 'BUDGET', 'NATIVE', 'BINDING', 'OWNED'].sort());

const summaries = [], failures = [];
const frame = 'authored-xyz-no-axis-conversion';
const options = {interval: null, absoluteToleranceMM: 1e-7, relativeTolerance: 1e-8,
  maximumEvaluations: 4096, maximumSubdivisions: 128, maximumDepth: 12};
const difference = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));

// Preserve authored knots, selected interval endpoints and owned node/geometry -0.
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

function sourceFile(name, source, expectedModel) {
  const file = resolve(output, name + '.source0.css');
  writeFileSync(file, source);
  const compiled = compileCadModel(readFileSync(file, 'utf8'), {sourceVersion: 0});
  assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
  if (expectedModel) assert.deepEqual(compiled.model, expectedModel);
  return {file, source: readFileSync(file, 'utf8'), model: compiled.model};
}

function documentFile(name, wire) {
  const file = resolve(output, name + '.cad-document.json');
  writeFileSync(file, serializeCadDocument(wire));
  const bytes = readFileSync(file), document = parseCadDocument(bytes.toString('utf8'));
  assert.deepEqual(document.document, wire);
  assert.deepEqual(validateCadDocumentResult(document), document.report);
  return {file, bytes, document};
}

function checkOwnership(document, reference, inputOptions, result) {
  const caller = new WeakSet();
  const collect = value => {
    if (value && typeof value === 'object' && !caller.has(value)) {
      caller.add(value);
      for (const child of Object.values(value)) collect(child);
    }
  };
  collect(document); collect(reference); collect(inputOptions);
  const seen = new WeakSet();
  const visit = value => {
    if (value && typeof value === 'object') {
      assert.ok(!caller.has(value), 'Arc-length result aliases caller data');
      assert.ok(!seen.has(value), 'Repeated nested output object occurrence');
      seen.add(value);
      for (const child of Object.values(value)) visit(child);
    }
  };
  visit(result);
}

function checkPanel(geometry, panel) {
  assert.ok(panel.domain[0] < panel.domain[1]);
  assert.equal(panel.nodes.length, 7);
  for (const [index, node] of panel.nodes.entries()) {
    assert.ok(node.parameter > panel.domain[0] && node.parameter < panel.domain[1]);
    if (index) assert.ok(node.parameter > panel.nodes[index - 1].parameter);
    const d1 = evaluateCurveD1(geometry, node.parameter);
    assert.equal(node.speed, Math.hypot(...d1.derivative));
    assert.deepEqual(node.pointMM, d1.point);
  }
  assert.deepEqual(panel.endpointPointsMM, panel.domain.map(parameter => evaluateCurve(geometry, parameter)));
  const points = [panel.endpointPointsMM[0], ...panel.nodes.map(node => node.pointMM), panel.endpointPointsMM[1]];
  const chordSum = points.slice(0, -1).reduce((sum, point, index) => sum + difference(point, points[index + 1]), 0);
  assert.equal(panel.nativeChordSumMM, chordSum);
  assert.equal(panel.chordShortfallMM, Math.max(0, panel.nativeChordSumMM - panel.Q5));
  const roundoffFloor = panel.Q5 === 0 ? 0 : 64 * Number.EPSILON * Math.abs(panel.Q5);
  assert.equal(panel.gaussDifferenceMM, Math.abs(panel.Q5 - panel.Q3));
  assert.equal(panel.roundoffFloorMM, roundoffFloor);
  assert.equal(panel.errorEstimateMM, Math.max(Math.abs(panel.Q5 - panel.Q3), roundoffFloor, panel.chordShortfallMM));
  assert.ok(Number.isFinite(panel.Q3) && Number.isFinite(panel.Q5) && panel.Q5 >= 0 && panel.errorEstimateMM >= 0);
}

function check(name, saved, bodyId, inputOptions, expectedLengthMM) {
  const before = structuredClone(saved.document), optionsBefore = structuredClone(inputOptions);
  const reference = createCadGeometryReference(saved.document, {bodyId}).reference;
  const result = query(saved.document, reference, inputOptions);
  checkOwnership(saved.document, reference, inputOptions, result);
  assert.deepEqual(Object.keys(result).sort(), ['reference', 'geometry', 'source', 'options', 'estimatedLengthMM', 'errorEstimateMM', 'panels', 'report'].sort());
  const resolved = resolveCadGeometryReference(saved.document, reference);
  assert.deepEqual(result.reference, reference);
  assert.deepEqual(result.geometry, resolved.geometry);
  assert.equal(result.source, resolved.source);
  assert.deepEqual(result.options, inputOptions);
  const report = result.report;
  assert.equal(report.schema, 'barocss-cad-curve-arc-length');
  assert.equal(report.version, 0);
  assert.deepEqual(report.reference, reference);
  assert.equal(report.sourceFrame, reference.sourceFrame);
  assert.equal(report.lengthUnit, 'mm');
  assert.deepEqual(report.originalDomain, curveDomain(resolved.geometry));
  assert.deepEqual(report.requestedInterval, inputOptions.interval);
  assert.deepEqual(report.interval, inputOptions.interval ?? curveDomain(resolved.geometry));
  assert.equal(result.panels.length, report.finalPanelCount);
  const measuredPanels = new Map();
  const rememberPanel = panel => {
    assert.ok(Number.isInteger(panel.panelIndex) && panel.panelIndex >= 0 &&
      panel.panelIndex < report.panelMeasurementCount);
    const previous = measuredPanels.get(panel.panelIndex);
    if (previous) assert.deepEqual(panel, previous);
    else measuredPanels.set(panel.panelIndex, panel);
  };
  const finalIds = new Set();
  for (const [index, panel] of result.panels.entries()) {
    // Measurement IDs retain discarded parents; only the final array is U-ordered.
    rememberPanel(panel);
    assert.ok(!finalIds.has(panel.panelIndex));
    finalIds.add(panel.panelIndex);
    assert.ok(panel.depth <= inputOptions.maximumDepth);
    if (index) assert.ok(Object.is(result.panels[index - 1].domain[1], panel.domain[0]));
    checkPanel(result.geometry, panel);
  }
  assert.ok(Object.is(result.panels[0].domain[0], report.interval[0]));
  assert.ok(Object.is(result.panels.at(-1).domain[1], report.interval[1]));
  assert.equal(result.estimatedLengthMM, result.panels.reduce((sum, panel) => sum + panel.Q5, 0));
  assert.equal(result.errorEstimateMM, result.panels.reduce((sum, panel) => sum + panel.errorEstimateMM, 0));
  assert.equal(report.estimatedLengthMM, result.estimatedLengthMM);
  assert.equal(report.errorEstimateMM, result.errorEstimateMM);
  assert.equal(report.requestedAbsoluteToleranceMM, inputOptions.absoluteToleranceMM);
  assert.equal(report.requestedRelativeTolerance, inputOptions.relativeTolerance);
  assert.equal(report.achievedToleranceMM, Math.max(inputOptions.absoluteToleranceMM,
    inputOptions.relativeTolerance * result.estimatedLengthMM));
  assert.ok(result.errorEstimateMM <= report.achievedToleranceMM);
  assert.equal(report.criterion, 'aggregate-panel-estimator-not-certified-upper-bound');
  assert.equal(report.criterionSatisfied, true);
  assert.equal(report.quality.globalErrorCertified, false);
  assert.equal(report.quality.panelIdentity,
    'measurement-order-id-including-discarded-parents-final-array-is-u-order');
  // The analytic comparison is local case evidence, independent of the heuristic estimator.
  const analyticDifferenceMM = Math.abs(result.estimatedLengthMM - expectedLengthMM);
  assert.ok(analyticDifferenceMM <= 1e-7);
  assert.equal(report.evaluationCount, report.panelMeasurementCount * 7);
  assert.equal(report.pointEvaluationCount, report.panelMeasurementCount * 2);
  assert.ok(report.evaluationCount <= inputOptions.maximumEvaluations);
  assert.ok(report.subdivisionCount <= inputOptions.maximumSubdivisions);
  assert.equal(report.panelMeasurementCount, report.initialPanelCount + 2 * report.subdivisionCount);
  assert.equal(report.finalPanelCount, report.initialPanelCount + report.subdivisionCount);
  assert.equal(report.subdivisions.length, report.subdivisionCount);
  for (const [index, subdivision] of report.subdivisions.entries()) {
    assert.equal(subdivision.index, index);
    assert.ok(subdivision.midpoint > subdivision.parent.domain[0] && subdivision.midpoint < subdivision.parent.domain[1]);
    assert.deepEqual(subdivision.lower.domain, [subdivision.parent.domain[0], subdivision.midpoint]);
    assert.deepEqual(subdivision.upper.domain, [subdivision.midpoint, subdivision.parent.domain[1]]);
    assert.equal(subdivision.lower.depth, subdivision.parent.depth + 1);
    assert.equal(subdivision.upper.depth, subdivision.parent.depth + 1);
    assert.equal(subdivision.lower.panelIndex, report.initialPanelCount + 2 * index);
    assert.equal(subdivision.upper.panelIndex, subdivision.lower.panelIndex + 1);
    assert.ok(subdivision.parent.panelIndex < subdivision.lower.panelIndex);
    assert.equal(subdivision.evaluationCountAfterSubdivision, 7 * (report.initialPanelCount + 2 * (index + 1)));
    assert.equal(subdivision.pointEvaluationCountAfterSubdivision, 2 * (report.initialPanelCount + 2 * (index + 1)));
    rememberPanel(subdivision.parent);
    rememberPanel(subdivision.lower);
    rememberPanel(subdivision.upper);
    checkPanel(result.geometry, subdivision.parent);
    checkPanel(result.geometry, subdivision.lower);
    checkPanel(result.geometry, subdivision.upper);
  }
  assert.equal(measuredPanels.size, report.panelMeasurementCount);
  assert.equal(report.guardEvaluationCount, report.guards.length);
  for (const guard of report.guards) {
    let observed;
    try { observed = {status: 'evaluated', value: evaluateCurveD1(result.geometry, guard.parameter)}; }
    catch (error) { observed = {status: 'native-refused', name: error.name, message: error.message, nativeErrorCode: error.code ?? null}; }
    checkGuard(guard, observed);
    assert.ok(result.panels.every(panel => panel.nodes.every(node => node.parameter !== guard.parameter)));
  }
  assert.deepEqual(validate(saved.document, result), report);
  const stored = ownedFile(name + '.owned-result', result);
  const cold = parseCadDocument(readFileSync(saved.file, 'utf8'));
  assert.deepEqual(validate(cold, stored.reopened), report);
  assert.deepEqual(query(cold, reference, inputOptions), result);
  assert.deepEqual(saved.document, before);
  assert.deepEqual(inputOptions, optionsBefore);
  summaries.push({name, bodyId, geometryId: reference.geometryId, documentRevision: reference.documentRevision,
    interval: report.interval, expectedLengthMM, estimatedLengthMM: result.estimatedLengthMM, analyticDifferenceMM,
    errorEstimateMM: result.errorEstimateMM, finalPanels: result.panels.length,
    evaluationCount: report.evaluationCount, pointEvaluationCount: report.pointEvaluationCount,
    guardEvaluationCount: report.guardEvaluationCount, subdivisionCount: report.subdivisionCount,
    resultFile: stored.file, documentFile: saved.file});
  return result;
}

function checkGuard(guard, observed) {
  // Exact guard field alignment follows the new leaf's report interface.
  assert.equal(guard.status, observed.status);
  if (observed.status === 'native-refused') {
    assert.equal(guard.nativeErrorName, observed.name);
    assert.equal(guard.message, observed.message);
    assert.equal(guard.nativeErrorCode, observed.nativeErrorCode);
  }
}

ownedFile('source-api.metafile', built.metafile);
ownedFile('source-api.inputs', {entry, mode: 'in-memory-esbuild', write: false,
  cadInputs, allInputs: sourceInputs, esbuildVersion: esbuild.version});
const authoredSource = `@model analytic_lengths {
  version:0; length-unit:mm;
  @curve #line_3d { type:nurbs; degree:1; knots:[-3,-3,7,7]; control-points:[[1,2,3],[4,2,7]]; weights:[1,1]; }
  @curve #c0_curve { type:nurbs; degree:1; knots:[-0,0,1,3,3]; control-points:[[0,0,0],[3,0,0],[3,4,0]]; weights:[1,1,1]; }
  @curve #zero_speed { type:nurbs; degree:1; knots:[-0,-0,2,2]; control-points:[[-0,-0,-0],[-0,-0,-0]]; weights:[1,1]; }
  @curve #concentrated_line { type:nurbs; degree:1; knots:[0,0,1,1]; control-points:[[0,0,0],[1,0,0]]; weights:[1000000,0.000001]; }
}
`;
const authored = sourceFile('analytic_lengths', authoredSource);
const quarter = buildXYArc({kind: 'quarter-arc', id: 'quarter_original', center: [0, 0], radius: 2, quadrant: 0});
const quarterBefore = structuredClone(quarter);
const quarterSource = sourceFile('quarter_original', quarter.source, quarter.model);
const reversedQuarter = reverseCurve(quarter.curve, {curveId: 'quarter_reversed'});
const reverseSource = sourceFile('quarter_reversed', reversedQuarter.source, reversedQuarter.model);
assert.deepEqual(quarter, quarterBefore);
const assets = [['analytic_asset', authored.source], ['quarter_asset', quarterSource.source], ['reverse_asset', reverseSource.source]]
  .map(([id, source]) => ({id, revision: 1, role: 'authored-native-source', sourceVersion: 0, sourceFrame: frame, source}));
const bodies = [['line_body', 'line_3d', 'analytic_asset'], ['c0_body', 'c0_curve', 'analytic_asset'],
  ['zero_body', 'zero_speed', 'analytic_asset'], ['concentrated_body', 'concentrated_line', 'analytic_asset'],
  ['quarter_body', 'quarter_original', 'quarter_asset'], ['reversed_body', 'quarter_reversed', 'reverse_asset']]
  .map(([id, geometryId, assetId]) => ({id, name: id, kind: 'direct-geometry-object', assetId, geometryId}));
const wire = {schema: 'barocss-cad-document', version: 1, profile: 'direct-geometry', documentId: 'arc_length_doc', revision: 1,
  units: {length: 'mm', angle: 'rad'}, nativeFrame: frame, assets, bodies,
  features: [], parameters: [], constraints: [], placements: [], derivedCaches: []};
const saved = documentFile('revision1', wire), documentBefore = structuredClone(saved.document);
const line = check('line5', saved, 'line_body', options, 5);
const circle = check('quarter_pi', saved, 'quarter_body', options, Math.PI);
assert.ok(circle.report.subdivisions.length > 0, 'Quarter-circle trace must contain actual refinement');
const c0Full = check('c0_full7', saved, 'c0_body', options, 7);
const c0Partial = check('c0_interval3_5', saved, 'c0_body', {...options, interval: [.5, 2]}, 3.5);
const zero = check('zero_speed', saved, 'zero_body', options, 0);
assert.equal(zero.estimatedLengthMM, 0);
assert.equal(zero.errorEstimateMM, 0);
const reverse = check('reversed_quarter_pi', saved, 'reversed_body', options, Math.PI);
assert.ok(Math.abs(reverse.estimatedLengthMM - circle.estimatedLengthMM) <= 1e-7);
assert.deepEqual(c0Full.geometry.knots, [-0, 0, 1, 3, 3]);
assert.ok(c0Full.report.guards.some(guard => guard.parameter === 1));
assert.ok(c0Partial.report.guards.some(guard => guard.parameter === 1));
const lineBefore = structuredClone(line), circleBefore = structuredClone(circle);

// Same-ID source edit advances explicit document/asset revisions without replacing prior files.
const editedWire = structuredClone(wire);
editedWire.revision = 2;
editedWire.assets[0].revision = 2;
editedWire.assets[0].source = authoredSource.replace('[4,2,7]', '[7,2,11]');
const editedSource = sourceFile('revision2_analytic_lengths', editedWire.assets[0].source);
const updated = documentFile('revision2', editedWire), updatedBefore = structuredClone(updated.document);
const editedLine = check('edited_line10', updated, 'line_body', options, 10);
assert.equal(editedLine.reference.geometryId, line.reference.geometryId);
assert.deepEqual(saved.document, documentBefore);
assert.deepEqual(line, lineBefore);
assert.deepEqual(readFileSync(saved.file), saved.bytes);

function reject(name, action, code) {
  assert.throws(action, error => {
    assert.ok(error instanceof CadCurveArcLengthError);
    assert.equal(error.name, 'CadCurveArcLengthError');
    assert.ok(Object.values(CadCurveArcLengthDiagnosticCode).includes(error.code));
    assert.equal(error.code, code);
    failures.push({name, code: error.code, message: error.message, actualCausePreserved: Object.hasOwn(error, 'cause')});
    assert.deepEqual(saved.document, documentBefore);
    assert.deepEqual(updated.document, updatedBefore);
    assert.deepEqual(line, lineBefore);
    assert.deepEqual(circle, circleBefore);
    assert.deepEqual(readFileSync(saved.file), saved.bytes);
    assert.deepEqual(readFileSync(updated.file), updated.bytes);
    assert.equal(readFileSync(authored.file, 'utf8'), authored.source);
    assert.equal(readFileSync(quarterSource.file, 'utf8'), quarterSource.source);
    return true;
  });
}

reject('stale_reference', () => query(updated.document, line.reference, options), 'STALE');
reject('stale_owned_length', () => validate(updated.document, line), 'STALE');
for (const [name, interval] of [['zero_interval', [1, 1]], ['reversed_interval', [2, 1]], ['outside_interval', [-4, 7]]]) {
  reject(name, () => query(saved.document, line.reference, {...options, interval}), 'INTERVAL');
}
reject('seven_call_quarter_budget', () => query(saved.document, circle.reference,
  {...options, absoluteToleranceMM: 1e-9, relativeTolerance: 0, maximumEvaluations: 7}), 'BUDGET');
const concentratedReference = createCadGeometryReference(saved.document, {bodyId: 'concentrated_body'}).reference;
reject('extreme_rational_endpoint_concentration', () => query(saved.document, concentratedReference, options), 'BUDGET');
reject('seven_distinct_nodes_unrepresented', () => query(saved.document, circle.reference,
  {...options, interval: [.5, .5 + Number.EPSILON]}), 'REPRESENTABILITY');
let getterCalls = 0;
const getter = {...options};
Object.defineProperty(getter, 'absoluteToleranceMM', {
  enumerable: true, get() { getterCalls++; return options.absoluteToleranceMM; },
});
reject('options_getter', () => query(saved.document, line.reference, getter), 'INPUT');
assert.equal(getterCalls, 0);
for (const [name, alter] of [
  ['source', result => result.source += ' '],
  ['coefficient', result => result.geometry.controlPoints[0][0] += .1],
  ['panel', result => result.panels[0].nodes[0].speed += .1],
  ['estimator', result => result.errorEstimateMM += .1],
  ['trace', result => result.report.subdivisions[0].midpoint += .01],
  ['report', result => result.report.evaluationCount++],
]) {
  const changed = structuredClone(name === 'trace' ? circle : line);
  alter(changed);
  reject('owned_' + name + '_tamper', () => validate(saved.document, changed), 'OWNED');
}
assert.deepEqual(validate(saved.document, line), line.report);

// Current public compiled JS and eight declarations use actual manifest entries.
const packageRoot = resolve(repo, 'packages/barocss-cad');
const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath));
assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const runtimeExports = ['queryCadDocumentCurveArcLength', 'validateCadDocumentCurveArcLength', 'CadCurveArcLengthError', 'CadCurveArcLengthDiagnosticCode'];
for (const name of runtimeExports) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.CadCurveArcLengthDiagnosticCode, CadCurveArcLengthDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./nurbs/curves/cad-curve-arc-length.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/nurbs/curves/cad-curve-arc-length.d.ts');
const leafDeclaration = readFileSync(leafDeclarationPath, 'utf8');
const declarationExports = [...runtimeExports, 'CadCurveArcLengthOptions', 'CadCurveArcLengthPanel', 'CadCurveArcLengthReport', 'CadCurveArcLengthResult'];
for (const name of declarationExports) {
  assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(leafDeclaration), name);
}
assert.ok(leafDeclaration.includes('export type CadCurveArcLengthDiagnosticCode'));
const compiledDocument = publicAPI.parseCadDocument(readFileSync(saved.file, 'utf8'));
const compiled = publicAPI.queryCadDocumentCurveArcLength(compiledDocument, circle.reference, options);
assert.deepEqual(compiled, circle);
assert.deepEqual(publicAPI.validateCadDocumentCurveArcLength(compiledDocument, compiled), circle.report);
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeExports, declarationExports,
  finalPanels: compiled.panels.length, estimatedLengthMM: compiled.estimatedLengthMM,
  declarationCheck: 'actual exported declaration text; no separate TypeScript invocation'};
ownedFile('compiled-consumer', compiledConsumer);
ownedFile('summary', {sourceMode: true, cadSourceInputCount: cadInputs.length, summaries, failures, compiledConsumer,
  sourceFiles: [authored.file, quarterSource.file, reverseSource.file, editedSource.file],
  scope: 'Actual native derivative-norm integration with interior seven-node G3/G5 panels. Q5 is the estimate; differences, roundoff floor and native point-chord shortfall are heuristic convergence evidence. Independent analytic checks are local fixtures only. C0 native guard calls stay separate. No endpoint tangent fabrication, display polyline length, certified global error, manufacturing, G1/G2, topology, solid or reader campaign.'});
console.log(JSON.stringify({sourceMode: true, cadSourceInputCount: cadInputs.length, summaries, failures, compiledConsumer}));
