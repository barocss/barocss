// `pnpm ab` (A5.5, O13): the A/B over the briefs (server/ab/briefs.ts), each arm, k runs; results.json and report.md.
//   pnpm ab --scripted [--runs 3] [--briefs id,id] [--arms json,hybrid] [--out dir]     the dry run (no model)
//   CAD_AB_LIVE=1 pnpm ab --live [--model m] …                                           live: the claude CLI, billed
// Live runs need both --live and CAD_AB_LIVE=1: a model run is the owner's call (usage, cost), never a default.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { BRIEFS, type Arm } from './briefs';
import { reportAb, runAb } from './harness';

export async function abMain(argv: readonly string[], paths: { mcpScript: string; scripted: string }): Promise<number> {
  const get = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const live = argv.includes('--live'), scripted = argv.includes('--scripted');
  if (live === scripted) { process.stderr.write('ab: pass --scripted (the dry run) or --live\n'); return 2; }
  if (live && process.env.CAD_AB_LIVE !== '1') { process.stderr.write('ab: live runs call the model and are billed: set CAD_AB_LIVE=1 as well as --live (the owner decides)\n'); return 2; }
  const ids = get('--briefs')?.split(','), arms = (get('--arms')?.split(',') ?? ['json', 'hybrid']) as Arm[];
  const briefs = ids ? BRIEFS.filter(b => ids.includes(b.id)) : BRIEFS;
  if (!briefs.length || ids && briefs.length !== ids.length) { process.stderr.write(`ab: briefs are ${BRIEFS.map(b => b.id).join(', ')}\n`); return 2; }
  if (!arms.every(a => a === 'json' || a === 'hybrid')) { process.stderr.write('ab: arms are json and hybrid\n'); return 2; }
  const runs = Number(get('--runs') ?? 3), out = resolve(get('--out') ?? join(process.cwd(), `ab-${live ? 'live' : 'scripted'}`));
  if (!Number.isInteger(runs) || runs < 1) { process.stderr.write('ab: --runs is a whole number\n'); return 2; }
  mkdirSync(out, { recursive: true });
  const results = await runAb({ mode: live ? 'live' : 'scripted', briefs, arms, runs, claude: live ? (process.env.CAD_STUDIO_CLAUDE ?? 'claude') : paths.scripted, ...(get('--model') ? { model: get('--model')! } : {}), mcpScript: paths.mcpScript, workDir: mkdtempSync(join(tmpdir(), 'cad-ab-')), log: l => process.stderr.write(`${l}\n`) });
  writeFileSync(join(out, 'results.json'), JSON.stringify(results, null, 1) + '\n');
  writeFileSync(join(out, 'report.md'), reportAb(results, live ? 'live' : 'scripted'));
  process.stdout.write(`${reportAb(results, live ? 'live' : 'scripted')}\nwritten: ${out}\n`);
  return 0;
}
