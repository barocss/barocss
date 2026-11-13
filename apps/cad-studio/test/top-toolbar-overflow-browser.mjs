import assert from 'node:assert/strict';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
const resizeFocus = mode.startsWith('--resize-focus-');
const tooltipEscape = mode.startsWith('--tooltip-escape-');
assert.ok(['--baseline', '--fixed', '--resize-focus-baseline', '--resize-focus-fixed', '--tooltip-escape-baseline', '--tooltip-escape-fixed'].includes(mode));
const pins = [
  'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/ToolsTray.tsx', 'apps/cad-studio/src/styles.css',
  'apps/cad-studio/src/components/ui/tool-button.tsx', 'apps/cad-studio/test/top-toolbar-overflow-browser.mjs',
];
const f = await createFlow({
  name: 'top-toolbar-overflow', envFrozen: tooltipEscape ? 'D978_SOURCE_FROZEN' : resizeFocus ? 'D977_SOURCE_FROZEN' : 'D685_SOURCE_FROZEN', output,
  initialFiles: pins, requiredFrozen: pins, qualification: tooltipEscape ? 'Escape dismisses More tools while Undo tooltip is visible' : resizeFocus ? 'Retain focus and close More tools through desktop resize' : `D685 desktop toolbar reachability ${mode}`,
});
const toolbar = () => f.page.getByRole('toolbar', { name: 'Tools bar', exact: true });
const trigger = () => toolbar().getByRole('button', { name: 'More tools', exact: true });
const menu = () => f.page.getByRole('menu', { name: 'More tools', exact: true });
const selectedLabel = () => f.page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
const waitFocus = label => f.page.waitForFunction(label => document.activeElement?.getAttribute('aria-label') === label, label, { timeout: 5000 });
const settle = () => f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));

function buttonGeometry(parent, direct) {
  const toolbar = parent.closest('.topbar');
  const frame = toolbar?.getBoundingClientRect();
  const clip = frame ? [Math.max(0, frame.left), Math.min(window.innerWidth, frame.right)] : [0, window.innerWidth];
  const all = direct
    ? [...parent.children].map(item => item.matches('button.tool') ? item : item.querySelector(':scope > button.tool')).filter(Boolean)
    : [...parent.querySelectorAll('button.tool')];
  return {
    toolbarClip: clip,
    pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
    buttons: all.map(button => {
      const r = button.getBoundingClientRect();
      const atCenter = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        label: button.getAttribute('aria-label'),
        disabled: button.disabled || button.getAttribute('aria-disabled') === 'true',
        left: r.left, right: r.right, width: r.width,
        clipped: Math.max(0, clip[0] - r.left, r.right - clip[1]),
        hit: button.contains(atCenter),
      };
    }),
  };
}

const inline = () => toolbar().evaluate(buttonGeometry, true);
const overflow = () => menu().evaluate(buttonGeometry, false);
const isVisible = row => row.clipped <= 0.1 && row.hit;
function assertVisible(geometry) {
  assert.equal(geometry.pageOverflow, 0);
  for (const row of geometry.buttons) assert.ok(isVisible(row), JSON.stringify(row));
}

async function openWithKey() {
  await f.page.keyboard.press('Space');
  await menu().waitFor();
  await settle();
}

async function closeWithKey() {
  await f.page.keyboard.press('Escape');
  await menu().waitFor({ state: 'hidden' });
  await waitFocus('More tools');
}

