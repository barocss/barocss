import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFlow, sha256 } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/overlaid-lines-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/sketch/overlaidLines.ts',
  'apps/cad-studio/src/sketch/useOverlaidLines.ts',
  'apps/cad-studio/src/ui/OverlaidLinesControls.tsx',
  'apps/cad-studio/src/viewport/sketchOverlay.tsx',
  'packages/barocss-cad-model/src/sketch/loops.ts',
];
const f = await createFlow({
  name: 'overlaid-lines', output: process.argv[2], envFrozen: 'D828_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: 'Locate the two exact source edges of adjacent rectangles without changing the sketch or history.',
  limits: ['Ordinary desktop rectangles. The diagnostic reads straight segments and does not determine profile validity.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const [body] = evaluateCadPart(toPartDocument(doc)).outputs;
console.log(JSON.stringify({ valid: checkOutput(body).valid, ...massPropertiesOf(body),
  names: body.brep.faces.map(face => face.name) }));
`,
});
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [{ kind: 'sketch', profile: 'rectangle', min: [30, 10], max: [36, 15], sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] }, id: 'n0' }],
  outputs: {}, nextId: 1,
};
const name = 'D828-control.bcad', project = 'D828 exact lines ' + randomUUID();
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const scan = () => f.page.getByRole('region', { name: 'Overlaid lines', exact: true });
const mark = () => f.page.locator('.vp-overlay .sk-overlaid-line');
const versionPanel = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const shapeGraphics = () => f.page.locator('.vp-overlay .sk-shape').evaluateAll(shapes => shapes.map(shape =>
  [shape.tagName, shape.getAttribute('points'), shape.getAttribute('d'), shape.getAttribute('class')]));
const controls = async () => ({
  undo: await button(f.page, 'Undo').isEnabled(), redo: await button(f.page, 'Redo').isEnabled(),
  selection: await f.page.evaluate(() => window.__studioSelection.selection),
  dirty: await f.page.getByLabel('Unsaved changes', { exact: true }).count(),
});

async function beginScan(checked, groups) {
  await button(scan(), 'Find overlaid lines').click();
  await scan().getByRole('status').getByText(new RegExp(`Checked ${checked} straight segments\\. Found ${groups} exact group`)).waitFor();
}

async function markPosition() {
  return mark().locator('line').evaluate(line => {
    const transform = line.getScreenCTM();
    return [[line.x1.baseVal.value, line.y1.baseVal.value], [line.x2.baseVal.value, line.y2.baseVal.value]].map(([x, y]) => {
      const point = new DOMPoint(x, y).matrixTransform(transform);
      return [point.x, point.y];
    });
  });
}

async function checkMark(shape, side, start, end) {
  await mark().waitFor();
  assert.equal(await mark().getAttribute('data-shape'), String(shape));
  assert.equal(await mark().getAttribute('data-side'), String(side));
  const shown = await markPosition();
  const expected = await Promise.all([start, end].map(point => f.screenOf(point)));
  shown.forEach(([x, y], index) => assert.ok(Math.hypot(x - expected[index][0], y - expected[index][1]) < 1, JSON.stringify(shown)));
  return shown;
}

async function openProject() {
  if (!(await versionPanel().isVisible())) await button(f.page, 'Project and versions').click();
  if (await versionPanel().getByLabel('Project', { exact: true }).isVisible()) return;
  await versionPanel().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versionPanel(), 'Project in this browser').click();
  await versionPanel().getByLabel('Project', { exact: true }).waitFor();
}

await f.run(async () => {
  f.phase = 'draw two adjacent rectangles through the actual desktop sketch tool';
  await f.newPage();
  await button(f.page, 'New part').click();
  await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.ready();
  const empty = await f.doc();
  await button(f.page.locator('.mode'), 'Sketch').click();
  await f.sketchPanel().waitFor();
  const A = [4, 6], B = [14, 6], C = [14, 16], D = [24, 16];
  await f.frame([A, B, C, D]);
  await f.worldClick(A);
  await f.worldClick(C);
  await f.worldClick(B);
  await f.worldClick(D);
  await f.tool('Select', 's');
  const original = await controls();
  const graphics = await shapeGraphics();
  assert.equal(graphics.length, 2);

  f.phase = 'scan and highlight the two original directions';
  await beginScan(8, 1);
  const group = button(scan(), 'Group 1 · 2 segments');
  await group.click();
  const first = scan().getByRole('button', { name: /Shape 1 · segment 2.*\(14, 6\) → \(14, 16\)/ });
  const second = scan().getByRole('button', { name: /Shape 2 · segment 4.*\(14, 16\) → \(14, 6\)/ });
  await first.click();
  const firstPixels = await checkMark(1, 2, B, C);
  await second.focus();
  await second.press('Enter');
  const reversePixels = await checkMark(2, 4, C, B);
  assert.deepEqual(reversePixels, [...firstPixels].reverse());
  await f.same(empty);
  assert.deepEqual(await shapeGraphics(), graphics);
  assert.deepEqual(await controls(), original);
  await f.snapshot('01-two-original-directions');

  f.phase = 'keep the group under zoom and retire only the diagnostic on Escape';
  const view = await f.page.locator('canvas.vp-canvas').boundingBox();
  assert.ok(view);
  await f.page.mouse.move(view.x + view.width * 0.45, view.y + view.height * 0.45);
  await f.page.mouse.wheel(0, 350);
  await f.page.waitForFunction(old => {
    const line = document.querySelector('.sk-overlaid-line line');
    if (!line) return false;
    const p = new DOMPoint(line.x1.baseVal.value, line.y1.baseVal.value).matrixTransform(line.getScreenCTM());
    return Math.hypot(p.x - old[0], p.y - old[1]) > 1;
  }, reversePixels[0]);
  const zoomed = await checkMark(2, 4, C, B);
  assert.equal(await group.getAttribute('aria-pressed'), 'true');
  await second.press('Escape');
  await mark().waitFor({ state: 'hidden' });
  assert.ok(await f.sketchPanel().isVisible());
  assert.equal(await scan().getByRole('status').count(), 0);
  assert.deepEqual(await controls(), original);
  f.report.observations.push({ label: 'two-directions', checked: 8, groups: 1, firstPixels, reversePixels, zoomed });

  f.phase = 'clear the report when the plane changes or the document is replaced';
  await beginScan(8, 1);
  await group.click();
  await mark().waitFor();
  await f.sketchPanel().getByLabel('Plane offset', { exact: true }).fill('3');
  await mark().waitFor({ state: 'hidden' });
  assert.equal(await scan().getByRole('status').count(), 0);
  await beginScan(8, 1);
  await group.click();
  await mark().waitFor();
  const firstCorner = f.sketchPanel().getByLabel('Point 1 X', { exact: true });
  await firstCorner.fill('15');
  await mark().waitFor({ state: 'hidden' });
  assert.equal(await scan().getByRole('status').count(), 0);
  await beginScan(8, 0);
  await button(scan(), 'Close scan').click();
  assert.ok(await f.sketchPanel().isVisible());
  await firstCorner.fill('14');
  await beginScan(8, 1);
  await group.click();
  await mark().waitFor();
  f.report.observations.push({ label: 'scan-retired-on-edit', planeOffset: 3, groupsBefore: 1, groupsAfter: 0, groupsRestored: 1 });
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);
  await mark().waitFor({ state: 'hidden' });
  assert.equal(await scan().count(), 0);

  f.phase = 'scan and finish an unaffected control sketch';
  await button(f.page.getByRole('group', { name: 'History', exact: true }), 'Sketch · rectangle').click();
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
  await beginScan(4, 0);
  await f.finishSketch('02-control-finished');
  await f.same(source);
  await f.openExtrudeHud();
  const { doc } = await f.applyExtrude({ distance: 2, previous: source, label: '03-control-extrusion' });
  assert.deepEqual(doc.nodes[0], source.nodes[0]);
  const native = await f.inspect('control-volume', doc);
  assert.ok(native.valid);
  assert.ok(Math.abs(native.volume - 60) < 1e-8);
  assert.ok(Math.hypot(native.centroid[0] - 33, native.centroid[1] - 12.5, native.centroid[2] - 1) < 1e-8);
  for (const tag of ['e1', 'e2', 'e3', 'e4']) assert.ok(native.names.includes(`n1.side[${tag}]`));
  assert.ok(Math.abs((await f.bodies()).bodies[0].volume - 60) < 1e-8);
  await f.undo();
  await f.same(source);
  await f.redo();
  await f.same(doc);

  f.phase = 'save and reopen the ordinary solid';
  await openProject();
  await button(f.page, 'Save').click();
  await versionPanel().getByRole('list', { name: 'Project documents', exact: true }).getByText(name, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, name]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const directory = await projects.getDirectoryHandle(project);
    return Array.from(new Uint8Array(await (await (await directory.getFileHandle(name)).getFile()).arrayBuffer()));
  }, [project, name]));
  assert.deepEqual(JSON.parse(bytes), doc);
  await button(versionPanel(), 'Close project').click();
  await versionPanel().getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  await openProject();
  await button(versionPanel(), 'Open ' + name).click();
  await f.same(doc);
  assert.equal(await mark().count(), 0);
  assert.equal(await scan().count(), 0);
  f.report.observations.push({ label: 'control-project', bytes: bytes.length, sha256: sha256(bytes), volume: native.volume, names: native.names });
  assert.deepEqual(f.report.downloads, []);
});
