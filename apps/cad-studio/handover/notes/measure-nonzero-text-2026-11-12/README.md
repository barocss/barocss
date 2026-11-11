# D743 — Preserve nonzero Measure text

P0 display accuracy, rows 15 and 16. SMALL qualification. Parent `f68698fa8621055c64017c23418dea13513dfbcd`. [#2355](https://github.com/barocss/barocss/issues/2355).

The Measure inspector and viewport label pass the raw scalar and the existing rounded numeric text to the Studio quantity formatter. Scientific notation preserves a finite nonzero value when the existing text displays zero. Ordinary output, exact zero, units, signed coordinate differences, the coaxial branch, the existing line threshold and both witness coordinates retain their contracts.

## Qualification

- **FAIL (parent)** — Two actual desktop pick orders measured parallel faces with a native 0.004 mm gap. The current display-mesh consumer returned 0.0039999999999995595 mm. The panel showed 0 mm for Distance and Normal distance. The WebGPU label showed 0 mm. The reversed pick order displayed a zero Z difference.
- **PASS** — Both actual Studio pick orders and the measurement after local Save, Close, reload and Open show `4.00e-3 mm` in the panel and viewport label. Reversed picks show `-4.00e-3` for ΔZ. The `0.0049 mm` control keeps the existing `0.01 mm` panel text and shows `4.90e-3 mm` in the viewport. The native `2^-31 mm` gap shows `4.66e-10 mm` in the panel and has no viewport label. The ordinary 15 mm gap retains 15 mm in both places. Actual touching faces retain 0 mm and 90° with no viewport label. Escape clears the panel and label. The document, bodies, dirty state and history controls are stable during measurement.
- **PASS** — Native prism levels and the independent authored gap agree within `2e-14 mm`. Current browser evidence contains 14 states and 793 frozen files through cleanup. No downloads, page errors or console errors. Saved native document SHA-256 `024f0e0b257ddb54cb49cd0142f366b82b750da570b49105c75db0cfe39ca1be`.
- **PASS** — Model 10/10 and Studio 8/8 focused tests. React rendering covers each scalar family, positive and negative Δ, exact zero, missing fields, subnormal, NaN, Infinity, ordinary rounding and coaxial text. An external esbuild mutation replaces the raw formatter argument with the rounded value. The scalar and label tests reject the mutant with exit 1. Both type-checks, affected lint, driver syntax, production build and diff check pass.
- **NOT_RUN** — Full suites and mobile. The display qualification starts from the computed Measure values. Closest-feature precision limits remain recorded in [D742](../measure-finite-segment-crossing-2026-11-12/README.md).

Use Node 22.19.0, existing Chrome and Playwright, the serial heavy gate and an external evidence directory.

```sh
D743_SOURCE_FROZEN=1 node apps/cad-studio/test/measure-nonzero-text-browser.mjs "$EVIDENCE/baseline" --baseline
D743_SOURCE_FROZEN=1 node apps/cad-studio/test/measure-nonzero-text-browser.mjs "$EVIDENCE/studio"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test measure
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test quantity-text
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint apps/cad-studio/src/{App.tsx,ui/MeasurementInspector.tsx,ui/quantityText.ts} apps/cad-studio/test/measure-quantity-text.test.ts
node --check apps/cad-studio/test/measure-nonzero-text-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D744 checks whether Studio reports a failed interference pair as clear. [#2348](https://github.com/barocss/barocss/issues/2348). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
