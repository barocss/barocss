import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { rectanglePart, withNode } from '@barocss/cad-model/engine/doc';

// A 32×32×16 box: its top front edge joins a 32 mm top and a 16 mm front wall.
const finish = (kind: 'fillet' | 'chamfer', size: number) => evaluateDoc(withNode(rectanglePart(32, 32, 16), kind === 'fillet'
  ? { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: ['n1.side0|n1.top'], radius: size }
  : { kind: 'chamfer', parent: { node: 1, side: 'solid' }, edges: ['n1.side0|n1.top'], distance: size }), 1);

test('finish: a fillet or chamfer up to the wall fits; a larger one is refused, not distorted', () => {
  for (const [kind, size, volume] of [['fillet', 4, 16384 * 2 - (16 - 4 * Math.PI) * 32 - 16384], ['fillet', 16, 32 * (512 - 256 + 64 * Math.PI)], ['chamfer', 16, 12288]] as const) {
    const r = finish(kind, size); assert.ok(r.ok, `${kind} ${size}: ${!r.ok && r.error.detail}`);
    assert.deepEqual(r.bodies[0].mesh.bounds.min, [0, 0, 0]);
    assert.ok(Math.abs(r.bodies[0].volumeMM3! - volume) / volume < 3e-4, `${kind} ${size}: ${r.bodies[0].volumeMM3} vs ${volume}`);
  }
  for (const [kind, size] of [['fillet', 16.5], ['fillet', 20], ['chamfer', 17], ['chamfer', 20]] as const) {
    const r = finish(kind, size); assert.ok(!r.ok, `${kind} ${size} accepted`);
    assert.equal(r.error.title, 'The chamfer or fillet is too large'); assert.match(r.error.detail, /walls of 16 and 32 mm/);
  }
});
