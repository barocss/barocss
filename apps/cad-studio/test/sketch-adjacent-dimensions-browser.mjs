import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/sketch-adjacent-dimensions-browser.mjs',
  'apps/cad-studio/src/viewport/sketchOverlay.tsx',
  'apps/cad-studio/src/ui/SketchMarks.tsx',
];
const f = await createFlow({
  name: 'sketch-adjacent-dimensions', output: process.argv[2], envFrozen: 'D1054_SOURCE_FROZEN',
  qualification: 'Adjacent Sketch length labels open separate editors at their displayed centers.',
  limits: ['Desktop 1024 × 800, a 54 × 1.25 mm closed polygon.'],
  initialFiles: pins, requiredFrozen: pins,
  inspectorSource: `
import assert from 'node:assert/strict';
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { profileOf } from '@barocss/cad-model/sketch/loops';
const result = profileOf([{ kind: 'polygon', closed: true, points: [[0,0],[54,0],[54,1.25],[0,1.25]],
  hv: { h: [0,2], v: [1,3] } }]);
assert.ok('node' in result);
console.log(JSON.stringify(withNode(emptyDoc(), result.node)));
`,
});
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const project = world => f.page.evaluate(world => window.__studioScreenOf(world), world);
const settle = () => f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
const editor = () => f.page.locator('.dim-edit');
const labels = () => f.page.locator('.vp-overlay .dim:not(.live)').filter({ hasText: /^54$/ });

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, viewport: { width: 1024, height: 800 }, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return url.origin === origin ? route.continue() : route.abort();
    });
    return context;
  };
  const doc = await f.inspect('close-dimensions', {});
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'close-dimensions.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
  await button('Sketch · polygon', f.page.getByRole('group', { name: 'History', exact: true })).click();
  await button('Edit sketch', f.editor()).click();
  await f.sketchPanel().waitFor();
  await settle();
  const edge = [27, 0, 0], opposite = [27, 1.25, 0];
  const initial = await project(edge), initialOpposite = await project(opposite);
  await f.page.mouse.move(...initial);
  await f.page.mouse.wheel(0, Math.log((initial[1] - initialOpposite[1]) / 4) / 0.0015);
  await settle();
  const gap = (await project(edge))[1] - (await project(opposite))[1];
  assert.ok(Math.abs(gap - 4) < 0.2, gap);
  assert.equal(await labels().count(), 2);

  f.phase = 'Both reference dimension centers open their own editor';
  const boxes = await labels().locator('.dim-chip').evaluateAll(chips => chips.map(chip => chip.getBoundingClientRect().toJSON()));
  const opened = [];
  for (const box of boxes) {
    await f.page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
    await editor().waitFor();
    assert.equal(await editor().inputValue(), '54');
    opened.push(await editor().getAttribute('aria-label'));
    await editor().fill('55');
    await editor().press('Escape');
    await editor().waitFor({ state: 'hidden' });
  }
  const overlap = Math.max(0, Math.min(boxes[0].right, boxes[1].right) - Math.max(boxes[0].left, boxes[1].left))
    * Math.max(0, Math.min(boxes[0].bottom, boxes[1].bottom) - Math.max(boxes[0].top, boxes[1].top));
  f.report.observations.push({ gap, boxes, overlap, opened });
  await f.snapshot('reference-dimensions');
  assert.deepEqual(opened, ['Length of edge 1', 'Length of edge 3']);
  assert.equal(overlap, 0);
  await f.same(doc);

  f.phase = 'Commit a driving length to the chosen edge';
  const first = boxes[0];
  await f.page.mouse.dblclick(first.x + first.width / 2, first.y + first.height / 2);
  assert.equal(await editor().getAttribute('aria-label'), 'Length of edge 1');
  await editor().fill('55');
  await editor().press('Enter');
  await f.page.locator('.vp-overlay .dim.driving[data-dim="len0"]').getByText('55', { exact: true }).waitFor();
  assert.equal(await f.page.locator('.vp-overlay .dim.driving[data-dim="len2"]').count(), 0);
  const finished = await f.finishSketch('driving-dimension');
  assert.notDeepEqual(finished.doc, doc);
  await f.undo();
  await f.same(doc);
  await f.redo();
  await f.same(finished.doc);
  assert.deepEqual(f.report.downloads, []);
});
