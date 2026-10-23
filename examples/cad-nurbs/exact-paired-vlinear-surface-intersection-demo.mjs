import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
assert.deepEqual(args.slice(0, 1), ['--source']);
assert.equal(args.length, 2, 'Usage: node exact-paired-vlinear-surface-intersection-demo.mjs --source <output-directory>');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const output = resolve(args[1]);
mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const esbuild = require('esbuild');
const bundle = await esbuild.build({ entryPoints: [resolve(repo, 'packages/barocss-cad/src/index.ts')], absWorkingDir: repo, bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
assert.equal(bundle.outputFiles.length, 1);
const inputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path));
for (const leaf of ['exact-proof/exact-paired-vlinear-surface-intersection.ts', 'exact-proof/exact-paired-vlinear-polynomial-internal.ts', 'model-compiler.ts', 'core/math.ts', 'core/derivatives.ts', 'nurbs/source-wide/source-surface-control-net-wide.ts']) assert.ok(inputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
assert.ok(!inputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const { buildExactPairedVLinearSurfaceIntersection: build, validateExactPairedVLinearSurfaceIntersection: validate, ExactPairedVLinearSurfaceIntersectionError: FamilyError, ExactPairedVLinearSurfaceIntersectionDiagnosticCode: codes, compileCadModel, evaluateCurve, evaluateCurveD1, evaluateSurface, evaluateSurfaceD1, editSourceSurfaceControlNetWide, validateSourceSurfaceControlNetWideEdit } = api;
const runtimeNames = ['buildExactPairedVLinearSurfaceIntersection', 'validateExactPairedVLinearSurfaceIntersection', 'ExactPairedVLinearSurfaceIntersectionError', 'ExactPairedVLinearSurfaceIntersectionDiagnosticCode'];
const typeNames = ['ExactPairedVLinearSurfaceIntersectionRequest', 'ExactPairedVLinearSurfaceIntersectionOptions', 'ExactPairedVLinearSurfaceIntersectionReport', 'ExactPairedVLinearSurfaceIntersectionResult'];
for (const name of runtimeNames) assert.equal(typeof api[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(Object.keys(codes).sort(), ['INPUT', 'IDENTITY', 'SOURCE', 'REFERENCE', 'SUPPORT', 'DOMAIN', 'REPRESENTABILITY', 'BUDGET', 'BINDING', 'NATIVE', 'FILE', 'OWNED'].sort());

function nativeJSON(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}';
}
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : nativeJSON(value)).digest('hex');
const size = text => ({ utf16: text.length, utf8: Buffer.byteLength(text) });
const files = new Map(), retained = [], failures = [], ownControls = [], cases = [];
const additionalWork = { buildCalls: 0, ownedCalls: 0, coldCompileCalls: 0, editorCalls: 0, editorOwnedCalls: 0, curveD0Calls: 0, curveD1Calls: 0, surfaceD0Calls: 0, surfaceD1Calls: 0, publicBuildCalls: 0, publicOwnedCalls: 0 };
function saveText(name, text) { const path = resolve(output, name); writeFileSync(path, text); assert.equal(readFileSync(path, 'utf8'), text); files.set(path, readFileSync(path)); return path; }
function saveJSON(name, value, maximum = 4194304) { const text = nativeJSON(value) + '\n'; assert.ok(text.length <= maximum && Buffer.byteLength(text) <= maximum, name); const path = saveText(name + '.json', text); assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), value); return path; }
function compile(source) { additionalWork.coldCompileCalls++; const result = compileCadModel(source, { sourceVersion: 0 }); assert.equal(result.ok, true, JSON.stringify(result.diagnostics)); return result.model; }
function cold(name, source, model) { const path = saveText(name + '.source0.css', source); assert.deepEqual(compile(readFileSync(path, 'utf8')), model); saveJSON(name + '-model', model); }
function retention() { for (const [path, bytes] of files) assert.deepEqual(readFileSync(path), bytes); for (const [value, text] of retained) assert.equal(nativeJSON(value), text); }
function ownValues(value) { if (!value || typeof value !== 'object') return 1; return 1 + Object.values(value).reduce((n, child) => n + ownValues(child), 0); }
function noCallerAliases(input, result) { const objects = new WeakSet(); const collect = value => { if (value && typeof value === 'object') { objects.add(value); Object.values(value).forEach(collect); } }; collect(input); const check = value => { if (value && typeof value === 'object') { assert.ok(!objects.has(value)); Object.values(value).forEach(check); } }; check(result); }
function reject(name, action, expected) {
  let error; try { action(); } catch (cause) { error = cause; }
  assert.ok(error instanceof FamilyError, name + ': actual family error');
  if (expected) assert.ok([].concat(expected).includes(error.code), name + ': ' + error.code);
  assert.ok(error.context?.directCounts);
  const record = { name, code: error.code, message: error.message, context: error.context, causeName: error.cause?.name ?? null, causeMessage: error.cause?.message ?? null };
  failures.push(record); retention(); return record;
}
const near = (a, b) => { assert.equal(a.length, b.length); const gap = Math.hypot(...a.map((x, i) => x - b[i])); assert.ok(Number.isFinite(gap) && gap <= 1e-7, nativeJSON({ a, b, gap })); };
const domains = s => ({ u: [s.knotsU[s.degreeU], s.knotsU[s.controlPoints.length]], v: [s.knotsV[s.degreeV], s.knotsV[s.controlPoints[0].length]] });
const knots = (a, b, p) => [...Array(p + 1).fill(a), ...Array(p + 1).fill(b)];
function selectedSource(s, index) {
  const siblingCurve = '@curve #curve_sibling {type:nurbs;degree:1;knots:[0.000,0,1,1.00];control-points:[[-0,2,1],[3,4,2]];weights:[1,2];}';
  const siblingSurface = '@surface #native_wide_sibling {type:nurbs;degree-u:1;degree-v:1;knots-u:[0,0,1,1];knots-v:[-1,-1,2,2];control-points:[[[12000,2,-0],[12000,4,1]],[[12002,2,2],[12002,4,3]]];weights:[[1,2],[3,4]];}';
  const selected = '@surface #' + s.id + ' {type:nurbs;degree-u:' + s.degreeU + ';degree-v:' + s.degreeV + ';knots-u:' + nativeJSON(s.knotsU) + ';knots-v:' + nativeJSON(s.knotsV) + ';control-points:' + nativeJSON(s.controlPoints) + ';weights:' + nativeJSON(s.weights) + ';}';
  return '/* 설계: exact original charts; no source replacement. */\r\n@model intersection_model {version:0;length-unit:mm;\r\n' + (index === 1 ? [siblingCurve, selected, siblingSurface] : [siblingSurface, siblingCurve, selected]).join('\r\n') + '\r\n}\r\n';
}
function asset(sourceId, surface, index) { const source = selectedSource(surface, index), model = compile(source); assert.deepEqual(model.objects[index], surface); return { sourceId, source, surface: structuredClone(model.objects[index]) }; }
const A = { kind: 'surface', id: 'support', degreeU: 2, degreeV: 1, knotsU: knots(-1, 1, 2), knotsV: knots(-.5, 1.5, 1), controlPoints: [-1, 0, 1].map((x, i) => [-.5, 1.5].map(y => [x, y, [1, -1, 1][i]])), weights: Array.from({ length: 3 }, () => [1, 1]) };
const B = { kind: 'surface', id: 'support', degreeU: 2, degreeV: 1, knotsU: knots(2, 4, 2), knotsV: knots(-.25, 1.25, 1), controlPoints: [-1, 0, 1].map((x, i) => [-.25, 1.25].map(z => [x, [1, -1, 1][i], z])), weights: Array.from({ length: 3 }, () => [1, 1]) };
const mainRequest = { assets: [asset('source_a', A, 1), asset('source_b', B, 2)], uAInterval: [-.75, .75], options: { evaluationId: 'exact_main', worldCurveId: 'exact_world', pcurveAId: 'exact_uv_a', pcurveBId: 'exact_uv_b', maximumObservations: 5 } };

