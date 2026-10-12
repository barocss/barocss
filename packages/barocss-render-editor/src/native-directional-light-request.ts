import type {ViewerNativeDirectionalLightInput} from '@barocss/viewer';
import {createRenderNativeSceneAppearanceRequest} from './native-scene-appearance-request.js';
import {prepareDirectionalDocument} from './native-directional-light-document.js';
import type {RenderNativeDirectionalLightDocumentV1} from './native-directional-light-document.js';

/** Genuine authored source/TEN bridge. The Viewer owns actual current-frame and async renderer admission. */
export function createRenderNativeDirectionalLightRequest(input: RenderNativeDirectionalLightDocumentV1): ViewerNativeDirectionalLightInput {
  const {preparation, legacy} = prepareDirectionalDocument(input);
  const {request, context} = createRenderNativeSceneAppearanceRequest(legacy);
  return Object.freeze({format: 'barocss-viewer-native-directional-light-input', version: 0,
    owner: Object.freeze({id: preparation.document.documentId, revision: preparation.document.revision}),
    source: request.source, display: request.display, materials: request.appearance.materials,
    lights: preparation.document.lights, context});
}
