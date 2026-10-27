// Rows files: the shipped samples @barocss/cad-model ships, each row checked by the model's own validator, and a row it
// refuses with why. The rows reference page includes the #region blocks. Run: pnpm test:samples
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkFastenerSizeRow } from '@barocss/cad-model/engine/fastenerSizeRows';
import { checkCastingRuleRow } from '@barocss/cad-model/engine/castingRuleRows';
import { checkMountRow, MOUNT_FIELDS } from '@barocss/cad-model/engine/mountRows';

const samples = resolve(import.meta.dirname, '../../../packages/barocss-cad-model/samples/rows');
const read = name => JSON.parse(readFileSync(resolve(samples, name), 'utf8'));

test('the shipped samples: every row valid, each with its source', () => {
  // #region samples
  const sizes = read('fastener-sizes.json');           // { about, rows: [...] }
  assert.deepEqual(sizes.rows.map(r => r.id), ['M3', 'M4', 'M5', 'M6', 'M8', 'M10', 'M12']);
  for (const row of sizes.rows) assert.deepEqual(checkFastenerSizeRow(row), []);   // no problems
  const m6 = sizes.rows.find(r => r.id === 'M6');
  assert.deepEqual([m6.d, m6.pitch, m6.tap], [6, 1, 5]);   // mm

  const casting = read('casting-rules.json');
  for (const row of casting.rows) assert.deepEqual(checkCastingRuleRow(row), []);
  assert.ok(casting.rows.every(r => r.page?.url));      // each rule names the page it was read from
  // #endregion samples
});

test('a row refused with why', () => {
  // #region refused
  assert.deepEqual(checkFastenerSizeRow({ id: '6mm' }),
    [{ code: 'FASTENER_SIZE_ROW', message: '[FASTENER_SIZE_ROW] a fastener size row\'s id is its thread size, as "M6"' }]);
  // #endregion refused
});

test('mount rows: the shipped values and provenance survive canonical field names', () => {
  // #region mounts
  const mounts = read('mounts.json');
  for (const row of mounts.rows) assert.deepEqual(checkMountRow(row), []);
  const motor = mounts.rows.find(row => row.id === 'nema17');
  assert.deepEqual([motor.pilot, motor.pilotDepth, motor.shaftHeight], [22, 2, 0]); // mm
  assert.equal(motor.estimate, true); // the shipped estimate remains an estimate
  assert.ok(motor.unchecked.includes('pilot'));
  assert.ok(motor.fieldSources.pilot.includes('estimate'));
  const bearing = mounts.rows.find(row => row.id === 'ucp204');
  assert.equal(bearing.holes.pcd, 95); // mm, pitch-circle diameter
  // #endregion mounts
  for (const name of ['pilot', 'pilotDepth', 'shaftOffset', 'shaftHeight', 'body']) assert.ok(MOUNT_FIELDS.includes(name));
  const old = ['pilotMM', 'pilotDepthMM', 'shaftOffsetMM', 'shaftHeightMM', 'bodyMM'];
  for (const row of mounts.rows) {
    assert.ok(old.every(key => !Object.hasOwn(row, key)));
    assert.equal(Object.hasOwn(row.holes, 'pcdMM'), false);
  }
});
