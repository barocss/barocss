import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const webgl = process.argv.includes('--webgl2');
const exactCorner = process.argv.includes('--exact-corner');
const pins = [
  'apps/cad-studio/test/rear-edge-picking-browser.mjs', 'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'apps/cad-studio/src/viewport/displayPolicy.ts', 'apps/cad-studio/src/viewport/gpuRenderer.ts', 'apps/cad-studio/src/viewport/renderer.ts',
  'packages/barocss-gpu/src/viewer/viewer.ts',
];
const f = await createFlow({
  name: 'rear-edge-picking', output: process.argv[2], envFrozen: 'D1046_SOURCE_FROZEN',
  qualification: 'Pick the original rear edge shown by X-ray and Wireframe while preserving front depth in Shaded.',
  limits: ['Desktop Front Ortho with two separated rectangular bodies whose screen projections overlap.'],
  initialFiles: pins, requiredFrozen: pins,
});
const solid = node => ({ node, side: 'solid' });
const source = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0,0], max: [60,25] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 40 },
    { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [17,80], max: [36,95] },
    { id: 'n3', kind: 'extrude', sketch: 2, from: 3, height: 15 },
  ],
  outputs: { b1: solid(1), b3: solid(3) }, nextId: 4,
};
const coincident = { ...source, nodes: source.nodes.map(node => {
  if (node.id === 'n2') return { ...node, min: [0,80], max: [36,95] };
  if (node.id === 'n3') return { ...node, from: 0 };
  return node;
}) };
const button = name => f.page.getByRole('button', { name, exact: true });
const selected = () => f.page.evaluate(() => window.__studioSelection.selection);
const settle = () => f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
const readAt = point => f.page.evaluate(point => window.__studioScreenOf(point), point);
async function open(doc) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'rear-edge-picking.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
  await button('Front').click();
  if (await button('Ortho').getAttribute('aria-pressed') !== 'true') await button('Ortho').click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await settle();
}
async function filter(text) {
  const control = button('Selection filter');
  for (let i = 0; i < 4; i++) {
    if ((await control.innerText()).includes(text)) return;
    await control.click();
  }
  assert.fail(text);
}
async function mode(name) {
  const control = f.page.getByLabel('CAD display mode', { exact: true });
  if (!(await control.isVisible())) await button('Display and previews').click();
  await control.selectOption({ label: name });
  await settle();
  assert.equal(await control.getAttribute('data-display-mode-supported'), 'true');
  await button('Display and previews').click();
  await settle();
}
async function pick(world, name, inset = [0,0]) {
  await f.page.keyboard.press('Escape');
  const point = (await readAt(world)).map((value, axis) => value + inset[axis]);
  assert.ok(await f.page.evaluate(point => !!document.elementFromPoint(...point)?.closest('canvas.vp-canvas'), point));
  await f.page.mouse.click(...point);
  const state = await f.snapshot(name);
  f.report.observations.push({ name, point, selection: state.selection.selection });
  await f.persist();
  return state.selection.selection;
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
  await open(source);
  const rear = [17,80,7];
  f.phase = 'Shaded preserves front depth at the rear edge pixel';
  await filter('Edges');
  assert.deepEqual((await pick(rear, 'shaded-edges')).edges, []);
  await filter('Pick all');
  assert.deepEqual((await pick(rear, 'shaded-front-face')).faces.map(face => face.body), [0]);
  const results = [];
  for (const name of ['X-ray', 'Wireframe']) {
    f.phase = name + ' rear edge and owner';
    await mode(name);
    for (const pickFilter of ['Edges', 'Pick all']) {
      await filter(pickFilter);
      const hit = await pick(rear, name.toLowerCase() + '-' + pickFilter.toLowerCase().replace(' ', '-'));
      results.push(hit);
    }
  }
  for (const hit of results) {
    assert.deepEqual(hit.edges.map(edge => edge.body), [1], 'the visible rear crease belongs to the second body');
    assert.deepEqual(hit.faces, []);
  }
  assert.ok(results.every(hit => hit.edges[0].edge === results[0].edges[0].edge));
  await f.same(source);

  f.phase = 'Coincident projected vertices keep the nearer owner';
  await open(coincident);
  await filter('Pick all');
  for (const name of ['Shaded with edges', 'X-ray', 'Wireframe']) {
    await mode(name);
    const hit = await pick([0,0,0], 'front-vertex-' + name.toLowerCase().replaceAll(' ', '-'), exactCorner ? [0,0] : [1,-1]);
    assert.deepEqual(hit.vertices, [{ body: 0, at: [0,0,0] }]);
  }
  await f.same(coincident);
  assert.deepEqual(await selected().then(s => s.edges), []);
  assert.deepEqual(f.report.downloads, []);
});
