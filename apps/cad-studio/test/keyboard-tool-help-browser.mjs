import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const baseline = process.argv.includes('--baseline');
const f = await createFlow({
  name: 'keyboard-tool-help', output: process.argv[2], envFrozen: 'D1250_SOURCE_FROZEN',
  qualification: 'Expose focused Sketch and Drawing tool help without changing the document.',
  initialFiles: ['apps/cad-studio/src/ui/Tooltip.tsx', 'apps/cad-studio/src/ui/DrawingWorkspace.tsx',
    'apps/cad-studio/src/ui/ModelTools.tsx', 'apps/cad-studio/src/ui/ShortcutHelp.tsx'],
});
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const tooltip = () => f.page.locator('.tooltip');
async function description(control, key, hint) {
  const active = await control.evaluate(element => document.activeElement === element);
  assert.ok(active);
  if (baseline) {
    assert.equal(await control.getAttribute('aria-describedby'), null);
    assert.equal(await tooltip().count(), 0);
    return;
  }
  await tooltip().getByText(hint, { exact: false }).waitFor();
  assert.ok((await tooltip().textContent()).includes(key));
  const id = await control.getAttribute('aria-describedby');
  assert.ok(id);
  assert.ok(await f.page.evaluate(([id, hint]) => document.getElementById(id)?.textContent.includes(hint), [id, hint]));
}
async function point(x, y) {
  const hit = await f.page.evaluate(([x, y]) => window.__studioDrawingAt('top', x, y), [x, y]);
  assert.ok(await f.page.evaluate(p => !!document.elementFromPoint(p.x, p.y)?.closest('svg[aria-label="Drawing sheet"]'), hit));
  await f.page.mouse.click(hit.x, hit.y);
}
await f.run(async () => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 800 }]) {
    await f.newPage();
    await f.page.setViewportSize(viewport);
    const original = await f.doc();
    const mode = f.page.getByRole('group', { name: 'Mode', exact: true });
    f.phase = 'Sketch rectangle rule by keyboard';
    await button('Sketch', mode).click();
    await f.sketchPanel().waitFor();
    const sketch = f.page.getByRole('navigation', { name: 'Tools', exact: true });
    const rectangle = button('Rectangle', sketch);
    await f.page.mouse.move(viewport.width / 2, viewport.height / 2);
    for (let step = 0; step < 80 && !await rectangle.evaluate(el => document.activeElement === el); step++)
      await f.page.keyboard.press('Tab');
    await description(rectangle, 'R', 'Click two corners');
    if (!baseline) assert.equal(await rectangle.getAttribute('aria-pressed'), 'true');
    await f.snapshot('sketch-focus-' + viewport.width);
    await f.page.keyboard.press('Escape');
    await f.sketchPanel().waitFor({ state: 'hidden' });
    await f.same(original);

    f.phase = 'Drawing tool descriptions, dialog and restoration';
    await button('Drawing', mode).click();
    await f.page.getByLabel('Drawing sheet', { exact: true }).waitFor();
    const drawing = f.page.getByRole('navigation', { name: 'Drawing tools', exact: true });
    const select = button('Select', drawing), linear = button('Linear dimension', drawing), diameter = button('Diameter', drawing);
    await select.focus();
    await f.page.keyboard.press('Tab');
    await description(linear, 'D', 'Click two points');
    await f.page.keyboard.press('Tab');
    await description(diameter, 'O', 'Click a circle');
    await f.page.keyboard.press('?');
    const help = f.page.getByRole('dialog', { name: 'Drawing keyboard shortcuts', exact: true });
    if (baseline) {
      assert.equal(await help.count(), 0);
      await f.snapshot('drawing-without-help-' + viewport.width);
      continue;
    }
    await help.waitFor();
    const diameterRow = help.locator('.help-row').filter({ hasText: 'Diameter' });
    assert.equal(await diameterRow.locator('kbd').textContent(), 'O');
    await f.snapshot('drawing-help-' + viewport.width);
    await f.page.keyboard.press('Escape');
    await help.waitFor({ state: 'hidden' });
    assert.ok(await diameter.evaluate(el => document.activeElement === el));
    await f.page.keyboard.press('Enter');
    assert.equal(await diameter.getAttribute('aria-pressed'), 'true');
    await f.page.keyboard.press('d');
    assert.equal(await linear.getAttribute('aria-pressed'), 'true');
    await point(0, 0);
    await f.page.keyboard.press('Escape');
    assert.equal(await linear.getAttribute('aria-pressed'), 'true');
    await f.page.keyboard.press('Escape');
    assert.equal(await select.getAttribute('aria-pressed'), 'true');
    await f.page.keyboard.press('o');
    assert.equal(await diameter.getAttribute('aria-pressed'), 'true');
    await f.same(original);
  }
  if (baseline) throw Error('Focused buttons provide no help, and Drawing has no keyboard help dialog.');
});
