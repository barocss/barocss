import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readTrueTypeFont, isTrueTypeError, type TrueTypeErrorCode, type TrueTypeGlyph, type TrueTypePoint } from '../src/engine/font/trueType';

const fontRoot = resolve(import.meta.dirname, '../../../apps/cad-studio/test/fixtures/fonts');
const fontFiles = ['abeezee/ABeeZee-Regular.ttf', 'nanum-gothic/NanumGothic-Regular.ttf', 'nanum-myeongjo/NanumMyeongjo-Regular.ttf'];
function fontBytes(index: number): Uint8Array { return new Uint8Array(readFileSync(resolve(fontRoot, fontFiles[index]))); }
function throwsCode(action: () => unknown, code: TrueTypeErrorCode): void {
  assert.throws(action, error => isTrueTypeError(error) && error.code === code);
}
function pointCount(glyph: TrueTypeGlyph): number {
  let count = 0;
  for (let i = 0; i < glyph.contours.length; i++) count += glyph.contours[i].length;
  return count;
}
function tuples(points: readonly TrueTypePoint[]): (number | boolean)[][] {
  const result: (number | boolean)[][] = [];
  for (let i = 0; i < points.length; i++) result.push([points[i].x, points[i].y, points[i].onCurve]);
  return result;
}

// Independent oracle: fontTools 4.67.0 TTFont/getBestCmap/hmtx/glyf.getCoordinates.
// Extraction used the committed, unmodified font inputs; it never imported this reader.
// Full observations and invocation are preserved in /tmp/barocss-ttf-oracle-fonttools-4.67.0.*.
// The small observations below are test expectations, not a runtime font or mapping table.
test('static font metrics and Latin outlines match an independent fontTools oracle', () => {
  const metrics = [
    { unitsPerEm: 1000, glyphCount: 268, ascender: 920, descender: -262, lineGap: 0 },
    { unitsPerEm: 1000, glyphCount: 13297, ascender: 844, descender: -156, lineGap: 0 },
    { unitsPerEm: 1024, glyphCount: 14695, ascender: 819, descender: -205, lineGap: 256 },
  ];
  const ids = [1, 33, 33], advances = [668, 727, 744], bearings = [10, 24, 24], counts = [11, 31, 43];
  const prefixes = [
    [[571, -10, true], [493, 190, true], [169, 190, true]],
    [[529, 263, true], [487, 367, false], [410, 570, false]],
    [[173, 139, true], [153, 84, false], [175, 33, false]],
  ];
  for (let i = 0; i < fontFiles.length; i++) {
    const font = readTrueTypeFont(fontBytes(i)), glyph = font.glyph(0x41);
    assert.deepEqual(font.metrics, metrics[i]);
    assert.equal(glyph.glyphId, ids[i]); assert.equal(glyph.advance, advances[i]); assert.equal(glyph.leftSideBearing, bearings[i]);
    assert.equal(glyph.composite, false); assert.equal(glyph.contours.length, 2); assert.equal(pointCount(glyph), counts[i]);
    assert.deepEqual(tuples(glyph.contours[0].slice(0, 3)), prefixes[i]);
  }
});
test('mapped Korean outlines and empty spaces match the independent oracle', () => {
  const ids = [[495, 2705], [565, 11153]], counts = [[50, 112], [64, 146]], bearings = [[56, 48], [45, 37]];
  const first = [[[507, 679, true], [545, 383, true]], [[767, 171, true], [770, 316, true]]];
  for (let i = 1; i <= 2; i++) {
    const font = readTrueTypeFont(fontBytes(i)), space = font.glyph(0x20);
    assert.equal(space.glyphId, i === 1 ? 13296 : 14694); assert.equal(space.advance, 280); assert.equal(space.leftSideBearing, 0);
    assert.deepEqual(space.contours, []);
    for (let j = 0; j < 2; j++) {
      const glyph = font.glyph(j === 0 ? 0xac00 : 0xd55c);
      assert.equal(glyph.glyphId, ids[i - 1][j]); assert.equal(glyph.advance, i === 1 ? 940 : 973);
      assert.equal(glyph.leftSideBearing, bearings[i - 1][j]); assert.equal(pointCount(glyph), counts[i - 1][j]);
      assert.equal(glyph.contours.length, j === 0 ? 2 : 6); assert.deepEqual(tuples(glyph.contours[0].slice(0, 1))[0], first[i - 1][j]);
    }
  }
  const latin = readTrueTypeFont(fontBytes(0));
  throwsCode(() => latin.glyph(0xac00), 'TTF_MISSING_GLYPH');
  const space = latin.glyph(0x20);
  assert.equal(space.glyphId, 161); assert.equal(space.advance, 300); assert.deepEqual(space.contours, []);
});
test('XY composites retain fontTools point placement while uncertain flags are refused', () => {
  for (let i = 1; i <= 2; i++) {
    const glyph = readTrueTypeFont(fontBytes(i)).glyph(0x132);
    assert.equal(glyph.composite, true); assert.equal(glyph.glyphId, i === 1 ? 13253 : 14651);
    assert.equal(glyph.advance, i === 1 ? 605 : 714); assert.equal(glyph.leftSideBearing, i === 1 ? 91 : 32);
    assert.equal(glyph.contours.length, 2); assert.equal(pointCount(glyph), i === 1 ? 37 : 76);
    if (i === 1) assert.deepEqual(tuples(glyph.contours[0].slice(0, 3)), [[167, -29, true], [167, -43, false], [153, -43, true]]);
  }
  // ABeeZee Agrave has ROUND_XY_TO_GRID and USE_MY_METRICS on its A component.
  throwsCode(() => readTrueTypeFont(fontBytes(0)).glyph(0xc0), 'TTF_UNSUPPORTED');
});
test('font input, byte copies, and returned outlines cannot mutate the reader snapshot', () => {
  const input = fontBytes(1), font = readTrueTypeFont(input), before = font.glyph(0x41);
  input.fill(0); font.copyBytes().fill(0);
  const points = font.glyph(0x41).contours[0] as { x: number; y: number; onCurve: boolean }[];
  points[0].x = -12345; points.pop();
  assert.deepEqual(font.glyph(0x41), before);
  assert.ok(Object.isFrozen(font.metrics));
});

