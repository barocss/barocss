import {createCadDocument} from '@barocss/cad';
import {prepareBaroCadDocumentPrimitiveNativeRefsV2} from '@barocss/cad-interop/document';
import type {BaroCadDocumentPrimitiveEntryV2} from '@barocss/cad-interop/document';
import {prepareRenderNativeSceneDocument} from './native-scene-document.js';
import type {RenderNativeSceneDocument, RenderNativeSceneSurfaceTarget} from './native-scene-document.js';
import {prepareRenderNativeSceneAppearance} from './native-scene-appearance.js';
import {RenderEditorError, normalizeRenderEditorError} from './errors.js';

function check(value: unknown, message: string): asserts value {
  if (!value) throw new RenderEditorError('DOCUMENT_INPUT', message);
}
function materialTarget(entry: BaroCadDocumentPrimitiveEntryV2): RenderNativeSceneSurfaceTarget {
  check(entry.kind === 'surface', 'The surviving material must bind to an actual Surface.');
  const binding = entry.binding;
  return {documentId: binding.documentId, documentRevision: binding.documentRevision, bodyId: binding.bodyId,
    assetId: binding.assetId, assetRevision: binding.assetRevision, modelId: binding.modelId, geometryId: binding.geometryId};
}

/** Remove one original body and requalify complete surviving authorship; this does not present a frame. */
export function deriveRenderNativeSceneBodyRemoval(document: RenderNativeSceneDocument,
  bodyId: string): RenderNativeSceneDocument {
  try {
    const baseline = prepareRenderNativeSceneDocument(document), original = baseline.document;
    check(typeof bodyId === 'string', 'Choose an original visible Surface body to remove.');
    const body = original.nativeDocument.bodies.find(value => value.id === bodyId);
    const entry = baseline.entries.find(value => value.binding.bodyId === bodyId);
    const material = original.surfaceMaterials.find(value => value.target.bodyId === bodyId);
    check(body && entry?.kind === 'surface' && material && original.display.visibleBodyIds.includes(bodyId),
      'Remove an original selected visible Surface body with a material.');
    // Original preparation admits every material only on a distinct visible selected Surface.
    check(baseline.materials.length >= 2, 'Keep at least one editable Surface body in the scene.');
    const native = original.nativeDocument;
    check(native.revision < 2147483647, 'The native CAD document revision is at its maximum.');
    const bodies = native.bodies.filter(value => value.id !== bodyId);
    const referencedAssets = new Set(bodies.map(value => value.assetId));
    const rebuilt = createCadDocument({...native, revision: native.revision + 1, bodies,
      assets: native.assets.filter(value => referencedAssets.has(value.id))});
    const nativeOptions = {...original.nativeOptions,
      bodyIds: (original.nativeOptions.bodyIds ?? baseline.entries.map(value => value.binding.bodyId)).filter(id => id !== bodyId)};
    const entries = prepareBaroCadDocumentPrimitiveNativeRefsV2(rebuilt, nativeOptions);
    const surfaceMaterials = original.surfaceMaterials.filter(value => value.target.bodyId !== bodyId).map(value => {
      const found = entries.find(entry => entry.binding.bodyId === value.target.bodyId);
      check(found, 'The surviving material body has no qualified binding.');
      return {target: materialTarget(found), material: value.material};
    });
    return prepareRenderNativeSceneAppearance({...original, nativeDocument: rebuilt.document, nativeOptions,
      display: {...original.display, visibleBodyIds: original.display.visibleBodyIds.filter(id => id !== bodyId),
        poses: original.display.poses.filter(value => value.bodyId !== bodyId)}, surfaceMaterials}).authored.document;
  } catch (cause) {
    const error = normalizeRenderEditorError(cause);
    if (error !== cause) Object.defineProperty(error, 'cause', {value: cause, configurable: true});
    throw error;
  }
}
