import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const output = process.argv[2];
const pins = ['apps/cad-studio/test/arc-extension-scale-browser.mjs', 'apps/cad-studio/test/flow-helper.mjs',
  'apps/cad-studio/src/sketch/arcExtension.ts', 'apps/cad-studio/src/sketch/useArcExtensionSnap.ts',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts'];
const f = await createFlow({
  name: 'arc-extension-scale', output, envFrozen: 'D800_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: 'Verify a clockwise major arc, a fixed CSS-pixel reach, and guide retirement in a desktop context.',
  limits: ['One XY construction arc, a 1440 × 1000 desktop at scale 2 and two camera zooms.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify(evaluateCadPart(toPartDocument(doc)).outputs.map(body => ({
  valid: checkOutput(body).valid, volume: massPropertiesOf(body).volume,
}))));
`,
});
const source = { kind: 'polygon', points: [[20, 30], [30, 20]], closed: false,
  bulges: [-(1 + Math.SQRT2), 0], pending: false, construction: true, ids: ['e5', 'e6'] };
const tags = { outer: ['e1', 'e2', 'e3', 'e4'] };
const primary = { kind: 'sketch', profile: 'rectangle', min: [44, 35], max: [49, 40], sideTags: tags, id: 'n0' };
const plain = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [primary], outputs: {}, nextId: 1 };
const initial = { ...plain, nodes: [{ ...primary, construction: [source] }] };
const candidate = [30 - 5 * Math.SQRT2, 30 - 5 * Math.SQRT2], farCorner = [27, 28], stored = [22.9289, 22.9289];
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const guide = () => f.page.locator('.vp-overlay .sk-arc-extension');
const mark = () => f.page.locator('.vp-overlay .sk-osnap').filter({ hasText: 'Extension' });
const extension = () => button(f.sketchPanel(), 'Arc extension snap');
const settle = () => f.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function hover(pixel) {
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel), pixel);
  await f.page.mouse.move(...pixel);
  await settle();
}
async function openSketch() {
  await button(f.page.getByRole('group', { name: 'History', exact: true }), 'Sketch · rectangle').click();
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
  await f.tool('Rectangle', 'r');
  await f.frame([candidate, farCorner, ...source.points]);
}
async function arm() {
  await extension().click();
  await f.sketchPanel().getByRole('status').getByText('Pick the arc end.').waitFor();
  await f.worldClick(source.points[1]);
  await guide().waitFor({ timeout: 5000 });
}
async function radiusScreen() {
  const center = await f.screenOf([30, 30]), projected = await f.screenOf(candidate);
  const radius = Math.hypot(projected[0] - center[0], projected[1] - center[1]);
  const radial = distance => [projected[0] + distance * (projected[0] - center[0]) / radius,
    projected[1] + distance * (projected[1] - center[1]) / radius];
  return { projected, scale: radius / 10, radial };
}
async function verifyReach(label) {
  const { projected, scale, radial } = await radiusScreen();
  const inside = radial(7), outside = radial(9);
  await hover(inside);
  await mark().waitFor({ timeout: 5000 });
  const drawn = await mark().locator('rect').evaluate(element => {
    const box = element.getBoundingClientRect();
    return [box.left + box.width / 2, box.top + box.height / 2];
  });
  assert.ok(Math.hypot(drawn[0] - projected[0], drawn[1] - projected[1]) < 1, { drawn, projected });
  await f.snapshot(label);
  await hover(outside);
  assert.equal(await mark().count(), 0);
  f.report.observations.push({ label, cssPxPerMm: scale, insideMm: 7 / scale, outsideMm: 9 / scale });
  return { scale, inside, outside };
}

await f.run(async () => {
  await f.newPage({ deviceScaleFactor: 2 });
  const file = join(output, 'clockwise-major.bcad'), replacement = join(output, 'same-id-without-arc.bcad');
  await writeFile(file, JSON.stringify(initial));
  await writeFile(replacement, JSON.stringify(plain));
  await f.openFile(file, 1);
  const opened = await f.doc();
  assert.deepEqual(opened.nodes, initial.nodes);
  await openSketch();
  const device = await f.page.locator('canvas.vp-canvas').evaluate(canvas => ({
    devicePixelRatio: devicePixelRatio, backingScale: canvas.width / canvas.clientWidth,
  }));
  assert.equal(device.devicePixelRatio, 2);
  assert.ok(Math.abs(device.backingScale - 2) < 0.02, device);
  f.report.observations.push({ label: 'desktop-scale', ...device });

  f.phase = 'compare 7 and 9 CSS px at two zooms';
  await arm();
  const first = await verifyReach('01-initial-zoom');
  const scales = [first.scale];
  for (let attempt = 0; attempt < 3 && scales.at(-1) > first.scale * 0.8; attempt++) {
    await hover((await radiusScreen()).projected);
    await f.page.mouse.wheel(0, 400);
    await f.page.waitForTimeout(350);
    scales.push((await radiusScreen()).scale);
  }
  assert.ok(scales.at(-1) <= first.scale * 0.8, scales);
  const zoomed = await verifyReach('02-zoomed');
  assert.ok(zoomed.scale <= 0.8 * first.scale);
  await f.page.keyboard.press('Meta+z');
  await guide().waitFor({ state: 'hidden' });
  await f.same(opened);
  await arm();
  await f.page.keyboard.press('l');
  await guide().waitFor({ state: 'hidden' });
  await f.tool('Rectangle', 'r');

  f.phase = 'consume an armed guide on grid fallback';
  await arm();
  await hover(zoomed.outside);
  assert.equal(await mark().count(), 0);
  await f.page.mouse.click(...zoomed.outside);
  await guide().waitFor({ state: 'hidden' });
  await f.page.keyboard.press('Escape');
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await f.same(opened);

  f.phase = 'place the clockwise major arc extension';
  await openSketch();
  await arm();
  const finalPointer = (await radiusScreen()).radial(7);
  await hover(finalPointer);
  await mark().waitFor({ timeout: 5000 });
  await f.page.mouse.click(...finalPointer);
  await guide().waitFor({ state: 'hidden' });
  await f.worldClick(farCorner);
  const placed = await f.finishSketch('03-clockwise-rectangle');
  assert.deepEqual(placed.doc.nodes[0].construction, [source]);
  assert.deepEqual(placed.doc.nodes[0].regions[0].map(segment => segment.start),
    [stored, [27, stored[1]], farCorner, [stored[0], 28]]);
  await f.undo();
  await f.same(opened);
  await f.redo();
  await f.same(placed.doc);
  await f.openExtrudeHud();
  const solid = await f.applyExtrude({ distance: 2, previous: placed.doc, label: '04-clockwise-solid' });
  const [native] = await f.inspect('native-clockwise', solid.doc);
  const volume = 2 * (25 + (27 - stored[0]) * (28 - stored[1]));
  assert.equal(native.valid, true);
  assert.ok(Math.abs(native.volume - volume) < 1e-8);
  assert.ok(Math.abs((await f.bodies()).bodies[0].volume - volume) < 1e-8);

  f.phase = 'replace the source document with the guide armed';
  await f.openFile(file, 1);
  await f.same(opened);
  await openSketch();
  await arm();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  assert.equal(await guide().count(), 1);
  await chooser.setFiles(replacement);
  await f.same(plain);
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await guide().waitFor({ state: 'hidden' });
  await openSketch();
  assert.equal(await extension().count(), 0);
  await hover((await radiusScreen()).radial(7));
  assert.equal(await mark().count(), 0);
  await f.snapshot('05-replacement');

  f.phase = 'start a new part with the guide armed';
  await f.page.keyboard.press('Escape');
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await f.openFile(file, 1);
  await f.same(opened);
  await openSketch();
  await arm();
  await button(f.page, 'New part').click();
  await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.ready();
  await guide().waitFor({ state: 'hidden' });
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await f.snapshot('06-new-part');
  f.report.observations.push({ label: 'clockwise-placement', candidate, stored, volumeMm3: volume, sourceNodeIdReused: 'n0' });
  assert.deepEqual(f.report.downloads, []);
});
