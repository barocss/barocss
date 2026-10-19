import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, starterDoc, type StudioDoc } from '../src/engine/doc';
import { acceptProposal, dispatchTool, runTool, type ChatState } from '../src/chat/tools';
import { lex, parse, runScript, SCRIPT_LIMITS, ScriptError, type ScriptHost } from '../src/chat/script';

// A5.2 (O10): run_script — a part built in one call, all or nothing, each command a tool call; typed errors with the
// line; the conformance cases in conformance/a5/; a fuzz run that only ever ends in a typed error.

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const read = (content: string) => JSON.parse(content) as Record<string, any>;
const volumeOf = (s: ChatState) => s.bodies.reduce((v, b) => v + (b.volumeMM3 ?? 0), 0);
const empty = (): ChatState => ({ doc: emptyDoc(), bodies: [] });
const CASES = resolve(process.cwd(), '../../packages/barocss-cad/conformance/a5');

test('a script builds a part in one change: commands, loops, faces by role, edges between faces, raw features, edits', async () => {
  const source = [
    'const p = box({w: 80, d: 40, h: 8})',
    'for (const i of range(3)) { hole(p.top, {d: 5, x: 20 + 20 * i, y: 20}) }',
    'fillet([edge(p.top, p.side0)], {radius: 1})',
    'const s = feature({kind: "sketch", profile: "circle", center: [100, 0], radius: 5})',
    'const c = feature({kind: "extrude", sketch: s, height: 12})',
    'edit(p, {h: 10})',
  ].join('\n');
  const out = await dispatchTool(empty(), 'run_script', { source }, evaluate), r = read(out.content);
  assert.ok(!out.isError && out.changed, out.content);
  assert.equal(r.script, 'barocss-cad-script-v1');
  assert.deepEqual(r.calls.map((c: { line: number; tool: string }) => `${c.line}:${c.tool}`), ['1:run_command', '2:run_command', '2:run_command', '2:run_command', '3:run_command', '4:add_features', '5:add_features', '6:edit_feature']);
  assert.deepEqual(r.names, { p: 'n1', s: 'n6', c: 'n7' });
  assert.equal(r.diff.added.length, 8);
  assert.equal(out.state.doc.nodes.length, 8);
  // The box edited to 10 high under its holes and fillet; the cylinder beside it.
  const fillet = (1 - Math.PI / 4) * 1 * 80;
  assert.ok(Math.abs(volumeOf(out.state) - (80 * 40 * 10 - 3 * Math.PI * 6.25 * 10 - fillet + Math.PI * 25 * 12)) < 1, String(volumeOf(out.state)));
  assert.equal(r.facts.solids, 2);
});

test('all or nothing: a refused line, a type error or a limit leaves the part as it was, with the line', async () => {
  const s0: ChatState = { doc: starterDoc(), bodies: (await evaluate(starterDoc()) as { bodies: ChatState['bodies'] }).bodies };
  for (const [source, code, line] of [
    ['const a = box({w: 10, d: 10, h: 10, x: 100})\nconst b = box({w: 10, d: 10, h: 10, q: 1})', 'script_refused', 2],
    ['const a = box({w: 10, d: 10, h: 10, x: 100})\nfillet([edge(a.top, a.side0)], {radius: 40})', 'script_refused', 2],
    ['const a = box({w: 10, d: 10, h: 10, x: 100})\nconst a = 2', 'script_type', 2],
    ['const a = box({w: 10, d: 10, h: 10, x: 100})\nconst b = a.top + 1', 'script_type', 2],
    ['const a = box({w: 10, d: 10, h: 10, x: 100})\nnode("f99")', 'script_type', 2],
    ['box({w: 10, d: 10, h: 10, x: 100})\n\n  let x = 1', 'script_syntax', 3],
    ['for (const i of range(201)) { box({w: 1, d: 1, h: 1, x: 100 + 2 * i}) }', 'script_limit', 1],
  ] as const) {
    const out = await dispatchTool(s0, 'run_script', { source }, evaluate), r = read(out.content);
    assert.ok(out.isError, source); assert.equal(out.state, s0, 'the very same state');
    assert.deepEqual([r.code, r.line, r.kept], [code, line, 'nothing was applied'], `${source}: ${out.content}`);
  }
  // The refusal quotes the tool's own reason.
  const bad = read((await dispatchTool(s0, 'run_script', { source: 'box({w: 10, d: 10, h: 10, q: 1})' }, evaluate)).content);
  assert.match(bad.error, /\[REFUSED\] line 1:4: Box has no value "q"/);
  assert.ok((await dispatchTool(s0, 'run_script', {}, evaluate)).isError, 'no source');
});

