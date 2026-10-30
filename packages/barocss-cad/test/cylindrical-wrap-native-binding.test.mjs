import test from 'node:test';
import assert from 'node:assert/strict';
import { brepFromPrismatic, prismaticFromProfile } from '../dist/index.js';
import { buildCylindricalWrapAssembly, buildCylindricalWrapNativeBoundAssembly, isCylindricalWrapAssemblyError } from '../dist/features/cylindrical-wrap-assembly.js';

function native(z = -5) {
  const solid = prismaticFromProfile({ outer: [{ kind: 'arc', start: [10, 0], center: [0, 0], direction: 'ccw' }], height: 30, from: z, tag: 'post' });
  return { solid: { kind: 'upright', solid }, brep: brepFromPrismatic(solid, { id: 'post' }) };
}
function pad(clockwise = false) {
  const outer = [[0.125, 0.25], [0.375, 0.25], [0.375, 0.75], [0.125, 0.75]];
  return [{ outer: clockwise ? outer.reverse() : outer, holes: [] }];
}
const options = { id: 'native_pad', height: 10 };
function fraction(n, d = 1n) { return { n, d }; }
function fromReceipt(value) { return fraction(BigInt(value.numerator), BigInt(value.denominator)); }
function add(a, b) { return fraction(a.n * b.d + b.n * a.d, a.d * b.d); }
function sub(a, b) { return fraction(a.n * b.d - b.n * a.d, a.d * b.d); }
function mul(a, b) { return fraction(a.n * b.n, a.d * b.d); }
function abs(a) { return fraction(a.n < 0n ? -a.n : a.n, a.d); }
function compare(a, b) { const x = a.n * b.d, y = b.n * a.d; return x < y ? -1 : x > y ? 1 : 0; }
function equal(a, b) { assert.equal(compare(a, b), 0); }
function represented(value) {
  if (value === 0) return fraction(0n);
  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value);
  const bits = view.getBigUint64(0), exponent = Number(bits >> 52n & 2047n), significand = (exponent ? 1n << 52n : 0n) + (bits & 0xfffffffffffffn), power = (exponent || 1) - 1075, signed = bits >> 63n ? -significand : significand;
  return power >= 0 ? fraction(signed << BigInt(power)) : fraction(signed, 1n << BigInt(-power));
}
function table(input) { const out = new Map(); for (const item of input) out.set(item.id, item); return out; }
function capOracle(world, uv, surface) {
  let maximum = fraction(0n);
  for (let i = 0; i < world.controlPoints.length; i++) {
    let error = fraction(0n);
    for (let axis = 0; axis < 3; axis++) {
      const origin = represented(surface.controlPoints[0][0][axis]);
      const du = sub(represented(surface.controlPoints[1][0][axis]), origin), dv = sub(represented(surface.controlPoints[0][1][axis]), origin);
      const lift = add(origin, add(mul(du, represented(uv.controlPoints[i][0])), mul(dv, represented(uv.controlPoints[i][1]))));
      error = add(error, abs(sub(represented(world.controlPoints[i][axis]), lift)));
    }
    if (compare(error, maximum) > 0) maximum = error;
  }
  return maximum;
}
function refused(part, input, selected, code) {
  const before = structuredClone({ part, input, selected });
  assert.throws(() => buildCylindricalWrapNativeBoundAssembly(part, input, selected), error => isCylindricalWrapAssemblyError(error) && (!code || error.code === code));
  assert.deepEqual({ part, input, selected }, before);
}
function narrow(result) {
  const proof = result.nativeBinding;
  assert.equal(proof.meaning.nativePositionBindingCertified, true); assert.equal(proof.meaning.allCoedgesCertified, true); assert.equal(proof.meaning.allEdgeEndpointsCertified, true);
  assert.equal(proof.meaning.vertexToleranceRule, 'actual-vertex-tolerance-stronger-than-checker-max');
  for (const key of ['sourceGlobalCertified', 'closedReferenceCertified', 'retainedFaceClosureCertified', 'mathHypotCertified', 'orientationCertified', 'physicalBrepCertified', 'solidQualified', 'representedVolumeCertified', 'generalTextSupported', 'productFeature', 'surfaceEndpointVertexBindingCertified']) assert.equal(proof.meaning[key], false);
  assert.equal(result.assembly.proof.diagnosticOnly, true); assert.equal(result.assembly.proof.solidQualified, false); assert.equal(result.assembly.proof.globalEvaluatorErrorCertified, false); assert.equal(result.assembly.proof.representedVolumeCertified, false);
}

