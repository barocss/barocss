// Local browser observer for a host-owned experiment. This module never launches an app server or model.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const viewports = Object.freeze({ desktop: { width: 1200, height: 800 }, narrow: { width: 390, height: 800 } });
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

function installedAssets(assetRoots = {}) {
  const repoDepsRoot = assetRoots.repoDepsRoot ?? process.env.REPO_DEPS_ROOT;
  const jrRoot = assetRoots.jrRoot ?? process.env.JR_ROOT;
  const pwDir = assetRoots.pwDir ?? process.env.PW_DIR;
  for (const [label, dir] of Object.entries({ repoDepsRoot, jrRoot, pwDir })) {
    if (typeof dir !== 'string' || !path.isAbsolute(dir) || !fs.statSync(dir).isDirectory()) {
      throw new Error(`${label} must be an installed absolute directory`);
    }
  }
  const fromRepo = createRequire(path.join(repoDepsRoot, 'package.json'));
  const fromPw = createRequire(path.join(pwDir, 'package.json'));
  const chromium = fromPw('playwright-core').chromium;
  const chrome = assetRoots.chrome ?? process.env.CHROME ?? chromium.executablePath();
  if (!path.isAbsolute(chrome) || !fs.existsSync(chrome)) throw new Error('Installed Chromium is required');
  return { repoDepsRoot, jrRoot, pwDir, esbuild: fromRepo('esbuild'), chromium, chrome };
}

