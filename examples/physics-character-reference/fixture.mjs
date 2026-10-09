import { createHash } from 'node:crypto';

function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort()
    .map(key => [key, canonical(value[key])]));
  return value;
}
const sha256 = text => createHash('sha256').update(text).digest('hex');

export const PARAMETERS = freeze({ names: ['REST', 'FLAT', 'STEP10', 'SLOPE15'], dt: 1 / 120, steps: 240,
  gravityMps2: [0, -9.81, 0], actorId: 'actor', massKg: 1, radiusM: 0.15, halfLengthM: 0.35,
  identityQuaternion: [0, 0, 0, 1], initialVelocityMps: [0, 0, 0], initialAngularVelocityRadps: [0, 0, 0],
  restitution: 0, friction: { static: 0, dynamic: 0 }, requestedVelocityXMps: 1,
  approximateInertiaDiagonalKgM2: [0.1, 0.1, 0.1], floorHalfExtentsM: [3, 0.05, 1],
  flatCentreYM: 0.505, walkingStartXM: -1, slopeStartXM: -0.75,
  slopeDegrees: 15, walkableMaxSlopeDegrees: 10,
  stepHalfExtentsM: [0.25, 0.05, 0.75], stepCentreM: [0.5, 0.05, 0],
  selfRayDirection: [0, -1, 0], selfRayMaxDistanceM: 2, footProbeRadiusM: 0.01, footProbeBelowCapsuleM: 0.005,
  basis: 'right-handed-xyz-y-up-metres',
  scope: 'Raw capsule dynamics and X impulse servo; no upright lock, step-up, slope policy, sweep or capsule CCD' });

export function buildConfig(name) {
  if (!PARAMETERS.names.includes(name)) throw new RangeError('Frozen cases are REST, FLAT, STEP10 and SLOPE15');
  const angle = PARAMETERS.slopeDegrees * Math.PI / 180;
  const normal = name === 'SLOPE15' ? [-Math.sin(angle), Math.cos(angle), 0] : [0, 1, 0];
  const floorId = name === 'SLOPE15' ? 'slope15' : 'floor';
  const floorOrientation = name === 'SLOPE15' ? [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)]
    : [...PARAMETERS.identityQuaternion];
  const floorPosition = name === 'SLOPE15' ? [0.05 * Math.sin(angle), -0.05 * Math.cos(angle), 0] : [0, -0.05, 0];
  const actorPosition = name === 'REST' ? [0, PARAMETERS.flatCentreYM, 0]
    : name === 'SLOPE15' ? [PARAMETERS.slopeStartXM,
      Math.tan(angle) * PARAMETERS.slopeStartXM + PARAMETERS.halfLengthM
        + (PARAMETERS.radiusM + 0.005) / Math.cos(angle), 0]
      : [PARAMETERS.walkingStartXM, PARAMETERS.flatCentreYM, 0];
  const fixtures = [{ id: floorId, halfExtentsM: [...PARAMETERS.floorHalfExtentsM],
    positionM: floorPosition, orientation: floorOrientation }];
  if (name === 'STEP10') fixtures.push({ id: 'step10', halfExtentsM: [...PARAMETERS.stepHalfExtentsM],
    positionM: [...PARAMETERS.stepCentreM], orientation: [...PARAMETERS.identityQuaternion] });
  const actor = { id: PARAMETERS.actorId, kind: 'dynamic',
    shape: { kind: 'capsule', radiusM: PARAMETERS.radiusM, halfLengthM: PARAMETERS.halfLengthM },
    positionM: actorPosition, velocityMps: [...PARAMETERS.initialVelocityMps], massKg: PARAMETERS.massKg,
    orientation: [...PARAMETERS.identityQuaternion], angularVelocityRadps: [...PARAMETERS.initialAngularVelocityRadps],
    restitution: PARAMETERS.restitution, friction: { ...PARAMETERS.friction } };
  const config = { fixedStepSeconds: PARAMETERS.dt, gravityMps2: [...PARAMETERS.gravityMps2], broadPhase: 'aabb',
    bodies: [actor, ...fixtures.map(fixture => ({ id: fixture.id, kind: 'static',
      shape: { kind: 'box', halfExtentsM: [...fixture.halfExtentsM] }, positionM: [...fixture.positionM],
      orientation: [...fixture.orientation], restitution: PARAMETERS.restitution, friction: { ...PARAMETERS.friction } }))] };
  const geometry = { floorPlane: { normal: [...normal], point: [0, 0, 0] },
    actor: { radiusM: PARAMETERS.radiusM, halfLengthM: PARAMETERS.halfLengthM },
    fixtures: structuredClone(fixtures), walkableMaxSlopeDegrees: PARAMETERS.walkableMaxSlopeDegrees };
  const configJson = JSON.stringify(canonical(config)), geometryJson = JSON.stringify(canonical(geometry));
  return { name, config, geometry, configJson, configSha256: sha256(configJson),
    geometryJson, geometrySha256: sha256(geometryJson) };
}
