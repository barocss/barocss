import { createPhysicsWorld, PhysicsError } from './index.js';
import type { PhysicsState, PhysicsCommand, PhysicsWorld } from './types.js';
import type { PhysicsReplaySession, PhysicsSceneV1, PhysicsSnapshotV1 } from './replay-types.js';
import { admitPhysicsScene } from './replay-scene.js';
import { equivalentReplayIdentity, copyReplayJson, exactFields, replayError, encodeSnapshotData, decodeSnapshotData } from './replay-json.js';
import { equivalentReplayValue } from './replay-compare.js';

const MAX_FRAMES = 512;
const MAX_COMMANDS = 4096;

class RecordedPhysicsSession implements PhysicsReplaySession {
  private readonly scene: PhysicsSceneV1;
  private readonly world: PhysicsWorld;
  private frames: Array<{ commands: readonly PhysicsCommand[] }> = [];
  private commandCount = 0;

  constructor(input: PhysicsSceneV1) {
    this.scene = admitPhysicsScene(input);
    this.world = createPhysicsWorld(this.scene.model, this.scene.options);
  }

  getScene(): PhysicsSceneV1 {
    this.world.getState();
    return copyReplayJson(this.scene, 'scene');
  }

  getState(): PhysicsState { return this.world.getState(); }

  step(commands: readonly PhysicsCommand[] = []): PhysicsState {
    this.world.getState();
    if (this.frames.length >= MAX_FRAMES) replayError('WORLD_LIMIT', 'replay frame limit reached');
    const admitted = copyReplayJson(commands, 'commands');
    if (Array.isArray(admitted) && this.commandCount + admitted.length > MAX_COMMANDS) {
      replayError('WORLD_LIMIT', 'replay command limit reached');
    }
    if (!Array.isArray(admitted)) replayError('INVALID_COMMAND', 'replay commands must be an array');
    const nextFrames = [...this.frames, { commands: admitted }];
    const nextCommandCount = this.commandCount + admitted.length;
    const state = this.world.step(admitted);
    this.frames = nextFrames;
    this.commandCount = nextCommandCount;
    return state;
  }

  saveSnapshot(): PhysicsSnapshotV1 {
    const snapshot: PhysicsSnapshotV1 = { format: 'barocss-physics-snapshot', version: 1,
      scene: this.getScene(), frames: copyReplayJson(this.frames, 'frames'),
      finalState: this.world.getState() };
    encodeSnapshotData(snapshot);
    return snapshot;
  }

  dispose(): void { this.world.dispose(); }
}

export function createPhysicsReplaySession(scene: PhysicsSceneV1): PhysicsReplaySession {
  return new RecordedPhysicsSession(scene);
}

export function restorePhysicsReplaySession(snapshotInput: PhysicsSnapshotV1,
  expectedSceneInput: PhysicsSceneV1): PhysicsReplaySession {
  const expectedScene = admitPhysicsScene(expectedSceneInput);
  const snapshot = copyReplayJson(snapshotInput, 'snapshot');
  exactFields(snapshot, ['format', 'version', 'scene', 'frames', 'finalState'], 'snapshot');
  encodeSnapshotData(snapshot);
  if (snapshot.format !== 'barocss-physics-snapshot' || snapshot.version !== 1 ||
    !Array.isArray(snapshot.frames) ||
    snapshot.frames.length > MAX_FRAMES) {
    replayError('INVALID_SNAPSHOT', 'unsupported or oversized snapshot');
  }
  let savedScene: PhysicsSceneV1;
  try { savedScene = admitPhysicsScene(snapshot.scene); }
  catch (error) {
    if (error instanceof PhysicsError && error.code === 'STALE_SNAPSHOT') throw error;
    replayError('INVALID_SNAPSHOT', 'snapshot scene is invalid');
  }
  if (!equivalentReplayIdentity(savedScene, expectedScene)) {
    replayError('STALE_SNAPSHOT', 'scene or source revision changed');
  }
  let commandsTotal = 0;
  for (const frame of snapshot.frames) {
    exactFields(frame, ['commands'], 'snapshot frame');
    if (!Array.isArray(frame.commands) || frame.commands.length > 64) {
      replayError('INVALID_SNAPSHOT', 'snapshot frame commands are invalid');
    }
    commandsTotal += frame.commands.length;
  }
  if (commandsTotal > MAX_COMMANDS) replayError('INVALID_SNAPSHOT', 'snapshot command limit exceeded');
  if (snapshot.finalState === null || typeof snapshot.finalState !== 'object' ||
    Array.isArray(snapshot.finalState) ||
    snapshot.finalState.stepIndex !== snapshot.frames.length ||
    snapshot.finalState.timeSeconds !== snapshot.frames.length * expectedScene.options.fixedStepSeconds) {
    replayError('INVALID_SNAPSHOT', 'snapshot step index or time differs from its command log');
  }
  const candidate = new RecordedPhysicsSession(expectedScene);
  try {
    for (const frame of snapshot.frames) candidate.step(frame.commands as PhysicsCommand[]);
    if (!equivalentReplayValue(candidate.getState(), snapshot.finalState)) {
      replayError('INVALID_SNAPSHOT', 'snapshot final state differs from replay');
    }
    return candidate;
  } catch {
    candidate.dispose();
    replayError('INVALID_SNAPSHOT', 'snapshot command log or final state is invalid');
  }
}

export function serializePhysicsSnapshot(snapshot: PhysicsSnapshotV1): Uint8Array {
  const session = restorePhysicsReplaySession(snapshot, snapshot.scene);
  try { return encodeSnapshotData(snapshot); }
  finally { session.dispose(); }
}

export function deserializePhysicsSnapshot(bytes: Uint8Array): PhysicsSnapshotV1 {
  const snapshot = decodeSnapshotData(bytes);
  exactFields(snapshot, ['format', 'version', 'scene', 'frames', 'finalState'], 'snapshot');
  const scene = admitPhysicsScene(snapshot.scene);
  const session = restorePhysicsReplaySession(snapshot as unknown as PhysicsSnapshotV1, scene);
  try { return copyReplayJson(snapshot, 'snapshot') as unknown as PhysicsSnapshotV1; }
  finally { session.dispose(); }
}
