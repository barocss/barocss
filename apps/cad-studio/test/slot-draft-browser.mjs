import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const reopenSlot = process.argv[3] === '--reopen-slot';
const pins = [
  'apps/cad-studio/test/slot-draft-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/ui/SketchPanel.tsx',
  'apps/cad-studio/src/sketch/draftHistory.ts',
  'packages/barocss-cad-model/src/sketch/profile.ts',
  ...(reopenSlot ? ['packages/barocss-cad-model/src/sketch/reopen.ts', 'packages/barocss-cad-model/src/sketch/loops.ts', 'packages/barocss-cad-model/src/sketch/select.ts',
    'packages/barocss-cad-model/src/engine/doc.ts', 'packages/barocss-cad-model/src/engine/part.ts'] : []),
];
const f = await createFlow({
  name: 'slot-draft', output: process.argv[2], envFrozen: reopenSlot ? 'D1092_SOURCE_FROZEN' : 'D1091_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Replay Slot panel dimensions in draft history and verify native extrusion.',
  limits: ['One XY slot on desktop Studio WebGPU.'],
  inspectorSource: `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkBrep, faceGeometry, massPropertiesOf } from '@barocss/cad';
import { partSnapshot } from '@barocss/cad-model/engine/part';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const [body] = partSnapshot(doc).outputs;
assert.ok(body && checkBrep(body.brep, { strict: true }).valid);
const cylinders = body.brep.faces.flatMap(face => {
  const g = faceGeometry(face);
  return g.kind === 'cylinder' ? [{ name: face.name, ...g }] : [];
});
console.log(JSON.stringify({ cylinders, volume: massPropertiesOf(body).volume }));
`,
  snapshotExtra: () => ({
    fields: ['length', 'width', 'angle'].map(key => Number(document.getElementById('sk-slot-' + key)?.value)),
    outline: document.querySelector('svg.vp-overlay polygon.sk-shape')?.getAttribute('points') ?? null,
  }),
});
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const near = (a, b, tol = 1e-8) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

await f.run(async () => {
  await f.newPage();
  await button(f.page, 'New part').click();
  await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.ready();
  const empty = await f.doc();
  await button(f.page.getByLabel('Mode', { exact: true }), 'Sketch').click();
  await f.sketchPanel().getByLabel('Sketch plane', { exact: true }).selectOption('xy');
  await f.tool('Slot', 'o');
  const points = [[10, 15], [45, 15], [25, 25]];
  await f.frame(points);
  for (const point of points) await f.worldClick(point);
  const initial = await f.snapshot('01-slot');
  assert.deepEqual(initial.fields, [35, 20, 0]);
  assert.ok(initial.outline);
  let prior = initial;
  for (const [index, key, value] of [[0, 'length', 45], [1, 'width', 14], [2, 'angle', 30]]) {
    f.phase = 'edit and replay Slot ' + key;
    await f.page.locator('#sk-slot-' + key).fill(String(value));
    await f.page.evaluate(() => document.activeElement?.blur());
    const edited = await f.snapshot('02-' + key);
    assert.equal(edited.fields[index], value);
    assert.notEqual(edited.outline, prior.outline);
    assert.deepEqual(edited.doc, empty);
    assert.equal(await button(f.page, 'Undo').isEnabled(), true);
    await f.undo();
    const undone = await f.snapshot('03-undo-' + key);
    assert.deepEqual(undone.fields, prior.fields);
    assert.equal(undone.outline, prior.outline);
    assert.deepEqual(undone.doc, empty);
    await f.redo();
    const redone = await f.snapshot('04-redo-' + key);
    assert.deepEqual(redone.fields, edited.fields);
    assert.equal(redone.outline, edited.outline);
    prior = redone;
  }
  const sketch = (await f.finishSketch('05-finished')).doc;
  const outline = sketch.nodes[0];
  assert.deepEqual(outline.segments.map(segment => segment.kind), ['line', 'arc', 'line', 'arc']);
  assert.equal(new Set(outline.sideTags.outer).size, 4);
  const a = outline.segments[3].center, b = outline.segments[1].center;
  assert.deepEqual(a, [10, 15]);
  near(b[0], 10 + 45 * Math.cos(Math.PI / 6), 5e-5);
  near(b[1], 15 + 45 * Math.sin(Math.PI / 6), 5e-5);
  const history = f.page.getByRole('group', { name: 'History', exact: true });
  await button(history, 'Sketch · outline').click();
  await button(f.editor(), 'Close editor').click();
  await f.openExtrudeHud();
  const solid = await f.applyExtrude({ distance: 3, previous: sketch, label: '06' });
  const native = await f.inspect('slot-native', solid.doc);
  assert.equal(native.cylinders.length, 2);
  for (const cylinder of native.cylinders) near(cylinder.r, 7);
  const expected = 3 * (14 * Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.PI * 49);
  near(native.volume, expected, 1e-7);
  near(solid.bodies.bodies[0].volume, expected, 1e-7);
  f.report.observations.push({ label: 'slot-native', expectedVolumeMm3: expected, volumeMm3: native.volume });
  if (reopenSlot) {
    const file = 'Untitled.bcad', project = 'D1092 slot';
    await button(f.page, 'Project and versions').click();
    const versions = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
    await versions.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
    await button(versions, 'Project in this browser').click();
    await versions.getByLabel('Project', { exact: true }).waitFor();
    await button(f.page, 'Save').click();
    await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
    const bytes = Buffer.from(await f.page.evaluate(async ([project, file]) => {
      const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
      const folder = await projects.getDirectoryHandle(project);
      return (await (await folder.getFileHandle(file)).getFile()).text();
    }, [project, file]));
    assert.deepEqual(JSON.parse(bytes), solid.doc);
    await f.newPage();
    const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
    await chooser.setFiles({ name: file, mimeType: 'application/json', buffer: bytes });
    await f.same(solid.doc);
    await f.openFeatureEditor(1);
    await button(f.editor(), 'Edit sketch').click();
    await f.sketchPanel().waitFor();
    f.phase = 'recover the authored Slot controls after a fresh Open';
    const opened = await f.snapshot('07-reopened-slot');
    assert.deepEqual(opened.fields, [45, 14, 30]);
    await f.page.locator('#sk-slot-width').fill('16');
    const edited = await f.finishSketch('08-reopened-slot-width-edited');
    assert.deepEqual(edited.doc.nodes[0].sideTags, solid.doc.nodes[0].sideTags);
    assert.deepEqual(edited.doc.nodes[1], solid.doc.nodes[1]);
    const result = await f.inspect('slot-width-native', edited.doc);
    assert.deepEqual(result.cylinders.map(face => Math.round(face.r * 1e8) / 1e8), [8, 8]);
    assert.deepEqual(result.cylinders.map(face => face.name), native.cylinders.map(face => face.name));
    const volume = 3 * (16 * Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.PI * 64);
    near(result.volume, volume, 1e-7);
    f.report.observations.push({ label: 'slot-width-native', expectedVolumeMm3: volume, volumeMm3: result.volume });
    await f.undo();
    await f.same(solid.doc);
    await f.redo();
    await f.same(edited.doc);
    return;
  }
  await f.undo();
  await f.same(sketch);
  await f.redo();
  await f.same(solid.doc);
});
