// D577 / #2419. Run under the heavy gate from apps/cad-studio.
// D577_SOURCE_FROZEN=1 node test/render-image-ownership-browser.mjs EXTERNAL_OUTPUT --expect=repro|fixed
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(['--expect=repro', '--expect=fixed'].includes(mode));
const repro = mode === '--expect=repro';
const paths = ['checker.png', 'holes.png'].map(name => 'apps/cad-studio/test/fixtures/' + name);
const [imageA, imageB] = await Promise.all(paths.map(path => readFile(resolve(repo, path))));
const fixture = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [20, 10], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 5, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
};
const nativeBytes = Buffer.from(JSON.stringify(fixture));
const asPng = buffer => 'data:image/png;base64,' + buffer.toString('base64');
const pins = ['apps/cad-studio/test/render-image-ownership-browser.mjs', 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/ui/RenderPanel.tsx', ...paths];
const f = await createFlow({
  name: 'render-image-ownership', envFrozen: 'D577_SOURCE_FROZEN', output, qualification: 'D577 #2419 desktop',
  initialFiles: pins, requiredFrozen: pins,
  limits: ['Existing local PNG fixtures. Hold real browser bitmap outcomes without replacing them. Compare decoded RGBA and authored documents.'],
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    historyControls: ['Undo', 'Redo'].map(name => {
      const button = document.querySelector(`button[aria-label="${name}"]`);
      return { disabled: button.disabled, tip: button.getAttribute('data-tip') };
    }),
  }),
});
const button = name => f.page.getByRole('button', { name, exact: true });
const modeButton = name => f.page.locator('.mode').getByRole('button', { name, exact: true });
const input = kind => f.page.getByLabel(kind === 'texture' ? 'Texture image' : 'Environment image', { exact: true });
const imageOf = (doc, kind) => (kind === 'texture' ? doc.render?.defaultAppearance.texture : doc.render?.environment.map)?.image;

function installDecodeHold() {
  const decode = window.createImageBitmap;
  const held = new Map();
  const closed = [];
  const bitmapNames = new WeakMap();
  const closeBitmap = ImageBitmap.prototype.close;
  ImageBitmap.prototype.close = function () {
    const name = bitmapNames.get(this);
    if (name) closed.push(name);
    return closeBitmap.call(this);
  };
  window.createImageBitmap = function (source, ...options) {
    const decoded = decode.call(this, source, ...options);
    if (!(source instanceof File) || !source.name.startsWith('D577-')) return decoded;
    return new Promise((resolve, reject) => {
      decoded.then(bitmap => {
        bitmapNames.set(bitmap, source.name);
        held.set(source.name, { ok: true, deliver: () => resolve(bitmap) });
      }, error => held.set(source.name, { ok: false, deliver: () => reject(error) }));
    });
  };
  window.__d577Hold = {
    read: name => held.get(name)?.ok ?? null,
    release(name) {
      const entry = held.get(name);
      if (!entry) throw new Error('No held decode for ' + name);
      held.delete(name);
      entry.deliver();
    },
    closed: () => [...closed],
  };
}

