import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node paired-surface-uv-split-faces-demo.mjs --source <output-directory>');
assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]);
mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const bundle = await require('esbuild').build({ entryPoints: [resolve(repo, 'packages/barocss-cad/src/index.ts')], absWorkingDir: repo, bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
assert.equal(bundle.outputFiles.length, 1);
const inputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path));
for (const leaf of ['paired-surface-uv-split-faces.ts', 'paired-surface-uv-split-faces-proof-internal.ts', 'exact-paired-vlinear-surface-intersection.ts', 'surface-isocurve.ts', 'source-curve-interval-extraction.ts', 'source-surface-control-net-wide.ts']) assert.ok(inputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
assert.ok(!inputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const { buildPairedSurfaceUVSplitFaces: build, validatePairedSurfaceUVSplitFaces: validate, PairedSurfaceUVSplitFacesError: FamilyError, PairedSurfaceUVSplitFacesDiagnosticCode: codes, buildExactPairedVLinearSurfaceIntersection: sectionBuild, compileCadModel, evaluateCurve, evaluateCurveD1, evaluateSurface, evaluateSurfaceD1, editSourceSurfaceControlNetWide, validateSourceSurfaceControlNetWideEdit } = api;
const runtimeNames = ['buildPairedSurfaceUVSplitFaces', 'validatePairedSurfaceUVSplitFaces', 'PairedSurfaceUVSplitFacesError', 'PairedSurfaceUVSplitFacesDiagnosticCode'];
const typeNames = ['PairedSurfaceUVSplitFacesRequest', 'PairedSurfaceUVSplitFacesOptions', 'PairedSurfaceUVSplitFacesReport', 'PairedSurfaceUVSplitFacesResult'];
for (const name of runtimeNames) assert.equal(typeof api[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(Object.keys(codes).sort(), ['INPUT', 'IDENTITY', 'PARENT', 'SUPPORT', 'DOMAIN', 'ISO', 'INTERVAL', 'REGION', 'REPRESENTABILITY', 'BINDING', 'NATIVE', 'BUDGET', 'FILE', 'OWNED'].sort());

function nativeJSON(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}';
}
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : nativeJSON(value)).digest('hex');
const size = text => ({ utf16: text.length, utf8: Buffer.byteLength(text) });
const files = new Map(), retained = [], failures = [], ownControls = [], cases = [], coldContexts = new Map();
const additionalWork = { sectionBuilds: 0, faceBuilds: 0, ownedCalls: 0, coldCompiles: 0, editorCalls: 0, editorOwnedCalls: 0, curveD0Calls: 0, curveD1Calls: 0, surfaceD0Calls: 0, surfaceD1Calls: 0, publicBuilds: 0, publicOwnedCalls: 0 };
function saveText(name, text) { const path = resolve(output, name); writeFileSync(path, text); assert.equal(readFileSync(path, 'utf8'), text); files.set(path, readFileSync(path)); return path; }
function saveJSON(name, value, maximum = 16777216) { const text = nativeJSON(value) + '\n'; assert.ok(text.length <= maximum && Buffer.byteLength(text) <= maximum, name); const path = saveText(name + '.json', text); assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), value); return path; }
function compile(source) { additionalWork.coldCompiles++; const result = compileCadModel(source, { sourceVersion: 0 }); assert.equal(result.ok, true, JSON.stringify(result.diagnostics)); return result.model; }
function cold(source, model, field) { const key = hash(source) + ':' + hash(model); if (!coldContexts.has(key)) { const name = 'cold-' + coldContexts.size, path = saveText(name + '.source0.css', source); assert.deepEqual(compile(readFileSync(path, 'utf8')), model); saveJSON(name + '-model', model); coldContexts.set(key, { sourceHash: hash(source), modelHash: hash(model), path }); } return { field, ...coldContexts.get(key) }; }
function retention() { for (const [path, bytes] of files) assert.deepEqual(readFileSync(path), bytes); for (const [value, text] of retained) assert.equal(nativeJSON(value), text); }
function ownValues(value) { return !value || typeof value !== 'object' ? 1 : 1 + Object.values(value).reduce((n, child) => n + ownValues(child), 0); }
function noAliases(input, result) { const caller = new WeakSet(); const collect = value => { if (value && typeof value === 'object') { caller.add(value); Object.values(value).forEach(collect); } }; collect(input); const visit = value => { if (value && typeof value === 'object') { assert.ok(!caller.has(value)); Object.values(value).forEach(visit); } }; visit(result); }
const knots = (a, b, p) => [...Array(p + 1).fill(a), ...Array(p + 1).fill(b)];
const domain = c => [c.knots[c.degree], c.knots[c.controlPoints.length]];
const near = (a, b) => { const gap = Math.hypot(...a.map((x, i) => x - b[i])); assert.ok(Number.isFinite(gap) && gap <= 1e-7, nativeJSON({ a, b, gap })); };
function reject(name, action, expected) { let error; try { action(); } catch (cause) { error = cause; } assert.ok(error instanceof FamilyError, name + ': actual family error'); if (expected) assert.ok([].concat(expected).includes(error.code), name + ': ' + error.code); assert.ok(error.context?.directCounts); const record = { name, code: error.code, message: error.message, context: error.context, causeName: error.cause?.name ?? null, causeMessage: error.cause?.message ?? null }; failures.push(record); retention(); return record; }
function sourceFor(s, index) {
  const curve = '@curve #curve_sibling {type:nurbs;degree:1;knots:[0.000,0,1,1.00];control-points:[[-0,2,1],[3,4,2]];weights:[1,2];}';
  const sibling = '@surface #native_wide_sibling {type:nurbs;degree-u:1;degree-v:1;knots-u:[0,0,1,1];knots-v:[-1,-1,2,2];control-points:[[[12000,2,-0],[12000,4,1]],[[12002,2,2],[12002,4,3]]];weights:[[1,2],[3,4]];}';
  const selected = '@surface #' + s.id + ' {type:nurbs;degree-u:' + s.degreeU + ';degree-v:' + s.degreeV + ';knots-u:' + nativeJSON(s.knotsU) + ';knots-v:' + nativeJSON(s.knotsV) + ';control-points:' + nativeJSON(s.controlPoints) + ';weights:' + nativeJSON(s.weights) + ';}';
  return '/* 설계: complementary original-A charts. */\r\n@model intersection_model {version:0;length-unit:mm;\r\n' + (index === 1 ? [curve, selected, sibling] : [sibling, curve, selected]).join('\r\n') + '\r\n}\r\n';
}
const A = { kind: 'surface', id: 'support', degreeU: 2, degreeV: 1, knotsU: knots(-1, 1, 2), knotsV: knots(-.5, 1.5, 1), controlPoints: [-1, 0, 1].map((x, i) => [-.5, 1.5].map(y => [x, y, [1, -1, 1][i]])), weights: Array.from({ length: 3 }, () => [1, 1]) };
const B = { kind: 'surface', id: 'support', degreeU: 2, degreeV: 1, knotsU: knots(2, 4, 2), knotsV: knots(-.25, 1.25, 1), controlPoints: [-1, 0, 1].map((x, i) => [-.25, 1.25].map(z => [x, [1, -1, 1][i], z])), weights: Array.from({ length: 3 }, () => [1, 1]) };
const assets = [A, B].map((surface, i) => { const source = sourceFor(surface, [1, 2][i]); assert.deepEqual(compile(source).objects[[1, 2][i]], surface); return { sourceId: ['source_a', 'source_b'][i], source, surface: structuredClone(surface) }; });
const sectionRequest = { assets, uAInterval: [-1, .5], options: { evaluationId: 'split_section', worldCurveId: 'split_cut', pcurveAId: 'split_cut_uv_a', pcurveBId: 'split_cut_uv_b', maximumObservations: 5 } };
additionalWork.sectionBuilds++; const mainSection = sectionBuild(sectionRequest);
const options = { evaluationId: 'split_faces', resultIdPrefix: 'pf', orientation: 'forward', maximumIsoCurves: 2, maximumIntervals: 2, maximumObservations: 35 };
const mainRequest = { section: mainSection, options };
const roles = ['bottom', 'rightLow', 'rightHigh', 'top', 'leftLow', 'leftHigh', 'sharedCut'];
function reserved(o) { const p = o.resultIdPrefix; const ids = [o.evaluationId, p + '_bottom', p + '_top', p + '_right_low', p + '_right_high', p + '_left_low', p + '_left_high']; for (const [suffix, count] of [['uv', 6], ['v', 6], ['e', 7], ['l', 2], ['f', 2], ['use', 8]]) for (let i = 0; i < count; i++) ids.push(p + '_' + suffix + i); assert.equal(ids.length, 38); assert.equal(new Set(ids).size, 38); return ids; }

