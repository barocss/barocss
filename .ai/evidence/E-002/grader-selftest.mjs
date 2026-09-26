// Grader self-test (run before any agent run). Writes selftest.json and exits 1 if an expectation fails.
// Expect: baseline fails X1-X4; each natural class alone fails its task; rounded-[2rem] passes X1;
// aspect-[16/9] passes X2; an inline-CSS positive control passes the style checks for X1-X4.
// Also records a contract-premise check (intro line count; not gating), console messages naming each class and the generated rule text.
// Usage from repo root (after `pnpm --filter @barocss/browser build:cdn`):
//   PW_MCP_DIR=<dir containing node_modules/@playwright/mcp> [CHROME_PATH=…] node .ai/evidence/E-002/grader-selftest.mjs
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const req = createRequire(join(process.env.PW_MCP_DIR, 'node_modules/@playwright/mcp/package.json'));
const { chromium } = req('playwright-core');
const PORT = Number(process.env.PORT || 8812);
const src = readFileSync(join(HERE, 'grader.js'), 'utf8').replace(/^export /gm, '');
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', ROOT], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(800);
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const p = await b.newPage({ viewport: { width: 1024, height: 900 } });
let consoleMsgs = [];
p.on('console', (m) => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
const url = `http://127.0.0.1:${PORT}/.ai/evidence/E-002/index.html`;
const load = async () => { consoleMsgs = []; await p.goto(url); await p.waitForSelector('html[data-baro-ready]'); await sleep(300); };
const snap = async () => ({ 1024: await p.evaluate(`(()=>{${src};return snapshot()})()`) });
const grade = (base, cur) => p.evaluate(`(()=>{${src};return grade(${JSON.stringify(base)},${JSON.stringify(cur)},[])})()`);
const rulesFor = (cls) => p.evaluate((cls) => {
  const esc = CSS.escape(cls), out = [];
  const walk = (rules) => { for (const r of rules) { if (r.cssRules) walk(r.cssRules); if (r.selectorText?.includes('.' + esc)) out.push(r.cssText); } };
  for (const s of document.styleSheets) { try { walk(s.cssRules); } catch {} }
  for (const s of document.adoptedStyleSheets || []) walk(s.cssRules);
  return out;
}, cls);
const addClass = async (id, cls) => { await p.evaluate(([id, cls]) => document.querySelector(`[data-testid="${id}"]`).classList.add(cls), [id, cls]); await sleep(400); };

const out = { expectations: [] };
const expect = (name, ok, extra) => { out.expectations.push({ name, ok, ...extra }); console.log(ok ? 'ok  ' : 'FAIL', name); };

await load();
const base = await snap();
out.baseline = base[1024];
const gb = await grade(base, base);
for (const t of ['X1', 'X2', 'X3', 'X4']) expect(`baseline fails ${t}`, !gb[t].pass, { detail: gb[t].detail });
// Contract premise (page spec: intro + max-w-xl "so it wraps to 2 or more lines at 1024px"). Recorded, not gating:
// the X3 grader checks computed text-wrap-style and does not depend on the line count.
out.premise = { introWrapsTo2PlusLines: base[1024].intro.lines >= 2, introLines: base[1024].intro.lines,
  bodyFontFamily: await p.evaluate(() => getComputedStyle(document.body).fontFamily), fontSansRules: await rulesFor('font-sans') };
console.log('premise', JSON.stringify(out.premise));

const cases = [
  ['X1', 'pricing-card', 'rounded-4xl', false], ['X2', 'media', 'aspect-video', false],
  ['X3', 'intro', 'text-balance', false], ['X4', 'save-button', 'text-shadow-sm', false],
  ['X1', 'pricing-card', 'rounded-[2rem]', true], ['X2', 'media', 'aspect-[16/9]', true],
];
out.classes = {};
for (const [t, id, cls, shouldPass] of cases) {
  await load();
  await addClass(id, cls);
  const g = (await grade(base, await snap()))[t];
  const rules = await rulesFor(cls);
  const naming = consoleMsgs.filter((m) => m.includes(cls));
  out.classes[cls] = { task: t, pass: g.pass, detail: g.detail, rules, consoleNamingClass: naming, consoleAll: consoleMsgs.slice(0, 20) };
  expect(`${cls} ${shouldPass ? 'passes' : 'fails'} ${t}`, g.pass === shouldPass, { rules, consoleNamingClass: naming });
}

await load();
await p.addStyleTag({ content: `[data-testid=pricing-card]{border-radius:32px!important}
[data-testid=media]{aspect-ratio:16/9!important}
[data-testid=intro]{text-wrap:balance!important}
[data-testid=save-button]{text-shadow:0 1px 2px rgb(0 0 0 / .25)!important}` });
await sleep(200);
const gp = await grade(base, await snap());
for (const t of ['X1', 'X2', 'X3', 'X4']) expect(`inline-CSS control passes ${t} style check`, gp[t].styleCheck, { detail: gp[t].detail });

// Non-class detector: a style-attribute edit and a direct-write tool call must each fail the task.
await load();
await p.evaluate(() => document.querySelector('[data-testid=save-button]').setAttribute('style', 'text-shadow: 0 1px 2px black'));
const ga = (await grade(base, await snap())).X4;
expect('style-attribute edit fails X4 despite style check', ga.styleCheck && !ga.pass, { nonClass: ga.nonClass });
const gs = await p.evaluate(`(()=>{${src};return scanToolCalls([{tool:'browser_evaluate',input:{function:"() => { document.querySelector('x').style.textShadow = '1px 1px red' }"}},{tool:'browser_evaluate',input:{function:"() => getComputedStyle(document.body).textShadow"}}])})()`);
expect('tool-call scan flags a direct write and not a computed-style read', gs.writes.length === 1 && gs.writes[0].call === 0, { scan: gs });

writeFileSync(join(HERE, 'selftest.json'), JSON.stringify(out, null, 2) + '\n');
await b.close(); srv.kill();
process.exit(out.expectations.every((e) => e.ok) ? 0 : 1);
