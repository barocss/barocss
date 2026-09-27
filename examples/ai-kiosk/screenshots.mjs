// Headless check + screenshots (stub generator, real browser, real CSP).
//   PW_DIR=<dir with node_modules/playwright> CHROME=<chromium> node examples/ai-kiosk/screenshots.mjs [--no-write]
// Drives every screen for each persona, fails on any console error, CSP violation, broken image or unstyled
// class token (the #426 no-op check), and writes screenshots/<persona>-<n>-<screen>.png.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stubGenerator } from './lib/generators.mjs';
import { createKioskServer } from './server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(path.join(process.env.PW_DIR || process.cwd(), 'noop.js'))('playwright');
const write = !process.argv.includes('--no-write');
const server = createKioskServer({ generator: stubGenerator() });
await new Promise((r) => server.listen(Number(process.env.PORT) || 0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const problems = [];
let shots = 0;

async function run(persona, plan) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1100 } });
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`${persona}: console: ${m.text()}`); });
  page.on('pageerror', (err) => problems.push(`${persona}: pageerror: ${err.message}`));
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', (ev) => console.error(`CSP ${ev.violatedDirective} ${ev.blockedURI}`)));
  await page.goto(url);
  await page.waitForFunction(() => document.getElementById('stage').dataset.step === 'start' && !window.kiosk.busy);
  const check = async (name) => {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const s = await page.evaluate(() => ({
      noop: document.getElementById('dev-noop').textContent, err: document.getElementById('dev-error').textContent,
      broken: [...document.querySelectorAll('#stage img')].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.getAttribute('src')),
    }));
    if (!/: 0 unstyled/.test(s.noop)) problems.push(`${persona}/${name}: ${s.noop}`);
    if (s.err) problems.push(`${persona}/${name}: error ${s.err}`);
    if (s.broken.length) problems.push(`${persona}/${name}: broken images ${s.broken.join(' ')}`);
    if (write) await page.locator('#device').screenshot({ path: path.join(HERE, 'screenshots', `${persona}-${name}.png`) });
    shots += 1;
  };
  const go = async (a, item, option) => {
    await page.evaluate(([x, i, o]) => window.kiosk.go(x, i, o), [a, item, option]);
    const err = await page.evaluate(() => document.getElementById('dev-error').textContent);
    if (err) problems.push(`${persona}: ${a} ${option ?? item ?? ''}: ${err}`);
  };
  for (const step of plan) {
    if (typeof step === 'string') await check(step);
    else await go(...step);
  }
  await page.close();
}

await run('shared', [[ 'order-method', undefined, 'voice'], '0-voice', ['back'], ['toggle-contrast'], '0-start-contrast']);
for (const p of ['senior', 'regular', 'family', 'foreign']) {
  await run(p, [
    '1-start', ['order-method', undefined, 'touch'], '2-persona', ['choose-persona', undefined, p], '3-menu',
    ['set-category', undefined, 'coffee'], '3b-menu-soldout',
    ...(p === 'regular' ? [['toggle-zoom']] : []), ['page', undefined, 'next'], '3c-menu-page2',
    ['set-category', undefined, 'bundle'], '3d-bundles',
    ['select-item', 'americano'], '4-options-required', ['set-size', undefined, 'M'], ['set-temp', undefined, 'iced'],
    ['toggle-option', undefined, 'extra-shot'], ['set-qty', undefined, 'inc'], '4b-options-ready',
    ['add-to-cart'], ['call-staff'], '5-cart', ['checkout'], '6-pay', ['pay'], '7-done',
    ['restart'], ['order-method', undefined, 'low'], ['choose-persona', undefined, p], '8-low-posture',
    ['restart'], ['toggle-contrast'], ['order-method', undefined, 'touch'], ['choose-persona', undefined, p], '9-high-contrast',
  ]);
}
await browser.close();
server.close();
console.log(`${shots} screens checked, ${problems.length} problems${write ? ', screenshots written' : ''}`);
for (const p of problems) console.log(`  ${p}`);
process.exit(problems.length ? 1 : 0);
