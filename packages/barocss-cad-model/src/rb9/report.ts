// The RB9 run (O70): every rung's trials (seeded, edge values first) and mutants, summarised; the report as Markdown with
// each trial's seed and sampled values, each predicate that failed, and the mutant kill table.
import { runMutants, runTrial, summarize, type MutantResult, type Rung, type RungSummary, type Trial } from './core';

export interface Rb9Run { seed: number; trials: Trial[]; mutants: MutantResult[]; summaries: RungSummary[] }
/** Each rung: n trials from the seed, then its mutants (on both range ends). */
export async function runRb9(rungs: readonly Rung[], o: { seed: number; trials: number; mutants?: boolean; log?: (line: string) => void }): Promise<Rb9Run> {
  const out: Rb9Run = { seed: o.seed, trials: [], mutants: [], summaries: [] };
  for (const r of rungs) {
    const ts: Trial[] = [];
    for (let k = 0; k < o.trials; k++) { const t = await runTrial(r, o.seed, k); ts.push(t); o.log?.(`${r.n}. ${r.id} #${k}: ${t.pass ? 'pass' : 'FAIL'} (RS ${t.rs.toFixed(3)}) ${JSON.stringify(t.params)}`); }
    const ms = o.mutants === false ? [] : await runMutants(r, o.seed);
    for (const m of ms) if (!m.killed) o.log?.(`${r.n}. ${r.id} mutant ${m.mutant} NOT killed (target ${m.target}; failed ${m.failed.join(', ') || 'nothing'})`);
    out.trials.push(...ts); out.mutants.push(...ms); out.summaries.push(summarize(r, ts, ms));
  }
  return out;
}

const pct = (v: number) => `${(100 * v).toFixed(0)} %`;
/** The report: the rungs' metrics, each trial's seed and values, the mutants. */
export function reportRb9(run: Rb9Run, mode: 'scripted' | 'live' = 'scripted'): string {
  const all = run.summaries, trials = run.trials.length, passed = run.trials.filter(t => t.pass).length;
  const lines = [
    `# RB9 ladder — ${mode === 'scripted' ? 'scripted agent' : 'live'} (seed ${run.seed})`, '',
    'Each rung: n trials on fresh documents, parameters sampled from the seed — trial 0 every parameter at its low end, 1 at its high end, 2 and 3 alternating, then random on the step grid. The checker is hidden from the agent and runs on the part it leaves. pass = every hard predicate holds; pass@1 = c/n; pass@k any, pass^k all; RS = the mean share of hard predicates holding. Each mutant is a seeded wrong design run on both range ends, killed when its targeted predicate fails.', '',
    '| rung | title | passed | pass@1 | pass@k | pass^k | RS | mutants killed | predicates no mutant kills |', '|---|---|---|---|---|---|---|---|---|',
    ...all.map(s => `| ${s.n} | ${s.title} | ${s.passed}/${s.trials} | ${s.pass1.toFixed(2)} | ${s.passAtK ? 1 : 0} | ${s.passPowK ? 1 : 0} | ${s.rs.toFixed(3)} | ${s.killed}/${s.mutants} | ${s.unkilled.join(', ') || '—'} |`),
    '', `Overall: ${passed}/${trials} trials pass (${pct(trials ? passed / trials : 0)}); mutants killed ${run.mutants.filter(m => m.killed).length}/${run.mutants.length}.`, '',
    '## Trials', '', '| rung | trial | seed | parameters | pass | RS | failed | calls | ms |', '|---|---|---|---|---|---|---|---|---|',
    ...run.trials.map(t => `| ${t.rung} | ${t.trial} | ${t.seed} | ${Object.entries(t.params).map(([k, v]) => `${k} ${v}`).join(', ')} | ${t.pass ? 'yes' : 'no'} | ${t.rs.toFixed(3)} | ${[...t.outcomes.filter(o => o.hard && !o.pass).map(o => o.id), ...t.refused.map(() => '(refused)')].join(', ') || '—'} | ${t.calls} | ${t.wallMs} |`),
    '', '## Mutants', '', '| rung | mutant | what is wrong | target | killed | failed |', '|---|---|---|---|---|---|',
    ...run.mutants.map(m => `| ${m.rung} | ${m.mutant} | ${m.why} | ${m.target} | ${m.killed ? 'yes' : '**no**'} | ${m.failed.join(', ') || '—'} |`), '',
  ];
  return lines.join('\n');
}
