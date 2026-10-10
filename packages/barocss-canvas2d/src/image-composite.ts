import { Canvas2DError, copyImageAsset } from './schema.js';
import type { ImageAssetInput } from './schema.js';

function invalid(message: string): never { throw new Canvas2DError('INVALID_ASSET', message); }

function assetInput(value: unknown): ImageAssetInput {
  if (value === null || typeof value !== 'object' ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    invalid('composite input must be an ordinary image asset');
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 3 || keys.some(key => key !== 'width' && key !== 'height' && key !== 'pixels')) {
    invalid('composite input needs exactly width, height and pixels');
  }
  const fields = Object.getOwnPropertyDescriptors(value);
  for (const key of ['width', 'height', 'pixels']) {
    if (!fields[key]?.enumerable || !('value' in fields[key])) invalid('composite input fields must be data');
  }
  const width: unknown = fields.width.value, height: unknown = fields.height.value;
  if (typeof width !== 'number' || !Number.isInteger(width) || width < 1 || width > 4096 ||
      typeof height !== 'number' || !Number.isInteger(height) || height < 1 || height > 4096) {
    invalid('composite dimensions must be integers in 1..4096');
  }
  const pixels: unknown = fields.pixels.value;
  if (!(pixels instanceof Uint8Array) || Object.getPrototypeOf(pixels) !== Uint8Array.prototype ||
      ['buffer', 'byteLength', 'byteOffset', 'length'].some(key =>
        Object.getOwnPropertyDescriptor(pixels, key) !== undefined)) {
    invalid('composite pixels must be an ordinary Uint8Array without metadata overrides');
  }
  if ((typeof SharedArrayBuffer !== 'undefined' && pixels.buffer instanceof SharedArrayBuffer) ||
      pixels.byteLength !== width * height * 4) invalid('composite pixels must be exact non-shared RGBA8');
  return { width, height, pixels };
}

function roundedRatio(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

/** Copy encoded straight RGBA8 foreground source-over a same-size background. */
export function compositeImageAssets(background: ImageAssetInput, foreground: ImageAssetInput): ImageAssetInput {
  // Admit both complete inputs and their relationship before any typed pixel copy.
  const back = assetInput(background), front = assetInput(foreground);
  if (back.width !== front.width || back.height !== front.height) {
    invalid('composite inputs must have the same dimensions');
  }
  if (back.pixels.byteLength > 1024 * 1024 || front.pixels.byteLength > 1024 * 1024) {
    throw new Canvas2DError('ASSET_LIMIT', 'each composite input must fit 1 MiB');
  }
  const b = copyImageAsset(back), f = copyImageAsset(front);
  const pixels = new Uint8Array(b.pixels.length);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const fa = f.pixels[offset + 3], ba = b.pixels[offset + 3];
    const alpha = fa * 255 + ba * (255 - fa);
    if (alpha === 0) continue;
    pixels[offset + 3] = roundedRatio(alpha, 255);
    for (let channel = 0; channel < 3; channel++) {
      const color = f.pixels[offset + channel] * fa * 255 +
        b.pixels[offset + channel] * ba * (255 - fa);
      pixels[offset + channel] = roundedRatio(color, alpha);
    }
  }
  return { width: b.width, height: b.height, pixels };
}
