// O21: a part's named parameters as core functions (engine/parameters.ts) and the agent's features.parameters action
// (set_parameters) on them: added, set, renamed, bound to a feature's value, removed — all or nothing, then evaluated.
// The codes and texts are the facade's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rectanglePart, type StudioDoc } from '../src/engine/doc';
import { evaluatePart } from '../src/engine/evaluate';
import { addParameters, bindParameter, parameterUses, removeParameter, renameParameter, withParameters } from '../src/engine/parameters';
import { runTool, type ChatState } from '../src/chat/tools';

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function stateOf(doc: StudioDoc): Promise<ChatState> { const r = await evaluate(doc); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return { doc, bodies: r.bodies }; }
const plate = () => rectanglePart(40, 20, 5);
const refused = (f: () => unknown, code: string, message: RegExp) => assert.throws(f, (e: { code?: string; message?: string }) => e.code === code && message.test(e.message ?? ''));

test('O21: add, set, rename and remove, each refusing as the facade does', () => {
  const doc = addParameters(plate(), { T: 5, W: 40 });
  assert.deepEqual(doc.parameters, { T: 5, W: 40 });
  assert.deepEqual(withParameters(doc, { T: 8 }).parameters, { T: 8, W: 40 });
  refused(() => withParameters(doc, { X: 1 }), 'PARAMETER_UNKNOWN', /^\[PARAMETER_UNKNOWN\] no parameter X; the parameters are T, W$/);
  refused(() => withParameters(doc, { T: NaN }), 'VALUE', /^\[VALUE\] T takes a number, not NaN$/);
  refused(() => addParameters(doc, { '1x': 1 }), 'PARAMETER_NAME', /^\[PARAMETER_NAME\] a parameter's name starts with a letter/);
  refused(() => addParameters(doc, { T: 1 }), 'PARAMETER_EXISTS', /^\[PARAMETER_EXISTS\] there is a parameter T already/);
  const renamed = renameParameter(doc, 'T', 'Thick');
  assert.deepEqual(Object.keys(renamed.parameters), ['Thick', 'W'], 'the order kept');
  refused(() => renameParameter(doc, 'T', 'W'), 'PARAMETER_EXISTS', /W already/);
  assert.deepEqual(removeParameter(doc, 'W').parameters, { T: 5 });
});

test('O21: bind a feature\'s value; rename follows the use; remove keeps the value in place', async () => {
  let doc = bindParameter(addParameters(plate(), { T: 5 }), { feature: 1, value: 'h', parameter: 'T' });
  assert.deepEqual((doc.nodes[1] as { height: unknown }).height, { parameter: 'T' });
  assert.equal(parameterUses(doc.nodes, 'T'), 1);
  doc = renameParameter(doc, 'T', 'Thick');
  assert.deepEqual((doc.nodes[1] as { height: unknown }).height, { parameter: 'Thick' });
  const kept = removeParameter(withParameters(doc, { Thick: 7 }), 'Thick');
  assert.equal((kept.nodes[1] as { height: unknown }).height, 7);
  refused(() => bindParameter(doc, { feature: 1, value: 'nope', parameter: 'Thick' }), 'PARAMETER_UNBINDABLE', /can't take a parameter/);
  refused(() => bindParameter(doc, { feature: 9, value: 'h', parameter: 'Thick' }), 'NO_FEATURE', /no feature 9/);
});

test('O21: features.parameters through the agent: add, bind, set — the volume follows; all or nothing', async () => {
  const s = await stateOf(plate());
  const r = await runTool(s, 'set_parameters', { add: { T: 5 }, bind: [{ feature: 1, value: 'h', parameter: 'T' }], set: { T: 8 } }, evaluate);
  assert.ok(!r.isError, r.content);
  assert.ok(Math.abs(r.state.bodies[0].volume! - 40 * 20 * 8) < 1e-6, String(r.state.bodies[0].volume));
  assert.deepEqual(JSON.parse(r.content).parameters, [{ name: 'T', value: 8, uses: 1 }]);
  // (A refusal anywhere: nothing applied.)
  const bad = await runTool(r.state, 'set_parameters', { set: { T: 10 }, remove: ['nope'] }, evaluate);
  assert.ok(bad.isError); assert.match(bad.content, /\[PARAMETER_UNKNOWN\] no parameter nope/);
  assert.equal(bad.state.doc.parameters.T, 8);
  // (A value that does not build: refused by the evaluation, the part unchanged.)
  const zero = await runTool(r.state, 'set_parameters', { set: { T: 0 } }, evaluate);
  assert.ok(zero.isError, zero.content); assert.equal(zero.state.doc.parameters.T, 8);
});
