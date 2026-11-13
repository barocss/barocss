import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/sketch-profile-offset-draft-history-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/sketch/draftHistory.ts',
  'apps/cad-studio/src/sketch/useSketchActions.ts',
  'packages/barocss-cad-model/src/sketch/offset.ts',
];
const f = await createFlow({
  name: 'sketch-profile-offset-draft-history',
  output: process.argv[2],
  envFrozen: 'D1077_SOURCE_FROZEN',
  qualification: 'Replay a coordinate change and an inward profile Offset in a reopened rectangle.',
  limits: ['One straight rectangular profile with a 2 mm inset and a 3 mm Extrude.'],
  initialFiles: pins,
  requiredFrozen: pins,
});
const solid = { node: 1, side: 'solid' };
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [20, 10], max: [60, 35],
      sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] }, id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 3, id: 'n1' },
  ],
  outputs: { b1: solid }, nextId: 2,
};
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const coordinate = () => f.sketchPanel().getByLabel('Point 2 X', { exact: true });
const finish = () => f.page.locator('.topbar button.finish');
const outline = () => f.page.locator('.vp-overlay polygon.sk-shape').evaluateAll(nodes => nodes.map(node => node.outerHTML));
const keyboard = async key => {
  await finish().focus();
  await f.page.keyboard.press(key);
};
const checkVolume = async expected => {
  const { bodies } = await f.bodies();
  assert.equal(bodies.length, 1);
  assert.ok(Math.abs(bodies[0].volume - expected) < 1e-8, `Expected ${expected} mm³, got ${bodies[0].volume}`);
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
  await chooser.setFiles({ name: 'profile-offset-history.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed)) });
  await f.same(seed);
  await checkVolume(3000);
  await f.openFeatureEditor(1);
  await button('Edit sketch', f.editor()).click();
  await f.sketchPanel().waitFor();
  assert.equal(await coordinate().inputValue(), '60');
  const initial = await outline();
  assert.equal(initial.length, 1);
  await coordinate().fill('66');
  await finish().focus();
  assert.equal(await coordinate().inputValue(), '66');
  const widened = await outline();
  assert.notDeepEqual(widened, initial);

  f.phase = 'Offset the widened rectangle inward by 2 mm';
  await f.sketchPanel().getByLabel('Offset distance', { exact: true }).fill('2');
  await button('Offset inward', f.sketchPanel()).click();
  const inset = await outline();
  assert.equal(inset.length, 2);
  await f.same(seed);
  await f.snapshot('01-offset');

  f.phase = 'Undo the inset before the width change';
  await keyboard('Meta+z');
  const afterFirstUndo = await outline();
  f.report.observations.push({ afterFirstUndo: afterFirstUndo.length });
  await f.snapshot('02-first-undo');
  assert.deepEqual(afterFirstUndo, widened);
  await button('Undo').click();
  assert.deepEqual(await outline(), initial);
  assert.equal(await coordinate().inputValue(), '60');
  await f.same(seed);

  f.phase = 'Redo the width and then the same inset';
  await button('Redo').click();
  assert.deepEqual(await outline(), widened);
  assert.equal(await coordinate().inputValue(), '66');
  await keyboard('Meta+Shift+z');
  assert.deepEqual(await outline(), inset);
  await f.same(seed);
  await checkVolume(3000);

  const finished = await f.finishSketch('03-inset-solid');
  assert.deepEqual(finished.doc.nodes[1], seed.nodes[1]);
  assert.deepEqual(finished.doc.outputs, seed.outputs);
  assert.deepEqual(finished.doc.nodes[0].sideTags.outer, seed.nodes[0].sideTags.outer);
  assert.equal(finished.doc.nodes[0].holes.length, 1);
  await checkVolume(804);
  await button('Undo').click();
  await f.same(seed);
  await checkVolume(3000);
  await button('Redo').click();
  await f.same(finished.doc);
  await checkVolume(804);
  assert.deepEqual(f.report.downloads, []);
});
