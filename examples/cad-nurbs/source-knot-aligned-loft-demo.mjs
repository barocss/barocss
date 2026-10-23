import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node source-knot-aligned-loft-demo.mjs --source <output-directory>');
assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]);
mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const esbuild = require('esbuild'), entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundle = await esbuild.build({ absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
assert.equal(bundle.outputFiles.length, 1);
const sourceInputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path));
const cadInputs = sourceInputs.filter(path => path.includes('/packages/barocss-cad/'));
for (const leaf of ['source-knot-aligned-loft.ts', 'curve-knot-insertion.ts', 'source-curve-knot-insertion.ts', 'piecewise-rational-loft.ts', 'source-curve-control-polygon.ts', 'index.ts']) assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const {
  buildSourceKnotAlignedLoft: build, validateSourceKnotAlignedLoft: validate,
  SourceKnotAlignedLoftError: InsertionError, SourceKnotAlignedLoftDiagnosticCode: codes,
  compileCadModel, evaluateCurve, evaluateCurveD1, evaluateSurface, evaluateSurfaceD1, editSourceCurveControlPolygon,
  validateSourceCurveControlPolygonEdit, insertCurveKnot: oldInsert
} = api;
const runtimeNames = ['buildSourceKnotAlignedLoft', 'validateSourceKnotAlignedLoft', 'SourceKnotAlignedLoftError', 'SourceKnotAlignedLoftDiagnosticCode'];
const typeNames = ['SourceKnotAlignedLoftRequest', 'SourceKnotAlignedLoftOptions', 'SourceKnotAlignedLoftReport', 'SourceKnotAlignedLoftResult'];
for (const name of runtimeNames) assert.equal(typeof api[name], name.endsWith('Code') ? 'object' : 'function');
for (const code of ['INPUT', 'IDENTITY', 'BUDGET', 'OWNED', 'FILE']) assert.equal(codes[code], code);
const files = new Map(), retained = [], accepted = [], cases = [], failures = [], priorRefusals = [];
function nativeJSON(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || ['string', 'boolean'].includes(typeof value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}';
}
function jsonFile(name, value, maximum = 16777216) {
  const file = resolve(output, name + '.json'), text = nativeJSON(value) + '\n';
  assert.ok(text.length <= maximum && Buffer.byteLength(text) <= maximum, name + ' file size');
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

function childStations(a, b) {
  const values = domain(a).slice();
  const addValue = v => { if (!values.some(x => x === v)) values.push(v); };
  for (const c of [a, b]) {
    const breaks = distinct(c.knots.filter(v => v >= domain(c)[0] && v <= domain(c)[1]));
    for (let i = 0; i < breaks.length; i++) {
      addValue(breaks[i]);
      if (i + 1 < breaks.length) { const mid = breaks[i] + (breaks[i + 1] - breaks[i]) / 2; assert.ok(mid > breaks[i] && mid < breaks[i + 1]); addValue(mid); }
    }
  }
  return values.sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
}
function curveD1State(c, t) {
  try { return { status: 'evaluated', value: evaluateCurveD1(c, t) }; }
  catch (error) { assert.ok(error instanceof Error); assert.match(error.message, /exact C0 interior knot/); return { status: 'refused-c0', name: error.name, reason: error.message, value: null }; }
}
function relativeDerivative(a, b) {
  if (a.status !== 'evaluated' || b.status !== 'evaluated') return null;
  const delta = Math.hypot(...b.value.derivative.map((v, i) => v - a.value.derivative[i]));
  const na = Math.hypot(...a.value.derivative), nb = Math.hypot(...b.value.derivative), scale = Math.max(1, na, nb);
  assert.ok([delta, na, nb, scale].every(Number.isFinite)); return delta / scale;
}
function assertExactPoint(point, exact) {
  for (let axis = 0; axis < 3; axis++) assert.ok(compare(abs(sub(represented(point[axis]), exact[axis])), represented(1e-7)) <= 0);
}
function assertExactDerivative(derivative, exact) {
  for (let axis = 0; axis < 3; axis++) assert.ok(compare(abs(sub(represented(derivative[axis]), exact[axis])), mul(represented(1e-7), add(o, abs(exact[axis])))) <= 0);
}
function insertionNativeOracle(result, exactProof = true) {
  let evaluated = 0, refused = 0;
  const parameters = childStations(result.originalCurve, result.curve);
  const observations = parameters.map(parameter => {
    const originalPointMM = evaluateCurve(result.originalCurve, parameter), refinedPointMM = evaluateCurve(result.curve, parameter);
    const originalD1 = curveD1State(result.originalCurve, parameter), refinedD1 = curveD1State(result.curve, parameter);
    for (const [c, point, state] of [[result.originalCurve, originalPointMM, originalD1], [result.curve, refinedPointMM, refinedD1]]) {
      const exact = exactProof ? exactPointDerivative(c, parameter) : null;
      if (exact) assertExactPoint(point, exact.point);
      if (state.status === 'evaluated') { evaluated++; if (exact) assertExactDerivative(state.value.derivative, exact.derivative); } else refused++;
    }
    return { parameter, originalPointMM, refinedPointMM, pointDifferenceMM: Math.hypot(...refinedPointMM.map((v, i) => v - originalPointMM[i])), originalD1, refinedD1, relativeDerivativeDifference: relativeDerivative(originalD1, refinedD1) };
  });
  assert.deepEqual(result.report.observations, observations);
  assert.equal(result.report.maximumPointDifferenceMM, Math.max(...observations.map(v => v.pointDifferenceMM)));
  assert.equal(result.report.maximumRelativeDerivativeDifference, Math.max(...observations.map(v => v.relativeDerivativeDifference ?? 0)));
  const m = observations.length;
  assert.deepEqual(result.report.directCounts, {
    originalCompileCount: 1, candidateCompileCount: 1, coefficientInsertionCallCount: 1, insertedKnotCount: 1,
    nativeCurveValidationCount: 2, domainQueryCount: 2, patchCount: 3,
    decimalEmissionCount: 4 * result.curve.controlPoints.length + result.curve.knots.length,
    observationCount: m, curveD0Count: 2 * m, curveD1AttemptCount: 2 * m,
    curveD1EvaluatedCount: evaluated, curveD1RefusedCount: refused,
    sourceWriterCallCount: 0, publicRefinementCallCount: 0, loftCallCount: 0, rationalOperationCount: 0
  });
  return { stations: parameters, evaluated, refused, directCounts: result.report.directCounts };
}
function actualSectionPolynomials(c, a, b) { return homogeneousPolynomial(c, lift(c), represented(a), represented(b)); }
function tensorOracle(loft) {
  const surface = loft.surface, sections = loft.sections, breaks = distinct(surface.knotsU), vBreaks = distinct(surface.knotsV);
  const net = surface.controlPoints.map((row, i) => row.map((point, j) => [...point.map(v => mul(represented(v), represented(surface.weights[i][j]))), represented(surface.weights[i][j])]));
  const hash = createHash('sha256'); let cells = 0, coefficientCount = 0;
  for (let ui = 0; ui + 1 < breaks.length; ui++) for (let vi = 0; vi + 1 < vBreaks.length; vi++) {
    const a = represented(breaks[ui]), b = represented(breaks[ui + 1]);
    const bu = basisPolynomials(surface.knotsU, surface.degreeU, a, b);
    const bv = basisPolynomials(surface.knotsV, surface.degreeV, represented(vBreaks[vi]), represented(vBreaks[vi + 1]));
    const first = actualSectionPolynomials(sections[vi], breaks[ui], breaks[ui + 1]);
    const second = actualSectionPolynomials(sections[vi + 1], breaks[ui], breaks[ui + 1]);
    for (let axis = 0; axis < 4; axis++) for (let ku = 0; ku <= surface.degreeU; ku++) for (let kv = 0; kv <= 1; kv++) {
      let coefficient = z;
      for (let i = 0; i < bu.length; i++) for (let j = 0; j < bv.length; j++) coefficient = add(coefficient, mul(mul(bu[i][ku] ?? z, bv[j][kv] ?? z), net[i][j][axis]));
      const expected = kv === 0 ? first[axis][ku] ?? z : sub(second[axis][ku] ?? z, first[axis][ku] ?? z);
      const delta = sub(coefficient, expected); assert.equal(delta[0], 0n); hash.update(nativeJSON(asDTO(delta)) + '\n'); coefficientCount++;
    }
    cells++;
  }
  return { cells, coefficientCount, actualStoredSectionToCopiedSurfaceTensorIdentity: true, residualSHA256: hash.digest('hex') };
}
function exactSurface(loft, u, v) {
  const stations = loft.parametersV, j = v <= stations[1] ? 0 : 1;
  const curves = loft.sections, breaks = distinct(curves[j].knots);
  const span = breaks.findIndex((a, i) => i + 1 < breaks.length && u >= a && u <= breaks[i + 1]);
  assert.ok(span >= 0);
  const a = represented(breaks[span]), b = represented(breaks[span + 1]), width = sub(b, a), t = divide(sub(represented(u), a), width);
  const polynomials = [curves[j], curves[j + 1]].map(c => homogeneousPolynomial(c, lift(c), a, b));
  const H = polynomials.map(P => P.map(poly => polyAt(poly, t)));
  const Hu = polynomials.map(P => P.map(poly => divide(polyAt(polyDerivative(poly), t), width)));
  const vWidth = sub(represented(stations[j + 1]), represented(stations[j])), alpha = divide(sub(represented(v), represented(stations[j])), vWidth);
  const value = H[0].map((h, axis) => add(mul(sub(o, alpha), h), mul(alpha, H[1][axis])));
  const du = Hu[0].map((h, axis) => add(mul(sub(o, alpha), h), mul(alpha, Hu[1][axis])));
  const dv = H[0].map((h, axis) => divide(sub(H[1][axis], h), vWidth));
  const quotient = partial => value.slice(0, 3).map((h, axis) => divide(sub(mul(partial[axis], value[3]), mul(h, partial[3])), mul(value[3], value[3])));
  return { point: value.slice(0, 3).map(h => divide(h, value[3])), du: quotient(du), dv: quotient(dv) };
}
function loftOracle(loft, exactProof = true) {
  const surface = loft.surface;
  assert.equal(surface.degreeV, 1); assert.deepEqual(surface.knotsU, loft.sections[0].knots);
  assert.deepEqual(surface.knotsV, [loft.parametersV[0], ...loft.parametersV, loft.parametersV.at(-1)]);
  for (let i = 0; i < surface.controlPoints.length; i++) for (let j = 0; j < 3; j++) {
    assert.deepEqual(surface.controlPoints[i][j], loft.sections[j].controlPoints[i]); assert.ok(Object.is(surface.weights[i][j], loft.sections[j].weights[i]));
  }
  const options = { surfaceId: surface.id, modelName: loft.model.name, maximumSections: 15, maximumUPoles: 16, maximumPointObservations: 87, maximumDerivativeObservations: 87 };
  assert.deepEqual(loft.request.options, options);
  const cold = compileCadModel(loft.source, { sourceVersion: 0 }); assert.equal(cold.ok, true); assert.deepEqual(cold.model, loft.model);
  assert.deepEqual(loft.model.objects, [...loft.sections, loft.surface]);
  let evaluated = 0, refused = 0;
  for (const [index, observation] of loft.report.pointObservations.entries()) {
    const point = evaluateSurface(surface, observation.u, observation.v), exact = exactProof ? exactSurface(loft, observation.u, observation.v) : null;
    assert.deepEqual(point, observation.surfacePointMM); if (exact) assertExactPoint(point, exact.point);
    if (observation.kind === 'station') assert.deepEqual(evaluateCurve(loft.sections[observation.sectionIndex], observation.u), observation.sectionPointMM);
    else if (exactProof) {
      const [j, k] = observation.sectionPairIndices;
      for (const [role, c] of [['first', loft.sections[j]], ['second', loft.sections[k]]]) {
        const independent = exactPointDerivative(c, observation.u);
        assertExactPoint(observation[role + 'PointMM'], independent.point);
      }
      const pair = [loft.sections[j], loft.sections[k]], denominators = pair.map(c => {
        const breaks = distinct(c.knots), span = breaks.findIndex((a, i) => i + 1 < breaks.length && observation.u >= a && observation.u <= breaks[i + 1]);
        const a = represented(breaks[span]), b = represented(breaks[span + 1]);
        return polyAt(homogeneousPolynomial(c, lift(c), a, b)[3], divide(sub(represented(observation.u), a), sub(b, a)));
      });
      assert.ok(denominators.every(v => v[0] > 0n));
      for (const [role, denominator] of [['first', denominators[0]], ['second', denominators[1]]]) assert.ok(compare(abs(sub(represented(observation[role + 'Denominator']), denominator)), represented(1e-7)) <= 0);
      const alpha = divide(sub(represented(observation.v), represented(loft.parametersV[j])), sub(represented(loft.parametersV[k]), represented(loft.parametersV[j])));
      const exactFraction = divide(mul(alpha, denominators[1]), add(mul(sub(o, alpha), denominators[0]), mul(alpha, denominators[1])));
      assert.ok(compare(abs(sub(represented(observation.rationalSecondFraction), exactFraction)), represented(1e-7)) <= 0);
      assertExactPoint(observation.expectedPointMM, exact.point);
    }
    let actual;
    try { actual = { kind: 'evaluated', result: evaluateSurfaceD1(surface, observation.u, observation.v) }; }
    catch (error) { assert.ok(error instanceof Error); actual = { kind: 'refused', message: error.message.slice(0, 512) }; }
    assert.deepEqual(loft.report.derivativeObservations[index], { u: observation.u, v: observation.v, result: actual });
    if (actual.kind === 'evaluated') { evaluated++; if (exact) { assertExactPoint(actual.result.point, exact.point); assertExactDerivative(actual.result.du, exact.du); assertExactDerivative(actual.result.dv, exact.dv); } }
    else { refused++; assert.match(actual.message, /exact C0 interior knot/); assert.equal(observation.v, loft.parametersV[1]); }
  }
  assert.equal(loft.report.pointObservations.length, 15);
  const emitted = 3 * (1 + surface.knotsU.length + 4 * surface.controlPoints.length) + 2 + surface.knotsU.length + surface.knotsV.length + 12 * surface.controlPoints.length;
  assert.deepEqual(loft.report.directCounts, { curveValidationCount: 3, surfaceValidationCount: 1, curveDomainQueryCount: 1, surfaceDomainQueryCount: 1, sourceCompilationCount: 1, curvePointEvaluationCount: 21, surfacePointEvaluationCount: 15, basisEvaluationCount: 12, surfaceDerivativeEvaluationCount: 15, derivativeSuccessCount: evaluated, derivativeRefusalCount: refused, decimalEmissionCount: emitted });
  assert.equal(evaluated, 12); assert.equal(refused, 3);
  for (const flag of ['topologyCertified', 'solid', 'globalBinary64ErrorCertified', 'manufacturingToleranceCertified', 'editorDisplayCertified', 'smoothLoftCertified', 'G1Certified', 'G2Certified', 'originalMixedSourcePreservationCertified']) assert.equal(loft.report.quality[flag], false);
  if (exactProof) assert.ok(loft.report.maximumNaiveCartesianDifferenceMM > 0);
  return { pointCount: 15, evaluated, refused, emitted, maximumNaiveCartesianDifferenceMM: loft.report.maximumNaiveCartesianDifferenceMM, copiedGridAndIndependentRationalObservations: true };
}

function mixedSource(c) {
  const list = values => '[ ' + values.map(decimal).join(' , ') + ' ]';
  return '/* original π complete source; retain CRLF */\r\n@model original_loft_model { version:0; length-unit:mm;\r\n' +
    '@curve #unused_curve {type:nurbs;degree:1;knots:[-0,/* sibling comment */-0,+1.000,1];control-points:[[-0,-0,-0],[+2.000,3,4]];weights:[1.000,1];}\r\n' +
    '@curve #' + c.id + ' { /* metadata outside patch arrays */ type:nurbs;degree:' + c.degree + ';\r\n' +
    'weights:' + list(c.weights) + ';\r\ncontrol-points:[\r\n' + c.controlPoints.map(list).join(' ,\r\n') + '\r\n];\r\nknots:' + list(c.knots) + ';}\r\n' +
    '@surface #unused_surface {type:nurbs;degree-u:1;degree-v:1;knots-u:[-0,-0,1,1];knots-v:[0,0,1,1];control-points:[[[-0,-0,0],[0,1,0]],[[1,0,0],[1,1,0]]];weights:[[1,1],[1,1]];}\r\n/* preserve Ω ending */\r\n}\r\n';
}
const curve = (degree, knots, controlPoints, weights, id = 'section_profile') => ({ kind: 'curve', id, degree, knots, controlPoints, weights });
function options(prefix) {
  return { evaluationId: prefix + '_evaluation', constructionSourceId: prefix + '_construction', modelName: prefix + '_model', surfaceId: prefix + '_surface', constructionSectionIds: [prefix + '_section_a', prefix + '_section_b', prefix + '_section_c'], maximumSections: 3, maximumAlignedUPoles: 16, maximumInsertionCalls: 28 };
}
function requestFor(curves, prefix, padded = false) {
  return {
    assets: curves.map((c, index) => {
      let source = mixedSource(c);
      if (padded) source = '/*' + '"'.repeat(259000 - source.length - 4) + '*/' + source;
      assert.ok(source.length <= 262144 && Buffer.byteLength(source) <= 262144);
      return { sourceId: prefix + '_source_' + index, sourceVersion: 0, source, curveId: c.id };
    }), parametersV: [-2, .5, 4], options: options(prefix)
  };
}
function unionPlan(curves) {
  const degree = curves[0].degree, originalDomain = domain(curves[0]);
  const values = distinct(curves.flatMap(c => c.knots.filter(v => v > originalDomain[0] && v < originalDomain[1])));
  const multiplicities = values.map(value => {
    const originalMultiplicities = curves.map(c => c.knots.filter(v => v === value).length);
    const targetMultiplicity = Math.max(...originalMultiplicities);
    return { value, originalMultiplicities, targetMultiplicity, deficits: originalMultiplicities.map(n => targetMultiplicity - n) };
  });
  const sections = curves.map((c, index) => ({ index, originalPoleCount: c.controlPoints.length, missingKnots: multiplicities.flatMap(m => Array(m.deficits[index]).fill(m.value)) }));
  const knots = [...curves[0].knots.slice(0, degree + 1), ...multiplicities.flatMap(m => Array(m.targetMultiplicity).fill(m.value)), ...curves[0].knots.slice(curves[0].controlPoints.length)];
  return { degree, domain: originalDomain, knots, poleCount: knots.length - degree - 1, multiplicities, sections, insertionCount: sections.reduce((n, s) => n + s.missingKnots.length, 0) };
}
function insertionBitOracle(child) {
  const c = child.originalCurve, p = c.degree, U = c.knots, tau = child.request.knot;
  const n = c.controlPoints.length - 1, multiplicity = U.filter(v => v === tau).length;
  let span = -1;
  for (let i = p; i <= n; i++) if (U[i] <= tau && tau < U[i + 1]) span = i;
  assert.ok(span >= p);
  const points = Array(n + 2), weights = Array(n + 2), maps = [], generated = [], homogeneous = [];
  for (let i = 0; i <= span - p; i++) { points[i] = c.controlPoints[i]; weights[i] = c.weights[i]; maps.push({ originalPoleIndex: i, refinedPoleIndex: i }); }
  for (let i = span - multiplicity; i <= n; i++) { points[i + 1] = c.controlPoints[i]; weights[i + 1] = c.weights[i]; maps.push({ originalPoleIndex: i, refinedPoleIndex: i + 1 }); }
  for (let i = span - p + 1; i <= span - multiplicity; i++) {
    const alpha = (tau - U[i]) / (U[i + p] - U[i]);
    const left = [...c.controlPoints[i - 1].map(v => v * c.weights[i - 1]), c.weights[i - 1]];
    const right = [...c.controlPoints[i].map(v => v * c.weights[i]), c.weights[i]];
    const h = right.map((v, axis) => alpha * v + (1 - alpha) * left[axis]);
    weights[i] = h[3]; points[i] = h.slice(0, 3).map(v => v / h[3]);
    generated.push({ refinedPoleIndex: i, leftPriorPoleIndex: i - 1, rightPriorPoleIndex: i, alpha });
    homogeneous.push({ ...generated.at(-1), left, right, generated: h });
  }
  const knots = [...U.slice(0, span + 1), tau, ...U.slice(span + 1)];
  assert.deepEqual(child.curve, { ...c, controlPoints: points, weights, knots });
  maps.sort((a, b) => a.refinedPoleIndex - b.refinedPoleIndex);
  assert.deepEqual(child.provenance.unchangedPoles, maps);
  assert.deepEqual(child.provenance.unchangedKnots, U.map((_, originalKnotIndex) => ({ originalKnotIndex, refinedKnotIndex: originalKnotIndex <= span ? originalKnotIndex : originalKnotIndex + 1 })));
  assert.deepEqual(child.provenance.steps, [{ insertion: 1, spanIndex: span, priorMultiplicity: multiplicity, generatedPoles: generated }]);
  assert.deepEqual(child.provenance.homogeneousSteps, [{ insertion: 1, spanIndex: span, priorMultiplicity: multiplicity, generatedPoles: homogeneous }]);
}
function aggregateCounts(result) {
  const sum = { compileCount: 0, nativeCurveValidationCount: 0, domainQueryCount: 0, coefficientInsertionCallCount: 0, patchCount: 0, decimalEmissionCount: 0, observationCount: 0, curveD0Count: 0, curveD1AttemptCount: 0, curveD1EvaluatedCount: 0, curveD1RefusedCount: 0 };
  for (const { result: child } of result.insertions) {
    const counts = child.report.directCounts; sum.compileCount += counts.originalCompileCount + counts.candidateCompileCount;
    for (const key of Object.keys(sum)) if (key !== 'compileCount') sum[key] += counts[key];
  }
  return { insertions: sum, loft: result.loft.report.directCounts, totalD0Count: sum.curveD0Count + result.loft.report.directCounts.curvePointEvaluationCount + result.loft.report.directCounts.surfacePointEvaluationCount, totalD1AttemptCount: sum.curveD1AttemptCount + result.loft.report.directCounts.surfaceDerivativeEvaluationCount, totalDecimalEmissionCount: sum.decimalEmissionCount + result.loft.report.directCounts.decimalEmissionCount };
}
function ownStats(value, depth = 0, stats = { values: 0, maximumDepth: 0 }) {
  stats.values++; stats.maximumDepth = Math.max(stats.maximumDepth, depth);
  assert.ok(stats.values <= 4194304 && depth <= 64);
  if (typeof value === 'string') assert.ok(value.length <= 262144);
  if (value && typeof value === 'object') {
    assert.ok(Array.isArray(value) ? value.length <= 8192 : Object.keys(value).length <= 64);
    for (const [key, child] of Object.entries(value)) { assert.ok(key.length <= 128); ownStats(child, depth + 1, stats); }
  }
  return stats;
}
function rootOracle(result, fullProof) {
  assert.deepEqual(Object.keys(result).sort(), ['request', 'originalSources', 'alignedSections', 'insertions', 'plan', 'loft', 'bindings', 'report'].sort());
  const originalCurves = [], currentSources = [], currentCurves = [], globalH = [], stepProofs = [];
  for (const [index, asset] of result.request.assets.entries()) {
    const cold = compileCadModel(asset.source, { sourceVersion: 0 }); assert.equal(cold.ok, true, JSON.stringify(cold.diagnostics));
    assert.deepEqual(result.originalSources[index], { index, sourceId: asset.sourceId, sourceVersion: 0, source: asset.source, model: cold.model });
    const c = cold.model.objects.find(o => o.id === asset.curveId); assert.equal(c.kind, 'curve');
    originalCurves.push(c); currentSources.push(asset.source); currentCurves.push(c); globalH.push(fullProof ? lift(c) : null);
  }
  const plan = unionPlan(originalCurves); assert.deepEqual(result.plan, plan);
  const expectedOrder = plan.sections.flatMap(s => s.missingKnots.map(knot => ({ sectionIndex: s.index, knot })));
  assert.equal(result.insertions.length, expectedOrder.length);
  for (const [index, step] of result.insertions.entries()) {
    assert.equal(step.index, index); assert.deepEqual({ sectionIndex: step.sectionIndex, knot: step.knot }, expectedOrder[index]);
    const j = step.sectionIndex, child = step.result;
    assert.deepEqual(child.request, { source: currentSources[j], sourceVersion: 0, curveId: result.request.assets[j].curveId, knot: step.knot, maximumObservations: 128 });
    assert.deepEqual(child.originalCurve, currentCurves[j]);
    insertionBitOracle(child);
    const sourceProof = sourceOracle(child), native = insertionNativeOracle(child, fullProof);
    const sizes = value => ({ utf16: (nativeJSON(value) + '\n').length, utf8: Buffer.byteLength(nativeJSON(value) + '\n') });
    assert.deepEqual(child.report.fileSizes, { request: sizes(child.request), result: sizes(child) });
    assert.ok(child.report.fileSizes.result.utf16 <= 2097152 && child.report.fileSizes.result.utf8 <= 2097152);
    if (fullProof) {
      const calculation = { candidate: child.curve, unchangedPoles: child.provenance.unchangedPoles, unchangedKnots: child.provenance.unchangedKnots, steps: child.provenance.steps, homogeneousSteps: child.provenance.homogeneousSteps };
      const ideal = refineOracle(child.originalCurve, globalH[j], step.knot, 1, calculation);
      const local = refineOracle(child.originalCurve, lift(child.originalCurve), step.knot, 1, calculation);
      const idealIdentity = residualProof(child.originalCurve, globalH[j], child.curve, ideal.H, domain(child.curve), true);
      const localStoredResidual = residualProof(child.originalCurve, lift(child.originalCurve), child.curve, lift(child.curve), domain(child.curve), false);
      stepProofs.push({ index, sectionIndex: j, native, sourceProof, generated: ideal.generatedSummaries, localGenerated: local.generatedSummaries, idealIdentity, localStoredResidual });
      globalH[j] = ideal.H;
    }
    currentSources[j] = child.source; currentCurves[j] = child.curve;
  }
  for (let j = 0; j < 3; j++) {
    const cold = compileCadModel(currentSources[j], { sourceVersion: 0 }); assert.equal(cold.ok, true);
    assert.deepEqual(result.alignedSections[j], { index: j, sourceId: result.request.assets[j].sourceId, sourceVersion: 0, source: currentSources[j], model: cold.model });
    assert.deepEqual(cold.model.objects.find(o => o.id === result.request.assets[j].curveId), currentCurves[j]);
    assert.deepEqual(currentCurves[j].knots, plan.knots);
    const expectedModel = structuredClone(result.originalSources[j].model);
    const selectedIndex = expectedModel.objects.findIndex(o => o.id === result.request.assets[j].curveId); expectedModel.objects[selectedIndex] = structuredClone(currentCurves[j]);
    assert.deepEqual(cold.model, expectedModel);
    const copy = { ...structuredClone(currentCurves[j]), id: result.request.options.constructionSectionIds[j] };
    assert.deepEqual(result.loft.sections[j], copy);
    const reference = { sourceId: result.request.assets[j].sourceId, modelName: cold.model.name, curveId: currentCurves[j].id, objectIndex: selectedIndex };
    assert.deepEqual(result.bindings.sections[j], { index: j, original: reference, aligned: reference, construction: { sourceId: result.request.options.constructionSourceId, modelName: result.request.options.modelName, curveId: copy.id, objectIndex: j }, coefficientsIdenticalToAligned: true });
  }
  assert.deepEqual(result.bindings.output, { sourceId: result.request.options.constructionSourceId, modelName: result.request.options.modelName, surfaceId: result.request.options.surfaceId, objectIndex: 3 });
  const report = result.report, counts = aggregateCounts(result);
  assert.deepEqual(report.directCounts, { originalCompileCount: 3, nativeCurveValidationCount: 3, domainQueryCount: 3, sourceInsertionCallCount: result.insertions.length, loftBuildCallCount: 1, constructionCopyCount: 3, curveD0Count: 0, curveD1AttemptCount: 0, surfaceD0Count: 0, surfaceD1AttemptCount: 0, rationalOperationCount: 0, childValidationCount: 0, loftValidationCount: 0 });
  assert.deepEqual(report.delegatedCounts, counts);
  assert.equal(report.insertionCount, result.insertions.length); assert.deepEqual(report.sectionInsertionCounts, plan.sections.map(s => s.missingKnots.length));
  const size = source => ({ utf16: source.length, utf8: Buffer.byteLength(source) });
  assert.deepEqual(report.sourceSizes, { original: result.originalSources.map(c => size(c.source)), aligned: result.alignedSections.map(c => size(c.source)), construction: size(result.loft.source) });
  const jsonSize = value => ({ utf16: (nativeJSON(value) + '\n').length, utf8: Buffer.byteLength(nativeJSON(value) + '\n') });
  assert.deepEqual(report.fileSizes, { request: jsonSize(result.request), result: jsonSize(result) });
  assert.ok(report.fileSizes.request.utf16 <= 2097152 && report.fileSizes.request.utf8 <= 2097152);
  assert.ok(report.fileSizes.result.utf16 <= 16777216 && report.fileSizes.result.utf8 <= 16777216);
  for (const value of Object.values(report.preservation)) assert.equal(value, true);
  assert.equal(report.quality.constructionOnly, true);
  for (const flag of ['globalShapeErrorCertified', 'globalBinary64ErrorCertified', 'smoothLoftCertified', 'g1g2Certified', 'topologyCertified', 'solid', 'manufacturingToleranceCertified', 'editorDisplayCertified', 'persistentTopologyBindingCertified', 'publication']) assert.equal(report.quality[flag], false);
  const loft = loftOracle(result.loft, fullProof);
  let sections = null, tensor = null;
  if (fullProof) {
    sections = currentCurves.map((c, j) => ({ sectionIndex: j, ideal: residualProof(originalCurves[j], lift(originalCurves[j]), c, globalH[j], domain(c), true), stored: residualProof(originalCurves[j], lift(originalCurves[j]), c, lift(c), domain(c), false) }));
    tensor = tensorOracle(result.loft);
    assert.equal(sections.reduce((n, p) => n + p.ideal.coefficientCount, 0), 288); assert.equal(tensor.coefficientCount, 384);
  }
  const proof = { fullIdealCampaign: fullProof, independentUnionPlan: plan, stepProofs, sections, tensor, loft, counts, ownStats: ownStats(result), sourceQualifiedOriginalNamesMayRepeat: true, explicitIdOnlyConstructionCopies: true };
  let fractionDTOCount = 0;
  const visit = value => { if (value && typeof value === 'object') { if (Object.hasOwn(value, 'numerator')) fractionDTOCount++; Object.values(value).forEach(visit); } };
  visit(proof); assert.ok(fractionDTOCount <= 5000); proof.fractionDTOCount = fractionDTOCount;
  return proof;
}
function positive(name, request, fullProof) {
  const before = structuredClone(request), requestFile = jsonFile(name + '.request', request, 2097152);
  const result = build(request); assert.deepEqual(request, before); ownership([request], result);
  const proof = rootOracle(result, fullProof);
  for (const [label, contexts] of [['original', result.originalSources], ['aligned', result.alignedSections]]) for (const context of contexts) sourceFile(name + '.' + label + '-' + context.index, context.source, context.model);
  sourceFile(name + '.construction', result.loft.source, result.loft.model);
  const saved = jsonFile(name + '.result', result); jsonFile(name + '.independent-oracle', proof);
  for (const step of result.insertions) { jsonFile(name + '.insertion-' + step.index + '.request', step.result.request, 2097152); jsonFile(name + '.insertion-' + step.index + '.result', step.result, 2097152); }
  retained.push({ value: request, before }); accepted.push({ result, beforeResult: structuredClone(result) });
  cases.push({ name, requestFile: requestFile.file, resultFile: saved.file, insertionCount: result.insertions.length, alignedUPoles: result.plan.poleCount, sourceSizes: result.report.sourceSizes, fileSizes: result.report.fileSizes, counts: result.report.delegatedCounts, fullIdealCampaign: fullProof });
  return { request, result, proof };
}

jsonFile('source-api.inputs', { entry, sourceInputs, cadInputs, sourceOnly: true, write: false, esbuildVersion: esbuild.version });
jsonFile('source-api.metafile', bundle.metafile);
const mainWeights = [Array.from({ length: 8 }, (_, i) => i % 2 ? 3 : 1), [2, 1, 4, 1, 2, 1, 4, 1], [.5, 2, .75, 3, .5, 2, .75, 3]];
const interiorBases = [[-1, 2], [.5, 2], [-1, .5]];
const mainCurves = interiorBases.map((interior, j) => curve(5, [...Array(6).fill(-3), ...interior, ...Array(6).fill(5)], Array.from({ length: 8 }, (_, i) => [2 * i + j, 4 * j + (i % 2 ? -1 : 1) * (i + 1) / (2 ** j), 3 * j + i * i / (4 * 2 ** j)]), mainWeights[j]));
const main = positive('main', requestFor(mainCurves, 'main'), true);
assert.equal(main.result.insertions.length, 3); assert.equal(main.result.plan.poleCount, 9);
assert.deepEqual(main.result.insertions.map(s => s.knot), [.5, -1, 2]);
assert.deepEqual(main.result.insertions.map(s => s.result.report.directCounts.observationCount), [9, 10, 10]);
assert.deepEqual([main.result.report.delegatedCounts.insertions.observationCount, main.result.report.delegatedCounts.insertions.curveD0Count, main.result.report.delegatedCounts.insertions.curveD1AttemptCount, main.result.report.delegatedCounts.insertions.decimalEmissionCount], [29, 58, 58, 153]);
assert.equal(main.result.loft.report.directCounts.decimalEmissionCount, 286);
assert.equal(main.result.report.delegatedCounts.totalDecimalEmissionCount, 439);
assert.ok(main.proof.sections.some(p => p.stored.nonzero > 0), 'Stored rounding is separate from the zero ideal proof');
assert.deepEqual(validate(main.result), main.result.report);
const ownedMain = structuredClone(main.result), ownedReport = validate(ownedMain); ownership([ownedMain], ownedReport); assert.deepEqual(ownedReport, main.result.report);
const firstStep = main.result.insertions.find(s => s.sectionIndex === 0), generated = firstStep.result.provenance.steps[0].generatedPoles[0].refinedPoleIndex;
assert.ok(!firstStep.result.provenance.unchangedPoles.some(m => m.refinedPoleIndex === generated));
const alignedA = main.result.alignedSections[0], selectedA = alignedA.model.objects.find(o => o.id === main.request.assets[0].curveId);
const editRequest = { source: alignedA.source, sourceVersion: 0, curveId: selectedA.id, edits: { poleEdits: [{ index: generated, xMM: selectedA.controlPoints[generated][0] + .25 }] } };
const edit = editSourceCurveControlPolygon(editRequest);
assert.deepEqual(validateSourceCurveControlPolygonEdit(edit), edit.report);
assert.ok(edit.report.maximumObservedChangeMM > 0); assert.notEqual(edit.source, alignedA.source);
assert.deepEqual(edit.curve.knots, selectedA.knots); assert.deepEqual(edit.curve.weights, selectedA.weights);
assert.equal(edit.curve.id, selectedA.id); assert.equal(edit.curve.degree, selectedA.degree);
for (let i = 0; i < edit.curve.controlPoints.length; i++) if (i !== generated) assert.deepEqual(edit.curve.controlPoints[i], selectedA.controlPoints[i]);
for (const i of [0, 2]) assert.deepEqual(edit.model.objects[i], alignedA.model.objects[i]);
sourceFile('actual1134-generated-pole-edit', edit.source, edit.model);
jsonFile('actual1134-generated-pole-edit.request', editRequest); jsonFile('actual1134-generated-pole-edit.result', edit);
const editedRequest = { assets: main.result.alignedSections.map((c, i) => ({ sourceId: c.sourceId, sourceVersion: 0, source: i ? c.source : edit.source, curveId: main.request.assets[i].curveId })), parametersV: main.request.parametersV.slice(), options: options('edited') };
const edited = positive('edited-aligned-pole-reloft', editedRequest, false);
assert.equal(edited.result.insertions.length, 0); assert.deepEqual(edited.result.plan.knots, main.result.plan.knots);
assert.deepEqual(validate(edited.result), edited.result.report);
const mainStation = main.result.loft.report.pointObservations.find(p => p.kind === 'station' && p.sectionIndex === 0 && p.u === 1);
const editedStation = edited.result.loft.report.pointObservations.find(p => p.kind === 'station' && p.sectionIndex === 0 && p.u === 1);
assert.ok(Math.hypot(...editedStation.surfacePointMM.map((v, i) => v - mainStation.surfacePointMM[i])) > 0);
const capInterior = [Array.from({ length: 5 }, (_, i) => i + 1), Array.from({ length: 5 }, (_, i) => i + 6), Array.from({ length: 4 }, (_, i) => i + 11)];
const capCurves = capInterior.map((interior, j) => {
  const breaks = [-0, ...interior, 15];
  return curve(1, [-0, ...breaks, 15], breaks.map(u => [u, 3 * j, u / 8 + j]), Array(breaks.length).fill(1));
});
const capacity = positive('same-overflow-geometry-unpadded-capacity', requestFor(capCurves, 'capacity'), false);
assert.equal(capacity.result.plan.poleCount, 16); assert.equal(capacity.result.insertions.length, 28);
assert.deepEqual(capacity.result.report.sectionInsertionCounts, [9, 9, 10]);
const capCounts = capacity.result.report.delegatedCounts;
assert.deepEqual([capCounts.insertions.observationCount, capCounts.insertions.curveD0Count, capCounts.insertions.curveD1AttemptCount, capCounts.insertions.curveD1EvaluatedCount, capCounts.insertions.curveD1RefusedCount, capCounts.insertions.decimalEmissionCount], [658, 1316, 1316, 794, 522, 1711]);
assert.equal(capCounts.loft.decimalEmissionCount, 466); assert.equal(capCounts.totalDecimalEmissionCount, 2177);
assert.equal(capCounts.totalD0Count, 1352); assert.equal(capCounts.totalD1AttemptCount, 1331);
function intact() {
  for (const row of retained) assert.deepEqual(row.value, row.before);
  for (const row of accepted) assert.deepEqual(row.result, row.beforeResult);
  for (const [file, bytes] of files) assert.deepEqual(readFileSync(file), bytes, file);
}
function reject(name, action, code) {
  assert.throws(action, error => {
    assert.ok(error instanceof InsertionError); assert.equal(error.code, code, name); assert.ok(error.message.length <= 1024);
    failures.push({ name, code: error.code, message: error.message, causeName: error.cause?.name ?? null, causeCode: error.cause?.code ?? null, causeMessage: error.cause?.message ?? null, nestedCauseMessage: error.cause?.cause?.message ?? null });
    intact(); return true;
  });
}
const overflowRequest = requestFor(capCurves, 'overflow', true), overflowBefore = structuredClone(overflowRequest);
assert.ok((nativeJSON(overflowRequest) + '\n').length < 2097152 && Buffer.byteLength(nativeJSON(overflowRequest) + '\n') < 2097152);
for (const [index, asset] of overflowRequest.assets.entries()) {
  const cold = compileCadModel(asset.source, { sourceVersion: 0 }); assert.equal(cold.ok, true);
  assert.deepEqual(cold.model, capacity.result.originalSources[index].model);
  assert.equal(asset.source.length, 259000); sourceFile('aggregate-overflow-original-' + index, asset.source, cold.model);
}
jsonFile('genuine-aggregate-overflow.request', overflowRequest, 2097152);
reject('actual-full-retained-chain-aggregate-FILE', () => build(overflowRequest), 'FILE');
assert.deepEqual(overflowRequest, overflowBefore);
jsonFile('genuine-aggregate-overflow.receipt', { requestRetained: true, sameAdmittedGeometryAsCapacity: true, legalCommentOutsideArrays: true, sourceUTF16: overflowRequest.assets.map(a => a.source.length), sourceUTF8: overflowRequest.assets.map(a => Buffer.byteLength(a.source)), canonicalEscapingDoublesQuoteCharacters: true, actualFailure: failures.at(-1), noPartialResultPublished: true });
const larger = capInterior.map((interior, j) => {
  const donor = j === 2 ? [...interior, 15] : interior, breaks = [-0, ...donor, 16];
  return curve(1, [-0, ...breaks, 16], breaks.map(u => [u, 3 * j, u / 8 + j]), Array(breaks.length).fill(1));
});
const overBasis = requestFor(larger, 'over_basis');
for (const asset of overBasis.assets) assert.equal(compileCadModel(asset.source, { sourceVersion: 0 }).ok, true);
reject('valid-originals-union17-before-insertion', () => build(overBasis), 'BUDGET');
for (const [field, value] of [['maximumSections', 2], ['maximumAlignedUPoles', 15], ['maximumInsertionCalls', 27]]) reject('fixed-budget-' + field, () => build({ ...main.request, options: { ...main.request.options, [field]: value } }), 'BUDGET');
reject('invalid-station-order', () => build({ ...main.request, parametersV: [4, .5, -2] }), 'STATIONS');
reject('duplicate-source-qualification', () => build({ ...main.request, assets: main.request.assets.map((a, i) => ({ ...a, sourceId: i === 1 ? main.request.assets[0].sourceId : a.sourceId })) }), 'IDENTITY');
reject('duplicate-construction-copy-id', () => build({ ...main.request, options: { ...main.request.options, constructionSectionIds: ['same_copy', 'same_copy', 'third_copy'] } }), 'IDENTITY');
reject('missing-curve-target', () => build({ ...main.request, assets: main.request.assets.map((a, i) => i ? a : { ...a, curveId: 'missing_curve' }) }), 'TARGET');
reject('surface-target', () => build({ ...main.request, assets: main.request.assets.map((a, i) => i ? a : { ...a, curveId: 'unused_surface' }) }), 'TARGET');
reject('wrong-source-version', () => build({ ...main.request, assets: main.request.assets.map((a, i) => i ? a : { ...a, sourceVersion: 1 }) }), 'VERSION');
reject('extra-request-field', () => build({ ...main.request, extra: 1 }), 'INPUT');
const originalAST = compileCadModel(main.request.assets[0].source, { sourceVersion: 0 }); assert.equal(originalAST.ok, true);
const declaration = originalAST.ast.declarations.find(d => d.kind === 'curve' && d.id === main.request.assets[0].curveId);
const arrayStart = declaration.fields.find(f => f.name === 'control-points').value.range.start;
const originalSource = main.request.assets[0].source;
const commented = originalSource.slice(0, arrayStart + 1) + '/* legal selected-array comment */' + originalSource.slice(arrayStart + 1);
const commentCold = compileCadModel(commented, { sourceVersion: 0 }); assert.equal(commentCold.ok, true); assert.deepEqual(commentCold.model, main.result.originalSources[0].model);
sourceFile('genuine-selected-array-comment', commented, commentCold.model);
reject('selected-array-comment', () => build({ ...main.request, assets: main.request.assets.map((a, i) => i ? a : { ...a, source: commented }) }), 'TARGET');
const differentDegree = curve(4, [...Array(5).fill(-3), ...Array(5).fill(5)], Array.from({ length: 5 }, (_, i) => [i, 1, i / 4]), Array(5).fill(1));
const degreeRequest = requestFor([differentDegree, mainCurves[1], mainCurves[2]], 'degree_mismatch');
for (const asset of degreeRequest.assets) assert.equal(compileCadModel(asset.source, { sourceVersion: 0 }).ok, true);
reject('valid-different-degree', () => build(degreeRequest), 'BASIS');
const differentDomain = structuredClone(mainCurves); differentDomain[1].knots = differentDomain[1].knots.map(v => v === 5 ? 6 : v);
const domainRequest = requestFor(differentDomain, 'domain_mismatch');
for (const asset of domainRequest.assets) assert.equal(compileCadModel(asset.source, { sourceVersion: 0 }).ok, true);
reject('valid-different-domain', () => build(domainRequest), 'BASIS');
const zeroCurves = [curve(1, [-1, -1, -0, 1, 1], [[0, 0, 0], [1, 0, 0], [2, 0, 0]], [1, 1, 1]), curve(1, [-1, -1, +0, 1, 1], [[0, 3, 0], [1, 3, 0], [2, 3, 0]], [1, 1, 1]), curve(1, [-1, -1, 1, 1], [[0, 6, 0], [2, 6, 0]], [1, 1])];
const zeroRequest = requestFor(zeroCurves, 'zero_mismatch');
for (const asset of zeroRequest.assets) assert.equal(compileCadModel(asset.source, { sourceVersion: 0 }).ok, true);
reject('valid-opposite-zero-donors', () => build(zeroRequest), 'BASIS');
const tiny = 2 * Number.MIN_VALUE;
const unsafeCurves = [curve(1, [0, 0, 8, 8], [[0, 0, 0], [1, 1, 1]], [1, 1]), curve(1, [0, 0, tiny, 8, 8], [[0, 3, 0], [1, 3, 1], [2, 3, 2]], [1, 1, 1]), curve(1, [0, 0, 8, 8], [[0, 6, 0], [1, 6, 1]], [1, 1])];
const unsafeRequest = requestFor(unsafeCurves, 'unsafe_alpha');
for (const [index, asset] of unsafeRequest.assets.entries()) { const cold = compileCadModel(asset.source, { sourceVersion: 0 }); assert.equal(cold.ok, true); sourceFile('genuine-unsafe-alpha-original-' + index, asset.source, cold.model); }
reject('actual-first-insertion-strict-alpha-refusal', () => build(unsafeRequest), 'INSERTION');
assert.equal(failures.at(-1).causeCode, 'REPRESENTABILITY');
assert.match(failures.at(-1).nestedCauseMessage, /strict convex insertion coefficient is not representable/);
let getterCalls = 0;
const getterRequest = { ...main.request }; Object.defineProperty(getterRequest, 'assets', { enumerable: true, get() { getterCalls++; return main.request.assets; } });
reject('request-getter', () => build(getterRequest), 'INPUT'); assert.equal(getterCalls, 0);
const sparse = structuredClone(main.request); delete sparse.assets[1]; reject('sparse-assets', () => build(sparse), 'INPUT');
const hidden = { ...main.request }; Object.defineProperty(hidden, 'hidden', { value: 1 }); reject('hidden-request', () => build(hidden), 'INPUT');
const symbol = { ...main.request }; symbol[Symbol('extra')] = 1; reject('symbol-request', () => build(symbol), 'INPUT');
const foreign = { ...main.request }; Object.setPrototypeOf(foreign, Date.prototype); reject('foreign-request', () => build(foreign), 'INPUT');
const cyclic = { ...main.request }; cyclic.cycle = cyclic; reject('cyclic-request', () => build(cyclic), 'INPUT');
reject('nonfinite-station', () => build({ ...main.request, parametersV: [-2, Infinity, 4] }), 'INPUT');
for (const [name, mutate] of [
  ['original-source', r => { r.originalSources[0].source += ' '; }],
  ['original-model-sibling', r => { r.originalSources[0].model.objects[0].controlPoints[0][0] = .125; }],
  ['aligned-source', r => { r.alignedSections[0].source += ' '; }],
  ['aligned-model', r => { r.alignedSections[0].model.objects[1].weights[2] += .125; }],
  ['union-plan', r => { r.plan.knots[6] += .125; }],
  ['child-request', r => { r.insertions[0].result.request.source += ' '; }],
  ['child-generated-blend', r => { r.insertions[0].result.provenance.homogeneousSteps[0].generatedPoles[0].generated[0] += .125; }],
  ['child-patch', r => { r.insertions[0].result.provenance.patches[0].startUTF16++; }],
  ['qualified-binding', r => { r.bindings.sections[0].original.modelName += '_other'; }],
  ['construction-copy', r => { r.loft.sections[0].controlPoints[2][0] += .125; }],
  ['loft-grid', r => { r.loft.surface.weights[2][0] += .125; }],
  ['loft-source', r => { r.loft.source += ' '; }],
  ['native-observation', r => { r.loft.report.pointObservations[0].surfacePointMM[0] += .125; }],
  ['native-refusal', r => { r.loft.report.derivativeObservations.find(o => o.result.kind === 'refused').result.message += ' altered'; }],
  ['direct-counter', r => { r.report.directCounts.sourceInsertionCallCount++; }],
  ['file-size', r => { r.report.fileSizes.result.utf8++; }],
  ['false-quality-claim', r => { r.report.quality.globalShapeErrorCertified = true; }]
]) {
  const changed = structuredClone(main.result), before = nativeJSON(changed); mutate(changed);
  assert.notEqual(nativeJSON(changed), before, 'Non-noop owned control ' + name); reject('owned-' + name, () => validate(changed), 'OWNED');
}
let previous = main.result;
reject('atomic-prior-result', () => { previous = build(overBasis); }, 'BUDGET'); assert.strictEqual(previous, main.result);
jsonFile('atomic-retention', { previousResultAndFilesRetained: true, getterCalls, noPartialResultPublished: true });
const packageRoot = resolve(repo, 'packages/barocss-cad'), manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.publishConfig?.exports?.['.'] ?? manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types), leafDeclarationPath = resolve(packageRoot, 'dist/nurbs/source-wide/source-knot-aligned-loft.d.ts');
const publicAPI = await import(pathToFileURL(runtimePath).href);
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.SourceKnotAlignedLoftDiagnosticCode, codes);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./source-knot-aligned-loft.js'));
for (const name of [...runtimeNames, ...typeNames]) assert.ok(readFileSync(leafDeclarationPath, 'utf8').includes(name), name);
const currentRequest = JSON.parse(readFileSync(cases[0].requestFile, 'utf8')), currentResult = JSON.parse(readFileSync(cases[0].resultFile, 'utf8'));
assert.deepEqual(publicAPI.buildSourceKnotAlignedLoft(currentRequest), currentResult);
assert.deepEqual(publicAPI.validateSourceKnotAlignedLoft(currentResult), currentResult.report);
for (const context of [...currentResult.originalSources, ...currentResult.alignedSections, { source: currentResult.loft.source, model: currentResult.loft.model }]) {
  const cold = publicAPI.compileCadModel(context.source, { sourceVersion: 0 }); assert.equal(cold.ok, true); assert.deepEqual(cold.model, context.model);
}
const emittedArtifacts = ['index.js', 'index.d.ts', 'source-knot-aligned-loft.js', 'source-knot-aligned-loft.d.ts'].map(name => {
  const path = resolve(packageRoot, 'dist', name); assert.ok(existsSync(path)); const bytes = readFileSync(path);
  return { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
});
const compiledConsumer = { runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 8, currentMainReplayCount: 1, emittedArtifacts };
jsonFile('compiled-consumer', compiledConsumer); intact(); assert.equal(cases.length, 3);
const summary = { sourceMode: true, cases, failures, compiledConsumer, getterCalls, actual1134GeneratedPoleIndex: generated, work, mainIdealSectionCoefficientCount: 288, mainActualStoredTensorCoefficientCount: 384, publicReplayScope: 'MAIN only', nativeCountScope: 'Initial constructor delegated counts; oracle, owned, cold and public replays are additional real work.', scope: 'Complete-source three-section basis alignment and actual piecewise rational Loft. Ideal original identity, actual rounded section residuals and actual stored Loft tensor identity are separate. No smooth/G1/G2, topology, Body/Solid, global error, editor/renderer/persistence/manufacturing/publication acceptance.' };
jsonFile('summary', summary); intact(); console.log(JSON.stringify(summary));
