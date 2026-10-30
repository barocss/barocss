import test from 'node:test';
import assert from 'node:assert/strict';
import { prismaticFromProfile, brepFromPrismatic } from '../dist/index.js';
import { buildCylindricalWrapBoundReference, isCylindricalWrapBoundReferenceError } from '../dist/features/cylindrical-wrap-bound-reference.js';
import { buildCylindricalWrapNativeBoundAssembly, isCylindricalWrapAssemblyError } from '../dist/features/cylindrical-wrap-assembly.js';
import { certifyCylindricalWrapFormalPadMass, isFormalPadMassError } from '../dist/features/cylindrical-wrap-formal-mass.js';
import { readNativeSIInertia } from '../dist/internal/native-si-mass-state.js';

// These fixtures exercise actual fresh child requests. Their separate suites own
// the independent D0, native-position and ten-moment mathematical oracles.
function native() {
  const solid = prismaticFromProfile({ outer: [{ kind: 'arc', start: [10, 0], center: [0, 0], direction: 'ccw' }], height: 30, from: -5, tag: 'post' });
  return { solid: { kind: 'upright', solid }, brep: brepFromPrismatic(solid, { id: 'post' }) };
}
function pad(clockwise = false, start = 0) {
  let outer = [[0.125, 0.25], [0.375, 0.25], [0.375, 0.75], [0.125, 0.75]];
  if (clockwise) outer.reverse();
  outer = [...outer.slice(start), ...outer.slice(0, start)];
  return [{ outer, holes: [] }];
}
function options(maxOperations = 200000) {
  return { id: 'bound_ref', height: 10, density: 7.85, maxOperations,
    budgets: { volume: 1e-8, mass: 1e-10, centroid: [1e-10, 1e-10, 1e-10], inertia: [1e-7, 1e-7, 1e-7, 1e-7, 1e-7, 1e-7] } };
}
function deeplyFrozen(value) {
  if (value === null || typeof value !== 'object') return;
  assert.ok(Object.isFrozen(value));
  for (const item of Object.values(value)) deeplyFrozen(item);
}
function capture(action) {
  let error;
  try { action(); } catch (cause) { error = cause; }
  assert.ok(error, 'the request must refuse'); return error;
}
function knownRefusal(error) {
  return isCylindricalWrapBoundReferenceError(error) || isCylindricalWrapAssemblyError(error) || isFormalPadMassError(error);
}
function refused(part, components, selected, code) {
  const before = structuredClone({ part, components, selected });
  const error = capture(() => buildCylindricalWrapBoundReference(part, components, selected));
  assert.ok(knownRefusal(error)); if (code !== undefined) assert.equal(error.code, code);
  assert.deepEqual({ part, components, selected }, before); return error;
}
function scoped(result) {
  const meaning = result.meaning;
  assert.equal(result.solidQualified, false);
  assert.equal(meaning.sourceIdentity, 'same-owned-frozen-part-two-synchronous-fresh-checks');
  assert.equal(meaning.sourceChecks, 2); assert.equal(meaning.sourceCosts, 'both-complete-child-costs-counted');
  assert.equal(meaning.nativePositionBindingCertified, true); assert.equal(meaning.formalReferenceMassOnly, true);
  for (const key of ['closedReferenceCertified', 'physicalBrepCertified', 'retainedFaceClosureCertified', 'representedVolumeCertified', 'partMassProvider', 'productFeature']) assert.equal(meaning[key], false);
  const binding = result.native.nativeBinding;
  assert.equal(binding.meaning.nativePositionBindingCertified, true);
  for (const key of ['sourceGlobalCertified', 'closedReferenceCertified', 'retainedFaceClosureCertified', 'mathHypotCertified', 'orientationCertified', 'physicalBrepCertified', 'solidQualified', 'representedVolumeCertified', 'generalTextSupported', 'productFeature']) assert.equal(binding.meaning[key], false);
  assert.equal(result.native.assembly.proof.diagnosticOnly, true); assert.equal(result.native.assembly.proof.solidQualified, false);
  assert.equal(result.formal.solidQualified, false); assert.equal(result.formal.representation.includedInMassError, false);
  for (const key of ['literalStoredBrepMass', 'wrappedSolid', 'nativeBinding', 'surfaceArea', 'partMassProvider', 'nativeSIAccuracy']) assert.equal(result.formal.meaning[key], false);
}
function ledger(result) {
  const counts = result.counts, limits = result.limits, nativeCounts = result.native.nativeBinding.counts, formalCounts = result.formal.counts;
  assert.equal(counts.nativeOperations, nativeCounts.exactOperations); assert.equal(counts.formalOperations, formalCounts.totalOperations);
  assert.equal(counts.exactOperations, nativeCounts.exactOperations + formalCounts.totalOperations + counts.outerDirectOperations);
  assert.equal(counts.nativeWork, nativeCounts.work); assert.equal(counts.formalWork, formalCounts.work);
  assert.equal(counts.work, nativeCounts.work + formalCounts.work + counts.outerWork);
  assert.ok(Number.isSafeInteger(counts.outerDirectOperations) && counts.outerDirectOperations > 0);
  assert.ok(Number.isSafeInteger(counts.outerWork) && counts.outerWork > 0);
  assert.ok(counts.maximumBits >= Math.max(nativeCounts.maximumBits, formalCounts.maximumBits));
  assert.ok(counts.maximumBits <= 8192 && counts.work <= 1048576);
  assert.equal(limits.hardExactOperations, 200000); assert.equal(limits.integerBits, 8192); assert.equal(limits.work, 1048576);
  assert.ok(counts.exactOperations <= limits.exactOperations && limits.exactOperations <= 200000);
  assert.equal(result.reservations.native, result.native.nativeBinding.limits.exactOperations);
  assert.equal(result.reservations.formal, result.formal.options.maxOperations);
  assert.equal(result.reservations.formal, limits.exactOperations - nativeCounts.exactOperations - counts.outerDirectOperations);
  const nativeInitialOuter = limits.exactOperations - result.reservations.native;
  assert.ok(nativeInitialOuter > 0 && nativeInitialOuter <= counts.outerDirectOperations);
  assert.ok(result.reservations.formal > 0 && formalCounts.totalOperations <= result.reservations.formal);
  // The second fresh source admission remains a real part of the formal child's full cost.
  const source = result.formal.source.carrier.counts;
  assert.equal(formalCounts.sourceOperations, source.rational.operations + source.integerOperations);
  assert.ok(formalCounts.sourceOperations > 0);
}
function sameFormalRegion(first, second) {
  assert.deepEqual(second.rectangle, first.rectangle);
  for (const key of ['rectangle', 'frame', 'angles', 'sourceMoments', 'padMoments', 'moments', 'properties', 'audit', 'representation']) assert.deepEqual(second.formal[key], first.formal[key]);
}

