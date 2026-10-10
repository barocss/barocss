import {compileMeshMaterial} from '@barocss/gpu';
import type {BaroCadDocumentPrimitiveEntryV2} from '@barocss/cad-interop/document';
import type {ViewerGeometryRef, ViewerNativeSceneAppearanceInputV1,
  ViewerNativeSceneAppearanceContext, ViewerSurfaceMaterial, ViewerPose} from '@barocss/viewer';
import type {RenderNativeScenePreparation} from './native-scene-document.js';
import {RenderEditorError, normalizeRenderEditorError} from './errors.js';

/** The request owns plain data only; derived Viewer execution buffers are never copied here. */
function ownFrozen<T>(input: T): T {
  const owned = structuredClone(input);
  const freeze = (value: unknown): void => {
    if (value === null || typeof value !== 'object') return;
    if (Object.getPrototypeOf(value) !== (Array.isArray(value) ? Array.prototype : Object.prototype)) {
      throw new RenderEditorError('DOCUMENT_INPUT', 'Native appearance request requires plain owned data.');
    }
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  };
  freeze(owned);
  return owned;
}

function geometryRef(entry: BaroCadDocumentPrimitiveEntryV2): ViewerGeometryRef {
  return entry.kind === 'surface'
    ? {kind: 'surface', modelId: entry.ref.modelId, surfaceId: entry.ref.geometryId}
    : {kind: 'curve', modelId: entry.ref.modelId, curveId: entry.ref.geometryId};
}

/** Map a freshly qualified authored preparation without changing its original native identities. */
export function createRenderNativeSceneAppearanceRequest(authored: RenderNativeScenePreparation): {
  request: ViewerNativeSceneAppearanceInputV1;
  context: ViewerNativeSceneAppearanceContext;
} {
  try {
    const {document, entries} = authored, {display} = document;
    const revisionToken = Object.is(document.revision, -0) ? '-0' : String(document.revision);
    const contextId = 'rns:' + document.documentId + ':' + revisionToken;
    const targetId = (bodyId: string): string => 'body:' + bodyId;
    const entryByBody = new Map(entries.map(entry => [entry.binding.bodyId, entry]));
    const materials: ViewerSurfaceMaterial[] = authored.materials.map(item => {
      const original = item.preparation.document;
      const compiled = compileMeshMaterial(original.shaderSource);
      if (!compiled.ok) {
        const error = new RenderEditorError('SOURCE_REFUSED', 'Correct the native Surface material shader source.',
          compiled.diagnostics.map(value => {
            const lines = original.shaderSource.slice(0, value.start).split(/\r\n|\r|\n/);
            return {code: value.code, severity: 'error' as const, message: value.message,
              range: {start: value.start, end: value.end, line: lines.length, column: lines[lines.length - 1].length + 1}};
          }));
        Object.defineProperty(error, 'cause', {value: compiled.diagnostics, configurable: true});
        throw error;
      }
      return {ref: {modelId: item.ref.modelId, surfaceId: item.ref.surfaceId},
        binding: {material: compiled.material, uniforms: Object.fromEntries(Object.entries(original.uniforms))}};
    });
    const request: ViewerNativeSceneAppearanceInputV1 = {
      version: 1,
      source: {
        kind: 'document', result: authored.native, options: document.nativeOptions,
        bindings: entries.map(({binding}) => ({
          documentId: binding.documentId, documentRevision: binding.documentRevision,
          nativeFrame: binding.nativeFrame, bodyId: binding.bodyId, assetId: binding.assetId,
          assetRevision: binding.assetRevision, sourceFrame: binding.sourceFrame,
          modelId: binding.modelId, geometryKind: binding.geometryKind, geometryId: binding.geometryId,
        })),
      },
      display: {
        motion: display.poses.length === 0 ? null : {
          basis: display.basis,
          frame: {contextId, timeSeconds: 0, poses: display.poses.map((pose): ViewerPose => ({
            targetId: targetId(pose.bodyId), translation: [...pose.translationMM],
            rotation: [...pose.rotationXYZW], scale: [...pose.scale],
          }))},
          bindings: entries.map(entry => ({contextId, targetId: targetId(entry.binding.bodyId), ref: geometryRef(entry)})),
        },
        visibleGeometry: display.visibleBodyIds.map(bodyId => {
          const entry = entryByBody.get(bodyId);
          if (!entry) throw new RenderEditorError('DOCUMENT_INPUT', 'Visible native body is not in the qualified selection.');
          return geometryRef(entry);
        }),
        camera: display.camera,
      },
      appearance: {lighting: display.lighting, materials},
    };
    return Object.freeze({request: ownFrozen(request), context: ownFrozen({
      mmToSceneUnit: display.mmToSceneUnit, background: [...display.background],
    } satisfies ViewerNativeSceneAppearanceContext)});
  } catch (cause) {
    const error = normalizeRenderEditorError(cause, 'PRESENTATION_REFUSED');
    if (error !== cause) Object.defineProperty(error, 'cause', {value: cause, configurable: true});
    throw error;
  }
}
