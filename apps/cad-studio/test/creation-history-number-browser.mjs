import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const baseline = process.argv[3] === '--baseline';
const pins = ['apps/cad-studio/test/creation-history-number-browser.mjs', 'apps/cad-studio/test/model-rail-helper.mjs',
  'apps/cad-studio/src/ui/Hud.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx',
  'apps/cad-studio/src/app/commandState.ts', 'apps/cad-studio/src/state/useCommandPreview.ts',
  ...(baseline ? [] : ['apps/cad-studio/src/app/featureNumberInput.ts']),
  'packages/barocss-cad-model/src/app/editFields.ts'];
const f = await createFlow({
  name: 'creation-history-number', output: process.argv[2], envFrozen: 'D1142_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Box, Extrude and constant edge Fillet refuse empty and zero values during preview and history edits.',
  limits: ['An axis-aligned Box, one ordinary rectangular Extrude and one constant Fillet on a planar face perimeter.'],
});
const sketch = { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] };
const blank = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [], outputs: {}, nextId: 0 };
const planar = { ...blank, nodes: [sketch], nextId: 1 };
const solid = { ...planar, nodes: [sketch, { id: 'n1', kind: 'extrude', sketch: 0, height: 10 }],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2 };
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const hud = name => f.page.getByRole('dialog', { name, exact: true });
const state = value => f.page.waitForFunction(value => document.querySelector('.hud .status')?.textContent === value, value);
async function open(doc) {
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: 'D1142-numeric-fields.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
}
async function creationInvalid(panel, field, doc) {
  for (const [value, hint] of [['', 'is empty'], ['0', '0 mm']]) {
    await field.fill(value);
    await state('refused');
    assert.equal(await field.inputValue(), value);
    assert.equal(await field.getAttribute('aria-invalid'), 'true');
    assert.equal(await button(panel, 'Apply').isDisabled(), true);
    assert.ok((await panel.innerText()).includes(hint));
    await field.press('Enter');
    await f.same(doc);
  }
}

await f.run(async () => {
  const scenarios = [
    { name: 'Box', source: blank, field: 'Height Z', history: 'Distance', height: 12, node: 1, verify: 12,
      async begin() {
        await button(f.page, 'Top').click();
        await clickModelCommand(f.page, 'Shapes', 'Box');
        await f.worldClick([15, 15]);
      } },
    { name: 'Extrude', source: planar, field: 'Distance', history: 'Distance', height: 12, node: 1, verify: 12,
      async begin() {
        await button(f.page.getByRole('group', { name: 'History', exact: true }), 'Sketch · rectangle').click();
        await f.closeEditor();
        await f.openExtrudeHud();
      } },
    { name: 'Fillet', source: solid, field: 'Radius', history: 'Radius', height: 1.5, node: 2, verify: 1.5,
      async begin() {
        await button(f.page, 'Top').click();
        await f.frame([[0, 0], [40, 30]]);
        const point = await f.page.evaluate(() => window.__studioScreenOf([20, 15, 10]));
        await f.page.mouse.click(...point);
        await clickModelCommand(f.page, 'Modify', 'Fillet');
      } },
  ];
  for (const scenario of scenarios) {
    const { name, source: doc } = scenario;
    f.phase = 'creation ' + name;
    await open(doc);
    await scenario.begin();
    const panel = hud(name);
    const field = panel.getByLabel(scenario.field, { exact: true });
    await state('preview');
    await field.fill(String(scenario.height));
    await state('preview');
    if (baseline) {
      await field.fill('');
      await state('refused');
      await field.press('Enter');
      await f.same(doc);
      await field.fill('0');
      await state('refused');
      assert.equal(await button(panel, 'Apply').isDisabled(), true);
      f.report.observations.push({ label: name, previewMessage: await panel.innerText(), zeroInvalid: await field.getAttribute('aria-invalid') });
      await f.snapshot(name + '-baseline');
      await field.fill(String(scenario.height));
      await state('preview');
    } else {
      await creationInvalid(panel, field, doc);
      await f.snapshot(name + '-creation-refused');
      if (name === 'Extrude') {
        await field.fill('-12');
        await state('preview');
      }
      await field.fill(String(scenario.height));
      await state('preview');
    }
    await button(panel, 'Apply').click();
    await f.changed(doc);
    const created = await f.doc();
    const property = name === 'Fillet' ? 'radius' : 'height';
    assert.equal(created.nodes[scenario.node][property], scenario.verify);
    if (name === 'Extrude') assert.ok(Math.abs((await f.bodies()).bodies[0].volume - 14400) < 1e-7);
    await f.openFeatureEditor(scenario.node);
    const editor = f.editor(), history = editor.getByLabel(scenario.history, { exact: true });
    f.phase = 'history ' + name;
    await history.fill(String(scenario.height + 1));
    await history.fill('');
    assert.equal(await button(editor, 'Apply').isDisabled(), true);
    await history.press('Enter');
    await f.same(created);
    await button(editor, 'Reset').click();
    assert.equal(await history.inputValue(), String(scenario.height));
    await history.fill('0');
    if (baseline) {
      const disabled = await button(editor, 'Apply').isDisabled();
      f.report.observations.push({ label: name + ' history', zeroApplyEnabled: !disabled });
      await f.snapshot(name + '-history-parent-zero');
      await f.same(created);
      await f.closeEditor();
      continue;
    }
    assert.equal(await history.inputValue(), '0');
    assert.equal(await history.getAttribute('aria-invalid'), 'true');
    assert.equal(await button(editor, 'Apply').isDisabled(), true);
    await history.press('Enter');
    await f.same(created);
    await f.snapshot(name + '-history-refused');
    const revisionValue = name === 'Extrude' ? -13 : scenario.height + 1;
    await history.fill(String(revisionValue));
    const { doc: edited } = await f.applyEditor(created, name + '-recovered');
    assert.equal(edited.nodes[scenario.node][property], revisionValue);
    await f.undo();
    await f.same(created);
    await f.redo();
    await f.same(edited);
    const finalBody = (await f.bodies()).bodies[0];
    if (name === 'Extrude') assert.ok(Math.abs(finalBody.volume - 15600) < 1e-7);
    f.report.observations.push({ label: name, createdMM: scenario.height, editedMM: revisionValue, volumeMM3: finalBody.volume });
  }
  if (baseline) assert.fail('Zero input still enabled Apply in primitive history');

  f.phase = 'use R after leaving a focused Circle numeric field';
  await open(blank);
  await button(f.page.getByRole('group', { name: 'Mode', exact: true }), 'Sketch').click();
  await f.sketchPanel().getByLabel('Sketch plane', { exact: true }).selectOption('xy');
  await f.tool('Circle', 'c');
  await f.worldClick([0, 0]);
  await f.worldClick([9, 0]);
  const diameter = f.sketchPanel().locator('#sk-diameter');
  await diameter.focus();
  await diameter.press('r');
  const rectangle = button(f.page, 'Rectangle');
  assert.match(await rectangle.getAttribute('class'), /(?:^|\s)on(?:\s|$)|bg-primary/);
  await f.same(blank);
  await f.snapshot('rectangle-shortcut-from-number-field');
  assert.deepEqual(f.report.downloads, []);
});
