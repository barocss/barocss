import assert from 'node:assert/strict';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(mode === '--baseline' || mode === '--fixed');
const pins = [
  'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/ToolsTray.tsx', 'apps/cad-studio/src/styles.css',
  'apps/cad-studio/src/components/ui/tool-button.tsx', 'apps/cad-studio/test/top-toolbar-overflow-browser.mjs',
];
const f = await createFlow({
  name: 'top-toolbar-overflow', envFrozen: 'D685_SOURCE_FROZEN', output,
  initialFiles: pins, requiredFrozen: pins, qualification: `D685 desktop toolbar reachability ${mode}`,
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
