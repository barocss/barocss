# #415 token-streamed AI HTML vs settled insert (PARTIAL, low N)

Harness: `run.mjs` replays the 10 #364 outputs (`scripts/mcp-model-outputs/outputs-tw`) at about 4 chars/token into a
page running the local `@barocss/browser` build (`baroBoot()` default config, GC on, grace 3000 ms). Two stream modes:
- `innerHTML`: re-render the whole growing string on every token
- `incremental`: append-only merge; a class attribute appears once its tag closes

Both are compared with a settled insert. Per trial it records:
- junk rules (generated classes absent from the final DOM)
- `applyParseResults` calls
- wrong style: samples every 100 ms, on the final elements that carry a class, where a value matches neither the
  unstyled nor the final value
- time from the last token to the final style
- cache at the end and after 7 s (GC)

`result.json` is rewritten after each trial.

Rerun (repo root): `pnpm --filter @barocss/kit --filter @barocss/browser build:library`, then
`PW_DIR=... CHROME=... RATES=50 node scripts/stream-415/run.mjs 1 2` (also RATES=20, RATES=100).

## Result (one invocation, RATES=50, concurrency 2, same session): N = 4 / 3 / 3

| condition | N | junk rules | calls | wrong-style samples | streams w/ wrong | last token→final | cache end / after GC |
|---|---|---|---|---|---|---|---|
| settled | 4 | 0 | 1 | 0% | 1/4 | 34 ms (p90 255) | 51 / 51 |
| innerHTML@50 | 3 | 0 | 11 | 0.7% | 2/3 | 0.6 ms | 43 / 43 |
| incremental@50 | 3 | 0 | 11 | 0.8% | 2/3 | 0.3 ms | 43 / 43 |

Wrong-style samples were `color`, `background-color` and `width`, below 1% of the element samples. They are consistent
with a partial class that is valid (e.g. `bg-blue-5` style prefixes) or a first-token class. The cause per sample was
not recorded.

That invocation stalled after 10 trials: rAF and timers were throttled in non-front pages. The script now uses
setTimeout, disables background throttling, and caps each trial at 150 s. A later run could not launch Chromium
(launch timeout, 180 s), and the time budget ran out. The rates 20 and 100 are not measured. N is far below the
target of 10 to 20.

## Reading (provisional)
- No junk: zero generated classes absent from the final DOM in every trial. The runtime batches per mutation
  callback, and partial class strings mostly fail to resolve.
- GC (#269) had nothing to clean up: the cache was unchanged 7 s after the end, with 0 junk cached.
- Calls: about 11 per stream versus 1 settled. The final style lands under 1 ms after the last token, so streaming
  adds no end latency.
- Conclusion: no runtime action (ownership APP for any flicker concern). An app that wants zero intermediate styles
  can render class attributes only on tag close (the `incremental` mode already does this). Confirm with N≥10 at
  20/100 tok/s before closing.
