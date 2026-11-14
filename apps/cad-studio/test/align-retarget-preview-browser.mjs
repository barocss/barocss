import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const pins = ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/viewport/useViewportPicking.ts',
  'packages/barocss-cad-model/src/app/alignCommand.ts'];
const f = await createFlow({
  name: 'align-retarget-preview', output: process.argv[2], envFrozen: 'D1199_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Align uses the original face the pointer hits after results reorder in preview.',
  limits: ['Desktop WebGPU, top faces of three root native boxes, fixed Gap 2 mm.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkBrep, massPropertiesOf } from '@barocss/cad';
import { partSnapshot, bodyKeyOf } from '@barocss/cad-model/engine/part';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify(partSnapshot(doc).outputs.map(output => ({
  key: bodyKeyOf(output.id, doc.nodes), valid: checkBrep(output.brep, { strict: true }).valid,
  volume: massPropertiesOf(output).volume, centroid: massPropertiesOf(output).centroid,
  vertices: output.brep.vertices.map(vertex => vertex.point),
}))));
`,
});
const baseline = process.argv.includes('--baseline');
const ref = node => ({ node, side: 'solid' });
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [12, 10], id: 'n0' },
    { kind: 'extrude', sketch: 0, from: 20, height: 6, id: 'n1' },
    { kind: 'sketch', profile: 'rectangle', min: [40, 0], max: [60, 16], id: 'n2' },
    { kind: 'extrude', sketch: 2, height: 8, id: 'n3' },
    { kind: 'sketch', profile: 'rectangle', min: [80, 0], max: [110, 20], id: 'n4' },
    { kind: 'extrude', sketch: 4, height: 12, id: 'n5' },
  ],
  outputs: { b1: ref(1), b3: ref(3), b5: ref(5) }, nextId: 6,
};
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const hud = () => f.page.getByRole('dialog', { name: 'Align', exact: true });
async function clickAt(point) {
  const pixel = await f.page.evaluate(point => window.__studioScreenOf(point), point);
  assert.ok(pixel?.length === 2);
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel), JSON.stringify(pixel));
  await f.page.mouse.click(...pixel);
}
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} vs ${expected}`);
async function verify(label, doc, target) {
  const offset = target === 'n5.top' ? [89, 5, -6] : [44, 3, -10];
  assert.deepEqual(doc.nodes.at(-1), { kind: 'translate', parent: ref(6), offset, id: 'n7' });
  assert.deepEqual(doc.nodes.slice(0, seed.nodes.length), seed.nodes);
  const result = await f.inspect(label, doc);
  assert.deepEqual(result.map(body => body.key).sort(), ['b3', 'b5', 'b7']);
  const boxes = {
    b3: { volume: 2560, min: [40, 0, 0], max: [60, 16, 8] },
    b5: { volume: 7200, min: [80, 0, 0], max: [110, 20, 12] },
    b7: target === 'n5.top' ? { volume: 720, min: [89, 5, 14], max: [101, 15, 20] }
      : { volume: 720, min: [44, 3, 10], max: [56, 13, 16] },
  };
  for (const { key, valid, volume, centroid, vertices } of result) {
    assert.equal(valid, true);
    const expected = boxes[key];
    near(volume, expected.volume);
    for (let axis = 0; axis < 3; axis++) {
      near(Math.min(...vertices.map(v => v[axis])), expected.min[axis]);
      near(Math.max(...vertices.map(v => v[axis])), expected.max[axis]);
      near(centroid[axis], (expected.min[axis] + expected.max[axis]) / 2);
    }
  }
  f.report.observations.push({ label, target, offset, bodies: result.map(({ key, volume, centroid }) => ({ key, volume, centroid })) });
}
await f.run(async () => {
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'align-targets.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed)) });
  await f.same(seed);
  if (await button('Ortho').getAttribute('aria-pressed') !== 'true') await button('Ortho').click();
  await button('Top', f.page.getByRole('group', { name: 'Views', exact: true })).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await clickAt([6, 5, 26]);
  await f.page.waitForFunction(() => window.__studioSelection.selection.faces[0]?.body === 0);
  await clickModelCommand(f.page, 'Modify', 'Align');
  await hud().getByLabel('Gap', { exact: true }).fill('2');
  await clickAt([50, 8, 8]);
  await hud().locator('.status.ok').waitFor();
  assert.match((await f.snapshot('b-preview')).hud, /Onto.*n3[.]top/);
  await f.page.waitForFunction(() => window.__studioSection().shownKeys.join() === 'b3,b5,b7');
  await f.same(seed);
  if (!baseline) {
    await clickAt([50, 8, 16]);
    await f.waitToast(/Align target not selected/);
    assert.match((await f.snapshot('generated-preview-face-refused')).hud, /Onto.*n3[.]top/);
    await f.same(seed);
  }

  await clickAt([95, 10, 12]);
  if (baseline) await f.page.waitForTimeout(350);
  else await hud().getByText('face n5.top', { exact: true }).waitFor();
  await hud().locator('.status.ok').waitFor();
  const target = (await f.snapshot('c-click-during-b-preview')).hud.match(/Onto(face n[35][.]top)/)?.[1].slice(5);
  assert.equal(target, baseline ? 'n3.top' : 'n5.top');
  await button('Apply', hud()).click();
  await f.changed(seed);
  const applied = (await f.snapshot('align-applied')).doc;
  await verify('accepted-native', applied, target);
  if (baseline) throw new Error('Clicking C during Align B preview still applied B.');
  await f.undo();
  await f.same(seed);
  await f.redo();
  await f.same(applied);
});