test('one bound reference contains both complete actual child results under one final ledger', () => {
  const part = native(), components = pad(), selected = options(), before = structuredClone({ part, components, selected });
  const result = buildCylindricalWrapBoundReference(part, components, selected);
  scoped(result); ledger(result); deeplyFrozen(result);
  assert.deepEqual(result.rectangle, { u: [0.125, 0.375], v: [0.25, 0.75] });
  assert.deepEqual(result.formal.rectangle, result.rectangle); assert.deepEqual(result.options, selected);
  const binding = result.native.nativeBinding;
  assert.equal(binding.coedges.length, 36); assert.equal(binding.endpoints.length, 36);
  assert.equal(binding.evaluator.family.objects, 63); assert.equal(binding.evaluator.curves.length, 54); assert.equal(binding.evaluator.surfaces.length, 9);
  const directNative = buildCylindricalWrapNativeBoundAssembly(part, components, { id: selected.id, height: selected.height, maxOperations: result.reservations.native });
  const directFormal = certifyCylindricalWrapFormalPadMass(part, result.rectangle, { id: selected.id, density: selected.density, budgets: selected.budgets, maxOperations: result.reservations.formal });
  assert.deepEqual(result.native, directNative); assert.deepEqual(result.formal, directFormal);
  const nativeSI = readNativeSIInertia(result.formal.properties); assert.equal(nativeSI.ok, true);
  for (const row of nativeSI.inertia) for (const value of row) assert.ok(Number.isFinite(value));
  assert.equal(result.formal.meaning.nativeSIAccuracy, false);
  assert.deepEqual({ part, components, selected }, before); assert.equal(Object.hasOwn(part, 'mass'), false);
});

