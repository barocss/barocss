import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node source-surface-degree-elevation-demo.mjs --source <output-directory>');
assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]);
mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const esbuild = require('esbuild'), entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundle = await esbuild.build({ absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
assert.equal(bundle.outputFiles.length, 1);
const sourceInputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path));
const cadInputs = sourceInputs.filter(path => path.includes('/packages/barocss-cad/'));
for (const leaf of ['source-surface-degree-elevation.ts', 'curve-c0-degree-elevation-internal.ts', 'source-surface-control-net-wide.ts', 'index.ts']) assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const {
  elevateSourceSurfaceAxisDegree: elevate, validateSourceSurfaceAxisDegreeElevation: validate,
  SourceSurfaceDegreeElevationError: InsertionError, SourceSurfaceDegreeElevationDiagnosticCode: codes,
  compileCadModel, evaluateSurface, evaluateSurfaceD1, editSourceSurfaceControlNetWide,
  validateSourceSurfaceControlNetWideEdit
} = api;
const runtimeNames = ['elevateSourceSurfaceAxisDegree', 'validateSourceSurfaceAxisDegreeElevation', 'SourceSurfaceDegreeElevationError', 'SourceSurfaceDegreeElevationDiagnosticCode'];
const typeNames = ['SourceSurfaceDegreeElevationRequest', 'SourceSurfaceDegreeElevationPatch', 'SourceSurfaceDegreeElevationReport', 'SourceSurfaceDegreeElevationResult'];
for (const name of runtimeNames) assert.equal(typeof api[name], name.endsWith('Code') ? 'object' : 'function');
for (const name of ['INPUT', 'VERSION', 'IDENTITY', 'SOURCE', 'TARGET', 'BASIS', 'BUDGET', 'REPRESENTABILITY', 'BINDING', 'NATIVE', 'OWNED', 'FILE']) assert.equal(codes[name], name);
const files = new Map(), retained = [], accepted = [], cases = [], failures = [], priorRefusals = [];
function nativeJSON(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || ['string', 'boolean'].includes(typeof value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}';
}
function jsonFile(name, value) {
  const file = resolve(output, name + '.json'), text = nativeJSON(value) + '\n';
  assert.ok(text.length <= 4194304 && Buffer.byteLength(text) <= 4194304, name + ' file size');
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
function distinct(values) {
  const result = [];
  for (const value of values) if (!result.some(v => v === value)) result.push(value);
  return result.sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
}

const degrees = s => ({ u: s.degreeU, v: s.degreeV });
const grid = s => ({ u: s.controlPoints.length, v: s.controlPoints[0].length, total: s.controlPoints.length * s.controlPoints[0].length });
const domains = s => ({ u: [s.knotsU[s.degreeU], s.knotsU[s.controlPoints.length]], v: [s.knotsV[s.degreeV], s.knotsV[s.controlPoints[0].length]] });
function blocks(knots) {
  const result = [];
  for (let i = 0; i < knots.length;) {
    let end = i; while (end + 1 < knots.length && knots[end + 1] === knots[i]) end++;
    result.push({ index: result.length, value: knots[i], originalFirstKnotIndex: i, originalLastKnotIndex: end, multiplicity: end - i + 1 }); i = end + 1;
  }
  return result;
}
const surfaceLiftCache = new WeakMap();
function liftSurface(s) {
  if (!surfaceLiftCache.has(s)) surfaceLiftCache.set(s, s.controlPoints.map((row, i) => row.map((point, j) => [...point.map(v => mul(represented(v), represented(s.weights[i][j]))), represented(s.weights[i][j])])));
  return surfaceLiftCache.get(s);
}
const tensorCache = new WeakMap();
function tensor(s, H, a, b, c, d) {
  if (!tensorCache.has(s)) tensorCache.set(s, new WeakMap());
  const nets = tensorCache.get(s); if (!nets.has(H)) nets.set(H, new Map());
  const key = nativeJSON([a, b, c, d]); const entries = nets.get(H);
  if (!entries.has(key)) {
    const U = basisPolynomials(s.knotsU, s.degreeU, represented(a), represented(b));
    const V = basisPolynomials(s.knotsV, s.degreeV, represented(c), represented(d));
    const P = Array.from({ length: 4 }, () => Array.from({ length: s.degreeU + 1 }, () => Array(s.degreeV + 1).fill(z)));
    for (let i = 0; i < U.length; i++) for (let j = 0; j < V.length; j++) {
      for (let ku = 0; ku <= s.degreeU; ku++) {
        tick(); if ((U[i][ku] ?? z)[0] === 0n) continue;
        for (let kv = 0; kv <= s.degreeV; kv++) {
          tick(); if ((V[j][kv] ?? z)[0] === 0n) continue;
          const factor = mul(U[i][ku], V[j][kv]);
          for (let axis = 0; axis < 4; axis++) P[axis][ku][kv] = add(P[axis][ku][kv], mul(factor, H[i][j][axis]));
        }
      }
    }
    entries.set(key, P);
  }
  return entries.get(key);
}
function tensorResidual(original, target, targetH, requireZero) {
  const U = distinct(original.knotsU), V = distinct(original.knotsV), originalH = liftSurface(original), hash = createHash('sha256');
  let cells = 0, coefficientCount = 0, nonzero = 0;
  for (let i = 0; i + 1 < U.length; i++) for (let j = 0; j + 1 < V.length; j++) {
    const A = tensor(original, originalH, U[i], U[i + 1], V[j], V[j + 1]);
    const B = tensor(target, targetH, U[i], U[i + 1], V[j], V[j + 1]);
    for (let axis = 0; axis < 4; axis++) for (let ku = 0; ku <= target.degreeU; ku++) for (let kv = 0; kv <= target.degreeV; kv++) {
      const delta = sub(B[axis][ku]?.[kv] ?? z, A[axis][ku]?.[kv] ?? z);
      if (delta[0] !== 0n) nonzero++; hash.update(nativeJSON(asDTO(delta)) + '\n'); coefficientCount++;
    }
    cells++;
  }
  if (requireZero) assert.equal(nonzero, 0, 'Whole output-degree tensor ideal identity');
  return { cells, coefficientCount, nonzero, residualSHA256: hash.digest('hex') };
}
function poly2At(P, t, s, du = false, dv = false) {
  const powers = (x, n) => { const result = [o]; for (let i = 1; i <= n; i++) result.push(mul(result[i - 1], x)); return result; };
  const Tu = powers(t, P.length - 1), Tv = powers(s, P[0].length - 1); let value = z;
  for (let i = du ? 1 : 0; i < P.length; i++) for (let j = dv ? 1 : 0; j < P[i].length; j++) {
    let coefficient = P[i][j];
    if (du) coefficient = mul(coefficient, fraction(BigInt(i))); if (dv) coefficient = mul(coefficient, fraction(BigInt(j)));
    value = add(value, mul(mul(coefficient, Tu[i - (du ? 1 : 0)]), Tv[j - (dv ? 1 : 0)]));
  }
  return value;
}
function exactSurface(s, u, v, derivative) {
  const U = distinct(s.knotsU), V = distinct(s.knotsV);
  const i = U.findIndex((a, k) => k + 1 < U.length && u >= a && u <= U[k + 1]);
  const j = V.findIndex((a, k) => k + 1 < V.length && v >= a && v <= V[k + 1]);
  assert.ok(i >= 0 && j >= 0);
  const uw = sub(represented(U[i + 1]), represented(U[i])), vw = sub(represented(V[j + 1]), represented(V[j]));
  const t = divide(sub(represented(u), represented(U[i])), uw), r = divide(sub(represented(v), represented(V[j])), vw);
  const P = tensor(s, liftSurface(s), U[i], U[i + 1], V[j], V[j + 1]);
  const H = P.map(p => poly2At(p, t, r)), value = { point: H.slice(0, 3).map(h => divide(h, H[3])) };
  if (derivative) {
    const Hu = P.map(p => divide(poly2At(p, t, r, true, false), uw));
    const Hv = P.map(p => divide(poly2At(p, t, r, false, true), vw));
    const quotient = partial => H.slice(0, 3).map((h, axis) => divide(sub(mul(partial[axis], H[3]), mul(h, partial[3])), mul(H[3], H[3])));
    value.du = quotient(Hu); value.dv = quotient(Hv);
  }
  return value;
}
function stripOracle(curve, selectedBlocks, fullProof) {
  const p = curve.degree, q = p + 1, S = selectedBlocks.length - 1;
  const lifted = curve.controlPoints.map((point, i) => [...point.map(v => v * curve.weights[i]), curve.weights[i]]);
  const points = Array(S * q + 1), weights = Array(S * q + 1), copiedPoles = [], spans = [], knots = [];
  const originalH = fullProof ? curve.controlPoints.map((point, i) => [...point.map(v => mul(represented(v), represented(curve.weights[i]))), represented(curve.weights[i])]) : null;
  const ideal = fullProof ? Array(S * q + 1) : null, witnesses = [];
  for (let join = 0; join <= S; join++) {
    const originalPoleIndex = join * p, outputPoleIndex = join * q;
    points[outputPoleIndex] = curve.controlPoints[originalPoleIndex].slice(); weights[outputPoleIndex] = curve.weights[originalPoleIndex]; copiedPoles.push({ originalPoleIndex, outputPoleIndex });
    if (fullProof) ideal[outputPoleIndex] = originalH[originalPoleIndex];
  }
  for (let s = 0; s < S; s++) {
    const generated = [];
    for (let i = 1; i <= p; i++) {
      const outputPoleIndex = s * q + i, leftOriginalPoleIndex = s * p + i - 1, rightOriginalPoleIndex = s * p + i;
      const alpha = i / q, leftHomogeneous = lifted[leftOriginalPoleIndex], rightHomogeneous = lifted[rightOriginalPoleIndex];
      const leftContribution = leftHomogeneous.map(v => alpha * v), rightContribution = rightHomogeneous.map(v => (1 - alpha) * v);
      const homogeneous = leftContribution.map((v, axis) => v + rightContribution[axis]), weight = homogeneous[3], pointMM = homogeneous.slice(0, 3).map(v => v / weight);
      points[outputPoleIndex] = pointMM; weights[outputPoleIndex] = weight;
      generated.push({ outputPoleIndex, leftOriginalPoleIndex, rightOriginalPoleIndex, alpha, leftHomogeneous, rightHomogeneous, leftContribution, rightContribution, homogeneous, pointMM, weight });
      if (fullProof) {
        const exactAlpha = fraction(BigInt(i), BigInt(q));
        ideal[outputPoleIndex] = originalH[leftOriginalPoleIndex].map((h, axis) => add(mul(exactAlpha, h), mul(sub(o, exactAlpha), originalH[rightOriginalPoleIndex][axis])));
        witnesses.push({ outputPoleIndex, idealAlpha: asDTO(exactAlpha), storedAlphaResidual: asDTO(sub(represented(alpha), exactAlpha)), actualHResidual: homogeneous.map((h, axis) => asDTO(sub(represented(h), ideal[outputPoleIndex][axis]))) });
      }
    }
    spans.push({ index: s, domain: [selectedBlocks[s].value, selectedBlocks[s + 1].value], originalPoleIndices: Array.from({ length: p + 1 }, (_, i) => s * p + i), outputPoleIndices: Array.from({ length: q + 1 }, (_, i) => s * q + i), generated });
  }
  for (const block of selectedBlocks) {
    for (let k = block.originalFirstKnotIndex; k <= block.originalLastKnotIndex; k++) knots.push({ outputKnotIndex: knots.length, originalKnotIndex: k, value: curve.knots[k], origin: 'original-copy', blockIndex: block.index });
    knots.push({ outputKnotIndex: knots.length, originalKnotIndex: null, value: block.value, origin: 'degree-multiplicity-increase', blockIndex: block.index });
  }
  return { calculation: { candidate: { ...curve, degree: q, knots: knots.map(k => k.value), controlPoints: points, weights }, liftedOriginalHomogeneous: lifted, spans, copiedPoles, knots }, ideal, witnesses };
}
function coefficientOracle(result, fullProof) {
  const s = result.originalSurface, axis = result.request.axis, selectedKnots = axis === 'u' ? s.knotsU : s.knotsV, p = axis === 'u' ? s.degreeU : s.degreeV, q = p + 1;
  const selectedBlocks = blocks(selectedKnots), S = selectedBlocks.length - 1, selectedCount = S * q + 1;
  const otherCount = axis === 'u' ? s.controlPoints[0].length : s.controlPoints.length;
  const U = axis === 'u' ? selectedCount : s.controlPoints.length, V = axis === 'v' ? selectedCount : s.controlPoints[0].length;
  const points = Array.from({ length: U }, () => Array(V)), weights = Array.from({ length: U }, () => Array(V));
  const ideal = fullProof ? Array.from({ length: U }, () => Array(V)) : null;
  const copied = [], witnesses = []; let knotReceipt;
  assert.deepEqual(result.provenance.selectedBlocks, selectedBlocks); assert.equal(result.provenance.strips.length, otherCount);
  for (let fixed = 0; fixed < otherCount; fixed++) {
    const originalCurve = { kind: 'curve', id: 'surface_elevation_strip_' + fixed, degree: p, knots: selectedKnots.slice(), controlPoints: axis === 'u' ? s.controlPoints.map(row => row[fixed].slice()) : s.controlPoints[fixed].map(point => point.slice()), weights: axis === 'u' ? s.weights.map(row => row[fixed]) : s.weights[fixed].slice() };
    const expected = stripOracle(originalCurve, selectedBlocks, fullProof), actual = result.provenance.strips[fixed];
    assert.equal(actual.fixedPoleIndex, fixed); assert.deepEqual(actual.originalCurve, originalCurve); assert.deepEqual(actual.calculation, expected.calculation);
    if (!knotReceipt) knotReceipt = expected.calculation.knots; else assert.deepEqual(expected.calculation.knots, knotReceipt);
    for (let selected = 0; selected < selectedCount; selected++) {
      const i = axis === 'u' ? selected : fixed, j = axis === 'u' ? fixed : selected;
      points[i][j] = expected.calculation.candidate.controlPoints[selected]; weights[i][j] = expected.calculation.candidate.weights[selected];
      if (fullProof) ideal[i][j] = expected.ideal[selected];
    }
    for (const map of expected.calculation.copiedPoles) copied.push(axis === 'u' ? { originalUIndex: map.originalPoleIndex, originalVIndex: fixed, elevatedUIndex: map.outputPoleIndex, elevatedVIndex: fixed } : { originalUIndex: fixed, originalVIndex: map.originalPoleIndex, elevatedUIndex: fixed, elevatedVIndex: map.outputPoleIndex });
    if (fullProof) witnesses.push({ fixedPoleIndex: fixed, generated: expected.witnesses });
  }
  const target = { ...s, degreeU: axis === 'u' ? q : s.degreeU, degreeV: axis === 'v' ? q : s.degreeV, knotsU: axis === 'u' ? knotReceipt.map(k => k.value) : s.knotsU.slice(), knotsV: axis === 'v' ? knotReceipt.map(k => k.value) : s.knotsV.slice(), controlPoints: points, weights };
  assert.deepEqual(result.surface, target); assert.deepEqual(result.provenance.copiedPoles, copied); assert.deepEqual(result.provenance.knots, knotReceipt);
  assert.deepEqual(result.provenance.degrees, { original: degrees(s), elevated: degrees(target) }); assert.deepEqual(result.provenance.domain, domains(s));
  assert.deepEqual(result.provenance.parameterMap, { kind: 'identity', formula: 'u=s;v=t', uD1Factor: 1, vD1Factor: 1 });
  for (const map of copied) { assert.deepEqual(target.controlPoints[map.elevatedUIndex][map.elevatedVIndex], s.controlPoints[map.originalUIndex][map.originalVIndex]); assert.ok(Object.is(target.weights[map.elevatedUIndex][map.elevatedVIndex], s.weights[map.originalUIndex][map.originalVIndex])); }
  const receiptCounts = { spanReceiptCount: S * otherCount, generatedPoleCount: p * S * otherCount, liftedPoleCount: grid(s).total, copiedPoleCount: copied.length, addedAxisKnotCount: S + 1 };
  assert.deepEqual(result.report.receiptCounts, receiptCounts);
  const summary = { axis, spanCount: S, stripCount: otherCount, receiptCounts, privateUncompiledCurveIds: true, actualNonseparableStripsIndependentlyAudited: true, fullIdealCampaign: fullProof };
  if (fullProof) { summary.ideal = tensorResidual(s, target, ideal, true); summary.stored = tensorResidual(s, target, liftSurface(target), false); summary.generatedWitnesses = witnesses; }
  let dtoCount = 0; const visit = v => { if (v && typeof v === 'object') { if (Object.hasOwn(v, 'numerator')) dtoCount++; Object.values(v).forEach(visit); } }; visit(summary); assert.ok(dtoCount <= 5000); summary.fractionDTOCount = dtoCount;
  return summary;
}
function selectedStations(knots) {
  const b = blocks(knots), values = [b[0].value];
  for (let i = 0; i + 1 < b.length; i++) {
    const a = b[i].value, end = b[i + 1].value, width = end - a, inner = [.25, .5, .75].map(f => a + width * f);
    assert.ok(Number.isFinite(width) && width > 0 && inner.every(Number.isFinite) && inner[0] > a && inner[1] > inner[0] && inner[2] > inner[1] && inner[2] < end); values.push(...inner, end);
  }
  return values;
}
function otherStations(knots, domain) {
  const b = [domain[0], ...distinct(knots.filter(v => v > domain[0] && v < domain[1])), domain[1]], values = [];
  for (let i = 0; i < b.length; i++) { values.push(b[i]); if (i + 1 < b.length) { const mid = b[i] + (b[i + 1] - b[i]) / 2; assert.ok(Number.isFinite(mid) && mid > b[i] && mid < b[i + 1]); values.push(mid); } }
  return values;
}
function d1State(s, u, v) {
  try { return { status: 'evaluated', value: evaluateSurfaceD1(s, u, v) }; }
  catch (error) { assert.ok(error instanceof Error); assert.match(error.message, /exact C0 interior knot/); return { status: 'refused-c0', name: error.name, reason: error.message, value: null }; }
}
function relative(a, b) {
  const delta = Math.hypot(...b.map((v, i) => v - a[i])), na = Math.hypot(...a), nb = Math.hypot(...b), scale = Math.max(1, na, nb);
  assert.ok([delta, na, nb, scale].every(Number.isFinite)); return delta / scale;
}
function nativeOracle(result, fullProof) {
  const s = result.originalSurface, target = result.surface, axis = result.request.axis;
  const parameters = { u: axis === 'u' ? selectedStations(s.knotsU) : otherStations(s.knotsU, domains(s).u), v: axis === 'v' ? selectedStations(s.knotsV) : otherStations(s.knotsV, domains(s).v) };
  const observations = []; let evaluated = 0, refused = 0;
  for (const u of parameters.u) for (const v of parameters.v) {
    const originalPointMM = evaluateSurface(s, u, v), elevatedPointMM = evaluateSurface(target, u, v);
    const originalD1 = d1State(s, u, v), elevatedD1 = d1State(target, u, v);
    let relativeDuDifference = null, relativeDvDifference = null;
    for (const [support, point, state] of [[s, originalPointMM, originalD1], [target, elevatedPointMM, elevatedD1]]) {
      if (state.status === 'evaluated') evaluated++; else refused++;
      if (fullProof) {
        const exact = exactSurface(support, u, v, state.status === 'evaluated');
        for (let k = 0; k < 3; k++) {
          assert.ok(compare(abs(sub(represented(point[k]), exact.point[k])), represented(1e-7)) <= 0);
          if (state.status === 'evaluated') for (const partial of ['du', 'dv']) assert.ok(compare(abs(sub(represented(state.value[partial][k]), exact[partial][k])), mul(represented(1e-7), add(o, abs(exact[partial][k])))) <= 0);
        }
      }
    }
    if (originalD1.status === 'evaluated' && elevatedD1.status === 'evaluated') { relativeDuDifference = relative(originalD1.value.du, elevatedD1.value.du); relativeDvDifference = relative(originalD1.value.dv, elevatedD1.value.dv); }
    const pointDifferenceMM = Math.hypot(...elevatedPointMM.map((x, k) => x - originalPointMM[k]));
    assert.ok(pointDifferenceMM <= 1e-7 && (relativeDuDifference === null || relativeDuDifference <= 1e-7) && (relativeDvDifference === null || relativeDvDifference <= 1e-7));
    observations.push({ u, v, originalPointMM, elevatedPointMM, pointDifferenceMM, originalD1, elevatedD1, relativeDuDifference, relativeDvDifference });
  }
  assert.deepEqual(result.report.stations, parameters); assert.deepEqual(result.report.observations, observations);
  assert.equal(result.report.maximumPointDifferenceMM, Math.max(...observations.map(o => o.pointDifferenceMM)));
  assert.equal(result.report.maximumRelativeDuDifference, Math.max(...observations.map(o => o.relativeDuDifference ?? 0)));
  assert.equal(result.report.maximumRelativeDvDifference, Math.max(...observations.map(o => o.relativeDvDifference ?? 0)));
  return { observationCount: observations.length, evaluated, refused, observations, fullStoredNativeFractionOracle: fullProof };
}

function makeSurface(id, degreeU, degreeV, knotsU, knotsV, countU, countV) {
  return { kind: 'surface', id, degreeU, degreeV, knotsU, knotsV,
    controlPoints: Array.from({ length: countU }, (_, i) => Array.from({ length: countV }, (_, j) => [2 * i + j / 8, 3 * j + i / 4, i * i / 8 + j * j / 16 + i * j / 32])),
    weights: Array.from({ length: countU }, (_, i) => Array.from({ length: countV }, (_, j) => 1 + (i + 2 * j) / 8 + i * j / 16)) };
}
function mixedSource(s, axis) {
  const list = values => '[' + values.map(decimal).join(',') + ']';
  const knots = (values, which) => which === axis ? list(values) : '[/* untouched opposite-axis knot comment */' + values.map(decimal).join(',') + ']';
  return '/* original π Surface; preserve CRLF */\r\n@model original_surface_degree_model {version:0;length-unit:mm;\r\n' +
    '@curve #surface_elevation_strip_0 {type:nurbs;degree:1;knots:[-0,-0,1,1];control-points:[[-0,-0,-0],[1,2,3]];weights:[1,1];}\r\n' +
    '@surface #' + s.id + ' {type:nurbs;degree-u: /* outside token */ +' + s.degreeU + '.000;degree-v:+' + s.degreeV + '.000;\r\n' +
    'knots-u:' + knots(s.knotsU, 'u') + ';knots-v:' + knots(s.knotsV, 'v') + ';\r\n' +
    'control-points:[\r\n' + s.controlPoints.map(row => '[' + row.map(list).join(',') + ']').join(',\r\n') + '\r\n];weights:[' + s.weights.map(list).join(',') + '];}\r\n' +
    '@surface #unrelated_surface {type:nurbs;degree-u:1;degree-v:1;knots-u:[-0,-0,1,1];knots-v:[0,0,1,1];control-points:[[[-0,-0,0],[0,1,0]],[[1,0,0],[1,1,0]]];weights:[[1,1],[1,1]];}\r\n/* untouched Ω */\r\n}\r\n';
}
function sourceOracle(result) {
  const original = compileCadModel(result.request.source, { sourceVersion: 0 }); assert.equal(original.ok, true, JSON.stringify(original.diagnostics)); assert.deepEqual(original.model, result.originalModel);
  const index = original.model.objects.findIndex(o => o.id === result.request.surfaceId); assert.equal(index, 1); assert.equal(result.provenance.selectedObjectIndex, index); assert.deepEqual(original.model.objects[index], result.originalSurface);
  const declaration = original.ast.declarations.find(d => d.kind === 'surface' && d.id === result.request.surfaceId), ir = original.ir.nodes.find(n => n.id === result.request.surfaceId);
  assert.deepEqual(ir.geometry, result.originalSurface); assert.deepEqual(ir.span, declaration.range);
  const patches = result.provenance.patches, axis = result.request.axis;
  assert.equal(patches.length, 4); assert.deepEqual(patches.map(p => p.field).sort(), ['degree-' + axis, 'knots-' + axis, 'control-points', 'weights'].sort());
  const list = values => '[' + values.map(v => { const text = decimal(v); assert.ok(text.length <= 512 && Object.is(Number(text), v)); return text; }).join(',') + ']';
  const selectedDegree = axis === 'u' ? result.surface.degreeU : result.surface.degreeV, selectedKnots = axis === 'u' ? result.surface.knotsU : result.surface.knotsV;
  const replacements = { ['degree-' + axis]: decimal(selectedDegree), ['knots-' + axis]: list(selectedKnots), 'control-points': '[' + result.surface.controlPoints.map(row => '[' + row.map(list).join(',') + ']').join(',') + ']', weights: '[' + result.surface.weights.map(list).join(',') + ']' };
  const s = result.originalSurface, originalValues = { ['degree-' + axis]: axis === 'u' ? s.degreeU : s.degreeV, ['knots-' + axis]: axis === 'u' ? s.knotsU : s.knotsV, 'control-points': s.controlPoints, weights: s.weights };
  function bind(node, value, start, end) {
    assert.ok(node.range.start >= start && node.range.end <= end && node.range.start < node.range.end);
    if (Array.isArray(value)) { assert.equal(node.kind, 'array'); assert.equal(node.items.length, value.length); node.items.forEach((child, i) => bind(child, value[i], node.range.start, node.range.end)); }
    else { assert.equal(node.kind, 'number'); const text = result.request.source.slice(node.range.start, node.range.end); assert.match(text, /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/); assert.ok(Object.is(Number(text), node.value) && Object.is(node.value, value)); }
  }
  let last = 0, shift = 0, applied = result.request.source;
  for (const patch of patches) {
    const node = declaration.fields.find(f => f.name === patch.field).value; bind(node, originalValues[patch.field], declaration.range.start, declaration.range.end);
    assert.equal(patch.startUTF16, node.range.start); assert.equal(patch.endUTF16, node.range.end); assert.ok(patch.startUTF16 >= last);
    assert.equal(patch.originalText, result.request.source.slice(patch.startUTF16, patch.endUTF16)); assert.equal(patch.replacementText, replacements[patch.field]);
    const before = result.request.source.slice(last, patch.startUTF16), after = result.source.slice(last + shift, patch.startUTF16 + shift); assert.equal(before, after); assert.deepEqual(Buffer.from(before), Buffer.from(after));
    assert.equal(result.source.slice(patch.startUTF16 + shift, patch.startUTF16 + shift + patch.replacementText.length), patch.replacementText);
    shift += patch.replacementText.length - (patch.endUTF16 - patch.startUTF16); last = patch.endUTF16;
  }
  assert.equal(result.request.source.slice(last), result.source.slice(last + shift));
  for (const patch of patches.slice().reverse()) applied = applied.slice(0, patch.startUTF16) + patch.replacementText + applied.slice(patch.endUTF16);
  assert.equal(applied, result.source);
  const candidate = compileCadModel(result.source, { sourceVersion: 0 }); assert.equal(candidate.ok, true); assert.deepEqual(candidate.model, result.model);
  const expected = structuredClone(original.model); expected.objects[index] = structuredClone(result.surface); assert.deepEqual(candidate.model, expected);
  const opposite = declaration.fields.find(f => f.name === 'knots-' + (axis === 'u' ? 'v' : 'u')).value;
  assert.ok(result.request.source.slice(opposite.range.start, opposite.range.end).includes('/* untouched opposite-axis knot comment */'));
  assert.deepEqual(result.model.objects[0], result.originalModel.objects[0]); assert.equal(result.model.objects[0].id, 'surface_elevation_strip_0'); assert.equal(result.model.objects.length, 3);
  return { fourActualASTPatches: true, irAndNativeSurfaceBound: true, allOutsideCodeUnitsAndBytesPreserved: true, oppositeKnotCommentUntouched: true, realUnrelatedCurveCollidesWithUncompiledStripId: true, noPrivateObjectsAddedToModel: true };
}
const requestFor = (source, surfaceId, axis, targetDegree) => ({ source, sourceVersion: 0, surfaceId, axis, targetDegree, maximumObservations: 1024 });
function positive(name, s, axis, expected, fullProof) {
  const source = mixedSource(s, axis), request = requestFor(source, s.id, axis, (axis === 'u' ? s.degreeU : s.degreeV) + 1), before = structuredClone(request);
  const original = compileCadModel(source, { sourceVersion: 0 }); assert.equal(original.ok, true); assert.deepEqual(original.model.objects[1], s);
  const requestFile = jsonFile(name + '.request', request), result = elevate(request); assert.deepEqual(request, before); ownership([request], result);
  assert.deepEqual(Object.keys(result).sort(), ['request', 'source', 'originalModel', 'model', 'originalSurface', 'surface', 'provenance', 'report'].sort());
  const coefficient = coefficientOracle(result, fullProof), native = nativeOracle(result, fullProof), sourceProof = sourceOracle(result), report = result.report;
  assert.deepEqual([grid(result.surface).u, grid(result.surface).v, native.observationCount, native.evaluated, native.refused, coefficient.stripCount], expected);
  assert.deepEqual(report.degrees, { original: degrees(s), elevated: degrees(result.surface) }); assert.deepEqual(report.grids, { original: grid(s), elevated: grid(result.surface) });
  assert.deepEqual(report.knotCounts, { original: { u: s.knotsU.length, v: s.knotsV.length }, elevated: { u: result.surface.knotsU.length, v: result.surface.knotsV.length } });
  assert.deepEqual(report.domain, domains(s)); assert.deepEqual(domains(result.surface), domains(s));
  const selectedK = axis === 'u' ? result.surface.knotsU.length : result.surface.knotsV.length;
  assert.deepEqual(report.directCounts, { originalCompileCount: 1, candidateCompileCount: 1, coefficientElevationCallCount: coefficient.stripCount, nativeSurfaceValidationCount: 2, domainQueryCount: 2, patchCount: 4, decimalEmissionCount: 1 + selectedK + 4 * grid(result.surface).total, observationCount: native.observationCount, surfaceD0Count: 2 * native.observationCount, surfaceD1AttemptCount: 2 * native.observationCount, surfaceD1EvaluatedCount: native.evaluated, surfaceD1RefusedCount: native.refused, curveD0Count: 0, curveD1AttemptCount: 0, curveDomainQueryCount: 0, publicCurveElevationCallCount: 0, sourceWriterCallCount: 0, rationalOperationCount: 0 });
  const size = text => ({ utf16: text.length, utf8: Buffer.byteLength(text) });
  assert.deepEqual(report.sourceSizes, { original: size(source), candidate: size(result.source) }); assert.deepEqual(report.fileSizes, { request: size(nativeJSON(request) + '\n'), result: size(nativeJSON(result) + '\n') });
  for (const value of Object.values(report.preservation)) assert.equal(value, true);
  assert.equal(report.quality.geometricValidity, 'not-certified');
  for (const flag of ['topologyCertified', 'solid', 'globalShapeErrorCertified', 'globalBinary64ErrorCertified', 'g1g2Certified', 'manufacturingToleranceCertified', 'editorDisplayCertified', 'persistentTopologyBindingCertified', 'publication']) assert.equal(report.quality[flag], false);
  assert.deepEqual(validate(result), report);
  const originalFile = sourceFile(name + '.original', source, result.originalModel), candidateFile = sourceFile(name + '.candidate', result.source, result.model), saved = jsonFile(name + '.result', result);
  jsonFile(name + '.full-strip-receipts', result.provenance.strips); jsonFile(name + '.four-patches', result.provenance.patches);
  jsonFile(name + '.independent-coefficient-oracle', coefficient); jsonFile(name + '.independent-native-oracle', native); jsonFile(name + '.independent-source-oracle', sourceProof);
  retained.push({ value: request, before }); accepted.push({ result, beforeResult: structuredClone(result) });
  cases.push({ name, axis, requestFile: requestFile.file, resultFile: saved.file, originalFile, candidateFile, grid: grid(result.surface), directCounts: report.directCounts, receiptCounts: report.receiptCounts, fileSizes: report.fileSizes, idealCoefficientCount: coefficient.ideal?.coefficientCount ?? 0, fullIdealCampaign: fullProof });
  return { request, result, coefficient, native };
}
jsonFile('source-api.inputs', { entry, sourceInputs, cadInputs, sourceOnly: true, write: false, esbuildVersion: esbuild.version }); jsonFile('source-api.metafile', bundle.metafile);
assert.equal(api.elevateC0BezierChainCoefficientsTrusted, undefined, 'Private wide helper is not an alternate public constructor');
const originalMain = makeSurface('main_surface', 4, 4, [...Array(5).fill(-0), ...Array(5).fill(3)], [...Array(5).fill(-2), ...Array(5).fill(2)], 5, 5);
const main = positive('main-u-quartic', originalMain, 'u', [6, 5, 15, 30, 0, 5], true);
const vMain = positive('fresh-v-quartic', structuredClone(originalMain), 'v', [5, 6, 15, 30, 0, 5], true);
const c0Surface = makeSurface('nonuniform_c0_surface', 4, 1, [...Array(5).fill(-2), ...Array(4).fill(-0), ...Array(5).fill(3)], [-1, -1, 2, 2], 9, 2);
const c0 = positive('nonuniform-u-c0', c0Surface, 'u', [11, 2, 27, 48, 6, 2], true);
assert.ok(main.coefficient.stored.nonzero > 0); assert.ok(vMain.coefficient.stored.nonzero > 0); assert.ok(c0.coefficient.stored.nonzero > 0);
for (const o of c0.result.report.observations.filter(o => o.u === 0)) { assert.ok(Object.is(o.u, -0)); assert.equal(o.originalD1.status, 'refused-c0'); assert.equal(o.elevatedD1.status, 'refused-c0'); assert.equal(o.relativeDuDifference, null); assert.equal(o.relativeDvDifference, null); }
const capacitySurface = spans => makeSurface('capacity_surface', 2, 1, [...Array(3).fill(-0), ...Array.from({ length: spans - 1 }, (_, i) => Array(2).fill(i + 1)).flat(), ...Array(3).fill(spans)], [-0, -0, ...Array.from({ length: 14 }, (_, i) => i + 1), 15, 15], 2 * spans + 1, 16);
const capacity = positive('capacity-u2-five-span', capacitySurface(5), 'u', [16, 16, 651, 578, 724, 16], false);
assert.equal(cases.reduce((n, c) => n + c.idealCoefficientCount, 0), 336);
assert.equal(cases.reduce((n, c) => n + c.directCounts.coefficientElevationCallCount, 0), 28);
assert.equal(cases.reduce((n, c) => n + c.directCounts.observationCount, 0), 708);
assert.equal(cases.reduce((n, c) => n + c.directCounts.surfaceD0Count, 0), 1416); assert.equal(cases.reduce((n, c) => n + c.directCounts.surfaceD1AttemptCount, 0), 1416);
assert.equal(cases.reduce((n, c) => n + c.directCounts.surfaceD1EvaluatedCount, 0), 686); assert.equal(cases.reduce((n, c) => n + c.directCounts.surfaceD1RefusedCount, 0), 730);
assert.equal(cases.reduce((n, c) => n + c.directCounts.decimalEmissionCount, 0), 1417);
const generated = main.result.provenance.strips[2].calculation.spans[0].generated[0].outputPoleIndex, uIndex = generated, vIndex = 2;
assert.ok(!main.result.provenance.copiedPoles.some(p => p.elevatedUIndex === uIndex && p.elevatedVIndex === vIndex));
const editRequest = { source: main.result.source, sourceVersion: 0, surfaceId: main.result.surface.id, edits: { poleEdits: [{ uIndex, vIndex, zMM: main.result.surface.controlPoints[uIndex][vIndex][2] + .25 }] } };
const edit = editSourceSurfaceControlNetWide(editRequest); assert.deepEqual(validateSourceSurfaceControlNetWideEdit(edit), edit.report);
assert.ok(edit.report.maximumObservedChangeMM > 0); assert.notEqual(edit.source, main.result.source); assert.equal(edit.surface.degreeU, 5); assert.equal(edit.surface.degreeV, 4);
assert.deepEqual(edit.surface.knotsU, main.result.surface.knotsU); assert.deepEqual(edit.surface.knotsV, main.result.surface.knotsV); assert.deepEqual(edit.surface.weights, main.result.surface.weights);
for (let i = 0; i < edit.surface.controlPoints.length; i++) for (let j = 0; j < edit.surface.controlPoints[i].length; j++) if (i !== uIndex || j !== vIndex) assert.deepEqual(edit.surface.controlPoints[i][j], main.result.surface.controlPoints[i][j]);
for (const i of [0, 2]) assert.deepEqual(edit.model.objects[i], main.result.model.objects[i]);
const originalPoint = evaluateSurface(main.result.surface, 1.5, 0), changedPoint = evaluateSurface(edit.surface, 1.5, 0); assert.ok(Math.hypot(...changedPoint.map((v, i) => v - originalPoint[i])) > 0);
sourceFile('actual1147-generated-pole-edit', edit.source, edit.model); jsonFile('actual1147-generated-pole-edit.request', editRequest); jsonFile('actual1147-generated-pole-edit.result', edit);
const owned = structuredClone(main.result), ownReport = validate(owned); ownership([owned], ownReport); assert.deepEqual(ownReport, main.result.report);
function intact() { for (const row of retained) assert.deepEqual(row.value, row.before); for (const row of accepted) assert.deepEqual(row.result, row.beforeResult); for (const [file, bytes] of files) assert.deepEqual(readFileSync(file), bytes, file); }
function reject(name, action, code) {
  assert.throws(action, error => { assert.ok(error instanceof InsertionError); assert.equal(error.code, code, name); assert.ok(error.message.length <= 1024); failures.push({ name, code: error.code, message: error.message, causeName: error.cause?.name ?? null, causeCode: error.cause?.code ?? null, causeMessage: error.cause?.message ?? null }); intact(); return true; });
}
const over = capacitySurface(6), overSource = mixedSource(over, 'u'), overCold = compileCadModel(overSource, { sourceVersion: 0 }); assert.equal(overCold.ok, true); sourceFile('native-original13-by16-output19-by16-refusal', overSource, overCold.model);
reject('actual-selected-dimension-net304-knots23', () => elevate(requestFor(overSource, over.id, 'u', 3)), 'BUDGET');
const lower = makeSurface('lower_multiplicity_surface', 4, 1, [...Array(5).fill(-2), ...Array(3).fill(-0), ...Array(5).fill(3)], [-1, -1, 2, 2], 8, 2), lowerSource = mixedSource(lower, 'u'), lowerCold = compileCadModel(lowerSource, { sourceVersion: 0 }); assert.equal(lowerCold.ok, true); sourceFile('native-lower-multiplicity-surface', lowerSource, lowerCold.model);
reject('unsupported-selected-native-lower-basis', () => elevate(requestFor(lowerSource, lower.id, 'u', 5)), 'BASIS');
reject('invalid-axis', () => elevate({ ...main.request, axis: 'both' }), 'INPUT'); reject('wrong-target-degree', () => elevate({ ...main.request, targetDegree: 4 }), 'TARGET');
reject('selected5-no-op-not-elevation', () => elevate(requestFor(main.result.source, main.result.surface.id, 'u', 5)), 'TARGET');
reject('fixed-observation-budget', () => elevate({ ...main.request, maximumObservations: 1023 }), 'BUDGET'); reject('wrong-source-version', () => elevate({ ...main.request, sourceVersion: 1 }), 'VERSION');
reject('missing-surface', () => elevate({ ...main.request, surfaceId: 'missing_surface' }), 'TARGET'); reject('curve-id-is-not-surface', () => elevate({ ...main.request, surfaceId: 'surface_elevation_strip_0' }), 'TARGET');
reject('extra-request-field', () => elevate({ ...main.request, elevates: 1 }), 'INPUT');
const zero = structuredClone(originalMain); zero.knotsU[0] = +0; const zeroSource = mixedSource(zero, 'u'), zeroCold = compileCadModel(zeroSource, { sourceVersion: 0 }); assert.equal(zeroCold.ok, true); sourceFile('native-valid-selected-mixed-zero', zeroSource, zeroCold.model);
reject('selected-block-mixed-zero', () => elevate(requestFor(zeroSource, zero.id, 'u', 5)), 'BASIS');
const originalAST = compileCadModel(main.request.source, { sourceVersion: 0 }); assert.equal(originalAST.ok, true);
const selectedDeclaration = originalAST.ast.declarations.find(d => d.kind === 'surface' && d.id === main.request.surfaceId), start = selectedDeclaration.fields.find(f => f.name === 'weights').value.range.start;
const commented = main.request.source.slice(0, start + 1) + '/* protected full weight net */' + main.request.source.slice(start + 1), commentCold = compileCadModel(commented, { sourceVersion: 0 }); assert.equal(commentCold.ok, true); assert.deepEqual(commentCold.model, main.result.originalModel); sourceFile('genuine-protected-net-comment', commented, commentCold.model);
reject('protected-selected-array-comment', () => elevate({ ...main.request, source: commented }), 'TARGET');
const tinyOther = makeSurface('tiny_other_midpoint', 1, 1, [0, 0, 1, 1], [0, 0, Number.MIN_VALUE, Number.MIN_VALUE], 2, 2), tinySource = mixedSource(tinyOther, 'u'), tinyCold = compileCadModel(tinySource, { sourceVersion: 0 }); assert.equal(tinyCold.ok, true); sourceFile('native-valid-unrepresented-other-midpoint', tinySource, tinyCold.model);
reject('strict-opposite-midpoint-not-represented', () => elevate(requestFor(tinySource, tinyOther.id, 'u', 2)), 'REPRESENTABILITY');
const norm = { kind: 'surface', id: 'finite_du_component_infinite_norm', degreeU: 1, degreeV: 1, knotsU: [0, 0, 8e-307, 8e-307], knotsV: [0, 0, 1, 1], controlPoints: [[[-50, -50, -50], [-49, -49, -49]], [[50, 50, 50], [51, 51, 51]]], weights: [[1, 1], [1, 1]] };
const normSource = mixedSource(norm, 'u'), normCold = compileCadModel(normSource, { sourceVersion: 0 }); assert.equal(normCold.ok, true); sourceFile('genuine-whole-d1-partial-norm-source', normSource, normCold.model);
let normError; try { elevate(requestFor(normSource, norm.id, 'u', 2)); } catch (error) { normError = error; }
assert.ok(normError instanceof InsertionError); assert.ok(['REPRESENTABILITY', 'NATIVE'].includes(normError.code)); failures.push({ name: 'actual-partial-norm-or-prior-native-refusal', code: normError.code, message: normError.message, causeName: normError.cause?.name ?? null, causeMessage: normError.cause?.message ?? null }); intact();
let getterCalls = 0; const getter = { ...main.request }; Object.defineProperty(getter, 'axis', { enumerable: true, get() { getterCalls++; return 'u'; } }); reject('request-getter', () => elevate(getter), 'INPUT'); assert.equal(getterCalls, 0);
const hidden = { ...main.request }; Object.defineProperty(hidden, 'hidden', { value: 1 }); reject('hidden-request', () => elevate(hidden), 'INPUT'); const symbol = { ...main.request }; symbol[Symbol('extra')] = 1; reject('symbol-request', () => elevate(symbol), 'INPUT');
const cyclic = { ...main.request }; cyclic.cycle = cyclic; reject('cyclic-request', () => elevate(cyclic), 'INPUT'); const sparse = { ...main.request, extra: [1, 2] }; delete sparse.extra[0]; reject('sparse-request', () => elevate(sparse), 'INPUT');
const foreign = { ...main.request }; Object.setPrototypeOf(foreign, Date.prototype); reject('foreign-request', () => elevate(foreign), 'INPUT'); reject('nonfinite-target', () => elevate({ ...main.request, targetDegree: Infinity }), 'INPUT');
for (const [name, base, mutate] of [
  ['request-source', main.result, r => { r.request.source += ' '; }], ['candidate-source', main.result, r => { r.source += ' '; }],
  ['model-sibling', main.result, r => { r.model.objects[0].controlPoints[0][0] = .125; }], ['surface-net', main.result, r => { r.surface.controlPoints[1][2][0] += .125; }],
  ['axis', main.result, r => { r.provenance.axis = 'v'; }], ['selected-degree', main.result, r => { r.surface.degreeU--; }],
  ['strip-original', main.result, r => { r.provenance.strips[0].originalCurve.weights[1] += .125; }], ['strip-generated', main.result, r => { r.provenance.strips[0].calculation.spans[0].generated[0].homogeneous[0] += .125; }],
  ['cross-strip-broadcast', main.result, r => { r.provenance.strips[1].calculation.candidate.weights[1] = r.provenance.strips[0].calculation.candidate.weights[1]; }],
  ['copied-map', main.result, r => { r.provenance.copiedPoles[0].elevatedUIndex++; }], ['knot-bit', main.result, r => { r.provenance.knots.find(k => k.originalKnotIndex === null && k.value === 0).value = +0; }],
  ['patch-range', main.result, r => { r.provenance.patches[0].startUTF16++; }], ['degree-patch', main.result, r => { r.provenance.patches.find(p => p.field === 'degree-u').replacementText = '4'; }],
  ['native-point', main.result, r => { r.report.observations[0].elevatedPointMM[0] += .125; }],
  ['whole-c0-opposite-partial', c0.result, r => { r.report.observations.find(o => o.originalD1.status === 'refused-c0').relativeDvDifference = 0; }],
  ['counter', main.result, r => { r.report.directCounts.coefficientElevationCallCount++; }], ['file-size', main.result, r => { r.report.fileSizes.result.utf8++; }], ['false-global-claim', main.result, r => { r.report.quality.globalBinary64ErrorCertified = true; }]
]) { const changed = structuredClone(base), before = nativeJSON(changed); mutate(changed); assert.notEqual(nativeJSON(changed), before, 'Non-noop owned mutation ' + name); reject('owned-' + name, () => validate(changed), 'OWNED'); }
let previous = main.result; reject('atomic-prior-retention', () => { previous = elevate(requestFor(overSource, over.id, 'u', 3)); }, 'BUDGET'); assert.strictEqual(previous, main.result); jsonFile('atomic-retention', { previousGeometrySourcesCallerAndFilesRetained: true, getterCalls });
const packageRoot = resolve(repo, 'packages/barocss-cad'), manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')), declared = manifest.publishConfig?.exports?.['.'] ?? manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types), leafDeclarationPath = resolve(packageRoot, 'dist/nurbs/source-wide/source-surface-degree-elevation.d.ts');
const publicAPI = await import(pathToFileURL(runtimePath).href); for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function'); assert.deepEqual(publicAPI.SourceSurfaceDegreeElevationDiagnosticCode, codes);
assert.equal(publicAPI.elevateC0BezierChainCoefficientsTrusted, undefined); assert.ok(readFileSync(declarationPath, 'utf8').includes('./source-surface-degree-elevation.js')); for (const name of [...runtimeNames, ...typeNames]) assert.ok(readFileSync(leafDeclarationPath, 'utf8').includes(name), name);
const currentRequest = JSON.parse(readFileSync(cases[0].requestFile, 'utf8')), currentResult = JSON.parse(readFileSync(cases[0].resultFile, 'utf8'));
assert.deepEqual(publicAPI.elevateSourceSurfaceAxisDegree(currentRequest), currentResult); assert.deepEqual(publicAPI.validateSourceSurfaceAxisDegreeElevation(currentResult), currentResult.report);
for (const [source, model] of [[currentRequest.source, currentResult.originalModel], [currentResult.source, currentResult.model]]) { const cold = publicAPI.compileCadModel(source, { sourceVersion: 0 }); assert.equal(cold.ok, true); assert.deepEqual(cold.model, model); }
const emittedArtifacts = ['index.js', 'index.d.ts', 'source-surface-degree-elevation.js', 'source-surface-degree-elevation.d.ts', 'curve-c0-degree-elevation-internal.js', 'curve-c0-degree-elevation-internal.d.ts'].map(name => { const path = resolve(packageRoot, 'dist', name); assert.ok(existsSync(path)); const bytes = readFileSync(path); return { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }; });
const compiledConsumer = { runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 8, currentMainReplayCount: 1, privateProviderBarrelExported: false, emittedArtifacts };
jsonFile('compiled-consumer', compiledConsumer); intact(); assert.equal(cases.length, 4);
const summary = { sourceMode: true, cases, failures, compiledConsumer, getterCalls, actual1147GeneratedPole: { uIndex, vIndex }, fullIdealCoefficientCount: 336, capacityFractionCampaign: false, work, workScope: 'Initial elevation report counts only; native oracles, owned/cold/public/editor replays are additional actual work.', scope: 'Complete-source one-axis C0 Bernstein Surface elevation. Ideal whole tensor identity, actual stored rounding and native D0/D1 unions remain separate; no wider basis/elevation, global error/regularity/G1G2/Body/Solid/editor/renderer/manufacturing/publication acceptance.' };
jsonFile('summary', summary); intact(); console.log(JSON.stringify(summary));
