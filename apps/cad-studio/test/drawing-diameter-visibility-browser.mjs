import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const fixture = 'apps/cad-studio/test/fixtures/assembly-cut.bcad';
const pins = [
  fixture, 'apps/cad-studio/test/drawing-diameter-visibility-browser.mjs',
  'apps/cad-studio/src/ui/DrawingWorkspace.tsx',
  'packages/barocss-cad-model/src/drawing/dimensions.ts', 'packages/barocss-cad-model/src/drawing/sheet.ts',
];
const f = await createFlow({
  name: 'drawing-diameter-visibility', output: process.argv[2], envFrozen: 'D1030_SOURCE_FROZEN',
  qualification: 'Top Diameter picks the visible or intentionally displayed rim in an assembly drawing.',
  limits: ['Two partially overlapping Ø8 bores, hidden rim at [26,20] and visible rim at [40,20].'],
  initialFiles: pins, requiredFrozen: pins,
});
const button = (name, within = f.page) => within.getByRole('button', { name, exact: true });
const mode = name => button(name, f.page.locator('.mode')).click();
const drawing = () => f.page.getByRole('complementary', { name: 'Drawing settings', exact: true });
const tools = () => f.page.getByRole('navigation', { name: 'Drawing tools', exact: true });

async function hover(u, v) {
  const point = await f.page.evaluate(([u,v]) => window.__studioDrawingAt('top', u, v), [u,v]);
  assert.ok(point);
  await f.page.mouse.move(point.x, point.y);
  return point;
}
async function click(u, v) {
  const p = await hover(u, v);
  await f.page.mouse.click(p.x, p.y);
}
const rim = () => f.page.locator('[aria-label="Drawing sheet"] .dw-hover path');
const preview = () => f.page.locator('[aria-label="Drawing sheet"] .dw-preview');
const dashed = () => f.page.locator('[aria-label="Drawing sheet"] g.view[data-view="top"] path[stroke-dasharray]');

async function pickDiameter(label, u, expected) {
  const base = await f.doc();
  await button('Diameter', tools()).click();
  await hover(u, 20);
  const shown = await rim().count();
  await click(u, 20);
  await hover(u, 55);
  if (expected) await preview().waitFor({ timeout: 5000 });
  const previewShown = await preview().count();
  await f.snapshot(label + '-preview');
  if (previewShown) {
    await click(u, 55);
    await f.changed(base);
  }
  const state = await f.doc();
  const dim = state.drawing.dimensions[0];
  const result = { label, shown, previewShown, edge: dim?.edge ?? null };
  f.report.observations.push(result);
  await f.persist();
  if (dim) { await f.undo(); await f.same(base); }
  await button('Select', tools()).click();
  if (expected) {
    assert.ok(previewShown > 0 && dim?.edge.startsWith(expected + '/'), JSON.stringify(result));
  }
  return result;
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
  const doc = JSON.parse(await readFile(join(f.repo, fixture), 'utf8'));
  const plate = doc.instances[0].doc;
  const holed = { ...plate, nodes: [...plate.nodes, { kind: 'hole', parent: { node: 1, side: 'solid' }, radius: 4, center: [30, 20], face: 'n1.top', id: 'n2' }],
    outputs: { b2: { node: 2, side: 'solid' } }, nextId: 3 };
  doc.instances[0].doc = holed;
  Object.assign(doc.instances[1], { doc: holed, position: [56, -10, 5] });
  doc.drawing = { sheet: 'A4', scope: { kind: 'assembly' }, projection: 'third', hidden: true, scale: 1, dimensions: [] };
  const [open] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await open.setFiles({ name: 'drawing-diameter-visibility.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.page.waitForFunction(() => window.__studioDoc.instances?.[1]?.position[0] === 56 && window.__studioDoc.drawing?.scope?.kind === 'assembly');
  await f.ready();
  await mode('Drawing');
  await f.page.waitForFunction(() => window.__studioDrawing?.()?.scale === 1);

  f.phase = 'Hidden lines enabled: the dashed lower rim and solid upper rim remain pickable';
  assert.ok(await dashed().count() > 0);
  await pickDiameter('hidden-on-lower', 26, 'p1');
  await pickDiameter('hidden-on-upper', 40, 'p2');

  f.phase = 'Hidden lines disabled: the visible rim stays pickable and the hidden rim cannot start a dimension';
  await drawing().getByLabel('Hidden lines', { exact: true }).uncheck();
  await f.page.waitForFunction(() => window.__studioDoc.drawing.hidden === false);
  await dashed().first().waitFor({ state: 'detached' });
  await pickDiameter('hidden-off-upper', 40, 'p2');
  const hidden = await pickDiameter('hidden-off-lower', 26);
  assert.deepEqual(hidden, { label: 'hidden-off-lower', shown: 0, previewShown: 0, edge: null });
  assert.deepEqual(f.report.downloads, []);
});
