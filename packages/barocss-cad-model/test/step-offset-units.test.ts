import test from 'node:test';
import assert from 'node:assert/strict';
// Shared kernel fixture is JavaScript; this test adds no duplicate geometry factory.
// @ts-expect-error The test-only .mjs factory has no TypeScript declaration.
import { planeOffsetStep, cylinderOffsetStep, unsupportedOffsetStep } from '../../barocss-cad/test/step-offset-fixtures.mjs';
import { emptyDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { evaluatePart, partBreps } from '../src/engine/evaluate';
import { stepLengthUnit } from '../src/engine/stepUnits';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { brepMassProperties, checkBrep } from '@barocss/cad';

/** Reproduce the existing raw-STEP Open unit composition, without a UI mock. */
function imported(step: string): StudioDoc {
  const unit = stepLengthUnit(step);
  let doc = withNode(emptyDoc(), { kind: 'import', name: 'offset input', step });
  if (unit.to !== 1) doc = withNode(doc, { kind: 'scale', parent: { node: 0, side: 'solid' }, factor: unit.to, pivot: [0, 0, 0] });
  return doc;
}
function volumeNear(actual: number, expected: number) {
  const error = Math.abs(actual - expected);
  assert.ok(error <= 1e-5 && error / Math.abs(expected) <= 1e-9, JSON.stringify({ actual, expected, error }));
}
function accepted(doc: StudioDoc, expectedVolume: number, expectedBounds: number[]) {
  const result = evaluatePart(doc, 1);
  assert.ok(result.ok, result.ok ? '' : result.error.detail);
  assert.equal(result.bodies.length, 1);
  const body = result.bodies[0];
  volumeNear(body.volume!, expectedVolume);
  const actual = [...body.mesh.bounds.min, ...body.mesh.bounds.max];
  assert.ok(actual.every((value, axis) => Math.abs(value - expectedBounds[axis]) <= 1e-6), JSON.stringify(actual));
  const native = partBreps(doc);
  assert.equal(native.length, 1);
  assert.equal(checkBrep(native[0].brep, { strict: true }).valid, true);
  volumeNear(brepMassProperties(native[0].brep, 1).volume, expectedVolume);
  return native[0].brep;
}

test('analytic plane OFFSET source remains exact and evaluates at its physical millimetre size', () => {
  const step = planeOffsetStep();
  const doc = imported(step);
  assert.equal(doc.nodes.length, 1);
  assert.ok(doc.nodes[0].kind === 'import');
  assert.equal(doc.nodes[0].step, step);
  const brep = accepted(doc, 24, [0, 0, 0, 4, 3, 2]);
  assert.equal(brep.faces.length, 6);
});

test('analytic cylinder OFFSET in centimetres uses exactly one scale node and its offset is scaled once', () => {
  const step = cylinderOffsetStep({ baseRadius: 1, distance: 0.2, height: 1, unit: 'cm' });
  const doc = imported(step);
  assert.deepEqual(stepLengthUnit(step), { name: 'centimetres', to: 10, declared: true });
  assert.equal(doc.nodes.length, 2);
  assert.ok(doc.nodes[0].kind === 'import');
  assert.equal(doc.nodes[0].step, step);
  assert.deepEqual(doc.nodes[1], { id: 'n1', kind: 'scale', parent: { node: 0, side: 'solid' }, factor: 10, pivot: [0, 0, 0] });
  const brep = accepted(doc, 1440 * Math.PI, [-12, -12, 0, 12, 12, 10]);
  assert.equal(brep.faces.length, 4, 'existing seam split keeps two wall faces and two caps');
});

test('advisory T/F/U does not reverse analytic cylinder offset distance', () => {
  for (const selfIntersect of ['T', 'F', 'U']) {
    const step = cylinderOffsetStep({ selfIntersect });
    accepted(imported(step), 1440 * Math.PI, [-12, -12, 0, 12, 12, 10]);
  }
});

test('native codec retains OFFSET STEP source and the existing unit scale without baking coordinates', async () => {
  const step = cylinderOffsetStep({ baseRadius: 1, distance: 0.2, height: 1, unit: 'cm' });
  const doc = imported(step);
  const read = await readStudioFile(encodeStudioFile(doc));
  assert.ok('doc' in read, JSON.stringify(read));
  assert.deepEqual(read.doc, doc);
  accepted(read.doc, 1440 * Math.PI, [-12, -12, 0, 12, 12, 10]);
});

test('unsupported OFFSET basis is an expected evaluation refusal and does not mutate accepted native input', () => {
  const doc = imported(cylinderOffsetStep());
  const before = structuredClone(doc);
  const result = evaluatePart(imported(unsupportedOffsetStep()), 2);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error.detail, /OFFSET_SURFACE basis CONICAL_SURFACE is not supported yet/);
    assert.doesNotMatch(result.error.detail, /unexpected kernel failure/i);
  }
  assert.deepEqual(doc, before);
  accepted(doc, 1440 * Math.PI, [-12, -12, 0, 12, 12, 10]);
});

test('nonbinding OFFSET cylinder refuses evaluation while the accepted scaled document remains unchanged', () => {
  const doc = imported(cylinderOffsetStep({ baseRadius: 1, distance: 0.2, height: 1, unit: 'cm' }));
  const before = structuredClone(doc);
  const mismatch = cylinderOffsetStep({ baseRadius: 10, distance: 3, boundaryRadius: 12 });
  const result = evaluatePart(imported(mismatch), 3);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error.detail, /OFFSET_SURFACE edge.*is separated from its surface/);
    assert.doesNotMatch(result.error.detail, /unexpected kernel failure/i);
  }
  assert.deepEqual(doc, before);
  accepted(doc, 1440 * Math.PI, [-12, -12, 0, 12, 12, 10]);
});
