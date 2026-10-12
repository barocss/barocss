import type {ViewerNativeDirectionalLightInput, ViewerNativePointLightInput} from '@barocss/viewer';
import {createRenderNativeSceneAppearanceRequest} from './native-scene-appearance-request.js';
import {prepareLightDocument} from './native-light-document.js';
import type {RenderNativeLightDocument} from './native-light-document.js';

/** Real original source/TEN composition, with catalog profile as the only light discriminator. */
export function createRenderNativeLightRequest(input: RenderNativeLightDocument): ViewerNativeDirectionalLightInput | ViewerNativePointLightInput {
  const {preparation, legacy} = prepareLightDocument(input);
  const {request, context} = createRenderNativeSceneAppearanceRequest(legacy);
  const common = {owner: Object.freeze({id: preparation.document.documentId, revision: preparation.document.revision}),
    source: request.source, display: request.display, materials: request.appearance.materials, context};
  const lights = preparation.document.lights;
  return lights.profile === 'native-world-point-linear-v0'
    ? Object.freeze({format: 'barocss-viewer-native-point-light-input', version: 0, ...common, lights})
    : Object.freeze({format: 'barocss-viewer-native-directional-light-input', version: 0, ...common, lights});
}
