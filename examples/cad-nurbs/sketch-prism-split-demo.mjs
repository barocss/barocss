import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, statfsSync, writeFileSync } from 'node:fs';
import { Session } from 'node:inspector';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// #1593: one emitted integration, not another parent acceptance/performance campaign.
const [mode, directory] = process.argv.slice(2);
assert.ok(mode === '--emitted' && directory, 'Usage: node sketch-prism-split-demo.mjs --emitted output-directory');
assert.equal(process.versions.node, '22.23.3');
assert.ok((process.env.NODE_OPTIONS ?? '').includes('--max-old-space-size=2048'));
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(directory);
mkdirSync(output, { recursive: true });
const disk = statfsSync(output);
assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024, '500 MiB free-disk admission floor');
const nativeJSON = value => typeof value === 'number' && Object.is(value, -0) ? '-0' : Array.isArray(value) ? '[' + value.map(nativeJSON).join(',') + ']' : value && typeof value === 'object' ? '{' + Object.entries(value).map(([key, item]) => JSON.stringify(key) + ':' + nativeJSON(item)).join(',') + '}' : JSON.stringify(value);
const write = (name, value) => writeFileSync(resolve(output, name), nativeJSON(value) + '\n');
process.on('uncaughtException', error => { write('first-failure-' + process.pid + '.json', { message: error.message, stack: error.stack, cause: error.cause?.message ?? null }); process.exitCode = 1; });
const api = await import(pathToFileURL(resolve(repo, 'packages/barocss-cad/dist/index.js')));
const inspector = new Session(); inspector.connect();
const post = (method, params = {}) => new Promise((ok, no) => inspector.post(method, params, (error, result) => error ? no(error) : ok(result)));
await post('Profiler.enable'); await post('Profiler.startPreciseCoverage', { callCount: true, detailed: true });

const segmentIds = ['floor', 'right', 'bevel', 'roof', 'left'];
const points = [[-0, 0], [40, 0], [40, 16], [36, 20], [0, 20]].map((position, i) => ({ id: 'p' + i, position }));
const document = { format: 'barocss-xy-affine-sketch', version: 0, profile: 'exact-affine-binary64', id: 'footprint', lengthUnit: 'mm', points,
  segments: points.map((p, i) => ({ id: segmentIds[i], startPointId: p.id, endPointId: points[(i + 1) % points.length].id })), referenceLines: [],
  constraints: points.map(p => ({ id: 'fix_' + p.id, kind: 'fixed', pointId: p.id, target: [...p.position] })) };
