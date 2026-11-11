---
work_id: D660
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D660 — Replace one renamed face reference with explicit approval

P0 automation evidence, rows 04, 12 and 16. FULL qualification for the Model proposal entry point and the Studio workflow.

Studio Versions reads a retained passing approval and offers a single replacement for a renamed face on the same nested prism. The polygon sketch and extrusion must match the retained definition except for one side tag. The occurrence and placement must match. The native check confirms that the old name is unresolved, the matcher gives one candidate, and the candidate has the same planar signature and distance. The user selects the candidate and reviews it through the existing proposal flow.

| Check | Result | Evidence |
| --- | --- | --- |
| Original desktop behavior | FAIL | Studio showed the saved approval and the missing old name. The exact tag-only replacement had no proposal action. The baseline driver passed by checking for that gap. |
| Initial static checks | FAIL | Studio type-check found a missing type import. Lint found two unused type imports. Both checks passed after the imports were corrected. |
| Actual desktop | PASS | Studio offered `n1.side[west2]` for `p1/p1 · WIDTH`. Preview showed +0 mm³. Rejection preserved the model. A new proposal required an explicit user approval and changed one authored face selector. Fresh project Open measured 12 mm for the repaired occurrence and its unchanged sibling. The saved approval bytes matched the original. |
| Lost face control | PASS | The triangle removed the original face. Studio offered no replacement and produced no repair proposal. |
| Independent geometry | PASS | The original and renamed prisms each have volume 384 mm³. The old and new side faces have area 32 mm², centroid [0, 4, 2] mm and normal [-1, 0, 0]. The distance to the east face is 12 mm. |
| Focused checks, mutations and build | PASS | Model 55 and Studio 59 passed. Four isolated mutations were detected. Both TypeScript checks, changed TypeScript lint, browser driver syntax and Studio build passed. |
| Existing desktop diagnosis | PASS | The D659 diagnosis still attaches the exact unresolved face to one Studio chat turn and reports repair unavailable for the lost face. |
| Paid live model, mobile, general face repairs and whole CAD suites | NOT_RUN | The desktop run covers one named planar side on one nested sketch-and-extrude prism. |

Use Node 22.19.0 and one heavy job at a time under `gate.sh acquire heavy 180 <label>` and `gate.sh release heavy`. `EVIDENCE` is external to the worktree. Run browser commands from `apps/cad-studio`.

- Baseline `D660_SOURCE_FROZEN=1 node test/nested-lost-face-evidence-browser.mjs "$EVIDENCE/baseline" --face-repair-baseline`. Receipt SHA-256 `2276975deb8aa5ba9374939a40249115ced1f4e5efa3a288d43b38bbb0bc583c`.
- Desktop `D660_SOURCE_FROZEN=1 node test/nested-lost-face-evidence-browser.mjs "$EVIDENCE/final" --face-repair`. Receipt SHA-256 `27a9b5273ce9af5a79987da7142330d1d44544907bdbdf79c25be0090c0885db`. The run checked 973 source files through cleanup and recorded zero page errors, console errors or downloads.
- Independent check `python3 -I "$EVIDENCE/final/nested-lost-face-evidence-oracle.py" < "$EVIDENCE/final/independent-face-repair-oracle-input.json"`. Result SHA-256 `4ac3d9bcb65f28d4c619d9f2f2e40506aaa93470d5ed73d72a71271b92bfc0b5`.
- Desktop regression `D659_SOURCE_FROZEN=1 node test/nested-lost-face-evidence-browser.mjs "$EVIDENCE/regression-d659" --diagnosis-chat`. Receipt SHA-256 `946cdd42bee241d989e5c6035c71ae515bd41745baaa9b1d2ad04a15c6e8f85b`.
- From the repository root run `TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test nested-face-repair nested-parameter-proposal requirement-evidence team-freshness proposals.test chat-merge approved-version-evidence` and `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test face-diagnosis approved-requirement-compare nested-selection chat toolset-mcp tool-contract-mcp`.
- Run `node "$EVIDENCE/mutations.mjs" "$PWD" "$EVIDENCE"` for the shape change, occurrence move, agent approval and reused-operation controls. Result SHA-256 `f72d96afe484e5b54aac5b07301731f751a16d78606ab313a139ffe7f2ad4799`.
- Run `pnpm --dir packages/barocss-cad-model exec tsc --noEmit`, `pnpm --dir apps/cad-studio exec tsc --noEmit`, `pnpm exec eslint` on changed TypeScript, `node --check apps/cad-studio/test/nested-lost-face-evidence-browser.mjs`, `pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/final-vite-build"` and `git diff --check`.

Initial scenario acceptance stays at 4/10 and B09 at 9/9. Whole CAD readiness remains **NOT_MEASURED**. D661 checks the link between the retained original face reference and the saved replacement approval. [#2279](https://github.com/barocss/barocss/issues/2279) remains open.
