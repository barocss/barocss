import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const fixture = 'apps/cad-studio/test/fixtures/assembly-cut.bcad';
const pins = [
  fixture, 'apps/cad-studio/test/assembly-cut-path-trace-browser.mjs', 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/ui/RenderPanel.tsx', 'apps/cad-studio/src/viewport/instanceEvaluation.ts',
  'apps/cad-studio/src/state/useScenePoses.ts', 'apps/cad-studio/src/viewport/useRenderPlayback.ts',
];
const f = await createFlow({
  name: 'assembly-cut-path-trace', output: process.argv[2], envFrozen: 'D1025_SOURCE_FROZEN',
  qualification: 'A fresh Path tracing still uses the accepted assembly while the Model workspace retains its Assembly Cut draft.',
  limits: ['One circular through cut on two placed plates in Chrome desktop WebGPU at a fixed Top orthographic view.'],
  initialFiles: pins, requiredFrozen: pins,
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { placedDoc } from '@barocss/cad-model/engine/doc';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const volumes = doc.instances.map(instance => {
  const result = evaluateDoc(placedDoc(instance, doc), 1);
  if (!result.ok) throw Error(JSON.stringify(result.error));
  return [instance.id, result.bodies.reduce((total, body) => total + body.volume, 0)];
});
console.log(JSON.stringify(volumes));
`,
});
const button = (name, within = f.page) => within.getByRole('button', { name, exact: true });
const hud = () => f.page.getByRole('complementary', { name: 'Assembly cut', exact: true });
const mode = name => button(name, f.page.locator('.mode'));
const pick = name => f.page.locator('.ol.instance:not(.nested)').filter({ hasText: name }).first().click();
const probePoints = [[30, 20, 10], [35, 20, 10], [43, 20, 10]];
const delta = (a, b) => a.reduce((sum, value, k) => sum + Math.abs(value - b[k]), 0) / 3;

async function capture(label, doc) {
  // Keep the same selection so Render appearance outlines are identical across comparisons.
  await pick('Plate 2');
  await mode('Render').click();
  await hud().waitFor({ state: 'hidden' });
  await f.page.getByLabel('Render method', { exact: true }).selectOption('path-tracing');
  await button('Start path tracing').click();
  const samples = f.page.getByLabel('Path trace samples', { exact: true });
  await f.page.waitForFunction(() => Number.parseInt(document.querySelector('[aria-label="Path trace samples"]')?.textContent ?? '', 10) >= 28);
  await button('Stop path tracing').click();
  const sampleCount = Number.parseInt(await samples.innerText(), 10);
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const index = await f.page.evaluate(() => window.__traceCaptures.length);
  await button('Export image').click();
  await f.page.waitForFunction(index => window.__traceCaptures.length === index + 1, index);
  const result = await f.page.evaluate(async ([index, points]) => {
    const blob = window.__traceCaptures[index];
    const png = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const bitmap = await createImageBitmap(blob), canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d'), rect = document.querySelector('canvas.vp-canvas').getBoundingClientRect();
    ctx.drawImage(bitmap, 0, 0);
    const samples = points.map(point => {
      const [x, y] = window.__studioScreenOf(point);
      const a = Math.round((x - rect.left) * bitmap.width / rect.width), b = Math.round((y - rect.top) * bitmap.height / rect.height);
      const data = ctx.getImageData(a - 4, b - 4, 9, 9).data, rgb = [0, 0, 0];
      for (let i = 0; i < data.length; i += 4) for (let k = 0; k < 3; k++) rgb[k] += data[i+k] / 81;
      return { pixel: [a, b], rgb };
    });
    bitmap.close();
    return { png, samples, size: [canvas.width, canvas.height] };
  }, [index, probePoints]);
  const bytes = Buffer.from(result.png.split(',')[1], 'base64');
  await writeFile(join(f.output, label + '-export.png'), bytes);
  f.report.observations.push({ label, sha256: sha256(bytes), samples: result.samples, size: result.size, sampleCount });
  const state = await f.snapshot(label);
  assert.deepEqual(state.doc, doc);
  await mode('Model').click();
  return { ...result, hash: sha256(bytes) };
}

async function volumes(label, doc, radius) {
  const actual = await f.inspect(label, doc);
  assert.deepEqual(actual.map(([id]) => id), ['p1', 'p2']);
  for (const [, volume] of actual) assert.ok(Math.abs(volume - (12000 - 5 * Math.PI * radius ** 2)) < 1e-7);
  f.report.observations.push({ label, actual });
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
      window.__traceCaptures = [];
      const create = URL.createObjectURL, click = HTMLAnchorElement.prototype.click, blobs = new Map();
      URL.createObjectURL = function (blob) {
        const url = create.call(this, blob);
        if (blob.type === 'image/png') blobs.set(url, blob);
        return url;
      };
      HTMLAnchorElement.prototype.click = function () {
        const blob = blobs.get(this.href);
        if (!blob || !this.download.endsWith('.png')) return click.call(this);
        blobs.delete(this.href);
        window.__traceCaptures.push(blob);
      };
    });
    return context;
  };
  await f.newPage();
  const raw = JSON.parse(await readFile(join(f.repo, fixture), 'utf8'));
  const doc = { ...raw, nodes: [], outputs: {}, nextId: 0 };
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'assembly-cut-output.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
  const views = f.page.locator('.views');
  await button('Top', views).click();
  if (await button('Ortho', views).getAttribute('aria-pressed') === 'false') await button('Ortho', views).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await f.page.waitForFunction(() => !!window.__studioInstanceAt([30, 20, 10]));

  f.phase = 'capture stock and an unapplied new assembly cut';
  const stock = await capture('stock', doc);
  await volumes('stock-native', doc, 0);
  async function createDraft() {
    await pick('Plate 1');
    await clickModelCommand(f.page, 'Modify', 'Assembly cut');
    await hud().waitFor();
    await hud().getByLabel('Radius mm', { exact: true }).fill('4');
    for (const [axis, value] of [['X', '30'], ['Y', '20'], ['Z', '10']]) {
      await hud().getByLabel('Centre ' + axis, { exact: true }).fill(value);
    }
    await pick('Plate 2');
    await button('Add selected', hud()).click();
    await button('Cut', hud()).waitFor();
  }
  const waitPreview = async (x, expected) => {
    await f.page.waitForFunction(([x, expected]) => !!window.__studioInstanceAt([x, 20, 10]) === expected, [x, expected]);
  };
  await createDraft();
  await waitPreview(30, false);
  const pending = await capture('creation-draft', doc);
  await hud().waitFor();
  await waitPreview(30, false);
  await button('Cancel', hud()).click();
  await waitPreview(30, true);
  const cancelled = await capture('creation-cancelled', doc);

  f.phase = 'apply the through cut and capture its accepted path trace';
  await createDraft();
  await waitPreview(30, false);
  await button('Cut', hud()).click();
  await f.changed(doc);
  const appliedDoc = await f.doc();
  assert.equal(appliedDoc.assemblyCuts[0].profile.radius, 4);
  await volumes('applied-native', appliedDoc, 4);
  const applied = await capture('applied-eight', appliedDoc);

  f.phase = 'compare an unapplied diameter edit with the accepted path trace';
  await f.page.locator('button[aria-label^="Edit cut"]').first().click();
  await hud().getByLabel('Radius mm', { exact: true }).fill('6');
  await waitPreview(35, false);
  const editing = await capture('edit-draft-twelve', appliedDoc);
  await hud().waitFor();
  assert.equal(await hud().getByLabel('Radius mm', { exact: true }).inputValue(), '6');
  await waitPreview(35, false);
  await button('Cancel', hud()).click();
  await waitPreview(35, true);
  const editCancelled = await capture('edit-cancelled', appliedDoc);

  for (const shot of [pending, cancelled, applied, editing, editCancelled]) {
    assert.deepEqual(shot.size, stock.size);
    assert.deepEqual(shot.samples.map(s => s.pixel), stock.samples.map(s => s.pixel));
  }
  assert.ok(delta(stock.samples[0].rgb, applied.samples[0].rgb) > 35, 'applied bore must be visible in the path trace');
  const compare = (a, b, limit, message) => a.samples.forEach((sample, k) =>
    assert.ok(delta(sample.rgb, b.samples[k].rgb) <= limit, message + ' at probe ' + k));
  compare(pending, stock, 12, 'the creation draft must match stock');
  compare(cancelled, stock, 12, 'creation Cancel must match stock');
  compare(editing, applied, 12, 'the diameter edit draft must match applied Ø8');
  compare(editCancelled, applied, 12, 'edit Cancel must match applied Ø8');
  assert.deepEqual(f.report.downloads, []);
});
