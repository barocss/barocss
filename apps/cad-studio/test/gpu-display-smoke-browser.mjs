// D401: actual WebGPU selection, display modes, isolation and clearance. No downloads.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const f = await createFlow({ name: 'gpu-display-smoke', envFrozen: 'GPU_DISPLAY_SOURCE_FROZEN', output: process.argv[2], qualification: 'D401_GPU_TEST_REPAIR',
  snapshotExtra: () => ({ frameCosts: window.__studioFrameCost?.(), instanceBounds: window.__studioInstanceBounds?.() }),
  initialFiles: ['apps/cad-studio/test/gpu-display-smoke-browser.mjs', 'apps/cad-studio/test/fixtures/clearance-states.bcad', 'packages/barocss-gpu/tests/cad-clearance-gpu.test.mjs', 'packages/barocss-gpu/tests/cad-gpu-display-contract.test.mjs', 'packages/barocss-gpu/tests/cad-instance-display-diagnostics.test.mjs'],
  requiredFrozen: ['apps/cad-studio/src/viewport/gpuRenderer.ts', 'apps/cad-studio/src/ui/ViewDisplayControls.tsx'],
  limits: ['Test fixtures and diagnostic tests changed; product code did not change.', 'One WebGPU assembly is checked; WebGL2, broad GPU suites, Save and exports are not run.', 'Images require visual review; frame costs verify actual renderer modes and instance draws.'] });
await f.run(async () => {
  await f.newPage(); f.phase = 'Open assembly'; await f.openFile(join(f.app, 'test/fixtures/clearance-states.bcad'), 2);
  await f.page.waitForFunction(() => window.__studioDoc?.instances?.length === 8 && window.__studioInstanceBounds?.()?.length === 8, null, { timeout: 60000 });
  const original = await f.doc();
  await f.page.getByRole('button', { name: 'Iso', exact: true }).click(); await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await f.page.evaluate(() => window.__studioFrameCost(true));
  await f.page.waitForFunction(() => (window.__studioFrameCost()['shaded-with-edges']?.bodies.length ?? 0) >= 10, null, { timeout: 60000 });
  await f.page.locator('.ol.instance:not(.nested)').filter({ hasText: 'Touch A' }).first().click();
  await f.page.getByRole('complementary', { name: 'Instance', exact: true }).waitFor();
  await f.page.getByRole('button', { name: 'Display and previews', exact: true }).click();
  const select = f.page.getByLabel('CAD display mode', { exact: true }); await select.waitFor();
  f.phase = 'selected instance in five modes';
  for (const mode of ['shaded-with-edges', 'hidden-lines-removed', 'hidden-lines-dashed', 'wireframe', 'x-ray']) {
    await select.selectOption(mode);
    await f.page.waitForFunction(mode => document.querySelector('.viewport')?.dataset.displayModeEffective === mode && window.__studioFrameCost()[mode]?.bodies.length >= 10, mode, { timeout: 15000 });
    const cost = await f.page.evaluate(mode => window.__studioFrameCost()[mode], mode);
    assert.equal(cost.renderer, 'webgpu'); assert.equal(cost.mode, mode); assert.ok(cost.bodies.find(b => b.key.startsWith('i1/'))?.draws > 0);
    f.report.observations.push({ mode, cost }); await f.snapshot(`01-selected-${mode}`);
  }
  await select.selectOption('shaded-with-edges');
  f.phase = 'isolate, clear selection, restore';
  await f.page.getByRole('button', { name: 'Isolate selection', exact: true }).click();
  const restore = f.page.getByRole('button', { name: 'Restore view', exact: true }); await restore.waitFor();
  await f.page.keyboard.press('Escape'); await f.page.getByRole('complementary', { name: 'Instance', exact: true }).waitFor({ state: 'hidden' });
  assert.equal(await restore.isEnabled(), true); await f.snapshot('02-isolated-empty-selection'); await restore.click();
  await f.page.getByRole('button', { name: 'Isolate selection', exact: true }).waitFor();
  f.phase = 'clearance on and off'; const clearance = f.page.locator('[aria-label="Preview: Clearance"]'); await clearance.click();
  await f.page.waitForFunction(() => window.__studioClearance?.()?.stage === 'ready', null, { timeout: 120000 });
  const state = await f.page.evaluate(() => { const d = window.__studioClearance(); return { stage: d.stage, error: d.error, pairs: d.pairs.map(p => p.state), overlays: [...new Set(d.overlays.map(o => o.state))].sort() }; });
  assert.equal(state.error, undefined); assert.deepEqual(state.pairs, ['designed', 'touching', 'overlap', 'near', 'clear']);
  assert.deepEqual(state.overlays, ['designed', 'near', 'overlap', 'touching']); f.report.observations.push({ clearance: state }); await f.snapshot('03-clearance');
  await clearance.click(); await f.page.waitForFunction(() => !window.__studioClearance?.(), null, { timeout: 15000 });
  await f.snapshot('04-clearance-cleared'); await f.same(original); assert.deepEqual(f.report.downloads, []);
});
