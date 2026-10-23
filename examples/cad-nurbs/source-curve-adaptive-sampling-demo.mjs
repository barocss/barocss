import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2); assert.equal(args.length, 2, 'Usage: node source-curve-adaptive-sampling-demo.mjs --source <output-directory>'); assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]); mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json')), esbuild = require('esbuild');
const entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundle = await esbuild.build({ absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true }); assert.equal(bundle.outputFiles.length, 1);
const inputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path));
for (const leaf of ['source-curve-adaptive-sampling.ts', 'curve-bezier-subdivision-internal.ts', 'curve-wide-adaptive-sampling.ts', 'curve-knot-insertion.ts', 'model-compiler.ts']) assert.ok(inputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
assert.ok(!inputs.some(path => path.includes('/packages/barocss-cad/dist/'))); assert.ok(inputs.filter(path => path.includes('/packages/barocss-cad/')).every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const { sampleSourceCurveAdaptive: sample, validateSourceCurveAdaptive: validate, SourceCurveAdaptiveSamplingError: SamplingError, SourceCurveAdaptiveSamplingDiagnosticCode: codes, compileCadModel, evaluateCurve, evaluateCurveD1 } = api;
const runtimeNames = ['sampleSourceCurveAdaptive', 'validateSourceCurveAdaptive', 'SourceCurveAdaptiveSamplingError', 'SourceCurveAdaptiveSamplingDiagnosticCode'];
const typeNames = ['SourceCurveAdaptiveSamplingRequest', 'SourceCurveAdaptiveSamplingOptions', 'SourceCurveAdaptiveSamplingReport', 'SourceCurveAdaptiveSamplingResult'];
for (const name of runtimeNames) assert.equal(typeof api[name], name.endsWith('Code') ? 'object' : 'function');
assert.equal(api.splitBezierCurveTrusted, undefined); assert.deepEqual(Object.keys(codes).sort(), ['INPUT', 'SOURCE', 'REFERENCE', 'IDENTITY', 'SPAN', 'REPRESENTABILITY', 'BUDGET', 'NATIVE', 'BINDING', 'FILE', 'OWNED'].sort());
const files = new Map(), retained = [], failures = [], ownedControls = [];
const additionalWork = { sourceBuilds: 0, currentOwnedRebuilds: 0, coldRequestBuilds: 0, coldSourceCompiles: 0, publicBuilds: 0, publicOwnedRebuilds: 0, curveD0Calls: 0, curveD1Calls: 0, rationalOperations: 0 };
const clone = value => structuredClone(value);
function nativeJSON(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || ['string', 'boolean'].includes(typeof value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}';
}
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : nativeJSON(value)).digest('hex');
const size = text => ({ utf16: text.length, utf8: Buffer.byteLength(text) });
function saveText(name, text) { const path = resolve(output, name); writeFileSync(path, text); files.set(path, readFileSync(path)); assert.equal(readFileSync(path, 'utf8'), text); return path; }
function saveJSON(name, value, limit = 16777216) { const text = nativeJSON(value) + '\n'; assert.ok(text.length <= limit && Buffer.byteLength(text) <= limit, name); const path = saveText(name + '.json', text); assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), value); return path; }
function retain(value) { retained.push([value, nativeJSON(value)]); }
function retention() { for (const [path, bytes] of files) assert.deepEqual(readFileSync(path), bytes, path); for (const [value, before] of retained) assert.equal(nativeJSON(value), before); }
function close(actual, expected, label, tolerance = 1e-12) { assert.ok(Number.isFinite(actual) && Number.isFinite(expected)); assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(actual), Math.abs(expected)), label + ': ' + actual + ' / ' + expected); }
function ownOracle(value, caller = null) {
  let count = 0, depthMaximum = 0; const callerObjects = new WeakSet(), seen = new WeakSet();
  function collect(v) { if (v && typeof v === 'object' && !callerObjects.has(v)) { callerObjects.add(v); Object.values(v).forEach(collect); } }
  collect(caller);
  function visit(v, depth) { count++; depthMaximum = Math.max(depthMaximum, depth); if (v && typeof v === 'object') { assert.ok(!callerObjects.has(v), 'Caller alias'); assert.ok(!seen.has(v), 'Repeated output occurrence'); seen.add(v); assert.ok(Object.keys(v).length <= (Array.isArray(v) ? 32768 : 64)); Object.values(v).forEach(child => visit(child, depth + 1)); } }
  visit(value, 0); assert.ok(count <= 4194304 && depthMaximum <= 64); return { count, depthMaximum };
}
function cold(source, expected, name) { const path = saveText(name + '.source0.css', source); assert.ok(source.length <= 262144 && Buffer.byteLength(source) <= 262144); additionalWork.coldSourceCompiles++; const compiled = compileCadModel(readFileSync(path, 'utf8'), { sourceVersion: 0 }); assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics)); assert.deepEqual(compiled.model, expected); saveJSON(name + '-cold-model', compiled.model); return compiled; }
function reject(name, action, expected) { let failure; try { action(); } catch (error) { failure = error; } assert.ok(failure instanceof SamplingError, name + ': actual sampling error'); if (expected) assert.ok((Array.isArray(expected) ? expected : [expected]).includes(failure.code), name + ': ' + failure.code); assert.ok(failure.message.length <= 1024); failures.push({ name, code: failure.code, message: failure.message, causeName: failure.cause?.name ?? null, causeCode: failure.cause?.code ?? null, causeMessage: failure.cause?.message ?? null }); retention(); return failure; }

