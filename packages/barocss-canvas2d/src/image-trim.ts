import { Canvas2DError, copyImageAsset } from './schema.js';
import type { ImageAssetInput } from './schema.js';

export type TrimmedImageAsset = { asset: ImageAssetInput; offsetX: number; offsetY: number };

function invalid(message: string): never { throw new Canvas2DError('INVALID_ASSET', message); }

function input(value: unknown): ImageAssetInput {
  if (value === null || typeof value !== 'object' ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    invalid('trim input must be an ordinary image asset');
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 3 || keys.some(key => key !== 'width' && key !== 'height' && key !== 'pixels')) {
    invalid('trim input needs exactly width, height and pixels');
  }
  const fields = Object.getOwnPropertyDescriptors(value);
  for (const key of ['width', 'height', 'pixels']) {
    if (!fields[key]?.enumerable || !('value' in fields[key])) invalid('trim fields must be enumerable data');
  }
  const width: unknown = fields.width.value, height: unknown = fields.height.value;
  if (typeof width !== 'number' || !Number.isInteger(width) || Object.is(width, -0) || width < 1 || width > 4096 ||
      typeof height !== 'number' || !Number.isInteger(height) || Object.is(height, -0) || height < 1 || height > 4096) {
    invalid('trim dimensions must be integers in 1..4096');
  }
  const pixels: unknown = fields.pixels.value;
  if (!(pixels instanceof Uint8Array) || Object.getPrototypeOf(pixels) !== Uint8Array.prototype ||
      ['buffer', 'byteLength', 'byteOffset', 'length'].some(key =>
        Object.getOwnPropertyDescriptor(pixels, key) !== undefined)) {
    invalid('trim pixels must be an ordinary Uint8Array without metadata overrides');
  }
  if ((typeof SharedArrayBuffer !== 'undefined' && pixels.buffer instanceof SharedArrayBuffer) ||
      pixels.byteLength !== width * height * 4) invalid('trim pixels must be exact non-shared RGBA8');
  if (pixels.byteLength > 1024 * 1024) throw new Canvas2DError('ASSET_LIMIT', 'trim input exceeds 1 MiB');
  return { width, height, pixels };
}

/** Remove alpha-zero borders and report their source-pixel offset. */
export function trimImageAsset(asset: ImageAssetInput): TrimmedImageAsset | null {
  const source = copyImageAsset(input(asset));
  let left = source.width, top = source.height, right = -1, bottom = -1;
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    if (source.pixels[(y * source.width + x) * 4 + 3] > 0) {
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  if (right < 0) return null;
  const width = right - left + 1, height = bottom - top + 1;
  const pixels = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row++) {
    const start = ((top + row) * source.width + left) * 4;
    pixels.set(source.pixels.subarray(start, start + width * 4), row * width * 4);
  }
  return { asset: { width, height, pixels }, offsetX: left, offsetY: top };
}
