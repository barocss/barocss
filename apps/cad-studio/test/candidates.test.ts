import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { dispatchTool, type ChatState } from '@barocss/cad-model/chat/tools';
import { canonical, canonicalOf } from '@barocss/cad-model/team/team';
import { CandidateBoard, type Evidence, type Reopen } from '../src/team/candidates';
import { runBoardScenario, type BoardScenario } from '../src/team/boardScenario';

// A7.5 (O94; #2181): candidates isolated, verified, approved. The oracles are the closed forms (a 20 × 10 × h block is
// 200·h mm³) and the board's own contract; the mutants break the replay (facts, a verdict, an unreadable file), deliver
// twice, cancel mid-build, and bring an old token's content back by an undo.

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const SCENARIO = join(process.cwd(), '../../packages/barocss-cad/conformance/a7/candidates/candidates-nine-steps.json');
const H = (h: number) => [{ tool: 'edit_feature', args: { index: 1, values: { h } } }];
async function seeded(): Promise<ChatState> {
  const sc = JSON.parse(readFileSync(SCENARIO, 'utf8')) as BoardScenario;
  const r = await dispatchTool({ doc: emptyDoc(), bodies: [], turnBase: emptyDoc() } as never as ChatState, 'apply_ops', { ops: sc.seed }, evaluate);
  assert.ok(!r.isError, r.content); return r.state;
}
const built = async (b: CandidateBoard, id: string, h: number, k: number) => { assert.ok(b.start({ operationId: `s${k}`, candidate: id, patch: { ops: H(h) } }).ok); const o = await b.run(`r${k}`, id); assert.ok(o.ok, o.message ?? ""); return o; };

test('A7.5 #2181\'s nine steps in this process: every step as the scenario says — volumes by 200·h, codes typed', async () => {
  const sc = JSON.parse(readFileSync(SCENARIO, 'utf8')) as BoardScenario, r = await runBoardScenario(sc, evaluate);
  assert.equal(r.steps.length, sc.expect.length);
  r.steps.forEach((s, k) => assert.equal(canonical(s), canonical(sc.expect[k]), `step ${k} ${JSON.stringify(sc.steps[k]).slice(0, 90)}`));
  // (The closed forms behind the expectations: R0 1000, A 1200, B 1400, re-edited 1800.)
  assert.deepEqual([sc.expect[0].volume, sc.expect[2].candidate_volume, sc.expect[3].candidate_volume, sc.expect[25].volume], [20 * 10 * 5, 20 * 10 * 6, 20 * 10 * 7, 20 * 10 * 9]);
});

test('A7.5 the same scenario through cad-cli board --fresh (each accepted part read back in a fresh process): the same steps, exit 0', () => {
  const sc = JSON.parse(readFileSync(SCENARIO, 'utf8')) as BoardScenario;
  const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/cad-cli.mjs'), 'board', SCENARIO, '--fresh'], { encoding: 'utf8', timeout: 240000 });
  assert.equal(r.status, 0, r.stderr.slice(0, 600) + r.stdout.slice(0, 600));
  const out = JSON.parse(r.stdout) as { steps: unknown[]; matches: boolean };
  assert.equal(out.matches, true); assert.equal(canonical(out.steps), canonical(sc.expect));
});

test('A7.5 isolation: two candidates built on R0 leave it unchanged and do not see each other; a failure and a cancel leave both intact', async () => {
  const s = await seeded(), b = new CandidateBoard(s, evaluate), r0 = canonicalOf(s.doc);
  const a = await built(b, 'A', 6, 1), bb = await built(b, 'B', 7, 2);
  assert.equal(canonicalOf(b.state.doc), r0, 'R0 unchanged'); assert.equal(b.volume(), 1000);
  assert.deepEqual([a.evidence!.facts.volume_mm3, bb.evidence!.facts.volume_mm3], [1200, 1400]);
  const before = canonical([b.evidenceOf('A'), b.evidenceOf('B')]);
  assert.ok(b.start({ operationId: 'sC', candidate: 'C', patch: { ops: [{ tool: 'edit_feature', args: { index: 42, values: { h: 6 } } }] } }).ok);
  assert.equal((await b.run('rC', 'C')).code, 'WRONG_TARGET');
  assert.ok(b.start({ operationId: 'sD', candidate: 'D', patch: { ops: H(8) } }).ok);
  const running = b.run('rD', 'D'); b.cancel('cD', 'D'); assert.equal((await running).code, 'CANCELLED');
  assert.equal(canonicalOf(b.state.doc), r0); assert.equal(canonical([b.evidenceOf('A'), b.evidenceOf('B')]), before);
});

