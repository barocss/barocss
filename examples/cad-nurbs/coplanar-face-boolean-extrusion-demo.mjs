import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 4,
  'Usage: node coplanar-face-boolean-extrusion-demo.mjs --source <output-directory> --boolean-directory <saved-boolean-directory>');
assert.equal(args[0], '--source');
assert.equal(args[2], '--boolean-directory');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const output = resolve(args[1]);
const booleanDirectory = resolve(args[3]);
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
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/planar-solids/coplanar-face-boolean-extrusion.ts')));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' +
  Buffer.from(built.outputFiles[0].text).toString('base64'));
const {
  extrudeCoplanarFaceBoolean: extrude, validateCoplanarFaceBooleanExtrusion: validate,
  CoplanarFaceBooleanExtrusionError, CoplanarFaceBooleanExtrusionDiagnosticCode,
  validateCoplanarFaceBoolean: validateRegion, booleanCoplanarFaces: boolean, buildConvexPlanarFace: buildFace,
  evaluateCurveD1, evaluateSurfaceD1, curveDomain, surfaceDomain, validateCurve, compileCadModel,
} = api;
for (const operation of [extrude, validate, validateRegion, boolean, buildFace]) {
  assert.equal(typeof operation, 'function');
}
assert.deepEqual(Object.keys(CoplanarFaceBooleanExtrusionDiagnosticCode).sort(),
  ['INPUT', 'IDENTITY', 'BUDGET', 'NATIVE', 'REPRESENTABILITY', 'BINDING', 'INCIDENCE', 'OWNED'].sort());
