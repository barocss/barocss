import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const webgl = process.argv.includes('--webgl2');
const pins = [
  'apps/cad-studio/test/visible-model-frame-browser.mjs', 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/viewport/Viewport.tsx', 'apps/cad-studio/src/viewport/modelFitArea.ts',
  'apps/cad-studio/src/viewport/gpuRenderer.ts', 'apps/cad-studio/src/viewport/renderer.ts',
];
const f = await createFlow({
  name: 'visible-model-frame', output: process.argv[2], envFrozen: 'D1043_SOURCE_FROZEN',
  qualification: 'Frame visible bodies after a hide and a Display panel transition.',
  limits: ['Desktop 900 × 760, two rectangular base solids and one placed rectangular solid.'],
  initialFiles: pins, requiredFrozen: pins,
});
const solid = node => ({ node, side: 'solid' });
const part = (min, max, height) => ({
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [{ kind: 'sketch', id: 'n0', profile: 'rectangle', min, max }, { kind: 'extrude', id: 'n1', sketch: 0, height }],
  outputs: { b1: solid(1) }, nextId: 2,
});
const source = part([0,0], [40,20], 10);
source.nodes.push({ kind: 'sketch', id: 'n2', profile: 'rectangle', min: [500,0], max: [540,20] }, { kind: 'extrude', id: 'n3', sketch: 2, height: 10 });
source.outputs.b3 = solid(3);
source.nextId = 4;
source.instances = [{ id: 'inst1', name: 'Far witness', doc: part([0,0], [40,20], 10), position: [900,0,0], rotation: [0,0,0] }];
const box = (a, b) => [a,b].flatMap(x => [0,20].flatMap(y => [0,10].map(z => [x,y,z])));
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const fit = () => f.page.getByTitle('Frame all (F)', { exact: true });
const settle = () => f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
async function read(world) {
  return f.page.evaluate(world => {
    const canvas = document.querySelector('canvas.vp-canvas');
    const points = world.map(p => window.__studioScreenOf(p));
    const bounds = selector => document.querySelector(selector)?.getBoundingClientRect().toJSON() ?? null;
    const x = points.map(p => p[0]), y = points.map(p => p[1]);
    return { left: Math.min(...x), right: Math.max(...x), top: Math.min(...y), bottom: Math.max(...y),
      blocked: points.filter(p => document.elementFromPoint(...p) !== canvas).length,
      display: bounds('.corner-right .previews'), rail: bounds('nav.toolbar'), viewCube: bounds('.view-cube') };
  }, world);
}
await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, viewport: { width: 900, height: 760 }, acceptDownloads: false, serviceWorkers: 'block' });
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
  await chooser.setFiles({ name: 'visible-model-frame.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);
  const browser = f.page.getByRole('complementary', { name: 'Browser', exact: true });
  f.phase = 'Hide one original body and one placed part through Browser';
  await button('Hide body', browser).nth(1).click();
  const placed = button('Far witness', browser);
  await placed.click();
  await button('Hide', f.page.getByRole('complementary', { name: 'Instance', exact: true })).click();
  await f.ready();
  const hidden = await f.doc();

  f.phase = 'Frame all with distant hidden geometry and the Display panel open';
  await button('Top').click();
  await button('Ortho').click();
  await button('Display and previews').click();
  await f.page.getByRole('group', { name: 'Display', exact: true }).waitFor();
  await fit().click();
  await settle();
  const withDisplay = await read(box(0,40));
  f.report.observations.push({ label: 'visible-only-with-display', ...withDisplay });
  await f.snapshot('visible-only-with-display');
  assert.equal(withDisplay.blocked, 0);
  assert.ok(withDisplay.right - withDisplay.left > 220, 'the visible solid must fill the work area after hiding both distant solids');
  assert.ok(withDisplay.display.top - withDisplay.bottom >= 10, 'the open Display panel must clear the framed solid');
  assert.ok(withDisplay.left - withDisplay.rail.right >= 10);
  assert.ok(hidden.bodies.b3.hidden && hidden.instances[0].hidden);
  await f.same(hidden);

  f.phase = 'Frame after closing Display and restoring both distant solids';
  await button('Display and previews').click();
  await fit().click();
  await settle();
  const closed = await read(box(0,40));
  assert.equal(closed.blocked, 0);
  assert.ok(closed.right - closed.left > 220);
  assert.ok(closed.top - withDisplay.top >= 10, 'closing Display releases vertical framing space');
  await f.same(hidden);
  await browser.getByRole('button', { name: 'Show body', exact: true }).click();
  if (!(await button('Show', f.page.getByRole('complementary', { name: 'Instance', exact: true })).isVisible())) await placed.click();
  await button('Show', f.page.getByRole('complementary', { name: 'Instance', exact: true })).click();
  await f.ready();
  const shown = await f.doc();
  await fit().click();
  await settle();
  const restored = await read([...box(0,40), ...box(500,540), ...box(900,940)]);
  assert.equal(restored.blocked, 0);
  const baseRestored = await read(box(0,40));
  assert.ok(baseRestored.right - baseRestored.left < closed.right - closed.left);
  f.report.observations.push({ label: 'display-closed', ...closed }, { label: 'all-visible', ...restored });
  await f.snapshot('restored-and-framed');
  await f.same(shown);
  assert.deepEqual(f.report.downloads, []);
});
