import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 4,
  'Usage: node coplanar-face-boolean-mesh-demo.mjs --source <output-directory> --boolean-directory <saved-boolean-directory>');
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
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/coplanar-face-boolean-mesh.ts')));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' +
  Buffer.from(built.outputFiles[0].text).toString('base64'));
const {
  tessellateCoplanarFaceBoolean: tessellate, validateCoplanarFaceBooleanMesh: validate,
  CoplanarFaceBooleanMeshError, CoplanarFaceBooleanMeshDiagnosticCode,
  booleanCoplanarFaces: boolean, validateCoplanarFaceBoolean: validateRegion, buildConvexPlanarFace: buildFace,
  buildConvexPlanarFaceWithHoles: buildOldFace, tessellateConvexPlanarFaceWithHoles: tessellateOld,
  validateConvexPlanarFaceWithHolesMesh: validateOldMesh,
  evaluateCurveD1, evaluateSurfaceD1, compileCadModel,
} = api;
for (const operation of [tessellate, validate, validateRegion, boolean, buildFace, buildOldFace, tessellateOld, validateOldMesh]) {
  assert.equal(typeof operation, 'function');
}
assert.deepEqual(Object.keys(CoplanarFaceBooleanMeshDiagnosticCode).sort(),
  ['INPUT', 'IDENTITY', 'BUDGET', 'NATIVE', 'REPRESENTABILITY', 'UNCERTAINTY', 'TRIANGULATION', 'INCIDENCE',
    'COVERAGE', 'BINDING', 'OWNED'].sort());
const options = {meshId: 'boolean_mesh', maximumVertices: 64, maximumTriangles: 80,
  maximumCandidatePairs: 2016, maximumPredicateTests: 2000000, maximumTriangleTests: 50000};

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
      assert.ok(!caller.has(value), 'Mesh result aliases caller data');
      assert.ok(!seen.has(value), 'Repeated nested output object occurrence');
      seen.add(value);
      for (const child of Object.values(value)) visit(child);
    }
  };
  visit(result);
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const delta = (a, b) => a.map((value, axis) => value - b[axis]);
const determinant = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
const edgeKey = (a, b) => Math.min(a, b) + ':' + Math.max(a, b);
const normal = native => {
  const vector = cross(native.du, native.dv), length = Math.hypot(...vector);
  return vector.map(value => value / length);
};
function winding(point, polygon) {
  let count = 0;
  for (let index = 0; index < polygon.length; index++) {
    const a = polygon[index], b = polygon[(index + 1) % polygon.length], side = determinant(a, b, point);
    if (a[1] <= point[1] && b[1] > point[1] && side > 0) count++;
    else if (a[1] > point[1] && b[1] <= point[1] && side < 0) count--;
  }
  return count;
}
function material(region, point) {
  return region.loops.reduce((sum, loop) => sum + winding(point,
    loop.vertexIds.map(id => region.vertices.find(vertex => vertex.id === id).uv)), 0) !== 0;
}
const inTriangle = (triangle, point) => triangle.every((a, index) => determinant(a, triangle[(index + 1) % 3], point) >= 0);
function separated(a, b) {
  for (const polygon of [a, b]) for (let index = 0; index < 3; index++) {
    const start = polygon[index], end = polygon[(index + 1) % 3];
    const pa = a.map(point => determinant(start, end, point)), pb = b.map(point => determinant(start, end, point));
    if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return true;
  }
  return false;
}

function indexedEvidence(mesh) {
  const incidence = new Map(), triangles = [];
  let areaUV = 0, areaMM2 = 0;
  assert.equal(mesh.indices.length % 3, 0);
  for (let offset = 0; offset < mesh.indices.length; offset += 3) {
    const indices = mesh.indices.slice(offset, offset + 3);
    assert.equal(new Set(indices).size, 3);
    assert.ok(indices.every(index => Number.isInteger(index) && index >= 0 && index < mesh.vertices.length));
    const uv = indices.map(index => mesh.parametersUV.slice(2 * index, 2 * index + 2));
    const xyz = indices.map(index => mesh.positionsMM.slice(3 * index, 3 * index + 3));
    const signedAreaUV = determinant(...uv) / 2, vector = cross(delta(xyz[1], xyz[0]), delta(xyz[2], xyz[0]));
    const physicalArea = Math.hypot(...vector) / 2;
    assert.ok(Number.isFinite(signedAreaUV) && signedAreaUV > 0);
    assert.ok(Number.isFinite(physicalArea) && physicalArea > 0);
    for (const index of indices) {
      assert.ok(vector.reduce((sum, value, axis) => sum + value * mesh.normals[3 * index + axis], 0) > 0);
    }
    areaUV += signedAreaUV; areaMM2 += physicalArea;
    const centroid = [0, 1].map(axis => (uv[0][axis] + uv[1][axis] + uv[2][axis]) / 3);
    triangles.push({indices, uv, signedAreaUV, areaMM2: physicalArea, centroid});
    for (let edge = 0; edge < 3; edge++) {
      const from = indices[edge], to = indices[(edge + 1) % 3], key = edgeKey(from, to), uses = incidence.get(key) ?? [];
      uses.push({triangleIndex: offset / 3, from, to}); incidence.set(key, uses);
    }
  }
  for (let i = 0; i < triangles.length; i++) for (let j = i + 1; j < triangles.length; j++) {
    assert.ok(separated(triangles[i].uv, triangles[j].uv), 'Triangle interiors overlap');
  }
  return {incidence, triangles, areaUV, areaMM2};
}

