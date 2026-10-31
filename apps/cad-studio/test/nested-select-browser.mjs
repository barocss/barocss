// Roadmap 10 ②c: selecting a part inside a sub-assembly, in the actual Studio. Fixture apps/cad-studio/test/fixtures/nested-mate.bcad: a base plate, "Sub" (Block A and
// Block B, 10 mm cubes) and "Pin". Real clicks: the outliner's caret on Sub, the nested row Block B, then Sub itself; real keys Delete and Escape.
// Checks: the nested rows appear under Sub; selecting Block B shows the read-only Nested part card (Sub › Block B, its path, placement in Sub, volume 1000 mm³) and no
// Instance panel, no gizmo, no mate panel; Delete with Block B selected changes nothing; selecting Sub shows its Instance panel again. Screenshots of Block B selected and of
// Sub selected are taken for the root to review the highlight (only Block B's edges lit, then both blocks). The document never changes.
// Root must freeze all sources first. Run from apps/cad-studio:
//   NESTED_SELECT_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/nested-select-browser.mjs /absolute/artifacts
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const fixture = join(import.meta.dirname, 'fixtures', 'nested-mate.bcad');
const f = await createFlow({ name: 'nested-select', envFrozen: 'NESTED_SELECT_SOURCE_FROZEN', output: process.argv[2], qualification: 'NESTED_SELECTION',
  limits: ['The highlight is judged from screenshots by the root (no pixel oracle).', 'Viewport clicks on a sub-assembly still select the host (unchanged in v1).'],
  initialFiles: ['apps/cad-studio/test/nested-select-browser.mjs', 'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/test/fixtures/nested-mate.bcad', 'apps/cad-studio/src/ui/OutlinerInstances.tsx',
    'apps/cad-studio/src/ui/NestedPartPanel.tsx', 'apps/cad-studio/src/assembly/nestedSelection.ts', 'apps/cad-studio/src/viewport/instanceSelection.ts', 'packages/barocss-cad-model/src/engine/occurrences.ts'],
  requiredFrozen: ['apps/cad-studio/src/ui/NestedPartPanel.tsx'] });

await f.run(async () => {
  await f.newPage(); await f.openFile(fixture, 2); const original = await f.doc(); await f.snapshot('01-opened');

  f.phase = 'expand Sub';
  assert.equal(await f.page.locator('.ol.instance.nested').count(), 0, 'nested rows hidden at first');
  await f.page.getByRole('button', { name: 'Show the parts of Sub', exact: true }).click();
  const rows = await f.page.evaluate(() => [...document.querySelectorAll('.ol.instance.nested')].map(r => ({ path: r.getAttribute('data-path'), label: r.getAttribute('aria-label'), text: r.textContent.trim() })));
  f.report.observations.push({ rows }); assert.deepEqual(rows.map(r => r.path), ['sub1/p1', 'sub1/p2']);

  f.phase = 'select Block B';
  await f.page.locator('.ol.instance.nested[data-path="sub1/p2"]').click();
  const card = f.page.getByRole('complementary', { name: 'Nested part', exact: true }); await card.waitFor();
  const text = await card.textContent(); f.report.observations.push({ card: text });
  assert.match(text, /Sub › Block B/); assert.match(text, /sub1\/p2/); assert.match(text, /1000/);
  assert.equal(await f.page.getByRole('complementary', { name: 'Instance', exact: true }).count(), 0, 'no Instance panel for a nested part');
  assert.equal(await f.page.locator('g.gizmo-arrow, g.gizmo-handle').count(), 0, 'no gizmo for a nested part');
  assert.equal(await f.page.locator('[aria-label="Mates"]').count(), 0, 'no mate panel for a nested part');
  await f.snapshot('02-block-b-selected');

  f.phase = 'Delete with a nested selection';
  await f.page.evaluate(() => document.activeElement?.blur()); await f.page.keyboard.press('Delete'); await new Promise(r => setTimeout(r, 400));
  await f.same(original); await card.waitFor();

  f.phase = 'select Sub';
  await f.page.locator('.ol.instance:not(.nested)').filter({ hasText: 'Sub' }).first().click();
  await f.page.getByRole('complementary', { name: 'Instance', exact: true }).waitFor();
  assert.equal(await card.count(), 0, 'the nested card goes with the host selected');
  await f.snapshot('03-sub-selected');

  f.phase = 'Escape'; await f.page.keyboard.press('Escape'); await new Promise(r => setTimeout(r, 300)); await f.same(original);
});
