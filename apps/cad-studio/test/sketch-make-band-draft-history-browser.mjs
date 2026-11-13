import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/sketch-make-band-draft-history-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/sketch/draftHistory.ts',
  'apps/cad-studio/src/sketch/useSketchActions.ts',
  'packages/barocss-cad-model/src/sketch/band.ts',
];
const f = await createFlow({
  name: 'sketch-make-band-draft-history',
  output: process.argv[2],
  envFrozen: 'D1067_SOURCE_FROZEN',
  qualification: 'Replay Make band, its construction sources and picks in Sketch draft history.',
  limits: ['Two 5 mm circles, zero offset, a 3 mm strip and a 4 mm Extrude in desktop WebGPU.'],
  initialFiles: pins,
  requiredFrozen: pins,
});
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const outline = () => f.page.locator('.vp-overlay .sk-band');
const sources = () => f.page.locator('.vp-overlay .sk-shape.done.construction').evaluateAll(nodes =>
  nodes.map(node => node.getAttribute('points')));

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
  await button('Construction').click();
  await f.frame([[7, 7], [43, 23]]);
  for (const point of [[15, 15], [20, 15], [35, 15], [40, 15]]) await f.worldClick(point);
  await f.tool('Band', 'm');
  const originalSources = await sources();
  assert.equal(originalSources.length, 2);
  const make = button('Make band', f.sketchPanel());
  await f.worldClick([15, 15]);
  assert.equal(await make.isEnabled(), false);
  await f.worldClick([35, 15]);
  assert.equal(await make.isEnabled(), true);
  await f.sketchPanel().getByLabel('Band width', { exact: true }).fill('3');
  await make.click();
  const made = await outline().getAttribute('d');
  assert.ok(made);
  assert.deepEqual(await sources(), originalSources);
  await f.same(blank);
  await f.snapshot('01-made-band');

  f.phase = 'Keyboard Undo removes the band and restores both picks';
  await f.page.locator('.topbar button.finish').focus();
  await f.page.keyboard.press('Meta+z');
  const afterUndo = { band: await outline().count(), sources: (await sources()).length, picksReady: await make.isEnabled({ timeout: 1000 }).catch(() => false) };
  f.report.observations.push(afterUndo);
  await f.snapshot('02-after-keyboard-undo');
  assert.deepEqual(afterUndo, { band: 0, sources: 2, picksReady: true });
  assert.deepEqual(await sources(), originalSources);
  await f.same(blank);
  await button('Redo').click();
  assert.equal(await outline().getAttribute('d'), made);
  await button('Undo').click();
  assert.equal(await outline().count(), 0);
  await f.page.locator('.topbar button.finish').focus();
  await f.page.keyboard.press('Meta+Shift+z');
  assert.equal(await outline().getAttribute('d'), made);
  assert.deepEqual(await sources(), originalSources);
  await f.snapshot('03-after-keyboard-redo');

  const finished = await f.finishSketch('04-finished-band');
  const sketch = finished.doc.nodes[0];
  assert.equal(sketch.profile, 'band');
  assert.equal(sketch.band.width, 3);
  assert.equal(sketch.band.offset ?? 0, 0);
  assert.equal(sketch.construction.length, 2);
  assert.deepEqual(sketch.construction.map(circle => [circle.kind, circle.c, circle.r, circle.construction]), [
    ['circle', [15, 15], 5, true],
    ['circle', [35, 15], 5, true],
  ]);
  assert.deepEqual(sketch.band.sources, sketch.construction.map(circle => circle.ids[0]));
  await f.openExtrudeHud();
  const solid = await f.applyExtrude({ distance: 4, previous: finished.doc, label: '05-band' });
  const expected = 4 * (2 * 20 * 3 + Math.PI * (8 ** 2 - 5 ** 2));
  assert.equal(solid.bodies.bodies.length, 1);
  assert.ok(Math.abs(solid.bodies.bodies[0].volume - expected) < 1e-7);
  await button('Undo').click();
  await f.same(finished.doc);
  await button('Redo').click();
  await f.same(solid.doc);
  assert.deepEqual(f.report.downloads, []);
});
