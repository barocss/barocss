import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = ['apps/cad-studio/test/extrude-end-face-direction-browser.mjs',
  'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/Hud.tsx',
  'packages/barocss-cad-model/src/app/extrudeEndFacePick.ts',
  'packages/barocss-cad-model/src/engine/faceEndExtrude.ts', 'packages/barocss-cad-model/src/engine/errors.ts'];
const f = await createFlow({
  name: 'extrude-end-face-direction', output: process.argv[2], envFrozen: 'D1161_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'A parallel face with the right normal behind the sketch stays unchecked and refuses Apply.',
  limits: ['Desktop Chrome and two parallel rectangle caps and an XY sketch at three different levels.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, faceGeometry, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const result = evaluateCadPart(toPartDocument(doc));
console.log(JSON.stringify(result.outputs.map(body => ({
  id: body.id, valid: checkOutput(body).valid, volume: massPropertiesOf(body).volume,
  caps: body.brep.faces.flatMap(face => { const g = faceGeometry(face);
    return g.kind === 'plane' && Math.abs(g.n[2]) > .999999 ? [{ name: face.name, z: g.o[2], normalZ: g.n[2] }] : []; }),
}))));
`,
});
const ref = node => ({ node, side: 'solid' });
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 5,
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [-4, -4], max: [23, 16] },
    { id: 'n1', kind: 'extrude', sketch: 0, from: -20, height: 5 },
    { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [-6, -6], max: [16, 14] },
    { id: 'n3', kind: 'extrude', sketch: 2, from: 20, height: 5 },
    { id: 'n4', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] },
  ], outputs: { b1: ref(1), b3: ref(3) },
};
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const near = (a, b) => Math.abs(a - b) < 1e-7;
const checked = async () => (await f.hud().locator('.hud-step').filter({ hasText: 'End face' }).getAttribute('class')).split(/\s+/).includes('done');

await f.run(async () => {
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'D1161-end-face-direction.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed)) });
  await f.same(seed);
  const targets = await f.inspect('direction-native-targets', seed);
  assert.ok(targets.every(body => body.valid));
  assert.deepEqual(targets.map(body => body.caps.find(cap => cap.normalZ < 0)), [
    { name: 'n1.bottom', z: -20, normalZ: -1 }, { name: 'n3.bottom', z: 20, normalZ: -1 },
  ]);
  if (await button('Ortho').getAttribute('aria-pressed') !== 'true') await button('Ortho').click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await f.page.getByRole('group', { name: 'History', exact: true }).getByRole('button', { name: 'Sketch · rectangle', exact: true }).click();
  await f.editor().waitFor();
  await f.closeEditor();
  await f.openExtrudeHud();
  const hud = f.hud(), apply = button('Apply', hud);
  const status = value => hud.locator('.status').filter({ hasText: new RegExp('^' + value + '$') }).waitFor();
  const pick = async point => {
    const pixel = await f.screenOf(point);
    assert.ok(pixel?.length === 2);
    assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.vp-canvas'), pixel));
    await f.page.mouse.click(...pixel);
  };
  await hud.getByLabel('Depth', { exact: true }).selectOption('to-face');
  await status('pick face');
  await button('View cube directions').click();
  await f.page.getByRole('menuitem', { name: 'Bottom', exact: true }).click();
  await f.page.waitForFunction(() => document.querySelector('.view-cube .vc-label')?.textContent === 'BOTTOM');
  const before = await f.snapshot('before-pick');
  const undo = await button('Undo').isEnabled(), redo = await button('Redo').isEnabled();
  f.phase = 'pick the original rectangular cap 20 mm behind the sketch';
  await pick([18, 11, -20]);
  await status('refused');
  await hud.getByText('n1.bottom', { exact: true }).waitFor();
  await hud.getByText('End face is behind the sketch', { exact: true }).waitFor();
  await hud.getByText('Pick a parallel face ahead of the sketch along its extrusion direction.', { exact: true }).waitFor();
  assert.equal(await checked(), false);
  assert.equal(await apply.isDisabled(), true);
  await f.page.keyboard.press('Enter');
  const refused = await f.snapshot('behind-sketch-refused');
  for (const key of ['doc', 'bodies', 'history', 'selection']) assert.deepEqual(refused[key], before[key], key);
  assert.equal(await button('Undo').isEnabled(), undo);
  assert.equal(await button('Redo').isEnabled(), redo);
  f.report.observations.push({ label: 'behind-sketch', target: 'n1.bottom', z: -20, checked: false, apply: false });
  f.phase = 'pick the original rectangular cap 20 mm ahead of the sketch';
  await pick([-5, -5, 20]);
  await status('preview');
  await hud.getByText('n3.bottom', { exact: true }).waitFor();
  assert.equal(await checked(), true);
  await apply.click();
  await f.changed(seed);
  const accepted = await f.snapshot('ahead-of-sketch-applied');
  assert.deepEqual(accepted.doc.nodes.at(-1).target, { body: ref(3), feature: 'n3', face: 'n3.bottom' });
  const result = await f.inspect('direction-native-result', accepted.doc);
  const extrude = result.find(body => body.id === 'n5');
  assert.ok(extrude.valid && near(extrude.volume, 2000), JSON.stringify(result));
  assert.deepEqual(extrude.caps.map(cap => cap.z).sort((a, b) => a - b), [0, 20]);
  f.report.observations.push({ label: 'ahead-of-sketch', target: 'n3.bottom', z: 20, checked: true, volume: extrude.volume });
  await f.undo();
  await f.same(seed);
  await f.redo();
  await f.same(accepted.doc);
});
