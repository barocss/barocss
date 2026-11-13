import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/sketch-split-draft-history-browser.mjs',
  'apps/cad-studio/src/sketch/draftHistory.ts',
  'apps/cad-studio/src/sketch/useSketchActions.ts',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'packages/barocss-cad-model/src/sketch/trim.ts',
  'packages/barocss-cad-model/src/sketch/osnap.ts',
];
const f = await createFlow({
  name: 'sketch-split-draft-history', output: process.argv[2], envFrozen: 'D1065_SOURCE_FROZEN',
  qualification: 'Replay the split of a construction arc and its derived Middle snaps.',
  limits: ['One open 270 degree construction arc on XY and one 3 mm Extrude.'],
  initialFiles: pins, requiredFrozen: pins,
});
const arc = { kind: 'polygon', points: [[45, 25], [30, 10]], closed: false,
  bulges: [1 + Math.SQRT2, 0], pending: false, construction: true, ids: ['e5', 'e6'] };
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [20, 10],
      sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] }, construction: [arc], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 3, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
};
const r45 = 15 / Math.SQRT2;
const beforeMiddle = [30 - r45, 25 + r45];
const afterMiddles = [[30 + r45, 25 + r45], [15, 25]];
const splitAt = [30, 40];
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const overlayArc = () => f.page.locator('.vp-overlay polyline.sk-shape.done.construction');
const mark = () => f.page.locator('.vp-overlay .sk-osnap').filter({ hasText: 'Middle' });
const hover = async point => {
  const pixel = await f.screenOf(point);
  assert.ok(await f.page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.matches('canvas.vp-canvas'), pixel));
  await f.page.mouse.move(...pixel);
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  return pixel;
};
const checkMiddle = async (point, present) => {
  await hover([point[0] + 0.35, point[1]]);
  assert.equal(await mark().count(), present ? 1 : 0, `Middle at ${point}`);
  if (present) {
    const drawn = await mark().locator('polygon').evaluate(element => {
      const apex = element.points.getItem(0);
      const center = new DOMPoint(apex.x, apex.y + 7).matrixTransform(element.getScreenCTM());
      return [center.x, center.y];
    });
    const pixel = await f.screenOf(point);
    assert.ok(Math.hypot(drawn[0] - pixel[0], drawn[1] - pixel[1]) < 1, `Middle coordinates at ${point}`);
  }
};
const checkMiddles = async split => {
  await checkMiddle(beforeMiddle, !split);
  for (const point of afterMiddles) await checkMiddle(point, split);
};
const checkVolume = async () => {
  const { bodies } = await f.bodies();
  assert.equal(bodies.length, 1);
  assert.ok(Math.abs(bodies[0].volume - 600) < 1e-8);
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
  await chooser.setFiles({ name: 'split-history.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed)) });
  await f.same(seed);
  await checkVolume();
  await f.openFeatureEditor(1);
  await button('Edit sketch', f.editor()).click();
  await f.sketchPanel().waitFor();
  await f.tool('Rectangle', 'r');
  await f.frame([[0, 0], [45, 25], splitAt, beforeMiddle, ...afterMiddles]);

  f.phase = 'Confirm the initial construction arc and Middle';
  await checkMiddles(false);
  const before = await overlayArc().getAttribute('points');
  await checkMiddle(beforeMiddle, true);
  await f.snapshot('01-original-middle');
  await f.tool('Split', 'k');
  const pixel = await hover(splitAt);
  await f.page.locator('.vp-overlay .sk-split').waitFor();
  await f.snapshot('02-split-preview');
  await f.page.mouse.click(...pixel);
  const after = await overlayArc().getAttribute('points');
  assert.notEqual(after, before);
  await f.tool('Rectangle', 'r');
  await checkMiddles(true);
  await f.snapshot('03-split-middles');
  await f.same(seed);

  f.phase = 'Keyboard Undo restores the original arc and Middle';
  await f.page.locator('.topbar button.finish').focus();
  await f.page.keyboard.press('Meta+z');
  const undone = await overlayArc().getAttribute('points');
  f.report.observations.push({ arcRestored: undone === before });
  await f.snapshot('04-after-keyboard-undo');
  assert.equal(undone, before);
  await checkMiddles(false);
  await button('Redo').click();
  assert.equal(await overlayArc().getAttribute('points'), after);
  await checkMiddles(true);
  await button('Undo').click();
  assert.equal(await overlayArc().getAttribute('points'), before);
  await f.page.locator('.topbar button.finish').focus();
  await f.page.keyboard.press('Meta+Shift+z');
  assert.equal(await overlayArc().getAttribute('points'), after);
  await checkMiddles(true);
  await f.same(seed);
  await checkVolume();

  const finished = await f.finishSketch('05-finished');
  const { construction, ...sketch } = finished.doc.nodes[0];
  assert.deepEqual({ ...sketch, construction: [arc] }, seed.nodes[0]);
  assert.equal(construction.length, 1);
  const result = construction[0];
  assert.equal(result.construction, true);
  assert.deepEqual([result.points[0], result.points[2]], arc.points);
  assert.ok(Math.hypot(result.points[1][0] - splitAt[0], result.points[1][1] - splitAt[1]) < 0.04);
  assert.equal(result.ids[0], arc.ids[0]);
  assert.equal(result.ids[2], arc.ids[1]);
  assert.ok(!arc.ids.includes(result.ids[1]));
  for (const [index, sweep] of [Math.PI / 2, Math.PI].entries()) {
    assert.ok(Math.abs(4 * Math.atan(result.bulges[index]) - sweep) < 0.003);
  }
  assert.deepEqual(finished.doc.nodes[1], seed.nodes[1]);
  assert.deepEqual(finished.doc.outputs, seed.outputs);
  await checkVolume();
  await button('Undo').click();
  await f.same(seed);
  await checkVolume();
  await button('Redo').click();
  await f.same(finished.doc);
  await checkVolume();
  await f.snapshot('06-after-document-redo');
  assert.deepEqual(f.report.downloads, []);
});
