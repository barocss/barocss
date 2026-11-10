// D568 / #2310. Run under the heavy gate from apps/cad-studio.
// D568_SOURCE_FROZEN=1 node test/body-clipboard-save-reopen-browser.mjs EXTERNAL_OUTPUT
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256 } from './flow-helper.mjs';
import { createClipboardReplacementFlow } from './body-clipboard-replacement-helper.mjs';

const { f, fixtures: [, source], start, button, open, bodyOracle, checkStale, freshPaste } =
  await createClipboardReplacementFlow({
    workId: 'D568', name: 'body-clipboard-save-reopen', driver: import.meta.filename, output: process.argv[2],
    required: [
      'apps/cad-studio/src/storage/useProject.ts', 'apps/cad-studio/src/storage/project.ts',
      'apps/cad-studio/src/files/useStudioDocumentFiles.ts', 'apps/cad-studio/src/files/documentFile.ts',
      'packages/barocss-cad-model/src/engine/container.ts',
    ],
    limits: ['Save to a real browser project, read back the native bytes, and open them through the file chooser in a fresh browser context.'],
  });

function checkCopies(doc) {
  assert.deepEqual(doc.nodes.slice(0, 2), source.doc.nodes);
  assert.equal(doc.nodes.length, 8);
  assert.deepEqual(Object.keys(doc.outputs).sort(), ['b1', 'b4', 'b7']);
  assert.equal(new Set(doc.nodes.map(node => node.id)).size, 8);
  for (const [sketch, top, offset] of [[2, 4, 22], [5, 7, 44]]) {
    assert.equal(doc.nodes[sketch].kind, 'sketch');
    assert.equal(doc.nodes[top - 1].kind, 'extrude');
    assert.equal(doc.nodes[top - 1].sketch, sketch);
    assert.equal(doc.nodes[top].kind, 'translate');
    assert.deepEqual(doc.nodes[top].parent, { node: top - 1, side: 'solid' });
    assert.deepEqual(doc.nodes[top].offset, [offset, 0, 0]);
    assert.deepEqual(doc.outputs['b' + top], { node: top, side: 'solid' });
  }
}

await f.run(async () => {
  await start();
  await open(source, 'open the original box');
  const first = await freshPaste(source.doc, source, 22);

  f.phase = 'paste the same source a second time';
  await f.page.keyboard.press('Meta+v');
  await f.changed(first.doc);
  const second = await f.snapshot('03-two-admitted-copies');
  assert.deepEqual(second.selectedKeys, ['b7']);
  checkCopies(second.doc);
  await bodyOracle(second, source, [0, 22, 44]);

  const name = 'D568-copied-boxes', file = name + '.bcad', project = 'D568 clipboard project';
  await f.page.locator('.doc-tab input').fill(name);
  f.phase = 'save the exact accepted document to the browser project';
  await button('Project and versions').click();
  const panel = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await panel.getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await panel.getByLabel('Project', { exact: true }).waitFor();
  await button('Save').click();
  await panel.getByRole('list', { name: 'Project documents', exact: true }).getByText(file, { exact: true }).waitFor();
  await f.page.locator('[aria-label="Unsaved changes"]').waitFor({ state: 'hidden' });
  const saved = await f.snapshot('04-project-saved');
  assert.deepEqual(saved.doc, second.doc);
  const bytes = Buffer.from(await f.page.evaluate(async ({ project, file }) => {
    const root = await navigator.storage.getDirectory();
    const projects = await root.getDirectoryHandle('projects');
    const dir = await projects.getDirectoryHandle(project);
    const handle = await dir.getFileHandle(file);
    return Array.from(new Uint8Array(await (await handle.getFile()).arrayBuffer()));
  }, { project, file }));
  const decoded = JSON.parse(bytes);
  assert.deepEqual(decoded, second.doc);
  checkCopies(decoded);
  await writeFile(join(f.output, 'saved-project-document.bcad'), bytes);
  f.report.observations.push({ label: 'native-save', byteLength: bytes.length, sha256: sha256(bytes) });

  f.phase = 'fresh browser context opens the exact saved bytes';
  const previousContext = f.context;
  await f.newPage();
  assert.notEqual(f.context, previousContext);
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: file, mimeType: 'application/json', buffer: bytes });
  await f.same(decoded);
  const reopened = await f.snapshot('05-fresh-open');
  checkCopies(reopened.doc);
  assert.equal(reopened.fileName, name);
  assert.equal(reopened.dirty, false);
  await bodyOracle(reopened, source, [0, 22, 44]);

  await checkStale('06-fresh-page-paste', reopened);
  assert.deepEqual(f.report.downloads, []);
});
