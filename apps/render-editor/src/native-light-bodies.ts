import {deriveRenderNativeSceneBodyDuplicate, deriveRenderNativeSceneBodyRemoval, deriveRenderNativeSceneSurfaceAddition, deriveRenderNativeSceneSurfacePoleEdit,
  prepareRenderNativeLightDocument, RenderEditorError, normalizeRenderEditorError} from '@barocss/render-editor';
import type {RenderNativeLightDocument, RenderNativeSceneDocument, RenderNativeSceneSurfacePolePatch} from '@barocss/render-editor';

export type LightBodyCommand = 'duplicate' | 'remove';
export interface LightBodyCommandResult {
  readonly document: RenderNativeLightDocument;
  readonly selectedBodyId: string;
  readonly generatedIds: readonly string[];
  readonly reservedIds: readonly string[];
}
const MAX_RESERVED_IDS = 2048;
function check(value: unknown, message: string): asserts value {
  if (!value) throw new RenderEditorError('DOCUMENT_INPUT', message);
}
/** App-owned reservations are bounded copies, never a provider identity certificate. */
function copyReservedIds(input: readonly string[]): string[] {
  check(Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype, 'Body reservations require an ordinary array.');
  const length = Object.getOwnPropertyDescriptor(input, 'length');
  check(length && 'value' in length && Number.isInteger(length.value) && length.value >= 0
    && length.value <= MAX_RESERVED_IDS, 'Body reservations exceed 2048 entries.');
  const keys = Reflect.ownKeys(input);
  check(keys.length === length.value + 1 && keys.every(key => key === 'length' || typeof key === 'string'
    && /^(0|[1-9]\d*)$/.test(key) && Number(key) < length.value), 'Body reservations refuse sparse or extra fields.');
  return Array.from({length: length.value}, (_, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    check(descriptor && 'value' in descriptor && descriptor.enumerable && typeof descriptor.value === 'string'
      && /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(descriptor.value), 'Body reservations require own ASCII IDs.');
    return descriptor.value as string;
  });
}
/** Call with actual accepted/prepared authorship; removed IDs intentionally remain reserved. */
export function lightBodyReservedIds(document: RenderNativeLightDocument, previous: readonly string[] = []): readonly string[] {
  const ids = new Set([...copyReservedIds(previous), ...document.nativeDocument.assets.map(value => value.id),
    ...document.nativeDocument.bodies.map(value => value.id), ...document.surfaceMaterials.map(value => value.material.documentId)]);
  check(ids.size <= MAX_RESERVED_IDS, 'Body reservations are full. Open a saved scene or start a new workspace before duplicating.');
  return Object.freeze([...ids]);
}

/** Actual Native CRUD authority with the same neutral-light geometry/material bridge as the Light codec. */
export function deriveLightBodyCommand(input: RenderNativeLightDocument, bodyId: string,
  action: LightBodyCommand, reservedIds: readonly string[] = []): LightBodyCommandResult {
  try {
    const original = prepareRenderNativeLightDocument(input).document;
    check(action === 'duplicate' || action === 'remove', 'Choose Duplicate body or Remove body.');
    const retained = lightBodyReservedIds(original, reservedIds);
    const {lights, ...scene} = original;
    const legacy: RenderNativeSceneDocument = {...scene, version: 0, profile: 'canonical-native-opaque-scene-v0',
      display: {...original.display, lighting: {ambientStrength: 1, directionalStrength: 0, direction: [0, 0, 1]}}};
    let derived: RenderNativeSceneDocument, selectedBodyId: string, generatedIds: readonly string[];
    if (action === 'duplicate') {
      const name = original.nativeDocument.bodies.find(value => value.id === bodyId)?.name;
      const copyName = name === undefined ? undefined : name + ' copy';
      const result = deriveRenderNativeSceneBodyDuplicate(legacy, bodyId, {reservedIds: retained,
        ...(copyName !== undefined && copyName.length <= 128 && new TextEncoder().encode(copyName).length <= 128 ? {name: copyName} : {})});
      derived = result.document; selectedBodyId = result.bodyId;
      generatedIds = Object.freeze([result.bodyId, result.assetId, result.materialDocumentId]);
    } else {
      derived = deriveRenderNativeSceneBodyRemoval(legacy, bodyId);
      // Inspector row order is the admitted native selection, not material-binding order.
      const rows = derived.nativeOptions.bodyIds;
      check(Array.isArray(rows), 'The scene requires its explicit qualified body selection.');
      const firstEditable = rows.find(id => derived.display.visibleBodyIds.includes(id)
        && derived.surfaceMaterials.some(binding => binding.target.bodyId === id));
      check(firstEditable !== undefined, 'The scene requires a surviving editable body.');
      selectedBodyId = firstEditable;
      generatedIds = Object.freeze([]);
    }
    const {lighting: _lighting, ...display} = derived.display; void _lighting;
    const document = prepareRenderNativeLightDocument({...derived, version: 2,
      profile: 'canonical-native-lights', display, lights}).document;
    // Preflight the complete reservation union before any session draft or Viewer call.
    // Caller publishes this owned set only after acknowledgement, never on a refusal.
    const nextReserved = lightBodyReservedIds(document, retained);
    return Object.freeze({document, selectedBodyId, generatedIds, reservedIds: nextReserved});
  } catch (cause) {
    const error = normalizeRenderEditorError(cause);
    if (error !== cause) Object.defineProperty(error, 'cause', {value: cause});
    throw error;
  }
}

