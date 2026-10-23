import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node source-curve-degree-elevation-demo.mjs --source <output-directory>');
assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]);
mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const esbuild = require('esbuild'), entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundle = await esbuild.build({ absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
assert.equal(bundle.outputFiles.length, 1);
const sourceInputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path));
const cadInputs = sourceInputs.filter(path => path.includes('/packages/barocss-cad/'));
for (const leaf of ['nurbs/source-wide/source-curve-degree-elevation.ts', 'nurbs/curves/curve-c0-degree-elevation-internal.ts', 'nurbs/source-wide/source-curve-control-polygon.ts', 'index.ts']) assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const {
  elevateSourceCurveDegree: elevate, validateSourceCurveDegreeElevation: validate,
  SourceCurveDegreeElevationError: InsertionError, SourceCurveDegreeElevationDiagnosticCode: codes,
  compileCadModel, evaluateCurve, evaluateCurveD1, editSourceCurveControlPolygon,
  validateSourceCurveControlPolygonEdit
} = api;
const runtimeNames = ['elevateSourceCurveDegree', 'validateSourceCurveDegreeElevation', 'SourceCurveDegreeElevationError', 'SourceCurveDegreeElevationDiagnosticCode'];
const typeNames = ['SourceCurveDegreeElevationRequest', 'SourceCurveDegreeElevationPatch', 'SourceCurveDegreeElevationReport', 'SourceCurveDegreeElevationResult'];
for (const name of runtimeNames) assert.equal(typeof api[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(Object.keys(codes).sort(), ['INPUT', 'VERSION', 'IDENTITY', 'SOURCE', 'TARGET', 'DEGREE', 'BASIS', 'BUDGET', 'REPRESENTABILITY', 'BINDING', 'NATIVE', 'OWNED', 'FILE'].sort());
const files = new Map(), retained = [], accepted = [], cases = [], failures = [], priorRefusals = [];
function nativeJSON(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || ['string', 'boolean'].includes(typeof value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}';
}
function jsonFile(name, value) {
  const file = resolve(output, name + '.json'), text = nativeJSON(value) + '\n';
  assert.ok(text.length <= 2097152 && Buffer.byteLength(text) <= 2097152, name + ' file size');
  writeFileSync(file, text); files.set(file, readFileSync(file));
  const reopened = JSON.parse(readFileSync(file, 'utf8')); assert.deepEqual(reopened, value);
  return { file, reopened };
}
function sourceFile(name, source, model) {
  const file = resolve(output, name + '.source0.css');
  assert.ok(source.length <= 262144 && Buffer.byteLength(source) <= 262144, name + ' source size');
  writeFileSync(file, source); files.set(file, readFileSync(file));
  const cold = compileCadModel(readFileSync(file, 'utf8'), { sourceVersion: 0 });
  assert.equal(cold.ok, true, JSON.stringify(cold.diagnostics)); assert.deepEqual(cold.model, model);
  return file;
}
function ownership(inputs, result) {
  const caller = new WeakSet(), seen = new WeakSet();
  function collect(value) {
    if (value && typeof value === 'object' && !caller.has(value)) { caller.add(value); Object.values(value).forEach(collect); }
  }
  function visit(value) {
    if (value && typeof value === 'object') {
      assert.ok(!caller.has(value), 'Caller alias'); assert.ok(!seen.has(value), 'Repeated result occurrence');
      seen.add(value); Object.values(value).forEach(visit);
    }
  }
  inputs.forEach(collect); visit(result);
}
function decimal(value) {
  if (Object.is(value, -0)) return '-0';
  const text = String(value); if (!text.includes('e')) return text;
  const [mantissa, exponentText] = text.split('e'), negative = mantissa.startsWith('-');
  const raw = negative ? mantissa.slice(1) : mantissa, [whole, fraction = ''] = raw.split('.');
  const digits = whole + fraction, place = whole.length + Number(exponentText);
  const expanded = place <= 0 ? '0.' + '0'.repeat(-place) + digits : place >= digits.length ? digits + '0'.repeat(place - digits.length) : digits.slice(0, place) + '.' + digits.slice(place);
  return (negative ? '-' : '') + expanded;
}
const work = { operations: 0, maximumOperations: 20000000, maximumBits: 8192, maximumDTOValues: 5000 };
function tick(count = 1) {
  work.operations += count;
  assert.ok(work.operations <= work.maximumOperations, 'Demo primitive operation budget');
}
function sized(value) {
  assert.ok(value.toString(2).replace('-', '').length <= work.maximumBits, 'Demo intermediate integer bit budget');
  return value;
}
const integerAdd = (a, b) => { tick(); return sized(a + b); };
const integerMultiply = (a, b) => { tick(); return sized(a * b); };
const integerNegate = a => { tick(); return sized(-a); };
function gcd(a, b) {
  sized(a); sized(b); tick(); if (a < 0n) a = integerNegate(a);
  for (;;) { tick(); if (b === 0n) break; tick(); const remainder = sized(a % b); a = b; b = remainder; }
  return a;
}
function fraction(n, d = 1n) {
  sized(n); sized(d); tick(); assert.ok(d > 0n);
  const g = gcd(n, d); tick(2); return [sized(n / g), sized(d / g)];
}
const add = (a, b) => fraction(integerAdd(integerMultiply(a[0], b[1]), integerMultiply(b[0], a[1])), integerMultiply(a[1], b[1]));
const sub = (a, b) => add(a, [integerNegate(b[0]), b[1]]);
const mul = (a, b) => fraction(integerMultiply(a[0], b[0]), integerMultiply(a[1], b[1]));
function divide(a, b) {
  tick(2); assert.notEqual(b[0], 0n);
  const n = integerMultiply(a[0], b[1]), d = integerMultiply(a[1], b[0]);
  return d > 0n ? fraction(n, d) : fraction(integerNegate(n), integerNegate(d));
}
const abs = a => { tick(); return [a[0] < 0n ? integerNegate(a[0]) : a[0], a[1]]; };
function compare(a, b) {
  const left = integerMultiply(a[0], b[1]), right = integerMultiply(b[0], a[1]); tick(2);
  return left < right ? -1 : left > right ? 1 : 0;
}
function represented(value) {
  assert.ok(Number.isFinite(value)); tick(); if (value === 0) return [0n, 1n];
  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value, false);
  const raw = view.getBigUint64(0, false); tick(7);
  const negative = raw >> 63n, exponent = Number((raw >> 52n) & 2047n);
  const mantissa = integerAdd(raw & ((1n << 52n) - 1n), exponent ? 1n << 52n : 0n);
  const power = exponent ? exponent - 1075 : -1074; tick(2);
  const scale = sized(1n << BigInt(Math.abs(power)));
  const signed = negative ? integerNegate(mantissa) : mantissa;
  return fraction(power >= 0 ? integerMultiply(signed, scale) : signed, power < 0 ? scale : 1n);
}
const asDTO = value => {
  const numerator = value[0].toString(), denominator = value[1].toString();
  assert.ok(numerator.length <= 5000 && denominator.length <= 5000, 'Integer DTO string budget');
  return { numerator, denominator };
};
const z = [0n, 1n], o = [1n, 1n];
const neg = a => [integerNegate(a[0]), a[1]];
const polyAdd = (a, b) => Array.from({ length: Math.max(a.length, b.length) }, (_, i) => add(a[i] ?? z, b[i] ?? z));
const polyScale = (a, c) => a.map(v => mul(v, c));
function polyProduct(a, b) {
  const values = Array.from({ length: a.length + b.length - 1 }, () => z);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) values[i + j] = add(values[i + j], mul(a[i], b[j]));
  return values;
}
const polyAt = (a, t) => a.reduceRight((result, v) => add(mul(result, t), v), z);
const polyDerivative = a => a.slice(1).map((v, i) => mul(v, [BigInt(i + 1), 1n]));
// Independent Cox polynomials in each union span's local coordinate.
function rawBasisPolynomials(knots, degree, a, b) {
  const U = knots.map(represented), mid = divide(add(a, b), [2n, 1n]), width = sub(b, a);
  let N = U.slice(0, -1).map((v, i) => [compare(mid, v) >= 0 && compare(mid, U[i + 1]) < 0 ? o : z]);
  for (let k = 1; k <= degree; k++) N = Array.from({ length: N.length - 1 }, (_, i) => {
    let left = [z], right = [z];
    const dl = sub(U[i + k], U[i]), dr = sub(U[i + k + 1], U[i + 1]);
    if (dl[0] !== 0n) left = polyProduct(N[i], [divide(sub(a, U[i]), dl), divide(width, dl)]);
    if (dr[0] !== 0n) right = polyProduct(N[i + 1], [divide(sub(U[i + k + 1], a), dr), neg(divide(width, dr))]);
    return polyAdd(left, right);
  });
  return N;
}
const basisCache = new Map();
function basisPolynomials(knots, degree, a, b) {
  const key = nativeJSON([knots, degree, asDTO(a), asDTO(b)]);
  if (!basisCache.has(key)) basisCache.set(key, rawBasisPolynomials(knots, degree, a, b));
  return basisCache.get(key);
}
const liftCache = new WeakMap();
function lift(curve) {
  if (!liftCache.has(curve)) liftCache.set(curve, curve.controlPoints.map((p, i) => [...p.map(v => mul(represented(v), represented(curve.weights[i]))), represented(curve.weights[i])]));
  return liftCache.get(curve);
}
const polynomialCache = new WeakMap();
function homogeneousPolynomial(curve, H, a, b) {
  if (!polynomialCache.has(curve)) polynomialCache.set(curve, new WeakMap());
  const coefficients = polynomialCache.get(curve);
  if (!coefficients.has(H)) coefficients.set(H, new Map());
  const key = nativeJSON([asDTO(a), asDTO(b)]), entries = coefficients.get(H);
  if (!entries.has(key)) {
    const basis = basisPolynomials(curve.knots, curve.degree, a, b); assert.equal(basis.length, H.length);
    entries.set(key, [0, 1, 2, 3].map(axis => basis.reduce((result, N, i) => polyAdd(result, polyScale(N, H[i][axis])), [z])));
  }
  return entries.get(key);
}
function distinct(values) {
  const result = [];
  for (const value of values) if (!result.some(v => v === value)) result.push(value);
  return result.sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
}
function exactPointDerivative(curve, parameter) {
  const breaks = distinct(curve.knots), at = represented(parameter);
  const index = breaks.findIndex((v, i) => i < breaks.length - 1 && parameter >= v && parameter <= breaks[i + 1]);
  assert.ok(index >= 0);
  const a = represented(breaks[index]), b = represented(breaks[index + 1]), width = sub(b, a);
  const local = divide(sub(at, a), width), H = homogeneousPolynomial(curve, lift(curve), a, b);
  const values = H.map(poly => polyAt(poly, local));
  const derivatives = H.map(poly => divide(polyAt(polyDerivative(poly), local), width));
  const w = values[3], dw = derivatives[3];
  return {
    point: values.slice(0, 3).map(v => divide(v, w)),
    derivative: values.slice(0, 3).map((v, i) => divide(sub(mul(derivatives[i], w), mul(v, dw)), mul(w, w)))
  };
}
const domain = c => [c.knots[c.degree], c.knots[c.controlPoints.length]];
const basis = c => ({ degree: c.degree, poleCount: c.controlPoints.length, knots: c.knots, domain: domain(c) });
function residualProof(before, beforeH, after, afterH, interval, requireZero) {
  const breaks = distinct([...before.knots, ...after.knots, ...interval]).filter(v => v >= interval[0] && v <= interval[1]);
  const hash = createHash('sha256');
  let cells = 0, coefficientCount = 0, nonzero = 0;
  for (let i = 0; i + 1 < breaks.length; i++) {
    const a = represented(breaks[i]), b = represented(breaks[i + 1]);
    const left = homogeneousPolynomial(before, beforeH, a, b);
    const right = homogeneousPolynomial(after, afterH, a, b);
    for (let axis = 0; axis < 4; axis++) {
      for (let k = 0; k <= after.degree; k++) {
        const delta = sub(right[axis][k] ?? z, left[axis][k] ?? z);
        if (delta[0] !== 0n) nonzero++;
        hash.update(nativeJSON(asDTO(delta)) + '\n');
        coefficientCount++;
      }
    }
    cells++;
  }
  if (requireZero) assert.equal(nonzero, 0, 'Independent ideal whole polynomial identity');
  return { cells, coefficientCount, nonzero, residualSHA256: hash.digest('hex') };
}

