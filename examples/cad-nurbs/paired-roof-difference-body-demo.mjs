import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node paired-roof-difference-body-demo.mjs --source <output-directory>');
assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]);
mkdirSync(output, { recursive: true });
const files = new Map(), retained = [], failures = [], ownControls = [], coldContexts = new Map();
const additionalWork = { sectionBuilds: 0, aBuilds: 0, bBuilds: 0, materialBuilds: 0, materialOwnedCalls: 0, differenceBuilds: 0, differenceOwnedCalls: 0, editorCalls: 0, editorOwnedCalls: 0, coldCompiles: 0, endpointCurveD0Oracles: 0, publicBuilds: 0, publicOwnedCalls: 0 };
let phase = 'source-bundle';
function nativeJSON(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}';
}
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : nativeJSON(value)).digest('hex');
const size = text => ({ utf16: text.length, utf8: Buffer.byteLength(text) });
function errorRecord(error) { return { name: error?.name ?? null, code: error?.code ?? null, message: error?.message ?? String(error), context: error?.context ?? null, cause: error?.cause ? errorRecord(error.cause) : null }; }
// Keep the first actual failure, including failures before a new Body is accepted.
process.on('uncaughtExceptionMonitor', error => {
  const path = resolve(output, 'first-failure.json');
  if (!existsSync(path)) writeFileSync(path, nativeJSON({ phase, error: errorRecord(error), additionalWork, retainedFiles: [...files].map(([path, bytes]) => ({ path, utf8: bytes.length, sha256: hash(bytes.toString('utf8')) })) }) + '\n');
});
function saveText(name, text) { const path = resolve(output, name); writeFileSync(path, text); assert.equal(readFileSync(path, 'utf8'), text); files.set(path, readFileSync(path)); return path; }
function saveJSON(name, value, maximum = 16777216) { const text = nativeJSON(value) + '\n'; assert.ok(text.length <= maximum && Buffer.byteLength(text) <= maximum, name); const path = saveText(name + '.json', text); assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), value); return path; }
function retention() { for (const [path, bytes] of files) assert.deepEqual(readFileSync(path), bytes); for (const [value, text] of retained) assert.equal(nativeJSON(value), text); }
function ownValues(value) { return !value || typeof value !== 'object' ? 1 : 1 + Object.values(value).reduce((n, child) => n + ownValues(child), 0); }
function noAliases(input, result) { const caller = new WeakSet(); const collect = value => { if (value && typeof value === 'object') { caller.add(value); Object.values(value).forEach(collect); } }; collect(input); const visit = value => { if (value && typeof value === 'object') { assert.ok(!caller.has(value)); Object.values(value).forEach(visit); } }; visit(result); }
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const bundle = await require('esbuild').build({ entryPoints: [resolve(repo, 'packages/barocss-cad/src/index.ts')], absWorkingDir: repo, bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
assert.equal(bundle.outputFiles.length, 1);
const inputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path));
for (const leaf of ['paired-roof-difference-body.ts', 'paired-roof-difference-body-construction-internal.ts', 'paired-roof-difference-body-proof-internal.ts', 'paired-surface-material-body.ts', 'paired-surface-material-body-proof-internal.ts', 'paired-surface-uv-split-faces.ts', 'paired-surface-b-uv-split-faces.ts', 'compatible-ruled-surface.ts', 'face.ts', 'source-surface-control-net-wide.ts']) assert.ok(inputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
assert.ok(!inputs.some(path => path.includes('/packages/barocss-cad/dist/')));
saveJSON('source-api.metafile', bundle.metafile); saveText('source-api.mjs', bundle.outputFiles[0].text);
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const { buildPairedRoofDifferenceBody: build, validatePairedRoofDifferenceBody: validate, PairedRoofDifferenceBodyError: FamilyError, PairedRoofDifferenceBodyDiagnosticCode: codes, buildPairedSurfaceMaterialBody: materialBuild, validatePairedSurfaceMaterialBody: materialValidate, buildExactPairedVLinearSurfaceIntersection: sectionBuild, buildPairedSurfaceUVSplitFaces: aBuild, buildPairedSurfaceBUVSplitFaces: bBuild, compileCadModel, evaluateCurve, editSourceSurfaceControlNetWide, validateSourceSurfaceControlNetWideEdit } = api;
const runtimeNames = ['buildPairedRoofDifferenceBody', 'validatePairedRoofDifferenceBody', 'PairedRoofDifferenceBodyError', 'PairedRoofDifferenceBodyDiagnosticCode'];
const typeNames = ['PairedRoofDifferenceBodyRequest', 'PairedRoofDifferenceBodyOptions', 'PairedRoofDifferenceBodyReport', 'PairedRoofDifferenceBodyResult'];
for (const name of runtimeNames) assert.equal(typeof api[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(Object.keys(codes).sort(), ['INPUT', 'IDENTITY', 'PARENT', 'PROFILE', 'SOURCE', 'NATIVE', 'CLOSURE', 'TOPOLOGY', 'MATERIAL', 'ORIENTATION', 'DOMAIN', 'REPRESENTABILITY', 'BINDING', 'BUDGET', 'FILE', 'OWNED'].sort());
function compile(source) { additionalWork.coldCompiles++; const result = compileCadModel(source, { sourceVersion: 0 }); assert.equal(result.ok, true, JSON.stringify(result.diagnostics)); return result.model; }
function differenceBuild(...args) { additionalWork.differenceBuilds++; return build(...args); }
function differenceValidate(value) { additionalWork.differenceOwnedCalls++; return validate(value); }
function reject(name, action, expected) {
  let error; try { action(); } catch (cause) { error = cause; }
  assert.ok(error instanceof FamilyError, name + ': actual family error');
  if (expected) assert.ok([].concat(expected).includes(error.code), name + ': ' + error.code);
  assert.ok(error.context?.directCounts);
  const record = { name, acceptedDifferenceBody: false, ...errorRecord(error) }; failures.push(record);
  saveJSON('refusals', failures); retention(); return record;
}
const knots = (a, b, p) => [...Array(p + 1).fill(a), ...Array(p + 1).fill(b)];
const domain = c => [c.knots[c.degree], c.knots[c.controlPoints.length]];
function sourceFor(s, index) {
  const curve = '@curve #curve_sibling {type:nurbs;degree:1;knots:[0.000,0,1,1.00];control-points:[[-0,2,1],[3,4,2]];weights:[1,2];}';
  const sibling = '@surface #native_wide_sibling {type:nurbs;degree-u:1;degree-v:1;knots-u:[0,0,1,1];knots-v:[-1,-1,2,2];control-points:[[[12000,2,-0],[12000,4,1]],[[12002,2,2],[12002,4,3]]];weights:[[1,2],[3,4]];}';
  const selected = '@surface #' + s.id + ' {type:nurbs;degree-u:' + s.degreeU + ';degree-v:' + s.degreeV + ';knots-u:' + nativeJSON(s.knotsU) + ';knots-v:' + nativeJSON(s.knotsV) + ';control-points:' + nativeJSON(s.controlPoints) + ';weights:' + nativeJSON(s.weights) + ';}';
  return '/* 설계: genuine occupied paired-surface region. */\r\n@model intersection_model {version:0;length-unit:mm;\r\n' + (index === 1 ? [curve, selected, sibling] : [sibling, curve, selected]).join('\r\n') + '\r\n}\r\n';
}
const A = { kind: 'surface', id: 'support', degreeU: 2, degreeV: 1, knotsU: knots(-1, 1, 2), knotsV: knots(-.5, 1.5, 1), controlPoints: [-1, 0, 1].map((x, i) => [-.5, 1.5].map(y => [x, y, [1, -1, 1][i]])), weights: Array.from({ length: 3 }, () => [1, 1]) };
const B = { kind: 'surface', id: 'support', degreeU: 2, degreeV: 1, knotsU: knots(2, 4, 2), knotsV: knots(-.25, 1.25, 1), controlPoints: [-1, 0, 1].map((x, i) => [-.25, 1.25].map(z => [x, [1, -1, 1][i], z])), weights: Array.from({ length: 3 }, () => [1, 1]) };
const assets = [A, B].map((surface, i) => { const source = sourceFor(surface, [1, 2][i]); assert.deepEqual(compile(source).objects[[1, 2][i]], surface); saveText('original-' + ['a', 'b'][i] + '.source0.css', source); return { sourceId: ['source_a', 'source_b'][i], source, surface: structuredClone(surface) }; });
const faceOptions = (evaluationId, prefix, orientation) => ({ evaluationId, resultIdPrefix: prefix, orientation, maximumIsoCurves: 2, maximumIntervals: 2, maximumObservations: 35 });
function operandRecipe(assetA, p, interval = [-1, .5]) {
  return { section: { assets: [structuredClone(assetA), structuredClone(assets[1])], uAInterval: [...interval], options: { evaluationId: p + '_section', worldCurveId: p + '_cut', pcurveAId: p + '_cut_a', pcurveBId: p + '_cut_b', maximumObservations: 5 } }, a: faceOptions(p + '_a', p + 'a', 'forward'), b: faceOptions(p + '_b', p + 'b', 'reverse'), body: { evaluationId: p + '_material', resultIdPrefix: p + 'm', maximumClosures: 4, maximumFaces: 6, maximumEdgePairs: 12, maximumObservations: 24 } };
}
function operand(name, recipe) {
  phase = name + '-section'; saveJSON(name + '-recipe', recipe, 8388608);
  additionalWork.sectionBuilds++; const section = sectionBuild(recipe.section); saveJSON(name + '-section', section);
  phase = name + '-a'; additionalWork.aBuilds++; const a = aBuild({ section, options: recipe.a }); saveJSON(name + '-a-faces', a);
  phase = name + '-b'; additionalWork.bBuilds++; const b = bBuild(section, recipe.b); saveJSON(name + '-b-faces', b);
  assert.deepEqual(a.request.section, b.request.section);
  phase = name + '-material'; additionalWork.materialBuilds++; const body = materialBuild(a, b, recipe.body); saveJSON(name + '-operand', body);
  additionalWork.materialOwnedCalls++; assert.deepEqual(materialValidate(body), body.report);
  retained.push([body, nativeJSON(body)]); return body;
}
const options = { evaluationId: 'roof_difference', resultIdPrefix: 'rd', maximumClosures: 3, maximumFaces: 6, maximumEdgePairs: 12, maximumObservations: 24 };
function reserved(o) {
  const p = o.resultIdPrefix, ids = [o.evaluationId];
  for (const [role, count] of [['v', 8], ['e', 12], ['f', 6], ['l', 6], ['use', 24]]) for (let i = 0; i < count; i++) ids.push(p + '_' + role + i);
  ids.push(p + '_shell', p + '_body', p + '_material', p + '_band_source', p + '_band_f', p + '_band_l');
  for (const [role, count] of [['v', 4], ['e', 4], ['use', 4], ['w', 2], ['uv', 2]]) for (let i = 0; i < count; i++) ids.push(p + '_band_' + role + i);
  for (let i = 0; i < 3; i++) { const c = p + '_c' + i; ids.push(c + '_s', c + '_source', c + '_f', c + '_l'); for (const role of ['v', 'e', 'b']) for (let j = 0; j < 4; j++) ids.push(c + '_' + role + j); }
  assert.equal(ids.length, 127); assert.equal(new Set(ids).size, 127); return ids;
}

// Independent small coefficient and exact volume oracle; no solver or imported rational kernel.
const arithmetic = { operations: 0, maximumBits: 0, comparisons: 0 };
function work() { assert.ok(++arithmetic.operations <= 2000000); }
function sized(n) { work(); const bits = (n < 0n ? -n : n).toString(2).length; assert.ok(bits <= 8192); arithmetic.maximumBits = Math.max(arithmetic.maximumBits, bits); return n; }
function q(n, d = 1n) { sized(n); sized(d); assert.notEqual(d, 0n); if (d < 0n) { n = -n; d = -d; } let a = n < 0n ? -n : n, b = d; while (b) { work(); const r = sized(a % b); a = b; b = r; } const g = a || 1n; return { n: n / g, d: d / g }; }
const storage = new DataView(new ArrayBuffer(8));
function represented(x) { assert.ok(Number.isFinite(x)); storage.setFloat64(0, x); const bits = storage.getBigUint64(0), e = Number((bits >> 52n) & 2047n), f = bits & 0xfffffffffffffn, m = e ? f + (1n << 52n) : f, n = bits >> 63n ? -m : m, p = e ? e - 1075 : -1074; return p >= 0 ? q(sized(n << BigInt(p))) : q(n, sized(1n << BigInt(-p))); }
const ZERO = q(0n), ONE = q(1n);
const add = (a, b) => q(sized(sized(a.n * b.d) + sized(b.n * a.d)), sized(a.d * b.d));
const neg = a => q(-a.n, a.d); const sub = (a, b) => add(a, neg(b)); const mul = (a, b) => q(sized(a.n * b.n), sized(a.d * b.d)); const div = (a, b) => q(sized(a.n * b.d), sized(a.d * b.n));
const dto = f => { assert.ok(f.numerator.length <= 5000 && f.denominator.length <= 5000); return q(BigInt(f.numerator), BigInt(f.denominator)); };
const compare = (a, b) => { arithmetic.comparisons++; const n = sized(sized(a.n * b.d) - sized(b.n * a.d)); return n < 0n ? -1 : n > 0n ? 1 : 0; };
const eq = (a, b) => assert.equal(compare(a, b), 0);
function zeros(value) { if (Array.isArray(value)) value.forEach(zeros); else eq(dto(value), ZERO); }
const choose = (n, k) => { let x = 1; for (let i = 1; i <= k; i++) x = x * (n - i + 1) / i; return x; };
function bernsteinProduct(a, b) { const p = a.length - 1, r = b.length - 1; return Array.from({ length: p + r + 1 }, (_, k) => { let out = ZERO; for (let i = Math.max(0, k - r); i <= Math.min(p, k); i++) out = add(out, mul(mul(a[i], b[k - i]), q(BigInt(choose(p, i) * choose(r, k - i)), BigInt(choose(p + r, k))))); return out; }); }
function atPath(value, path) { assert.match(path, /^[A-Za-z_][A-Za-z0-9_]*(?:\[\d+\]|\.[A-Za-z_][A-Za-z0-9_]*)*$/); return path.replace(/\[(\d+)\]/g, '.$1').split('.').reduce((v, key) => { assert.ok(v && Object.hasOwn(v, key), path); return v[key]; }, value); }
function sourceRef(root, ref) { const model = atPath(root, ref.modelField), source = atPath(root, ref.sourceField); assert.equal(typeof source, 'string'); assert.equal(model.name, ref.modelName); assert.ok(Number.isInteger(ref.objectIndex) && ref.objectIndex >= 0 && ref.objectIndex < model.objects.length); assert.equal(model.objects[ref.objectIndex].id, ref.objectId); return model.objects[ref.objectIndex]; }
const faceRoles = ['roof', 'floor', 'band', 'yMin', 'xMin', 'xMax'];
const edgeRoles = ['lowerCut', 'upperCut', 'lowerYMin', 'upperYMin', 'lowerXMin', 'upperXMin', 'lowerXMax', 'upperXMax', 'yMinXMin', 'yMinXMax', 'bandXMin', 'bandXMax'];
const directCounts = { parentValidationCount: 2, bandWorldCurveValidationCount: 2, bandUVCurveValidationCount: 2, bandModelAdoptionCount: 1, ruledSurfaceBuildCount: 3, parametricFaceBuildCount: 3, faceModelAdoptionCount: 3, constructorDelegationCount: 16, observationCount: 24, curveD0AttemptCount: 72, curveD1AttemptCount: 0, surfaceD0AttemptCount: 0, surfaceD1AttemptCount: 0, sourceCompilationCount: 0, rationalFloatConversionCount: 0 };
function fractionGrid(actual, expected) { assert.equal(actual.length, expected.length); actual.forEach((value, i) => Array.isArray(expected[i]) ? fractionGrid(value, expected[i]) : eq(dto(value), represented(expected[i]))); }
function materialOracle(result) {
  const proof = result.proof.material, cube = proof.cubeMap;
  assert.equal(proof.operation, 'regularized-upper-minus-lower');
  assert.equal(proof.bodyId, result.body.id); assert.equal(proof.shellId, result.shell.id); assert.equal(proof.certificateId, result.body.materialCertificateId); assert.deepEqual(proof.faceIds, result.faces.map(f => f.id));
  assert.deepEqual(cube.domain, { u: [-1, .5], s: [0, 1], t: [0, 1] }); eq(dto(cube.lowY), q(-1n, 2n));
  const u = [-1, -5 / 8, -1 / 4, 1 / 8, .5], u2 = [1, .25, -.125, -.125, .25], hy = [1.5, .75, .375, .375, .75].map(represented);
  fractionGrid(cube.floorPower, [[0], [0], [1]]); fractionGrid(cube.gapPower, [[1 / 8]]);
  fractionGrid(cube.heightYBernstein, [1.5, .75, .375, .375, .75]); fractionGrid(cube.gapBernstein, Array.from({ length: 5 }, () => [1 / 8, 1 / 8]));
  assert.equal(cube.heightProofUDegree, 4); assert.equal(cube.heightProofSDegree, 1); eq(dto(cube.minimumHeightY), q(3n, 8n)); eq(dto(cube.minimumGap), q(1n, 8n));
  const jacobian = bernsteinProduct(hy, Array(5).fill(q(1n, 8n)));
  assert.equal(cube.jacobianBernstein.length, 9); let minimum = jacobian[0];
  cube.jacobianBernstein.forEach((row, i) => { assert.equal(row.length, 2); row.forEach(f => { eq(dto(f), jacobian[i]); assert.equal(compare(dto(f), ZERO), 1); }); if (compare(jacobian[i], minimum) < 0) minimum = jacobian[i]; });
  eq(dto(cube.minimumJacobian), minimum); assert.deepEqual(cube.jacobianDegrees, { u: 8, s: 1 }); assert.equal(cube.globallyInjective, true);
  assert.equal(cube.inverse, 'u=X;s=(Y-lowY)/heightY(u);t=(Z-floor(u,s))/gap(u,s)');
  const integral = mul(jacobian.reduce(add, ZERO), q(1n, 6n)); eq(integral, q(9n, 64n));
  const footprint = mul(hy.reduce(add, ZERO), q(3n, 10n)); eq(footprint, q(9n, 8n)); eq(mul(footprint, q(1n, 8n)), integral);
  proof.volume.integrandBernstein.forEach((f, i) => eq(dto(f), jacobian[i])); assert.equal(proof.volume.integrandBernstein.length, 9);
  eq(dto(proof.volume.exactVolumeMM3), integral); eq(dto(result.report.exactVolumeMM3), integral); zeros(proof.volume.integrationResidual); assert.equal(proof.volume.degree, 8); assert.equal(proof.volume.unit, 'mm3');
  const conservation = proof.conservation;
  eq(dto(conservation.lowerVolumeMM3), q(27n, 40n)); eq(dto(conservation.upperVolumeMM3), q(261n, 320n)); eq(dto(conservation.differenceVolumeMM3), integral);
  eq(add(dto(conservation.lowerVolumeMM3), integral), dto(conservation.upperVolumeMM3)); zeros(conservation.residual); zeros(result.report.conservationResidual); assert.equal(conservation.exact, true);
  const profile = proof.profile;
  eq(dto(profile.originalUBOffset), q(3n)); eq(dto(profile.originalUBScale), ONE); zeros(profile.sourceResiduals);
  fractionGrid(profile.bYPower, [9, -6, 1]); fractionGrid(profile.lowerAZPower, [[0, 0], [0, 0], [1, 0]]); fractionGrid(profile.upperAZPower, [[1 / 8, 0], [0, 0], [1, 0]]);
  for (const key of ['lowerAXIdentity', 'lowerAYIdentity', 'upperAXIdentity', 'upperAYIdentity', 'bXShiftIdentity', 'bZIdentity', 'unitPositiveAxes', 'constantPositiveWeights', 'commonOriginalB', 'commonFootprint']) assert.equal(profile[key], true, key);
  const maps = faceRoles.map(() => Array.from({ length: 5 }, () => Array.from({ length: 2 }, () => [0, 0])));
  for (const i of [0, 1]) { maps[i][1][0][0] = 1; maps[i][0][0][1] = -.5; maps[i][0][1][1] = .5; maps[i][2][1][1] = 1; }
  maps[2][0][0][0] = 3; maps[2][1][0][0] = 1; maps[2][2][0][1] = 1; maps[2][0][1][1] = 1 / 8;
  maps[3][1][0][0] = 1; maps[3][0][1][1] = 1;
  maps[4][1][0][0] = 1; maps[4][0][0][1] = 1; maps[4][0][1][1] = -1;
  maps[5][1][0][0] = 1; maps[5][0][1][1] = 1;
  const expectedGrid = role => Array.from({ length: 5 }, (_, i) => Array.from({ length: 2 }, (_, j) => {
    if (role === 'roof' || role === 'floor') return [u[i], j ? u2[i] : -.5, u2[i] + (role === 'roof' ? 1 / 8 : 0)];
    if (role === 'band') return [u[i], u2[i], u2[i] + j / 8];
    if (role === 'yMin') return [u[i], -.5, u2[i] + j / 8];
    const x = role === 'xMin' ? -1 : .5, width = role === 'xMin' ? 1.5 : .75;
    return [x, -.5 + width * i / 4, x * x + j / 8];
  }));
  const restrictions = ['t=1', 't=0', 's=1', 's=0', 'u=uMin', 'u=uMax'];
  const charts = [['u', 's'], ['u', 's'], ['u', 't'], ['u', 't'], ['s', 't'], ['s', 't']];
  // Principal coefficients use native support derivatives, evaluated at each chart.
  // For original B, Su=(1,2(U-3),0), Sv=(0,0,1); reverse orientation gives Y=+1.
  // Its t-to-native-V scale1/8 belongs to the pullback normal, not this native normal.
  const normals = [['z', 1, 1], ['z', -1, -1], ['y', 1, 1], ['y', -1, -1 / 8], ['x', -1, -3 / 16], ['x', 1, 3 / 32]];
  assert.equal(proof.faceImages.length, 6);
  proof.faceImages.forEach((image, i) => {
    const face = result.faces[i]; assert.equal(image.faceId, face.id); assert.equal(image.role, face.role); assert.deepEqual(image.supportRef, face.supportRef); assert.deepEqual(image.originalSupport, face.support);
    assert.deepEqual(image.nativeDomains, { u: [face.support.knotsU[face.support.degreeU], face.support.knotsU[face.support.controlPoints.length]], v: [face.support.knotsV[face.support.degreeV], face.support.knotsV[face.support.controlPoints[0].length]] });
    assert.equal(image.cubeRestriction, restrictions[i]); assert.deepEqual(image.chartVariables, charts[i]); assert.deepEqual(image.proofDegrees, { first: 4, second: 1 });
    fractionGrid(image.nativeUVPower, maps[i]); fractionGrid(image.actualCartesian, expectedGrid(face.role)); fractionGrid(image.expectedCartesian, expectedGrid(face.role)); zeros(image.residuals);
    assert.equal(image.wholeImageEqual, true); assert.equal(image.storedLocalUsesUnchanged, true); assert.equal(image.importReversal, i === 1);
    assert.equal(image.outward.axis, normals[i][0]); assert.equal(image.outward.sign, normals[i][1]); fractionGrid(image.outward.principalCoefficients, Array(5).fill(normals[i][2])); eq(dto(image.outward.minimumAbsolute), represented(Math.abs(normals[i][2])));
  });
  for (const key of ['sourceDefinedOccupiedRegion', 'wholeBoundaryImage', 'outwardMaterial', 'embeddedClosedBoundary', 'restrictedSolidCertified', 'parentFlagsUnchanged']) assert.equal(proof[key], true, key);
}
function graphOracle(result) {
  assert.deepEqual(result.faces.map(f => f.role), faceRoles); assert.deepEqual(result.edges.map(e => e.role), edgeRoles);
  assert.equal(result.vertices.length, 8); assert.equal(result.edges.length, 12); assert.equal(result.faces.length, 6);
  const vertexMap = new Map(result.vertices.map(v => [v.id, v])), faceMap = new Map(result.faces.map(f => [f.id, f])); assert.equal(vertexMap.size, 8); assert.equal(faceMap.size, 6);
  const points = []; for (const zOffset of [0, 1 / 8]) for (const x of [-1, .5]) for (const y of [-.5, x * x]) points.push([x, y, x * x + zOffset]);
  assert.deepEqual(result.vertices.map(v => nativeJSON(v.world)).sort(), points.map(nativeJSON).sort());
  result.vertices.forEach(v => { assert.equal(v.members.length, 3); v.members.forEach(member => assert.deepEqual(member.world, v.world)); });
  const useIds = new Set();
  result.edges.forEach(edge => {
    assert.deepEqual(sourceRef(result, edge.curveRef), edge.curve); assert.deepEqual(edge.parameterRange, domain(edge.curve)); assert.equal(edge.uses.length, 2);
    assert.deepEqual(vertexMap.get(edge.vertexIds[0]).world, edge.curve.controlPoints[0]); assert.deepEqual(vertexMap.get(edge.vertexIds[1]).world, edge.curve.controlPoints.at(-1));
    assert.notEqual(edge.uses[0].sense, edge.uses[1].sense); assert.deepEqual(edge.uses[0].vertexIds, [...edge.uses[1].vertexIds].reverse());
    edge.uses.forEach(use => {
      assert.ok(!useIds.has(use.id)); useIds.add(use.id); const face = faceMap.get(use.faceId); assert.ok(face); assert.equal(use.loopId, face.loop.id); assert.equal(use.edgeId, edge.id); assert.deepEqual(face.loop.uses.find(u => u.id === use.id), use);
      assert.deepEqual(sourceRef(result, use.origin.curveRef), use.origin.localCurve); assert.deepEqual(use.parameterMap.canonicalDomain, domain(edge.curve)); assert.deepEqual(use.parameterMap.localDomain, domain(use.origin.localCurve)); zeros(use.parameterMap.endpointResiduals); zeros(use.parameterMap.wholeCurveResiduals); assert.equal(use.parameterMap.proofDegree, 4);
      edge.parameterRange.forEach((parameter, i) => eq(add(dto(use.parameterMap.offset), mul(dto(use.parameterMap.scale), represented(parameter))), represented(use.parameterMap.localEndpointParameters[i])));
      let sign = (use.origin.sense === 'forward' ? 1 : -1) * compare(dto(use.parameterMap.scale), ZERO); if (use.importReversal) sign *= -1;
      assert.equal(use.sense, sign > 0 ? 'forward' : 'reverse'); assert.equal(use.importReversal, face.role === 'floor'); assert.deepEqual(use.vertexIds, use.sense === 'forward' ? edge.vertexIds : [...edge.vertexIds].reverse());
    });
  }); assert.equal(useIds.size, 24);
  result.faces.forEach((face, i) => {
    assert.deepEqual(sourceRef(result, face.supportRef), face.support); assert.equal(face.outerLoopId, face.loop.id); assert.equal(face.loop.faceId, face.id); assert.equal(face.loop.uses.length, 4); assert.equal(face.orientation, i === 1 || i === 2 ? 'reverse' : 'forward'); assert.equal(face.importReversal, i === 1);
    face.loop.uses.forEach((use, j) => { assert.equal(use.vertexIds[1], face.loop.uses[(j + 1) % 4].vertexIds[0]); assert.equal(use.origin.face.faceId, face.origin.faceId); });
    assert.equal(face.origin.kind, ['upper', 'lower', 'band', 'closure', 'closure', 'closure'][i]);
    if (i < 2) {
      const raw = result.request[i === 0 ? 'upper' : 'lower'].request.a, stored = raw.loops[0].uses;
      assert.equal(raw.faces[0].orientation, 'forward'); assert.equal(face.origin.faceId, raw.faces[0].id);
      const imported = face.loop.uses.map(use => use.origin.useId);
      assert.deepEqual(imported, (i === 1 ? [...stored].reverse() : stored).map(use => use.id));
      face.loop.uses.forEach(use => { const original = stored.find(u => u.id === use.origin.useId), edge = raw.edges.find(e => e.id === original.edgeId); assert.equal(use.origin.sense, original.sense); assert.deepEqual(use.origin.interval, original.interval); assert.deepEqual(use.origin.localVertexIds, original.vertexIds); assert.equal(use.origin.curveId, edge.curve.id); assert.deepEqual(use.origin.localCurve, edge.curve); assert.deepEqual(use.origin.pcurve, { kind: 'native-curve', curve: edge.pcurve.curve }); });
    }
  });
  assert.equal(result.proof.eulerCharacteristic, 2); assert.equal(8 - 12 + 6, 2); assert.equal(result.proof.connectedFaceGraph, true); assert.equal(result.proof.correspondence.length, 12); assert.equal(result.proof.vertexLinks.length, 8);
  result.proof.correspondence.forEach((pair, i) => { const edge = result.edges[i]; assert.equal(pair.edgeId, edge.id); assert.equal(pair.role, edge.role); assert.deepEqual(pair.canonicalCurveRef, edge.curveRef); assert.equal(pair.oppositeEffectiveUses, true); assert.equal(pair.exactWholeWorldImage, true); pair.occurrences.forEach((o, j) => { assert.equal(o.useId, edge.uses[j].id); assert.deepEqual(o.origin, edge.uses[j].origin); assert.deepEqual(o.parameterMap, edge.uses[j].parameterMap); assert.equal(o.importReversal, edge.uses[j].importReversal); }); });
  result.proof.vertexLinks.forEach(link => {
    const vertex = vertexMap.get(link.vertexId), germs = result.edges.flatMap(edge => edge.vertexIds.map((id, endpointIndex) => id === vertex.id ? { edgeId: edge.id, endpointIndex } : null).filter(Boolean));
    assert.equal(germs.length, 3); assert.deepEqual(link.germs.map(nativeJSON).sort(), germs.map(nativeJSON).sort()); assert.equal(link.cornerArcs.length, 3); assert.equal(link.cycle.length, 3); assert.equal(new Set(link.cycle.map(nativeJSON)).size, 3);
    link.cycle.forEach((germ, i) => { const arc = link.cornerArcs.find(a => nativeJSON(a.from) === nativeJSON(germ)); assert.ok(arc); assert.deepEqual(arc.to, link.cycle[(i + 1) % 3]); const face = faceMap.get(arc.faceId), incoming = face.loop.uses.find(u => u.id === arc.incomingUseId), outgoing = face.loop.uses.find(u => u.id === arc.outgoingUseId); assert.ok(incoming && outgoing); assert.equal(incoming.vertexIds[1], vertex.id); assert.equal(outgoing.vertexIds[0], vertex.id); assert.equal(arc.from.edgeId, incoming.edgeId); assert.equal(arc.to.edgeId, outgoing.edgeId); }); assert.equal(link.connected, true); assert.equal(link.degreeTwo, true);
  });
  const visited = new Set(), pending = [result.faces[0].id]; while (pending.length) { const id = pending.pop(); if (visited.has(id)) continue; visited.add(id); const neighbors = result.edges.filter(e => e.uses.some(u => u.faceId === id)).flatMap(e => e.uses.map(u => u.faceId)).filter(other => other !== id); pending.push(...neighbors); assert.deepEqual([...result.proof.faceAdjacency.find(a => a.faceId === id).adjacentFaceIds].sort(), [...new Set(neighbors)].sort()); } assert.equal(visited.size, 6);
  assert.deepEqual(result.shell.faceIds, result.faces.map(f => f.id)); assert.deepEqual(result.body.shellIds, [result.shell.id]); for (const key of ['closed', 'solid', 'restrictedSolidCertified']) assert.equal(result.body[key], true); assert.equal(result.shell.closed, true); assert.equal(result.shell.oriented, true);
  result.proof.sourceInventory.forEach(ref => sourceRef(result, ref));
}
function geometryOracle(result) {
  const { lower, upper } = result.request, { band, closures } = result.geometry;
  const lowerCut = lower.request.b.edges[6], upperCut = upper.request.b.edges[6];
  assert.notEqual(lowerCut.curve.id, upperCut.curve.id); assert.notEqual(lowerCut.pcurve.curve.id, upperCut.pcurve.curve.id);
  assert.deepEqual(band.edges.map(e => e.role), ['lowerCut', 'right', 'upperCut', 'left']);
  assert.deepEqual(band.vertices.map(v => v.role), ['lowerLeft', 'lowerRight', 'upperRight', 'upperLeft']);
  assert.deepEqual(band.support, lower.request.b.request.section.request.assets[1].surface);
  assert.deepEqual(sourceRef(result, band.supportRef), band.support); assert.equal(band.world.model.objects.length, 5);
  assert.deepEqual(band.world.model.objects, [band.support, ...band.edges.map(e => e.curve)]);
  assert.equal(band.world.model.name, result.request.options.resultIdPrefix + '_band_model');
  for (const [i, cut, side] of [[0, lowerCut, 'lower'], [2, upperCut, 'upper']]) {
    assert.deepEqual(band.edges[i].curve, cut.curve); assert.deepEqual(band.edges[i].pcurve, cut.pcurve);
    assert.equal(band.edges[i].origin.kind, 'borrowed-paired-cut'); assert.equal(band.edges[i].origin.operand, side);
    assert.deepEqual(sourceRef(result, band.edges[i].curveRef), cut.curve);
  }
  for (const i of [1, 3]) { assert.equal(band.edges[i].origin.kind, 'fixed-original-ub-line'); assert.equal(band.edges[i].origin.operand, null); assert.deepEqual(domain(band.edges[i].curve), [0, 1]); assert.deepEqual(domain(band.edges[i].pcurve.curve), [0, 1]); }
  assert.equal(band.face.orientation, 'reverse'); assert.equal(band.face.region, 'between-two-cuts'); assert.equal(band.face.outerLoopId, band.loop.id);
  assert.deepEqual(band.loop.uses.map(u => [u.edgeId, u.sense]), [[band.edges[3].id, 'forward'], [band.edges[2].id, 'forward'], [band.edges[1].id, 'reverse'], [band.edges[0].id, 'reverse']]);
  band.loop.uses.forEach((use, i) => { assert.equal(use.vertexIds[1], band.loop.uses[(i + 1) % 4].vertexIds[0]); const edge = band.edges.find(e => e.id === use.edgeId); assert.equal(use.pcurveId, edge.pcurve.curve.id); });
  const proof = result.proof.band; assert.deepEqual(proof.supportRef, band.supportRef); assert.deepEqual(proof.originalUAInterval, [-1, .5]); eq(dto(proof.originalUBMap.offset), q(3n)); eq(dto(proof.originalUBMap.scale), ONE);
  assert.deepEqual(proof.lowerWorldCurveRef, band.edges[0].curveRef); assert.deepEqual(proof.upperWorldCurveRef, band.edges[2].curveRef); assert.deepEqual(proof.lowerPcurve, lowerCut.pcurve.curve); assert.deepEqual(proof.upperPcurve, upperCut.pcurve.curve);
  const u = [-1, -5 / 8, -1 / 4, 1 / 8, .5], u2 = [1, .25, -.125, -.125, .25];
  proof.edges.forEach((edgeProof, i) => {
    const edge = band.edges[i]; assert.equal(edgeProof.edgeId, edge.id); assert.deepEqual(edgeProof.curveRef, edge.curveRef); assert.deepEqual(edgeProof.nativeDomain, domain(edge.curve)); assert.equal(edgeProof.proofDegree, 4);
    const expected = Array.from({ length: 5 }, (_, j) => i === 0 || i === 2 ? [u[j], u2[j], u2[j] + (i === 2 ? 1 / 8 : 0)] : i === 1 ? [.5, .25, .25 + j / 32] : [-1, 1, 1 + j / 32]);
    fractionGrid(edgeProof.worldCartesian, expected); fractionGrid(edgeProof.composedSurfaceCartesian, expected); fractionGrid(edgeProof.uvCartesian, expected.map(([x, , z]) => [x + 3, z, 0])); zeros(edgeProof.residuals); assert.equal(edgeProof.wholeImageEqual, true);
  }); assert.equal(proof.edges.length, 4); fractionGrid(proof.gapBernstein, Array(5).fill(1 / 8)); eq(dto(proof.minimumGap), q(1n, 8n)); eq(dto(proof.xzDeterminant), ONE);
  for (const key of ['closedDiskCertified', 'originalBUnchanged', 'borrowedCutsUnchanged']) assert.equal(proof[key], true);
  const donorPairs = [[lower.request.a.edges[0].curve, upper.request.a.edges[0].curve], [upper.request.a.edges[4].curve, lower.request.a.edges[4].curve], [lower.request.a.edges[1].curve, upper.request.a.edges[1].curve]];
  assert.equal(closures.length, 3); closures.forEach((closure, i) => {
    assert.equal(closure.role, ['yMin', 'xMin', 'xMax'][i]); assert.deepEqual(closure.ruled.first, donorPairs[i][0]); assert.deepEqual(closure.ruled.second, donorPairs[i][1]); assert.notEqual(closure.ruled.first.id, closure.ruled.second.id);
    assert.deepEqual(closure.ruled.report.degrees, { u: i === 0 ? 2 : 1, v: 1 }); assert.equal(closure.ruled.model.objects.length, 3); assert.equal(closure.world.model.objects.length, 5);
    assert.deepEqual(closure.face.geometry, closure.world.model); assert.deepEqual(closure.face.geometry.objects[0], closure.ruled.surface); assert.equal(closure.face.topology.face.orientation, 'forward'); assert.equal(closure.face.topology.face.id, closure.faceIds.faceId); assert.equal(closure.face.topology.loop.id, closure.faceIds.loopId);
    assert.deepEqual(closure.face.topology.vertices.map(v => v.id), closure.faceIds.vertexIds); assert.deepEqual(closure.face.topology.edges.map(e => e.id), closure.faceIds.edgeIds); assert.deepEqual(closure.face.geometry.objects.slice(1).map(c => c.id), closure.faceIds.curveIds);
  });
}
function observationOracle(result) {
  const vertices = new Map(result.vertices.map(v => [v.id, v])); assert.equal(result.observations.length, 24); let maximum = 0;
  result.observations.forEach((o, i) => {
    const edge = result.edges[Math.floor(i / 2)], endpoint = i % 2; assert.equal(o.index, i); assert.equal(o.edgeId, edge.id); assert.equal(o.endpointIndex, endpoint); assert.ok(Object.is(o.parameter, edge.parameterRange[endpoint])); assert.equal(o.vertexId, edge.vertexIds[endpoint]); assert.deepEqual(o.vertexWorld, vertices.get(o.vertexId).world);
    additionalWork.endpointCurveD0Oracles++; assert.deepEqual(evaluateCurve(edge.curve, o.parameter), o.canonicalPoint);
    assert.equal(o.local.length, 2); o.local.forEach((local, j) => { const use = edge.uses[j]; assert.equal(local.useId, use.id); assert.ok(Object.is(local.parameter, use.parameterMap.localEndpointParameters[endpoint])); additionalWork.endpointCurveD0Oracles++; assert.deepEqual(evaluateCurve(use.origin.localCurve, local.parameter), local.point); });
    const gaps = [o.canonicalVertexGapMM, ...o.local.flatMap(local => [local.canonicalGapMM, local.vertexGapMM])]; gaps.forEach(gap => assert.ok(Number.isFinite(gap) && gap >= 0 && gap <= 1e-7)); maximum = Math.max(maximum, ...gaps);
  }); assert.equal(result.report.maximumObservedEndpointGapMM, maximum);
}
function resultOracle(result, request) {
  assert.deepEqual(Object.keys(request).sort(), ['lower', 'upper', 'options'].sort()); assert.equal(Object.keys(request.options).length, 6);
  assert.deepEqual(Object.keys(result).sort(), ['request', 'geometry', 'vertices', 'edges', 'faces', 'shell', 'body', 'proof', 'observations', 'report'].sort()); assert.deepEqual(result.request, request); noAliases(request, result);
  assert.deepEqual(result.report.directCounts, directCounts); assert.deepEqual(result.report.inheritedCounts, { lower: request.lower.report, upper: request.upper.report, ruled: result.geometry.closures.map(c => c.ruled.report) });
  assert.deepEqual([...result.report.reservedIds].sort(), reserved(request.options).sort()); assert.equal(new Set(result.report.reservedIds).size, 127);
  assert.deepEqual([result.report.vertexCount, result.report.edgeCount, result.report.faceCount, result.report.loopCount, result.report.useCount, result.report.edgePairCount, result.report.vertexLinkCount, result.report.cornerArcCount, result.report.freeBoundaryCount], [8, 12, 6, 6, 24, 12, 8, 24, 0]);
  assert.deepEqual([result.report.originalOperandCount, result.report.originalTrimmedModelCount, result.report.bandWorldModelCount, result.report.bandWorldObjectCount, result.report.closureRuledModelCount, result.report.closureFaceModelCount], [2, 4, 1, 5, 3, 3]); assert.equal(result.report.flattenedMasterModelProduced, false);
  assert.equal(result.report.bodyId, result.body.id); assert.equal(result.report.shellId, result.shell.id); assert.equal(result.report.materialCertificateId, result.body.materialCertificateId); assert.deepEqual(result.report.faceIds, result.faces.map(f => f.id)); assert.deepEqual(result.report.parentEvaluationIds, [request.lower.report.evaluationId, request.upper.report.evaluationId]);
  assert.equal(result.report.directionConvention, 'raw-local-traversal-with-one-floor-import-reversal'); assert.equal(result.report.operation, 'regularized-upper-minus-lower');
  for (const side of ['lower', 'upper']) { assert.equal(request[side].body.restrictedSolidCertified, true); assert.equal(request[side].request.a.report.quality.solid, false); assert.equal(request[side].request.b.report.quality.solid, false); }
  for (const field of ['sharedBodyTopology', 'manifold', 'restrictedSolid', 'sourceDefinedOccupiedRegion', 'exactOccupiedVolume', 'exactOperandVolumeConservation', 'outwardMaterial', 'wholeBodyEmbedding', 'fullOperandsAndGeometryRetained', 'parentFlagsUnchanged']) assert.equal(result.report.quality[field], true, field);
  for (const field of ['genericBoolean', 'generalCurvedSolidProperties', 'globalC1', 'globalBinary64EvaluationErrorCertified', 'manufacturingToleranceCertified', 'weldingPerformed', 'publication']) assert.equal(result.report.quality[field], false, field);
  assert.equal(result.report.sourceFrame, 'authored-xyz-no-axis-conversion'); assert.equal(result.report.uvLengthUnit, 'dimensionless'); assert.equal(result.report.lengthUnit, 'mm'); assert.equal(result.report.volumeUnit, 'mm3');
  assert.deepEqual(result.report.fileSizes.request, size(nativeJSON(request) + '\n')); assert.deepEqual(result.report.fileSizes.result, size(nativeJSON(result) + '\n')); assert.equal(result.report.ownValues, ownValues(result));
  assert.equal(result.report.rationalCounts.floatConversions, 0); assert.ok(result.report.rationalCounts.operations <= 200000); assert.ok(result.report.rationalCounts.gcdSteps <= 200000);
  assert.equal(result.report.workScope, 'two-full-operands-one-real-b-band-three-real-closures-and-whole-variable-floor-proof'); assert.equal(result.report.budgetFailure, 'atomic-no-partial-difference-body');
  geometryOracle(result); graphOracle(result); materialOracle(result); observationOracle(result);
}
function coldSource(source, model, field) {
  const key = hash(source) + ':' + hash(model);
  if (!coldContexts.has(key)) { const name = 'cold-' + coldContexts.size, path = saveText(name + '.source0.css', source); assert.deepEqual(compile(readFileSync(path, 'utf8')), model); const modelPath = saveJSON(name + '-model', model); coldContexts.set(key, { sourceHash: hash(source), modelHash: hash(model), objectCount: model.objects.length, sourcePath: path, modelPath }); }
  return { field, ...coldContexts.get(key) };
}
function coldSources(result, edit) {
  const refs = [];
  for (const side of ['lower', 'upper']) for (const split of ['a', 'b']) {
    const section = result.request[side].request[split].request.section;
    section.request.assets.forEach((asset, i) => refs.push(coldSource(asset.source, section.originalModels[i], 'request.' + side + '.request.' + split + '.request.section.request.assets[' + i + '].source')));
  }
  function walk(value, field) {
    if (!value || typeof value !== 'object') return;
    if (typeof value.source === 'string' && value.model?.objects) refs.push(coldSource(value.source, value.model, field + '.source'));
    if (typeof value.request?.source === 'string' && value.originalModel?.objects) refs.push(coldSource(value.request.source, value.originalModel, field + '.request.source'));
    Object.entries(value).forEach(([key, child]) => walk(child, field + (Array.isArray(value) ? '[' + key + ']' : '.' + key)));
  }
  walk(result, 'result'); walk(edit, 'editor'); return refs;
}
function persistGeometry(result) {
  const { band, closures } = result.geometry;
  saveText('band-world-model5.source0.css', band.world.source); saveJSON('band-world-model5', band.world.model);
  saveJSON('band-original-b-uv', { supportRef: band.supportRef, vertices: band.vertices, edges: band.edges.map(e => ({ id: e.id, role: e.role, pcurve: e.pcurve })), loop: band.loop, face: band.face });
  closures.forEach((closure, i) => { saveText('closure-' + i + '-ruled-model3.source0.css', closure.ruled.source); saveJSON('closure-' + i + '-ruled', closure.ruled); saveText('closure-' + i + '-face-model5.source0.css', closure.world.source); saveJSON('closure-' + i + '-face', closure.face); saveJSON('closure-' + i + '-face-model5', closure.world.model); });
  for (const side of ['lower', 'upper']) for (const split of ['a', 'b']) { const parent = result.request[side].request[split]; assert.equal(parent.world.model.objects.length, 8); saveText(side + '-' + split + '-world-model8.source0.css', parent.world.source); saveJSON(side + '-' + split + '-world-model8', parent.world.model); saveJSON(side + '-' + split + '-original-uv', { vertices: parent.vertices, edges: parent.edges.map(e => ({ id: e.id, pcurve: e.pcurve })), loops: parent.loops, faces: parent.faces, pairedUV: parent.request.section.pcurves }); }
  saveJSON('global-original-local-uses', result.faces.map(face => ({ id: face.id, origin: face.origin, importReversal: face.importReversal, uses: face.loop.uses })));
}
phase = 'main-lower'; const lowerRecipe = operandRecipe(assets[0], 'dl'), lower = operand('main-lower', lowerRecipe);
eq(dto(lower.report.exactVolumeMM3), q(27n, 40n));
const editRequest = { source: assets[0].source, sourceVersion: 0, surfaceId: 'support', edits: { poleEdits: A.controlPoints.flatMap((row, uIndex) => row.map((point, vIndex) => ({ uIndex, vIndex, zMM: point[2] + 1 / 8 }))) } };
saveJSON('actual-six-pole-edit-request', editRequest); phase = 'actual-six-pole-editor'; additionalWork.editorCalls++; const edit = editSourceSurfaceControlNetWide(editRequest);
saveJSON('actual-six-pole-edit', edit); saveText('edited-a.source0.css', edit.source); additionalWork.editorOwnedCalls++; assert.deepEqual(validateSourceSurfaceControlNetWideEdit(edit), edit.report);
assert.equal(edit.report.changedFieldCount, 6); assert.equal(edit.patches.length, 6); assert.deepEqual(edit.model.objects[0], edit.originalModel.objects[0]); assert.deepEqual(edit.model.objects[2], edit.originalModel.objects[2]);
edit.surface.controlPoints.forEach((row, i) => row.forEach((point, j) => { assert.deepEqual(point.slice(0, 2), A.controlPoints[i][j].slice(0, 2)); assert.equal(point[2], A.controlPoints[i][j][2] + 1 / 8); }));
const editedAsset = { ...structuredClone(assets[0]), source: edit.source, surface: structuredClone(edit.surface) }, upperRecipe = operandRecipe(editedAsset, 'du'), upper = operand('main-upper', upperRecipe);
eq(dto(upper.report.exactVolumeMM3), q(261n, 320n));
assert.deepEqual(lower.request.a.request.section.request.assets[1], upper.request.a.request.section.request.assets[1]); assert.deepEqual(lower.request.a.request.section.originalModels[1], upper.request.a.request.section.originalModels[1]);
assert.notEqual(lower.request.a.request.section.world.curve.id, upper.request.a.request.section.world.curve.id); assert.notEqual(lower.request.b.edges[6].pcurve.curve.id, upper.request.b.edges[6].pcurve.curve.id);
const request = { lower, upper, options: structuredClone(options) }, beforeRequest = nativeJSON(request);
const requestFile = saveJSON('main-request', request, 8388608); phase = 'main-difference-build'; const main = differenceBuild(lower, upper, request.options);
saveJSON('main-result', main); saveJSON('main-report', main.report); saveJSON('main-proof', main.proof); saveJSON('main-work-ledger', { direct: main.report.directCounts, inherited: main.report.inheritedCounts, rational: main.report.rationalCounts, additionalWork });
assert.equal(nativeJSON(request), beforeRequest); resultOracle(main, request); persistGeometry(main);
phase = 'main-owned-reconstruction'; const ownedReport = differenceValidate(main); assert.deepEqual(ownedReport, main.report); assert.notEqual(ownedReport, main.report); noAliases(main, ownedReport);
saveJSON('main-owned-report', ownedReport); saveJSON('main-cold-source-contexts', coldSources(main, edit)); retained.push([request, beforeRequest], [main, nativeJSON(main)], [edit, nativeJSON(edit)]);
// Raw Source replay and full graph/material reconstruction are separate checks.
phase = 'cold-full-reconstruction'; const reopened = JSON.parse(readFileSync(requestFile, 'utf8')); assert.deepEqual(reopened, request);
const coldLowerRecipe = JSON.parse(readFileSync(resolve(output, 'main-lower-recipe.json'), 'utf8')), coldUpperRecipe = JSON.parse(readFileSync(resolve(output, 'main-upper-recipe.json'), 'utf8'));
assert.equal(coldLowerRecipe.section.assets[0].source, readFileSync(resolve(output, 'original-a.source0.css'), 'utf8')); assert.equal(coldUpperRecipe.section.assets[0].source, readFileSync(resolve(output, 'edited-a.source0.css'), 'utf8'));
for (const recipe of [coldLowerRecipe, coldUpperRecipe]) assert.equal(recipe.section.assets[1].source, readFileSync(resolve(output, 'original-b.source0.css'), 'utf8'));
const freshLower = operand('cold-lower', coldLowerRecipe), freshUpper = operand('cold-upper', coldUpperRecipe); assert.deepEqual(freshLower, reopened.lower); assert.deepEqual(freshUpper, reopened.upper);
const rebuilt = differenceBuild(freshLower, freshUpper, reopened.options); assert.deepEqual(rebuilt, main); saveJSON('main-cold-rebuild', rebuilt);
phase = 'current-public-eight'; const publicAPI = await import(pathToFileURL(resolve(repo, 'packages/barocss-cad/dist/index.js')).href), declarations = readFileSync(resolve(repo, 'packages/barocss-cad/dist/index.d.ts'), 'utf8');
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function'); for (const name of [...runtimeNames, ...typeNames]) assert.match(declarations, new RegExp('\\b' + name + '\\b'));
assert.deepEqual(publicAPI.PairedRoofDifferenceBodyDiagnosticCode, codes); additionalWork.publicBuilds++; const publicMain = publicAPI.buildPairedRoofDifferenceBody(lower, upper, options); assert.deepEqual(publicMain, main); additionalWork.publicOwnedCalls++; assert.deepEqual(publicAPI.validatePairedRoofDifferenceBody(publicMain), main.report); saveJSON('current-public-main', publicMain); retention();
// Each geometric refusal receives two genuine, qualified material operands.
phase = 'genuine-pinch-editor';
const pinchEditRequest = { source: assets[0].source, sourceVersion: 0, surfaceId: 'support', edits: { poleEdits: [{ uIndex: 1, vIndex: 0, zMM: -.875 }] } };
saveJSON('pinch-one-pole-edit-request', pinchEditRequest); additionalWork.editorCalls++; const pinchEdit = editSourceSurfaceControlNetWide(pinchEditRequest); saveJSON('pinch-one-pole-edit', pinchEdit); saveText('pinch-a.source0.css', pinchEdit.source);
additionalWork.editorOwnedCalls++; assert.deepEqual(validateSourceSurfaceControlNetWideEdit(pinchEdit), pinchEdit.report); assert.equal(pinchEdit.report.changedFieldCount, 1); assert.equal(pinchEdit.patches.length, 1);
const pinchAsset = { ...structuredClone(assets[0]), source: pinchEdit.source, surface: structuredClone(pinchEdit.surface) }, pinchUpper = operand('pinch-upper', operandRecipe(pinchAsset, 'dp'));
eq(dto(pinchUpper.report.exactVolumeMM3), q(40869n, 57344n));
assert.notEqual(pinchUpper.request.b.edges[6].curve.id, lower.request.b.edges[6].curve.id);
const pinchRequest = { lower, upper: pinchUpper, options: structuredClone(options) }; saveJSON('pinch-difference-request', pinchRequest, 8388608);
phase = 'genuine-pinch-refusal'; const pinchControl = reject('genuine-one-pole-roof-gap-pinches-at-xmin', () => differenceBuild(pinchRequest.lower, pinchRequest.upper, pinchRequest.options));
saveJSON('pinch-control', { outcome: 'actual-difference-refusal', validFullOperands: true, expectedGapPower: '((1-x*x)*(1.5-Y))/32', zeroGapAt: { x: -1 }, differenceBodyProduced: false, firstCause: pinchControl });
const crossingSurface = structuredClone(A); crossingSurface.controlPoints.forEach(row => row.forEach(point => { point[2] += point[0] / 8; }));
const crossingAsset = { ...structuredClone(assets[0]), source: sourceFor(crossingSurface, 1), surface: crossingSurface }; saveText('crossing-a.source0.css', crossingAsset.source);
assert.deepEqual(compile(crossingAsset.source).objects[1], crossingSurface);
const crossingUpper = operand('crossing-upper', operandRecipe(crossingAsset, 'dc'));
saveJSON('crossing-difference-request', { lower, upper: crossingUpper, options }, 8388608); phase = 'genuine-crossing-refusal';
const crossingControl = reject('genuine-crossing-roofs', () => differenceBuild(lower, crossingUpper, options));
saveJSON('crossing-control', { validFullOperands: true, expectedGapPower: 'x/8', differenceBodyProduced: false, firstCause: crossingControl });
// Width3/4 keeps the degree4 u² coefficients dyadic; the original start skips its cut.
// The sole end cut uses native knot-insertion alpha3/8 in both degree2 insertions.
const footprintUpper = operand('footprint-upper', operandRecipe(editedAsset, 'df', [-1, -.25]));
saveJSON('incompatible-footprint-request', { lower, upper: footprintUpper, options }, 8388608); phase = 'genuine-footprint-refusal';
const footprintControl = reject('genuine-valid-incompatible-footprint', () => differenceBuild(lower, footprintUpper, options));
// Duplicate IDs come from authored recipes. No stored Curve is retagged.
const duplicateUpper = operand('duplicate-identity-upper', operandRecipe(editedAsset, 'dl'));
assert.equal(duplicateUpper.request.b.edges[6].curve.id, lower.request.b.edges[6].curve.id); assert.equal(duplicateUpper.request.b.edges[6].pcurve.curve.id, lower.request.b.edges[6].pcurve.curve.id);
saveJSON('duplicate-borrowed-identity-request', { lower, upper: duplicateUpper, options }, 8388608); phase = 'genuine-identity-refusal';
const duplicateControl = reject('genuine-valid-duplicate-borrowed-world-and-uv-ids', () => differenceBuild(lower, duplicateUpper, options));
phase = 'bounded-request-refusals';
function requestControl(name, change, expected) { const r = structuredClone(request); change(r); return reject(name, () => differenceBuild(r.lower, r.upper, r.options), expected); }
requestControl('stale-full-operand-source', r => { r.lower.request.a.request.section.request.assets[0].source += '\n/* actual retained source changed */'; }, 'PARENT');
requestControl('stale-raw-floor-use', r => { const use = r.lower.request.a.loops[0].uses[0]; use.sense = use.sense === 'forward' ? 'reverse' : 'forward'; }, 'PARENT');
requestControl('wrong-closure-cap', r => { r.options.maximumClosures = 4; }, ['INPUT', 'BUDGET']);
requestControl('wrong-observation-cap', r => { r.options.maximumObservations = 23; }, ['INPUT', 'BUDGET']);
requestControl('unknown-options-field', r => { r.options.tolerance = 1; }, 'INPUT');
requestControl('reserved-evaluation-id-collision', r => { r.options.evaluationId = 'rd_band_use0'; }, 'IDENTITY');
requestControl('inherited-id-collision', r => { r.options.evaluationId = 'support'; }, 'IDENTITY');
requestControl('source-string-cap', r => { r.upper.request.a.request.section.request.assets[0].source += ' '.repeat(262145); }, ['INPUT', 'BUDGET']);
const reverseGapRequest = { lower: upper, upper: lower, options }; saveJSON('reversed-gap-request', reverseGapRequest, 8388608); reject('reversed-operands-negative-roof-gap', () => differenceBuild(upper, lower, options));
phase = 'bounded-whole-owned-refusals';
const mutations = [
  ['lower-original-source', r => { r.request.lower.request.a.request.section.request.assets[0].source += '\n/* changed Source */'; }],
  ['upper-original-model', r => { r.request.upper.request.b.request.section.originalModels[1].objects[2].controlPoints[0][0][2] += .125; }],
  ['band-world-model', r => { r.geometry.band.world.model.objects[1].controlPoints[0][2] += .125; }],
  ['band-source', r => { r.geometry.band.world.source += '\n/* changed real band Source */'; }],
  ['band-original-uv', r => { r.geometry.band.edges[0].pcurve.curve.controlPoints[0][0] += .125; }],
  ['band-local-use', r => { r.geometry.band.loop.uses[0].sense = 'reverse'; }],
  ['closure-ruled-surface', r => { r.geometry.closures[0].ruled.surface.controlPoints[0][0][2] += .125; }],
  ['closure-world-source', r => { r.geometry.closures[0].world.source += '\n/* changed closure Source */'; }],
  ['global-vertex', r => { r.vertices[0].world[2] += .125; }],
  ['global-curve-ref', r => { r.edges[0].curveRef.objectIndex++; }],
  ['native-parameter-map', r => { const f = r.edges[0].uses[0].parameterMap.offset; f.numerator = String(BigInt(f.numerator) + 1n); }],
  ['floor-import-reversal', r => { r.faces[1].importReversal = false; }],
  ['floor-raw-local-sense', r => { const use = r.faces[1].loop.uses[0]; use.origin.sense = use.origin.sense === 'forward' ? 'reverse' : 'forward'; }],
  ['global-effective-use', r => { const use = r.faces[0].loop.uses[0]; use.sense = use.sense === 'forward' ? 'reverse' : 'forward'; }],
  ['roof-orientation', r => { r.faces[0].orientation = 'reverse'; }],
  ['variable-floor', r => { r.proof.material.cubeMap.floorPower[0][0].numerator = '1'; }],
  ['strict-gap-certificate', r => { r.proof.material.cubeMap.gapBernstein[0][0].numerator = '0'; }],
  ['whole-face-image', r => { const f = r.proof.material.faceImages[0].actualCartesian[0][0][2]; f.numerator = String(BigInt(f.numerator) + 1n); }],
  ['whole-face-residual', r => { r.proof.material.faceImages[1].residuals[0][0][0].numerator = '1'; }],
  ['whole-cut-correspondence', r => { r.proof.correspondence[0].exactWholeWorldImage = false; }],
  ['material-volume', r => { const f = r.proof.material.volume.exactVolumeMM3; f.numerator = String(BigInt(f.numerator) + 1n); }],
  ['volume-conservation', r => { r.proof.material.conservation.residual.numerator = '1'; }],
  ['vertex-link', r => { r.proof.vertexLinks[0].connected = false; }],
  ['native-observation', r => { r.observations[0].canonicalPoint[0] += .125; }],
  ['direct-count', r => { r.report.directCounts.curveD0AttemptCount++; }],
  ['result-file-size', r => { r.report.fileSizes.result.utf8++; }],
  ['restricted-solid', r => { r.body.restrictedSolidCertified = false; }],
];
for (const [name, change] of mutations) { const value = structuredClone(main), before = nativeJSON(value); change(value); assert.notEqual(nativeJSON(value), before, name + ': mutation must change stored data'); reject('owned-' + name, () => differenceValidate(value), 'OWNED'); ownControls.push(name); }
const cyclic = structuredClone(main); cyclic.self = cyclic; reject('owned-cycle', () => differenceValidate(cyclic), 'OWNED');
const sparse = structuredClone(main); delete sparse.edges[1]; reject('owned-sparse', () => differenceValidate(sparse), 'OWNED');
let getterCalls = 0; const getterOptions = structuredClone(options); Object.defineProperty(getterOptions, 'evaluationId', { enumerable: true, get() { getterCalls++; return 'bad'; } }); reject('options-getter', () => differenceBuild(lower, upper, getterOptions), 'INPUT'); assert.equal(getterCalls, 0);
const getterOwned = structuredClone(main); Object.defineProperty(getterOwned.report, 'evaluationId', { enumerable: true, get() { getterCalls++; return 'bad'; } }); reject('owned-getter', () => differenceValidate(getterOwned), 'OWNED'); assert.equal(getterCalls, 0);
saveJSON('owned-controls', { nonNoopMutations: ownControls, getterCalls, cycle: true, sparse: true, acceptedObjectsAndFilesRetained: true }); retention();
phase = 'final-ledgers';
const fileLedger = [...files].map(([path, bytes]) => ({ path, utf16: readFileSync(path, 'utf8').length, utf8: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })); saveJSON('file-size-hash-ledger', fileLedger);
saveJSON('final-work-ledger', { rootDirect: main.report.directCounts, fullInherited: main.report.inheritedCounts, sharedRational: main.report.rationalCounts, additionalDemoWork: additionalWork, independentArithmetic: arithmetic });
const summary = {
  schema: 'paired-roof-difference-body-demo', version: 0, nativeParent: '43a0879595e333776327d56b4cbaa39266a12818', operation: 'regularized-upper-minus-lower',
  runtimeNames, typeNames, resultHash: hash(main), actualExactVolumesMM3: { lower: lower.report.exactVolumeMM3, upper: upper.report.exactVolumeMM3, difference: main.report.exactVolumeMM3 }, expectedExactVolumesMM3: ['27/40', '261/320', '9/64'], conservationResidual: main.report.conservationResidual,
  directCounts: main.report.directCounts, fullInheritedCounts: main.report.inheritedCounts, rationalCounts: main.report.rationalCounts, additionalDemoWork: additionalWork, independentExactArithmetic: arithmetic,
  mainEditorChangedFields: 6, mainEditorPatches: 6, unchangedBSourceHash: hash(assets[1].source), unchangedBModelHash: hash(lower.request.a.request.section.originalModels[1]), reservedIds: 127,
  graphCounts: { vertices: 8, edges: 12, faces: 6, uses: 24, edgePairs: 12, vertexLinks: 8 }, sourceModelsRetained: { operands: 2, originalTrimmedModel8: 4, bandModel5: 1, ruledModel3: 3, naturalFaceModel5: 3 },
  wholeSixSourceImages: true, exactSourceDefinedOccupiedRegion: true, oneFloorImportReversal: true, fullColdReconstruction: true, independentOnceOwnedMain: true, currentPublicEight: true, noCallerAliases: true, acceptedObjectAndFileRetention: true,
  genuineControls: { pinch: pinchControl, crossing: crossingControl, incompatibleFootprint: footprintControl, duplicateBorrowedCurveIds: duplicateControl }, ownedNonNoopCount: ownControls.length, getterCalls, refusalCount: failures.length, sourceInputs: inputs.length, coldSourceContexts: coldContexts.size,
  fileSizes: main.report.fileSizes, ownValues: main.report.ownValues, maximumObservedEndpointGapMM: main.report.maximumObservedEndpointGapMM,
  unrunAcceptance: ['aggregate-request-result-resource-boundaries', 'rational-work-boundary', 'native-renderer-fit', 'GPU-once-adoption', 'Loader-once-adoption', 'Integration-once-adoption', 'manufacturing', 'publication', 'release'],
  genericBoolean: false, wedgeTopology: false, generalCurvedSolidProperties: false, globalC1: false, globalBinary64EvaluationErrorCertified: false, manufacturingToleranceCertified: false, publication: false,
  noInventedCodec: true, noOldKernelCampaign: true, workScope: 'one-main-six-pole-edit-and-bounded-genuine-refusals-with-demo-work-separated-from-direct-and-inherited-work',
};
saveJSON('summary', summary); retention(); console.log(nativeJSON(summary));
