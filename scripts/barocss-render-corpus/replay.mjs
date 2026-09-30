// Read-only replay of saved model JSON. This module never invokes a model.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { validateSpec } from '../../packages/barocss-render/src/contract.mjs';
import { scoreInitialContent } from './rubric.mjs';
import { verifyCorpus } from './verify.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const viewports = Object.freeze({ desktop: { width: 1200, height: 800 }, narrow: { width: 390, height: 800 } });
const armNames = Object.freeze(['prototype', 'json-render']);

function assertDirectory(value, label) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || !fs.statSync(value).isDirectory()) {
    throw new Error(`${label} must be an existing absolute directory`);
  }
}

function readSavedTurnCore(turn, kind, expectedRawSha256) {
  const result = { declaredStatus: turn?.status ?? null, filePresent: false, rawSha256: null,
    specSha256: null, specBytes: null, envelopeValid: false, specValid: false, errors: [] };
  if (!turn || typeof turn !== 'object' || typeof turn.status !== 'string') {
    result.errors.push('Missing turn status');
    return result;
  }
  if (!turn.outputDir) {
    result.errors.push('No saved output directory');
    return result;
  }
  if (typeof turn.outputDir !== 'string' || !path.isAbsolute(turn.outputDir)) {
    result.errors.push('Output directory is not absolute');
    return result;
  }
  const finalPath = path.join(turn.outputDir, `${kind}-final.txt`);
  if (!fs.existsSync(finalPath)) {
    result.errors.push('Saved final output is missing');
    return result;
  }
  const raw = fs.readFileSync(finalPath);
  result.filePresent = true;
  result.rawSha256 = sha(raw);
  const expected = expectedRawSha256 ?? turn.rawSha256;
  if (expected && result.rawSha256 !== expected) {
    result.errors.push('Saved final digest differs from verified lineage');
    return result;
  }
  if (raw.byteLength > 32_768) {
    result.errors.push('Saved final output exceeds the transport limit');
    return result;
  }
  let envelope;
  try { envelope = JSON.parse(raw.toString('utf8')); }
  catch {
    result.errors.push('Saved final envelope is not JSON');
    return result;
  }
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)
    || Object.keys(envelope).join(',') !== 'specJson' || typeof envelope.specJson !== 'string') {
    result.errors.push('Saved final envelope is invalid');
    return result;
  }
  result.envelopeValid = true;
  result.specSha256 = sha(envelope.specJson);
  result.specBytes = Buffer.byteLength(envelope.specJson);
  let spec;
  try { spec = JSON.parse(envelope.specJson); }
  catch {
    result.errors.push('Saved screen is not JSON');
    return result;
  }
  const checked = validateSpec(spec);
  if (!checked.ok) {
    result.errors.push(...checked.errors.map((error) => `Shared schema: ${error.path}`));
    return result;
  }
  result.specValid = true;
  return { ...result, specJson: envelope.specJson };
}

export function readSavedTurn(turn, kind, expectedRawSha256) {
  const started = performance.now();
  const result = readSavedTurnCore(turn, kind, expectedRawSha256);
  return { ...result, parseValidateMs: performance.now() - started };
}

function loadManifest(corpusDir) {
  const bytes = fs.readFileSync(path.join(corpusDir, 'corpus.json'));
  const manifest = JSON.parse(bytes.toString('utf8'));
  if (manifest?.kind !== 'barocss-render-corpus-v1' || !Array.isArray(manifest.rows)) {
    throw new Error('Invalid corpus manifest');
  }
  const ids = new Set();
  for (const row of manifest.rows) {
    if (!row || typeof row.id !== 'string' || !/^[0-9]{2}$/.test(row.id) || ids.has(row.id)
      || typeof row.name !== 'string' || row.name.length < 1 || row.name.length > 80
      || typeof row.prompt !== 'string' || !row.initial || !row.next) {
      throw new Error('Invalid corpus row');
    }
    ids.add(row.id);
  }
  return { manifest, manifestSha256: sha(bytes) };
}

