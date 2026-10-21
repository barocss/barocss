import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, starterDoc, type StudioDoc } from '../src/engine/doc';
import { acceptProposal, dispatchTool, runTool, SYSTEM_PROMPT, TOOLS, type ChatState } from '../src/chat/tools';
import { GROUPS, V1_OF, V2_ALIASES, V2_OF, v1Call, v2Result, v2Text, viaV2 } from '../src/chat/groups';
import { listed, SYSTEM_PROMPT_V2, TOOLS_V2 } from '../src/chat/toolset';
import { TOOL_CONTRACT_V2, breakingChanges, contractOf, type ContractEntry } from '../src/chat/contract';

// A5.3 (O11): the consolidated tools (`barocss-cad-tools-v2`) — 13 tools whose actions are the handlers; `describe` for
// the detail; the same gates; ops kept as handler calls; frozen in tools-v2.json. O105 (the owner, 2026-10-21: "우리는
// 릴리즈 한게 아니라서 toolset v1 은 없어도 돼"): the only list the MCP and chat servers serve, at most 25,000 characters a
// turn (tools/list + the system prompt). (The whole suite also replays through v2: CAD_TOOLS_VIA_V2=1.)

const FROZEN = resolve(resolve(import.meta.dirname, '..'), 'src/chat/tools-v2.json');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const read = (content: string) => JSON.parse(content) as Record<string, any>;
async function stateOf(doc: StudioDoc): Promise<ChatState> { const r = await evaluate(doc); assert.ok(r.ok); return { doc, bodies: r.bodies }; }

test('what a model reads every turn (O105): tools/list and the system prompt, at most 25,000 characters', () => {
  const list = JSON.stringify(TOOLS_V2.map(listed)).length, turn = list + SYSTEM_PROMPT_V2.length;
  console.log(`v2: ${TOOLS_V2.length} tools, tools/list ${list} characters, system prompt ${SYSTEM_PROMPT_V2.length}; per turn ${turn} (cap 25000)`);
  assert.equal(TOOLS_V2.length, 13);
  assert.ok(turn <= 25000, `${turn} characters a turn`);
  assert.ok(SYSTEM_PROMPT_V2.length < SYSTEM_PROMPT.length + 400, 'the v2 prompt only renames the handlers\' prompt and adds one line');
});

test('every handler is exactly one v2 action, and the v2 prompt names only v2 tools', () => {
  assert.deepEqual([...V2_OF.keys()].sort(), TOOLS.map(t => t.name).sort());
  // (Each alias names a tool another action stands for: print.check is query.manufacturability's, O77.)
  assert.equal(V1_OF.size, TOOLS.length + V2_ALIASES.size);
  for (const a of V2_ALIASES) assert.ok(V1_OF.has(a) && V2_OF.get(V1_OF.get(a)!) !== a, a);
  assert.equal(V2_OF.get('check_printability'), 'query.manufacturability');
  for (const name of Object.keys(GROUPS)) assert.ok(!TOOLS.some(t => t.name === name), `${name} is not also a handler's name`);
  // (No handler name with an underscore is left in the v2 prompt, and every group.action it names exists.)
  assert.deepEqual(SYSTEM_PROMPT_V2.match(/(?<![.\w])[a-z]+(?:_[a-z]+)+\b/g)?.filter(w => V2_OF.has(w)) ?? [], []);
  for (const m of SYSTEM_PROMPT_V2.matchAll(/\b([a-z]+)\.([a-z_]+)\b/g)) if (m[1] in GROUPS) assert.ok(V1_OF.has(`${m[1]}.${m[2]}`), m[0]);
  assert.match(SYSTEM_PROMPT_V2, /query\.mass, query\.interference \(overlap and clearance\), query\.section, query\.wall and query\.draft/);
  assert.match(SYSTEM_PROMPT_V2, /propose it \(proposals\.propose\)/);
  assert.match(SYSTEM_PROMPT_V2, /When the user asks for options or a review, or a change is risky, propose it/, 'the English word stays');
  // The model tool's description names v2 tools too.
  assert.ok(!/apply_ops|run_command/.test(TOOLS_V2.find(t => t.name === 'model')!.description));
});

