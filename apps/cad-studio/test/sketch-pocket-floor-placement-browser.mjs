import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const baseline = process.argv.includes('--baseline');
const pins = [
  'apps/cad-studio/test/sketch-pocket-floor-placement-browser.mjs', 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/sketch/useSketchActions.ts', 'packages/barocss-cad-model/src/engine/part.ts',
  ...baseline ? [] : ['packages/barocss-cad-model/src/engine/pocketFloor.ts',
    'packages/barocss-cad-model/src/app/profileCommands.ts', 'packages/barocss-cad-model/src/app/editCommand.ts'],
];
const f = await createFlow({
  name: 'sketch-pocket-floor-placement', output: process.argv[2], envFrozen: 'D1157_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Keep a sketch and its child Cut on the same native pocket floor after a source placement edit.',
  limits: ['Desktop Chrome, one zero-draft rectangular pocket floor with a strictly interior rectangular child Cut.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, faceGeometry, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const read = doc => {
  const [body] = evaluateCadPart(toPartDocument(doc)).outputs;
  return { valid: checkOutput(body).valid, volume: massPropertiesOf(body).volume,
    planes: body.brep.faces.map(face => ({ label: face.name, plane: faceGeometry(face) }))
      .filter(({ plane }) => plane.kind === 'plane' && plane.n[2] > 0.999999)
      .map(({ label, plane }) => ({ label, z: plane.o[2] })) };
};
console.log(JSON.stringify({ source: read({ ...doc, nodes: doc.nodes.slice(0, 5), outputs: { b4: { node: 4, side: 'solid' } } }),
  result: read(doc) }));
`,
});
const ref = node => ({ node, side: 'solid' });
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 5,
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 10 },
    { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [10, 9], max: [22, 21], on: ref(1),
      plane: { origin: [0, 0, 10], normal: [0, 0, 1], xAxis: [1, 0, 0] } },
    { id: 'n3', kind: 'extrude', sketch: 2, height: 4, from: -2 },
    { id: 'n4', kind: 'difference', parent: ref(1), tool: ref(3) },
  ],
  outputs: { b4: ref(4) },
};
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const near = (a, b) => Math.abs(a - b) < 1e-7;
const hasFloor = (shape, z) => shape.planes.some(plane => near(plane.z, z));
const clickWorld = async point => {
  const pixel = await f.screenOf(point);
  assert.ok(pixel?.length === 2);
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.vp-canvas'), pixel));
  await f.page.mouse.click(...pixel);
};

await f.run(async () => {
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'D1157-pocket.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);
  await button('Top', f.page.locator('.views')).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  f.phase = 'pick the native pocket floor and draw a rectangle on it';
  await clickWorld([16, 15, 8]);
  await f.page.waitForFunction(() => window.__studioSelection.selection.faces.length === 1);
  await button('Sketch', f.page.locator('.mode')).click();
  await f.sketchPanel().waitFor();
  assert.match(await f.sketchPanel().locator('.card-title').first().innerText(), /Z 8 · on face/);
  await clickWorld([14, 13, 8]);
  await clickWorld([18, 17, 8]);
  await f.sketchPanel().locator('#sk-width').waitFor();
  const authored = await f.finishSketch('child-sketch');
  assert.deepEqual(authored.doc.nodes[5].on, ref(4));
  assert.deepEqual(authored.doc.nodes[5].plane.origin, [0, 0, 8]);
  if (!baseline) assert.deepEqual(authored.doc.nodes[5].pocketFloor,
    { version: 1, sourceFeature: 'n4', face: 'n3.bottom', min: [10, 9], max: [22, 21] });
  f.phase = 'commit child Distance Cut 1 mm';
  await f.openExtrudeHud();
  const hud = f.hud();
  await hud.getByLabel('Operation', { exact: true }).selectOption('cut');
  await hud.getByLabel('Distance', { exact: true }).fill('1');
  await hud.locator('.status').filter({ hasText: /^preview$/ }).waitFor();
  await button('Apply', hud).click();
  await f.changed(authored.doc);
  const before = await f.snapshot('child-cut-z7');
  const old = await f.inspect('child-cut-native-before', before.doc);
  f.report.observations.push({ label: 'before', ...old });
  assert.ok(old.result.valid && hasFloor(old.result, 7) && near(old.result.volume, 11696), JSON.stringify(old));
  assert.ok(old.source.planes.some(p => p.label === 'n3.bottom' && near(p.z, 8)), JSON.stringify(old.source));
  await f.openFeatureEditor(3, 'primary Cut placement');
  const field = f.editor().getByLabel('Start Z', { exact: true });
  assert.equal(await field.inputValue(), '-2');
  assert.equal(await f.editor().getByLabel('Distance', { exact: true }).inputValue(), '4');
  await field.fill('-4');
  const after = await f.applyEditor(before.doc, 'move-primary-pocket-floor');
  const moved = await f.inspect('child-cut-native-after', after.doc);
  f.report.observations.push({ label: 'after', ...moved });
  assert.ok(moved.result.valid && moved.source.planes.some(p => p.label === 'n3.bottom' && near(p.z, 6)), JSON.stringify(moved));
  assert.equal(after.doc.nodes[3].height, 4);
  assert.equal(after.doc.nodes[3].from, -4);
  assert.deepEqual(after.doc.nodes[7].parent, ref(4));
  if (baseline) {
    assert.ok(!hasFloor(moved.result, 5) && near(moved.result.volume, 11424), JSON.stringify(moved));
    assert.fail('The attached sketch stays at Z=8 and its child Cut removes no material after the floor moves to Z=6');
  }
  assert.ok(hasFloor(moved.result, 5) && near(moved.result.volume, 11408), JSON.stringify(moved));
  assert.deepEqual(after.doc.nodes.slice(4), before.doc.nodes.slice(4));
  await f.openFeatureEditor(3, 'reject a lateral change with the bound floor');
  await f.editor().getByLabel('Width', { exact: true }).fill('13');
  await button('Apply', f.editor()).click();
  const failure = f.editor().locator('.hud-error');
  await failure.waitFor();
  const details = failure.locator('details');
  if (await details.count() && await details.getAttribute('open') === null) await details.locator('summary').click();
  await failure.getByText(/source floor moved or resized in XY/).waitFor();
  await f.same(after.doc);
  await f.snapshot('changed-floor-width-refused');
  await f.closeEditor();
  await f.undo();
  await f.same(before.doc);
  await f.redo();
  await f.same(after.doc);
  const saved = await f.save('moved-pocket');
  await f.freshOpen(saved.file, after.doc, 'moved-pocket-reopened');
  const reopened = await f.inspect('child-cut-native-reopened', await f.doc());
  assert.deepEqual(reopened, moved);
  await f.openFeatureEditor(6, 'child Cut after reopening');
  await button('Edit sketch', f.editor()).click();
  await f.sketchPanel().waitFor();
  assert.match(await f.sketchPanel().locator('.card-title').first().innerText(), /Z 6 · on face/);
  await f.snapshot('moved-sketch-edit');
});
