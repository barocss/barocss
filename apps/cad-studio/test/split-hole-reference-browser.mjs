import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/split-hole-reference-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/files/documentFile.ts',
  'apps/cad-studio/src/storage/useProject.ts',
  'packages/barocss-cad-model/src/engine/references.ts',
  'packages/barocss-cad/src/part/part-model.ts',
];
const f = await createFlow({
  name: 'split-hole-reference', output: process.argv[2], envFrozen: 'D1002_SOURCE_FROZEN',
  qualification: 'Retain a named Split cap for a blind Hole, and preserve the current document when that cap is missing on Open.',
  limits: ['A single blind X-axis bore on an ordinary rectangular Split solid.'],
  initialFiles: pins, requiredFrozen: pins,
  snapshotExtra: () => ({
    title: document.querySelector('.doc-tab input')?.value,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    fresh: window.__studioFresh,
  }),
});
const ref = (node, side = 'solid') => ({ node, side });
const cap = 'n2.cut.side1';
const model = at => ({
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 30] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 10 },
    { id: 'n2', kind: 'split', parent: ref(1), axis: 'x', normal: [Math.sign(at), 0, 0], at },
    { id: 'n3', kind: 'hole', parent: ref(2, 'negative'), center: [15, 5], radius: 2, axis: 'x', depth: 4, face: cap },
  ],
  outputs: { b2_positive: ref(2, 'positive'), b3: ref(3) }, nextId: 4,
});
const button = (name, parent = f.page) => parent.getByRole('button', { name, exact: true });
const field = name => f.editor().getByRole('spinbutton', { name, exact: true });
const history = () => Promise.all(['Undo', 'Redo'].map(name => button(name).isEnabled()));
async function chooseFile(name, doc) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
}

function mass(state, at) {
  const stock = 300 * at;
  const cut = 4 * Math.PI * 2 ** 2;
  const volume = stock - cut;
  const centroid = [(stock * at / 2 - cut * (at - 2)) / volume, 15, 5];
  assert.equal(state.bodies.bodies.length, 2);
  const bore = state.bodies.bodies.find(body => body.key === 'b3');
  const stockBody = state.bodies.bodies.find(body => body.key === 'b2_positive');
  assert.ok(Math.abs(bore.volume - volume) < 1e-7, JSON.stringify(bore));
  assert.ok(Math.hypot(...bore.centroid.map((n, i) => n - centroid[i])) < 1e-8, JSON.stringify(bore));
  assert.ok(Math.abs(stockBody.volume - (60 - at) * 300) < 1e-7, JSON.stringify(stockBody));
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
  const start = model(24), edited = model(30);
  await chooseFile('split-hole', start);
  await f.same(start);
  mass(await f.snapshot('hole-x24'), 24);

  await f.openFeatureEditor(2, 'Split');
  await field('At').fill('30');
  const applied = await f.applyEditor(start, 'hole-x30');
  assert.deepEqual(applied.doc, edited);
  mass(applied, 30);
  await f.undo();
  await f.same(start);
  await f.redo();
  await f.same(edited);

  await f.openFeatureEditor(2, 'Split reversal');
  const beforeEdit = await f.snapshot('before-live-refusal');
  const historyBefore = await history();
  await field('Normal X').fill('-1');
  await field('At').fill('-30');
  await button('Apply', f.editor()).click();
  const error = f.editor().locator('.hud-error');
  await error.waitFor();
  assert.ok((await error.textContent()).includes(cap));
  const refused = await f.snapshot('live-refusal');
  for (const key of ['doc', 'bodies', 'selection', 'history', 'title', 'dirty']) assert.deepEqual(refused[key], beforeEdit[key], key);
  assert.deepEqual(await history(), historyBefore);
  await f.closeEditor();

  f.phase = 'Open a file whose blind Hole lost its original Split cap';
  const accepted = await f.snapshot('before-missing-face-open');
  const acceptedHistory = await history();
  await chooseFile('split-hole-missing-cap', model(-30));
  const notice = f.page.getByRole('alert').filter({ hasText: cap });
  await notice.waitFor();
  const after = await f.snapshot('missing-face-open-result');
  assert.match(await notice.textContent(), /Could not open this file/);
  for (const key of ['doc', 'bodies', 'selection', 'history', 'title', 'dirty', 'fresh']) assert.deepEqual(after[key], accepted[key], key);
  assert.deepEqual(await history(), acceptedHistory);
  mass(after, 30);
  await f.undo();
  await f.same(start);
  await f.redo();
  await f.same(edited);
  await chooseFile('split-hole-corrected', edited);
  await f.page.waitForFunction(() => document.querySelector('.doc-tab input')?.value === 'split-hole-corrected');
  await f.same(edited);
  mass(await f.snapshot('corrected-open'), 30);
  await f.dismissToasts();
  f.phase = 'refuse the missing cap from browser project storage';
  const project = 'D1002 split hole';
  const damaged = 'project-hole-missing-cap.bcad';
  const valid = 'project-hole-valid.bcad';
  await f.page.evaluate(async ({ project, files }) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects', { create: true });
    const folder = await projects.getDirectoryHandle(project, { create: true });
    for (const [name, doc] of Object.entries(files)) {
      const writer = await (await folder.getFileHandle(name, { create: true })).createWritable();
      await writer.write(JSON.stringify(doc));
      await writer.close();
    }
  }, { project, files: { [damaged]: model(-30), [valid]: start } });
  await button('Project and versions').click();
  const versions = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await versions.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button('Project in this browser', versions).click();
  await versions.getByLabel('Project', { exact: true }).waitFor();
  const beforeProject = await f.snapshot('before-project-refusal');
  const projectHistory = await history();
  await button('Open ' + damaged, versions).click();
  await f.waitToast(/Could not open project-hole-missing-cap.*n2\.cut\.side1.*missing/s);
  const afterProject = await f.snapshot('project-refusal');
  for (const key of ['doc', 'bodies', 'selection', 'history', 'title', 'dirty', 'fresh']) assert.deepEqual(afterProject[key], beforeProject[key], key);
  assert.deepEqual(await history(), projectHistory);
  assert.equal(await versions.locator('li[data-active="true"]').count(), 0);
  await button('Open ' + valid, versions).click();
  await f.same(start);
  await versions.locator('li[data-active="true"]').filter({ hasText: valid }).waitFor();
  mass(await f.snapshot('valid-project-open'), 24);
  assert.deepEqual(f.report.downloads, []);
});
