import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/standalone-circle-diameter-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/ui/InlineSketchDimension.tsx',
  'apps/cad-studio/src/ui/SketchMarks.tsx',
  'apps/cad-studio/src/viewport/sketchOutlinePick.ts',
  'apps/cad-studio/src/viewport/sketchOverlay.tsx',
  'apps/cad-studio/src/viewport/studioSketchViewportActions.ts',
];
const f = await createFlow({
  name: 'standalone-circle-diameter', output: process.argv[2], envFrozen: 'D1098_SOURCE_FROZEN',
  qualification: 'Open, directly edit and replay a standalone circle Diameter alongside an attached circle control.',
  initialFiles: pins, requiredFrozen: pins,
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkBrep, massPropertiesOf } from '@barocss/cad';
import { partSnapshot } from '@barocss/cad-model/engine/part';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify(partSnapshot(doc).outputs.map(body => ({
  valid: checkBrep(body.brep, { strict: true }).valid, volume: massPropertiesOf(body).volume,
  faces: body.brep.faces.map(face => face.name),
}))));
`,
});
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const inline = () => f.page.getByRole('spinbutton', { name: 'Diameter of circle 1', exact: true });
const diameter = () => f.sketchPanel().locator('input#sk-diameter');

async function openSketch(solid) {
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: 'Circle.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(solid)) });
  await f.same(solid);
  await f.openFeatureEditor(1);
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
  await f.tool('Dimension', 'd');
}
async function author(nested) {
  await f.newPage();
  await button(f.page, 'New part').click();
  await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.ready();
  await button(f.page.getByLabel('Mode', { exact: true }), 'Sketch').click();
  await f.sketchPanel().getByLabel('Sketch plane', { exact: true }).selectOption('xy');
  await f.frame([[-35, -25], [35, 25], [0, 0], [9, 0]]);
  if (nested) {
    await f.worldClick([-35, -25]);
    await f.worldClick([35, 25]);
  }
  await f.tool('Circle', 'c');
  await f.worldClick([0, 0]);
  await f.worldClick([9, 0]);
  const drafted = (await f.finishSketch(nested ? '05-nested-sketch' : '01-circle-sketch')).doc;
  await f.openExtrudeHud();
  return (await f.applyExtrude({ distance: 5, previous: drafted, label: nested ? '06-nested-extruded' : '02-circle-extruded' })).doc;
}
async function verifyNative(doc, label, volume) {
  const [body] = await f.inspect(label, doc);
  assert.equal(body.valid, true);
  assert.ok(Math.abs(body.volume - volume) < 1e-7, JSON.stringify(body));
  f.report.observations.push({ label, ...body });
  return body;
}
async function edit(value) {
  await inline().fill(String(value));
  await inline().press('Enter');
}

await f.run(async () => {
  const solid = await author(false);
  assert.equal(solid.nodes[0].radius, 9);
  const before = await verifyNative(solid, 'before-native', Math.PI * 9 ** 2 * 5);
  await openSketch(solid);
  f.phase = 'direct standalone circle rim click opens the existing 18 mm diameter';
  await f.frame([[0, 0], [-9, 0], [11, 0]]);
  const [x, y] = await f.screenOf([-9, 0]);
  await f.page.mouse.move(x, y);
  const hover = f.page.locator('.vp-overlay polygon.sk-pick-edge.hover');
  await hover.waitFor();
  const points = (await hover.getAttribute('points')).split(' ');
  assert.equal(points.length, 72);
  assert.ok(points.every(point => point.split(',').length === 2), 'SVG uses only projected x and y');
  await f.page.keyboard.press('s');
  await hover.waitFor({ state: 'hidden' });
  await f.page.keyboard.press('d');
  await f.worldClick([-9, 0]);
  await f.snapshot('03-standalone-rim');
  assert.equal(await inline().count(), 1);
  assert.equal(await inline().inputValue(), '18');
  await edit(0);
  assert.match(await f.sketchAlert(), /at least 0.5 mm/);
  assert.equal(await diameter().inputValue(), '18');
  await f.page.locator('.vp-overlay .dim').filter({ hasText: 'Ø18' }).click();
  await inline().fill('22');
  await f.page.keyboard.down('Enter');
  try {
    await inline().waitFor({ state: 'hidden' });
    await f.page.keyboard.down('Enter');
    await f.same(solid);
    await f.sketchPanel().waitFor();
  } finally { await f.page.keyboard.up('Enter'); }
  assert.equal(await diameter().inputValue(), '22');
  await f.undo();
  assert.equal(await diameter().inputValue(), '18');
  await f.redo();
  assert.equal(await diameter().inputValue(), '22');
  await f.same(solid);
  const edited = (await f.finishSketch('04-circle-22')).doc;
  assert.equal(edited.nodes[0].radius, 11);
  assert.deepEqual(edited.nodes[0].sideTags, solid.nodes[0].sideTags);
  assert.deepEqual(edited.nodes[1], solid.nodes[1]);
  const after = await verifyNative(edited, 'after-native', Math.PI * 11 ** 2 * 5);
  assert.deepEqual(after.faces, before.faces);
  await f.undo();
  await f.same(solid);
  await f.redo();
  await f.same(edited);
  await openSketch(edited);
  await f.worldClick([-11, 0]);
  assert.equal(await inline().inputValue(), '22');
  await inline().press('Escape');
  await f.same(edited);

  const nested = await author(true);
  await openSketch(nested);
  await f.frame([[0, 0], [-9, 0], [11, 0]]);
  await f.worldClick([-9, 0]);
  assert.equal(await inline().inputValue(), '18');
  await edit(22);
  await f.same(nested);
  const cut = (await f.finishSketch('07-nested-22')).doc;
  assert.deepEqual(cut.nodes[0].sideTags, nested.nodes[0].sideTags);
  assert.deepEqual(cut.nodes[1], nested.nodes[1]);
  await verifyNative(cut, 'nested-native', (70 * 50 - Math.PI * 11 ** 2) * 5);
});