const limits = {maximumVertices: 128, maximumFaces: 80, maximumSourceChunks: 17, maximumBindingSamples: 1152};

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
      assert.ok(!caller.has(value), 'Extrusion result aliases caller data');
      assert.ok(!seen.has(value), 'Repeated nested output object occurrence');
      seen.add(value);
      for (const child of Object.values(value)) visit(child);
    }
  };
  visit(result);
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = vector => { const length = Math.hypot(...vector); return vector.map(value => value / length); };
const translated = (point, offset) => point.map((value, axis) => value + offset[axis]);
const nativeInputs = [], accepted = [];
function sourcePointer(result, pointer, geometry) {
  const source = result.sources.find(source => source.id === pointer.assetId);
  assert.ok(source);
  assert.equal(pointer.objectId, geometry.id); assert.equal(pointer.kind, geometry.kind);
  assert.ok(Number.isInteger(pointer.objectIndex) && pointer.objectIndex >= 0 && pointer.objectIndex < source.model.objects.length);
  assert.deepEqual(source.model.objects[pointer.objectIndex], geometry);
}
function edgeGeometry(result) {
  for (const edge of result.edges) {
    sourcePointer(result, edge.source, edge.curve);
    validateCurve(edge.curve);
    if (edge.kind === 'vertical') {
      const original = result.region.vertices.find(vertex => vertex.id === edge.nativeVertexId);
      assert.ok(original); assert.equal(edge.nativeFragmentId, null);
      assert.deepEqual(curveDomain(edge.curve), [0, 1]);
      assert.deepEqual(edge.curve.controlPoints, [original.pointMM, translated(original.pointMM, result.translationMM)]);
      assert.equal(edge.curve.degree, 1); assert.equal(edge.curve.weights[0], edge.curve.weights[1]);
    } else {
      const fragment = result.region.fragments.find(fragment => fragment.id === edge.nativeFragmentId);
      assert.ok(fragment); assert.equal(edge.nativeVertexId, null);
      const expected = structuredClone(fragment.curve); expected.id = edge.curve.id;
      if (edge.kind === 'top') expected.controlPoints = expected.controlPoints.map(point => translated(point, result.translationMM));
      else assert.equal(edge.kind, 'bottom');
      assert.deepEqual(edge.curve, expected);
      assert.deepEqual(curveDomain(edge.curve), fragment.interval);
    }
  }
}
function faceGeometry(name, result) {
  const allUses = [];
  for (const [faceIndex, face] of result.faces.entries()) {
    sourcePointer(result, face.source, face.surface);
    const component = result.region.components.find(component => component.id === face.componentId);
    assert.ok(component);
    if (face.kind === 'wall') {
      const fragment = result.region.fragments.find(fragment => fragment.id === face.nativeFragmentId);
      const bottom = result.edges.find(edge => edge.kind === 'bottom' && edge.nativeFragmentId === fragment.id);
      const top = result.edges.find(edge => edge.kind === 'top' && edge.nativeFragmentId === fragment.id);
      assert.equal(face.orientation, fragment.sense);
      assert.ok(face.ruledConstruction);
      assert.deepEqual(face.ruledConstruction.first, bottom.curve);
      assert.deepEqual(face.ruledConstruction.second, top.curve);
      assert.deepEqual(face.ruledConstruction.surface, face.surface);
      assert.deepEqual(face.surface, {kind: 'surface', id: face.surface.id, degreeU: bottom.curve.degree, degreeV: 1,
        knotsU: bottom.curve.knots, knotsV: [0, 0, 1, 1],
        controlPoints: bottom.curve.controlPoints.map((point, index) => [point, top.curve.controlPoints[index]]),
        weights: bottom.curve.weights.map((weight, index) => [weight, top.curve.weights[index]])});
      sourceFile(name + '.wall_' + faceIndex + '.ruled', face.ruledConstruction.source, face.ruledConstruction.model);
      assert.deepEqual(surfaceDomain(face.surface), {u: fragment.interval, v: [0, 1]});
      assert.equal(face.loops.length, 1); assert.equal(face.loops[0].uses.length, 4);
      const domain = fragment.interval, middle = domain[0] + (domain[1] - domain[0]) / 2;
      for (const v of [0, .5, 1]) {
        const native = evaluateSurfaceD1(face.surface, middle, v), source = evaluateCurveD1(fragment.curve, middle);
        assert.ok(difference(native.point, translated(source.point, result.translationMM.map(value => value * v))) <= 1e-7);
        assert.ok(difference(native.du, source.derivative) <= 1e-7 * Math.max(1, Math.hypot(...source.derivative)));
        assert.ok(difference(native.dv, result.translationMM) <= 1e-7);
      }
    } else {
      assert.ok(face.kind === 'bottom-cap' || face.kind === 'top-cap');
      assert.equal(face.orientation, face.kind === 'bottom-cap' ? 'reverse' : 'forward');
      assert.equal(face.nativeFragmentId, null); assert.equal(face.ruledConstruction, null);
      const expected = structuredClone(result.region.support); expected.id = face.surface.id;
      if (face.kind === 'top-cap') expected.controlPoints = expected.controlPoints.map(row => row.map(point => translated(point, result.translationMM)));
      assert.deepEqual(face.surface, expected);
      assert.deepEqual(face.loops.map(loop => loop.nativeLoopId), [component.outerLoopId, ...component.holeLoopIds]);
      for (const loop of face.loops) {
        const nativeLoop = result.region.loops.find(nativeLoop => nativeLoop.id === loop.nativeLoopId);
        assert.equal(loop.role, nativeLoop.role); assert.equal(loop.nativeLoopRole, nativeLoop.role);
        assert.equal(loop.uses.length, nativeLoop.uses.length);
        assert.deepEqual(loop.uses.map(use => use.nativeUseId), nativeLoop.uses.map(use => use.id));
      }
    }
    const observation = face.normalObservation;
    assert.equal(observation.materialInteriorClaim, false);
    assert.deepEqual(observation.surfaceD1, evaluateSurfaceD1(face.surface, observation.u, observation.v));
    const actual = unit(cross(observation.surfaceD1.du, observation.surfaceD1.dv)).map(value => value * (face.orientation === 'forward' ? 1 : -1));
    assert.deepEqual(observation.orientedNormal, actual);
    let intended;
    if (face.kind === 'wall') {
      assert.equal(observation.witness, 'native-wall-parameter-center');
      const fragment = result.region.fragments.find(fragment => fragment.id === face.nativeFragmentId);
      const tangent = evaluateCurveD1(fragment.curve, observation.u).derivative.map(value => value * (fragment.sense === 'forward' ? 1 : -1));
      intended = unit(cross(tangent, result.normal));
    } else {
      assert.equal(observation.witness, 'native-selected-boundary-uv');
      const loop = result.region.loops.find(loop => loop.id === component.outerLoopId);
      const witness = result.region.vertices.find(vertex => vertex.id === loop.vertexIds[0]);
      assert.ok(Object.is(witness.uv[0], observation.u) && Object.is(witness.uv[1], observation.v));
      intended = result.normal.map(value => value * (face.kind === 'bottom-cap' ? -1 : 1));
    }
    assert.ok(difference(actual, intended) <= 1e-7);
    assert.ok(observation.normalDot > 0 && observation.normalDifference <= 1e-7);
    for (const loop of face.loops) {
      assert.deepEqual(loop.effectiveUseIds, face.orientation === 'forward' ? loop.uses.map(use => use.id) : loop.uses.map(use => use.id).reverse());
      for (const [index, use] of loop.uses.entries()) {
        allUses.push(use);
        const edge = result.edges.find(edge => edge.id === use.edgeId);
        assert.ok(edge); assert.equal(use.curveId, edge.curve.id); assert.equal(use.faceId, face.id); assert.equal(use.loopId, loop.id);
        assert.deepEqual(use.source, edge.source);
        const domain = curveDomain(edge.curve), forward = use.edgeSense === 'forward';
        assert.deepEqual(use.interval, forward ? domain : [...domain].reverse());
        assert.deepEqual(use.vertexIds, forward ? edge.vertexIds : [...edge.vertexIds].reverse());
        assert.equal(use.vertexIds[1], loop.uses[(index + 1) % loop.uses.length].vertexIds[0]);
        assert.equal(use.faceOrientation, face.orientation);
        const effectiveForward = forward === (face.orientation === 'forward');
        assert.equal(use.effectiveSense, effectiveForward ? 'forward' : 'reverse');
        assert.deepEqual(use.effectiveVertexIds, effectiveForward ? edge.vertexIds : [...edge.vertexIds].reverse());
        assert.deepEqual(use.effectiveInterval, effectiveForward ? domain : [...domain].reverse());
        assert.equal(use.pcurve.coordinateSystem, 'uv'); assert.equal(use.pcurve.lengthUnit, 'dimensionless');
        assert.equal(use.pcurve.id, use.pcurve.curve.id); validateCurve(use.pcurve.curve);
        assert.deepEqual(curveDomain(use.pcurve.curve), domain); assert.deepEqual(use.pcurve.domain, domain);
        if (face.kind === 'wall') {
          assert.deepEqual(use.pcurve.curve.weights, [1, 1]);
          assert.deepEqual(use.pcurve.parameterRoles, {u: 'original-fragment-parameter', v: 'extrusion-interpolation'});
        } else {
          const nativeFragment = result.region.fragments.find(fragment => fragment.id === use.nativeFragmentId);
          assert.ok(nativeFragment); assert.deepEqual(use.contributor, nativeFragment.contributor);
          assert.deepEqual({...use.pcurve.curve, id: nativeFragment.pcurve.curve.id}, nativeFragment.pcurve.curve);
          assert.deepEqual(use.pcurve.parameterRoles, {u: 'original-support-u', v: 'original-support-v'});
        }
        assert.equal(use.observations.length, 3);
        assert.deepEqual(use.observations.map(sample => sample.parameter), [use.interval[0], domain[0] + (domain[1] - domain[0]) / 2, use.interval[1]]);
        for (const sample of use.observations) {
          const curveD1 = evaluateCurveD1(edge.curve, sample.parameter), pcurveD1 = evaluateCurveD1(use.pcurve.curve, sample.parameter);
          const surfaceD1 = evaluateSurfaceD1(face.surface, pcurveD1.point[0], pcurveD1.point[1]);
          assert.deepEqual(sample.curveD1, curveD1); assert.deepEqual(sample.pcurveD1, pcurveD1); assert.deepEqual(sample.surfaceD1, surfaceD1);
          assert.ok(difference(curveD1.point, surfaceD1.point) <= 1e-7);
          const chain = surfaceD1.du.map((value, axis) => value * pcurveD1.derivative[0] + surfaceD1.dv[axis] * pcurveD1.derivative[1]);
          assert.ok(difference(curveD1.derivative, chain) <= 1e-7 * Math.max(1, Math.hypot(...curveD1.derivative)));
          assert.ok(sample.pointDifferenceMM <= 1e-7 && sample.relativeTangentDifference <= 1e-7);
          if (sample.endpointVertexId !== null) {
            const vertex = result.vertices.find(vertex => vertex.id === sample.endpointVertexId);
            assert.ok(vertex); assert.ok(difference(vertex.pointMM, curveD1.point) <= 1e-7); assert.ok(sample.endpointDifferenceMM <= 1e-7);
          } else assert.equal(sample.endpointDifferenceMM, null);
        }
      }
    }
  }
  return allUses;
}

