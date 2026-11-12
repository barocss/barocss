import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2], baseline = process.env.D806_BASELINE === '1';
const pins = ['apps/cad-studio/test/ordinary-circle-gap-close-browser.mjs', 'apps/cad-studio/src/sketch/usePathGap.ts',
  'apps/cad-studio/src/sketch/pathGap.ts', 'apps/cad-studio/src/sketch/useSketchActions.ts',
  'packages/barocss-cad-model/src/sketch/trim.ts'];
const f = await createFlow({
  name: 'ordinary-circle-gap-close', output, envFrozen: 'D806_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: 'Cut an ordinary circle, close the remaining arc with a chord, and extrude the repaired profile.',
  limits: ['One new unconstrained radius-10 mm ordinary circle in the default XY plane.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify(evaluateCadPart(toPartDocument(doc)).outputs.map(body => ({
  valid: checkOutput(body).valid, ...massPropertiesOf(body),
}))));
`,
});
const center = [20, 20], radius = 10, pick = [20, 30];
const volumeTolerance = 0.002, centroidTolerance = 5e-5;
const cutA = [20 + 10 * Math.sin(0.2), 20 + 10 * Math.cos(0.2)];
const cutB = [20 - 10 * Math.sin(0.2), 20 + 10 * Math.cos(0.2)];
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const project = 'D806 closed gap ' + randomUUID(), name = 'Untitled.bcad';
async function openProject() {
  if (!(await versions().isVisible())) await button(f.page, 'Project and versions').click();
  if (await versions().getByLabel('Project', { exact: true }).isVisible()) return;
  await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions(), 'Project in this browser').click();
  await versions().getByLabel('Project', { exact: true }).waitFor();
}

await f.run(async () => {
  await f.newPage();
  await button(f.page, 'New part').click();
  await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.ready();
  const empty = await f.doc();
  await button(f.page.locator('.mode'), 'Sketch').click();
  await f.sketchPanel().waitFor();
  await f.tool('Circle', 'c');
  await f.frame([center, pick, [30, 20], cutA, cutB]);
  await f.worldClick(center);
  await f.worldClick([30, 20]);
  await f.tool('Trim', 't');
  if (!baseline) {
    f.phase = 'cut the top of the ordinary circle and keep the open draft';
    await button(f.sketchPanel(), 'Cut circle gap').click();
    await f.sketchPanel().getByLabel('Gap length', { exact: true }).fill('4');
    const pixel = await f.screenOf(pick);
    assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel), pixel);
    await f.page.mouse.move(...pixel);
    const preview = f.page.locator('.vp-overlay .sk-path-gap');
    await preview.waitFor({ timeout: 5000 });
    await f.page.mouse.click(...pixel);
    await preview.waitFor({ state: 'hidden' });
    await f.page.locator('.topbar button.finish').click();
    await f.sketchPanel().getByRole('alert').getByText(/Close or trim the open chain/).waitFor();
    await f.same(empty);
    await f.snapshot('01-open-remainder');

    f.phase = 'close the open remainder with the actual Line tool';
    await f.tool('Line', 'l');
    await f.worldClick(cutA);
    await f.worldClick(cutB);
  }
  const profile = await f.finishSketch(baseline ? '01-ordinary-circle' : '02-closed-profile');
  const [sketch] = profile.doc.nodes;
  if (baseline) {
    assert.equal(sketch.profile, 'circle');
    assert.deepEqual(sketch.center, center);
    assert.equal(sketch.radius, radius);
  } else {
    assert.equal(sketch.profile, 'loop');
    assert.equal(sketch.construction?.length ?? 0, 0);
    assert.equal(sketch.segments.length, 2);
    const arc = sketch.segments.find(segment => segment.kind === 'arc'), chord = sketch.segments.find(segment => segment.kind === 'line');
    assert.equal(arc.direction, 'ccw');
    assert.ok(Math.hypot(arc.center[0] - center[0], arc.center[1] - center[1]) < 1e-5);
    assert.ok(Math.hypot(arc.start[0] - cutB[0], arc.start[1] - cutB[1]) < 3e-6, arc.start);
    assert.ok(Math.hypot(chord.start[0] - cutA[0], chord.start[1] - cutA[1]) < 3e-6, chord.start);
    assert.equal(sketch.sideTags.outer.length, 2);
    await f.undo();
    await f.same(empty);
    await f.redo();
    await f.same(profile.doc);
  }
  await f.openExtrudeHud();
  const solid = await f.applyExtrude({ distance: 2, previous: profile.doc, label: '03-circle-solid' });
  const [native] = await f.inspect('circle-solid-native', solid.doc);
  assert.equal(native.valid, true);
  const sweep = 2 * Math.PI - 0.4, area = 50 * (sweep - Math.sin(sweep));
  const expectedVolume = baseline ? 200 * Math.PI : area * 2;
  assert.ok(Math.abs(native.volume - expectedVolume) < (baseline ? 1e-8 : volumeTolerance), native);
  assert.ok(Math.abs((await f.bodies()).bodies[0].volume - expectedVolume) < (baseline ? 1e-8 : volumeTolerance));
  if (!baseline) {
    const capMoment = 2 * radius ** 3 * Math.sin(0.2) ** 3 / 3;
    const expectedCentroid = [20, 20 - capMoment / area, 1];
    assert.ok(Math.hypot(...native.centroid.map((coordinate, index) => coordinate - expectedCentroid[index])) < centroidTolerance, native.centroid);

    f.phase = 'save and reopen the repaired ordinary profile';
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
    assert.ok(Math.abs((await f.bodies()).bodies[0].volume - expectedVolume) < volumeTolerance);
    await f.snapshot('04-reopened-solid');
    f.report.observations.push({ label: 'ordinary-circle-repair', expectedCentroid, bytes: bytes.length, sha256: sha256(bytes) });
  }
  f.report.observations.push({ label: 'ordinary-circle-volume', baseline, radius, expectedVolumeMm3: expectedVolume,
    volumeMm3: native.volume, centroidMm: native.centroid });
  assert.deepEqual(f.report.downloads, []);
});
