import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as cad from '../dist/index.js';
import { forAll, properties, random } from '../scripts/rb/property.mjs';

test('property harness: a seed repeats its cases; a failing property shrinks to its smallest counterexample', () => {
  const a = random(7), b = random(7); for (let k = 0; k < 5; k++) assert.equal(a(), b());
  // "Every integer below 100 is below 50", false from 50 on: shrinking by one and by halves ends at 50 exactly.
  const r = forAll({ name: 'below 50', runs: 200, seed: 3, gen: rnd => Math.floor(rnd() * 100), shrink: x => [x - 1, Math.floor(x / 2)].filter(y => y >= 0), prop: x => x < 50 });
  assert.ok(r.failed, 'found'); assert.equal(r.failed.smallest, 50);
  // A crash is a failure too, with its message.
  const c = forAll({ name: 'crash', runs: 3, seed: 1, gen: () => 1, shrink: () => [], prop: () => { throw new TypeError('boom'); } });
  assert.deepEqual(c.failed.why, { crash: 'boom' });
});

test('kernel properties: a quick slice (5 runs each, fixed seed); failures only where robustness/properties-todo.json says', () => {
  const todo = JSON.parse(readFileSync(new URL('../robustness/properties-todo.json', import.meta.url), 'utf8'));
  for (const p of properties(cad)) {
    const r = forAll({ ...p, runs: 5, seed: 20261018 });
    if (r.failed) assert.ok(todo.some(t => p.name.startsWith(t.property)), `${p.name}: ${JSON.stringify(r.failed.smallest)} ${JSON.stringify(r.failed.why)}`);
  }
});
