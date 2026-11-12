import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2];
const pins = ['apps/cad-studio/test/arc-midpoint-ownership-browser.mjs', 'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'apps/cad-studio/src/sketch/useSketchActions.ts', 'packages/barocss-cad-model/src/sketch/osnap.ts'];
const f = await createFlow({
  name: 'arc-midpoint-ownership', output, envFrozen: 'D797_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: 'Snap to a closing profile arc, replace the document, and admit a new live arc only after confirmation.',
  limits: ['Two XY documents, one ordinary closed semicircle and one newly authored construction arc.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify(evaluateCadPart(toPartDocument(doc)).outputs.map(body => ({
  valid: checkOutput(body).valid, volume: massPropertiesOf(body).volume,
}))));
`,
});
const segments = [
  { kind: 'line', start: [5, 12] },
  { kind: 'arc', start: [25, 12], center: [15, 12], direction: 'ccw' },
];
const makeDoc = (node, nextId) => ({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [node], outputs: {}, nextId });
const closed = makeDoc({ kind: 'sketch', profile: 'loop', segments, sideTags: { outer: ['e1', 'e2'] }, id: 'n20' }, 21);
const replacement = makeDoc({ kind: 'sketch', profile: 'rectangle', min: [29, 5], max: [36, 10],
  sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] }, id: 'n10' }, 11);
const oldMiddle = [15, 22], oldAim = [15.7, 22], referenceEnd = [18, 28];
const arcStart = [4, -8], arcEnd = [20, -8], chordMiddle = [12, -8], curveMiddle = [12, -14], newAim = [12.7, -14], rectangleEnd = [17, -10];
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const mark = () => f.page.locator('.vp-overlay .sk-osnap').filter({ hasText: 'Middle' });
const settle = () => f.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function hover(point) {
  const pixel = await f.screenOf(point);
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel), { point, pixel });
  await f.page.mouse.move(...pixel);
  await settle();
  return pixel;
}
async function atMiddle(point, aim) {
  const pointer = await hover(aim);
  await mark().waitFor({ timeout: 5000 });
  const drawn = await mark().locator('polygon').evaluate(element => {
    const apex = element.points.getItem(0);
    const centre = new DOMPoint(apex.x, apex.y + 7).matrixTransform(element.getScreenCTM());
    return [centre.x, centre.y];
  });
  const expected = await f.screenOf(point);
  assert.ok(Math.hypot(drawn[0] - expected[0], drawn[1] - expected[1]) < 1, { drawn, expected });
  return pointer;
}
async function openSketch() {
  const history = f.page.getByRole('group', { name: 'History', exact: true });
  await history.getByRole('button', { name: /^Sketch ·/ }).click();
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
}
async function chooseFile(path, id) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles(path);
  await f.page.waitForFunction(id => window.__studioDoc?.nodes[0]?.id === id, id);
  await f.ready();
}
async function beginConstructionArc(start, end) {
  await f.tool('Line', 'l');
  await button(f.page, 'Construction').click();
  await f.worldClick(start);
  await f.tool('Arc', 'a');
  await f.worldClick(end);
}

await f.run(async () => {
  await f.newPage();
  const oldFile = join(output, 'closing-arc.bcad'), newFile = join(output, 'replacement.bcad');
  await writeFile(oldFile, JSON.stringify(closed));
  await writeFile(newFile, JSON.stringify(replacement));
  await chooseFile(oldFile, 'n20');
  assert.deepEqual(await f.doc(), closed);
  await openSketch();
  await f.tool('Line', 'l');
  await button(f.page, 'Construction').click();
  await f.frame([oldMiddle, oldAim, referenceEnd]);

  f.phase = 'use the closing arc of an ordinary profile';
  const oldHit = await atMiddle(oldMiddle, oldAim);
  await f.snapshot('01-closing-middle');
  await f.page.mouse.click(...oldHit);
  await f.worldClick(referenceEnd);
  const authored = await f.finishSketch('02-construction-start');
  assert.deepEqual(authored.doc.nodes[0].construction[0].points, [oldMiddle, referenceEnd]);
  const [chord, closingArc] = authored.doc.nodes[0].segments;
  assert.deepEqual(chord, segments[0]);
  assert.deepEqual({ ...closingArc, center: segments[1].center }, segments[1]);
  assert.ok(Math.hypot(closingArc.center[0] - 15, closingArc.center[1] - 12) < 1e-8);
  assert.deepEqual(authored.doc.nodes[0].sideTags, closed.nodes[0].sideTags);

  f.phase = 'replace the old document from the visible cue';
  await openSketch();
  await f.tool('Rectangle', 'r');
  await button(f.page, 'Hide construction').click();
  await f.frame([oldMiddle, oldAim]);
  await atMiddle(oldMiddle, oldAim);
  await chooseFile(newFile, 'n10');
  await f.sketchPanel().waitFor({ state: 'hidden' });
  assert.equal(await mark().count(), 0);
  assert.deepEqual(await f.doc(), replacement);
  const opened = await f.doc();
  await openSketch();
  await f.tool('Rectangle', 'r');
  await f.frame([oldMiddle, oldAim, arcStart, arcEnd, chordMiddle, curveMiddle, newAim, rectangleEnd]);
  await hover(oldAim);
  assert.equal(await mark().count(), 0);

  f.phase = 'exclude the unfinished arc and its placeholder chord';
  await beginConstructionArc(arcStart, arcEnd);
  await hover(chordMiddle);
  assert.equal(await mark().count(), 0);
  await hover(curveMiddle);
  assert.equal(await mark().count(), 0);
  await f.snapshot('03-pending-arc');
  await f.worldClick(curveMiddle);
  await atMiddle(curveMiddle, newAim);
  await f.snapshot('04-completed-arc');

  f.phase = 'use the completed arc and keep the new document current';
  await f.tool('Rectangle', 'r');
  await button(f.page, 'Construction').click();
  const newHit = await atMiddle(curveMiddle, newAim);
  await f.page.mouse.click(...newHit);
  await f.worldClick(rectangleEnd);
  const finished = await f.finishSketch('05-new-rectangle');
  const sketch = finished.doc.nodes[0];
  assert.equal(sketch.id, 'n10');
  assert.deepEqual(sketch.regions[0].map(segment => segment.start), [[12, -14], [17, -14], [17, -10], [12, -10]]);
  assert.equal(sketch.construction.length, 1);
  assert.deepEqual(sketch.construction[0].points, [arcStart, arcEnd]);
  const sagitta = 8 * sketch.construction[0].bulges[0];
  assert.ok(Math.abs(sagitta - 6) < 5e-5, sagitta);
  assert.equal(sketch.construction[0].pending, false);
  await f.undo();
  await f.same(opened);
  await f.redo();
  await f.same(finished.doc);
  await f.openExtrudeHud();
  const solid = await f.applyExtrude({ distance: 2, previous: finished.doc, label: '06-current-solid' });
  const native = await f.inspect('new-document-native', solid.doc);
  assert.equal(native.length, 1);
  assert.equal(native[0].valid, true);
  const expectedVolume = (7 * 5 + 5 * 4) * 2;
  assert.ok(Math.abs(native[0].volume - expectedVolume) < 1e-8);
  assert.ok(Math.abs((await f.bodies()).bodies[0].volume - expectedVolume) < 1e-8);

  f.phase = 'retire an isolated cue on plane and source changes';
  await button(f.page.locator('.mode'), 'Sketch').click();
  await f.sketchPanel().waitFor();
  const plane = f.sketchPanel().getByLabel('Sketch plane', { exact: true });
  const isolatedStart = [45, -8], isolatedEnd = [61, -8], isolatedMiddle = [53, -14], isolatedAim = [53.7, -14];
  await plane.selectOption('xy');
  await f.frame([isolatedStart, isolatedEnd, isolatedMiddle, isolatedAim]);
  await beginConstructionArc(isolatedStart, isolatedEnd);
  await f.worldClick(isolatedMiddle);
  await atMiddle(isolatedMiddle, isolatedAim);
  await plane.selectOption('xz');
  await settle();
  assert.equal(await mark().count(), 0);
  await plane.selectOption('xy');
  await f.frame([isolatedMiddle, isolatedAim]);
  await atMiddle(isolatedMiddle, isolatedAim);
  // The half chord is 8 mm. At radius 17 mm the sagitta is 17 - sqrt(289 - 64) = 2 mm.
  const radiusMiddle = [53, -10], radiusAim = [53.7, -10];
  await f.sketchPanel().getByLabel('Arc 1 radius', { exact: true }).fill('17');
  await hover(isolatedAim);
  assert.equal(await mark().count(), 0);
  await atMiddle(radiusMiddle, radiusAim);
  const movedMiddle = [53, -7], movedAim = [53.7, -7];
  await f.sketchPanel().getByLabel('Point 1 Y', { exact: true }).fill('-5');
  await f.sketchPanel().getByLabel('Point 2 Y', { exact: true }).fill('-5');
  await hover(radiusAim);
  assert.equal(await mark().count(), 0);
  await atMiddle(movedMiddle, movedAim);
  await f.snapshot('07-edited-arc-middle');
  await f.tool('Trim', 't');
  await f.worldClick(movedMiddle);
  await f.tool('Rectangle', 'r');
  await hover(movedAim);
  assert.equal(await mark().count(), 0);
  await f.snapshot('08-removed-arc');
  await f.page.keyboard.press('Escape');
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await f.same(solid.doc);

  f.phase = 'save, close and reopen the new document';
  const project = 'D797 snap ownership ' + randomUUID();
  const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await button(f.page, 'Project and versions').click();
  await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions(), 'Project in this browser').click();
  const activeProject = () => versions().getByLabel('Project', { exact: true });
  await activeProject().waitFor();
  await button(f.page, 'Save').click();
  const name = 'replacement.bcad';
  await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(name, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, name]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const directory = await projects.getDirectoryHandle(project);
    return Array.from(new Uint8Array(await (await (await directory.getFileHandle(name)).getFile()).arrayBuffer()));
  }, [project, name]));
  assert.deepEqual(JSON.parse(bytes), solid.doc);
  await button(versions(), 'Close project').click();
  await activeProject().waitFor({ state: 'hidden' });
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  await button(f.page, 'Project and versions').click();
  await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions(), 'Project in this browser').click();
  await button(versions(), 'Open ' + name).click();
  await f.same(solid.doc);
  assert.equal(await mark().count(), 0);
  assert.ok(Math.abs((await f.bodies()).bodies[0].volume - expectedVolume) < 1e-8);
  await f.snapshot('09-fresh-open');
  f.report.observations.push({ label: 'arc-ownership', oldMiddle, curveMiddle, sagitta, oldDocument: 'n20', newDocument: 'n10', volumeMm3: expectedVolume,
    radiusMiddle, movedMiddle, bytes: bytes.length, sha256: sha256(bytes) });
  assert.deepEqual(f.report.downloads, []);
});
