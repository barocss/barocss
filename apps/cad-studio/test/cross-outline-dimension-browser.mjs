import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/cross-outline-dimension-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/viewport/sketchOutlinePick.ts',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'apps/cad-studio/src/viewport/studioSketchViewportActions.ts',
  'apps/cad-studio/src/viewport/sketchOverlay.tsx',
  'packages/barocss-cad-model/src/sketch/select.ts',
];
const f = await createFlow({
  name: 'cross-outline-dimension', output: process.argv[2], envFrozen: 'D1097_SOURCE_FROZEN',
  qualification: 'Keep cross-outline point picks out of the single-outline constraint solver.',
  initialFiles: pins, requiredFrozen: pins,
});
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const first = [12, 12], second = [45, 15], secondTop = [45, 30];
const guidance = 'Pick two points on the same outline to add a distance constraint.';
const editor = () => f.page.locator('input.dim-edit');
const picked = () => f.page.locator('.sk-pick-point.on');

async function cross(from, to, label) {
  await f.worldClick(from);
  assert.equal(await picked().count(), 1, 'first point is selected');
  const [x, y] = await f.screenOf(to);
  await f.page.mouse.move(x, y);
  const hover = f.page.locator('[data-sketch-entity="point:parked"].hover');
  await f.worldClick(to);
  assert.equal(await editor().count(), 0);
  const alert = await f.sketchAlert();
  f.report.observations.push({ label, alert, picked: await picked().count() });
  await f.snapshot(label);
  assert.equal(alert, guidance);
  assert.equal(await picked().count(), 1, 'refusal retains the first point');
  assert.equal(await hover.count(), 1, 'the inactive point is highlighted');
}

await f.run(async () => {
  await f.newPage();
  await button(f.page, 'New part').click();
  await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.ready();
  const empty = await f.doc();
  await button(f.page.getByLabel('Mode', { exact: true }), 'Sketch').click();
  await f.sketchPanel().getByLabel('Sketch plane', { exact: true }).selectOption('xy');
  const corners = [first, [32, 26], second, [65, 30]];
  await f.frame(corners);
  for (const p of corners) await f.worldClick(p);
  await f.tool('Dimension', 'd');
  f.phase = 'Dimension gives an explicit refusal for points on separate new outlines';
  await cross(second, first, '01-new-outline-boundary');
  await f.worldClick(secondTop);
  assert.equal(await editor().count(), 1);
  assert.equal(await editor().inputValue(), '15');
  assert.equal(await f.sketchAlert(), null);
  await editor().press('Escape');
  await f.same(empty);
  const drafted = (await f.finishSketch('02-no-new-constraint')).doc;
  await f.openExtrudeHud();
  const solid = (await f.applyExtrude({ distance: 2, previous: drafted, label: '03-extruded' })).doc;

  const bytes = Buffer.from(JSON.stringify(solid));
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: 'Two outlines.bcad', mimeType: 'application/json', buffer: bytes });
  await f.same(solid);
  await f.openFeatureEditor(1);
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
  await f.tool('Dimension', 'd');
  await f.frame(corners);
  await cross(first, second, '04-reopened-outline-boundary');
  const active = f.sketchPanel().getByLabel('Active outline', { exact: true });
  await f.worldClick([37, 10]);
  await f.worldClick(second);
  assert.equal(await active.inputValue(), '0', 'an inactive point preserves the active outline');
  assert.equal(await f.sketchAlert(), 'Pick a point on the active outline.');
  await active.selectOption('1');
  await cross(second, first, '05-reopened-reverse-boundary');
  await f.tool('Select', 's');
  await f.worldClick(second);
  await f.page.keyboard.down('Shift');
  try { await f.worldClick(first); } finally { await f.page.keyboard.up('Shift'); }
  assert.equal(await f.sketchAlert(), 'Select points on one outline at a time.');
  assert.equal(await picked().count(), 1);
  await f.same(solid);
  await f.finishSketch('06-no-op-finish');
  await f.same(solid);
});
