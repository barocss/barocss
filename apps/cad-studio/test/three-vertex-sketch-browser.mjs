import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2], repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
await mkdir(output);
const fixture = 'apps/cad-studio/test/fixtures/linear-cut-pattern.bcad';
const stock = JSON.parse(await readFile(resolve(repo, fixture), 'utf8'));
stock.nodes = stock.nodes.slice(0, 2);
stock.outputs = { b1: { node: 1, side: 'solid' } };
stock.nextId = 2;
const input = join(output, 'three-vertex-stock.bcad');
await writeFile(input, JSON.stringify(stock));
const pins = [fixture, 'apps/cad-studio/test/three-vertex-sketch-browser.mjs', 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/viewport/vertexPick.ts', 'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'apps/cad-studio/src/viewport/useViewportPicking.ts', 'packages/barocss-cad-model/src/engine/mesh.ts',
  'packages/barocss-cad-model/src/sketch/plane.ts', 'packages/barocss-cad-model/src/sketch/types.ts',
  'apps/cad-studio/src/sketch/useSketchActions.ts', 'apps/cad-studio/src/ui/SketchPanel.tsx'];
const f = await createFlow({
  name: 'three-vertex-sketch', envFrozen: 'D792_SOURCE_FROZEN', output, initialFiles: pins, requiredFrozen: pins,
  qualification: 'Start a Sketch on the exact plane of three ordered native box vertices selected in the desktop viewport.',
  limits: ['One owned native box; ordered real pointer picks on two cameras.'],
  snapshotExtra: () => ({ plane: document.querySelector('select[aria-label="Sketch plane"]')?.value ?? null }),
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify(evaluateCadPart(toPartDocument(doc)).outputs.map(body => ({
  id: body.id, check: checkOutput(body), corners: body.brep.vertices.map(vertex => vertex.point), volume: massPropertiesOf(body).volume,
}))));
`,
});
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const points = [[0, 0, 10], [60, 30, 10], [60, 0, 0]];
const orthographic = process.env.D792_ORTHO === '1';
f.report.projection = orthographic ? 'orthographic' : 'perspective';
const unit = (values, denominator) => values.map(value => value / denominator);
const xAxis = unit([2, 1, 0], Math.sqrt(5)), normal = unit([-1, 2, -6], Math.sqrt(41));
const yAxis = unit([6, -12, -5], Math.sqrt(205));
const world = ([u, v], depth = 0) => points[0].map((start, k) => start + xAxis[k] * u + yAxis[k] * v + normal[k] * depth);
const near = (a, b) => assert.ok(Number.isFinite(a) && Math.abs(a - b) < 1e-8, `${a} versus ${b}`);
const nearPoint = (a, b) => b.forEach((value, k) => near(a[k], value));
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const project = 'D792 vertices ' + randomUUID();
async function openProject() {
  if (!(await versions().isVisible())) await button(f.page, 'Project and versions').click();
  await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions(), 'Project in this browser').click();
  await versions().getByLabel('Project', { exact: true }).waitFor();
}
const localMin = [30, -16], localMax = [38, -10], height = 2;
const corners = [0, height].flatMap(depth => [localMin[0], localMax[0]].flatMap(u =>
  [localMin[1], localMax[1]].map(v => world([u, v], depth))));
async function checkExtrude(label, doc) {
  f.phase = label;
  await f.same(doc);
  const native = await f.inspect(label + '-native', doc);
  const extruded = native.find(body => body.id === 'n3');
  assert.equal(extruded.check.valid, true);
  assert.equal(extruded.corners.length, 8);
  for (const corner of corners) assert.ok(extruded.corners.some(actual => Math.hypot(...corner.map((v, k) => actual[k] - v)) < 1e-8), corner);
  near(extruded.volume, 8 * 6 * height);
  near((await f.bodies()).bodies.find(body => body.key === 'b3').volume, 8 * 6 * height);
  f.report.observations.push({ label, corners, volume: extruded.volume });
  return native;
}

async function pickVertex(point, inward, count, expected = points) {
  const [corner, centre] = await f.page.evaluate(points => points.map(point => window.__studioScreenOf(point)), [point, inward]);
  assert.ok(corner?.length === 2 && centre?.length === 2);
  const inwardScreen = [centre[0] - corner[0], centre[1] - corner[1]], length = Math.hypot(...inwardScreen);
  const pixel = corner.map((value, index) => value + 3 * inwardScreen[index] / length);
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel), pixel);
  if (count > 1) await f.page.keyboard.down('Shift');
  try { await f.page.mouse.click(...pixel); }
  finally { if (count > 1) await f.page.keyboard.up('Shift'); }
  await f.page.waitForFunction(count => window.__studioSelection?.selection.vertices?.length === count, count);
  const vertices = await f.page.evaluate(() => window.__studioSelection.selection.vertices.map(v => [v.body, v.at]));
  assert.deepEqual(vertices, expected.slice(0, count).map(point => [0, point]));
}

await f.run(async () => {
  await f.newPage();
  await f.openFile(input, 2);
  await f.same(stock);
  const views = f.page.locator('.views');
  if (orthographic) {
    await button(views, 'Ortho').click();
    assert.equal(await button(views, 'Ortho').getAttribute('aria-pressed'), 'true');
  }
  await button(views, 'Top').click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  if (!orthographic) {
    f.phase = 'refuse a hidden endpoint plus two visible picks';
    const hidden = [[0, 0, 0], points[1], points[2]];
    await pickVertex(hidden[0], [30, 15, 0], 1, hidden);
    await pickVertex(hidden[1], [30, 15, 10], 2, hidden);
    await button(views, 'Front').click();
    await pickVertex(hidden[2], [30, 0, 5], 3, hidden);
    await button(f.page.locator('.mode'), 'Sketch').click();
    await f.waitToast(/select three distinct, non-collinear native vertices/i);
    assert.equal(await f.sketchPanel().isVisible(), false);
    await f.same(stock);
    await f.snapshot('00-hidden-endpoint-refused');
    await f.dismissToasts();
    await f.page.keyboard.press('Escape');
    await button(views, 'Top').click();
  }
  f.phase = 'pick three native box corners in order with real pointer clicks';
  await pickVertex(points[0], [30, 15, 10], 1);
  f.phase = 'refuse an incomplete native vertex selection';
  await button(f.page.locator('.mode'), 'Sketch').click();
  await f.waitToast(/select three distinct, non-collinear native vertices/i);
  assert.equal(await f.sketchPanel().isVisible(), false);
  await f.same(stock);
  await f.dismissToasts();
  await pickVertex(points[1], [30, 15, 10], 2);
  await button(f.page.locator('.views'), 'Front').click();
  await pickVertex(points[2], [30, 0, 5], 3);
  await f.snapshot('01-ordered-corners');
  f.phase = 'start the sketch and read its active plane';
  await button(f.page.locator('.mode'), 'Sketch').click();
  await f.sketchPanel().waitFor();
  const state = await f.snapshot('02-sketch-plane');
  assert.deepEqual(state.doc, stock);
  assert.equal(state.plane, 'vertices', 'Sketch must use the plane of the three ordered vertices');

  f.phase = 'draw and finish the ordered plane rectangle';
  for (const point of [localMin, localMax].map(uv => world(uv))) {
    const xy = await f.page.evaluate(point => window.__studioScreenOf(point), point);
    assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), xy), xy);
    await f.page.mouse.move(...xy);
    await f.page.mouse.click(...xy);
  }
  const finished = await f.finishSketch('03-finished-sketch');
  const sketch = finished.doc.nodes[2];
  assert.equal(sketch.kind, 'sketch');
  assert.equal(sketch.association, undefined);
  assert.equal(sketch.on, undefined);
  nearPoint(sketch.plane.origin, points[0]);
  nearPoint(sketch.plane.normal, normal);
  nearPoint(sketch.plane.xAxis, xAxis);

  await f.openExtrudeHud();
  const extruded = await f.applyExtrude({ distance: height, previous: finished.doc, label: '04-independent-extrude' });
  assert.deepEqual(extruded.doc.nodes[3], { kind: 'extrude', sketch: 2, height, id: 'n3' });
  const native = await checkExtrude('05-authored-body', extruded.doc);
  near(native.find(body => body.id === 'n1').volume, 60 * 30 * 10);
  await f.undo();
  await f.same(finished.doc);
  await f.redo();
  await f.same(extruded.doc);

  f.phase = 'save the authored plane and open its exact project bytes';
  await openProject();
  await button(f.page, 'Save').click();
  const name = 'three-vertex-stock.bcad';
  await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(name, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, name]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const directory = await projects.getDirectoryHandle(project);
    const file = await (await directory.getFileHandle(name)).getFile();
    return Array.from(new Uint8Array(await file.arrayBuffer()));
  }, [project, name]));
  assert.deepEqual(JSON.parse(bytes), extruded.doc);
  await writeFile(join(output, 'saved-three-vertex-sketch.bcad'), bytes);
  f.report.observations.push({ savedBytes: bytes.length, savedSHA256: sha256(bytes) });
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  assert.notDeepEqual(await f.doc(), extruded.doc);
  await openProject();
  await button(versions(), 'Open ' + name).click();
  await checkExtrude('06-project-reopened', extruded.doc);

  f.phase = 'edit the original stock independently after project Open';
  await f.openFeatureEditor(1, 'Original Box Width');
  await f.editor().getByRole('spinbutton', { name: 'Width', exact: true }).fill('65');
  await button(f.editor(), 'Apply').click();
  await f.changed(extruded.doc);
  await f.closeEditor();
  const changed = await f.doc();
  assert.deepEqual(changed.nodes.slice(2), extruded.doc.nodes.slice(2));
  const changedNative = await checkExtrude('07-stock-edit-snapshot-kept', changed);
  near(changedNative.find(body => body.id === 'n1').volume, 65 * 30 * 10);
  assert.deepEqual(f.report.downloads, []);
});
