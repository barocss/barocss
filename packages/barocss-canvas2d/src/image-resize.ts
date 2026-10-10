import { Canvas2DError, copyImageAsset } from './schema.js';
import type { ImageAssetInput } from './schema.js';

function invalid(message: string): never { throw new Canvas2DError('INVALID_ASSET', message); }

// Check the preparation budget before the existing asset validator copies pixels.
function boundedAsset(value: unknown): ImageAssetInput {
  if (value === null || typeof value !== 'object' ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    invalid('resize input must be an ordinary image asset');
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 3 || keys.some(key => key !== 'width' && key !== 'height' && key !== 'pixels')) {
    invalid('resize input needs exactly width, height and pixels');
  }
  const fields = Object.getOwnPropertyDescriptors(value);
  for (const key of ['width', 'height', 'pixels']) {
    if (!fields[key]?.enumerable || !('value' in fields[key])) invalid('resize input fields must be data');
  }
  const width: unknown = fields.width.value, height: unknown = fields.height.value;
  if (typeof width !== 'number' || !Number.isInteger(width) || width < 1 || width > 4096 ||
      typeof height !== 'number' || !Number.isInteger(height) || height < 1 || height > 4096) {
    invalid('resize dimensions must be integers in 1..4096');
  }
  const pixels: unknown = fields.pixels.value;
  if (!(pixels instanceof Uint8Array) || Object.getPrototypeOf(pixels) !== Uint8Array.prototype ||
      ['buffer', 'byteLength', 'byteOffset', 'length'].some(key =>
        Object.getOwnPropertyDescriptor(pixels, key) !== undefined)) {
    invalid('resize pixels must be an ordinary Uint8Array without metadata overrides');
  }
  if ((typeof SharedArrayBuffer !== 'undefined' && pixels.buffer instanceof SharedArrayBuffer) ||
      pixels.byteLength !== width * height * 4) invalid('resize pixels must be exact non-shared RGBA8');
  if (pixels.byteLength > 1024 * 1024) throw new Canvas2DError('ASSET_LIMIT', 'resize input exceeds 1 MiB');
  return copyImageAsset({ width, height, pixels });
}

export type ImageResizeSampling = 'nearest' | 'linear';

/** Resize copied straight RGBA8 pixels using clamped pixel-center sampling. */
export function resizeImageAsset(
  asset: ImageAssetInput, width: number, height: number, sampling: ImageResizeSampling,
): ImageAssetInput {
  if (!Number.isInteger(width) || Object.is(width, -0) || width < 1 || width > 4096 ||
      !Number.isInteger(height) || Object.is(height, -0) || height < 1 || height > 4096) {
    invalid('resize output dimensions must be integers in 1..4096');
  }
  if (sampling !== 'nearest' && sampling !== 'linear') invalid('resize sampling must be nearest or linear');
  if (width * height * 4 > 1024 * 1024) {
    throw new Canvas2DError('ASSET_LIMIT', 'resize output exceeds 1 MiB');
  }
  const source = boundedAsset(asset), output = new Uint8Array(width * height * 4);
  const sw = source.width, sh = source.height, pixels = source.pixels;
  if (sampling === 'nearest') {
    for (let y = 0; y < height; y++) {
      const sy = Math.min(sh - 1, Math.floor((2 * y + 1) * sh / (2 * height)));
      for (let x = 0; x < width; x++) {
        const sx = Math.min(sw - 1, Math.floor((2 * x + 1) * sw / (2 * width)));
        const i = (y * width + x) * 4, j = (sy * sw + sx) * 4;
        for (let c = 0; c < 4; c++) output[i + c] = pixels[j + c];
      }
    }
  } else {
    // Integer weights avoid intermediate quantization and floating half-tie drift.
    // At the 4096 dimension cap every weighted RGB*alpha sum is below 2^53.
    const dx = 2 * width, dy = 2 * height, area = dx * dy;
    for (let y = 0; y < height; y++) {
      const ny = Math.max(0, Math.min((sh - 1) * dy, (2 * y + 1) * sh - height));
      const y0 = Math.floor(ny / dy), y1 = Math.min(sh - 1, y0 + 1), fy = ny % dy;
      for (let x = 0; x < width; x++) {
        const nx = Math.max(0, Math.min((sw - 1) * dx, (2 * x + 1) * sw - width));
        const x0 = Math.floor(nx / dx), x1 = Math.min(sw - 1, x0 + 1), fx = nx % dx;
        let alpha = 0, red = 0, green = 0, blue = 0;
        for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 2; xx++) {
          const weight = (xx ? fx : dx - fx) * (yy ? fy : dy - fy);
          const j = ((yy ? y1 : y0) * sw + (xx ? x1 : x0)) * 4;
          const a = pixels[j + 3] * weight;
          alpha += a; red += pixels[j] * a; green += pixels[j + 1] * a; blue += pixels[j + 2] * a;
        }
        const i = (y * width + x) * 4, a = Math.round(alpha / area);
        output[i + 3] = a;
        if (a > 0) {
          output[i] = Math.round(red / alpha); output[i + 1] = Math.round(green / alpha);
          output[i + 2] = Math.round(blue / alpha);
        }
      }
    }
  }
  return { width, height, pixels: output };
}
