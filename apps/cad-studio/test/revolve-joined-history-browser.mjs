import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/app/revolveAxisPick.ts',
  'packages/barocss-cad-model/src/app/revolveAxisEdit.ts'];
const f = await createFlow({
  name: 'revolve-joined-history', output: process.argv[2], envFrozen: 'D1166_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'In joined Revolve History, change the axis using an unchanged original edge of the consumed stock.',
  limits: ['Desktop WebGPU. One terminal Union of a full-turn Revolve and its rectangular stock.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, faceGeometry, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8')), part = toPartDocument(doc);
const result = evaluateCadPart(part), decoy = result.outputs.find(body => body.id === 'n3'), joined = result.outputs.find(body => body.id === 'n6');
const cylinders = joined.brep.faces.map(faceGeometry).filter(g => g.kind === 'cylinder');
console.log(JSON.stringify({ decoyVolume: massPropertiesOf(decoy).volume, decoyValid: checkOutput(decoy).valid,
  volume: massPropertiesOf(joined).volume, valid: checkOutput(joined).valid, count: joined.bodyCount, cylinders,
  axis: part.features.find(feature => feature.id === 'n5').axis }));
`,
});
const ref = node => ({ node, side: 'solid' });
const axisRef = side => ({ version: 1, sourceFeature: 'n1', edge: `n1.side${side}|n1.top`, side });
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 7,
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 20] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 20 },
    { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [50, 32], max: [90, 52] },
    { id: 'n3', kind: 'extrude', sketch: 2, height: 20 },
    { id: 'n4', kind: 'sketch', profile: 'rectangle', min: [10, 6], max: [20, 9], on: ref(1),
      plane: { origin: [0, 0, 20], normal: [0, 0, 1], xAxis: [1, 0, 0] } },
    { id: 'n5', kind: 'revolve', sketch: 4, axis: 'x', origin: [0, 0], dir: [1, 0], angle: 360, axisRef: axisRef(0) },
    { id: 'n6', kind: 'union', left: ref(1), right: ref(5) },
  ],
  outputs: { b3: ref(3), b6: ref(6) },
  bodies: { b3: { name: 'Decoy' }, b6: { name: 'Joined stock' } },
};
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const near = (a, b) => Math.abs(a - b) < 1e-7;
async function oracle(label, doc, y, radii, addedVolume) {
  const native = await f.inspect(label, doc), expected = 16000 + addedVolume;
  f.report.observations.push({ label, axisY: native.axis.origin[1], volume: native.volume, expected, decoyVolume: native.decoyVolume });
  assert.ok(native.valid && native.count === 1 && native.decoyValid && near(native.decoyVolume, 16000));
  assert.ok(Math.abs(native.volume - expected) < 1e-6, JSON.stringify(native));
  assert.ok(near(native.axis.origin[1], y) && near(Math.abs(native.axis.direction[0]), 1) && near(native.axis.direction[1], 0));
  for (const r of radii) assert.ok(native.cylinders.some(c => near(c.r, r) && near(c.c[1], y) && near(c.c[2], 20)));
}
async function pick(world, span) {
  const hit = await f.page.evaluate(world => {
    const edge = window.__studioEdgeAt(world, 4), pixel = window.__studioScreenOf(world);
    return edge && window.__studioSection().shownKeys[edge.body] === 'b6' && document.elementFromPoint(...pixel)?.closest('.vp-canvas') ? { edge, pixel } : null;
  }, world);
  const [x, y, z] = world;
  assert.ok(hit?.edge.segments.some(s => near(s[1], y) && near(s[4], y) && near(s[2], z) && near(s[5], z)
    && near(Math.abs(s[3] - s[0]), span) && x > Math.min(s[0], s[3]) && x < Math.max(s[0], s[3])), `joined visible edge at ${world}`);
  await f.page.mouse.click(...hit.pixel);
}
async function replace() {
  await f.openFeatureEditor(5, 'replace the axis on the joined Revolve');
  await f.editor().getByText('Linked edge n1.side0|n1.top', { exact: true }).waitFor();
  const start = button('Replace axis', f.editor());
  assert.equal(await start.count(), 1, 'History lacks Replace axis for a Revolve consumed by Join');
  await start.click();
  const hud = f.page.getByRole('dialog', { name: 'Replace axis', exact: true });
  await hud.locator('.status').filter({ hasText: /^pick edge$/ }).waitFor();
  assert.equal(await button('Apply', hud).isEnabled(), false);
  if (await button('Ortho').getAttribute('aria-pressed') !== 'true') await button('Ortho').click();
  await button('Top', f.page.locator('.views')).click();
  await f.page.waitForFunction(() => document.querySelector('.view-cube .vc-label')?.textContent === 'TOP');
  return hud;
}
const preview = hud => hud.locator('.status').filter({ hasText: /^preview$/ }).waitFor();

await f.run(async () => {
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'D1166-joined-history.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed)) });
  await f.same(seed);
  await oracle('accepted-y0', seed, 0, [6, 9], 337.5 * Math.PI);
  let hud = await replace();
  f.phase = 'refuse a generated edge of the joined body';
  await pick([12, 9, 20], 10);
  await f.waitToast(/Axis not selected.*original straight edge/i);
  assert.equal(await button('Apply', hud).isEnabled(), false);
  await f.same(seed);
  await f.snapshot('generated-edge-refused');
  await pick([30, 20, 20], 40);
  await hud.getByText('Linked edge n1.side2|n1.top', { exact: true }).waitFor();
  await preview(hud);
  await f.same(seed);
  await f.snapshot('joined-axis-preview');
  // A second invalid pick keeps the valid preview and leaves Apply as an explicit choice.
  await pick([12, 6, 20], 10);
  await f.waitToast(/Axis not selected.*original straight edge/i);
  await preview(hud);
  await f.same(seed);
  f.phase = 'pick the other original edge from the replacement preview';
  await pick([30, 0, 20], 40);
  await hud.getByText('Linked edge n1.side0|n1.top', { exact: true }).waitFor();
  await preview(hud);
  await f.same(seed);
  await f.snapshot('original-edge-repicked');
  await button('Cancel', hud).click();
  await f.same(seed);
  await f.snapshot('joined-axis-cancelled');
  hud = await replace();
  await pick([30, 20, 20], 40);
  await preview(hud);
  await button('Apply', hud).click();
  await f.changed(seed);
  const after = await f.snapshot('joined-axis-replaced');
  assert.deepEqual({ ...after.doc, nodes: after.doc.nodes.map((node, i) => i === 5 ? seed.nodes[5] : node) }, seed);
  assert.deepEqual(after.doc.nodes[5].axisRef, axisRef(2));
  assert.equal(after.doc.nodes[5].angle, 360);
  await oracle('replaced-y20', after.doc, 20, [11, 14], 562.5 * Math.PI);
  await f.undo();
  await f.same(seed);
  await f.redo();
  await f.same(after.doc);
  const saved = await f.save('revolve-joined-history');
  const reopened = await f.freshOpen(saved.file, after.doc, 'joined-axis-reopened');
  await oracle('reopened-y20', reopened.doc, 20, [11, 14], 562.5 * Math.PI);
  await f.openFeatureEditor(5, 'read the replaced axis after fresh Open');
  await f.editor().getByText('Linked edge n1.side2|n1.top', { exact: true }).waitFor();
});