// Small exact polynomial oracle; it checks actual returned coefficients, not a new geometry kernel.
const arithmetic = { operations: 0, maximumBits: 0, comparisons: 0 };
function work() { assert.ok(++arithmetic.operations <= 2000000); }
function sized(n) { work(); const bits = (n < 0n ? -n : n).toString(2).length; assert.ok(bits <= 8192); arithmetic.maximumBits = Math.max(arithmetic.maximumBits, bits); return n; }
function q(n, d = 1n) { sized(n); sized(d); assert.notEqual(d, 0n); if (d < 0n) { n = -n; d = -d; } let a = n < 0n ? -n : n, b = d; while (b) { work(); const r = sized(a % b); a = b; b = r; } const g = a || 1n; return { n: n / g, d: d / g }; }
const storage = new DataView(new ArrayBuffer(8));
function represented(x) { assert.ok(Number.isFinite(x)); storage.setFloat64(0, x); const bits = storage.getBigUint64(0), e = Number((bits >> 52n) & 2047n), f = bits & 0xfffffffffffffn, m = e ? f + (1n << 52n) : f, n = bits >> 63n ? -m : m, p = e ? e - 1075 : -1074; return p >= 0 ? q(sized(n << BigInt(p))) : q(n, sized(1n << BigInt(-p))); }
const Z = q(0n), ONE = q(1n);
const add = (a, b) => q(sized(sized(a.n * b.d) + sized(b.n * a.d)), sized(a.d * b.d));
const neg = a => q(-a.n, a.d);
const sub = (a, b) => add(a, neg(b));
const mul = (a, b) => q(sized(a.n * b.n), sized(a.d * b.d));
const dto = f => { assert.ok(f.numerator.length <= 5000 && f.denominator.length <= 5000); return q(BigInt(f.numerator), BigInt(f.denominator)); };
const eq = (a, b) => { arithmetic.comparisons++; assert.equal(sized(a.n * b.d), sized(b.n * a.d)); };
function zeros(value) { if (Array.isArray(value)) value.forEach(zeros); else eq(dto(value), Z); }
const choose = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - i + 1) / i; return r; };
function power(values) { const p = values.length - 1, out = Array(p + 1).fill(Z); values.forEach((v, i) => { for (let j = i; j <= p; j++) out[j] = add(out[j], mul(v, q(BigInt(choose(p, i) * choose(p - i, j - i) * ((j - i) % 2 ? -1 : 1))))); }); return out; }
function plus(a, b) { return Array.from({ length: Math.max(a.length, b.length) }, (_, i) => add(a[i] ?? Z, b[i] ?? Z)); }
function scale(a, b) { return a.map(v => mul(v, b)); }
function product(a, b) { const out = Array(a.length + b.length - 1).fill(Z); a.forEach((v, i) => b.forEach((w, j) => { out[i + j] = add(out[i + j], mul(v, w)); })); return out; }
function equalPolys(a, b) { for (let i = 0; i < Math.max(a.length, b.length); i++) eq(a[i] ?? Z, b[i] ?? Z); }
function elevate(values) { const p = values.length - 1; return Array.from({ length: 5 }, (_, i) => { let out = Z; for (let j = Math.max(0, i - (4 - p)); j <= Math.min(p, i); j++) out = add(out, mul(values[j], q(BigInt(choose(p, j) * choose(4 - p, i - j)), BigInt(choose(4, i))))); return out; }); }
function entireEdge(edge, proof, edited) {
  const uvPower = [0, 1].map(axis => power(edge.pcurve.curve.controlPoints.map(p => represented(p[axis]))));
  const u2 = product(uvPower[0], uvPower[0]);
  const z = edited ? plus(u2, scale(product(plus([ONE], scale(u2, q(-1n))), plus([q(3n, 2n)], scale(uvPower[1], q(-1n)))), q(1n, 32n))) : u2;
  const expected = [uvPower[0], uvPower[1], z];
  [0, 1, 2].forEach(axis => {
    equalPolys(power(edge.curve.controlPoints.map(p => represented(p[axis]))), expected[axis]);
    const world = elevate(edge.curve.controlPoints.map(p => represented(p[axis]))), uv = elevate(edge.pcurve.curve.controlPoints.map(p => represented(p[axis])));
    world.forEach((v, i) => { eq(dto(proof.worldCartesian[i][axis]), v); eq(dto(proof.composedSurfaceCartesian[i][axis]), v); }); uv.forEach((v, i) => eq(dto(proof.uvCartesian[i][axis]), v));
  });
  zeros(proof.residuals); eq(dto(proof.wholeGap.exact), Z); assert.equal(proof.wholeGap.upper, 0);
}
const successCounts = { parentValidationCount: 1, isoCurveExtractionCount: 2, sourceIntervalExtractionCount: 2, sideWorldValidationCount: 4, newUVValidationCount: 6, worldModelAdoptionCount: 1, observationCount: 35, curveD0Count: 70, curveD1AttemptCount: 70, surfaceD0Count: 35, surfaceD1AttemptCount: 35, rationalFloatConversionCount: 0 };
function graphOracle(result, edited) {
  assert.deepEqual(result.edges.map(e => e.role), roles); assert.equal(result.vertices.length, 6); assert.equal(result.faces.length, 2); assert.equal(result.loops.length, 2);
  assert.equal(result.world.model.objects.length, 8); assert.equal(result.world.model.name, options.evaluationId); assert.deepEqual(result.world.model.objects[0], result.request.section.request.assets[0].surface);
  const x = [-1, -5 / 8, -1 / 4, 1 / 8, .5], y = [1, .25, -.125, -.125, .25], z = edited ? [1, 67 / 256, -31 / 512, -37 / 512, 143 / 512] : y;
  const cut = result.edges[6]; assert.deepEqual(cut.curve, result.request.section.world.curve); assert.deepEqual(cut.pcurve.curve, result.request.section.pcurves.a.curve); assert.deepEqual(cut.curve.controlPoints, x.map((v, i) => [v, y[i], z[i]]));
  const points = { bottomLeft: [-1, -.5, 1], bottomRight: [.5, -.5, edited ? 19 / 64 : .25], topRight: [.5, 1.5, .25], topLeft: [-1, 1.5, 1], cutLeft: [-1, 1, 1], cutRight: [.5, .25, edited ? 143 / 512 : .25] };
  assert.deepEqual(result.vertices.map(v => v.role), Object.keys(points)); const vertices = new Map(result.vertices.map(v => [v.id, v]));
  result.vertices.forEach(v => { assert.deepEqual(v.world, points[v.role]); assert.deepEqual(v.uv, [v.world[0], v.world[1], 0]); });
  assert.deepEqual(result.edges[0].curve.controlPoints, [-1, -.25, .5].map((u, i) => [u, -.5, (edited ? [1, -13 / 32, 19 / 64] : [1, -.5, .25])[i]]));
  assert.deepEqual(result.edges[3].curve.controlPoints, [-1, -.25, .5].map((u, i) => [u, 1.5, [1, -.5, .25][i]]));
  result.edges.forEach((e, i) => { assert.deepEqual(result.world.model.objects[i + 1], e.curve); assert.deepEqual(e.sourceRef, { sourceField: 'world.source', modelField: 'world.model', modelName: result.world.model.name, objectIndex: i + 1, curveId: e.curve.id }); assert.equal(e.pcurve.coordinateSystem, 'original-native-uv'); assert.equal(e.pcurve.lengthUnit, 'dimensionless'); assert.ok(e.pcurve.curve.controlPoints.every(p => Object.is(p[2], 0))); assert.ok(e.curve.weights.every(w => Object.is(w, 1))); assert.ok(e.pcurve.curve.weights.every(w => Object.is(w, 1))); assert.equal(e.curve.degree, [2, 1, 1, 2, 1, 1, 4][i]); assert.deepEqual(domain(e.curve), [0, 3, 6].includes(i) ? [-1, .5] : [0, 1]); assert.deepEqual(domain(e.pcurve.curve), domain(e.curve)); assert.deepEqual(e.curve.controlPoints[0], vertices.get(e.vertexIds[0]).world); assert.deepEqual(e.curve.controlPoints.at(-1), vertices.get(e.vertexIds[1]).world); assert.deepEqual(e.pcurve.curve.controlPoints[0], vertices.get(e.vertexIds[0]).uv); assert.deepEqual(e.pcurve.curve.controlPoints.at(-1), vertices.get(e.vertexIds[1]).uv); assert.equal(result.proof.edges[i].edgeId, e.id); assert.deepEqual(result.proof.edges[i].nativeDomain, domain(e.curve)); assert.deepEqual(result.proof.edges[i].nativeWeights, e.curve.weights); entireEdge(e, result.proof.edges[i], edited); });
  const canonical = [[[0, 'forward'], [1, 'forward'], [6, 'reverse'], [4, 'reverse']], [[6, 'forward'], [2, 'forward'], [3, 'reverse'], [5, 'reverse']]];
  const reverse = result.request.options.orientation === 'reverse';
  result.loops.forEach((loop, face) => { let pattern = canonical[face]; if (reverse) pattern = [...pattern].reverse().map(([i, sense]) => [i, sense === 'forward' ? 'reverse' : 'forward']); assert.equal(loop.uses.length, 4); loop.uses.forEach((use, i) => { const [edgeIndex, sense] = pattern[i], edge = result.edges[edgeIndex]; assert.equal(use.edgeId, edge.id); assert.equal(use.sense, sense); assert.equal(use.pcurveId, edge.pcurve.curve.id); assert.deepEqual(use.interval, sense === 'forward' ? domain(edge.curve) : [...domain(edge.curve)].reverse()); assert.deepEqual(use.vertexIds, sense === 'forward' ? edge.vertexIds : [...edge.vertexIds].reverse()); assert.equal(use.vertexIds[1], loop.uses[(i + 1) % 4].vertexIds[0]); }); assert.equal(result.faces[face].outerLoopId, loop.id); assert.equal(result.faces[face].orientation, result.request.options.orientation); assert.equal(result.faces[face].region, ['below-cut', 'above-cut'][face]); });
  const cutUses = result.loops.flatMap(l => l.uses).filter(u => u.edgeId === cut.id); assert.equal(cutUses.length, 2); assert.notEqual(cutUses[0].sense, cutUses[1].sense); assert.deepEqual(cutUses[0].vertexIds, [...cutUses[1].vertexIds].reverse());
  const region = result.proof.uvRegions; eq(dto(region.lowerArea), q(9n, 8n)); eq(dto(region.upperArea), q(15n, 8n)); eq(dto(region.windowArea), q(3n)); zeros(region.sumResidual); eq(add(dto(region.lowerArea), dto(region.upperArea)), dto(region.windowArea)); assert.equal(region.areaUnit, 'dimensionless-uv2');
  // Integral u² on[-1,.5]=3/8; the lower rectangle contribution is3/4.
  eq(add(q(3n, 8n), q(3n, 4n)), dto(region.lowerArea));
  const proof = result.proof; eq(dto(proof.projection.xDerivative), ONE); eq(dto(proof.projection.yDerivative), ONE); eq(dto(proof.projection.xyDeterminant), ONE);
  proof.cut.lowerGaps.forEach((f, i) => eq(dto(f), represented([1.5, .75, .375, .375, .75][i]))); proof.cut.upperGaps.forEach((f, i) => eq(dto(f), represented([.5, 1.25, 1.625, 1.625, 1.25][i]))); eq(dto(proof.cut.minimumLowerGap), q(3n, 8n)); eq(dto(proof.cut.minimumUpperGap), q(1n, 2n)); assert.equal(proof.cut.strictVInterior, true);
  proof.restrictions.forEach(r => { zeros(r.sourceRestrictionResiduals); assert.deepEqual(r.effectiveDomain, [-1, .5]); assert.equal(r.wholeIsoSourceBinding, true); assert.equal(r.wholeIntervalSourceBinding, true); });
  proof.connectors.forEach(c => { zeros(c.endpointResiduals); zeros(c.wholeAffineResiduals); });
  proof.faceCertificates.forEach((c, i) => { assert.equal(c.faceId, result.faces[i].id); assert.equal(c.loopId, result.loops[i].id); assert.equal(c.closedDiskCertified, true); assert.equal(c.exactWorldSurfaceAgreement, true); assert.equal(c.originalXYProjectionAuthority, true); assert.equal(c.orientedUVSimpleCycle, true); });
}

