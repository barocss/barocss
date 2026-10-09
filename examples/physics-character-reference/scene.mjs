import { createPhysicsWorld } from '@barocss/physics';
import { PARAMETERS, buildConfig } from './fixture.mjs';

export function createScene(name) {
  const fixture = buildConfig(name);
  const world = createPhysicsWorld(structuredClone(fixture.config));
  return {
    getState() { return world.getState(); },
    step(dt = PARAMETERS.dt) {
      const commands = [];
      if (name !== 'REST') {
        const actor = world.getState().bodies.find(body => body.id === PARAMETERS.actorId);
        commands.push({ kind: 'impulse', bodyId: PARAMETERS.actorId,
          impulseNs: [PARAMETERS.massKg * (PARAMETERS.requestedVelocityXMps - actor.velocityMps[0]), 0, 0] });
      }
      world.step(dt, commands);
      return world.getState();
    },
    queries() {
      const actor = world.getState().bodies.find(body => body.id === PARAMETERS.actorId);
      const [x, y, z, w] = actor.orientation;
      const axis = [2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w)];
      const minusEnd = actor.positionM.map((value, i) => value - actor.shape.halfLengthM * axis[i]);
      const plusEnd = actor.positionM.map((value, i) => value + actor.shape.halfLengthM * axis[i]);
      const lowerEnd = minusEnd[1] <= plusEnd[1] ? minusEnd : plusEnd;
      const footSphere = { centerM: [lowerEnd[0], lowerEnd[1] - (actor.shape.radiusM + PARAMETERS.footProbeBelowCapsuleM),
        lowerEnd[2]], radiusM: PARAMETERS.footProbeRadiusM };
      const selfRayRequest = { originM: [...actor.positionM], direction: [...PARAMETERS.selfRayDirection],
        maxDistanceM: PARAMETERS.selfRayMaxDistanceM, includeSensors: false };
      const selfRay = world.raycast(selfRayRequest);
      const footareaOverlap = world.overlapSphere({ ...footSphere, includeSensors: false });
      return structuredClone({ selfRay, selfRayRequest, footareaOverlap, footSphere,
        capsuleLowestEndpointM: lowerEnd, filteredFootIds: footareaOverlap.filter(id => id !== PARAMETERS.actorId),
        hostFilter: { excludedBodyId: PARAMETERS.actorId, kind: 'known-ID-only' },
        scope: 'Actual public query IDs and distance; no query normal, body exclusion or sweep added' });
    },
    dispose() { world.dispose(); },
  };
}
