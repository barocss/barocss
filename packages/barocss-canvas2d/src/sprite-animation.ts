import { Canvas2DError } from './schema.js';
import type { SourceRect } from './schema.js';
import type { SpriteHandle } from './display-tree.js';

export type SpriteAnimationFrame = Readonly<{
  imageId: string;
  sourceRect?: SourceRect | null;
  durationMS: number;
}>;
export type SpriteAnimationOptions = Readonly<{
  loop?: boolean;
  initialFrameIndex?: number;
}>;
export type SpriteAnimation = {
  readonly frameIndex: number;
  readonly playing: boolean;
  readonly finished: boolean;
  play(): void;
  pause(): void;
  seek(index: number): void;
  advance(deltaMS: number): boolean;
  dispose(): void;
};

type Frame = { imageId: string; sourceRect: SourceRect | null; durationMS: number };
const idPattern = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

function invalid(message: string): never { throw new Canvas2DError('INVALID_SCENE', message); }

function exactData(value: unknown, required: string[], optional: string[] = []): Record<string, unknown> {
  if (value === null || typeof value !== 'object' ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    invalid('sprite animation data must be a plain object');
  }
  const keys = Reflect.ownKeys(value);
  if (required.some(key => !keys.includes(key)) ||
      keys.some(key => typeof key !== 'string' || !required.includes(key) && !optional.includes(key))) {
    invalid('sprite animation data has unknown or missing fields');
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of keys) {
    const descriptor = descriptors[key as string];
    if (!descriptor?.enumerable || !('value' in descriptor)) invalid('sprite animation data needs data fields');
  }
  return value as Record<string, unknown>;
}

function sourceRect(value: unknown): SourceRect | null {
  if (value === null) return null;
  const rect = exactData(value, ['x', 'y', 'width', 'height']);
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    const coordinate = rect[key];
    const min = key === 'x' || key === 'y' ? 0 : 1;
    if (typeof coordinate !== 'number' || !Number.isInteger(coordinate) ||
        Object.is(coordinate, -0) || coordinate < min || coordinate > 4096) {
      invalid('sprite animation source rectangle needs bounded integer pixels');
    }
  }
  return { x: rect.x as number, y: rect.y as number,
    width: rect.width as number, height: rect.height as number };
}

function checkedFrames(value: unknown): Frame[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype ||
      value.length < 1 || value.length > 64) invalid('sprite animation needs 1..64 frames');
  const keys = Reflect.ownKeys(value);
  if (keys.length !== value.length + 1 || keys.some(key => key !== 'length' &&
      (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))) {
    invalid('sprite animation frames must be dense without extra fields');
  }
  const frames: Frame[] = [];
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor?.enumerable || !('value' in descriptor)) invalid('sprite animation frame must be a data item');
    const frame = exactData(descriptor.value, ['imageId', 'durationMS'], ['sourceRect']);
    if (typeof frame.imageId !== 'string' || !idPattern.test(frame.imageId)) invalid('sprite animation image ID is invalid');
    if (typeof frame.durationMS !== 'number' || !Number.isInteger(frame.durationMS) ||
        frame.durationMS < 1 || frame.durationMS > 60_000) invalid('sprite animation duration is outside its range');
    frames.push({ imageId: frame.imageId, durationMS: frame.durationMS,
      sourceRect: Object.hasOwn(frame, 'sourceRect') ? sourceRect(frame.sourceRect) : null });
  }
  return frames;
}

export function createSpriteAnimation(
  sprite: SpriteHandle,
  frames: readonly SpriteAnimationFrame[],
  options?: SpriteAnimationOptions,
): SpriteAnimation {
  const sequence = checkedFrames(frames);
  const settings = options === undefined ? {} : exactData(options, [], ['loop', 'initialFrameIndex']);
  const loop = settings.loop === undefined ? true : settings.loop;
  const initial = settings.initialFrameIndex === undefined ? 0 : settings.initialFrameIndex;
  if (typeof loop !== 'boolean' || typeof initial !== 'number' || !Number.isInteger(initial) ||
      Object.is(initial, -0) || initial < 0 || initial >= sequence.length) {
    invalid('sprite animation options are invalid');
  }
  if (sprite === null || typeof sprite !== 'object' || sprite.kind !== 'sprite' ||
      typeof sprite.setImageSource !== 'function') invalid('sprite animation needs a sprite handle');

  function select(index: number): void {
    const frame = sequence[index];
    sprite.setImageSource(frame.imageId, frame.sourceRect);
  }
  select(initial);
  let frameIndex = initial;
  let elapsedMS = 0;
  let playing = false;
  let finished = false;
  let disposed = false;
  function active(): void {
    if (disposed) throw new Canvas2DError('DISPOSED', 'sprite animation is disposed');
  }
  return Object.freeze({
    get frameIndex() { return frameIndex; },
    get playing() { return playing; },
    get finished() { return finished; },
    play(): void { active(); if (!finished) playing = true; },
    pause(): void { active(); playing = false; },
    seek(index: number): void {
      active();
      if (typeof index !== 'number' || !Number.isInteger(index) || Object.is(index, -0) ||
          index < 0 || index >= sequence.length) invalid('sprite animation frame index is outside its range');
      select(index);
      frameIndex = index;
      elapsedMS = 0;
      finished = false;
    },
    advance(deltaMS: number): boolean {
      active();
      if (typeof deltaMS !== 'number' || !Number.isFinite(deltaMS) || Object.is(deltaMS, -0) ||
          deltaMS < 0 || deltaMS > 1000) invalid('sprite animation delta is outside its range');
      if (!playing || deltaMS === 0) return false;
      let nextIndex = frameIndex;
      let nextElapsed = elapsedMS + deltaMS;
      let nextPlaying: boolean = playing;
      let nextFinished: boolean = finished;
      while (nextElapsed >= sequence[nextIndex].durationMS) {
        nextElapsed -= sequence[nextIndex].durationMS;
        if (nextIndex === sequence.length - 1 && !loop) {
          nextElapsed = 0;
          nextPlaying = false;
          nextFinished = true;
          break;
        }
        nextIndex = (nextIndex + 1) % sequence.length;
      }
      const changed = nextIndex !== frameIndex;
      if (changed) select(nextIndex);
      frameIndex = nextIndex;
      elapsedMS = nextElapsed;
      playing = nextPlaying;
      finished = nextFinished;
      return changed;
    },
    dispose(): void {
      if (disposed) return;
      playing = false;
      disposed = true;
    },
  });
}
