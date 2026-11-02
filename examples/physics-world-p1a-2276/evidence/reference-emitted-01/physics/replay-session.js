import { createPhysicsWorld } from './index.js';
import { admitPhysicsScene } from './replay-scene.js';
import { canonicalJson, copyReplayJson, exactFields, replayError } from './replay-json.js';
import { equivalentReplayValue } from './replay-compare.js';
const MAX_FRAMES = 512;
const MAX_COMMANDS = 4096;
const MAX_SNAPSHOT_LENGTH = 1024 * 1024;
class RecordedPhysicsSession {
    scene;
    world;
    frames = [];
    commandCount = 0;
    constructor(input) {
        this.scene = admitPhysicsScene(input);
        this.world = createPhysicsWorld(this.scene.world);
    }
    getScene() {
        this.world.getState();
        return copyReplayJson(this.scene, 'scene');
    }
    getState() { return this.world.getState(); }
    step(commands = []) {
        this.world.getState();
        if (this.frames.length >= MAX_FRAMES)
            replayError('WORLD_LIMIT', 'replay frame limit reached');
        const admitted = copyReplayJson(commands, 'commands');
        if (Array.isArray(admitted) && this.commandCount + admitted.length > MAX_COMMANDS) {
            replayError('WORLD_LIMIT', 'replay command limit reached');
        }
        const nextFrames = [...this.frames, { commands: admitted }];
        const nextCommandCount = this.commandCount + admitted.length;
        const state = this.world.step(this.scene.world.fixedStepSeconds, admitted);
        this.frames = nextFrames;
        this.commandCount = nextCommandCount;
        return state;
    }
    saveSnapshot() {
        const snapshot = { format: 'barocss-physics-snapshot', version: 1,
            scene: this.getScene(), frames: copyReplayJson(this.frames, 'frames'),
            finalState: this.world.getState() };
        if (JSON.stringify(snapshot).length > MAX_SNAPSHOT_LENGTH) {
            replayError('INVALID_SNAPSHOT', 'snapshot exceeds size limit');
        }
        return snapshot;
    }
    dispose() { this.world.dispose(); }
}
export function createPhysicsReplaySession(scene) {
    return new RecordedPhysicsSession(scene);
}
export function restorePhysicsReplaySession(snapshotInput, expectedSceneInput) {
    const expectedScene = admitPhysicsScene(expectedSceneInput);
    const snapshot = copyReplayJson(snapshotInput, 'snapshot');
    exactFields(snapshot, ['format', 'version', 'scene', 'frames', 'finalState'], 'snapshot');
    if (snapshot.format !== 'barocss-physics-snapshot' || snapshot.version !== 1 ||
        JSON.stringify(snapshot).length > MAX_SNAPSHOT_LENGTH || !Array.isArray(snapshot.frames) ||
        snapshot.frames.length > MAX_FRAMES) {
        replayError('INVALID_SNAPSHOT', 'unsupported or oversized snapshot');
    }
    let savedScene;
    try {
        savedScene = admitPhysicsScene(snapshot.scene);
    }
    catch {
        replayError('INVALID_SNAPSHOT', 'snapshot scene is invalid');
    }
    if (canonicalJson(savedScene) !== canonicalJson(expectedScene)) {
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
    if (commandsTotal > MAX_COMMANDS)
        replayError('INVALID_SNAPSHOT', 'snapshot command limit exceeded');
    if (snapshot.finalState === null || typeof snapshot.finalState !== 'object' ||
        Array.isArray(snapshot.finalState) ||
        snapshot.finalState.stepIndex !== snapshot.frames.length ||
        snapshot.finalState.timeSeconds !== snapshot.frames.length * expectedScene.world.fixedStepSeconds) {
        replayError('INVALID_SNAPSHOT', 'snapshot step index or time differs from its command log');
    }
    const candidate = new RecordedPhysicsSession(expectedScene);
    try {
        for (const frame of snapshot.frames)
            candidate.step(frame.commands);
        if (!equivalentReplayValue(candidate.getState(), snapshot.finalState)) {
            replayError('INVALID_SNAPSHOT', 'snapshot final state differs from replay');
        }
        return candidate;
    }
    catch {
        candidate.dispose();
        replayError('INVALID_SNAPSHOT', 'snapshot command log or final state is invalid');
    }
}
