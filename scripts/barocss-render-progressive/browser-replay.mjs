// Deterministic browser replay of saved output. The JSON-RPC stream is synthetic; no model runs here.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readSavedTurn } from '../barocss-render-corpus/replay.mjs';
import { verifyCorpus } from '../barocss-render-corpus/verify.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const privateRoot = '/Users/user/.barocss-ai/v3';
const viewports = Object.freeze({ desktop: { width: 1200, height: 800 }, narrow: { width: 390, height: 800 } });
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const assertDirectory = (dir, label) => {
  if (typeof dir !== 'string' || !path.isAbsolute(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`${label} must be an existing absolute directory`);
  }
};

function loadCorpus(corpusDir, source) {
  assertDirectory(corpusDir, 'corpusDir');
  if (!['verified-458-corpus', 'authored-fixture'].includes(source)) throw new Error('Declare the corpus source');
  const verified = source === 'verified-458-corpus' ? verifyCorpus(corpusDir) : null;
  if (source === 'authored-fixture' && path.dirname(corpusDir) === privateRoot) {
    throw new Error('Private output must be lineage-verified');
  }
  const bytes = fs.readFileSync(path.join(corpusDir, 'corpus.json'));
  const manifestSha256 = sha(bytes);
  if (verified && verified.corpusManifestSha256 !== manifestSha256) throw new Error('Corpus manifest changed');
  const manifest = JSON.parse(bytes.toString('utf8'));
  if (manifest.kind !== 'barocss-render-corpus-v1' || !Array.isArray(manifest.rows)) {
    throw new Error('Invalid corpus manifest');
  }
  const lineage = new Map(verified?.lineage.filter((item) => item.rawSha256)
    .map((item) => [`${item.rowId}:${item.kind}`, item.rawSha256]) ?? []);
  const ids = new Set();
  const rows = manifest.rows.map((row) => {
    if (!row || typeof row.id !== 'string' || !/^[0-9]{2}$/.test(row.id) || ids.has(row.id)
      || typeof row.name !== 'string' || !row.name || row.name.length > 80 || !row.initial || !row.next) {
      throw new Error('Invalid corpus row');
    }
    ids.add(row.id);
    const turns = {};
    for (const kind of ['initial', 'next']) {
      const turn = row[kind];
      const expected = lineage.get(`${row.id}:${kind}`) ?? turn.rawSha256;
      if (source === 'verified-458-corpus' && turn.status === 'valid' && !expected) {
        throw new Error(`Missing saved-output digest for ${row.id}:${kind}`);
      }
      turns[kind] = readSavedTurn(turn, kind, expected);
    }
    return { row, turns, eligible: row.initial.status === 'valid' && row.next.status === 'valid'
      && turns.initial.specValid && turns.next.specValid };
  });
  return { verified, manifestSha256, rows };
}

function resolveAssets(assetRoots = {}) {
  const repoDepsRoot = assetRoots.repoDepsRoot ?? process.env.REPO_DEPS_ROOT;
  const jrRoot = assetRoots.jrRoot ?? process.env.JR_ROOT;
  const pwDir = assetRoots.pwDir ?? process.env.PW_DIR;
  for (const [label, dir] of Object.entries({ repoDepsRoot, jrRoot, pwDir })) assertDirectory(dir, label);
  const fromRepo = createRequire(path.join(repoDepsRoot, 'package.json'));
  const fromPw = createRequire(path.join(pwDir, 'package.json'));
  const chromium = fromPw('playwright-core').chromium;
  const chrome = assetRoots.chrome ?? process.env.CHROME ?? chromium.executablePath();
  if (!path.isAbsolute(chrome) || !fs.existsSync(chrome)) throw new Error('Installed Chromium is required');
  return { esbuild: fromRepo('esbuild'), chromium, chrome, repoDepsRoot, jrRoot,
    versions: { node: process.version,
      esbuild: JSON.parse(fs.readFileSync(path.join(repoDepsRoot, 'node_modules/esbuild/package.json'))).version,
      playwrightCore: JSON.parse(fs.readFileSync(path.join(pwDir, 'package.json'))).version } };
}

