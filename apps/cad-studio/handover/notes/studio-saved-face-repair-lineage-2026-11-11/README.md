---
work_id: D661
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D661 — Keep the unresolved face and approved replacement together

P0 automation evidence, rows 04, 12 and 16. FULL qualification for the Model approval helpers and the Studio saved review.

Versions can link one retained passing approval, the direct saved rename and the direct saved user-approved replacement on the same branch. The review shows the old unresolved name and the new passing result together. It checks the exact original approval digest, occurrence, authored criterion, saved revisions and approval history. The saved edit must match the face selector replacement and preserve the other authored inputs.

| Check | Result | Evidence |
| --- | --- | --- |
| Original desktop Studio | FAIL | The replacement approval survived Open. Versions lacked a review linking it to the original unresolved face. The baseline driver passed by checking for that gap. |
| Initial focused and static checks | FAIL | The React component and its storage module shared a case-insensitive base name. Their imports resolved ambiguously. Renaming the storage module corrected import resolution. The unrelated-branch test then needed the saved branch base as its working document before switching branches. |
| Actual desktop | PASS | Studio linked `Renamed west face · n1.side[west] · Unresolved` with `Face reference approved · n1.side[west2] · Pass · 12 mm` for `p1/p1 · WIDTH` and `P3`. It saved the evidence and showed the same entries after project reopen. The original approval and all four snapshots remained byte-identical. |
| Independent evidence | PASS | The Python oracle checked both artifact hashes, the source and replacement version pins, the original unsupported result with no number, and the passing result against a fresh local MCP read. Native volume remained 384 mm³ on each occurrence. |
| Refusal and custody | PASS | The checks rejected unrelated branches, a rejected proposal, a different requirement, altered evidence, missing source evidence and a changed required distance even with matching forged decision pins. Reopening saved evidence required zero geometry evaluations in the focused test. Concurrent identical saves converged, and differing evidence was preserved. |
| Focused tests, mutations and build | PASS | Model 47 and Studio 56 passed. Four isolated mutations were detected. Both TypeScript checks, changed TypeScript lint, browser driver syntax and Studio build passed. |
| Paid live model, mobile, other repair families and whole CAD suites | NOT_RUN | This qualification covers one nested prism with a renamed planar side. |

Use Node 22.19.0 and run one heavy job at a time under `gate.sh acquire heavy 180 <label>` and `gate.sh release heavy`. `EVIDENCE` is external to the worktree. Run browser commands from `apps/cad-studio`.

- Baseline `D661_SOURCE_FROZEN=1 node test/nested-lost-face-evidence-browser.mjs "$EVIDENCE/baseline" --face-lineage-baseline`. Receipt SHA-256 `5ab3ee5862390b49c8c9ec51835b18437525b2ab463de472518eff00f6da7c30`.
- Desktop `D661_SOURCE_FROZEN=1 node test/nested-lost-face-evidence-browser.mjs "$EVIDENCE/final" --face-lineage`. Receipt SHA-256 `d5ae5c6e7fd273ea0d3dcb52ef37b99f78e5ccf6c70aa032b02731de56b68c63`. The run checked 975 source files through cleanup and reported zero page errors, console errors and downloads.
- Independent check `python3 -I "$EVIDENCE/final/nested-lost-face-evidence-oracle.py" < "$EVIDENCE/final/independent-face-repair-oracle-input.json"`. Result SHA-256 `82b0a94fd509eeff6aab80e8dc5dc835453956a3d091fb5345b3d5f7fb08c265`.
- From the repository root run `TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test nested-face-repair nested-parameter-proposal requirement-evidence team-freshness proposals.test approved-version-evidence` and `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test saved-face-repair-lineage approved-requirement-compare face-diagnosis nested-selection chat`.
- Run `node "$EVIDENCE/mutations.mjs" "$PWD" "$EVIDENCE"` for the altered edit, unresolved name, measurement and context controls. Result SHA-256 `e44f3ae97d3827c2164e6ebba398300a45de0dc90ee08fba2a6c82e03d4ff7a1`.
- Run `pnpm --dir packages/barocss-cad-model exec tsc --noEmit`, `pnpm --dir apps/cad-studio exec tsc --noEmit`, `pnpm exec eslint` on changed TypeScript, `node --check apps/cad-studio/test/nested-lost-face-evidence-browser.mjs`, `pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/vite-build"` and `git diff --check`.

Initial scenarios remain at 4/10 and B09 at 9/9. Whole CAD readiness remains **NOT_MEASURED**. D662 checks whether the user can attach this saved review to a Studio agent turn while preserving the old and new verdicts and the scope pins. [#2279](https://github.com/barocss/barocss/issues/2279) remains open.
