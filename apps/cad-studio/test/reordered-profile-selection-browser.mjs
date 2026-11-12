import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const baseline = process.argv[3] === '--baseline';
const pins = [
  'apps/cad-studio/test/reordered-profile-selection-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/state/useFeatureHistory.ts',
  'packages/barocss-cad-model/src/app/profileCommands.ts',
  'packages/barocss-cad-model/src/chat/features.ts',
];
const f = await createFlow({
  name: 'reordered-profile-selection', output: process.argv[2], envFrozen: 'D809_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce selection moving to a different sketch after History reorder.' :
    'Preserve the free profile selection through reorder and history and consume it with Extrude.',
  limits: ['A free ordinary rectangular sketch and one independent cylindrical extrusion.'],
});
const ref = node => ({ node, side: 'solid' });
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 20] },
    { id: 'n1', kind: 'sketch', profile: 'circle', center: [50, 10], radius: 5 },
    { id: 'n2', kind: 'extrude', sketch: 1, height: 6 },
  ],
  outputs: { b2: ref(2) }, nextId: 3,
};
const [plate, circle, cylinder] = source.nodes;
const reordered = {
  ...source, nodes: [circle, { ...cylinder, sketch: 0 }, plate],
  outputs: { b2: ref(1) },
};
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const history = () => f.page.getByRole('group', { name: 'History', exact: true });
async function selectedProfile(label, index, id) {
  await f.ready();
  const state = await f.snapshot(label);
  const picked = state.selection?.selection?.sketches;
  assert.deepEqual(picked, [index]);
  assert.equal(state.doc.nodes[index].id, id);
  f.report.observations.push({ label, index, id });
}

await f.run(async () => {
  f.phase = 'select the free rectangle in History';
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: 'D809-profile.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);
  await button(history(), 'Sketch · rectangle').click();
  await selectedProfile('01-free-rectangle', 0, 'n0');

  f.phase = 'move the cylinder before the selected rectangle';
  await history().locator('button[data-node-index="2"]').click({ button: 'right' });
  await f.page.getByRole('menuitem', { name: 'Move earlier', exact: true }).click();
  await f.same(reordered);
  await selectedProfile('02-reordered', baseline ? 0 : 2, baseline ? 'n1' : 'n0');
  if (!baseline) {
    f.phase = 'keep the same sketch across first Undo and Redo';
    await f.undo();
    await f.same(source);
    await selectedProfile('03-undone', 0, 'n0');
    await f.redo();
    await f.same(reordered);
    await selectedProfile('04-redone', 2, 'n0');
  }

  f.phase = 'extrude the current selection without repicking';
  await f.openExtrudeHud();
  const { doc, bodies } = await f.applyExtrude({ distance: 2, previous: reordered, label: '05-use-current-profile' });
  assert.equal(doc.nodes.at(-1).kind, 'extrude');
  const chosen = doc.nodes[doc.nodes.at(-1).sketch];
  assert.equal(chosen.id, baseline ? 'n1' : 'n0');
  const solid = bodies.bodies.find(body => body.key === 'b3');
  const expectedVolume = baseline ? 50 * Math.PI : 1200;
  const expectedCenter = baseline ? [50, 10, 1] : [15, 10, 1];
  assert.ok(solid && Math.abs(solid.volume - expectedVolume) <= 1e-5, JSON.stringify(solid));
  assert.ok(Math.hypot(...solid.centroid.map((value, axis) => value - expectedCenter[axis])) <= 1e-6, JSON.stringify(solid));
  f.report.observations.push({ label: 'extrusion-result', profile: chosen.id, volume: solid.volume, centroid: solid.centroid });
  assert.deepEqual(f.report.downloads, []);
});
