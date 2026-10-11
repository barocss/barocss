import { Canvas2DError, copyImageAsset } from './schema.js';
import type { ImageAssetInput } from './schema.js';

export type ImageRGBKey = [number, number, number];

function invalid(message: string): never { throw new Canvas2DError('INVALID_ASSET', message); }

function assetInput(value: unknown): ImageAssetInput {
  if (value === null || typeof value !== 'object' ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    invalid('image color key input must be an ordinary record');
  }
  const keys = Reflect.ownKeys(value), fields = Object.getOwnPropertyDescriptors(value);
  if (keys.length !== 3 || keys.some(key => key !== 'width' && key !== 'height' && key !== 'pixels')) {
    invalid('image color key input needs exactly width, height and pixels');
  }
  for (const key of ['width', 'height', 'pixels']) {
    if (!fields[key]?.enumerable || !('value' in fields[key])) invalid('image color key fields must be data');
  }
  const width: unknown = fields.width.value, height: unknown = fields.height.value;
  if (typeof width !== 'number' || !Number.isInteger(width) || Object.is(width, -0) || width < 1 || width > 4096 ||
      typeof height !== 'number' || !Number.isInteger(height) || Object.is(height, -0) || height < 1 || height > 4096) {
    invalid('image color key dimensions must be integers in 1..4096');
  }
  const pixels: unknown = fields.pixels.value;
  if (!(pixels instanceof Uint8Array) || Object.getPrototypeOf(pixels) !== Uint8Array.prototype ||
      ['buffer', 'byteLength', 'byteOffset', 'length'].some(key => Object.getOwnPropertyDescriptor(pixels, key) !== undefined)) {
    invalid('image color key pixels must be an ordinary Uint8Array without metadata overrides');
  }
  if ((typeof SharedArrayBuffer !== 'undefined' && pixels.buffer instanceof SharedArrayBuffer) ||
      pixels.byteLength !== width * height * 4) invalid('image color key pixels must be exact non-shared RGBA8');
  return { width, height, pixels };
}

function byte(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || Object.is(value, -0) || value < 0 || value > 255) {
    invalid('image color key values must be integer bytes in 0..255');
  }
  return value;
}
function keyInput(value: unknown): ImageRGBKey {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) invalid('image color key needs an ordinary RGB tuple');
  const length = Object.getOwnPropertyDescriptor(value, 'length');
  if (!length || !('value' in length) || length.value !== 3) invalid('image color key needs exactly three channels');
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 4 || keys.some(key => key !== 'length' && key !== '0' && key !== '1' && key !== '2')) {
    invalid('image color key tuple must be dense without extra fields');
  }
  const channels: number[] = [];
  for (let i = 0; i < 3; i++) {
    const field = Object.getOwnPropertyDescriptor(value, String(i));
    if (!field?.enumerable || !('value' in field)) invalid('image color key channels must be data');
    channels.push(byte(field.value));
  }
  return channels as ImageRGBKey;
}

/** Clear matched encoded RGB alpha; preserve every RGB and all nonmatched alpha bytes. */
export function applyImageColorKey(asset: ImageAssetInput, key: ImageRGBKey, tolerance: number): ImageAssetInput {
  const input = assetInput(asset), rgb = keyInput(key), limit = byte(tolerance);
  if (input.pixels.byteLength > 1024 * 1024) throw new Canvas2DError('ASSET_LIMIT', 'image color key input exceeds 1 MiB');
  const source = copyImageAsset(input), pixels = new Uint8Array(source.pixels);
  for (let i = 0; i < pixels.length; i += 4) {
    const distance = Math.max(Math.abs(source.pixels[i] - rgb[0]), Math.abs(source.pixels[i + 1] - rgb[1]), Math.abs(source.pixels[i + 2] - rgb[2]));
    if (distance <= limit) pixels[i + 3] = 0;
  }
  return { width: source.width, height: source.height, pixels };
}
