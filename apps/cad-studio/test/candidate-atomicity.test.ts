import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchTool, type Evaluate } from '@barocss/cad-model/chat/tools';
import { readStudioFile } from '@barocss/cad-model/engine/container';
import { rectanglePart, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluateDoc, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import { receivePersonRowFiles, revokePersonRowFiles } from '@barocss/cad-model/engine/rowFiles';
import { CandidateBoard, inProcessReopen, type Reopen } from '@barocss/cad-model/team/candidates';

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const independentVolume = (height: number) => 20 * 10 * height;

function signal() {
  let send!: () => void;
  const received = new Promise<void>(resolve => { send = resolve; });
  return { received, send };
}
function replayBarrier() {
  const entered = signal(), second = signal(), resume = signal();
  let calls = 0;
  const reopen: Reopen = async bytes => {
    calls++;
    if (calls === 2) second.send();
    entered.send();
    await resume.received;
    return inProcessReopen(evaluate)(bytes);
  };
  return { entered: entered.received, second: second.received, release: resume.send, reopen, calls: () => calls };
}
async function heightOf(bytes: Uint8Array) {
  const read = await readStudioFile(bytes);
  assert.ok(!('error' in read));
  const node = read.doc.nodes[1];
  assert.equal(node.kind, 'extrude');
  return Number(node.height);
}
const part = () => rectanglePart(20, 10, 5);
const patch = (height: number) => ({ units: 'mm', ops: [{ tool: 'edit_feature', args: { index: 1, values: { h: height } } }] });

async function makeBoard(reopen: Reopen, worker: Evaluate = evaluate, doc = part(), build = true) {
  const native = await evaluate(doc);
  assert.ok(native.ok);
  const board = new CandidateBoard({ doc, bodies: native.bodies }, worker, reopen);
  if (build) for (const [id, height] of [['A', 6], ['B', 7]] as const) {
    assert.ok(board.start({ operationId: 'start-' + id, candidate: id, patch: patch(height) }).ok);
    const built = await board.run('run-' + id, id);
    assert.ok(built.ok, built.message ?? '');
    assert.equal(built.evidence?.facts.volume, independentVolume(height));
  }
  assert.equal(board.state.token, 0);
  assert.equal(board.volume(), independentVolume(5));
  return board;
}

for (const winner of ['A', 'B'] as const) {
  test(`D585 ${winner} wins replay and the other accept cannot publish the same baseline`, async () => {
    const gateA = replayBarrier(), gateB = replayBarrier();
    const board = await makeBoard(async bytes => (await heightOf(bytes) === 6 ? gateA : gateB).reopen(bytes));
    const a = board.accept('accept-A', 'A'), b = board.accept('accept-B', 'B');
    try {
      await Promise.all([gateA.entered, gateB.entered]);
      const [fast, slow] = winner === 'A' ? [a, b] : [b, a];
      const [first, second] = winner === 'A' ? [gateA, gateB] : [gateB, gateA];
      first.release();
      assert.ok((await fast).ok);
      second.release();
      const late = await slow;
      assert.equal(late.code, 'STALE_BASE');
      const height = winner === 'A' ? 6 : 7;
      assert.equal(board.state.token, 1);
      assert.equal(board.volume(), independentVolume(height));
      assert.equal(await heightOf(board.save()), height);
      const result = await evaluate(board.state.doc);
      assert.ok(result.ok);
      assert.deepEqual(result.bodies[0].mesh.bounds, { min: [0, 0, 0], max: [20, 10, height] });
      assert.equal(board.statusOf(winner), 'accepted');
      assert.equal(board.statusOf(winner === 'A' ? 'B' : 'A'), 'built');
      assert.deepEqual(board.outcomes.slice(-2).map(o => [o.candidate, o.code ?? null, o.token]), [[winner, null, 1], [winner === 'A' ? 'B' : 'A', 'STALE_BASE', 1]]);
      assert.ok(board.undo('undo').ok);
      assert.equal(board.volume(), independentVolume(5));
      assert.equal(board.undo('extra-undo').code, 'NOTHING_TO_UNDO');
    } finally {
      gateA.release();
      gateB.release();
      await Promise.allSettled([a, b]);
    }
  });
}

test('D585 cancel during native replay leaves the accepted document untouched', async () => {
  const gate = replayBarrier(), board = await makeBoard(gate.reopen), initial = board.save();
  const accepting = board.accept('accept-A', 'A');
  try {
    await gate.entered;
    assert.ok(board.cancel('cancel-A', 'A').ok);
    gate.release();
    assert.equal((await accepting).code, 'CANCELLED');
    assert.equal(board.statusOf('A'), 'cancelled');
    assert.equal(board.state.token, 0);
    assert.deepEqual(board.save(), initial);
    assert.equal(board.undo('undo').code, 'NOTHING_TO_UNDO');
  } finally {
    gate.release();
    await Promise.allSettled([accepting]);
  }
});

test('D585 operation ID is reserved across both async and synchronous entry points', async () => {
  const gate = replayBarrier(), board = await makeBoard(gate.reopen);
  const first = board.accept('approve', 'A');
  const duplicate = board.accept('approve', 'A');
  try {
    await gate.entered;
    const pending = await Promise.race([duplicate, gate.second.then(() => assert.fail('Duplicate started a second native replay.'))]);
    assert.deepEqual([pending.ok, pending.code, pending.token], [false, 'OPERATION_PENDING', 0]);
    pending.code = 'DUPLICATE';
    assert.equal(board.outcomes.at(-1)?.code, 'OPERATION_PENDING');
    assert.equal((await board.accept('approve', 'B')).code, 'OPERATION_CONFLICT');
    assert.equal(board.cancel('approve', 'A').code, 'OPERATION_CONFLICT');
    assert.equal(board.undo('approve').code, 'OPERATION_CONFLICT');
    assert.equal(board.statusOf('A'), 'built');
    gate.release();
    const accepted = await first;
    assert.ok(accepted.ok);
    assert.equal(gate.calls(), 1);
    assert.equal(board.cancel('cancel-after-commit', 'A').code, 'ALREADY_COMMITTED');
    assert.ok(board.undo('undo').ok);
    assert.equal(board.undo('undo-again').code, 'NOTHING_TO_UNDO');
    const again = await board.accept('approve', 'A');
    assert.deepEqual([again.code, again.ok, again.token, again.volume], ['DUPLICATE', true, 1, independentVolume(6)]);
    assert.equal(board.state.token, 2);
    assert.equal(gate.calls(), 1);
  } finally {
    gate.release();
    await Promise.allSettled([first, duplicate]);
  }
});

async function keepoutPart(): Promise<StudioDoc> {
  const doc = part(), native = await evaluate(doc);
  assert.ok(native.ok);
  const added = await dispatchTool({ doc, bodies: native.bodies }, 'add_keepout', {
    name: 'top clearance', box: { frame: { origin: [0, 0, 20], normal: [0, 0, 1], xAxis: [1, 0, 0] }, size: [20, 10, 10] },
  }, evaluate);
  assert.ok(!added.isError, added.content);
  return { ...added.state.doc, requirements: [{
    id: 'top-gap', source: 'Leave at least 2 mm at the top.', basis: 'stated', hard: true,
    check: { query: { fn: 'keepout', keepout: 'K1' }, op: '>=', value: 2, unit: 'mm' },
  }] };
}

// Only pause inside the named native consumer. The gate still gets the real evaluation result.
function evaluateBarrier(stage: 'runGates' | 'evidenceOf', initiallyArmed: boolean) {
  const entered = signal(), resume = signal();
  let armed = initiallyArmed;
  const worker: Evaluate = async doc => {
    const stack = new Error().stack ?? '';
    if (armed && stack.split('\n').some(line => line.includes('at ' + stage + ' ('))) {
      armed = false;
      entered.send();
      await resume.received;
    }
    return evaluate(doc);
  };
  return { worker, enter: entered.received, release: resume.send, arm: () => { armed = true; } };
}

for (const [stage, interrupt] of [['runGates', 'cancel'], ['evidenceOf', 'deadline']] as const) {
  test(`D585 late run ${stage} observes ${interrupt} before publishing`, async () => {
    const gate = evaluateBarrier(stage, true);
    const board = await makeBoard(inProcessReopen(evaluate), gate.worker, await keepoutPart(), false);
    const initial = board.save();
    assert.ok(board.start({ operationId: 'start-A', candidate: 'A', patch: patch(6), deadline: 1 }).ok);
    const attempt = board.run('run-A', 'A');
    try {
      await Promise.race([gate.enter, attempt.then(() => assert.fail(`run finished before ${stage}`))]);
      if (interrupt === 'cancel') assert.ok(board.cancel('cancel-A', 'A').ok);
      else board.tick(2);
      gate.release();
      const expected = interrupt === 'cancel' ? ['CANCELLED', 'cancelled'] : ['TIMED_OUT', 'timed_out'];
      assert.deepEqual([(await attempt).code, board.statusOf('A')], expected);
      assert.equal(board.evidenceOf('A'), null);
      assert.equal(board.state.token, 0);
      assert.deepEqual(board.save(), initial);
      assert.equal(board.undo('undo').code, 'NOTHING_TO_UNDO');
    } finally {
      gate.release();
      await Promise.allSettled([attempt]);
    }
  });
}

for (const stage of ['runGates', 'evidenceOf'] as const) {
  test(`D585 cancel during accept ${stage} prevents file replay`, async () => {
    const gate = evaluateBarrier(stage, false);
    let replayed = 0;
    const board = await makeBoard(bytes => { replayed++; return inProcessReopen(evaluate)(bytes); }, gate.worker, await keepoutPart());
    const initial = board.save();
    gate.arm();
    const attempt = board.accept('accept-A', 'A');
    try {
      await Promise.race([gate.enter, attempt.then(() => assert.fail(`accept finished before ${stage}`))]);
      assert.ok(board.cancel('cancel-A', 'A').ok);
      gate.release();
      assert.equal((await attempt).code, 'CANCELLED');
      assert.equal(replayed, 0);
      assert.equal(board.statusOf('A'), 'cancelled');
      assert.equal(board.state.token, 0);
      assert.deepEqual(board.save(), initial);
    } finally {
      gate.release();
      await Promise.allSettled([attempt]);
    }
  });
}

test('D585 accept and Undo/Redo cannot restore the old acceptance token', async () => {
  const gateA = replayBarrier();
  const board = await makeBoard(async bytes => await heightOf(bytes) === 6 ? gateA.reopen(bytes) : inProcessReopen(evaluate)(bytes));
  const initial = board.save(), attempt = board.accept('accept-A', 'A');
  try {
    await gateA.entered;
    assert.ok((await board.accept('accept-B', 'B')).ok);
    const winner = board.save();
    assert.ok(board.undo('undo-1').ok);
    assert.deepEqual(board.save(), initial);
    assert.ok(board.redo('redo-1').ok);
    assert.deepEqual(board.save(), winner);
    assert.ok(board.undo('undo-2').ok);
    assert.deepEqual(board.save(), initial);
    gateA.release();
    assert.equal((await attempt).code, 'STALE_BASE');
    assert.equal(board.state.token, 4);
    assert.equal(board.statusOf('A'), 'built');
    assert.deepEqual(board.save(), initial);
    assert.ok(board.redo('redo-2').ok);
    assert.deepEqual(board.save(), winner);
  } finally {
    gateA.release();
    await Promise.allSettled([attempt]);
  }
});

test('D585 replacing a candidate while its acceptance is in replay cannot commit the old generation', async () => {
  const gate = replayBarrier(), board = await makeBoard(gate.reopen), initial = board.save();
  const attempt = board.accept('accept-old-A', 'A');
  try {
    await gate.entered;
    assert.ok(board.start({ operationId: 'replace-A', candidate: 'A', patch: patch(8) }).ok);
    assert.equal((await board.run('run-new-A', 'A')).evidence?.facts.volume, independentVolume(8));
    gate.release();
    assert.equal((await attempt).code, 'CANDIDATE_REPLACED');
    assert.equal(board.statusOf('A'), 'built');
    assert.equal(board.state.token, 0);
    assert.deepEqual(board.save(), initial);
    assert.ok((await board.accept('accept-new-A', 'A')).ok);
    assert.equal(board.volume(), independentVolume(8));
  } finally {
    gate.release();
    await Promise.allSettled([attempt]);
  }
});

test('D585 exceptions preserve the accepted file and permit a fresh operation', async () => {
  let failAt: 'evaluate' | 'reopen' | null = null;
  const board = await makeBoard(bytes => {
    if (failAt === 'reopen') throw new Error('reader disconnected');
    return inProcessReopen(evaluate)(bytes);
  }, doc => {
    if (failAt === 'evaluate') throw new Error('worker disconnected');
    return evaluate(doc);
  });
  const initial = board.save();
  for (const [stage, code, message] of [['evaluate', 'GATE_FAILED', 'worker disconnected'], ['reopen', 'REPLAY_UNREADABLE', 'reader disconnected']] as const) {
    failAt = stage;
    const failed = await board.accept('fail-' + stage, 'A');
    assert.equal(failed.code, code);
    assert.ok(failed.message?.includes(message));
    assert.equal(board.statusOf('A'), 'built');
    assert.equal(board.state.token, 0);
    assert.deepEqual(board.save(), initial);
    assert.equal(board.undo('undo-' + stage).code, 'NOTHING_TO_UNDO');
    failAt = null;
    assert.equal((await board.accept('fail-' + stage, 'A')).code, 'DUPLICATE');
    assert.equal(board.outcomes.find(o => o.seq === failed.seq)?.code, code);
    assert.equal(board.state.token, 0);
  }
  assert.ok((await board.accept('retry', 'A')).ok);
  assert.equal(board.volume(), independentVolume(6));
  assert.equal(board.state.token, 1);
});

test('D585 owns the input snapshot and keeps a hard unknown from committing', async () => {
  const doc: StudioDoc = { ...part(), requirements: [{
    id: 'unknown', source: 'Check the missing edge radius.', basis: 'stated', hard: true,
    check: { query: { fn: 'radius', face: 'missing' }, op: '==', value: 2, unit: 'mm' },
  }] };
  const board = await makeBoard(inProcessReopen(evaluate), evaluate, doc);
  const initial = board.save(), view = board.state.doc;
  view.requirements!.length = 0;
  doc.requirements!.length = 0;
  const result = await board.accept('accept-A', 'A');
  assert.equal(result.code, 'GATE_FAILED');
  assert.equal(board.evidenceOf('A')?.verdicts.unknown.status, 'unknown');
  assert.equal(board.state.token, 0);
  assert.deepEqual(board.save(), initial);
});

test('D585 dependencies follow accepted generations through Undo, Redo and a new branch', async () => {
  const board = await makeBoard(inProcessReopen(evaluate));
  const start = (operationId: string) => board.start({
    operationId, candidate: 'requires-A', patch: { ...patch(8), dependsOn: ['A'] },
  });
  assert.ok((await board.accept('accept-A', 'A')).ok);
  assert.ok(start('dependent-at-A').ok);
  assert.ok(board.undo('undo-A').ok);
  assert.equal(start('dependent-after-undo').code, 'MISSING_DEPENDENCY');
  assert.equal((await board.run('old-dependent', 'requires-A')).code, 'STALE_BASE');
  assert.equal(board.statusOf('requires-A'), 'refused');
  assert.ok(board.redo('redo-A').ok);
  assert.ok(start('dependent-after-redo').ok);
  assert.equal((await board.run('build-after-redo', 'requires-A')).evidence?.facts.volume, 1600);
  assert.ok(board.undo('undo-A-again').ok);
  assert.ok(board.start({ operationId: 'start-branch', candidate: 'branch', patch: patch(9) }).ok);
  assert.ok((await board.run('run-branch', 'branch')).ok);
  assert.ok((await board.accept('accept-branch', 'branch')).ok);
  assert.equal(board.redo('redo-obsolete-branch').code, 'NOTHING_TO_REDO');
  assert.equal(start('dependent-on-old-branch').code, 'MISSING_DEPENDENCY');
  assert.equal(board.volume(), 1800);
});

test('D585 a run interrupted by another commit leaves no pending state or evidence', async () => {
  const gate = evaluateBarrier('runGates', false);
  const board = await makeBoard(inProcessReopen(evaluate), gate.worker);
  assert.ok(board.start({ operationId: 'start-C', candidate: 'C', patch: patch(8) }).ok);
  gate.arm();
  const attempt = board.run('run-C', 'C');
  try {
    await Promise.race([gate.enter, attempt.then(() => assert.fail('run finished before its gates'))]);
    assert.ok((await board.accept('accept-A', 'A')).ok);
    const accepted = board.save();
    gate.release();
    assert.equal((await attempt).code, 'STALE_BASE');
    assert.equal(board.statusOf('C'), 'refused');
    assert.equal(board.evidenceOf('C'), null);
    assert.equal(board.state.token, 1);
    assert.deepEqual(board.save(), accepted);
  } finally {
    gate.release();
    await Promise.allSettled([attempt]);
  }
});

test('D585 a replay exception that arrives after cancellation cannot change the outcome', async () => {
  const entered = signal(), resume = signal();
  const board = await makeBoard(async () => {
    entered.send();
    await resume.received;
    throw new Error('late replay exception');
  });
  const initial = board.save(), attempt = board.accept('accept-A', 'A');
  try {
    await entered.received;
    assert.ok(board.cancel('cancel-A', 'A').ok);
    resume.send();
    assert.equal((await attempt).code, 'CANCELLED');
    assert.equal(board.statusOf('A'), 'cancelled');
    assert.equal(board.state.token, 0);
    assert.deepEqual(board.save(), initial);
  } finally {
    resume.send();
    await Promise.allSettled([attempt]);
  }
});

test('D585 row file authority is rechecked at the commit after native replay', async () => {
  const gate = replayBarrier(), doc = part(), native = await evaluate(doc);
  assert.ok(native.ok);
  const rows = [{ id: 'B1', kind: 'block', size: [125, 85, 25], source: 'Test stock list' }];
  const rowFiles = receivePersonRowFiles('0123456789abcdef01234567', [{ name: 'stock.json', text: JSON.stringify(rows), turn: 1 }], 1);
  const board = new CandidateBoard({ doc, bodies: native.bodies, rowFiles }, evaluate, gate.reopen);
  const initial = board.save();
  assert.ok(board.start({ operationId: 'start-stock', candidate: 'stock', patch: { ops: [
    { tool: 'load_rows', args: { kind: 'stock', file: rowFiles.files[0].id } },
  ] } }).ok);
  const built = await board.run('run-stock', 'stock');
  assert.ok(built.ok, built.message ?? '');
  const attempt = board.accept('accept-stock', 'stock');
  try {
    await Promise.race([gate.entered, attempt.then(() => assert.fail('row accept finished before native replay'))]);
    revokePersonRowFiles(rowFiles);
    gate.release();
    const refused = await attempt;
    assert.equal(refused.code, 'GATE_FAILED');
    assert.match(refused.message ?? '', /ROWS_NOT_FROM_PERSON/);
    assert.equal(board.state.token, 0);
    assert.deepEqual(board.save(), initial);
    assert.equal(board.undo('undo').code, 'NOTHING_TO_UNDO');
  } finally {
    gate.release();
    await Promise.allSettled([attempt]);
  }
});

test('D585 native evaluation cannot mutate the verified accepted snapshot through retained objects', async () => {
  const gate = replayBarrier();
  let retainedDoc: StudioDoc | undefined, retainedBodies: BodyResult[] | undefined;
  const worker: Evaluate = async candidate => {
    const result = await evaluate(candidate);
    const node = candidate.nodes[1];
    if (result.ok && node?.kind === 'extrude' && node.height === 6) {
      retainedDoc = candidate;
      retainedBodies = result.bodies;
    }
    return result;
  };
  const board = await makeBoard(gate.reopen, worker);
  const attempt = board.accept('accept-A', 'A');
  try {
    await gate.entered;
    assert.ok(retainedDoc && retainedBodies);
    const node = retainedDoc.nodes[1];
    assert.equal(node.kind, 'extrude');
    node.height = 20;
    retainedBodies[0].volume = 4000;
    gate.release();
    assert.ok((await attempt).ok);
    assert.equal(await heightOf(board.save()), 6);
    assert.equal(board.volume(), 1200);
  } finally {
    gate.release();
    await Promise.allSettled([attempt]);
  }
});

test('D585 request keys reject non-JSON payloads and keep the original reservation', async () => {
  const board = await makeBoard(inProcessReopen(evaluate), evaluate, part(), false);
  const request = { operationId: 'start-A', candidate: 'A', patch: patch(6) };
  assert.equal(board.start({ ...request, budget: { ops: Infinity } }).code, 'BAD_REQUEST');
  const accepted = board.start({ ...request, budget: { ops: 1 } });
  assert.ok(accepted.ok);
  assert.equal(board.start({ ...request, budget: { ops: NaN } }).code, 'OPERATION_CONFLICT');
  assert.equal(board.start({ ...request, patch: patch(7), budget: { ops: 1 } }).code, 'OPERATION_CONFLICT');
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  assert.equal(board.start({ operationId: 'invalid', candidate: 'C', patch: { ops: [{ tool: 'edit_feature', args: circular }] } }).code, 'BAD_REQUEST');
  assert.equal(board.start({ ...request, budget: { ops: 1 } }).code, 'DUPLICATE');
  assert.equal((await board.run('run-A', 'A')).evidence?.facts.volume, 1200);
});
