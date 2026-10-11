import {createCadDocument} from '@barocss/cad';
import {prepareBaroCadDocumentPrimitiveNativeRefsV2} from '@barocss/cad-interop/document';
import type {BaroCadDocumentPrimitiveEntryV2} from '@barocss/cad-interop/document';
import {prepareRenderNativeSceneDocument} from './native-scene-document.js';
import type {RenderNativeSceneDocument, RenderNativeSceneSurfaceTarget} from './native-scene-document.js';
import {prepareRenderNativeSceneAppearance} from './native-scene-appearance.js';
import {RenderEditorError, normalizeRenderEditorError} from './errors.js';

export interface RenderNativeSceneBodyDuplicateOptions {
  readonly name?: string;
  readonly reservedIds?: readonly string[];
}
export interface RenderNativeSceneBodyDuplicate {
  readonly document: RenderNativeSceneDocument;
  readonly bodyId: string;
  readonly assetId: string;
  readonly materialDocumentId: string;
}
function check(value: unknown, message: string): asserts value {
  if (!value) throw new RenderEditorError('DOCUMENT_INPUT', message);
}
function copyOptions(input: unknown): {name?: string; reservedIds: string[]} {
  if (input === undefined) return {reservedIds: []};
  check(input !== null && typeof input === 'object' && !Array.isArray(input)
    && [Object.prototype, null].includes(Object.getPrototypeOf(input)), 'Body duplicate options require ordinary own data.');
  const keys = Reflect.ownKeys(input);
  check(keys.length <= 2 && keys.every(key => key === 'name' || key === 'reservedIds'), 'Body duplicate options have unsupported fields.');
  const fields = Object.fromEntries(keys.map(key => {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    check(typeof key === 'string' && descriptor && 'value' in descriptor && descriptor.enumerable, 'Body duplicate options refuse accessors and hidden fields.');
    return [key, descriptor.value];
  }));
  if (fields.name !== undefined) check(typeof fields.name === 'string' && fields.name.length > 0
    && fields.name.length <= 128 && new TextEncoder().encode(fields.name).length <= 128, 'Body name requires 1..128 UTF-8 bytes.');
  if (fields.reservedIds === undefined) return {name: fields.name as string | undefined, reservedIds: []};
  const values: unknown = fields.reservedIds;
  check(Array.isArray(values) && Object.getPrototypeOf(values) === Array.prototype, 'Reserved IDs require an ordinary dense array.');
  const length = Object.getOwnPropertyDescriptor(values, 'length');
  check(length && 'value' in length && Number.isInteger(length.value) && length.value >= 0 && length.value <= 2048, 'Reserved IDs exceed 2048 entries.');
  const names = Reflect.ownKeys(values);
  check(names.length === length.value + 1 && names.every(key => key === 'length' || typeof key === 'string'
    && /^(0|[1-9]\d*)$/.test(key) && Number(key) < length.value), 'Reserved IDs refuse holes, symbols and extra fields.');
  const reservedIds = Array.from({length: length.value}, (_, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(values, String(index));
    check(descriptor && 'value' in descriptor && descriptor.enumerable && typeof descriptor.value === 'string'
      && /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(descriptor.value), 'Reserved IDs require own ASCII strings of 1..64 characters.');
    return descriptor.value as string;
  });
  return {name: fields.name as string | undefined, reservedIds};
}
function freshId(stem: string, used: Set<string>): string {
  const maximum = used.size + 1;
  for (let index = 0; index < maximum; index++) {
    const suffix = index === 0 ? '_copy' : '_copy_' + (index + 1);
    const id = stem.slice(0, 48 - suffix.length) + suffix;
    if (!used.has(id)) {used.add(id); return id;}
  }
  throw new RenderEditorError('DOCUMENT_INPUT', 'A fresh body duplicate ID could not be generated.');
}
function materialTarget(entry: BaroCadDocumentPrimitiveEntryV2): RenderNativeSceneSurfaceTarget {
  check(entry.kind === 'surface', 'The duplicated material must bind to an actual Surface.');
  const binding = entry.binding;
  return {documentId: binding.documentId, documentRevision: binding.documentRevision, bodyId: binding.bodyId,
    assetId: binding.assetId, assetRevision: binding.assetRevision, modelId: binding.modelId, geometryId: binding.geometryId};
}

