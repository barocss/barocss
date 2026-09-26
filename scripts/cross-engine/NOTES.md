# #374 cross-engine rerun (Firefox, WebKit)

Engines: Chromium 148.0.7778.96 (baseline, cached chromium-1223 via `executablePath`), Firefox 148.0.2
(Playwright firefox-1511), WebKit 26.4 (Playwright webkit-2272), driven by a local playwright-core 1.59.1
whose `browsers.json` matches the cached revisions. No downloads. Same local build for every engine.

Switch: `ENGINE=firefox|webkit` in o5/csp/embed/cms probes and the fuzz campaign (default `chromium`,
unchanged behaviour). `NORM_QUOTES=1` (o5 only, opt-in) strips `"` from computed-style signatures.
Model outputs: the committed blocks; no model calls.

Rerun: `PW_DIR=... CHROME=... TWB_DIR=... sh scripts/cross-engine/run-all.sh`, then
`ENGINE=<e> node scripts/cross-engine/preflight.mjs`, `ENGINE=<e> node scripts/cross-engine/shadow-font.mjs`,
fuzz: `ENGINE=<e> node --import ./scripts/fuzz/kit-dist-loader.mjs scripts/fuzz/campaign.mjs --minutes 2 --seed 319 --out <outside repo>`.
o5 reads `scripts/o5-probe/.pkgs/{browser,twb}/package`; here those were symlinks to the local build and TWB_DIR.
Probes overwrite `scripts/o5-probe/result.json`; restore it before committing. Numbers: `result.json`.

| probe | Chromium | Firefox | WebKit |
|---|---|---|---|
| o5 #364 (baro root arms) | parity 1, w->h 0, advDrop 0 | parity 0 raw / **1 with NORM_QUOTES**, w->h 0 | = Chromium |
| csp #347 | safe arms parity 1, 0 viol | = (neg-control viol 317/8 vs 572/12) | = Chromium |
| embed #327/#320 baroRoot | open/closed 1, host 0/9 | 0 raw (only font-family diff) | = Chromium |
| cms #231/#253 baro | 1.0 / shell 1.0 | = | = |
| preflight #336 | 0 diffs | 0 diffs | 0 diffs |
| fuzz #319 P1 dropped/cssomUnique | 6.1% | 7.0% | 6.1% |

Attributions:
- Firefox parity 0 (o5, embed shadow arms): probe artifact. Firefox serializes a `var()`-substituted
  `font-family` with the fallback's family names unquoted (BaroCSS preflight's `var(--default-font-family,
  var(--font-sans, ... 'Segoe UI' ...))` on `:host`), while the reference prints them quoted. Same families
  (`shadow-font.mjs`); with quotes normalized o5 parity is 1.000 everywhere. No BaroCSS gap.
- Firefox fewer CSP violation events in the negative-control arms (default runtime without nonce, twb):
  engine reporting (Firefox coalesces reports); safe arms are 0 everywhere.
- o5 `xo` (cross-origin requests seen by Playwright) 7/6/2 in Chromium, 0 in Firefox/WebKit, while actual
  server hits are identical (1,1,0): Chromium surfaces CSP-blocked attempts as request events. Probe artifact.
- cms safelist arm on WebKit (0.686 vs 0.616): not a BaroCSS arm; animation-timed `animate-bounce`
  transform differs slightly in every engine (timing artifact, known).
- fuzz P1: time-bound, so totals differ; the dropped-rule rate differs by engine CSSOM grammar (Firefox
  slightly stricter). Same class as #319's known P1 findings; P2 (node) identical.

Caveats: headless only; macOS builds of Playwright's Firefox/WebKit, not Safari/iOS proper; single run
each (timing columns not compared); local build instead of the npm-packed 0.10.0 the original probes used.
