# D764 — Verify named version Restore as a dirty working edit

P0 B08-01, rows 12 and 16. SMALL qualification. Parent `e8cfb8843d2c328d37001ba6cb2766f86524cda0`. [B08 v1 evidence ledger](../../roadmap-tracks/16-b08-evidence-ledger.md) · [D470 retained case](../named-version-restore-physical-2026-11-03/README.md).

## Qualification

- **PASS** — Studio saves a 30 × 12 × 6 mm part and creates one named version. The native version log points to snapshot `16478221bba39d67`, which contains the exact 6 mm document.
- **PASS** — The working part changes to 8 mm and is explicitly saved. Restore reopens the 6 mm snapshot as dirty. The 8 mm part bytes, version log and immutable snapshot bytes stay exact until the user explicitly saves.
- **PASS** — Explicit Save writes the restored 6 mm part. Close, reload and project Open retain it and the version row. The reopened document edits to 10 mm, leaving the saved 6 mm bytes and named snapshot exact. Saved SHA-256 values are `753dabe982fbfecc84a75f4790507dbda578112d3391ec1a284afc707912373e` at H8 and `cd562ed1a41cbde73be56212da2b9335aec9221d8b530aa4fa8d99e63a5660af` at H6. The H6 file equals the snapshot bytes in this fixture.
- **PASS** — Five independent Python checks bind the accepted document, native volume, centroid and bounds to the current Studio worker. Volumes are 2160, 2880 and 3600 mm³ at H6, H8 and H10. Relative volume and absolute centroid limits are 1e-9. Five desktop states, 799 frozen files, zero page errors, console errors or downloads.
- **PASS** — Model 18/18 and Studio 41/41 focused tests, driver syntax and diff check.
- **FAIL (driver only)** — The first driver expected snapshot contents in the disk log. The native project stores the log and keyed snapshot separately. The replay checks each native file.
- **NOT_RUN** — Other B08 groups, full suites, builds and type checks, mobile and other storage providers. No product source changed.

```sh
D764_SOURCE_FROZEN=1 node apps/cad-studio/test/project-named-version-restore-browser.mjs "$EVIDENCE/studio-replay"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test versions.test version-snapshot-identity.test
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test storage.test storage-version-snapshot.test project-version-ownership.test
node --check apps/cad-studio/test/project-named-version-restore-browser.mjs
git diff --check
```

B08 is pending at 1/6 current groups. Initial scenarios remain 6/10. Whole CAD and core readiness remain **NOT_MEASURED**. [#2236](https://github.com/barocss/barocss/issues/2236) stays closed at its canonical snapshot scope. D765 verifies public branch switches, a compatible merge and a conflict.
