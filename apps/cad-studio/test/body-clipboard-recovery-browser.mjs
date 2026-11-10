// D563 / #2310. Run under the heavy gate from apps/cad-studio.
// D563_SOURCE_FROZEN=1 node test/body-clipboard-recovery-browser.mjs EXTERNAL_OUTPUT
import assert from 'node:assert/strict';
import { createClipboardReplacementFlow } from './body-clipboard-replacement-helper.mjs';

const { f, fixtures: [target, source], start, open, copySingle, bodyOracle, history, checkStale, freshPaste } =
  await createClipboardReplacementFlow({
    workId: 'D563', name: 'body-clipboard-recovery', driver: import.meta.filename, output: process.argv[2],
    required: [
      'apps/cad-studio/src/app/recovery.ts', 'apps/cad-studio/src/ui/NodeEditor.tsx',
      'packages/barocss-cad-model/src/engine/blobs.ts',
    ],
    limits: ['One real browser-local autosave, offered after reload. Browser storage is read for observation only.'],
  });

await f.run(async () => {
  await start();
  await open(target, 'open the recovery source');
  const name = 'D563 recovery box';
  await f.page.locator('.doc-tab input').fill(name);
  await f.openFeatureEditor(1, 'box');
  await f.editor().getByRole('spinbutton', { name: 'Distance', exact: true }).fill('11');
  const edited = await f.applyEditor(target.doc, '01-unsaved-recovery-source');
  assert.equal(edited.doc.nodes[1].height, 11);
  assert.deepEqual(Object.keys(edited.doc.outputs), ['b1']);
  const recoveredBox = { size: [10, 10, 11] };
  await bodyOracle(edited, recoveredBox, [0]);

  f.phase = 'wait for real local autosave';
  await f.page.waitForFunction(({ name, doc }) => {
    const raw = localStorage.getItem('studio.recovery');
    if (!raw) return false;
    const saved = JSON.parse(raw);
    return saved.fileName === name && JSON.stringify(saved.doc) === JSON.stringify(doc);
  }, { name, doc: edited.doc });
  const kept = await f.page.evaluate(() => localStorage.getItem('studio.recovery'));
  const offer = f.page.getByRole('dialog', { name: 'Recover unsaved work', exact: true });

  f.phase = 'reload Studio and retain its recovery offer';
  await f.page.reload();
  await offer.waitFor();
  await f.ready();
  assert.match(await offer.innerText(), /D563 recovery box/);
  assert.equal(await f.page.evaluate(() => localStorage.getItem('studio.recovery.offered')), kept);
  await f.snapshot('02-recovery-offered');

  await open(source, 'open the independent copy source');
  const copied = await copySingle('03-other-box-copied');
  assert.deepEqual(copied.doc, source.doc);
  await bodyOracle(copied, source, [0]);
  assert.equal(await offer.isVisible(), true);
  assert.equal(await f.page.evaluate(() => localStorage.getItem('studio.recovery.offered')), kept);

  f.phase = 'restore the real local recovery';
  await offer.getByRole('button', { name: 'Restore', exact: true }).click();
  await f.same(edited.doc);
  await offer.waitFor({ state: 'hidden' });
  assert.equal(await f.page.evaluate(() => localStorage.getItem('studio.recovery.offered')), null);
  const restored = await f.snapshot('04-recovery-restored');
  assert.equal(restored.fileName, name);
  assert.deepEqual(restored.bodies.bodies.map(body => body.key), ['b1']);
  await bodyOracle(restored, recoveredBox, [0]);
  await checkStale('05-recovery-stale-paste', restored);
  await history('Undo', '06-undo-recovery', source.doc);
  await history('Redo', '07-redo-recovery', restored.doc);

  await freshPaste(restored.doc, recoveredBox, 20);
  assert.deepEqual(f.report.downloads, []);
});
