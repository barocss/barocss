import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, reevaluate, outputOf, massPropertiesOf, checkBrep, saveCadPart, loadCadPart, CadPartError } from '../dist/index.js';

// Frozen K07 oracle.json SHA404abc1624d967ad0e0b87c290255d19a2c3c76c28b6a699fad4ff3e30e8bdb3.
// World mm; density1g/cm3. This is a supported rectangle on the implicit horizontal top, not text or general-face emboss.
const close = (a, b) => assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const rect = (id, min, max) => ({ id, kind: 'sketch', profile: 'rectangle', min, max });
const base = () => [rect('s', [0, 0], [40, 30]), { id: 'base', kind: 'extrude', sketch: 's', height: 10 }];
const relief = mode => ({ id: 'relief', kind: 'rectangular-relief', target: 'base', min: [10, 12], max: [30, 18], depth: { parameter: 'depth' }, mode });
const document = (mode, features = [...base(), relief(mode)]) => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: { depth: 3 }, features });
function shape(snapshot, mode, depth = 3) {
  assert.equal(snapshot.outputs.length, 1); const out = outputOf(snapshot, 'relief');
  assert.equal(out.bodyCount, 1); assert.equal(out.brep.bodies[0].kind, 'solid');
  assert.equal(out.brep.shells.length, 1); assert.equal(out.brep.shells[0].closed, true);
  const report = checkBrep(out.brep); assert.equal(report.valid, true, report.issues.join('\n')); assert.equal(report.issues.length, 0);
  // Independent prism formulas: 12000 +/- 120*depth, with no geometry-derived expected value.
  const expectedVolume = mode === 'emboss' ? 12000 + 120 * depth : 12000 - 120 * depth;
  const mass = massPropertiesOf(out, 1); close(mass.volume, expectedVolume); close(mass.mass, expectedVolume / 1000);
  const expectedMax = [40, 30, mode === 'emboss' ? 10 + depth : 10];
  for (let k = 0; k < 3; k++) {
    close(Math.min(...out.brep.vertices.map(v => v.point[k])), 0);
    close(Math.max(...out.brep.vertices.map(v => v.point[k])), expectedMax[k]);
  }
  const level = mode === 'emboss' ? 10 + depth : 10 - depth;
  for (const x of [10, 30]) for (const y of [12, 18]) assert.ok(out.brep.vertices.some(v => v.point.every((c, k) => Math.abs(c - [x, y, level][k]) <= 1e-9 * Math.max(1, Math.abs([x, y, level][k])))), `missing relief corner ${x},${y},${level}`);
  return out;
}
const refused = (doc, code) => assert.throws(() => evaluateCadPart(doc), e => e instanceof CadPartError && e.code === code && e.feature === 'relief');

test('rectangular relief: public document evaluation adds or removes the fixed top prism and preserves codec, Dim and prior state', () => {
  for (const mode of ['emboss', 'engrave']) {
    const input = document(mode), before = structuredClone(input), accepted = evaluateCadPart(input), acceptedDoc = structuredClone(accepted.document);
    const out = shape(accepted, mode), mass = massPropertiesOf(out, 1);
    close(mass.volume, mode === 'emboss' ? 12360 : 11640); close(mass.mass, mode === 'emboss' ? 12.36 : 11.64);
    const text = saveCadPart(accepted), reopened = loadCadPart(text);
    assert.deepEqual(reopened.document, acceptedDoc); assert.deepEqual(outputOf(reopened, 'relief').brep, out.brep);
    assert.deepEqual(massPropertiesOf(outputOf(reopened, 'relief'), 1), mass);
    shape(reevaluate(accepted, { parameters: { depth: 4 } }), mode, 4);
    assert.throws(() => reevaluate(accepted, { parameters: { depth: 10 } }), e => e instanceof CadPartError && e.code === 'PARAMETER' && e.feature === 'relief');
    assert.deepEqual(input, before); assert.deepEqual(accepted.document, acceptedDoc); assert.equal(saveCadPart(accepted), text); shape(accepted, mode);
    // A supported positive-area footprint may reach an outer edge; it is not contact-only.
    const edge = document(mode, [...base(), { ...relief(mode), min: [30, 12], max: [40, 18] }]);
    close(massPropertiesOf(outputOf(evaluateCadPart(edge), 'relief'), 1).volume, mode === 'emboss' ? 12180 : 11820);
  }
});

test('rectangular relief: unsupported footprint, hole space, depth, mode, target and surface families refuse without mutation', () => {
  for (const mode of ['emboss', 'engrave']) {
    for (const [min, max] of [[[40, 12], [45, 18]], [[40, 30], [45, 35]], [[41, 12], [45, 18]], [[35, 12], [45, 18]]]) {
      const input = document(mode, [...base(), { ...relief(mode), min, max }]), before = structuredClone(input);
      refused(input, 'GEOMETRY'); assert.deepEqual(input, before);
    }
    const hole = [[8, 10], [32, 10], [32, 20], [8, 20]].map(start => ({ kind: 'line', start }));
    const windowed = base(); windowed[0].holes = [hole];
    refused(document(mode, [...windowed, relief(mode)]), 'GEOMETRY');
    for (const depth of [0, -1, 10, 11, NaN, Infinity]) refused(document(mode, [...base(), { ...relief(mode), depth }]), 'PARAMETER');
    refused(document(mode, [...base(), { ...relief(mode), min: [10, 12], max: [10, 18] }]), 'PARAMETER');
  }
  refused(document('unsupported'), 'INPUT');
  for (const target of ['missing', 'relief']) refused(document('emboss', [...base(), { ...relief('emboss'), target }]), 'REFERENCE');
  const curved = [{ id: 's', kind: 'sketch', profile: 'circle', center: [20, 15], radius: 20 }, { id: 'base', kind: 'extrude', sketch: 's', height: 10 }, relief('emboss')];
  refused(document('emboss', curved), 'CAPABILITY');
  const stepped = [...base(), rect('stepSketch', [5, 5], [35, 25]), { id: 'step', kind: 'extrude', sketch: 'stepSketch', height: 15 }, { id: 'steps', kind: 'union', target: 'base', tool: 'step' }, { ...relief('emboss'), target: 'steps' }];
  refused(document('emboss', stepped), 'CAPABILITY');
  const multiple = [...base(), rect('otherSketch', [50, 0], [60, 10]), { id: 'other', kind: 'extrude', sketch: 'otherSketch', height: 10 }, { id: 'both', kind: 'union', target: 'base', tool: 'other' }, { ...relief('emboss'), target: 'both' }];
  refused(document('emboss', multiple), 'REFERENCE');
});
