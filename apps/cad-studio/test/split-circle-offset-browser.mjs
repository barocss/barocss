import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const rotated = mode === '--rotated';
const draftHistory = mode === '--draft-history';
const pins = [
  'apps/cad-studio/test/split-circle-offset-browser.mjs',
  'apps/cad-studio/src/sketch/useSketchActions.ts',
  'apps/cad-studio/src/ui/SketchPanel.tsx',
  'packages/barocss-cad-model/src/sketch/offset.ts',
  'packages/barocss-cad-model/src/sketch/trim.ts',
  'packages/barocss-cad-model/src/sketch/profile.ts',
  'packages/barocss-cad-model/src/sketch/loops.ts',
];
const f = await createFlow({
  name: 'split-circle-offset', output, envFrozen: draftHistory ? 'D1078_SOURCE_FROZEN' : 'D854_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: draftHistory ? 'Replay Split and Offset in reverse and forward draft order.' : baseline ? 'Reproduce Out and In reversing direction after splitting a circle'
    : 'Verify outward and inward offset geometry on a real Split circle sketch',
  limits: ['One XY radius-10 circle split into two semicircles. Existing ordinary sketch and Extrude paths.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, faceGeometry, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify(evaluateCadPart(toPartDocument(doc)).outputs.map(output => ({
  valid: checkOutput(output).valid, count: output.bodyCount, mass: massPropertiesOf(output),
  cylinders: output.brep.faces.map(face => faceGeometry(face)).filter(face => face.kind === 'cylinder'),
}))));
`,
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    historyControls: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`).disabled),
  }),
});
const button = (panel, name) => panel.getByRole('button', { name, exact: true });
const panel = () => f.sketchPanel();
const center = [0, 0], start = [-10, 0];
const empty = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [], outputs: {}, nextId: 0 };
const project = 'D854-' + randomUUID(), name = 'D854-split-circle.bcad';
const near = (a, b, tolerance = 3e-6) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);

async function openBytes(buffer) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/json', buffer });
}

async function clickSketch(point) {
  if (!rotated) { await f.worldClick(point); return; }
  const pixel = await f.page.evaluate(([x, z]) => {
    const position = window.__studioScreenOf([x, -7, z]);
    return position && document.elementFromPoint(...position)?.closest('.vp-canvas') ? position : null;
  }, point);
  assert.ok(pixel, 'the offset XZ sketch point is on the canvas');
  await f.page.mouse.click(...pixel);
}

async function drawSplit(beforeSplit = () => {}) {
  await openBytes(Buffer.from(JSON.stringify(empty)));
  await f.same(empty);
  await button(f.page.locator('.mode'), 'Sketch').click();
  await panel().waitFor();
  if (rotated) {
    await panel().getByLabel('Sketch plane', { exact: true }).selectOption('xz');
    await panel().getByLabel('Plane offset', { exact: true }).fill('7');
  }
  if (!rotated) await f.frame([[-24, -24], [24, 24]]);
  await f.tool('Circle', 'c');
  await clickSketch(center);
  await clickSketch([10, 0]);
  await f.tool('Split', 'k');
  await beforeSplit();
  await clickSketch(start);
  await f.snapshot('split-' + f.phase);
}

async function offset(direction, distance) {
  await panel().getByLabel('Offset distance', { exact: true }).fill(String(distance));
  await button(panel(), direction === 'out' ? 'Offset outward' : 'Offset inward').click();
}
function checkRing(doc, outer, inner) {
  const sketch = doc.nodes[0];
  assert.equal(sketch.profile, 'loop');
  assert.equal(sketch.holes?.length, 1);
  assert.deepEqual(sketch.plane, rotated ? { origin: [0, -7, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] } : undefined);
  for (const [segments, radius] of [[sketch.segments, outer], [sketch.holes[0], inner]]) {
    assert.equal(segments.length, 2);
    for (const segment of segments) {
      assert.equal(segment.kind, 'arc');
      near(Math.hypot(...segment.center), 0);
      near(Math.hypot(...segment.start), radius);
    }
    near(Math.hypot(segments[0].start[0] - segments[1].start[0], segments[0].start[1] - segments[1].start[1]), 2 * radius);
  }
}
async function inspect(label, doc, outer, inner, height = 2) {
  checkRing(doc, outer, inner);
  const outputs = await f.inspect(label, doc);
  assert.equal(outputs.length, 1);
  const [body] = outputs;
  assert.ok(body.valid && body.count === 1);
  near(body.mass.volume, height * Math.PI * (outer * outer - inner * inner), 1e-5);
  const centroid = rotated ? [0, -7 - height / 2, 0] : [0, 0, height / 2];
  for (const [index, expected] of centroid.entries()) near(body.mass.centroid[index], expected);
  assert.ok(body.cylinders.length >= 2);
  assert.ok(body.cylinders.every(cylinder => [outer, inner].some(radius => Math.abs(radius - cylinder.r) <= 3e-6)));
  assert.ok([outer, inner].every(radius => body.cylinders.some(cylinder => Math.abs(radius - cylinder.r) <= 3e-6)));
  f.report.observations.push({ label, outerRadiusMm: outer, innerRadiusMm: inner, height, volumeMm3: body.mass.volume, centroid });
}

