import { createPhysicsWorld } from './index.js';
import { copyReplayJson, exactFields, replayError } from './replay-json.js';
const REVISION = /^[A-Za-z][A-Za-z0-9._:-]{0,63}$/;
const MAX_SCENE_LENGTH = 128 * 1024;
export function admitPhysicsScene(value) {
    const scene = copyReplayJson(value, 'scene');
    exactFields(scene, ['format', 'version', 'revision', 'sourceRevision', 'world'], 'scene');
    if (scene.format !== 'barocss-physics-scene' || scene.version !== 1 ||
        typeof scene.revision !== 'string' || !REVISION.test(scene.revision) ||
        (scene.sourceRevision !== null && (typeof scene.sourceRevision !== 'string' ||
            !REVISION.test(scene.sourceRevision)))) {
        replayError('INVALID_SNAPSHOT', 'unsupported scene version or revision');
    }
    if (JSON.stringify(scene).length > MAX_SCENE_LENGTH)
        replayError('INVALID_SNAPSHOT', 'scene exceeds size limit');
    const admitted = scene;
    const world = createPhysicsWorld(admitted.world);
    world.dispose();
    return admitted;
}
export function createPhysicsScene(world, revisions) {
    const meta = copyReplayJson(revisions, 'revisions');
    exactFields(meta, ['revision', 'sourceRevision'], 'revisions');
    return admitPhysicsScene({ format: 'barocss-physics-scene', version: 1,
        revision: meta.revision, sourceRevision: meta.sourceRevision, world });
}
