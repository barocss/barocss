// Roadmap 21 (History bar): while a command runs or a sketch is open, the History bar used to disappear ("as if it were gone"). It records, for idle / a running
// command (Box from the palette) / an open sketch, whether the bar is in the page, its box, whether it is inert, and what a click on a step does.
// With HISTORY_EXPECT=dimmed it asserts the new behaviour: the bar stays in its place, dimmed, and takes the click itself (the element at a step's centre is the bar's,
// not the viewport's), which opens nothing and changes nothing (document, HUD, sketch panel, picks), and
// once the command or sketch ends it takes clicks again (a step opens its feature editor).
// Root must freeze all sources first. Run from apps/cad-studio:
//   HISTORY_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/history-bar-browser.mjs /absolute/artifacts
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const dimmed = process.env.HISTORY_EXPECT === 'dimmed';
const fixture = join(import.meta.dirname, 'fixtures', 'drag-preview-timing.bcad');
const f = await createFlow({ name: 'history', envFrozen: 'HISTORY_SOURCE_FROZEN', output: process.argv[2], qualification: dimmed ? 'HISTORY_BAR_DIMMED' : 'HISTORY_BAR_MEASUREMENT',
  limits: ['1440 x 1000; one running command (Box from the palette) and one open sketch (the rail\'s Sketch).'],
  initialFiles: ['apps/cad-studio/test/history-bar-browser.mjs', 'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/src/ui/FeatureHistoryBar.tsx', 'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/styles.css'],
  requiredFrozen: ['apps/cad-studio/src/ui/FeatureHistoryBar.tsx'] });

const bar = () => f.page.evaluate(() => { const h = document.querySelector('.history'); if (!h) return { present: false };
  const r = h.getBoundingClientRect(), s = h.querySelector('.hs[data-node-index="1"]').getBoundingClientRect(), x = s.left + s.width / 2, y = s.top + s.height / 2, e = document.elementFromPoint(x, y);
  return { present: true, box: [r.left, r.top, r.width, r.height], busy: h.getAttribute('aria-disabled') === 'true', opacity: getComputedStyle(h).opacity, steps: h.querySelectorAll('.hs').length, title: h.getAttribute('title'), stepHitIsBar: !!e?.closest('.history') }; });
const state = () => f.page.evaluate(() => ({ doc: JSON.stringify(window.__studioDoc), active: window.__studioSelection?.active ?? null, sketch: !!window.__studioSelection?.sketch, editor: !!document.querySelector('.node-editor'),
  hud: document.querySelector('.hud')?.textContent ?? null, sketchPanel: document.querySelector('.sk-panel')?.textContent ?? null, selection: JSON.stringify(window.__studioSelection?.selection ?? null) }));

await f.run(async () => {
  await f.newPage(); await f.openFile(fixture, 5); const original = await f.doc();
  const idle = await bar(); f.report.reads.push({ when: 'idle', ...idle }); await f.snapshot('01-idle', () => ({}));
  assert.ok(idle.present && idle.steps > 0, 'the bar is shown with its steps when idle');
  for (const [when, start] of [['command', () => f.command('Box')], ['sketch', () => f.page.locator('nav.toolbar button[aria-label="Sketch"]').first().click()]]) {
    f.phase = when; await f.page.evaluate(() => document.activeElement?.blur()); await start();
    await f.page.waitForFunction(w => w === 'sketch' ? !!window.__studioSelection?.sketch : !!window.__studioSelection?.active, when, { timeout: 15000 });
    const read = await bar(); f.report.reads.push({ when, ...read }); await f.snapshot(`02-${when}`, () => ({}));
    if (dimmed) {
      assert.ok(read.present, `${when}: the bar stays`);
      assert.deepEqual(read.box, idle.box, `${when}: in the same place`);
      assert.ok(read.busy && Number(read.opacity) < 1, `${when}: dimmed ${JSON.stringify(read)}`);
      assert.ok(read.stepHitIsBar, `${when}: a step's place belongs to the bar, not the viewport under it`);
      // A real click (and a double-click) on a step, at its centre, does nothing while it runs: no step opens, nothing reaches the viewport.
      const before = await state(), c = await f.page.locator('.history .hs[data-node-index="1"]').boundingBox();
      await f.page.mouse.click(c.x + c.width / 2, c.y + c.height / 2); await f.page.mouse.dblclick(c.x + c.width / 2, c.y + c.height / 2); await new Promise(r => setTimeout(r, 400));
      assert.deepEqual(await state(), before, `${when}: a click on a step changes nothing`);
    }
    await f.page.keyboard.press('Escape'); await f.page.waitForFunction(() => !window.__studioSelection?.active && !window.__studioSelection?.sketch, null, { timeout: 15000 });
    await f.same(original);
  }
  // Idle again: the bar takes clicks (a step opens its feature editor).
  f.phase = 'idle again'; const back = await bar(); f.report.reads.push({ when: 'idle again', ...back });
  assert.ok(back.present && !back.busy, 'the bar takes clicks again');
  await f.openFeatureEditor(1, 'box'); await f.snapshot('03-idle-step-opens', () => ({})); await f.closeEditor();
});
