import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const circle = process.argv.includes('--circle');
const field = circle ? 'diameter' : 'width';
const tool = circle ? 'Circle' : 'Rectangle';
const initial = 16;
const edited = circle ? 15 : 20;
const pins = [
  'apps/cad-studio/test/sketch-numeric-draft-history-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/ui/SketchPanel.tsx',
  'apps/cad-studio/src/sketch/draftHistory.ts',
];
const f = await createFlow({
  name: 'sketch-numeric-draft-history', output: process.argv[2], envFrozen: circle ? 'D1060_SOURCE_FROZEN' : 'D1059_SOURCE_FROZEN',
  qualification: `Undo and Redo a numeric ${tool} edit before Finish.`,
  limits: [circle ? 'One 16 mm diameter Circle in desktop Studio.' : 'A new 16 × 10 mm Rectangle in desktop Studio.'],
  initialFiles: pins, requiredFrozen: pins,
});
const button = name => f.page.getByRole('button', { name, exact: true });
const input = () => f.sketchPanel().locator('#sk-' + field);
async function readValue() { return Number(await input().inputValue()); }

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
  await f.tool(tool, circle ? 'c' : 'r');
  await f.frame([[0, 0], [16, 10]]);
  await f.worldClick([0, 0]);
  await f.worldClick(circle ? [8, 0] : [16, 10]);
  await input().waitFor();
  assert.equal(await readValue(), initial);
  assert.equal(await button('Undo').isEnabled(), false);
  await input().fill(String(edited));
  await input().press('Tab');
  assert.equal(await readValue(), edited);
  await f.page.locator('.topbar button.finish').focus();
  await f.same(doc);

  f.phase = `Undo the numeric ${field} through the desktop shortcut`;
  const undoEnabled = await button('Undo').isEnabled();
  await f.page.keyboard.press('Meta+z');
  const undone = await readValue();
  f.report.observations.push({ label: field, undoEnabled, undone });
  await f.snapshot(field + '-after-shortcut-undo');
  assert.equal(undoEnabled, true);
  assert.equal(undone, initial);
  assert.equal(await button('Undo').isEnabled(), false);
  assert.equal(await button('Redo').isEnabled(), true);
  await f.same(doc);
  await button('Redo').click();
  assert.equal(await readValue(), edited);
  await button('Undo').click();
  assert.equal(await readValue(), initial);
  await f.page.locator('.topbar button.finish').focus();
  await f.page.keyboard.press('Meta+Shift+z');
  assert.equal(await readValue(), edited);
  const finished = await f.finishSketch(field + '-finished');
  assert.equal(finished.doc.nodes.length, 1);
  const sketch = finished.doc.nodes[0];
  if (circle) {
    assert.equal(sketch.profile, 'circle');
    assert.deepEqual(sketch.center, [0, 0]);
    assert.equal(sketch.radius, edited / 2);
  } else {
    assert.equal(sketch.profile, 'rectangle');
    assert.deepEqual(sketch.min, [0, 0]);
    assert.deepEqual(sketch.max, [edited, 10]);
  }
  await f.undo();
  await f.same(doc);
  await f.redo();
  await f.same(finished.doc);
  assert.deepEqual(f.report.downloads, []);
});
