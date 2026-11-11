# D749 — Identify the native feature that refused a preview

P0, rows 07 and 16. FEATURE qualification for the Studio command HUD. Parent `21bfb795aa0c361836245c16924b3c42ffa22ea7`. [#2323](https://github.com/barocss/barocss/issues/2323).

The existing Worker already returns the native feature ID with its refusal. Studio now uses the exact evaluated preview and accepted command history to resolve that ID. The existing HUD error shows the accepted history label and full native ID. A reported ID without a matching history step remains visible by itself. The preview lifetime, command, values and request revision own that attribution. The original title, hint, code and kernel detail retain their meaning. The location identifies the refused operation.

## Qualification

- **FAIL (parent)** — A real 40 × 30 mm profile, Extrude 20 mm and downstream Fillet R8 accepted under stable IDs `n11`, `n23`, `n41`. The 4 mm Extrude alone produced `4800 mm³`. Full regeneration refused at `n41` with `RADIUS_EXCEEDS_FACE` for the 4 and 40 mm walls. Native `CadPartError`, Model evaluate/preview and the actual Worker agreed on the ID. The HUD showed the existing refusal while omitting the failed feature. Two baseline desktop states.
- **PASS** — The real extrusion handle opens Edit Extrude 20. Typing 4 mm shows `Fillet R8 (n41)`, keeps Apply and History blocked, and leaves the accepted document, selection and `23587.964473723074 mm³` solid intact. The independent volume is `1200h − 30 × 8² × (1 − π/4) mm³`. A newly authored oversized Fillet reports its native `n42` and the missing history match. It keeps the accepted `24000 mm³` plate intact.
- **PASS** — Delaying delivery of real failed Worker replies checks late failure followed by success, 4 → 12 → 4 input, Cancel and same-ID Open, and New part followed by a new Box command. The second document with the same `n41` reports its own `Fillet R6 (n41)`. No retired diagnosis appears. The 12 mm retry evaluates and applies with the original fillet, giving `13987.964473723123 mm³`. Undo/Redo and local-project Save, Close, reload and Open keep the exact accepted states. Nine current desktop states over 794 frozen files. No browser downloads, page errors or console errors.
- **PASS** — Model 40/40 and Studio 30/30 focused tests. Direct, missing, code-only, legacy-position and unknown IDs, changed history positions, generated patterned-hole and text IDs, and command retirement passed. Both type-checks, affected lint, driver syntax, production build and diff checks passed.
- **FAIL (initial baseline driver)** — Its shared locator was restricted to new Extrude. The corrected driver uses the active HUD and verifies that its title is Edit Extrude 20.
- **NOT_RUN** — Full suites, mobile, and separate Feature Editor Apply error attribution. #2323 remains open for that route.

Use Node 22.19.0, existing Chrome and Playwright, the serial heavy gate and an external evidence directory. Fixture SHA-256 `6d785f9403e747aa50be46196cccda460e7c403dd2e64c542c8a5d5778eb6280`. Saved file SHA-256 `80e6bf64b216b420ddd0d0e65abd87ffbfb5bbb6b80d0c55b9520459f4e4482a`.

```sh
D749_SOURCE_FROZEN=1 node apps/cad-studio/test/failed-feature-preview-browser.mjs "$EVIDENCE/baseline-final" --baseline
D749_SOURCE_FROZEN=1 node apps/cad-studio/test/failed-feature-preview-browser.mjs "$EVIDENCE/studio-final"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test r7-findings ids text-remap text-relief-remap
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test failed-feature fillet-family stop-work-ownership
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint apps/cad-studio/src/{app/failedFeature.ts,app/commandState.ts,state/useCommandPreview.ts,ui/Hud.tsx} apps/cad-studio/test/failed-feature.test.ts packages/barocss-cad-model/test/r7-findings.test.ts
node --check apps/cad-studio/test/failed-feature-preview-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D750 checks current attribution and draft ownership on Apply from the Feature Editor. [#2323](https://github.com/barocss/barocss/issues/2323). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
