import assert from 'node:assert/strict';
import test from 'node:test';
import { runTool, type ChatState, type Evaluate, type ToolOutcome } from '../src/chat/tools';
import { rectanglePart, type StudioDoc } from '../src/engine/doc';
import { evaluatePart } from '../src/engine/evaluate';
import { sketchDxf } from '../src/sketch/dxf';

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const scale = { action: 'command', command: 'scale', bodies: ['b1'], values: { factor: 1.5, px: 0, py: 0, pz: 0 } };

async function plate(depth: number, thickness: number): Promise<ChatState> {
  const doc = rectanglePart(40, depth, thickness);
  const built = await evaluate(doc);
  assert.ok(built.ok);
  const set = await runTool({ doc, bodies: built.bodies }, 'requirements', {
    action: 'set',
    requirements: [{
      id: 'L',
      source: '40 mm long',
      hard: true,
      check: { op: '==', query: { fn: 'bbox', axis: 'x' }, value: 40, tol: 0.1 },
    }],
  }, evaluate);
  assert.equal(set.isError, false, set.content);
  const checked = await runTool(set.state, 'requirements', { action: 'check' }, evaluate);
  assert.equal(checked.isError, false, checked.content);
  assert.deepEqual(checked.state.policy?.passedHard, ['L']);
  return checked.state;
}

function signal() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

function pauseEvaluation(when: (doc: StudioDoc) => boolean = () => true) {
  const reached = signal();
  const release = signal();
  let paused = false;
  const gated: Evaluate = async doc => {
    if (!paused && when(doc)) {
      paused = true;
      reached.resolve();
      await release.promise;
    }
    return evaluate(doc);
  };
  return { evaluate: gated, reached: reached.promise, release: release.resolve };
}

async function waitForEvaluation(gate: ReturnType<typeof pauseEvaluation>, outcome: Promise<ToolOutcome>) {
  await Promise.race([gate.reached, outcome.then(out => assert.fail(`Tool completed before its evaluation paused: ${out.content}`))]);
}

for (const justifiedFirst of [false, true]) {
  for (const finishFirst of [false, true]) {
    test(`overlapping scale calls keep their own reason (justified starts ${justifiedFirst ? 'first' : 'second'}, first call finishes ${finishFirst ? 'first' : 'second'})`, { timeout: 5000 }, async () => {
      const protectedPlate = await plate(20, 8);
      const otherPlate = await plate(12, 5);
      const calls = [
        { state: protectedPlate, gate: pauseEvaluation(), args: { ...scale, response_format: 'detailed' } },
        { state: otherPlate, gate: pauseEvaluation(), args: { ...scale, because: 'test a larger plate', response_format: 'concise' } },
      ];
      const [first, second] = justifiedFirst ? [calls[1], calls[0]] : calls;
      const start = (call: typeof first) => runTool(call.state, 'features', call.args, call.gate.evaluate);
      const a = start(first);
      try {
        await waitForEvaluation(first.gate, a);
        const b = start(second);
        await waitForEvaluation(second.gate, b);
        const [early, late] = finishFirst ? [first, second] : [second, first];
        early.gate.release();
        await (finishFirst ? a : b);
        late.gate.release();
        const [outA, outB] = await Promise.all([a, b]);
        const [refused, accepted] = justifiedFirst ? [outB, outA] : [outA, outB];

        assert.equal(refused.isError, true, refused.content);
        assert.equal(refused.changed, false);
        assert.strictEqual(refused.state, protectedPlate);
        assert.match(JSON.parse(refused.content).error, /breaks hard requirement that passed: L \("40 mm long": measured 60/);
        assert.equal(accepted.isError, false, accepted.content);
        assert.equal(accepted.changed, true);
        const result = JSON.parse(accepted.content);
        assert.deepEqual(result.facts.bbox.max, [60, 18, 7.5]);
        assert.equal(Object.hasOwn(result, 'bodies'), false);
      } finally {
        first.gate.release();
        second.gate.release();
      }
    });
  }
}

for (const conciseFirst of [false, true]) {
  test(`overlapping successful edits keep their own response format (concise starts ${conciseFirst ? 'first' : 'second'})`, { timeout: 5000 }, async () => {
    const concise = { state: await plate(20, 8), gate: pauseEvaluation(), args: { action: 'edit', index: 1, values: { h: 9 }, response_format: 'concise' } };
    const detailed = { state: await plate(12, 5), gate: pauseEvaluation(), args: { action: 'edit', index: 1, values: { h: 6 }, response_format: 'detailed' } };
    const [first, second] = conciseFirst ? [concise, detailed] : [detailed, concise];
    const a = runTool(first.state, 'features', first.args, first.gate.evaluate);
    try {
      await waitForEvaluation(first.gate, a);
      const b = runTool(second.state, 'features', second.args, second.gate.evaluate);
      await waitForEvaluation(second.gate, b);
      second.gate.release();
      await b;
      first.gate.release();
      const [outA, outB] = await Promise.all([a, b]);
      const [compact, full] = conciseFirst ? [outA, outB] : [outB, outA];
      assert.equal(compact.isError, false, compact.content);
      assert.equal(full.isError, false, full.content);
      const compactResult = JSON.parse(compact.content);
      const fullResult = JSON.parse(full.content);
      assert.deepEqual(compactResult.facts.bbox.max, [40, 20, 9]);
      assert.deepEqual(fullResult.facts.bbox.max, [40, 12, 6]);
      assert.equal(Object.hasOwn(compactResult, 'bodies'), false);
      assert.equal(fullResult.bodies[0].faces.length, 6);
      assert.equal(fullResult.bodies[0].edges.length, 12);
    } finally {
      first.gate.release();
      second.gate.release();
    }
  });
}

test('an overlapping reason cannot authorize a nested batch operation', { timeout: 5000 }, async () => {
  const state = await plate(20, 8);
  const independent = await plate(12, 5);
  const gate = pauseEvaluation(doc => doc.nodes.at(-1)?.kind === 'scale');
  const batch = runTool(state, 'features', {
    action: 'batch',
    ops: [
      { tool: 'features', args: { action: 'edit', index: 1, values: { h: 9 } } },
      { tool: 'features', args: scale },
    ],
  }, gate.evaluate);
  try {
    await waitForEvaluation(gate, batch);
    const accepted = await runTool(independent, 'features', { ...scale, because: 'test a larger plate' }, evaluate);
    assert.equal(accepted.isError, false, accepted.content);
    gate.release();
    const result = await batch;
    assert.equal(result.isError, true, result.content);
    assert.equal(result.changed, false);
    assert.strictEqual(result.state, state);
    const reply = JSON.parse(result.content);
    assert.equal(reply.failed_op, 1);
    assert.equal(reply.kept, 'nothing was applied');
    assert.match(reply.error, /breaks hard requirement that passed: L/);
  } finally {
    gate.release();
  }
});

test('drawing import uses its own default response format after a concise query', async () => {
  const state = await plate(20, 8);
  const concise = await runTool(state, 'query', { action: 'summary', response_format: 'concise' }, evaluate);
  assert.equal(concise.isError, false, concise.content);
  assert.equal(Object.hasOwn(JSON.parse(concise.content).bodies[0], 'faces'), false);

  const { text } = sketchDxf({ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 5] }, {});
  const imported = await runTool(concise.state, 'requirements', { action: 'drawing', dxf: text, name: 'plate outline' }, evaluate);
  assert.equal(imported.isError, false, imported.content);
  assert.equal(imported.changed, true);
  assert.equal(imported.state.doc.nodes.length, state.doc.nodes.length + 1);
  const reply = JSON.parse(imported.content);
  assert.deepEqual(reply.dims.map(({ value }: { value: number }) => value), [10, 5]);
  assert.equal(reply.bodies?.[0].faces.length, 6);
  assert.equal(reply.bodies?.[0].edges.length, 12);
});

