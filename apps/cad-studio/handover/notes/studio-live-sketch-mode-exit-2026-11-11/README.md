---
work_id: D663
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D663 — Protect the live sketch during mode changes

P0 reliability R13, rows 09, 12 and 16. FEATURE qualification for Studio workspace transitions.

Model, Drawing and Render ask before discarding a sketch that contains a current shape or completed shapes. Keep editing and Escape close the prompt and restore focus. Discard changes leaves the requested mode active. Empty sketches leave directly. Clicking the active Sketch tab keeps the draft. The Drawing reference preview uses the same exit guard.

| Check | Result | Evidence |
| --- | --- | --- |
| First baseline driver | FAIL | The driver used the visible dimension text as the full accessible name. It now locates the existing dimension fields by ID. |
| Original desktop behavior | FAIL | All three transitions discarded the 20 × 12 mm rectangle with its displayed dimensions and constraints. Returning to Sketch opened an empty draft. The reproduction driver passed because it expected the losses. |
| First updated desktop | FAIL | Escape dismissed the prompt and also reached the underlying sketch cancel shortcut. The prompt now stops that Escape event. |
| Constraint fixture retry | FAIL | The solver correctly refused a Fixed rule on a corner that already had horizontal alignment. The desktop fixture removes the redundant horizontal rule before adding Fixed. |
| Desktop protection | PASS | Model, Drawing and Render each opened the confirmation. The pointer path restored the width field after Keep editing or Escape. The keyboard path focused Keep editing and returned focus to Model. The fixed corner and 12 mm driving edge length stayed in the draft. The active Sketch tab kept the outline. |
| Finish and geometry | PASS | Finish made one sketch feature. Its authored fixed-point rule and driving length persisted. An 18 mm extrusion produced one solid. Python verified the 20 × 12 mm outline and 4320 mm³ volume. |
| Discard and empty controls | PASS | Explicit Discard entered Drawing without adding a feature. The next Sketch was empty and switched directly to Render. Both controls preserved the already accepted model. |
| Existing finish ownership | PASS | D574 still ignores a late successful Finish after Escape or a newer edit. Its accepted control, Undo/Redo and fresh Open passed. |
| Focused tests and build | PASS | Studio 115 passed. Studio TypeScript, changed TypeScript lint, browser driver syntax and Studio build passed. |
| Mobile, the Drawing reference shortcut and whole CAD suites | NOT_RUN | Qualification covers the desktop XY rectangle, its constrained outline and a second draft. |

Use Node 22.19.0 and run one heavy job at a time under `gate.sh acquire heavy 180 <label>` and `gate.sh release heavy`. `EVIDENCE` is external to the worktree. Run browser commands from `apps/cad-studio`.

- First driver receipt SHA-256 `c4a53bb8743154cc1893d8183da519da2d4cc1462c6d2ecd5b5c3b04eb7c20c2`.
- Baseline `D663_SOURCE_FROZEN=1 node test/sketch-mode-exit-browser.mjs "$EVIDENCE/reproduction" --baseline`. Receipt SHA-256 `054b577f0fc6f7df70133e62675430477dda431050daf46fab3098aef7cf8ec9`.
- First updated desktop receipt SHA-256 `a6c5abdc473c93cb9b469cc2b108bf5e07208a849fa00c9e7f5da57358f3bd9a`.
- Constraint fixture retry receipt SHA-256 `5594e860524de70e25cc1b222330f32fc665e324693dc921f4b1b15ed9859016`.
- Desktop `D663_SOURCE_FROZEN=1 node test/sketch-mode-exit-browser.mjs "$EVIDENCE/verified" --fixed`. Receipt SHA-256 `3ab4c1e3259d3a9e4a49d73ce59025447e10c2fee5a7cc59cc888032c958aa90`. The run checked 320 source files through cleanup and recorded zero page errors, console errors and downloads.
- Independent geometry `python3 -I "$EVIDENCE/verified/sketch-mode-exit-oracle.py" < "$EVIDENCE/verified/physical-oracle-input.json"`. Result SHA-256 `1804dd23788be427f5287a1a6aa23e849844cb42d10fe53a4dae510c13ef8d7b`.
- D574 regression `D574_SOURCE_FROZEN=1 node test/sketch-finish-ownership-browser.mjs "$EVIDENCE/regression-d574" --expect=fixed`. Receipt SHA-256 `6f5053368f6234c628d6215e7e2fa02f890d6a87fe2a4587bde3849ffcc155cd`.
- From the repository root run `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test sketch project-open-ownership viewport`, `pnpm --dir apps/cad-studio exec tsc --noEmit`, `pnpm exec eslint apps/cad-studio/src/App.tsx apps/cad-studio/src/sketch/useSketchModeExit.tsx`, `node --check apps/cad-studio/test/sketch-mode-exit-browser.mjs`, `pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/confirmed-vite-build"` and `git diff --check`.

Initial scenarios stay at 4/10, B09 at 9/9 and whole CAD readiness at **NOT_MEASURED**. D664 checks the New part boundary and the identity of the recovered unsaved document.
