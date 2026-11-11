---
work_id: D655
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D655 — Prepare a repair from a selected saved regression

P0 automation evidence, rows 04, 12 and 16. FULL qualification for the selected-turn MCP tool.

The person attaches the retained three-version report. The scoped tool requires the current requirement evidence revision and checks the same authored criteria on the same nested occurrence. For a verified current failure, it tests the previously approved parameter value on a candidate and checks the passing hard requirements. It keeps the proposal open for Studio preview and explicit user approval. The proposal records the selected report SHA-256, saved follow-up version, occurrence and confirmed failing criteria. A proposal cannot follow a working edit through chat merge or a stale rebase.

| Check | Result | Evidence |
| --- | --- | --- |
| Original Studio behavior | FAIL | The attachment could be read. The selected turn had no repair operation. The baseline driver passed because it expected that missing tool. |
| First updated desktop run | FAIL | A discarded reply and a new reply both named P2. The chat linked both replies to the new proposal. The tool event now identifies the exact proposal record. |
| Actual desktop Studio and stdio MCP | PASS | The tool refused a missing attachment, a stale revision and a freshly measured passing model at 3 mm. A late result from the 8 mm revision left the new working model exact. A fresh turn produced one P2 on the 8 mm failure, refused agent approval, and kept geometry unchanged until user approval. Studio saved and reopened the 4 mm passing assembly. The original report and four earlier snapshots kept their bytes. |
| Independent native prism check | PASS | The 20 × 10 mm profile and 8 → 4 mm height give a −800 mm³ volume change. The placed Studio preview showed the same change. The sibling, placements, feature definitions and leaf criteria were preserved. |
| Desktop regressions | PASS | D654 retained follow-up attachment and D610 saved history and MCP reads. |
| Focused checks and isolated mutations | PASS | Model 81 and Studio 134 passed. The checks detected all four overlays that removed stale refusal, exact working scope, preservation of a passing hard check, or stale-merge refusal. Both TypeScript checks, changed TypeScript lint, browser driver syntax and Studio build passed. |
| Paid live model, mobile and whole CAD suites | NOT_RUN | The desktop flow used a local scripted CLI against the actual Studio, chat server and stdio MCP. |

Use Node 22.19.0 and one heavy run at a time with `gate.sh acquire heavy 180 <label>` and `gate.sh release heavy`. `EVIDENCE` is an external evidence directory. `PRIOR` is the D607 desktop fixture directory. Run the browser commands from `apps/cad-studio`.

- Baseline command `D655_SOURCE_FROZEN=1 node test/nested-approved-comparison-browser.mjs "$EVIDENCE/baseline" "$PRIOR" --repair-follow-up-baseline`. Receipt SHA-256 `b88f841c239f8da1309bc77441b8a9ef6926303641752c0a9817c13b6cd31ea6`.
- Actual desktop command `D655_SOURCE_FROZEN=1 node test/nested-approved-comparison-browser.mjs "$EVIDENCE/desktop-retry" "$PRIOR" --repair-follow-up`. Receipt SHA-256 `15429f186b64e18d65d5011f090cbdb76b28178588320ff13c129d4dc8687dc6`. It checked 328 source files through cleanup and recorded zero source changes, page errors, console errors or downloads.
- Independent command `python3 -I "$EVIDENCE/desktop-retry/nested-approved-comparison-oracle.py" < "$EVIDENCE/desktop-retry/selected-repair-oracle-input.json"`. Result SHA-256 `99133c106e945e2d66b999912999fe4c1f5ec5a08b028a29af0dd28171e65890`.
- Regression commands `D654_SOURCE_FROZEN=1 node test/nested-approved-comparison-browser.mjs "$EVIDENCE/regression-d654" "$PRIOR" --attach-follow-up` and `D610_SOURCE_FROZEN=1 node test/nested-approved-comparison-browser.mjs "$EVIDENCE/regression-d610" "$PRIOR" --lifecycle`. Receipt SHA-256 values in that order are `b75d39b0080169971ae57f2322efe90b792ba9c8719b05cf7cf4756b04bf28d1` and `a4c9989173a753adb87783843f9775df82c161a6850a9b0252aad05186407541`.
- From the repository root, run `TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test approved-version-evidence nested-parameter-proposal requirement-evidence team-freshness proposals.test versions toolset tool-contract chat-merge`.
- From the repository root, run `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test approved-requirement-compare version-tools-mcp project-open-ownership project-version-ownership late-save-ownership storage-version-snapshot edit-in-place chat toolset-mcp tool-contract-mcp`.
- Mutation command `node "$EVIDENCE/mutations.mjs" "$PWD" "$EVIDENCE"`. The script changes isolated bundles. Result SHA-256 `adab94da241febc5a8f81e003973a66ef9d23f4bdde2c893f14d556ef07dc23b`.
- Run `pnpm --dir packages/barocss-cad-model exec tsc --noEmit`, `pnpm --dir apps/cad-studio exec tsc --noEmit`, `pnpm exec eslint` on the changed TypeScript, `node --check apps/cad-studio/test/nested-approved-comparison-browser.mjs`, `pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/vite-build"` and `git diff --check`.

Initial scenario acceptance stays at 4/10 and B09 at 9/9. Whole CAD readiness remains **NOT_MEASURED**. D656 verifies saved resolution against the retained failure. [#2279](https://github.com/barocss/barocss/issues/2279) remains open for that and the remaining issue acceptance.
