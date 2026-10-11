import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node paired-surface-uv-face-classification-demo.mjs --source <output-directory>'); assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]); mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const bundle = await require('esbuild').build({ entryPoints: [resolve(repo, 'packages/barocss-cad/src/index.ts')], absWorkingDir: repo, bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
assert.equal(bundle.outputFiles.length, 1);
const inputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path));
for (const leaf of ['paired-surface-uv-face-classification.ts', 'paired-surface-uv-face-classification-internal.ts', 'paired-surface-uv-split-faces.ts', 'paired-surface-b-uv-split-faces.ts', 'exact-paired-vlinear-surface-intersection.ts', 'source-surface-control-net-wide.ts']) assert.ok(inputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
assert.ok(!inputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const { classifyPairedSurfaceUVFaces: classify, validatePairedSurfaceUVFaceClassification: validate, PairedSurfaceUVFaceClassificationError: FamilyError, PairedSurfaceUVFaceClassificationDiagnosticCode: codes, buildExactPairedVLinearSurfaceIntersection: sectionBuild, buildPairedSurfaceUVSplitFaces: aBuild, buildPairedSurfaceBUVSplitFaces: bBuild, compileCadModel, editSourceSurfaceControlNetWide, validateSourceSurfaceControlNetWideEdit } = api;
const runtimeNames = ['classifyPairedSurfaceUVFaces', 'validatePairedSurfaceUVFaceClassification', 'PairedSurfaceUVFaceClassificationError', 'PairedSurfaceUVFaceClassificationDiagnosticCode'];
const typeNames = ['PairedSurfaceUVFaceQuery', 'PairedSurfaceUVFaceOptions', 'PairedSurfaceUVFaceReport', 'PairedSurfaceUVFaceResult'];
for (const name of runtimeNames) assert.equal(typeof api[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(Object.keys(codes).sort(), ['INPUT', 'IDENTITY', 'PARENT', 'BINDING', 'DOMAIN', 'BUDGET', 'FILE', 'OWNED'].sort());
function nativeJSON(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}';
}
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : nativeJSON(value)).digest('hex');
const size = text => ({ utf16: text.length, utf8: Buffer.byteLength(text) });
const files = new Map(), retained = [], failures = [], ownControls = [], cases = [], coldContexts = new Map();
const additionalWork = { sectionBuilds: 0, aBuilds: 0, bBuilds: 0, classifierCalls: 0, ownedCalls: 0, coldCompiles: 0, editorCalls: 0, editorOwnedCalls: 0, publicClassifications: 0, publicOwnedCalls: 0, rootNativeOracleCalls: 0, rootFinderCalls: 0 };
function saveText(name, text) { const path = resolve(output, name); writeFileSync(path, text); assert.equal(readFileSync(path, 'utf8'), text); files.set(path, readFileSync(path)); return path; }
function saveJSON(name, value, maximum = 16777216) { const text = nativeJSON(value) + '\n'; assert.ok(text.length <= maximum && Buffer.byteLength(text) <= maximum, name); const path = saveText(name + '.json', text); assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), value); return path; }
function compile(source) { additionalWork.coldCompiles++; const result = compileCadModel(source, { sourceVersion: 0 }); assert.equal(result.ok, true, JSON.stringify(result.diagnostics)); return result.model; }
function retention() { for (const [path, bytes] of files) assert.deepEqual(readFileSync(path), bytes); for (const [value, text] of retained) assert.equal(nativeJSON(value), text); }
function ownValues(value) { return !value || typeof value !== 'object' ? 1 : 1 + Object.values(value).reduce((n, child) => n + ownValues(child), 0); }
function noAliases(input, result) { const caller = new WeakSet(); const collect = value => { if (value && typeof value === 'object') { caller.add(value); Object.values(value).forEach(collect); } }; collect(input); const check = value => { if (value && typeof value === 'object') { assert.ok(!caller.has(value)); Object.values(value).forEach(check); } }; check(result); }
function reject(name, action, expected) { let error; try { action(); } catch (cause) { error = cause; } assert.ok(error instanceof FamilyError, name + ': actual family error'); if (expected) assert.ok([].concat(expected).includes(error.code), name + ': ' + error.code); assert.ok(error.context?.directCounts); const record = { name, code: error.code, message: error.message, context: error.context, causeName: error.cause?.name ?? null, causeMessage: error.cause?.message ?? null }; failures.push(record); retention(); return record; }
const knots = (a, b, p) => [...Array(p + 1).fill(a), ...Array(p + 1).fill(b)];
function sourceFor(s, index) {
  const curve = '@curve #curve_sibling {type:nurbs;degree:1;knots:[0.000,0,1,1.00];control-points:[[-0,2,1],[3,4,2]];weights:[1,2];}';
  const sibling = '@surface #native_wide_sibling {type:nurbs;degree-u:1;degree-v:1;knots-u:[0,0,1,1];knots-v:[-1,-1,2,2];control-points:[[[12000,2,-0],[12000,4,1]],[[12002,2,2],[12002,4,3]]];weights:[[1,2],[3,4]];}';
  const selected = '@surface #' + s.id + ' {type:nurbs;degree-u:' + s.degreeU + ';degree-v:' + s.degreeV + ';knots-u:' + nativeJSON(s.knotsU) + ';knots-v:' + nativeJSON(s.knotsV) + ';control-points:' + nativeJSON(s.controlPoints) + ';weights:' + nativeJSON(s.weights) + ';}';
  return '/* 설계: exact original UV membership. */\r\n@model intersection_model {version:0;length-unit:mm;\r\n' + (index === 1 ? [curve, selected, sibling] : [sibling, curve, selected]).join('\r\n') + '\r\n}\r\n';
}
const A = { kind: 'surface', id: 'support', degreeU: 2, degreeV: 1, knotsU: knots(-1, 1, 2), knotsV: knots(-.5, 1.5, 1), controlPoints: [-1, 0, 1].map((x, i) => [-.5, 1.5].map(y => [x, y, [1, -1, 1][i]])), weights: Array.from({ length: 3 }, () => [1, 1]) };
const B = { kind: 'surface', id: 'support', degreeU: 2, degreeV: 1, knotsU: knots(2, 4, 2), knotsV: knots(-.25, 1.25, 1), controlPoints: [-1, 0, 1].map((x, i) => [-.25, 1.25].map(z => [x, [1, -1, 1][i], z])), weights: Array.from({ length: 3 }, () => [1, 1]) };
const assets = [A, B].map((surface, i) => { const source = sourceFor(surface, [1, 2][i]); assert.deepEqual(compile(source).objects[[1, 2][i]], surface); return { sourceId: ['source_a', 'source_b'][i], source, surface: structuredClone(surface) }; });
const sectionRequest = { assets, uAInterval: [-1, .5], options: { evaluationId: 'membership_section', worldCurveId: 'membership_cut', pcurveAId: 'membership_cut_a', pcurveBId: 'membership_cut_b', maximumObservations: 5 } };
const faceOptions = (evaluationId, prefix, orientation) => ({ evaluationId, resultIdPrefix: prefix, orientation, maximumIsoCurves: 2, maximumIntervals: 2, maximumObservations: 35 });
function parents(request, orientation = 'forward') { additionalWork.sectionBuilds++; const section = sectionBuild(request); additionalWork.aBuilds++; const a = aBuild({ section, options: faceOptions('membership_a', 'qa', orientation) }); additionalWork.bBuilds++; const b = bBuild(section, faceOptions('membership_b', 'qb', orientation)); assert.deepEqual(a.request.section, b.request.section); return { a, b, section }; }
const queries = [
  [0, -.25, 0], [0, -.25, .5], [0, -0, -0], [0, -.25, -.5], [0, -1, -.5], [0, .5, 1.5], [0, .75, 0], [0, 0, -.75],
  [1, 3, 1 / 64], [1, 3, 0], [1, 2, 1], [1, 3.5, -.25], [1, 3, 1.25], [1, 2.75, -.125], [1, 3.75, 0], [1, 3, -.5],
].map(([assetIndex, u, v], index) => ({ queryId: 'q' + (index + 1), assetIndex, u, v }));
const options = { evaluationId: 'uv_membership', maximumQueries: 16 };

