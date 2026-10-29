import test from 'node:test';
import assert from 'node:assert/strict';
import { prismaticFromProfile, brepFromPrismatic } from '../dist/index.js';
import { buildCylindricalWrapClosedReference } from '../dist/features/cylindrical-wrap-closed-reference.js';
import { buildCylindricalWrapBoundReference, buildCylindricalWrapSharedReference } from '../dist/features/cylindrical-wrap-bound-reference.js';
import { buildCylindricalWrapWallReference, continueCylindricalWrapReferenceWalls } from '../dist/features/cylindrical-wrap-source-walls.js';
import { ReferenceProofContext, isCylindricalWrapClosedReferenceError } from '../dist/features/cylindrical-wrap-reference-context.js';
import { certifyOriginalReferenceCaps, certifyWrappedReferenceClosure } from '../dist/features/cylindrical-wrap-reference-closure.js';

function source(z = -5) { const solid = prismaticFromProfile({ outer: [{ kind: 'arc', start: [10, 0], center: [0, 0], direction: 'ccw' }], height: 30, from: z, tag: 'post' }); return { solid: { kind: 'upright', solid }, brep: brepFromPrismatic(solid, { id: 'post' }) }; }
function pad(u = [0.125, 0.375], v = [0.25, 0.75]) { return [{ outer: [[u[0], v[0]], [u[1], v[0]], [u[1], v[1]], [u[0], v[1]]], holes: [] }]; }
function options(maxOperations = 200000) { return { id: 'wrap', height: 10, density: 7.85, maxOperations, budgets: { volume: 1e-8, mass: 1e-10, centroid: [1e-10, 1e-10, 1e-10], inertia: [1e-7, 1e-7, 1e-7, 1e-7, 1e-7, 1e-7] } }; }
function frozen(value) { if (value && typeof value === 'object') { assert.ok(Object.isFrozen(value)); for (const child of Object.values(value)) frozen(child); } }
function context(parent) { return new ReferenceProofContext(parent.counts, parent.limits.exactOperations); }

// Independent reduced rational algebra; no production integer interval or dyadic helpers.
function gcd(a, b) { if (a < 0n) a = -a; while (b) [a, b] = [b, a % b]; return a; }
function R(n, d = 1n) { if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; }
const ZERO = R(0n), ONE = R(1n), TWO = R(2n);
function add(a, b) { return R(a.n * b.d + b.n * a.d, a.d * b.d); }
function sub(a, b) { return R(a.n * b.d - b.n * a.d, a.d * b.d); }
function mul(a, b) { return R(a.n * b.n, a.d * b.d); }
function div(a, b) { return R(a.n * b.d, a.d * b.n); }
function cmp(a, b) { const v = a.n * b.d - b.n * a.d; return v < 0n ? -1 : v > 0n ? 1 : 0; }
function abs(a) { return R(a.n < 0n ? -a.n : a.n, a.d); }
function power(a, n) { let r = ONE; for (let i = 0; i < n; i++) r = mul(r, a); return r; }
function max(a) { return a.reduce((x, y) => cmp(x, y) > 0 ? x : y); }
function min(a) { return a.reduce((x, y) => cmp(x, y) < 0 ? x : y); }
function read(v) { return R(BigInt(v.numerator), BigInt(v.denominator)); }
function from(value) { const b = Buffer.alloc(8); b.writeDoubleBE(value); const bits = b.readBigUInt64BE(), e = Number(bits >> 52n & 2047n), f = bits & 0xfffffffffffffn, n = (bits >> 63n ? -1n : 1n) * (e ? (1n << 52n) + f : f), p = e ? e - 1075 : -1074; return p < 0 ? R(n, 1n << BigInt(-p)) : R(n << BigInt(p)); }
function choose(n, k) { let x = 1n; for (let i = 1; i <= k; i++) x = x * BigInt(n - i + 1) / BigInt(i); return x; }
function product(a, b) { const m = a.length - 1, n = b.length - 1, out = []; for (let k = 0; k <= m + n; k++) { let v = ZERO; for (let i = Math.max(0, k - n); i <= Math.min(m, k); i++) v = add(v, mul(mul(a[i], b[k - i]), R(choose(m, i) * choose(n, k - i), choose(m + n, k)))); out.push(v); } return out; }
function derivative(a) { return a.slice(1).map((v, i) => mul(sub(v, a[i]), R(BigInt(a.length - 1)))); }
function interval(v) { return [read(v.lower), read(v.upper)]; }
function plus(a, b) { return [add(a[0], b[0]), add(a[1], b[1])]; }
function minus(a, b) { return [sub(a[0], b[1]), sub(a[1], b[0])]; }
function times(a, b) { const values = [mul(a[0], b[0]), mul(a[0], b[1]), mul(a[1], b[0]), mul(a[1], b[1])]; return [min(values), max(values)]; }
function quotient(a, b) { assert.ok(b[0].n > 0n); return times(a, [div(ONE, b[1]), div(ONE, b[0])]); }
function square(a) { const x = mul(a[0], a[0]), y = mul(a[1], a[1]); return [a[0].n <= 0n && a[1].n >= 0n ? ZERO : min([x, y]), max([x, y])]; }
function contains(outer, inner) { assert.ok(cmp(outer[0], inner[0]) <= 0); assert.ok(cmp(outer[1], inner[1]) >= 0); }
function actualAudit(audit, expected, budget) { const returned = interval(audit); contains(returned, expected); const x = from(audit.estimate), error = max([abs(sub(x, returned[0])), abs(sub(x, returned[1]))]); assert.deepEqual(read(audit.error), error); assert.ok(cmp(error, from(budget)) <= 0); }