// Independent small polynomial arithmetic: no imported rational kernel or root solver.
const arithmetic = { operations: 0, maximumBits: 0, coefficientComparisons: 0 };
function work() { assert.ok(++arithmetic.operations <= 2000000); }
function sized(n) { work(); const bits = (n < 0n ? -n : n).toString(2).length; assert.ok(bits <= 8192); arithmetic.maximumBits = Math.max(arithmetic.maximumBits, bits); return n; }
function rational(n, d = 1n) { sized(n); sized(d); assert.notEqual(d, 0n); if (d < 0n) { n = -n; d = -d; } let a = n < 0n ? -n : n, b = d; while (b) { work(); const r = sized(a % b); a = b; b = r; } const divisor = a || 1n; return { n: n / divisor, d: d / divisor }; }
const view = new DataView(new ArrayBuffer(8));
function represented(x) { assert.ok(Number.isFinite(x)); view.setFloat64(0, x); const bits = view.getBigUint64(0), exponent = Number((bits >> 52n) & 2047n), mantissa = bits & 0xfffffffffffffn; const m = exponent ? mantissa + (1n << 52n) : mantissa, sign = bits >> 63n ? -m : m, p = exponent ? exponent - 1075 : -1074; return p >= 0 ? rational(sized(sign << BigInt(p))) : rational(sign, sized(1n << BigInt(-p))); }
const Q0 = rational(0n), Q1 = rational(1n);
const add = (a, b) => rational(sized(sized(a.n * b.d) + sized(b.n * a.d)), sized(a.d * b.d));
const neg = a => rational(-a.n, a.d);
const sub = (a, b) => add(a, neg(b));
const mul = (a, b) => rational(sized(a.n * b.n), sized(a.d * b.d));
const div = (a, b) => rational(sized(a.n * b.d), sized(a.d * b.n));
const eq = (a, b) => { arithmetic.coefficientComparisons++; assert.equal(sized(a.n * b.d), sized(b.n * a.d)); };
const fromDTO = f => { assert.ok(f.numerator.length <= 5000 && f.denominator.length <= 5000); return rational(BigInt(f.numerator), BigInt(f.denominator)); };
const choose = (n, k) => { let x = 1; for (let i = 1; i <= k; i++) x = x * (n - i + 1) / i; return x; };
function polyAdd(a, b) { return Array.from({ length: Math.max(a.length, b.length) }, (_, i) => add(a[i] ?? Q0, b[i] ?? Q0)); }
function polyScale(a, q) { return a.map(x => mul(x, q)); }
function polyMul(a, b) { const out = Array(a.length + b.length - 1).fill(Q0); a.forEach((x, i) => b.forEach((y, j) => { out[i + j] = add(out[i + j], mul(x, y)); })); return out; }
function polyPower(a, n) { let out = [Q1]; for (let i = 0; i < n; i++) out = polyMul(out, a); return out; }
function powerOfBernstein(values) { const p = values.length - 1, out = Array(p + 1).fill(Q0); values.forEach((v, i) => { for (let j = i; j <= p; j++) out[j] = add(out[j], mul(v, rational(BigInt(choose(p, i) * choose(p - i, j - i) * ((j - i) % 2 ? -1 : 1))))); }); return out; }
function polyEqual(a, b) { for (let i = 0; i < Math.max(a.length, b.length); i++) eq(a[i] ?? Q0, b[i] ?? Q0); }
const derivative = a => a.slice(1).map((q, i) => mul(q, rational(BigInt(i + 1))));
function tensorCompose(surface, uv) {
  assert.ok(surface.weights.flat().every(w => Object.is(w, surface.weights[0][0])));
  const d = domains(surface), u = polyScale(polyAdd(uv[0], [neg(represented(d.u[0]))]), div(Q1, represented(d.u[1] - d.u[0]))), v = polyScale(polyAdd(uv[1], [neg(represented(d.v[0]))]), div(Q1, represented(d.v[1] - d.v[0])));
  const bu = Array.from({ length: 3 }, (_, i) => polyScale(polyMul(polyPower(u, i), polyPower(polyAdd([Q1], polyScale(u, rational(-1n))), 2 - i)), rational(BigInt(choose(2, i)))));
  const bv = [polyAdd([Q1], polyScale(v, rational(-1n))), v];
  return [0, 1, 2].map(axis => { let out = [Q0]; for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) out = polyAdd(out, polyScale(polyMul(bu[i], bv[j]), represented(surface.controlPoints[i][j][axis]))); return out; });
}
function exactOracle(result, edited) {
  const xs = [-.75, -.375, 0, .375, .75], ys = [9 / 16, 0, -3 / 16, 0, 9 / 16], zs = edited ? [4713, 303, -951, 303, 4713].map(x => x / 8192) : ys;
  const expected = [xs.map((x, i) => [x, ys[i], zs[i]]), xs.map((x, i) => [x, ys[i], 0]), xs.map((x, i) => [x + 3, zs[i], 0])];
  const curves = [result.world.curve, result.pcurves.a.curve, result.pcurves.b.curve];
  const proofFields = ['worldCartesian', 'pcurveACartesian', 'pcurveBCartesian'];
  curves.forEach((c, index) => { assert.equal(c.degree, 4); assert.deepEqual(c.controlPoints, expected[index]); assert.deepEqual(c.knots, knots(-.75, .75, 4)); assert.deepEqual(c.weights, [1, 1, 1, 1, 1]); result.proof[proofFields[index]].forEach((row, i) => row.forEach((f, axis) => eq(fromDTO(f), represented(expected[index][i][axis])))); });
  const powers = curves.map(c => [0, 1, 2].map(axis => powerOfBernstein(c.controlPoints.map(p => represented(p[axis])))));
  const composed = result.request.assets.map((a, i) => tensorCompose(a.surface, powers[i + 1]));
  composed.forEach(polys => polys.forEach((p, axis) => { polyEqual(p, powers[0][axis]); polyEqual(derivative(p), derivative(powers[0][axis])); }));
  for (const field of ['composedA', 'composedB']) result.proof[field].forEach((row, i) => row.forEach((f, axis) => eq(fromDTO(f), represented(expected[0][i][axis]))));
  for (const field of ['residualsA', 'residualsB']) result.proof[field].flat().forEach(f => eq(fromDTO(f), Q0));
  result.proof.profiles.forEach((p, i) => { eq(fromDTO(p.uniformWeight), Q1); p.originalCartesian.forEach((row, u) => row.forEach((xyz, v) => xyz.forEach((f, axis) => eq(fromDTO(f), represented(result.request.assets[i].surface.controlPoints[u][v][axis]))))); p.axisResiduals.flat(2).forEach(f => eq(fromDTO(f), Q0)); });
  const expectedProfiles = [
    { xU: [0, 1, 0], yU: [0, 0, 0], yV: [0, 1], zU: edited ? [3 / 64, 0, 61 / 64] : [0, 0, 1], zUV: edited ? [[3 / 64, -1 / 32], [0, 0], [61 / 64, 1 / 32]] : [[0, 0], [0, 0], [1, 0]] },
    { xU: [-3, 1, 0], yU: [9, -6, 1], yV: [0, 0], zU: [0, 0, 0], zUV: [[0, 1], [0, 0], [0, 0]] },
  ];
  result.proof.profiles.forEach((profile, i) => {
    for (const field of ['xU', 'yU', 'yV', 'zU']) { assert.equal(profile[field].length, expectedProfiles[i][field].length); profile[field].forEach((f, j) => eq(fromDTO(f), represented(expectedProfiles[i][field][j]))); }
    profile.zUV.forEach((row, u) => row.forEach((f, v) => eq(fromDTO(f), represented(expectedProfiles[i].zUV[u][v]))));
    assert.deepEqual(profile.domain, domains(result.request.assets[i].surface)); assert.equal(profile.assetIndex, i);
  });
  eq(fromDTO(result.proof.fixedUJacobianDeterminant), rational(-1n));
  eq(fromDTO(result.proof.originalUB.offset), rational(3n)); eq(fromDTO(result.proof.originalUB.scale), Q1);
  result.proof.originalUB.coefficients.forEach((f, i) => eq(fromDTO(f), represented(xs[i] + 3)));
  for (const [field, values] of [['originalVA', ys], ['originalVB', zs]]) result.proof[field].forEach((f, i) => eq(fromDTO(f), represented(values[i])));
  result.proof.chartGaps.forEach(gap => { const d = domains(result.request.assets[gap.assetIndex].surface), curve = curves[gap.assetIndex + 1]; for (const [axis, lo, hi, minField, maxField, minimum] of [[0, d.u[0], d.u[1], 'uMinimum', 'uMaximum', 'minimumUGap'], [1, d.v[0], d.v[1], 'vMinimum', 'vMaximum', 'minimumVGap']]) { curve.controlPoints.forEach((p, i) => { eq(fromDTO(gap[minField][i]), sub(represented(p[axis]), represented(lo))); eq(fromDTO(gap[maxField][i]), sub(represented(hi), represented(p[axis]))); assert.ok(p[axis] >= lo && p[axis] <= hi); }); eq(fromDTO(gap[minimum]), represented(Math.min(...curve.controlPoints.flatMap(p => [p[axis] - lo, hi - p[axis]])))); } });
  assert.equal(result.proof.storedWorldEqualsBothCompositions, true); assert.equal(result.proof.uniqueCompleteBranchOnDeclaredInterval, true);
}

