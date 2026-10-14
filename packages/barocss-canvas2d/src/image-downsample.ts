import { Canvas2DError, copyImageAsset } from './schema.js';
import type { ImageAssetInput } from './schema.js';

function invalid(message: string): never { throw new Canvas2DError('INVALID_ASSET', message); }

function input(value: unknown): ImageAssetInput {
  if (value === null || typeof value !== 'object' ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    invalid('downsample input must be an ordinary image asset');
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 3 || keys.some(key => key !== 'width' && key !== 'height' && key !== 'pixels')) {
    invalid('downsample input needs exactly width, height and pixels');
  }
  const fields = Object.getOwnPropertyDescriptors(value);
  for (const key of ['width', 'height', 'pixels']) {
    if (!fields[key]?.enumerable || !('value' in fields[key])) invalid('downsample fields must be enumerable data');
  }
  const width: unknown = fields.width.value, height: unknown = fields.height.value;
  if (typeof width !== 'number' || !Number.isInteger(width) || Object.is(width, -0) || width < 1 || width > 4096 ||
      typeof height !== 'number' || !Number.isInteger(height) || Object.is(height, -0) || height < 1 || height > 4096) {
    invalid('downsample dimensions must be integers in 1..4096');
  }
  const pixels: unknown = fields.pixels.value;
  if (!(pixels instanceof Uint8Array) || Object.getPrototypeOf(pixels) !== Uint8Array.prototype ||
      ['buffer', 'byteLength', 'byteOffset', 'length'].some(key =>
        Object.getOwnPropertyDescriptor(pixels, key) !== undefined)) {
    invalid('downsample pixels must be an ordinary Uint8Array without metadata overrides');
  }
  if ((typeof SharedArrayBuffer !== 'undefined' && pixels.buffer instanceof SharedArrayBuffer) ||
      pixels.byteLength !== width * height * 4) invalid('downsample pixels must be exact non-shared RGBA8');
  return { width, height, pixels };
}

/** Reduce each pixel footprint by exact alpha-weighted encoded-byte coverage. */
export function downsampleImageAsset(asset: ImageAssetInput, width: number, height: number): ImageAssetInput {
  const admitted = input(asset);
  if (!Number.isInteger(width) || Object.is(width, -0) || width < 1 || width > admitted.width ||
      !Number.isInteger(height) || Object.is(height, -0) || height < 1 || height > admitted.height) {
    invalid('downsample dimensions must be integers within the source extent');
  }
  // All source and destination shape checks precede either budget or copy.
  if (admitted.pixels.byteLength > 1024 * 1024 || width * height * 4 > 1024 * 1024) {
    throw new Canvas2DError('ASSET_LIMIT', 'downsample source and output must each fit 1 MiB');
  }
  const source = copyImageAsset(admitted);
  if (width === source.width && height === source.height) return source;
  const pixels = new Uint8Array(width * height * 4), sw = source.width, sh = source.height;
  const footprint = sw * sh;
  for (let y = 0; y < height; y++) {
    const top = y * sh, bottom = (y + 1) * sh;
    const firstY = Math.floor(top / height), endY = Math.ceil(bottom / height);
    for (let x = 0; x < width; x++) {
      const left = x * sw, right = (x + 1) * sw;
      const firstX = Math.floor(left / width), endX = Math.ceil(right / width);
      let alpha = 0, red = 0, green = 0, blue = 0;
      for (let sy = firstY; sy < endY; sy++) {
        const wy = Math.min(bottom, (sy + 1) * height) - Math.max(top, sy * height);
        for (let sx = firstX; sx < endX; sx++) {
          const wx = Math.min(right, (sx + 1) * width) - Math.max(left, sx * width);
          const i = (sy * sw + sx) * 4, a = source.pixels[i + 3] * wx * wy;
          alpha += a; red += source.pixels[i] * a;
          green += source.pixels[i + 1] * a; blue += source.pixels[i + 2] * a;
        }
      }
      const to = (y * width + x) * 4;
      const a = Math.floor((2 * alpha + footprint) / (2 * footprint));
      pixels[to + 3] = a;
      if (a > 0) {
        pixels[to] = Math.floor((2 * red + alpha) / (2 * alpha));
        pixels[to + 1] = Math.floor((2 * green + alpha) / (2 * alpha));
        pixels[to + 2] = Math.floor((2 * blue + alpha) / (2 * alpha));
      }
    }
  }
  return { width, height, pixels };
}