// Independent bounded exact arithmetic for sixteen predicates; no native evaluation or root solver.
const arithmetic = { operations: 0, maximumBits: 0, comparisons: 0 };
function work() { assert.ok(++arithmetic.operations <= 2000000); }
function sized(n) { work(); const bits = (n < 0n ? -n : n).toString(2).length; assert.ok(bits <= 8192); arithmetic.maximumBits = Math.max(arithmetic.maximumBits, bits); return n; }
function q(n, d = 1n) { sized(n); sized(d); assert.notEqual(d, 0n); if (d < 0n) { n = -n; d = -d; } let a = n < 0n ? -n : n, b = d; while (b) { work(); const r = sized(a % b); a = b; b = r; } const divisor = a || 1n; return { n: n / divisor, d: d / divisor }; }
const view = new DataView(new ArrayBuffer(8));
function represented(x) { assert.ok(Number.isFinite(x)); view.setFloat64(0, x); const bits = view.getBigUint64(0), e = Number((bits >> 52n) & 2047n), f = bits & 0xfffffffffffffn, m = e ? f + (1n << 52n) : f, n = bits >> 63n ? -m : m, p = e ? e - 1075 : -1074; return p >= 0 ? q(sized(n << BigInt(p))) : q(n, sized(1n << BigInt(-p))); }
const ZERO = q(0n), ONE = q(1n);
const add = (a, b) => q(sized(sized(a.n * b.d) + sized(b.n * a.d)), sized(a.d * b.d));
const neg = a => q(-a.n, a.d);
const sub = (a, b) => add(a, neg(b));
const mul = (a, b) => q(sized(a.n * b.n), sized(a.d * b.d));
const div = (a, b) => q(sized(a.n * b.d), sized(a.d * b.n));
const dto = f => { assert.ok(f.numerator.length <= 5000 && f.denominator.length <= 5000); return q(BigInt(f.numerator), BigInt(f.denominator)); };
const compare = (a, b) => { arithmetic.comparisons++; const difference = sized(sized(a.n * b.d) - sized(b.n * a.d)); return difference < 0n ? -1 : difference > 0n ? 1 : 0; };
const eq = (a, b) => assert.equal(compare(a, b), 0);
function analyticCut(u, assetIndex, edited) { const u2 = mul(u, u); return edited && assetIndex === 1 ? add(u2, mul(q(1n, 32n), mul(sub(ONE, u2), sub(q(3n, 2n), u2)))) : u2; }
function storedCut(poles, t) { let row = poles.map(represented), rows = [row]; for (let step = 4; step > 0; step--) { row = row.slice(0, -1).map((x, i) => add(mul(sub(ONE, t), x), mul(t, row[i + 1]))); rows.push(row); } return rows; }
function queryOracle(result, index, edited) {
  const query = result.request.queries[index], parent = [result.request.a, result.request.b][query.assetIndex], support = result.proof.supports[query.assetIndex], entry = result.proof.queries[index], actual = result.classifications[index];
  assert.equal(entry.queryId, query.queryId); assert.equal(entry.assetIndex, query.assetIndex); eq(dto(entry.queryUV[0]), represented(query.u)); eq(dto(entry.queryUV[1]), represented(query.v));
  const u = represented(query.u), v = represented(query.v), w = parent.report.window;
  const signs = { uMinimum: compare(u, represented(w.u[0])), uMaximum: compare(u, represented(w.u[1])), vMinimum: compare(v, represented(w.v[0])), vMaximum: compare(v, represented(w.v[1])) };
  assert.deepEqual(entry.boundSigns, signs);
  const bounds = []; if (signs.uMinimum === 0) bounds.push('u-min'); if (signs.uMaximum === 0) bounds.push('u-max'); if (signs.vMinimum === 0) bounds.push('v-min'); if (signs.vMaximum === 0) bounds.push('v-max');
  const outside = signs.uMinimum < 0 || signs.uMaximum > 0 || signs.vMinimum < 0 || signs.vMaximum > 0;
  const window = outside ? 'outside' : bounds.length ? 'boundary' : 'interior';
  let relation, method, cutSign = null;
  if (outside) { relation = 'not-applicable'; method = 'outside-window'; }
  else if (signs.vMinimum === 0 || signs.vMaximum === 0) { relation = signs.vMinimum === 0 ? 'below' : 'above'; method = 'natural-v-boundary'; }
  else {
    method = 'exact-affine-quartic'; const ua = div(sub(u, dto(support.uMap.offset)), dto(support.uMap.scale));
    const t = div(sub(ua, represented(support.originalUAInterval[0])), sub(represented(support.originalUAInterval[1]), represented(support.originalUAInterval[0])));
    eq(dto(entry.originalUA), ua); eq(dto(entry.normalizedParameter), t);
    const cut = analyticCut(ua, query.assetIndex, edited), rows = storedCut(parent.edges[6].pcurve.curve.controlPoints.map(p => p[1]), t);
    assert.deepEqual(entry.deCasteljau.map(r => r.length), [5, 4, 3, 2, 1]); rows.forEach((row, i) => row.forEach((value, j) => eq(dto(entry.deCasteljau[i][j]), value)));
    eq(rows[4][0], cut); eq(dto(entry.cutValue), cut); eq(dto(entry.vMinusCut), sub(v, cut));
    cutSign = compare(v, cut); assert.equal(entry.cutSign, cutSign); relation = ['below', 'on', 'above'][cutSign + 1];
  }
  if (method !== 'exact-affine-quartic') { assert.equal(entry.originalUA, null); assert.equal(entry.normalizedParameter, null); assert.deepEqual(entry.deCasteljau, []); assert.equal(entry.cutValue, null); assert.equal(entry.vMinusCut, null); assert.equal(entry.cutSign, null); }
  const faceClasses = parent.faces.map((face, side) => ({ sourceId: face.sourceId, surfaceId: face.surfaceId, faceId: face.id, region: face.region, orientation: face.orientation, classification: outside ? 'outside' : relation === 'on' ? 'boundary' : (relation === 'below' ? side === 0 : side === 1) ? (bounds.length ? 'boundary' : 'inside') : 'outside' }));
  const expected = { queryId: query.queryId, assetIndex: query.assetIndex, window, windowBoundaries: bounds, cutRelation: relation, faces: faceClasses };
  assert.deepEqual(actual, expected); assert.deepEqual(entry.classification, actual); return { method, relation, window, assetIndex: query.assetIndex };
}