const prismOptions = { sourceId: 'authored_profile', sourceRevision: 0, orderedSegmentIds: segmentIds, heightMM: 8, capChart: { originXY: [0, 0], spanXY: [64, 32] }, solidId: 'beveled_part', resultIdPrefix: 'part' };
const splitOptions = { operationId: 'half_height', resultIdPrefix: 'half', negativeSolidId: 'lower_part', positiveSolidId: 'upper_part' };
// This declared native plane is the cutter authority. No fitted mesh or inferred chart.
const cutterSource = '@model cutter_model { version:0; length-unit:mm; @surface #cut_z4 { type:nurbs; degree-u:1; degree-v:1; knots-u:[0,0,1,1]; knots-v:[0,0,1,1]; control-points:[[[0,0,4],[0,32,4]],[[64,0,4],[64,32,4]]]; weights:[[1,1],[1,1]]; } }\n';
const recipes = { document, prismOptions, cutterSource, splitOptions }, recipesBefore = structuredClone(recipes);
const sketch = api.buildXYAffineSketch(document), sketchBefore = structuredClone(sketch);
const prism = api.buildXYAffineSketchPrism(sketch, prismOptions), prismBefore = structuredClone(prism);
assert.deepEqual(prism.solid.certificate.volumeMM3, { numerator: '6336', denominator: '1' });
assert.deepEqual([prism.solid.graph.faces.length, prism.solid.graph.edges.length, prism.solid.graph.vertices.length], [7, 15, 10]);
const reference = { sourceId: prismOptions.sourceId, sketchId: document.id, sourceRevision: 0, segmentId: 'bevel' };
const wall = api.resolveXYAffineSketchPrismWall(prism, reference);
assert.equal(wall.status, 'preserved');
assert.deepEqual(wall.targets, [prism.lineage.segments.find(s => s.segmentId === reference.segmentId).wall]);
const compiled = api.compileCadModel(cutterSource, { sourceVersion: 0 }); assert.equal(compiled.ok, true);
const cutter = { sourceId: 'authored_cutter', source: cutterSource, sourceVersion: 0, model: compiled.model, surfaceId: 'cut_z4' }, cutterBefore = structuredClone(cutter);
const split = api.splitConvexPlanarSolid(prism.solid, cutter, splitOptions);
assert.equal(split.report.status, 'split');
assert.equal(split.section.kind, 'cycle'); assert.equal(split.section.cycleNodeKeys.length, 5);
assert.deepEqual(split.request.parent, prism.solid); assert.deepEqual(split.request.cutter, cutter);
assert.deepEqual(prism.request.sketch, sketch); assert.deepEqual(sketch.document, document);
const unique = values => { assert.equal(values.length, 1); return values[0]; };
const assetFor = (solid, ref) => {
  const asset = unique(solid.request.assets.filter(a => a.sourceId === ref.sourceId && a.face.options.faceId === ref.faceId));
  assert.equal(asset.face.plane.id, ref.surfaceId);
  assert.ok(solid.graph.faces.some(f => f.sourceId === ref.sourceId && f.faceId === ref.faceId));
  return asset;
};
const paths = [];
for (const side of ['negative', 'positive']) {
  const outcome = split[side]; assert.equal(outcome.kind, 'solid');
  assert.deepEqual(outcome.solid.certificate.volumeMM3, { numerator: '3168', denominator: '1' });
  assert.deepEqual([outcome.solid.graph.faces.length, outcome.solid.graph.edges.length, outcome.solid.graph.vertices.length], [7, 15, 10]);
  for (const segmentId of segmentIds) {
    const segment = unique(prism.lineage.segments.filter(s => s.segmentId === segmentId));
    assert.equal(segment.status, 'preserved');
    const source = assetFor(prism.solid, segment.wall);
    const child = unique(split.lineage.faces.filter(f => f.side === side && f.parent?.sourceId === segment.wall.sourceId && f.parent.faceId === segment.wall.faceId));
    assert.equal(child.role, 'clipped'); assert.ok(child.output);
    const target = assetFor(outcome.solid, child.output);
    assert.deepEqual(target.face.plane, source.face.plane);
    assert.equal(child.edges.filter(e => e.origin.kind === 'section').length, 1);
    for (const edge of child.edges.filter(e => e.origin.kind === 'parent-edge')) {
      assert.equal(edge.origin.sourceId, segment.wall.sourceId); assert.equal(edge.origin.faceId, segment.wall.faceId);
      assert.ok(prism.solid.graph.edges.some(e => e.id === edge.origin.parentEdgeId && e.uses.some(u => u.sourceId === edge.origin.sourceId && u.faceId === edge.origin.faceId && u.use.id === edge.origin.useId)));
    }
    paths.push({ segmentId, source: segment.wall, side, child: child.output, status: child.role });
  }
  for (const cap of prism.lineage.caps) {
    assert.equal(cap.status, 'generated');
    const child = unique(split.lineage.faces.filter(f => f.side === side && f.parent?.sourceId === cap.target.sourceId && f.parent.faceId === cap.target.faceId));
    const retained = (cap.role === 'bottom') === (side === 'negative');
    assert.equal(child.role, retained ? 'retained' : 'deleted');
    if (retained) assetFor(outcome.solid, child.output); else assert.equal(child.output, null);
  }
  const cap = unique(split.lineage.faces.filter(f => f.side === side && f.role === 'cap'));
  assert.equal(cap.parent, null); assert.ok(cap.output);
  assert.equal(cap.key, [splitOptions.operationId, 'cap', cutter.sourceId, cutter.surfaceId, side].join('|'));
  assert.ok(!prism.solid.request.assets.some(a => a.sourceId === cap.output.sourceId));
  const capAsset = assetFor(outcome.solid, cap.output);
  assert.deepEqual(capAsset.face.plane, compiled.model.objects.find(o => o.id === cutter.surfaceId));
  assert.equal(cap.edges.length, 5); assert.ok(cap.edges.every(e => e.origin.kind === 'section'));
}
assert.equal(split.lineage.capUses.length, 5);
for (const pair of split.lineage.capUses) {
  assert.ok(split.section.segments.some(s => s.key === pair.sectionKey));
  const uses = ['negative', 'positive'].map(side => {
    const cap = unique(split.lineage.faces.filter(f => f.side === side && f.role === 'cap' && f.output.sourceId === pair[side].sourceId));
    const edge = unique(cap.edges.filter(e => e.useId === pair[side].useId));
    assert.deepEqual(edge.origin, { kind: 'section', sectionKey: pair.sectionKey }); return edge;
  });
  assert.deepEqual(uses[0].nodeKeys, [...uses[1].nodeKeys].reverse());
}
assert.deepEqual(recipes, recipesBefore); assert.deepEqual(sketch, sketchBefore); assert.deepEqual(prism, prismBefore); assert.deepEqual(cutter, cutterBefore);
write('integration.json', { recipes, sketch, prism, split, wall, paths });
const restored = JSON.parse(readFileSync(resolve(output, 'integration.json'), 'utf8'));
assert.deepEqual(restored, { recipes, sketch, prism, split, wall, paths });
assert.ok(Object.is(restored.recipes.document.points[0].position[0], -0));
assert.ok(Object.is(restored.prism.request.sketch.document.points[0].position[0], -0));
assert.deepEqual(api.validateConvexPlanarSolidSplit(restored.split), split.report);
assert.deepEqual(restored.split, split);
const coverage = await post('Profiler.takePreciseCoverage'); await post('Profiler.stopPreciseCoverage'); inspector.disconnect();
write('native-coverage.json', coverage);
const names = ['buildXYAffineSketch', 'validateXYAffineSketch', 'buildXYAffineSketchPrism', 'resolveXYAffineSketchPrismWall', 'compileCadModel', 'buildConvexPlanarFace', 'evaluateCurveD1', 'evaluateSurfaceD1', 'qualifyConvexPlanarSolid', 'validateConvexPlanarSolid', 'splitConvexPlanarSolid', 'validateConvexPlanarSolidSplit'];
const actual = Object.fromEntries(names.map(name => [name, coverage.result.flatMap(s => s.functions.filter(f => f.functionName === name)).reduce((sum, f) => sum + f.ranges[0].count, 0)]));
for (const name of names) assert.ok(actual[name] > 0, 'Missing precise native entry coverage: ' + name);
assert.equal(actual.buildXYAffineSketchPrism, 1); assert.equal(actual.resolveXYAffineSketchPrismWall, 1);
assert.equal(actual.splitConvexPlanarSolid, 1); assert.equal(actual.validateConvexPlanarSolidSplit, 1);
assert.equal(actual.qualifyConvexPlanarSolid, 6); assert.equal(actual.validateConvexPlanarSolid, 2);
assert.equal(actual.qualifyConvexPlanarSolid + actual.validateConvexPlanarSolid, 8);
assert.ok(actual.compileCadModel <= 166); assert.ok(actual.buildConvexPlanarFace <= 160);
assert.ok(actual.evaluateCurveD1 + actual.evaluateSurfaceD1 <= 7488);
write('summary.json', { status: 'passed', pid: process.pid, node: process.versions.node, nativeEntryCounts: actual, parentVolume: prism.solid.certificate.volumeMM3, childVolumes: [split.negative.solid.certificate.volumeMM3, split.positive.solid.certificate.volumeMM3], prismWork: prism.report.childNativeWork, splitWork: split.report.nativeWork, prismExactWork: prism.report.exactWork, splitExactWork: split.report.exactWork, authoredSegmentToChildPaths: paths.length, signedZeroReadback: true, completeSplitReconstruction: true, persistentNamingCertified: false });
process.stdout.write(JSON.stringify({ status: 'passed', nativeEntryCounts: actual, parentVolume: '6336', childVolumes: ['3168', '3168'], authoredSegmentToChildPaths: paths.length }) + '\n');
