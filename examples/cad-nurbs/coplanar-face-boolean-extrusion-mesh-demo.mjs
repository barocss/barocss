import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 4,
  'Usage: node coplanar-face-boolean-extrusion-mesh-demo.mjs --source <output-directory> --extrusion-directory <saved-extrusion-directory>');
assert.equal(args[0], '--source');
assert.equal(args[2], '--extrusion-directory');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const output = resolve(args[1]);
const extrusionDirectory = resolve(args[3]);
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
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/coplanar-face-boolean-extrusion-mesh.ts')));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' +
  Buffer.from(built.outputFiles[0].text).toString('base64'));
const {
  tessellateCoplanarFaceBooleanExtrusion: tessellate, validateCoplanarFaceBooleanExtrusionMesh: validate,
  CoplanarFaceBooleanExtrusionMeshError, CoplanarFaceBooleanExtrusionMeshDiagnosticCode,
  validateCoplanarFaceBooleanExtrusion: validateExtrusion,
  validateCoplanarFaceBooleanMesh: validateRegionMesh,
  evaluateCurveD1, evaluateSurfaceD1, surfaceDomain, curveDomain, compileCadModel,
} = api;
for (const operation of [tessellate, validate, validateExtrusion, validateRegionMesh]) assert.equal(typeof operation, 'function');
assert.deepEqual(Object.keys(CoplanarFaceBooleanExtrusionMeshDiagnosticCode).sort(),
  ['INPUT', 'IDENTITY', 'BUDGET', 'NATIVE', 'REPRESENTABILITY', 'BINDING', 'INCIDENCE', 'COVERAGE', 'OWNED'].sort());