function generationEvidence(turn, kind) {
  if (!turn?.outputDir) return null;
  const file = path.join(turn.outputDir, `${kind}-result.json`);
  if (!fs.existsSync(file)) return { resultPresent: false };
  const bytes = fs.readFileSync(file);
  const result = JSON.parse(bytes.toString('utf8'));
  return { resultPresent: true, resultSha256: sha(bytes), elapsedMs: result.elapsedMs ?? null,
    stopReason: result.stopReason ?? null, validationFailure: result.validationFailure ?? null,
    completed: result.completed ?? false };
}

function resolveAssets(assetRoots = {}) {
  const repoDepsRoot = assetRoots.repoDepsRoot ?? process.env.REPO_DEPS_ROOT;
  const jrRoot = assetRoots.jrRoot ?? process.env.JR_ROOT;
  const pwDir = assetRoots.pwDir ?? process.env.PW_DIR;
  for (const [label, dir] of Object.entries({ repoDepsRoot, jrRoot, pwDir })) assertDirectory(dir, label);
  const fromRepo = createRequire(path.join(repoDepsRoot, 'package.json'));
  const fromPW = createRequire(path.join(pwDir, 'package.json'));
  const fromJR = createRequire(path.join(jrRoot, 'package.json'));
  for (const name of ['@json-render/core', '@json-render/react', 'react', 'react-dom', 'zod']) fromJR.resolve(name);
  const chromium = fromPW('playwright-core').chromium;
  const chrome = assetRoots.chrome ?? process.env.CHROME ?? chromium.executablePath();
  if (!path.isAbsolute(chrome) || !fs.existsSync(chrome)) throw new Error('Installed Chromium is required');
  const packageVersion = (root, name) => JSON.parse(fs.readFileSync(path.join(root, 'node_modules', name, 'package.json'))).version;
  return { esbuild: fromRepo('esbuild'), chromium, chrome, repoDepsRoot, jrRoot,
    versions: { node: process.version, playwrightCore: JSON.parse(fs.readFileSync(path.join(pwDir, 'package.json'))).version,
      jsonRenderCore: packageVersion(jrRoot, '@json-render/core'), jsonRenderReact: packageVersion(jrRoot, '@json-render/react'),
      react: packageVersion(jrRoot, 'react'), reactDom: packageVersion(jrRoot, 'react-dom'),
      zod: packageVersion(jrRoot, 'zod'), esbuild: packageVersion(repoDepsRoot, 'esbuild') } };
}

