import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/sketch-new-trim-draft-history-browser.mjs',
  'apps/cad-studio/src/sketch/draftHistory.ts',
  'apps/cad-studio/src/sketch/useSketchActions.ts',
  'packages/barocss-cad-model/src/sketch/select.ts',
];
const f = await createFlow({
  name: 'sketch-new-trim-draft-history', output: process.argv[2], envFrozen: 'D1072_SOURCE_FROZEN',
  qualification: 'Replay Trim to Select on a newly drawn rectangle and construction line.',
  limits: ['One new XY rectangle with one isolated straight construction line.'],
  initialFiles: pins, requiredFrozen: pins,
});
const button = name => f.page.getByRole('button', { name, exact: true });
const guide = () => f.page.locator('.vp-overlay polyline.sk-shape.done.construction');
const press = async key => {
  await f.page.locator('.topbar button.finish').focus();
  await f.page.keyboard.press(key);
};

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
  const blank = await f.doc();
  await f.page.locator('.mode').getByRole('button', { name: 'Sketch', exact: true }).click();
  await f.sketchPanel().waitFor();
  await f.frame([[0, 0], [40, 20], [50, 5], [60, 5]]);
  await f.tool('Rectangle', 'r');
  await f.worldClick([0, 0]);
  await f.worldClick([40, 20]);
  await f.tool('Line', 'l');
  await button('Construction').click();
  await f.worldClick([50, 5]);
  await f.worldClick([60, 5]);
  await f.tool('Trim', 't');
  const originalGuide = await guide().getAttribute('points');
  const pixel = await f.screenOf([55, 5]);
  await f.page.mouse.move(...pixel);
  await f.page.locator('.vp-overlay .sk-trim').waitFor({ state: 'attached' });
  await f.page.mouse.click(...pixel);
  assert.equal(await guide().count(), 0);
  await f.tool('Select', 's');
  const length = f.sketchPanel().getByLabel('Edge 1 length', { exact: true });
  assert.equal(Number(await length.inputValue()), 40);
  await f.same(blank);
  await f.snapshot('01-trim-then-select');

  f.phase = 'Undo restores the guide and keeps the new rectangle active';
  await press('Meta+z');
  const restored = await guide().count();
  f.report.observations.push({ guideAfterUndo: restored });
  await f.snapshot('02-after-undo');
  assert.equal(restored, 1);
  assert.equal(await guide().getAttribute('points'), originalGuide);
  assert.equal(Number(await length.inputValue()), 40);
  await button('Redo').click();
  assert.equal(await guide().count(), 0);
  assert.equal(Number(await length.inputValue()), 40);
  await button('Undo').click();
  assert.equal(await guide().getAttribute('points'), originalGuide);
  await press('Meta+Shift+z');
  assert.equal(await guide().count(), 0);
  await press('Meta+z');
  assert.equal(await guide().getAttribute('points'), originalGuide);
  await f.same(blank);

  const finished = await f.finishSketch('03-restored-finish');
  const sketch = finished.doc.nodes[0];
  assert.equal(sketch.profile, 'rectangle');
  assert.deepEqual([sketch.min, sketch.max], [[0, 0], [40, 20]]);
  assert.equal(sketch.construction.length, 1);
  assert.deepEqual(sketch.construction[0].points, [[50, 5], [60, 5]]);
  assert.equal(sketch.construction[0].construction, true);
  await f.openExtrudeHud();
  const result = await f.applyExtrude({ distance: 2, previous: finished.doc, label: '04-rectangle' });
  assert.equal(result.bodies.bodies.length, 1);
  assert.ok(Math.abs(result.bodies.bodies[0].volume - 1600) < 1e-8);
  await button('Undo').click();
  await f.same(finished.doc);
  await button('Redo').click();
  await f.same(result.doc);
  assert.deepEqual(f.report.downloads, []);
});
