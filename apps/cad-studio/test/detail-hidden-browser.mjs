// Desktop acceptance for #2408. Run under the heavy gate with D698_SOURCE_FROZEN=1.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2], repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
await mkdir(output, { recursive: true });
const seedFile = join(repo, 'packages/barocss-cad/conformance/r14/starter-plate/case.json');
const oracleFile = join(import.meta.dirname, 'detail-hidden-reader.py');
const { input: { document: seed } } = JSON.parse(await readFile(seedFile));
const point = z => ({ edge: 'n2.side0#1|n2.side0#2#2~sil', at: 'end', near: [36, 16, z] });
seed.drawing = {
  scope: { kind: 'part' }, sheet: 'A3', projection: 'third', scale: 1, hidden: true, views: ['front', 'top'],
  title: 'Starter plate visibility',
  details: [{ id: 'B', view: 'front', center: [36, 8], radius: 4, scale: 5, at: [330, 80] }],
  dimensions: [{ id: 'hole-side', view: 'detail:B', kind: 'linear', a: point(0), b: point(8), orient: 'vertical', place: [43, 4] }],
};
const fixture = join(output, 'starter-detail.bcad');
await writeFile(fixture, JSON.stringify(seed), { flag: 'wx' });

const f = await createFlow({
  name: 'detail-hidden', envFrozen: 'D698_SOURCE_FROZEN', output,
  qualification: 'One native starter-plate detail through same-sheet and split-sheet Hidden lines, history, fresh Open and real SVG/DXF 2000.',
  initialFiles: [import.meta.filename, seedFile, oracleFile, fixture],
  oracleSource: await readFile(oracleFile, 'utf8'),
  extraFrozen: ['packages/barocss-cad-model/src/drawing/sheet.ts', 'packages/barocss-cad-model/src/drawing/sheets.ts', 'packages/barocss-cad-model/src/io/svg.ts', 'packages/barocss-cad-model/src/io/dxf.ts'],
  limits: ['Capture local emitted bytes before browser file delivery.'],
});
const start = f.start;
f.start = async () => {
  await start();
  const newContext = f.browser.newContext.bind(f.browser);
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ body: '', contentType: 'text/css' });
      return route.abort();
    });
    await context.addInitScript(() => {
      const create = URL.createObjectURL, click = HTMLAnchorElement.prototype.click, blobs = new Map();
      window.__d698File = null;
      URL.createObjectURL = function (blob) {
        const url = create.call(this, blob);
        if (blob instanceof Blob) blobs.set(url, blob);
        return url;
      };
      HTMLAnchorElement.prototype.click = function () {
        const blob = blobs.get(this.href), name = this.download;
        if (!blob || !/\.(bcad|svg|dxf)$/.test(name)) return click.call(this);
        window.__d698File = blob.arrayBuffer().then(bytes => ({ name, bytes: [...new Uint8Array(bytes)] }));
        blobs.delete(this.href);
      };
    });
    return context;
  };
};

const button = name => f.page.getByRole('button', { name, exact: true });
const hiddenControl = () => f.page.getByLabel('Hidden lines', { exact: true });
const sheetSvg = 'svg[aria-label="Drawing sheet"]';
const detail = () => f.page.locator(`${sheetSvg} g.detail[data-view="detail:B"]`);
const front = () => f.page.locator(`${sheetSvg} g.view[data-view="front"]`);
const timeout = 60000;

