import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Writable } from 'node:stream';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { dispatchTool } from '../src/chat/tools';
import { integrate, rebase, revisionOf, VERIFIER_VIEW_KEYS, verifierView, type Patch, type VerifierView } from '../src/team/team';
import { runScenario, runSummary, scriptedVerifier, STALE_REVISION, type Scenario } from '../src/team/scripted';
import { cliMain } from '../server/cadCli';

// A7 (O30–O31): the multi-agent core, deterministic. The seeded-defect scenarios (conformance/a7): each defect stopped at
// the gate it belongs to, typed, the rest not reached; a stale base refused and the patch rebased explicitly; a defect
// only the Verifier's view shows; a near-limit keep-out held; a clean run accepted — every run byte-identical on a rerun.
// The Verifier's view: its keys exactly the fixed set, nothing of the patch in it, frozen. cad-cli team on a scenario.

const CASES = resolve(process.cwd(), '../../packages/barocss-cad/conformance/a7');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const load = (f: string) => JSON.parse(readFileSync(join(CASES, f), 'utf8')) as Scenario & { expect: { decisions: string[]; stops: ([string, string] | null)[]; accepted: number; ended: string; rebased_from?: string } };

test('the seeded-defect scenarios: each stopped at its gate (or by the Verifier), typed; the later gates not reached; byte-identical on a rerun', async () => {
  const files = readdirSync(CASES).filter(f => f.endsWith('.json'));
  assert.ok(files.length >= 10, files.join());
  for (const f of files) {
    const sc = load(f), run = await runScenario(sc, evaluate), out = JSON.stringify(runSummary(run));
    assert.deepEqual(run.traces.map(t => t.decision), sc.expect.decisions, `${sc.case} decisions: ${out.slice(0, 600)}`);
    run.traces.forEach((t, i) => {
      const want = sc.expect.stops[i];
      const stop = t.gates.find(g => g.verdict === 'fail' || g.verdict === 'undecided');
      if (!want) { assert.ok(!stop, `${sc.case} #${i}: stopped at ${stop?.gate} ${JSON.stringify(stop?.findings)}`); return; }
      if (want[0] === 'verifier') { assert.ok(!stop && t.verifier && !t.verifier.accept && t.verifier.findings.length, `${sc.case} #${i}: the Verifier`); return; }
      assert.equal(stop?.gate, want[0], `${sc.case} #${i}: ${JSON.stringify(t.gates)}`);
      assert.ok(stop!.findings.some(x => x.code === want[1]), `${sc.case} #${i}: ${JSON.stringify(stop!.findings)}`);
      // (After a fail, every later gate is "not reached".)
      if (stop!.verdict === 'fail') for (const g of t.gates.slice(t.gates.indexOf(stop!) + 1)) assert.ok(g.verdict === 'skipped' && g.findings[0].code === 'NOT_REACHED', `${sc.case} #${i} ${g.gate}`);
    });
    assert.equal(run.accepted, sc.expect.accepted, sc.case); assert.equal(run.ended, sc.expect.ended, sc.case);
    if (sc.expect.rebased_from) assert.equal(run.traces.at(-1)!.rebasedFrom, sc.expect.rebased_from);
    // (Every trace complete: the patch, its base, the gates in order, the decision; a revision after only when applied.)
    for (const t of run.traces) { assert.ok(t.patch && t.base && t.gates.length >= 1 && t.decision); assert.equal(t.revisionAfter !== null, t.decision === 'applied', `${sc.case} #${t.seq}`); }
    // (Reproducible to the byte.)
    assert.equal(JSON.stringify(runSummary(await runScenario(sc, evaluate))), out, `${sc.case}: a rerun differs`);
  }
});

