// Roadmap 20 ⑦: a notice (toast) over the viewport must not stop a face under it from being picked; its buttons still work.
// Flow (real pointer and wheel events): open the box fixture, zoom in at the point P where a notice's text will sit until a click at P picks a face, clear the
// selection, raise a "can't run here" notice from a tool that is off, check the notice covers P, click P: a face is picked (the click went through the notice's text),
// and the notice's close button still dismisses it. With NOTICE_EXPECT=through the pick is asserted; without it the run only records what the click hit.
// Root must freeze all sources first. Run from apps/cad-studio:
//   NOTICE_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/notice-click-through-browser.mjs /absolute/artifacts
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const through = process.env.NOTICE_EXPECT === 'through';
const fixture = join(import.meta.dirname, 'fixtures', 'drag-preview-timing.bcad');
const f = await createFlow({ name: 'notice', envFrozen: 'NOTICE_SOURCE_FROZEN', output: process.argv[2], qualification: through ? 'NOTICE_CLICK_THROUGH' : 'NOTICE_CLICK_MEASUREMENT',
  limits: ['One notice kind (a tool that cannot run here) at 1440 x 1000; the dialog-like notices (recovery, delete with dependents) share the same rule but are not raised here.'],
  initialFiles: ['apps/cad-studio/test/notice-click-through-browser.mjs', 'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/src/styles.css', 'apps/cad-studio/src/App.tsx'], requiredFrozen: ['apps/cad-studio/src/styles.css'] });

const faces = () => f.page.evaluate(() => window.__studioSelection?.selection?.faces?.length ?? 0);
await f.run(async () => {
  await f.newPage(); await f.openFile(fixture, 5);
  // The point P: where the notice's title will be (the empty stack's box: left + 60, top + 14).
  const at = await f.page.evaluate(() => { const r = document.querySelector('.toast-stack').getBoundingClientRect(); return [r.left + 60, r.top + 14]; });
  f.phase = 'zoom until P picks a face';
  let picked = 0;
  // (Top view, then zoom in at the viewport's centre — the box's top face between its holes — until the face reaches P.)
  await f.page.getByRole('button', { name: 'Top', exact: true }).click(); await new Promise(r => setTimeout(r, 600));
  const centre = await f.page.evaluate(() => { const r = document.querySelector('.viewport canvas').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  for (let k = 0; k < 40 && !picked; k++) {
    await f.page.mouse.move(centre[0], centre[1]); await f.page.mouse.wheel(0, -240); await new Promise(r => setTimeout(r, 120));
    await f.page.mouse.click(at[0], at[1]); await new Promise(r => setTimeout(r, 150)); picked = await faces();
  }
  assert.ok(picked > 0, 'a click at P picks a face once zoomed in');
  await f.page.keyboard.press('Escape'); await f.page.waitForFunction(() => (window.__studioSelection?.selection?.faces?.length ?? 0) === 0, null, { timeout: 5000 });
  f.phase = 'raise a notice';
  await f.page.locator('nav.toolbar .tool-group button.off').first().click({ force: true }); await f.page.waitForSelector('.toast', { timeout: 10000 });
  const cover = await f.page.evaluate(([x, y]) => { const t = document.querySelector('.toast'), r = t.getBoundingClientRect(), e = document.elementFromPoint(x, y);
    return { toast: [r.left, r.top, r.right, r.bottom], covers: x >= r.left && x <= r.right && y >= r.top && y <= r.bottom, hit: e ? `${e.tagName.toLowerCase()}.${e.className}` : null, hitInToast: !!e?.closest('.toast') }; }, at);
  f.report.observations.push({ P: at, ...cover }); await f.snapshot('01-notice-over-face', () => ({}));
  assert.ok(cover.covers, `the notice covers P ${JSON.stringify(cover)}`);
  f.phase = 'click P through the notice';
  await f.page.mouse.click(at[0], at[1]); await new Promise(r => setTimeout(r, 300));
  const after = await faces(); f.report.observations.push({ facesAfterClick: after, noticeStill: await f.page.locator('.toast').count() });
  await f.snapshot('02-clicked-through', () => ({}));
  if (through) {
    assert.equal(cover.hitInToast, false, `the notice's text takes no click ${JSON.stringify(cover)}`);
    assert.ok(after > 0, 'the face under the notice is picked');
    // The notice's own close button still works.
    await f.page.locator('.toast').first().getByRole('button', { name: /close|dismiss/i }).click(); await f.page.waitForFunction(() => document.querySelectorAll('.toast').length === 0, null, { timeout: 5000 });
    await f.snapshot('03-dismissed', () => ({}));
  }
});
