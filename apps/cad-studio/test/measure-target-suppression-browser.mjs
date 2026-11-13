import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const pins = [
  'apps/cad-studio/test/measure-target-suppression-browser.mjs', 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/viewport/useViewportPicking.ts', 'apps/cad-studio/src/ui/MeasurementInspector.tsx',
  'apps/cad-studio/src/ui/ViewContextMenu.tsx',
];
const f = await createFlow({
  name: 'measure-target-suppression', output: process.argv[2], envFrozen: 'D1035_SOURCE_FROZEN',
  qualification: 'An ordinary Measure face stays bound to its body through suppression and history.',
  limits: ['Three 20 × 12 × 8 mm native extrusions and two planar cap picks.'],
  initialFiles: pins, requiredFrozen: process.argv.includes('--fixed') ? [...pins, 'apps/cad-studio/src/app/measureTargets.ts'] : pins,
  snapshotExtra: () => ({
    measure: document.querySelector('[aria-label="Measurement"]')?.textContent ?? null,
    overlay: window.__studioOverlayTexts?.()['measure:label'] ?? [],
  }),
});
const source = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [[0,0], [26,16], [40,28]].flatMap(([x,z], i) => [
    { kind: 'sketch', profile: 'rectangle', min: [x,0], max: [x+20,12], id: 'n' + (2*i),
      ...(z ? { plane: { origin: [0,0,z], normal: [0,0,1], xAxis: [1,0,0] } } : {}) },
    { kind: 'extrude', sketch: 2*i, height: 8, id: 'n' + (2*i+1) },
  ]),
  outputs: { b1: { node: 1, side: 'solid' }, b3: { node: 3, side: 'solid' }, b5: { node: 5, side: 'solid' } }, nextId: 6,
};
const button = name => f.page.getByRole('button', { name, exact: true });
const panel = () => f.page.getByRole('complementary', { name: 'Measurement', exact: true });
const metric = label => panel().locator('.kv').filter({ hasText: new RegExp('^' + label + '\\b') }).locator('b');

async function cap(side, world) {
  await button('View cube directions').click();
  await f.page.getByRole('menuitem', { name: side, exact: true }).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await f.page.locator('.view-cube .vc-label').getByText(side.toUpperCase(), { exact: true }).waitFor();
  await f.page.waitForFunction(side => {
    const eye = window.__studioEye?.();
    return eye && (side === 'Top' ? eye[2] > 36 : eye[2] < 0);
  }, side);
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const pixel = await f.page.evaluate(world => window.__studioScreenOf(world), world);
  assert.ok(await f.page.evaluate(([x,y]) => !!document.elementFromPoint(x,y)?.closest('canvas.vp-canvas'), pixel), pixel);
  await f.page.mouse.click(...pixel);
}
async function readDistance(label, distance, normal) {
  await metric('Distance').getByText(distance + ' mm', { exact: true }).waitFor();
  assert.equal(await metric('Normal distance').innerText(), normal + ' mm');
  await f.page.waitForFunction(distance => window.__studioOverlayTexts?.()['measure:label']?.includes(distance + ' mm'), distance);
  await f.snapshot(label);
}
async function unavailable(label) {
  const state = await f.snapshot(label);
  const distance = (await metric('Distance').allTextContents())[0] ?? null;
  const status = await panel().getByRole('status').allTextContents();
  f.report.observations.push({ label, distance, status, overlay: state.overlay });
  await f.persist();
  return { distance, status, overlay: state.overlay };
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
  await chooser.setFiles({ name: 'measure-target-suppression.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);
  await clickModelCommand(f.page, 'Inspect', 'Measure');
  await panel().waitFor();
  await cap('Top', [10,6,8]);
  await panel().getByText('Planar face', { exact: true }).waitFor();
  await cap('Bottom', [30,6,16]);
  await readDistance('first-to-middle', '10', '8');

  f.phase = 'Suppress the selected middle body and then Undo and Redo';
  const feature = f.page.locator('.history .hs[data-node-index="3"]');
  await feature.click({ button: 'right' });
  await f.page.getByRole('menuitem', { name: 'Suppress', exact: true }).click();
  await f.changed(source);
  const suppressed = await f.doc();
  assert.equal(suppressed.nodes[3].suppressed, true);
  const first = await unavailable('suppressed');
  await f.undo(); await f.same(source);
  await readDistance('undo-restores-middle', '10', '8');
  await f.redo(); await f.same(suppressed);
  const redo = await unavailable('redo-suppressed');

  f.phase = 'Select the third body explicitly after the lost target';
  assert.equal(first.distance, null, JSON.stringify(first));
  assert.equal(redo.distance, null, JSON.stringify(redo));
  for (const state of [first, redo]) {
    assert.deepEqual(state.overlay, []);
    assert.match(state.status.join(' '), /To.*unavailable.*select/i);
  }
  await cap('Bottom', [52,6,28]);
  await readDistance('explicit-third', '28.28', '20');
  await f.same(suppressed);
  assert.deepEqual(f.report.downloads, []);
});
