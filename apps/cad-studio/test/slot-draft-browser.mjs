import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/slot-draft-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/ui/SketchPanel.tsx',
  'apps/cad-studio/src/sketch/draftHistory.ts',
  'packages/barocss-cad-model/src/sketch/profile.ts',
];
const f = await createFlow({
  name: 'slot-draft', output: process.argv[2], envFrozen: 'D1091_SOURCE_FROZEN',
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
  await f.undo();
  await f.same(sketch);
  await f.redo();
  await f.same(solid.doc);
});
