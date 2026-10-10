import { Canvas2DError, copyImageAsset } from './schema.js';
import type { ImageAssetInput } from './schema.js';
import { createSpriteAtlas } from './sprite-atlas.js';
import type { SpriteAtlas, SpriteAtlasEntry } from './sprite-atlas.js';

export type SpriteAtlasImage = Readonly<{ name: string; asset: ImageAssetInput; durationMS: number }>;
export type PackedSpriteAtlas = Readonly<{ asset: ImageAssetInput; atlas: SpriteAtlas }>;

function invalid(message: string): never { throw new Canvas2DError('INVALID_ASSET', message); }
function limit(message: string): never { throw new Canvas2DError('ASSET_LIMIT', message); }
function data(value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    invalid('atlas packing input must be an ordinary record');
  }
  const keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
  if (keys.length !== fields.length || keys.some(key => typeof key !== 'string' || !fields.includes(key))) {
    invalid('atlas packing input has unknown or missing fields');
  }
  const result: Record<string, unknown> = {};
  for (const key of fields) {
    const field = descriptors[key];
    if (!field?.enumerable || !('value' in field)) invalid('atlas packing input needs data fields');
    result[key] = field.value;
  }
  return result;
}
function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || Object.is(value, -0) ||
      value < min || value > max) invalid('atlas packing integer is outside its range');
  return value;
}
function id(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value)) {
    invalid('atlas packing ID is invalid');
  }
  return value;
}
function assetInput(value: unknown): ImageAssetInput {
  const raw = data(value, ['width', 'height', 'pixels']);
  const width = integer(raw.width, 1, 4096), height = integer(raw.height, 1, 4096), pixels = raw.pixels;
  if (!(pixels instanceof Uint8Array) || Object.getPrototypeOf(pixels) !== Uint8Array.prototype ||
      ['buffer', 'byteLength', 'byteOffset', 'length'].some(key =>
        Object.getOwnPropertyDescriptor(pixels, key) !== undefined)) {
    invalid('atlas packing pixels need an ordinary Uint8Array without metadata overrides');
  }
  if ((typeof SharedArrayBuffer !== 'undefined' && pixels.buffer instanceof SharedArrayBuffer) ||
      pixels.byteLength !== width * height * 4) invalid('atlas packing pixels need exact non-shared RGBA8');
  return { width, height, pixels };
}

/** Pack caller-order images on shelves without rotation, padding or resampling. */
export function packSpriteAtlas(
  imageId: string, images: readonly SpriteAtlasImage[], maxWidth: number,
): PackedSpriteAtlas {
  const assetId = id(imageId), maximumWidth = integer(maxWidth, 1, 1024);
  if (!Array.isArray(images) || Object.getPrototypeOf(images) !== Array.prototype || images.length < 1) {
    invalid('atlas packing needs a nonempty ordinary array');
  }
  if (images.length > 16) limit('atlas packing exceeds sixteen images');
  const keys = Reflect.ownKeys(images);
  if (keys.length !== images.length + 1 || keys.some(key => key !== 'length' &&
      (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= images.length))) {
    invalid('atlas packing images must be dense without extra fields');
  }
  const sources: ImageAssetInput[] = [], entries: SpriteAtlasEntry[] = [], names = new Set<string>();
  let x = 0, y = 0, rowHeight = 0, width = 0, bytes = 0;
  for (let index = 0; index < images.length; index++) {
    const field = Object.getOwnPropertyDescriptor(images, String(index));
    if (!field?.enumerable || !('value' in field)) invalid('atlas packing images need data items');
    const raw = data(field.value, ['name', 'asset', 'durationMS']);
    const name = id(raw.name), durationMS = integer(raw.durationMS, 1, 60_000);
    if (names.has(name)) invalid('atlas packing frame name is duplicated');
    names.add(name);
    const asset = assetInput(raw.asset);
    bytes += asset.pixels.byteLength;
    if (bytes > 1024 * 1024) limit('atlas packing input exceeds 1 MiB');
    if (asset.width > maximumWidth) limit('atlas packing image exceeds row width');
    if (x + asset.width > maximumWidth) { y += rowHeight; x = 0; rowHeight = 0; }
    entries.push({ name, durationMS, sourceRect: { x, y, width: asset.width, height: asset.height } });
    sources.push(asset); x += asset.width; width = Math.max(width, x);
    rowHeight = Math.max(rowHeight, asset.height);
  }
  const height = y + rowHeight;
  if (height > 1024 || width * height * 4 > 1024 * 1024) limit('atlas packing output exceeds its budget');
  const atlas = createSpriteAtlas(assetId, { width, height }, entries);
  // No pixel allocation occurs until the complete plan and catalog are admitted.
  const copied = sources.map(source => copyImageAsset(source));
  const pixels = new Uint8Array(width * height * 4);
  for (let index = 0; index < copied.length; index++) {
    const source = copied[index], crop = entries[index].sourceRect;
    for (let row = 0; row < source.height; row++) {
      const start = row * source.width * 4;
      pixels.set(source.pixels.subarray(start, start + source.width * 4),
        ((crop.y + row) * width + crop.x) * 4);
    }
  }
  return Object.freeze({ asset: { width, height, pixels }, atlas });
}