function nativeOracle(result) {
  const counts = { world: { evaluated: 0, refused: 0 }, pcurve: { evaluated: 0, refused: 0 }, surface: { evaluated: 0, refused: 0 } };
  assert.equal(result.observations.length, 35);
  result.observations.forEach((o, globalIndex) => {
    assert.equal(o.edgeIndex, Math.floor(globalIndex / 5)); assert.equal(o.index, globalIndex % 5);
    const edge = result.edges[o.edgeIndex], bounds = domain(edge.curve), expected = bounds[0] + (bounds[1] - bounds[0]) * o.index / 4;
    assert.equal(o.edgeId, edge.id); assert.ok(Object.is(o.parameter, expected));
    additionalWork.curveD0Calls++; assert.deepEqual(evaluateCurve(edge.curve, o.parameter), o.world.d0);
    additionalWork.curveD0Calls++; assert.deepEqual(evaluateCurve(edge.pcurve.curve, o.parameter), o.pcurve.d0);
    additionalWork.surfaceD0Calls++; assert.deepEqual(evaluateSurface(result.request.section.request.assets[0].surface, o.pcurve.d0[0], o.pcurve.d0[1]), o.surface.d0);
    near(o.world.d0, o.surface.d0);
    for (const role of ['world', 'pcurve', 'surface']) {
      const record = o[role].d1; let value, failure;
      try { if (role === 'surface') { additionalWork.surfaceD1Calls++; value = evaluateSurfaceD1(result.request.section.request.assets[0].surface, o.pcurve.d0[0], o.pcurve.d0[1]); } else { additionalWork.curveD1Calls++; value = evaluateCurveD1(role === 'world' ? edge.curve : edge.pcurve.curve, o.parameter); } } catch (cause) { failure = cause; }
      if (failure) { assert.equal(record.status, 'native-refused'); assert.equal(record.nativeErrorName, failure.name); assert.equal(record.reason, failure.message); counts[role].refused++; }
      else { assert.equal(record.status, 'evaluated'); assert.deepEqual(record.value, value); counts[role].evaluated++; }
    }
    if (o.world.d1.status === 'evaluated' && o.pcurve.d1.status === 'evaluated' && o.surface.d1.status === 'evaluated') { const duv = o.pcurve.d1.value.derivative, s = o.surface.d1.value, chain = s.du.map((x, i) => x * duv[0] + s.dv[i] * duv[1]); near(o.chain, chain); near(chain, o.world.d1.value.derivative); }
    else { assert.equal(o.chain, null); assert.equal(o.residuals.relativeChainGap, null); }
    Object.values(o.residuals).filter(v => v !== null).forEach(v => assert.ok(Number.isFinite(v) && v >= 0 && v <= 1e-7));
  });
  assert.deepEqual(result.report.derivativeCounts, counts);
  assert.equal(result.report.maximumObservedPointGapMM, Math.max(...result.observations.flatMap(o => [o.residuals.pointGapMM, o.residuals.worldD0D1PointGapMM ?? 0, o.residuals.surfaceD0D1PointGapMM ?? 0])));
  assert.equal(result.report.maximumObservedRelativeChainGap, Math.max(...result.observations.map(o => o.residuals.relativeChainGap ?? 0)));
}
function sourceOracle(result) {
  const section = result.request.section, refs = [];
  section.request.assets.forEach((a, i) => refs.push(cold(a.source, section.originalModels[i], 'request.section.request.assets[' + i + '].source')));
  refs.push(cold(section.world.source, section.world.model, 'request.section.world.source'));
  result.isoCurves.forEach((iso, i) => { assert.deepEqual(iso.original, section.request.assets[0].surface); assert.equal(iso.provenance.fixedAxis, 'v'); assert.equal(iso.provenance.parameter, [-.5, 1.5][i]); refs.push(cold(iso.source, iso.model, 'isoCurves[' + i + '].source')); const interval = result.intervals[i]; assert.deepEqual(interval.request, { source: iso.source, sourceVersion: 0, curveId: iso.curve.id, interval: [-1, .5], maximumObservations: 256 }); assert.deepEqual(interval.originalCurve, iso.curve); assert.deepEqual(interval.originalModel, iso.model); assert.deepEqual(interval.curve, result.edges[[0, 3][i]].curve); assert.deepEqual(domain(interval.curve), [-1, .5]); refs.push(cold(interval.source, interval.model, 'intervals[' + i + '].source')); });
  refs.push(cold(result.world.source, result.world.model, 'world.source'));
  return refs;
}
function resultOracle(result, request, edited) {
  assert.deepEqual(Object.keys(result).sort(), ['request', 'isoCurves', 'intervals', 'world', 'vertices', 'edges', 'loops', 'faces', 'proof', 'observations', 'report'].sort());
  assert.deepEqual(result.request, request); noAliases(request, result);
  assert.deepEqual(result.report.directCounts, successCounts);
  assert.deepEqual(result.report.inheritedCounts, { parent: request.section.report.directCounts, iso: result.isoCurves.map(i => i.report), intervals: result.intervals.map(i => i.report.directCounts) });
  assert.deepEqual([...result.report.reservedIds].sort(), reserved(request.options).sort()); assert.equal(new Set(result.report.reservedIds).size, 38);
  assert.deepEqual(result.report.window, { u: [-1, .5], v: [-.5, 1.5] });
  assert.deepEqual([result.report.vertexCount, result.report.edgeCount, result.report.faceCount, result.report.loopCount, result.report.useCount, result.report.worldObjectCount], [6, 7, 2, 2, 8, 8]);
  assert.equal(result.report.sharedCutEdgeId, result.edges[6].id); assert.equal(result.report.sharedWorldCurveId, request.section.world.curve.id); assert.equal(result.report.sharedPcurveId, request.section.pcurves.a.curve.id);
  assert.deepEqual(result.report.support, result.proof.support); assert.equal(result.report.support.sourceId, 'source_a'); assert.equal(result.report.support.objectIndex, 1); assert.equal(result.report.support.sourceField, 'request.section.request.assets[0].source'); assert.equal(result.report.support.modelField, 'request.section.originalModels[0]');
  for (const key of ['individualFaceEmbedded', 'closedUVDisks', 'complementaryWindowRegions', 'exactWorldSurfaceAgreement', 'sharedCutUnchanged', 'oppositeSharedUses', 'fullOriginalSourcesAndBothUVRetained', 'parentFlagsUnchanged']) assert.equal(result.report.quality[key], true, key);
  for (const key of ['wholeOriginalOutsideWindowSplit', 'bSplitProduced', 'sewnManifold', 'wholeBodyTopologyCertified', 'solid', 'occupiedVolumeCertified', 'worldSurfaceAreaComputed', 'genericBoolean', 'globalBinary64EvaluationErrorCertified', 'manufacturingToleranceCertified', 'publication']) assert.equal(result.report.quality[key], false, key);
  assert.deepEqual(result.report.fileSizes.request, size(nativeJSON(request) + '\n')); assert.deepEqual(result.report.fileSizes.result, size(nativeJSON(result) + '\n')); assert.equal(result.report.ownValues, ownValues(result));
  assert.equal(result.report.rationalCounts.floatConversions, 0); assert.ok(result.report.rationalCounts.operations <= 200000); assert.ok(result.report.rationalCounts.gcdSteps <= 200000);
  graphOracle(result, edited); nativeOracle(result);
}
function construct(name, request, edited) {
  const before = nativeJSON(request); additionalWork.faceBuilds++; const result = build(request); assert.equal(nativeJSON(request), before); resultOracle(result, request, edited);
  additionalWork.ownedCalls++; const report = validate(result); assert.deepEqual(report, result.report); assert.notEqual(report, result.report);
  const requestFile = saveJSON(name + '-request', request, 4194304); saveJSON(name + '-result', result); saveJSON(name + '-report', result.report); saveJSON(name + '-source-contexts', sourceOracle(result));
  const uvFile = saveJSON(name + '-dimensionless-uv-graph', { parentBothOriginalUV: request.section.pcurves, vertices: result.vertices.map(v => ({ id: v.id, uv: v.uv })), edges: result.edges.map(e => ({ id: e.id, pcurve: e.pcurve })), loops: result.loops, faces: result.faces });
  assert.deepEqual(JSON.parse(readFileSync(uvFile, 'utf8')).parentBothOriginalUV, request.section.pcurves);
  const reopened = JSON.parse(readFileSync(requestFile, 'utf8')); assert.deepEqual(reopened, request);
  reopened.section.request.assets.forEach((a, i) => assert.deepEqual(compile(a.source), reopened.section.originalModels[i]));
  additionalWork.sectionBuilds++; assert.deepEqual(sectionBuild(reopened.section.request), reopened.section);
  additionalWork.faceBuilds++; const rebuilt = build(reopened); assert.deepEqual(rebuilt, result); saveJSON(name + '-cold-rebuild', rebuilt);
  retained.push([request, before], [result, nativeJSON(result)]);
  cases.push({ name, resultHash: hash(result), worldSourceHash: hash(result.world.source), parentHash: hash(request.section), fileSizes: result.report.fileSizes, directCounts: result.report.directCounts, inheritedCounts: result.report.inheritedCounts, derivativeCounts: result.report.derivativeCounts }); return result;
}
const main = construct('main', mainRequest, false);
const editRequest = { source: assets[0].source, sourceVersion: 0, surfaceId: 'support', edits: { poleEdits: [{ uIndex: 1, vIndex: 0, zMM: -.875 }] } };
additionalWork.editorCalls++; const edit = editSourceSurfaceControlNetWide(editRequest); additionalWork.editorOwnedCalls++; assert.deepEqual(validateSourceSurfaceControlNetWideEdit(edit), edit.report);
assert.equal(edit.report.changedFieldCount, 1); assert.equal(edit.patches.length, 1); assert.deepEqual(edit.model.objects[0], edit.originalModel.objects[0]); assert.deepEqual(edit.model.objects[2], edit.originalModel.objects[2]);
const expectedEditedA = structuredClone(A); expectedEditedA.controlPoints[1][0][2] = -.875; assert.deepEqual(edit.surface, expectedEditedA);
saveJSON('actual-one-pole-edit-request', editRequest); saveJSON('actual-one-pole-edit', edit); cold(edit.source, edit.model, 'actual-one-pole-edit.source');
const editedSectionRequest = structuredClone(sectionRequest); editedSectionRequest.assets[0].source = edit.source; editedSectionRequest.assets[0].surface = structuredClone(edit.surface);
additionalWork.sectionBuilds++; const editedSection = sectionBuild(editedSectionRequest); assert.deepEqual(editedSection.request.assets[1], mainSection.request.assets[1]); assert.deepEqual(editedSection.originalModels[1], mainSection.originalModels[1]); assert.deepEqual(editedSection.pcurves.a.curve, mainSection.pcurves.a.curve);
const edited = construct('edited', { section: editedSection, options: structuredClone(options) }, true);
assert.notDeepEqual(edited.edges[6].curve.controlPoints, main.edges[6].curve.controlPoints); assert.deepEqual(edited.proof.uvRegions, main.proof.uvRegions);
retained.push([edit, nativeJSON(edit)]);
const reverseRequest = { section: mainSection, options: { ...options, orientation: 'reverse' } };
const reverse = construct('reverse', reverseRequest, false);
assert.deepEqual(reverse.edges, main.edges); assert.deepEqual(reverse.vertices, main.vertices); assert.deepEqual(reverse.world, main.world);

