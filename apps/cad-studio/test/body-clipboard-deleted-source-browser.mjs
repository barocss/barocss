// D565 / #2310. Run under the heavy gate from apps/cad-studio.
// D565_SOURCE_FROZEN=1 node test/body-clipboard-deleted-source-browser.mjs EXTERNAL_OUTPUT
import assert from 'node:assert/strict';
import { createClipboardReplacementFlow } from './body-clipboard-replacement-helper.mjs';

const { f, fixtures: [, source], start, open, bodyOracle, history, checkStale, freshPaste } =
  await createClipboardReplacementFlow({
    workId: 'D565', name: 'body-clipboard-deleted-source', driver: import.meta.filename, output: process.argv[2],
    required: [
      'apps/cad-studio/src/state/useFeatureHistory.ts', 'apps/cad-studio/src/ui/BodyBrowserRows.tsx',
      'packages/barocss-cad-model/src/engine/ids.ts',
    ],
    limits: ['One accepted Delete, a different body added with Box, and exact Undo back to the original source.'],
  });

await f.run(async () => {
  await start();
  await open(source, 'open the original box');
  const first = await freshPaste(source.doc, source, 22);

  f.phase = 'select and delete the copied source rather than its independent copy';
  await f.page.getByRole('complementary', { name: 'Browser', exact: true })
    .getByRole('button', { name: 'Box', exact: true }).click();
  const picked = await f.snapshot('03-original-selected-for-deletion');
  assert.deepEqual(picked.selectedKeys, ['b1']);
  await f.page.keyboard.press('Delete');
  await f.changed(first.doc);
  const deleted = await f.snapshot('04-original-deleted');
  assert.deepEqual(Object.keys(deleted.doc.outputs), ['b4']);
  await bodyOracle(deleted, source, [22]);
  await checkStale('05-missing-source-paste', deleted);

  f.phase = 'add a different box in the same document';
  await f.page.keyboard.press('b');
  const hud = f.page.locator('.hud');
  await hud.waitFor();
  for (const [label, value] of [['Width X', 8], ['Depth Y', 9], ['Height Z', 11], ['At X', 0], ['At Y', 0], ['At Z', 0]]) {
    await hud.locator('.field', { has: f.page.locator(`span:text-is("${label}")`) }).locator('input').fill(String(value));
  }
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent?.trim() === 'preview');
  await hud.getByRole('button', { name: 'Apply', exact: true }).click();
  await f.changed(deleted.doc);
  const created = await f.snapshot('06-different-body-added');
  assert.deepEqual(Object.keys(created.doc.outputs).sort(), ['b4', 'b6']);
  assert.deepEqual(created.bodies.bodies.find(body => body.key === 'b4'), deleted.bodies.bodies[0]);
  const added = created.bodies.bodies.find(body => body.key === 'b6');
  assert.ok(added);
  await bodyOracle({ label: '06-new-body', bodies: { bodies: [added] } }, { size: [8, 9, 11] }, [0]);
  await checkStale('07-paste-with-different-bodies-present', created);

  await history('Undo', '08-undo-new-body', deleted.doc);
  await history('Undo', '09-undo-delete-restores-source', first.doc);

  f.phase = 'Paste after Undo restores the same original source';
  await f.page.keyboard.press('Meta+v');
  await f.changed(first.doc);
  const next = await f.snapshot('10-next-paste-of-restored-source');
  assert.deepEqual(Object.keys(next.doc.outputs).sort(), ['b1', 'b4', 'b7']);
  assert.deepEqual(next.selectedKeys, ['b7']);
  assert.deepEqual(next.doc.nodes.at(-1).offset, [44, 0, 0]);
  await bodyOracle(next, source, [0, 22, 44]);
  await history('Undo', '11-undo-second-paste', first.doc);
  await history('Redo', '12-redo-second-paste', next.doc);
  assert.deepEqual(f.report.downloads, []);
});
