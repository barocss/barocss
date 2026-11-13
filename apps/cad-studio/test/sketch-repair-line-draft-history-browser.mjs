import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/sketch-repair-line-draft-history-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/sketch/draftHistory.ts',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
];
const f = await createFlow({
  name: 'sketch-repair-line-draft-history',
  output: process.argv[2],
  envFrozen: 'D1073_SOURCE_FROZEN',
  qualification: 'Replay Line point placements and the preceding Drag Trim in order.',
  limits: ['One straight notch repair and one existing 2 mm Extrude in desktop WebGPU.'],
  initialFiles: pins,
  requiredFrozen: pins,
});
const guide = (y, id) => ({ kind: 'polygon', points: [[5, y], [25, y]], closed: false,
  bulges: [0, 0], pending: false, ids: ['e' + id, 'e' + (id + 1)], construction: true });
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 40],
      sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] }, construction: [guide(15, 5), guide(25, 7)], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 2, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
};
const path = [[10, 15], [15, 15], [15, 25], [10, 25]];
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const geometry = () => f.page.locator('.vp-overlay .sk-shape').evaluateAll(nodes => nodes.map(node => {
  const points = node.getAttribute('points')?.split(' ') ?? [];
  // The active open polyline appends the current mouse position as its preview.
  if (node.matches('polyline.open:not(.done)')) points.length = node.parentElement.querySelectorAll('circle.sk-point[r="3.5"]').length;
  return [node.getAttribute('class'), points];
}));
const keyboard = async key => {
  await f.page.locator('.topbar button.finish').focus();
  await f.page.keyboard.press(key);
};
const checkVolume = async expected => {
  const { bodies } = await f.bodies();
  assert.equal(bodies.length, 1);
  assert.ok(Math.abs(bodies[0].volume - expected) < 1e-8);
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
  await chooser.setFiles({ name: 'repair-line-history.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed)) });
  await f.same(seed);
  await f.openFeatureEditor(1);
  await button('Edit sketch', f.editor()).click();
  await f.sketchPanel().waitFor();
  await f.frame([[0, 0], [40, 40], [5, 20], [30, 5], [10, 35]]);
  await f.tool('Line', 'l');
  await f.worldClick([10, 5]);
  await f.worldClick([10, 35]);
  await f.tool('Trim', 't');
  const uncut = await geometry();
  await f.page.mouse.move(...await f.screenOf([6, 20]));
  await f.page.mouse.down();
  await f.page.mouse.move(...await f.screenOf([14, 20]));
  await f.page.locator('.vp-overlay .sk-drag-trim-interval').waitFor({ state: 'attached', timeout: 5000 });
  await f.page.mouse.up();
  const trimmed = await geometry();
  assert.notDeepEqual(trimmed, uncut);
  assert.equal(await f.page.locator('.vp-overlay .sk-shape.open:not(.construction)').count(), 2);
  await f.snapshot('01-trimmed');
  await f.tool('Line', 'l');
  const states = [await geometry()];
  for (const point of path) {
    await f.worldClick(point);
    states.push(await geometry());
  }
  assert.notDeepEqual(states[4], states[3]);
  await f.same(seed);
  await f.snapshot('02-repaired');

  f.phase = 'Keyboard Undo removes the last repair segment';
  await keyboard('Meta+z');
  const undone = await geometry();
  f.report.observations.push({ removedLastSegment: JSON.stringify(undone) === JSON.stringify(states[3]) });
  await f.snapshot('03-after-line-undo');
  assert.deepEqual(undone, states[3]);

  f.phase = 'Undo earlier repair placements and then the Trim';
  for (const index of [2, 1, 0]) {
    await button('Undo').click();
    assert.deepEqual(await geometry(), states[index]);
  }
  await keyboard('Meta+z');
  assert.deepEqual(await geometry(), uncut);
  await f.snapshot('04-after-trim-undo');
  await button('Redo').click();
  assert.deepEqual(await geometry(), states[0]);
  for (const index of [1, 2, 3, 4]) {
    await keyboard('Meta+Shift+z');
    assert.deepEqual(await geometry(), states[index]);
  }
  await f.same(seed);
  await checkVolume(3200);
  await f.tool('Trim', 't');
  await f.tool('Line', 'l');
  for (const point of [[10, 35], [30, 35], [30, 5], [10, 5]]) await f.worldClick(point);
  const finished = await f.finishSketch('05-notched-part');
  assert.deepEqual(finished.doc.nodes[1], seed.nodes[1]);
  assert.deepEqual(finished.doc.nodes[0].construction, seed.nodes[0].construction);
  await checkVolume(2100);
  await button('Undo').click();
  await f.same(seed);
  await checkVolume(3200);
  await button('Redo').click();
  await f.same(finished.doc);
  await checkVolume(2100);
  assert.deepEqual(f.report.downloads, []);
});
