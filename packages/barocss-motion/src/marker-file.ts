import { createMotionPlayer, type MotionClip } from './index.js';
import { copyMotionMarkers, type MotionMarkerInput } from './timeline.js';

export type MotionMarkerFileErrorCode =
  | 'INVALID_INPUT'
  | 'FILE_LIMIT'
  | 'INVALID_JSON'
  | 'UNSUPPORTED_FORMAT'
  | 'INCOMPATIBLE_CLIP'
  | 'INVALID_MARKER';

export class MotionMarkerFileError extends Error {
  readonly code: MotionMarkerFileErrorCode;

  constructor(code: MotionMarkerFileErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'MotionMarkerFileError';
    this.code = code;
  }
}

const MAX_BYTES = 262_144;
const MAX_DEPTH = 12;
const MAX_VALUES = 16_384;
const MAX_MARKERS = 256;
const MAX_STRING_UNITS = 256;
const MAX_RAW_STRING_UNITS = 1_538;
const numberPattern = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;

function fail(code: MotionMarkerFileErrorCode, path: string, reason: string): never {
  throw new MotionMarkerFileError(code, `${path}: ${reason}`);
}

function utf8Bytes(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) { bytes += 4; index += 1; }
      else bytes += 3;
    } else bytes += 3;
    if (bytes > MAX_BYTES) fail('FILE_LIMIT', '$', 'UTF-8 text exceeds 262144 bytes');
  }
  return bytes;
}

function actualClip(clip: MotionClip): MotionClip {
  try {
    const validator = createMotionPlayer(clip, { mode: 'clamp' });
    validator.dispose();
  } catch {
    fail('INVALID_INPUT', 'clip', 'expected a validated MotionClip');
  }
  return clip;
}

function markersFor(clip: MotionClip, input: unknown): MotionMarkerInput[] {
  try {
    return copyMotionMarkers(clip, input).map((source) => ({
      contextId: source.contextId,
      id: source.id,
      timeSeconds: source.timeSeconds,
      ...(source.label === undefined ? {} : { label: source.label }),
      ...(source.targetId === undefined ? {} : { targetId: source.targetId }),
    }));
  } catch {
    fail('INVALID_MARKER', 'markers', 'expected markers accepted by the v0 timeline');
  }
}

function numberToken(value: number): string {
  return Object.is(value, -0) ? '-0' : JSON.stringify(value);
}

/** Serialize validated markers without reading caller getters or changing a timeline. */
export function serializeMotionMarkerFile(clip: MotionClip, markers: readonly MotionMarkerInput[]): string {
  const ownedClip = actualClip(clip);
  const owned = markersFor(ownedClip, markers);
  const chunks: string[] = [];
  let bytes = 0;
  function write(chunk: string): void {
    bytes += utf8Bytes(chunk);
    if (bytes > MAX_BYTES) fail('FILE_LIMIT', '$', 'canonical output exceeds 262144 bytes');
    chunks.push(chunk);
  }
  write('{"format":"barocss-motion-markers","version":0,"timeUnit":"seconds","contextId":');
  write(JSON.stringify(ownedClip.contextId));
  write(',"durationSeconds":');
  write(numberToken(ownedClip.durationSeconds));
  write(',"markers":[');
  for (const [index, marker] of owned.entries()) {
    if (index) write(',');
    write('{"contextId":');
    write(JSON.stringify(marker.contextId));
    write(',"id":');
    write(JSON.stringify(marker.id));
    write(',"timeSeconds":');
    write(numberToken(marker.timeSeconds));
    if (marker.label !== undefined) {
      write(',"label":');
      write(JSON.stringify(marker.label));
    }
    if (marker.targetId !== undefined) {
      write(',"targetId":');
      write(JSON.stringify(marker.targetId));
    }
    write('}');
  }
  write(']}');
  return chunks.join('');
}

type Reader = (depth: number) => unknown;

/** A bounded reader for only the marker-sidecar schema. */
class MarkerFileReader {
  private position = 0;
  private visited = 0;

  constructor(private readonly source: string) {}

  private enter(depth: number, path: string): void {
    if (depth > MAX_DEPTH) fail('FILE_LIMIT', path, 'nesting exceeds 12 levels');
    this.visited += 1;
    if (this.visited > MAX_VALUES) fail('FILE_LIMIT', path, 'more than 16384 tokens');
  }

  private whitespace(): void {
    while (this.position < this.source.length &&
      (this.source[this.position] === ' ' || this.source[this.position] === '\t' ||
       this.source[this.position] === '\r' || this.source[this.position] === '\n')) {
      this.position += 1;
    }
  }

  private take(character: string, path: string, code: MotionMarkerFileErrorCode = 'INVALID_JSON'): void {
    this.whitespace();
    if (this.source[this.position] !== character) fail(code, path, `expected ${character}`);
    this.position += 1;
  }

  private string(path: string, depth: number, typeCode: MotionMarkerFileErrorCode = 'INVALID_JSON'): string {
    this.enter(depth, path);
    this.whitespace();
    if (this.source[this.position] !== '"') fail(typeCode, path, 'expected a string');
    const start = this.position;
    this.position += 1;
    let escaped = false;
    while (this.position < this.source.length) {
      if (this.position - start >= MAX_RAW_STRING_UNITS) fail('FILE_LIMIT', path, 'string token is too long');
      const code = this.source.charCodeAt(this.position);
      this.position += 1;
      if (escaped) { escaped = false; continue; }
      if (code === 0x5c) { escaped = true; continue; }
      if (code === 0x22) {
        let decoded: unknown;
        try { decoded = JSON.parse(this.source.slice(start, this.position)); }
        catch { fail('INVALID_JSON', path, 'malformed string escape'); }
        if (typeof decoded !== 'string') fail('INVALID_JSON', path, 'expected a string');
        if (decoded.length > MAX_STRING_UNITS) fail('FILE_LIMIT', path, 'decoded string is too long');
        return decoded;
      }
      if (code < 0x20) fail('INVALID_JSON', path, 'unescaped control character');
    }
    fail('INVALID_JSON', path, 'unterminated string');
  }

