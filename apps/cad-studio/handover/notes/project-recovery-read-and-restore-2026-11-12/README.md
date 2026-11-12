# D769 — Open the saved part when recovery data cannot be read

P0 B08-06, rows 12 and 16. SMALL qualification. Parent `c36faf5a884724d348c9bb78c07df4e923efd6b2`. [B08 v1 evidence ledger](../../roadmap-tracks/16-b08-evidence-ledger.md) · [D522 recovery controls](../project-autosave-feedback-2026-11-05/README.md).

- **PASS** — A nonempty malformed recovery file leaves the 11 mm saved part open and clean. Studio shows the JSON reason and offers no recovery. It retains both files byte for byte. A real 13 mm autosave replaces the malformed recovery and becomes available on the next project Open.
- **PASS** — A one-shot native `getFile` denial on the 13 mm copy shows the storage permission reason. Studio opens the same clean 11 mm part without a recovery offer. The saved part and valid recovery bytes stay exact. A subsequent 14 mm edit autosaves, reload offers it and Restore accepts the exact 14 mm document as dirty. The 11 mm explicit Save bytes stay exact.
- **PASS** — SHA-256 is `4344f9776712112f42992f045f08ea8695845908daba0c9d2c366dfdf8b7199f` for malformed recovery, `292ccb9fa581a9af1130bfd75cad1f1d8147f4a0d44e1f5ac0c2b529310866a3` for the retained 13 mm recovery, `5c34f5566863aace0b577560d9975a97eb7f7762cc05db5ec2d0f913975b506d` for the restored 14 mm recovery and `e88cf79eb93c5cf82607632eb2b4f10ddd9c6147df1fef797a6dc245349383c1` for the saved 11 mm part.
- **PASS** — 12 current Studio states plus 16 regression states. Each run retains 331 frozen files and reports zero page errors, console errors or downloads. Reviewed the denied-read and later Restore screens. Studio 84/84 focused tests, Model type check, driver syntax and diff check.
- **FAIL** — None in these runs. Earlier failures remain in their original records.
- **NOT_RUN** — Host permission or quota exhaustion, other storage providers, full suites, builds and mobile.

```sh
D769_SOURCE_FROZEN=1 node apps/cad-studio/test/project-autosave-interruption-browser.mjs "$EVIDENCE/studio-read-recovery" --with-read-recovery
D768_SOURCE_FROZEN=1 node apps/cad-studio/test/project-autosave-interruption-browser.mjs "$EVIDENCE/studio-denial-regression" --with-write-denial
D596_SOURCE_FROZEN=1 node apps/cad-studio/test/project-autosave-interruption-browser.mjs "$EVIDENCE/studio-interruption-regression"
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test project-autosave-feedback.test project-open-ownership.test recovery.test storage.test
pnpm --dir packages/barocss-cad-model type-check
node --check apps/cad-studio/test/project-autosave-interruption-browser.mjs
git diff --check
```

B08 v1 is accepted at 6/6 for the desktop browser-project matrix. Initial scenarios reach 7/10. Whole CAD and core readiness remain **NOT_MEASURED**. [#530](https://github.com/barocss/barocss/issues/530) remains open for its broader document and history requirements. B03's positive tapped-data condition and B06's PDF hold remain. D770 opens B10 v1 and checks same-body geometry and selection in Studio.
