---
work_id: D665
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D665 — Keep Drawing tools clear of the collapsed chat rail

P4 desktop usability, rows 02 and 21. SMALL qualification for the Drawing workspace inset.

Drawing uses the existing stage inset for the collapsed chat rail. The toolbar, sheet area and Drawing settings share the resulting workspace. The open chat column already occupies its own layout width.

| Check | Result | Evidence |
| --- | --- | --- |
| Original desktop behavior | FAIL | At 1440 × 900 and 1280 × 720, the chat rail covered all nine buttons and their icons. Each 34 px button had 7 px visible. The baseline driver passed because it expected the obstruction. |
| Desktop layout | PASS | At both sizes, all nine buttons kept their full 34 px width and their icons cleared the chat rail. Hit tests at both corners and the center reached each button. The toolbar stayed outside the sheet area. |
| Drawing interaction | PASS | At 1440 × 900, pointer activation and placement made a 64 mm front-view linear dimension. At 1280 × 720, Tab and Enter selected Linear dimension and pointer placement made the same dimension. Pointer and keyboard Fit sheet restored the fitted view after zoom. The sheet fit inside its canvas and the authored model and dimension remained exact. |
| Focused drawing checks and build | PASS | Studio 17 drawing tests, browser syntax and Studio build passed. |
| Mobile, alternate chat layouts and whole CAD suites | NOT_RUN | Qualification covers the collapsed rail at the two desktop sizes. |

Use Node 22.19.0 and run one heavy job at a time under `gate.sh acquire heavy 180 <label>` and `gate.sh release heavy`. `EVIDENCE` is external to the worktree. Run browser commands from `apps/cad-studio`.

- Baseline `D665_SOURCE_FROZEN=1 node test/drawing-toolbar-inset-browser.mjs "$EVIDENCE/baseline" --baseline`. Receipt SHA-256 `cceae340972937d6075cecb42d6decc16f59e91ae7a407e2782c2ca71678bdd3`.
- Desktop `D665_SOURCE_FROZEN=1 node test/drawing-toolbar-inset-browser.mjs "$EVIDENCE/final" --fixed`. Receipt SHA-256 `6a8305e8355b513243e3342371264de7e6302f32f7cba164337a74ea72aae5c5`. The run checked 319 source files through cleanup and recorded zero page errors, console errors and downloads.
- From the repository root run `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test drawing`, `node --check apps/cad-studio/test/drawing-toolbar-inset-browser.mjs`, `pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/vite-build"` and `git diff --check`.

Initial scenarios stay at 4/10, B09 at 9/9 and whole CAD readiness at **NOT_MEASURED**. D666 checks keyboard use and focus return in the More tools menu. [#2287](https://github.com/barocss/barocss/issues/2287) remains open for the broader contextual UI review.