function check(name, region, distanceMM) {
  const before = structuredClone(region), options = {evaluationId: name + '_extrusion_eval', resultIdPrefix: 'ext' + accepted.length, distanceMM, ...limits};
  const result = extrude(region, options); checkOwnership([region, options], result);
  assert.deepEqual(Object.keys(result).sort(), ['region', 'options', 'normal', 'translationMM', 'vertices', 'edges', 'faces', 'shells', 'sources', 'report'].sort());
  assert.deepEqual(result.region, region); assert.deepEqual(result.options, options);
  const n = region.vertices.length, c = region.components.length, h = region.loops.filter(loop => loop.role === 'hole').length;
  assert.equal(result.vertices.length, 2 * n); assert.equal(result.edges.length, 3 * n);
  assert.equal(result.faces.length, n + 2 * c); assert.equal(result.shells.length, c);
  if (!n) {
    assert.equal(result.normal, null); assert.equal(result.translationMM, null);
    assert.deepEqual([result.vertices, result.edges, result.faces, result.shells, result.sources], [[], [], [], [], []]);
    assert.equal(result.report.boundsMM, null); assert.equal(result.report.bindingSampleCount, 0);
    assert.equal(result.report.curveD1EvaluationCount, 0); assert.equal(result.report.surfaceD1EvaluationCount, 0);
  } else {
    assert.ok(difference(result.normal, [-1 / Math.SQRT2, 0, 1 / Math.SQRT2]) <= 1e-7);
    assert.deepEqual(result.translationMM, result.normal.map(value => value * distanceMM));
    for (const vertex of result.vertices) {
      const original = region.vertices.find(original => original.id === vertex.nativeVertexId);
      assert.ok(original); assert.deepEqual(vertex.originalPointMM, original.pointMM);
      assert.deepEqual(vertex.pointMM, vertex.layer === 'bottom' ? original.pointMM : translated(original.pointMM, result.translationMM));
      assert.ok(vertex.layer === 'bottom' || vertex.layer === 'top');
      assert.ok(region.components.some(component => component.id === vertex.componentId));
    }
    edgeGeometry(result);
    const uses = faceGeometry(name, result);
    assert.equal(uses.length, 6 * n);
    for (const edge of result.edges) {
      const actual = uses.filter(use => use.edgeId === edge.id);
      assert.equal(actual.length, 2); assert.equal(edge.uses.length, 2);
      assert.deepEqual(edge.uses, actual.map(use => ({useId: use.id, faceId: use.faceId, loopId: use.loopId, effectiveSense: use.effectiveSense})));
      assert.notEqual(actual[0].effectiveSense, actual[1].effectiveSense);
      assert.deepEqual(actual[0].effectiveVertexIds, [...actual[1].effectiveVertexIds].reverse());
      assert.deepEqual(actual[0].effectiveInterval, [...actual[1].effectiveInterval].reverse());
    }
    for (const shell of result.shells) {
      const component = region.components.find(component => component.id === shell.componentId);
      assert.ok(component); assert.deepEqual(shell.holeLoopIds, component.holeLoopIds);
      const nativeVertices = region.vertices.filter(vertex => region.loops.find(loop => loop.componentId === component.id && loop.vertexIds.includes(vertex.id)));
      const count = nativeVertices.length;
      assert.equal(shell.vertexCount, 2 * count); assert.equal(shell.edgeCount, 3 * count); assert.equal(shell.faceCount, count + 2);
      assert.equal(shell.capWeightedContribution, 2 * (1 - component.holeLoopIds.length));
      assert.equal(shell.weightedEuler, shell.vertexCount - shell.edgeCount + count + shell.capWeightedContribution);
      assert.equal(shell.expectedWeightedEuler, 2 - 2 * component.holeLoopIds.length);
      assert.equal(shell.weightedEuler, shell.expectedWeightedEuler); assert.equal(shell.pairedEdgeIncidence, true); assert.equal(shell.solid, false);
      assert.equal(shell.faceIds.length, shell.faceCount); assert.equal(shell.edgeIds.length, shell.edgeCount); assert.equal(shell.vertexIds.length, shell.vertexCount);
      assert.ok(shell.faceIds.every(id => result.faces.some(face => face.id === id && face.componentId === component.id)));
      assert.ok(shell.edgeIds.every(id => result.edges.some(edge => edge.id === id && edge.componentId === component.id)));
      assert.ok(shell.vertexIds.every(id => result.vertices.some(vertex => vertex.id === id && vertex.componentId === component.id)));
    }
  }
  const geometry = new Map();
  for (const edge of result.edges) geometry.set(edge.curve.id, edge.curve);
  for (const face of result.faces) {
    if (geometry.has(face.surface.id)) assert.deepEqual(geometry.get(face.surface.id), face.surface);
    else geometry.set(face.surface.id, face.surface);
  }
  assert.equal(geometry.size, n ? 2 + 4 * n : 0);
  const sourceFiles = [];
  for (const [index, source] of result.sources.entries()) {
    assert.equal(source.sourceVersion, 0); assert.equal(source.model.lengthUnit, 'mm');
    assert.ok(source.model.objects.length >= 1 && source.model.objects.length <= 16);
    assert.deepEqual(source.objectIds, source.model.objects.map(object => object.id));
    assert.ok(source.model.objects.every(object => geometry.has(object.id)));
    for (const object of source.model.objects) assert.deepEqual(object, geometry.get(object.id));
    sourceFiles.push(sourceFile(name + '.world_chunk_' + index, source.source, source.model).file);
  }
  assert.equal(result.sources.reduce((sum, source) => sum + source.model.objects.length, 0), geometry.size);
  assert.equal(result.sources.length, Math.ceil(geometry.size / 16));
  if (n) {
    const ordered = [result.faces.find(face => face.kind === 'bottom-cap').surface,
      result.faces.find(face => face.kind === 'top-cap').surface,
      ...['bottom', 'top', 'vertical'].flatMap(kind => result.edges.filter(edge => edge.kind === kind).map(edge => edge.curve)),
      ...result.faces.filter(face => face.kind === 'wall').map(face => face.surface)];
    assert.deepEqual(result.sources.flatMap(source => source.model.objects), ordered);
  }
  const pcurveIds = new Set(result.faces.flatMap(face => face.loops.flatMap(loop => loop.uses.map(use => use.pcurve.id))));
  assert.ok(result.sources.every(source => source.model.objects.every(object => !pcurveIds.has(object.id))));
  const report = result.report;
  assert.equal(report.schema, 'barocss-native-coplanar-face-boolean-extrusion'); assert.equal(report.version, 0);
  assert.equal(report.distanceMM, distanceMM); assert.equal(report.lengthUnit, 'mm');
  assert.equal(report.sourceFrame, 'authored-xyz-no-axis-conversion'); assert.equal(report.capUVUnits, 'dimensionless');
  assert.equal(report.wallVRole, 'extrusion-interpolation'); assert.equal(report.empty, n === 0);
  assert.equal(report.nativeVertexCount, n); assert.equal(report.nativeFragmentCount, region.fragments.length);
  assert.equal(report.componentCount, c); assert.equal(report.holeCount, h);
  assert.equal(report.vertexCount, 2 * n); assert.equal(report.edgeCount, 3 * n); assert.equal(report.faceCount, n + 2 * c);
  assert.equal(report.shellCount, c); assert.equal(report.edgeUseCount, 6 * n); assert.equal(report.geometryObjectCount, geometry.size);
  assert.equal(report.sourceChunkCount, result.sources.length); assert.equal(report.ruledConstructionCount, n);
  assert.equal(report.bindingSampleCount, 18 * n); assert.equal(report.bindingCurveD1EvaluationCount, 36 * n);
  assert.equal(report.bindingSurfaceD1EvaluationCount, 18 * n);
  assert.equal(report.normalCurveD1EvaluationCount, n);
  assert.equal(report.normalSurfaceD1EvaluationCount, n ? 1 + result.faces.length : 0);
  assert.equal(report.curveD1EvaluationCount, report.bindingCurveD1EvaluationCount + report.normalCurveD1EvaluationCount);
  assert.equal(report.surfaceD1EvaluationCount, report.bindingSurfaceD1EvaluationCount + report.normalSurfaceD1EvaluationCount);
  assert.equal(report.quality.originalRegionBitsPreserved, true); assert.equal(report.quality.exactSewingCertified, false);
  assert.equal(report.solid, false); assert.equal(report.topologyCertified, false);
  if (n) {
    const points = result.vertices.map(vertex => vertex.pointMM);
    assert.deepEqual(report.boundsMM, {min: [0, 1, 2].map(axis => Math.min(...points.map(point => point[axis]))),
      max: [0, 1, 2].map(axis => Math.max(...points.map(point => point[axis])))});
  }
  assert.deepEqual(validate(result), report);
  const stored = ownedFile(name + '.owned-extrusion', result);
  assert.deepEqual(validate(stored.reopened), report); assert.deepEqual(region, before);
  accepted.push({result, before: structuredClone(result), file: stored.file});
  summaries.push({name, distanceMM, nativeVertices: n, vertexCount: result.vertices.length, edgeCount: result.edges.length,
    faceCount: result.faces.length, shellCount: c, holes: h, sourceChunkCount: result.sources.length,
    bindingSamples: report.bindingSampleCount, resultFile: stored.file, sourceFiles});
  return result;
}
ownedFile('source-api.metafile', built.metafile);
ownedFile('source-api.inputs', {entry, mode: 'in-memory-esbuild', write: false,
  cadInputs, allInputs: sourceInputs, esbuildVersion: esbuild.version});
