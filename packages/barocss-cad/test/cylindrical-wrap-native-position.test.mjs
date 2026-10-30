import test from 'node:test';
import assert from 'node:assert/strict';
import { SectionRationalContext } from '../dist/section-rational-internal.js';
import { kernelRefusal } from '../dist/core/barocss-error.js';
import { prismaticFromProfile, brepFromPrismatic } from '../dist/features/prismatic-solid.js';
import { prepareNativePositionFace, requireNativePcurveRange, nativePositionInflation, checkedNativePositionBound,
  nativeEndpointPositionBound, nativeAffineCapResidual, isNativePositionError } from '../dist/features/cylindrical-wrap-native-position.js';

function budgetFailure(code, detail) { throw kernelRefusal('test-native-position-host', code === 'BUDGET' ? 'BUDGET' : 'SUPPORT', detail); }
class Host {
  q = new SectionRationalContext(budgetFailure);
  work = 0;
  constructor(maximum = 200000, maximumWork = 1048576) { this.maximum = maximum; this.maximumWork = maximumWork; }
  charge(amount = 1) { this.work += amount; this.check(); }
  check() { const c = this.q.counts(); if (c.operations > this.maximum || this.work + c.operations + c.gcdSteps + c.floatSearchSteps > this.maximumWork) throw kernelRefusal('test-native-position-host', 'BUDGET', 'the shared host ledger was exhausted'); }
}
// Independent exact fractions and Bernstein derivative evaluation. Samples verify the
// implementation; the coefficient hull and quotient theorem supply the whole-domain proof.
const storage = new DataView(new ArrayBuffer(8));
function r(n, d = 1n) {
  if (d < 0n) { n = -n; d = -d; } if (n === 0n) return { n: 0n, d: 1n };
  let a = n < 0n ? -n : n, b = d; while (b) { const next = a % b; a = b; b = next; } return { n: n / a, d: d / a };
}
function from(value) {
  storage.setFloat64(0, value, false); const bits = storage.getBigUint64(0, false), exponent = Number((bits >> 52n) & 2047n);
  const significand = (bits & 0xfffffffffffffn) + (exponent === 0 ? 0n : 1n << 52n), signed = bits >> 63n ? -significand : significand, shift = exponent === 0 ? -1074 : exponent - 1075;
  return shift >= 0 ? r(signed << BigInt(shift)) : r(signed, 1n << BigInt(-shift));
}
function add(a, b) { return r(a.n * b.d + b.n * a.d, a.d * b.d); }
function sub(a, b) { return r(a.n * b.d - b.n * a.d, a.d * b.d); }
function mul(a, b) { return r(a.n * b.n, a.d * b.d); }
function div(a, b) { return r(a.n * b.d, a.d * b.n); }
function abs(a) { return a.n < 0n ? { n: -a.n, d: a.d } : a; }
function cmp(a, b) { const x = a.n * b.d, y = b.n * a.d; return x < y ? -1 : x > y ? 1 : 0; }
function pow(a, n) { let value = r(1n); for (let i = 0; i < n; i++) value = mul(value, a); return value; }
function choose(n, k) { let value = 1n; for (let i = 1; i <= k; i++) value = value * BigInt(n - i + 1) / BigInt(i); return value; }
function basis(degree, t) { const out = [], opposite = sub(r(1n), t); for (let i = 0; i <= degree; i++) out.push(mul(r(choose(degree, i)), mul(pow(t, i), pow(opposite, degree - i)))); return out; }
function derivativeBasis(degree, t, width) {
  const lower = basis(degree - 1, t), out = [];
  for (let i = 0; i <= degree; i++) out.push(mul(div(r(BigInt(degree)), width), sub(i > 0 ? lower[i - 1] : r(0n), i < degree ? lower[i] : r(0n)))); return out;
}
function exactDerivatives(source, u, v) {
  const count = source.controlPoints.length, two = count === 5, start = two && u >= source.knotsU[3] ? 2 : 0;
  const ua = two ? source.knotsU[start === 0 ? 2 : 3] : source.knotsU[source.degreeU], ub = two ? source.knotsU[start === 0 ? 3 : 5] : source.knotsU[count];
  const va = source.knotsV[1], vb = source.knotsV[2], hu = sub(from(ub), from(ua)), hv = sub(from(vb), from(va));
  const tu = div(sub(from(u), from(ua)), hu), tv = div(sub(from(v), from(va)), hv), bu = basis(source.degreeU, tu), bv = basis(1, tv), du = derivativeBasis(source.degreeU, tu, hu), dv = derivativeBasis(1, tv, hv);
  let w = r(0n), wu = r(0n), wv = r(0n); const n = [r(0n), r(0n), r(0n)], nu = [r(0n), r(0n), r(0n)], nv = [r(0n), r(0n), r(0n)];
  for (let i = 0; i <= source.degreeU; i++) for (let j = 0; j <= 1; j++) {
    const weight = from(source.weights[start + i][j]), f = mul(mul(bu[i], bv[j]), weight), fu = mul(mul(du[i], bv[j]), weight), fv = mul(mul(bu[i], dv[j]), weight);
    w = add(w, f); wu = add(wu, fu); wv = add(wv, fv);
    for (let axis = 0; axis < 3; axis++) { const p = from(source.controlPoints[start + i][j][axis]); n[axis] = add(n[axis], mul(f, p)); nu[axis] = add(nu[axis], mul(fu, p)); nv[axis] = add(nv[axis], mul(fv, p)); }
  }
  let uBound = r(0n), vBound = r(0n);
  for (let axis = 0; axis < 3; axis++) { uBound = add(uBound, abs(div(sub(mul(nu[axis], w), mul(n[axis], wu)), mul(w, w)))); vBound = add(vBound, abs(div(sub(mul(nv[axis], w), mul(n[axis], wv)), mul(w, w)))); }
  return { u: uBound, v: vBound };
}
function independentCapResidual(world, uv, surface) {
  const o = surface.controlPoints[0][0], u = [], v = []; let maximum = r(0n);
  for (let axis = 0; axis < 3; axis++) { u.push(sub(from(surface.controlPoints[1][0][axis]), from(o[axis]))); v.push(sub(from(surface.controlPoints[0][1][axis]), from(o[axis]))); }
  for (let i = 0; i < world.controlPoints.length; i++) {
    let total = r(0n);
    for (let axis = 0; axis < 3; axis++) { const lifted = add(from(o[axis]), add(mul(u[axis], from(uv.controlPoints[i][0])), mul(v[axis], from(uv.controlPoints[i][1])))); total = add(total, abs(sub(from(world.controlPoints[i][axis]), lifted))); }
    if (cmp(total, maximum) > 0) maximum = total;
  }
  return maximum;
}
function sameR(a, b) { assert.equal(cmp(a, b), 0); }
function line(a, b, id = 'line') { return { kind: 'curve', id, degree: 1, knots: [0, 0, 1, 1], controlPoints: [a, b], weights: [1, 1] }; }
function plane(scale = 1) { return { kind: 'surface', id: 'plane', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[[0, 0, 0], [0, 1, 0]], [[scale, 0, 0], [scale, 1, 0]]], weights: [[1, 1], [1, 1]] }; }
function patch() { return { kind: 'surface', id: 'rational', degreeU: 3, degreeV: 1, knotsU: [0, 0, 0, 0, 1, 1, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[[2, -4, 1], [4, 5, 7]], [[-8, 3, 2], [7, -2, 8]], [[6, 8, -4], [1, 3, 9]], [[9, -3, 6], [-3, 7, 4]]], weights: [[0.5, 1], [1, 0.75], [0.75, 0.5], [1, 1]] }; }
function nativeBrep() { return brepFromPrismatic(prismaticFromProfile({ outer: [{ kind: 'arc', start: [10, 0], center: [0, 0], direction: 'ccw' }], height: 30, from: -5, tag: 'post' }), { id: 'post' }); }
function refused(action, code) { assert.throws(action, error => isNativePositionError(error) && error.code === code); }

