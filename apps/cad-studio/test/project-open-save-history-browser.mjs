import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
assert.ok(['--baseline', '--fixed', '--version-baseline', '--version-fixed', '--file-controls', '--version-storage'].includes(mode));
const baseline = mode.endsWith('baseline');
const version = mode.startsWith('--version');
const storage = mode === '--version-storage';
const controls = mode === '--file-controls';
const stepPath = 'packages/barocss-cad/conformance/a6/references/block-keepout/block.step';
const pins = [
  'apps/cad-studio/test/project-open-save-history-browser.mjs', 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/storage/useProject.ts', 'apps/cad-studio/src/state/workOwnership.ts',
  'apps/cad-studio/src/storage/project.ts', 'apps/cad-studio/src/storage/VersionsPanel.tsx',
  ...(controls ? [stepPath, 'apps/cad-studio/src/files/useStudioDocumentFiles.ts'] : []),
];
const f = await createFlow({
  name: 'project-open-save-history', output, envFrozen: storage ? 'D961_SOURCE_FROZEN' : controls ? 'D960_SOURCE_FROZEN' : version ? 'D959_SOURCE_FROZEN' : 'D958_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: storage ? 'A controlled version log write failure preserves an existing project file.' : controls ? 'Keep the correct destination across STEP, external native Open and New part history.' : version ? 'A semantic version refusal preserves the actual project file and version log.' : 'Restore the project Save destination with the exact document through Undo and Redo.',
  limits: [storage ? 'One existing OPFS part and log with a controlled log write denial.' : controls ? 'One browser project, native file Open and one retained STEP file. The download is intercepted before delivery.' : version ? 'Duplicate version name and a valid follow-up in one browser project.'
    : 'Two rectangular native parts in one browser project. Version refusal is a separate case.'],
  snapshotExtra: () => ({
    title: document.querySelector('.doc-tab input')?.value,
    active: document.querySelector('[aria-label="Project documents"] [data-active="true"]')?.textContent ?? null,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
  }),
});
const part = (depth, height) => ({
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [4, depth], id: 'n0' },
    { kind: 'extrude', sketch: 0, height, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
});
const a = part(6, 2), b = part(8, 4);
const projectName = 'D958 save history';
const button = name => f.page.getByRole('button', { name, exact: true });
const panel = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const files = () => panel().getByRole('list', { name: 'Project documents', exact: true });
const title = () => f.page.locator('.doc-tab input');
const dirty = () => f.page.getByLabel('Unsaved changes', { exact: true });
async function openFile(name, mimeType, buffer) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name, mimeType, buffer });
}
async function openNative(name, doc) {
  await openFile(name + '.bcad', 'application/json', Buffer.from(JSON.stringify(doc)));
  await f.same(doc);
  assert.equal(await title().inputValue(), name);
}
async function readPart(name) {
  return f.page.evaluate(async ([projectName, name]) => {
    const root = await navigator.storage.getDirectory();
    const project = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(projectName);
    return (await (await project.getFileHandle(name + '.bcad')).getFile()).text();
  }, [projectName, name]);
}
async function check(label, doc, volume, name, active, isDirty) {
  await f.same(doc);
  const state = await f.snapshot(label);
  assert.equal(state.title, name);
  assert.equal(state.active, active === null ? null : active + '.bcad');
  assert.equal(state.dirty, isDirty);
  assert.equal(state.bodies.bodies.length, 1);
  assert.ok(Math.abs(state.bodies.bodies[0].volume - volume) < 1e-9);
  return state;
}
async function save(name) {
  await button('Save').click();
  await dirty().waitFor({ state: 'hidden' });
  await files().locator('[data-active="true"]').getByText(name + '.bcad', { exact: true }).waitFor();
}
async function projectOpen(name, doc) {
  await files().getByRole('button', { name: 'Open ' + name + '.bcad', exact: true }).click();
  await f.same(doc);
}
async function versionFlow(original) {
  const name = panel().getByRole('textbox', { name: 'Version name', exact: true });
  const make = value => name.fill(value).then(() => panel().getByRole('button', { name: 'Make version', exact: true }).click());
  const readLog = () => f.page.evaluate(async projectName => {
    const root = await navigator.storage.getDirectory();
    const project = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(projectName);
    const versions = await (await project.getDirectoryHandle('.barocss')).getDirectoryHandle('versions');
    return (await (await versions.getFileHandle('A.bcad.json')).getFile()).text();
  }, projectName);
  f.phase = 'create the first named version through the actual project panel';
  await check('00-active-a', a, 48, 'A', 'A', false);
  await make('Reference A');
  await panel().getByLabel('Version Reference A', { exact: true }).waitFor();
  const beforeLog = await readLog();
  await f.openFeatureEditor(1, 'Extrude');
  await f.editor().getByLabel('Distance', { exact: true }).fill('3');
  const { doc: edited } = await f.applyEditor(a, '01-edit-a-after-version');
  await dirty().waitFor();

  if (storage) {
    f.phase = 'deny the native log write after valid version validation';
    await f.page.evaluate(() => { window.__d961DenyLog = true; });
    await make('Valid name with denied log');
    await f.waitToast(/The version was not kept.*STORAGE_DENIED/s);
    assert.equal(await f.page.evaluate(() => window.__d961LogDenials), 1);
  } else {
    f.phase = 'refuse a duplicate version name with dirty accepted geometry';
    await make('Reference A');
    await f.waitToast(/No version made.*already named/s);
  }
  const state = await f.snapshot('02-refused-version');
  assert.deepEqual(state.doc, edited);
  assert.equal(state.active, 'A.bcad');
  assert.equal(await readLog(), beforeLog);
  const afterRefusal = await readPart('A');
  f.report.observations.push({ label: 'refused-version', beforeSHA256: sha256(original),
    afterSHA256: sha256(afterRefusal), logSHA256: sha256(beforeLog), dirty: state.dirty });
  assert.equal(afterRefusal, original, 'the refused version must preserve the primary project file bytes');
  assert.equal(state.dirty, true, 'the edit remains dirty after refusal');
  assert.equal(baseline, false, 'baseline must reproduce the unsafe write');

  f.phase = 'accept a unique version name and save the same accepted geometry';
  await make('Reference A edited');
  await panel().getByLabel('Version Reference A edited', { exact: true }).waitFor();
  await check('03-successful-version', edited, 72, 'A', 'A', false);
  const after = await readPart('A');
  assert.deepEqual(JSON.parse(after), edited);
  const afterLog = await readLog();
  assert.equal(JSON.parse(afterLog).versions.length, 2);
  f.report.observations.push({ label: 'valid-version', nativeSHA256: sha256(after), logSHA256: sha256(afterLog) });
}

