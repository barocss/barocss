import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node paired-surface-intersection-branch-demo.mjs --source <output-directory>'); assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]); mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json')), esbuild = require('esbuild');
const entry = resolve(repo, 'packages/barocss-cad/src/index.ts'), parserModule = resolve(repo, 'packages/barocss-cad/src/cad-document.ts'), decimalModule = resolve(repo, 'packages/barocss-cad/src/nurbs/curves/curve-source.ts');
const bridge = 'export * from ' + JSON.stringify(entry) + ';\nexport {parseCadDocumentOwnJson as demoParseOwnRequest} from ' + JSON.stringify(parserModule) + ';\nexport {curveDecimal as demoDecimal} from ' + JSON.stringify(decimalModule) + ';\n';
const bundle = await esbuild.build({ absWorkingDir: repo, stdin: { contents: bridge, resolveDir: repo, sourcefile: 'paired-surface-demo-source-bridge.mjs', loader: 'js' }, bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
assert.equal(bundle.outputFiles.length, 1);
const inputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path));
for (const leaf of ['paired/paired-surface-intersection-branch.ts', 'core/math.ts', 'core/derivatives.ts', 'model-compiler.ts', 'nurbs/source-wide/source-surface-control-net-wide.ts']) assert.ok(inputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
assert.ok(!inputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const { tracePairedSurfaceIntersectionBranch: trace, validatePairedSurfaceIntersectionBranch: validate, PairedSurfaceIntersectionBranchError: BranchError, PairedSurfaceIntersectionBranchDiagnosticCode: codes, compileCadModel, evaluateSurface, evaluateSurfaceD1, editSourceSurfaceControlNetWide, validateSourceSurfaceControlNetWideEdit, demoParseOwnRequest: parseRequest, demoDecimal } = api;
const runtimeNames = ['tracePairedSurfaceIntersectionBranch', 'validatePairedSurfaceIntersectionBranch', 'PairedSurfaceIntersectionBranchError', 'PairedSurfaceIntersectionBranchDiagnosticCode'];
const typeNames = ['PairedSurfaceIntersectionBranchRequest', 'PairedSurfaceIntersectionBranchOptions', 'PairedSurfaceIntersectionBranchReport', 'PairedSurfaceIntersectionBranchResult'];
for (const name of runtimeNames) assert.equal(typeof api[name], name.endsWith('Code') ? 'object' : 'function');
for (const name of ['INPUT', 'IDENTITY', 'SOURCE', 'REFERENCE', 'SUPPORT', 'DOMAIN', 'CONTINUITY', 'REGULARITY', 'TANGENCY', 'CHART', 'CONDITION', 'REPRESENTABILITY', 'NATIVE', 'STAGNATION', 'WORK', 'BUDGET', 'BINDING', 'FILE', 'OWNED']) assert.equal(codes[name], name);
assert.equal(typeof parseRequest, 'function'); assert.ok(inputs.includes(parserModule));
const files = new Map(), retained = [], cases = [], failures = [], ownControls = [];
const additionalWork = { traceCalls: 0, ownedCalls: 0, authoredParserCalls: 0, coldCompiles: 0, nativeD0OracleCalls: 0, nativeD1OracleCalls: 0, surfaceEditCalls: 0, surfaceEditOwnedCalls: 0, publicTraceCalls: 0, publicOwnedCalls: 0, rationalOperations: 0 };
function nativeJSON(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || ['string', 'boolean'].includes(typeof value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}';
}
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : nativeJSON(value)).digest('hex');
const size = text => ({ utf16: text.length, utf8: Buffer.byteLength(text) });
function saveText(name, text) { const path = resolve(output, name); writeFileSync(path, text); files.set(path, readFileSync(path)); assert.equal(readFileSync(path, 'utf8'), text); return path; }
function saveJSON(name, value, maximum = 4194304) { const text = nativeJSON(value) + '\n'; assert.ok(text.length <= maximum && Buffer.byteLength(text) <= maximum, name); const path = saveText(name + '.json', text); assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), value); return path; }
function compile(source) { additionalWork.coldCompiles++; const compiled = compileCadModel(source, { sourceVersion: 0 }); assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics)); return compiled; }
function cold(source, expected, name) { const path = saveText(name + '.source0.css', source); const compiled = compile(readFileSync(path, 'utf8')); if (expected) assert.deepEqual(compiled.model, expected); saveJSON(name + '-cold-model', compiled.model); return compiled; }
function retention() { for (const [path, bytes] of files) assert.deepEqual(readFileSync(path), bytes, path); for (const [value, snapshot] of retained) assert.equal(nativeJSON(value), snapshot); }
function ownership(input, result) {
  const caller = new WeakSet(), seen = new WeakSet();
  function collect(value) { if (value && typeof value === 'object' && !caller.has(value)) { caller.add(value); Object.values(value).forEach(collect); } }
  function visit(value) { if (value && typeof value === 'object') { assert.ok(!caller.has(value)); assert.ok(!seen.has(value)); seen.add(value); Object.values(value).forEach(visit); } }
  collect(input); visit(result);
}
const norm = vector => { vector.forEach(value => assert.ok(Number.isFinite(value))); const result = Math.hypot(...vector); assert.ok(Number.isFinite(result)); return result; };
const subtract = (a, b) => a.map((value, i) => value - b[i]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const near = (actual, expected, tolerance = 1e-6) => { assert.equal(actual.length, expected.length); assert.ok(norm(subtract(actual, expected)) <= tolerance, nativeJSON({ actual, expected, tolerance })); };
const domain = s => ({ u: [s.knotsU[s.degreeU], s.knotsU[s.controlPoints.length]], v: [s.knotsV[s.degreeV], s.knotsV[s.controlPoints[0].length]] });
const inside = (s, uv) => { const d = domain(s); return uv[0] >= d.u[0] && uv[0] <= d.u[1] && uv[1] >= d.v[0] && uv[1] <= d.v[1]; };
function reject(name, request, expected) {
  let failure; try { trace(request); } catch (error) { failure = error; }
  assert.ok(failure instanceof BranchError, name + ': actual family error'); if (expected) assert.ok((Array.isArray(expected) ? expected : [expected]).includes(failure.code), name + ': ' + failure.code);
  assert.ok(failure.context && failure.context.directCounts); failures.push({ name, code: failure.code, message: failure.message, context: failure.context, causeName: failure.cause?.name ?? null, causeMessage: failure.cause?.message ?? null }); retention(); return failure;
}
const literal = value => Array.isArray(value) ? '[' + value.map(literal).join(',') + ']' : demoDecimal(value, 'Paired branch demo source fixture');
function selectedSource(s, index) {
  const curveSibling = '@curve #curve_sibling { type:nurbs; degree:1; knots:[0.000,0,1,1.00]; control-points:[[-0,2,1],[3,4,2]]; weights:[1,2]; }';
  const surfaceSibling = '@surface #native_wide_sibling { type:nurbs; degree-u:1; degree-v:1; knots-u:[0,0,1,1]; knots-v:[-1,-1,2,2]; control-points:[[[12000,2,-0],[12000,4,1]],[[12002,2,2],[12002,4,3]]]; weights:[[1,2],[3,4]]; }';
  const selected = '@surface #' + s.id + ' { type:nurbs; degree-u:' + literal(s.degreeU) + '; degree-v:' + literal(s.degreeV) + '; knots-u:' + literal(s.knotsU) + '; knots-v:' + literal(s.knotsV) + '; control-points:' + literal(s.controlPoints) + '; weights:' + literal(s.weights) + '; }';
  const objects = index === 1 ? [curveSibling, selected, surfaceSibling] : [surfaceSibling, curveSibling, selected];
  return '/* 설계: independent original domains and source namespaces. */\r\n@model intersection_model { version:0; length-unit:mm;\r\n' + objects.join('\r\n') + '\r\n}\r\n';
}
function asset(name, s, index) {
  const source = selectedSource(s, index), compiled = cold(source, null, name); assert.deepEqual(compiled.model.objects[index], s);
  return { sourceId: name, source, surface: structuredClone(compiled.model.objects[index]) };
}
const knots = (a, b, p) => [...Array(p + 1).fill(a), ...Array(p + 1).fill(b)];
const A = { kind: 'surface', id: 'support', degreeU: 2, degreeV: 1, knotsU: knots(-1, 1, 2), knotsV: knots(-.5, 1.5, 1), controlPoints: [-1, 0, 1].map((x, i) => [-.5, 1.5].map(y => [x, y, [1, -1, 1][i]])), weights: Array.from({ length: 3 }, () => [1, 1]) };
const B = { kind: 'surface', id: 'support', degreeU: 2, degreeV: 1, knotsU: knots(2, 4, 2), knotsV: knots(-.25, 1.25, 1), controlPoints: [-1, 0, 1].map((x, i) => [-.25, 1.25].map(z => [x, [1, -1, 1][i], z])), weights: Array.from({ length: 3 }, () => [1, 1]) };
const mainAssets = [asset('source_a', A, 1), asset('source_b', B, 2)];
const options = { evaluationId: 'paired_main', maximumStations: 17, maximumCorrectionsPerStation: 12, maximumTrialsPerCorrection: 8, maximumSurfacePointEvaluations: 3298, maximumSurfaceDerivativeAttempts: 442 };
const mainRequest = { assets: mainAssets, seed: { uvA: [-.75, .625], uvB: [2.3125, .5] }, uAStations: [-.75, -.5, -.25, 0, .25, .5, .75], options };
function tensorQuadratic(s, uv) {
  assert.equal(s.degreeU, 2); assert.equal(s.degreeV, 2);
  const d = domain(s), tu = (uv[0] - d.u[0]) / (d.u[1] - d.u[0]), tv = (uv[1] - d.v[0]) / (d.v[1] - d.v[0]);
  const basis = t => [(1 - t) ** 2, 2 * t * (1 - t), t ** 2], derivative = t => [-2 * (1 - t), 2 - 4 * t, 2 * t];
  const bu = basis(tu), bv = basis(tv), du = derivative(tu).map(value => value / (d.u[1] - d.u[0])), dv = derivative(tv).map(value => value / (d.v[1] - d.v[0]));
  const H = [0, 0, 0, 0], Hu = [0, 0, 0, 0], Hv = [0, 0, 0, 0];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let axis = 0; axis < 4; axis++) {
    const h = s.weights[i][j] * (axis === 3 ? 1 : s.controlPoints[i][j][axis]); H[axis] += bu[i] * bv[j] * h; Hu[axis] += du[i] * bv[j] * h; Hv[axis] += bu[i] * dv[j] * h;
  }
  assert.ok(H[3] > 0 && Number.isFinite(H[3]));
  return { point: H.slice(0, 3).map(value => value / H[3]), du: Hu.slice(0, 3).map((value, axis) => (value * H[3] - H[axis] * Hu[3]) / H[3] ** 2), dv: Hv.slice(0, 3).map((value, axis) => (value * H[3] - H[axis] * Hv[3]) / H[3] ** 2) };
}
function normalOracle(a, b, evidence) {
  const rawA = cross(a.du, a.dv), rawB = cross(b.du, b.dv), normA = norm(rawA), normB = norm(rawB);
  assert.ok(normA > 0 && normB > 0); near(evidence.rawA, rawA); near(evidence.rawB, rawB);
  const unitA = rawA.map(value => value / normA), unitB = rawB.map(value => value / normB), unitCross = cross(unitA, unitB);
  near(evidence.unitA, unitA); near(evidence.unitB, unitB); near(evidence.unitCross, unitCross); assert.ok(Math.abs(evidence.transverseMeasure - norm(unitCross)) <= 1e-12); assert.ok(evidence.transverseMeasure >= 1e-6);
}
function chartOracle(chart, solve, d1A, d1B, request, role) {
  const da = domain(request.assets[0].surface), db = domain(request.assets[1].surface), widths = [da.v[1] - da.v[0], db.u[1] - db.u[0], db.v[1] - db.v[0]];
  const J = Array.from({ length: 3 }, (_, i) => [d1A.dv[i], -d1B.du[i], -d1B.dv[i]]);
  assert.deepEqual(chart.jacobian, J); assert.deepEqual(chart.domainWidths, widths); assert.deepEqual(chart.unknownOrder, ['vA', 'uB', 'vB']);
  for (let j = 0; j < 3; j++) { const n = norm(J.map(row => row[j] * widths[j])); assert.equal(chart.scaledColumnNorms[j], n); assert.ok(n >= 1e-12 && n <= 1e12); for (let i = 0; i < 3; i++) assert.ok(Object.is(chart.normalizedMatrix[i][j], J[i][j] * widths[j] / n)); assert.ok(Object.is(solve.recoveredOriginalUnknowns[j], widths[j] * (solve.normalizedSolution[j] / n))); }
  assert.equal(solve.role, role); assert.equal(chart.recoveryAssociation, 'domain-width-times-normalized-solution-divided-by-scaled-column-norm');
  assert.deepEqual(solve.permutedRHS, chart.rowOrder.map(index => solve.rhsMM[index])); assert.equal(new Set(chart.rowOrder).size, 3);
  for (let i = 0; i < 3; i++) { assert.ok(chart.pivots[i].absolutePivot >= 1e-10); assert.equal(chart.pivots[i].absolutePivot, Math.abs(chart.upperTriangularMatrix[i][i])); const product = Array.from({ length: 3 }, (_, j) => [0, 1, 2].reduce((sum, k) => sum + chart.lowerTriangularMatrix[i][k] * chart.upperTriangularMatrix[k][j], 0)); near(product, chart.normalizedMatrix[chart.rowOrder[i]], 1e-10); }
  assert.equal(chart.minimumAbsolutePivot, Math.min(...chart.pivots.map(pivot => pivot.absolutePivot)));
  near(chart.lowerTriangularMatrix.map(row => row.reduce((sum, value, j) => sum + value * solve.forwardSubstitutionRHS[j], 0)), solve.permutedRHS, 1e-10);
  near(chart.upperTriangularMatrix.map(row => row.reduce((sum, value, j) => sum + value * solve.normalizedSolution[j], 0)), solve.forwardSubstitutionRHS, 1e-10);
  near(J.map(row => row.reduce((sum, value, j) => sum + value * solve.recoveredOriginalUnknowns[j], 0)), solve.rhsMM, 1e-8);
}
function oracle(result, family) {
  assert.deepEqual(Object.keys(result).sort(), ['request', 'originalModels', 'observations', 'report'].sort());
  const { request, observations, report } = result, N = request.uAStations.length;
  assert.equal(observations.length, N); assert.equal(report.stationCount, N);
  request.assets.forEach((value, i) => { const compiled = compile(value.source); assert.deepEqual(result.originalModels[i], compiled.model); const index = compiled.model.objects.findIndex(object => object.id === value.surface.id); assert.deepEqual(compiled.model.objects[index], value.surface); assert.deepEqual(report.selections[i], { assetIndex: i, sourceId: value.sourceId, modelName: compiled.model.name, objectIndex: index, surfaceId: value.surface.id, sourceField: 'request.assets.source', modelField: 'originalModels', sourceVersion: 0, degrees: [value.surface.degreeU, value.surface.degreeV], controlPointGrid: [value.surface.controlPoints.length, value.surface.controlPoints[0].length], domains: domain(value.surface) }); });
  const counts = { sourceCompilationCount: 2, selectedSurfaceValidationCount: 2, surfaceDomainCount: 2, stationStartCount: N, stationCompletionCount: N, correctionSolveCount: 0, acceptedCorrectionCount: 0, trialSlotCount: 0, domainRejectedTrialCount: 0, inDomainTrialCount: 0, rejectedDecreaseTrialCount: 0, acceptedTrialCount: 0, surfacePointEvaluationCount: 0, surfaceDerivativeAttemptCount: 0, finalPointPairCount: N, chartFactorizationCount: 0, linearSolveCount: 0, tangentSolveCount: N, curvePointEvaluationCount: 0, curveDerivativeAttemptCount: 0, secondDerivativeAttemptCount: 0, rationalOperationCount: 0, fittingCallCount: 0, sourceWriterCallCount: 0 };
  for (const [index, observation] of observations.entries()) {
    assert.equal(observation.index, index); assert.ok(Object.is(observation.uA, request.uAStations[index])); assert.ok(Object.is(observation.uvA[0], observation.uA));
    const initial = index === 0 ? [request.seed.uvA[1], ...request.seed.uvB] : [observations[index - 1].uvA[1], ...observations[index - 1].uvB]; assert.deepEqual(observation.initialSeedZ, initial);
    const a = request.assets[0].surface, b = request.assets[1].surface; assert.ok(inside(a, observation.uvA) && inside(b, observation.uvB));
    additionalWork.nativeD0OracleCalls += 2; const pa = evaluateSurface(a, ...observation.uvA), pb = evaluateSurface(b, ...observation.uvB);
    additionalWork.nativeD1OracleCalls += 2; const d1A = evaluateSurfaceD1(a, ...observation.uvA), d1B = evaluateSurfaceD1(b, ...observation.uvB);
    assert.deepEqual(observation.pointA, pa); assert.deepEqual(observation.pointB, pb); assert.deepEqual(observation.d1A, d1A); assert.deepEqual(observation.d1B, d1B);
    assert.deepEqual(observation.residual.vectorMM, subtract(pa, pb)); assert.equal(observation.residual.normMM, norm(subtract(pa, pb))); assert.ok(observation.residual.normMM <= 1e-7);
    assert.deepEqual(observation.d0ToD1PointGapMM, [norm(subtract(pa, d1A.point)), norm(subtract(pb, d1B.point))]); observation.d0ToD1PointGapMM.forEach(gap => assert.ok(gap <= 1e-7));
    normalOracle(d1A, d1B, observation.normalEvidence); chartOracle(observation.chart, observation.tangentSolve, d1A, d1B, request, 'tangent'); near(observation.tangentSolve.rhsMM, d1A.du.map(value => -value), 0);
    assert.deepEqual(observation.originalParameterDerivative, observation.tangentSolve.recoveredOriginalUnknowns);
    const [vPrime, uPrimeB, vPrimeB] = observation.originalParameterDerivative;
    near(observation.tangentA, d1A.du.map((value, axis) => value + d1A.dv[axis] * vPrime)); near(observation.tangentB, d1B.du.map((value, axis) => value * uPrimeB + d1B.dv[axis] * vPrimeB)); assert.ok(observation.relativeTangentGap <= 1e-7);
    if (family !== 'rational') {
      const u = observation.uA, edited = family === 'edited', z = u * u + (edited ? (1 - u * u) * (1.5 - u * u) / 32 : 0), zPrime = 2 * u + (edited ? (-5 * u + 4 * u ** 3) / 32 : 0);
      near(observation.uvA, [u, u * u]); near(observation.uvB, [u + 3, z]); near(pa, [u, u * u, z]); near(pb, [u, u * u, z]); near(observation.tangentA, [1, 2 * u, zPrime]); near(observation.tangentB, [1, 2 * u, zPrime]);
    } else {
      for (const [s, uv, actual] of [[a, observation.uvA, d1A], [b, observation.uvB, d1B]]) { const homogeneous = tensorQuadratic(s, uv); near(actual.point, homogeneous.point); near(actual.du, homogeneous.du); near(actual.dv, homogeneous.dv); }
      if (observation.uA === 0) { near(observation.uvA, [0, 1]); near(observation.uvB, [12, -1]); near(pa, [0, 0, 0]); }
    }
    const local = { correctionSolveCount: 0, acceptedCorrectionCount: 0, trialSlotCount: 0, domainRejectedTrialCount: 0, inDomainTrialCount: 0, surfacePointEvaluationCount: 2, surfaceDerivativeAttemptCount: 2, chartFactorizationCount: 1, linearSolveCount: 1 };
    let currentZ = initial;
    for (const [ci, correction] of observation.corrections.entries()) {
      assert.equal(correction.index, ci); assert.deepEqual(correction.uvA, [observation.uA, currentZ[0]]); assert.deepEqual(correction.uvB, currentZ.slice(1));
      normalOracle(correction.d1A, correction.d1B, correction.normalEvidence); chartOracle(correction.chart, correction.solve, correction.d1A, correction.d1B, request, 'newton'); near(correction.solve.rhsMM, correction.residual.vectorMM.map(value => -value), 0); assert.deepEqual(correction.undampedDelta, correction.solve.recoveredOriginalUnknowns);
      const largest = Math.max(...correction.undampedDelta.map((value, j) => Math.abs(value / correction.chart.domainWidths[j]))), damping = Math.min(1, .25 / largest); assert.equal(correction.initialDamping, damping);
      assert.ok(correction.trials.length <= request.options.maximumTrialsPerCorrection); assert.equal(correction.acceptedTrialIndex, correction.trials.length - 1);
      for (const [ti, trial] of correction.trials.entries()) {
        assert.equal(trial.index, ti); assert.equal(trial.damping, damping / 2 ** ti); assert.deepEqual(trial.proposedZ, currentZ.map((value, j) => value + trial.damping * correction.undampedDelta[j])); assert.deepEqual(trial.uvA, [observation.uA, trial.proposedZ[0]]); assert.deepEqual(trial.uvB, trial.proposedZ.slice(1)); local.trialSlotCount++; counts.trialSlotCount++;
        if (trial.status === 'outside-domain') { assert.ok(!inside(a, trial.uvA) || !inside(b, trial.uvB)); for (const key of ['pointA', 'pointB', 'residual', 'armijoLimitMM']) assert.equal(trial[key], null); local.domainRejectedTrialCount++; counts.domainRejectedTrialCount++; }
        else { assert.ok(inside(a, trial.uvA) && inside(b, trial.uvB)); local.inDomainTrialCount++; counts.inDomainTrialCount++; local.surfacePointEvaluationCount += 2; assert.equal(trial.residual.normMM, norm(subtract(trial.pointA, trial.pointB))); assert.equal(trial.armijoLimitMM, (1 - .0001 * trial.damping) * correction.residual.normMM); if (trial.status === 'accepted') { assert.ok(trial.residual.normMM <= trial.armijoLimitMM); counts.acceptedTrialCount++; } else { assert.equal(trial.status, 'rejected-decrease'); assert.ok(trial.residual.normMM > trial.armijoLimitMM); counts.rejectedDecreaseTrialCount++; } }
      }
      const accepted = correction.trials[correction.acceptedTrialIndex]; assert.equal(accepted.status, 'accepted'); currentZ = accepted.proposedZ;
      local.correctionSolveCount++; local.acceptedCorrectionCount++; local.surfaceDerivativeAttemptCount += 2; local.chartFactorizationCount++; local.linearSolveCount++;
    }
    assert.deepEqual([observation.uvA[1], ...observation.uvB], currentZ); assert.deepEqual(observation.work, local);
    counts.correctionSolveCount += local.correctionSolveCount; counts.acceptedCorrectionCount += local.acceptedCorrectionCount; counts.surfacePointEvaluationCount += local.surfacePointEvaluationCount; counts.surfaceDerivativeAttemptCount += local.surfaceDerivativeAttemptCount; counts.chartFactorizationCount += local.chartFactorizationCount; counts.linearSolveCount += local.linearSolveCount;
  }
  assert.deepEqual(report.directCounts, counts); assert.ok(counts.surfacePointEvaluationCount <= request.options.maximumSurfacePointEvaluations); assert.ok(counts.surfaceDerivativeAttemptCount <= request.options.maximumSurfaceDerivativeAttempts); assert.ok(counts.chartFactorizationCount <= 221);
  assert.equal(report.maximumObservedPointGapMM, Math.max(...observations.map(o => o.residual.normMM))); assert.equal(report.maximumObservedD0ToD1PointGapMM, Math.max(...observations.flatMap(o => o.d0ToD1PointGapMM))); assert.equal(report.maximumObservedRelativeTangentGap, Math.max(...observations.map(o => o.relativeTangentGap)));
  assert.equal(report.minimumObservedTransverseMeasure, Math.min(...observations.map(o => o.normalEvidence.transverseMeasure))); assert.equal(report.minimumObservedAbsolutePivot, Math.min(...observations.map(o => o.chart.minimumAbsolutePivot)));
  assert.deepEqual(report.sourceSizes, request.assets.map(a => size(a.source))); assert.deepEqual(report.fileSizes.request, size(nativeJSON(request) + '\n')); assert.deepEqual(report.fileSizes.result, size(nativeJSON(result) + '\n'));
  for (const value of Object.values(report.preservation)) assert.equal(value, true); for (const [key, value] of Object.entries(report.quality)) if (typeof value === 'boolean') assert.equal(value, ['sampledSeededLocalBranch', 'ownedRebuild'].includes(key), key);
}
function construct(name, request, family) {
  const before = nativeJSON(request); additionalWork.traceCalls++; const result = trace(request); assert.equal(nativeJSON(request), before); ownership(request, result); oracle(result, family);
  saveJSON(name + '-request', request, 2097152); saveJSON(name + '-result', result); request.assets.forEach((a, i) => cold(a.source, result.originalModels[i], name + '-asset' + i));
  additionalWork.ownedCalls++; assert.deepEqual(validate(result), result.report);
  const path = saveText(name + '.authored.json', nativeJSON(request) + '\n'); additionalWork.authoredParserCalls++; const reopened = parseRequest(readFileSync(path, 'utf8')); assert.deepEqual(reopened, request);
  additionalWork.traceCalls++; const rebuilt = trace(reopened); assert.deepEqual(rebuilt, result); saveJSON(name + '-authored-rebuild', rebuilt);
  retained.push([request, before], [result, nativeJSON(result)]); cases.push({ name, family, stationCount: result.observations.length, actualCounts: result.report.directCounts, maximumObservedPointGapMM: result.report.maximumObservedPointGapMM, fileSizes: result.report.fileSizes, resultHash: hash(result) }); return result;
}
const main = construct('main-nonplanar-pair', mainRequest, 'main');
const editRequest = { source: mainAssets[0].source, sourceVersion: 0, surfaceId: 'support', edits: { poleEdits: [{ uIndex: 1, vIndex: 0, zMM: -.875 }] } };
additionalWork.surfaceEditCalls++; const edit = editSourceSurfaceControlNetWide(editRequest); additionalWork.surfaceEditOwnedCalls++; assert.deepEqual(validateSourceSurfaceControlNetWideEdit(edit), edit.report);
assert.equal(edit.patches.length, 1); assert.equal(edit.report.changedFieldCount, 1); assert.equal(edit.surface.controlPoints[1][0][2], -.875);
assert.deepEqual(edit.model.objects[0], edit.originalModel.objects[0]); assert.deepEqual(edit.model.objects[2], edit.originalModel.objects[2]); saveJSON('one-actual-pole-edit-request', editRequest); saveJSON('one-actual-pole-edit-result', edit); cold(edit.source, edit.model, 'one-pole-edit'); retained.push([edit, nativeJSON(edit)]);
const editedRequest = structuredClone(mainRequest); editedRequest.assets[0].source = edit.source; editedRequest.assets[0].surface = structuredClone(edit.surface);
assert.deepEqual(editedRequest.assets[1], mainRequest.assets[1]); assert.deepEqual(editedRequest.seed, mainRequest.seed); assert.deepEqual(editedRequest.uAStations, mainRequest.uAStations);
const edited = construct('edited-nonplanar-pair', editedRequest, 'edited'); assert.notDeepEqual(edited.observations.map(o => o.pointA), main.observations.map(o => o.pointA));
const W = [[1, 2, 1], [2, 3, 2], [1, 2, 1]], rational = (which) => ({ kind: 'surface', id: 'support', degreeU: 2, degreeV: 2, knotsU: knots(which === 'a' ? -2 : 10, which === 'a' ? 2 : 14, 2), knotsV: knots(which === 'a' ? -1 : -3, which === 'a' ? 3 : 1, 2), controlPoints: Array.from({ length: 3 }, (_, i) => Array.from({ length: 3 }, (_, j) => { const a = i - 1, b = j - 1; return which === 'a' ? [a, b, a * a / 8 + b * b / 4 - 9 / 64] : [a, a * a / 4 + b * b / 8 - 9 / 64, b]; })), weights: structuredClone(W) });
const rationalAssets = [asset('rational_a', rational('a'), 1), asset('rational_b', rational('b'), 2)];
near(tensorQuadratic(rationalAssets[0].surface, [0, 1]).point, [0, 0, 0], 0); near(tensorQuadratic(rationalAssets[1].surface, [12, -1]).point, [0, 0, 0], 0);
const rationalResult = construct('rational-independent-pair', { assets: rationalAssets, seed: { uvA: [-.25, 1.03125], uvB: [11.875, -.96875] }, uAStations: [-.25, -.125, 0, .125, .25], options: { ...options, evaluationId: 'paired_rational' } }, 'rational');