async function buildAssets(deps) {
  const built = await deps.esbuild.build({ entryPoints: [path.join(here, 'browser-app.jsx')], bundle: true,
    write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
    nodePaths: [path.join(deps.jrRoot, 'node_modules')],
    define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' });
  const app = built.outputFiles[0].contents;
  const css = fs.readFileSync(path.join(here, '../barocss-render-corpus/base.css'));
  const baro = fs.readFileSync(path.join(deps.repoDepsRoot, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs'));
  const boot = Buffer.from('BaroCSS.baroStart({skipExisting:true,config:{cssVarPrefix:"tw",theme:{extend:BaroCSS.shadcnTheme}}});');
  return { app, css, baro, boot, hashes: { app: sha(app), css: sha(css), baro: sha(baro), boot: sha(boot) } };
}

function createLocalServer(assets) {
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
      '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/base.css"></head><body><main class="min-h-screen bg-slate-100 p-4"><div id="out"></div></main><script src="/baro.js"></script><script src="/boot.js"></script><script src="/app.js"></script></body></html>');
    const files = { '/base.css': ['text/css', assets.css], '/baro.js': ['text/javascript', assets.baro],
      '/boot.js': ['text/javascript', assets.boot], '/app.js': ['text/javascript', assets.app] };
    return files[pathname] ? send(200, ...files[pathname]) : send(404, 'text/plain', 'Not found');
  });
  return server;
}

const event = (method, params) => `${JSON.stringify({ method, params })}\n`;
function syntheticTurn(ids, specJson) {
  const messageId = `message-${ids.turnId}`;
  const base = { threadId: ids.threadId, turnId: ids.turnId };
  const raw = JSON.stringify({ specJson });
  const cut = Math.floor(raw.length / 2);
  return {
    rawSha256: sha(raw),
    lines: {
      started: event('turn/started', { threadId: ids.threadId, turn: { id: ids.turnId, status: 'inProgress' } })
        + event('item/started', { ...base, item: { id: messageId, type: 'agentMessage' }, startedAtMs: 0 }),
      partial: event('item/agentMessage/delta', { ...base, itemId: messageId, delta: raw.slice(0, cut) }),
      preview: event('item/agentMessage/delta', { ...base, itemId: messageId, delta: raw.slice(cut) }),
      ready: event('item/completed', { ...base, item: { id: messageId, type: 'agentMessage',
        phase: 'final_answer', text: raw }, completedAtMs: 30 }),
      committed: event('turn/completed', { threadId: ids.threadId, turn: { id: ids.turnId,
        status: 'completed', items: [{ id: messageId, type: 'agentMessage', phase: 'final_answer', text: raw }] } }),
    },
  };
}

async function measure(page, expectedSpec, expectedCommittedSpec, expectedName) {
  await page.evaluate(() => new Promise(requestAnimationFrame));
  return page.evaluate(([spec, committedSpec, name]) => {
    const state = window.PROGRESSIVE_REPLAY.snapshot();
    const rendered = new Map([...document.querySelectorAll('[data-node-id]')]
      .map((element) => [element.dataset.nodeId, element]));
    const missingIds = spec ? Object.keys(spec.elements).filter((id) => !rendered.has(id)) : [];
    const layout = spec ? rendered.get(spec.root) : null;
    const layoutStyle = layout && getComputedStyle(layout);
    const cards = spec ? Object.entries(spec.elements).filter(([, node]) => node.type === 'Card').map(([id]) => {
      const element = rendered.get(id);
      const style = element && getComputedStyle(element);
      return { id, present: Boolean(element), paddingPx: style ? parseFloat(style.paddingTop) : null,
        background: style?.backgroundColor ?? null, textColor: style?.color ?? null };
    }) : [];
    const inputId = spec && Object.entries(spec.elements).find(([, node]) => node.type === 'Input')?.[0];
    const nameInput = inputId ? rendered.get(inputId)?.querySelector('input') : null;
    const columns = layoutStyle?.display === 'grid'
      ? layoutStyle.gridTemplateColumns.trim().split(/\s+/).length : null;
    const expectedColumns = spec?.elements[spec.root]?.props.columns === 'single' || window.innerWidth < 768 ? 1 : 2;
    const gapPx = layoutStyle ? parseFloat(layoutStyle.gap) : null;
    const textNodes = [...document.querySelectorAll('[data-node-id]')].filter((element) =>
      element.tagName === 'P' || /^H[1-6]$/.test(element.tagName));
    const contentComplete = Boolean(spec) && Object.entries(spec.elements).every(([id, node]) =>
      node.type !== 'Text' || rendered.get(id)?.textContent === node.props.text);
    const styleComplete = Boolean(layoutStyle && layoutStyle.display === 'grid'
      && columns === expectedColumns && Number.isFinite(gapPx) && cards.length > 0
      && cards.every((card) => card.present && Number.isFinite(card.paddingPx)
        && card.background && card.textColor));
    const visibleSpecExact = JSON.stringify(state.visibleSpec) === JSON.stringify(spec);
    const committedSpecExact = JSON.stringify(state.committedSpec) === JSON.stringify(committedSpec);
    const gate = document.querySelector('[data-action-gate]');
    return { phase: state.phase, revision: state.revision, inputName: state.inputName,
      visibleSpec: Boolean(state.visibleSpec), committedSpec: Boolean(state.committedSpec),
      visibleSpecExact, committedSpecExact, actionsEnabled: gate ? !gate.disabled : null,
      previewMs: state.previewMs, actionReadyMs: state.actionReadyMs, completedMs: state.completedMs,
      rootId: spec?.root ?? null, ids: [...rendered.keys()], missingIds, cards,
      columns, gapPx,
      inputPresent: Boolean(nameInput), inputValue: nameInput?.value ?? null,
      nameVisible: textNodes.some((element) => [name, `Name: ${name}`].includes(element.textContent)),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      contentComplete, styleComplete,
      placeholderComplete: spec ? null : rendered.size === 0 && Boolean(document.querySelector('[data-replay-empty]')),
      measurementComplete: spec ? missingIds.length === 0 && contentComplete && styleComplete
        && visibleSpecExact && committedSpecExact : null,
      actions: window.PROGRESSIVE_REPLAY.actions() };
  }, [expectedSpec, expectedCommittedSpec, expectedName]);
}

async function recordStage(page, resultDir, rowId, kind, stage, spec, committedSpec, name) {
  const screens = {};
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    await page.setViewportSize(viewport);
    const observation = await measure(page, spec, committedSpec, name);
    const filename = `${rowId}-${kind}-${stage}-${viewportName}.png`;
    const bytes = await page.screenshot({ path: path.join(resultDir, 'shots', filename), fullPage: true });
    screens[viewportName] = { ...observation, screenshot: `shots/${filename}`, screenshotSha256: sha(bytes) };
  }
  return screens;
}