function nativeOracle(result, edited) {
  const curves = [result.world.curve, result.pcurves.a.curve, result.pcurves.b.curve];
  assert.deepEqual(result.observations.map(o => o.parameter), [-.75, -.375, 0, .375, .75]);
  result.observations.forEach((o, index) => {
    assert.equal(o.index, index);
    const u = o.parameter, z = edited ? 3 / 64 + 59 * u * u / 64 + u ** 4 / 32 : u * u;
    const dz = edited ? 2 * u + (-5 * u + 4 * u ** 3) / 32 : 2 * u;
    near(o.world.d0, [u, u * u, z]); near(o.world.d1.derivative, [1, 2 * u, dz]);
    near(o.pcurveA.d0, [u, u * u, 0]); near(o.pcurveB.d0, [u + 3, z, 0]);
    curves.forEach((curve, i) => { const recorded = [o.world, o.pcurveA, o.pcurveB][i]; additionalWork.curveD0Calls++; assert.deepEqual(evaluateCurve(curve, u), recorded.d0); additionalWork.curveD1Calls++; assert.deepEqual(evaluateCurveD1(curve, u), recorded.d1); });
    [o.surfaceA, o.surfaceB].forEach((recorded, i) => {
      const uv = [o.pcurveA.d0, o.pcurveB.d0][i], surface = result.request.assets[i].surface;
      additionalWork.surfaceD0Calls++; assert.deepEqual(evaluateSurface(surface, uv[0], uv[1]), recorded.d0);
      additionalWork.surfaceD1Calls++; assert.deepEqual(evaluateSurfaceD1(surface, uv[0], uv[1]), recorded.d1);
      near(recorded.d0, o.world.d0);
      const dUV = [o.pcurveA.d1, o.pcurveB.d1][i].derivative;
      const chain = recorded.d1.du.map((x, axis) => x * dUV[0] + recorded.d1.dv[axis] * dUV[1]);
      near([o.chainA, o.chainB][i], chain); near(chain, o.world.d1.derivative);
    });
    for (const value of Object.values(o.residuals).flat()) assert.ok(Number.isFinite(value) && value >= 0 && value <= 1e-7);
  });
  assert.equal(result.report.maximumObservedPointGapMM, Math.max(...result.observations.flatMap(o => [o.residuals.worldToA, o.residuals.worldToB, o.residuals.aToB, o.residuals.d0ToD1Point[0], o.residuals.d0ToD1Point[3], o.residuals.d0ToD1Point[4]])));
  assert.equal(result.report.maximumObservedRelativeChainGap, Math.max(...result.observations.flatMap(o => [o.residuals.relativeWorldChainA, o.residuals.relativeWorldChainB])));
}
const successCounts = { originalSourceCompileCount: 2, selectedSurfaceValidationCount: 2, surfaceDomainCount: 2, newCurveValidationCount: 3, worldSourceAdoptionCount: 1, uvSourceCompilationCount: 0, observationCount: 5, curveD0Count: 15, curveD1AttemptCount: 15, surfaceD0Count: 10, surfaceD1AttemptCount: 10, traceCallCount: 0, fittingCallCount: 0, rootSolveCount: 0, originalSourceEditCount: 0 };
function resultOracle(result, request, edited) {
  assert.deepEqual(Object.keys(result).sort(), ['request', 'originalModels', 'world', 'pcurves', 'proof', 'observations', 'report'].sort());
  assert.deepEqual(result.request, request); noCallerAliases(request, result);
  assert.deepEqual(result.report.directCounts, successCounts);
  assert.deepEqual(result.report.parameterDomain, request.uAInterval);
  assert.equal(result.report.worldLengthUnit, 'mm'); assert.equal(result.report.uvLengthUnit, 'dimensionless');
  assert.equal(result.world.model.objects.length, 1); assert.deepEqual(result.world.model.objects[0], result.world.curve); assert.equal(result.world.model.lengthUnit, 'mm');
  assert.equal(result.world.sourceVersion, 0); assert.equal(result.report.worldSourceBinding.objectIndex, 0); assert.equal(result.report.worldSourceBinding.curveId, request.options.worldCurveId);
  request.assets.forEach((a, i) => {
    assert.deepEqual(compile(a.source), result.originalModels[i]);
    const selection = result.report.selections[i], sidecar = [result.pcurves.a, result.pcurves.b][i];
    assert.equal(selection.sourceId, a.sourceId); assert.equal(selection.assetIndex, i); assert.equal(selection.modelName, 'intersection_model'); assert.equal(selection.surfaceId, 'support'); assert.equal(selection.objectIndex, [1, 2][i]);
    assert.equal(selection.sourceField, 'request.assets[' + i + '].source'); assert.equal(selection.modelField, 'originalModels[' + i + ']');
    assert.deepEqual(result.originalModels[i].objects[selection.objectIndex], a.surface);
    assert.deepEqual(selection.nativeDomains, domains(a.surface)); assert.deepEqual(sidecar.support, selection);
    assert.equal(sidecar.coordinateSystem, 'original-native-uv'); assert.equal(sidecar.lengthUnit, 'dimensionless'); assert.equal(sidecar.parameterFrame, 'original-a-u'); assert.ok(Object.is(sidecar.embeddedZ, 0));
    assert.ok(sidecar.curve.controlPoints.every(p => Object.is(p[2], 0)));
  });
  assert.equal(result.report.quality.exactStoredCoefficientBinding, true); assert.equal(result.report.quality.nativeObservationsSeparate, true);
  for (const field of ['uvCurvesEmittedAsWorldSource', 'genericIntersection', 'allBranchesOutsideInterval', 'trimFaceProduced', 'topologyCertified', 'solid', 'globalBinary64EvaluationErrorCertified', 'manufacturingToleranceCertified', 'publication']) assert.equal(result.report.quality[field], false, field);
  assert.deepEqual(result.report.fileSizes.request, size(nativeJSON(request) + '\n'));
  assert.deepEqual(result.report.fileSizes.result, size(nativeJSON(result) + '\n'));
  assert.equal(result.report.ownValues, ownValues(result));
  assert.deepEqual(result.report.sourceSizes, { a: size(request.assets[0].source), b: size(request.assets[1].source), world: size(result.world.source) });
  assert.ok(result.report.rationalCounts.operations <= 200000); assert.ok(result.report.rationalCounts.gcdSteps <= 200000); assert.ok(result.report.rationalCounts.floatConversions <= 45);
  exactOracle(result, edited); nativeOracle(result, edited);
}
function construct(name, request, edited) {
  const before = nativeJSON(request); additionalWork.buildCalls++; const result = build(request); assert.equal(nativeJSON(request), before);
  resultOracle(result, request, edited);
  additionalWork.ownedCalls++; const copiedReport = validate(result); assert.deepEqual(copiedReport, result.report); assert.notEqual(copiedReport, result.report);
  const requestFile = saveJSON(name + '-request', request, 2097152); saveJSON(name + '-result', result); saveJSON(name + '-report', result.report);
  request.assets.forEach((a, i) => cold(name + '-original-' + i, a.source, result.originalModels[i])); cold(name + '-world', result.world.source, result.world.model);
  const uvFile = saveJSON(name + '-dimensionless-original-uv', result.pcurves); assert.deepEqual(JSON.parse(readFileSync(uvFile, 'utf8')), result.pcurves);
  const reopened = JSON.parse(readFileSync(requestFile, 'utf8')); assert.deepEqual(reopened, request);
  reopened.assets.forEach((a, i) => assert.deepEqual(compile(a.source), result.originalModels[i]));
  additionalWork.buildCalls++; const rebuilt = build(reopened); assert.deepEqual(rebuilt, result); saveJSON(name + '-cold-rebuild', rebuilt);
  retained.push([request, before], [result, nativeJSON(result)]);
  cases.push({ name, resultHash: hash(result), worldHash: hash(result.world.source), uvHash: hash(result.pcurves), fileSizes: result.report.fileSizes, directCounts: result.report.directCounts, rationalCounts: result.report.rationalCounts }); return result;
}
const main = construct('main', mainRequest, false);
const editRequest = { source: mainRequest.assets[0].source, sourceVersion: 0, surfaceId: 'support', edits: { poleEdits: [{ uIndex: 1, vIndex: 0, zMM: -.875 }] } };
additionalWork.editorCalls++; const edit = editSourceSurfaceControlNetWide(editRequest); additionalWork.editorOwnedCalls++; assert.deepEqual(validateSourceSurfaceControlNetWideEdit(edit), edit.report);
assert.equal(edit.report.changedFieldCount, 1); assert.equal(edit.patches.length, 1); assert.equal(edit.surface.controlPoints[1][0][2], -.875);
assert.deepEqual(edit.model.objects[0], edit.originalModel.objects[0]); assert.deepEqual(edit.model.objects[2], edit.originalModel.objects[2]);
saveJSON('actual-one-pole-edit-request', editRequest); saveJSON('actual-one-pole-edit', edit); cold('actual-one-pole-edit', edit.source, edit.model);
const editedRequest = structuredClone(mainRequest); editedRequest.assets[0].source = edit.source; editedRequest.assets[0].surface = structuredClone(edit.surface);
assert.deepEqual(editedRequest.assets[1], mainRequest.assets[1]); assert.deepEqual(editedRequest.options, mainRequest.options);
const edited = construct('edited', editedRequest, true);
assert.deepEqual(main.observations[2].world.d0, [0, 0, 0]); near(edited.observations[2].world.d0, [0, 0, 3 / 64]);
retained.push([edit, nativeJSON(edit)]);