const exact = structuredClone(mainRequest); exact.assets[1] = { ...structuredClone(mainAssets[0]), sourceId: 'identical_b' }; exact.seed = { uvA: [-.75, .5625], uvB: [-.75, .5625] }; reject('zero-residual-identical-supports', exact, 'TANGENCY');
const transposed = { ...structuredClone(A), degreeU: 1, degreeV: 2, knotsU: [...A.knotsV], knotsV: [...A.knotsU], controlPoints: Array.from({ length: 2 }, (_, i) => Array.from({ length: 3 }, (_, j) => [...A.controlPoints[j][i]])), weights: [[1, 1, 1], [1, 1, 1]] };
const chartAsset = asset('chart_a', transposed, 1); reject('regular-transverse-singular-uA-chart', { ...structuredClone(mainRequest), assets: [chartAsset, structuredClone(mainAssets[1])], seed: { uvA: [0, 0], uvB: [3, 0] }, uAStations: [0, .125] }, ['CHART', 'CONDITION']);
const c0 = { ...structuredClone(A), knotsU: [-1, -1, -1, -0, -0, 1, 1, 1], controlPoints: [-1, -.5, 0, .5, 1].map((x, i) => [-.5, 1.5].map(y => [x, y, [1, 0, 0, 0, 1][i]])), weights: Array.from({ length: 5 }, () => [1, 1]) };
const c0Asset = asset('c0_a', c0, 1); const c0Failure = reject('actual-structural-c0', { ...structuredClone(mainRequest), assets: [c0Asset, structuredClone(mainAssets[1])], seed: { uvA: [0, 0], uvB: [3, 0] }, uAStations: [0, .25] }, 'CONTINUITY'); assert.equal(c0Failure.cause?.message, 'First derivative is not defined at an exact C0 interior knot');
const outsideSeed = structuredClone(mainRequest); outsideSeed.seed.uvA[1] = 2; reject('seed-outside-original-domain', outsideSeed, 'DOMAIN');
const outsideStation = structuredClone(mainRequest); outsideStation.uAStations[0] = -1.25; outsideStation.seed.uvA[0] = -1.25; reject('station-outside-original-domain', outsideStation, 'DOMAIN');
const unordered = structuredClone(mainRequest); unordered.uAStations[1] = unordered.uAStations[0]; reject('duplicate-station', unordered, ['INPUT', 'DOMAIN']);
const seedMismatch = structuredClone(mainRequest); seedMismatch.seed.uvA[0] = -.5; reject('seed-not-first-station', seedMismatch, ['INPUT', 'DOMAIN']);
const zeroCorrection = reject('legal-zero-correction-work', { ...structuredClone(mainRequest), options: { ...options, maximumCorrectionsPerStation: 0 } }, 'WORK'); assert.equal(zeroCorrection.context.directCounts.correctionSolveCount, 0); assert.equal(zeroCorrection.context.directCounts.surfacePointEvaluationCount, 0);
const zeroTrial = reject('legal-zero-trial-work', { ...structuredClone(mainRequest), options: { ...options, maximumTrialsPerCorrection: 0 } }, 'WORK'); assert.equal(zeroTrial.context.directCounts.trialSlotCount, 0); assert.equal(zeroTrial.context.directCounts.surfacePointEvaluationCount, 0);
const zeroD1 = reject('legal-zero-native-work', { ...structuredClone(mainRequest), options: { ...options, maximumSurfaceDerivativeAttempts: 0 } }, 'WORK'); assert.equal(zeroD1.context.directCounts.surfaceDerivativeAttemptCount, 0);
reject('station-budget-cap', { ...structuredClone(mainRequest), options: { ...options, maximumStations: 18 } }, 'BUDGET');
const duplicateId = structuredClone(mainRequest); duplicateId.assets[1].sourceId = duplicateId.assets[0].sourceId; reject('duplicate-source-context', duplicateId, 'IDENTITY');
const mismatch = structuredClone(mainRequest); mismatch.assets[0].surface.controlPoints[0][0][0] += .25; reject('source-native-bit-mismatch', mismatch, 'BINDING');
const badSource = structuredClone(mainRequest); badSource.assets[0].source += '@bad'; reject('actual-source-refusal', badSource, 'SOURCE');
const cappedSource = structuredClone(mainRequest); cappedSource.assets[0].source = cappedSource.assets[0].source.padEnd(262145, ' '); reject('source-string-cap', cappedSource, ['BUDGET', 'INPUT']);

