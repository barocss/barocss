import {prepareViewerNativeSceneAppearance} from '@barocss/viewer';
import type {ViewerNativeSceneAppearanceInputV1, ViewerNativeSceneAppearanceContext, PreparedViewerNativeSceneAppearance} from '@barocss/viewer';
import {prepareRenderNativeSceneDocument} from './native-scene-document.js';
import type {RenderNativeScenePreparation} from './native-scene-document.js';
import {createRenderNativeSceneAppearanceRequest} from './native-scene-appearance-request.js';
import {normalizeRenderEditorError} from './errors.js';

export interface RenderNativeSceneAppearancePreparation {
  readonly authored: RenderNativeScenePreparation;
  /** Owned immutable request data; not a mounted-backend or accepted generation certificate. */
  readonly request: ViewerNativeSceneAppearanceInputV1;
  readonly context: ViewerNativeSceneAppearanceContext;
  /** Actual derived CPU frame and independently mutable execution views; not file authority. */
  readonly viewer: PreparedViewerNativeSceneAppearance;
  readonly stage: 'cpu-frame-prepared';
  readonly rendererAdmission: 'not-presented';
}

/** Rebuild original authored data and re-admit its complete native appearance through real Viewer/GPU preflight. */
export function prepareRenderNativeSceneAppearance(input: unknown): RenderNativeSceneAppearancePreparation {
  try {
    const authored = prepareRenderNativeSceneDocument(input);
    const {request, context} = createRenderNativeSceneAppearanceRequest(authored);
    const viewer = prepareViewerNativeSceneAppearance(request, context);
    return Object.freeze({authored, request, context, viewer, stage: 'cpu-frame-prepared', rendererAdmission: 'not-presented'});
  } catch (cause) {
    const error = normalizeRenderEditorError(cause, 'PRESENTATION_REFUSED');
    if (error !== cause) Object.defineProperty(error, 'cause', {value: cause, configurable: true});
    throw error;
  }
}
