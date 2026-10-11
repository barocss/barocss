import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
import {makeWorldFixture, FIXED_DT} from './fixture.mjs';
import {rawBodies, rawBodiesHex, angularCommandRawHex, negativeZeroPaths, framesRawHex} from './raw-codec.mjs';
import {runNativeControls} from './native-controls.mjs';
import {runReferenceControls} from './reference-controls.mjs';
import {qualifyReply} from './reference-reply.mjs';
import {ReferenceChild} from './reference-child.mjs';
import {ProofStorage, ProofFailure, LIMITS} from './proof-storage.mjs';
import {worldQuality} from './world-quality.mjs';
import {retainPrefix, writeCompositeReference} from './resume-source.mjs';

class NumericalFailure extends Error {
  constructor(failures, requestIndex) { super('independent numerical comparison failed'); this.failures = failures; this.requestIndex = requestIndex; }
}

function knownProducerError(module, value) {
  try {
    if (!(value instanceof module.PhysicsError)) return null;
    const fields = Object.getOwnPropertyDescriptors(value);
    if (fields.name?.value !== 'PhysicsError' || typeof fields.code?.value !== 'string' || typeof fields.message?.value !== 'string') return null;
    const messages = ['private hinge velocity archived pose is invalid', 'private hinge velocity result is invalid',
      'private hinge velocity linear data is invalid', 'private hinge velocity system is singular or unsafe',
      'private hinge velocity certificate is invalid', 'private hinge velocity World contact profile is unsupported',
      'private hinge velocity World diagnostics are invalid', 'private hinge velocity World result is invalid',
      'contact penetration exceeded limit', 'unsafe contact result', 'unsafe joint reaction',
      'hinge0 exceeded motor reaction limit', 'hinge1 exceeded motor reaction limit'];
    for (const id of ['pairA0', 'pairB0', 'pairA1', 'pairB1']) messages.push(...[
      ' exceeded angular movement limit', ' exceeded step displacement limit', ' position exceeded bounds',
      ' velocity exceeded bounds', ' angularVelocity exceeded bounds', ' orientation exceeded tolerance'].map(suffix => id + suffix));
    if (fields.code.value !== 'NUMERIC_LIMIT' || !messages.includes(fields.message.value)) return null;
    return {name: 'PhysicsError', code: fields.code.value, message: fields.message.value};
  } catch { return null; }
}

function guard(child) {
  if (child.firstFailure !== null) {
    const error = child.firstFailure; throw new ProofFailure(error.phase, error.code, error.message);
  }
  if (child.closed) throw new ProofFailure('reply', 'IPC_REPLY_MISSING', 'hinge World reference exited before its reply');
}

