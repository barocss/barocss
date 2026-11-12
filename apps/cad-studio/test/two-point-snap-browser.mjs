import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2];
const pins = ['apps/cad-studio/test/two-point-snap-browser.mjs', 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/sketch/useTwoPointSnap.ts', 'apps/cad-studio/src/sketch/TwoPointSnapControls.tsx',
  'apps/cad-studio/src/ui/SketchPanel.tsx', 'apps/cad-studio/src/viewport/Viewport.tsx', 'apps/cad-studio/src/viewport/viewportPointerInput.ts', 'apps/cad-studio/src/viewport/sketchOverlay.tsx',
  'packages/barocss-cad-model/src/sketch/osnap.ts'];
const f = await createFlow({
  name: 'two-point-snap', output, envFrozen: 'D793_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: 'Use an exact two-point construction snap once, then use ordinary midpoint snap and persist the rectangle.',
  limits: ['One XY sketch with a visible construction line and one rectangle.'],
  snapshotExtra: () => ({
    snapForm: document.querySelector('form[aria-label="Two-point snap"]')?.textContent ?? null,
    rectangle: [...document.querySelectorAll('input[id^="sk-"]')].filter(input => ['sk-x', 'sk-y', 'sk-width', 'sk-height'].includes(input.id)).map(input => input.value),
    construction: [...document.querySelectorAll('.vp-overlay .sk-shape.construction')].map(el => el.getAttribute('points')),
  }),
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify(evaluateCadPart(toPartDocument(doc)).outputs.map(body => ({
  id: body.id, valid: checkOutput(body).valid, volume: massPropertiesOf(body).volume,
}))));
`,
});
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const form = () => f.page.getByRole('form', { name: 'Two-point snap', exact: true });
const start = () => button(f.sketchPanel(), 'Two-point snap').click();
const usePoint = () => button(form(), 'Use point');
const version = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const project = 'D793 snap ' + randomUUID();
async function openProject() {
  if (!(await version().isVisible())) await button(f.page, 'Project and versions').click();
  await version().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(version(), 'Project in this browser').click();
  await version().getByLabel('Project', { exact: true }).waitFor();
}
async function checkBody(label, doc) {
  await f.same(doc);
  const [body] = await f.inspect(label, doc);
  assert.equal(body.valid, true);
  assert.ok(Math.abs(body.volume - 50.375) < 1e-8);
  const actual = (await f.bodies()).bodies[0];
  assert.ok(Math.abs(actual.volume - 50.375) < 1e-8);
}

await f.run(async () => {
  await f.newPage();
  await button(f.page, 'New part').click();
  await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.ready();
  const empty = await f.doc();
  await button(f.page.locator('.mode'), 'Sketch').click();
  await f.sketchPanel().waitFor();
  await f.frame([[0, 0], [31, 13]]);
  await f.tool('Line', 'l');
  await f.page.keyboard.press('x');
  await f.worldClick([0, 0]);
  await f.worldClick([31, 13]);
  await f.page.keyboard.press('x');
  await f.tool('Rectangle', 'r');
  await f.same(empty);

  f.phase = 'duplicate endpoint refusal, distance preview and Escape';
  await button(f.sketchPanel(), 'Two-point snap').press('Enter');
  await form().waitFor();
  await f.worldClick([0, 0]);
  await f.worldClick([0, 0]);
  await form().getByRole('alert').getByText('Pick a different endpoint.').waitFor();
  assert.equal(await usePoint().isEnabled(), false);
  await f.worldClick([31, 13]);
  await form().getByLabel('Snap measure').selectOption('distance');
  const value = form().getByLabel('Snap value');
  await value.fill('-1');
  const status = await form().getByRole('status').innerText();
  const [x, y] = status.slice('Point '.length, -' mm'.length).split(', ').map(Number);
  assert.ok(Math.abs(x + 31 / Math.sqrt(1130)) < 1e-12 && Math.abs(y + 13 / Math.sqrt(1130)) < 1e-12, status);
  await f.snapshot('01-negative-distance-preview');
  await f.page.keyboard.press('Escape');
  await form().waitFor({ state: 'hidden' });
  await f.sketchPanel().waitFor();
  await f.same(empty);

  f.phase = 'tool changes retire the first endpoint without creating a draft';
  await start();
  await f.worldClick([0, 0]);
  await f.tool('Circle', 'c');
  await form().waitFor({ state: 'hidden' });
  await f.tool('Rectangle', 'r');
  await start();
  await form().getByRole('status').getByText('Pick the first endpoint.').waitFor();
  await f.worldClick([0, 0]);
  await f.worldClick([31, 13]);
  const marker = f.page.locator('.vp-overlay .sk-osnap').filter({ hasText: 'Calculated' });
  await value.fill('1/3');
  assert.equal(await usePoint().isEnabled(), false);
  await marker.waitFor({ state: 'hidden' });
  await value.fill('0.25');
  await form().getByRole('status').getByText('Point 7.75, 3.25 mm').waitFor();
  await marker.waitFor();
  const drawnPoint = await marker.locator('rect').evaluate(rect => {
    const box = rect.getBoundingClientRect();
    return [box.left + box.width / 2, box.top + box.height / 2];
  });
  const projected = await f.screenOf([7.75, 3.25]);
  assert.ok(Math.hypot(drawnPoint[0] - projected[0], drawnPoint[1] - projected[1]) < 1, { drawnPoint, projected });
  await f.same(empty);

  f.phase = 'one confirmation supplies only the first corner without re-snapping';
  await value.press('Enter');
  await form().waitFor({ state: 'hidden' });
  const placed = await f.snapshot('02-first-corner');
  assert.deepEqual(placed.doc, empty);
  assert.deepEqual(placed.rectangle.map(Number), [7.75, 3.25, 0, 0]);

  f.phase = 'retire the unfinished rectangle gesture and reuse the same construction';
  await f.tool('Circle', 'c');
  await f.tool('Rectangle', 'r');
  await start();
  await f.worldClick([0, 0]);
  await f.worldClick([31, 13]);
  await value.fill('0.25');
  await usePoint().click();
  await form().waitFor({ state: 'hidden' });
  await f.same(empty);
  const pixel = await f.screenOf([15.56, 6.54]);
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel));
  await f.worldClick([15.56, 6.54]);
  const drawn = await f.snapshot('03-ordinary-midpoint');
  assert.deepEqual(drawn.rectangle.map(Number), [7.75, 3.25, 7.75, 3.25]);
  assert.equal(drawn.construction.length, 1);
  const finished = await f.finishSketch('04-finished');
  const sketch = finished.doc.nodes[0];
  assert.deepEqual([sketch.min, sketch.max], [[7.75, 3.25], [15.5, 6.5]]);
  assert.deepEqual(sketch.construction.map(shape => shape.points), [[[0, 0], [31, 13]]]);
  assert.equal(sketch.association, undefined);

  await f.openExtrudeHud();
  const solid = await f.applyExtrude({ distance: 2, previous: finished.doc, label: '05-extrude' });
  await checkBody('05-native', solid.doc);
  await f.undo();
  await f.same(finished.doc);
  await f.redo();
  await f.same(solid.doc);

  f.phase = 'save and reopen the exact project file';
  await openProject();
  await button(f.page, 'Save').click();
  const name = 'Untitled.bcad';
  await version().getByRole('list', { name: 'Project documents', exact: true }).getByText(name, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, name]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const directory = await projects.getDirectoryHandle(project);
    const file = await (await directory.getFileHandle(name)).getFile();
    return Array.from(new Uint8Array(await file.arrayBuffer()));
  }, [project, name]));
  assert.deepEqual(JSON.parse(bytes), solid.doc);
  await writeFile(join(output, 'saved-two-point-snap.bcad'), bytes);
  f.report.observations.push({ savedBytes: bytes.length, savedSHA256: sha256(bytes), volumeMm3: 50.375 });
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  await openProject();
  await button(version(), 'Open ' + name).click();
  await checkBody('06-reopened-native', solid.doc);
  assert.deepEqual(f.report.downloads, []);
});
