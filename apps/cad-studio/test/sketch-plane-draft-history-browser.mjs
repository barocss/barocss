import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/sketch-plane-draft-history-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/sketch/draftHistory.ts',
  'apps/cad-studio/src/sketch/useSketchActions.ts',
];
const f = await createFlow({
  name: 'sketch-plane-draft-history',
  output: process.argv[2],
  envFrozen: 'D1076_SOURCE_FROZEN',
  qualification: 'Replay an unlinked sketch coordinate edit and subsequent work plane placement.',
  limits: ['One new XY rectangle, a 7 mm plane offset and a 3 mm Extrude.'],
  initialFiles: pins,
  requiredFrozen: pins,
});
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const offset = () => f.sketchPanel().getByLabel('Plane offset', { exact: true });
const coordinate = () => f.sketchPanel().getByLabel('Point 2 X', { exact: true });
const finish = () => f.page.locator('.topbar button.finish');
const check = async (x, z) => {
  assert.deepEqual([Number(await coordinate().inputValue()), Number(await offset().inputValue())], [x, z]);
  assert.match(await f.sketchPanel().locator('.card-title').first().innerText(), new RegExp('Z ' + z + '$'));
};
const key = async name => {
  await finish().focus();
  await f.page.keyboard.press(name);
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
  await button('New part').click();
  await f.page.waitForFunction(() => window.__studioDoc?.nodes.length === 0);
  await f.ready();
  const blank = await f.doc();
  await button('Sketch', f.page.locator('.mode')).click();
  await f.sketchPanel().waitFor();
  await f.tool('Line', 'l');
  const points = [[10, 10], [26, 10], [26, 24], [10, 24], [10, 10]];
  await f.frame(points);
  for (const point of points) await f.worldClick(point);
  await check(26, 0);
  await coordinate().fill('30');
  await finish().focus();
  await check(30, 0);
  await offset().fill('7');
  await check(30, 7);
  await f.same(blank);
  await f.snapshot('01-coordinate-and-plane');

  f.phase = 'Undo the plane before the earlier coordinate';
  await key('Meta+z');
  f.report.observations.push({ xAfterFirstUndo: Number(await coordinate().inputValue()),
    zAfterFirstUndo: Number(await offset().inputValue()) });
  await f.snapshot('02-first-undo');
  await check(30, 0);
  await button('Undo').click();
  await check(26, 0);
  await f.same(blank);

  f.phase = 'Redo the coordinate before the plane';
  await button('Redo').click();
  await check(30, 0);
  await key('Meta+Shift+z');
  await check(30, 7);
  await offset().fill('7.0');
  await check(30, 7);
  await button('Undo').click();
  await check(30, 0);
  await button('Redo').click();
  await check(30, 7);

  const finished = await f.finishSketch('03-offset-sketch');
  assert.deepEqual(finished.doc.nodes[0].plane.origin, [0, 0, 7]);
  await f.openExtrudeHud();
  const result = await f.applyExtrude({ distance: 3, previous: finished.doc, label: '04-offset-part' });
  const [body] = result.bodies.bodies;
  assert.equal(result.bodies.bodies.length, 1);
  assert.ok(Math.abs(body.volume - 840) < 1e-8);
  assert.ok(Math.abs(body.centroid[2] - 8.5) < 1e-8);
  await button('Undo').click();
  await f.same(finished.doc);
  await button('Redo').click();
  await f.same(result.doc);
  assert.deepEqual(f.report.downloads, []);
});
