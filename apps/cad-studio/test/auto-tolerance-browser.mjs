// Desktop acceptance for #2365. Run under the heavy gate with D696_SOURCE_FROZEN=1.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2], repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
await mkdir(output, { recursive: true });
const oracleFile = join(import.meta.dirname, 'auto-tolerance-reader.py');
const seedFile = join(import.meta.dirname, 'fixtures/bracket.bcad');
const seed = JSON.parse(await readFile(seedFile));
seed.nodes[0].max[0] = 40;
const fixture = join(output, 'tolerance-plate.bcad');
await writeFile(fixture, JSON.stringify(seed), { flag: 'wx' });

const f = await createFlow({
  name: 'auto-tolerance', envFrozen: 'D696_SOURCE_FROZEN', output,
  qualification: 'A 40 mm source-backed width through desktop Auto, tolerance edits, Undo/Redo, native Save/Open and drawing exports.',
  oracleSource: await readFile(oracleFile, 'utf8'),
  initialFiles: [import.meta.filename, oracleFile, seedFile, fixture],
  extraFrozen: ['packages/barocss-cad-model/src/drawing/auto.ts', 'packages/barocss-cad-model/src/drawing/layout.ts'],
  limits: ['One plate; captures local producer bytes before browser file delivery. External viewers and PDF are outside this run.'],
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
      window.__d696Files = {};
      URL.createObjectURL = function (blob) {
        const url = create.call(this, blob);
        if (blob instanceof Blob) blobs.set(url, blob);
        return url;
      };
      HTMLAnchorElement.prototype.click = function () {
        const blob = blobs.get(this.href), name = this.download;
        const suffix = name.split('.').at(-1);
        if (!blob || !['bcad', 'svg', 'dxf'].includes(suffix)) return click.call(this);
        window.__d696Files[suffix] = blob.arrayBuffer().then(bytes => ({ name, bytes: [...new Uint8Array(bytes)] }));
        blobs.delete(this.href);
      };
    });
    return context;
  };
};

const button = name => f.page.getByRole('button', { name, exact: true });
const row = index => f.page.locator('.dw-dims .dw-dim').nth(index);
const timeout = 60000;
const tol = { kind: 'symmetric', value: 0.05 };

async function openDrawing(file) {
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles(file);
  await f.page.waitForFunction(() => window.__studioDoc?.nodes?.length === 2, null, { timeout });
  await f.ready();
  await button('Drawing').click();
  await button('Auto-dimension').waitFor();
}

async function settled(count) {
  await f.page.waitForFunction(n => {
    const resolved = window.__studioDrawing?.()?.dimensions;
    const authored = window.__studioDoc?.drawing?.dimensions;
    return resolved?.length === n && authored?.length === n && resolved.every((d, i) => d.id === authored[i].id);
  }, count, { timeout });
  return f.page.evaluate(() => window.__studioDrawing().dimensions);
}

async function capture(command, suffix) {
  await button(command).click();
  await f.page.waitForFunction(key => !!window.__d696Files[key], suffix, { timeout });
  const { name, bytes } = await f.page.evaluate(key => window.__d696Files[key], suffix);
  const file = join(output, 'exported-' + name), buffer = Buffer.from(bytes);
  await writeFile(file, buffer, { flag: 'wx' });
  f.report.files.push({ name, hash: sha256(buffer), size: buffer.length });
  return { file, text: buffer.toString() };
}

const measure = ({ id: _id, place: _place, tol: _tol, ...rest }) => rest;
const model = ({ drawing: _drawing, ...rest }) => rest;

