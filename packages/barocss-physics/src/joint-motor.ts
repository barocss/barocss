import type { Body, Joint } from './types.js';
import { add, dot, inverseInertia, scale } from './math.js';

export function driveHingeMotor(joint: Joint, body: Body, angleRad: number): number {
  const motor = joint.motor!;
  const axis = joint.axisWorld!;
  const [low, high] = joint.limitRad!;
  if ((angleRad <= low && motor.targetSpeedRadps < 0) ||
    (angleRad >= high && motor.targetSpeedRadps > 0)) return 0;
  const inverseAxisInertia = dot(axis, inverseInertia(body, axis));
  const speed = dot(body.angularVelocityRadps, axis);
  const needed = (motor.targetSpeedRadps - speed) / inverseAxisInertia;
  const impulse = Math.max(-motor.maxImpulseNms, Math.min(motor.maxImpulseNms, needed));
  body.angularVelocityRadps = add(body.angularVelocityRadps,
    inverseInertia(body, scale(axis, impulse)));
  return impulse;
}
