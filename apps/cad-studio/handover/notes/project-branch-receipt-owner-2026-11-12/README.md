# D766 — Verify late branch receipts after a project owner change

P0 B08-03, rows 12 and 16. SMALL qualification. Parent `dff8d2d7594901b7f3f4ec6075043db6097ad9b8`. [B08 v1 evidence ledger](../../roadmap-tracks/16-b08-evidence-ledger.md) · [D521 ownership repair](../project-version-completion-ownership-2026-11-05/README.md).

- **PASS** — Six actual Studio cases combine branch switch or two-parent merge with Open B, Close project or New part. Each action commits A's real OPFS log and then waits at the native close return. The newer action completes before release. The driver observes the production tag read after release.
- **PASS** — Open B keeps the 12 mm part, B's version rows and its exact saved and log bytes. Close retains the 8 mm working part with the project closed. New part retains the empty Untitled document and the attached project. All six cases preserve the accepted document, rendered body data, selection, history, dirty state, version rows and notices across release.
- **PASS** — Each committed switch retains the prior version set and points to the 6 mm side snapshot with `margin = 3`. Each committed merge records the exact two parents and an 8 mm snapshot with `margin = 3`. A's saved 8 mm part remains byte-identical in all six cases. SHA-256 is `753dabe982fbfecc84a75f4790507dbda578112d3391ec1a284afc707912373e` for the saved part, `e85789cb2ed1b0afa3d124b0808bcddf9c86e2f37dfa281987ecea2c0045e60a` for the switch snapshot, and `c62892cbb378859d3e0f49cfadc0aa442fcaaad980d493c78f34050cb420938b` for the merge snapshot.
- **PASS** — 18 Studio states, 334 frozen files, no page errors, console errors or downloads. Reviewed Open B and New part after merge release. Studio 34/34 focused tests, Model type check, driver syntax and diff check.
- **FAIL** — None in this run.
- **NOT_RUN** — Same-document edits during a pending write, other storage providers, full suites, builds and mobile. This run adds current product evidence for the existing owner checks.

```sh
D766_SOURCE_FROZEN=1 node apps/cad-studio/test/project-branch-owner-browser.mjs "$EVIDENCE/studio-first"
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test project-version-ownership.test storage-version-snapshot.test
pnpm --dir packages/barocss-cad-model type-check
node --check apps/cad-studio/test/project-branch-owner-browser.mjs
git diff --check
```

B08 is pending at 3/6. Initial scenarios are 6/10. Whole CAD and core readiness remain **NOT_MEASURED**. [#530](https://github.com/barocss/barocss/issues/530) retains its wider requirements. D767 verifies same-document edits while version work waits.
