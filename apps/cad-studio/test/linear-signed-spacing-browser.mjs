import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const pins = ['apps/cad-studio/src/viewport/useCommandGizmos.ts', 'apps/cad-studio/src/state/useCommandPreview.ts',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts', 'packages/barocss-cad-model/src/app/commands.ts'];
const countDrag = process.argv[3] === '--count';
const f = await createFlow({
  name: 'linear-signed-spacing', output: process.argv[2], envFrozen: countDrag ? 'D1194_SOURCE_FROZEN' : 'D1193_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: countDrag ? 'One signed spacing interval on the Count arrow adds one separate body.'
    : 'Drag a signed Linear Pattern spacing through zero and check the separate bodies.',
  limits: ['Desktop WebGPU, X direction with separate bodies, one dragged handle.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkBrep, massPropertiesOf } from '@barocss/cad';
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { partSnapshot } from '@barocss/cad-model/engine/part';
if (process.argv[3] === '"seed"') {
  const doc = withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [50, 10], max: [54, 16] });
  console.log(JSON.stringify(withNode(doc, { kind: 'extrude', sketch: 0, height: 8 })));
} else {
  const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  console.log(JSON.stringify(partSnapshot(doc).outputs.map(output => ({
    valid: checkBrep(output.brep, { strict: true }).valid,
    volume: massPropertiesOf(output).volume, centroid: massPropertiesOf(output).centroid,
  }))));
}
`,
});
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} vs ${expected}`);

async function open(doc) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'signed-spacing.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
}

async function handleTip(key) {
  const locator = f.page.locator(`g.gizmo-handle[data-handle="${key}"]`);
  await locator.waitFor();
  return locator.evaluate(group => {
    const head = group.querySelector('polygon'), svg = group.ownerSVGElement;
    const point = head?.points.getItem(0), screen = svg?.getScreenCTM();
    if (!point || !screen) return null;
    const tip = new DOMPoint(point.x, point.y).matrixTransform(screen);
    return [tip.x, tip.y];
  });
}

await f.run(async () => {
  const seed = await f.inspect('seed', {}, 'seed');
  await f.newPage();
  await open(seed);
  await button('Top', f.page.getByRole('group', { name: 'Views', exact: true })).click();
  if (await button('Ortho').getAttribute('aria-pressed') !== 'true') await button('Ortho').click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  const canvas = f.page.locator('canvas.vp-canvas');
  const frame = await canvas.boundingBox();
  assert.ok(frame);
  await f.page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2);
  await f.page.mouse.wheel(0, 1650);
  await f.page.waitForFunction(() => {
    const a = window.__studioScreenOf([52,13,4]), b = window.__studioScreenOf([53,13,4]);
    return b[0] - a[0] < 10;
  });
  const stock = await f.page.evaluate(() => window.__studioScreenOf([52, 13, 8]));
  assert.ok(stock?.length === 2);
  await f.page.mouse.click(...stock);
  await f.page.waitForFunction(() => window.__studioSelection.selection.faces.length
    || window.__studioSelection.selection.bodies.length);
  await clickModelCommand(f.page, 'Pattern', 'Linear pattern');
  const hud = f.page.getByRole('dialog', { name: 'Linear pattern', exact: true });
  await hud.getByLabel('Result', { exact: true }).selectOption('separate');
  const spacing = hud.getByLabel('Spacing', { exact: true });
  await spacing.fill('-16');
  await hud.locator('.status.ok').waitFor();
  await f.same(seed);
  await f.snapshot('minus-16-start');

  // The drag uses the projection of one native millimetre along X.
  const px = await f.page.evaluate(() => {
    const a = window.__studioScreenOf([52,13,4]), b = window.__studioScreenOf([53,13,4]);
    return (b[0] - a[0]);
  });
  assert.ok(px > 1 && px < 120);
  const head = await handleTip(countDrag ? 'count' : 'spacing');
  assert.ok(head);
  assert.ok(await f.page.evaluate(point => Boolean(document.elementFromPoint(...point)?.closest('canvas.vp-canvas')), head), JSON.stringify({ head, px }));
  f.report.observations.push({ head, pixelsPerMM: px });
  await f.page.mouse.move(...head);
  await f.page.mouse.down();
  const move = async delta => { await f.page.mouse.move(head[0] + delta * px, head[1]); };
  if (countDrag) {
    const count = hud.getByLabel('Count', { exact: true });
    try {
      f.phase = 'Move inward and outward by one signed copy interval';
      for (const [delta, wanted] of [[16, 2], [-16, 4]]) {
        await move(delta);
        await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview');
        await f.snapshot(`count-${wanted}-drag`);
        assert.equal(Number(await count.inputValue()), wanted, 'A signed interval must change Count by exactly one');
        assert.equal(Number(await spacing.inputValue()), -16);
        await f.same(seed);
      }
    } finally { await f.page.mouse.up(); }
    await hud.locator('.status.ok').waitFor();
    assert.equal(Number(await count.inputValue()), 4);
  } else {
    try {
      f.phase = 'Drag negative spacing further negative';
      await move(-8);
      await f.page.waitForFunction(() => Number(document.querySelector('.hud [aria-label="Spacing"]').value) !== -16);
      await hud.locator('.status.ok').waitFor();
      await f.snapshot('minus-24-drag');
      assert.equal(Number(await spacing.inputValue()), -24, 'A left drag from -16 must not flip spacing');

      f.phase = 'Hit zero and recover across it without releasing';
      await move(16);
      await hud.locator('.status.error').waitFor();
      assert.match(await hud.getByRole('status').innerText(), /nonzero/i);
      assert.equal(await button('Apply', hud).isEnabled(), false);
      await f.same(seed);
      await f.snapshot('zero-spacing-refused');

      await move(24);
      await hud.locator('.status.ok').waitFor();
      assert.equal(Number(await spacing.inputValue()), 8);
      await f.snapshot('plus-8-recovered');
      await move(-4);
      await hud.locator('.status.ok').waitFor();
      assert.equal(Number(await spacing.inputValue()), -20);
      await f.same(seed);
      await f.snapshot('minus-20-recovered');
    } finally { await f.page.mouse.up(); }
    await hud.locator('.status.ok').waitFor();
    assert.equal(Number(await spacing.inputValue()), -20);
  }
  await button('Apply', hud).click();
  await f.changed(seed);
  const accepted = (await f.snapshot('signed-spacing-applied')).doc;
  const native = await f.inspect('signed-native', accepted);
  const centers = countDrag ? [4, 20, 36, 52] : [12, 32, 52];
  assert.equal(native.length, centers.length);
  const sorted = native.toSorted((a,b) => a.centroid[0] - b.centroid[0]);
  for (const [i, body] of sorted.entries()) {
    assert.ok(body.valid);
    near(body.volume, 192);
    near(body.centroid[0], centers[i]);
    near(body.centroid[1], 13);
    near(body.centroid[2], 4);
  }
  f.report.observations.push({ native: sorted });
  await f.undo();
  await f.same(seed);
  await f.redo();
  await f.same(accepted);
});
