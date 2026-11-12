import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2];
const pins = ['apps/cad-studio/test/arc-midpoint-after-trim-browser.mjs', 'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'apps/cad-studio/src/sketch/useSketchActions.ts', 'packages/barocss-cad-model/src/sketch/osnap.ts', 'packages/barocss-cad-model/src/sketch/trim.ts'];
const f = await createFlow({
  name: 'arc-midpoint-after-trim', output, envFrozen: 'D796_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: 'Place a corner at the midpoint of a clockwise major arc on offset XZ, trim it, and use the surviving arc midpoint.',
  limits: ['One open construction arc and one crossing construction line. The native fixture enters through File Open.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify(evaluateCadPart(toPartDocument(doc)).outputs.map(body => ({
  valid: checkOutput(body).valid, volume: massPropertiesOf(body).volume,
  corners: body.brep.vertices.map(vertex => vertex.point),
}))));
`,
});
const plane = { origin: [0, -7, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] };
const arc = { kind: 'polygon', points: [[0, 10], [10, 0]], closed: false, bulges: [-(1 + Math.SQRT2), 0], pending: false, construction: true, ids: ['e5', 'e6'] };
const line = { kind: 'polygon', points: [[16, 15], [16, 23]], closed: false, bulges: [0, 0], pending: false, construction: true, ids: ['e7', 'e8'] };
const initial = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [
  { kind: 'sketch', profile: 'rectangle', min: [26, 16], max: [30, 21], sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] }, construction: [arc, line], plane, id: 'n0' },
], outputs: {}, nextId: 1 };
const majorMiddle = [10 + 5 * Math.SQRT2, 10 + 5 * Math.SQRT2];
// After the cut, the radius vectors point along (3,4) and (0,-5). Their sum gives the half-sweep direction.
const trimMiddle = [10 + 3 * Math.sqrt(10), 10 - Math.sqrt(10)];
const oldStored = [17.0711, 17.0711], newStored = [19.4868, 6.8377];
const oldFar = [22, 24], newFar = [24, 11], trimPoint = [2, 16];
const bounds = (a, b) => [a, [b[0], a[1]], b, [a[0], b[1]]];
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const mark = () => f.page.locator('.vp-overlay .sk-osnap').filter({ hasText: 'Middle' });
const settle = () => f.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const screen = ([x, z]) => f.page.evaluate(point => window.__studioScreenOf(point), [x, -7, z]);
const onCanvas = pixel => f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel);
async function frame(points) {
  for (let i = 0; i < 10; i++) {
    const pixels = await Promise.all(points.map(screen));
    const hits = await Promise.all(pixels.map(onCanvas));
    if (hits.every(Boolean)) return;
    const box = await f.page.locator('canvas.vp-canvas').boundingBox();
    assert.ok(box);
    await f.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await f.page.mouse.wheel(0, 400);
    await f.page.waitForTimeout(300);
  }
  assert.fail('Sketch points could not be framed on the offset plane.');
}
async function clickPoint(point) {
  const pixel = await screen(point);
  assert.ok(await onCanvas(pixel), { point, pixel });
  await f.page.mouse.click(...pixel);
}
async function aimForMiddle(point) {
  const pixel = await screen(point), pointer = await screen([point[0] + 0.6, point[1]]);
  assert.ok(await onCanvas(pointer), { point, pointer });
  await f.page.mouse.move(...pointer);
  await mark().waitFor({ timeout: 5000 });
  const drawn = await mark().locator('polygon').evaluate(element => {
    const apex = element.points.getItem(0);
    const centre = new DOMPoint(apex.x, apex.y + 7).matrixTransform(element.getScreenCTM());
    return [centre.x, centre.y];
  });
  assert.ok(Math.hypot(drawn[0] - pixel[0], drawn[1] - pixel[1]) < 1, { drawn, pixel, point });
  return pointer;
}
async function openSketch() {
  const history = f.page.getByRole('group', { name: 'History', exact: true });
  await history.getByRole('button', { name: /^Sketch ·/ }).click();
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
}
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const project = 'D796 trim arc ' + randomUUID(), name = 'major.bcad';
async function openProject() {
  if (!(await versions().isVisible())) await button(f.page, 'Project and versions').click();
  if (await versions().getByLabel('Project', { exact: true }).isVisible()) return;
  await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions(), 'Project in this browser').click();
  await versions().getByLabel('Project', { exact: true }).waitFor();
}

await f.run(async () => {
  await f.newPage();
  const file = join(output, name);
  await writeFile(file, JSON.stringify(initial));
  await f.openFile(file, 1);
  const opened = await f.doc();
  assert.deepEqual(opened.nodes, initial.nodes);
  const grid = button(f.page, 'Grid snap');
  for (let i = 0; i < 6 && !(await grid.innerText()).includes('Grid off'); i++) await grid.click();
  assert.match(await grid.innerText(), /Grid off/);

  f.phase = 'cancel the major arc cue and reopen the sketch';
  await openSketch();
  await f.tool('Rectangle', 'r');
  await frame([majorMiddle, oldFar, trimPoint, trimMiddle, newFar]);
  await aimForMiddle(majorMiddle);
  await f.page.keyboard.press('Escape');
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await f.same(opened);
  await openSketch();
  await f.tool('Rectangle', 'r');
  await frame([majorMiddle, oldFar, trimPoint, trimMiddle, newFar]);
  assert.equal(await mark().count(), 0);

  f.phase = 'place the first rectangle on the major arc';
  const originalHit = await aimForMiddle(majorMiddle);
  await f.snapshot('01-clockwise-major');
  await f.page.mouse.click(...originalHit);
  await clickPoint(oldFar);
  const placed = await f.finishSketch('02-first-rectangle');
  const firstRegion = placed.doc.nodes[0].regions[0];
  assert.deepEqual(firstRegion.map(segment => segment.start), bounds(oldStored, oldFar));
  assert.deepEqual(placed.doc.nodes[0].construction, [arc, line]);

  f.phase = 'trim the old arc start and place the next rectangle';
  await openSketch();
  await f.tool('Trim', 't');
  await frame([majorMiddle, trimPoint, trimMiddle, newFar]);
  await clickPoint(trimPoint);
  await f.tool('Rectangle', 'r');
  await f.page.mouse.move(...await screen(majorMiddle));
  await settle();
  assert.equal(await mark().count(), 0);
  const trimmedHit = await aimForMiddle(trimMiddle);
  await f.snapshot('03-trimmed-arc-middle');
  await f.page.mouse.click(...trimmedHit);
  await clickPoint(newFar);
  const edited = await f.finishSketch('04-rectangles');
  const sketch = edited.doc.nodes[0];
  assert.deepEqual(sketch.plane, plane);
  assert.deepEqual(sketch.regions[0], firstRegion);
  assert.deepEqual(sketch.regions[1].map(segment => segment.start), bounds(newStored, newFar));
  assert.deepEqual([sketch.min, sketch.max, sketch.sideTags.outer], [initial.nodes[0].min, initial.nodes[0].max, initial.nodes[0].sideTags.outer]);
  assert.equal(sketch.construction.length, 2);
  assert.deepEqual(sketch.construction.find(shape => shape.bulges[0] === 0), line);
  const remaining = sketch.construction.find(shape => shape.bulges[0] < 0);
  assert.deepEqual(remaining.points, [[16, 18], [10, 0]]);
  const sweep = 4 * Math.atan(remaining.bulges[0]);
  assert.ok(Math.abs(sweep - (-Math.PI / 2 - Math.atan2(4, 3))) < 1e-8, sweep);
  await f.undo();
  await f.same(placed.doc);
  await f.redo();
  await f.same(edited.doc);

  await f.openExtrudeHud();
  const solid = await f.applyExtrude({ distance: 2, previous: edited.doc, label: '05-offset-solid' });
  const [native] = await f.inspect('offset-native', solid.doc);
  assert.equal(native.valid, true);
  const area = (a, b) => (b[0] - a[0]) * (b[1] - a[1]);
  const expectedVolume = 2 * (20 + area(oldStored, oldFar) + area(newStored, newFar));
  assert.ok(Math.abs(native.volume - expectedVolume) < 1e-8);
  assert.ok(Math.abs((await f.bodies()).bodies[0].volume - expectedVolume) < 1e-8);
  assert.equal(native.corners.length, 24);
  for (const region of [bounds(initial.nodes[0].min, initial.nodes[0].max), bounds(oldStored, oldFar), bounds(newStored, newFar)])
    for (const [x, z] of region) for (const y of [-7, -9])
      assert.ok(native.corners.some(point => Math.hypot(point[0] - x, point[1] - y, point[2] - z) < 1e-8), [x, y, z]);

  f.phase = 'save and reopen the offset solid';
  await openProject();
  await button(f.page, 'Save').click();
  await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(name, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, name]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const directory = await projects.getDirectoryHandle(project);
    return Array.from(new Uint8Array(await (await (await directory.getFileHandle(name)).getFile()).arrayBuffer()));
  }, [project, name]));
  assert.deepEqual(JSON.parse(bytes), solid.doc);
  await writeFile(join(output, 'saved.bcad'), bytes);
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  await openProject();
  await button(versions(), 'Open ' + name).click();
  await f.same(solid.doc);
  assert.equal(await mark().count(), 0);
  assert.ok(Math.abs((await f.bodies()).bodies[0].volume - expectedVolume) < 1e-8);
  await f.snapshot('06-project-open');
  f.report.observations.push({ label: 'arc-midpoints-and-solid', majorMiddle, trimMiddle, oldStored, newStored, remaining,
    volumeMm3: expectedVolume, vertices: native.corners.length, bytes: bytes.length, sha256: sha256(bytes) });
  assert.deepEqual(f.report.downloads, []);
});
