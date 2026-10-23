import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { dispatchTool, type ChatState } from '@barocss/cad-model/chat/tools';
import { readBrief, saidIn } from '@barocss/cad-model/chat/brief';
import { acceptAssumptions, answerBatch, assumptionsOf, readQuestions } from '@barocss/cad-model/chat/questions';
import type { Requirement } from '@barocss/cad-model/engine/schema/spec';
import { stateFileStore } from '../server/cadMcp';

// A6.2 (O25): the clarifying policy and the user's say. A stated quote must be in what the user typed this conversation
// (SOURCE_NOT_SAID), or is kept as unverified where there is no conversation; only the user confirms; an assumption
// does not replace or drop what the user stated or confirmed — for the brief and the requirements alike. ask_user's
// gates on the hand-written question fixtures; the answers and accept-all written as the user's.

const CASES = resolve(process.cwd(), '../../packages/barocss-cad/conformance/a6/questions');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const call = (s: ChatState, tool: string, args: object) => dispatchTool(s, tool, args, evaluate);
const code = (content: string) => (/^\[([A-Z_]+)\]/.exec(JSON.parse(content).error ?? '') ?? [])[1];

test('a stated quote is checked against what the user typed: a made-up quote cannot overwrite a stated material (SOURCE_NOT_SAID)', async () => {
  const turns = ['A bracket for a 30 mm pipe.', 'Make it in PETG\nplease.'];
  let s: ChatState = { doc: emptyDoc(), bodies: [], turns };
  const r1 = await call(s, 'set_brief', { fields: { material: { value: 'petg', basis: 'stated', source: 'PETG please' } } });
  assert.ok(!r1.isError, r1.content); s = r1.state;
  assert.equal(s.doc.brief?.material?.said, 'verified', 'whitespace normalised only: a newline matches a space');
  // (The agent makes up the user's change of mind: refused, the stated PETG kept.)
  const fake = await call(s, 'set_brief', { fields: { material: { value: 'pla', basis: 'stated', source: 'switch it to PLA' } } });
  assert.equal(code(fake.content), 'SOURCE_NOT_SAID', fake.content);
  assert.equal(fake.state, s); assert.equal(s.doc.brief?.material?.value, 'petg');
  // (Case is not normalised; a quote spanning two messages is not one quote.)
  for (const source of ['petg please', 'pipe. Make it']) assert.equal(code((await call(s, 'set_brief', { fields: { purpose: { value: 'x', basis: 'stated', source } } })).content), 'SOURCE_NOT_SAID', source);
  // (When the user does say it, the change is theirs.)
  const real = await call({ ...s, turns: [...turns, 'Actually, switch it to PLA.'] }, 'set_brief', { fields: { material: { value: 'pla', basis: 'stated', source: 'switch it to PLA' } } });
  assert.ok(!real.isError, real.content); assert.equal(real.state.doc.brief?.material?.value, 'pla');
  // (An assumption needs no quote; an empty conversation verifies nothing.)
  assert.ok(!(await call(s, 'set_brief', { fields: { finish: { value: 'matte', basis: 'assumed', why: 'a bracket' } } })).isError);
  assert.equal(code((await call({ ...s, turns: [] }, 'set_brief', { fields: { purpose: { value: 'x', basis: 'stated', source: 'x' } } })).content), 'SOURCE_NOT_SAID');
  assert.ok(saidIn('  A   bracket ', turns) && !saidIn('', turns) && !saidIn('   ', turns));
});

