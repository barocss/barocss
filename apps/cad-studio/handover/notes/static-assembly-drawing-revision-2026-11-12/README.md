# D763 — Verify assembly drawing revision and accepted source

P3 B05-07, rows 10, 11, 12 and 16. SMALL qualification. Parent `f6380f18e2fc9d72b564a312740c4c56a71b2f01`. [B05 v1 evidence ledger](../../roadmap-tracks/15-b05-evidence-ledger.md) · [D459 retained case](../assembly-drawing-revision-2026-11-03/README.md).

## Qualification

- **PASS** — Studio issues A at 1:1 for two translated 30 × 12 × 6 mm boxes. Moving the second box from X40 to X55 increases the front width from 70 to 85 mm. The stale-revision notice appears while the authored issue A and its marker stay exact. The first box and the second box's definition stay exact.
- **PASS** — Undo restores the current A drawing at width 70. Redo restores the stale A drawing at width 85. Next revision issues B from the accepted source. Changing A4 to A3 preserves issue B, its marker and the current source.
- **PASS** — Project Save, Close, reload and Open retain the exact issued B document. Moving the reopened second box to X40 returns the front width to 70 mm and makes issue B stale. Input SHA-256 `350dbcadabd5569fd796d913134b5c4079c8d120708cccfcdb196a1b22309934`. Saved SHA-256 `e6342a44c79046e4a55e992caad3b4b0d94f50a7457c0b60ae665d6e9c7f385d`.
- **PASS** — Eight independent XML checks read the generated SVG at the browser's download handoff. Each checks four horizontal extents, height 6, scale 1:1, revision and printed source. The printed source is `2f3249ec8ddc06f6` at X40 and `053fde66f4d2c16b` at X55. The authored issue marker and printed source are distinct. Eight desktop states, 798 frozen source files, zero page errors, console errors or downloads.
- **PASS** — Model 13/13 and Studio 20/20 focused tests, driver syntax and diff check.
- **FAIL** — None in the executed checks.
- **NOT_RUN** — Full suites, builds and type checks, mobile, PDF, drawing standards, integrated coverage of all B05 profiles in one assembly, Motion and Physics. No product source changed.

```sh
D763_SOURCE_FROZEN=1 node apps/cad-studio/test/static-assembly-drawing-revision-browser.mjs "$EVIDENCE/studio"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test drawing-current-contract.test drawing-issues.test
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test drawing-revision-print.test storage.test
node --check apps/cad-studio/test/static-assembly-drawing-revision-browser.mjs
git diff --check
```

B05 v1 is accepted at 7/7 for its seven declared profiles. Initial scenarios reach 6/10. Whole CAD and core readiness remain **NOT_MEASURED**. [#538](https://github.com/barocss/barocss/issues/538) and [#540](https://github.com/barocss/barocss/issues/540) remain open at their broader scope. D764 freezes B08's project/version recovery groups and verifies named version Restore in current Studio.