function knotBlocks(c) {
  const blocks = [];
  for (let i = 0; i < c.knots.length;) {
    let end = i; while (end + 1 < c.knots.length && c.knots[end + 1] === c.knots[i]) end++;
    blocks.push({ index: blocks.length, value: c.knots[i], originalFirstKnotIndex: i, originalLastKnotIndex: end, multiplicity: end - i + 1 });
    i = end + 1;
  }
  return blocks;
}
function coefficientOracle(result, fullProof) {
  const c = result.originalCurve, p = c.degree, q = p + 1, blocks = knotBlocks(c), S = blocks.length - 1;
  assert.equal(result.curve.degree, q); assert.equal(result.request.targetDegree, q);
  assert.deepEqual(result.provenance.blocks, blocks);
  assert.deepEqual(result.provenance.parameterMap, { kind: 'identity', formula: 'u=t', d1Factor: 1 });
  const lifted = c.controlPoints.map((point, i) => [...point.map(v => v * c.weights[i]), c.weights[i]]);
  const points = Array(S * q + 1), weights = Array(S * q + 1), spans = [], copiedPoles = [], knots = [];
  const idealOriginal = fullProof ? lift(c) : null, ideal = fullProof ? Array(S * q + 1) : null;
  const residualWitnesses = [];
  for (let join = 0; join <= S; join++) {
    const originalPoleIndex = join * p, outputPoleIndex = join * q;
    points[outputPoleIndex] = c.controlPoints[originalPoleIndex].slice(); weights[outputPoleIndex] = c.weights[originalPoleIndex];
    copiedPoles.push({ originalPoleIndex, outputPoleIndex });
    if (fullProof) ideal[outputPoleIndex] = idealOriginal[originalPoleIndex];
  }
  for (let s = 0; s < S; s++) {
    const originalPoleIndices = Array.from({ length: p + 1 }, (_, i) => s * p + i);
    const outputPoleIndices = Array.from({ length: q + 1 }, (_, i) => s * q + i), generated = [];
    for (let i = 1; i <= p; i++) {
      const outputPoleIndex = s * q + i, leftOriginalPoleIndex = s * p + i - 1, rightOriginalPoleIndex = s * p + i;
      const alpha = i / q, leftHomogeneous = lifted[leftOriginalPoleIndex], rightHomogeneous = lifted[rightOriginalPoleIndex];
      const leftContribution = leftHomogeneous.map(v => alpha * v), rightContribution = rightHomogeneous.map(v => (1 - alpha) * v);
      const homogeneous = leftContribution.map((v, axis) => v + rightContribution[axis]);
      const pointMM = homogeneous.slice(0, 3).map(v => v / homogeneous[3]), weight = homogeneous[3];
      generated.push({ outputPoleIndex, leftOriginalPoleIndex, rightOriginalPoleIndex, alpha, leftHomogeneous, rightHomogeneous, leftContribution, rightContribution, homogeneous, pointMM, weight });
      points[outputPoleIndex] = pointMM; weights[outputPoleIndex] = weight;
      assert.ok(homogeneous.every(Number.isFinite) && pointMM.every(v => Number.isFinite(v) && Math.abs(v) <= 10000) && weight >= .000001 && weight <= 1000000);
      if (fullProof) {
        const exactAlpha = fraction(BigInt(i), BigInt(q));
        ideal[outputPoleIndex] = idealOriginal[leftOriginalPoleIndex].map((v, axis) => add(mul(exactAlpha, v), mul(sub(o, exactAlpha), idealOriginal[rightOriginalPoleIndex][axis])));
        residualWitnesses.push({ spanIndex: s, outputPoleIndex, idealAlpha: asDTO(exactAlpha), storedAlphaResidual: asDTO(sub(represented(alpha), exactAlpha)), liftResidual: leftHomogeneous.map((v, axis) => asDTO(sub(represented(v), idealOriginal[leftOriginalPoleIndex][axis]))), actualGeneratedHomogeneousResidual: homogeneous.map((v, axis) => asDTO(sub(represented(v), ideal[outputPoleIndex][axis]))) });
      }
    }
    spans.push({ index: s, domain: [blocks[s].value, blocks[s + 1].value], originalPoleIndices, outputPoleIndices, generated });
  }
  for (const block of blocks) {
    for (let k = block.originalFirstKnotIndex; k <= block.originalLastKnotIndex; k++) knots.push({ outputKnotIndex: knots.length, originalKnotIndex: k, value: c.knots[k], origin: 'original-copy', blockIndex: block.index });
    knots.push({ outputKnotIndex: knots.length, originalKnotIndex: null, value: block.value, origin: 'degree-multiplicity-increase', blockIndex: block.index });
  }
  const candidate = { ...c, degree: q, knots: knots.map(k => k.value), controlPoints: points, weights };
  assert.deepEqual(result.curve, candidate);
  assert.deepEqual(result.provenance.coefficientResult, { candidate, liftedOriginalHomogeneous: lifted, spans, copiedPoles, knots });
  assert.deepEqual(domain(candidate), domain(c));
  for (const m of copiedPoles) { assert.deepEqual(candidate.controlPoints[m.outputPoleIndex], c.controlPoints[m.originalPoleIndex]); assert.ok(Object.is(candidate.weights[m.outputPoleIndex], c.weights[m.originalPoleIndex])); }
  for (const m of knots) assert.ok(Object.is(candidate.knots[m.outputKnotIndex], m.originalKnotIndex === null ? blocks[m.blockIndex].value : c.knots[m.originalKnotIndex]));
  const summary = { spanCount: S, generatedPoleCount: p * S, copiedEndpointCount: S + 1, liftedPoleCount: c.controlPoints.length, addedKnotCount: blocks.length, copiedJoinKnotBitsRetained: true, fullIdealCampaign: fullProof };
  if (fullProof) {
    summary.ideal = residualProof(c, idealOriginal, candidate, ideal, domain(c), true);
    summary.stored = residualProof(c, idealOriginal, candidate, lift(candidate), domain(c), false);
    summary.generatedResiduals = residualWitnesses;
  }
  let fractionDTOCount = 0;
  const visit = value => { if (value && typeof value === 'object') { if (Object.hasOwn(value, 'numerator')) fractionDTOCount++; Object.values(value).forEach(visit); } };
  visit(summary); assert.ok(fractionDTOCount <= 5000); summary.fractionDTOCount = fractionDTOCount;
  return summary;
}
function stations(c) {
  const blocks = knotBlocks(c), values = [];
  for (let i = 0; i + 1 < blocks.length; i++) {
    const a = blocks[i].value, b = blocks[i + 1].value, width = b - a;
    if (!values.length) values.push(a);
    const inner = [.25, .5, .75].map(f => a + width * f);
    assert.ok(Number.isFinite(width) && width > 0 && inner.every(Number.isFinite) && inner[0] > a && inner[1] > inner[0] && inner[2] > inner[1] && inner[2] < b);
    values.push(...inner, b);
  }
  return values;
}
function d1State(c, t) {
  try { return { status: 'evaluated', value: evaluateCurveD1(c, t) }; }
  catch (error) { assert.ok(error instanceof Error); assert.match(error.message, /exact C0 interior knot/); return { status: 'refused-c0', name: error.name, reason: error.message, value: null }; }
}
function relative(a, b) {
  if (a.status !== 'evaluated' || b.status !== 'evaluated') return null;
  const delta = Math.hypot(...b.value.derivative.map((v, i) => v - a.value.derivative[i]));
  const na = Math.hypot(...a.value.derivative), nb = Math.hypot(...b.value.derivative), scale = Math.max(1, na, nb);
  assert.ok([delta, na, nb, scale].every(Number.isFinite)); return delta / scale;
}
function nativeOracle(result, fullProof) {
  const parameters = stations(result.originalCurve); let evaluated = 0, refused = 0;
  const observations = parameters.map(parameter => {
    const originalPointMM = evaluateCurve(result.originalCurve, parameter), pointMM = evaluateCurve(result.curve, parameter);
    const originalD1 = d1State(result.originalCurve, parameter), outputD1 = d1State(result.curve, parameter);
    for (const [c, point, state] of [[result.originalCurve, originalPointMM, originalD1], [result.curve, pointMM, outputD1]]) {
      if (state.status === 'evaluated') evaluated++; else refused++;
      if (fullProof) {
        const exact = exactPointDerivative(c, parameter);
        for (let axis = 0; axis < 3; axis++) {
          assert.ok(compare(abs(sub(represented(point[axis]), exact.point[axis])), represented(1e-7)) <= 0);
          if (state.status === 'evaluated') assert.ok(compare(abs(sub(represented(state.value.derivative[axis]), exact.derivative[axis])), mul(represented(1e-7), add(o, abs(exact.derivative[axis])))) <= 0);
        }
      }
    }
    const pointDifferenceMM = Math.hypot(...pointMM.map((v, i) => v - originalPointMM[i]));
    const relativeDerivativeDifference = relative(originalD1, outputD1);
    assert.ok(pointDifferenceMM <= 1e-7 && (relativeDerivativeDifference === null || relativeDerivativeDifference <= 1e-7));
    return { parameter, originalPointMM, pointMM, pointDifferenceMM, originalD1, outputD1, relativeDerivativeDifference };
  });
  assert.deepEqual(result.report.stations, parameters); assert.deepEqual(result.report.observations, observations);
  assert.equal(result.report.maximumPointDifferenceMM, Math.max(...observations.map(v => v.pointDifferenceMM)));
  assert.equal(result.report.maximumRelativeDerivativeDifference, Math.max(...observations.map(v => v.relativeDerivativeDifference ?? 0)));
  return { observationCount: observations.length, evaluated, refused, observations, exactStoredNativeComparison: fullProof };
}
function mixedSource(c) {
  const list = values => '[ ' + values.map(decimal).join(' , ') + ' ]';
  return '/* original π complete source; preserve CRLF */\r\n@model original_degree_model { version:0; length-unit:mm;\r\n' +
    '@curve #unused_curve {type:nurbs;degree:1;knots:[-0,/* sibling comment */-0,+1.000,1];control-points:[[-0,-0,-0],[+2.000,3,4]];weights:[1.000,1];}\r\n' +
    '@curve #' + c.id + ' {type:nurbs; /* preserve adjacent degree comment */ degree: /* outside token */ +' + c.degree + '.000;\r\n' +
    'weights:' + list(c.weights) + ';\r\ncontrol-points:[\r\n' + c.controlPoints.map(list).join(' ,\r\n') + '\r\n];\r\nknots:' + list(c.knots) + ';}\r\n' +
    '@surface #unused_surface {type:nurbs;degree-u:1;degree-v:1;knots-u:[-0,-0,1,1];knots-v:[0,0,1,1];control-points:[[[-0,-0,0],[0,1,0]],[[1,0,0],[1,1,0]]];weights:[[1,1],[1,1]];}\r\n/* untouched Ω ending */\r\n}\r\n';
}
function sourceOracle(result) {
  const cold = compileCadModel(result.request.source, { sourceVersion: 0 }); assert.equal(cold.ok, true, JSON.stringify(cold.diagnostics));
  assert.deepEqual(cold.model, result.originalModel);
  const index = cold.model.objects.findIndex(o => o.id === result.request.curveId); assert.equal(index, 1);
  assert.deepEqual(cold.model.objects[index], result.originalCurve); assert.equal(result.provenance.selectedObjectIndex, index);
  const declaration = cold.ast.declarations.find(d => d.kind === 'curve' && d.id === result.request.curveId);
  const patches = result.provenance.patches;
  assert.equal(patches.length, 4); assert.deepEqual(patches.map(p => p.field).sort(), ['control-points', 'degree', 'knots', 'weights']);
  const canonicalList = values => '[' + values.map(v => { const text = decimal(v); assert.ok(text.length <= 512 && Object.is(Number(text), v)); return text; }).join(',') + ']';
  const replacement = { degree: decimal(result.curve.degree), knots: canonicalList(result.curve.knots), weights: canonicalList(result.curve.weights), 'control-points': '[' + result.curve.controlPoints.map(canonicalList).join(',') + ']' };
  function bind(node, value, parentStart, parentEnd) {
    assert.ok(node.range.start >= parentStart && node.range.end <= parentEnd && node.range.start < node.range.end);
    if (Array.isArray(value)) { assert.equal(node.kind, 'array'); assert.equal(node.items.length, value.length); node.items.forEach((child, i) => bind(child, value[i], node.range.start, node.range.end)); }
    else { assert.equal(node.kind, 'number'); const lexeme = result.request.source.slice(node.range.start, node.range.end); assert.match(lexeme, /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/); assert.ok(Object.is(Number(lexeme), node.value) && Object.is(node.value, value)); }
  }
  let last = 0, shift = 0;
  for (const patch of patches) {
    const node = declaration.fields.find(f => f.name === patch.field).value;
    const data = patch.field === 'degree' ? result.originalCurve.degree : patch.field === 'knots' ? result.originalCurve.knots : patch.field === 'weights' ? result.originalCurve.weights : result.originalCurve.controlPoints;
    bind(node, data, declaration.range.start, declaration.range.end);
    assert.equal(patch.startUTF16, node.range.start); assert.equal(patch.endUTF16, node.range.end); assert.ok(patch.startUTF16 >= last);
    assert.equal(patch.originalText, result.request.source.slice(patch.startUTF16, patch.endUTF16)); assert.equal(patch.replacementText, replacement[patch.field]);
    const before = result.request.source.slice(last, patch.startUTF16), after = result.source.slice(last + shift, patch.startUTF16 + shift);
    assert.equal(before, after); assert.deepEqual(Buffer.from(before), Buffer.from(after));
    assert.equal(result.source.slice(patch.startUTF16 + shift, patch.startUTF16 + shift + patch.replacementText.length), patch.replacementText);
    shift += patch.replacementText.length - (patch.endUTF16 - patch.startUTF16); last = patch.endUTF16;
  }
  assert.equal(result.request.source.slice(last), result.source.slice(last + shift));
  let applied = result.request.source;
  for (const patch of patches.slice().reverse()) applied = applied.slice(0, patch.startUTF16) + patch.replacementText + applied.slice(patch.endUTF16);
  assert.equal(applied, result.source);
  const candidate = compileCadModel(result.source, { sourceVersion: 0 }); assert.equal(candidate.ok, true); assert.deepEqual(candidate.model, result.model);
  const expected = structuredClone(cold.model); expected.objects[index] = structuredClone(result.curve); assert.deepEqual(candidate.model, expected);
  assert.equal(result.curve.id, result.originalCurve.id);
  return { selectedObjectIndex: index, fourActualASTValuePatches: true, scalarDegreeRangeBound: true, outsideUTF16AndUTF8Exact: true, completeModelHeaderOrderSiblingBitsRetained: true };
}

