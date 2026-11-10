// D569 / #2310. Run under the heavy gate from apps/cad-studio.
// D569_SOURCE_FROZEN=1 node test/body-clipboard-text-focus-browser.mjs EXTERNAL_OUTPUT
import assert from 'node:assert/strict';
import { createClipboardReplacementFlow } from './body-clipboard-replacement-helper.mjs';

const { f, fixtures: [, source], start, open, bodyOracle, history, freshPaste } =
  await createClipboardReplacementFlow({
    workId: 'D569', name: 'body-clipboard-text-focus', driver: import.meta.filename, output: process.argv[2],
    required: ['apps/cad-studio/src/ui/BodyBrowserRows.tsx'],
    limits: [
      'Trusted Meta and Control shortcuts on the Studio File name input. A late observer cancels the native default after checking whether Studio intercepted it.',
      'Clipboard preservation is checked by body Paste after focus leaves the input. This flow does not read or write the OS clipboard.',
    ],
  });

function observeTextKeys() {
  const input = document.querySelector('.doc-tab input');
  const observed = [];
  window.__d569TextKeys = observed;
  window.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (event.target !== input || (!event.metaKey && !event.ctrlKey) || (key !== 'c' && key !== 'v')) return;
    observed.push({
      key, meta: event.metaKey, ctrl: event.ctrlKey, trusted: event.isTrusted,
      focused: document.activeElement === input,
      preventedByStudio: event.defaultPrevented,
    });
    // This listener runs after Studio's Window listener. Keep native clipboard transfer outside the test.
    event.preventDefault();
  });
}

await f.run(async () => {
  await start();
  await open(source, 'open the retained source box');
  const first = await freshPaste(source.doc, source, 22);

  f.phase = 'prepare both history stacks and leave the copy selected';
  const nudgedDoc = structuredClone(first.doc);
  assert.equal(nudgedDoc.nodes.at(-1).kind, 'translate');
  nudgedDoc.nodes.at(-1).offset[0] = 23;
  await f.page.keyboard.press('ArrowRight');
  await f.same(nudgedDoc);
  const before = await history('Undo', '03-undo-nudge-before-text-focus', first.doc);
  assert.deepEqual(before.selectedKeys, ['b4']);
  assert.equal(before.undo.enabled, true);
  assert.equal(before.redo.enabled, true);

  f.phase = 'focus the real File name text input';
  const name = f.page.locator('.doc-tab input');
  await name.selectText();
  assert.ok(await name.evaluate(input => input === document.activeElement && input.selectionEnd > input.selectionStart));
  await f.page.evaluate(observeTextKeys);
  const focused = await f.snapshot('04-file-name-focused');

  const expectedKeys = [];
  for (const [modifier, key] of [['Meta', 'c'], ['Meta', 'v'], ['Control', 'c'], ['Control', 'v']]) {
    const label = 'text-' + modifier.toLowerCase() + '-' + key;
    f.phase = label;
    await f.page.keyboard.press(modifier + '+' + key);
    expectedKeys.push({
      key, meta: modifier === 'Meta', ctrl: modifier === 'Control',
      trusted: true, focused: true, preventedByStudio: false,
    });
    const observed = await f.page.evaluate(() => window.__d569TextKeys);
    f.report.observations.push({ label, keydown: observed.at(-1) });
    assert.deepEqual(observed, expectedKeys);
    const after = await f.snapshot(label);
    for (const field of ['doc', 'bodies', 'selection', 'selectedKeys', 'history', 'undo', 'redo', 'fileName', 'dirty']) {
      assert.deepEqual(after[field], focused[field], `${label} preserves ${field}`);
    }
  }

  f.phase = 'leave the input and replay the existing history';
  await f.page.getByRole('group', { name: 'Mode', exact: true }).getByRole('button', { name: 'Model', exact: true }).click();
  assert.equal(await name.evaluate(input => input === document.activeElement), false);
  await history('Redo', '09-redo-nudge', nudgedDoc);
  await history('Undo', '10-undo-nudge-again', first.doc);

  f.phase = 'body Paste still uses the original clipboard';
  await f.page.keyboard.press('Meta+v');
  await f.changed(first.doc);
  const next = await f.snapshot('11-body-paste-after-text-focus');
  assert.deepEqual(next.selectedKeys, ['b7']);
  assert.deepEqual(Object.keys(next.doc.outputs).sort(), ['b1', 'b4', 'b7']);
  assert.deepEqual(next.doc.nodes.slice(0, 5), first.doc.nodes);
  assert.equal(next.doc.nodes[6].sketch, 5);
  assert.deepEqual(next.doc.nodes[7].parent, { node: 6, side: 'solid' });
  assert.deepEqual(next.doc.nodes[7].offset, [44, 0, 0]);
  await bodyOracle(next, source, [0, 22, 44]);
  await history('Undo', '12-undo-body-paste', first.doc);
  await history('Redo', '13-redo-body-paste', next.doc);
  assert.deepEqual(f.report.downloads, []);
});
