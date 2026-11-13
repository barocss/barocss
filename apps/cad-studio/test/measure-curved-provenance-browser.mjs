import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const pins = [
  'apps/cad-studio/test/measure-curved-provenance-browser.mjs', 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/ui/MeasurementInspector.tsx', 'packages/barocss-cad-model/src/app/measure.ts',
];
const f = await createFlow({
  name: 'measure-curved-provenance', output: process.argv[2], envFrozen: 'D1037_SOURCE_FROZEN',
  qualification: 'Cylinder Measure distinguishes the approximated surface distance from analytic geometry.',
  limits: ['Coaxial native cylinders R5 and R3 with a 5 mm axial gap.'],
  initialFiles: pins, requiredFrozen: process.argv.includes('--fixed') ? [...pins, 'apps/cad-studio/src/app/measureProvenance.ts'] : pins,
  snapshotExtra: () => ({
    measure: document.querySelector('[aria-label="Measurement"]')?.textContent ?? null,
    overlay: window.__studioOverlayTexts?.()['measure:label'] ?? [],
  }),
});
const source = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [5,3].flatMap((radius,i) => [
    { kind: 'sketch', profile: 'circle', center: [0,0], radius, id: 'n' + (2*i) },
    { kind: 'extrude', sketch: 2*i, height: 10, ...(i ? { from: 15 } : {}), id: 'n' + (2*i+1) },
  ]),
  outputs: { b1: { node: 1, side: 'solid' }, b3: { node: 3, side: 'solid' } }, nextId: 4,
};
const button = name => f.page.getByRole('button', { name, exact: true });
const panel = () => f.page.getByRole('complementary', { name: 'Measurement', exact: true });
const metric = label => panel().locator('.kv').filter({ hasText: new RegExp('^' + label + '\\b') }).locator('b');

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
  await chooser.setFiles({ name: 'measure-curved-provenance.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);

  f.phase = 'Pick both cylindrical walls and compare the shown method with the analytic oracle';
  await button('Front').click();
  await button('Ortho').click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await f.page.waitForFunction(() => (window.__studioEye?.()?.[1] ?? 0) < -3);
  await clickModelCommand(f.page, 'Inspect', 'Measure');
  const pick = async world => {
    const pixel = await f.page.evaluate(world => window.__studioScreenOf(world), world);
    assert.ok(await f.page.evaluate(([x,y]) => !!document.elementFromPoint(x,y)?.closest('canvas.vp-canvas'), pixel), pixel);
    await f.page.mouse.click(...pixel);
  };
  await pick([0,-5,5]);
  await panel().getByText('Curved face', { exact: true }).waitFor();
  await pick([0,-3,20]);
  await panel().getByText('BETWEEN', { exact: true }).waitFor();
  assert.deepEqual(await metric('Radius').allTextContents(), ['5 mm', '3 mm']);
  assert.match(await metric('Axes').innerText(), /coaxial/);
  const displayed = await metric('Distance').innerText();
  const state = await f.snapshot('coaxial-cylinder-walls');
  f.report.observations.push({ displayed, analyticDistance: Math.sqrt(29), overlay: state.overlay });
  await f.persist();
  assert.match(displayed, /5\.38 mm.*mesh approximation/i);
  assert.deepEqual(state.overlay, ['≈5.38 mm']);
  assert.match(await metric('Axes').innerText(), /mesh fit/i);
  await f.same(source);
  assert.deepEqual(f.report.downloads, []);
});