async function open(file) {
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles(file);
  await f.page.waitForFunction(() => window.__studioDoc?.nodes?.length === 3, null, { timeout });
  await f.ready();
  await button('Drawing').click();
  await f.page.waitForSelector(sheetSvg);
}
async function tab(name) {
  const target = f.page.getByRole('tab', { name, exact: true });
  await target.click();
  assert.equal(await target.getAttribute('aria-selected'), 'true');
}
async function capture(command, label) {
  await f.page.evaluate(() => { window.__d698File = null; });
  await button(command).click();
  await f.page.waitForFunction(() => !!window.__d698File, null, { timeout });
  const { name, bytes } = await f.page.evaluate(() => window.__d698File);
  const file = join(output, label + '-' + name), buffer = Buffer.from(bytes);
  await writeFile(file, buffer, { flag: 'wx' });
  f.report.files.push({ label, name, sha256: sha256(buffer) });
  return { file, buffer };
}
async function toggle(value) {
  const before = await f.doc();
  await hiddenControl().setChecked(value);
  await f.changed(before);
  assert.deepEqual(await f.doc(), { ...before, drawing: { ...before.drawing, hidden: value } });
}
async function check(label, hidden, parent, withFiles = true) {
  f.phase = label;
  await detail().waitFor();
  assert.equal(await hiddenControl().isChecked(), hidden);
  const view = await f.page.evaluate(() => window.__studioDrawing());
  assert.deepEqual(view.details.map(({ id, view, scale, box }) => ({ id, view, scale, box })), [{ id: 'B', view: 'front', scale: 5, box: [310, 60, 350, 100] }]);
  assert.deepEqual(view.dimensions.map(d => ({ id: d.id, value: d.value })), [{ id: 'hole-side', value: 8 }]);
  const detailHidden = await detail().locator('line[stroke-dasharray="3 1.5"]').count();
  const frontHidden = await front().locator('line[stroke-dasharray="3 1.5"]').count();
  f.report.observations.push({ label, detailHidden, frontHidden, box: view.details[0].box, dimension: view.dimensions[0], projectedHiddenPieces: view.hidden.front });
  await f.persist();
  const svg = withFiles ? await capture('Export SVG', label) : null;
  const dxf = withFiles ? await capture('Export DXF', label) : null;
  assert.equal(detailHidden, Number(hidden), 'Detail hidden edge count');
  assert.equal(await front().count(), Number(parent));
  assert.equal(frontHidden, parent && hidden ? 2 : 0);
  assert.equal(await detail().locator('line[stroke-width="0.5"]').count(), 1);
  assert.equal(await detail().locator('path[stroke-width="0.25"]').count(), 1);
  assert.ok(view.hidden.front >= 2, 'raw projection retains the hidden pieces');
  assert.deepEqual((await f.doc()).drawing.dimensions, seed.drawing.dimensions);
  if (svg && dxf) await f.runOracle({ label, hidden, parent, svg: svg.file, dxf: dxf.file }, label);
}
async function assertParentMarker() {
  const marker = f.page.locator(`${sheetSvg} g.detail[data-view="front"]`);
  assert.match(await marker.textContent(), /SEE SHEET 2/);
  assert.equal(await detail().count(), 0);
}
async function save(label) {
  const file = await capture('Save', label);
  const doc = await f.doc();
  assert.deepEqual(JSON.parse(file.buffer), doc);
  return { file: file.file, doc };
}

await f.run(async () => {
  f.phase = 'Open starter plate';
  await open(fixture);
  const original = await f.doc();
  await check('same-on', true, true);
  await toggle(false);
  const off = await f.doc();
  await check('same-off', false, true);
  await f.snapshot('same-off');
  await f.undo();
  await f.same(original);
  await check('first-undo', true, true, false);
  await f.redo();
  await f.same(off);
  await check('first-redo', false, true, false);

  f.phase = 'Move Detail B to sheet 2';
  await button('Add sheet').click();
  await f.page.getByRole('tab', { name: 'Sheet 2', exact: true }).waitFor();
  const menu = f.page.locator('details[aria-label="Sheets"]');
  if (!(await menu.evaluate(el => el.open))) await menu.locator('summary').click();
  await f.page.getByLabel('Move Detail B to sheet', { exact: true }).selectOption('2');
  await tab('Sheet 1');
  await assertParentMarker();
  await tab('Sheet 2');
  await check('split-off', false, false);
  await toggle(true);
  await check('split-on', true, false);
  await f.snapshot('split-on');
  await tab('Sheet 1');
  await assertParentMarker();
  assert.equal(await front().locator('line[stroke-dasharray="3 1.5"]').count(), 2);

  await tab('Sheet 2');
  await toggle(false);
  const savedOff = await save('off');
  await open(savedOff.file);
  await f.same(savedOff.doc);
  await assertParentMarker();
  await tab('Sheet 2');
  await check('fresh-off', false, false);
  await toggle(true);
  const savedOn = await save('on');
  await open(savedOn.file);
  await f.same(savedOn.doc);
  await tab('Sheet 2');
  await check('fresh-on', true, false);
  assert.deepEqual((await f.doc()).nodes, original.nodes);
  assert.deepEqual(f.report.downloads, []);
});
