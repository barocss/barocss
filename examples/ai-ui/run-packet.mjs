import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { preparePacket, validatePacket, digest, DECLARATION_DIGEST, buildArgv } from './launch-packet.mjs';
import { createPacketApp } from './codex-transport.mjs';
import { requestScreen } from './scenario.mjs';
import { packetUsage } from './usage.mjs';
import { snapshotCatalog, verifyCatalogOffline } from './model-catalog.mjs';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const ownFile = fileURLToPath(import.meta.url);
const quote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
export const executionCommand = (root) => `${quote(process.execPath)} ${quote(ownFile)} --run ${quote(path.join(root, 'experiment.json'))} --approval ABS_PRIVATE_APPROVAL_FILE`;
const scenario = {
  request: 'Use a single-column Layout without a Card. Give the name and topic fields concise labels and the review button the label Review details. Keep the permitted host fields and summaries.',
  input: { draft: { name: '민지', topic: '커피' } },
  edits: ['Tea 차 두 잔', 'Hot tea 따뜻한 차'],
  actions: ['review', 'edit', 'review', 'confirm'],
};
const write = (file, data) => fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data, null, 2)+'\n', { flag: 'wx', mode: 0o600 });
const privateFile = (file) => {
  const info = fs.lstatSync(file);
  if (!info.isFile() || (info.mode & 0o077) || info.size > 65_536) throw new Error('Private bounded regular file required');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
};
function checkExperiment(experiment) {
  if (!experiment || experiment.version !== 'browser-packet-v1'
    || !/^[0-9a-f-]{36}$/i.test(experiment.runId ?? '')
    || experiment.command !== executionCommand(experiment.packet?.root ?? '')
    || experiment.runnerDigest !== digest(fs.readFileSync(ownFile, 'utf8'))
    || JSON.stringify(experiment.scenario) !== JSON.stringify(scenario)
    || experiment.candidateSha !== experiment.packet?.candidateSha
    || experiment.packetDigest !== validatePacket(experiment.packet)
    || experiment.declarationsDigest !== DECLARATION_DIGEST)
    throw new Error('Prepared experiment changed');
  return digest(experiment);
}
export function prepareExperiment(root, catalogSource) {
  if (!path.isAbsolute(root)) throw new Error('Absolute private root required');
  const candidateSha = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (execFileSync('git', ['-C', repo, 'status', '--porcelain'], { encoding: 'utf8' }).trim()) throw new Error('Commit the clean candidate before preparation');
  const cliPath = execFileSync('which', ['codex'], { encoding: 'utf8' }).trim();
  if (execFileSync(cliPath, ['--version'], { encoding: 'utf8' }).trim() !== 'codex-cli 0.156.1') throw new Error('Installed CLI changed');
  if (process.version !== 'v22.19.0') throw new Error('Installed Node changed');
  if (!path.isAbsolute(catalogSource ?? '')) throw new Error('Explicit existing model catalog source required');
  const catalog = snapshotCatalog(catalogSource, 'gpt-6.1-sol', 'high');
  const packet = preparePacket({ candidateSha, cliPath, nodeBin: path.dirname(process.execPath), root, modelCatalogDigest: catalog.digest });
  checkDependencies(packet);
  for (const codexId of [undefined, 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'])
    execFileSync(cliPath, [...buildArgv(packet, { codexId, finalPath: path.join(root, 'final.txt') }), '--help'], { stdio: 'pipe', timeout: 5000 });
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  if (!fs.lstatSync(root).isDirectory() || (fs.statSync(root).mode & 0o077) || fs.readdirSync(root).length) throw new Error('Empty private directory required');
  const catalogFile = path.join(root, 'model-catalog.json');
  write(catalogFile, catalog.text);
  verifyCatalogOffline(catalogFile, { root, cliPath, nodeBin: packet.cli.nodeBin, model: packet.cli.model, effort: packet.cli.effort, digest: catalog.digest });
  write(path.join(root, 'catalog-provenance.json'), { sourceVersion: catalog.sourceVersion, modelCatalogDigest: catalog.digest });
  const experiment = { version: 'browser-packet-v1', candidateSha, packet, packetDigest: validatePacket(packet),
    declarationsDigest: DECLARATION_DIGEST, runId: randomUUID(), runnerDigest: digest(fs.readFileSync(ownFile, 'utf8')), command: executionCommand(root), scenario };
  const experimentDigest = checkExperiment(experiment);
  write(path.join(root, 'packet.json'), packet); write(path.join(root, 'experiment.json'), experiment);
  const command = experiment.command;
  write(path.join(root, 'request.txt'), `PREPARED ONLY. Request fresh direct owner authority for candidate ${candidateSha}, packet ${experiment.packetDigest}, declarations ${DECLARATION_DIGEST}, model catalog ${catalog.digest}, experiment ${experimentDigest}, run UUID ${experiment.runId}.\nUse Codex CLI 0.156.1, gpt-6.1-sol/high, five reservations including failed/uncertain starts, 180 s per turn, 900 s total, zero retries, one explicitly mapped Codex session. Stop on the first error/cancellation/tool/identity or model/catalog drift/timeout/invalid screen. No tools or agent network, existing private ChatGPT auth without API keys, no downloads or release/publication.\nRequest: ${scenario.request}\nInitial data: ${JSON.stringify(scenario.input)}\nTopic edits: ${JSON.stringify(scenario.edits)}\nCommand: ${command}\nAuthority must bind these exact digests/run/candidate with kind owner-approved and a fresh ownerDecisionId. Preparation creates no authority or authentication. Private prerequisite: owner provisions existing ChatGPT CLI auth in isolated codex-home; this runner never copies it.\n`);
  return { status: 'prepared-not-approved', candidateSha, packetDigest: experiment.packetDigest, experimentDigest, modelCalls: 0 };
}
function authorize(experiment, approval, spawnProcess) {
  const experimentDigest = checkExperiment(experiment);
  if (!approval || approval.experimentDigest !== experimentDigest || approval.declarationsDigest !== experiment.declarationsDigest
    || approval.candidateSha !== experiment.candidateSha || approval.packetDigest !== experiment.packetDigest || approval.runId !== experiment.runId
    || !['fake-test', 'owner-approved'].includes(approval.kind) || (approval.kind === 'fake-test' && spawnProcess === spawn)
    || (approval.kind === 'owner-approved' && (spawnProcess !== spawn || typeof approval.ownerDecisionId !== 'string' || !approval.ownerDecisionId.trim())))
    throw new Error('Exact fresh private owner authority required');
}
export const hasLiveTimingEvidence = (mode, n) => mode === 'codex-cli' && Number.isSafeInteger(n) && n > 0;
export function variation(spec, stage, input) {
  const fixture = requestScreen(stage, input);
  const walk = (screen, id = screen.root) => {
    const node = screen.elements[id];
    return [node, ...node.children.flatMap((child) => walk(screen, child))];
  };
  const structure = (screen, id = screen.root) => {
    const node = screen.elements[id];
    return { type: node.type, ...(node.type === 'Input' ? { binding: node.props.value.$bindState } : {}),
      ...(node.type === 'Button' ? { action: node.on.press.action } : {}),
      ...(node.type === 'Text' ? { text: node.props.text } : {}), children: node.children.map((child) => structure(screen, child)) };
  };
  const styles = (screen) => walk(screen).filter((node) => ['Layout', 'Card'].includes(node.type)).map((node) =>
    node.type === 'Layout' ? { type: node.type, columns: node.props.columns, gap: node.props.gap }
      : { type: node.type, padding: node.props.padding, tone: node.props.tone });
  const labels = (screen) => walk(screen).filter((node) => ['Input', 'Button'].includes(node.type)).map((node) => ({ type: node.type, label: node.props.label }));
  const differs = (extract) => JSON.stringify(extract(spec)) !== JSON.stringify(extract(fixture));
  return { structure: differs(structure), styles: differs(styles), labels: differs(labels),
    identity: differs((screen) => walk(screen).map((node) => node.props.id)) };
}

function checkDependencies(packet) {
  const require = createRequire(import.meta.url);
  if (require('react/package.json').version !== packet.environment.react
    || require('react-dom/package.json').version !== packet.environment.react
    || require('playwright-core/package.json').version !== packet.environment.playwright)
    throw new Error('Prepared dependency environment changed');
}
export async function runExperiment(experiment, { approval, spawnProcess = spawn, signal } = {}) {
  authorize(experiment, approval, spawnProcess);
  if (signal?.aborted) throw new Error('Experiment cancelled before dispatch');
  checkDependencies(experiment.packet);
  experiment = structuredClone(experiment);
  const root = experiment.packet.root;
  // App creation enforces candidate/CLI/Node checks and atomically consumes this run's lock.
  const app = await createPacketApp({ packet: experiment.packet, approval, spawnProcess });
  let browser, page; const displays = [], errors = [], csp = [], external = [];
  let failure = null, terminalHostState = null; const started = performance.now();
  let deadlineExpired = false;
  const abort = () => app.session.cancel();
  const deadline = setTimeout(() => {
    deadlineExpired = true; abort(); browser?.close().catch(() => {});
  }, experiment.packet.totalTimeoutMs);
  deadline.unref();
  signal?.addEventListener('abort', abort, { once: true });
  const remaining = () => Math.max(1, experiment.packet.totalTimeoutMs - (performance.now() - started));
  try {
    const require = createRequire(import.meta.url);
    browser = await require('playwright-core').chromium.launch({ headless: true, timeout: Math.min(15_000, remaining()) });
    if (browser.version() !== experiment.packet.environment.chromium) throw new Error('Prepared browser changed');
    if (signal?.aborted) throw new Error('Experiment cancelled');
    page = await browser.newPage({ viewport: { width: 1200, height: 900 } }); page.setDefaultTimeout(5000);
    page.on('pageerror', () => errors.push('page-error'));
    await page.exposeFunction('recordCSP', () => csp.push('csp-violation'));
    await page.addInitScript(() => document.addEventListener('securitypolicyviolation', () => window.recordCSP()));
    await page.route('**/*', (route) => {
      if (new URL(route.request().url()).origin !== app.url) { external.push('external-request'); return route.abort(); }
      return route.continue();
    });
    await page.goto(app.url); await page.locator('[data-phase="idle"]').waitFor();
    const mode = await page.locator('#mode').textContent();
    if (!mode.includes(approval.kind === 'fake-test' ? 'codex-cli-fake (fake process; no model)' : 'codex-cli (actual Codex CLI)')) throw new Error('Wrong browser source label');
    await page.getByLabel('Screen request', { exact: true }).fill(experiment.scenario.request);
    if (signal?.aborted || deadlineExpired) throw new Error('Experiment cancelled before initial dispatch');
    await page.getByRole('button', { name: 'Generate', exact: true }).click();
    async function capture(index, action) {
      let state, visible;
      const until = performance.now() + Math.min(experiment.packet.perTurnTimeoutMs + 2000, remaining());
      while (performance.now() < until) {
        if (signal?.aborted || deadlineExpired) throw new Error('Experiment cancelled');
        state = app.session.snapshot();
        if (['failed', 'cancelled'].includes(state.phase)) throw new Error('Terminal generation failure');
        const records = await page.evaluate(() => window.AI_UI.diagnostics().displays);
        visible = records.find((record) => record.sessionId === state.sessionId && record.revision === state.revision);
        if (state.phase === 'ready' && state.displays === index + 1 && visible) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      if (!visible || state.displays !== index + 1 || state.phase !== 'ready') throw new Error('Useful presentation deadline');
      const expectedInput = structuredClone(experiment.scenario.input);
      if (index > 0) expectedInput.draft.topic = experiment.scenario.edits[index < 3 ? 0 : 1];
      if (state.screenRequest !== experiment.scenario.request || JSON.stringify(state.input) !== JSON.stringify(expectedInput))
        throw new Error('Frozen request/input lineage changed');
      if (errors.length || csp.length || external.length) throw new Error('Browser safety failure');
      const accepted = privateFile(path.join(root, `turn-${index + 1}-validated-spec.json`));
      if (JSON.stringify(accepted) !== JSON.stringify(state.spec)) throw new Error('Accepted spec lineage changed');
      const point = visible.userActionSent, useful = visible.observation.firstUsefulPresentation;
      const actionToUsefulMs = action && point?.clock === 'browser-navigation-monotonic-ms' && useful?.clock === point.clock
        && useful.value >= point.value ? useful.value - point.value : null;
      const rendered = await page.evaluate((spec) => {
        const elements = [...document.querySelectorAll('[data-node-id]')];
        return Object.values(spec.elements).map((node) => {
          const element = elements.find((element) => element.dataset.nodeId === node.props.id);
          const style = getComputedStyle(element), rect = element.getBoundingClientRect();
          return { id: node.props.id, type: node.type, content: node.type === 'Input' ? element.value : element.textContent,
            width: rect.width, height: rect.height, display: style.display, columns: style.gridTemplateColumns,
            gap: style.gap, padding: style.paddingTop, background: style.backgroundColor, color: style.color };
        });
      }, accepted);
      const record = { index: index + 1, action, state, acceptedSpec: accepted, browser: visible, rendered,
        errors: [...errors], csp: [...csp], external: [...external],
        variation: variation(accepted, state.stage, state.input), actionToUsefulMs,
        timingBoundary: 'browser click handler to content/style-checked rAF proxy, not physical paint' };
      write(path.join(root, `display-${index + 1}.json`), record);
      await page.screenshot({ path: path.join(root, `display-${index + 1}.png`) }); fs.chmodSync(path.join(root, `display-${index + 1}.png`), 0o600);
      displays.push(record);
    }
    await capture(0, null);
    const select = (node) => page.locator(`[data-node-id=${JSON.stringify(node.props.id)}]`);
    for (const [index, action] of experiment.scenario.actions.entries()) {
      if (signal?.aborted || deadlineExpired) throw new Error('Experiment cancelled before action dispatch');
      const state = app.session.snapshot();
      if (action === 'review') {
        const field = Object.values(state.spec.elements).find((node) => node.type === 'Input' && node.props.value.$bindState === '/draft/topic');
        if (!field) throw new Error('Declared field missing');
        await select(field).fill(experiment.scenario.edits[index === 0 ? 0 : 1]);
      }
      const button = Object.values(state.spec.elements).find((node) => node.type === 'Button' && node.on.press.action === action);
      if (!button) throw new Error('Declared action missing');
      await select(button).click(); await capture(index + 1, action);
    }
  } catch { failure = 'terminal-experiment-failure'; }
  finally {
    clearTimeout(deadline);
    signal?.removeEventListener('abort', abort);
    terminalHostState = app.session.snapshot();
    const pending = app.session.settled();
    await app.close(); await pending;
    if (browser) await browser.close();
  }
  if (errors.length || csp.length || external.length || displays.length !== 5) failure ??= 'terminal-experiment-failure';
  const files = fs.readdirSync(root);
  const results = files.filter((name) => /^turn-\d+-result.json$/.test(name)).sort((a, b) => Number(a.split('-')[1]) - Number(b.split('-')[1]));
  const turnResults = results.map((name) => privateFile(path.join(root, name)));
  const last = turnResults.at(-1) ?? null;
  const counts = { reserved: files.filter((name) => /^turn-\d+-reservation.json$/.test(name)).length,
    attempted: last?.attempted ?? 0, completed: last?.completed ?? 0, accepted: last?.accepted ?? 0, useful: displays.length };
  const samples = displays.map((record) => record.actionToUsefulMs).filter((value) => value !== null).sort((a, b) => a - b);
  const latency = { clock: 'browser-navigation-monotonic-ms', boundary: 'userActionSent to firstUsefulPresentation proxy', n: samples.length,
    median: samples.length ? (samples[Math.floor((samples.length - 1) / 2)] + samples[Math.floor(samples.length / 2)]) / 2 : null,
    min: samples[0] ?? null, max: samples.at(-1) ?? null, liveModelEvidence: hasLiveTimingEvidence(app.mode, samples.length) };
  const report = { status: failure ? 'partial-failure' : 'completed', failure, mode: app.mode, candidateSha: experiment.candidateSha,
    packetDigest: experiment.packetDigest, modelCatalogDigest: experiment.packet.modelCatalogDigest ?? null, declarationsDigest: DECLARATION_DIGEST, runId: experiment.runId,
    experimentDigest: checkExperiment(experiment), counts, displays, latency, usage: packetUsage(turnResults), errors, csp, external,
    terminalHostState, limits: 'No retries; five reservations; 180s per turn/900s total. No real-time suitability claim.' };
  write(path.join(root, 'report.json'), report);
  return { status: report.status, mode: app.mode, counts, packetDigest: experiment.packetDigest, experimentDigest: report.experimentDigest };
}
if (process.argv[1] === ownFile) {
  try {
    const args = process.argv.slice(2); let result;
    if (args.length === 4 && args[0] === '--prepare' && args[2] === '--catalog') result = prepareExperiment(args[1], args[3]);
    else if (args.length === 4 && args[0] === '--run' && args[2] === '--approval') {
      const experiment = privateFile(args[1]), approval = privateFile(args[3]);
      if (approval.kind !== 'owner-approved') throw new Error('CLI requires direct owner authority');
      const abort = new AbortController(); const stop = () => abort.abort();
      process.once('SIGINT', stop); process.once('SIGTERM', stop);
      try { result = await runExperiment(experiment, { approval, signal: abort.signal }); }
      finally { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); }
    } else throw new Error('Use --prepare PRIVATE_ROOT --catalog EXISTING_LOCAL_SOURCE or --run PRIVATE_EXPERIMENT --approval PRIVATE_AUTHORITY');
    console.log(JSON.stringify(result)); if (result.status === 'partial-failure') process.exitCode = 1;
  } catch { console.error('Packet command rejected; inspect private prerequisites and exact authority.'); process.exitCode = 1; }
}
