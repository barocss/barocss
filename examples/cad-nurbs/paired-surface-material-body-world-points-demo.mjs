import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2); assert.equal(args.length, 2, 'Usage: node paired-surface-material-body-world-points-demo.mjs --source <output-directory>'); assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]); mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const bundle = await require('esbuild').build({ entryPoints: [resolve(repo, 'packages/barocss-cad/src/index.ts')], absWorkingDir: repo, bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true }); assert.equal(bundle.outputFiles.length, 1);
const inputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path));
for (const leaf of ['paired/paired-surface-material-body-world-points.ts', 'paired/paired-surface-material-body-world-points-internal.ts', 'paired/paired-surface-material-body.ts', 'paired/paired-surface-uv-split-faces.ts', 'paired/paired-surface-b-uv-split-faces.ts', 'nurbs/source-wide/source-surface-control-net-wide.ts']) assert.ok(inputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
assert.ok(!inputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const { classifyPairedSurfaceMaterialBodyWorldPoints: classify, validatePairedSurfaceMaterialBodyWorldPointClassification: validate, PairedSurfaceMaterialBodyWorldPointError: FamilyError, PairedSurfaceMaterialBodyWorldPointDiagnosticCode: codes, buildPairedSurfaceMaterialBody: materialBuild, buildExactPairedVLinearSurfaceIntersection: sectionBuild, buildPairedSurfaceUVSplitFaces: aBuild, buildPairedSurfaceBUVSplitFaces: bBuild, compileCadModel, editSourceSurfaceControlNetWide, validateSourceSurfaceControlNetWideEdit } = api;
const runtimeNames = ['classifyPairedSurfaceMaterialBodyWorldPoints', 'validatePairedSurfaceMaterialBodyWorldPointClassification', 'PairedSurfaceMaterialBodyWorldPointError', 'PairedSurfaceMaterialBodyWorldPointDiagnosticCode'];
const typeNames = ['PairedSurfaceMaterialBodyWorldPointQuery', 'PairedSurfaceMaterialBodyWorldPointOptions', 'PairedSurfaceMaterialBodyWorldPointReport', 'PairedSurfaceMaterialBodyWorldPointResult'];
for (const name of runtimeNames) assert.equal(typeof api[name], name.endsWith('Code') ? 'object' : 'function'); assert.deepEqual(Object.keys(codes).sort(), ['INPUT', 'IDENTITY', 'PARENT', 'BINDING', 'DOMAIN', 'BUDGET', 'FILE', 'OWNED'].sort());
function nativeJSON(value) { if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); } if (value === null || typeof value !== 'object') return JSON.stringify(value); if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']'; return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}'; }
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : nativeJSON(value)).digest('hex'); const size = text => ({ utf16: text.length, utf8: Buffer.byteLength(text) });
const files = new Map(), retained = [], failures = [], ownControls = [], cases = [], coldContexts = new Map();
const additionalWork = { sectionBuilds: 0, aBuilds: 0, bBuilds: 0, materialBuilds: 0, classifierCalls: 0, ownedCalls: 0, coldCompiles: 0, editorCalls: 0, editorOwnedCalls: 0, publicClassifications: 0, publicOwnedCalls: 0, nativeOracleCalls: 0, rootFinderCalls: 0 };
function saveText(name, text) { const path = resolve(output, name); writeFileSync(path, text); assert.equal(readFileSync(path, 'utf8'), text); files.set(path, readFileSync(path)); return path; }
function saveJSON(name, value, maximum = 16777216) { const text = nativeJSON(value) + '\n'; assert.ok(text.length <= maximum && Buffer.byteLength(text) <= maximum, name); const path = saveText(name + '.json', text); assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), value); return path; }
function compile(source) { additionalWork.coldCompiles++; const result = compileCadModel(source, { sourceVersion: 0 }); assert.equal(result.ok, true, JSON.stringify(result.diagnostics)); return result.model; }
function retention() { for (const [path, bytes] of files) assert.deepEqual(readFileSync(path), bytes); for (const [value, text] of retained) assert.equal(nativeJSON(value), text); }
function ownValues(value) { return !value || typeof value !== 'object' ? 1 : 1 + Object.values(value).reduce((n, child) => n + ownValues(child), 0); }
function noAliases(input, result) { const objects = new WeakSet(); const collect = value => { if (value && typeof value === 'object') { objects.add(value); Object.values(value).forEach(collect); } }; collect(input); const check = value => { if (value && typeof value === 'object') { assert.ok(!objects.has(value)); Object.values(value).forEach(check); } }; check(result); }
function reject(name, action, expected) { let error; try { action(); } catch (cause) { error = cause; } assert.ok(error instanceof FamilyError, name + ': actual family error'); if (expected) assert.ok([].concat(expected).includes(error.code), name + ': ' + error.code); assert.ok(error.context?.directCounts); const record = { name, code: error.code, message: error.message, context: error.context, causeName: error.cause?.name ?? null, causeMessage: error.cause?.message ?? null }; failures.push(record); retention(); return record; }
const knots = (a, b, p) => [...Array(p + 1).fill(a), ...Array(p + 1).fill(b)];
function sourceFor(s, index) { const curve = '@curve #curve_sibling {type:nurbs;degree:1;knots:[0.000,0,1,1.00];control-points:[[-0,2,1],[3,4,2]];weights:[1,2];}'; const sibling = '@surface #native_wide_sibling {type:nurbs;degree-u:1;degree-v:1;knots-u:[0,0,1,1];knots-v:[-1,-1,2,2];control-points:[[[12000,2,-0],[12000,4,1]],[[12002,2,2],[12002,4,3]]];weights:[[1,2],[3,4]];}'; const selected = '@surface #' + s.id + ' {type:nurbs;degree-u:' + s.degreeU + ';degree-v:' + s.degreeV + ';knots-u:' + nativeJSON(s.knotsU) + ';knots-v:' + nativeJSON(s.knotsV) + ';control-points:' + nativeJSON(s.controlPoints) + ';weights:' + nativeJSON(s.weights) + ';}'; return '/* 설계: exact occupied World-point membership. */\r\n@model intersection_model {version:0;length-unit:mm;\r\n' + (index === 1 ? [curve, selected, sibling] : [sibling, curve, selected]).join('\r\n') + '\r\n}\r\n'; }
const A = { kind: 'surface', id: 'support', degreeU: 2, degreeV: 1, knotsU: knots(-1, 1, 2), knotsV: knots(-.5, 1.5, 1), controlPoints: [-1, 0, 1].map((x, i) => [-.5, 1.5].map(y => [x, y, [1, -1, 1][i]])), weights: Array.from({ length: 3 }, () => [1, 1]) };
const B = { kind: 'surface', id: 'support', degreeU: 2, degreeV: 1, knotsU: knots(2, 4, 2), knotsV: knots(-.25, 1.25, 1), controlPoints: [-1, 0, 1].map((x, i) => [-.25, 1.25].map(z => [x, [1, -1, 1][i], z])), weights: Array.from({ length: 3 }, () => [1, 1]) };
const assets = [A, B].map((surface, i) => { const source = sourceFor(surface, [1, 2][i]); assert.deepEqual(compile(source).objects[[1, 2][i]], surface); return { sourceId: ['source_a', 'source_b'][i], source, surface: structuredClone(surface) }; });
const sectionRequest = { assets, uAInterval: [-1, .5], options: { evaluationId: 'world_section', worldCurveId: 'world_cut', pcurveAId: 'world_cut_a', pcurveBId: 'world_cut_b', maximumObservations: 5 } };
const faceOptions = (evaluationId, prefix, orientation) => ({ evaluationId, resultIdPrefix: prefix, orientation, maximumIsoCurves: 2, maximumIntervals: 2, maximumObservations: 35 });
const materialOptions = { evaluationId: 'world_material', resultIdPrefix: 'wp', maximumClosures: 4, maximumFaces: 6, maximumEdgePairs: 12, maximumObservations: 24 };
function bodyFrom(request) { additionalWork.sectionBuilds++; const section = sectionBuild(request); additionalWork.aBuilds++; const a = aBuild({ section, options: faceOptions('world_a', 'wa', 'forward') }); additionalWork.bBuilds++; const b = bBuild(section, faceOptions('world_b', 'wb', 'reverse')); additionalWork.materialBuilds++; const body = materialBuild(a, b, materialOptions); assert.equal(body.body.solid, true); assert.equal(body.proof.material.restrictedSolidCertified, true); return body; }
const queries = [[0, -.25, -.125], [0, -.25, 1 / 64], [0, -.25, 0], [0, -.25, 7 / 128], [0, 0, -.125], [0, -.5, -.125], [0, -.25, -.25], [-1, 0, 0], [.5, 0, 0], [0, -0, -0], [-1, -.5, 1], [.5, .25, -.25], [0, -.5, -.25], [-1.25, -.25, 0], [0, .25, -.125], [0, -.25, -.5]].map((pointMM, i) => ({ queryId: 'p' + (i + 1), pointMM }));
const options = { evaluationId: 'world_membership', maximumQueries: 16 };

