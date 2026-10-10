import { createPhysicsWorld, PhysicsError } from '@barocss/physics';
import { createClothWorld } from '@barocss/physics/cloth';
const dt = 1 / 120;
const world = createPhysicsWorld({ fixedStepSeconds: dt, gravityMps2: [0, -9.81, 0],
  bodies: [{ id: 'part:ball', kind: 'dynamic', shape: { kind: 'sphere', radiusM: 0.15 },
    positionM: [0, 2, 0], velocityMps: [0, 0, 0], massKg: 1, restitution: 0.25 }] });
try {
  const state = world.step(dt);
  let refused = '';
  try { world.step(1 / 60); }
  catch (error) { if (!(error instanceof PhysicsError)) throw error; refused = error.code; }
  if (state.stepIndex !== 1 || refused !== 'INVALID_STEP' || world.getState().stepIndex !== 1) throw new Error('Unexpected step result');
  console.log(JSON.stringify({ task: 'rigid-step', stepIndex: state.stepIndex,
    timeSeconds: state.timeSeconds, yM: state.bodies[0].positionM[1],
    velocityYMps: state.bodies[0].velocityMps[1], refused, retainedStep: world.getState().stepIndex }, null, 2));
} finally { world.dispose(); }
const cloth = createClothWorld({ format: 'barocss-cloth-scene', version: 1,
  revision: 'sheet-v1', basis: 'right-handed-xyz-metres', fixedStepSeconds: dt,
  profile: 'pinned-sheet-sphere-v1' });
try {
  const frame = cloth.step(dt);
  const reset = cloth.reset();
  console.log(JSON.stringify({ task: 'cloth-step', stepIndex: frame.stepIndex,
    vertexCount: frame.vertexCount, triangleCount: frame.triangleCount,
    positionValues: frame.positionsM.length, resetStep: reset.stepIndex }, null, 2));
} finally { cloth.dispose(); }