async function saveOwned(doc) {
  const versions = f.page.getByLabel('Versions panel', { exact: true });
  if (!(await versions.isVisible())) await button(f.page, 'Project and versions').click();
  await versions.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions, 'Project in this browser').click();
  await versions.getByLabel('Project', { exact: true }).waitFor();
  await button(f.page, 'Save').click();
  await versions.getByRole('list', { name: 'Project documents', exact: true }).getByText(name, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, name]) => {
    const root = await navigator.storage.getDirectory(), projects = await root.getDirectoryHandle('projects');
    const directory = await projects.getDirectoryHandle(project), file = await (await directory.getFileHandle(name)).getFile();
    return Array.from(new Uint8Array(await file.arrayBuffer()));
  }, [project, name]));
  assert.deepEqual(JSON.parse(bytes), doc);
  f.report.files.push({ name, bytes: bytes.length, sha256: sha256(bytes) });
  await button(versions, 'Close project').click();
  await versions.getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
  await f.page.evaluate(async project => {
    const root = await navigator.storage.getDirectory(), projects = await root.getDirectoryHandle('projects');
    await projects.removeEntry(project, { recursive: true });
  }, project);
  return bytes;
}

async function replayDraftHistory() {
  const outline = () => f.page.locator('.vp-overlay .sk-shape.done').evaluateAll(nodes => nodes.map(node => node.outerHTML));
  const keyboard = async key => {
    await f.page.locator('.topbar button.finish').focus();
    await f.page.keyboard.press(key);
  };
  const newContext = f.browser.newContext.bind(f.browser), origin = new URL(f.server.resolvedUrls.local[0]).origin;
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return url.origin === origin ? route.continue() : route.abort();
    });
    return context;
  };
  await f.newPage();
  f.phase = 'draft-history';
  let circle;
  await drawSplit(async () => { circle = await outline(); });
  const split = await outline();
  assert.equal(circle.length, 1);
  assert.equal(split.length, 1);
  assert.notDeepEqual(split, circle);
  await offset('out', 2);
  const ring = await outline();
  assert.equal(ring.length, 2);
  await f.snapshot('01-outward-ring');

  f.phase = 'Undo Offset before Split';
  await keyboard('Meta+z');
  assert.deepEqual(await outline(), split);
  await button(f.page, 'Undo').click();
  assert.deepEqual(await outline(), circle);
  await f.same(empty);
  await f.snapshot('02-restored-circle');

  f.phase = 'Redo Split and keep Offset Redo through a refusal';
  await button(f.page, 'Redo').click();
  assert.deepEqual(await outline(), split);
  await offset('in', 12);
  await f.waitToast(/Cannot offset.*more than an arc’s radius/i);
  assert.deepEqual(await outline(), split);
  await f.same(empty);
  await keyboard('Meta+Shift+z');
  assert.deepEqual(await outline(), ring);
  await f.snapshot('03-restored-ring');

  const sketched = (await f.finishSketch('04-ring')).doc;
  checkRing(sketched, 12, 10);
  await f.openExtrudeHud();
  const extruded = (await f.applyExtrude({ distance: 2, previous: sketched, label: '05-ring' })).doc;
  await inspect('05-native-ring', extruded, 12, 10);
  await f.undo();
  await f.same(sketched);
  await f.redo();
  await f.same(extruded);
  assert.deepEqual(f.report.downloads, []);
}

await f.run(async () => {
  if (draftHistory) { await replayDraftHistory(); return; }
  for (const direction of rotated ? ['out'] : ['out', 'in']) {
    f.phase = 'draw-circle-split-' + direction;
    await f.newPage();
    await drawSplit();
    if (!baseline && !rotated && direction === 'out') {
      f.phase = 'refuse a collapsed inward offset without committing';
      const before = await f.snapshot('01-before-collapsed-offset');
      await offset('in', 12);
      await f.waitToast(/Cannot offset.*more than an arc’s radius/i);
      const refused = await f.snapshot('02-collapsed-offset-refused');
      for (const key of ['doc', 'bodies', 'history', 'historyControls', 'dirty']) assert.deepEqual(refused[key], before[key], key);
      assert.deepEqual(refused.selection.selection, before.selection.selection);
      await f.dismissToasts();
    }
    f.phase = direction + '-2-mm-after-split';
    await offset(direction, 2);
    await f.same(empty);
    const sketched = (await f.finishSketch(direction + '-finished-ring')).doc;
    const outward = (direction === 'out') !== baseline;
    const outer = outward ? 12 : 10, inner = outward ? 10 : 8;
    checkRing(sketched, outer, inner);
    await f.openExtrudeHud();
    const extruded = (await f.applyExtrude({ distance: 2, previous: sketched, label: direction + '-extruded-ring' })).doc;
    await inspect(direction + '-native-ring', extruded, outer, inner);
    if (!baseline && !rotated && direction === 'out') {
      await f.undo();
      await f.same(sketched);
      await f.redo();
      await f.same(extruded);
      const bytes = await saveOwned(extruded);
      await f.newPage();
      await openBytes(bytes);
      await f.same(extruded);
      await inspect('out-reopened-native-ring', extruded, outer, inner);
      await f.openFeatureEditor(1, 'reopened ring extrusion');
      await button(f.editor(), 'Edit sketch').click();
      await panel().waitFor();
      await f.snapshot('out-reopened-editable-ring');
      await f.page.keyboard.press('Escape');
      await panel().waitFor({ state: 'hidden' });
      await f.same(extruded);
      await f.openFeatureEditor(1, 'change distance after reopening');
      await f.editor().getByLabel('Distance', { exact: true }).fill('3');
      await button(f.editor(), 'Apply').click();
      await f.changed(extruded);
      const reedited = await f.doc();
      assert.deepEqual(reedited.nodes[0], extruded.nodes[0]);
      await inspect('out-reopened-extrusion-distance3', reedited, outer, inner, 3);
    }
  }
  assert.deepEqual(f.report.downloads, []);
});
