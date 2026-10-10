import {validateRenderParametricSceneDocumentV1} from './parametric-scene-document-v1.js';
import type {RenderParametricSceneDocumentV1} from './parametric-scene-document-v1.js';
import {prepareEngineScene} from '@barocss/gpu';
import type {PreparedEngineScene, EngineSceneMaterialV0, EngineSceneNodeV0, MeshCamera, RGB} from '@barocss/gpu';
import {prepareRenderParametricSourcesV2} from './parametric-scene-source-v2.js';
import type {RenderParametricGeometrySourceV2, RenderPreparedParametricGeometryV2} from './parametric-scene-source-v2.js';
export type {RenderParametricGeometrySourceV2, RenderPreparedParametricGeometryV2} from './parametric-scene-source-v2.js';
import {copyRenderParametricSceneData} from './parametric-scene-data.js';
import {RenderEditorError, normalizeRenderEditorError} from './errors.js';

export const RENDER_PARAMETRIC_SCENE_V2_LIMITS = Object.freeze({fileBytes: 131072, inputValues: 4096,
  inputDepth: 16, inputArrayElements: 32, inputRecordFields: 32, historyEntries: 64, historyBytes: 524288});
/** Original primitive parameters and original scene intent. Generated triangles are not file authority. */
export interface RenderParametricSceneDocumentV2 {
  readonly format: 'barocss-render-editor-parametric-scene';
  readonly version: 2;
  readonly profile: 'primitive-unlit-engine-v2';
  readonly documentId: string;
  readonly title: string;
  readonly revision: number;
  readonly sceneId: string;
  readonly coordinateSystem: 'right-handed-y-up';
  readonly positionUnit: 'scene';
  readonly geometrySources: readonly RenderParametricGeometrySourceV2[];
  readonly camera: MeshCamera;
  readonly background: RGB;
  readonly materials: readonly EngineSceneMaterialV0[];
  readonly nodes: readonly EngineSceneNodeV0[];
}
export interface RenderParametricScenePreparationV2 {
  readonly document: RenderParametricSceneDocumentV2;
  readonly sources: readonly RenderPreparedParametricGeometryV2[];
  /** Regenerated CPU scene with independently owned mutable execution arrays; not a backend token. */
  readonly scene: PreparedEngineScene;
  readonly stage: 'cpu-prepared';
  readonly rendererAdmission: 'not-presented';
}
const ROOT_KEYS = ['format', 'version', 'profile', 'documentId', 'title', 'revision', 'sceneId',
  'coordinateSystem', 'positionUnit', 'geometrySources', 'camera', 'background', 'materials', 'nodes'];
