// Reviewed preparation. The CLI runs only with a fresh exact-commit owner decision.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createDelivery } from './delivery.mjs';
import { createRpc } from './rpc.mjs';
import { claimApprovedLaunch, reserveApprovedTurn } from './gate.mjs';
import { verifyFrozenPlan } from './freeze.mjs';
import { buildCliPrompt } from '../barocss-render-loop/cli-profile.mjs';
import { openExperimentBrowser } from './live-browser.mjs';
import { buildAppServerArgv, assertLocalConfiguration } from './launch-profile.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const privateRoot = '/Users/user/.barocss-ai/v3';
const codex = '/Users/user/Library/pnpm/nodejs/22.19.0/bin/codex';
const planFile = path.join(here, 'frozen-plan.json');
const schemaFile = path.join(root, 'scripts/barocss-render-loop/output.schema.json');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const id = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  promise.catch(() => {});
  return { promise, resolve, reject };
};
const safeSandbox = (value) => value?.type === 'readOnly' && value.networkAccess === false;
const metadata = new Set(['thread/tokenUsage/updated', 'thread/status/changed', 'turn/moderationMetadata']);
const reasoningEvents = new Set(['item/reasoning/summaryTextDelta', 'item/reasoning/textDelta',
  'item/reasoning/summaryPartAdded']);

