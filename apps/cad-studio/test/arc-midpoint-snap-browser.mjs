import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2], baseline = process.env.D795_BASELINE === '1';
const pins = ['apps/cad-studio/test/arc-midpoint-snap-browser.mjs', 'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'apps/cad-studio/src/viewport/sketchOverlay.tsx', 'packages/barocss-cad-model/src/sketch/osnap.ts'];
const f = await createFlow({
  name: 'arc-midpoint-snap', output, envFrozen: 'D795_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: 'Snap a real rectangle corner to the half-sweep point of a visible construction semicircle.',
  limits: ['One positive semicircle in the default XY plane. The prepared fixture enters via native File Open.'],
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
const sourceArc = { kind: 'polygon', points: [[-10, 1 / 32], [10, 1 / 32]], closed: false, bulges: [1, 0], pending: false, construction: true, ids: ['e5', 'e6'] };
const initial = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [
  { kind: 'sketch', profile: 'rectangle', min: [20, 5], max: [26, 10], sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] }, construction: [sourceArc], id: 'n0' },
], outputs: {}, nextId: 1 };
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const mark = () => f.page.locator('.vp-overlay .sk-osnap').filter({ hasText: 'Middle' });
const middle = [0, -10 + 1 / 32], stored = [0, -9.9687], opposite = [6, -4];
const settle = () => f.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function hover(pixel) {
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel), pixel);
  await f.page.mouse.move(...pixel);
  await settle();
}
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const project = 'D795 arc midpoint ' + randomUUID(), name = 'semicircle.bcad';
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
  await button(f.page.getByRole('group', { name: 'History', exact: true }), 'Sketch · rectangle').click();
  await f.editor().waitFor();
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
  await f.tool('Rectangle', 'r');
  f.phase = 'frame the construction arc and rectangle';
  const framed = await f.frame([middle, opposite, ...sourceArc.points]);
  const p = await f.screenOf(middle), toward = await f.screenOf([1, middle[1]]);
  const scale = Math.hypot(toward[0] - p[0], toward[1] - p[1]);
  const nearOffset = Math.min(6, 0.8 * scale);
  assert.ok(nearOffset > 0.52 * scale, { scale, nearOffset });
  const moved = distance => [p[0] + distance * (toward[0] - p[0]) / scale, p[1] + distance * (toward[1] - p[1]) / scale];

  f.phase = 'compare hidden, outside and inside candidates';
  await button(f.page, 'Hide construction').click();
  await hover(moved(nearOffset));
  assert.equal(await mark().count(), 0);
  await button(f.page, 'Show construction').click();
  await hover(moved(12));
  assert.equal(await mark().count(), 0);
  await hover(moved(nearOffset));
  if (baseline) assert.equal(await mark().count(), 0, 'baseline lacks the arc midpoint candidate');
  else {
    await mark().waitFor({ timeout: 5000 });
    const apex = await mark().locator('polygon').evaluate(element => {
      const pt = element.points.getItem(0), matrix = element.getScreenCTM();
      const centre = new DOMPoint(pt.x, pt.y + 7).matrixTransform(matrix);
      return [centre.x, centre.y];
    });
    assert.ok(Math.hypot(apex[0] - p[0], apex[1] - p[1]) < 1, { apex, p });
  }
  await f.snapshot(baseline ? '01-missing-middle' : '01-visible-middle');
  if (!baseline) {
    f.phase = 'retire the cue when changing tool without pointer movement';
    await f.page.keyboard.press('l');
    await settle();
    assert.equal(await mark().count(), 0);
    await f.tool('Rectangle', 'r');
    await hover(moved(nearOffset));
    await mark().waitFor({ timeout: 5000 });
    f.phase = 'retire the cue on Hide';
    await button(f.page, 'Hide construction').click();
    await settle();
    assert.equal(await mark().count(), 0);
    await button(f.page, 'Show construction').click();
    await hover(moved(nearOffset));
    await mark().waitFor({ timeout: 5000 });
  }
  await f.page.mouse.click(...moved(nearOffset));
  await f.worldClick(opposite);
  const finished = await f.finishSketch('02-rectangle');
  const sketch = finished.doc.nodes[0];
  const [x, y] = baseline ? [1, -10] : stored;
  assert.deepEqual(sketch.regions[0].map(segment => segment.start), [[x, y], [6, y], [6, -4], [x, -4]]);
  assert.deepEqual(sketch.construction, [sourceArc]);
  assert.deepEqual([sketch.min, sketch.max, sketch.sideTags.outer], [[20, 5], [26, 10], initial.nodes[0].sideTags.outer]);
  f.report.observations.push({ label: 'arc-placement', baseline, middle, rectangleStart: sketch.regions[0][0].start, nearOffsetPx: nearOffset, outsideOffsetPx: 12, pixelsPerMm: framed.pxPerMm });
  if (baseline) return;

  f.phase = 'verify exact Undo and Redo';
  await f.undo();
  await f.same(opened);
  await f.redo();
  await f.same(finished.doc);
  await f.openExtrudeHud();
  const solid = await f.applyExtrude({ distance: 2, previous: finished.doc, label: '03-two-regions' });
  const native = await f.inspect('native-extrude', solid.doc);
  assert.ok(native.length > 0 && native.every(body => body.valid));
  const expectedVolume = 131.6244;
  const volume = bodies => bodies.reduce((sum, body) => sum + body.volume, 0);
  assert.ok(Math.abs(volume(native) - expectedVolume) < 1e-8, native);
  assert.ok(Math.abs(volume((await f.bodies()).bodies) - expectedVolume) < 1e-8);

  f.phase = 'save and reopen in the browser project';
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
  assert.ok(Math.abs(volume((await f.bodies()).bodies) - expectedVolume) < 1e-8);
  await f.snapshot('04-project-open');
  f.report.observations.push({ label: 'solid-and-project', volumeMm3: expectedVolume, bodies: native.length, bytes: bytes.length, sha256: sha256(bytes) });
  assert.deepEqual(f.report.downloads, []);
});
