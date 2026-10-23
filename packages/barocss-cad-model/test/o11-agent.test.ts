import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import type { StudioDoc } from '../src/engine/doc';
import { acceptProposal, runTool, type ChatState } from '../src/chat/tools';
import { annotationsOf } from '../src/chat/contract';
import { plateAndPin, plateMaster } from './o11-fixtures';

// O11's agent side: set_inputs (the assembly's structure — proposed at L1/L2, applied at L3+) and set_variants (values
// only — applied at L2+, proposed at L1), each written to the master's variability alone and checked whole; the inputs,
// the variants and the active one read in query.summary. A refusal is typed and leaves the state as it was.

let revision = 1;
const evaluate = async (d: StudioDoc) => evaluateDoc(d, revision++);
async function stateOf(doc: StudioDoc): Promise<ChatState> { const r = await evaluate(doc); assert.ok(r.ok); return { doc, bodies: r.bodies, turnBase: doc }; }
const parse = (content: string) => JSON.parse(content) as Record<string, any>;
const OFFSET = { type: 'number', unit: 'mm', min: 0, max: 50, default: 5, bindings: [{ to: 'mate', mate: 'm1', field: 'distance' }] };
async function at<T>(level: number, f: () => Promise<T>): Promise<T> {
  const was = process.env.CAD_AUTONOMY; process.env.CAD_AUTONOMY = String(level);
  try { return await f(); } finally { if (was === undefined) delete process.env.CAD_AUTONOMY; else process.env.CAD_AUTONOMY = was; }
}
const master = (doc: StudioDoc) => JSON.stringify({ nodes: doc.nodes, parameters: doc.parameters, instances: doc.instances, mates: doc.mates });

test('O11 agent: set_inputs is proposed at L1 and L2 (refused, the state the same), applied at L3 and L4 — the master untouched', async () => {
  const s = await stateOf(plateAndPin(5));
  for (const level of [1, 2]) {
    const r = await at(level, () => runTool(s, 'set_inputs', { inputs: { offset: OFFSET } }, evaluate));
    assert.ok(r.isError, `L${level}`); assert.equal(r.state, s);
    if (level === 2) assert.equal(parse(r.content).code, 'needs_proposal');
  }
  for (const level of [3, 4]) {
    const r = await at(level, () => runTool(s, 'set_inputs', { inputs: { offset: OFFSET } }, evaluate));
    assert.ok(!r.isError, r.content);
    assert.deepEqual(r.state.doc.variability?.inputs.map(i => i.name), ['offset']);
    assert.equal(master(r.state.doc), master(s.doc), 'only the variability is written');
  }
  // (Proposed at L2, accepted by the user: the inputs applied.)
  const p = await at(2, () => runTool(s, 'propose', { title: 'an offset input', ops: [{ tool: 'set_inputs', args: { inputs: { offset: OFFSET } } }] }, evaluate));
  assert.ok(!p.isError, p.content); assert.deepEqual(parse(p.content).risk.approval, [], 'inputs alone need no approval beyond the level');
  const a = await acceptProposal(p.state, parse(p.content).proposal, evaluate); assert.ok('state' in a, 'error' in a ? a.error : '');
  assert.deepEqual(a.state.doc.variability?.inputs.map(i => i.name), ['offset']);
});

test('O11 agent: set_variants is proposed at L1, applied at L2+; "active" switches; a deleted active variant leaves the master active', async () => {
  const base = plateMaster(), { variants: _v, ...v } = base.variability!; void _v;
  const s = await stateOf({ ...base, variability: v });
  const l1 = await at(1, () => runTool(s, 'set_variants', { variants: { high: { offset: 25 } } }, evaluate));
  assert.ok(l1.isError); assert.equal(l1.state, s);
  for (const level of [2, 3]) {
    const r = await at(level, () => runTool(s, 'set_variants', { variants: { high: { offset: 25 }, low: { offset: 1 } }, active: 'high' }, evaluate));
    assert.ok(!r.isError, `L${level}: ${r.content}`);
    assert.equal(r.state.doc.variability?.active, 'high'); assert.equal(master(r.state.doc), master(s.doc));
    const gone = await at(level, () => runTool(r.state, 'set_variants', { variants: { high: null } }, evaluate));
    assert.ok(!gone.isError, gone.content);
    assert.equal(gone.state.doc.variability?.active, undefined); assert.match(parse(gone.content).did, /deleted high, the master active/);
    assert.deepEqual(gone.state.doc.variability?.variants?.map(x => x.name), ['low']);
  }
});