// Independent exact represented-value polynomial oracle; no native sampler or root solver.
const arithmetic = { operations: 0, maximumBits: 0, comparisons: 0 };
function work() { assert.ok(++arithmetic.operations <= 2000000); }
function sized(n) { work(); const bits = (n < 0n ? -n : n).toString(2).length; assert.ok(bits <= 8192); arithmetic.maximumBits = Math.max(arithmetic.maximumBits, bits); return n; }
function q(n, d = 1n) { sized(n); sized(d); assert.notEqual(d, 0n); if (d < 0n) { n = -n; d = -d; } let a = n < 0n ? -n : n, b = d; while (b) { work(); const r = sized(a % b); a = b; b = r; } const g = a || 1n; return { n: n / g, d: d / g }; }
const storage = new DataView(new ArrayBuffer(8));
function represented(x) { assert.ok(Number.isFinite(x)); storage.setFloat64(0, x); const bits = storage.getBigUint64(0), e = Number((bits >> 52n) & 2047n), f = bits & 0xfffffffffffffn, m = e ? f + (1n << 52n) : f, n = bits >> 63n ? -m : m, p = e ? e - 1075 : -1074; return p >= 0 ? q(sized(n << BigInt(p))) : q(n, sized(1n << BigInt(-p))); }
const ZERO = q(0n), ONE = q(1n); const add = (a, b) => q(sized(sized(a.n * b.d) + sized(b.n * a.d)), sized(a.d * b.d)); const neg = a => q(-a.n, a.d); const sub = (a, b) => add(a, neg(b)); const mul = (a, b) => q(sized(a.n * b.n), sized(a.d * b.d));
const dto = f => { assert.ok(f.numerator.length <= 5000 && f.denominator.length <= 5000); return q(BigInt(f.numerator), BigInt(f.denominator)); };
const compare = (a, b) => { arithmetic.comparisons++; const n = sized(sized(a.n * b.d) - sized(b.n * a.d)); return n < 0n ? -1 : n > 0n ? 1 : 0; }; const eq = (a, b) => assert.equal(compare(a, b), 0);
function polynomial(coefficients, x) { let out = ZERO; for (let i = coefficients.length - 1; i >= 0; i--) out = add(mul(out, x), coefficients[i]); return out; }
const roles = ['roof', 'side', 'yMin', 'zMin', 'xMin', 'xMax'];
function boundaryRef(body, role) { const face = body.faces.find(f => f.role === role); assert.ok(face); return { parentField: 'request.body', role, faceId: face.id, supportRef: face.supportRef }; }
function queryOracle(result, index, edited) {
  const query = result.request.queries[index], proof = result.proof.queries[index], actual = result.classifications[index], body = result.request.body;
  const [x, y, z] = query.pointMM.map(represented); assert.equal(proof.queryId, query.queryId); proof.pointExact.forEach((f, i) => eq(dto(f), [x, y, z][i]));
  const constraints = [];
  const checkTuple = (tuple, values) => { assert.equal(tuple.length, 2); return tuple.map((c, i) => { const [role, value] = values[i], sign = compare(value, ZERO); assert.equal(c.role, role); eq(dto(c.difference), value); assert.equal(c.sign, sign); constraints.push({ role, sign }); return sign; }); };
  const xs = checkTuple(proof.x, [['xMin', sub(x, q(-1n))], ['xMax', sub(q(1n, 2n), x)]]);
  let decision, yEvaluated = false, zEvaluated = false;
  if (xs.some(sign => sign < 0)) { decision = 'outside-x'; for (const field of ['originalUB', 'yRoof', 'y', 'zRoof', 'z']) assert.equal(proof[field], null); }
  else {
    yEvaluated = true; const ub = add(x, q(3n)), yRoof = mul(x, x); eq(dto(proof.originalUB), ub); eq(dto(proof.yRoof), yRoof);
    eq(polynomial(result.proof.source.bYOriginalUBPower.map(dto), ub), yRoof);
    const ys = checkTuple(proof.y, [['yMin', sub(y, q(-1n, 2n))], ['side', sub(yRoof, y)]]);
    if (ys.some(sign => sign < 0)) { decision = 'outside-y'; assert.equal(proof.zRoof, null); assert.equal(proof.z, null); }
    else {
      zEvaluated = true; const zRoof = edited ? add(yRoof, mul(q(1n, 32n), mul(sub(ONE, yRoof), sub(q(3n, 2n), y)))) : yRoof;
      eq(dto(proof.zRoof), zRoof); eq(polynomial(result.proof.source.aZOriginalUAVAPower.map(row => polynomial(row.map(dto), y)), x), zRoof);
      const zs = checkTuple(proof.z, [['zMin', sub(z, q(-1n, 4n))], ['roof', sub(zRoof, z)]]);
      decision = zs.some(sign => sign < 0) ? 'outside-z' : constraints.some(c => c.sign === 0) ? 'boundary' : 'inside';
    }
  }
  const status = decision.startsWith('outside') ? 'outside' : decision;
  const boundaryFaces = status === 'boundary' ? roles.filter(role => constraints.some(c => c.role === role && c.sign === 0)).map(role => boundaryRef(body, role)) : [];
  const expected = { queryId: query.queryId, status, bodyId: body.body.id, materialCertificateId: body.body.materialCertificateId, boundaryFaces };
  assert.equal(proof.decision, decision); assert.deepEqual(actual, expected); assert.deepEqual(proof.classification, actual); return { status, decision, boundaryFaces, yEvaluated, zEvaluated, comparisons: 2 + (yEvaluated ? 2 : 0) + (zEvaluated ? 2 : 0) };
}

