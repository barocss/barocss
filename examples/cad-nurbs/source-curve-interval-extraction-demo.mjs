import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node source-curve-interval-extraction-demo.mjs --source <output-directory>');
assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]);
mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const esbuild = require('esbuild'), entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundle = await esbuild.build({ absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
assert.equal(bundle.outputFiles.length, 1);
const sourceInputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path));
const cadInputs = sourceInputs.filter(path => path.includes('/packages/barocss-cad/'));
for (const leaf of ['source-curve-interval-extraction.ts', 'curve-knot-insertion.ts', 'source-curve-control-polygon.ts', 'index.ts']) assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const {
  extractSourceCurveInterval: extract, validateSourceCurveIntervalExtraction: validate,
  SourceCurveIntervalExtractionError: InsertionError, SourceCurveIntervalExtractionDiagnosticCode: codes,
  compileCadModel, evaluateCurve, evaluateCurveD1, editSourceCurveControlPolygon,
  validateSourceCurveControlPolygonEdit, insertCurveKnot: oldInsert
} = api;
const runtimeNames = ['extractSourceCurveInterval', 'validateSourceCurveIntervalExtraction', 'SourceCurveIntervalExtractionError', 'SourceCurveIntervalExtractionDiagnosticCode'];
const typeNames = ['SourceCurveIntervalExtractionRequest', 'SourceCurveIntervalExtractionPatch', 'SourceCurveIntervalExtractionReport', 'SourceCurveIntervalExtractionResult'];
for (const name of runtimeNames) assert.equal(typeof api[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(Object.keys(codes).sort(), ['INPUT', 'VERSION', 'IDENTITY', 'SOURCE', 'TARGET', 'INTERVAL', 'BUDGET', 'REPRESENTABILITY', 'BINDING', 'NATIVE', 'OWNED', 'FILE'].sort());
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
      for (let k = 0; k <= before.degree; k++) {
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
function refineOracle(input, inputH, knot, count, calculation) {
  let U = input.knots.slice(), H = inputH.map(p => p.slice());
  let nativeH = input.controlPoints.map((p, i) => [...p.map(v => v * input.weights[i]), input.weights[i]]);
  let origins = input.controlPoints.map((_, i) => i), knotOrigins = U.map((_, i) => i);
  const generatedSummaries = [];
  for (let insertion = 0; insertion < count; insertion++) {
    const p = input.degree, s = U.filter(v => v === knot).length, n = H.length - 1;
    let span = -1;
    for (let i = p; i <= n; i++) if (U[i] <= knot && knot < U[i + 1]) span = i;
    assert.ok(span >= p);
    const next = Array(H.length + 1), nextNative = Array(H.length + 1), nextOrigins = Array(H.length + 1).fill(null);
    for (let i = 0; i <= span - p; i++) { next[i] = H[i]; nextNative[i] = nativeH[i]; nextOrigins[i] = origins[i]; }
    for (let i = span - s; i <= n; i++) { next[i + 1] = H[i]; nextNative[i + 1] = nativeH[i]; nextOrigins[i + 1] = origins[i]; }
    const actualStep = calculation.steps[insertion], homogeneousStep = calculation.homogeneousSteps[insertion];
    assert.equal(actualStep.insertion, insertion + 1);
    assert.equal(actualStep.spanIndex, span);
    assert.equal(actualStep.priorMultiplicity, s);
    assert.equal(homogeneousStep.insertion, insertion + 1);
    assert.equal(homogeneousStep.spanIndex, span);
    assert.equal(homogeneousStep.priorMultiplicity, s);
    const expectedGenerated = [], expectedHomogeneous = [];
    for (let i = span - p + 1; i <= span - s; i++) {
      const alpha = divide(sub(represented(knot), represented(U[i])), sub(represented(U[i + p]), represented(U[i])));
      const storedAlpha = (knot - U[i]) / (U[i + p] - U[i]);
      next[i] = H[i].map((v, axis) => add(mul(alpha, v), mul(sub(o, alpha), H[i - 1][axis])));
      nextNative[i] = nativeH[i].map((v, axis) => storedAlpha * v + (1 - storedAlpha) * nativeH[i - 1][axis]);
      expectedGenerated.push({ refinedPoleIndex: i, leftPriorPoleIndex: i - 1, rightPriorPoleIndex: i, alpha: storedAlpha });
      expectedHomogeneous.push({ ...expectedGenerated.at(-1), left: nativeH[i - 1], right: nativeH[i], generated: nextNative[i] });
      generatedSummaries.push({ insertion: insertion + 1, index: i, idealAlpha: asDTO(alpha), storedAlphaResidual: asDTO(sub(represented(storedAlpha), alpha)), actualHResidual: nextNative[i].map((v, axis) => asDTO(sub(represented(v), next[i][axis]))) });
    }
    assert.deepEqual(actualStep.generatedPoles, expectedGenerated);
    assert.deepEqual(homogeneousStep.generatedPoles, expectedHomogeneous);
    H = next; nativeH = nextNative; origins = nextOrigins;
    U = [...U.slice(0, span + 1), knot, ...U.slice(span + 1)];
    knotOrigins = [...knotOrigins.slice(0, span + 1), null, ...knotOrigins.slice(span + 1)];
  }
  const candidate = { ...input, knots: U, controlPoints: nativeH.map((h, i) => origins[i] === null ? h.slice(0, 3).map(v => v / h[3]) : input.controlPoints[origins[i]].slice()), weights: nativeH.map((h, i) => origins[i] === null ? h[3] : input.weights[origins[i]]) };
  const poleMaps = origins.flatMap((v, i) => v === null ? [] : [{ originalPoleIndex: v, refinedPoleIndex: i }]);
  const knotMaps = knotOrigins.flatMap((v, i) => v === null ? [] : [{ originalKnotIndex: v, refinedKnotIndex: i }]);
  if (count) {
    assert.deepEqual(calculation.candidate, candidate);
    assert.deepEqual(calculation.unchangedPoles, poleMaps);
    assert.deepEqual(calculation.unchangedKnots, knotMaps);
  } else assert.equal(calculation, null);
  return { candidate, H, origins, knotOrigins, generatedSummaries };
}
function independentChild(refined, H, knot, side, id) {
  const F = refined.knots.findIndex(v => v === knot), C = F - 1;
  const offset = side === 'lower' ? 0 : C, count = side === 'lower' ? C + 1 : refined.controlPoints.length - C;
  const poles = Array.from({ length: count }, (_, i) => ({ refinedPoleIndex: offset + i, childPoleIndex: i }));
  const knots = side === 'lower'
    ? [...refined.knots.slice(0, F + refined.degree).map((value, i) => ({ childKnotIndex: i, refinedKnotIndex: i, value, origin: 'refined-copy' })), { childKnotIndex: F + refined.degree, refinedKnotIndex: null, value: knot, origin: 'requested-clamp' }]
    : [{ childKnotIndex: 0, refinedKnotIndex: null, value: knot, origin: 'requested-clamp' }, ...refined.knots.slice(F).map((value, i) => ({ childKnotIndex: i + 1, refinedKnotIndex: F + i, value, origin: 'refined-copy' }))];
  return {
    curve: { ...refined, id, knots: knots.map(m => m.value), controlPoints: poles.map(m => refined.controlPoints[m.refinedPoleIndex].slice()), weights: poles.map(m => refined.weights[m.refinedPoleIndex]) },
    H: poles.map(m => H[m.refinedPoleIndex]), maps: { poles, knots }, F, C
  };
}
function idealOracle(result) {
  let actual = result.originalCurve, idealH = lift(actual);
  let poleLineage = actual.controlPoints.map((_, i) => i), knotLineage = actual.knots.map((_, i) => i);
  const stages = [];
  const originalDomain = domain(actual), choices = result.request.interval.map((requested, i) => ({ boundary: i ? 'end' : 'start', requested, effective: requested === originalDomain[i] ? originalDomain[i] : requested, origin: requested === originalDomain[i] ? 'original-domain-endpoint' : 'interior-request', adoptedOriginalEndpointBits: requested === originalDomain[i] }));
  assert.deepEqual(result.provenance.boundaries, choices);
  let helperCalls = 0, inserted = 0, maximumPoles = actual.controlPoints.length, maximumKnots = actual.knots.length;
  const plans = [];
  for (const [index, stage] of result.provenance.stages.entries()) {
    assert.equal(stage.index, index);
    assert.deepEqual(stage.input, actual);
    const required = actual.degree - actual.knots.filter(v => v === stage.parameter).length;
    assert.equal(stage.refinement.insertions, required);
    assert.equal(stage.refinement.kind, required ? 'knot-insertion' : 'direct-copy');
    const refined = refineOracle(actual, idealH, stage.parameter, required, stage.refinement.calculation);
    assert.deepEqual(stage.refined, refined.candidate);
    const lower = independentChild(refined.candidate, refined.H, stage.parameter, 'lower', stage.lower.id);
    const upper = independentChild(refined.candidate, refined.H, stage.parameter, 'upper', stage.upper.id);
    assert.deepEqual(stage.lower, lower.curve); assert.deepEqual(stage.upper, upper.curve);
    assert.deepEqual(stage.lowerMaps, lower.maps); assert.deepEqual(stage.upperMaps, upper.maps);
    assert.equal(stage.firstRefinedKnotIndex, lower.F);
    assert.deepEqual(stage.shared, { refinedPoleIndex: lower.C, lowerPoleIndex: lower.C, upperPoleIndex: 0, pointMM: refined.candidate.controlPoints[lower.C], weight: refined.candidate.weights[lower.C] });
    assert.equal(stage.lower.id, stage.boundary === 'start' ? 'interval_discard_start' : result.originalCurve.id);
    assert.equal(stage.upper.id, stage.boundary === 'end' ? 'interval_discard_end' : result.originalCurve.id);
    const expectedSide = stage.boundary === 'start' ? 'upper' : 'lower';
    assert.equal(stage.retainedSide, expectedSide);
    const kept = expectedSide === 'upper' ? upper : lower;
    const lowerProof = residualProof(actual, idealH, lower.curve, lower.H, domain(lower.curve), true);
    const upperProof = residualProof(actual, idealH, upper.curve, upper.H, domain(upper.curve), true);
    const localRefined = refineOracle(actual, lift(actual), stage.parameter, required, stage.refinement.calculation);
    const localStored = residualProof(actual, lift(actual), refined.candidate, lift(refined.candidate), domain(actual), false);
    const inheritedStored = residualProof(result.originalCurve, lift(result.originalCurve), kept.curve, lift(kept.curve), domain(kept.curve), false);
    stages.push({ index, requiredInsertions: required, generated: refined.generatedSummaries, localGenerated: localRefined.generatedSummaries, lowerProof, upperProof, localStored, inheritedStored });
    plans.push({ index, boundary: stage.boundary, parameter: stage.parameter, retainedSide: expectedSide, input: basis(actual), requiredInsertions: required, refined: basis(refined.candidate), firstRefinedKnotIndex: lower.F, sharedRefinedPoleIndex: lower.C, lower: basis(lower.curve), upper: basis(upper.curve) });
    poleLineage = kept.maps.poles.map(m => { const origin = refined.origins[m.refinedPoleIndex]; return origin === null ? null : poleLineage[origin]; });
    knotLineage = kept.maps.knots.map(m => { if (m.refinedKnotIndex === null) return null; const origin = refined.knotOrigins[m.refinedKnotIndex]; return origin === null ? null : knotLineage[origin]; });
    helperCalls += required ? 1 : 0; inserted += required;
    maximumPoles = Math.max(maximumPoles, refined.candidate.controlPoints.length); maximumKnots = Math.max(maximumKnots, refined.candidate.knots.length);
    actual = kept.curve; idealH = kept.H;
  }
  assert.deepEqual(result.curve, actual);
  const interval = choices.map(c => c.effective);
  assert.deepEqual(domain(result.curve), interval);
  assert.deepEqual(result.provenance.plan, { effectiveInterval: interval, stages: plans, output: basis(actual), helperCallCount: helperCalls, insertedKnotCount: inserted, maximumTemporaryPoles: maximumPoles, maximumTemporaryKnots: maximumKnots });
  assert.deepEqual(result.provenance.unchangedPoles, poleLineage.flatMap((v, i) => v === null ? [] : [{ originalPoleIndex: v, outputPoleIndex: i }]));
  assert.deepEqual(result.provenance.unchangedKnots, knotLineage.flatMap((v, i) => v === null ? [] : [{ originalKnotIndex: v, outputKnotIndex: i }]));
  assert.deepEqual(result.provenance.parameterMap, { kind: 'identity', formula: 'u=t', d1Factor: 1 });
  const ideal = residualProof(result.originalCurve, lift(result.originalCurve), result.curve, idealH, interval, true);
  const stored = residualProof(result.originalCurve, lift(result.originalCurve), result.curve, lift(result.curve), interval, false);
  const summary = { idealWholeRestrictedHomogeneousIdentity: true, ideal, stored, actualStoredExact: stored.nonzero === 0, stages, secondTemporaryOverflow: 'unreachable-after-first-fit-retained-upper-count-theorem' };
  let dtoValues = 0;
  const countDTO = v => { if (v && typeof v === 'object') { if (Object.hasOwn(v, 'numerator')) dtoValues++; Object.values(v).forEach(countDTO); } };
  countDTO(summary); assert.ok(dtoValues <= work.maximumDTOValues); summary.fractionDTOCount = dtoValues;
  return summary;
}
function stationOracle(result) {
  const interval = domain(result.curve), values = interval.slice();
  const sources = [result.originalCurve, ...result.provenance.stages.flatMap(s => [s.refined, s[s.retainedSide]]), result.curve];
  const addValue = v => { if (v >= interval[0] && v <= interval[1] && !values.some(x => x === v)) values.push(v); };
  for (const c of sources) {
    const breaks = distinct(c.knots.filter(v => v >= domain(c)[0] && v <= domain(c)[1]));
    for (let i = 0; i < breaks.length; i++) {
      addValue(breaks[i]);
      if (i + 1 < breaks.length) {
        if (breaks[i] >= interval[1] || breaks[i + 1] <= interval[0]) continue;
        const width = breaks[i + 1] - breaks[i], mid = breaks[i] + width / 2;
        assert.ok(Number.isFinite(width) && width > 0 && mid > breaks[i] && mid < breaks[i + 1]); addValue(mid);
      }
    }
  }
  return values.sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
}
function d1State(c, parameter) {
  try { return { status: 'evaluated', value: evaluateCurveD1(c, parameter) }; }
  catch (error) { assert.ok(error instanceof Error); assert.match(error.message, /exact C0 interior knot/); return { status: 'refused-c0', name: error.name, reason: error.message, value: null }; }
}
function relative(a, b) {
  if (a.status !== 'evaluated' || b.status !== 'evaluated') return null;
  const delta = Math.hypot(...b.value.derivative.map((v, i) => v - a.value.derivative[i]));
  const na = Math.hypot(...a.value.derivative), nb = Math.hypot(...b.value.derivative), scale = Math.max(1, na, nb);
  assert.ok([delta, na, nb, scale].every(Number.isFinite)); return delta / scale;
}
function nativeOracle(result) {
  let evaluated = 0, refused = 0;
  function sample(c, parameter) {
    const d0 = evaluateCurve(c, parameter), d1 = d1State(c, parameter), exact = exactPointDerivative(c, parameter);
    for (let axis = 0; axis < 3; axis++) {
      assert.ok(compare(abs(sub(represented(d0[axis]), exact.point[axis])), represented(1e-7)) <= 0);
      if (d1.status === 'evaluated') assert.ok(compare(abs(sub(represented(d1.value.derivative[axis]), exact.derivative[axis])), mul(represented(1e-7), add(o, abs(exact.derivative[axis])))) <= 0);
    }
    if (d1.status === 'evaluated') evaluated++; else refused++;
    return { d0, d1 };
  }
  const cutWitnesses = result.provenance.stages.map(stage => {
    const states = Object.fromEntries(['input', 'refined', 'lower', 'upper'].map(role => [role, sample(stage[role], stage.parameter)]));
    const roles = Object.values(states); let maximum = 0;
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) maximum = Math.max(maximum, Math.hypot(...roles[j].d0.map((v, k) => v - roles[i].d0[k])));
    const witness = { parameter: stage.parameter, ...states, maximumPointDifferenceMM: maximum, relativeInputLowerDifference: relative(states.input.d1, states.lower.d1), relativeInputUpperDifference: relative(states.input.d1, states.upper.d1), relativeLowerUpperDifference: relative(states.lower.d1, states.upper.d1) };
    assert.equal(states.refined.d1.status, 'refused-c0'); assert.equal(states.lower.d1.status, 'evaluated'); assert.equal(states.upper.d1.status, 'evaluated');
    assert.ok(maximum <= 1e-7); assert.ok(Number.isFinite(witness.relativeLowerUpperDifference));
    if (states.input.d1.status === 'evaluated') for (const v of [witness.relativeInputLowerDifference, witness.relativeInputUpperDifference, witness.relativeLowerUpperDifference]) assert.ok(v <= 1e-7);
    assert.deepEqual(stage.witness, witness); return witness;
  });
  const parameters = stationOracle(result), observations = parameters.map(parameter => {
    const original = sample(result.originalCurve, parameter), outputState = sample(result.curve, parameter);
    const pointDifferenceMM = Math.hypot(...outputState.d0.map((v, i) => v - original.d0[i]));
    const relativeDerivativeDifference = relative(original.d1, outputState.d1);
    assert.ok(pointDifferenceMM <= 1e-7 && (relativeDerivativeDifference === null || relativeDerivativeDifference <= 1e-7));
    return { parameter, originalPointMM: original.d0, pointMM: outputState.d0, pointDifferenceMM, originalD1: original.d1, outputD1: outputState.d1, relativeDerivativeDifference };
  });
  assert.deepEqual(result.report.stations, parameters); assert.deepEqual(result.report.observations, observations);
  assert.equal(result.report.maximumPointDifferenceMM, Math.max(...observations.map(v => v.pointDifferenceMM)));
  assert.equal(result.report.maximumRelativeDerivativeDifference, Math.max(...observations.map(v => v.relativeDerivativeDifference ?? 0)));
  assert.equal(result.report.maximumCutPointDifferenceMM, Math.max(...cutWitnesses.map(v => v.maximumPointDifferenceMM)));
  return { count: parameters.length, evaluated, refused, cutWitnesses, observations };
}

function mixedSource(c) {
  const list = values => '[ ' + values.map(decimal).join(' , ') + ' ]';
  const points = values => '[\r\n' + values.map(list).join(' ,\r\n') + '\r\n]';
  return '/* complete original π source; preserve CRLF and comments */\r\n' +
    '@model interval_model { version:0; length-unit:mm;\r\n' +
    '@curve #interval_discard_start {type:nurbs;degree:1;knots:[-0,/* sibling comment */-0,+1.000,1];control-points:[[-0,-0,-0],[+2.000,3,4]];weights:[1.000,1];}\r\n' +
    '@curve #' + c.id + ' { /* selected metadata stays unchanged */ type:nurbs;degree:' + c.degree + ';\r\n' +
    'weights:' + list(c.weights) + ';\r\ncontrol-points:' + points(c.controlPoints) + ';\r\nknots:' + list(c.knots) + ';}\r\n' +
    '@surface #unused_surface {type:nurbs;degree-u:1;degree-v:1;knots-u:[-0,-0,1,1];knots-v:[0,0,1,1];control-points:[[[-0,-0,0],[0,1,0]],[[1,0,0],[1,1,0]]];weights:[[1,1],[1,1]];}\r\n' +
    '/* unchanged Ω ending */\r\n}\r\n';
}
function sourceOracle(result) {
  const cold = compileCadModel(result.request.source, { sourceVersion: 0 });
  assert.equal(cold.ok, true, JSON.stringify(cold.diagnostics)); assert.deepEqual(cold.model, result.originalModel);
  const index = cold.model.objects.findIndex(o => o.id === result.request.curveId);
  assert.equal(index, 1); assert.equal(result.provenance.selectedObjectIndex, index);
  assert.deepEqual(cold.model.objects[index], result.originalCurve);
  const declaration = cold.ast.declarations.find(d => d.kind === 'curve' && d.id === result.request.curveId);
  const patches = result.provenance.patches;
  assert.equal(patches.length, 3); assert.deepEqual(patches.map(p => p.field).sort(), ['control-points', 'knots', 'weights']);
  const canonicalList = values => '[' + values.map(value => {
    const text = decimal(value); assert.ok(text.length <= 512 && Object.is(Number(text), value)); return text;
  }).join(',') + ']';
  const replacement = { knots: canonicalList(result.curve.knots), weights: canonicalList(result.curve.weights), 'control-points': '[' + result.curve.controlPoints.map(canonicalList).join(',') + ']' };
  function bind(node, value, outerStart, outerEnd) {
    assert.ok(node.range.start >= outerStart && node.range.end <= outerEnd && node.range.start < node.range.end);
    if (Array.isArray(value)) {
      assert.equal(node.kind, 'array'); assert.equal(node.items.length, value.length);
      node.items.forEach((child, i) => bind(child, value[i], node.range.start, node.range.end));
    } else {
      assert.equal(node.kind, 'number');
      const lexeme = result.request.source.slice(node.range.start, node.range.end);
      assert.match(lexeme, /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/);
      assert.ok(Object.is(Number(lexeme), node.value) && Object.is(node.value, value));
    }
  }
  let last = 0, shift = 0;
  for (const patch of patches) {
    const node = declaration.fields.find(f => f.name === patch.field).value;
    const originalData = patch.field === 'control-points' ? result.originalCurve.controlPoints : patch.field === 'knots' ? result.originalCurve.knots : result.originalCurve.weights;
    bind(node, originalData, declaration.range.start, declaration.range.end);
    assert.equal(patch.replacementText, replacement[patch.field]);
    assert.equal(patch.startUTF16, node.range.start); assert.equal(patch.endUTF16, node.range.end);
    assert.ok(patch.startUTF16 >= last);
    assert.equal(patch.originalText, result.request.source.slice(patch.startUTF16, patch.endUTF16));
    const before = result.request.source.slice(last, patch.startUTF16), after = result.source.slice(last + shift, patch.startUTF16 + shift);
    assert.equal(before, after); assert.deepEqual(Buffer.from(before), Buffer.from(after));
    assert.equal(result.source.slice(patch.startUTF16 + shift, patch.startUTF16 + shift + patch.replacementText.length), patch.replacementText);
    shift += patch.replacementText.length - (patch.endUTF16 - patch.startUTF16); last = patch.endUTF16;
  }
  assert.equal(result.request.source.slice(last), result.source.slice(last + shift));
  let applied = result.request.source;
  for (const patch of patches.slice().reverse()) applied = applied.slice(0, patch.startUTF16) + patch.replacementText + applied.slice(patch.endUTF16);
  assert.equal(applied, result.source);
  const candidate = compileCadModel(result.source, { sourceVersion: 0 });
  assert.equal(candidate.ok, true, JSON.stringify(candidate.diagnostics)); assert.deepEqual(candidate.model, result.model);
  const expected = structuredClone(cold.model); expected.objects[index] = structuredClone(result.curve);
  assert.deepEqual(candidate.model, expected);
  assert.equal(result.curve.id, result.originalCurve.id); assert.equal(result.curve.degree, result.originalCurve.degree);
  return { selectedObjectIndex: index, threeActualArrayPatches: true, allOutsideUTF16AndUTF8Preserved: true, originalModelHeaderOrderSiblingBitsPreserved: true, privateDiscardedIdCollisionHarmless: true };
}
const requestFor = (source, curveId, interval) => ({ source, sourceVersion: 0, curveId, interval, maximumObservations: 256 });
function positive(name, curve, interval, expected) {
  const source = mixedSource(curve), request = requestFor(source, curve.id, interval);
  const cold = compileCadModel(source, { sourceVersion: 0 });
  assert.equal(cold.ok, true, JSON.stringify(cold.diagnostics)); assert.deepEqual(cold.model.objects[1], curve);
  const originalFile = sourceFile(name + '.original', source, cold.model), requestFile = jsonFile(name + '.request', request);
  const before = structuredClone(request), result = extract(request);
  assert.deepEqual(request, before); ownership([request], result);
  assert.deepEqual(Object.keys(result).sort(), ['request', 'source', 'originalModel', 'model', 'originalCurve', 'curve', 'provenance', 'report'].sort());
  assert.deepEqual(result.request, request);
  const ideal = idealOracle(result), native = nativeOracle(result), sourceProof = sourceOracle(result), report = result.report;
  assert.deepEqual([result.curve.controlPoints.length, native.count, report.coefficientInsertionCallCount, report.insertedKnotCount, native.evaluated, native.refused], expected);
  const c = result.provenance.stages.length, m = native.count;
  assert.deepEqual(report.directCounts, {
    originalCompileCount: 1, candidateCompileCount: 1, cutStageCount: c,
    coefficientInsertionCallCount: expected[2], insertedKnotCount: expected[3],
    nativeCurveValidationCount: 2 + 3 * c, domainQueryCount: 2 + 3 * c,
    patchCount: 3, decimalEmissionCount: 4 * result.curve.controlPoints.length + result.curve.knots.length,
    observationCount: m, cutWitnessCount: c, curveD0Count: 2 * m + 4 * c,
    curveD1AttemptCount: 2 * m + 4 * c, curveD1EvaluatedCount: native.evaluated, curveD1RefusedCount: native.refused,
    sourceWriterCallCount: 0, publicSplitCallCount: 0, publicIntervalCallCount: 0, publicRefinementCallCount: 0, rationalOperationCount: 0
  });
  assert.equal(native.evaluated + native.refused, 2 * m + 4 * c);
  assert.deepEqual(report.sourceSizes, { original: { utf16: source.length, utf8: Buffer.byteLength(source) }, candidate: { utf16: result.source.length, utf8: Buffer.byteLength(result.source) } });
  const sizes = value => ({ utf16: (nativeJSON(value) + '\n').length, utf8: Buffer.byteLength(nativeJSON(value) + '\n') });
  assert.deepEqual(report.fileSizes, { request: sizes(request), result: sizes(result) });
  for (const flag of ['topologyCertified', 'solid', 'globalShapeErrorCertified', 'globalBinary64ErrorCertified', 'g1g2Certified', 'manufacturingToleranceCertified', 'editorDisplayCertified', 'persistentTopologyBindingCertified', 'publication']) assert.equal(report.quality[flag], false);
  assert.equal(report.quality.geometricValidity, 'not-certified'); assert.equal(report.quality.localShapeObservations, true);
  for (const value of Object.values(report.preservation)) assert.equal(value, true);
  const candidateFile = sourceFile(name + '.candidate', result.source, result.model), saved = jsonFile(name + '.result', result);
  jsonFile(name + '.independent-math-oracle', ideal); jsonFile(name + '.independent-native-oracle', native); jsonFile(name + '.independent-source-oracle', sourceProof);
  retained.push({ value: request, before }); accepted.push({ result, beforeResult: structuredClone(result) });
  cases.push({ name, requestFile: requestFile.file, resultFile: saved.file, originalFile, candidateFile, degree: curve.degree, originalPoles: curve.controlPoints.length, outputPoles: expected[0], observations: m, directCounts: report.directCounts, idealCells: ideal.ideal.cells, idealCoefficientCount: ideal.ideal.coefficientCount, actualStoredExact: ideal.actualStoredExact });
  return { request, result, ideal, native };
}
const poles = count => Array.from({ length: count }, (_, i) => [2 * i, (i % 2 ? -1 : 1) * (i + 1), i * i / 4]);
const weights = count => Array.from({ length: count }, (_, i) => i % 2 ? 3 : 1);
const curve = (id, degree, knots, controlPoints, weights) => ({ kind: 'curve', id, degree, knots, controlPoints, weights });
jsonFile('source-api.inputs', { entry, sourceInputs, cadInputs, sourceOnly: true, write: false, esbuildVersion: esbuild.version });
jsonFile('source-api.metafile', bundle.metafile);
const main = positive('main', curve('main_quintic', 5, [...Array(6).fill(-3), -1, 2, ...Array(6).fill(5)], poles(8), weights(8)), [.5, 3.5], [7, 5, 2, 10, 16, 2]);
assert.equal(main.ideal.actualStoredExact, false);
const quartic = positive('quartic', curve('quartic_outer_zero', 4, [...Array(5).fill(-0), ...Array(5).fill(3)], Array.from({ length: 5 }, (_, i) => [2 * i, -0, i * i / 4]), weights(5)), [+0, 1.5], [5, 3, 1, 4, 9, 1]);
assert.ok(Object.is(quartic.request.interval[0], +0)); assert.ok(Object.is(domain(quartic.result.curve)[0], -0));
assert.equal(quartic.result.provenance.boundaries[0].adoptedOriginalEndpointBits, true);
assert.equal(quartic.ideal.actualStoredExact, true);
const c0 = positive('c0', curve('existing_quintic_c0', 5, [...Array(6).fill(-2), ...Array(5).fill(-0), ...Array(6).fill(2)], poles(11), weights(11)), [-0, 2], [6, 3, 0, 0, 7, 3]);
assert.equal(c0.ideal.actualStoredExact, true);
assert.equal(c0.result.provenance.stages[0].witness.input.d1.status, 'refused-c0');
assert.ok(c0.result.provenance.stages[0].witness.relativeLowerUpperDifference > 1e-7, 'Genuine one-sided tangents remain diagnostic');
const c0At = c0.result.report.observations.find(o => o.parameter === 0);
assert.equal(c0At.originalD1.status, 'refused-c0'); assert.equal(c0At.outputD1.status, 'evaluated');
const capacity = positive('capacity', curve('capacity_line', 1, [-0, -0, ...Array.from({ length: 62 }, (_, i) => i + 1), 63, 63], Array.from({ length: 64 }, (_, i) => [i === 0 ? -0 : i, -0, i === 0 ? -0 : i / 8]), Array(64).fill(1)), [1, 62], [62, 123, 0, 0, 128, 126]);
assert.equal(capacity.ideal.actualStoredExact, true);
for (const observation of capacity.result.report.observations) {
  assert.ok(Object.is(observation.originalPointMM[1], -0)); assert.ok(Object.is(observation.pointMM[1], -0));
  for (const state of [observation.originalD1, observation.outputD1]) if (state.status === 'evaluated') assert.ok(Object.is(state.value.derivative[1], +0));
}
assert.equal(cases.reduce((n, c) => n + c.idealCells, 0), 65);
assert.equal(cases.reduce((n, c) => n + c.idealCoefficientCount, 0), 580);
assert.equal(cases.reduce((n, c) => n + c.directCounts.curveD0Count, 0), 292);
assert.equal(cases.reduce((n, c) => n + c.directCounts.curveD1EvaluatedCount, 0), 160);
assert.equal(cases.reduce((n, c) => n + c.directCounts.curveD1RefusedCount, 0), 132);
assert.deepEqual(validate(main.result), main.result.report);
const owned = structuredClone(main.result), ownedReport = validate(owned);
ownership([owned], ownedReport); assert.deepEqual(ownedReport, main.result.report);
const newPoleIndex = main.result.curve.controlPoints.findIndex((_, i) => !main.result.provenance.unchangedPoles.some(m => m.outputPoleIndex === i));
assert.ok(newPoleIndex >= 0);
const editRequest = { source: main.result.source, sourceVersion: 0, curveId: main.result.curve.id, edits: { poleEdits: [{ index: newPoleIndex, xMM: main.result.curve.controlPoints[newPoleIndex][0] + .25 }] } };
const edit = editSourceCurveControlPolygon(editRequest);
assert.deepEqual(validateSourceCurveControlPolygonEdit(edit), edit.report);
assert.notEqual(edit.source, main.result.source); assert.ok(edit.report.maximumObservedChangeMM > 0);
assert.deepEqual(edit.curve.knots, main.result.curve.knots); assert.deepEqual(edit.curve.weights, main.result.curve.weights);
assert.equal(edit.curve.id, main.result.curve.id); assert.equal(edit.curve.degree, 5);
for (let i = 0; i < edit.curve.controlPoints.length; i++) if (i !== newPoleIndex) assert.deepEqual(edit.curve.controlPoints[i], main.result.curve.controlPoints[i]);
assert.deepEqual(edit.model.objects[0], main.result.model.objects[0]); assert.deepEqual(edit.model.objects[2], main.result.model.objects[2]);
sourceFile('actual1134-retained-generated-pole-edit', edit.source, edit.model);
jsonFile('actual1134-retained-generated-pole-edit-request', editRequest); jsonFile('actual1134-retained-generated-pole-edit', edit);
function intact() {
  for (const row of retained) assert.deepEqual(row.value, row.before);
  for (const row of accepted) assert.deepEqual(row.result, row.beforeResult);
  for (const [file, bytes] of files) assert.deepEqual(readFileSync(file), bytes, file);
}
function reject(name, action, code) {
  assert.throws(action, error => {
    assert.ok(error instanceof InsertionError); assert.equal(error.code, code, name); assert.ok(error.message.length <= 1024);
    failures.push({ name, code: error.code, message: error.message, causeName: error.cause?.name ?? null, causeMessage: error.cause?.message ?? null });
    intact(); return true;
  });
}
reject('fixed-observation-budget', () => extract({ ...main.request, maximumObservations: 255 }), 'BUDGET');
reject('wrong-source-version', () => extract({ ...main.request, sourceVersion: 1 }), 'VERSION');
reject('extra-request-field', () => extract({ ...main.request, noOp: true }), 'INPUT');
reject('missing-curve', () => extract({ ...main.request, curveId: 'missing_curve' }), 'TARGET');
reject('surface-target', () => extract({ ...main.request, curveId: 'unused_surface' }), 'TARGET');
for (const [name, interval] of [['full-domain-copy', [-3, 5]], ['empty', [.5, .5]], ['reversed', [3.5, .5]], ['outside', [-4, 3.5]]]) reject(name, () => extract({ ...main.request, interval }), 'INTERVAL');
reject('opposite-existing-interior-zero', () => extract({ ...c0.request, interval: [+0, 2] }), 'INTERVAL');
reject('actual-native64-fresh-cut-needs65', () => extract({ ...capacity.request, interval: [.5, 62] }), 'BUDGET');
const originalAST = compileCadModel(main.request.source, { sourceVersion: 0 }); assert.equal(originalAST.ok, true);
const declaration = originalAST.ast.declarations.find(d => d.kind === 'curve' && d.id === main.request.curveId);
const arrayStart = declaration.fields.find(f => f.name === 'control-points').value.range.start;
const commented = main.request.source.slice(0, arrayStart + 1) + '/* legal selected-array comment */' + main.request.source.slice(arrayStart + 1);
const commentCold = compileCadModel(commented, { sourceVersion: 0 }); assert.equal(commentCold.ok, true); assert.deepEqual(commentCold.model, main.result.originalModel);
sourceFile('genuine-selected-array-comment', commented, commentCold.model);
reject('selected-array-comment', () => extract({ ...main.request, source: commented }), 'TARGET');
const unsafe = curve('unsafe_midpoint', 1, [0, 0, 8, 8], [[0, 0, 0], [1, 2, 3]], [1, 1]);
const unsafeSource = mixedSource(unsafe), unsafeCold = compileCadModel(unsafeSource, { sourceVersion: 0 });
assert.equal(unsafeCold.ok, true); sourceFile('native-valid-unsafe-span', unsafeSource, unsafeCold.model);
reject('genuine-first-stage-unsafe-alpha', () => extract(requestFor(unsafeSource, unsafe.id, [2 * Number.MIN_VALUE, 8])), 'REPRESENTABILITY');
assert.match(failures.at(-1).causeMessage, /strict convex insertion coefficient is not representable/);
const norm = curve('norm_overflow', 1, [0, 0, 3e-308, 3e-308], [[-1.65, -1.65, -1.65], [1.65, 1.65, 1.65]], [1, 1]);
const normSource = mixedSource(norm), normCold = compileCadModel(normSource, { sourceVersion: 0 });
assert.equal(normCold.ok, true); sourceFile('genuine-norm-overflow-source', normSource, normCold.model);
let normError;
try { extract(requestFor(normSource, norm.id, [1.5e-308, 3e-308])); } catch (error) { normError = error; }
assert.ok(normError instanceof InsertionError); assert.ok(['REPRESENTABILITY', 'NATIVE'].includes(normError.code));
failures.push({ name: 'genuine-norm-overflow-or-actual-upstream-refusal', code: normError.code, message: normError.message, causeName: normError.cause?.name ?? null, causeMessage: normError.cause?.message ?? null }); intact();
let getterCalls = 0;
const getterRequest = { ...main.request }; Object.defineProperty(getterRequest, 'interval', { enumerable: true, get() { getterCalls++; return [.5, 3.5]; } });
reject('request-getter', () => extract(getterRequest), 'INPUT'); assert.equal(getterCalls, 0);
const foreign = { ...main.request }; Object.setPrototypeOf(foreign, Date.prototype); reject('foreign-request', () => extract(foreign), 'INPUT');
const hidden = { ...main.request }; Object.defineProperty(hidden, 'hidden', { value: 1 }); reject('hidden-request', () => extract(hidden), 'INPUT');
const cyclic = { ...main.request }; cyclic.cycle = cyclic; reject('cyclic-request', () => extract(cyclic), 'INPUT');
const sparse = { ...main.request, interval: [.5, 3.5] }; delete sparse.interval[0]; reject('sparse-interval', () => extract(sparse), 'INPUT');
const symbol = { ...main.request }; symbol[Symbol('extra')] = 1; reject('symbol-request', () => extract(symbol), 'INPUT');
reject('nonfinite-interval', () => extract({ ...main.request, interval: [.5, Infinity] }), 'INPUT');
for (const [name, mutate] of [
  ['request-source', r => { r.request.source += ' '; }],
  ['candidate-source', r => { r.source += ' '; }],
  ['output-pole', r => { r.curve.controlPoints[0][0] += .125; }],
  ['sibling-model', r => { r.model.objects[0].controlPoints[0][0] = .125; }],
  ['plan', r => { r.provenance.plan.maximumTemporaryPoles++; }],
  ['retained-child', r => { r.provenance.stages[0].upper.weights[0] += .125; }],
  ['temporary', r => { r.provenance.stages[0].refined.controlPoints[0][0] += .125; }],
  ['shared', r => { r.provenance.stages[0].shared.weight += .125; }],
  ['child-map', r => { r.provenance.stages[0].lowerMaps.poles[0].refinedPoleIndex++; }],
  ['patch-range', r => { r.provenance.patches[0].startUTF16++; }],
  ['patch-text', r => { r.provenance.patches[0].replacementText += ' '; }],
  ['cut-d0', r => { r.provenance.stages[0].witness.lower.d0[0] += .125; }],
  ['cut-d1', r => { r.provenance.stages[0].witness.upper.d1.value.derivative[0] += .125; }],
  ['counter', r => { r.report.directCounts.rationalOperationCount++; }],
  ['file-size', r => { r.report.fileSizes.result.utf8++; }],
  ['false-global-claim', r => { r.report.quality.globalShapeErrorCertified = true; }]
]) {
  const changed = structuredClone(main.result), before = nativeJSON(changed); mutate(changed);
  assert.notEqual(nativeJSON(changed), before, 'Non-noop owned mutation ' + name);
  reject('owned-' + name, () => validate(changed), 'OWNED');
}
let previous = main.result;
reject('atomic-previous-retention', () => { previous = extract({ ...main.request, interval: [-4, 3.5] }); }, 'INTERVAL');
assert.strictEqual(previous, main.result); jsonFile('atomic-retention', { callerAndPreviousObjectAndFilesRetained: true, getterCalls });
for (const selected of [main.result.originalCurve, quartic.result.originalCurve]) assert.throws(() => oldInsert(selected, { knot: .5, insertions: 1 }), error => error instanceof Error && /degree1\.\.3 required/.test(error.message));
const packageRoot = resolve(repo, 'packages/barocss-cad'), manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.publishConfig?.exports?.['.'] ?? manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
const leafDeclarationPath = resolve(packageRoot, 'dist/nurbs/source-wide/source-curve-interval-extraction.d.ts');
const publicAPI = await import(pathToFileURL(runtimePath).href);
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.SourceCurveIntervalExtractionDiagnosticCode, codes);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./source-curve-interval-extraction.js'));
for (const name of [...runtimeNames, ...typeNames]) assert.ok(readFileSync(leafDeclarationPath, 'utf8').includes(name), name);
const currentRequest = JSON.parse(readFileSync(cases[0].requestFile, 'utf8')), currentResult = JSON.parse(readFileSync(cases[0].resultFile, 'utf8'));
assert.deepEqual(publicAPI.extractSourceCurveInterval(currentRequest), currentResult);
assert.deepEqual(publicAPI.validateSourceCurveIntervalExtraction(currentResult), currentResult.report);
for (const [source, model] of [[currentRequest.source, currentResult.originalModel], [currentResult.source, currentResult.model]]) {
  const cold = publicAPI.compileCadModel(source, { sourceVersion: 0 }); assert.equal(cold.ok, true); assert.deepEqual(cold.model, model);
}
const emittedArtifacts = ['index.js', 'index.d.ts', 'source-curve-interval-extraction.js', 'source-curve-interval-extraction.d.ts'].map(name => {
  const path = resolve(packageRoot, 'dist', name); assert.ok(existsSync(path)); const bytes = readFileSync(path);
  return { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
});
const compiledConsumer = { runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 8, currentReplayCount: 1, emittedArtifacts };
jsonFile('compiled-consumer', compiledConsumer); intact(); assert.equal(cases.length, 4);
const summary = {
  sourceMode: true, cases, failures, priorRefusals, compiledConsumer, getterCalls, actual1134OutputPoleIndex: newPoleIndex,
  idealRestrictedCells: 65, idealRestrictedCoefficients: 580, work,
  secondOverflowControl: { status: 'unreachable-not-authored', theorem: 'First shared index C>=p, so retainedUpper=N+r-C<=N-s. Its next temporary size<=N-s+p-s2<=N+p-s=firstTemporary. Thus first-fit implies second-fit; knots follow the same count bound.' },
  nativeWorkScope: 'Four initial constructor reports count292 D0 and292 D1 attempts. Independent oracle, owned and public replays are additional real calls.',
  scope: 'Complete-source proper interval and local native observations. Ideal homogeneous identity and actual stored rounding are separate. No global error, continuity, topology, Body, Solid, editor, renderer, persistence, manufacturing or publication acceptance.'
};
jsonFile('summary', summary); intact(); console.log(JSON.stringify(summary));
