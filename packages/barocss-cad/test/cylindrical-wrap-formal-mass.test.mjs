import test from 'node:test';
import assert from 'node:assert/strict';
import { prismaticFromProfile, brepFromPrismatic } from '../dist/index.js';
import { certifyCylindricalWrapFormalPadMass, isFormalPadMassError } from '../dist/features/cylindrical-wrap-formal-mass.js';
import { isCylindricalWrapSourceError } from '../dist/features/cylindrical-wrap-source.js';
import { isCylindricalWrapMapError } from '../dist/features/cylindrical-wrap-map.js';
import { readNativeSIInertia } from '../dist/internal/native-si-mass-state.js';
import { SectionRationalContext } from '../dist/section-rational-internal.js';

const rectangle = { u: [0.1, 0.4], v: [0.2, 0.7] };
const budgets = { volume: 1e-8, mass: 1e-10, centroid: [1e-10, 1e-10, 1e-10], inertia: [1e-7, 1e-7, 1e-7, 1e-7, 1e-7, 1e-7] };
function options(density = 1) { return { id: 'formal', density, budgets: structuredClone(budgets) }; }
function native(radius = 10, z0 = 0, height = 30) {
  const solid = structuredClone(prismaticFromProfile({ outer: [{ kind: 'arc', start: [radius, 0], center: [0, 0], direction: 'ccw' }], height, from: z0, tag: 'post' }));
  return { solid: { kind: 'upright', solid }, brep: brepFromPrismatic(solid, { id: 'post' }) };
}
function refused(action, code) {
  assert.throws(action, error => (isFormalPadMassError(error) || isCylindricalWrapSourceError(error) || isCylindricalWrapMapError(error)) && (code === undefined || error.code === code));
}
function numeric(value) { return Number(value.numerator) / Number(value.denominator); }