function capsOracle(result) {
  const parent = result.walls, source = parent.reference.formal.source, caps = result.closure.caps, b = source.brep, errors = []; let slot = 0;
  for (const pair of caps.uses) {
    const use = b.coedges.find(c => c.id === pair.top), curve = use.pcurve, edge = b.edges.find(e => e.id === use.edge);
    for (let i = 0; i < 5; i++) {
      const x = mul(from(source.radius), sub(mul(TWO, from(curve.controlPoints[i][0])), ONE)), y = mul(from(source.radius), sub(mul(TWO, from(curve.controlPoints[i][1])), ONE));
      errors.push(add(abs(sub(x, from(edge.curve.controlPoints[i][0]))), abs(sub(y, from(edge.curve.controlPoints[i][1])))));
    }
    for (let span = 0; span < 2; span++) {
      const ids = use.sense === 'forward' ? [2 * span, 2 * span + 1, 2 * span + 2] : [2 * span + 2, 2 * span + 1, 2 * span];
      const w = ids.map(i => from(curve.weights[i])), x = ids.map((i, j) => mul(sub(mul(TWO, from(curve.controlPoints[i][0])), ONE), w[j])), y = ids.map((i, j) => mul(sub(mul(TWO, from(curve.controlPoints[i][1])), ONE), w[j]));
      const xx = product(x, x), yy = product(y, y), ww = product(w, w), Q = xx.map((v, i) => sub(add(v, yy[i]), ww[i]));
      const left = product(x, derivative(y)), right = product(y, derivative(x)), K = left.map((v, i) => sub(v, right[i]));
      const proof = caps.normalizedCycle.spans[slot++];
      assert.deepEqual(proof.radialDefectCoefficients.map(read), Q); assert.deepEqual(product(proof.angularCoefficients.map(read), [ONE, ONE]), K); assert.ok(K.every(x => x.n > 0n));
      assert.deepEqual(read(proof.radial), div(max(Q.map(abs)), mul(min(w), min(w))));
    }
  }
  assert.deepEqual(read(caps.boundaryAndInteriorToSourceL1), max(errors));
  assert.deepEqual(read(caps.radial), mul(read(caps.normalizedCycle.radial), from(source.radius)));
  assert.equal(caps.normalizedCycle.winding, 1); assert.equal(caps.exactReferenceSourceClosed, true); assert.equal(caps.literalStoredShellClosed, false);
}
function massOracle(result) {
  const formal = result.walls.reference.formal, mass = result.mass, source = formal.source, delta = read(mass.radial), radius = from(source.radius), height = sub(from(source.z[1]), from(source.z[0])), a = add(radius, delta), half = div(height, TWO);
  const powers = { V: [0, 0], X: [1, 0], Y: [1, 0], Z: [0, 1], XX: [2, 0], YY: [2, 0], ZZ: [0, 2], XY: [2, 0], XZ: [1, 1], YZ: [1, 1] };
  for (let i = 0; i < 10; i++) {
    const [d, z] = powers[formal.order[i]], exact = mul(mul(mul(mul(R(2n ** BigInt(d + 5)), height), delta), power(a, d + 1)), power(half, z));
    // Integrate the worst outward radial shell exactly, with pi<4, separately
    // from the production mean-value upper bound and fixed128 arithmetic.
    const shell = mul(mul(div(mul(R(8n), height), R(BigInt(d + 2))), sub(power(mul(TWO, a), d + 2), power(mul(TWO, radius), d + 2))), power(half, z));
    const error = read(mass.rawMomentGeometryErrors[i]); assert.ok(cmp(error, exact) >= 0); assert.ok(cmp(error, shell) >= 0);
    const original = interval(formal.moments[i]); contains(interval(mass.moments[i]), [sub(original[0], exact), add(original[1], exact)]);
  }
  const I = mass.moments.map(interval), factor = div(from(formal.options.density), R(1000n)), F = [factor, factor], center = [quotient(I[1], I[0]), quotient(I[2], I[0]), quotient(I[3], I[0])], shift = read(formal.frame.zCenter);
  const centroid = [center[0], center[1], plus(center[2], [shift, shift])];
  const qxx = minus(I[4], quotient(square(I[1]), I[0])), qyy = minus(I[5], quotient(square(I[2]), I[0])), qzz = minus(I[6], quotient(square(I[3]), I[0]));
  const qxy = minus(I[7], quotient(times(I[1], I[2]), I[0])), qxz = minus(I[8], quotient(times(I[1], I[3]), I[0])), qyz = minus(I[9], quotient(times(I[2], I[3]), I[0])), neg = [R(-1n), R(-1n)];
  const inertia = [times(plus(qyy, qzz), F), times(plus(qxx, qzz), F), times(plus(qxx, qyy), F), times(times(qxy, neg), F), times(times(qxz, neg), F), times(times(qyz, neg), F)];
  actualAudit(mass.audit.volume, I[0], formal.options.budgets.volume); actualAudit(mass.audit.mass, times(I[0], F), formal.options.budgets.mass);
  for (let i = 0; i < 3; i++) actualAudit(mass.audit.centroid[i], centroid[i], formal.options.budgets.centroid[i]);
  for (let i = 0; i < 6; i++) actualAudit(mass.audit.inertia[i], inertia[i], formal.options.budgets.inertia[i]);
  assert.ok(cmp(read(mass.audit.volume.error), read(formal.audit.volume.error)) > 0);
  assert.strictEqual(mass.properties, formal.properties); assert.equal(mass.includesFullRadialGeometryError, true); assert.equal(mass.literalStoredBrepMass, false);
}
function ledger(result) {
  const c = result.counts, w = result.walls.counts;
  assert.equal(c.exactOperations, w.exactOperations + c.rationalOperations + c.directOperations); assert.equal(c.work, w.work + c.localWork);
  assert.ok(c.exactOperations <= result.limits.exactOperations && result.limits.exactOperations <= 200000); assert.ok(c.work <= 1048576 && c.maximumBits <= 8192);
  assert.equal(result.walls.reference.meaning.sourceChecks, 1); assert.equal(result.walls.reference.formal.counts.sourceOperations, 0);
  for (const key of ['closedReferenceCertified', 'nativeFaceAssociationCertified', 'referenceMassCertified']) assert.equal(result.meaning[key], true);
  for (const key of ['literalStoredBrepClosureCertified', 'literalStoredBrepMass', 'partMassProvider', 'productFeature']) assert.equal(result.meaning[key], false);
  assert.equal(result.solidQualified, false);
  assert.equal(result.closure.nativeFaceDomain, 'admitted-exact-face-trim-domain');
  assert.equal(result.closure.faces.length, 9); assert.equal(new Set(result.closure.faces.map(f => f.face)).size, 9);
  for (const f of result.closure.faces) assert.ok(cmp(read(f.nativeToReferenceL1), from(result.closure.tolerance)) <= 0);
}

