import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPhysicsWorld, PhysicsError } from '@barocss/physics';
import { admitCadSurfaceProxy, cadProxyPose } from '@barocss/physics/cad-proxy';
import { createPhysicsScene, createPhysicsReplaySession, restorePhysicsReplaySession } from '@barocss/physics/replay';
import { createFluidWorld } from '@barocss/physics/fluid';

const source = readFileSync(new URL('./two-surfaces.barocad', import.meta.url), 'utf8');
const modelId = 'native_loader_demo', sourceRevision = 'releaseRev1';
const moving = admitCadSurfaceProxy(source, { sourceVersion: 0, sourceRevision, modelId,
  surfaceId: 'rational_panel', kind: 'dynamic', proxy: 'sphere', massKg: 1,
  initialOffsetM: [0, 0.28, 0] });
const fixed = admitCadSurfaceProxy(source, { sourceVersion: 0, sourceRevision, modelId,
  surfaceId: 'flat_panel', kind: 'static', proxy: 'box', minimumHalfExtentM: 0.01 });
const dt = 1 / 120;
const config = { fixedStepSeconds: dt, gravityMps2: [0, -9.81, 0],
  bodies: [moving.body, fixed.body] };
const world = createPhysicsWorld(config);
const firstState = world.getState();
const firstPose = cadProxyPose(moving, firstState.bodies.find((body) => body.id === moving.bodyId),
  source, sourceRevision);
assert.deepEqual(firstPose.translation, [0, 280, 0]);
let contactStep = null;
for (let step = 1; step <= 120; step++) {
  if (world.step(dt).contacts.length) { contactStep = step; break; }
}
assert.equal(contactStep, 21);
world.dispose();

const scene = createPhysicsScene(config, { revision: 'releaseScene1', sourceRevision });
const session = createPhysicsReplaySession(scene);
for (let step = 0; step < 24; step++) session.step();
const snapshot = JSON.parse(JSON.stringify(session.saveSnapshot()));
const restored = restorePhysicsReplaySession(snapshot, scene);
assert.deepEqual(restored.getState(), session.getState());
assert.deepEqual(restored.step(), session.step());
assert.throws(() => restorePhysicsReplaySession(snapshot,
  createPhysicsScene(config, { revision: 'releaseScene1', sourceRevision: 'changed' })),
  (error) => error instanceof PhysicsError && error.code === 'STALE_SNAPSHOT');
session.dispose(); restored.dispose();

const initialPositionsM = [];
for (let z = 0; z < 4; z++) {
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      initialPositionsM.push([0.2 + x * 0.05, 0.45 + y * 0.05, 0.3 + z * 0.05]);
    }
  }
}
const fluid = createFluidWorld({ format: 'barocss-fluid-scene', version: 1,
  revision: 'packedWaterRev1', basis: 'right-handed-xyz-metres', fixedStepSeconds: dt,
  gravityMps2: [0, -9.81, 0], basinM: [0.7, 1.3, 0.5], initialPositionsM });
assert.equal(fluid.step(dt).stepIndex, 1);
assert.equal(fluid.reset().stepIndex, 0);
fluid.dispose();

const physicsManifest = JSON.parse(readFileSync(new URL('./node_modules/@barocss/physics/package.json', import.meta.url)));
const cadManifest = JSON.parse(readFileSync(new URL('./node_modules/@barocss/cad/package.json', import.meta.url)));
assert.equal(physicsManifest.version, '0.0.0-experimental');
assert.equal(cadManifest.version, '0.0.0-experimental');
assert.deepEqual(Object.keys(physicsManifest.exports).sort(), ['.', './cad-proxy', './fluid', './replay']);
for (const name of ['index.d.ts', 'cad-proxy.d.ts', 'fluid.d.ts', 'replay.d.ts']) {
  assert.ok(readFileSync(new URL(`./node_modules/@barocss/physics/dist/${name}`, import.meta.url), 'utf8').length > 0);
}

console.log(JSON.stringify({ result: 'ok', imports: ['@barocss/physics', '@barocss/physics/cad-proxy',
  '@barocss/physics/replay', '@barocss/physics/fluid'], contactStep, replayedSteps: 24,
  fluidSteps: 1, declarations: 4,
  physicsVersion: physicsManifest.version, cadVersion: cadManifest.version }));
