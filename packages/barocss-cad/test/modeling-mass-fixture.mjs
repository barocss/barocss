import assert from 'node:assert/strict';
import { signedData, sha256, dataHash, exactData, deepFrozen, snapshotData, errorData, work } from './modeling-offset-fixture.mjs';
export { signedData, sha256, dataHash, exactData, deepFrozen, snapshotData, errorData, work };

export const AUTHORED_SHA256 = 'eaba13758f93e97a72a808e9f3d2bd54ae1a2c1d4a841c870608953abd8619da';
export const EXPECTED_CAMPAIGN = Object.freeze({ modelCalls: 3, sourceModelCalls: 2, coldModelCalls: 1,
  massQueries: 6, sourceMassQueries: 5, coldMassQueries: 1, tessellations: 0, standaloneValidators: 0,
  sourceDerived: { evaluatedPrismFeatures: 5, standaloneSketchRoots: 4, modelDifferenceRoots: 3, qualifiedBoxAdapters: 6,
    modelBooleanPanels: 124, convexMassParentValidations: 1, convexFaces: 6, convexFanTriangles: 12,
    convexParentCompilations: 6, convexParentBindingObservations: 72, convexParentD1: 216,
    massBooleanRootsIncludingRefusal: 5, massBooleanPanelsIncludingRefusal: 216, totalBooleanRoots: 8, totalBooleanPanels: 340 },
  conservativeProviderCeilings: { convexFaces: 12, convexFanTriangles: 40, cellsPerBoolean: 27, panelsPerBoolean: 72 },
  fullTransitiveNativeCoverage: 'NOT_MEASURED' });

