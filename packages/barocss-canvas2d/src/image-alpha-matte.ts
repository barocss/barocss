import { Canvas2DError, copyImageAsset } from './schema.js';
import type { ImageAssetInput } from './schema.js';

function invalid(message: string): never { throw new Canvas2DError('INVALID_ASSET', message); }

function assetInput(value: unknown): ImageAssetInput {
  if (value === null || typeof value !== 'object' ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    invalid('alpha matte input must be an ordinary image asset');
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 3 || keys.some(key => key !== 'width' && key !== 'height' && key !== 'pixels')) {
    invalid('alpha matte input needs exactly width, height and pixels');
  }
  const fields = Object.getOwnPropertyDescriptors(value);
  for (const key of ['width', 'height', 'pixels']) {
    if (!fields[key]?.enumerable || !('value' in fields[key])) invalid('alpha matte input fields must be data');
  }
  const width: unknown = fields.width.value, height: unknown = fields.height.value;
  if (typeof width !== 'number' || !Number.isInteger(width) || Object.is(width, -0) || width < 1 || width > 4096 ||
      typeof height !== 'number' || !Number.isInteger(height) || Object.is(height, -0) || height < 1 || height > 4096) {
    invalid('alpha matte dimensions must be integers in 1..4096');
  }
  const pixels: unknown = fields.pixels.value;
  if (!(pixels instanceof Uint8Array) || Object.getPrototypeOf(pixels) !== Uint8Array.prototype ||
      ['buffer', 'byteLength', 'byteOffset', 'length'].some(key =>
        Object.getOwnPropertyDescriptor(pixels, key) !== undefined)) {
    invalid('alpha matte pixels must be an ordinary Uint8Array without metadata overrides');
  }
  if ((typeof SharedArrayBuffer !== 'undefined' && pixels.buffer instanceof SharedArrayBuffer) ||
      pixels.byteLength !== width * height * 4) invalid('alpha matte pixels must be exact non-shared RGBA8');
  return { width, height, pixels };
}

/** Copy source RGB and multiply its alpha by a same-size independent matte alpha. */
export function applyImageAlphaMatte(source: ImageAssetInput, matte: ImageAssetInput): ImageAssetInput {
  // Both complete inputs and equal extent precede budgets and typed pixel copies.
  const input = assetInput(source), mask = assetInput(matte);
  if (input.width !== mask.width || input.height !== mask.height) {
    invalid('alpha matte inputs must have the same dimensions');
  }
  if (input.pixels.byteLength > 1024 * 1024 || mask.pixels.byteLength > 1024 * 1024) {
    throw new Canvas2DError('ASSET_LIMIT', 'each alpha matte input must fit 1 MiB');
  }
  const s = copyImageAsset(input), m = copyImageAsset(mask);
  const pixels = new Uint8Array(s.pixels.length);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = s.pixels[offset];
    pixels[offset + 1] = s.pixels[offset + 1];
    pixels[offset + 2] = s.pixels[offset + 2];
    // Exact integer nearest rounding; denominator255 has no half-way tie.
    pixels[offset + 3] = Math.floor((s.pixels[offset + 3] * m.pixels[offset + 3] + 127) / 255);
  }
  return { width: s.width, height: s.height, pixels };
}
