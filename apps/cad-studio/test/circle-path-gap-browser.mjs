import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2], baseline = process.env.D804_BASELINE === '1';
const pins = ['apps/cad-studio/test/circle-path-gap-browser.mjs', 'apps/cad-studio/src/sketch/pathGap.ts',
  'apps/cad-studio/src/sketch/usePathGap.ts', 'packages/barocss-cad-model/src/sketch/trim.ts'];
const f = await createFlow({
  name: 'circle-path-gap', output, envFrozen: 'D804_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: 'Cut a four-millimetre path gap in a closed construction circle and retain one open arc.',
  limits: ['One radius-10 mm construction circle and a separate closed stock rectangle in XY.'],
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
const circle = { kind: 'circle', c: [20, 20], r: 10, construction: true, ids: ['e5'] };
const stock = { kind: 'sketch', profile: 'rectangle', min: [36, 36], max: [41, 41], sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] }, id: 'n0' };
const initial = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [{ ...stock, construction: [circle] }], outputs: {}, nextId: 1 };
const pick = [20, 30];
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const gap = () => button(f.sketchPanel(), 'Cut circle gap');
const length = () => f.sketchPanel().getByLabel('Gap length', { exact: true });
const preview = () => f.page.locator('.vp-overlay .sk-path-gap');
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const project = 'D804 circle gap ' + randomUUID(), name = 'circle-gap.bcad';
async function edit() {
  await button(f.page.getByRole('group', { name: 'History', exact: true }), 'Sketch · rectangle').click();
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
  await f.frame([pick, [20, 10], [10, 20], [30, 20]]);
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

  await f.tool('Trim', 't');
  if (baseline) {
    f.phase = 'ordinary Trim removes the isolated circle';
    await f.worldClick(pick);
    const trimmed = await f.finishSketch('01-ordinary-trim');
    assert.equal(trimmed.doc.nodes[0].construction?.length ?? 0, 0);
    await f.undo();
    await f.same(opened);
    f.phase = 'ordinary Split keeps the closed circle';
    await edit();
    await f.tool('Split', 'k');
    await f.worldClick(pick);
    const split = await f.finishSketch('02-ordinary-split');
    assert.equal(split.doc.nodes[0].construction.length, 1);
    const [chain] = split.doc.nodes[0].construction;
    assert.equal(chain.closed, true);
    assert.deepEqual(chain.bulges, [1, 1]);
    assert.ok(distance(chain.points[0], pick) < 3e-6);
    assert.ok(distance(chain.points[1], [20, 10]) < 3e-6);
    const circumference = Math.PI * distance(...chain.points);
    assert.ok(Math.abs(circumference - 20 * Math.PI) < 1e-6, circumference);
    f.report.observations.push({ label: 'circle-trim-split-baseline', trimRetained: 0, splitClosed: true, splitLengthMm: circumference, gapMm: 0 });
    assert.deepEqual(f.report.downloads, []);
    return;
  }

  f.phase = 'refuse the centre and a gap of one circumference';
  await gap().click();
  await hover(circle.c);
  assert.equal(await preview().count(), 0);
  await length().fill(String(20 * Math.PI));
  await f.worldClick(pick);
  await f.sketchPanel().getByRole('status').getByText('The gap must fit inside the circle.').waitFor();
  await f.same(opened);
  await length().fill('4');

  f.phase = 'preview and retain the complementary arc';
  const hit = await hover(pick);
  await preview().waitFor({ timeout: 5000 });
  const ends = [[20 + 10 * Math.sin(0.2), 20 + 10 * Math.cos(0.2)], [20 - 10 * Math.sin(0.2), 20 + 10 * Math.cos(0.2)]];
  const marks = await f.page.locator('.vp-overlay .sk-path-gap-end').evaluateAll(elements => elements.map(element => {
    const p = new DOMPoint(element.cx.baseVal.value, element.cy.baseVal.value).matrixTransform(element.getScreenCTM());
    return [p.x, p.y];
  }));
  assert.equal(marks.length, 2);
  for (const [index, endpoint] of ends.entries()) assert.ok(distance(await f.screenOf(endpoint), marks[index]) < 1);
  await f.snapshot('01-circle-gap-preview');
  await f.page.mouse.click(...hit);
  await length().waitFor({ state: 'hidden' });
  await f.page.mouse.click(...hit);
  const edited = await f.finishSketch('02-open-remainder');
  const sketch = edited.doc.nodes[0];
  assert.equal(sketch.construction.length, 1);
  const [remainder] = sketch.construction;
  assert.equal(remainder.kind, 'polygon');
  assert.ok(remainder.construction && !remainder.closed && !remainder.pending);
  assert.deepEqual(remainder.ids, ['e7', 'e6']);
  assert.ok(distance(remainder.points[0], ends[1]) < 3e-6);
  assert.ok(distance(remainder.points[1], ends[0]) < 3e-6);
  const chord = distance(...remainder.points), bulge = remainder.bulges[0];
  assert.ok(bulge > 1);
  const retained = chord * (1 + bulge * bulge) * Math.atan(bulge) / bulge;
  const gapMm = 20 * Math.asin(chord / 20);
  assert.ok(Math.abs(retained - (20 * Math.PI - 4)) < 1e-5, retained);
  assert.ok(Math.abs(gapMm - 4) < 1e-5, gapMm);
  const { construction, ...stockAfter } = sketch;
  assert.deepEqual(stockAfter, stock);
  await f.undo();
  await f.same(opened);
  await f.redo();
  await f.same(edited.doc);
  await f.openExtrudeHud();
  const solid = await f.applyExtrude({ distance: 2, previous: edited.doc, label: '03-unchanged-stock' });
  const [native] = await f.inspect('circle-gap-stock', solid.doc);
  assert.equal(native.valid, true);
  assert.ok(Math.abs(native.volume - 50) < 1e-8);
  assert.ok(Math.abs((await f.bodies()).bodies[0].volume - 50) < 1e-8);

  f.phase = 'save and reopen the one open construction arc';
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
  f.report.observations.push({ label: 'circle-gap', gapMm, retainedMm: retained, cuts: remainder.points, retiredId: circle.ids[0],
    newIds: remainder.ids, volumeMm3: 50, bytes: bytes.length, sha256: sha256(bytes) });
  assert.deepEqual(f.report.downloads, []);
});