test('a dry run changes nothing; existing features by id or index; bodies of features for commands that take bodies', async () => {
  const s0: ChatState = { doc: starterDoc(), bodies: (await evaluate(starterDoc()) as { bodies: ChatState['bodies'] }).bodies };
  const dry = await dispatchTool(s0, 'run_script', { source: 'const b = node(1)\nedit(b, {h: 20})', dryRun: true }, evaluate);
  assert.ok(!dry.isError && !dry.changed, dry.content); assert.equal(dry.state, s0);
  assert.equal(read(dry.content).dryRun, true);
  assert.equal(read(dry.content).diff.changed.length, 1);
  // A linear pattern of a new box (a body): the feature handle is its body.
  const out = await dispatchTool(s0, 'run_script', { source: 'const b = box({w: 5, d: 5, h: 5, x: 100})\nlinear_pattern(b, {axis: "x", count: 3, spacing: 10})' }, evaluate);
  assert.ok(!out.isError, out.content);
  assert.ok(Math.abs(volumeOf(out.state) - volumeOf(s0) - 3 * 125) < 0.01);
});

test('through the session gates: an empty part is built directly at L2; on a built part a script is proposed and accepted', async () => {
  const s = empty();
  const built = await runTool({ ...s, turnBase: s.doc }, 'run_script', { source: 'const p = box({w: 20, d: 20, h: 5})' }, evaluate);
  assert.ok(!built.isError && built.changed, built.content);
  const base = built.state;
  const direct = await runTool({ ...base, turnBase: base.doc }, 'run_script', { source: 'cylinder({r: 2, h: 5, x: 40, y: 0})' }, evaluate);
  assert.equal(read(direct.content).code, 'needs_proposal', direct.content);
  const proposed = await runTool({ ...base, turnBase: base.doc }, 'propose', { title: 'a peg', ops: [{ tool: 'run_script', args: { source: 'cylinder({r: 2, h: 5, x: 40, y: 0})' } }] }, evaluate);
  assert.ok(!proposed.isError, proposed.content);
  const accepted = await acceptProposal(proposed.state, read(proposed.content).proposal, evaluate);
  assert.ok('state' in accepted, JSON.stringify(accepted));
  assert.ok(Math.abs(volumeOf(accepted.state) - 20 * 20 * 5 - Math.PI * 4 * 5) < 0.5, String(volumeOf(accepted.state)));
});

test('the conformance cases (conformance/a5): volumes in closed form, errors typed with their line', async () => {
  const names = readdirSync(CASES).sort();
  assert.ok(names.length >= 9);
  for (const name of names) {
    const c = JSON.parse(readFileSync(join(CASES, name, 'case.json'), 'utf8'));
    const out = await dispatchTool(empty(), 'run_script', { source: c.script }, evaluate), r = read(out.content);
    if (c.error) { assert.ok(out.isError, name); assert.deepEqual([r.code, r.line], [c.error.code, c.error.line], `${name}: ${out.content}`); continue; }
    assert.ok(!out.isError, `${name}: ${out.content}`);
    assert.equal(out.state.doc.nodes.length, c.expect.features, name);
    if (c.expect.names) assert.deepEqual(r.names, c.expect.names, name);
    assert.ok(Math.abs(volumeOf(out.state) - c.expect.volume_mm3) <= c.expect.tol, `${name}: ${volumeOf(out.state)} vs ${c.expect.volume_mm3}`);
  }
});

test('the language: precedence, conditionals, objects and lists, comments; a host that records the calls', async () => {
  const calls: [string, Record<string, unknown>][] = [];
  let n = 0;
  const host: ScriptHost = {
    commands: ['box', 'linear-pattern'], indexOf: id => Number(id.slice(1)), idAt: i => `n${i}`, bodyOf: id => `b${id.slice(1)}`,
    call: async (tool, args) => { calls.push([tool, args]); return { ok: true, added: [`n${n++}`], did: tool }; },
  };
  const run = await runScript(parse(`
    // a comment
    /* and a block one */
    const w = 2 + 3 * 4 - -1          // 15
    const o = { w, d: w > 10 ? 1 : 2, list: [1, 2][1], ok: !(1 > 2) && "a" + 1 == "a1" }
    if (o.ok) { box(o) } else { box({w: 0}) }
    const b = box({w: round(sqrt(2) * 10) % 4, d: max(1, 2, 3), h: abs(-cos(180))})
    linear_pattern(b, {count: range(2, 10, 3).length})
    linear_pattern([b.side(2), b.side("e3"), b.face("cut"), edge(b.top, face({normal: [0, 0, 1], pick: "max"}))], {})
  `), host);
  assert.deepEqual(calls[0], ['run_command', { command: 'box', values: { w: 15, d: 1, list: 2, ok: true } }]);
  assert.deepEqual(calls[1], ['run_command', { command: 'box', values: { w: 2, d: 3, h: 1 } }]);
  assert.deepEqual(calls[2], ['run_command', { command: 'linear-pattern', values: { count: 3 }, bodies: ['b1'] }]);
  assert.deepEqual(calls[3][1], { command: 'linear-pattern', values: {}, faces: [{ feature: 'n1', role: 'side2' }, { feature: 'n1', role: 'side[e3]' }, { feature: 'n1', role: 'cut' }], edges: [{ between: [{ feature: 'n1', role: 'top' }, { normal: [0, 0, 1], pick: 'max' }] }] });
  assert.deepEqual(run.names, { b: 'n1' });
});

