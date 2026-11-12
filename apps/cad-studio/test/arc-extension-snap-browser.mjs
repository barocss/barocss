import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2], baseline = process.env.D799_BASELINE === '1';
const pins = ['apps/cad-studio/test/arc-extension-snap-browser.mjs', 'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'apps/cad-studio/src/viewport/sketchOverlay.tsx', 'packages/barocss-cad-model/src/sketch/osnap.ts',
  ...baseline ? [] : ['apps/cad-studio/src/sketch/arcExtension.ts', 'apps/cad-studio/src/sketch/useArcExtensionSnap.ts', 'apps/cad-studio/src/sketch/SketchSnapControls.tsx']];
const f = await createFlow({
  name: 'arc-extension-snap', output, envFrozen: 'D799_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: 'Acquire the terminal of a CCW construction arc and use its circular continuation once.',
  limits: ['One visible open two-point construction arc and the first corner of a rectangle in XY.'],
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
const source = { kind: 'polygon', points: [[30, 20], [20, 30]], closed: false, bulges: [Math.SQRT2 - 1, 0], pending: false, construction: true, ids: ['e5', 'e6'] };
const doc = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [
  { kind: 'sketch', profile: 'rectangle', min: [28, 35], max: [33, 40], sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] }, construction: [source], id: 'n0' },
], outputs: {}, nextId: 1 };
const candidate = [20 - 5 * Math.SQRT2, 20 + 5 * Math.SQRT2];
const pointer = [20 - 10.9 / Math.SQRT2, 20 + 10.9 / Math.SQRT2];
const outside = [20 - 12.5 / Math.SQRT2, 20 + 12.5 / Math.SQRT2];
const opposite = [17, 34], stored = [12.9289, 27.0711];
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const cue = () => f.page.locator('.vp-overlay .sk-osnap');
const extension = () => button(f.sketchPanel(), 'Arc extension snap');
const guide = () => f.page.locator('.vp-overlay .sk-arc-extension');
async function hover(point) {
  const pixel = await f.screenOf(point);
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel), { point, pixel });
  await f.page.mouse.move(...pixel);
  await f.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return pixel;
}
async function arm() {
  await extension().click();
  await f.sketchPanel().getByRole('status').getByText('Pick the arc end.').waitFor();
  await f.worldClick(source.points[1]);
  await guide().waitFor({ timeout: 5000 });
}
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const project = 'D799 arc extension ' + randomUUID(), name = 'quarter-arc.bcad';
async function openProject() {
  if (!(await versions().isVisible())) await button(f.page, 'Project and versions').click();
  if (await versions().getByLabel('Project', { exact: true }).isVisible()) return;
  await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions(), 'Project in this browser').click();
  await versions().getByLabel('Project', { exact: true }).waitFor();
}

