import assert from 'node:assert/strict';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2), repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(mode === '--baseline' || mode === '--fixed');
const fixed = mode === '--fixed';
const pins = ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/ToolsTray.tsx', 'apps/cad-studio/src/ui/TemplatePicker.tsx',
  'apps/cad-studio/src/components/ui/dropdown-menu.tsx', 'apps/cad-studio/src/components/ui/tool-button.tsx',
  'apps/cad-studio/src/files/StepExportPanel.tsx', 'apps/cad-studio/src/styles.css', 'apps/cad-studio/test/flow-helper.mjs'];
const f = await createFlow({ name: 'more-tools-keyboard', envFrozen: 'D666_SOURCE_FROZEN', output,
  initialFiles: pins, requiredFrozen: pins, qualification: 'Keyboard navigation through More tools and its public commands' });
const menu = () => f.page.getByRole('menu', { name: 'More tools', exact: true });
const trigger = () => f.page.getByRole('button', { name: 'More tools', exact: true });
const focus = () => f.page.evaluate(() => ({ role: document.activeElement?.getAttribute('role'),
  label: document.activeElement?.getAttribute('aria-label'), tag: document.activeElement?.tagName }));
const settle = () => f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
const waitFocus = label => f.page.waitForFunction(label => document.activeElement?.getAttribute('aria-label') === label, label, { timeout: 5000 });
const menuTools = () => menu().evaluate(element => [...element.querySelectorAll('button.tool')].filter(button => !button.hidden)
  .map(button => ({ label: button.getAttribute('aria-label'), disabled: button.disabled || button.getAttribute('aria-disabled') === 'true' })));

async function open() {
  await trigger().focus();
  await f.page.keyboard.press('Enter');
  await menu().waitFor();
  await settle();
}
async function close() {
  await f.page.keyboard.press('Escape');
  await menu().waitFor({ state: 'hidden' });
  await settle();
}
async function choose(label) {
  const enabled = (await menuTools()).filter(item => !item.disabled).map(item => item.label);
  assert.ok(enabled.includes(label), label + ' is in More tools');
  for (let steps = 0; steps < enabled.length; steps++) {
    if ((await focus()).label === label) return;
    await f.page.keyboard.press('ArrowDown');
    await settle();
  }
  assert.fail('ArrowDown did not reach ' + label);
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin, newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  for (const [width, height] of [[1280, 720], [1024, 768]]) {
    const size = width + 'x' + height;
    f.phase = 'open More tools from the keyboard at ' + size;
    await f.newPage();
    await f.page.setViewportSize({ width, height });
    await f.page.locator('.topbar').getByRole('button', { name: 'Chat', exact: true }).click();
    await f.page.locator('.chat-col.open').waitFor();
    await trigger().waitFor();
    const before = await f.doc();
    await open();
    const first = await focus(), all = await menuTools(), enabled = all.filter(item => !item.disabled).map(item => item.label);
    assert.ok(enabled.includes('Export STEP') && enabled.includes('Insert part'));
    await f.snapshot(size + '-opened');
    if (!fixed) {
      assert.equal(first.role, 'menu');
      await f.page.keyboard.press('ArrowDown');
      const afterArrow = await focus();
      await f.page.keyboard.press('Tab');
      const afterTab = await focus();
      assert.deepEqual(afterArrow, first);
      assert.deepEqual(afterTab, first);
      await close();
      f.report.observations.push({ size, enabled, disabled: all.filter(item => item.disabled).map(item => item.label),
        first, afterArrow, afterTab, afterEscape: await focus() });
      continue;
    }

    assert.deepEqual([first.role, first.label], ['menuitem', enabled[0]]);
    const traversed = [first.label];
    for (const label of enabled.slice(1)) {
      await f.page.keyboard.press('ArrowDown');
      await waitFocus(label);
      traversed.push(label);
    }
    await f.page.keyboard.press('ArrowUp');
    await waitFocus(enabled.at(-2));
    await close();
    assert.equal(await trigger().evaluate(element => document.activeElement === element), true);

    f.phase = 'open STEP options and Insert part from More tools at ' + size;
    await open();
    await choose('Export STEP');
    await f.page.keyboard.press('Enter');
    await menu().waitFor({ state: 'hidden' });
    const step = f.page.getByRole('region', { name: 'STEP export', exact: true });
    await step.getByRole('button', { name: 'Export', exact: true }).waitFor();
    await step.getByRole('button', { name: 'Cancel', exact: true }).click();
    await step.waitFor({ state: 'hidden' });
    await open();
    await choose('Insert part');
    const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), f.page.keyboard.press('Enter')]);
    assert.equal(await chooser.element().getAttribute('aria-label'), 'Part file');
    await chooser.setFiles([]);
    await menu().waitFor({ state: 'hidden' });
    await f.same(before);
    if (width === 1280) {
      await trigger().click();
      await menu().getByRole('menuitem', { name: 'Export STEP', exact: true }).click();
      await menu().waitFor({ state: 'hidden' });
      await step.getByRole('button', { name: 'Cancel', exact: true }).click();
      await step.waitFor({ state: 'hidden' });
      await f.same(before);
    }
    await f.snapshot(size + '-unchanged-after-actions');
    f.report.observations.push({ size, traversed, firstEnabled: first.label, escapeReturnedFocus: true,
      stepOptionsOpened: true, partFileChooserOpened: true, workingDocumentUnchanged: true });
  }
  if (!fixed) return;

  f.phase = 'navigate around disabled tools and enter Templates in the widened chat layout';
  const resizer = f.page.getByRole('separator', { name: 'Resize chat', exact: true });
  const divider = await resizer.boundingBox();
  assert.ok(divider);
  const x = divider.x + divider.width / 2, y = divider.y + 100;
  await f.page.mouse.move(x, y);
  await f.page.mouse.down();
  await f.page.mouse.move(x + 165, y, { steps: 8 });
  await f.page.mouse.up();
  await settle();
  await open();
  const listed = await menuTools(), enabled = listed.filter(item => !item.disabled);
  const disabled = listed.filter(item => item.disabled).map(item => item.label);
  assert.ok(disabled.length > 0);
  assert.equal((await focus()).label, enabled[0].label);
  await choose('New from a template');
  await f.page.keyboard.press('Enter');
  const templates = f.page.getByRole('menu', { name: 'Templates', exact: true });
  const choices = templates.getByRole('menuitem');
  await choices.first().waitFor();
  assert.ok(await choices.count() > 1);
  assert.equal(await choices.first().evaluate(item => document.activeElement === item), true);
  await f.page.keyboard.press('Tab');
  assert.equal(await choices.nth(1).evaluate(item => document.activeElement === item), true);
  await f.snapshot('1024x768-keyboard-templates');
  await close();
  assert.equal(await trigger().evaluate(element => document.activeElement === element), true);
  await open();
  assert.equal(await templates.count(), 0);
  await close();
  f.report.observations.push({ size: '1024x768', widerChat: true, disabled, templatesOpened: true, tabReachedSecondTemplate: true,
    escapeReturnedFocus: true, templatesClosedOnReopen: true });
});
