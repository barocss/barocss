import { validateMeshCamera } from '@barocss/gpu';
import type { MeshCamera } from '@barocss/gpu';

export const RENDER_MIXED_DOCUMENT_LIMITS = Object.freeze({
  fileBytes: 524288,
  sourceBytes: 65536,
  sourceCodeUnits: 65536,
  sampleMin: 2,
  sampleMax: 17,
});

export type RenderMixedDocumentErrorCode = 'INPUT' | 'VERSION' | 'BYTES' | 'SOURCE' | 'QUALIFICATION' | 'NATIVE' | 'GPU';

/** Retain the original provider error or diagnostic result as the cause. */
export class RenderMixedDocumentError extends Error {
  readonly code: RenderMixedDocumentErrorCode;
  constructor(code: RenderMixedDocumentErrorCode, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'RenderMixedDocumentError';
    this.code = code;
  }
}

export interface RenderMixedDocumentAssetV1 {
  readonly assetId: string;
  /** Declared source association, not a historical content certificate. */
  readonly revision: number;
  readonly sourceVersion: 0;
  readonly source: string;
  readonly modelId: string;
  readonly surfaceId: string;
}

export interface RenderMixedDocumentDisplayV1 {
  readonly mmToSceneUnit: number;
  readonly translate: readonly [number, number, number];
  readonly color: readonly [number, number, number];
  readonly countU: number;
  readonly countV: number;
}

export interface RenderMixedDocumentV1 {
  readonly format: 'barocss-render-editor';
  readonly version: 1;
  readonly kind: 'mixed-depth';
  readonly documentId: string;
  readonly title: string;
  readonly revision: number;
  readonly profile: 'sdf-sphere-native-surface-v0';
  readonly sourceVersion: 1;
  readonly sceneSource: string;
  readonly camera: MeshCamera;
  readonly asset: RenderMixedDocumentAssetV1;
  readonly display: RenderMixedDocumentDisplayV1;
}

function bytes(text: string): number { return new TextEncoder().encode(text).length; }

function exactRecord(input: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (input === null || typeof input !== 'object' || Object.getPrototypeOf(input) !== Object.prototype) {
    throw new RenderMixedDocumentError('INPUT', `${label} must be a plain data object`);
  }
  const actual = Reflect.ownKeys(input);
  if (actual.length !== keys.length || actual.some((key) => typeof key !== 'string' || !keys.includes(key))) {
    throw new RenderMixedDocumentError('INPUT', `${label} has missing or unsupported fields`);
  }
  const data: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
      throw new RenderMixedDocumentError('INPUT', `${label}.${key} must be own enumerable data`);
    }
    data[key] = descriptor.value;
  }
  return data;
}

function identifier(input: unknown, max: 48 | 128, label: string): string {
  const pattern = max === 48 ? /^[A-Za-z_][A-Za-z0-9_-]{0,47}$/ : /^[A-Za-z_][A-Za-z0-9_.:-]{0,127}$/;
  if (typeof input !== 'string' || !pattern.test(input)) {
    throw new RenderMixedDocumentError('INPUT', `${label} must be an ASCII identifier of 1..${max} characters`);
  }
  return input;
}

function revision(input: unknown, label: string): number {
  if (typeof input !== 'number' || !Number.isInteger(input) || input < 0 || input > 2147483647) {
    throw new RenderMixedDocumentError('INPUT', `${label} must be an integer in 0..2147483647`);
  }
  return input;
}

function source(input: unknown, label: string, nonempty: boolean): string {
  if (typeof input !== 'string' || (nonempty && input.length === 0)) {
    throw new RenderMixedDocumentError('INPUT', `${label} must be ${nonempty ? 'a nonempty' : 'a'} string`);
  }
  if (input.length > RENDER_MIXED_DOCUMENT_LIMITS.sourceCodeUnits || bytes(input) > RENDER_MIXED_DOCUMENT_LIMITS.sourceBytes) {
    throw new RenderMixedDocumentError('BYTES', `${label} exceeds 65536 UTF-8 bytes or code units`);
  }
  return input;
}

function vector(input: unknown, label: string, min: number, max: number): readonly [number, number, number] {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) {
    throw new RenderMixedDocumentError('INPUT', `${label} must be a dense plain XYZ array`);
  }
  const length = Object.getOwnPropertyDescriptor(input, 'length');
  if (!length || !('value' in length) || length.value !== 3 || Reflect.ownKeys(input).length !== 4) {
    throw new RenderMixedDocumentError('INPUT', `${label} must have exactly three own numeric elements`);
  }
  const result: number[] = [];
  for (let i = 0; i < 3; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(i));
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable || typeof descriptor.value !== 'number'
      || !Number.isFinite(descriptor.value) || descriptor.value < min || descriptor.value > max) {
      throw new RenderMixedDocumentError('INPUT', `${label} must contain finite data in ${min}..${max}`);
    }
    result.push(descriptor.value);
  }
  return Object.freeze(result) as unknown as readonly [number, number, number];
}

function count(input: unknown, label: string): number {
  if (typeof input !== 'number' || !Number.isInteger(input)
    || input < RENDER_MIXED_DOCUMENT_LIMITS.sampleMin || input > RENDER_MIXED_DOCUMENT_LIMITS.sampleMax) {
    throw new RenderMixedDocumentError('INPUT', `${label} must be an integer in 2..17`);
  }
  return input;
}

