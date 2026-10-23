import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2); assert.equal(args.length, 2, 'Usage: node paired-surface-material-body-demo.mjs --source <output-directory>'); assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]); mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const bundle = await require('esbuild').build({ entryPoints: [resolve(repo, 'packages/barocss-cad/src/index.ts')], absWorkingDir: repo, bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true }); assert.equal(bundle.outputFiles.length, 1);
const inputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path));
for (const leaf of ['paired/paired-surface-material-body.ts', 'paired/paired-surface-material-body-proof-internal.ts', 'paired/paired-surface-uv-split-faces.ts', 'paired/paired-surface-b-uv-split-faces.ts', 'nurbs/surfaces/compatible-ruled-surface.ts', 'core/face.ts', 'nurbs/source-wide/source-surface-control-net-wide.ts']) assert.ok(inputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
assert.ok(!inputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const { buildPairedSurfaceMaterialBody: build, validatePairedSurfaceMaterialBody: validate, PairedSurfaceMaterialBodyError: FamilyError, PairedSurfaceMaterialBodyDiagnosticCode: codes, buildExactPairedVLinearSurfaceIntersection: sectionBuild, buildPairedSurfaceUVSplitFaces: aBuild, buildPairedSurfaceBUVSplitFaces: bBuild, compileCadModel, evaluateCurve, editSourceSurfaceControlNetWide, validateSourceSurfaceControlNetWideEdit } = api;
const runtimeNames = ['buildPairedSurfaceMaterialBody', 'validatePairedSurfaceMaterialBody', 'PairedSurfaceMaterialBodyError', 'PairedSurfaceMaterialBodyDiagnosticCode'];
const typeNames = ['PairedSurfaceMaterialBodyRequest', 'PairedSurfaceMaterialBodyOptions', 'PairedSurfaceMaterialBodyReport', 'PairedSurfaceMaterialBodyResult'];
for (const name of runtimeNames) assert.equal(typeof api[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(Object.keys(codes).sort(), ['INPUT', 'IDENTITY', 'PARENT', 'PROFILE', 'SOURCE', 'NATIVE', 'CLOSURE', 'TOPOLOGY', 'MATERIAL', 'ORIENTATION', 'DOMAIN', 'REPRESENTABILITY', 'BINDING', 'BUDGET', 'FILE', 'OWNED'].sort());
function nativeJSON(value) { if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); } if (value === null || typeof value !== 'object') return JSON.stringify(value); if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']'; return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}'; }
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : nativeJSON(value)).digest('hex');
const size = text => ({ utf16: text.length, utf8: Buffer.byteLength(text) });
const files = new Map(), retained = [], failures = [], ownControls = [], cases = [], coldContexts = new Map();
const additionalWork = { sectionBuilds: 0, aBuilds: 0, bBuilds: 0, materialBuilds: 0, ownedCalls: 0, coldCompiles: 0, editorCalls: 0, editorOwnedCalls: 0, endpointCurveD0Oracles: 0, publicBuilds: 0, publicOwnedCalls: 0 };
function saveText(name, text) { const path = resolve(output, name); writeFileSync(path, text); assert.equal(readFileSync(path, 'utf8'), text); files.set(path, readFileSync(path)); return path; }
function saveJSON(name, value, maximum = 16777216) { const text = nativeJSON(value) + '\n'; assert.ok(text.length <= maximum && Buffer.byteLength(text) <= maximum, name); const path = saveText(name + '.json', text); assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), value); return path; }
function compile(source) { additionalWork.coldCompiles++; const result = compileCadModel(source, { sourceVersion: 0 }); assert.equal(result.ok, true, JSON.stringify(result.diagnostics)); return result.model; }
function retention() { for (const [path, bytes] of files) assert.deepEqual(readFileSync(path), bytes); for (const [value, text] of retained) assert.equal(nativeJSON(value), text); }
function ownValues(value) { return !value || typeof value !== 'object' ? 1 : 1 + Object.values(value).reduce((n, child) => n + ownValues(child), 0); }
function noAliases(input, result) { const caller = new WeakSet(); const collect = value => { if (value && typeof value === 'object') { caller.add(value); Object.values(value).forEach(collect); } }; collect(input); const visit = value => { if (value && typeof value === 'object') { assert.ok(!caller.has(value)); Object.values(value).forEach(visit); } }; visit(result); }
function reject(name, action, expected) { let error; try { action(); } catch (cause) { error = cause; } assert.ok(error instanceof FamilyError, name + ': actual family error'); if (expected) assert.ok([].concat(expected).includes(error.code), name + ': ' + error.code); assert.ok(error.context?.directCounts); const record = { name, code: error.code, message: error.message, context: error.context, causeName: error.cause?.name ?? null, causeMessage: error.cause?.message ?? null }; failures.push(record); retention(); return record; }
const knots = (a, b, p) => [...Array(p + 1).fill(a), ...Array(p + 1).fill(b)];
const domain = c => [c.knots[c.degree], c.knots[c.controlPoints.length]];
function sourceFor(s, index) { const curve = '@curve #curve_sibling {type:nurbs;degree:1;knots:[0.000,0,1,1.00];control-points:[[-0,2,1],[3,4,2]];weights:[1,2];}'; const sibling = '@surface #native_wide_sibling {type:nurbs;degree-u:1;degree-v:1;knots-u:[0,0,1,1];knots-v:[-1,-1,2,2];control-points:[[[12000,2,-0],[12000,4,1]],[[12002,2,2],[12002,4,3]]];weights:[[1,2],[3,4]];}'; const selected = '@surface #' + s.id + ' {type:nurbs;degree-u:' + s.degreeU + ';degree-v:' + s.degreeV + ';knots-u:' + nativeJSON(s.knotsU) + ';knots-v:' + nativeJSON(s.knotsV) + ';control-points:' + nativeJSON(s.controlPoints) + ';weights:' + nativeJSON(s.weights) + ';}'; return '/* 설계: genuine occupied paired-surface region. */\r\n@model intersection_model {version:0;length-unit:mm;\r\n' + (index === 1 ? [curve, selected, sibling] : [sibling, curve, selected]).join('\r\n') + '\r\n}\r\n'; }
const A = { kind: 'surface', id: 'support', degreeU: 2, degreeV: 1, knotsU: knots(-1, 1, 2), knotsV: knots(-.5, 1.5, 1), controlPoints: [-1, 0, 1].map((x, i) => [-.5, 1.5].map(y => [x, y, [1, -1, 1][i]])), weights: Array.from({ length: 3 }, () => [1, 1]) };
const B = { kind: 'surface', id: 'support', degreeU: 2, degreeV: 1, knotsU: knots(2, 4, 2), knotsV: knots(-.25, 1.25, 1), controlPoints: [-1, 0, 1].map((x, i) => [-.25, 1.25].map(z => [x, [1, -1, 1][i], z])), weights: Array.from({ length: 3 }, () => [1, 1]) };
const assets = [A, B].map((surface, i) => { const source = sourceFor(surface, [1, 2][i]); assert.deepEqual(compile(source).objects[[1, 2][i]], surface); return { sourceId: ['source_a', 'source_b'][i], source, surface: structuredClone(surface) }; });
const sectionRequest = { assets, uAInterval: [-1, .5], options: { evaluationId: 'body_section', worldCurveId: 'body_cut', pcurveAId: 'body_cut_a', pcurveBId: 'body_cut_b', maximumObservations: 5 } };
const faceOptions = (evaluationId, prefix, orientation) => ({ evaluationId, resultIdPrefix: prefix, orientation, maximumIsoCurves: 2, maximumIntervals: 2, maximumObservations: 35 });
function parents(request) { additionalWork.sectionBuilds++; const section = sectionBuild(request); additionalWork.aBuilds++; const a = aBuild({ section, options: faceOptions('body_a', 'ma', 'forward') }); additionalWork.bBuilds++; const b = bBuild(section, faceOptions('body_b', 'mb', 'reverse')); assert.deepEqual(a.request.section, b.request.section); return { a, b, section }; }
const options = { evaluationId: 'paired_material', resultIdPrefix: 'pm', maximumClosures: 4, maximumFaces: 6, maximumEdgePairs: 12, maximumObservations: 24 };
function reserved(o) { const p = o.resultIdPrefix, ids = [o.evaluationId]; for (let i = 0; i < 4; i++) { const c = p + '_c' + i; ids.push(c + '_low', c + '_s', c + '_source', c + '_f', c + '_l'); for (const role of ['v', 'e', 'b']) for (let j = 0; j < 4; j++) ids.push(c + '_' + role + j); } for (const [role, count] of [['v', 8], ['e', 12], ['f', 6], ['l', 6], ['use', 24]]) for (let i = 0; i < count; i++) ids.push(p + '_' + role + i); ids.push(p + '_shell', p + '_body', p + '_material'); assert.equal(ids.length, 128); assert.equal(new Set(ids).size, 128); return ids; }

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
const faceRoles = ['roof', 'side', 'yMin', 'zMin', 'xMin', 'xMax'];
const edgeRoles = ['cut', 'roofYMin', 'roofXMin', 'roofXMax', 'sideZMin', 'sideXMin', 'sideXMax', 'lowYLowZ', 'lowYXMin', 'lowYXMax', 'lowZXMin', 'lowZXMax'];

