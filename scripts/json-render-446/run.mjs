// #446 deterministic official json-render browser replay. No model generation or external requests.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ARMS, SCENARIOS, validateContract } from './contract.mjs';
import { initialState, specFor } from './spec.mjs';
import { BASE_TOKENS, ALL_LAYOUT_TOKENS, INITIAL_LAYOUT_TOKENS } from './styles.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const SCRATCH = path.join(HERE, 'scratch');
const EVIDENCE = path.join(HERE, 'evidence');
const JR_ROOT = process.env.JR_ROOT || path.join(SCRATCH, 'jr');
const REPO_DEPS_ROOT = process.env.REPO_DEPS_ROOT || ROOT;
const PW_DIR = process.env.PW_DIR;
const CHROME = process.env.CHROME;
const REPEATS = Number(process.env.REPEATS || 2);
if (validateContract().length) throw new Error('frozen contract invalid');
if (!PW_DIR || !CHROME || !fs.existsSync(CHROME)) throw new Error('Set PW_DIR and CHROME to an installed matching Playwright/Chromium pair');
if (!Number.isInteger(REPEATS) || REPEATS < 2) throw new Error('REPEATS must be at least 2');
const fromRepo = createRequire(path.join(REPO_DEPS_ROOT, 'packages/barocss/package.json'));
const fromPW = createRequire(path.join(PW_DIR, 'package.json'));
const fromJR = createRequire(path.join(JR_ROOT, 'package.json'));
const { compile } = fromRepo('tailwindcss');
const esbuild = fromRepo('esbuild');
const { chromium } = fromPW('playwright-core');
for (const name of ['@json-render/core', '@json-render/react', 'react', 'react-dom']) fromJR.resolve(name);
const BARO = path.join(EVIDENCE, 'baro.umd.cjs');
if (!fs.existsSync(BARO)) throw new Error('Pinned BaroCSS bundle missing: evidence/baro.umd.cjs');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const bundleBytes = fs.readFileSync(BARO);
const themeCSS = fs.readFileSync(path.join(ROOT, 'scripts/json-render-probe/e2e/app.css'), 'utf8');
const twDir = path.dirname(fromRepo.resolve('tailwindcss/package.json'));
fs.mkdirSync(SCRATCH, { recursive: true });
await esbuild.build({
  entryPoints: [path.join(HERE, 'browser-app.jsx')], outfile: path.join(SCRATCH, 'app.js'),
  bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
  nodePaths: [path.join(JR_ROOT, 'node_modules')], define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'error',
});
const appJS = fs.readFileSync(path.join(SCRATCH, 'app.js'));
async function buildCSS(tokens) {
  const compiler = await compile(`@import "tailwindcss";\n${themeCSS}`, {
    base: twDir,
    loadStylesheet: async (id, base) => {
      const p = id === 'tailwindcss' ? path.join(twDir, 'index.css') : path.resolve(base, id.replace(/^tailwindcss\//, ''));
      const file = fs.existsSync(p) ? p : path.join(twDir, id.replace(/^tailwindcss\//, ''));
      return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
    },
  });
  return compiler.build([...new Set(tokens)]) + '\nbody{margin:0;font-family:system-ui,sans-serif}#host{padding:12px;border-bottom:1px solid var(--border);color:var(--foreground);background:var(--background)}#out{padding:18px}';
}
const css = {};
for (const arm of Object.keys(ARMS)) css[arm] = await buildCSS([...BASE_TOKENS, ...(arm === 'fixed' || arm === 'bounded' ? ALL_LAYOUT_TOKENS : INITIAL_LAYOUT_TOKENS)]);
const inventory = Object.fromEntries(Object.keys(ARMS).map((arm) => [arm, { tokens: [...new Set([...BASE_TOKENS, ...(arm === 'fixed' || arm === 'bounded' ? ALL_LAYOUT_TOKENS : INITIAL_LAYOUT_TOKENS)])].sort(), cssSha256: sha(css[arm]) }]));
const shell = (arm) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/${arm}"></head><body><div id="host">Host app sentinel</div><main id="out"></main>${arm === 'utility' ? '<script src="/baro.js"></script><script>BaroCSS.baroStart({skipExisting:true,config:{cssVarPrefix:"tw",theme:{extend:BaroCSS.shadcnTheme}}});</script>' : ''}<script src="/app.js"></script></body></html>`;
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const send = (type, body) => { res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body); };
  if (u.pathname === '/') { const arm = u.searchParams.get('arm'); if (ARMS[arm]) return send('text/html', shell(arm)); }
  if (u.pathname === '/app.js') return send('text/javascript', appJS);
  if (u.pathname === '/baro.js') return send('text/javascript', bundleBytes);
  const match = u.pathname.match(/^\/css\/(fixed|bounded|utility|build)$/);
  if (match) return send('text/css', css[match[1]]);
  res.writeHead(404); res.end();
});
await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
const baseURL = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const rows = [];
const shotDir = path.join(EVIDENCE, 'shots');
fs.mkdirSync(shotDir, { recursive: true });
const capture = async (page, expected, edit) => page.evaluate(async ({ expected, edit }) => {
  const result = edit.mode === 'mount'
    ? window.REPLAY.mount(edit.arm, edit.state, edit.spec)
    : window.REPLAY.update(edit.spec);
  const root = document.querySelector('[data-node-id="layout"]');
  if (!root) return { result, error: 'layout missing', frames: [] };
  const host = document.getElementById('host');
  const button = document.querySelector('button[data-node-id]');
  const getThemeColor = (name) => { const probe = document.createElement('div'); probe.style.backgroundColor = `var(--${name})`; document.body.appendChild(probe); const color = getComputedStyle(probe).backgroundColor; probe.remove(); return color; };
  const expectedCard = getThemeColor('card'), expectedPrimary = getThemeColor('primary');
  const take = () => {
    const c = getComputedStyle(root); const h = getComputedStyle(host); const b = button && getComputedStyle(button);
    const columns = c.gridTemplateColumns === 'none' ? 0 : c.gridTemplateColumns.trim().split(/\s+/).length;
    const padding = parseFloat(c.paddingTop), gap = parseFloat(c.columnGap);
    const want = expected.density === 'regular' ? 24 : 12;
    return { columns, padding, gap, background: c.backgroundColor, buttonBackground: b?.backgroundColor ?? null,
      host: [h.color, h.backgroundColor, h.fontSize, h.position, h.zIndex],
      styleBytes: [...document.querySelectorAll('style')].reduce((sum, style) => sum + style.textContent.length, 0),
      pass: columns === expected.columns && Math.abs(padding - want) < 1 && Math.abs(gap - want) < 1 };
  };
  const frames = [take()];
  for (let i = 0; i < 3; i++) { await new Promise(requestAnimationFrame); frames.push(take()); }
  const el = document.querySelector(edit.target);
  const preAction = { value: el?.value ?? null, focus: document.activeElement === el,
    domSignature: [...document.querySelectorAll('[data-node-id]')].map((node) => node.getAttribute('data-node-id')) };
  return { result, preAction, frames, final: frames.at(-1), unstyledFrames: frames.filter((frame) => !frame.pass).length,
    themeAdherence: frames.at(-1).background === expectedCard && frames.at(-1).buttonBackground === expectedPrimary };
}, { expected, edit });
try {
  for (const [scenario, fixture] of Object.entries(SCENARIOS)) for (const arm of Object.keys(ARMS)) for (let repeat = 0; repeat < REPEATS; repeat++) {
    const page = await browser.newPage({ viewport: fixture.stages[0].viewport, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error.message).slice(0, 180)));
    page.on('request', (request) => { if (!request.url().startsWith(baseURL)) errors.push(`unexpected external request: ${request.url().slice(0, 120)}`); });
    try {
      await page.goto(`${baseURL}/?arm=${arm}`, { waitUntil: 'load' });
      const hostBefore = await page.evaluate(() => { const h = getComputedStyle(document.getElementById('host')); return [h.color, h.backgroundColor, h.fontSize, h.position, h.zIndex]; });
      const target = `[data-node-id="${fixture.interaction.target}"] ${fixture.nodes.find((node) => node.id === fixture.interaction.target).type === 'Select' ? 'select' : 'input'}`;
      const buttonId = fixture.nodes.find((node) => node.action === fixture.interaction.action).id;
      for (let index = 0; index < fixture.stages.length; index++) {
        const stage = fixture.stages[index];
        await page.setViewportSize(stage.viewport);
        const spec = specFor(scenario, arm, stage.id);
        let result = { ok: false, errors: ['not executed'] }, style = { frames: [], unstyledFrames: null, themeAdherence: null, final: null };
        let value = null, focus = false, domSignature = [], actionCount = null, screenshot = null;
        try {
          let preAction;
          if (index === 0) {
            style = await capture(page, stage.expect, { mode: 'mount', arm, state: initialState(scenario), spec, target });
            result = style.result;
            if (result.ok) {
              if (fixture.nodes.find((node) => node.id === fixture.interaction.target).type === 'Select') await page.locator(target).selectOption(fixture.interaction.enter);
              else await page.locator(target).fill(fixture.interaction.enter);
              await page.locator(target).focus();
              preAction = await page.evaluate((selector) => {
                const el = document.querySelector(selector);
                return { value: el?.value ?? null, focus: document.activeElement === el,
                  domSignature: [...document.querySelectorAll('[data-node-id]')].map((node) => node.getAttribute('data-node-id')) };
              }, target);
            }
          } else if (await page.locator(target).count()) {
            await page.locator(target).focus();
            style = await capture(page, stage.expect, { mode: 'update', spec, target });
            result = style.result;
            preAction = style.preAction;
          }
          if (result.ok) {
            ({ value, focus, domSignature } = preAction);
            if (repeat === 0) {
              screenshot = `shots/${scenario}--${arm}--${stage.id}.png`;
              await page.screenshot({ path: path.join(EVIDENCE, screenshot) });
            }
            await page.locator(`[data-node-id="${buttonId}"]`).click();
            await page.waitForFunction((count) => window.REPLAY.actions().length >= count, index + 1, { timeout: 2000 });
            actionCount = await page.evaluate(() => window.REPLAY.actions().length);
          }
        } catch (error) { errors.push(String(error.message).slice(0, 180)); }
        const expectedIds = ['layout', ...fixture.nodes.map((node) => node.id), ...(stage.id === 'structure' ? ['help'] : [])];
        const stateValue = await page.evaluate((key) => window.REPLAY?.state()?.[key] ?? null, fixture.interaction.target).catch(() => null);
        rows.push({ scenario, arm, repeat, stage: stage.id, specValid: result.ok, validationErrors: result.errors,
          domSignature, domPass: JSON.stringify(domSignature) === JSON.stringify(expectedIds),
          inputValue: value, stateValue, inputValuePreserved: value === fixture.interaction.enter && stateValue === fixture.interaction.enter,
          focusPreserved: focus, actionCount, actionPass: actionCount === index + 1,
          stylePass: style.final?.pass ?? false, unstyledFrames: style.unstyledFrames, themeAdherence: style.themeAdherence,
          hostStyleDelta: style.final ? JSON.stringify(style.final.host) !== JSON.stringify(hostBefore) : null,
          cssStyleBytes: style.final?.styleBytes ?? null, computed: style.final, frames: style.frames, screenshot,
          errors: [...errors] });
      }
    } catch (error) {
      for (const stage of fixture.stages) if (!rows.some((row) => row.scenario === scenario && row.arm === arm && row.repeat === repeat && row.stage === stage.id)) rows.push({ scenario, arm, repeat, stage: stage.id, error: String(error.message).slice(0, 180) });
    } finally { await page.close(); }
  }
} finally { await browser.close(); await new Promise((resolve) => srv.close(resolve)); }
const expectedRows = Object.keys(SCENARIOS).length * Object.keys(ARMS).length * 4 * REPEATS;
if (rows.length !== expectedRows) throw new Error(`expected ${expectedRows} rows, got ${rows.length}`);
const summary = Object.fromEntries(Object.keys(ARMS).map((arm) => {
  const cells = rows.filter((row) => row.arm === arm);
  return [arm, { cells: cells.length, specValid: cells.filter((row) => row.specValid).length,
    domPass: cells.filter((row) => row.domPass).length, inputPreserved: cells.filter((row) => row.inputValuePreserved).length,
    focusPreserved: cells.filter((row) => row.focusPreserved).length, actionPass: cells.filter((row) => row.actionPass).length,
    stylePass: cells.filter((row) => row.stylePass).length, themeAdherence: cells.filter((row) => row.themeAdherence).length,
    hostUnchanged: cells.filter((row) => row.hostStyleDelta === false).length, unstyledFrames: cells.reduce((sum, row) => sum + (row.unstyledFrames ?? 0), 0) }];
}));
const report = { kind: 'deterministic-official-json-render-replay', repeats: REPEATS,
  dependencies: { jsonRenderCore: '0.21.0', jsonRenderReact: '0.21.0', react: '19.2.3', playwrightCore: fromPW('playwright-core/package.json').version,
    tailwindcss: fromRepo('tailwindcss/package.json').version, esbuild: fromRepo('esbuild/package.json').version },
  artifactHashes: { baroBundleSha256: sha(bundleBytes), appBundleSha256: sha(appJS), themeSha256: sha(themeCSS) },
  inventory, summary, rows };
fs.writeFileSync(path.join(EVIDENCE, 'replay.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ repeats: REPEATS, rows: rows.length, summary }, null, 2));
