import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const result = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'result-post440.json'), 'utf8'));
const names = ['virt1_gc1', 'virt1_gc0', 'virt0_gc1', 'virt0_gc0', 'virt0_noRuntime'];
for (const name of names) {
  const arm = result[name];
  assert.ok(arm, `missing ${name}`);
  assert.equal(arm.N, 2000);
  assert.equal(arm.INTERVAL, 20);
  assert.equal(arm.UNIQUE, 3);
  assert.equal(arm.KEEP, 50);
  assert.deepEqual(arm.samples.map(s => s.n), Array.from({ length: 20 }, (_, i) => (i + 1) * 100));
  for (const sample of arm.samples) {
    assert.equal(sample.domMsgs, name.startsWith('virt1_') ? 50 : sample.n);
    assert.equal(sample.domElements, Math.round(sample.domMsgs * 43.3));
  }
}
const settled = name => result[name].settledAfter8s;
assert.equal(settled('virt0_gc1').reclaimed, 0);
assert.equal(settled('virt0_gc0').reclaimed, 0);
assert.equal(settled('virt1_gc0').reclaimed, 0);
assert.equal(settled('virt1_gc1').reclaimed, 5850);
assert.equal(settled('virt1_gc1').domMsgs, 50);
assert.ok(settled('virt1_gc1').rules < 1000);
assert.ok(settled('virt1_gc1').styles < 50);
assert.equal(settled('virt1_gc0').rules, settled('virt0_gc0').rules);
assert.equal(settled('virt0_gc1').rules, settled('virt0_gc0').rules);
assert.equal(settled('virt0_noRuntime').domMsgs, 2000);
assert.equal(settled('virt0_noRuntime').rules, 0);
assert.equal(settled('virt0_noRuntime').cssInserts, 0);
console.log('Five matched 2,000-message arms and count-based contracts passed.');
