import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
assert.ok(['--baseline', '--fixed', '--open-baseline', '--open-fixed', '--commands-baseline', '--commands-fixed'].includes(mode));
const openFlow = mode.startsWith('--open');
const commands = mode.startsWith('--commands');
const pins = [
  'apps/cad-studio/test/node-editor-draft-exit-browser.mjs',
  'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx',
  'apps/cad-studio/src/ui/useWorkspaceModeExit.tsx', 'apps/cad-studio/src/ui/FeatureHistoryBar.tsx',
  ...(openFlow ? ['apps/cad-studio/src/files/useStudioDocumentFiles.ts', 'apps/cad-studio/src/ui/Hud.tsx'] : []),
];
const f = await createFlow({
  name: 'node-editor-draft-exit', output, envFrozen: commands ? 'D965_SOURCE_FROZEN' : openFlow ? 'D964_SOURCE_FROZEN' : 'D963_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: commands ? 'Protect a Box draft at New part, templates and Model Undo and save only accepted geometry.' : openFlow ? 'Keep a Box draft after validating a native File Open.' : 'Keep unapplied feature inputs across canceled desktop mode and history navigation.',
  limits: ['One two-extrusion document with an unapplied Distance edit in the first feature.'],
  snapshotExtra: () => ({
    activeMode: document.querySelector('[data-workspace-mode] button.on')?.textContent,
    focused: document.activeElement?.getAttribute('aria-label'),
    value: document.querySelector('.node-editor input[aria-label="Distance"]')?.value ?? null,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
  }),
});
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [4, 6], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 2, id: 'n1' },
    { kind: 'sketch', profile: 'rectangle', min: [12, 0], max: [16, 8], id: 'n2' },
    { kind: 'extrude', sketch: 2, height: 5, id: 'n3' },
  ],
  outputs: { b1: { node: 1, side: 'solid' }, b3: { node: 3, side: 'solid' } }, nextId: 4,
};
const button = name => f.page.getByRole('button', { name, exact: true });
const tab = name => f.page.getByRole('group', { name: 'Mode', exact: true }).getByRole('button', { name, exact: true });
const distance = () => f.editor().getByLabel('Distance', { exact: true });
const prompt = () => f.page.getByRole('dialog', { name: 'Discard feature changes?', exact: true });
const historyStep = index => f.page.locator(`.history .hs[data-node-index="${index}"]`);
const waitFocus = locator => locator.evaluate(element => new Promise((resolve, reject) => {
  let frames = 0;
  const check = () => {
    if (document.activeElement === element) resolve();
    else if (++frames === 120) reject(new Error('The draft field did not regain focus'));
    else requestAnimationFrame(check);
  };
  check();
}));

async function openCandidate(name, doc) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
}

async function checkOpenDraft() {
  const hud = f.page.getByRole('dialog', { name: 'Box', exact: true });
  const width = hud.getByRole('spinbutton', { name: 'Width X', exact: true });
  const height = hud.getByRole('spinbutton', { name: 'Height Z', exact: true });
  const replacement = structuredClone(source);
  replacement.nodes[1].height = 7;
  await f.page.keyboard.press('b');
  await hud.waitFor();
  await width.fill('48');
  await height.fill('18');
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview');
  const before = await f.snapshot('01-box-draft');
  f.phase = 'open valid native file while a Box preview is active';
  if (mode === '--open-baseline') {
    await openCandidate('New geometry', replacement);
    await f.same(replacement);
    await hud.waitFor({ state: 'hidden' });
    await f.snapshot('02-open-lost-box');
    assert.fail('Open replaced the document and discarded the unapplied Box without confirmation');
  }
  for (const cancel of ['button', 'escape']) {
    await height.focus();
    await openCandidate('New geometry', replacement);
    await prompt().waitFor();
    const keep = prompt().getByRole('button', { name: 'Keep editing', exact: true });
    await waitFocus(keep);
    if (cancel === 'button') await keep.click();
    else await f.page.keyboard.press('Escape');
    await prompt().waitFor({ state: 'hidden' });
    await waitFocus(height);
    assert.deepEqual([await width.inputValue(), await height.inputValue()], ['48', '18']);
    assert.equal(await hud.locator('.status').textContent(), 'preview');
    const kept = await f.snapshot('02-kept-' + cancel);
    for (const field of ['doc', 'bodies', 'selection', 'history', 'dirty']) assert.deepEqual(kept[field], before[field], field);
  }
  f.phase = 'explicitly discard the Box and complete the previously checked Open';
  await openCandidate('New geometry', replacement);
  await prompt().getByRole('button', { name: 'Discard changes', exact: true }).click();
  await f.same(replacement);
  await hud.waitFor({ state: 'hidden' });
  assert.equal(await f.page.locator('.doc-tab input').inputValue(), 'New geometry');
  await f.snapshot('03-open-accepted');
  assert.deepEqual(f.report.downloads, []);
}

