import { Canvas2DError, copyImageAsset } from './schema.js';
import type { ImageAssetInput, SpriteRGBMatrix } from './schema.js';

function invalid(message: string): never { throw new Canvas2DError('INVALID_ASSET', message); }

function assetInput(value: unknown): ImageAssetInput {
  if (value === null || typeof value !== 'object' ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    invalid('image color input must be an ordinary record');
  }
  const keys = Reflect.ownKeys(value), fields = Object.getOwnPropertyDescriptors(value);
  if (keys.length !== 3 || keys.some(key => key !== 'width' && key !== 'height' && key !== 'pixels')) {
    invalid('image color input needs exactly width, height and pixels');
  }
  for (const key of ['width', 'height', 'pixels']) {
    if (!fields[key]?.enumerable || !('value' in fields[key])) invalid('image color fields must be data');
  }
  const width: unknown = fields.width.value, height: unknown = fields.height.value;
  if (typeof width !== 'number' || !Number.isInteger(width) || Object.is(width, -0) || width < 1 || width > 4096 ||
      typeof height !== 'number' || !Number.isInteger(height) || Object.is(height, -0) || height < 1 || height > 4096) {
    invalid('image color dimensions must be integers in 1..4096');
  }
  const pixels: unknown = fields.pixels.value;
  if (!(pixels instanceof Uint8Array) || Object.getPrototypeOf(pixels) !== Uint8Array.prototype ||
      ['buffer', 'byteLength', 'byteOffset', 'length'].some(key => Object.getOwnPropertyDescriptor(pixels, key) !== undefined)) {
    invalid('image color pixels must be an ordinary Uint8Array without metadata overrides');
  }
  if ((typeof SharedArrayBuffer !== 'undefined' && pixels.buffer instanceof SharedArrayBuffer) ||
      pixels.byteLength !== width * height * 4) invalid('image color pixels must be exact non-shared RGBA8');
  return { width, height, pixels };
}

function matrixInput(value: unknown): SpriteRGBMatrix {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length !== 12) {
    invalid('image color matrix needs twelve ordinary values');
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 13 || keys.some(key => key !== 'length' &&
      (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= 12))) {
    invalid('image color matrix must be dense without extra fields');
  }
  const rows: number[] = [];
  for (let index = 0; index < 12; index++) {
    const field = Object.getOwnPropertyDescriptor(value, String(index)), bound = index % 4 === 3 ? 1 : 4;
    if (!field?.enumerable || !('value' in field) || typeof field.value !== 'number' ||
        !Number.isFinite(field.value) || Object.is(field.value, -0) || Math.abs(field.value) > bound) {
      invalid('image color matrix values exceed the finite row range');
    }
    rows.push(field.value);
  }
  return rows as SpriteRGBMatrix;
}

/** Bake encoded RGB byte rows; preserve alpha and transform hidden RGB too. */
export function applyImageRGBMatrix(asset: ImageAssetInput, matrix: SpriteRGBMatrix): ImageAssetInput {
  const admitted = assetInput(asset), rows = matrixInput(matrix);
  if (admitted.pixels.byteLength > 1024 * 1024) {
    throw new Canvas2DError('ASSET_LIMIT', 'image color input exceeds 1 MiB');
  }
  // Both complete shapes and the budget precede all copied typed payload.
  const source = copyImageAsset(admitted), output = new Uint8Array(source.pixels.length);
  for (let index = 0; index < output.length; index += 4) {
    for (let channel = 0; channel < 3; channel++) {
      const row = channel * 4;
      // Each binary64 multiply and add is evaluated in this explicit order.
      let value = source.pixels[index] * rows[row];
      value += source.pixels[index + 1] * rows[row + 1];
      value += source.pixels[index + 2] * rows[row + 2];
      value += 255 * rows[row + 3];
      output[index + channel] = Math.round(Math.max(0, Math.min(255, value)));
    }
    output[index + 3] = source.pixels[index + 3];
  }
  return { width: source.width, height: source.height, pixels: output };
}
