import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.filter(arg => arg === '--source').length, 1,
  'Usage: node cad-surface-area-demo.mjs --source [output-directory]');
const destinations = args.filter(arg => arg !== '--source');
assert.ok(destinations.length <= 1);
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const output = resolve(destinations[0] ?? '/tmp/barocss-cad-surface-area-prototype');
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
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/nurbs/surfaces/cad-surface-area.ts')));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' +
  Buffer.from(built.outputFiles[0].text).toString('base64'));
const {
  queryCadDocumentSurfaceArea: query, validateCadDocumentSurfaceArea: validate,
  CadSurfaceAreaError, CadSurfaceAreaDiagnosticCode,
  compileCadModel, createCadDocument, serializeCadDocument, parseCadDocument, validateCadDocumentResult,
  createCadGeometryReference, resolveCadGeometryReference, evaluateSurface, evaluateSurfaceD1, surfaceDomain,
  buildZAxisRevolvedSurface, extrudeCurve, editSurfaceControlNet, reverseSurfaceAxis,
} = api;
for (const operation of [query, validate, CadSurfaceAreaError]) assert.equal(typeof operation, 'function');
assert.deepEqual(Object.keys(CadSurfaceAreaDiagnosticCode).sort(),
  ['INPUT', 'REFERENCE', 'STALE', 'REGION', 'REPRESENTABILITY', 'BUDGET', 'NATIVE', 'BINDING', 'OWNED'].sort());

const summaries = [], failures = [], retainedFiles = new Map();
const frame = 'authored-xyz-no-axis-conversion';
const options = {region: null, absoluteToleranceMM2: 1e-6, relativeTolerance: 1e-8,
  maximumEvaluations: 16384, maximumSubdivisions: 128, maximumDepth: 8};
const difference = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));

// Preserve authored knots, selected region endpoints and owned node/geometry -0.
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

