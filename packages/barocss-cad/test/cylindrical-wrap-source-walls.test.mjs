import test from 'node:test';
import assert from 'node:assert/strict';
import { prismaticFromProfile, brepFromPrismatic } from '../dist/index.js';
import { SectionRationalContext } from '../dist/section-rational-internal.js';
import { certifyCylindricalWallCycle, isWallCycleError } from '../dist/features/cylindrical-wrap-wall-cycle.js';
import { buildCylindricalWrapWallReference } from '../dist/features/cylindrical-wrap-source-walls.js';
import { buildCylindricalWrapBoundReference } from '../dist/features/cylindrical-wrap-bound-reference.js';

function source(radius = 10, z = -5) {
  const solid = prismaticFromProfile({ outer: [{ kind: 'arc', start: [radius, 0], center: [0, 0], direction: 'ccw' }], height: 30, from: z, tag: 'post' });
  return { solid: { kind: 'upright', solid }, brep: brepFromPrismatic(solid, { id: 'post' }) };
}
function operands(part) {
  const out = [];
  for (const face of part.brep.faces) {
    const s = face.surface;
    if (s.kind !== 'surface' || s.degreeU !== 2) continue;
    for (const span of [0, 1]) out.push({ face: face.id, span, sense: face.sense, controlPoints: s.controlPoints.slice(span * 2, span * 2 + 3).map(row => [...row[0]]), weights: s.weights.slice(span * 2, span * 2 + 3).map(row => row[0]) });
  }
  return out;
}
function context() {
  return { q: new SectionRationalContext((code, message) => { throw Object.assign(new Error(message), { code }); }), direct() {}, structure() {}, check() {}, integer(value) { assert.ok((value < 0n ? -value : value).toString(2).length <= 8192); return value; } };
}
function cycle(spans, radius = 10) { return certifyCylindricalWallCycle(spans, radius, context()); }
function options(maxOperations = 200000) {
  return { id: 'wrap', height: 10, density: 7.85, maxOperations, budgets: { volume: 1e-8, mass: 1e-10, centroid: [1e-10, 1e-10, 1e-10], inertia: [1e-7, 1e-7, 1e-7, 1e-7, 1e-7, 1e-7] } };
}
function pad(u = [0.125, 0.375]) { return [{ outer: [[u[0], 0.25], [u[1], 0.25], [u[1], 0.75], [u[0], 0.75]], holes: [] }]; }
function frozen(value) { if (value && typeof value === 'object') { assert.ok(Object.isFrozen(value)); for (const child of Object.values(value)) frozen(child); } }

