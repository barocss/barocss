import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/sketch-edit-band-draft-history-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/app/bandControls.ts',
  'apps/cad-studio/src/sketch/draftHistory.ts',
  'apps/cad-studio/src/sketch/useSketchActions.ts',
];
const f = await createFlow({
  name: 'sketch-edit-band-draft-history',
  output: process.argv[2],
  envFrozen: 'D1068_SOURCE_FROZEN',
  qualification: 'Replay width, offset and removal in reverse and forward order.',
  limits: ['One reopened strip made from two construction circles and extruded by 4 mm.'],
  initialFiles: pins,
  requiredFrozen: pins,
});
const circles = [15, 35].map((x, index) => ({ kind: 'circle', c: [x, 15], r: 5, construction: true, ids: ['e' + (index + 1)] }));
const band = { version: 1, id: 'b1', sources: ['e1', 'e2'], width: 3 };
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'band', band, construction: circles, id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 4, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
};
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const field = name => f.sketchPanel().getByLabel('Band ' + name, { exact: true });
const sources = () => f.page.locator('.vp-overlay .sk-shape.done.construction').evaluateAll(nodes =>
  nodes.map(node => node.getAttribute('points')));
const read = async () => {
  const path = f.page.locator('.vp-overlay .sk-band');
  if (!(await path.count())) return null;
  return { width: Number(await field('width').inputValue()), offset: Number(await field('offset').inputValue()),
    outline: await path.getAttribute('d') };
};
const checkVolume = async (width, offset) => {
  const { bodies } = await f.bodies();
  assert.equal(bodies.length, 1);
  const expected = 4 * (40 * width + Math.PI * ((5 + offset + width) ** 2 - (5 + offset) ** 2));
  assert.ok(Math.abs(bodies[0].volume - expected) < 1e-7, `expected ${expected} mm³`);
};
const keyboard = async key => {
  await f.page.locator('.topbar button.finish').focus();
  await f.page.keyboard.press(key);
};

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
    return context;
  };
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'edit-band-history.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed)) });
  await f.same(seed);
  await checkVolume(3, 0);
  await f.openFeatureEditor(1);
  await button('Edit sketch', f.editor()).click();
  await f.sketchPanel().waitFor();
  const original = await read(), originalSources = await sources();
  assert.deepEqual([original.width, original.offset, originalSources.length], [3, 0, 2]);

  f.phase = 'Edit width with Enter and offset with blur';
  await field('width').fill('5');
  await field('width').press('Enter');
  const widened = await read();
  assert.deepEqual([widened.width, widened.offset], [5, 0]);
  assert.notEqual(widened.outline, original.outline);
  await field('offset').fill('2');
  await f.page.locator('.topbar button.finish').focus();
  const moved = await read();
  assert.deepEqual([moved.width, moved.offset], [5, 2]);
  assert.notEqual(moved.outline, widened.outline);
  await f.snapshot('01-edited-band');
  await button('Remove band', f.sketchPanel()).click();
  assert.equal(await read(), null);
  assert.deepEqual(await sources(), originalSources);
  await f.same(seed);

  f.phase = 'Undo removal restores the edited band';
  await keyboard('Meta+z');
  const restored = await read();
  f.report.observations.push({ bandRestored: !!restored, width: restored?.width, offset: restored?.offset });
  await f.snapshot('02-after-removal-undo');
  assert.deepEqual(restored, moved);
  await button('Undo').click();
  assert.deepEqual(await read(), widened);
  await keyboard('Meta+z');
  assert.deepEqual(await read(), original);
  await f.snapshot('03-fully-undone');
  await f.same(seed);
  await checkVolume(3, 0);

  f.phase = 'Redo width, offset and removal in order';
  await button('Redo').click();
  assert.deepEqual(await read(), widened);
  await keyboard('Meta+Shift+z');
  assert.deepEqual(await read(), moved);
  await button('Redo').click();
  assert.equal(await read(), null);
  assert.deepEqual(await sources(), originalSources);
  await button('Undo').click();
  assert.deepEqual(await read(), moved);
  assert.deepEqual(await sources(), originalSources);
  const finished = await f.finishSketch('04-finished');
  assert.deepEqual(finished.doc.nodes[0].band, { ...band, width: 5, offset: 2 });
  assert.deepEqual(finished.doc.nodes[0].construction, circles);
  assert.deepEqual(finished.doc.nodes[1], seed.nodes[1]);
  await checkVolume(5, 2);
  await button('Undo').click();
  await f.same(seed);
  await checkVolume(3, 0);
  await button('Redo').click();
  await f.same(finished.doc);
  await checkVolume(5, 2);
  assert.deepEqual(f.report.downloads, []);
});