// Authored byte fixtures exercise format and refusal branches without deriving
// expected values from the candidate. They contain no third-party glyph data.
function bytes(length: number): { data: Uint8Array; view: DataView } {
  const data = new Uint8Array(length); return { data, view: new DataView(data.buffer) };
}
function simpleGlyph(repeated = false): Uint8Array {
  const block = bytes(repeated ? 28 : 22);
  block.view.setInt16(0, 1); block.view.setInt16(6, 40); block.view.setInt16(8, 50); block.view.setUint16(10, 2);
  if (repeated) {
    block.data.set([9, 2], 14);
    block.view.setInt16(16, 10); block.view.setInt16(18, 30); block.view.setInt16(20, -40);
    block.view.setInt16(22, 20); block.view.setInt16(24, -20); block.view.setInt16(26, 30);
  } else block.data.set([0x37, 0x32, 0x35, 10, 30, 20, 30], 14);
  return block.data;
}
function compositeGlyph(flags: number, child = 1, transform: number[] = [], dx = 5, dy = -3): Uint8Array {
  const block = bytes(18 + transform.length * 2);
  block.view.setInt16(0, -1); block.view.setUint16(10, flags | 1); block.view.setUint16(12, child);
  block.view.setInt16(14, dx); block.view.setInt16(16, dy);
  for (let i = 0; i < transform.length; i++) block.view.setInt16(18 + i * 2, transform[i] * 16384);
  return block.data;
}
function cmapTable(format: 4 | 12, mapped: number): Uint8Array {
  const block = bytes(format === 4 ? 44 : 40);
  block.view.setUint16(2, 1); block.view.setUint16(4, 3); block.view.setUint16(6, format === 4 ? 1 : 10); block.view.setUint32(8, 12);
  block.view.setUint16(12, format);
  if (format === 4) {
    block.view.setUint16(14, 32); block.view.setUint16(18, 4);
    block.view.setUint16(20, 4); block.view.setUint16(22, 1);
    block.view.setUint16(26, 0x41); block.view.setUint16(28, 0xffff);
    block.view.setUint16(32, 0x41); block.view.setUint16(34, 0xffff);
    block.view.setInt16(36, mapped - 0x41); block.view.setUint16(38, 1);
  } else {
    block.view.setUint32(16, 28); block.view.setUint32(24, 1);
    block.view.setUint32(28, 0x1f600); block.view.setUint32(32, 0x1f600); block.view.setUint32(36, mapped);
  }
  return block.data;
}
function makeFont(glyphs: Uint8Array[], format: 4 | 12 = 12, shortLoca = false, mapped = glyphs.length - 1, compressedMetrics = false): Uint8Array {
  const count = glyphs.length, head = bytes(54), maxp = bytes(32), hhea = bytes(36), loca = bytes((count + 1) * (shortLoca ? 2 : 4));
  head.view.setUint32(0, 0x10000); head.view.setUint32(12, 0x5f0f3cf5); head.view.setUint16(18, 1000); head.view.setInt16(50, shortLoca ? 0 : 1);
  maxp.view.setUint32(0, 0x10000); maxp.view.setUint16(4, count);
  hhea.view.setUint32(0, 0x10000); hhea.view.setInt16(4, 800); hhea.view.setInt16(6, -200); hhea.view.setUint16(34, compressedMetrics ? 1 : count);
  const hmtx = bytes(compressedMetrics ? 4 + 2 * (count - 1) : count * 4);
  let total = 0;
  for (let i = 0; i <= count; i++) {
    if (shortLoca) loca.view.setUint16(i * 2, total / 2); else loca.view.setUint32(i * 4, total);
    if (i < count) {
      total += glyphs[i].length + glyphs[i].length % 2;
      if (!compressedMetrics || i === 0) { hmtx.view.setUint16(i * 4, 600 + i * 10); hmtx.view.setInt16(i * 4 + 2, i * 5); }
      else hmtx.view.setInt16(4 + (i - 1) * 2, i * 5);
    }
  }
  const glyf = new Uint8Array(total); let glyphOffset = 0;
  for (let i = 0; i < count; i++) { glyf.set(glyphs[i], glyphOffset); glyphOffset += glyphs[i].length + glyphs[i].length % 2; }
  const tables: [string, Uint8Array][] = [['head', head.data], ['maxp', maxp.data], ['hhea', hhea.data], ['hmtx', hmtx.data], ['loca', loca.data], ['glyf', glyf], ['cmap', cmapTable(format, mapped)]];
  let length = 12 + tables.length * 16;
  for (let i = 0; i < tables.length; i++) length += tables[i][1].length + (4 - tables[i][1].length % 4) % 4;
  const font = bytes(length); font.view.setUint32(0, 0x10000); font.view.setUint16(4, tables.length);
  font.view.setUint16(6, 64); font.view.setUint16(8, 2); font.view.setUint16(10, tables.length * 16 - 64);
  let offset = 12 + tables.length * 16;
  for (let i = 0; i < tables.length; i++) {
    const [tag, data] = tables[i], pos = 12 + i * 16;
    for (let c = 0; c < 4; c++) font.data[pos + c] = tag.charCodeAt(c);
    font.view.setUint32(pos + 8, offset); font.view.setUint32(pos + 12, data.length); font.data.set(data, offset);
    offset += data.length + (4 - data.length % 4) % 4;
  }
  return font.data;
}
function tableRecord(font: Uint8Array, tag: string): number {
  const view = new DataView(font.buffer, font.byteOffset, font.byteLength);
  for (let i = 0; i < view.getUint16(4); i++) {
    const pos = 12 + i * 16;
    if (String.fromCharCode(...font.subarray(pos, pos + 4)) === tag) return pos;
  }
  throw new Error(`Missing test table ${tag}`);
}
function tableOffset(font: Uint8Array, tag: string): number { return new DataView(font.buffer, font.byteOffset, font.byteLength).getUint32(tableRecord(font, tag) + 8); }

