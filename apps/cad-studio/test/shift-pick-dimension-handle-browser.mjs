import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const baseline = process.argv.includes('--baseline');
const flow = await createFlow({
  name: 'shift-pick-dimension-handle', output: process.argv[2], envFrozen: 'D1248_SOURCE_FROZEN',
  qualification: 'Shift clicks can pick geometry beneath idle dimension handles. Drags and active precision are retained.',
  initialFiles: ['apps/cad-studio/src/viewport/viewportPointerInput.ts', 'apps/cad-studio/src/viewport/useCommandGizmos.ts',
    'apps/cad-studio/src/viewport/gizmo.ts', 'packages/barocss-cad-model/src/app/commands.ts'],
});
const model = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [
  { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [20, 20] },
  { id: 'n1', kind: 'extrude', height: 10, sketch: 0, made: { command: 'box', values: { w: 20, d: 20, h: 10, x: 0, y: 0, z: 0 } } },
], outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2 };
const width = () => flow.page.locator('.hud .field').filter({ hasText: /^Width/ }).locator('input').first();
const button = name => flow.page.getByRole('button', { name, exact: true });
const selection = () => flow.page.evaluate(() => window.__studioSelection);
const settle = () => flow.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
const pixel = point => flow.page.evaluate(point => window.__studioScreenOf(point), point);
async function view(name) {
  await button(name).click();
  await settle();
}
async function filter(text) {
  const toggle = button('Selection filter');
  for (let attempt = 0; attempt < 4; attempt++) {
    if ((await toggle.innerText()).includes(text)) return;
    await toggle.click();
  }
  assert.fail(text);
}
async function click(point, shift = false) {
  const at = await pixel(point);
  assert.ok(await flow.page.evaluate(at => document.elementFromPoint(...at)?.matches('canvas.vp-canvas'), at));
  if (shift) await flow.page.keyboard.down('Shift');
  try { await flow.page.mouse.click(...at); }
  finally { if (shift) await flow.page.keyboard.up('Shift'); }
  await settle();
}
async function drag(from, to, shift) {
  await flow.page.mouse.move(...from);
  if (shift) await flow.page.keyboard.down('Shift');
  await flow.page.mouse.down();
  try { await flow.page.mouse.move(...to, { steps: 8 }); }
  finally {
    await flow.page.mouse.up();
    if (shift) await flow.page.keyboard.up('Shift');
  }
}
async function waitActive(active) {
  await flow.page.waitForFunction(active => window.__studioSelection.active === active, active);
}

await flow.run(async () => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 800 }]) {
    await flow.newPage();
    await flow.page.setViewportSize(viewport);
    const [chooser] = await Promise.all([flow.page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles({ name: 'shift-box.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(model)) });
    await flow.same(model);
    if (await button('Ortho').getAttribute('aria-pressed') !== 'true') await button('Ortho').click();
    await flow.page.getByTitle('Frame all (F)', { exact: true }).click();
    const widthHandle = flow.page.locator('.gizmo-handle[data-handle="w"]');
    for (const kind of ['faces', 'edges']) {
      flow.phase = `${viewport.width} Shift click ${kind} beneath Width X`;
      const faces = kind === 'faces';
      await view(faces ? 'Front' : 'Top');
      await filter(faces ? 'Faces' : 'Edges');
      await click(faces ? [6, 0, 6] : [10, 0, 10]);
      const owned = (await selection()).selection[kind];
      assert.equal(owned.length, 1);
      if (faces) await view('Right');
      await widthHandle.waitFor();
      const target = faces ? [20, 10, 5] : [20, 10, 10];
      await click(target, true);
      if (baseline) {
        await width().waitFor();
        assert.deepEqual((await selection()).selection[kind], owned);
        await flow.snapshot(`${kind}-click-opens-editor-${viewport.width}`);
        await flow.page.keyboard.press('Escape');
        await waitActive(null);
        continue;
      }
      assert.equal((await selection()).active, null);
      const both = (await selection()).selection[kind];
      assert.equal(both.length, 2);
      assert.deepEqual(both[0], owned[0]);
      await click(target, true);
      assert.deepEqual((await selection()).selection[kind], owned);
      await flow.same(model);
      await flow.snapshot(`${kind}-toggle-${viewport.width}`);
    }
    if (baseline) continue;
    flow.phase = 'plain click opens width edit as before';
    await click([20, 10, 10]);
    await width().waitFor();
    assert.equal(await width().inputValue(), '20');
    await flow.page.keyboard.press('Escape');
    await waitActive(null);
    for (const shift of [false, true]) {
      flow.phase = 'deliberate width drag ' + (shift ? 'with Shift' : 'without Shift');
      const from = await pixel([20, 10, 10]), to = await pixel([23, 10, 10]);
      await drag(from, to, shift);
      await width().waitFor();
      assert.equal(await width().inputValue(), '23');
      const hud = flow.page.locator('.hud');
      await flow.same(model);
      if (!shift) {
        await flow.page.keyboard.press('Escape');
        await waitActive(null);
        await flow.same(model);
      } else {
        await hud.getByRole('button', { name: 'Apply', exact: true }).click();
        await flow.changed(model);
        const updated = await flow.doc();
        assert.deepEqual(updated.nodes[0].max, [23, 20]);
        assert.ok(Math.abs((await flow.bodies()).bodies[0].volume - 4600) < 1e-8);
        await flow.snapshot(`width-drag-applied-${viewport.width}`);
        await flow.undo();
        await flow.same(model);
        await flow.redo();
        await flow.same(updated);
        await flow.undo();
        await flow.same(model);
      }
    }

    flow.phase = 'active Move uses Shift precision';
    await filter('Bodies');
    await click([10, 10, 10]);
    await clickModelCommand(flow.page, 'Modify', 'Move');
    const arrow = flow.page.locator('.gizmo-arrow[data-gizmo="moveX"] polygon');
    await arrow.waitFor();
    const box = await arrow.boundingBox();
    const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
    const origin = await pixel([10, 10, 10]), precise = await pixel([10.4, 10, 10]);
    await drag([x, y], [x + precise[0] - origin[0], y], true);
    const value = flow.page.locator('.hud .field').filter({ hasText: 'ΔX' }).locator('input').first();
    assert.equal(await value.inputValue(), '0.4');
    await flow.snapshot(`move-shift-precision-${viewport.width}`);
    await flow.page.keyboard.press('Escape');
    await waitActive(null);
    await flow.same(model);
  }
  if (baseline) throw Error('Shift clicks over idle Width X open feature edit before additive picking.');
});
