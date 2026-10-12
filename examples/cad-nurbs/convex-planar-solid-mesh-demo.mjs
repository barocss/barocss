import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, statfsSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Session } from 'node:inspector';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const [mode, directory] = process.argv.slice(2);
assert.ok(['--source', '--emitted', '--cold'].includes(mode) && directory);
assert.equal(process.versions.node, '22.23.3'); assert.ok((process.env.NODE_OPTIONS ?? '').includes('--max-old-space-size=2048'));
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(directory); mkdirSync(output, { recursive: true });
const disk = statfsSync(output); assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024);
const json = v => typeof v === 'number' && Object.is(v, -0) ? '-0' : Array.isArray(v) ? '[' + v.map(json).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ':' + json(x)).join(',') + '}' : JSON.stringify(v);
let writtenBytes = 0;
const write = (name, value) => { const text = json(value) + '\n', bytes = Buffer.byteLength(text); writtenBytes += bytes; assert.ok(bytes <= 16 * 1024 * 1024 && writtenBytes <= 128 * 1024 * 1024); writeFileSync(resolve(output, name), text); };
let failureCoverage;
process.on('uncaughtException', async error => { write(mode.slice(2) + '-first-failure-' + process.pid + '.json', { message: error.message, stack: error.stack, stage: error.stage ?? null, code: error.code ?? null, cause: error.cause?.message ?? null }); if (failureCoverage) write(mode.slice(2) + '-failed-coverage-' + process.pid + '.json', await failureCoverage()); process.exitCode = 1; });
let api;
if (mode === '--source') {
  const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
  const bundle = await require('esbuild').build({ entryPoints: [resolve(repo, 'packages/barocss-cad/src/index.ts')], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
  assert.ok(Object.keys(bundle.metafile.inputs).every(p => !p.includes('/dist/'))); write('source-inputs.json', Object.keys(bundle.metafile.inputs));
  assert.ok(bundle.outputFiles[0].contents.length <= 16 * 1024 * 1024);
  const file = resolve(output, 'mesh-source.mjs'); writeFileSync(file, bundle.outputFiles[0].text); api = await import(pathToFileURL(file));
} else api = await import(pathToFileURL(resolve(repo, 'packages/barocss-cad/dist/index.js')));
function recipe(id, coordinates, height, origin, span) {
  const points = coordinates.map((position, i) => ({ id: 'p' + i, position })), segments = points.map((p, i) => ({ id: 's' + i, startPointId: p.id, endPointId: points[(i + 1) % points.length].id }));
  return { document: { format: 'barocss-xy-affine-sketch', version: 0, profile: 'exact-affine-binary64', id: id + '_sketch', lengthUnit: 'mm', points, segments, referenceLines: [], constraints: points.map(p => ({ id: 'fix_' + p.id, kind: 'fixed', pointId: p.id, target: [...p.position] })) }, options: { sourceId: id + '_profile', sourceRevision: 0, orderedSegmentIds: segments.map(s => s.id), heightMM: height, capChart: { originXY: origin, spanXY: span }, solidId: id + '_solid', resultIdPrefix: id } };
}
const make = r => api.buildXYAffineSketchPrism(api.buildXYAffineSketch(r.document), r.options).solid;
const aRecipe = recipe('aa', [[0, 0], [32, 0], [32, 16], [16, 32], [0, 32]], 8, [0, 0], [32, 32]);
const bRecipe = recipe('bb', [[8, -16], [16, -16], [16, 48], [8, 48]], 8, [0, -16], [32, 64]);
const ref = (solid, predicate) => { const faces = solid.graph.faces.filter(f => f.vertexIds.every(id => predicate(solid.graph.vertices.find(v => v.id === id).pointMM))); assert.equal(faces.length, 1); return { sourceId: faces[0].sourceId, faceId: faces[0].faceId }; };
const settings = (solid, x0, x1) => ({ operationId: 'remove_slab', first: { toolFace: ref(solid, p => p[0] === x0), solidId: 'left_part', resultIdPrefix: 'left' }, second: { toolFace: ref(solid, p => p[0] === x1), solidId: 'right_part', resultIdPrefix: 'right' } });
const inspector = new Session(); inspector.connect();
const post = (method, params = {}) => new Promise((ok, no) => inspector.post(method, params, (e, r) => e ? no(e) : ok(r)));
await post('Profiler.enable'); await post('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
const names = ['validateConvexPlanarSolid', 'buildConvexPlanarFace', 'evaluateCurveD1', 'evaluateSurfaceD1', 'tessellateConvexPlanarSolid', 'validateConvexPlanarSolidMesh'];
const receipts = [];
const checkpoint = async label => { const data = await post('Profiler.takePreciseCoverage'); const counts = Object.fromEntries(names.map(name => [name, data.result.flatMap(s => s.functions.filter(f => f.functionName === name)).reduce((sum, f) => sum + f.ranges[0].count, 0)])); receipts.push({ label, counts }); return counts; };
failureCoverage = () => post('Profiler.takePreciseCoverage');
const read = name => JSON.parse(readFileSync(resolve(output, name), 'utf8'));
let parents;
if (mode === '--source') {
  const a = make(aRecipe), b = make(bRecipe), subtraction = api.subtractConvexPlanarSlab(a, b, settings(b, 8, 16));
  assert.equal(subtraction.first.outcome.kind, 'solid'); assert.equal(subtraction.second.outcome.kind, 'solid');
  parents = [a, subtraction.first.outcome.solid, subtraction.second.outcome.solid]; write('parents.json', parents);
} else parents = read('parents.json');
await checkpoint('parent-fixtures');
const expectedAreas = [1792 + (96 + Math.sqrt(512)) * 8, 1152, 768 + (64 + Math.sqrt(512)) * 8];
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0), sub = (a, b) => a.map((v, i) => v - b[i]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function prove(result, caseIndex) {
  const { mesh, boundaries, internalDiagonals, solid } = result;
  assert.equal(mesh.vertices.length, mesh.positionsMM.length / 3); assert.equal(mesh.vertices.length, mesh.parametersUV.length / 2);
  const xyz = i => mesh.positionsMM.slice(i * 3, i * 3 + 3), uv = i => mesh.parametersUV.slice(i * 2, i * 2 + 2);
  let area = 0; const incidence = new Map();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const triangle = mesh.indices.slice(i, i + 3), points = triangle.map(xyz), vector = cross(sub(points[1], points[0]), sub(points[2], points[0]));
    area += Math.hypot(...vector) / 2;
    for (const index of triangle) assert.ok(dot(vector, mesh.normals.slice(3 * index, 3 * index + 3)) > 0);
    const faceIndex = mesh.faces.findIndex(f => i >= f.indexOffset && i < f.indexOffset + f.indexCount), face = mesh.faces[faceIndex]; assert.ok(faceIndex >= 0);
    // Each actual triangle vertex is inside every original directed UV trim halfspace.
    const sense = face.orientation === 'forward' ? 1 : -1;
    for (let j = 0; j < face.vertexCount; j++) {
      const a = uv(face.vertexOffset + j), b = uv(face.vertexOffset + (j + 1) % face.vertexCount);
      for (const index of triangle) { const c = uv(index); assert.ok(sense * ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) >= 0); }
    }
    for (let j = 0; j < 3; j++) { const pair = [triangle[j], triangle[(j + 1) % 3]], key = [...pair].sort((a, b) => a - b).join(':'); incidence.set(key, [...(incidence.get(key) ?? []), pair]); }
  }
  assert.ok(Math.abs(area - expectedAreas[caseIndex]) < 1e-9);
  for (const boundary of boundaries) {
    const [a, b] = boundary.vertexIndices, key = [a, b].sort((a, b) => a - b).join(':'); assert.deepEqual(incidence.get(key), [[a, b]]); incidence.delete(key);
    const face = solid.request.assets.find(a => a.sourceId === boundary.sourceId).face, use = face.topology.loop.uses.find(u => u.id === boundary.useId);
    const pc = face.pcurves.find(p => p.id === use.pcurveId);
    assert.deepEqual(uv(a), pc.curve.controlPoints[use.sense === 'forward' ? 0 : 1].slice(0, 2));
    assert.deepEqual(boundary.nativeVertexIds, use.vertexIds); assert.deepEqual(boundary.interval, use.interval);
    for (let j = 0; j < 2; j++) assert.deepEqual(xyz(boundary.vertexIndices[j]), face.topology.vertices.find(v => v.id === use.vertexIds[j]).point);
  }
  assert.equal(incidence.size, internalDiagonals.length);
  for (const diagonal of internalDiagonals) { const key = [...diagonal.vertexIndices].sort((a, b) => a - b).join(':'); const uses = incidence.get(key); assert.equal(uses.length, 2); assert.deepEqual(uses[0], [...uses[1]].reverse()); assert.equal(diagonal.role, 'display-internal-not-brep-edge'); }
  assert.ok(mesh.faces.some(f => f.orientation === 'reverse')); assert.ok(mesh.faces.some(f => f.orientation === 'forward'));
  assert.equal(boundaries.length, solid.graph.edges.length * 2);
  for (const edge of solid.graph.edges) { const pair = boundaries.filter(b => b.solidEdgeId === edge.id); assert.equal(pair.length, 2); assert.deepEqual(pair[0].solidVertexIds, [...pair[1].solidVertexIds].reverse()); }
}
const nativeCounts = (counts, parent) => { const uses = parent.graph.faces.reduce((n, f) => n + f.vertexIds.length, 0); assert.equal(counts.validateConvexPlanarSolid, 1); assert.equal(counts.buildConvexPlanarFace, parent.graph.faces.length); assert.equal(counts.evaluateCurveD1, uses * 6); assert.equal(counts.evaluateSurfaceD1, uses * 3); };
const results = [];
for (const [i, parent] of parents.entries()) {
  const before = structuredClone(parent);
  const result = mode === '--cold' ? read('source-result-' + i + '.json') : api.tessellateConvexPlanarSolid(parent, { maximumFanTriangles: 40 });
  if (mode !== '--cold') { const counts = await checkpoint('tessellate-' + i); nativeCounts(counts, parent); }
  prove(result, i); assert.deepEqual(api.validateConvexPlanarSolidMesh(result), result.report);
  const counts = await checkpoint('validate-' + i); nativeCounts(counts, parent);
  assert.deepEqual(parent, before); assert.notEqual(result.solid, parent); results.push(result);
  if (mode === '--source') write('source-result-' + i + '.json', result);
  else assert.deepEqual(result, read('source-result-' + i + '.json'));
}
const baseline = results[0], failures = [];
const refuse = async (label, action, code, nativeCount) => { assert.throws(action, error => { failures.push({ label, code: error.code }); return error.name === 'ConvexPlanarSolidMeshError' && error.code === code; }); const counts = await checkpoint(label); assert.equal(counts.validateConvexPlanarSolid, nativeCount); if (nativeCount === 0) for (const name of ['buildConvexPlanarFace', 'evaluateCurveD1', 'evaluateSurfaceD1']) assert.equal(counts[name], 0); };
await refuse('caller-budget', () => api.tessellateConvexPlanarSolid(parents[0], { maximumFanTriangles: 1 }), 'BUDGET', 0);
for (const [label, mutate, code] of [
  ['oversized-vertices', p => { while (p.graph.vertices.length <= 32) p.graph.vertices.push(p.graph.vertices[0]); }, 'BUDGET'],
  ['oversized-edges', p => { while (p.graph.edges.length <= 32) p.graph.edges.push(p.graph.edges[0]); }, 'BUDGET'],
  ['facet-edge-inventory', p => { p.graph.faces[0].edgeIds.pop(); }, 'BINDING'],
  ['request-asset-inventory', p => { p.request.assets.pop(); }, 'BINDING'],
  ['request-pair-inventory', p => { p.request.edgePairs.pop(); }, 'BINDING'],
]) { const changed = structuredClone(parents[0]); mutate(changed); await refuse(label, () => api.tessellateConvexPlanarSolid(changed, { maximumFanTriangles: 40 }), code, 0); }
let getters = 0; const getter = {}; Object.defineProperty(getter, 'solid', { enumerable: true, get() { getters++; return parents[0]; } });
await refuse('getter', () => api.validateConvexPlanarSolidMesh(getter), 'INPUT', 0); assert.equal(getters, 0);
for (const [label, mutate] of [
  ['position', r => { r.mesh.positionsMM[0] += 1; }], ['uv', r => { r.mesh.parametersUV[0] += 0.25; }],
  ['winding', r => { [r.mesh.indices[0], r.mesh.indices[1]] = [r.mesh.indices[1], r.mesh.indices[0]]; }],
  ['normal', r => { r.mesh.normals[2] *= -1; }], ['boundary', r => { r.boundaries[0].solidEdgeId = 'forged'; }],
  ['vertex-identity', r => { r.mesh.vertices[0].nativeVertexId = 'forged'; }], ['report', r => { r.report.triangleCount++; }],
]) { const changed = structuredClone(baseline); mutate(changed); await refuse(label, () => api.validateConvexPlanarSolidMesh(changed), 'OWNED', 1); }
const parentForgery = structuredClone(parents[0]); parentForgery.graph.faces[0].sourceId = 'forged';
await refuse('parent-identity', () => api.tessellateConvexPlanarSolid(parentForgery, { maximumFanTriangles: 40 }), 'PARENT', 1);
const copied = structuredClone(baseline); copied.mesh.positionsMM[0] = 12345; assert.notEqual(copied.mesh.positionsMM[0], parents[0].graph.vertices[0].pointMM[0]);
assert.deepEqual(baseline, read('source-result-0.json'));
write(mode.slice(2) + '-observations.json', { cases: results.map(r => ({ solidId: r.report.solidId, vertices: r.report.vertexCount, triangles: r.report.triangleCount, boundaries: r.boundaries.length, diagonals: r.internalDiagonals.length })), failures, getters, receipts, physicalGPU: 'unrun', displayFloat32: 'not-certified' });
await post('Profiler.stopPreciseCoverage'); inspector.disconnect(); console.log('Qualified convex solid mesh: ' + mode + ' passed');
