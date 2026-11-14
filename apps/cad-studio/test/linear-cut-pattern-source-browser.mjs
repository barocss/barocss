import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const pins = ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/Hud.tsx',
  'apps/cad-studio/src/ui/NodeEditor.tsx', 'packages/barocss-cad-model/src/app/commands.ts'];
const baseline = process.argv.includes('--baseline');
const f = await createFlow({
  name: 'linear-cut-pattern-source', output: process.argv[2], envFrozen: 'D1195_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'An older Subtract cannot silently become the current Linear cut pattern source.',
  limits: ['Desktop WebGPU. Two distinct same-stock rectangular through cuts, with Linear cut pattern along X.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkBrep, massPropertiesOf } from '@barocss/cad';
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { partSnapshot } from '@barocss/cad-model/engine/part';
const ref = node => ({ node, side: 'solid' });
if (process.argv[3] === '"seed"') {
  let doc = emptyDoc();
  const box = (min, max) => {
    const sketch = doc.nodes.length;
    doc = withNode(doc, { kind: 'sketch', profile: 'rectangle', min, max });
    doc = withNode(doc, { kind: 'extrude', sketch, height: 10 });
  };
  box([0, 0], [60, 40]);
  box([8, 8], [12, 10]);
  doc = withNode(doc, { kind: 'difference', parent: ref(1), tool: ref(3) });
  box([8, 26], [14, 28]);
  console.log(JSON.stringify(withNode(doc, { kind: 'difference', parent: ref(4), tool: ref(6) })));
} else {
  const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  console.log(JSON.stringify(partSnapshot(doc).outputs.map(output => ({
    valid: checkBrep(output.brep, { strict: true }).valid,
    volume: massPropertiesOf(output).volume, centroid: massPropertiesOf(output).centroid,
    addedWalls: output.brep.faces.filter(face => /@1$/.test(face.name)).map(face => ({
      name: face.name, points: face.surface.controlPoints.flat(),
    })),
  }))));
}
`,
});
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const hud = () => f.page.getByRole('dialog', { name: 'Linear cut pattern', exact: true });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} vs ${expected}`);
const launch = () => clickModelCommand(f.page, 'Pattern', 'Linear cut pattern');
async function open(doc) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'two-subtracts.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
}
async function native(label, doc, cuts, spacing = 0) {
  const result = await f.inspect(label, doc);
  assert.equal(result.length, 1);
  assert.equal(result[0].valid, true);
  const volume = 24000 - cuts.reduce((sum, cut) => sum + cut[0], 0);
  const centroid = [30, 20, 5].map((center, axis) => (24000 * center
    - cuts.reduce((sum, cut) => sum + cut[0] * cut[axis + 1], 0)) / volume);
  near(result[0].volume, volume);
  result[0].centroid.forEach((value, index) => near(value, centroid[index]));
  const wallPlanes = [1, 0, 1, 0];
  const levels = [26, 14 + spacing, 28, 8 + spacing];
  const { addedWalls } = result[0];
  assert.equal(addedWalls.length, spacing === 0 ? 0 : 4);
  addedWalls.forEach(wall => {
    const side = /^n6[.]side([0-3])@1$/.exec(wall.name);
    assert.ok(side, wall.name);
    for (const point of wall.points) near(point[wallPlanes[Number(side[1])]], levels[Number(side[1])]);
  });
  assert.equal(new Set(addedWalls.map(wall => wall.name)).size, addedWalls.length);
  f.report.observations.push({ label, expected: { volume, centroid }, native: result[0] });
}
const cuts = [[80, 10, 9, 5], [120, 11, 27, 5]];
async function applyLinear(seed) {
  await hud().waitFor({ timeout: 10000 });
  await hud().getByLabel('Spacing', { exact: true }).fill('16');
  await hud().getByLabel('Count', { exact: true }).fill('2');
  await hud().locator('.status.ok').waitFor();
  assert.equal(await hud().getByLabel('Count', { exact: true }).inputValue(), '2');
  await f.same(seed);
  const preview = await f.snapshot('preview-current-source');
  if (!baseline) assert.match(preview.hud, /Cut source.*Subtract 2 \(n7\)/);
  await button('Apply', hud()).click();
  await f.changed(seed);
  const applied = await f.snapshot('current-source-applied');
  assert.deepEqual(applied.doc.nodes.slice(0, -1), seed.nodes);
  assert.deepEqual(applied.doc.nodes.at(-1), {
    kind: 'linear-feature-pattern', parent: { node: 7, side: 'solid' }, axis: 'x', spacing: 16, count: 2, id: 'n8',
  });
  await native('current-source-native', applied.doc, [...cuts, [120, 27, 27, 5]], 16);
  return applied.doc;
}
await f.run(async () => {
  const seed = await f.inspect('seed', {}, 'seed');
  await f.newPage();
  await open(seed);
  await native('initial-native', seed, cuts);
  const browser = f.page.getByRole('complementary', { name: 'Browser', exact: true });
  await browser.getByRole('button', { name: 'Show its features', exact: true }).click();
  await browser.locator('.ol-step').filter({ hasText: 'Subtract' }).first().click();
  await f.page.locator('.history .hs.edit[data-node-index="4"]').waitFor();
  const picked = await f.snapshot('older-subtract-inspected');
  assert.deepEqual(picked.selection.selection.bodies, [0]);
  await f.closeEditor();
  const undoBefore = await button('Undo').getAttribute('data-tip');
  const redoBefore = await button('Redo').getAttribute('data-tip');
  await launch();
  if (baseline) {
    await applyLinear(seed);
    throw new Error('After inspecting n4, launch silently used and repeated n7.');
  }
  await f.waitToast(/Subtract 1 \(n4\).*Select the body to repeat Subtract 2 \(n7\)/);
  assert.equal(await hud().count(), 0);
  await f.same(seed);
  assert.equal(await button('Undo').getAttribute('data-tip'), undoBefore);
  assert.equal(await button('Redo').getAttribute('data-tip'), redoBefore);
  assert.deepEqual((await f.bodies()).bodies, picked.bodies.bodies);
  await f.snapshot('earlier-source-refused');
  await f.dismissToasts();

  await browser.locator('.ol:not(.ol-step)').first().click();
  await launch();
  const applied = await applyLinear(seed);
  await f.openFeatureEditor(8, 'read source');
  assert.match((await f.snapshot('history-current-source')).editor, /Cut source.*Subtract 2 \(n7\)/);
  await f.editor().getByLabel('Spacing', { exact: true }).fill('18');
  const edited = await f.applyEditor(applied, 'history-spacing-18');
  const expected = structuredClone(applied);
  expected.nodes.at(-1).spacing = 18;
  assert.deepEqual(edited.doc, expected);
  await native('history-native', edited.doc, [...cuts, [120, 29, 27, 5]], 18);
  await f.undo();
  await f.same(applied);
  await f.undo();
  await f.same(seed);
  await f.redo();
  await f.same(applied);
  await f.redo();
  await f.same(expected);
});
