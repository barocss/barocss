// Frame check (#441): samples every animation frame during a press and asserts the screen never flashes.
//   PW_DIR=<dir with node_modules/playwright> CHROME=<chromium binary> node --test examples/ai-kiosk/test/frames.test.mjs
// Skipped when Playwright is not available. Stub generator with a controllable delay; needs the prebuilt kit (README).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { stubGenerator } from '../lib/generators.mjs';
import { createKioskServer } from '../server.mjs';

let chromium = null;
try { chromium = createRequire(path.join(process.env.PW_DIR || process.cwd(), 'noop.js'))('playwright').chromium; } catch { /* skip */ }

let delayMs = 0;
const inner = stubGenerator();
const generator = { name: 'stub', generate: async (a) => { await new Promise((r) => setTimeout(r, delayMs)); return inner.generate(a); } };

// Per frame: element count in the stage, overlay visibility, and whether every `flex` element is laid out as flex.
const SAMPLER = () => {
  window.__frames = [];
  const tick = () => {
    const stage = document.getElementById('stage');
    const flex = [...stage.querySelectorAll('.flex')];
    window.__frames.push({
      n: stage.childElementCount,
      overlay: getComputedStyle(document.getElementById('loading')).display !== 'none',
      unstyled: flex.filter((el) => !getComputedStyle(el).display.includes('flex')).length,
      step: stage.dataset.step,
    });
    window.__raf = requestAnimationFrame(tick);
  };
  tick();
};

async function press(page, action, arg) {
  await page.evaluate(SAMPLER);
  await page.evaluate(([a, o]) => window.kiosk.go(a, undefined, o), [action, arg]);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  return page.evaluate(() => { cancelAnimationFrame(window.__raf); return window.__frames; });
}

test('kiosk screen swap: no blank, overlay or unstyled frame; overlay only when slow', { skip: !chromium && 'playwright not found (set PW_DIR)' }, async () => {
  const server = createKioskServer({ generator });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => document.getElementById('stage').dataset.step === 'start' && !window.kiosk.busy);

    delayMs = 50; // fast: swap in place
    for (const [action, arg] of [['start'], ['choose-persona', 'senior'], ['regenerate']]) {
      const frames = await press(page, action, arg);
      assert.ok(frames.length >= 3, `${action}: sampled ${frames.length} frames`);
      assert.equal(frames.filter((f) => f.n === 0).length, 0, `${action}: empty stage frame`);
      assert.equal(frames.filter((f) => f.overlay).length, 0, `${action}: overlay frame on a fast generation`);
      assert.equal(frames.filter((f) => f.unstyled).length, 0, `${action}: unstyled frame`);
    }

    delayMs = 800; // slow: overlay appears
    const frames = await press(page, 'regenerate');
    assert.ok(frames.some((f) => f.overlay), 'overlay shown for a slow generation');
    assert.equal(frames.filter((f) => f.n === 0 || f.unstyled).length, 0, 'slow: empty or unstyled frame');
    assert.equal(frames.at(-1).overlay, false, 'overlay hidden after the swap');
  } finally {
    await browser.close();
    server.close();
  }
});
