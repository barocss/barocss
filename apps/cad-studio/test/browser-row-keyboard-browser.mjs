import assert from 'node:assert/strict';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';
import { pressWorkspaceSpace } from './workspace-palette-shortcut.mjs';

const [output, mode] = process.argv.slice(2), repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(mode === '--baseline' || mode === '--fixed');
const pins = ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/BodyBrowserRows.tsx',
  'apps/cad-studio/src/ui/Palette.tsx', 'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/test/workspace-palette-shortcut.mjs'];
const f = await createFlow({ name: 'browser-row-keyboard', envFrozen: 'D667_SOURCE_FROZEN', output,
  initialFiles: pins, requiredFrozen: pins, qualification: 'Native Browser button activation and the workspace palette shortcut' });
const browser = () => f.page.getByRole('complementary', { name: 'Browser', exact: true });
const palette = () => f.page.getByRole('dialog', { name: 'Command palette', exact: true });
const selected = () => f.page.evaluate(() => window.__studioSelection.selection.bodies);
const focused = locator => locator.evaluate(element => element === document.activeElement);
const history = () => f.page.locator('.history .hs').evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label')));
const settle = () => f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));

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
  await f.newPage();
  await f.page.setViewportSize({ width: 1280, height: 720 });
  f.phase = 'create a Box in a new part with the public Studio commands';
  await f.page.getByRole('button', { name: 'New part', exact: true }).click();
  await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.ready();
  await f.page.keyboard.press('b');
  const hud = f.page.getByRole('dialog', { name: 'Box', exact: true });
  await hud.waitFor();
  const beforeBox = await f.doc();
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview');
  await hud.getByRole('button', { name: 'Apply', exact: true }).click();
  await f.changed(beforeBox);
  const workingDoc = await f.doc(), initialHistory = await history();
  assert.equal(Object.keys(workingDoc.outputs).length, 1);
  assert.ok(initialHistory.some(entry => entry?.includes('Box')));

  f.phase = 'reach the Box row through normal tab order and press Space';
  const row = f.page.locator('.outliner .ol-row button.ol').filter({ hasText: /^Box$/ });
  await browser().getByRole('button', { name: 'Hide body', exact: true }).focus();
  await f.page.keyboard.press('Tab');
  assert.equal(await focused(row), true);
  await f.page.keyboard.press('Escape');
  await settle();
  assert.deepEqual(await selected(), []);
  assert.equal(await focused(row), true);
  await f.page.keyboard.press('Space');
  await settle();

  if (mode === '--baseline') {
    await palette().waitFor();
    assert.deepEqual(await selected(), []);
    assert.equal(await focused(row), false);
    await f.snapshot('01-baseline-space-opened-palette');
    await f.page.keyboard.press('Escape');
    await palette().waitFor({ state: 'hidden' });
    await settle();
    f.report.observations.push({ baselineRowSpaceOpenedPalette: true, baselineRowSpaceSelectedBody: false,
      baselinePaletteEscapeReturnedToRow: await focused(row) });
    await f.same(workingDoc);
    assert.deepEqual(await history(), initialHistory);
    return;
  }

  assert.equal(await palette().count(), 0);
  assert.deepEqual(await selected(), [0]);
  assert.equal(await focused(row), true);
  assert.equal(await row.evaluate(element => element.matches(':focus-visible') && element.classList.contains('sel')), true);
  await f.snapshot('01-fixed-space-selected-box');

  f.phase = 'clear selection on Escape and select again with Enter';
  await f.page.keyboard.press('Escape');
  await settle();
  assert.deepEqual(await selected(), []);
  assert.equal(await focused(row), true);
  assert.equal(await palette().count(), 0);
  await f.page.keyboard.press('Enter');
  await settle();
  assert.deepEqual(await selected(), [0]);
  assert.equal(await focused(row), true);
  await f.page.keyboard.press('Escape');
  await settle();
  assert.deepEqual(await selected(), []);
  assert.equal(await focused(row), true);
  await f.snapshot('02-fixed-escape-retained-row-focus');

  f.phase = 'open the palette from the workspace and close it with Escape';
  await f.page.locator('canvas.vp-canvas').click({ position: { x: 700, y: 180 } });
  const activeOutside = () => f.page.evaluate(() => !document.activeElement?.closest('.outliner'));
  assert.equal(await activeOutside(), true);
  await f.page.keyboard.press('Space');
  await palette().waitFor();
  const search = palette().getByRole('combobox');
  assert.equal(await focused(search), true);
  await search.fill('chamfer');
  assert.ok(await palette().getByText('Chamfer', { exact: true }).count());
  await f.snapshot('03-fixed-palette-from-workspace');
  await f.page.keyboard.press('Escape');
  await palette().waitFor({ state: 'hidden' });
  assert.equal(await activeOutside(), true);

  f.phase = 'open the workspace palette with a selected body';
  await row.click();
  assert.deepEqual(await selected(), [0]);
  await pressWorkspaceSpace(f.page);
  await palette().waitFor();
  assert.deepEqual(await selected(), [0]);
  await f.page.keyboard.press('Escape');
  await palette().waitFor({ state: 'hidden' });
  assert.deepEqual(await selected(), [0]);
  await f.same(workingDoc);
  assert.deepEqual(await history(), initialHistory);
  assert.deepEqual(f.report.downloads, []);
  f.report.observations.push({ desktop: '1280x720', tabReachedBodyRow: true, spaceSelectedBody: true,
    enterSelectedBody: true, escapeClearedSelectionAndRetainedRowFocus: true,
    workspaceSpaceOpenedPalette: true, workspaceEscapeClosedPalette: true, workspacePaletteKeptBodySelection: true, documentAndHistoryExact: true });
});
