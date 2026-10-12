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
const write = (name, value) => writeFileSync(resolve(output, name), json(value) + '\n');
let failureCoverage;
process.on('uncaughtException', async error => { write(mode.slice(2) + '-first-failure-' + process.pid + '.json', { message: error.message, stack: error.stack, stage: error.stage ?? null, code: error.code ?? null, cause: error.cause?.message ?? null }); if (failureCoverage) write(mode.slice(2) + '-failed-coverage-' + process.pid + '.json', await failureCoverage()); process.exitCode = 1; });
let api;
if (mode === '--source') {
  const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
  const bundle = await require('esbuild').build({ entryPoints: [resolve(repo, 'packages/barocss-cad/src/index.ts')], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
  assert.ok(Object.keys(bundle.metafile.inputs).every(p => !p.includes('/dist/'))); write('source-inputs.json', Object.keys(bundle.metafile.inputs));
  const file = resolve(output, 'intersection-source.mjs'); writeFileSync(file, bundle.outputFiles[0].text); api = await import(pathToFileURL(file));
} else api = await import(pathToFileURL(resolve(repo, 'packages/barocss-cad/dist/index.js')));
const inspector = new Session(); inspector.connect();
const post = (method, params = {}) => new Promise((ok, no) => inspector.post(method, params, (error, value) => error ? no(error) : ok(value)));
await post('Profiler.enable'); await post('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
failureCoverage = async () => { const value = await post('Profiler.takePreciseCoverage'); await post('Profiler.stopPreciseCoverage'); inspector.disconnect(); return value; };
const options = { operationId: 'common_material', solidId: 'common_part', resultIdPrefix: 'common' };
function recipe(id, coordinates, height, origin, span) {
  const points = coordinates.map((position, i) => ({ id: 'p' + i, position })), segments = points.map((p, i) => ({ id: 's' + i, startPointId: p.id, endPointId: points[(i + 1) % points.length].id }));
  return { document: { format: 'barocss-xy-affine-sketch', version: 0, profile: 'exact-affine-binary64', id: id + '_sketch', lengthUnit: 'mm', points, segments, referenceLines: [], constraints: points.map(p => ({ id: 'fix_' + p.id, kind: 'fixed', pointId: p.id, target: [...p.position] })) }, options: { sourceId: id + '_profile', sourceRevision: 0, orderedSegmentIds: segments.map(s => s.id), heightMM: height, capChart: { originXY: origin, spanXY: span }, solidId: id + '_solid', resultIdPrefix: id } };
}
const make = r => api.buildXYAffineSketchPrism(api.buildXYAffineSketch(r.document), r.options).solid;
const aRecipe = recipe('aa', [[0, 0], [32, 0], [32, 16], [16, 32], [0, 32]], 8, [0, 0], [32, 32]);
const bRecipe = recipe('bb', [[8, -8], [40, -8], [40, 24], [8, 24]], 4, [0, -8], [64, 32]);
const editedRecipe = structuredClone(bRecipe); editedRecipe.document.constraints.forEach(c => { c.target[0] += 8; }); editedRecipe.options.sourceRevision++;
const volume = (result, n) => { assert.equal(result.outcome.kind, 'solid'); assert.deepEqual(result.outcome.solid.certificate.volumeMM3, { numerator: String(n), denominator: '1' }); };
let attempts = 0, validations = 0;
const intersect = (a, b, o = options) => { attempts++; return api.intersectConvexPlanarSolids(a, b, o); };
const validate = result => { validations++; return api.validateConvexPlanarSolidIntersection(result); };
const controls = [], failures = [];
let result, edited;
if (mode === '--cold') {
  const saved = JSON.parse(readFileSync(resolve(output, 'recipes.json'), 'utf8'));
  const a = make(saved.left), b = make(saved.right); result = intersect(a, b, saved.operation); volume(result, 2176);
  const edit = structuredClone(saved.right); edit.document.constraints.forEach(c => { c.target[0] += 8; }); edit.options.sourceRevision++;
  edited = intersect(a, make(edit), saved.operation); volume(edited, 1408);
  assert.deepEqual(result, JSON.parse(readFileSync(resolve(output, 'source-result.json'), 'utf8')));
  assert.deepEqual(edited, JSON.parse(readFileSync(resolve(output, 'source-edited.json'), 'utf8')));
} else {
  const a = make(aRecipe), b = make(bRecipe), beforeA = structuredClone(a), beforeB = structuredClone(b);
  assert.deepEqual(a.certificate.volumeMM3, { numerator: '7168', denominator: '1' }); assert.deepEqual(b.certificate.volumeMM3, { numerator: '4096', denominator: '1' });
  result = intersect(a, b); volume(result, 2176); const saved = structuredClone(result);
  assert.deepEqual([result.outcome.solid.graph.faces.length, result.outcome.solid.graph.edges.length, result.outcome.solid.graph.vertices.length], [7, 15, 10]);
  assert.deepEqual(validate(result), result.report);
  const bottom = result.lineage.faces.filter(f => f.sources.length === 2); assert.equal(bottom.length, 1); assert.deepEqual(bottom[0].sources.map(s => s.operand), ['left', 'right']);
  for (const face of result.lineage.faces) {
    const source = face.sources[0], parent = source.operand === 'left' ? a : b;
    assert.deepEqual(result.outcome.solid.request.assets.find(x => x.sourceId === face.output.sourceId).face.plane, parent.request.assets.find(x => x.sourceId === source.sourceId).face.plane);
  }
  edited = intersect(a, make(editedRecipe)); volume(edited, 1408);
  volume(intersect(b, a), 2176); volume(intersect(a, a), 7168);
  const box = (id, x0, y0, x1, y1, height = 4, span = [64, 64]) => make(recipe(id, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], height, [x0, y0], span));
  volume(intersect(a, box('inside', 8, 8, 16, 16)), 256);
  for (const [name, other, dimension] of [
    ['disjoint', box('apart', 64, 0, 72, 8), -1],
    ['face_contact', box('touchface', 32, 0, 40, 8), 2],
    ['edge_contact', box('touchedge', 32, 16, 40, 24), 1],
  ]) { const contact = intersect(a, other); assert.equal(contact.outcome.kind, 'empty'); assert.equal(contact.contact.dimension, dimension); controls.push({ name, report: contact.report }); if (name === 'edge_contact') controls.push({ edgeFixture: other }); }
  // Re-author complete native Faces from the admitted recipe, not mutate cached Solid data.
  function reauthor(solid, dz, domain) {
    const assets = solid.request.assets.map(asset => {
      const f = asset.face, plane = structuredClone(f.plane); plane.controlPoints.forEach(row => row.forEach(p => { p[2] += dz; }));
      const edges = f.loop.edges.map(c => { const line = structuredClone(c); line.controlPoints.forEach(p => { p[2] += dz; }); if (domain) line.knots = [domain[0], domain[0], domain[1], domain[1]]; return line; });
      return { sourceId: asset.sourceId, face: api.buildConvexPlanarFace(plane, { id: f.loop.id, edges }, f.options) };
    });
    return api.qualifyConvexPlanarSolid(assets, solid.request.edgePairs, solid.request.options);
  }
  const edgeFixture = controls.find(c => c.edgeFixture).edgeFixture; controls.splice(controls.findIndex(c => c.edgeFixture), 1);
  const vertex = intersect(a, reauthor(edgeFixture, 8)); assert.equal(vertex.outcome.kind, 'empty'); assert.equal(vertex.contact.dimension, 0); controls.push({ name: 'vertex_contact', report: vertex.report });
  const rect = box('rect', 0, 0, 32, 32, 8, [32, 32]);
  const sloped = make(recipe('sloped', [[8, -8], [56, -8], [56, 8], [8, 24]], 4, [0, -8], [64, 32]));
  const temporary = intersect(rect, sloped); volume(temporary, 1920); assert.ok(temporary.report.clipWork.temporaryNonDyadicCrossings > 0); controls.push({ name: 'removed_temporary_non_dyadic', report: temporary.report });
  const remapped = intersect(reauthor(a, 0, [2, 6]), b); volume(remapped, 2176);
  const originalEdges = remapped.lineage.faces.flatMap(f => f.edges.flatMap(e => e.originalEdges)).filter(e => e.operand === 'left');
  assert.ok(originalEdges.length > 0); assert.ok(originalEdges.every(e => e.domain[0] === 2 && e.domain[1] === 6));
  assert.ok(originalEdges.some(e => BigInt(e.sourceInterval[0].numerator) * BigInt(e.sourceInterval[1].denominator) > BigInt(e.sourceInterval[1].numerator) * BigInt(e.sourceInterval[0].denominator)));
  controls.push({ name: 'nonunit_directed_original_domains', originalEdges }); write(mode.slice(2) + '-remapped.json', remapped);
  function reject(name, action, code, stage) {
    assert.throws(action, error => { assert.ok(error instanceof api.ConvexPlanarSolidIntersectionError, String(error)); if (code) assert.equal(error.code, code); if (stage) assert.equal(error.stage, stage); failures.push({ name, code: error.code, stage: error.stage, entity: error.entity, cause: error.cause?.message ?? null }); return true; });
    assert.deepEqual(result, saved); assert.deepEqual(a, beforeA); assert.deepEqual(b, beforeB);
  }
  const narrow = box('narrow', 0, 0, 24, 32, 8, [32, 32]); reject('final_non_dyadic_xyz', () => intersect(narrow, sloped), 'REPRESENTABILITY', 'final-representability');
  const uv = box('uv', 0, 0, 60, 32, 8, [60, 32]); reject('final_nonexact_uv_lift', () => intersect(uv, b), 'BINDING', 'output-qualification');
  const stale = structuredClone(a); stale.request.assets[0].face.source += ' '; reject('stale_source', () => intersect(stale, b), 'OWNED', 'parent-reconstruction');
  const forged = structuredClone(a); forged.certificate.volumeMM3.numerator = '1'; reject('forged_certificate', () => intersect(forged, b), 'OWNED', 'parent-reconstruction');
  reject('identity_collision', () => intersect(a, b, { ...options, solidId: options.operationId }), 'IDENTITY');
  let getters = 0; const hostile = { ...options }; Object.defineProperty(hostile, 'solidId', { enumerable: true, get() { getters++; return 'bad'; } }); reject('hostile_descriptor', () => intersect(a, b, hostile), 'INPUT'); assert.equal(getters, 0);
  reject('snapshot_budget', () => intersect(a, b, { ...options, extra: Array(4097).fill(0) }), 'BUDGET');
  const forgedResult = structuredClone(result); forgedResult.lineage.faces[0].sources[0].sourceId = 'forged'; reject('forged_result_lineage', () => validate(forgedResult), 'OWNED');
  assert.equal(attempts, 18); assert.equal(validations, 2);
  write(mode.slice(2) + '-result.json', result); write(mode.slice(2) + '-edited.json', edited); write(mode.slice(2) + '-controls.json', { controls, failures });
  if (mode === '--source') write('recipes.json', { left: aRecipe, right: bRecipe, operation: options });
  else { assert.deepEqual(result, JSON.parse(readFileSync(resolve(output, 'source-result.json'), 'utf8'))); assert.deepEqual(edited, JSON.parse(readFileSync(resolve(output, 'source-edited.json'), 'utf8'))); }
}
const coverage = await post('Profiler.takePreciseCoverage'); await post('Profiler.stopPreciseCoverage'); inspector.disconnect(); failureCoverage = null; write(mode.slice(2) + '-coverage.json', coverage);
const names = ['buildXYAffineSketchPrism', 'compileCadModel', 'buildConvexPlanarFace', 'evaluateCurveD1', 'evaluateSurfaceD1', 'qualifyConvexPlanarSolid', 'validateConvexPlanarSolid', 'intersectConvexPlanarSolids', 'validateConvexPlanarSolidIntersection'];
const counts = Object.fromEntries(names.map(name => [name, coverage.result.flatMap(s => s.functions.filter(f => f.functionName === name)).reduce((n, f) => n + f.ranges[0].count, 0)]));
assert.equal(counts.intersectConvexPlanarSolids, mode === '--cold' ? 2 : 18); assert.equal(counts.validateConvexPlanarSolidIntersection, mode === '--cold' ? 0 : 2);
assert.equal(counts.buildXYAffineSketchPrism, mode === '--cold' ? 3 : 11);
assert.ok(counts.buildConvexPlanarFace <= (mode === '--cold' ? 134 : 1120)); assert.ok(counts.compileCadModel <= (mode === '--cold' ? 140 : 1142)); assert.ok(counts.evaluateCurveD1 + counts.evaluateSurfaceD1 <= (mode === '--cold' ? 7344 : 57600));
const summary = { status: 'passed', mode, pid: process.pid, counts, attempts, validations, volume: result.outcome.solid.certificate.volumeMM3, editedVolume: edited.outcome.solid.certificate.volumeMM3, native: result.report.nativeWork, exact: result.report.exactWork, clip: result.report.clipWork, controls: controls.map(c => c.name), refusals: failures.map(f => f.name) };
write(mode.slice(2) + '-summary.json', summary); process.stdout.write(JSON.stringify(summary) + '\n');