const options = {meshId: 'shell_mesh', maximumVertices: 384, maximumTriangles: 288, maximumEdgePaths: 192, maximumNativeSamples: 1024};

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
      assert.ok(!caller.has(value), 'Extrusion mesh result aliases caller data');
      assert.ok(!seen.has(value), 'Repeated nested output object occurrence');
      seen.add(value);
      for (const child of Object.values(value)) visit(child);
    }
  };
  visit(result);
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const delta = (a, b) => a.map((value, axis) => value - b[axis]);
const unit = vector => { const n = Math.hypot(...vector); return vector.map(value => value / n); };
const det = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
const edgeKey = (a, b) => Math.min(a, b) + ':' + Math.max(a, b);
function winding(point, polygon) {
  let n = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length], side = det(a, b, point);
    if (a[1] <= point[1] && b[1] > point[1] && side > 0) n++;
    else if (a[1] > point[1] && b[1] <= point[1] && side < 0) n--;
  }
  return n;
}
function inTriangle(triangle, point) {
  const values = triangle.map((a, i) => det(a, triangle[(i + 1) % 3], point));
  return values.every(value => value >= 0) || values.every(value => value <= 0);
}
function componentMaterial(region, component, point) {
  return [component.outerLoopId, ...component.holeLoopIds].reduce((sum, id) => {
    const loop = region.loops.find(loop => loop.id === id);
    return sum + winding(point, loop.vertexIds.map(id => region.vertices.find(vertex => vertex.id === id).uv));
  }, 0) !== 0;
}
function pointer(extrusion, source, geometry) {
  const asset = extrusion.sources.find(asset => asset.id === source.assetId);
  assert.ok(asset); assert.equal(source.objectId, geometry.id); assert.equal(source.kind, geometry.kind);
  assert.deepEqual(asset.model.objects[source.objectIndex], geometry);
}
const nativeInputs = [], accepted = [];
function faceEvidence(result, range) {
  const {mesh, extrusion} = result, face = extrusion.faces.find(face => face.id === range.faceId);
  assert.ok(face); assert.equal(range.componentId, face.componentId); assert.equal(range.kind, face.kind);
  assert.equal(range.orientation, face.orientation); assert.equal(range.surfaceId, face.surface.id); assert.deepEqual(range.source, face.source);
  const shell = extrusion.shells.find(shell => shell.id === range.shellId);
  assert.ok(shell && shell.faceIds.includes(face.id));
  const vertices = mesh.vertices.slice(range.vertexStart, range.vertexStart + range.vertexCount);
  assert.equal(vertices.length, range.vertexCount);
  const nativeIndex = new Map();
  for (const vertex of vertices) {
    const nativeVertex = extrusion.vertices.find(native => native.id === vertex.nativeVertexId);
    assert.ok(nativeVertex); assert.ok(!nativeIndex.has(nativeVertex.id)); nativeIndex.set(nativeVertex.id, vertex.index);
    assert.equal(vertex.faceId, face.id); assert.equal(vertex.componentId, face.componentId); assert.equal(vertex.shellId, shell.id);
    assert.equal(vertex.regionVertexId, nativeVertex.nativeVertexId); assert.equal(vertex.surfaceId, face.surface.id);
    assert.deepEqual(vertex.source, face.source); pointer(extrusion, vertex.source, face.surface);
    const d1 = evaluateSurfaceD1(face.surface, ...vertex.uv), n = unit(cross(d1.du, d1.dv)).map(value => value * (face.orientation === 'forward' ? 1 : -1));
    assert.deepEqual(vertex.surfaceD1, d1); assert.deepEqual(vertex.orientedNormal, n);
    assert.deepEqual(vertex.canonicalPointMM, nativeVertex.pointMM);
    assert.equal(vertex.pointDifferenceMM, difference(d1.point, nativeVertex.pointMM)); assert.ok(vertex.pointDifferenceMM <= 1e-7);
    assert.deepEqual(mesh.positionsMM.slice(3 * vertex.index, 3 * vertex.index + 3), d1.point);
    assert.deepEqual(mesh.normals.slice(3 * vertex.index, 3 * vertex.index + 3), n);
    assert.deepEqual(mesh.parametersUV.slice(2 * vertex.index, 2 * vertex.index + 2), vertex.uv);
    if (face.kind !== 'wall') {
      const original = result.regionMesh.mesh.vertices[vertex.regionMeshVertexIndex];
      assert.ok(original && original.nativeVertexId === vertex.regionVertexId); assert.deepEqual(vertex.uv, original.uv);
    } else assert.equal(vertex.regionMeshVertexIndex, null);
  }
  const incidence = new Map(), uvTriangles = [];
  assert.equal(range.indexCount, 3 * range.triangleCount); assert.equal(range.triangles.length, range.triangleCount);
  for (const [offset, triangle] of range.triangles.entries()) {
    assert.equal(triangle.indexStart, range.indexStart + 3 * offset);
    assert.deepEqual(triangle.vertexIndices, mesh.indices.slice(triangle.indexStart, triangle.indexStart + 3));
    assert.ok(triangle.vertexIndices.every(index => index >= range.vertexStart && index < range.vertexStart + range.vertexCount));
    const xyz = triangle.vertexIndices.map(index => mesh.positionsMM.slice(3 * index, 3 * index + 3));
    const uv = triangle.vertexIndices.map(index => mesh.parametersUV.slice(2 * index, 2 * index + 2));
    const vector = cross(delta(xyz[1], xyz[0]), delta(xyz[2], xyz[0])), area = Math.hypot(...vector) / 2;
    assert.ok(Number.isFinite(area) && area > 0); assert.equal(triangle.areaMM2, area);
    const dots = triangle.vertexIndices.map(index => vector.reduce((sum, value, axis) => sum + value * mesh.normals[3 * index + axis], 0));
    assert.ok(dots.every(dot => dot > 0)); assert.equal(triangle.minimumNormalDot, Math.min(...dots));
    assert.ok(det(...uv) * (face.orientation === 'forward' ? 1 : -1) > 0);
    uvTriangles.push(uv);
    for (let i = 0; i < 3; i++) {
      const from = triangle.vertexIndices[i], to = triangle.vertexIndices[(i + 1) % 3], key = edgeKey(from, to), uses = incidence.get(key) ?? [];
      uses.push({triangleId: triangle.id, from, to}); incidence.set(key, uses);
    }
    if (face.kind === 'wall') assert.equal(triangle.regionMeshTriangleId, null);
    else {
      const parent = result.regionMesh.triangulation.triangles.find(parent => parent.id === triangle.regionMeshTriangleId);
      assert.ok(parent && parent.componentId === face.componentId);
      const mapped = parent.vertexIndices.map(index => vertices.find(vertex => vertex.regionMeshVertexIndex === index).index);
      assert.deepEqual(triangle.vertexIndices, face.orientation === 'forward' ? mapped : [mapped[0], mapped[2], mapped[1]]);
      const component = extrusion.region.components.find(component => component.id === face.componentId);
      const centroid = [0, 1].map(axis => (uv[0][axis] + uv[1][axis] + uv[2][axis]) / 3);
      assert.ok(componentMaterial(extrusion.region, component, centroid));
    }
  }
  const boundaryKeys = new Set();
  for (const loop of range.loops) {
    const native = face.loops.find(native => native.id === loop.loopId);
    assert.ok(native); assert.equal(loop.role, native.role); assert.equal(loop.nativeLoopId, native.nativeLoopId);
    assert.deepEqual(loop.effectiveUseIds, native.effectiveUseIds);
    assert.equal(loop.uses.length, native.uses.length);
    for (const use of loop.uses) {
      const original = native.uses.find(original => original.id === use.useId);
      assert.ok(original);
      assert.equal(use.edgeId, original.edgeId); assert.equal(use.curveId, original.curveId); assert.equal(use.pcurveId, original.pcurve.id);
      assert.equal(use.edgeSense, original.edgeSense); assert.equal(use.effectiveSense, original.effectiveSense);
      assert.deepEqual(use.localVertexIds, original.vertexIds); assert.deepEqual(use.effectiveVertexIds, original.effectiveVertexIds);
      assert.deepEqual(use.localVertexIndices, original.vertexIds.map(id => nativeIndex.get(id)));
      assert.deepEqual(use.effectiveVertexIndices, original.effectiveVertexIds.map(id => nativeIndex.get(id)));
      assert.deepEqual(use.interval, original.interval); assert.deepEqual(use.effectiveInterval, original.effectiveInterval);
    }
  }
  for (const boundary of range.boundaryIncidence) {
    const loop = face.loops.find(loop => loop.id === boundary.loopId), use = loop.uses.find(use => use.id === boundary.useId);
    assert.ok(use); assert.equal(boundary.edgeId, use.edgeId); assert.equal(boundary.curveId, use.curveId);
    assert.equal(boundary.pcurveId, use.pcurve.id); assert.equal(boundary.effectiveSense, use.effectiveSense);
    assert.deepEqual(boundary.vertexIndices, use.effectiveVertexIds.map(id => nativeIndex.get(id)));
    const key = edgeKey(...boundary.vertexIndices); assert.ok(!boundaryKeys.has(key)); boundaryKeys.add(key);
    assert.deepEqual(boundary.triangleUses, incidence.get(key)); assert.equal(boundary.triangleUses.length, 1);
    assert.deepEqual([boundary.triangleUses[0].from, boundary.triangleUses[0].to], boundary.vertexIndices);
  }
  const internalKeys = new Set();
  for (const internal of range.internalEdges) {
    const key = edgeKey(...internal.vertexIndices); assert.ok(!boundaryKeys.has(key) && !internalKeys.has(key)); internalKeys.add(key);
    assert.deepEqual(internal.triangleUses, incidence.get(key)); assert.equal(internal.triangleUses.length, 2);
    assert.equal(internal.triangleUses[0].from, internal.triangleUses[1].to); assert.equal(internal.triangleUses[0].to, internal.triangleUses[1].from);
    if (face.kind === 'wall') { assert.equal(internal.kind, 'display-wall-diagonal'); assert.equal(internal.regionMeshEdgeId, null); }
    else {
      const original = result.regionMesh.triangulation.internalEdges.find(edge => edge.id === internal.regionMeshEdgeId);
      assert.ok(original); assert.equal(internal.kind, original.kind === 'display-internal-bridge' ? 'display-cap-bridge' : 'display-cap-diagonal');
    }
  }
  assert.equal(incidence.size, boundaryKeys.size + internalKeys.size);
  if (face.kind === 'wall') {
    assert.equal(range.vertexCount, 4); assert.equal(range.triangleCount, 2);
    const domain = surfaceDomain(face.surface), corners = [[domain.u[0], domain.v[0]], [domain.u[1], domain.v[0]],
      [domain.u[1], domain.v[1]], [domain.u[0], domain.v[1]]];
    assert.deepEqual(vertices.map(vertex => vertex.uv), corners);
    assert.deepEqual(vertices.map(vertex => vertex.nativeVertexId), face.loops[0].uses.map(use => use.vertexIds[0]));
    const observation = range.wallCenterObservation;
    assert.ok(observation); assert.deepEqual(observation.surfaceD1, evaluateSurfaceD1(face.surface, observation.u, observation.v));
    const centerNormal = unit(cross(observation.surfaceD1.du, observation.surfaceD1.dv))
      .map(value => value * (face.orientation === 'forward' ? 1 : -1));
    assert.deepEqual(observation.orientedNormal, centerNormal);
    const normalDots = [];
    const distances = range.triangles.map(triangle => {
      const [a, b, c] = triangle.vertexIndices.map(index => mesh.positionsMM.slice(3 * index, 3 * index + 3));
      const n = unit(cross(delta(b, a), delta(c, a)));
      normalDots.push(n.reduce((sum, value, axis) => sum + value * centerNormal[axis], 0));
      return Math.abs(n.reduce((sum, value, axis) => sum + value * (observation.surfaceD1.point[axis] - a[axis]), 0));
    });
    assert.ok(difference(observation.trianglePlaneDistancesMM, distances) <= 1e-10);
    assert.ok(Math.abs(observation.minimumNormalDot - Math.min(...normalDots)) <= 128 * Number.EPSILON);
    assert.ok(observation.minimumTrianglePlaneDistanceMM <= 1e-7 && observation.minimumNormalDot > 0);
  } else {
    assert.equal(range.wallCenterObservation, null);
    const component = extrusion.region.components.find(component => component.id === face.componentId);
    for (const id of component.holeLoopIds) {
      const loop = extrusion.region.loops.find(loop => loop.id === id), polygon = loop.vertexIds.map(id => extrusion.region.vertices.find(vertex => vertex.id === id).uv);
      const witness = [0, 1].map(axis => polygon.reduce((sum, point) => sum + point[axis], 0) / polygon.length);
      assert.ok(winding(witness, polygon) !== 0); assert.ok(!uvTriangles.some(triangle => inTriangle(triangle, witness)));
    }
    const sumArea = uvTriangles.reduce((sum, triangle) => sum + Math.abs(det(...triangle)) / 2, 0);
    assert.ok(Math.abs(sumArea - component.areaUV) <= 1e-7);
  }
}

