import test from 'node:test';
import assert from 'node:assert/strict';
import { ARMS, VIEWPORTS, REPEATS } from './baseline.mjs';
import { CASES, PLANNED_CELLS, semanticSignature, specFor, supportFor } from './cases.mjs';

const count = (kind) => CASES.filter((item) => item.kind === kind).length;
test('transparent authored corpus has twelve cases and 192 planned cells', () => {
  assert.equal(CASES.length, 12);
  assert.equal(new Set(CASES.map((item) => item.id)).size, CASES.length);
  assert.deepEqual(new Set(CASES.map((item) => item.scenario)), new Set(['settings', 'dashboard', 'kiosk']));
  assert.equal(count('preset'), 3);
  assert.equal(count('scalar'), 4);
  assert.equal(count('compiled-state'), 2);
  assert.equal(count('absent-rule'), 3);
  assert.equal(PLANNED_CELLS, CASES.length * ARMS.length * Object.keys(VIEWPORTS).length * REPEATS);
  assert.equal(PLANNED_CELLS, 192);
});

test('all arms keep identical semantic nodes, bindings and actions before and after edits', () => {
  for (const editCase of CASES) {
    const reference = semanticSignature(specFor(editCase, 'preset', false));
    for (const arm of ARMS) for (const edited of [false, true]) {
      assert.deepEqual(semanticSignature(specFor(editCase, arm, edited)), reference, `${editCase.id}/${arm}/${edited}`);
    }
  }
});

test('support is classified from the frozen vocabulary, not browser outcomes', () => {
  for (const editCase of CASES) {
    assert.equal(supportFor(editCase, 'utility').supported, true);
    assert.equal(supportFor(editCase, 'build').supported, false);
    assert.equal(supportFor(editCase, 'preset').supported, editCase.kind === 'preset' || editCase.kind === 'compiled-state');
    assert.equal(supportFor(editCase, 'variable').supported, editCase.kind !== 'absent-rule');
  }
});
