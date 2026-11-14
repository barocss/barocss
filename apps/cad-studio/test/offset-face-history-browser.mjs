import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx',
  'packages/barocss-cad-model/src/app/profileCommands.ts', 'packages/barocss-cad-model/src/app/nativeOffsetFace.ts'];
const f = await createFlow({
  name: 'offset-face-history', output: process.argv[2], envFrozen: 'D1173_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Edit the original signed Offset of a cylindrical bottom cap through History.',
  limits: ['Desktop WebGPU. A bottom cap of an upright circular cylinder with radius 5 and initial thickness 10 mm.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, faceGeometry, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8')), [body] = evaluateCadPart(toPartDocument(doc)).outputs;
const props = massPropertiesOf(body), caps = body.brep.faces.flatMap(face => {
  const g = faceGeometry(face);
  return g.kind === 'plane' && face.surface.kind === 'surface' ? [[face.name, face.surface.controlPoints[0][0][2]]] : [];
});
console.log(JSON.stringify({ id: body.id, valid: checkOutput(body).valid, solids: body.bodyCount, volume: props.volume, centroid: props.centroid, caps }));
`,
});
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2,
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'circle', center: [0,0], radius: 5 },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 10 },
  ],
  outputs: { b1: { node: 1, side: 'solid' } },
};
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const preview = hud => hud.locator('.status').filter({ hasText: /^preview$/ }).waitFor();
const volume = d => 25 * Math.PI * (10 + d);
async function verify(label, doc, d) {
  const native = await f.inspect(label, doc), expected = volume(d);
  f.report.observations.push({ label, ...native, expected });
  assert.ok(native.valid && native.solids === 1 && Math.abs(native.volume - expected) < 1e-6, JSON.stringify(native));
  assert.deepEqual(native.caps.map(([, z]) => z).sort((a,b) => a-b), [-d, 10]);
  assert.ok(Math.abs(native.centroid[2] - (10 - d) / 2) < 1e-7);
}
async function editOffset() {
  await f.openFeatureEditor(4, 'look for the original signed Offset');
  const start = button('Edit offset', f.editor());
  assert.equal(await start.count(), 1, 'History has no action for the original signed Offset');
  await start.click();
  const edit = f.page.getByRole('dialog', { name: 'Edit Offset face', exact: true });
  await preview(edit);
  return edit;
}
async function selectBottom() {
  await button('View cube directions', f.page.getByRole('group', { name: 'View cube' })).click();
  await f.page.getByRole('menuitem', { name: 'Bottom', exact: true }).click();
  await f.page.waitForFunction(() => document.querySelector('.view-cube .vc-label')?.textContent === 'BOTTOM');
  if (await button('Ortho').getAttribute('aria-pressed') !== 'true') await button('Ortho').click();
  const px = await f.page.evaluate(() => window.__studioScreenOf([0,0,0]));
  assert.ok(px?.length === 2);
  await f.page.mouse.click(...px);
  await f.page.waitForFunction(() => window.__studioSelection.selection.faces.length === 1);
}
await f.run(async () => {
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'D1173-offset-history.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed)) });
  await f.same(seed);
  await selectBottom();
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.command('Offset face');
  const create = f.page.getByRole('dialog', { name: 'Offset face', exact: true });
  await preview(create);
  await button('Apply', create).click();
  await f.changed(seed);
  const initial = await f.snapshot('offset-out-two');
  await verify('offset-out-two', initial.doc, 2);
  let edit = await editOffset();
  const offset = edit.getByLabel('Offset', { exact: true });
  assert.equal(await offset.inputValue(), '2');
  await preview(edit);
  await offset.fill('3');
  await preview(edit);
  await f.same(initial.doc);
  await f.snapshot('offset-edit-preview');
  await button('Apply', edit).click();
  await f.changed(initial.doc);
  const changed = await f.snapshot('offset-out-three');
  assert.deepEqual(changed.doc.nodes.map(node => node.id), initial.doc.nodes.map(node => node.id));
  assert.deepEqual(changed.doc.outputs, initial.doc.outputs);
  await verify('offset-out-three', changed.doc, 3);
  await f.undo();
  await f.same(initial.doc);
  await f.redo();
  await f.same(changed.doc);
  edit = await editOffset();
  const signed = edit.getByLabel('Offset', { exact: true });
  assert.equal(await signed.inputValue(), '3');
  await signed.fill('-10');
  await edit.locator('.status').filter({ hasText: /^refused$/ }).waitFor();
  assert.equal(await button('Apply', edit).isEnabled(), false);
  await f.same(changed.doc);
  await f.snapshot('zero-thickness-refused');
  await signed.fill('-2');
  await preview(edit);
  await f.same(changed.doc);
  await button('Apply', edit).click();
  await f.changed(changed.doc);
  const inward = await f.snapshot('offset-in-two');
  assert.deepEqual(inward.doc.nodes.map(node => node.id), initial.doc.nodes.map(node => node.id));
  assert.deepEqual(inward.doc.outputs, initial.doc.outputs);
  assert.deepEqual(inward.doc.nodes[4].made.values, { d: -2, face: 'n1.bottom' });
  assert.equal(inward.doc.nodes[4].kind, 'difference');
  await verify('offset-in-two', inward.doc, -2);
  await f.undo();
  await f.same(changed.doc);
  await f.redo();
  await f.same(inward.doc);
  const saved = await f.save('offset-signed-history');
  const reopened = await f.freshOpen(saved.file, inward.doc, 'offset-history-reopened');
  await verify('offset-history-reopened', reopened.doc, -2);
  edit = await editOffset();
  assert.equal(await edit.getByLabel('Offset', { exact: true }).inputValue(), '-2');
  await button('Cancel', edit).click();
  await f.same(inward.doc);
});
