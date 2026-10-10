import { Canvas2DError, copyImageAsset } from './schema.js';
import type { ImageAssetInput } from './schema.js';

export type ImageMirrorAxis = 'horizontal' | 'vertical';

function invalid(message: string): never { throw new Canvas2DError('INVALID_ASSET', message); }

function assetInput(value: unknown): ImageAssetInput {
  if (value === null || typeof value !== 'object' ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    invalid('mirror input must be an ordinary image asset');
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 3 || keys.some(key => key !== 'width' && key !== 'height' && key !== 'pixels')) {
    invalid('mirror input needs exactly width, height and pixels');
  }
  const fields = Object.getOwnPropertyDescriptors(value);
  for (const key of ['width', 'height', 'pixels']) {
    if (!fields[key]?.enumerable || !('value' in fields[key])) invalid('mirror input fields must be data');
  }
  const width: unknown = fields.width.value, height: unknown = fields.height.value;
  if (typeof width !== 'number' || !Number.isInteger(width) || Object.is(width, -0) || width < 1 || width > 4096 ||
      typeof height !== 'number' || !Number.isInteger(height) || Object.is(height, -0) || height < 1 || height > 4096) {
    invalid('mirror dimensions must be integers in 1..4096');
  }
  const pixels: unknown = fields.pixels.value;
  if (!(pixels instanceof Uint8Array) || Object.getPrototypeOf(pixels) !== Uint8Array.prototype ||
      ['buffer', 'byteLength', 'byteOffset', 'length'].some(key =>
        Object.getOwnPropertyDescriptor(pixels, key) !== undefined)) {
    invalid('mirror pixels must be an ordinary Uint8Array without metadata overrides');
  }
  if ((typeof SharedArrayBuffer !== 'undefined' && pixels.buffer instanceof SharedArrayBuffer) ||
      pixels.byteLength !== width * height * 4) invalid('mirror pixels must be exact non-shared RGBA8');
  return { width, height, pixels };
}

/** Copy each RGBA pixel through an exact left/right or top/bottom reflection. */
export function mirrorImageAsset(asset: ImageAssetInput, axis: ImageMirrorAxis): ImageAssetInput {
  if (axis !== 'horizontal' && axis !== 'vertical') invalid('mirror axis must be horizontal or vertical');
  const admitted = assetInput(asset);
  if (admitted.pixels.byteLength > 1024 * 1024) {
    throw new Canvas2DError('ASSET_LIMIT', 'mirror input must fit 1 MiB');
  }
  const source = copyImageAsset(admitted);
  const pixels = new Uint8Array(source.pixels.length);
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    const sx = axis === 'horizontal' ? source.width - 1 - x : x;
    const sy = axis === 'vertical' ? source.height - 1 - y : y;
    const from = (sy * source.width + sx) * 4, to = (y * source.width + x) * 4;
    for (let channel = 0; channel < 4; channel++) pixels[to + channel] = source.pixels[from + channel];
  }
  return { width: source.width, height: source.height, pixels };
}
