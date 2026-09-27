// Deterministic, read-only browser replay of saved #458 outputs. Never invokes Codex.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { initialState } from '../json-render-446/spec.mjs';
import { SCENARIOS } from '../json-render-446/contract.mjs';
import { VIEWPORTS, schedule } from './plan.mjs';
import { parseFinal, safeSpec } from './validate.mjs';
import { scoreSaved } from './score.mjs';
import { verifyCapture } from './provenance.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const read = (file) => fs.readFileSync(file);
function dependencies() {
  const jrRoot = process.env.JR_ROOT;
  const pwDir = process.env.PW_DIR;
  const chrome = process.env.CHROME;
  const repo = process.env.REPO_DEPS_ROOT || root;
  if (![jrRoot, pwDir, chrome].every((value) => value && path.isAbsolute(value) && fs.existsSync(value))) throw new Error('Set installed JR_ROOT, PW_DIR and CHROME; no downloads are performed');
  const fromJR = createRequire(path.join(jrRoot, 'package.json'));
  const fromPW = createRequire(path.join(pwDir, 'package.json'));
  const fromRepo = createRequire(path.join(repo, 'packages/barocss/package.json'));
  for (const name of ['@json-render/core', '@json-render/react', 'react', 'react-dom', 'zod']) fromJR.resolve(name);
  return { esbuild: fromRepo('esbuild'), chromium: fromPW('playwright-core').chromium,
    versions: { jsonRender: JSON.parse(read(path.join(jrRoot, 'node_modules/@json-render/core/package.json'))).version,
      playwright: fromPW('playwright-core/package.json').version, esbuild: fromRepo('esbuild/package.json').version }, chrome };
}
async function assets(deps) {
  const app = await deps.esbuild.build({ entryPoints: [path.join(here, 'browser-app.jsx')], bundle: true, write: false,
    platform: 'browser', format: 'iife', jsx: 'automatic', nodePaths: [path.join(process.env.JR_ROOT, 'node_modules')],
    define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' });
  const css = read(path.join(here, 'base.css'));
  const baro = read(path.join(root, 'scripts/json-render-446/evidence/baro.umd.cjs'));
  return { app: app.outputFiles[0].contents, css, baro,
    hashes: { app: sha(app.outputFiles[0].contents), css: sha(css), baro: sha(baro) } };
}
function serverFor(asset) {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://localhost');
    const arm = u.searchParams.get('arm');
    const send = (type, body) => { res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); res.end(body); };
    if (u.pathname === '/' && ['variable', 'utility'].includes(arm)) return send('text/html', `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/base.css"></head><body class="${arm === 'variable' ? 'bounded' : 'utility'}"><div id="host">Host app sentinel</div><main id="out"></main>${arm === 'utility' ? '<script src="/baro.js"></script><script>BaroCSS.baroStart({skipExisting:true,config:{cssVarPrefix:"tw",theme:{extend:BaroCSS.shadcnTheme}}});</script>' : ''}<script src="/app.js"></script></body></html>`);
    if (u.pathname === '/app.js') return send('text/javascript', asset.app);
    if (u.pathname === '/baro.js') return send('text/javascript', asset.baro);
    if (u.pathname === '/base.css') return send('text/css', asset.css);
    res.writeHead(404); res.end();
  });
  return server;
}
const targetFor = (fixture) => `[data-node-id="${fixture.interaction.target}"] ${fixture.nodes.find((node) => node.id === fixture.interaction.target).type === 'Select' ? 'select' : 'input'}`;
function buttonFor(fixture) { return fixture.nodes.find((node) => node.action === fixture.interaction.action).id; }
async function measure(page, target, buttonId, hostBefore) {
  await page.locator(`[data-node-id="${buttonId}"]`).hover();
  return page.evaluate(({ target, buttonId, hostBefore }) => {
    const layout = document.querySelector('[data-node-id="layout"]');
    const field = document.querySelector(target);
    const button = document.querySelector(`[data-node-id="${buttonId}"]`);
    if (!layout || !button) return { error: 'Layout or action button missing' };
    const c = getComputedStyle(layout), b = getComputedStyle(button), h = getComputedStyle(document.getElementById('host'));
    const host = [h.color, h.backgroundColor, h.fontSize, h.position, h.zIndex];
    const rect = layout.getBoundingClientRect();
    const probe = document.createElement('div');
    probe.style.backgroundColor = 'var(--card)'; document.body.appendChild(probe);
    const cardColor = getComputedStyle(probe).backgroundColor;
    probe.style.backgroundColor = 'var(--primary)';
    const primaryColor = getComputedStyle(probe).backgroundColor; probe.remove();
    const internalOverflow = [...layout.querySelectorAll('[data-node-id]')].filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1).map((el) => el.getAttribute('data-node-id'));
    return { columns: c.gridTemplateColumns === 'none' ? 0 : c.gridTemplateColumns.trim().split(/\s+/).length,
      paddingPx: parseFloat(c.paddingTop), gapPx: parseFloat(c.columnGap), radiusPx: parseFloat(c.borderTopLeftRadius),
      hoverUnderline: b.textDecorationLine.includes('underline'), hoverItalic: b.fontStyle === 'italic', uppercase: b.textTransform === 'uppercase',
      viewportWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
      layoutRight: rect.right, internalOverflow, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 || rect.right > document.documentElement.clientWidth + 1 || internalOverflow.length > 0,
      domSignature: [...document.querySelectorAll('[data-node-id]')].map((el) => el.getAttribute('data-node-id')),
      fieldValue: field?.value ?? null, focusPreserved: document.activeElement === field,
      hostUnchanged: JSON.stringify(host) === JSON.stringify(hostBefore),
      themeBackground: c.backgroundColor, buttonBackground: b.backgroundColor,
      themeAdherence: c.backgroundColor === cardColor && b.backgroundColor === primaryColor,
      customPadding: layout.style.getPropertyValue('--ui-padding'), customGap: layout.style.getPropertyValue('--ui-gap'),
      customRadius: layout.style.getPropertyValue('--ui-radius'), directPadding: layout.style.padding, directGap: layout.style.gap, directRadius: layout.style.borderRadius,
      styleBytes: [...document.querySelectorAll('style')].reduce((sum, el) => sum + el.textContent.length, 0) };
  }, { target, buttonId, hostBefore });
}
function measuredStylePass(measured, expected) {
  if (!measured || measured.error) return false;
  for (const [key, value] of Object.entries(expected)) {
    if (['paddingPx', 'gapPx', 'radiusPx'].includes(key)) {
      if (!Number.isFinite(measured[key]) || Math.abs(measured[key] - value) > 0.5) return false;
    } else if (measured[key] !== value) return false;
  }
  return true;
}
export async function replaySaved({ captureDir, outputDir, faultInjection = null }) {
  if (fs.existsSync(outputDir)) throw new Error('Replay output already exists');
  const verified = verifyCapture(captureDir);
  const rows = verified.rows;
  const frozen = schedule();
  if (faultInjection && (!verified.manifest.synthetic || faultInjection !== 'blur-settings-variable-scalar')) throw new Error('Fault injection is limited to the named synthetic regression');
  const scoring = scoreSaved(rows, captureDir);
  const deps = dependencies();
  const asset = await assets(deps);
  fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });
  fs.mkdirSync(path.join(outputDir, 'shots'), { mode: 0o700 });
  const server = serverFor(asset);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  const results = [];
  try {
    browser = await deps.chromium.launch({ executablePath: deps.chrome, headless: true });
    for (const scenario of ['settings', 'dashboard', 'kiosk']) for (const arm of ['variable', 'utility']) {
      const session = `${scenario}--${arm}`;
      const fixture = SCENARIOS[scenario];
      const page = await browser.newPage({ viewport: VIEWPORTS.desktop, reducedMotion: 'reduce' });
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(`page:${String(error.message).slice(0, 200)}`));
      page.on('request', (request) => { if (!request.url().startsWith(base)) pageErrors.push(`external:${request.url().slice(0, 120)}`); });
      let blocked = false;
      let browserChain = true;
      try {
        await page.goto(`${base}/?arm=${arm}`, { waitUntil: 'load' });
        const hostBefore = await page.evaluate(() => { const h = getComputedStyle(document.getElementById('host')); return [h.color, h.backgroundColor, h.fontSize, h.position, h.zIndex]; });
        for (const row of rows.filter((item) => item.session === session)) {
          const result = { id: row.id, session, status: 'skipped', screen: {}, errors: [] };
          if (blocked || !scoring[row.ordinal].schemaValid || !scoring[row.ordinal].semanticValid) {
            result.status = blocked ? 'skipped-chain' : 'invalid-spec'; result.sessionSuccess = false; blocked = true; browserChain = false; results.push(result); continue;
          }
          const raw = read(path.join(captureDir, `attempt-${String(row.ordinal).padStart(2, '0')}`, 'raw-final.txt')).toString();
          const spec = parseFinal(raw).spec;
          if (safeSpec(spec, scenario, arm).length) throw new Error('Unsafe spec reached browser');
          try {
            const target = targetFor(fixture), buttonId = buttonFor(fixture);
            if (row.stage !== 'initial') await page.locator(target).focus();
            const render = await page.evaluate(({ first, arm, state, spec }) => first ? window.REPLAY458.mount(arm, state, spec) : window.REPLAY458.update(spec),
              { first: row.stage === 'initial', arm, state: initialState(scenario), spec });
            if (!render.ok) { result.status = 'official-schema'; result.errors.push(...render.errors); result.sessionSuccess = false; blocked = true; browserChain = false; results.push(result); continue; }
            if (faultInjection === 'blur-settings-variable-scalar' && row.id === 'settings--variable--scalar') await page.evaluate(() => document.activeElement?.blur());
            if (row.stage === 'initial') {
              if (fixture.nodes.find((node) => node.id === fixture.interaction.target).type === 'Select') await page.locator(target).selectOption(fixture.interaction.enter);
              else await page.locator(target).fill(fixture.interaction.enter);
            }
            if (row.stage === 'initial') await page.locator(target).focus();
            for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
              await page.setViewportSize(viewport);
              await page.evaluate(() => new Promise(requestAnimationFrame));
              const measured = await measure(page, target, buttonId, hostBefore);
              const shot = `shots/${row.id}--${viewportName}.png`;
              await page.screenshot({ path: path.join(outputDir, shot), fullPage: true });
              result.screen[viewportName] = { ...measured, stylePass: measuredStylePass(measured, frozen[row.ordinal].required), screenshot: shot };
            }
            const stateValue = await page.evaluate((key) => window.REPLAY458.state()?.[key] ?? null, fixture.interaction.target);
            await page.locator(`[data-node-id="${buttonId}"]`).click();
            const actions = await page.evaluate(() => window.REPLAY458.actions());
            result.statePreserved = stateValue === fixture.interaction.enter && Object.values(result.screen).every((screen) => screen.fieldValue === fixture.interaction.enter);
            result.focusPreserved = Object.values(result.screen).every((screen) => screen.focusPreserved);
            result.actionPass = actions.length === ['initial', 'scalar', 'compiled', 'absent'].indexOf(row.stage) + 1 && actions.every((action) => action === fixture.interaction.action);
            result.domPass = Object.values(result.screen).every((screen) => JSON.stringify(screen.domSignature) === JSON.stringify(['layout', ...fixture.nodes.map((node) => node.id)]));
            result.hostUnchanged = Object.values(result.screen).every((screen) => screen.hostUnchanged);
            result.themeAdherence = Object.values(result.screen).every((screen) => screen.themeAdherence);
            result.stylePass = Object.values(result.screen).every((screen) => screen.stylePass);
            result.overflowFree = Object.values(result.screen).every((screen) => !screen.overflow);
            result.typedVariablePass = arm !== 'variable' || Object.values(result.screen).every((screen) => screen.customPadding && screen.customGap && screen.customRadius && !screen.directPadding && !screen.directGap && !screen.directRadius);
            result.status = 'replayed';
          } catch (error) { result.status = 'browser-error'; result.errors.push(String(error.message).slice(0, 200)); blocked = true; }
          result.errors.push(...pageErrors.splice(0));
          if (result.errors.length) blocked = true;
          const browserPass = result.status === 'replayed' && result.statePreserved && result.focusPreserved && result.actionPass &&
            result.domPass && result.hostUnchanged && result.themeAdherence && result.overflowFree && result.typedVariablePass &&
            (!frozen[row.ordinal].support.supported || result.stylePass) && result.errors.length === 0;
          result.sessionSuccess = browserChain && scoring[row.ordinal].chainAfter && browserPass;
          browserChain = result.sessionSuccess;
          results.push(result);
        }
      } catch (error) {
        for (const row of rows.filter((item) => item.session === session).slice(results.filter((item) => item.session === session).length)) results.push({ id: row.id, session, status: 'browser-error', sessionSuccess: false, errors: [String(error.message).slice(0, 200)] });
      } finally { await page.close(); }
    }
  } finally { if (browser) await browser.close(); await new Promise((resolve) => server.close(resolve)); }
  const report = { kind: 'saved-response-browser-replay', synthetic: verified.manifest.synthetic, faultInjection,
    captureManifestSha256: verified.manifestSha256, captureEvidenceSha256: verified.evidenceSha256, versions: deps.versions, assetHashes: asset.hashes,
    scoring, replay: results };
  fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return report;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const captureDir = args[args.indexOf('--capture') + 1], outputDir = args[args.indexOf('--output') + 1];
  if (!captureDir || !outputDir || !args.includes('--capture') || !args.includes('--output')) throw new Error('Use --capture and fresh --output directories');
  const report = await replaySaved({ captureDir: path.resolve(captureDir), outputDir: path.resolve(outputDir) });
  console.log(JSON.stringify({ synthetic: report.synthetic, scored: report.scoring.length, replayed: report.replay.filter((row) => row.status === 'replayed').length }, null, 2));
}
