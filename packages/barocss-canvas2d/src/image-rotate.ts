import { Canvas2DError, copyImageAsset } from './schema.js';
import type { ImageAssetInput } from './schema.js';

export type ImageQuarterTurns = 0 | 1 | 2 | 3;

function invalid(message: string): never { throw new Canvas2DError('INVALID_ASSET', message); }

// Validate all descriptors and the byte budget before copying typed pixels.
function boundedAsset(value: unknown): ImageAssetInput {
  if (value === null || typeof value !== 'object' ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    invalid('rotation input must be an ordinary image asset');
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 3 || keys.some(key => key !== 'width' && key !== 'height' && key !== 'pixels')) {
    invalid('rotation input needs exactly width, height and pixels');
  }
  const fields = Object.getOwnPropertyDescriptors(value);
  for (const key of ['width', 'height', 'pixels']) {
    if (!fields[key]?.enumerable || !('value' in fields[key])) invalid('rotation input fields must be data');
  }
  const width: unknown = fields.width.value, height: unknown = fields.height.value;
  if (typeof width !== 'number' || !Number.isInteger(width) || width < 1 || width > 4096 ||
      typeof height !== 'number' || !Number.isInteger(height) || height < 1 || height > 4096) {
    invalid('rotation dimensions must be integers in 1..4096');
  }
  const pixels: unknown = fields.pixels.value;
  if (!(pixels instanceof Uint8Array) || Object.getPrototypeOf(pixels) !== Uint8Array.prototype ||
      ['buffer', 'byteLength', 'byteOffset', 'length'].some(key =>
        Object.getOwnPropertyDescriptor(pixels, key) !== undefined)) {
    invalid('rotation pixels must be an ordinary Uint8Array without metadata overrides');
  }
  if ((typeof SharedArrayBuffer !== 'undefined' && pixels.buffer instanceof SharedArrayBuffer) ||
      pixels.byteLength !== width * height * 4) invalid('rotation pixels must be exact non-shared RGBA8');
  if (pixels.byteLength > 1024 * 1024) throw new Canvas2DError('ASSET_LIMIT', 'rotation input exceeds 1 MiB');
  return copyImageAsset({ width, height, pixels });
}

/** Copy straight RGBA8 pixels through an exact clockwise quarter-turn permutation. */
export function rotateImageAsset(asset: ImageAssetInput, quarterTurns: ImageQuarterTurns): ImageAssetInput {
  if (quarterTurns !== 0 && quarterTurns !== 1 && quarterTurns !== 2 && quarterTurns !== 3 ||
      Object.is(quarterTurns, -0)) invalid('rotation needs 0, 1, 2 or 3 clockwise quarter turns');
  const source = boundedAsset(asset);
  if (quarterTurns === 0) return source;
  const width = quarterTurns % 2 ? source.height : source.width;
  const height = quarterTurns % 2 ? source.width : source.height;
  const pixels = new Uint8Array(source.pixels.length);
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    const dx = quarterTurns === 1 ? source.height - 1 - y : quarterTurns === 2 ? source.width - 1 - x : y;
    const dy = quarterTurns === 1 ? x : quarterTurns === 2 ? source.height - 1 - y : source.width - 1 - x;
    const from = (y * source.width + x) * 4, to = (dy * width + dx) * 4;
    for (let channel = 0; channel < 4; channel++) pixels[to + channel] = source.pixels[from + channel];
  }
  return { width, height, pixels };
}
