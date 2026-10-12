import { compileNativeSurfaceUV01Material } from '@barocss/gpu';
import type { MeshLighting, NativeSurfaceUV01FrameRequest } from '@barocss/gpu';
import type { BaroCadDocumentPrimitiveBindingV2 } from '@barocss/cad-interop/document';
import { prepareViewerNativeSceneAppearance } from './native-scene-appearance.js';
import type { ViewerNativeSceneAppearanceInputV1, ViewerNativeSceneAppearanceContext } from './native-scene-appearance.js';
import type { ViewerGeometryRef } from './index.js';

export type ViewerNativeSurfaceUV01Code = 'INPUT' | 'BUDGET' | 'OWNER' | 'SOURCE' | 'MATERIAL' | 'GPU' | 'BUSY' | 'STATE' | 'DISPOSED';
export class ViewerNativeSurfaceUV01Error extends Error {
  constructor(readonly code: ViewerNativeSurfaceUV01Code, message: string, ...cause: [] | [unknown]) {
    super(message.slice(0, 1024), cause.length ? { cause: cause[0] } : undefined);
    this.name = 'ViewerNativeSurfaceUV01Error';
  }
}
export interface ViewerNativeSurfaceUV01Owner { id: string; revision: number }
export interface ViewerNativeSurfaceUV01Material {
  ref: { modelId: string; surfaceId: string };
  source: string;
  uniforms?: Record<string, number>;
}
export interface ViewerNativeSurfaceUV01Input {
  format: 'barocss-viewer-native-surface-uv01-input'; version: 0;
  owner: ViewerNativeSurfaceUV01Owner;
  source: ViewerNativeSceneAppearanceInputV1['source'];
  display: ViewerNativeSceneAppearanceInputV1['display'];
  materials: ViewerNativeSurfaceUV01Material[];
  lighting: MeshLighting;
  context: ViewerNativeSceneAppearanceContext;
}
export interface ViewerNativeSurfaceUV01Accepted {
  readonly owner: ViewerNativeSurfaceUV01Owner;
  readonly document: { documentId: string; revision: number };
  readonly inventory: ViewerGeometryRef[];
  readonly visibleGeometry: ViewerGeometryRef[];
  readonly bindings: { ref: ViewerGeometryRef; binding: BaroCadDocumentPrimitiveBindingV2 }[];
  readonly generation: number;
}
export interface ViewerNativeSurfaceUV01Pick {
  readonly generation: number;
  readonly ref: ViewerGeometryRef | null;
  readonly binding: BaroCadDocumentPrimitiveBindingV2 | null;
}
export function refuse(code: ViewerNativeSurfaceUV01Code, message: string): never {
  throw new ViewerNativeSurfaceUV01Error(code, message);
}
function reflect<T>(operation: () => T): T {
  try { return operation(); }
  catch (cause) { throw new ViewerNativeSurfaceUV01Error('INPUT', 'Own data reflection refused', cause); }
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
      const narrow = !projection && ['materials', 'display.visibleGeometry', 'source.bindings'].includes(path);
      const minimum = ['materials', 'display.visibleGeometry', 'source.bindings'].includes(path) ? 1 : 0;
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
export interface UV01Candidate {
  originals: ViewerNativeSurfaceUV01Input;
  accepted: ViewerNativeSurfaceUV01Accepted;
  gpuRequest: NativeSurfaceUV01FrameRequest;
  selected: ViewerGeometryRef | null;
  visible: Map<string, { ref: ViewerGeometryRef; binding: BaroCadDocumentPrimitiveBindingV2 }>;
}
/** Exactly one unchanged appearance admission joins the original document and all TEN pins. */
export function prepareUV01Candidate(input: unknown, generation: number, selected: ViewerGeometryRef | null): UV01Candidate {
  const raw = copyOwn(input);
  const envelope = exact(raw, ['format', 'version', 'owner', 'source', 'display', 'materials', 'lighting', 'context'], 'Input');
  if (envelope.format !== 'barocss-viewer-native-surface-uv01-input' || envelope.version !== 0) refuse('INPUT', 'Unsupported Viewer format/version');
  const owner = exact(envelope.owner, ['id', 'revision'], 'Owner');
  if (typeof owner.id !== 'string' || owner.id.length > 64 || !/^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(owner.id)
    || typeof owner.revision !== 'number' || !Number.isSafeInteger(owner.revision) || owner.revision < 0)
    refuse('OWNER', 'Composition owner requires a bounded identifier and nonnegative safe revision');
  const originals = raw as ViewerNativeSurfaceUV01Input;
  let prepared: ReturnType<typeof prepareViewerNativeSceneAppearance>;
  try {
    prepared = prepareViewerNativeSceneAppearance({ version: 1, source: originals.source, display: originals.display,
      appearance: { lighting: originals.lighting, materials: [] } }, originals.context);
  } catch (cause) { throw new ViewerNativeSurfaceUV01Error('SOURCE', cause instanceof Error ? cause.message : 'Native source/appearance admission refused', cause); }
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
  const accepted = freezeOwn<ViewerNativeSurfaceUV01Accepted>({ owner: copyOwn(originals.owner),
    document: { documentId: first.documentId, revision: first.documentRevision }, inventory: copyOwn(prepared.inventory),
    visibleGeometry: copyOwn(prepared.display.visibleGeometry), bindings, generation });
  const options = prepared.prepared.frame.options;
  if (!Array.isArray(originals.materials) || originals.materials.length !== accepted.visibleGeometry.length)
    refuse('MATERIAL', 'Exactly one original UV01 material required per visible Surface');
  const materialMap = new Map<string, ViewerNativeSurfaceUV01Material>();
  for (const item of originals.materials) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) refuse('INPUT', 'Material record required');
    const data = exact(item, Object.hasOwn(item, 'uniforms') ? ['ref', 'source', 'uniforms'] : ['ref', 'source'], 'Material');
    const ref = exact(data.ref, ['modelId', 'surfaceId'], 'Material reference');
    if (typeof ref.modelId !== 'string' || typeof ref.surfaceId !== 'string' || typeof data.source !== 'string')
      refuse('MATERIAL', 'Material requires an exact Surface reference and original source text');
    const key = refKey({ kind: 'surface', modelId: ref.modelId, surfaceId: ref.surfaceId });
    if (materialMap.has(key) || !accepted.visibleGeometry.some(value => refKey(value) === key))
      refuse('MATERIAL', 'Duplicate, hidden or foreign material target');
    if (Object.hasOwn(item, 'uniforms') && (!item.uniforms || typeof item.uniforms !== 'object'
      || Array.isArray(item.uniforms) || Object.values(item.uniforms).some(value => typeof value !== 'number')))
      refuse('MATERIAL', 'Uniform overrides require an own finite numeric record');
    materialMap.set(key, item);
  }
  const gpuRequest: NativeSurfaceUV01FrameRequest = {
    format: 'barocss-gpu-native-surface-uv01-frame-request', version: 0,
    entries: accepted.visibleGeometry.map(ref => {
      if (ref.kind !== 'surface') refuse('SOURCE', 'Surface reference required');
      const row = bindings.find(value => refKey(value.ref) === refKey(ref));
      const item = materialMap.get(refKey(ref));
      const entry = prepared.prepared.frame.scene.entries.find(value => value.ref.modelId === ref.modelId
        && value.ref.geometryId === ref.surfaceId);
      if (!row || !item || !entry) refuse('SOURCE', 'Complete source/material/frame association required');
      const asset = prepared.source.result.document.assets.find(value => value.id === row.binding.assetId);
      const body = prepared.source.result.document.bodies.find(value => value.id === row.binding.bodyId);
      if (!asset || !body || body.assetId !== asset.id || body.geometryId !== row.binding.geometryId)
        refuse('SOURCE', 'Original asset and body must match the complete TEN binding');
      let compiled: ReturnType<typeof compileNativeSurfaceUV01Material>;
      try { compiled = compileNativeSurfaceUV01Material(item.source); }
      catch (cause) { throw new ViewerNativeSurfaceUV01Error('MATERIAL', 'Original UV01 material compilation refused', cause); }
      if (!compiled.ok) throw new ViewerNativeSurfaceUV01Error('MATERIAL', 'Original UV01 material compilation refused', compiled.diagnostics);
      return { ref: { modelId: ref.modelId, geometryId: ref.surfaceId },
        geometry: { format: 'barocss-gpu-native-surface-uv01-request', version: 0, sourceVersion: 0,
          source: asset.source, surfaceId: ref.surfaceId, countU: prepared.source.options.native.countU,
          countV: prepared.source.options.native.countV, revision: 0 },
        material: compiled.material, uniforms: item.uniforms ?? {}, transform: entry.transform ?? null };
    }),
    options: { mmToSceneUnit: options.mmToSceneUnit, translate: options.translate,
      background: options.background, camera: prepared.display.camera, lighting: originals.lighting },
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
