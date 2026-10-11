import {validateRenderNativeSceneDocument} from '@barocss/render-editor';
import type {RenderMaterialDocument, RenderNativeSceneDocument, RenderNativeSceneSurfaceTarget} from '@barocss/render-editor';
import type {MeshCamera, MeshLighting} from '@barocss/gpu';

export const NATIVE_PREVIEW_CONTEXT = Object.freeze({mmToSceneUnit: .001,
  background: Object.freeze([.025, .04, .06] as const)});

function target(documentId: string, documentRevision: number, second = false): RenderNativeSceneSurfaceTarget {
  return {documentId, documentRevision, bodyId: second ? 'body_preview_b' : 'body_preview_a',
    assetId: second ? 'preview_b' : 'preview-a', assetRevision: second ? 7 : 2,
    modelId: 'cloth_reference_981', geometryId: 'reference_panel'};
}

/** Declare the original reference source as one genuine CAD document; no preview buffers enter the file. */
export function createNativeSceneBase(source: string, material: RenderMaterialDocument,
  camera: MeshCamera, lighting: MeshLighting,
  identity: {documentId: string; title: string} = {documentId: 'native-material-study', title: 'Native material study'}): RenderNativeSceneDocument {
  return validateRenderNativeSceneDocument({
    format: 'barocss-render-editor-native-scene', version: 0, profile: 'canonical-native-opaque-scene-v0',
    documentId: identity.documentId, title: identity.title, revision: 0,
    nativeDocument: {schema: 'barocss-cad-document', version: 1, profile: 'direct-geometry',
      documentId: 'preview_document', revision: 0, units: {length: 'mm', angle: 'rad'},
      nativeFrame: 'authored-xyz-no-axis-conversion',
      assets: [{id: 'preview-a', revision: 2, role: 'authored-native-source', sourceVersion: 0,
        sourceFrame: 'authored-xyz-no-axis-conversion', source}],
      bodies: [{id: 'body_preview_a', name: 'Surface A', kind: 'direct-geometry-object',
        assetId: 'preview-a', geometryId: 'reference_panel'}],
      features: [], parameters: [], constraints: [], placements: [], derivedCaches: []},
    nativeOptions: {native: {sourceVersion: 0, countU: 3, countV: 3, unitsPerMillimeter: 1},
      basis: 'authored-xyz-matches-rhyup', bodyIds: ['body_preview_a']},
    display: {...NATIVE_PREVIEW_CONTEXT, camera, lighting, visibleBodyIds: ['body_preview_a'],
      poses: [], basis: 'part-xyz-matches-rhyup'},
    surfaceMaterials: [{target: target('preview_document', 0), material}],
  });
}

/** The second asset is an explicit authored declaration, with its own original revision and body pins. */
export function createNativeSceneSeed(base: RenderNativeSceneDocument): RenderNativeSceneDocument {
  const original = validateRenderNativeSceneDocument(base), native = original.nativeDocument;
  const first = native.assets.find(asset => asset.id === 'preview-a');
  const material = original.surfaceMaterials.find(item => item.target.bodyId === 'body_preview_a');
  if (!first || !material) throw new Error('The reference scene requires Surface A and its original source.');
  const nativeRevision = native.revision + 1;
  const second: RenderMaterialDocument = {format: 'barocss-render-editor-material', version: 0,
    profile: 'mesh-opaque-fragment-v0', documentId: 'native-blend-b', title: 'Surface B blend', revision: 0,
    shaderSource: '// Original Surface B blend.\n@shader #native_blend_b {\n  @uniform amount: float(0, 1, .25);\n  @fragment { color: mix(#ff0000, #0000ff, amount); }\n}\n',
    uniforms: {amount: .75}};
  return validateRenderNativeSceneDocument({...original,
    nativeDocument: {...native, revision: nativeRevision,
      assets: [first, {id: 'preview_b', revision: 7, role: 'authored-native-source', sourceVersion: 0,
        sourceFrame: 'authored-xyz-no-axis-conversion', source: first.source}],
      bodies: [{id: 'body_preview_a', name: 'Surface A', kind: 'direct-geometry-object', assetId: 'preview-a', geometryId: 'reference_panel'},
        {id: 'body_preview_b', name: 'Surface B', kind: 'direct-geometry-object', assetId: 'preview_b', geometryId: 'reference_panel'}]},
    nativeOptions: {...original.nativeOptions, bodyIds: ['body_preview_a', 'body_preview_b']},
    display: {...original.display, camera: {eye: [0, 2.6, 4], target: [0, -.55, 0], up: [0, 1, 0],
      fovYDegrees: 50, near: .01, far: 100}, visibleBodyIds: ['body_preview_a', 'body_preview_b'],
      poses: [{bodyId: 'body_preview_a', translationMM: [-900, -0, 0], rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1]},
        {bodyId: 'body_preview_b', translationMM: [900, -0, 0], rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1]}]},
    surfaceMaterials: [{target: target(native.documentId, nativeRevision), material: material.material},
      {target: target(native.documentId, nativeRevision, true), material: second}],
  });
}
