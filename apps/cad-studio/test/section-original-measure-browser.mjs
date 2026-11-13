import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/section-original-measure-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/viewport/useViewportPicking.ts',
  'apps/cad-studio/src/ui/ViewContextMenu.tsx',
  'apps/cad-studio/src/ui/MeasurementInspector.tsx',
];
const f = await createFlow({
  name: 'section-original-measure',
  output: process.argv[2],
  envFrozen: 'D1013_SOURCE_FROZEN',
  qualification: 'Measure original faces of a settled Section and preserve the pair across a generated-cap pick.',
  limits: ['A settled desktop WebGPU exact section of two standalone rectangular bodies.'],
  snapshotExtra: () => ({
    section: window.__studioSection(),
    measurement: document.querySelector('[aria-label="Measurement"]')?.textContent ?? null,
    overlay: window.__studioOverlayTexts?.()['measure:label'] ?? [],
  }),
  initialFiles: pins,
  requiredFrozen: pins,
});
const doc = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [38, 20] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 20 },
    { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [10, 30], max: [50, 50] },
    { id: 'n3', kind: 'extrude', sketch: 2, height: 12 },
  ],
  outputs: { b1: { node: 1, side: 'solid' }, b3: { node: 3, side: 'solid' } }, nextId: 4,
};
const button = name => f.page.getByRole('button', { name, exact: true });
const menu = () => f.page.locator('.ctx-menu');
const item = name => menu().getByRole('menuitem', { name: new RegExp('^' + name + '(?:$| )') });
async function click(point, button = 'left') {
  const pixel = await f.page.evaluate(point => window.__studioScreenOf(point), point);
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel));
  await f.page.mouse.click(...pixel, { button });
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
  await chooser.setFiles({ name: 'section-source.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
  await button('Section view').click();
  await button('Section across X').click();
  await f.page.waitForFunction(() => window.__studioSection()?.exact && window.__studioSection().sources.join() === 'b1,b3');
  await button('View cube directions').click();
  await f.page.getByRole('menuitem', { name: 'Top left', exact: true }).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  const filter = button('Selection filter');
  for (let attempt = 0; attempt < 6 && !(await filter.innerText()).includes('Faces'); attempt++) await filter.click();
  assert.ok((await filter.innerText()).includes('Faces'));
  const panel = f.page.getByRole('complementary', { name: 'Measurement', exact: true });
  const topB = [38, 40, 12], topA = [34, 10, 20], capB = [25, 43, 6];
  const metric = name => panel.locator('.kv').filter({ hasText: new RegExp('^' + name) }).locator('b');

  f.phase = 'begin Measure from the original top of B in the context menu';
  await click(topB, 'right');
  await menu().waitFor();
  await item('Measure from here').click();
  await panel.waitFor();
  const initial = await f.snapshot('measure-from-original-b');
  assert.deepEqual(await metric('From').allInnerTexts(), ['Planar face']);
  assert.deepEqual(await metric('Area').allInnerTexts(), ['800 mm²']);
  assert.deepEqual(initial.doc, doc);

  f.phase = 'ignore a generated cap while the first measure face is pending';
  await click(capB);
  const pending = await f.snapshot('cap-left-ignored');
  assert.equal(pending.measurement, initial.measurement);
  assert.deepEqual(pending.overlay, []);
  await click(capB, 'right');
  await menu().waitFor();
  assert.equal(await menu().getAttribute('aria-label'), 'SECTION CAP');
  assert.equal(await item('Measure from here').count(), 0);
  await f.page.keyboard.press('Escape');
  await panel.waitFor();

  f.phase = 'complete the measurement on the original top of A';
  await click(topA);
  await panel.getByText('BETWEEN', { exact: true }).waitFor();
  assert.deepEqual(await metric('To').allInnerTexts(), ['Planar face']);
  assert.deepEqual(await metric('Area').allInnerTexts(), ['800 mm²', '760 mm²']);
  assert.equal(await metric('Distance').innerText(), '12.81 mm');
  assert.equal(await metric('Normal distance').innerText(), '8 mm');
  assert.equal(await metric('Angle').innerText(), '0°');
  await f.page.waitForFunction(() => window.__studioOverlayTexts?.()['measure:label']?.includes('12.81 mm'));
  const complete = await f.snapshot('measure-original-pair');
  assert.deepEqual(complete.doc, initial.doc);
  assert.deepEqual(complete.history, initial.history);
  assert.deepEqual(complete.section.planes, initial.section.planes);

  f.phase = 'keep the completed pair after another generated-cap pick';
  await click(capB);
  const repeated = await f.snapshot('cap-keeps-pair');
  assert.equal(repeated.measurement, complete.measurement);
  assert.deepEqual(repeated.overlay, ['12.81 mm']);
  assert.deepEqual(f.report.downloads, []);
});
