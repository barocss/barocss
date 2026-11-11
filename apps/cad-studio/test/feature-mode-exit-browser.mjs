import assert from 'node:assert/strict';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(mode === '--baseline' || mode === '--fixed');
const pins = [
  'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/Hud.tsx', 'apps/cad-studio/test/feature-mode-exit-browser.mjs',
  'apps/cad-studio/src/state/useCommandPreview.ts', 'apps/cad-studio/src/state/previewLifetime.ts',
  mode === '--fixed' ? 'apps/cad-studio/src/ui/useWorkspaceModeExit.tsx' : 'apps/cad-studio/src/sketch/useSketchModeExit.tsx',
];
const f = await createFlow({
  name: 'feature-mode-exit', envFrozen: 'D686_SOURCE_FROZEN', output,
  initialFiles: pins, requiredFrozen: pins, qualification: `D686 feature draft across workspace requests ${mode}`,
});
const button = name => f.page.getByRole('button', { name, exact: true });
const tab = name => f.page.getByRole('group', { name: 'Mode', exact: true }).getByRole('button', { name, exact: true });
const hud = () => f.page.getByRole('dialog', { name: 'Box', exact: true });
const field = name => hud().getByRole('spinbutton', { name, exact: true });
const prompt = () => f.page.getByRole('dialog', { name: 'Discard feature changes?', exact: true });
const keep = () => prompt().getByRole('button', { name: 'Keep editing', exact: true });
const discard = () => prompt().getByRole('button', { name: 'Discard changes', exact: true });
const history = () => f.page.locator('.history .hs').evaluateAll(steps => steps.map(step => step.getAttribute('aria-label')));
const waitFocus = locator => locator.evaluate(element => new Promise((done, fail) => {
  let attempts = 0;
  const check = () => {
    if (document.activeElement === element) done();
    else if (++attempts >= 120) fail(new Error('Expected control did not regain focus'));
    else requestAnimationFrame(check);
  };
  check();
}));

async function openBox() {
  await f.page.keyboard.press('b');
  await hud().waitFor();
  await waitFocus(field('Width X'));
}

