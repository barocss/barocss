# D765 — Verify branch switch, compatible merge and conflict refusal

P0 B08-02, rows 12 and 16. SMALL repair. Parent `1e6eec34fa52a3d57a0c565aab3610aa1b2fa31c`. [B08 v1 evidence ledger](../../roadmap-tracks/16-b08-evidence-ledger.md).

## Decision and evidence

- **FAIL, reproduced in Studio** — Make version wrote the edited part and named version. The unsaved indicator stayed on. Make version used the project Save without its document receipt. Route both Save and Make version through the same receipt guard for the document dispatch, object and file name. Clear the indicator and working recovery copy only when the part write still belongs to that document.
- **PASS** — Studio starts both branches from the same named version. The side branch adds `margin = 3`. Main changes the extrusion from 6 to 8 mm. Make version clears the unsaved indicator and keeps exact part and snapshot bytes. Branch switches restore the matching document. The merged version `vebda63c8dbc096d5` records parents `vdbcc84e6dc3d109c` and `v397bb35d9e646aeb` in that order. Its working document includes both edits, remains dirty and leaves the earlier part bytes intact. Explicit Save and project Open retain the exact merged snapshot and log. Saved part and merge snapshot SHA-256 are both `c62892cbb378859d3e0f49cfadc0aa442fcaaad980d493c78f34050cb420938b`.
- **PASS** — A second branch pair edits extrusion `n1` to 10 and 12 mm. Studio shows one conflict and disables merging without an answer. Main keeps its exact document, selection, history, saved bytes, log and all six snapshots. Close, reload and Open retain the saved 12 mm document and version. Saved SHA-256 is `7734f786bf6caba770e34cad36a6a61566108644de4062cf16fe3ea546044912` and log SHA-256 is `ff2380d8ffe2223d645fc440a6b7e9ca493d00b51d338977a93beb69547ab790`.
- **PASS** — Nine desktop Studio states, eight independent Python checks and 800 frozen files. Exact native bounds are 30 × 12 × H mm. Volume is 360 × H mm³ at H6, H8, H10 and H12. Relative volume and absolute centroid limits are 1e-9. Zero page errors, console errors or downloads. Reviewed the merge and conflict screenshots.
- **PASS** — Model 18/18 and Studio 50/50 focused tests, both type checks, driver syntax and diff check.
- **NOT_RUN** — Manual conflict resolution, other storage providers, full suites, production builds and mobile.

```sh
D765_SOURCE_FROZEN=1 node apps/cad-studio/test/project-branch-merge-browser.mjs "$EVIDENCE/studio-replay"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test versions.test version-snapshot-identity.test
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test storage.test storage-version-snapshot.test project-version-ownership.test late-save-ownership.test
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
node --check apps/cad-studio/test/project-branch-merge-browser.mjs
git diff --check
```

B08 is pending at 2/6. Initial scenarios are 6/10. Whole CAD and core readiness remain **NOT_MEASURED**. [#530](https://github.com/barocss/barocss/issues/530) remains open for its wider document and history requirements. D766 checks late branch and merge receipts after project owner changes.