async function buildAssets(deps) {
  const built = await deps.esbuild.build({ entryPoints: [path.join(here, 'live-browser-app.jsx')],
    bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
    nodePaths: [path.join(deps.jrRoot, 'node_modules')],
    define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' });
  const app = built.outputFiles[0].contents;
  const css = fs.readFileSync(path.join(here, '../barocss-render-corpus/base.css'));
  const baro = fs.readFileSync(path.join(deps.repoDepsRoot, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs'));
  const boot = Buffer.from('BaroCSS.baroStart({skipExisting:true,config:{cssVarPrefix:"tw",theme:{extend:BaroCSS.shadcnTheme}}});');
  return { app, css, baro, boot, hashes: { app: sha(app), css: sha(css), baro: sha(baro), boot: sha(boot) } };
}

function localServer(assets) {
  const server = http.createServer((req, res) => {
    const host = `127.0.0.1:${server.address().port}`;
    const send = (status, type, body) => {
      res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store',
        'x-content-type-options': 'nosniff', 'content-security-policy':
          "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:" });
      res.end(body);
    };
    if (req.headers.host !== host || req.method !== 'GET') return send(403, 'text/plain', 'Forbidden');
    const pathname = new URL(req.url, `http://${host}`).pathname;
    if (pathname === '/') return send(200, 'text/html; charset=utf-8',
      '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/base.css"></head><body><main class="min-h-screen bg-slate-100 p-4"><div id="live"></div><div id="baseline"></div></main><script src="/baro.js"></script><script src="/boot.js"></script><script src="/app.js"></script></body></html>');
    const files = { '/base.css': ['text/css', assets.css], '/baro.js': ['text/javascript', assets.baro],
      '/boot.js': ['text/javascript', assets.boot], '/app.js': ['text/javascript', assets.app] };
    return files[pathname] ? send(200, ...files[pathname]) : send(404, 'text/plain', 'Not found');
  });
  return server;
}

async function measure(page, rootSelector, expectedSpec, expectedCommittedSpec, expectedName, clock) {
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const hostPaintMs = clock();
  if (!Number.isFinite(hostPaintMs) || hostPaintMs < 0) throw new Error('Host clock returned an invalid paint time');
  const observation = await page.evaluate(([selector, spec, committedSpec, name]) => {
    const root = document.querySelector(selector);
    const state = window.LIVE_BROWSER.snapshot();
    const rendered = new Map([...root.querySelectorAll('[data-node-id]')]
      .map((element) => [element.dataset.nodeId, element]));
    const missingIds = Object.keys(spec.elements).filter((id) => !rendered.has(id));
    const layout = rendered.get(spec.root);
    const layoutStyle = layout && getComputedStyle(layout);
    const columns = layoutStyle?.display === 'grid'
      ? layoutStyle.gridTemplateColumns.trim().split(/\s+/).length : null;
    const expectedColumns = spec.elements[spec.root].props.columns === 'single' || window.innerWidth < 768 ? 1 : 2;
    const gapPx = layoutStyle ? parseFloat(layoutStyle.gap) : null;
    const palette = document.createElement('div');
    palette.innerHTML = '<span class="bg-white text-white"></span><span class="bg-slate-900 text-slate-900"></span>';
    document.body.appendChild(palette);
    const white = getComputedStyle(palette.firstElementChild);
    const slate = getComputedStyle(palette.lastElementChild);
    const tones = { light: { background: white.backgroundColor, textColor: slate.color },
      dark: { background: slate.backgroundColor, textColor: white.color } };
    palette.remove();
    const cards = Object.entries(spec.elements).filter(([, node]) => node.type === 'Card').map(([id]) => {
      const element = rendered.get(id);
      const style = element && getComputedStyle(element);
      const expected = tones[spec.elements[id].props.tone];
      const paddingPx = style ? parseFloat(style.paddingTop) : null;
      return { id, present: Boolean(element), paddingPx: style ? parseFloat(style.paddingTop) : null,
        background: style?.backgroundColor ?? null, textColor: style?.color ?? null,
        styleExact: paddingPx === (spec.elements[id].props.padding === 'fractional' ? 14 : 22)
          && style?.backgroundColor === expected.background && style?.color === expected.textColor };
    });
    const inputId = Object.entries(spec.elements).find(([, node]) => node.type === 'Input')?.[0];
    const input = inputId ? rendered.get(inputId)?.querySelector('input') : null;
    const textExact = Object.entries(spec.elements).every(([id, node]) =>
      node.type !== 'Text' || rendered.get(id)?.textContent === node.props.text);
    const textNodes = [...root.querySelectorAll('[data-node-id]')].filter((element) =>
      element.tagName === 'P' || /^H[1-6]$/.test(element.tagName));
    const styleComplete = layoutStyle?.display === 'grid' && columns === expectedColumns
      && gapPx === (spec.elements[spec.root].props.gap === 'fractional' ? 10 : 14)
      && cards.length > 0 && cards.every((card) => card.present && card.styleExact);
    const visibleSpecExact = selector === '#live-render'
      ? JSON.stringify(state.visibleSpec) === JSON.stringify(spec) : true;
    const committedSpecExact = JSON.stringify(state.committedSpec) === JSON.stringify(committedSpec);
    const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    return { phase: state.phase, revision: state.revision, inputName: state.inputName,
      ids: [...rendered.keys()], rootId: spec.root, missingIds, columns, gapPx, cards,
      inputPresent: Boolean(input), inputValue: input?.value ?? null,
      nameVisible: textNodes.some((element) => [name, `Name: ${name}`].includes(element.textContent)),
      actionsEnabled: !root.disabled, overflow, textExact, styleComplete,
      visibleSpecExact, committedSpecExact,
      measurementComplete: missingIds.length === 0 && textExact && styleComplete
        && visibleSpecExact && committedSpecExact && !overflow };
  }, [rootSelector, expectedSpec, expectedCommittedSpec, expectedName]);
  return { ...observation, hostPaintMs };
}

const comparable = (screen) => JSON.stringify({ ids: screen.ids, rootId: screen.rootId,
  columns: screen.columns, gapPx: screen.gapPx, cards: screen.cards,
  inputPresent: screen.inputPresent, inputValue: screen.inputValue,
  textExact: screen.textExact, styleComplete: screen.styleComplete, overflow: screen.overflow });

export async function openExperimentBrowser({ resultDir, assetRoots, clock } = {}) {
  if (typeof resultDir !== 'string' || !path.isAbsolute(resultDir) || fs.existsSync(resultDir)) {
    throw new Error('resultDir must be a fresh absolute path');
  }
  if (typeof clock !== 'function') throw new Error('Host experiment clock is required');
  const deps = installedAssets(assetRoots);
  const assets = await buildAssets(deps);
  fs.mkdirSync(resultDir, { recursive: true, mode: 0o700 });
  fs.mkdirSync(path.join(resultDir, 'shots'), { mode: 0o700 });
  const server = localServer(assets);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const networkErrors = [];
  let browser;
  const pages = {};
  try {
    browser = await deps.chromium.launch({ executablePath: deps.chrome, headless: true });
    for (const [viewportName, viewport] of Object.entries(viewports)) {
      const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
      const local = (url) => new URL(url).origin === baseUrl;
      page.on('request', (request) => { if (!local(request.url())) networkErrors.push('external-request'); });
      page.on('pageerror', (error) => networkErrors.push(`page:${String(error.message).slice(0, 160)}`));
      await page.route('**/*', (route) => local(route.request().url()) ? route.continue() : route.abort());
      await page.goto(baseUrl, { waitUntil: 'load' });
      pages[viewportName] = page;
    }
  } catch (error) {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
    throw error;
  }

  const report = { kind: 'barocss-render-progressive-live-browser-v1', source: 'host-notification-lines',
    modelCallsByHarness: 0, baselineKind: 'same-session-static-render', latencyClaim: 'none',
    viewports, assetHashes: assets.hashes, chromium: browser.version(),
    observations: [], actions: [], baselines: [], networkErrors };
  let currentIds = null;
  let currentName = null;
  let lastPhase = 'idle';
  let sequence = 0;
  let savedProcessId = null;
  let closed = false;
  const requireOpen = () => { if (closed) throw new Error('Browser is closed'); };

  async function observe(phase, transportElapsedMs, expectedSpec, expectedCommittedSpec, selector) {
    const screens = {};
    for (const [viewportName, page] of Object.entries(pages)) {
      const screen = await measure(page, selector, expectedSpec, expectedCommittedSpec, currentName, clock);
      const filename = `${String(++sequence).padStart(3, '0')}-${currentIds.processId}-${phase}-${viewportName}.png`;
      const screenshotPath = path.join(resultDir, 'shots', filename);
      const bytes = await page.locator(selector).screenshot({ path: screenshotPath });
      fs.chmodSync(screenshotPath, 0o600);
      screens[viewportName] = { ...screen, screenshot: `shots/${filename}`, screenshotSha256: sha(bytes) };
    }
    const complete = Object.values(screens).every((screen) => screen.measurementComplete
      && screen.actionsEnabled === ['action-ready', 'committed', 'baseline'].includes(phase));
    const record = { phase, processId: currentIds.processId, transportElapsedMs,
      visibleSpecSha256: sha(JSON.stringify(expectedSpec)),
      committedSpecSha256: expectedCommittedSpec ? sha(JSON.stringify(expectedCommittedSpec)) : null,
      screens, complete };
    if (networkErrors.length) throw new Error(`Browser network or page error: ${networkErrors[0]}`);
    if (!complete) throw new Error(`Incomplete ${phase} browser measurement`);
    return record;
  }

  return {
    async start({ ids, name, startedMs }) {
      requireOpen();
      if (!ids || typeof name !== 'string' || !name || name.length > 80) throw new Error('Invalid start input');
      const elapsedMs = startedMs ?? clock();
      if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new Error('Invalid host experiment clock');
      const results = await Promise.all(Object.values(pages).map((page) =>
        page.evaluate(([value, ms]) => window.LIVE_BROWSER.start(value, ms), [ids, elapsedMs])));
      if (results.some((result) => !result.ok)) throw new Error(`Browser delivery start failed: ${results[0].reason}`);
      currentIds = structuredClone(ids);
      currentName = name;
      lastPhase = 'generating';
      savedProcessId = null;
      return { ok: true, phase: 'generating', hostStartedMs: elapsedMs };
    },
    async event({ line, processId, elapsedMs }) {
      requireOpen();
      const notification = typeof line === 'string' ? line.replace(/\r?\n$/, '') : '';
      if (!currentIds || !notification.trim() || /[\r\n]/.test(notification)
        || !Number.isFinite(elapsedMs) || elapsedMs < 0) throw new Error('Invalid notification input');
      const wire = `${notification}\n`;
      const results = await Promise.all(Object.values(pages).map((page) =>
        page.evaluate(([bytes, id, ms]) => window.LIVE_BROWSER.push(bytes, id, ms),
          [wire, processId, elapsedMs])));
      const states = await Promise.all(Object.values(pages).map((page) =>
        page.evaluate(() => window.LIVE_BROWSER.snapshot())));
      if (results.some((result) => !result.ok)) return { ok: false, reason: results.find((result) => !result.ok).reason,
        phase: states[0].phase };
      if (states[0].phase !== states[1].phase
        || JSON.stringify(states[0].visibleSpec) !== JSON.stringify(states[1].visibleSpec)) {
        throw new Error('Viewport delivery states diverged');
      }
      const phase = states[0].phase;
      let observation = null;
      if (phase !== lastPhase && ['preview', 'action-ready', 'committed'].includes(phase)) {
        if (phase === 'committed') {
          const finished = await Promise.all(Object.values(pages).map((page) =>
            page.evaluate(([id, ms]) => window.LIVE_BROWSER.finish(id, ms), [processId, elapsedMs])));
          if (finished.some((result) => !result.ok)) throw new Error('Completed browser transport did not finish');
        }
        observation = await observe(phase, elapsedMs, states[0].visibleSpec, states[0].committedSpec, '#live-render');
        report.observations.push(observation);
      }
      lastPhase = phase;
      return { ok: true, phase, changed: Boolean(observation), observation };
    },
    async save({ name, revision }) {
      requireOpen();
      if (!currentIds || savedProcessId === currentIds.processId
        || typeof name !== 'string' || !name || name.length > 80 || !Number.isSafeInteger(revision)) {
        throw new Error('Invalid or duplicate save');
      }
      for (const page of Object.values(pages)) {
        const state = await page.evaluate(() => window.LIVE_BROWSER.snapshot());
        if (state.phase !== 'committed' || state.revision !== revision) throw new Error('Save is not committed');
        await page.locator('#live-render [data-node-id="name"] input').fill(name);
        await page.locator('#live-render [data-node-id="save"]').click();
      }
      const cloneActions = await Promise.all(Object.values(pages).map((page) =>
        page.evaluate(() => window.LIVE_BROWSER.actions())));
      const current = cloneActions.map((actions) => actions.filter((action) =>
        action.processId === currentIds.processId && action.turnId === currentIds.turnId));
      if (current.some((actions) => actions.length !== 1)
        || JSON.stringify(current[0][0]) !== JSON.stringify(current[1][0])
        || current[0][0].revision !== revision || current[0][0].name !== name) {
        throw new Error('Browser action clones diverged');
      }
      savedProcessId = currentIds.processId;
      report.actions.push({ processId: currentIds.processId, revision,
        actionSha256: sha(JSON.stringify(current[0][0])) });
      return structuredClone(current[0][0]); // One host-owned dispatch. The narrow clone is observation only.
    },
    async baseline({ spec, name, completedMs }) {
      requireOpen();
      if (!currentIds || typeof name !== 'string' || !Number.isFinite(completedMs)
        || completedMs < 0 || !spec || typeof spec !== 'object') throw new Error('Invalid baseline input');
      const states = await Promise.all(Object.values(pages).map((page) =>
        page.evaluate(() => window.LIVE_BROWSER.snapshot())));
      if (states.some((state) => state.phase !== 'committed'
        || JSON.stringify(state.committedSpec) !== JSON.stringify(spec))) {
        throw new Error('Baseline spec differs from the committed response');
      }
      const applied = {};
      for (const [viewportName, page] of Object.entries(pages)) {
        applied[viewportName] = await page.evaluate((value) => window.LIVE_BROWSER.baseline(value), spec);
        if (!applied[viewportName].ok) throw new Error('Static baseline render failed');
        const input = page.locator('#baseline-render [data-node-id] input');
        const liveInput = page.locator('#live-render [data-node-id] input');
        if (await input.count()) {
          if (await liveInput.count() !== 1) throw new Error('Static and live input shapes differ');
          await input.fill(await liveInput.inputValue());
        }
      }
      const previousName = currentName;
      currentName = name;
      let observation;
      try { observation = await observe('baseline', completedMs, spec, spec, '#baseline-render'); }
      finally { currentName = previousName; }
      const committed = [...report.observations].reverse().find((record) =>
        record.phase === 'committed' && record.processId === currentIds.processId);
      if (!committed) throw new Error('No committed browser observation for baseline');
      const equal = Object.keys(viewports).every((viewportName) =>
        comparable(committed.screens[viewportName]) === comparable(observation.screens[viewportName]));
      const result = { completeResponseMs: completedMs, observedHostMs: Math.max(...Object.values(observation.screens)
        .map((screen) => screen.hostPaintMs)), renderApplyMs: Object.fromEntries(Object.entries(applied)
        .map(([viewportName, value]) => [viewportName, value.renderApplyMs])),
      specSha256: sha(JSON.stringify(spec)), equal, screens: observation.screens };
      if (!equal) throw new Error('Static baseline differs from committed live screen');
      report.baselines.push(result);
      return result;
    },
    async close() {
      if (closed) return;
      closed = true;
      try {
        fs.writeFileSync(path.join(resultDir, 'report.json'), JSON.stringify(report, null, 2) + '\n',
          { flag: 'wx', mode: 0o600 });
      } finally {
        await browser.close();
        await new Promise((resolve) => server.close(resolve));
      }
    },
  };
}
