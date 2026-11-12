import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2];
const pins = ['apps/cad-studio/test/two-point-snap-offset-plane-browser.mjs', 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/sketch/useTwoPointSnap.ts', 'apps/cad-studio/src/sketch/TwoPointSnapControls.tsx',
  'apps/cad-studio/src/sketch/useSketchActions.ts', 'apps/cad-studio/src/viewport/Viewport.tsx',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts', 'apps/cad-studio/src/ui/SketchPanel.tsx',
  'packages/barocss-cad-model/src/sketch/osnap.ts', 'packages/barocss-cad-model/src/sketch/trim.ts'];
const f = await createFlow({
  name: 'two-point-snap-offset-plane', output, envFrozen: 'D794_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: 'Apply a signed distance on an offset XZ plane with grid off, and edit its source after project Open.',
  limits: ['One XZ plane offset 7 mm, one open construction line, one rectangular profile and one extrusion.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify(evaluateCadPart(toPartDocument(doc)).outputs.map(body => ({
  id: body.id, valid: checkOutput(body).valid, ...massPropertiesOf(body),
  corners: body.brep.vertices.map(vertex => vertex.point),
}))));
`,
});
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const form = () => f.page.getByRole('form', { name: 'Two-point snap', exact: true });
const start = () => button(f.sketchPanel(), 'Two-point snap').click();
const marker = () => f.page.locator('.vp-overlay .sk-osnap').filter({ hasText: 'Calculated' });
const near = (a, b) => assert.ok(Number.isFinite(a) && Math.abs(a - b) < 1e-8, `${a} versus ${b}`);
const plane = { origin: [0, -7, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] };
const A = [2, 4], B = [14, 9], first = [-4, 1.5], second = [8, 6.5];
const world = ([x, z], y = -7) => [x, y, z];
const screen = point => f.page.evaluate(point => window.__studioScreenOf(point), world(point));
async function clickPoint(point) {
  const onCanvas = ([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas');
  let pixel = await screen(point);
  for (let attempt = 0; attempt < 6 && !(await f.page.evaluate(onCanvas, pixel)); attempt++) {
    const bounds = await f.page.locator('canvas.vp-canvas').boundingBox();
    assert.ok(bounds);
    await f.page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await f.page.mouse.wheel(0, 400);
    await f.page.waitForFunction(([point, before]) => {
      const after = window.__studioScreenOf(point);
      return after && Math.hypot(after[0] - before[0], after[1] - before[1]) > 0.1;
    }, [world(point), pixel]);
    pixel = await screen(point);
  }
  assert.ok(pixel?.every(Number.isFinite));
  assert.ok(await f.page.evaluate(onCanvas, pixel), pixel);
  await f.page.mouse.move(...pixel);
  await f.page.mouse.click(...pixel);
}
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const project = 'D794 signed distance ' + randomUUID(), name = 'Untitled.bcad';
async function openProject() {
  if (!(await versions().isVisible())) await button(f.page, 'Project and versions').click();
  if (await versions().getByLabel('Project', { exact: true }).isVisible()) return;
  await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions(), 'Project in this browser').click();
  await versions().getByLabel('Project', { exact: true }).waitFor();
}
async function save(label, doc) {
  f.phase = 'save ' + label;
  await openProject();
  await button(f.page, 'Save').click();
  await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(name, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, name]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const directory = await projects.getDirectoryHandle(project);
    const file = await (await directory.getFileHandle(name)).getFile();
    return Array.from(new Uint8Array(await file.arrayBuffer()));
  }, [project, name]));
  assert.deepEqual(JSON.parse(bytes), doc);
  await writeFile(join(output, label + '.bcad'), bytes);
  f.report.observations.push({ label, savedBytes: bytes.length, savedSHA256: sha256(bytes) });
}
async function reopen(doc) {
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  await openProject();
  await button(versions(), 'Open ' + name).click();
  await f.same(doc);
}
async function body(label, doc) {
  await f.same(doc);
  const [native] = await f.inspect(label + '-native', doc);
  assert.equal(native.valid, true);
  near(native.volume, 180);
  [2, -8.5, 4].forEach((value, k) => near(native.centroid[k], value));
  assert.equal(native.corners.length, 8);
  for (const x of [-4, 8]) for (const y of [-10, -7]) for (const z of [1.5, 6.5])
    assert.ok(native.corners.some(point => Math.hypot(point[0] - x, point[1] - y, point[2] - z) < 1e-8), [x, y, z]);
  near((await f.bodies()).bodies[0].volume, 180);
}

await f.run(async () => {
  await f.newPage();
  await button(f.page, 'New part').click();
  await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.ready();
  const empty = await f.doc();
  await button(f.page.locator('.mode'), 'Sketch').click();
  await f.sketchPanel().waitFor();
  await f.sketchPanel().getByLabel('Sketch plane', { exact: true }).selectOption('xz');
  const offset = f.sketchPanel().getByLabel('Plane offset', { exact: true });
  await offset.fill('7');
  await f.tool('Line', 'l');
  await button(f.page, 'Construction').click();
  await clickPoint(A);
  await clickPoint(B);
  await button(f.page, 'Construction').click();
  await f.tool('Rectangle', 'r');

  f.phase = 'retire the selected endpoint on plane and visibility changes';
  await start();
  await clickPoint(A);
  await form().getByRole('status').getByText('Pick the second endpoint.').waitFor();
  await offset.fill('8');
  await form().waitFor({ state: 'hidden' });
  await offset.fill('7');
  await start();
  await clickPoint(A);
  await button(f.page, 'Hide construction').click();
  await form().waitFor({ state: 'hidden' });
  assert.equal(await button(f.sketchPanel(), 'Two-point snap').isVisible(), false);
  await button(f.page, 'Show construction').click();
  await f.same(empty);

  f.phase = 'apply a signed distance with the grid off';
  const grid = button(f.page, 'Grid snap');
  for (let i = 0; i < 6 && !(await grid.innerText()).includes('Grid off'); i++) await grid.click();
  assert.match(await grid.innerText(), /Grid off/);
  assert.equal(await f.sketchPanel().getByText('Grid 1 mm', { exact: true }).count(), 0);
  await start();
  await form().getByRole('status').getByText('Pick the first endpoint.').waitFor();
  await clickPoint(A);
  await clickPoint(B);
  await form().getByLabel('Snap measure').selectOption('distance');
  await form().getByLabel('Snap value').fill('-6.5');
  await form().getByRole('status').getByText('Point -4, 1.5 mm').waitFor();
  await marker().waitFor();
  const drawn = await marker().locator('rect').evaluate(rect => {
    const box = rect.getBoundingClientRect();
    return [box.left + box.width / 2, box.top + box.height / 2];
  });
  const projected = await screen(first);
  assert.ok(Math.hypot(drawn[0] - projected[0], drawn[1] - projected[1]) < 1);
  await f.snapshot('01-signed-distance');
  await button(form(), 'Use point').click();
  await form().waitFor({ state: 'hidden' });
  await f.same(empty);
  await clickPoint([8.04, 6.55]);
  const finished = await f.finishSketch('02-offset-sketch');
  assert.deepEqual(finished.doc.nodes[0].plane, plane);
  assert.deepEqual([finished.doc.nodes[0].min, finished.doc.nodes[0].max], [first, second]);
  assert.deepEqual(finished.doc.nodes[0].construction[0].points, [A, B]);
  await f.openExtrudeHud();
  const solid = await f.applyExtrude({ distance: 3, previous: finished.doc, label: '03-offset-body' });
  await body('03-offset-body', solid.doc);
  await save('before-trim', solid.doc);
  await reopen(solid.doc);

  f.phase = 'trim away the original second source endpoint after reopen';
  await f.openFeatureEditor(1, 'Extrude on offset XZ');
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
  await f.tool('Trim', 't');
  f.phase = 'click the construction line beyond its rectangle intersection';
  await clickPoint([11.6, 8]);
  const trimmed = await f.finishSketch('04-trimmed-construction');
  assert.deepEqual(trimmed.doc.nodes[0].construction.map(shape => shape.points), [[A, second]]);
  const expectedSketch = { ...solid.doc.nodes[0], construction: trimmed.doc.nodes[0].construction };
  assert.deepEqual(trimmed.doc.nodes, [expectedSketch, solid.doc.nodes[1]]);
  await body('04-unchanged-solid', trimmed.doc);
  await f.undo();
  await f.same(solid.doc);
  await f.redo();
  await f.same(trimmed.doc);
  await save('after-trim', trimmed.doc);
  await reopen(trimmed.doc);
  await body('05-reopened-trim', trimmed.doc);
  f.report.observations.push({ sourceEndpoints: [A, B], distanceMm: -6.5, calculatedMm: first, ordinaryMidpointMm: second, volumeMm3: 180 });
  assert.deepEqual(f.report.downloads, []);
});
