import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { importStep, evaluateCadPart, checkBrep, brepMassProperties, brepSurfaceArea, BrepError } from '../dist/index.js';
import { representabilitySphereStep } from './step-sphere-representability-fixtures.mjs';
import { unsupportedOffsetStep } from './step-offset-fixtures.mjs';

const document = step => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [{ id: 'n0', kind: 'import', step }] });
const far = ['999000','-998000','997000'];
const precisionMessage = /SPHERICAL_SURFACE patch precision is not supported.*the sphere would lose its three-dimensional shape/;
function validNative(b) {
  const report = checkBrep(b, { strict: true });
  assert.equal(report.valid, true, report.issues.join('\n'));
  assert.deepEqual([b.bodies.length, b.faces.length, b.edges.length, b.vertices.length], [1,2,2,2]);
  assert.equal(b.lengthUnit, 'mm');
  for (const f of b.faces) {
    assert.ok(f.surface.controlPoints.flat(2).every(Number.isFinite));
    for (let k=0;k<3;k++) {
      const values = f.surface.controlPoints.flat().map(p => p[k]);
      assert.ok(Math.max(...values) > Math.min(...values), 'accepted sphere retains a nonzero span on every Cartesian axis');
    }
  }
  return b;
}

// Current-source captures accepted these literal files as strict-valid, then returned
// singular/zero-volume errors from mass or area. The new refusal must occur on import.
for (const [name, center] of [
  ['point collapse', far],
  ['line collapse', ['999000','-998000','0']],
  ['planar collapse', ['999000','0','0']],
]) {
  test(`direct sphere refuses ${name} with typed raw precision capability`, () => {
    const text = representabilitySphereStep({ radius:'1e-12', center });
    assert.throws(() => importStep(text), e => e instanceof BrepError && e.code === 'INPUT' && precisionMessage.test(e.message));
  });
  test(`public part refuses ${name} before accepting a degenerate solid`, () => {
    const doc = document(representabilitySphereStep({ radius:'1e-12', center })), before = structuredClone(doc);
    assert.throws(() => evaluateCadPart(doc), e => e.code === 'CAPABILITY' && precisionMessage.test(e.message));
    assert.deepEqual(doc, before);
  });
}

test('centered sub-tolerance sphere remains represented and accepted', () => {
  const b = validNative(importStep(representabilitySphereStep({ radius:'1e-12' }))), m = brepMassProperties(b, 1), area = brepSurfaceArea(b);
  assert.ok(Number.isFinite(m.volume) && m.volume > 0);
  assert.ok(Number.isFinite(area) && area > 0);
  assert.deepEqual(b.edges.map(e => e.tolerance), [1e-7,1e-7]);
});
test('public centered sub-tolerance sphere retains the existing native mm contract', () => {
  const result = evaluateCadPart(document(representabilitySphereStep({ radius:'1e-12' })));
  assert.equal(result.outputs.length, 1);
  validNative(result.outputs[0].brep);
});

// Full native tables captured before this repair. These include every coordinate,
// weight, knot, sense, ID, topology use, source field, and native tolerance.
for (const [name, center, fingerprint, tolerance] of [
  ['centered', ['0','0','0'], '25cfe27749cfb5bb7e017d2ab101dd6230fde2fa340f35e6cf5e07fce8280028', 1e-7],
  ['far', far, '82f5403bda7fb8f5451ba52af9f301859d46ee1d7fba1a224872c7590c152200', 9.9900000048e-6],
]) test(`existing .001 ${name} sphere retains its exact native tables`, () => {
  const b = validNative(importStep(representabilitySphereStep({ center })));
  assert.equal(createHash('sha256').update(JSON.stringify(b)).digest('hex'), fingerprint);
  assert.deepEqual(b.edges.map(e => e.tolerance), [tolerance,tolerance]);
  assert.deepEqual(b.vertices.map(v => v.tolerance), [tolerance,tolerance]);
});

for (const [name, options] of [
  ['ordinary radius', { radius:'7' }],
  ['small radius', { radius:'0.0000001' }],
  ['aligned frame', { center:far, compound:false }],
  ['reversed seam', { center:far, reversed:true }],
  ['reversed face sense', { center:far, faceSense:false }],
]) test(`direct sphere keeps supported ${name}`, () => validNative(importStep(representabilitySphereStep(options))));

test('public part document units remain mm-only', () => {
  const doc = document(representabilitySphereStep());
  assert.throws(() => evaluateCadPart({ ...doc, units:'m' }), e => e.code === 'FORMAT' && /document in mm/.test(e.message));
  validNative(evaluateCadPart(doc).outputs[0].brep);
});
test('sphere OFFSET support remains an explicit deferred capability', () => {
  const text = unsupportedOffsetStep();
  assert.throws(() => importStep(text), e => e instanceof BrepError && e.code === 'INPUT' && /OFFSET_SURFACE basis SPHERICAL_SURFACE is not supported yet/.test(e.message));
  assert.throws(() => evaluateCadPart(document(text)), e => e.code === 'CAPABILITY' && /OFFSET_SURFACE basis SPHERICAL_SURFACE is not supported yet/.test(e.message));
});
