import { Canvas2DError, copyImageAsset } from './schema.js';
import type { ImageAssetInput, Color } from './schema.js';

function invalid(message: string): never { throw new Canvas2DError('INVALID_ASSET', message); }

function assetInput(value: unknown): ImageAssetInput {
  if (value === null || typeof value !== 'object' ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    invalid('outline image input must be an ordinary record');
  }
  const keys = Reflect.ownKeys(value), fields = Object.getOwnPropertyDescriptors(value);
  if (keys.length !== 3 || keys.some(key => key !== 'width' && key !== 'height' && key !== 'pixels')) {
    invalid('outline image input needs exactly width, height and pixels');
  }
  for (const key of ['width', 'height', 'pixels']) {
    if (!fields[key]?.enumerable || !('value' in fields[key])) invalid('outline image fields must be data');
  }
  const width: unknown = fields.width.value, height: unknown = fields.height.value;
  if (typeof width !== 'number' || !Number.isInteger(width) || Object.is(width, -0) || width < 1 || width > 4096 ||
      typeof height !== 'number' || !Number.isInteger(height) || Object.is(height, -0) || height < 1 || height > 4096) {
    invalid('outline image dimensions must be integers in 1..4096');
  }
  const pixels: unknown = fields.pixels.value;
  if (!(pixels instanceof Uint8Array) || Object.getPrototypeOf(pixels) !== Uint8Array.prototype ||
      ['buffer', 'byteLength', 'byteOffset', 'length'].some(key => Object.getOwnPropertyDescriptor(pixels, key) !== undefined)) {
    invalid('outline image pixels must be an ordinary Uint8Array without metadata overrides');
  }
  if ((typeof SharedArrayBuffer !== 'undefined' && pixels.buffer instanceof SharedArrayBuffer) ||
      pixels.byteLength !== width * height * 4) invalid('outline image pixels must be exact non-shared RGBA8');
  return { width, height, pixels };
}

function colorInput(value: unknown): Color {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length !== 4) {
    invalid('outline color needs four ordinary values');
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 5 || keys.some(key => key !== 'length' &&
      (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= 4))) {
    invalid('outline color must be dense without extra fields');
  }
  const color: number[] = [];
  for (let index = 0; index < 4; index++) {
    const field = Object.getOwnPropertyDescriptor(value, String(index));
    if (!field?.enumerable || !('value' in field) || typeof field.value !== 'number' ||
        !Number.isFinite(field.value) || Object.is(field.value, -0) || field.value < 0 || field.value > 1) {
      invalid('outline color values must be finite in 0..1');
    }
    color.push(field.value);
  }
  return color as Color;
}

/** Prepare a same-extent square alpha maximum minus centre alpha, in a constant color. */
export function outlineImageAsset(asset: ImageAssetInput, radius: number, color: Color): ImageAssetInput {
  const admitted = assetInput(asset);
  if (!Number.isInteger(radius) || Object.is(radius, -0) || radius < 1 || radius > 8) {
    invalid('outline radius must be an integer in 1..8');
  }
  const channels = colorInput(color);
  if (admitted.pixels.byteLength > 1024 * 1024) {
    throw new Canvas2DError('ASSET_LIMIT', 'outline input exceeds 1 MiB');
  }
  // Complete shape/radius/color/budget admission precedes all typed payload.
  const { width, height, pixels: source } = copyImageAsset(admitted);
  const horizontal = new Uint8Array(width * height), output = new Uint8Array(source.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let maximum = 0;
    for (let sx = Math.max(0, x - radius); sx <= Math.min(width - 1, x + radius); sx++) {
      maximum = Math.max(maximum, source[(y * width + sx) * 4 + 3]);
    }
    horizontal[y * width + x] = maximum;
  }
  const red = Math.round(255 * channels[0]), green = Math.round(255 * channels[1]), blue = Math.round(255 * channels[2]);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let maximum = 0;
    for (let sy = Math.max(0, y - radius); sy <= Math.min(height - 1, y + radius); sy++) {
      maximum = Math.max(maximum, horizontal[sy * width + x]);
    }
    const offset = (y * width + x) * 4, alpha = Math.round((maximum - source[offset + 3]) * channels[3]);
    if (alpha > 0) { output[offset] = red; output[offset + 1] = green; output[offset + 2] = blue; output[offset + 3] = alpha; }
  }
  return { width, height, pixels: output };
}