test('the v2 contract is frozen in tools-v2.json; a breaking change needs v3', () => {
  const now = contractOf(TOOLS_V2);
  if (process.env.UPDATE_TOOL_CONTRACT) {
    let before: ContractEntry[] = []; try { before = JSON.parse(readFileSync(FROZEN, 'utf8')).tools; } catch { /* first record */ }
    assert.deepEqual(breakingChanges(before, now), [], 'breaking changes need barocss-cad-tools-v3, not a rewrite');
    writeFileSync(FROZEN, JSON.stringify({ contract: TOOL_CONTRACT_V2, tools: now }, null, 1) + '\n');
  }
  const frozen = JSON.parse(readFileSync(FROZEN, 'utf8')) as { contract: string; tools: ContractEntry[] };
  assert.equal(frozen.contract, TOOL_CONTRACT_V2);
  assert.deepEqual(breakingChanges(frozen.tools, now), []);
  assert.deepEqual(now, frozen.tools, 'a compatible change: record it (UPDATE_TOOL_CONTRACT=1)');
  // (Removing an action narrows its enum: breaking.)
  const fewer = JSON.parse(JSON.stringify(now)) as ContractEntry[];
  (fewer.find(e => e.name === 'query')!.input as { properties: { action: { enum: string[] } } }).properties.action.enum.pop();
  assert.match(breakingChanges(now, fewer).join(), /query input\.action: enum narrowed/);
  // The annotations: query and describe read only; a group with any destructive action is destructive.
  const by = new Map(now.map(e => [e.name, e.annotations]));
  assert.deepEqual([by.get('query')!.readOnlyHint, by.get('describe')!.readOnlyHint, by.get('features')!.destructiveHint, by.get('library')!.destructiveHint], [true, true, true, false]);
});

test('a v2 call is the handler\'s call: the same result; an unknown or missing action refused with the actions', async () => {
  const s = await stateOf(starterDoc());
  for (const [v2, args, v1] of [['query', { action: 'measure', a: 'n1.top' }, 'measure'], ['query', { action: 'mass' }, 'mass_properties'], ['query', { action: 'summary' }, 'get_part_summary'], ['drawing', { action: 'issues' }, 'drawing_issues']] as const) {
    const rest = Object.fromEntries(Object.entries(args).filter(([k]) => k !== 'action'));
    const a = await dispatchTool(s, v2, args, evaluate), b = await dispatchTool(s, v1, rest, evaluate);
    assert.equal(a.content, b.content, `${v2}.${String(args.action)}`);
  }
  const edited = await dispatchTool(s, 'features', { action: 'edit', index: 1, values: { h: 12 } }, evaluate), direct = await dispatchTool(s, 'edit_feature', { index: 1, values: { h: 12 } }, evaluate);
  assert.ok(edited.changed); assert.deepEqual(edited.state.doc.nodes, direct.state.doc.nodes);
  // model takes its one action unsaid.
  const built = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'model', { source: 'box({w: 10, d: 10, h: 10})' }, evaluate);
  assert.ok(!built.isError && built.state.doc.nodes.length === 2, built.content);
  assert.match(read((await dispatchTool(s, 'query', { action: 'weigh' }, evaluate)).content).error, /query takes "action": one of summary, inspect, measure/);
  assert.match(read((await dispatchTool(s, 'subd', {}, evaluate)).content).error, /subd takes "action"/);
  assert.deepEqual(v1Call('history', { action: 'best' }), { name: 'restore_best', args: {} });
  assert.equal(v1Call('measure', {}), null, 'a handler\'s name is not translated');
});

test('describe: the tools, a tool\'s actions, an action\'s handler schema, a command\'s values, a feature kind\'s JSON', async () => {
  const s = await stateOf(starterDoc());
  const d = async (args: object) => { const r = await dispatchTool(s, 'describe', args, evaluate); return { ...read(r.content), isError: r.isError, changed: r.changed } as Record<string, any>; };
  const all = await d({});
  assert.deepEqual(Object.keys(all.tools).sort(), Object.keys(GROUPS).filter(n => n !== 'describe').sort());
  assert.equal(all.changed, false);
  assert.equal((await d({ tool: 'subd' })).actions.insert_loop, 'index, edge, t?');
  const m = await d({ tool: 'query', action: 'measure' });
  assert.deepEqual([m.description, m.input], [TOOLS.find(t => t.name === 'measure')!.description, TOOLS.find(t => t.name === 'measure')!.input_schema]);
  const hole = await d({ command: 'hole' });
  assert.ok(hole.selection && /d:/.test(Object.entries(hole.values).map(([k, v]) => `${k}: ${v}`).join('; ')), JSON.stringify(hole));
  assert.equal((await d({ command: 'linear_pattern' })).command, 'linear-pattern');
  const ex = await d({ feature: 'extrude' });
  assert.ok(ex.nodes.some((l: string) => l.includes('"kind":"extrude"')));
  for (const bad of [{ tool: 'nope' }, { tool: 'query', action: 'nope' }, { command: 'nope' }, { feature: 'nope' }]) assert.ok((await d(bad)).isError, JSON.stringify(bad));
  // Every feature kind and command the features tool lists can be described.
  const features = TOOLS_V2.find(t => t.name === 'features')!.description;
  for (const k of /Feature kinds: ([^.]+)\./.exec(features)![1].split(', ')) assert.ok(!(await d({ feature: k })).isError, k);
  for (const c of /Commands: ([^.]+)\./.exec(features)![1].split(', ')) assert.ok(!(await d({ command: c })).isError, c);
});