export async function runGraph(module, graph, directory, referencePath, sourceDirectory = null, resumePrefix = null) {
  const storage = new ProofStorage(directory, graph, sourceDirectory);
  if (resumePrefix !== null) retainPrefix(storage, resumePrefix);
  const logicalPrefix = resumePrefix === null ? {requestBytes: 0, replyBytes: 0, requests: 0} :
    {requestBytes: resumePrefix.initialInputBytes.length, replyBytes: resumePrefix.initialOutputBytes.length, requests: 1};
  const child = new ReferenceChild(storage, referencePath, 'python3', logicalPrefix);
  if (resumePrefix !== null) {
    child.lastRequest = {stream: 'reference.stdin.raw', offset: 0, bytes: logicalPrefix.requestBytes};
    child.lastReply = {stream: 'reference.stdout.raw', offset: 0, bytes: logicalPrefix.replyBytes, requestIndex: 1};
  }
  const counts = {mainConstructors: 0, mainSteps: 0, acceptedSteps: 0, qualifiedSteps: 0, mainReferenceRequests: 0,
    nativeControls: null, protocolControls: null};
  let firstFailure = null, disposition = 'UNMEASURED', nativeResult = null;
  const extrema = {maximumComDriftM: 0, maximumPlaneDriftM: 0, maximumAnchorGapM: 0, maximumAxisErrorRad: 0};
  const askReference = async (request, bucket = 'controls') => {
    guard(child); const reply = await child.ask(request, bucket); guard(child); return reply;
  };
  const record = async (value, raw = []) => {
    // Full safe native evidence remains durable before B asks the independent child.
    const data = {...value};
    if (Object.hasOwn(data, 'reference')) {
      data.reference = {rawReply: child.lastReply, decodedStatus: data.reference.referenceStatus,
        decodedQualified: data.reference.ok};
      data.zeroPaths = negativeZeroPaths(data);
    }
    storage.json('controls.records.jsonl', data, 'controls');
    for (const bytes of raw) storage.append('controls.bodies.raw', bytes, 'controls');
  };
  const createWorld = (config, options) => {
    guard(child);
    const world = module.createHingeVelocityWorldCandidate(config, options);
    return {...world, step(...args) { guard(child); return world.step(...args); }};
  };
  let world = null;
  try {
    nativeResult = await runNativeControls({createWorld, createOriginalWorld: module.createPhysicsWorld,
      PhysicsError: module.PhysicsError, resumePrefix, askReference: async request => {
        const reply = await askReference(request);
        const qualification = qualifyReply(reply, request);
        if (!qualification.qualified) throw new NumericalFailure(qualification.failures, child.completed);
        return reply;
      }, record});
    counts.nativeControls = {logical: nativeResult.counts, actual: nativeResult.actualCounts,
      historical: nativeResult.historicalCounts, recovery: nativeResult.recoveryCounts,
      combinedActual: nativeResult.combinedActualCounts};
    if (nativeResult.firstFailure !== null) firstFailure = nativeResult.firstFailure;
    if (nativeResult.firstFailure !== null || nativeResult.I0 === null || nativeResult.S0 === null)
      throw new NumericalFailure(['native control or required accepted checkpoint did not qualify'], child.completed);
    counts.protocolControls = await runReferenceControls({I0: nativeResult.I0, S0: nativeResult.S0,
      askReference, askRaw: text => child.askRaw(text, 'controls'), record});
    assert.equal(counts.protocolControls.complete, true);
    const config = makeWorldFixture(); let attempts = [];
    counts.mainConstructors++;
    world = createWorld(config, {observeAttempt: attempt => attempts.push(structuredClone(attempt))});
    const initial = world.getState();
    // This real fresh constructor equals the one independently observed I0; no duplicate initial solve.
    assert.deepEqual(initial, nativeResult.I0.sourceState);
    assert.equal(rawBodiesHex(initial.bodies), nativeResult.I0.sourceRawHex);
    assert.deepEqual(world.getTransactionSnapshot(), nativeResult.initialCheckpoint);
    storage.append('main.bodies.raw', rawBodies(initial.bodies), 'main');
    storage.json('main.records.jsonl', {type: 'initial', stepIndex: 0, timeSeconds: 0,
      qualifiedInitial: 'W0-initial', raw: {offset: 0, bytes: 416}}, 'main', LIMITS.receipt);
    for (let index = 0; index < 1200; index++) {
      guard(child); attempts = [];
      const source = world.getState(), before = world.getTransactionSnapshot();
      const commands = []; let output = null, error = null;
      counts.mainSteps++;
      try {
        const state = world.step(FIXED_DT, commands); counts.acceptedSteps++;
        output = {state, diagnostics: world.getDiagnostics()};
      }
      catch (value) {
        error = knownProducerError(module, value);
        if (error === null) throw new ProofFailure('producer', 'NATIVE_UNKNOWN_THROWN', 'hinge World producer threw an unknown value');
      }
      assert.equal(attempts.length, 1);
      const attempt = attempts[0], rawFrames = framesRawHex(attempt.frames);
      if (output === null) assert.deepEqual(world.getTransactionSnapshot(), before);
      const request = {op: 'world-step', config, sourceState: source, dt: FIXED_DT, commands,
        commandsRawHex: angularCommandRawHex(commands), outcome: output === null ? 'refused' : 'returned',
        attempt, output, error, rawFrames,
        negativeZeroPaths: {sourceState: negativeZeroPaths(source), commands: [],
          attempt: negativeZeroPaths(attempt), output: negativeZeroPaths(output)}};
      const raw = [];
      for (const [phase, hex] of Object.entries(rawFrames)) if (hex !== null)
        raw.push({phase, ...storage.append('main.bodies.raw', Buffer.from(hex, 'hex'), 'main')});
      // Actual reached native result is saved before independent evaluation can fail.
      const nativeLocator = storage.json('main.native.jsonl', {request, acceptedStoreBefore: before,
        acceptedStoreAfter: world.getTransactionSnapshot()}, 'main');
      counts.mainReferenceRequests++;
      const reply = await askReference(request, 'main');
      const qualification = qualifyReply(reply, request);
      let quality = null;
      if (output !== null && qualification.qualified) {
        counts.qualifiedSteps++; quality = worldQuality(output.state, output.diagnostics, reply);
        for (const key of Object.keys(extrema)) extrema[key] = Math.max(extrema[key], quality[key]);
      }
      const failures = [...qualification.failures, ...(quality?.failures ?? [])];
      const passed = output !== null && qualification.qualified && failures.length === 0;
      storage.json('main.records.jsonl', {type: 'step', attemptedStepIndex: source.stepIndex + 1,
        acceptedStepIndex: world.getState().stepIndex, nativeLocator, request: child.lastRequest,
        reply: child.lastReply, raw, passed, outcome: request.outcome,
        referenceDisposition: qualification.disposition, quality, error}, 'main', LIMITS.receipt);
      if (!passed) {
        firstFailure = {attemptedStepIndex: source.stepIndex + 1, acceptedStepIndex: world.getState().stepIndex,
          error, failures, referenceDisposition: qualification.disposition};
        disposition = qualification.qualified ? 'NUMERICAL_NO_GO_WORLD' : 'NUMERICAL_MISMATCH';
        break;
      }
    }
    if (firstFailure === null) disposition = counts.acceptedSteps === 1200 && counts.qualifiedSteps === 1200 ? 'HINGE2_WORLD_GO' : 'GRAPH_NO_COMPLETE_PROOF';
  } catch (error) {
    firstFailure ??= error instanceof NumericalFailure ? {classification: 'NUMERICAL_MISMATCH',
      failures: error.failures, requestIndex: error.requestIndex} : error instanceof ProofFailure ? error.safe() : {
      phase: 'producer', code: 'NATIVE_UNKNOWN_THROWN', message: 'hinge World producer threw an unknown value'};
    disposition = error instanceof NumericalFailure ? 'NUMERICAL_MISMATCH' : 'GRAPH_NO_COMPLETE_PROOF';
  } finally { world?.dispose(); }
  let receipt = null;
  const secondaryFailures = [];
  try { receipt = await child.close(disposition === 'GRAPH_NO_COMPLETE_PROOF'); }
  catch (error) {
    const failure = error instanceof ProofFailure ? error.safe() : {phase: 'close', code: 'IPC_CLOSE_RECEIPT_FAILED', message: 'hinge World reference close receipt could not be stored'};
    firstFailure ??= failure; secondaryFailures.push(failure); disposition = 'GRAPH_NO_COMPLETE_PROOF';
  }
  if (receipt !== null && (receipt.exitCode !== 0 || receipt.signal !== null || receipt.firstFailure !== null ||
    !receipt.stdout.completeEOF || !receipt.stderr.completeEOF)) {
    firstFailure ??= receipt.firstFailure; disposition = 'GRAPH_NO_COMPLETE_PROOF';
  }
  if (resumePrefix !== null && receipt !== null) {
    try { writeCompositeReference(directory, resumePrefix, receipt); }
    catch {
      const failure = {phase: 'proof', code: 'PROOF_PERSIST_FAILED', message: 'hinge World proof could not be stored'};
      firstFailure ??= failure; secondaryFailures.push(failure); disposition = 'GRAPH_NO_COMPLETE_PROOF';
    }
  }
  const finished = storage.finishAll(disposition !== 'GRAPH_NO_COMPLETE_PROOF');
  for (const failure of finished.failures) { firstFailure ??= failure; secondaryFailures.push(failure); disposition = 'GRAPH_NO_COMPLETE_PROOF'; }
  const result = {graph, disposition, counts, extrema, firstFailure, child: receipt,
    retainedHistoricalPrefix: resumePrefix === null ? null : {manifestSha256: resumePrefix.manifestSha256,
      historicalCounts: resumePrefix.historicalCounts, independentlyCompletedInitialRepliesReused: 1,
      currentChildReceiptExcludesPriorProcess: true},
    childCloseObserved: {pid: child.child.pid ?? null, exitCode: child.exitCode, signal: child.signal,
      closed: child.closed, stdoutClosed: child.stdoutClosed, stderrClosed: child.stderrClosed,
      stdinEnded: child.stdinEnded, completedReplies: child.completed,
      pendingRequestIndex: child.pending?.index ?? child.failedRequestIndex ?? null,
      firstFailure: child.firstFailure, secondaryFailures: child.secondaryFailures},
    secondaryFailures, storedBudgetBytes: storage.used, streams: finished.streams};
  // Runtime/graph provenance is intentionally outside canonical byte parity.
  writeFileSync(resolve(directory, 'result.json'), JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
  return result;
}