function materialOracle(result, edited) {
  const proof = result.proof.material, cube = proof.cubeMap;
  assert.equal(proof.bodyId, result.body.id); assert.equal(proof.shellId, result.shell.id); assert.equal(proof.certificateId, result.body.materialCertificateId); assert.deepEqual(proof.faceIds, result.faces.map(f => f.id));
  assert.deepEqual(cube.domain, { u: [-1, .5], s: [0, 1], t: [0, 1] }); eq(dto(cube.lowY), q(-1n, 2n)); eq(dto(cube.lowZ), q(-1n, 4n));
  const u = [-1, -5 / 8, -1 / 4, 1 / 8, .5], u2 = [1, .25, -.125, -.125, .25];
  const hy = [1.5, .75, .375, .375, .75].map(represented);
  const roofLow = edited ? [1, 19 / 64, -7 / 128, -7 / 128, 19 / 64] : u2;
  const roofHigh = edited ? [1, 67 / 256, -31 / 512, -37 / 512, 143 / 512] : u2;
  const hz = roofLow.map((x, i) => [represented(x + .25), represented(roofHigh[i] + .25)]);
  cube.heightYBernstein.forEach((f, i) => eq(dto(f), hy[i])); cube.heightZBernstein.forEach((row, i) => row.forEach((f, j) => eq(dto(f), hz[i][j])));
  eq(dto(cube.minimumHeightY), q(3n, 8n)); eq(dto(cube.minimumHeightZ), edited ? q(91n, 512n) : q(1n, 8n));
  const jacobian = [0, 1].map(j => bernsteinProduct(hy, hz.map(row => row[j])));
  assert.equal(cube.jacobianBernstein.length, 9); let minimum = jacobian[0][0];
  cube.jacobianBernstein.forEach((row, i) => row.forEach((f, j) => { eq(dto(f), jacobian[j][i]); assert.equal(compare(dto(f), ZERO), 1); if (compare(dto(f), minimum) < 0) minimum = dto(f); }));
  eq(dto(cube.minimumJacobian), minimum); assert.ok(compare(minimum, edited ? q(273n, 4096n) : q(3n, 64n)) >= 0); assert.equal(cube.globallyInjective, true);
  const integrand = jacobian[0].map((v, i) => mul(add(v, jacobian[1][i]), q(1n, 2n)));
  const integral = mul(integrand.reduce(add, ZERO), q(1n, 6n)); // width3/2 divided by9 coefficients.
  const expectedVolume = edited ? q(40869n, 57344n) : q(27n, 40n);
  eq(integral, expectedVolume); eq(dto(proof.volume.exactVolumeMM3), expectedVolume); eq(dto(result.report.exactVolumeMM3), expectedVolume);
  proof.volume.integrandBernstein.forEach((f, i) => eq(dto(f), integrand[i])); zeros(proof.volume.integrationResidual); assert.equal(proof.volume.degree, 8); assert.equal(proof.volume.unit, 'mm3');
  if (edited) eq(sub(expectedVolume, q(27n, 40n)), q(10809n, 286720n));
  const profile = proof.profile; eq(dto(profile.originalUBOffset), q(3n)); eq(dto(profile.originalUBScale), ONE); zeros(profile.sourceResiduals);
  profile.bYPower.forEach((f, i) => eq(dto(f), represented([9, -6, 1][i])));
  const aZ = edited ? [[3 / 64, -1 / 32], [0, 0], [61 / 64, 1 / 32]] : [[0, 0], [0, 0], [1, 0]];
  profile.aZPower.forEach((row, i) => row.forEach((f, j) => eq(dto(f), represented(aZ[i][j]))));
  const nativeMaps = faceRoles.map(() => Array.from({ length: 5 }, () => Array.from({ length: 2 }, () => [0, 0])));
  nativeMaps[0][1][0][0] = 1; nativeMaps[0][0][0][1] = -.5; nativeMaps[0][0][1][1] = .5; nativeMaps[0][2][1][1] = 1;
  nativeMaps[1][0][0][0] = 3; nativeMaps[1][1][0][0] = 1; nativeMaps[1][0][0][1] = -.25; nativeMaps[1][0][1][1] = edited ? 19 / 64 : .25; nativeMaps[1][2][1][1] = edited ? 59 / 64 : 1; nativeMaps[1][4][1][1] = edited ? 1 / 32 : 0;
  nativeMaps[2][1][0][0] = 1; nativeMaps[2][0][1][1] = 1;
  nativeMaps[3][0][0][0] = 3; nativeMaps[3][1][0][0] = 1; nativeMaps[3][0][0][1] = 1; nativeMaps[3][0][1][1] = -1;
  nativeMaps[4][1][0][0] = 1; nativeMaps[4][0][0][1] = 1; nativeMaps[4][0][1][1] = -1;
  nativeMaps[5][1][0][0] = 1; nativeMaps[5][0][1][1] = 1;
  const faceGrid = role => Array.from({ length: 5 }, (_, i) => Array.from({ length: 2 }, (_, j) => {
    if (role === 'roof') return [u[i], j === 0 ? -.5 : u2[i], j === 0 ? roofLow[i] : roofHigh[i]];
    if (role === 'side') return [u[i], u2[i], j === 0 ? -.25 : roofHigh[i]];
    if (role === 'yMin') return [u[i], -.5, j === 0 ? -.25 : roofLow[i]];
    if (role === 'zMin') return [u[i], j === 0 ? -.5 : u2[i], -.25];
    const x = role === 'xMin' ? -1 : .5, width = role === 'xMin' ? 1.5 : .75, y = -.5 + width * i / 4;
    const top = role === 'xMin' ? 1 : edited ? 19 / 64 - 9 * i / 2048 : .25;
    return [x, y, j === 0 ? -.25 : top];
  }));
  const chartVariables = [['u', 's'], ['u', 't'], ['u', 't'], ['u', 's'], ['s', 't'], ['s', 't']];
  const restrictions = ['t=1', 's=1', 's=0', 't=0', 'u=uMin', 'u=uMax'];
  const outward = [['z', 1], ['y', 1], ['y', -1], ['z', -1], ['x', -1], ['x', 1]];
  assert.equal(proof.faceImages.length, 6);
  proof.faceImages.forEach((image, faceIndex) => {
    const face = result.faces[faceIndex], expected = faceGrid(face.role);
    assert.equal(image.role, face.role); assert.equal(image.faceId, face.id); assert.deepEqual(image.supportRef, face.supportRef); assert.deepEqual(image.originalSupport, face.support); assert.equal(image.cubeRestriction, restrictions[faceIndex]); assert.deepEqual(image.chartVariables, chartVariables[faceIndex]); assert.deepEqual(image.proofDegrees, { first: 4, second: 1 });
    for (const field of ['actualCartesian', 'expectedCartesian']) { assert.equal(image[field].length, 5); image[field].forEach((row, i) => { assert.equal(row.length, 2); row.forEach((xyz, j) => xyz.forEach((f, axis) => eq(dto(f), represented(expected[i][j][axis])))); }); }
    image.nativeUVPower.forEach((row, i) => row.forEach((uv, j) => uv.forEach((f, axis) => eq(dto(f), represented(nativeMaps[faceIndex][i][j][axis])))));
    zeros(image.residuals); assert.equal(image.wholeImageEqual, true); assert.equal(image.storedLocalUsesUnchanged, true); assert.equal(image.outward.axis, outward[faceIndex][0]); assert.equal(image.outward.sign, outward[faceIndex][1]);
    const principal = faceIndex < 2 ? Array(5).fill(1) : faceIndex === 2 ? roofLow.map(v => -(v + .25)) : faceIndex === 3 ? [-1.5, -.75, -.375, -.375, -.75] : faceIndex === 4 ? Array(5).fill(-15 / 8) : Array.from({ length: 5 }, (_, i) => edited ? 105 / 256 - 27 * i / 8192 : 3 / 8);
    const magnitudes = image.outward.principalCoefficients.map((f, i) => { const value = dto(f); eq(value, represented(principal[i])); const magnitude = mul(q(BigInt(image.outward.sign)), value); assert.equal(compare(magnitude, ZERO), 1); return magnitude; });
    const minimum = magnitudes.reduce((a, b) => compare(a, b) <= 0 ? a : b); eq(dto(image.outward.minimumAbsolute), minimum);
  });
  for (const field of ['sourceDefinedOccupiedRegion', 'wholeBoundaryImage', 'outwardMaterial', 'embeddedClosedBoundary', 'restrictedSolidCertified', 'parentFlagsUnchanged']) assert.equal(proof[field], true, field);
}
function graphOracle(result, edited) {
  assert.equal(result.vertices.length, 8); assert.equal(result.edges.length, 12); assert.equal(result.faces.length, 6); assert.deepEqual(result.faces.map(f => f.role), faceRoles); assert.deepEqual(result.edges.map(e => e.role), edgeRoles);
  const vertexMap = new Map(result.vertices.map(v => [v.id, v])), faceMap = new Map(result.faces.map(f => [f.id, f]));
  assert.equal(vertexMap.size, 8); assert.equal(faceMap.size, 6);
  const expectedPoints = [];
  for (const x of [-1, .5]) for (const y of [-.5, x * x]) for (const t of [0, 1]) { const top = x * x + (edited ? (1 - x * x) * (1.5 - y) / 32 : 0); expectedPoints.push([x, y, t ? top : -.25]); }
  assert.deepEqual(result.vertices.map(v => nativeJSON(v.world)).sort(), expectedPoints.map(nativeJSON).sort());
  const useIds = new Set(), edgeMap = new Map(result.edges.map(e => [e.id, e]));
  result.edges.forEach(edge => {
    assert.deepEqual(sourceRef(result, edge.curveRef), edge.curve); assert.deepEqual(edge.parameterRange, domain(edge.curve)); assert.equal(edge.uses.length, 2);
    assert.deepEqual(vertexMap.get(edge.vertexIds[0]).world, edge.curve.controlPoints[0]); assert.deepEqual(vertexMap.get(edge.vertexIds[1]).world, edge.curve.controlPoints.at(-1));
    assert.notEqual(edge.uses[0].sense, edge.uses[1].sense); assert.deepEqual(edge.uses[0].vertexIds, [...edge.uses[1].vertexIds].reverse());
    edge.uses.forEach(use => {
      assert.ok(!useIds.has(use.id)); useIds.add(use.id); const face = faceMap.get(use.faceId); assert.ok(face); assert.equal(use.loopId, face.loop.id); assert.equal(use.edgeId, edge.id); assert.deepEqual(face.loop.uses.find(u => u.id === use.id), use);
      assert.deepEqual(sourceRef(result, use.origin.curveRef), use.origin.localCurve); assert.deepEqual(use.parameterMap.canonicalDomain, domain(edge.curve)); assert.deepEqual(use.parameterMap.localDomain, domain(use.origin.localCurve)); zeros(use.parameterMap.endpointResiduals); zeros(use.parameterMap.wholeCurveResiduals);
      edge.parameterRange.forEach((parameter, i) => eq(add(dto(use.parameterMap.offset), mul(dto(use.parameterMap.scale), represented(parameter))), represented(use.parameterMap.localEndpointParameters[i])));
      const expectedSense = use.origin.sense === 'forward' ? compare(dto(use.parameterMap.scale), ZERO) > 0 ? 'forward' : 'reverse' : compare(dto(use.parameterMap.scale), ZERO) > 0 ? 'reverse' : 'forward'; assert.equal(use.sense, expectedSense);
      assert.deepEqual(use.vertexIds, use.sense === 'forward' ? edge.vertexIds : [...edge.vertexIds].reverse());
    });
  });
  assert.equal(useIds.size, 24);
  result.faces.forEach((face, i) => {
    assert.deepEqual(sourceRef(result, face.supportRef), face.support); assert.equal(face.outerLoopId, face.loop.id); assert.equal(face.loop.faceId, face.id); assert.equal(face.loop.uses.length, 4); assert.equal(face.orientation, i === 1 ? 'reverse' : 'forward');
    face.loop.uses.forEach((use, j) => { assert.equal(use.vertexIds[1], face.loop.uses[(j + 1) % 4].vertexIds[0]); assert.equal(use.origin.face.faceId, face.origin.faceId); });
    assert.equal(face.origin.kind, i < 2 ? ['a', 'b'][i] : 'closure');
    if (i < 2) assert.equal(face.origin.faceId, [result.request.a, result.request.b][i].faces[0].id); else assert.equal(face.origin.faceId, result.closures[i - 2].face.topology.face.id);
  });
  assert.equal(result.proof.eulerCharacteristic, 2); assert.equal(8 - 12 + 6, 2); assert.equal(result.proof.connectedFaceGraph, true); assert.equal(result.proof.correspondence.length, 12); assert.equal(result.proof.vertexLinks.length, 8);
  result.proof.correspondence.forEach((pair, i) => { const edge = result.edges[i]; assert.equal(pair.edgeId, edge.id); assert.equal(pair.role, edge.role); assert.deepEqual(pair.canonicalCurveRef, edge.curveRef); assert.equal(pair.oppositeEffectiveUses, true); assert.equal(pair.exactWholeWorldImage, true); pair.occurrences.forEach((o, j) => { assert.equal(o.useId, edge.uses[j].id); assert.deepEqual(o.origin, edge.uses[j].origin); assert.deepEqual(o.parameterMap, edge.uses[j].parameterMap); }); });
  result.proof.vertexLinks.forEach(link => {
    const vertex = vertexMap.get(link.vertexId); assert.ok(vertex); const germs = result.edges.flatMap(edge => edge.vertexIds.map((id, endpointIndex) => id === vertex.id ? { edgeId: edge.id, endpointIndex } : null).filter(Boolean));
    assert.deepEqual(link.germs.map(nativeJSON).sort(), germs.map(nativeJSON).sort()); assert.equal(germs.length, 3); assert.equal(link.cornerArcs.length, 3); assert.equal(link.cycle.length, 3); assert.equal(new Set(link.cycle.map(nativeJSON)).size, 3);
    link.cycle.forEach((germ, i) => { const arc = link.cornerArcs.find(a => nativeJSON(a.from) === nativeJSON(germ)); assert.ok(arc); assert.deepEqual(arc.to, link.cycle[(i + 1) % 3]); const face = faceMap.get(arc.faceId), incoming = face.loop.uses.find(u => u.id === arc.incomingUseId), outgoing = face.loop.uses.find(u => u.id === arc.outgoingUseId); assert.ok(incoming && outgoing); assert.equal(incoming.vertexIds[1], vertex.id); assert.equal(outgoing.vertexIds[0], vertex.id); assert.equal(arc.from.edgeId, incoming.edgeId); assert.equal(arc.to.edgeId, outgoing.edgeId); }); assert.equal(link.connected, true); assert.equal(link.degreeTwo, true);
  });
  const visited = new Set(), pending = [result.faces[0].id]; while (pending.length) { const id = pending.pop(); if (visited.has(id)) continue; visited.add(id); const neighbors = result.edges.filter(e => e.uses.some(u => u.faceId === id)).flatMap(e => e.uses.map(u => u.faceId)).filter(other => other !== id); pending.push(...neighbors); const stored = result.proof.faceAdjacency.find(a => a.faceId === id); assert.deepEqual([...stored.adjacentFaceIds].sort(), [...new Set(neighbors)].sort()); } assert.equal(visited.size, 6);
  assert.deepEqual(result.shell.faceIds, result.faces.map(f => f.id)); assert.deepEqual(result.body.shellIds, [result.shell.id]); assert.equal(result.body.closed, true); assert.equal(result.body.solid, true); assert.equal(result.body.restrictedSolidCertified, true); assert.equal(result.shell.closed, true); assert.equal(result.shell.oriented, true);
  result.proof.sourceInventory.forEach(ref => sourceRef(result, ref));
}

