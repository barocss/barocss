import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/ViewContextMenu.tsx',
  'apps/cad-studio/src/viewport/useViewportPicking.ts', 'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'packages/barocss-cad-model/src/app/commands.ts'];
const typeKeyboard = process.argv[3] === '--type-keyboard';
const f = await createFlow({
  name: 'hole-pick-position', output: process.argv[2], envFrozen: typeKeyboard ? 'D1180_SOURCE_FROZEN' : 'D1179_SOURCE_FROZEN',
  initialFiles: [...pins, 'apps/cad-studio/src/ui/Hud.tsx'], requiredFrozen: pins,
  qualification: typeKeyboard ? 'Choose Hole Type by keyboard without committing a preview.'
    : 'Verify Hole placement from a second right-click and a fractional picked point with Snap off.',
  limits: ['Chromium desktop, cardinal top faces of native stock and a locally generated STEP box.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkBrep, evaluateCadPart, exportStep, faceGeometry, massPropertiesOf } from '@barocss/cad';
import { partSnapshot } from '@barocss/cad-model/engine/part';
if (process.argv[3] === '"step"') {
  const { outputs: [{ brep }] } = evaluateCadPart({
    format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
      { id: 'sketch', kind: 'sketch', profile: 'rectangle', min: [31.5, -6], max: [61.5, 14] },
      { id: 'box', kind: 'extrude', sketch: 'sketch', from: -12, height: 12 },
    ],
  });
  console.log(JSON.stringify(exportStep(brep, { timestamp: '2026-11-14T00:00:00Z' })));
} else {
  const doc = JSON.parse(readFileSync(process.argv[2], 'utf8')), [body] = partSnapshot(doc).outputs;
  const name = doc.nodes.at(-1).id;
  const walls = body.brep.faces.flatMap(face => {
    const geom = faceGeometry(face);
    return face.name?.startsWith(name + '.') && geom.kind === 'cylinder' ? [geom] : [];
  });
  console.log(JSON.stringify({ walls, volume: massPropertiesOf(body).volume, valid: checkBrep(body.brep, { strict: true }).valid }));
}
`,
});
const ref = node => ({ node, side: 'solid' });
const box = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 40] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 12 },
  ],
  outputs: { b1: ref(1) }, nextId: 2,
};
const button = (name, region = f.page) => region.getByRole('button', { name, exact: true });
const hud = () => f.page.getByRole('dialog', { name: 'Hole', exact: true });
const field = (name, region = hud()) => region.getByLabel(name, { exact: true });
const values = async () => [Number(await field('Centre X').inputValue()), Number(await field('Centre Y').inputValue())];
const preview = () => hud().locator('.status').filter({ hasText: /^preview$/ }).waitFor();

async function open(name, bytes, mimeType = 'application/json') {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name, mimeType, buffer: Buffer.from(bytes) });
}
async function top() {
  await button('Top', f.page.getByRole('group', { name: 'Views' })).click();
  await f.page.waitForFunction(() => document.querySelector('.view-cube .vc-label')?.textContent === 'TOP');
  if (await button('Ortho').getAttribute('aria-pressed') !== 'true') await button('Ortho').click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
}
async function clickPoint(point, which = 'left') {
  const pixel = await f.page.evaluate(point => window.__studioScreenOf(point), point);
  assert.ok(await f.page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.matches('canvas.vp-canvas'), pixel));
  await f.page.mouse.click(...pixel, { button: which });
}
async function selectFace(point) {
  await clickPoint(point);
  await f.page.waitForFunction(() => window.__studioSelection.selection.faces.length === 1);
}
async function keyboardHole() {
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.page.keyboard.press('h');
  await preview();
}
async function applyAndVerify(before, point, baseVolume, face) {
  await field('Diameter').fill('4');
  await preview();
  await f.same(before);
  await button('Apply', hud()).click();
  await f.changed(before);
  const saved = await f.doc(), hole = saved.nodes.at(-1);
  const close = (value, expected, tolerance = 1e-6) => Math.abs(value - expected) <= tolerance;
  assert.equal(hole.kind, 'hole');
  assert.equal(hole.face, face);
  assert.ok(hole.center.every((value, axis) => close(value, point[axis], 0.05)));
  const native = await f.inspect('native-' + hole.id, saved);
  assert.ok(native.valid && native.walls.length > 0);
  assert.ok(native.walls.every(wall => close(wall.r, 2) && hole.center.every((value, axis) => close(wall.c[axis], value))));
  assert.ok(close(native.volume, baseVolume - Math.PI * 4 * 12));
  await f.openFeatureEditor(saved.nodes.length - 1, 'hole centre');
  for (const [axis, label] of ['Centre X', 'Centre Y'].entries())
    assert.equal(Number(await field(label, f.editor()).inputValue()), hole.center[axis]);
  await f.snapshot('hole-history-' + hole.id);
  await f.closeEditor();
  await f.undo();
  await f.same(before);
}
await f.run(async () => {
  await f.newPage();
  await open('D1179-native.bcad', JSON.stringify(box));
  await f.same(box);
  await top();
  await selectFace([8, 8, 12]);
  if (typeKeyboard) {
    f.phase = 'Use Enter on the focused Hole Type choice';
    await keyboardHole();
    const type = field('Type');
    const history = before => f.page.locator('.history .hs').count().then(count => assert.equal(count, before));
    const oldCount = await f.page.locator('.history .hs').count();
    await type.focus();
    assert.equal(await type.inputValue(), 'through');
    await type.press('ArrowDown');
    await type.press('Enter');
    assert.equal(await hud().isVisible(), true, 'Enter on Type must not apply a Hole');
    await f.same(box);
    await history(oldCount);
    assert.equal(await type.inputValue(), 'blind', 'keyboard changes Type to blind');
    await preview();
    await f.snapshot('type-keyboard-preview');
    const depth = field('Depth');
    await field('Diameter').fill('4');
    await depth.fill('6');
    await preview();
    await f.same(box);
    await button('Apply', hud()).focus();
    await f.page.keyboard.press('Enter');
    await f.changed(box);
    const accepted = (await f.snapshot('type-keyboard-apply')).doc;
    const hole = accepted.nodes.at(-1);
    assert.deepEqual(hole.center, [8, 8]);
    assert.equal(hole.depth, 6);
    const native = await f.inspect('type-keyboard-blind', accepted);
    assert.ok(native.valid && native.walls.every(wall => Math.abs(wall.r - 2) < 1e-7));
    assert.ok(Math.abs(native.volume - (19200 - 24 * Math.PI)) < 1e-7);
    f.report.observations.push({ label: 'type-keyboard-blind', depth: hole.depth, center: hole.center, ...native });
    await f.undo();
    await f.same(box);
    return;
  }
  f.phase = 'Use right-click Hole after selecting a different point on the same face';
  await clickPoint([24, 24, 12], 'right');
  await f.page.getByRole('menuitem', { name: /^Hole\b/ }).click();
  await preview();
  const right = await values();
  f.report.observations.push({ label: 'right-click-defaults', centre: right });
  await f.snapshot('right-click-defaults');
  assert.deepEqual(right, [24, 24]);
  assert.match(await hud().innerText(), /Entry face\s+n1\.top/);
  await applyAndVerify(box, [24, 24], 19200, 'n1.top');

  f.phase = 'Use H at a fractional point on an imported STEP top';
  const step = await f.inspect('step-fixture', {}, 'step');
  await open('D1179-fractional.step', step, 'application/step');
  await f.waitToast(/STEP opened.*1 solid.*millimetres/);
  await f.ready();
  const imported = await f.doc();
  assert.equal(imported.nodes[0].step, step);
  await top();
  const snap = button('Grid snap');
  for (let index = 0; index < 6 && !(await snap.innerText()).includes('off'); index++) await snap.click();
  assert.match(await snap.innerText(), /off/);
  await selectFace([46.5, 4, 0]);
  await keyboardHole();
  const fractional = await values();
  f.report.observations.push({ label: 'snap-off-defaults', centre: fractional });
  await f.snapshot('snap-off-defaults');
  assert.ok(Math.abs(fractional[0] - 46.5) <= 0.05 && Math.abs(fractional[1] - 4) <= 0.05,
    'Snap off must keep the click coordinate, including its fractional X');
  assert.match(await hud().innerText(), /Entry face\s+n0\.box\.top/);
  await applyAndVerify(imported, [46.5, 4], 7200, 'n0.box.top');
});
