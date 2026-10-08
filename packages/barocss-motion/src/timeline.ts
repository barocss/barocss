import {
  createMotionPlayer,
  type MotionClip,
  type MotionPlayer,
  type MotionPlayerState,
  type PlaybackMode,
} from './index.js';

export type MotionTimelineErrorCode =
  | 'INVALID_INPUT'
  | 'DUPLICATE_MARKER'
  | 'UNKNOWN_TARGET'
  | 'LIMIT_EXCEEDED'
  | 'DISPOSED';

export class MotionTimelineError extends Error {
  readonly code: MotionTimelineErrorCode;

  constructor(code: MotionTimelineErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'MotionTimelineError';
    this.code = code;
  }
}

export interface MotionMarkerInput {
  readonly contextId: string;
  readonly id: string;
  readonly timeSeconds: number;
  readonly label?: string;
  readonly targetId?: string;
}

export interface MotionTimelineOptions {
  readonly version: 0;
  readonly markers: readonly MotionMarkerInput[];
  readonly mode: PlaybackMode;
}

export interface MotionTimelineEvent extends MotionMarkerInput {
  readonly iteration: number;
  readonly markerIndex: number;
}

export interface MotionTimelineState extends MotionPlayerState {
  readonly iteration: number;
  readonly events: MotionTimelineEvent[];
}

export interface MotionTimeline {
  getState(): MotionTimelineState;
  play(): MotionTimelineState;
  pause(): MotionTimelineState;
  seek(timeSeconds: number): MotionTimelineState;
  advance(deltaSeconds: number): MotionTimelineState;
  setMode(mode: PlaybackMode): MotionTimelineState;
  dispose(): void;
}

interface OwnedMarker extends MotionMarkerInput {
  readonly markerIndex: number;
}

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function fail(code: MotionTimelineErrorCode, path: string, reason: string): never {
  throw new MotionTimelineError(code, `${path}: ${reason}`);
}

function record(value: unknown, required: readonly string[], optional: readonly string[], path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object') fail('INVALID_INPUT', path, 'expected a plain record');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail('INVALID_INPUT', path, 'expected a plain record');
  const keys = Reflect.ownKeys(value);
  if (keys.length < required.length || keys.length > required.length + optional.length ||
      keys.some((key) => typeof key !== 'string' || ![...required, ...optional].includes(key)) ||
      required.some((key) => !Object.hasOwn(value, key))) {
    fail('INVALID_INPUT', path, 'missing or unsupported fields');
  }
  const copy: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail('INVALID_INPUT', `${path}.${String(key)}`, 'accessor is unsupported');
    copy[key as string] = descriptor.value;
  }
  return copy;
}

function markerArray(value: unknown): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    fail('INVALID_INPUT', 'markers', 'expected an array');
  }
  const length = Object.getOwnPropertyDescriptor(value, 'length')?.value;
  if (!Number.isInteger(length) || length < 0 || length > 256) {
    fail('LIMIT_EXCEEDED', 'markers', 'at most 256 markers are allowed');
  }
  const markers: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !('value' in descriptor)) fail('INVALID_INPUT', `markers[${index}]`, 'hole or accessor is unsupported');
    markers.push(descriptor.value);
  }
  if (Reflect.ownKeys(value).length !== length + 1) fail('INVALID_INPUT', 'markers', 'unsupported array fields');
  return markers;
}

function exactId(value: unknown, path: string): string {
  if (typeof value !== 'string' || !idPattern.test(value)) fail('INVALID_INPUT', path, 'expected a 1..128 ASCII ID');
  return value;
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20) fail('INVALID_INPUT', 'label', 'control characters are unsupported');
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) { bytes += 4; index += 1; }
      else bytes += 3;
    } else bytes += 3;
    if (bytes > 256) fail('LIMIT_EXCEEDED', 'label', 'more than 256 UTF-8 bytes');
  }
  return bytes;
}

function exactMode(value: unknown): PlaybackMode {
  if (value !== 'clamp' && value !== 'repeat') fail('INVALID_INPUT', 'mode', 'expected clamp or repeat');
  return value;
}

function exactTime(value: unknown, maximum: number, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum) {
    fail('INVALID_INPUT', path, `expected a finite time in [0, ${maximum}]`);
  }
  return value;
}

