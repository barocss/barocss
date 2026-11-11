import assert from 'node:assert/strict';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2), repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(mode === '--baseline' || mode === '--fixed');
const fixed = mode === '--fixed';
const pins = ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/ViewDisplayControls.tsx',
  'apps/cad-studio/src/ui/RenderPanel.tsx', 'apps/cad-studio/src/viewport/Viewport.tsx', 'apps/cad-studio/src/viewport/gpuRenderer.ts'];
const f = await createFlow({ name: 'view-toggle-state', envFrozen: 'D672_SOURCE_FROZEN', output, initialFiles: pins,
  requiredFrozen: pins, qualification: 'Actual Model and Render projection and ambient occlusion toggle state' });
const view = () => f.page.getByRole('group', { name: 'Views', exact: true });
const ortho = () => view().getByRole('button', { name: 'Ortho', exact: true });
const ao = () => view().getByRole('button', { name: 'AO', exact: true });
const palette = () => f.page.getByRole('dialog', { name: 'Command palette', exact: true });
const workspaces = () => f.page.locator('[data-workspace-mode]');
const history = () => f.page.locator('.history .hs').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')));
const viewportState = () => f.page.evaluate(() => ({
  projection: window.__studioViewer.camera.projection,
  ao: !!window.__studioViewer.environment.ambientOcclusion,
  status: document.querySelector('.corner-left .mono').textContent.split(' · ')[0],
}));
const buttonState = button => button.evaluate(el => ({ pressed: el.getAttribute('aria-pressed'), on: el.classList.contains('on'), disabled: el.disabled }));

