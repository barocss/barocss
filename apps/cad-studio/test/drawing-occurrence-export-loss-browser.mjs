import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const fixture = 'apps/cad-studio/test/fixtures/assembly-cut.bcad';
const pins = [
  fixture, 'apps/cad-studio/test/drawing-occurrence-export-loss-browser.mjs',
  'apps/cad-studio/src/ui/DrawingWorkspace.tsx', 'apps/cad-studio/src/ui/drawing/ExportActions.tsx',
  'apps/cad-studio/src/ui/drawing/occurrenceLoss.ts', 'packages/barocss-cad-model/src/drawing/dimensionReferences.ts',
];
const f = await createFlow({
  name: 'drawing-occurrence-export-loss', output: process.argv[2], envFrozen: 'D1032_SOURCE_FROZEN',
  qualification: 'Hidden and deleted dimension owners are reported before SVG, PDF and DXF export.',
  limits: ['An A4 Assembly sheet with two named diameter references.'],
  initialFiles: pins, requiredFrozen: pins,
});
const button = (name, within = f.page) => within.getByRole('button', { name, exact: true });
const mode = name => button(name, f.page.locator('.mode')).click();
const drawing = () => f.page.getByRole('complementary', { name: 'Drawing settings', exact: true });
const instance = () => f.page.getByRole('complementary', { name: 'Instance', exact: true });
const warning = () => f.page.getByRole('status', { name: 'Drawing occurrence references', exact: true });
const confirmation = () => f.page.getByRole('group', { name: 'Confirm drawing export', exact: true });
const captureCount = () => f.page.evaluate(() => window.__drawingLossCaptures.length);
const controls = ['SVG', 'PDF', 'DXF'];
const file = 'drawing-occurrence-export-loss.bcad';
const missing = [];

async function exportCheck(label, format, expectedLoss, confirm, dxfVersion = 'AC1015') {
  const index = await captureCount();
  await button('Export ' + format, drawing()).click();
  if (expectedLoss) {
    if (!(await confirmation().isVisible())) {
      missing.push({ label, format, notice: await warning().isVisible(), captured: await captureCount() - index });
      return;
    }
    assert.equal(await captureCount(), index);
    await f.page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Confirm drawing export');
    assert.match(await confirmation().textContent(), expectedLoss);
    await f.snapshot(label + '-' + format.toLowerCase());
    if (!confirm) {
      await button('Cancel', confirmation()).click();
      assert.equal(await captureCount(), index);
      return;
    }
    await button('Export ' + format + ' without the listed dimensions', confirmation()).click();
  }
  await f.page.waitForFunction(i => window.__drawingLossCaptures.length === i + 1, index);
  const captured = await f.page.evaluate(async i => {
    const { name, blob } = window.__drawingLossCaptures[i];
    return { name, mime: blob.type, bytes: Array.from(new Uint8Array(await blob.arrayBuffer())) };
  }, index);
  const bytes = Buffer.from(captured.bytes);
  assert.ok(captured.name.endsWith('.' + format.toLowerCase()));
  assert.ok(bytes.length > 100);
  if (format === 'SVG') {
    assert.ok(bytes.includes('data-dim="d1"'));
    assert.equal(bytes.includes('data-dim="d2"'), !expectedLoss);
  } else if (format === 'PDF') assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  else {
    assert.match(bytes.toString(), /SECTION[\r\n]+\s*2[\r\n]+HEADER/);
    assert.ok(bytes.includes(dxfVersion));
  }
  f.report.files.push({ label, format, sha256: sha256(bytes), size: bytes.length });
  await f.persist();
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
    { id: 'd2', view: 'top', kind: 'diameter', edge: 'p2/n1.bottom|n2.side0#1', near: [56,20,5], place: [80,20] },
  ] };
  const [open] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await open.setFiles({ name: file, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.page.waitForFunction(() => window.__studioDoc.drawing?.dimensions.length === 2);
  await f.ready();
  const stock = await f.doc();
  const plate2 = () => f.page.locator('.ol.instance:not(.nested)').filter({ hasText: 'Plate 2' }).first();

  f.phase = 'Visible plate control';
  await mode('Drawing');
  await f.page.waitForFunction(() => window.__studioDrawing?.()?.dimensions.every(d => d.value));
  assert.equal(await warning().count(), 0);
  for (const format of controls) await exportCheck('shown', format, null, true);

  f.phase = 'Hide the referenced plate and check the pre-export warning';
  await mode('Model');
  await plate2().click();
  await button('Hide', instance()).click();
  await f.changed(stock);
  const hidden = await f.doc();
  await mode('Drawing');
  await f.page.waitForFunction(() => window.__studioDrawing?.()?.dimensions.find(d => d.id === 'd2')?.lost);
  await exportCheck('hidden', 'SVG', /Plate 2.*hidden/i, false);
  if (await warning().isVisible()) assert.match(await warning().textContent(), /Plate 2.*hidden/i);
  await f.undo(); await f.same(stock);
  await f.page.waitForFunction(() => window.__studioDrawing?.()?.dimensions.find(d => d.id === 'd2')?.value);
  assert.equal(await warning().count(), 0);
  await f.redo(); await f.same(hidden);
  await f.undo(); await f.same(stock);

  f.phase = 'Remove the referenced plate and compare all export warnings';
  await mode('Model');
  await plate2().click();
  await button('Remove', instance()).click();
  await f.changed(stock);
  const removed = await f.doc();
  await mode('Drawing');
  await f.page.waitForFunction(() => window.__studioDrawing?.()?.dimensions.find(d => d.id === 'd2')?.lost);
  for (const format of controls) await exportCheck('removed', format, /p2.*missing/i, true);
  if (!missing.length) {
    const index = await captureCount();
    await button('Export DXF', drawing()).click();
    await confirmation().waitFor();
    await drawing().getByLabel('DXF version', { exact: true }).selectOption('AC1009');
    await confirmation().waitFor({ state: 'detached' });
    assert.equal(await captureCount(), index);
    await exportCheck('removed-r12', 'DXF', /p2.*missing/i, true, 'AC1009');
  }
  await f.same(removed);
  assert.deepEqual(missing, [], 'export proceeded without warning');
  assert.deepEqual(f.report.downloads, []);
});
