import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
assert.ok(['--baseline', '--fixed'].includes(mode));
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/project-open-save-history-browser.mjs', 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/storage/useProject.ts', 'apps/cad-studio/src/state/workOwnership.ts',
  'apps/cad-studio/src/storage/project.ts', 'apps/cad-studio/src/storage/VersionsPanel.tsx',
];
const f = await createFlow({
  name: 'project-open-save-history', output, envFrozen: 'D958_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: 'Restore the project Save destination with the exact document through Undo and Redo.',
  limits: ['Two rectangular native parts in one browser project. Version refusal is a separate case.'],
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
async function openNative(name, doc) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
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
await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    context.setDefaultTimeout(15000);
    context.setDefaultNavigationTimeout(60000);
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
  await openNative('B', b);
  await save('B');
  const before = await Promise.all(['A', 'B'].map(readPart));
  assert.deepEqual(before.map(JSON.parse), [a, b]);

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