  private number(path: string, depth: number, typeCode: MotionMarkerFileErrorCode): number {
    this.enter(depth, path);
    this.whitespace();
    numberPattern.lastIndex = this.position;
    const match = numberPattern.exec(this.source);
    if (!match) fail(typeCode, path, 'expected a number');
    const token = match[0];
    if (token.length > 64) fail('FILE_LIMIT', path, 'number token is too long');
    this.position = numberPattern.lastIndex;
    const value = Number(token);
    if (!Number.isFinite(value)) fail('INVALID_JSON', path, 'nonfinite number');
    const mantissa = token.split(/[eE]/, 1)[0];
    if (value === 0 && /[1-9]/.test(mantissa)) fail('INVALID_JSON', path, 'underflowed number');
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) fail('INVALID_JSON', path, 'unsafe integer');
    return value;
  }

  private object(
    path: string, depth: number, readers: Record<string, Reader>, required: readonly string[],
    schemaCode: MotionMarkerFileErrorCode,
  ): Record<string, unknown> {
    this.enter(depth, path);
    this.take('{', path, schemaCode);
    const result: Record<string, unknown> = Object.create(null);
    const seen = new Set<string>();
    this.whitespace();
    if (this.source[this.position] === '}') this.position += 1;
    else {
      while (true) {
        const field = this.string(`${path}.field`, depth + 1);
        if (seen.has(field)) fail('INVALID_JSON', path, 'duplicate decoded member');
        if (!Object.hasOwn(readers, field)) fail(schemaCode, path, 'unsupported member');
        seen.add(field);
        this.take(':', path);
        result[field] = readers[field](depth + 1);
        this.whitespace();
        const separator = this.source[this.position];
        if (separator === '}') { this.position += 1; break; }
        if (separator !== ',') fail('INVALID_JSON', path, 'expected comma or closing brace');
        this.position += 1;
      }
    }
    for (const field of required) {
      if (!seen.has(field)) fail(schemaCode, path, `missing ${field}`);
    }
    return result;
  }

  private array(path: string, depth: number): unknown[] {
    this.enter(depth, path);
    this.take('[', path, 'UNSUPPORTED_FORMAT');
    const result: unknown[] = [];
    this.whitespace();
    if (this.source[this.position] === ']') this.position += 1;
    else {
      while (true) {
        if (result.length >= MAX_MARKERS) fail('FILE_LIMIT', path, 'more than 256 markers');
        result.push(this.marker(`${path}[${result.length}]`, depth + 1));
        this.whitespace();
        const separator = this.source[this.position];
        if (separator === ']') { this.position += 1; break; }
        if (separator !== ',') fail('INVALID_JSON', path, 'expected comma or closing bracket');
        this.position += 1;
      }
    }
    return result;
  }

  private marker(path: string, depth: number): Record<string, unknown> {
    return this.object(path, depth, {
      contextId: (next) => this.string(`${path}.contextId`, next, 'INVALID_MARKER'),
      id: (next) => this.string(`${path}.id`, next, 'INVALID_MARKER'),
      timeSeconds: (next) => this.number(`${path}.timeSeconds`, next, 'INVALID_MARKER'),
      label: (next) => this.string(`${path}.label`, next, 'INVALID_MARKER'),
      targetId: (next) => this.string(`${path}.targetId`, next, 'INVALID_MARKER'),
    }, ['contextId', 'id', 'timeSeconds'], 'INVALID_MARKER');
  }

  read(): Record<string, unknown> {
    const result = this.object('$', 1, {
      format: (next) => this.string('$.format', next, 'UNSUPPORTED_FORMAT'),
      version: (next) => this.number('$.version', next, 'UNSUPPORTED_FORMAT'),
      timeUnit: (next) => this.string('$.timeUnit', next, 'UNSUPPORTED_FORMAT'),
      contextId: (next) => this.string('$.contextId', next, 'UNSUPPORTED_FORMAT'),
      durationSeconds: (next) => this.number('$.durationSeconds', next, 'UNSUPPORTED_FORMAT'),
      markers: (next) => this.array('$.markers', next),
    }, ['format', 'version', 'timeUnit', 'contextId', 'durationSeconds', 'markers'], 'UNSUPPORTED_FORMAT');
    this.whitespace();
    if (this.position !== this.source.length) fail('INVALID_JSON', '$', 'trailing data');
    return result;
  }
}

/** Parse a .baromarkers sidecar and return independently owned marker records. */
export function parseMotionMarkerFile(text: string, clip: MotionClip): MotionMarkerInput[] {
  if (typeof text !== 'string') fail('INVALID_INPUT', '$', 'expected text');
  const ownedClip = actualClip(clip);
  utf8Bytes(text);
  const envelope = new MarkerFileReader(text).read();
  if (envelope.format !== 'barocss-motion-markers' || envelope.version !== 0 ||
      Object.is(envelope.version, -0) || envelope.timeUnit !== 'seconds') {
    fail('UNSUPPORTED_FORMAT', '$', 'unsupported format, version or time unit');
  }
  if (envelope.contextId !== ownedClip.contextId || envelope.durationSeconds !== ownedClip.durationSeconds) {
    fail('INCOMPATIBLE_CLIP', '$', 'context or duration differs from clip');
  }
  return markersFor(ownedClip, envelope.markers);
}