async function open(kind) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'D577-box.bcad', mimeType: 'application/json', buffer: nativeBytes });
  await f.same(fixture);
  await modeButton('Render').click();
  if (kind === 'environment') await f.page.getByRole('tab', { name: 'Scene', exact: true }).click();
  await input(kind).waitFor({ state: 'attached' });
}
async function load(kind, name, buffer, ok = true) {
  await input(kind).setInputFiles({ name, mimeType: 'image/png', buffer });
  await f.page.waitForFunction(([name, ok]) => window.__d577Hold.read(name) === ok, [name, ok]);
}
const release = name => f.page.evaluate(name => window.__d577Hold.release(name), name);
const closed = () => f.page.evaluate(() => window.__d577Hold.closed());
const pixels = url => f.page.evaluate(async url => {
  const bitmap = await createImageBitmap(await (await fetch(url)).blob());
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    const rgba = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', rgba)), x => x.toString(16).padStart(2, '0')).join('');
    return { hash, width: bitmap.width, height: bitmap.height, transparent: rgba.some((v, i) => i % 4 === 3 && v < 255) };
  } finally { bitmap.close(); }
}, url);
const keptFields = ['doc', 'dirty', 'history', 'historyControls', 'selection', 'notices'];

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  f.report.runtimeOwnership = { nodePID: process.pid, serverURL: origin };
  f.report.fixtureHashes = { box: sha256(nativeBytes), imageA: sha256(imageA), imageB: sha256(imageB) };
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    try {
      await context.addInitScript(installDecodeHold);
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
        if (url.origin !== origin) return route.abort();
        return route.continue();
      });
      return context;
    } catch (error) {
      await context.close();
      throw error;
    }
  };

  for (const kind of ['texture', 'environment']) {
    f.phase = kind + ' two selections before either decode resolves';
    await f.newPage();
    await open(kind);
    const expectedA = await pixels(asPng(imageA)), expectedB = await pixels(asPng(imageB));
    assert.notEqual(expectedA.hash, expectedB.hash);
    assert.equal(expectedB.transparent, true);
    const a = 'D577-A.png', b = 'D577-B.png';
    await load(kind, a, imageA);
    await load(kind, b, imageB);
    const before = await f.snapshot(kind + '-before-release');
    await release(a);
    if (repro) await f.changed(fixture);
    else {
      await f.same(fixture);
      const afterA = await f.snapshot(kind + '-old-result-ignored');
      for (const field of keptFields) assert.deepEqual(afterA[field], before[field], field);
    }
    await release(b);
    if (repro) await f.waitToast(/Change not applied/);
    else await f.changed(fixture);
    const after = await f.snapshot(kind + '-latest-settled');
    const measured = await pixels(imageOf(after.doc, kind));
    assert.deepEqual(measured, repro ? expectedA : expectedB);
    assert.deepEqual(await closed(), [a, b]);
    assert.deepEqual(after.doc.nodes, fixture.nodes);
    assert.deepEqual(after.doc.outputs, fixture.outputs);
    if (kind === 'texture') {
      const thumbnail = f.page.locator('.render-panel img.texture-thumb');
      await thumbnail.waitFor();
      assert.deepEqual(await pixels(await thumbnail.getAttribute('src')), measured);
      assert.equal(after.doc.render.defaultAppearance.texture.scale, 20);
    } else assert.equal(after.doc.render.environment.map.intensity, 1);
    f.report.observations.push({ kind, outcome: 'two-selections', accepted: repro ? 'A' : 'B', pixels: measured, closed: await closed() });
    if (!repro) {
      assert.deepEqual(after.notices, before.notices);
      await button('Undo').click();
      await f.same(fixture);
      await button('Redo').click();
      await f.same(after.doc);
      if (kind === 'texture') {
        f.phase = 'stale and latest decode failures';
        const oldError = 'D577-old-invalid.png', newError = 'D577-new-invalid.png';
        await load(kind, oldError, Buffer.from('invalid PNG'), false);
        await load(kind, newError, Buffer.from('another invalid PNG'), false);
        await release(oldError);
        const stale = await f.snapshot('old-decode-error-ignored');
        assert.deepEqual(stale.doc, after.doc);
        assert.deepEqual(stale.notices, []);
        await release(newError);
        await f.waitToast(/Could not use that image/);
        const latest = await f.snapshot('latest-decode-error');
        assert.deepEqual(latest.doc, after.doc);
        assert.deepEqual(await pixels(imageOf(latest.doc, kind)), expectedB);
      }
    }
  }

  for (const [kind, ok] of [['texture', true], ['environment', false]]) {
    f.phase = kind + ' closes before decode delivery';
    await f.newPage();
    await open(kind);
    const name = ok ? 'D577-close-success.png' : 'D577-close-error.png';
    await load(kind, name, ok ? imageA : Buffer.from('invalid PNG'), ok);
    await modeButton('Model').click();
    await f.page.locator('.render-panel').waitFor({ state: 'detached' });
    const before = await f.snapshot(kind + '-closed-pending');
    await release(name);
    if (repro && ok) await f.changed(fixture);
    if (repro && !ok) await f.waitToast(/Could not use that image/);
    const after = await f.snapshot(kind + '-closed-settled');
    if (!repro) for (const field of keptFields) assert.deepEqual(after[field], before[field], field);
    if (ok) assert.deepEqual(await closed(), [name]);
    f.report.observations.push({ kind, outcome: 'closed', decodeOk: ok, applied: !!imageOf(after.doc, kind), notices: after.notices, closed: await closed() });
  }

  f.report.productResult = repro ? 'FAIL' : 'PASS';
  assert.deepEqual(f.report.downloads, []);
});