function closureOracle(result) {
  const a = result.request.a, b = result.request.b;
  const donors = [a.edges[0].curve, b.edges[0].curve, a.edges[4].curve, a.edges[1].curve];
  result.closures.forEach((closure, i) => {
    assert.equal(closure.role, faceRoles[i + 2]); assert.deepEqual(closure.ruled.report.degrees, { u: i < 2 ? 2 : 1, v: 1 });
    assert.deepEqual(closure.ruled[i === 0 || i === 3 ? 'first' : 'second'], closure.lowCurve); assert.deepEqual(closure.ruled[i === 0 || i === 3 ? 'second' : 'first'], donors[i]);
    assert.deepEqual(closure.lowCurve.knots, donors[i].knots); assert.deepEqual(closure.lowCurve.weights, donors[i].weights); assert.equal(closure.lowCurve.degree, donors[i].degree);
    closure.lowCurve.controlPoints.forEach((p, j) => { if (i < 2) assert.deepEqual(p, [donors[i].controlPoints[j][0], -.5, -.25]); else assert.deepEqual(p, [donors[i].controlPoints[j][0], donors[i].controlPoints[j][1], -.25]); });
    assert.equal(closure.ruled.model.objects.length, 3); assert.equal(closure.world.model.objects.length, 5); assert.deepEqual(closure.face.geometry, closure.world.model); assert.deepEqual(closure.face.geometry.objects[0], closure.ruled.surface); assert.equal(closure.face.topology.face.orientation, 'forward'); assert.equal(closure.face.topology.face.id, closure.faceIds.faceId); assert.equal(closure.face.topology.loop.id, closure.faceIds.loopId);
    assert.deepEqual(closure.face.topology.vertices.map(v => v.id), closure.faceIds.vertexIds); assert.deepEqual(closure.face.topology.edges.map(e => e.id), closure.faceIds.edgeIds); assert.deepEqual(closure.face.geometry.objects.slice(1).map(c => c.id), closure.faceIds.curveIds);
  });
}
function observationOracle(result) {
  const edges = new Map(result.edges.map(e => [e.id, e])), vertices = new Map(result.vertices.map(v => [v.id, v])); assert.equal(result.observations.length, 24);
  let maximum = 0;
  result.observations.forEach((o, i) => {
    const edge = result.edges[Math.floor(i / 2)], endpoint = i % 2; assert.equal(o.index, i); assert.equal(o.edgeId, edge.id); assert.equal(o.endpointIndex, endpoint); assert.ok(Object.is(o.parameter, edge.parameterRange[endpoint])); assert.equal(o.vertexId, edge.vertexIds[endpoint]); assert.deepEqual(o.vertexWorld, vertices.get(o.vertexId).world);
    additionalWork.endpointCurveD0Oracles++; assert.deepEqual(evaluateCurve(edge.curve, o.parameter), o.canonicalPoint);
    assert.equal(o.local.length, 2); o.local.forEach((local, j) => { const use = edge.uses[j]; assert.equal(local.useId, use.id); assert.ok(Object.is(local.parameter, use.parameterMap.localEndpointParameters[endpoint])); additionalWork.endpointCurveD0Oracles++; assert.deepEqual(evaluateCurve(use.origin.localCurve, local.parameter), local.point); });
    const gaps = [o.canonicalVertexGapMM, ...o.local.flatMap(local => [local.canonicalGapMM, local.vertexGapMM])]; gaps.forEach(gap => assert.ok(Number.isFinite(gap) && gap >= 0 && gap <= 1e-7)); maximum = Math.max(maximum, ...gaps); assert.ok(edges.has(o.edgeId));
  });
  assert.equal(result.report.maximumObservedEndpointGapMM, maximum);
}
const directCounts = { parentValidationCount: 2, newCurveValidationCount: 4, ruledSurfaceBuildCount: 4, parametricFaceBuildCount: 4, faceModelAdoptionCount: 4, constructorDelegationCount: 18, observationCount: 24, curveD0AttemptCount: 72, curveD1AttemptCount: 0, surfaceD0AttemptCount: 0, surfaceD1AttemptCount: 0, sourceCompilationCount: 0, rationalFloatConversionCount: 0 };
function resultOracle(result, request, edited) {
  assert.deepEqual(Object.keys(result).sort(), ['request', 'closures', 'vertices', 'edges', 'faces', 'shell', 'body', 'proof', 'observations', 'report'].sort()); assert.deepEqual(result.request, request); noAliases(request, result);
  assert.deepEqual(result.report.directCounts, directCounts); assert.deepEqual(result.report.inheritedCounts, { a: request.a.report.directCounts, b: request.b.report.directCounts, ruled: result.closures.map(c => c.ruled.report) });
  assert.deepEqual([...result.report.reservedIds].sort(), reserved(request.options).sort()); assert.equal(new Set(result.report.reservedIds).size, 128);
  assert.deepEqual([result.report.vertexCount, result.report.edgeCount, result.report.faceCount, result.report.loopCount, result.report.useCount, result.report.edgePairCount, result.report.vertexLinkCount, result.report.cornerArcCount, result.report.freeBoundaryCount], [8, 12, 6, 6, 24, 12, 8, 24, 0]);
  assert.equal(result.report.originalTrimmedModelCount, 2); assert.equal(result.report.closureRuledModelCount, 4); assert.equal(result.report.closureFaceModelCount, 4); assert.equal(result.report.flattenedMasterModelProduced, false);
  assert.equal(result.report.bodyId, result.body.id); assert.equal(result.report.shellId, result.shell.id); assert.equal(result.report.materialCertificateId, result.body.materialCertificateId); assert.deepEqual(result.report.faceIds, result.faces.map(f => f.id));
  assert.equal(result.report.directionConvention, 'selected-parent-stored-use-order-already-includes-face-orientation'); assert.equal(request.a.faces[0].orientation, 'forward'); assert.equal(request.b.faces[0].orientation, 'reverse');
  assert.equal(request.a.report.quality.solid, false); assert.equal(request.b.report.quality.solid, false); assert.equal(request.a.request.section.report.quality.solid, false);
  for (const field of ['sharedBodyTopology', 'manifold', 'restrictedSolid', 'sourceDefinedOccupiedRegion', 'exactOccupiedVolume', 'outwardMaterial', 'wholeBodyEmbedding', 'fullParentsAndClosuresRetained', 'parentFlagsUnchanged']) assert.equal(result.report.quality[field], true, field);
  for (const field of ['genericBoolean', 'generalCurvedSolidProperties', 'globalC1', 'globalBinary64EvaluationErrorCertified', 'manufacturingToleranceCertified', 'weldingPerformed', 'publication']) assert.equal(result.report.quality[field], false, field);
  assert.equal(result.report.volumeUnit, 'mm3'); assert.deepEqual(result.report.fileSizes.request, size(nativeJSON(request) + '\n')); assert.deepEqual(result.report.fileSizes.result, size(nativeJSON(result) + '\n')); assert.equal(result.report.ownValues, ownValues(result)); assert.equal(result.report.rationalCounts.floatConversions, 0); assert.ok(result.report.rationalCounts.operations <= 200000); assert.ok(result.report.rationalCounts.gcdSteps <= 200000);
  closureOracle(result); graphOracle(result, edited); materialOracle(result, edited); observationOracle(result);
}
function coldSources(result) {
  const references = [];
  const check = (source, model, field) => { const key = hash(source) + ':' + hash(model); if (!coldContexts.has(key)) { const name = 'cold-' + coldContexts.size, path = saveText(name + '.source0.css', source); assert.deepEqual(compile(readFileSync(path, 'utf8')), model); saveJSON(name + '-model', model); coldContexts.set(key, { sourceHash: hash(source), modelHash: hash(model), path }); } references.push({ field, ...coldContexts.get(key) }); };
  for (const side of ['a', 'b']) result.request[side].request.section.request.assets.forEach((asset, i) => check(asset.source, result.request[side].request.section.originalModels[i], 'request.' + side + '.request.section.request.assets[' + i + '].source'));
  function walk(value, field) { if (!value || typeof value !== 'object') return; if (typeof value.source === 'string' && value.model?.objects) check(value.source, value.model, field + '.source'); Object.entries(value).forEach(([key, child]) => walk(child, field + (Array.isArray(value) ? '[' + key + ']' : '.' + key))); } walk(result, 'result'); return references;
}
function construct(name, pair, edited) {
  const request = { a: pair.a, b: pair.b, options: structuredClone(options) }, before = nativeJSON(request); additionalWork.materialBuilds++; const result = build(request.a, request.b, request.options); assert.equal(nativeJSON(request), before); resultOracle(result, request, edited);
  additionalWork.ownedCalls++; const report = validate(result); assert.deepEqual(report, result.report); assert.notEqual(report, result.report);
  saveJSON(name + '-paired-section', pair.section); saveJSON(name + '-a-faces', pair.a); saveJSON(name + '-b-faces', pair.b); const file = saveJSON(name + '-request', request, 8388608); saveJSON(name + '-result', result); saveJSON(name + '-report', result.report); saveJSON(name + '-cold-source-contexts', coldSources(result));
  saveJSON(name + '-original-uv-graphs', { bothUV: pair.section.pcurves, a: pair.a.edges.map(e => ({ edgeId: e.id, pcurve: e.pcurve })), b: pair.b.edges.map(e => ({ edgeId: e.id, pcurve: e.pcurve })), globalUses: result.faces.map(f => ({ faceId: f.id, uses: f.loop.uses })) });
  const reopened = JSON.parse(readFileSync(file, 'utf8')); assert.deepEqual(reopened, request); const fresh = parents(reopened.a.request.section.request); assert.deepEqual(fresh.a, reopened.a); assert.deepEqual(fresh.b, reopened.b); additionalWork.materialBuilds++; const rebuilt = build(fresh.a, fresh.b, reopened.options); assert.deepEqual(rebuilt, result); saveJSON(name + '-cold-rebuild', rebuilt);
  retained.push([request, before], [result, nativeJSON(result)]); cases.push({ name, resultHash: hash(result), exactVolumeMM3: result.report.exactVolumeMM3, fileSizes: result.report.fileSizes, directCounts: result.report.directCounts, inheritedCounts: result.report.inheritedCounts, rationalCounts: result.report.rationalCounts, maximumObservedEndpointGapMM: result.report.maximumObservedEndpointGapMM }); return result;
}
const mainPair = parents(sectionRequest), main = construct('main', mainPair, false);
const editRequest = { source: assets[0].source, sourceVersion: 0, surfaceId: 'support', edits: { poleEdits: [{ uIndex: 1, vIndex: 0, zMM: -.875 }] } };
additionalWork.editorCalls++; const edit = editSourceSurfaceControlNetWide(editRequest); additionalWork.editorOwnedCalls++; assert.deepEqual(validateSourceSurfaceControlNetWideEdit(edit), edit.report); assert.equal(edit.report.changedFieldCount, 1); assert.equal(edit.patches.length, 1); assert.deepEqual(edit.model.objects[0], edit.originalModel.objects[0]); assert.deepEqual(edit.model.objects[2], edit.originalModel.objects[2]); saveJSON('actual-one-pole-edit-request', editRequest); saveJSON('actual-one-pole-edit', edit);
const editedRequest = structuredClone(sectionRequest); editedRequest.assets[0].source = edit.source; editedRequest.assets[0].surface = structuredClone(edit.surface); const editedPair = parents(editedRequest); assert.deepEqual(editedPair.section.request.assets[1], mainPair.section.request.assets[1]); assert.deepEqual(editedPair.section.originalModels[1], mainPair.section.originalModels[1]); const edited = construct('edited', editedPair, true);
assert.notDeepEqual(edited.proof.material.profile.aZPower, main.proof.material.profile.aZPower); assert.deepEqual(edited.proof.material.profile.bYPower, main.proof.material.profile.bYPower); assert.notDeepEqual(edited.closures[0].ruled.surface, main.closures[0].ruled.surface); assert.notDeepEqual(edited.closures[3].ruled.surface, main.closures[3].ruled.surface); retained.push([edit, nativeJSON(edit)]);

