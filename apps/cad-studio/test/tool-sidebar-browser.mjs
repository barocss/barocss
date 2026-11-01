// Roadmap 21: the left tool bar (nav.toolbar, ui/ModelTools.tsx). At common window sizes it records how many command buttons each group has, the bar's box,
// whether it scrolls (scrollHeight > clientHeight) and how many buttons are hidden below its visible height, and the viewport width left beside it.
// With TOOL_SIDEBAR_EXPECT=grid it also asserts the categorized grid: at 1440 x 900 every button is visible without scrolling, each group has its label,
// tooltips still show on hover, a click still starts its command, and a narrow window keeps the bar inside the window.
// Root must freeze all sources first. Run from apps/cad-studio:
//   TOOL_SIDEBAR_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/tool-sidebar-browser.mjs /absolute/artifacts
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const grid = process.env.TOOL_SIDEBAR_EXPECT === 'grid';
const f = await createFlow({ name: 'tool-sidebar', envFrozen: 'TOOL_SIDEBAR_SOURCE_FROZEN', output: process.argv[2], qualification: grid ? 'TOOL_SIDEBAR_GRID' : 'TOOL_SIDEBAR_MEASUREMENT',
  limits: ['Layout read from the DOM (getBoundingClientRect) in headless Chrome at device scale 1; fonts and icons as the dev server serves them.', 'One click per checked command; the command itself is not applied.'],
  initialFiles: ['apps/cad-studio/test/tool-sidebar-browser.mjs', 'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/src/ui/ModelTools.tsx', 'apps/cad-studio/src/ui/ToolButton.tsx', 'apps/cad-studio/src/styles.css', 'apps/cad-studio/src/app/studioConstants.ts'],
  requiredFrozen: ['apps/cad-studio/src/ui/ModelTools.tsx'] });

/** The bar's layout: its box, scrolling, groups (label and button count) and the buttons outside its visible box. */
const layout = () => f.page.evaluate(() => {
  const bar = document.querySelector('nav.toolbar'), box = bar.getBoundingClientRect(), vp = document.querySelector('.viewport')?.getBoundingClientRect();
  const buttons = [...bar.querySelectorAll('button')], hidden = buttons.filter(b => { const r = b.getBoundingClientRect(); return r.bottom > box.bottom + 0.5 || r.top < box.top - 0.5 || r.right > box.right + 0.5; });
  const groups = [...bar.querySelectorAll('.tool-group')].map(g => ({ label: g.querySelector('.tool-group-label')?.textContent?.trim() ?? null, buttons: g.querySelectorAll('button').length, columns: new Set([...g.querySelectorAll('button')].map(b => Math.round(b.getBoundingClientRect().left))).size }));
  return { window: [innerWidth, innerHeight], bar: { left: box.left, top: box.top, width: box.width, height: box.height, bottom: box.bottom }, scrollHeight: bar.scrollHeight, clientHeight: bar.clientHeight, scrolls: bar.scrollHeight > bar.clientHeight + 1,
    // (The view controls at the viewport's bottom: the rail must not cover them.)
    overlaps: [...document.querySelectorAll('.corner-right .card')].map(c => c.getBoundingClientRect()).filter(r => r.width && r.left < box.right && r.right > box.left && r.top < box.bottom && r.bottom > box.top).length,
    buttons: buttons.length, hidden: hidden.length, hiddenNames: hidden.map(b => b.getAttribute('aria-label')), groups, viewport: vp ? { left: vp.left, width: vp.width } : null, insideWindow: box.bottom <= innerHeight && box.right <= innerWidth };
});

await f.run(async () => {
  const sizes = [[1440, 900], [1280, 800], [1920, 1080], [1024, 700]], out = [];
  for (const [w, h] of sizes) {
    f.phase = `window ${w}x${h}`;
    if (f.context) await f.context.close();
    f.context = await f.browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 }); f.page = await f.context.newPage();
    f.page.on('pageerror', e => f.report.errors.push(e.stack ?? String(e))); f.page.on('console', m => { if (m.type() === 'error') f.report.consoleErrors.push(m.text()); });
    await f.page.goto(f.server.resolvedUrls.local[0]); await f.page.waitForSelector('.viewport[data-renderer="webgpu"]', { timeout: 30000 }); await f.ready();
    const read = await layout(); out.push(read); f.report.reads.push(read);
    await f.snapshot(`${w}x${h}`, () => ({}));
    if (grid && w === 1440 && h === 900) {
      assert.equal(read.scrolls, false, `1440x900: the bar scrolls (${read.scrollHeight} > ${read.clientHeight})`);
      assert.equal(read.hidden, 0, `1440x900: hidden buttons ${read.hiddenNames}`);
      for (const g of read.groups) assert.ok(g.label, `group without label: ${JSON.stringify(g)}`);
      // A tooltip on hover and a click that starts it: the first enabled Create button (its tooltip names it; the Studio's active command or sketch starts; Escape leaves it).
      const first = f.page.locator('nav.toolbar [role="group"][aria-label="Create"] button:not(.off)').first(), name = await first.getAttribute('aria-label'); await first.hover();
      await f.page.waitForFunction(n => (document.querySelector('.tooltip')?.textContent ?? '').includes(n), name, { timeout: 5000 });
      f.report.observations.push({ hovered: name, tooltip: await f.page.evaluate(() => document.querySelector('.tooltip')?.textContent ?? null) });
      await first.click(); await f.page.waitForFunction(() => window.__studioSelection?.active || window.__studioSelection?.sketch, null, { timeout: 15000 });
      f.report.observations.push({ clicked: name, started: await f.page.evaluate(() => ({ active: window.__studioSelection.active, sketch: window.__studioSelection.sketch })) }); await f.snapshot('1440x900-started', () => ({}));
      await f.page.keyboard.press('Escape'); await f.page.waitForFunction(() => !window.__studioSelection?.active && !window.__studioSelection?.sketch, null, { timeout: 15000 });
      // A notice ("can't run here", from a tool that is off) must not cover the rail.
      const off = f.page.locator('nav.toolbar .tool-group button.off').first();
      if (await off.count()) {
        const offName = await off.getAttribute('aria-label'); await off.click({ force: true });
        await f.page.waitForSelector('.toast', { timeout: 10000 });
        const notice = await f.page.evaluate(() => { const bar = document.querySelector('nav.toolbar').getBoundingClientRect();
          return [...document.querySelectorAll('.toast')].map(t => { const r = t.getBoundingClientRect(); return { text: t.textContent, left: r.left, top: r.top, right: r.right, bottom: r.bottom, overRail: r.left < bar.right && r.right > bar.left && r.top < bar.bottom && r.bottom > bar.top }; }); });
        f.report.observations.push({ offClicked: offName, notice }); await f.snapshot('1440x900-notice', () => ({}));
        assert.ok(notice.every(n => !n.overRail), `a notice covers the rail: ${JSON.stringify(notice)}`);
        await f.dismissToasts();
      }
    }
    if (grid) assert.ok(read.insideWindow, `${w}x${h}: the bar runs past the window ${JSON.stringify(read.bar)}`);
    if (grid) assert.equal(read.overlaps, 0, `${w}x${h}: the bar covers the view controls`);
    if (grid) { assert.equal(read.scrolls, false, `${w}x${h}: the bar scrolls`); assert.equal(read.hidden, 0, `${w}x${h}: hidden ${read.hiddenNames}`); }
  }
  await writeFile(join(f.output, 'layout.json'), JSON.stringify(out, null, 2));
});