function requestControl(name, change, expected) { const value = structuredClone(mainRequest); change(value); return reject(name, () => build(value), expected); }
requestControl('stale-parent-source', r => { r.section.request.assets[0].source += '\n/* changed retained source size */'; }, 'PARENT');
requestControl('stale-parent-world', r => { r.section.world.curve.controlPoints[2][0] += .125; }, 'PARENT');
requestControl('parent-original-uv-role', r => { r.section.pcurves.a.lengthUnit = 'mm'; }, 'PARENT');
requestControl('same-original-source-identity', r => { r.section.request.assets[1].sourceId = r.section.request.assets[0].sourceId; }, 'PARENT');
requestControl('fresh-generated-role-collision', r => { r.options.evaluationId = 'pf_bottom'; }, 'IDENTITY');
requestControl('evaluation-original-role-collision', r => { r.options.evaluationId = 'support'; }, 'IDENTITY');
requestControl('wrong-observation-cap', r => { r.options.maximumObservations = 34; }, ['BUDGET', 'INPUT']);
requestControl('wrong-iso-cap', r => { r.options.maximumIsoCurves = 1; }, ['BUDGET', 'INPUT']);
requestControl('wrong-orientation', r => { r.options.orientation = 'clockwise'; }, 'INPUT');
requestControl('unknown-request-field', r => { r.solid = true; }, 'INPUT');
requestControl('actual-source-string-cap', r => { r.section.request.assets[0].source += ' '.repeat(262145); }, ['BUDGET', 'INPUT']);

