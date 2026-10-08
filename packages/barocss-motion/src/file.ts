import { createMotionClip, type MotionClip } from './index.js';

export type MotionFileErrorCode =
  | 'INVALID_INPUT'
  | 'FILE_TOO_LARGE'
  | 'INVALID_JSON'
  | 'DUPLICATE_FIELD'
  | 'UNKNOWN_FIELD'
  | 'LIMIT_EXCEEDED'
  | 'INVALID_ENVELOPE'
  | 'INVALID_CLIP';

export class MotionFileError extends Error {
  readonly code: MotionFileErrorCode;

  constructor(code: MotionFileErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'MotionFileError';
    this.code = code;
  }
}

const MAX_BYTES = 1_048_576;
const MAX_DEPTH = 12;
const MAX_VALUES = 131_072;
const MAX_FIELDS = 16;
const MAX_STRING_LENGTH = 128;
const MAX_RAW_STRING_LENGTH = 770;
const numberPattern = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;

function error(code: MotionFileErrorCode, path: string, reason: string): never {
  throw new MotionFileError(code, `${path}: ${reason}`);
}

/** Count UTF-8 bytes without allocating an encoded copy of an untrusted file. */
function utf8Bytes(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else bytes += 3;
    } else bytes += 3;
    if (bytes > MAX_BYTES) error('FILE_TOO_LARGE', '$', 'UTF-8 text exceeds 1 MiB');
  }
  return bytes;
}

function numberToken(value: number): string {
  return Object.is(value, -0) ? '-0' : JSON.stringify(value);
}

/** Serialize only an adopted v0 clip. Caller objects are never stringified. */
export function serializeMotionClipFile(input: unknown): string {
  if (input === null || typeof input !== 'object') error('INVALID_INPUT', '$.clip', 'expected a clip object');
  let clip: MotionClip;
  try {
    clip = createMotionClip(input);
  } catch (cause) {
    error('INVALID_CLIP', '$.clip', cause instanceof Error ? cause.message : 'invalid clip');
  }
  const chunks: string[] = [];
  let bytes = 0;
  function write(chunk: string): void {
    // The clip admits ASCII IDs only. All generated JSON tokens are ASCII.
    bytes += chunk.length;
    if (bytes > MAX_BYTES) error('FILE_TOO_LARGE', '$', 'canonical output exceeds 1 MiB');
    chunks.push(chunk);
  }
  write('{"format":"barocss-motion","version":0,"lengthUnit":"mm","coordinateSystem":"part-xyz","clip":{');
  write('"version":0,"contextId":');
  write(JSON.stringify(clip.contextId));
  write(',"durationSeconds":');
  write(numberToken(clip.durationSeconds));
  write(',"tracks":[');
  for (const [trackIndex, track] of clip.tracks.entries()) {
    if (trackIndex) write(',');
    write('{"targetId":');
    write(JSON.stringify(track.targetId));
    write(',"property":');
    write(JSON.stringify(track.property));
    write(',"interpolation":');
    write(JSON.stringify(track.interpolation));
    write(',"keys":[');
    for (const [keyIndex, key] of track.keys.entries()) {
      if (keyIndex) write(',');
      write('{"timeSeconds":');
      write(numberToken(key.timeSeconds));
      write(',"value":[');
      for (const [componentIndex, component] of key.value.entries()) {
        if (componentIndex) write(',');
        write(numberToken(component));
      }
      write(']}');
    }
    write(']}');
  }
  write(']}}');
  return chunks.join('');
}

type Reader = (depth: number) => unknown;

/** A schema-directed JSON reader. It decodes one bounded string token at a time. */
class FileReader {
  private position = 0;
  private visited = 0;
  private totalKeys = 0;

  constructor(private readonly source: string) {}

  private enter(depth: number, path: string): void {
    if (depth > MAX_DEPTH) error('LIMIT_EXCEEDED', path, 'nesting exceeds 12 levels');
    this.visited += 1;
    if (this.visited > MAX_VALUES) error('LIMIT_EXCEEDED', path, 'more than 131072 values');
  }

  private whitespace(): void {
    while (this.position < this.source.length &&
      (this.source[this.position] === ' ' || this.source[this.position] === '\t' ||
       this.source[this.position] === '\r' || this.source[this.position] === '\n')) {
      this.position += 1;
    }
  }

  private take(character: string, path: string): void {
    this.whitespace();
    if (this.source[this.position] !== character) error('INVALID_JSON', path, `expected ${character}`);
    this.position += 1;
  }

  private string(path: string, depth: number): string {
    this.enter(depth, path);
    this.whitespace();
    if (this.source[this.position] !== '"') error('INVALID_JSON', path, 'expected a string');
    const start = this.position;
    this.position += 1;
    let escaped = false;
    while (this.position < this.source.length) {
      const code = this.source.charCodeAt(this.position);
      if (this.position - start > MAX_RAW_STRING_LENGTH) error('LIMIT_EXCEEDED', path, 'string token is too long');
      this.position += 1;
      if (escaped) { escaped = false; continue; }
      if (code === 0x5c) { escaped = true; continue; }
      if (code === 0x22) {
        const token = this.source.slice(start, this.position);
        let decoded: unknown;
        try { decoded = JSON.parse(token); }
        catch { error('INVALID_JSON', path, 'malformed string escape'); }
        if (typeof decoded !== 'string') error('INVALID_JSON', path, 'expected a string');
        if (decoded.length > MAX_STRING_LENGTH) error('LIMIT_EXCEEDED', path, 'string is too long');
        return decoded;
      }
      if (code < 0x20) error('INVALID_JSON', path, 'unescaped control character');
    }
    error('INVALID_JSON', path, 'unterminated string');
  }