// Independent oracle: generic rational Bernstein summation, 256-bit signed intervals,
// 160-term atan at <=1/2, and pi/4=atan(1/2)+atan(1/3). The candidate uses
// de Casteljau rays, 128-bit intervals, 24 terms, Machin's formula, and <=1/5.
// The angular monomials below use complex Laurent expansion, not the candidate's six formulas.
const OS = 1n << 256n;
function gcd(a, b) { a = a < 0n ? -a : a; while (b) [a, b] = [b, a % b]; return a; }
function r(n, d = 1n) { if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; }
function add(a, b) { return r(a.n * b.d + b.n * a.d, a.d * b.d); }
function sub(a, b) { return add(a, { n: -b.n, d: b.d }); }
function mul(a, b) { return r(a.n * b.n, a.d * b.d); }
function div(a, b) { return r(a.n * b.d, a.d * b.n); }
function power(a, n) { let out = r(1n); for (let i = 0; i < n; i++) out = mul(out, a); return out; }
function from(value) {
  const data = new DataView(new ArrayBuffer(8)); data.setFloat64(0, value); const bits = data.getBigUint64(0);
  const exponent = Number((bits >> 52n) & 2047n), significand = exponent ? (1n << 52n) + (bits & 0xfffffffffffffn) : bits & 0xfffffffffffffn;
  const signed = bits >> 63n ? -significand : significand, e = exponent ? exponent - 1075 : -1074;
  return e < 0 ? r(signed, 1n << BigInt(-e)) : r(signed << BigInt(e));
}
function floor(n, d) { const q = n / d; return n < 0n && n % d ? q - 1n : q; }
function ceil(n, d) { return -floor(-n, d); }
function exact(value) { return [floor(value.n * OS, value.d), ceil(value.n * OS, value.d)]; }
function ip(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
function im(a, b) { return [a[0] - b[1], a[1] - b[0]]; }
function it(a, b) { const p = [a[0] * b[0], a[0] * b[1], a[1] * b[0], a[1] * b[1]]; let lo = p[0], hi = p[0]; for (const v of p) { if (v < lo) lo = v; if (v > hi) hi = v; } return [floor(lo, OS), ceil(hi, OS)]; }
function ik(a, b) { return b.n >= 0n ? [floor(a[0] * b.n, b.d), ceil(a[1] * b.n, b.d)] : [floor(a[1] * b.n, b.d), ceil(a[0] * b.n, b.d)]; }
function iq(a, b) { assert.ok(b[0] > 0n); const lows = [], highs = []; for (const n of a) for (const d of b) { lows.push(floor(n * OS, d)); highs.push(ceil(n * OS, d)); } return [lows.reduce((x, y) => x < y ? x : y), highs.reduce((x, y) => x > y ? x : y)]; }
function choose(n, k) { let out = 1n; for (let i = 1; i <= k; i++) out = out * BigInt(n - i + 1) / BigInt(i); return out; }
function bernstein(values, t) {
  const n = values.length - 1, oneMinus = sub(r(1n), t); let out = r(0n);
  for (let k = 0; k <= n; k++) out = add(out, mul(r(choose(n, k)), mul(values[k], mul(power(t, k), power(oneMinus, n - k)))));
  return out;
}
function atanSeries(value) {
  assert.ok(value.n >= 0n && 2n * value.n <= value.d);
  const x = exact(value), x2 = it(x, x); let p = x, out = [0n, 0n];
  for (let i = 0; i < 160; i++) { const term = ik(p, r(1n, BigInt(2 * i + 1))); out = i % 2 ? im(out, term) : ip(out, term); p = it(p, x2); }
  return [out[0], out[1] + ceil(p[1], 321n)];
}
const oracleHalf = atanSeries(r(1n, 2n));
const oraclePiHalf = ik(ip(oracleHalf, atanSeries(r(1n, 3n))), r(2n));
function atan(value) {
  return 2n * value.n <= value.d ? atanSeries(value) : ip(oracleHalf, atanSeries(div(sub(value, r(1n, 2n)), add(r(1n), mul(value, r(1n, 2n))))));
}
function root(value) {
  if (!value) return 0n;
  let x = 1n << BigInt(Math.ceil(value.toString(2).length / 2));
  for (;;) { const next = (x + value / x) / 2n; if (next >= x) { assert.ok(x * x <= value && (x + 1n) ** 2n > value); return x; } x = next; }
}
function ray(surface, u) {
  const t = div(sub(from(u), from(surface.knotsU[2])), sub(from(surface.knotsU[3]), from(surface.knotsU[2]))), xs = [], ys = [];
  for (let i = 0; i < 3; i++) { xs.push(mul(from(surface.controlPoints[i][0][0]), from(surface.weights[i][0]))); ys.push(mul(from(surface.controlPoints[i][0][1]), from(surface.weights[i][0]))); }
  const x = bernstein(xs, t), y = bernstein(ys, t), a = x.n * y.d, b = y.n * x.d, n = (a * a + b * b) * OS * OS, low = root(n), high = low * low === n ? low : low + 1n;
  const cosine = [floor(a * OS * OS, high), ceil(a * OS * OS, low)], sine = [floor(b * OS * OS, high), ceil(b * OS * OS, low)];
  const angle = x.n * y.d >= y.n * x.d ? atan(div(y, x)) : im(oraclePiHalf, atan(div(x, y)));
  return { angle, cosine, sine };
}
function complexTimes(a, b) { return [im(it(a[0], b[0]), it(a[1], b[1])), ip(it(a[0], b[1]), it(a[1], b[0]))]; }
function harmonic(endpoint, k) {
  let out = [[OS, OS], [0n, 0n]];
  for (let i = 0; i < Math.abs(k); i++) out = complexTimes(out, [endpoint.cosine, k < 0 ? ik(endpoint.sine, r(-1n)) : endpoint.sine]);
  return out;
}
function angularMonomial(a, b, first, last) {
  let coefficients = new Map([[0, [r(1n), r(0n)]]]);
  for (let i = 0; i < a + b; i++) {
    const next = new Map(), sine = i >= a;
    for (const [k, c] of coefficients) for (const sign of [-1, 1]) {
      const factor = sine ? [r(0n), r(BigInt(-sign), 2n)] : [r(1n, 2n), r(0n)];
      const product = [sub(mul(c[0], factor[0]), mul(c[1], factor[1])), add(mul(c[0], factor[1]), mul(c[1], factor[0]))], old = next.get(k + sign) ?? [r(0n), r(0n)];
      next.set(k + sign, [add(old[0], product[0]), add(old[1], product[1])]);
    }
    coefficients = next;
  }
  let out = [0n, 0n];
  for (const [k, c] of coefficients) {
    let integral;
    if (!k) integral = [im(last.angle, first.angle), [0n, 0n]];
    else { const f = harmonic(first, k), l = harmonic(last, k); integral = [ik(im(l[1], f[1]), r(1n, BigInt(k))), ik(im(l[0], f[0]), r(-1n, BigInt(k)))]; }
    out = ip(out, im(ik(integral[0], c[0]), ik(integral[1], c[1])));
  }
  return out;
}
const exponents = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [2, 0, 0], [0, 2, 0], [0, 0, 2], [1, 1, 0], [1, 0, 1], [0, 1, 1]];
function oracle(result) {
  const source = result.source, rect = result.rectangle, first = ray(source.quarter, rect.u[0]), last = ray(source.quarter, rect.u[1]);
  const radius = from(source.radius), z0 = from(source.z[0]), z1 = from(source.z[1]), h = sub(z1, z0), center = div(add(z0, z1), r(2n));
  const v0 = from(source.quarter.knotsV[1]), vs = sub(from(source.quarter.knotsV[2]), v0);
  const low = sub(add(z0, mul(h, div(sub(from(rect.v[0]), v0), vs))), center), high = sub(add(z0, mul(h, div(sub(from(rect.v[1]), v0), vs))), center);
  const pi = ik(oraclePiHalf, r(2n)), base = [], pad = [], total = [];
  for (let i = 0; i < 10; i++) {
    const [a, b, c] = exponents[i], p = a + b + 2, radial = mul(r((1n << BigInt(p)) - 1n, BigInt(p)), power(radius, p));
    const axial = div(sub(power(high, c + 1), power(low, c + 1)), r(BigInt(c + 1)));
    pad.push(ik(angularMonomial(a, b, first, last), mul(radial, axial)));
    if (i === 0) base.push(ik(pi, mul(power(radius, 2), h)));
    else if (i === 4 || i === 5) base.push(ik(pi, div(mul(power(radius, 4), h), r(4n))));
    else if (i === 6) base.push(ik(pi, div(mul(power(radius, 2), power(h, 3)), r(12n))));
    else base.push([0n, 0n]);
    total.push(ip(base[i], pad[i]));
  }
  const centroid = [iq(total[1], total[0]), iq(total[2], total[0]), ip(iq(total[3], total[0]), exact(center))];
  const central = [];
  for (const [raw, x, y] of [[4, 1, 1], [5, 2, 2], [6, 3, 3], [7, 1, 2], [8, 1, 3], [9, 2, 3]]) central.push(im(total[raw], iq(it(total[x], total[y]), total[0])));
  const factor = div(from(result.options.density), r(1000n));
  const inertia = [ik(ip(central[1], central[2]), factor), ik(ip(central[0], central[2]), factor), ik(ip(central[0], central[1]), factor), ik(central[3], mul(factor, r(-1n))), ik(central[4], mul(factor, r(-1n))), ik(central[5], mul(factor, r(-1n)))];
  return { base, pad, total, centroid, inertia, mass: ik(total[0], factor), first, last, pi };
}
function encloses(actual, independent) {
  assert.ok(BigInt(actual.lower.numerator) * OS <= independent[0] * BigInt(actual.lower.denominator), 'candidate lower encloses independent oracle');
  assert.ok(BigInt(actual.upper.numerator) * OS >= independent[1] * BigInt(actual.upper.denominator), 'candidate upper encloses independent oracle');
}
function scalarAudit(actual, independent) {
  encloses(actual, independent); const value = from(actual.estimate), endpoints = [r(independent[0], OS), r(independent[1], OS)], error = r(BigInt(actual.error.numerator), BigInt(actual.error.denominator));
  for (const endpoint of endpoints) { const delta = sub(value, endpoint), absolute = r(delta.n < 0n ? -delta.n : delta.n, delta.d); assert.ok(error.n * absolute.d >= absolute.n * error.d, 'actual Number error includes independent target'); }
}
function receipt(result) {
  assert.equal(result.authority, 'formal-native-cylinder-union-ideal-scale2-annular-sector'); assert.equal(result.solidQualified, false);
  assert.equal(result.meaning.literalStoredBrepMass, false); assert.equal(result.meaning.partMassProvider, false); assert.equal(result.meaning.nativeBinding, false);
  assert.equal(result.meaning.nativeSIAccuracy, false); assert.equal(result.representation.includedInMassError, false);
  assert.deepEqual(Object.keys(result.representation).sort(), ['includedInMassError', 'selectedQuarterOuterRadial', 'selectedQuarterRadial']);
  assert.deepEqual(result.representation.selectedQuarterRadial, result.source.carrier.bounds.radial.exact);
  const radial = result.representation.selectedQuarterRadial, outer = result.representation.selectedQuarterOuterRadial;
  assert.equal(BigInt(outer.numerator) * BigInt(radial.denominator), 2n * BigInt(radial.numerator) * BigInt(outer.denominator));
  assert.ok(result.counts.totalOperations <= (result.options.maxOperations ?? 200000)); assert.ok(result.counts.gcdSteps <= 200000);
  assert.ok(result.counts.maximumBits <= 8192 && result.counts.work <= 1048576); assert.ok(result.positiveAddedVolume);
}