function requestControl(name, change, expected) { const value = structuredClone(mainRequest); change(value); return reject(name, () => build(value), expected); }
requestControl('missing-source-selection', r => { r.assets[0].surface.id = 'missing'; }, 'REFERENCE');
requestControl('stale-source-control', r => { r.assets[0].surface.controlPoints[1][0][2] = -.875; }, ['REFERENCE', 'BINDING']);
requestControl('invalid-source', r => { r.assets[0].source += '\n@not_native bad {}'; }, 'SOURCE');
requestControl('same-source-identity', r => { r.assets[1].sourceId = r.assets[0].sourceId; }, 'IDENTITY');
requestControl('new-id-collision', r => { r.options.pcurveAId = r.options.worldCurveId; }, 'IDENTITY');
requestControl('new-id-original-collision', r => { r.options.worldCurveId = 'support'; }, 'IDENTITY');
requestControl('outside-original-domain', r => { r.uAInterval = [-1.25, .75]; }, 'DOMAIN');
requestControl('reversed-interval', r => { r.uAInterval.reverse(); }, ['DOMAIN', 'INPUT']);
requestControl('observation-cap-literal', r => { r.options.maximumObservations = 4; }, ['INPUT', 'BUDGET']);
requestControl('nonfinite-interval', r => { r.uAInterval[0] = Infinity; }, 'INPUT');
requestControl('unknown-field', r => { r.fit = true; }, 'INPUT');
const representability = requestControl('exact-nonbinary-control-minus-one-twelfth', r => { r.uAInterval = [-.5, .5]; }, 'REPRESENTABILITY');
// For u=(t-.5), u²=t²-t+1/4. Its degree4 middle coefficient is 1/4-1/2+1/6=-1/12.
eq(add(add(rational(1n, 4n), rational(-1n, 2n)), rational(1n, 6n)), rational(-1n, 12n));
assert.equal(representability.context.phase, 'polynomial');
function actualSurfaceControl(name, index, change) {
  const r = structuredClone(mainRequest), s = structuredClone(r.assets[index].surface); change(s);
  r.assets[index].source = selectedSource(s, [1, 2][index]); r.assets[index].surface = compile(r.assets[index].source).objects[[1, 2][index]];
  return reject(name, () => build(r), ['SUPPORT', 'DOMAIN', 'REPRESENTABILITY', 'NATIVE']);
}
actualSurfaceControl('nonuniform-rational-weight', 0, s => { s.weights[1][0] = 2; });
actualSurfaceControl('zero-physical-x-axis', 0, s => { s.controlPoints.forEach(row => row.forEach(p => { p[0] = 0; })); });
actualSurfaceControl('forbidden-x-v-dependence', 0, s => { s.controlPoints[1][1][0] = .125; });
actualSurfaceControl('actual-parallel-v-directions-profile-first', 1, s => { s.controlPoints.forEach(row => row.forEach((p, j) => { p[1] = [-.25, 1.25][j]; p[2] = 0; })); });
actualSurfaceControl('v-hull-outside-original-chart', 1, s => { s.controlPoints.forEach(row => row.forEach(p => { p[1] += 2; })); });

