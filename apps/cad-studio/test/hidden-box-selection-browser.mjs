// D714: actual desktop Studio Model and Print box selection with native visibility edits.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/hidden-box-selection-browser.mjs',
  'apps/cad-studio/src/ui/BodyBrowserRows.tsx',
  'apps/cad-studio/src/viewport/Viewport.tsx',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'apps/cad-studio/src/viewport/useViewportPicking.ts',
  'apps/cad-studio/src/viewport/printProjection.ts',
];
const f = await createFlow({
  name: 'hidden-box-selection', output, envFrozen: 'D714_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce hidden native body selection in idle Model' : 'Use the current native visibility when box selection completes',
  limits: ['Two top-level boxes. Actual Studio visibility buttons and pointer events.'],
  inspectorSource: `
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
const doc = JSON.parse(process.argv[3]).reduce((doc, minX) => {
  const sketch = doc.nodes.length;
  return withNode(withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [minX,-3], max: [minX+6,3] }),
    { kind: 'extrude', sketch, height: 6 });
}, emptyDoc());
console.log(JSON.stringify(doc));
`,
});

const cornerSet = x => [x, x + 6].flatMap(xx => [-3, 3].flatMap(y => [0, 6].map(z => [xx, y, z])));
const boxOf = (points, margin = 12) => {
  assert.ok(points.every(p => p?.every(Number.isFinite)), JSON.stringify(points));
  return [[Math.min(...points.map(p => p[0])) - margin, Math.min(...points.map(p => p[1])) - margin],
    [Math.max(...points.map(p => p[0])) + margin, Math.max(...points.map(p => p[1])) + margin]];
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
  const page = f.page, mouse = page.mouse;
  const top = () => page.locator('.views').getByRole('button', { name: 'Top', exact: true }).click();
  const ortho = page.locator('.views').getByRole('button', { name: 'Ortho', exact: true });
  const marquee = page.locator('.vp-overlay .marquee');
  const row = i => page.locator('.ol-row').filter({ has: page.locator('button.ol-eye') }).nth(i);
  const modelProject = x => page.evaluate(points => points.map(p => window.__studioScreenOf(p)), cornerSet(x));
  const open = async (label, order) => {
    f.phase = 'Open ' + label;
    const doc = await f.inspect(label, {}, order);
    const path = join(output, label + '.bcad');
    await writeFile(path, JSON.stringify(doc));
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Open', exact: true }).click()]);
    await chooser.setFiles(path);
    await f.same(doc);
    if (await ortho.getAttribute('aria-pressed') !== 'true') await ortho.click();
    await top();
    return f.snapshot(label + '-opened');
  };
  const visibility = async (index, hide, useKeyboard = false) => {
    const button = row(index).getByRole('button', { name: hide ? 'Hide body' : 'Show body', exact: true });
    if (useKeyboard) { await button.focus(); await page.keyboard.press('Space'); }
    else await button.click();
    await row(index).getByRole('button', { name: hide ? 'Show body' : 'Hide body', exact: true }).waitFor();
    await f.ready();
  };
  const native = async () => ({ doc: await f.doc(), bodies: await f.bodies(),
    history: await page.locator('.history .hs').evaluateAll(rows => rows.map(row => row.getAttribute('aria-label'))) });
  const assertSelection = (after, before, expected) => {
    assert.deepEqual(after.selection.selection.bodies, expected);
    assert.deepEqual(after.selection.selection.faces, []);
    assert.deepEqual(after.selection.selection.edges, []);
    for (const field of ['doc', 'bodies', 'history']) assert.deepEqual(after[field], before[field], field);
  };
  const begin = async ([left, right], crossing = false) => {
    const [a, b] = crossing ? [right, left] : [left, right];
    for (const at of [a, b]) assert.ok(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.matches('canvas.vp-canvas'), at), JSON.stringify(at));
    await mouse.move(...a);
    await mouse.down();
    await mouse.move(...b, { steps: 10 });
    await marquee.waitFor({ state: 'attached' });
    assert.equal(await marquee.evaluate(el => el.classList.contains('crossing')), crossing);
  };
  const drag = async (label, rect, expected, { crossing = false, additive = false } = {}) => {
    f.phase = label;
    const before = await native();
    if (additive) await page.keyboard.down('Shift');
    await begin(rect, crossing);
    await mouse.up();
    if (additive) await page.keyboard.up('Shift');
    await marquee.waitFor({ state: 'detached' });
    const after = await f.snapshot(label);
    assertSelection(after, before, expected);
  };

  await open('pair', [-9, 3]);
  const left = await modelProject(-9), right = await modelProject(3);
  const both = boxOf([...left, ...right]), visibleOnly = boxOf(left), hiddenOnly = boxOf(right);
  await visibility(1, true);
  const hidden = await f.snapshot('right-hidden');
  assert.equal(hidden.doc.bodies?.b3?.hidden, true);
  await drag('hidden-window', both, baseline ? [0, 1] : [0]);
  await drag('hidden-crossing', both, baseline ? [0, 1] : [0], { crossing: true });
  if (baseline) return;

  await drag('visible-only', visibleOnly, [0]);
  await drag('hidden-only-shift', hiddenOnly, [0], { crossing: true, additive: true });
  await drag('hidden-only', hiddenOnly, []);
  await drag('empty-window', [[both[0][0], both[0][1] - 35], [both[1][0], both[0][1] - 15]], []);
  await visibility(1, false);
  await drag('both-shown', both, [0, 1]);
  await visibility(1, true);
  await drag('hidden-again', both, [0]);
  await row(1).locator('button.ol').click();
  await drag('retain-tree-selection', visibleOnly, [1, 0], { additive: true });

  await visibility(1, false);
  f.phase = 'Hide the right box during a held marquee';
  await begin(both);
  await visibility(1, true, true);
  const held = await native();
  const continued = await marquee.count() === 1;
  await mouse.up();
  await marquee.waitFor({ state: 'detached' });
  assertSelection(await f.snapshot('hide-during-drag'), held, continued ? [0] : []);

  await open('reordered', [3, -9]);
  const reversedBoth = boxOf([...(await modelProject(-9)), ...(await modelProject(3))]);
  await visibility(0, true);
  await drag('reordered-window', reversedBoth, [1]);

  f.phase = 'Enter the actual Print preview';
  await page.getByLabel('Preview: Print', { exact: true }).click();
  await page.waitForFunction(() => !!window.__studioPrint?.().display);
  await top();
  const canvas = await page.locator('canvas.vp-canvas').boundingBox();
  assert.ok(canvas);
  const initial = await page.evaluate(() => window.__studioEye());
  await mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await mouse.wheel(0, 900);
  await page.waitForFunction(eye => window.__studioEye().some((v, i) => v !== eye[i]), initial);
  const printProject = x => page.evaluate(points => {
    const display = window.__studioPrint().display, m = display.summary.modelToBed;
    return points.map(([x, y, z]) => {
      const bed = [0, 1, 2].map(k => m[k] * x + m[k + 4] * y + m[k + 8] * z + m[k + 12]);
      if (display.printed) bed[2] = Math.min(display.top, bed[2]);
      return window.__studioScreenOf(bed);
    });
  }, cornerSet(x));
  const printHidden = await printProject(3), printVisible = await printProject(-9);
  await drag('print-hidden-only', boxOf(printHidden), []);
  await drag('print-crossing', boxOf([...printHidden, ...printVisible]), [1], { crossing: true });
  await page.getByLabel('Preview: None', { exact: true }).click();
  await page.waitForFunction(() => !window.__studioPrint?.().display);
});
