# #448 class-based dark text ordering

## Cause and fix

The accepted #438 fixture generated `.dark\\:text-white:where(.dark, .dark *)` without a leading `@media`. The shared `ruleSortKey` classified it with base rules, then sorted by property and class name. `dark:text-white` came before `text-slate-900`, and both selectors had equal specificity in the matched custom variant. The base text rule therefore won in dark mode. The change gives a parsed top-level class-based `dark:` segment the existing late dark variant group. It ignores colons inside arbitrary values, arbitrary selectors and escaped text. The media-based dark rule keeps its current key. This is a sort-key change; rule insertion and selector generation remain unchanged.

## Evidence

- The two kit order tests and two dynamic browser tests failed on the #438 baseline. They pass after the fix. Independent Review found a first-draft false positive: `[--mode:dark:active]` was treated as a dark variant. The accepted Tailwind and baseline order resolves `[--mode:dark:active] [--mode:light]` to `light`; the top-level-segment parser and new isolation regression preserve that order in both discovery orders. The browser tests add the second class after observation, in both discovery orders.
- `run.mjs` compares Tailwind 4.3.3 with the rebuilt BaroCSS CDN bundle in installed Chromium 148.0.7778.96. All eight cells (two static orders, two dynamic orders, each in light and dark) have the same computed text color and byte-identical probe screenshots. The exact colors and bundle SHA are in `result.json`.
- The accepted #438 fixture was rerun with `BARO_EVIDENCE_DIR` pointed to a temporary directory. Its dark tile went from 1.24% marked pixel difference and a color computed difference to 0.00% and no computed difference. The other four visual mismatch identities stayed unchanged; the three authored showcases remained at 0.00%. This follow-up did not rewrite #438's accepted evidence.
- Kit corpus parity is 372/372 classes (2781/2781 uses); held-out parity is 575/575 classes (1179/1179 uses) against Tailwind 4.3.x. Both `KNOWN_FAILURES` maps remain empty. These single-token corpora do not measure class-combination cascade order; the new regressions cover that case.
- Full kit, browser and server tests, type-check and lint passed. Local builds and package archive validation passed. Browser fuzz ratchet: fixed seeds 319/1/7777 and rotating seed 20260927 each ran 20,000 inputs; P2=P3=P4=0, fixed-seed P1 counts 470/515/431 within baseline. The rotating P1 count is 487 and report-only.

No other #438 gradient, background or mask gap is changed. The browser comparison covers this authored text probe and one Chromium build; it does not claim all dark-mode UI, other browsers or production deployment.