test('fresh cap/whole-reference/mass proofs pass independent exact oracles, including signed cross inertia', () => {
  for (const fixture of [{ z: -5, density: 7.85 }, { z: 0, density: 1, u: [1 / 16, 5 / 16] }, { z: -5, density: 1, v: [0.25, 0.5], sign: 1 }, { z: -5, density: 1, v: [0.5, 0.75], sign: -1 }, { z: -7, density: 7.85, u: [0.1, 0.4], v: [0.2, 0.7] }, { z: -7, density: 7.85, u: [0.1, 0.4], v: [0.3, 0.8] }]) {
    const part = source(fixture.z), components = pad(fixture.u, fixture.v), selected = options(); selected.density = fixture.density;
    const before = structuredClone({ part, components, selected }), result = buildCylindricalWrapClosedReference(part, components, selected);
    ledger(result); capsOracle(result); massOracle(result); frozen(result); assert.deepEqual({ part, components, selected }, before);
    if (fixture.sign) {
      assert.equal(Math.sign(result.mass.properties.inertia[0][2]), fixture.sign);
      assert.equal(Math.sign(result.mass.properties.inertia[1][2]), fixture.sign);
      assert.equal(Math.sign(result.mass.properties.centroid[2] - 10), -fixture.sign);
    }
    const saved = structuredClone(result); part.brep.faces[0].surface.weights[0][0] = 0.7; components[0].outer[0][0] = 0.2; selected.density = 1;
    assert.deepEqual(result, saved); assert.equal(Object.isFrozen(part), false);
  }
});