function resultOracle(result, request, edited) {
  assert.deepEqual(Object.keys(result).sort(), ['request', 'classifications', 'proof', 'report'].sort()); assert.deepEqual(result.request, request); noAliases(request, result);
  assert.equal(result.classifications.length, 16); assert.equal(result.proof.queries.length, 16);
  assert.equal(result.proof.sameCompletePairedParent, true); assert.equal(result.proof.unchangedSharedWorldCurve, true); assert.equal(result.proof.preservedOriginalParameterFrames, true);
  assert.deepEqual(request.a.request.section, request.b.request.section);
  result.proof.supports.forEach((support, i) => {
    const parent = [request.a, request.b][i], asset = parent.request.section.request.assets[i], selection = parent.request.section.report.selections[i];
    assert.deepEqual(support.reference, { assetIndex: i, sourceId: asset.sourceId, surfaceId: asset.surface.id, modelName: selection.modelName, objectIndex: selection.objectIndex, sourceField: 'request.' + ['a', 'b'][i] + '.request.section.request.assets[' + i + '].source', modelField: 'request.' + ['a', 'b'][i] + '.request.section.originalModels[' + i + ']' });
    assert.equal(support.parentEvaluationId, parent.report.evaluationId); assert.deepEqual(support.window, parent.report.window); assert.deepEqual(support.faceIds, parent.faces.map(f => f.id)); assert.deepEqual(support.orientations, parent.faces.map(f => f.orientation));
    assert.equal(support.sharedCutEdgeId, parent.edges[6].id); assert.equal(support.worldCurveId, parent.edges[6].curve.id); assert.equal(support.pcurveId, parent.edges[6].pcurve.curve.id); assert.deepEqual(support.originalUAInterval, [-1, .5]);
    eq(dto(support.uMap.offset), q(i === 0 ? 0n : 3n)); eq(dto(support.uMap.scale), ONE);
    support.vCoefficients.forEach((f, j) => eq(dto(f), represented(parent.edges[6].pcurve.curve.controlPoints[j][1])));
  });
  const oracle = result.classifications.map((_, i) => queryOracle(result, i, edited));
  const report = result.report, counts = report.directCounts, quartics = oracle.filter(o => o.method === 'exact-affine-quartic').length;
  assert.equal(counts.parentValidationCount, 2); assert.equal(counts.queryCount, 16); assert.equal(counts.quarticEvaluationCount, quartics); assert.equal(quartics, 7); assert.equal(counts.affineInversionCount, oracle.filter(o => o.method === 'exact-affine-quartic' && o.assetIndex === 1).length); assert.equal(counts.affineInversionCount, 4);
  // Support comparisons are also real root work; query comparison count is a lower bound.
  assert.ok(Number.isInteger(counts.signComparisonCount) && counts.signComparisonCount >= 4 * 16 + quartics);
  for (const field of ['curveD0Count', 'curveD1Count', 'surfaceD0Count', 'surfaceD1Count', 'sourceCompilationCount', 'rationalFloatConversionCount']) assert.equal(counts[field], 0);
  assert.deepEqual(report.inheritedCounts, { a: request.a.report.directCounts, b: request.b.report.directCounts });
  assert.deepEqual(report.assetQueryCounts, [8, 8]); assert.equal(report.queryCount, 16); assert.deepEqual(report.parentEvaluationIds, [request.a.report.evaluationId, request.b.report.evaluationId]); assert.equal(report.pairedEvaluationId, request.a.request.section.report.evaluationId);
  const windowCounts = { outside: 0, interior: 0, boundary: 0 }, relationCounts = { below: 0, on: 0, above: 0, 'not-applicable': 0 };
  oracle.forEach(o => { windowCounts[o.window]++; relationCounts[o.relation]++; }); assert.deepEqual(report.windowCounts, windowCounts); assert.deepEqual(report.relationCounts, relationCounts);
  assert.deepEqual(windowCounts, { outside: 4, interior: 6, boundary: 6 });
  assert.deepEqual(relationCounts, edited ? { below: 7, on: 2, above: 3, 'not-applicable': 4 } : { below: 5, on: 3, above: 4, 'not-applicable': 4 });
  const faceCounts = []; [request.a, request.b].forEach((parent, assetIndex) => parent.faces.forEach(face => { const c = { assetIndex, faceId: face.id, inside: 0, outside: 0, boundary: 0 }; result.classifications.filter(x => x.assetIndex === assetIndex).forEach(x => { c[x.faces.find(f => f.faceId === face.id).classification]++; }); faceCounts.push(c); })); assert.deepEqual(report.faceCounts, faceCounts);
  assert.equal(report.lengthUnit, 'dimensionless'); assert.equal(report.parameterFrame, 'original-a-u-v-and-original-b-u-v'); assert.equal(report.numericPolicy.toleranceUsed, false); assert.equal(report.numericPolicy.rootFindingUsed, false); assert.equal(report.numericPolicy.snapPerformed, false); assert.equal(report.numericPolicy.rootFloatConversion, false);
  for (const field of ['exactUVFaceMembershipCertified', 'fullParentsRetained', 'parentFlagsUnchanged', 'originalBitsPreserved', 'orientationIndependentMembership']) assert.equal(report.quality[field], true);
  for (const field of ['worldPointMembershipCertified', 'occupied3DMaterialCertified', 'sewnManifold', 'wholeBodyTopologyCertified', 'solid', 'booleanCertified', 'worldSurfaceAreaComputed', 'globalBinary64EvaluationErrorCertified', 'manufacturingToleranceCertified', 'publication']) assert.equal(report.quality[field], false);
  assert.deepEqual(report.fileSizes.request, size(nativeJSON(request) + '\n')); assert.deepEqual(report.fileSizes.result, size(nativeJSON(result) + '\n')); assert.equal(report.ownValues, ownValues(result));
  assert.equal(report.rationalCounts.floatConversions, 0); assert.ok(report.rationalCounts.operations <= 200000); assert.ok(report.rationalCounts.gcdSteps <= 200000);
  assert.ok(Object.is(result.request.queries[2].u, -0) && Object.is(result.request.queries[2].v, -0));
}
function coldParentSources(request) {
  const references = [];
  const check = (source, model, field) => { const key = hash(source) + ':' + hash(model); if (!coldContexts.has(key)) { const name = 'cold-' + coldContexts.size, path = saveText(name + '.source0.css', source); assert.deepEqual(compile(readFileSync(path, 'utf8')), model); saveJSON(name + '-model', model); coldContexts.set(key, { sourceHash: hash(source), modelHash: hash(model), path }); } references.push({ field, ...coldContexts.get(key) }); };
  for (const side of ['a', 'b']) {
    const parent = request[side], section = parent.request.section;
    section.request.assets.forEach((asset, i) => check(asset.source, section.originalModels[i], 'request.' + side + '.request.section.request.assets[' + i + '].source'));
    function walk(value, field) { if (!value || typeof value !== 'object') return; if (typeof value.source === 'string' && value.model?.objects) check(value.source, value.model, field + '.source'); Object.entries(value).forEach(([key, child]) => walk(child, field + (Array.isArray(value) ? '[' + key + ']' : '.' + key))); }
    walk(parent, 'request.' + side);
  }
  return references;
}
function construct(name, pair, edited) {
  const request = { a: pair.a, b: pair.b, queries: structuredClone(queries), options: structuredClone(options) }, before = nativeJSON(request);
  additionalWork.classifierCalls++; const result = classify(request.a, request.b, request.queries, request.options); assert.equal(nativeJSON(request), before); resultOracle(result, request, edited);
  additionalWork.ownedCalls++; const report = validate(result); assert.deepEqual(report, result.report); assert.notEqual(report, result.report);
  saveJSON(name + '-paired-section', pair.section); saveJSON(name + '-a-faces', pair.a); saveJSON(name + '-b-faces', pair.b);
  const file = saveJSON(name + '-request', request, 8388608); saveJSON(name + '-result', result); saveJSON(name + '-report', result.report); saveJSON(name + '-cold-source-contexts', coldParentSources(request));
  saveJSON(name + '-original-uv-graphs', { parentBothUV: pair.section.pcurves, a: pair.a.edges.map(e => ({ edgeId: e.id, pcurve: e.pcurve })), b: pair.b.edges.map(e => ({ edgeId: e.id, pcurve: e.pcurve })), queries: request.queries });
  const reopened = JSON.parse(readFileSync(file, 'utf8')); assert.deepEqual(reopened, request); const fresh = parents(reopened.a.request.section.request, reopened.a.request.options.orientation); assert.deepEqual(fresh.a, reopened.a); assert.deepEqual(fresh.b, reopened.b);
  additionalWork.classifierCalls++; const rebuilt = classify(fresh.a, fresh.b, reopened.queries, reopened.options); assert.deepEqual(rebuilt, result); saveJSON(name + '-cold-rebuild', rebuilt);
  retained.push([request, before], [result, nativeJSON(result)]); cases.push({ name, resultHash: hash(result), parentHashes: [hash(pair.a), hash(pair.b)], fileSizes: result.report.fileSizes, directCounts: result.report.directCounts, inheritedCounts: result.report.inheritedCounts, rationalCounts: result.report.rationalCounts, windowCounts: result.report.windowCounts, relationCounts: result.report.relationCounts }); return result;
}
const mainPair = parents(sectionRequest), main = construct('main', mainPair, false);
const editRequest = { source: assets[0].source, sourceVersion: 0, surfaceId: 'support', edits: { poleEdits: [{ uIndex: 1, vIndex: 0, zMM: -.875 }] } };
additionalWork.editorCalls++; const edit = editSourceSurfaceControlNetWide(editRequest); additionalWork.editorOwnedCalls++; assert.deepEqual(validateSourceSurfaceControlNetWideEdit(edit), edit.report); assert.equal(edit.report.changedFieldCount, 1); assert.equal(edit.patches.length, 1); assert.deepEqual(edit.model.objects[0], edit.originalModel.objects[0]); assert.deepEqual(edit.model.objects[2], edit.originalModel.objects[2]);
saveJSON('actual-one-pole-edit-request', editRequest); saveJSON('actual-one-pole-edit', edit);
const editedSectionRequest = structuredClone(sectionRequest); editedSectionRequest.assets[0].source = edit.source; editedSectionRequest.assets[0].surface = structuredClone(edit.surface);
const editedPair = parents(editedSectionRequest); assert.deepEqual(editedPair.section.request.assets[1], mainPair.section.request.assets[1]); assert.deepEqual(editedPair.section.originalModels[1], mainPair.section.originalModels[1]);
const edited = construct('edited', editedPair, true);
assert.deepEqual(edited.classifications.slice(0, 8), main.classifications.slice(0, 8));
assert.equal(main.classifications[8].faces[1].classification, 'inside'); assert.equal(edited.classifications[8].faces[0].classification, 'inside'); assert.equal(edited.classifications[8].faces[1].classification, 'outside');
eq(dto(main.proof.queries[8].vMinusCut), q(1n, 64n)); eq(dto(edited.proof.queries[8].vMinusCut), q(-1n, 32n)); assert.equal(main.classifications[9].cutRelation, 'on'); assert.equal(edited.classifications[9].cutRelation, 'below');
retained.push([edit, nativeJSON(edit)]);
const reversePair = parents(sectionRequest, 'reverse'), reverse = construct('reverse', reversePair, false);
const withoutOrientation = c => ({ ...c, faces: c.faces.map(({ orientation, ...rest }) => rest) });
assert.deepEqual(reverse.classifications.map(withoutOrientation), main.classifications.map(withoutOrientation));
reverse.classifications.forEach((c, i) => { c.faces.forEach(face => assert.equal(face.orientation, 'reverse')); assert.deepEqual({ ...reverse.proof.queries[i], classification: withoutOrientation(c) }, { ...main.proof.queries[i], classification: withoutOrientation(main.classifications[i]) }); });

