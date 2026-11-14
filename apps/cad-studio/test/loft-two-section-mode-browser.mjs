import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const baseline = process.argv.includes('--baseline');
const pins = ['apps/cad-studio/src/ui/NodeEditor.tsx', 'packages/barocss-cad-model/src/app/profileCommands.ts',
  'packages/barocss-cad-model/src/app/editFields.ts', 'packages/barocss-cad-model/src/engine/part.ts'];
const f = await createFlow({
  name: 'loft-two-section-mode', output: process.argv[2], envFrozen: 'D1170_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Show the actual supported Loft interpolation mode for two sections.',
  limits: ['Desktop WebGPU. Two unguided coaxial circles and a three-section mode control.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8')), part = toPartDocument(doc);
const out = evaluateCadPart(part).outputs[0], props = massPropertiesOf(out);
console.log(JSON.stringify({ valid: checkOutput(out).valid, count: out.bodyCount, volume: props.volume, method: props.method }));
`,
});
const circle = (i, radius, z) => ({ id: `n${i}`, kind: 'sketch', profile: 'circle', center: [0, 0], radius,
  ...(z ? { plane: { origin: [0, 0, z], normal: [0, 0, 1], xAxis: [1, 0, 0] } } : {}) });
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 3,
  nodes: [circle(0, 3, 0), circle(1, 6, 20), circle(2, 4, 10)], outputs: {},
};
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const hud = () => f.page.getByRole('dialog', { name: 'Loft', exact: true });
const settled = () => hud().locator('.status').filter({ hasText: /^preview$/ }).waitFor();
async function open(doc, name) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: `${name}.bcad`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
}
async function start(indices) {
  for (const [i, index] of indices.entries()) await button(`Sketch ${index + 1}`).click(i ? { modifiers: ['Shift'] } : {});
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.command('Loft');
  await settled();
}
async function verify(doc, label) {
  const loft = doc.nodes[5], native = await f.inspect(label, doc), expected = 20 * Math.PI * (9 + 18 + 36) / 3;
  f.report.observations.push({ label, loft, ...native, expected });
  assert.ok(native.valid && native.count === 1 && Math.abs(native.volume - expected) < 1e-6, JSON.stringify(native));
  assert.equal(loft.kind, 'loft');
  assert.deepEqual(loft.from, [0, 1]);
  assert.deepEqual(loft.sections, [{ sketch: 3, z: 0 }, { sketch: 4, z: 20 }]);
}
await f.run(async () => {
  await f.newPage();
  await open(seed, 'D1170-loft-modes');
  f.phase = 'choose the upper section before the lower section';
  await start([1, 0]);
  const mode = () => hud().getByLabel('Smooth (through the middle sections)', { exact: true });
  if (baseline) {
    await mode().selectOption('yes');
    await settled();
    await f.snapshot('smooth-offered-for-two');
    await button('Apply', hud()).click();
    await f.changed(seed);
    const after = await f.snapshot('smooth-choice-lost');
    await verify(after.doc, 'baseline-still-ruled');
    assert.equal(after.doc.nodes[5].smooth, undefined);
    assert.fail('Two-section creation offers Smooth while the result stays Ruled');
  }
  assert.equal(await mode().count(), 0);
  await hud().getByText('Ruled · 2 sections', { exact: true }).waitFor();
  await hud().getByText('Sketch 1 → Sketch 2 (height order)', { exact: true }).waitFor();
  await f.same(seed);
  await f.snapshot('ruled-two-section-preview');
  await button('Apply', hud()).click();
  await f.changed(seed);
  const after = await f.snapshot('ruled-two-section-applied');
  await verify(after.doc, 'applied-conical-frustum');
  assert.equal(after.doc.nodes[5].smooth, undefined);
  await f.openFeatureEditor(5, 'read Ruled in Loft History');
  await f.editor().getByText('Ruled · 2 sections', { exact: true }).waitFor();
  assert.equal(await f.editor().getByLabel('Smooth', { exact: true }).count(), 0);
  await f.snapshot('history-ruled');
  await f.closeEditor();
  await f.undo();
  await f.same(seed);
  await f.redo();
  await f.same(after.doc);
  const saved = await f.save('loft-two-section');
  const reopened = await f.freshOpen(saved.file, after.doc, 'loft-reopened');
  await verify(reopened.doc, 'reopened-conical-frustum');
  const legacy = structuredClone(after.doc);
  legacy.nodes[5].smooth = true;
  await open(legacy, 'D1170-legacy-two-section-smooth');
  await verify(legacy, 'legacy-flag-effective-ruled');
  await f.openFeatureEditor(5, 'read the mode of the legacy two-section flag');
  await f.editor().getByText('Ruled · 2 sections', { exact: true }).waitFor();
  await f.same(legacy);
  await f.snapshot('legacy-effective-ruled');
  await f.closeEditor();
  await open(seed, 'D1170-three-section-control');
  await start([1, 0, 2]);
  await mode().selectOption('yes');
  await settled();
  await hud().getByText('Sketch 1 → Sketch 3 → Sketch 2 (height order)', { exact: true }).waitFor();
  await button('Apply', hud()).click();
  await f.changed(seed);
  const smooth = await f.snapshot('three-section-smooth-control');
  assert.equal(smooth.doc.nodes.at(-1).smooth, true);
  assert.deepEqual(smooth.doc.nodes.at(-1).from, [0, 2, 1]);
  await f.openFeatureEditor(smooth.doc.nodes.length - 1, 'read three-section Smooth in History');
  assert.equal(await f.editor().getByLabel('Smooth', { exact: true }).isChecked(), true);
});
