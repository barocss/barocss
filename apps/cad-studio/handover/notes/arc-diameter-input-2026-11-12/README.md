# D718 — Edit an arc radius by diameter

P1, row 09. FEATURE qualification for desktop Studio. Parent `87b5207d0a9eb90c2e4e59ec72874784f7806a76`. [#2397](https://github.com/barocss/barocss/issues/2397).

The parent opens an arc with Radius input only. Its existing Radius edit and attached-circle Diameter edit both pass. The inline arc editor now offers R and Ø in mm. The editor opens in R and keeps the mode and its draft for the current field. Ø confirmation divides the input by two before it reaches the existing radius constraint and solver. Opening, changing modes, and confirming an unchanged driving value keep the existing document and history. A reference arc can still receive one driving radius. Sidebar and viewport dimension labels keep their established forms.

## Qualification

- **PASS** — Actual desktop Chrome WebGPU, 13 states and 791 frozen inputs through cleanup. R and Ø both produced the identical native document for a tangent arc changed from R6.123456 to R8. The two tangencies and side IDs survived. R→Ø→R, unchanged Ø Enter, pointer and keyboard mode switching, Escape, leaving the field, changing arcs, and replacing the document kept each draft with its editor. Mode-only Finish left the document clean and the Undo/Redo actions intact.
- **PASS** — Empty, zero, negative, too-small, nonfinite and impossible fixed-chord drafts were refused. A D7.8 attempt could not change an 8 mm chord. A reference arc added one radius entry. A real Ø16 edit kept one R8 constraint and passed Sketch and document Undo/Redo. Studio project Save, fresh Open and Edit sketch reopened in R. The saved native SHA-256 is `7617a2ced1ac4898d2cb2fed2f3ea1ad3f32e61c414e9f367018d26253d0b448`. The saved solid volume is `1481.0619298297456 mm³`.
- **PASS** — Strict native B-rep on the saved tangent arc, four fixed-chord branches and an equal-radius pair. For the R8 fixed-chord profiles the two cap boundaries matched signed sweeps `±π/3` and `±5π/3`. The independent circle and segment-volume equations checked each sampled boundary against its authored endpoints, radius, centre, direction and height. Across the four branches and equal pair, maximum native radius error was `4.59e-11 mm`, centre error `9.53e-11 mm`, signed sweep error `3.18e-12 rad`, and absolute volume error `6.04e-9 mm³`. The check used `1e-8 mm`, `1e-8 rad` and `1e-7 mm³` evidence limits. It did not change product tolerances. Sol High checked the fixtures and native extraction independently.
- **PASS** — Parent Radius and circle Diameter controls, 3 desktop states. D717 replay, 18 desktop states. No downloads or page or console errors in the passing flows. Model 34/34 and Studio 31/31 focused tests, Model and Studio type-checks, affected lint, driver syntax, build and diff checks passed.
- **FAIL** — The first parent test read an attached circle from the serialized hole segment's nonexistent radius field. The corrected parent run verifies the stored circle radius and volume.
- **NOT_RUN** — Full suites, mobile, general solver expansion, persistent diameter annotation and new parameter bindings.

Run with Node 22.19.0, existing Chrome and Playwright, and the serial heavy gate. Use the baseline switch with the parent production source.

```sh
D718_SOURCE_FROZEN=1 node apps/cad-studio/test/sketch-arc-diameter-browser.mjs "$EVIDENCE/studio"
D717_SOURCE_FROZEN=1 node apps/cad-studio/test/sketch-dimension-confirmation-browser.mjs "$EVIDENCE/d717-replay"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test sketch-profile-precision sketch-reopen-parameters sketch-reopen-side-ids
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test named-sketch-guards sketch-edit-identity sketchIds
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint apps/cad-studio/src/ui/InlineSketchDimension.tsx apps/cad-studio/src/ui/SketchMarks.tsx
node --check apps/cad-studio/test/sketch-arc-diameter-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D719 checks missing crossing selections in ordinary orthographic Model views. [#2430](https://github.com/barocss/barocss/issues/2430). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
