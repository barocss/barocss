import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, realpathSync, writeFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import { build } from 'esbuild';

// CPU/thread evidence only. A controlled renderer cannot prove browser responsiveness or GL pixels.
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const repo = resolve(import.meta.dirname, '../../..');
const evidence = resolve(option('--evidence', resolve(repo, '.tmp/solid-split-worker')));
const native = args.includes('--native-child');
const guardPlan = args.includes('--guard-plan');
assert.ok(args.some(value => ['--cheap', '--native', '--native-child', '--guard-plan'].includes(value)), 'Choose --cheap or --native explicitly.');
mkdirSync(evidence, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const report = { mode: guardPlan ? 'guard-plan' : native ? 'native' : args.includes('--native') ? 'supervisor' : 'cheap', pid: process.pid, phases: [], outcome: 'running', actualGL: false, browserResponsiveness: false, physicalFileUI: false };
const save = () => writeFileSync(resolve(evidence, `${report.mode}.json`), JSON.stringify(report, null, 2) + '\n');
const phase = async (name, run) => {
  const entry = { name, outcome: 'running' }; report.phases.push(entry); save(); const start = performance.now();
  try { entry.result = await run(); entry.outcome = 'passed'; }
  catch (error) { entry.outcome = 'failed'; entry.error = { name: error.name, message: error.message, stack: error.stack }; throw error; }
  finally { entry.elapsedMS = performance.now() - start; save(); }
};
const delay = ms => new Promise(resolveDelay => setTimeout(resolveDelay, ms));
const editor = resolve(repo, 'packages/barocss-cad-editor/src');
const workerPath = resolve(evidence, native ? 'emitted-worker-instrumented.mjs' : 'cheap-worker.mjs');

if (args.includes('--native')) {
  // Exactly one child, no retry. The grace timer belongs to this supervisor, not its leader.
  assert.ok(args.includes('--worker'), '--worker must identify the final emitted dedicated-worker asset.');
  assert.equal(process.execPath, '/workspace/shared/barocss-toolchain/node_modules/node/bin/node', 'Use the pinned Node binary.');
  const fs = statfsSync(repo); assert.ok(fs.bavail * fs.bsize >= 500000000, 'At least 500 MB free disk is required.');
  const child = spawn(process.execPath, ['--max-old-space-size=2048', import.meta.filename, '--native-child', '--worker', resolve(option('--worker')), '--evidence', evidence], { cwd: repo, detached: true, stdio: 'inherit' });
  report.childPID = child.pid; report.deadlineMS = 180000; save();
  let expired = false, grace;
  const signal = name => { try { process.kill(-child.pid, name); } catch (error) { if (error.code !== 'ESRCH') throw error; } };
  const timeout = setTimeout(() => { expired = true; signal('SIGTERM'); grace = delay(3000).then(() => signal('SIGKILL')); }, 180000);
  const result = await new Promise((resolveExit, reject) => { child.once('error', reject); child.once('exit', (code, signalName) => resolveExit({ code, signal: signalName })); });
  clearTimeout(timeout); if (grace) await grace;
  report.outcome = expired ? 'incomplete-timeout' : result.code === 0 ? 'passed' : 'failed'; report.child = result; save();
  process.exitCode = report.outcome === 'passed' ? 0 : 1;
} else {
  const resources = new Set();
  try {
    if (native || guardPlan) await prepareNative(); else await prepareCheap();
    if (guardPlan) { verifyNativeGuards(); report.outcome = 'passed'; save(); process.exit(0); }
    const modulePath = resolve(evidence, 'main-consumer.mjs');
    await build({ absWorkingDir: repo, stdin: { contents: `export { createSplitWorkerClient } from ${JSON.stringify(editor + '/split-worker-client.ts')};\nexport { createSolidSplitWorkspace } from ${JSON.stringify(editor + '/split-workspace.ts')};\nexport { prepareEngineScene } from '@barocss/gpu';\nexport { validateSplitWorkerReply } from ${JSON.stringify(editor + '/split-worker-protocol.ts')};`, resolveDir: repo }, alias: { '@barocss/gpu': resolve(realpathSync(resolve(repo, 'node_modules/@barocss/gpu')), 'src/index.ts') }, bundle: true, platform: 'node', format: 'esm', target: 'es2022', outfile: modulePath });
    const mainSource = readFileSync(modulePath, 'utf8');
    assert.ok(!/function (?:parseTranslatedStripPlaneSplit|tessellateQualifiedTranslatedStripBody|serializeTranslatedStripPlaneSplit)\(/.test(mainSource), 'Main consumer must not bundle native execution.');
    report.mainConsumerSHA256 = hash(mainSource);
    const api = await import(pathToFileURL(modulePath));
    if (native) await nativeSmoke(api); else await cheapTests(api);
    report.outcome = 'passed';
  } catch (error) { report.outcome = 'failed'; report.error = { name: error.name, message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally { await Promise.all([...resources].map(resource => resource.terminate())); save(); }
  console.log(JSON.stringify({ outcome: report.outcome, mode: report.mode, evidence }));

  function thread() {
    const worker = new Worker(pathToFileURL(workerPath), { workerData: { mode: guardPlan ? 'guard-plan' : native ? 'native' : 'cheap' } }); resources.add(worker);
    worker.on('exit', () => resources.delete(worker));
    const replies = [], waiters = new Map(), metrics = [], events = [];
    worker.on('message', value => {
      if (value.testEvent) { events.push(value); return; }
      if (value.nativeCounts) { report.nativeCounts = value.nativeCounts; report.nestedSplitCounts = value.nestedSplitCounts; save(); return; }
      if (value.nativeTiming) { (report.nativeTimings ??= []).push(value.nativeTiming); save(); return; }
      if (value.workerPost) { (report.workerPosts ??= []).push(value.workerPost); save(); return; }
      if (value.type === 'ERROR') { report.lastWorkerError = value.error; save(); }
      replies.push(value); const waiter = waiters.get(value.requestId); if (waiter) { waiters.delete(value.requestId); waiter(value); }
    });
    let id = 0, epoch = 1, generation = 0, displayGeneration = 0;
    const request = async (body, override = {}) => {
      const message = { protocol: 'barocss-cad-editor-split-worker', version: 0, workspaceId: 'test-workspace', requestId: ++id, epoch, generation, displayGeneration, ...body, ...override };
      const start = performance.now();
      const pending = new Promise((resolveReply, reject) => {
        const timeout = setTimeout(() => { waiters.delete(message.requestId); reject(new Error(`No worker reply: ${body.type}`)); }, native ? 175000 : 5000);
        waiters.set(message.requestId, value => { clearTimeout(timeout); resolveReply(value); });
        const onError = error => { clearTimeout(timeout); waiters.delete(message.requestId); reject(error); };
        worker.once('error', onError);
        waiters.set(message.requestId, value => { clearTimeout(timeout); worker.off('error', onError); resolveReply(value); });
      });
      const sent = performance.now(); worker.postMessage(message); const senderPostMessageMS = performance.now() - sent;
      const reply = await pending;
      metrics.push({ type: body.type, senderPostMessageMS, roundTripMS: performance.now() - start, replyType: reply.type });
      return reply;
    };
    return { worker, request, replies, metrics, events, setState: summary => { generation = summary.generation; displayGeneration = summary.displayGeneration; }, nextEpoch: () => ++epoch, close: async () => { await worker.terminate(); } };
  }

  async function prepareCheap() {
    const source = `import { parentPort, isMainThread, threadId } from 'node:worker_threads';\nif (isMainThread) throw new Error('Fake native provider must run in worker');\nglobalThis.__testThreadId = threadId;\nimport { createSplitWorkerRuntime } from ${JSON.stringify(editor + '/split-worker-runtime.ts')};\n${fakeProvider.toString()}\nconst fake = fakeProvider(parentPort);\nconst runtime = createSplitWorkerRuntime({ ...fake, postMessage: reply => parentPort.postMessage(reply) });\nparentPort.on('message', message => { if (message.testCrash) throw new Error('controlled worker crash'); runtime.receive(message); });\nparentPort.postMessage({ testEvent: 'ready' });`;
    await build({ absWorkingDir: repo, stdin: { contents: source, resolveDir: repo }, alias: { '@barocss/gpu': resolve(realpathSync(resolve(repo, 'node_modules/@barocss/gpu')), 'src/index.ts') }, bundle: true, platform: 'node', format: 'esm', target: 'es2022', outfile: workerPath });
  }

  async function prepareNative() {
    const path = resolve(option('--worker')); const pristine = readFileSync(path, 'utf8');
    assert.ok(!/\bfrom\s*["']@barocss\//.test(pristine), 'Emitted worker must bundle its native closure.');
    const limits = { parseTranslatedStripPlaneSplit: 1, tessellateQualifiedTranslatedStripBody: 3, serializeTranslatedStripPlaneSplit: 3, editSourceSurfaceControlNetWide: 0, validateTranslatedStripPlaneSplit: 4, splitTranslatedStripBodyByPlane: 5 };
    let instrumented = pristine; const locations = [];
    for (const [name, limit] of Object.entries(limits)) {
      const pattern = new RegExp(`function ${name}\\([^)]*\\)\\s*\\{`, 'g');
      const matches = [...instrumented.matchAll(pattern)];
      assert.equal(matches.length, 1, `Exactly one emitted native declaration must match ${name}; no guess or fallback.`);
      locations.push({ name, offset: matches[0].index, line: instrumented.slice(0, matches[0].index).split('\n').length });
      instrumented = instrumented.replace(pattern, match => match.replace(name, `__guarded_original_${name}`));
      instrumented += `\nfunction ${name}(...args) { globalThis.__nativeGuard(${JSON.stringify(name)}, ${limit}); const started = performance.now(); try { return __guarded_original_${name}(...args); } finally { globalThis.__nativeLeave(${JSON.stringify(name)}); globalThis.__nativeTiming(${JSON.stringify(name)}, performance.now() - started); } }\n`;
    }
    report.worker = { path, pristineSHA256: hash(pristine), instrumentedSHA256: hash(instrumented), guards: limits, locations, guardsBeforeInvocation: true, nestedSplitPaths: { '["parseTranslatedStripPlaneSplit"]': 1, '["validateTranslatedStripPlaneSplit"]': 1, '["serializeTranslatedStripPlaneSplit","validateTranslatedStripPlaneSplit"]': 3 }, topLevelNewSplit: 0 }; save();
    const artifact = resolve(evidence, 'native-closure.mjs'); writeFileSync(artifact, instrumented);
    writeFileSync(workerPath, `import { parentPort } from 'node:worker_threads';
${createNativeGuard.toString()}
const guard = createNativeGuard();
globalThis.__nativeGuard = (name, limit) => { guard.enter(name, limit); parentPort.postMessage({ nativeCounts: guard.counts, nestedSplitCounts: guard.nested }); };
globalThis.__nativeLeave = name => guard.leave(name);
globalThis.__nativeTiming = (name, computeMS) => parentPort.postMessage({ nativeTiming: { name, computeMS } });
globalThis.self = globalThis;
globalThis.postMessage = value => {
  const bytes = new TextEncoder().encode(JSON.stringify(value)).length;
  const started = performance.now(); parentPort.postMessage(value);
  parentPort.postMessage({ workerPost: { requestId: value.requestId, bytes, senderPostMessageMS: performance.now() - started } });
};
globalThis.addEventListener = (type, listener) => { if (type === 'message') parentPort.on('message', data => listener({ data })); };
await import(${JSON.stringify(pathToFileURL(artifact).href)});
parentPort.on('message', data => globalThis.onmessage?.({ data }));
`);
  }

  async function cheapTests(api) {
    await phase('real-thread-isolation-cancel-drain-stale-and-duplicate-accept', async () => {
      const t = thread(); let ticks = 0;
      const timer = setInterval(() => ticks++, 5);
      try {
        const initialized = await t.request({ type: 'INIT', text: '{}', initialPresentation: 'original' });
        assert.equal(initialized.type, 'INIT_READY');
        assert.ok(t.events.find(event => event.testEvent === 'mesh').workerThreadId > 0);
        const before = ticks;
        const preparation = t.request({ type: 'PREPARE_APPLY' });
        await until(() => t.events.some(event => event.testEvent === 'prepare-start'));
        const targetEpoch = t.nextEpoch() - 1;
        const cancellation = t.request({ type: 'CANCEL', targetEpoch });
        const [cancelled, drained] = await Promise.all([preparation, cancellation]);
        assert.equal(cancelled.type, 'ERROR'); assert.equal(cancelled.cancelled, true);
        assert.equal(drained.type, 'ACK'); assert.equal(drained.cancelled, true);
        assert.equal(drained.summary.generation, 0); assert.ok(ticks - before >= 5, 'Parent timer must advance during worker synchronous compute.');
        assert.equal(t.events.filter(event => event.testEvent === 'mesh').length, 1, 'Cancelled candidate must not be meshed.');
        const staged = await t.request({ type: 'STAGE', cutY: '4' }); assert.equal(staged.summary.pending.cutY, '4');
        const discarded = await t.request({ type: 'DISCARD' }); assert.deepEqual(discarded.summary.pending, {});
        const candidate = await t.request({ type: 'PREPARE_APPLY' }); assert.equal(candidate.type, 'CANDIDATE');
        const stale = await t.request({ type: 'ACCEPT', token: 'stale-token', rendererAdmitted: true }); assert.equal(stale.type, 'ERROR'); assert.equal(stale.unchanged, true);
        api.prepareEngineScene(candidate.display.scene);
        const ack = await t.request({ type: 'ACCEPT', token: candidate.token, rendererAdmitted: true }); assert.equal(ack.type, 'ACK'); assert.equal(ack.summary.generation, 1);
        const duplicate = await t.request({ type: 'ACCEPT', token: candidate.token, rendererAdmitted: true }, { requestId: ack.requestId });
        assert.deepEqual(duplicate, ack); assert.equal(t.events.filter(event => event.testEvent === 'accepted').length, 1);
        t.setState(ack.summary);
        const oldEpoch = await t.request({ type: 'SERIALIZE' }, { epoch: 0 }); assert.equal(oldEpoch.type, 'ERROR');
        const download = await t.request({ type: 'SERIALIZE' }); assert.equal(download.type, 'SERIALIZED');
        const refused = await t.request({ type: 'MARK_DOWNLOADED', token: 'wrong-token' }); assert.equal(refused.type, 'ERROR');
        const marked = await t.request({ type: 'MARK_DOWNLOADED', token: download.download.token }); assert.equal(marked.summary.dirty, false); assert.equal(marked.summary.downloadStatus, 'Download started');
        await t.request({ type: 'DISPOSE' });
        assert.equal(t.events.filter(event => event.testEvent === 'disposed').length, 1);
        report.metrics = t.metrics;
        return { parentTicksDuringBlockedWorker: ticks - before, cancelledBeforeMesh: true, drainAcknowledged: true, oneCommitForDuplicateAccept: true, mainNativeCalls: 0 };
      } finally { clearInterval(timer); await t.close(); }
    });
    await phase('cancel-after-completed-init-noop-and-refusal', async () => {
      const t = thread();
      try {
        const initial = await t.request({ type: 'INIT', text: '{}', initialPresentation: 'original' }); assert.equal(initial.type, 'INIT_READY');
        const initialDrain = await t.request({ type: 'CANCEL', targetEpoch: 1 }); assert.equal(initialDrain.type, 'ACK'); assert.equal(initialDrain.cancelled, true);
        t.nextEpoch(); const candidate = await t.request({ type: 'PREPARE_APPLY' });
        const accepted = await t.request({ type: 'ACCEPT', token: candidate.token, rendererAdmitted: true }); t.setState(accepted.summary);
        const noopEpoch = t.nextEpoch(); const noop = await t.request({ type: 'PREPARE_APPLY' }); assert.equal(noop.type, 'ACK');
        const noopDrain = await t.request({ type: 'CANCEL', targetEpoch: noopEpoch }); assert.equal(noopDrain.type, 'ACK'); assert.equal(noopDrain.cancelled, true);
        const failureEpoch = t.nextEpoch(); await t.request({ type: 'STAGE', cutY: 'nonsense' });
        const failure = await t.request({ type: 'PREPARE_APPLY' }); assert.equal(failure.type, 'ERROR');
        const failedDrain = await t.request({ type: 'CANCEL', targetEpoch: failureEpoch }); assert.equal(failedDrain.type, 'ACK'); assert.equal(failedDrain.cancelled, true);
        assert.equal(failedDrain.summary.generation, 1); assert.equal(failedDrain.summary.pending.cutY, 'nonsense');
        return { initRaceDrained: true, noOpRaceDrained: true, refusalRaceDrained: true, draftRetained: true };
      } finally { await t.close(); }
    });
    await phase('client-worker-error-timeout-and-listener-cleanup', async () => {
      for (const failure of ['error', 'messageerror', 'timeout', 'dispose']) {
        const t = thread(), bridge = transport(t.worker);
        await until(() => t.events.some(event => event.testEvent === 'ready'));
        const client = api.createSplitWorkerClient({ createWorker: () => bridge, timeoutMS: failure === 'timeout' ? 25 : 3000 });
        let failed = 0; client.subscribeFailure(() => failed++);
        const init = await client.request({ type: 'INIT', text: '{}', initialPresentation: 'original' }, { epoch: 1, generation: 0, displayGeneration: 0 }); assert.equal(init.type, 'INIT_READY');
        if (failure === 'error') t.worker.postMessage({ testCrash: true });
        const pending = client.request({ type: 'PREPARE_APPLY' }, { epoch: 2, generation: 0, displayGeneration: 0 });
        const rejected = assert.rejects(pending);
        if (failure === 'messageerror') bridge.emit('messageerror', new Error('controlled decode failure'));
        else if (failure === 'dispose') client.dispose();
        await rejected; assert.equal(client.unavailable, true); assert.equal(failed, 1);
        client.dispose(); assert.equal(bridge.listenerCount(), 0); assert.equal(bridge.terminations, 1); await t.close();
      }
      return { workerError: true, messageError: true, timeout: true, disposeRejectsPending: true, listenersRemoved: true, terminateOnce: true };
    });
    await phase('client-malformed-reply-types-generations-and-late-order', async () => {
      for (const variant of ['type', 'generation', 'geometry', 'late']) {
        const t = thread(); const bridge = transport(t.worker, { receive(reply, deliver) {
          if (reply.type !== 'INIT_READY') return deliver();
          if (variant === 'late') { bridge.emit('message', { data: { ...reply, requestId: reply.requestId + 777 } }); deliver(); return; }
          const changed = structuredClone(reply);
          if (variant === 'type') { changed.type = 'ACK'; changed.cancelled = false; delete changed.display; }
          if (variant === 'generation') changed.summary.generation++;
          if (variant === 'geometry') changed.display.qualifications[0].geometryId = 'unrelated-geometry';
          bridge.emit('message', { data: changed });
        } });
        const client = api.createSplitWorkerClient({ createWorker: () => bridge, timeoutMS: 3000 });
        try {
          const operation = client.request({ type: 'INIT', text: '{}', initialPresentation: 'original' }, { epoch: 1, generation: 0, displayGeneration: 0 });
          if (variant === 'late') { assert.equal((await operation).type, 'INIT_READY'); assert.equal(client.unavailable, false); }
          else { await assert.rejects(operation); assert.equal(client.unavailable, true); }
        } finally { client.dispose(); await t.close(); }
        assert.equal(bridge.listenerCount(), 0);
      }
      return { wrongReplyTypeRejected: true, wrongGenerationRejected: true, badQualificationRejected: true, unrelatedLateReplyIgnored: true };
    });
    await workspaceTests(api);
  }

  async function until(test, ms = 3000) {
    const deadline = performance.now() + ms;
    while (!test()) { assert.ok(performance.now() < deadline, 'Timed out waiting for controlled thread event.'); await delay(2); }
  }
  function transport(worker, hooks = {}) {
    const listeners = new Map(); let terminations = 0;
    const emit = (type, event) => { for (const listener of listeners.get(type) ?? []) listener(event); };
    worker.on('message', data => { if (data.testEvent || data.nativeCounts) return; const deliver = () => emit('message', { data }); if (hooks.receive) hooks.receive(data, deliver); else deliver(); });
    worker.on('error', error => emit('error', error));
    return { postMessage(message) { hooks.send?.(message); worker.postMessage(message); },
      addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(listener); },
      removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
      terminate() { terminations++; worker.terminate(); }, get terminations() { return terminations; },
      listenerCount: () => [...listeners.values()].reduce((sum, set) => sum + set.size, 0), emit };
  }

  async function workspaceTests(api) {
    await phase('workspace-local-and-native-cancellation-drain', async () => {
      for (const where of ['paint', 'file-read', 'native']) {
        const t = thread(), sent = [], bridge = transport(t.worker, { send: command => sent.push(command.type) });
        const client = api.createSplitWorkerClient({ createWorker: () => bridge, timeoutMS: 3000 });
        let release, armed = false, waiting = false;
        const pause = () => new Promise(resolvePause => { waiting = true; release = resolvePause; });
        const workspace = api.createSolidSplitWorkspace('{}', {}, { createClient: () => client,
          yieldPaint: () => armed && where === 'paint' ? pause() : Promise.resolve(),
          mountRenderer: () => ({ update: () => ({ ok: true }), resize() {}, render() {}, dispose() {} }) });
        try {
          await workspace.mount({}, 800, 600); armed = true; const before = sent.length;
          const operation = where === 'file-read'
            ? workspace.open({ name: 'cancelled.json', size: 2, arrayBuffer: pause }, true) : workspace.apply();
          await until(() => where === 'native' ? t.events.some(event => event.testEvent === 'prepare-start') : waiting);
          workspace.cancelOperation();
          assert.equal(workspace.getSnapshot().cancelling, true); assert.equal(workspace.getSnapshot().busy, true);
          await assert.rejects(workspace.apply());
          if (where !== 'native') release(where === 'file-read' ? new TextEncoder().encode('{}').buffer : undefined);
          await operation;
          const state = workspace.getSnapshot(); assert.equal(state.session.generation, 0); assert.equal(state.busy, false); assert.equal(state.authorityAvailable, true);
          if (where !== 'native') assert.deepEqual(sent.slice(before), [], 'Local-only cancellation must not send CANCEL for nonexistent worker work.');
          else assert.deepEqual(sent.slice(before), ['PREPARE_APPLY', 'CANCEL']);
          armed = false; await workspace.apply(); assert.equal(workspace.getSnapshot().session.generation, 1);
        } finally { workspace.dispose(); await t.close(); }
      }
      return { localPaintCancelled: true, fileReadCancelled: true, noSpuriousWorkerCancel: true, nativeDrainBlocksNewWork: true };
    });
    await phase('workspace-renderer-refusal-rollback-and-ambiguous-accept', async () => {
      for (const failure of ['renderer', 'rollback', 'accept-loss']) {
        const t = thread(), sent = []; let releaseACK;
        const bridge = transport(t.worker, { send: command => sent.push(command.type), receive(reply, deliver) {
          if (failure === 'accept-loss' && reply.type === 'ACK' && reply.summary?.generation === 1) releaseACK = deliver; else deliver();
        } });
        const client = api.createSplitWorkerClient({ createWorker: () => bridge, timeoutMS: 3000 }); let updates = 0;
        const workspace = api.createSolidSplitWorkspace('{}', {}, { createClient: () => client, yieldPaint: () => Promise.resolve(),
          mountRenderer: () => ({ update() { updates++; return failure !== 'accept-loss' && (updates === 1 || failure === 'rollback') ? { ok: false, error: new Error('controlled renderer refusal') } : { ok: true }; }, resize() {}, render() {}, dispose() {} }) });
        try {
          await workspace.mount({}, 800, 600); const prior = workspace.getSnapshot().display;
          const operation = workspace.apply();
          if (failure === 'accept-loss') {
            await until(() => !!releaseACK); workspace.cancelOperation(); assert.equal(sent.filter(value => value === 'CANCEL').length, 0, 'ACCEPT is not cancellable.');
            bridge.emit('error', new Error('lost ACK after acceptance')); await operation;
            assert.equal(workspace.getSnapshot().authorityAvailable, false); assert.equal(workspace.getSnapshot().available, false);
            releaseACK(); assert.equal(workspace.getSnapshot().authorityAvailable, false); assert.equal(t.events.filter(event => event.testEvent === 'accepted').length, 1);
          } else {
            await operation; const state = workspace.getSnapshot();
            assert.equal(state.session.generation, 0); assert.equal(state.display, prior); assert.equal(state.available, failure === 'renderer');
            assert.equal(sent.filter(value => value === 'ACCEPT').length, 0); assert.equal(sent.filter(value => value === 'CANCEL').length, 1);
            assert.equal(t.events.filter(event => event.testEvent === 'cancelled').length, 1, 'Rollback failure must still drain the candidate.');
            assert.equal(state.authorityAvailable, true);
          }
        } finally { workspace.dispose(); await t.close(); }
      }
      return { rendererRefusalNeverAccepted: true, rollbackFailureStillDrained: true, missingACKUnavailable: true, lateACKInert: true, noCancelAfterAccept: true };
    });
    await phase('workspace-download-order-and-url-cleanup', async () => {
      const t = thread(), events = [], revoked = [], blobs = new Map();
      const bridge = transport(t.worker, { send: command => events.push(command.type) });
      const client = api.createSplitWorkerClient({ createWorker: () => bridge, timeoutMS: 3000 });
      const workspace = api.createSolidSplitWorkspace('{}', {}, { createClient: () => client, yieldPaint: () => Promise.resolve(),
        mountRenderer: () => ({ update: () => ({ ok: true }), resize() {}, render() {}, dispose() {} }) });
      const oldDocument = globalThis.document, oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
      URL.createObjectURL = blob => { const url = 'blob:controlled-worker-save'; blobs.set(url, blob); return url; };
      URL.revokeObjectURL = url => revoked.push(url);
      globalThis.document = { body: { append() {} }, createElement: () => ({ href: '', download: '', click() { events.push('anchor.click'); assert.ok(blobs.has(this.href)); }, remove() { events.push('anchor.remove'); } }) };
      try {
        await workspace.mount({}, 800, 600); await workspace.apply(); await workspace.download();
        assert.ok(events.indexOf('anchor.click') < events.indexOf('MARK_DOWNLOADED'));
        assert.equal(workspace.getSnapshot().session.downloadStatus, 'Download started'); assert.equal(workspace.getSnapshot().session.dirty, false);
        workspace.dispose(); await delay(5); assert.deepEqual(revoked, ['blob:controlled-worker-save']);
        assert.equal(bridge.listenerCount(), 0); assert.equal(bridge.terminations, 1);
        return { anchorBeforeMark: true, tokenAcknowledged: true, oneURLRevocation: true, cleanupTimerCancelled: true, physicalDownload: false };
      } finally { workspace.dispose(); await t.close(); globalThis.document = oldDocument; URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke; }
    });
    await phase('workspace-real-thread-display-before-ack-and-hide-retention', async () => {
      const t = thread(), events = []; let releaseACK;
      const bridge = transport(t.worker, {
        send(message) { events.push(message.type); },
        receive(reply, deliver) { if (reply.type === 'ACK' && reply.summary?.generation === 1 && !releaseACK) releaseACK = deliver; else deliver(); },
      });
      const client = api.createSplitWorkerClient({ createWorker: () => bridge, timeoutMS: 3000 });
      let disposed = 0;
      const workspace = api.createSolidSplitWorkspace('{}', {}, { createClient: () => client, yieldPaint: () => Promise.resolve(), mountRenderer: () => ({ update(scene) { api.prepareEngineScene(scene); events.push('renderer.update'); return { ok: true }; }, resize() {}, render() {}, dispose() { disposed++; } }) });
      try {
        await workspace.mount({}, 800, 600); assert.equal(workspace.getSnapshot().available, true);
        const apply = workspace.apply(); await until(() => !!releaseACK);
        assert.ok(events.indexOf('renderer.update') < events.indexOf('ACCEPT'));
        assert.equal(workspace.getSnapshot().session.generation, 0); assert.equal(workspace.getSnapshot().busy, true);
        workspace.unmount(); releaseACK(); await apply;
        assert.equal(workspace.getSnapshot().session.generation, 1); assert.equal(workspace.getSnapshot().available, false);
        await workspace.mount({}, 800, 600); assert.equal(workspace.getSnapshot().available, true); assert.equal(workspace.getSnapshot().session.generation, 1);
        assert.equal(events.filter(value => value === 'INIT').length, 1); assert.equal(t.events.filter(value => value.testEvent === 'accepted').length, 1);
        workspace.markUnavailable(new Error('controlled context loss')); assert.equal(workspace.getSnapshot().available, false); assert.throws(() => workspace.pick(0, 0));
        workspace.dispose(); workspace.dispose(); assert.equal(bridge.terminations, 1); assert.equal(bridge.listenerCount(), 0); assert.equal(disposed, 2);
        return { rendererBeforeAccept: true, lockedUntilACK: true, hiddenACKRetained: true, remountNoNativeInitialization: true, contextLossUnavailable: true, cleanDispose: true };
      } finally { workspace.dispose(); await t.close(); }
    });
  }

  async function nativeSmoke(api) {
    const t = thread();
    try {
      await phase('emitted-original-split-admit-save-dispose', async () => {
        const bytes = readFileSync(resolve(repo, 'apps/cad-editor/src/fixtures/solid-split-main.authored.json'));
        assert.equal(bytes.length, 8240); assert.equal(hash(bytes), 'b558f2f4bb29d97080032e74c1839e75558c3a04bd28c8966ecad5d5b0910a56');
        const validateReply = reply => { const start = performance.now(); api.validateSplitWorkerReply(reply); (report.mainReplyValidation ??= []).push({ type: reply.type, ingestionMS: performance.now() - start }); };
        const initial = await t.request({ type: 'INIT', text: bytes.toString('utf8'), initialPresentation: 'original' }); assert.equal(initial.type, 'INIT_READY'); validateReply(initial);
        // The controlled renderer admits the actual GPU CPU scene; no GL claim follows.
        const rendererEvents = [];
        const renderer = { update(scene) { const start = performance.now(); const prepared = api.prepareEngineScene(scene); rendererEvents.push({ type: 'renderer.update', draws: prepared.draws.length, rendererAdmissionMS: performance.now() - start }); return { ok: true, prepared }; }, dispose() { rendererEvents.push({ type: 'renderer.dispose' }); } };
        const initialPrepared = renderer.update(initial.display.scene).prepared; assert.equal(initialPrepared.draws.length, 6);
        const candidate = await t.request({ type: 'PREPARE_APPLY' }); assert.equal(candidate.type, 'CANDIDATE'); validateReply(candidate);
        const ingestionStart = performance.now();
        const admitted = renderer.update(candidate.display.scene); assert.equal(admitted.ok, true);
        const prepared = admitted.prepared; report.rendererAdmissionMS = performance.now() - ingestionStart; assert.equal(prepared.draws.length, 12);
        rendererEvents.push({ type: 'ACCEPT.sent' });
        const ack = await t.request({ type: 'ACCEPT', token: candidate.token, rendererAdmitted: true }); assert.equal(ack.type, 'ACK'); t.setState(ack.summary);
        const serialized = await t.request({ type: 'SERIALIZE' }); assert.equal(serialized.type, 'SERIALIZED');
        const text = serialized.download.text; assert.ok(text.length > 0); JSON.parse(text);
        writeFileSync(resolve(evidence, 'saved.authored.json'), text);
        await t.request({ type: 'MARK_DOWNLOADED', token: serialized.download.token });
        await t.request({ type: 'DISPOSE' });
        renderer.dispose(); report.rendererEvents = rendererEvents; report.metrics = t.metrics;
        report.nativeSessionSourceSHA256 = hash(readFileSync(resolve(editor, 'split-session.ts')));
        assert.deepEqual(report.nativeCounts, { parseTranslatedStripPlaneSplit: 1, serializeTranslatedStripPlaneSplit: 3, tessellateQualifiedTranslatedStripBody: 3, validateTranslatedStripPlaneSplit: 4, splitTranslatedStripBodyByPlane: 5 });
        return { originalDraws: 6, splitDraws: 12, canonicalSaveSHA256: hash(text), admittedBeforeAccept: true, controlledRenderer: true };
      });
    } finally { await t.close(); }
  }
}

function fakeProvider(port) {
  const counters = { prepare: 0, mesh: 0, accept: 0, dispose: 0 };
  const publish = name => port.postMessage({ testEvent: name, workerThreadId: globalThis.__testThreadId, counters: { ...counters } });
  let serial = 0;
  return {
    createSession() {
      const state = { accepted: { request: { cutAsset: { surface: { controlPoints: [[[0, 3, 0]]] } } } }, presentation: { kind: 'original', body: {} }, generation: 0, displayGeneration: 0, pending: {}, candidate: null, history: { index: 0, count: 1, bytesUTF8: 2, bytesUTF16: 4, canUndo: false, canRedo: false }, dirty: true, downloadStatus: 'Not downloaded', disposed: false };
      let download;
      const prepare = kind => {
        counters.prepare++; publish('prepare-start');
        // Synchronous fake native work in the dedicated thread, never the parent event loop.
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
        const candidate = { token: `fake-${++serial}`, kind, baseGeneration: state.generation, baseDisplayGeneration: state.displayGeneration, result: state.accepted, presentation: { kind: 'split', result: state.accepted } };
        state.candidate = candidate; publish('prepare-end'); return structuredClone(candidate);
      };
      const session = { getSnapshot: () => structuredClone(state), subscribe: () => () => {}, stageCutYField(raw) { state.pending = raw ? { cutY: raw } : {}; state.candidate = null; return session.getSnapshot(); }, discardPending() { state.pending = {}; state.candidate = null; return session.getSnapshot(); },
        prepareApply: () => { if (state.pending.cutY === 'nonsense') throw Object.assign(new Error('Invalid raw draft'), { code: 'INPUT' }); return state.presentation.kind === 'split' && !state.pending.cutY ? null : prepare('apply'); }, prepareOpen: () => prepare('open'), prepareUndo: () => prepare('undo'), prepareRedo: () => prepare('redo'),
        acceptCandidate(token) { if (state.candidate?.token !== token) throw new Error('stale token'); counters.accept++; state.presentation = state.candidate.presentation; state.generation++; state.displayGeneration++; state.candidate = null; state.pending = {}; state.history.count++; state.history.index++; state.history.canUndo = true; publish('accepted'); return session.getSnapshot(); },
        cancelCandidate(token) { if (state.candidate?.token !== token) throw new Error('stale cancel'); state.candidate = null; publish('cancelled'); },
        serializeAccepted() { download = { token: `download-${serial}`, text: '{}', suggestedFilename: 'fake.json' }; return download; },
        markDownloaded(token) { if (download?.token !== token) throw new Error('stale download'); state.dirty = false; state.downloadStatus = 'Download started'; },
        dispose() { state.disposed = true; counters.dispose++; publish('disposed'); } };
      return session;
    },
    prepareScene(presentation) {
      counters.mesh++; publish('mesh');
      const scene = { format: 'barocss-gpu-engine-scene', version: 0, id: 'solid_split_scene', coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', background: [0, 0, 0], camera: { eye: [0, 0, 5], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 50, near: .1, far: 20 }, geometries: [{ format: 'barocss-gpu-triangle-geometry', version: 0, id: 'geometry', coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', winding: 'ccw', positions: [-1, -1, 0, 1, -1, 0, 0, 1, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1], uvs: [0, 0, 0, 0, 0, 0], indices: [0, 1, 2] }], materials: [{ id: 'solid_split_material', type: 'unlit', colorSpace: 'linear', color: [.3, .5, .7] }], nodes: [{ id: 'node', type: 'mesh', parentId: null, geometryId: 'geometry', materialId: 'solid_split_material', translation: [0, 0, 0], rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1], visible: true }] };
      const face = { componentId: presentation.kind, bodyId: 'body', groupNodeId: 'group', nodeId: 'node', geometryId: 'geometry', faceId: 'face', role: 'lower', orientation: 'forward', supportRef: { sourceModelId: 'source', objectId: 'surface' }, authorityIndices: [0, 1, 2], faceSampleIndices: [0, 1, 2], triangleIndices: [0], parametersUV: [0, 0, 1, 0, 0, 1], quantizationGapsMM: [0, 0, 0] };
      const geometry = scene.geometries[0], node = scene.nodes[0];
      scene.geometries = []; scene.nodes = []; const bodies = [], qualifications = [];
      for (let component = 0; component < (presentation.kind === 'original' ? 1 : 2); component++) {
        const componentId = presentation.kind === 'original' ? 'original' : `split_${component}`, groupNodeId = `solid_${componentId}_group`, faces = [];
        scene.nodes.push({ id: groupNodeId, type: 'group', parentId: null, translation: [0, 0, 0], rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1], visible: true });
        for (let index = 0; index < 6; index++) {
          const geometryId = `solid_${componentId}_geometry_${index}`, nodeId = `solid_${componentId}_node_${index}`;
          scene.geometries.push({ ...geometry, id: geometryId }); scene.nodes.push({ ...node, id: nodeId, geometryId, parentId: groupNodeId });
          faces.push({ ...face, componentId, groupNodeId, nodeId, geometryId, faceId: `face${index}`, role: ['lower', 'upper', 'cap', 'base', 'uMin', 'uMax'][index] });
        }
        bodies.push({ componentId, bodyId: 'body', groupNodeId, bounds: { min: [-1, -1, 0], max: [1, 1, 0] }, faces }); qualifications.push(...faces);
      }
      return { authority: {}, meshes: [], scene, presentationKind: presentation.kind, bodies, qualifications, basis: 'x,z,-y', textureUV: 'derived-zero' };
    },
  };
}


function createNativeGuard() {
  const counts = {}, nested = {}, stack = [];
  const permitted = { '["parseTranslatedStripPlaneSplit"]': 1, '["validateTranslatedStripPlaneSplit"]': 1,
    '["serializeTranslatedStripPlaneSplit","validateTranslatedStripPlaneSplit"]': 3 };
  return { counts, nested,
    enter(name, limit) {
      const ancestry = JSON.stringify(stack);
      if ((counts[name] ?? 0) >= limit) throw new Error('Native call refused BEFORE invocation: ' + name);
      if (name === 'splitTranslatedStripBodyByPlane') {
        if (!Object.hasOwn(permitted, ancestry) || (nested[ancestry] ?? 0) >= permitted[ancestry])
          throw new Error('New or unexpected nested Split refused BEFORE invocation: ' + ancestry);
        nested[ancestry] = (nested[ancestry] ?? 0) + 1;
      } else if (name === 'validateTranslatedStripPlaneSplit') {
        if (ancestry !== '[]' && ancestry !== '["serializeTranslatedStripPlaneSplit"]')
          throw new Error('Unexpected validator ancestry refused BEFORE invocation: ' + ancestry);
      } else if (stack.length) throw new Error('Unexpected native ancestry refused BEFORE invocation: ' + ancestry);
      counts[name] = (counts[name] ?? 0) + 1; stack.push(name);
    },
    leave(name) { if (stack.pop() !== name) throw new Error('Native guard stack mismatch.'); },
  };
}
function verifyNativeGuards() {
  const g = createNativeGuard();
  assert.throws(() => g.enter('splitTranslatedStripBodyByPlane', 5), /BEFORE invocation/);
  assert.throws(() => g.enter('editSourceSurfaceControlNetWide', 0), /BEFORE invocation/);
  const nested = (parent, action) => { g.enter(parent, parent === 'parseTranslatedStripPlaneSplit' ? 1 : parent === 'validateTranslatedStripPlaneSplit' ? 4 : 3); action(); g.leave(parent); };
  const split = () => { g.enter('splitTranslatedStripBodyByPlane', 5); g.leave('splitTranslatedStripBodyByPlane'); };
  nested('parseTranslatedStripPlaneSplit', split);
  nested('validateTranslatedStripPlaneSplit', split);
  for (let i = 0; i < 3; i++) nested('serializeTranslatedStripPlaneSplit', () => nested('validateTranslatedStripPlaneSplit', split));
  assert.equal(g.counts.splitTranslatedStripBodyByPlane, 5); assert.equal(g.counts.validateTranslatedStripPlaneSplit, 4);
  assert.throws(() => g.enter('splitTranslatedStripBodyByPlane', 5), /BEFORE invocation/);
  report.guardSelfTest = { passed: true, nativeInvocations: 0, expectedAncestryLimits: g.nested };
}
