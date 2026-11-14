import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx',
  'packages/barocss-cad-model/src/app/editFields.ts', 'packages/barocss-cad-model/src/app/profiles.ts'];
const f = await createFlow({
  name: 'loft-history-section-replacement', output: process.argv[2], envFrozen: 'D1172_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Replace one saved Loft section and preserve the other section copies and the guide.',
  limits: ['Desktop WebGPU. Three parallel rectangular sections and one straight polynomial guide.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8')), [out] = evaluateCadPart(toPartDocument(doc)).outputs;
const p = massPropertiesOf(out), points = out.brep.vertices.map(v => v.point);
console.log(JSON.stringify({ valid: checkOutput(out).valid, count: out.bodyCount, volume: p.volume,
  centroid: p.centroid, middleRing: points.filter(point => Math.abs(point[2] - 10) < 1e-8) }));
`,
});
const rectangle = (i, maxX, z, x = 0) => ({ id: `n${i}`, kind: 'sketch', profile: 'rectangle', min: [x, 0], max: [maxX, 10],
  ...(z ? { plane: { origin: [0,0,z], normal: [0,0,1], xAxis: [1,0,0] } } : {}) });
const guide = { kind: 'nurbs', degree: 1, knots: [0,0,0.5,1,1], controlPoints: [[0,0,0],[0,0,10],[0,0,20]] };
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 6,
  nodes: [rectangle(0, 10, 0), rectangle(1, 10, 10), rectangle(2, 10, 20), rectangle(3, 14, 10), rectangle(4, 14, 10, 1), rectangle(5, 14, 12)],
  outputs: {}, direct: {
    sources: { rail: '@model seam { version: 0; length-unit: mm; @curve #rail { type: nurbs; degree: 1; knots: [0,0,0.5,1,1]; control-points: [[0,0,0],[0,0,10],[0,0,20]]; weights: [1,1,1]; } }' },
    objects: [{ id: 'rail', name: 'Rail', source: 'rail', geometry: 'rail' }],
  },
};
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const near = (a, b) => Math.abs(a - b) < 1e-7;
const section = () => f.editor().getByLabel('Section 2 source', { exact: true });
async function verify(doc, label, volume, centroidX, middleMaxX) {
  const result = await f.inspect(label, doc);
  f.report.observations.push({ label, ...result });
  assert.ok(result.valid && result.count === 1 && near(result.volume, volume), JSON.stringify(result));
  assert.ok(result.centroid.every((v,i) => near(v, [centroidX, 5, 10][i])), JSON.stringify(result.centroid));
  assert.equal(result.middleRing.length, 4);
  for (const target of [[0,0,10], [middleMaxX,0,10], [middleMaxX,10,10], [0,10,10]]) {
    assert.ok(result.middleRing.some(point => point.every((value, axis) => near(value, target[axis]))), JSON.stringify(result.middleRing));
  }
}

await f.run(async () => {
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'D1172-loft-sections.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed)) });
  await f.same(seed);
  await button('Sketch 3').click();
  await button('Sketch 1').click({ modifiers: ['Shift'] });
  await button('Sketch 2').click({ modifiers: ['Shift'] });
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.command('Loft');
  const hud = f.page.getByRole('dialog', { name: 'Loft', exact: true });
  await hud.getByLabel('Guide (copied)', { exact: true }).selectOption({ label: 'Rail' });
  await hud.locator('.status').filter({ hasText: /^preview$/ }).waitFor();
  await hud.getByText('Sketch 1 → Sketch 2 → Sketch 3 (height order)', { exact: true }).waitFor();
  await button('Apply', hud).click();
  await f.changed(seed);
  const accepted = await f.doc(), loft = accepted.nodes.at(-1), index = accepted.nodes.length - 1;
  assert.deepEqual(loft.from, [0, 1, 2]);
  assert.deepEqual(loft.guide, guide);
  await verify(accepted, 'original-loft', 2000, 5, 10);
  await f.openFeatureEditor(index, 'inspect original section order');
  assert.equal(await section().count(), 1, 'Loft History cannot replace a saved section');
  assert.equal(await section().locator('option:checked').textContent(), 'Sketch 2');
  assert.equal(await section().locator('option').filter({ hasText: 'Sketch 6' }).count(), 0);
  await section().selectOption({ label: 'Copy Sketch 5' });
  await button('Apply', f.editor()).click();
  await f.editor().locator('.hud-error').getByText(/guide must pass through a vertex of section 1.*choose another section or reset/i).waitFor();
  await f.same(accepted);
  await f.snapshot('section-breaks-guide-refused');
  await section().selectOption({ label: 'Copy Sketch 4' });
  const after = await f.applyEditor(accepted, 'loft-section-replaced');
  assert.deepEqual(after.doc.nodes[index].from, [0, 3, 2]);
  assert.deepEqual(after.doc.nodes[index].sections, loft.sections);
  assert.deepEqual(after.doc.nodes[index].guide, guide);
  const copy = loft.sections[1].sketch;
  after.doc.nodes.forEach((node, i) => { if (i !== copy && i !== index) assert.deepEqual(node, accepted.nodes[i]); });
  assert.equal(after.doc.nodes[copy].id, accepted.nodes[copy].id);
  assert.equal(after.doc.nextId, accepted.nextId);
  await verify(after.doc, 'replaced-loft', 2400, 109 / 18, 14);
  await f.undo();
  await f.same(accepted);
  await f.redo();
  await f.same(after.doc);
  const saved = await f.save('loft-section-replacement');
  const reopened = await f.freshOpen(saved.file, after.doc, 'loft-section-reopened');
  await verify(reopened.doc, 'reopened-loft', 2400, 109 / 18, 14);
  await f.openFeatureEditor(index, 'read replaced section after Open');
  assert.equal(await section().locator('option:checked').textContent(), 'Sketch 4');
  await f.snapshot('loft-section-history');
});
