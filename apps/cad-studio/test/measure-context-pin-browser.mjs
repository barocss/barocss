import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/measure-context-pin-browser.mjs', 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/viewport/useViewportPicking.ts', 'apps/cad-studio/src/ui/MeasurementInspector.tsx',
  'apps/cad-studio/src/ui/ViewContextMenu.tsx',
];
const f = await createFlow({
  name: 'measure-context-pin', output: process.argv[2], envFrozen: 'D1038_SOURCE_FROZEN',
  qualification: 'Measure from here can pin the same accepted opposite caps as Inspect Measure.',
  limits: ['Opposite native caps on one 20 × 12 × 8 mm Extrude.'],
  initialFiles: pins, requiredFrozen: [...pins, 'apps/cad-studio/src/app/measureTargets.ts'],
  snapshotExtra: () => ({
    measure: document.querySelector('[aria-label="Measurement"]')?.textContent ?? null,
    overlay: window.__studioOverlayTexts?.()['measure:label'] ?? [],
  }),
});
const part = (w,d,h) => ({
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [{ kind: 'sketch', profile: 'rectangle', min: [0,0], max: [w,d], id: 'n0' }, { kind: 'extrude', sketch: 0, height: h, id: 'n1' }],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
});
const source = part(20,12,8);
const button = name => f.page.getByRole('button', { name, exact: true });
const panel = () => f.page.getByRole('complementary', { name: 'Measurement', exact: true });
const metric = label => panel().locator('.kv').filter({ hasText: new RegExp('^' + label + '\\b') }).locator('b');

async function cap(side, world, mouseButton = 'left') {
  await button('View cube directions').click();
  await f.page.getByRole('menuitem', { name: side, exact: true }).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await f.page.locator('.view-cube .vc-label').getByText(side.toUpperCase(), { exact: true }).waitFor();
  await f.page.waitForFunction(side => {
    const eye = window.__studioEye?.();
    return eye && (side === 'Top' ? eye[2] > 8 : eye[2] < 0);
  }, side);
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const pixel = await f.page.evaluate(world => window.__studioScreenOf(world), world);
  assert.ok(await f.page.evaluate(([x,y]) => !!document.elementFromPoint(x,y)?.closest('canvas.vp-canvas'), pixel), pixel);
  await f.page.mouse.click(...pixel, { button: mouseButton });
}
async function readDistance(label, distance, normal) {
  await metric('Distance').getByText(distance + ' mm', { exact: true }).waitFor();
  assert.equal(await metric('Normal distance').innerText(), normal + ' mm');
  await f.page.waitForFunction(distance => window.__studioOverlayTexts?.()['measure:label']?.includes(distance + ' mm'), distance);
  await f.snapshot(label);
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
  await chooser.setFiles({ name: 'measure-context-pin.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);
  f.phase = 'Use the accepted native top face as the right-click Measure origin';
  await cap('Top', [10,6,8], 'right');
  await f.page.getByRole('menuitem', { name: /^Measure from here(?:$| )/ }).click();
  await panel().getByText('Planar face', { exact: true }).waitFor();
  await cap('Bottom', [10,6,0]);
  await readDistance('context-measure-eight', '8', '8');
  const pin = button('Pin measurement');
  assert.equal(await pin.count(), 1, 'right-click Measure must offer the native pin');
  await pin.click();
  const pinned = f.page.getByRole('complementary', { name: 'Pinned measurement', exact: true });
  await pinned.getByText('8 mm', { exact: true }).waitFor();
  await f.snapshot('pinned-eight');

  f.phase = 'Edit the native extrusion and confirm pin and independent selection';
  await f.openFeatureEditor(1, 'Extrude');
  await f.editor().getByLabel('Distance', { exact: true }).fill('13.25');
  const edited = await f.applyEditor(source, 'edited');
  assert.equal(edited.doc.nodes[1].height, 13.25);
  await pinned.getByText('13.25 mm', { exact: true }).waitFor();
  await f.closeEditor();
  await cap('Top', [10,6,13.25]);
  await f.page.waitForFunction(() => window.__studioSelection?.selection.faces.length === 1);
  await pinned.getByText('13.25 mm', { exact: true }).waitFor();
  await f.undo(); await f.same(source);
  await pinned.getByText('8 mm', { exact: true }).waitFor();
  await f.redo(); await f.same(edited.doc);
  await pinned.getByText('13.25 mm', { exact: true }).waitFor();
  await f.snapshot('pinned-after-redo');
  await pinned.getByRole('button', { name: 'Clear pinned measurement', exact: true }).click();
  await pinned.waitFor({ state: 'hidden' });
  await f.same(edited.doc);
  assert.deepEqual(f.report.downloads, []);
});
