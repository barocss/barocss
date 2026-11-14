import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx',
  'apps/cad-studio/src/state/useCommandPreview.ts', 'packages/barocss-cad-model/src/app/profileCommands.ts',
  'packages/barocss-cad-model/src/engine/revolveAxis.ts'];
const f = await createFlow({
  name: 'revolve-history-axis', output: process.argv[2], envFrozen: 'D1164_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Replace an axis in History by picking an earlier current native edge.',
  limits: ['Desktop WebGPU. One full-turn standalone Revolve and one visible earlier rectangular stock.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, faceGeometry, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8')), part = toPartDocument(doc);
const result = evaluateCadPart(part), stock = result.outputs.find(body => body.id === 'n1'), rotor = result.outputs.find(body => body.id === 'n3');
const cylinders = rotor.brep.faces.map(faceGeometry).filter(g => g.kind === 'cylinder');
console.log(JSON.stringify({ stockValid: checkOutput(stock).valid, stockVolume: massPropertiesOf(stock).volume,
  valid: checkOutput(rotor).valid, volume: massPropertiesOf(rotor).volume, count: rotor.bodyCount,
  axis: part.features.find(feature => feature.id === 'n3').axis, cylinders }));
`,
});
const ref = node => ({ node, side: 'solid' });
const axisRef = side => ({ version: 1, sourceFeature: 'n1', edge: `n1.side${side}|n1.top`, side });
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 6,
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 24] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 20 },
    { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [10, 6], max: [20, 9],
      plane: { origin: [0, 0, 20], normal: [0, 0, 1], xAxis: [1, 0, 0] } },
    { id: 'n3', kind: 'revolve', sketch: 2, axis: 'x', origin: [40, 20], dir: [-1, 0], angle: 360, axisRef: axisRef(2) },
    { id: 'n4', kind: 'sketch', profile: 'rectangle', min: [60, 0], max: [70, 12] },
    { id: 'n5', kind: 'extrude', sketch: 4, height: 20 },
  ],
  outputs: { b1: ref(1), b3: ref(3), b5: ref(5) },
  bodies: { b1: { name: 'Axis stock' }, b3: { name: 'Rotor' }, b5: { name: 'Later solid' } },
};

const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const near = (a, b) => Math.abs(a - b) < 1e-7;
async function verify(label, doc, y, r0, r1) {
  const native = await f.inspect(label, doc), expected = 10 * Math.PI * (r1 ** 2 - r0 ** 2);
  f.report.observations.push({ label, axisY: native.axis.origin[1], volume: native.volume, expected, stockVolume: native.stockVolume });
  assert.ok(native.stockValid && near(native.stockVolume, 19200));
  assert.ok(native.valid && native.count === 1 && near(native.volume, expected), JSON.stringify(native));
  assert.ok(near(native.axis.origin[1], y) && near(Math.abs(native.axis.direction[0]), 1) && near(native.axis.direction[1], 0));
  for (const r of [r0, r1]) assert.ok(native.cylinders.some(c => near(c.r, r) && near(c.c[1], y) && near(c.c[2], 20)));
}
async function open(doc, title) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: `${title}.bcad`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
}
async function replace(label, mode) {
  await f.openFeatureEditor(3, label);
  await f.editor().getByText(mode, { exact: true }).waitFor();
  const start = button('Replace axis', f.editor());
  assert.equal(await start.count(), 1, 'History has no Replace axis action for this Revolve');
  await start.click();
  const hud = f.page.getByRole('dialog', { name: 'Replace axis', exact: true });
  await hud.locator('.status').filter({ hasText: /^pick edge$/ }).waitFor();
  assert.equal(await button('Apply', hud).isEnabled(), false);
  if (await button('Ortho').getAttribute('aria-pressed') !== 'true') await button('Ortho').click();
  await button('Top', f.page.locator('.views')).click();
  await f.page.waitForFunction(() => document.querySelector('.view-cube .vc-label')?.textContent === 'TOP');
  return hud;
}
async function pick(world, key) {
  const hit = await f.page.evaluate(({ world, key }) => {
    const edge = window.__studioEdgeAt(world, 4), pixel = window.__studioScreenOf(world);
    return edge && window.__studioSection().shownKeys[edge.body] === key && document.elementFromPoint(...pixel)?.closest('.vp-canvas') ? { edge, pixel } : null;
  }, { world, key });
  assert.ok(hit?.edge.segments.length, `visible edge on ${key} at ${world}`);
  await f.page.mouse.click(...hit.pixel);
}
const preview = hud => hud.locator('.status').filter({ hasText: /^preview$/ }).waitFor();

await f.run(async () => {
  await f.newPage();
  await open(seed, 'D1164-history-axis');
  await verify('accepted-y24', seed, 24, 15, 18);
  const mode = 'Linked edge n1.side2|n1.top';
  let hud = await replace('replace linked axis', mode);
  await f.page.keyboard.press('Shift+Enter');
  await f.same(seed);
  f.phase = 'reject a later edge during axis replacement';
  await pick([65, 0, 20], 'b5');
  await f.page.getByText(/earlier rectangular solid/i).waitFor();
  assert.equal(await button('Apply', hud).isEnabled(), false);
  await f.same(seed);
  await f.snapshot('later-edge-refused');
  await pick([30, 0, 20], 'b1');
  await preview(hud);
  await hud.getByText('Linked edge n1.side0|n1.top', { exact: true }).waitFor();
  await f.page.getByText('Axis not selected', { exact: true }).waitFor({ state: 'hidden' });
  await f.same(seed);
  await f.snapshot('axis-preview');
  await button('Cancel', hud).click();
  await f.same(seed);
  await f.snapshot('axis-cancelled');
  hud = await replace('replace the accepted axis again', mode);
  await pick([30, 0, 20], 'b1');
  await preview(hud);
  await f.page.keyboard.press('Shift+Enter');
  await f.changed(seed);
  await hud.waitFor({ state: 'hidden' });
  const after = await f.snapshot('axis-replaced');
  assert.deepEqual({ ...after.doc, nodes: after.doc.nodes.map((node, i) => i === 3 ? seed.nodes[3] : node) }, seed);
  const { origin, dir, axisRef: newAxis, ...retained } = after.doc.nodes[3];
  assert.deepEqual(retained, { id: 'n3', kind: 'revolve', sketch: 2, axis: 'x', angle: 360 });
  assert.deepEqual(newAxis, axisRef(0));
  assert.ok(near(origin[1], 0) && near(Math.abs(dir[0]), 1));
  await verify('replaced-y0', after.doc, 0, 6, 9);
  await f.undo();
  await f.same(seed);
  await f.redo();
  await f.same(after.doc);
  const saved = await f.save('revolve-history-axis');
  const reopened = await f.freshOpen(saved.file, after.doc, 'axis-reopened');
  await verify('reopened-y0', reopened.doc, 0, 6, 9);
  await f.openFeatureEditor(3, 'read replaced axis after fresh Open');
  await f.editor().getByText('Linked edge n1.side0|n1.top', { exact: true }).waitFor();
  await f.closeEditor();
  const fixed = structuredClone(seed);
  delete fixed.nodes[3].axisRef;
  await open(fixed, 'D1164-fixed-axis');
  await verify('fixed-y20', fixed, 20, 11, 14);
  hud = await replace('replace legacy fixed axis', 'Fixed edge');
  await pick([30, 0, 20], 'b1');
  await preview(hud);
  await button('Apply', hud).click();
  await f.same(after.doc);
  await f.snapshot('fixed-axis-replaced');
});
