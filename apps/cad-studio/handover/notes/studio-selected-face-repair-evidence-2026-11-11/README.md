---
work_id: D662
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D662 — Attach saved face repair evidence to one Studio turn

P0 automation evidence, rows 04, 12 and 16. FULL qualification of the selected-turn MCP input.

Versions offers an attachment for the retained face repair report. The selected turn sends the original approval file, the repair report and the four exact snapshots. Studio's chat server and stdio MCP match both files to the original approval, saved rename, user acceptance, occurrence and authored criterion. The existing read-only tool returns the exact repair file. The saved unresolved and passing results retain their own revision IDs.

| Check | Result | Evidence |
| --- | --- | --- |
| Original desktop Studio | FAIL | Studio reopens the saved face repair. The review offers no attachment action. The baseline driver passed by checking for that gap. |
| First D654 regression attempt | FAIL | The fixture pin refused the D607 final-run copy. The rerun uses the two original D607 desktop snapshots with the required hashes. |
| Actual desktop and local MCP | PASS | Studio attached `p1/p1 · WIDTH`. MCP returned the exact retained file. The old `n1.side[west]` result remained unsupported with no number. The saved `n1.side[west2]` result remained a 12 mm pass. The working model still used the unresolved selector. All four snapshots matched the stored version log. |
| Refusal and ownership | PASS | The tool refused a different occurrence argument. The repair proposal tool stayed unavailable. The server returned HTTP 400 for an altered criterion and for a missing saved snapshot. The next unselected turn had no read tool. Closing the project retired the pending attachment. The working document and retained files kept their exact values. |
| Independent geometry and artifact check | PASS | Python verified both stored checksums, the version pins and the unsupported and passing records. The fresh local MCP measurement was 12 mm and native volumes remained 384 mm³ each. |
| Focused tests, mutations and build | PASS | Studio 49 and Model 32 passed. Four isolated mutations were detected. Both TypeScript checks, changed TypeScript lint, browser syntax and Studio build passed. Seven existing lint warnings remain in the chat server and MCP files. |
| Existing desktop flows | PASS | D659 selected current face diagnosis and D654 selected saved follow-up still use their own inputs and return their own results. |
| Paid live model, mobile and whole CAD suites | NOT_RUN | Desktop tests use the local fixture CLI with the actual Studio, chat server and stdio MCP. |

Use Node 22.19.0 and run one heavy job at a time under `gate.sh acquire heavy 180 <label>` and `gate.sh release heavy`. `EVIDENCE` is external to the worktree. Run browser commands from `apps/cad-studio`.

- Baseline `D662_SOURCE_FROZEN=1 node test/nested-lost-face-evidence-browser.mjs "$EVIDENCE/baseline" --face-attachment-baseline`. Receipt SHA-256 `f4d93eaddec7867c1b69900d90c714a37ab1b60f72e21be4a7d6888d142ac6ba`.
- Desktop `D662_SOURCE_FROZEN=1 node test/nested-lost-face-evidence-browser.mjs "$EVIDENCE/final" --face-attachment`. Receipt SHA-256 `ef17d96362bd0f224ac5f96ef1ece32c55b2638109e7cb79721dab111ffb981d`. The run checked 980 source files through cleanup and recorded zero page errors, console errors and downloads.
- Independent check `python3 -I "$EVIDENCE/final/nested-lost-face-evidence-oracle.py" < "$EVIDENCE/final/independent-face-repair-oracle-input.json"`. Result SHA-256 `82b0a94fd509eeff6aab80e8dc5dc835453956a3d091fb5345b3d5f7fb08c265`.
- Diagnosis regression `D659_SOURCE_FROZEN=1 node test/nested-lost-face-evidence-browser.mjs "$EVIDENCE/regression-d659" --diagnosis-chat`. Receipt SHA-256 `41987e055ad51be86c1fd6c25b1faa0db764540975dc8c90f4749cce0f71b293`.
- Follow-up fixture refusal receipt SHA-256 `d863abf4deb85389339734840d830ca509b79bdefce5a60fafdb5de16adac4e5`.
- Follow-up regression `D654_SOURCE_FROZEN=1 node test/nested-approved-comparison-browser.mjs "$EVIDENCE/regression-d654-pinned" "$PRIOR" --attach-follow-up`. `PRIOR` contains the D607 desktop fixtures. Receipt SHA-256 `03d8a9de6a9d2592f2a0d04304e5a7f0c8ca83618913c21bc51f59888968faa8`.
- From the repository root run `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test saved-face-repair-lineage approved-requirement-compare chat face-diagnosis toolset-mcp tool-contract-mcp` and `TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test nested-face-repair approved-version-evidence requirement-evidence proposals.test`.
- Run `node "$EVIDENCE/mutations.mjs" "$PWD" "$EVIDENCE"` for the scope pins, report fields, old verdict and measurement controls. Result SHA-256 `10ccae6de71dbc9a171971d0026d613184fa18e18b01086d8bc31301e1adc72a`.
- Run `pnpm --dir packages/barocss-cad-model exec tsc --noEmit`, `pnpm --dir apps/cad-studio exec tsc --noEmit`, `pnpm exec eslint` on changed TypeScript, `node --check apps/cad-studio/test/nested-lost-face-evidence-browser.mjs`, `pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/vite-build"` and `git diff --check`.

Initial scenario acceptance stays at 4/10 and B09 at 9/9. Whole CAD readiness remains **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) remains open for the broader property provenance and review workflow. The next P0 item is D663, work loss when leaving a live sketch for Model, Drawing or Render.
