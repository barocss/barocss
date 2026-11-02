import { createPhysicsWorld } from '@barocss/physics';
import { PARAMETERS, buildConfig } from './fixture.mjs';

export function createScene(name) {
  const fixture = buildConfig(name);
  const world = createPhysicsWorld(structuredClone(fixture.config.model), structuredClone(fixture.config.options));
  return {
    getState() { return world.getState(); },
    step() {
      const commands = [];
      if (name !== 'REST') {
        const actor = world.getState().bodies.find(body => body.id === PARAMETERS.actorId);
        commands.push({ kind: 'impulse', bodyId: PARAMETERS.actorId,
          impulseNs: [PARAMETERS.massKg * (PARAMETERS.requestedVelocityXMps - actor.velocityMps[0]), 0, 0] });
      }
      world.step(commands);
      return world.getState();
    },
    queries() {
      const actor = world.getState().bodies.find(body => body.id === PARAMETERS.actorId);
      const [x, y, z, w] = actor.orientationXYZW;
      const axis = [2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w)];
      const minusEnd = actor.positionM.map((value, i) => value - fixture.geometry.actor.halfLengthM * axis[i]);
      const plusEnd = actor.positionM.map((value, i) => value + fixture.geometry.actor.halfLengthM * axis[i]);
      const lowerEnd = minusEnd[1] <= plusEnd[1] ? minusEnd : plusEnd;
      const footSphere = { centerM: [lowerEnd[0], lowerEnd[1] - (fixture.geometry.actor.radiusM + PARAMETERS.footProbeBelowCapsuleM),
        lowerEnd[2]], radiusM: PARAMETERS.footProbeRadiusM };
      const selfRayRequest = { originM: [...actor.positionM], direction: [...PARAMETERS.selfRayDirection],
        maxDistanceM: PARAMETERS.selfRayMaxDistanceM, includeSensors: false };
      const selfRay = world.query({ kind: 'raycast', ...selfRayRequest });
      const footareaOverlap = world.query({ kind: 'overlap-sphere', ...footSphere, includeSensors: false });
      return structuredClone({ selfRay, selfRayRequest, footareaOverlap, footSphere,
        capsuleLowestEndpointM: lowerEnd, filteredFootIds: footareaOverlap.colliderIds.filter(id => id !== fixture.config.model.colliders.find(collider => collider.bodyId === PARAMETERS.actorId).id),
        hostFilter: { excludedColliderId: fixture.config.model.colliders.find(collider => collider.bodyId === PARAMETERS.actorId).id, kind: 'known-ID-only' },
        scope: 'Actual public query IDs and distance; no query normal, body exclusion or sweep added' });
    },
    dispose() { world.dispose(); },
  };
}
