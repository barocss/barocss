// Independent MMGS report oracles. Solvers and native exports retain their own internal units.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Robot, part, BarocssError } from '../src/api';
import type { StudioDoc } from '../src/engine/doc';

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) <= 1e-9, `${actual} != ${expected}`);
const cube = () => part('cube').box({ w: 10, d: 10, h: 10 }).material('al6061');

test('public robot inertia of a 10 mm cube is 2.7 g and 45 g mm2, without SI aliases', t => {
  const r = new Robot(cube().doc), before = JSON.stringify(r.doc), [l] = r.inertia().links;
  t.diagnostic(JSON.stringify(l));
  close(l.mass, 2.7);
  l.centroid.forEach(value => close(value, 5));
  l.inertia.forEach((row, i) => row.forEach((value, j) => close(value, i === j ? 45 : 0)));
  l.principal.moments.forEach(value => close(value, 45));
  l.frame.origin.forEach(value => close(value, 0));
  close(l.bodies[0].mass, 2.7);
  for (const key of ['mass_kg', 'com_m', 'inertia_kg_m2']) assert.equal(key in l, false, key);
  assert.equal('moments_kg_m2' in l.principal, false);
  assert.equal('origin_mm' in l.frame, false);
  assert.equal('massKg' in l.bodies[0], false);
  assert.equal(JSON.stringify(r.doc), before);
});

test('public default gravity is 9806.65 mm/s2; explicit 9810 stays distinct; invalid vectors remain refused', t => {
  const r = new Robot(cube().doc), standard = r.gravity(), explicit = r.gravity({}, [0, 0, -9810]);
  t.diagnostic(JSON.stringify({ standard, explicit }));
  close(standard.gravity, 9806.65); close(explicit.gravity, 9810);
  assert.equal('gravity_m_s2' in standard, false);
  assert.throws(() => r.gravity({}, [0, 0, Number.NaN]), e => e instanceof BarocssError && e.code === 'ROBOT');
});

/** One upright block rotates about +Y through its lower transverse hole. Its centre is 20 mm above the joint. */
function arm(): Robot {
  const block = part('block').box({ w: 20, d: 20, h: 80 })
    .hole(b => b.faces().facing('+z'), { d: 8, type: 'blind', depth: 8, x: 10, y: 10 })
    .hole(b => b.faces().facing('-z'), { d: 8, type: 'blind', depth: 8, x: 10, y: 10 })
    .hole(b => b.faces().facing('+y'), { d: 8, x: 10, y: 20 })
    .hole(b => b.faces().facing('+y'), { d: 8, x: 10, y: 60 }).material('al6061');
  const doc: StudioDoc = { ...block.doc,
    instances: [{ id: 'arm', name: 'arm', doc: block.doc, position: [0, 20, 40], rotation: [0, 0, 0] }],
    mates: [
      { id: 'axis', kind: 'concentric', a: { part: 'base', face: 'n5.side0' }, b: { part: 'arm', face: 'n4.side0' } },
      { id: 'seat', kind: 'coincident', a: { part: 'base', face: 'n1.side2' }, b: { part: 'arm', face: 'n1.side0' } },
    ],
  };
  return new Robot(doc);
}

test('a 90 degree arm reports the independent holding moment in N mm, including explicit gravity', t => {
  const r = arm(), [joint] = r.joints().joints;
  assert.equal(joint.type, 'continuous'); assert.deepEqual(joint.axis, [0, 1, 0]);
  const mass = (20 * 20 * 80 - 2 * Math.PI * 4 ** 2 * 8 - 2 * Math.PI * 4 ** 2 * 20) * 2.7 / 1000;
  for (const gravity of [9806.65, 9810]) {
    const result = gravity === 9806.65 ? r.gravity({ [joint.key]: 90 }) : r.gravity({ [joint.key]: 90 }, [0, 0, -gravity]);
    t.diagnostic(JSON.stringify({ gravity, result }));
    const expected = -mass * gravity / 1e6 * 20;
    assert.equal(result.units[joint.key], 'N·mm');
    close(result.torques[joint.key], expected); close(result.generalized[joint.key], expected);
  }
});

test('a vertical 10 mm cube slide reports force in N, without the turning moment factor', t => {
  const block = cube().doc;
  const doc: StudioDoc = { ...block,
    instances: [{ id: 'slide', name: 'slide', doc: block, position: [10, 10, 0], rotation: [0, 0, 0] }],
    mates: [
      { id: 'x', kind: 'coincident', a: { part: 'base', face: 'n1.side1' }, b: { part: 'slide', face: 'n1.side3' } },
      { id: 'y', kind: 'coincident', a: { part: 'base', face: 'n1.side2' }, b: { part: 'slide', face: 'n1.side0' } },
    ],
  };
  const r = new Robot(doc), [joint] = r.joints().joints;
  assert.equal(joint.type, 'prismatic'); assert.deepEqual(joint.axis, [0, 0, 1]);
  for (const gravity of [9806.65, 9810]) {
    const result = gravity === 9806.65 ? r.gravity({ [joint.key]: 20 }) : r.gravity({ [joint.key]: 20 }, [0, 0, -gravity]);
    t.diagnostic(JSON.stringify({ gravity, result }));
    assert.equal(result.units[joint.key], 'N');
    close(result.torques[joint.key], 2.7 * gravity / 1e6);
    close(result.generalized[joint.key], 2.7 * gravity / 1e6);
  }
});