// Independent exact box moments, not the implementation's rational context,
// mass provider, native validator or geometry engine. All arithmetic is BigInt.
const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
const q = (n, d = 1n) => { n = BigInt(n); d = BigInt(d); assert.notEqual(d, 0n); if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d); return [n / g, d / g]; };
const add = (a, b) => q(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const neg = a => [-a[0], a[1]], sub = (a, b) => add(a, neg(b));
const mul = (a, b) => q(a[0] * b[0], a[1] * b[1]), div = (a, b) => q(a[0] * b[1], a[1] * b[0]);
const abs = a => [a[0] < 0n ? -a[0] : a[0], a[1]], cmp = (a, b) => Math.sign(Number(a[0] * b[1] - b[0] * a[1]));
const text = a => ({ numerator: String(a[0]), denominator: String(a[1]) });
const fromText = a => { assert.deepEqual(Object.keys(a).sort(), ['denominator', 'numerator']); return q(BigInt(a.numerator), BigInt(a.denominator)); };
const zero = q(0), matrix = fn => Array.from({ length: 3 }, (_, i) => Array.from({ length: 3 }, (_, j) => fn(i, j)));
function box(lo, hi) {
  const widths = lo.map((x, i) => q(hi[i] - x)), center = lo.map((x, i) => q(x + hi[i], 2));
  const volume = widths.reduce(mul, q(1)), first = center.map(x => mul(volume, x));
  const second = matrix((i, j) => mul(volume, add(mul(center[i], center[j]), i === j ? div(mul(widths[i], widths[i]), q(12)) : zero)));
  return { volume, first, second };
}
export function oracle(kind, density = 2700) {
  assert.ok(['plate', 'pocket', 'window'].includes(kind)); assert.ok([2700, 5400].includes(density));
  const parent = box([0, 0, 0], [32, 24, 8]);
  const tool = kind === 'plate' ? null : box([8, 8, kind === 'window' ? 0 : 4], [24, 16, 8]);
  const volume = sub(parent.volume, tool?.volume ?? zero), first = parent.first.map((x, i) => sub(x, tool?.first[i] ?? zero));
  const second = matrix((i, j) => sub(parent.second[i][j], tool?.second[i][j] ?? zero));
  const centroid = first.map(x => div(x, volume)), central = matrix((i, j) => sub(second[i][j], div(mul(first[i], first[j]), volume)));
  const trace = central.reduce((sum, row, i) => add(sum, row[i]), zero);
  return { volumeMM3: text(volume), mass: text(mul(volume, q(density, 1000000000))), centroidMM: centroid.map(text),
    inertiaCentroid: matrix((i, j) => text(mul(i === j ? sub(trace, central[i][j]) : neg(central[i][j]), q(density, 1000000000000000)))) };
}
function binary64(value) {
  assert.ok(Number.isFinite(value)); if (value === 0) return zero;
  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value); const bits = view.getBigUint64(0);
  const negative = bits >> 63n, exponent = Number((bits >> 52n) & 2047n), fraction = bits & ((1n << 52n) - 1n);
  let n = (exponent === 0 ? fraction : fraction + (1n << 52n)) * (negative ? -1n : 1n), d = 1n;
  const shift = exponent === 0 ? -1074 : exponent - 1023 - 52;
  if (shift >= 0) n <<= BigInt(shift); else d <<= BigInt(-shift); return q(n, d);
}
function nextDownPositive(value) {
  assert.ok(value > 0 && Number.isFinite(value)); const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value); view.setBigUint64(0, view.getBigUint64(0) - 1n); return view.getFloat64(0);
}
function projection(value, fraction, error) {
  const exact = fromText(fraction);
  // These independently calculated oracle numerators/denominators are exactly
  // representable integers, so this one division is correctly rounded binary64.
  assert.ok(Number.isSafeInteger(Number(exact[0])) && Number.isSafeInteger(Number(exact[1])));
  assert.equal(value, Number(exact[0]) / Number(exact[1]));
  if (!error) return;
  assert.deepEqual(Object.keys(error).sort(), ['exact', 'upper']);
  const difference = abs(sub(exact, binary64(value))); exactData(error.exact, text(difference));
  assert.ok(Number.isFinite(error.upper) && error.upper >= 0);
  assert.ok(cmp(binary64(error.upper), difference) >= 0);
  if (difference[0] === 0n) assert.equal(error.upper, 0);
  else { assert.ok(error.upper > 0); assert.ok(cmp(binary64(nextDownPositive(error.upper)), difference) < 0); }
}
export function proveMass(result, snapshot, outputName, kind, density = 2700) {
  const expected = oracle(kind, density), body = snapshot.bodies[outputName];
  deepFrozen(result); assert.equal(result.outputName, outputName); assert.equal(result.family, body.family); assert.equal(result.density, density);
  assert.deepEqual(Object.keys(result).sort(), ['centroidMM', 'density', 'details', 'family', 'inertiaCentroid', 'mass', 'outputName', 'volumeMM3']);
  exactData(result.details.exact, expected);
  assert.deepEqual(Object.keys(result.details).sort(), ['conversionErrors', 'exact', 'native']);
  assert.deepEqual(Object.keys(result.details.conversionErrors).sort(), ['centroidMM', 'inertiaCentroid', 'mass']);
  const errors = result.details.conversionErrors;
  projection(result.volumeMM3, expected.volumeMM3); projection(result.mass, expected.mass, errors.mass);
  expected.centroidMM.forEach((x, i) => projection(result.centroidMM[i], x, errors.centroidMM[i]));
  expected.inertiaCentroid.forEach((row, i) => row.forEach((x, j) => {
    projection(result.inertiaCentroid[i][j], x, errors.inertiaCentroid[i][j]);
    assert.ok(Object.is(result.inertiaCentroid[i][j], result.inertiaCentroid[j][i]));
  }));
  const native = result.details.native, convex = result.family === 'convex-planar', measure = convex ? native.measure : native.total;
  exactData(convex ? native.solid : native.boolean, body.native);
  assert.equal(native.options.density, density);
  exactData(native.options, convex ? { density: density, maximumFanTriangles: 40 } : { density: density, maximumCells: 27 });
  assert.equal(native.report.sourceFrame, 'authored-xyz-no-axis-conversion'); assert.equal(native.report.quality.densityCertified, false);
  assert.equal(native.report.quality.parentProofUnchanged, true);
  const diagonal = expected.inertiaCentroid.map((row, i) => fromText(row[i])), stored = result.inertiaCentroid.map((row, i) => binary64(row[i]));
  const minors = d => [d[0], mul(d[0], d[1]), d.reduce(mul, q(1))].map(text);
  const pd = measure.positiveDefinite;
  exactData(convex ? pd.exactCentroidLeadingMinors : pd.exactLeadingMinors, minors(diagonal));
  exactData(convex ? pd.storedCentroidLeadingMinors : pd.storedLeadingMinors, minors(stored));
  if (convex) {
    assert.equal(native.report.integration.faceCount, 6); assert.equal(native.report.integration.fanTriangles, 12);
    assert.equal(native.report.parentNativeWork.sourceCompilationCount, 6);
    assert.equal(native.report.parentNativeWork.bindingObservationCount, 72); assert.equal(native.report.parentNativeWork.totalD1Count, 216);
  } else {
    assert.equal(native.report.bodyCount, 1); assert.equal(native.report.empty, false); assert.equal(native.bodies.length, 1);
    assert.equal(native.report.directCounts.booleanValidationCount, 1);
    assert.equal(native.boolean.panels.length, kind === 'window' ? 32 : 46);
    assert.equal(native.report.volumeMM3, result.volumeMM3);
  }
  return { family: result.family, outputName, volumeMM3: result.volumeMM3, mass: result.mass,
    centroidMM: result.centroidMM, inertiaCentroid: result.inertiaCentroid, exact: expected,
    resultSHA256: dataHash(result), nativeSHA256: dataHash(native), parentSHA256: dataHash(body.native),
    returnedReport: native.report, exactIndependentBoxMomentOracle: true, deepFrozenInActualProcess: true };
}
export function hold(snapshot) {
  return { text: snapshot.save(), bodies: snapshot.bodies, evidence: snapshot.evidence, parameters: snapshot.parameters,
    suppression: snapshot.suppression, recomputation: snapshot.recomputation, hash: dataHash(snapshotData(snapshot)) };
}
export function unchanged(snapshot, before) {
  assert.equal(snapshot.save(), before.text);
  for (const key of ['bodies', 'evidence', 'parameters', 'suppression', 'recomputation']) assert.equal(snapshot[key], before[key]);
  assert.equal(dataHash(snapshotData(snapshot)), before.hash); deepFrozen(snapshot);
}
