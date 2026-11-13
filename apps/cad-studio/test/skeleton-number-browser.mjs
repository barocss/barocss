import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const baseline = process.argv[3] === '--baseline';
const pins = ['apps/cad-studio/test/skeleton-number-browser.mjs', 'apps/cad-studio/src/ui/SkeletonPanel.tsx',
  'apps/cad-studio/src/skeleton/useSkeletonEditor.tsx', 'packages/barocss-cad-model/src/frames/sketch3d.ts'];
const f = await createFlow({
  name: 'skeleton-number', output: process.argv[2], envFrozen: 'D1140_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Desktop 3D Sketch rejects zero and empty Length during history re-edit while keeping a valid edit undoable.',
  limits: ['A native two-segment 3D Sketch and a new line, with no downstream features.'],
});
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, outputs: {}, nextId: 1,
  nodes: [{
    kind: 'skeleton', id: 'n0', name: 'Length control',
    points: [[0, 0, 0], [30, 0, 0], [30, 20, 0]], segments: [[0, 1], [1, 2]],
    constraints: [{ kind: 'fixed', point: 0, at: [0, 0, 0] }, { kind: 'along', segment: 0, axis: 'x' },
      { kind: 'length', segment: 0, value: 30 }, { kind: 'angle', a: 0, b: 1, degrees: 90 }],
  }],
};
const button = (scope, name) => scope.getByRole('button', { name, exact: true });

await f.run(async () => {
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: 'D1140-skeleton.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);
  async function edit() {
    await f.page.locator('.history .hs[data-node-index="0"]').click({ button: 'right' });
    await f.page.locator('.ctx-item', { hasText: 'Edit in 3D sketch' }).click();
    await panel.waitFor();
  }
  let panel = f.page.getByRole('complementary', { name: '3D sketch' });
  let apply = button(panel, 'Apply 3D sketch');
  const length = panel.getByLabel('Constraint 3 value', { exact: true });
  const angle = panel.getByLabel('Constraint 4 value', { exact: true });
  const undoState = () => Promise.all(['Undo', 'Redo'].map(name => button(f.page, name).isEnabled()));
  await edit();
  assert.equal(await length.inputValue(), '30');
  const before = await undoState();
  f.phase = 'reject zero without keeping the last accepted input or closing the panel';
  await length.fill('0');
  await f.snapshot('01-zero-length');
  if (baseline) {
    assert.equal(await apply.isEnabled(), true);
    await apply.click();
    await panel.waitFor({ state: 'hidden' });
    const doc = await f.doc();
    f.report.observations.push({ label: 'zero-accepted', panelClosed: true, savedLengthMM: doc.nodes[0].constraints[2].value });
    await f.snapshot('02-baseline-closed');
    assert.fail('Length 0 allowed Apply to close the 3D Sketch with Length 30 mm');
  }

  assert.equal(await length.getAttribute('aria-invalid'), 'true');
  const bounds = await apply.boundingBox();
  assert.ok(bounds);
  assert.equal(await apply.isDisabled(), true);
  await f.page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  // Leave button and input focus so Enter reaches the window shortcut.
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.page.keyboard.press('Enter');
  assert.equal(await panel.isVisible(), true);
  assert.equal(await length.inputValue(), '0');

  await length.fill('');
  await length.press('Enter');
  assert.equal(await length.inputValue(), '');
  assert.equal(await apply.isDisabled(), true);
  assert.deepEqual(await f.doc(), source);
  assert.deepEqual(await undoState(), before);

  f.phase = 'retain the angle refusal after a valid length edit';
  await angle.fill('180');
  await length.fill('40');
  await length.press('Enter');
  assert.equal(await angle.inputValue(), '180');
  assert.equal(await angle.getAttribute('aria-invalid'), 'true');
  assert.equal(await apply.isDisabled(), true);
  await f.snapshot('02-angle-blocks-valid-length');
  await angle.fill('90');
  await apply.click();
  await panel.waitFor({ state: 'hidden' });
  const doc = await f.doc(), node = doc.nodes[0];
  assert.equal(node.constraints[2].value, 40);
  assert.equal(node.constraints[3].degrees, 90);
  const span = Math.hypot(...node.points[1].map((p, i) => p - node.points[0][i]));
  assert.ok(Math.abs(span - 40) < 1e-8, String(span));
  await f.undo();
  await f.same(source);
  await f.redo();
  await f.same(doc);
  await edit();
  assert.equal(await length.inputValue(), '40');
  await f.snapshot('03-length-reopened');
  await button(panel, 'Cancel 3D sketch').click();
  f.report.observations.push({ label: 'length-recovered', acceptedMM: 40, spanMM: span, retainedAngleDeg: 90 });

  f.phase = 'use the same Length range in a newly authored sketch';
  await f.newPage();
  panel = f.page.getByRole('complementary', { name: '3D sketch' });
  apply = button(panel, 'Apply 3D sketch');
  await button(f.page, 'New part').click();
  await f.ready();
  await f.page.locator('.views button:text-is("Top")').click();
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.command('3d sketch');
  await panel.waitFor();
  await f.worldClick([0, 0]);
  await f.worldClick([30, 0]);
  await button(panel, 'Select').click();
  await f.worldClick([15, 0]);
  await button(panel, 'Add Length').click();
  const newLength = panel.getByLabel('Constraint 1 value', { exact: true });
  assert.equal(await newLength.inputValue(), '30');
  await newLength.fill('0');
  assert.equal(await apply.isDisabled(), true);
  assert.equal(await newLength.getAttribute('aria-invalid'), 'true');
  assert.equal((await f.doc()).nodes.length, 0);
  await f.snapshot('04-new-length-refused');
  await newLength.fill('20');
  await apply.click();
  await panel.waitFor({ state: 'hidden' });
  const created = (await f.doc()).nodes[0];
  const createdSpan = Math.hypot(...created.points[1].map((p, i) => p - created.points[0][i]));
  assert.equal(created.constraints[0].value, 20);
  assert.ok(Math.abs(createdSpan - 20) < 1e-8, String(createdSpan));
  f.report.observations.push({ label: 'new-length-recovered', acceptedMM: 20, spanMM: createdSpan });
  assert.deepEqual(f.report.downloads, []);
});