await f.run(async () => {
  f.phase = 'Open 40 mm plate and run Auto';
  await openDrawing(fixture);
  const baseline = await f.doc();
  await button('Auto-dimension').click();
  const resolved = await settled(3);
  const widthIndex = resolved.findIndex(d => d.value === 40);
  assert.ok(widthIndex >= 0);
  const before = await f.doc(), width = before.drawing.dimensions[widthIndex];
  assert.equal(width.kind, 'linear');
  assert.equal(width.auto, true);

  f.phase = 'Author symmetric tolerance and remove one unedited auto control';
  await row(widthIndex).click();
  await f.page.getByLabel('Tolerance', { exact: true }).selectOption('symmetric');
  const field = f.page.getByLabel('Tolerance ±', { exact: true });
  await field.fill('0.05');
  await field.press('Enter');
  await f.page.waitForFunction(id => window.__studioDoc.drawing.dimensions.find(d => d.id === id)?.tol?.value === 0.05, width.id, { timeout });
  await row((widthIndex + 1) % 3).getByRole('button', { name: /Remove dimension/ }).click();
  await settled(2);
  const authored = await f.doc();

  async function verify(label) {
    const doc = await f.doc(), matching = doc.drawing.dimensions.filter(d => isDeepStrictEqual(measure(d), measure(width)));
    const live = await f.page.evaluate(id => {
      const group = document.querySelector(`svg[aria-label="Drawing sheet"] [data-dim="${id}"]`);
      return { text: group?.textContent, read: window.__studioDrawing().dimensions.find(d => d.id === id) };
    }, width.id);
    f.report.observations.push({ label, matching, live });
    await f.persist();
    assert.equal(matching.length, 1, 'exactly one width with the original source references');
    assert.equal(matching[0].id, width.id, 'keep the original annotation ID');
    assert.deepEqual(matching[0].tol, tol);
    assert.equal(live.read.value, 40);
    assert.match(live.text, /40\s*±\s*0\.05/);
    assert.deepEqual(model(doc), model(baseline));
    return doc;
  }

  f.phase = 'Auto rerun retains authored width tolerance';
  await button('Auto-dimension').click();
  await settled(3);
  const rerun = await verify('rerun');
  await f.snapshot('rerun');

  f.phase = 'First Undo and Redo';
  await f.undo();
  await f.same(authored);
  await settled(2);
  await verify('undo');
  await f.redo();
  await f.same(rerun);
  await settled(3);
  await verify('redo');

  f.phase = 'Save bytes and fresh Open';
  const saved = await capture('Save', 'bcad');
  assert.deepEqual(JSON.parse(saved.text), rerun);
  await openDrawing(saved.file);
  await settled(3);
  await f.same(rerun);
  await verify('fresh-open');
  await f.snapshot('fresh-open');

  f.phase = 'SVG and DXF emission';
  const svg = await capture('Export SVG', 'svg');
  const dxf = await capture('Export DXF', 'dxf');
  await f.runOracle({ svg: svg.file, dxf: dxf.file, id: width.id }, 'independent-exports');
  await f.same(rerun);
  f.phase = 'Cancel a pending tolerance edit';
  const selectWidth = async () => {
    const index = (await settled(3)).findIndex(d => d.id === width.id);
    assert.ok(index >= 0);
    await row(index).click();
  };
  const tolerance = () => f.page.getByLabel('Tolerance', { exact: true });
  const enter = async (label, value, key = 'Enter') => {
    const input = f.page.getByLabel('Tolerance ' + label, { exact: true });
    await input.fill(value);
    await input.press(key);
  };
  const currentTolerance = async () => (await f.doc()).drawing.dimensions.find(d => d.id === width.id).tol;
  const auto = async () => {
    await f.dismissToasts();
    await button('Auto-dimension').click();
    await f.waitToast(/dimensions? placed/);
    await settled(3);
  };
  await selectWidth();
  await enter('±', '0.07', 'Escape');
  const symmetricField = f.page.getByLabel('Tolerance ±', { exact: true });
  assert.equal(await symmetricField.inputValue(), '0.05', 'Escape restores the accepted field value');
  await symmetricField.press('Tab');
  await f.same(rerun);
  f.phase = 'Invalid value, deviations, fit and explicit None';
  await enter('±', '-1');
  await f.page.getByText('A ± tolerance is a number above 0.', { exact: true }).waitFor();
  await f.same(rerun);

  await tolerance().selectOption('deviation');
  await enter('Upper', '0.10', 'Tab');
  await enter('Lower', '-0.02');
  await auto();
  assert.deepEqual(await currentTolerance(), { kind: 'deviation', upper: 0.10, lower: -0.02 });
  await selectWidth();
  await tolerance().selectOption('fit');
  await enter('Fit', 'H7');
  await auto();
  assert.deepEqual(await currentTolerance(), { kind: 'fit', code: 'H7' });
  await selectWidth();
  await tolerance().selectOption('none');
  await auto();
  assert.equal((await f.doc()).drawing.dimensions.some(d => d.tol), false);

  f.phase = 'Real source edit and repeated Auto';
  await selectWidth();
  await tolerance().selectOption('symmetric');
  await enter('±', '0.05');
  assert.deepEqual(await currentTolerance(), tol);
  await button('Model').click();
  await f.page.locator('.history .hs[data-node-index="1"]').click();
  const widthInput = f.editor().getByLabel('Width', { exact: true });
  assert.equal(await widthInput.inputValue(), '40');
  await widthInput.fill('48');
  await f.editor().getByRole('button', { name: 'Apply', exact: true }).click();
  await f.page.waitForFunction(() => window.__studioDoc.nodes[0].max[0] === 48, null, { timeout });
  await f.ready();
  await button('Drawing').click();
  await f.page.waitForFunction(id => window.__studioDrawing?.()?.dimensions.some(d => d.id === id && d.value === 48), width.id, { timeout });
  await auto();
  const resized = await settled(3);
  assert.deepEqual(resized.filter(d => d.value === 48).map(d => d.id), [width.id]);
  assert.deepEqual(await currentTolerance(), tol);
  assert.match(await f.page.locator(`svg[aria-label="Drawing sheet"] [data-dim="${width.id}"]`).textContent(), /48\s*±\s*0\.05/);
  assert.deepEqual(model(await f.doc()), { ...model(baseline), nodes: [{ ...baseline.nodes[0], max: [48, 12] }, baseline.nodes[1]] });
  await f.snapshot('source-edit');

  assert.deepEqual(f.report.downloads, []);
});
