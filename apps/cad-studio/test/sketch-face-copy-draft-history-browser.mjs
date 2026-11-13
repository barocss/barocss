import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/sketch-face-copy-draft-history-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/sketch/draftHistory.ts',
  'apps/cad-studio/src/sketch/useSketchActions.ts',
];
const f = await createFlow({
  name: 'sketch-face-copy-draft-history',
  output: process.argv[2],
  envFrozen: 'D1069_SOURCE_FROZEN',
  qualification: 'Replay material and construction copies of the same face outline with a hole.',
  limits: ['One native 30 by 20 mm planar face with a through hole, in desktop WebGPU.'],
  initialFiles: pins,
  requiredFrozen: pins,
});
const solid = node => ({ node, side: 'solid' });
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 20], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 8, id: 'n1' },
    { kind: 'hole', parent: solid(1), center: [15, 10], radius: 2, face: 'n1.top', id: 'n2' },
  ],
  outputs: { b2: solid(2) }, nextId: 3,
};
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const copiedShapes = () => f.page.locator('.vp-overlay .sk-shape.done').evaluateAll(nodes =>
  nodes.map(node => ({ construction: node.classList.contains('construction'), points: node.getAttribute('points') })));
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
  await chooser.setFiles({ name: 'face-copy-history.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed)) });
  await f.same(seed);
  const profileArea = 30 * 20 - 4 * Math.PI;
  const [source] = (await f.bodies()).bodies;
  assert.ok(Math.abs(source.volume - 8 * profileArea) < 1e-7);
  await button('Top', f.page.locator('.views')).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  const pixel = await f.screenOf([10, 8, 8]);
  assert.ok(await f.page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.matches('canvas.vp-canvas'), pixel));
  await f.page.mouse.click(...pixel);
  await f.page.waitForFunction(() => window.__studioSelection.selection.faces.length === 1);
  await button('Sketch', f.page.locator('.mode')).click();
  await f.sketchPanel().waitFor();
  assert.deepEqual(await copiedShapes(), []);

  for (const [name, construction] of [['Use the face outline', false], ['Face outline as references', true]]) {
    f.phase = name + ' copies the outer and inner outlines';
    await button(name, f.sketchPanel()).click();
    const copied = await copiedShapes();
    assert.deepEqual(copied.map(shape => shape.construction), [construction, construction]);
    await f.same(seed);
    await f.snapshot(construction ? '03-construction-copy' : '01-material-copy');
    f.phase = name + ' keyboard Undo removes both copies';
    await keyboard('Meta+z');
    const undone = await copiedShapes();
    f.report.observations.push({ name, copied: copied.length, remainingAfterUndo: undone.length });
    await f.snapshot(construction ? '04-construction-undo' : '02-material-undo');
    assert.deepEqual(undone, []);
    await f.same(seed);
    await button('Redo').click();
    assert.deepEqual(await copiedShapes(), copied);
    await button('Undo').click();
    assert.deepEqual(await copiedShapes(), []);
    await keyboard('Meta+Shift+z');
    assert.deepEqual(await copiedShapes(), copied);
    await button('Undo').click();
    assert.deepEqual(await copiedShapes(), []);
  }

  await button('Use the face outline', f.sketchPanel()).click();
  const finished = await f.finishSketch('05-material-finished');
  const added = finished.doc.nodes.at(-1);
  assert.deepEqual(finished.doc.nodes.slice(0, 3), seed.nodes);
  assert.deepEqual(added.on, solid(2));
  assert.equal(added.holes.length, 1);
  await f.openExtrudeHud();
  const result = await f.applyExtrude({ distance: 2, previous: finished.doc, label: '06-copied-outline' });
  assert.equal(result.bodies.bodies.length, 2);
  const volumes = result.bodies.bodies.map(body => body.volume).sort((a, b) => a - b);
  assert.ok(Math.abs(volumes[0] - 2 * profileArea) < 1e-7);
  assert.ok(Math.abs(volumes[1] - source.volume) < 1e-7);
  assert.deepEqual(f.report.downloads, []);
});
