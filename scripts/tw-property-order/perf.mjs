// #401: cost of the output sort on a large class set (both parity corpora x 6 variant prefixes).
// Rerun (after `pnpm build:library`):
//   PW_DIR=<dir containing node_modules/playwright-core> CHROME=<chromium> node scripts/tw-property-order/perf.mjs
// Prints median ms of: server generateCss (cold runtime, no cache), kit generateCss, and browser runtime
// insertion (addClass per class, document mode, default partitions) in Chromium.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { ROOT, ServerRuntime, kit } from '../cross-category-395/lib.mjs';

const tokens = (f) => [...fs.readFileSync(path.join(ROOT, 'packages/barocss/tests/compat', f), 'utf8').matchAll(/^\s*\["([^"]+)",/gm)].map((m) => m[1]);
const base = [...new Set([...tokens('corpus.ts'), ...tokens('corpus-heldout.ts')])];
const classes = ['', 'sm:', 'md:', 'lg:', 'hover:', 'dark:'].flatMap((v) => base.map((c) => v + c));
const median = (xs) => xs.sort((a, b) => a - b)[xs.length >> 1];
const time = (fn, n = 7) => median(Array.from({ length: n }, () => { const t = performance.now(); fn(); return performance.now() - t; }));

const list = classes.join(' ');
const server = time(() => new ServerRuntime({}, { cacheSize: 0 }).generateCss(list));
const kitMs = time(() => kit.generateCss(list, kit.createContext({})));

const pw = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');
const browser = await pw.chromium.launch({ executablePath: process.env.CHROME });
const page = await browser.newPage();
const runs = [];
for (let i = 0; i < 5; i++) {
  await page.setContent('<!doctype html><html><head></head><body></body></html>');
  await page.addScriptTag({ path: path.join(ROOT, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs') });
  runs.push(await page.evaluate((cs) => {
    const rt = BaroCSS.getRuntime({ config: {} });
    const t = performance.now();
    for (const c of cs) rt.addClass(c);
    const ms = performance.now() - t;
    rt.destroy?.();
    return ms;
  }, classes));
}
await browser.close();
console.log(JSON.stringify({ classes: classes.length, serverGenerateCssMs: +server.toFixed(1), kitGenerateCssMs: +kitMs.toFixed(1), runtimeInsertMs: +median(runs).toFixed(1) }));
