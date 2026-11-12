import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2], baseline = process.env.D802_BASELINE === '1';
const pins = ['apps/cad-studio/test/arc-path-gap-browser.mjs', 'apps/cad-studio/src/sketch/useSketchActions.ts',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts', 'packages/barocss-cad-model/src/sketch/trim.ts',
  ...(baseline ? [] : ['apps/cad-studio/src/sketch/arcPathGap.ts', 'apps/cad-studio/src/sketch/useArcPathGap.ts'])];
const f = await createFlow({
  name: 'arc-path-gap', output, envFrozen: 'D802_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: 'Measure existing Trim and Split and cut a fixed path-length gap in a construction semicircle.',
  limits: ['One radius-10 mm construction semicircle and one separate closed stock profile in XY.'],
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
const arc = { kind: 'polygon', points: [[30, 20], [10, 20]], closed: false,
  bulges: [1, 0], pending: false, construction: true, ids: ['e5', 'e6'] };
const initial = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [
  { kind: 'sketch', profile: 'rectangle', min: [36, 36], max: [41, 41], sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] },
    construction: [arc], id: 'n0' },
], outputs: {}, nextId: 1 };
const pick = [20, 30];
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const gap = () => button(f.sketchPanel(), 'Cut arc gap');
const gapLength = () => f.sketchPanel().getByLabel('Gap length', { exact: true });
const preview = () => f.page.locator('.vp-overlay .sk-path-gap');
const settle = () => f.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const project = 'D802 arc gap ' + randomUUID(), name = 'arc-path-gap.bcad';
async function edit() {
  await button(f.page.getByRole('group', { name: 'History', exact: true }), 'Sketch · rectangle').click();
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
  await f.frame([pick, ...arc.points]);
}
async function openProject() {
  if (!(await versions().isVisible())) await button(f.page, 'Project and versions').click();
  if (await versions().getByLabel('Project', { exact: true }).isVisible()) return;
  await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions(), 'Project in this browser').click();
  await versions().getByLabel('Project', { exact: true }).waitFor();
}
async function hover(point) {
  const pixel = await f.screenOf(point);
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel), pixel);
  await f.page.mouse.move(...pixel);
  await settle();
  return pixel;
}
function length(a, b, bulge) {
  const chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return chord * (1 + bulge * bulge) * Math.atan(Math.abs(bulge)) / Math.abs(bulge);
}