/** Copy complete original authorship and qualify the resulting CPU frame; this does not present it. */
export function deriveRenderNativeSceneBodyDuplicate(document: RenderNativeSceneDocument, bodyId: string,
  options?: RenderNativeSceneBodyDuplicateOptions): RenderNativeSceneBodyDuplicate {
  try {
    const baseline = prepareRenderNativeSceneDocument(document), original = baseline.document;
    check(typeof bodyId === 'string', 'Choose an original visible Surface body to duplicate.');
    const body = original.nativeDocument.bodies.find(value => value.id === bodyId);
    const entry = baseline.entries.find(value => value.binding.bodyId === bodyId);
    const material = original.surfaceMaterials.find(value => value.target.bodyId === bodyId);
    check(body && entry?.kind === 'surface' && material && original.display.visibleBodyIds.includes(bodyId), 'Duplicate an original selected visible Surface body with a material.');
    const asset = original.nativeDocument.assets.find(value => value.id === body.assetId);
    check(asset, 'The selected body has no original source asset.');
    const copied = copyOptions(options), native = original.nativeDocument;
    check(native.assets.length < 4 && native.bodies.length < 16 && baseline.entries.length < 4
      && original.display.visibleBodyIds.length < 4 && original.surfaceMaterials.length < 4, 'Body duplication exceeds the current native asset, body, selection or material capacity.');
    check(native.revision < 2147483647, 'The native CAD document revision is at its maximum.');
    const used = new Set([...copied.reservedIds, ...native.assets.map(value => value.id), ...native.bodies.map(value => value.id),
      ...original.surfaceMaterials.map(value => value.material.documentId)]);
    const duplicateBodyId = freshId(body.id, used), assetId = freshId(asset.id, used), materialDocumentId = freshId(material.material.documentId, used);
    const rebuilt = createCadDocument({...native, revision: native.revision + 1,
      assets: [...native.assets, {...asset, id: assetId, revision: 0}],
      bodies: [...native.bodies, {...body, id: duplicateBodyId, name: copied.name ?? body.name, assetId}]});
    const nativeOptions = {...original.nativeOptions,
      bodyIds: [...(original.nativeOptions.bodyIds ?? baseline.entries.map(value => value.binding.bodyId)), duplicateBodyId]};
    const entries = prepareBaroCadDocumentPrimitiveNativeRefsV2(rebuilt, nativeOptions);
    const target = (id: string): RenderNativeSceneSurfaceTarget => {
      const found = entries.find(value => value.binding.bodyId === id);
      check(found, 'The reconstructed native body has no qualified binding.');
      return materialTarget(found);
    };
    const pose = original.display.poses.find(value => value.bodyId === bodyId);
    check(original.display.poses.length === 0 || pose, 'The selected body has no authored pose.');
    const result = prepareRenderNativeSceneAppearance({...original, nativeDocument: rebuilt.document, nativeOptions,
      display: {...original.display, visibleBodyIds: [...original.display.visibleBodyIds, duplicateBodyId],
        poses: pose ? [...original.display.poses, {...pose, bodyId: duplicateBodyId}] : []},
      surfaceMaterials: [...original.surfaceMaterials.map(value => ({target: target(value.target.bodyId), material: value.material})),
        {target: target(duplicateBodyId), material: {...material.material, documentId: materialDocumentId, revision: 0,
          uniforms: {...material.material.uniforms}}}]});
    return Object.freeze({document: result.authored.document, bodyId: duplicateBodyId, assetId, materialDocumentId});
  } catch (cause) {
    const error = normalizeRenderEditorError(cause);
    if (error !== cause) Object.defineProperty(error, 'cause', {value: cause, configurable: true});
    throw error;
  }
}
