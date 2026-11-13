import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/sketch-curved-trim-draft-history-browser.mjs',
  'apps/cad-studio/src/sketch/draftHistory.ts',
  'apps/cad-studio/src/sketch/useSketchActions.ts',
  'packages/barocss-cad-model/src/sketch/select.ts',
];
const f = await createFlow({
  name: 'sketch-curved-trim-draft-history', output: process.argv[2], envFrozen: 'D1071_SOURCE_FROZEN',
  qualification: 'Replay Trim of a construction line across Select in a reopened curved sketch.',
  limits: ['One 90 degree arc in the material profile and one isolated straight construction guide.'],
  initialFiles: pins, requiredFrozen: pins,
});
const guide = { kind: 'polygon', points: [[32, 5], [42, 5]], closed: false, bulges: [0, 0],
  ids: ['e5', 'e6'], construction: true, pending: false };
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'loop', segments: [
      { kind: 'line', start: [0, 0] },
      { kind: 'arc', start: [20, 0], center: [15, 5], direction: 'ccw' },
      { kind: 'line', start: [20, 10] },
      { kind: 'line', start: [0, 10] },
    ], sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] }, construction: [guide], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 6, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
};
const volume = 6 * (200 + 25 * (Math.PI / 2 - 1));
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const construction = () => f.page.locator('.vp-overlay polyline.sk-shape.done.construction');
const checkVolume = async () => {
  const { bodies } = await f.bodies();
  assert.equal(bodies.length, 1);
  assert.ok(Math.abs(bodies[0].volume - volume) < 1e-7);
};
const press = async key => {
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
  await chooser.setFiles({ name: 'curved-trim-history.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed)) });
  await f.same(seed);
  await checkVolume();
  await f.openFeatureEditor(1);
  await button('Edit sketch', f.editor()).click();
  await f.sketchPanel().waitFor();
  await f.frame([[0, 0], [22, 10], ...guide.points]);
  const originalGuide = await construction().getAttribute('points');
  const radius = f.sketchPanel().getByLabel('Arc 2 radius', { exact: true });
  await radius.waitFor({ timeout: 5000 });
  assert.ok(Math.abs(Number(await radius.inputValue()) - Math.sqrt(50)) < 0.01);
  await f.tool('Trim', 't');
  const pixel = await f.screenOf([37, 5]);
  await f.page.mouse.move(...pixel);
  await f.page.locator('.vp-overlay .sk-trim').waitFor({ state: 'attached', timeout: 5000 });
  await f.page.mouse.click(...pixel);
  assert.equal(await construction().count(), 0);
  await f.tool('Select', 's');
  await radius.waitFor({ timeout: 5000 });
  await f.same(seed);
  await f.snapshot('01-cut-then-select');

  f.phase = 'Undo across Trim to Select restores the guide and the active arc';
  await press('Meta+z');
  const restored = await construction().count();
  f.report.observations.push({ guideAfterUndo: restored, activeArc: await radius.count() });
  await f.snapshot('02-after-undo');
  assert.equal(restored, 1);
  assert.equal(await construction().getAttribute('points'), originalGuide);
  assert.ok(Math.abs(Number(await radius.inputValue()) - Math.sqrt(50)) < 0.01);
  await button('Redo').click();
  assert.equal(await construction().count(), 0);
  await radius.waitFor({ timeout: 5000 });
  await button('Undo').click();
  assert.equal(await construction().getAttribute('points'), originalGuide);
  await press('Meta+Shift+z');
  assert.equal(await construction().count(), 0);
  await radius.waitFor({ timeout: 5000 });
  await press('Meta+z');
  assert.equal(await construction().getAttribute('points'), originalGuide);
  await f.same(seed);
  await checkVolume();
  const finished = await f.finishSketch('03-restored-finish');
  assert.deepEqual(finished.doc, seed);
  await checkVolume();
  assert.deepEqual(f.report.downloads, []);
});
