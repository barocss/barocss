import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { catalog } from './samples.mjs';
import { appendRecords, loadIndex, digest, recordKey, recordsFor } from './store.mjs';
import { createGallery } from './serve.mjs';
const sourceSha = '1'.repeat(40);
const folder = () => fs.mkdtempSync(path.join(os.tmpdir(), 'render-gallery-test-'));
test('immutable sample records reject conflicts, unsafe data and falsely verified model claims', () => {
  const root = folder();
  try {
    const samples = catalog(sourceSha); assert.deepEqual(appendRecords(root, samples), { added: 12, total: 12 });
    const original = fs.readFileSync(path.join(root, 'samples', recordKey(samples[0])+'.json'));
    const reorder = JSON.parse(JSON.stringify(samples[0])); reorder.spec.elements = Object.fromEntries(Object.entries(reorder.spec.elements).reverse());
    assert.deepEqual(appendRecords(root, [reorder]), { added: 0, total: 12 });
    assert.deepEqual(fs.readFileSync(path.join(root, 'samples', recordKey(samples[0])+'.json')), original);
    const conflict = structuredClone(samples[0]); conflict.title = 'Conflict'; assert.throws(() => appendRecords(root, [conflict]), /Conflicting/);
    for (const modify of [(r) => { r.spec.elements[r.spec.root].props.className = 'free'; },
      (r) => { r.source.path = '../../private'; }, (r) => { r.id = '../../escape'; },
      (r) => { r.spec.elements[r.spec.root].type = 'Image'; }]) {
      const invalid = structuredClone(samples[0]); modify(invalid); assert.throws(() => appendRecords(root, [invalid]));
    }
    const model = structuredClone(samples[0]); model.id = 'claimed-model'; model.source.kind = 'model-derived'; appendRecords(root, [model]);
    assert.equal(loadIndex(root).samples.length, 13); assert.equal(recordsFor(root).at(-1).source.kind, 'model-derived');
    const corrupt = path.join(root, 'samples', recordKey(samples[0])+'.json'); fs.appendFileSync(corrupt, 'corrupt'); assert.throws(() => loadIndex(root));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('actual gallery browsing/replay preserves controlled input, current action values and owned runtime', async () => {
  const root = folder(); const samples = catalog(sourceSha); appendRecords(root, samples);
  const model = structuredClone(samples[0]); model.id = 'claimed-model'; model.source.kind = 'model-derived'; appendRecords(root, [model]);
  let app;
  const require = createRequire(import.meta.url);
  const browser = await require('playwright-core').chromium.launch({ headless: true });
  try {
    app = await createGallery({ root });
    for (const width of [1200, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } }); const errors = [], external = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript(() => { window.CSP_EVENTS = []; document.addEventListener('securitypolicyviolation', (event) => window.CSP_EVENTS.push(event.violatedDirective)); });
      await page.route('**/*', (route) => { if (new URL(route.request().url()).origin !== app.url) { external.push('external'); return route.abort(); } return route.continue(); });
      await page.goto(app.url); await page.waitForFunction(() => window.GALLERY?.snapshot().sample);
      assert.equal(await page.getByRole('heading', { name: 'BaroCSS render design gallery', exact: true }).count(), 1);
      await page.getByLabel('Category', { exact: true }).selectOption('settings');
      assert.equal(await page.getByRole('navigation', { name: 'Samples' }).getByRole('button').count(), 2);
      await page.getByLabel('Search samples', { exact: true }).fill('no-such-sample');
      assert.equal(await page.getByRole('navigation', { name: 'Samples' }).getByRole('button').count(), 0);
      const form = samples.find((r) => r.id === 'creative-profile');
      assert.equal(await page.evaluate((r) => window.GALLERY.select(r.id, r.revision), form), true);
      await page.waitForFunction((id) => window.GALLERY.snapshot().sample.id === id, form.id);
      const input = Object.values(form.spec.elements).find((n) => n.type === 'Input'), button = Object.values(form.spec.elements).find((n) => n.type === 'Button');
      await page.locator(`[data-node-id="${input.props.id}"]`).fill('Edited 합성 값');
      await page.locator(`[data-node-id="${button.props.id}"]`).click();
      await page.waitForFunction(() => window.GALLERY.snapshot().actions.length === 1);
      const action = await page.evaluate(() => window.GALLERY.snapshot().actions[0]);
      assert.equal(action.name, button.on.press.action);
      assert.equal(input.props.value.$bindState.slice(1).split('/').reduce((v,k) => v[k], action.input), 'Edited 합성 값');
      assert.equal(await page.evaluate(() => window.GALLERY.select('missing', 1)), false);
      assert.equal(await page.evaluate(() => window.GALLERY.snapshot().sample.id), form.id);
      assert.equal(await page.evaluate(() => window.GALLERY.select('claimed-model', 1)), false);
      assert.match(await page.getByRole('alert').textContent(), /unverified/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.evaluate(() => { window.foreignRuntime = new BaroCSS.BrowserRuntime({ styleId: 'foreign-gallery', constructable: false, nonce: document.querySelector('meta[name="barocss-nonce"]').content }); });
      await page.evaluate(() => window.GALLERY.dispose());
      assert.equal(await page.locator('[data-node-id]').count(), 0);
      assert.equal(await page.evaluate(() => window.foreignRuntime.getStats().isDestroyed), false);
      await page.evaluate(() => window.GALLERY.mount()); await page.waitForFunction(() => document.querySelector('[data-node-id]'));
      await page.evaluate(() => { window.GALLERY.dispose(); window.foreignRuntime.destroy(); });
      assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(await page.evaluate(() => window.CSP_EVENTS), []);
      await page.close();
    }
    assert.equal((await fetch(app.url+'/../../etc/passwd')).status, 404);
    assert.equal((await fetch(app.url+'/api/index', { method: 'POST' })).status, 403);
  } finally { await browser.close(); await app?.close(); fs.rmSync(root, { recursive: true, force: true }); }
});
