// E-003 grader self-test (run before any agent run). Writes selftest.json; exits 1 if a gating expectation fails.
// Gating, both arms: baseline fails Y1/Y2; `bg-brand` / `rounded-4xl` alone fail; `bg-[#5B21B6]` / `rounded-[2rem]` fail
// (token class required); inline-CSS controls fail through the detector; tool-call scan flags CSS-text writes, not config calls.
// Gating, arm B: some window.baroRuntime config call makes Y1 and Y2 pass with no regression, with the token class either
// added or replacing the conflicting class (all shapes tried are recorded, with generated rules and :root vars).
// Informational, arm A: config routes that do not use the page's instance (import the CDN module, start a second runtime).
// Usage from repo root (after `pnpm --filter @barocss/browser build:cdn`):
//   PW_MCP_DIR=<dir containing node_modules/@playwright/mcp> [CHROME_PATH=…] node .ai/evidence/E-003/grader-selftest.mjs
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const req = createRequire(join(process.env.PW_MCP_DIR, 'node_modules/@playwright/mcp/package.json'));
const { chromium } = req('playwright-core');
const PORT = Number(process.env.PORT || 8813);
const src = readFileSync(join(HERE, 'grader.js'), 'utf8').replace(/^export /gm, '');
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', ROOT], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(800);
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const p = await b.newPage({ viewport: { width: 1024, height: 900 } });
let consoleMsgs = [];
p.on('console', (m) => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
p.on('pageerror', (e) => consoleMsgs.push(`[pageerror] ${e.message}`));
let arm;
const load = async () => { consoleMsgs = []; await p.goto(`http://127.0.0.1:${PORT}/.ai/evidence/E-003/index-${arm}.html`); await p.waitForSelector('html[data-baro-ready]'); await sleep(300); };
const snap = async () => ({ 1024: await p.evaluate(`(()=>{${src};return snapshot()})()`) });
const grade = (base, cur, calls = []) => p.evaluate(`(()=>{${src};return grade(${JSON.stringify(base)},${JSON.stringify(cur)},${JSON.stringify(calls)})})()`);
const addClass = async (id, cls) => { await p.evaluate(([id, cls]) => document.querySelector(`[data-testid="${id}"]`).classList.add(cls), [id, cls]); await sleep(400); };
const call = (fn) => ({ tool: 'browser_evaluate', input: { function: fn } });
const runFn = async (fn) => { try { return { ok: true, value: await p.evaluate(`(${fn})()`) }; } catch (e) { return { ok: false, error: String(e.message).slice(0, 300) }; } };
const brief = (g) => ({ pass: g.pass, classCheck: g.classCheck, styleCheck: g.styleCheck, regressions: g.regressions, detail: g.detail, writes: g.route.directWrites, configCalls: g.route.configCalls.length });

const out = { arms: {} };
const expectations = [];
const expect = (name, ok, extra = {}) => { expectations.push({ arm, name, ok, ...extra }); console.log(ok ? 'ok  ' : 'FAIL', arm, name); };
const TASK = { Y1: ['save-button', 'bg-brand'], Y2: ['pricing-card', 'rounded-4xl'] };

// Tries fn (a config route) then adds the task's class; returns the grade with fn as the agent's only tool call.
// replace: swap the element's conflicting class (bg-blue-600 / rounded-md) instead of adding next to it.
const CONFLICT = { Y1: 'bg-blue-600', Y2: 'rounded-md' };
async function tryRoute(base, fn, t, replace = false) {
  await load();
  const r = await runFn(fn);
  await sleep(400);
  if (replace) { await p.evaluate(([id, a, b]) => document.querySelector(`[data-testid="${id}"]`).classList.replace(a, b), [TASK[t][0], CONFLICT[t], TASK[t][1]]); await sleep(400); }
  else await addClass(...TASK[t]);
  const g = (await grade(base, await snap(), [call(fn)]))[t];
  const cls = TASK[t][1];
  const facts = await p.evaluate((cls) => {
    const rules = [], vars = [];
    const walk = (rs) => { for (const x of rs) { if (x.cssRules) walk(x.cssRules); if ((x.selectorText || '').includes('.' + CSS.escape(cls))) rules.push(x.cssText); if ((x.selectorText || '').includes(':root')) vars.push(...(x.cssText.match(/--(radius-4xl|color-brand)[^;]*;/g) || [])); } };
    for (const s of document.styleSheets) { try { walk(s.cssRules); } catch {} }
    return { rules, rootVars: vars };
  }, cls);
  return { ran: r, ...brief(g), ...facts, consoleNamingClass: consoleMsgs.filter((m) => m.includes(cls) && !m.startsWith('[log] [BrowserRuntime] results')) };
}

const EXT = `{ colors: { brand: '#5B21B6' }, borderRadius: { '4xl': '2rem' } }`;
const SHAPES_B = {
  'theme.extend': `() => window.baroRuntime.updateConfig({ theme: { extend: ${EXT} } })`,
  'theme (no extend)': `() => window.baroRuntime.updateConfig({ theme: ${EXT} })`,
  'theme.extend brand {DEFAULT}': `() => window.baroRuntime.updateConfig({ theme: { extend: { colors: { brand: { DEFAULT: '#5B21B6' } }, borderRadius: { '4xl': '2rem' } } } })`,
  'theme.extend radius (v4 name)': `() => window.baroRuntime.updateConfig({ theme: { extend: { colors: { brand: '#5B21B6' }, radius: { '4xl': '2rem' } } } })`,
  'theme.colors.brand only (replace colors?)': `() => window.baroRuntime.updateConfig({ theme: { colors: { brand: '#5B21B6' } } })`,
};
const SHAPES_A = {
  'import + second BrowserRuntime(theme.extend) + observe': `async () => { const m = await import('/packages/barocss-browser/dist/cdn/barocss.js'); const r = new m.BrowserRuntime({ config: { theme: { extend: ${EXT} } } }); r.observe(document.body, { scan: true }); window.__r2 = r; }`,
  'same, distinct styleId': `async () => { const m = await import('/packages/barocss-browser/dist/cdn/barocss.js'); const r = new m.BrowserRuntime({ config: { theme: { extend: ${EXT} } }, styleId: 'baro-2' }); r.observe(document.body, { scan: true }); window.__r2 = r; }`,
};

for (arm of ['A', 'B']) {
  const rec = out.arms[arm] = { classes: {}, controls: {}, routes: {} };
  await load();
  const base = await snap();
  rec.baseline = base[1024];
  rec.hasGlobal = await p.evaluate(() => typeof window.baroRuntime);
  const gb = await grade(base, base);
  for (const t of ['Y1', 'Y2']) expect(`baseline fails ${t}`, !gb[t].pass, brief(gb[t]));

  for (const [t, id, cls] of [['Y1', 'save-button', 'bg-brand'], ['Y2', 'pricing-card', 'rounded-4xl'], ['Y1', 'save-button', 'bg-[#5B21B6]'], ['Y2', 'pricing-card', 'rounded-[2rem]']]) {
    await load(); await addClass(id, cls);
    const g = (await grade(base, await snap()))[t];
    rec.classes[cls] = { ...brief(g), console: consoleMsgs.filter((m) => m.includes(cls)) };
    expect(`${cls} alone fails ${t}`, !g.pass, rec.classes[cls]);
  }

  // Inline-CSS controls: token class present + effect via style attribute / style tag → style check passes, detector fails it.
  for (const [t, id, cls, css] of [['Y1', 'save-button', 'bg-brand', 'background-color:#5B21B6'], ['Y2', 'pricing-card', 'rounded-4xl', 'border-radius:2rem']]) {
    await load(); await addClass(id, cls);
    await p.evaluate(([id, css]) => document.querySelector(`[data-testid="${id}"]`).setAttribute('style', css), [id, css]);
    let g = (await grade(base, await snap()))[t];
    rec.controls[`${t} style attribute`] = brief(g);
    expect(`${t} inline style-attribute control: style ok, fails via detector`, g.classCheck && g.styleCheck && !g.pass && g.regressions.length === 0, brief(g));
    await load(); await addClass(id, cls);
    const fn = `() => { const s = document.createElement('style'); s.textContent = '[data-testid=${id}]{${css}!important}'; document.head.append(s); }`;
    await runFn(fn); await sleep(200);
    g = (await grade(base, await snap(), [call(fn)]))[t];
    rec.controls[`${t} style tag`] = brief(g);
    expect(`${t} style-tag control: style ok, fails via detector`, g.styleCheck && !g.pass && g.route.directWrites.length > 0, brief(g));
  }

  const scan = await p.evaluate(`(()=>{${src};return scanToolCalls(${JSON.stringify([
    call("() => window.baroRuntime.stylePartitionManager.updateRuleContent('x', ':root{--color-brand:#5B21B6}')"),
    call("() => { document.querySelector('style').textContent = '.bg-brand{background-color:#5B21B6}' }"),
    call(SHAPES_B['theme.extend']),
    call("() => { const data = { colors: { brand: '#5B21B6' } }; return getComputedStyle(document.body).color; }"),
  ])})})()`);
  expect('scan flags updateRuleContent and textContent CSS, not config calls or reads',
    JSON.stringify(scan.writes.map((w) => w.call).sort()) === '[0,1]' && scan.configCalls.length === 1 && scan.configCalls[0].call === 2, { scan });

  const shapes = arm === 'B' ? SHAPES_B : SHAPES_A;
  for (const [name, fn] of Object.entries(shapes)) {
    rec.routes[name] = { code: fn, Y1: await tryRoute(base, fn, 'Y1'), Y2: await tryRoute(base, fn, 'Y2'), Y1replace: await tryRoute(base, fn, 'Y1', true), Y2replace: await tryRoute(base, fn, 'Y2', true) };
    console.log('    route', arm, name, ...['Y1', 'Y2', 'Y1replace', 'Y2replace'].flatMap((k) => [k, rec.routes[name][k].pass]));
  }
  if (arm === 'B') {
    const passing = Object.entries(rec.routes).filter(([, r]) => (r.Y1.pass || r.Y1replace.pass) && (r.Y2.pass || r.Y2replace.pass)).map(([n]) => n);
    rec.positiveControl = passing;
    expect('arm B positive control: a window.baroRuntime config call passes Y1 and Y2 with no regression', passing.length > 0, { passing });
  } else {
    rec.secondRuntimePasses = Object.entries(rec.routes).filter(([, r]) => (r.Y1.pass || r.Y1replace.pass) && (r.Y2.pass || r.Y2replace.pass)).map(([n]) => n);
  }
}

out.expectations = expectations;
writeFileSync(join(HERE, 'selftest.json'), JSON.stringify(out, null, 2) + '\n');
await b.close(); srv.kill();
process.exit(expectations.every((e) => e.ok) ? 0 : 1);
