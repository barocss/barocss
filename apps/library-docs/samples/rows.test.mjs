// Rows files: the two samples @barocss/cad-model ships, each row checked by the model's own validator, and a row it
// refuses with why. The rows reference page includes the #region blocks. Run: pnpm test:samples
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkFastenerSizeRow } from '@barocss/cad-model/engine/fastenerSizeRows';
import { checkCastingRuleRow } from '@barocss/cad-model/engine/castingRuleRows';

const samples = resolve(import.meta.dirname, '../../../packages/barocss-cad-model/samples/rows');
const read = name => JSON.parse(readFileSync(resolve(samples, name), 'utf8'));

test('the shipped samples: every row valid, each with its source', () => {
  // #region samples
  const sizes = read('fastener-sizes.json');           // { about, rows: [...] }
  assert.deepEqual(sizes.rows.map(r => r.id), ['M3', 'M4', 'M5', 'M6', 'M8', 'M10', 'M12']);
  for (const row of sizes.rows) assert.deepEqual(checkFastenerSizeRow(row), []);
  const m6 = sizes.rows.find(r => r.id === 'M6');
  assert.deepEqual([m6.d, m6.pitch, m6.tap], [6, 1, 5]);   // mm

  const casting = read('casting-rules.json');
  for (const row of casting.rows) assert.deepEqual(checkCastingRuleRow(row), []);
  assert.ok(casting.rows.every(r => r.page?.url));      // each rule names the page it was read from
  // #endregion samples
});

test('a row refused with why', () => {
  // #region refused
  assert.equal(checkFastenerSizeRow({ id: '6mm' })[0].message, '[FASTENER_SIZE_ROW] a fastener size row\'s id is its thread size, as "M6"');
  // #endregion refused
});
