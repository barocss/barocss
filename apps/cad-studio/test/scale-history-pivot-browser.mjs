import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const file = process.argv[3], baseline = process.argv.includes('--baseline');
assert.ok(file, 'Pass the retained local imported-holed-solid .bcad fixture.');
const bytes = await readFile(file);
assert.equal(sha256(bytes), '0d08faa0a66bfb51d330ec05b1507d5897924d038debc392e8c38b434f0ff4f2');
const seed = JSON.parse(bytes);
const pins = ['apps/cad-studio/src/ui/NodeEditor.tsx', 'packages/barocss-cad-model/src/app/editFields.ts',
  'packages/barocss-cad-model/src/app/commands.ts', 'packages/barocss-cad/src/part/part-transform.ts'];
const f = await createFlow({
  name: 'scale-history-pivot', output: process.argv[2], envFrozen: 'D1201_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'The Scale History pivot matches the authored pivot and can move an imported solid.',
  limits: ['Desktop WebGPU, one retained native STEP file with an authored circular through bore.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkBrep, faceGeometry, massPropertiesOf } from '@barocss/cad';
import { partSnapshot } from '@barocss/cad-model/engine/part';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify(partSnapshot(doc).outputs.map(output => ({
  valid: checkBrep(output.brep, { strict: true }).valid, volume: massPropertiesOf(output).volume,
  cylinders: output.brep.faces.map(face => faceGeometry(face)).filter(face => face.kind === 'cylinder'),
  vertices: output.brep.vertices.map(vertex => vertex.point),
}))));
`,
});
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const hud = () => f.page.getByRole('dialog', { name: 'Scale', exact: true });
const field = (label, scope = hud()) => scope.getByLabel(label, { exact: true });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} vs ${expected}`);
async function open(doc) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'scale-pivot.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
}
async function verify(label, doc, pivot) {
  const outputs = await f.inspect(label, doc);
  assert.equal(outputs.length, 1);
  const [body] = outputs, height = 12.460000000002193, factor = 2;
  const image = points => points.map((point, i) => factor * point + (1 - factor) * pivot[i]);
  const bounds = [[40, 0, 0], [50, 10, height]].map(image);
  assert.equal(body.valid, true);
  const retainedNativeVolume = 840.0677296794925;
  near(body.volume, retainedNativeVolume * factor ** 3);
  [Math.min, Math.max].forEach((extreme, j) => bounds[j].forEach((value, axis) => near(extreme(...body.vertices.map(point => point[axis])), value)));
  assert.equal(body.cylinders.length, 2);
  const centre = image([45, 5, 0]);
  for (const cylinder of body.cylinders) {
    near(cylinder.c[0], centre[0]);
    near(cylinder.c[1], centre[1]);
    near(cylinder.r, 6);
    near(Math.abs(cylinder.a[2]), 1);
  }
  f.report.observations.push({ label, pivot, bounds, boreCentreXY: centre.slice(0, 2), radius: 6, volume: body.volume });
}
await f.run(async () => {
  await f.newPage();
  await open(seed);
  await f.page.getByRole('complementary', { name: 'Browser', exact: true }).locator('.ol:not(.ol-step)').first().click();
  await clickModelCommand(f.page, 'Modify', 'Scale');
  const initialPivot = [45, 5, 0], revisedPivot = [48, 7, 2];
  await field('Factor').fill('2');
  for (const [i, name] of ['Pivot X', 'Pivot Y', 'Pivot Z'].entries()) await field(name).fill(String(initialPivot[i]));
  await hud().locator('.status.ok').waitFor();
  await f.same(seed);
  await button('Apply', hud()).click();
  await f.changed(seed);
  const scaled = (await f.snapshot('scaled-at-original-pivot')).doc;
  assert.deepEqual(scaled.nodes.at(-1), { kind: 'scale', parent: { node: 1, side: 'solid' }, factor: 2, pivot: initialPivot, id: 'n2' });
  await verify('original-pivot-native', scaled, initialPivot);
  await f.openFeatureEditor(2);
  if (baseline) {
    assert.deepEqual((await f.editorFields()).map(item => item.label), ['Factor']);
    await f.snapshot('history-pivot-missing');
    throw new Error('Scale has an authored pivot but History exposes only Factor.');
  }
  assert.equal(await field('Factor', f.editor()).inputValue(), '2');
  for (const [i, name] of ['Pivot X', 'Pivot Y', 'Pivot Z'].entries()) {
    const pivot = field(name, f.editor());
    assert.equal(Number(await pivot.inputValue()), initialPivot[i]);
    await pivot.fill(String(revisedPivot[i]));
  }
  const revised = await f.applyEditor(scaled, 'history-pivot-edited');
  const expected = structuredClone(scaled);
  expected.nodes[2].pivot = revisedPivot;
  assert.deepEqual(revised.doc, expected);
  await verify('new-pivot-native', revised.doc, revisedPivot);
  await f.undo();
  await f.same(scaled);
  await f.redo();
  await f.same(expected);
  await f.newPage();
  await open(expected);
  await verify('reopened-pivot-native', expected, revisedPivot);
  await f.openFeatureEditor(2);
  assert.deepEqual(await Promise.all(['Pivot X', 'Pivot Y', 'Pivot Z'].map(async name => Number(await field(name, f.editor()).inputValue()))), revisedPivot);
  await f.snapshot('reopened-history-pivot');
});