async function replayRow(browser, baseUrl, item, resultDir) {
  const page = await browser.newPage({ viewport: viewports.desktop, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(`page:${String(error.message).slice(0, 160)}`));
  const local = (url) => new URL(url).origin === baseUrl;
  page.on('request', (request) => { if (!local(request.url())) errors.push('external-request'); });
  await page.route('**/*', (route) => local(route.request().url()) ? route.continue() : route.abort());
  const output = { status: 'pending', turns: {}, errors };
  try {
    await page.goto(baseUrl, { waitUntil: 'load' });
    for (const [index, kind] of ['initial', 'next'].entries()) {
      const ids = { processId: `process-${item.row.id}-${kind}`,
        threadId: `thread-${item.row.id}`, turnId: `turn-${item.row.id}-${kind}` };
      const stream = syntheticTurn(ids, item.turns[kind].specJson);
      const turn = { streamSha256: sha(Object.values(stream.lines).join('')), streamBytes: Buffer.byteLength(Object.values(stream.lines).join('')),
        envelopeSha256: stream.rawSha256, stages: {}, calls: [] };
      output.turns[kind] = turn;
      const priorSpec = index ? JSON.parse(item.turns.initial.specJson) : null;
      const currentSpec = JSON.parse(item.turns[kind].specJson);
      const call = async (method, args) => {
        const result = await page.evaluate(([m, a]) => window.PROGRESSIVE_REPLAY[m](...a), [method, args]);
        turn.calls.push({ method, ok: result.ok, reason: result.reason ?? null });
        if (!result.ok) throw new Error(`${kind}:${method}:${result.reason}`);
      };
      await call('start', [ids, 0]);
      await call('push', [stream.lines.started + stream.lines.partial, ids.processId, 10]);
      turn.stages.generating = await recordStage(page, resultDir, item.row.id, kind, 'generating',
        priorSpec, priorSpec, item.row.name);
      await call('push', [stream.lines.preview, ids.processId, 20]);
      turn.stages.preview = await recordStage(page, resultDir, item.row.id, kind, 'preview',
        currentSpec, priorSpec, item.row.name);
      await call('push', [stream.lines.ready, ids.processId, 30]);
      turn.stages.actionReady = await recordStage(page, resultDir, item.row.id, kind, 'action-ready',
        currentSpec, priorSpec, item.row.name);
      if (kind === 'initial') {
        await page.locator('[data-node-id="name"] input').fill(item.row.name);
        await page.locator('[data-node-id="save"]').click();
        turn.queuedAction = await page.evaluate(() => window.PROGRESSIVE_REPLAY.snapshot().inputName);
        turn.actionsBeforeCommit = await page.evaluate(() => window.PROGRESSIVE_REPLAY.actions());
      }
      await call('push', [stream.lines.committed, ids.processId, 40]);
      await call('finish', [ids.processId, 40]);
      turn.stages.committed = await recordStage(page, resultDir, item.row.id, kind, 'committed',
        currentSpec, currentSpec, item.row.name);
    }
    const stages = Object.values(output.turns).flatMap((turn) => Object.values(turn.stages).flatMap(Object.values));
    const initial = output.turns.initial;
    const next = output.turns.next;
    const nextHasInput = Object.values(JSON.parse(item.turns.next.specJson).elements)
      .some((node) => node.type === 'Input');
    output.measurementComplete = stages.every((screen) => screen.measurementComplete === true
      || screen.placeholderComplete === true && screen.visibleSpecExact && screen.committedSpecExact);
    output.actionComplete = initial.queuedAction === item.row.name && initial.actionsBeforeCommit.length === 0
      && Object.values(initial.stages.committed).every((screen) => screen.actions.length === 1
        && screen.actions[0].name === item.row.name && screen.actions[0].revision === 1)
      && Object.values(next.stages.committed).every((screen) => screen.inputName === item.row.name
        && screen.nameVisible && screen.actions.length === 1
        && (nextHasInput ? screen.inputPresent && screen.inputValue === item.row.name : !screen.inputPresent));
    output.phasesComplete = Object.values(output.turns).every((turn) =>
      ['generating', 'preview', 'actionReady', 'committed'].every((stage) =>
        Object.values(turn.stages[stage]).every((screen) => screen.phase === (stage === 'actionReady' ? 'action-ready' : stage)
          && (screen.visibleSpec ? screen.actionsEnabled === ['actionReady', 'committed'].includes(stage)
            : screen.actionsEnabled === null))))
      && Object.values(initial.stages.committed).every((screen) => screen.revision === 1)
      && Object.values(next.stages.committed).every((screen) => screen.revision === 2);
    output.timingComplete = Object.values(output.turns).every((turn) =>
      Object.values(turn.stages.committed).every((screen) => screen.previewMs === 20
        && screen.actionReadyMs === 30 && screen.completedMs === 40));
    output.status = output.measurementComplete && output.actionComplete && output.phasesComplete
      && output.timingComplete && errors.length === 0 && stages.every((screen) => !screen.overflow)
      ? 'replayed' : 'measurement-incomplete';
  } catch (error) {
    output.status = 'browser-error';
    errors.push(`browser:${String(error.message).slice(0, 160)}`);
  } finally { await page.close(); }
  return output;
}

export async function replaySavedProgressive({ corpusDir, resultDir, source, assetRoots } = {}) {
  const corpus = loadCorpus(corpusDir, source);
  if (typeof resultDir !== 'string' || !path.isAbsolute(resultDir) || fs.existsSync(resultDir)) {
    throw new Error('resultDir must be a fresh absolute path');
  }
  if (source === 'verified-458-corpus' && (path.dirname(resultDir) !== privateRoot
    || !path.basename(resultDir).startsWith('private-461-browser-replay-'))) {
    throw new Error('Verified output must stay in the private V3 directory');
  }
  const report = { kind: 'barocss-render-progressive-browser-replay-v1', source,
    delivery: 'synthetic-app-server-jsonrpc', modelCalls: 0,
    latencyClaim: 'none: synthetic event offsets are observation markers, not model latency',
    corpusManifestSha256: corpus.manifestSha256,
    frozenPlanSha256: corpus.verified?.frozenPlanSha256 ?? null,
    viewports, rows: corpus.rows.map(({ row, turns, eligible }) => ({ id: row.id, eligible,
      initial: { status: row.initial.status, rawSha256: turns.initial.rawSha256,
        specSha256: turns.initial.specSha256, specValid: turns.initial.specValid, errors: turns.initial.errors },
      next: { status: row.next.status, rawSha256: turns.next.rawSha256,
        specSha256: turns.next.specSha256, specValid: turns.next.specValid, errors: turns.next.errors },
      replay: null })) };
  fs.mkdirSync(resultDir, { recursive: true, mode: 0o700 });
  if (corpus.rows.some((item) => item.eligible)) {
    const deps = resolveAssets(assetRoots);
    const assets = await buildAssets(deps);
    report.assetHashes = assets.hashes;
    report.versions = deps.versions;
    fs.mkdirSync(path.join(resultDir, 'shots'), { mode: 0o700 });
    const server = createLocalServer(assets);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    let browser;
    try {
      browser = await deps.chromium.launch({ executablePath: deps.chrome, headless: true });
      report.versions.chromium = browser.version();
      for (const [index, item] of corpus.rows.entries()) {
        if (item.eligible) report.rows[index].replay = await replayRow(browser, baseUrl, item, resultDir);
      }
    } finally {
      if (browser) await browser.close();
      await new Promise((resolve) => server.close(resolve));
    }
  }
  report.measurementComplete = report.rows.some((row) => row.eligible) && report.rows.filter((row) => row.eligible)
    .every((row) => row.replay?.status === 'replayed');
  fs.writeFileSync(path.join(resultDir, 'report.json'), JSON.stringify(report, null, 2) + '\n',
    { flag: 'wx', mode: 0o600 });
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== '--corpus' || args[2] !== '--output') {
    throw new Error('Use --corpus PRIVATE_458_CORPUS_DIR --output FRESH_PRIVATE_DIR');
  }
  const [, corpusDir, , resultDir] = args;
  if (path.dirname(corpusDir) !== privateRoot || !path.basename(corpusDir).startsWith('private-458-corpus-run-')
    || path.dirname(resultDir) !== privateRoot || !path.basename(resultDir).startsWith('private-461-browser-replay-')) {
    throw new Error('CLI paths must stay in the private V3 directory');
  }
  const report = await replaySavedProgressive({ corpusDir, resultDir, source: 'verified-458-corpus' });
  const reportSha256 = sha(fs.readFileSync(path.join(resultDir, 'report.json')));
  console.log(JSON.stringify({ resultDir, reportSha256, eligible: report.rows.filter((row) => row.eligible).length,
    measurementComplete: report.measurementComplete }));
  if (!report.measurementComplete) process.exitCode = 1;
}
