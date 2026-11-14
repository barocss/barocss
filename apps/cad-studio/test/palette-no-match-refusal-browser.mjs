import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const baseline = process.argv.includes('--baseline');
const f = await createFlow({
  name: 'palette-no-match-refusal', output: process.argv[2], envFrozen: 'D1251_SOURCE_FROZEN',
  qualification: 'Keep a command search open when the chosen command cannot run.',
  initialFiles: ['apps/cad-studio/src/ui/Palette.tsx', 'apps/cad-studio/src/ui/paletteList.ts',
    'apps/cad-studio/src/ui/paletteRank.ts', 'apps/cad-studio/src/app/filletFamily.ts',
    'apps/cad-studio/src/components/ui/command.tsx', 'packages/barocss-cad-model/src/app/commands.ts'],
});
const dialog = () => f.page.getByRole('dialog', { name: 'Command palette', exact: true });
const input = () => dialog().getByRole('combobox');
const button = name => f.page.getByRole('button', { name, exact: true });
const history = () => f.page.evaluate(() => ['Undo', 'Redo'].map(name =>
  !document.querySelector(`button[aria-label="${name}"]`).disabled));
const row = name => dialog().getByRole('option').filter({ has: f.page.locator('.pl-label', { hasText: new RegExp('^' + name + '$') }) }).first();

await f.run(async () => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 800 }]) {
    await f.newPage();
    await f.page.setViewportSize(viewport);
    await button('New part').click();
    await f.ready();
    const doc = await f.doc();
    assert.equal(doc.nodes.length, 0);
    const originalHistory = await history();
    await f.page.locator('canvas.vp-canvas').click({ position: { x: 300, y: 220 } });
    await f.page.keyboard.press('Space');
    await input().waitFor();
    assert.ok(await dialog().getByRole('option').count() > 1);
    f.phase = 'no matching command at ' + viewport.width;
    await input().fill('zznoCADcommandzz');
    assert.equal(await dialog().getByRole('option').count(), 0);
    const noResults = dialog().getByText('No matching commands.', { exact: true });
    assert.equal(await noResults.count(), baseline ? 0 : 1);
    await f.snapshot('no-results-' + viewport.width);
    await input().fill('');
    assert.ok(await dialog().getByRole('option').count() > 1);
    assert.equal(await noResults.count(), 0);
    f.phase = 'ineligible Hole from keyboard at ' + viewport.width;
    await input().fill('Hole');
    await row('Hole').getByText('Select the flat face where the hole goes in.', { exact: true }).waitFor();
    await input().press('Enter');
    if (baseline) {
      await dialog().waitFor({ state: 'hidden' });
      await f.waitToast(/Select the flat face where the hole goes in/);
      await f.same(doc);
      await f.snapshot('lost-query-' + viewport.width);
      continue;
    }
    assert.equal(await input().inputValue(), 'Hole');
    assert.ok(await input().evaluate(el => document.activeElement === el));
    assert.equal(await dialog().getByText('Select the flat face where the hole goes in.', { exact: true }).count(), 1);
    assert.equal(await f.page.locator('.toast').count(), 0);
    await f.same(doc);
    assert.deepEqual(await history(), originalHistory);
    assert.equal(await f.page.evaluate(() => window.__studioSelection.active), null);
    await f.snapshot('preserved-refusal-' + viewport.width);

    f.phase = 'Fillet aliases and Box at ' + viewport.width;
    for (const [query, label] of [['fillet', 'Edge'], ['face-fillet', 'Face'], ['full-round', 'Full round']]) {
      await input().fill(query);
      const aliases = dialog().getByRole('option').filter({ has: f.page.locator('.pl-label', { hasText: /^Fillet$/ }) });
      assert.equal(await aliases.count(), 1, query);
      assert.equal(await aliases.locator('.muted').textContent(), label, query);
    }
    await input().fill('Box');
    assert.equal(await row('Box').locator('.kbd').textContent(), 'B');
    await input().press('Enter');
    const hud = f.page.getByRole('dialog', { name: 'Box', exact: true });
    await hud.waitFor();
    assert.equal(await f.page.evaluate(() => window.__studioSelection.active), 'box');
    await f.page.keyboard.press('Escape');
    await hud.waitFor({ state: 'hidden' });
    await f.same(doc);
    await f.page.locator('canvas.vp-canvas').click({ position: { x: 300, y: 220 } });
    await f.page.keyboard.press('Space');
    await input().fill('Hole');
    await input().press('Escape');
    await dialog().waitFor({ state: 'hidden' });
    assert.deepEqual(await history(), originalHistory);
    await f.same(doc);
  }
  if (baseline) throw Error('An empty result is blank and unavailable Enter discards the search.');
});
