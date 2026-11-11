import assert from 'node:assert/strict';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(mode === '--baseline' || mode === '--fixed');
const pins = ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/Palette.tsx', 'apps/cad-studio/test/studio-shortcut-focus-browser.mjs'];
const f = await createFlow({
  name: 'studio-shortcut-focus', envFrozen: 'D684_SOURCE_FROZEN', output,
  initialFiles: pins, requiredFrozen: pins,
  qualification: `D684 desktop keyboard ownership ${mode}`,
  limits: ['Trusted browser keystrokes for native text Undo/Redo, toolbar Space and the workspace shortcuts.'],
});

const button = name => f.page.getByRole('button', { name, exact: true });
const nameInput = () => f.page.locator('.doc-tab input');
const palette = () => f.page.getByRole('dialog', { name: 'Command palette', exact: true });
const focused = locator => locator.evaluate(element => element === document.activeElement);
const lastKey = () => f.page.evaluate(() => window.__d684Keys.at(-1));
const settle = () => f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
const canvas = () => f.page.locator('canvas.vp-canvas');

async function snapshot(label) {
  return f.snapshot(label, () => ({
    name: document.querySelector('.doc-tab input').value,
    nameFocused: document.activeElement === document.querySelector('.doc-tab input'),
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    undoDisabled: document.querySelector('button[aria-label="Undo"]').disabled,
    redoDisabled: document.querySelector('button[aria-label="Redo"]').disabled,
  }));
}

function assertCadRetained(before, after) {
  for (const field of ['doc', 'bodies', 'selection', 'dirty', 'history', 'undoDisabled', 'redoDisabled']) {
    assert.deepEqual(after[field], before[field], field);
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
  await f.page.setViewportSize({ width: 1440, height: 900 });
  f.phase = 'Create a committed Box';
  await button('New part').click();
  await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.ready();
  const empty = await f.doc();
  await f.page.keyboard.press('b');
  const hud = f.page.getByRole('dialog', { name: 'Box', exact: true });
  await hud.waitFor();
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview');
  await hud.getByRole('button', { name: 'Apply', exact: true }).click();
  await f.changed(empty);
  const box = await f.doc();
  assert.equal((await f.bodies()).bodies.length, 1);

  const modifier = await f.page.evaluate(() => navigator.platform.startsWith('Mac') ? 'Meta' : 'Control');
  const undo = modifier + '+z';
  const redo = modifier + '+Shift+z';
  await f.page.evaluate(() => {
    window.__d684Keys = [];
    const focusAtDispatch = new WeakMap();
    window.addEventListener('keydown', e => focusAtDispatch.set(e, document.activeElement === e.target), true);
    window.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' || e.key === ' ') {
        window.__d684Keys.push({
          key: e.key.toLowerCase(), shift: e.shiftKey, trusted: e.isTrusted, prevented: e.defaultPrevented,
          focused: focusAtDispatch.get(e),
        });
      }
    });
  });

  f.phase = 'Append X using native input and press Undo';
  const filename = await nameInput().inputValue();
  await nameInput().selectText();
  await f.page.keyboard.press('ArrowRight');
  await f.page.keyboard.type('X');
  const edited = await snapshot('01-edited-file-name');
  assert.equal(edited.name, filename + 'X');
  assert.equal(edited.nameFocused, true);
  await f.page.keyboard.press(undo);
  const undoKey = await lastKey();
  assert.deepEqual(undoKey, { key: 'z', shift: false, trusted: true, prevented: mode === '--baseline', focused: true });
  if (mode === '--baseline') {
    await f.same(empty);
    const baseline = await snapshot('02-baseline-undo-removed-box');
    assert.equal(baseline.name, filename + 'X');
    assert.equal(baseline.redoDisabled, false);
    await button('Redo').click();
    await f.same(box);
  } else {
    const textUndo = await snapshot('02-native-text-undo');
    assert.equal(textUndo.name, filename);
    assert.equal(textUndo.nameFocused, true);
    assertCadRetained(edited, textUndo);
    await f.page.keyboard.press(redo);
    assert.deepEqual(await lastKey(), { key: 'z', shift: true, trusted: true, prevented: false, focused: true });
    const textRedo = await snapshot('03-native-text-redo');
    assert.equal(textRedo.name, filename + 'X');
    assertCadRetained(edited, textRedo);
    await f.page.keyboard.press(undo);
    assert.equal(await nameInput().inputValue(), filename);

    f.phase = 'Keep CAD Undo and Redo when focus returns to the workspace';
    await canvas().click({ position: { x: 700, y: 180 } });
    assert.equal(await focused(nameInput()), false);
    await f.page.keyboard.press(undo);
    await f.same(empty);
    await f.page.keyboard.press(redo);
    await f.same(box);
    await f.page.keyboard.press('Space');
    await palette().waitFor();
    assert.ok(await focused(palette().getByRole('combobox')));
    await snapshot('04-workspace-palette');
    await f.page.keyboard.press('Escape');
    await palette().waitFor({ state: 'detached' });
    await f.same(box);
  }

  f.phase = 'Press Space with New part focused';
  const newPart = button('New part');
  await newPart.focus();
  assert.ok(await focused(newPart));
  await f.page.keyboard.press('Space');
  await settle();
  const spaceKey = await lastKey();
  assert.deepEqual(spaceKey, { key: ' ', shift: false, trusted: true, prevented: mode === '--baseline', focused: true });
  if (mode === '--baseline') {
    await palette().waitFor();
    await f.same(box);
    await snapshot('03-baseline-space-opened-palette');
  } else {
    await f.same(empty);
    assert.equal(await palette().count(), 0);
    assert.equal(await nameInput().inputValue(), 'Untitled');
    await snapshot('05-space-activated-new-part');
    await button('Undo').click();
    await f.same(box);
    assert.equal(await nameInput().inputValue(), filename);
  }
  assert.deepEqual(f.report.downloads, []);
  f.report.observations.push({ modifier, undoKey, spaceKey });
  f.phase = 'complete';
});