const tiny = { kind: 'surface', id: 'support', degreeU: 1, degreeV: 1, knotsU: [0, 0, 8e-307, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[[-50, -50, -50], [-49, -51, -50]], [[50, 50, 50], [51, 49, 50]], [[51, 51, 51], [52, 50, 51]]], weights: [[1, 1], [1, 1], [1, 1]] };
const tinyPlane = { kind: 'surface', id: 'support', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[[0, -1, 0], [0, 0, 0]], [[1, -1, 0], [1, 0, 0]]], weights: [[1, 1], [1, 1]] };
let finiteControl;
const tinySources = [selectedSource(tiny, 1), selectedSource(tinyPlane, 2)];
const tinyCompiles = tinySources.map((text, i) => {
  saveText('tiny-original' + i + '.source0.css', text); additionalWork.coldCompiles++;
  const compiled = compileCadModel(text, { sourceVersion: 0 });
  if (compiled.ok) saveJSON('tiny-original' + i + '-cold-model', compiled.model);
  return compiled;
});
const tinySourceFailureIndex = tinyCompiles.findIndex(compiled => !compiled.ok);
if (tinySourceFailureIndex >= 0) {
  finiteControl = { stage: 'actual-source-admission', assetIndex: tinySourceFailureIndex, diagnostics: tinyCompiles[tinySourceFailureIndex].diagnostics }; retention();
} else {
  const tinyAssets = tinySources.map((text, i) => ({ sourceId: i === 0 ? 'tiny_a' : 'tiny_b', source: text, surface: structuredClone(tinyCompiles[i].model.objects[i === 0 ? 1 : 2]) }));
  assert.deepEqual(tinyAssets[0].surface, tiny); assert.deepEqual(tinyAssets[1].surface, tinyPlane);
  const request = { assets: tinyAssets, seed: { uvA: [4e-307, .5], uvB: [.5, .5] }, uAStations: [4e-307, .125], options: { ...options, evaluationId: 'paired_tiny' } };
  const failure = reject('tiny-internal-span-finite-control', request, ['SOURCE', 'SUPPORT', 'NATIVE', 'REPRESENTABILITY', 'CONDITION']); finiteControl = { stage: 'actual-trace', code: failure.code, context: failure.context, cause: failure.cause?.message ?? null };
}
saveJSON('tiny-finite-control', finiteControl);
const capControls = { sourceString: { tested: true, length: 262145 }, invalidStationBudget: { tested: true, value: 18, maximum: 17 }, legalZeroWork: { tested: true, correction: zeroCorrection.context.directCounts, trial: zeroTrial.context.directCounts, native: zeroD1.context.directCounts }, validRequestOverflowTested: false, validResultOverflowTested: false };
const mutations = [
  ['source', r => { r.request.assets[0].source += '\r\n'; }], ['model-sibling', r => { r.originalModels[0].objects[0].controlPoints[0][0] += 1; }],
  ['uv', r => { r.observations[0].uvB[0] += .125; }], ['point', r => { r.observations[0].pointA[0] += .125; }], ['partial', r => { r.observations[0].d1A.du[0] += .125; }],
  ['history', r => { r.observations[0].corrections[0].trials[0].damping /= 2; }], ['pivot', r => { r.observations[0].chart.pivots[0].absolutePivot /= 2; }],
  ['recovery', r => { r.observations[0].originalParameterDerivative[0] += .125; }], ['count', r => { r.report.directCounts.surfacePointEvaluationCount++; }],
  ['selection', r => { r.report.selections[0].objectIndex = 0; }], ['file-size', r => { r.report.fileSizes.result.utf8++; }], ['quality', r => { r.report.quality.exactTrimCurve = true; }]
];
for (const [name, mutate] of mutations) { const changed = structuredClone(main), before = nativeJSON(changed); mutate(changed); assert.notEqual(nativeJSON(changed), before); let failure; try { additionalWork.ownedCalls++; validate(changed); } catch (error) { failure = error; } assert.ok(failure instanceof BranchError); assert.equal(failure.code, 'OWNED'); failures.push({ name: 'owned-' + name, code: failure.code, context: failure.context, causeMessage: failure.cause?.message ?? null }); ownControls.push(name); retention(); }
let getterCalls = 0;
const accessor = structuredClone(mainRequest); Object.defineProperty(accessor.seed, 'uvA', { enumerable: true, get() { getterCalls++; return [-.75, .625]; } }); reject('getter-seed', accessor, 'INPUT'); assert.equal(getterCalls, 0);
const hidden = structuredClone(mainRequest); Object.defineProperty(hidden.options, 'hidden', { value: 1 }); reject('hidden-input', hidden, 'INPUT');
const symbol = structuredClone(mainRequest); symbol[Symbol('extra')] = 1; reject('symbol-input', symbol, 'INPUT');
const foreign = Object.assign(Object.create({ inherited: 1 }), mainRequest); reject('foreign-input', foreign, 'INPUT');
for (const [name, mutate] of [['cycle', r => { r.request.options.cycle = r; }], ['sparse', r => { delete r.observations[0]; }]]) { const changed = structuredClone(main); mutate(changed); let error; try { validate(changed); } catch (cause) { error = cause; } assert.ok(error instanceof BranchError); assert.equal(error.code, 'OWNED'); failures.push({ name: 'owned-' + name, code: error.code, context: error.context }); retention(); }
saveJSON('cap-controls', capControls); saveJSON('source-api.metafile', bundle.metafile); saveText('source-api.mjs', bundle.outputFiles[0].text);
const publicPath = resolve(repo, 'packages/barocss-cad/dist/index.js'), publicAPI = await import(pathToFileURL(publicPath).href), declarations = readFileSync(resolve(repo, 'packages/barocss-cad/dist/index.d.ts'), 'utf8');
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function'); for (const name of [...runtimeNames, ...typeNames]) assert.match(declarations, new RegExp('\\b' + name + '\\b')); assert.deepEqual(publicAPI.PairedSurfaceIntersectionBranchDiagnosticCode, codes);
additionalWork.publicTraceCalls++; const publicMain = publicAPI.tracePairedSurfaceIntersectionBranch(mainRequest); assert.deepEqual(publicMain, main); additionalWork.publicOwnedCalls++; assert.deepEqual(publicAPI.validatePairedSurfaceIntersectionBranch(publicMain), main.report); saveJSON('current-public-main', publicMain); retention();
const summary = { schema: 'paired-surface-intersection-branch-demo', version: 0, nativeParent: '6eff873bbd1a6ae39ab03d26a83353c50b886925', cases, runtimeNames, typeNames, analyticMainAndOneLiteralEditIndependent: true, rationalOriginalHomogeneousReplay: true, sameSelectedIdsQualifiedByDistinctSources: true, noFractionKernelCampaign: true, additionalWork, workScope: 'demo-native-oracles-edit-owned-cold-and-public-replays-excluded-from-actual-trace-reports', editDirectCounts: edit.report.directCounts, ownControls, getterCalls, failures, finiteControl, capControls, sourceInputs: inputs.length, outputFilesBeforeSummary: files.size, exactTrimCurve: false, allBranches: false, topology: false, solid: false };
saveJSON('summary', summary); console.log(nativeJSON(summary));