test('actual native rays and all ten source/pad/raw moments enclose an independent complex-polar oracle', () => {
  const part = native(), before = structuredClone(part), result = certifyCylindricalWrapFormalPadMass(part, rectangle, options()); receipt(result);
  const expected = oracle(result);
  for (let i = 0; i < 10; i++) { encloses(result.sourceMoments[i], expected.base[i]); encloses(result.padMoments[i], expected.pad[i]); scalarAudit(result.moments[i], expected.total[i]); }
  encloses(result.angles.alpha, expected.first.angle); encloses(result.angles.beta, expected.last.angle); encloses(result.angles.pi, expected.pi);
  // Canonical full-cylinder closed forms: V=3000pi, XX=YY=75000pi, ZZ=225000pi.
  for (const [i, coefficient] of [[0, 3000n], [4, 75000n], [5, 75000n], [6, 225000n]]) encloses(result.sourceMoments[i], ik(expected.pi, r(coefficient)));
  for (const i of [1, 2, 3, 7, 8, 9]) { assert.equal(result.sourceMoments[i].lower.numerator, '0'); assert.equal(result.sourceMoments[i].upper.numerator, '0'); }
  assert.deepEqual(part, before); assert.equal(result.frame.zCenter.numerator, '15');
});

test('public MMGS values are audited against exact represented density divided by1000', () => {
  for (const density of [1, 0.1, 1e-3, 7.85]) {
    const result = certifyCylindricalWrapFormalPadMass(native(), rectangle, options(density)), expected = oracle(result); receipt(result);
    scalarAudit(result.audit.volume, expected.total[0]); scalarAudit(result.audit.mass, expected.mass);
    for (let i = 0; i < 3; i++) scalarAudit(result.audit.centroid[i], expected.centroid[i]);
    for (let i = 0; i < 6; i++) scalarAudit(result.audit.inertia[i], expected.inertia[i]);
    assert.equal(result.properties.method, 'closed-form');
    const nativeSI = readNativeSIInertia(result.properties); assert.equal(nativeSI.ok, true);
    for (const row of nativeSI.inertia) for (const value of row) assert.ok(Number.isFinite(value));
    // The internal basis survives the pure centroid translation; this does not claim a rigorous native SI bound.
    assert.equal(result.meaning.nativeSIAccuracy, false);
  }
});

