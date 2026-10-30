import { BarocssError } from '@barocss/cad/api';

/** Internal reader for unhinted, static TrueType outlines. Coordinates remain in font design units. */
export type TrueTypeErrorCode = 'TTF_INPUT' | 'TTF_UNSUPPORTED' | 'TTF_MALFORMED' | 'TTF_MISSING_GLYPH' | 'TTF_BUDGET' | 'TTF_CYCLE';
export type TrueTypeError = BarocssError & { readonly code: TrueTypeErrorCode };
export interface TrueTypePoint { readonly x: number; readonly y: number; readonly onCurve: boolean }
export interface TrueTypeFontMetrics {
  readonly unitsPerEm: number;
  readonly glyphCount: number;
  readonly ascender: number;
  readonly descender: number;
  readonly lineGap: number;
}
export interface TrueTypeGlyph {
  readonly codePoint: number;
  readonly glyphId: number;
  readonly advance: number;
  readonly leftSideBearing: number;
  readonly contours: readonly (readonly TrueTypePoint[])[];
  readonly composite: boolean;
  /** A declared overlap flag; false does not establish that contours are disjoint. */
  readonly overlap: boolean;
}
export interface TrueTypeFont {
  readonly metrics: TrueTypeFontMetrics;
  glyph(codePoint: number): TrueTypeGlyph;
  copyBytes(): Uint8Array;
}

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_TABLES = 64;
const MAX_CMAP_RECORDS = 64;
const MAX_CMAP_GROUPS = 65536;
const MAX_POINTS = 65536;
const MAX_CONTOURS = 4096;
const MAX_COMPONENTS = 256;
const MAX_VISITS = 512;
const MAX_DEPTH = 16;
const MAX_COORDINATE = 2 ** 31;
const byteLengthOf = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), 'byteLength')!.get!;

interface Table { offset: number; length: number }
interface Cmap { format: 4 | 12; offset: number; length: number; count: number }
interface Context {
  bytes: Uint8Array;
  view: DataView;
  metrics: TrueTypeFontMetrics;
  hmtx: Table;
  hMetrics: number;
  glyf: Table;
  loca: Uint32Array;
  cmap: Cmap;
}
interface Budget { points: number; contours: number; components: number; visits: number; active: Set<number> }
interface Outline { contours: TrueTypePoint[][]; composite: boolean; overlap: boolean }

function fail(code: TrueTypeErrorCode, message: string, glyphId?: number): never {
  throw new BarocssError(code, message, undefined, { source: 'true-type', ...(glyphId === undefined ? {} : { glyphId }) });
}
export function isTrueTypeError(error: unknown): error is TrueTypeError {
  return error instanceof BarocssError && error.details?.source === 'true-type';
}
function extent(offset: number, length: number, end: number): void {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset > end || length > end - offset) {
    fail('TTF_MALFORMED', 'Font data extends beyond its enclosing block.');
  }
}
function required(tables: Map<string, Table>, tag: string, minimum: number): Table {
  const table = tables.get(tag);
  if (!table || table.length < minimum) fail('TTF_MALFORMED', `Missing or short ${tag} table.`);
  return table;
}
function tagAt(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}
function readTables(bytes: Uint8Array, view: DataView): Map<string, Table> {
  extent(0, 12, bytes.length);
  if (view.getUint32(0) !== 0x00010000) fail('TTF_UNSUPPORTED', 'Only a single static TrueType sfnt is supported.');
  const count = view.getUint16(4);
  if (count === 0) fail('TTF_MALFORMED', 'The font has no tables.');
  if (count > MAX_TABLES) fail('TTF_BUDGET', 'The font exceeds the table budget.');
  const directoryEnd = 12 + count * 16;
  extent(0, directoryEnd, bytes.length);
  const tables = new Map<string, Table>();
  for (let i = 0; i < count; i++) {
    const pos = 12 + i * 16;
    const tag = tagAt(bytes, pos);
    const offset = view.getUint32(pos + 8), length = view.getUint32(pos + 12);
    if (tables.has(tag)) fail('TTF_MALFORMED', 'The font has duplicate table tags.');
    extent(offset, length, bytes.length);
    if (length > 0 && (offset < directoryEnd || offset % 4 !== 0)) fail('TTF_MALFORMED', 'A table has an invalid position.');
    for (const table of tables.values()) {
      if (length > 0 && table.length > 0 && offset < table.offset + table.length && table.offset < offset + length) {
        fail('TTF_MALFORMED', 'Font table extents overlap.');
      }
    }
    tables.set(tag, { offset, length });
  }
  if (tables.has('fvar') || tables.has('gvar') || tables.has('CFF ') || tables.has('CFF2')) {
    fail('TTF_UNSUPPORTED', 'Variable and CFF outlines are not supported.');
  }
  return tables;
}

