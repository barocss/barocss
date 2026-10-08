import { createCanvas2D } from './renderer.js';
import type { Canvas2DOptions, Canvas2DRenderer } from './renderer.js';
import { Canvas2DError, copyImageAsset, parseSceneJSON, stringifySceneJSON,
  validateImageAssetId } from './schema.js';
import type { ImageAssetInput, Scene } from './schema.js';

const FORMAT = 'barocss-canvas-document';
const MAX_FILE_BYTES = 48 * 1024 * 1024;
const MAX_ASSET_BYTES = 32 * 1024 * 1024;
const encoder = new TextEncoder();

export type CanvasDocumentV1 = {
  format: typeof FORMAT; version: 1; scene: string;
  assets: { id: string; width: number; height: number; byteLength: number;
    sha256: string; pixelsBase64: string }[];
};
export type ParsedCanvasDocument = { scene: Scene; assets: Map<string, ImageAssetInput> };
export type StagedCanvasDocument = ParsedCanvasDocument & { renderer: Canvas2DRenderer };
export type CanvasPNGExport = { blob: Blob; logicalSize: Canvas2DOptions['logicalSize'];
  backingSize: { width: number; height: number }; dpr: number };

function fail(code: 'SERIALIZATION' | 'INVALID_ASSET' | 'ASSET_LIMIT' | 'UNSUPPORTED_FEATURE',
  message: string): never { throw new Canvas2DError(code, message); }

function exact(value: unknown, keys: string[], path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype ||
      Reflect.ownKeys(value).length !== keys.length ||
      Reflect.ownKeys(value).some(key => typeof key !== 'string' || !keys.includes(key))) {
    fail('SERIALIZATION', `${path} has unknown or missing fields`);
  }
  return value as Record<string, unknown>;
}

function referencedIds(scene: Scene): string[] {
  const ids = new Set<string>();
  function visit(nodes: Scene['nodes']): void {
    for (const node of nodes) {
      if (node.kind === 'image') ids.add(node.imageId);
      if (node.kind === 'glyphRun') ids.add(node.atlasId);
      if (node.kind === 'group' || node.kind === 'frame') visit(node.children);
    }
  }
  visit(scene.nodes);
  return [...ids].sort();
}