function boundaryEvidence(result, evidence) {
  const {region, mesh} = result, nativeIndex = new Map(mesh.vertices.map(vertex => [vertex.nativeVertexId, vertex.index]));
  const boundaries = new Map();
  for (const loop of region.loops) for (const use of loop.uses) {
    const pair = use.vertexIds.map(id => nativeIndex.get(id));
    assert.ok(pair.every(index => Number.isInteger(index)));
    const key = edgeKey(...pair);
    assert.ok(!boundaries.has(key)); boundaries.set(key, {loop, use, pair});
  }
  assert.equal(boundaries.size, result.boundaryPaths.length);
  for (const [key, uses] of evidence.incidence) {
    if (boundaries.has(key)) {
      assert.equal(uses.length, 1);
      assert.deepEqual([uses[0].from, uses[0].to], boundaries.get(key).pair);
    } else {
      assert.equal(uses.length, 2);
      assert.equal(uses[0].from, uses[1].to); assert.equal(uses[0].to, uses[1].from);
    }
  }
  for (const key of boundaries.keys()) assert.ok(evidence.incidence.has(key));
  assert.equal(evidence.incidence.size - boundaries.size, result.triangulation.internalEdges.length);
  for (const path of result.boundaryPaths) {
    const loop = region.loops.find(loop => loop.id === path.loopId);
    const fragment = region.fragments.find(fragment => fragment.id === path.fragmentId);
    assert.ok(loop && fragment);
    const use = loop.uses.find(use => use.id === path.useId);
    assert.ok(use);
    assert.equal(path.componentId, loop.componentId);
    assert.equal(path.loopRole, loop.role);
    assert.equal(path.edgeId, fragment.edgeId);
    assert.equal(path.curveId, fragment.curve.id);
    assert.equal(path.pcurveId, fragment.pcurve.id);
    assert.deepEqual(path.contributor, fragment.contributor);
    assert.deepEqual(path.source, fragment.source);
    assert.deepEqual(path.interval, fragment.traversalInterval);
    assert.deepEqual(path.nativeInterval, fragment.interval);
    assert.equal(path.sense, fragment.sense);
    assert.deepEqual(path.nativeVertexIds, fragment.vertexIds);
    assert.deepEqual(path.vertexIndices, fragment.vertexIds.map(id => nativeIndex.get(id)));
    const face = fragment.contributor.operand === 'a' ? region.faceA : region.faceB;
    const original = face.loop.edges[fragment.contributor.authoredEdgeIndex];
    assert.equal(path.samples.length, 3);
    for (const sample of path.samples) {
      const line = evaluateCurveD1(fragment.curve, sample.parameter), pc = evaluateCurveD1(fragment.pcurve.curve, sample.parameter);
      const support = evaluateSurfaceD1(region.support, pc.point[0], pc.point[1]);
      assert.deepEqual(sample.originalLineD1, evaluateCurveD1(original, sample.parameter));
      assert.deepEqual(sample.lineD1, line); assert.deepEqual(sample.pcurveD1, pc); assert.deepEqual(sample.surfaceD1, support);
      assert.ok(sample.pointDifferenceMM <= 1e-7 && sample.originalPointDifferenceMM <= 1e-7);
      assert.ok(sample.relativeD1Difference <= 1e-7 && sample.relativeSurfaceD1Difference <= 1e-7);
      assert.ok(difference(line.point, support.point) <= 1e-7);
      if (sample.meshEndpointDifferenceMM !== null) assert.ok(sample.meshEndpointDifferenceMM <= 1e-7);
    }
  }
  for (const boundary of result.triangulation.boundaryIncidence) {
    const entry = boundaries.get(edgeKey(...boundary.vertexIndices));
    assert.ok(entry);
    assert.equal(boundary.componentId, entry.loop.componentId);
    assert.equal(boundary.loopId, entry.loop.id);
    assert.equal(boundary.fragmentId, region.fragments.find(fragment => fragment.useId === entry.use.id).id);
    assert.equal(boundary.edgeId, entry.use.edgeId); assert.equal(boundary.useId, entry.use.id); assert.equal(boundary.curveId, entry.use.curveId);
    assert.deepEqual(boundary.vertexIndices, entry.pair);
    assert.equal(boundary.uses.length, 1);
    assert.deepEqual([boundary.uses[0].from, boundary.uses[0].to], entry.pair);
  }
  for (const internal of result.triangulation.internalEdges) {
    assert.ok(internal.kind === 'display-internal-diagonal' || internal.kind === 'display-internal-bridge');
    const uses = evidence.incidence.get(edgeKey(...internal.vertexIndices));
    assert.ok(uses && uses.length === 2);
    assert.equal(internal.uses.length, 2);
    assert.deepEqual(internal.uses.map(use => [use.from, use.to]), uses.map(use => [use.from, use.to]));
    assert.equal(mesh.vertices[internal.vertexIndices[0]].componentId, internal.componentId);
    assert.equal(mesh.vertices[internal.vertexIndices[1]].componentId, internal.componentId);
  }
  assert.equal(new Set(result.triangulation.bridges.map(bridge => bridge.id)).size, result.triangulation.bridges.length);
  for (const bridge of result.triangulation.bridges) {
    assert.equal(bridge.kind, 'display-internal-bridge');
    const internal = result.triangulation.internalEdges.find(edge => edge.id === bridge.id);
    assert.ok(internal && internal.kind === bridge.kind);
    assert.deepEqual(bridge.vertexIndices, internal.vertexIndices);
    assert.deepEqual(bridge.nativeVertexIds, bridge.vertexIndices.map(index => mesh.vertices[index].nativeVertexId));
  }
}

