import { Canvas2DError, copyImageAsset } from './schema.js';
import type { ImageAssetInput } from './schema.js';

function invalid(message: string): never { throw new Canvas2DError('INVALID_ASSET', message); }

// Check the preparation budget before the existing asset validator copies pixels.
function boundedAsset(value: unknown): ImageAssetInput {
  if (value === null || typeof value !== 'object' ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    invalid('blur input must be an ordinary image asset');
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 3 || keys.some(key => key !== 'width' && key !== 'height' && key !== 'pixels')) {
    invalid('blur input needs exactly width, height and pixels');
  }
  const fields = Object.getOwnPropertyDescriptors(value);
  for (const key of ['width', 'height', 'pixels']) {
    if (!fields[key]?.enumerable || !('value' in fields[key])) invalid('blur input fields must be data');
  }
  const width: unknown = fields.width.value, height: unknown = fields.height.value;
  if (typeof width !== 'number' || !Number.isInteger(width) || width < 1 || width > 4096 ||
      typeof height !== 'number' || !Number.isInteger(height) || height < 1 || height > 4096) {
    invalid('blur dimensions must be integers in 1..4096');
  }
  const pixels: unknown = fields.pixels.value;
  if (!(pixels instanceof Uint8Array) || Object.getPrototypeOf(pixels) !== Uint8Array.prototype ||
      ['buffer', 'byteLength', 'byteOffset', 'length'].some(key =>
        Object.getOwnPropertyDescriptor(pixels, key) !== undefined)) {
    invalid('blur pixels must be an ordinary Uint8Array without metadata overrides');
  }
  if ((typeof SharedArrayBuffer !== 'undefined' && pixels.buffer instanceof SharedArrayBuffer) ||
      pixels.byteLength !== width * height * 4) invalid('blur pixels must be exact non-shared RGBA8');
  if (pixels.byteLength > 1024 * 1024) throw new Canvas2DError('ASSET_LIMIT', 'blur input exceeds 1 MiB');
  return copyImageAsset({ width, height, pixels });
}

/** Prepare a same-size square box blur in encoded RGBA byte space. */
export function blurImageAsset(asset: ImageAssetInput, radius: number): ImageAssetInput {
  if (!Number.isInteger(radius) || Object.is(radius, -0) || radius < 0 || radius > 8) {
    invalid('blur radius must be an integer in 0..8');
  }
  const { width, height, pixels } = boundedAsset(asset);
  if (radius === 0) return { width, height, pixels };
  // Exact integer horizontal sums: RGB*alpha and alpha. No pass quantization.
  const horizontal = new Uint32Array(pixels.length);
  for (let y = 0; y < height; y++) {
    let red = 0, green = 0, blue = 0, alpha = 0;
    const add = (x: number, sign: number): void => {
      if (x < 0 || x >= width) return;
      const i = (y * width + x) * 4, a = pixels[i + 3];
      red += sign * pixels[i] * a; green += sign * pixels[i + 1] * a;
      blue += sign * pixels[i + 2] * a; alpha += sign * a;
    };
    for (let x = 0; x <= radius && x < width; x++) add(x, 1);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      horizontal[i] = red; horizontal[i + 1] = green;
      horizontal[i + 2] = blue; horizontal[i + 3] = alpha;
      add(x - radius, -1); add(x + radius + 1, 1);
    }
  }
  const output = new Uint8Array(pixels.length), area = (2 * radius + 1) ** 2;
  for (let x = 0; x < width; x++) {
    let red = 0, green = 0, blue = 0, alpha = 0;
    const add = (y: number, sign: number): void => {
      if (y < 0 || y >= height) return;
      const i = (y * width + x) * 4;
      red += sign * horizontal[i]; green += sign * horizontal[i + 1];
      blue += sign * horizontal[i + 2]; alpha += sign * horizontal[i + 3];
    };
    for (let y = 0; y <= radius && y < height; y++) add(y, 1);
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 4, a = Math.round(alpha / area);
      output[i + 3] = a;
      if (a > 0) {
        output[i] = Math.min(255, Math.round(red / alpha));
        output[i + 1] = Math.min(255, Math.round(green / alpha));
        output[i + 2] = Math.min(255, Math.round(blue / alpha));
      }
      add(y - radius, -1); add(y + radius + 1, 1);
    }
  }
  return { width, height, pixels: output };
}
