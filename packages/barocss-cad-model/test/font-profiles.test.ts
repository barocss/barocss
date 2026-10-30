import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildFontProfiles, isFontProfileError, type FontProfileErrorCode, type FontProfileComponent, type FontProfileLine, type FontProfileRun } from '../src/engine/font/profiles';
import { readTrueTypeFont, type TrueTypeFont, type TrueTypeGlyph, type TrueTypePoint } from '../src/engine/font/trueType';

type Point = TrueTypePoint;
function on(x: number, y: number): Point { return { x, y, onCurve: true }; }
function off(x: number, y: number): Point { return { x, y, onCurve: false }; }
function rectangle(x0: number, y0: number, x1: number, y1: number, clockwise: boolean): Point[] {
  return clockwise ? [on(x0, y0), on(x0, y1), on(x1, y1), on(x1, y0)] : [on(x0, y0), on(x1, y0), on(x1, y1), on(x0, y1)];
}
class FixtureFont implements TrueTypeFont {
  readonly metrics = { unitsPerEm: 1000, glyphCount: 2, ascender: 1000, descender: 0, lineGap: 0 };
  constructor(readonly contours: readonly (readonly Point[])[], readonly advance = 1000) {}
  glyph(codePoint: number): TrueTypeGlyph {
    return { codePoint, glyphId: 1, advance: codePoint === 0x20 ? 300 : this.advance, leftSideBearing: 0, contours: codePoint === 0x20 ? [] : this.contours, composite: false, overlap: false };
  }
  copyBytes(): Uint8Array { return new Uint8Array(); }
}
function signedArea(loop: readonly FontProfileLine[]): number {
  let result = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i].start, b = loop[(i + 1) % loop.length].start;
    result += a[0] * b[1] - a[1] * b[0];
  }
  return result * 0.5;
}
function componentArea(component: FontProfileComponent): number {
  let result = signedArea(component.outer);
  for (let i = 0; i < component.holes.length; i++) result += signedArea(component.holes[i]);
  return result;
}
function filledArea(run: FontProfileRun): number {
  let area = 0;
  for (let i = 0; i < run.glyphs.length; i++) for (let j = 0; j < run.glyphs[i].components.length; j++) area += componentArea(run.glyphs[i].components[j]);
  return area;
}
function holeCount(run: FontProfileRun): number {
  let count = 0;
  for (let i = 0; i < run.glyphs.length; i++) for (let j = 0; j < run.glyphs[i].components.length; j++) count += run.glyphs[i].components[j].holes.length;
  return count;
}
function perimeter(run: FontProfileRun): number {
  let result = 0;
  for (let i = 0; i < run.glyphs.length; i++) for (let j = 0; j < run.glyphs[i].components.length; j++) {
    const component = run.glyphs[i].components[j], loops = [component.outer, ...component.holes];
    for (let k = 0; k < loops.length; k++) for (let n = 0; n < loops[k].length; n++) {
      const a = loops[k][n].start, b = loops[k][(n + 1) % loops[k].length].start;
      result += Math.hypot(a[0] - b[0], a[1] - b[1]);
    }
  }
  return result;
}
function throwsCode(action: () => unknown, code: FontProfileErrorCode): void {
  assert.throws(action, error => isFontProfileError(error) && error.code === code);
}
function assertNativeLoopAdmission(run: FontProfileRun): void {
  for (let i = 0; i < run.glyphs.length; i++) for (let j = 0; j < run.glyphs[i].components.length; j++) {
    const component = run.glyphs[i].components[j], loops = [component.outer, ...component.holes];
    assert.ok(signedArea(component.outer) > 0);
    for (let k = 0; k < loops.length; k++) {
      assert.ok(loops[k].length >= 3 && loops[k].length <= 1024);
      if (k) assert.ok(signedArea(loops[k]) < 0);
      for (let n = 0; n < loops[k].length; n++) {
        const edge = loops[k][n], next = loops[k][(n + 1) % loops[k].length];
        assert.equal(edge.kind, 'line');
        assert.ok(Number.isFinite(edge.start[0]) && Number.isFinite(edge.start[1]));
        assert.ok(Math.abs(edge.start[0]) <= 10000 && Math.abs(edge.start[1]) <= 10000);
        assert.ok(Math.hypot(edge.start[0] - next.start[0], edge.start[1] - next.start[1]) >= 1e-4);
      }
    }
  }
}

