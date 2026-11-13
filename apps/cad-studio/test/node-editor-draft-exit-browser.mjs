import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
assert.ok(['--baseline', '--fixed'].includes(mode));
const pins = [
  'apps/cad-studio/test/node-editor-draft-exit-browser.mjs',
  'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx',
  'apps/cad-studio/src/ui/useWorkspaceModeExit.tsx', 'apps/cad-studio/src/ui/FeatureHistoryBar.tsx',
];
const f = await createFlow({
  name: 'node-editor-draft-exit', output, envFrozen: 'D963_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: 'Keep unapplied feature inputs across canceled desktop mode and history navigation.',
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

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
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
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'Draft source.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);
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
