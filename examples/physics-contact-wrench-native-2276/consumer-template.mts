import {createPhysicsWorld, type PhysicsModel, type WorldOptions} from '__NATIVE_ENTRY__';
import {createPhysicsRecorder, restorePhysicsRecording} from '__NATIVE_ENTRY__';
declare const model: PhysicsModel;
declare const options: WorldOptions;
const world = createPhysicsWorld(model, options);
const recorder = createPhysicsRecorder(world);
const state = recorder.getState();
const schema: 2 = state.schemaVersion;
const point = state.contacts[0].points[0];
const anchor = point.anchorM;
const impulse = state.pairWrenches[0].onB.linearImpulseNs;
const moment = state.pairWrenches[0].onB.angularImpulseAboutWorldOriginNms;
const recording = recorder.saveRecording();
const version: 2 = recording.version;
restorePhysicsRecording(recording, {model, options, providerDigest: state.identity.providerDigest});
// @ts-expect-error Geometry contacts have no legacy aggregate normal impulse.
state.contacts[0].normalImpulseNs;
// @ts-expect-error Geometry contacts have no legacy aggregate tangent impulse.
state.contacts[0].tangentImpulseOnBNs;
// @ts-expect-error The World owns the fixed interval.
world.step(1 / 120);
void [schema, anchor, impulse, moment, version];