async function waitViewport(projection, enabled) {
  await f.page.waitForFunction(([projection, enabled]) => {
    const viewer = window.__studioViewer;
    return viewer.camera.projection === projection && Boolean(viewer.environment.ambientOcclusion) === enabled;
  }, [projection, enabled]);
}
async function activate(button, key) {
  await button.focus();
  await f.page.keyboard.press(key);
  assert.equal(await button.evaluate(el => document.activeElement === el), true);
  assert.equal(await palette().count(), 0);
}
async function modelState(projection, enabled, lineOnly = false) {
  await waitViewport(projection, enabled);
  const state = await viewportState();
  const orthographic = projection === 'orthographic';
  assert.deepEqual(await buttonState(ortho()), { pressed: String(orthographic), on: orthographic, disabled: false });
  assert.deepEqual(await buttonState(ao()), { pressed: String(enabled), on: enabled, disabled: lineOnly });
  assert.equal(state.status, orthographic ? 'Orthographic' : 'Perspective');
  return state;
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

  const cases = fixed ? [[1280, 720, false], [1024, 768, true]] : [[1280, 720, false]];
  for (const [width, height, chatOpen] of cases) {
    const size = width + 'x' + height;
    await f.newPage();
    await f.page.setViewportSize({ width, height });
    f.phase = 'create a Box and measure default projection and AO at ' + size;
    await f.page.getByRole('button', { name: 'New part', exact: true }).click();
    await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
    await f.ready();
    await f.page.keyboard.press('b');
    const hud = f.page.getByRole('dialog', { name: 'Box', exact: true });
    const empty = await f.doc();
    await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview');
    await hud.getByRole('button', { name: 'Apply', exact: true }).click();
    await f.changed(empty);
    const doc = await f.doc(), steps = await history();
    if (chatOpen) {
      await f.page.locator('.topbar').getByRole('button', { name: 'Chat', exact: true }).click();
      await f.page.locator('.chat-col.open').waitFor();
    }
    await waitViewport('perspective', true);
    if (!fixed) {
      f.phase = 'original Ortho and AO Space keys open the command palette';
      for (const toggle of [ortho(), ao()]) {
        assert.equal((await buttonState(toggle)).pressed, null);
        await toggle.focus();
        await f.page.keyboard.press('Space');
        await palette().waitFor();
        assert.deepEqual(await viewportState(), { projection: 'perspective', ao: true, status: 'Perspective' });
        await f.page.keyboard.press('Escape');
        await palette().waitFor({ state: 'hidden' });
      }
      f.report.observations.push({ size, missingPressedState: true, spaceOpenedPalette: true });
    } else {
      f.phase = 'native keyboard toggles update Model camera and AO at ' + size;
      await modelState('perspective', true);
      await view().getByRole('button', { name: 'Section view', exact: true }).focus();
      await f.page.keyboard.press('Tab');
      assert.equal(await ortho().evaluate(el => document.activeElement === el), true);
      await activate(ortho(), 'Space');
      await modelState('orthographic', true);
      await f.page.keyboard.press('Tab');
      assert.equal(await ao().evaluate(el => document.activeElement === el), true);
      await activate(ao(), 'Space');
      await modelState('orthographic', false);
      await f.snapshot(size + '-ortho-on-ao-off');
      await activate(ortho(), 'Enter');
      await modelState('perspective', false);
      await activate(ao(), 'Enter');
      await modelState('perspective', true);
      f.report.observations.push({ size, chatOpen, spaceAndEnter: true, tabOrder: true, projectionAndAoMatched: true });
    }

    f.phase = 'line-only mode suppresses AO and shaded mode restores it at ' + size;
    const display = view().getByRole('button', { name: 'Display and previews', exact: true });
    await display.click();
    const modeSelect = f.page.getByRole('combobox', { name: 'CAD display mode', exact: true });
    await modeSelect.selectOption('wireframe');
    await waitViewport('perspective', false);
    if (fixed) await modelState('perspective', false, true);
    else assert.deepEqual(await buttonState(ao()), { pressed: null, on: true, disabled: false });
    await modeSelect.selectOption('shaded-with-edges');
    if (fixed) await modelState('perspective', true);
    await display.click();
    await f.same(doc);
    assert.deepEqual(await history(), steps);
    if (width !== 1280) continue;

    f.phase = 'Render has its own AO setting and saves a view';
    await workspaces().getByRole('button', { name: 'Render', exact: true }).click();
    const render = f.page.getByRole('complementary', { name: 'Render', exact: true });
    await render.getByRole('tab', { name: 'Scene', exact: true }).click();
    const renderAO = render.getByRole('checkbox', { name: 'Occlusion', exact: true });
    if (fixed) {
      await renderAO.check();
      await waitViewport('perspective', true);
    }
    await renderAO.uncheck();
    await waitViewport('perspective', false);
    if (fixed) assert.equal(await ao().count(), 0);
    else {
      assert.equal(await ao().isVisible(), true);
      await ao().click();
      await waitViewport('perspective', false);
      assert.equal(await renderAO.isChecked(), false);
      await ao().click();
    }
    await activate(ortho(), fixed ? 'Space' : 'Enter');
    await waitViewport('orthographic', false);
    await render.getByRole('button', { name: 'Save this view', exact: true }).click();
    await f.page.waitForFunction(() => window.__studioDoc.render?.camera?.ortho === true);
    const saved = await f.doc();
    await activate(ortho(), 'Enter');
    await waitViewport('perspective', false);
    f.phase = 'restore the saved orthographic camera';
    await render.getByRole('button', { name: 'Go to saved view', exact: true }).click();
    await waitViewport('orthographic', false);
    const restored = await viewportState();
    const restoredButton = await buttonState(ortho());
    if (fixed) {
      assert.equal(restored.status, 'Orthographic');
      assert.equal(restoredButton.pressed, 'true');
      assert.equal(restoredButton.on, true);
    } else {
      assert.equal(restored.status, 'Perspective');
      assert.equal(restoredButton.on, false);
    }
    await f.snapshot(size + '-restored-render-camera');
    await workspaces().getByRole('button', { name: 'Model', exact: true }).click();
    if (fixed) await modelState('orthographic', true);
    await f.same(saved);
    f.report.observations.push({ size, restored, restoredButton, renderAoSeparate: true, savedDocumentExact: true });
    if (fixed) {
      f.phase = 'restore the Model projection after leaving Print preview';
      await f.page.getByLabel('Preview: Print', { exact: true }).click();
      await f.page.waitForFunction(() => !!window.__studioPrint?.().display);
      await activate(ortho(), 'Enter');
      await modelState('perspective', true);
      await f.page.getByLabel('Preview: None', { exact: true }).click();
      await f.page.waitForFunction(() => !window.__studioPrint?.().display);
      await modelState('orthographic', true);
      await f.same(saved);
      f.report.observations.push({ size, printPreviewRestoredProjection: true, savedDocumentExact: true });
    }
  }
  assert.deepEqual(f.report.downloads, []);
});
