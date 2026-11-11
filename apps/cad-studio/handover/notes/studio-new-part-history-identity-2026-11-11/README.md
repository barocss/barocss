---
work_id: D664
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D664 — Restore document identity when undoing New part

P0 reliability R14, rows 12 and 16. FEATURE qualification for the Studio New part boundary.

New part keeps the preceding document, history marker, title and dirty flag in one undo entry. Undo and Redo restore the captured state and capture the state they leave. The Untitled name is applied only after the empty document is accepted. Crossing this boundary retires the current project save destination so the restored model cannot borrow another file's association. The project and its saved files remain available in the Browser.

| Check | Result | Evidence |
| --- | --- | --- |
| First baseline driver attempts | FAIL | The initial driver expected a single Box node. Studio emits a rectangle and an extrusion. The next driver waited for an exact accessible title label that included the dirty indicator. The reproduced driver uses the actual node count and title field. |
| Original desktop behavior | FAIL | Undo restored the named unsaved box, its feature history and its dirty flag. The title remained Untitled. The reproduction driver passed because it expected that mismatch. |
| Desktop Undo and Redo | PASS | Undo restored the exact unsaved title, model, history and dirty flag. Redo restored the blank Untitled document. Ordinary feature Undo and Redo still worked after another boundary Undo. The clean native file returned to its original name and clean flag. |
| Reload recovery | PASS | Studio kept the corrected title and exact model in the browser recovery copy. After reload, Restore returned the named dirty model. |
| Project save destination | PASS | Studio saved the named box and the new blank file in the same browser project. Undo and Redo restored each title and its clean flag as a detached working document. Both project files kept their exact bytes. |
| Independent geometry | PASS | Python verified the restored 20 × 12 × 8 mm box in both the dirty and clean cases. Each had one solid and a volume of 1920 mm³. |
| Existing clipboard boundary | PASS | D560 still retires an older body clipboard when a New part reuses its body key. The first Undo/Redo pair and fresh copy/paste remain valid. |
| Focused tests and build | PASS | Studio 85 passed. Studio TypeScript, changed TypeScript lint, browser driver syntax and Studio build passed. |
| Mobile, OS folder restore and whole CAD suites | NOT_RUN | Qualification covers native file Open and browser project storage. |

Use Node 22.19.0 and one heavy job at a time under `gate.sh acquire heavy 180 <label>` and `gate.sh release heavy`. `EVIDENCE` is external to the worktree. Run browser commands from `apps/cad-studio`.

- Driver failures SHA-256 `21a25b6cfe5e51997835ffe49887f4922a760fdb3a8f1c238b7554f537e8b04b` and `69f22be2ac27f045a69fa226abe3b6ba30905501341409944f5744fabc18433e`.
- Baseline `D664_SOURCE_FROZEN=1 node test/new-part-history-browser.mjs "$EVIDENCE/reproduced" --baseline`. Receipt SHA-256 `e55ac6bab85c7ba3df0ad4fb64c4c0b01ba1692c47add647ae26f46a9a538804`.
- Desktop `D664_SOURCE_FROZEN=1 node test/new-part-history-browser.mjs "$EVIDENCE/final" --fixed`. Receipt SHA-256 `17c2f57bf8f47ae7e498523fa033b0638bf94630dc946d57599dc014431b158b`. The run checked 319 source files through cleanup and recorded zero page errors, console errors and downloads.
- Independent geometry `python3 -I "$EVIDENCE/final/new-part-history-oracle.py" < "$EVIDENCE/final/recovered-boxes-oracle-input.json"`. Result SHA-256 `82163e24721167949414f7c1fa57a9d34bd0eefaf2b1a93454ed5053b7ffd489`.
- D560 regression `D560_SOURCE_FROZEN=1 node test/body-clipboard-new-part-browser.mjs "$EVIDENCE/regression-d560"`. Receipt SHA-256 `8120b9374af6d0d8a9e140e08179f62c6988438559a119f2f9d8cf925b94d095`.
- From the repository root run `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test project-open-ownership late-save-ownership stop-work-ownership body-clipboard recovery document-change`, `pnpm --dir apps/cad-studio exec tsc --noEmit`, `pnpm exec eslint apps/cad-studio/src/App.tsx apps/cad-studio/src/state/workOwnership.ts`, `node --check apps/cad-studio/test/new-part-history-browser.mjs`, `pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/vite-build"` and `git diff --check`.

Initial scenarios stay at 4/10, B09 at 9/9 and whole CAD readiness at **NOT_MEASURED**. D665 checks the Drawing toolbar obstruction from the desktop usability review.