test('O11 agent: refusals are typed and name what they refer to; the state stays the same', async () => {
  const s = await stateOf(plateMaster());
  const cases: [string, Record<string, unknown>, RegExp][] = [
    ['set_inputs', { inputs: { gap: { ...OFFSET, bindings: [{ to: 'mate', mate: 'm9', field: 'distance' }] } } }, /^\[INPUT_TARGET\] gap: no mate m9/],
    ['set_inputs', { inputs: { gap: { ...OFFSET } } }, /^\[INPUT_CONFLICT\] mate m1's distance is driven by offset and gap/],
    ['set_inputs', { inputs: { offset: { ...OFFSET, default: 9 } } }, /^\[INPUT_DEFAULT\] mate m1's distance is 5, but offset's default is 9/],
    ['set_inputs', { inputs: { flag: { type: 'boolean', default: false, bindings: [{ to: 'mate', mate: 'm1', field: 'angle' }] } } }, /^\[INPUT_TYPE\] flag \(boolean\) cannot drive a mate value/],
    ['set_inputs', { inputs: { offset: null } }, /^\[INPUT_NAME\] variant high: no input offset/],
    ['set_inputs', { inputs: { x: { type: 'size' } } }, /^\[INPUT_TYPE\] x: "type" is number, boolean or choice/],
    ['set_variants', { variants: { far: { offset: 80 } } }, /^\[INPUT_RANGE\] variant far: offset = 80: a number from 0 to 50 mm/],
    ['set_variants', { variants: { far: { reach: 3 } } }, /^\[INPUT_NAME\] variant far: no input reach/],
    ['set_variants', { active: 'mid' }, /^\[VARIANT_UNKNOWN\] no variant mid \(variants: high, low\)/],
    ['set_variants', { variants: { mid: null } }, /^\[VARIANT_UNKNOWN\] no variant mid to delete/],
  ];
  for (const [name, args, want] of cases) {
    const r = await at(4, () => runTool(s, name, args, evaluate));
    assert.ok(r.isError, `${name} ${JSON.stringify(args)}`); assert.match(parse(r.content).error, want); assert.equal(r.state, s);
  }
});

test('O11 agent: query.summary reads the inputs, the variants and the active one; the actions are classified and idempotent', async () => {
  let s = await stateOf(plateMaster());
  s = (await at(2, () => runTool(s, 'set_variants', { active: 'low' }, evaluate))).state;
  const out = parse((await runTool(s, 'query', { action: 'summary' }, evaluate)).content);
  assert.deepEqual(out.variability, { inputs: [{ name: 'offset', type: 'number', default: 5, unit: 'mm', min: 0, max: 50, drives: ['m1.distance'] }],
    variants: [{ name: 'high', values: { offset: 25 } }, { name: 'low', values: { offset: 1 } }], active: 'low' });
  for (const n of ['set_inputs', 'set_variants']) assert.deepEqual([annotationsOf(n).readOnlyHint, annotationsOf(n).idempotentHint], [false, true]);
  // (Through the v2 group: assembly.inputs and assembly.variants.)
  const v2 = await at(3, () => runTool(s, 'assembly', { action: 'variants', active: null }, evaluate));
  assert.ok(!v2.isError, v2.content); assert.equal(v2.state.doc.variability?.active, undefined);
});