async function buildAssets(deps) {
  const built = await deps.esbuild.build({ entryPoints: [path.join(here, 'browser-app.jsx')], bundle: true,
    write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
    nodePaths: [path.join(deps.jrRoot, 'node_modules')],
    define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' });
  const app = built.outputFiles[0].contents;
  const css = fs.readFileSync(path.join(here, 'base.css'));
  const baro = fs.readFileSync(path.join(deps.repoDepsRoot, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs'));
  const boot = Buffer.from('BaroCSS.baroStart({skipExisting:true,config:{cssVarPrefix:"tw",theme:{extend:BaroCSS.shadcnTheme}}});');
  return { app, css, baro, boot, hashes: { app: sha(app), css: sha(css), baro: sha(baro), boot: sha(boot) } };
}

function createLocalServer(assets) {
  const server = http.createServer((req, res) => {
    const expectedHost = `127.0.0.1:${server.address().port}`;
    const send = (status, type, body) => {
      res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store',
        'x-content-type-options': 'nosniff', 'content-security-policy':
          "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:" });
      res.end(body);
    };
    if (req.headers.host !== expectedHost) return send(403, 'text/plain', 'Invalid host');
    if (req.method !== 'GET') return send(405, 'text/plain', 'Method not allowed');
    const pathname = new URL(req.url, `http://${expectedHost}`).pathname;
    if (pathname === '/') return send(200, 'text/html; charset=utf-8', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/base.css"></head><body><main class="min-h-screen bg-slate-100 p-4"><div id="out"></div></main><script src="/baro.js"></script><script src="/boot.js"></script><script src="/app.js"></script></body></html>');
    if (pathname === '/base.css') return send(200, 'text/css', assets.css);
    if (pathname === '/baro.js') return send(200, 'text/javascript', assets.baro);
    if (pathname === '/boot.js') return send(200, 'text/javascript', assets.boot);
    if (pathname === '/app.js') return send(200, 'text/javascript', assets.app);
    return send(404, 'text/plain', 'Not found');
  });
  return server;
}

async function snapshot(page, name) {
  await page.evaluate(() => new Promise(requestAnimationFrame));
  return page.evaluate((expectedName) => {
    const spec = window.CORPUS_REPLAY.currentSpec();
    const rendered = new Map([...document.querySelectorAll('[data-node-id]')]
      .map((element) => [element.dataset.nodeId, element]));
    const ids = [...rendered.keys()];
    const missingIds = Object.keys(spec.elements).filter((id) => !rendered.has(id));
    const layout = rendered.get(spec.root);
    const layoutStyle = layout && getComputedStyle(layout);
    const descendants = (id) => {
      const found = new Set();
      const visit = (current) => {
        found.add(current);
        for (const child of spec.elements[current].children) visit(child);
      };
      visit(id);
      return found;
    };
    const cardNodes = Object.entries(spec.elements).filter(([, node]) => node.type === 'Card');
    const cards = cardNodes.map(([id, node]) => {
      const element = rendered.get(id);
      const style = element && getComputedStyle(element);
      const subtree = descendants(id);
      return { id, present: Boolean(element), children: node.children,
        containsForm: subtree.has('name') && subtree.has('save'), subtreeSize: subtree.size,
        paddingPx: style ? parseFloat(style.paddingTop) : null,
        background: style?.backgroundColor ?? null, textColor: style?.color ?? null };
    });
    const formCard = cards.filter((card) => card.containsForm)
      .sort((a, b) => a.subtreeSize - b.subtreeSize)[0];
    const primaryCard = formCard ?? cards[0];
    const input = rendered.get('name')?.querySelector('input');
    const textNodes = [...document.querySelectorAll('[data-node-id]')].filter((element) =>
      element.tagName === 'P' || /^H[1-6]$/.test(element.tagName));
    return { ids, missingIds, rootId: spec.root, formCardId: formCard?.id ?? null, cards,
      measurementComplete: Boolean(layoutStyle && layoutStyle.display === 'grid'
        && missingIds.length === 0 && cards.every((card) => card.present)),
      columns: layoutStyle?.display === 'grid' ? layoutStyle.gridTemplateColumns.trim().split(/\s+/).length : null,
      gapPx: layoutStyle ? parseFloat(layoutStyle.gap) : null,
      paddingPx: primaryCard?.paddingPx ?? null,
      background: primaryCard?.background ?? null, textColor: primaryCard?.textColor ?? null,
      inputValue: input?.value ?? null, stateName: window.CORPUS_REPLAY.state()?.name ?? null,
      nameVisible: textNodes.some((element) => [expectedName, `Name: ${expectedName}`].includes(element.textContent)),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      actions: window.CORPUS_REPLAY.actions() };
  }, name);
}

async function replayArm({ browser, base, arm, row, initialJson, nextJson, shotsDir }) {
  const page = await browser.newPage({ viewport: viewports.desktop, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(`page:${String(error.message).slice(0, 160)}`));
  page.on('request', (request) => { if (!request.url().startsWith(base)) errors.push('external-request'); });
  await page.route('**/*', (route) => route.request().url().startsWith(base) ? route.continue() : route.abort());
  const result = { arm, status: 'pending', initial: null, next: null, errors };
  try {
    await page.goto(base, { waitUntil: 'load' });
    const initialApply = await page.evaluate(([selectedArm, json]) => window.CORPUS_REPLAY.mount(selectedArm, json), [arm, initialJson]);
    result.initial = { apply: initialApply, screens: {} };
    if (!initialApply.ok) { result.status = initialApply.source; return result; }
    for (const [viewportName, viewport] of Object.entries(viewports)) {
      await page.setViewportSize(viewport);
      const screen = await snapshot(page, row.name);
      const filename = `${row.id}-${arm}-initial-${viewportName}.png`;
      const bytes = await page.screenshot({ path: path.join(shotsDir, filename), fullPage: true });
      result.initial.screens[viewportName] = { ...screen, screenshot: `shots/${filename}`, screenshotSha256: sha(bytes) };
    }
    await page.locator('[data-node-id="name"] input').fill(row.name);
    await page.locator('[data-node-id="save"]').click();
    result.action = { stateName: await page.evaluate(() => window.CORPUS_REPLAY.state()?.name ?? null),
      events: await page.evaluate(() => window.CORPUS_REPLAY.actions()) };
    const nextApply = await page.evaluate((json) => window.CORPUS_REPLAY.update(json), nextJson);
    result.next = { apply: nextApply, screens: {} };
    if (!nextApply.ok) { result.status = nextApply.source; return result; }
    for (const [viewportName, viewport] of Object.entries(viewports)) {
      await page.setViewportSize(viewport);
      const screen = await snapshot(page, row.name);
      const filename = `${row.id}-${arm}-next-${viewportName}.png`;
      const bytes = await page.screenshot({ path: path.join(shotsDir, filename), fullPage: true });
      result.next.screens[viewportName] = { ...screen, screenshot: `shots/${filename}`, screenshotSha256: sha(bytes) };
    }
    result.status = 'replayed';
    if ([...Object.values(result.initial.screens), ...Object.values(result.next.screens)]
      .some((screen) => !screen.measurementComplete)) result.status = 'measurement-incomplete';
    result.actionPass = result.action.stateName === row.name
      && JSON.stringify(result.action.events) === JSON.stringify([{ action: 'save', value: row.name }]);
    result.nextNameVisible = Object.values(result.next.screens).every((screen) => screen.nameVisible);
    result.statePreserved = Object.values(result.next.screens).every((screen) => screen.stateName === row.name);
    result.overflowFree = [...Object.values(result.initial.screens), ...Object.values(result.next.screens)]
      .every((screen) => !screen.overflow);
    return result;
  } catch (error) {
    result.status = 'browser-error';
    result.errors.push(`browser:${String(error.message).slice(0, 160)}`);
    return result;
  } finally { await page.close(); }
}

function compareArms(arms) {
  if (arms.length !== 2 || arms.some((arm) => arm.status !== 'replayed')) {
    return { comparable: false, reason: 'Both arms must replay' };
  }
  const [prototype, official] = arms;
  const screens = {};
  for (const stage of ['initial', 'next']) for (const viewport of Object.keys(viewports)) {
    const left = prototype[stage].screens[viewport];
    const right = official[stage].screens[viewport];
    screens[`${stage}-${viewport}`] = {
      screenshotIdentical: left.screenshotSha256 === right.screenshotSha256,
      layoutIdentical: left.measurementComplete && right.measurementComplete
        && JSON.stringify([left.ids, left.rootId, left.columns, left.gapPx, left.cards,
          left.overflow]) === JSON.stringify([right.ids, right.rootId, right.columns,
          right.gapPx, right.cards, right.overflow]),
      stateIdentical: left.stateName === right.stateName && left.inputValue === right.inputValue,
    };
  }
  return { comparable: true, screens, actionIdentical:
    JSON.stringify(prototype.action) === JSON.stringify(official.action) };
}

export async function replaySaved({ corpusDir, resultDir, assetRoots } = {}) {
  assertDirectory(corpusDir, 'corpusDir');
  if (typeof resultDir !== 'string' || !path.isAbsolute(resultDir) || fs.existsSync(resultDir)) {
    throw new Error('resultDir must be a fresh absolute path');
  }
  const isActualCorpus = path.dirname(corpusDir) === '/Users/user/.barocss-ai/v3'
    && path.basename(corpusDir).startsWith('private-458-corpus-run-');
  const isCalibration = path.dirname(corpusDir) === '/Users/user/.barocss-ai/v3'
    && path.basename(corpusDir).startsWith('private-458-calibration-');
  const verified = isActualCorpus ? verifyCorpus(corpusDir) : null;
  const { manifest, manifestSha256 } = loadManifest(corpusDir);
  if (verified && verified.corpusManifestSha256 !== manifestSha256) {
    throw new Error('Corpus manifest changed after lineage verification');
  }
  const verifiedHashes = new Map(verified?.lineage.filter((turn) => turn.rawSha256)
    .map((turn) => [`${turn.rowId}:${turn.kind}`, turn.rawSha256]) ?? []);
  const prepared = manifest.rows.map((row) => {
    const initial = readSavedTurn(row.initial, 'initial', verifiedHashes.get(`${row.id}:initial`));
    const next = readSavedTurn(row.next, 'next', verifiedHashes.get(`${row.id}:next`));
    const eligible = row.initial.status === 'valid' && row.next.status === 'valid'
      && initial.specValid && next.specValid;
    return { row, initial, next, eligible, skipReason: eligible ? null
      : row.initial.status !== 'valid' ? `initial-${row.initial.status}`
        : !initial.specValid ? 'initial-saved-output-invalid'
          : row.next.status !== 'valid' ? `next-${row.next.status}` : 'next-saved-output-invalid' };
  });
  const report = { kind: 'barocss-render-saved-replay-v1',
    source: verified ? 'verified-458-corpus' : isCalibration ? 'accepted-460-calibration-replay' : 'authored-fixture-replay',
    frozenPlanSha256: verified?.frozenPlanSha256 ?? null, corpusManifestSha256: manifestSha256,
    viewports, arms: armNames, rows: prepared.map(({ row, initial, next, eligible, skipReason }) => ({
      id: row.id, eligible, skipReason,
      generation: { initial: generationEvidence(row.initial, 'initial'), next: generationEvidence(row.next, 'next') },
      initialContent: initial.specValid ? scoreInitialContent(row.id, JSON.parse(initial.specJson)) : null,
      initial: { ...initial, specJson: undefined }, next: { ...next, specJson: undefined }, replay: [], comparison: null })) };
  if (!prepared.some((item) => item.eligible)) {
    fs.mkdirSync(resultDir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(resultDir, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    return report;
  }
  const deps = resolveAssets(assetRoots);
  const assets = await buildAssets(deps);
  report.versions = deps.versions;
  report.assetHashes = assets.hashes;
  fs.mkdirSync(resultDir, { recursive: true, mode: 0o700 });
  const shotsDir = path.join(resultDir, 'shots');
  fs.mkdirSync(shotsDir, { mode: 0o700 });
  const server = createLocalServer(assets);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await deps.chromium.launch({ executablePath: deps.chrome, headless: true });
    report.versions.chromium = browser.version();
    for (let index = 0; index < prepared.length; index++) {
      const item = prepared[index];
      if (!item.eligible) continue;
      for (const arm of armNames) report.rows[index].replay.push(await replayArm({ browser, base, arm,
        row: item.row, initialJson: item.initial.specJson, nextJson: item.next.specJson, shotsDir }));
      report.rows[index].comparison = compareArms(report.rows[index].replay);
    }
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
  fs.writeFileSync(path.join(resultDir, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let corpusDir, resultDir;
  if (args.length === 1 && args[0] === '--claim') {
    const claim = JSON.parse(fs.readFileSync('/Users/user/.barocss-ai/v3/private-458-corpus-claim.json', 'utf8'));
    corpusDir = claim.outputDir;
    resultDir = path.join('/Users/user/.barocss-ai/v3',
      `private-458-corpus-replay-${path.basename(corpusDir).slice('private-458-corpus-run-'.length)}`);
  } else if (args.length === 4 && args[0] === '--corpus' && args[2] === '--output') {
    corpusDir = args[1]; resultDir = args[3];
  } else {
    throw new Error('Use --claim or --corpus ABSOLUTE_DIR --output FRESH_ABSOLUTE_DIR');
  }
  if (path.dirname(corpusDir) !== '/Users/user/.barocss-ai/v3'
    || !path.basename(corpusDir).startsWith('private-458-corpus-run-')) {
    throw new Error('Saved model output requires a private V3 corpus directory');
  }
  if (path.dirname(resultDir) !== '/Users/user/.barocss-ai/v3'
    || !path.basename(resultDir).startsWith('private-458-corpus-replay-')) {
    throw new Error('Saved screenshots and results require a private V3 output directory');
  }
  const report = await replaySaved({ corpusDir, resultDir });
  console.log(JSON.stringify({ rows: report.rows.length, replayed: report.rows.filter((row) => row.eligible).length,
    resultDir }));
}
