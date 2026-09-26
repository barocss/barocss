# #394: attributing the small 0.10.1 regressions from #383

No model calls. Numbers: `result.json`. Raw per-run outputs lived in `.out/` (not committed).

## Method

- Temporary `git worktree`s under `.rel/<v>` at tags `@barocss/browser@0.8.0 … 0.10.1` (plus `.rel/c231` at
  8e073ff, the #231 commit), `pnpm install --frozen-lockfile --prefer-offline`, `build:library` for kit, browser,
  server (`build-releases.sh`). The worktrees were removed afterwards.
- `ssr-run.mjs` / `shell-run.mjs` are develop's `scripts/ssr-probe/run.mjs` and `scripts/json-render-probe/e2e/run.mjs`
  with only the BaroCSS paths (kit dist, server dist, browser UMD) taken from `BARO_ROOT`. Harness, blocks, specs and
  the Tailwind reference (develop's 4.3.3, or `TW_FROM=<path>` to swap it) stay fixed across versions.
- #266: round-robin (`rounds.sh`): each round runs every version once, so machine drift spreads over all versions.
  3 rounds completed (5 planned; stopped on coordinator request) -> **N = 3 per version**. Metric = `hydrateMs`
  (FCP -> hydrated match, the original #266 "unstyledMs"), server cold = median of 50 `new ServerRuntime()` + render.

```
git worktree add --detach .rel/<v> @barocss/browser@<v>      # per version
sh scripts/regress-394/build-releases.sh
sh scripts/regress-394/rounds.sh 5 0.8.0 0.8.1 0.8.2 0.9.0 0.10.0 0.10.1   # ports 7650
node scripts/regress-394/summarize.mjs 0.8.0 0.8.1 0.8.2 0.9.0 0.10.0 0.10.1
sh scripts/regress-394/run.sh shell 1 0.8.0 0.10.1                           # port 7660, needs rerun-383 twb shim
```

## #266 client-only window and server cold start (median [min-max], N=3, ms)

| version | UMD B | client-end opus | client-end haiku | client-head opus | client-head haiku | cold opus | cold haiku |
|---|---|---|---|---|---|---|---|
| 0.8.0 | 229150 | 390 [376-415] | 327 [321-329] | 374 [369-381] | 326 [321-332] | 23.5 [23.0-23.7] | 19.5 [19.4-19.9] |
| 0.8.1 | 229465 | 385 [379-405] | 338 [328-339] | 378 [369-380] | 321 [316-323] | 25.2 [23.9-26.0] | 19.9 [19.7-20.1] |
| 0.8.2 | 230864 | 391 [383-398] | 340 [337-342] | 385 [384-385] | 330 [329-339] | 25.3 [25.1-26.3] | 20.6 [20.6-21.0] |
| 0.9.0 | 235928 | 408 [405-419] | 358 [355-360] | 411 [404-413] | 344 [343-346] | 25.1 [24.9-25.2] | 21.1 [20.8-21.3] |
| 0.10.0 | 239416 | 415 [402-417] | 363 [359-373] | 397 [394-409] | 350 [342-359] | 25.5 [25.2-27.4] | 21.2 [20.7-21.9] |
| 0.10.1 | 241482 | 408 [406-414] | 360 [359-368] | 411 [407-423] | 358 [349-362] | 25.9 [25.2-29.3] | 20.9 [20.3-22.5] |

Reading:
- **Most of the #383 "regression" is environment.** 0.8.0 rerun today gives 390/327 ms and 23.5/19.5 ms, already
  close to the 0.10.1 numbers #383 reported (412/346, 22-28) and far from the old 324/275, 16-20 from another session.
- **A small real slowdown remains:** 0.8.0 -> 0.10.1 is +18..37 ms (+5..10%) on the client window, spreads do not
  overlap for haiku and client-head. The step is at **0.8.2 -> 0.9.0** (+17 ms / +18 ms / +26 ms), with smaller
  creep after. It tracks UMD size (+5 KB decoded at 0.9.0, +12 KB total) under the probe's 4x CPU throttle: 0.9.0
  adds #336 preflight parity and #327 Shadow-DOM root / shared adopted sheets, 0.10.0 #347 CSP paths. Not bisected
  to a single commit (N=3 budget); the attribution to parse/eval of a larger bundle is inferred from the size
  correlation, not measured separately.
- **Server cold start:** +1.5..2.4 ms (+7..10%), mostly at 0.8.0 -> 0.8.1 (opus +1.7 ms) and gradual after; 0.8.1
  adds the #323 theme-variable validation guards and markup end-tag rejection, which run per new runtime. This is
  the cost of a safety guard; warm render is unchanged (0.2 / 0.11 ms).

## #231 app shell 0.997

- Identical `shellParity 0.9972` for 0.8.0, 0.10.1 and a build of the #231 commit itself (8e073ff), with the
  reference Tailwind at 4.3.3, 4.1.18 and 4.1.13 (the #231-era dependency). BaroCSS output did not change it.
- All shell diffs are `height` on three shell elements: `main` (idx 7), the card `div` (idx 8) and `#out` (idx 14),
  i.e. the ancestors of the generated spec content (e.g. 1143 vs 1127 px). They are layout knock-ons of the spec
  misses already counted in element parity, not a shell styling difference.
- So it is neither a regression nor a correctness fix: the reported 1.000 could not be reproduced with any BaroCSS
  build; most likely a reporting slip (e.g. `shellBeforeParity`, which is 1.000).

## Suggested follow-ups (not done here)

- Harness: exclude `height` on ancestors of `#out` from shell parity (or measure the shell with `#out` emptied), so
  spec misses are not double-counted.
- Launch numbers: cite ranges measured in one session with a same-session 0.8.0 baseline; the old 16-20 ms and
  275-324 ms are not comparable.
- If the ~20 ms client-window cost matters: a size check on the UMD (e.g. lazy preflight / shadow-root code paths,
  or minified output). Bisect inside 0.8.2..0.9.0 with N>=5 first.

## Confounds

N = 3, one machine, Chromium only, 4x CPU throttle. The twb shim fetches @tailwindcss/browser into memory (unused
by the metrics above).