await f.run(async () => {
  await f.newPage();
  const file = join(output, name);
  await writeFile(file, JSON.stringify(initial));
  await f.openFile(file, 1);
  const opened = await f.doc();
  assert.deepEqual(opened.nodes, initial.nodes);

  await edit();
  await f.tool('Trim', 't');
  if (baseline) {
    f.phase = 'trim the isolated semicircle';
    await f.worldClick(pick);
    const trimmed = await f.finishSketch('01-trimmed');
    assert.equal(trimmed.doc.nodes[0].construction?.length ?? 0, 0);
    await f.undo();
    await f.same(opened);
    f.phase = 'split without a gap';
    await edit();
    await f.tool('Split', 'k');
    await f.worldClick(pick);
    const split = await f.finishSketch('02-split');
    assert.equal(split.doc.nodes[0].construction.length, 1);
    const [chain] = split.doc.nodes[0].construction;
    assert.equal(chain.points.length, 3);
    assert.deepEqual([chain.points[0], chain.points[2]], arc.points);
    assert.ok(Math.hypot(chain.points[1][0] - pick[0], chain.points[1][1] - pick[1]) < 2e-6, chain.points[1]);
    const lengthMm = length(chain.points[0], chain.points[1], chain.bulges[0])
      + length(chain.points[1], chain.points[2], chain.bulges[1]);
    assert.ok(Math.abs(lengthMm - 10 * Math.PI) < 1e-7, lengthMm);
    f.report.observations.push({ label: 'existing-trim-and-split', originalLengthMm: 10 * Math.PI,
      trimRetainedPieces: 0, splitRetainedChains: 1, splitLengthMm: lengthMm, gapMm: 0 });
    assert.deepEqual(f.report.downloads, []);
    return;
  }

  f.phase = 'preserve both pieces after a repeated click inside ordinary Trim reach';
  await gap().click();
  await gapLength().fill('1');
  const repeatHit = await hover(pick);
  const endpoint = await f.screenOf([20 + 10 * Math.sin(0.05), 20 + 10 * Math.cos(0.05)]);
  const repeatReach = Math.hypot(repeatHit[0] - endpoint[0], repeatHit[1] - endpoint[1]);
  assert.ok(repeatReach < 8, repeatReach);
  await preview().waitFor({ timeout: 5000 });
  await f.page.mouse.click(...repeatHit);
  await gapLength().waitFor({ state: 'hidden' });
  await f.page.mouse.click(...repeatHit);
  const repeated = await f.finishSketch('00-repeat-click');
  assert.equal(repeated.doc.nodes[0].construction?.length, 2);
  await f.undo();
  await f.same(opened);
  await edit();
  await f.tool('Trim', 't');
  f.report.observations.push({ label: 'repeat-click', gapMm: 1, endpointReachPx: repeatReach, retained: 2 });

  f.phase = 'refuse invalid or out-of-bounds gaps and clear a stationary preview';
  await gap().click();
  await gapLength().fill('4');
  await hover(pick);
  await preview().waitFor({ timeout: 5000 });
  await gapLength().fill('0');
  await preview().waitFor({ state: 'hidden', timeout: 5000 });
  await f.worldClick(pick);
  await f.sketchPanel().getByRole('status').getByText('The gap must fit inside the arc.').waitFor();
  await gapLength().fill('40');
  await f.worldClick(pick);
  await f.sketchPanel().getByRole('status').getByText('The gap must fit inside the arc.').waitFor();
  await f.same(opened);
  await gapLength().fill('4');
  await hover(pick);
  await preview().waitFor({ timeout: 5000 });
  await f.page.keyboard.press('Escape');
  await preview().waitFor({ state: 'hidden' });
  await gapLength().waitFor({ state: 'hidden' });
  await f.same(opened);
  await gap().click();

  f.phase = 'preview and remove exactly four millimetres of arc';
  await hover([20, 32.1]);
  assert.equal(await preview().count(), 0);
  const hit = await hover(pick);
  await preview().waitFor({ timeout: 5000 });
  const endpoints = [[20 + 10 * Math.sin(0.2), 20 + 10 * Math.cos(0.2)], [20 - 10 * Math.sin(0.2), 20 + 10 * Math.cos(0.2)]];
  const marks = await f.page.locator('.vp-overlay .sk-path-gap-end').evaluateAll(elements => elements.map(element => {
    const centre = new DOMPoint(element.cx.baseVal.value, element.cy.baseVal.value).matrixTransform(element.getScreenCTM());
    return [centre.x, centre.y];
  }));
  assert.equal(marks.length, 2);
  for (const [index, endpoint] of endpoints.entries()) {
    const pixel = await f.screenOf(endpoint);
    assert.ok(Math.hypot(pixel[0] - marks[index][0], pixel[1] - marks[index][1]) < 1);
  }
  await f.snapshot('01-gap-preview');
  await f.page.mouse.click(...hit);
  await preview().waitFor({ state: 'hidden' });
  const cut = await f.finishSketch('02-retained-arcs');
  const sketch = cut.doc.nodes[0];
  assert.deepEqual([sketch.min, sketch.max, sketch.sideTags], [initial.nodes[0].min, initial.nodes[0].max, initial.nodes[0].sideTags]);
  assert.equal(sketch.construction.length, 2);
  const [first, second] = sketch.construction;
  assert.deepEqual([first.points[0], second.points[1]], arc.points);
  assert.deepEqual([first.ids, second.ids], [['e5', 'e7'], ['e8', 'e6']]);
  assert.ok([first, second].every(piece => piece.construction && !piece.closed && !piece.pending));
  const cuts = [first.points[1], second.points[0]];
  for (const [index, [x, y]] of endpoints.entries()) assert.ok(Math.hypot(x - cuts[index][0], y - cuts[index][1]) < 3e-6, cuts[index]);
  const gapChord = Math.hypot(cuts[0][0] - cuts[1][0], cuts[0][1] - cuts[1][1]);
  const gapMm = 20 * Math.asin(gapChord / 20);
  assert.ok(Math.abs(gapMm - 4) < 1e-5, gapMm);
  for (const piece of [first, second]) assert.ok(Math.abs(length(...piece.points, piece.bulges[0]) - (5 * Math.PI - 2)) < 1e-5);
  await f.undo();
  await f.same(opened);
  await f.redo();
  await f.same(cut.doc);
  await f.openExtrudeHud();
  const solid = await f.applyExtrude({ distance: 2, previous: cut.doc, label: '03-unchanged-stock' });
  const [native] = await f.inspect('gap-native', solid.doc);
  assert.equal(native.valid, true);
  assert.ok(Math.abs(native.volume - 50) < 1e-8);
  assert.ok(Math.abs((await f.bodies()).bodies[0].volume - 50) < 1e-8);

  f.phase = 'save, close and reopen both construction fragments';
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
  await button(versions(), 'Close project').click();
  await versions().getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  await openProject();
  await button(versions(), 'Open ' + name).click();
  await f.same(solid.doc);
  assert.equal(await preview().count(), 0);
  await f.snapshot('04-reopened');
  f.report.observations.push({ label: 'arc-gap', gapMm, gapChord, cuts, retainedIds: [first.ids, second.ids], volumeMm3: 50,
    bytes: bytes.length, sha256: sha256(bytes) });
  assert.deepEqual(f.report.downloads, []);
});
