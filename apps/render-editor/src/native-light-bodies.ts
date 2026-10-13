import {deriveRenderNativeSceneBodyDuplicate, deriveRenderNativeSceneBodyRemoval,
  prepareRenderNativeLightDocument, prepareRenderNativeSceneDocument} from '@barocss/render-editor';
import type {RenderNativeLightDocument, RenderNativeSceneDocument,
  RenderNativeSceneBodyDuplicateOptions} from '@barocss/render-editor';

const NEUTRAL_LIGHTING = {ambientStrength: 1, directionalStrength: 0, direction: [0, 0, 1] as [number, number, number]};

/** Light v2 owns the catalog; Native v0 owns only the original CAD/pose/material derivation. */
function bridge(input: RenderNativeLightDocument): {
  light: RenderNativeLightDocument; native: RenderNativeSceneDocument;
} {
  const light = prepareRenderNativeLightDocument(input).document;
  const native = prepareRenderNativeSceneDocument({
    ...light, version: 0, profile: 'canonical-native-opaque-scene-v0',
    display: {...light.display, lighting: NEUTRAL_LIGHTING},
  }).document;
  return {light, native};
}
function rejoin(original: RenderNativeLightDocument, native: RenderNativeSceneDocument): RenderNativeLightDocument {
  const {lighting: _lighting, ...display} = native.display;
  void _lighting;
  return prepareRenderNativeLightDocument({
    ...native, version: 2, profile: 'canonical-native-lights',
    display, lights: original.lights,
  }).document;
}

/** Pure candidate only. The owning session later decides Apply/history/presentation. */
export function deriveNativeLightBodyDuplicate(
  input: RenderNativeLightDocument, bodyId: string, options?: RenderNativeSceneBodyDuplicateOptions,
) {
  const {light, native} = bridge(input);
  const result = deriveRenderNativeSceneBodyDuplicate(native, bodyId, options);
  return {document: rejoin(light, result.document), bodyId: result.bodyId,
    assetId: result.assetId, materialDocumentId: result.materialDocumentId};
}

/** Pure candidate only. Refuses removing the last editable material-bound Surface. */
export function deriveNativeLightBodyRemoval(input: RenderNativeLightDocument, bodyId: string): RenderNativeLightDocument {
  const {light, native} = bridge(input);
  return rejoin(light, deriveRenderNativeSceneBodyRemoval(native, bodyId));
}
