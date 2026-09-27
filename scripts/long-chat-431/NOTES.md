# #431 long-running synthetic AI chat (research only)

## Reproduce

Use a local Playwright installation and an already installed Chromium. From the repository root, build the browser bundle from the local `develop` revision under test, then set:

```sh
export PW_DIR=/path/to/existing/playwright-project
export CHROME=/path/to/existing/chrome-headless-shell
export BARO_DIST="$PWD/packages/barocss-browser/dist/cdn"
export INTERVAL=20
node scripts/long-chat-431/run.mjs 1 1
node scripts/long-chat-431/run.mjs 1 0
node scripts/long-chat-431/run.mjs 0 1
node scripts/long-chat-431/run.mjs 0 0
node scripts/long-chat-431/run.mjs 0 none
node scripts/long-chat-431/verify.mjs
```

Run the five arms serially because browser load affects timing. Each appends 2,000 messages from ten top-level blocks in `scripts/mcp-model-outputs/outputs-tw`, plus three new arbitrary-value classes per message. The virtualized arms retain the last 50. The original three-arm evidence remains in `result.json`; `result-post440.json` is the matched five-arm rerun after #440. The result JSON samples every 100 messages. `cssTextChars` sums CSSOM `cssText` lengths, including nested rules; it is a character count, not process memory. `cssInserts` and `cssDeletes` count successful CSSOM method calls and exclude text rebuilds. `domElements` counts descendants of the message list. The runtime's own class/rule/reclamation counters are also included. Heap is sampled after an exposed JS GC; insert time and host load are report-only.

Recorded environment: local `develop` at `894b08659ded7ebbc88541f74558754ad86b0f55`, browser bundle SHA-256 `825a7df6e4c860d1bb3ea6e331ccc0dbad6bb6c72112f50ba2341277b2815efc`, Chrome for Testing 148.0.7778.96, Node 22.19.0, `N=2000 INTERVAL=20 UNIQUE=3 KEEP=50`. No model calls or downloads occurred.

## Count results after #440

| Arm | Live messages / descendants at 2,000 | CSSOM rules at 500 / 1,000 / 2,000 | CSSOM chars at 2,000 | Styles at 2,000 / after 8 s | Heap MB at 2,000 | Reclaimed classes after 8 s |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Virtualized, GC on | 50 / 2,165 | 942 / 855 / 1,053 | 81,869 | 36 / 24 | 5.50 | 5,850 |
| Virtualized, GC off | 50 / 2,165 | 1,866 / 3,366 / 6,366 | 295,414 | 163 / 163 | 9.08 | 0 |
| Retained, GC on | 2,000 / 86,600 | 1,866 / 3,366 / 6,366 | 295,414 | 163 / 163 | 17.49 | 0 |
| Retained, GC off | 2,000 / 86,600 | 1,866 / 3,366 / 6,366 | 295,414 | 163 / 163 | 12.77 | 0 |
| Retained, no runtime | 2,000 / 86,600 | 0 / 0 / 0 | 0 | 0 / 0 | 11.25 | n/a |

The virtualized/GC-on arm settled to **516 rules**, 59,748 CSSOM characters, 24 style elements, 419 cached classes, and 5.20 MB heap after eight seconds. In the earlier pre-#440 run, its `<style>` count reached 133 at 2,000 even while rules were reclaimed. The integrated #440 `StylePartitionManager.removeRule` now removes a segment when GC empties it; the post-#440 run shows no empty styles and a smaller settled count. This is observed bounded behavior over 2,000 messages, not a proof of an indefinite bound.

Without GC, three new classes per message keep increasing the rule count despite virtualizing DOM: 1,866 to 6,366 rules from 500 to 2,000 messages. With all messages retained, GC cannot reclaim classes because they remain referenced; GC-on and GC-off had identical rule and style counts. This is retained content, not evidence of a GC leak. The no-runtime baseline retained the same 86,600 DOM descendants but created no CSS rules. At 2,000, the runtime arms had 6,303 successful CSSOM insert calls and 2,492 delete calls; the no-runtime arm had zero. These counts attribute CSSOM work to the runtime and DOM growth to retained messages. They do not assign a precise share of wall time to either source.

## Timing and limits

The last 100-message window took 48.26–48.59 ms/message in retained runtime arms and 17.04 ms/message in the retained no-runtime arm; first-window values were 4.15–5.76 and 3.91 ms/message respectively. The virtualized arms stayed at 5.27–5.96 ms/message in the last window. These are single serial runs under different host load, so they are descriptive only. No timing threshold is a verification gate. The earlier pre-#440 164 ms/message report did not reproduce under this matched setup; its exact cause remains unknown.

A practical long-chat recipe is to remove old DOM messages and keep GC enabled. #440 addressed the prior empty-style accumulation in this synthetic workload. No new browser-runtime product change is proposed from this research. Browser engines other than this Chromium build, wider class mixes, longer durations, and repeated-run variance were not measured.
