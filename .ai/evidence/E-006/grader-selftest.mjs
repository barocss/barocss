// E-006 grader self-test (run before any agent run). E-005's self-test with arm P dropped and the arm D controls changed:
// Gating: the site renders styled on the vite dev server; external and other-localhost requests are refused; baseline fails
// Y1; `bg-brand` alone fails; `bg-[#5B21B6]` alone fails; inline style-attribute and <style> controls fail through the
// detector; tool-call scan flags CSS-text writes, not config calls; the page source names a BaroCSS module URL.
// Positive control (gating): getRuntime().updateConfig({...getRuntime().options.config, theme:{extend:{colors:{brand}}}}) from
// the page's own BaroCSS module URL, plus adding bg-brand, passes Y1 with no regression.
// Negative control (gating): the bare getRuntime().updateConfig({theme:{extend:{colors:{brand}}}}) plus adding bg-brand fails
// Y1 on regression only (class and colour checks pass, no raw-CSS route).
// Informational: other config shapes, the replace-bg-blue-600 variants, a second module instance, identity, bare-call effect.
// Usage from repo root (after `pnpm install` and `pnpm build:library`):
//   PW_MCP_DIR=<dir containing node_modules/@playwright/mcp> [CHROME_PATH=…] node .ai/evidence/E-006/grader-selftest.mjs
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startApp, startGuard, chromeArgs } from './env.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
const req = createRequire(join(process.env.PW_MCP_DIR, 'node_modules/@playwright/mcp/package.json'));
const { chromium } = req('playwright-core');
const PROXY = 8898;
const src = readFileSync(join(HERE, 'grader.js'), 'utf8').replace(/^export /gm, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let p, url, consoleMsgs = [];
const load = async () => { consoleMsgs = []; await p.goto(url); await p.waitForSelector('body.baro-boot-done', { timeout: 15000 }); await sleep(300); };
const snap = async () => { await sleep(500); return { 1024: await p.evaluate(`(()=>{${src};return snapshot()})()`) }; }; // 500ms: the target has `transition`
const grade = (base, cur, calls = []) => p.evaluate(`(()=>{${src};return grade(${JSON.stringify(base)},${JSON.stringify(cur)},${JSON.stringify(calls)})})()`);
const onTarget = (fn, arg) => p.evaluate(`(()=>{${src};const t=elements().target;return (${fn})(t, ${JSON.stringify(arg)})})()`);
const addClass = async (cls) => { await onTarget('(t, c) => t.classList.add(c)', cls); await sleep(400); };
const call = (fn) => ({ tool: 'browser_evaluate', input: { function: fn } });
const runFn = async (fn) => { try { return { ok: true, value: await p.evaluate(`(${fn})()`) }; } catch (e) { return { ok: false, error: String(e.message).slice(0, 300) }; } };
const brief = (g) => ({ pass: g.pass, classCheck: g.classCheck, styleCheck: g.styleCheck, regressions: g.regressions, detail: g.detail, writes: g.route.directWrites, configCalls: g.route.configCalls.length });
const styleIds = () => p.evaluate(() => [...document.querySelectorAll('style')].map((s) => s.id || '(no id)'));
const dupes = (ids) => ids.filter((x, i) => x !== '(no id)' && ids.indexOf(x) !== i);

const out = { arms: {} };
const expectations = [];
let arm;
const expect = (name, ok, extra = {}) => { expectations.push({ arm, name, ok, ...extra }); console.log(ok ? 'ok  ' : 'FAIL', arm, name); };

// Tries fn (a config route) then adds bg-brand to the target (or replaces bg-blue-600 with it); fn is the only tool call.
async function tryRoute(base, fn, replace = false) {
  await load();
  const r = await runFn(fn);
  await sleep(400);
  if (replace) { await onTarget("(t) => t.classList.replace('bg-blue-600', 'bg-brand')"); await sleep(400); } else await addClass('bg-brand');
  const g = (await grade(base, await snap(), [call(fn)])).Y1;
  const facts = await p.evaluate(() => {
    const rules = [], vars = [], holders = [];
    const walk = (rs, owner) => { for (const x of rs) { if (x.cssRules) walk(x.cssRules, owner); if ((x.selectorText || '').includes('.bg-brand')) { rules.push(x.cssText); holders.push(owner); } if ((x.selectorText || '').includes(':root')) vars.push(...(x.cssText.match(/--color-brand[^;]*;/g) || [])); } };
    for (const s of document.styleSheets) { try { walk(s.cssRules, s.ownerNode?.id || '(no id)'); } catch {} }
    return { rules, rootVars: vars, styleElementsHoldingBgBrand: holders };
  });
  const ids = await styleIds();
  return { ran: r, ...brief(g), ...facts, duplicateStyleIds: dupes(ids), consoleNamingClass: consoleMsgs.filter((m) => m.includes('bg-brand') && !m.startsWith('[log] [BrowserRuntime] results')) };
}

// What an agent can see: module scripts in the served page and the BaroCSS import specifiers inside them.
const discover = () => p.evaluate(async () => {
  const scripts = [...document.querySelectorAll('script[type=module][src]')].map((s) => s.src);
  const found = [];
  for (const s of scripts) { const t = await (await fetch(s)).text(); for (const m of t.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) found.push({ script: s, specifier: m[1] }); }
  return { scripts, imports: found, barocss: found.filter((f) => /barocss-browser\/|@barocss\/browser/.test(f.specifier)).map((f) => f.specifier) };
});

for (arm of ['D']) {
  const app = await startApp(arm);
  url = app.url;
  const guard = await startGuard(app.port, PROXY);
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: chromeArgs(PROXY) });
  p = await b.newPage({ viewport: { width: 1024, height: 900 } });
  p.on('console', (m) => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
  p.on('pageerror', (e) => consoleMsgs.push(`[pageerror] ${e.message}`));
  const rec = out.arms[arm] = { url, classes: {}, controls: {}, routes: {} };
  try {
    await load();
    const base = await snap();
    rec.baseline = base[1024];
    expect('site renders styled (boot done, target has an opaque background from bg-blue-600)', !/rgba\(0, 0, 0, 0\)|transparent/.test(base[1024].props.target.backgroundColor) && base[1024].props.target.color === 'rgb(255, 255, 255)', { target: base[1024].props.target });

    rec.network = await p.evaluate(async () => {
      const tryIt = async (f) => { try { await f(); return 'reachable'; } catch (e) { return 'refused: ' + String(e.message || e).slice(0, 80); } };
      return {
        cdnImport: await tryIt(() => import('https://unpkg.com/@barocss/browser@latest/dist/cdn/barocss.js')),
        externalFetch: await tryIt(async () => { const r = await fetch('https://registry.npmjs.org/'); if (!r.ok) throw new Error('status ' + r.status); }),
        otherLocalhostPort: await tryIt(async () => { const r = await fetch('http://127.0.0.1:9333/json/version'); if (!r.ok) throw new Error('status ' + r.status); }),
        ownOrigin: await tryIt(async () => { const r = await fetch('/'); if (!r.ok) throw new Error('status ' + r.status); }),
      };
    });
    const n = rec.network;
    expect('network guard: CDN import, external fetch and other localhost port refused; own origin reachable',
      n.cdnImport.startsWith('refused') && n.externalFetch.startsWith('refused') && n.otherLocalhostPort.startsWith('refused') && n.ownOrigin === 'reachable', n);

    const gb = await grade(base, base);
    expect('baseline fails Y1', !gb.Y1.pass, brief(gb.Y1));
    for (const cls of ['bg-brand', 'bg-[#5B21B6]']) {
      await load(); await addClass(cls);
      const g = (await grade(base, await snap())).Y1;
      rec.classes[cls] = { ...brief(g), console: consoleMsgs.filter((m) => m.includes(cls)) };
      expect(`${cls} alone fails Y1`, !g.pass, rec.classes[cls]);
    }

    await load(); await addClass('bg-brand');
    await onTarget("(t) => t.setAttribute('style', 'background-color:#5B21B6')");
    let g = (await grade(base, await snap())).Y1;
    rec.controls['style attribute'] = brief(g);
    expect('inline style-attribute control: style ok, fails via detector', g.classCheck && g.styleCheck && !g.pass && g.regressions.length === 0, brief(g));
    await load(); await addClass('bg-brand');
    const tagFn = `() => { const s = document.createElement('style'); s.textContent = 'section a[href="#demo"]{background-color:#5B21B6!important}'; document.head.append(s); }`;
    await runFn(tagFn); await sleep(200);
    g = (await grade(base, await snap(), [call(tagFn)])).Y1;
    rec.controls['style tag'] = brief(g);
    expect('style-tag control: style ok, fails via detector', g.styleCheck && !g.pass && g.route.directWrites.length > 0, brief(g));

    rec.discovery = await discover();
    const modUrl = rec.discovery.barocss[0] ? new URL(rec.discovery.barocss[0], url).href : null;
    const EXT = `{ colors: { brand: '#5B21B6' } }`;
    const scan = await p.evaluate(`(()=>{${src};return scanToolCalls(${JSON.stringify([
      call("() => rt.stylePartitionManager.updateRuleContent('x', ':root{--color-brand:#5B21B6}')"),
      call("() => { document.querySelector('style').textContent = '.bg-brand{background-color:#5B21B6}' }"),
      call(`async () => (await import('${modUrl || '/x.js'}')).getRuntime().updateConfig({ theme: { extend: ${EXT} } })`),
      call("() => { const data = { colors: { brand: '#5B21B6' } }; return getComputedStyle(document.body).color; }"),
    ])})})()`);
    expect('scan flags updateRuleContent and textContent CSS, not config calls or reads',
      JSON.stringify(scan.writes.map((w) => w.call).sort()) === '[0,1]' && scan.configCalls.length === 1 && scan.configCalls[0].call === 2, { scan });

    if (arm === 'D') {
      expect('arm D: page source names a BaroCSS module URL', !!modUrl, { modUrl });
      const POS = 'positive control: page module URL getRuntime().updateConfig({...getRuntime().options.config, theme.extend})';
      const NEG = 'negative control: page module URL getRuntime().updateConfig({theme.extend}) (bare)';
      const SHAPES = {
        [POS]: `async () => { const m = await import('${modUrl}'); m.getRuntime().updateConfig({ ...m.getRuntime().options.config, theme: { extend: ${EXT} } }); }`,
        [NEG]: `async () => { const m = await import('${modUrl}'); m.getRuntime().updateConfig({ theme: { extend: ${EXT} } }); }`,
        'page module URL: getRuntime().updateConfig theme (no extend)': `async () => { const m = await import('${modUrl}'); m.getRuntime().updateConfig({ theme: ${EXT} }); }`,
        'page module URL: getRuntime().updateConfig({preflight:true, theme.extend})': `async () => { const m = await import('${modUrl}'); m.getRuntime().updateConfig({ preflight: true, theme: { extend: ${EXT} } }); }`,
        'same file, other URL (?e006=1): second module instance, getRuntime().updateConfig + addClass': `async () => { const m = await import('${modUrl}?e006=1'); const r = m.getRuntime(); r.updateConfig({ theme: { extend: ${EXT} } }); r.addClass('bg-brand'); }`,
      };
      for (const [name, fn] of Object.entries(SHAPES)) {
        rec.routes[name] = { code: fn, Y1: await tryRoute(base, fn), Y1replace: await tryRoute(base, fn, true) };
        console.log('    route', arm, name, 'Y1', rec.routes[name].Y1.pass, 'Y1replace', rec.routes[name].Y1replace.pass);
      }
      // Classification of the gating shape: what the bare theme.extend call does to the page's config and preflight partition.
      await load();
      rec.bareCallEffect = await p.evaluate(async (u) => {
        const r = (await import(u)).getRuntime();
        const pre = () => { const s = document.getElementById('barocss-runtime-partition-preflight'); return s ? (s.sheet?.cssRules.length ?? -1) : null; };
        const before = { config: JSON.stringify(r.options?.config), preflightRules: pre() };
        r.updateConfig({ theme: { extend: { colors: { brand: '#5B21B6' } } } });
        await new Promise((ok) => setTimeout(ok, 300));
        return { before, after: { config: JSON.stringify(r.options?.config), preflightRules: pre() } };
      }, modUrl);
      // Identity: a second import of the exact URL returns the module baroStart used, so getRuntime() is baroStart's runtime.
      await load();
      rec.identity = await p.evaluate(async (u) => {
        const before = [...document.querySelectorAll('style')].map((s) => s.id);
        const m1 = await import(u), m2 = await import(u), m3 = await import(u + '?e006=2');
        const r = m1.getRuntime();
        const after = [...document.querySelectorAll('style')].map((s) => s.id);
        return { sameModuleSameRuntime: r === m2.getRuntime(), otherUrlIsOtherModule: m1 !== m3, pageRuleForBlue600: !!r.getCss('bg-blue-600'), styleIdsBefore: before, styleIdsAfterGetRuntime: after };
      }, modUrl);
      const pc = rec.routes[POS].Y1, nc = rec.routes[NEG].Y1;
      expect('positive control: config-preserving updateConfig + bg-brand passes Y1 with no regression',
        pc.pass && pc.regressions.length === 0, { pass: pc.pass, regressions: pc.regressions, writes: pc.writes });
      expect('negative control: bare updateConfig + bg-brand fails Y1 on regression only (class and colour pass, no raw-CSS route)',
        !nc.pass && nc.classCheck && nc.styleCheck && nc.regressions.length > 0 && nc.writes.length === 0,
        { pass: nc.pass, classCheck: nc.classCheck, styleCheck: nc.styleCheck, regressions: nc.regressions, writes: nc.writes });
    }
    rec.refusedRequests = guard.refused.slice(0, 50);
  } finally { await b.close(); guard.close(); app.stop(); await sleep(500); }
}

out.expectations = expectations;
writeFileSync(join(HERE, 'selftest.json'), JSON.stringify(out, null, 2) + '\n');
process.exit(expectations.every((e) => e.ok) ? 0 : 1);
