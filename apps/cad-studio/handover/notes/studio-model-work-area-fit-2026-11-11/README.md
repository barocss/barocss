---
work_id: D668
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D668 — Fit the model to the visible Studio work area

P4, row 21. FEATURE verification of model camera framing. The work area uses the current rectangles of the tool rail, right dock, top bar, view cube, history and view controls. It reserves 12 CSS pixels of clearance. The camera keeps the old sphere fit as a distance floor and solves for the eight bounds corners in perspective or orthographic projection. Framing shifts the camera target to the work area. The existing orbit pivot follows that target.

The common model fit covers the first rendered body, the view presets, Frame all, F and the existing delayed fit on file Open. It leaves dock toggles as layout changes until a fit runs. Sketch, Render, Print and CAM retain their own camera paths.

| Check | Result | Evidence |
| --- | --- | --- |
| Original Frame all | FAIL | All 12 observations at 1280 × 720 and 1024 × 768 had 16–41 of 98 projected surface samples behind Tools. The solid remained inside the camera clip volume. |
| Updated Frame all | PASS | All 12 matching observations used the original 100 × 45 × 28 mm Box. Iso perspective and Front orthographic passed with chat closed, open and closed again at both sizes. |
| Desktop controls | PASS | Clicked the framed solid and pressed F at both sizes. Selection, document and history stayed exact. At 1024 × 768, F with both docks open placed the model in the 110 px work area. |
| Automatic native-file fit | PASS | Fresh Studio at 1280 × 720 opened the exact local Box document with chat open. The settled fit passed without a manual camera action. |
| Numeric and focused checks | PASS | The independent High review checked the distance equations and 160,000 corners in 20,000 deterministic projection cases in double precision. Studio passed 66 focused tests. Studio and CAD Model TypeScript, changed lint, browser syntax and the Studio production build passed. |
| Extended desktop driver setup | FAIL | A missing driver variable stopped the first extended run before framing. The corrected driver passed all 16 observations. |
| Wider camera and product coverage | NOT_RUN | D545's retained Pipe and Loft project workflow, WebGL2 browser, preview workspaces, arbitrary floating panels, mobile and whole CAD readiness. |

The final Studio flow recorded 98 physical surface sample projections per observation. Every observation had zero samples behind UI and at least 11.9999 CSS pixels from the measured work area edge. It recorded zero page errors, console errors and downloads, and checked 320 frozen files through cleanup. The screenshots were reviewed for the original occlusion, the corrected fit and the right dock sheet.

Use Node 22.19.0. Run one heavy job at a time under `gate.sh acquire heavy 180 <label>` and `gate.sh release heavy`. Run browser commands from `apps/cad-studio` and use an external `EVIDENCE` directory.

- Original driver `D668_SOURCE_FROZEN=1 node test/model-work-area-fit-browser.mjs "$EVIDENCE/baseline" --baseline`. Receipt SHA-256 `6589afeb683c5c50e6dafe81f0c22aa0814ae3ebc7dab185580a1b15f1e72ba6`.
- First fixed driver receipt SHA-256 `b35707e08e1bff3970fe3a862b0a7405c2b11f21d19304a896599098087f798e`. Extended driver setup failure receipt SHA-256 `10ad2093c1b02d55ccb5e91eb7b3ce619885f8e45dae0680588c08e378d62019`.
- Final `D668_SOURCE_FROZEN=1 node test/model-work-area-fit-browser.mjs "$EVIDENCE/verified" --fixed`. Receipt SHA-256 `954e48042e21f31a777e7e51b5416bfebc2d48cd9d57cb11cdb9aeae59796483`.
- From the root run `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test small-camera-scale camera-projector camera-relative-query sketch-framing project-open-fit render-focus assembly-steps`, `pnpm --dir apps/cad-studio exec tsc --noEmit`, `pnpm --dir packages/barocss-cad-model run type-check`, `pnpm exec eslint apps/cad-studio/src/viewport/camera.ts apps/cad-studio/src/viewport/modelFitArea.ts apps/cad-studio/src/viewport/Viewport.tsx apps/cad-studio/test/small-camera-scale.test.ts`, `node --check apps/cad-studio/test/model-work-area-fit-browser.mjs`, `pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/vite-build"` and `git diff --check`.

Initial scenarios remain 4/10, B09 remains 9/9 and whole CAD readiness is **NOT_MEASURED**. [#2287](https://github.com/barocss/barocss/issues/2287) remains open for broader contextual UI acceptance.
