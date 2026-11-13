import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const { PNG } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright-core/lib/utilsBundle');
const baseline = process.argv.includes('--baseline');
const backend = process.argv.includes('--webgl2') ? 'webgl2' : 'webgpu';
const pins = ['apps/cad-studio/test/direct-bezier-zoom-browser.mjs', 'apps/cad-studio/src/viewport/Viewport.tsx',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts', 'apps/cad-studio/src/viewport/gpuRenderer.ts', 'apps/cad-studio/src/viewport/renderer.ts',
  'packages/barocss-cad-model/src/engine/direct.ts'];
if (!baseline) pins.push('apps/cad-studio/src/viewport/directBezierDisplay.ts');
const f = await createFlow({
  name: 'direct-bezier-zoom', output: process.argv[2], envFrozen: 'D1149_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Compare a Direct quadratic raster and actual canvas selection after orthographic zoom.',
  limits: ['One centered quadratic in desktop Top Ortho, without a body behind it.'],
});
const button = name => f.page.getByRole('button', { name, exact: true });
const poles = [[-20, 0], [0, 40], [20, 0]];
const settle = () => f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
const clear = async () => { await f.page.evaluate(() => document.activeElement?.blur()); await f.page.keyboard.press('Escape'); await settle(); };
const visible = at => f.page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.classList.contains('vp-canvas'), at);

