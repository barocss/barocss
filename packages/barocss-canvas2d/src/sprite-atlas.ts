import { Canvas2DError } from './schema.js';
import type { Size, SourceRect } from './schema.js';
import type { SpriteAnimationFrame } from './sprite-animation.js';

export type SpriteAtlasEntry = Readonly<{
  name: string;
  sourceRect: SourceRect;
  durationMS: number;
}>;

export type SpriteAtlas = Readonly<{
  frame(name: string): SpriteAnimationFrame;
  sequence(names: readonly string[]): SpriteAnimationFrame[];
}>;

const idPattern = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

function refuse(code: 'INVALID_ASSET' | 'INVALID_SCENE', message: string): never {
  throw new Canvas2DError(code, message);
}

function exactData(value: unknown, fields: readonly string[], code: 'INVALID_ASSET' | 'INVALID_SCENE'):
    Record<string, unknown> {
  if (value === null || typeof value !== 'object' ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    refuse(code, 'sprite atlas data must be a plain object');
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length !== fields.length || keys.some(key => typeof key !== 'string' || !fields.includes(key))) {
    refuse(code, 'sprite atlas data has unknown or missing fields');
  }
  for (const key of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      refuse(code, 'sprite atlas data needs data fields');
    }
  }
  return value as Record<string, unknown>;
}

function denseArray(value: unknown, maximum: number, code: 'INVALID_ASSET' | 'INVALID_SCENE'): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype ||
      value.length < 1 || value.length > maximum) refuse(code, 'sprite atlas array length is outside its range');
  const keys = Reflect.ownKeys(value);
  if (keys.length !== value.length + 1 || keys.some(key => key !== 'length' &&
      (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))) {
    refuse(code, 'sprite atlas array must be dense without extra fields');
  }
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      refuse(code, 'sprite atlas array needs data items');
    }
  }
  return value;
}

function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || Object.is(value, -0) ||
      value < min || value > max) refuse('INVALID_ASSET', 'sprite atlas number is outside its range');
  return value;
}

function id(value: unknown): string {
  if (typeof value !== 'string' || !idPattern.test(value)) {
    refuse('INVALID_ASSET', 'sprite atlas ID is invalid');
  }
  return value;
}

export function createSpriteAtlas(
  imageId: string,
  imageSize: Size,
  entries: readonly SpriteAtlasEntry[],
): SpriteAtlas {
  const assetId = id(imageId);
  const size = exactData(imageSize, ['width', 'height'], 'INVALID_ASSET');
  const width = integer(size.width, 1, 4096);
  const height = integer(size.height, 1, 4096);
  const source = denseArray(entries, 64, 'INVALID_ASSET');
  const frames = new Map<string, SpriteAnimationFrame>();
  for (const item of source) {
    const entry = exactData(item, ['name', 'sourceRect', 'durationMS'], 'INVALID_ASSET');
    const name = id(entry.name);
    if (frames.has(name)) refuse('INVALID_ASSET', 'sprite atlas frame name is duplicated');
    const crop = exactData(entry.sourceRect, ['x', 'y', 'width', 'height'], 'INVALID_ASSET');
    const x = integer(crop.x, 0, 4096), y = integer(crop.y, 0, 4096);
    const cropWidth = integer(crop.width, 1, 4096), cropHeight = integer(crop.height, 1, 4096);
    if (x + cropWidth > width || y + cropHeight > height) {
      refuse('INVALID_ASSET', 'sprite atlas crop exceeds image dimensions');
    }
    frames.set(name, { imageId: assetId, sourceRect: { x, y, width: cropWidth, height: cropHeight },
      durationMS: integer(entry.durationMS, 1, 60_000) });
  }

  function copyFrame(name: string): SpriteAnimationFrame {
    if (typeof name !== 'string' || !idPattern.test(name)) {
      refuse('INVALID_SCENE', 'sprite atlas frame name is invalid');
    }
    const stored = frames.get(name);
    if (!stored) refuse('INVALID_SCENE', 'sprite atlas frame name is unknown');
    return { imageId: stored.imageId, sourceRect: { ...stored.sourceRect! },
      durationMS: stored.durationMS };
  }

  return Object.freeze({
    frame: copyFrame,
    sequence(names: readonly string[]): SpriteAnimationFrame[] {
      return denseArray(names, 64, 'INVALID_SCENE').map(name => copyFrame(name as string));
    },
  });
}
