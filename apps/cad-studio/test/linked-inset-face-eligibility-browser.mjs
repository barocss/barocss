import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const baseline = process.argv.includes('--baseline');
const pins = ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/SketchPanel.tsx',
  'packages/barocss-cad-model/src/engine/mesh.ts', 'packages/barocss-cad-model/src/engine/part.ts'];
const f = await createFlow({
  name: 'linked-inset-face-eligibility', output: process.argv[2], envFrozen: 'D1205_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins, qualification: 'Linked Inset offers an actionable choice on rounded and straight planar faces.',
  limits: ['Desktop WebGPU, R2 rounded rectangle and straight rectangular stock.'],
  inspectorSource: `
import assert from 'node:assert/strict';
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { profileOf } from '@barocss/cad-model/sketch/loops';
const points = [[2, 0], [18, 0], [20, 2], [20, 8], [18, 10], [2, 10], [0, 8], [0, 2]];
const b = Math.tan(Math.PI / 8);
const rounded = profileOf([{ kind: 'polygon', closed: true, points, ids: points.map((_, i) => 'e' + (i + 1)), bulges: [0, b, 0, b, 0, b, 0, b] }]);
assert.ok('node' in rounded);
const first = withNode(withNode(emptyDoc(), rounded.node), { kind: 'extrude', sketch: 0, height: 10 });
const stock = withNode(first, { kind: 'sketch', profile: 'rectangle', min: [40, 0], max: [60, 10] });
console.log(JSON.stringify(withNode(stock, { kind: 'extrude', sketch: 2, height: 10 })));
`,
});

const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const linked = () => button(f.sketchPanel(), 'Link face outline + inset');
async function startSketchOnTop(x) {
  await button(f.page.getByRole('group', { name: 'Views', exact: true }), 'Top').click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  const pixel = await f.page.evaluate(x => window.__studioScreenOf([x, 5, 10]), x);
  assert.ok(pixel?.length === 2);
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel));
  await f.page.mouse.click(...pixel);
  await f.page.waitForFunction(() => window.__studioSelection.selection.faces.length === 1);
  await button(f.page.locator('.mode'), 'Sketch').click();
  await f.sketchPanel().waitFor();
}

await f.run(async () => {
  const seed = await f.inspect('seed', {});
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: 'inset-faces.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed)) });
  await f.same(seed);
  if (await button(f.page, 'Ortho').getAttribute('aria-pressed') !== 'true') await button(f.page, 'Ortho').click();

  f.phase = 'rounded top face sketch';
  await startSketchOnTop(10);
  const outline = button(f.sketchPanel(), 'Use the face outline');
  await outline.waitFor();
  assert.deepEqual(await f.doc(), seed);
  if (baseline) {
    await linked().click();
    await f.page.locator('.toast').getByText(/only native straight boundary edges/).waitFor();
    await f.snapshot('unsupported-link-offered');
    throw new Error('Rounded top shows a Linked Inset action that the native evaluator refuses.');
  }
  assert.equal(await linked().count(), 0);
  await f.sketchPanel().getByText('This outline has curved edges. Use the face outline to copy it.', { exact: true }).waitFor();
  await f.snapshot('rounded-recovery-guidance');
  await outline.click();
  const copied = (await f.finishSketch('independent-rounded-outline')).doc;
  assert.equal(copied.nodes.length, 5);
  assert.equal(copied.nodes[4].kind, 'sketch');
  assert.equal(copied.nodes[4].association, undefined);
  assert.deepEqual(copied.nodes[4].on, { node: 1, side: 'solid' });
  await f.undo();
  await f.same(seed);

  f.phase = 'straight top face sketch';
  await startSketchOnTop(50);
  await f.sketchPanel().getByLabel('Offset distance', { exact: true }).fill('2');
  await linked().click();
  await f.sketchPanel().getByText(/Linked face outline and inset/).waitFor();
  const saved = (await f.finishSketch('straight-linked-outline')).doc;
  assert.deepEqual(saved.nodes[4].association, {
    kind: 'planar-face-outline-inset', version: 1, source: { node: 3, side: 'solid' }, sourceFeature: 'n3', face: 'n3.top', insetMM: 2,
  });
  await f.openExtrudeHud();
  const accepted = (await f.applyExtrude({ distance: 4, previous: saved, label: 'straight-linked-ring' })).doc;
  const key = Object.keys(accepted.outputs).find(key => accepted.outputs[key].node === 5);
  const volume = (await f.bodies()).bodies.find(body => body.key === key)?.volume;
  assert.ok(Math.abs(volume - (20 * 10 - 16 * 6) * 4) < 1e-7);
  f.report.observations.push({ label: 'straight-linked-ring', volume, association: saved.nodes[4].association });
});
