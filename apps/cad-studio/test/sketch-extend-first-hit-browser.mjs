// D715: actual Sketch Extend preview, click and Finish against authored line boundaries.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/sketch-extend-first-hit-browser.mjs',
  'apps/cad-studio/src/sketch/useSketchActions.ts',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'apps/cad-studio/src/viewport/sketchOverlay.tsx',
  'packages/barocss-cad-model/src/sketch/trim.ts',
];
const f = await createFlow({
  name: 'sketch-extend-first-hit', output, envFrozen: 'D715_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce the skipped first Sketch Extend intersection' : 'Keep the nearest Sketch Extend intersection under translation and distant geometry',
  limits: ['Desktop native planar sketch and actual pointer action. The independent endpoint is the authored crossing.'],
  inspectorSource: `
import assert from 'node:assert/strict';
import { withNode, emptyDoc } from '@barocss/cad-model/engine/doc';
import { encodeStudioFile, readStudioFile } from '@barocss/cad-model/engine/container';
const { offset, distant, far, gap, stable } = JSON.parse(process.argv[3]);
const line = (a, b, id, tag) => ({ kind: 'polygon', points: [a,b], bulges: [0,0], closed: false, construction: true,
  ids: stable ? ['e'+tag, 'e'+(tag+1)] : [id] });
const x = offset;
const construction = [
  line([x,0], [x+1,0], 'source', 4), line([x+1+gap,-1], [x+1+gap,1], 'near', 6),
  ...(far ? [line([x+2,-1], [x+2,1], 'far', 8)] : []),
  ...(distant ? [line([8192,3], [8193,3], 'distant', 10)] : []),
];
const source = withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle',
  min: [x-1,-3], max: [x+3,-2], construction, ...(stable ? { sideTags: { outer: ['e0','e1','e2','e3'] } } : {}) });
const part = withNode(source, { kind: 'extrude', sketch: 0, height: 1 });
const bytes = encodeStudioFile(part), opened = await readStudioFile(bytes);
assert.ok(!('error' in opened), JSON.stringify(opened));
console.log(JSON.stringify({ doc: opened.doc, bytes: Buffer.from(bytes).toString('base64') }));
`,
});

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
  const page = f.page;
  const button = name => page.getByRole('button', { name, exact: true });
  const screen = (x, y) => page.evaluate(p => window.__studioScreenOf(p), [x, y, 0]);
  const project = 'D715 Extend';
  const panel = page.getByRole('complementary', { name: 'Versions panel', exact: true });
  if (!baseline) {
    await button('Project and versions').click();
    await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
    await panel.getByRole('button', { name: 'Project in this browser', exact: true }).click();
  }
  const chooseFile = async path => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles(path);
  };
  const cases = [
    { label: 'local', offset: 0, distant: false, far: true },
    { label: 'translated', offset: 8192, distant: false, far: true },
    { label: 'distant', offset: 0, distant: true, far: true },
    ...(baseline ? [] : [
      { label: 'near-only', offset: -8192, distant: false, far: false },
      { label: 'below-storage-precision', offset: 0, distant: false, far: true, gap: 2 ** -22 },
    ]),
  ];
  let saved;
  for (const { label, offset, distant, far, gap = 1 / 64 } of cases) {
    f.phase = 'Open ' + label;
    const stable = label === 'near-only';
    const fixture = await f.inspect(label, {}, { offset, distant, far, gap, stable });
    const file = join(output, label + '.bcad');
    await writeFile(file, Buffer.from(fixture.bytes, 'base64'));
    await chooseFile(file);
    await f.same(fixture.doc);
    await page.locator('.history .hs[data-node-index="1"]').click();
    await f.editor().getByRole('button', { name: 'Edit sketch', exact: true }).click();
    await f.sketchPanel().waitFor();
    const preview = page.locator('polyline.sk-extend');
    assert.equal(await preview.count(), 0);
    await button('Extend').click();
    const click = await screen(offset + 0.75, 0);
    assert.ok(click?.every(Number.isFinite));
    assert.ok(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.matches('canvas.vp-canvas'), click), JSON.stringify(click));
    await page.mouse.move(...click);
    if (!baseline && label === 'local') {
      f.phase = 'Observe the separate hidden construction scope';
      await button('Hide construction').click();
      assert.equal(await page.locator('.sk-shape.done.construction').count(), 0);
      await page.mouse.move(...click);
      await preview.waitFor({ state: 'attached' });
      f.report.observations.push({ label: 'hidden construction follow-up #2312', hiddenOutline: true, extendPreview: true });
      await f.snapshot('hidden-construction-preview');
      await button('Show construction').click();
      await page.mouse.move(...click);
    }
    if (label === 'below-storage-precision') {
      const before = await f.snapshot('refusal-before');
      assert.equal(await preview.count(), 0);
      await page.mouse.click(...click);
      await f.waitToast(/The first crossing cannot be resolved at sketch precision/);
      const refused = await f.snapshot('refusal-after');
      for (const field of ['doc', 'bodies', 'history']) assert.deepEqual(refused[field], before[field]);
      assert.equal(await preview.count(), 0);
      continue;
    }
    await preview.waitFor({ state: 'attached' });
    if (!baseline && label === 'translated') {
      await button('Trim').click();
      await preview.waitFor({ state: 'detached' });
      await f.same(fixture.doc);
      await button('Extend').click();
      await page.mouse.move(...click);
      await preview.waitFor({ state: 'attached' });
    }
    const endpoint = await preview.evaluate(node => {
      const last = node.points.getItem(node.points.numberOfItems - 1);
      const p = new DOMPoint(last.x, last.y).matrixTransform(node.getScreenCTM());
      return [p.x, p.y];
    });
    const expectedX = offset + (baseline && label !== 'local' ? 2 : 65 / 64);
    const expected = await screen(expectedX, 0);
    assert.ok(Math.hypot(endpoint[0] - expected[0], endpoint[1] - expected[1]) < 0.25, JSON.stringify({ endpoint, expected }));
    await f.snapshot(label + '-preview');
    await page.mouse.click(...click);
    if (stable) {
      await page.mouse.move(click[0] + 35, click[1] + 30);
      await page.mouse.move(...click);
      await preview.waitFor({ state: 'detached' });
      await page.mouse.click(...click);
      await f.waitToast(/Nothing lies ahead of that end/);
      await f.snapshot('near-only-repeat-refused');
    }
    await page.locator('.topbar button.finish').click();
    await f.sketchPanel().waitFor({ state: 'hidden' });
    await f.changed(fixture.doc);
    const applied = await f.snapshot(label + '-applied');
    const source = applied.doc.nodes[0].construction.find(shape => shape.points?.[0]?.[0] === offset && shape.points[0][1] === 0);
    assert.deepEqual(source?.points, [[offset, 0], [expectedX, 0]], JSON.stringify(applied.doc.nodes[0].construction));
    if (stable) {
      assert.equal(source.ids[0], 'e4');
      assert.equal(source.construction, true);
      const boundary = applied.doc.nodes[0].construction.find(shape => shape.ids?.includes('e6'));
      assert.deepEqual(boundary.ids, ['e6', 'e7']);
      assert.deepEqual(boundary.points, fixture.doc.nodes[0].construction[1].points);
      assert.equal(boundary.construction, true);
      assert.deepEqual(applied.doc.nodes[0].sideTags, fixture.doc.nodes[0].sideTags);
    }
    assert.equal(applied.bodies.bodies.length, 1);
    for (const b of applied.bodies.bodies) assert.ok(Math.abs(b.volume - 4) < 1e-8);
    f.report.observations.push({ label, sourceEnd: source.points.at(-1), independentExpectedX: offset + 65 / 64, previewCSS: endpoint, expectedCSS: expected });
    if (!baseline && label === 'translated') {
      await f.undo();
      await f.same(fixture.doc);
      await f.snapshot('translated-undo');
      await f.redo();
      await f.same(applied.doc);
      await f.snapshot('translated-redo');
      if (!(await panel.isVisible())) await button('Project and versions').click();
      await button('Save').click();
      await panel.getByRole('list', { name: 'Project documents', exact: true }).getByText('translated.bcad', { exact: true }).waitFor();
      const bytes = Buffer.from(await page.evaluate(async project => {
        const root = await navigator.storage.getDirectory();
        const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
        return [...new Uint8Array(await (await (await dir.getFileHandle('translated.bcad')).getFile()).arrayBuffer())];
      }, project));
      assert.deepEqual(JSON.parse(bytes.toString()), applied.doc);
      const path = join(output, 'studio-translated.bcad');
      await writeFile(path, bytes);
      saved = { path, doc: applied.doc };
    }
  }
  if (!baseline) {
    f.phase = 'Open the exact native bytes saved by Studio';
    assert.ok(saved);
    await f.newPage();
    const reopened = f.page;
    const [chooser] = await Promise.all([reopened.waitForEvent('filechooser'), reopened.getByRole('button', { name: 'Open', exact: true }).click()]);
    await chooser.setFiles(saved.path);
    await f.same(saved.doc);
    const before = await f.snapshot('translated-native-reopen');
    await reopened.locator('.history .hs[data-node-index="1"]').click();
    await f.editor().getByRole('button', { name: 'Edit sketch', exact: true }).click();
    await f.sketchPanel().waitFor();
    const projectPoint = p => reopened.evaluate(p => window.__studioScreenOf(p), p);
    const start = await projectPoint([8192, 0, 0]), expectedEnd = await projectPoint([8192 + 65 / 64, 0, 0]);
    const reopenedLines = await reopened.locator('polyline.sk-shape.open.construction').evaluateAll(lines =>
      lines.map(node => [0, node.points.numberOfItems - 1].map(i => {
        const p = node.points.getItem(i), q = new DOMPoint(p.x, p.y).matrixTransform(node.getScreenCTM());
        return [q.x, q.y];
      })));
    const nearPixel = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.25;
    assert.ok(reopenedLines.some(([a, b]) => nearPixel(a, start) && nearPixel(b, expectedEnd)), JSON.stringify(reopenedLines));
    await reopened.getByRole('button', { name: 'Extend', exact: true }).click();
    const click = await projectPoint([8192.75, 0, 0]);
    await reopened.mouse.move(...click);
    await reopened.locator('polyline.sk-extend').waitFor({ state: 'attached' });
    await reopened.mouse.click(...click);
    await reopened.keyboard.press('Escape');
    await f.sketchPanel().waitFor({ state: 'hidden' });
    const cancelled = await f.snapshot('translated-reopened-cancelled');
    for (const field of ['doc', 'bodies', 'history']) assert.deepEqual(cancelled[field], before[field]);
    assert.equal(await reopened.locator('polyline.sk-extend').count(), 0);
  }
});
