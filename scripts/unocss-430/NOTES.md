# #430: UnoCSS runtime (presetWind4) as a comparison arm — PARTIAL (paused for host)

Versions: @unocss/runtime 66.10.5 (jsDelivr, in memory: preset-wind4.global.js + core.global.js), @unocss/core and
@unocss/preset-wind4 66.10.5 (scratch `.scratch/`, gitignored), reference tailwindcss 4.3.3, @barocss/browser 0.11.1
(integration dist). Chromium 1223, one session, N=3 (#231/#253), N=1 per cell (#364); host load avg ~6-7, three
harnesses ran concurrently, so ms numbers are report-only. twb arms not rerun (no download approved); see #383.

## Rerun (repo root, node_modules + packages/*/dist from a build)
```
PROBE_ARMS=ref,build,baro,uno,uno-noreset UNO_JS=/__uno_mem__/runtime.js PW_DIR=... CHROME=... \
  node --import ./scripts/unocss-430/uno-shim.mjs scripts/json-render-probe/e2e/run.mjs 3   # same for scripts/cms-probe/run.mjs
PROBE_ARMS="ref,none,baro root,baro root + nonce,baro root + nonce + prefilter,uno,uno + nonce + per-root glue" BARO_JS=<umd> \
  UNO_JS=/__uno_mem__/runtime.js ... node --import ./scripts/unocss-430/uno-shim.mjs scripts/o5-probe/run.mjs
node node_modules/vitest/vitest.mjs run --root scripts/unocss-430 corpus-parity.test.ts
```
Defaults of all three harnesses are unchanged without these env vars. `NORM_COLOR=1` (norm-color.mjs) is wired in but NOT yet run.

## Results (strict harness comparator)
| scenario | metric | BaroCSS | UnoCSS default | UnoCSS reset:false |
|---|---|---|---|---|
| #231 AI specs in TW app | element parity | **0.904** | 0.000 | 0.000 |
| | shell parity after / before mount | 0.997 / 1.000 | 0.944 / 0.946 | 0.970 / 0.972 |
| #253 CMS blocks | block element parity | **1.000** | 0.125 | 0.272 |
| | shell vs ref (bad els) | 1.000 (0) | 0.935 (32) | 0.983 (11) |
| #364 shadow + strict CSP | parity (opus/haiku) | 1.000/1.000 (root, no nonce) | 0/0, 60+ CSP violations | glue arm: 0/0 |
| script gz | | 56.7 KB (254 KB raw) | 59.8 KB (216 KB raw) | |
| mount->final (report-only) | #231 / #253 | 0.2 / 38 ms | 75 / 41 ms | |

Node corpora (kit comparator, strict / lenient spelling-normalized): tuned 372: Uno 256/372 (71.5% uses) / 323 (95.6%),
Baro 372/372 (100%); held-out 575: Uno 448/575 (80.2%) / 536 (95.2%), Baro 575/575. corpus-result.json.

## Caveats (why the element-parity 0 is partly an artifact)
- presetWind4 writes colors as `color-mix(in oklab, C 100%, transparent)`: computed `oklab()` vs Tailwind's `oklch()`,
  so the strict signature compare fails on same-looking colors. The NORM_COLOR rerun was not done (paused).
- Real, not artifact: Uno's reset/utilities are unlayered, so they beat the host's layered Tailwind (prose margins,
  lists, headings lost: host damage before any mount); hover not wrapped in `@media (hover:hover)`; `after:` lacks
  `content`; `dark:` is media-based; no nonce option and no shadow-root support in the runtime (needs app glue).
- #364 "baro root + nonce" arms read 0 on this integration build (was 1.0 in #364); not investigated here.

## Left
NORM_COLOR rerun of all three; debug the uno per-root glue arm (0 parity, 52+ violations) and the baro nonce arm;
comparison.md draft row. Tentative conclusion: UnoCSS does not cover these scenarios as shipped (host damage,
no CSP nonce, no shadow roots); its corpus parity is ~95% after spelling normalization, so the gap vs BaroCSS
there is smaller than the strict numbers suggest.
