# #405: the bimodal first-paint tail

## Rerun

```
pnpm install --frozen-lockfile && pnpm --filter @barocss/kit build && pnpm --filter @barocss/browser build:library
PW_DIR=... CHROME=... sh scripts/first-paint-405/runall.sh     # or: node scripts/first-paint-405/run.mjs <variant> 10
node scripts/first-paint-405/summarize.mjs                      # raw/*.json -> result.json
```

Harness: the #404/#198 server, probe, sections and typical CSP, unchanged. Playwright routing adds
`performance.mark`s around bundle execution, the boot call, DOMContentLoaded and boot completion (the whole
scan + generate + insert is synchronous inside `observe({scan:true})`), and makes the probe also report every
time the computed-style signature changes, the paint entries and the bundle's resource timing. N=40 per variant
(10 rounds x 4 sections, warm-up discarded), headless Chromium 148, local build unless noted.

## Phase breakdown (medians, ms from navigation start)

| | bundle fetch | bundle exec | DCL | boot work (scan+generate+insert) | boot done | probe's 1st frame | style changes | animating |
|---|---|---|---|---|---|---|---|---|
| fast (38/40, focus) | 7 | 0.9 | 16 | 20.5 | 36.6 | 37.4 (after boot) | 1 | 0 |
| slow (2/40, focus) | 27 | 1.1 | 57 | 26.6 | 75.3 | 55.5 (BEFORE boot) | 21 | 159.5 |
| slow (2/40, headed) | 7 | 1.0 | 17 | 21.8 | 38.9 | 16 (BEFORE boot) | 20 | 150.9 |

Every runtime phase is the same in slow and fast loads. The ~150 ms is not in BaroCSS work: in a slow load the
computed style changes on **every frame for ~150 ms after boot**, i.e. a CSS transition is running.

## Root cause

All four sections use `transition` / `transition-colors` (150 ms default duration). If a style recalc runs before
the runtime inserts its CSS (here: the probe's first rAF `getComputedStyle` lands before DOMContentLoaded + boot),
the elements have an unstyled "before-change" style. When BaroCSS's rules arrive, `transition-property` covers
colors/background/border/shadow/transform, so the browser animates from the unstyled values to the final ones for
150 ms. `timeToFinalStyled` then reads boot time + ~150 ms. When the first recalc happens after boot, there is no
before-change style, no transition, and the load is fast. Across all runs slow <=> "first sample before boot":
6/6 slow loads, 0 exceptions in 320 loads (plus 1/40 in a first base run, same signature).

It's not timer throttling and not a scheduling delay in the runtime. It's a real race between the first style
recalc and the runtime's DCL-deferred insertion. A real page hits it too when the browser renders a frame before
DCL (visible as a FOUC that then animates in). Its frequency depends on the harness and machine load: 14/40 in #404,
0–2/40 here.

## A/B (slow = timeToFinalStyled > 100 ms, N=40 each)

| variant | slow | median | reading |
|---|---|---|---|
| base (headless, local build) | 0 (1 in an earlier run) | 34.9 | |
| (a) `--disable-background-timer-throttling` + renderer flags | 0 | 37.7 | throttling not required |
| (a) headed | 2 | 35.9 | tail persists headed: not a headless artifact |
| (a) focused page (`bringToFront`) | 2 | 37.4 | persists |
| (b) CDN 0.10.3 bundle (in memory) | 0 | 37.3 | CDN bytes not the cause |
| (c) flush scheduling | n/a | | no rAF/idle/timeout on the path: scan+generate+insert are synchronous in `observe()` at DCL (the kit's `setTimeout` debounce isn't used by the first scan) |
| (d) preflight on (`baropf`) | 1 | 35.1 | same signature; insertion is not the stall |
| (e) boot at end of `<body>` (no DCL wait) | 0 | 36.3 | inconclusive at this rate, but it narrows the window |
| transition classes stripped (`notrans`) | 0 | 37.4 | removes the mechanism (in slow loads it's the only thing changing) |
| twb 4.1.13 | not run | | killed for time. twb's #404 spread suggests its CSS always lands before the first recalc |

Caveat: the slow rate in this session (0–2/40) is far below #404's 14/40, so the per-variant counts can't show
significance on their own. The attribution rests on the per-load trace (the 150 ms of per-frame style changes
right after boot, and slow <=> pre-boot sample), not on rate differences.

## Proposed minimal fix (follow-up, no code here)

Close the window before the first unstyled recalc can happen. When the bundle runs in `<head>` before the body
exists, insert the rules synchronously for classes found as early as possible, and don't wait for DOMContentLoaded
to do the first scan: observe `document.documentElement` from script start and generate on each parser-inserted
batch. Alternative: while `baro-boot-doing` is set, the runtime suppresses transitions (inserts
`.baro-boot-doing *{transition:none!important}` and removes it after the first rAF following the insert).
Expected effect: the 150 ms tail goes away (slow loads become ~40 ms), and the median doesn't change.

## Correction for #404

#404's BaroCSS tail (14/40 at 176–237 ms) is the transition animation (the 150 ms default plus boot), triggered when
the probe's first style sample preceded BaroCSS's DCL-time insertion. It isn't generation cost. Report the fast mode
(median ~42 ms, 33–45) as BaroCSS's time to styled, with the tail listed separately as "unstyled-first-frame +
transition" (a real FOUC risk, whose frequency depends on the harness). The metric should also treat "animating
toward the final state" separately from "final rules applied". twb still wins the fast mode (24 vs ~42 ms).