function pathsEvidence(result) {
  const {extrusion, mesh} = result;
  assert.deepEqual(result.edgePaths.map(path => path.edgeId), extrusion.edges.map(edge => edge.id));
  for (const path of result.edgePaths) {
    const edge = extrusion.edges.find(edge => edge.id === path.edgeId);
    const shell = extrusion.shells.find(shell => shell.id === path.shellId);
    assert.ok(edge && shell && shell.edgeIds.includes(edge.id));
    assert.equal(path.componentId, edge.componentId); assert.equal(path.kind, edge.kind); assert.equal(path.curveId, edge.curve.id);
    assert.deepEqual(path.source, edge.source); pointer(extrusion, path.source, edge.curve);
    assert.deepEqual(path.interval, curveDomain(edge.curve)); assert.deepEqual(path.nativeVertexIds, edge.vertexIds);
    assert.equal(path.nativeFragmentId, edge.nativeFragmentId); assert.equal(path.nativeVertexId, edge.nativeVertexId);
    assert.equal(path.samples.length, 3);
    assert.deepEqual(path.samples.map(sample => sample.parameter), [path.interval[0], path.interval[0] + (path.interval[1] - path.interval[0]) / 2, path.interval[1]]);
    for (const sample of path.samples) assert.deepEqual(sample.curveD1, evaluateCurveD1(edge.curve, sample.parameter));
    assert.equal(path.adjacentFaces.length, 2); assert.notEqual(path.adjacentFaces[0].effectiveSense, path.adjacentFaces[1].effectiveSense);
    for (const adjacent of path.adjacentFaces) {
      const range = result.faceRanges.find(range => range.faceId === adjacent.faceId);
      const face = extrusion.faces.find(face => face.id === adjacent.faceId), loop = face.loops.find(loop => loop.id === adjacent.loopId);
      const use = loop.uses.find(use => use.id === adjacent.useId);
      assert.ok(use); assert.equal(use.edgeId, edge.id); assert.equal(adjacent.pcurveId, use.pcurve.id); assert.equal(adjacent.effectiveSense, use.effectiveSense);
      assert.deepEqual(adjacent.vertexIndices.map(index => mesh.vertices[index].nativeVertexId), edge.vertexIds);
      assert.ok(adjacent.vertexIndices.every(index => index >= range.vertexStart && index < range.vertexStart + range.vertexCount));
      const endpointPoints = [path.samples[0].curveD1.point, path.samples[2].curveD1.point];
      const residuals = adjacent.vertexIndices.map((index, endpoint) => difference(endpointPoints[endpoint], mesh.positionsMM.slice(3 * index, 3 * index + 3)));
      assert.deepEqual(adjacent.endpointDifferencesMM, residuals); assert.ok(residuals.every(value => value <= 1e-7));
      const boundary = range.boundaryIncidence.find(boundary => boundary.useId === use.id);
      assert.ok(boundary); assert.deepEqual(adjacent.triangleUses, boundary.triangleUses);
    }
  }
}
function check(name, extrusion, expectedVertices, expectedTriangles, expectedPaths) {
  const before = structuredClone(extrusion), inputOptions = {...options, meshId: 'em' + accepted.length};
  const result = tessellate(extrusion, inputOptions); checkOwnership([extrusion, inputOptions], result);
  assert.deepEqual(Object.keys(result).sort(), ['extrusion', 'options', 'regionMesh', 'mesh', 'faceRanges', 'edgePaths', 'shellRanges', 'report'].sort());
  assert.deepEqual(result.extrusion, before); assert.deepEqual(result.options, inputOptions);
  assert.deepEqual(result.regionMesh.region, extrusion.region); assert.deepEqual(validateRegionMesh(result.regionMesh), result.regionMesh.report);
  assert.equal(result.regionMesh.mesh.id, inputOptions.meshId + '_region');
  const {mesh, report} = result;
  assert.equal(mesh.id, inputOptions.meshId); assert.notEqual(mesh.id, extrusion.options.evaluationId);
  assert.deepEqual(mesh.binding, {extrusionEvaluationId: extrusion.options.evaluationId, booleanEvaluationId: extrusion.region.options.evaluationId,
    nativeShellIds: extrusion.shells.map(shell => shell.id), sourceAssetIds: extrusion.sources.map(source => source.id), regionMeshId: result.regionMesh.mesh.id});
  assert.equal(mesh.vertices.length, expectedVertices); assert.equal(mesh.indices.length / 3, expectedTriangles);
  assert.equal(result.edgePaths.length, expectedPaths); assert.equal(result.faceRanges.length, extrusion.faces.length);
  assert.equal(result.shellRanges.length, extrusion.shells.length);
  assert.equal(mesh.positionsMM.length, 3 * expectedVertices); assert.equal(mesh.normals.length, 3 * expectedVertices);
  assert.equal(mesh.parametersUV.length, 2 * expectedVertices);
  assert.deepEqual(result.faceRanges.map(range => range.faceId), extrusion.faces.map(face => face.id));
  let vertexStart = 0, indexStart = 0, triangleStart = 0;
  for (const range of result.faceRanges) {
    assert.equal(range.vertexStart, vertexStart); assert.equal(range.indexStart, indexStart); assert.equal(range.triangleStart, triangleStart);
    faceEvidence(result, range); vertexStart += range.vertexCount; indexStart += range.indexCount; triangleStart += range.triangleCount;
  }
  assert.equal(vertexStart, expectedVertices); assert.equal(indexStart, mesh.indices.length); assert.equal(triangleStart, expectedTriangles);
  assert.deepEqual(mesh.vertices.map(vertex => vertex.index), Array.from({length: expectedVertices}, (_, index) => index));
  pathsEvidence(result);
  for (const range of result.shellRanges) {
    const shell = extrusion.shells.find(shell => shell.id === range.shellId); assert.ok(shell);
    assert.equal(range.componentId, shell.componentId); assert.deepEqual(range.nativeFaceIds, shell.faceIds);
    assert.deepEqual(range.nativeEdgeIds, shell.edgeIds); assert.deepEqual(range.nativeVertexIds, shell.vertexIds); assert.deepEqual(range.holeLoopIds, shell.holeLoopIds);
    assert.deepEqual(range.faceRangeIndices, result.faceRanges.flatMap((face, index) => face.shellId === shell.id ? [index] : []));
    assert.deepEqual(range.edgePathIndices, result.edgePaths.flatMap((path, index) => path.shellId === shell.id ? [index] : []));
    assert.equal(range.vertexCount, range.faceRangeIndices.reduce((sum, index) => sum + result.faceRanges[index].vertexCount, 0));
    assert.equal(range.triangleCount, range.faceRangeIndices.reduce((sum, index) => sum + result.faceRanges[index].triangleCount, 0));
    assert.equal(range.edgePathCount, shell.edgeIds.length); assert.equal(range.solid, false);
  }
  const n = extrusion.region.vertices.length;
  assert.equal(report.schema, 'barocss-native-coplanar-face-boolean-extrusion-mesh'); assert.equal(report.version, 0);
  assert.equal(report.meshId, mesh.id); assert.equal(report.lengthUnit, 'mm'); assert.equal(report.sourceFrame, 'authored-xyz-no-axis-conversion');
  assert.equal(report.uvUnits, 'dimensionless-per-face-native-parameters'); assert.equal(report.empty, n === 0);
  assert.equal(report.nativeVertexCount, n); assert.equal(report.nativeFragmentCount, extrusion.region.fragments.length);
  assert.equal(report.vertexCount, expectedVertices); assert.equal(report.expectedVertexCount, 6 * n);
  assert.equal(report.triangleCount, expectedTriangles); assert.equal(report.expectedTriangleCount, 2 * result.regionMesh.mesh.indices.length / 3 + 2 * n);
  assert.equal(report.edgePathCount, expectedPaths); assert.equal(report.expectedEdgePathCount, 3 * n);
  assert.equal(report.wrapperWork.nativeSampleCount, 16 * n); assert.equal(report.wrapperWork.surfaceD1EvaluationCount, 7 * n);
  assert.equal(report.wrapperWork.faceVertexSurfaceD1EvaluationCount, 6 * n); assert.equal(report.wrapperWork.wallCenterSurfaceD1EvaluationCount, n);
  assert.equal(report.wrapperWork.curveD1EvaluationCount, 9 * n); assert.equal(report.wrapperWork.edgePathCurveD1EvaluationCount, 9 * n);
  for (const [key, value] of Object.entries(report.regionMeshWork)) assert.equal(value, result.regionMesh.report[key]);
  assert.equal(report.quality.nativeInverseCertified, false); assert.equal(report.quality.rendererCapacityCertified, false);
  assert.equal(report.topologyCertified, false); assert.equal(report.solid, false);
  if (!n) {
    assert.deepEqual([mesh.positionsMM, mesh.normals, mesh.parametersUV, mesh.indices, mesh.vertices, result.faceRanges, result.edgePaths, result.shellRanges], [[], [], [], [], [], [], [], []]);
    assert.equal(mesh.boundsMM, null);
    assert.ok(Object.values(report.regionMeshWork).every(value => value === 0));
  } else {
    const points = mesh.vertices.map((_, index) => mesh.positionsMM.slice(3 * index, 3 * index + 3));
    assert.deepEqual(mesh.boundsMM, {min: [0, 1, 2].map(axis => Math.min(...points.map(point => point[axis]))),
      max: [0, 1, 2].map(axis => Math.max(...points.map(point => point[axis])))});
  }
  assert.deepEqual(validate(result), report);
  const stored = ownedFile(name + '.owned-extrusion-mesh', result); assert.deepEqual(validate(stored.reopened), report);
  assert.deepEqual(extrusion, before); accepted.push({result, before: structuredClone(result), file: stored.file});
  summaries.push({name, distanceMM: extrusion.options.distanceMM, vertexCount: expectedVertices, triangleCount: expectedTriangles,
    edgePaths: expectedPaths, faceRanges: result.faceRanges.length, shellRanges: result.shellRanges.length,
    wrapperWork: report.wrapperWork, regionMeshWork: report.regionMeshWork, resultFile: stored.file});
  return result;
}
ownedFile('source-api.metafile', built.metafile);
ownedFile('source-api.inputs', {entry, mode: 'in-memory-esbuild', write: false,
  cadInputs, allInputs: sourceInputs, esbuildVersion: esbuild.version});