async function verifyAccess(label, inventory) {
  f.phase = 'check every inline and overflow control at ' + label;
  const geometry = await inline();
  assertVisible(geometry);
  const inlineEnabled = geometry.buttons.filter(row => !row.disabled).map(row => row.label);
  await f.page.getByRole('group', { name: 'Mode', exact: true }).getByRole('button', { name: 'Drawing', exact: true }).focus();
  for (const tool of inlineEnabled) {
    await f.page.keyboard.press('Tab');
    assert.equal(await selectedLabel(), tool);
  }
  assert.equal(await selectedLabel(), 'More tools');
  await openWithKey();
  const menuGeometry = await overflow();
  assertVisible(menuGeometry);
  const inlineTools = geometry.buttons.filter(row => row.label !== 'More tools').map(row => row.label);
  assert.deepEqual([...inlineTools, ...menuGeometry.buttons.map(row => row.label)], inventory);
  const keys = menuGeometry.buttons.filter(row => !row.disabled).map(row => row.label);
  for (const [index, tool] of keys.entries()) {
    if (index > 0) await f.page.keyboard.press('ArrowDown');
    await waitFocus(tool);
  }
  assert.equal(keys.at(-1), 'Insert part');
  await f.snapshot(label + '-keyboard-menu');
  const [keyboardChooser] = await Promise.all([f.page.waitForEvent('filechooser'), f.page.keyboard.press('Enter')]);
  assert.equal(await keyboardChooser.element().getAttribute('aria-label'), 'Part file');
  await keyboardChooser.setFiles([]);
  await menu().waitFor({ state: 'hidden' });
  await trigger().focus();
  await openWithKey();
  await closeWithKey();

  await trigger().click();
  const [pointerChooser] = await Promise.all([
    f.page.waitForEvent('filechooser'), menu().getByRole('menuitem', { name: 'Insert part', exact: true }).click(),
  ]);
  assert.equal(await pointerChooser.element().getAttribute('aria-label'), 'Part file');
  await pointerChooser.setFiles([]);
  await menu().waitFor({ state: 'hidden' });
  await f.snapshot(label + '-resting');
  f.report.observations.push({ label, geometry, menuGeometry, inlineEnabled, keyboardMenu: keys, pointerAndKeyboardOpenedPartChooser: true });
}

async function makeBox() {
  const page = f.page;
  f.phase = 'create the toolbar Box fixture';
  await toolbar().getByRole('button', { name: 'New part', exact: true }).click();
  await page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.ready();
  await page.evaluate(() => document.activeElement?.blur());
  await f.command('box');
  await page.getByRole('dialog', { name: 'Box', exact: true }).getByRole('button', { name: 'Apply', exact: true }).click();
  await page.waitForFunction(() => window.__studioDoc.nodes.length === 2);
  await f.ready();
  return f.doc();
}

async function verifyResizeFocus() {
  const page = f.page;
  const accepted = await makeBox();
  const insert = toolbar().getByRole('button', { name: 'Insert part', exact: true });
  const chat = toolbar().getByRole('button', { name: 'Chat', exact: true });
  const size = width => page.setViewportSize({ width, height: 900 });
  const results = [];
  for (const [name, wide, narrow] of [['chat-closed', 1440, 1024], ['chat-open', 1800, 1280]]) {
    f.phase = 'transfer toolbar focus and close overflow during resize (' + name + ')';
    await size(wide);
    if (name === 'chat-open') {
      await chat.click();
      await page.locator('.chat-col.open').waitFor();
    }
    await insert.waitFor();
    await insert.focus();
    await size(narrow);
    await trigger().waitFor();
    await settle();
    const transfer = await selectedLabel();
    if (mode.endsWith('fixed')) await waitFocus('More tools');
    else await trigger().focus();

    await openWithKey();
    await menu().getByRole('menuitem', { name: 'Insert part', exact: true }).focus();
    await size(wide);
    await insert.waitFor();
    await menu().waitFor({ state: 'hidden' });
    await settle();
    const restored = await selectedLabel();
    if (mode.endsWith('fixed')) await waitFocus('Insert part');
    await size(narrow);
    await trigger().waitFor();
    await settle();
    const reopened = await menu().isVisible();
    if (mode.endsWith('fixed')) {
      assert.equal(reopened, false);
      await waitFocus('More tools');
    } else if (reopened) {
      await closeWithKey();
    }
    await f.same(accepted);
    await f.snapshot(name + '-after-resize');
    results.push({ name, wide, narrow, transfer, restored, reopened });
  }
  f.report.observations.push(...results);
  if (mode.endsWith('baseline')) {
    assert.ok(results.some(row => row.transfer !== 'More tools' || row.reopened), JSON.stringify(results));
    assert.fail('A focused inline tool lost focus and More tools reopened after the trigger was removed');
  }
}