test('negative source Z and asymmetric V preserve signed mixed moments and central inertia', () => {
  const rect = { u: [0.125, 0.375], v: [0.125, 0.5] }, original = certifyCylindricalWrapFormalPadMass(native(10, -20, 10), rect, options()), translated = certifyCylindricalWrapFormalPadMass(native(10, 80, 10), rect, options());
  for (const result of [original, translated]) {
    const expected = oracle(result); receipt(result);
    for (let i = 0; i < 10; i++) scalarAudit(result.moments[i], expected.total[i]);
    for (let i = 0; i < 6; i++) scalarAudit(result.audit.inertia[i], expected.inertia[i]);
    assert.ok(numeric(result.padMoments[3].upper) < 0); assert.ok(numeric(result.padMoments[8].upper) < 0 && numeric(result.padMoments[9].upper) < 0);
  }
  assert.equal(original.properties.volume, translated.properties.volume); assert.deepEqual(original.properties.inertia, translated.properties.inertia);
  assert.ok(Math.abs(translated.properties.centroid[2] - original.properties.centroid[2] - 100) < 1e-12);
});

test('centered axial pad retains exact zero Z/XZ/YZ and nonzero angular moments', () => {
  const result = certifyCylindricalWrapFormalPadMass(native(), { u: [0.125, 0.375], v: [0.25, 0.75] }, options()); receipt(result);
  for (const i of [3, 8, 9]) { assert.equal(result.moments[i].lower.numerator, '0'); assert.equal(result.moments[i].upper.numerator, '0'); }
  assert.ok(result.properties.centroid[0] > 0 && result.properties.centroid[1] > 0); assert.equal(result.properties.centroid[2], 15);
});

