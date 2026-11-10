// D567 / #2310. Run under the heavy gate from apps/cad-studio.
// D567_SOURCE_FROZEN=1 node test/body-clipboard-project-autosave-browser.mjs EXTERNAL_OUTPUT
import assert from 'node:assert/strict';
import { createClipboardReplacementFlow } from './body-clipboard-replacement-helper.mjs';

const { f, fixtures: [stored, other], start, button, open, copySingle, bodyOracle, history, checkStale, freshPaste } =
  await createClipboardReplacementFlow({
    workId: 'D567', name: 'body-clipboard-project-autosave', driver: import.meta.filename, output: process.argv[2],
    required: [
      'apps/cad-studio/src/storage/useProject.ts', 'apps/cad-studio/src/storage/project.ts',
      'apps/cad-studio/src/storage/VersionsPanel.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx',
    ],
    limits: ['One browser project and its real saved and autosaved file. Read OPFS for observation only.'],
  });

async function readStored({ project, file, autosave }) {
  try {
    const root = await navigator.storage.getDirectory();
    const projects = await root.getDirectoryHandle('projects');
    let dir = await projects.getDirectoryHandle(project);
    if (autosave) dir = await (await dir.getDirectoryHandle('.barocss')).getDirectoryHandle('autosave');
    return JSON.parse(await (await (await dir.getFileHandle(file)).getFile()).text());
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return null;
    throw error;
  }
}

await f.run(async () => {
  await start();
  await open(stored, 'open the box to save in a browser project');
  const name = 'D567-stored', file = name + '.bcad', project = 'D567 clipboard autosave';
  await f.page.locator('.doc-tab input').fill(name);

  f.phase = 'create browser project and Save the exact original document';
  await button('Project and versions').click();
  const panel = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await panel.getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await panel.getByLabel('Project', { exact: true }).waitFor();
  await button('Save').click();
  await panel.getByRole('list', { name: 'Project documents', exact: true }).getByText(file, { exact: true }).waitFor();
  assert.deepEqual(await f.page.evaluate(readStored, { project, file, autosave: false }), stored.doc);
  await f.snapshot('01-original-saved');

  await f.openFeatureEditor(1, 'box');
  await f.editor().getByRole('spinbutton', { name: 'Distance', exact: true }).fill('11');
  const edited = await f.applyEditor(stored.doc, '02-unsaved-edit');
  const editedBox = { size: [10, 10, 11] };
  assert.equal(edited.doc.nodes[1].height, 11);
  assert.deepEqual(Object.keys(edited.doc.outputs), ['b1']);
  await bodyOracle(edited, editedBox, [0]);

  f.phase = 'wait for the real project autosave';
  const serialized = JSON.stringify(edited.doc);
  let autosaved;
  for (let attempt = 0; attempt < 40; attempt++) {
    autosaved = await f.page.evaluate(readStored, { project, file, autosave: true });
    if (JSON.stringify(autosaved) === serialized) break;
    await f.page.waitForTimeout(250);
  }
  assert.deepEqual(autosaved, edited.doc);
  assert.deepEqual(await f.page.evaluate(readStored, { project, file, autosave: false }), stored.doc);

  await open(other, 'leave the saved file through a different native document');
  f.phase = 'reopen the saved file and wait for its autosave offer';
  await panel.getByRole('button', { name: 'Open ' + file, exact: true }).click();
  await f.same(stored.doc);
  const offer = panel.getByRole('status', { name: 'Autosaved work', exact: true });
  await offer.waitFor();
  assert.match(await offer.innerText(), /D567-stored\.bcad/);
  const copied = await copySingle('03-saved-body-copied');
  assert.deepEqual(copied.doc, stored.doc);
  await bodyOracle(copied, stored, [0]);
  assert.deepEqual(await f.page.evaluate(readStored, { project, file, autosave: true }), edited.doc);

  f.phase = 'restore the autosave through the browser project';
  await offer.getByRole('button', { name: 'Restore autosaved work', exact: true }).click();
  await f.same(edited.doc);
  await offer.waitFor({ state: 'hidden' });
  const restored = await f.snapshot('04-project-autosave-restored');
  assert.deepEqual(restored.bodies.bodies.map(body => body.key), ['b1']);
  assert.equal(restored.fileName, name);
  await bodyOracle(restored, editedBox, [0]);
  await checkStale('05-autosave-stale-paste', restored);
  await history('Undo', '06-undo-autosave-restore', stored.doc);
  await history('Redo', '07-redo-autosave-restore', restored.doc);
  await freshPaste(restored.doc, editedBox, 20);
  assert.deepEqual(await f.page.evaluate(readStored, { project, file, autosave: false }), stored.doc);
  assert.deepEqual(f.report.downloads, []);
});
