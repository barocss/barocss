import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const controls = process.argv[3] === '--controls';
const pins = ['apps/cad-studio/test/empty-history-number-browser.mjs', 'apps/cad-studio/src/ui/NodeEditor.tsx',
  'packages/barocss-cad-model/src/app/editFields.ts'];
const f = await createFlow({
  name: 'empty-history-number', output: process.argv[2], envFrozen: controls ? 'D1139_SOURCE_FROZEN' : 'D1138_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Refuse an empty numeric history field even after it held a valid draft value.',
  limits: ['A rectangular Extrude with two independent numeric edits in desktop Studio.'],
});
const source = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [{ kind: 'sketch', id: 'n0', profile: 'rectangle', min: [0, 0], max: [40, 30] },
    { kind: 'extrude', id: 'n1', sketch: 0, height: 10 }], outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2 };
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const undoState = () => Promise.all(['Undo', 'Redo'].map(name => button(f.page, name).isEnabled()));

async function open(doc, name) {
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
}

await f.run(async () => {
  if (controls) {
    const fillet = { id: 'n2', kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: ['n1.side0|n1.top'], radius: 1 };
    const box = { ...source, nodes: [source.nodes[0], { ...source.nodes[1], made: { command: 'box', values: { w: 40, d: 30, h: 10 } } }] };
    const rounded = { ...source, nodes: [...source.nodes, fillet], outputs: { b2: { node: 2, side: 'solid' } }, nextId: 3 };
    for (const [label, doc, index, fieldLabel, next] of [
      ['box', box, 1, 'Distance', '14'],
      ['fillet', rounded, 2, 'Radius', '2'],
    ]) {
      f.phase = 'verify blank ' + label + ' history input and Reset';
      await open(doc, `D1139-${label}.bcad`);
      await f.openFeatureEditor(index);
      const field = f.editor().getByLabel(fieldLabel, { exact: true });
      const original = await field.inputValue();
      await field.fill(next);
      await field.fill('');
      assert.equal(await field.getAttribute('aria-invalid'), 'true');
      assert.equal(await button(f.editor(), 'Apply').isDisabled(), true);
      await field.press('Enter');
      assert.deepEqual(await f.doc(), doc);
      await f.snapshot('01-' + label + '-empty');
      await button(f.editor(), 'Reset').click();
      assert.equal(await field.inputValue(), original);
      assert.equal(await button(f.editor(), 'Apply').isDisabled(), true);
      await f.same(doc);
    }
    const pattern = { id: 'n2', kind: 'circular-pattern', parent: { node: 1, side: 'solid' }, axis: 'z', angle: 90, count: 3, span: 180 };
    const far = { ...source.nodes[0], min: [10, 20], max: [14, 26] };
    const array = { ...rounded, nodes: [far, source.nodes[1], pattern] };
    f.phase = 'refuse a fractional Circular Count before Apply';
    await open(array, 'D1139-count.bcad');
    await f.openFeatureEditor(2);
    const count = f.editor().getByLabel('Count', { exact: true });
    await count.fill('2.5');
    await f.snapshot('02-fractional-count-input');
    assert.equal(await button(f.editor(), 'Apply').isDisabled(), true);
    await count.press('Enter');
    assert.deepEqual(await f.doc(), array);
    await f.editor().getByText(/whole number from 2 to 36/i).waitFor();
    await count.fill('4');
    const { doc, bodies } = await f.applyEditor(array, '03-four-copies');
    assert.equal(doc.nodes[2].count, 4);
    assert.equal(doc.nodes[2].angle, 60);
    assert.ok(Math.abs(bodies.bodies[0].volume - 960) < 1e-8);
    await f.undo();
    await f.same(array);
    await f.redo();
    await f.same(doc);
    f.report.observations.push({ label: 'pattern', count: 4, stepDeg: 60, volumeMM3: bodies.bodies[0].volume });
    assert.deepEqual(f.report.downloads, []);
    return;
  }
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: 'D1138-history-number.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);
  await button(f.page.getByRole('group', { name: 'History', exact: true }), 'Extrude 10').click();
  const field = label => f.editor().getByLabel(label, { exact: true });
  const distance = field('Distance'), width = field('Width');
  await distance.fill('14');
  await distance.fill('');
  await width.fill('42');
  const before = await undoState();
  f.phase = 'refuse hidden draft distance through both Apply and Enter';
  await f.snapshot('01-blank-distance-and-valid-width');
  assert.equal(await distance.inputValue(), '');
  const apply = button(f.editor(), 'Apply');
  assert.equal(await apply.isDisabled(), true);
  const bounds = await apply.boundingBox();
  assert.ok(bounds);
  await f.page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await distance.press('Enter');
  assert.deepEqual(await f.doc(), source);
  assert.equal(await apply.isDisabled(), true);
  assert.equal(await distance.getAttribute('aria-invalid'), 'true');
  await f.editor().getByText(/enter a number for Distance/i).waitFor();
  assert.deepEqual(await undoState(), before);
  await f.snapshot('02-blank-refusal');

  f.phase = 'restore the original distance and apply only the valid width';
  await distance.fill('10');
  const { doc, bodies } = await f.applyEditor(source, '03-width-only');
  assert.deepEqual(doc.nodes[0].max, [42, 30]);
  assert.equal(doc.nodes[1].height, 10);
  assert.ok(Math.abs(bodies.bodies[0].volume - 12600) < 1e-9);
  await f.undo();
  await f.same(source);
  await f.redo();
  await f.same(doc);
  f.report.observations.push({ label: 'width-only', widthMM: 42, distanceMM: 10, volumeMM3: bodies.bodies[0].volume });
  assert.deepEqual(f.report.downloads, []);
});