function documentFile(name, wire) {
  const file = resolve(output, name + '.cad-document.json');
  const created = createCadDocument(wire);
  writeFileSync(file, serializeCadDocument(wire));
  const bytes = readFileSync(file), document = parseCadDocument(bytes.toString('utf8'));
  retainedFiles.set(file, bytes);
  assert.deepEqual(document, created);
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
      assert.ok(!caller.has(value), 'Surface-area result aliases caller data');
      assert.ok(!seen.has(value), 'Repeated nested output object occurrence');
      seen.add(value);
      for (const child of Object.values(value)) visit(child);
    }
  };
  visit(result);
}
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function checkCell(geometry, cell, checkAnalyticNode) {
  const {u, v} = cell.region;
  assert.ok(u[0] < u[1] && v[0] < v[1]);
  assert.equal(cell.nodes.length, 33);
  const pairs = new Set(), uNodes = new Map(), vNodes = new Map();
  const g3 = new Set([1, 3, 5]), g5 = new Set([0, 2, 3, 4, 6]);
  for (const node of cell.nodes) {
    assert.ok(Number.isInteger(node.uNodeIndex) && node.uNodeIndex >= 0 && node.uNodeIndex < 7);
    assert.ok(Number.isInteger(node.vNodeIndex) && node.vNodeIndex >= 0 && node.vNodeIndex < 7);
    assert.ok(g3.has(node.uNodeIndex) && g3.has(node.vNodeIndex) ||
      g5.has(node.uNodeIndex) && g5.has(node.vNodeIndex));
    const key = node.uNodeIndex + ':' + node.vNodeIndex;
    assert.ok(!pairs.has(key)); pairs.add(key);
    assert.ok(node.u > u[0] && node.u < u[1] && node.v > v[0] && node.v < v[1]);
    for (const [indices, index, parameter] of [[uNodes, node.uNodeIndex, node.u], [vNodes, node.vNodeIndex, node.v]]) {
      if (indices.has(index)) assert.ok(Object.is(indices.get(index), parameter));
      else indices.set(index, parameter);
    }
    const native = evaluateSurfaceD1(geometry, node.u, node.v);
    assert.deepEqual(node.pointMM, native.point);
    assert.equal(node.jacobian, Math.hypot(...cross(native.du, native.dv)));
    if (checkAnalyticNode) checkAnalyticNode(node, native);
  }
  for (const indices of [uNodes, vNodes]) {
    assert.equal(indices.size, 7);
    for (let index = 1; index < 7; index++) assert.ok(indices.get(index) > indices.get(index - 1));
  }
  const uGrid = [u[0], u[0] + (u[1] - u[0]) / 2, u[1]];
  const vGrid = [v[0], v[0] + (v[1] - v[0]) / 2, v[1]];
  assert.equal(cell.sanityGrid.length, 9);
  for (const [index, point] of cell.sanityGrid.entries()) {
    assert.ok(Object.is(point.u, uGrid[Math.floor(index / 3)]));
    assert.ok(Object.is(point.v, vGrid[index % 3]));
    assert.deepEqual(point.pointMM, evaluateSurface(geometry, point.u, point.v));
  }
  const centre = cell.nodes.find(node => node.uNodeIndex === 3 && node.vNodeIndex === 3);
  assert.deepEqual(cell.sanityGrid[4].pointMM, centre.pointMM);
  const expectedIndices = [];
  for (let ui = 0; ui < 2; ui++) for (let vi = 0; vi < 2; vi++) {
    const lowLow = 3 * ui + vi, highLow = lowLow + 3, highHigh = highLow + 1, lowHigh = lowLow + 1;
    expectedIndices.push([lowLow, highLow, highHigh], [lowLow, highHigh, lowHigh]);
  }
  assert.equal(cell.triangles.length, 8);
  for (const [index, triangle] of cell.triangles.entries()) {
    assert.deepEqual(triangle.pointIndices, expectedIndices[index]);
    const [a, b, c] = triangle.pointIndices.map(pointIndex => cell.sanityGrid[pointIndex].pointMM);
    const ab = b.map((value, axis) => value - a[axis]), ac = c.map((value, axis) => value - a[axis]);
    assert.equal(triangle.areaMM2, .5 * Math.hypot(...cross(ab, ac)));
  }
  assert.equal(cell.nativeTriangleAreaMM2, cell.triangles.reduce((sum, triangle) => sum + triangle.areaMM2, 0));
  assert.equal(cell.gaussDifferenceMM2, Math.abs(cell.Q5 - cell.Q3));
  assert.equal(cell.roundoffFloorMM2, cell.Q5 === 0 ? 0 : 64 * Number.EPSILON * Math.abs(cell.Q5));
  assert.equal(cell.triangleShortfallMM2, Math.max(0, cell.nativeTriangleAreaMM2 - cell.Q5));
  assert.equal(cell.errorEstimateMM2, Math.max(cell.gaussDifferenceMM2, cell.roundoffFloorMM2, cell.triangleShortfallMM2));
  assert.ok(Number.isFinite(cell.Q3) && Number.isFinite(cell.Q5) && cell.Q5 >= 0 && cell.errorEstimateMM2 >= 0);
}

