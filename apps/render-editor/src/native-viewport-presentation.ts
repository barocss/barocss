import {prepareViewerNativeSceneAppearance} from '@barocss/viewer';
import type {ViewerNativeSceneAppearanceInputV1} from '@barocss/viewer';
import {validateMeshCamera} from '@barocss/gpu';
import type {MeshCamera} from '@barocss/gpu';
import {normalizeRenderEditorError} from '@barocss/render-editor';
import type {RenderNativeSceneAppearancePreparation} from '@barocss/render-editor';

/** Keep original SDK authorship intact; qualify a separate owned display request through public Viewer. */
export function prepareNativeViewportAppearance(prepared: RenderNativeSceneAppearancePreparation,
  cameraOverride?: MeshCamera): ViewerNativeSceneAppearanceInputV1 {
  try {
    const camera = validateMeshCamera(cameraOverride === undefined ? prepared.request.display.camera : cameraOverride);
    const request: ViewerNativeSceneAppearanceInputV1 = {...prepared.request,
      display: {...prepared.request.display, camera}};
    prepareViewerNativeSceneAppearance(request, prepared.context);
    // The returned data is an owned request, never a copied execution frame or a presentation certificate.
    return structuredClone(request);
  } catch (cause) {
    const error = normalizeRenderEditorError(cause, 'PRESENTATION_REFUSED');
    if (error !== cause) Object.defineProperty(error, 'cause', {value: cause, configurable: true});
    throw error;
  }
}