test('clockwise and rotated starts derive actual rectangle min/max without assuming native ID rotation', () => {
  const part = native(), selected = options(), baseline = buildCylindricalWrapBoundReference(part, pad(), selected);
  for (const components of [pad(true), pad(false, 2)]) {
    const before = structuredClone(components), result = buildCylindricalWrapBoundReference(part, components, selected);
    scoped(result); ledger(result); sameFormalRegion(baseline, result); assert.deepEqual(components, before);
    assert.equal(result.native.nativeBinding.coverage.coedges, 36); assert.equal(result.native.nativeBinding.coverage.endpointRelations, 36);
  }
});

test('exact total reservation succeeds and total minus one refuses without changing caller data', () => {
  const part = native(), components = pad(), baseline = buildCylindricalWrapBoundReference(part, components, options());
  const total = baseline.counts.exactOperations, exact = buildCylindricalWrapBoundReference(part, components, options(total));
  scoped(exact); ledger(exact); assert.equal(exact.counts.exactOperations, total);
  assert.equal(exact.reservations.formal, exact.formal.counts.totalOperations);
  sameFormalRegion(baseline, exact); assert.deepEqual(exact.native.assembly.brep, baseline.native.assembly.brep);
  refused(part, components, options(total - 1), 'BUDGET'); refused(part, components, options(1), 'BUDGET');
  const exhaustedAfterNative = baseline.counts.nativeOperations + baseline.counts.outerDirectOperations;
  const empty = refused(part, components, options(exhaustedAfterNative), 'BUDGET');
  assert.ok(isCylindricalWrapBoundReferenceError(empty));
  for (const value of [0, 200001, 1.5, null]) refused(part, components, options(value), 'INPUT');
});

test('owned frozen results do not freeze or alias the original Part, ring or options', () => {
  const part = native(), components = pad(), selected = options(), before = structuredClone({ part, components, selected });
  const result = buildCylindricalWrapBoundReference(part, components, selected), originalResult = structuredClone(result);
  assert.equal(Object.isFrozen(part), false); assert.equal(Object.isFrozen(components[0].outer), false); assert.equal(Object.isFrozen(selected.budgets), false);
  assert.notEqual(result.options, selected); assert.notEqual(result.options.budgets, selected.budgets);
  assert.notEqual(result.formal.source.brep, part.brep); assert.notEqual(result.formal.source.prismatic, part.solid.solid);
  assert.notEqual(result.native.assembly.proof.components[0].outer, components[0].outer);
  part.brep.faces[0].surface.controlPoints[0][0][0] += 1; part.solid.solid.slabs[0].z0 -= 1;
  components[0].outer[0][0] = 0.2; selected.density = 1; selected.budgets.volume = 1;
  assert.deepEqual(result, originalResult); assert.deepEqual(result.formal.source.brep, before.part.brep);
  deeplyFrozen(result);
  assert.throws(() => { result.options.budgets.centroid[0] = 1; }, TypeError);
  assert.throws(() => { result.native.assembly.brep.vertices[0].point[0] = 0; }, TypeError);
  assert.throws(() => { result.formal.properties.centroid[0] = 0; }, TypeError);
});

test('fresh source checking refuses changed coefficients and metadata after an earlier successful request', () => {
  const part = native(), components = pad(), selected = options(), result = buildCylindricalWrapBoundReference(part, components, selected);
  const changed = structuredClone(part); changed.brep.faces[0].surface.weights[0][0] = 0.75;
  const coefficientError = refused(changed, components, selected, 'SUPPORT'); assert.ok(isCylindricalWrapAssemblyError(coefficientError));
  const renamed = structuredClone(part); renamed.brep.faces[0].name += '_changed';
  const metadataError = refused(renamed, components, selected, 'SUPPORT'); assert.ok(isCylindricalWrapAssemblyError(metadataError));
  assert.deepEqual(result.formal.source.brep, part.brep); scoped(result);
});