test('one actual source execution preserves all prior native geometry and formal numerical values', () => {
  const part = source(), components = pad(), selected = options(), before = buildCylindricalWrapBoundReference(part, components, selected), after = buildCylindricalWrapSharedReference(part, components, selected);
  assert.deepEqual(after.native, before.native); assert.deepEqual(after.formal.source, before.formal.source);
  for (const key of ['rectangle', 'frame', 'angles', 'sourceMoments', 'padMoments', 'moments', 'properties', 'audit', 'representation']) assert.deepEqual(after.formal[key], before.formal[key]);
  assert.equal(after.counts.nativeOperations, before.counts.nativeOperations);
  assert.equal(after.formal.counts.totalOperations, before.formal.counts.totalOperations - before.formal.counts.sourceOperations);
  assert.equal(after.formal.counts.rationalOperations, before.formal.counts.rationalOperations); assert.equal(after.formal.counts.directOperations, before.formal.counts.directOperations);
  assert.deepEqual(continueCylindricalWrapReferenceWalls(after).sourceWalls, buildCylindricalWrapWallReference(part, components, selected).sourceWalls);
});

test('clockwise and shifted start inputs retain the same closed region and mass', () => {
  const part = source(), selected = options(), baseline = buildCylindricalWrapClosedReference(part, pad(), selected);
  for (const outer of [pad()[0].outer.reverse(), [...pad()[0].outer.slice(2), ...pad()[0].outer.slice(0, 2)]]) {
    const result = buildCylindricalWrapClosedReference(part, [{ outer, holes: [] }], selected);
    ledger(result); capsOracle(result); massOracle(result); assert.deepEqual(result.mass, baseline.mass);
  }
});

test('the final total cap passes and one fewer operation refuses after the actual prefix', () => {
  const part = source(), components = pad(), selected = options(), baseline = buildCylindricalWrapClosedReference(part, components, selected);
  const exact = buildCylindricalWrapClosedReference(part, components, options(baseline.counts.exactOperations)); ledger(exact);
  assert.equal(exact.counts.exactOperations, baseline.counts.exactOperations); assert.deepEqual(exact.mass, baseline.mass); assert.deepEqual(exact.closure, baseline.closure);
  assert.throws(() => buildCylindricalWrapClosedReference(part, components, options(baseline.counts.exactOperations - 1)), error => isCylindricalWrapClosedReferenceError(error) && error.code === 'BUDGET');
});