const nativeInputs = [], accepted = [];
function check(name, region, expectedAreaUV, probes) {
  const before = structuredClone(region), inputOptions = {...options, meshId: 'mesh_' + accepted.length};
  const result = tessellate(region, inputOptions);
  checkOwnership([region, inputOptions], result);
  assert.deepEqual(Object.keys(result).sort(), ['region', 'options', 'mesh', 'boundaryPaths', 'triangulation', 'report'].sort());
  assert.deepEqual(result.region, before); assert.deepEqual(result.options, inputOptions);
  const {mesh, report} = result;
  assert.equal(mesh.id, inputOptions.meshId); assert.notEqual(mesh.id, region.support.id);
  assert.deepEqual(mesh.binding, {evaluationId: region.options.evaluationId, supportId: region.support.id,
    a: {faceId: region.faceA.options.faceId, evaluationId: region.faceA.options.evaluationId, supportId: region.faceA.plane.id},
    b: {faceId: region.faceB.options.faceId, evaluationId: region.faceB.options.evaluationId, supportId: region.faceB.plane.id},
    sourceAssetIds: region.sources.map(source => source.id)});
  assert.equal(mesh.vertices.length, region.vertices.length);
  assert.equal(new Set(mesh.vertices.map(vertex => vertex.nativeVertexId)).size, mesh.vertices.length);
  assert.equal(mesh.positionsMM.length, 3 * mesh.vertices.length);
  assert.equal(mesh.normals.length, 3 * mesh.vertices.length);
  assert.equal(mesh.parametersUV.length, 2 * mesh.vertices.length);
  for (const [index, vertex] of mesh.vertices.entries()) {
    const original = region.vertices.find(original => original.id === vertex.nativeVertexId);
    assert.ok(original);
    const loop = region.loops.find(loop => loop.vertexIds.includes(original.id));
    assert.ok(loop);
    assert.equal(vertex.index, index); assert.equal(vertex.componentId, loop.componentId);
    assert.equal(vertex.loopId, loop.id); assert.equal(vertex.loopRole, loop.role);
    assert.deepEqual(vertex.uv, original.uv.slice(0, 2));
    assert.deepEqual(mesh.parametersUV.slice(2 * index, 2 * index + 2), vertex.uv);
    const native = evaluateSurfaceD1(region.support, ...vertex.uv), n = normal(native);
    assert.deepEqual(vertex.surfaceD1, native);
    assert.deepEqual(vertex.orientedNormal, n);
    assert.deepEqual(mesh.positionsMM.slice(3 * index, 3 * index + 3), native.point);
    assert.deepEqual(mesh.normals.slice(3 * index, 3 * index + 3), n);
    assert.deepEqual(vertex.originalPointMM, original.pointMM);
    assert.equal(vertex.originalSurfaceDifferenceMM, difference(native.point, original.pointMM));
    assert.ok(vertex.originalSurfaceDifferenceMM <= 1e-7);
  }
  const evidence = indexedEvidence(mesh);
  assert.ok(Math.abs(evidence.areaUV - expectedAreaUV) <= 1e-7);
  boundaryEvidence(result, evidence);
  for (const triangle of evidence.triangles) {
    assert.ok(material(region, triangle.centroid));
    for (const vertex of mesh.vertices) if (!triangle.indices.includes(vertex.index)) {
      assert.ok(!inTriangle(triangle.uv, vertex.uv), 'Triangle encloses another native vertex');
    }
  }
  const probeEvidence = probes.map(uv => {
    const expected = material(region, uv), covered = evidence.triangles.some(triangle => inTriangle(triangle.uv, uv));
    assert.equal(covered, expected);
    return {uv, expected, covered};
  });
  let expectedTriangles = 0, expectedInternalEdges = 0;
  for (const component of region.components) {
    const indices = mesh.vertices.filter(vertex => vertex.componentId === component.id).map(vertex => vertex.index);
    const n = indices.length, h = component.holeLoopIds.length;
    expectedTriangles += n + 2 * h - 2; expectedInternalEdges += n + 3 * h - 3;
    const record = result.triangulation.components.find(record => record.componentId === component.id);
    assert.ok(record);
    assert.equal(record.outerLoopId, component.outerLoopId); assert.deepEqual(record.holeLoopIds, component.holeLoopIds);
    assert.deepEqual(record.vertexIndices, indices);
    assert.equal(record.expectedTriangleCount, n + 2 * h - 2); assert.equal(record.triangleCount, n + 2 * h - 2);
    assert.equal(record.expectedInternalEdgeCount, n + 3 * h - 3); assert.equal(record.internalEdgeCount, n + 3 * h - 3);
    assert.equal(record.expectedBridgeCount, h); assert.equal(record.bridgeCount, h);
    assert.ok(Math.abs(record.materialAreaUV - component.areaUV) <= 1e-7);
    assert.ok(record.areaDifferenceUV <= record.areaToleranceUV);
    assert.ok(record.areaDifferenceMM2 <= 1e-7 * Math.max(1, record.materialAreaMM2));
  }
  assert.equal(mesh.indices.length / 3, expectedTriangles);
  assert.equal(result.triangulation.internalEdges.length, expectedInternalEdges);
  assert.equal(result.triangulation.bridges.length, region.loops.filter(loop => loop.role === 'hole').length);
  assert.equal(result.triangulation.components.length, region.components.length);
  for (const [index, triangle] of result.triangulation.triangles.entries()) {
    assert.deepEqual(triangle.vertexIndices, evidence.triangles[index].indices);
    assert.equal(triangle.signedAreaUV, evidence.triangles[index].signedAreaUV);
    assert.equal(triangle.areaMM2, evidence.triangles[index].areaMM2);
    const centroidBound = 128 * Number.EPSILON * Math.max(1, ...evidence.triangles[index].uv.flat().map(Math.abs));
    assert.ok(difference(triangle.centroidUV, evidence.triangles[index].centroid) <= centroidBound);
    assert.equal(triangle.centroidInMaterial, true);
    assert.ok(triangle.vertexIndices.every(index => mesh.vertices[index].componentId === triangle.componentId));
  }
  const nativeIds = new Set();
  const collectIds = value => {
    if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
      if (typeof child === 'string' && (key === 'id' || key.endsWith('Id') || key === 'name')) nativeIds.add(child);
      else collectIds(child);
    }
  };
  collectIds(region);
  const displayIds = [mesh.id, ...result.triangulation.triangles.map(triangle => triangle.id), ...result.triangulation.internalEdges.map(edge => edge.id)];
  assert.equal(new Set(displayIds).size, displayIds.length);
  assert.ok(displayIds.every(id => !nativeIds.has(id)));
  assert.equal(report.schema, 'barocss-native-coplanar-face-boolean-mesh');
  assert.equal(report.version, 0); assert.equal(report.meshId, mesh.id);
  assert.equal(report.supportId, region.support.id); assert.equal(report.evaluationId, region.options.evaluationId);
  assert.equal(report.lengthUnit, 'mm'); assert.equal(report.sourceFrame, 'authored-xyz-no-axis-conversion');
  assert.equal(report.uvUnits, 'dimensionless');
  assert.equal(report.vertexCount, mesh.vertices.length); assert.equal(report.triangleCount, evidence.triangles.length);
  assert.equal(report.boundaryCount, result.boundaryPaths.length); assert.equal(report.componentCount, region.components.length);
  assert.equal(report.loopCount, region.loops.length); assert.equal(report.holeCount, result.triangulation.bridges.length);
  assert.equal(report.internalEdgeCount, expectedInternalEdges); assert.equal(report.expectedInternalEdgeCount, expectedInternalEdges);
  assert.equal(report.bridgeCount, result.triangulation.bridges.length); assert.equal(report.expectedTriangleCount, expectedTriangles);
  assert.ok(Math.abs(report.materialAreaUV - expectedAreaUV) <= 1e-7);
  assert.equal(report.triangleAreaUV, evidence.areaUV); assert.equal(report.triangleAreaMM2, evidence.areaMM2);
  assert.ok(report.areaDifferenceUV <= report.areaToleranceUV);
  assert.ok(report.areaDifferenceMM2 <= 1e-7 * Math.max(1, report.materialAreaMM2));
  assert.ok(report.candidatePairCount <= inputOptions.maximumCandidatePairs);
  assert.ok(report.predicateTestCount <= inputOptions.maximumPredicateTests);
  assert.ok(report.triangleTestCount <= inputOptions.maximumTriangleTests);
  assert.equal(report.triangleTestCount, report.vertexTripleTestCount + report.trianglePairTestCount);
  assert.equal(report.surfaceD1EvaluationCount, mesh.vertices.length + 3 * result.boundaryPaths.length);
  assert.equal(report.curveD1EvaluationCount, 9 * result.boundaryPaths.length);
  assert.equal(report.quality.nativeRegionBitsPreserved, true); assert.equal(report.quality.rendererCapacityCertified, false);
  assert.equal(report.topologyCertified, false); assert.equal(report.solid, false);
  if (!mesh.vertices.length) {
    assert.deepEqual([mesh.positionsMM, mesh.normals, mesh.parametersUV, mesh.indices], [[], [], [], []]);
    assert.equal(mesh.boundsMM, null);
    assert.deepEqual(result.boundaryPaths, []);
    assert.deepEqual([result.triangulation.triangles, result.triangulation.internalEdges, result.triangulation.bridges], [[], [], []]);
    assert.equal(report.surfaceD1EvaluationCount, 0); assert.equal(report.curveD1EvaluationCount, 0);
  } else {
    const positions = mesh.vertices.map((_, index) => mesh.positionsMM.slice(3 * index, 3 * index + 3));
    assert.deepEqual(mesh.boundsMM, {min: [0, 1, 2].map(axis => Math.min(...positions.map(point => point[axis]))),
      max: [0, 1, 2].map(axis => Math.max(...positions.map(point => point[axis])))});
    const jacobian = Math.hypot(...cross(mesh.vertices[0].surfaceD1.du, mesh.vertices[0].surfaceD1.dv));
    assert.equal(report.surfaceJacobianMM2, jacobian);
    assert.ok(Math.abs(report.materialAreaMM2 - expectedAreaUV * jacobian) <= 1e-7);
  }
  assert.deepEqual(validate(result), report);
  const stored = ownedFile(name + '.owned-mesh', result);
  assert.deepEqual(validate(stored.reopened), report);
  assert.deepEqual(region, before);
  accepted.push({result, before: structuredClone(result), file: stored.file});
  summaries.push({name, materialAreaUV: expectedAreaUV, vertexCount: mesh.vertices.length, triangleCount: evidence.triangles.length,
    boundaryCount: result.boundaryPaths.length, componentCount: region.components.length, bridgeCount: result.triangulation.bridges.length,
    candidatePairCount: report.candidatePairCount, predicateTestCount: report.predicateTestCount, triangleTestCount: report.triangleTestCount,
    resultFile: stored.file, probes: probeEvidence});
  return result;
}
ownedFile('source-api.metafile', built.metafile);
ownedFile('source-api.inputs', {entry, mode: 'in-memory-esbuild', write: false,
  cadInputs, allInputs: sourceInputs, esbuildVersion: esbuild.version});
