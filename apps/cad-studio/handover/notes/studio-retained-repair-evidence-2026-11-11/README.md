---
work_id: D657
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D657 — Retain the saved repair evidence

P0 automation evidence, rows 04, 12 and 16. FEATURE qualification with isolated storage and read-path mutations.

Versions can save the verified repair check beside the original follow-up report. The repair file records the original approval and follow-up pins, the follow-up digest, the exact saved approval base and repaired snapshots, the user-approved proposal, and the historical, before and after reports. Reopen validates the snapshot lineage, occurrence, authored criteria, report identity and recovery verdicts before displaying the result. Saving the same proof again is idempotent. A different file at the same destination is preserved.

| Check | Result | Evidence |
| --- | --- | --- |
| Original desktop behavior | FAIL | The verified repair had no Save action. On fresh project Open with the Worker read slot blocked, the repair tried to evaluate and the prior result was unavailable. The baseline driver passed because it expected both failures. |
| Actual desktop save and reopen | PASS | The user saved the 8 mm → 4 mm repair. Fresh Open displayed the original 8 mm failure and the saved repair while the Worker read slot was blocked. There were zero Worker read requests. The native document, version log, snapshots and original follow-up report kept their bytes. |
| Mismatched saved evidence | PASS | A file with a valid recomputed checksum and a substituted approval-base version ID was refused on fresh Open. The altered bytes remained available for inspection. The original failure remained visible and there were zero Worker read requests. |
| Independent evidence audit | PASS | Python verified the envelope checksum, original report digest, approval and repair pins, the three requirement reports, the user decision, and the 8 mm → 4 mm geometry. The independent prism volume change was −800 mm³ and the sibling stayed exact. |
| Focused checks | PASS | Studio 56 and Model 40 passed. Two concurrent saves retained one exact proof. The different-base case retained distinct historical and approval-base revisions. Rehashed version, run, verdict and criterion mismatches were refused. Four isolated mutations were detected. |
| Compatibility and build | PASS | The D653 desktop flow reopened the original three-version follow-up and refused a mismatched later pin. Both TypeScript checks, changed TypeScript lint, browser driver syntax and the Studio build passed. |
| Paid live model, mobile and whole CAD suites | NOT_RUN | The desktop flow used the local scripted CLI and actual Studio, chat server and stdio MCP. |

Use Node 22.19.0 and run each heavy job under `gate.sh acquire heavy 180 <label>` and `gate.sh release heavy`. `EVIDENCE` is external to the worktree. `PRIOR` is the D607 desktop fixture directory. Run the browser commands from `apps/cad-studio`.

- Baseline `D657_SOURCE_FROZEN=1 node test/nested-approved-comparison-browser.mjs "$EVIDENCE/baseline" "$PRIOR" --retain-repair-baseline`. Receipt SHA-256 `1d3352bd90982b74727bad6e96daaf7b119872b03058f1bac7742d30f3869c46`.
- Desktop `D657_SOURCE_FROZEN=1 node test/nested-approved-comparison-browser.mjs "$EVIDENCE/desktop" "$PRIOR" --retain-repair`. Receipt SHA-256 `fccc7b1d051d72ff01fb69c4ff897cdc997fb28c18238a9c97f887ff7ee7582c`. The driver checked 331 source files through cleanup and recorded zero source changes, page errors, console errors or downloads.
- Independent check `python3 -I "$EVIDENCE/desktop/nested-approved-comparison-oracle.py" < "$EVIDENCE/desktop/retained-repair-oracle-input.json"`. Result SHA-256 `6833d5a292b97381459c1bc629ace5d9e6603b71f532e3f0562cbcaae29abc5c`.
- Desktop regression `D653_SOURCE_FROZEN=1 node test/nested-approved-comparison-browser.mjs "$EVIDENCE/regression-d653" "$PRIOR" --save-follow-up`. Receipt SHA-256 `67c5db26d2ab78f29fabe9a89c7a7cf92440b0576725611589f34b7969f1a7ec`.
- Run `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test approved-requirement-compare project-version-ownership late-save-ownership storage-version-snapshot version-tools-mcp` and `TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test approved-version-evidence requirement-evidence nested-parameter-proposal versions` from the repository root.
- Run `node "$EVIDENCE/mutations.mjs" "$PWD" "$EVIDENCE"` on isolated bundles. Result SHA-256 `9412c17c2269e354dfdc90723c395c3fda222afd0fd7ec12607e045ab6436ab3`.
- Run `pnpm --dir packages/barocss-cad-model exec tsc --noEmit`, `pnpm --dir apps/cad-studio exec tsc --noEmit`, `pnpm exec eslint` on the changed TypeScript, `node --check apps/cad-studio/test/nested-approved-comparison-browser.mjs`, `pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/vite-build"` and `git diff --check`.

Initial scenario acceptance stays at 4/10, and B09 at 9/9. Whole CAD readiness remains **NOT_MEASURED**. D658 moves to the lost-face check on one of two occurrences. [#2279](https://github.com/barocss/barocss/issues/2279) remains open.