/** Wrap an owned clip/player with bounded, caller-driven marker crossings. */
export function createMotionTimeline(clip: MotionClip, options: MotionTimelineOptions): MotionTimeline {
  const raw = record(options, ['version', 'markers', 'mode'], [], 'timeline options');
  if (raw.version !== 0) fail('INVALID_INPUT', 'version', 'expected version 0');
  const mode = exactMode(raw.mode);
  let player: MotionPlayer | null;
  try { player = createMotionPlayer(clip, { mode }); }
  catch { fail('INVALID_INPUT', 'clip', 'expected a validated MotionClip'); }

  const contextId = clip.contextId;
  const duration = clip.durationSeconds;
  const targets = new Set(clip.tracks.map((track) => track.targetId));
  const ids = new Set<string>();
  let markers: OwnedMarker[] = markerArray(raw.markers).map((source, markerIndex) => {
    const path = `markers[${markerIndex}]`;
    const fields = record(source, ['contextId', 'id', 'timeSeconds'], ['label', 'targetId'], path);
    if (exactId(fields.contextId, `${path}.contextId`) !== contextId) {
      fail('INVALID_INPUT', `${path}.contextId`, 'must match the clip context');
    }
    const id = exactId(fields.id, `${path}.id`);
    if (ids.has(id)) fail('DUPLICATE_MARKER', `${path}.id`, 'duplicate marker ID');
    ids.add(id);
    const timeSeconds = exactTime(fields.timeSeconds, duration, `${path}.timeSeconds`);
    const marker: {
      contextId: string; id: string; timeSeconds: number; markerIndex: number;
      label?: string; targetId?: string;
    } = { contextId, id, timeSeconds, markerIndex };
    if (Object.hasOwn(fields, 'label')) {
      if (typeof fields.label !== 'string' || utf8ByteLength(fields.label) === 0) {
        fail('INVALID_INPUT', `${path}.label`, 'expected 1..256 UTF-8 bytes');
      }
      marker.label = fields.label;
    }
    if (Object.hasOwn(fields, 'targetId')) {
      const targetId = exactId(fields.targetId, `${path}.targetId`);
      if (!targets.has(targetId)) fail('UNKNOWN_TARGET', `${path}.targetId`, 'not in clip');
      marker.targetId = targetId;
    }
    return Object.freeze(marker);
  });
  markers.sort((a, b) => a.timeSeconds - b.timeSeconds || a.markerIndex - b.markerIndex);
  let iteration = 0;

  function active(): MotionPlayer {
    if (!player) fail('DISPOSED', 'timeline', 'already disposed');
    return player;
  }

  function state(events: MotionTimelineEvent[] = []): MotionTimelineState {
    const current = active().getState();
    return { ...current, iteration, events: events.map((event) => ({ ...event })) };
  }

  function event(marker: OwnedMarker, pass: number): MotionTimelineEvent {
    return {
      contextId: marker.contextId,
      id: marker.id,
      timeSeconds: marker.timeSeconds,
      iteration: pass,
      markerIndex: marker.markerIndex,
      ...(marker.label === undefined ? {} : { label: marker.label }),
      ...(marker.targetId === undefined ? {} : { targetId: marker.targetId }),
    };
  }

  return {
    getState: () => state(),
    play() {
      const before = active().getState();
      if (before.mode === 'clamp' && duration > 0 && before.timeSeconds === duration) iteration = 0;
      active().play();
      return state();
    },
    pause() {
      active().pause();
      return state();
    },
    seek(timeSeconds: number) {
      const current = active();
      exactTime(timeSeconds, duration, 'seek timeSeconds');
      current.seek(timeSeconds);
      iteration = 0;
      return state();
    },
    setMode(nextMode: PlaybackMode) {
      const current = active();
      const checked = exactMode(nextMode);
      current.setMode(checked);
      return state();
    },
    advance(deltaSeconds: number) {
      const current = active();
      const before = current.getState();
      if (typeof deltaSeconds !== 'number' || !Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
        fail('INVALID_INPUT', 'deltaSeconds', 'expected a finite nonnegative number');
      }
      if (!before.playing || deltaSeconds === 0) return state();
      const next = before.timeSeconds + deltaSeconds;
      if (!Number.isFinite(next) || next <= before.timeSeconds) {
        fail('LIMIT_EXCEEDED', 'deltaSeconds', 'time arithmetic cannot advance safely');
      }
      if (duration === 0) {
        current.advance(deltaSeconds);
        return state();
      }
      const loops = before.mode === 'repeat' ? Math.floor(next / duration) : 0;
      if (!Number.isSafeInteger(loops) || loops > 16 || !Number.isSafeInteger(iteration + loops)) {
        fail('LIMIT_EXCEEDED', 'deltaSeconds', 'more than 16 seams or unsafe iteration');
      }
      const delivered: MotionTimelineEvent[] = [];
      function add(marker: OwnedMarker, pass: number): void {
        if (delivered.length >= 256) fail('LIMIT_EXCEEDED', 'events', 'more than 256 events');
        delivered.push(event(marker, pass));
      }
      function range(startExclusive: number, endInclusive: number, pass: number): void {
        for (const marker of markers) {
          if (marker.timeSeconds > startExclusive && marker.timeSeconds <= endInclusive) add(marker, pass);
        }
      }
      function start(pass: number): void {
        for (const marker of markers) {
          if (marker.timeSeconds !== 0) break;
          add(marker, pass);
        }
      }
      if (before.mode === 'clamp') {
        range(before.timeSeconds, Math.min(next, duration), iteration);
      } else if (loops === 0) {
        range(before.timeSeconds, next, iteration);
      } else {
        range(before.timeSeconds, duration, iteration);
        for (let pass = 1; pass <= loops; pass += 1) {
          start(iteration + pass);
          range(0, pass === loops ? next % duration : duration, iteration + pass);
        }
      }
      // Every bound and event has been checked before the underlying player changes.
      current.advance(deltaSeconds);
      iteration += loops;
      return state(delivered);
    },
    dispose() {
      if (!player) return;
      player.dispose();
      player = null;
      markers = [];
    },
  };
}