function requestControl(name, change, expected) { const r = structuredClone(main.request); change(r); return reject(name, () => build(r.a, r.b, r.options), expected); }
const mixed = reject('independently-valid-old-a-edited-b', () => build(mainPair.a, editedPair.b, options), ['BINDING', 'PROFILE']); assert.equal(mixed.context.directCounts.parentValidationCount, 2); assert.equal(mixed.context.directCounts.ruledSurfaceBuildCount, 0);
requestControl('stale-parent-source', r => { r.a.request.section.request.assets[0].source += '\n/* retained source size changed */'; }, 'PARENT');
requestControl('stale-parent-local-use', r => { r.b.loops[0].uses[0].sense = r.b.loops[0].uses[0].sense === 'forward' ? 'reverse' : 'forward'; }, 'PARENT');
requestControl('fresh-generated-id-collision', r => { r.options.evaluationId = 'pm_c0_low'; }, 'IDENTITY');
requestControl('inherited-native-id-collision', r => { r.options.evaluationId = 'support'; }, 'IDENTITY');
requestControl('wrong-closure-cap', r => { r.options.maximumClosures = 3; }, ['BUDGET', 'INPUT']);
requestControl('wrong-observation-cap', r => { r.options.maximumObservations = 23; }, ['BUDGET', 'INPUT']);
requestControl('unknown-options-field', r => { r.options.tolerance = 1; }, 'INPUT');
requestControl('actual-source-string-cap', r => { r.a.request.section.request.assets[0].source += ' '.repeat(262145); }, ['BUDGET', 'INPUT']);
additionalWork.aBuilds++; const reversedA = aBuild({ section: mainPair.section, options: { ...mainPair.a.request.options, orientation: 'reverse' } }); reject('valid-wrong-roof-orientation', () => build(reversedA, mainPair.b, options), ['PROFILE', 'ORIENTATION']);

