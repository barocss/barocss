// Actual facade replies against independent physical quantities, on the assigned R7 B1 assembly.
import test from 'node:test';
import assert from 'node:assert/strict';
// #region import
import { Robot, part, BarocssError } from '@barocss/cad-model/api';
// #endregion import
import { cubeCase } from './robot-contract.fixture.mjs';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
// #region cube
const cube = () => part('cube').box({ w: 10, d: 10, h: 10 }).material('al6061');
// #endregion cube

test('facade cube inertia: mass, centroid, full tensor, principal moments and body mass use MMGS', t => {
  // #region cube-report
  const robot = new Robot(cube().doc), before = robot.doc;
  const [link] = robot.inertia().links;
  near(link.mass, cubeCase.mass);                   // 2.7 g
  link.centroid.forEach((value, i) => near(value, cubeCase.centroid[i])); // [5, 5, 5] mm
  link.inertia.forEach((row, i) => row.forEach((value, j) => near(value, cubeCase.inertia[i][j]))); // diag 45 g·mm²
  link.principal.moments.forEach((value, i) => near(value, cubeCase.moments[i]));
  link.frame.origin.forEach(value => near(value, 0)); // mm
  near(link.bodies[0].mass, cubeCase.mass);          // the body's mass is also in g
  // #endregion cube-report
  for (const old of ['mass_kg', 'com_m', 'inertia_kg_m2']) assert.equal(old in link, false, old);
  assert.equal('moments_kg_m2' in link.principal, false);
  assert.equal('origin_mm' in link.frame, false);
  assert.equal('massKg' in link.bodies[0], false);
  assert.deepEqual(robot.doc, before);
  t.diagnostic(JSON.stringify(link));
});

test('facade gravity: preserve default 9806.65, distinguish explicit 9810, retain typed vector refusal', t => {
  // #region gravity
  const robot = new Robot(cube().doc);
  const standard = robot.gravity();
  const explicit = robot.gravity({}, [0, 0, -9810]);
  near(standard.gravity, 9806.65);                  // magnitude, mm/s²
  near(explicit.gravity, 9810);                    // this call supplies 9.81 m/s²
  // #endregion gravity
  assert.equal('gravity_m_s2' in standard, false);
  assert.throws(() => robot.gravity({}, [0, 0, Number.NaN]), e => e instanceof BarocssError && e.code === 'ROBOT');
  t.diagnostic(JSON.stringify({ standard, explicit }));
});

// #region slide
function cubeSlide() {
  const block = cube().doc;
  return new Robot({ ...block,
    instances: [{ id: 'slide', name: 'slide', doc: block, position: [10, 10, 0], rotation: [0, 0, 0] }],
    mates: [
      { id: 'x', kind: 'coincident', a: { part: 'base', face: 'n1.side1' }, b: { part: 'slide', face: 'n1.side3' } },
      { id: 'y', kind: 'coincident', a: { part: 'base', face: 'n1.side2' }, b: { part: 'slide', face: 'n1.side0' } },
    ],
  });
}
// #endregion slide

test('facade vertical slide: cube weight remains N for default and explicit gravity', t => {
  const robot = cubeSlide(), before = robot.doc, [joint] = robot.joints().joints;
  assert.equal(joint.type, 'prismatic');
  assert.deepEqual(joint.axis, [0, 0, 1]);
  // #region slide-force
  for (const [gravity, expected] of [[undefined, 0.026477955], [cubeCase.gravity, cubeCase.force]]) {
    const reply = robot.gravity({ [joint.key]: 20 }, gravity);
    assert.equal(reply.units[joint.key], 'N');
    near(reply.torques[joint.key], expected);        // mass in kg × acceleration in m/s²
    near(reply.generalized[joint.key], expected);
    t.diagnostic(JSON.stringify({ gravity: reply.gravity, force: reply.torques[joint.key], expected }));
  }
  // #endregion slide-force
  assert.deepEqual(robot.doc, before);
});

// #region arm
function drilledArm() {
  const block = part('block').box({ w: 20, d: 20, h: 80 })
    .hole(b => b.faces().facing('+z'), { d: 8, type: 'blind', depth: 8, x: 10, y: 10 })
    .hole(b => b.faces().facing('-z'), { d: 8, type: 'blind', depth: 8, x: 10, y: 10 })
    .hole(b => b.faces().facing('+y'), { d: 8, x: 10, y: 20 })
    .hole(b => b.faces().facing('+y'), { d: 8, x: 10, y: 60 }).material('al6061');
  return new Robot({ ...block.doc,
    instances: [{ id: 'arm', name: 'arm', doc: block.doc, position: [0, 20, 40], rotation: [0, 0, 0] }],
    mates: [
      { id: 'axis', kind: 'concentric', a: { part: 'base', face: 'n5.side0' }, b: { part: 'arm', face: 'n4.side0' } },
      { id: 'seat', kind: 'coincident', a: { part: 'base', face: 'n1.side2' }, b: { part: 'arm', face: 'n1.side0' } },
    ],
  });
}
// #endregion arm

test('facade hinge: independent drilled-block mass and 20 mm arm give the holding torque in N·mm', t => {
  const robot = drilledArm(), before = robot.doc, [joint] = robot.joints().joints;
  assert.equal(joint.type, 'continuous');
  assert.deepEqual(joint.axis, [0, 1, 0]);
  // #region arm-torque
  // Two blind bores (r=4, depth=8) and two transverse through bores (r=4, length=20), with no overlap.
  const volume = 20 * 20 * 80 - 2 * Math.PI * 4 ** 2 * 8 - 2 * Math.PI * 4 ** 2 * 20;
  const mass = volume * 2.7 / 1000;                 // g; closed-form geometry, not a report-derived oracle
  for (const gravity of [9806.65, 9810]) {
    const reply = gravity === 9806.65 ? robot.gravity({ [joint.key]: 90 })
      : robot.gravity({ [joint.key]: 90 }, [0, 0, -gravity]);
    const expected = -mass * gravity / 1e6 * 20;     // N × 20 mm, holding about +Y
    assert.equal(reply.units[joint.key], 'N·mm');
    near(reply.torques[joint.key], expected);
    near(reply.generalized[joint.key], expected);
    t.diagnostic(JSON.stringify({ gravity, torque: reply.torques[joint.key], expected }));
  }
  // #endregion arm-torque
  assert.deepEqual(robot.doc, before);
});