test('quadratic arch area converges to the independent polynomial integral', () => {
  // x=1000t, y=2000t(1-t), so the design-unit arch area is 1000000/3.
  const font = new FixtureFont([[on(0, 0), off(500, 1000), on(1000, 0)]]), expected = 100 / 3;
  const coarse = buildFontProfiles(font, 'A', { size: 10, tolerance: 0.02 });
  const fine = buildFontProfiles(font, 'A', { size: 10, tolerance: 0.005 });
  const coarseError = Math.abs(filledArea(coarse) - expected), fineError = Math.abs(filledArea(fine) - expected);
  assert.ok(coarseError > 0 && fineError < coarseError * 0.4);
  assert.ok(fineError < 4 * 10 * 0.005);
  assertNativeLoopAdmission(fine);
});
test('cyclic off-curve starts and consecutive off-curve points retain the same exact quadratic shape', () => {
  const contour = [off(0, 500), off(500, 1000), off(1000, 500), off(500, 0)];
  // Four midpoint-to-midpoint quadratics enclose 5/12 of the 1000-by-1000 square.
  const expected = 125 / 3;
  for (let shift = 0; shift < contour.length; shift++) {
    const points = contour.slice(shift).concat(contour.slice(0, shift));
    const run = buildFontProfiles(new FixtureFont([points]), 'A', { size: 10, tolerance: 0.002 });
    assert.equal(run.glyphs[0].components.length, 1); assert.equal(holeCount(run), 0);
    assert.ok(Math.abs(filledArea(run) - expected) < 4 * 10 * 0.002);
  }
  const mixed = [on(0, 0), off(500, 1000), on(1000, 0)];
  for (let shift = 0; shift < mixed.length; shift++) {
    const points = mixed.slice(shift).concat(mixed.slice(0, shift));
    const run = buildFontProfiles(new FixtureFont([points]), 'A', { size: 10, tolerance: 0.002 });
    assert.ok(Math.abs(filledArea(run) - 100 / 3) < 4 * 10 * 0.002);
  }
});
test('nonzero winding preserves a hole and its separate material island', () => {
  const outer = rectangle(0, 0, 1000, 1000, true), hole = rectangle(200, 200, 800, 800, false), island = rectangle(400, 400, 600, 600, true);
  const run = buildFontProfiles(new FixtureFont([hole, island, outer]), 'A', { size: 10, tolerance: 0.001 });
  assert.equal(run.glyphs[0].components.length, 2); assert.equal(holeCount(run), 1); assert.equal(filledArea(run), 68);
  assertNativeLoopAdmission(run);
  const nestedSameWinding = buildFontProfiles(new FixtureFont([outer, rectangle(200, 200, 800, 800, true)]), 'A', { size: 10, tolerance: 0.001 });
  assert.equal(nestedSameWinding.glyphs[0].components.length, 1); assert.equal(holeCount(nestedSameWinding), 0); assert.equal(filledArea(nestedSameWinding), 100);
});
test('em scale, scalar advance, spaces, and world tracking are explicit', () => {
  const font = new FixtureFont([rectangle(0, 0, 500, 1000, true)], 600), run = buildFontProfiles(font, 'A \u{1f600}', { size: 10, tolerance: 0.001, tracking: 0.5 });
  assert.deepEqual(run.glyphs[0].origin, [0, 0]); assert.deepEqual(run.glyphs[1].origin, [6.5, 0]); assert.deepEqual(run.glyphs[2].origin, [10, 0]);
  assert.deepEqual(run.glyphs[1].components, []); assert.equal(run.glyphs[2].codePoint, 0x1f600); assert.equal(run.advance, 16);
  assert.equal(filledArea(run), 100);
  assert.deepEqual(buildFontProfiles(font, '', { size: 10, tolerance: 0.001 }), { advance: 0, glyphs: [] });
});
test('source points and returned components do not share mutable coordinates', () => {
  const points = rectangle(0, 0, 1000, 1000, true), before = structuredClone(points), font = new FixtureFont([points]);
  const first = buildFontProfiles(font, 'A', { size: 10, tolerance: 0.001 });
  first.glyphs[0].components[0].outer[0].start[0] = -123;
  assert.deepEqual(points, before);
  assert.equal(filledArea(buildFontProfiles(font, 'A', { size: 10, tolerance: 0.001 })), 100);
});
test('invalid flatness, coordinates, scalars, and fixed budgets are typed refusals', () => {
  const font = new FixtureFont([rectangle(0, 0, 1000, 1000, true)]);
  for (const tolerance of [NaN, Infinity, -1, 0, 1e-8, 2]) throwsCode(() => buildFontProfiles(font, 'A', { size: 10, tolerance }), 'FONT_PROFILE_INPUT');
  for (const size of [NaN, Infinity, 0, -1, 10001]) throwsCode(() => buildFontProfiles(font, 'A', { size, tolerance: 0.001 }), 'FONT_PROFILE_INPUT');
  for (const text of ['\ud800', '\udfff', '\n', '\t', '\u007f']) throwsCode(() => buildFontProfiles(font, text, { size: 10, tolerance: 0.001 }), 'FONT_PROFILE_INPUT');
  throwsCode(() => buildFontProfiles(font, ' '.repeat(257), { size: 10, tolerance: 0.001 }), 'FONT_PROFILE_BUDGET');
  throwsCode(() => buildFontProfiles(font, 'AA', { size: 10000, tolerance: 0.001 }), 'FONT_PROFILE_INPUT');
  throwsCode(() => buildFontProfiles(new FixtureFont([rectangle(0, 0, 1001, 1000, true)]), 'A', { size: 10000, tolerance: 0.001 }), 'FONT_PROFILE_INPUT');
  throwsCode(() => buildFontProfiles(font, 'A', { size: 1e-5, tolerance: 1e-7 }), 'FONT_PROFILE_GEOMETRY');
  const manyPoints: Point[] = []; for (let i = 0; i < 65537; i++) manyPoints.push(on(i, 0));
  throwsCode(() => buildFontProfiles(new FixtureFont([manyPoints]), 'A', { size: 10, tolerance: 0.001 }), 'FONT_PROFILE_BUDGET');
  const arch = new FixtureFont([[on(0, 0), off(500, 1000), on(1000, 0)]]);
  throwsCode(() => buildFontProfiles(arch, 'A', { size: 1000, tolerance: 1e-7 }), 'FONT_PROFILE_BUDGET');
});
test('crossings, touching components, retracing joins, and sub-tolerance gaps are refused', () => {
  const bow = [on(0, 0), on(1000, 1000), on(0, 1000), on(1000, 0)];
  throwsCode(() => buildFontProfiles(new FixtureFont([bow]), 'A', { size: 10, tolerance: 0.001 }), 'FONT_PROFILE_TOPOLOGY');
  const left = rectangle(0, 0, 500, 1000, true), right = rectangle(500, 0, 1000, 1000, true);
  throwsCode(() => buildFontProfiles(new FixtureFont([left, right]), 'A', { size: 10, tolerance: 0.001 }), 'FONT_PROFILE_TOPOLOGY');
  const retracing = [on(0, 0), on(1000, 0), on(500, 0), on(500, 1000)];
  throwsCode(() => buildFontProfiles(new FixtureFont([retracing]), 'A', { size: 10, tolerance: 0.001 }), 'FONT_PROFILE_TOPOLOGY');
  const almost = rectangle(500.000005, 0, 1000, 1000, true);
  throwsCode(() => buildFontProfiles(new FixtureFont([left, almost]), 'A', { size: 10, tolerance: 0.001 }), 'FONT_PROFILE_TOPOLOGY');
});

