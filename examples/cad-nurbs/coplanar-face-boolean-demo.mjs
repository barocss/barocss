import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.filter(arg => arg === '--source').length, 1,
  'Usage: node coplanar-face-boolean-demo.mjs --source [output-directory]');
const destinations = args.filter(arg => arg !== '--source');
assert.ok(destinations.length <= 1);
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const output = resolve(destinations[0] ?? '/tmp/barocss-coplanar-face-boolean-prototype');
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
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/coplanar-face-boolean.ts')));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' +
  Buffer.from(built.outputFiles[0].text).toString('base64'));
const {
  booleanCoplanarFaces: boolean, validateCoplanarFaceBoolean: validate,
  CoplanarFaceBooleanError, CoplanarFaceBooleanDiagnosticCode,
  buildConvexPlanarFace: buildFace, validateConvexPlanarFace: validateFace, classifyConvexPlanarFaceUV: classify,
  evaluateCurve, evaluateCurveD1, evaluateSurface, evaluateSurfaceD1, curveDomain, surfaceDomain,
  validateCurve, validateExtractedCurveInterval, compileCadModel,
} = api;
for (const operation of [boolean, validate, buildFace, validateFace, classify]) assert.equal(typeof operation, 'function');
assert.deepEqual(Object.keys(CoplanarFaceBooleanDiagnosticCode).sort(),
  ['INPUT', 'IDENTITY', 'SUPPORT', 'CONTACT', 'UNCERTAINTY', 'REPRESENTABILITY', 'BUDGET',
    'INCIDENCE', 'NESTING', 'NATIVE', 'BINDING', 'OWNED'].sort());

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
      assert.ok(!caller.has(value), 'Boolean result aliases caller data');
      assert.ok(!seen.has(value), 'Repeated nested output object occurrence');
      seen.add(value);
      for (const child of Object.values(value)) visit(child);
    }
  };
  visit(result);
}
const plane = {kind: 'surface', id: 'original_plane', degreeU: 1, degreeV: 1,
  knotsU: [-2, -2, 6, 6], knotsV: [3, 3, 11, 11],
  controlPoints: [[[-8, -8, -8], [-4, 0, -4]], [[0, -8, 0], [4, 0, 4]]],
  weights: [[1, 1], [1, 1]]};
