import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const baseline = process.argv.includes('--baseline');
const pins = ['apps/cad-studio/test/extrude-cut-distance-browser.mjs', 'apps/cad-studio/src/ui/NodeEditor.tsx',
  'packages/barocss-cad-model/src/app/profileCommands.ts', 'packages/barocss-cad-model/src/app/editFields.ts',
  'packages/barocss-cad-model/src/engine/doc.ts', 'packages/barocss-cad/src/part/part-model.ts'];
const f = await createFlow({
  name: 'extrude-cut-distance', output: process.argv[2], envFrozen: 'D1151_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Change the saved cut depth in Studio and read the native pocket floor and material.',
  limits: ['One zero-draft face-attached circular pocket through the perimeter of two prior Z bores.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, faceGeometry, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const [body] = evaluateCadPart(toPartDocument(doc)).outputs;
console.log(JSON.stringify({ valid: checkOutput(body).valid, pieces: body.bodyCount, volume: massPropertiesOf(body).volume,
  planes: body.brep.faces.map(face => ({name: face.name, loops: face.loops.length, ...faceGeometry(face)}))
    .filter(face => face.kind === 'plane' && Math.abs(face.n[2]) > 0.999999).map(face => ({ name: face.name, z: face.o[2], nz: face.n[2], loops: face.loops })) }));
`,
});
const ref = node => ({ node, side: 'solid' });
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 6,
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 10 },
    { id: 'n2', kind: 'hole', parent: ref(1), center: [15, 15], radius: 2 },
    { id: 'n3', kind: 'hole', parent: ref(2), center: [25, 15], radius: 2 },
    { id: 'n4', kind: 'sketch', profile: 'circle', center: [20, 15], radius: 5, on: ref(3),
      plane: { origin: [0, 0, 10], xAxis: [1, 0, 0], normal: [0, 0, 1] } },
    { id: 'n5', kind: 'extrude', sketch: 4, height: 2, from: -2 },
    { id: 'n6', kind: 'difference', parent: ref(3), tool: ref(5) },
  ],
  outputs: { b6: ref(6) },
};
source.nextId = source.nodes.length;
const button = name => f.page.getByRole('button', { name, exact: true });
const lens = 25 * Math.acos(0.92) + 4 * Math.acos(0.2) - Math.sqrt(384) / 2;
const area = 25 * Math.PI - 2 * lens;
const volumeAt = depth => 12000 - 80 * Math.PI - depth * area;
const near = (a, b) => Math.abs(a - b) < 1e-7;

async function inspect(label, expected) {
  const doc = await f.doc(), result = await f.inspect(label, doc), shown = (await f.bodies()).bodies;
  const floors = result.planes.filter(plane => plane.nz > 0 && plane.z < 10 - 1e-7 && plane.z > 1e-7);
  f.report.observations.push({ label, result, shown: shown.map(b => ({ key: b.key, volume: b.volume })),
    expectedDepth: expected, expectedVolume: volumeAt(expected), expectedFloorZ: 10 - expected, cut: doc.nodes[5], floors });
  await f.snapshot(label);
  assert.ok(result.valid);
  assert.equal(result.pieces, 1);
  assert.equal(shown.length, 1);
  assert.ok(near(shown[0].volume, result.volume), JSON.stringify(shown[0].volume));
  return { doc, result, floors };
}

await f.run(async () => {
  await f.newPage();
  f.phase = 'open the saved 2 mm pocket with two bores';
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'D1151-pocket.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);
  await button('Iso').click();
  const before = await inspect('depth-2', 2);
  assert.ok(near(before.result.volume, volumeAt(2)));
  assert.ok(before.floors.some(plane => near(plane.z, 8)));
  f.phase = 'edit the original circular cut Distance from 2 to 4 mm';
  await f.openFeatureEditor(5, 'cut Distance');
  const field = f.editor().getByLabel('Distance', { exact: true });
  assert.equal(await field.inputValue(), '2');
  if (!baseline) {
    await field.fill('-4');
    assert.equal(await field.getAttribute('aria-invalid'), 'true');
    assert.equal(await f.editor().getByRole('button', { name: 'Apply', exact: true }).isEnabled(), false);
    await field.press('Enter');
    await f.same(source);
  }
  await field.fill('4');
  if (!baseline) assert.equal(await f.editor().getByLabel('Start Z', { exact: true }).inputValue(), '-4');
  await f.applyEditor(source, 'history-4');
  const after = await inspect('depth-4', 4);
  assert.equal(after.doc.nodes[5].height, 4);
  assert.deepEqual(after.doc.nodes[6], source.nodes[6]);
  if (baseline) {
    assert.equal(after.doc.nodes[5].from, -2);
    assert.ok(near(after.result.volume, before.result.volume));
    assert.ok(after.floors.some(plane => near(plane.z, 8)));
    assert.fail('History increased the cutter above the opening and left the pocket floor at z=8');
  }
  assert.equal(after.doc.nodes[5].from, -4);
  assert.ok(near(after.result.volume, volumeAt(4)));
  assert.ok(after.floors.some(plane => near(plane.z, 6)));
  await f.undo();
  await f.same(source);
  await f.redo();
  await f.same(after.doc);
  const saved = await f.save('reopened-depth-4');
  await f.freshOpen(saved.file, after.doc, 'reopened-accepted');
  const reopened = await inspect('reopened-native', 4);
  assert.ok(near(reopened.result.volume, volumeAt(4)) && reopened.floors.some(plane => near(plane.z, 6)));
  await f.openFeatureEditor(5, 'reopened cut Distance');
  assert.equal(await f.editor().getByLabel('Distance', { exact: true }).inputValue(), '4');
  assert.equal(await f.editor().getByLabel('Start Z', { exact: true }).inputValue(), '-4');
});