test('getters, inherited options and caller authority flags cannot supply wrapper inputs', () => {
  let reads = 0;
  const part = native(), components = pad(), selected = options();
  const partGetter = native(); Object.defineProperty(partGetter, 'brep', { enumerable: true, get() { reads++; return part.brep; } });
  const componentGetter = pad(); Object.defineProperty(componentGetter[0], 'outer', { enumerable: true, get() { reads++; return components[0].outer; } });
  const optionGetter = options(); Object.defineProperty(optionGetter.budgets, 'volume', { enumerable: true, get() { reads++; return 1e-8; } });
  for (const args of [[partGetter, components, selected], [part, componentGetter, selected], [part, components, optionGetter]]) {
    const error = capture(() => buildCylindricalWrapBoundReference(...args));
    assert.ok(isCylindricalWrapBoundReferenceError(error)); assert.equal(error.code, 'INPUT');
  }
  assert.equal(reads, 0);
  const inherited = options(); Object.setPrototypeOf(inherited, { certified: true });
  const inheritedError = capture(() => buildCylindricalWrapBoundReference(part, components, inherited));
  assert.ok(isCylindricalWrapBoundReferenceError(inheritedError)); assert.equal(inheritedError.code, 'INPUT');
  for (const key of ['certified', 'native', 'formal', 'radius', 'rectangle', 'closedReferenceCertified']) refused(part, components, { ...options(), [key]: true }, 'INPUT');
  const hidden = options(); Object.defineProperty(hidden, 'certified', { value: true });
  const hiddenError = capture(() => buildCylindricalWrapBoundReference(part, components, hidden));
  assert.ok(isCylindricalWrapBoundReferenceError(hiddenError)); assert.equal(hiddenError.code, 'INPUT');
});

test('original native and formal refusals propagate with their namespace and wording', () => {
  const part = native(), components = pad(), selected = options();
  const nativeError = capture(() => buildCylindricalWrapNativeBoundAssembly(part, components, { id: selected.id, height: 5 }));
  const propagatedNative = refused(part, components, { ...selected, height: 5 }, 'SUPPORT');
  assert.ok(isCylindricalWrapAssemblyError(propagatedNative)); assert.equal(propagatedNative.message, nativeError.message);
  const tiny = options(); tiny.density = Number.MIN_VALUE;
  const formalError = capture(() => certifyCylindricalWrapFormalPadMass(part, { u: [0.125, 0.375], v: [0.25, 0.75] }, { id: tiny.id, density: tiny.density, budgets: tiny.budgets }));
  const propagatedFormal = refused(part, components, tiny, 'REPRESENTABILITY');
  assert.ok(isFormalPadMassError(propagatedFormal)); assert.equal(propagatedFormal.message, formalError.message);
  const hole = pad(); hole[0].holes.push([[0.2, 0.4], [0.3, 0.4], [0.3, 0.6], [0.2, 0.6]]);
  refused(part, hole, selected, 'SUPPORT'); refused(part, [...pad(), ...pad()], selected, 'SUPPORT');
});

test('the separately measured Z0 reference pad accepts both complete source checks without a prefix deduction', () => {
  const solid = prismaticFromProfile({outer:[{kind:'arc',start:[10,0],center:[0,0],direction:'ccw'}],height:30,from:0,tag:'post'});
  const part = {solid:{kind:'upright',solid},brep:brepFromPrismatic(solid,{id:'post'})};
  const components = [{outer:[[1/16,1/4],[5/16,1/4],[5/16,3/4],[1/16,3/4]],holes:[]}];
  const selected = {...options(),id:'wrap',density:1}, before = structuredClone({part,components,selected});
  const result = buildCylindricalWrapBoundReference(part,components,selected);
  ledger(result);scoped(result);assert.ok(result.counts.exactOperations<=200000);
  assert.equal(result.formal.counts.sourceOperations,result.formal.source.carrier.counts.rational.operations+result.formal.source.carrier.counts.integerOperations);
  assert.deepEqual(result.rectangle,{u:[1/16,5/16],v:[1/4,3/4]});
  assert.deepEqual({part,components,selected},before);
});