function check(name, saved, bodyId, inputOptions, expectedAreaMM2, checkAnalyticNode) {
  const before = structuredClone(saved.document), optionsBefore = structuredClone(inputOptions);
  const reference = createCadGeometryReference(saved.document, {bodyId}).reference;
  const result = query(saved.document, reference, inputOptions);
  checkOwnership(saved.document, reference, inputOptions, result);
  assert.deepEqual(Object.keys(result).sort(),
    ['reference', 'geometry', 'source', 'options', 'areaEstimateMM2', 'errorEstimateMM2', 'cells', 'report'].sort());
  const resolved = resolveCadGeometryReference(saved.document, reference), report = result.report;
  assert.deepEqual(result.reference, reference);
  assert.deepEqual(result.geometry, resolved.geometry);
  assert.equal(result.source, resolved.source);
  assert.deepEqual(result.options, inputOptions);
  assert.equal(report.schema, 'barocss-cad-surface-area');
  assert.equal(report.version, 0);
  assert.deepEqual(report.reference, reference);
  assert.equal(report.sourceFrame, reference.sourceFrame);
  assert.equal(report.lengthUnit, 'mm');
  assert.equal(report.areaUnit, 'mm2');
  assert.deepEqual(report.originalDomains, surfaceDomain(resolved.geometry));
  assert.deepEqual(report.requestedRegion, inputOptions.region);
  assert.deepEqual(report.region, inputOptions.region ?? surfaceDomain(resolved.geometry));
  for (const axis of ['u', 'v']) {
    const knots = result.geometry[axis === 'u' ? 'knotsU' : 'knotsV'];
    const [start, end] = report.originalDomains[axis];
    const interior = [...new Set(knots.filter(knot => knot > start && knot < end))];
    assert.deepEqual(report.originalBreaks[axis], [start, ...interior, end]);
    const [a, b] = report.region[axis];
    assert.deepEqual(report.initialBreaks[axis], [a, ...interior.filter(knot => knot > a && knot < b), b]);
  }
  assert.equal(report.initialCellCount, (report.initialBreaks.u.length - 1) * (report.initialBreaks.v.length - 1));
  assert.equal(result.cells.length, report.finalCellCount);
  const measuredCells = new Map(), finalIds = new Set();
  const rememberCell = cell => {
    assert.ok(Number.isInteger(cell.cellIndex) && cell.cellIndex >= 0 && cell.cellIndex < report.cellMeasurementCount);
    const previous = measuredCells.get(cell.cellIndex);
    if (previous) assert.deepEqual(cell, previous);
    else measuredCells.set(cell.cellIndex, cell);
  };
  for (const cell of result.cells) {
    // Measurement IDs include discarded parents. The final list retains replacement traversal order.
    rememberCell(cell);
    assert.ok(!finalIds.has(cell.cellIndex)); finalIds.add(cell.cellIndex);
    assert.ok(cell.depth <= inputOptions.maximumDepth);
    for (const axis of ['u', 'v']) {
      assert.ok(cell.region[axis][0] >= report.region[axis][0] && cell.region[axis][1] <= report.region[axis][1]);
      const span = cell.originalSpanIndices[axis];
      assert.ok(Number.isInteger(span) && span >= 0 && span < report.originalBreaks[axis].length - 1);
      assert.ok(cell.region[axis][0] >= report.originalBreaks[axis][span] &&
        cell.region[axis][1] <= report.originalBreaks[axis][span + 1]);
    }
    checkCell(result.geometry, cell, checkAnalyticNode);
  }
  assert.equal(result.areaEstimateMM2, result.cells.reduce((sum, cell) => sum + cell.Q5, 0));
  assert.equal(result.errorEstimateMM2, result.cells.reduce((sum, cell) => sum + cell.errorEstimateMM2, 0));
  assert.equal(report.areaEstimateMM2, result.areaEstimateMM2);
  assert.equal(report.errorEstimateMM2, result.errorEstimateMM2);
  assert.equal(report.requestedAbsoluteToleranceMM2, inputOptions.absoluteToleranceMM2);
  assert.equal(report.requestedRelativeTolerance, inputOptions.relativeTolerance);
  assert.equal(report.achievedToleranceMM2, Math.max(inputOptions.absoluteToleranceMM2,
    inputOptions.relativeTolerance * result.areaEstimateMM2));
  assert.ok(result.errorEstimateMM2 <= report.achievedToleranceMM2);
  assert.equal(report.criterion, 'aggregate-cell-estimator-not-certified-upper-bound');
  assert.equal(report.criterionSatisfied, true);
  assert.equal(report.quality.globalErrorCertified, false);
  assert.equal(report.rule.derivativeCallsPerCell, 33);
  assert.equal(report.rule.pointCallsPerCell, 8);
  // The analytic comparison is local case evidence, separate from the heuristic estimator.
  const analyticDifferenceMM2 = Math.abs(result.areaEstimateMM2 - expectedAreaMM2);
  assert.ok(analyticDifferenceMM2 <= 1e-6);
  assert.equal(report.evaluationCount, report.cellMeasurementCount * 33);
  assert.equal(report.pointEvaluationCount, report.cellMeasurementCount * 8);
  assert.ok(report.evaluationCount <= inputOptions.maximumEvaluations);
  assert.ok(report.subdivisionCount <= inputOptions.maximumSubdivisions);
  assert.equal(report.cellMeasurementCount, report.initialCellCount + 4 * report.subdivisionCount);
  assert.equal(report.finalCellCount, report.initialCellCount + 3 * report.subdivisionCount);
  assert.equal(report.subdivisions.length, report.subdivisionCount);
  for (const [index, subdivision] of report.subdivisions.entries()) {
    assert.equal(subdivision.index, index);
    const {parent, midpoint, children} = subdivision;
    const {u, v} = parent.region;
    assert.ok(midpoint.u > u[0] && midpoint.u < u[1] && midpoint.v > v[0] && midpoint.v < v[1]);
    const us = [[u[0], midpoint.u], [midpoint.u, u[1]]], vs = [[v[0], midpoint.v], [midpoint.v, v[1]]];
    assert.equal(children.length, 4);
    rememberCell(parent); checkCell(result.geometry, parent, checkAnalyticNode);
    for (const [childIndex, child] of children.entries()) {
      assert.deepEqual(child.region, {u: us[Math.floor(childIndex / 2)], v: vs[childIndex % 2]});
      assert.equal(child.depth, parent.depth + 1);
      assert.equal(child.cellIndex, report.initialCellCount + 4 * index + childIndex);
      assert.ok(parent.cellIndex < child.cellIndex);
      assert.deepEqual(child.originalSpanIndices, parent.originalSpanIndices);
      rememberCell(child); checkCell(result.geometry, child, checkAnalyticNode);
    }
    assert.equal(subdivision.evaluationCountAfterSubdivision, 33 * (report.initialCellCount + 4 * (index + 1)));
    assert.equal(subdivision.pointEvaluationCountAfterSubdivision, 8 * (report.initialCellCount + 4 * (index + 1)));
  }
  assert.equal(measuredCells.size, report.cellMeasurementCount);
  let initialIndex = 0;
  for (let u = 0; u < report.initialBreaks.u.length - 1; u++) {
    for (let v = 0; v < report.initialBreaks.v.length - 1; v++) {
      assert.deepEqual(measuredCells.get(initialIndex++).region,
        {u: report.initialBreaks.u.slice(u, u + 2), v: report.initialBreaks.v.slice(v, v + 2)});
    }
  }
  assert.equal(report.guardEvaluationCount, report.guards.length);
  for (const guard of report.guards) {
    assert.equal(guard.status, 'native-refused');
    assert.ok(Object.is(guard.probe[guard.axis], guard.parameter));
    assert.throws(() => evaluateSurfaceD1(result.geometry, guard.probe.u, guard.probe.v), error => {
      assert.equal(guard.nativeErrorName, error.name);
      assert.equal(guard.nativeErrorCode, error.code ?? null);
      assert.equal(guard.message, error.message);
      return true;
    });
    assert.ok(result.cells.every(cell => cell.nodes.every(node => node[guard.axis] !== guard.parameter)));
  }
  assert.deepEqual(validate(saved.document, result), report);
  const stored = ownedFile(name + '.owned-result', result);
  const cold = parseCadDocument(readFileSync(saved.file, 'utf8'));
  assert.deepEqual(validate(cold, stored.reopened), report);
  assert.deepEqual(query(cold, reference, inputOptions), result);
  assert.deepEqual(saved.document, before);
  assert.deepEqual(inputOptions, optionsBefore);
  summaries.push({name, bodyId, geometryId: reference.geometryId, documentRevision: reference.documentRevision,
    region: report.region, expectedAreaMM2, areaEstimateMM2: result.areaEstimateMM2, analyticDifferenceMM2,
    errorEstimateMM2: result.errorEstimateMM2, finalCells: result.cells.length,
    evaluationCount: report.evaluationCount, pointEvaluationCount: report.pointEvaluationCount,
    guardEvaluationCount: report.guardEvaluationCount, subdivisionCount: report.subdivisionCount,
    resultFile: stored.file, documentFile: saved.file});
  return result;
}