const definitions = [['cross_union', 48, 28, 24], ['containment_hole', 48, 32, 24],
  ['strip_two_components', 48, 24, 24], ['octagons_two_chunks', 96, 56, 48],
  ['reverse_containment_empty', 0, 0, 0], ['cross_union_distance_edit', 48, 28, 24]];
const inputProvenance = [], outputs = new Map();
for (const [name, v, t, p] of definitions) {
  const file = resolve(extrusionDirectory, name + '.owned-extrusion.json'), bytes = readFileSync(file);
  retainedFiles.set(file, bytes);
  const extrusion = JSON.parse(bytes.toString('utf8'));
  assert.deepEqual(validateExtrusion(extrusion), extrusion.report);
  nativeInputs.push({extrusion, before: structuredClone(extrusion)});
  inputProvenance.push({name, file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')});
  for (const [index, source] of extrusion.sources.entries()) {
    const originalFile = resolve(extrusionDirectory, name + '.world_chunk_' + index + '.source0.css');
    const originalBytes = readFileSync(originalFile);
    assert.equal(originalBytes.toString('utf8'), source.source); retainedFiles.set(originalFile, originalBytes);
    inputProvenance.push({name: name + '.source_' + index, file: originalFile, bytes: originalBytes.length,
      sha256: createHash('sha256').update(originalBytes).digest('hex')});
    sourceFile(name + '.world_chunk_' + index, source.source, source.model);
  }
  outputs.set(name, check(name, extrusion, v, t, p));
}
ownedFile('authentic-inputs', inputProvenance);
const union = outputs.get('cross_union'), edited = outputs.get('cross_union_distance_edit'), hole = outputs.get('containment_hole');
assert.equal(union.extrusion.options.distanceMM, 2); assert.equal(edited.extrusion.options.distanceMM, 3);
assert.deepEqual(union.extrusion.region, edited.extrusion.region);
assert.notDeepEqual(union.mesh.positionsMM, edited.mesh.positionsMM);
const lowerPositions = result => result.faceRanges.filter(range => range.kind === 'bottom-cap')
  .flatMap(range => result.mesh.positionsMM.slice(3 * range.vertexStart, 3 * (range.vertexStart + range.vertexCount)));
assert.deepEqual(lowerPositions(union), lowerPositions(edited));

function intact() {
  for (const {extrusion, before} of nativeInputs) assert.deepEqual(extrusion, before);
  for (const {result, before} of accepted) assert.deepEqual(result, before);
  for (const [file, bytes] of retainedFiles) assert.deepEqual(readFileSync(file), bytes);
}
function reject(name, action, code) {
  assert.throws(action, error => {
    assert.ok(error instanceof CoplanarFaceBooleanExtrusionMeshError);
    assert.equal(error.name, 'CoplanarFaceBooleanExtrusionMeshError'); assert.equal(error.code, code);
    assert.ok(Object.values(CoplanarFaceBooleanExtrusionMeshDiagnosticCode).includes(error.code));
    assert.ok(error.message.startsWith('Coplanar Face Boolean Extrusion Mesh: '));
    failures.push({name, code: error.code, message: error.message, actualCausePreserved: Object.hasOwn(error, 'cause')});
    intact(); return true;
  });
}
for (const [name, field] of [['vertex_budget', 'maximumVertices'], ['triangle_budget', 'maximumTriangles'],
  ['path_budget', 'maximumEdgePaths'], ['native_sample_budget', 'maximumNativeSamples']]) {
  reject(name, () => tessellate(union.extrusion, {...options, [field]: 0}), 'BUDGET');
}
const collisionId = [...union.extrusion.vertices, ...union.extrusion.edges, ...union.extrusion.faces, ...union.extrusion.shells]
  .map(value => value.id).find(id => id.length <= 12);
assert.ok(collisionId);
reject('native_identity_collision', () => tessellate(union.extrusion, {...options, meshId: collisionId}), 'IDENTITY');
let getterCalls = 0;
const getter = {...options};
Object.defineProperty(getter, 'meshId', {enumerable: true, get() { getterCalls++; return 'getter_mesh'; }});
reject('input_getter', () => tessellate(union.extrusion, getter), 'INPUT'); assert.equal(getterCalls, 0);
const ownedGetter = structuredClone(union);
Object.defineProperty(ownedGetter.mesh, 'positionsMM', {enumerable: true, get() { getterCalls++; return union.mesh.positionsMM; }});
reject('owned_getter', () => validate(ownedGetter), 'OWNED'); assert.equal(getterCalls, 0);
const badParent = structuredClone(union.extrusion); badParent.sources[0].source += ' ';
reject('altered_native_parent_source', () => tessellate(badParent, options), 'INPUT');
for (const [name, base, alter] of [
  ['parent_source', union, result => result.extrusion.sources[0].source += ' '],
  ['frame', union, result => result.report.sourceFrame = 'y-up'],
  ['normal', union, result => result.mesh.normals[0] += .1],
  ['triangle', union, result => [result.mesh.indices[1], result.mesh.indices[2]] = [result.mesh.indices[2], result.mesh.indices[1]]],
  ['hole', hole, result => result.extrusion.faces.find(face => face.kind === 'bottom-cap').loops.find(loop => loop.role === 'hole').role = 'outer'],
  ['face_range', union, result => result.faceRanges[0].vertexStart++],
  ['edge_path', union, result => result.edgePaths[0].samples[0].parameter += .01],
  ['internal_role', union, result => result.faceRanges.find(range => range.internalEdges.length).internalEdges[0].kind = 'native-boundary'],
  ['native_provenance', union, result => result.mesh.vertices[0].nativeVertexId = 'unrelated_native_vertex'],
  ['work_report', union, result => result.report.wrapperWork.nativeSampleCount++],
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
const runtimeNames = ['tessellateCoplanarFaceBooleanExtrusion', 'validateCoplanarFaceBooleanExtrusionMesh',
  'CoplanarFaceBooleanExtrusionMeshError', 'CoplanarFaceBooleanExtrusionMeshDiagnosticCode'];
const typeNames = ['CoplanarFaceBooleanExtrusionMeshOptions', 'CoplanarFaceBooleanExtrusionMeshVertex', 'CoplanarFaceBooleanExtrusionMeshFaceRange',
  'CoplanarFaceBooleanExtrusionMeshEdgePath', 'CoplanarFaceBooleanExtrusionMeshShellRange', 'CoplanarFaceBooleanExtrusionMeshReport', 'CoplanarFaceBooleanExtrusionMeshResult'];
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.CoplanarFaceBooleanExtrusionMeshDiagnosticCode, CoplanarFaceBooleanExtrusionMeshDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./coplanar-face-boolean-extrusion-mesh.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/coplanar-face-boolean-extrusion-mesh.d.ts'), declaration = readFileSync(leafDeclarationPath, 'utf8');
for (const name of [...runtimeNames, ...typeNames]) assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(declaration), name);
const cold = JSON.parse(readFileSync(resolve(extrusionDirectory, 'containment_hole.owned-extrusion.json'), 'utf8'));
const compiled = publicAPI.tessellateCoplanarFaceBooleanExtrusion(cold, hole.options);
assert.deepEqual(compiled, hole); assert.deepEqual(publicAPI.validateCoplanarFaceBooleanExtrusionMesh(compiled), hole.report);
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 11,
  declarationCheck: 'actual declaration export text; no separate TypeScript invocation'};
ownedFile('compiled-consumer', compiledConsumer);
ownedFile('summary', {sourceMode: true, cadSourceInputCount: cadInputs.length, inputProvenance, summaries, failures, compiledConsumer,
  caseCount: summaries.length, refusalCount: failures.length,
  scope: 'Six authentic native extrusion files and unchanged world Source0 geometry. Actual derived cap and wall Surface D1 positions, per-face hard normals, true global edge paths with both paired face endpoints, preserved cap material connectivity, ranges and separate work counts are checked. No display-translated top, native Surface renaming, false internal CAD path, welded hard-normal faces, exact native inverse, PreviewPacket0, GPU, renderer adoption, solid or volume certificate, or old producer campaign.'});
intact();
console.log(JSON.stringify({sourceMode: true, cadSourceInputCount: cadInputs.length, inputProvenance, summaries, failures, compiledConsumer}));