function resultOracle(result, request, edited) {
  assert.deepEqual(Object.keys(result).sort(), ['request', 'classifications', 'proof', 'report'].sort()); assert.deepEqual(result.request, request); noAliases(request, result);
  const body = request.body, source = result.proof.source, material = body.proof.material;
  assert.equal(source.bodyId, body.body.id); assert.equal(source.shellId, body.shell.id); assert.equal(source.materialCertificateId, body.body.materialCertificateId); assert.deepEqual(source.originalUAInterval, [-1, .5]); eq(dto(source.originalUBOffset), q(3n)); eq(dto(source.originalUBScale), ONE); eq(dto(source.lowY), q(-1n, 2n)); eq(dto(source.lowZ), q(-1n, 4n));
  assert.deepEqual(source.bYOriginalUBPower, material.profile.bYPower); assert.deepEqual(source.aZOriginalUAVAPower, material.profile.aZPower); assert.equal(source.unitAxisSourceAuthority, true); assert.equal(source.wholeMaterialParentUnchanged, true);
  assert.deepEqual(source.faceRefs, roles.map(role => boundaryRef(body, role)));
  source.sourceRefs.forEach(ref => { assert.equal(ref.parentField, 'request.body'); assert.ok(material.sourceRefs.some(old => nativeJSON(old) === nativeJSON(ref.reference))); });
  assert.equal(result.classifications.length, 16); assert.equal(result.proof.queries.length, 16);
  const oracle = result.classifications.map((_, i) => queryOracle(result, i, edited)), report = result.report, counts = report.directCounts;
  assert.equal(counts.bodyValidationCount, 1); assert.equal(counts.queryCount, 16); assert.equal(counts.yRoofEvaluationCount, oracle.filter(o => o.yEvaluated).length); assert.equal(counts.zRoofEvaluationCount, oracle.filter(o => o.zEvaluated).length); assert.equal(counts.yRoofEvaluationCount, 15); assert.equal(counts.zRoofEvaluationCount, 14);
  const queryComparisons = oracle.reduce((n, o) => n + o.comparisons, 0); assert.equal(queryComparisons, 90); assert.ok(Number.isInteger(counts.signComparisonCount) && counts.signComparisonCount >= queryComparisons);
  for (const field of ['curveD0Count', 'curveD1Count', 'surfaceD0Count', 'surfaceD1Count', 'sourceCompilationCount', 'rootSolveCount', 'rationalFloatConversionCount']) assert.equal(counts[field], 0);
  assert.deepEqual(report.inheritedCounts, { body: body.report.directCounts }); assert.equal(body.report.directCounts.constructorDelegationCount, 18); assert.equal(body.report.directCounts.curveD0AttemptCount, 72);
  const classificationCounts = { inside: 0, outside: 0, boundary: 0 }, decisionCounts = { 'outside-x': 0, 'outside-y': 0, 'outside-z': 0, inside: 0, boundary: 0 }, boundaryRoleCounts = Object.fromEntries(roles.map(role => [role, 0]));
  oracle.forEach(o => { classificationCounts[o.status]++; decisionCounts[o.decision]++; o.boundaryFaces.forEach(f => boundaryRoleCounts[f.role]++); }); assert.deepEqual(report.classificationCounts, classificationCounts); assert.deepEqual(report.decisionCounts, decisionCounts); assert.deepEqual(report.boundaryRoleCounts, boundaryRoleCounts);
  assert.deepEqual(classificationCounts, edited ? { inside: 3, outside: 3, boundary: 10 } : { inside: 1, outside: 5, boundary: 10 });
  assert.equal(report.queryCount, 16); assert.equal(report.bodyId, body.body.id); assert.equal(report.shellId, body.shell.id); assert.equal(report.materialCertificateId, body.body.materialCertificateId); assert.equal(report.parentEvaluationId, body.report.evaluationId); assert.equal(report.lengthUnit, 'mm');
  for (const field of ['toleranceUsed', 'nativeD0EqualityAuthority', 'rootFindingUsed', 'pointProjectionPerformed', 'normalizedCubeInputUsed', 'sourceIdentityRenaming', 'snapPerformed', 'rootFloatConversion']) assert.equal(report.numericPolicy[field], false, field);
  for (const field of ['exactWorldRegionMembershipCertified', 'sourceDefinedOccupiedRegionAuthority', 'actualParentBodyRetained', 'parentTopologyAndMaterialUnchanged', 'originalBitsPreserved']) assert.equal(report.quality[field], true);
  for (const field of ['newGeometryProduced', 'newBodyProduced', 'genericBoolean', 'arbitraryBodyMembershipCertified', 'rendererPickingCertified', 'globalBinary64EvaluationErrorCertified', 'manufacturingToleranceCertified', 'publication']) assert.equal(report.quality[field], false);
  assert.deepEqual(report.fileSizes.request, size(nativeJSON(request) + '\n')); assert.deepEqual(report.fileSizes.result, size(nativeJSON(result) + '\n')); assert.equal(report.ownValues, ownValues(result)); assert.equal(report.rationalCounts.floatConversions, 0); assert.ok(report.rationalCounts.operations <= 200000); assert.ok(report.rationalCounts.gcdSteps <= 200000);
  assert.ok(Object.is(result.request.queries[9].pointMM[1], -0) && Object.is(result.request.queries[9].pointMM[2], -0));
  assert.deepEqual(result.classifications[10].boundaryFaces.map(f => f.role), ['roof', 'yMin', 'xMin']); assert.deepEqual(result.classifications[11].boundaryFaces.map(f => f.role), ['side', 'zMin', 'xMax']); assert.deepEqual(result.classifications[12].boundaryFaces.map(f => f.role), ['yMin', 'zMin']);
}
function coldBodySources(body) {
  const references = [], check = (source, model, field) => { const key = hash(source) + ':' + hash(model); if (!coldContexts.has(key)) { const name = 'cold-' + coldContexts.size, path = saveText(name + '.source0.css', source); assert.deepEqual(compile(readFileSync(path, 'utf8')), model); saveJSON(name + '-model', model); coldContexts.set(key, { path, sourceHash: hash(source), modelHash: hash(model) }); } references.push({ field, ...coldContexts.get(key) }); };
  for (const side of ['a', 'b']) body.request[side].request.section.request.assets.forEach((asset, i) => check(asset.source, body.request[side].request.section.originalModels[i], 'request.body.request.' + side + '.request.section.request.assets[' + i + '].source'));
  function walk(value, field) { if (!value || typeof value !== 'object') return; if (typeof value.source === 'string' && value.model?.objects) check(value.source, value.model, field + '.source'); Object.entries(value).forEach(([key, child]) => walk(child, field + (Array.isArray(value) ? '[' + key + ']' : '.' + key))); } walk(body, 'request.body'); return references;
}
function construct(name, body, edited) {
  const request = { body, queries: structuredClone(queries), options: structuredClone(options) }, before = nativeJSON(request); additionalWork.classifierCalls++; const result = classify(body, request.queries, request.options); assert.equal(nativeJSON(request), before); resultOracle(result, request, edited);
  additionalWork.ownedCalls++; const report = validate(result); assert.deepEqual(report, result.report); assert.notEqual(report, result.report);
  saveJSON(name + '-body', body); const file = saveJSON(name + '-request', request, 8388608); saveJSON(name + '-result', result); saveJSON(name + '-report', result.report); saveJSON(name + '-cold-source-contexts', coldBodySources(body));
  saveJSON(name + '-original-uv-graphs', { bothUV: body.request.a.request.section.pcurves, a: body.request.a.edges.map(e => ({ edgeId: e.id, pcurve: e.pcurve })), b: body.request.b.edges.map(e => ({ edgeId: e.id, pcurve: e.pcurve })), materialFaceImages: body.proof.material.faceImages.map(f => ({ faceId: f.faceId, sourceRef: f.supportRef, nativeUVPower: f.nativeUVPower })) });
  const reopened = JSON.parse(readFileSync(file, 'utf8')); assert.deepEqual(reopened, request); const freshBody = bodyFrom(reopened.body.request.a.request.section.request); assert.deepEqual(freshBody, reopened.body); additionalWork.classifierCalls++; const rebuilt = classify(freshBody, reopened.queries, reopened.options); assert.deepEqual(rebuilt, result); saveJSON(name + '-cold-rebuild', rebuilt);
  retained.push([request, before], [result, nativeJSON(result)]); cases.push({ name, resultHash: hash(result), bodyHash: hash(body), inheritedVolumeMM3: body.report.exactVolumeMM3, fileSizes: result.report.fileSizes, directCounts: result.report.directCounts, inheritedCounts: result.report.inheritedCounts, rationalCounts: result.report.rationalCounts, classificationCounts: result.report.classificationCounts, decisionCounts: result.report.decisionCounts, boundaryRoleCounts: result.report.boundaryRoleCounts, queryComparisons: 90, measuredAdditionalSupportComparisons: result.report.directCounts.signComparisonCount - 90 }); return result;
}
const mainBody = bodyFrom(sectionRequest), main = construct('main', mainBody, false);
const editRequest = { source: assets[0].source, sourceVersion: 0, surfaceId: 'support', edits: { poleEdits: [{ uIndex: 1, vIndex: 0, zMM: -.875 }] } };
additionalWork.editorCalls++; const edit = editSourceSurfaceControlNetWide(editRequest); additionalWork.editorOwnedCalls++; assert.deepEqual(validateSourceSurfaceControlNetWideEdit(edit), edit.report); assert.equal(edit.report.changedFieldCount, 1); assert.equal(edit.patches.length, 1); assert.deepEqual(edit.model.objects[0], edit.originalModel.objects[0]); assert.deepEqual(edit.model.objects[2], edit.originalModel.objects[2]); saveJSON('actual-one-pole-edit-request', editRequest); saveJSON('actual-one-pole-edit', edit);
const editedRequest = structuredClone(sectionRequest); editedRequest.assets[0].source = edit.source; editedRequest.assets[0].surface = structuredClone(edit.surface); const editedBody = bodyFrom(editedRequest); assert.deepEqual(editedBody.request.b.request.section.request.assets[1], mainBody.request.b.request.section.request.assets[1]); assert.deepEqual(editedBody.request.b.request.section.originalModels[1], mainBody.request.b.request.section.originalModels[1]); const edited = construct('edited', editedBody, true);
assert.equal(main.classifications[1].status, 'outside'); assert.equal(edited.classifications[1].status, 'inside'); eq(dto(main.proof.queries[1].zRoof), ZERO); eq(dto(edited.proof.queries[1].zRoof), q(7n, 128n)); eq(dto(main.proof.queries[1].z[1].difference), q(-1n, 64n)); eq(dto(edited.proof.queries[1].z[1].difference), q(5n, 128n));
assert.deepEqual(main.classifications[9].boundaryFaces.map(f => f.role), ['roof', 'side']); assert.deepEqual(edited.classifications[9].boundaryFaces.map(f => f.role), ['side']); retained.push([edit, nativeJSON(edit)]);

