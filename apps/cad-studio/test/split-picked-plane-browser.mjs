import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const baseline = process.argv.includes('--baseline');
const pins = ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/viewport/useViewportPicking.ts',
  'packages/barocss-cad-model/src/app/commands.ts', 'packages/barocss-cad-model/src/engine/mesh.ts'];
const f = await createFlow({
  name: 'split-picked-plane', output: process.argv[2], envFrozen: 'D1197_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'An axis-aligned native face supplies the Split plane without changing its target.',
  limits: ['Desktop WebGPU, a tangent top face and a distinct reference box top.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkBrep, massPropertiesOf } from '@barocss/cad';
import { partSnapshot, bodyKeyOf } from '@barocss/cad-model/engine/part';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify(partSnapshot(doc).outputs.map(output => ({
  key: bodyKeyOf(output.id, doc.nodes), valid: checkBrep(output.brep, { strict: true }).valid,
  volume: massPropertiesOf(output).volume, centroid: massPropertiesOf(output).centroid,
  caps: output.brep.faces.filter(face => /^n4[.]cut[.]/.test(face.name)).map(face => ({
    name: face.name, points: face.surface.controlPoints.flat(),
  })),
}))));
`,
});
const z = 4.000123456789;
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 30], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 10, id: 'n1' },
    { kind: 'sketch', profile: 'rectangle', min: [70, 0], max: [78, 8], id: 'n2' },
    { kind: 'extrude', sketch: 2, height: z, id: 'n3' },
  ],
  outputs: { b1: { node: 1, side: 'solid' }, b3: { node: 3, side: 'solid' } }, nextId: 4,
};
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const hud = () => f.page.getByRole('dialog', { name: 'Split', exact: true });
const value = label => hud().getByLabel(label, { exact: true }).inputValue();
async function clickAt(point) {
  const pixel = await f.page.evaluate(point => window.__studioScreenOf(point), point);
  assert.ok(pixel?.length === 2);
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel), JSON.stringify(pixel));
  await f.page.mouse.click(...pixel);
}
const near = (actual, expected, tolerance) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} vs ${expected}`);
async function native(label, doc, at) {
  const outputs = await f.inspect(label, doc);
  assert.deepEqual(outputs.map(output => output.key).sort(), ['b3', 'b4_negative', 'b4_positive']);
  for (const { key, valid, volume, centroid, caps } of outputs) {
    assert.equal(valid, true);
    if (key === 'b3') {
      near(volume, 64 * z, 1e-7);
      assert.equal(caps.length, 0);
      continue;
    }
    const lower = key === 'b4_negative';
    near(volume, 1800 * (lower ? at : 10 - at), 1e-6);
    [30, 15, lower ? at / 2 : (at + 10) / 2].forEach((v, k) => near(centroid[k], v, 1e-9));
    assert.equal(caps.length, 1);
    caps[0].points.forEach(point => near(point[2], at, 1e-9));
  }
  f.report.observations.push({ label, at, outputs: outputs.map(({ key, volume, centroid }) => ({ key, volume, centroid })) });
}
await f.run(async () => {
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'split-reference.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed)) });
  await f.same(seed);
  if (await button('Ortho').getAttribute('aria-pressed') !== 'true') await button('Ortho').click();
  await button('Top', f.page.getByRole('group', { name: 'Views', exact: true })).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await clickAt([30, 15, 10]);
  await f.page.waitForFunction(() => window.__studioSelection.selection.faces.length === 1);
  await clickModelCommand(f.page, 'Modify', 'Split');
  await hud().waitFor();
  if (baseline) {
    assert.equal(await value('Normal'), 'x');
    assert.equal(await value('At'), '30');
    await hud().locator('.status.ok').waitFor();
    await f.snapshot('wrong-default-plane');
    throw new Error('Picking stock top Z=10 silently started an X=30 Split.');
  }
  assert.equal(await value('Normal'), 'z');
  assert.equal(await value('At'), '10');
  await hud().locator('.status.error').waitFor();
  assert.equal(await button('Apply', hud()).isDisabled(), true);
  await f.same(seed);
  assert.match((await f.snapshot('stock-top-tangent')).hud, /n1[.]top/);

  await clickAt([74, 4, z]);
  await hud().locator('.status.ok').waitFor();
  assert.equal(await value('Normal'), 'z');
  assert.equal(Number(await value('At')), z);
  assert.match((await f.snapshot('reference-top-preview')).hud, /n3[.]top/);
  await f.same(seed);
  await button('Apply', hud()).click();
  await f.changed(seed);
  const accepted = (await f.snapshot('reference-top-applied')).doc;
  assert.deepEqual(accepted.nodes.slice(0, -1), seed.nodes);
  assert.deepEqual(accepted.nodes.at(-1), { kind: 'split', parent: { node: 1, side: 'solid' }, axis: 'z', at: z, id: 'n4' });
  await native('actual-picked-plane', accepted, z);

  await f.openFeatureEditor(4);
  assert.equal(Number(await f.editor().getByLabel('At', { exact: true }).inputValue()), z);
  await f.editor().getByLabel('At', { exact: true }).fill('4.5');
  const edited = await f.applyEditor(accepted, 'history-at-4.5');
  const expected = structuredClone(accepted);
  expected.nodes.at(-1).at = 4.5;
  assert.deepEqual(edited.doc, expected);
  await native('history-plane', edited.doc, 4.5);
  await f.undo();
  await f.same(accepted);
  await f.undo();
  await f.same(seed);
  await f.redo();
  await f.same(accepted);
});