test('fresh one-pad native binding covers actual63 slots all36 coedges and all36 stronger vertex relations', () => {
  const part = native(), input = pad(), before = structuredClone({ part, input }), result = buildCylindricalWrapNativeBoundAssembly(part, input, options), b = result.assembly.brep, proof = result.nativeBinding;
  narrow(result);
  assert.deepEqual(proof.coverage, { edges: 18, coedges: 36, vertices: 12, endpointRelations: 36, familySlots: 63, complete: true, classes: { wall: 8, cap: 4, base: 4, outer: 4, side: 16 } });
  assert.equal(proof.evaluator.family.objects, 63); assert.equal(proof.evaluator.curves.length, 54); assert.equal(proof.evaluator.surfaces.length, 9);
  assert.equal(proof.coedges.length, 36); assert.equal(proof.endpoints.length, 36); assert.equal(proof.faces.length, 9);
  assert.equal(new Set(proof.coedges.map(item => item.coedge)).size, 36);
  let at = 0;
  for (const edge of b.edges) assert.deepEqual(proof.evaluator.curves[at++].source, edge.curve);
  for (const coedge of b.coedges) assert.deepEqual(proof.evaluator.curves[at++].source, coedge.pcurve);
  for (let i = 0; i < b.faces.length; i++) assert.deepEqual(proof.evaluator.surfaces[i].source, b.faces[i].surface);
  const edges = table(b.edges), vertices = table(b.vertices), coedges = table(b.coedges), faces = table(b.faces), faceBounds = new Map();
  for (const bound of proof.faces) faceBounds.set(bound.face, bound);
  const eL1 = fromReceipt(proof.evaluator.l1.exact), eU = fromReceipt(proof.evaluator.axes[0].exact), eV = fromReceipt(proof.evaluator.axes[1].exact);
  for (const binding of proof.coedges) {
    const edge = edges.get(binding.edge), coedge = coedges.get(binding.coedge), face = faces.get(binding.face), local = faceBounds.get(binding.face);
    const inflation = add(mul(fraction(2n), eL1), add(mul(fromReceipt(local.lipschitz.u), eU), mul(fromReceipt(local.lipschitz.v), eV)));
    equal(fromReceipt(local.inflation), inflation); equal(fromReceipt(binding.bound), add(fromReceipt(binding.modelError), inflation));
    assert.ok(compare(fromReceipt(binding.bound), represented(edge.tolerance)) <= 0); assert.equal(binding.tolerance, edge.tolerance);
    assert.deepEqual(proof.evaluator.curves[binding.curveSlot].source, edge.curve); assert.deepEqual(proof.evaluator.curves[binding.pcurveSlot].source, coedge.pcurve); assert.deepEqual(proof.evaluator.surfaces[binding.surfaceSlot].source, face.surface);
    if (binding.kind === 'cap') equal(fromReceipt(binding.modelError), capOracle(edge.curve, coedge.pcurve, face.surface));
    if (binding.kind === 'side') assert.equal(fromReceipt(binding.modelError).n, 0n);
  }
  for (const binding of proof.endpoints) {
    const edge = edges.get(binding.edge), vertex = vertices.get(binding.vertex), p = edge.curve.controlPoints[binding.endpoint === 0 ? 0 : edge.curve.controlPoints.length - 1]; let expected = eL1;
    for (let axis = 0; axis < 3; axis++) expected = add(expected, abs(sub(represented(p[axis]), represented(vertex.point[axis]))));
    equal(fromReceipt(binding.bound), expected); assert.equal(binding.tolerance, vertex.tolerance); assert.ok(compare(expected, represented(vertex.tolerance)) <= 0);
  }
  assert.ok(proof.counts.exactOperations <= 200000); assert.ok(proof.counts.work <= 1048576); assert.ok(proof.counts.maximumBits <= 8192);
  assert.equal(proof.phases.side.exactOperations, proof.sideFamily.counts.totalOperations); assert.equal(proof.phases.evaluator.exactOperations, proof.evaluator.counts.totalOperations);
  assert.ok(proof.counts.exactOperations > proof.phases.assembly.exactOperations + proof.phases.side.exactOperations + proof.phases.evaluator.exactOperations);
  assert.equal(proof.counts.helperOperations, result.assembly.proof.counts.helperOperations + proof.phases.side.exactOperations + proof.phases.evaluator.exactOperations);
  assert.deepEqual({ part, input }, before); assert.ok(Object.isFrozen(result) && Object.isFrozen(b.vertices[0].point) && Object.isFrozen(proof.evaluator.curves[0].source));
  assert.throws(() => { b.vertices[0].point[0] = 123; }, TypeError); assert.deepEqual(part, before.part);
});

