import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const baseline = process.argv[3] === '--baseline';
const pins = [
  'apps/cad-studio/test/deleted-profile-selection-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/state/useFeatureHistory.ts',
  'packages/barocss-cad-model/src/chat/features.ts',
];
const f = await createFlow({
  name: 'deleted-profile-selection', output: process.argv[2], envFrozen: 'D810_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Keep surviving sketch selections and retire deleted selections during History deletion.',
  limits: ['An ordinary drilled plate, two free profiles and an independent cylinder.'],
});
const ref = node => ({ node, side: 'solid' });
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 20] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 8 },
    { id: 'n2', kind: 'hole', parent: ref(1), center: [15, 10], radius: 2, face: 'n1.top' },
    { id: 'n3', kind: 'sketch', profile: 'rectangle', min: [33, 4], max: [39, 16] },
    { id: 'n4', kind: 'sketch', profile: 'circle', center: [46, 10], radius: 3 },
    { id: 'n5', kind: 'sketch', profile: 'circle', center: [65, 10], radius: 4 },
    { id: 'n6', kind: 'extrude', sketch: 5, height: 6 },
  ],
  outputs: { b2: ref(2), b6: ref(6) }, nextId: 7,
};
const [plateSketch, plate, hole, spare, target, witness, cylinder] = source.nodes;
const removedSpare = {
  ...source, nodes: [plateSketch, plate, hole, target, witness, { ...cylinder, sketch: 4 }],
  outputs: { b2: ref(2), b6: ref(5) },
};
const removedPlate = {
  ...source, nodes: [spare, target, witness, { ...cylinder, sketch: 2 }],
  outputs: { b6: ref(3) },
};
const removedPicked = {
  ...source, nodes: [plateSketch, plate, hole, spare, witness, { ...cylinder, sketch: 4 }],
  outputs: { b2: ref(2), b6: ref(5) },
};
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const history = () => f.page.getByRole('group', { name: 'History', exact: true });
const pickedCircle = () => button(history(), 'Sketch · circle');
const dialog = () => f.page.getByRole('dialog', { name: 'Delete with dependents', exact: true });
async function openAndPick(doc = source) {
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: 'D810-delete.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
  await pickedCircle().click();
  await f.page.waitForFunction(() => window.__studioSelection.selection.sketches?.[0] === 4);
}
async function deleteFromHistory(step) {
  await step.click({ button: 'right' });
  await f.page.getByRole('menuitem', { name: /^Delete/ }).click();
}
async function checkPick(label, expected, index, id) {
  await f.same(expected);
  const state = await f.snapshot(label);
  const picked = state.selection.selection.sketches ?? [];
  assert.deepEqual(picked, index === null ? [] : [index]);
  if (index !== null) assert.equal(state.doc.nodes[index]?.id ?? null, id);
  f.report.observations.push({ label, picked, id });
}
async function extrudeSelected(label, previous, profile, radius, x) {
  await f.openExtrudeHud();
  const { doc, bodies } = await f.applyExtrude({ distance: 2, previous, label });
  assert.equal(doc.nodes.at(-1).kind, 'extrude');
  assert.equal(doc.nodes[doc.nodes.at(-1).sketch].id, profile);
  const output = bodies.bodies.find(body => body.key === 'b7');
  assert.ok(output && Math.abs(output.volume - 2 * Math.PI * radius ** 2) <= 1e-5, JSON.stringify(output));
  assert.ok(Math.hypot(output.centroid[0] - x, output.centroid[1] - 10, output.centroid[2] - 1) <= 1e-6, JSON.stringify(output));
  f.report.observations.push({ label, profile, volume: output.volume, centroid: output.centroid });
}

await f.run(async () => {
  f.phase = 'delete the independent sketch ahead of the picked circle';
  await openAndPick();
  await deleteFromHistory(button(history(), 'Sketch · rectangle'));
  await checkPick('01-delete-earlier', removedSpare, baseline ? 4 : 3, baseline ? 'n5' : 'n4');
  if (!baseline) {
    await f.undo();
    await checkPick('02-undo-delete', source, 4, 'n4');
    await f.redo();
    await checkPick('03-redo-delete', removedSpare, 3, 'n4');
  }
  await extrudeSelected('04-extrude-after-delete', removedSpare, baseline ? 'n5' : 'n4', baseline ? 4 : 3, baseline ? 65 : 46);

  f.phase = 'cancel and then confirm deletion of the plate with its Hole';
  await openAndPick();
  const plateStep = history().locator('button[data-node-index="1"]');
  await deleteFromHistory(plateStep);
  await dialog().getByText(/Hole Ø4/).waitFor();
  await button(dialog(), 'Cancel').click();
  await checkPick('05-cancel-cascade', source, 4, 'n4');
  await deleteFromHistory(plateStep);
  await button(dialog(), 'Delete 2').click();
  await checkPick('06-confirm-cascade', removedPlate, baseline ? 4 : 1, baseline ? null : 'n4');
  if (!baseline) await extrudeSelected('07-extrude-after-cascade', removedPlate, 'n4', 3, 46);

  f.phase = 'delete the picked sketch and retire its selection';
  await openAndPick();
  await deleteFromHistory(pickedCircle());
  await checkPick('08-delete-picked-sketch', removedPicked, baseline ? 4 : null, baseline ? 'n5' : null);
  f.phase = 'remove the only solid and keep the selected surviving sketch';
  const singleSolid = { ...source, nodes: source.nodes.slice(0, 5), outputs: { b2: ref(2) } };
  const noSolids = { ...singleSolid, nodes: [spare, target], outputs: {} };
  await openAndPick(singleSolid);
  await deleteFromHistory(history().locator('button[data-node-index="1"]'));
  await button(dialog(), 'Delete 2').click();
  await checkPick('09-delete-only-solid', noSolids, baseline ? null : 1, baseline ? null : 'n4');
  if (!baseline) await extrudeSelected('10-extrude-after-last-solid', noSolids, 'n4', 3, 46);
  assert.deepEqual(f.report.downloads, []);
});
