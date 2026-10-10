import { Canvas2DError, copyImageAsset } from './schema.js';
import type { ImageAssetInput } from './schema.js';

export type ImagePadding = { top: number; right: number; bottom: number; left: number };

function invalid(message: string): never { throw new Canvas2DError('INVALID_ASSET', message); }

function dataFields(value: unknown, names: string[]): Record<string, PropertyDescriptor> {
  if (value === null || typeof value !== 'object' ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    invalid('padding fields must belong to an ordinary object');
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length !== names.length || keys.some(key => typeof key !== 'string' || !names.includes(key))) {
    invalid('padding fields must match the declared fields');
  }
  const fields = Object.getOwnPropertyDescriptors(value);
  for (const name of names) {
    if (!fields[name]?.enumerable || !('value' in fields[name])) invalid('padding fields must be enumerable data');
  }
  return fields;
}

function integer(value: unknown, minimum: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || Object.is(value, -0) ||
      value < minimum || value > 4096) invalid('padding dimensions and margins must be bounded integers');
  return value;
}

/** Add transparent working space without changing any source RGBA8 byte. */
export function padImageAsset(asset: ImageAssetInput, padding: ImagePadding): ImageAssetInput {
  const a = dataFields(asset, ['width', 'height', 'pixels']);
  const width = integer(a.width.value, 1), height = integer(a.height.value, 1);
  const pixels: unknown = a.pixels.value;
  if (!(pixels instanceof Uint8Array) || Object.getPrototypeOf(pixels) !== Uint8Array.prototype ||
      ['buffer', 'byteLength', 'byteOffset', 'length'].some(key =>
        Object.getOwnPropertyDescriptor(pixels, key) !== undefined)) {
    invalid('padding pixels must be an ordinary Uint8Array without metadata overrides');
  }
  if ((typeof SharedArrayBuffer !== 'undefined' && pixels.buffer instanceof SharedArrayBuffer) ||
      pixels.byteLength !== width * height * 4) invalid('padding pixels must be exact non-shared RGBA8');
  const p = dataFields(padding, ['top', 'right', 'bottom', 'left']);
  const top = integer(p.top.value, 0), right = integer(p.right.value, 0);
  const bottom = integer(p.bottom.value, 0), left = integer(p.left.value, 0);
  const w = width + left + right, h = height + top + bottom;
  // All shape checks precede budget checks, the source copy and output allocation.
  if (pixels.byteLength > 1024 * 1024 || w > 4096 || h > 4096 || w * h * 4 > 1024 * 1024) {
    throw new Canvas2DError('ASSET_LIMIT', 'padding dimensions must fit 4096 and each payload must fit 1 MiB');
  }
  const source = copyImageAsset({ width, height, pixels });
  const output = new Uint8Array(w * h * 4);
  for (let row = 0; row < height; row++) {
    output.set(source.pixels.subarray(row * width * 4, (row + 1) * width * 4),
      ((top + row) * w + left) * 4);
  }
  return { width: w, height: h, pixels: output };
}