function requestControl(name, change, expected) { const r = structuredClone(main.request); change(r); return reject(name, () => classify(r.a, r.b, r.queries, r.options), expected); }
requestControl('seventeen-query-cap', r => { r.queries.push({ queryId: 'q17', assetIndex: 0, u: 0, v: 0 }); }, 'BUDGET');
requestControl('duplicate-query-id', r => { r.queries[1].queryId = r.queries[0].queryId; }, 'IDENTITY');
requestControl('unsupported-asset', r => { r.queries[0].assetIndex = 2; }, 'INPUT');
requestControl('unknown-query-frame', r => { r.queries[0].frame = 'world'; }, 'INPUT');
requestControl('query-nonfinite', r => { r.queries[0].u = Infinity; }, 'INPUT');
requestControl('query-coordinate-cap', r => { r.queries[0].u = 10001; }, 'INPUT');
requestControl('wrong-query-budget-literal', r => { r.options.maximumQueries = 15; }, ['BUDGET', 'INPUT']);
requestControl('stale-parent-source', r => { r.a.request.section.request.assets[0].source += '\n/* changed source size */'; }, 'PARENT');
requestControl('wrong-parent-b-uv-role', r => { r.b.request.section.pcurves.b.lengthUnit = 'mm'; }, 'PARENT');
requestControl('wrong-local-face-ref', r => { r.a.faces[0].outerLoopId = r.a.loops[1].id; }, 'PARENT');
const mixed = reject('independently-valid-old-a-edited-b', () => classify(mainPair.a, editedPair.b, queries, options), 'BINDING'); assert.equal(mixed.context.directCounts.parentValidationCount, 2); assert.equal(mixed.context.directCounts.queryCount, 0);
requestControl('actual-source-string-cap', r => { r.b.request.section.request.assets[1].source += ' '.repeat(262145); }, ['BUDGET', 'INPUT']);
const mutations = [
  ['query-original-zero-bit', r => { r.request.queries[2].u = 0; }],
  ['query-proof-zero-bit', r => { r.request.queries[2].v = 0; }],
  ['parent-source-size', r => { r.request.a.request.section.request.assets[0].source += '\n/* retained source changed */'; }],
  ['classification', r => { r.classifications[0].faces[0].classification = 'outside'; }],
  ['window-boundary', r => { r.classifications[0].windowBoundaries.push('u-min'); }],
  ['cut-relation', r => { r.classifications[2].cutRelation = 'above'; }],
  ['face-qualified-id', r => { r.classifications[0].faces[0].sourceId = 'source_b'; }],
  ['support-native-map', r => { r.proof.supports[1].uMap.offset.numerator = '4'; }],
  ['proof-cut-value', r => { r.proof.queries[0].cutValue.numerator = '2'; }],
  ['proof-sign', r => { r.proof.queries[0].cutSign = 1; }],
  ['shortcut-method', r => { r.proof.queries[3].method = 'exact-affine-quartic'; }],
  ['decasteljau-coefficient', r => { r.proof.queries[0].deCasteljau[0][0].numerator = '2'; }],
  ['query-count', r => { r.report.directCounts.queryCount++; }],
  ['file-size', r => { r.report.fileSizes.result.utf8++; }],
  ['material-claim', r => { r.report.quality.occupied3DMaterialCertified = true; }],
];
for (const [name, change] of mutations) { const value = structuredClone(main), before = nativeJSON(value); change(value); assert.notEqual(nativeJSON(value), before); reject('owned-' + name, () => validate(value), 'OWNED'); ownControls.push(name); }
const cyclic = structuredClone(main); cyclic.self = cyclic; reject('owned-cycle', () => validate(cyclic), 'OWNED'); const sparse = structuredClone(main); delete sparse.proof.queries[1]; reject('owned-sparse', () => validate(sparse), 'OWNED');
let getterCalls = 0; const getterQueries = structuredClone(queries); Object.defineProperty(getterQueries[0], 'u', { enumerable: true, get() { getterCalls++; return 0; } }); reject('query-getter', () => classify(mainPair.a, mainPair.b, getterQueries, options), 'INPUT'); assert.equal(getterCalls, 0);
const getterOwned = structuredClone(main); Object.defineProperty(getterOwned.report, 'evaluationId', { enumerable: true, get() { getterCalls++; return 'bad'; } }); reject('owned-getter', () => validate(getterOwned), 'OWNED'); assert.equal(getterCalls, 0);
saveJSON('refusals', failures); saveJSON('owned-controls', { nonNoopMutations: ownControls, cycle: true, sparse: true, getterCalls }); saveJSON('source-api.metafile', bundle.metafile); saveText('source-api.mjs', bundle.outputFiles[0].text);
const publicAPI = await import(pathToFileURL(resolve(repo, 'packages/barocss-cad/dist/index.js')).href), declarations = readFileSync(resolve(repo, 'packages/barocss-cad/dist/index.d.ts'), 'utf8');
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function'); for (const name of [...runtimeNames, ...typeNames]) assert.match(declarations, new RegExp('\\b' + name + '\\b')); assert.deepEqual(publicAPI.PairedSurfaceUVFaceClassificationDiagnosticCode, codes);
additionalWork.publicClassifications++; const publicMain = publicAPI.classifyPairedSurfaceUVFaces(mainPair.a, mainPair.b, queries, options); assert.deepEqual(publicMain, main); additionalWork.publicOwnedCalls++; assert.deepEqual(publicAPI.validatePairedSurfaceUVFaceClassification(publicMain), main.report); saveJSON('current-public-main', publicMain); retention();
const summary = { schema: 'paired-surface-uv-face-classification-demo', version: 0, nativeParent: '1d4caf5abd117916741444b561ee567fb5f3406f', cases, runtimeNames, typeNames, additionalWork, independentExactArithmetic: arithmetic, fullParentsRetained: true, unchangedBSourceHash: hash(assets[1].source), queryCount: 16, quarticPathsPerCase: 7, naturalVShortcutsPerCase: 5, outsideShortcutsPerCase: 4, bAffineInversionsPerCase: 4, rootNativeSamplerCalls: 0, rootFloatConversion: false, reverseMembershipInvariantWithOrientationMetadataSeparate: true, ownedNonNoopCount: ownControls.length, getterCalls, refusalCount: failures.length, sourceInputs: inputs.length, outputFilesBeforeSummary: files.size, untestedLimits: ['aggregate-eight-MiB-request-overflow', 'aggregate-sixteen-MiB-result-overflow', 'rational-work-boundary', 'own-values-boundary'], worldMembership: false, materialMembership: false, solid: false, noNewCodec: true, noKernelCampaign: true, workScope: 'demo-extra-parents-editor-cold-owned-public-work-separated-from-classifier-direct-and-inherited-work' };
saveJSON('summary', summary); console.log(nativeJSON(summary));
