import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node curve-planar-face-material-demo.mjs --source <output-directory>'); assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]); mkdirSync(output, {recursive: true});
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const esbuild = require('esbuild'), entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundle = await esbuild.build({absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true});
assert.equal(bundle.outputFiles.length, 1);
const sourceInputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path)), cadInputs = sourceInputs.filter(path => path.includes('/packages/barocss-cad/'));
for (const leaf of ['index.ts', 'curve-planar-face-material.ts', 'curve-wide-plane-intersection.ts', 'curve-wide-cubic-plane-intersection.ts',
  'curve-interval-extraction.ts', 'own-convex-planar-face-holes.ts']) assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const {intersectCurveWithPlanarFaceMaterial: intersect, validateCurvePlanarFaceMaterialIntersection: validate,
  CurvePlanarFaceMaterialError, CurvePlanarFaceMaterialDiagnosticCode, buildConvexPlanarFaceWithHoles: buildFace,
  validateConvexPlanarFaceWithHoles: validateFace, classifyConvexPlanarFaceWithHolesUV: classify,
  evaluateCurve, evaluateCurveD1, evaluateSurface, evaluateSurfaceD1, curveDomain, compileCadModel} = api;
const runtimeNames = ['intersectCurveWithPlanarFaceMaterial', 'validateCurvePlanarFaceMaterialIntersection', 'CurvePlanarFaceMaterialError', 'CurvePlanarFaceMaterialDiagnosticCode'];
const typeNames = ['CurvePlanarFaceMaterialOptions', 'CurvePlanarFaceMaterialEvent', 'CurvePlanarFaceMaterialReport', 'CurvePlanarFaceMaterialResult'];
for (const name of runtimeNames) assert.equal(typeof api[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(Object.keys(CurvePlanarFaceMaterialDiagnosticCode).sort(), ['INPUT', 'BUDGET', 'UNSUPPORTED', 'NATIVE', 'UNCERTAINTY', 'BINDING', 'OWNED'].sort());
const retainedFiles = new Map(), accepted = [], cases = [], failures = [], faces = [];

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
  assert.equal(cold.ok, true, JSON.stringify(cold.diagnostics)); assert.deepEqual(cold.model, model); assert.ok(model.objects.length <= 16); return {file, model: cold.model};
}
function ownership(inputs, result) {
  const caller = new WeakSet(), seen = new WeakSet();
  const collect = value => { if (value && typeof value === 'object' && !caller.has(value)) {
    caller.add(value); for (const child of Object.values(value)) collect(child);
  }};
  inputs.forEach(collect);
  const visit = value => { if (value && typeof value === 'object') {
    assert.ok(!caller.has(value), 'Caller alias'); assert.ok(!seen.has(value), 'Repeated result occurrence');
    seen.add(value); for (const child of Object.values(value)) visit(child);
  }};
  visit(result);
}
const close = (actual, expected, label) => {
  const error = Array.isArray(expected) ? Math.hypot(...actual.map((value, i) => value - expected[i])) : Math.abs(actual - expected);
  assert.ok(error <= 1e-7, label + ': ' + error); return error;
};
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function projectedUV(point, plane) {
  const origin = plane.controlPoints[0][0], u = plane.controlPoints[1][0].map((v, i) => v - origin[i]), v = plane.controlPoints[0][1].map((x, i) => x - origin[i]);
  const d = point.map((x, i) => x - origin[i]), uu = dot(u, u), vv = dot(v, v), uv = dot(u, v), determinant = uu * vv - uv * uv;
  const s = (dot(d, u) * vv - dot(d, v) * uv) / determinant, t = (dot(d, v) * uu - dot(d, u) * uv) / determinant;
  return [plane.knotsU[1] + (plane.knotsU[2] - plane.knotsU[1]) * s,
    plane.knotsV[1] + (plane.knotsV[2] - plane.knotsV[1]) * t, 0];
}
const clamped = (p, a, b) => [...Array(p + 1).fill(a), ...Array(p + 1).fill(b)];
const bezier = (id, points, a = -3, b = 7, weights = Array(points.length).fill(1)) =>
  ({kind: 'curve', id, degree: points.length - 1, knots: clamped(points.length - 1, a, b), controlPoints: points, weights});
const tiltedChart = (s, t) => [4 * s + t, 4 * t, 4 * s + t];
const flatChart = (s, t) => [s, t, 0];
const outerVertices = [[.0625, .0625], [.9375, .0625], [.9375, .9375], [.0625, .9375]];
const holeVertices = [[.375, .375], [.625, .375], [.625, .625], [.375, .625]];
function faceFixture(name, chart, holesVertices, uDomain = [0, 1], vDomain = [0, 1], orientation = 'forward', outerPoints = outerVertices) {
  const plane = {kind: 'surface', id: name + '_plane', degreeU: 1, degreeV: 1, knotsU: clamped(1, ...uDomain), knotsV: clamped(1, ...vDomain),
    controlPoints: [[chart(0, 0), chart(0, 1)], [chart(1, 0), chart(1, 1)]], weights: [[1, 1], [1, 1]]};
  const loop = (id, vertices) => ({id, edges: vertices.map((point, i) => bezier(id + '_line_' + i,
    [chart(...point), chart(...vertices[(i + 1) % vertices.length])], i - 3, i + 7, [i + 1, i + 1]))});
  const outer = loop(name + '_outer', outerPoints), holes = holesVertices.map((vertices, i) => loop(name + '_hole_' + i, vertices));
  const options = {faceId: name + '_face', evaluationId: name + '_eval', resultIdPrefix: name + '_own', orientation};
  const before = structuredClone({plane, outer, holes, options}), face = buildFace(plane, outer, holes, options);
  ownership([plane, outer, holes, options], face); assert.deepEqual({plane, outer, holes, options}, before); assert.deepEqual(validateFace(face), face.report);
  const source = sourceFile(name + '.original-face', face.source, face.model);
  const authored = jsonFile(name + '.authored-face', {plane, outer, holes, options}), saved = jsonFile(name + '.owned-face', face);
  assert.deepEqual(buildFace(authored.reopened.plane, authored.reopened.outer, authored.reopened.holes, authored.reopened.options), saved.reopened);
  const actualUV = ([s, t]) => [uDomain[0] + (uDomain[1] - uDomain[0]) * s, vDomain[0] + (vDomain[1] - vDomain[0]) * t];
  faces.push({face, before: structuredClone(face), sourceFile: source.file, ownedFile: saved.file}); return {face, chart, actualUV};
}
const tilted = faceFixture('tilted', tiltedChart, [holeVertices]);
const flat = faceFixture('flat', flatChart, [holeVertices]);
const nonunit = faceFixture('nonunit', tiltedChart,
  [[[.25, .25], [.375, .25], [.3125, .375]], [[.5625, .5625], [.75, .5625], [.75, .75], [.5625, .75]]], [-2, 3], [4, 8], 'reverse');
const triangular = faceFixture('triangle', flatChart, [[[.375, .375], [.625, .375], [.5, .625]]]);
const maximumFace = faceFixture('maxface', tiltedChart,
  [[[.25, .25], [.375, .25], [.3125, .375]], [[.625, .625], [.75, .625], [.75, .75], [.625, .75]]], [0, 1], [0, 1], 'forward',
  [[.125, .0625], [.875, .0625], [.9375, .125], [.9375, .875], [.875, .9375], [.125, .9375], [.0625, .875], [.0625, .125]]);
assert.equal(maximumFace.face.model.objects.length, 16);
jsonFile('source-api.inputs', {entry, sourceInputs, cadInputs, sourceOnly: true, write: false, esbuildVersion: esbuild.version});
jsonFile('source-api.metafile', bundle.metafile);

function optionsFor(name, capacity = 4) {
  return {evaluationId: name + '_query', resultIdPrefix: name.slice(0, 8), pointEventIds: Array.from({length: capacity}, (_, i) => name + '_event_' + i),
    maximumBracketRestrictions: 192, maximumClassifications: 192};
}
function check(name, curve, fixture, expectations, options = optionsFor(name)) {
  const face = fixture.face, before = structuredClone({curve, face, options});
  const authored = jsonFile(name + '.authored-query', {curve, faceFile: faces.find(row => row.face === face).ownedFile, options});
  const result = intersect(curve, face, options); ownership([curve, face, options], result); assert.deepEqual({curve, face, options}, before);
  assert.deepEqual(Object.keys(result).sort(), ['curve', 'face', 'options', 'intersection', 'events', 'report'].sort());
  assert.deepEqual(result.curve, curve); assert.deepEqual(result.face, face); assert.deepEqual(result.options, options);
  const parent = result.intersection; assert.deepEqual(parent.curve, curve); assert.deepEqual(parent.plane, face.plane);
  assert.deepEqual(parent.options, {evaluationId: options.evaluationId, resultIdPrefix: options.resultIdPrefix, pointEventIds: options.pointEventIds});
  assert.deepEqual(curveDomain(parent.curve), curveDomain(curve)); assert.deepEqual(parent.model.objects, [curve, face.plane]);
  assert.equal(parent.model.objects.length, 2); assert.ok(face.model.objects.length <= 16);
  const parentMethod = curve.degree === 3 ? api.intersectCubicCurveWideWithAffinePlaneSurface : api.intersectCurveWideWithAffinePlaneSurface;
  assert.deepEqual(parent, parentMethod(curve, face.plane, parent.options));
  const parentFile = sourceFile(name + '.actual-parent', parent.source, parent.model), faceFile = sourceFile(name + '.actual-face', face.source, face.model);
  for (const span of parent.spans) sourceFile(name + '.span_' + span.spanIndex, span.source, span.model);
  assert.equal(result.events.length, expectations.length); assert.equal(result.events.length, parent.events.length);
  let restrictionCount = 0, splitCount = 0, contributionCount = 0;
  const classificationCounts = {inside: 0, 'inside-hole': 0, boundary: 0, outside: 0, 'outside-domain': 0};
  for (const [i, event] of result.events.entries()) {
    const root = parent.events[i], expected = expectations[i];
    assert.deepEqual(Object.keys(event).sort(), ['eventId', 'parameter', 'classification', 'material', 'faceClassification', 'brackets'].sort());
    assert.equal(event.eventId, root.eventId); assert.equal(event.parameter, root.parameter); close(event.parameter, expected.parameter, 'analytic original parameter');
    assert.equal(event.classification, expected.classification); assert.equal(event.material, ['inside', 'boundary'].includes(expected.classification));
    assert.equal(event.faceClassification.holeId, expected.holeId ?? null); classificationCounts[event.classification]++;
    const actualPoint = evaluateCurve(curve, root.parameter), actualD1 = evaluateCurveD1(curve, root.parameter);
    assert.deepEqual(root.pointMM, actualPoint); assert.deepEqual(root.originalCurveD1, {status: 'evaluated', value: actualD1});
    close(root.planeUV.slice(0, 2), expected.uv, 'analytic native UV');
    assert.deepEqual(event.faceClassification, classify(face, root.planeUV.slice(0, 2)));
    if (event.classification === 'outside-domain') { assert.equal(event.faceClassification.pointMM, null); assert.equal(event.faceClassification.faceNormal, null); }
    else {
      assert.deepEqual(event.faceClassification.pointMM, evaluateSurface(face.plane, root.planeUV[0], root.planeUV[1]));
      const surfaceD1 = evaluateSurfaceD1(face.plane, root.planeUV[0], root.planeUV[1]), n = cross(surfaceD1.du, surfaceD1.dv), norm = Math.hypot(...n);
      close(event.faceClassification.faceNormal, n.map(value => value / norm * (face.options.orientation === 'forward' ? 1 : -1)), 'actual authored face normal');
      close(actualPoint, event.faceClassification.pointMM, 'original native Curve/Surface D0 binding');
    }
    assert.equal(event.faceClassification.boundaries.length, expected.boundaryCount ?? 0);
    for (const boundary of event.faceClassification.boundaries) {
      const loop = [face.outerLoop, ...face.holeLoops].find(row => row.id === boundary.loopId), line = loop.edges.find(row => row.id === boundary.curveId);
      const use = face.topology.loops.find(row => row.id === loop.id).uses.find(row => row.id === boundary.useId);
      assert.equal(boundary.edgeId, use.edgeId); assert.equal(boundary.pcurveId, use.pcurveId); assert.equal(boundary.traversalSense, use.sense);
      assert.deepEqual(boundary.lineD1, evaluateCurveD1(line, boundary.lineParameter)); close(actualPoint, boundary.lineD1.point, 'actual boundary contributor point');
      assert.ok(boundary.lineParameter >= curveDomain(line)[0] && boundary.lineParameter <= curveDomain(line)[1]);
    }
    assert.equal(event.brackets.length, root.contributions.length);
    for (const [j, bracket] of event.brackets.entries()) {
      const contribution = root.contributions[j], span = parent.spans.find(row => row.spanId === contribution.spanId);
      assert.equal(bracket.spanId, contribution.spanId); assert.equal(bracket.spanIndex, contribution.spanIndex);
      assert.equal(bracket.contributionEventId, contribution.event.eventId); assert.deepEqual(bracket.interval, contribution.event.bracket);
      assert.equal(bracket.decision.classification, event.classification); assert.equal(bracket.decision.material, event.material);
      assert.equal(bracket.decision.holeId, event.faceClassification.holeId); contributionCount++;
      assert.deepEqual(bracket.decision.boundaryContributors, event.faceClassification.boundaries.map(({loopId, loopRole, edgeId, curveId, useId, pcurveId}) =>
        ({loopId, loopRole, edgeId, curveId, useId, pcurveId})));
      let points, weights;
      if (bracket.interval[0] === bracket.interval[1]) {
        assert.equal(bracket.extraction, null); points = [evaluateCurve(curve, bracket.interval[0])]; weights = [1];
      } else {
        const extraction = bracket.extraction; assert.ok(extraction); restrictionCount++; splitCount += extraction.provenance.operations.length;
        assert.deepEqual(extraction.original, span.curve); assert.deepEqual(extraction.options.interval, bracket.interval); assert.deepEqual(curveDomain(extraction.curve), bracket.interval);
        assert.ok(span.curve.controlPoints.length <= 4); assert.equal(extraction.provenance.parameterMap.kind, 'identity'); assert.ok(extraction.provenance.operations.length <= 2);
        sourceFile(name + '.root_' + i + '.restriction_' + j, extraction.source, extraction.model);
        for (const parameter of bracket.interval) close(evaluateCurve(extraction.curve, parameter), evaluateCurve(curve, parameter), 'actual restriction original-parameter binding');
        points = extraction.curve.controlPoints; weights = extraction.curve.weights;
      }
      assert.ok(weights.every(weight => weight > 0)); assert.deepEqual(bracket.positiveWeights, weights);
      close(bracket.projectedControlHullUV.flat(), points.map(point => projectedUV(point, face.plane)).flat(), 'independent all-control-point Gram projection');
      assert.equal(bracket.projectedControlHullUV.length, points.length);
      for (const constraint of [...bracket.chartBounds, ...bracket.loopBounds]) {
        assert.equal(constraint.values.length, points.length); assert.equal(constraint.thresholds.length, points.length);
        assert.ok(constraint.thresholds.every(value => Number.isFinite(value) && value >= 0));
        if (constraint.sign === 'zero') assert.ok(constraint.values.every(value => value === 0));
        else assert.ok(constraint.values.every((value, index) => constraint.sign === 'positive' ? value > constraint.thresholds[index] : -value > constraint.thresholds[index]));
      }
      assert.equal(bracket.chartBounds.length, 4);
      for (const constraint of bracket.chartBounds) {
        const axis = constraint.axis === 'u' ? 0 : 1;
        assert.deepEqual(constraint.values, bracket.projectedControlHullUV.map(point => constraint.side === 'lower' ? point[axis] - constraint.limit : constraint.limit - point[axis]));
        assert.deepEqual(constraint.thresholds, bracket.projectedControlHullUV.map(point => 512 * Number.EPSILON * (Math.abs(point[axis]) + Math.abs(constraint.limit))));
      }
      assert.equal(bracket.loopBounds.length, event.classification === 'outside-domain' ? 0 : face.pcurves.length);
      for (const constraint of bracket.loopBounds) {
        const pcurve = face.pcurves.find(row => row.id === constraint.pcurveId), topology = face.topology.loops.find(row => row.id === constraint.loopId);
        const use = topology.uses.find(row => row.id === constraint.useId), loop = [face.outerLoop, ...face.holeLoops].find(row => row.id === constraint.loopId);
        assert.equal(use.edgeId, constraint.edgeId); assert.equal(use.curveId, constraint.curveId); assert.equal(loop.edges[constraint.edgeIndex].id, constraint.curveId);
        assert.equal(constraint.authoredOrientation, topology.authoredOrientation);
        const a = pcurve.curve.controlPoints[0], b = pcurve.curve.controlPoints[1], direction = [b[0] - a[0], b[1] - a[1]];
        const measures = bracket.projectedControlHullUV.map(point => {
          const first = direction[0] * (point[1] - a[1]), second = direction[1] * (point[0] - a[0]);
          return {value: (topology.authoredOrientation === 'ccw' ? 1 : -1) * (first - second), threshold: 512 * Number.EPSILON * (Math.abs(first) + Math.abs(second))};
        });
        assert.deepEqual(constraint.values, measures.map(row => row.value)); assert.deepEqual(constraint.thresholds, measures.map(row => row.threshold));
      }
    }
  }
  const report = result.report; assert.equal(report.schema, 'barocss-curve-planar-face-material'); assert.equal(report.version, 0);
  assert.equal(report.lengthUnit, 'mm'); assert.equal(report.frame, 'authored-xyz-mm-native-uv-dimensionless');
  assert.equal(report.spanCount, parent.spans.length); assert.equal(report.parentMaximumContributions, parent.report.limits.maximumContributions);
  assert.equal(report.rootEventCount, result.events.length); assert.equal(report.contributionCount, contributionCount);
  assert.equal(report.nonSingletonContributionCount, restrictionCount); assert.equal(report.bracketRestrictionCount, restrictionCount);
  assert.equal(report.nativeSplitCount, splitCount); assert.equal(report.classificationCount, result.events.length); assert.deepEqual(report.classificationCounts, classificationCounts);
  assert.deepEqual(report.identities, {nativeObjectIds: face.model.objects.map(object => object.id), loopIds: face.topology.loops.map(loop => loop.id),
    pcurveIds: face.pcurves.map(pcurve => pcurve.id), useIds: face.topology.loops.flatMap(loop => loop.uses.map(use => use.id))});
  assert.equal(report.transversality.length, parent.events.length);
  for (const [i, evidence] of report.transversality.entries()) {
    const root = parent.events[i]; assert.equal(evidence.eventId, root.eventId);
    close(evidence.normalDerivativeMM, dot(parent.report.planeAxes.unitNormal, evaluateCurveD1(curve, root.parameter).derivative), 'actual whole Curve normal derivative');
    assert.ok(Math.abs(evidence.normalDerivativeMM) > evidence.normalDerivativeGuardMM);
    assert.ok(evidence.lower.length > 0 && evidence.upper.length > 0);
    for (const side of ['lower', 'upper']) for (const observation of evidence[side]) {
      assert.ok(side === 'lower' ? observation.parameter < root.parameter : observation.parameter > root.parameter);
      assert.ok(Math.abs(observation.signedDistanceMM) > observation.guardMM);
      assert.equal(Math.sign(observation.signedDistanceMM), (side === 'lower' ? -1 : 1) * Math.sign(evidence.normalDerivativeMM));
      const original = root.sideObservations.find(row => row.parameter === observation.parameter && row.side === side); assert.ok(original);
      assert.equal(observation.signedDistanceMM, original.signedDistanceMM); assert.deepEqual(original.pointMM, evaluateCurve(curve, observation.parameter));
    }
  }
  assert.equal(report.workPolicy.rootWorkBeforeTrimAdmission, true); assert.equal(report.workPolicy.completeTrimAdmissionBeforeExtractionOrClassification, true);
  assert.deepEqual(validate(result), report);
  const saved = jsonFile(name + '.owned-result', result), coldFace = JSON.parse(readFileSync(authored.reopened.faceFile, 'utf8'));
  const coldParent = compileCadModel(readFileSync(parentFile.file, 'utf8'), {sourceVersion: 0}), coldFaceSource = compileCadModel(readFileSync(faceFile.file, 'utf8'), {sourceVersion: 0});
  assert.equal(coldParent.ok, true); assert.equal(coldFaceSource.ok, true); assert.deepEqual(coldParent.model.objects[0], authored.reopened.curve); assert.deepEqual(coldFaceSource.model, coldFace.model);
  assert.deepEqual(validateFace(coldFace), face.report); assert.deepEqual(intersect(coldParent.model.objects[0], coldFace, authored.reopened.options), saved.reopened);
  assert.deepEqual(validate(saved.reopened), report);
  accepted.push({curve, face, options, before, result, resultBefore: structuredClone(result)});
  cases.push({name, curveId: curve.id, curveDegree: curve.degree, originalPoles: curve.controlPoints.length, spanCount: parent.spans.length,
    eventCount: result.events.length, classificationCounts, contributionCount, restrictionCount, splitCount,
    parentSourceFile: parentFile.file, faceSourceFile: faceFile.file, authoredFile: authored.file, resultFile: saved.file});
  return result;
}
const lineProbe = (name, fixture, uv, direction = [1, 0, -1]) => {
  const p = fixture.chart(...uv); return bezier(name + '_curve', [p.map((x, i) => x + direction[i]), p.map((x, i) => x - direction[i])], -1, 1);
};
for (const [name, uv, classification, boundaryCount] of [
  ['material', [.25, .25], 'inside', 0], ['hole', [.5, .5], 'inside-hole', 0], ['outer', [.03125, .5], 'outside', 0],
  ['chart', [-.125, .5], 'outside-domain', 0], ['oedge', [.5, .0625], 'boundary', 1], ['ocorner', [.0625, .0625], 'boundary', 2],
  ['hedge', [.5, .375], 'boundary', 1], ['hcorner', [.375, .375], 'boundary', 2],
]) check(name, lineProbe(name, tilted, uv), tilted, [{parameter: 0, uv: tilted.actualUV(uv), classification, boundaryCount,
  holeId: name.startsWith('h') ? tilted.face.holeLoops[0].id : null}]);
check('nonunit', lineProbe('nonunit', nonunit, [.6875, .6875]), nonunit,
  [{parameter: 0, uv: nonunit.actualUV([.6875, .6875]), classification: 'inside-hole', holeId: nonunit.face.holeLoops[1].id}]);
check('maxface', lineProbe('maxface', maximumFace, [.5, .5]), maximumFace,
  [{parameter: 0, uv: [.5, .5], classification: 'inside'}]);
const quadratic = bezier('quadratic_crossings', [[0, .5, .1875], [.5, .5, -.3125], [1, .5, .1875]], 0, 1);
const quadraticResult = check('quadratic', quadratic, flat, [{parameter: .25, uv: [.25, .5], classification: 'inside'}, {parameter: .75, uv: [.75, .5], classification: 'inside'}]);
const cubic = bezier('cubic_crossing', [[0, .25, -.75], [.25, .25, -.125], [.5, .25, .125], [1, .25, .75]], -1, 1);
check('cubic', cubic, flat, [{parameter: 0, uv: [.40625, .25], classification: 'inside'}]);
const wide = {kind: 'curve', id: 'wide64_original', degree: 1, knots: [0, 0, ...Array.from({length: 62}, (_, i) => i + 1), 63, 63],
  controlPoints: Array.from({length: 64}, (_, i) => [.25, .25, i - 31.5]), weights: Array(64).fill(1)};
const wideResult = check('wide64', wide, flat, [{parameter: 31.5, uv: [.25, .25], classification: 'inside'}]);
assert.equal(wideResult.intersection.spans.length, 63); assert.equal(wideResult.events[0].brackets[0].spanIndex, 31);
assert.equal(wideResult.events[0].brackets[0].extraction.original.controlPoints.length, 2);

function intact() {
  for (const row of accepted) { assert.deepEqual({curve: row.curve, face: row.face, options: row.options}, row.before); assert.deepEqual(row.result, row.resultBefore); }
  for (const row of faces) assert.deepEqual(row.face, row.before);
  for (const [file, bytes] of retainedFiles) assert.deepEqual(readFileSync(file), bytes, file);
}
function reject(name, action, code, causeRequired = false) {
  assert.throws(action, error => {
    assert.ok(error instanceof CurvePlanarFaceMaterialError); assert.equal(error.name, 'CurvePlanarFaceMaterialError'); assert.equal(error.code, code); assert.ok(error.message.length <= 1024);
    if (causeRequired) assert.ok(error.cause instanceof Error);
    failures.push({name, code: error.code, message: error.message, causeName: error.cause?.name ?? null, causeCode: error.cause?.code ?? null, causeMessage: error.cause?.message ?? null});
    intact(); return true;
  });
}
const defaultOptions = optionsFor('refusal');
reject('trim_restriction_preflight', () => intersect(quadratic, flat.face, {...defaultOptions, maximumBracketRestrictions: 1}), 'BUDGET');
reject('trim_classification_preflight', () => intersect(quadratic, flat.face, {...defaultOptions, maximumClassifications: 1}), 'BUDGET');
reject('root_event_capacity', () => intersect(quadratic, flat.face, {...defaultOptions, pointEventIds: ['only_event']}), 'NATIVE', true);
const boundaryCrossing = bezier('crossing_trim_boundary', [[0, .5, -.375], [1, .5, .625]], 0, 1);
assert.equal(classify(flat.face, [.375, .5]).classification, 'boundary');
reject('whole_bracket_crosses_hole_boundary', () => intersect(boundaryCrossing, flat.face, defaultOptions), 'UNCERTAINTY');
const nearUV = [.5625 + 2 * Number.EPSILON, .5];
let nativeClassifierError;
try { classify(triangular.face, nearUV); } catch (error) { nativeClassifierError = error; }
assert.ok(nativeClassifierError instanceof Error);
jsonFile('native-classifier.near-boundary-reference', {uv: nearUV, message: nativeClassifierError.message,
  relationship: 'separate actual650 reference call; this error is not the production operation cause'});
reject('near_boundary_hull_refuses_before_classifier', () => intersect(lineProbe('nearuv', triangular, nearUV, [0, 0, 1]), triangular.face, defaultOptions), 'UNCERTAINTY');
const tangent = bezier('tangent_curve', [[.25, .25, 1], [.25, .25, -1], [.25, .25, 1]], 0, 1);
reject('actual_parent_tangent_refusal', () => intersect(tangent, flat.face, defaultOptions), 'NATIVE', true);
const coincident = bezier('coincident_curve', [[.2, .2, 0], [.3, .3, 0]]);
reject('coincident_support_unsupported', () => intersect(coincident, flat.face, defaultOptions), 'UNSUPPORTED');
const endpoint = bezier('endpoint_curve', [[.25, .25, 0], [.25, .25, 1]], 0, 1);
reject('full_curve_endpoint_unsupported', () => intersect(endpoint, flat.face, defaultOptions), 'UNSUPPORTED');
reject('input_prefix_bound', () => intersect(quadratic, flat.face, {...defaultOptions, resultIdPrefix: 'ninechars'}), 'INPUT');
reject('input_coordinate_bound', () => intersect({...quadratic, controlPoints: [[10001, .5, .1875], ...quadratic.controlPoints.slice(1)]}, flat.face, defaultOptions), 'INPUT');
reject('input_degree_four', () => intersect(bezier('degree_four', Array.from({length: 5}, (_, i) => [.25, .25, i - 2])), flat.face, defaultOptions), 'INPUT');
reject('actual_parent_invalid_weights', () => intersect({...quadratic, weights: [1, 0, 1]}, flat.face, defaultOptions), 'NATIVE', true);
reject('native_face_source_tamper', () => intersect(quadratic, {...flat.face, source: flat.face.source + ' '}, defaultOptions), 'NATIVE', true);
reject('curve_face_identity_collision', () => intersect({...quadratic, id: flat.face.outerLoop.edges[0].id}, flat.face, defaultOptions), 'INPUT');
let getterCalls = 0;
const getter = {...quadratic}; Object.defineProperty(getter, 'degree', {enumerable: true, get() { getterCalls++; return 2; }});
reject('input_getter', () => intersect(getter, flat.face, defaultOptions), 'INPUT');
const faceGetter = structuredClone(flat.face); Object.defineProperty(faceGetter.report, 'holeIds', {enumerable: true, get() { getterCalls++; return []; }});
reject('face_getter', () => intersect(quadratic, faceGetter, defaultOptions), 'INPUT'); assert.equal(getterCalls, 0);
for (const [name, alter] of [
  ['classification', r => { r.events[0].material = !r.events[0].material; }], ['parent_source', r => { r.intersection.source += ' '; }],
  ['bracket', r => { r.events[0].brackets[0].interval[0] += 1e-8; }], ['control_hull', r => { r.events[0].brackets[0].projectedControlHullUV[0][0] += .01; }],
  ['restriction_source', r => { r.events[0].brackets[0].extraction.source += ' '; }], ['counts', r => { r.report.bracketRestrictionCount++; }],
]) { const altered = structuredClone(quadraticResult); alter(altered); reject('owned_' + name, () => validate(altered), 'OWNED'); }
let replacement = quadraticResult; const previous = replacement;
reject('atomic_previous_result', () => { replacement = intersect(boundaryCrossing, flat.face, defaultOptions); }, 'UNCERTAINTY');
assert.strictEqual(replacement, previous); jsonFile('atomic-retention', {previousResultUnchanged: replacement === previous, getterCalls});

const packageRoot = resolve(repo, 'packages/barocss-cad'), manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')), declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath)); const publicAPI = await import(pathToFileURL(runtimePath).href);
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.CurvePlanarFaceMaterialDiagnosticCode, CurvePlanarFaceMaterialDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./curve-planar-face-material.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/nurbs/curves/curve-planar-face-material.d.ts'), leafDeclaration = readFileSync(leafDeclarationPath, 'utf8');
for (const name of [...runtimeNames, ...typeNames]) assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(leafDeclaration), name);
for (const row of cases) {
  const authored = JSON.parse(readFileSync(row.authoredFile, 'utf8')), face = JSON.parse(readFileSync(authored.faceFile, 'utf8')), saved = JSON.parse(readFileSync(row.resultFile, 'utf8'));
  const cold = publicAPI.compileCadModel(readFileSync(row.parentSourceFile, 'utf8'), {sourceVersion: 0}), coldFace = publicAPI.compileCadModel(readFileSync(row.faceSourceFile, 'utf8'), {sourceVersion: 0});
  assert.equal(cold.ok, true); assert.equal(coldFace.ok, true); assert.deepEqual(cold.model.objects[0], authored.curve); assert.deepEqual(coldFace.model, face.model);
  assert.deepEqual(publicAPI.intersectCurveWithPlanarFaceMaterial(cold.model.objects[0], face, authored.options), saved);
  assert.deepEqual(publicAPI.validateCurvePlanarFaceMaterialIntersection(saved), saved.report);
}
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 8,
  caseCount: cases.length, declarationCheck: 'actual built declarations and API consumption; no separate TypeScript invocation'};
jsonFile('compiled-consumer', compiledConsumer); intact();
const summary = {sourceMode: true, cadSourceInputCount: cadInputs.length, cases, failures, compiledConsumer, caseCount: cases.length,
  eventCount: cases.reduce((sum, row) => sum + row.eventCount, 0), refusalCount: failures.length, getterCalls,
  units: {xyz: 'mm', uv: 'original native dimensionless knot coordinates'},
  independentControls: ['normal Line probes', 'quadratic z=(t-.25)*(t-.75)', 'odd monotone cubic signed-distance controls', '64-pole native piecewise Line root31.5'],
  bracketProof: 'every positive-weight restricted control point, every contribution and every chart/loop halfspace; observations are not an enclosure',
  sourceOwnership: 'original Face, actual Curve+Plane parent and actual local interval sources remain separate Model16 documents',
  scope: 'Guarded local constructed-control-hull material classification at transverse roots; no sewn topology, Solid or global binary64 enclosure.'};
jsonFile('summary', summary); intact(); console.log(JSON.stringify(summary));
