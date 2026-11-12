import test from 'node:test';
import assert from 'node:assert/strict';
import { HOLE_PRESETS_KEY, holePresetName, holePresetOptions, readHolePresets, writeHolePresets } from '../src/app/holePresets';

test('Hole presets capture only the active single-hole dimensions', () => {
  const input = { pat: 'one', d: 6, depth: 4, cd: 10, ch: 2, csd: 12, x: 83, y: 20, thread: 'M6', pn: 9, pa: 21 };
  for (const expected of [
    { type: 'through', d: 6 },
    { type: 'blind', d: 6, depth: 4 },
    { type: 'counterbore', d: 6, cd: 10, ch: 2 },
    { type: 'countersink', d: 6, csd: 12 },
  ]) assert.deepEqual(holePresetOptions({ ...input, type: expected.type }), expected);
  for (const invalid of [
    { type: 'tapped' }, { type: 'through', pat: 'row' }, { type: 'through', pat: 'circle' },
    { type: 'through', d: Infinity }, { type: 'through', d: '6' }, { type: 'blind', depth: 0 },
    { type: 'counterbore', cd: 6 }, { type: 'countersink', csd: 4 },
  ]) assert.equal(holePresetOptions({ ...input, ...invalid }), null);
});

test('Hole preset storage rejects malformed and unknown data without overwriting it', () => {
  const option = { type: 'blind', d: 6, depth: 4 };
  const preset = { name: 'Short', options: option };
  assert.equal(holePresetName('  Short  '), 'Short');
  for (const value of ['', 'x'.repeat(49), 'A\nB']) assert.equal(holePresetName(value), null);
  for (const invalid of [
    '{', JSON.stringify({ version: 2, presets: [] }), JSON.stringify({ version: 1, presets: [{ ...preset, face: 'n1.top' }] }),
    JSON.stringify({ version: 1, presets: [{ ...preset, options: { ...option, x: 10 } }] }),
    JSON.stringify({ version: 1, presets: [{ ...preset, options: { type: 'blind', d: 6 } }] }),
    JSON.stringify({ version: 1, presets: [preset, { ...preset, name: 'short' }] }),
    JSON.stringify({ version: 1, presets: Array.from({ length: 25 }, (_, index) => ({ ...preset, name: 'P' + index })) }),
  ]) {
    const store = { getItem: () => invalid, setItem: () => assert.fail('Invalid storage was overwritten') };
    assert.equal(readHolePresets(store).ok, false);
    assert.equal(writeHolePresets(store, [], []).ok, false);
  }
});

test('Hole preset writes are scoped and report stale, blocked and failed storage', () => {
  const items = new Map<string, string>();
  const store = { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => items.set(key, value) };
  const one = [{ name: 'Short', options: { type: 'blind' as const, d: 6, depth: 4 } }];
  assert.deepEqual(writeHolePresets(store, [], one), { ok: true, presets: one });
  assert.deepEqual(JSON.parse(items.get(HOLE_PRESETS_KEY)!), { version: 1, presets: one });
  assert.equal(writeHolePresets(store, [], []).ok, false);
  assert.deepEqual(readHolePresets(store), { ok: true, presets: one });
  assert.equal(readHolePresets(null).ok, false);
  assert.equal(readHolePresets({ ...store, getItem: () => { throw Error('blocked'); } }).ok, false);
  const failed = writeHolePresets({ ...store, setItem: () => { throw Error('quota'); } }, one, []);
  assert.deepEqual(failed, { ok: false, message: 'Hole preset changes could not be saved.' });
  assert.deepEqual(readHolePresets(store), { ok: true, presets: one });
});
