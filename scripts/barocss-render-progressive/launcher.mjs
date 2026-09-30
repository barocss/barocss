// Reviewed preparation. The CLI runs only with a fresh exact-commit owner decision.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createDelivery } from './delivery.mjs';
import { createRpc } from './rpc.mjs';
import { acceptPassiveNotification, validateInitializeResponse, validateThread,
  validateThreadStartResponse, validateTurnStartResponse, validateThreadStatusNotification }
  from './protocol-contract.mjs';
import { claimApprovedLaunch, reserveApprovedTurn } from './gate.mjs';
import { verifyFrozenPlan } from './freeze.mjs';
import { verifyCurrentHostPlan, readCurrentHostDecision, claimCurrentHostLaunch,
  reserveCurrentHostTurn } from './current-host-gate.mjs';
import { verifyCurrentHost, buildCurrentHostArgv } from './current-host-profile.mjs';
import { buildCliPrompt } from '../barocss-render-loop/cli-profile.mjs';
import { openExperimentBrowser } from './live-browser.mjs';
import { buildAppServerArgv, assertLocalConfiguration } from './launch-profile.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const privateRoot = '/Users/user/.barocss-ai/v3';
const codex = '/Users/user/Library/pnpm/nodejs/22.19.0/bin/codex';
const defaultPlanFile = path.join(here, 'frozen-plan.json');
const currentHostPlanFile = path.join(here, 'current-host-plan.json');
const schemaFile = path.join(root, 'scripts/barocss-render-loop/output.schema.json');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const id = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  promise.catch(() => {});
  return { promise, resolve, reject };
};
const metadata = new Set(['thread/tokenUsage/updated', 'turn/moderationMetadata']);
const reasoningEvents = new Set(['item/reasoning/summaryTextDelta', 'item/reasoning/textDelta',
  'item/reasoning/summaryPartAdded']);