test('exact per-face quotient bounds cover independent tensor derivatives without a native D1 call', () => {
  const ctx = new Host(), source = patch(), before = structuredClone(source), face = prepareNativePositionFace(source, ctx);
  const expectedCommon = div(mul(mul(from(26), from(1)), sub(from(3), from(0.5))), mul(from(0.5), from(0.5)));
  // Actual coordinate hulls are A=[9,8,9], hence sumA=26.
  sameR(face.lipschitz.u, mul(expectedCommon, from(3))); sameR(face.lipschitz.v, expectedCommon);
  for (const [u, v] of [[0, 0], [0.1, 1 / 3], [0.5, 0.5], [0.9, 0.25], [1, 1]]) { const actual = exactDerivatives(source, u, v); assert.ok(cmp(actual.u, face.lipschitz.u) <= 0 && cmp(actual.v, face.lipschitz.v) <= 0); }
  assert.deepEqual(source, before); assert.notEqual(face.surface, source); assert.ok(Object.isFrozen(face) && Object.isFrozen(face.surface.controlPoints[0][0]));
  assert.equal(ctx.q.counts().floatConversions, 0);
});

test('both actual native five-row half-walls retain full-domain Lipschitz bounds across the repeated knot', () => {
  const ctx = new Host(), brep = nativeBrep(); let count = 0; const weights = [];
  for (const record of brep.faces) if (record.surface.controlPoints.length === 5) {
    const source = record.surface, face = prepareNativePositionFace(source, ctx); count++; weights.push(source.weights[1][0]);
    sameR(face.u.low, r(0n)); sameR(face.u.high, r(1n));
    for (const u of [0, 0.5 - 2 ** -54, 0.5, 0.5 + 2 ** -53, 1]) { const actual = exactDerivatives(source, u, 1 / 3); assert.ok(cmp(actual.u, face.lipschitz.u) <= 0 && cmp(actual.v, face.lipschitz.v) <= 0); }
  }
  assert.equal(count, 2); assert.notEqual(weights[0], weights[1]);
});

