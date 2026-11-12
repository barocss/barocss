# D767 — Verify an edit during a pending version operation

P0 B08-04, rows 12 and 16. SMALL qualification. Parent `8f0a491029e0d050bc3a654d8364189be2f1fdd2`. [B08 v1 evidence ledger](../../roadmap-tracks/16-b08-evidence-ledger.md) · [D521 retained controls](../project-version-completion-ownership-2026-11-05/README.md).

- **PASS** — Studio accepts a 10 mm edit to the same document while a branch switch, a divergent merge or the preliminary Save of Make version waits for a real native close receipt. Each release preserves the exact edit, geometry, selection, history and dirty indicator.
- **PASS** — The switch and merge keep their committed version logs, expected branch and exact snapshots. The explicit part bytes stay at 8 mm until the next Save. The delayed Make version has already committed 9 mm to the part file. Its release keeps those bytes and creates no version. The 10 mm edit remains dirty.
- **PASS** — Explicit Save writes the exact 10 mm document in all three cases. A following Make version stores the same snapshot and takes the expected parent on the side or main branch. SHA-256 is `3868dfc3eb1345ade9c386e6c5dbd692df0d93ee51f4d465f92cad49c6450aa5` for the 10 mm file and snapshot and `fc093fc625d4905eaf126cd63595b123145767cb673b6b8f4d7f62326da043b4` for the preceding 9 mm file.
- **PASS** — Three edit cases with 12 desktop states and the six D766 regression cases with 18 states. Both runs retain 334 frozen files and report zero page errors, console errors or downloads. Reviewed the 10 mm working document after the delayed Make version. Studio 38/38 focused checks, Model type check, driver syntax and diff check.
- **FAIL** — None in these runs.
- **NOT_RUN** — Other storage providers, full suites, builds and mobile.

```sh
D767_SOURCE_FROZEN=1 node apps/cad-studio/test/project-branch-owner-browser.mjs "$EVIDENCE/studio-edits" same-document-edit
D766_SOURCE_FROZEN=1 node apps/cad-studio/test/project-branch-owner-browser.mjs "$EVIDENCE/studio-owner-regression"
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test project-version-ownership.test late-save-ownership.test
pnpm --dir packages/barocss-cad-model type-check
node --check apps/cad-studio/test/project-branch-owner-browser.mjs
git diff --check
```

B08 is pending at 4/6. Initial scenarios are 6/10. Whole CAD and core readiness remain **NOT_MEASURED**. [#530](https://github.com/barocss/barocss/issues/530) retains its wider requirements. D768 checks a failed native autosave and a later recovery in the same project.
