import { Canvas2DError, copyImageAsset } from './schema.js';
import type { ImageAssetInput, SpriteAlphaMask } from './schema.js';

function invalid(message: string): never { throw new Canvas2DError('INVALID_ASSET', message); }

function assetInput(value: unknown): ImageAssetInput {
  if (value === null || typeof value !== 'object' ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    invalid('image alpha mask input must be an ordinary record');
  }
  const keys = Reflect.ownKeys(value), fields = Object.getOwnPropertyDescriptors(value);
  if (keys.length !== 3 || keys.some(key => key !== 'width' && key !== 'height' && key !== 'pixels')) {
    invalid('image alpha mask input needs exactly width, height and pixels');
  }
  for (const key of ['width', 'height', 'pixels']) {
    if (!fields[key]?.enumerable || !('value' in fields[key])) invalid('image alpha mask fields must be data');
  }
  const width: unknown = fields.width.value, height: unknown = fields.height.value;
  if (typeof width !== 'number' || !Number.isInteger(width) || Object.is(width, -0) || width < 1 || width > 4096 ||
      typeof height !== 'number' || !Number.isInteger(height) || Object.is(height, -0) || height < 1 || height > 4096) {
    invalid('image alpha mask dimensions must be integers in 1..4096');
  }
  const pixels: unknown = fields.pixels.value;
  if (!(pixels instanceof Uint8Array) || Object.getPrototypeOf(pixels) !== Uint8Array.prototype ||
      ['buffer', 'byteLength', 'byteOffset', 'length'].some(key => Object.getOwnPropertyDescriptor(pixels, key) !== undefined)) {
    invalid('image alpha mask pixels must be an ordinary Uint8Array without metadata overrides');
  }
  if ((typeof SharedArrayBuffer !== 'undefined' && pixels.buffer instanceof SharedArrayBuffer) ||
      pixels.byteLength !== width * height * 4) invalid('image alpha mask pixels must be exact non-shared RGBA8');
  return { width, height, pixels };
}

function maskInput(value: unknown): SpriteAlphaMask {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length !== 4) {
    invalid('image alpha mask needs four ordinary values');
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 5 || keys.some(key => key !== 'length' &&
      (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= 4))) {
    invalid('image alpha mask must be dense without extra fields');
  }
  const mask: number[] = [];
  for (let index = 0; index < 4; index++) {
    const field = Object.getOwnPropertyDescriptor(value, String(index)), bound = index === 3 ? 1 : 4;
    if (!field?.enumerable || !('value' in field) || typeof field.value !== 'number' ||
        !Number.isFinite(field.value) || Object.is(field.value, -0) || Math.abs(field.value) > bound) {
      invalid('image alpha mask values exceed the finite range');
    }
    mask.push(field.value);
  }
  return mask as SpriteAlphaMask;
}

/** Bake an encoded RGB alpha factor; preserve all RGB bytes, including hidden RGB. */
export function applyImageAlphaMask(asset: ImageAssetInput, mask: SpriteAlphaMask): ImageAssetInput {
  const admitted = assetInput(asset), values = maskInput(mask);
  if (admitted.pixels.byteLength > 1024 * 1024) {
    throw new Canvas2DError('ASSET_LIMIT', 'image alpha mask input exceeds 1 MiB');
  }
  // Both complete shapes and the budget precede all copied typed payload.
  const source = copyImageAsset(admitted), output = new Uint8Array(source.pixels.length);
  for (let index = 0; index < output.length; index += 4) {
    output[index] = source.pixels[index];
    output[index + 1] = source.pixels[index + 1];
    output[index + 2] = source.pixels[index + 2];
    // Explicit binary64 order, no intermediate byte quantization.
    let value = source.pixels[index] * values[0];
    value += source.pixels[index + 1] * values[1];
    value += source.pixels[index + 2] * values[2];
    value += 255 * values[3];
    output[index + 3] = Math.round((source.pixels[index + 3] * Math.max(0, Math.min(255, value))) / 255);
  }
  return { width: source.width, height: source.height, pixels: output };
}