// Independent generic rational Bernstein algebra. It does not use the production
// common dyadic denominator or the reduced quadratic angular/defect formulas.
function gcd(a, b) { if (a < 0n) a = -a; while (b) [a, b] = [b, a % b]; return a; }
function rat(n, d = 1n) { if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; }
function add(a, b) { return rat(a.n * b.d + b.n * a.d, a.d * b.d); }
function sub(a, b) { return rat(a.n * b.d - b.n * a.d, a.d * b.d); }
function mul(a, b) { return rat(a.n * b.n, a.d * b.d); }
function div(a, b) { return rat(a.n * b.d, a.d * b.n); }
function abs(a) { return rat(a.n < 0n ? -a.n : a.n, a.d); }
function cmp(a, b) { const v = a.n * b.d - b.n * a.d; return v < 0n ? -1 : v > 0n ? 1 : 0; }
function from(value) {
  const b = Buffer.alloc(8); b.writeDoubleBE(value); const bits = b.readBigUInt64BE(), exponent = Number(bits >> 52n & 2047n), fraction = bits & 0xfffffffffffffn;
  const n = (bits >> 63n ? -1n : 1n) * (exponent ? (1n << 52n) + fraction : fraction), power = exponent ? exponent - 1075 : -1074;
  return power < 0 ? rat(n, 1n << BigInt(-power)) : rat(n << BigInt(power));
}
function read(value) { return rat(BigInt(value.numerator), BigInt(value.denominator)); }
function choose(n, k) { let out = 1n; for (let i = 1; i <= k; i++) out = out * BigInt(n - i + 1) / BigInt(i); return out; }
function product(a, b) {
  const m = a.length - 1, n = b.length - 1, out = [];
  for (let k = 0; k <= m + n; k++) {
    let total = rat(0n);
    for (let i = Math.max(0, k - n); i <= Math.min(m, k); i++) total = add(total, mul(mul(a[i], b[k - i]), rat(choose(m, i) * choose(n, k - i), choose(m + n, k))));
    out.push(total);
  }
  return out;
}
function derivative(a) { return a.slice(1).map((value, i) => mul(sub(value, a[i]), rat(BigInt(a.length - 1)))); }
function minimum(values) { return values.reduce((a, b) => cmp(a, b) < 0 ? a : b); }
function maximum(values) { return values.reduce((a, b) => cmp(a, b) > 0 ? a : b); }
function directed(span) { return span.sense === 'forward' ? [0, 1, 2] : [2, 1, 0]; }
function oracle(span, radius) {
  const indices = directed(span), w = indices.map(i => from(span.weights[i])), x = indices.map((i, j) => mul(from(span.controlPoints[i][0]), w[j])), y = indices.map((i, j) => mul(from(span.controlPoints[i][1]), w[j]));
  const xx = product(x, x), yy = product(y, y), ww = product(w, w), r = from(radius), r2 = mul(r, r);
  const Q = xx.map((v, i) => sub(add(v, yy[i]), mul(r2, ww[i])));
  const left = product(x, derivative(y)), right = product(y, derivative(x)), K = left.map((v, i) => sub(v, right[i]));
  const m = minimum(w), radial = div(maximum(Q.map(abs)), mul(r, mul(m, m)));
  return { x, y, w, Q, K, radial };
}
function verify(spans, radius, result) {
  assert.equal(result.winding, 1); assert.equal(result.simpleRadialGraph, true); assert.equal(result.nativeEvaluatorCertified, false);
  assert.equal(result.authority, 'exact-stored-rational-coefficients');
  assert.equal(result.projection, 'xy');
  const radial = [];
  for (let i = 0; i < 4; i++) {
    const p = result.spans[i], independent = oracle(spans[i], radius);
    assert.deepEqual(p.radialDefectCoefficients.map(read), independent.Q);
    // Degree elevation by multiplication with the constant degree-one polynomial.
    assert.deepEqual(product(p.angularCoefficients.map(read), [rat(1n), rat(1n)]), independent.K);
    assert.ok(independent.K.every(value => value.n > 0n));
    assert.deepEqual(read(p.minimumWeight), minimum(independent.w));
    const normal = p.halfPlane.normal, dots = independent.x.map((v, j) => add(mul(v, from(normal[0])), mul(independent.y[j], from(normal[1]))));
    assert.ok(dots.every(value => value.n > 0n)); assert.deepEqual(read(p.halfPlane.minimum), minimum(dots));
    assert.deepEqual(read(p.radial), independent.radial); radial.push(independent.radial);
    assert.ok(cmp(independent.radial, from(1e-7)) <= 0); assert.ok(cmp(mul(independent.radial, rat(2n)), from(radius)) < 0);
  }
  assert.deepEqual(read(result.radial), maximum(radial)); assert.deepEqual(read(result.radialNormalizationL1), mul(rat(2n), maximum(radial)));
  assert.equal(new Set(result.cycle).size, 4);
  for (let i = 0; i < 4; i++) {
    const a = spans[result.cycle[i]], b = spans[result.cycle[(i + 1) % 4]];
    assert.deepEqual(a.controlPoints[directed(a)[2]].slice(0, 2), b.controlPoints[directed(b)[0]].slice(0, 2));
  }
}

test('all four actual spans match independent generic Bernstein products at multiple native radii', () => {
  for (const radius of [0.01, 1, 10, 100, 5000, 10000]) {
    const spans = operands(source(radius)), before = structuredClone(spans), proof = cycle(spans, radius);
    verify(spans, radius, proof); assert.deepEqual(spans, before);
  }
  const spans = operands(source()), proof = cycle(spans);
  assert.deepEqual(proof.cycle, [0, 1, 3, 2]);
  assert.equal(spans[0].weights[1], 0.7071067811865476); assert.equal(spans[2].weights[1], 0.7071067811865477);
  assert.notDeepEqual(proof.spans[0].radialDefectCoefficients, proof.spans[2].radialDefectCoefficients);
});

test('the cycle is derived from actual directed endpoints, independent of span list order', () => {
  const spans = operands(source()), reordered = [spans[2], spans[0], spans[3], spans[1]], result = cycle(reordered);
  verify(reordered, 10, result); assert.deepEqual(result.cycle, [0, 1, 3, 2]);
  assert.deepEqual(result.radial, cycle(spans).radial);
});

test('nonclosed, branched, reversed, angularly singular and unsupported operands refuse', () => {
  const changes = [
    spans => { spans[2].sense = 'forward'; spans[3].sense = 'forward'; },
    spans => { spans[0].controlPoints[2][0] += 1e-15; },
    spans => { spans[1] = structuredClone(spans[0]); },
    spans => { for (const span of spans) span.sense = span.sense === 'forward' ? 'reversed' : 'forward'; },
    spans => { spans[0].controlPoints[1] = [...spans[0].controlPoints[0]]; },
    spans => { spans[0].controlPoints[1] = [0, 0, -5]; },
    spans => { spans[2].weights[1] = 0; },
    spans => { spans[2].controlPoints[1][0] = Infinity; },
    spans => { spans[0].controlPoints[1][0] += 0.1; },
  ];
  for (const change of changes) {
    const spans = operands(source()); change(spans); const before = structuredClone(spans);
    assert.throws(() => cycle(spans), error => isWallCycleError(error) && error.code === 'SUPPORT'); assert.deepEqual(spans, before);
  }
});

