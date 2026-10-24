// The AI evaluation's store (the owner, 2026-10-24: a future site collects prompts and their results, so every run is
// kept in a stable, structured form outside git and outside any session's scratchpad). Default ~/.cache/barocss-ai-eval:
//
//   index.json                      barocss-ai-eval/index@1: every brief and its runs (below)
//   report.md, details.md           the evaluation's tables and each run's failures (for people)
//   <brief-id>/<run-n>/             one run, n = 1, 2, … in the order run
//     prompt.txt                    the user message as the agent read it (state note, brief, the person's file note)
//     part.bcad                     the document the run left (the studio opens it)
//     render-<view>.png             stills (iso, iso-back, front, side, top), orthographic; render.png = the iso one
//     camera.json                   each still's camera (barocss-ai-eval/camera@1)
//     score.json                    barocss-ai-eval/score@1: the judgement, elements, calls, turns, model, harness, timings
//     record.json                   barocss-ai-eval/record@1: every call (arguments, result, time), the person's accepts, the agent's messages
//     review.json                   (long briefs) the reviewer's per-element judgement of the stills, where no oracle can script it
//     work/events.jsonl             Codex's raw events; work/ also holds the run's state file and instructions
import { existsSync, mkdirSync, readdirSync, renameSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';

export const SCORE_SCHEMA = 'barocss-ai-eval/score@1', RECORD_SCHEMA = 'barocss-ai-eval/record@1', INDEX_SCHEMA = 'barocss-ai-eval/index@1', CAMERA_SCHEMA = 'barocss-ai-eval/camera@1', REVIEW_SCHEMA = 'barocss-ai-eval/review@1';
const RESERVED = new Set(['runs']);

/** Every kept run: its brief, its number and its folder, in brief then run order. */
export function runDirs(store: string): { brief: string; n: number; dir: string }[] {
  const out: { brief: string; n: number; dir: string }[] = [];
  for (const b of existsSync(store) ? readdirSync(store, { withFileTypes: true }) : []) {
    if (!b.isDirectory() || RESERVED.has(b.name) || b.name.startsWith('.')) continue;
    for (const r of readdirSync(join(store, b.name))) if (/^\d+$/.test(r) && existsSync(join(store, b.name, r, 'record.json'))) out.push({ brief: b.name, n: Number(r), dir: join(store, b.name, r) });
  }
  return out.sort((a, b) => a.brief.localeCompare(b.brief) || a.n - b.n);
}
/** The next run's folder for a brief, made at once (mkdir is atomic: two series never take the same n). */
export function newRunDir(store: string, brief: string): { n: number; dir: string } {
  mkdirSync(join(store, brief), { recursive: true });
  for (let n = 1; ; n++) {
    const dir = join(store, brief, String(n));
    try { mkdirSync(dir); return { n, dir }; } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; }
  }
}
/** The first layout (runs/<brief>/<stamp>-r<k>/) moved into this one, oldest first; runs left unfinished stay. */
export function migrate(store: string): string[] {
  const old = join(store, 'runs'), moved: string[] = [];
  if (!existsSync(old)) return moved;
  for (const b of readdirSync(old)) for (const r of readdirSync(join(old, b)).sort()) {
    const from = join(old, b, r);
    if (!existsSync(join(from, 'record.json'))) continue;
    const { dir } = newRunDir(store, b);
    rmdirSync(dir); renameSync(from, dir);
    moved.push(`${b}/${r} → ${dir}`);
  }
  return moved;
}
