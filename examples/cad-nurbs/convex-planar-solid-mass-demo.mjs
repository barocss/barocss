import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, readdirSync, statSync, statfsSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Session } from 'node:inspector';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const [mode, directory] = process.argv.slice(2);
assert.ok(['--source', '--emitted', '--cold'].includes(mode) && directory);
assert.equal(process.versions.node, '22.23.3'); assert.ok((process.env.NODE_OPTIONS ?? '').includes('--max-old-space-size=2048'));
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(directory); mkdirSync(output, { recursive: true });
const disk = statfsSync(output); assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024);
const nativeJSON = v => typeof v === 'number' && Object.is(v, -0) ? '-0' : Array.isArray(v) ? '[' + v.map(nativeJSON).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ':' + nativeJSON(x)).join(',') + '}' : JSON.stringify(v);
let written = 0;
const write = (name, value) => { const data = nativeJSON(value) + '\n', bytes = Buffer.byteLength(data); written += bytes; assert.ok(bytes <= 16 * 1024 * 1024 && written <= 96 * 1024 * 1024 && readdirSync(output).reduce((n, p) => n + statSync(resolve(output, p)).size, 0) + bytes <= 128 * 1024 * 1024); writeFileSync(resolve(output, name), data); };
const read = name => JSON.parse(readFileSync(resolve(output, name), 'utf8'));
let api, firstFailureCoverage;
process.on('uncaughtException', async error => { if (firstFailureCoverage) await firstFailureCoverage(); write('first-failure-' + mode.slice(2) + '-' + process.pid + '.json', { message: error.message, stack: error.stack, cause: error.cause?.message ?? null }); process.exitCode = 1; });
if (mode === '--source') {
  const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
  const built = await require('esbuild').build({ entryPoints: [resolve(repo, 'packages/barocss-cad/src/index.ts')], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
  assert.ok(Object.keys(built.metafile.inputs).every(p => !p.includes('/dist/'))); write('source-inputs.json', Object.keys(built.metafile.inputs));
  assert.ok(built.outputFiles[0].contents.length <= 16 * 1024 * 1024); const path = resolve(output, 'mass-source.mjs'); writeFileSync(path, built.outputFiles[0].text); api = await import(pathToFileURL(path));
} else api = await import(pathToFileURL(resolve(repo, 'packages/barocss-cad/dist/index.js')));
const inspector = new Session(); inspector.connect();
const post = (method, params = {}) => new Promise((ok, no) => inspector.post(method, params, (e, r) => e ? no(e) : ok(r)));
await post('Profiler.enable'); await post('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
const names = ['measureConvexPlanarSolidMass', 'validateConvexPlanarSolidMass', 'validateConvexPlanarSolid', 'qualifyConvexPlanarSolid', 'buildConvexPlanarFace', 'compileCadModel', 'evaluateCurveD1', 'evaluateSurfaceD1', 'SectionRationalContext', 'work'];
const steps = [], coverage = [];
async function checkpoint(label) { const data = await post('Profiler.takePreciseCoverage'); coverage.push({ timestamp: data.timestamp, result: data.result.map(script => ({ ...script, functions: script.functions.filter(f => names.includes(f.functionName)) })).filter(script => script.functions.length) }); const counts = Object.fromEntries(names.map(name => [name, data.result.flatMap(s => s.functions.filter(f => f.functionName === name)).reduce((n, f) => n + f.ranges[0].count, 0)])); steps.push({ label, counts }); return counts; }
firstFailureCoverage = async () => { await checkpoint('first-failure'); write(mode.slice(2) + '-failed-coverage-' + process.pid + '.json', coverage); };
// Independent polynomial area/line-extrusion oracle. No CAD helper or tetrahedral integration is imported.
const gcd = (a, b) => { a = a < 0n ? -a : a; while (b) [a, b] = [b, a % b]; return a; };
const rat = (n, d = 1n) => { n = BigInt(n); d = BigInt(d); if (d < 0n) [n, d] = [-n, -d]; const g = gcd(n, d); return { n: n / g, d: d / g }; };
const add = (a, b) => rat(a.n * b.d + b.n * a.d, a.d * b.d), neg = a => rat(-a.n, a.d), sub = (a, b) => add(a, neg(b)), mul = (a, b) => rat(a.n * b.n, a.d * b.d), div = (a, b) => rat(a.n * b.d, a.d * b.n), sum = xs => xs.reduce(add, rat(0));
const text = a => ({ numerator: String(a.n), denominator: String(a.d) }), parse = a => rat(a.numerator, a.denominator), equal = (a, b) => assert.deepEqual(text(a), text(b));
const vector = xs => xs.map(text), matrix = xs => xs.map(vector), scalar = n => rat(n);
function represented(value) { const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value); const bits = view.getBigUint64(0), exponent = Number((bits >> 52n) & 2047n), significand = (bits & ((1n << 52n) - 1n)) + (exponent ? 1n << 52n : 0n), power = exponent ? exponent - 1075 : -1074, signed = bits >> 63n ? -significand : significand; return power >= 0 ? rat(signed << BigInt(power)) : rat(signed, 1n << BigInt(-power)); }
function projection(exact, value, bound) { const error = sub(parse(exact), represented(value)), absolute = error.n < 0n ? neg(error) : error; assert.deepEqual(bound.exact, text(absolute)); assert.ok(sub(represented(bound.upper), absolute).n >= 0n); if (bound.upper > 0) { const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, bound.upper); view.setBigUint64(0, view.getBigUint64(0) - 1n); assert.ok(sub(represented(view.getFloat64(0)), absolute).n < 0n); } }

function polygon(points) {
  let A = rat(0), x = rat(0), y = rat(0), xx = rat(0), yy = rat(0), xy = rat(0);
  for (let i = 0; i < points.length; i++) { const [a, b] = points[i].map(scalar), [c, d] = points[(i + 1) % points.length].map(scalar), cross = sub(mul(a, d), mul(c, b));
    A = add(A, div(cross, rat(2))); x = add(x, div(mul(add(a, c), cross), rat(6))); y = add(y, div(mul(add(b, d), cross), rat(6)));
    xx = add(xx, div(mul(sum([mul(a, a), mul(a, c), mul(c, c)]), cross), rat(12))); yy = add(yy, div(mul(sum([mul(b, b), mul(b, d), mul(d, d)]), cross), rat(12)));
    xy = add(xy, div(mul(sum([mul(rat(2), mul(a, b)), mul(a, d), mul(c, b), mul(rat(2), mul(c, d))]), cross), rat(24)));
  } return { A, first: [x, y], second: [[xx, xy], [xy, yy]] };
}
function prismOracle(points, lo, hi, order = [0, 1, 2]) {
  const p = polygon(points), h = rat(hi - lo), z = div(rat(hi * hi - lo * lo), rat(2)), zz = div(rat(hi ** 3 - lo ** 3), rat(3));
  const localFirst = [...p.first.map(x => mul(x, h)), mul(p.A, z)], localSecond = [[mul(p.second[0][0], h), mul(p.second[0][1], h), mul(p.first[0], z)], [mul(p.second[1][0], h), mul(p.second[1][1], h), mul(p.first[1], z)], [mul(p.first[0], z), mul(p.first[1], z), mul(p.A, zz)]];
  return { volume: mul(p.A, h), first: order.map(i => localFirst[i]), second: order.map(i => order.map(j => localSecond[i][j])) };
}
function difference(a, b) { return { volume: sub(a.volume, b.volume), first: a.first.map((v, i) => sub(v, b.first[i])), second: a.second.map((r, i) => r.map((v, j) => sub(v, b.second[i][j]))) }; }
function translated(a, shift) { const t = shift.map(scalar); return { volume: a.volume, first: a.first.map((x, i) => add(x, mul(a.volume, t[i]))), second: a.second.map((r, i) => r.map((x, j) => sum([x, mul(t[i], a.first[j]), mul(t[j], a.first[i]), mul(a.volume, mul(t[i], t[j]))]))) }; }
function prove(result, oracle, density = 1000) {
  const m = result.measure, e = m.exact, c = oracle.first.map(x => div(x, oracle.volume)), central = oracle.second.map((r, i) => r.map((x, j) => sub(x, div(mul(oracle.first[i], oracle.first[j]), oracle.volume))));
  assert.deepEqual(e.volumeMM3, text(oracle.volume)); assert.deepEqual(e.firstMomentsMM4, vector(oracle.first)); assert.deepEqual(e.secondMomentsMM5, matrix(oracle.second)); assert.deepEqual(e.centroidMM, vector(c)); assert.deepEqual(e.centralSecondMomentsMM5, matrix(central));
  assert.deepEqual(e.massKG, text(mul(oracle.volume, div(represented(density), rat(1000000000)))));
  projection(e.volumeMM3, m.volumeMM3, m.conversionErrors.volumeMM3); projection(e.massKG, m.massKG, m.conversionErrors.massKG);
  for (let i = 0; i < 3; i++) { projection(e.centroidMM[i], m.centroidMM[i], m.conversionErrors.centroidMM[i]); for (let j = 0; j < 3; j++) for (const key of ['inertiaCentroidKgM2', 'inertiaOriginKgM2']) projection(e[key][i][j], m[key][i][j], m.conversionErrors[key][i][j]); }

  const tensor = Q => { const trace = sum([Q[0][0], Q[1][1], Q[2][2]]); return Q.map((r, i) => r.map((v, j) => mul(div(represented(density), rat(1000000000000000)), i === j ? sub(trace, v) : neg(v)))); };
  assert.deepEqual(e.inertiaCentroidKgM2, matrix(tensor(central))); assert.deepEqual(e.inertiaOriginKgM2, matrix(tensor(oracle.second)));
  for (const [key, stored] of [['inertiaCentroidKgM2', m.inertiaCentroidKgM2], ['inertiaOriginKgM2', m.inertiaOriginKgM2]]) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { assert.equal(Object.is(stored[i][j], stored[j][i]), true); if (e[key][i][j].numerator === '0') assert.equal(Object.is(stored[i][j], 0), true); }
  assert.ok(m.positiveDefinite.exactCentroidLeadingMinors.every(x => BigInt(x.numerator) > 0n)); assert.ok(m.positiveDefinite.storedCentroidLeadingMinors.every(x => BigInt(x.numerator) > 0n));
  assert.equal(result.report.directCounts.parentValidationCount, 1); assert.equal(result.report.directCounts.finalValueConversions, 17); assert.equal(result.report.directCounts.errorBoundConversions, 17);
  assert.equal(result.report.exactWork.aggregateOperations, result.report.exactWork.parent.operations + result.report.exactWork.integration.operations);
  assert.ok(result.report.exactWork.aggregateOperations <= 400000); assert.ok(result.report.exactWork.integration.floatSearchSteps <= 2176);
  assert.deepEqual(result.report.parentNativeWork, result.solid.report.childNativeWork); assert.deepEqual(result.report.exactWork.parent, result.solid.report.exactWork);
}
function recipe(id, coordinates, chart, height = 8) {
  const points = coordinates.map((position, i) => ({ id: 'p' + i, position })), segments = points.map((p, i) => ({ id: 'edge' + i, startPointId: p.id, endPointId: points[(i + 1) % points.length].id }));
  return { document: { format: 'barocss-xy-affine-sketch', version: 0, profile: 'exact-affine-binary64', id: id + '_sketch', lengthUnit: 'mm', points, segments, referenceLines: [], constraints: points.map(p => ({ id: 'fix_' + p.id, kind: 'fixed', pointId: p.id, target: [...p.position] })) }, prismOptions: { sourceId: id + '_source', sourceRevision: 3, orderedSegmentIds: segments.map(s => s.id), heightMM: height, capChart: { originXY: [-0, 0], spanXY: chart }, solidId: id + '_solid', resultIdPrefix: id } };
}
const make = r => api.buildXYAffineSketchPrism(api.buildXYAffineSketch(r.document), r.prismOptions);
const polygonPoints = [[-0, 0], [32, 0], [32, 16], [16, 32], [0, 32]], baseOracle = prismOracle(polygonPoints, 0, 8), shift = [1024, -2048, 4096];
const wedgeOracle = d => prismOracle([[0, 8 - d], [d, 8], [0, 8]], 0, 32, [2, 0, 1]);
const oracles = [baseOracle, difference(baseOracle, wedgeOracle(2)), wedgeOracle(2), difference(baseOracle, wedgeOracle(1)), wedgeOracle(1), translated(baseOracle, shift), prismOracle([[0, 0], [10, 0], [10, 20], [0, 20]], 0, 30), baseOracle, baseOracle];
const labels = ['prism', 'chamfer2-retained', 'chamfer2-wedge', 'chamfer1-retained', 'chamfer1-wedge', 'translated-prism', 'analytic-box', 'density2000', 'density0_1'];
let parents, authored;
if (mode === '--source') {
  authored = recipe('mass', polygonPoints, [32, 32]); const prism = make(authored), parent = prism.solid;
  const lineage = prism.lineage.segments.find(s => s.segmentId === 'edge0'), edge = parent.graph.edges.find(e => e.id === lineage.topEdgeId);
  const ref = u => ({ sourceId: u.sourceId, faceId: u.faceId, surfaceId: u.surfaceId, loopId: u.loopId, useId: u.use.id, curveId: u.use.curveId, pcurveId: u.use.pcurveId });
  const selection = { parentSolidId: parent.report.solidId, a: ref(edge.uses[0]), b: ref(edge.uses[1]) }, options = { operationId: 'mass_chamfer', resultIdPrefix: 'mc', retainedSolidId: 'retained_mass', removedSolidId: 'removed_mass' };
  const cuts = [2, 1].map(d => api.chamferConvexPlanarSolid(parent, selection, d, options));
  const move = p => p.map((x, i) => x + shift[i]);
  const assets = parent.request.assets.map(a => ({ sourceId: a.sourceId, face: api.buildConvexPlanarFace({ ...a.face.plane, controlPoints: a.face.plane.controlPoints.map(row => row.map(move)) }, { ...a.face.loop, edges: a.face.loop.edges.map(e => ({ ...e, controlPoints: e.controlPoints.map(move) })) }, a.face.options) }));
  const translatedParent = api.qualifyConvexPlanarSolid(assets, parent.request.edgePairs, { solidId: 'translated_mass', resultIdPrefix: 'mt' });
  const box = make(recipe('box', [[0, 0], [10, 0], [10, 20], [0, 20]], [16, 32], 30)).solid;
  parents = [parent, ...cuts.flatMap(c => [c.split.negative.solid, c.split.positive.solid]), translatedParent, box, parent, parent];
  assert.equal(prism.lineage.sourceRevision, 3); write('authored-recipe.json', authored); write('authored-prism.json', prism); write('authored-chamfer-request.json', { selection, options, distancesMM: [2, 1] });
  parents.forEach((p, i) => write('parent-' + labels[i] + '.json', p));
  await checkpoint('bounded-authored-producers');
} else { authored = read('authored-recipe.json'); parents = labels.map(name => read('parent-' + name + '.json')); }
let attempts = 0, validations = 0;
function measure(parent, density = 1000, maximumFanTriangles = 40) { attempts++; return api.measureConvexPlanarSolidMass(parent, { densityKgPerM3: density, maximumFanTriangles }); }
function validate(result) { validations++; return api.validateConvexPlanarSolidMass(result); }
const results = [];
if (mode === '--cold') {
  const fresh = make(authored); assert.deepEqual(fresh, read('authored-prism.json')); await checkpoint('cold-authored-reconstruction');
  const result = measure(fresh.solid); prove(result, baseOracle); assert.deepEqual(result, read('source-prism.json')); assert.deepEqual(validate(read('source-prism.json')), result.report);
  const counts = await checkpoint('cold-measure-owned'); assert.equal(counts.validateConvexPlanarSolid, 2); assert.equal(counts.qualifyConvexPlanarSolid, 0); assert.equal(counts.buildConvexPlanarFace, 14);
} else {
  for (let i = 0; i < parents.length; i++) {
    const before = structuredClone(parents[i]), result = measure(parents[i], i === 7 ? 2000 : i === 8 ? 0.1 : 1000); results.push(result); prove(result, oracles[i], i === 7 ? 2000 : i === 8 ? 0.1 : 1000); assert.deepEqual(parents[i], before); assert.deepEqual(result.solid, parents[i]);
    const counts = await checkpoint(labels[i]); assert.equal(counts.validateConvexPlanarSolid, 1); assert.equal(counts.qualifyConvexPlanarSolid, 0); assert.equal(counts.buildConvexPlanarFace, result.solid.graph.faces.length); assert.equal(counts.compileCadModel, result.solid.graph.faces.length); assert.equal(counts.evaluateCurveD1 + counts.evaluateSurfaceD1, result.report.parentNativeWork.totalD1Count);
    assert.equal(counts.work, result.report.exactWork.aggregateOperations); assert.equal(counts.SectionRationalContext, 2);
    if (mode === '--source') write('source-' + labels[i] + '.json', result); else assert.deepEqual(result, read('source-' + labels[i] + '.json'));
  }
  assert.notEqual(results[0].measure.exact.inertiaCentroidKgM2[0][1].numerator, '0');
  assert.deepEqual(results[0].measure.exact.inertiaCentroidKgM2, results[5].measure.exact.inertiaCentroidKgM2);
  for (let i = 0; i < 3; i++) equal(parse(results[5].measure.exact.centroidMM[i]), add(parse(results[0].measure.exact.centroidMM[i]), rat(shift[i])));
  assert.deepEqual(results[6].measure.centroidMM, [5, 10, 15]); assert.deepEqual(results[6].measure.inertiaCentroidKgM2, [[6.5e-7, 0, 0], [0, 5e-7, 0], [0, 0, 2.5e-7]]);
  for (const [a, b] of [[1, 2], [3, 4]]) { equal(add(parse(results[a].measure.exact.massKG), parse(results[b].measure.exact.massKG)), parse(results[0].measure.exact.massKG)); for (let i = 0; i < 3; i++) { equal(add(parse(results[a].measure.exact.firstMomentsMM4[i]), parse(results[b].measure.exact.firstMomentsMM4[i])), parse(results[0].measure.exact.firstMomentsMM4[i])); for (let j = 0; j < 3; j++) equal(add(parse(results[a].measure.exact.secondMomentsMM5[i][j]), parse(results[b].measure.exact.secondMomentsMM5[i][j])), parse(results[0].measure.exact.secondMomentsMM5[i][j])); } }
  for (const [a, b] of [[1, 2], [3, 4]]) {
    const whole = results[0].measure.exact, C = whole.centroidMM.map(parse);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const combined = sum([a, b].map(k => { const e = results[k].measure.exact, delta = e.centroidMM.map((x, axis) => sub(parse(x), C[axis])), norm = sum(delta.map(x => mul(x, x))), term = i === j ? sub(norm, mul(delta[i], delta[i])) : neg(mul(delta[i], delta[j])); return add(parse(e.inertiaCentroidKgM2[i][j]), mul(div(parse(e.massKG), rat(1000000)), term)); }));
      equal(combined, parse(whole.inertiaCentroidKgM2[i][j]));
    }
  }
  equal(parse(results[7].measure.exact.massKG), mul(rat(2), parse(results[0].measure.exact.massKG)));
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) equal(parse(results[7].measure.exact.inertiaCentroidKgM2[i][j]), mul(rat(2), parse(results[0].measure.exact.inertiaCentroidKgM2[i][j])));
  const seen = new WeakSet(), caller = new WeakSet(); function collect(v) { if (v && typeof v === 'object' && !caller.has(v)) { caller.add(v); Object.values(v).forEach(collect); } } collect(parents[0]);
  function owned(v) { if (v && typeof v === 'object') { assert.ok(!caller.has(v) && !seen.has(v)); seen.add(v); Object.values(v).forEach(owned); } } owned(results[0]);
  assert.ok(Object.is(results[0].solid.request.assets[0].face.plane.controlPoints[0][0][0], -0));
  assert.deepEqual(validate(results[0]), results[0].report); const ownedCounts = await checkpoint('whole-owned-result'); assert.equal(ownedCounts.validateConvexPlanarSolid, 1); assert.equal(ownedCounts.measureConvexPlanarSolidMass, 0); assert.equal(ownedCounts.qualifyConvexPlanarSolid, 0); assert.equal(ownedCounts.buildConvexPlanarFace, 7);
}
const failures = [];
if (mode === '--source') {
  const stableParent = nativeJSON(parents[0]), stableResult = nativeJSON(results[0]);
  async function reject(name, action, code, parentCalls = 0) { let found; try { action(); } catch (e) { found = e; } assert.ok(found instanceof api.ConvexPlanarSolidMassError, name + ': ' + found); if (code) assert.equal(found.code, code, name); const counts = await checkpoint('refusal-' + name); assert.equal(counts.validateConvexPlanarSolid, parentCalls, name); assert.equal(counts.qualifyConvexPlanarSolid, 0); failures.push({ name, code: found.code, causeName: found.cause?.name ?? null, causeCode: found.cause?.code ?? null, cause: found.cause?.message ?? null, counts, nativeCompletion: counts.buildConvexPlanarFace === 7 ? 'complete-parent-face-reconstruction' : counts.buildConvexPlanarFace ? 'partial-parent-work' : 'none' }); assert.equal(nativeJSON(parents[0]), stableParent); assert.equal(nativeJSON(results[0]), stableResult); }
  for (const [label, density] of [['zero', 0], ['negative', -1], ['excess', 1000001], ['nan', NaN], ['infinity', Infinity]]) await reject('density-' + label, () => measure(parents[0], density), 'INPUT');
  for (const budget of [0, 41, 15]) await reject('fan-' + budget, () => measure(parents[0], 1000, budget), 'BUDGET');
  const inventory = structuredClone(parents[0]); inventory.graph.faces.pop(); await reject('inventory', () => measure(inventory), 'BINDING');
  let getterCalls = 0; const getter = {}; Object.defineProperty(getter, 'solid', { enumerable: true, get() { getterCalls++; return parents[0]; } }); await reject('getter', () => measure(getter), 'INPUT'); assert.equal(getterCalls, 0);
  await reject('proxy-prototype', () => measure(new Proxy({}, { getPrototypeOf() { throw new Error('prototype trap'); } })), 'INPUT');
  await reject('proxy-descriptors', () => measure(new Proxy({}, { ownKeys() { throw new Error('own keys trap'); } })), 'INPUT');
  const symbol = { [Symbol('hidden')]: 1 }; await reject('symbol', () => measure(symbol), 'INPUT');
  const hidden = {}; Object.defineProperty(hidden, 'x', { value: 1 }); await reject('hidden', () => measure(hidden), 'INPUT');
  let deep = {}; for (let i = 0; i < 42; i++) deep = { next: deep }; await reject('depth-budget', () => measure(deep), 'BUDGET');
  await reject('array-budget', () => measure({ x: Array(4097).fill(0) }), 'BUDGET');
  const sparse = structuredClone(parents[0]); delete sparse.graph.faces[0]; await reject('sparse', () => measure(sparse), 'INPUT');
  const cycle = structuredClone(parents[0]); cycle.graph.faces[0] = cycle; await reject('cycle', () => measure(cycle), 'INPUT');
  await reject('nonzero-mass-underflow', () => measure(parents[0], Number.MIN_VALUE), 'REPRESENTABILITY', 1);
  const parentMutations = [
    ['source-version', p => { p.request.assets[0].face.sourceVersion = 1; }],
    ['source-text', p => { p.request.assets[0].face.source += ' /* stale */'; }],
    ['certificate', p => { p.certificate.volumeMM3.numerator = '1'; }],
    ['graph-point', p => { p.graph.vertices[0].pointMM[0] += 1; }],
  ];
  for (const [name, mutate] of parentMutations) { const p = structuredClone(parents[0]); mutate(p); await reject(name, () => measure(p), 'PARENT', 1); }
  const ownedMutations = [
    ['mass', r => { r.measure.massKG *= 2; }], ['centroid', r => { r.measure.centroidMM[0] += 1; }], ['tensor', r => { r.measure.inertiaCentroidKgM2[0][1] += 1; }],
    ['source', r => { r.solid.request.assets[0].face.source += ' /* stale */'; }], ['work', r => { r.report.exactWork.aggregateOperations++; }],
    ['exact', r => { r.measure.exact.secondMomentsMM5[0][0].numerator = '1'; }], ['conversion', r => { r.measure.conversionErrors.massKG.upper += 1; }],
  ];
  for (const [name, mutate] of ownedMutations) { const r = structuredClone(results[0]); mutate(r); await reject('owned-' + name, () => validate(r), name === 'source' ? 'PARENT' : 'OWNED', 1); }
  assert.equal(failures.length, 30); assert.equal(attempts, 32); assert.equal(validations, 8);
  // Retained saved inputs/results are independently re-read after every refusal campaign.
  parents.forEach((p, i) => assert.deepEqual(read('parent-' + labels[i] + '.json'), p)); results.forEach((r, i) => assert.deepEqual(read('source-' + labels[i] + '.json'), r));
}
if (mode !== '--source') { const dts = readFileSync(resolve(repo, 'packages/barocss-cad/dist/index.d.ts'), 'utf8'); for (const name of ['measureConvexPlanarSolidMass', 'validateConvexPlanarSolidMass', 'ConvexPlanarSolidMassError', 'ConvexPlanarSolidMassDiagnosticCode', 'ConvexPlanarSolidMassOptions', 'ConvexPlanarSolidMassMeasure', 'ConvexPlanarSolidMassReport', 'ConvexPlanarSolidMassResult']) assert.ok(dts.includes(name), name); }
await checkpoint('final'); await post('Profiler.stopPreciseCoverage'); inspector.disconnect();
const summary = { mode, pid: process.pid, acceptedMeasurements: mode === '--cold' ? 1 : 9, attempts, validations, refusals: failures.length, exactIndependentOracles: 'Green polygon moments plus line extrusion and exact translation; no tetrahedral oracle', volumesMM3: results.map(r => r.measure.exact.volumeMM3), steps, failures };
write(mode.slice(2) + '-summary.json', summary); write(mode.slice(2) + '-coverage.json', coverage); process.stdout.write(JSON.stringify({ mode, status: 'passed', pid: process.pid, attempts, validations, refusals: failures.length }) + '\n');