test('without a conversation (cad-cli, cad-mcp --doc, a script) a stated field is kept as stated but unverified, and listed so', async () => {
  const s: ChatState = { doc: emptyDoc(), bodies: [] };
  const r = await call(s, 'set_brief', { fields: { material: { value: 'petg', basis: 'stated', source: 'PETG' } } });
  assert.ok(!r.isError); assert.equal(r.state.doc.brief?.material?.said, 'unverified');
  const g = JSON.parse((await call(r.state, 'get_brief', {})).content);
  assert.deepEqual(g.unverified, ['material']);
  // (The agent cannot mark it verified itself.)
  assert.equal(code((await call(s, 'set_brief', { fields: { material: { value: 'petg', basis: 'stated', source: 'PETG', said: 'verified' } } })).content), 'BAD_FIELD');
  // (The MCP server's state file carries the conversation into the tools' state.)
  const dir = mkdtempSync(join(tmpdir(), 'said-')), path = join(dir, 'state.json');
  writeFileSync(path, JSON.stringify({ doc: emptyDoc(), changed: false, turns: ['in PETG'] }));
  assert.deepEqual((await stateFileStore(path).open()).turns, ['in PETG']);
  writeFileSync(path, JSON.stringify({ doc: emptyDoc(), changed: false }));
  assert.equal((await stateFileStore(path).open()).turns, undefined);
});

test('requirements: a stated source must be said; only the user confirms; what the user stated or confirmed is not replaced or dropped by an assumption', async () => {
  const req = (id: string, extra: Partial<Requirement> = {}): Requirement => ({ id, source: '80 long', hard: true, check: { op: '==', query: { fn: 'bbox', axis: 'x' }, value: 80, tol: 0.1 }, ...extra });
  const turns = ['A plate 80 long.'];
  let s: ChatState = { doc: emptyDoc(), bodies: [], turns };
  assert.equal(code((await call(s, 'set_requirements', { requirements: [req('R1', { source: '90 long' })] })).content), 'SOURCE_NOT_SAID');
  const ok = await call(s, 'set_requirements', { requirements: [req('R1'), req('R2', { source: 'my guess', basis: 'assumed' })] });
  assert.ok(!ok.isError, ok.content); s = ok.state;
  assert.equal(s.doc.requirements![0].said, 'verified'); assert.equal(s.doc.requirements![1].said, undefined);
  assert.equal(code((await call(s, 'set_requirements', { requirements: [req('R3', { basis: 'assumed', confirmed: { by: 'user', at: 'now' } })] })).content), 'CONFIRM_IS_THE_USERS');
  // (R1 is the user's: an assumed R1 or a replace without it is refused; R2, an assumption, may be replaced.)
  assert.equal(code((await call(s, 'set_requirements', { requirements: [req('R1', { basis: 'assumed', source: 'x' })] })).content), 'STATED_KEPT');
  assert.equal(code((await call(s, 'set_requirements', { requirements: [req('R2', { basis: 'assumed', source: 'y' })], replace: true })).content), 'STATED_KEPT');
  assert.ok(!(await call(s, 'set_requirements', { requirements: [req('R2', { basis: 'assumed', source: 'another guess' })] })).isError);
  // (Without a conversation: unverified, not refused.)
  const cli = await call({ doc: emptyDoc(), bodies: [] }, 'set_requirements', { requirements: [req('R1', { source: 'anything' })] });
  assert.ok(!cli.isError); assert.equal(cli.state.doc.requirements![0].said, 'unverified');
});

