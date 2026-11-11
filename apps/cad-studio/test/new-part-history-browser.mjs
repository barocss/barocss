import assert from 'node:assert/strict';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2), repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(mode === '--baseline' || mode === '--fixed');
const fixed = mode === '--fixed';
const pins = ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/state/workOwnership.ts',
  'apps/cad-studio/src/storage/useProject.ts', 'apps/cad-studio/src/app/recovery.ts', 'apps/cad-studio/test/flow-helper.mjs'];
const oracleSource = `
import json, math, sys
d = json.load(sys.stdin)
for s in d:
    outline, extrusion = s['doc']['nodes']
    assert outline['kind'] == 'sketch' and outline['profile'] == 'rectangle'
    assert outline['min'] == [0,0] and outline['max'] == [20,12]
    assert extrusion['kind'] == 'extrude' and extrusion['height'] == 8
    assert len(s['bodies']) == 1
    assert math.isclose(s['bodies'][0]['volume'], 20*12*8, abs_tol=1e-8)
print(json.dumps({'status':'PASS','volumeMm3':1920,'recoveries':len(d)}))
`;
const f = await createFlow({ name: 'new-part-history', envFrozen: 'D664_SOURCE_FROZEN', output,
  initialFiles: pins, requiredFrozen: pins, oracleSource, qualification: 'Undo and Redo restore New part document identity and history' });
const button = name => f.page.getByRole('button', { name, exact: true });
const name = () => f.page.locator('.doc-tab input');
const info = () => f.page.evaluate(() => ({
  fileName: document.querySelector('.doc-tab input').value,
  dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
  history: [...document.querySelectorAll('.history .hs')].map(item => item.getAttribute('aria-label')),
}));
async function newPart() {
  await button('New part').click();
  await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.ready();
}
async function box() {
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.page.keyboard.press('b');
  const hud = f.page.getByRole('dialog', { name: 'Box', exact: true });
  await hud.waitFor();
  for (const [label, value] of [['Width X', '20'], ['Depth Y', '12'], ['Height Z', '8']])
    await hud.getByLabel(label, { exact: true }).fill(value);
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview');
  await hud.getByRole('button', { name: 'Apply', exact: true }).click();
  await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 2);
  await f.ready();
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin, newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  await f.newPage();
  await newPart();
  const empty = await f.doc();
  await box();
  await name().fill('D664 Unsaved bracket');
  const original = await f.doc(), before = await info();
  assert.equal(before.fileName, 'D664 Unsaved bracket');
  assert.equal(before.dirty, true);
  assert.ok(before.history.some(entry => entry?.includes('Box')));
  await f.snapshot('01-named-unsaved');

  f.phase = 'New part and first Undo of the named unsaved document';
  await newPart();
  await f.same(empty);
  const blank = await info();
  assert.equal(blank.fileName, 'Untitled');
  await f.undo();
  await f.same(original);
  const restored = await info();
  if (!fixed) {
    assert.deepEqual(restored, { ...before, fileName: 'Untitled' });
    await f.snapshot('02-baseline-name-lost');
    f.report.observations.push({ oldName: before.fileName, afterUndoName: restored.fileName, geometryRestored: true, dirtyRetained: true });
    return;
  }
  assert.deepEqual(restored, before);
  await f.snapshot('02-unsaved-restored');
  const recoveredDirty = { doc: await f.doc(), bodies: (await f.bodies()).bodies };
  await f.redo();
  await f.same(empty);
  await f.ready();
  assert.deepEqual(await info(), blank);
  await f.undo();
  await f.same(original);
  assert.deepEqual(await info(), before);
  await f.undo();
  await f.same(empty);
  assert.equal((await info()).fileName, before.fileName);
  await f.redo();
  await f.same(original);
  await f.ready();
  assert.deepEqual(await info(), before);
  await f.snapshot('03-authored-history-still-undoable');

  f.phase = 'reload and restore the corrected recovery name and geometry';
  await f.page.waitForFunction(({ fileName, doc }) => {
    const raw = localStorage.getItem('studio.recovery');
    if (!raw) return false;
    const kept = JSON.parse(raw);
    return kept.fileName === fileName && JSON.stringify(kept.doc) === JSON.stringify(doc);
  }, { fileName: before.fileName, doc: original });
  await f.page.reload();
  await f.ready();
  const recovery = f.page.getByRole('dialog', { name: 'Recover unsaved work', exact: true });
  await recovery.getByText(/D664 Unsaved bracket/).waitFor();
  await recovery.getByRole('button', { name: 'Restore', exact: true }).click();
  await f.same(original);
  assert.deepEqual(await info(), before);
  await f.snapshot('04-recovered-after-reload');

  f.phase = 'Undo New part restores the clean state of a named native document';
  const file = join(output, 'D664 Saved bracket.bcad');
  await writeFile(file, JSON.stringify(original));
  await f.openFile(file, 2);
  await f.page.waitForFunction(() => document.querySelector('.doc-tab input').value === 'D664 Saved bracket');
  await f.same(original);
  const saved = await info();
  assert.equal(saved.fileName, 'D664 Saved bracket');
  assert.equal(saved.dirty, false);
  await newPart();
  await f.undo();
  await f.same(original);
  assert.deepEqual(await info(), saved);
  const recoveredClean = { doc: await f.doc(), bodies: (await f.bodies()).bodies };
  await f.runOracle([recoveredDirty, recoveredClean], 'recovered-boxes');
  await f.snapshot('05-saved-restored-clean');

  f.phase = 'New part history does not carry the other document’s project save destination';
  const projectName = 'D664 document identities', newName = 'D664 Saved empty';
  await button('Project and versions').click();
  const project = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await project.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(projectName);
  await project.getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await project.getByLabel('Project', { exact: true }).waitFor();
  const activeFile = () => project.getByLabel('Project documents', { exact: true }).locator('[data-active="true"]');
  const save = async label => {
    await button('Save').click();
    await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
    await activeFile().getByText(label + '.bcad', { exact: true }).waitFor();
  };
  await save(saved.fileName);
  await newPart();
  await name().fill(newName);
  await save(newName);
  const fileNames = [saved.fileName + '.bcad', newName + '.bcad'];
  const files = () => f.page.evaluate(async ({ projectName, fileNames }) => {
    const root = await navigator.storage.getDirectory();
    const folder = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(projectName);
    return Promise.all(fileNames.map(async file => (await (await folder.getFileHandle(file)).getFile()).text()));
  }, { projectName, fileNames });
  const retained = await files();
  assert.deepEqual(retained.map(JSON.parse), [original, empty]);
  await f.undo();
  await f.same(original);
  assert.deepEqual(await info(), saved);
  await activeFile().waitFor({ state: 'detached' });
  await f.redo();
  await f.same(empty);
  assert.equal((await info()).fileName, newName);
  assert.equal((await info()).dirty, false);
  await activeFile().waitFor({ state: 'detached' });
  assert.deepEqual(await files(), retained);
  await f.snapshot('06-project-files-preserved');
  f.report.observations.push({ unsavedNameRestored: true, savedNameRestored: true, dirtyRestored: true,
    cleanRestored: true, redoRestoredUntitled: true, authoredHistoryPreserved: true, recoveredAfterReload: true,
    savedProjectFilesUnchanged: true, oppositeSaveDestinationRetired: true });
});
