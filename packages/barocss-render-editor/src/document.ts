import { compileGpu, validateMeshCamera } from '@barocss/gpu';
import type { MeshCamera, SceneObject1, SourceRange } from '@barocss/gpu';
import { RenderEditorError, normalizeRenderEditorError } from './errors.js';

export const RENDER_EDITOR_LIMITS = Object.freeze({ fileBytes: 262144, sourceBytes: 65536, historyEntries: 32, historyBytes: 4 * 1024 * 1024 });

export interface RenderSceneDocumentV0 {
  readonly format: 'barocss-render-editor';
  readonly version: 0;
  readonly kind: 'gpu-scene';
  readonly documentId: string;
  readonly title: string;
  readonly revision: number;
  readonly sourceVersion: 1;
  readonly sceneSource: string;
  readonly camera: MeshCamera;
}
export interface RenderEditorObjectMetadata {
  readonly id: string;
  readonly type: SceneObject1['type'];
  readonly range: SourceRange | null;
}
export interface RenderEditorMetadata {
  readonly name: string;
  readonly pipeline: 'sdf';
  readonly sourceVersion: 1;
  readonly objects: readonly RenderEditorObjectMetadata[];
}

export function renderEditorUtf8Bytes(text: string): number { return new TextEncoder().encode(text).length; }

function exactRecord(input: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (input === null || typeof input !== 'object' || Object.getPrototypeOf(input) !== Object.prototype) {
    throw new RenderEditorError('DOCUMENT_INPUT', `${label} must be a plain data object`);
  }
  const actual = Reflect.ownKeys(input);
  if (actual.length !== keys.length || actual.some((key) => typeof key !== 'string' || !keys.includes(key))) {
    throw new RenderEditorError('DOCUMENT_INPUT', `${label} has missing or unsupported fields`);
  }
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
      throw new RenderEditorError('DOCUMENT_INPUT', `${label}.${key} must be own enumerable data`);
    }
    result[key] = descriptor.value;
  }
  return result;
}

/** Draft numeric values may be invalid for GPU presentation. Do not read accessors. */
export function copyRenderEditorDraftCamera(input: unknown): MeshCamera {
  const data = exactRecord(input, ['eye', 'target', 'up', 'fovYDegrees', 'near', 'far'], 'Camera');
  const vector = (input: unknown, label: string): [number, number, number] => {
    if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype || input.length !== 3
      || Reflect.ownKeys(input).length !== 4) throw new RenderEditorError('DOCUMENT_INPUT', `${label} must be a dense XYZ array`);
    const result: number[] = [];
    for (let i = 0; i < 3; i++) {
      const descriptor = Object.getOwnPropertyDescriptor(input, String(i));
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable || typeof descriptor.value !== 'number') {
        throw new RenderEditorError('DOCUMENT_INPUT', `${label} must contain own numeric data`);
      }
      result.push(descriptor.value);
    }
    return Object.freeze(result) as unknown as [number, number, number];
  };
  for (const key of ['fovYDegrees', 'near', 'far']) {
    if (typeof data[key] !== 'number') throw new RenderEditorError('DOCUMENT_INPUT', `Camera.${key} must be numeric data`);
  }
  return Object.freeze({ eye: vector(data.eye, 'Camera.eye'), target: vector(data.target, 'Camera.target'),
    up: vector(data.up, 'Camera.up'), fovYDegrees: data.fovYDegrees as number, near: data.near as number, far: data.far as number });
}

export function validateRenderEditorSourceInput(source: unknown): asserts source is string {
  if (typeof source !== 'string') throw new RenderEditorError('DOCUMENT_INPUT', 'Scene source must be a string');
  if (source.length > RENDER_EDITOR_LIMITS.sourceBytes || renderEditorUtf8Bytes(source) > RENDER_EDITOR_LIMITS.sourceBytes) {
    throw new RenderEditorError('DOCUMENT_BYTES', 'Scene source exceeds 65536 UTF-8 bytes');
  }
}