await f.run(async () => {
  await f.newPage();
  if (backend === 'webgl2') {
    await f.page.goto(f.server.resolvedUrls.local[0] + '?renderer=webgl2');
    await f.page.locator('.viewport[data-renderer="webgl2"]').waitFor();
    await f.ready();
  }
  await button('New part').click();
  await f.page.waitForFunction(() => window.__studioDoc?.nodes.length === 0);
  await f.ready();
  const source = await f.doc();
  await f.page.getByRole('navigation', { name: 'Tools', exact: true }).getByRole('button', { name: 'Sketch', exact: true }).click();
  await f.sketchPanel().waitFor();
  await f.tool('Bézier', 'b');
  await f.frame(poles);
  for (const pole of poles) await f.worldClick(pole);
  await f.sketchPanel().getByRole('button', { name: 'Make curves', exact: true }).click();
  await f.changed(source);
  await f.sketchPanel().waitFor({ state: 'hidden' });
  const direct = await f.doc();
  assert.equal(direct.direct.objects.length, 1);
  const [object] = direct.direct.objects;
  assert.match(direct.direct.sources[object.source], /control-points: \[\[-20,0,0\],\[0,40,0\],\[20,0,0\]\]/);
  const row = f.page.locator('.ol.direct');
  const selected = async () => (await row.getAttribute('class')).split(/\s+/).includes('sel');
  await button('Top').click();
  if (await button('Ortho').getAttribute('aria-pressed') !== 'true') await button('Ortho').click();
  await f.frame([[-20, 0], [0, 20], [20, 0]]);
  await clear();

  async function capture(label) {
    await settle();
    assert.equal(await selected(), false);
    const apex = await f.screenOf([0, 20]), middle = await f.screenOf([0, 40]);
    assert.ok(await visible(apex), JSON.stringify(apex));
    const heightCSS = 2 * Math.hypot(apex[0] - middle[0], apex[1] - middle[1]);
    const expectedOldGapCSS = heightCSS / (2 * 127 ** 2);
    const packet = await f.page.evaluate(({ id, controls }) => {
      const segments = window.__studioDirectSegments?.(id);
      if (!segments) return null;
      const screen = p => window.__studioProject(p);
      const projected = controls.map(p => screen([...p, 0]));
      // The corresponding chord point gives an upper bound on the nearest chord error.
      let maxErrorCSS = 0;
      const count = segments.length / 6;
      for (let i = 0; i < count; i++) {
        const a = screen(segments.slice(i * 6, i * 6 + 3)), b = screen(segments.slice(i * 6 + 3, i * 6 + 6));
        for (const u of [0, 0.25, 0.5, 0.75, 1]) {
          const t = (i + u) / count, s = 1 - t;
          const errors = [0, 1].map(axis => {
            const exact = s * s * projected[0][axis] + 2 * s * t * projected[1][axis] + t * t * projected[2][axis];
            return exact - (a[axis] + u * (b[axis] - a[axis]));
          });
          maxErrorCSS = Math.max(maxErrorCSS, Math.hypot(...errors));
        }
      }
      return { count, maxErrorCSS, endpoints: [segments.slice(0, 3), segments.slice(-3)] };
    }, { id: object.id, controls: poles });
    const png = PNG.sync.read(await f.page.screenshot());
    const x = Math.round(apex[0]), cyan = [];
    for (let y = Math.round(apex[1]) - 24; y <= Math.round(apex[1]) + 24; y++) {
      const offset = (y * png.width + x) * 4, [r, g, b] = png.data.subarray(offset, offset + 3);
      if (g > 110 && g > r + 45 && b > r + 60) cyan.push(y);
    }
    const rasterGapCSS = cyan.length ? Math.abs(cyan.reduce((sum, y) => sum + y + 0.5, 0) / cyan.length - apex[1]) : null;
    const lowLevelPick = await f.page.evaluate(() => window.__studioDirectAt([0, 20, 0]));
    await f.page.mouse.click(...apex);
    await settle();
    const metric = { label, backend, heightCSS, expectedOldGapCSS, rasterGapCSS, lowLevelPick, selected: await selected(), packet };
    f.report.observations.push(metric);
    await f.snapshot(label);
    return metric;
  }

  f.phase = 'select the converted curve and its endpoint at ordinary zoom';
  const fit = await capture('fit');
  assert.equal(fit.selected, true);
  const endpoint = await f.screenOf(poles[0]);
  await f.page.mouse.click(...endpoint);
  await f.page.locator('.pole-mark.picked').waitFor();
  await clear();

  f.phase = 'select the converted curve above four times ordinary zoom';
  const center = await f.screenOf([0, 20]);
  await f.page.mouse.move(...center);
  await f.page.mouse.wheel(0, -980);
  const medium = await capture('fourfold');
  assert.ok(medium.heightCSS >= 4 * fit.heightCSS);
  assert.equal(medium.selected, true);
  await clear();

  f.phase = 'click the analytic apex at precision zoom';
  for (let i = 0; i < 4; i++) {
    const center = await f.screenOf([0, 20]);
    assert.ok(await visible(center), JSON.stringify(center));
    await f.page.mouse.move(...center);
    const scalePoint = await f.screenOf([1, 20]);
    const scale = Math.hypot(center[0] - scalePoint[0], center[1] - scalePoint[1]);
    if (scale >= 5800) break;
    const wheel = Math.max(-1600, Math.log(scale / 6500) / 0.0015);
    await f.page.mouse.wheel(0, wheel);
    await settle();
  }
  const zoom = await capture('precision');
  assert.ok(zoom.expectedOldGapCSS > 6.5 && zoom.expectedOldGapCSS < 15, JSON.stringify(zoom));
  assert.deepEqual(f.report.downloads, []);
  await f.same(direct);
  if (baseline) {
    assert.ok(zoom.rasterGapCSS > 6, JSON.stringify(zoom));
    assert.equal(zoom.selected, false);
    assert.fail('The old Direct chord and actual click miss the analytic apex at precision zoom');
  }
  assert.equal(zoom.lowLevelPick, object.id);
  assert.equal(zoom.selected, true);
  assert.ok(zoom.rasterGapCSS !== null && zoom.rasterGapCSS <= 1.5, JSON.stringify(zoom));
  assert.ok(zoom.packet.count > fit.packet.count && zoom.packet.count <= 2048);
  assert.ok(zoom.packet.maxErrorCSS <= 0.25, JSON.stringify(zoom.packet));
  assert.deepEqual(zoom.packet.endpoints, [[-20, 0, 0], [20, 0, 0]]);
});
