import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/section-original-edge-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/viewport/useViewportPicking.ts',
  'apps/cad-studio/src/viewport/sectionEdgePick.ts',
  'apps/cad-studio/src/ui/ViewContextMenu.tsx',
  'apps/cad-studio/src/ui/MeasurementInspector.tsx',
];
const f = await createFlow({
  name: 'section-original-edge',
  output: process.argv[2],
  envFrozen: 'D1016_SOURCE_FROZEN',
  qualification: 'Bind a retained Section edge to its original edge and reject the new cut rim.',
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
  async function useFilter(name) {
    for (let attempt = 0; attempt < 6 && !(await filter.innerText()).includes(name); attempt++) await filter.click();
    assert.ok((await filter.innerText()).includes(name));
  }
  await button('View cube directions').click();
  await f.page.getByRole('menuitem', { name: 'Top right', exact: true }).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await useFilter('Edges');

  const panel = f.page.getByRole('complementary', { name: 'Measurement', exact: true });
  const original = [38, 10, 20], trimmed = [31, 20, 20], cutRim = [25, 40, 12], topB = [38, 40, 12];
  const metric = name => panel.locator('.kv').filter({ hasText: new RegExp('^' + name) }).locator('b');

  f.phase = 'select the fully retained top edge of A';
  await click(original);
  const left = await f.snapshot('retained-edge-left');
  assert.equal(left.selection.selection.edges[0]?.body, 0, 'the retained Section edge must select source A');
  await click(original, 'right');
  await menu().waitFor();
  const right = await f.snapshot('retained-edge-context');
  assert.equal(await menu().getAttribute('aria-label'), 'EDGE');
  assert.deepEqual(right.selection.selection.edges, left.selection.selection.edges);
  await item('Measure from here').click();
  await panel.waitFor();
  assert.equal(await metric('Length').innerText(), '20 mm');

  f.phase = 'refuse a trimmed edge that still shares its source name';
  await button('View cube directions').click();
  await f.page.getByRole('menuitem', { name: 'Top', exact: true }).click();
  const trimmedHit = await f.page.evaluate(point => window.__studioEdgeAt(point), trimmed);
  assert.equal(trimmedHit?.body, 0);
  await click(trimmed);
  const clipped = await f.snapshot('trimmed-edge-refused');
  assert.deepEqual(clipped.selection.selection.edges, []);
  assert.equal(await panel.locator('.measure-item').count(), 1);
  assert.deepEqual(clipped.overlay, []);
  await button('View cube directions').click();
  await f.page.getByRole('menuitem', { name: 'Top left', exact: true }).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();

  f.phase = 'ignore the new cut rim in Measure';
  const rimHit = await f.page.evaluate(point => window.__studioEdgeAt(point), cutRim);
  assert.equal(rimHit?.body, 1);
  await click(cutRim);
  const rim = await f.snapshot('cut-rim-ignored');
  assert.equal(await panel.locator('.measure-item').count(), 1);
  assert.deepEqual(rim.overlay, []);
  await click(cutRim, 'right');
  await menu().waitFor();
  assert.equal(await menu().getAttribute('aria-label'), 'SECTION CAP');
  assert.equal(await item('Measure from here').count(), 0);
  await f.page.keyboard.press('Escape');

  f.phase = 'complete Measure on the original top face of B';
  await useFilter('Faces');
  await click(topB);
  await panel.getByText('BETWEEN', { exact: true }).waitFor();
  assert.equal(await metric('Area').innerText(), '800 mm²');
  assert.equal(await metric('Distance').innerText(), '12.81 mm');
  const measured = await f.snapshot('original-edge-face-measured');
  assert.deepEqual(measured.doc, doc);
  assert.deepEqual(measured.history, left.history);
  assert.deepEqual(f.report.downloads, []);
});
