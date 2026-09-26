// #407: A vs B vs baseline for the #405 boot transition race, one session, interleaved rounds.
// Same #198 server/sections/typical CSP as #404/#405, inside the sandboxed iframe. Arms (placement x fix):
//   base = boot script in <head> (waits for DOMContentLoaded), no fix
//   A    = boot script moved to the end of <body>: body parsed, so the scan + insert runs synchronously, no DCL wait
//   B    = boot script in <head>, and boot finishes the CSS transitions its first insert started (the shipped fix)
// Triggers: natural (boot as shipped) | forced (the boot call runs 100 ms late via setTimeout, so the parsed page
// renders frames, i.e. real style passes, before the first insert: a slow script, deterministically). Tried first
// and not triggering in Chromium: an inline getComputedStyle/offsetHeight read before the boot script, and a
// parser-blocking script delayed 120 ms (no frame is rendered while the parser is blocked).
// Per load, in the frame: bootMs = when the first insert finished (ms from navigation start); animated = CSS
// transitions still running right after boot (the "animated from unstyled" case, 150 ms each). After boot the
// harness swaps bg-white -> bg-rose-500 on a new transition-colors element and counts the transitions it starts (must be > 0).
// base/A disable the fix with window.__baro407='off', a switch that existed only in the measurement build (removed
// from the shipped code, so rerunning on it makes base/A behave like B; recorded numbers are in result.json).
// Usage (repo root, after build:library): PW_DIR=... CHROME=... node scripts/first-paint-407/run.mjs [rounds=10]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { start, PORT, SECTIONS } from '../mcp-html-probe/server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROUNDS = Number(process.argv[2] || 10);
const { chromium } = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');
const ARMS = ['base', 'A', 'B'].flatMap((fix) => ['natural', 'forced'].map((trig) => ({ fix, trig, key: `${fix}/${trig}` })));
const COUNT = "document.getAnimations().filter(function(a){return a instanceof CSSTransition&&a.playState==='running'}).length";

const srv = await start();
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true,
  // A route-fulfilled document counts as public address space, so its loads from the loopback CDN would be blocked
  // (Local Network Access); off for every arm alike.
  args: ['--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessChecks'] });
async function ctxFor(arm) {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  await ctx.route(/\/baro-boot\.js/, async (route) => {
    const res = await route.fetch();
    let boot = `BaroCSS.baroStart();function __d(){window.__boot=performance.now();window.__anim=${COUNT}}` +
      'if(document.body)__d();else document.addEventListener("DOMContentLoaded",__d);';
    if (arm.trig === 'forced') boot = `setTimeout(function(){${boot}},100);`;
    await route.fulfill({ response: res, body: (arm.fix === 'B' ? '' : "window.__baro407='off';") + boot });
  });
  if (arm.fix === 'A') await ctx.route(/\/res\?/, async (route) => {
    const res = await route.fetch();
    const html = (await res.text()).replace(/(<script src="[^"]*\/baro-boot\.js"><\/script>)(.*)<\/body>/s, (_, s, rest) => `${rest}${s}</body>`);
    await route.fulfill({ response: res, body: html });
  });
  return ctx;
}
const ctxs = {};
for (const a of ARMS) ctxs[a.key] = await ctxFor(a);
const once = async (a, sec) => {
  const page = await ctxs[a.key].newPage();
  await page.goto(`http://127.0.0.1:${PORT}/host?arm=baro&sec=${sec}&csp=typical`);
  const f = page.frames().find((x) => x.url().includes('/res?'));
  for (let i = 0; i < 100 && !(await f.evaluate('window.__boot != null')); i++) await page.waitForTimeout(50);
  await page.waitForTimeout(250); // any boot transition (150 ms) is over
  // Transition after boot: a fresh element with transition-colors + bg-white; once styled, swap bg-white -> bg-rose-500.
  const r = await f.evaluate(`new Promise(function(ok){var el=document.createElement('div');el.className='transition-colors bg-white p-4';
    document.body.appendChild(el);setTimeout(function(){el.classList.replace('bg-white','bg-rose-500');setTimeout(function(){
    ok({bootMs:window.__boot,animated:window.__anim,afterBoot:${COUNT},cls:document.body.className})},60)},60)})`);
  await page.close();
  return r;
};
for (const a of ARMS) for (const sec of SECTIONS) await once(a, sec); // warm-up, discarded
const raw = [];
for (let r = 0; r < ROUNDS; r++) for (const sec of SECTIONS) for (const a of ARMS) raw.push({ r, sec, arm: a.key, ...(await once(a, sec)) });
const version = browser.version();
await browser.close();
srv.close();
const summary = {};
for (const a of ARMS) {
  const xs = raw.filter((x) => x.arm === a.key);
  const ms = xs.map((x) => x.bootMs).sort((p, q) => p - q);
  summary[a.key] = { n: xs.length, medianBootMs: +ms[ms.length >> 1].toFixed(1), animatedLoads: xs.filter((x) => x.animated > 0).length,
    transitionAfterBoot: xs.filter((x) => x.afterBoot > 0).length, bootDone: xs.filter((x) => x.cls.includes('baro-boot-done')).length };
  console.log(a.key.padEnd(12), JSON.stringify(summary[a.key]));
}
fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ issue: 407, engine: `Chromium ${version}`, rounds: ROUNDS, summary, raw }) + '\n');
