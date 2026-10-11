// Authored data only. No parent module or numerical law runs at import time.
export const providerProvenance = Object.freeze({
  issue: 1349,
  adoption: '527a4407207e32a801365f1b59c071469948aa19',
  native: '0e296d1e75c837e767329634f6a2ac6f5832e54f',
  measuredSource: '49cd64c24059d51b562854427ce3b4c24562507a',
  genuineSource: 'examples/physics-rigid-coupled-hinge-reference/reference-controls.mjs:orbitalLossCandidateControl.input',
  genuineRawArtifact: 'examples/physics-rigid-hinge-velocity-reference/evidence/native-49cd64c2/source-before.f64le',
  genuineRawSha256: '4ba656b4b99e8989dd16ca6d4d7789899f3fd9c86b82f691c2759d1a750f9b10',
  originalMultiHingeNative: '0de27c51574e2da6b09966c7ef0c28435d9c9592',
});

function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export function restInput() {
  return {
    config: {
      fixedStepSeconds: 1 / 120, gravityMps2: [0, 0, 0],
      bodies: [
        {id: 'pairA0', kind: 'dynamic', shape: {kind: 'sphere', radiusM: .1},
          positionM: [-.1, 0, 0], velocityMps: [0, 0, 0], massKg: 1,
          restitution: 0, friction: {static: 1, dynamic: .7}},
        {id: 'pairB0', kind: 'dynamic', shape: {kind: 'sphere', radiusM: .1},
          positionM: [.1, 0, 0], velocityMps: [0, 0, 0], massKg: 1,
          restitution: 0, friction: {static: 1, dynamic: .7}},
      ],
      joints: [{id: 'hinge0', kind: 'hinge', aId: 'pairA0', bId: 'pairB0',
        anchorALocalM: [.1, 0, 0], anchorBLocalM: [-.1, 0, 0], axisWorld: [0, 0, 1],
        limitRad: [-.8, .8], motor: {targetSpeedRadps: .5, maxImpulseNms: .0001, maxReactionNms: .01}}],
    },
    carrier: {
      stepIndex: 0, timeSeconds: 0,
      bodies: [
        {id: 'pairA0', kind: 'dynamic', shape: {kind: 'sphere', radiusM: .1},
          positionM: [-.1, 0, 0], velocityMps: [0, 0, 0],
          orientation: [0, 0, 0, 1], angularVelocityRadps: [0, 0, 0]},
        {id: 'pairB0', kind: 'dynamic', shape: {kind: 'sphere', radiusM: .1},
          positionM: [.1, 0, 0], velocityMps: [0, 0, 0],
          orientation: [0, 0, 0, 1], angularVelocityRadps: [0, 0, 0]},
      ],
      joints: [{id: 'hinge0', kind: 'hinge', aId: 'pairA0', bId: 'pairB0', angleRad: 0,
        linearImpulseNs: [0, 0, 0], angularImpulseNms: [0, 0, 0], motorImpulseNms: 0}],
      contacts: [], events: [], ccdHits: [],
      pairStats: {eligiblePairs: 0, candidatePairs: 0, aabbTests: 0},
    },
    dt: 1 / 120, commands: [],
  };
}

function endpoint(lower = false, excess = false) {
  const input = restInput();
  const radius = excess ? .09210609920557934 : .09210609940028851;
  const sine = excess ? .19866933324522766 : .19866933079506122;
  const cosine = excess ? .9800665773445683 : .9800665778412416;
  input.carrier.bodies[0].positionM = [-radius, 0, 0];
  input.carrier.bodies[1].positionM = [radius, 0, 0];
  input.carrier.bodies[0].orientation = [0, 0, lower ? sine : -sine, cosine];
  input.carrier.bodies[1].orientation = [0, 0, lower ? -sine : sine, cosine];
  input.carrier.joints[0].angleRad = lower ? -.8 : .8;
  return input;
}

function spin(lower, a, b) {
  const input = endpoint(lower, true);
  input.carrier.bodies[0].angularVelocityRadps = [0, 0, a];
  input.carrier.bodies[1].angularVelocityRadps = [0, 0, b];
  return input;
}

function impulse(bodyId, z) {
  const input = restInput();
  input.commands = [{kind: 'angularImpulse', bodyId, angularImpulseNms: [0, 0, z]}];
  return input;
}

function genuine() {
  const input = endpoint();
  input.carrier.bodies[0].positionM = [-.1, 0, 0];
  input.carrier.bodies[1].positionM = [.1, 0, 0];
  input.carrier.bodies[0].velocityMps = [0, -1, 0];
  input.carrier.bodies[1].velocityMps = [0, 1, 0];
  return input;
}

function signedZero() {
  const input = restInput();
  input.carrier.bodies[0].velocityMps[1] = -0;
  input.carrier.bodies[1].angularVelocityRadps[0] = -0;
  return input;
}

function torqueAndImpulse() {
  const input = restInput();
  input.commands = [
    {kind: 'torque', bodyId: 'pairB0', torqueNm: [0, 0, .001]},
    {kind: 'angularImpulse', bodyId: 'pairB0', angularImpulseNms: [0, 0, .001]},
  ];
  return input;
}

function translated() {
  const input = restInput();
  for (const bodies of [input.config.bodies, input.carrier.bodies]) {
    bodies[0].id = 'pairA1'; bodies[1].id = 'pairB1';
    bodies[0].positionM = [-.1, 0, 1]; bodies[1].positionM = [.1, 0, 1];
  }
  for (const joint of [input.config.joints[0], input.carrier.joints[0]]) {
    joint.id = 'hinge1'; joint.aId = 'pairA1'; joint.bId = 'pairB1';
  }
  return input;
}

const row = (name, input, expectedDisposition = 'RETURN') => ({name, input, expectedDisposition});
export const literalCases = freeze([
  row('genuine-orbital', genuine(), 'CAP_REFUSAL'),
  row('rest', restInput()),
  row('rest-signed-zero', signedZero()),
  row('remembered-upper-endpoint', endpoint()),
  row('remembered-lower-endpoint', endpoint(true)),
  row('upper-outward', spin(false, -1, 1)),
  row('upper-inward', spin(false, 1, -1)),
  row('lower-outward', spin(true, 1, -1)),
  row('lower-inward', spin(true, -1, 1)),
  row('angular-impulse-A', impulse('pairA0', .001)),
  row('angular-impulse-B', impulse('pairB0', .001)),
  row('torque-plus-angular-impulse-B', torqueAndImpulse()),
  row('translated-Z1', translated()),
  row('angular-overload-B', impulse('pairB0', .1), 'CAP_REFUSAL'),
]);

export function fixture(name) {
  const found = literalCases.find(row => row.name === name);
  if (!found) throw new Error('unknown frozen hinge fixture');
  return structuredClone(found.input);
}
