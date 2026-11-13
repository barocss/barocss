import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const webgl = process.argv.includes('--webgl2');
const theme = process.argv.includes('--light') ? 'light' : 'dark';
const narrow = process.argv.includes('--narrow');
const dpr = narrow ? 2 : 1;
const viewport = narrow ? { width: 1024, height: 800 } : { width: 1440, height: 900 };
const { PNG } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright-core/lib/utilsBundle');
const pins = [
  'apps/cad-studio/test/adjacent-edge-gap-browser.mjs', 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/viewport/displayPolicy.ts', 'apps/cad-studio/src/viewport/gpuRenderer.ts',
  'apps/cad-studio/src/viewport/renderer.ts', 'packages/barocss-gpu/src/viewer/shaders/line.ts',
];
const f = await createFlow({
  name: 'adjacent-edge-gap', output: process.argv[2], envFrozen: 'D1045_SOURCE_FROZEN',
  qualification: 'A four CSS pixel model gap remains visible under independent edge selection and hover.',
  limits: ['Two 40 × 20 × 20 mm native boxes, 0.454 mm apart, orthographic Front.'],
  initialFiles: pins, requiredFrozen: pins,
});
const a = 40, b = 40.454;
const source = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [0,b].flatMap((x,i) => [
    { id: 'n' + 2*i, kind: 'sketch', profile: 'rectangle', min: [x,0], max: [x+40,20] },
    { id: 'n' + (2*i+1), kind: 'extrude', sketch: 2*i, height: 20 },
  ]),
  outputs: { b1: { node: 1, side: 'solid' }, b3: { node: 3, side: 'solid' } }, nextId: 4,
};
const button = name => f.page.getByRole('button', { name, exact: true });
const settle = () => f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
const selection = () => f.page.evaluate(() => window.__studioSelection.selection);
const screen = world => f.page.evaluate(world => window.__studioScreenOf(world), world);
async function filter(text) {
  const control = button('Selection filter');
  for (let i = 0; i < 4; i++) {
    if ((await control.innerText()).includes(text)) return;
    await control.click();
  }
  assert.fail(text);
}
function rgb(png, x, y) {
  return [...png.data.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 3)];
}
const different = (a, b) => Math.max(...a.map((v,i) => Math.abs(v - b[i]))) > 16;
async function crop(label, left, right) {
  await settle();
  const clip = { x: Math.floor(left[0]) - 8, y: Math.floor(left[1]) - 4, width: 22, height: 8 };
  const img = PNG.sync.read(await f.page.screenshot({ clip, scale: 'device' }));
  assert.equal(img.width, clip.width * dpr);
  const y = Math.floor(img.height / 2);
  const row = Array.from({ length: img.width }, (_, x) => rgb(img, x, y));
  const centers = [left,right].map(p => (p[0] - clip.x) * dpr);
  return { label, row, centers };
}
function countChanged(baseline, rendered, lo, hi) {
  return rendered.row.filter((p,i) => i + 0.5 >= lo && i + 0.5 < hi && different(p,baseline.row[i])).length;
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, viewport, deviceScaleFactor: dpr, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return url.origin === origin ? route.continue() : route.abort();
    });
    return context;
  };
  if (webgl) {
    f.context = await f.browser.newContext({});
    f.page = await f.context.newPage();
    f.page.on('pageerror', error => f.report.errors.push(error.stack ?? String(error)));
    f.page.on('console', message => { if (message.type() === 'error') f.report.consoleErrors.push(message.text()); });
    f.page.on('download', download => f.report.downloads.push({ suggestedFilename: download.suggestedFilename() }));
    await f.page.goto(f.server.resolvedUrls.local[0] + '?renderer=webgl2');
    await f.page.waitForSelector('.viewport[data-renderer="webgl2"]');
    await f.ready();
  } else await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'adjacent-edge-gap.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);
  if (theme !== await f.page.locator('html').getAttribute('data-theme')) await button('Toggle light or dark theme').click();
  await f.page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
  await button('Front').click();
  await button('Ortho').click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await filter('Edges');
  await settle();
  for (let attempt = 0; attempt < 8; attempt++) {
    const initialGap = (await screen([b,0,6]))[0] - (await screen([a,0,6]))[0];
    if (Math.abs(initialGap - 4) < 0.03) break;
    const anchor = await screen([(a+b)/2,0,6]);
    await f.page.mouse.move(...anchor);
    await f.page.mouse.wheel(0, Math.log(initialGap / 4) / 0.0015);
    await f.page.waitForFunction(([x, before]) => Math.abs(window.__studioScreenOf([x,0,6])[0] - window.__studioScreenOf([40,0,6])[0] - before) > 0.001, [b,initialGap]);
    await settle();
  }
  const center = await screen([(a+b)/2,0,6]);
  const left = await screen([a,0,6]), right = await screen([b,0,6]);
  const gap = right[0] - left[0];
  assert.ok(Math.abs(gap - 4) < 0.03, gap);
  for (const point of [left,right]) assert.ok(await f.page.evaluate(p => !!document.elementFromPoint(...p)?.closest('canvas.vp-canvas'), point));
  const clearHover = [center[0], center[1] + 145];
  await f.page.mouse.move(...clearHover);
  const base = await crop('clear', left, right);
  f.phase = 'Compare isolated hover with hover next to a selected edge';
  await f.page.mouse.move(right[0] + 0.75, right[1]);
  const hover = await crop('hover-only', left, right);
  await f.page.mouse.click(...left);
  await f.page.waitForFunction(() => window.__studioSelection.selection.edges[0]?.body === 0);
  assert.deepEqual((await selection()).edges.map(ref => ref.body), [0]);
  await f.page.mouse.move(right[0] + 0.75, right[1]);
  assert.equal(await f.page.locator('canvas.vp-canvas').evaluate(canvas => canvas.style.cursor), '', 'the pointer is clear of feature handles');
  const mixed = await crop('selected-hovered', left, right);
  await f.snapshot('selected-hovered');
  await f.page.keyboard.down('Shift');
  await f.page.mouse.click(right[0] + 0.75, right[1] + 20);
  await f.page.keyboard.up('Shift');
  await f.page.waitForFunction(() => window.__studioSelection.selection.edges.length === 2, null, { timeout: 5000 });
  assert.deepEqual((await selection()).edges.map(ref => ref.body).sort(), [0,1]);
  await f.page.mouse.move(...clearHover);
  const pair = await crop('both-selected', left, right);
  await f.snapshot('both-selected');
  const [lo,hi] = base.centers, mid = (lo + hi) / 2;
  const hoverPixels = countChanged(base, hover, mid, hi + 5*dpr);
  const mixedHoverPixels = countChanged(base, mixed, mid, hi + 5*dpr);
  const mixedGapPixels = hi - lo - countChanged(base, mixed, lo, hi);
  const selectedGapPixels = hi - lo - countChanged(base, pair, lo, hi);
  f.report.observations.push({ viewport, dpr, theme, backend: webgl ? 'webgl2' : 'webgpu', gap,
    hoverPixels, mixedHoverPixels, mixedGapPixels, selectedGapPixels, samples: [base,hover,mixed,pair] });
  await f.persist();
  assert.ok(hoverPixels >= dpr);
  assert.equal(mixedHoverPixels, hoverPixels, 'hover raster width is independent of selected edges');
  assert.ok(mixedGapPixels >= dpr * 0.9, 'selection and hover leave at least one CSS pixel of the original gap');
  assert.ok(selectedGapPixels >= dpr * 0.9, 'two selected edges leave at least one CSS pixel of the original gap');

  f.phase = 'Pick the adjacent faces individually without changing the model';
  await f.page.keyboard.press('Escape');
  await filter('Faces');
  for (const [world,body] of [[[20,0,10],0],[[b+20,0,10],1]]) {
    await f.page.mouse.click(...await screen(world));
    await f.page.waitForFunction(body => window.__studioSelection.selection.faces[0]?.body === body, body, { timeout: 5000 });
    assert.deepEqual((await selection()).faces.map(ref => ref.body), [body]);
  }
  await f.same(source);
  assert.deepEqual(f.report.downloads, []);
});