// The old two-cut window is a genuine precision experiment, not a retuned positive fixture.
const precisionRequest = structuredClone(sectionRequest); precisionRequest.uAInterval = [-.75, .75];
let precision;
try {
  additionalWork.sectionBuilds++; const parent = sectionBuild(precisionRequest); additionalWork.faceBuilds++; const result = build({ section: parent, options });
  assert.equal(result.proof.wholeModelGapZero, true); result.proof.edges.forEach(p => zeros(p.residuals));
  precision = { outcome: 'accepted', exactResidualsZero: true, actualRestrictedX: result.intervals.map(i => i.curve.controlPoints.map(p => p[0])), report: result.report }; saveJSON('old-midwindow-actual-accepted-result', result);
} catch (cause) { assert.ok(cause instanceof FamilyError || cause instanceof api.ExactPairedVLinearSurfaceIntersectionError, 'Precision control must preserve a real producer refusal'); precision = { outcome: 'refused', name: cause.name, code: cause.code ?? null, message: cause.message, context: cause.context ?? null, causeName: cause.cause?.name ?? null, causeMessage: cause.cause?.message ?? null }; }
saveJSON('old-midwindow-precision-control', precision); retention();
const fullDomainRequest = structuredClone(sectionRequest); fullDomainRequest.uAInterval = [-1, 1];
let fullDomainControl;
try { additionalWork.sectionBuilds++; const parent = sectionBuild(fullDomainRequest); fullDomainControl = reject('entire-original-u-window-outside-first-profile', () => build({ section: parent, options }), ['DOMAIN', 'INTERVAL']); }
catch (cause) { if (!(cause instanceof api.ExactPairedVLinearSurfaceIntersectionError)) throw cause; fullDomainControl = { outcome: 'earlier-parent-refusal', name: cause.name, code: cause.code ?? null, message: cause.message, context: cause.context ?? null }; }
saveJSON('entire-original-window-control', fullDomainControl);
// A coherent source-backed flat cut on original A.Vmin is legal to1499 but gives a zero lower strip.
const touchingB = structuredClone(B); touchingB.controlPoints.forEach(row => row.forEach(p => { p[1] = -.5; }));
const touchingRequest = structuredClone(sectionRequest); touchingRequest.assets[1].source = sourceFor(touchingB, 2); touchingRequest.assets[1].surface = compile(touchingRequest.assets[1].source).objects[2];
let touching;
try { additionalWork.sectionBuilds++; const parent = sectionBuild(touchingRequest); touching = reject('zero-lower-strip-region', () => build({ section: parent, options }), 'REGION'); }
catch (cause) { if (!(cause instanceof api.ExactPairedVLinearSurfaceIntersectionError)) throw cause; touching = { outcome: 'earlier-parent-refusal', name: cause.name, code: cause.code ?? null, message: cause.message, context: cause.context ?? null }; }
saveJSON('touching-region-control', touching);