test('patches on a base revision: a stale one refused (STALE_BASE) and the state unchanged; rebasing explicit; the revision covers the model and the contracts', async () => {
  let s = { doc: emptyDoc(), bodies: [] as never[] };
  const r0 = revisionOf(s.doc), p: Patch = { id: 'p', by: 'designer', base: STALE_REVISION, ops: [{ tool: 'run_command', args: { command: 'box', values: { w: 10, d: 10, h: 10, x: 0, y: 0, z: 0 } } }] };
  const stale = await integrate(s, p, evaluate, { seq: 1 });
  assert.equal(stale.trace.decision, 'stale'); assert.equal(stale.state, s); assert.equal(stale.trace.gates[0].findings[0].code, 'STALE_BASE'); assert.match(stale.trace.gates[0].findings[0].message, new RegExp(r0));
  const again = rebase(p, r0); assert.equal(again.rebasedFrom, STALE_REVISION); assert.equal(rebase(again, 'x').rebasedFrom, STALE_REVISION, 'the first base kept');
  const ok = await integrate(s, again, evaluate, { seq: 2 });
  assert.equal(ok.trace.decision, 'applied'); assert.notEqual(revisionOf(ok.state.doc), r0); assert.equal(ok.trace.revisionAfter, revisionOf(ok.state.doc));
  s = ok.state as typeof s;
  // (A contract changes the revision too; a view or a history entry does not; key order does not.)
  const withReq = (await dispatchTool(s, 'set_requirements', { requirements: [{ id: 'R', source: 'x', hard: true, basis: 'assumed', check: { op: '>=', query: { fn: 'volume' }, value: 1 } }] }, evaluate)).state.doc;
  assert.notEqual(revisionOf(withReq), revisionOf(s.doc));
  assert.equal(revisionOf({ ...s.doc, history: [{ id: 'h', kind: 'prompt', at: 'now', by: { agent: 'x' } }] } as unknown as StudioDoc), revisionOf(s.doc));
  const reordered = Object.fromEntries(Object.entries(s.doc).reverse()) as unknown as StudioDoc;
  assert.equal(revisionOf(reordered), revisionOf(s.doc));
});

test('the Verifier is given artifacts and requirements only: its view\'s keys the fixed set, nothing of the patch in it, frozen', async () => {
  const sc = load('verifier-only.json'), seen: VerifierView[] = [], rules = sc.verifier!.rules;
  const v = scriptedVerifier(rules); const spy = { model: 'spy', review: async (view: VerifierView) => { seen.push(view); return v.review(view); } };
  const s = { doc: emptyDoc(), bodies: [] as never[] };
  const rationale = 'SECRET-RATIONALE-make-it-heavy';
  const out = await integrate(s, { id: 'p1', by: 'designer', base: revisionOf(s.doc), ops: [{ tool: 'run_command', args: { command: 'box', values: { w: 40, d: 30, h: 10, x: 0, y: 0, z: 0 } } }], rationale }, evaluate, { seq: 1, verifier: spy });
  assert.equal(seen.length, 1);
  const view = seen[0];
  assert.deepEqual(Object.keys(view).sort(), [...VERIFIER_VIEW_KEYS].sort());
  const text = JSON.stringify(view);
  for (const leak of [rationale, '"ops"', 'run_command', '"rationale"', '"patch"']) assert.ok(!text.includes(leak), `the view holds ${leak}`);
  assert.ok(Object.isFrozen(view) && Object.isFrozen(view.boxes as object), 'frozen');
  assert.equal(out.trace.verifier?.model, 'spy');
  // (The view of the same part is the same, whatever patch made it.)
  const e = await evaluate(out.state.doc); assert.ok(e.ok);
  assert.equal(JSON.stringify(verifierView(out.state.doc, e.bodies, { keepouts: [], print: null, spec: null })), JSON.stringify(verifierView(out.state.doc, e.bodies, { keepouts: [], print: null, spec: null })));
  void s;
});

test('cad-cli team runs a scenario: the traces printed, byte-identical twice; exit 1 when nothing was applied', async () => {
  const io = () => { let text = ''; return { stdout: new Writable({ write(c, _e, cb) { text += c; cb(); } }), stderr: new Writable({ write(_c, _e, cb) { cb(); } }), text: () => text }; };
  const a = io(), b = io();
  assert.equal(await cliMain(['team', join(CASES, 'clean-run.json')], a), 0);
  assert.equal(await cliMain(['team', join(CASES, 'clean-run.json')], b), 0);
  assert.equal(a.text(), b.text());
  const j = JSON.parse(a.text());
  assert.ok(j.accepted === 1 && j.traces[1].gates.map((g: { gate: string }) => g.gate).join() === 'validity,interference,interfaces,dfm,analysis', a.text().slice(0, 400));
  const c = io(); assert.equal(await cliMain(['team', join(CASES, 'contract.json')], c), 1);
  const d = io(); assert.equal(await cliMain(['team', join(mkdtempSync(join(tmpdir(), 'team-')), 'none.json')], d), 2);
});
