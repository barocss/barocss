---
work_id: D671
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D671 — Make ViewCube directions keyboard accessible

P4, row 21. SMALL repair of keyboard access to existing camera directions. The ViewCube has one native focusable trigger for its directions. The menu shows six faces, twelve edges and eight corners in three groups. Selection uses the same camera action as the corresponding cube region. Up and Down, Home and End move focus. Escape closes the menu and restores focus to the trigger. Enter selects a direction and restores focus. The SVG remains available for pointer direction selection and drag orbit.

| Check | Result | Evidence |
| --- | --- | --- |
| Original ViewCube keyboard entry | FAIL | The D669 desktop baseline found no focusable direction trigger. Tab skipped the ViewCube at 1280 × 720 and 1024 × 768. |
| First menu layout | FAIL | The single-column menu passed keyboard activation but visually overlapped the lower view controls at 1280 × 720. The grouped layout fits above those controls. |
| Keyboard | PASS | Tab reached the trigger at both sizes. Space opened the menu, Home and End reached its endpoints and Escape restored focus without changing the selection. Ten keyboard activations confirmed all six face directions plus a representative edge and corner. |
| Pointer and visibility | PASS | Pointer face, corner, edge and drag orbit passed at both sizes. All 26 choices were hit-testable and above the view bar at both sizes and at 1024 × 768 with chat open. A pointer menu selection with chat open reached Back. Document, selection and feature history stayed exact. |
| Focused checks and Model Fit regression | PASS | 55 Studio tests, Studio and CAD Model TypeScript, changed source lint, browser syntax and the Studio production build passed. The D668 desktop Fit driver also passed after the ViewCube markup change. |
| Wider coverage | NOT_RUN | Mobile, screen-reader software, non-Chromium browsers and whole CAD readiness. |

The browser driver verifies camera directions from the observed projection depth gradient. The final run verified 320 frozen files through cleanup and recorded zero page errors, console errors and downloads. Screenshots confirm the grouped layout in the default and open-chat layouts.

Use Node 22.19.0. Run one heavy job at a time under `gate.sh acquire heavy 180 <label>` and `gate.sh release heavy`. Run browser commands from `apps/cad-studio` with external `EVIDENCE`.

- D669 baseline receipt SHA-256 `d511e64994000ba37933d779b680d3bd86e87329cfd3e8417e742ab8030c9743`. The ViewCube product source was unchanged before this repair.
- Single-column keyboard receipt SHA-256 `ec8b9bf189984d4c1dd3f1af0c73b5768e5663d2efb94caeda40a8be9b990f5c`.
- Final `D671_SOURCE_FROZEN=1 node test/view-cube-keyboard-browser.mjs "$EVIDENCE/grouped" --fixed`. Receipt SHA-256 `032c52c60f048389c1f433551042bf469d001e2eab9202cf64f4778c535be3c5`.
- Model Fit regression `D668_SOURCE_FROZEN=1 node test/model-work-area-fit-browser.mjs "$EVIDENCE/model-fit" --fixed`. Receipt SHA-256 `bcdded5eaaaaffa2a0c3fa3d4ef5c6634a256620880577257b4c95a4b1c83140`.
- From the root run `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test ui-icons camera-projector camera-relative-query small-camera-scale`, `pnpm --dir apps/cad-studio exec tsc --noEmit`, `pnpm --dir packages/barocss-cad-model run type-check`, `pnpm exec eslint apps/cad-studio/src/viewport/ViewCube.tsx`, `node --check apps/cad-studio/test/view-cube-keyboard-browser.mjs`, `pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/vite-build"` and `git diff --check`.

D672 checks the Ortho and AO toggle states. Initial scenarios remain 4/10, B09 remains 9/9 and whole CAD readiness is **NOT_MEASURED**. [#2287](https://github.com/barocss/barocss/issues/2287) remains open for the broader contextual UI work.
