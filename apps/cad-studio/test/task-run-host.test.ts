import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { askBatch } from '@barocss/cad-model/chat/questions';
import { readStudioFile } from '@barocss/cad-model/engine/container';
import { withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { readInterfaces } from '@barocss/cad-model/team/interfaces';
import { userToken } from '@barocss/cad-model/team/ecr';
import { fixtureDoc, fixturePlan, fixtureLimits } from './task-run-fixture';
import { serveTaskThread, threadWorker, type ThreadFinish, type ThreadStart } from '../server/taskRun/thread';
import { LocalRunRequestError, readLocalTaskCandidate, readLocalTaskCheckpoint, readLocalTaskRunStatus } from '../server/taskRun/localService';
import { isTaskRunStatus, retiresTaskRunReview } from '../src/chat/taskRunOffer';
import { readTaskCheckpoint } from '../src/files/taskCheckpoint';
import { decodeCandidateReview } from '../src/files/taskCandidateReview';
import { TaskRunHost, type AnswerRequest, type DecisionRequest, type TaskWorker, type WorkerTicket } from '../server/taskRun/host';

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const trusted = () => userToken('2026-11-11T00:00:00Z');
function signal() {
  let send!: () => void;
  const receive = new Promise<void>(resolve => { send = resolve; });
  return { send, receive };
}
function reply(ticket: WorkerTicket, heightMm: number, usage = 1) {
  const { runId, task, attempt } = ticket;
  return {
    runId, attemptId: attempt.id, operationId: attempt.operationId, epoch: attempt.epoch, usage,
    submission: { taskId: task.id, specRevision: attempt.specRevision, inputDigest: attempt.inputDigest, heightMm },
  };
}
function barrier(height: number) {
  const started = signal(), finish = signal();
  const worker: TaskWorker = async ticket => { started.send(); await finish.receive; return reply(ticket, height); };
  return { worker, started: started.receive, release: finish.send };
}
function decision(host: TaskRunHost, taskId: string, operationId: string): DecisionRequest {
  const snapshot = host.snapshot, task = snapshot.state.tasks.find(row => row.id === taskId)!;
  assert.ok(task.candidate && task.attempt);
  return {
    operationId, runId: snapshot.runId, taskId, epoch: snapshot.epoch, attemptId: task.attempt.id,
    specRevision: task.candidate.specRevision, candidateDigest: task.candidate.candidateDigest, approved: true,
  };
}
async function facts(host: TaskRunHost) {
  const read = await readStudioFile(host.acceptedBytes);
  assert.ok(!('error' in read));
  const parts = [];
  for (const instance of read.doc.instances!) {
    const native = await evaluate(instance.doc);
    assert.ok(native.ok);
    parts.push({ id: instance.id, height: native.bodies[0].mesh.bounds.max[2], volume: Math.round(native.bodies[0].volume!) });
  }
  return parts;
}
async function withRun(fn: (host: TaskRunHost, dir: string) => Promise<void>, budget = 8, source = fixtureDoc(), limits = fixtureLimits) {
  const dir = mkdtempSync(join(tmpdir(), 'barocss-run-host-'));
  try {
    const host = await TaskRunHost.create(dir, 'housing', source, fixturePlan, limits, budget, evaluate);
    try { await fn(host, dir); } finally { host.close(); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

if (!(await serveTaskThread(evaluate))) {
  test('D620 local candidate reads require an owned run, an exact baseline and the current attempt', async () => {
    const root = mkdtempSync(join(tmpdir(), 'barocss-run-review-')), key = 'a'.repeat(64), dir = join(root, key);
    try {
      const host = await TaskRunHost.create(dir, 'housing', fixtureDoc(), fixturePlan, fixtureLimits, 8, evaluate);
      try {
        assert.equal((await host.dispatch('review-base', 'base', async ticket => reply(ticket, 6))).phase, 'completed');
        assert.equal((await host.dispatch('review-lid', 'lid', async ticket => reply(ticket, 4))).phase, 'completed');
        const request = { runKey: key, runId: host.snapshot.runId, taskId: 'base', attemptId: host.snapshot.state.tasks[0].attempt!.id,
          candidateDigest: host.snapshot.state.tasks[0].candidate!.candidateDigest, baselineDigest: host.snapshot.accepted.modelDigest };
        const accepted = host.snapshot.accepted, before = readFileSync(join(dir, 'run.json')), entries = readdirSync(dir).sort();
        const receipt = decodeCandidateReview(readLocalTaskCandidate(root, request));
        assert.ok(!('error' in receipt));
        assert.deepEqual([receipt.runId, receipt.submission.taskId, receipt.attemptId, receipt.candidateDigest, receipt.baseline],
          [request.runId, request.taskId, request.attemptId, request.candidateDigest, accepted]);
        const fail = (patch: Record<string, unknown>, status: number, reason: RegExp) =>
          assert.throws(() => readLocalTaskCandidate(root, { ...request, ...patch }),
            (error: unknown) => error instanceof LocalRunRequestError && error.status === status && reason.test(error.message));
        fail({ runKey: '../outside' }, 400, /expected the local run/i);
        fail({ directory: dir }, 400, /expected the local run/i);
        fail({ runKey: 'b'.repeat(64) }, 404, /could not be found/);
        fail({ runId: 'different-run' }, 409, /local run changed/);
        fail({ taskId: 'lid' }, 409, /candidate changed/);
        fail({ attemptId: 'different-attempt' }, 409, /candidate changed/);
        fail({ candidateDigest: 'b'.repeat(64) }, 409, /candidate changed/);
        fail({ baselineDigest: 'b'.repeat(64) }, 409, /exact native baseline/);
        symlinkSync(dir, join(root, 'c'.repeat(64)));
        fail({ runKey: 'c'.repeat(64) }, 409, /private and owned/);
        assert.deepEqual(readFileSync(join(dir, 'run.json')), before);
        assert.deepEqual(readdirSync(dir).sort(), entries);
        const rejected = { ...decision(host, 'base', 'terminal-reject'), approved: false };
        assert.equal((await host.decide(rejected, trusted())).code, 'RUN_REJECTED');
        fail({}, 409, /no longer awaiting review/);
        assert.deepEqual(host.snapshot.accepted, accepted);
        assert.deepEqual(host.snapshot.commits, []);
      } finally { host.close(); }
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test('D621 owned status reads project one revision and retire only matching current candidate reviews', async () => {
    const root = mkdtempSync(join(tmpdir(), 'barocss-run-status-')), key = 'a'.repeat(64), dir = join(root, key);
    try {
      const host = await TaskRunHost.create(dir, 'housing', fixtureDoc(), fixturePlan, fixtureLimits, 8, evaluate);
      try {
        await host.dispatch('status-base', 'base', async ticket => reply(ticket, 6));
        await host.dispatch('status-lid', 'lid', async ticket => reply(ticket, 4));
        const locator = { runKey: key, runId: host.snapshot.runId };
        const files = () => [readFileSync(join(dir, 'run.json')), readdirSync(dir).sort()];
        const before = files(), initial = readLocalTaskRunStatus(root, locator);
        assert.ok(isTaskRunStatus(initial));
        assert.equal(initial.revision, host.snapshot.revision);
        assert.equal(initial.baselineDigest, host.snapshot.accepted.modelDigest);
        assert.deepEqual(initial.tasks.map(task => [task.phase, task.review?.attemptId]), host.snapshot.state.tasks.map(task => [task.phase, task.attempt?.id]));
        const pin = initial.tasks[1].review!;
        const candidate = { ...locator, taskId: 'lid', ...pin, baselineDigest: initial.baselineDigest };
        assert.ok(!retiresTaskRunReview(initial, candidate, initial.revision));
        assert.ok(!isTaskRunStatus({ ...initial, tasks: [{ ...initial.tasks[0], phase: 'invented', review: undefined }, initial.tasks[1]] }));
        assert.ok(!isTaskRunStatus({ ...initial, tasks: [initial.tasks[0], initial.tasks[0]] }));
        const refuse = (patch: Record<string, unknown>, code: number) =>
          assert.throws(() => readLocalTaskRunStatus(root, { ...locator, ...patch }),
            (error: unknown) => error instanceof LocalRunRequestError && error.status === code);
        refuse({ path: dir }, 400);
        refuse({ runKey: '../' }, 400);
        refuse({ runId: 'another-run' }, 409);
        refuse({ runKey: 'b'.repeat(64) }, 404);
        symlinkSync(dir, join(root, 'c'.repeat(64)));
        refuse({ runKey: 'c'.repeat(64) }, 409);
        assert.deepEqual(files(), before);

        assert.equal((await host.decide(decision(host, 'base', 'status-approve-base'), trusted())).code, 'RUN_ACCEPTED');
        const approved = readLocalTaskRunStatus(root, locator);
        assert.ok(approved.revision > initial.revision);
        assert.deepEqual(approved.tasks.map(task => [task.phase, task.review]), [['completed', undefined], ['stale', undefined]]);
        assert.ok(retiresTaskRunReview(approved, candidate, initial.revision));
        assert.ok(!retiresTaskRunReview(approved, candidate, approved.revision + 1));
        assert.ok(!retiresTaskRunReview({ ...approved, runId: 'another-run' }, candidate, initial.revision));
        assert.equal((await host.refresh('status-rebuild-lid', 'lid')).phase, 'completed');
        const beforeRead = files(), rebuilt = readLocalTaskRunStatus(root, locator);
        assert.ok(rebuilt.revision > approved.revision);
        assert.equal(rebuilt.baselineDigest, approved.baselineDigest);
        assert.notEqual(rebuilt.tasks[1].review?.attemptId, pin.attemptId);
        assert.notEqual(rebuilt.tasks[1].review?.candidateDigest, pin.candidateDigest);
        assert.deepEqual(files(), beforeRead);
      } finally { host.close(); }
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test('D622 local checkpoint bytes bind the latest terminal approval without changing the owned run', async () => {
    const root = mkdtempSync(join(tmpdir(), 'barocss-checkpoint-read-')), key = 'a'.repeat(64), dir = join(root, key);
    try {
      const host = await TaskRunHost.create(dir, 'housing', fixtureDoc(), fixturePlan, fixtureLimits, 8, evaluate);
      try {
        await host.dispatch('checkpoint-base', 'base', async ticket => reply(ticket, 6));
        await host.dispatch('checkpoint-lid', 'lid', async ticket => reply(ticket, 4));
        const locator = { runKey: key, runId: host.snapshot.runId };
        assert.equal(readLocalTaskRunStatus(root, locator).checkpoint, undefined);
        assert.equal((await host.decide(decision(host, 'base', 'checkpoint-approve-base'), trusted())).code, 'RUN_ACCEPTED');
        const status = readLocalTaskRunStatus(root, locator);
        assert.ok(status.checkpoint);
        assert.ok(isTaskRunStatus(status));
        const request = { ...locator, ...status.checkpoint };
        const files = () => [readFileSync(join(dir, 'run.json')), readdirSync(dir).sort()];
        const before = files();
        const bundle = await readTaskCheckpoint(readLocalTaskCheckpoint(root, request));
        assert.ok(bundle && !('error' in bundle));
        assert.equal(bundle.receipt.runId, locator.runId);
        assert.equal(bundle.receipt.operationId, status.checkpoint.operationId);
        assert.equal(bundle.receipt.accepted.sha256, status.checkpoint.acceptedSHA256);
        assert.deepEqual(bundle.doc.instances?.map(part => part.doc.nodes[1].kind === 'extrude' ? part.doc.nodes[1].height : null), [6, 3]);
        const fail = (patch: Record<string, unknown>, code: number) =>
          assert.throws(() => readLocalTaskCheckpoint(root, { ...request, ...patch }),
            (error: unknown) => error instanceof LocalRunRequestError && error.status === code);
        fail({ runId: 'another-run' }, 409);
        fail({ taskId: 'lid' }, 409);
        fail({ operationId: 'another-operation' }, 409);
        fail({ acceptedSHA256: 'b'.repeat(64) }, 409);
        fail({ path: dir }, 400);
        fail({ runKey: '../' }, 400);
        fail({ runKey: 'b'.repeat(64) }, 404);
        symlinkSync(dir, join(root, 'c'.repeat(64)));
        fail({ runKey: 'c'.repeat(64) }, 409);
        assert.deepEqual(files(), before);
        assert.equal((await host.refresh('checkpoint-rebuild-lid', 'lid')).phase, 'completed');
        assert.equal((await host.decide(decision(host, 'lid', 'checkpoint-approve-lid'), trusted())).code, 'RUN_ACCEPTED');
        fail({}, 409);
        const final = readLocalTaskRunStatus(root, locator);
        assert.ok(final.checkpoint);
        const finalBefore = files(), finalBundle = await readTaskCheckpoint(readLocalTaskCheckpoint(root, { ...locator, ...final.checkpoint }));
        assert.ok(finalBundle && !('error' in finalBundle));
        assert.deepEqual(finalBundle.doc.instances?.map(part => part.doc.nodes[1].kind === 'extrude' ? part.doc.nodes[1].height : null), [6, 4]);
        assert.deepEqual(files(), finalBefore);
      } finally { host.close(); }
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test('D586 two reservations overlap and one writer rebuilds the other candidate on the latest accepted document', async () => withRun(async host => {
    const a = barrier(6), b = barrier(4), baseline = host.snapshot.accepted;
    const base = host.dispatch('worker-base', 'base', a.worker), lid = host.dispatch('worker-lid', 'lid', b.worker);
    try {
      await Promise.race([Promise.all([a.started, b.started]), Promise.race([base, lid]).then(() => assert.fail('Both workers must enter before either completes.'))]);
      assert.deepEqual(host.snapshot.state.tasks.map(task => task.phase), ['running', 'running']);
      assert.deepEqual(host.snapshot.accepted, baseline);
      assert.equal((await host.dispatch('worker-base', 'base', a.worker)).phase, 'reserved');
      assert.equal((await host.dispatch('worker-base', 'lid', b.worker)).code, 'RUN_OPERATION_CONFLICT');
      assert.equal(host.control('pause', 'pause', trusted()).phase, 'completed');
      a.release(); b.release();
      assert.deepEqual((await Promise.all([base, lid])).map(out => out.phase), ['completed', 'completed']);
      assert.deepEqual(host.snapshot.state.tasks.map(task => task.phase), ['awaiting-decision', 'awaiting-decision']);
      assert.equal((await host.decide(decision(host, 'base', 'during-pause'), trusted())).code, 'RUN_COMMIT_HELD');
      assert.deepEqual(host.snapshot.accepted, baseline);
      assert.equal(host.control('resume', 'resume', trusted()).phase, 'completed');
      const baseApproval = decision(host, 'base', 'approve-base'), oldLid = decision(host, 'lid', 'old-lid');
      assert.equal((await host.decide(baseApproval, trusted())).code, 'RUN_ACCEPTED');
      assert.equal((await host.decide(oldLid, trusted())).code, 'RUN_DECISION_STALE');
      assert.equal((await host.refresh('rebuild-lid', 'lid')).phase, 'completed');
      const latestLid = decision(host, 'lid', 'approve-lid');
      assert.notEqual(latestLid.specRevision, oldLid.specRevision);
      assert.notEqual(latestLid.attemptId, oldLid.attemptId);
      assert.equal((await host.decide(latestLid, trusted())).code, 'RUN_ACCEPTED');
      assert.equal((await host.decide(baseApproval, trusted())).duplicate, true);
      assert.deepEqual(host.snapshot.commits.map(commit => commit.taskId), ['base', 'lid']);
      assert.deepEqual(host.snapshot.state.budget, { limit: 8, used: 2, unknown: 0 });
      assert.deepEqual(await facts(host), [{ id: 'p1', height: 6, volume: 1200 }, { id: 'p2', height: 4, volume: 384 }]);
    } finally {
      a.release(); b.release();
      await Promise.allSettled([base, lid]);
    }
  }));

  test('D586 a reserved budget blocks the other task and Stop discards a late reply', async () => withRun(async host => {
    const a = barrier(6), baseline = host.snapshot.accepted, base = host.dispatch('worker-base', 'base', a.worker);
    try {
      await a.started;
      assert.equal((await host.dispatch('worker-lid', 'lid', async () => assert.fail('No budget for the second worker.'))).code, 'RUN_BUDGET');
      assert.equal(host.control('stop', 'stop', trusted()).phase, 'completed');
      a.release();
      assert.equal((await base).code, 'RUN_LATE_RESULT');
      assert.deepEqual(host.snapshot.accepted, baseline);
      assert.deepEqual(host.snapshot.state.budget, { limit: 2, used: 0, unknown: 2 });
    } finally {
      a.release();
      await Promise.allSettled([base]);
    }
  }, 2));

  test('D586 a held candidate stays held after reopening and requires a decision for the new epoch', async () => withRun(async (host, dir) => {
    const baseline = host.snapshot.accepted;
    assert.equal((await host.dispatch('worker-base', 'base', async ticket => reply(ticket, 6))).phase, 'completed');
    const old = decision(host, 'base', 'old-decision');
    host.close();
    const restarted = await TaskRunHost.open(dir, evaluate);
    try {
      assert.equal(restarted.snapshot.state.tasks[0].phase, 'awaiting-decision');
      assert.deepEqual(restarted.snapshot.accepted, baseline);
      assert.equal((await restarted.decide(old, trusted())).code, 'RUN_DECISION_STALE');
      assert.equal((await restarted.decide(decision(restarted, 'base', 'new-decision'), trusted())).code, 'RUN_ACCEPTED');
      assert.deepEqual(await facts(restarted), [{ id: 'p1', height: 6, volume: 1200 }, { id: 'p2', height: 3, volume: 288 }]);
    } finally { restarted.close(); }
  }));

  test('D586 two actual Node workers overlap before the host verifies each native candidate', async () => withRun(async host => {
    const gate = new SharedArrayBuffer(4), starts: ThreadStart[] = [], finishes: ThreadFinish[] = [], both = signal();
    const options = { gate, nativeGate: new SharedArrayBuffer(4), onStart(event: ThreadStart) { starts.push(event); if (starts.length === 2) both.send(); },
      onFinish(event: ThreadFinish) { finishes.push(event); } };
    const module = new URL(import.meta.url), baseline = host.snapshot.accepted;
    const a = host.dispatch('thread-base', 'base', threadWorker(module, 6, options));
    const b = host.dispatch('thread-lid', 'lid', threadWorker(module, 4, options));
    const release = () => { const value = new Int32Array(gate); Atomics.store(value, 0, 1); Atomics.notify(value, 0); };
    try {
      await Promise.race([both.receive, Promise.race([a, b]).then(() => assert.fail('A worker returned before both threads entered.'))]);
      assert.equal(new Set(starts.map(event => event.threadId)).size, 2);
      assert.ok(starts.every(event => event.threadId !== 0));
      assert.equal(finishes.length, 0);
      assert.deepEqual(host.snapshot.accepted, baseline);
      release();
      assert.deepEqual((await Promise.all([a, b])).map(result => result.phase), ['completed', 'completed']);
      assert.equal(finishes.length, 2);
      assert.ok(Math.max(...finishes.map(event => event.nativeStartedAt)) < Math.min(...finishes.map(event => event.finishedAt)));
      for (const row of host.snapshot.state.tasks) {
        assert.equal(row.phase, 'awaiting-decision');
        assert.equal(row.candidate?.candidateDigest, finishes.find(event => event.reply.submission.taskId === row.id)?.reply.nativeCandidateDigest);
      }
    } finally {
      release();
      await Promise.allSettled([a, b]);
    }
  }));
  test('D586 a trusted answer commits a new spec and rejects stale work, duplicate and foreign answers', async () => {
    const source = fixtureDoc(), base = source.instances![0];
    const question = askBatch({ ...base.doc, requirements: base.doc.requirements!.map(req => ({ ...req, basis: 'assumed' })) }, [
      { id: 'height-mm', text: 'What is the base height?', kind: 'number', unit: 'mm', blocks: { requirement: 'height' } },
    ]);
    base.doc = question.doc;
    await withRun(async (host, dir) => {
      const b = barrier(4), lid = host.dispatch('lid-old', 'lid', b.worker);
      try {
        await b.started;
        assert.equal((await host.dispatch('base-blocked', 'base', async () => assert.fail('Hard unknown cannot run.'))).code, 'TASK_REQUIRED_UNKNOWN');
        const input: AnswerRequest = { operationId: 'answer-height', runId: host.snapshot.runId, taskId: 'base', epoch: host.snapshot.epoch,
          specRevision: host.snapshot.state.specRevision, batch: question.batch.n, answers: { 'height-mm': 7 } };
        assert.equal((await host.answer(input, { by: 'user', at: 'forged' })).code, 'RUN_USER_REQUIRED');
        assert.equal((await host.answer({ ...input, epoch: input.epoch + 1 }, trusted())).code, 'RUN_QUESTION_STALE');
        assert.equal((await host.answer(input, trusted())).code, 'RUN_ANSWERED');
        assert.equal((await host.answer(input, trusted())).duplicate, true);
        assert.equal((await host.answer({ ...input, answers: { 'height-mm': 8 } }, trusted())).code, 'RUN_OPERATION_CONFLICT');
        assert.equal((await host.answer({ ...input, operationId: 'later-answer' }, trusted())).code, 'RUN_QUESTION_STALE');
        b.release();
        assert.equal((await lid).code, 'RUN_SPEC_MOVED');
        assert.deepEqual(host.snapshot.commits.map(commit => commit.kind), ['spec']);
        assert.equal((await host.refresh('lid-refresh', 'lid')).phase, 'completed');
        host.close();
        const reopened = await TaskRunHost.open(dir, evaluate);
        try {
          assert.equal(reopened.snapshot.state.tasks[1].phase, 'awaiting-decision');
          assert.deepEqual(await facts(reopened), [{ id: 'p1', height: 5, volume: 1000 }, { id: 'p2', height: 3, volume: 288 }]);
          assert.equal((await reopened.dispatch('new-base', 'base', async ticket => reply(ticket, 7))).phase, 'completed');
          assert.equal((await reopened.decide(decision(reopened, 'base', 'approve-7'), trusted())).code, 'RUN_ACCEPTED');
          assert.equal((await facts(reopened))[0].volume, 1400);
        } finally { reopened.close(); }
      } finally { b.release(); await Promise.allSettled([lid]); }
    }, 12, source);
  });

  test('D586 permission reduction invalidates an approval waiting in native integration', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'barocss-run-policy-'));
    const entered = signal(), resume = signal();
    let armed = false;
    const worker = async (doc: StudioDoc) => {
      if (armed) { armed = false; entered.send(); await resume.receive; }
      return evaluate(doc);
    };
    const host = await TaskRunHost.create(dir, 'housing', fixtureDoc(), fixturePlan, fixtureLimits, 8, worker);
    try {
      const before = host.snapshot.accepted;
      assert.equal((await host.dispatch('base', 'base', async ticket => reply(ticket, 6))).phase, 'completed');
      const old = decision(host, 'base', 'approve-old');
      armed = true;
      const approving = host.decide(old, trusted());
      try {
        await Promise.race([entered.receive, approving.then(() => assert.fail('Approval must wait in integration.'))]);
        assert.equal(host.revisePolicy('change-policy', 'limited', 1, { by: 'user', at: 'forged' }).code, 'RUN_USER_REQUIRED');
        assert.equal(host.revisePolicy('change-policy', 'limited', 1, trusted()).code, 'RUN_POLICY_REVISED');
        resume.send();
        assert.equal((await approving).code, 'RUN_DECISION_MOVED');
        assert.deepEqual(host.snapshot.accepted, before);
        assert.equal(host.snapshot.state.phase, 'paused');
        assert.equal(host.snapshot.state.limits.concurrent, 1);
        assert.equal(host.snapshot.state.tasks[0].candidate, undefined);
        host.close();
        const reopened = await TaskRunHost.open(dir, evaluate);
        try {
          assert.equal(reopened.snapshot.state.plan.policyRevision, 'limited');
          assert.equal(reopened.snapshot.state.phase, 'paused');
          assert.equal((await reopened.decide(old, trusted())).code, 'RUN_POLICY_MOVED');
          assert.deepEqual(reopened.snapshot.accepted, before);
        } finally { reopened.close(); }
      } finally { resume.send(); await Promise.allSettled([approving]); }
    } finally { host.close(); rmSync(dir, { recursive: true, force: true }); }
  });

  test('D586 mutating a reserved rejection cannot turn it into approval', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'barocss-run-decision-'));
    const entered = signal(), resume = signal();
    let armed = false;
    const host = await TaskRunHost.create(dir, 'housing', fixtureDoc(), fixturePlan, fixtureLimits, 8, async doc => {
      if (armed) { armed = false; entered.send(); await resume.receive; }
      return evaluate(doc);
    });
    try {
      const original = host.snapshot.accepted;
      assert.equal((await host.dispatch('base', 'base', async ticket => reply(ticket, 6))).phase, 'completed');
      const input = { ...decision(host, 'base', 'reject'), approved: false };
      armed = true;
      const waiting = host.decide(input, trusted());
      try {
        await Promise.race([entered.receive, waiting.then(() => assert.fail('Expected rejection to be durably reserved.'))]);
        input.approved = true;
        input.specRevision = 'different';
        resume.send();
        assert.equal((await waiting).code, 'RUN_REJECTED');
        assert.equal(host.snapshot.state.tasks[0].phase, 'cancelled');
        assert.deepEqual(host.snapshot.accepted, original);
        assert.equal(host.snapshot.commits.length, 0);
      } finally { resume.send(); await Promise.allSettled([waiting]); }
    } finally { host.close(); rmSync(dir, { recursive: true, force: true }); }
  });

  test('D586 leases, old-epoch replies and worker evidence cannot publish', async () => withRun(async host => {
    const original = host.snapshot.accepted, a = barrier(6), waiting = host.dispatch('expires', 'base', a.worker);
    try {
      await a.started;
      for (let i = 0; i < 6; i++) assert.equal(host.control('tick-' + i, 'tick', trusted()).phase, 'completed');
      a.release();
      assert.equal((await waiting).code, 'RUN_LEASE_EXPIRED');
      assert.equal((await host.dispatch('old-epoch', 'base', async ticket => ({ ...reply(ticket, 6), epoch: ticket.attempt.epoch - 1 }))).code, 'RUN_REPLY_MISMATCH');
      assert.equal((await host.dispatch('wrong-evidence', 'base', async ticket => ({ ...reply(ticket, 6), nativeCandidateDigest: 'untrusted' }))).code, 'RUN_WORKER_EVIDENCE_MISMATCH');
      assert.equal((await host.dispatch('excess-attempt', 'base', async ticket => reply(ticket, 6))).code, 'RUN_LIMIT');
      assert.deepEqual(host.snapshot.accepted, original);
    } finally { a.release(); await Promise.allSettled([waiting]); }
  }, 12));

  test('D586 timeout and worker crash preserve the accepted document and unknown effort', async () => withRun(async host => {
    const initial = host.snapshot.accepted;
    const waiting: TaskWorker = (_ticket, signal) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
    assert.equal((await host.dispatch('time-out', 'base', waiting)).code, 'RUN_TIMEOUT');
    assert.equal((await host.dispatch('worker-crash', 'lid', async () => { throw new Error('test disconnect'); })).code, 'RUN_WORKER_FAILED');
    assert.deepEqual(host.snapshot.state.budget, { limit: 8, used: 0, unknown: 4 });
    assert.deepEqual(host.snapshot.accepted, initial);
  }, 8, fixtureDoc(), { ...fixtureLimits, timeoutMs: 35 }));

  test('D586 approval identity cannot transfer to an identically named run', async () => withRun(async first => withRun(async second => {
    assert.notEqual(first.snapshot.runId, second.snapshot.runId);
    assert.equal((await first.dispatch('worker', 'base', async ticket => reply(ticket, 6))).phase, 'completed');
    assert.equal((await second.dispatch('worker', 'base', async ticket => reply(ticket, 6))).phase, 'completed');
    const foreign = decision(first, 'base', 'approve'), local = decision(second, 'base', 'approve');
    assert.equal(foreign.candidateDigest, local.candidateDigest);
    assert.equal(foreign.attemptId, local.attemptId);
    assert.equal((await second.decide(foreign, trusted())).code, 'RUN_DECISION_STALE');
    assert.equal((await second.decide(local, trusted())).code, 'RUN_ACCEPTED');
    assert.equal(first.snapshot.commits.length, 0);
  })));

  test('D586 Stop preserves known usage when the worker has returned and native validation is pending', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'barocss-run-usage-'));
    const entered = signal(), resume = signal();
    let armed = true;
    const host = await TaskRunHost.create(dir, 'housing', fixtureDoc(), fixturePlan, fixtureLimits, 8, async doc => {
      if (armed) { armed = false; entered.send(); await resume.receive; }
      return evaluate(doc);
    });
    try {
      const pending = host.dispatch('worker', 'base', async ticket => reply(ticket, 6));
      try {
        await Promise.race([entered.receive, pending.then(() => assert.fail('Expected the native gate to wait.'))]);
        assert.equal(host.snapshot.state.tasks[0].phase, 'validating');
        assert.deepEqual(host.snapshot.state.budget, { limit: 8, used: 1, unknown: 0 });
        assert.equal(host.control('stop', 'stop', trusted()).phase, 'completed');
        resume.send();
        assert.equal((await pending).code, 'RUN_LATE_RESULT');
        host.close();
        const reopened = await TaskRunHost.open(dir, evaluate);
        try { assert.deepEqual(reopened.snapshot.state.budget, { limit: 8, used: 1, unknown: 0 }); }
        finally { reopened.close(); }
      } finally { resume.send(); await Promise.allSettled([pending]); }
    } finally { host.close(); rmSync(dir, { recursive: true, force: true }); }
  });

  test('D586 numeric operation IDs cannot leave an unreadable run record', async () => withRun(async (host, dir) => {
    assert.equal((await host.dispatch('worker', 'base', async ticket => reply(ticket, 6))).phase, 'completed');
    const bad = { ...decision(host, 'base', 'ignored'), operationId: 42 as unknown as string };
    await assert.rejects(host.decide(bad, trusted()), /Invalid operation ID/);
    host.close();
    const reopened = await TaskRunHost.open(dir, evaluate);
    try {
      assert.equal(reopened.snapshot.commits.length, 0);
      assert.equal(reopened.snapshot.state.tasks[0].phase, 'awaiting-decision');
    } finally { reopened.close(); }
  }));

  test('D586 workers cannot change a shared interface or bypass an authored native check', async () => {
    const source = fixtureDoc();
    source.instances![1].position = [0, 0, 20];
    for (const placed of source.instances!) {
      placed.doc = withNode(placed.doc, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [5, 5], radius: 2 });
    }
    source.interfaces = { ...readInterfaces(undefined), holePatterns: [{ id: 'H1', axis: [0, 0, 1], diameter: 4, positions: [[5, 5, 0]], parts: ['p1', 'p2'] }] };
    await withRun(async host => {
      const baseline = host.snapshot.accepted;
      const escaped = await host.dispatch('escape', 'base', async ticket => {
        const result = reply(ticket, 6);
        return { ...result, submission: { ...result.submission, interfaces: { holePatterns: [] } } };
      });
      assert.equal(escaped.code, 'TASK_SUBMISSION_MISMATCH');
      assert.equal((await host.dispatch('bad-check', 'base', async ticket => reply(ticket, 8))).code, 'TASK_REQUIRED_CHECK');
      assert.deepEqual(host.snapshot.accepted, baseline);
      assert.equal((await host.dispatch('good', 'base', async ticket => reply(ticket, 6))).phase, 'completed');
      assert.equal((await host.decide(decision(host, 'base', 'approve'), trusted())).code, 'RUN_ACCEPTED');
      const decoded = await readStudioFile(host.acceptedBytes);
      assert.ok(!('error' in decoded));
      assert.deepEqual(decoded.doc.interfaces, source.interfaces);
      assert.deepEqual(decoded.doc.instances![1], source.instances![1]);
      const evaled = await evaluate(decoded.doc.instances![0].doc);
      assert.ok(evaled.ok);
      assert.ok(Math.abs(evaled.bodies[0].volume! - (200 - Math.PI * 4) * 6) < 1e-8);
    }, 12, source);
    const dir = mkdtempSync(join(tmpdir(), 'barocss-run-conflict-'));
    try {
      const task = { ...fixturePlan.tasks[1], occurrence: 'p1' };
      await assert.rejects(TaskRunHost.create(dir, 'collision', source, { ...fixturePlan, tasks: [fixturePlan.tasks[0], task] }, fixtureLimits, 8, evaluate), /WRITE_CONFLICT/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('D586 wall-time refusal keeps received usage when host validation does not return', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'barocss-run-time-bound-')), resume = signal();
    let entered = false;
    const host = await TaskRunHost.create(dir, 'housing', fixtureDoc(), fixturePlan, { ...fixtureLimits, timeoutMs: 150 }, 8,
      async doc => { entered = true; await resume.receive; return evaluate(doc); });
    try {
      const baseline = host.snapshot.accepted;
      assert.equal((await host.dispatch('worker', 'base', async ticket => reply(ticket, 6))).code, 'RUN_TIMEOUT');
      assert.equal(entered, true);
      assert.equal(host.snapshot.state.tasks[0].phase, 'failed');
      assert.deepEqual(host.snapshot.state.budget, { limit: 8, used: 1, unknown: 0 });
      assert.deepEqual(host.snapshot.accepted, baseline);
    } finally { resume.send(); host.close(); rmSync(dir, { recursive: true, force: true }); }
  });

}
