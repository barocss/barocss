import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const fixture = 'apps/cad-studio/test/fixtures/assembly-cut.bcad';
const pins = [
  fixture, 'apps/cad-studio/test/drawing-diameter-reattach-browser.mjs',
  'apps/cad-studio/src/ui/DrawingWorkspace.tsx', 'apps/cad-studio/src/ui/drawing/ExportActions.tsx',
  'apps/cad-studio/src/ui/drawing/occurrenceLoss.ts', 'packages/barocss-cad-model/src/drawing/dimensionReferences.ts',
];
const f = await createFlow({
  name: 'drawing-diameter-reattach', output: process.argv[2], envFrozen: 'D1034_SOURCE_FROZEN',
  qualification: 'An explicit rim selection reattaches a saved diameter and retains its sheet placement and history.',
  limits: ['One lost Ø12 Top dimension explicitly reattached to a visible Ø8 rim.'],
  initialFiles: pins, requiredFrozen: pins,
});
const button = (name, within = f.page) => within.getByRole('button', { name, exact: true });
const mode = name => button(name, f.page.locator('.mode')).click();
const drawing = () => f.page.getByRole('complementary', { name: 'Drawing settings', exact: true });
const instance = () => f.page.getByRole('complementary', { name: 'Instance', exact: true });
const file = 'drawing-diameter-reattach.bcad';
const command = () => button('Reattach diameter d2', drawing());
const preview = () => f.page.getByRole('group', { name: 'Confirm diameter reattachment', exact: true });
const project = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const lost = () => f.page.waitForFunction(() => window.__studioDrawing?.()?.dimensions.some(d => d.id === 'd2' && d.lost));
const pick = async (view, u, v) => {
  const p = await f.page.evaluate(([view,u,v]) => window.__studioDrawingAt(view,u,v), [view,u,v]);
  assert.ok(p);
  await f.page.mouse.click(p.x, p.y);
};
async function svgDiameter() {
  const index = await f.page.evaluate(() => window.__drawingLossCaptures.length);
  await button('Export SVG', drawing()).click();
  const svg = await f.page.evaluate(i => window.__drawingLossCaptures[i]?.blob.text(), index);
  assert.ok(svg);
  f.report.files.push({ label: 'reattached SVG', sha256: sha256(svg) });
  const result = await f.page.evaluate(svg => {
    const xml = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const groups = [...xml.querySelectorAll('g.dimension[data-dim="d2"]')];
    return groups.map(group => [...group.querySelectorAll('text')].map(node => node.textContent).join(' '));
  }, svg);
  assert.equal(result.length, 1);
  assert.match(result[0], /Ø8/);
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
    await context.addInitScript(() => {
      const urls = new Map(), create = URL.createObjectURL, click = HTMLAnchorElement.prototype.click;
      window.__drawingLossCaptures = [];
      URL.createObjectURL = function (blob) {
        const url = create.call(this, blob);
        urls.set(url, blob);
        return url;
      };
      HTMLAnchorElement.prototype.click = function () {
        const blob = urls.get(this.href);
        if (!blob || !/\.(svg|pdf|dxf)$/.test(this.download)) return click.call(this);
        window.__drawingLossCaptures.push({ name: this.download, blob });
        urls.delete(this.href);
      };
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
    { id: 'd2', view: 'top', kind: 'diameter', edge: 'p2/n1.bottom|n2.side0#1', near: [56,20,5], place: [80,20], tol: { kind: 'symmetric', value: 0.2 }, sig: { k: 'curve', p: [56,20,5], s: 0 }, was: 'p2/older-edge' },
  ] };
  const [open] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await open.setFiles({ name: file, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.page.waitForFunction(() => window.__studioDoc.drawing?.dimensions.length === 2);
  await f.ready();
  const stock = await f.doc();
  const plate2 = () => f.page.locator('.ol.instance:not(.nested)').filter({ hasText: 'Plate 2' }).first();

  f.phase = 'Remove the measured plate and start explicit reattachment';
  await plate2().click();
  await button('Remove', instance()).click();
  await f.changed(stock);
  let removed = await f.doc();
  await mode('Drawing');
  await lost();
  assert.equal(await command().count(), 1, 'lost diameter needs an explicit reattachment action');
  await command().click();
  await pick('front', 30, 5);
  assert.equal(await preview().count(), 0);
  await f.same(removed);
  await pick('top', 34, 20);
  await preview().waitFor();
  assert.match(await preview().textContent(), /Plate 1/);
  assert.match(await preview().textContent(), /Ø8/);
  await f.snapshot('candidate-plate-1');
  await f.same(removed);
  await button('Cancel', preview()).click();
  await preview().waitFor({ state: 'detached' });
  await pick('top', 34, 20);
  await pick('top', 75, 48);
  await f.same(removed);

  f.phase = 'Changing sheet settings retires the pending repair without arming Diameter';
  await command().click();
  await pick('top', 34, 20);
  await preview().waitFor();
  await drawing().getByLabel('Hidden lines', { exact: true }).uncheck();
  await preview().waitFor({ state: 'detached' });
  removed = await f.doc();
  assert.equal(removed.drawing.hidden, false);
  await pick('top', 34, 20);
  await pick('top', 75, 48);
  await f.same(removed);

  f.phase = 'Confirm the current rim and preserve dimension placement and tolerance';
  await command().click();
  await pick('top', 34, 20);
  await button('Reattach', preview()).click();
  await f.changed(removed);
  const rebound = await f.doc(), prior = removed.drawing.dimensions[1], dim = rebound.drawing.dimensions[1];
  assert.equal(dim.id, prior.id);
  assert.equal(dim.view, prior.view);
  assert.deepEqual(dim.place, prior.place);
  assert.deepEqual(dim.tol, prior.tol);
  assert.match(dim.edge, /^p1\//);
  assert.equal(dim.sig, undefined);
  assert.equal(dim.was, undefined);
  assert.deepEqual(rebound.drawing.dimensions[0], removed.drawing.dimensions[0]);
  await f.page.waitForFunction(() => Math.abs(window.__studioDrawing?.()?.dimensions.find(d => d.id === 'd2')?.value - 8) < 1e-6);
  await svgDiameter();
  await f.snapshot('reattached');
  await f.undo(); await f.same(removed); await lost();
  await f.redo(); await f.same(rebound);
  await f.page.waitForFunction(() => Math.abs(window.__studioDrawing?.()?.dimensions.find(d => d.id === 'd2')?.value - 8) < 1e-6);

  f.phase = 'Reopen the explicitly reattached diameter';
  await mode('Model');
  const attach = async () => {
    await button('Project and versions').click();
    await project().getByRole('textbox', { name: 'Browser project name', exact: true }).fill('D1034 Diameter Reattachment');
    await button('Project in this browser', project()).click();
    await project().getByLabel('Project', { exact: true }).waitFor();
  };
  await attach();
  await button('Save').click();
  await project().getByRole('list', { name: 'Project documents', exact: true }).getByText(file, { exact: true }).waitFor();
  await button('Close project', project()).click();
  await f.page.reload();
  await f.ready();
  await attach();
  await button('Open ' + file, project()).click();
  await f.same(rebound);
  await mode('Drawing');
  await f.page.waitForFunction(() => Math.abs(window.__studioDrawing?.()?.dimensions.find(d => d.id === 'd2')?.value - 8) < 1e-6);
  await svgDiameter();
  await f.snapshot('reopened-reattached');
  assert.deepEqual(f.report.downloads, []);
});