async function checkModelCommands() {
  const hud = f.page.getByRole('dialog', { name: 'Box', exact: true });
  const height = hud.getByRole('spinbutton', { name: 'Height Z', exact: true });
  const width = hud.getByRole('spinbutton', { name: 'Width X', exact: true });
  const box = async () => {
    await f.page.keyboard.press('b');
    await hud.waitFor();
    await width.fill('48');
    await height.fill('18');
    await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview');
  };
  await box();
  const before = await f.snapshot('01-box-before-commands');
  f.phase = 'request New part with a Box draft';
  if (mode === '--commands-baseline') {
    await button('New part').click();
    await hud.waitFor({ state: 'hidden' });
    await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
    await f.snapshot('02-new-part-lost-draft');
    assert.fail('New part discarded an unapplied Box without asking');
  }
  const keep = async (label, action) => {
    f.phase = 'keep Box during ' + label;
    await height.focus();
    await action();
    await prompt().waitFor();
    await prompt().getByRole('button', { name: 'Keep editing', exact: true }).click();
    await prompt().waitFor({ state: 'hidden' });
    await waitFocus(height);
    assert.deepEqual([await width.inputValue(), await height.inputValue()], ['48', '18']);
    assert.equal(await hud.locator('.status').textContent(), 'preview');
    const after = await f.snapshot('02-kept-' + label);
    for (const field of ['doc', 'bodies', 'history', 'selection', 'dirty']) assert.deepEqual(after[field], before[field], field);
  };
  await keep('new-part', () => button('New part').click());
  await keep('model-undo', () => button('Undo').click());
  const template = f.page.getByRole('menuitem', { name: 'New from Empty part', exact: true });
  const showTemplates = () => button('New from a template').click();
  await keep('template', async () => { await showTemplates(); await template.click(); });
  if (await template.isVisible()) await showTemplates();

  f.phase = 'Cmd+S keeps the draft and emits the accepted document';
  await height.focus();
  await f.page.keyboard.press('Meta+s');
  await f.page.waitForFunction(() => window.__d965Saves.length === 1);
  const saved = await f.page.evaluate(() => window.__d965Saves[0]);
  assert.equal(saved.name, 'Draft source.bcad');
  assert.deepEqual(JSON.parse(saved.text), source);
  await waitFocus(height);
  assert.deepEqual([await width.inputValue(), await height.inputValue()], ['48', '18']);
  assert.equal(await hud.locator('.status').textContent(), 'preview');

  f.phase = 'discard a Box explicitly and let the requested template replace the document';
  await showTemplates();
  await template.click();
  await prompt().getByRole('button', { name: 'Discard changes', exact: true }).click();
  await hud.waitFor({ state: 'hidden' });
  await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.ready();
  assert.equal(await f.page.locator('.doc-tab input').inputValue(), 'Untitled');
  await f.snapshot('03-template-accepted');
  assert.deepEqual(f.report.downloads, []);
}

function captureNativeSave() {
  const create = URL.createObjectURL;
  const click = HTMLAnchorElement.prototype.click;
  const blobs = new Map();
  window.__d965Saves = [];
  URL.createObjectURL = function (blob) {
    const url = create.call(this, blob);
    blobs.set(url, blob);
    return url;
  };
  HTMLAnchorElement.prototype.click = function () {
    const blob = blobs.get(this.href);
    if (!blob || !this.download.endsWith('.bcad')) return click.call(this);
    const name = this.download;
    void blob.text().then(text => window.__d965Saves.push({ name, text }));
  };
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    context.setDefaultTimeout(15000);
    context.setDefaultNavigationTimeout(60000);
    if (commands) await context.addInitScript(captureNativeSave);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return url.origin === origin ? route.continue() : route.abort();
    });
    return context;
  };
  await f.newPage();
  await openCandidate('Draft source', source);
  await f.same(source);
  if (openFlow) { await checkOpenDraft(); return; }
  if (commands) { await checkModelCommands(); return; }
  await f.openFeatureEditor(1);
  await distance().fill('4');
  const before = await f.snapshot('01-dirty-node-editor');
  assert.equal(before.value, '4');

  if (mode === '--baseline') {
    f.phase = 'Render drops the unapplied Distance';
    await tab('Render').click();
    await f.editor().waitFor({ state: 'hidden' });
    await tab('Model').click();
    await distance().waitFor();
    const returned = await f.snapshot('02-render-dropped-draft');
    assert.deepEqual(returned.doc, source);
    assert.equal(returned.value, '4', 'returning from Render must preserve the unapplied Distance');
    return;
  }

  const assertDraft = async (label, value) => {
    await waitFocus(distance());
    const kept = await f.snapshot(label);
    assert.equal(kept.activeMode, 'Model');
    assert.equal(kept.value, value);
    for (const field of ['doc', 'selection', 'history', 'dirty']) assert.deepEqual(kept[field], before[field], field);
  };
  for (const [label, trigger] of [['render', tab('Render')], ['sketch', tab('Sketch')], ['feature', historyStep(3)]]) {
    f.phase = 'keep the Distance draft on ' + label;
    await distance().focus();
    await trigger.click();
    await prompt().waitFor();
    await waitFocus(prompt().getByRole('button', { name: 'Keep editing', exact: true }));
    await prompt().getByRole('button', { name: 'Keep editing', exact: true }).click();
    await prompt().waitFor({ state: 'hidden' });
    await assertDraft('02-keep-' + label, '4');
  }

  f.phase = 'keep an incomplete numeric edit on Escape';
  await distance().fill('');
  await tab('Render').click();
  await prompt().waitFor();
  await f.page.keyboard.press('Escape');
  await prompt().waitFor({ state: 'hidden' });
  await assertDraft('03-keep-blank', '');

  f.phase = 'discard only the unapplied feature draft and switch to the requested feature';
  await distance().fill('4');
  await historyStep(3).click();
  await prompt().getByRole('button', { name: 'Discard changes', exact: true }).click();
  await prompt().waitFor({ state: 'hidden' });
  await f.page.waitForFunction(() => document.querySelector('.node-editor input[aria-label="Distance"]')?.value === '5');
  await f.same(source);
  await f.snapshot('04-other-feature');
  await historyStep(1).click();
  await f.page.waitForFunction(() => document.querySelector('.node-editor input[aria-label="Distance"]')?.value === '2');
  await f.snapshot('05-original-value');
  assert.deepEqual(f.report.downloads, []);
});