// Injected factories are for caller-owned authored tests. The command below has no factory flag.
export async function runExperiment({ decisionFile, candidateCommit, resultDir,
  processFactory, browserFactory = openExperimentBrowser, assetRoots,
  signal, timeouts = {}, source = 'live-app-server', mode = 'default', hostOptions = {} }) {
  if (!['default', 'owner-approved-current-host'].includes(mode)) throw new Error('Unknown launch mode');
  const currentHost = mode === 'owner-approved-current-host';
  const planFile = currentHost ? currentHostPlanFile : defaultPlanFile;
  const frozen = currentHost ? verifyCurrentHostPlan({ planFile }) : verifyFrozenPlan();
  const plan = JSON.parse(fs.readFileSync(planFile));
  if (typeof processFactory !== 'function' || typeof browserFactory !== 'function'
    || path.dirname(resultDir ?? '') !== privateRoot
    || !path.basename(resultDir).startsWith(currentHost ? 'private-464-' : 'private-462-') || fs.existsSync(resultDir)) {
    throw new Error('Fresh private result directory and owned factories required');
  }
  if (signal?.aborted) throw new Error('Cancelled before launch');
  const decision = currentHost
    ? readCurrentHostDecision({ decisionFile, planFile, candidateCommit }).decision : null;
  const inspectHost = () => verifyCurrentHost({ ...hostOptions, cwd: hostOptions.cwd ?? privateRoot,
    expectedFingerprintSha256: decision.hostFingerprintSha256 });
  const inspection = currentHost ? inspectHost() : null;
  const gateOptions = { decisionFile, planFile, candidateCommit, ...(currentHost
    ? { hostFingerprintSha256: inspection.fingerprintSha256 } : {}) };
  const claim = currentHost ? claimCurrentHostLaunch(gateOptions) : claimApprovedLaunch(gateOptions);
  fs.mkdirSync(resultDir, { mode: 0o700 });
  const scratch = path.join(privateRoot, `agent-scratch-462-${path.basename(resultDir)}`);
  fs.mkdirSync(scratch, { mode: 0o700 });
  fs.writeFileSync(path.join(scratch, 'schema.json'), fs.readFileSync(schemaFile), { flag: 'wx', mode: 0o600 });
  const started = performance.now();
  const clock = () => performance.now() - started;
  const log = (filename, value) => fs.appendFileSync(path.join(resultDir, filename),
    JSON.stringify(value) + '\n', { mode: 0o600 });
  const report = { kind: currentHost ? 'barocss-464-experiment-v1' : 'barocss-462-experiment-v1',
    mode, source, candidateCommit, ...(currentHost ? { hostFingerprintSha256: inspection.fingerprintSha256,
      startupLimits: inspection.limits } : {}),
    ...frozen, reservationDir: claim.reservationDir, model: plan.model,
    reasoningEffort: plan.reasoningEffort, sessions: [], turns: [], status: 'running',
    latencyClaim: 'none', prior458AllowanceExhausted: true };
  const failed = deferred();
  let failure = null, rpc, browser, active = null, child;
  let reservations = 0, pendingInitial = null;
  let phase = 'initializing', pendingSession = null, ownedThread = null;
  let passiveCount = 0, remoteIdentity = null;
  const reserve = (ordinal, rowId, kind) => {
    const options = { ...gateOptions, ordinal, rowId, kind };
    const reservation = currentHost ? reserveCurrentHostTurn(options) : reserveApprovedTurn(options);
    reservations++;
    log('reservations.jsonl', reservation);
    return reservation;
  };
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
    if (acceptPassiveNotification(event, { phase })) {
      if (++passiveCount > 64) throw new Error('Passive metadata ceiling exceeded');
      if (event.method === 'remoteControl/status/changed') {
        const identity = JSON.stringify([event.params.installationId, event.params.serverName]);
        if (remoteIdentity !== null && identity !== remoteIdentity) throw new Error('Remote identity drift');
        remoteIdentity = identity;
      }
      return;
    }
    if (event.method === 'thread/started') {
      if (active || !pendingSession || announcedThread) throw new Error('Unexpected thread start');
      validateThread(event.params?.thread, { model: plan.model, cwd: scratch });
      announcedThread = event.params.thread.id;
      return;
    }
    if (event.method === 'thread/status/changed') {
      if (pendingSession) {
        // Buffer only during this owned request, then bind every notice to its validated response.
        if (pendingSession.statusIds.length >= 16) throw new Error('Startup metadata ceiling exceeded');
        pendingSession.statusIds.push(validateThreadStatusNotification(event, { phase }));
      } else {
        if (!ownedThread) throw new Error('Notification outside owned session');
        validateThreadStatusNotification(event, { phase, threadId: ownedThread });
      }
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
    if (currentHost) inspectHost();
    if (kind === 'initial' && pendingInitial?.ordinal === ordinal) pendingInitial = null;
    else reserve(ordinal, row.id, kind);
    const turnStartedMs = clock();
    const current = { ready: deferred(), complete: deferred(), threadId, turnId: null,
      processId: `process-${child.pid}`, reasoning: new Set(), observations: [],
      bytes: 0, startedMs: turnStartedMs };
    active = current;
    phase = 'turn-active';
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
        approvalsReviewer: 'auto_review',
        outputSchema: JSON.parse(fs.readFileSync(schemaFile)) }));
      validateTurnStartResponse(response);
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
      phase = 'between-turns';
    } finally { clearTimeout(timer); }
  }
  try {
    browser = await openBrowser(path.join(resultDir, 'browser'));
    const beforeSpawn = currentHost ? inspectHost() : null;
    // Charge uncertain initialization or session failures before the native process starts.
    if (currentHost) pendingInitial = reserve(1, plan.scenarios[0].id, 'initial');
    child = processFactory({ cwd: scratch, argv: currentHost
      ? buildCurrentHostArgv({ cwd: scratch, inspection: beforeSpawn }) : buildAppServerArgv({ cwd: scratch }) });
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
    validateInitializeResponse(initialized, plan.codexVersion, currentHost
      ? { codexHome: inspection.inspected.configHome } : {});
    rpc.notify('initialized', {});
    for (const row of plan.scenarios) {
      // The two rows use independent delivery state, but one process and no session resume.
      if (currentHost) {
        inspectHost();
        // Every uncertain session start consumes its initial slot, including row 03.
        pendingInitial ??= reserve(report.turns.length + 1, row.id, 'initial');
      }
      phase = 'starting-session';
      pendingSession = { statusIds: [] };
      ownedThread = null;
      const response = await bounded(rpc.request('thread/start', { cwd: scratch, model: plan.model,
        modelProvider: 'openai', approvalsReviewer: 'auto_review',
        sandbox: 'read-only', approvalPolicy: 'never', config: { model_reasoning_effort: 'high' } }));
      validateThreadStartResponse(response, { model: plan.model, cwd: scratch });
      await bounded(rpc.drain());
      if ((announcedThread && announcedThread !== response.thread.id)
        || pendingSession.statusIds.some((threadId) => threadId !== response.thread.id)
        || report.sessions.some((session) => session.threadId === response.thread.id)) {
        throw new Error('Effective session settings or identity differ');
      }
      ownedThread = response.thread.id;
      pendingSession = null;
      phase = 'between-turns';
      announcedThread = null;
      report.sessions.push({ rowId: row.id, threadId: response.thread.id, model: response.model,
        cwd: response.cwd, sandbox: response.sandbox, approvalPolicy: response.approvalPolicy,
        modelProvider: response.modelProvider, reasoningEffort: response.reasoningEffort,
        approvalsReviewer: response.approvalsReviewer, instructionSources: response.instructionSources });
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
    report.modelTurnsReserved = reservations;
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
    report.modelTurnsReserved = reservations;
    report.stdoutBytes = stdoutBytes;
    report.stderrBytes = stderrBytes;
    report.elapsedMs = clock();
    fs.writeFileSync(path.join(resultDir, 'report.json'), JSON.stringify(report, null, 2) + '\n',
      { flag: 'wx', mode: 0o600 });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const currentHost = args[0] === '--current-host';
  if (currentHost) args.shift();
  if (args.length !== 4 || args[0] !== '--decision' || args[2] !== '--result') {
    throw new Error('Use [--current-host] --decision PRIVATE_DECISION --result FRESH_PRIVATE_DIRECTORY');
  }
  const candidateCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf8' });
  if (dirty.trim()) throw new Error('Reviewed task worktree must be clean');
  if (execFileSync(codex, ['--version'], { encoding: 'utf8' }).trim() !== 'codex-cli 0.156.1') {
    throw new Error('Pinned Codex installation is required');
  }
  if (!currentHost) assertLocalConfiguration();
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  try {
    const report = await runExperiment({ decisionFile: args[1], resultDir: args[3],
      mode: currentHost ? 'owner-approved-current-host' : 'default',
      candidateCommit, signal: controller.signal, processFactory: ({ cwd, argv }) =>
        spawn(codex, argv, { cwd, shell: false, stdio: ['pipe', 'pipe', 'pipe'] }) });
    // eslint-disable-next-line no-console -- CLI emits only the public-safe aggregate.
    console.log(JSON.stringify({ status: report.status, turns: report.turns.length, latencyClaim: 'none' }));
  } finally { process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // eslint-disable-next-line no-console -- CLI reports a bounded failure.
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