/** Encode owned data directly. A numeric -0 stays a real JSON numeric literal. */
function encode(value: unknown, depth = 0, pretty = false): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : JSON.stringify(value);
  const pad = pretty ? '  '.repeat(depth) : '', childPad = pretty ? `${pad}  ` : '';
  const newline = pretty ? '\n' : '', separator = pretty ? ',\n' : ',';
  if (Array.isArray(value)) {
    const items = value.map((item) => childPad + encode(item, depth + 1, pretty));
    return `[${newline}${items.join(separator)}${newline}${pad}]`;
  }
  // Called only on schema-owned copied records and provider-owned camera data.
  if (value !== null && typeof value === 'object') {
    const items = Object.entries(value).map(([key, item]) => `${childPad}${JSON.stringify(key)}:${pretty ? ' ' : ''}${encode(item, depth + 1, pretty)}`);
    return `{${newline}${items.join(separator)}${newline}${pad}}`;
  }
  throw new RenderMixedDocumentError('INPUT', 'Unsupported copied document data');
}

/** Schema, source-byte and camera validation only. Does not compile CAD or SDF. */
export function copyRenderMixedDocument(input: unknown): RenderMixedDocumentV1 {
  const data = exactRecord(input, ['format', 'version', 'kind', 'documentId', 'title', 'revision', 'profile',
    'sourceVersion', 'sceneSource', 'camera', 'asset', 'display'], 'Document');
  if (data.format !== 'barocss-render-editor' || data.version !== 1 || data.kind !== 'mixed-depth'
    || data.profile !== 'sdf-sphere-native-surface-v0' || data.sourceVersion !== 1) {
    throw new RenderMixedDocumentError('VERSION', 'Only version 1 mixed-depth documents with the sdf-sphere-native-surface-v0 profile and scene sourceVersion 1 are supported');
  }
  if (typeof data.title !== 'string' || data.title.length > 256 || [...data.title].length > 128) {
    throw new RenderMixedDocumentError('INPUT', 'Title must be a string of at most 128 code points');
  }
  const assetData = exactRecord(data.asset, ['assetId', 'revision', 'sourceVersion', 'source', 'modelId', 'surfaceId'], 'Asset');
  if (assetData.sourceVersion !== 0) throw new RenderMixedDocumentError('VERSION', 'Native asset sourceVersion must be 0');
  const asset: RenderMixedDocumentAssetV1 = Object.freeze({
    assetId: identifier(assetData.assetId, 48, 'Asset.assetId'), revision: revision(assetData.revision, 'Asset.revision'),
    sourceVersion: 0, source: source(assetData.source, 'Asset.source', true),
    modelId: identifier(assetData.modelId, 128, 'Asset.modelId'), surfaceId: identifier(assetData.surfaceId, 128, 'Asset.surfaceId'),
  });
  const displayData = exactRecord(data.display, ['mmToSceneUnit', 'translate', 'color', 'countU', 'countV'], 'Display');
  if (typeof displayData.mmToSceneUnit !== 'number' || !Number.isFinite(displayData.mmToSceneUnit) || displayData.mmToSceneUnit <= 0) {
    throw new RenderMixedDocumentError('INPUT', 'Display.mmToSceneUnit must be finite and positive');
  }
  const display: RenderMixedDocumentDisplayV1 = Object.freeze({ mmToSceneUnit: displayData.mmToSceneUnit,
    translate: vector(displayData.translate, 'Display.translate', -1000, 1000), color: vector(displayData.color, 'Display.color', 0, 1),
    countU: count(displayData.countU, 'Display.countU'), countV: count(displayData.countV, 'Display.countV') });
  let camera: MeshCamera;
  try { camera = validateMeshCamera(data.camera); }
  catch (cause) { throw new RenderMixedDocumentError('INPUT', 'Camera refused by validateMeshCamera', cause); }
  const document: RenderMixedDocumentV1 = Object.freeze({ format: 'barocss-render-editor', version: 1, kind: 'mixed-depth',
    documentId: identifier(data.documentId, 48, 'Document.documentId'), title: data.title,
    revision: revision(data.revision, 'Document.revision'), profile: 'sdf-sphere-native-surface-v0', sourceVersion: 1,
    sceneSource: source(data.sceneSource, 'Document.sceneSource', false), camera, asset, display });
  if (bytes(encode(document)) > RENDER_MIXED_DOCUMENT_LIMITS.fileBytes) {
    throw new RenderMixedDocumentError('BYTES', 'Document exceeds 524288 serialized UTF-8 bytes');
  }
  return document;
}

export function parseRenderMixedDocument(text: string): RenderMixedDocumentV1 {
  if (typeof text !== 'string') throw new RenderMixedDocumentError('INPUT', 'Document JSON must be a string');
  if (text.length > RENDER_MIXED_DOCUMENT_LIMITS.fileBytes || bytes(text) > RENDER_MIXED_DOCUMENT_LIMITS.fileBytes) {
    throw new RenderMixedDocumentError('BYTES', 'Document file exceeds 524288 UTF-8 bytes');
  }
  let input: unknown;
  try { input = JSON.parse(text); }
  catch (cause) { throw new RenderMixedDocumentError('INPUT', 'Document JSON is invalid', cause); }
  return copyRenderMixedDocument(input);
}

export function serializeRenderMixedDocument(document: RenderMixedDocumentV1): string {
  const text = encode(copyRenderMixedDocument(document), 0, true) + '\n';
  if (bytes(text) > RENDER_MIXED_DOCUMENT_LIMITS.fileBytes) {
    throw new RenderMixedDocumentError('BYTES', 'Document exceeds 524288 serialized UTF-8 bytes');
  }
  return text;
}
