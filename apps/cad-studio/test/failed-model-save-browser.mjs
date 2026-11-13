import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
assert.ok(['--baseline', '--fixed'].includes(mode));
const nodes = [
  { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] },
  { id: 'n1', kind: 'extrude', sketch: 0, height: 20 },
  { id: 'n2', kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: ['n1.side0|n1.top'], radius: 4 },
  { id: 'n3', kind: 'fillet', parent: { node: 2, side: 'solid' }, edges: ['n1.side1|n2.face'], radius: 0.5 },
];
const model = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes, outputs: { b3: { node: 3, side: 'solid' } }, nextId: 4,
};
const invalid = { ...model, nodes: model.nodes.map((node, i) => i === 2 ? { ...node, suppressed: true } : node) };
const project = 'D993 failed Fillet ownership';
const part = 'dependency.bcad';
const startingBytes = JSON.stringify(invalid, null, 2) + '\n';
const files = [
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/files/useStudioDocumentFiles.ts',
  'apps/cad-studio/src/storage/useProject.ts',
  'apps/cad-studio/test/failed-model-save-browser.mjs',
];
const f = await createFlow({
  name: 'failed-model-save', output, envFrozen: 'D993_SOURCE_FROZEN', initialFiles: files, requiredFrozen: files,
  qualification: 'Protect the browser project file and version history from a failed dependent Fillet.',
  snapshotExtra: () => ({
    fresh: window.__studioFresh,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    rolled: [...document.querySelectorAll('.history .hs.rolled')].map(row => row.dataset.nodeIndex),
    fileName: document.querySelector('.doc-tab input')?.value,
  }),
});
const button = name => f.page.getByRole('button', { name, exact: true });
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const getBytes = () => f.page.evaluate(async ({ project, part }) => {
  const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
  const folder = await projects.getDirectoryHandle(project);
  return (await (await folder.getFileHandle(part)).getFile()).text();
}, { project, part });
const history = () => Promise.all(['Undo', 'Redo'].map(name => button(name).isEnabled()));
const makeVersion = async name => {
  await versions().getByRole('textbox', { name: 'Version name', exact: true }).fill(name);
  await versions().getByRole('button', { name: 'Make version', exact: true }).click();
};
const roll = async index => {
  await f.page.locator('.history .hs[data-node-index="' + index + '"]').click({ button: 'right' });
  await f.page.getByRole('menuitem', { name: 'Roll back to here', exact: true }).click();
  await f.ready();
};
const alert = name => f.page.getByRole('alert').filter({ hasText: name });

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
  f.phase = 'seed and open the browser project with a saved invalid Fillet chain';
  await f.page.evaluate(async ({ project, part, startingBytes }) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects', { create: true });
    const folder = await projects.getDirectoryHandle(project, { create: true });
    const stream = await (await folder.getFileHandle(part, { create: true })).createWritable();
    await stream.write(startingBytes);
    await stream.close();
  }, { project, part, startingBytes });
  await button('Project and versions').click();
  await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await versions().getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await versions().getByRole('button', { name: 'Open ' + part, exact: true }).click();
  await f.page.getByText('Base part · not up to date', { exact: true }).waitFor();
  await alert('The selected edge no longer exists').waitFor();
  const before = await f.snapshot('project-failed-fillets');
  assert.deepEqual(before.doc, invalid);
  assert.equal(before.fresh, false);
  assert.equal(await getBytes(), startingBytes);
  const beforeHistory = await history();

  f.phase = 'Save the failed current document';
  await button('Save').click();
  if (mode === '--baseline') {
    await f.page.waitForFunction(async ({ project, part, startingBytes }) => {
      const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
      const folder = await projects.getDirectoryHandle(project);
      return (await (await (await folder.getFileHandle(part)).getFile()).text()) !== startingBytes;
    }, { project, part, startingBytes });
    const overwritten = await getBytes();
    assert.deepEqual(JSON.parse(overwritten), invalid);
    f.report.observations.push({ initial: sha256(startingBytes), overwritten: sha256(overwritten) });
    await makeVersion('Invalid version');
    await versions().getByRole('button', { name: 'Restore Invalid version', exact: true }).waitFor();
    assert.fail('Save overwrote the project file and Make version retained the failed Fillet chain');
  }
  await alert('Could not save the model').waitFor();
  assert.match(await alert('Could not save the model').textContent(), /selected edge no longer exists.*n1\.side1\|n2\.face/i);
  assert.equal(await getBytes(), startingBytes);
  assert.deepEqual(await f.doc(), invalid);
  assert.deepEqual(await history(), beforeHistory);

  f.phase = 'make a named version from a valid rollback of the failed full history';
  await roll(2);
  const rollback = await f.snapshot('valid-prefix');
  assert.deepEqual(rollback.rolled, ['3']);
  assert.equal(rollback.fresh, true);
  await makeVersion('Invalid version');
  await alert('No version made').waitFor();
  assert.match(await alert('No version made').textContent(), /n1\.side1\|n2\.face/);
  assert.equal(await getBytes(), startingBytes);
  assert.equal(await versions().getByRole('button', { name: 'Restore Invalid version', exact: true }).count(), 0);
  assert.equal(await f.page.evaluate(async ({ project, part }) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const folder = await projects.getDirectoryHandle(project);
    try {
      const metadata = await folder.getDirectoryHandle('.barocss');
      const versions = await metadata.getDirectoryHandle('versions');
      await versions.getFileHandle(part + '.json');
      return true;
    } catch (error) {
      if (error.name === 'NotFoundError') return false;
      throw error;
    }
  }, { project, part }), false);
  await button('Save').click();
  await alert('Could not save the model').waitFor();
  assert.match(await alert('Could not save the model').textContent(), /n1\.side1\|n2\.face/);
  assert.equal(await getBytes(), startingBytes);
  const refused = await f.snapshot('failed-save-and-version-refused');
  for (const key of ['doc', 'bodies', 'selection', 'rolled', 'history', 'dirty', 'fileName', 'fresh']) {
    assert.deepEqual(refused[key], rollback[key], key);
  }

  f.phase = 'repair the dependent chain, save and make a valid named version';
  await f.page.locator('.history .hs[data-node-index="2"]').click({ button: 'right' });
  await f.page.getByRole('menuitem', { name: 'Unsuppress', exact: true }).click();
  await f.same(model);
  await button('Save').click();
  await f.page.waitForFunction(() => !document.querySelector('[aria-label="Unsaved changes"]'));
  assert.deepEqual(JSON.parse(await getBytes()), model);
  await makeVersion('Repaired Fillets');
  await versions().getByRole('button', { name: 'Restore Repaired Fillets', exact: true }).waitFor();
  assert.deepEqual(JSON.parse(await getBytes()), model);
  f.report.observations.push({ initial: sha256(startingBytes), repaired: sha256(await getBytes()) });
  await f.snapshot('repaired-save-and-version');
  const page = f.page;
  await page.reload();
  await page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  await button('Project and versions').click();
  await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await versions().getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await versions().getByRole('button', { name: 'Open ' + part, exact: true }).click();
  await f.same(model);
  await versions().getByRole('button', { name: 'Restore Repaired Fillets', exact: true }).waitFor();
  await f.snapshot('repaired-project-reopened');
  assert.deepEqual(f.report.downloads, []);
});
