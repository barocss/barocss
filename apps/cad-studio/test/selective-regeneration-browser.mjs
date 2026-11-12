import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const pins = [
  'apps/cad-studio/test/selective-regeneration-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/ui/RebuildPanel.tsx',
  'apps/cad-studio/src/ui/ParametersPanel.tsx',
  'apps/cad-studio/src/engine/engine.worker.ts',
  'packages/barocss-cad-model/src/engine/evaluate.ts',
  'packages/barocss-cad/src/part/part-model.ts',
];
const f = await createFlow({
  name: 'selective-regeneration', output: process.argv[2], envFrozen: 'D811_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'An accepted plate height edit rebuilds its through Hole and reuses the independent cylinder.',
  limits: ['One named ordinary extrusion height, one dependent Hole and one independent cylindrical extrusion.'],
});
const ref = node => ({ node, side: 'solid' });
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: { plateHeight: 8 },
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 20] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: { parameter: 'plateHeight' } },
    { id: 'n2', kind: 'sketch', profile: 'circle', center: [50, 10], radius: 5 },
    { id: 'n3', kind: 'extrude', sketch: 2, height: 6 },
    { id: 'n4', kind: 'hole', parent: ref(1), center: [15, 10], radius: 2, face: 'n1.top' },
  ],
  outputs: { b3: ref(3), b4: ref(4) }, nextId: 5,
};
const expectedStates = {
  open: { n0: 'input', n1: 'built', n2: 'input', n3: 'built', n4: 'built' },
  edited: { n0: 'input', n1: 'built', n2: 'input', n3: 'reused', n4: 'built' },
};
const rebuild = () => f.page.getByRole('complementary', { name: 'Rebuild panel', exact: true });
async function openRebuild() {
  if (!(await rebuild().isVisible())) await clickModelCommand(f.page, 'Inspect', 'Rebuild');
  await rebuild().waitFor();
}
async function report() {
  const totals = await rebuild().getByLabel('Rebuild totals', { exact: true }).innerText();
  const rows = await rebuild().locator('tr[data-rebuild-state]').evaluateAll(entries =>
    Object.fromEntries(entries.map(row => [row.getAttribute('aria-label').slice('Rebuild '.length), row.dataset.rebuildState])));
  return { totals, rows };
}
async function checkBodies(label, depth) {
  const { fresh, massReady, bodies } = await f.bodies();
  assert.equal(fresh, true);
  assert.equal(massReady, true);
  assert.equal(bodies.length, 2);
  const facts = [
    { key: 'b3', volume: Math.PI * 25 * 6, centroid: [50, 10, 3] },
    { key: 'b4', volume: (600 - 4 * Math.PI) * depth, centroid: [15, 10, depth / 2] },
  ];
  for (const { key, volume, centroid } of facts) {
    const body = bodies.find(entry => entry.key === key);
    assert.ok(body && Math.abs(body.volume - volume) <= 1e-5, JSON.stringify(body));
    assert.ok(Math.hypot(...body.centroid.map((value, axis) => value - centroid[axis])) <= 1e-6, JSON.stringify(body));
  }
  f.report.observations.push({ label, depth, bodies });
}

await f.run(async () => {
  f.phase = 'open and read the initial real Worker rebuild';
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), f.page.getByRole('button', { name: 'Open', exact: true }).click()]);
  await chooser.setFiles({ name: 'D811-regenerate.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);
  await openRebuild();
  const initial = await report();
  f.report.observations.push({ label: 'initial-report', ...initial });
  assert.deepEqual(initial.rows, expectedStates.open);
  assert.match(initial.totals, /· 3 built .* · 0 reused ·/);
  await checkBodies('initial-bodies', 8);
  await f.snapshot('01-cold-report');

  await f.setParameter('plateHeight', 10, '02-height10');
  const edited = await f.doc();
  assert.equal(edited.nodes[4].face, 'n1.top');
  assert.deepEqual(edited.nodes[4].parent, ref(1));
  await openRebuild();
  const accepted = await report();
  f.report.observations.push({ label: 'accepted-report', ...accepted });
  assert.deepEqual(accepted.rows, expectedStates.edited);
  assert.match(accepted.totals, /· 2 built .* · 1 reused ·/);
  assert.notEqual(accepted.totals, initial.totals);
  await checkBodies('edited-bodies', 10);
  await f.snapshot('03-selective-report');

  f.phase = 'refuse zero height and keep the accepted report';
  const panel = await f.openParameters();
  const height = panel.getByLabel('Value of plateHeight', { exact: true });
  await height.fill('0');
  await height.press('Enter');
  const refusal = await f.waitToast(/Parameters not changed/);
  await f.same(edited);
  assert.equal(await height.inputValue(), '10');
  await f.closeParameters(panel);
  await openRebuild();
  assert.deepEqual(await report(), accepted);
  await checkBodies('after-refusal-bodies', 10);
  f.report.observations.push({ label: 'refused-report', refusal, ...accepted });
  await f.snapshot('04-refused-report');
  await f.dismissToasts();

  f.phase = 'first Undo and Redo after refused regeneration';
  await f.undo();
  await f.same(source);
  await checkBodies('undo-bodies', 8);
  await f.redo();
  await f.same(edited);
  await checkBodies('redo-bodies', 10);
  assert.deepEqual(f.report.downloads, []);
});