const mutations = [
  ['original-source', r => { r.request.assets[0].source += '\n/* changed retained source size */'; }],
  ['original-model-sibling', r => { r.originalModels[0].objects[0].controlPoints[0][0] = 1; }],
  ['world-control', r => { r.world.curve.controlPoints[2][2] += .125; }],
  ['world-source', r => { r.world.source += '\n/* altered bytes */'; }],
  ['world-model', r => { r.world.model.objects[0].weights[2] = 2; }],
  ['uv-role-unit', r => { r.pcurves.a.lengthUnit = 'mm'; }],
  ['uv-parameter-frame', r => { r.pcurves.b.parameterFrame = 'normalized'; }],
  ['uv-control', r => { r.pcurves.a.curve.controlPoints[2][1] += .125; }],
  ['uv-embedded-z-bit', r => { r.pcurves.b.curve.controlPoints[0][2] = -0; }],
  ['qualified-support', r => { r.pcurves.b.support.sourceId = 'source_a'; }],
  ['proof-residual', r => { r.proof.residualsA[0][0].numerator = '1'; }],
  ['proof-determinant', r => { r.proof.fixedUJacobianDeterminant.numerator = '1'; }],
  ['native-observation', r => { r.observations[2].world.d0[2] += .125; }],
  ['report-native-count', r => { r.report.directCounts.surfaceD0Count++; }],
  ['report-size', r => { r.report.fileSizes.result.utf8++; }],
  ['report-claim', r => { r.report.quality.trimFaceProduced = true; }],
];
for (const [name, mutate] of mutations) { const value = structuredClone(main), before = nativeJSON(value); mutate(value); assert.notEqual(nativeJSON(value), before); reject('owned-' + name, () => validate(value), 'OWNED'); ownControls.push(name); }
const cyclic = structuredClone(main); cyclic.self = cyclic; reject('owned-cycle', () => validate(cyclic), 'OWNED');
const sparse = structuredClone(main); delete sparse.observations[1]; reject('owned-sparse', () => validate(sparse), 'OWNED');
let getterCalls = 0; const getterRequest = structuredClone(mainRequest); Object.defineProperty(getterRequest.options, 'evaluationId', { enumerable: true, get() { getterCalls++; return 'bad'; } }); reject('request-getter', () => build(getterRequest), 'INPUT'); assert.equal(getterCalls, 0);
const getterResult = structuredClone(main); Object.defineProperty(getterResult.report, 'evaluationId', { enumerable: true, get() { getterCalls++; return 'bad'; } }); reject('owned-getter', () => validate(getterResult), 'OWNED'); assert.equal(getterCalls, 0);

