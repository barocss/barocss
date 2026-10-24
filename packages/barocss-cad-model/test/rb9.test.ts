import test from 'node:test';
import assert from 'node:assert/strict';
import { prng, runTrial, sample, summarize } from '../src/rb9/core';
import { RUNGS } from '../src/rb9/rungs';
import { reportRb9, runRb9 } from '../src/rb9/report';

// RB9.1 (O70, O71, O72): the ladder with the scripted agent — every built rung passes all five trials (pass^5 = 1, RS 1),
// edge-of-range values among them; every mutant is killed on both range ends, and every hard predicate has a mutant that
// kills it; the report holds each trial's seed and values.

test('the sampler: trial 0 at every low end, 1 at every high end, 2 and 3 alternating; the same seed the same values; on the step grid', () => {
  const space = [{ key: 'a', lo: 10, hi: 20, step: 0.5 }, { key: 'b', lo: (p: Record<string, number | string>) => p.a as number, hi: 40, step: 1 }, { key: 'c', choice: ['x', 'y', 'z'] }] as const;
  assert.deepEqual(sample(space, 7, 0), { a: 10, b: 10, c: 'x' }); assert.deepEqual(sample(space, 7, 1), { a: 20, b: 40, c: 'z' });
  assert.deepEqual(sample(space, 7, 2), { a: 10, b: 40, c: 'x' }); assert.deepEqual(sample(space, 7, 3), { a: 20, b: 20, c: 'z' });
  assert.deepEqual(sample(space, 7, 4), sample(space, 7, 4)); assert.notDeepEqual(sample(space, 7, 4), sample(space, 8, 4));
  for (let k = 4; k < 40; k++) { const p = sample(space, 3, k); assert.ok(Number.isInteger((p.a as number) * 2) && (p.a as number) >= 10 && (p.a as number) <= 20 && (p.b as number) >= (p.a as number) && (p.b as number) <= 40); }
  const r = prng(1); assert.ok([r(), r(), r()].every(v => v >= 0 && v < 1));
});

test('the ladder (scripted): every built rung 5/5, RS 1; every mutant killed; no hard predicate without a mutant that kills it', async () => {
  const run = await runRb9(RUNGS, { seed: 2026, trials: 5 });
  for (const s of run.summaries) {
    assert.ok(s.passPowK && s.pass1 === 1 && s.rs === 1, `${s.rung}: ${s.passed}/${s.trials}, RS ${s.rs} — ${JSON.stringify(run.trials.filter(t => t.rung === s.rung && !t.pass).map(t => [t.params, t.outcomes.filter(o => !o.pass)]))}`);
    assert.equal(s.killed, s.mutants, `${s.rung}: ${JSON.stringify(run.mutants.filter(m => m.rung === s.rung && !m.killed))}`);
    assert.deepEqual(s.unkilled, [], `${s.rung}: predicates no mutant kills`);
  }
  console.log(`RB9.1: ${run.summaries.map(s => `${s.n} ${s.passed}/${s.trials} (${s.killed}/${s.mutants} mutants)`).join(' · ')}`);
  const md = reportRb9(run);
  for (const t of run.trials) assert.ok(md.includes(`| ${t.rung} | ${t.trial} | 2026 | ${Object.entries(t.params).map(([k, v]) => `${k} ${v}`).join(', ')} |`), `${t.rung} #${t.trial}: its seed and values in the report`);
});


test('trial timing: public seconds and JSON keep the original rounded interval; Markdown keeps integer ms and metrics', async t => {
  let reads = 0;
  const clock = t.mock.method(performance, 'now', () => ++reads === 1 ? 0 : 250.4);
  let trial;
  try { trial = await runTrial(RUNGS[0], 2026, 0); } finally { clock.mock.restore(); }
  const json = JSON.parse(JSON.stringify(trial));
  assert.equal(json.wallTime, 0.250);
  assert.ok(!('wallMs' in json));
  assert.deepEqual(json.params, { w: 30, d: 30, h: 8, dh: 3 });
  assert.deepEqual([trial.pass, trial.rs, trial.calls, trial.refused], [true, 1, 2, []]);
  const predicates = ['box', 'volume', 'solids', 'bore', 'through'];
  const summary = summarize(RUNGS[0], [trial], []);
  assert.deepEqual(summary, { rung: 'block-hole', n: 1, title: 'block with hole', trials: 1, passed: 1, pass1: 1, passAtK: true, passPowK: true, rs: 1, mutants: 0, killed: 0, predicates, unkilled: predicates });
  const report = reportRb9({ seed: 2026, trials: [trial], mutants: [], summaries: [summary] });
  assert.ok(report.includes('| calls | ms |'));
  assert.ok(report.includes('| block-hole | 0 | 2026 | w 30, d 30, h 8, dh 3 | yes | 1.000 | — | 2 | 250 |'));
  assert.ok(report.includes('Overall: 1/1 trials pass (100 %); mutants killed 0/0.'));
});
