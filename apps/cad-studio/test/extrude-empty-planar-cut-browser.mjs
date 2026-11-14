import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const baseline = process.argv.includes('--baseline');
const pins = ['apps/cad-studio/test/extrude-empty-planar-cut-browser.mjs',
  'apps/cad-studio/src/state/useCommandPreview.ts', 'packages/barocss-cad-model/src/engine/evaluate.ts',
  'packages/barocss-cad-model/src/app/profileCommands.ts', 'packages/barocss-cad/src/part/part-model.ts'];
const f = await createFlow({
  name: 'extrude-empty-planar-cut', output: process.argv[2], envFrozen: 'D1160_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Refuse a known empty rectangular Cut from a side or a drafted work plane.',
  limits: ['Desktop Chrome, a 40 × 30 × 10 mm rectangular stock, axis-aligned side and drafted rectangular tools.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, faceGeometry, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const axis = Number(process.argv[3]);
const [out] = evaluateCadPart(toPartDocument(doc)).outputs;
const floors = out.brep.faces.map(faceGeometry).filter(g => g.kind === 'plane' && g.n[axis] > 1 - 1e-8).map(g => g.o[axis]);
console.log(JSON.stringify({ count: out.bodyCount, valid: checkOutput(out).valid, volume: massPropertiesOf(out).volume, floors }));
`,
});
const ref = node => ({ node, side: 'solid' });
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2,
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 10 },
  ],
  outputs: { b1: ref(1) },
};
const top = { origin: [0, 0, 10], normal: [0, 0, 1], xAxis: [1, 0, 0] };
const side = { origin: [40, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] };
const k = Math.tan(10 * Math.PI / 180);
const frustum = (area, sum) => 12000 - (2 * area - 4 * k * sum + (32 / 3) * k ** 2);
const cases = [
  { label: 'side-gap', plane: side, min: [34, 3], max: [42, 7], axis: 0, depth: 2 },
  { label: 'side-contact', plane: side, min: [30, 3], max: [38, 7], axis: 0, depth: 2 },
  { label: 'drafted-gap', plane: top, min: [44, 11], max: [56, 19], axis: 2, draft: 10, depth: 2 },
  { label: 'drafted-contact', plane: top, min: [40, 11], max: [52, 19], axis: 2, draft: 10, depth: 2 },
  { label: 'side-positive', plane: side, min: [11, 3], max: [19, 7], axis: 0, expected: 11936, floor: 38, depth: 2 },
  { label: 'side-thin-positive', plane: { ...side, origin: [41.999, 0, 0] }, min: [11, 3], max: [19, 7], axis: 0, expected: 11999.968, floor: 39.999, depth: 2 },
  { label: 'drafted-positive', plane: top, min: [14, 11], max: [26, 19], axis: 2, draft: 10, expected: frustum(96, 20), floor: 8, depth: 2 },
];
const near = (a, b) => Math.abs(a - b) < 1e-7;
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });

await f.run(async () => {
  await f.newPage();
  for (const item of cases) {
    const { label, plane, min, max, axis, depth, draft, expected, floor } = item;
    if (baseline && expected !== undefined) continue;
    f.phase = label;
    const source = { ...seed, nextId: 3,
      nodes: [...seed.nodes, { id: 'n2', kind: 'sketch', profile: 'rectangle', on: ref(1), plane, min, max }] };
    const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles({ name: `D1160-${label}.bcad`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
    await f.same(source);
    await f.page.getByRole('group', { name: 'History', exact: true }).getByRole('button', { name: 'Sketch · rectangle', exact: true }).click();
    await f.editor().waitFor();
    await f.closeEditor();
    await f.openExtrudeHud();
    const hud = f.hud(), apply = button('Apply', hud);
    const status = value => hud.locator('.status').filter({ hasText: new RegExp('^' + value + '$') }).waitFor();
    await hud.getByLabel('Operation', { exact: true }).selectOption('cut');
    await hud.getByLabel('Distance', { exact: true }).fill(String(depth));
    if (draft) await hud.getByLabel('Draft', { exact: true }).fill(String(draft));
    if (!baseline && expected === undefined) {
      await status('refused');
      await hud.getByText(/does not remove any material/i).waitFor();
      assert.equal(await apply.isDisabled(), true);
      const undo = await button('Undo').isEnabled();
      await f.page.keyboard.press('Enter');
      await f.same(source);
      assert.equal(await button('Undo').isEnabled(), undo);
      const before = await f.snapshot(label + '-refused');
      assert.ok(near(before.bodies.bodies[0].volume, 12000));
      f.report.observations.push({ label, acceptedVolume: before.bodies.bodies[0].volume, refused: true });
      await button('Cancel', hud).click();
      continue;
    }
    await status('preview');
    await apply.click();
    await f.changed(source);
    const accepted = await f.snapshot(label + '-accepted');
    const native = await f.inspect(label + '-native', accepted.doc, axis);
    assert.ok(native.valid && native.count === 1 && near(native.volume, expected ?? 12000), JSON.stringify(native));
    if (floor !== undefined) assert.ok(native.floors.some(z => near(z, floor)), JSON.stringify(native));
    assert.deepEqual(accepted.doc.nodes.at(-1).parent, ref(1));
    f.report.observations.push({ label, native, actualRemovedVolume: 12000 - native.volume });
  }
  if (baseline) assert.fail('Studio accepts the four empty side and drafted Cut candidates');
});
