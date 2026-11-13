import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/mixed-shift-pick-browser.mjs',
  'apps/cad-studio/src/viewport/useViewportPicking.ts',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'apps/cad-studio/src/ui/SelectionInspector.tsx',
];
const f = await createFlow({
  name: 'mixed-shift-pick', output: process.argv[2], envFrozen: 'D1048_SOURCE_FROZEN',
  qualification: 'Shift-click toggles faces and edges by type under the active filter.',
  limits: ['Desktop Front Ortho, two disjoint rectangular extrusions, no active feature.'],
  initialFiles: pins, requiredFrozen: pins,
});
const doc = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 20] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 20 },
    { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [60, 0], max: [100, 20] },
    { id: 'n3', kind: 'extrude', sketch: 2, height: 20 },
  ],
  outputs: { b1: { node: 1, side: 'solid' }, b3: { node: 3, side: 'solid' } }, nextId: 4,
};
const button = name => f.page.getByRole('button', { name, exact: true });
const settle = () => f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
async function filter(name) {
  const control = button('Selection filter');
  for (let i = 0; i < 4; i++) {
    if ((await control.innerText()).includes(name)) return;
    await control.click();
  }
  assert.fail(name);
}
async function pick(world, additive = false) {
  const point = await f.page.evaluate(world => window.__studioScreenOf(world), world);
  assert.ok(await f.page.evaluate(point => !!document.elementFromPoint(...point)?.closest('canvas.vp-canvas'), point));
  if (additive) await f.page.keyboard.down('Shift');
  try { await f.page.mouse.click(...point); }
  finally { if (additive) await f.page.keyboard.up('Shift'); }
  await settle();
  return f.page.evaluate(() => window.__studioSelection.selection);
}
const shape = s => ({ faces: s.faces, edges: s.edges, bodies: s.bodies });
const typed = (faces = [], edges = [], bodies = []) => ({ faces, edges, bodies });

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
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'mixed-shift-pick.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
  await button('Front').click();
  if (await button('Ortho').getAttribute('aria-pressed') !== 'true') await button('Ortho').click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await settle();

  const face = [15, 0, 8], edges = [[0, 0, 6], [60, 0, 6]];
  const faceOnly = shape(await pick(face));
  assert.deepEqual(faceOnly.faces.map(item => item.body), [0]);
  assert.deepEqual(faceOnly.edges, []);
  const edgeOnly = [];
  for (const [body, point] of edges.entries()) {
    const result = shape(await pick(point));
    assert.deepEqual(result.edges.map(item => item.body), [body]);
    assert.deepEqual(result.faces, []);
    edgeOnly.push(result);
  }
  const expected = [];
  for (const [body, point] of edges.entries()) {
    for (const faceFirst of [true, false]) {
      const label = `${body === 0 ? 'same' : 'different'}-body-${faceFirst ? 'face-edge' : 'edge-face'}`;
      const [first, second] = faceFirst ? [face, point] : [point, face];
      f.phase = label;
      await filter('Pick all');
      await pick(first);
      const mixed = shape(await pick(second, true));
      const summary = await f.page.getByRole('complementary', { name: 'Selection', exact: true }).locator('.card-title').first().textContent();
      await f.snapshot(label);
      const toggled = shape(await pick(second, true));
      f.report.observations.push({ label, mixed, summary, toggled });
      expected.push([label, mixed, typed(faceOnly.faces, edgeOnly[body].edges), summary, toggled, faceFirst ? faceOnly : edgeOnly[body]]);
    }
  }
  await filter('Faces');
  assert.deepEqual(shape(await pick(face)), faceOnly);
  await filter('Edges');
  const filtered = shape(await pick(edges[1], true));
  f.report.observations.push({ label: 'faces-then-edges-filter', selection: filtered });
  await filter('Bodies');
  assert.deepEqual(shape(await pick(face)), typed([], [], [0]));
  assert.deepEqual(shape(await pick(edges[1], true)), typed([], [], [0, 1]));
  assert.deepEqual(shape(await pick(face, true)), typed([], [], [1]));
  await f.same(doc);
  assert.deepEqual(f.report.downloads, []);
  await f.persist();
  for (const [label, mixed, selection, summary, toggled, first] of expected) {
    f.phase = label;
    assert.deepEqual(mixed, selection, label);
    assert.equal(summary, 'SELECTION · 1 FACE, 1 EDGE');
    assert.deepEqual(toggled, first, label + ' toggle');
  }
  assert.deepEqual(filtered, typed(faceOnly.faces, edgeOnly[1].edges));
});