const inputProvenance = [], outputs = new Map();
for (const name of ['cross_union', 'containment_hole', 'strip_two_components', 'octagons_two_chunks', 'reverse_containment_empty']) {
  const file = resolve(booleanDirectory, name + '.owned-region.json'), bytes = readFileSync(file);
  retainedFiles.set(file, bytes);
  const region = JSON.parse(bytes.toString('utf8'));
  assert.deepEqual(validateRegion(region), region.report);
  nativeInputs.push({region, before: structuredClone(region)});
  inputProvenance.push({name, file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')});
  for (const [index, source] of region.sources.entries()) {
    const originalFile = resolve(booleanDirectory, name + '.world_chunk_' + index + '.source0.css');
    const originalBytes = readFileSync(originalFile);
    assert.equal(originalBytes.toString('utf8'), source.source); retainedFiles.set(originalFile, originalBytes);
    inputProvenance.push({name: name + '.source_' + index, file: originalFile, bytes: originalBytes.length,
      sha256: createHash('sha256').update(originalBytes).digest('hex')});
    sourceFile(name + '.parent_world_chunk_' + index, source.source, source.model);
  }
  for (const [operand, face] of [['a', region.faceA], ['b', region.faceB]]) sourceFile(name + '.original_' + operand, face.source, face.model);
  outputs.set(name, check(name, region, 2));
}
ownedFile('authentic-inputs', inputProvenance);
const union = outputs.get('cross_union');
const distanceEdit = check('cross_union_distance_edit', union.region, 3);
assert.deepEqual(distanceEdit.region, union.region);
assert.deepEqual(distanceEdit.vertices.filter(vertex => vertex.layer === 'bottom').map(vertex => vertex.pointMM),
  union.vertices.filter(vertex => vertex.layer === 'bottom').map(vertex => vertex.pointMM));
assert.notDeepEqual(distanceEdit.vertices.filter(vertex => vertex.layer === 'top').map(vertex => vertex.pointMM),
  union.vertices.filter(vertex => vertex.layer === 'top').map(vertex => vertex.pointMM));

// One valid native parent exposes the translated coefficient bound without changing the authentic input.
const shiftedFaces = [union.region.faceA, union.region.faceB].map((face, index) => {
  const plane = structuredClone(face.plane), loop = structuredClone(face.loop);
  plane.controlPoints = plane.controlPoints.map(row => row.map(point => translated(point, [0, 0, 9990])));
  for (const line of loop.edges) line.controlPoints = line.controlPoints.map(point => translated(point, [0, 0, 9990]));
  const shifted = buildFace(plane, loop, face.options);
  sourceFile('coefficient_guard.original_' + index, shifted.source, shifted.model);
  return shifted;
});
const coefficientParent = boolean(shiftedFaces[0], shiftedFaces[1], {operation: 'union', evaluationId: 'coefficient_guard_eval',
  resultIdPrefix: 'coeff_guard', maximumPairTests: 64, maximumFragments: 64});
assert.deepEqual(validateRegion(coefficientParent), coefficientParent.report);
for (const [index, source] of coefficientParent.sources.entries()) sourceFile('coefficient_guard.world_chunk_' + index, source.source, source.model);
const coefficientStored = ownedFile('coefficient_guard.owned-region', coefficientParent);
assert.deepEqual(validateRegion(coefficientStored.reopened), coefficientParent.report);

function intact() {
  for (const {region, before} of nativeInputs) assert.deepEqual(region, before);
  for (const {result, before} of accepted) assert.deepEqual(result, before);
  for (const [file, bytes] of retainedFiles) assert.deepEqual(readFileSync(file), bytes);
}
function reject(name, action, code) {
  assert.throws(action, error => {
    assert.ok(error instanceof CoplanarFaceBooleanExtrusionError);
    assert.equal(error.name, 'CoplanarFaceBooleanExtrusionError'); assert.equal(error.code, code);
    assert.ok(Object.values(CoplanarFaceBooleanExtrusionDiagnosticCode).includes(error.code));
    assert.ok(error.message.startsWith('Coplanar Face Boolean Extrusion: '));
    failures.push({name, code: error.code, message: error.message, actualCausePreserved: Object.hasOwn(error, 'cause')});
    intact(); return true;
  });
}
const rejectionOptions = {...union.options, evaluationId: 'extrusion_refusal_eval', resultIdPrefix: 'refuse'};
for (const [name, distanceMM] of [['zero_distance', 0], ['negative_distance', -2], ['too_small_distance', .00001],
  ['too_large_distance', 10001], ['nonfinite_distance', Infinity]]) {
  reject(name, () => extrude(union.region, {...rejectionOptions, distanceMM}), 'INPUT');
}
reject('actual_translated_coefficient_bound', () => extrude(coefficientStored.reopened,
  {...rejectionOptions, distanceMM: 100}), 'REPRESENTABILITY');
reject('native_support_identity_collision', () => extrude(union.region,
  {...rejectionOptions, evaluationId: union.region.support.id}), 'IDENTITY');
for (const [name, field] of [['vertex_budget', 'maximumVertices'], ['face_budget', 'maximumFaces'],
  ['source_budget', 'maximumSourceChunks'], ['binding_budget', 'maximumBindingSamples']]) {
  reject(name, () => extrude(union.region, {...rejectionOptions, [field]: 0}), 'BUDGET');
}
let getterCalls = 0;
const getter = {...rejectionOptions};
Object.defineProperty(getter, 'distanceMM', {enumerable: true, get() { getterCalls++; return 2; }});
reject('options_getter', () => extrude(union.region, getter), 'INPUT'); assert.equal(getterCalls, 0);
const ownedGetter = structuredClone(union);
Object.defineProperty(ownedGetter, 'translationMM', {enumerable: true,
  get() { getterCalls++; return union.translationMM; }});
reject('owned_getter', () => validate(ownedGetter), 'OWNED'); assert.equal(getterCalls, 0);
const badParent = structuredClone(union.region); badParent.sources[0].source += ' ';
reject('altered_parent_source', () => extrude(badParent, rejectionOptions), 'INPUT');
const holeResult = outputs.get('containment_hole');
for (const [name, base, alter] of [
  ['coefficient', union, result => result.faces[0].surface.controlPoints[0][0][0] += .25],
  ['source', union, result => result.sources[0].source += ' '],
  ['pcurve', union, result => result.faces[0].loops[0].uses[0].pcurve.curve.controlPoints[0][0] += .25],
  ['effective_sense', union, result => {
    const use = result.faces[0].loops[0].uses[0];
    use.effectiveSense = use.effectiveSense === 'forward' ? 'reverse' : 'forward';
  }],
  ['hole_role', holeResult, result => result.faces.find(face => face.kind === 'bottom-cap').loops.find(loop => loop.role === 'hole').role = 'outer'],
  ['shell', union, result => result.shells[0].weightedEuler++],
  ['work_report', union, result => result.report.bindingSampleCount++],
]) {
  const changed = structuredClone(base); alter(changed);
  reject('owned_' + name + '_tamper', () => validate(changed), 'OWNED');
}
assert.deepEqual(validate(union), union.report); intact();

const packageRoot = resolve(repo, 'packages/barocss-cad');
const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')), declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const runtimeNames = ['extrudeCoplanarFaceBoolean', 'validateCoplanarFaceBooleanExtrusion', 'CoplanarFaceBooleanExtrusionError', 'CoplanarFaceBooleanExtrusionDiagnosticCode'];
const typeNames = ['CoplanarFaceBooleanExtrusionOptions', 'CoplanarFaceBooleanExtrusionVertex', 'CoplanarFaceBooleanExtrusionEdgeUse',
  'CoplanarFaceBooleanExtrusionFace', 'CoplanarFaceBooleanExtrusionShell', 'CoplanarFaceBooleanExtrusionReport', 'CoplanarFaceBooleanExtrusionResult'];
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.CoplanarFaceBooleanExtrusionDiagnosticCode, CoplanarFaceBooleanExtrusionDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./planar-solids/coplanar-face-boolean-extrusion.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/planar-solids/coplanar-face-boolean-extrusion.d.ts'), declaration = readFileSync(leafDeclarationPath, 'utf8');
for (const name of [...runtimeNames, ...typeNames]) assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(declaration), name);
const coldRegion = JSON.parse(readFileSync(resolve(booleanDirectory, 'cross_union.owned-region.json'), 'utf8'));
const compiled = publicAPI.extrudeCoplanarFaceBoolean(coldRegion, union.options);
assert.deepEqual(compiled, union); assert.deepEqual(publicAPI.validateCoplanarFaceBooleanExtrusion(compiled), union.report);
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 11,
  declarationCheck: 'actual declaration export text; no separate TypeScript invocation'};
ownedFile('compiled-consumer', compiledConsumer);
ownedFile('summary', {sourceMode: true, cadSourceInputCount: cadInputs.length, inputProvenance, summaries, failures, compiledConsumer,
  caseCount: summaries.length, refusalCount: failures.length, coefficientParentFile: coefficientStored.file,
  scope: 'Authentic native Boolean material extruded along the actual original tilted support normal. Component-owned trimmed caps, actual compatible ruled walls, unchanged native Curve parameters, dimensionless sidecars, unsnapped endpoint residuals, paired effective incidence, weighted Euler and bounded world Source0 chunks are checked. One real distance edit retains prior sources and data. No mesh authority, implicit welding, full-support-rectangle cap claim, certified solid/sewing/global manifold/volume, renderer adoption, or parent campaign.'});
intact();
console.log(JSON.stringify({sourceMode: true, cadSourceInputCount: cadInputs.length, inputProvenance, summaries, failures, compiledConsumer}));
