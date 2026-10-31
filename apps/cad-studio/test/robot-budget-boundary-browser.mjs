// D402: one existing budget-exhaustion path, with shared Studio plumbing and no downloads.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const f = await createFlow({ name: 'robot-budget-boundary', envFrozen: 'ROBOT_BUDGET_BOUNDARY_SOURCE_FROZEN', output: process.argv[2], qualification: 'D402_ROBOT_BUDGET_BOUNDARY',
  initialFiles: ['apps/cad-studio/test/robot-budget-boundary-browser.mjs', 'apps/cad-studio/test/fixtures/robot-sweep-budget.bcad', 'packages/barocss-cad-model/src/robot/verbs.ts', 'packages/barocss-cad-model/src/robot/ccd.ts', 'packages/barocss-cad-model/src/robot/sweep.ts', 'apps/library-docs/docs/studio/robots.md'],
  requiredFrozen: ['apps/cad-studio/src/robot/RobotInspector.tsx', 'apps/cad-studio/src/App.tsx', 'packages/barocss-cad-model/src/robot/verbs.ts'],
  snapshotExtra: () => ({ pathCheck: document.querySelector('[aria-label="Path check"]')?.textContent, contactLinks: window.__studioContactLinks?.() }),
  limits: ['Budget scope is documented from the current loops; no geometry or API implementation changed.', 'Existing D367 numeric tests, real-contact check and saved-motion checks are not rerun.', 'Cancellation/late-result is not applicable to these synchronous Studio sweep calls. Async chat/transport cancellation and stale-result coverage are NOT_RUN.', 'No Save, export, download or paid live calls.'] });

async function pose(degrees) {
  const input = f.page.getByLabel('Joint base~a pose (degree)', { exact: true });
  await input.fill(String(degrees)); await input.press('Enter'); await f.page.waitForTimeout(250);
  assert.equal(Number(await input.inputValue()), degrees);
}
await f.run(async () => {
  await f.newPage(); f.phase = 'Open robot';
  await f.openFile(join(f.app, 'test/fixtures/robot-sweep-budget.bcad'), 4);
  await f.page.waitForFunction(() => window.__studioDoc?.instances?.some(i => i.id === 'wall') && window.__studioInstanceBounds?.()?.length === 4, null, { timeout: 60000 });
  await f.page.locator('aside[aria-label="Joints"]').waitFor();
  const original = await f.doc(); assert.deepEqual(original.robot.motions.map(m => m.name), ['graze', 'collide']);
  await f.page.getByRole('button', { name: 'Iso', exact: true }).click(); await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  f.phase = 'waypoint and Check path'; await pose(-22.918311805);
  await f.page.getByRole('button', { name: 'Add waypoint', exact: true }).click(); await pose(22.918311805);
  const check = f.page.getByRole('button', { name: 'Check path', exact: true }); assert.equal(await check.isEnabled(), true); await check.click();
  await f.page.waitForFunction(() => /^Not certified/.test(document.querySelector('[aria-label="Path check"]')?.textContent ?? ''), null, { timeout: 60000 });
  const state = await f.snapshot('01-not-certified');
  assert.match(state.pathCheck, /^Not certified: the sweep ran out of its sample budget/); assert.doesNotMatch(state.pathCheck, /^(Contact|Clear)/);
  assert.deepEqual(state.contactLinks, []); assert.equal(await f.page.locator('[aria-label="Motion contact"]').count(), 0);
  await f.same(original); assert.deepEqual(f.report.downloads, []);
  f.report.observations.push({ pathCheck: state.pathCheck, contactLinks: state.contactLinks, documentUnchanged: true, synchronousStudioCancellation: 'NOT_APPLICABLE', asyncChatTransport: 'NOT_RUN' });
});
