import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/extrude-end-face-refusals-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/state/useFeatureHistory.ts',
  'packages/barocss-cad-model/src/app/extrudeEndFacePick.ts',
  'packages/barocss-cad-model/src/engine/faceEndExtrude.ts',
  'packages/barocss-cad-model/src/chat/features.ts',
];
const f = await createFlow({
  name: 'extrude-end-face-refusals', output: process.argv[2], envFrozen: 'D850_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Qualify native cap holes, nonparallel faces, curved faces and explicit dependent deletion in desktop Studio.',
  limits: ['One literal XY source, one plain target, one holed target with a circular inner trim, and one separate native cylinder.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, faceGeometry, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const result = evaluateCadPart(toPartDocument(doc));
console.log(JSON.stringify(result.outputs.map(output => ({
  id: output.id, valid: checkOutput(output).valid, count: output.bodyCount,
  mass: massPropertiesOf(output), corners: output.brep.vertices.map(vertex => vertex.point),
  faces: output.brep.faces.map(face => ({
    name: face.name, geometry: faceGeometry(face),
    trims: face.loops.map(id => output.brep.loops.find(loop => loop.id === id)?.kind),
  })),
}))));
`,
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    historyControls: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`).disabled),
  }),
});
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [-5, -5], max: [15, 15] },
    { id: 'n1', kind: 'extrude', sketch: 0, from: 20, height: 5 },
    { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [-10, -10], max: [20, 20],
      holes: [[{ kind: 'arc', start: [12, 5], center: [9, 5], direction: 'ccw' }]] },
    { id: 'n3', kind: 'extrude', sketch: 2, from: 30, height: 5 },
    { id: 'n4', kind: 'sketch', profile: 'circle', center: [40, 5], radius: 5 },
    { id: 'n5', kind: 'extrude', sketch: 4, from: 20, height: 5 },
    { id: 'n6', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] },
  ],
  outputs: { b1: { node: 1, side: 'solid' }, b3: { node: 3, side: 'solid' }, b5: { node: 5, side: 'solid' } }, nextId: 7,
};
const button = (panel, name) => panel.getByRole('button', { name, exact: true });
const hud = () => f.hud();
const apply = () => button(hud(), 'Apply');
const status = value => hud().locator('.status').filter({ hasText: new RegExp('^' + value + '$') }).waitFor();
const near = (a, b) => Math.abs(a - b) < 1e-7;

async function open(doc) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: 'D850-end-face-refusals.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
}

async function view(name) {
  await button(f.page, 'View cube directions').click();
  await f.page.getByRole('menuitem', { name, exact: true }).click();
  await f.page.waitForFunction(name => {
    const labels = [...document.querySelectorAll('.view-cube .vc-label')];
    return labels.length === 1 && labels[0].textContent === name;
  }, name.toUpperCase());
}

async function pick(point) {
  const pixel = await f.page.evaluate(point => {
    const xy = window.__studioScreenOf(point);
    return xy && document.elementFromPoint(...xy)?.closest('.vp-canvas') ? xy : null;
  }, point);
  assert.ok(pixel);
  await f.page.mouse.click(...pixel);
}

function assertExact(after, before) {
  for (const key of ['doc', 'bodies', 'history', 'historyControls', 'dirty']) assert.deepEqual(after[key], before[key], key);
  assert.deepEqual(after.selection.selection, before.selection.selection);
}

async function verifyTargetGeometry() {
  const outputs = await f.inspect('native-targets', seed);
  assert.deepEqual(outputs.map(output => output.id), ['n1', 'n3', 'n5']);
  assert.ok(outputs.every(output => output.valid && output.count === 1));
  const [plain, holed, cylinder] = outputs, holeArea = 9 * Math.PI;
  const cap = holed.faces.find(face => face.name === 'n3.bottom');
  assert.ok(cap?.geometry.kind === 'plane');
  assert.ok(near(cap.geometry.o[2], 30) && near(cap.geometry.n[2], -1));
  assert.deepEqual([...cap.trims].sort(), ['inner', 'outer']);
  assert.ok(near(holed.mass.volume, 4500 - 5 * holeArea));
  assert.ok(near(holed.mass.centroid[0], 5 - 4 * holeArea / (900 - holeArea)));
  const bore = holed.faces.filter(face => face.geometry.kind === 'cylinder');
  assert.ok(bore.length > 0 && bore.every(face => near(face.geometry.r, 3)
    && near(face.geometry.c[0], 9) && near(face.geometry.c[1], 5)));
  assert.ok([0, 10].every(x => [0, 10].every(y => Math.hypot(x - 9, y - 5) > 3)));
  assert.ok(near(plain.mass.volume, 2000));
  assert.ok(cylinder.faces.some(face => face.geometry.kind === 'cylinder' && near(face.geometry.r, 5)));
  assert.ok(near(cylinder.mass.volume, 125 * Math.PI));
  f.report.observations.push({ label: 'native-targets', holedCap: cap.name, loops: cap.trims, boreRadius: 3, cylinderRadius: 5,
    holedVolume: holed.mass.volume, intersectionAtSourceEdge: [5 - Math.sqrt(8), 5 + Math.sqrt(8)] });
}

