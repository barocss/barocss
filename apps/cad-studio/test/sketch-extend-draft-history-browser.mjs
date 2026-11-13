import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/sketch-extend-draft-history-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/sketch/draftHistory.ts',
  'apps/cad-studio/src/sketch/useSketchActions.ts',
  'packages/barocss-cad-model/src/sketch/trim.ts',
];
const f = await createFlow({
  name: 'sketch-extend-draft-history',
  output: process.argv[2],
  envFrozen: 'D1064_SOURCE_FROZEN',
  qualification: 'Replay Extend on an authored open outline in desktop Studio.',
  limits: ['One straight coplanar chain, one 3 mm Extrude and a 1440 by 1000 WebGPU viewport.'],
  initialFiles: pins,
  requiredFrozen: pins,
});
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 20], sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] }, id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 3, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
};
const chain = [[45, 10], [60, 10], [60, 30], [45, 30], [45, 15]];
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const geometry = () => f.page.locator('.vp-overlay .sk-shape.done').evaluateAll(nodes =>
  nodes.map(node => [node.localName, node.getAttribute('points')]));
const checkVolume = async expected => {
  const { bodies } = await f.bodies();
  const volume = bodies.reduce((total, body) => total + body.volume, 0);
  assert.ok(Math.abs(volume - expected) < 1e-8, `Expected ${expected} mm³, found ${volume} mm³`);
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
  await chooser.setFiles({ name: 'extend-history.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed)) });
  await f.same(seed);
  await checkVolume(1800);

  await f.openFeatureEditor(1);
  await button('Edit sketch', f.editor()).click();
  await f.sketchPanel().waitFor();
  await f.frame([[0, 0], [30, 20], ...chain]);
  f.phase = 'Draw an open material chain and preview Extend';
  await f.tool('Line', 'l');
  for (const point of chain) await f.worldClick(point);
  await f.tool('Extend', 'e');
  const open = await geometry();
  assert.equal(open.filter(([tag]) => tag === 'polyline').length, 1);
  const points = open.find(([tag]) => tag === 'polyline')[1].split(' ').map(pair => pair.split(',').map(Number));
  assert.equal(points.length, chain.length);
  for (const [index, point] of chain.entries()) {
    const pixel = await f.screenOf(point);
    const overlay = await f.page.locator('.vp-overlay').boundingBox();
    assert.ok(Math.hypot(points[index][0] + overlay.x - pixel[0], points[index][1] + overlay.y - pixel[1]) < 1.5,
      `The chain contains world point ${point}`);
  }
  const end = await f.screenOf([45, 16]);
  await f.page.mouse.move(...end);
  await f.page.locator('.vp-overlay .sk-extend').waitFor({ state: 'visible' });
  await f.snapshot('01-open-chain-extend-preview');
  await f.page.mouse.click(...end);
  const closed = await geometry();
  assert.deepEqual(closed.map(([tag]) => tag), ['polygon', 'polygon']);
  await f.same(seed);
  await f.snapshot('02-closed-after-extend');

  f.phase = 'Keyboard Undo must reopen the same chain';
  await f.page.locator('.topbar button.finish').focus();
  await f.page.keyboard.press('Meta+z');
  const undone = await geometry();
  f.report.observations.push({ open, closed, undone });
  await f.snapshot('03-after-keyboard-undo');
  assert.deepEqual(undone, open);
  await f.same(seed);
  await checkVolume(1800);

  f.phase = 'Refused Finish must preserve Extend Redo';
  await f.page.locator('.topbar button.finish').click();
  const alert = f.sketchPanel().getByRole('alert');
  await alert.waitFor();
  assert.match(await alert.textContent(), /\(45, 10\).*\(45, 15\)/);
  assert.deepEqual(await geometry(), open);
  await f.same(seed);
  await button('Redo').click();
  await alert.waitFor({ state: 'hidden' });
  assert.deepEqual(await geometry(), closed);
  await button('Undo').click();
  assert.deepEqual(await geometry(), open);
  await f.page.locator('.topbar button.finish').focus();
  await f.page.keyboard.press('Meta+Shift+z');
  assert.deepEqual(await geometry(), closed);
  await f.snapshot('04-after-keyboard-redo');

  const finished = await f.finishSketch('05-finished');
  assert.equal(finished.doc.nodes[0].id, seed.nodes[0].id);
  assert.deepEqual(finished.doc.nodes[1], seed.nodes[1]);
  assert.deepEqual(finished.doc.outputs, seed.outputs);
  await checkVolume(2700);
  await button('Undo').click();
  await f.same(seed);
  await checkVolume(1800);
  await button('Redo').click();
  await f.same(finished.doc);
  await checkVolume(2700);
  await f.snapshot('06-after-document-redo');
  assert.deepEqual(f.report.downloads, []);
});
