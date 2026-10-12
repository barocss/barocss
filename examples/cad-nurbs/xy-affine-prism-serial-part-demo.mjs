import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, statfsSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Session } from 'node:inspector';
const [mode, directory] = process.argv.slice(2);
assert.ok(['--source', '--emitted', '--cold', '--legacy'].includes(mode) && directory);
assert.equal(process.versions.node, '22.23.3'); assert.ok(process.execArgv.includes('--no-opt'), 'Disable optimizing compilation to retain precise constructor and method call coverage'); assert.ok((process.env.NODE_OPTIONS ?? '').includes('--max-old-space-size=2048'));
const root = resolve(fileURLToPath(new URL('../../', import.meta.url))), out = resolve(directory); mkdirSync(out, { recursive: true });
const manifest = JSON.parse(readFileSync(new URL('./xy-affine-prism-serial-part-campaign.json', import.meta.url), 'utf8'));
const json = v => typeof v === 'number' && Object.is(v, -0) ? '-0' : Array.isArray(v) ? '[' + v.map(json).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + json(v[k])).join(',') + '}' : JSON.stringify(v);
const hash = v => createHash('sha256').update(json(v)).digest('hex');
function write(name, value) {
  const text = typeof value === 'string' ? value : json(value) + '\n', disk = statfsSync(out);
  assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024);
  assert.ok(Buffer.byteLength(text) <= 32 * 1024 * 1024);
  assert.ok(readdirSync(out).reduce((n, p) => n + statSync(resolve(out, p)).size, 0) + Buffer.byteLength(text) <= 128 * 1024 * 1024);
  writeFileSync(resolve(out, name), text);
}
let api;
if (mode === '--source' || mode === '--legacy') {
  const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
  const b = await require('esbuild').build({ entryPoints: [resolve(root, 'packages/barocss-cad/src/index.ts')], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
  assert.ok(Object.keys(b.metafile.inputs).every(p => !p.includes('/dist/'))); write(mode.slice(2) + '-inputs.json', Object.keys(b.metafile.inputs));
  const name = mode.slice(2) + '-bundle.mjs'; write(name, b.outputFiles[0].text); api = await import(pathToFileURL(resolve(out, name)));
} else api = await import(pathToFileURL(resolve(root, 'packages/barocss-cad/dist/index.js')));
const inspector = new Session(); inspector.connect();
const post = (method, params = {}) => new Promise((yes, no) => inspector.post(method, params, (e, r) => e ? no(e) : yes(r)));
await post('Profiler.enable'); await post('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
const names = ['compileCadModel', 'buildConvexPlanarFace', 'evaluateCurveD1', 'evaluateSurfaceD1', 'SectionRationalContext', 'ExactAffinePlane', 'work'];
const stages = [], refusals = [];
const count = raw => Object.fromEntries(names.map(n => [n, raw.result.flatMap(s => s.functions.filter(f => f.functionName === n)).reduce((v, f) => v + f.ranges[0].count, 0)]));
let pending = null, connected = true;
process.on('uncaughtException', async e => {
  const remainder = connected ? count(await post('Profiler.takePreciseCoverage')) : Object.fromEntries(names.map(n => [n, 0]));
  write(mode.slice(2) + '-first-failure-' + process.pid + '.json', { message: e.message, stack: e.stack, code: e.code ?? null, stage: e.stage ?? null, cause: e.cause?.message ?? null, completed: stages, pending, remainder }); process.exitCode = 1;
});
async function mark(label, expected) {
  const counts = count(await post('Profiler.takePreciseCoverage')); pending = { label, counts, expected: expected ?? null };
  stages.push(pending); write(mode.slice(2) + '-counts.json', stages);
  const limit = manifest.perStageCeiling;
  assert.ok(counts.compileCadModel <= limit.sourceCompilations && counts.buildConvexPlanarFace <= limit.faceCompilations && counts.evaluateCurveD1 + counts.evaluateSurfaceD1 <= limit.D1);
  assert.ok(counts.ExactAffinePlane <= limit.exactAffineContexts && counts.SectionRationalContext <= limit.rationalContexts && counts.work <= limit.rationalOperations);
  if (expected) {
    assert.equal(counts.compileCadModel, expected.sourceCompilations); assert.equal(counts.buildConvexPlanarFace, expected.faceCompilations);
    assert.equal(counts.evaluateCurveD1 + counts.evaluateSurfaceD1, expected.totalD1);
    assert.equal(counts.ExactAffinePlane, expected.exactAffineContexts);
    assert.equal(counts.SectionRationalContext, expected.rationalContexts + expected.exactAffineContexts);
  }
  pending = null;
}
const legacyText = '{"format":"barocss-xy-affine-prism-feature-document","id":"part_document","lengthUnit":"mm","nodes":[{"document":{"constraints":[{"id":"fix_p0","kind":"fixed","pointId":"p0","target":[-0,0]},{"id":"fix_p1","kind":"fixed","pointId":"p1","target":[32,0]},{"id":"fix_p2","kind":"fixed","pointId":"p2","target":[32,16]},{"id":"fix_p3","kind":"fixed","pointId":"p3","target":[16,32]},{"id":"fix_p4","kind":"fixed","pointId":"p4","target":[0,32]}],"format":"barocss-xy-affine-sketch","id":"aa_sketch","lengthUnit":"mm","points":[{"id":"p0","position":[-0,0]},{"id":"p1","position":[32,0]},{"id":"p2","position":[32,16]},{"id":"p3","position":[16,32]},{"id":"p4","position":[0,32]}],"profile":"exact-affine-binary64","referenceLines":[],"segments":[{"endPointId":"p1","id":"s0","startPointId":"p0"},{"endPointId":"p2","id":"s1","startPointId":"p1"},{"endPointId":"p3","id":"s2","startPointId":"p2"},{"endPointId":"p4","id":"s3","startPointId":"p3"},{"endPointId":"p0","id":"s4","startPointId":"p4"}],"version":0},"id":"aa_sketch_node","kind":"sketch","revision":0,"sourceId":"aa_source"},{"document":{"constraints":[{"id":"fix_p0","kind":"fixed","pointId":"p0","target":[8,-16]},{"id":"fix_p1","kind":"fixed","pointId":"p1","target":[16,-16]},{"id":"fix_p2","kind":"fixed","pointId":"p2","target":[16,48]},{"id":"fix_p3","kind":"fixed","pointId":"p3","target":[8,48]}],"format":"barocss-xy-affine-sketch","id":"bb_sketch","lengthUnit":"mm","points":[{"id":"p0","position":[8,-16]},{"id":"p1","position":[16,-16]},{"id":"p2","position":[16,48]},{"id":"p3","position":[8,48]}],"profile":"exact-affine-binary64","referenceLines":[],"segments":[{"endPointId":"p1","id":"s0","startPointId":"p0"},{"endPointId":"p2","id":"s1","startPointId":"p1"},{"endPointId":"p3","id":"s2","startPointId":"p2"},{"endPointId":"p0","id":"s3","startPointId":"p3"}],"version":0},"id":"bb_sketch_node","kind":"sketch","revision":0,"sourceId":"bb_source"},{"id":"aa_prism_node","kind":"prism","options":{"capChart":{"originXY":[0,0],"spanXY":[32,32]},"heightMM":8,"orderedSegmentIds":["s0","s1","s2","s3","s4"],"resultIdPrefix":"aa","solidId":"aa_solid"},"sketchNodeId":"aa_sketch_node"},{"id":"bb_prism_node","kind":"prism","options":{"capChart":{"originXY":[0,-16],"spanXY":[32,64]},"heightMM":8,"orderedSegmentIds":["s0","s1","s2","s3"],"resultIdPrefix":"bb","solidId":"bb_solid"},"sketchNodeId":"bb_sketch_node"},{"first":{"reference":{"segmentId":"s3","sketchId":"bb_sketch","sourceId":"bb_source","sourceRevision":0},"resultIdPrefix":"left","solidId":"left_part"},"id":"subtraction_feature","kind":"subtraction","operationId":"remove_slab","parentPrismId":"aa_prism_node","second":{"reference":{"segmentId":"s1","sketchId":"bb_sketch","sourceId":"bb_source","sourceRevision":0},"resultIdPrefix":"right","solidId":"right_part"},"toolPrismId":"bb_prism_node"},{"distanceMM":1,"id":"front_detail","kind":"chamfer","options":{"operationId":"front_chamfer","removedSolidId":"front_wedge","resultIdPrefix":"ch","retainedSolidId":"detailed_part"},"parentPrismId":"aa_prism_node","reference":{"a":{"curveId":"s0","faceId":"aa_t_f","loopId":"aa_t_l","pcurveId":"aa_t_uv_0","sourceId":"aa_t","surfaceId":"aa_t_s","useId":"aa_t_use_0"},"b":{"curveId":"aa_w_0_c_2","faceId":"aa_w_0_f","loopId":"aa_w_0_l","pcurveId":"aa_w_0_uv_2","sourceId":"aa_w_0","surfaceId":"aa_w_0_s","useId":"aa_w_0_use_2"},"role":"top","segmentId":"s0","sketchId":"aa_sketch","sourceId":"aa_source","sourceRevision":0}}],"parameters":[{"bindings":[{"axis":"x","constraintId":"fix_p0","kind":"fixed-sketch-coordinate","sketchNodeId":"bb_sketch_node"},{"axis":"x","constraintId":"fix_p3","kind":"fixed-sketch-coordinate","sketchNodeId":"bb_sketch_node"}],"id":"lowerX","unit":"mm","valueMM":8},{"bindings":[{"axis":"x","constraintId":"fix_p1","kind":"fixed-sketch-coordinate","sketchNodeId":"bb_sketch_node"},{"axis":"x","constraintId":"fix_p2","kind":"fixed-sketch-coordinate","sketchNodeId":"bb_sketch_node"}],"id":"upperX","unit":"mm","valueMM":16},{"bindings":[{"axis":"y","constraintId":"fix_p0","kind":"fixed-sketch-coordinate","sketchNodeId":"bb_sketch_node"},{"axis":"y","constraintId":"fix_p1","kind":"fixed-sketch-coordinate","sketchNodeId":"bb_sketch_node"}],"id":"lowerY","unit":"mm","valueMM":-16},{"bindings":[{"axis":"y","constraintId":"fix_p2","kind":"fixed-sketch-coordinate","sketchNodeId":"bb_sketch_node"},{"axis":"y","constraintId":"fix_p3","kind":"fixed-sketch-coordinate","sketchNodeId":"bb_sketch_node"}],"id":"upperY","unit":"mm","valueMM":48},{"bindings":[{"kind":"prism-height","prismNodeId":"aa_prism_node"}],"id":"parentHeight","unit":"mm","valueMM":8},{"bindings":[{"chamferNodeId":"front_detail","kind":"chamfer-distance"}],"id":"setback","unit":"mm","valueMM":1},{"bindings":[{"axis":"x","constraintId":"fix_p3","kind":"fixed-sketch-coordinate","sketchNodeId":"aa_sketch_node"}],"id":"rearX","unit":"mm","valueMM":16},{"bindings":[{"axis":"x","constraintId":"fix_p1","kind":"fixed-sketch-coordinate","sketchNodeId":"aa_sketch_node"},{"axis":"x","constraintId":"fix_p2","kind":"fixed-sketch-coordinate","sketchNodeId":"aa_sketch_node"}],"id":"rightX","unit":"mm","valueMM":32},{"bindings":[{"axis":"y","constraintId":"fix_p2","kind":"fixed-sketch-coordinate","sketchNodeId":"aa_sketch_node"}],"id":"shoulderY","unit":"mm","valueMM":16},{"bindings":[{"axis":"y","constraintId":"fix_p3","kind":"fixed-sketch-coordinate","sketchNodeId":"aa_sketch_node"},{"axis":"y","constraintId":"fix_p4","kind":"fixed-sketch-coordinate","sketchNodeId":"aa_sketch_node"}],"id":"rearY","unit":"mm","valueMM":32},{"bindings":[{"axis":"y","constraintId":"fix_p1","kind":"fixed-sketch-coordinate","sketchNodeId":"aa_sketch_node"}],"id":"frontY","unit":"mm","valueMM":0}],"revision":1,"version":1}\n';
const legacy = JSON.parse(legacyText);
function authored() {
  const d = structuredClone(legacy); d.version = 2; d.revision = 0;
  for (const p of [d.nodes[2], d.nodes[3]]) p.options.chartPolicy = { version: 1, kind: 'coordinate-span' };
  const detail = d.nodes[5]; delete detail.parentPrismId;
  detail.parent = { kind: 'subtraction-component', subtractionNodeId: d.nodes[4].id, componentRole: 'second', solidId: d.nodes[4].second.solidId };
  return d;
}
const frac = n => ({ numerator: String(n), denominator: '1' });
const set = (r, values) => ({ expectedRevision: r.document.revision, revision: r.document.revision + 1, parameterEdits: Object.entries(values).map(([parameterId, valueMM]) => ({ parameterId, valueMM })) });
const sum = (a, b) => Object.fromEntries(Object.keys(a).map(k => [k, a[k] + b[k]]));
const V = api.evaluateXYAffinePrismFeatureDocumentV2, U = api.updateXYAffinePrismFeatureDocumentV2;
const report = r => r.report.coldWork;
function assertWork(r, rear) {
  const expected = manifest.shapes.find(s => s.rearX === rear);
  for (const [key, value] of Object.entries(expected.coldWork)) assert.equal(report(r)[key], value, key);
}
// Independent rational checker: no production arithmetic or stored proof trusted.
const gcd = (a, b) => { a = a < 0n ? -a : a; while (b) [a, b] = [b, a % b]; return a; };
const rat = (n, d = 1n) => { if (d < 0n) { n = -n; d = -d; } assert.notEqual(d, 0n); const g = gcd(n, d); return [n / g, d / g]; };
const data = new DataView(new ArrayBuffer(8));
const r = x => { data.setFloat64(0, x); const bits = data.getBigUint64(0), e = Number((bits >> 52n) & 2047n), m = bits & 0xfffffffffffffn; if (!e && !m) return rat(0n); const n = (bits >> 63n ? -1n : 1n) * (e ? (1n << 52n) + m : m), power = e ? e - 1075 : -1074; return power >= 0 ? rat(n << BigInt(power)) : rat(n, 1n << BigInt(-power)); };
const add = (a, b) => rat(a[0] * b[1] + b[0] * a[1], a[1] * b[1]), neg = a => [-a[0], a[1]], sub = (a, b) => add(a, neg(b)), mul = (a, b) => rat(a[0] * b[0], a[1] * b[1]), div = (a, b) => rat(a[0] * b[1], a[1] * b[0]);
const vector = p => p.map(r), minus = (a, b) => a.map((x, i) => sub(x, b[i])), plus = (a, b) => a.map((x, i) => add(x, b[i])), scale = (a, s) => a.map(x => mul(x, s));
const dot = (a, b) => a.reduce((n, x, i) => add(n, mul(x, b[i])), rat(0n));
const cross = (a, b) => [[1, 2], [2, 0], [0, 1]].map(([i, j]) => sub(mul(a[i], b[j]), mul(a[j], b[i])));
function proveSolid(solid, volume) {
  let signedSix = rat(0n), endpoints = 0;
  assert.equal(solid.graph.vertices.length - solid.graph.edges.length + solid.graph.faces.length, 2);
  assert.ok(solid.graph.edges.every(e => e.uses.length === 2));
  for (const edge of solid.graph.edges) {
    const ends = edge.uses.map(use => {
      const face = solid.request.assets.find(a => a.sourceId === use.sourceId).face;
      const line = face.loop.edges.find(c => c.id === use.use.curveId), start = use.use.sense === 'forward' ? 0 : 1;
      return [line.controlPoints[start], line.controlPoints[1 - start]];
    });
    assert.deepEqual(ends[0][0], ends[1][1]); assert.deepEqual(ends[0][1], ends[1][0]);
  }
  for (const asset of solid.request.assets) {
    const f = asset.face, p = f.plane, origin = vector(p.controlPoints[0][0]), u = minus(vector(p.controlPoints[1][0]), origin), v = minus(vector(p.controlPoints[0][1]), origin);
    assert.deepEqual(vector(p.controlPoints[1][1]), plus(plus(origin, u), v));
    const outward = scale(cross(u, v), rat(f.options.orientation === 'forward' ? 1n : -1n));
    for (const vertex of solid.graph.vertices) assert.ok(dot(outward, minus(vector(vertex.pointMM), origin))[0] <= 0n, 'Independent exact convex halfspace');
    for (const pc of f.pcurves) {
      const line = f.loop.edges.find(e => e.id === pc.curveId); assert.ok(line);
      assert.deepEqual(pc.curve.knots, line.knots);
      for (let i = 0; i < 2; i++) {
        const uv = pc.curve.controlPoints[i], a = div(sub(r(uv[0]), r(p.knotsU[1])), sub(r(p.knotsU[2]), r(p.knotsU[1]))), b = div(sub(r(uv[1]), r(p.knotsV[1])), sub(r(p.knotsV[2]), r(p.knotsV[1])));
        assert.deepEqual(plus(plus(origin, scale(u, a)), scale(v, b)), vector(line.controlPoints[i])); endpoints++;
      }
    }
    const vertices = f.topology.loop.uses.map(use => vector(f.loop.edges.find(e => e.id === use.curveId).controlPoints[use.sense === 'forward' ? 0 : 1]));
    for (let i = 1; i + 1 < vertices.length; i++) signedSix = add(signedSix, dot(vertices[0], cross(vertices[i], vertices[i + 1])));
  }
  assert.deepEqual(div(signedSix, rat(6n)), r(volume));
  assert.deepEqual(solid.certificate.volumeMM3, frac(volume)); return endpoints;
}
function prove(r, second, retained, wedge, rear) {
  assert.deepEqual(r.subtraction.report.volumeMM3.second, frac(second));
  proveSolid(r.subtraction.second.outcome.solid, second);
  proveSolid(r.chamfer.split.negative.solid, retained); proveSolid(r.chamfer.split.positive.solid, wedge);
  assert.deepEqual(r.chamfer.metric.removedVolumeMM3, frac(wedge));
  assert.equal(r.chamfer.request.selection.parentSolidId, r.document.nodes[4].second.solidId);
  assert.deepEqual(r.chamfer.split.request.parent, r.subtraction.second.outcome.solid);
  assert.deepEqual(r.report.dependencies[5].dependsOn, [r.document.nodes[4].id]);
  assert.deepEqual(r.document.nodes[5].reference.a, legacy.nodes[5].reference.a); assert.deepEqual(r.document.nodes[5].reference.b, legacy.nodes[5].reference.b);
  for (const side of ['a', 'b']) {
    const resolution = r.chamferResolution[side]; assert.equal(resolution.origin.operand, 'parent');
    assert.notEqual(resolution.origin.edgeId, r.chamferResolution.originalTopEdgeId);
    assert.deepEqual(r.chamfer.request.selection[side], resolution.reference);
    assert.equal(resolution.origin.useId, r.document.nodes[5].reference[side].useId);
  }
  assertWork(r, rear);
}
function reject(label, action, code, expectedStage, causeCode, detail) {
  assert.throws(action, e => { assert.ok(e instanceof api.XYAffinePrismFeatureError, String(e)); if (code) assert.equal(e.code, code); if (expectedStage) assert.equal(e.stage, expectedStage); if (causeCode) assert.equal(e.cause?.code, causeCode); if (detail) assert.ok(e.message.includes(detail), e.message); refusals.push({ label, code: e.code, stage: e.stage, detail: e.message, cause: e.cause?.message ?? null, attempted: e.attempted }); return true; });
}
async function change(before, values, label, volumes, rear, actions) {
  const beforeHash = hash(before), input = set(before, values), inputHash = hash(input), update = U(before, input);
  assert.equal(hash(before), beforeHash); assert.equal(hash(input), inputHash); assert.equal(update.transaction.report.noOp, false);
  assert.deepEqual(update.transaction.report.actions.map(x => x.action), actions);
  prove(update.result, ...volumes, rear); await mark(label, sum(update.transaction.report.validation, update.transaction.report.candidate)); return update;
}
if (mode === '--legacy') {
  assert.ok(process.env.LEGACY_CAD_DIST, 'Explicit frozen adopted baseline emitted entrypoint required');
  const old = await import(pathToFileURL(resolve(process.env.LEGACY_CAD_DIST)));
  const v0 = structuredClone(legacy); v0.version = 0; v0.nodes.pop(); v0.parameters = v0.parameters.slice(0, 4);
  for (const p of v0.parameters) for (const b of p.bindings) delete b.kind;
  for (const [version, d] of [[0, v0], [1, legacy]]) {
    const suffix = version ? 'V1' : '', fn = 'evaluateXYAffinePrismFeatureDocument' + suffix;
    const a = old[fn](d), b = api[fn](d); assert.deepEqual(b, a);
    const serialize = 'serializeXYAffinePrismFeatureDocument' + suffix;
    assert.equal(api[serialize](d), old[serialize](d)); if (version) assert.equal(api[serialize](d), legacyText);
    await mark('legacy_v' + version + '_whole_result_and_bytes');
  }
  for (const [label, values] of [['height6_normalized_refusal', { parentHeight: 6 }], ['rear20_normalized_refusal', { rearX: 20 }]]) {
    const d = structuredClone(legacy);
    for (const [id, v] of Object.entries(values)) { const p = d.parameters.find(x => x.id === id); p.valueMM = v; for (const b of p.bindings) { if (b.kind === 'prism-height') d.nodes[2].options.heightMM = v; else d.nodes[0].document.constraints.find(c => c.id === b.constraintId).target[b.axis === 'x' ? 0 : 1] = v; } }
    reject(label, () => api.evaluateXYAffinePrismFeatureDocumentV1(d)); await mark(label);
  }
} else if (mode === '--cold') {
  const expected = JSON.parse(readFileSync(resolve(out, 'expected.json'), 'utf8'));
  for (const [name, volumes, rear] of [['base', [3072, 3064, 8], 16], ['height', [2304, 2296, 8], 16], ['rear', [3328, 3320, 8], 20], ['both', [2496, 2488, 8], 20]]) {
    const text = readFileSync(resolve(out, 'authored-' + name + '.json'), 'utf8'), rebuilt = api.parseXYAffinePrismFeatureDocumentV2(text);
    assert.equal(hash(rebuilt), expected[name]); prove(rebuilt, ...volumes, rear); await mark('cold_' + name, report(rebuilt));
  }
} else {
  const d = authored(), authoredHash = hash(d), base = V(d); assert.equal(hash(d), authoredHash); prove(base, 3072, 3064, 8, 16); await mark('base', report(base));
  const height = await change(base, { parentHeight: 6 }, 'height_edit', [2304, 2296, 8], 16, ['retained', 'retained', 'rebuilt', 'retained', 'rebuilt', 'rebuilt']);
  const rear = await change(base, { rearX: 20 }, 'rear_edit', [3328, 3320, 8], 20, ['rebuilt', 'retained', 'rebuilt', 'retained', 'rebuilt', 'rebuilt']);
  assert.equal(rear.result.document.nodes[0].revision, 1); assert.equal(rear.result.document.nodes[5].reference.sourceRevision, 1);
  const both = await change(rear.result, { parentHeight: 6 }, 'combined_edit', [2496, 2488, 8], 20, ['retained', 'retained', 'rebuilt', 'retained', 'rebuilt', 'rebuilt']);
  const results = { base, height: height.result, rear: rear.result, both: both.result }, hashes = Object.fromEntries(Object.entries(results).map(([n, r]) => [n, hash(r)]));
  if (mode === '--emitted') assert.deepEqual(hashes, JSON.parse(readFileSync(resolve(out, 'expected.json'), 'utf8')));
  if (mode === '--source') {
    write('expected.json', hashes);
    for (const [name, r] of Object.entries(results)) {
      const text = api.serializeXYAffinePrismFeatureDocumentV2(r.document); assert.equal(text, json(r.document) + '\n');
      assert.ok(!text.includes('chamferResolution') && !text.includes('sourceInterval') && !text.includes('certificate') && !text.includes('coldWork'));
      assert.ok(Object.is(JSON.parse(text).nodes[0].document.points[0].position[0], -0)); write('authored-' + name + '.json', text); await mark('serialize_' + name, report(r));
    }
    const distance = await change(base, { setback: 2 }, 'distance_edit', [3072, 3040, 32], 16, ['retained', 'retained', 'retained', 'retained', 'retained', 'rebuilt']);
    assert.deepEqual(distance.result.prisms, base.prisms); assert.deepEqual(distance.result.subtraction, base.subtraction);
    for (const k of ['sketchBuilds', 'prismBuilds', 'wallResolutions', 'subtractions']) assert.equal(distance.transaction.report.candidate[k], 0);
    assert.equal(distance.transaction.report.candidate.chamfers, 1);
    assert.equal(distance.transaction.report.candidate.sourceCompilations, 31); assert.equal(distance.transaction.report.candidate.faceCompilations, 30); assert.equal(distance.transaction.report.candidate.totalD1, 1080);
    const width = await change(base, { upperX: 24 }, 'tool_edit', [1280, 1276, 4], 16, ['retained', 'rebuilt', 'retained', 'rebuilt', 'rebuilt', 'rebuilt']);
    assert.deepEqual(width.result.prisms[0], base.prisms[0]); assert.equal(width.result.document.nodes[1].revision, 1);
    assert.notDeepEqual(width.result.chamferResolution.a.origin.sourceInterval, base.chamferResolution.a.origin.sourceInterval);
    const noop = U(base, set(base, { setback: 1 })); assert.equal(noop.transaction.report.noOp, true); assert.ok(Object.values(noop.transaction.report.candidate).every(v => v === 0)); await mark('same_value_full_prior_no_candidate', report(base));
    assert.deepEqual(api.validateXYAffinePrismFeatureDocumentV2(base), base.report); await mark('full_validation', report(base));
    assert.deepEqual(api.validateXYAffinePrismFeatureDocumentUpdateV2(distance), distance.transaction.report); await mark('distance_transaction_replay', sum(distance.transaction.report.validation, distance.transaction.report.candidate));
    assert.deepEqual(api.validateXYAffinePrismFeatureDocumentUpdateV2(width), width.transaction.report); await mark('tool_transaction_replay', sum(width.transaction.report.validation, width.transaction.report.candidate));
    const admissionCases = [
      ['missing_sixth', x => x.nodes.pop()], ['wrong_component', x => x.nodes[5].parent.componentRole = 'first'], ['wrong_solid', x => x.nodes[5].parent.solidId = 'wrong'],
      ['wrong_dependency', x => x.nodes[5].parent.subtractionNodeId = x.nodes[2].id], ['cycle', x => x.nodes[4].parentPrismId = x.nodes[5].id],
      ['unknown_policy', x => x.nodes[2].options.chartPolicy.kind = 'automatic'], ['extra_policy_key', x => x.nodes[3].options.chartPolicy.extra = true], ['missing_policy', x => delete x.nodes[2].options.chartPolicy],
      ['persisted_resolution', x => x.chamferResolution = base.chamferResolution], ['stale_revision', x => x.nodes[5].reference.sourceRevision++],
      ['duplicate_pair', x => x.nodes[5].reference.b = x.nodes[5].reference.a], ['extra_parent_key', x => x.nodes[5].parent.ordinal = 1],
      ['identity_collision', x => x.nodes[5].options.retainedSolidId = x.nodes[4].second.solidId]
    ];
    for (const [label, mutate] of admissionCases) { const x = authored(); mutate(x); const h = hash(x); reject(label, () => V(x)); assert.equal(hash(x), h); await mark(label, { sourceCompilations: 0, faceCompilations: 0, totalD1: 0, exactAffineContexts: 0, rationalContexts: 0 }); }
    let getterCalls = 0; const getter = authored(); Object.defineProperty(getter.nodes[5], 'distanceMM', { enumerable: true, get() { getterCalls++; return 1; } }); reject('getter', () => V(getter)); assert.equal(getterCalls, 0); await mark('getter');
    reject('duplicate_json', () => api.parseXYAffinePrismFeatureDocumentV2('{"version":2,"version":2}')); await mark('duplicate_json');
    reject('file_budget', () => api.parseXYAffinePrismFeatureDocumentV2(' '.repeat(262145))); await mark('file_budget');
    for (const side of ['a', 'b']) for (const field of ['sourceId', 'faceId', 'surfaceId', 'loopId', 'useId', 'curveId', 'pcurveId']) {
      const x = authored(); x.nodes[5].reference[side][field] = 'forged'; const h = hash(x); reject('forged_' + side + '_' + field, () => V(x), 'REFERENCE'); assert.equal(hash(x), h); await mark('forged_' + side + '_' + field);
    }
    for (const [label, mutate] of [
      ['forged_work', x => x.report.coldWork.sourceCompilations++], ['forged_resolution', x => x.chamferResolution.a.origin.edgeId = 'forged'],
      ['ambiguous_lineage', x => { const f = x.subtraction.second.lineage.faces.find(f => f.edges.some(e => e.originalEdges.length)); const e = f.edges.find(e => e.originalEdges.length); e.originalEdges.push(structuredClone(e.originalEdges[0])); }]
    ]) { const x = structuredClone(base); mutate(x); const h = hash(x), edit = set(x, { setback: 1 }), eh = hash(edit); reject(label, () => U(x, edit), 'OWNED'); assert.equal(hash(x), h); assert.equal(hash(edit), eh); await mark(label, report(base)); }
    for (const [label, prior, values, code, stage, causeCode, detail] of [
      ['unrepresentable_80_over_3', rear.result, { upperX: 24 }, 'NATIVE', 'subtraction', 'REPRESENTABILITY', 'not exactly represented in binary64'], ['tool_coverage', base, { parentHeight: 10 }, 'NATIVE', 'subtraction', 'SLAB', 'Every other tool halfspace must contain the entire parent'],
      ['noncardinal', base, { frontY: 2 }, 'NATIVE', 'chamfer', 'METRIC', 'Adjacent outward supports must be signed world-axis planes'], ['nonlocal', base, { setback: 8 }, 'NATIVE', 'chamfer', 'LOCALITY', 'Only selected endpoints may be removed'], ['empty_selected_component', base, { upperX: 32 }, 'REFERENCE', 'chamfer-reference', null, 'Selected second component is empty'], ['invalid_distance', base, { setback: 0 }, 'PARAMETER', 'update', null, 'Positive chamfer distance required']
    ]) { const h = hash(prior), edit = set(prior, values), eh = hash(edit); reject(label, () => U(prior, edit), code, stage, causeCode, detail); assert.equal(hash(prior), h); assert.equal(hash(edit), eh); await mark(label); }
    write('source-distance-update.json', distance); write('source-tool-update.json', width);
  }
}
const total = Object.fromEntries(names.map(n => [n, stages.reduce((v, s) => v + s.counts[n], 0)]));
const cap = manifest.phaseCeiling[mode.slice(2)]; assert.ok(total.compileCadModel <= cap.sourceCompilations && total.buildConvexPlanarFace <= cap.faceCompilations && total.evaluateCurveD1 + total.evaluateSurfaceD1 <= cap.D1 && total.ExactAffinePlane <= cap.exactAffineContexts && total.SectionRationalContext <= cap.rationalContexts && total.work <= cap.rationalOperations);
await post('Profiler.stopPreciseCoverage'); inspector.disconnect(); connected = false;
write(mode.slice(2) + '-summary.json', { mode, total, stages: stages.map(s => s.label), refusals, bounded: true });
console.log(JSON.stringify({ mode, total, stages: stages.length, refusals: refusals.length }));
