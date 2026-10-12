import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, statfsSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Session } from 'node:inspector';
const [mode, directory] = process.argv.slice(2);
assert.ok(['--source', '--emitted', '--cold'].includes(mode) && directory);
assert.equal(process.versions.node, '22.23.3');
assert.ok((process.env.NODE_OPTIONS ?? '').includes('--max-old-space-size=2048'));
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(directory);
mkdirSync(output, { recursive: true });
const signedJSON = v => typeof v === 'number' && Object.is(v, -0) ? '-0' : Array.isArray(v) ? '[' + v.map(signedJSON).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ':' + signedJSON(x)).join(',') + '}' : JSON.stringify(v);
const write = (name, data) => {
  const text = signedJSON(data) + '\n', disk = statfsSync(output);
  assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024);
  assert.ok(Buffer.byteLength(text) <= 32 * 1024 * 1024);
  assert.ok(readdirSync(output).reduce((n, p) => n + statSync(resolve(output, p)).size, 0) + Buffer.byteLength(text) <= 128 * 1024 * 1024);
  writeFileSync(resolve(output, name), text);
};
let checkpoint;
process.on('uncaughtException', async error => {
  if (checkpoint) await checkpoint('first-failure');
  write('first-failure-' + mode.slice(2) + '-' + process.pid + '.json', { message: error.message, stack: error.stack, cause: error.cause?.message ?? null });
  process.exitCode = 1;
});
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
let api;
if (mode === '--source') {
  const built = await require('esbuild').build({ entryPoints: [resolve(repo, 'packages/barocss-cad/src/index.ts')], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
  assert.ok(Object.keys(built.metafile.inputs).every(p => !p.includes('/dist/')));
  write('source-inputs.json', Object.keys(built.metafile.inputs));
  const path = resolve(output, 'coordinate-span-source.mjs'); writeFileSync(path, built.outputFiles[0].text); api = await import(pathToFileURL(path));
} else api = await import(pathToFileURL(resolve(repo, 'packages/barocss-cad/dist/index.js')));
const inspector = new Session(); inspector.connect();
const post = (method, params = {}) => new Promise((yes, no) => inspector.post(method, params, (e, r) => e ? no(e) : yes(r)));
await post('Profiler.enable'); await post('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
const names = ['compileCadModel', 'buildConvexPlanarFace', 'evaluateCurveD1', 'evaluateSurfaceD1', 'SectionRationalContext', 'ExactAffinePlane', 'work'];
const stages = [];
checkpoint = async label => { const raw = await post('Profiler.takePreciseCoverage'); const counts = Object.fromEntries(names.map(n => [n, raw.result.flatMap(s => s.functions.filter(f => f.functionName === n)).reduce((a, f) => a + f.ranges[0].count, 0)])); stages.push({ label, counts }); write(mode.slice(2) + '-counts.json', stages); return counts; };
const fraction = n => ({ numerator: String(n), denominator: '1' });
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
  assert.deepEqual(solid.certificate.volumeMM3, fraction(volume)); return endpoints;
}
function recipe(id, rear, height, policy = true) {
  const positions = [[0, 0], [32, 0], [32, 16], [rear, 32], [0, 32]], ids = ['front', 'right', 'slope', 'back', 'left'];
  return polygon(id, positions, ids, height, [0, 0], [32, 32], policy);
}
function polygon(id, positions, ids, height, origin, span, policy = true) {
  const points = positions.map((position, i) => ({ id: 'p' + i, position }));
  return { document: { format: 'barocss-xy-affine-sketch', version: 0, profile: 'exact-affine-binary64', id: id + '_sketch', lengthUnit: 'mm', points, segments: points.map((p, i) => ({ id: ids[i], startPointId: p.id, endPointId: points[(i + 1) % points.length].id })), referenceLines: [], constraints: points.map(p => ({ id: 'fix_' + p.id, kind: 'fixed', pointId: p.id, target: [...p.position] })) }, options: { sourceId: id + '_source', sourceRevision: 0, orderedSegmentIds: ids, heightMM: height, capChart: { originXY: origin, spanXY: span }, solidId: id + '_solid', resultIdPrefix: id, ...(policy ? { chartPolicy: { version: 1, kind: 'coordinate-span' } } : {}) } };
}
const make = recipe => api.buildXYAffineSketchPrism(api.buildXYAffineSketch(recipe.document), recipe.options);
const toolRecipe = (h, width = 16) => polygon('tool', [[8, -16], [width, -16], [width, 48], [8, 48]], ['a', 'b', 'c', 'd'], h, [0, -16], [32, 64]);
const ref = (solid, x) => { const fs = solid.graph.faces.filter(f => f.vertexIds.every(id => solid.graph.vertices.find(v => v.id === id).pointMM[0] === x)); assert.equal(fs.length, 1); return { sourceId: fs[0].sourceId, faceId: fs[0].faceId }; };
const slabOptions = (tool, width = 16) => ({ operationId: 'remove_slab', first: { toolFace: ref(tool, 8), solidId: 'left_part', resultIdPrefix: 'left' }, second: { toolFace: ref(tool, width), solidId: 'right_part', resultIdPrefix: 'right' } });
const useRef = u => ({ sourceId: u.sourceId, faceId: u.faceId, surfaceId: u.surfaceId, loopId: u.loopId, useId: u.use.id, curveId: u.use.curveId, pcurveId: u.use.pcurveId });
const selection = (prism, segment = 'front') => { const edge = prism.solid.graph.edges.find(e => e.id === prism.lineage.segments.find(s => s.segmentId === segment).topEdgeId); return { parentSolidId: prism.solid.request.options.solidId, a: useRef(edge.uses[0]), b: useRef(edge.uses[1]) }; };
const chamferOptions = { operationId: 'front_chamfer', resultIdPrefix: 'cham', retainedSolidId: 'finished_part', removedSolidId: 'removed_wedge' };
const recipes = mode === '--cold' ? JSON.parse(readFileSync(resolve(output, 'recipes.json'), 'utf8')) : [recipe('base', 16, 8), recipe('height', 16, 6), recipe('rear', 20, 8), recipe('both', 20, 6)];
if (mode === '--source') write('recipes.json', recipes);
const summaries = [];
for (const [index, authored] of recipes.entries()) {
  const before = structuredClone(authored), prism = make(authored), h = authored.options.heightMM, rear = authored.document.points[3].position[0], parentVolume = (768 + rear * 8) * h;
  const parentProof = proveSolid(prism.solid, parentVolume);
  for (const asset of prism.solid.request.assets) {
    const p = asset.face.plane; assert.equal(p.knotsU[0], 0); assert.equal(p.knotsV[0], 0);
    const wall = asset.sourceId.includes('_w_'); if (wall) assert.equal(p.knotsV[2], h); else assert.deepEqual([p.knotsU[2], p.knotsV[2]], [32, 32]);
  }
  const tool = make(toolRecipe(h)), slab = api.subtractConvexPlanarSlab(prism.solid, tool.solid, slabOptions(tool.solid));
  const left = 256 * h, right = (256 + 8 * rear) * h;
  assert.deepEqual([slab.report.volumeMM3.first, slab.report.volumeMM3.second], [fraction(left), fraction(right)]);
  proveSolid(slab.first.outcome.solid, left); proveSolid(slab.second.outcome.solid, right);
  for (const component of [slab.first, slab.second]) for (const lineage of component.lineage.faces) {
    const source = lineage.sources[0], input = source.operand === 'parent' ? prism.solid : tool.solid;
    assert.deepEqual(component.outcome.solid.request.assets.find(a => a.sourceId === lineage.output.sourceId).face.plane, input.request.assets.find(a => a.sourceId === source.sourceId).face.plane);
  }
  const chamfer = api.chamferConvexPlanarSolid(prism.solid, selection(prism), 1, chamferOptions);
  proveSolid(chamfer.split.negative.solid, parentVolume - 16); proveSolid(chamfer.split.positive.solid, 16);
  assert.deepEqual(chamfer.split.section.nodes.map(n => n.pointMM).sort(), [[0, 0, h - 1], [32, 0, h - 1], [32, 1, h], [0, 1, h]].sort());
  assert.deepEqual(authored, before);
  const result = { prism, slab, chamfer };
  if (mode === '--source') write('source-result-' + index + '.json', result); else assert.deepEqual(result, JSON.parse(readFileSync(resolve(output, 'source-result-' + index + '.json'), 'utf8')));
  summaries.push({ rear, height: h, parentVolume, left, right, chamferVolume: parentVolume - 16, parentProofEndpoints: parentProof });
  const counts = await checkpoint('variant-' + index);
  const expectedCounts = [
    { rear: 16, height: 8, compiles: 101, faces: 96, d1: 3564, exactAffine: 109 },
    { rear: 16, height: 6, compiles: 101, faces: 96, d1: 3564, exactAffine: 109 },
    { rear: 20, height: 8, compiles: 103, faces: 98, d1: 3672, exactAffine: 111 },
    { rear: 20, height: 6, compiles: 103, faces: 98, d1: 3672, exactAffine: 111 },
  ][index];
  assert.equal(rear, expectedCounts.rear); assert.equal(h, expectedCounts.height);
  assert.equal(counts.compileCadModel, expectedCounts.compiles); assert.equal(counts.buildConvexPlanarFace, expectedCounts.faces);
  assert.equal(counts.evaluateCurveD1 + counts.evaluateSurfaceD1, expectedCounts.d1);
  assert.equal(counts.ExactAffinePlane, expectedCounts.exactAffine);
  assert.ok(counts.SectionRationalContext <= 130 && counts.work <= 26000000);
}
const refusals = [];
if (mode === '--source') {
  const refuses = (name, action, pattern) => { let error; try { action(); } catch (e) { error = e; } assert.ok(error, name + ' must refuse'); const messages = []; for (let e = error; e; e = e.cause) messages.push(e.message); assert.match(messages.join(' | '), pattern); refusals.push({ name, message: messages.join(' | ') }); };
  const source = recipe('controls', 20, 6), sketch = api.buildXYAffineSketch(source.document);
  for (const bad of [{ version: 0, kind: 'coordinate-span' }, { version: 1, kind: 'normalized' }, { version: 1, kind: 'coordinate-span', hidden: true }]) refuses('invalid-policy-' + JSON.stringify(bad), () => api.buildXYAffineSketchPrism(sketch, { ...source.options, chartPolicy: bad }), /policy|fields/i);
  let getters = 0; const getter = { ...source.options }; Object.defineProperty(getter, 'chartPolicy', { enumerable: true, get() { getters++; return source.options.chartPolicy; } });
  refuses('getter-zero', () => api.buildXYAffineSketchPrism(sketch, getter), /getter/i); assert.equal(getters, 0);
  const parent = make(source), forged = structuredClone(parent); forged.solid.request.assets[0].face.pcurves[0].curve.controlPoints[0][0] += 1;
  refuses('forged-pcurve', () => api.validateXYAffineSketchPrism(forged), /differs|reconstruction/i);
  const tooWide = make(toolRecipe(6, 24));
  refuses('nonrepresentable-final-XYZ-80-over-3', () => api.subtractConvexPlanarSlab(parent.solid, tooWide.solid, slabOptions(tooWide.solid, 24)), /represent|binary64/i);
  refuses('noncardinal-chamfer', () => api.chamferConvexPlanarSolid(parent.solid, selection(parent, 'slope'), 1, chamferOptions), /cardinal|axis/i);
  const high = make(recipe('high', 16, 10)), shortTool = make(toolRecipe(8));
  refuses('tool-coverage-height10', () => api.subtractConvexPlanarSlab(high.solid, shortTool.solid, slabOptions(shortTool.solid)), /coverage|contain|cover/i);
  const legacy = make(recipe('legacy', 16, 6, false));
  refuses('legacy-normalized-height6', () => api.chamferConvexPlanarSolid(legacy.solid, selection(legacy), 1, chamferOptions), /lift|exact|represent/i);
  const normalizedRear = make(recipe('oldrear', 20, 8, false));
  refuses('legacy-normalized-rear20', () => api.subtractConvexPlanarSlab(normalizedRear.solid, shortTool.solid, slabOptions(shortTool.solid)), /lift|exact|represent/i);
  const counts = await checkpoint('explicit-refusals');
  assert.ok(counts.compileCadModel <= 390 && counts.buildConvexPlanarFace <= 370);
  assert.ok(counts.evaluateCurveD1 + counts.evaluateSurfaceD1 <= 17760);
  assert.ok(counts.ExactAffinePlane <= 450 && counts.SectionRationalContext <= 510 && counts.work <= 102000000);
}
write(mode.slice(2) + '-summary.json', { status: 'passed', pid: process.pid, summaries, refusals });
await post('Profiler.stopPreciseCoverage'); inspector.disconnect();