async function verifyTooltipEscape() {
  const page = f.page;
  const accepted = await makeBox();
  const chat = toolbar().getByRole('button', { name: 'Chat', exact: true });
  const undo = toolbar().getByRole('button', { name: 'Undo', exact: true });
  const tooltip = page.locator('[data-slot="tooltip-content"].tooltip').filter({ hasText: /Undo/ });
  const results = [];
  for (const [name, width] of [['chat-closed', 1024], ['chat-open', 1280]]) {
    f.phase = 'dismiss More tools with a visible Undo tooltip (' + name + ')';
    await page.setViewportSize({ width, height: 900 });
    if (name === 'chat-open') {
      await chat.click();
      await page.locator('.chat-col.open').waitFor();
    }
    await trigger().focus();
    await openWithKey();
    const exportStep = menu().getByRole('menuitem', { name: 'Export STEP', exact: true });
    await exportStep.focus();
    await waitFocus('Export STEP');
    await undo.hover();
    await tooltip.waitFor();
    assert.equal(await selectedLabel(), 'Export STEP');
    await f.snapshot(name + '-undo-tooltip-and-menu');
    await page.keyboard.press('Escape');
    await settle();
    if (mode.endsWith('fixed')) {
      await menu().waitFor({ state: 'hidden' });
      await waitFocus('More tools');
      await tooltip.waitFor({ state: 'hidden' });
    }
    const menuAfterEscape = await menu().isVisible();
    const focusAfterEscape = await selectedLabel();
    results.push({ name, width, menuAfterEscape, focusAfterEscape });
    await f.same(accepted);
    await f.snapshot(name + '-after-escape');
    if (menuAfterEscape) await page.mouse.click(550, 500);
  }
  f.report.observations.push(...results);
  if (mode.endsWith('baseline')) {
    assert.ok(results.every(row => row.menuAfterEscape), JSON.stringify(results));
    assert.fail('The Undo tooltip consumed Escape while More tools held keyboard focus');
  }
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
  if (resizeFocus) { await verifyResizeFocus(); return; }
  if (tooltipEscape) { await verifyTooltipEscape(); return; }
  await f.page.setViewportSize({ width: 1440, height: 900 });
  await f.page.locator('.chat-col:not(.open)').waitFor();
  await settle();
  const original = await f.doc();
  const wide = await inline();
  assertVisible(wide);
  const inventory = wide.buttons.map(row => row.label);
  assert.equal(inventory.length, 14);
  assert.ok(inventory.includes('Insert part') && !inventory.includes('More tools'));

  for (const [width, chatOpen] of [[1024, false], [1280, true]]) {
    const label = width + 'x800-' + (chatOpen ? 'open' : 'closed');
    f.phase = 'resize and check ' + label;
    await f.page.setViewportSize({ width, height: 800 });
    await settle();
    if (chatOpen) {
      await toolbar().getByRole('button', { name: 'Chat', exact: true }).click();
      await f.page.locator('.chat-col.open').waitFor();
      await settle();
    }
    if (mode === '--baseline') {
      const geometry = await inline();
      const observed = geometry.buttons.find(row => row.label === 'More tools')
        ?? geometry.buttons.find(row => row.label === 'Insert part');
      assert.ok(observed?.clipped > 1, JSON.stringify(geometry));
      f.report.observations.push({ label, clipped: observed, geometry });
      await f.snapshot(label + '-clipped');
    } else {
      await verifyAccess(label, inventory);
    }
    await f.same(original);
  }

  if (mode === '--fixed') {
    f.phase = 'grow the toolbar and restore the full inventory';
    await toolbar().getByRole('button', { name: 'Chat', exact: true }).click();
    await f.page.locator('.chat-col:not(.open)').waitFor();
    await f.page.setViewportSize({ width: 1440, height: 900 });
    await settle();
    const restored = await inline();
    assertVisible(restored);
    assert.deepEqual(restored.buttons.map(row => row.label), inventory);
    assert.equal(await trigger().count(), 0);
    f.report.observations.push({ label: 'wide-inventory-restored', inventory, originalDocumentRetained: true });
    await f.same(original);
  }
  assert.deepEqual(f.report.downloads, []);
  f.phase = 'complete';
});