const selected = { kind: 'curve', id: 'weighted_quintic', degree: 5, knots: [...Array(6).fill(-3), -1, 2, ...Array(6).fill(5)], controlPoints: Array.from({ length: 8 }, (_, i) => [2 * i, (i % 2 ? -1 : 1) * (i + 1), i * i / 4]), weights: Array.from({ length: 8 }, (_, i) => i % 2 ? 3 : 1) };
const surface = { kind: 'surface', id: 'unrelated_surface', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [-1, -1, 2, 2], controlPoints: [[[2, 3, -0], [2, 5, 1]], [[4, 3, 2], [4, 5, 4]]], weights: [[1, 2], [3, 4]] };
const siblings = Array.from({ length: 14 }, (_, i) => ({ kind: 'curve', id: 'sibling_' + i, degree: 2, knots: [-2, -2, -2, 3, 3, 3], controlPoints: [[i === 0 ? -0 : i, 20 + i, -0], [i + 1, 22 + i, .5], [i + 2, 20 + i, 1]], weights: [1, 2 + i / 16, 1] }));
const expectedModel = { name: 'mixed_original', version: 0, lengthUnit: 'mm', objects: [selected, surface, ...siblings] };
const padding = 'Original design note; original geometry remains authoritative. '.repeat(1200).slice(0, 70000);
assert.equal(padding.length, 70000);
function curveText(curve) { return '@curve #' + curve.id + ' {type:nurbs;degree:' + curve.degree + ';knots:' + nativeJSON(curve.knots) + ';control-points:' + nativeJSON(curve.controlPoints) + ';weights:' + nativeJSON(curve.weights) + ';}'; }
const source = '/* ' + padding + ' */\r\n/* 설계 π: complete mixed document, Ω and signed data. */\r\n@model mixed_original {version:0;length-unit:mm;\r\n'
  + curveText(selected) + '\r\n@surface #unrelated_surface {type:nurbs;degree-u:1;degree-v:1;knots-u:[0.000,0,1,1.00];knots-v:[-1,-1,2,2];control-points:[[[2,3,-0],[2,5,1]],[[4,3,2],[4,5,4]]];weights:[[1,2],[3,4]];}\r\n'
  + siblings.map(curveText).join('\r\n') + '\r\n}\r\n';
