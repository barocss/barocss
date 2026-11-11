// Roadmap 21: measure the Model tool rail and each expanded group at desktop window sizes.
// TOOL_SIDEBAR_EXPECT=grid also checks inventory, fit, hover, command start, and notice placement.
// Root must freeze all sources first. Run from apps/cad-studio:
//   TOOL_SIDEBAR_SOURCE_FROZEN=1 TOOL_SIDEBAR_EXPECT=grid PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/tool-sidebar-browser.mjs /absolute/artifacts
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';
import { modelGroupNames, modelRail, openModelGroup } from './model-rail-helper.mjs';

const grid = process.env.TOOL_SIDEBAR_EXPECT === 'grid';
const f = await createFlow({ name: 'tool-sidebar', envFrozen: 'TOOL_SIDEBAR_SOURCE_FROZEN', output: process.argv[2], qualification: grid ? 'TOOL_SIDEBAR_GRID' : 'TOOL_SIDEBAR_MEASUREMENT',
  limits: ['Layout read from the DOM (getBoundingClientRect) in headless Chrome at device scale 1.', 'One command start and one refused command.'],
  initialFiles: ['apps/cad-studio/test/tool-sidebar-browser.mjs', 'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/test/model-rail-helper.mjs', 'apps/cad-studio/src/ui/ModelTools.tsx', 'apps/cad-studio/src/ui/ToolButton.tsx', 'apps/cad-studio/src/styles.css', 'apps/cad-studio/src/app/studioConstants.ts'],
  requiredFrozen: ['apps/cad-studio/src/ui/ModelTools.tsx'] });

const layout = () => modelRail(f.page).evaluate(bar => {
  const box = bar.getBoundingClientRect();
  const viewport = document.querySelector('.viewport')?.getBoundingClientRect();
  const buttons = [...bar.querySelectorAll('button')].filter(button => button.getClientRects().length > 0);
  const label = button => button.getAttribute('aria-label') ?? button.textContent.trim();
  const clipped = buttons.filter(button => {
    const r = button.getBoundingClientRect();
    return !r.width || !r.height || r.left < box.left - 0.5 || r.top < box.top - 0.5
      || r.right > Math.min(box.right, innerWidth) + 0.5 || r.bottom > Math.min(box.bottom, innerHeight) + 0.5;
  });
  const expanded = buttons.filter(button => button.getAttribute('aria-expanded') === 'true').map(label);
  const groups = [...bar.querySelectorAll('[role="group"]')].filter(group => group.getClientRects().length > 0)
    .map(group => ({ name: group.getAttribute('aria-label'), buttons: [...group.querySelectorAll('button')].map(label) }));
  const overlaps = [...document.querySelectorAll('.corner-right .card')].map(card => card.getBoundingClientRect())
    .filter(r => r.width && r.left < box.right && r.right > box.left && r.top < box.bottom && r.bottom > box.top).length;
  return {
    window: [innerWidth, innerHeight], bar: box.toJSON(), viewport: viewport ? { left: viewport.left, width: viewport.width } : null,
    insideWindow: box.left >= 0 && box.top >= 0 && box.bottom <= innerHeight && box.right <= innerWidth,
    scrollHeight: bar.scrollHeight, clientHeight: bar.clientHeight, scrolls: bar.scrollHeight > bar.clientHeight + 1,
    overlaps, buttons: buttons.map(label), clipped: clipped.map(label), expanded, groups,
  };
});

