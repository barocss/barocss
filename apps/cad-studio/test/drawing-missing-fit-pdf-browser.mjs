import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
assert.ok(['--baseline', '--fixed'].includes(mode));
const plate = 'packages/barocss-cad/conformance/r14/starter-plate/case.json';
const { input: { document: model } } = JSON.parse(await readFile(new URL('../../../' + plate, import.meta.url)));
const diameter = { id: 'd-fit', kind: 'diameter', view: 'top', edge: 'n1.top|n2.side0#1', near: [32, 16, 8], place: [58, 25] };
const drawing = { scope: { kind: 'part' }, sheet: 'A3', projection: 'third', scale: 2, hidden: false, title: 'Fit row check', views: ['front', 'top'], dimensions: [diameter] };
const missing = { ...model, fits: { version: 1, faces: [{ face: 'n2.side0', class: 'H7' }], tables: [] }, drawing };
const split = { ...missing, drawing: { ...drawing, sheets: [{ id: 's2', views: ['top'] }] } };
const table = { id: 'shop-H7', rows: [{ class: 'H7', over: 6, upTo: 10, upper: 0.015, lower: 0, estimate: true }] };
const files = [
  'apps/cad-studio/src/ui/DrawingWorkspace.tsx',
  'apps/cad-studio/src/ui/useDrawingSheet.ts',
  'packages/barocss-cad-model/src/drawing/issues.ts',
  'packages/barocss-cad-model/src/io/pdf.ts',
  'apps/cad-studio/test/drawing-missing-fit-pdf-browser.mjs',
  plate,
];
const f = await createFlow({
  name: 'drawing-missing-fit-pdf', output, envFrozen: 'D994_SOURCE_FROZEN', initialFiles: files, requiredFrozen: files,
  qualification: 'Prevent an unresolved fit from being delivered as a complete Drawing PDF.',
  snapshotExtra: () => ({ drawing: window.__studioDrawing?.(), captured: window.__d994Pdf?.length }),
});
const button = name => f.page.getByRole('button', { name, exact: true });
const pdf = async label => {
  await f.page.waitForFunction(() => window.__d994Pdf.length === 1);
  const [captured] = await f.page.evaluate(() => window.__d994Pdf);
  const bytes = Buffer.from(captured.bytes);
  assert.match(captured.name, /\.pdf$/);
  assert.equal(bytes.subarray(0, 8).toString(), '%PDF-1.4');
  const file = join(output, label + '.pdf');
  await writeFile(file, bytes);
  const info = execFileSync('pdfinfo', [file], { encoding: 'utf8' });
  assert.match(info, /^Pages:\s+1$/m);
  assert.match(info, /^Page size:.*\(A3\)/m);
  const text = Array.from(bytes.toString('latin1').matchAll(/\(((?:\\.|[^()\\])*)\) Tj/g), match =>
    match[1].replace(/\\([0-7]{3}|[()\\])/g, (_, escape) => escape.length === 3 ? String.fromCharCode(parseInt(escape, 8)) : escape),
  ).join('\n');
  f.report.observations.push({ label, sha256: sha256(bytes), bytes: bytes.length, text });
  return text;
};

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
    await context.addInitScript(doc => {
      if (doc && sessionStorage.getItem('d994-seeded') === null) {
        localStorage.setItem('studio.recovery', JSON.stringify({ fileName: 'fit-row-check', savedAt: Date.now(), doc }));
        sessionStorage.setItem('d994-seeded', '1');
      }
      const blobs = new Map(), create = URL.createObjectURL, click = HTMLAnchorElement.prototype.click;
      window.__d994Pdf = [];
      URL.createObjectURL = function (blob) {
        const url = create.call(this, blob);
        blobs.set(url, blob);
        return url;
      };
      HTMLAnchorElement.prototype.click = function () {
        if (!this.download.endsWith('.pdf') || !blobs.has(this.href)) return click.call(this);
        const name = this.download;
        void blobs.get(this.href).arrayBuffer().then(data => window.__d994Pdf.push({ name, bytes: [...new Uint8Array(data)] }));
      };
    }, missing);
    return context;
  };
  await f.newPage();
  f.phase = 'restore a previous drawing with an unresolved Ø8 H7 fit';
  await f.page.getByRole('dialog', { name: 'Recover unsaved work' }).getByRole('button', { name: 'Restore', exact: true }).click();
  await f.page.waitForFunction(() => window.__studioDoc?.fits?.faces?.[0]?.class === 'H7');
  await button('Drawing').click();
  await f.page.waitForFunction(() => window.__studioDrawing?.()?.issues.some(issue => issue.code === 'FIT_ROW_MISSING'));
  const before = await f.snapshot('drawing-missing-fit');
  assert.deepEqual(before.doc, missing);
  assert.match(before.drawing.dimensions[0].text, /8.*H7/);
  assert.doesNotMatch(before.drawing.dimensions[0].text, /0\.015/);

  f.phase = 'try PDF with an unresolved fit';
  await button('Export PDF').click();
  if (mode === '--baseline') {
    const text = await pdf('incomplete-fit');
    assert.match(text, /Ø8\s+THRU\s+H7/);
    assert.doesNotMatch(text, /missing|no limits|incomplete|0\.015/i);
    assert.fail('PDF delivered a fit class with no indication that its limits are missing');
  }
  const refused = f.page.getByRole('alert').filter({ hasText: 'PDF not written' });
  await refused.waitFor();
  assert.match(await refused.textContent(), /H7.*8 mm/i);
  assert.deepEqual(await f.doc(), missing);
  assert.equal(await f.page.evaluate(() => window.__d994Pdf.length), 0);
  await f.snapshot('pdf-refused-missing-fit');

  f.phase = 'load the covering fit table and read the actual exported PDF';
  await button('Model').click();
  await button('Library').click();
  await f.page.getByLabel('Fit table file', { exact: true }).setInputFiles({
    name: 'shop-H7.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(table)),
  });
  await f.page.waitForFunction(() => window.__studioDoc?.fits?.tables?.[0]?.id === 'shop-H7');
  await f.ready();
  await button('Drawing').click();
  await f.page.waitForFunction(() => {
    const sheet = window.__studioDrawing?.();
    return sheet?.dimensions[0]?.text?.includes('0.015') && !sheet.issues.some(issue => issue.code === 'FIT_ROW_MISSING');
  });
  await button('Export PDF').click();
  const text = await pdf('restored-fit');
  const limits = /Ø(\d+(?:\.\d+)?)\s+THRU\s+H7\s+\(([+\-]?[\d.]+)\/([+\-]?[\d.]+)\)\s+\(est\.\)/.exec(text);
  assert.ok(limits, text);
  const [diameterMM, upper, lower] = limits.slice(1).map(Number);
  assert.equal(diameterMM, 8);
  assert.equal(upper, table.rows[0].upper);
  assert.ok(lower >= table.rows[0].lower && lower <= 0.001 && lower < upper, 'printed interval stays inside the authored interval');
  assert.deepEqual(await f.doc(), { ...missing, fits: { ...missing.fits, tables: [table] } });
  await f.snapshot('pdf-restored-fit');
  f.phase = 'refuse a missing fit on an unselected continuation sheet';
  await button('Model').click();
  await f.page.evaluate(doc => localStorage.setItem('studio.recovery', JSON.stringify({ fileName: 'split-fit', savedAt: Date.now(), doc })), split);
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.page.getByRole('dialog', { name: 'Recover unsaved work' }).getByRole('button', { name: 'Restore', exact: true }).click();
  await f.page.waitForFunction(() => window.__studioDoc?.drawing?.sheets?.length === 1);
  await button('Drawing').click();
  await f.page.waitForFunction(() => {
    const sheet = window.__studioDrawing?.();
    return sheet?.dimensions.length === 0 && !sheet.issues.some(issue => issue.code === 'FIT_ROW_MISSING');
  });
  await button('Export PDF').click();
  await refused.waitFor();
  assert.match(await refused.textContent(), /Sheet 2.*H7.*8 mm/i);
  assert.equal(await f.page.evaluate(() => window.__d994Pdf.length), 0);
  await f.snapshot('split-pdf-refused-missing-fit');
  assert.deepEqual(f.report.downloads, []);
});
