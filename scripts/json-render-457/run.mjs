// #457 deterministic serial browser comparison. No model, downloads, or external data.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { ARMS, HOST_CSS, INVENTORIES, REPEATS, VIEWPORTS } from './baseline.mjs';
import { CASES, PLANNED_CELLS, initialState, scenarioFor, specFor, supportFor } from './cases.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const jrRoot = process.env.JR_ROOT;
const pwDir = process.env.PW_DIR;
const chrome = process.env.CHROME;
if (!jrRoot || !pwDir || !chrome || !fs.existsSync(chrome)) throw new Error('Set JR_ROOT, PW_DIR and CHROME to approved local assets');
const sha = (value) => createHash('sha256').update(value).digest('hex');
const frozenBytes = fs.readFileSync(path.join(here, 'baseline.json'));
const frozen = JSON.parse(frozenBytes);
const evidence = process.env.RESULT_DIR || path.join(here, 'evidence', `primary-${sha(frozenBytes).slice(0, 12)}`);
const shots = path.join(evidence, 'shots');
if (fs.existsSync(path.join(evidence, 'result.json'))) throw new Error(`Result exists: ${evidence}; set RESULT_DIR for a new run`);
const fromRepo = createRequire(path.join(root, 'packages/barocss/package.json'));
const fromPW = createRequire(path.join(pwDir, 'package.json'));
const { compile } = fromRepo('tailwindcss');
const esbuild = fromRepo('esbuild');
const { chromium } = fromPW('playwright-core');
const themeCSS = fs.readFileSync(path.join(root, 'scripts/json-render-probe/e2e/app.css'), 'utf8');
const twDir = path.dirname(fromRepo.resolve('tailwindcss/package.json'));
async function buildCSS(tokens) {
  const compiler = await compile(`@import "tailwindcss";\n${themeCSS}`, {
    base: twDir,
    loadStylesheet: async (id, base) => {
      const name = id.replace(/^tailwindcss\//, '');
      const candidate = id === 'tailwindcss' ? path.join(twDir, 'index.css') : path.resolve(base, name);
      const file = fs.existsSync(candidate) ? candidate : path.join(twDir, name);
      return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
    },
  });
  return compiler.build([...new Set(tokens)].sort()) + '\n' + HOST_CSS;
}
const css = {};
for (const arm of ARMS) {
  css[arm] = await buildCSS(INVENTORIES[arm]);
  if (sha(css[arm]) !== frozen.inventory[arm].cssSha256) throw new Error(`${arm} CSS drift from frozen baseline`);
}
const app = await esbuild.build({
  entryPoints: [path.join(here, 'browser-app.jsx')], bundle: true, write: false,
  platform: 'browser', format: 'iife', jsx: 'automatic',
  nodePaths: [path.join(jrRoot, 'node_modules')], define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'error',
});
const appJS = app.outputFiles[0].contents;
const baroJS = fs.readFileSync(path.join(root, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs'));
if (sha(baroJS) !== frozen.baroBundleSha256) throw new Error('BaroCSS bundle drift from frozen baseline');
const shell = (arm) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/${arm}"></head><body><div id="host">Host app sentinel</div><main id="out"></main>${arm === 'utility' ? '<script src="/baro.js"></script><script>BaroCSS.baroStart({skipExisting:true,config:{cssVarPrefix:"tw",theme:{extend:BaroCSS.shadcnTheme}}});</script>' : ''}<script src="/app.js"></script></body></html>`;
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const send = (type, body) => { res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body); };
  if (u.pathname === '/') { const arm = u.searchParams.get('arm'); if (ARMS.includes(arm)) return send('text/html', shell(arm)); }
  if (u.pathname === '/app.js') return send('text/javascript', appJS);
  if (u.pathname === '/baro.js') return send('text/javascript', baroJS);
  const match = u.pathname.match(/^\/css\/(preset|variable|utility|build)$/);
  if (match) return send('text/css', css[match[1]]);
  res.writeHead(404); res.end();
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const baseURL = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: chrome, headless: true });
fs.mkdirSync(shots, { recursive: true });
const rows = [];
const policyNegatives = [];
const take = async (page, assertion, targetSelector) => page.evaluate(async ({ assertion, targetSelector }) => {
  const layout = document.querySelector('[data-node-id="layout"]');
  const button = document.querySelector('button[data-node-id]');
  const host = document.getElementById('host');
  const target = document.querySelector(targetSelector);
  const color = (name) => { const node = document.createElement('span'); node.style.backgroundColor = `var(--${name})`; document.body.append(node); const value = getComputedStyle(node).backgroundColor; node.remove(); return value; };
  const theme = { card: color('card'), primary: color('primary') };
  const sample = () => {
    const c = getComputedStyle(layout), b = getComputedStyle(button), h = getComputedStyle(host);
    const columns = c.gridTemplateColumns === 'none' ? 0 : c.gridTemplateColumns.trim().split(/\s+/).length;
    let ruleCount = 0, cssomBytes = 0;
    const encoder = new TextEncoder();
    for (const sheet of document.styleSheets) {
      try { for (const rule of sheet.cssRules) { ruleCount++; cssomBytes += encoder.encode(rule.cssText).length; } }
      catch { /* no cross-origin sheets are allowed */ }
    }
    const computed = { paddingPx: parseFloat(c.paddingTop), gapPx: parseFloat(c.columnGap), radiusPx: parseFloat(c.borderTopLeftRadius), columns,
      hoverUnderline: b.textDecorationLine.includes('underline'), hoverItalic: b.fontStyle === 'italic', uppercase: b.textTransform === 'uppercase',
      layoutBackground: c.backgroundColor, buttonBackground: b.backgroundColor,
      host: [h.color, h.backgroundColor, h.fontSize, h.position, h.zIndex],
      ruleCount, cssomBytes, inlineStyleBytes: [...document.querySelectorAll('style')].reduce((n, node) => n + node.textContent.length, 0) };
    return { ...computed, matches: Object.entries(assertion).every(([key, expected]) => computed[key] === expected),
      themeAdherence: computed.layoutBackground === theme.card && computed.buttonBackground === theme.primary };
  };
  const frames = [sample()];
  for (let n = 0; n < 3; n++) { await new Promise(requestAnimationFrame); frames.push(sample()); }
  return { frames, final: frames.at(-1), unmetFrames: frames.filter((frame) => !frame.matches).length,
    domSignature: [...document.querySelectorAll('[data-node-id]')].map((node) => node.getAttribute('data-node-id')),
    inputValue: target?.value ?? null, focusPreserved: document.activeElement === target };
}, { assertion, targetSelector });
try {
  for (const editCase of CASES) for (const viewportName of Object.keys(VIEWPORTS)) for (const arm of ARMS) for (let repeat = 0; repeat < REPEATS; repeat++) {
    const support = supportFor(editCase, arm);
    const fixture = scenarioFor(editCase);
    const targetNode = fixture.nodes.find((node) => node.id === fixture.interaction.target);
    const targetSelector = `[data-node-id="${fixture.interaction.target}"] ${targetNode.type === 'Select' ? 'select' : 'input'}`;
    const buttonId = fixture.nodes.find((node) => node.action === fixture.interaction.action).id;
    const key = `${editCase.id}--${viewportName}--${arm}--${repeat}`;
    const page = await browser.newPage({ viewport: VIEWPORTS[viewportName], reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', (error) => errors.push(`pageerror:${String(error.message).slice(0, 180)}`));
    page.on('request', (request) => { if (!request.url().startsWith(baseURL)) errors.push(`external-request:${request.url().slice(0, 160)}`); });
    let initial = { ok: false, errors: ['not run'] }, edited = { ok: false, errors: ['not run'] }, measure = null, actionCount = null, stateValue = null, screenshot = null, hostBefore = null, cssBefore = null;
    try {
      await page.goto(`${baseURL}/?arm=${arm}`, { waitUntil: 'load' });
      hostBefore = await page.evaluate(() => { const h = getComputedStyle(document.getElementById('host')); return [h.color, h.backgroundColor, h.fontSize, h.position, h.zIndex]; });
      initial = await page.evaluate(({ arm, state, spec }) => window.REPLAY.mount(arm, state, spec), { arm, state: initialState(editCase.scenario), spec: specFor(editCase, arm, false) });
      if (initial.ok) {
        if (targetNode.type === 'Select') await page.locator(targetSelector).selectOption(fixture.interaction.enter);
        else await page.locator(targetSelector).fill(fixture.interaction.enter);
        await page.locator(targetSelector).focus();
        cssBefore = await page.evaluate(() => {
          let ruleCount = 0, cssomBytes = 0;
          const encoder = new TextEncoder();
          for (const sheet of document.styleSheets) {
            try { for (const rule of sheet.cssRules) { ruleCount++; cssomBytes += encoder.encode(rule.cssText).length; } }
            catch { /* no cross-origin sheets are allowed */ }
          }
          return { ruleCount, cssomBytes };
        });
        edited = await page.evaluate((spec) => window.REPLAY.update(spec), specFor(editCase, arm, true));
        if (edited.ok) {
          if (editCase.assertion.hoverUnderline || editCase.assertion.hoverItalic) await page.locator(`[data-node-id="${buttonId}"]`).hover();
          measure = await take(page, editCase.assertion, targetSelector);
          screenshot = `shots/${key}.png`;
          await page.screenshot({ path: path.join(evidence, screenshot) });
          await page.locator(`[data-node-id="${buttonId}"]`).click();
          await page.waitForFunction(() => window.REPLAY.actions().length >= 1, null, { timeout: 2000 });
          actionCount = await page.evaluate(() => window.REPLAY.actions().length);
          stateValue = await page.evaluate((name) => window.REPLAY.state()?.[name] ?? null, fixture.interaction.target);
        }
      }
    } catch (error) { errors.push(`runner:${String(error.message).slice(0, 180)}`); }
    finally { await page.close(); }
    const expectedIds = ['layout', ...fixture.nodes.map((node) => node.id)];
    const domPass = JSON.stringify(measure?.domSignature) === JSON.stringify(expectedIds);
    const inputValuePreserved = measure?.inputValue === fixture.interaction.enter && stateValue === fixture.interaction.enter;
    const actionPass = actionCount === fixture.interaction.expectedActionCount;
    const themeAdherence = measure?.final?.themeAdherence === true;
    const hostStyleDelta = measure?.final ? JSON.stringify(measure.final.host) !== JSON.stringify(hostBefore) : null;
    const observedStylePass = measure?.final?.matches === true;
    const semanticPass = initial.ok && edited.ok && domPass && inputValuePreserved && measure?.focusPreserved === true && actionPass && themeAdherence && hostStyleDelta === false && errors.length === 0;
    const outcome = !semanticPass ? 'failure' : !support.supported ? 'unsupported' : observedStylePass ? 'pass' : 'failure';
    rows.push({ id: key, caseId: editCase.id, scenario: editCase.scenario, kind: editCase.kind, viewport: viewportName, arm, repeat,
      support, outcome, specValid: initial.ok && edited.ok, validationErrors: [...initial.errors, ...edited.errors], domSignature: measure?.domSignature ?? [], domPass,
      inputValue: measure?.inputValue ?? null, stateValue, inputValuePreserved, focusPreserved: measure?.focusPreserved ?? false,
      actionCount, actionPass, observedStylePass, coincidentalComputedMatch: !support.supported && observedStylePass, unmetFrames: measure?.unmetFrames ?? null, themeAdherence, hostStyleDelta,
      frozenCssBytes: Buffer.byteLength(css[arm]), inlineStyleBytes: measure?.final?.inlineStyleBytes ?? null,
      ruleCount: measure?.final?.ruleCount ?? null, cssomBytes: measure?.final?.cssomBytes ?? null,
      beforeEditCss: cssBefore, generatedRuleCount: cssBefore && measure ? measure.final.ruleCount - cssBefore.ruleCount : null,
      generatedRuleBytes: cssBefore && measure ? measure.final.cssomBytes - cssBefore.cssomBytes : null, frames: measure?.frames ?? [], computed: measure?.final ?? null, screenshot, errors });
    if (editCase.id === CASES[0].id && viewportName === 'desktop' && arm === 'variable' && repeat === 0) {
      const negativePage = await browser.newPage({ viewport: VIEWPORTS.desktop, reducedMotion: 'reduce' });
      const negativeErrors = [];
      negativePage.on('pageerror', (error) => negativeErrors.push(`pageerror:${String(error.message).slice(0, 180)}`));
      negativePage.on('request', (request) => { if (!request.url().startsWith(baseURL)) negativeErrors.push(`external-request:${request.url().slice(0, 160)}`); });
      try {
        await negativePage.goto(`${baseURL}/?arm=variable`, { waitUntil: 'load' });
        const original = specFor(editCase, 'variable', false);
        const mounted = await negativePage.evaluate(({ state, spec }) => window.REPLAY.mount('variable', state, spec), { state: initialState(editCase.scenario), spec: original });
        if (!mounted.ok) throw new Error('policy negative setup invalid');
        const before = await negativePage.evaluate(() => ({ html: document.getElementById('out').innerHTML, style: document.querySelector('[data-node-id="layout"]').getAttribute('style') }));
        const invalidProps = [
          ['url-string', { variables: { paddingPx: 'url(https://example.test/x)' } }],
          ['wrong-type', { density: 'loose' }],
          ['nonfinite', { variables: { paddingPx: Infinity } }],
          ['below-range', { variables: { paddingPx: -1 } }],
          ['above-range', { variables: { paddingPx: 33 } }],
          ['unknown-field', { variables: { paddingPx: 20, arbitraryCss: 'red' } }],
        ];
        for (const [name, overrides] of invalidProps) {
          const invalid = structuredClone(original); Object.assign(invalid.elements.layout.props, overrides);
          const result = await negativePage.evaluate((spec) => window.REPLAY.update(spec), invalid);
          const after = await negativePage.evaluate(() => ({ html: document.getElementById('out').innerHTML, style: document.querySelector('[data-node-id="layout"]').getAttribute('style') }));
          policyNegatives.push({ name, rejected: !result.ok, validationErrors: result.errors, unchanged: JSON.stringify(before) === JSON.stringify(after), errors: [...negativeErrors] });
        }
      } finally { await negativePage.close(); }
    }
  }
} finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
const summary = Object.fromEntries(ARMS.map((arm) => { const subset = rows.filter((row) => row.arm === arm); return [arm, {
  planned: subset.length, supported: subset.filter((row) => row.support.supported).length,
  pass: subset.filter((row) => row.outcome === 'pass').length,
  observedRequirementMatch: subset.filter((row) => row.observedStylePass).length,
  unsupported: subset.filter((row) => row.outcome === 'unsupported').length,
  failure: subset.filter((row) => row.outcome === 'failure').length,
  coincidentalComputedMatch: subset.filter((row) => row.coincidentalComputedMatch).length,
}]; }));
const report = { kind: 'bounded-authored-json-render-styling-comparison', baselineSha256: sha(frozenBytes),
  caseCount: CASES.length, plannedCells: PLANNED_CELLS, measuredCells: rows.length, repeats: REPEATS,
  viewports: VIEWPORTS, arms: ARMS, serial: true, policyNegatives,
  artifactHashes: { appBundleSha256: sha(appJS), baroBundleSha256: sha(baroJS), themeSha256: sha(themeCSS),
    adapterSourceSha256: sha(fs.readFileSync(path.join(here, 'browser-app.jsx'))),
    casesSourceSha256: sha(fs.readFileSync(path.join(here, 'cases.mjs'))),
    runnerSourceSha256: sha(fs.readFileSync(path.join(here, 'run.mjs'))) },
  summary, rows };
fs.writeFileSync(path.join(evidence, 'result.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ measuredCells: rows.length, summary, policyNegatives }, null, 2));
if (rows.length !== PLANNED_CELLS) process.exitCode = 1;