const definitions = [
  ['cross_union', 24, [[.5, 5], [2.75, 7], [4.5, 9], [5.75, 10.75]]],
  ['cross_intersection', 4, [[.5, 5], [2.75, 7], [4.5, 9]]],
  ['cross_difference', 12, [[.5, 5], [2.75, 7], [4.5, 9]]],
  ['containment_hole', 32, [[0, 5], [2, 7], [4, 9], [-1.5, 5]]],
  ['strip_two_components', 18, [[.5, 7], [2, 7], [3.5, 7]]],
  ['octagons_two_chunks', 7, [[-.5, 5], [3.5, 5], [1.5, 5]]],
  ['reverse_containment_empty', 0, [[0, 5], [2, 7], [4, 9]]],
];
const meshes = new Map(), inputProvenance = [];
for (const [name, area, probes] of definitions) {
  const file = resolve(booleanDirectory, name + '.owned-region.json'), bytes = readFileSync(file);
  retainedFiles.set(file, bytes);
  const region = JSON.parse(bytes.toString('utf8'));
  assert.deepEqual(validateRegion(region), region.report);
  nativeInputs.push({region, before: structuredClone(region)});
  inputProvenance.push({name, file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')});
  for (const [index, source] of region.sources.entries()) {
    const sourceInput = resolve(booleanDirectory, name + '.world_chunk_' + index + '.source0.css');
    const sourceBytes = readFileSync(sourceInput);
    assert.equal(sourceBytes.toString('utf8'), source.source);
    retainedFiles.set(sourceInput, sourceBytes);
    inputProvenance.push({name: name + '.source_' + index, file: sourceInput, bytes: sourceBytes.length,
      sha256: createHash('sha256').update(sourceBytes).digest('hex')});
    sourceFile(name + '.world_chunk_' + index, source.source, source.model);
  }
  for (const [operand, face] of [['a', region.faceA], ['b', region.faceB]]) {
    sourceFile(name + '.original_' + operand, face.source, face.model);
  }
  meshes.set(name, check(name, region, area, probes));
}
ownedFile('authentic-inputs', inputProvenance);

// One eligible old producer witness uses the same explicit native chart and a convex hole.
const oldPlane = {kind: 'surface', id: 'old_witness_plane', degreeU: 1, degreeV: 1,
  knotsU: [-2, -2, 6, 6], knotsV: [3, 3, 11, 11],
  controlPoints: [[[-8, -8, -8], [-4, 0, -4]], [[0, -8, 0], [4, 0, 4]]], weights: [[1, 1], [1, 1]]};
const world = ([u, v]) => [u + .5 * v - 7.5, v - 11, u + .5 * v - 7.5];
const oldLoop = (id, uv) => ({id, edges: uv.map((point, index) => ({kind: 'curve', id: id + '_line_' + index,
  degree: 1, knots: [-3, -3, 7, 7], controlPoints: [world(point), world(uv[(index + 1) % uv.length])], weights: [2, 2]}))});
const oldFace = buildOldFace(oldPlane,
  oldLoop('old_outer', [[-1, 4], [5, 4], [5, 10], [-1, 10]]),
  [oldLoop('old_hole', [[1, 6], [3, 6], [3, 8], [1, 8]])],
  {faceId: 'old_witness_face', evaluationId: 'old_witness_eval', resultIdPrefix: 'oldwitness', orientation: 'forward'});
const oldBefore = structuredClone(oldFace), oldMesh = tessellateOld(oldFace);
checkOwnership([oldFace], oldMesh);
assert.deepEqual(oldFace, oldBefore);
assert.deepEqual(validateOldMesh(oldMesh), oldMesh.report);
const oldEvidence = indexedEvidence(oldMesh.mesh);
assert.equal(oldMesh.mesh.vertices.length, 8); assert.equal(oldEvidence.triangles.length, 8);
assert.ok(Math.abs(oldEvidence.areaUV - 32) <= 1e-7);
assert.equal(oldMesh.triangulation.bridges.length, 1);
assert.equal(oldMesh.triangulation.internalEdges.length, 8);
for (const vertex of oldMesh.mesh.vertices) {
  assert.deepEqual(vertex.surfaceD1, evaluateSurfaceD1(oldFace.plane, ...vertex.uv));
  assert.deepEqual(oldMesh.mesh.positionsMM.slice(3 * vertex.index, 3 * vertex.index + 3), vertex.surfaceD1.point);
}
const oldIndex = new Map(oldMesh.mesh.vertices.map(vertex => [vertex.nativeVertexId, vertex.index]));
const oldBoundaries = new Set(oldFace.topology.edges.map(edge => edgeKey(...edge.vertexIds.map(id => oldIndex.get(id)))));
for (const [key, uses] of oldEvidence.incidence) {
  if (oldBoundaries.has(key)) assert.equal(uses.length, 1);
  else { assert.equal(uses.length, 2); assert.equal(uses[0].from, uses[1].to); assert.equal(uses[0].to, uses[1].from); }
}
assert.ok(Math.abs(oldEvidence.areaMM2 - 32 * Math.SQRT2) <= 1e-7);
sourceFile('one_old_convex_hole_witness', oldFace.source, oldFace.model);
const oldStored = ownedFile('one_old_convex_hole_witness.owned-mesh', oldMesh);
assert.deepEqual(validateOldMesh(oldStored.reopened), oldMesh.report);

// Edit both incident native endpoint coefficients of the authentic A top-right corner.
const crossRegion = meshes.get('cross_intersection').region;
const editedLoop = structuredClone(crossRegion.faceA.loop);
let editedEndpoints = 0;
for (const line of editedLoop.edges) for (let endpoint = 0; endpoint < 2; endpoint++) {
  if (difference(line.controlPoints[endpoint], [.5, -3, .5]) === 0) {
    line.controlPoints[endpoint] = [1, -3, 1]; editedEndpoints++;
  }
}
assert.equal(editedEndpoints, 2);
const editedFace = buildFace(crossRegion.faceA.plane, editedLoop, crossRegion.faceA.options);
assert.deepEqual(editedFace.options, crossRegion.faceA.options);
assert.deepEqual(editedFace.loop.edges.map(line => line.id), crossRegion.faceA.loop.edges.map(line => line.id));
sourceFile('authored_corner_edited', editedFace.source, editedFace.model);
const editedRegion = boolean(editedFace, crossRegion.faceB, {operation: 'intersection', evaluationId: 'mesh_corner_edit_eval',
  resultIdPrefix: 'mesh_edit', maximumPairTests: 64, maximumFragments: 64});
assert.ok(Math.abs(editedRegion.report.areaUV - 4.75) <= 1e-7);
for (const [index, source] of editedRegion.sources.entries()) sourceFile('edited_region.world_chunk_' + index, source.source, source.model);
const editedStored = ownedFile('authored_corner_edited.owned-region', editedRegion);
assert.deepEqual(validateRegion(editedStored.reopened), editedRegion.report);
const editedMesh = check('authored_corner_edited', editedStored.reopened, 4.75, [[.5, 5], [2.75, 7], [4.5, 9]]);
assert.notDeepEqual(editedMesh.mesh.positionsMM, meshes.get('cross_intersection').mesh.positionsMM);

function intact() {
  for (const {region, before} of nativeInputs) assert.deepEqual(region, before);
  for (const {result, before} of accepted) assert.deepEqual(result, before);
  assert.deepEqual(oldFace, oldBefore);
  for (const [file, bytes] of retainedFiles) assert.deepEqual(readFileSync(file), bytes);
}
function reject(name, action, code) {
  assert.throws(action, error => {
    assert.ok(error instanceof CoplanarFaceBooleanMeshError);
    assert.equal(error.name, 'CoplanarFaceBooleanMeshError'); assert.equal(error.code, code);
    assert.ok(Object.values(CoplanarFaceBooleanMeshDiagnosticCode).includes(error.code));
    assert.ok(error.message.startsWith('Coplanar Face Boolean Mesh: '));
    failures.push({name, code: error.code, message: error.message, actualCausePreserved: Object.hasOwn(error, 'cause')});
    intact(); return true;
  });
}
const meshUnion = meshes.get('cross_union'), holeMesh = meshes.get('containment_hole');
reject('native_support_mesh_id_collision', () => tessellate(meshUnion.region,
  {...options, meshId: meshUnion.region.support.id}), 'IDENTITY');
for (const [name, field, value] of [['vertex_budget', 'maximumVertices', 0], ['triangle_budget', 'maximumTriangles', 0],
  ['candidate_budget', 'maximumCandidatePairs', 0], ['predicate_budget', 'maximumPredicateTests', 1], ['triangle_work_budget', 'maximumTriangleTests', 0]]) {
  reject(name, () => tessellate(meshUnion.region, {...options, meshId: 'budget_mesh', [field]: value}), 'BUDGET');
}
let getterCalls = 0;
const getter = {...options};
Object.defineProperty(getter, 'meshId', {enumerable: true, get() { getterCalls++; return 'getter_mesh'; }});
reject('options_getter', () => tessellate(meshUnion.region, getter), 'INPUT'); assert.equal(getterCalls, 0);
const ownedGetter = structuredClone(meshUnion);
Object.defineProperty(ownedGetter.mesh, 'positionsMM', {enumerable: true,
  get() { getterCalls++; return meshUnion.mesh.positionsMM; }});
reject('owned_mesh_getter', () => validate(ownedGetter), 'OWNED'); assert.equal(getterCalls, 0);
const badParent = structuredClone(meshUnion.region); badParent.sources[0].source += ' ';
reject('altered_parent_source', () => tessellate(badParent, options), 'INPUT');
for (const [name, source, alter] of [
  ['normal', meshUnion, result => result.mesh.normals[0] += .1],
  ['triangle', meshUnion, result => [result.mesh.indices[1], result.mesh.indices[2]] = [result.mesh.indices[2], result.mesh.indices[1]]],
  ['boundary', meshUnion, result => result.boundaryPaths[0].samples[0].parameter += .01],
  ['hole_role', holeMesh, result => result.region.loops.find(loop => loop.role === 'hole').role = 'outer'],
  ['internal_role', holeMesh, result => result.triangulation.internalEdges[0].kind = 'native-boundary'],
  ['native_provenance', meshUnion, result => result.mesh.vertices[0].nativeVertexId = 'unrelated_native_vertex'],
  ['work_report', meshUnion, result => result.report.predicateTestCount++],
]) {
  const changed = structuredClone(source); alter(changed);
  reject('owned_' + name + '_tamper', () => validate(changed), 'OWNED');
}
assert.deepEqual(validate(meshUnion), meshUnion.report); intact();

const packageRoot = resolve(repo, 'packages/barocss-cad');
const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')), declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const runtimeNames = ['tessellateCoplanarFaceBoolean', 'validateCoplanarFaceBooleanMesh', 'CoplanarFaceBooleanMeshError', 'CoplanarFaceBooleanMeshDiagnosticCode'];
const typeNames = ['CoplanarFaceBooleanMeshOptions', 'CoplanarFaceBooleanMeshVertex', 'CoplanarFaceBooleanMeshBoundaryPath',
  'CoplanarFaceBooleanMeshEdgeUse', 'CoplanarFaceBooleanMeshTriangulation', 'CoplanarFaceBooleanMeshReport', 'CoplanarFaceBooleanMeshResult'];
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.CoplanarFaceBooleanMeshDiagnosticCode, CoplanarFaceBooleanMeshDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./coplanar-face-boolean-mesh.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/coplanar-face-boolean-mesh.d.ts'), declaration = readFileSync(leafDeclarationPath, 'utf8');
for (const name of [...runtimeNames, ...typeNames]) assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(declaration), name);
assert.ok(!Object.hasOwn(api, 'createNativeUVGraphPredicates')); assert.ok(!Object.hasOwn(publicAPI, 'createNativeUVGraphPredicates'));
const coldRegion = JSON.parse(readFileSync(resolve(booleanDirectory, 'containment_hole.owned-region.json'), 'utf8'));
const compiled = publicAPI.tessellateCoplanarFaceBoolean(coldRegion, holeMesh.options);
assert.deepEqual(compiled, holeMesh); assert.deepEqual(publicAPI.validateCoplanarFaceBooleanMesh(compiled), holeMesh.report);
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 11,
  declarationCheck: 'actual declaration export text; no separate TypeScript invocation'};
ownedFile('compiled-consumer', compiledConsumer);
ownedFile('summary', {sourceMode: true, cadSourceInputCount: cadInputs.length, inputProvenance, summaries, failures, compiledConsumer,
  caseCount: summaries.length, refusalCount: failures.length,
  oneOldWitness: {ownedFile: oldStored.file, materialAreaUV: oldEvidence.areaUV, triangleCount: oldEvidence.triangles.length},
  scope: 'Authentic native Boolean region consumed without source mutation. Actual support D1 positions and normals, all components, holes, directed boundary provenance, indexed internal display edges, and local coverage are checked. One old convex-hole producer remains an eligible consumer. No duplicate bridge vertices, Steiner points, native support renaming, PreviewPacket0, GPU, renderer adoption, frame conversion, manufacturing, certified topology, or old producer campaign.'});
intact();
console.log(JSON.stringify({sourceMode: true, cadSourceInputCount: cadInputs.length, inputProvenance, summaries, failures, compiledConsumer}));