// Source0 writing here records native fixture coefficients; it does not evaluate splines.
function fixtureSource(name, objects) {
  const authored = object => object.kind === 'curve'
    ? `@curve #${object.id} { type:nurbs; degree:${object.degree}; knots:${nativeJSON(object.knots)}; control-points:${nativeJSON(object.controlPoints)}; weights:${nativeJSON(object.weights)}; }`
    : `@surface #${object.id} { type:nurbs; degree-u:${object.degreeU}; degree-v:${object.degreeV}; knots-u:${nativeJSON(object.knotsU)}; knots-v:${nativeJSON(object.knotsV)}; control-points:${nativeJSON(object.controlPoints)}; weights:${nativeJSON(object.weights)}; }`;
  return sourceFile(name, `@model ${name} { version:0; length-unit:mm;\n${objects.map(authored).join('\n')}\n}\n`,
    {name, version: 0, lengthUnit: 'mm', objects});
}

function planePoint(u, v, width = 2) { return [width * (u + 3) / 10, v - 2, 0]; }
function closePoint(actual, expected) { assert.ok(difference(actual, expected) <= 1e-7); }
function planeNode(node, native, width = 2) {
  closePoint(node.pointMM, planePoint(node.u, node.v, width));
  closePoint(native.du, [width / 10, 0, 0]);
  closePoint(native.dv, [0, 1, 0]);
}
function cylinderNode(node, native) {
  assert.ok(Math.abs(Math.hypot(node.pointMM[0], node.pointMM[1]) - 2) <= 1e-7);
  assert.ok(Math.abs(node.pointMM[2] - (node.u - 2)) <= 1e-7);
  closePoint(native.du, [0, 0, 1]);
  assert.ok(Math.abs(native.dv[2]) <= 1e-7);
}
function c0Node(node, native) {
  const expected = node.u < 1 ? [3 * node.u, 3 * node.v, 0] : [3, 3 * node.v, 2 * (node.u - 1)];
  closePoint(node.pointMM, expected);
  closePoint(native.du, node.u < 1 ? [3, 0, 0] : [0, 0, 2]);
  closePoint(native.dv, [0, 3, 0]);
}

