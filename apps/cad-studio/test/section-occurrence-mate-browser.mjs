import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/section-occurrence-mate-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/viewport/useViewportPicking.ts',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'apps/cad-studio/src/viewport/gpuRenderer.ts',
  'apps/cad-studio/src/assembly/useAssembly.ts',
  'apps/cad-studio/src/ui/MatePanel.tsx',
];
const f = await createFlow({
  name: 'section-occurrence-mate',
  output: process.argv[2],
  envFrozen: 'D1014_SOURCE_FROZEN',
  qualification: 'Keep a planar Mate draft on original occurrence faces while Section caps are visible.',
  limits: ['A desktop WebGPU Section through two translated instances of a rectangular solid.'],
  snapshotExtra: () => ({
    section: window.__studioSection(),
    matePanel: document.querySelector('[aria-label="Mates"]')?.textContent ?? null,
  }),
  initialFiles: pins,
  requiredFrozen: pins,
});
const part = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 20] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 12 },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
};
const doc = {
  ...part, nodes: [], outputs: {}, nextId: 0,
  instances: [
    { id: 'plate-a', name: 'Plate A', doc: part, position: [0, 0, 5], rotation: [0, 0, 0], grounded: true },
    { id: 'plate-b', name: 'Plate B', doc: part, position: [10, 30, 0], rotation: [0, 0, 0] },
  ],
};
const button = name => f.page.getByRole('button', { name, exact: true });
async function click(point) {
  const pixel = await f.page.evaluate(point => window.__studioScreenOf(point), point);
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
  await chooser.setFiles({ name: 'section-source.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
  const panel = f.page.getByRole('complementary', { name: 'Mates', exact: true });
  const stays = panel.locator('.mate-draft .kv').filter({ hasText: /^1 · Stays/ }).locator('b');
  const moves = panel.locator('.mate-draft .kv').filter({ hasText: /^2 · Moves/ }).locator('b');
  await f.page.locator('.outliner .ol.instance').filter({ hasText: 'Plate A' }).click();
  await panel.getByRole('button', { name: 'Add mate', exact: true }).click();
  await panel.getByLabel('Mate type', { exact: true }).selectOption('coincident');
  await panel.getByLabel('Mate flip', { exact: true }).setChecked(true);
  await button('Section view').click();
  await button('Section across X').click();
  await button('View cube directions').click();
  await f.page.getByRole('menuitem', { name: 'Top left', exact: true }).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();

  const capB = [25, 42, 6], topA = [34, 9, 17], topB = [38, 41, 12];
  const hit = point => f.page.evaluate(point => window.__studioInstanceAt(point), point);
  await f.page.waitForFunction(point => window.__studioInstanceAt(point)?.cap, capB);
  assert.equal((await hit(capB)).id, 'plate-b');
  assert.equal((await hit(topA)).id, 'plate-a');
  assert.equal((await hit(topB)).id, 'plate-b');

  f.phase = 'generated cap does not supply the first Mate face';
  await click(capB);
  const capFirst = await f.snapshot('mate-cap-first-refused');
  assert.equal(await stays.innerText(), 'click a face');
  assert.deepEqual(capFirst.doc, doc);

  f.phase = 'retained original top face supplies the first Mate face';
  await click(topA);
  await stays.getByText('Plate A · Top face', { exact: true }).waitFor();
  const original = await f.snapshot('mate-original-first');
  assert.deepEqual(original.doc, doc);

  f.phase = 'generated cap does not supply the second Mate face';
  await click(capB);
  const capSecond = await f.snapshot('mate-cap-second-refused');
  assert.equal(await stays.innerText(), 'Plate A · Top face');
  assert.equal(await moves.innerText(), 'click a face on another part');
  assert.deepEqual(capSecond.doc, doc);

  f.phase = 'complete Mate with the second original top face';
  await click(topB);
  await f.page.waitForFunction(() => window.__studioDoc.mates?.length === 1);
  const completed = await f.snapshot('mate-original-pair');
  assert.deepEqual(completed.doc.mates, [{
    id: 'm1', kind: 'coincident', a: { part: 'plate-a', face: 'n1.top' },
    b: { part: 'plate-b', face: 'n1.top' }, flip: true,
  }]);
  assert.deepEqual(completed.doc.instances[0], doc.instances[0]);
  assert.ok(Math.abs(completed.doc.instances[1].position[2] - 5) < 1e-9);
  assert.deepEqual(completed.doc.instances[1].doc, part);
  assert.deepEqual(f.report.downloads, []);
});
