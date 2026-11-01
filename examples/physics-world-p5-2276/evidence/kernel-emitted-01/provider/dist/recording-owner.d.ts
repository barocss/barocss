import type { PhysicsCommand, PhysicsModel, PhysicsState, PhysicsWorld, Recording, WorldOptions } from './types.js';
/** Internal capability table. This sibling module is shared by bundled and unbundled entries. */
export interface RecordingOwner {
    recording: Recording | null;
    commandCount: number;
    prepareFrames(commands: readonly PhysicsCommand[], stepIndex: number): Recording['frames'];
    prepare(frames: Recording['frames'], state: PhysicsState): Recording;
}
export interface WorldRecordingAccess {
    attach(prepare: (inputs: {
        model: PhysicsModel;
        options: WorldOptions;
        state: PhysicsState;
    }) => RecordingOwner): RecordingOwner;
    detach(owner: RecordingOwner): void;
    read(owner: RecordingOwner): PhysicsState;
    step(owner: RecordingOwner, commands: readonly PhysicsCommand[]): PhysicsState;
}
export declare const recordingWorlds: WeakMap<PhysicsWorld, WorldRecordingAccess>;