function assertFit(read, where) {
  assert.ok(read.insideWindow, `${where}: rail extends beyond the window ${JSON.stringify(read.bar)}`);
  assert.equal(read.overlaps, 0, `${where}: the rail covers the view controls`);
  assert.equal(read.scrolls, false, `${where}: the rail scrolls (${read.scrollHeight} > ${read.clientHeight})`);
  assert.deepEqual(read.clipped, [], `${where}: clipped buttons`);
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const sizes = [[1440, 900], [1280, 800], [1920, 1080], [1024, 700]];
  const out = [];
  const inventory = new Map();
  for (const [w, h] of sizes) {
    const size = `${w}x${h}`;
    f.phase = `window ${size}`;
    if (f.context) await f.context.close();
    f.context = await f.browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, serviceWorkers: 'block', acceptDownloads: false });
    await f.context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return url.origin === origin ? route.continue() : route.abort();
    });
    f.page = await f.context.newPage();
    f.page.on('pageerror', e => f.report.errors.push(e.stack ?? String(e))); f.page.on('console', m => { if (m.type() === 'error') f.report.consoleErrors.push(m.text()); });
    await f.page.goto(f.server.resolvedUrls.local[0]); await f.page.waitForSelector('.viewport[data-renderer="webgpu"]', { timeout: 30000 }); await f.ready();
    const collapsed = await layout();
    const read = { collapsed, expanded: {} };
    out.push(read); f.report.reads.push(read);
    await f.snapshot(size, () => ({}));
    if (grid) {
      assertFit(collapsed, `${size} collapsed`);
      assert.deepEqual(collapsed.expanded, [], `${size}: groups begin closed`);
      assert.deepEqual(collapsed.groups.map(group => group.name), ['Model commands'], `${size}: primary group`);
      for (const name of modelGroupNames) assert.ok(collapsed.buttons.includes(name), `${size}: ${name} toggle`);
    }
    for (const name of modelGroupNames) {
      f.phase = `window ${size} with ${name} open`;
      await openModelGroup(f.page, name);
      const open = await layout();
      read.expanded[name] = open;
      if (grid) {
        assertFit(open, `${size} ${name}`);
        assert.deepEqual(open.expanded, [name], `${size}: one expanded toggle`);
        assert.deepEqual(open.groups.filter(group => modelGroupNames.includes(group.name)).map(group => group.name), [name]);
        const labels = open.groups.find(group => group.name === name).buttons;
        assert.ok(labels.length && labels.every(Boolean), `${size}: ${name} commands have labels`);
        if (inventory.has(name)) assert.deepEqual(labels, inventory.get(name), `${size}: ${name} inventory`);
        else inventory.set(name, labels);
      }
    }
    if (grid && w === 1440 && h === 900) {
      f.phase = 'Create tooltip and command start';
      const create = await openModelGroup(f.page, 'Create');
      const first = create.locator('button:not(.off)').first();
      const name = await first.getAttribute('aria-label');
      await first.hover();
      await f.page.waitForFunction(n => (document.querySelector('.tooltip')?.textContent ?? '').includes(n), name, { timeout: 5000 });
      f.report.observations.push({ hovered: name, tooltip: await f.page.evaluate(() => document.querySelector('.tooltip')?.textContent ?? null) });
      await first.click();
      await f.page.waitForFunction(() => window.__studioSelection?.active || window.__studioSelection?.sketch, null, { timeout: 15000 });
      f.report.observations.push({ clicked: name, started: await f.page.evaluate(() => ({ active: window.__studioSelection.active, sketch: window.__studioSelection.sketch })) });
      await f.snapshot('1440x900-started', () => ({}));
      await f.page.keyboard.press('Escape');
      await f.page.waitForFunction(() => !window.__studioSelection?.active && !window.__studioSelection?.sketch, null, { timeout: 15000 });

      f.phase = 'refused command notice stays clear of the rail';
      const modify = await openModelGroup(f.page, 'Modify');
      const off = modify.locator('button.off').first();
      const offName = await off.getAttribute('aria-label');
      await off.click({ force: true });
      await f.page.waitForSelector('.toast', { timeout: 10000 });
      const notice = await modelRail(f.page).evaluate(rail => {
        const bar = rail.getBoundingClientRect();
        return [...document.querySelectorAll('.toast')].map(toast => {
          const r = toast.getBoundingClientRect();
          return { text: toast.textContent, left: r.left, top: r.top, right: r.right, bottom: r.bottom,
            overRail: r.left < bar.right && r.right > bar.left && r.top < bar.bottom && r.bottom > bar.top };
        });
      });
      f.report.observations.push({ offClicked: offName, notice });
      await f.snapshot('1440x900-notice', () => ({}));
      assert.ok(notice.every(n => !n.overRail), `a notice covers the rail: ${JSON.stringify(notice)}`);
      await f.dismissToasts();
    }
  }
  await writeFile(join(f.output, 'layout.json'), JSON.stringify(out, null, 2));
});