function denyVersionLogWrite() {
  window.__d961LogDenials = 0;
  const create = FileSystemFileHandle.prototype.createWritable;
  const logs = new WeakSet();
  FileSystemFileHandle.prototype.createWritable = async function (...args) {
    const stream = await create.apply(this, args);
    if (this.name === 'A.bcad.json') logs.add(stream);
    return stream;
  };
  const write = FileSystemWritableFileStream.prototype.write;
  FileSystemWritableFileStream.prototype.write = async function (...args) {
    if (logs.has(this) && window.__d961DenyLog) {
      window.__d961DenyLog = false;
      window.__d961LogDenials++;
      throw new DOMException('Injected log write denial', 'NotAllowedError');
    }
    return write.apply(this, args);
  };
}

function captureNativeSave() {
  const blobs = new Map();
  const create = URL.createObjectURL;
  const click = HTMLAnchorElement.prototype.click;
  window.__d960Saves = [];
  URL.createObjectURL = function (blob) {
    const url = create.call(this, blob);
    blobs.set(url, blob);
    return url;
  };
  HTMLAnchorElement.prototype.click = function () {
    const blob = blobs.get(this.href);
    if (!blob || !this.download.endsWith('.bcad')) return click.call(this);
    const { download } = this;
    void blob.text().then(text => window.__d960Saves.push({ download, text }));
  };
}

