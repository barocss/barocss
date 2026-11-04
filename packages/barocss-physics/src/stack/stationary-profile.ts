/** Private physical admission. No scene IDs, solver options or expected state. */
import type { PhysicsCommand, PhysicsModel, WorldOptions } from '../types.js';
import type { Body } from '../internal-types.js';
import { error } from '../validation.js';

export const STATIONARY_PROFILE = 'rigid-stationary-cube-stack-v1' as const;
export const STATIONARY_MAX_STEPS = 1200;
const same = (actual: readonly number[], expected: readonly number[]) =>
  actual.length === expected.length && actual.every((value, index) => value === expected[index]);
function requireProfile(value: unknown, message: string): asserts value {
  if (!value) error('INVALID_CONFIG', 'stationary cube stack: ' + message);
}

/** Call after generic copied model/schema/ID/reference and primitive-parser validation. */
export function admitStationaryProfile(model: PhysicsModel, options: WorldOptions, bodies: readonly Body[]): void {
  requireProfile(options.profile === STATIONARY_PROFILE && options.broadPhase === 'direct' &&
    options.fixedStepSeconds === 1 / 120 && same(model.gravityMps2, [0, -9.81, 0]), 'fixed direct dt/gravity');
  requireProfile(bodies.length === 9 && bodies.filter(body => body.kind === 'dynamic').length === 8 &&
    bodies.filter(body => body.kind === 'static').length === 1 && model.joints.length === 0 &&
    model.cloths.length === 0 && model.fluids.length === 0, 'eight cubes and one floor only');
  for (let index = 0; index < bodies.length; index++) {
    const body = bodies[index], authored = model.bodies[index];
    requireProfile(body.shape.kind === 'box' && !body.sensor && !body.ccd && !body.collisionFilter &&
      !body.sleeping && body.restitution === 0 && body.frictionStatic === 1 && body.frictionDynamic === .7,
      'original unfiltered unsensed box material');
    requireProfile(same(body.velocityMps, [0, 0, 0]) && same(body.angularVelocityRadps, [0, 0, 0]), 'zero initial motion');
    if (body.kind === 'dynamic') {
      requireProfile(authored.kind === 'dynamic' && authored.massKg === 1 && authored.inertia.kind === 'primitive-com' &&
        body.inverseMass === 1 && same(body.inverseInertiaLocal, [24, 24, 24]) &&
        same(body.shape.halfExtentsM, [.25, .25, .25]), 'unit primitive-COM isotropic cube');
      // Test AUTHORED components: a nonzero subnormal tilt cannot vanish in normalization.
      requireProfile(authored.initial.orientationXYZW[0] === 0 && authored.initial.orientationXYZW[2] === 0 &&
        body.orientation[0] === 0 && body.orientation[2] === 0, 'authored yaw-only orientation');
    } else {
      requireProfile(body.kind === 'static' && body.inverseMass === 0 && same(body.inverseInertiaLocal, [0, 0, 0]) &&
        same(body.shape.halfExtentsM, [2, .1, 2]) && same(body.positionM, [0, -.1, 0]) &&
        same(body.orientation, [0, 0, 0, 1]) && same(authored.initial.orientationXYZW, [0, 0, 0, 1]), 'fixed original floor');
    }
  }
}

/** Generic command parsing still owns malformed-command precedence. */
export function admitStationaryCommands(commands: readonly PhysicsCommand[]): void {
  if (commands.length !== 0) error('INVALID_COMMAND', 'stationary cube stack admits empty commands only');
}
