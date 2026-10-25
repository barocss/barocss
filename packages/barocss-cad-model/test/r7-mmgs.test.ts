import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, massPropertiesOf } from '@barocss/cad';
import { rectanglePart } from '../src/engine/doc';
import { evaluatePart, deferMasses, massOfRef, partBreps } from '../src/engine/evaluate';
import { bodyMass, inertiaAbout } from '../src/app/mass';
import { addMate } from '../src/assembly/edit';
import { captureSignatures, verifyReferences } from '../src/engine/references';
import { readStudioDoc } from '../src/engine/migrate';
import { linkInertia } from '../src/robot/inertia';

const near = (actual: number, expected: number, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} vs ${expected}`);
const vector = (a: readonly number[], b: readonly number[]) => a.forEach((v, i) => near(v, b[i]));
const matrix = (a: readonly (readonly number[])[], diagonal: readonly number[]) => a.forEach((row, i) => row.forEach((v, j) => near(v, i === j ? diagonal[i] : 0)));

test('R7 MMGS: the independent 10 mm cube oracle, material scaling and parallel axis stay in g and g mm^2', () => {
  const doc = rectanglePart(10, 10, 10), r = evaluatePart(doc, 1); assert.ok(r.ok);
  const b = r.bodies[0]; near(b.volume!, 1000); near(b.mass!, 2.7); vector(b.centroid!, [5, 5, 5]); matrix(b.inertia!, [45, 45, 45]);
  const material = bodyMass(b, 2.7)!; near(material.mass, 2.7); matrix(material.inertia, [45, 45, 45]);
  const denser = bodyMass(b, 5.4)!; near(denser.mass, 5.4); matrix(denser.inertia, [90, 90, 90]);
  const moved = inertiaAbout(material.inertia, material.mass, material.centroid, [0, 5, 5]); matrix(moved, [45, 112.5, 112.5]);
  const si = linkInertia('base', 'base', doc, [b], { origin: [0, 0, 0], R: [1, 0, 0, 0, 1, 0, 0, 0, 1] });
  near(si.massKg, 0.0027); vector(si.comM, [0.005, 0.005, 0.005]);
  si.inertia.forEach((v, k) => near(v, k % 4 === 0 ? 45e-9 : 0, 1e-18));
  assert.ok(!('massG' in b) && !('volumeMM3' in b), 'no legacy aliases');
});

test('R7 MMGS: direct kernel results and deferred model fields agree without a second conversion', () => {
  const doc = rectanglePart(10, 10, 10), breps = partBreps(doc);
  assert.equal(breps.length, 1);
  const snapshot = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [{ kind: 'sketch', id: 's', profile: 'rectangle', min: [0, 0], max: [10, 10] }, { kind: 'extrude', id: 'b', sketch: 's', height: 10 }] });
  const mass = massPropertiesOf(snapshot.outputs[0], 2.7); near(mass.volume, 1000); near(mass.mass, 2.7); matrix(mass.inertia, [45, 45, 45]);
  deferMasses(true);
  try {
    const r = evaluatePart(rectanglePart(10, 10, 11), 2); assert.ok(r.ok); const b = r.bodies[0];
    assert.ok(b.massRef !== undefined); const fields = massOfRef(b.massRef)!;
    near(fields.volume!, 1100); near(fields.mass!, 2.97); vector(fields.centroid!, [5, 5, 5.5]);
    matrix(fields.inertia!, [2.97 * (100 + 121) / 12, 2.97 * (100 + 121) / 12, 49.5]);
  } finally { deferMasses(false); }
});

test('R7 supplement: O24(b) v2-compatible connectors preserve options, signatures and Save/Open at the new kernel boundary', async () => {
  const root = rectanglePart(20, 20, 5), doc = { ...root, instances: [{ id: 'p', name: 'box', doc: rectanglePart(10, 10, 3), position: [0, 0, 30] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] }] };
  const r = addMate(doc, { kind: 'distance', distance: 3, a: { part: 'base', face: 'n1.top', at: { offset: [0, 0, 2] } }, b: { part: 'p', face: 'n1.bottom', at: {} } });
  vector(r.doc.instances![0].position, [0, 0, 10]);
  const evaluate = async (d: typeof r.doc) => evaluatePart(d, 1), built = await evaluate(r.doc); assert.ok(built.ok);
  const signed = captureSignatures(r.doc, built.bodies), read = readStudioDoc(JSON.stringify(signed)); assert.ok('doc' in read);
  const checked = await verifyReferences(read.doc, built.bodies, evaluate); assert.deepEqual(checked.problems, []); assert.deepEqual(read.doc.mates![0].a.at, { offset: [0, 0, 2] });
});