  private number(path: string, depth: number): number {
    this.enter(depth, path);
    this.whitespace();
    numberPattern.lastIndex = this.position;
    const match = numberPattern.exec(this.source);
    if (!match) error('INVALID_JSON', path, 'expected a number');
    const token = match[0];
    if (token.length > 64) error('LIMIT_EXCEEDED', path, 'number token is too long');
    this.position = numberPattern.lastIndex;
    const value = Number(token);
    if (!Number.isFinite(value)) error('INVALID_JSON', path, 'nonfinite number');
    const mantissa = token.split(/[eE]/, 1)[0];
    if (value === 0 && /[1-9]/.test(mantissa)) error('INVALID_JSON', path, 'underflowed number');
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) error('INVALID_JSON', path, 'unsafe integer');
    return value;
  }

  private object(path: string, depth: number, readers: Record<string, Reader>, missingCode: MotionFileErrorCode): Record<string, unknown> {
    this.enter(depth, path);
    this.take('{', path);
    const result: Record<string, unknown> = Object.create(null);
    const seen = new Set<string>();
    this.whitespace();
    if (this.source[this.position] === '}') this.position += 1;
    else {
      while (true) {
        if (seen.size >= MAX_FIELDS) error('LIMIT_EXCEEDED', path, 'more than 16 fields');
        const field = this.string(`${path}.field`, depth + 1);
        if (seen.has(field)) error('DUPLICATE_FIELD', path, `duplicate ${field}`);
        if (!Object.hasOwn(readers, field)) error('UNKNOWN_FIELD', path, `unsupported ${field}`);
        seen.add(field);
        this.take(':', `${path}.${field}`);
        result[field] = readers[field](depth + 1);
        this.whitespace();
        const separator = this.source[this.position];
        if (separator === '}') { this.position += 1; break; }
        if (separator !== ',') error('INVALID_JSON', path, 'expected comma or closing brace');
        this.position += 1;
      }
    }
    for (const field of Object.keys(readers)) {
      if (!seen.has(field)) error(missingCode, path, `missing ${field}`);
    }
    return result;
  }

  private array(path: string, depth: number, max: number, min: number, reader: (index: number, depth: number) => unknown): unknown[] {
    this.enter(depth, path);
    this.take('[', path);
    const result: unknown[] = [];
    this.whitespace();
    if (this.source[this.position] === ']') this.position += 1;
    else {
      while (true) {
        if (result.length >= max) error('LIMIT_EXCEEDED', path, `more than ${max} entries`);
        result.push(reader(result.length, depth + 1));
        this.whitespace();
        const separator = this.source[this.position];
        if (separator === ']') { this.position += 1; break; }
        if (separator !== ',') error('INVALID_JSON', path, 'expected comma or closing bracket');
        this.position += 1;
      }
    }
    if (result.length < min) error('INVALID_CLIP', path, `requires at least ${min} entries`);
    return result;
  }

  private key(path: string, depth: number): Record<string, unknown> {
    this.totalKeys += 1;
    if (this.totalKeys > 4096) error('LIMIT_EXCEEDED', path, 'more than 4096 keys');
    return this.object(path, depth, {
      timeSeconds: (next) => this.number(`${path}.timeSeconds`, next),
      value: (next) => this.array(`${path}.value`, next, 4, 3,
        (index, componentDepth) => this.number(`${path}.value[${index}]`, componentDepth)),
    }, 'INVALID_CLIP');
  }

  private track(path: string, depth: number): Record<string, unknown> {
    return this.object(path, depth, {
      targetId: (next) => this.string(`${path}.targetId`, next),
      property: (next) => this.string(`${path}.property`, next),
      interpolation: (next) => this.string(`${path}.interpolation`, next),
      keys: (next) => this.array(`${path}.keys`, next, 256, 1,
        (index, keyDepth) => this.key(`${path}.keys[${index}]`, keyDepth)),
    }, 'INVALID_CLIP');
  }

  private clip(path: string, depth: number): Record<string, unknown> {
    return this.object(path, depth, {
      version: (next) => this.number(`${path}.version`, next),
      contextId: (next) => this.string(`${path}.contextId`, next),
      durationSeconds: (next) => this.number(`${path}.durationSeconds`, next),
      tracks: (next) => this.array(`${path}.tracks`, next, 192, 1,
        (index, trackDepth) => this.track(`${path}.tracks[${index}]`, trackDepth)),
    }, 'INVALID_CLIP');
  }

  read(): Record<string, unknown> {
    const result = this.object('$', 1, {
      format: (next) => this.string('$.format', next),
      version: (next) => this.number('$.version', next),
      lengthUnit: (next) => this.string('$.lengthUnit', next),
      coordinateSystem: (next) => this.string('$.coordinateSystem', next),
      clip: (next) => this.clip('$.clip', next),
    }, 'INVALID_ENVELOPE');
    this.whitespace();
    if (this.position !== this.source.length) error('INVALID_JSON', '$', 'trailing data');
    return result;
  }
}

/** Parse a bounded .baromotion JSON asset into a fresh validated clip. */
export function parseMotionClipFile(text: string): MotionClip {
  if (typeof text !== 'string') error('INVALID_INPUT', '$', 'expected text');
  utf8Bytes(text);
  const envelope = new FileReader(text).read();
  if (envelope.format !== 'barocss-motion' || envelope.version !== 0 ||
      envelope.lengthUnit !== 'mm' || envelope.coordinateSystem !== 'part-xyz') {
    error('INVALID_ENVELOPE', '$', 'unsupported format, version, unit or coordinate system');
  }
  try {
    return createMotionClip(envelope.clip);
  } catch (cause) {
    error('INVALID_CLIP', '$.clip', cause instanceof Error ? cause.message : 'invalid clip');
  }
}
