// D571 / #2310. Run under the heavy gate from apps/cad-studio.
// D571_SOURCE_FROZEN=1 node test/body-clipboard-notice-browser.mjs EXTERNAL_OUTPUT --expect=repro|fixed
import assert from 'node:assert/strict';
import { createClipboardReplacementFlow } from './body-clipboard-replacement-helper.mjs';

const [output, option] = process.argv.slice(2);
const mode = option?.match(/^--expect=(repro|fixed)$/)?.[1];
assert.ok(mode, 'Pass --expect=repro or --expect=fixed');

const { f, fixtures: [a, b], start, button, open, copySingle, bodyOracle, history, checkStale, freshPaste } =
  await createClipboardReplacementFlow({
    workId: 'D571', name: 'body-clipboard-notice', driver: import.meta.filename, output,
    required: ['apps/cad-studio/src/files/useStudioDocumentFiles.ts', 'apps/cad-studio/src/files/documentFile.ts'],
    limits: [
      'Observe the actual Copy notice after Open, New, document-boundary Undo and Redo, and reuse of a producer ID on a new history branch.',
      'A failed Open supplies the separate notice that must survive a later New part.',
    ],
  });
f.report.mode = mode;
f.report.productResult = 'NOT_ADJUDICATED';

function checkCopyNotice(state, expected) {
  const shown = state.notices.some(notice => notice.startsWith('Copied'));
  f.report.observations.push({ label: state.label, copiedNoticeShown: shown });
  assert.equal(shown, expected, state.label);
}

async function newPart(label) {
  f.phase = label;
  await button('New part').click();
  await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.ready();
  return f.snapshot(label);
}

async function createBox(label, empty, size) {
  f.phase = label;
  await f.page.keyboard.press('b');
  const hud = f.page.locator('.hud');
  await hud.waitFor();
  for (const [field, value] of [
    ['Width X', size[0]], ['Depth Y', size[1]], ['Height Z', size[2]], ['At X', 0], ['At Y', 0], ['At Z', 0],
  ]) {
    await hud.locator('.field', { has: f.page.locator(`span:text-is("${field}")`) }).locator('input').fill(String(value));
  }
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent?.trim() === 'preview');
  await hud.getByRole('button', { name: 'Apply', exact: true }).click();
  await f.changed(empty);
  const state = await f.snapshot(label);
  assert.deepEqual(Object.keys(state.doc.outputs), ['b1']);
  await bodyOracle(state, { size }, [0]);
  return state;
}

await f.run(async () => {
  await start();
  const staleNotice = mode === 'repro';
  await open(a, 'open document A');
  checkCopyNotice(await copySingle('01-copy-A'), true);

  await open(b, 'replace A with B using Open');
  const opened = await f.snapshot('02-open-B');
  checkCopyNotice(opened, staleNotice);
  await checkStale('03-paste-after-open', opened);

  checkCopyNotice(await copySingle('04-copy-B'), true);
  checkCopyNotice(await history('Undo', '05-undo-open-to-A', a.doc), staleNotice);
  checkCopyNotice(await copySingle('06-copy-A-again'), true);
  checkCopyNotice(await history('Redo', '07-redo-open-to-B', b.doc), staleNotice);

  checkCopyNotice(await copySingle('08-copy-B-before-failed-open'), true);
  f.phase = 'replace the Copy notice with a real Open refusal';
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'D571-invalid.bcad', mimeType: 'application/json', buffer: Buffer.from('{') });
  const refused = await f.waitToast(/it is not JSON/);
  await f.same(b.doc);
  const empty = await newPart('09-new-keeps-unrelated-refusal');
  assert.ok(empty.notices.includes(refused));
  checkCopyNotice(empty, false);

  const original = await createBox('10-original-branch', empty.doc, [10, 10, 10]);
  checkCopyNotice(await copySingle('11-copy-original-branch'), true);
  checkCopyNotice(await history('Undo', '12-ordinary-undo-keeps-notice', empty.doc), true);
  checkCopyNotice(await history('Redo', '13-ordinary-redo-keeps-notice', original.doc), true);
  checkCopyNotice(await history('Undo', '14-undo-before-new-branch', empty.doc), true);
  const replacement = await createBox('15-new-branch-reuses-b1', empty.doc, [8, 9, 11]);
  checkCopyNotice(replacement, staleNotice);
  await checkStale('16-paste-after-branch-reuse', replacement);

  const pasted = await freshPaste(replacement.doc, { size: [8, 9, 11] }, 18);
  checkCopyNotice(pasted, true);
  checkCopyNotice(await newPart('19-new-clears-copy-notice'), staleNotice);
  assert.deepEqual(f.report.downloads, []);
  f.report.productResult = mode === 'repro' ? 'FAIL' : 'PASS';
});
