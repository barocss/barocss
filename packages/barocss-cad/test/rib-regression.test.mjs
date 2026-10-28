import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, outputOf, massPropertiesOf, checkBrep, reevaluate, saveCadPart, loadCadPart, CadPartError } from '../dist/index.js';

// Fixed K06 oracle: world mm, volume mm3, density 1 g/cm3. No observed output defines the expectations.
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
const rect = (id, min, max) => ({ id, kind: 'sketch', profile: 'rectangle', min, max });
const base = () => [rect('s', [0, 0], [40, 30]), { id: 'base', kind: 'extrude', sketch: 's', height: 10 }];
const rib = () => ({ id: 'rib', kind: 'rib', target: 'base', min: [10, 14, 9], max: [30, 16, { parameter: 'top' }] });
const doc = (features = [...base(), rib()]) => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: { top: 15 }, features });
function shape(snapshot, volume = 12200, top = 15) {
  assert.equal(snapshot.outputs.length, 1);
  const out = outputOf(snapshot, 'rib');
  assert.equal(out.bodyCount, 1); assert.equal(out.brep.bodies[0].kind, 'solid');
  const report = checkBrep(out.brep); assert.equal(report.valid, true, report.issues.join('\n')); assert.equal(report.issues.length, 0);
  const mass = massPropertiesOf(out, 1); close(mass.volume, volume); close(mass.mass, volume / 1000);
  for (const [kind, expected] of [['min', [0, 0, 0]], ['max', [40, 30, top]]]) {
    for (let k = 0; k < 3; k++) close(Math[kind](...out.brep.vertices.map(v => v.point[k])), expected[k]);
  }
  return out;
}
const refused = (input, code, message) => assert.throws(() => evaluateCadPart(input), e => e instanceof CadPartError && e.code === code && e.feature === 'rib' && message.test(e.message));

test('rib: positive material overlap joins one rectangular rib, preserves Dim and codec, and reevaluates atomically', () => {
  const input = doc(), before = structuredClone(input), accepted = evaluateCadPart(input), saved = structuredClone(accepted.document);
  const out = shape(accepted); assert.deepEqual(input, before);
  // 240 mm3 rib minus 40 mm3 overlap adds 200 mm3 to the 12000 mm3 base.
  close(massPropertiesOf(out, 1).mass, 12.2);
  const text = saveCadPart(accepted), reopened = loadCadPart(text);
  assert.deepEqual(reopened.document, accepted.document); assert.deepEqual(outputOf(reopened, 'rib').brep, out.brep);
  assert.deepEqual(massPropertiesOf(outputOf(reopened, 'rib'), 1), massPropertiesOf(out, 1));
  shape(reevaluate(accepted, { parameters: { top: 16 } }), 12240, 16);
  assert.throws(() => reevaluate(accepted, { parameters: { top: 9 } }), e => e instanceof CadPartError && e.code === 'PARAMETER' && e.feature === 'rib');
  assert.deepEqual(accepted.document, saved); assert.equal(saveCadPart(accepted), text); shape(accepted);
});

test('rib: face, edge and point contact, separation, containment and empty hole space cannot masquerade as added rib material', () => {
  for (const [min, max] of [
    [[10, 14, 10], [30, 16, 15]], // Face contact only.
    [[40, 14, 10], [45, 16, 15]], // Edge contact only.
    [[40, 30, 10], [45, 35, 15]], // Point contact only.
    [[10, 14, 11], [30, 16, 15]], // Separated above the body.
  ]) refused(doc([...base(), { ...rib(), min, max }]), 'GEOMETRY', /positive volume overlap/);
  refused(doc([...base(), { ...rib(), min: [10, 14, 2], max: [30, 16, 8] }]), 'GEOMETRY', /add positive volume/);
  const hole = [[8, 12], [32, 12], [32, 18], [8, 18]].map(start => ({ kind: 'line', start }));
  const windowed = base(); windowed[0].holes = [hole];
  // Its AABB overlaps the base AABB, but the whole rib lies in a through window.
  refused(doc([...windowed, { ...rib(), min: [10, 14, 2], max: [30, 16, 8] }]), 'GEOMETRY', /positive volume overlap/);
});

test('rib: malformed sizes, references and multiple physical bodies are typed refusals without input mutation', () => {
  for (const [min, max] of [
    [[10, 14, 9], [10, 16, 15]], [[30, 14, 9], [10, 16, 15]],
    [[10, 14, 9], [30, 16, Infinity]], [[10, 14, 9], [30, 16, 10001]],
  ]) {
    const input = doc([...base(), { ...rib(), min, max }]), before = structuredClone(input);
    refused(input, 'PARAMETER', /rib min|finite|10000/); assert.deepEqual(input, before);
  }
  for (const target of ['missing', 'rib']) refused(doc([...base(), { ...rib(), target }]), 'REFERENCE', /earlier feature/);
  // A Boolean union can have one Part while still containing two disjoint physical bodies.
  const two = [...base(), rect('otherSketch', [50, 0], [60, 10]), { id: 'other', kind: 'extrude', sketch: 'otherSketch', height: 10 },
    { id: 'both', kind: 'union', target: 'base', tool: 'other' }, { ...rib(), target: 'both' }];
  refused(doc(two), 'REFERENCE', /one nonempty solid/);
});