test('the same gates through v2: L2 refuses an addition on a built part; ops naming v2 tools are kept as handler calls and replay', async () => {
  const s = await stateOf(starterDoc());
  const add = { action: 'command', command: 'cylinder', values: { r: 2, h: 5, x: 90, y: 0 } };
  const direct = await runTool({ ...s, turnBase: s.doc }, 'features', add, evaluate);
  assert.equal(read(direct.content).code, 'needs_proposal', direct.content);
  const p = await runTool({ ...s, turnBase: s.doc }, 'proposals', { action: 'propose', title: 'a peg', ops: [{ tool: 'features', args: add }] }, evaluate);
  assert.ok(!p.isError, p.content);
  const kept = p.state.doc.proposals!.at(-1)!;
  assert.deepEqual(kept.ops.map(o => o.tool), ['run_command'], 'kept as the handler call');
  assert.equal((kept.ops[0].args as { action?: string }).action, undefined);
  const accepted = await acceptProposal(p.state, kept.id, evaluate);
  assert.ok('state' in accepted && accepted.state.doc.nodes.length === s.doc.nodes.length + 2);
  // A batch of v2 ops, all or nothing.
  const batch = await dispatchTool(s, 'features', { action: 'batch', ops: [{ tool: 'features', args: { action: 'edit', index: 1, values: { h: 14 } } }, { tool: 'features', args: add }] }, evaluate);
  assert.ok(!batch.isError, batch.content);
});

test('the replay hook: CAD_TOOLS_VIA_V2=1 sends every handler call as its v2 call', () => {
  const was = process.env.CAD_TOOLS_VIA_V2;
  try {
    process.env.CAD_TOOLS_VIA_V2 = '1';
    assert.deepEqual(viaV2('measure', { a: 'n1.top' }), ['query', { a: 'n1.top', action: 'measure' }]);
    assert.deepEqual(viaV2('apply_ops', undefined), ['features', { action: 'batch' }]);
    assert.deepEqual(viaV2('query', { action: 'mass' }), ['query', { action: 'mass' }], 'a v2 call as it is');
    delete process.env.CAD_TOOLS_VIA_V2;
    assert.deepEqual(viaV2('measure', { a: 1 }), ['measure', { a: 1 }]);
  } finally { if (was === undefined) delete process.env.CAD_TOOLS_VIA_V2; else process.env.CAD_TOOLS_VIA_V2 = was; }
});

// O105b: what a v2 caller reads names v2 tools only — the handlers' refusals and hints mapped at the MCP boundary.
const UNDERSCORED = TOOLS.map(t => t.name).filter(n => n.includes('_')), ONE_WORD = TOOLS.map(t => t.name).filter(n => !n.includes('_'));
/** The handler names a text still writes as tools: underscored ones not already an action's, one-word ones as "(name)" or "with name,". */
function handlerNamesIn(text: string): string[] {
  const words = new Set(text.match(/(?<![.\w])[a-z]+(?:_[a-z]+)+\b/g) ?? []);
  return [...UNDERSCORED.filter(n => words.has(n)), ...ONE_WORD.filter(n => text.includes(`(${n})`) || text.includes(`with ${n},`))];
}
function sourcesOf(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? sourcesOf(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : []);
}

test('O105b: every string of the model package that names a handler reads, through v2Text, as v2 tool.actions — no underscored handler name, no one-word handler as a tool, every action named real', () => {
  let named = 0;
  for (const file of sourcesOf(resolve(resolve(import.meta.dirname, '..'), '../../packages/barocss-cad-model/src'))) {
    for (const lit of readFileSync(file, 'utf8').match(/'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`|"(?:[^"\\\n]|\\.)*"/g) ?? []) {
      if (!lit.includes(' ') || !handlerNamesIn(lit).length) continue;
      named++;
      const read = v2Text(lit);
      assert.deepEqual(handlerNamesIn(read), [], `${file}: ${read.slice(0, 160)}`);
      for (const m of read.matchAll(/\b([a-z]+)\.([a-z_]+)\b/g)) if (m[1] in GROUPS && m[1] !== 'describe') assert.ok(V1_OF.has(`${m[1]}.${m[2]}`), `${file}: ${m[0]}`);
    }
  }
  assert.ok(named >= 60, `${named} strings name a handler`);
});

test('O105b pass-through: names a user chose that are not handlers\' come back unchanged — a part, a parameter and a note with underscores; only a handler\'s exact name is rewritten (a known limit: a part named "add_part" reads as assembly.add_part)', () => {
  const user = { part: 'my_bracket_v2', parameters: { wall_t_mm: 2, hole_d: 6.6 }, bodies: [{ key: 'b1', name: 'left_rail_2' }], note: 'my_bracket_v2 uses left_rail_2 and the base_plate', ops: [{ tool: 'not_a_handler', args: { x: 1 } }] };
  assert.equal(v2Result(JSON.stringify(user)), JSON.stringify(user));
  assert.equal(v2Text('my_bracket_v2, set_material_x, xset_material and set_materials'), 'my_bracket_v2, set_material_x, xset_material and set_materials');
  assert.equal(v2Text('a part named add_part'), 'a part named assembly.add_part', 'the known limit, pinned');
});
