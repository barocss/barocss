import test from 'node:test';
import assert from 'node:assert/strict';
import { toolColumns, toolRailPx, toolRailWidthPx, toolRowPx, TOOL_LABEL_PX } from '../src/app/toolColumns';

// The rail's groups as measured in Studio (2026-10-31): create 30, modify 27, pattern 8, combine 3, inspect 7 buttons.
const GROUPS = [30, 27, 8, 3, 7];
const fits = (cols: number, h: number) => GROUPS.length * TOOL_LABEL_PX + GROUPS.reduce((a, n) => a + Math.ceil(n / cols) * toolRowPx(h), 0) <= toolRailPx(h);

test('the fewest columns that fit the window height, at common window sizes', () => {
  for (const [h, want] of [[1080, 4], [900, 4], [800, 5], [700, 6]] as const) {
    const cols: number = toolColumns(GROUPS, toolRailPx(h), toolRowPx(h));
    assert.equal(cols, want, `${h}: ${cols}`);
    assert.ok(fits(cols, h), `${h}: ${cols} columns fit`);
    assert.ok(!fits(cols - 1, h), `${h}: one column fewer does not fit`);
  }
});

test('one column when everything fits, and the most columns when nothing does', () => {
  assert.equal(toolColumns([3, 2], 1000, 36), 1);
  assert.equal(toolColumns(GROUPS, 100, 36), 6);
  assert.equal(toolColumns(GROUPS, 100, 36, 3), 3);
});

test('row pitch follows the rail button size rules', () => {
  assert.equal(toolRowPx(1080), 36);
  assert.equal(toolRowPx(900), 32);
  assert.equal(toolRowPx(800), 28);
});

test('the rail width the notices sit beside', () => {
  assert.equal(toolRailWidthPx(4, 900), 8 + 4 * 30 + 3 * 2);
  assert.equal(toolRailWidthPx(6, 700), 8 + 6 * 26 + 5 * 2);
  assert.equal(toolRailWidthPx(1, 1080), 44);
});
