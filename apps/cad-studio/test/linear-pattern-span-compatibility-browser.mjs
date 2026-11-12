import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/linear-pattern-span-compatibility-browser.mjs',
  'apps/cad-studio/src/ui/NodeEditor.tsx',
  'packages/barocss-cad-model/src/engine/migrate.ts',
  'packages/barocss-cad-model/src/engine/part.ts',
  'packages/barocss-cad/src/part/part-transform.ts',
];
const f = await createFlow({
  name: 'linear-pattern-span-compatibility', output: process.argv[2], envFrozen: 'D833_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Compare an ignored field with an explicitly unsupported feature kind in the pre-span desktop reader.',
  limits: ['Pre-span Studio on one 10 × 6 × 8 mm prismatic seed. The two candidate files are synthetic.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const result = evaluateCadPart(toPartDocument(doc)).outputs;
console.log(JSON.stringify(result.map(body => ({
  id: body.id, count: body.bodyCount, valid: checkOutput(body).valid, mass: massPropertiesOf(body),
  vertices: body.brep.vertices.map(vertex => vertex.point),
}))));
`,
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    historyControls: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`).disabled),
  }),
});
const seed = [
  { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [30, 10], max: [40, 16] },
  { id: 'n1', kind: 'extrude', sketch: 0, height: 8 },
];
const pattern = { id: 'n2', kind: 'linear-pattern', parent: { node: 1, side: 'solid' }, axis: 'x', spacing: 30, count: 4 };
const docWith = node => ({
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [...seed, node],
  outputs: { b2: { node: 2, side: 'solid' } }, nextId: 3,
});
const near = (a, b) => Math.abs(a - b) < 1e-8;
const open = async (name, doc) => {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), f.page.getByRole('button', { name: 'Open', exact: true }).click()]);
  await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
};

async function inspectSpacing(label, doc, count) {
  const outputs = await f.inspect(label, doc);
  assert.equal(outputs.length, 1);
  const [output] = outputs;
  assert.equal(output.id, 'n2');
  assert.equal(output.count, count);
  assert.ok(output.valid);
  assert.equal(output.vertices.length, 8 * count);
  const steps = Array.from({ length: count }, (_, index) => index * 30);
  for (const offset of steps) {
    const corners = [30 + offset, 40 + offset].flatMap(x => [10, 16].flatMap(y => [0, 8].map(z => [x, y, z])));
    assert.ok(corners.every(corner => output.vertices.some(point => point.every((value, axis) => near(value, corner[axis])))));
  }
  const firstToLast = steps.at(-1), width = firstToLast + 10;
  const { fresh, massReady, bodies } = await f.bodies();
  assert.ok(fresh && massReady);
  assert.deepEqual(bodies.map(body => body.key), ['b2']);
  for (const measured of [output.mass, bodies[0]]) {
    assert.ok(near(measured.volume, 480 * count));
    assert.ok(measured.centroid.every((value, axis) => near(value, [35 + firstToLast / 2, 13, 4][axis])));
  }
  f.report.observations.push({ label, count, firstToLast, width, volume: 480 * count, corners: output.vertices.length });
}

await f.run(async () => {
  await f.newPage();
  f.phase = 'open a candidate that adds only an unknown span field';
  const additive = docWith({ ...pattern, span: 90 });
  await open('D833-additive-candidate', additive);
  await f.same(additive);
  await inspectSpacing('open-count-four', additive, 4);
  await f.openFeatureEditor(2, 'legacy count');
  assert.equal(await f.editor().getByLabel('Spacing', { exact: true }).inputValue(), '30');
  await f.editor().getByLabel('Count', { exact: true }).fill('6');
  await f.applyEditor(additive, 'additive-field-count-six');
  const accepted = docWith({ ...pattern, span: 90, count: 6 });
  await f.same(accepted);
  await inspectSpacing('additive-field-ignored', accepted, 6);

  f.phase = 'refuse the distinct feature kind with the same schema and node ID';
  await f.page.locator('.outliner .ol-row > button.ol').click();
  const before = await f.snapshot('accepted-before-distinct-kind');
  const distinct = docWith({ id: 'n2', kind: 'linear-span-pattern', parent: pattern.parent, axis: 'x', span: 90, count: 4 });
  await open('D833-distinct-kind-candidate', distinct);
  const message = await f.waitToast(/does not know: linear-span-pattern/);
  const after = await f.snapshot('distinct-kind-refused');
  for (const key of ['doc', 'bodies', 'history', 'historyControls', 'dirty', 'selection']) assert.deepEqual(after[key], before[key], key);
  f.report.observations.push({ label: 'distinct-kind-refused', message, retainedCount: 6 });
  await f.undo();
  await f.same(additive);
  await inspectSpacing('first-undo', additive, 4);
  await f.redo();
  await f.same(accepted);
  await inspectSpacing('first-redo', accepted, 6);
  assert.deepEqual(f.report.downloads, []);
});
