import type { AdmittedCommands } from './validation.js';
import type { Body, PhysicsContact } from './types.js';

const REST_STEPS = 60;
const LINEAR_REST_MPS = 0.02;
const ANGULAR_REST_RADPS = 0.02;

function nonzero(value?: readonly number[]): boolean {
  return value?.some((component) => component !== 0) ?? false;
}

export function wakeForActions(bodies: Body[], previousContacts: PhysicsContact[],
  actions: Map<string, AdmittedCommands>, sleepFrames: number[]): void {
  const indexById = new Map(bodies.map((body, index) => [body.id, index]));
  const neighbors = bodies.map(() => [] as number[]);
  for (const contact of previousContacts) {
    const a = indexById.get(contact.aId)!;
    const b = indexById.get(contact.bId)!;
    if (bodies[a].kind === 'dynamic' && bodies[b].kind === 'dynamic') {
      neighbors[a].push(b);
      neighbors[b].push(a);
    }
  }
  const queue: number[] = [];
  for (let index = 0; index < bodies.length; index++) {
    const body = bodies[index];
    const action = actions.get(body.id);
    if (body.kind === 'dynamic' && (nonzero(action?.forceN) || nonzero(action?.impulseNs) ||
      nonzero(action?.torqueNm) || nonzero(action?.angularImpulseNms))) queue.push(index);
    if (body.kind === 'kinematic' && action?.positionM &&
      action.positionM.some((value, axis) => value !== body.positionM[axis])) {
      for (const contact of previousContacts) {
        const otherId = contact.aId === body.id ? contact.bId :
          contact.bId === body.id ? contact.aId : null;
        const other = otherId ? indexById.get(otherId) : undefined;
        if (other !== undefined && bodies[other].kind === 'dynamic') queue.push(other);
      }
    }
  }
  const seen = new Set<number>();
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor];
    if (seen.has(index)) continue;
    seen.add(index);
    bodies[index].sleeping = false;
    sleepFrames[index] = 0;
    for (const other of neighbors[index]) if (!seen.has(other)) queue.push(other);
  }
}

export function updateSleeping(bodies: Body[], contacts: PhysicsContact[],
  sleepFrames: number[]): void {
  const indexById = new Map(bodies.map((body, index) => [body.id, index]));
  const neighbors = bodies.map(() => [] as number[]);
  const supported = bodies.map(() => false);
  const movingFixture = bodies.map(() => false);
  for (const contact of contacts) {
    const a = indexById.get(contact.aId)!;
    const b = indexById.get(contact.bId)!;
    const left = bodies[a], right = bodies[b];
    if (left.kind === 'dynamic' && right.kind === 'dynamic') {
      neighbors[a].push(b);
      neighbors[b].push(a);
    } else if (left.kind === 'dynamic' || right.kind === 'dynamic') {
      const dynamic = left.kind === 'dynamic' ? a : b;
      const fixture = left.kind === 'dynamic' ? right : left;
      supported[dynamic] = true;
      movingFixture[dynamic] ||= fixture.kind === 'kinematic' &&
        Math.hypot(...fixture.velocityMps) > 0;
    }
  }
  const visited = new Set<number>();
  for (let index = 0; index < bodies.length; index++) {
    if (bodies[index].kind !== 'dynamic' || visited.has(index)) continue;
    const island = [index];
    visited.add(index);
    for (let cursor = 0; cursor < island.length; cursor++) {
      for (const other of neighbors[island[cursor]]) if (!visited.has(other)) {
        visited.add(other);
        island.push(other);
      }
    }
    const asleep = island.filter((member) => bodies[member].sleeping).length;
    if (!island.some((member) => supported[member]) ||
      island.some((member) => movingFixture[member]) || asleep > 0 && asleep < island.length) {
      for (const member of island) {
        bodies[member].sleeping = false;
        sleepFrames[member] = 0;
      }
      continue;
    }
    if (asleep === island.length) continue;
    const atRest = island.every((member) =>
      Math.hypot(...bodies[member].velocityMps) <= LINEAR_REST_MPS &&
      Math.hypot(...bodies[member].angularVelocityRadps) <= ANGULAR_REST_RADPS);
    for (const member of island) sleepFrames[member] = atRest ? sleepFrames[member] + 1 : 0;
    if (island.every((member) => sleepFrames[member] >= REST_STEPS)) {
      for (const member of island) {
        bodies[member].sleeping = true;
        bodies[member].velocityMps = [0, 0, 0];
        bodies[member].angularVelocityRadps = [0, 0, 0];
      }
    }
  }
}
