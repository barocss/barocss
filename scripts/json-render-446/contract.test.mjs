import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ARMS, MEASURES, SCENARIOS, fixtureCases, validateContract } from './contract.mjs';

test('frozen replay covers every scenario, styling arm, and edit', () => {
  assert.deepEqual(validateContract(), []);
  assert.equal(fixtureCases().length, 48);
  for (const scenario of Object.keys(SCENARIOS)) {
    for (const arm of Object.keys(ARMS)) {
      assert.deepEqual(fixtureCases().filter((item) => item.scenario === scenario && item.arm === arm).map((item) => item.stage), ['initial', 'density', 'responsive', 'structure']);
    }
  }
});

test('structure edit adds only the help node and keeps interaction identity', () => {
  for (const [name, fixture] of Object.entries(SCENARIOS)) {
    const stages = fixtureCases().filter((item) => item.scenario === name && item.arm === 'fixed');
    assert.deepEqual(stages[3].semanticIds, [...stages[2].semanticIds, 'help']);
    assert.ok(stages.every((item) => item.semanticIds.includes(fixture.interaction.target)));
    assert.ok(stages.every((item) => item.semanticIds.includes(fixture.nodes.find((node) => node.action === fixture.interaction.action).id)));
  }
});

test('measurement contract separates renderer and styling outcomes', () => {
  for (const key of ['domSignature', 'inputValuePreserved', 'focusPreserved', 'actionCount', 'unstyledFrames', 'themeAdherence', 'hostStyleDelta']) assert.ok(MEASURES.includes(key));
});