test('authored short and long loca fonts preserve quadratic flags, deltas, repeats, and hmtx tails', () => {
  const empty = new Uint8Array();
  const short = readTrueTypeFont(makeFont([empty, simpleGlyph()], 4, true));
  assert.deepEqual(tuples(short.glyph(0x41).contours[0]), [[10, 20, true], [40, 20, false], [40, 50, true]]);
  const long = readTrueTypeFont(makeFont([empty, simpleGlyph(true)], 12, false, 1, true));
  const glyph = long.glyph(0x1f600);
  assert.deepEqual(tuples(glyph.contours[0]), [[10, 20, true], [40, 0, true], [0, 30, true]]);
  assert.equal(glyph.advance, 600); assert.equal(glyph.leftSideBearing, 5);
  throwsCode(() => short.glyph(0x1f600), 'TTF_MISSING_GLYPH');
  throwsCode(() => long.glyph(0x41), 'TTF_MISSING_GLYPH');
});
test('authored component transforms distinguish scaled and unscaled offsets and matrix order', () => {
  const empty = new Uint8Array(), simple = simpleGlyph();
  const unscaled = readTrueTypeFont(makeFont([empty, simple, compositeGlyph(0x100a, 1, [0.5])]));
  assert.deepEqual(tuples(unscaled.glyph(0x1f600).contours[0]), [[10, 7, true], [25, 7, false], [25, 22, true]]);
  const scaled = readTrueTypeFont(makeFont([empty, simple, compositeGlyph(0x80a, 1, [0.5])]));
  assert.deepEqual(tuples(scaled.glyph(0x1f600).contours[0]), [[7.5, 8.5, true], [22.5, 8.5, false], [22.5, 23.5, true]]);
  const matrix = readTrueTypeFont(makeFont([empty, simple, compositeGlyph(0x1082, 1, [1, 0.5, -0.25, 1])]));
  assert.deepEqual(tuples(matrix.glyph(0x1f600).contours[0]), [[10, 22, true], [40, 37, false], [32.5, 67, true]]);
});
test('format 4 range offsets apply deltas only to nonzero glyph array entries', () => {
  const base = makeFont([new Uint8Array(), simpleGlyph()], 4, true), input = new Uint8Array(base.length + 4);
  input.set(base);
  const view = new DataView(input.buffer), cmap = tableOffset(input, 'cmap');
  view.setUint32(tableRecord(input, 'cmap') + 12, 48); view.setUint16(cmap + 14, 36);
  view.setInt16(cmap + 36, -2); view.setUint16(cmap + 40, 4); view.setUint16(cmap + 44, 3);
  assert.equal(readTrueTypeFont(input).glyph(0x41).glyphId, 1);
  view.setUint16(cmap + 44, 0);
  throwsCode(() => readTrueTypeFont(input).glyph(0x41), 'TTF_MISSING_GLYPH');
  view.setUint16(cmap + 40, 0xfffe);
  throwsCode(() => readTrueTypeFont(input), 'TTF_MALFORMED');
});
test('unsupported containers, variable tables, flags, and malformed extents fail explicitly', () => {
  const empty = new Uint8Array(), valid = makeFont([empty, simpleGlyph()]);
  throwsCode(() => readTrueTypeFont(new Uint8Array()), 'TTF_MALFORMED');
  throwsCode(() => readTrueTypeFont(null as unknown as Uint8Array), 'TTF_INPUT');
  throwsCode(() => readTrueTypeFont(Object.create(Uint8Array.prototype)), 'TTF_INPUT');
  throwsCode(() => readTrueTypeFont(new Proxy(new Uint8Array(16), {})), 'TTF_INPUT');
  throwsCode(() => readTrueTypeFont(new Uint8Array(8 * 1024 * 1024 + 1)), 'TTF_BUDGET');
  const detached = new Uint8Array(16); structuredClone(detached.buffer, { transfer: [detached.buffer] });
  throwsCode(() => readTrueTypeFont(detached), 'TTF_INPUT');
  const disguised = new Uint8Array(8 * 1024 * 1024 + 1); Object.defineProperty(disguised, 'byteLength', { value: 1 });
  throwsCode(() => readTrueTypeFont(disguised), 'TTF_BUDGET');
  for (const signature of [0x774f4646, 0x774f4632, 0x4f54544f, 0x74746366]) {
    const input = valid.slice(); new DataView(input.buffer).setUint32(0, signature);
    throwsCode(() => readTrueTypeFont(input), 'TTF_UNSUPPORTED');
  }
  for (const tag of ['fvar', 'CFF ']) {
    const input = valid.slice(), pos = tableRecord(input, 'glyf');
    for (let i = 0; i < 4; i++) input[pos + i] = tag.charCodeAt(i);
    throwsCode(() => readTrueTypeFont(input), 'TTF_UNSUPPORTED');
  }
  const overrun = valid.slice(); new DataView(overrun.buffer).setUint32(tableRecord(overrun, 'glyf') + 12, overrun.length);
  throwsCode(() => readTrueTypeFont(overrun), 'TTF_MALFORMED');
  const badLoca = valid.slice(); new DataView(badLoca.buffer).setUint32(tableOffset(badLoca, 'loca') + 8, valid.length);
  throwsCode(() => readTrueTypeFont(badLoca), 'TTF_MALFORMED');
  for (const flags of [0, 0x202, 0x6, 0x12, 0x8002]) {
    const font = readTrueTypeFont(makeFont([empty, simpleGlyph(), compositeGlyph(flags)]));
    throwsCode(() => font.glyph(0x1f600), 'TTF_UNSUPPORTED');
  }
  for (const flags of [0x1802, 0xca]) {
    const font = readTrueTypeFont(makeFont([empty, simpleGlyph(), compositeGlyph(flags)]));
    throwsCode(() => font.glyph(0x1f600), 'TTF_MALFORMED');
  }
  throwsCode(() => readTrueTypeFont(makeFont([empty, simpleGlyph(), compositeGlyph(0xa, 1, [0.5])])).glyph(0x1f600), 'TTF_UNSUPPORTED');
});
test('cmap ranges, scalar input, cycles, glyph truncation, and contour budgets fail explicitly', () => {
  const empty = new Uint8Array(), valid = makeFont([empty, simpleGlyph()]);
  const font = readTrueTypeFont(valid);
  for (const scalar of [-1, 0xd800, 0xdfff, 0x110000, 1.5, NaN]) throwsCode(() => font.glyph(scalar), 'TTF_INPUT');
  const badCmap = valid.slice(); new DataView(badCmap.buffer).setUint32(tableOffset(badCmap, 'cmap') + 36, 20);
  throwsCode(() => readTrueTypeFont(badCmap), 'TTF_MALFORMED');
  const cycle = readTrueTypeFont(makeFont([empty, compositeGlyph(2, 1)]));
  throwsCode(() => cycle.glyph(0x1f600), 'TTF_CYCLE');
  const truncated = readTrueTypeFont(makeFont([empty, simpleGlyph().subarray(0, 18)]));
  throwsCode(() => truncated.glyph(0x1f600), 'TTF_MALFORMED');
  const badRepeat = simpleGlyph(true); badRepeat[15] = 3;
  throwsCode(() => readTrueTypeFont(makeFont([empty, badRepeat])).glyph(0x1f600), 'TTF_MALFORMED');
  const manyContours = bytes(10); manyContours.view.setInt16(0, 4097);
  throwsCode(() => readTrueTypeFont(makeFont([empty, manyContours.data])).glyph(0x1f600), 'TTF_BUDGET');
  const chain: Uint8Array[] = [empty, simpleGlyph()];
  for (let i = 2; i < 21; i++) chain.push(compositeGlyph(2, i - 1));
  throwsCode(() => readTrueTypeFont(makeFont(chain)).glyph(0x1f600), 'TTF_BUDGET');
});
function repeatedOriginGlyph(count: number): Uint8Array {
  const block = bytes(14 + Math.ceil(count / 256) * 2);
  block.view.setInt16(0, 1); block.view.setUint16(10, count - 1);
  let offset = 14;
  for (let remaining = count; remaining > 0; remaining -= 256) { block.data[offset++] = 0x39; block.data[offset++] = Math.min(remaining, 256) - 1; }
  return block.data;
}
function manyComponents(count: number, child: number): Uint8Array {
  const block = bytes(10 + count * 8); block.view.setInt16(0, -1);
  for (let i = 0; i < count; i++) { block.view.setUint16(10 + i * 8, i === count - 1 ? 3 : 0x23); block.view.setUint16(12 + i * 8, child); }
  return block.data;
}
test('composite expansion enforces whole-query point and component budgets', () => {
  const empty = new Uint8Array();
  throwsCode(() => readTrueTypeFont(makeFont([empty, manyComponents(257, 0)])).glyph(0x1f600), 'TTF_BUDGET');
  throwsCode(() => readTrueTypeFont(makeFont([empty, repeatedOriginGlyph(40000), manyComponents(2, 1)])).glyph(0x1f600), 'TTF_BUDGET');
});
