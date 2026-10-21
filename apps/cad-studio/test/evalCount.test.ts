import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { rectanglePart, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { runTool, type ChatState } from '@barocss/cad-model/chat/tools';

// PERF3 A3 (D82): how many evaluations an agent's batch costs. A block with four filleted corners (references by name)
// and two hard requirements that pass; five holes added in one apply_ops.
let calls = 0;
const evaluate = async (doc: StudioDoc) => { calls++; return evaluatePart(doc, 1); };
const parse = (content: string) => JSON.parse(content) as { applied?: unknown[]; proposal?: string };

test('an apply_ops of five holes on a filleted block with hard requirements: the evaluations it costs', async () => {
  let doc = rectanglePart(60, 40, 10);
  doc = { ...doc, requirements: [
    { id: 'R1', source: 'at most 100 long', hard: true, basis: 'stated', check: { op: '<=', query: { fn: 'bbox', axis: 'x' }, value: 100 } },
    { id: 'R2', source: 'some volume', hard: true, basis: 'stated', check: { op: '>=', query: { fn: 'volume' }, value: 1 } },
  ] } as StudioDoc;
  const r0 = await evaluate(doc); assert.ok(r0.ok);
  let s: ChatState = { doc, bodies: r0.ok ? r0.bodies : [] };
  // The four vertical corners filleted (each a reference by name).
  const corners = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => ({ between: [{ normal: [a, 0, 0] }, { normal: [0, b, 0] }] }));
  const f = await runTool(s, 'apply_ops', { ops: corners.map((e, k) => ({ tool: 'run_command', opId: `f${k}`, args: { command: 'fillet', edges: [e], values: { radius: 1 } } })) }, evaluate);
  assert.ok(!f.isError, f.content); s = { ...f.state, policy: { passedHard: ['R1', 'R2'] } } as ChatState;
  calls = 0;
  const holes = [10, 20, 30, 40, 50].map((x, k) => ({ tool: 'run_command', opId: `h${k}`, args: { command: 'hole', faces: ['n1.bottom'], values: { d: 3, x, y: 20 } } }));
  const r = await runTool(s, 'apply_ops', { ops: holes }, evaluate);
  assert.ok(!r.isError, r.content); assert.equal(parse(r.content).applied?.length, 5);
  // One per op (a later op names faces of the body the one before left); the reference check's prefixes (one per
  // fillet, unchanged) are the ones the fillets' batch evaluated: 9 before.
  assert.equal(calls, 5);
});

test('a proposal of five holes, then accepted by the agent: the evaluations each costs', async () => {
  const was = process.env.CAD_AUTONOMY; process.env.CAD_AUTONOMY = '4';
  try {
    let doc = rectanglePart(60, 40, 10);
    doc = { ...doc, requirements: [{ id: 'R1', source: 'at most 100 long', hard: true, basis: 'stated', check: { op: '<=', query: { fn: 'bbox', axis: 'x' }, value: 100 } }] } as StudioDoc;
    const r0 = await evaluate(doc); assert.ok(r0.ok);
    const s: ChatState = { doc, bodies: r0.ok ? r0.bodies : [] };
    const holes = [10, 20, 30, 40, 50].map((x, k) => ({ tool: 'run_command', opId: `h${k}`, args: { command: 'hole', faces: ['n1.bottom'], values: { d: 3, x, y: 20 } } }));
    calls = 0;
    const p = await runTool(s, 'propose', { title: 'Five holes', ops: holes }, evaluate);
    assert.ok(!p.isError, p.content);
    const proposed = calls; calls = 0;
    const a = await runTool(p.state, 'accept_proposal', { id: parse(p.content).proposal }, evaluate);
    assert.ok(!a.isError, a.content); assert.equal(a.state.doc.nodes.length, 7);
    // (Accepting runs the same ops on the same part: the proposal's evaluations; 5 before.)
    assert.equal(proposed, 5); assert.equal(calls, 0);
  } finally { if (was === undefined) delete process.env.CAD_AUTONOMY; else process.env.CAD_AUTONOMY = was; }
});
