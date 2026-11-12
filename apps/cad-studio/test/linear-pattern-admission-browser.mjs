import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const [output, mode] = process.argv.slice(2);
const pins = [
  'apps/cad-studio/test/linear-pattern-admission-browser.mjs',
  'apps/cad-studio/src/ui/Hud.tsx',
  'apps/cad-studio/src/state/useCommandPreview.ts',
  'packages/barocss-cad-model/src/app/commands.ts',
  'packages/barocss-cad-model/src/chat/features.ts',
  'packages/barocss-cad/src/part/part-transform.ts',
];
const f = await createFlow({
  name: 'linear-pattern-admission', output, envFrozen: 'D831_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: 'Validate separate-body Count and Spacing before any copy and verify the first history step.',
  limits: ['Actual desktop HUD and one 4 × 6 mm XY rectangular extrusion. Direction X.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify(evaluateCadPart(toPartDocument(doc)).outputs.map(body => ({
  id: body.id, count: body.bodyCount, valid: checkOutput(body).valid, mass: massPropertiesOf(body),
  points: body.brep.vertices.map(vertex => vertex.point),
}))));
`,
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    historyControls: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`).disabled),
  }),
});
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [50, 10], max: [54, 16] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 8 },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
};
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const field = (parent, name) => parent.getByLabel(name, { exact: true });
const hud = () => f.page.getByRole('dialog', { name: 'Linear pattern', exact: true });
const apply = () => button(hud(), 'Apply');
const count = () => field(hud(), 'Count');
const spacing = () => field(hud(), 'Spacing');
const near = (a, b) => Math.abs(a - b) < 1e-8;
const settled = () => f.page.waitForFunction(() => ['preview', 'refused'].includes(document.querySelector('.hud .status')?.textContent.trim()));
const selectSource = () => f.page.locator('.outliner .ol-row > button.ol').click();

async function begin() {
  await clickModelCommand(f.page, 'Pattern', 'Linear pattern');
  assert.equal(await field(hud(), 'Direction').inputValue(), 'x');
  await field(hud(), 'Result').selectOption('separate');
  assert.equal(await count().getAttribute('min'), '2');
  assert.equal(await count().getAttribute('max'), '24');
}

async function checkGeometry(label, doc, offsets, height) {
  const native = await f.inspect(label, doc);
  assert.equal(native.length, offsets.length);
  const { fresh, massReady, bodies } = await f.bodies();
  assert.ok(fresh && massReady);
  assert.deepEqual(bodies.map(body => body.key), Object.keys(doc.outputs));
  assert.equal(bodies.length, offsets.length);
  const volume = 4 * 6 * height;
  const centroids = [];
  for (const [index, offset] of offsets.entries()) {
    const shown = bodies[index];
    const body = native.find(body => body.id === 'n' + shown.key.slice(1));
    const centroid = [52 + offset, 13, height / 2];
    const corners = [50 + offset, 54 + offset].flatMap(x => [10, 16].flatMap(y => [0, height].map(z => [x, y, z])));
    assert.ok(body?.valid && body.count === 1);
    assert.equal(body.points.length, 8);
    assert.ok(corners.every(corner => body.points.some(point => point.every((v, axis) => near(v, corner[axis])))));
    for (const result of [body.mass, shown]) {
      assert.ok(result.centroid.every((v, axis) => near(v, centroid[axis])));
      assert.ok(near(result.volume, volume));
    }
    centroids.push(body.mass.centroid);
  }
  f.report.observations.push({ label, offsets, centroids, volumeEach: volume, corners: offsets.length * 8, keys: Object.keys(doc.outputs) });
}

async function commit(previous, label) {
  await settled();
  await apply().click();
  await hud().waitFor({ state: 'hidden' });
  await f.changed(previous);
  await f.ready();
  return (await f.snapshot(label)).doc;
}

await f.run(async () => {
  f.phase = 'open source and make the previous accepted history step';
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: 'D831-linear-pattern.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);
  await f.openFeatureEditor(1, 'source extrusion');
  await field(f.editor(), 'Distance').fill('9');
  await f.applyEditor(source, 'source-height-9');
  const accepted = await f.doc();
  await selectSource();
  const invalidCases = [
    ['fractional-count', '2.5', '14', /whole-number Count from 2 to 24/],
    ['zero-spacing', '2', '0', /Spacing must be a finite nonzero distance/],
  ];
  if (mode === '--baseline') {
    for (const [label, n, s] of invalidCases) {
      f.phase = 'reproduce ' + label;
      await begin();
      await count().fill(n);
      await spacing().fill(s);
      const result = await commit(accepted, label);
      await checkGeometry(label, result, label === 'fractional-count' ? [0, 14, 28] : [0, 0], 9);
      await f.undo();
      await f.same(accepted);
      await selectSource();
    }
    assert.fail('The separate-body command committed fractional Count and zero Spacing.');
  }

  await begin();
  await settled();
  const before = await f.snapshot('accepted-with-pattern-open');
  for (const [label, n, s, reason] of [
    ...invalidCases,
    ['below-count', '1', '14', invalidCases[0][3]],
    ['above-count', '25', '14', invalidCases[0][3]],
  ]) {
    f.phase = 'refuse ' + label;
    await count().fill(n);
    await spacing().fill(s);
    await hud().locator('.hud-error').getByText(reason).waitFor();
    assert.equal(await count().inputValue(), n);
    assert.equal(await spacing().inputValue(), s);
    assert.ok(await apply().isDisabled());
    await count().press('Enter');
    await f.same(accepted);
    assert.ok(await hud().isVisible());
    const after = await f.snapshot(label + '-refused');
    for (const key of ['doc', 'history', 'historyControls', 'dirty', 'selection']) assert.deepEqual(after[key], before[key], key);
    for (const key of ['bodies', 'fresh', 'massReady']) assert.deepEqual(after.bodies[key], before.bodies[key], key);
    assert.deepEqual(after.bodies.colored, []);
  }
  await button(hud(), 'Cancel').click();
  await f.undo();
  await f.same(source);
  await checkGeometry('first-undo', source, [0], 8);
  await f.redo();
  await f.same(accepted);
  await checkGeometry('first-redo', accepted, [0], 9);

  f.phase = 'commit two separate bodies at a signed spacing';
  await selectSource();
  await begin();
  await count().fill('2');
  await spacing().fill('-16');
  const valid = await commit(accepted, 'signed-spacing-accepted');
  assert.deepEqual(valid.nodes.slice(0, 2), accepted.nodes);
  assert.deepEqual(valid.nodes.at(-1), { kind: 'translate', parent: { node: 3, side: 'solid' }, offset: [-16, 0, 0], id: 'n4' });
  await checkGeometry('signed-spacing-accepted', valid, [0, -16], 9);
  await f.undo();
  await f.same(accepted);
  await f.redo();
  await f.same(valid);
  assert.deepEqual(f.report.downloads, []);
});
