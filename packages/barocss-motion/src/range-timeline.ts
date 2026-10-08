import { createMotionPlayer, sampleMotionClip, type MotionClip, type PlaybackMode } from './index.js';
import {
  copyMotionMarkers, MotionTimelineError,
  type MotionMarkerInput, type MotionTimelineEvent, type MotionTimelineState,
} from './timeline.js';

export interface MotionRangeTimelineOptions {
  readonly range: readonly [number, number];
  readonly markers: readonly MotionMarkerInput[];
  readonly mode: PlaybackMode;
}

export interface MotionRangeTimelineState extends MotionTimelineState {
  readonly range: [number, number];
}

export interface MotionRangeTimeline {
  getState(): MotionRangeTimelineState;
  play(): MotionRangeTimelineState;
  pause(): MotionRangeTimelineState;
  seek(timeSeconds: number): MotionRangeTimelineState;
  advance(deltaSeconds: number): MotionRangeTimelineState;
  setMode(mode: PlaybackMode): MotionRangeTimelineState;
  dispose(): void;
}

function fail(code: MotionTimelineError['code'], path: string, reason: string): never {
  throw new MotionTimelineError(code, `${path}: ${reason}`);
}

function ownOptions(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_INPUT', 'options', 'expected a plain range timeline record');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail('INVALID_INPUT', 'options', 'expected a plain range timeline record');
  }
  const fields = ['range', 'markers', 'mode'];
  const keys = Reflect.ownKeys(value);
  if (keys.length !== fields.length || keys.some((key) => typeof key !== 'string' || !fields.includes(key))) {
    fail('INVALID_INPUT', 'options', 'expected exactly range, markers and mode');
  }
  const result: Record<string, unknown> = Object.create(null);
  for (const field of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    if (!descriptor || !('value' in descriptor)) fail('INVALID_INPUT', `options.${field}`, 'expected an own data field');
    result[field] = descriptor.value;
  }
  return result;
}

function ownRange(value: unknown, duration: number): [number, number] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype ||
      Object.getOwnPropertyDescriptor(value, 'length')?.value !== 2 || Reflect.ownKeys(value).length !== 3) {
    fail('INVALID_INPUT', 'range', 'expected an exact two-element array');
  }
  const values = [0, 1].map((index) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !('value' in descriptor)) fail('INVALID_INPUT', `range[${index}]`, 'expected an own data element');
    const time = descriptor.value;
    if (typeof time !== 'number' || !Number.isFinite(time) || time < 0 || time > duration) {
      fail('INVALID_INPUT', `range[${index}]`, 'expected a finite time within the clip');
    }
    return time;
  }) as [number, number];
  if (duration === 0 ? values[0] !== 0 || values[1] !== 0 : values[0] >= values[1]) {
    fail('INVALID_INPUT', 'range', 'expected start < end, or [0, 0] for a zero-duration clip');
  }
  return values;
}

function ownMode(value: unknown): PlaybackMode {
  if (value !== 'clamp' && value !== 'repeat') fail('INVALID_INPUT', 'mode', 'expected clamp or repeat');
  return value;
}

