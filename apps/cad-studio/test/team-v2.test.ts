import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { ANALYSIS_VIEW_KEYS, DFM_VIEW_KEYS, integrate, revisionOf, type ReviewerRole, type ReviewView } from '@barocss/cad-model/team/team';
import { runScenario, runSummary, scriptedReviewer, type Scenario } from '../src/team/scripted';

// A8.1 (O32–O33): multi-agent v2. Parallel read-only reviewers — DFM and Analysis — each on its own built, frozen view;
// any rejection rejects, their findings in role order whichever ends first; the defects only they see; the Drafting
// agent on a frozen revision, refused when the model moved or for a non-drawing op. Byte-identical reruns.

const CASES = resolve(process.cwd(), '../../packages/barocss-cad/conformance/a8/scenarios');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
type Expect = { decisions: string[]; stops: ([string, string] | null)[]; reviews?: ([string, string, string[]][] | null)[]; kept_because?: string; accepted: number; ended: string; drawing_keeps_revision?: boolean };
const load = (f: string) => JSON.parse(readFileSync(join(CASES, f), 'utf8')) as Scenario & { step: string; expect: Expect };

test('the v2 scenarios (conformance/a8, A8.1): reviewers\' verdicts in role order, the drafting agent\'s decisions; byte-identical on a rerun', async () => {
  const files = readdirSync(CASES).filter(f => f.endsWith('.json') && load(f).step === 'A8.1');
  assert.ok(files.length >= 6, files.join());
  for (const f of files) {
    const sc = load(f), run = await runScenario(sc, evaluate), out = JSON.stringify(runSummary(run));
    assert.deepEqual(run.traces.map(t => t.decision), sc.expect.decisions, `${sc.case}: ${out.slice(0, 700)}`);
    run.traces.forEach((t, i) => {
      const want = sc.expect.stops[i], stop = t.gates.find(g => g.verdict === 'fail' || g.verdict === 'undecided');
      if (!want) assert.ok(!stop, `${sc.case} #${i}: ${JSON.stringify(stop)}`);
      else { assert.equal(stop?.gate, want[0], `${sc.case} #${i}`); assert.ok(stop!.findings.some(x => x.code === want[1]), `${sc.case} #${i}: ${JSON.stringify(stop!.findings)}`); }
      const rv = sc.expect.reviews?.[i];
      if (rv !== undefined) assert.deepEqual(rv === null ? undefined : t.reviews?.map(r => [r.role, r.verdict, r.findings.map(x => x.code)]), rv === null ? undefined : rv, `${sc.case} #${i} reviews: ${JSON.stringify(t.reviews)}`);
    });
    assert.equal(run.accepted, sc.expect.accepted, sc.case); assert.equal(run.ended, sc.expect.ended, sc.case);
    if (sc.expect.kept_because) assert.equal(run.traces.at(-1)!.keptBecause, sc.expect.kept_because, `${sc.case}: the reason kept`);
    if (sc.expect.drawing_keeps_revision) {
      const d = run.traces.at(-1)!, before = run.traces.at(-2)!;
      assert.equal(d.patch.by, 'drafter'); assert.equal(d.revisionAfter, before.revisionAfter, 'the drawing leaves the model\'s revision');
      assert.ok(run.final.drawing, 'a drawing made');
    }
    assert.equal(JSON.stringify(runSummary(await runScenario(sc, evaluate))), out, `${sc.case}: a rerun differs`);
  }
});

test('the reviewers are structurally read-only: each view its fixed keys, frozen, with nothing of the patch; they run in parallel and are joined by role', async () => {
  const views: Record<string, ReviewView> = {}, order: string[] = [];
  // (The DFM reviewer slower than the Analysis one: the trace is in role order all the same.)
  const slow = (r: ReviewerRole, ms: number): ReviewerRole => ({ ...r, review: async v => { views[r.name] = v; await new Promise(res => setTimeout(res, ms)); order.push(r.name); return r.review(v); } });
  const dfm = slow(scriptedReviewer('dfm', []), 30), analysis = slow(scriptedReviewer('analysis', []), 0);
  const s = { doc: { ...emptyDoc(), process: 'fdm' }, bodies: [] as never[] }, rationale = 'SECRET-RATIONALE-v2';
  const out = await integrate(s, { id: 'p', by: 'designer', base: revisionOf(s.doc), rationale, ops: [{ tool: 'run_command', args: { command: 'box', values: { w: 20, d: 20, h: 10, x: 0, y: 0, z: 0 } } }] }, evaluate, { seq: 1, reviewers: [dfm, analysis] });
  assert.equal(out.trace.decision, 'applied');
  assert.deepEqual(order, ['analysis', 'dfm'], 'the faster one ended first');
  assert.deepEqual(out.trace.reviews!.map(r => r.role), ['analysis', 'dfm'], 'joined by role name');
  assert.deepEqual(Object.keys(views.dfm).sort(), [...DFM_VIEW_KEYS].sort()); assert.deepEqual(Object.keys(views.analysis).sort(), [...ANALYSIS_VIEW_KEYS].sort());
  for (const v of Object.values(views)) {
    assert.ok(Object.isFrozen(v));
    const t = JSON.stringify(v); for (const leak of [rationale, '"ops"', 'run_command', '"patch"']) assert.ok(!t.includes(leak), leak);
    // (Nothing callable: no state, evaluate or dispatcher in reach.)
    assert.ok(!Object.values(v).some(x => typeof x === 'function'));
  }
  assert.equal(views.dfm.process, 'fdm');
});