ownedFile('source-api.metafile', built.metafile);
ownedFile('source-api.inputs', {entry, mode: 'in-memory-esbuild', write: false,
  cadInputs, allInputs: sourceInputs, esbuildVersion: esbuild.version});
const plane = {kind: 'surface', id: 'plane_nonunit', degreeU: 1, degreeV: 1,
  knotsU: [-3, -3, 7, 7], knotsV: [2, 2, 5, 5],
  controlPoints: [[[0, 0, -0], [0, 3, -0]], [[2, 0, -0], [2, 3, -0]]], weights: [[1, 1], [1, 1]]};
const planeSource = fixtureSource('plane_original', [plane]);
const meridian = {kind: 'curve', id: 'cylinder_meridian', degree: 1,
  knots: [2, 2, 5, 5], controlPoints: [[2, 0, 0], [2, 0, 3]], weights: [1, 1]};
const meridianBefore = structuredClone(meridian);
const cylinder = buildZAxisRevolvedSurface(meridian, {surfaceId: 'cylinder_surface'});
assert.deepEqual(meridian, meridianBefore);
const cylinderSource = sourceFile('native_cylinder', cylinder.source, cylinder.model);
assert.deepEqual(surfaceDomain(cylinder.surface), {u: [2, 5], v: [0, 4]});
const bent = {kind: 'curve', id: 'bent_c0_curve', degree: 1, knots: [-0, 0, 1, 3, 3],
  controlPoints: [[0, 0, 0], [3, 0, 0], [3, 0, 4]], weights: [1, 1, 1]};
