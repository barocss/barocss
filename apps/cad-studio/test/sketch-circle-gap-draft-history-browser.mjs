import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/sketch-circle-gap-draft-history-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/sketch/draftHistory.ts',
  'apps/cad-studio/src/sketch/usePathGap.ts',
  'apps/cad-studio/src/sketch/pathGap.ts',
];
const f = await createFlow({
  name: 'sketch-circle-gap-draft-history',
  output: process.argv[2],
  envFrozen: 'D1074_SOURCE_FROZEN',
  qualification: 'Undo and redo a 4 mm gap in a new ordinary circle.',
  limits: ['One new 10 mm radius XY circle in desktop WebGPU.'],
  initialFiles: pins, requiredFrozen: pins,
});
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const outline = () => f.page.locator('.vp-overlay .sk-shape.done');
const geometry = () => outline().evaluateAll(nodes => nodes.map(node => [node.localName, node.getAttribute('points')]));
const keyboard = async key => {
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
  await button('Sketch', f.page.locator('.mode')).click();
  await f.sketchPanel().waitFor();
  await f.tool('Circle', 'c');
  await f.frame([[10, 10], [30, 30]]);
  await f.worldClick([20, 20]);
  await f.worldClick([30, 20]);
  await f.tool('Trim', 't');
  const circle = await geometry();
  assert.deepEqual(circle.map(([tag]) => tag), ['polygon']);
  await button('Cut circle gap', f.sketchPanel()).click();
  await f.sketchPanel().getByLabel('Gap length', { exact: true }).fill('4');
  const pixel = await f.screenOf([20, 30]);
  assert.ok(await f.page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.matches('canvas.vp-canvas'), pixel));
  await f.page.mouse.move(...pixel);
  await f.page.locator('.vp-overlay .sk-path-gap').waitFor({ state: 'attached' });
  await f.page.mouse.click(...pixel);
  const arc = await geometry();
  assert.deepEqual(arc.map(([tag]) => tag), ['polyline']);
  await f.page.locator('.topbar button.finish').click();
  const alert = f.sketchPanel().getByRole('alert').getByText(/Close or trim the open chain/);
  await alert.waitFor();
  await f.same(blank);
  await f.snapshot('01-open-arc-refused');

  f.phase = 'Undo restores the exact circle and clears the open-chain message';
  await keyboard('Meta+z');
  const restored = await geometry();
  f.report.observations.push({ restoredCircle: JSON.stringify(restored) === JSON.stringify(circle) });
  await f.snapshot('02-after-keyboard-undo');
  assert.deepEqual(restored, circle);
  await alert.waitFor({ state: 'hidden' });
  await button('Redo').click();
  assert.deepEqual(await geometry(), arc);
  await button('Undo').click();
  assert.deepEqual(await geometry(), circle);
  await keyboard('Meta+Shift+z');
  assert.deepEqual(await geometry(), arc);
  await button('Undo').click();
  assert.deepEqual(await geometry(), circle);
  await f.same(blank);

  const finished = await f.finishSketch('03-restored-circle');
  const [sketch] = finished.doc.nodes;
  assert.equal(sketch.profile, 'circle');
  assert.deepEqual(sketch.center, [20, 20]);
  assert.equal(sketch.radius, 10);
  await f.openExtrudeHud();
  const solid = await f.applyExtrude({ distance: 2, previous: finished.doc, label: '04-circle' });
  assert.equal(solid.bodies.bodies.length, 1);
  assert.ok(Math.abs(solid.bodies.bodies[0].volume - 200 * Math.PI) < 1e-8);
  await button('Undo').click();
  await f.same(finished.doc);
  await button('Redo').click();
  await f.same(solid.doc);
  assert.deepEqual(f.report.downloads, []);
});