const world = ([u, v], zShift = 0) => {
  const x = u + .5 * v - 7.5;
  return [x, v - 11, x + zShift];
};
const rectangle = (u0, u1, v0, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
const originals = [];
function authoredFace(name, uv, {clockwise = false, orientation = 'forward', zShift = 0} = {}) {
  const points = clockwise ? [...uv].reverse() : uv;
  const support = structuredClone(plane);
  if (zShift) support.controlPoints = support.controlPoints.map(row => row.map(point => [point[0], point[1], point[2] + zShift]));
  const loop = {id: 'original_loop', edges: points.map((point, index) => ({kind: 'curve', id: 'original_line_' + index,
    degree: 1, knots: index === 0 ? [-0, -0, 7, 7] : [-3, -3, 7, 7],
    controlPoints: [world(point, zShift), world(points[(index + 1) % points.length], zShift)], weights: [2, 2]}))};
  const inputOptions = {faceId: 'original_face', evaluationId: 'original_model', resultIdPrefix: 'input', orientation};
  const before = structuredClone({support, loop, inputOptions});
  const face = buildFace(support, loop, inputOptions);
  checkOwnership([support, loop, inputOptions], face);
  assert.deepEqual({support, loop, inputOptions}, before);
  assert.deepEqual(face.plane, support);
  assert.deepEqual(face.loop, loop);
  assert.deepEqual(validateFace(face), face.report);
  const savedSource = sourceFile(name + '.original', face.source, face.model);
  const saved = ownedFile(name + '.original-face', face);
  assert.deepEqual(validateFace(saved.reopened), face.report);
  originals.push({face, before: structuredClone(face), sourceFile: savedSource.file, resultFile: saved.file});
  return face;
}

function winding(uv, polygon) {
  let count = 0;
  for (let index = 0; index < polygon.length; index++) {
    const a = polygon[index], b = polygon[(index + 1) % polygon.length];
    const determinant = (b[0] - a[0]) * (uv[1] - a[1]) - (b[1] - a[1]) * (uv[0] - a[0]);
    if (a[1] <= uv[1] && b[1] > uv[1] && determinant > 0) count++;
    else if (a[1] > uv[1] && b[1] <= uv[1] && determinant < 0) count--;
  }
  return count;
}
function signedArea(polygon) {
  const origin = polygon[0];
  return polygon.reduce((sum, point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    return sum + ((point[0] - origin[0]) * (next[1] - origin[1]) - (point[1] - origin[1]) * (next[0] - origin[0])) / 2;
  }, 0);
}
function pointMasks(result, probes) {
  const observations = [];
  for (const uv of probes) {
    const a = classify(result.faceA, uv), b = classify(result.faceB, uv);
    assert.ok(![a.classification, b.classification].includes('boundary'), 'Use strict probe points only');
    const inA = a.classification === 'inside', inB = b.classification === 'inside';
    const expected = result.options.operation === 'union' ? inA || inB : result.options.operation === 'intersection' ? inA && inB : inA && !inB;
    const totalWinding = result.loops.reduce((sum, loop) => sum + winding(uv, loop.vertexIds.map(id => result.vertices.find(vertex => vertex.id === id).uv)), 0);
    assert.equal(totalWinding !== 0, expected);
    observations.push({uv, inA, inB, totalWinding, expected});
  }
  return observations;
}

function contributor(result, source) {
  assert.ok(source.operand === 'a' || source.operand === 'b');
  const face = source.operand === 'a' ? result.faceA : result.faceB;
  const line = face.loop.edges[source.authoredEdgeIndex];
  assert.ok(line);
  const edge = face.topology.edges.find(edge => edge.curveId === line.id);
  const use = face.topology.loop.uses.find(use => use.edgeId === edge.id);
  const pcurve = face.pcurves.find(pcurve => pcurve.curveId === line.id);
  assert.deepEqual(source, {operand: source.operand, faceId: face.options.faceId, evaluationId: face.options.evaluationId,
    supportId: face.plane.id, loopId: face.loop.id, useId: use.id, edgeId: edge.id, curveId: line.id, pcurveId: pcurve.id,
    authoredEdgeIndex: source.authoredEdgeIndex, originalUseSense: use.sense,
    authoredLoopOrientation: face.report.authoredOrientation, originalFaceSense: face.options.orientation});
  return {face, line, pcurve: pcurve.curve};
}

function checkFragments(name, result) {
  for (const [index, fragment] of result.fragments.entries()) {
    const original = contributor(result, fragment.contributor);
    assert.deepEqual(fragment.extraction.original, original.line);
    assert.deepEqual(validateExtractedCurveInterval(fragment.extraction), fragment.extraction.report);
    assert.deepEqual(fragment.curve, fragment.extraction.curve);
    assert.deepEqual(fragment.interval, curveDomain(fragment.curve));
    assert.deepEqual(fragment.interval, fragment.extraction.provenance.effectiveInterval);
    assert.deepEqual(fragment.traversalInterval, fragment.sense === 'forward' ? fragment.interval : [...fragment.interval].reverse());
    sourceFile(name + '.fragment_' + index + '.original', fragment.extraction.originalSource, fragment.extraction.originalModel);
    sourceFile(name + '.fragment_' + index + '.extracted', fragment.extraction.source, fragment.extraction.model);
    const pc = fragment.pcurve;
    assert.equal(pc.coordinateSystem, 'uv');
    assert.equal(pc.lengthUnit, 'dimensionless');
    assert.equal(pc.id, pc.curve.id);
    validateCurve(pc.curve);
    assert.deepEqual(pc.domain, fragment.interval);
    assert.deepEqual(curveDomain(pc.curve), fragment.interval);
    assert.deepEqual(pc.curve.knots, [fragment.interval[0], fragment.interval[0], fragment.interval[1], fragment.interval[1]]);
    assert.deepEqual(pc.curve.weights, original.pcurve.weights);
    assert.deepEqual(pc.curve.controlPoints, fragment.interval.map(parameter => evaluateCurve(original.pcurve, parameter)));
    assert.equal(fragment.observations.length, 3);
    assert.deepEqual(fragment.observations.map(observation => observation.parameter),
      [fragment.interval[0], fragment.interval[0] + (fragment.interval[1] - fragment.interval[0]) / 2, fragment.interval[1]]);
    for (const observation of fragment.observations) {
      const t = observation.parameter;
      const lineD1 = evaluateCurveD1(original.line, t), curveD1 = evaluateCurveD1(fragment.curve, t);
      const uv = evaluateCurve(pc.curve, t), pcurveD1 = evaluateCurveD1(pc.curve, t);
      const surfaceD1 = evaluateSurfaceD1(result.support, uv[0], uv[1]);
      assert.deepEqual(observation.originalPointMM, evaluateCurve(original.line, t));
      assert.deepEqual(observation.pointMM, evaluateCurve(fragment.curve, t));
      assert.deepEqual(observation.uv, uv);
      assert.deepEqual(observation.planePointMM, evaluateSurface(result.support, uv[0], uv[1]));
      assert.deepEqual(observation.originalD1, lineD1);
      assert.deepEqual(observation.curveD1, curveD1);
      assert.deepEqual(observation.pcurveD1, pcurveD1);
      assert.deepEqual(observation.surfaceD1, surfaceD1);
      assert.equal(observation.pointDifferenceMM, difference(observation.originalPointMM, observation.pointMM));
      assert.equal(observation.surfaceDifferenceMM, difference(observation.pointMM, observation.planePointMM));
      assert.ok(observation.pointDifferenceMM <= 1e-7 && observation.surfaceDifferenceMM <= 1e-7);
      const chain = surfaceD1.du.map((du, axis) => du * pcurveD1.derivative[0] + surfaceD1.dv[axis] * pcurveD1.derivative[1]);
      assert.ok(difference(lineD1.derivative, curveD1.derivative) <= 1e-7 * Math.max(1, Math.hypot(...lineD1.derivative)));
      assert.ok(difference(curveD1.derivative, chain) <= 1e-7 * Math.max(1, Math.hypot(...curveD1.derivative)));
      assert.ok(observation.relativeD1Difference <= 1e-7 && observation.relativeSurfaceD1Difference <= 1e-7);
    }
    assert.equal(fragment.endpointBindings.length, 2);
    for (const [endpoint, binding] of fragment.endpointBindings.entries()) {
      assert.equal(binding.vertexId, fragment.vertexIds[endpoint]);
      assert.ok(Object.is(binding.parameter, fragment.traversalInterval[endpoint]));
      const vertex = result.vertices.find(vertex => vertex.id === binding.vertexId);
      assert.ok(vertex);
      assert.deepEqual(binding.pointMM, evaluateCurve(fragment.curve, binding.parameter));
      assert.deepEqual(binding.uv, evaluateCurve(pc.curve, binding.parameter));
      assert.equal(binding.vertexDifferenceMM, difference(binding.pointMM, vertex.pointMM));
      assert.equal(binding.uvDifference, difference(binding.uv, vertex.uv));
      // The dimensionless UV check is local to this fixture, separate from the world-point policy.
      assert.ok(binding.vertexDifferenceMM <= 1e-7 && binding.uvDifference <= 1e-7);
    }
  }
}

function checkIncidence(result) {
  const inCount = new Map(), outCount = new Map(), usedFragments = new Set();
  let areaUV = 0;
  for (const loop of result.loops) {
    assert.equal(loop.faceSense, 'forward');
    assert.equal(loop.orientation, loop.role === 'outer' ? 'ccw' : 'cw');
    assert.equal(loop.uses.length, loop.vertexIds.length);
    assert.equal(loop.uses.length, loop.fragmentIds.length);
    const polygon = loop.vertexIds.map(id => result.vertices.find(vertex => vertex.id === id).uv);
    const area = signedArea(polygon);
    assert.ok(Math.abs(area - loop.signedAreaUV) <= 1e-7);
    assert.ok(loop.role === 'outer' ? area > 0 : area < 0);
    areaUV += area;
    for (const [index, use] of loop.uses.entries()) {
      const fragment = result.fragments.find(fragment => fragment.id === loop.fragmentIds[index]);
      assert.ok(fragment && !usedFragments.has(fragment.id)); usedFragments.add(fragment.id);
      assert.deepEqual(use, {id: fragment.useId, edgeId: fragment.edgeId, curveId: fragment.curve.id,
        pcurveId: fragment.pcurve.id, vertexIds: fragment.vertexIds, interval: fragment.traversalInterval, sense: fragment.sense});
      assert.equal(use.vertexIds[0], loop.vertexIds[index]);
      assert.equal(use.vertexIds[1], loop.uses[(index + 1) % loop.uses.length].vertexIds[0]);
      outCount.set(use.vertexIds[0], (outCount.get(use.vertexIds[0]) ?? 0) + 1);
      inCount.set(use.vertexIds[1], (inCount.get(use.vertexIds[1]) ?? 0) + 1);
    }
  }
  assert.equal(usedFragments.size, result.fragments.length);
  for (const vertex of result.vertices) {
    assert.equal(inCount.get(vertex.id), 1); assert.equal(outCount.get(vertex.id), 1);
    assert.ok(vertex.contributors.length > 0);
    for (const record of vertex.contributors) {
      const original = contributor(result, record.source);
      assert.ok(record.parameter >= curveDomain(original.line)[0] && record.parameter <= curveDomain(original.line)[1]);
      if (record.kind === 'original-vertex' || record.kind === 'coincident-counterpart') {
        const nativeVertex = original.face.topology.vertices.find(vertex => vertex.id === record.originalVertexId);
        assert.ok(nativeVertex);
        assert.deepEqual(vertex.pointMM, nativeVertex.point);
      } else {
        assert.equal(record.kind, 'cross-event');
        const event = result.events.find(event => event.id === record.eventId);
        assert.ok(event && event.vertexId === vertex.id);
      }
    }
  }
  for (const component of result.components) {
    assert.equal(component.supportId, result.support.id);
    const outer = result.loops.find(loop => loop.id === component.outerLoopId);
    assert.ok(outer && outer.role === 'outer' && outer.componentId === component.id);
    const holes = component.holeLoopIds.map(id => result.loops.find(loop => loop.id === id));
    assert.ok(holes.every(loop => loop && loop.role === 'hole' && loop.componentId === component.id));
    assert.ok(Math.abs(component.areaUV - (outer.signedAreaUV + holes.reduce((sum, loop) => sum + loop.signedAreaUV, 0))) <= 1e-7);
  }
  return areaUV;
}

function checkEvents(result) {
  for (const event of result.events) {
    assert.deepEqual(event.pointMM, evaluateSurface(result.support, event.uv[0], event.uv[1]));
    for (const operand of ['a', 'b']) {
      const side = event[operand], original = contributor(result, side.contributor), domain = curveDomain(original.line);
      assert.equal(side.contributor.operand, operand);
      assert.ok(side.fraction > 0 && side.fraction < 1);
      assert.ok(Math.abs(side.parameter - (domain[0] + (domain[1] - domain[0]) * side.fraction)) <= 1e-12);
      assert.deepEqual(side.pointMM, evaluateCurve(original.line, side.parameter));
      assert.deepEqual(side.nativeUV, evaluateCurve(original.pcurve, side.parameter));
      assert.ok(difference(side.uv, side.nativeUV) <= 1e-7);
    }
    assert.ok(event.worldDifferenceMM <= 1e-7 && event.uvDifference <= 1e-7);
  }
}

const accepted = [];
function check(name, faceA, faceB, operation, expectedAreaUV, componentCount, holeCount, probes) {
  const before = structuredClone([faceA, faceB]);
  const options = {operation, evaluationId: name + '_eval', resultIdPrefix: 'r' + accepted.length,
    maximumPairTests: 64, maximumFragments: 64};
  const result = boolean(faceA, faceB, options);
  checkOwnership([faceA, faceB, options], result);
  assert.deepEqual(Object.keys(result).sort(), ['faceA', 'faceB', 'options', 'support', 'vertices', 'events', 'fragments', 'loops', 'components', 'sources', 'report'].sort());
  assert.deepEqual([result.faceA, result.faceB], before);
  assert.deepEqual(result.options, options);
  assert.deepEqual({...result.support, id: faceA.plane.id}, faceA.plane);
  assert.deepEqual(surfaceDomain(result.support), surfaceDomain(faceA.plane));
  assert.equal(result.components.length, componentCount);
  assert.equal(result.loops.filter(loop => loop.role === 'hole').length, holeCount);
  const areaUV = checkIncidence(result);
  assert.ok(Math.abs(areaUV - expectedAreaUV) <= 1e-7);
  const masks = pointMasks(result, probes);
  checkFragments(name, result); checkEvents(result);
  const ids = [result.support.id, ...result.vertices.map(vertex => vertex.id), ...result.events.map(event => event.id),
    ...result.fragments.flatMap(fragment => [fragment.id, fragment.edgeId, fragment.useId, fragment.curve.id, fragment.pcurve.id]),
    ...result.loops.map(loop => loop.id), ...result.components.map(component => component.id), ...result.sources.map(source => source.id)];
  assert.equal(new Set(ids).size, ids.length);
  const originalIds = new Set([faceA, faceB].flatMap(face => [face.plane.id, face.loop.id, face.options.faceId, face.options.evaluationId,
    ...face.loop.edges.map(edge => edge.id), ...face.topology.vertices.map(vertex => vertex.id),
    ...face.topology.edges.map(edge => edge.id), ...face.topology.loop.uses.map(use => use.id), ...face.pcurves.map(pcurve => pcurve.id)]));
  assert.ok(ids.every(id => !originalIds.has(id)));
  const sourceFiles = [];
  for (const [index, source] of result.sources.entries()) {
    assert.equal(source.sourceVersion, 0);
    assert.equal(source.supportId, result.support.id);
    assert.equal(source.model.lengthUnit, 'mm');
    assert.ok(source.model.objects.length >= 1 && source.model.objects.length <= 16);
    assert.deepEqual(source.model.objects[0], result.support);
    const fragments = source.fragmentIds.map(id => result.fragments.find(fragment => fragment.id === id));
    assert.ok(fragments.every(Boolean));
    assert.deepEqual(source.model.objects.slice(1), fragments.map(fragment => fragment.curve));
    for (const [curveIndex, fragment] of fragments.entries()) {
      assert.deepEqual(fragment.source, {assetId: source.id, curveId: fragment.curve.id, objectIndex: curveIndex + 1});
      assert.ok(!source.model.objects.some(object => object.id === fragment.pcurve.id));
    }
    sourceFiles.push(sourceFile(name + '.world_chunk_' + index, source.source, source.model).file);
  }
  assert.equal(result.sources.reduce((count, source) => count + source.fragmentIds.length, 0), result.fragments.length);
  assert.equal(result.report.schema, 'barocss-native-coplanar-face-boolean');
  assert.equal(result.report.version, 0);
  assert.equal(result.report.lengthUnit, 'mm');
  assert.equal(result.report.uvUnits, 'dimensionless');
  assert.equal(result.report.componentCount, componentCount);
  assert.equal(result.report.holeCount, holeCount);
  assert.equal(result.report.selectedFragmentCount, result.fragments.length);
  assert.equal(result.report.vertexCount, result.vertices.length);
  assert.equal(result.report.eventCount, result.events.length);
  assert.equal(result.report.loopCount, result.loops.length);
  assert.equal(result.report.sourceCount, result.sources.length);
  assert.ok(Math.abs(result.report.areaUV - expectedAreaUV) <= 1e-7);
  assert.equal(result.report.quality.uvAreaIsManufacturingArea, false);
  assert.equal(result.report.topologyCertified, false);
  assert.equal(result.report.solid, false);
  if (!componentCount) {
    assert.deepEqual([result.vertices, result.events, result.fragments, result.loops, result.components], [[], [], [], [], []]);
    assert.equal(result.sources.length, 1);
    assert.deepEqual(result.sources[0].model.objects, [result.support]);
  }
  assert.deepEqual(validate(result), result.report);
  const stored = ownedFile(name + '.owned-region', result);
  assert.deepEqual(validate(stored.reopened), result.report);
  assert.deepEqual([faceA, faceB], before);
  accepted.push({result, before: structuredClone(result), resultFile: stored.file});
  summaries.push({name, operation, expectedAreaUV, areaUV, componentCount, holeCount,
    selectedFragments: result.fragments.length, eventCount: result.events.length, sourceFiles, resultFile: stored.file, masks});
  return result;
}

ownedFile('source-api.metafile', built.metafile);
ownedFile('source-api.inputs', {entry, mode: 'in-memory-esbuild', write: false,
  cadInputs, allInputs: sourceInputs, esbuildVersion: esbuild.version});
const crossA = authoredFace('cross_a', rectangle(0, 4, 4, 8));
const crossB = authoredFace('cross_b', rectangle(2, 5, 6, 10), {clockwise: true, orientation: 'reverse'});
assert.equal(crossB.report.authoredOrientation, 'cw');
assert.equal(crossB.report.faceSense, 'reverse');
assert.deepEqual(crossA.plane, crossB.plane);
assert.equal(crossA.options.faceId, crossB.options.faceId);
assert.deepEqual(crossA.loop.edges.map(edge => edge.id), crossB.loop.edges.map(edge => edge.id));
const crossProbes = [[.5, 5], [2.75, 7], [4.5, 9], [5.75, 10.75]];
const union = check('cross_union', crossA, crossB, 'union', 24, 1, 0, crossProbes);
check('cross_intersection', crossA, crossB, 'intersection', 4, 1, 0, crossProbes);
check('cross_difference', crossA, crossB, 'difference', 12, 1, 0, crossProbes);
const outer = authoredFace('containment_outer', rectangle(-1, 5, 4, 10));
const inner = authoredFace('containment_inner', rectangle(1, 3, 6, 8), {orientation: 'reverse'});
const containmentProbes = [[0, 5], [2, 7], [4, 9], [-1.5, 5]];
check('containment_hole', outer, inner, 'difference', 32, 1, 1, containmentProbes);
check('reverse_containment_empty', inner, outer, 'difference', 0, 0, 0, containmentProbes);
const coincident = authoredFace('coincident_reversed', rectangle(0, 4, 4, 8), {clockwise: true, orientation: 'reverse'});
for (const [operation, area, count] of [['union', 16, 1], ['intersection', 16, 1], ['difference', 0, 0]]) {
  check('coincident_' + operation, crossA, coincident, operation, area, count, 0, [[1, 5], [3, 7], [5, 9]]);
}
const stripA = authoredFace('strip_a', rectangle(0, 4, 4, 10));
const stripB = authoredFace('strip_b', rectangle(1.5, 2.5, 3.5, 10.5));
check('strip_two_components', stripA, stripB, 'difference', 18, 2, 0, [[.5, 7], [2, 7], [3.5, 7], [2, 10.25]]);
const octagon = (cx, cy) => [[cx - 1, cy - .5], [cx - .5, cy - 1], [cx + .5, cy - 1], [cx + 1, cy - .5],
  [cx + 1, cy + .5], [cx + .5, cy + 1], [cx - .5, cy + 1], [cx - 1, cy + .5]];
const octA = authoredFace('octagon_a', octagon(-.5, 5));
const octB = authoredFace('octagon_b', octagon(3.5, 5));
const chunked = check('octagons_two_chunks', octA, octB, 'union', 7, 2, 0, [[-.5, 5], [3.5, 5], [1.5, 5]]);
assert.equal(chunked.fragments.length, 16);
assert.equal(chunked.sources.length, 2);
const editedA = authoredFace('authored_corner_edit', [[0, 4], [4, 4], [4.5, 8], [0, 8]]);
assert.equal(editedA.options.faceId, crossA.options.faceId);
assert.deepEqual(editedA.loop.edges.map(edge => edge.id), crossA.loop.edges.map(edge => edge.id));
check('authored_corner_edited_intersection', editedA, crossB, 'intersection', 4.75, 1, 0, crossProbes);
function intact() {
  for (const {face, before} of originals) assert.deepEqual(face, before);
  for (const {result, before} of accepted) assert.deepEqual(result, before);
  for (const [file, bytes] of retainedFiles) assert.deepEqual(readFileSync(file), bytes);
}
function reject(name, action, code) {
  assert.throws(action, error => {
    assert.ok(error instanceof CoplanarFaceBooleanError);
    assert.equal(error.name, 'CoplanarFaceBooleanError');
    assert.equal(error.code, code);
    assert.ok(Object.values(CoplanarFaceBooleanDiagnosticCode).includes(error.code));
    assert.ok(error.message.startsWith('Coplanar Face Boolean: '));
    failures.push({name, code: error.code, message: error.message,
      actualCausePreserved: Object.hasOwn(error, 'cause')});
    intact();
    return true;
  });
}
const rejectionOptions = {...union.options, evaluationId: 'focused_refusal_eval', resultIdPrefix: 'refusal'};
const touching = authoredFace('touching_boundary', rectangle(4, 5, 5, 7));
reject('boundary_contact', () => boolean(crossA, touching, rejectionOptions), 'CONTACT');
const collinear = authoredFace('partial_collinear', rectangle(1, 3, 8, 10));
reject('partial_collinear_boundary', () => boolean(crossA, collinear, rejectionOptions), 'CONTACT');
const near = 2 ** -46;
const nearRoot = authoredFace('near_root', rectangle(4 - near, 5, 8 - near, 10));
reject('near_endpoint_root_uncertainty', () => boolean(crossA, nearRoot, rejectionOptions), 'UNCERTAINTY');
const foreignSupport = authoredFace('foreign_support', rectangle(2, 5, 6, 10), {zShift: .25});
reject('foreign_support_coefficients', () => boolean(crossA, foreignSupport, rejectionOptions), 'SUPPORT');
reject('pair_test_budget', () => boolean(crossA, crossB, {...rejectionOptions, maximumPairTests: 15}), 'BUDGET');
reject('fragment_budget', () => boolean(crossA, crossB, {...rejectionOptions, maximumFragments: 1}), 'BUDGET');
let getterCalls = 0;
const getter = {...rejectionOptions};
Object.defineProperty(getter, 'operation', {enumerable: true, get() { getterCalls++; return 'union'; }});
reject('options_getter', () => boolean(crossA, crossB, getter), 'INPUT');
assert.equal(getterCalls, 0);
for (const [name, alter] of [
  ['original_source', result => result.faceA.source += ' '],
  ['support_coefficient', result => result.support.controlPoints[0][0][0] += .25],
  ['event_parameter', result => result.events[0].a.parameter += .01],
  ['fragment_interval', result => result.fragments[0].interval[0] += .01],
  ['uv_pcurve', result => result.fragments[0].pcurve.curve.controlPoints[0][0] += .01],
  ['loop_incidence', result => result.loops[0].uses[0].vertexIds.reverse()],
  ['chunk_source', result => result.sources[0].source += ' '],
  ['report', result => result.report.areaUV += .25],
]) {
  const changed = structuredClone(union);
  alter(changed);
  reject('owned_' + name + '_tamper', () => validate(changed), 'OWNED');
}
assert.deepEqual(validate(union), union.report);
intact();

// Separate built package consumer: four runtime names and eight DTO names.
const packageRoot = resolve(repo, 'packages/barocss-cad');
const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
// Development exports intentionally point to TypeScript; this stage exercises the published build.
const declared = manifest.publishConfig.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const runtimeNames = ['booleanCoplanarFaces', 'validateCoplanarFaceBoolean', 'CoplanarFaceBooleanError', 'CoplanarFaceBooleanDiagnosticCode'];
const typeNames = ['CoplanarFaceBooleanOptions', 'CoplanarFaceBooleanContributor', 'CoplanarFaceBooleanEvent',
  'CoplanarFaceBooleanFragment', 'CoplanarFaceBooleanLoop', 'CoplanarFaceBooleanComponent', 'CoplanarFaceBooleanReport', 'CoplanarFaceBooleanResult'];
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.CoplanarFaceBooleanDiagnosticCode, CoplanarFaceBooleanDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./coplanar-face-boolean.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/coplanar-face-boolean.d.ts');
const declaration = readFileSync(leafDeclarationPath, 'utf8');
for (const name of [...runtimeNames, ...typeNames]) {
  assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(declaration), name);
}
const coldInputs = originals.slice(0, 2).map(saved => JSON.parse(readFileSync(saved.resultFile, 'utf8')));
const compiled = publicAPI.booleanCoplanarFaces(coldInputs[0], coldInputs[1], union.options);
assert.deepEqual(compiled, union);
assert.deepEqual(publicAPI.validateCoplanarFaceBoolean(compiled), union.report);
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 12,
  declarationCheck: 'actual declaration export text; no separate TypeScript invocation'};
ownedFile('compiled-consumer', compiledConsumer);
ownedFile('summary', {sourceMode: true, cadSourceInputCount: cadInputs.length, summaries, failures, compiledConsumer,
  caseCount: summaries.length, refusalCount: failures.length,
  originalFiles: originals.map(saved => ({sourceFile: saved.sourceFile, resultFile: saved.resultFile})),
  scope: 'Actual equal-weight native Lines on one exact tilted affine support. All selected cycles and holes are retained, with qualified original identities and original native parameters. Extracted world Curves retain their own coefficients; local endpoint residuals are explicit. Source0 chunks contain world geometry only, with unchanged 16-object capacity. UV areas and point masks are local dimensionless observations. No snapping, close-coordinate merge, sewing, manufacturing area, certified topology, solid, general curved Boolean, renderer, or old campaign.'});
intact();
console.log(JSON.stringify({sourceMode: true, cadSourceInputCount: cadInputs.length, summaries, failures, compiledConsumer}));
