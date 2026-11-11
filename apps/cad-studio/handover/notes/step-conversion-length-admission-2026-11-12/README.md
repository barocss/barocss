# D723 — Refuse unsupported STEP conversion length units

P0, rows 13 and 16. FEATURE qualification for STEP Open and reference admission. Parent `1ef37abb20e3c75cddbfc4dad83af4b9604342cc`. [#2412](https://github.com/barocss/barocss/issues/2412).

The parent accepted an analytic 2 × 3 × 4 source-unit box at 24 mm³ even though its representation context selected a conversion of 25.4 mm per source unit. Its `CUSTOM_INCH` declaration referenced factor #154 from unit #155. The factor referenced the basis millimetre unit #10. A control that differed only by the declaration name `INCH` opened at 50.8 × 76.2 × 101.6 mm and 393,289.536 mm³. The parent chose #10 for the unsupported name.

The Model admission scan reads actual top-level complex entity components. It skips comments, quoted text, nested components and angle-only declarations. An unsupported conversion-based length name raises `NOT_READ` before choosing the factor or dispatching geometry work. Supported named units retain precedence over SI declarations after all declarations pass. The policy applies to the complete file. Known factors remain fixed, with no new contextual unit evaluation. The raw CAD importer continues to use source coordinates.

## Qualification

- **PASS** — Actual desktop Chrome WebGPU, 10 recorded states and 684 frozen inputs through cleanup. Unsupported analytic and AP242 mesh-only Open and Add reference displayed the name and left the previous document, source bytes, selected body, existing reference, Undo/Redo, dirty state and part name intact. The rejected inputs dispatched zero mesh reads, diagnoses or part reads and produced no success notice. A normal reference succeeded after the refusal.
- **PASS** — Supported analytic and mesh-only inch controls had physical bounds 50.8 × 76.2 × 101.6 mm and volume 393,289.536 mm³ against independent box arithmetic. The tolerances were `1e-4 mm` for displayed bounds and `1e-7 mm³` for evaluated volume. Save to a browser project and Open in a fresh context retained the accepted document, original STEP source and one scale node at 25.4. Both the Cancel and newer native Open checks delivered the held actual STEP mesh reply without replacing the current model.
- **PASS** — Model 34/34 and Studio 67/67 focused tests. Both type-checks, affected lint, driver syntax, diff check and Studio production build passed. The focused Model checks cover known SI and conversion names, mixed statement order, quoted and commented false matches, exact reference source retention and refusal before any evaluation.
- **FAIL** — The clean parent reproduced silent acceptance at the wrong scale. An initial browser harness tried to read bounds from a volume-only debug hook. The passing run checks Studio's Bounds display. An additional actual Add reference with supported `INCH` exposed a separate body-count probe failure, `target: ref1/1 is not a part`. The failure arises during reference geometry evaluation after unit admission. D724 owns that path. The issue stays open for the full supported-unit consumer check.
- **NOT_RUN** — Full package and kernel suites, mobile, third-party reader, general context-specific conversion factors and external files.

The final fixture SHA-256 for the unsupported analytic control was `20295fb530cd2397c8a1c3546f9b0ea73d326db5310d6bdb352a66f1aeca9097`. The saved native document SHA-256 was `85590fa21cff4903f03ab834d96574e840b7b0db5ff514aa0b83b562f6804e96`. Evidence files remain outside Git.

Run with Node 22.19.0, existing Chrome and Playwright, and the serial heavy gate. Use the baseline switch with the parent production source.

```sh
D723_SOURCE_FROZEN=1 node apps/cad-studio/test/step-conversion-unit-browser.mjs "$EVIDENCE/studio"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test step-units step-reference-units step-offset-units api-step-report
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test imported-file-ownership mesh-import-ownership project-open-ownership
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint packages/barocss-cad-model/src/engine/stepUnits.ts
node --check apps/cad-studio/test/step-conversion-unit-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D724 verifies the supported non-millimetre STEP reference body-count probe, normalization and Save/Open. Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
