import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/sketch-clear-draft-history-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/sketch/draftHistory.ts',
  'apps/cad-studio/src/sketch/useSketchActions.ts',
  'apps/cad-studio/src/ui/ModelTools.tsx',
];
const f = await createFlow({
  name: 'sketch-clear-draft-history',
  output: process.argv[2],
  envFrozen: 'D1066_SOURCE_FROZEN',
  qualification: 'Replay Clear profile with a material outline and a construction line.',
  limits: ['One edited XY sketch and its existing 3 mm Extrude in desktop WebGPU.'],
  initialFiles: pins,
  requiredFrozen: pins,
});
const line = { kind: 'polygon', points: [[34, 0], [44, 0]], closed: false,
  bulges: [0, 0], pending: false, construction: true, ids: ['e5', 'e6'] };
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 20],
      sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] }, construction: [line], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 3, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
};
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const geometry = () => f.page.locator('.vp-overlay .sk-shape').evaluateAll(nodes => nodes.map(node => node.outerHTML));
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
  await chooser.setFiles({ name: 'clear-history.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed)) });
  await f.same(seed);
  await checkVolume(1800);
  await f.openFeatureEditor(1);
  await button('Edit sketch', f.editor()).click();
  await f.sketchPanel().waitFor();
  await f.frame([[0, 0], [30, 20], ...line.points]);

  f.phase = 'Clear the material outline and reference together';
  const original = await geometry();
  assert.equal(original.length, 2);
  assert.equal(original.filter(item => item.includes('construction')).length, 1);
  await f.snapshot('01-before-clear');
  await button('Clear profile').click();
  assert.deepEqual(await geometry(), []);
  await button('Clear profile').click();
  assert.deepEqual(await geometry(), []);
  await f.same(seed);
  await f.snapshot('02-after-clear');

  f.phase = 'One keyboard Undo restores both shapes after two Clear clicks';
  await f.page.locator('.topbar button.finish').focus();
  await f.page.keyboard.press('Meta+z');
  const restored = await geometry();
  f.report.observations.push({ initialShapes: original.length, restoredShapes: restored.length });
  await f.snapshot('03-after-keyboard-undo');
  assert.deepEqual(restored, original);
  await f.same(seed);
  await button('Redo').click();
  assert.deepEqual(await geometry(), []);
  await button('Undo').click();
  assert.deepEqual(await geometry(), original);
  await f.page.locator('.topbar button.finish').focus();
  await f.page.keyboard.press('Meta+Shift+z');
  assert.deepEqual(await geometry(), []);
  await f.same(seed);
  await checkVolume(1800);

  f.phase = 'Redraw the material profile after Clear';
  await f.tool('Rectangle', 'r');
  await f.worldClick([0, 0]);
  await f.worldClick([20, 10]);
  const finished = await f.finishSketch('04-finished');
  const sketch = finished.doc.nodes[0];
  assert.equal(sketch.id, seed.nodes[0].id);
  assert.equal(sketch.profile, 'rectangle');
  assert.deepEqual([sketch.min, sketch.max], [[0, 0], [20, 10]]);
  assert.equal(sketch.construction, undefined);
  assert.deepEqual(finished.doc.nodes[1], seed.nodes[1]);
  assert.deepEqual(finished.doc.outputs, seed.outputs);
  await checkVolume(600);
  await button('Undo').click();
  await f.same(seed);
  await checkVolume(1800);
  await button('Redo').click();
  await f.same(finished.doc);
  await checkVolume(600);
  await f.snapshot('05-after-document-redo');
  assert.deepEqual(f.report.downloads, []);
});