await f.run(async () => {
  await f.newPage();
  const file = join(output, 'quarter-arc.bcad');
  await writeFile(file, JSON.stringify(doc));
  await f.openFile(file, 1);
  const opened = await f.doc();
  assert.deepEqual(opened.nodes, doc.nodes);
  await button(f.page.getByRole('group', { name: 'History', exact: true }), 'Sketch · rectangle').click();
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
  await f.tool('Rectangle', 'r');
  await f.frame([candidate, pointer, opposite, ...source.points]);
  f.phase = 'observe the normal terminal End cue';
  await hover(source.points[1]);
  await cue().filter({ hasText: 'End' }).waitFor({ timeout: 5000 });
  await f.snapshot('01-terminal');
  f.phase = 'observe the existing grid fallback beyond the terminal';
  let hit = await hover(pointer);
  assert.equal(await cue().count(), 0);
  await f.snapshot('02-no-extension');
  if (!baseline) {
    f.phase = 'require the terminal endpoint and keep the guide temporary';
    await extension().focus();
    await f.page.keyboard.press('Enter');
    await f.sketchPanel().getByRole('status').getByText('Pick the arc end.').waitFor();
    await f.worldClick(source.points[0]);
    assert.equal(await guide().count(), 0);
    await f.worldClick(source.points[1]);
    await guide().waitFor({ timeout: 5000 });
    await f.same(opened);
    await f.page.keyboard.press('Escape');
    await guide().waitFor({ state: 'hidden' });
    assert.equal(await extension().getAttribute('aria-pressed'), 'false');

    await arm();
    await button(f.sketchPanel(), 'Two-point snap').click();
    await guide().waitFor({ state: 'hidden' });
    const twoPoint = f.page.getByRole('form', { name: 'Two-point snap', exact: true });
    await twoPoint.getByRole('status').getByText('Pick the first endpoint.').waitFor();
    await button(twoPoint, 'Cancel snap').click();
    await arm();
    await button(f.page, 'Hide construction').click();
    await guide().waitFor({ state: 'hidden' });
    assert.equal(await extension().count(), 0);
    await button(f.page, 'Show construction').click();
    await arm();

    f.phase = 'compare ordinary snaps and the 8 CSS px extension reach';
    await hover(source.points[1]);
    await cue().filter({ hasText: 'End' }).waitFor({ timeout: 5000 });
    await hover([20 + 5 * Math.SQRT2, 20 + 5 * Math.SQRT2]);
    await cue().filter({ hasText: 'Middle' }).waitFor({ timeout: 5000 });
    await hover(outside);
    assert.equal(await cue().filter({ hasText: 'Extension' }).count(), 0);
    hit = await hover(pointer);
    const mark = cue().filter({ hasText: 'Extension' });
    await mark.waitFor({ timeout: 5000 });
    const drawn = await mark.locator('rect').evaluate(rect => {
      const box = rect.getBoundingClientRect();
      return [box.left + box.width / 2, box.top + box.height / 2];
    });
    const expected = await f.screenOf(candidate);
    assert.ok(Math.hypot(drawn[0] - expected[0], drawn[1] - expected[1]) < 1, { drawn, expected });
    const far = await f.screenOf(outside);
    const insidePx = Math.hypot(hit[0] - expected[0], hit[1] - expected[1]);
    const outsidePx = Math.hypot(far[0] - expected[0], far[1] - expected[1]);
    assert.ok(insidePx < 8 && outsidePx > 8, { insidePx, outsidePx });
    f.report.observations.push({ label: 'reach', insidePx, outsidePx });
    await f.snapshot('03-extension-cue');
    await f.same(opened);
  }
  await f.page.mouse.click(...hit);
  if (!baseline) await guide().waitFor({ state: 'hidden' });
  await f.worldClick(opposite);
  const accepted = await f.finishSketch(baseline ? '03-grid-rectangle' : '04-rectangle');
  const sketch = accepted.doc.nodes[0];
  const [x, y] = baseline ? [12, 28] : stored;
  assert.deepEqual(sketch.regions[0].map(segment => segment.start), [[x, y], [17, y], [17, 34], [x, 34]]);
  assert.deepEqual(sketch.construction, [source]);
  f.report.observations.push({ label: 'extension-placement', extensionPoint: candidate, pointer, storedCorner: [x, y], terminal: source.points[1] });
  if (baseline) return;
  await f.undo();
  await f.same(opened);
  await f.redo();
  await f.same(accepted.doc);
  await f.openExtrudeHud();
  const solid = await f.applyExtrude({ distance: 2, previous: accepted.doc, label: '05-extrusion' });
  const native = await f.inspect('extension-native', solid.doc);
  assert.equal(native.length, 1);
  assert.equal(native[0].valid, true);
  const expectedVolume = 2 * (25 + (17 - stored[0]) * (34 - stored[1]));
  assert.ok(Math.abs(native[0].volume - expectedVolume) < 1e-8);
  assert.ok(Math.abs((await f.bodies()).bodies[0].volume - expectedVolume) < 1e-8);

  f.phase = 'save and reopen the rectangle and source arc';
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
  assert.equal(await guide().count(), 0);
  assert.ok(Math.abs((await f.bodies()).bodies[0].volume - expectedVolume) < 1e-8);
  await f.snapshot('06-reopened');
  f.report.observations.push({ label: 'extension-solid', volumeMm3: expectedVolume, bytes: bytes.length, sha256: sha256(bytes) });
  assert.deepEqual(f.report.downloads, []);
});
