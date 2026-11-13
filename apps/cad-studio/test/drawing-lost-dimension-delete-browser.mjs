import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const fixture = 'apps/cad-studio/test/fixtures/assembly-cut.bcad';
const pins = [
  fixture, 'apps/cad-studio/test/drawing-lost-dimension-delete-browser.mjs',
  'apps/cad-studio/src/ui/DrawingWorkspace.tsx', 'apps/cad-studio/src/ui/drawing/ExportActions.tsx',
  'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/drawing/DimensionsList.tsx',
];
const f = await createFlow({
  name: 'drawing-lost-dimension-delete', output: process.argv[2], envFrozen: 'D1033_SOURCE_FROZEN',
  qualification: 'DIMENSIONS deletes the current lost occurrence dimension after removal Redo.',
  limits: ['One Assembly sheet with a retained Ø8 and a lost Ø12 reference.'],
  initialFiles: pins, requiredFrozen: pins,
});
const button = (name, within = f.page) => within.getByRole('button', { name, exact: true });
const mode = name => button(name, f.page.locator('.mode')).click();
const drawing = () => f.page.getByRole('complementary', { name: 'Drawing settings', exact: true });
const instance = () => f.page.getByRole('complementary', { name: 'Instance', exact: true });
const file = 'drawing-lost-dimension-delete.bcad';

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
  const holed = (part, radius) => ({
    ...part, nodes: [...part.nodes, { kind: 'hole', parent: { node: 1, side: 'solid' }, radius, center: [30, 20], face: 'n1.top', id: 'n2' }],
    outputs: { b2: { node: 2, side: 'solid' } }, nextId: 3,
  });
  doc.instances[0].doc = holed(doc.instances[0].doc, 4);
  Object.assign(doc.instances[1], { doc: holed(doc.instances[1].doc, 6), position: [76, -10, 5], part: { id: 'wide-plate', rev: 'A' } });
  doc.drawing = { sheet: 'A4', scope: { kind: 'assembly' }, projection: 'third', hidden: true, dimensions: [
    { id: 'd1', view: 'top', kind: 'diameter', edge: 'p1/n1.bottom|n2.side0#2', near: [30,20,0], place: [8,20] },
    { id: 'd2', view: 'top', kind: 'diameter', edge: 'p2/n1.bottom|n2.side0#1', near: [56,20,5], place: [80,20] },
  ] };
  const [open] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await open.setFiles({ name: file, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.page.waitForFunction(() => window.__studioDoc.drawing?.dimensions.length === 2);
  await f.ready();
  const stock = await f.doc();
  const plate2 = () => f.page.locator('.ol.instance:not(.nested)').filter({ hasText: 'Plate 2' }).first();

  const lost = () => f.page.waitForFunction(() => window.__studioDrawing?.()?.dimensions.some(d => d.id === 'd2' && d.lost));
  f.phase = 'Remove the Ø12 occurrence and restore it once';
  await plate2().click();
  await button('Remove', instance()).click();
  await f.changed(stock);
  const removed = await f.doc();
  assert.deepEqual(removed.drawing.dimensions, stock.drawing.dimensions);
  await mode('Drawing');
  await lost();
  await f.undo();
  await f.same(stock);
  await f.page.waitForFunction(() => window.__studioDrawing?.()?.dimensions.find(d => d.id === 'd2')?.value);

  f.phase = 'Redo removal and delete the lost row from DIMENSIONS';
  await f.redo();
  await f.same(removed);
  await lost();
  const remove = button('Remove dimension d2', drawing());
  await remove.waitFor();
  await f.snapshot('after-redo-before-delete');
  await remove.click();
  const changed = await f.page.waitForFunction(() => window.__studioDoc.drawing.dimensions.length === 1, null, { timeout: 6000 }).then(() => true, () => false);
  await f.snapshot('after-dimensions-delete');
  assert.ok(changed, await f.page.locator('.toast').allTextContents());
  const deleted = await f.doc();
  assert.deepEqual(deleted, { ...removed, drawing: { ...removed.drawing, dimensions: [stock.drawing.dimensions[0]] } });
  assert.equal(await f.page.getByRole('status', { name: 'Drawing occurrence references', exact: true }).count(), 0);
  await f.undo();
  await f.same(removed);
  await lost();
  await f.redo();
  await f.same(deleted);
  await f.page.waitForFunction(() => window.__studioDrawing?.()?.dimensions.length === 1);
  await f.snapshot('redo-dimension-delete');
  assert.deepEqual(f.report.downloads, []);
});
