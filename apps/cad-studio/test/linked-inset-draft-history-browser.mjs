import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const offset = process.argv.includes('--offset');
const pins = [
  'apps/cad-studio/test/linked-inset-draft-history-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/sketch/draftHistory.ts',
  'apps/cad-studio/src/sketch/useSketchActions.ts',
];
const f = await createFlow({
  name: 'linked-inset-draft-history', output: process.argv[2], envFrozen: offset ? 'D1063_SOURCE_FROZEN' : 'D1062_SOURCE_FROZEN',
  qualification: offset ? 'Replay Trim and Offset on a linked inset in order.'
    : 'Undo and Redo restore both the coordinates and association of a linked inset.',
  limits: ['One straight axial linked ring and one independent Extrude in desktop Studio.'],
  initialFiles: pins, requiredFrozen: pins,
});
const solid = node => ({ node, side: 'solid' });
const seed = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [20, 10], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 10, id: 'n1' },
    { kind: 'sketch', profile: 'polygon', points: [[0, 10], [0, 0], [20, 0], [20, 10]],
      holes: [[[1, 9], [1, 1], [19, 1], [19, 9]].map(start => ({ kind: 'line', start }))],
      sideTags: { outer: ['e1', 'e2', 'e3', 'e4'], holes: [['e5', 'e6', 'e7', 'e8']] },
      plane: { origin: [0, 0, 10], normal: [0, 0, 1], xAxis: [1, 0, 0] },
      association: { kind: 'planar-face-outline-inset', version: 1, source: solid(1),
        sourceFeature: 'n1', face: 'n1.top', insetMM: 1 },
      on: solid(1), id: 'n2' },
    { kind: 'extrude', sketch: 2, height: 4, id: 'n3' },
  ],
  outputs: { b1: solid(1), b3: solid(3) }, nextId: 4,
};
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const field = point => f.sketchPanel().getByRole('spinbutton', { name: `Point ${point} X`, exact: true });
const link = () => f.sketchPanel().getByText(/Linked face outline and inset/);
const detached = () => f.sketchPanel().getByText(/Link detached by a geometry/);
const readX = () => Promise.all([3, 4].map(async point => Number(await field(point).inputValue())));

async function offsetAfterTrim() {
  const page = f.page;
  await f.tool('Trim', 't');
  const point = await page.evaluate(() => window.__studioScreenOf([10, 1, 10]));
  assert.ok(await page.evaluate(point => document.elementFromPoint(...point)?.matches('canvas.vp-canvas'), point));
  const cue = page.locator('.vp-overlay .sk-trim');
  const moveAway = () => page.mouse.move(point[0], point[1] + 40);
  const expectInnerEdge = async visible => {
    await moveAway();
    await page.mouse.move(...point);
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    assert.equal(await cue.count(), visible ? 1 : 0);
  };
  await expectInnerEdge(true);
  await page.mouse.click(...point);
  await detached().waitFor();
  await expectInnerEdge(false);
  const shapes = () => page.locator('.vp-overlay .sk-shape.done').count();
  const afterTrim = await shapes();
  f.phase = 'Offset a remaining closed outline after Trim';
  const distance = f.sketchPanel().getByLabel('Offset distance', { exact: true });
  const outward = button('Offset outward', f.sketchPanel());
  await distance.fill('1');
  await outward.click();
  const afterOffset = await shapes();
  assert.equal(afterOffset, afterTrim + 1);
  const undoEnabled = await button('Undo').isEnabled();
  f.report.observations.push({ afterTrim, afterOffset, undoEnabled });
  await f.snapshot('linked-offset-after-trim');
  assert.equal(undoEnabled, true);
  await button('Undo').click();
  assert.equal(await shapes(), afterTrim);
  await detached().waitFor();
  await expectInnerEdge(false);
  await page.keyboard.press('Meta+z');
  await link().waitFor();
  await expectInnerEdge(true);
  await f.same(seed);
  await button('Redo').click();
  await detached().waitFor();
  await expectInnerEdge(false);
  await page.keyboard.press('Meta+Shift+z');
  assert.equal(await shapes(), afterOffset);
  await button('Undo').click();
  await button('Undo').click();
  await link().waitFor();
  await expectInnerEdge(true);
}

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
  await chooser.setFiles({ name: 'linked-inset-history.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed)) });
  await f.same(seed);
  await f.openFeatureEditor(3, 'linked ring');
  await button('Edit sketch', f.editor()).click();
  await link().waitFor();
  assert.deepEqual(await readX(), [20, 20]);
  if (offset) {
    await offsetAfterTrim();
  } else {
    f.phase = 'Detach through a real point edit';
    await field(3).fill('22');
    await f.page.locator('.topbar button.finish').focus();
    await detached().waitFor();
    assert.deepEqual(await readX(), [22, 22]);
    await f.same(seed);

    f.phase = 'Undo restores the coordinates and linked owner';
    await button('Undo').click();
    const after = { x: await readX(), linked: await link().isVisible(), detached: await detached().isVisible() };
    f.report.observations.push(after);
    await f.snapshot('after-undo');
    assert.deepEqual(after, { x: [20, 20], linked: true, detached: false });
    await button('Redo').click();
    await detached().waitFor();
    assert.deepEqual(await readX(), [22, 22]);
    await f.page.locator('.topbar button.finish').focus();
    await f.page.keyboard.press('Meta+z');
    await link().waitFor();
    assert.deepEqual(await readX(), [20, 20]);
  }
  const finished = await f.finishSketch('restored-finish');
  assert.deepEqual(finished.doc, seed);
  const [originalStock, originalRing] = finished.bodies.bodies;
  assert.ok(Math.abs(originalStock.volume - 2000) < 1e-8);
  assert.ok(Math.abs(originalRing.volume - 224) < 1e-8);
  assert.ok(Math.abs(originalRing.centroid[2] - 12) < 1e-8);

  f.phase = 'The restored link follows a source height edit';
  await f.openFeatureEditor(1, 'source stock');
  await f.editor().getByLabel('Distance', { exact: true }).fill('12');
  const regenerated = await f.applyEditor(seed, 'source-height-12');
  assert.deepEqual(regenerated.doc.nodes[2], seed.nodes[2]);
  const [stock, ring] = regenerated.bodies.bodies;
  assert.ok(Math.abs(stock.volume - 2400) < 1e-8);
  assert.ok(Math.abs(ring.volume - 224) < 1e-8);
  assert.ok(Math.abs(ring.centroid[2] - 14) < 1e-8);
  assert.deepEqual(f.report.downloads, []);
});
