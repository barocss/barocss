import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/measure-preselected-vertex-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/viewport/useViewportPicking.ts',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'apps/cad-studio/src/ui/MeasurementInspector.tsx',
];
const f = await createFlow({
  name: 'measure-preselected-vertex',
  output: process.argv[2],
  envFrozen: 'D1015_SOURCE_FROZEN',
  qualification: 'Measure from one preselected corner to a second corner on a native box.',
  limits: ['One desktop WebGPU native rectangular body.'],
  snapshotExtra: () => ({
    measurement: document.querySelector('[aria-label="Measurement"]')?.textContent ?? null,
    overlay: window.__studioOverlayTexts?.()['measure:label'] ?? [],
  }),
  initialFiles: pins,
  requiredFrozen: pins,
});
const doc = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 40] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 10 },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
};
const button = name => f.page.getByRole('button', { name, exact: true });
const points = [[0, 0, 10], [30, 40, 10]];
async function pickCorner(point) {
  const [corner, centre] = await f.page.evaluate(points => points.map(point => window.__studioScreenOf(point)), [point, [15, 20, 10]]);
  const toward = corner.map((value, k) => centre[k] - value);
  const pixel = corner.map((value, k) => value + 3 * toward[k] / Math.hypot(...toward));
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel));
  await f.page.mouse.click(...pixel);
}
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
  await chooser.setFiles({ name: 'vertex-measure.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
  const views = f.page.locator('.views');
  await views.getByRole('button', { name: 'Top', exact: true }).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  const panel = f.page.getByRole('complementary', { name: 'Measurement', exact: true });
  const metric = name => panel.locator('.kv').filter({ hasText: new RegExp('^' + name) }).locator('b');

  f.phase = 'preselect a native corner through the Studio viewport';
  await pickCorner(points[0]);
  await f.page.waitForFunction(() => window.__studioSelection?.selection.vertices?.length === 1);
  const before = await f.snapshot('vertex-preselected');
  assert.deepEqual(before.selection.selection.vertices, [{ body: 0, at: points[0] }]);

  f.phase = 'start Measure with the selected vertex';
  await f.page.keyboard.press('Shift+M');
  await panel.waitFor();
  const seeded = await f.snapshot('vertex-seeded-measure');
  assert.deepEqual(await metric('From').allInnerTexts(), ['Point 0, 0, 10'], 'Measure must retain the preselected corner');
  assert.deepEqual(seeded.selection.selection.vertices ?? [], []);

  f.phase = 'pick the opposite corner and measure the diagonal';
  await pickCorner(points[1]);
  await panel.getByText('BETWEEN', { exact: true }).waitFor();
  assert.equal(await metric('To').innerText(), 'Point 30, 40, 10');
  assert.equal(await metric('Distance').innerText(), '50 mm');
  await f.page.waitForFunction(() => window.__studioOverlayTexts?.()['measure:label']?.includes('50 mm'));
  const after = await f.snapshot('vertices-measured');
  assert.deepEqual(after.overlay, ['50 mm']);
  assert.deepEqual(after.doc, before.doc);
  assert.deepEqual(after.history, before.history);
  assert.deepEqual(after.bodies, before.bodies);
  assert.deepEqual(f.report.downloads, []);
});
