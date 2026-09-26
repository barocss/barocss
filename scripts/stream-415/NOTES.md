# #415 token-streamed AI HTML vs settled insert: INCOMPLETE (no numbers)

Harness: `run.mjs` replays the 10 #364 outputs (`scripts/mcp-model-outputs/outputs-tw`) at about 4 chars/token into a
page running the local `@barocss/browser` build (`baroBoot()` default config, GC on, grace 3000 ms). Conditions:
a settled insert, plus an `innerHTML` re-render and an append-only `incremental` merge at 20/50/100 tok/s. It measures:
- junk rules (generated classes absent from the final DOM)
- `applyParseResults` calls
- per-frame computed-style samples that match neither the unstyled nor the final value
- time from the last token to the final style
- cache size at the end and after a 7 s GC wait

Rerun: `pnpm --filter @barocss/kit --filter @barocss/browser build:library && PW_DIR=... CHROME=... [RATES=50,100] node scripts/stream-415/run.mjs [rounds=2] [conc=10]`

Status: I made two attempts in one session (N=20 per condition, concurrency 10). Both ran past the 40 min budget and
were killed before `result.json` was written. The full run finished about 100 of 140 trials in about 30 min; the
RATES=100-only run did not finish in 580 s. Likely cause: every page calls getComputedStyle on every element for 16
properties each frame, while 10 pages share the CPU. Next step: sample every ~100 ms, write partial results after
each trial, and lower the concurrency. No conclusion.
