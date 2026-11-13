import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/extrude-multiple-sketch-refusal-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'packages/barocss-cad-model/src/app/profileCommands.ts',
];
const f = await createFlow({
  name: 'extrude-multiple-sketch-refusal', output: process.argv[2], envFrozen: 'D1130_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Refuse two finished sketches explicitly and recover to the remaining sketch.',
  limits: ['Two ordinary XY sketches selected through the desktop canvas.'],
});
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] },
    { id: 'n1', kind: 'sketch', profile: 'rectangle', min: [18, 0], max: [30, 10] },
  ],
  outputs: {}, nextId: 2,
};
const button = name => f.page.getByRole('button', { name, exact: true });
const picks = () => f.page.evaluate(() => window.__studioSelection.selection.sketches ?? []);
const history = () => Promise.all(['Undo', 'Redo'].map(name => button(name).isEnabled()));
const shiftClick = async point => {
  await f.page.keyboard.down('Shift');
  try { await f.worldClick(point); } finally { await f.page.keyboard.up('Shift'); }
};

await f.run(async () => {
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'D1130-two-sketches.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);
  await button('Top').click();
  if (await button('Ortho').getAttribute('aria-pressed') !== 'true') await button('Ortho').click();
  const a = [5, 5], b = [24, 5];
  await f.frame([a, b]);
  await f.worldClick(a);
  await shiftClick(b);
  assert.deepEqual(await picks(), [0, 1]);
  const before = await f.snapshot('01-two-sketches-selected');
  const historyBefore = await history();

  f.phase = 'refuse multiple sketches with a specific reason';
  await f.page.keyboard.press('e');
  await f.waitToast(/Extrude can.t run here/i);
  const refused = await f.snapshot('02-extrude-refused');
  assert.ok(refused.notices.some(text => /select one finished sketch to extrude/i.test(text)), JSON.stringify(refused.notices));
  assert.equal(await f.hud().count(), 0);
  assert.deepEqual(refused.selection, before.selection);
  assert.deepEqual(await history(), historyBefore);
  await f.same(source);
  await f.dismissToasts();

  f.phase = 'deselect one sketch and extrude the remaining profile';
  await shiftClick(a);
  assert.deepEqual(await picks(), [1]);
  await f.openExtrudeHud();
  await f.hud().getByText('Sketch 2', { exact: true }).waitFor();
  await f.same(source);
  await f.snapshot('03-second-sketch-preview');
  const { doc, bodies } = await f.applyExtrude({ distance: 2, previous: source, label: '04-extrude-second-sketch' });
  assert.equal(doc.nodes[2].sketch, 1);
  assert.equal(bodies.bodies.length, 1);
  assert.ok(Math.abs(bodies.bodies[0].volume - 240) < 1e-9);
  await f.undo();
  await f.same(source);
  await f.redo();
  await f.same(doc);
  f.report.observations.push({ label: 'extrusion', sourceId: doc.nodes[doc.nodes[2].sketch].id, volumeMM3: bodies.bodies[0].volume });
  assert.deepEqual(f.report.downloads, []);
});
