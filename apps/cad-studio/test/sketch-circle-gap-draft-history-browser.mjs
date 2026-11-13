import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const repair = process.argv[3] === '--repair-reopened';
const reopened = repair || process.argv[3] === '--reopened';
const pins = [
  'apps/cad-studio/test/sketch-circle-gap-draft-history-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/sketch/draftHistory.ts',
  'apps/cad-studio/src/sketch/usePathGap.ts',
  'apps/cad-studio/src/sketch/pathGap.ts',
];
const f = await createFlow({
  name: 'sketch-circle-gap-draft-history',
  output: process.argv[2],
  envFrozen: repair ? 'D1137_SOURCE_FROZEN' : reopened ? 'D1136_SOURCE_FROZEN' : 'D1074_SOURCE_FROZEN',
  qualification: 'Undo and redo a 4 mm gap in a new ordinary circle.',
  limits: ['One new 10 mm radius XY circle in desktop WebGPU.'],
  initialFiles: pins, requiredFrozen: pins,
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify(evaluateCadPart(toPartDocument(doc)).outputs.map(output => ({
  id: output.id, valid: checkOutput(output).valid, ...massPropertiesOf(output),
}))));
`,
});
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const outline = () => f.page.locator('.vp-overlay .sk-shape.done');
const geometry = () => outline().evaluateAll(nodes => nodes.map(node => [node.localName, node.getAttribute('points')]));
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
  if (reopened) {
    const source = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
      nodes: [{ kind: 'sketch', profile: 'circle', id: 'n0', center: [20, 20], radius: 10, sideTags: { outer: ['e7'] } },
        { kind: 'extrude', id: 'n1', sketch: 0, height: 2 }], outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2 };
    const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles({ name: 'D1136-ordinary-circle.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
    await f.same(source);
    await button('Cylinder 2', f.page.getByRole('group', { name: 'History', exact: true })).click();
    await button('Edit sketch', f.editor()).click();
    await f.sketchPanel().waitFor();
    await f.frame([[10, 10], [30, 30]]);
    await f.tool('Trim', 't');
    f.phase = 'expose Cut circle gap in the reopened ordinary Circle';
    const circle = await geometry();
    assert.deepEqual(circle.map(([tag]) => tag), ['polygon']);
    await f.snapshot('01-reopened-trim-before-gap');
    await button('Cut circle gap', f.sketchPanel()).click({ timeout: 3000 });
    await f.sketchPanel().getByLabel('Gap length', { exact: true }).fill('4');
    const position = await f.screenOf([20, 30]);
    await f.page.mouse.move(...position);
    await f.page.locator('.vp-overlay .sk-path-gap').waitFor({ state: 'attached' });
    await f.page.mouse.click(...position);
    const arc = await geometry();
    assert.deepEqual(arc.map(([tag]) => tag), ['polyline']);
    await f.page.locator('.topbar button.finish').click();
    await f.sketchPanel().getByRole('alert').getByText(/open chain/i).waitFor();
    await f.same(source);
    await f.snapshot('02-reopened-open-arc');
    await keyboard('Meta+z');
    assert.deepEqual(await geometry(), circle);
    assert.equal(await f.sketchAlert(), null);
    await f.redo();
    assert.deepEqual(await geometry(), arc);
    if (repair) {
      f.phase = 'close the reopened gap and update the existing extrusion';
      const a = [20 + 10 * Math.sin(0.2), 20 + 10 * Math.cos(0.2)];
      const b = [20 - 10 * Math.sin(0.2), 20 + 10 * Math.cos(0.2)];
      await f.tool('Line', 'l');
      await f.worldClick(a);
      await f.worldClick(b);
      const changed = (await f.finishSketch('03-reopened-arc-closed')).doc;
      const [outline, extrude] = changed.nodes;
      assert.equal(outline.id, 'n0');
      assert.equal(outline.profile, 'loop');
      assert.deepEqual(outline.segments.map(segment => segment.kind).sort(), ['arc', 'line']);
      assert.deepEqual(extrude, source.nodes[1]);
      const start = outline.segments.find(segment => segment.kind === 'arc').start;
      const end = outline.segments.find(segment => segment.kind === 'line').start;
      assert.ok(Math.hypot(start[0] - b[0], start[1] - b[1]) < 3e-6, JSON.stringify(start));
      assert.ok(Math.hypot(end[0] - a[0], end[1] - a[1]) < 3e-6, JSON.stringify(end));
      const expected = 100 * (2 * Math.PI - 0.4 + Math.sin(0.4));
      const [body] = await f.inspect('repaired-native', changed);
      assert.equal(body.id, 'n1');
      assert.equal(body.valid, true);
      assert.ok(Math.abs(body.volume - expected) < 0.002);
      await f.undo();
      await f.same(source);
      await f.redo();
      await f.same(changed);

      const name = 'D1136-ordinary-circle.bcad';
      const project = 'D1137 reopened circle ' + randomUUID();
      const versions = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
      await button('Project and versions').click();
      await versions.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
      await button('Project in this browser', versions).click();
      await versions.getByLabel('Project', { exact: true }).waitFor();
      await button('Save').click();
      await versions.getByRole('list', { name: 'Project documents', exact: true }).getByText(name, { exact: true }).waitFor();
      await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
      const bytes = Buffer.from(await f.page.evaluate(async ([project, name]) => {
        const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
        const dir = await projects.getDirectoryHandle(project);
        return Array.from(new Uint8Array(await (await (await dir.getFileHandle(name)).getFile()).arrayBuffer()));
      }, [project, name]));
      assert.deepEqual(JSON.parse(bytes), changed);
      const saved = join(f.output, 'repaired-reopened-circle.bcad');
      await writeFile(saved, bytes);
      f.report.files.push({ name, bytes: bytes.length, sha256: sha256(bytes) });
      await f.freshOpen(saved, changed, '04-repaired-fresh-open');
      assert.deepEqual(await f.inspect('reopened-repair-native', changed), [body]);
      f.report.observations.push({ label: 'repaired-native', expectedVolumeMM3: expected, volumeMM3: body.volume, centroidMM: body.centroid });
      assert.deepEqual(f.report.downloads, []);
      return;
    }
    await f.undo();
    assert.deepEqual(await geometry(), circle);
    const restored = (await f.finishSketch('03-reopened-no-op-finish')).doc;
    assert.deepEqual(restored, source);
    assert.ok(Math.abs((await f.bodies()).bodies[0].volume - 200 * Math.PI) < 1e-8);
    assert.deepEqual(f.report.downloads, []);
    return;
  }
  await button('New part').click();
  await f.page.waitForFunction(() => window.__studioDoc?.nodes.length === 0);
  await f.ready();
  const blank = await f.doc();
  await button('Sketch', f.page.locator('.mode')).click();
  await f.sketchPanel().waitFor();
  await f.tool('Circle', 'c');
  await f.frame([[10, 10], [30, 30]]);
  await f.worldClick([20, 20]);
  await f.worldClick([30, 20]);
  await f.tool('Trim', 't');
  const circle = await geometry();
  assert.deepEqual(circle.map(([tag]) => tag), ['polygon']);
  await button('Cut circle gap', f.sketchPanel()).click();
  await f.sketchPanel().getByLabel('Gap length', { exact: true }).fill('4');
  const pixel = await f.screenOf([20, 30]);
  assert.ok(await f.page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.matches('canvas.vp-canvas'), pixel));
  await f.page.mouse.move(...pixel);
  await f.page.locator('.vp-overlay .sk-path-gap').waitFor({ state: 'attached' });
  await f.page.mouse.click(...pixel);
  const arc = await geometry();
  assert.deepEqual(arc.map(([tag]) => tag), ['polyline']);
  await f.page.locator('.topbar button.finish').click();
  const alert = f.sketchPanel().getByRole('alert').getByText(/Close or trim the open chain/);
  await alert.waitFor();
  await f.same(blank);
  await f.snapshot('01-open-arc-refused');

  f.phase = 'Undo restores the exact circle and clears the open-chain message';
  await keyboard('Meta+z');
  const restored = await geometry();
  f.report.observations.push({ restoredCircle: JSON.stringify(restored) === JSON.stringify(circle) });
  await f.snapshot('02-after-keyboard-undo');
  assert.deepEqual(restored, circle);
  await alert.waitFor({ state: 'hidden' });
  await button('Redo').click();
  assert.deepEqual(await geometry(), arc);
  await button('Undo').click();
  assert.deepEqual(await geometry(), circle);
  await keyboard('Meta+Shift+z');
  assert.deepEqual(await geometry(), arc);
  await button('Undo').click();
  assert.deepEqual(await geometry(), circle);
  await f.same(blank);

  const finished = await f.finishSketch('03-restored-circle');
  const [sketch] = finished.doc.nodes;
  assert.equal(sketch.profile, 'circle');
  assert.deepEqual(sketch.center, [20, 20]);
  assert.equal(sketch.radius, 10);
  await f.openExtrudeHud();
  const solid = await f.applyExtrude({ distance: 2, previous: finished.doc, label: '04-circle' });
  assert.equal(solid.bodies.bodies.length, 1);
  assert.ok(Math.abs(solid.bodies.bodies[0].volume - 200 * Math.PI) < 1e-8);
  await button('Undo').click();
  await f.same(finished.doc);
  await button('Redo').click();
  await f.same(solid.doc);
  assert.deepEqual(f.report.downloads, []);
});