function validateCmap4(view: DataView, offset: number, available: number): Cmap {
  extent(0, 16, available);
  const length = view.getUint16(offset + 2), doubled = view.getUint16(offset + 6);
  if (length % 2 || doubled === 0 || doubled % 2) fail('TTF_MALFORMED', 'Invalid format 4 cmap header.');
  const count = doubled / 2;
  extent(0, length, available);
  if (length < 16 + 8 * count || view.getUint16(offset + 14 + 2 * count) !== 0) fail('TTF_MALFORMED', 'Invalid format 4 cmap arrays.');
  let previous = -1;
  for (let i = 0; i < count; i++) {
    const end = view.getUint16(offset + 14 + 2 * i), start = view.getUint16(offset + 16 + 2 * count + 2 * i);
    if (start > end || start <= previous) fail('TTF_MALFORMED', 'Cmap segments are not ordered and disjoint.');
    const word = 16 + 6 * count + 2 * i, range = view.getUint16(offset + word);
    if (range !== 0 && (range % 2 || word + range < 16 + 8 * count || word + range + 2 * (end - start) + 2 > length)) {
      fail('TTF_MALFORMED', 'A cmap glyph range extends outside its array.');
    }
    previous = end;
  }
  if (previous !== 0xffff) fail('TTF_MALFORMED', 'Format 4 cmap lacks its final segment.');
  return { format: 4, offset, length, count };
}
function validateCmap12(view: DataView, offset: number, available: number, glyphCount: number): Cmap {
  extent(0, 16, available);
  const length = view.getUint32(offset + 4), count = view.getUint32(offset + 12);
  if (view.getUint16(offset + 2) !== 0) fail('TTF_MALFORMED', 'Invalid format 12 cmap header.');
  if (count > MAX_CMAP_GROUPS) fail('TTF_BUDGET', 'The font exceeds the cmap group budget.');
  extent(0, length, available);
  if (length < 16 + 12 * count) fail('TTF_MALFORMED', 'Short format 12 cmap array.');
  let previous = -1;
  for (let i = 0; i < count; i++) {
    const pos = offset + 16 + i * 12, start = view.getUint32(pos), end = view.getUint32(pos + 4), glyph = view.getUint32(pos + 8);
    if (start > end || end > 0x10ffff || start <= previous || glyph + end - start >= glyphCount) {
      fail('TTF_MALFORMED', 'Invalid format 12 cmap group.');
    }
    previous = end;
  }
  return { format: 12, offset, length, count };
}
function readCmap(view: DataView, table: Table, glyphCount: number): Cmap {
  const base = table.offset;
  if (view.getUint16(base) !== 0) fail('TTF_MALFORMED', 'Invalid cmap version.');
  const count = view.getUint16(base + 2);
  if (count > MAX_CMAP_RECORDS) fail('TTF_BUDGET', 'The font exceeds the cmap record budget.');
  extent(4, count * 8, table.length);
  let bestOffset = -1, bestFormat = 0, bestScore = -1;
  for (let i = 0; i < count; i++) {
    const pos = base + 4 + i * 8, platform = view.getUint16(pos), encoding = view.getUint16(pos + 2), offset = view.getUint32(pos + 4);
    extent(offset, 2, table.length);
    const unicode = platform === 0 && (encoding <= 4 || encoding === 6) || platform === 3 && (encoding === 1 || encoding === 10);
    const format = view.getUint16(base + offset);
    if (!unicode || format !== 4 && format !== 12) continue;
    const score = (format === 12 ? 4 : 0) + (platform === 0 ? 1 : 0);
    if (score > bestScore) { bestOffset = offset; bestFormat = format; bestScore = score; }
  }
  if (bestOffset < 0) fail('TTF_UNSUPPORTED', 'A Unicode format 4 or 12 cmap is required.');
  if (bestOffset < 4 + count * 8) fail('TTF_MALFORMED', 'The selected cmap overlaps its encoding records.');
  if (bestFormat === 4) return validateCmap4(view, base + bestOffset, table.length - bestOffset);
  return validateCmap12(view, base + bestOffset, table.length - bestOffset, glyphCount);
}
function lookupGlyph(ctx: Context, scalar: number): number {
  const { view, cmap } = ctx;
  let lo = 0, hi = cmap.count;
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    const end = cmap.format === 4 ? view.getUint16(cmap.offset + 14 + 2 * mid) : view.getUint32(cmap.offset + 20 + 12 * mid);
    if (end < scalar) lo = mid + 1; else hi = mid;
  }
  let glyph = 0;
  if (lo < cmap.count && cmap.format === 12) {
    const pos = cmap.offset + 16 + 12 * lo, start = view.getUint32(pos);
    if (scalar >= start) glyph = view.getUint32(pos + 8) + scalar - start;
  } else if (lo < cmap.count && scalar <= 0xffff) {
    const start = view.getUint16(cmap.offset + 16 + 2 * cmap.count + 2 * lo);
    if (scalar >= start) {
      const delta = view.getInt16(cmap.offset + 16 + 4 * cmap.count + 2 * lo);
      const word = cmap.offset + 16 + 6 * cmap.count + 2 * lo, range = view.getUint16(word);
      glyph = range === 0 ? (scalar + delta) & 0xffff : view.getUint16(word + range + 2 * (scalar - start));
      if (range !== 0 && glyph !== 0) glyph = (glyph + delta) & 0xffff;
    }
  }
  if (glyph === 0) fail('TTF_MISSING_GLYPH', `No glyph for Unicode scalar U+${scalar.toString(16).toUpperCase()}.`);
  if (glyph >= ctx.metrics.glyphCount) fail('TTF_MALFORMED', 'The cmap refers to an invalid glyph.');
  return glyph;
}

