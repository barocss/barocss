import type { Body } from './types.js';

export function filterAllowsPair(a: Body, b: Body): boolean {
  const left = a.collisionFilter;
  const right = b.collisionFilter;
  if (!left || !right) return true;
  return (left.maskBits & right.categoryBits) !== 0 &&
    (right.maskBits & left.categoryBits) !== 0;
}

export function dormantPair(a: Body, b: Body): boolean {
  const dynamics = [a, b].filter((body) => body.kind === 'dynamic');
  return dynamics.length > 0 && dynamics.every((body) => body.sleeping === true) &&
    [a, b].every((body) => body.kind !== 'kinematic' ||
      Math.hypot(...body.velocityMps) === 0);
}

export function wakeOnContact(a: Body, b: Body, sleepFrames: number[],
  aIndex: number, bIndex: number): void {
  if (dormantPair(a, b)) return;
  if (a.kind === 'dynamic' && a.sleeping &&
    (b.kind === 'dynamic' && !b.sleeping || b.kind === 'kinematic' && Math.hypot(...b.velocityMps) > 0)) {
    a.sleeping = false;
    sleepFrames[aIndex] = 0;
  }
  if (b.kind === 'dynamic' && b.sleeping &&
    (a.kind === 'dynamic' && !a.sleeping || a.kind === 'kinematic' && Math.hypot(...a.velocityMps) > 0)) {
    b.sleeping = false;
    sleepFrames[bIndex] = 0;
  }
}
