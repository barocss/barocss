import {prepareRenderNativeSceneAppearance} from './native-scene-appearance.js';
import type {RenderNativeSceneAppearancePreparation} from './native-scene-appearance.js';
import type {RenderNativeScenePreparedCandidate, RenderNativeSceneSession} from './native-scene-session.js';
import {RenderEditorError, normalizeRenderEditorError} from './errors.js';

const ASYNC_FUNCTION = Object.getPrototypeOf(async function () {});
const ASYNC_GENERATOR = Object.getPrototypeOf(async function* () {});

/** Preflight before CPU acceptance. An arbitrary host callback has no side-effect rollback guarantee. */
export function commitRenderNativeSceneAppearanceCandidate(session: RenderNativeSceneSession,
  candidate: RenderNativeScenePreparedCandidate,
  beforeCommit?: (prepared: RenderNativeSceneAppearancePreparation) => void): RenderNativeSceneAppearancePreparation {
  try {
    let prepared: RenderNativeSceneAppearancePreparation | undefined;
    session.commitPrepared(candidate, () => {
      // The existing session has admitted ownership, generation, single use, and history before this read.
      const actual = prepareRenderNativeSceneAppearance(candidate.preparation.document);
      if (beforeCommit !== undefined) {
        if (typeof beforeCommit !== 'function') throw new RenderEditorError('DOCUMENT_INPUT', 'Appearance callback must be a synchronous function.');
        const prototype = Object.getPrototypeOf(beforeCommit), source = Function.prototype.toString.call(beforeCommit);
        if (prototype === ASYNC_FUNCTION || prototype === ASYNC_GENERATOR || /^async(?:\s|\(|\/)/.test(source)) {
          throw new RenderEditorError('DOCUMENT_INPUT', 'Async appearance callbacks are not supported.');
        }
        const result: unknown = beforeCommit(actual);
        if (result !== null && (typeof result === 'object' || typeof result === 'function') && typeof Reflect.get(result, 'then') === 'function') {
          throw new RenderEditorError('DOCUMENT_INPUT', 'Appearance callback must not return a thenable.');
        }
      }
      prepared = actual;
    });
    if (prepared === undefined || session.getSnapshot().accepted !== candidate.preparation.document) {
      throw new RenderEditorError('STALE_CANDIDATE', 'The accepted native scene changed after appearance preparation.');
    }
    return prepared;
  } catch (cause) {
    const error = normalizeRenderEditorError(cause, 'PRESENTATION_REFUSED');
    if (error !== cause) Object.defineProperty(error, 'cause', {value: cause, configurable: true});
    throw error;
  }
}
