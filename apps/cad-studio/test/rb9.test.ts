import test from 'node:test';
import assert from 'node:assert/strict';
import { prng, sample } from '../src/rb9/core';
import { RUNGS } from '../src/rb9/rungs';
import { reportRb9, runRb9 } from '../src/rb9/report';

// RB9.1 (O70, O71): the ladder with the scripted agent — every built rung passes all five trials (pass^5 = 1, RS 1),
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
