import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const [mode, directory] = process.argv.slice(2);
assert.ok(['--source', '--emitted', '--cold'].includes(mode) && directory, 'Usage: node convex-planar-solid-demo.mjs --source|--emitted|--cold output-directory');
assert.equal(Number(process.versions.node.split('.')[0]), 22);
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(directory);
mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
let api;
if (mode === '--source') {
  const built = await require('esbuild').build({ entryPoints: [resolve(repo, 'packages/barocss-cad/src/index.ts')], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
  assert.ok(Object.keys(built.metafile.inputs).every(p => !p.includes('/dist/')));
  const target = resolve(output, 'convex-source.mjs'); writeFileSync(target, built.outputFiles[0].text); api = await import(pathToFileURL(target));
} else api = await import(pathToFileURL(resolve(repo, 'packages/barocss-cad/dist/index.js')));
const { buildConvexPlanarFace, qualifyConvexPlanarSolid: qualify, validateConvexPlanarSolid: validate, classifyConvexPlanarSolidPoints: classify, ConvexPlanarSolidError } = api;
// JSON permits numeric -0; ordinary JSON.stringify would erase original native sign bits.
const nativeJSON = value => typeof value === 'number' && Object.is(value, -0) ? '-0' : Array.isArray(value) ? '[' + value.map(nativeJSON).join(',') + ']' : value && typeof value === 'object' ? '{' + Object.entries(value).map(([key, item]) => JSON.stringify(key) + ':' + nativeJSON(item)).join(',') + '}' : JSON.stringify(value);
const write = (name, data) => writeFileSync(resolve(output, name), nativeJSON(data) + '\n');
const options = { solidId: 'beveled_part', resultIdPrefix: 'part' }, queryOptions = { maximumHalfspacePredicates: 768 };
if (mode === '--cold') {
  const saved = JSON.parse(readFileSync(resolve(output, 'source-result.json'), 'utf8'));
  assert.deepEqual(validate(saved), saved.report);
  const batch = classify(saved, [[20, 10, 5], [20, 18, 8], [40, 20, 6], [20, 20, 10]], queryOptions);
  assert.deepEqual(batch.points.map(p => p.classification), ['inside', 'boundary', 'boundary', 'outside']);
  assert.equal(batch.points[2].incidentFaces.length, 3);
  write('cold-summary.json', { pid: process.pid, volume: saved.certificate.volumeMM3, native: batch.reconstructionWork, exact: batch.exactWorkIncludingReconstruction });
  process.stdout.write(JSON.stringify({ mode, status: 'passed', pid: process.pid }) + '\n'); process.exit(0);
}
const plus = (a, b) => a.map((v, i) => v + b[i]);
function face(id, origin, u, v, points, orientation = 'forward', domain = [2, 6]) {
  const plane = { kind: 'surface', id: id + '_s', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[origin, plus(origin, v)], [plus(origin, u), plus(plus(origin, u), v)]], weights: [[1, 1], [1, 1]] };
  const edges = points.map((p, i) => ({ kind: 'curve', id: id + '_c' + i, degree: 1, knots: [domain[0], domain[0], domain[1], domain[1]], controlPoints: [p, points[(i + 1) % points.length]], weights: [1, 1] }));
  return buildConvexPlanarFace(plane, { id: id + '_l', edges }, { faceId: id + '_f', evaluationId: id + '_m', resultIdPrefix: id, orientation });
}
// Authoring topology uses named vertex labels, not coordinate hashes or tolerance-derived identity.
function assemble(recipes) {
  const assets = recipes.map(row => ({ sourceId: row.id, face: face(row.id, row.origin, row.u, row.v, row.points, row.orientation, row.domain) }));
  const authoredEdges = [];
  for (const [i, row] of recipes.entries()) for (const use of assets[i].face.topology.loop.uses) {
    const index = Number(use.curveId.slice((row.id + '_c').length)), names = [row.names[index], row.names[(index + 1) % row.names.length]];
    authoredEdges.push({ names, ref: { sourceId: row.id, useId: use.id } });
  }
  const consumed = new Set(), edgePairs = [];
  for (let i = 0; i < authoredEdges.length; i++) if (!consumed.has(i)) {
    const edge = authoredEdges[i], j = authoredEdges.findIndex((candidate, k) => k !== i && !consumed.has(k) && candidate.names.every(n => edge.names.includes(n)));
    assert.ok(j >= 0, 'Recipe declares every shared edge'); consumed.add(i); consumed.add(j); edgePairs.push({ a: edge.ref, b: authoredEdges[j].ref });
  }
  return { assets, edgePairs };
}
function bevel(depth = 4, chartX = 64, split = false) {
  const y = 20 - depth, z = 10 - depth;
  const p = { A: [0, 0, 0], B: [40, 0, 0], C: [40, 20, 0], D: [0, 20, 0], E: [0, 0, 10], F: [40, 0, 10], G: [40, y, 10], H: [0, y, 10], I: [40, 20, z], J: [0, 20, z] };
  const rows = [
    ['bottom', [0, 0, 0], [chartX, 0, 0], [0, 32, 0], ['A', 'D', 'C', 'B'], 'reverse'],
    ['front', [0, 0, 0], [64, 0, 0], [0, 0, 16], ['A', 'B', 'F', 'E'], 'forward'],
    ['back', [0, 20, 0], [64, 0, 0], [0, 0, 16], ['D', 'J', 'I', 'C'], 'reverse'],
    ['top', [0, 0, 10], [64, 0, 0], [0, 32, 0], ['E', 'F', 'G', 'H'], 'forward'],
    ['bevel', [0, y, 10], [64, 0, 0], [0, 8, -8], ['H', 'G', 'I', 'J'], 'forward'],
    ['left', [0, 0, 0], [0, 32, 0], [0, 0, 16], ['A', 'E', 'H', 'J', 'D'], 'reverse'],
    ['right', [40, 0, 0], [0, 32, 0], [0, 0, 16], ['B', 'C', 'I', 'G', 'F'], 'forward'],
  ];
  if (split) rows.splice(0, 1, ['bottom_a', [0, 0, 0], [64, 0, 0], [0, 32, 0], ['A', 'D', 'C'], 'reverse'], ['bottom_b', [0, 0, 0], [64, 0, 0], [0, 32, 0], ['A', 'C', 'B'], 'reverse']);
  return assemble(rows.map(([id, origin, u, v, names, orientation], i) => ({ id, origin, u, v, names, orientation, points: names.map(n => p[n]), domain: i % 2 ? [-4, 8] : [2, 6] })));
}
const request = bevel(), before = structuredClone(request), result = qualify(request.assets, request.edgePairs, options);
assert.deepEqual(request, before); assert.deepEqual(result.request.assets, before.assets);
assert.equal(result.graph.faces.length, 7); assert.equal(result.graph.edges.length, 15); assert.equal(result.graph.vertices.length, 10);
assert.deepEqual(result.certificate.volumeMM3, { numerator: '7680', denominator: '1' });
assert.ok(result.request.assets.every(a => a.face.report.solid === false));
assert.deepEqual(validate(result), result.report);
const batch = classify(result, [[20, 10, 5], [20, 18, 8], [40, 20, 6], [20, 20, 10], [0, 0, 0], [20, 16, 10]], queryOptions);
assert.deepEqual(batch.points.map(p => p.classification), ['inside', 'boundary', 'boundary', 'outside', 'boundary', 'boundary']);
assert.deepEqual(batch.points.map(p => p.incidentFaces.length), [0, 1, 3, 0, 3, 2]);
assert.equal(batch.reconstructionWork.completeFaceReconstructionCount, 7);
const edited = bevel(2), editedResult = qualify(edited.assets, edited.edgePairs, options);
assert.deepEqual(editedResult.certificate.volumeMM3, { numerator: '7920', denominator: '1' });
const failures = [], saved = structuredClone(result);
function reject(name, action, code) { assert.throws(action, error => { assert.ok(error instanceof ConvexPlanarSolidError, String(error)); if (code) assert.equal(error.code, code); failures.push({ name, code: error.code, message: error.message }); return true; }); assert.deepEqual(result, saved); assert.deepEqual(request, before); }
reject('missing_pair', () => qualify(request.assets, request.edgePairs.slice(1), options), 'COVERAGE');
reject('repeated_pair', () => qualify(request.assets, [request.edgePairs[0], ...request.edgePairs.slice(0, -1)], options), 'COVERAGE');
const reversed = structuredClone(request); { const a = reversed.assets[0], f = a.face; a.face = buildConvexPlanarFace(f.plane, f.loop, { ...f.options, orientation: 'forward' }); }
reject('reversed_outward_face', () => qualify(reversed.assets, reversed.edgePairs, options), 'BINDING');
const inexact = bevel(4, 60); assert.ok(inexact.assets[0].face.bindings.every(b => b.pointDifferenceMM <= 1e-7));
reject('genuine_parent_nonexact_stored_lift', () => qualify(inexact.assets, inexact.edgePairs, options), 'BINDING');
const forged = structuredClone(result); forged.certificate.volumeMM3.numerator = '8000';
reject('forged_certificate', () => validate(forged), 'OWNED');
const source = structuredClone(request); source.assets[0].face.source += ' ';
reject('forged_complete_source', () => qualify(source.assets, source.edgePairs, options), 'OWNED');
let getterCalls = 0; const getter = {}; Object.defineProperty(getter, 'sourceId', { enumerable: true, get() { getterCalls++; return 'bottom'; } });
reject('descriptor_getter', () => qualify([getter, ...request.assets.slice(1)], request.edgePairs, options), 'INPUT'); assert.equal(getterCalls, 0);
reject('query_predicate_budget_preflight', () => classify(result, [[0, 0, 0]], { maximumHalfspacePredicates: 6 }), 'BUDGET');
reject('query_count_budget', () => classify(result, Array.from({ length: 65 }, () => [0, 0, 0]), queryOptions), 'BUDGET');
reject('array_snapshot_budget', () => qualify(Array.from({ length: 4097 }, () => request.assets[0]), request.edgePairs, options), 'BUDGET');
const wrongPair = structuredClone(request); [wrongPair.edgePairs[0].b, wrongPair.edgePairs[1].b] = [wrongPair.edgePairs[1].b, wrongPair.edgePairs[0].b];
reject('incorrect_explicit_sewing', () => qualify(wrongPair.assets, wrongPair.edgePairs, options));
// Additional bounded topology controls use complete triangle producers.
const minus = (a, b) => a.map((v, i) => v - b[i]);
function triangles(prefix, coordinates, facets) {
  return facets.map((names, i) => { const points = names.map(n => coordinates[n]); return { id: prefix + i, origin: points[0], u: minus(points[1], points[0]), v: minus(points[2], points[0]), names: names.map(n => prefix + n), points, orientation: 'forward' }; });
}
const tetraFacets = [['A', 'C', 'B'], ['A', 'B', 'D'], ['B', 'C', 'D'], ['C', 'A', 'D']];
const tetra = { A: [0, 0, 0], B: [1, 0, 0], C: [0, 1, 0], D: [0, 0, 1] };
const disjoint = assemble([...triangles('first', tetra, tetraFacets), ...triangles('second', Object.fromEntries(Object.entries(tetra).map(([k, p]) => [k, plus(p, [4, 0, 0])])), tetraFacets)]);
reject('disconnected_closed_assemblies', () => qualify(disjoint.assets, disjoint.edgePairs, options), 'INCIDENCE');
const touching = assemble([...triangles('first', tetra, tetraFacets), ...triangles('second', Object.fromEntries(Object.entries(tetra).map(([k, p]) => [k, p.map(v => -v)])), tetraFacets.map(f => [...f].reverse()))]);
reject('pinched_point_unpaired_coincidence', () => qualify(touching.assets, touching.edgePairs, options), 'INCIDENCE');
const flat = assemble(triangles('flat', { ...tetra, D: [.25, .25, 0] }, tetraFacets));
reject('zero_volume_rank_two', () => qualify(flat.assets, flat.edgePairs, options), 'DEGENERATE');
const splitFacet = bevel(4, 64, true);
reject('coplanar_facet_subdivision', () => qualify(splitFacet.assets, splitFacet.edgePairs, options), 'CONVEXITY');
const octa = { T: [0, 0, -.5], D: [0, 0, -1], E: [1, 0, 0], N: [0, 1, 0], W: [-1, 0, 0], S: [0, -1, 0] };
const concave = assemble(triangles('dent', octa, [['T', 'E', 'N'], ['T', 'N', 'W'], ['T', 'W', 'S'], ['T', 'S', 'E'], ['D', 'N', 'E'], ['D', 'W', 'N'], ['D', 'S', 'W'], ['D', 'E', 'S']]));
reject('concave_dented_assembly', () => qualify(concave.assets, concave.edgePairs, options), 'CONVEXITY');
assert.deepEqual(result, saved); // Failed modeled edits leave the earlier qualified part intact.

write(mode === '--source' ? 'source-result.json' : 'emitted-result.json', result);
if (mode === '--emitted') assert.deepEqual(JSON.parse(readFileSync(resolve(output, 'source-result.json'), 'utf8')), result);
write(mode.slice(2) + '-summary.json', { pid: process.pid, volume: result.certificate.volumeMM3, editedVolume: editedResult.certificate.volumeMM3, native: result.report.childNativeWork, exact: result.report.exactWork, queries: batch, failures });
process.stdout.write(JSON.stringify({ mode, status: 'passed', native: result.report.childNativeWork, exact: result.report.exactWork, failures: failures.length }) + '\n');
