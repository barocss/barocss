import test from 'node:test';
import assert from 'node:assert/strict';
// #region physics-import
import { createPhysicsWorld, PhysicsError } from '@barocss/physics';
import { admitCadSurfaceProxy, cadProxyPose } from '@barocss/physics/cad-proxy';
// #endregion physics-import

// #region replay-import
import { createPhysicsRecorder, restorePhysicsRecording,
  serializePhysicsRecording, deserializePhysicsRecording } from '@barocss/physics/replay';
// #endregion replay-import

// #region pendulum-reference-import
// Independent reduced ODE reference, outside the public Physics package.
import { createPlanarPendulum } from '../../../examples/physics-planar-pendulum-reference/pendulum.ts';
// #endregion pendulum-reference-import

const near = (actual, expected, tolerance = 1e-12) =>
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${actual} vs ${expected}; tolerance ${tolerance}`);
const vectorNear = (actual, expected, tolerance) => {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, i) => near(value, expected[i], tolerance));
};
const hasCode = code => error => error instanceof PhysicsError && error.code === code;

// #region world-fixture
const dt = 1 / 120;
const worldOptions = { profile: 'rigid-discrete-v1', fixedStepSeconds: dt, broadPhase: 'direct' };
const freeBody = () => ({
  id: 'part:ball', kind: 'dynamic', massKg: 2,
  inertia: { kind: 'primitive-com', about: 'com', frame: 'body-local' },
  initial: { positionM: [0, 2, 0], orientationXYZW: [0, 0, 0, 1],
    velocityMps: [1, 0, 0], angularVelocityRadps: [0, 0, 0] },
});
const freeModel = (gravityMps2 = [0, -9.81, 0]) => ({
  format: 'barocss-physics-model', version: 1, revision: 'docsFlight1',
  frame: { id: 'world', basis: 'right-handed-xyz', rotation: 'local-to-world-xyzw' },
  units: { length: 'm', mass: 'kg', time: 's', angle: 'rad' }, gravityMps2,
  bodies: [freeBody()], colliders: [{ id: 'collider:ball', bodyId: 'part:ball',
    geometry: { kind: 'sphere', radiusM: 0.1 },
    local: { positionM: [0, 0, 0], orientationXYZW: [0, 0, 0, 1] },
    material: { restitution: 0, friction: { static: 0, dynamic: 0 } },
    sensor: false, ccd: false, filter: { categoryBits: 1, maskBits: 65535 } }],
  joints: [], cloths: [], fluids: [], sourceBindings: [],
});
// #endregion world-fixture

test('free flight matches the discrete fixed-step analytic solution', () => {
  // #region free-flight
  const world = createPhysicsWorld(freeModel(), worldOptions);
  try {
    const n = 12;
    for (let i = 0; i < n; i++) world.step();
    const state = world.getState();
    // Semi-implicit Euler: v_n = v_0 + n*g*dt;
    // p_n = p_0 + n*v_0*dt + g*dt²*n*(n+1)/2.
    vectorNear(state.bodies[0].velocityMps, [1, -9.81 * n * dt, 0]);
    vectorNear(state.bodies[0].positionM,
      [n * dt, 2 - 9.81 * dt ** 2 * n * (n + 1) / 2, 0]);
    near(state.timeSeconds, n * dt);
    assert.equal(state.contacts.length, 0);
  } finally { world.dispose(); }
  // #endregion free-flight
});

test('force lasts one step; impulse changes velocity once', () => {
  // #region force-and-impulse
  const world = createPhysicsWorld(freeModel([0, 0, 0]), worldOptions);
  try {
    const first = world.step([
      { kind: 'impulse', bodyId: 'part:ball', impulseNs: [2, 0, 0] },
      { kind: 'force', bodyId: 'part:ball', forceN: [0, 24, 0] },
    ]);
    // Mass is 2 kg: J/m = 1 m/s; F*dt/m = 0.1 m/s.
    vectorNear(first.bodies[0].velocityMps, [2, 0.1, 0]);
    vectorNear(first.bodies[0].positionM, [2 * dt, 2 + 0.1 * dt, 0]);
    const second = world.step();
    vectorNear(second.bodies[0].velocityMps, [2, 0.1, 0]);
    vectorNear(second.bodies[0].positionM, [4 * dt, 2 + 0.2 * dt, 0]);
  } finally { world.dispose(); }
  // #endregion force-and-impulse
});

test('invalid command argument retains accepted state; copies and disposal are explicit', () => {
  // #region refusal-and-lifecycle
  const world = createPhysicsWorld(freeModel([0, 0, 0]), worldOptions);
  const accepted = world.step();
  assert.throws(() => world.step(dt / 2), hasCode('INVALID_COMMAND'));
  assert.deepEqual(world.getState(), accepted);
  accepted.bodies[0].positionM[0] = 999;
  accepted.bodies[0].orientationXYZW[3] = 0;
  const copied = world.getState();
  const modelCopy = world.getModel();
  modelCopy.bodies[0].initial.positionM[1] = 999;
  near(world.getModel().bodies[0].initial.positionM[1], 2);
  const hit = world.query({ kind: 'overlap-sphere', centerM: copied.bodies[0].positionM,
    radiusM: 0.01, includeSensors: false });
  assert.deepEqual(hit, { kind: 'overlap-sphere', colliderIds: ['collider:ball'] });
  assert.throws(() => world.query({ kind: 'overlap-sphere', centerM: [NaN, 0, 0],
    radiusM: 0.01, includeSensors: false }), hasCode('INVALID_QUERY'));
  assert.deepEqual(world.getState(), copied);
  near(copied.bodies[0].positionM[0], dt);
  assert.deepEqual(copied.bodies[0].orientationXYZW, [0, 0, 0, 1]);
  world.dispose();
  world.dispose(); // Idempotent.
  assert.throws(() => world.getState(), hasCode('DISPOSED'));
  assert.throws(() => world.step(), hasCode('DISPOSED'));
  // #endregion refusal-and-lifecycle
});

// #region proxy-source
const source = `@model units_fixture {
  version: 0;
  length-unit: mm;
  @surface #asymmetric_panel {
    type: nurbs;
    degree-u: 1;
    degree-v: 1;
    knots-u: [0,0,1,1];
    knots-v: [0,0,1,1];
    control-points: [[[20,-30,40],[20,-30,100]],[[120,10,40],[120,10,100]]];
    weights: [[1,1],[1,1]];
  }
}`;
// #endregion proxy-source

test('off-origin CAD proxy uses literal quarter-turn coordinates', () => {
  // #region off-origin-pose
  const proxy = admitCadSurfaceProxy(source, {
    sourceVersion: 0, sourceRevision: 'unitsRev1', modelId: 'units_fixture',
    surfaceId: 'asymmetric_panel', kind: 'dynamic', proxy: 'box',
    massKg: 1, initialOffsetM: [0.1, 0, 0],
  });
  vectorNear(proxy.sourceCenterMM, [70, -10, 70], 1e-6);
  assert.equal(proxy.collider.bodyId, proxy.body.id);
  assert.deepEqual(proxy.binding.entityIds, [proxy.body.id, proxy.collider.id]);
  assert.equal(proxy.binding.sourceRevision, 'unitsRev1');
  assert.match(proxy.binding.sourceDigest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(proxy.collider.geometry.kind, 'box');
  vectorNear(proxy.collider.geometry.halfExtentsM, [0.05, 0.02, 0.03], 1e-9);
  vectorNear(proxy.body.initial.positionM, [0.17, -0.01, 0.07], 1e-9);
  const body = { id: proxy.bodyId, positionM: [...proxy.body.initial.positionM],
    orientationXYZW: [0, 0, Math.SQRT1_2, Math.SQRT1_2] };
  const pose = cadProxyPose(proxy, body, source, 'unitsRev1');
  vectorNear(pose.translation, [160, -80, 0], 1e-6);
  // Independent +90° Z matrix: (x,y,z) -> (-y,x,z).
  const original = [[20, -30, 40], [20, -30, 100], [120, 10, 40], [120, 10, 100]];
  const expected = [[190, -60, 40], [190, -60, 100], [150, 40, 40], [150, 40, 100]];
  original.forEach(([x, y, z], i) => {
    const displayed = [-y + pose.translation[0], x + pose.translation[1], z + pose.translation[2]];
    vectorNear(displayed, expected[i], 1e-6);
    vectorNear([displayed[1] + 80, 160 - displayed[0], displayed[2]], original[i], 1e-6);
  });
  // #endregion off-origin-pose
  const retained = structuredClone(proxy);
  for (const [text, revision] of [[source + '\n', 'unitsRev1'], [source, 'unitsRev2']]) {
    assert.throws(() => cadProxyPose(proxy, body, text, revision), hasCode('STALE_SOURCE'));
    assert.deepEqual(proxy, retained);
  }
  assert.deepEqual(cadProxyPose(proxy, body, source, 'unitsRev1'), pose);
});

test('independent reduced pendulum reference preserves equilibrium and lifecycle', () => {
  // #region reduced-pendulum
  // Imported from examples/physics-planar-pendulum-reference/pendulum.ts, not the package root.
  const pendulum = createPlanarPendulum({
    massKg: 1, comDistanceM: 0.5, inertia: { about: 'com', kgM2: 0.02 },
    gravityMps2: 9.81, initialAngleRad: 0, initialAngularVelocityRadps: 0,
    fixedStepSeconds: dt, maxSteps: 2,
  });
  const state = pendulum.step(dt);
  near(state.angleRad, 0);
  near(state.energyJ, 0);
  vectorNear(state.comPositionM, [0, -0.5, 0]);
  assert.throws(() => pendulum.step(dt / 2), hasCode('INVALID_STEP'));
  assert.deepEqual(pendulum.getState(), state);
  pendulum.dispose();
  assert.throws(() => pendulum.getState(), hasCode('DISPOSED'));
  // #endregion reduced-pendulum
});


test('free flight converges against the continuous ballistic solution at fixed physical time', t => {
  // Freeze these gates before execution: velocity1e-12m/s, position errors <=.0041m
  // at1/120s and1/240s, refinement ratio in[1.99,2.01]. No contact is present.
  const time = 0.1;
  const errors = [1 / 120, 1 / 240].map(step => {
    const world = createPhysicsWorld(freeModel(), { ...worldOptions, fixedStepSeconds: step });
    try {
      for (let i = 0; i < Math.round(time / step); i++) world.step();
      const body = world.getState().bodies[0];
      vectorNear(body.velocityMps, [1, -9.81 * time, 0], 1e-12);
      const continuousY = 2 - 0.5 * 9.81 * time ** 2;
      const errorM = Math.abs(body.positionM[1] - continuousY);
      assert.ok(errorM > 0 && errorM <= 0.0041);
      return errorM;
    } finally { world.dispose(); }
  });
  const ratio = errors[0] / errors[1];
  assert.ok(ratio >= 1.99 && ratio <= 2.01);
  t.diagnostic(JSON.stringify({ ballisticTimeSeconds: time, positionErrorsM: errors, refinementRatio: ratio }));
});

test('copied rigid recordings use the signed-zero-preserving binary codec', () => {
  // #region replay-wire
  const model = freeModel([-0, 0, 0]);
  const world = createPhysicsWorld(model, worldOptions);
  const session = createPhysicsRecorder(world);
  const expected = { model, options: worldOptions, providerDigest: world.getState().identity.providerDigest };
  let restored;
  try {
    session.step([{ kind: 'impulse', bodyId: 'part:ball', impulseNs: [2, 0, 0] }]);
    const recording = session.saveRecording();
    const bytes = serializePhysicsRecording(recording);
    assert.equal(Buffer.from(bytes.subarray(0, 8)).toString('ascii'), 'BCPHREC1');
    const decoded = deserializePhysicsRecording(bytes);
    assert.ok(Object.is(decoded.model.gravityMps2[0], -0));
    restored = restorePhysicsRecording(decoded, expected);
    assert.deepEqual(restored.recorder.getState(), session.getState());
    assert.deepEqual(restored.recorder.step(), session.step());
    recording.frames[0].commands[0].impulseNs[0] = 999;
    near(session.saveRecording().frames[0].commands[0].impulseNs[0], 2);
    assert.throws(() => deserializePhysicsRecording(bytes.subarray(0, -1)), hasCode('INVALID_SNAPSHOT'));
  } finally { restored?.recorder.dispose(); restored?.world.dispose(); session.dispose(); world.dispose(); }
  // #endregion replay-wire
});
