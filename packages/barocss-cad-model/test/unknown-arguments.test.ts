import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { acceptProposal, dispatchTool, runTool, TOOLS, unknownArguments, type ChatState } from '../src/chat/tools';

// A9-3: an argument a tool does not take is refused, typed and named, with what the tool takes — never dropped while
// the call says ok. A9-4 now supports drawing.set weldSymbols/balloons; real typos still refuse.
// The part tools take `part`; a tool whose schema takes any argument is not checked.
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const blank = () => ({ doc: emptyDoc(), bodies: [], turnBase: emptyDoc() }) as never as ChatState;
const errorOf = (content: string) => String((JSON.parse(content) as { error: string }).error);

test('A9-3: drawing.set typo and assembly.get {part} refused, named; the part unchanged; a known argument still runs', async () => {
  const s0 = blank(), built = await dispatchTool(s0, 'features', { action: 'command', command: 'box', values: { w: 20, d: 20, h: 10, x: 0, y: 0, z: 0 } }, evaluate);
  assert.ok(!built.isError, built.content);
  const s = built.state;
  const d = await dispatchTool(s, 'drawing', { action: 'set', sheet: 'A3', weldSymobls: true }, evaluate);
  assert.ok(d.isError);
  assert.match(errorOf(d.content), /^\[UNKNOWN_ARGUMENT\] drawing\.set takes no "weldSymobls": its arguments are /);
  assert.match(errorOf(d.content), /\bweldSymbols\b/, 'supported setting is listed among the arguments');
  assert.equal(d.state, s, 'nothing applied');
  const m = await dispatchTool(s, 'assembly', { action: 'get', part: 'p1' }, evaluate);
  assert.ok(m.isError && /^\[UNKNOWN_ARGUMENT\] assembly\.get takes no "part": .* It works on the whole document, not one part\.$/.test(errorOf(m.content)), m.content);
  // (The v1 name is refused the same way; the part tools take `part`.)
  const v1 = await dispatchTool(s, 'measure', { a: 'n1.top', b: 'n1.bottom', units: 'in' }, evaluate);
  assert.ok(v1.isError && /^\[UNKNOWN_ARGUMENT\] query\.measure takes no "units"/.test(errorOf(v1.content)), v1.content);
  assert.equal(unknownArguments('run_command', { command: 'box', part: 'p1' }), null);
  const ok = await dispatchTool(s, 'drawing', { action: 'set', sheet: 'A3' }, evaluate);
  assert.ok(!ok.isError, ok.content);
});

test('A9-4 supported weldSymbols and balloons validate strictly and still need user approval', async () => {
  const built = await dispatchTool(blank(), 'features', { action: 'command', command: 'box', values: { w: 20, d: 20, h: 10, x: 0, y: 0, z: 0 } }, evaluate);
  assert.ok(!built.isError, built.content);
  const s = built.state, before = JSON.stringify(s.doc), args = { action: 'set', weldSymbols: true, balloons: true };
  assert.equal(unknownArguments('set_drawing', { weldSymbols: true, balloons: true }), null);
  const invalid = await dispatchTool(s, 'drawing', { ...args, weldSymbols: 'true' }, evaluate);
  assert.ok(invalid.isError && /\[DRAWING_OPTIONS\]/.test(errorOf(invalid.content)), invalid.content);
  assert.equal(invalid.state, s);
  const direct = await runTool(s, 'drawing', args, evaluate);
  assert.ok(direct.isError && JSON.parse(direct.content).code === 'needs_approval', direct.content);
  assert.equal(JSON.stringify(direct.state.doc), before);
  const proposed = await runTool(s, 'proposals', { action: 'propose', title: 'Drawing flags', ops: [{ tool: 'drawing', args }] }, evaluate);
  assert.ok(!proposed.isError, proposed.content);
  assert.equal(proposed.state.doc.drawing, s.doc.drawing, 'flags stay pending before approval');
  const id = proposed.state.doc.proposals!.at(-1)!.id;
  const accepted = await acceptProposal(proposed.state, id, evaluate);
  assert.ok(!('error' in accepted), JSON.stringify(accepted));
  assert.equal(accepted.state.doc.drawing?.weldSymbols, true);
  assert.equal(accepted.state.doc.drawing?.balloons, true);
  assert.deepEqual(accepted.state.doc.drawing?.scope, { kind: 'part' });
});

test('A9-3: every tool whose schema closes its arguments is checked; one whose schema takes any is not', () => {
  const closed = TOOLS.filter(t => (t.input_schema as { additionalProperties?: unknown }).additionalProperties === false);
  assert.ok(closed.length > 60, String(closed.length));
  for (const t of closed) assert.match(String(unknownArguments(t.name, { zzz_not_an_argument: 1 })), /^\[UNKNOWN_ARGUMENT\] .* takes no "zzz_not_an_argument"/, t.name);
  for (const t of TOOLS.filter(x => !closed.includes(x))) assert.equal(unknownArguments(t.name, { zzz_not_an_argument: 1 }), null, t.name);
});
