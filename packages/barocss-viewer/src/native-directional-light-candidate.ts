import type { NativeDirectionalLightsV0, NativeDirectionalLightWebGPURequest } from '@barocss/gpu';
import type { BaroCadDocumentPrimitiveBindingV2 } from '@barocss/cad-interop/document';
import { prepareViewerNativeSceneAppearance } from './native-scene-appearance.js';
import type { ViewerNativeSceneAppearanceInputV1, ViewerNativeSceneAppearanceContext } from './native-scene-appearance.js';
import type { ViewerGeometryRef, ViewerSurfaceMaterial } from './index.js';

export type ViewerNativeDirectionalLightCode = 'INPUT' | 'BUDGET' | 'OWNER' | 'SOURCE' | 'GPU' | 'BUSY' | 'STATE' | 'DISPOSED';
export class ViewerNativeDirectionalLightError extends Error {
  constructor(readonly code: ViewerNativeDirectionalLightCode, message: string, ...cause: [] | [unknown]) {
    super(message.slice(0, 1024), cause.length ? { cause: cause[0] } : undefined);
    this.name = 'ViewerNativeDirectionalLightError';
  }
}
export interface ViewerNativeDirectionalLightOwner { id: string; revision: number }
export interface ViewerNativeDirectionalLightInput {
  format: 'barocss-viewer-native-directional-light-input'; version: 0;
  owner: ViewerNativeDirectionalLightOwner;
  source: ViewerNativeSceneAppearanceInputV1['source'];
  display: ViewerNativeSceneAppearanceInputV1['display'];
  materials: ViewerSurfaceMaterial[];
  lights: NativeDirectionalLightsV0;
  context: ViewerNativeSceneAppearanceContext;
}
export interface ViewerNativeDirectionalLightAccepted {
  readonly owner: ViewerNativeDirectionalLightOwner;
  readonly document: { documentId: string; revision: number };
  readonly inventory: ViewerGeometryRef[];
  readonly visibleGeometry: ViewerGeometryRef[];
  readonly bindings: { ref: ViewerGeometryRef; binding: BaroCadDocumentPrimitiveBindingV2 }[];
  readonly generation: number;
}
export interface ViewerNativeDirectionalLightPick {
  readonly generation: number;
  readonly ref: ViewerGeometryRef | null;
  readonly binding: BaroCadDocumentPrimitiveBindingV2 | null;
}
export function refuse(code: ViewerNativeDirectionalLightCode, message: string): never {
  throw new ViewerNativeDirectionalLightError(code, message);
}
function reflect<T>(operation: () => T): T {
  try { return operation(); }
  catch (cause) { throw new ViewerNativeDirectionalLightError('INPUT', 'Own data reflection refused', cause); }
}
/** Private bounded signed ordinary-data traversal; never invokes caller accessors. */
export function copyOwn<T>(input: T, projection = false): T {
  const cap = projection ? 12582912 : 4194304, maxVisits = projection ? 1048576 : 327680;
  let utf16 = 0, utf8 = 0, visits = 0;
  const encoder = new TextEncoder(), active = new Set<object>();
  const append = (text: string): void => {
    utf16 += text.length; utf8 += encoder.encode(text).length;
    if (utf16 > cap || utf8 > cap) refuse('BUDGET', 'Signed ordinary data exceeds byte budget');
  };
  const string = (text: string): void => {
    if (text.length > 262144 || encoder.encode(text).length > 262144) refuse('BUDGET', 'String/key exceeds budget');
    append(JSON.stringify(text));
  };
  const visit = (value: unknown, depth: number, path: string): unknown => {
    if (++visits > maxVisits || depth > (projection ? 64 : 32)) refuse('BUDGET', 'Own value/depth budget exceeded');
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) refuse('INPUT', 'Finite Numbers required');
      append(Object.is(value, -0) ? '-0' : JSON.stringify(value)); return value;
    }
    if (typeof value === 'string') { string(value); return value; }
    if (value === null || typeof value === 'boolean') { append(JSON.stringify(value)); return value; }
    if (typeof value !== 'object') refuse('INPUT', 'Ordinary own data required');
    const array = reflect(() => Array.isArray(value));
    if (reflect(() => Object.getPrototypeOf(value)) !== (array ? Array.prototype : Object.prototype))
      refuse('INPUT', 'Current-realm ordinary records and arrays required');
    if (active.has(value)) refuse('INPUT', 'Cyclic data is unsupported');
    let length = 0;
    if (array) {
      const descriptor = reflect(() => Object.getOwnPropertyDescriptor(value, 'length'));
      if (!descriptor || !('value' in descriptor) || !Number.isInteger(descriptor.value)) refuse('INPUT', 'Own array length required');
      length = descriptor.value as number;
      // Cardinality is checked before any element descriptors or values are visited.
      const narrow = !projection && ['materials', 'lights.lights', 'display.visibleGeometry', 'source.bindings'].includes(path);
      const minimum = path === 'display.visibleGeometry' || path === 'source.bindings' ? 1 : 0;
      if (length < minimum || length > (narrow ? 4 : projection ? 24576 : 4096)) refuse('BUDGET', 'Array cardinality exceeds budget');
    }
    const keys = reflect(() => Reflect.ownKeys(value));
    if (array) {
      if (keys.length !== length + 1 || keys.some(key => key !== 'length' &&
        (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length)))
        refuse('INPUT', 'Dense own arrays without extra fields required');
    } else if (keys.length > 64) refuse('BUDGET', 'Record field budget exceeded');
    active.add(value);
    const output: unknown[] | Record<string, unknown> = array ? [] : {};
    append(array ? '[' : '{');
    try {
      const names = array ? Array.from({ length }, (_, index) => String(index)) : keys;
      for (let i = 0; i < names.length; i++) {
        const name = names[i];
        if (typeof name !== 'string') refuse('INPUT', 'Symbol fields are unsupported');
        const descriptor = reflect(() => Object.getOwnPropertyDescriptor(value, name));
        if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) refuse('INPUT', 'Enumerable own data fields required');
        if (i) append(',');
        if (!array) { string(name); append(':'); }
        const child = visit(descriptor.value, depth + 1, path ? path + '.' + name : name);
        if (!projection) Object.defineProperty(output, name, { value: child, enumerable: true, configurable: true, writable: true });
      }
      append(array ? ']' : '}');
      return projection ? value : output;
    } finally { active.delete(value); }
  };
  return visit(input, 0, '') as T;
}
export function freezeOwn<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeOwn(child);
    Object.freeze(value);
  }
  return value;
}
function exact(value: unknown, names: string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) refuse('INPUT', label + ' record required');
  const keys = Object.keys(value);
  if (keys.length !== names.length || keys.some(key => !names.includes(key))) refuse('INPUT', label + ' fields differ');
  return value as Record<string, unknown>;
}
export function refKey(ref: ViewerGeometryRef): string {
  return JSON.stringify([ref.kind, ref.modelId, ref.kind === 'surface' ? ref.surfaceId : ref.curveId]);
}
export interface LightCandidate {
  originals: ViewerNativeDirectionalLightInput;
  accepted: ViewerNativeDirectionalLightAccepted;
  gpuRequest: NativeDirectionalLightWebGPURequest;
  selected: ViewerGeometryRef | null;
  visible: Map<string, { ref: ViewerGeometryRef; binding: BaroCadDocumentPrimitiveBindingV2 }>;
}
/** Exactly one unchanged appearance admission joins the original document and all TEN pins. */
export function prepareLightCandidate(input: unknown, generation: number, selected: ViewerGeometryRef | null): LightCandidate {
  const raw = copyOwn(input);
  const envelope = exact(raw, ['format', 'version', 'owner', 'source', 'display', 'materials', 'lights', 'context'], 'Input');
  if (envelope.format !== 'barocss-viewer-native-directional-light-input' || envelope.version !== 0) refuse('INPUT', 'Unsupported Viewer format/version');
  const owner = exact(envelope.owner, ['id', 'revision'], 'Owner');
  if (typeof owner.id !== 'string' || owner.id.length > 64 || !/^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(owner.id)
    || typeof owner.revision !== 'number' || !Number.isSafeInteger(owner.revision) || owner.revision < 0)
    refuse('OWNER', 'Composition owner requires a bounded identifier and nonnegative safe revision');
  const catalog = exact(envelope.lights, ['format', 'version', 'profile', 'sourceId', 'revision', 'ambientStrength', 'lights'], 'Lights');
  if (catalog.sourceId !== owner.id || !Object.is(catalog.revision, owner.revision)) refuse('OWNER', 'Light catalog and composition owner differ');
  const originals = raw as ViewerNativeDirectionalLightInput;
  let prepared: ReturnType<typeof prepareViewerNativeSceneAppearance>;
  try {
    prepared = prepareViewerNativeSceneAppearance({ version: 1, source: originals.source, display: originals.display,
      appearance: { lighting: { ambientStrength: 1, directionalStrength: 0, direction: [0, 0, 1] }, materials: originals.materials } }, originals.context);
  } catch (cause) { throw new ViewerNativeDirectionalLightError('SOURCE', cause instanceof Error ? cause.message : 'Native source/appearance admission refused', cause); }
  if (!prepared.inventory.length || prepared.inventory.some(ref => ref.kind !== 'surface')) refuse('SOURCE', 'Every selected native object must be a Surface');
  if (!prepared.display.visibleGeometry.length) refuse('SOURCE', 'At least one visible Surface required');
  const bindings = prepared.inventory.map(ref => {
    const matches = prepared.source.bindings.filter(binding => binding.geometryKind === 'surface'
      // Interop's display alias is asset-derived; TEN modelId remains the original native model name.
      && binding.assetId.replaceAll('-', '.') === ref.modelId && ref.kind === 'surface' && binding.geometryId === ref.surfaceId);
    if (matches.length !== 1) refuse('SOURCE', 'One complete TEN binding required per selected Surface');
    return { ref: copyOwn(ref), binding: copyOwn(matches[0]) };
  });
  if (new Set(bindings.map(row => refKey(row.ref))).size !== bindings.length) refuse('SOURCE', 'Duplicate full native reference');
  const first = bindings[0].binding;
  const accepted = freezeOwn<ViewerNativeDirectionalLightAccepted>({ owner: copyOwn(originals.owner),
    document: { documentId: first.documentId, revision: first.documentRevision }, inventory: copyOwn(prepared.inventory),
    visibleGeometry: copyOwn(prepared.display.visibleGeometry), bindings, generation });
  const options = prepared.prepared.frame.options;
  const gpuRequest: NativeDirectionalLightWebGPURequest = {
    format: 'barocss-gpu-native-directional-light-webgpu-request', version: 0,
    frame: { version: 0, scene: prepared.prepared.frame.scene, particles: null,
      options: { mmToSceneUnit: options.mmToSceneUnit, translate: options.translate,
        background: options.background, camera: prepared.display.camera },
      materials: originals.materials.map(item => ({ ref: { modelId: item.ref.modelId, geometryId: item.ref.surfaceId }, binding: item.binding })) },
    lights: originals.lights,
  };
  const visible = new Map(accepted.visibleGeometry.map(ref => {
    const row = bindings.find(binding => refKey(binding.ref) === refKey(ref));
    if (!row) refuse('SOURCE', 'Visible reference has no TEN binding');
    return [refKey(ref), freezeOwn({ ref: copyOwn(ref), binding: copyOwn(row.binding) })] as const;
  }));
  const nextSelected = selected ? visible.get(refKey(selected))?.ref ?? null : null;
  // Charge every repeated path of the full retained ordinary projection, before presentation.
  copyOwn({ originals, source: prepared.source, inventory: prepared.inventory, display: prepared.display, gpuRequest, accepted }, true);
  return { originals: freezeOwn(originals), accepted, gpuRequest: freezeOwn(gpuRequest),
    selected: nextSelected === null ? null : freezeOwn(copyOwn(nextSelected)), visible };
}