const curve = (id, degree, knots, controlPoints, weights) => ({ kind: 'curve', id, degree, knots, controlPoints, weights });
const requestFor = (source, curveId, targetDegree) => ({ source, sourceVersion: 0, curveId, targetDegree, maximumObservations: 128 });
function positive(name, request, expected, fullProof) {
  const original = compileCadModel(request.source, { sourceVersion: 0 }); assert.equal(original.ok, true, JSON.stringify(original.diagnostics));
  const requestFile = jsonFile(name + '.request', request), before = structuredClone(request), result = elevate(request);
  assert.deepEqual(request, before); ownership([request], result);
  assert.deepEqual(Object.keys(result).sort(), ['request', 'source', 'originalModel', 'model', 'originalCurve', 'curve', 'provenance', 'report'].sort());
  assert.deepEqual(result.request, request); assert.deepEqual(result.originalModel, original.model);
  assert.equal(result.provenance.originalDegree, result.originalCurve.degree); assert.equal(result.provenance.targetDegree, result.curve.degree);
  assert.deepEqual(result.provenance.domain, domain(result.originalCurve));
  const coefficient = coefficientOracle(result, fullProof), native = nativeOracle(result, fullProof), source = sourceOracle(result), report = result.report;
  assert.deepEqual([result.curve.controlPoints.length, result.curve.knots.length, native.observationCount, native.evaluated, native.refused], expected);
  const S = coefficient.spanCount, G = coefficient.generatedPoleCount, m = native.observationCount;
  assert.deepEqual(report.directCounts, {
    originalCompileCount: 1, candidateCompileCount: 1, coefficientElevationCallCount: 1, nativeCurveValidationCount: 2, domainQueryCount: 2,
    spanCount: S, generatedPoleCount: G, liftedPoleCount: result.originalCurve.controlPoints.length, copiedEndpointCount: S + 1, addedKnotCount: S + 1,
    patchCount: 4, decimalEmissionCount: 1 + result.curve.knots.length + 4 * result.curve.controlPoints.length,
    observationCount: m, curveD0Count: 2 * m, curveD1AttemptCount: 2 * m, curveD1EvaluatedCount: native.evaluated, curveD1RefusedCount: native.refused,
    oldPublicElevationCallCount: 0, sourceWriterCallCount: 0, insertionCallCount: 0, rationalOperationCount: 0
  });
  assert.equal(report.originalDegree, result.originalCurve.degree); assert.equal(report.targetDegree, result.curve.degree);
  assert.deepEqual(report.poleCounts, { original: result.originalCurve.controlPoints.length, output: result.curve.controlPoints.length });
  assert.deepEqual(report.knotCounts, { original: result.originalCurve.knots.length, output: result.curve.knots.length });
  assert.equal(report.spanCount, S); assert.equal(report.patchCount, 4); assert.deepEqual(report.domain, domain(result.curve));
  const size = text => ({ utf16: text.length, utf8: Buffer.byteLength(text) });
  assert.deepEqual(report.sourceSizes, { original: size(request.source), candidate: size(result.source) });
  assert.deepEqual(report.fileSizes, { request: size(nativeJSON(request) + '\n'), result: size(nativeJSON(result) + '\n') });
  for (const value of Object.values(report.preservation)) assert.equal(value, true);
  assert.equal(report.quality.geometricValidity, 'not-certified'); assert.equal(report.quality.localShapeObservations, true);
  for (const flag of ['topologyCertified', 'solid', 'globalShapeErrorCertified', 'globalBinary64ErrorCertified', 'g1g2Certified', 'manufacturingToleranceCertified', 'editorDisplayCertified', 'persistentTopologyBindingCertified', 'publication']) assert.equal(report.quality[flag], false);
  assert.equal(report.quality.derivativeSemantics, 'actual-native-guards-unchanged');
  assert.deepEqual(validate(result), report);
  const originalFile = sourceFile(name + '.original', request.source, result.originalModel), candidateFile = sourceFile(name + '.candidate', result.source, result.model);
  const saved = jsonFile(name + '.result', result);
  jsonFile(name + '.coefficient-result', result.provenance.coefficientResult); jsonFile(name + '.four-patches', result.provenance.patches);
  jsonFile(name + '.independent-coefficient-oracle', coefficient); jsonFile(name + '.independent-native-oracle', native); jsonFile(name + '.independent-source-oracle', source);
  retained.push({ value: request, before }); accepted.push({ result, beforeResult: structuredClone(result) });
  cases.push({ name, requestFile: requestFile.file, resultFile: saved.file, originalFile, candidateFile, originalDegree: result.originalCurve.degree, targetDegree: result.curve.degree, originalPoles: result.originalCurve.controlPoints.length, outputPoles: result.curve.controlPoints.length, directCounts: report.directCounts, fileSizes: report.fileSizes, fullIdealCampaign: fullProof, idealCoefficientCount: coefficient.ideal?.coefficientCount ?? 0 });
  return { request, result, coefficient, native };
}
jsonFile('source-api.inputs', { entry, sourceInputs, cadInputs, sourceOnly: true, write: false, esbuildVersion: esbuild.version });
jsonFile('source-api.metafile', bundle.metafile);
assert.equal(api.elevateC0BezierChainCoefficientsTrusted, undefined, 'Private wide helper is not a public alternate constructor');
const mainCurve = curve('main_cubic', 3, [...Array(4).fill(-0), ...Array(4).fill(3)], Array.from({ length: 4 }, (_, i) => [2 * i, -0, i * i / 4]), [1, 3, 1, 3]);
const main = positive('main', requestFor(mixedSource(mainCurve), mainCurve.id, 4), [5, 10, 5, 10, 0], true);
assert.equal(main.coefficient.ideal.coefficientCount, 20); assert.ok(main.coefficient.stored.nonzero > 0);
for (const o of main.result.report.observations) {
  assert.ok(Object.is(o.originalPointMM[1], -0)); assert.ok(Object.is(o.pointMM[1], -0));
  for (const state of [o.originalD1, o.outputD1]) if (state.status === 'evaluated') assert.ok(Object.is(state.value.derivative[1], +0));
}
const chainCurve = curve('quartic_c0_chain', 4, [...Array(5).fill(-2), ...Array(4).fill(-0), ...Array(5).fill(3)], Array.from({ length: 9 }, (_, i) => [2 * i, (i % 2 ? -1 : 1) * (i + 1), i * i / 4]), Array.from({ length: 9 }, (_, i) => i % 2 ? 3 : 1));
const chain = positive('nonuniform-quartic-c0', requestFor(mixedSource(chainCurve), chainCurve.id, 5), [11, 17, 9, 16, 2], true);
assert.equal(chain.coefficient.ideal.coefficientCount, 48); assert.ok(chain.coefficient.stored.nonzero > 0);
const join = chain.result.report.observations.find(o => o.parameter === 0);
assert.ok(Object.is(join.parameter, -0)); assert.equal(join.originalD1.status, 'refused-c0'); assert.equal(join.outputD1.status, 'refused-c0'); assert.equal(join.relativeDerivativeDifference, null);
const generatedIndex = main.result.provenance.coefficientResult.spans[0].generated[0].outputPoleIndex;
assert.ok(!main.result.provenance.coefficientResult.copiedPoles.some(m => m.outputPoleIndex === generatedIndex));
const editRequest = { source: main.result.source, sourceVersion: 0, curveId: main.result.curve.id, edits: { poleEdits: [{ index: generatedIndex, xMM: main.result.curve.controlPoints[generatedIndex][0] + .25 }] } };
const edit = editSourceCurveControlPolygon(editRequest); assert.deepEqual(validateSourceCurveControlPolygonEdit(edit), edit.report);
assert.ok(edit.report.maximumObservedChangeMM > 0); assert.notEqual(edit.source, main.result.source);
assert.deepEqual(edit.curve.knots, main.result.curve.knots); assert.deepEqual(edit.curve.weights, main.result.curve.weights);
assert.equal(edit.curve.id, main.result.curve.id); assert.equal(edit.curve.degree, 4);
for (let i = 0; i < edit.curve.controlPoints.length; i++) if (i !== generatedIndex) assert.deepEqual(edit.curve.controlPoints[i], main.result.curve.controlPoints[i]);
for (const i of [0, 2]) assert.deepEqual(edit.model.objects[i], main.result.model.objects[i]);
sourceFile('actual1134-generated-pole-edit', edit.source, edit.model); jsonFile('actual1134-generated-pole-edit.request', editRequest); jsonFile('actual1134-generated-pole-edit.result', edit);
const edited = positive('edited-quartic-to-quintic', requestFor(edit.source, edit.curve.id, 5), [6, 12, 5, 10, 0], false);
assert.deepEqual(edited.result.originalCurve, edit.curve); assert.deepEqual(edited.result.originalModel, edit.model);
const t = 1.5, originalPoint = evaluateCurve(main.result.curve, t), changedPoint = evaluateCurve(edited.result.curve, t);
assert.ok(Math.hypot(...changedPoint.map((v, i) => v - originalPoint[i])) > 0);
function capacityCurve(spans, id) {
  return curve(id, 2, [...Array(3).fill(-0), ...Array.from({ length: spans - 1 }, (_, i) => Array(2).fill(i + 1)).flat(), ...Array(3).fill(spans)], Array.from({ length: 2 * spans + 1 }, (_, i) => [i / 2, -0, i / 16]), Array(2 * spans + 1).fill(1));
}
const capCurve = capacityCurve(21, 'capacity_quadratic_chain');
const capacity = positive('capacity-quadratic-21-span', requestFor(mixedSource(capCurve), capCurve.id, 3), [64, 68, 85, 130, 40], false);
assert.equal(capacity.result.provenance.coefficientResult.spans.length, 21);
assert.equal(capacity.result.provenance.coefficientResult.copiedPoles.length, 22);
assert.equal(capacity.result.provenance.coefficientResult.spans.reduce((n, s) => n + s.generated.length, 0), 42);
assert.equal(cases.reduce((n, c) => n + c.idealCoefficientCount, 0), 68);
assert.equal(cases.reduce((n, c) => n + c.directCounts.decimalEmissionCount, 0), 455);
assert.equal(cases.reduce((n, c) => n + c.directCounts.curveD0Count, 0), 208);
assert.equal(cases.reduce((n, c) => n + c.directCounts.curveD1AttemptCount, 0), 208);
assert.equal(cases.reduce((n, c) => n + c.directCounts.curveD1EvaluatedCount, 0), 166);
assert.equal(cases.reduce((n, c) => n + c.directCounts.curveD1RefusedCount, 0), 42);
const owned = structuredClone(main.result), ownReport = validate(owned); ownership([owned], ownReport); assert.deepEqual(ownReport, main.result.report);
function intact() {
  for (const row of retained) assert.deepEqual(row.value, row.before);
  for (const row of accepted) assert.deepEqual(row.result, row.beforeResult);
  for (const [file, bytes] of files) assert.deepEqual(readFileSync(file), bytes, file);
}
function reject(name, action, code) {
  assert.throws(action, error => {
    assert.ok(error instanceof InsertionError); assert.equal(error.code, code, name); assert.ok(error.message.length <= 1024);
    failures.push({ name, code: error.code, message: error.message, causeName: error.cause?.name ?? null, causeCode: error.cause?.code ?? null, causeMessage: error.cause?.message ?? null });
    intact(); return true;
  });
}
const over = capacityCurve(22, 'overcapacity_quadratic_chain'), overSource = mixedSource(over), overCold = compileCadModel(overSource, { sourceVersion: 0 });
assert.equal(overCold.ok, true); assert.deepEqual(overCold.model.objects[1], over);
sourceFile('native-original45-output67-knots71', overSource, overCold.model);
reject('actual-quadratic22-span-dimension-refusal', () => elevate(requestFor(overSource, over.id, 3)), 'BUDGET');
const lowerBasis = curve('native_lower_multiplicity', 4, [...Array(5).fill(-2), ...Array(3).fill(-0), ...Array(5).fill(3)], Array.from({ length: 8 }, (_, i) => [2 * i, i / 4, i * i / 4]), Array(8).fill(1));
const lowerSource = mixedSource(lowerBasis), lowerCold = compileCadModel(lowerSource, { sourceVersion: 0 }); assert.equal(lowerCold.ok, true);
sourceFile('genuine-native-lower-multiplicity', lowerSource, lowerCold.model);
reject('unsupported-native-lower-multiplicity', () => elevate(requestFor(lowerSource, lowerBasis.id, 5)), 'BASIS');
reject('degree5-input-not-elevated', () => elevate(requestFor(chain.result.source, chain.result.curve.id, 5)), 'DEGREE');
reject('skipped-degree-step', () => elevate({ ...main.request, targetDegree: 5 }), 'DEGREE');
reject('fixed-observation-budget', () => elevate({ ...main.request, maximumObservations: 127 }), 'BUDGET');
reject('wrong-source-version', () => elevate({ ...main.request, sourceVersion: 1 }), 'VERSION');
reject('missing-target', () => elevate({ ...main.request, curveId: 'missing_curve' }), 'TARGET');
reject('surface-target', () => elevate({ ...main.request, curveId: 'unused_surface' }), 'TARGET');
reject('invalid-selector', () => elevate({ ...main.request, curveId: 'bad curve' }), 'IDENTITY');
reject('extra-request-field', () => elevate({ ...main.request, elevations: 1 }), 'INPUT');
const mixedZero = structuredClone(mainCurve); mixedZero.knots[0] = +0;
const zeroSource = mixedSource(mixedZero), zeroCold = compileCadModel(zeroSource, { sourceVersion: 0 }); assert.equal(zeroCold.ok, true);
sourceFile('native-valid-mixed-zero-block', zeroSource, zeroCold.model);
reject('mixed-clamp-zero-bits', () => elevate(requestFor(zeroSource, mixedZero.id, 4)), 'BASIS');
const sourceAST = compileCadModel(main.request.source, { sourceVersion: 0 }); assert.equal(sourceAST.ok, true);
const declaration = sourceAST.ast.declarations.find(d => d.kind === 'curve' && d.id === main.request.curveId);
const arrayStart = declaration.fields.find(f => f.name === 'control-points').value.range.start;
const commented = main.request.source.slice(0, arrayStart + 1) + '/* protected selected array */' + main.request.source.slice(arrayStart + 1);
const commentCold = compileCadModel(commented, { sourceVersion: 0 }); assert.equal(commentCold.ok, true); assert.deepEqual(commentCold.model, main.result.originalModel);
sourceFile('genuine-protected-array-comment', commented, commentCold.model);
reject('protected-array-comment', () => elevate({ ...main.request, source: commented }), 'TARGET');
const wideSpan = curve('nonfinite_represented_span', 1, [-Number.MAX_VALUE, -Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE], [[0, 0, 0], [1, 2, 3]], [1, 1]);
const wideSource = mixedSource(wideSpan), wideCold = compileCadModel(wideSource, { sourceVersion: 0 }); assert.equal(wideCold.ok, true);
sourceFile('native-valid-nonfinite-span', wideSource, wideCold.model);
reject('nonfinite-represented-full-span', () => elevate(requestFor(wideSource, wideSpan.id, 2)), 'REPRESENTABILITY');
const norm = curve('finite_component_infinite_norm', 1, [0, 0, 8e-307, 8e-307], [[-50, -50, -50], [50, 50, 50]], [1, 1]);
const normSource = mixedSource(norm), normCold = compileCadModel(normSource, { sourceVersion: 0 }); assert.equal(normCold.ok, true);
sourceFile('genuine-finite-component-norm-source', normSource, normCold.model);
let normError;
try { elevate(requestFor(normSource, norm.id, 2)); } catch (error) { normError = error; }
assert.ok(normError instanceof InsertionError); assert.ok(['REPRESENTABILITY', 'NATIVE'].includes(normError.code));
failures.push({ name: 'actual-finite-component-norm-or-prior-native-refusal', code: normError.code, message: normError.message, causeName: normError.cause?.name ?? null, causeMessage: normError.cause?.message ?? null }); intact();
let getterCalls = 0;
const getterRequest = { ...main.request }; Object.defineProperty(getterRequest, 'targetDegree', { enumerable: true, get() { getterCalls++; return 4; } });
reject('request-getter', () => elevate(getterRequest), 'INPUT'); assert.equal(getterCalls, 0);
const hidden = { ...main.request }; Object.defineProperty(hidden, 'hidden', { value: 1 }); reject('hidden-request', () => elevate(hidden), 'INPUT');
const symbol = { ...main.request }; symbol[Symbol('extra')] = 1; reject('symbol-request', () => elevate(symbol), 'INPUT');
const sparse = { ...main.request, extra: [1, 2] }; delete sparse.extra[0]; reject('sparse-request-data', () => elevate(sparse), 'INPUT');
const cyclic = { ...main.request }; cyclic.cycle = cyclic; reject('cyclic-request', () => elevate(cyclic), 'INPUT');
const foreign = { ...main.request }; Object.setPrototypeOf(foreign, Date.prototype); reject('foreign-request', () => elevate(foreign), 'INPUT');
reject('nonfinite-target', () => elevate({ ...main.request, targetDegree: Infinity }), 'INPUT');
for (const [name, base, mutate] of [
  ['request-source', main.result, r => { r.request.source += ' '; }],
  ['candidate-source', main.result, r => { r.source += ' '; }],
  ['original-sibling', main.result, r => { r.originalModel.objects[0].controlPoints[0][0] = .125; }],
  ['candidate-model', main.result, r => { r.model.objects[1].degree++; }],
  ['degree-provenance', main.result, r => { r.provenance.targetDegree++; }],
  ['degree-patch', main.result, r => { r.provenance.patches.find(p => p.field === 'degree').replacementText = '5'; }],
  ['patch-range', main.result, r => { r.provenance.patches[0].startUTF16++; }],
  ['generated-contribution', main.result, r => { r.provenance.coefficientResult.spans[0].generated[0].leftContribution[0] += .125; }],
  ['lifted-original', main.result, r => { r.provenance.coefficientResult.liftedOriginalHomogeneous[0][0] += .125; }],
  ['span-index-map', main.result, r => { r.provenance.coefficientResult.spans[0].outputPoleIndices[1]++; }],
  ['copied-join', chain.result, r => { r.provenance.coefficientResult.copiedPoles[1].outputPoleIndex++; }],
  ['added-knot-bit', chain.result, r => { r.provenance.coefficientResult.knots.find(k => k.originalKnotIndex === null && k.value === 0).value = +0; }],
  ['native-point', main.result, r => { r.report.observations[0].pointMM[0] += .125; }],
  ['actual-c0-reason', chain.result, r => { r.report.observations.find(o => o.originalD1.status === 'refused-c0').originalD1.reason += ' changed'; }],
  ['counter', main.result, r => { r.report.directCounts.generatedPoleCount++; }],
  ['file-size', main.result, r => { r.report.fileSizes.result.utf8++; }],
  ['false-global-claim', main.result, r => { r.report.quality.globalShapeErrorCertified = true; }]
]) {
  const changed = structuredClone(base), before = nativeJSON(changed); mutate(changed);
  assert.notEqual(nativeJSON(changed), before, 'Non-noop owned control ' + name);
  reject('owned-' + name, () => validate(changed), 'OWNED');
}
let previous = main.result;
reject('atomic-prior-object', () => { previous = elevate(requestFor(overSource, over.id, 3)); }, 'BUDGET'); assert.strictEqual(previous, main.result);
jsonFile('atomic-retention', { callerAndPreviousResultsAndFilesRetained: true, getterCalls, noPartialResultPublished: true });
const packageRoot = resolve(repo, 'packages/barocss-cad'), manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.publishConfig?.exports?.['.'] ?? manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types), leafDeclarationPath = resolve(packageRoot, 'dist/nurbs/source-wide/source-curve-degree-elevation.d.ts');
const publicAPI = await import(pathToFileURL(runtimePath).href);
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.SourceCurveDegreeElevationDiagnosticCode, codes);
assert.equal(publicAPI.elevateC0BezierChainCoefficientsTrusted, undefined);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./nurbs/source-wide/source-curve-degree-elevation.js'));
for (const name of [...runtimeNames, ...typeNames]) assert.ok(readFileSync(leafDeclarationPath, 'utf8').includes(name), name);
const currentRequest = JSON.parse(readFileSync(cases[0].requestFile, 'utf8')), currentResult = JSON.parse(readFileSync(cases[0].resultFile, 'utf8'));
assert.deepEqual(publicAPI.elevateSourceCurveDegree(currentRequest), currentResult);
assert.deepEqual(publicAPI.validateSourceCurveDegreeElevation(currentResult), currentResult.report);
for (const [source, model] of [[currentRequest.source, currentResult.originalModel], [currentResult.source, currentResult.model]]) {
  const cold = publicAPI.compileCadModel(source, { sourceVersion: 0 }); assert.equal(cold.ok, true); assert.deepEqual(cold.model, model);
}
const emittedArtifacts = ['index.js', 'index.d.ts', 'nurbs/source-wide/source-curve-degree-elevation.js', 'nurbs/source-wide/source-curve-degree-elevation.d.ts', 'nurbs/curves/curve-c0-degree-elevation-internal.js', 'nurbs/curves/curve-c0-degree-elevation-internal.d.ts'].map(name => {
  const path = resolve(packageRoot, 'dist', name); assert.ok(existsSync(path)); const bytes = readFileSync(path);
  return { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
});
const compiledConsumer = { runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 8, currentMainReplayCount: 1, privateHelperBarrelExported: false, emittedArtifacts };
jsonFile('compiled-consumer', compiledConsumer); intact(); assert.equal(cases.length, 4);
const summary = { sourceMode: true, cases, failures, compiledConsumer, getterCalls, actual1134GeneratedPoleIndex: generatedIndex, fullIdealCoefficientCount: 68, fullIdealCampaignCases: ['main', 'nonuniform-quartic-c0'], work, nativeWorkScope: 'Initial constructor reports; oracle, owned, cold, edit and public replays are additional real work.', scope: 'Complete-source one-step rational C0 Bernstein-chain elevation. Ideal polynomial identity, stored coefficient rounding and native observations remain separate. No general lower-multiplicity elevation, smoothness/G1/G2, topology/Body/Solid/global error/editor/manufacturing/publication claim.' };
jsonFile('summary', summary); intact(); console.log(JSON.stringify(summary));