const bytes = (text: string) => new TextEncoder().encode(text).length;
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RenderEditorError('DOCUMENT_INPUT', message);
}
/** Copy only ordinary authored data, without reading caller accessors or accepting execution buffers. */
function copyInput(input: unknown): unknown {
  let count = 0;
  const active = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(++count <= RENDER_PARAMETRIC_SCENE_V2_LIMITS.inputValues && depth <= RENDER_PARAMETRIC_SCENE_V2_LIMITS.inputDepth, 'Parametric scene input exceeds its value or depth limit.');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'string') {check(value.length <= RENDER_PARAMETRIC_SCENE_V2_LIMITS.fileBytes, 'Parametric scene string exceeds its limit.'); return value;}
    if (typeof value === 'number') {check(Number.isFinite(value), 'Parametric scene numbers must be finite.'); return value;}
    check(typeof value === 'object' && !active.has(value), 'Parametric scene refuses unsupported or cyclic values.');
    const prototype = Object.getPrototypeOf(value);
    check(Array.isArray(value) ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, 'Parametric scene requires plain authored data.');
    active.add(value);
    try {
      const names = Reflect.ownKeys(value);
      if (Array.isArray(value)) {
        check(value.length <= RENDER_PARAMETRIC_SCENE_V2_LIMITS.inputArrayElements && names.length === value.length + 1, 'Parametric scene requires bounded dense arrays.');
        return Array.from({length: value.length}, (_, index) => {
          const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
          check(descriptor?.enumerable && 'value' in descriptor, 'Parametric scene refuses array holes and accessors.');
          return copy(descriptor.value, depth + 1);
        });
      }
      check(names.length <= RENDER_PARAMETRIC_SCENE_V2_LIMITS.inputRecordFields, 'Parametric scene record exceeds its field limit.');
      return Object.fromEntries(names.map(name => {
        const descriptor = Object.getOwnPropertyDescriptor(value, name);
        check(typeof name === 'string' && descriptor?.enumerable && 'value' in descriptor, 'Parametric scene refuses symbols, hidden fields and accessors.');
        return [name, copy(descriptor.value, depth + 1)];
      }));
    } finally {active.delete(value);}
  };
  return copy(input, 0);
}
/** Authored document contains no typed arrays. Do not call this on generated preparation data. */
function freezeDocument<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeDocument(child);
    if (!Object.isFrozen(value)) Object.freeze(value);
  }
  return value;
}
function encode(value: unknown, depth = 0): string {
  if (typeof value === 'string' || typeof value === 'boolean' || value === null) return JSON.stringify(value);
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : JSON.stringify(value);
  const pad = '  '.repeat(depth), childPad = pad + '  ';
  if (Array.isArray(value)) return value.length === 0 ? '[]' : '[\n' + value.map(item => childPad + encode(item, depth + 1)).join(',\n') + '\n' + pad + ']';
  const rows = Object.entries(value as Record<string, unknown>);
  return rows.length === 0 ? '{}' : '{\n' + rows.map(([key, item]) => childPad + JSON.stringify(key) + ': ' + encode(item, depth + 1)).join(',\n') + '\n' + pad + '}';
}
function textBudget(text: unknown): asserts text is string {
  if (typeof text !== 'string') throw new RenderEditorError('DOCUMENT_INPUT', 'Parametric scene file must be text.');
  if (text.length > RENDER_PARAMETRIC_SCENE_V2_LIMITS.fileBytes || bytes(text) > RENDER_PARAMETRIC_SCENE_V2_LIMITS.fileBytes) throw new RenderEditorError('DOCUMENT_BYTES', 'Parametric scene file exceeds 131072 UTF-8 bytes.');
}
/** Reconstruct through existing public primitive factories and EngineScene CPU providers. No presentation occurs. */
export function prepareRenderParametricSceneDocumentV2(input: unknown): RenderParametricScenePreparationV2 {
  try {
    const copied = copyInput(input);
    check(copied !== null && typeof copied === 'object' && !Array.isArray(copied), 'Parametric scene document must be a record.');
    const data = copied as Record<string, unknown>, keys = Object.keys(data);
    check(keys.length === ROOT_KEYS.length && keys.every(key => ROOT_KEYS.includes(key)), 'Parametric scene document has missing or unsupported fields.');
    check(data.format === 'barocss-render-editor-parametric-scene', 'This file is not a parametric scene document.');
    if (data.version !== 2 || data.profile !== 'primitive-unlit-engine-v2' || data.coordinateSystem !== 'right-handed-y-up' || data.positionUnit !== 'scene') throw new RenderEditorError('DOCUMENT_VERSION', 'Unsupported parametric scene profile, frame or units.');
    check(typeof data.documentId === 'string' && /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(data.documentId), 'Parametric document ID requires 1..64 ASCII characters.');
    check(typeof data.title === 'string' && data.title.trim() && [...data.title].length <= 128 && data.title.length <= 256 && bytes(data.title) <= 512, 'Parametric scene title is empty or exceeds its limit.');
    check(typeof data.revision === 'number' && Number.isInteger(data.revision) && data.revision >= 0 && data.revision <= 2147483647, 'Parametric scene revision exceeds its integer range.');
    check(typeof data.sceneId === 'string' && /^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/.test(data.sceneId), 'Engine scene ID requires 1..64 ASCII characters.');
    check(Array.isArray(data.geometrySources) && data.geometrySources.length >= 1 && data.geometrySources.length <= 4, 'Parametric scene requires 1..4 original primitive sources.');
    const sources = prepareRenderParametricSourcesV2(data.geometrySources);
    check(new Set(sources.map(source => source.source.id)).size === sources.length, 'Original primitive source IDs must be unique.');
    const original = copyRenderParametricSceneData({camera: data.camera, background: data.background, materials: data.materials, nodes: data.nodes});
    const scene = prepareEngineScene({format: 'barocss-gpu-engine-scene', version: 0, id: data.sceneId,
      coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', ...original,
      geometries: sources.map(source => source.prepared.geometry)});
    // Retain author values, not a provider's derived canonical quaternion or triangle cache.
    const document: RenderParametricSceneDocumentV2 = freezeDocument({format: 'barocss-render-editor-parametric-scene', version: 2,
      profile: 'primitive-unlit-engine-v2', documentId: data.documentId, title: data.title, revision: data.revision,
      sceneId: data.sceneId, coordinateSystem: 'right-handed-y-up', positionUnit: 'scene',
      geometrySources: sources.map(source => source.source), ...original});
    textBudget(encode(document) + '\n');
    return Object.freeze({document, sources: Object.freeze(sources), scene, stage: 'cpu-prepared', rendererAdmission: 'not-presented'});
  } catch (cause) {
    const error = normalizeRenderEditorError(cause);
    if (error !== cause) Object.defineProperty(error, 'cause', {value: cause, configurable: true});
    throw error;
  }
}
export function validateRenderParametricSceneDocumentV2(input: unknown): RenderParametricSceneDocumentV2 {return prepareRenderParametricSceneDocumentV2(input).document;}
export function parseRenderParametricSceneDocumentV2(text: string): RenderParametricSceneDocumentV2 {
  textBudget(text);
  let data: unknown;
  try {data = JSON.parse(text);} catch (cause) {const error = normalizeRenderEditorError(cause); Object.defineProperty(error, 'cause', {value: cause, configurable: true}); throw error;}
  return validateRenderParametricSceneDocumentV2(data);
}
export function serializeRenderParametricSceneDocumentV2(document: RenderParametricSceneDocumentV2): string {
  const text = encode(validateRenderParametricSceneDocumentV2(document)) + '\n'; textBudget(text); return text;
}

/** Explicit V1 conversion only. No V0 document is implicitly upgraded. */
export function upgradeRenderParametricSceneDocumentV1ToV2(input: RenderParametricSceneDocumentV1): RenderParametricSceneDocumentV2 {
  const original = validateRenderParametricSceneDocumentV1(input);
  return validateRenderParametricSceneDocumentV2({...original, version: 2, profile: 'primitive-unlit-engine-v2'});
}
