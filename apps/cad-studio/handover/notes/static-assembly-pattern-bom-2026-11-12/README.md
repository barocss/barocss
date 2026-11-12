# D762 — Verify patterned material, skip and BOM mass

P3 B05-06, rows 10, 12 and 16. SMALL qualification. Parent `d501cf2cdd9db10826ce4b5d9371581bc34c796a`. [B05 v1 evidence ledger](../../roadmap-tracks/15-b05-evidence-ledger.md).

## Qualification

- **PASS** — The public pattern controls place four 10 mm cubes at X0, X25, X50 and X75 on a 160 × 60 × 4 mm base. Setting the seed to steel propagates that material to all four. The selected driven occurrence shows steel with a disabled material control. Skip removes the X50 occurrence from the assembly and the BOM.
- **PASS** — The grouped Cube quantity changes from 4 to 3. The base stays on its own row with quantity 1. Exact total mass is 114.48 g for the four inherited cubes, 135.08 g for four steel cubes and 127.23 g after skipping one steel cube. Studio displays 114.5, 135.1 and 127.2 g. The calculation uses the existing library densities of 0.0027 and 0.00785 g/mm³.
- **PASS** — Undo and Redo restore the exact skip and material states. Project Save, Close, reload and Open preserve the skipped steel pattern and BOM. Reset material gives three inherited cubes and 111.78 g. Restore returns the exact original four-cube pattern and 114.48 g. Source SHA-256 `2a7b802363e7b38cd5bf8c7af15e997805068bb05f5dfe4995609758f0bb7ffe`. Saved SHA-256 `fd54bf92ee5db23d8fd5e9f0cefd96d438556cbdc339014030b34f09dd2523e5`.
- **PASS** — Ten Python checks independently compute quantities, placement and mass from the fixed dimensions and densities. Each check compares the accepted native document, unrounded BOM output and current Studio display. Ten desktop states, 848 frozen source files and zero page errors, console errors or downloads.
- **PASS** — Model 38/38 and Studio 27/27 focused tests. Driver syntax and diff check.
- **FAIL (driver only)** — The first driver expected an icon name in outliner text. The current icon is SVG. The replay selects the actual instance label.
- **NOT_RUN** — Full suites, builds and type checks, mobile, other pattern kinds, material-standard certification, Motion and Physics. No product source changed.

```sh
D762_SOURCE_FROZEN=1 node apps/cad-studio/test/static-assembly-pattern-bom-browser.mjs "$EVIDENCE/studio-replay"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test instance-patterns.test bom-panel.test bom-base.test
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test instance-looks.test storage.test bom-linked-ui.test
node --check apps/cad-studio/test/static-assembly-pattern-bom-browser.mjs
git diff --check
```

B05 is pending at 6/7 current groups. Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**. [#538](https://github.com/barocss/barocss/issues/538) remains open. D763 verifies assembly drawing revision and accepted source through project reopen.
