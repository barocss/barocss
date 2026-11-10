import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { readStudioFile } from '@barocss/cad-model/engine/container';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { userToken } from '@barocss/cad-model/team/ecr';
import { TaskRunHost, type DecisionRequest } from '../server/taskRun/host';
import { serveTaskThread, threadWorker } from '../server/taskRun/thread';
import { fixtureDoc, fixtureLimits, fixturePlan } from './task-run-fixture';

const trusted = () => userToken('2026-11-11T00:00:00Z');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const mode = process.env.D586_HOST_CRASH;
const stages = ['reserved', 'running', 'held', 'integrating', 'native-durable', 'receipt'] as const;
function approval(host: TaskRunHost, operationId: string): DecisionRequest {
  const record = host.snapshot, task = record.state.tasks[0];
  assert.ok(task.candidate && task.attempt);
  return { operationId, runId: record.runId, taskId: task.id, epoch: record.epoch, attemptId: task.attempt.id, specRevision: task.candidate.specRevision,
    candidateDigest: task.candidate.candidateDigest, approved: true };
}
if (!(await serveTaskThread(evaluate))) {
  if (mode) {
    let armed = false;
    const crash = () => process.kill(process.pid, 'SIGKILL');
    const host: TaskRunHost = await TaskRunHost.open(process.argv[2], async doc => {
      if (armed && mode === 'integrating') crash();
      return evaluate(doc);
    }, point => {
      if (!armed) return;
      if ((mode === 'reserved' && point === 'record-durable') || mode === point
        || (mode === 'receipt' && point === 'record-durable' && host.snapshot.commits.length === 1)) crash();
    });
    armed = mode === 'reserved';
    const built = await host.dispatch('worker-base', 'base', threadWorker(new URL(import.meta.url), 6, {
      gate: mode === 'running' ? new SharedArrayBuffer(4) : undefined,
      onStart() { if (mode === 'running') crash(); },
    }));
    assert.equal(built.phase, 'completed', JSON.stringify(built));
    if (mode === 'held') crash();
    armed = true;
    await host.decide(approval(host, 'approve-base'), trusted());
    assert.fail('The child did not reach its crash boundary.');
  } else for (const stage of stages) {
    test(`D586 a new process recovers the host after ${stage}`, async () => {
      const dir = mkdtempSync(join(tmpdir(), 'barocss-run-crash-'));
      try {
        const initial = await TaskRunHost.create(dir, 'housing', fixtureDoc(), fixturePlan, fixtureLimits, 8, evaluate);
        const baseline = initial.snapshot.accepted;
        initial.close();
        const child = spawnSync(process.execPath, [process.argv[1], dir], {
          env: { ...process.env, D586_HOST_CRASH: stage }, encoding: 'utf8', timeout: 30000,
        });
        assert.equal(child.signal, 'SIGKILL', child.stderr + child.stdout);
        const recovered = await TaskRunHost.open(dir, evaluate);
        try {
          const record = recovered.snapshot, committed = stage === 'receipt', interrupted = ['reserved', 'running'].includes(stage);
          const doc = await readStudioFile(recovered.acceptedBytes);
          assert.ok(!('error' in doc));
          const body = await evaluate(doc.doc.instances![0].doc);
          assert.ok(body.ok);
          assert.equal(body.bodies[0].mesh.bounds.max[2], committed ? 6 : 5);
          assert.ok(Math.abs(body.bodies[0].volume! - (committed ? 1200 : 1000)) < 1e-8);
          assert.equal(record.epoch, 3);
          assert.equal(record.pending, undefined);
          assert.equal(record.accepted.sha256 === baseline.sha256, !committed);
          assert.equal(record.commits.length, committed ? 1 : 0);
          assert.equal(record.state.tasks[0].phase, committed ? 'completed' : interrupted ? 'stale' : 'awaiting-decision');
          assert.equal(record.state.budget.unknown, interrupted ? 2 : 0);
          const repeat = await recovered.dispatch('worker-base', 'base', async () => assert.fail('Never dispatch a recovered operation again.'));
          assert.equal(repeat.duplicate, true);
          assert.equal(repeat.phase, interrupted ? 'interrupted' : 'completed');
          if (committed) {
            const task = record.state.tasks[0];
            const replay = await recovered.decide({ ...approval(recovered, 'approve-base'), epoch: 2, attemptId: task.attempt!.id }, trusted());
            assert.deepEqual([replay.duplicate, replay.code], [true, 'RUN_ACCEPTED']);
            assert.equal(recovered.snapshot.commits.length, 1);
          } else if (!interrupted) {
            const stale = { ...approval(recovered, 'fresh-approval'), epoch: 2 };
            assert.equal((await recovered.decide(stale, trusted())).code, 'RUN_DECISION_STALE');
            assert.equal((await recovered.decide(approval(recovered, 'fresh-approval'), trusted())).code, 'RUN_ACCEPTED');
            assert.equal(recovered.snapshot.commits.length, 1);
          }
        } finally { recovered.close(); }
      } finally { rmSync(dir, { recursive: true, force: true }); }
    });
  }
}
