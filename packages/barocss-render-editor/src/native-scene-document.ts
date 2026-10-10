import {createCadDocument} from '@barocss/cad';
import type {CadDocumentV1, CadDocumentResult} from '@barocss/cad';
import {prepareBaroCadDocumentPrimitiveNativeRefsV2} from '@barocss/cad-interop/document';
import type {BaroCadDocumentPrimitiveOptionsV2, BaroCadDocumentPrimitiveEntryV2} from '@barocss/cad-interop/document';
import {prepareRenderMaterialDocument} from './material-document.js';
import type {RenderMaterialDocument, RenderMaterialPreparation} from './material-document.js';
import {copyRenderNativeSceneDisplay} from './native-scene-display.js';
import type {RenderNativeSceneDisplay} from './native-scene-display.js';
import {RenderEditorError, normalizeRenderEditorError} from './errors.js';

export const RENDER_NATIVE_SCENE_LIMITS = Object.freeze({fileBytes: 2097152, inputValues: 65536, inputDepth: 24,
  inputArrayElements: 64, inputRecordFields: 32, historyEntries: 64, historyBytes: 16777216});
export interface RenderNativeSceneSurfaceTarget {
  readonly documentId: string;
  readonly documentRevision: number;
  readonly bodyId: string;
  readonly assetId: string;
  readonly assetRevision: number;
  /** Original authored Model name, never the derived display namespace. */
  readonly modelId: string;
  readonly geometryId: string;
}
export interface RenderNativeSceneSurfaceMaterial {
  readonly target: RenderNativeSceneSurfaceTarget;
  readonly material: RenderMaterialDocument;
}
export interface RenderNativeSceneDocument {
  readonly format: 'barocss-render-editor-native-scene';
  readonly version: 0;
  readonly profile: 'canonical-native-opaque-scene-v0';
  readonly documentId: string;
  readonly title: string;
  readonly revision: number;
  readonly nativeDocument: CadDocumentV1;
  readonly nativeOptions: BaroCadDocumentPrimitiveOptionsV2;
  readonly display: RenderNativeSceneDisplay;
  readonly surfaceMaterials: readonly RenderNativeSceneSurfaceMaterial[];
}
export interface RenderNativeScenePreparation {
  readonly document: RenderNativeSceneDocument;
  readonly native: CadDocumentResult;
  readonly entries: ReadonlyArray<BaroCadDocumentPrimitiveEntryV2>;
  readonly materials: readonly {
    readonly target: RenderNativeSceneSurfaceTarget;
    /** Reconstructed qualified display reference; absent from authored files. */
    readonly ref: {readonly modelId: string; readonly surfaceId: string};
    readonly preparation: RenderMaterialPreparation;
  }[];
  readonly stage: 'cpu-prepared';
  readonly rendererAdmission: 'not-presented';
}
const ROOT_KEYS = ['format', 'version', 'profile', 'documentId', 'title', 'revision', 'nativeDocument', 'nativeOptions', 'display', 'surfaceMaterials'];
const TARGET_KEYS = ['documentId', 'documentRevision', 'bodyId', 'assetId', 'assetRevision', 'modelId', 'geometryId'];
const bytes = (text: string) => new TextEncoder().encode(text).length;
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RenderEditorError('DOCUMENT_INPUT', message);
}
function record(input: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), label + ' must be a record.');
  const value = input as Record<string, unknown>, actual = Object.keys(value);
  check(actual.length === keys.length && actual.every(key => keys.includes(key)), label + ' has missing or unsupported fields.');
  return value;
}
/** Descriptor-safe authored copy, before calling any native/material provider. */
function copyInput(input: unknown): unknown {
  let values = 0;
  const active = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(++values <= RENDER_NATIVE_SCENE_LIMITS.inputValues && depth <= RENDER_NATIVE_SCENE_LIMITS.inputDepth, 'Native scene input exceeds its value or depth limit.');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'string') {check(value.length <= RENDER_NATIVE_SCENE_LIMITS.fileBytes, 'Native scene input string exceeds its limit.'); return value;}
    if (typeof value === 'number') {check(Number.isFinite(value), 'Native scene numbers must be finite.'); return value;}
    check(typeof value === 'object', 'Native scene refuses unsupported values.');
    check(!active.has(value), 'Native scene input is cyclic.');
    const prototype = Object.getPrototypeOf(value);
    check(Array.isArray(value) ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, 'Native scene requires plain authored data.');
    active.add(value);
    try {
      const names = Reflect.ownKeys(value);
      if (Array.isArray(value)) {
        check(value.length <= RENDER_NATIVE_SCENE_LIMITS.inputArrayElements && names.length === value.length + 1, 'Native scene requires bounded dense arrays.');
        return Array.from({length: value.length}, (_, index) => {
          const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
          check(descriptor?.enumerable && 'value' in descriptor, 'Native scene refuses array accessors and holes.');
          return copy(descriptor.value, depth + 1);
        });
      }
      check(names.length <= RENDER_NATIVE_SCENE_LIMITS.inputRecordFields, 'Native scene record exceeds its field limit.');
      return Object.fromEntries(names.map(name => {
        const descriptor = Object.getOwnPropertyDescriptor(value, name);
        check(typeof name === 'string' && descriptor?.enumerable && 'value' in descriptor, 'Native scene refuses hidden fields, symbols and accessors.');
        return [name, copy(descriptor.value, depth + 1)];
      }));
    } finally {active.delete(value);}
  };
  return copy(input, 0);
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    if (!Object.isFrozen(value)) Object.freeze(value);
  }
  return value;
}
/** Only called on owned schema data; preserves actual JSON numeric -0. */
function encode(value: unknown, depth = 0): string {
  if (typeof value === 'string' || typeof value === 'boolean' || value === null) return JSON.stringify(value);
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : JSON.stringify(value);
  const pad = '  '.repeat(depth), childPad = pad + '  ';
  if (Array.isArray(value)) return value.length === 0 ? '[]' : '[\n' + value.map(item => childPad + encode(item, depth + 1)).join(',\n') + '\n' + pad + ']';
  const rows = Object.entries(value as Record<string, unknown>);
  return rows.length === 0 ? '{}' : '{\n' + rows.map(([key, item]) => childPad + JSON.stringify(key) + ': ' + encode(item, depth + 1)).join(',\n') + '\n' + pad + '}';
}
function textBudget(text: unknown): asserts text is string {
  if (typeof text !== 'string') throw new RenderEditorError('DOCUMENT_INPUT', 'Native scene file must be text.');
  if (text.length > RENDER_NATIVE_SCENE_LIMITS.fileBytes || bytes(text) > RENDER_NATIVE_SCENE_LIMITS.fileBytes) throw new RenderEditorError('DOCUMENT_BYTES', 'Native scene file exceeds 2097152 UTF-8 bytes.');
}
/** CPU reconstruction only. This does not qualify a posed GPU frame or present a scene. */
export function prepareRenderNativeSceneDocument(input: unknown): RenderNativeScenePreparation {
  try {
    const data = record(copyInput(input), ROOT_KEYS, 'Native scene document');
    check(data.format === 'barocss-render-editor-native-scene', 'This file is not a native scene document.');
    if (data.version !== 0 || data.profile !== 'canonical-native-opaque-scene-v0') throw new RenderEditorError('DOCUMENT_VERSION', 'Unsupported native scene version or profile.');
    check(typeof data.documentId === 'string' && /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(data.documentId), 'Native scene ID requires 1..64 ASCII characters.');
    check(typeof data.title === 'string' && data.title.trim() && [...data.title].length <= 128 && data.title.length <= 256 && bytes(data.title) <= 512, 'Native scene title is empty or exceeds its limit.');
    check(typeof data.revision === 'number' && Number.isInteger(data.revision) && data.revision >= 0 && data.revision <= 2147483647, 'Native scene revision exceeds its integer range.');
    const native = createCadDocument(data.nativeDocument as CadDocumentV1);
    const options = record(data.nativeOptions, ['native', 'basis', 'bodyIds'], 'Native scene options');
    const nativeData = options.native;
    check(nativeData !== null && typeof nativeData === 'object' && !Array.isArray(nativeData), 'Native scene parse options must be a record.');
    const nativeKeys = Object.keys(nativeData);
    check(nativeKeys.length >= 4 && nativeKeys.length <= 5 && nativeKeys.every(key => ['sourceVersion', 'countU', 'countV', 'unitsPerMillimeter', 'curveDisplay'].includes(key)), 'Native scene parse options have unsupported fields.');
    const parsed = nativeData as Record<string, unknown>;
    check(parsed.sourceVersion === 0 && parsed.unitsPerMillimeter === 1, 'Native scene requires original source0 and native millimetres without preview rescaling.');
    // Actual loader validation owns grid, curve options, body selection and projection capacity.
    const nativeOptions = options as unknown as BaroCadDocumentPrimitiveOptionsV2;
    const entries = prepareBaroCadDocumentPrimitiveNativeRefsV2(native, nativeOptions);
    const display = copyRenderNativeSceneDisplay(data.display, entries);
    check(Array.isArray(data.surfaceMaterials) && data.surfaceMaterials.length <= 4, 'Native scene requires 0..4 Surface materials.');
    const bodies = new Set<string>();
    const materials = data.surfaceMaterials.map(value => {
      const item = record(value, ['target', 'material'], 'Native Surface material');
      const target = record(item.target, TARGET_KEYS, 'Native Surface target');
      const entry = entries.find(candidate => candidate.binding.bodyId === target.bodyId);
      check(entry?.kind === 'surface', 'Material target must be a selected original Surface body.');
      const expected = entry.binding;
      check(TARGET_KEYS.every(key => target[key] === expected[key as keyof typeof expected]), 'Material target does not match the current original native document and asset revisions.');
      check(!bodies.has(expected.bodyId) && display.visibleBodyIds.includes(expected.bodyId), 'Material target must be a unique visible selected Surface.');
      bodies.add(expected.bodyId);
      const preparation = prepareRenderMaterialDocument(item.material);
      return freeze({target: target as unknown as RenderNativeSceneSurfaceTarget,
        ref: {modelId: entry.ref.modelId, surfaceId: entry.ref.geometryId}, preparation});
    });
    const document: RenderNativeSceneDocument = freeze({format: 'barocss-render-editor-native-scene', version: 0,
      profile: 'canonical-native-opaque-scene-v0', documentId: data.documentId, title: data.title, revision: data.revision,
      nativeDocument: native.document, nativeOptions, display,
      surfaceMaterials: materials.map(item => ({target: item.target, material: item.preparation.document}))});
    textBudget(encode(document) + '\n');
    return freeze({document, native, entries, materials, stage: 'cpu-prepared', rendererAdmission: 'not-presented'});
  } catch (cause) {
    const error = normalizeRenderEditorError(cause);
    if (error !== cause) Object.defineProperty(error, 'cause', {value: cause, configurable: true});
    throw error;
  }
}
export function validateRenderNativeSceneDocument(input: unknown): RenderNativeSceneDocument {return prepareRenderNativeSceneDocument(input).document;}
export function parseRenderNativeSceneDocument(text: string): RenderNativeSceneDocument {
  textBudget(text);
  let data: unknown;
  try {data = JSON.parse(text);} catch (cause) {const error = normalizeRenderEditorError(cause); Object.defineProperty(error, 'cause', {value: cause, configurable: true}); throw error;}
  return validateRenderNativeSceneDocument(data);
}
export function serializeRenderNativeSceneDocument(document: RenderNativeSceneDocument): string {
  const text = encode(validateRenderNativeSceneDocument(document)) + '\n'; textBudget(text); return text;
}