test('aggregate limits only tighten, and impossible scalar precision is not widened', () => {
  const part = native(); refused(() => certifyCylindricalWrapFormalPadMass(part, rectangle, { ...options(), maxOperations: 1 }), 'BUDGET');
  for (const maxOperations of [0, 200001, 2.5, Infinity]) refused(() => certifyCylindricalWrapFormalPadMass(part, rectangle, { ...options(), maxOperations }), 'INPUT');
  for (const key of ['volume', 'mass']) { const selected = options(); selected.budgets[key] = Number.MIN_VALUE; refused(() => certifyCylindricalWrapFormalPadMass(part, rectangle, selected), 'REPRESENTABILITY'); assert.equal(selected.budgets[key], Number.MIN_VALUE); }
  for (const key of ['centroid', 'inertia']) { const selected = options(); selected.budgets[key].fill(Number.MIN_VALUE); refused(() => certifyCylindricalWrapFormalPadMass(part, rectangle, selected), 'REPRESENTABILITY'); }
});

test('overflow, underflow, nonfinite input, invalid ranges, and radius overrides refuse', () => {
  const part = native();
  for (const density of [0, -1, NaN, Infinity]) refused(() => certifyCylindricalWrapFormalPadMass(part, rectangle, options(density)), 'INPUT');
  refused(() => certifyCylindricalWrapFormalPadMass(part, rectangle, options(Number.MIN_VALUE)), 'REPRESENTABILITY');
  refused(() => certifyCylindricalWrapFormalPadMass(part, rectangle, options(Number.MAX_VALUE)), 'SUPPORT');
  for (const rect of [{ u: [0, 0.4], v: [0.2, 0.7] }, { u: [0.1, 0.5], v: [0.2, 0.7] }, { u: [0.3, 0.2], v: [0.2, 0.7] }, { u: [0.1, 0.4], v: [0, 0.7] }, { u: [0.1, 0.4], v: [0.2, 1] }, { u: [0.1, 0.4], v: [0.5, 0.5] }]) refused(() => certifyCylindricalWrapFormalPadMass(part, rect, options()), 'INPUT');
  refused(() => certifyCylindricalWrapFormalPadMass(part, rectangle, { ...options(), radius: 10 }), 'INPUT');
  refused(() => certifyCylindricalWrapFormalPadMass(part, rectangle, { ...options(), certified: true }), 'INPUT');
  refused(() => certifyCylindricalWrapFormalPadMass(native(6000), rectangle, options()), 'SUPPORT');
  for (const value of [null, [], 1]) refused(() => certifyCylindricalWrapFormalPadMass(part, rectangle, value), 'INPUT');
});

test('all scalar budgets must be explicit positive finite values', () => {
  for (const value of [0, -1, Infinity, NaN, undefined]) {
    for (const key of ['volume', 'mass']) { const selected = options(); selected.budgets[key] = value; refused(() => certifyCylindricalWrapFormalPadMass(native(), rectangle, selected), 'INPUT'); }
    const selected = options(); selected.budgets.centroid[1] = value; refused(() => certifyCylindricalWrapFormalPadMass(native(), rectangle, selected), 'INPUT');
  }
  for (const [key, value] of [['centroid', [1]], ['inertia', [1, 1, 1]], ['extra', 1]]) { const selected = options(); selected.budgets[key] = value; refused(() => certifyCylindricalWrapFormalPadMass(native(), rectangle, selected), 'INPUT'); }
});