test('native cap residual matches an independent exact affine oracle for top and swapped bottom bases', () => {
  const ctx = new Host(), brep = nativeBrep(), before = structuredClone(brep), edges = new Map(), coedges = new Map(), loops = new Map();
  for (const edge of brep.edges) edges.set(edge.id, edge); for (const coedge of brep.coedges) coedges.set(coedge.id, coedge); for (const loop of brep.loops) loops.set(loop.id, loop);
  let count = 0;
  for (const record of brep.faces) if (record.surface.degreeU === 1) {
    const face = prepareNativePositionFace(record.surface, ctx); count++;
    for (const loopId of record.loops) for (const id of loops.get(loopId).coedges) {
      const coedge = coedges.get(id), world = edges.get(coedge.edge).curve, uv = coedge.pcurve, actual = nativeAffineCapResidual(world, uv, record.surface, ctx);
      sameR(actual, independentCapResidual(world, uv, record.surface)); requireNativePcurveRange(uv, face, ctx.q.integer(0), ctx.q.integer(0), ctx);
      const renamed = structuredClone(uv); renamed.id = 'different_id'; sameR(nativeAffineCapResidual(world, renamed, record.surface, ctx), actual);
    }
  }
  assert.equal(count, 2); assert.deepEqual(brep, before);
});

test('affine residual is maximum per-pole L1 and unchanged exact canonical basis is mandatory', () => {
  const ctx = new Host(), surface = plane(2), world = line([0.25, 0.125, 0], [1.5, 0.875, 0], 'world'), uv = line([0.125, 0.125, 0], [0.75, 0.875, 0], 'uv');
  sameR(nativeAffineCapResidual(world, uv, surface, ctx), r(0n));
  world.controlPoints[0][0] += 2 ** -30; world.controlPoints[1][1] -= 2 ** -29;
  const residual = nativeAffineCapResidual(world, uv, surface, ctx); sameR(residual, r(1n, 1n << 29n)); sameR(residual, independentCapResidual(world, uv, surface));
  const wrongWeight = structuredClone(uv); wrongWeight.weights[0] = 0.75; refused(() => nativeAffineCapResidual(world, wrongWeight, surface, ctx), 'SUPPORT');
  const wrongBits = structuredClone(uv); wrongBits.knots[0] = -0; refused(() => nativeAffineCapResidual(world, wrongBits, surface, ctx), 'SUPPORT');
});

