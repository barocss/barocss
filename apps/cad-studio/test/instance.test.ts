import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePart, exportStudioStep } from '@barocss/cad-model/engine/evaluate';
import { placedDoc, rectanglePart, type PartInstance } from '@barocss/cad-model/engine/doc';

test('instances: a part placed by rotation then a move, in display and in STEP', () => {
  const part = rectanglePart(20, 10, 4);
  const inst: PartInstance = { id: 'i1', name: 'Plate', doc: part, position: [100, 0, 0], rotation: [0, 0, 90] };
  const r = evaluatePart(placedDoc(inst), 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  const b = r.bodies[0].mesh.bounds;
  // The 20 × 10 plate turned 90° about Z spans x −10..0 then moves to 90..100; y 0..20.
  const near = (a: number, e: number) => Math.abs(a - e) < 1e-6;
  assert.ok(near(b.min[0], 90) && near(b.max[0], 100) && near(b.min[1], 0) && near(b.max[1], 20) && near(b.max[2], 4), JSON.stringify(b));
  assert.ok(near(r.bodies[0].volume!, 800));
  const step = exportStudioStep({ ...part, instances: [inst, { ...inst, id: 'i2', position: [0, 50, 0] }] }, { name: 'assembly' });
  assert.equal((step.text.match(/MANIFOLD_SOLID_BREP/g) ?? []).length, 3, 'the part and its two instances');
  const hidden = exportStudioStep({ ...part, instances: [{ ...inst, hidden: true }] }, { name: 'assembly' });
  assert.ok((hidden.text.match(/MANIFOLD_SOLID_BREP/g) ?? []).length === 1);
});

test('exploded view: instances pushed out from the middle by the factor; the meshes moved, not the parts', async () => {
  const { explodeOffsets, movedBody } = await import('@barocss/cad-model/assembly/explode');
  const { evaluateDoc } = await import('@barocss/cad-model/engine/evaluate');
  const { rectanglePart } = await import('@barocss/cad-model/engine/doc');
  const r = evaluateDoc(rectanglePart(10, 10, 10), 1); assert.ok(r.ok);
  const b = r.bodies[0], right = movedBody(b, [30, 0, 0]), left = movedBody(b, [-30, 0, 0]);
  const off = explodeOffsets([b], [{ id: 'r', bodies: [right] }, { id: 'l', bodies: [left] }], 1);
  assert.deepEqual(off.get('r'), [30, 0, 0]); assert.deepEqual(off.get('l'), [-30, 0, 0]);
  assert.deepEqual(movedBody(right, off.get('r')!).mesh.bounds.min, [60, 0, 0]);
  assert.equal(explodeOffsets([b], [{ id: 'r', bodies: [right] }], 0).size, 0, 'off: nothing moves');
  // An instance at the middle goes straight up.
  assert.ok(explodeOffsets([], [{ id: 'm', bodies: [b] }, { id: 'n', bodies: [b] }], 1).get('m')![2] > 0);
});