// Independent fontTools 4.67.0 BasePen + exact Fraction Green integrals, extracted without
// importing this reader/converter. Full extraction: /tmp/barocss-ttf-profile-oracle-fonttools-4.67.0.*.
// These are small geometry expectations, not source hashes or an embedded glyph outline table.
type Oracle = readonly [character: string, area: number, advance: number, components: number, holes: number];
const FONT_ORACLES: readonly { file: string; em: number; glyphs: readonly Oracle[] }[] = [
  { file: 'abeezee/ABeeZee-Regular.ttf', em: 1000, glyphs: [['A', 148797, 668, 1, 1], ['O', 4180885 / 24, 761, 1, 1], ['B', 2262923 / 12, 630, 1, 2], [' ', 0, 300, 0, 0]] },
  { file: 'nanum-gothic/NanumGothic-Regular.ttf', em: 1000, glyphs: [['A', 387907 / 3, 727, 1, 1], ['O', 1774373 / 12, 787, 1, 1], ['B', 1816517 / 12, 606, 1, 2], [' ', 0, 280, 0, 0], ['가', 3491785 / 24, 940, 2, 0], ['한', 1776297 / 8, 940, 5, 1]] },
  { file: 'nanum-myeongjo/NanumMyeongjo-Regular.ttf', em: 1024, glyphs: [['A', 562447 / 6, 744, 1, 1], ['O', 237629 / 2, 865, 1, 1], ['B', 1471933 / 12, 627, 1, 2], [' ', 0, 280, 0, 0], ['가', 264861 / 2, 973, 2, 0], ['한', 4447219 / 24, 973, 5, 1]] },
];
test('three original fonts match independent filled area, topology, and advances for selected glyphs', () => {
  const root = resolve(import.meta.dirname, '../../../apps/cad-studio/test/fixtures/fonts'), size = 20, tolerance = 0.002;
  for (let i = 0; i < FONT_ORACLES.length; i++) {
    const oracle = FONT_ORACLES[i], font = readTrueTypeFont(new Uint8Array(readFileSync(resolve(root, oracle.file))));
    for (let j = 0; j < oracle.glyphs.length; j++) {
      const [character, area, advance, components, holes] = oracle.glyphs[j], run = buildFontProfiles(font, character, { size, tolerance });
      const expected = area * (size / oracle.em) ** 2, measured = filledArea(run), areaBound = 2 * perimeter(run) * tolerance + Math.PI * tolerance * tolerance;
      assert.equal(run.glyphs[0].components.length, components, `${oracle.file}: ${character} components`);
      assert.equal(holeCount(run), holes, `${oracle.file}: ${character} holes`);
      assert.ok(Math.abs(run.advance - advance * size / oracle.em) <= 1e-12, `${oracle.file}: ${character} advance`);
      assert.ok(Math.abs(measured - expected) <= areaBound, `${oracle.file}: ${character} area ${measured}, oracle ${expected}, approximation bound ${areaBound}`);
      assertNativeLoopAdmission(run);
    }
  }
});