test('a changed admitted lower weight produces its own exact proof instead of borrowing the upper quarter', () => {
  const spans = operands(source()), original = cycle(spans);
  spans[2].weights[1] = 0.7071067811865478;
  const changed = cycle(spans); verify(spans, 10, changed);
  assert.notDeepEqual(changed.spans[2].radialDefectCoefficients, original.spans[2].radialDefectCoefficients);
});

function ledger(result) {
  const c = result.counts, p = result.reference.counts;
  assert.equal(c.referenceOperations, p.exactOperations); assert.equal(c.exactOperations, p.exactOperations + c.rationalOperations + c.directOperations);
  assert.equal(c.work, p.work + c.localWork); assert.ok(c.localWork >= c.rationalOperations + c.directOperations + c.localGcdSteps);
  assert.ok(c.maximumBits >= p.maximumBits && c.maximumBits <= 8192);
  assert.ok(c.exactOperations <= result.limits.exactOperations && result.limits.exactOperations <= 200000); assert.ok(c.work <= 1048576);
}
function scoped(result) {
  for (const key of ['originalWallCycleCertified', 'originalWallEmbeddingCertified', 'originalWallOutwardOrientationCertified', 'originalHorizontalBoundaryOwnershipCertified', 'coefficientRadialBoundCoversAllSourceWalls']) assert.equal(result.meaning[key], true);
  for (const key of ['capTrimEmbeddingCertified', 'sourceShellCertified', 'closedReferenceCertified', 'retainedFaceClosureCertified', 'physicalBrepCertified', 'representedVolumeCertified', 'radialErrorIncludedInMass', 'partMassProvider', 'productFeature']) assert.equal(result.meaning[key], false);
  assert.equal(result.solidQualified, false); assert.equal(result.reference.solidQualified, false);
  assert.equal(result.reference.native.nativeBinding.meaning.sourceGlobalCertified, false);
  assert.equal(result.reference.formal.representation.includedInMassError, false);
}

test('the actual fresh native/formal prefix stays identical and its complete cost is retained', () => {
  const part = source(), components = pad(), selected = options(), before = structuredClone({ part, components, selected });
  const result = buildCylindricalWrapWallReference(part, components, selected);
  ledger(result); scoped(result); frozen(result);
  assert.deepEqual(result.reference, buildCylindricalWrapBoundReference(part, components, selected));
  assert.deepEqual({ part, components, selected }, before); verify(operands(part), 10, result.sourceWalls.cycle);
  assert.deepEqual(result.sourceWalls.z, [-5, 25]); assert.equal(result.sourceWalls.walls.length, 2);
  for (const wall of result.sourceWalls.walls) {
    const face = part.brep.faces[wall.faceSlot]; assert.equal(wall.face, face.id); assert.equal(wall.sense, face.sense);
    assert.equal(wall.bottom.sense, face.sense); assert.notEqual(wall.top.sense, face.sense);
    for (const level of ['bottom', 'top']) {
      const coedge = part.brep.coedges.find(c => c.id === wall[level].coedge), edge = part.brep.edges.find(e => e.id === wall[level].edge);
      assert.equal(coedge.edge, edge.id); assert.deepEqual(wall[level].vertices, edge.vertices);
    }
  }
  const saved = structuredClone(result);
  part.brep.faces[1].surface.weights[1][0] = 0.5; components[0].outer[0][0] = 0.2; selected.budgets.volume = 1;
  assert.deepEqual(result, saved); assert.equal(Object.isFrozen(part), false);
});

test('the complete operation total succeeds, one less refuses, and the former prefix cap cannot fund new work', () => {
  const part = source(), components = pad(), baseline = buildCylindricalWrapWallReference(part, components, options());
  const exact = buildCylindricalWrapWallReference(part, components, options(baseline.counts.exactOperations));
  ledger(exact); assert.equal(exact.counts.exactOperations, baseline.counts.exactOperations); assert.deepEqual(exact.sourceWalls, baseline.sourceWalls);
  for (const maximum of [baseline.counts.exactOperations - 1, baseline.counts.referenceOperations]) {
    const before = structuredClone(part);
    assert.throws(() => buildCylindricalWrapWallReference(part, components, options(maximum)), error => isWallCycleError(error) && error.code === 'BUDGET');
    assert.deepEqual(part, before);
  }
});

test('the distinct Z0 original reference request fits with all four spans and unchanged physical exclusions', () => {
  const part = source(10, 0), components = pad([1 / 16, 5 / 16]), selected = { ...options(), density: 1 };
  const result = buildCylindricalWrapWallReference(part, components, selected);
  ledger(result); scoped(result); verify(operands(part), 10, result.sourceWalls.cycle);
  assert.equal(result.reference.formal.counts.sourceOperations, result.reference.formal.source.carrier.counts.rational.operations + result.reference.formal.source.carrier.counts.integerOperations);
});
