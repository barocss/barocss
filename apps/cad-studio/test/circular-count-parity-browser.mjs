import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const baseline = process.argv[3] === '--baseline';
const pins = ['apps/cad-studio/test/circular-count-parity-browser.mjs', 'apps/cad-studio/test/model-rail-helper.mjs',
  'apps/cad-studio/src/ui/Hud.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx', 'apps/cad-studio/src/state/useCommandPreview.ts',
  'packages/barocss-cad-model/src/app/commands.ts', 'packages/barocss-cad-model/src/app/editFields.ts',
  'packages/barocss-cad-model/src/engine/circularPatternSpan.ts'];
const f = await createFlow({
  name: 'circular-count-parity', output: process.argv[2], envFrozen: 'D1141_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Circular Pattern Count uses the same limits in desktop preview and history.',
  limits: ['One disjoint rectangular seed and its X and Z circular patterns.'],
});
const source = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2,
  nodes: [{ id: 'n0', kind: 'sketch', profile: 'rectangle', min: [100, 20], max: [104, 26] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 8 }], outputs: { b1: { node: 1, side: 'solid' } } };
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const hud = () => f.page.getByRole('dialog', { name: 'Circular pattern', exact: true });
const count = scope => scope.getByLabel('Count', { exact: true });
const state = value => f.page.waitForFunction(value => document.querySelector('.hud .status')?.textContent === value, value);
async function open(doc = source) {
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: 'D1141-circular-count.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
}
async function begin(axis) {
  await f.page.locator('.outliner .ol-row > button.ol').click();
  await clickModelCommand(f.page, 'Pattern', 'Circular pattern');
  await hud().getByLabel('Axis', { exact: true }).selectOption(axis);
  await state('preview');
}
async function refuse(scope, value, doc, label, creation = false) {
  const field = count(scope);
  await field.fill(value);
  if (creation) await state('refused');
  assert.equal(await field.inputValue(), value);
  assert.equal(await field.getAttribute('aria-invalid'), 'true');
  assert.equal(await button(scope, 'Apply').isDisabled(), true);
  await field.press('Enter');
  await f.same(doc);
  if (label) await f.snapshot(label);
}

await f.run(async () => {
  if (baseline) {
    f.phase = 'reproduce different bounds and a silently admitted Z Count above the visible limit';
    await open();
    await begin('z');
    const field = count(hud());
    assert.equal(await field.getAttribute('max'), '36');
    await field.fill('37');
    await f.page.waitForFunction(() => ['preview', 'refused'].includes(document.querySelector('.hud .status')?.textContent));
    assert.equal(await hud().locator('.status').textContent(), 'preview');
    await f.snapshot('01-parent-z37-admitted');
    await button(hud(), 'Apply').click();
    await hud().waitFor({ state: 'hidden' });
    const doc = await f.doc();
    assert.equal(doc.nodes[2].count, 37);
    await f.openFeatureEditor(2);
    const max = await count(f.editor()).getAttribute('max');
    assert.equal(max, '64');
    f.report.observations.push({ label: 'parent-mismatch', visibleCreateMax: 36, savedCount: 37, historyMax: Number(max) });
    assert.fail('Z Count 37 applied despite the preview maximum of 36, and history advertised 64');
  }

  for (const [axis, maximum] of [['x', 4], ['z', 36]]) {
    f.phase = 'verify shared Count rules on axis ' + axis;
    await open();
    await begin(axis);
    const currentHud = hud();
    const range = new RegExp(`whole number from 2 to ${maximum}\\b`, 'i');
    assert.equal(await count(currentHud).getAttribute('max'), String(maximum));
    await currentHud.getByText(range).waitFor();
    for (const value of ['', '0', '1', '2.5', String(maximum + 1)]) {
      await refuse(currentHud, value, source, value === String(maximum + 1) ? axis + '-create-refusal' : undefined, true);
    }
    await count(currentHud).fill('3');
    await state('preview');
    await button(currentHud, 'Apply').click();
    await currentHud.waitFor({ state: 'hidden' });
    await f.changed(source);
    const first = await f.doc();
    assert.equal(first.nodes[2].count, 3);
    const firstBodies = await f.bodies();
    assert.ok(Math.abs(firstBodies.bodies[0].volume - 576) < 1e-7);

    await f.openFeatureEditor(2);
    const editor = f.editor();
    assert.equal(await count(editor).getAttribute('max'), String(maximum));
    await editor.getByText(range).waitFor();
    for (const value of ['', '0', '1', '2.5', String(maximum + 1)]) {
      await refuse(editor, value, first, value === String(maximum + 1) ? axis + '-history-refusal' : undefined);
    }
    await count(editor).fill('4');
    const { doc, bodies } = await f.applyEditor(first, axis + '-count-four');
    assert.equal(doc.nodes[2].angle, 90);
    assert.equal(doc.nodes[2].count, 4);
    assert.ok(Math.abs(bodies.bodies[0].volume - 768) < 1e-7);
    await f.undo();
    await f.same(first);
    await f.redo();
    await f.same(doc);
    f.report.observations.push({ label: axis, maximum, count: 4, stepDegrees: 90, volumeMM3: bodies.bodies[0].volume });
  }
  f.phase = 'open a previously saved 37-copy Z pattern and make an explicit edit';
  const legacy = { ...source, nodes: [...source.nodes, { id: 'n2', kind: 'circular-pattern',
    parent: { node: 1, side: 'solid' }, axis: 'z', count: 37, span: 360, angle: 9.72973 }],
    outputs: { b2: { node: 2, side: 'solid' } }, nextId: 3 };
  await open(legacy);
  await f.openFeatureEditor(2);
  const editor = f.editor();
  assert.equal(await count(editor).inputValue(), '37');
  assert.equal(await button(editor, 'Apply').isDisabled(), true);
  assert.ok(Math.abs((await f.bodies()).bodies[0].volume - 7104) < 1e-7);
  await f.snapshot('legacy-37-reopened');
  await count(editor).fill('4');
  const fixed = await f.applyEditor(legacy, 'legacy-explicit-count-four');
  assert.equal(fixed.doc.nodes[2].count, 4);
  await f.undo();
  await f.same(legacy);
  f.report.observations.push({ label: 'legacy-z', restoredCount: 37, volumeMM3: 7104 });
  assert.deepEqual(f.report.downloads, []);
});
