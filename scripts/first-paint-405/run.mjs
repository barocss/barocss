// #405: trace BaroCSS's bimodal first paint (the #404 tail). Same #198 server/probe/sections/CSP as #404, plus
// Playwright request routing that (1) wraps the runtime bundle and boot with performance.mark()s and (2) makes the
// probe also report every computed-style change time, performance marks, paint entries and the bundle's fetch timing.
// Usage (repo root, after `pnpm install` and `pnpm --filter @barocss/browser build:library`):
//   PW_DIR=... CHROME=... PROBE_PORT=7900 node scripts/first-paint-405/run.mjs <variant> [rounds=10]
// Variants: base | notrans (transition classes stripped) | flags | headed | focus | cdn (add --import ./scripts/first-paint-404/shim.mjs, BARO_UMD=/__mem__/baro.js) |
//           pf (preflight on) | eager (boot at end of <body>, no DCL wait) | tw (twb; TWB_DIR=node_modules/@tailwindcss/browser)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { start, PORT, SECTIONS } from '../mcp-html-probe/server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VARIANT = process.argv[2] || 'base';
const ROUNDS = Number(process.argv[3] || 10);
const { chromium } = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');
const arm = VARIANT === 'pf' ? 'baropf' : VARIANT === 'tw' ? 'twb' : 'baro';
const args = VARIANT === 'flags'
  ? ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']
  : [];

const srv = await start();
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: VARIANT !== 'headed', args });
const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
const M = (n) => `performance.mark(${JSON.stringify(n)});`;
await ctx.route(/\/(baro\.js|twb\.js|baro-boot(-pf)?\.js|probe\.js)/, async (route) => {
  const res = await route.fetch();
  let body = await res.text();
  const p = new URL(route.request().url()).pathname;
  if (p === '/baro.js' || p === '/twb.js') body = M('bundle:exec-start') + body + '\n' + M('bundle:exec-end');
  if (p.startsWith('/baro-boot')) {
    body = `${M('boot:call')}document.addEventListener('DOMContentLoaded',function(){${M('dcl:first-listener')}});` + body +
      `;document.addEventListener('DOMContentLoaded',function(){${M('boot:done')}performance.mark('rules:'+[].reduce.call(document.styleSheets,function(n,s){try{return n+s.cssRules.length}catch(e){return n}},0));requestAnimationFrame(function(){${M('raf:after-boot')}})});` +
      `if(document.body){${M('boot:done')}}`;
  }
  if (p === '/probe.js') body = body.replace('timeToFinalStyled: firstFinal,',
    `timeToFinalStyled: firstFinal,
     changes: frames.filter(function(f,i){return i===0||f[1]!==frames[i-1][1]}).map(function(f){return Math.round(f[0]*10)/10}),
     frameTimes: frames.slice(0,30).map(function(f){return Math.round(f[0]*10)/10}),
     marks: performance.getEntriesByType('mark').map(function(m){return [m.name, Math.round(m.startTime*10)/10]}),
     paint: performance.getEntriesByType('paint').map(function(m){return [m.name, Math.round(m.startTime*10)/10]}),
     nav: (function(n){return n&&{respEnd:Math.round(n.responseEnd),dcl:Math.round(n.domContentLoadedEventStart),load:Math.round(n.loadEventStart)}})(performance.getEntriesByType('navigation')[0]),
     res: performance.getEntriesByType('resource').filter(function(r){return /baro\\.js|twb\\.js/.test(r.name)}).map(function(r){return [Math.round(r.startTime),Math.round(r.responseEnd)]}),
     visibility: document.visibilityState, focus: document.hasFocus(),`);
  await route.fulfill({ response: res, body });
});
if (VARIANT === 'eager') await ctx.route(/\/res\?/, async (route) => {
  const res = await route.fetch();
  const html = (await res.text()).replace(/(<script src="[^"]*\/baro-boot\.js"><\/script>)(.*)<\/body>/s, '$2$1</body>');
  await route.fulfill({ response: res, body: html });
});

// A/B for the transition hypothesis: same page with the transition utilities removed from the markup.
if (VARIANT === 'notrans') await ctx.route(/\/res\?/, async (route) => {
  const res = await route.fetch();
  await route.fulfill({ response: res, body: (await res.text()).replace(/\btransition(-colors)?\b/g, '') });
});

const once = async (sec) => {
  const page = await ctx.newPage();
  if (VARIANT === 'focus') await page.bringToFront();
  await page.goto(`http://127.0.0.1:${PORT}/host?arm=${arm}&sec=${sec}&csp=typical`);
  const r = await page.waitForFunction(() => window.__r && window.__r[0], null, { timeout: 15000 }).then((h) => h.jsonValue()).catch(() => null);
  await page.close();
  if (!r) return null;
  const { finalSig, props, dynamicSig, ...keep } = r;
  return keep;
};
for (const sec of SECTIONS) await once(sec); // warm-up, discarded
const raw = [];
for (let r = 0; r < ROUNDS; r++) for (const sec of SECTIONS) raw.push({ r, sec, ...(await once(sec)) });
const version = browser.version();
await browser.close();
srv.close();
const out = { issue: 405, variant: VARIANT, arm, args, headless: VARIANT !== 'headed', engine: `Chromium ${version}`, raw };
fs.mkdirSync(path.join(HERE, 'raw'), { recursive: true });
fs.writeFileSync(path.join(HERE, 'raw', `${VARIANT}.json`), JSON.stringify(out) + '\n');
const ms = raw.map((x) => x.timeToFinalStyled).filter((x) => x != null).sort((a, b) => a - b);
console.log(VARIANT, 'n', ms.length, 'median', ms[ms.length >> 1]?.toFixed(1), 'slow(>100)', ms.filter((x) => x > 100).length, 'max', ms.at(-1)?.toFixed(1));
