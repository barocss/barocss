import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/sketch-linked-plane-draft-history-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/sketch/draftHistory.ts',
  'apps/cad-studio/src/sketch/useSketchActions.ts',
];
const f = await createFlow({
  name: 'sketch-linked-plane-draft-history',
  output: process.argv[2],
  envFrozen: 'D1070_SOURCE_FROZEN',
  qualification: 'Replay the plane, face owner and association of a new linked inset.',
  limits: ['One selected top face with a 1 mm inset and a 2 mm plane offset.'],
  initialFiles: pins,
  requiredFrozen: pins,
});
const solid = node => ({ node, side: 'solid' });
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [20, 10], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 10, id: 'n1' },
  ],
  outputs: { b1: solid(1) }, nextId: 2,
};
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const offset = () => f.sketchPanel().getByLabel('Plane offset', { exact: true });
const check = async (shift, linked) => {
  const panel = f.sketchPanel();
  assert.equal(Number(await offset().inputValue()), shift);
  assert.equal(await panel.getByLabel('Sketch plane', { exact: true }).inputValue(), 'face');
  assert.match(await panel.locator('.card-title').first().innerText(), new RegExp('Z ' + (10 + shift) + ' · on face'));
  assert.equal(await panel.getByText(/Linked face outline and inset/).isVisible(), linked);
  assert.equal(await panel.getByText(/Link detached by a geometry or plane edit/).isVisible(), !linked);
  await f.same(seed);
};
const keyboard = async key => {
  await f.page.locator('.topbar button.finish').focus();
  await f.page.keyboard.press(key);
};
const ring = (bodies, z) => {
  assert.equal(bodies.length, 2);
  const body = bodies.find(b => Math.abs(b.volume - 224) < 1e-8);
  assert.ok(body);
  assert.ok(Math.abs(body.centroid[2] - z) < 1e-8);
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
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'linked-plane-history.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed)) });
  await f.same(seed);
  await button('Top', f.page.locator('.views')).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  const pixel = await f.screenOf([10, 5, 10]);
  assert.ok(await f.page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.matches('canvas.vp-canvas'), pixel));
  await f.page.mouse.click(...pixel);
  await f.page.waitForFunction(() => window.__studioSelection.selection.faces.length === 1);
  await button('Sketch', f.page.locator('.mode')).click();
  await f.sketchPanel().waitFor();
  await f.sketchPanel().getByLabel('Offset distance', { exact: true }).fill('1');
  await f.sketchPanel().getByRole('button', { name: 'Link face outline + inset', exact: true }).click();
  await check(0, true);
  await offset().fill('0.0');
  await check(0, true);

  f.phase = 'Move the linked inset off its source plane';
  await offset().fill('2');
  await check(2, false);
  await f.snapshot('01-shifted-detached');

  f.phase = 'Keyboard Undo restores the offset and link together';
  await keyboard('Meta+z');
  f.report.observations.push({ offsetAfterUndo: Number(await offset().inputValue()),
    linkedAfterUndo: await f.sketchPanel().getByText(/Linked face outline and inset/).isVisible() });
  await f.snapshot('02-after-keyboard-undo');
  await check(0, true);
  await button('Redo').click();
  await check(2, false);
  await offset().fill('2.0');
  await check(2, false);
  await button('Undo').click();
  await check(0, true);
  await keyboard('Meta+Shift+z');
  await check(2, false);
  await button('Undo').click();
  await check(0, true);

  const finished = await f.finishSketch('03-linked-finish');
  const sketch = finished.doc.nodes[2];
  assert.deepEqual(sketch.association, { kind: 'planar-face-outline-inset', version: 1, source: solid(1),
    sourceFeature: 'n1', face: 'n1.top', insetMM: 1 });
  assert.deepEqual(sketch.on, solid(1));
  assert.deepEqual(sketch.plane.origin, [0, 0, 10]);
  await f.openExtrudeHud();
  const extruded = await f.applyExtrude({ distance: 4, previous: finished.doc, label: '04-linked-ring' });
  ring(extruded.bodies.bodies, 12);

  f.phase = 'The restored link follows the source after Finish';
  await f.openFeatureEditor(1);
  await f.editor().getByLabel('Distance', { exact: true }).fill('12');
  const regenerated = await f.applyEditor(extruded.doc, '05-regenerated');
  assert.deepEqual(regenerated.doc.nodes[2], sketch);
  ring(regenerated.bodies.bodies, 14);
  assert.deepEqual(f.report.downloads, []);
});