/** Play and deliver admitted markers within an original-absolute-time range. */
export function createMotionRangeTimeline(clip: MotionClip, options: MotionRangeTimelineOptions): MotionRangeTimeline {
  const fields = ownOptions(options);
  const mode = ownMode(fields.mode);
  try {
    const validator = createMotionPlayer(clip, { mode });
    validator.dispose();
  } catch {
    fail('INVALID_INPUT', 'clip', 'expected a validated MotionClip');
  }
  const range = ownRange(fields.range, clip.durationSeconds);
  let markers = copyMotionMarkers(clip, fields.markers);
  markers.sort((left, right) => left.timeSeconds - right.timeSeconds || left.markerIndex - right.markerIndex);
  let currentClip: MotionClip | null = clip;
  let currentMode = mode;
  let currentTime = range[0] === 0 ? 0 : range[0];
  let playing = false;
  let iteration = 0;
  const [startTime, endTime] = range;
  const span = endTime - startTime;

  function active(): MotionClip {
    if (!currentClip) fail('DISPOSED', 'range timeline', 'already disposed');
    return currentClip;
  }

  function state(events: MotionTimelineEvent[] = []): MotionRangeTimelineState {
    const frame = sampleMotionClip(active(), currentTime);
    return {
      ...frame, playing, mode: currentMode, iteration, range: [...range],
      events: events.map((event) => ({ ...event })),
    };
  }

  function event(marker: (typeof markers)[number], pass: number): MotionTimelineEvent {
    return {
      contextId: marker.contextId, id: marker.id, timeSeconds: marker.timeSeconds,
      iteration: pass, markerIndex: marker.markerIndex,
      ...(marker.label === undefined ? {} : { label: marker.label }),
      ...(marker.targetId === undefined ? {} : { targetId: marker.targetId }),
    };
  }

  return {
    getState: () => state(),
    play() {
      active();
      if (currentMode === 'clamp' && span > 0 && currentTime === endTime) {
        currentTime = startTime === 0 ? 0 : startTime;
        iteration = 0;
      }
      playing = true;
      return state();
    },
    pause() {
      active();
      playing = false;
      return state();
    },
    seek(timeSeconds: number) {
      active();
      if (typeof timeSeconds !== 'number' || !Number.isFinite(timeSeconds) ||
          timeSeconds < startTime || timeSeconds > endTime) {
        fail('INVALID_INPUT', 'seek timeSeconds', 'expected a finite time within the range');
      }
      currentTime = timeSeconds;
      iteration = 0;
      return state();
    },
    setMode(nextMode: PlaybackMode) {
      active();
      currentMode = ownMode(nextMode);
      return state();
    },
    advance(deltaSeconds: number) {
      active();
      if (typeof deltaSeconds !== 'number' || !Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
        fail('INVALID_INPUT', 'deltaSeconds', 'expected a finite nonnegative number');
      }
      if (!playing || deltaSeconds === 0) return state();
      if (span === 0) {
        currentTime = 0;
        return state();
      }
      const elapsed = currentTime - startTime;
      const next = elapsed + deltaSeconds;
      if (!Number.isFinite(next) || next <= elapsed) {
        fail('LIMIT_EXCEEDED', 'deltaSeconds', 'time arithmetic cannot advance safely');
      }
      const loops = currentMode === 'repeat' ? Math.floor(next / span) : 0;
      if (!Number.isSafeInteger(loops) || loops > 16 || !Number.isSafeInteger(iteration + loops)) {
        fail('LIMIT_EXCEEDED', 'deltaSeconds', 'more than 16 seams or unsafe iteration');
      }
      const delivered: MotionTimelineEvent[] = [];
      function add(marker: (typeof markers)[number], pass: number): void {
        if (delivered.length >= 256) fail('LIMIT_EXCEEDED', 'events', 'more than 256 events');
        delivered.push(event(marker, pass));
      }
      function crossings(startExclusive: number, endInclusive: number, pass: number): void {
        for (const marker of markers) {
          if (marker.timeSeconds > startExclusive && marker.timeSeconds <= endInclusive) add(marker, pass);
        }
      }
      function start(pass: number): void {
        for (const marker of markers) {
          if (marker.timeSeconds === startTime) add(marker, pass);
        }
      }

      let nextTime: number;
      let nextPlaying: boolean = playing;
      if (currentMode === 'clamp') {
        nextTime = Math.min(startTime + next, endTime);
        if (currentTime !== endTime) {
          if (nextTime <= currentTime) fail('LIMIT_EXCEEDED', 'deltaSeconds', 'time arithmetic cannot advance safely');
          crossings(currentTime, nextTime, iteration);
        }
        if (nextTime === endTime) nextPlaying = false;
      } else if (loops === 0) {
        nextTime = startTime + next;
        if (nextTime <= currentTime) fail('LIMIT_EXCEEDED', 'deltaSeconds', 'time arithmetic cannot advance safely');
        crossings(currentTime, nextTime, iteration);
      } else {
        crossings(currentTime, endTime, iteration);
        for (let pass = 1; pass <= loops; pass += 1) {
          start(iteration + pass);
          crossings(startTime, pass === loops ? startTime + next % span : endTime, iteration + pass);
        }
        nextTime = startTime + next % span;
      }
      if (!Number.isFinite(nextTime) || nextTime < startTime || nextTime > endTime) {
        fail('LIMIT_EXCEEDED', 'deltaSeconds', 'computed time is outside the range');
      }
      currentTime = nextTime;
      playing = nextPlaying;
      iteration += loops;
      return state(delivered);
    },
    dispose() {
      if (!currentClip) return;
      currentClip = null;
      markers = [];
      currentTime = 0;
      playing = false;
    },
  };
}
