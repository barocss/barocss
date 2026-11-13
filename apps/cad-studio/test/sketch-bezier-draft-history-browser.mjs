import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/sketch-bezier-draft-history-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/ui/SketchPanel.tsx',
  'apps/cad-studio/src/sketch/draftHistory.ts',
];
const f = await createFlow({
  name: 'sketch-bezier-draft-history', output: process.argv[2], envFrozen: 'D1061_SOURCE_FROZEN',
  qualification: 'Undo and Redo Enter and blur commits of a cubic Bézier control point.',
  limits: ['One cubic on the XY plane in desktop Studio.'],
  initialFiles: pins, requiredFrozen: pins,
});
const button = name => f.page.getByRole('button', { name, exact: true });
const field = () => f.sketchPanel().getByLabel('Control point 2 Y', { exact: true });
const original = [[10, 10], [20, 42], [34, 42], [44, 10]];
const settle = () => f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));

async function readCurve() {
  await settle();
  const midpoint = await f.page.locator('.vp-overlay polyline.sk-shape.open').evaluate(line => {
    const pixel = line.points[Math.floor(line.points.length / 2)];
    const box = line.ownerSVGElement.getBoundingClientRect();
    return [pixel.x + box.left, pixel.y + box.top];
  });
  return { value: Number(await field().inputValue()), midpoint };
}

function checkMidpoint(actual, expected) {
  assert.ok(Math.hypot(actual[0] - expected[0], actual[1] - expected[1]) < 0.05, JSON.stringify({ actual, expected }));
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
  await button('New part').click();
  await f.page.waitForFunction(() => window.__studioDoc?.nodes.length === 0);
  await f.ready();
  const source = await f.doc();
  await f.page.getByRole('navigation', { name: 'Tools', exact: true }).getByRole('button', { name: 'Sketch', exact: true }).click();
  await f.sketchPanel().waitFor();
  await f.tool('Bézier', 'b');
  await f.frame(original);
  for (const pole of original) await f.worldClick(pole);
  const finish = f.page.locator('.topbar button.finish');
  const initial = await readCurve();
  assert.equal(initial.value, 42);
  checkMidpoint(initial.midpoint, await f.screenOf([27, 34]));
  assert.equal(await button('Undo').isEnabled(), false);

  for (const { label, value, commit, undo, redo } of [
    { label: 'enter', value: 34, commit: () => field().press('Enter'),
      undo: () => f.page.keyboard.press('Meta+z'), redo: () => button('Redo').click() },
    { label: 'blur', value: 38, commit: () => finish.focus(),
      undo: () => button('Undo').click(), redo: () => f.page.keyboard.press('Meta+Shift+z') },
  ]) {
    f.phase = label + ' control point history';
    const before = await readCurve();
    await field().fill(String(value));
    await commit();
    await finish.focus();
    const changed = await readCurve();
    assert.equal(changed.value, value);
    const expected = await f.screenOf([27, (20 + 3 * value + 3 * 42) / 8]);
    checkMidpoint(changed.midpoint, expected);
    const undoEnabled = await button('Undo').isEnabled();
    f.report.observations.push({ label, before, changed, undoEnabled });
    await f.snapshot(label + '-edit');
    assert.equal(undoEnabled, true);
    await undo();
    const undone = await readCurve();
    assert.equal(undone.value, before.value);
    checkMidpoint(undone.midpoint, before.midpoint);
    await finish.focus();
    await redo();
    const redone = await readCurve();
    assert.equal(redone.value, value);
    checkMidpoint(redone.midpoint, expected);
    await f.same(source);
  }
  f.phase = 'Convert the last restored Bézier to Direct geometry';
  await f.sketchPanel().getByRole('button', { name: 'Make curves', exact: true }).click();
  await f.changed(source);
  await f.sketchPanel().waitFor({ state: 'hidden' });
  const saved = await f.snapshot('direct-curve');
  assert.equal(saved.doc.direct.objects.length, 1);
  const [curve] = Object.values(saved.doc.direct.sources);
  assert.match(curve, /degree: 3; knots: \[0,0,0,0,1,1,1,1\]; control-points: \[\[10,10,0\],\[20,38,0\],\[34,42,0\],\[44,10,0\]\]; weights: \[1,1,1,1\]/);
  await f.undo();
  await f.same(source);
  await f.redo();
  await f.same(saved.doc);
  assert.deepEqual(f.report.downloads, []);
});
