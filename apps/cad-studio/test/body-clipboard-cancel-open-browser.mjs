// D570 / #2310. Run under the heavy gate from apps/cad-studio.
// D570_SOURCE_FROZEN=1 node test/body-clipboard-cancel-open-browser.mjs EXTERNAL_OUTPUT
import assert from 'node:assert/strict';
import { createClipboardReplacementFlow } from './body-clipboard-replacement-helper.mjs';

const { f, fixtures: [, source], start, button, open, bodyOracle, history, freshPaste } =
  await createClipboardReplacementFlow({
    workId: 'D570', name: 'body-clipboard-cancel-open', driver: import.meta.filename, output: process.argv[2],
    required: [
      'apps/cad-studio/src/files/useStudioDocumentFiles.ts',
      'apps/cad-studio/src/files/documentFile.ts',
    ],
    limits: [
      'The actual Open toolbar action requests a file chooser. Chromium cancels it through CDP before a native dialog is shown.',
      'The file input must emit a trusted cancel with no selected file, input or change. No synthetic DOM events are dispatched.',
    ],
  });

function observeFileInput() {
  const input = document.querySelector('input[aria-label="Model file"]');
  if (!(input instanceof HTMLInputElement) || input.type !== 'file') throw new Error('Model file input required');
  const events = [];
  window.__d570FileEvents = events;
  for (const name of ['cancel', 'input', 'change']) {
    input.addEventListener(name, event => {
      events.push({ type: event.type, trusted: event.isTrusted, files: input.files.length });
    });
  }
}

await f.run(async () => {
  await start();
  await open(source, 'open the retained source box');
  const first = await freshPaste(source.doc, source, 22);

  f.phase = 'prepare both history stacks';
  const nudgedDoc = structuredClone(first.doc);
  assert.equal(nudgedDoc.nodes.at(-1).kind, 'translate');
  nudgedDoc.nodes.at(-1).offset[0] = 23;
  await f.page.keyboard.press('ArrowRight');
  await f.same(nudgedDoc);
  const before = await history('Undo', '03-undo-nudge-before-cancel', first.doc);
  assert.deepEqual(before.selectedKeys, ['b4']);
  assert.equal(before.undo.enabled, true);
  assert.equal(before.redo.enabled, true);

  f.phase = 'click Open and let Chromium cancel the file chooser';
  await f.page.evaluate(observeFileInput);
  const session = await f.context.newCDPSession(f.page);
  try {
    await session.send('Page.setInterceptFileChooserDialog', { enabled: true, cancel: true });
    await button('Open').click();
    await f.page.waitForFunction(() => window.__d570FileEvents.some(event => event.type === 'cancel'), null, { timeout: 12000 });
  } finally {
    await session.send('Page.setInterceptFileChooserDialog', { enabled: false });
    await session.detach();
  }
  const after = await f.snapshot('04-open-cancelled');
  const events = await f.page.evaluate(() => window.__d570FileEvents);
  f.report.observations.push({ label: 'chrome-file-input-events', events });
  assert.deepEqual(events, [{ type: 'cancel', trusted: true, files: 0 }]);
  for (const field of ['doc', 'bodies', 'selection', 'selectedKeys', 'history', 'undo', 'redo', 'fileName', 'dirty']) {
    assert.deepEqual(after[field], before[field], `cancelled Open preserves ${field}`);
  }

  await history('Redo', '05-redo-nudge', nudgedDoc);
  await history('Undo', '06-undo-nudge-again', first.doc);
  f.phase = 'Paste without another Copy';
  await f.page.keyboard.press('Meta+v');
  await f.changed(first.doc);
  const next = await f.snapshot('07-body-paste-after-cancel');
  assert.deepEqual(next.selectedKeys, ['b7']);
  assert.deepEqual(Object.keys(next.doc.outputs).sort(), ['b1', 'b4', 'b7']);
  assert.deepEqual(next.doc.nodes.at(-1).offset, [44, 0, 0]);
  await bodyOracle(next, source, [0, 22, 44]);
  await history('Undo', '08-undo-body-paste', first.doc);
  await history('Redo', '09-redo-body-paste', next.doc);
  assert.deepEqual(f.report.downloads, []);
});
