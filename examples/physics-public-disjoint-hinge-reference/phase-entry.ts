import { projectDisjointPostContact } from '../../packages/barocss-physics/src/disjoint-hinge/postcontact.js';
import type { ParsedPair } from '../../packages/barocss-physics/src/disjoint-hinge/types.js';
import type { PhysicsBodyState, PhysicsState, PhysicsWorldConfig, Vec3 } from '../../packages/barocss-physics/src/types.js';
import { parseBody, copyBody } from '../../packages/barocss-physics/src/validation.js';
import { parseJoints } from '../../packages/barocss-physics/src/joints.js';

interface PhaseRequest {
  config: PhysicsWorldConfig;
  sourceState: PhysicsState;
  postContactBodies: PhysicsBodyState[];
}

/** Qualification seam only; its fixed bank authentication is performed by the harness. */
export function runSavedPhase(request: PhaseRequest, motorImpulsesNms: [number, number]) {
  const rest = request.config.bodies.map(body => parseBody(body));
  const bodies = rest.map((body, i) => ({ ...copyBody(body),
    positionM: [...request.postContactBodies[i].positionM] as Vec3,
    velocityMps: [...request.postContactBodies[i].velocityMps] as Vec3,
    orientation: [...request.postContactBodies[i].orientation] as [number, number, number, number],
    angularVelocityRadps: [...request.postContactBodies[i].angularVelocityRadps] as Vec3 }));
  const pairs: ParsedPair[] = [];
  for (let jointInputIndex = 0; jointInputIndex < request.config.joints!.length; jointInputIndex++) {
    const config = request.config.joints![jointInputIndex];
    const aIndex = rest.findIndex(body => body.id === config.aId);
    const bIndex = rest.findIndex(body => body.id === config.bId);
    if (aIndex < 0 || bIndex < 0) throw new Error('authenticated directed endpoint is missing');
    const joint = parseJoints([config], [rest[aIndex], rest[bIndex]])[0];
    const originM = rest[aIndex].positionM.map((value, axis) =>
      (value + rest[bIndex].positionM[axis]) * .5) as [number, number, number];
    const role = originM[2];
    if ((role !== 0 && role !== 1) || pairs[role]) throw new Error('authenticated rest component is invalid');
    pairs[role] = { joint, originM: Object.freeze(originM),
      bodyIndices: Object.freeze([aIndex, bIndex] as [number, number]), jointInputIndex };
  }
  if (pairs.length !== 2 || !pairs[0] || !pairs[1]) throw new Error('authenticated components are incomplete');
  return projectDisjointPostContact({ bodies, pairs: pairs as [ParsedPair, ParsedPair],
    motorImpulsesNms, sourceStepIndex: request.sourceState.stepIndex,
    sourceTimeSeconds: request.sourceState.timeSeconds });
}