export function compileRenderEditorSource(source: string): RenderEditorMetadata {
  validateRenderEditorSourceInput(source);
  const result = compileGpu({ kind: 'scene', source, sourceVersion: 1 });
  if (!result.ok) throw new RenderEditorError('SOURCE_REFUSED', result.diagnostics[0]?.message ?? 'Scene source refused', result.diagnostics);
  if (result.execution.kind !== 'sdf' || result.execution.scene.version !== 1 || result.ir.pipeline !== 'sdf') {
    throw new RenderEditorError('SOURCE_REFUSED', 'Expected a sourceVersion 1 SDF scene');
  }
  const declarations = result.ast?.declarations.filter((item) => item.kind === 'object') ?? [];
  return Object.freeze({ name: result.ir.name, pipeline: 'sdf', sourceVersion: 1,
    objects: Object.freeze(result.execution.scene.objects.map((object) => {
      const declaration = declarations.find((item) => item.kind === 'object' && item.id.text === `#${object.id}`);
      return Object.freeze({ id: object.id, type: object.type,
        range: declaration ? Object.freeze({ ...declaration.range }) : null });
    })),
  });
}

/** Validate, compile, and return a frozen owned document. Keep source bytes intact. */
export function validateRenderEditorDocument(input: unknown): RenderSceneDocumentV0 {
  const data = exactRecord(input, ['format', 'version', 'kind', 'documentId', 'title', 'revision', 'sourceVersion', 'sceneSource', 'camera'], 'Document');
  if (data.format !== 'barocss-render-editor' || data.version !== 0 || data.kind !== 'gpu-scene' || data.sourceVersion !== 1) {
    throw new RenderEditorError('DOCUMENT_VERSION', 'Only barocss-render-editor version 0 GPU scenes with sourceVersion 1 are supported');
  }
  if (typeof data.documentId !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]{0,47}$/.test(data.documentId)) {
    throw new RenderEditorError('DOCUMENT_INPUT', 'Document ID must be an ASCII identifier of 1..48 characters');
  }
  if (typeof data.title !== 'string' || data.title.length > 256 || [...data.title].length > 128) throw new RenderEditorError('DOCUMENT_INPUT', 'Title must be a string of at most 128 characters');
  if (typeof data.revision !== 'number' || !Number.isInteger(data.revision) || data.revision < 0 || data.revision > 2147483647) {
    throw new RenderEditorError('DOCUMENT_INPUT', 'Revision must be an integer in 0..2147483647');
  }
  validateRenderEditorSourceInput(data.sceneSource);
  let camera: MeshCamera;
  try { camera = validateMeshCamera(data.camera); } catch (error) { throw normalizeRenderEditorError(error); }
  const document: RenderSceneDocumentV0 = Object.freeze({ format: 'barocss-render-editor', version: 0, kind: 'gpu-scene',
    documentId: data.documentId, title: data.title, revision: data.revision, sourceVersion: 1, sceneSource: data.sceneSource, camera });
  if (renderEditorUtf8Bytes(JSON.stringify(document)) > RENDER_EDITOR_LIMITS.fileBytes) {
    throw new RenderEditorError('DOCUMENT_BYTES', 'Document exceeds 262144 UTF-8 bytes');
  }
  compileRenderEditorSource(document.sceneSource);
  return document;
}

export function parseRenderEditorDocument(text: string): RenderSceneDocumentV0 {
  if (typeof text !== 'string') throw new RenderEditorError('DOCUMENT_INPUT', 'Document JSON must be a string');
  if (text.length > RENDER_EDITOR_LIMITS.fileBytes || renderEditorUtf8Bytes(text) > RENDER_EDITOR_LIMITS.fileBytes) {
    throw new RenderEditorError('DOCUMENT_BYTES', 'Document exceeds 262144 UTF-8 bytes');
  }
  let input: unknown;
  try { input = JSON.parse(text); } catch (error) { throw normalizeRenderEditorError(error); }
  return validateRenderEditorDocument(input);
}

export function serializeRenderEditorDocument(document: RenderSceneDocumentV0): string {
  const text = JSON.stringify(validateRenderEditorDocument(document), null, 2) + '\n';
  if (renderEditorUtf8Bytes(text) > RENDER_EDITOR_LIMITS.fileBytes) throw new RenderEditorError('DOCUMENT_BYTES', 'Serialized document exceeds 262144 UTF-8 bytes');
  return text;
}
