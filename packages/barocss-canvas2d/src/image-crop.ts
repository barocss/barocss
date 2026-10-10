import { Canvas2DError, copyImageAsset } from './schema.js';
import type { ImageAssetInput, SourceRect } from './schema.js';

function invalid(message: string): never { throw new Canvas2DError('INVALID_ASSET', message); }

function dataFields(value: unknown, names: string[]): Record<string, PropertyDescriptor> {
  if (value === null || typeof value !== 'object' ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    invalid('crop fields must belong to an ordinary object');
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length !== names.length || keys.some(key => typeof key !== 'string' || !names.includes(key))) {
    invalid('crop fields must match the declared fields');
  }
  const fields = Object.getOwnPropertyDescriptors(value);
  for (const name of names) {
    if (!fields[name]?.enumerable || !('value' in fields[name])) invalid('crop fields must be enumerable data');
  }
  return fields;
}

function integer(value: unknown, minimum: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || Object.is(value, -0) ||
      value < minimum || value > 4096) invalid('crop coordinates and dimensions must be bounded integers');
  return value;
}

/** Copy a source-pixel rectangle exactly, including RGB beneath zero alpha. */
export function cropImageAsset(asset: ImageAssetInput, rect: SourceRect): ImageAssetInput {
  // Validate the complete payload before the source copy or output allocation.
  const a = dataFields(asset, ['width', 'height', 'pixels']);
  const width = integer(a.width.value, 1), height = integer(a.height.value, 1);
  const pixels: unknown = a.pixels.value;
  if (!(pixels instanceof Uint8Array) || Object.getPrototypeOf(pixels) !== Uint8Array.prototype ||
      ['buffer', 'byteLength', 'byteOffset', 'length'].some(key =>
        Object.getOwnPropertyDescriptor(pixels, key) !== undefined)) {
    invalid('crop pixels must be an ordinary Uint8Array without metadata overrides');
  }
  if ((typeof SharedArrayBuffer !== 'undefined' && pixels.buffer instanceof SharedArrayBuffer) ||
      pixels.byteLength !== width * height * 4) invalid('crop pixels must be exact non-shared RGBA8');
  const r = dataFields(rect, ['x', 'y', 'width', 'height']);
  const x = integer(r.x.value, 0), y = integer(r.y.value, 0);
  const w = integer(r.width.value, 1), h = integer(r.height.value, 1);
  if (x + w > width || y + h > height) invalid('crop rectangle must fit inside the source');
  if (pixels.byteLength > 1024 * 1024 || w * h * 4 > 1024 * 1024) {
    throw new Canvas2DError('ASSET_LIMIT', 'crop input and output must each fit 1 MiB');
  }
  const source = copyImageAsset({ width, height, pixels });
  const output = new Uint8Array(w * h * 4);
  for (let row = 0; row < h; row++) {
    const start = ((y + row) * width + x) * 4;
    output.set(source.pixels.subarray(start, start + w * 4), row * w * 4);
  }
  return { width: w, height: h, pixels: output };
}