class Cursor {
  constructor(readonly view: DataView, public position: number, readonly end: number) {}
  u8(): number { extent(this.position, 1, this.end); return this.view.getUint8(this.position++); }
  i8(): number { extent(this.position, 1, this.end); return this.view.getInt8(this.position++); }
  u16(): number { extent(this.position, 2, this.end); const value = this.view.getUint16(this.position); this.position += 2; return value; }
  i16(): number { extent(this.position, 2, this.end); const value = this.view.getInt16(this.position); this.position += 2; return value; }
  skip(length: number): void { extent(this.position, length, this.end); this.position += length; }
}
function countOutline(budget: Budget, points: number, contours: number): void {
  budget.points += points; budget.contours += contours;
  if (budget.points > MAX_POINTS || budget.contours > MAX_CONTOURS) fail('TTF_BUDGET', 'The glyph exceeds the outline budget.');
}
function coordinate(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_COORDINATE) fail('TTF_BUDGET', 'The glyph exceeds the coordinate budget.');
  return value;
}
function readSimple(cursor: Cursor, contourCount: number, budget: Budget): Outline {
  if (contourCount > MAX_CONTOURS) fail('TTF_BUDGET', 'The glyph exceeds the contour budget.');
  if (contourCount === 0) {
    if (cursor.position < cursor.end) cursor.skip(cursor.u16());
    return { contours: [], composite: false, overlap: false };
  }
  const ends = new Uint16Array(contourCount);
  let previous = -1;
  for (let i = 0; i < contourCount; i++) {
    const end = cursor.u16();
    if (end <= previous) fail('TTF_MALFORMED', 'Glyph contour endpoints are not increasing.');
    ends[i] = end; previous = end;
  }
  const count = previous + 1;
  countOutline(budget, count, contourCount);
  cursor.skip(cursor.u16());
  const flags = new Uint8Array(count), xs = new Float64Array(count);
  let overlap = false;
  for (let i = 0; i < count;) {
    const flag = cursor.u8();
    if (flag & 0x80) fail('TTF_UNSUPPORTED', 'A glyph uses a reserved simple flag.');
    if (flag & 0x40) overlap = true;
    const repeats = flag & 8 ? cursor.u8() : 0;
    if (repeats >= count - i) fail('TTF_MALFORMED', 'A repeated glyph flag exceeds the point count.');
    flags.fill(flag, i, i + repeats + 1); i += repeats + 1;
  }
  let x = 0;
  for (let i = 0; i < count; i++) {
    const flag = flags[i];
    x += flag & 2 ? cursor.u8() * (flag & 16 ? 1 : -1) : flag & 16 ? 0 : cursor.i16();
    xs[i] = coordinate(x);
  }
  const contours: TrueTypePoint[][] = [];
  let y = 0, start = 0;
  for (let c = 0; c < contourCount; c++) {
    const points: TrueTypePoint[] = [];
    for (let i = start; i <= ends[c]; i++) {
      const flag = flags[i];
      y += flag & 4 ? cursor.u8() * (flag & 32 ? 1 : -1) : flag & 32 ? 0 : cursor.i16();
      points.push({ x: xs[i], y: coordinate(y), onCurve: (flag & 1) !== 0 });
    }
    contours.push(points); start = ends[c] + 1;
  }
  return { contours, composite: false, overlap };
}
function appendTransformed(target: TrueTypePoint[][], source: TrueTypePoint[][], xx: number, xy: number, yx: number, yy: number, dx: number, dy: number): void {
  for (let c = 0; c < source.length; c++) {
    const contour = source[c], points: TrueTypePoint[] = [];
    for (let i = 0; i < contour.length; i++) {
      const point = contour[i];
      points.push({ x: coordinate(xx * point.x + yx * point.y + dx), y: coordinate(xy * point.x + yy * point.y + dy), onCurve: point.onCurve });
    }
    target.push(points);
  }
}
function readComposite(ctx: Context, cursor: Cursor, budget: Budget, depth: number, glyphId: number): Outline {
  const contours: TrueTypePoint[][] = [];
  let flags = 0, overlap = false, instructions = false;
  do {
    if (++budget.components > MAX_COMPONENTS) fail('TTF_BUDGET', 'The glyph exceeds the component budget.', glyphId);
    flags = cursor.u16();
    const childId = cursor.u16();
    if (flags & 0xe010) fail('TTF_UNSUPPORTED', 'A component uses a reserved flag.', glyphId);
    if (!(flags & 2)) fail('TTF_UNSUPPORTED', 'Component point attachment is not supported.', glyphId);
    if (flags & 0x0204) fail('TTF_UNSUPPORTED', 'Component grid rounding and USE_MY_METRICS are not supported.', glyphId);
    if (childId >= ctx.metrics.glyphCount) fail('TTF_MALFORMED', 'A component refers to an invalid glyph.', glyphId);
    const kind = flags & 0xc8;
    if (kind !== 0 && kind !== 8 && kind !== 0x40 && kind !== 0x80) fail('TTF_MALFORMED', 'Component transform flags conflict.', glyphId);
    if ((flags & 0x1800) === 0x1800) fail('TTF_MALFORMED', 'Component offset flags conflict.', glyphId);
    let dx = flags & 1 ? cursor.i16() : cursor.i8(), dy = flags & 1 ? cursor.i16() : cursor.i8();
    let xx = 1, xy = 0, yx = 0, yy = 1;
    if (kind === 8) { xx = cursor.i16() / 16384; yy = xx; }
    else if (kind === 0x40) { xx = cursor.i16() / 16384; yy = cursor.i16() / 16384; }
    else if (kind === 0x80) { xx = cursor.i16() / 16384; xy = cursor.i16() / 16384; yx = cursor.i16() / 16384; yy = cursor.i16() / 16384; }
    if (!(flags & 0x1800) && (xx !== 1 || xy !== 0 || yx !== 0 || yy !== 1) && (dx !== 0 || dy !== 0)) {
      fail('TTF_UNSUPPORTED', 'A transformed component requires an explicit offset policy.', glyphId);
    }
    if (flags & 0x800) { const x = dx; dx = xx * x + yx * dy; dy = xy * x + yy * dy; }
    const child = readGlyph(ctx, childId, budget, depth + 1);
    appendTransformed(contours, child.contours, xx, xy, yx, yy, dx, dy);
    overlap = overlap || child.overlap || (flags & 0x400) !== 0;
    instructions = instructions || (flags & 0x100) !== 0;
  } while (flags & 0x20);
  if (instructions) cursor.skip(cursor.u16());
  return { contours, composite: true, overlap };
}
function readGlyph(ctx: Context, glyphId: number, budget: Budget, depth: number): Outline {
  if (budget.active.has(glyphId)) fail('TTF_CYCLE', 'Composite glyph references form a cycle.', glyphId);
  if (depth > MAX_DEPTH || ++budget.visits > MAX_VISITS) fail('TTF_BUDGET', 'The glyph exceeds the nesting or visit budget.', glyphId);
  const start = ctx.glyf.offset + ctx.loca[glyphId], end = ctx.glyf.offset + ctx.loca[glyphId + 1];
  if (start === end) return { contours: [], composite: false, overlap: false };
  const cursor = new Cursor(ctx.view, start, end);
  const count = cursor.i16(), xMin = cursor.i16(), yMin = cursor.i16(), xMax = cursor.i16(), yMax = cursor.i16();
  if (xMin > xMax || yMin > yMax) fail('TTF_MALFORMED', 'Invalid glyph bounds.', glyphId);
  if (count < -1) fail('TTF_UNSUPPORTED', 'The composite contour marker must be -1.', glyphId);
  budget.active.add(glyphId);
  try { return count >= 0 ? readSimple(cursor, count, budget) : readComposite(ctx, cursor, budget, depth, glyphId); }
  finally { budget.active.delete(glyphId); }
}

