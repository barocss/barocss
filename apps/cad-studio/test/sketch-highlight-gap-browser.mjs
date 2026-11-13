import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const { PNG } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright-core/lib/utilsBundle');
const pins = [
  'apps/cad-studio/test/sketch-highlight-gap-browser.mjs',
  'apps/cad-studio/src/ui/SketchMarks.tsx',
  'apps/cad-studio/src/ui/constraints.css',
  'apps/cad-studio/src/ui/SketchMobility.tsx',
  'packages/barocss-cad-model/src/sketch/select.ts',
];
const f = await createFlow({
  name: 'sketch-highlight-gap', output: process.argv[2], envFrozen: 'D1053_SOURCE_FROZEN',
  qualification: 'Keep background pixels between two highlighted Sketch lines at a 4 CSS px gap.',
  limits: ['Parallel horizontal edges at 1024 × 800, dark and light, DPR 1 and 2.'],
  initialFiles: pins, requiredFrozen: pins,
  inspectorSource: `
import assert from 'node:assert/strict';
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { profileOf } from '@barocss/cad-model/sketch/loops';
const result = profileOf([{ kind: 'polygon', closed: true, points: [[0,0],[54,0],[54,1.25],[0,1.25]], hv: { h: [0,2], v: [1,3] } }]);
assert.ok('node' in result);
console.log(JSON.stringify(withNode(emptyDoc(), result.node)));
`,
});
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const mark = (state, edge) => f.page.locator(`.vp-overlay .${state}[data-sketch-entity="edge:${edge}"]`);
const project = world => f.page.evaluate(world => window.__studioScreenOf(world), world);
const settle = () => f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
function minimumClearRows(neutral, active, dpr, clip, centers) {
  assert.equal(active.width, neutral.width);
  assert.equal(active.height, neutral.height);
  const [top, bottom] = centers.map(y => (y - clip.y) * dpr);
  return Math.min(...Array.from({ length: active.width }, (_, x) => {
    let clear = 0;
    for (let y = 0; y < active.height; y++) {
      if (y + 0.5 < top + dpr || y + 0.5 > bottom - dpr) continue;
      const i = (y * active.width + x) * 4;
      if ([0,1,2].every(channel => Math.abs(neutral.data[i + channel] - active.data[i + channel]) < 12)) clear++;
    }
    return clear;
  }));
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, viewport: { width: 1024, height: 800 }, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return url.origin === origin ? route.continue() : route.abort();
    });
    return context;
  };
  const doc = await f.inspect('parallel-source', {});
  for (const theme of ['dark', 'light']) {
    for (const dpr of [1, 2]) {
      const label = `${theme}-dpr${dpr}`;
      f.phase = label;
      await f.newPage({ deviceScaleFactor: dpr });
      assert.equal(await f.page.evaluate(() => devicePixelRatio), dpr);
      if (theme !== await f.page.locator('html').getAttribute('data-theme')) await button('Toggle light or dark theme').click();
      const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
      await chooser.setFiles({ name: 'parallel.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
      await f.same(doc);
      await button('Sketch · polygon', f.page.getByRole('group', { name: 'History', exact: true })).click();
      await button('Edit sketch', f.editor()).click();
      await f.sketchPanel().waitFor();
      await settle();
      const bottomWorld = [22, 0, 0], topWorld = [22, 1.25, 0];
      for (let attempt = 0; attempt < 6; attempt++) {
        const current = await project(bottomWorld), currentTop = await project(topWorld);
        const distance = current[1] - currentTop[1];
        if (Math.abs(distance - 4) < 0.03) break;
        await f.page.mouse.move(...current);
        await f.page.mouse.wheel(0, Math.log(distance / 4) / 0.0015);
        await f.page.waitForFunction(([world, y]) => Math.abs(window.__studioScreenOf(world)[1] - y) > 0.001
          || !Number.isFinite(y), [topWorld, currentTop[1]], { timeout: 3500 });
        await settle();
      }
      const top = await project(topWorld), bottom = await project(bottomWorld);
      const gap = bottom[1] - top[1];
      assert.ok(Math.abs(gap - 4) < 0.2, gap);
      const clip = { x: Math.floor(bottom[0]) - 26, y: Math.floor(top[1]) - 4, width: 44, height: 12 };
      const crop = async () => PNG.sync.read(await f.page.screenshot({ clip, scale: 'device' }));
      await f.page.mouse.move(bottom[0], bottom[1] + 60);
      await settle();
      const neutral = await crop();
      for (const point of [top, bottom]) {
        assert.ok(await f.page.evaluate(point => document.elementFromPoint(...point)?.matches('canvas.vp-canvas'), point));
      }
      await f.page.mouse.click(...top);
      await mark('on', 2).waitFor({ state: 'attached' });
      await f.page.mouse.move(...bottom);
      await mark('hover', 0).waitFor({ state: 'attached' });
      const hoverWidth = await mark('hover', 0).evaluate(el => getComputedStyle(el).strokeWidth);
      const hover = await crop();
      await f.page.keyboard.down('Shift');
      try { await f.page.mouse.click(...bottom); } finally { await f.page.keyboard.up('Shift'); }
      await mark('on', 0).waitFor({ state: 'attached' });
      const selectedWidth = await mark('on', 0).evaluate(el => getComputedStyle(el).strokeWidth);
      const both = await crop();
      await f.page.keyboard.down('Shift');
      try { await f.page.mouse.click(...bottom); } finally { await f.page.keyboard.up('Shift'); }
      assert.equal(await mark('on', 0).count(), 0);
      await mark('on', 2).waitFor({ state: 'attached' });
      await f.page.getByText('Active outline mobility', { exact: true }).click();
      await f.page.getByRole('listitem', { name: 'Locally movable edge 1', exact: true }).focus();
      await mark('inspected', 0).waitFor({ state: 'attached' });
      const inspectedWidth = await mark('inspected', 0).evaluate(el => getComputedStyle(el).strokeWidth);
      const inspected = await crop();
      const clear = [hover, both, inspected].map(image => minimumClearRows(neutral, image, dpr, clip, [top[1], bottom[1]]));
      f.report.observations.push({ label, gap, widths: [hoverWidth, selectedWidth, inspectedWidth], minClearDevicePx: clear });
      await f.snapshot(label + '-inspection');
      await f.page.keyboard.press('Escape');
      await mark('inspected', 0).waitFor({ state: 'detached' });
      await mark('on', 2).waitFor({ state: 'attached' });
      await f.same(doc);
    }
  }
  for (const { label, minClearDevicePx } of f.report.observations) {
    f.phase = label + ' gap';
    assert.ok(minClearDevicePx.every(value => value >= 1), JSON.stringify(minClearDevicePx));
  }
  assert.deepEqual(f.report.downloads, []);
});
