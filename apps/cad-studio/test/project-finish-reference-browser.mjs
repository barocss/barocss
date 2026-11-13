import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const fileMode = process.argv[3] === '--file';
const pins = [
  'apps/cad-studio/test/project-finish-reference-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/storage/useProject.ts',
  'apps/cad-studio/src/files/documentFile.ts',
  'apps/cad-studio/src/files/useStudioDocumentFiles.ts',
  'packages/barocss-cad-model/src/engine/references.ts',
];
const f = await createFlow({
  name: 'project-finish-reference', output: process.argv[2], envFrozen: fileMode ? 'D1006_SOURCE_FROZEN' : 'D1005_SOURCE_FROZEN',
  qualification: (fileMode ? 'File' : 'Project') + ' Open admits a valid held finish repair and refuses an unusable one.',
  limits: ['Individual signed constant-radius single-edge Fillet in a browser project.'],
  initialFiles: pins, requiredFrozen: pins,
  snapshotExtra: () => ({
    title: document.querySelector('.doc-tab input')?.value,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    active: document.querySelector('li[data-active="true"]')?.textContent,
    fresh: window.__studioFresh,
  }),
});
const edge = 'n1.side1|n1.side2';
const replacement = 'n1.side2|n1.side3';
const ref = node => ({ node, side: 'solid' });
const nodes = [
  { id: 'n0', kind: 'sketch', profile: 'polygon', points: [[0, 0], [5, -2], [10, 0], [10, 9.5], [0, 9.5]] },
  { id: 'n1', kind: 'extrude', sketch: 0, height: 6 },
  { id: 'n2', kind: 'fillet', parent: ref(1), edges: [edge], radius: 2,
    sigs: { [edge]: { k: 'line', p: [10, 10, 3], d: [0, 0, 1], s: 6 } } },
];
const doc = (nodes, output) => ({
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes, outputs: { ['b' + output]: ref(output) }, nextId: nodes.length,
});
const stock = doc(nodes.slice(0, 2), 1);
const lost = doc(nodes, 2);
const unusable = doc([...nodes, { id: 'n3', kind: 'chamfer', parent: ref(2), edges: ['n2.face|n1.top'], distance: 1 }], 3);
const button = (name, parent = f.page) => parent.getByRole('button', { name, exact: true });
const panel = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const refs = () => f.page.getByRole('region', { name: 'References', exact: true });
const volume = (state, expected) => {
  assert.equal(state.bodies.bodies.length, 1);
  assert.ok(Math.abs(state.bodies.bodies[0].volume - expected) < 1e-7, JSON.stringify(state.bodies));
};
const project = 'D1005 project finish';
const projectOpen = name => button('Open ' + name + '.bcad', panel()).click();
async function fileOpen(name, doc) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
}
async function connectProject() {
  await button('Project and versions').click();
  await panel().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button('Project in this browser', panel()).click();
  await panel().getByLabel('Project', { exact: true }).waitFor();
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return url.origin === origin ? route.continue() : route.abort();
    });
    return context;
  };
  await f.newPage();
  await f.page.evaluate(async ({ project, files }) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects', { create: true });
    const folder = await projects.getDirectoryHandle(project, { create: true });
    for (const [name, doc] of Object.entries(files)) {
      const writer = await (await folder.getFileHandle(name + '.bcad', { create: true })).createWritable();
      await writer.write(JSON.stringify(doc));
      await writer.close();
    }
  }, { project, files: { stock, lost, unusable } });
  await connectProject();
  await projectOpen('stock');
  await f.same(stock);
  volume(await f.snapshot('accepted-project-stock'), 630);

  f.phase = 'open a changed Fillet edge directly from the project';
  if (fileMode) await fileOpen('lost', lost); else await projectOpen('lost');
  await f.page.waitForFunction(() => document.querySelector('.doc-tab input')?.value === 'lost');
  await f.page.getByRole('region', { name: 'References', exact: true }).or(f.page.getByText('Base part · not up to date', { exact: true })).waitFor();
  if (await refs().count()) await f.ready();
  const held = await f.snapshot('project-damaged-file-open');
  assert.ok(held.fresh);
  assert.equal(held.dirty, true);
  assert.equal(held.doc.nodes[2].suppressed, true);
  assert.deepEqual(held.doc.nodes[2].edges, [edge]);
  if (fileMode) assert.equal(held.active, undefined); else assert.match(held.active, /lost\.bcad/);
  volume(held, 630);
  await refs().locator('summary').click();
  assert.match(await refs().locator('details').textContent(), new RegExp('Candidate 1: ' + replacement.replaceAll('|', '\\|')));
  await button('Use candidate 1', refs()).click();
  await refs().waitFor({ state: 'hidden' });
  await f.ready();
  const confirmed = await f.snapshot('project-confirmed');
  assert.deepEqual(confirmed.doc.nodes[2].edges, [replacement]);
  assert.deepEqual(confirmed.doc.nodes[2].sigs[replacement].p, [10, 9.5, 3]);
  volume(confirmed, 630 - 6 * (4 - Math.PI));
  await f.undo();
  await f.same(held.doc);
  await refs().getByRole('button', { name: 'Use candidate 1', exact: true }).waitFor();
  await f.redo();
  await f.same(confirmed.doc);

  f.phase = 'refuse an unusable repair before replacing the active document';
  const before = await f.snapshot('before-unusable-project-open');
  if (fileMode) {
    await fileOpen('unusable', unusable);
    const notice = f.page.getByRole('alert').filter({ hasText: /Could not open this file|The selected edge no longer exists|The kernel could not build this/ });
    await notice.waitFor();
    const failed = await f.snapshot('file-open-result');
    assert.match(await notice.textContent(), /Could not open this file.*unchanged/s);
    assert.equal(failed.title, before.title);
  } else {
    await projectOpen('unusable');
    await f.waitToast(/Could not open unusable.*unchanged/s);
  }
  const refused = await f.snapshot('unusable-project-refused');
  for (const key of ['doc', 'bodies', 'selection', 'history', 'title', 'dirty', 'active', 'fresh']) assert.deepEqual(refused[key], before[key], key);
  await f.undo();
  await f.same(held.doc);
  await f.redo();
  await f.same(confirmed.doc);

  f.phase = 'save confirmed project document and reopen after reload';
  const savedName = fileMode ? 'file-confirmed' : 'lost';
  if (fileMode) await f.page.locator('.doc-tab input').fill(savedName);
  await button('Save').click();
  await panel().locator('li[data-active="true"]').filter({ hasText: savedName + '.bcad' }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const saved = await f.page.evaluate(async ({ project, savedName }) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const folder = await projects.getDirectoryHandle(project);
    return (await (await folder.getFileHandle(savedName + '.bcad')).getFile()).text();
  }, { project, savedName });
  assert.deepEqual(JSON.parse(saved), confirmed.doc);
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  await connectProject();
  await projectOpen(savedName);
  await f.same(confirmed.doc);
  assert.equal(await refs().count(), 0);
  volume(await f.snapshot('confirmed-project-reopened'), 630 - 6 * (4 - Math.PI));
  assert.deepEqual(f.report.downloads, []);
});
