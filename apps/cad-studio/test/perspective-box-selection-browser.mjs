// D713: native boxes, real view controls and actual desktop selection drags.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/perspective-box-selection-browser.mjs',
  ...(baseline ? [] : ['apps/cad-studio/src/viewport/boxSelectionDepth.ts']),
  'apps/cad-studio/src/viewport/Viewport.tsx',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'apps/cad-studio/src/viewport/camera.ts',
  'apps/cad-studio/src/viewport/useViewportPicking.ts',
];
const f = await createFlow({
  name: 'perspective-box-selection', output, envFrozen: 'D713_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce perspective box selection of a body behind the eye' : 'Select the current front body in perspective',
  limits: ['Idle Model and native top-level boxes. Camera changes use Studio controls and mouse wheel.'],
  inspectorSource: `
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
const box = (doc, [from, half = 1]) => {
  const sketch = doc.nodes.length;
  return withNode(withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [-half,-half], max: [half,half] }),
    { kind: 'extrude', sketch, height: 2, from });
};
console.log(JSON.stringify(JSON.parse(process.argv[3]).reduce(box, emptyDoc())));
`,
});

const corners = ([z, half = 1]) => [-half, half].flatMap(x => [-half, half].flatMap(y => [z, z + 2].map(zz => [x, y, zz])));
const bounds = points => {
  assert.ok(points.every(p => p?.every(Number.isFinite)), JSON.stringify(points));
  return [0, 1].map(axis => [Math.min(...points.map(p => p[axis])), Math.max(...points.map(p => p[axis]))]);
};
const boxOf = (points, margin = 10) => {
  const [[lx, hx], [ly, hy]] = bounds(points);
  return [[lx - margin, ly - margin], [hx + margin, hy + margin]];
};

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  await f.newPage();
  const page = f.page, mouse = page.mouse, canvas = page.locator('canvas.vp-canvas');
  const view = page.locator('.views');
  const ortho = view.getByRole('button', { name: 'Ortho', exact: true });
  const readEye = () => page.evaluate(() => window.__studioEye());
  const area = await canvas.boundingBox();
  assert.ok(area);
  const center = [area.x + area.width / 2, area.y + area.height / 2];
  const marquee = page.locator('.vp-overlay .marquee');
  const top = async () => {
    await view.getByRole('button', { name: 'Top', exact: true }).click();
    await page.waitForFunction(() => window.__studioEye()?.[2] > 45);
  };
  const open = async (label, boxes) => {
    f.phase = 'Open ' + label;
    const doc = await f.inspect(label, {}, boxes);
    const path = join(output, label + '.bcad');
    await writeFile(path, JSON.stringify(doc));
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Open', exact: true }).click()]);
    await chooser.setFiles(path);
    await f.same(doc);
    if (await ortho.getAttribute('aria-pressed') === 'true') await ortho.click();
    await top();
    return f.snapshot(label + '-opened');
  };
  const project = boxes => page.evaluate(points => points.map(p => window.__studioScreenOf(p)), boxes.flatMap(corners));
  const pan = async (dx, dy) => {
    await mouse.move(...center);
    await mouse.down({ button: 'middle' });
    await mouse.move(center[0] + dx, center[1] + dy, { steps: 8 });
    await mouse.up({ button: 'middle' });
  };
  const zoomBetween = async (recenter = 1) => {
    for (let i = 0; i < recenter; i++) {
      const p = await page.evaluate(() => window.__studioScreenOf([0, 0, 21]));
      assert.ok(p);
      await pan(center[0] - p[0], center[1] - p[1]);
    }
    const beforeZoom = await readEye();
    await mouse.move(...center);
    await mouse.wheel(0, Math.log(5 / (beforeZoom[2] - 21)) / 0.0015);
    await page.waitForFunction(() => Math.abs(window.__studioEye()?.[2] - 26) < 0.4);
    return readEye();
  };
  let before;
  const drag = async (label, [left, right], expected, { crossing = false, additive = false } = {}) => {
    f.phase = label;
    const [a, b] = crossing ? [right, left] : [left, right];
    for (const at of [a, b]) {
      const target = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.matches('canvas.vp-canvas'), at);
      assert.ok(target, JSON.stringify({ at, area, eye: await readEye() }));
    }
    await mouse.move(...a);
    if (additive) await page.keyboard.down('Shift');
    await mouse.down();
    await mouse.move(...b, { steps: 12 });
    await marquee.waitFor({ state: 'attached' });
    assert.equal(await marquee.evaluate(el => el.classList.contains('crossing')), crossing);
    await mouse.up();
    if (additive) await page.keyboard.up('Shift');
    await marquee.waitFor({ state: 'detached' });
    const after = await f.snapshot(label);
    assert.deepEqual(after.selection.selection.bodies, expected);
    assert.deepEqual(after.selection.selection.faces, []);
    assert.deepEqual(after.selection.selection.edges, []);
    for (const field of ['doc', 'bodies', 'history']) assert.deepEqual(after[field], before[field], field);
  };
  const pair = [[0], [40]];
  before = await open('pair', pair);
  if (!baseline) await drag('both-in-front', boxOf(await project(pair)), [0, 1]);
  await page.keyboard.press('Escape');
  const eye = await zoomBetween();
  const projections = await project(pair), rect = boxOf(projections, 15);
  f.report.observations.push({ label: 'perspective camera and projection', eye, projections, rect });
  await drag('window', rect, baseline ? [0, 1] : [0]);
  await drag('crossing', rect, baseline ? [0, 1] : [0], { crossing: true });
  if (baseline) return;

  await pan(area.height * 0.18, 0);
  const shifted = await project(pair);
  const front = shifted.slice(0, 8), rear = shifted.slice(8);
  const frontRect = boxOf(front, 8), rearRect = boxOf(rear, 8);
  assert.ok(Math.max(...front.map(p => p[0])) > rearRect[1][0]);
  assert.ok(Math.min(...rear.map(p => p[0])) < frontRect[0][0]);
  await drag('rear-only-window', rearRect, []);
  await drag('front-only-window', frontRect, [0]);
  const rearOnly = boxOf([rear.reduce((a, b) => a[0] < b[0] ? a : b)], 10);
  const frontOnly = boxOf([front.reduce((a, b) => a[0] > b[0] ? a : b)], 10);
  await drag('rear-only-crossing-additive', rearOnly, [0], { crossing: true, additive: true });
  await drag('rear-only-crossing', rearOnly, [], { crossing: true });
  await drag('front-only-crossing', frontOnly, [0], { crossing: true });
  await page.locator('.ol-row').filter({ has: page.getByRole('button', { name: 'Hide body', exact: true }) }).nth(1).locator('button.ol').click();
  await drag('retain-explicit-selection', frontOnly, [1, 0], { crossing: true, additive: true });
  await drag('empty-window', [[center[0] + 170, center[1] - 175], [center[0] + 190, center[1] - 155]], []);
  await top();
  await drag('both-in-front-again', boxOf(await project(pair)), [0, 1]);
  await page.keyboard.press('Escape');
  await view.getByRole('button', { name: 'Right', exact: true }).click();
  await drag('rotated-window', boxOf(await project(pair)), [0, 1]);
  await page.keyboard.press('Escape');
  await top();
  await ortho.click();
  assert.equal(await ortho.getAttribute('aria-pressed'), 'true');
  await drag('orthographic-window', boxOf(await project(pair)), [0, 1]);

  const reordered = [[40], [0]];
  before = await open('reordered', reordered);
  await zoomBetween();
  await drag('reordered-window', boxOf(await project(reordered)), [1]);

  const withStraddle = [[0], [25, 0.08], [40]];
  before = await open('with-straddle', withStraddle);
  const straddleEye = await zoomBetween(3);
  assert.ok(straddleEye[2] > 25 && straddleEye[2] < 27, JSON.stringify(straddleEye));
  await drag('straddle-crossing', boxOf(await project(withStraddle)), [0, 1], { crossing: true });
});