/** Reuse original-source addition, explicitly copying only the chosen qualified material binding. */
export function deriveLightSurfaceAddition(input: RenderNativeLightDocument, bodyId: string,
  source: string, surfaceId: string, reservedIds: readonly string[] = []): LightBodyCommandResult {
  try {
    const prepared = prepareRenderNativeLightDocument(input), original = prepared.document;
    const entry = prepared.entries.find(value => value.binding.bodyId === bodyId);
    const bindings = original.surfaceMaterials.filter(value => value.target.bodyId === bodyId);
    check(entry?.kind === 'surface' && original.display.visibleBodyIds.includes(bodyId) && bindings.length === 1,
      'Select one visible qualified Surface with an accepted material for the new body.');
    const retained = lightBodyReservedIds(original, reservedIds);
    const {lights, ...scene} = original;
    const legacy: RenderNativeSceneDocument = {...scene, version: 0, profile: 'canonical-native-opaque-scene-v0',
      display: {...original.display, lighting: {ambientStrength: 1, directionalStrength: 0, direction: [0, 0, 1]}}};
    const result = deriveRenderNativeSceneSurfaceAddition(legacy, source, surfaceId,
      {reservedIds: retained, material: bindings[0]!.material});
    const {lighting: _lighting, ...display} = result.document.display; void _lighting;
    const document = prepareRenderNativeLightDocument({...result.document, version: 2,
      profile: 'canonical-native-lights', display, lights}).document;
    return Object.freeze({document, selectedBodyId: result.bodyId,
      generatedIds: Object.freeze([result.bodyId, result.assetId, result.materialDocumentId]),
      reservedIds: lightBodyReservedIds(document, retained)});
  } catch (cause) {
    const error = normalizeRenderEditorError(cause);
    if (error !== cause) Object.defineProperty(error, 'cause', {value: cause});
    throw error;
  }
}

export interface LightSurfacePointData {
  readonly bodyId: string;
  readonly shared: boolean;
  readonly rows: readonly (readonly {readonly pointMM: readonly number[]; readonly weight: number}[])[];
}
/** Original compiled coefficients, not sampled display vertices or projected markers. */
export function readLightSurfacePoints(input: RenderNativeLightDocument, bodyId: string): LightSurfacePointData {
  const prepared = prepareRenderNativeLightDocument(input), document = prepared.document;
  const body = document.nativeDocument.bodies.find(value => value.id === bodyId);
  const entries = prepared.entries.filter(value => value.binding.bodyId === bodyId);
  check(body && entries.length === 1 && entries[0]!.kind === 'surface' && document.display.visibleBodyIds.includes(bodyId)
    && document.surfaceMaterials.filter(value => value.target.bodyId === bodyId).length === 1,
  'Choose one visible qualified material-bound Surface.');
  const asset = prepared.native.compiledAssets.find(value => value.assetId === body.assetId);
  const surface = asset?.model.objects.find(value => value.id === body.geometryId);
  check(surface?.kind === 'surface', 'The original Surface coefficients are unavailable.');
  return Object.freeze({bodyId, shared: document.nativeDocument.bodies.some(value => value.id !== bodyId && value.assetId === body.assetId),
    rows: Object.freeze(surface.controlPoints.map((row, u) => Object.freeze(row.map((point, v) => Object.freeze({
      pointMM: Object.freeze([...point]), weight: surface.weights[u]![v]!,
    })))))});
}

/** Existing literal source writer and complete qualification own edits, revisions and refusal. */
export function deriveLightSurfacePointEdit(input: RenderNativeLightDocument, bodyId: string,
  patch: RenderNativeSceneSurfacePolePatch, reservedIds: readonly string[] = []): LightBodyCommandResult {
  const original = prepareRenderNativeLightDocument(input).document;
  const retained = lightBodyReservedIds(original, reservedIds);
  const {lights, ...scene} = original;
  const legacy: RenderNativeSceneDocument = {...scene, version: 0, profile: 'canonical-native-opaque-scene-v0',
    display: {...original.display, lighting: {ambientStrength: 1, directionalStrength: 0, direction: [0, 0, 1]}}};
  const derived = deriveRenderNativeSceneSurfacePoleEdit(legacy, bodyId, patch);
  const {lighting: _lighting, ...display} = derived.display; void _lighting;
  const document = prepareRenderNativeLightDocument({...derived, version: 2, profile: 'canonical-native-lights', display, lights}).document;
  return Object.freeze({document, selectedBodyId: bodyId, generatedIds: Object.freeze([]), reservedIds: retained});
}
