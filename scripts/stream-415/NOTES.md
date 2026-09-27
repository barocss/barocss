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

## Confirming run (2026-09-27, v3/issue-415b): BLOCKED by the host, N still below target

Harness changes: one browser per invocation, a new 1300x900 context per trial, concurrency 1, background-throttling
flags, 100 ms sampling on class-bearing elements, result.json appended per trial, CLI `run.mjs rounds conc rate`,
`DOCS=a,b` slice, `REF_CACHE` (refs reused across invocations), resume (skips done cond/doc pairs), a 60 s trial cap
that ends the invocation, and a hard in-process deadline (`DEADLINE_S`, default 450). The earlier partial
result.json was replaced (it stays in history). Rerun: `PW_DIR=... CHROME=... REF_CACHE=/tmp/refs.json
node scripts/stream-415/run.mjs 1 1 100` (with MODES=, SETTLED=0, DOCS=), repeated until N=10.

| condition | N | junk rules | calls | wrong-style samples | streams w/ wrong | last token→final med / p90 | cache end / after GC |
|---|---|---|---|---|---|---|---|
| settled | 3 | 0 | 1 | 0% | 1/3 | 28 / 238 ms | 43 / 43 |
| innerHTML@100 | 1 | 0 | 23 | 0.6% | 1/1 | 0.6 / 0.6 ms | 51 / 51 |
| incremental@100 | 6 | 0 | 22 | 0.4% | 5/6 | 0.5 / 0.6 ms | 58 / 58 |
| 50 and 20 tok/s | 0 | not measured | | | | | |

Why so few: the machine (load 10 to 23 from other sessions) repeatedly froze processes for minutes; a trial that
normally takes about 27 s hit the 60 s cap, and one invocation completed 0 trials. `pnpm install` also hung, so the
runtime is the integration checkout's prebuilt `@barocss/browser` dist (same develop).

Reading: every new trial agrees with the partial run (0 junk rules, 0 junk cached, GC has nothing to reclaim, final
style under 1 ms after the last token, wrong-style samples under 1%). "No BaroCSS gap; APP owns any flicker" still
holds, but it is not confirmed at N>=10 or at 20/50 tok/s. Next: rerun on an idle machine (the harness resumes).

## Confirming run, rounds (2026-09-27, v3/issue-415c): N = 10 per condition, all 7 conditions

Design: 10 rounds; round i = doc i under all 7 conditions (settled, innerHTML and incremental at 20/50/100 tok/s),
interleaved in one browser, each round its own `timeout 470` invocation, committed after each round. Every doc is cut
to `MAX_CHARS=3000` (the elements that close within the first 3000 chars, plus the open ancestors closed), for ALL
conditions, so 20 tok/s trials stay under the 60 s cap. Load averages (1/5/15 min) at each round start are in
`loads.json`: 1-min 4.3 to 9.7 (5-min 5.9 to 7.6). Runtime: the integration checkout's prebuilt
`@barocss/browser` dist (same develop), symlinked to `packages/barocss-browser/dist/cdn`.
Rerun per round: `PW_DIR=... CHROME=... MAX_CHARS=3000 REF_CACHE=/tmp/refs.json DOCS=i,i+1 node scripts/stream-415/run.mjs 1 1`
for i = 0..9.

Verdict metrics (counts, not sensitive to load):

| condition | N | junk rules (med / max) | calls/stream | wrong-style samples | streams w/ wrong | cache end / after GC | junk cached after GC |
|---|---|---|---|---|---|---|---|
| settled | 10 | 0 / 0 | 1 | 0% | 0/10 | 56 / 56 | 0 |
| innerHTML@20 | 10 | 0 / 0 | 17 | 0.8% | 8/10 | 56 / 56 | 0 |
| incremental@20 | 10 | 0 / 0 | 17 | 0.8% | 8/10 | 56 / 56 | 0 |
| innerHTML@50 | 10 | 0 / 0 | 17 | 0.7% | 8/10 | 56 / 56 | 0 |
| incremental@50 | 10 | 0 / 0 | 17 | 0.8% | 8/10 | 56 / 56 | 0 |
| innerHTML@100 | 10 | 0 / 0 | 17 | 0.6% | 8/10 | 56 / 56 | 0 |
| incremental@100 | 10 | 0 / 0 | 17 | 0.8% | 8/10 | 56 / 56 | 0 |

Timing (report only), last token to final style, median / p90: settled 29 / 35 ms; innerHTML 0.7-0.8 / 0.8-1.3 ms;
incremental 0.3-0.4 / 0.5-1.1 ms. Stream duration at 20/50/100 tok/s: 37 / 15 / 7.5 s.
`incremental` on opus-2 never matched the reference at any rate (3 trials): its merged DOM differs in one layout
width from a settled insert. That comes from the harness merge, not the runtime (0 junk, same cache).

Reading: every wrong-style sample in all 70 trials is `width` (innerHTML 851, incremental 1460 samples). No
color, background or spacing value was wrong. That is layout from content that hasn't arrived yet, not a partial
class resolving. Setting classes only on tag close (`incremental`) doesn't reduce it. Calls grow with DOM writes
(17 per stream at every rate, one batch per mutation callback), not with the token rate.

**Verdict: no BaroCSS gap, confirmed at N=10 (the checkpoint). The N>=20 acceptance target is still open.**
Ownership: APP for the intermediate layout and for how often it writes to the DOM (recipe: set a class when its tag
closes, or batch writes per frame; docs `guide/integration/build-free-ui.md`, "Streaming AI output"). BAROCSS: none
(no junk rules, GC has nothing to reclaim, final style under 1.5 ms). AGENT: none.
