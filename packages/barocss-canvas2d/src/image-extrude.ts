import { Canvas2DError, copyImageAsset } from './schema.js';
import type { ImageAssetInput } from './schema.js';

function invalid(message: string): never { throw new Canvas2DError('INVALID_ASSET', message); }

function input(value: unknown): ImageAssetInput {
  if (value === null || typeof value !== 'object' ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    invalid('extrusion input must be an ordinary image asset');
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 3 || keys.some(key => key !== 'width' && key !== 'height' && key !== 'pixels')) {
    invalid('extrusion input needs exactly width, height and pixels');
  }
  const fields = Object.getOwnPropertyDescriptors(value);
  for (const key of ['width', 'height', 'pixels']) {
    if (!fields[key]?.enumerable || !('value' in fields[key])) invalid('extrusion fields must be enumerable data');
  }
  const width: unknown = fields.width.value, height: unknown = fields.height.value;
  if (typeof width !== 'number' || !Number.isInteger(width) || Object.is(width, -0) || width < 1 || width > 4096 ||
      typeof height !== 'number' || !Number.isInteger(height) || Object.is(height, -0) || height < 1 || height > 4096) {
    invalid('extrusion dimensions must be integers in 1..4096');
  }
  const pixels: unknown = fields.pixels.value;
  if (!(pixels instanceof Uint8Array) || Object.getPrototypeOf(pixels) !== Uint8Array.prototype ||
      ['buffer', 'byteLength', 'byteOffset', 'length'].some(key =>
        Object.getOwnPropertyDescriptor(pixels, key) !== undefined)) {
    invalid('extrusion pixels must be an ordinary Uint8Array without metadata overrides');
  }
  if ((typeof SharedArrayBuffer !== 'undefined' && pixels.buffer instanceof SharedArrayBuffer) ||
      pixels.byteLength !== width * height * 4) invalid('extrusion pixels must be exact non-shared RGBA8');
  return { width, height, pixels };
}

/** Add exact copies of the nearest source edge and corner pixels. */
export function extrudeImageAsset(asset: ImageAssetInput, gutter: number): ImageAssetInput {
  const admitted = input(asset);
  if (!Number.isInteger(gutter) || Object.is(gutter, -0) || gutter < 0 || gutter > 64) {
    invalid('extrusion gutter must be an integer in 0..64');
  }
  const width = admitted.width + 2 * gutter, height = admitted.height + 2 * gutter;
  // Both complete input shapes precede budget checks and typed allocations.
  if (admitted.pixels.byteLength > 1024 * 1024 || width > 4096 || height > 4096 || width * height * 4 > 1024 * 1024) {
    throw new Canvas2DError('ASSET_LIMIT', 'extrusion dimensions must fit 4096 and each payload must fit 1 MiB');
  }
  const source = copyImageAsset(admitted), pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sy = Math.max(0, Math.min(source.height - 1, y - gutter));
    for (let x = 0; x < width; x++) {
      const sx = Math.max(0, Math.min(source.width - 1, x - gutter));
      const from = (sy * source.width + sx) * 4, to = (y * width + x) * 4;
      for (let channel = 0; channel < 4; channel++) pixels[to + channel] = source.pixels[from + channel];
    }
  }
  return { width, height, pixels };
}
