# #404: same-session first-paint rerun (twb vs BaroCSS)

Replaces the #383 "24 vs 43 ms" claim (one session, N not stated) with a run that follows the timing rule in
`docs/autonomy-v3.md`: both arms in one session, interleaved, N and median with min–max stated.

## Method

- Harness: the #198 server and probe (`scripts/mcp-html-probe/`), metric `timeToFinalStyled` (ms from navigation
  start until computed styles first equal the settled final state), typical CSP, the 4 fixed sections.
- Bundles from jsDelivr, in memory only (`shim.mjs`): `@tailwindcss/browser@4.1.13`, `@barocss/browser@0.10.3` UMD.
- One warm-up round (all pages, both arms) discarded, then 10 rounds; each round loads every section with both
  arms, arm order alternating per round. A fresh page per load, one browser.
- Machine/engine: Apple M3 Max (14 cores), Darwin 24.6.0, headless Chromium 148.0.7778.96 (Playwright chromium-1223).
  Run 2026-09-27. No other probe was running.

```
PW_DIR=... CHROME=... PROBE_PORT=7850 TWB_DIR=/__mem__/twb BARO_UMD=/__mem__/baro.js \
  node --import ./scripts/first-paint-404/shim.mjs scripts/first-paint-404/run.mjs 10
```

## Result (`result.json`)

| arm | N page loads | median | min–max |
|---|---|---|---|
| twb 4.1.13 | 40 | 24.1 ms | 21.4–31.5 ms |
| BaroCSS 0.10.3 | 40 | 41.9 ms | 33.0–237.2 ms |

- The gap holds: every twb load (max 31.5) is faster than every BaroCSS load (min 33.0).
- BaroCSS is bimodal: 26 loads at 33–45 ms, 14 at 176–237 ms, spread over all 4 sections and both arm orders
  (8 of the 14 when BaroCSS went first). twb shows no slow mode. Cause not investigated (side note: possibly a
  scheduling fallback in the runtime's first generation pass); it widens the claim's spread but not its direction.
- `summary.*.perRoundMedian` (median of the 4 sections per round) is skewed by the bimodality; use `allPageLoads`.
