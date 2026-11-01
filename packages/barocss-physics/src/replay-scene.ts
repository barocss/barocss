import { canonicalEncode } from './identity.js';
import { createPhysicsWorld } from './index.js';
import type { PhysicsModel, WorldOptions } from './types.js';
import type { PhysicsSceneV1 } from './replay-types.js';
import { equivalentReplayIdentity, copyReplayJson, exactFields, replayError } from './replay-json.js';

const REVISION = /^[A-Za-z][A-Za-z0-9._:-]{0,63}$/;
const MAX_SCENE_LENGTH = 128 * 1024;

export function admitPhysicsScene(value: unknown): PhysicsSceneV1 {
  const scene = copyReplayJson(value, 'scene');
  exactFields(scene, ['format', 'version', 'revision', 'sourceRevision', 'model', 'options', 'identity'], 'scene');
  if (scene.format !== 'barocss-physics-scene' || scene.version !== 1 ||
    typeof scene.revision !== 'string' || !REVISION.test(scene.revision) ||
    (scene.sourceRevision !== null && (typeof scene.sourceRevision !== 'string' ||
      !REVISION.test(scene.sourceRevision)))) {
    replayError('INVALID_SNAPSHOT', 'unsupported scene version or revision');
  }
  if (canonicalEncode(scene).length > MAX_SCENE_LENGTH) replayError('INVALID_SNAPSHOT', 'scene exceeds size limit');
  const admitted = scene as unknown as PhysicsSceneV1;
  const world = createPhysicsWorld(admitted.model, admitted.options);
  try {
    if (!equivalentReplayIdentity(world.getState().identity, admitted.identity)) {
      replayError('STALE_SNAPSHOT', 'scene identity differs from the current model, options or provider');
    }
  } finally { world.dispose(); }
  return admitted;
}

export function createPhysicsScene(model: PhysicsModel, options: WorldOptions,
  revisions: { revision: string; sourceRevision: string | null }): PhysicsSceneV1 {
  const meta = copyReplayJson(revisions, 'revisions');
  exactFields(meta, ['revision', 'sourceRevision'], 'revisions');
  const world = createPhysicsWorld(model, options);
  try {
    return admitPhysicsScene({ format: 'barocss-physics-scene', version: 1,
      revision: meta.revision, sourceRevision: meta.sourceRevision,
      model: world.getModel(), options, identity: world.getState().identity });
  } finally { world.dispose(); }
}