test('pcurve range uses exact hulls, actual rounded slack endpoints and exact zero Z', () => {
  const ctx = new Host(), source = plane(); source.knotsU = [-1, -1, 0, 0]; const face = prepareNativePositionFace(source, ctx), uv = line([-1, 0, -0], [-1, 1, -0]);
  sameR(face.u.guardLow, from(-1 - 1e-9)); sameR(face.u.guardHigh, from(0 + 1e-9));
  const touching = ctx.q.sub(face.u.low, face.u.guardLow); requireNativePcurveRange(uv, face, touching, ctx.q.integer(0), ctx);
  const past = ctx.q.add(touching, ctx.q.rat(1n, 1n << 200n)); refused(() => requireNativePcurveRange(uv, face, past, ctx.q.integer(0), ctx), 'SUPPORT');
  const nonzero = structuredClone(uv); nonzero.controlPoints[1][2] = Number.MIN_VALUE; refused(() => requireNativePcurveRange(nonzero, face, ctx.q.integer(0), ctx.q.integer(0), ctx), 'SUPPORT');
});

test('slack alone cannot forgive the exact outside-domain clamp counterexample', () => {
  const ctx = new Host(), surface = plane(1024), uv = line([-(2 ** -31), 0, 0], [-(2 ** -31), 1, 0]), world = line([-(2 ** -21), 0, 0], [-(2 ** -21), 1, 0]), face = prepareNativePositionFace(surface, ctx), zero = ctx.q.integer(0);
  sameR(nativeAffineCapResidual(world, uv, surface, ctx), r(0n)); assert.ok(Math.abs(uv.controlPoints[0][0]) < 1e-9); assert.ok(Math.abs(world.controlPoints[0][0]) > 1e-7);
  refused(() => requireNativePcurveRange(uv, face, zero, zero, ctx), 'SUPPORT');
});

test('inflation includes both independent D0 terms and exact UV-to-world propagation once', () => {
  const ctx = new Host(), face = prepareNativePositionFace(plane(10), ctx), e = ctx.q.rat(1n, 1n << 45n), eu = ctx.q.rat(1n, 1n << 47n), ev = ctx.q.rat(1n, 1n << 48n);
  const actual = nativePositionInflation(face, e, eu, ev, ctx), expected = add(mul(r(2n), e), add(mul(face.lipschitz.u, eu), mul(face.lipschitz.v, ev))); sameR(actual, expected);
  const model = ctx.q.rat(1n, 1n << 40n), total = checkedNativePositionBound(model, actual, 1e-7, ctx); sameR(total, add(model, actual));
  refused(() => checkedNativePositionBound(model, actual, Number.MIN_VALUE, ctx), 'SUPPORT'); assert.equal(ctx.q.counts().floatConversions, 0);
});

test('endpoint point gaps honor the exact supplied entity tolerance including tiny equality', () => {
  const ctx = new Host(), zero = ctx.q.integer(0), point = [2 ** -40, -0, 0], vertex = [0, 0, -0], before = structuredClone({ point, vertex });
  sameR(nativeEndpointPositionBound(point, vertex, zero, 2 ** -40, ctx), r(1n, 1n << 40n));
  refused(() => nativeEndpointPositionBound(point, vertex, zero, 2 ** -41, ctx), 'SUPPORT');
  const e = ctx.q.rat(1n, 1n << 50n); sameR(nativeEndpointPositionBound(point, vertex, e, 2 ** -39, ctx), add(r(1n, 1n << 40n), e));
  sameR(nativeEndpointPositionBound([-0, 0, -0], [0, -0, 0], zero, Number.MIN_VALUE, ctx), zero); assert.deepEqual({ point, vertex }, before);
});

