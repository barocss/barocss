import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2], baseline = process.env.D803_BASELINE === '1';
const pins = ['apps/cad-studio/test/line-path-gap-browser.mjs', 'apps/cad-studio/src/sketch/usePathGap.ts',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts', 'packages/barocss-cad-model/src/sketch/trim.ts'];
const f = await createFlow({
  name: 'line-path-gap', output, envFrozen: 'D803_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: 'Cut 4 mm along a slanted construction segment and retain both identified ends.',
  limits: ['One 30 mm construction segment and one separate closed stock rectangle in XY.'],
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
const line = { kind: 'polygon', points: [[20, 20], [44, 38]], closed: false,
  bulges: [0, 0], pending: false, construction: true, ids: ['e5', 'e6'] };
const stock = { kind: 'sketch', profile: 'rectangle', min: [50, 40], max: [55, 45], sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] }, id: 'n0' };
const initial = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [{ ...stock, construction: [line] }], outputs: {}, nextId: 1 };
const replacement = { ...initial, nodes: [stock] };
const pick = [32, 29], nearEnd = [21, 20.75], outside = [33.2, 27.4], cutPoints = [[30.4, 27.8], [33.6, 30.2]];
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const gap = () => button(f.sketchPanel(), 'Cut line gap');
const length = () => f.sketchPanel().getByLabel('Gap length', { exact: true });
const preview = () => f.page.locator('.vp-overlay .sk-path-gap');
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const project = 'D803 line gap ' + randomUUID(), name = 'line-gap.bcad';
async function edit() {
  await button(f.page.getByRole('group', { name: 'History', exact: true }), 'Sketch · rectangle').click();
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
  await f.tool('Trim', 't');
  await f.frame([pick, outside, ...line.points]);
}
async function hover(point) {
  const pixel = await f.screenOf(point);
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel), pixel);
  await f.page.mouse.move(...pixel);
  await f.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return pixel;
}
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
  await edit();
  if (baseline) {
    f.phase = 'ordinary Trim removes the entire straight reference';
    await f.worldClick(pick);
    const trimmed = await f.finishSketch('01-ordinary-trim');
    assert.equal(trimmed.doc.nodes[0].construction?.length ?? 0, 0);
    assert.deepEqual(trimmed.doc.nodes[0], stock);
    await f.undo();
    await f.same(opened);
    f.report.observations.push({ label: 'line-trim-baseline', sourceLengthMm: 30, retainedLengthMm: 0 });
    assert.deepEqual(f.report.downloads, []);
    return;
  }

  f.phase = 'refuse a hidden source, a missed line, and an end-spanning gap';
  await button(f.page, 'Hide construction').click();
  assert.equal(await gap().count(), 0);
  await button(f.page, 'Show construction').click();
  await gap().click();
  await length().fill('4');
  await hover(outside);
  assert.equal(await preview().count(), 0);
  await f.worldClick(nearEnd);
  await f.sketchPanel().getByRole('status').getByText('The gap must fit inside the line.').waitFor();
  await f.same(opened);
  await hover(pick);
  await preview().waitFor({ timeout: 5000 });

  f.phase = 'retire the preview when a replacement reuses the sketch ID';
  const replacementFile = join(output, 'same-id-no-line.bcad');
  await writeFile(replacementFile, JSON.stringify(replacement));
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles(replacementFile);
  await f.same(replacement);
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await preview().waitFor({ state: 'hidden' });
  await edit();
  assert.equal(await gap().count(), 0);
  await f.page.keyboard.press('Escape');
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await f.openFile(file, 1);
  await f.same(opened);
  await edit();
  assert.equal(await gap().getAttribute('aria-pressed'), 'false');

  f.phase = 'cut four millimetres measured along the 3–4–5 direction';
  await gap().click();
  const hit = await hover(pick);
  await preview().waitFor({ timeout: 5000 });
  const marks = await f.page.locator('.vp-overlay .sk-path-gap-end').evaluateAll(elements => elements.map(element => {
    const point = new DOMPoint(element.cx.baseVal.value, element.cy.baseVal.value).matrixTransform(element.getScreenCTM());
    return [point.x, point.y];
  }));
  assert.equal(marks.length, 2);
  for (const [index, point] of cutPoints.entries()) {
    const projected = await f.screenOf(point);
    assert.ok(Math.hypot(projected[0] - marks[index][0], projected[1] - marks[index][1]) < 1);
  }
  await f.snapshot('01-line-gap-preview');
  await f.page.mouse.click(...hit);
  await length().waitFor({ state: 'hidden' });
  await f.page.mouse.click(...hit);
  const edited = await f.finishSketch('02-line-fragments');
  const sketch = edited.doc.nodes[0], [first, second] = sketch.construction;
  assert.equal(sketch.construction.length, 2);
  assert.deepEqual([first.points[0], second.points[1]], line.points);
  assert.deepEqual([first.ids, second.ids], [['e5', 'e7'], ['e8', 'e6']]);
  assert.deepEqual([first.bulges, second.bulges], [[0, 0], [0, 0]]);
  assert.ok([first, second].every(part => part.construction && !part.closed && !part.pending));
  const cuts = [first.points[1], second.points[0]];
  const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  for (const [index, point] of cutPoints.entries()) assert.ok(distance(cuts[index], point) < 3e-6, cuts[index]);
  const removed = distance(...cuts);
  assert.ok(Math.abs(removed - 4) < 1e-5, removed);
  for (const part of [first, second]) assert.ok(Math.abs(distance(...part.points) - 13) < 1e-5);
  const { construction, ...stockAfter } = sketch;
  assert.deepEqual(stockAfter, stock);
  await f.undo();
  await f.same(opened);
  await f.redo();
  await f.same(edited.doc);
  await f.openExtrudeHud();
  const solid = await f.applyExtrude({ distance: 2, previous: edited.doc, label: '03-unchanged-stock' });
  const [native] = await f.inspect('line-gap-stock', solid.doc);
  assert.equal(native.valid, true);
  assert.ok(Math.abs(native.volume - 50) < 1e-8);
  assert.ok(Math.abs((await f.bodies()).bodies[0].volume - 50) < 1e-8);

  f.phase = 'save and reopen the two open line references';
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
  f.report.observations.push({ label: 'line-gap', cuts, removedMm: removed, retainedIds: [first.ids, second.ids], volumeMm3: 50,
    bytes: bytes.length, sha256: sha256(bytes) });
  assert.deepEqual(f.report.downloads, []);
});