test('limits and typed errors at the parser: source size, nesting, unclosed strings and comments', () => {
  const code = (f: () => unknown) => { try { f(); return 'none'; } catch (e) { assert.ok(e instanceof ScriptError, String(e)); return `${e.code}@${e.line}:${e.col}`; } };
  assert.equal(code(() => lex('x'.repeat(SCRIPT_LIMITS.sourceChars + 1))), 'LIMIT@1:1');
  assert.match(code(() => parse('const a = ' + '('.repeat(60) + '1' + ')'.repeat(60))), /^LIMIT@1:\d+$/);
  assert.match(code(() => parse('const a = "abc\nconst b = 1')), /^SYNTAX@1:11$/);
  assert.match(code(() => parse('const a = 1 /* never closed')), /^SYNTAX@1:13$/);
  assert.match(code(() => parse('const a = 1 #')), /^SYNTAX@1:13$/);
  assert.match(code(() => parse('function f() {}')), /^SYNTAX@1:1$/);
  assert.match(code(() => parse('for (const i in x) {}')), /^SYNTAX@1:14$/);
  assert.match(code(() => parse('const = 1')), /^SYNTAX@1:7$/);
});

test('fuzz: random scripts end in a result or a typed error, never a crash or a hang', async () => {
  // (A seeded generator: the same tokens every run.)
  let seed = 0x5eed;
  const rand = (n: number) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const pieces = ['const', 'x', 'y', '=', '(', ')', '{', '}', '[', ']', ',', '.', ':', ';', '1', '2.5', '"s"', '+', '-', '*', '/', '%', '<', '==', '&&', '!', '?', 'for', 'of', 'if', 'else', 'range', '(3)', 'box', 'top', 'edge', 'face', '\n', ' ', '"', '/*', '//', '#', 'let', 'true', 'node'];
  // (And valid scripts with a character dropped, doubled or swapped in: closer to what a model gets wrong.)
  const valid = 'const p = box({w: 80, d: 40, h: 8})\nfor (const i of range(3)) { hole(p.top, {d: 5, x: 20 + 20 * i, y: 20}) }\nfillet([edge(p.top, p.side0)], {radius: 1})\nconst s = feature({kind: "sketch", profile: "circle", center: [0, 0], radius: 5})\nedit(node(0), {h: s.id})\n';
  const chars = '(){}[],.:;="+-*/!<>0123456789 \nabcxyz';
  let made = 0;
  const host: ScriptHost = { commands: ['box', 'hole', 'fillet'], indexOf: id => id.startsWith('n') ? Number(id.slice(1)) : -1, idAt: i => i < made ? `n${i}` : null, bodyOf: id => id, call: async () => rand(9) ? { ok: true, added: [`n${made++}`], did: 'x' } : { ok: false, why: 'no' } };
  const seen = new Set<string>();
  for (let k = 0; k < 4000; k++) {
    let source = '';
    if (k % 2) for (let t = rand(40); t >= 0; t--) source += pieces[rand(pieces.length)] + (rand(3) ? ' ' : '');
    else { source = valid; for (let m = 1 + rand(2); m > 0; m--) { const at = rand(source.length), op = rand(3); source = source.slice(0, at) + (op === 0 ? '' : chars[rand(chars.length)]) + source.slice(op === 1 ? at : at + 1); } }
    try { await runScript(parse(source), host); seen.add('ran'); } catch (e) {
      assert.ok(e instanceof ScriptError, `${source}\n→ ${String(e)}`);
      assert.ok(e.line >= 1 && e.col >= 1, source);
      seen.add(e.code);
    }
  }
  assert.ok(['ran', 'SYNTAX', 'UNKNOWN_NAME', 'TYPE', 'REFUSED'].every(c => seen.has(c)), [...seen].join());
});