const mutations = [
  ['original-source-size', r => { r.request.section.request.assets[0].source += '\n/* changed source length */'; }],
  ['original-b-uv-role', r => { r.request.section.pcurves.b.lengthUnit = 'mm'; }],
  ['iso-curve', r => { r.isoCurves[0].curve.controlPoints[1][0] += .125; }],
  ['interval-curve', r => { r.intervals[0].curve.controlPoints[1][0] += .125; }],
  ['world-source', r => { r.world.source += '\n/* retained size changed */'; }],
  ['world-model', r => { r.world.model.objects[1].weights[1] = 2; }],
  ['vertex-world', r => { r.vertices[0].world[2] += .125; }],
  ['edge-source-reference', r => { r.edges[0].sourceRef.objectIndex = 2; }],
  ['shared-world-cut', r => { r.edges[6].curve.controlPoints[2][2] += .125; }],
  ['dimensionless-uv', r => { r.edges[0].pcurve.lengthUnit = 'mm'; }],
  ['effective-use', r => { r.loops[0].uses[2].sense = 'forward'; }],
  ['face-region', r => { r.faces[0].region = 'above-cut'; }],
  ['proof-residual', r => { r.proof.edges[0].residuals[0][0].numerator = '1'; }],
  ['uv-area', r => { r.proof.uvRegions.lowerArea.numerator = '10'; }],
  ['native-observation', r => { r.observations[0].world.d0[2] += .125; }],
  ['native-count', r => { r.report.directCounts.surfaceD0Count++; }],
  ['size-ledger', r => { r.report.fileSizes.result.utf8++; }],
  ['solid-claim', r => { r.report.quality.solid = true; }],
];
for (const [name, change] of mutations) { const value = structuredClone(main), before = nativeJSON(value); change(value); assert.notEqual(nativeJSON(value), before); reject('owned-' + name, () => validate(value), 'OWNED'); ownControls.push(name); }
const cyclic = structuredClone(main); cyclic.self = cyclic; reject('owned-cycle', () => validate(cyclic), 'OWNED');
const sparse = structuredClone(main); delete sparse.edges[1]; reject('owned-sparse', () => validate(sparse), 'OWNED');
let getterCalls = 0; const getterRequest = structuredClone(mainRequest); Object.defineProperty(getterRequest.options, 'evaluationId', { enumerable: true, get() { getterCalls++; return 'bad'; } }); reject('request-getter', () => build(getterRequest), 'INPUT'); assert.equal(getterCalls, 0);
const getterResult = structuredClone(main); Object.defineProperty(getterResult.report, 'evaluationId', { enumerable: true, get() { getterCalls++; return 'bad'; } }); reject('owned-getter', () => validate(getterResult), 'OWNED'); assert.equal(getterCalls, 0);
saveJSON('refusals', failures); saveJSON('owned-controls', { nonNoopMutations: ownControls, getterCalls, cycle: true, sparse: true }); saveJSON('source-api.metafile', bundle.metafile); saveText('source-api.mjs', bundle.outputFiles[0].text);
const publicAPI = await import(pathToFileURL(resolve(repo, 'packages/barocss-cad/dist/index.js')).href), declarations = readFileSync(resolve(repo, 'packages/barocss-cad/dist/index.d.ts'), 'utf8');
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function'); for (const name of [...runtimeNames, ...typeNames]) assert.match(declarations, new RegExp('\\b' + name + '\\b')); assert.deepEqual(publicAPI.PairedSurfaceUVSplitFacesDiagnosticCode, codes);
additionalWork.publicBuilds++; const publicMain = publicAPI.buildPairedSurfaceUVSplitFaces(mainRequest); assert.deepEqual(publicMain, main); additionalWork.publicOwnedCalls++; assert.deepEqual(publicAPI.validatePairedSurfaceUVSplitFaces(publicMain), main.report); saveJSON('current-public-main', publicMain); retention();
const summary = { schema: 'paired-surface-uv-split-faces-demo', version: 0, nativeParent: '8d8eda4b391928efc446f8978f3eef83510d268b', cases, runtimeNames, typeNames, additionalWork, independentExactArithmetic: arithmetic, exactUVAreas: ['9/8', '15/8', '3'], physicalSurfaceAreaUnclaimed: true, fullBAndBothOriginalUVRetained: true, originalCutCurveUnchanged: true, worldModelObjects: 8, globalGraphCounts: { vertices: 6, edges: 7, faces: 2, uses: 8 }, freshRoles: 38, precisionControl: precision, fullDomainControl, ownNonNoopCount: ownControls.length, getterCalls, refusalCount: failures.length, sourceInputs: inputs.length, outputFilesBeforeSummary: files.size, untestedLimits: ['aggregate-four-MiB-request-overflow', 'aggregate-sixteen-MiB-result-overflow', 'rational-work-boundary', 'own-values-boundary'], noPrivateParserBridge: true, noPublicCodecInvented: true, noKernelCampaign: true, solid: false, sewnManifold: false, workScope: 'demo-extra-source-edit-cold-native-owned-public-work-separated-from-root-and-inherited-reports' };
saveJSON('summary', summary); console.log(nativeJSON(summary));
