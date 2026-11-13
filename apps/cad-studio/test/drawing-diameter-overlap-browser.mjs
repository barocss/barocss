import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const fixture = 'apps/cad-studio/test/fixtures/assembly-cut.bcad';
const pins = [
  fixture, 'apps/cad-studio/test/drawing-diameter-overlap-browser.mjs',
  'apps/cad-studio/src/ui/DrawingWorkspace.tsx', 'apps/cad-studio/src/ui/drawing/diameterRims.ts',
  'packages/barocss-cad-model/src/drawing/dimensions.ts', 'packages/barocss-cad-model/src/drawing/sheet.ts',
];
const f = await createFlow({
  name: 'drawing-diameter-overlap', output: process.argv[2], envFrozen: 'D1031_SOURCE_FROZEN',
  qualification: 'Coincident Top Diameter rims require explicit occurrence selection.',
  limits: ['Two equal Ø8 rims with equal depth, then a raised control whose lower rim has no drawn pieces.'],
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
const preview = () => f.page.locator('[aria-label="Drawing sheet"] .dw-preview');


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
  Object.assign(doc.instances[1], { doc: holed, position: [50, -10, 0] });
  doc.drawing = { sheet: 'A4', scope: { kind: 'assembly' }, projection: 'third', hidden: true, scale: 1, dimensions: [] };
  const [open] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await open.setFiles({ name: 'drawing-diameter-overlap.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.page.waitForFunction(() => window.__studioDoc.instances?.[1]?.position[0] === 50 && window.__studioDoc.drawing?.scope?.kind === 'assembly');
  await f.ready();
  await mode('Drawing');
  await f.page.waitForFunction(() => window.__studioDrawing?.()?.scale === 1);

  const candidates = f.page.getByRole('group', { name: 'Choose diameter rim', exact: true });
  const ownerHint = f.page.locator('.dw-hint');
  const left = [27.5, 20 + Math.sqrt(9.75)], right = [32.5, 20 + Math.sqrt(9.75)];
  let stock = await f.doc();
  const missing = [];
  async function choose(label, point, owner) {
    await button('Diameter', tools()).click();
    await click(...point);
    const actual = await candidates.getByRole('button').allTextContents();
    f.report.observations.push({ label, options: actual });
    await f.persist();
    if (!actual.length) {
      await hover(47, 54);
      if (await preview().count()) {
        await click(47, 54);
        await f.changed(stock);
        missing.push((await f.doc()).drawing.dimensions.at(-1).edge);
        await f.undo(); await f.same(stock);
      }
      await f.snapshot(label);
      return;
    }
    assert.equal(actual.length, 2);
    assert.ok(actual.some(t => t.includes('Plate 1')) && actual.some(t => t.includes('Plate 2')));
    await f.same(stock);
    await hover(47, 54);
    assert.equal(await preview().count(), 0);
    await f.snapshot(label + '-choices');
    await candidates.getByRole('button', { name: new RegExp(owner.name) }).click();
    assert.match(await ownerHint.textContent(), new RegExp(owner.name));
    await click(47, 54);
    await f.changed(stock);
    const dim = (await f.doc()).drawing.dimensions.at(-1);
    assert.ok(dim.edge.startsWith(owner.id + '/'), dim.edge);
    await f.snapshot(label + '-placed');
    await f.undo();
    await f.same(stock);
  }

  f.phase = 'Choose either occurrence at opposite points on coincident visible rims';
  await choose('left-p1', left, { id: 'p1', name: 'Plate 1' });
  await choose('right-p2', right, { id: 'p2', name: 'Plate 2' });
  assert.deepEqual(missing, [], 'silent occurrence choices');

  f.phase = 'Cancel the chooser with Escape and keep the accepted document';
  await button('Diameter', tools()).click();
  await click(...right);
  await candidates.waitFor();
  await f.page.keyboard.press('Escape');
  await candidates.waitFor({ state: 'detached' });
  await f.same(stock);

  f.phase = 'Hide hidden lines while the visible rim chooser is open';
  await click(...right);
  await candidates.waitFor();
  await drawing().getByLabel('Hidden lines', { exact: true }).uncheck();
  await candidates.waitFor({ state: 'detached' });
  stock = await f.doc();
  assert.equal(stock.drawing.hidden, false);
  await choose('hidden-off-p1', right, { id: 'p1', name: 'Plate 1' });

  f.phase = 'A coincident lower rim without drawn pieces is excluded';
  await mode('Model');
  await f.page.locator('.ol.instance:not(.nested)').filter({ hasText: 'Plate 2' }).first().click();
  const z = f.page.getByRole('complementary', { name: 'Instance', exact: true }).getByLabel('Instance Z', { exact: true }).first();
  await z.fill('5');
  await z.press('Enter');
  await f.page.waitForFunction(() => window.__studioDoc.instances[1].position[2] === 5);
  const raised = await f.doc();
  await mode('Drawing');
  await f.page.waitForFunction(() => window.__studioDrawing?.()?.scale === 1);
  await button('Diameter', tools()).click();
  await click(...right);
  assert.equal(await candidates.count(), 0);
  assert.match(await ownerHint.textContent(), /Plate 2/);
  await click(47, 54);
  await f.changed(raised);
  assert.match((await f.doc()).drawing.dimensions.at(-1).edge, /^p2\//);
  await f.snapshot('raised-only-p2');
  assert.deepEqual(f.report.downloads, []);
});
