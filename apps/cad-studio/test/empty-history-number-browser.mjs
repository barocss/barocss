import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = ['apps/cad-studio/test/empty-history-number-browser.mjs', 'apps/cad-studio/src/ui/NodeEditor.tsx',
  'packages/barocss-cad-model/src/app/editFields.ts'];
const f = await createFlow({
  name: 'empty-history-number', output: process.argv[2], envFrozen: 'D1138_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Refuse an empty numeric history field even after it held a valid draft value.',
  limits: ['A rectangular Extrude with two independent numeric edits in desktop Studio.'],
});
const source = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [{ kind: 'sketch', id: 'n0', profile: 'rectangle', min: [0, 0], max: [40, 30] },
    { kind: 'extrude', id: 'n1', sketch: 0, height: 10 }], outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2 };
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const undoState = () => Promise.all(['Undo', 'Redo'].map(name => button(f.page, name).isEnabled()));

await f.run(async () => {
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