const bentBefore = structuredClone(bent);
const extruded = extrudeCurve(bent, {id: 'bent_c0_surface', vector: [0, 3, 0]});
assert.deepEqual(bent, bentBefore);
const zero = {kind: 'surface', id: 'zero_surface', degreeU: 1, degreeV: 1,
  knotsU: [-0, -0, 1, 1], knotsV: [-0, -0, 1, 1],
  controlPoints: [[[-0, -0, -0], [-0, -0, -0]], [[-0, -0, -0], [-0, -0, -0]]], weights: [[1, 1], [1, 1]]};
const extreme = {kind: 'surface', id: 'concentrated_square', degreeU: 1, degreeV: 1,
  knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1],
  controlPoints: [[[0, 0, 0], [0, 1, 0]], [[1, 0, 0], [1, 1, 0]]],
  weights: [[1e6, 1e6], [1e-6, 1e-6]]};
const mixedSource = fixtureSource('native_c0_zero_concentrated', [bent, extruded, zero, extreme]);
const planeBefore = structuredClone(plane);
const reversed = reverseSurfaceAxis(plane, {surfaceId: 'plane_reversed', axis: 'u', resultIdPrefix: 'area_reverse'});
assert.deepEqual(plane, planeBefore);
const reversedSource = sourceFile('plane_reversed', reversed.source, reversed.model);
const sources = [planeSource, cylinderSource, mixedSource, reversedSource];
const assets = sources.map((saved, index) => ({id: 'asset_' + index, revision: 1,
  role: 'authored-native-source', sourceVersion: 0, sourceFrame: frame, source: saved.source}));
const bodies = [['plane_body', plane.id, 0], ['cylinder_body', cylinder.surface.id, 1],
  ['c0_body', extruded.id, 2], ['zero_body', zero.id, 2], ['concentrated_body', extreme.id, 2],
  ['reversed_body', reversed.surface.id, 3]]
  .map(([id, geometryId, index]) => ({id, name: id, kind: 'direct-geometry-object', assetId: assets[index].id, geometryId}));
const wire = {schema: 'barocss-cad-document', version: 1, profile: 'direct-geometry', documentId: 'surface_area_doc', revision: 1,
  units: {length: 'mm', angle: 'rad'}, nativeFrame: frame, assets, bodies,
  features: [], parameters: [], constraints: [], placements: [], derivedCaches: []};
const saved = documentFile('revision1', wire), documentBefore = structuredClone(saved.document);
const planar = check('plane6', saved, 'plane_body', options, 6, planeNode);
const planarQuarter = check('plane_declared_quarter1_5', saved, 'plane_body',
  {...options, region: {u: [-3, 2], v: [2, 3.5]}}, 1.5, planeNode);
const lateral = check('cylinder_12pi', saved, 'cylinder_body', options, 12 * Math.PI, cylinderNode);
assert.ok(lateral.report.subdivisions.length > 0, 'Cylinder trace must contain actual refinement');
const firstQuadrant = check('cylinder_declared_half_height_first_quadrant', saved, 'cylinder_body',
  {...options, region: {u: [2, 3.5], v: [0, 1]}}, 1.5 * Math.PI, cylinderNode);