// Injected factories are for caller-owned authored tests. The command below has no factory flag.
export async function runExperiment({ decisionFile, candidateCommit, resultDir,
  processFactory, browserFactory = openExperimentBrowser, assetRoots,
  signal, timeouts = {}, source = 'live-app-server' }) {
  const frozen = verifyFrozenPlan();
  const plan = JSON.parse(fs.readFileSync(planFile));
  if (typeof processFactory !== 'function' || typeof browserFactory !== 'function'
    || path.dirname(resultDir ?? '') !== privateRoot
    || !path.basename(resultDir).startsWith('private-462-') || fs.existsSync(resultDir)) {
    throw new Error('Fresh private result directory and owned factories required');
  }
  if (signal?.aborted) throw new Error('Cancelled before launch');
  const claim = claimApprovedLaunch({ decisionFile, planFile, candidateCommit });
  fs.mkdirSync(resultDir, { mode: 0o700 });
  const scratch = path.join(privateRoot, `agent-scratch-462-${path.basename(resultDir)}`);
  fs.mkdirSync(scratch, { mode: 0o700 });
  fs.writeFileSync(path.join(scratch, 'schema.json'), fs.readFileSync(schemaFile), { flag: 'wx', mode: 0o600 });
  const started = performance.now();
  const clock = () => performance.now() - started;
  const log = (filename, value) => fs.appendFileSync(path.join(resultDir, filename),
    JSON.stringify(value) + '\n', { mode: 0o600 });
  const report = { kind: 'barocss-462-experiment-v1', source, candidateCommit,
    ...frozen, reservationDir: claim.reservationDir, model: plan.model,
    reasoningEffort: plan.reasoningEffort, sessions: [], turns: [], status: 'running',
    latencyClaim: 'none', prior458AllowanceExhausted: true };
  const failed = deferred();
  let failure = null, rpc, browser, active = null, child;
  const fail = (error) => {
    if (failure) return;
    failure = error instanceof Error ? error : new Error(String(error));
    active?.ready.reject(failure);
    active?.complete.reject(failure);
    failed.reject(failure);
  };
  const bounded = (operation) => Promise.race([operation, failed.promise]);
  const abort = () => fail(new Error('Owner cancelled experiment'));
  signal?.addEventListener('abort', abort, { once: true });
  const wholeTimer = setTimeout(() => fail(new Error('Whole experiment timeout')),
    Math.min(timeouts.whole ?? plan.wholeRunTimeoutMs, plan.wholeRunTimeoutMs));
  let stdoutBytes = 0, stderrBytes = 0, announcedThread = null;
  let receiptClock = 0;
  const actions = [];
  const seenTurns = new Set();
  const newDelivery = () => createDelivery({ clock: () => receiptClock, onAction: (action) => actions.push(action) });
  let delivery = newDelivery();
  const openBrowser = (directory) => bounded(Promise.resolve().then(() =>
    browserFactory({ resultDir: directory, assetRoots, clock })).then(async (opened) => {
    // A cancellation can win the race while Chromium is starting. Close that late resource too.
    if (failure) { await opened.close(); throw failure; }
    return opened;
  }));
  async function onEvent({ event, line, receivedMs }) {
    log('events.jsonl', { receivedMs, event });
    if (event.method === 'thread/started') {
      if (active || announcedThread || !id(event.params?.thread?.id)) throw new Error('Unexpected thread start');
      announcedThread = event.params.thread.id;
      return;
    }
    const current = active;
    if (!current) throw new Error('Notification outside owned turn');
    await current.ready.promise;
    const params = event.params;
    if (params?.threadId !== current.threadId
      || ('turnId' in params && params.turnId !== current.turnId)
      || (event.method.startsWith('item/') && params.turnId !== current.turnId)) {
      throw new Error('Notification identity drift');
    }
    if (metadata.has(event.method)) return;
    if (event.method === 'model/rerouted' || event.method === 'error') throw new Error('Model or turn failed');
    if (reasoningEvents.has(event.method)) {
      if (!current.reasoning.has(params.itemId)) throw new Error('Unknown reasoning item');
      return;
    }
    if (event.method === 'item/started' || event.method === 'item/completed') {
      const item = params.item;
      if (!item || !id(item.id) || !['agentMessage', 'reasoning', 'userMessage'].includes(item.type)) {
        throw new Error('Tool or invalid item rejected');
      }
      if (item.type !== 'agentMessage') {
        if (item.type === 'reasoning') current.reasoning.add(item.id);
        return;
      }
    }
    if (event.method === 'turn/completed' && params.turn?.itemsView
      && params.turn.itemsView !== 'full') throw new Error('Authoritative items unavailable');
    if (event.method === 'turn/started' && (!Array.isArray(params.turn?.items)
      || params.turn.items.some((item) => !['userMessage', 'reasoning'].includes(item?.type)))) {
      throw new Error('Invalid initial authoritative items');
    }
    receiptClock = receivedMs;
    const reduced = delivery.push(`${line}\n`, current.processId);
    if (!reduced.ok) throw new Error(`Delivery rejected: ${reduced.reason}`);
    const observed = await browser.event({ line, processId: current.processId, elapsedMs: receivedMs });
    if (!observed.ok) throw new Error(`Browser rejected: ${observed.reason}`);
    if (observed.observation) current.observations.push(observed.observation);
    if (event.method === 'turn/completed') {
      const finished = delivery.finish(current.processId);
      if (!finished.ok) throw new Error(`Incomplete delivery: ${finished.reason}`);
      current.final = structuredClone(params.turn);
      current.finalReceivedMs = receivedMs;
      current.complete.resolve();
    }
  }
  async function runTurn(row, kind, threadId, ordinal) {
    if (failure) throw failure;
    const reservation = reserveApprovedTurn({ decisionFile, planFile, candidateCommit,
      ordinal, rowId: row.id, kind });
    log('reservations.jsonl', reservation);
    const turnStartedMs = clock();
    const current = { ready: deferred(), complete: deferred(), threadId, turnId: null,
      processId: `process-${child.pid}`, reasoning: new Set(), observations: [],
      bytes: 0, startedMs: turnStartedMs };
    active = current;
    const timer = setTimeout(() => fail(new Error('Turn timeout; no retry')),
      Math.min(timeouts.turn ?? plan.perTurnTimeoutMs, plan.perTurnTimeoutMs));
    try {
      const prompt = buildCliPrompt(kind === 'initial' ? { kind, prompt: row.prompt }
        : { kind, action: 'save', revision: 1, input: { name: row.name } });
      const expectedSha = row[kind === 'initial' ? 'initialPromptSha256' : 'nextPromptSha256'];
      if (sha(prompt) !== expectedSha) throw new Error('Frozen prompt mismatch');
      const response = await bounded(rpc.request('turn/start', { threadId,
        input: [{ type: 'text', text: prompt }], model: plan.model, effort: plan.reasoningEffort,
        approvalPolicy: 'never', sandboxPolicy: { type: 'readOnly', networkAccess: false },
        outputSchema: JSON.parse(fs.readFileSync(schemaFile)) }));
      if (!id(response.turn?.id) || response.turn.status !== 'inProgress'
        || !Array.isArray(response.turn.items) || response.turn.items.some((item) =>
          !['userMessage', 'reasoning'].includes(item.type))) throw new Error('Invalid turn start response');
      const turnKey = `${threadId}\0${response.turn.id}`;
      if (seenTurns.has(turnKey)) throw new Error('Repeated owned turn identity');
      seenTurns.add(turnKey);
      current.turnId = response.turn.id;
      receiptClock = turnStartedMs;
      const ids = { processId: current.processId, threadId, turnId: current.turnId };
      if (!delivery.start(ids).ok) throw new Error('Delivery cannot start');
      await bounded(browser.start({ ids, name: row.name, startedMs: turnStartedMs }));
      current.ready.resolve();
      await bounded(current.complete.promise);
      await bounded(rpc.drain());
      if (failure) throw failure;
      const state = delivery.snapshot();
      if (state.phase !== 'committed') throw new Error('Turn was not committed');
      if (kind === 'next' && !Object.values(state.committedSpec.elements).some((node) =>
        node.type === 'Text' && [row.name, `Name: ${row.name}`].includes(node.props.text))) {
        throw new Error('Confirmation omitted the exact supplied name');
      }
      const baseline = await bounded(browser.baseline({ spec: state.committedSpec,
        name: row.name, completedMs: current.finalReceivedMs }));
      const record = { ordinal, rowId: row.id, kind, ...ids, startedMs: turnStartedMs,
        previewMs: state.previewMs, actionReadyMs: state.actionReadyMs, completedMs: state.completedMs,
        finalReceivedMs: current.finalReceivedMs, final: current.final, observations: current.observations,
        baseline, specSha256: sha(JSON.stringify(state.committedSpec)),
        earlyUsefulPaint: current.observations.some((observation) => observation.phase === 'preview'
          && Object.values(observation.screens).every((screen) => screen.hostPaintMs < current.finalReceivedMs)) };
      fs.writeFileSync(path.join(resultDir, `turn-${ordinal}.json`), JSON.stringify(record, null, 2) + '\n',
        { flag: 'wx', mode: 0o600 });
      report.turns.push(record);
      if (kind === 'initial') {
        const action = await bounded(browser.save({ name: row.name, revision: state.revision }));
        if (action.action !== 'save' || action.name !== row.name || action.threadId !== threadId
          || action.turnId !== current.turnId || action.revision !== 1
          || !delivery.action({ revision: 1, name: row.name }).ok
          || actions.at(-1)?.threadId !== threadId) throw new Error('Uncommitted or mismatched browser action');
        log('actions.jsonl', action);
      }
      active = null;
    } finally { clearTimeout(timer); }
  }
  try {
    browser = await openBrowser(path.join(resultDir, 'browser'));
    child = processFactory({ cwd: scratch, argv: buildAppServerArgv({ cwd: scratch }) });
    if (!Number.isSafeInteger(child?.pid)) throw new Error('Owned process PID missing');
    rpc = createRpc({ child, clock, onEvent, onFailure: fail,
      requestTimeoutMs: Math.min(timeouts.request ?? plan.perTurnTimeoutMs, plan.perTurnTimeoutMs),
      onRequest: (record) => log('requests.jsonl', record),
      onChunk: ({ stream, bytes, receivedMs }) => {
        if (stream === 'stdout') {
          stdoutBytes += bytes.length;
          if (active) active.bytes += bytes.length;
          if (active?.bytes > plan.maxEventBytesPerTurn) throw new Error('Turn byte ceiling exceeded');
        } else { stderrBytes += bytes.length; if (stderrBytes > 32768) throw new Error('Stderr ceiling exceeded'); }
        fs.appendFileSync(path.join(resultDir, `${stream}.bin`), bytes, { mode: 0o600 });
        log('chunks.jsonl', { stream, receivedMs, length: bytes.length,
          endOffset: stream === 'stdout' ? stdoutBytes : stderrBytes });
      } });
    const initialized = await bounded(rpc.request('initialize', {
      clientInfo: { name: 'barocss_462', version: '1' }, capabilities: { experimentalApi: false } }));
    if (typeof initialized.userAgent !== 'string' || !initialized.userAgent.includes(plan.codexVersion)) {
      throw new Error('Installed app-server version differs from frozen plan');
    }
    rpc.notify('initialized', {});
    for (const row of plan.scenarios) {
      // The two rows use independent delivery state, but one process and no session resume.
      const response = await bounded(rpc.request('thread/start', { cwd: scratch, model: plan.model,
        sandbox: 'read-only', approvalPolicy: 'never', config: { model_reasoning_effort: 'high' } }));
      await bounded(rpc.drain());
      if (!id(response.thread?.id) || response.model !== plan.model || response.cwd !== scratch
        || response.approvalPolicy !== 'never' || !safeSandbox(response.sandbox)
        || (response.reasoningEffort && response.reasoningEffort !== 'high')
        || (announcedThread && announcedThread !== response.thread.id)
        || report.sessions.some((session) => session.threadId === response.thread.id)) {
        throw new Error('Effective session settings or identity differ');
      }
      announcedThread = null;
      report.sessions.push({ rowId: row.id, threadId: response.thread.id, model: response.model,
        cwd: response.cwd, sandbox: response.sandbox, approvalPolicy: response.approvalPolicy });
      await runTurn(row, 'initial', response.thread.id, report.turns.length + 1);
      await runTurn(row, 'next', response.thread.id, report.turns.length + 1);
      // Browser/reducer revisions restart for each independent scenario.
      if (row !== plan.scenarios.at(-1)) {
        await browser.close();
        browser = await openBrowser(path.join(resultDir, 'browser-row-03'));
        delivery = newDelivery();
      }
    }
    report.status = 'completed';
    report.modelTurnsReserved = report.turns.length;
    const stats = (values) => {
      const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
      return sorted.length ? { n: sorted.length, median: (sorted[Math.floor((sorted.length - 1) / 2)]
        + sorted[Math.ceil((sorted.length - 1) / 2)]) / 2, min: sorted[0], max: sorted.at(-1) } : { n: 0 };
    };
    report.statistics = { receiptPreviewMs: stats(report.turns.map((turn) => turn.previewMs)),
      receiptActionReadyMs: stats(report.turns.map((turn) => turn.actionReadyMs)),
      receiptCompletedMs: stats(report.turns.map((turn) => turn.completedMs)),
      earlyUsefulPaintCount: report.turns.filter((turn) => turn.earlyUsefulPaint).length,
      baseline: 'same authoritative response in the same session; no extra model turn' };
    return report;
  } catch (error) {
    fail(error);
    report.status = 'failed';
    report.error = String(failure.message).slice(0, 300);
    delivery.cancel();
    if (rpc && active?.turnId) {
      try { await Promise.race([rpc.request('turn/interrupt', { threadId: active.threadId,
        turnId: active.turnId }), new Promise((resolve) => setTimeout(resolve, 250))]); } catch { /* owned cleanup only */ }
    }
    throw failure;
  } finally {
    clearTimeout(wholeTimer);
    signal?.removeEventListener('abort', abort);
    if (rpc) await rpc.close();
    if (browser) await browser.close();
    report.stdoutBytes = stdoutBytes;
    report.stderrBytes = stderrBytes;
    report.elapsedMs = clock();
    fs.writeFileSync(path.join(resultDir, 'report.json'), JSON.stringify(report, null, 2) + '\n',
      { flag: 'wx', mode: 0o600 });
  }
}

async function main() {
  if (process.argv.length !== 6 || process.argv[2] !== '--decision' || process.argv[4] !== '--result') {
    throw new Error('Use --decision PRIVATE_DECISION --result FRESH_PRIVATE_DIRECTORY');
  }
  const candidateCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf8' });
  if (dirty.trim()) throw new Error('Reviewed task worktree must be clean');
  if (execFileSync(codex, ['--version'], { encoding: 'utf8' }).trim() !== 'codex-cli 0.156.1') {
    throw new Error('Pinned Codex installation is required');
  }
  assertLocalConfiguration();
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  try {
    const report = await runExperiment({ decisionFile: process.argv[3], resultDir: process.argv[5],
      candidateCommit, signal: controller.signal, processFactory: ({ cwd, argv }) =>
        spawn(codex, argv, { cwd, shell: false, stdio: ['pipe', 'pipe', 'pipe'] }) });
    console.log(JSON.stringify({ status: report.status, turns: report.turns.length, latencyClaim: 'none' }));
  } finally { process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