function readContext(bytes: Uint8Array): Context {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), tables = readTables(bytes, view);
  const head = required(tables, 'head', 54), maxp = required(tables, 'maxp', 32), hhea = required(tables, 'hhea', 36);
  if (view.getUint32(head.offset) !== 0x00010000 || view.getUint32(head.offset + 12) !== 0x5f0f3cf5 || view.getInt16(head.offset + 52) !== 0) {
    fail('TTF_MALFORMED', 'Invalid TrueType head fields.');
  }
  if (view.getUint32(maxp.offset) !== 0x00010000 || view.getUint32(hhea.offset) !== 0x00010000 || view.getInt16(hhea.offset + 32) !== 0) {
    fail('TTF_MALFORMED', 'Invalid TrueType metric table version or format.');
  }
  const unitsPerEm = view.getUint16(head.offset + 18), glyphCount = view.getUint16(maxp.offset + 4), hMetrics = view.getUint16(hhea.offset + 34);
  const locaFormat = view.getInt16(head.offset + 50);
  if (unitsPerEm < 16 || unitsPerEm > 16384 || glyphCount === 0 || hMetrics === 0 || hMetrics > glyphCount) fail('TTF_MALFORMED', 'Invalid font metric counts.');
  if (locaFormat !== 0 && locaFormat !== 1) fail('TTF_UNSUPPORTED', 'Only short and long loca formats are supported.');
  const hmtx = required(tables, 'hmtx', hMetrics * 4 + (glyphCount - hMetrics) * 2), glyf = required(tables, 'glyf', 0);
  const locaTable = required(tables, 'loca', (glyphCount + 1) * (locaFormat === 0 ? 2 : 4)), loca = new Uint32Array(glyphCount + 1);
  let previous = 0;
  for (let i = 0; i <= glyphCount; i++) {
    const offset = locaFormat === 0 ? view.getUint16(locaTable.offset + 2 * i) * 2 : view.getUint32(locaTable.offset + 4 * i);
    if (offset < previous || offset > glyf.length) fail('TTF_MALFORMED', 'Invalid loca glyph extent.');
    loca[i] = offset; previous = offset;
  }
  const metrics = Object.freeze({ unitsPerEm, glyphCount, ascender: view.getInt16(hhea.offset + 4), descender: view.getInt16(hhea.offset + 6), lineGap: view.getInt16(hhea.offset + 8) });
  return { bytes, view, metrics, hmtx, hMetrics, glyf, loca, cmap: readCmap(view, required(tables, 'cmap', 4), glyphCount) };
}
class StaticTrueTypeFont implements TrueTypeFont {
  readonly metrics: TrueTypeFontMetrics;
  #context: Context;
  constructor(bytes: Uint8Array) { this.#context = readContext(bytes); this.metrics = this.#context.metrics; }
  copyBytes(): Uint8Array { return new Uint8Array(this.#context.bytes); }
  glyph(codePoint: number): TrueTypeGlyph {
    if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff || codePoint >= 0xd800 && codePoint <= 0xdfff) {
      fail('TTF_INPUT', 'A Unicode scalar value is required.');
    }
    const ctx = this.#context, glyphId = lookupGlyph(ctx, codePoint), metric = Math.min(glyphId, ctx.hMetrics - 1);
    const advance = ctx.view.getUint16(ctx.hmtx.offset + metric * 4);
    const leftSideBearing = glyphId < ctx.hMetrics ? ctx.view.getInt16(ctx.hmtx.offset + glyphId * 4 + 2) : ctx.view.getInt16(ctx.hmtx.offset + ctx.hMetrics * 4 + (glyphId - ctx.hMetrics) * 2);
    const outline = readGlyph(ctx, glyphId, { points: 0, contours: 0, components: 0, visits: 0, active: new Set<number>() }, 0);
    return { codePoint, glyphId, advance, leftSideBearing, ...outline };
  }
}
/** No fallback glyph, shaping, hinting, kerning, normalization, or contour flattening is performed. */
export function readTrueTypeFont(input: Uint8Array): TrueTypeFont {
  let length: number;
  try { length = input instanceof Uint8Array ? byteLengthOf.call(input) : -1; }
  catch { fail('TTF_INPUT', 'Font input must be a Uint8Array with a readable buffer.'); }
  if (length < 0) fail('TTF_INPUT', 'Font input must be a Uint8Array.');
  if (length > MAX_BYTES) fail('TTF_BUDGET', 'The font exceeds the byte budget.');
  let snapshot: Uint8Array;
  try { snapshot = new Uint8Array(length); snapshot.set(input); }
  catch { fail('TTF_INPUT', 'Font input must have an attached, readable buffer.'); }
  return new StaticTrueTypeFont(snapshot);
}