test('ask_user on the question fixtures (conformance/a6/questions): accepted or refused as each says; the answers written as the user\'s', async () => {
  const files = readdirSync(CASES).filter(f => f.endsWith('.json'));
  assert.ok(files.length >= 8);
  for (const f of files) {
    const c = JSON.parse(readFileSync(join(CASES, f), 'utf8')), setup = c.input.setup;
    let s: ChatState = { doc: emptyDoc(), bodies: [] };
    s = (await call(s, 'set_brief', { fields: setup.brief })).state;
    if (setup.requirements) { const r = await call(s, 'set_requirements', { requirements: setup.requirements }); assert.ok(!r.isError, `${c.case}: ${r.content}`); s = r.state; }
    for (const [k, step] of (c.input.steps as { questions: object[]; expect: string; answers?: Record<string, string | number | null> }[]).entries()) {
      const r = await call(s, 'ask_user', { questions: step.questions });
      if (step.expect === 'ok') assert.ok(!r.isError, `${c.case} step ${k}: ${r.content}`);
      else { assert.equal(code(r.content), step.expect, `${c.case} step ${k}: ${r.content}`); assert.equal(r.state, s); continue; }
      s = r.state;
      if (step.answers) { const a = answerBatch(s.doc, step.answers, '2026-10-20T12:00:00.000Z'); assert.ok(!('error' in a), `${c.case}: ${JSON.stringify(a)}`); s = { ...s, doc: (a as { doc: StudioDoc }).doc }; }
    }
    assert.deepEqual(readQuestions(s.doc.questions).batches.map(b => b.status), c.expect.batches, `${c.case} batches`);
    for (const [k, want] of Object.entries((c.expect.brief ?? {}) as Record<string, { value: unknown; basis: string; confirmed: boolean }>)) {
      const got = readBrief(s.doc.brief)![k as 'process'];
      assert.ok(got && got.value === want.value && got.basis === want.basis && !!got.confirmed === want.confirmed, `${c.case} ${k}: ${JSON.stringify(got)}`);
      if (want.confirmed) assert.ok(got.said === 'verified' && got.confirmed!.by === 'user' && typeof got.source === 'string', `${c.case} ${k}: the user's words`);
    }
    for (const [id, want] of Object.entries((c.expect.requirements ?? {}) as Record<string, { basis: string; confirmed: boolean; value: number }>)) {
      const r = s.doc.requirements!.find(x => x.id === id)!;
      assert.ok(r.basis === want.basis && !!r.confirmed === want.confirmed && r.check.value === want.value, `${c.case} ${id}: ${JSON.stringify(r)}`);
    }
    if (c.expect.doc_process !== undefined) {
      // (The studio applies a stated process as A6.1 does: the get_brief view of it.)
      const g = JSON.parse((await call(s, 'get_brief', {})).content);
      assert.equal(g.brief.process.value, c.expect.doc_process);
    }
  }
});

test('the answers\' message, a bad answer refused before anything is written, and accept-all confirming every assumption', async () => {
  let s: ChatState = { doc: emptyDoc(), bodies: [] };
  s = (await call(s, 'set_brief', { fields: { purpose: { value: 'a hook', basis: 'assumed', why: 'from the sketch' }, process: { value: 'fdm', basis: 'assumed', why: 'one off' } } })).state;
  s = (await call(s, 'set_requirements', { requirements: [{ id: 'R1', source: 'strong enough', hard: true, basis: 'assumed', check: { op: '>=', query: { fn: 'min_wall' }, value: 3 } }] })).state;
  s = (await call(s, 'ask_user', { questions: [{ id: 'q1', text: 'How many?', kind: 'text', blocks: { field: 'purpose' } }, { id: 'q2', text: 'Wall?', kind: 'number', unit: 'mm', blocks: { requirement: 'R1' } }] })).state;
  assert.ok('error' in answerBatch(s.doc, { q1: 'a coat hook', q2: 'thick' }, 'now'), 'a wall that is not a number');
  const a = answerBatch(s.doc, { q1: 'a coat hook', q2: 4 }, 'now');
  assert.ok(!('error' in a));
  assert.equal(a.message, 'My answers to your questions (batch 1):\n- How many? → a coat hook\n- Wall? → 4 mm');
  assert.equal(a.doc.brief!.purpose!.source, 'a coat hook');
  // (The answer is the user's message, so it is in the conversation: a later quote of it is verified.)
  assert.ok(saidIn('a coat hook', [a.message]));
  assert.deepEqual(assumptionsOf(a.doc).map(x => ('field' in x ? x.field : x.requirement)), ['process']);
  const all = acceptAssumptions(a.doc, 'later');
  assert.equal(all.count, 1); assert.match(all.message, /accept your 1 assumption as they are: process/);
  assert.equal(all.doc.brief!.process!.confirmed?.by, 'user'); assert.deepEqual(assumptionsOf(all.doc), []);
  assert.equal(acceptAssumptions(all.doc, 'x').count, 0);
});
