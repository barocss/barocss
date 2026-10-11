import {createCadDocument, createCadGeometryReference, editSourceSurfaceControlNetWide,
  validateSourceSurfaceControlNetWideEdit} from '@barocss/cad';
import {prepareBaroCadDocumentPrimitiveNativeRefsV2} from '@barocss/cad-interop/document';
import type {RenderNativeSceneDocument} from './native-scene-document.js';
import {prepareRenderNativeSceneAppearance} from './native-scene-appearance.js';
import {nativeSurfaceMaterialTarget} from './native-body-duplicate.js';
import {RenderEditorError, normalizeRenderEditorError} from './errors.js';

export interface RenderNativeSceneSurfacePolePatch {
  readonly uIndex: number;
  readonly vIndex: number;
  readonly xMM: number;
  readonly yMM: number;
  readonly zMM: number;
  readonly weight: number;
}
const FIELDS = ['uIndex', 'vIndex', 'xMM', 'yMM', 'zMM', 'weight'] as const;
function check(value: unknown, message: string): asserts value {
  if (!value) throw new RenderEditorError('DOCUMENT_INPUT', message);
}
function copyPatch(input: unknown): RenderNativeSceneSurfacePolePatch {
  check(input !== null && typeof input === 'object' && !Array.isArray(input)
    && [Object.prototype, null].includes(Object.getPrototypeOf(input)), 'Surface pole values require ordinary own data.');
  const keys = Reflect.ownKeys(input);
  check(keys.length === FIELDS.length && keys.every(key => typeof key === 'string'
    && FIELDS.includes(key as typeof FIELDS[number])), 'Surface pole values require exactly U/V indices, XYZ millimetres and weight.');
  return Object.fromEntries(FIELDS.map(key => {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    check(descriptor && 'value' in descriptor && descriptor.enumerable && typeof descriptor.value === 'number',
      'Surface pole fields require own numeric data without accessors.');
    // The real CAD writer owns finite, index, coordinate and weight admission.
    return [key, descriptor.value];
  })) as unknown as RenderNativeSceneSurfacePolePatch;
}

/** Edit one original literal pole, retaining whole source authorship. This does not present a frame. */
export function deriveRenderNativeSceneSurfacePoleEdit(document: RenderNativeSceneDocument, bodyId: string,
  patch: RenderNativeSceneSurfacePolePatch): RenderNativeSceneDocument {
  try {
    const baseline = prepareRenderNativeSceneAppearance(document).authored, original = baseline.document;
    check(typeof bodyId === 'string', 'Choose an original visible Surface body to edit.');
    const body = original.nativeDocument.bodies.find(value => value.id === bodyId);
    const entries = baseline.entries.filter(value => value.binding.bodyId === bodyId);
    const materials = baseline.materials.filter(value => value.target.bodyId === bodyId);
    check(body && entries.length === 1 && entries[0]!.kind === 'surface' && materials.length === 1
      && original.display.visibleBodyIds.includes(bodyId), 'Edit an original selected visible Surface body with a material.');
    check(!original.nativeDocument.bodies.some(value => value.id !== bodyId && value.assetId === body.assetId),
      'This source asset is shared by another body. Duplicate the body before editing its control point.');
    const selected = createCadGeometryReference(baseline.native, {bodyId});
    const asset = original.nativeDocument.assets.find(value => value.id === selected.reference.assetId);
    check(asset && selected.geometry.kind === 'surface' && selected.reference.assetId === body.assetId
      && selected.reference.geometryId === body.geometryId && selected.source === asset.source,
      'The selected control point does not bind to the original Surface source asset.');
    const values = copyPatch(patch);
    const edited = editSourceSurfaceControlNetWide({source: selected.source, sourceVersion: 0,
      surfaceId: selected.geometry.id, edits: {poleEdits: [values]}});
    validateSourceSurfaceControlNetWideEdit(edited);
    if (edited.report.noOp) return original;
    const native = original.nativeDocument;
    const rebuilt = createCadDocument({...native, revision: native.revision + 1,
      assets: native.assets.map(value => value.id === asset.id
        ? {...value, source: edited.source, revision: value.revision + 1} : value)});
    const refreshed = prepareBaroCadDocumentPrimitiveNativeRefsV2(rebuilt, original.nativeOptions);
    const surfaceMaterials = original.surfaceMaterials.map(value => {
      const entry = refreshed.find(entry => entry.binding.bodyId === value.target.bodyId);
      check(entry, 'The edited native scene has no refreshed Surface material binding.');
      return {target: nativeSurfaceMaterialTarget(entry), material: value.material};
    });
    return prepareRenderNativeSceneAppearance({...original, nativeDocument: rebuilt.document, surfaceMaterials}).authored.document;
  } catch (cause) {
    const error = normalizeRenderEditorError(cause);
    if (error !== cause) Object.defineProperty(error, 'cause', {value: cause, configurable: true});
    throw error;
  }
}
