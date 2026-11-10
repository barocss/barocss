// D566 / #2310. Run under the heavy gate from apps/cad-studio.
// D566_SOURCE_FROZEN=1 node test/body-clipboard-history-branch-browser.mjs EXTERNAL_OUTPUT --expect=repro|fixed
import assert from 'node:assert/strict';
import { createClipboardReplacementFlow } from './body-clipboard-replacement-helper.mjs';

const [output, option] = process.argv.slice(2);
const mode = option?.match(/^--expect=(repro|fixed)$/)?.[1];
assert.ok(mode, 'Pass --expect=repro or --expect=fixed');
const { f, start, button, copySingle, bodyOracle, history, checkStale, freshPaste } =
  await createClipboardReplacementFlow({
    workId: 'D566', name: 'body-clipboard-history-branch', driver: import.meta.filename, output,
    required: ['packages/barocss-cad-model/src/engine/doc.ts', 'packages/barocss-cad-model/src/engine/ids.ts'],
    limits: ['Two boxes authored in different branches from the same empty document. Normal Redo is a positive control.'],
  });
f.report.mode = mode;
f.report.productResult = 'NOT_ADJUDICATED';

async function createBox(label, empty, fixture) {
  f.phase = label;
  await f.page.keyboard.press('b');
  const hud = f.page.locator('.hud');
  await hud.waitFor();
  for (const [key, value] of [['Width X', fixture.size[0]], ['Depth Y', fixture.size[1]], ['Height Z', fixture.size[2]],
    ['At X', 0], ['At Y', 0], ['At Z', 0]]) {
    await hud.locator('.field', { has: f.page.locator(`span:text-is("${key}")`) }).locator('input').fill(String(value));
  }
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent?.trim() === 'preview');
  await hud.getByRole('button', { name: 'Apply', exact: true }).click();
  await f.changed(empty);
  const state = await f.snapshot(label);
  assert.deepEqual(Object.keys(state.doc.outputs), ['b1']);
  await bodyOracle(state, fixture, [0]);
  return state;
}

await f.run(async () => {
  await start();
  f.phase = '01 create one empty document';
  await button('New part').click();
  await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.ready();
  const empty = await f.snapshot('01-empty');
  const a = { size: [10, 10, 10] }, b = { size: [8, 9, 11] };

  const original = await createBox('02-original-b1', empty.doc, a);
  await copySingle('03-original-copied');
  const beforeRedo = await history('Undo', '04-undo-original-creation', empty.doc);
  assert.equal(beforeRedo.redo.enabled, true);
  await history('Redo', '05-redo-original-creation', original.doc);

  f.phase = '06 Paste still works after restoring the exact original branch';
  await f.page.keyboard.press('Meta+v');
  await f.changed(original.doc);
  const first = await f.snapshot('06-original-paste');
  assert.deepEqual(first.doc.nodes.at(-1).offset, [20, 0, 0]);
  assert.deepEqual(first.selectedKeys, ['b4']);
  await bodyOracle(first, a, [0, 20]);

  await history('Undo', '07-undo-original-paste', original.doc);
  const beforeFork = await history('Undo', '08-undo-original-before-fork', empty.doc);
  assert.equal(beforeFork.redo.enabled, true);
  const replacement = await createBox('09-replacement-b1', empty.doc, b);
  assert.notDeepEqual(replacement.doc, original.doc);
  assert.equal(replacement.redo.enabled, false);

  if (mode === 'repro') {
    f.phase = '10 try stale Paste in the different branch';
    await f.page.keyboard.press('Meta+v');
    await f.changed(replacement.doc);
    const stale = await f.snapshot('10-stale-paste-rebound');
    assert.deepEqual(stale.doc.nodes.at(-1).offset, [36, 0, 0]);
    assert.deepEqual(stale.selectedKeys, ['b4']);
    await bodyOracle(stale, b, [0, 36]);
    await history('Undo', '11-undo-stale-paste', replacement.doc);
    f.report.productResult = 'FAIL';
  } else {
    await checkStale('10-stale-paste-refused', replacement);
    await history('Undo', '11-first-undo-removes-replacement', empty.doc);
    await history('Redo', '12-redo-restores-replacement', replacement.doc);
    await freshPaste(replacement.doc, b, 18);
    f.report.productResult = 'PASS';
  }
  assert.deepEqual(f.report.downloads, []);
});
