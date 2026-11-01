import type { PhysicsWorld, PhysicsRecorder, Recording, RestoredRecording, Digest, PhysicsModel, WorldOptions } from './types.js';
export type { Recording, RecordedState, PhysicsRecorder, RestoredRecording, CreatePhysicsRecorder, RestorePhysicsRecording, SerializePhysicsRecording, DeserializePhysicsRecording } from './types.js';
export declare function createPhysicsRecorder(world: PhysicsWorld): PhysicsRecorder;
export declare function restorePhysicsRecording(recording: Recording, expected: {
    readonly model: PhysicsModel;
    readonly options: WorldOptions;
    readonly providerDigest: Digest;
}): RestoredRecording;
export declare function serializePhysicsRecording(recording: Recording): Uint8Array;
export declare function deserializePhysicsRecording(bytes: Uint8Array): Recording;