test('legacy geometry exact-operation receipts and returned mutability survive private-run factoring', () => {
  const part = native(), input = pad(true), before = structuredClone(part), legacy = buildCylindricalWrapAssembly(part, input, options), result = buildCylindricalWrapNativeBoundAssembly(part, input, options), actual = result.assembly;
  assert.deepEqual(actual.brep, legacy.brep); assert.deepEqual(actual.check, legacy.check);
  const oldCounts = legacy.proof.counts, counts = actual.proof.counts;
  for (const key of ['helperOperations', 'integerOperations', 'integerMaximumBits', 'horizontalCompositions', 'angularCertificates', 'verticalCurves', 'outerClones']) assert.equal(counts[key], oldCounts[key]);
  // Only the new profile meters UV orientation through q instead of the legacy external predicate.
  assert.ok(counts.exactOperations > oldCounts.exactOperations); assert.equal(counts.exactOperations - oldCounts.exactOperations, counts.rationalOperations - oldCounts.rationalOperations);
  const oldProof = { ...legacy.proof, counts: null }, nativeProof = { ...actual.proof, counts: null }; assert.deepEqual(nativeProof, oldProof);
  assert.equal(result.nativeBinding.phases.assembly.exactOperations, counts.exactOperations);
  assert.equal(Object.isFrozen(legacy), false); assert.equal(Object.isFrozen(legacy.brep.vertices[0].point), false);
  legacy.brep.vertices[0].point[0] = 123; assert.deepEqual(part, before); assert.notEqual(actual.brep.vertices[0].point[0], 123);
});

test('only the fresh fixed profile is accepted and caller data never becomes a receipt authority', () => {
  const part = native(), one = pad();
  refused(part, [], options, 'SUPPORT'); refused(part, [...one, ...pad()], options, 'SUPPORT');
  const hole = pad(); hole[0].holes.push([[0.2, 0.4], [0.3, 0.4], [0.3, 0.6], [0.2, 0.6]]); refused(part, hole, options, 'SUPPORT');
  const five = pad(); five[0].outer.push([0.125, 0.5]); refused(part, five, options, 'SUPPORT');
  const diagonal = [{ outer: [[0.125, 0.25], [0.375, 0.25], [0.3, 0.75], [0.125, 0.75]], holes: [] }]; refused(part, diagonal, options, 'SUPPORT');
  refused(part, one, { ...options, maxOperations: 200001 }, 'INPUT'); refused(part, one, { ...options, maxOperations: 0 }, 'INPUT'); refused(part, one, { ...options, certified: true }, 'INPUT');
  const altered = structuredClone(part); altered.brep.faces[0].surface.weights[0][0] = 0.75; refused(altered, one, options, 'SUPPORT');
  const tighter = structuredClone(part); tighter.brep.vertices[0].tolerance = Number.MIN_VALUE; refused(tighter, one, options, 'SUPPORT');
  let called = false; const getter = { id: options.id, height: options.height }; Object.defineProperty(getter, 'maxOperations', { enumerable: true, get() { called = true; return 200000; } });
  assert.throws(() => buildCylindricalWrapNativeBoundAssembly(part, one, getter), error => isCylindricalWrapAssemblyError(error) && error.code === 'INPUT'); assert.equal(called, false);
});

test('one complete request honors fresh aggregate reservations and a final-bound refusal is atomic', () => {
  const part = native(), input = pad(), before = structuredClone({ part, input }), baseline = buildCylindricalWrapNativeBoundAssembly(part, input, options), total = baseline.nativeBinding.counts.exactOperations;
  const tight = buildCylindricalWrapNativeBoundAssembly(part, input, { ...options, maxOperations: total }); assert.equal(tight.nativeBinding.counts.exactOperations, total);
  refused(part, input, { ...options, maxOperations: total - 1 }, 'BUDGET'); refused(part, input, { ...options, maxOperations: 1 }, 'BUDGET');
  assert.deepEqual({ part, input }, before); assert.equal(baseline.nativeBinding.meaning.nativePositionBindingCertified, true);
});