const c0Area = check('c0_extrusion21', saved, 'c0_body', options, 21, c0Node);
assert.deepEqual(c0Area.geometry.knotsU, [-0, 0, 1, 3, 3]);
assert.ok(c0Area.report.guards.some(guard => guard.axis === 'u' && guard.parameter === 1));
const zeroArea = check('zero_area', saved, 'zero_body', options, 0);
assert.equal(zeroArea.areaEstimateMM2, 0);
assert.equal(zeroArea.errorEstimateMM2, 0);
assert.ok(Object.is(zeroArea.report.region.u[0], -0));
assert.ok(Object.is(zeroArea.report.region.v[0], -0));
const reverseArea = check('reversed_plane6', saved, 'reversed_body', options, 6, (node, native) =>
  planeNode({...node, u: 4 - node.u}, {...native, du: native.du.map(value => -value)}));
assert.ok(Math.abs(reverseArea.areaEstimateMM2 - planar.areaEstimateMM2) <= 1e-7);
const planarBefore = structuredClone(planar), lateralBefore = structuredClone(lateral);

// Actual same-ID control-net edit; only explicit document and asset revisions advance.
const edited = editSurfaceControlNet(plane, {poleEdits: [
  {uIndex: 1, vIndex: 0, xMM: 4}, {uIndex: 1, vIndex: 1, xMM: 4},
]});
assert.deepEqual(plane, planeBefore);
assert.equal(edited.surface.id, plane.id);
const editedSource = sourceFile('edited_plane', edited.source, edited.model);
const editedWire = structuredClone(wire);
editedWire.revision = 2;
editedWire.assets[0].revision = 2;
editedWire.assets[0].source = editedSource.source;
const updated = documentFile('revision2', editedWire), updatedBefore = structuredClone(updated.document);
const editedArea = check('edited_plane12', updated, 'plane_body', options, 12,
  (node, native) => planeNode(node, native, 4));
assert.equal(editedArea.reference.geometryId, planar.reference.geometryId);
assert.deepEqual(saved.document, documentBefore);
assert.deepEqual(planar, planarBefore);
assert.deepEqual(readFileSync(saved.file), saved.bytes);

function reject(name, action, code) {
  assert.throws(action, error => {
    assert.ok(error instanceof CadSurfaceAreaError);
    assert.equal(error.name, 'CadSurfaceAreaError');
    assert.ok(Object.values(CadSurfaceAreaDiagnosticCode).includes(error.code));
    assert.equal(error.code, code);
    failures.push({name, code: error.code, message: error.message,
      actualCausePreserved: Object.hasOwn(error, 'cause')});
    assert.deepEqual(saved.document, documentBefore);
    assert.deepEqual(updated.document, updatedBefore);
    assert.deepEqual(planar, planarBefore);
    assert.deepEqual(lateral, lateralBefore);
    for (const [file, bytes] of retainedFiles) assert.deepEqual(readFileSync(file), bytes);
    return true;
  });
}

reject('stale_reference', () => query(updated.document, planar.reference, options), 'STALE');
reject('stale_owned_area', () => validate(updated.document, planar), 'STALE');
for (const [name, u] of [['zero_region', [1, 1]], ['reversed_region', [2, 1]], ['outside_region', [-4, 7]]]) {
  reject(name, () => query(saved.document, planar.reference, {...options, region: {u, v: [2, 5]}}), 'REGION');
}
reject('thirty_three_call_full_cylinder_budget', () => query(saved.document, lateral.reference,
  {...options, absoluteToleranceMM2: 1e-8, relativeTolerance: 0, maximumEvaluations: 33}), 'BUDGET');