test('legacy calls ignore hidden or inherited override options', async () => {
  const state = await plate(20, 8);
  const { command, bodies, values } = scale;
  const args = { command, bodies, values };
  const hidden = Object.defineProperty({ ...args }, 'because', { value: 'hidden reason' });
  const inherited = Object.assign(Object.create({ because: 'inherited reason' }), args);
  for (const input of [hidden, inherited]) {
    const refused = await runTool(state, 'run_command', input, evaluate);
    assert.equal(refused.isError, true, refused.content);
    assert.equal(refused.changed, false);
    assert.strictEqual(refused.state, state);
    assert.match(JSON.parse(refused.content).error, /breaks hard requirement that passed: L/);
  }

  const withReason = Object.defineProperty({ ...args, because: 'explicit trial' }, 'response_format', { value: 'concise' });
  const accepted = await runTool(state, 'run_command', withReason, evaluate);
  assert.equal(accepted.isError, false, accepted.content);
  const reply = JSON.parse(accepted.content);
  assert.deepEqual(reply.facts.bbox.max, [60, 30, 12]);
  assert.equal(reply.bodies[0].faces.length, 6);
});

test('a script passes its own reason to nested edits during an overlapping call', { timeout: 5000 }, async () => {
  const state = await plate(20, 8);
  const independent = await plate(12, 5);
  const source = [
    'edit(node(1), {h: 9})',
    'scale(node(1), {factor: 1.5, px: 0, py: 0, pz: 0})',
  ].join('\n');
  const gate = pauseEvaluation(doc => doc.nodes.at(-1)?.kind === 'scale');
  const script = runTool(state, 'model', { action: 'run', source, because: 'test a larger plate' }, gate.evaluate);
  try {
    await waitForEvaluation(gate, script);
    const query = await runTool(independent, 'query', { action: 'summary', response_format: 'detailed' }, evaluate);
    assert.equal(query.isError, false, query.content);
    assert.equal(JSON.parse(query.content).bodies[0].faces.length, 6);
    gate.release();
    const accepted = await script;
    assert.equal(accepted.isError, false, accepted.content);
    assert.equal(accepted.changed, true);
    const reply = JSON.parse(accepted.content);
    assert.deepEqual(reply.facts.bbox.max, [60, 30, 13.5]);
    assert.deepEqual(reply.calls.map(({ line }: { line: number }) => line), [1, 2]);

    const refused = await runTool(state, 'model', { action: 'run', source }, evaluate);
    assert.equal(refused.isError, true, refused.content);
    assert.equal(refused.changed, false);
    assert.strictEqual(refused.state, state);
    const failure = JSON.parse(refused.content);
    assert.deepEqual([failure.code, failure.line, failure.kept], ['script_refused', 2, 'nothing was applied']);
    assert.match(failure.error, /breaks hard requirement that passed: L/);
  } finally {
    gate.release();
  }
});
