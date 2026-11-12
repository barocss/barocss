# D768 — Restore the prior recovery after a failed autosave

P0 B08-05, rows 12 and 16. SMALL qualification. Parent `14b836a0ed031580fd77445c073708d10c85c4ed`. [B08 v1 evidence ledger](../../roadmap-tracks/16-b08-evidence-ledger.md) · [D522 feedback](../project-autosave-feedback-2026-11-05/README.md) · [D596 interruption](../interrupted-project-autosave-2026-11-11/README.md).

- **PASS** — Desktop Studio saves a 20 × 10 × 10 mm part. A reload before native close leaves an empty first recovery entry and the exact saved part. Open accepts the 10 mm part with no recovery offer. A later 11 mm autosave completes.
- **PASS** — A 12 mm edit reaches the native recovery writable. The scheduler injects one `NotAllowedError` before the write. The adapter aborts the writable once. Studio displays “Automatic recovery is unavailable” with the normalized permission reason. The 12 mm document remains dirty. The saved 10 mm part and committed 11 mm recovery stay byte-identical.
- **PASS** — Reload and public Open show the saved 10 mm part and offer the prior 11 mm copy. Restore accepts the exact 11 mm document as dirty. Explicit Save writes it and a fresh Open offers no equal recovery. The original saved SHA-256 is `051eb245e985b8dee29d230369d0fc2a1c7c952593b9bf0dba05ab4224a03319`. The prior recovery and final saved SHA-256 are both `e88cf79eb93c5cf82607632eb2b4f10ddd9c6147df1fef797a6dc245349383c1`.
- **PASS** — Nine desktop states for the combined failure and Restore, plus seven states for the D596 interruption replay. Both retain 331 frozen files with zero page errors, console errors or downloads. Reviewed the denial and restored-part screenshots. Studio 84/84 focused tests, Model type check, driver syntax and diff check.
- **FAIL** — None in these runs. Earlier D522 and D596 failures retain their original records.
- **NOT_RUN** — Host quota exhaustion, other storage providers, full suites, builds and mobile. The denial uses a test-only injection.

```sh
D768_SOURCE_FROZEN=1 node apps/cad-studio/test/project-autosave-interruption-browser.mjs "$EVIDENCE/studio-denial" --with-write-denial
D596_SOURCE_FROZEN=1 node apps/cad-studio/test/project-autosave-interruption-browser.mjs "$EVIDENCE/studio-interruption-regression"
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test project-autosave-feedback.test project-open-ownership.test recovery.test storage.test
pnpm --dir packages/barocss-cad-model type-check
node --check apps/cad-studio/test/project-autosave-interruption-browser.mjs
git diff --check
```

B08 is pending at 5/6. Initial scenarios are 6/10. Whole CAD and core readiness remain **NOT_MEASURED**. [#530](https://github.com/barocss/barocss/issues/530) retains its wider requirements. D769 verifies malformed and unreadable recovery data and the later successful recovery path.
