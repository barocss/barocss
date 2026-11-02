import { createPhysicsWorld, type PhysicsModel, type WorldOptions } from "/Users/user/Documents/ChatGPT/barocss-physics-motion-2276/packages/barocss-physics/dist/index.js";
import { createPhysicsRecorder, restorePhysicsRecording } from "/Users/user/Documents/ChatGPT/barocss-physics-motion-2276/packages/barocss-physics/dist/replay.js";
declare const model: PhysicsModel;
declare const options: WorldOptions;
const world = createPhysicsWorld(model, options);
const recorder = createPhysicsRecorder(world);
const state = recorder.step([]);
restorePhysicsRecording(recorder.saveRecording(), {model, options, providerDigest:state.identity.providerDigest});
// @ts-expect-error The World owns its fixed interval.
world.step(1 / 120);
// @ts-expect-error Retired independent domain factory has no compatibility export.
import { createClothWorld } from "/Users/user/Documents/ChatGPT/barocss-physics-motion-2276/packages/barocss-physics/dist/index.js";