await f.run(async () => {
  await f.newPage();
  await open(seed);
  await verifyTargetGeometry();
  const ortho = button(f.page, 'Ortho');
  if (await ortho.getAttribute('aria-pressed') !== 'true') await ortho.click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await button(f.page.getByRole('group', { name: 'History', exact: true }), 'Sketch · rectangle').click();
  await f.editor().waitFor();
  await f.closeEditor();
  await f.openExtrudeHud();
  await hud().getByLabel('Depth', { exact: true }).selectOption('to-face');
  await status('pick face');
  const before = await f.snapshot('01-accepted-before-refusals');
  const error = hud().locator('.hud-error');
  const readRefusal = async reason => {
    await error.getByText(reason).waitFor({ state: 'attached' });
    const details = error.locator('details');
    if (await details.count() && await details.getAttribute('open') === null) await details.locator('summary').click();
    assert.match(await error.innerText(), reason);
  };

  f.phase = 'refuse a native target with an inner circular trim';
  await view('Bottom');
  await pick([-8, -8, 30]);
  await status('refused');
  await hud().getByText('n3.bottom', { exact: true }).waitFor();
  await readRefusal(/one straight rectangular trim without holes/i);
  assert.equal(await apply().isDisabled(), true);
  assertExact(await f.snapshot('02-holed-cap-refused'), before);

  f.phase = 'refuse a native plane that is not parallel to the sketch';
  await view('Front');
  await pick([5, -5, 22.5]);
  await status('refused');
  await readRefusal(/native plane parallel to the sketch/i);
  assert.equal(await apply().isDisabled(), true);
  assertExact(await f.snapshot('03-nonparallel-face-refused'), before);

  f.phase = 'refuse the original curved cylinder side';
  await pick([40, 0, 22.5]);
  const curvedNotice = await f.waitToast(/End face not selected.*Pick one original planar face/);
  assert.equal(await apply().isDisabled(), true);
  assertExact(await f.snapshot('04-curved-face-refused'), before);
  f.report.observations.push({ label: 'invalid-picks', refused: ['HOLED_TRIM', 'NONPARALLEL', 'CURVED'], notice: curvedNotice, acceptedExact: true });

  f.phase = 'apply a valid earlier target after the refusals';
  await view('Bottom');
  await pick([13, 13, 20]);
  await status('preview');
  await hud().getByText('n1.bottom', { exact: true }).waitFor();
  await apply().click();
  await f.changed(seed);
  await hud().waitFor({ state: 'hidden' });
  const bound = await f.doc();
  const reference = { id: 'n7', kind: 'face-end-extrude', sketch: 6,
    target: { body: { node: 1, side: 'solid' }, feature: 'n1', face: 'n1.bottom' } };
  assert.deepEqual(bound.nodes, [...seed.nodes, reference]);
  const result = await f.inspect('native-bound-control', bound);
  assert.deepEqual(result.map(output => output.id), ['n1', 'n3', 'n5', 'n7']);
  assert.ok(result[3].valid && result[3].corners.length === 8 && near(result[3].mass.volume, 2000));

  f.phase = 'review dependent target deletion, Cancel and explicitly delete both features';
  const confirm = f.page.getByRole('dialog', { name: 'Delete with dependents', exact: true });
  await f.openFeatureEditor(1, 'target deletion');
  const beforeDelete = await f.snapshot('05-before-target-delete');
  await button(f.editor(), 'Delete feature').click();
  await confirm.waitFor();
  assert.match(await confirm.innerText(), /Extrude to face/);
  assertExact(await f.snapshot('06-delete-review'), beforeDelete);
  await button(confirm, 'Cancel').click();
  await confirm.waitFor({ state: 'hidden' });
  assertExact(await f.snapshot('07-delete-cancelled'), beforeDelete);
  await button(f.editor(), 'Delete feature').click();
  await button(confirm, 'Delete 2').click();
  await f.changed(bound);
  const deleted = await f.doc();
  assert.deepEqual(deleted.nodes.map(node => node.id), ['n2', 'n3', 'n4', 'n5']);
  assert.deepEqual(deleted.outputs, { b3: { node: 1, side: 'solid' }, b5: { node: 3, side: 'solid' } });
  await f.undo();
  assert.deepEqual(await f.doc(), bound);
  await f.redo();
  assert.deepEqual(await f.doc(), deleted);
  f.report.observations.push({ label: 'delete-with-dependents', before: ['b1', 'b3', 'b5', 'b7'],
    after: ['b3', 'b5'], cancelledExact: true, firstUndoRestoresRelation: true, firstRedoExact: true });
  await f.snapshot('08-cascade-redone');
  assert.deepEqual(f.report.downloads, []);
});