test('prepared faces are owned by one host context and inputs or error rationals stay immutable', () => {
  const ctx = new Host(), source = plane(), before = structuredClone(source), face = prepareNativePositionFace(source, ctx), error = ctx.q.rat(1n, 1n << 48n), errorBefore = structuredClone(error), uv = line([0, 0, 0], [1, 1, 0]);
  requireNativePcurveRange(uv, face, error, error, ctx); nativePositionInflation(face, error, error, error, ctx); assert.deepEqual(source, before); assert.deepEqual(error, errorBefore);
  source.controlPoints[1][0][0] = 123; assert.deepEqual(face.surface, before); assert.throws(() => { face.surface.controlPoints[0][0][0] = 1; }, TypeError);
  refused(() => nativePositionInflation(face, error, error, error, new Host()), 'INPUT');
  let reads = 0; const forged = {}; Object.defineProperty(forged, 'u', { get() { reads++; return face.u; } }); refused(() => requireNativePcurveRange(uv, forged, error, error, ctx), 'INPUT'); assert.equal(reads, 0);
});

test('unsupported source nets, affine violations and malformed own data refuse explicitly', () => {
  const ctx = new Host(), invalid = plane(); invalid.controlPoints[0][0][0] = Infinity; refused(() => prepareNativePositionFace(invalid, ctx), 'INPUT');
  let reads = 0; const getter = plane(); Object.defineProperty(getter, 'weights', { enumerable: true, get() { reads++; return [[1, 1], [1, 1]]; } }); refused(() => prepareNativePositionFace(getter, ctx), 'INPUT'); assert.equal(reads, 0);
  const light = plane(); light.weights[0][0] = 0.4; refused(() => prepareNativePositionFace(light, ctx), 'SUPPORT');
  const wide = plane(); wide.knotsU = [0, 0, 2, 2]; refused(() => prepareNativePositionFace(wide, ctx), 'SUPPORT');
  const bent = plane(); bent.controlPoints[1][1][0] += 2 ** -20; const world = line([0, 0, 0], [1, 1, 0]), uv = structuredClone(world); refused(() => nativeAffineCapResidual(world, uv, bent, ctx), 'SUPPORT');
  const weighted = plane(); weighted.weights[0][0] = 0.5; refused(() => nativeAffineCapResidual(world, uv, weighted, ctx), 'SUPPORT');
  const small = plane(); small.knotsV = [0, 0, 0.5, 0.5]; refused(() => nativeAffineCapResidual(world, uv, small, ctx), 'SUPPORT');
  const extra = plane(); extra.version = 1; refused(() => prepareNativePositionFace(extra, ctx), 'INPUT');
  const negative = { n: -1n, d: 1n }; refused(() => checkedNativePositionBound(negative, ctx.q.integer(0), 1e-7, ctx), 'INPUT');
  refused(() => nativeEndpointPositionBound([0, 0, NaN], [0, 0, 0], ctx.q.integer(0), 1e-7, ctx), 'INPUT');
  refused(() => checkedNativePositionBound(ctx.q.integer(0), ctx.q.integer(0), 0, ctx), 'INPUT');
});

test('all helper exact and structural work shares the supplied native ledger and existing budgets', () => {
  refused(() => prepareNativePositionFace(plane(), new Host(3)), 'BUDGET'); refused(() => prepareNativePositionFace(plane(), new Host(200000, 1)), 'BUDGET');
  const ctx = new Host(), face = prepareNativePositionFace(plane(), ctx), before = ctx.q.counts().operations, e = ctx.q.rat(1n, 1n << 50n);
  nativePositionInflation(face, e, e, e, ctx); assert.ok(ctx.q.counts().operations > before && ctx.work > 0);
  const huge = { n: 1n << 8192n, d: 1n }; refused(() => nativePositionInflation(face, huge, e, e, ctx), 'BUDGET');
  assert.equal(ctx.q.counts().floatConversions, 0); assert.ok(ctx.q.counts().operations <= 200000 && ctx.q.counts().maximumObservedBits <= 8192);
});


test('identical finite endpoint axes retain a fresh normalized bound without caller aliasing', () => {
  const ctx = new Host(), supplied = {n: 2n, d: 4n};
  const result = nativeEndpointPositionBound([1, -0, 3], [1, -0, 3], supplied, 1, ctx);
  assert.deepEqual(result, {n: 1n, d: 2n}); assert.notEqual(result, supplied);
  supplied.n = 10n; supplied.d = 1n; assert.deepEqual(result, {n: 1n, d: 2n});
});
