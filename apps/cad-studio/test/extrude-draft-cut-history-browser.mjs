import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const baseline = process.argv.includes('--baseline');
const pins = ['apps/cad-studio/test/extrude-draft-cut-history-browser.mjs',
  'packages/barocss-cad-model/src/app/editFields.ts', 'packages/barocss-cad-model/src/app/profileCommands.ts',
  'apps/cad-studio/src/ui/NodeEditor.tsx', 'apps/cad-studio/src/ui/Hud.tsx',
  'apps/cad-studio/src/app/featureNumberInput.ts', 'apps/cad-studio/src/state/useCommandPreview.ts',
  'packages/barocss-cad-model/src/app/editCommand.ts'];
const f = await createFlow({
  name: 'extrude-draft-cut-history', output: process.argv[2], envFrozen: 'D1158_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'A drafted Cut uses positive depth in creation and History, with its opening on the sketch plane.',
  limits: ['One rectangular upright stock, one attached rectangular profile, +10 degree Draft and one collapsed-wall refusal.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, faceGeometry, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8')), part = toPartDocument(doc);
const [body] = evaluateCadPart(part).outputs;
const sections = [10, 8, 6].map(z => {
  const aperture = body.brep.vertices.map(v => v.point).filter(p => Math.abs(p[2] - z) < 1e-8 && p[0] > 0 && p[0] < 40 && p[1] > 0 && p[1] < 30);
  return { z, xy: aperture.length ? [0, 1].map(k => Math.max(...aperture.map(p => p[k])) - Math.min(...aperture.map(p => p[k]))) : [] };
});
const floors = body.brep.faces.flatMap(face => {
  const g = faceGeometry(face);
  return g.kind === 'plane' && g.n[2] > 0.999999 ? [{ name: face.name, z: g.o[2] }] : [];
});
console.log(JSON.stringify({ valid: checkOutput(body).valid, count: body.bodyCount, volume: massPropertiesOf(body).volume, sections, floors,
  tool: part.features.find(feature => feature.id === 'n3') }));
`,
});
const bodyRef = node => ({ node, side: 'solid' });
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 3,
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 10 },
    { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [14, 11], max: [26, 19], on: bodyRef(1),
      plane: { origin: [0, 0, 10], normal: [0, 0, 1], xAxis: [1, 0, 0] } },
  ], outputs: { b1: bodyRef(1) },
};
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const field = (name, scope) => scope.getByLabel(name, { exact: true });
const near = (a, b) => Math.abs(a - b) < 1e-7;
const tangent = Math.tan(10 * Math.PI / 180);
const expected = (depth, slope = tangent) => 12000 - (96 * depth - 20 * slope * depth ** 2 + (4 / 3) * slope ** 2 * depth ** 3);

async function inspect(label, depth, slope = tangent) {
  const doc = await f.doc(), r = await f.inspect(label, doc);
  f.report.observations.push({ label, native: r });
  assert.ok(r.valid && r.count === 1 && near(r.volume, expected(depth, slope)), JSON.stringify(r));
  const at = z => r.sections.find(section => near(section.z, z))?.xy;
  assert.ok(near(at(10)?.[0], 12) && near(at(10)?.[1], 8), JSON.stringify(r));
  assert.ok(near(at(10 - depth)?.[0], 12 - 2 * slope * depth) && near(at(10 - depth)?.[1], 8 - 2 * slope * depth), JSON.stringify(r));
  assert.ok(r.floors.some(floor => near(floor.z, 10 - depth)), JSON.stringify(r));
  return doc;
}

await f.run(async () => {
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'D1158-drafted-cut.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed)) });
  await f.same(seed);
  await f.page.getByRole('group', { name: 'History', exact: true }).getByRole('button', { name: 'Sketch · rectangle', exact: true }).click();
  await f.editor().waitFor();
  await f.closeEditor();
  await f.openExtrudeHud();
  const hud = f.hud();
  await field('Operation', hud).selectOption('cut');
  if (!baseline) {
    await field('Distance', hud).fill('-2');
    await hud.locator('.status').filter({ hasText: /^refused$/ }).waitFor();
    await hud.getByText('Greater than 0 mm.', { exact: true }).waitFor();
    assert.equal(await button('Apply', hud).isDisabled(), true);
    await field('Distance', hud).press('Enter');
    await f.same(seed);
  }
  await field('Distance', hud).fill('10');
  await field('Draft', hud).fill('30');
  await hud.locator('.status').filter({ hasText: /^refused$/ }).waitFor();
  assert.equal(await button('Apply', hud).isDisabled(), true);
  await hud.getByText('The draft is too steep for this height', { exact: true }).waitFor();
  await field('Draft', hud).press('Enter');
  await f.same(seed);
  await f.snapshot('closed-walls-refused');
  await field('Distance', hud).fill('2');
  await field('Draft', hud).fill('10');
  await hud.locator('.status').filter({ hasText: /^preview$/ }).waitFor();
  await button('Apply', hud).click();
  await f.changed(seed);
  const before = await inspect('native-depth-2', 2);
  await f.snapshot('drafted-cut-depth-2');
  await f.openFeatureEditor(3, 'drafted Cut Distance');
  const editor = f.editor(), distance = field('Distance', editor);
  const displayed = Number(await distance.inputValue());
  f.report.observations.push({ label: 'history-distance', value: displayed });
  if (baseline) {
    assert.equal(displayed, -2);
    await distance.fill('4');
    const outward = await f.applyEditor(before, 'positive-distance-4');
    const result = await f.inspect('outward-native', outward.doc);
    f.report.observations.push({ label: 'outward-native', native: result });
    assert.ok(near(result.volume, 12000) && result.floors.every(floor => !near(floor.z, 6)), JSON.stringify(result));
    assert.fail('History interpreted a positive drafted Cut Distance as an outward extrusion and restored all cut material');
  }
  assert.equal(displayed, 2);
  await distance.fill('-4');
  assert.equal(await button('Apply', editor).isDisabled(), true);
  await distance.press('Enter');
  await f.same(before);
  await distance.fill('4');
  const after = await f.applyEditor(before, 'positive-distance-4');
  await inspect('native-depth-4', 4);
  await f.undo();
  await f.same(before);
  await f.redo();
  await f.same(after.doc);
  await f.openFeatureEditor(3, 'turn Draft off');
  await field('Draft', editor).fill('0');
  const straight = await f.applyEditor(after.doc, 'zero-draft-cut-depth-4');
  await inspect('native-zero-draft', 4, 0);
  await f.openFeatureEditor(3, 'turn Draft back on');
  await field('Draft', editor).fill('10');
  const restored = await f.applyEditor(straight.doc, 'restored-draft-cut-depth-4');
  await inspect('native-restored-draft', 4);
  const saved = await f.save('drafted-cut-restored');
  await f.freshOpen(saved.file, restored.doc, 'drafted-cut-reopened');
  await inspect('native-reopened', 4);
  await f.openFeatureEditor(3, 'reopened drafted cut');
  assert.equal(await field('Distance', f.editor()).inputValue(), '4');
  assert.equal(await field('Draft', f.editor()).inputValue(), '10');
});