async function fileControls(before) {
  f.phase = 'open retained STEP from project B and reverse the exact file transition';
  const step = await readFile(new URL('../../../' + stepPath, import.meta.url));
  await openFile('Imported block.step', 'application/step', step);
  await f.waitToast(/STEP opened.*1 solid/s);
  await f.ready();
  const imported = await f.snapshot('01-step-open');
  assert.equal(imported.title, 'Imported block');
  assert.equal(imported.active, null);
  assert.equal(imported.dirty, true);
  assert.equal(imported.doc.nodes[0].step, step.toString());
  assert.equal(imported.bodies.bodies.length, 1);
  const expectedVolume = 40 * 30 * 10 - Math.PI * 4 ** 2 * 10;
  assert.ok(Math.abs(imported.bodies.bodies[0].volume - expectedVolume) < 1e-7);
  await f.undo();
  await check('02-step-undo', b, 128, 'B', 'B', false);
  await f.redo();
  await check('03-step-redo', imported.doc, expectedVolume, 'Imported block', null, true);
  await f.undo();
  await check('04-step-undone', b, 128, 'B', 'B', false);

  f.phase = 'New part detaches and same-name Save refuses before a write';
  await button('New part').click();
  await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.ready();
  await title().fill('B');
  await button('Save').click();
  await f.waitToast(/B\.bcad changed elsewhere.*already has B\.bcad/s);
  const collision = await f.snapshot('05-name-collision');
  assert.equal(collision.title, 'B');
  assert.equal(collision.dirty, true);
  assert.equal(collision.active, null);
  assert.equal(collision.doc.nodes.length, 0);
  assert.deepEqual(await Promise.all(['A', 'B'].map(readPart)), before);
  await f.undo();
  await check('06-new-part-undo', b, 128, 'B', null, false);
  await f.redo();
  await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.ready();
  const empty = await f.snapshot('07-new-part-redo');
  assert.deepEqual(empty.doc, collision.doc);
  assert.equal(empty.title, 'B');
  assert.equal(empty.active, null);
  assert.equal(empty.dirty, true);
  await title().fill('Unique blank');
  await save('Unique blank');
  assert.deepEqual(JSON.parse(await readPart('Unique blank')), empty.doc);
  assert.deepEqual(await Promise.all(['A', 'B'].map(readPart)), before);

  f.phase = 'external Open Undo restores the native Save filename and bytes';
  await panel().getByRole('button', { name: 'Close project', exact: true }).click();
  await openNative('Detached A', a);
  await openNative('Detached B', b);
  await f.undo();
  await check('08-detached-undo', a, 48, 'Detached A', null, false);
  await button('Save').click();
  await f.page.waitForFunction(() => window.__d960Saves.length === 1);
  const suggested = await f.page.evaluate(() => window.__d960Saves[0]);
  assert.equal(suggested.download, 'Detached A.bcad');
  assert.deepEqual(JSON.parse(suggested.text), a);
  await f.redo();
  await check('09-detached-redo', b, 128, 'Detached B', null, false);
  f.report.observations.push({ label: 'file-controls', stepSHA256: sha256(step), stepVolumeMM3: imported.bodies.bodies[0].volume,
    originalFilesSHA256: before.map(sha256), detachedSaveName: suggested.download, detachedSaveSHA256: sha256(suggested.text) });
  assert.deepEqual(f.report.downloads, []);
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    context.setDefaultTimeout(15000);
    context.setDefaultNavigationTimeout(60000);
    if (controls) await context.addInitScript(captureNativeSave);
    if (storage) await context.addInitScript(denyVersionLogWrite);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return url.origin === origin ? route.continue() : route.abort();
    });
    return context;
  };
  await f.newPage();
  f.phase = 'save two exact native documents to the browser project';
  await button('Project and versions').click();
  await panel().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(projectName);
  await panel().getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await panel().getByLabel('Project', { exact: true }).waitFor();
  await openNative('A', a);
  await save('A');
  if (version) { await versionFlow(await readPart('A')); return; }
  await openNative('B', b);
  await save('B');
  const before = await Promise.all(['A', 'B'].map(readPart));
  assert.deepEqual(before.map(JSON.parse), [a, b]);
  if (controls) { await fileControls(before); return; }

  f.phase = 'edit A and open the different B through Project documents';
  await projectOpen('A', a);
  await check('01-a', a, 48, 'A', 'A', false);
  await f.openFeatureEditor(1, 'Extrude');
  await f.editor().getByLabel('Distance', { exact: true }).fill('3');
  const { doc: edited } = await f.applyEditor(a, '02-a-edited');
  assert.equal(edited.nodes[1].height, 3);
  await dirty().waitFor();
  await projectOpen('B', b);
  await check('03-b', b, 128, 'B', 'B', false);
  f.phase = 'first Undo restores geometry, title and active Save path';
  await f.undo();
  await f.same(edited);

  if (baseline) {
    const wrong = await f.snapshot('04-wrong-save-target');
    assert.equal(wrong.title, 'B');
    assert.equal(wrong.active, 'B.bcad');
    await save('B');
    await f.page.waitForFunction(async projectName => {
      const root = await navigator.storage.getDirectory();
      const project = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(projectName);
      const file = await (await project.getFileHandle('B.bcad')).getFile();
      return JSON.parse(await file.text()).nodes[1].height === 3;
    }, projectName);
    const overwritten = await readPart('B');
    assert.deepEqual(JSON.parse(overwritten), edited);
    f.report.observations.push({ label: 'wrong-save-target', title: wrong.title, active: wrong.active,
      priorSHA256: sha256(before[1]), overwrittenSHA256: sha256(overwritten) });
    assert.equal(overwritten, before[1], 'Saving the restored A must preserve the actual B file bytes');
    return;
  }

  await check('04-a-undo', edited, 72, 'A', 'A', true);
  await f.redo();
  await check('05-b-redo', b, 128, 'B', 'B', false);
  await f.undo();
  await check('06-a-undo', edited, 72, 'A', 'A', true);
  f.phase = 'save restored A and compare actual A and B files';
  await save('A');
  const after = await Promise.all(['A', 'B'].map(readPart));
  assert.deepEqual(JSON.parse(after[0]), edited);
  assert.equal(after[1], before[1]);
  await check('07-a-saved', edited, 72, 'A', 'A', false);
  f.report.observations.push({ label: 'project-save-target', aVolumeMM3: 72, bVolumeMM3: 128,
    beforeSHA256: before.map(sha256), afterSHA256: after.map(sha256), bytes: after.map(value => Buffer.byteLength(value)) });
  assert.deepEqual(f.report.downloads, []);
});
