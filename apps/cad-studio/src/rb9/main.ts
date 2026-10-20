// `pnpm rb9` (O70): the RB9 ladder with the scripted agent — every built rung, n trials from a seed, its mutants;
// results.json and report.md. Live trials (a real model) wait for the owner's go-ahead and are not run here.
//   pnpm rb9 [--seed 2026] [--trials 5] [--rungs id,id] [--no-mutants] [--out dir]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { RUNGS } from './rungs';
import { reportRb9, runRb9 } from './report';

export async function rb9Main(argv: readonly string[]): Promise<number> {
  const get = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  if (argv.includes('--live')) { process.stderr.write('rb9: live trials call a model and wait for the owner\'s go-ahead (O70); this command runs the scripted agent only\n'); return 2; }
  const ids = get('--rungs')?.split(','), rungs = ids ? RUNGS.filter(r => ids.includes(r.id)) : RUNGS;
  if (!rungs.length || ids && rungs.length !== ids.length) { process.stderr.write(`rb9: rungs are ${RUNGS.map(r => r.id).join(', ')}\n`); return 2; }
  const seed = Number(get('--seed') ?? 2026), trials = Number(get('--trials') ?? 5), out = resolve(get('--out') ?? join(process.cwd(), 'rb9-scripted'));
  if (!Number.isInteger(seed) || !Number.isInteger(trials) || trials < 1) { process.stderr.write('rb9: --seed and --trials are whole numbers\n'); return 2; }
  const run = await runRb9(rungs, { seed, trials, mutants: !argv.includes('--no-mutants'), log: l => process.stdout.write(`${l}\n`) });
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'results.json'), JSON.stringify(run, null, 1) + '\n');
  writeFileSync(join(out, 'report.md'), reportRb9(run));
  process.stdout.write(`written: ${out}\n`);
  return run.summaries.every(s => s.passPowK && s.killed === s.mutants && !s.unkilled.length) ? 0 : 1;
}