assert.ok(source.length > 65536 && Buffer.byteLength(source) > 65536 && source.length <= 262144 && Buffer.byteLength(source) <= 262144);
const options = { chordToleranceMM: .05, maxSegments: 128, maxDepth: 12, resultIdPrefix: 'mix' }, request = { source, sourceVersion: 0, curveId: selected.id, options };
function originalPoint(t) { additionalWork.curveD0Calls++; return evaluateCurve(selected, t); }
function point(curve, t) { additionalWork.curveD0Calls++; return evaluateCurve(curve, t); }
function d1(curve, t) { additionalWork.curveD1Calls++; try { return { status: 'evaluated', value: evaluateCurveD1(curve, t) }; } catch (error) { assert.ok(error instanceof Error && /C0/.test(error.message), 'Only real C0 refusal'); return { status: 'native-refused', reason: error.message.slice(0, 512) }; } }
function distance(a, b) { const value = Math.hypot(...a.map((x, i) => x - b[i])); assert.ok(Number.isFinite(value)); return value; }
function chordDistance(p, a, b) {
  const delta = b.map((x, i) => x - a[i]), lengthSquared = delta.reduce((sum, x) => sum + x * x, 0); assert.ok(Number.isFinite(lengthSquared));
  if (lengthSquared === 0) return distance(p, a);
  const numerator = p.reduce((sum, x, i) => sum + (x - a[i]) * delta[i], 0), t = Math.max(0, Math.min(1, numerator / lengthSquared));
  return distance(p, a.map((x, i) => x + t * delta[i]));
}
function bound(local, a, b) { const B = Math.max(...local.controlPoints.map(p => chordDistance(p, a, b))), U = 64 * Number.EPSILON * Math.max(1, distance(a, b), ...local.controlPoints.flat().map(Math.abs), ...a.map(Math.abs), ...b.map(Math.abs)); assert.ok(Number.isFinite(B) && Number.isFinite(U)); return { B, U }; }
function basis(i, degree, knots, u) { if (degree === 0) return knots[i] <= u && u < knots[i + 1] ? 1 : 0; const a = knots[i + degree] - knots[i], b = knots[i + degree + 1] - knots[i + 1]; return (a > 0 ? (u - knots[i]) / a * basis(i, degree - 1, knots, u) : 0) + (b > 0 ? (knots[i + degree + 1] - u) / b * basis(i + 1, degree - 1, knots, u) : 0); }
function bernstein(degree, i, t) { let binomial = 1; for (let k = 1; k <= i; k++) binomial = binomial * (degree + 1 - k) / k; return binomial * t ** i * (1 - t) ** (degree - i); }
function extractionOracle(extraction, index) {
  const domain = [[-3, -1], [-1, 2], [2, 5]][index]; assert.equal(extraction.index, index); assert.equal(extraction.knotSpanIndex, 5 + index); assert.deepEqual(extraction.domain, domain);
  assert.deepEqual(extraction.activePoleIndices, Array.from({ length: 6 }, (_, i) => index + i)); assert.deepEqual(extraction.originalActiveControlPoints, selected.controlPoints.slice(index, index + 6)); assert.deepEqual(extraction.originalActiveWeights, selected.weights.slice(index, index + 6));
  assert.deepEqual(extraction.activeKnotIndices, Array.from({ length: 12 }, (_, i) => index + i)); assert.equal(extraction.levels.length, 6); let matrixCoefficients = 0, maximumBasisResidual = 0;
  extraction.levels.forEach((level, degree) => {
    assert.equal(level.degree, degree); assert.deepEqual(level.basisIndices, Array.from({ length: degree + 1 }, (_, i) => 5 + index - degree + i));
    assert.equal(level.coefficientMatrix.length, degree + 1);
    level.coefficientMatrix.forEach((row, i) => { assert.equal(row.length, degree + 1); matrixCoefficients += row.length; for (const x of row) assert.ok(Number.isFinite(x) && x >= 0); for (const t of [.125, .25, .375, .625, .75, .875]) { const u = domain[0] + (domain[1] - domain[0]) * t, actual = row.reduce((sum, x, j) => sum + x * bernstein(degree, j, t), 0), expected = basis(level.basisIndices[i], degree, selected.knots, u); maximumBasisResidual = Math.max(maximumBasisResidual, Math.abs(actual - expected)); close(actual, expected, 'Independent local basis polynomial'); } });
    const sums = Array.from({ length: degree + 1 }, (_, j) => level.coefficientMatrix.reduce((sum, row) => sum + row[j], 0)); assert.deepEqual(level.columnSums, sums); sums.forEach(x => close(x, 1, 'Partition')); assert.equal(level.maximumPartitionResidual, Math.max(...sums.map(x => Math.abs(x - 1))));
  });
  assert.equal(matrixCoefficients, 91); assert.deepEqual(extraction.coefficientMatrix, extraction.levels[5].coefficientMatrix); assert.deepEqual(extraction.columnSums, extraction.levels[5].columnSums);
  assert.deepEqual(extraction.rowSums, extraction.coefficientMatrix.map(row => row.reduce((sum, x) => sum + x, 0)));
  assert.equal(extraction.controlOrigins.length, 6); assert.equal(extraction.bezier.degree, 5); assert.equal(extraction.bezier.controlPoints.length, 6); assert.deepEqual(extraction.bezier.knots, [...Array(6).fill(domain[0]), ...Array(6).fill(domain[1])]);
  for (const origin of extraction.controlOrigins) {
    const j = origin.bezierPoleIndex, coefficients = extraction.coefficientMatrix.map(row => row[j]); assert.deepEqual(origin.coefficients, coefficients);
    const expectedH = [0, 0, 0, 0]; coefficients.forEach((x, i) => { const w = extraction.originalActiveWeights[i], p = extraction.originalActiveControlPoints[i]; for (let a = 0; a < 3; a++) expectedH[a] += x * w * p[a]; expectedH[3] += x * w; }); origin.homogeneous.forEach((x, a) => close(x, expectedH[a], 'Full homogeneous extraction'));
    assert.ok(origin.homogeneous[3] > 0); close(extraction.bezier.weights[j], origin.homogeneous[3], 'Positive projected weight');
    if (origin.origin === 'original-copy') { assert.ok(origin.originalPoleIndex !== null); assert.deepEqual(extraction.bezier.controlPoints[j], selected.controlPoints[origin.originalPoleIndex]); assert.ok(Object.is(extraction.bezier.weights[j], selected.weights[origin.originalPoleIndex])); }
    else { assert.equal(origin.originalPoleIndex, null); extraction.bezier.controlPoints[j].forEach((x, a) => close(x, origin.homogeneous[a] / origin.homogeneous[3], 'Generated projection')); }
  }
  assert.equal(extraction.nativeSpanModel.name, 'mix_span_' + index); assert.deepEqual(extraction.nativeSpanModel.objects, [extraction.bezier]); cold(extraction.nativeSpanSource, extraction.nativeSpanModel, 'span' + index);
  return { matrixCoefficients, maximumBasisResidual };
}
function originCurve(result, spanIndex, origin) { if (origin.kind === 'extraction') { assert.equal(origin.operationIndex, null); assert.equal(origin.side, null); return result.spans[spanIndex].extraction.bezier; } assert.equal(origin.kind, 'split'); assert.ok(Number.isInteger(origin.operationIndex)); assert.ok(['lower', 'upper'].includes(origin.side)); return result.operations[origin.operationIndex].subdivision[origin.side]; }
function subdivisionOracle(result, operation) {
  const k = operation.index, sub = operation.subdivision, input = originCurve(result, operation.originalSpanIndex, operation.inputOrigin); assert.deepEqual(sub.input, input); assert.equal(operation.purpose, 'adaptive-subdivision');
  const a = input.knots[5], b = input.knots[6], m = a + (b - a) / 2; assert.equal(sub.parameter, m); assert.ok(m > a && m < b); assert.deepEqual(sub.directCounts, { coefficientHelperInvocationCount: 1, sourceCompileCount: 1 });
  const coefficient = sub.coefficientResult, candidate = coefficient.candidate; assert.equal(candidate.id, input.id); assert.equal(candidate.controlPoints.length, 11); assert.deepEqual(candidate.knots, [...Array(6).fill(a), ...Array(5).fill(m), ...Array(6).fill(b)]);
  assert.equal(coefficient.steps.length, 5); assert.equal(coefficient.homogeneousSteps.length, 5);
  coefficient.unchangedPoles.forEach(map => { assert.deepEqual(candidate.controlPoints[map.refinedPoleIndex], input.controlPoints[map.originalPoleIndex]); assert.ok(Object.is(candidate.weights[map.refinedPoleIndex], input.weights[map.originalPoleIndex])); });
  coefficient.unchangedKnots.forEach(map => assert.ok(Object.is(candidate.knots[map.refinedKnotIndex], input.knots[map.originalKnotIndex])));
  for (const [i, step] of coefficient.homogeneousSteps.entries()) { assert.equal(step.insertion, i + 1); assert.equal(step.priorMultiplicity, i); const metadata = coefficient.steps[i]; assert.equal(metadata.generatedPoles.length, 5 - i); assert.equal(step.generatedPoles.length, 5 - i); step.generatedPoles.forEach((pole, j) => { const row = metadata.generatedPoles[j]; for (const key of ['refinedPoleIndex', 'leftPriorPoleIndex', 'rightPriorPoleIndex', 'alpha']) assert.equal(pole[key], row[key]); assert.equal(pole.alpha, .5); assert.ok(pole.left.every(Number.isFinite) && pole.right.every(Number.isFinite)); assert.deepEqual(pole.generated, pole.right.map((x, axis) => pole.alpha * x + (1 - pole.alpha) * pole.left[axis])); assert.ok(pole.generated[3] > 0); }); }
  assert.equal(sub.provenance.firstRefinedKnotIndex, 6); const shared = sub.provenance.shared; assert.deepEqual(shared, { refinedPoleIndex: 5, lowerPoleIndex: 5, upperPoleIndex: 0, pointMM: candidate.controlPoints[5], weight: candidate.weights[5] });
  for (const [side, start] of [['lower', 0], ['upper', 5]]) {
    const child = sub[side], map = sub.provenance[side]; assert.equal(child.id, 'mix_split_' + k + (side === 'lower' ? '_lo' : '_hi')); assert.equal(child.degree, 5); assert.deepEqual(child.controlPoints, candidate.controlPoints.slice(start, start + 6)); assert.deepEqual(child.weights, candidate.weights.slice(start, start + 6));
    assert.deepEqual(child.knots, side === 'lower' ? [...Array(6).fill(a), ...Array(6).fill(m)] : [...Array(6).fill(m), ...Array(6).fill(b)]);
    assert.deepEqual(map.poleMappings, Array.from({ length: 6 }, (_, i) => ({ refinedPoleIndex: start + i, childPoleIndex: i }))); assert.equal(map.side, side); assert.equal(map.curveId, child.id);
    const knotMaps = Array.from({ length: 12 }, (_, i) => ({ childKnotIndex: i, refinedKnotIndex: side === 'lower' ? i === 11 ? null : i : i === 0 ? null : i + 5, value: child.knots[i], origin: side === 'lower' ? i === 11 ? 'requested-clamp' : 'refined-copy' : i === 0 ? 'requested-clamp' : 'refined-copy' })); assert.deepEqual(map.knots, knotMaps);
  }
  assert.deepEqual(sub.lower.controlPoints[5], sub.upper.controlPoints[0]); assert.ok(Object.is(sub.lower.weights[5], sub.upper.weights[0])); assert.equal(sub.model.name, 'mix_split_' + k + '_model'); assert.deepEqual(sub.model.objects, [sub.lower, sub.upper]); assert.equal(sub.sourceVersion, 0); cold(sub.source, sub.model, 'split' + k + '-model2');
}
function mainOracle(result) {
  assert.deepEqual(Object.keys(result).sort(), ['request', 'originalModel', 'curve', 'domain', 'samples', 'spans', 'operations', 'report'].sort()); assert.deepEqual(result.request, request); assert.deepEqual(result.originalModel, expectedModel); assert.deepEqual(result.curve, selected); assert.deepEqual(result.domain, [-3, 5]);
  const S = result.spans.length; assert.equal(S, 3); const extractionProofs = result.spans.map((span, i) => { assert.deepEqual(Object.keys(span).sort(), ['extraction', 'leaves']); return extractionOracle(span.extraction, i); });
  result.operations.forEach((operation, i) => { assert.equal(operation.index, i); if (operation.inputOrigin.kind === 'split') assert.ok(operation.inputOrigin.operationIndex < i); subdivisionOracle(result, operation); });
  const leaves = result.spans.flatMap(span => span.leaves), L = leaves.length, K = result.operations.length; assert.equal(K, L - S); assert.ok(L <= 128); let d1Evaluated = 0, d1Refused = 0;
  for (const [i, leaf] of leaves.entries()) {
    assert.equal(leaf.id, 'mix_seg_' + i); assert.deepEqual(leaf.localCurve, originCurve(result, leaf.originalSpanIndex, leaf.origin)); assert.deepEqual(leaf.domain, [leaf.localCurve.knots[5], leaf.localCurve.knots[6]]); assert.ok(leaf.depth <= 12);
    const [a, b] = leaf.domain, pa = originalPoint(a), pb = originalPoint(b), policy = bound(leaf.localCurve, pa, pb); assert.deepEqual(leaf.finiteChord, { startMM: pa, endMM: pb, degenerate: pa.every((x, axis) => x === pb[axis]) });
    close(leaf.controlPolygonBoundMM, policy.B, 'Independent leaf control hull'); close(leaf.arithmeticUncertaintyMM, policy.U, 'Independent margin'); assert.ok(leaf.controlPolygonBoundMM + leaf.arithmeticUncertaintyMM <= options.chordToleranceMM); assert.ok(Math.abs(options.chordToleranceMM - leaf.controlPolygonBoundMM) > leaf.arithmeticUncertaintyMM);
    assert.deepEqual(leaf.observations.map(o => o.parameter), [a, a + (b - a) / 2, b]);
    for (const observation of leaf.observations) { const t = observation.parameter, original = originalPoint(t), local = point(leaf.localCurve, t); assert.deepEqual(observation.originalPointMM, original); assert.deepEqual(observation.localPointMM, local); close(observation.extractionDifferenceMM, distance(original, local), 'Point residual'); close(observation.outputChordDistanceMM, chordDistance(original, pa, pb), 'Observed finite chord'); assert.ok(observation.extractionDifferenceMM <= 1e-7);
      const originalD1 = d1(selected, t), localD1 = d1(leaf.localCurve, t); assert.deepEqual(observation.originalD1, originalD1); assert.deepEqual(observation.localD1, localD1);
      for (const state of [originalD1, localD1]) state.status === 'evaluated' ? d1Evaluated++ : d1Refused++;
      if (originalD1.status === 'evaluated' && localD1.status === 'evaluated') { const gap = distance(originalD1.value.derivative, localD1.value.derivative), norm = Math.hypot(...originalD1.value.derivative); assert.ok(Number.isFinite(norm)); close(observation.derivativeDifferenceMM, gap, 'Derivative residual'); close(observation.relativeDerivativeDifference, gap / Math.max(1, norm), 'Relative derivative'); assert.ok(observation.relativeDerivativeDifference <= 1e-7); } else { assert.equal(observation.derivativeDifferenceMM, null); assert.equal(observation.relativeDerivativeDifference, null); }
    }
    assert.equal(leaf.maximumExtractionDifferenceMM, Math.max(...leaf.observations.map(o => o.extractionDifferenceMM))); assert.equal(leaf.maximumObservedOutputChordDistanceMM, Math.max(...leaf.observations.map(o => o.outputChordDistanceMM))); assert.equal(leaf.maximumRelativeDerivativeDifference, Math.max(0, ...leaf.observations.map(o => o.relativeDerivativeDifference ?? 0)));
  }
  for (const span of result.spans) { assert.ok(span.leaves.length > 0); assert.ok(Object.is(span.leaves[0].domain[0], span.extraction.domain[0])); assert.ok(Object.is(span.leaves.at(-1).domain[1], span.extraction.domain[1])); span.leaves.slice(1).forEach((leaf, i) => assert.ok(Object.is(span.leaves[i].domain[1], leaf.domain[0]))); }
  const parameters = [leaves[0].domain[0], ...leaves.map(leaf => leaf.domain[1])]; assert.equal(result.samples.length, L + 1); assert.deepEqual(result.samples.map(s => s.parameter), parameters);
  result.samples.forEach((s, i) => { assert.equal(s.id, 'mix_pt_' + i); assert.deepEqual(s.pointMM, originalPoint(s.parameter)); const adjacent = leaves.filter(leaf => Object.is(leaf.domain[0], s.parameter) || Object.is(leaf.domain[1], s.parameter)); assert.deepEqual(s.adjacentSegmentIds, adjacent.map(leaf => leaf.id)); assert.deepEqual(s.originalSpanIndices, [...new Set(adjacent.map(leaf => leaf.originalSpanIndex))]); assert.equal(s.atOriginalKnot, selected.knots.some(k => k === s.parameter)); assert.equal(s.originalD1Guarded, false); });
  const report = result.report, expectedIds = [...Array.from({ length: S }, (_, i) => 'mix_span_' + i), ...Array.from({ length: 128 - S }, (_, i) => ['lo', 'hi', 'model'].map(side => 'mix_split_' + i + '_' + side)).flat(), ...Array.from({ length: 128 }, (_, i) => 'mix_seg_' + i), ...Array.from({ length: 129 }, (_, i) => 'mix_pt_' + i)];
  assert.equal(expectedIds.length, 635); assert.equal(new Set(expectedIds).size, 635); assert.deepEqual([...report.generatedIds].sort(), [...expectedIds].sort()); assert.ok(expectedIds.every(id => id !== expectedModel.name && !expectedModel.objects.some(object => object.id === id)));
  assert.deepEqual(report.directCounts, { originalSourceCompileCount: 1, extractionInvocationCount: S, coefficientHelperInvocationCount: K, subdivisionSourceCompileCount: K, curveD0AttemptCount: 11 * L - 2 * S + 1, curveD1AttemptCount: 6 * L, curveD1EvaluatedCount: d1Evaluated, curveD1NativeRefusedCount: d1Refused, visitedIntervalCount: 2 * L - S, splitAttemptCount: K, acceptedLeafCount: L, outputPointCount: L + 1 });
  assert.deepEqual(report.delegatedReceipts, { extractionCount: S, extractionSourceCompileReceiptCount: S, coefficientResultCount: K, subdivisionModelCount: K }); assert.equal(report.segmentCount, L); assert.equal(report.pointCount, L + 1); assert.equal(report.operationCount, K); assert.equal(report.originalSpanCount, 3); assert.equal(report.originalPoleCount, 8); assert.equal(report.originalKnotCount, 14); assert.deepEqual(report.originalGuardedParameters, []);
  assert.deepEqual(report.bindings.original, { requestSourcePath: 'request.source', sourceVersion: 0, modelName: expectedModel.name, objectIndex: 0, curveId: selected.id });
  assert.deepEqual(report.bindings.extractions, result.spans.map((s, i) => ({ spanIndex: i, sourcePath: 'spans[' + i + '].extraction.nativeSpanSource', modelPath: 'spans[' + i + '].extraction.nativeSpanModel', modelName: s.extraction.nativeSpanModel.name, curveId: s.extraction.bezier.id })));
  assert.deepEqual(report.bindings.subdivisions, result.operations.map((o, i) => ({ operationIndex: i, sourcePath: 'operations[' + i + '].subdivision.source', modelPath: 'operations[' + i + '].subdivision.model', modelName: o.subdivision.model.name, lowerCurveId: o.subdivision.lower.id, upperCurveId: o.subdivision.upper.id })));
  for (const key of ['globalErrorCertified', 'globalBinary64ErrorCertified', 'manufacturingToleranceCertified', 'topologyCertified', 'solid']) assert.equal(report.quality[key], false); assert.equal(report.quality.localObservationsOnly, true); assert.equal(report.quality.geometryAuthority, 'original-native-evaluateCurve'); assert.equal(report.quality.representation, 'sampled-display-points-not-native-edges-or-fit');
  assert.equal(report.maximumDepthUsed, Math.max(...leaves.map(l => l.depth))); assert.equal(report.maximumControlPolygonBoundMM, Math.max(...leaves.map(l => l.controlPolygonBoundMM))); assert.equal(report.maximumArithmeticUncertaintyMM, Math.max(...leaves.map(l => l.arithmeticUncertaintyMM))); assert.equal(report.maximumExtractionDifferenceMM, Math.max(...leaves.map(l => l.maximumExtractionDifferenceMM))); assert.equal(report.maximumObservedOutputChordDistanceMM, Math.max(...leaves.map(l => l.maximumObservedOutputChordDistanceMM))); assert.equal(report.maximumRelativeDerivativeDifference, Math.max(...leaves.map(l => l.maximumRelativeDerivativeDifference))); assert.equal(report.maximumPartitionResidual, Math.max(...result.spans.map(s => s.extraction.maximumPartitionResidual)));
  const own = ownOracle(result, request); assert.equal(report.ownValues, own.count); assert.deepEqual(report.fileSizes, { request: size(nativeJSON(result.request) + '\n'), result: size(nativeJSON(result) + '\n') }); assert.equal(report.limits.arrayElements, 32768); assert.equal(report.limits.maximumLocalPoles, 6); assert.equal(report.limits.maximumTemporaryPoles, 11); assert.equal(report.limits.maximumTemporaryKnots, 17); assert.equal(report.limits.modelObjects, 16);
  return { originalSpans: S, leaves: L, splits: K, extractionProofs, privateAdditionalD0: 0, privateAdditionalD1: 0, own, directCounts: report.directCounts, actualD1States: { evaluated: d1Evaluated, nativeRefused: d1Refused }, noGlobalErrorCertificate: true };
}
saveJSON('source-api-metafile', bundle.metafile); saveJSON('source-api-inputs', { entry, inputs, sourceOnly: true, write: false, esbuildVersion: esbuild.version });
const sourcePath = saveText('original-complete-mixed.source0.css', source); cold(source, expectedModel, 'original-whole-model16'); saveJSON('original-source-manifest', { sourceVersion: 0, sourceFile: 'original-complete-mixed.source0.css', encoding: 'utf-8', sha256: hash(source), sizes: size(source), nativeObjectCount: 16 });
const before = nativeJSON(request); additionalWork.sourceBuilds++; const main = sample(request); assert.equal(nativeJSON(request), before); const oracle = mainOracle(main);
const requestPath = saveJSON('main-request', request, 1048576), resultPath = saveJSON('main-result', main); saveJSON('main-independent-oracle', oracle); retain(request); retain(main);
additionalWork.currentOwnedRebuilds++; const reportCopy = validate(main); assert.deepEqual(reportCopy, main.report); assert.notStrictEqual(reportCopy, main.report); ownOracle(reportCopy, main); saveJSON('main-owned-report', reportCopy);
const freshSource = readFileSync(sourcePath, 'utf8'), freshRequest = JSON.parse(readFileSync(requestPath, 'utf8')); assert.equal(freshSource, source); assert.equal(freshRequest.source, freshSource); cold(freshSource, expectedModel, 'fresh-whole-model16'); additionalWork.coldRequestBuilds++; const reopened = sample(freshRequest); assert.deepEqual(reopened, main); ownOracle(reopened, freshRequest); saveJSON('fresh-request-whole-rebuild', reopened);
reject('three-original-spans-max2', () => sample({ ...request, options: { ...options, maxSegments: 2 } }), 'BUDGET');
const root = main.spans[0].extraction, rootPolicy = bound(root.bezier, originalPoint(root.domain[0]), originalPoint(root.domain[1]));
const tightTolerance = 1e-7, depthWitness = { tested: false, thresholdTested: false, independentlyComputedRoot: rootPolicy };
if (rootPolicy.B + rootPolicy.U > tightTolerance && Math.abs(tightTolerance - rootPolicy.B) > rootPolicy.U) { reject('genuine-depth0-tight-tolerance', () => sample({ ...request, options: { ...options, chordToleranceMM: tightTolerance, maxDepth: 0 } }), 'BUDGET'); depthWitness.tested = true; }
if (rootPolicy.B >= 1e-7 && rootPolicy.B <= 1000) { reject('genuine-unresolved-flatness-threshold', () => sample({ ...request, options: { ...options, chordToleranceMM: rootPolicy.B } }), 'REPRESENTABILITY'); depthWitness.thresholdTested = true; }
saveJSON('depth-and-threshold-witnesses', depthWitness);
const nulSource = source.replace(padding, '\0'.repeat(200000)); assert.notEqual(nulSource, source); assert.ok(nulSource.length <= 262144 && Buffer.byteLength(nulSource) <= 262144); cold(nulSource, expectedModel, 'valid-nul-comment-source');
const nulRequest = { ...request, source: nulSource }, escapedSize = size(nativeJSON(nulRequest) + '\n'); assert.ok(escapedSize.utf16 > 1048576 && escapedSize.utf8 > 1048576); reject('genuine-valid-source-escaped-request-file', () => sample(nulRequest), 'FILE');
saveJSON('request-file-cap-proof', { rawSizes: size(nulSource), sourceHash: hash(nulSource), compilerAcceptedSameModel16: true, escapedRequestSizes: escapedSize, actualFILE: true, replacesPaddingInsteadOfAddingIt: true, rejectedRequestArtifactIsCompact: true, valid16MiBResultOverflowTested: false });
for (const [name, edit, expected] of [
  ['missing-selected-id', r => { r.curveId = 'absent'; }, 'REFERENCE'], ['selected-surface', r => { r.curveId = surface.id; }, 'REFERENCE'], ['source-version3', r => { r.sourceVersion = 3; }, 'INPUT'],
  ['source-cap', r => { r.source = ' '.repeat(262145); }, 'BUDGET'], ['invalid-source', r => { r.source += '@broken'; }, 'SOURCE'],
  ['bad-tolerance', r => { r.options.chordToleranceMM = 0; }, 'INPUT'], ['bad-depth', r => { r.options.maxDepth = 17; }, 'BUDGET'],
  ['sibling-role-collision', r => { r.source = source.replace('#sibling_13', '#mix_span_0'); }, 'IDENTITY'], ['model-role-collision', r => { r.source = source.replace('@model mixed_original', '@model mix_span_0'); }, 'IDENTITY'],
  ['invalid-weight', r => { r.source = source.replace('weights:[1,3,1,3,1,3,1,3]', 'weights:[0,3,1,3,1,3,1,3]'); }, ['SOURCE', 'INPUT']],
  ['over-profile-coordinate', r => { r.source = source.replace('[[0,1,0],[2,-2,0.25]', '[[10001,1,0],[2,-2,0.25]'); }, 'INPUT']
]) { const bad = clone(request); edit(bad); assert.notEqual(nativeJSON(bad), nativeJSON(request), name); reject(name, () => sample(bad), expected); }
let getterCalls = 0; const getterRequest = clone(request); Object.defineProperty(getterRequest.options, 'maxSegments', { enumerable: true, get() { getterCalls++; return 128; } }); reject('getter-zero', () => sample(getterRequest), 'INPUT'); assert.equal(getterCalls, 0);
const cycle = clone(request); cycle.options.loop = cycle; reject('cycle', () => sample(cycle), 'INPUT');
const sparse = clone(main); delete sparse.samples[0]; reject('owned-sparse', () => validate(sparse), 'OWNED');
for (const [name, mutate] of [
  ['raw-source', r => { r.request.source += ' '; }], ['original-surface', r => { r.originalModel.objects[1].weights[0][0] += .5; }], ['original-full-pole', r => { r.curve.controlPoints[4][1] += .25; }],
  ['display-point', r => { r.samples[1].pointMM[0] += .25; }], ['original-parameter', r => { r.samples[1].parameter += .00001; }],
  ['extraction-matrix', r => { r.spans[0].extraction.coefficientMatrix[0][0] += .125; }], ['extraction-source', r => { r.spans[0].extraction.nativeSpanSource += ' '; }],
  ['leaf-local-pole', r => { r.spans[0].leaves[0].localCurve.controlPoints[2][0] += .125; }], ['flatness-bound', r => { r.spans[0].leaves[0].controlPolygonBoundMM += .125; }],
  ['split-generated-H', r => { r.operations[0].subdivision.coefficientResult.homogeneousSteps[0].generatedPoles[0].generated[0] += .125; }],
  ['split-index-map', r => { r.operations[0].subdivision.provenance.lower.poleMappings[0].refinedPoleIndex++; }], ['split-model-source', r => { r.operations[0].subdivision.source += ' '; }],
  ['private-count', r => { r.operations[0].subdivision.directCounts.sourceCompileCount++; }], ['source-binding', r => { r.report.bindings.original.objectIndex++; }],
  ['reserved-role', r => { r.report.generatedIds[0] += '_wrong'; }], ['root-D0-count', r => { r.report.directCounts.curveD0AttemptCount++; }], ['size', r => { r.report.fileSizes.result.utf8++; }],
  ['own-values', r => { r.report.ownValues++; }], ['false-global-certificate', r => { r.report.quality.globalErrorCertified = true; }]
]) { const bad = clone(main), snapshot = nativeJSON(bad); mutate(bad); assert.notEqual(nativeJSON(bad), snapshot, name); additionalWork.currentOwnedRebuilds++; reject('owned-' + name, () => validate(bad), 'OWNED'); ownedControls.push({ name, nonNoop: true }); }
let accepted = main; reject('atomic-replacement', () => { accepted = sample({ ...request, options: { ...options, maxSegments: 2 } }); }, 'BUDGET'); assert.strictEqual(accepted, main); retention();
const packageRoot = resolve(repo, 'packages/barocss-cad'), manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')), declared = manifest.publishConfig?.exports?.['.'] ?? manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types), leafDeclarationPath = resolve(packageRoot, 'dist/nurbs/source-wide/source-curve-adaptive-sampling.d.ts'), publicAPI = await import(pathToFileURL(runtimePath).href);
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function'); assert.deepEqual(publicAPI.SourceCurveAdaptiveSamplingDiagnosticCode, codes); assert.equal(publicAPI.splitBezierCurveTrusted, undefined);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./source-curve-adaptive-sampling.js')); for (const name of [...runtimeNames, ...typeNames]) assert.ok(readFileSync(leafDeclarationPath, 'utf8').includes(name), name);
additionalWork.publicBuilds++; const publicMain = publicAPI.sampleSourceCurveAdaptive(JSON.parse(readFileSync(requestPath, 'utf8'))); assert.deepEqual(publicMain, main); ownOracle(publicMain);
additionalWork.publicOwnedRebuilds++; assert.deepEqual(publicAPI.validateSourceCurveAdaptive(publicMain), main.report);
const emittedArtifacts = ['index.js', 'index.d.ts', 'source-curve-adaptive-sampling.js', 'source-curve-adaptive-sampling.d.ts', 'curve-bezier-subdivision-internal.js', 'curve-bezier-subdivision-internal.d.ts'].map(name => { const path = resolve(packageRoot, 'dist', name), bytes = readFileSync(path); return { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }; });
saveJSON('compiled-public-consumer', { runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, nameCount: 8, fullMainReplay: 1, privateKernelNotBarrelExported: true, emittedArtifacts }); retention();
const summary = { schema: 'barocss-source-curve-adaptive-sampling-demo', version: 0, nativeParent: 'f2200371c36d51457d80f370cb49cfc1eeb51f7f', sourceSizes: size(source), originalObjectCount: 16, selectedDegree: 5, originalPoleCount: 8, options, reservedRoles: 635, mainResultPath: resultPath, sourceHash: hash(source), resultHash: hash(main), oracle, failures, ownedControls, depthWitness, additionalWork, getterCalls, rawSourceAndAllOriginalGeometryRetained: true, originalNativeDisplayAuthority: true, privateAdditionalD0D1: 0, globalErrorCertified: false, topologyCertified: false, solid: false, noNewPublicCodec: true, noFractionKernelCampaign: true, validResultOverflowTested: false };
saveJSON('summary', summary); console.log(nativeJSON(summary));