const concentratedReference = createCadGeometryReference(saved.document, {bodyId: 'concentrated_body'}).reference;
reject('extreme_rational_endpoint_concentration', () => query(saved.document, concentratedReference, options), 'BUDGET');
reject('seven_distinct_u_nodes_unrepresented', () => query(saved.document, planar.reference,
  {...options, region: {u: [.5, .5 + Number.EPSILON], v: [2, 5]}}), 'REPRESENTABILITY');
let getterCalls = 0;
const getter = {...options};
Object.defineProperty(getter, 'absoluteToleranceMM2', {
  enumerable: true, get() { getterCalls++; return options.absoluteToleranceMM2; },
});
reject('options_getter', () => query(saved.document, planar.reference, getter), 'INPUT');
assert.equal(getterCalls, 0);
for (const [name, alter] of [
  ['source', result => result.source += ' '],
  ['coefficient', result => result.geometry.controlPoints[0][0][0] += .1],
  ['cell_jacobian', result => result.cells[0].nodes[0].jacobian += .1],
  ['estimator', result => result.errorEstimateMM2 += .1],
  ['trace', result => result.report.subdivisions[0].midpoint.u += .01],
  ['report', result => result.report.evaluationCount++],
]) {
  const changed = structuredClone(name === 'trace' ? lateral : planar);
  alter(changed);
  reject('owned_' + name + '_tamper', () => validate(saved.document, changed), 'OWNED');
}
assert.deepEqual(validate(saved.document, planar), planar.report);

// Public compiled JS and all eight declarations are checked as a separate consumer.
const packageRoot = resolve(repo, 'packages/barocss-cad');
const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath));
assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const runtimeExports = ['queryCadDocumentSurfaceArea', 'validateCadDocumentSurfaceArea', 'CadSurfaceAreaError', 'CadSurfaceAreaDiagnosticCode'];
for (const name of runtimeExports) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.CadSurfaceAreaDiagnosticCode, CadSurfaceAreaDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./nurbs/surfaces/cad-surface-area.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/nurbs/surfaces/cad-surface-area.d.ts');
const leafDeclaration = readFileSync(leafDeclarationPath, 'utf8');
const declarationExports = [...runtimeExports, 'CadSurfaceAreaOptions', 'CadSurfaceAreaCell', 'CadSurfaceAreaReport', 'CadSurfaceAreaResult'];
for (const name of declarationExports) {
  assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(leafDeclaration), name);
}
assert.ok(leafDeclaration.includes('export type CadSurfaceAreaDiagnosticCode'));
const compiledDocument = publicAPI.parseCadDocument(readFileSync(saved.file, 'utf8'));
const compiled = publicAPI.queryCadDocumentSurfaceArea(compiledDocument, lateral.reference, options);
assert.deepEqual(compiled, lateral);
assert.deepEqual(publicAPI.validateCadDocumentSurfaceArea(compiledDocument, compiled), lateral.report);
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeExports, declarationExports,
  finalCells: compiled.cells.length, areaEstimateMM2: compiled.areaEstimateMM2,
  declarationCheck: 'actual exported declaration text; no separate TypeScript invocation'};
ownedFile('compiled-consumer', compiledConsumer);
ownedFile('summary', {sourceMode: true, cadSourceInputCount: cadInputs.length, summaries, failures, compiledConsumer,
  caseCount: summaries.length, refusalCount: failures.length,
  maximumAnalyticDifferenceMM2: Math.max(...summaries.map(summary => summary.analyticDifferenceMM2)),
  sourceFiles: [...sources.map(saved => saved.file), editedSource.file],
  scope: 'Actual native Du-cross-Dv integration in original parameters. Q5 is the area estimate. Rule difference, roundoff floor, and native triangle deficit are heuristic convergence evidence. Analytic comparisons are local fixtures only. Native C0 guard calls stay separate. No mesh-area substitution, certified global error, manufacturing, regularity, topology, solid, or reader campaign.'});
console.log(JSON.stringify({sourceMode: true, cadSourceInputCount: cadInputs.length, summaries, failures, compiledConsumer}));
