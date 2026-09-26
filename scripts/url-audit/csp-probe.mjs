// #346 phase 1: does a host CSP `img-src 'self'` block every url-emitting form found by
// packages/barocss/tests/fuzz/url-audit.test.ts? Declarations below are the kit's emitted values.
// Run: PW_DIR=... CHROME=... node scripts/url-audit/csp-probe.mjs   (ports 7150/7151)
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_DIR + '/node_modules/');
const { chromium } = require('playwright');

const OTHER = 'http://127.0.0.1:7151';
const FORMS = {
  'bg-[url()] / [background-image:]': (u) => `background-image:url(${u})`,
  '[background:url()]': (u) => `background:url(${u})`,
  'mask-[url()] / [mask-image:]': (u) => `mask-image:url(${u});-webkit-mask-image:url(${u})`,
  'cursor-[url(),auto]': (u) => `cursor:url(${u}),auto`,
  '[list-style-image:url()]': (u) => `display:list-item;list-style-image:url(${u})`,
  '[content:url()] (element)': (u) => `content:url(${u})`,
  '[--x:url()] + [background:var(--x)]': (u) => `--x:url(${u});background:var(--x)`,
  '[background-image:image-set()]': (u) => `background-image:image-set(url(${u}) 1x)`,
};
const hits = [];
const other = http.createServer((q, s) => { hits.push(q.url); s.writeHead(200, { 'content-type': 'image/png' }); s.end(); }).listen(7151);
let policy = '';
const page = http.createServer((q, s) => {
  const rules = Object.entries(FORMS).map(([, f], i) => `#e${i}{width:20px;height:20px;${f(`${OTHER}/f${i}.png`)}}`).join('\n');
  const els = Object.keys(FORMS).map((_, i) => `<div id="e${i}"></div>`).join('');
  s.writeHead(200, { 'content-type': 'text/html', 'content-security-policy': policy });
  s.end(`<!doctype html><style>${rules}</style><body>${els}<script>document.addEventListener('securitypolicyviolation',e=>(window.v=window.v||[]).push(e.blockedURI))</script>`);
}).listen(7150);

const browser = await chromium.launch({ executablePath: process.env.CHROME });
for (const p of ['', "img-src 'self'", "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'"]) {
  policy = p; hits.length = 0;
  const pg = await browser.newPage();
  await pg.goto('http://127.0.0.1:7150/');
  await pg.mouse.move(10, 10); await pg.mouse.move(10, 10 + 20 * 3 + 5); // hover the cursor element
  await pg.waitForTimeout(800);
  const v = (await pg.evaluate(() => window.v || [])).length;
  console.log(`CSP="${p || '(none)'}"  violations=${v}`);
  Object.keys(FORMS).forEach((k, i) => console.log(`  ${hits.includes(`/f${i}.png`) ? 'LOADED ' : 'blocked'} ${k}`));
  await pg.close();
}
await browser.close(); other.close(); page.close();
