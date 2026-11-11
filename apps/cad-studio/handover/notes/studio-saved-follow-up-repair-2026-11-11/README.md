---
work_id: D656
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D656 — Verify a saved user repair against the retained regression

P0 automation evidence, rows 04, 12 and 16. FEATURE qualification for the Versions review.

Versions offers a repair version after a saved follow-up shows a regression. The review binds the selected version to the retained report digest, the saved failure's lineage, the occurrence, the authored criteria and the recorded user approval. It replays the approved parameter edit and rechecks the saved failure, the approval base and the repaired snapshot. The approval base may be the retained failure itself or a later saved descendant. The original failure and the working model remain available independently.

| Check | Result | Evidence |
| --- | --- | --- |
| Original desktop Studio | FAIL | The retained regression and the approved repair were both saved. Versions had no repair review in the follow-up section. The baseline driver passed because it expected this missing control. |
| Updated desktop Studio | PASS | After Save and fresh Open, an independently passing 3 mm version could not resolve the saved failure. The user-approved P2 displayed 8 mm → 4 mm while the working occurrence still measured 8 mm and failed. The retained 8 mm failure stayed visible. The native file, version log, snapshots and retained report kept their bytes during review. |
| Independent prism and saved lineage audit | PASS | The 20 × 10 mm profile, unchanged placement and height change agree with the −800 mm³ preview. The saved repair descends from the retained failure and cites its report digest, occurrence and failing criterion. The sibling remained exact. |
| Focused checks | PASS | Studio 47 and Model 40 passed. An exact later 13 mm approval base passed. An unsaved base, separate lineage, sibling occurrence, different repair value, different report digest, changed criterion and unavailable evaluation were refused. Model and Studio types, changed TypeScript lint, browser driver syntax and Studio build passed. |
| Retained attachment regression | PASS | The D654 desktop flow still returns the exact retained file and retires the attachment when the document changes. |
| Paid live model, mobile, whole CAD suites | NOT_RUN | The desktop flow uses the local scripted CLI with Studio, chat server and stdio MCP. |

Use Node 22.19.0. Run one heavy job with `gate.sh acquire heavy 180 <label>` and `gate.sh release heavy`. `EVIDENCE` is an external evidence directory. `PRIOR` contains the D607 desktop fixtures. Run browser commands from `apps/cad-studio`.

- Baseline `D656_SOURCE_FROZEN=1 node test/nested-approved-comparison-browser.mjs "$EVIDENCE/baseline" "$PRIOR" --saved-repair-baseline`. Receipt SHA-256 `6fca60fa23d955fb0365930edcccae8e0e95989bfba6b653f273e4df3c01a462`.
- Updated desktop `D656_SOURCE_FROZEN=1 node test/nested-approved-comparison-browser.mjs "$EVIDENCE/final" "$PRIOR" --saved-repair`. Receipt SHA-256 `a3744a69720faf58461304013a92e2ef696af20b74ec753d9ee57abdf3323e3a`. The flow checked 330 source files through cleanup, with zero page errors, console errors, downloads or source changes.
- Independent check `python3 -I "$EVIDENCE/final/nested-approved-comparison-oracle.py" < "$EVIDENCE/final/saved-repair-oracle-input.json"`. Result SHA-256 `9ab2983676d9e06effbb4216a160a161fcff3dd2fe155c9f7d47f5069fcbdf00`.
- Desktop regression `D654_SOURCE_FROZEN=1 node test/nested-approved-comparison-browser.mjs "$EVIDENCE/regression-d654" "$PRIOR" --attach-follow-up`. Receipt SHA-256 `7322b5593fee6280edeba654accdc9b97a24ffa3ccc8fa597b5f6d641bee278e`.
- From the repository root run `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test approved-requirement-compare project-version-ownership storage-version-snapshot version-tools-mcp` and `TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test approved-version-evidence requirement-evidence nested-parameter-proposal versions`.
- Run `pnpm --dir packages/barocss-cad-model exec tsc --noEmit`, `pnpm --dir apps/cad-studio exec tsc --noEmit`, `pnpm exec eslint` on the changed TypeScript, `node --check apps/cad-studio/test/nested-approved-comparison-browser.mjs`, `pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/vite-build"` and `git diff --check`.

The initial scenario ledger stays at 4/10 and B09 at 9/9. Whole CAD readiness remains **NOT_MEASURED**. The repair review re-evaluates the saved snapshots on selection. D657 retains that verified result for reopen without evaluation. [#2279](https://github.com/barocss/barocss/issues/2279) remains open.
