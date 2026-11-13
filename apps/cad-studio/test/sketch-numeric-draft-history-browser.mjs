import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/sketch-numeric-draft-history-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/ui/SketchPanel.tsx',
  'apps/cad-studio/src/sketch/draftHistory.ts',
];
const f = await createFlow({
  name: 'sketch-numeric-draft-history', output: process.argv[2], envFrozen: 'D1059_SOURCE_FROZEN',
  qualification: 'Undo and Redo a numeric Rectangle edit before Finish.',
  limits: ['A new 16 × 10 mm Rectangle in desktop Studio.'],
  initialFiles: pins, requiredFrozen: pins,
});
const button = name => f.page.getByRole('button', { name, exact: true });
const width = () => f.sketchPanel().locator('#sk-width');
async function readWidth() { return Number(await width().inputValue()); }

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
  await button('New part').click();
  await f.page.waitForFunction(() => window.__studioDoc?.nodes.length === 0);
  await f.ready();
  const doc = await f.doc();
  await f.page.getByRole('navigation', { name: 'Tools', exact: true }).getByRole('button', { name: 'Sketch', exact: true }).click();
  await f.sketchPanel().waitFor();
  await f.tool('Rectangle', 'r');
  await f.frame([[0, 0], [16, 10]]);
  await f.worldClick([0, 0]);
  await f.worldClick([16, 10]);
  await width().waitFor();
  assert.equal(await readWidth(), 16);
  assert.equal(await button('Undo').isEnabled(), false);
  await width().fill('20');
  await width().press('Tab');
  assert.equal(await readWidth(), 20);
  await f.page.locator('.topbar button.finish').focus();
  await f.same(doc);

  f.phase = 'Undo the numeric width through the desktop shortcut';
  const undoEnabled = await button('Undo').isEnabled();
  await f.page.keyboard.press('Meta+z');
  const undone = await readWidth();
  f.report.observations.push({ label: 'width', undoEnabled, undone });
  await f.snapshot('width-after-shortcut-undo');
  assert.equal(undoEnabled, true);
  assert.equal(undone, 16);
  assert.equal(await button('Undo').isEnabled(), false);
  assert.equal(await button('Redo').isEnabled(), true);
  await f.same(doc);
  await button('Redo').click();
  assert.equal(await readWidth(), 20);
  await button('Undo').click();
  assert.equal(await readWidth(), 16);
  await f.page.locator('.topbar button.finish').focus();
  await f.page.keyboard.press('Meta+Shift+z');
  assert.equal(await readWidth(), 20);
  const finished = await f.finishSketch('rectangle-width-finished');
  assert.equal(finished.doc.nodes.length, 1);
  assert.equal(finished.doc.nodes[0].profile, 'rectangle');
  assert.deepEqual(finished.doc.nodes[0].min, [0, 0]);
  assert.deepEqual(finished.doc.nodes[0].max, [20, 10]);
  await f.undo();
  await f.same(doc);
  await f.redo();
  await f.same(finished.doc);
  assert.deepEqual(f.report.downloads, []);
});
