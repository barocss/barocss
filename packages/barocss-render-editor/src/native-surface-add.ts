import {createCadDocument} from '@barocss/cad';
import {prepareBaroCadDocumentPrimitiveNativeRefsV2} from '@barocss/cad-interop/document';
import {prepareRenderNativeSceneDocument} from './native-scene-document.js';
import type {RenderNativeSceneDocument, RenderNativeSceneSurfaceTarget} from './native-scene-document.js';
import {prepareRenderNativeSourceImport} from './native-source-import.js';
import {prepareRenderMaterialDocument} from './material-document.js';
import type {RenderMaterialDocument} from './material-document.js';
import {prepareRenderNativeSceneAppearance} from './native-scene-appearance.js';
import {copyNativeBodyIdentityOptions, freshNativeBodyIdentity, nativeSurfaceMaterialTarget} from './native-body-duplicate.js';
import {RenderEditorError, normalizeRenderEditorError} from './errors.js';

export interface RenderNativeSceneSurfaceAdditionOptions {
  readonly name?: string;
  readonly reservedIds?: readonly string[];
  readonly material?: RenderMaterialDocument;
}
export interface RenderNativeSceneSurfaceAddition {
  readonly document: RenderNativeSceneDocument;
  readonly bodyId: string;
  readonly assetId: string;
  readonly materialDocumentId: string;
}
function check(value: unknown, message: string): asserts value {
  if (!value) throw new RenderEditorError('DOCUMENT_INPUT', message);
}
function copyOptions(input: unknown): {name?: string; reservedIds: string[]; material?: unknown} {
  if (input === undefined) return copyNativeBodyIdentityOptions(undefined);
  check(input !== null && typeof input === 'object' && !Array.isArray(input)
    && [Object.prototype, null].includes(Object.getPrototypeOf(input)), 'Surface addition options require ordinary own data.');
  const keys = Reflect.ownKeys(input);
  check(keys.length <= 3 && keys.every(key => key === 'name' || key === 'reservedIds' || key === 'material'), 'Surface addition options have unsupported fields.');
  const fields = Object.fromEntries(keys.map(key => {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    check(typeof key === 'string' && descriptor && 'value' in descriptor && descriptor.enumerable, 'Surface addition options refuse accessors and hidden fields.');
    return [key, descriptor.value];
  }));
  return {...copyNativeBodyIdentityOptions({name: fields.name, reservedIds: fields.reservedIds}), material: fields.material};
}
function identityStem(value: string, fallback: string): string {
  return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value) ? value : fallback;
}

/** Qualify original Surface source again and add its complete independent asset; this does not present it. */
export function deriveRenderNativeSceneSurfaceAddition(document: RenderNativeSceneDocument, source: string,
  surfaceId: string, options?: RenderNativeSceneSurfaceAdditionOptions): RenderNativeSceneSurfaceAddition {
  try {
    const baseline = prepareRenderNativeSceneDocument(document), original = baseline.document;
    const imported = prepareRenderNativeSourceImport(source);
    check(typeof surfaceId === 'string' && imported.surfaces.some(value => value.id === surfaceId), 'Choose an actual Surface from the original CAD source.');
    const copied = copyOptions(options), native = original.nativeDocument;
    const materialInput = copied.material === undefined ? original.surfaceMaterials[0]?.material : copied.material;
    check(materialInput !== undefined, 'Supply an applied material for the new Surface.');
    const material = prepareRenderMaterialDocument(materialInput).document;
    check(native.assets.length < 4 && native.bodies.length < 16 && baseline.entries.length < 4
      && original.display.visibleBodyIds.length < 4 && original.surfaceMaterials.length < 4, 'Surface addition exceeds the current native asset, body, selection or material capacity.');
    check(native.revision < 2147483647, 'The native CAD document revision is at its maximum.');
    const used = new Set([...copied.reservedIds, ...native.assets.map(value => value.id), ...native.bodies.map(value => value.id),
      ...original.surfaceMaterials.map(value => value.material.documentId)]);
    const bodyId = freshNativeBodyIdentity(identityStem(surfaceId, 'surface'), used);
    const assetId = freshNativeBodyIdentity(identityStem(imported.modelId, 'native_asset'), used);
    const materialDocumentId = freshNativeBodyIdentity(material.documentId, used);
    const name = copied.name ?? (surfaceId.length <= 128 && new TextEncoder().encode(surfaceId).length <= 128 ? surfaceId : 'Surface');
    const rebuilt = createCadDocument({...native, revision: native.revision + 1,
      assets: [...native.assets, {id: assetId, revision: 0, role: 'authored-native-source', sourceVersion: 0,
        sourceFrame: 'authored-xyz-no-axis-conversion', source: imported.source}],
      bodies: [...native.bodies, {id: bodyId, name, kind: 'direct-geometry-object', assetId, geometryId: surfaceId}]});
    const nativeOptions = {...original.nativeOptions,
      bodyIds: [...(original.nativeOptions.bodyIds ?? baseline.entries.map(value => value.binding.bodyId)), bodyId]};
    const entries = prepareBaroCadDocumentPrimitiveNativeRefsV2(rebuilt, nativeOptions);
    const target = (id: string): RenderNativeSceneSurfaceTarget => {
      const found = entries.find(value => value.binding.bodyId === id);
      check(found, 'The added native body has no qualified binding.');
      return nativeSurfaceMaterialTarget(found);
    };
    const result = prepareRenderNativeSceneAppearance({...original, nativeDocument: rebuilt.document, nativeOptions,
      display: {...original.display, visibleBodyIds: [...original.display.visibleBodyIds, bodyId],
        poses: original.display.poses.length === 0 ? [] : [...original.display.poses,
          {bodyId, translationMM: [0, 0, 0], rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1]}]},
      surfaceMaterials: [...original.surfaceMaterials.map(value => ({target: target(value.target.bodyId), material: value.material})),
        {target: target(bodyId), material: {...material, documentId: materialDocumentId, revision: 0, uniforms: {...material.uniforms}}}]});
    return Object.freeze({document: result.authored.document, bodyId, assetId, materialDocumentId});
  } catch (cause) {
    const error = normalizeRenderEditorError(cause);
    if (error !== cause) Object.defineProperty(error, 'cause', {value: cause, configurable: true});
    throw error;
  }
}
