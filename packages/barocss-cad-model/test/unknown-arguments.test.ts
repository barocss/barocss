import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, TOOLS, unknownArguments, type ChatState } from '../src/chat/tools';

// A9-3: an argument a tool does not take is refused, typed and named, with what the tool takes — never dropped while
// the call says ok (A9's probe: drawing.set {weldSymbols, balloons} answered ok and set nothing; query.manufacturability
// {part} judged the base part). The part tools take `part`; a tool whose schema takes any argument is not checked.
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const blank = () => ({ doc: emptyDoc(), bodies: [], turnBase: emptyDoc() }) as never as ChatState;
const errorOf = (content: string) => String((JSON.parse(content) as { error: string }).error);

test('A9-3: drawing.set {weldSymbols} and query.manufacturability {part} refused, named; the part unchanged; a known argument still runs', async () => {
  const s0 = blank(), built = await dispatchTool(s0, 'features', { action: 'command', command: 'box', values: { w: 20, d: 20, h: 10, x: 0, y: 0, z: 0 } }, evaluate);
  assert.ok(!built.isError, built.content);
  const s = built.state;
  const d = await dispatchTool(s, 'drawing', { action: 'set', sheet: 'A3', weldSymbols: true, balloons: true }, evaluate);
  assert.ok(d.isError);
  assert.equal(errorOf(d.content), '[UNKNOWN_ARGUMENT] drawing.set takes no "weldSymbols", "balloons": its arguments are sheet, scale, projection, front, views, tolerancing, title, part.');
  assert.equal(d.state, s, 'nothing applied');
  const m = await dispatchTool(s, 'query', { action: 'manufacturability', part: 'p1' }, evaluate);
  assert.ok(m.isError && /^\[UNKNOWN_ARGUMENT\] query\.manufacturability takes no "part": .* It works on the whole document, not one part\.$/.test(errorOf(m.content)), m.content);
  // (The v1 name is refused the same way; the part tools take `part`.)
  const v1 = await dispatchTool(s, 'measure', { a: 'n1.top', b: 'n1.bottom', units: 'in' }, evaluate);
  assert.ok(v1.isError && /^\[UNKNOWN_ARGUMENT\] query\.measure takes no "units"/.test(errorOf(v1.content)), v1.content);
  assert.equal(unknownArguments('run_command', { command: 'box', part: 'p1' }), null);
  const ok = await dispatchTool(s, 'drawing', { action: 'set', sheet: 'A3' }, evaluate);
  assert.ok(!ok.isError, ok.content);
});

test('A9-3: every tool whose schema closes its arguments is checked; one whose schema takes any is not', () => {
  const closed = TOOLS.filter(t => (t.input_schema as { additionalProperties?: unknown }).additionalProperties === false);
  assert.ok(closed.length > 60, String(closed.length));
  for (const t of closed) assert.match(String(unknownArguments(t.name, { zzz_not_an_argument: 1 })), /^\[UNKNOWN_ARGUMENT\] .* takes no "zzz_not_an_argument"/, t.name);
  for (const t of TOOLS.filter(x => !closed.includes(x))) assert.equal(unknownArguments(t.name, { zzz_not_an_argument: 1 }), null, t.name);
});