function requestControl(name, change, expected) { const r = structuredClone(main.request); change(r); return reject(name, () => classify(r.body, r.queries, r.options), expected); }
requestControl('seventeen-query-cap', r => { r.queries.push({ queryId: 'p17', pointMM: [0, 0, 0] }); }, 'BUDGET'); requestControl('duplicate-query-id', r => { r.queries[1].queryId = r.queries[0].queryId; }, 'IDENTITY'); requestControl('malformed-point-length', r => { r.queries[0].pointMM.pop(); }, 'INPUT'); requestControl('query-nonfinite', r => { r.queries[0].pointMM[0] = Infinity; }, 'INPUT'); requestControl('query-coordinate-cap', r => { r.queries[0].pointMM[0] = 10001; }, ['INPUT', 'DOMAIN']); requestControl('unknown-query-frame', r => { r.queries[0].frame = 'cube'; }, 'INPUT'); requestControl('wrong-query-budget', r => { r.options.maximumQueries = 15; }, ['BUDGET', 'INPUT']);
requestControl('stale-body-source', r => { r.body.request.a.request.section.request.assets[0].source += '\n/* changed retained Source size */'; }, 'PARENT'); requestControl('stale-body-face-reference', r => { r.body.faces[0].supportRef.objectIndex = 0 === r.body.faces[0].supportRef.objectIndex ? 1 : 0; }, 'PARENT'); requestControl('stale-material-certificate', r => { r.body.proof.material.certificateId = 'stale'; }, 'PARENT'); requestControl('actual-source-string-cap', r => { r.body.request.a.request.section.request.assets[0].source += ' '.repeat(262145); }, ['BUDGET', 'INPUT']);
const sparseQueries = structuredClone(queries); delete sparseQueries[1]; reject('sparse-input-queries', () => classify(mainBody, sparseQueries, options), 'INPUT');
const mutations = [
  ['original-point', r => { r.request.queries[0].pointMM[0] = .125; }],
  ['original-zero-bit', r => { r.request.queries[9].pointMM[1] = 0; }],
  ['parent-source-size', r => { r.request.body.request.a.request.section.request.assets[0].source += '\n/* changed retained Source size */'; }],
  ['classification', r => { r.classifications[0].status = 'outside'; }],
  ['boundary-role', r => { r.classifications[10].boundaryFaces[0].role = 'side'; }],
  ['boundary-face-id', r => { r.classifications[10].boundaryFaces[0].faceId = r.request.body.faces[1].id; }],
  ['boundary-source-anchor', r => { r.classifications[10].boundaryFaces[0].parentField = 'request.otherBody'; }],
  ['source-polynomial', r => { r.proof.source.bYOriginalUBPower[0].numerator = '10'; }],
  ['evaluated-roof', r => { r.proof.queries[0].zRoof.numerator = '1'; }],
  ['constraint-sign', r => { r.proof.queries[0].x[0].sign = -1; }],
  ['constraint-fraction', r => { r.proof.queries[0].z[0].difference.numerator = '2'; }],
  ['outside-null-stage', r => { r.proof.queries[13].originalUB = { numerator: '0', denominator: '1' }; }],
  ['decision', r => { r.proof.queries[0].decision = 'outside-x'; }],
  ['stage-count', r => { r.report.directCounts.zRoofEvaluationCount++; }],
  ['file-size', r => { r.report.fileSizes.result.utf8++; }],
  ['generic-body-claim', r => { r.report.quality.arbitraryBodyMembershipCertified = true; }],
];
for (const [name, change] of mutations) { const value = structuredClone(main), before = nativeJSON(value); change(value); assert.notEqual(nativeJSON(value), before); reject('owned-' + name, () => validate(value), 'OWNED'); ownControls.push(name); }
const cyclic = structuredClone(main); cyclic.self = cyclic; reject('owned-cycle', () => validate(cyclic), 'OWNED'); const sparse = structuredClone(main); delete sparse.proof.queries[1]; reject('owned-sparse', () => validate(sparse), 'OWNED');
let getterCalls = 0; const getterQueries = structuredClone(queries); Object.defineProperty(getterQueries[0], 'pointMM', { enumerable: true, get() { getterCalls++; return [0, 0, 0]; } }); reject('query-getter', () => classify(mainBody, getterQueries, options), 'INPUT'); assert.equal(getterCalls, 0); const getterOwned = structuredClone(main); Object.defineProperty(getterOwned.report, 'evaluationId', { enumerable: true, get() { getterCalls++; return 'bad'; } }); reject('owned-getter', () => validate(getterOwned), 'OWNED'); assert.equal(getterCalls, 0);
saveJSON('refusals', failures); saveJSON('owned-controls', { nonNoopMutations: ownControls, getterCalls, cycle: true, sparse: true }); saveJSON('source-api.metafile', bundle.metafile); saveText('source-api.mjs', bundle.outputFiles[0].text);
const publicAPI = await import(pathToFileURL(resolve(repo, 'packages/barocss-cad/dist/index.js')).href), declarations = readFileSync(resolve(repo, 'packages/barocss-cad/dist/index.d.ts'), 'utf8'); for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function'); for (const name of [...runtimeNames, ...typeNames]) assert.match(declarations, new RegExp('\\b' + name + '\\b')); assert.deepEqual(publicAPI.PairedSurfaceMaterialBodyWorldPointDiagnosticCode, codes);
additionalWork.publicClassifications++; const publicMain = publicAPI.classifyPairedSurfaceMaterialBodyWorldPoints(mainBody, queries, options); assert.deepEqual(publicMain, main); additionalWork.publicOwnedCalls++; assert.deepEqual(publicAPI.validatePairedSurfaceMaterialBodyWorldPointClassification(publicMain), main.report); saveJSON('current-public-main', publicMain); retention();
const summary = { schema: 'paired-surface-material-body-world-points-demo', version: 0, nativeParent: '75068c86419a46f2ef1f46d420310473fd803f49', cases, runtimeNames, typeNames, additionalWork, independentExactArithmetic: arithmetic, unchangedBSourceHash: hash(assets[1].source), pointCount: 16, yEvaluationsPerCase: 15, zEvaluationsPerCase: 14, querySignComparisonsPerCase: 90, sourceSupportComparisonsAdditional: true, allSixActualFaceReferences: true, multiboundaryCornerAndEdgeChecks: true, fullParentBodyRetained: true, rootNativeOracleCalls: 0, rootFinderCalls: 0, originalPointBitsPreserved: true, ownedNonNoopCount: ownControls.length, getterCalls, refusalCount: failures.length, sourceInputs: inputs.length, outputFilesBeforeSummary: files.size, untestedLimits: ['aggregate-eight-MiB-request-overflow', 'aggregate-sixteen-MiB-result-overflow', 'rational-work-boundary', 'own-values-boundary'], noInverseOrProjection: true, noNewCodec: true, noOldKernelCampaign: true, arbitraryBodyMembership: false, rendererPicking: false, genericBoolean: false, workScope: 'additional-demo-source-parent-editor-cold-owned-public-work-separated-from-direct-predicates-and-inherited-body-work' }; saveJSON('summary', summary); console.log(nativeJSON(summary));