async function digest(pixels: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) fail('UNSUPPORTED_FEATURE', 'SHA-256 is unavailable');
  const input = new Uint8Array(new ArrayBuffer(pixels.byteLength));
  input.set(pixels);
  const hash = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', input.buffer));
  return [...hash].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function encodeBase64(pixels: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < pixels.length; offset += 8192) {
    binary += String.fromCharCode(...pixels.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

function decodeBase64(value: unknown, expectedBytes: number): Uint8Array {
  if (typeof value !== 'string' || value.length !== Math.ceil(expectedBytes / 3) * 4 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    fail('INVALID_ASSET', 'asset base64 is malformed or truncated');
  }
  let binary: string;
  try { binary = atob(value); } catch { fail('INVALID_ASSET', 'asset base64 is invalid'); }
  if (binary.length !== expectedBytes || btoa(binary) !== value) {
    fail('INVALID_ASSET', 'asset base64 is not canonical');
  }
  const pixels = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) pixels[i] = binary.charCodeAt(i);
  return pixels;
}

export async function serializeCanvasDocument(acceptedScene: unknown,
  getAsset: (id: string) => ImageAssetInput | null): Promise<string> {
  if (typeof getAsset !== 'function') fail('SERIALIZATION', 'getAsset must be a function');
  const sceneText = stringifySceneJSON(acceptedScene);
  const scene = parseSceneJSON(sceneText);
  const assets: CanvasDocumentV1['assets'] = [];
  let totalBytes = 0;
  const ids = referencedIds(scene);
  if (ids.length > 16) fail('ASSET_LIMIT', 'document exceeds 16 assets');
  for (const id of ids) {
    const source = getAsset(id);
    if (!source) fail('INVALID_ASSET', `missing referenced asset ${id}`);
    const { width, height, pixels } = copyImageAsset(source);
    totalBytes += pixels.byteLength;
    if (totalBytes > MAX_ASSET_BYTES) fail('ASSET_LIMIT', 'document exceeds 32 MiB of RGBA8 assets');
    assets.push({ id, width, height, byteLength: pixels.byteLength,
      sha256: await digest(pixels), pixelsBase64: encodeBase64(pixels) });
  }
  const text = JSON.stringify({ format: FORMAT, version: 1, scene: sceneText, assets });
  if (encoder.encode(text).length > MAX_FILE_BYTES) fail('ASSET_LIMIT', 'document exceeds 48 MiB');
  return text;
}

export async function parseCanvasDocument(text: string): Promise<ParsedCanvasDocument> {
  if (typeof text !== 'string' || text.length > MAX_FILE_BYTES ||
      encoder.encode(text).length > MAX_FILE_BYTES) fail('SERIALIZATION', 'document exceeds 48 MiB');
  let value: unknown;
  try { value = JSON.parse(text); } catch { fail('SERIALIZATION', 'document is not JSON'); }
  const document = exact(value, ['format', 'version', 'scene', 'assets'], 'document');
  if (document.format !== FORMAT || document.version !== 1 || typeof document.scene !== 'string') {
    fail('SERIALIZATION', 'unsupported document format or version');
  }
  const scene = parseSceneJSON(document.scene);
  if (stringifySceneJSON(scene) !== document.scene) fail('SERIALIZATION', 'scene JSON is not canonical');
  if (!Array.isArray(document.assets) || document.assets.length > 16) {
    fail('ASSET_LIMIT', 'document needs at most 16 assets');
  }
  const ids = referencedIds(scene);
  if (document.assets.length !== ids.length) fail('INVALID_ASSET', 'asset table must match scene references');
  const assets = new Map<string, ImageAssetInput>();
  let totalBytes = 0;
  for (let i = 0; i < document.assets.length; i++) {
    const asset = exact(document.assets[i],
      ['id', 'width', 'height', 'byteLength', 'sha256', 'pixelsBase64'], `assets[${i}]`);
    const id = validateImageAssetId(asset.id);
    if (id !== ids[i]) fail('INVALID_ASSET', 'asset IDs must be unique, sorted and referenced');
    const width = asset.width, height = asset.height, byteLength = asset.byteLength;
    if (!Number.isInteger(width) || !Number.isInteger(height) ||
        (width as number) < 1 || (height as number) < 1 ||
        (width as number) > 4096 || (height as number) > 4096 ||
        byteLength !== (width as number) * (height as number) * 4) {
      fail('INVALID_ASSET', `asset ${id} has invalid dimensions or byte length`);
    }
    totalBytes += byteLength as number;
    if (totalBytes > MAX_ASSET_BYTES) fail('ASSET_LIMIT', 'document exceeds 32 MiB of RGBA8 assets');
    if (typeof asset.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(asset.sha256)) {
      fail('INVALID_ASSET', `asset ${id} has invalid SHA-256`);
    }
    const pixels = decodeBase64(asset.pixelsBase64, byteLength as number);
    if (await digest(pixels) !== asset.sha256) fail('INVALID_ASSET', `asset ${id} SHA-256 mismatch`);
    assets.set(id, { width: width as number, height: height as number, pixels });
  }
  return { scene, assets };
}

function stageParsedDocument(parsed: ParsedCanvasDocument, freshCanvas: HTMLCanvasElement,
  options: Canvas2DOptions): StagedCanvasDocument {
  const renderer = createCanvas2D(freshCanvas, options);
  try {
    for (const [id, asset] of parsed.assets) renderer.setImageAsset(id, asset);
    renderer.updateScene(parsed.scene);
    renderer.render();
    return { ...parsed, renderer };
  } catch (error) {
    renderer.dispose();
    throw error;
  }
}

export async function stageCanvasDocument(text: string, freshCanvas: HTMLCanvasElement,
  options: Canvas2DOptions): Promise<StagedCanvasDocument> {
  return stageParsedDocument(await parseCanvasDocument(text), freshCanvas, options);
}

export async function exportCanvasDocumentPNG(text: string, options: Canvas2DOptions,
  createCanvas: () => HTMLCanvasElement): Promise<CanvasPNGExport> {
  if (typeof createCanvas !== 'function') fail('SERIALIZATION', 'createCanvas must be a function');
  const parsed = await parseCanvasDocument(text);
  let canvas: HTMLCanvasElement;
  try { canvas = createCanvas(); }
  catch { fail('SERIALIZATION', 'canvas creation failed'); }
  if (!canvas || typeof canvas.toBlob !== 'function') {
    fail('UNSUPPORTED_FEATURE', 'HTML canvas PNG encoding is unavailable');
  }
  const staged = stageParsedDocument(parsed, canvas, options);
  try {
    let blob: Blob;
    try {
      blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(value => value ? resolve(value) :
          reject(new Canvas2DError('SERIALIZATION', 'PNG encoding returned no Blob')), 'image/png');
      });
    } catch (error) {
      if (error instanceof Canvas2DError) throw error;
      fail('SERIALIZATION', 'PNG encoding failed');
    }
    if (blob.type !== 'image/png') fail('SERIALIZATION', 'canvas did not encode PNG');
    return { blob, logicalSize: { ...options.logicalSize },
      backingSize: { width: canvas.width, height: canvas.height }, dpr: options.dpr };
  } finally {
    staged.renderer.dispose();
  }
}