test('A7.5 the replay gate, mutants: the part read back with other facts, a verdict measured past its tolerance, a file that does not read — each refused by name, the part unchanged', async () => {
  const s = await seeded();
  const bent = (f: (e: Evidence) => Evidence | { error: string }): Reopen => async bytes => { const real = await (await import('../src/team/candidates')).inProcessReopen(evaluate)(bytes); return 'error' in real ? real : f(real); };
  for (const [reopen, code] of [
    [bent(e => ({ ...e, facts: { ...e.facts, volume_mm3: e.facts.volume_mm3 + 1 } })), 'REPLAY_FACTS_DIFFER'],
    [bent(e => ({ ...e, verdicts: { ...e.verdicts, H: { ...e.verdicts.H, measured: (e.verdicts.H.measured ?? 0) + 0.02 } } })), 'REPLAY_VERDICT_DIFFERS'],
    [bent(e => ({ ...e, verdicts: { ...e.verdicts, H: { status: 'fail' } } })), 'REPLAY_VERDICT_DIFFERS'],
    [(async () => ({ error: 'the file is cut short' })) as Reopen, 'REPLAY_UNREADABLE'],
  ] as const) {
    const b = new CandidateBoard(s, evaluate, reopen); await built(b, 'A', 6, 1);
    const o = await b.accept('a1', 'A');
    assert.equal(o.code, code, o.message ?? ''); assert.equal(b.volume(), 1000); assert.equal(b.state.token, 0);
  }
  // (Within the check's tolerance — 0.01 — a measure read back 0.005 off still matches.)
  const b = new CandidateBoard(s, evaluate, bent(e => ({ ...e, verdicts: { ...e.verdicts, H: { ...e.verdicts.H, measured: (e.verdicts.H.measured ?? 0) + 0.005 } } })));
  await built(b, 'A', 6, 1); assert.ok((await b.accept('a1', 'A')).ok);
});

test('A7.5 duplicates: a second delivery of an accept is answered from the trace — applied once, one undo; undo and redo restore the source and geometry; a token is never reused', async () => {
  const s = await seeded(), b = new CandidateBoard(s, evaluate), r0 = canonicalOf(s.doc);
  await built(b, 'A', 6, 1); await built(b, 'E', 8, 2);
  assert.ok((await b.accept('a1', 'A')).ok); const r1 = canonicalOf(b.state.doc), t1 = b.state.token;
  const again = await b.accept('a1', 'A');
  assert.deepEqual([again.duplicate, again.code, b.state.token, b.volume()], [true, 'DUPLICATE', t1, 1200]);
  assert.ok(b.undo('u1').ok); assert.equal(canonicalOf(b.state.doc), r0); assert.equal(b.volume(), 1000);
  assert.equal(b.undo('u2').code, 'NOTHING_TO_UNDO', 'one accept, one undo');
  assert.ok(b.redo('d1').ok); assert.equal(canonicalOf(b.state.doc), r1); assert.equal(b.volume(), 1200);
  // (E was built on R0's token. Undo brings R0's content back — on a new token: E stays stale, never valid by accident.)
  assert.ok(b.undo('u3').ok); assert.equal(canonicalOf(b.state.doc), r0);
  const e = await b.accept('aE', 'E'); assert.equal(e.code, 'STALE_BASE'); assert.match(e.message!, /built on token 0 .* the part is at token 4/);
  const tokens = b.outcomes.map(o => o.token); assert.deepEqual(tokens.filter((t, i) => i && t < tokens[i - 1]), [], 'tokens only move on');
});
