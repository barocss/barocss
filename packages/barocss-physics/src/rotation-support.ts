import type { PhysicsModel, WorldOptions } from './types.js';
import type { Body } from './internal-types.js';
import type { AdmittedCommands } from './validation.js';
import type { FreeRotationResult } from './rigid-free-rotation.js';
import { error } from './validation.js';

const equal = (actual: readonly number[], expected: readonly number[]): boolean =>
  actual.length === expected.length && actual.every((value, index) => value === expected[index]);

/** Restrict noncubic dynamic boxes after normal admission. Labels and provenance stay inert. */
export function admitRotationSupport(model: PhysicsModel, options: WorldOptions, bodies: Body[]): boolean {
  const noncubic = bodies.filter(body => body.kind === 'dynamic' && body.shape.kind === 'box' &&
    (body.shape.halfExtentsM[0] !== body.shape.halfExtentsM[1] ||
      body.shape.halfExtentsM[1] !== body.shape.halfExtentsM[2]));
  if (noncubic.length === 0) return false;
  const body = noncubic[0], authored = model.bodies[0], collider = model.colliders[0];
  if (noncubic.length !== 1 || bodies.length !== 1 || model.bodies.length !== 1 ||
      model.colliders.length !== 1 || model.joints.length !== 0 || model.cloths.length !== 0 ||
      model.fluids.length !== 0 || options.profile !== 'rigid-discrete-v1' ||
      options.broadPhase !== 'direct' || options.fixedStepSeconds !== 1 / 120 ||
      authored.kind !== 'dynamic' || authored.massKg !== 1 || authored.inertia.kind !== 'primitive-com' ||
      body.shape.kind !== 'box' || !equal(body.shape.halfExtentsM, [0.1, 0.2, 0.3]) ||
      !equal(body.orientation, [0, 0, 0, 1]) || !equal(body.angularVelocityRadps, [1, 1, 1]) ||
      !equal(body.positionM, [0, 0, 0]) || !equal(body.velocityMps, [0, 0, 0]) ||
      !equal(model.gravityMps2, [0, 0, 0]) || collider.ccd || collider.sensor) {
    error('INVALID_CONFIG', 'dynamic noncubic box is outside the supported isolated-rotor inputs');
  }
  return true;
}

/** Normal command schema/target/duplicate checks run before this finite physical policy. */
export function admitRotationCommands(actions: Map<string, AdmittedCommands>, bodyId: string): void {
  if (actions.size === 0) return;
  const action = actions.get(bodyId), keys = action ? Object.keys(action) : [];
  if (actions.size !== 1 || !action || !action.angularImpulseNms ||
      !equal(action.angularImpulseNms, [1 / 1024, -1 / 2048, 1 / 4096]) ||
      !((keys.length === 1 && keys[0] === 'angularImpulseNms') ||
        (keys.length === 2 && keys.includes('angularImpulseNms') && keys.includes('torqueNm') &&
          action.torqueNm && equal(action.torqueNm, [1 / 128, -1 / 256, 1 / 512])))) {
    error('INVALID_COMMAND', 'isolated rotor supports only empty, exact J or exact J with torque');
  }
}

/** Validate both prepared angular outputs before either candidate field is assigned. */
export function validateRotationResult(result: FreeRotationResult, dt: number): void {
  if (result.angularVelocityRadps.some(value => !Number.isFinite(value) || Math.abs(value) > 1000) ||
      !Number.isFinite(dt) || dt <= 0 || Math.hypot(...result.angularVelocityRadps) * dt > 10) {
    error('NUMERIC_LIMIT', 'free rotation exceeded angular movement limit');
  }
  if (result.orientation.some(value => !Number.isFinite(value)) ||
      Math.abs(Math.hypot(...result.orientation) - 1) > 1e-12) {
    error('NUMERIC_LIMIT', 'free rotation orientation exceeded tolerance');
  }
}
