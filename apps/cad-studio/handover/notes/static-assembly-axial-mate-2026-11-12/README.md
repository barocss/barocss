# D760 — Verify the concentric and distance mate lifecycle

P3 B05-04, rows 10, 12 and 16. SMALL qualification. Parent `bdc78fe81df0fe88712914e7401dced8d7084800`. [B05 evidence ledger](../../roadmap-tracks/15-b05-evidence-ledger.md) · [D458 retained case](../concentric-distance-workflow-2026-11-03/README.md).

## Qualification

- **PASS** — The public reference picker sets Concentric between `base/n2.side0` and `pin/n1.side0`. The pin moves from [80, 16, 0] to [32, 16, 0] mm and keeps one slide and one turn. Distance between `base/n1.top` and `pin/n1.bottom` removes the slide. Distance 0 and 3 mm place the pin at Z8 and Z11 mm.
- **PASS** — A second Distance of 5 mm is refused. The status names the accepted Distance and the 2 mm mismatch. The accepted document, pose and dirty state stay exact. After Cancel, first Undo restores Distance 0 and Z8. Redo restores Distance 3 and Z11.
- **PASS** — Local project Save, Close, reload and Open restore the accepted native document. Editing the reopened Distance back to zero restores Z8 and the exact earlier document. Input SHA-256 `d01c2ed8cc22339b353e9cab97522a1144286882cb78a5c51a9e4157be4e2d03`. Saved SHA-256 `7f7d392a64b9fbf07daa6c0bcf956ad18302a6e6dca83f14229a2af2af477cd7`.
- **PASS** — Eight independent Python checks bind the stored references, native B-rep face table, mass properties, and current viewport bounds to the same document. The bore and pin are radius 4 mm with a common Z axis at [32, 16]. Holder and pin volumes are 15981.876140340513 and 1005.3096491487329 mm³. Relative volume and absolute coordinate limits are 1e-9. Nine desktop states, 796 frozen source files, zero page errors, console errors or downloads.
- **PASS** — Model 17/17 and Studio 19/19 focused tests, driver syntax and diff check.
- **FAIL (driver only)** — The first driver assumed a Distance default of zero. Studio used its 10 mm default and correctly placed the pin at Z18. The replay explicitly enters zero.
- **NOT_RUN** — Full suites, build and type checks, mobile, arbitrary rotated mates, fit and interference certification, Motion and Physics. Product source was not modified.

```sh
D760_SOURCE_FROZEN=1 node apps/cad-studio/test/static-assembly-axial-mate-browser.mjs "$EVIDENCE/studio-replay"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test mates.test
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test storage.test assembly-linked-faces mate-pattern-commit.test
node --check apps/cad-studio/test/static-assembly-axial-mate-browser.mjs
git diff --check
```

B05 is pending at 4/7 current groups. Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**. [#538](https://github.com/barocss/barocss/issues/538) remains open. D761 verifies nested selection and mate ownership through linked revision Keep, Accept and native project reopen.