// Real source-backed negative height, if all original parent profiles admit it.
const heightA = structuredClone(A); heightA.controlPoints.forEach(row => row.forEach(p => { p[2] = p[1]; })); const heightRequest = structuredClone(sectionRequest); heightRequest.assets[0].source = sourceFor(heightA, 1); heightRequest.assets[0].surface = compile(heightRequest.assets[0].source).objects[1];
let heightControl;
try { const pair = parents(heightRequest); saveJSON('genuine-height-negative-paired-section', pair.section); saveJSON('genuine-height-negative-a', pair.a); saveJSON('genuine-height-negative-b', pair.b); heightControl = reject('actual-roof-low-y-below-low-z', () => build(pair.a, pair.b, options)); }
catch (cause) { if (!(cause instanceof api.ExactPairedVLinearSurfaceIntersectionError || cause instanceof api.PairedSurfaceUVSplitFacesError || cause instanceof api.PairedSurfaceBUVSplitFacesError)) throw cause; heightControl = { outcome: 'earlier-real-parent-refusal', name: cause.name, code: cause.code, message: cause.message, context: cause.context }; } saveJSON('height-negative-control', heightControl);

const mutations = [
  ['parent-source-size', r => { r.request.a.request.section.request.assets[0].source += '\n/* changed retained Source */'; }],
  ['closure-low-curve', r => { r.closures[0].lowCurve.controlPoints[1][2] += .125; }],
  ['closure-native-surface', r => { r.closures[0].ruled.surface.controlPoints[1][0][2] += .125; }],
  ['closure-source', r => { r.closures[0].world.source += '\n/* retained size changed */'; }],
  ['global-vertex', r => { r.vertices[0].world[2] += .125; }],
  ['global-curve-ref', r => { r.edges[0].curveRef.objectIndex = 0; }],
  ['parameter-map', r => { r.edges[0].uses[0].parameterMap.offset.numerator = '2'; }],
  ['effective-use', r => { r.faces[0].loop.uses[0].sense = r.faces[0].loop.uses[0].sense === 'forward' ? 'reverse' : 'forward'; }],
  ['face-orientation', r => { r.faces[0].orientation = 'reverse'; }],
  ['material-volume', r => { r.proof.material.volume.exactVolumeMM3.numerator = '28'; }],
  ['material-height', r => { r.proof.material.cubeMap.heightZBernstein[0][0].numerator = '6'; }],
  ['whole-face-residual', r => { r.proof.material.faceImages[0].residuals[0][0][0].numerator = '1'; }],
  ['vertex-link', r => { r.proof.vertexLinks[0].connected = false; }],
  ['native-observation', r => { r.observations[0].canonicalPoint[0] += .125; }],
  ['native-count', r => { r.report.directCounts.curveD0AttemptCount++; }],
  ['result-file-size', r => { r.report.fileSizes.result.utf8++; }],
  ['restricted-solid', r => { r.body.restrictedSolidCertified = false; }],
];
for (const [name, change] of mutations) { const value = structuredClone(main), before = nativeJSON(value); change(value); assert.notEqual(nativeJSON(value), before); reject('owned-' + name, () => validate(value), 'OWNED'); ownControls.push(name); }
const cyclic = structuredClone(main); cyclic.self = cyclic; reject('owned-cycle', () => validate(cyclic), 'OWNED'); const sparse = structuredClone(main); delete sparse.edges[1]; reject('owned-sparse', () => validate(sparse), 'OWNED');
let getterCalls = 0; const getterOptions = structuredClone(options); Object.defineProperty(getterOptions, 'evaluationId', { enumerable: true, get() { getterCalls++; return 'bad'; } }); reject('options-getter', () => build(mainPair.a, mainPair.b, getterOptions), 'INPUT'); assert.equal(getterCalls, 0); const getterOwned = structuredClone(main); Object.defineProperty(getterOwned.report, 'evaluationId', { enumerable: true, get() { getterCalls++; return 'bad'; } }); reject('owned-getter', () => validate(getterOwned), 'OWNED'); assert.equal(getterCalls, 0);
saveJSON('refusals', failures); saveJSON('owned-controls', { nonNoopMutations: ownControls, getterCalls, cycle: true, sparse: true }); saveJSON('source-api.metafile', bundle.metafile); saveText('source-api.mjs', bundle.outputFiles[0].text);
const publicAPI = await import(pathToFileURL(resolve(repo, 'packages/barocss-cad/dist/index.js')).href), declarations = readFileSync(resolve(repo, 'packages/barocss-cad/dist/index.d.ts'), 'utf8'); for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function'); for (const name of [...runtimeNames, ...typeNames]) assert.match(declarations, new RegExp('\\b' + name + '\\b')); assert.deepEqual(publicAPI.PairedSurfaceMaterialBodyDiagnosticCode, codes);
additionalWork.publicBuilds++; const publicMain = publicAPI.buildPairedSurfaceMaterialBody(mainPair.a, mainPair.b, options); assert.deepEqual(publicMain, main); additionalWork.publicOwnedCalls++; assert.deepEqual(publicAPI.validatePairedSurfaceMaterialBody(publicMain), main.report); saveJSON('current-public-main', publicMain); retention();
const summary = { schema: 'paired-surface-material-body-demo', version: 0, nativeParent: 'cbdd54e4d80533387754d85b717a3a70d54ec0cf', cases, runtimeNames, typeNames, additionalWork, independentExactArithmetic: arithmetic, exactVolumesMM3: ['27/40', '40869/57344'], exactEditedIncreaseMM3: '10809/286720', unchangedBSourceHash: hash(assets[1].source), graphCounts: { vertices: 8, edges: 12, faces: 6, uses: 24 }, sourceModelsRetained: { originalTrimmed: 2, ruled: 4, closureFace: 4 }, originalFlagsUnchanged: true, freshRestrictedSolid: true, noFlattenedModel18: true, wholeSixSourceImagesAndExactOccupiedRegion: true, ownedNonNoopCount: ownControls.length, getterCalls, refusalCount: failures.length, heightControl, sourceInputs: inputs.length, outputFilesBeforeSummary: files.size, untestedLimits: ['aggregate-eight-MiB-request-overflow', 'aggregate-sixteen-MiB-result-overflow', 'rational-work-boundary', 'own-values-boundary'], noInventedCodec: true, noOldKernelCampaign: true, generalSolid: false, genericBoolean: false, workScope: 'additional-demo-parent-editor-cold-endpoint-owned-public-work-separated-from-root-and-inherited-work' }; saveJSON('summary', summary); console.log(nativeJSON(summary));
