import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx',
  'packages/barocss-cad-model/src/app/commands.ts', 'packages/barocss-cad-model/src/app/editFields.ts',
  'packages/barocss-cad-model/src/engine/part.ts'];
const f = await createFlow({
  name: 'hole-row-history', output: process.argv[2], envFrozen: 'D1181_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Edit the signed spacing of a saved row of through Holes.',
  limits: ['One desktop box, three Ø4 bores along Z with both components of row spacing.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkBrep, faceGeometry, massPropertiesOf } from '@barocss/cad';
import { partSnapshot } from '@barocss/cad-model/engine/part';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8')), [body] = partSnapshot(doc).outputs;
const walls = body.brep.faces.flatMap(face => {
  const geometry = faceGeometry(face);
  return geometry.kind === 'cylinder' ? [geometry] : [];
});
console.log(JSON.stringify({ valid: checkBrep(body.brep, { strict: true }).valid,
  mass: massPropertiesOf(body), walls, solids: body.bodyCount }));
`,
});
const box = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 40] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 12 },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
};
const button = (name, region = f.page) => region.getByRole('button', { name, exact: true });
const field = (name, region) => region.getByLabel(name, { exact: true });
const exact = (actual, expected) => Math.abs(actual - expected) <= 1e-7;
async function verify(label, doc, centres) {
  const native = await f.inspect(label, doc);
  assert.ok(native.valid && native.solids === 1);
  assert.ok(native.walls.every(wall => exact(wall.r, 2) && exact(Math.abs(wall.a[2]), 1)));
  for (const expected of centres) assert.ok(native.walls.some(wall => expected.every((value, i) => exact(wall.c[i], value))));
  for (const wall of native.walls) assert.ok(centres.some(expected => expected.every((value, i) => exact(wall.c[i], value))));
  const bore = 48 * Math.PI, stock = 19200, volume = stock - 3 * bore;
  const centroid = [0, 1].map(axis => (20 * stock - bore * centres.reduce((sum, centre) => sum + centre[axis], 0)) / volume);
  assert.ok(exact(native.mass.volume, volume));
  assert.ok(native.mass.centroid.every((value, axis) => exact(value, [...centroid, 6][axis])));
  f.report.observations.push({ label, centres, volume: native.mass.volume, centroid: native.mass.centroid });
}

await f.run(async () => {
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'D1181-hole-row.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(box)) });
  await f.same(box);
  await button('Top', f.page.getByRole('group', { name: 'Views' })).click();
  await f.page.waitForFunction(() => document.querySelector('.view-cube .vc-label')?.textContent === 'TOP');
  const pixel = await f.page.evaluate(() => window.__studioScreenOf([8, 12, 12]));
  await f.page.mouse.click(...pixel);
  await f.page.waitForFunction(() => window.__studioSelection.selection.faces.length === 1);
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.page.keyboard.press('h');
  const hud = f.page.getByRole('dialog', { name: 'Hole', exact: true });
  const preview = () => hud.locator('.status').filter({ hasText: /^preview$/ }).waitFor();
  await field('Diameter', hud).fill('4');
  await field('Copies', hud).selectOption('row');
  await field('Count', hud).fill('3');
  await field('Step X', hud).fill('8');
  await field('Step Y', hud).fill('1');
  await preview();
  await f.same(box);
  await button('Apply', hud).click();
  await f.changed(box);
  const initial = (await f.snapshot('hole-row-created')).doc, saved = initial.nodes[2];
  assert.deepEqual(saved.pattern, { count: 3, step: [8, 1] });
  assert.deepEqual(saved.center, [8, 12]);
  await verify('hole-row-created', initial, [[8, 12], [16, 13], [24, 14]]);
  await f.openFeatureEditor(2, 'row step');
  assert.equal(await field('Step X', f.editor()).count(), 1, 'No Step X input in Hole row History');
  const stepX = field('Step X', f.editor()), stepY = field('Step Y', f.editor());
  assert.equal(await stepX.inputValue(), '8');
  assert.equal(await stepY.inputValue(), '1');
  await stepX.fill('3');
  await stepY.fill('0');
  await button('Apply', f.editor()).click();
  await f.editor().getByText(/increase the step or reduce the diameter/i).waitFor();
  await f.same(initial);
  await f.snapshot('short-row-step-refused');
  await stepX.fill('11');
  await stepY.fill('-2');
  const changed = (await f.applyEditor(initial, 'hole-row-revised')).doc;
  assert.deepEqual(changed, { ...initial, nodes: [...initial.nodes.slice(0, 2), { ...saved, pattern: { count: 3, step: [11, -2] } }] });
  await verify('hole-row-revised', changed, [[8, 12], [19, 10], [30, 8]]);
  await f.undo();
  await f.same(initial);
  await f.redo();
  await f.same(changed);
  const file = await f.save('hole-row-history');
  const reopened = await f.freshOpen(file.file, changed, 'hole-row-reopened');
  await verify('hole-row-reopened', reopened.doc, [[8, 12], [19, 10], [30, 8]]);
  await f.openFeatureEditor(2, 'reopened row step');
  assert.equal(await field('Step X', f.editor()).inputValue(), '11');
  assert.equal(await field('Step Y', f.editor()).inputValue(), '-2');
});