async function checkMode(name) {
  await f.page.waitForFunction(name => [...document.querySelectorAll('[data-workspace-mode] button.on')]
    .some(button => button.textContent === name), name);
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    try {
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
        return url.origin === origin ? route.continue() : route.abort();
      });
      return context;
    } catch (error) {
      await context.close();
      throw error;
    }
  };
  await f.newPage();
  await f.page.setViewportSize({ width: 1440, height: 900 });
  f.phase = 'Create a draft Box in a new part';
  await button('New part').click();
  await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.ready();
  const original = await f.doc();
  const originalHistory = await history();
  await openBox();
  const width = field('Width X');
  const height = field('Height Z');
  assert.equal(await width.inputValue(), '32');
  await width.fill('48');
  assert.equal(await width.inputValue(), '48');
  await f.same(original);
  await f.snapshot('01-box-draft-width-48');

  if (mode === '--baseline') {
    f.phase = 'Original Drawing switch drops the Box draft';
    await tab('Drawing').click();
    await checkMode('Drawing');
    await hud().waitFor({ state: 'hidden' });
    assert.equal(await prompt().count(), 0);
    await tab('Model').click();
    await checkMode('Model');
    await openBox();
    assert.equal(await width.inputValue(), '32');
    await f.same(original);
    assert.deepEqual(await history(), originalHistory);
    f.report.observations.push({ before: 48, after: 32, draftLost: true, prompt: false });
    await f.snapshot('02-baseline-restarted-width-32');
  } else {
    f.phase = 'Keep Box changes on Drawing and restore the width input';
    await width.focus();
    await tab('Drawing').click();
    await prompt().waitFor();
    await waitFocus(keep());
    await f.snapshot('02-drawing-confirmation');
    await f.page.keyboard.press('Escape');
    await prompt().waitFor({ state: 'hidden' });
    await waitFocus(width);
    assert.equal(await width.inputValue(), '48');
    await checkMode('Model');
    await f.same(original);

    f.phase = 'Keep Box changes from Sketch and Render and preserve both values';
    await height.fill('18');
    for (const name of ['Sketch', 'Render']) {
      await height.focus();
      await tab(name).click();
      await prompt().waitFor();
      await waitFocus(keep());
      await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview');
      assert.equal(await prompt().count(), 1);
      await keep().click();
      await prompt().waitFor({ state: 'hidden' });
      await waitFocus(height);
      await checkMode('Model');
      assert.deepEqual([await width.inputValue(), await height.inputValue()], ['48', '18']);
      await f.same(original);
    }
    await tab('Model').click();
    assert.equal(await prompt().count(), 0);
    assert.deepEqual(await history(), originalHistory);

    f.phase = 'Apply the kept Box once and replay the feature history';
    await hud().getByRole('button', { name: 'Apply', exact: true }).click();
    await f.changed(original);
    const accepted = await f.doc();
    const { bodies } = await f.bodies();
    assert.equal(bodies.length, 1);
    assert.ok(Math.abs(bodies[0].volume - 48 * 32 * 18) < 1e-7);
    assert.deepEqual(bodies[0].centroid, [24, 16, 9]);
    assert.equal((await history()).length, originalHistory.length + 1);
    await f.snapshot('03-applied-kept-box');
    await button('Undo').click();
    await f.same(original);
    await button('Redo').click();
    await f.same(accepted);

    f.phase = 'Discard a second draft with a keyboard workspace request';
    await openBox();
    await width.fill('60');
    await tab('Drawing').focus();
    await tab('Drawing').press('Enter');
    await prompt().waitFor();
    await waitFocus(keep());
    await discard().focus();
    await f.page.keyboard.press('Enter');
    await prompt().waitFor({ state: 'hidden' });
    await waitFocus(tab('Drawing'));
    await checkMode('Drawing');
    await hud().waitFor({ state: 'hidden' });
    await f.same(accepted);
    await f.snapshot('04-explicit-discard');
    await tab('Model').click();
    await openBox();
    assert.equal(await width.inputValue(), '32');
    await hud().getByRole('button', { name: 'Cancel', exact: true }).click();
    await hud().waitFor({ state: 'hidden' });
    await f.same(accepted);
    assert.equal((await history()).length, originalHistory.length + 1);
    f.report.observations.push({ kept: ['Drawing', 'Sketch', 'Render'], width: 48, height: 18,
      volume: bodies[0].volume, focusRestored: true, exactUndoRedo: true, discardedWidth: 60 });

    f.phase = 'Keep or discard both drafts when a feature starts during Sketch';
    await tab('Sketch').click();
    await f.sketchPanel().getByLabel('Sketch plane', { exact: true }).selectOption('xy');
    await f.frame([[60, 0], [80, 12]]);
    await f.worldClick([60, 0]);
    await f.worldClick([80, 12]);
    const sketchWidth = f.sketchPanel().locator('#sk-width');
    assert.equal(Number(await sketchWidth.inputValue()), 20);
    await f.page.keyboard.press('Space');
    const palette = f.page.getByRole('dialog', { name: 'Command palette', exact: true });
    await palette.getByRole('combobox').fill('box');
    await palette.getByText('Box', { exact: true }).click();
    await hud().waitFor();
    await width.fill('55');
    const combined = f.page.getByRole('dialog', { name: 'Discard sketch and feature changes?', exact: true });
    await tab('Drawing').click();
    await combined.getByRole('button', { name: 'Keep editing', exact: true }).click();
    await combined.waitFor({ state: 'hidden' });
    await waitFocus(width);
    assert.equal(await width.inputValue(), '55');
    assert.equal(Number(await sketchWidth.inputValue()), 20);
    await tab('Drawing').click();
    await combined.waitFor();
    await f.snapshot('05-two-drafts-confirmation');
    await combined.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await checkMode('Drawing');
    await hud().waitFor({ state: 'hidden' });
    await f.sketchPanel().waitFor({ state: 'hidden' });
    await f.same(accepted);
    f.report.observations.push({ combinedDrafts: { sketchWidth: 20, featureWidth: 55, bothKeptThenDiscarded: true } });
  }
  assert.deepEqual(f.report.downloads, []);
  f.phase = 'complete';
});