test('getters never supply authority and input/output snapshots do not alias', () => {
  let reads = 0; const selected = options(); Object.defineProperty(selected, 'density', { enumerable: true, get() { reads++; return 1; } });
  refused(() => certifyCylindricalWrapFormalPadMass(native(), rectangle, selected), 'INPUT'); assert.equal(reads, 0);
  const part = native(), before = structuredClone(part); Object.defineProperty(part, 'brep', { enumerable: true, get() { reads++; return before.brep; } });
  refused(() => certifyCylindricalWrapFormalPadMass(part, rectangle, options()), 'INPUT'); assert.equal(reads, 0);
  const source = native(), rect = structuredClone(rectangle), opts = options(), saved = structuredClone({ source, rect, opts });
  const result = certifyCylindricalWrapFormalPadMass(source, rect, opts); assert.deepEqual({ source, rect, opts }, saved);
  assert.notEqual(result.source.brep, source.brep); assert.notEqual(result.rectangle, rect); assert.notEqual(result.options, opts);
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.source.quarter.controlPoints[0][0]));
  assert.throws(() => { result.source.quarter.controlPoints[0][0][0] = 100; }, TypeError);
  assert.deepEqual({ source, rect, opts }, saved);
});


test('actual rays around the diagonal exercise the bounded three-step angle reduction', () => {
  const result = certifyCylindricalWrapFormalPadMass(native(), { u: [0.24, 0.26], v: [0.25, 0.75] }, options()), expected = oracle(result); receipt(result);
  encloses(result.angles.alpha, expected.first.angle); encloses(result.angles.beta, expected.last.angle);
  for (let i = 0; i < 10; i++) scalarAudit(result.moments[i], expected.total[i]);
});

test('changed actual source coefficients or native metadata cannot borrow formal-circle authority', () => {
  for (const field of ['weight', 'pole', 'name']) {
    const part = native(), face = part.brep.faces.find(item => item.surface.kind === 'surface' && item.surface.degreeU === 2);
    if (field === 'weight') face.surface.weights[1][0] += Number.EPSILON;
    else if (field === 'pole') face.surface.controlPoints[1][0][0] += 0.001;
    else face.name += '_changed';
    const before = structuredClone(part); refused(() => certifyCylindricalWrapFormalPadMass(part, rectangle, options())); assert.deepEqual(part, before);
  }
});


test('tiny valid source refuses the overflowing existing native SI density intermediate', () => {
  const part = native(0.01, 0, 1e-4), before = structuredClone(part), selected = options(1e306);
  assert.ok(Number.isFinite(selected.density)); assert.equal(Number.isFinite(selected.density * 1000), false);
  // MMGS can remain finite at this geometric scale. This helper does not repair the global SI reader.
  refused(() => certifyCylindricalWrapFormalPadMass(part, rectangle, selected), 'SUPPORT');
  assert.deepEqual(part, before); assert.equal(selected.density, 1e306);
});


function referenceFailure(code, detail) { assert.fail(`${code}: ${detail}`); }
function midpointReference(value, q) {
  const lower = q.rat(BigInt(value.lower.numerator), BigInt(value.lower.denominator));
  const upper = q.rat(BigInt(value.upper.numerator), BigInt(value.upper.denominator));
  return q.nearest(q.div(q.add(lower, upper), q.integer(2)));
}
test('all returned raw midpoint Number bits equal generic nearest on positive, negative and zero moments', () => {
  const fixtures = [
    {part:native(), rectangle:{u:[1/16,5/16],v:[1/4,3/4]}},
    {part:native(10,-7), rectangle},
    {part:native(20,-10), rectangle:{u:[0.24,0.26],v:[0.1,0.45]}},
  ];
  let negative = 0, zero = 0, positive = 0;
  for (const fixture of fixtures) {
    const result = certifyCylindricalWrapFormalPadMass(fixture.part,fixture.rectangle,options());
    const q = new SectionRationalContext(referenceFailure);
    for (const moment of result.moments) {
      assert.ok(Object.is(moment.estimate,midpointReference(moment,q)));
      if(moment.estimate<0)negative++;else if(moment.estimate>0)positive++;else{zero++;assert.ok(Object.is(moment.estimate,0));}
    }
  }
  assert.ok(negative>0 && zero>0 && positive>0);
});