test('an arithmetic-only budget can pass formal mass yet fail the complete geometric mass audit', () => {
  const part = source(), components = pad(), selected = options(); selected.budgets.volume = 1e-11;
  assert.doesNotThrow(() => buildCylindricalWrapSharedReference(part, components, selected)); const before = structuredClone({ part, components, selected });
  assert.throws(() => buildCylindricalWrapClosedReference(part, components, selected), error => isCylindricalWrapClosedReferenceError(error) && error.code === 'REPRESENTABILITY');
  assert.deepEqual({ part, components, selected }, before);
});

test('cap coefficients, orientations, ownership and original seam mutations fail their actual predicates', () => {
  const original = continueCylindricalWrapReferenceWalls(buildCylindricalWrapSharedReference(source(), pad(), options()));
  const edits = [
    p => { p.reference.formal.source.brep.faces[2].surface.weights[0][0] = 0.9; },
    p => { p.reference.formal.source.brep.faces[3].sense = 'reversed'; },
    p => { p.reference.formal.source.brep.coedges.find(c => c.id.endsWith('post_u1_0/l0/c0')).pcurve.controlPoints[1][0] = 0.99; },
    p => { p.reference.formal.source.brep.coedges.find(c => c.id.endsWith('post_d0_0/l0/c0')).pcurve.weights[1] = 0.7; },
    p => { p.reference.formal.source.brep.coedges.find(c => c.id.endsWith('post_u1_0/l0/c0')).twin = null; },
    p => { p.reference.formal.source.brep.edges.find(e => e.curve.degree === 1).curve.controlPoints[1][2] += 1; },
  ];
  for (const edit of edits) { const parent = structuredClone(original); edit(parent); const before = structuredClone(parent); assert.throws(() => certifyOriginalReferenceCaps(parent, context(parent)), error => isCylindricalWrapClosedReferenceError(error)); assert.deepEqual(parent, before); }
});

test('the wrapped reference requires reciprocal uses, original rectangle parameters and outward sides', () => {
  const original = continueCylindricalWrapReferenceWalls(buildCylindricalWrapSharedReference(source(), pad(), options()));
  for (const kind of ['twin', 'sense', 'outer', 'pcurve']) {
    const parent = structuredClone(original), ctx = context(parent), caps = certifyOriginalReferenceCaps(parent, ctx), b = parent.reference.native.assembly.brep, piece = parent.reference.native.assembly.proof.pieces[0];
    if (kind === 'twin') b.coedges[0].twin = null;
    if (kind === 'sense') b.faces.find(f => f.id === piece.sideFace).sense = 'reversed';
    if (kind === 'outer') b.faces.at(-1).surface.controlPoints[1][0][0] += 1e-12;
    if (kind === 'pcurve') { const loop = b.loops.find(l => l.face === parent.reference.formal.source.face.id && l.kind === 'inner'); b.coedges.find(c => c.loop === loop.id).pcurve.controlPoints[0][0] += 0.001; }
    assert.throws(() => certifyWrappedReferenceClosure(parent, caps, ctx), error => isCylindricalWrapClosedReferenceError(error) && error.code === 'SUPPORT');
  }
});

test('the final entry rejects supplied proof flags and never executes caller getters', () => {
  let reads = 0; const part = source(), selected = options();
  Object.defineProperty(selected, 'source', { enumerable: true, get() { reads++; return {}; } });
  assert.throws(() => buildCylindricalWrapClosedReference(part, pad(), selected)); assert.equal(reads, 0);
  for (const flag of ['source', 'closedReferenceCertified', 'counts', 'mass']) assert.throws(() => buildCylindricalWrapClosedReference(part, pad(), { ...options(), [flag]: true }));
});
