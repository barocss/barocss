import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { readStudioFile } from '@barocss/cad-model/engine/container';
import { emptyDoc, rectanglePart, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { userToken } from '@barocss/cad-model/team/ecr';
import { interfacesRevision } from '@barocss/cad-model/team/interfaces';
import { applyTaskDecision, bindTaskDecision, buildTaskCandidate } from '@barocss/cad-model/team/taskExecution';
import { compileTaskPlan, type TaskPlanRequest } from '@barocss/cad-model/team/taskPlan';
import { digestOf } from '@barocss/cad-model/util/digest';
import { TaskRunStore, type CommitIntent, type RunRecord, type RunState } from '../server/taskRun/store';

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const field = <T,>(value: T) => ({ value, basis: 'stated' as const, source: 'Local run store fixture' });
const plate = (w: number, d: number, h: number, goal: number): StudioDoc => ({
  ...rectanglePart(w, d, h),
  requirements: [{ id: 'height', source: 'Edit the plate height.', hard: true, basis: 'stated', check: {
    query: { fn: 'bbox', axis: 'z' }, op: '==', value: goal, unit: 'mm', tol: 0.001,
  } }],
});
const fixture = (): StudioDoc => ({
  ...emptyDoc(),
  brief: { version: 1, purpose: field('housing'), process: field('cnc-milling'), material: field('al6061') },
  instances: [
    { id: 'p1', name: 'Base', position: [0, 0, 0], rotation: [0, 0, 0], doc: plate(20, 10, 5, 6) },
    { id: 'p2', name: 'Lid', position: [45, 0, 0], rotation: [0, 0, 0], doc: plate(12, 8, 3, 4) },
  ],
});
const request: TaskPlanRequest = {
  identity: { projectId: 'journal-fixture', documentId: 'housing' }, policyRevision: 'user-v1', maxTasks: 2, throughSequence: 20,
  tasks: [
    { id: 'raise-base', holder: 'base-worker', occurrence: 'p1', feature: 'n1', capability: 'extrusion-height', units: 'mm', frame: 'part-local-z' },
    { id: 'raise-lid', holder: 'lid-worker', occurrence: 'p2', feature: 'n1', capability: 'extrusion-height', units: 'mm', frame: 'part-local-z' },
  ],
};
async function prepare(doc: StudioDoc) {
  const plan = compileTaskPlan(doc, request);
  assert.ok(!('error' in plan), JSON.stringify(plan));
  const task = plan.tasks[0], leases = new Map([[task.occurrence, {
    part: task.occurrence, holder: task.holder, contract: interfacesRevision(doc), until: 20,
  }]]);
  const context = { activePlan: plan, identity: plan.identity, policyRevision: plan.policyRevision, leases, sequence: 1 };
  const submission = { taskId: task.id, specRevision: plan.specRevision, inputDigest: task.inputDigest, heightMm: 6 };
  const candidate = await buildTaskCandidate(plan, { doc, bodies: [] }, submission, { ...context, worker: task.holder }, evaluate);
  assert.ok(!('error' in candidate), JSON.stringify(candidate));
  assert.equal(candidate.geometry.volumeMm3, 1200);
  const state: RunState = {
    phase: 'active', controlRevision: 0, sequence: 1, plan: request, specRevision: plan.specRevision,
    limits: { concurrent: 2, attemptsPerTask: 2, reservation: 2, leaseTicks: 5, timeoutMs: 5000 },
    budget: { limit: 10, used: 1, unknown: 0 },
    tasks: [
      { id: task.id, phase: 'awaiting-decision', attempts: 1, candidate, submission },
      { id: plan.tasks[1].id, phase: 'ready', attempts: 0 },
    ],
    operations: [],
  };
  const intent: CommitIntent = { operationId: 'approve-base', taskId: task.id, candidateDigest: candidate.candidateDigest, specRevision: plan.specRevision };
  return {
    state, intent,
    approve: async () => {
      const choice = bindTaskDecision(candidate, true, userToken('2026-11-11T00:00:00Z'));
      assert.ok(!('error' in choice));
      const accepted = await applyTaskDecision(choice, { doc, bodies: [] }, context, evaluate);
      assert.ok(!('error' in accepted), JSON.stringify(accepted));
      return accepted.doc;
    },
  };
}
function committing(record: RunRecord, intent: CommitIntent, epoch: number): RunState {
  return { ...record.state,
    tasks: record.state.tasks.map(task => task.id === intent.taskId ? { ...task, phase: 'committing' } : task),
    operations: [...record.state.operations, { id: intent.operationId, key: digestOf(intent), epoch, phase: 'reserved' }],
  };
}
function completed(record: RunRecord, intent: CommitIntent, doc: StudioDoc): RunState {
  const next = compileTaskPlan(doc, request);
  assert.ok(!('error' in next), JSON.stringify(next));
  return { ...record.state, specRevision: next.specRevision,
    tasks: record.state.tasks.map(task => task.id === intent.taskId ? { ...task, phase: 'completed' } : task),
    operations: record.state.operations.map(op => op.id === intent.operationId ? { ...op, phase: 'completed' } : op),
  };
}
async function readAccepted(store: TaskRunStore): Promise<StudioDoc> {
  const loaded = await readStudioFile(store.acceptedBytes);
  assert.ok(!('error' in loaded), JSON.stringify(loaded));
  assert.equal(digestOf(loaded.doc), store.snapshot.accepted.modelDigest);
  return loaded.doc;
}
async function checkNative(store: TaskRunStore, baseHeight: number) {
  const doc = await readAccepted(store);
  assert.deepEqual(doc.instances![1], fixture().instances![1]);
  const native = await evaluate(doc.instances![0].doc);
  assert.ok(native.ok);
  assert.equal(native.bodies[0].mesh.bounds.max[2], baseHeight);
  assert.ok(Math.abs(native.bodies[0].volume! - 200 * baseHeight) <= 1e-8);
}
async function usingFolder(fn: (dir: string) => Promise<void>) {
  const dir = mkdtempSync(join(tmpdir(), 'barocss-task-run-'));
  try { await fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}
function recovery(record: RunRecord): RunState {
  return {
    ...record.state,
    tasks: record.state.tasks.map(task => task.phase === 'committing' ? { ...task, phase: 'awaiting-decision' } : task),
    operations: record.state.operations.map(op => op.phase === 'reserved' ? { ...op, phase: 'interrupted' } : op),
  };
}

const childMode = process.env.D586_STORE_CHILD;
if (childMode) {
  const dir = process.argv[2];
  let armed = false;
  const killSelf = () => process.kill(process.pid, 'SIGKILL');
  const store = TaskRunStore.open(dir, point => { if (armed && point === childMode) killSelf(); });
  store.recover(store.snapshot.revision, recovery(store.snapshot));
  if (childMode === 'hold-writer') {
    console.log('writer-ready');
    for await (const _input of process.stdin) {
      void _input;
      break;
    }
    store.close();
  } else {
    const prepared = await prepare(await readAccepted(store));
    store.reserveCommit(store.snapshot.revision, prepared.intent, committing(store.snapshot, prepared.intent, store.epoch));
    if (childMode === 'intent-durable') killSelf();
    const doc = await prepared.approve();
    armed = true;
    store.publish(store.snapshot.revision, prepared.intent.operationId, doc, completed(store.snapshot, prepared.intent, doc));
    assert.fail('Expected the child to stop at the requested durability point.');
  }
} else {
  for (const point of ['intent-durable', 'native-durable', 'record-durable'] as const) {
    test(`D586 restart after ${point} distinguishes a staged native file from a committed receipt`, async () => usingFolder(async dir => {
      const original = fixture(), prepared = await prepare(original);
      const initial = TaskRunStore.create(dir, 'housing-run', original, prepared.state);
      const baseline = initial.snapshot.accepted;
      initial.close();
      const child = spawnSync(process.execPath, [process.argv[1], dir], {
        env: { ...process.env, D586_STORE_CHILD: point }, encoding: 'utf8', timeout: 30000,
      });
      assert.equal(child.signal, 'SIGKILL', child.stderr + child.stdout);
      const recovered = TaskRunStore.open(dir);
      try {
        const snapshot = recovered.snapshot, committed = point === 'record-durable';
        assert.equal(recovered.epoch, 3);
        assert.equal(snapshot.epoch, 2);
        assert.equal(snapshot.commits.length, committed ? 1 : 0);
        assert.equal(snapshot.pending?.operationId, committed ? undefined : 'approve-base');
        assert.equal(snapshot.state.operations.at(-1)?.phase, committed ? 'completed' : 'reserved');
        assert.equal(snapshot.accepted.sha256 === baseline.sha256, !committed);
        await checkNative(recovered, committed ? 6 : 5);
        recovered.recover(snapshot.revision, recovery(snapshot));
        assert.equal(recovered.snapshot.pending, undefined);
        assert.equal(recovered.snapshot.state.operations.at(-1)?.phase, committed ? 'completed' : 'interrupted');
        assert.equal(recovered.snapshot.state.tasks[0].phase, committed ? 'completed' : 'awaiting-decision');
        if (committed) assert.deepEqual(recovered.snapshot.commits[0].from, baseline);
      } finally { recovered.close(); }
    }));
  }

  test('D614 a writer that wins after the guard prevents the checked caller from writing', async () => usingFolder(async dir => {
    const doc = fixture(), prepared = await prepare(doc);
    const initial = TaskRunStore.create(dir, 'housing-run', doc, prepared.state);
    initial.close();
    const baseline = TaskRunStore.inspect(dir);
    const record = join(dir, 'run.json');
    let winner: { bytes: Buffer; entries: string[] } | undefined;
    assert.throws(() => TaskRunStore.open(dir, undefined, checked => {
      assert.deepEqual(checked, baseline);
      const other = TaskRunStore.open(dir);
      try {
        other.recover(checked.revision, recovery(checked));
        other.checkpoint(other.snapshot.revision, { ...other.snapshot.state, phase: 'paused', controlRevision: 1 });
      } finally { other.close(); }
      winner = { bytes: readFileSync(record), entries: readdirSync(dir).sort() };
    }), { code: 'RUN_BUSY' });
    assert.ok(winner);
    assert.deepEqual(readFileSync(record), winner.bytes);
    assert.deepEqual(readdirSync(dir).sort(), winner.entries);
    assert.equal(TaskRunStore.inspect(dir).state.phase, 'paused');
  }));

  test('D586 a second process cannot claim a live writer epoch', async () => usingFolder(async dir => {
    const doc = fixture(), prepared = await prepare(doc);
    const initial = TaskRunStore.create(dir, 'housing-run', doc, prepared.state);
    initial.close();
    const child = spawn(process.execPath, [process.argv[1], dir], { env: { ...process.env, D586_STORE_CHILD: 'hold-writer' }, stdio: 'pipe' });
    const exit = once(child, 'exit');
    try {
      const first = await Promise.race([once(child.stdout, 'data'), exit.then(() => assert.fail('The writer exited before acquiring the store.'))]);
      assert.match(first[0].toString(), /writer-ready/);
      assert.throws(() => TaskRunStore.open(dir), { code: 'RUN_BUSY' });
      const visible = TaskRunStore.inspect(dir);
      assert.equal(visible.epoch, 2);
      assert.equal(visible.state.phase, 'active');
      child.stdin.end('close');
      assert.deepEqual(await exit, [0, null]);
      const writer = TaskRunStore.open(dir);
      assert.equal(writer.epoch, 3);
      writer.close();
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill();
      await exit;
    }
  }));

  test('D586 a storage fault keeps the accepted pointer and closes the failing writer', async () => usingFolder(async dir => {
    const doc = fixture(), prepared = await prepare(doc);
    const first = TaskRunStore.create(dir, 'housing-run', doc, prepared.state);
    first.close();
    const writer = TaskRunStore.open(dir, point => { if (point === 'native-durable') throw new Error('injected disk fault'); });
    writer.recover(writer.snapshot.revision, recovery(writer.snapshot));
    writer.reserveCommit(writer.snapshot.revision, prepared.intent, committing(writer.snapshot, prepared.intent, writer.epoch));
    const accepted = await prepared.approve();
    assert.throws(() => writer.publish(writer.snapshot.revision, prepared.intent.operationId, accepted, completed(writer.snapshot, prepared.intent, accepted)), { code: 'RUN_STORAGE' });
    assert.throws(() => writer.snapshot, { code: 'RUN_CLOSED' });
    writer.close();
    const next = TaskRunStore.open(dir);
    try {
      assert.equal(next.snapshot.commits.length, 0);
      await checkNative(next, 5);
    } finally { next.close(); }
  }));

  test('D586 a durability callback cannot acknowledge a competing pause or release the writer', async () => usingFolder(async dir => {
    const doc = fixture(), prepared = await prepare(doc);
    const initial = TaskRunStore.create(dir, 'housing-run', doc, prepared.state);
    initial.close();
    let verified = false;
    const writer = TaskRunStore.open(dir, point => {
      if (point !== 'native-durable') return;
      const current = writer.snapshot;
      assert.throws(() => writer.checkpoint(current.revision, { ...current.state, phase: 'paused' }), { code: 'RUN_BUSY' });
      assert.throws(() => writer.close(), { code: 'RUN_BUSY' });
      verified = true;
    });
    try {
      writer.recover(writer.snapshot.revision, recovery(writer.snapshot));
      writer.reserveCommit(writer.snapshot.revision, prepared.intent, committing(writer.snapshot, prepared.intent, writer.epoch));
      const accepted = await prepared.approve();
      writer.publish(writer.snapshot.revision, prepared.intent.operationId, accepted, completed(writer.snapshot, prepared.intent, accepted));
      assert.equal(verified, true);
      assert.equal(writer.snapshot.state.phase, 'active');
      assert.equal(writer.snapshot.commits.length, 1);
    } finally { writer.close(); }
  }));

  test('D586 changing the process directory does not redirect a live writer', async () => usingFolder(async dir => {
    const original = process.cwd(), a = join(dir, 'a'), b = join(dir, 'b'), doc = fixture();
    mkdirSync(a); mkdirSync(b);
    const { state } = await prepare(doc);
    let first: TaskRunStore | undefined, second: TaskRunStore | undefined;
    try {
      process.chdir(a);
      first = TaskRunStore.create('run', 'first', doc, state);
      process.chdir(b);
      second = TaskRunStore.create('run', 'second', doc, state);
      const saved = readFileSync(join(b, 'run', 'run.json'));
      first.checkpoint(first.snapshot.revision, { ...state, phase: 'paused' });
      assert.deepEqual(readFileSync(join(b, 'run', 'run.json')), saved);
      assert.equal(JSON.parse(readFileSync(join(a, 'run', 'run.json'), 'utf8')).record.state.phase, 'paused');
    } finally { process.chdir(original); first?.close(); second?.close(); }
  }));

  test('D586 accepted native corruption refuses reopening without replacing the last record', async () => usingFolder(async dir => {
    const doc = fixture(), prepared = await prepare(doc);
    const first = TaskRunStore.create(dir, 'housing-run', doc, prepared.state), native = first.snapshot.accepted;
    first.close();
    const record = readFileSync(join(dir, 'run.json'));
    writeFileSync(join(dir, 'native', native.sha256 + '.bcad'), 'damaged bytes');
    assert.throws(() => TaskRunStore.open(dir), { code: 'RUN_CORRUPT' });
    assert.deepEqual(readFileSync(join(dir, 'run.json')), record);
  }));
}
