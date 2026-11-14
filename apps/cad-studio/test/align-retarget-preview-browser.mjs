import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const pins = ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/viewport/useViewportPicking.ts',
  'packages/barocss-cad-model/src/app/alignCommand.ts'];
const f = await createFlow({
  name: 'align-retarget-preview', output: process.argv[2], envFrozen: process.argv.includes('--retarget') ? 'D1203_SOURCE_FROZEN' : process.argv.includes('--history') ? 'D1202_SOURCE_FROZEN' : 'D1199_SOURCE_FROZEN',
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
const retarget = process.argv.includes('--retarget');
const history = retarget || process.argv.includes('--history');
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
async function verify(label, doc, target, gap = 2, lineUp = 'centre') {
  const linked = doc.nodes.at(-1).kind === 'align';
  const top = target === 'n5.top' ? 12 : 8, [targetX, targetY] = target === 'n5.top' ? [89, 5] : [44, 3];
  const offset = [lineUp === 'centre' ? targetX : 0, lineUp === 'centre' ? targetY : 0, top + gap - 20];
  const movingKey = linked ? 'b6' : 'b7';
  if (!linked) assert.deepEqual(doc.nodes.at(-1), { kind: 'translate', parent: ref(6), offset, id: 'n7' });
  assert.deepEqual(doc.nodes.slice(0, seed.nodes.length), seed.nodes);
  const result = await f.inspect(label, doc);
  assert.deepEqual(result.map(body => body.key).sort(), ['b3', 'b5', movingKey]);
  const boxes = {
    b3: { volume: 2560, min: [40, 0, 0], max: [60, 16, 8] },
    b5: { volume: 7200, min: [80, 0, 0], max: [110, 20, 12] },
    [movingKey]: { volume: 720, min: [offset[0], offset[1], top + gap], max: [offset[0] + 12, offset[1] + 10, top + gap + 6] },
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
  await f.page.waitForFunction(() => /^b3,b5,b[67]$/.test(window.__studioSection().shownKeys.join()));
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
  if (!history) return;
  assert.deepEqual(applied.nodes.at(-1), {
    kind: 'align', version: 1, parent: ref(1), id: 'n6',
    source: { feature: 'n1', face: 'n1.top', axis: 'z', sign: 1 },
    target: { body: ref(5), feature: 'n5', face: 'n5.top', axis: 'z', sign: 1 },
    gap: 2, lineUp: 'centre',
  });
  await f.openFeatureEditor(6);
  const historyState = await f.snapshot('history-bound-faces');
  assert.match(historyState.editor, /Source facen1[.]topTarget face/);
  const targetField = f.editor().getByLabel('Target face', { exact: true });
  if (await targetField.count()) assert.equal(await targetField.locator('option:checked').innerText(), 'n5.top');
  else assert.match(historyState.editor, /Target facen5[.]top/);
  const gap = f.editor().getByLabel('Gap', { exact: true }), lineup = f.editor().getByLabel('Line up', { exact: true });
  assert.equal(await gap.inputValue(), '2');
  assert.equal(await lineup.inputValue(), 'centre');
  const expected = structuredClone(applied);
  if (retarget) {
    const chooser = f.editor().getByLabel('Target face', { exact: true });
    await chooser.locator('option').filter({ hasText: /^n3[.]top$/ }).waitFor({ state: 'attached' });
    assert.equal(await chooser.locator('option').filter({ hasText: /^n1[.]/ }).count(), 0);
    await chooser.selectOption({ label: 'n3.top' });
    assert.equal(await chooser.locator('option:checked').innerText(), 'n3.top');
    await f.same(applied);
    await f.snapshot('history-target-before-apply');
    Object.assign(expected.nodes.at(-1), { target: { feature: 'n3', face: 'n3.top', axis: 'z', sign: 1, body: ref(3) } });
  } else {
    await gap.fill('4');
    await lineup.selectOption('touch');
    Object.assign(expected.nodes.at(-1), { gap: 4, lineUp: 'touch' });
  }
  const edited = await f.applyEditor(applied, retarget ? 'history-target-applied' : 'history-gap-and-line-up');
  assert.deepEqual(edited.doc, expected);
  await verify('history-native', expected, retarget ? 'n3.top' : 'n5.top', retarget ? 2 : 4, retarget ? 'centre' : 'touch');
  await f.undo();
  await f.same(applied);
  await f.redo();
  await f.same(expected);

  await f.newPage();
  const [reopen] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await reopen.setFiles({ name: 'align-history.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(expected)) });
  await f.same(expected);
  await verify('reopened-native', expected, retarget ? 'n3.top' : 'n5.top', retarget ? 2 : 4, retarget ? 'centre' : 'touch');
  await f.openFeatureEditor(6);
  assert.equal(await f.editor().getByLabel('Gap', { exact: true }).inputValue(), retarget ? '2' : '4');
  assert.equal(await f.editor().getByLabel('Line up', { exact: true }).inputValue(), retarget ? 'centre' : 'touch');
  if (retarget) assert.equal(await f.editor().getByLabel('Target face', { exact: true }).locator('option:checked').innerText(), 'n3.top');
  await f.snapshot('reopened-align-history');
});