// Genuine escaped request cap: each original Source remains within its own old limit.
const fileRequest = structuredClone(mainRequest);
fileRequest.assets.forEach(a => { a.source = '/*' + '\0'.repeat(200000) + '*/\r\n' + a.source; });
const capControl = { sourceSizes: fileRequest.assets.map(a => size(a.source)), requestSize: size(nativeJSON(fileRequest) + '\n'), sourceCompilesAccepted: false, actualRefusal: null };
assert.ok(capControl.sourceSizes.every(s => s.utf16 <= 262144 && s.utf8 <= 262144));
const capCompiles = fileRequest.assets.map(a => { additionalWork.coldCompileCalls++; return compileCadModel(a.source, { sourceVersion: 0 }); });
if (capCompiles.every(c => c.ok)) {
  capCompiles.forEach((c, i) => assert.deepEqual(c.model, main.originalModels[i])); capControl.sourceCompilesAccepted = true;
  assert.ok(capControl.requestSize.utf8 > 2097152);
  capControl.actualRefusal = reject('genuine-escaped-request-file-cap', () => build(fileRequest), 'FILE');
} else capControl.actualRefusal = { stage: 'existing-source-compiler', diagnostics: capCompiles.map(c => c.diagnostics), newFileGuardUntested: true };
saveJSON('request-cap-control-compact', capControl);
saveJSON('refusals', failures); saveJSON('owned-controls', { nonNoopMutations: ownControls, getterCalls, cycle: true, sparse: true });
saveJSON('source-api.metafile', bundle.metafile); saveText('source-api.mjs', bundle.outputFiles[0].text);
const publicAPI = await import(pathToFileURL(resolve(repo, 'packages/barocss-cad/dist/index.js')).href);
const declarations = readFileSync(resolve(repo, 'packages/barocss-cad/dist/index.d.ts'), 'utf8');
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
for (const name of [...runtimeNames, ...typeNames]) assert.match(declarations, new RegExp('\\b' + name + '\\b'));
assert.deepEqual(publicAPI.ExactPairedVLinearSurfaceIntersectionDiagnosticCode, codes);
additionalWork.publicBuildCalls++; const publicMain = publicAPI.buildExactPairedVLinearSurfaceIntersection(mainRequest); assert.deepEqual(publicMain, main);
additionalWork.publicOwnedCalls++; assert.deepEqual(publicAPI.validateExactPairedVLinearSurfaceIntersection(publicMain), main.report); saveJSON('current-public-main', publicMain);
retention();
const summary = { schema: 'exact-paired-vlinear-surface-intersection-demo', version: 0, nativeParent: 'd5decae7468f24f06d697db8cfc7aa2096e85487', cases, runtimeNames, typeNames, additionalWork, independentPolynomialArithmetic: arithmetic, actualOnePoleEditCounts: edit.report.directCounts, completeOriginalSourceNamespacesRetained: true, worldSourceModelObjects: 1, uvSourceCompilationCount: 0, uvUnits: 'dimensionless-original-native-uv', exactWholeCompositionSeparateFromNativeObservations: true, ownedNonNoopCount: ownControls.length, getterCalls, refusalCount: failures.length, requestCap: capControl, untestedLimits: ['rational-work-cap', 'own-value-cap', 'result-four-MiB-envelope', 'maximum-native-coordinate-conversion-boundary'], noNumericalTraceReplay: true, noFractionKernelCampaign: true, trimFace: false, topology: false, solid: false, sourceInputs: inputs.length, outputFilesBeforeSummary: files.size, workScope: 'additional-demo-cold-editor-native-owned-public-work-separated-from-constructor-reports' };
saveJSON('summary', summary); console.log(nativeJSON(summary));
