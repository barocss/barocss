import { Canvas2DError, copyImageAsset } from './schema.js';
import type { Color, ImageAssetInput } from './schema.js';

export type ImageShadowOptions = Readonly<{
  radius: number; offsetX: number; offsetY: number; color: Color;
}>;

function invalid(message: string): never { throw new Canvas2DError('INVALID_ASSET', message); }

function boundedAsset(value: unknown): ImageAssetInput {
  if (value === null || typeof value !== 'object' ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    invalid('shadow input must be an ordinary image asset');
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 3 || keys.some(key => key !== 'width' && key !== 'height' && key !== 'pixels')) {
    invalid('shadow input needs exactly width, height and pixels');
  }
  const fields = Object.getOwnPropertyDescriptors(value);
  for (const key of ['width', 'height', 'pixels']) {
    if (!fields[key]?.enumerable || !('value' in fields[key])) invalid('shadow input fields must be data');
  }
  const width: unknown = fields.width.value, height: unknown = fields.height.value;
  if (typeof width !== 'number' || !Number.isInteger(width) || width < 1 || width > 4096 ||
      typeof height !== 'number' || !Number.isInteger(height) || height < 1 || height > 4096) {
    invalid('shadow dimensions must be integers in 1..4096');
  }
  const pixels: unknown = fields.pixels.value;
  if (!(pixels instanceof Uint8Array) || Object.getPrototypeOf(pixels) !== Uint8Array.prototype ||
      ['buffer', 'byteLength', 'byteOffset', 'length'].some(key =>
        Object.getOwnPropertyDescriptor(pixels, key) !== undefined)) {
    invalid('shadow pixels must be an ordinary Uint8Array without metadata overrides');
  }
  if ((typeof SharedArrayBuffer !== 'undefined' && pixels.buffer instanceof SharedArrayBuffer) ||
      pixels.byteLength !== width * height * 4) invalid('shadow pixels must be exact non-shared RGBA8');
  if (pixels.byteLength > 1024 * 1024) throw new Canvas2DError('ASSET_LIMIT', 'shadow input exceeds 1 MiB');
  return { width, height, pixels };
}


function optionsInput(value: unknown): ImageShadowOptions {
  if (value === null || typeof value !== 'object' ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    invalid('shadow options must be an ordinary record');
  }
  const names = ['radius', 'offsetX', 'offsetY', 'color'];
  const keys = Reflect.ownKeys(value), fields = Object.getOwnPropertyDescriptors(value);
  if (keys.length !== 4 || keys.some(key => typeof key !== 'string' || !names.includes(key))) {
    invalid('shadow options need exactly radius, offsetX, offsetY and color');
  }
  for (const key of names) {
    if (!fields[key]?.enumerable || !('value' in fields[key])) invalid('shadow options need data fields');
  }
  const radius: unknown = fields.radius.value;
  const offsetX: unknown = fields.offsetX.value, offsetY: unknown = fields.offsetY.value;
  const integer = (v: unknown, min: number, max: number): v is number =>
    typeof v === 'number' && Number.isInteger(v) && !Object.is(v, -0) && v >= min && v <= max;
  if (!integer(radius, 0, 8) || !integer(offsetX, -64, 64) || !integer(offsetY, -64, 64)) {
    invalid('shadow radius or offsets are outside their integer ranges');
  }
  const raw: unknown = fields.color.value;
  if (!Array.isArray(raw) || Object.getPrototypeOf(raw) !== Array.prototype || raw.length !== 4 ||
      Reflect.ownKeys(raw).some(key => !['0', '1', '2', '3', 'length'].includes(String(key))) ||
      Reflect.ownKeys(raw).length !== 5) invalid('shadow color must be an ordinary four-number array');
  const color: number[] = [];
  for (let i = 0; i < 4; i++) {
    const d = Object.getOwnPropertyDescriptor(raw, String(i));
    if (!d?.enumerable || !('value' in d) || typeof d.value !== 'number' ||
        !Number.isFinite(d.value) || Object.is(d.value, -0) || d.value < 0 || d.value > 1) {
      invalid('shadow color channels must be finite data numbers in 0..1');
    }
    color.push(d.value);
  }
  return { radius, offsetX, offsetY, color: [color[0], color[1], color[2], color[3]] };
}

/** Prepare a same-size shifted, colored box-filtered alpha silhouette. */
export function shadowImageAsset(asset: ImageAssetInput, options: ImageShadowOptions): ImageAssetInput {
  const { radius, offsetX, offsetY, color } = optionsInput(options);
  const admitted = boundedAsset(asset);
  // All descriptors, dimensions and byte limits are admitted before pixel allocations.
  const { width, height, pixels } = copyImageAsset(admitted);
  const horizontal = new Uint32Array(width * height);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    const alpha = (x: number): number => x < 0 || x >= width ? 0 : pixels[(y * width + x) * 4 + 3];
    for (let x = 0; x <= radius && x < width; x++) sum += alpha(x);
    for (let x = 0; x < width; x++) {
      horizontal[y * width + x] = sum;
      sum -= alpha(x - radius); sum += alpha(x + radius + 1);
    }
  }
  const output = new Uint8Array(pixels.length), area = (2 * radius + 1) ** 2;
  const red = Math.round(255 * color[0]), green = Math.round(255 * color[1]), blue = Math.round(255 * color[2]);
  for (let x = 0; x < width; x++) {
    const centerX = x - offsetX;
    // Centers just outside the image can still receive alpha from their kernel.
    const rowSum = (y: number): number => {
      if (y < 0 || y >= height) return 0;
      if (centerX >= 0 && centerX < width) return horizontal[y * width + centerX];
      let sum = 0;
      for (let sx = Math.max(0, centerX - radius); sx <= Math.min(width - 1, centerX + radius); sx++) {
        sum += pixels[(y * width + sx) * 4 + 3];
      }
      return sum;
    };
    let sum = 0;
    for (let sy = -offsetY - radius; sy <= -offsetY + radius; sy++) sum += rowSum(sy);
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 4, alpha = Math.round(sum / area * color[3]);
      if (alpha > 0) { output[i] = red; output[i + 1] = green; output[i + 2] = blue; output[i + 3] = alpha; }
      sum -= rowSum(y - offsetY - radius); sum += rowSum(y - offsetY + radius + 1);
    }
  }
  return { width, height, pixels: output };
}
